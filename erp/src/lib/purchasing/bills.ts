/**
 * فواتير الموردين.
 *
 * المرآة المقابلة لفواتير المبيعات، بفارقين جوهريين:
 *
 *  ـ رقم فاتورة المورّد يُحفظ كما ورد (`vendorRef`) منفصلاً عن رقمنا
 *    الداخلي. خلطهما يجعل تتبّع الفاتورة لدى المورّد مستحيلاً عند أي خلاف،
 *    ويكسر تسلسلنا الداخلي إن كان ترقيم المورّد مختلفاً.
 *
 *  ـ ضريبة المدخلات أصلٌ لا خصم: ما دفعناه للمورّد يُخصم من ضريبة مخرجاتنا
 *    عند الإقرار، فيُرحَّل مديناً على حساب مستقلّ لا يُخلط بحساب المخرجات.
 */
import type { Tx } from '../db.ts';
import { d, money, sum, type Num } from '../money.ts';
import { DomainError, ValidationError } from '../errors.ts';
import { postEntry, reverseEntry, accountByRole } from '../accounting/posting.ts';
import { nextNumber } from '../accounting/numbering.ts';
import { computeLine } from '../sales/invoices.ts';

export type BillLineInput = {
  itemId?: string | null;
  descAr: string;
  qty: Num;
  unitPrice: Num;
  discount?: Num;
  taxCodeId?: string | null;
  /** حساب المصروف أو المخزون الذي يُحمَّل عليه السطر */
  expenseAccountId?: string | null;
};

export type BillInput = {
  partnerId: string;
  /** رقم فاتورة المورّد كما وردت */
  vendorRef?: string | null;
  orderId?: string | null;
  issueDate: Date;
  dueDate?: Date | null;
  currency?: string;
  projectId?: string | null;
  costCenterId?: string | null;
  notesAr?: string | null;
  lines: BillLineInput[];
  createdBy?: string;
};

export async function createBill(tx: Tx, tenantId: string, input: BillInput) {
  if (!input.lines?.length) throw new ValidationError('فاتورة المورّد بلا سطور.');

  const partner = await tx.partner.findFirst({ where: { id: input.partnerId, tenantId } });
  if (!partner) throw new DomainError('المورّد غير موجود', 'NOT_FOUND');
  if (!partner.isVendor) {
    throw new ValidationError(`«${partner.nameAr}» ليس مسجَّلاً كمورّد.`);
  }

  // فاتورة المورّد نفسها لا تُدخل مرّتين — وهو الخطأ الأشيع في إدخال
  // المشتريات، ونتيجته مصروفٌ مضاعف وضريبة مدخلات مضاعفة.
  if (input.vendorRef) {
    const dup = await tx.vendorBill.findFirst({
      where: { tenantId, partnerId: input.partnerId, vendorRef: input.vendorRef, status: { not: 'CANCELLED' } },
      select: { number: true },
    });
    if (dup) {
      throw new DomainError(
        `فاتورة المورّد رقم «${input.vendorRef}» مُدخَلة سلفاً تحت ${dup.number}.`,
        'DUPLICATE_VENDOR_BILL',
      );
    }
  }

  const number = await nextNumber(tx, tenantId, 'VENDOR_BILL', input.issueDate);
  const defaultTax = await tx.taxCode.findFirst({ where: { tenantId, isDefault: true } });

  const prepared = [];
  for (const [i, line] of input.lines.entries()) {
    const taxCodeId = line.taxCodeId ?? defaultTax?.id ?? null;
    const taxCode = taxCodeId ? await tx.taxCode.findFirst({ where: { id: taxCodeId, tenantId } }) : null;
    if (taxCodeId && !taxCode) throw new DomainError(`السطر ${i + 1}: الرمز الضريبي غير موجود`, 'NOT_FOUND');

    let expenseAccountId = line.expenseAccountId ?? null;
    if (line.itemId) {
      const item = await tx.item.findFirst({ where: { id: line.itemId, tenantId } });
      if (!item) throw new DomainError(`السطر ${i + 1}: الصنف غير موجود`, 'NOT_FOUND');
      // الصنف المخزني يُحمَّل على المخزون لا على المصروف — قيمته أصلٌ حتى يُباع
      expenseAccountId ??= item.kind === 'STOCK' ? item.inventoryAccountId : item.expenseAccountId;
    }
    expenseAccountId ??= (await accountByRole(tx, tenantId, 'OPERATING')).id;

    const computed = computeLine(line.qty, line.unitPrice, line.discount ?? 0, taxCode?.rate ?? 0);
    prepared.push({ ...line, ...computed, taxCodeId, expenseAccountId });
  }

  const subtotal = money(sum(prepared.map((l) => l.lineNet.plus(d(l.discount ?? 0)))));
  const discountTotal = money(sum(prepared.map((l) => d(l.discount ?? 0))));
  const vatTotal = money(sum(prepared.map((l) => l.lineVat)));
  const net = money(sum(prepared.map((l) => l.lineNet)));
  const total = money(net.plus(vatTotal));

  const dueDate =
    input.dueDate ??
    (partner.paymentTermDays > 0
      ? new Date(input.issueDate.getTime() + partner.paymentTermDays * 86_400_000)
      : input.issueDate);

  return tx.vendorBill.create({
    data: {
      tenantId, number,
      vendorRef: input.vendorRef ?? null,
      partnerId: input.partnerId,
      orderId: input.orderId ?? null,
      issueDate: input.issueDate,
      dueDate,
      currency: input.currency ?? 'SAR',
      subtotal: subtotal.toFixed(6),
      discountTotal: discountTotal.toFixed(6),
      vatTotal: vatTotal.toFixed(6),
      total: total.toFixed(6),
      projectId: input.projectId ?? null,
      costCenterId: input.costCenterId ?? null,
      notesAr: input.notesAr ?? null,
      createdBy: input.createdBy ?? null,
      lines: {
        create: prepared.map((l, idx) => ({
          tenantId,
          itemId: l.itemId ?? null,
          descAr: l.descAr,
          qty: d(l.qty).toFixed(6),
          unitPrice: d(l.unitPrice).toFixed(6),
          discount: d(l.discount ?? 0).toFixed(6),
          taxCodeId: l.taxCodeId,
          taxRate: l.taxRate.toFixed(6),
          lineNet: l.lineNet.toFixed(6),
          lineVat: l.lineVat.toFixed(6),
          lineTotal: l.lineTotal.toFixed(6),
          expenseAccountId: l.expenseAccountId,
          sortOrder: idx,
        })),
      },
    },
    include: { lines: true },
  });
}

/**
 * يرحّل فاتورة المورّد:
 *   من ح/ المصروف أو المخزون   بالوعاء (سطراً سطراً)
 *   من ح/ ضريبة المدخلات       بالضريبة
 *     إلى ح/ الذمم الدائنة      بالإجمالي
 */
export async function postBill(tx: Tx, tenantId: string, billId: string, actor?: string) {
  const bill = await tx.vendorBill.findFirst({
    where: { id: billId, tenantId },
    include: { lines: true, partner: true },
  });
  if (!bill) throw new DomainError('فاتورة المورّد غير موجودة', 'NOT_FOUND');
  if (bill.status !== 'DRAFT') {
    throw new DomainError(`الفاتورة ${bill.number} حالتها «${bill.status}» — لا يُرحَّل إلا المسوّد.`, 'NOT_DRAFT');
  }

  const apAccount = bill.partner.apAccountId
    ? await tx.account.findFirstOrThrow({ where: { id: bill.partner.apAccountId, tenantId } })
    : await accountByRole(tx, tenantId, 'PAYABLE');

  const lines: Record<string, unknown>[] = [];

  for (const l of bill.lines) {
    if (money(l.lineNet).isZero()) continue;
    lines.push({
      accountId: l.expenseAccountId!,
      debit: money(l.lineNet),
      descAr: l.descAr,
      partnerId: bill.partnerId,
      projectId: bill.projectId,
      costCenterId: bill.costCenterId,
    });
  }

  if (!money(bill.vatTotal).isZero()) {
    const vatAccount = await accountByRole(tx, tenantId, 'VAT_INPUT');
    const mainTaxCode = bill.lines.find((l) => l.taxCodeId)?.taxCodeId ?? null;
    const netTotal = money(sum(bill.lines.map((l) => l.lineNet)));
    lines.push({
      accountId: vatAccount.id,
      debit: money(bill.vatTotal),
      descAr: `ضريبة مدخلات — ${bill.number}`,
      partnerId: bill.partnerId,
      taxCodeId: mainTaxCode,
      taxBase: netTotal,
    });
  }

  lines.push({
    accountId: apAccount.id,
    credit: money(bill.total),
    descAr: `فاتورة مورّد ${bill.number} — ${bill.partner.nameAr}`,
    partnerId: bill.partnerId,
    projectId: bill.projectId,
    costCenterId: bill.costCenterId,
  });

  const entry = await postEntry(tx, tenantId, {
    date: bill.issueDate,
    memoAr: `فاتورة مورّد ${bill.number}${bill.vendorRef ? ` (مرجع المورّد ${bill.vendorRef})` : ''}`,
    ref: bill.vendorRef ?? bill.number,
    sourceType: 'VENDOR_BILL',
    sourceId: bill.id,
    currency: bill.currency,
    createdBy: actor,
    lines: lines as never,
  });

  return tx.vendorBill.update({
    where: { id: bill.id },
    data: { status: 'POSTED', journalEntryId: entry.id, postedAt: new Date() },
    include: { lines: true },
  });
}

export async function cancelBill(
  tx: Tx,
  tenantId: string,
  billId: string,
  opts: { date?: Date; reason?: string; actor?: string } = {},
) {
  const bill = await tx.vendorBill.findFirst({ where: { id: billId, tenantId } });
  if (!bill) throw new DomainError('فاتورة المورّد غير موجودة', 'NOT_FOUND');
  if (bill.status === 'CANCELLED') throw new DomainError('ملغاة سلفاً.', 'ALREADY_CANCELLED');

  if (money(bill.paidAmount).greaterThan(0)) {
    throw new DomainError(
      `الفاتورة ${bill.number} سُدِّد منها ${money(bill.paidAmount).toFixed(2)}. ألغِ سندات الصرف أولاً.`,
      'BILL_HAS_PAYMENTS',
    );
  }

  if (bill.journalEntryId) {
    await reverseEntry(tx, tenantId, bill.journalEntryId, {
      date: opts.date ?? new Date(),
      memoAr: `إلغاء فاتورة المورّد ${bill.number}${opts.reason ? ` — ${opts.reason}` : ''}`,
      actor: opts.actor,
    });
  }

  return tx.vendorBill.update({ where: { id: bill.id }, data: { status: 'CANCELLED' } });
}
