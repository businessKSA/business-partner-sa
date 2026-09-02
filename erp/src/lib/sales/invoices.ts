/**
 * فواتير المبيعات.
 *
 * الحساب هنا يتبع قاعدةً واحدة: تُقرَّب الضريبة على مستوى السطر، ثم تُجمع
 * السطور. القاعدة البديلة — جمع الأوعية ثم ضربها في النسبة — تعطي رقماً
 * يختلف بالهللة عن مجموع سطور الفاتورة المطبوعة، والعميل يجمع السطور بيده
 * فيجد فرقاً لا يفهمه، والمدقّق يجده كذلك.
 *
 * والفاتورة لا تلمس دفتر الأستاذ بنفسها: تبني قيداً وتناوله `postEntry`،
 * فتُفرض عليها القواعد نفسها المفروضة على القيد اليدوي — لا استثناء لأن
 * المصدر آليّ.
 */
import type { Tx } from '../db.ts';
import { d, money, sum, Decimal, type Num } from '../money.ts';
import { DomainError, ValidationError } from '../errors.ts';
import { postEntry, reverseEntry, accountByRole } from '../accounting/posting.ts';
import { nextNumber } from '../accounting/numbering.ts';

export type InvoiceLineInput = {
  itemId?: string | null;
  descAr: string;
  descEn?: string | null;
  qty: Num;
  uomCode?: string;
  unitPrice: Num;
  /** خصم السطر بالقيمة */
  discount?: Num;
  taxCodeId?: string | null;
  /** حساب الإيراد — يُشتقّ من الصنف أو من الدور الافتراضي حين يُترك */
  revenueAccountId?: string | null;
};

export type InvoiceInput = {
  partnerId: string;
  issueDate: Date;
  dueDate?: Date | null;
  kind?: 'STANDARD' | 'SIMPLIFIED';
  docType?: 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE';
  currency?: string;
  projectId?: string | null;
  costCenterId?: string | null;
  notesAr?: string | null;
  poRef?: string | null;
  originalInvoiceId?: string | null;
  correctionReason?: string | null;
  lines: InvoiceLineInput[];
  createdBy?: string;
};

export type ComputedLine = {
  lineNet: Decimal;
  lineVat: Decimal;
  lineTotal: Decimal;
  taxRate: Decimal;
};

/** يحسب سطراً واحداً. مُصدَّرة لأن الواجهة تعرض المجاميع قبل الحفظ. */
export function computeLine(qty: Num, unitPrice: Num, discount: Num, taxRate: Num): ComputedLine {
  const gross = d(qty).times(d(unitPrice));
  const net = money(gross.minus(d(discount)));

  if (net.isNegative()) {
    throw new ValidationError('خصم السطر أكبر من قيمته — راجع الكمية أو الخصم.');
  }

  const rate = d(taxRate);
  const vat = money(net.times(rate));

  return { lineNet: net, lineVat: vat, lineTotal: money(net.plus(vat)), taxRate: rate };
}

/**
 * ينشئ فاتورة مسوّدة.
 *
 * المسوّدة لا أثر لها في الدفتر ولا لدى الهيئة — تُعدَّل وتُحذف بحرية.
 * الترحيل هو الخط الفاصل الذي بعده لا تعديل.
 */
export async function createInvoice(tx: Tx, tenantId: string, input: InvoiceInput) {
  if (!input.lines?.length) {
    throw new ValidationError('الفاتورة بلا سطور.');
  }

  const partner = await tx.partner.findFirst({ where: { id: input.partnerId, tenantId } });
  if (!partner) throw new DomainError('العميل غير موجود', 'NOT_FOUND');
  if (!partner.isCustomer) {
    throw new ValidationError(`«${partner.nameAr}» ليس مسجَّلاً كعميل.`);
  }

  const docType = input.docType ?? 'INVOICE';
  const kind = input.kind ?? 'STANDARD';

  // الفاتورة الضريبية (بين المنشآت) تشترط بيانات المشتري: رقمه الضريبي أو
  // معرّفاً بديلاً. المبسطة لا تشترطها.
  if (kind === 'STANDARD' && !partner.vatNumber && !partner.otherIdValue) {
    throw new ValidationError(
      `الفاتورة الضريبية تشترط الرقم الضريبي للمشتري أو معرّفاً بديلاً. ` +
        `أضِفهما لـ«${partner.nameAr}» أو أصدِرها فاتورةً مبسطة.`,
    );
  }

  if (docType !== 'INVOICE') {
    if (!input.originalInvoiceId) {
      throw new ValidationError('الإشعار الدائن أو المدين يشترط الفاتورة الأصلية.');
    }
    if (!input.correctionReason) {
      throw new ValidationError('الإشعار يشترط ذكر السبب — تشترطه الهيئة.');
    }
  }

  const numberType =
    docType === 'CREDIT_NOTE' ? 'CREDIT_NOTE' : docType === 'DEBIT_NOTE' ? 'DEBIT_NOTE' : 'SALES_INVOICE';
  const number = await nextNumber(tx, tenantId, numberType, input.issueDate);

  const defaultTax = await tx.taxCode.findFirst({ where: { tenantId, isDefault: true } });

  const prepared: (InvoiceLineInput & ComputedLine & {
    taxCodeId: string | null; revenueAccountId: string | null; uomCode: string;
  })[] = [];

  for (const [i, line] of input.lines.entries()) {
    const taxCodeId = line.taxCodeId ?? defaultTax?.id ?? null;
    const taxCode = taxCodeId
      ? await tx.taxCode.findFirst({ where: { id: taxCodeId, tenantId } })
      : null;
    if (taxCodeId && !taxCode) {
      throw new DomainError(`السطر ${i + 1}: الرمز الضريبي غير موجود`, 'NOT_FOUND');
    }

    let revenueAccountId = line.revenueAccountId ?? null;
    let uomCode = line.uomCode ?? 'PCE';

    if (line.itemId) {
      const item = await tx.item.findFirst({ where: { id: line.itemId, tenantId } });
      if (!item) throw new DomainError(`السطر ${i + 1}: الصنف غير موجود`, 'NOT_FOUND');
      revenueAccountId ??= item.incomeAccountId;
      if (!line.uomCode) uomCode = item.uomCode;
    }

    revenueAccountId ??= (await accountByRole(tx, tenantId, 'SALES')).id;

    const computed = computeLine(line.qty, line.unitPrice, line.discount ?? 0, taxCode?.rate ?? 0);
    prepared.push({ ...line, ...computed, taxCodeId, revenueAccountId, uomCode });
  }

  const subtotal = money(sum(prepared.map((l) => l.lineNet.plus(d(l.discount ?? 0)))));
  const discountTotal = money(sum(prepared.map((l) => d(l.discount ?? 0))));
  const taxableAmount = money(sum(prepared.map((l) => l.lineNet)));
  const vatTotal = money(sum(prepared.map((l) => l.lineVat)));
  const total = money(taxableAmount.plus(vatTotal));

  const dueDate =
    input.dueDate ??
    (partner.paymentTermDays > 0
      ? new Date(input.issueDate.getTime() + partner.paymentTermDays * 86_400_000)
      : input.issueDate);

  return tx.salesInvoice.create({
    data: {
      tenantId, number, docType, kind,
      partnerId: input.partnerId,
      issueDate: input.issueDate,
      issueTime: new Date(),
      dueDate,
      currency: input.currency ?? partner.currency ?? 'SAR',
      subtotal: subtotal.toFixed(6),
      discountTotal: discountTotal.toFixed(6),
      taxableAmount: taxableAmount.toFixed(6),
      vatTotal: vatTotal.toFixed(6),
      total: total.toFixed(6),
      projectId: input.projectId ?? null,
      costCenterId: input.costCenterId ?? null,
      notesAr: input.notesAr ?? null,
      poRef: input.poRef ?? null,
      originalInvoiceId: input.originalInvoiceId ?? null,
      correctionReason: input.correctionReason ?? null,
      createdBy: input.createdBy ?? null,
      lines: {
        create: prepared.map((l, idx) => ({
          tenantId,
          itemId: l.itemId ?? null,
          descAr: l.descAr,
          descEn: l.descEn ?? null,
          qty: d(l.qty).toFixed(6),
          uomCode: l.uomCode,
          unitPrice: d(l.unitPrice).toFixed(6),
          discount: d(l.discount ?? 0).toFixed(6),
          taxCodeId: l.taxCodeId,
          taxRate: l.taxRate.toFixed(6),
          lineNet: l.lineNet.toFixed(6),
          lineVat: l.lineVat.toFixed(6),
          lineTotal: l.lineTotal.toFixed(6),
          revenueAccountId: l.revenueAccountId,
          sortOrder: idx,
        })),
      },
    },
    include: { lines: true },
  });
}

/**
 * يرحّل الفاتورة محاسبياً.
 *
 * القيد للفاتورة العادية:
 *   من ح/ الذمم المدينة        بالإجمالي
 *     إلى ح/ الإيرادات          بالوعاء (سطراً سطراً بحساب كلٍّ)
 *     إلى ح/ ضريبة المخرجات     بالضريبة
 *
 * والإشعار الدائن يقلبه: فهو ردّ إيرادٍ وردّ ضريبة، لا مصروف.
 */
export async function postInvoice(tx: Tx, tenantId: string, invoiceId: string, actor?: string) {
  const invoice = await tx.salesInvoice.findFirst({
    where: { id: invoiceId, tenantId },
    include: { lines: true, partner: true },
  });
  if (!invoice) throw new DomainError('الفاتورة غير موجودة', 'NOT_FOUND');

  if (invoice.status !== 'DRAFT') {
    throw new DomainError(
      `الفاتورة ${invoice.number} حالتها «${invoice.status}» — لا يُرحَّل إلا المسوّد.`,
      'NOT_DRAFT',
    );
  }

  const isCredit = invoice.docType === 'CREDIT_NOTE';

  const arAccount = invoice.partner.arAccountId
    ? await tx.account.findFirstOrThrow({ where: { id: invoice.partner.arAccountId, tenantId } })
    : await accountByRole(tx, tenantId, 'RECEIVABLE');

  const vatAccount = await accountByRole(tx, tenantId, 'VAT_OUTPUT');

  const lines: Record<string, unknown>[] = [];

  // طرف الذمم
  lines.push({
    accountId: arAccount.id,
    [isCredit ? 'credit' : 'debit']: money(invoice.total),
    descAr: `${isCredit ? 'إشعار دائن' : 'فاتورة'} ${invoice.number} — ${invoice.partner.nameAr}`,
    partnerId: invoice.partnerId,
    projectId: invoice.projectId,
    costCenterId: invoice.costCenterId,
  });

  // أطراف الإيراد — سطراً سطراً ليظهر كل حساب إيراد على حدة في التقارير
  for (const l of invoice.lines) {
    if (money(l.lineNet).isZero()) continue;
    lines.push({
      accountId: l.revenueAccountId!,
      [isCredit ? 'debit' : 'credit']: money(l.lineNet),
      descAr: l.descAr,
      partnerId: invoice.partnerId,
      projectId: invoice.projectId,
      costCenterId: invoice.costCenterId,
    });
  }

  // طرف الضريبة — يحمل الوسم والوعاء ليُبنى منه الإقرار
  if (!money(invoice.vatTotal).isZero()) {
    const mainTaxCode = invoice.lines.find((l) => l.taxCodeId)?.taxCodeId ?? null;
    lines.push({
      accountId: vatAccount.id,
      [isCredit ? 'debit' : 'credit']: money(invoice.vatTotal),
      descAr: `ضريبة القيمة المضافة — ${invoice.number}`,
      partnerId: invoice.partnerId,
      taxCodeId: mainTaxCode,
      taxBase: isCredit ? money(invoice.taxableAmount).negated() : money(invoice.taxableAmount),
    });
  }

  const entry = await postEntry(tx, tenantId, {
    date: invoice.issueDate,
    memoAr: `${isCredit ? 'إشعار دائن' : 'فاتورة مبيعات'} ${invoice.number}`,
    ref: invoice.number,
    sourceType: 'SALES_INVOICE',
    sourceId: invoice.id,
    currency: invoice.currency,
    createdBy: actor,
    lines: lines as never,
  });

  return tx.salesInvoice.update({
    where: { id: invoice.id },
    data: {
      status: 'POSTED',
      journalEntryId: entry.id,
      postedAt: new Date(),
      postedBy: actor ?? null,
    },
    include: { lines: true },
  });
}

/**
 * يلغي فاتورة مرحَّلة بعكس قيدها.
 *
 * لا يُحذف شيء: الفاتورة تبقى بحالة «ملغاة» ورقمها محجوز — لأن حذفها
 * يُحدث فجوةً في التسلسل، والفجوة سؤالٌ في أي فحص ضريبي.
 */
export async function cancelInvoice(
  tx: Tx,
  tenantId: string,
  invoiceId: string,
  opts: { date?: Date; reason?: string; actor?: string } = {},
) {
  const invoice = await tx.salesInvoice.findFirst({ where: { id: invoiceId, tenantId } });
  if (!invoice) throw new DomainError('الفاتورة غير موجودة', 'NOT_FOUND');

  if (invoice.status === 'CANCELLED') {
    throw new DomainError('الفاتورة ملغاة سلفاً.', 'ALREADY_CANCELLED');
  }

  const paid = money(invoice.paidAmount);
  if (paid.greaterThan(0)) {
    throw new DomainError(
      `الفاتورة ${invoice.number} سُدِّد منها ${paid.toFixed(2)}. ألغِ السندات أولاً أو أصدِر إشعاراً دائناً.`,
      'INVOICE_HAS_PAYMENTS',
    );
  }

  const zatca = await tx.zatcaDocument.findUnique({ where: { invoiceId } });
  if (zatca && ['CLEARED', 'REPORTED', 'WARNING'].includes(zatca.status)) {
    throw new DomainError(
      `الفاتورة ${invoice.number} أُبلغت للهيئة ولا تُلغى. أصدِر إشعاراً دائناً بقيمتها.`,
      'INVOICE_SUBMITTED_TO_ZATCA',
    );
  }

  if (invoice.journalEntryId) {
    await reverseEntry(tx, tenantId, invoice.journalEntryId, {
      date: opts.date ?? new Date(),
      memoAr: `إلغاء الفاتورة ${invoice.number}${opts.reason ? ` — ${opts.reason}` : ''}`,
      actor: opts.actor,
    });
  }

  return tx.salesInvoice.update({
    where: { id: invoice.id },
    data: { status: 'CANCELLED', notesAr: opts.reason ?? invoice.notesAr },
  });
}
