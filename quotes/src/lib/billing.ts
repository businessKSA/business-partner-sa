/**
 * الفواتير والمحفظة.
 * المحفظة دفتر حركات (append-only) والرصيد مشتق دائماً ولا يُخزَّن.
 * كل حركة مالية تُسجَّل في سجل التدقيق المسلسل بالتجزئة.
 */
import { prisma } from './db';
import { appBase } from './base';
import { VAT_RATE } from '../../config/company';
import { round2, fmtMoney } from './money';
import { nextInvoiceNumber } from './numbering';
import { publicToken } from './tokens';
import { logEvent, audit } from './timeline';
import { DOC_STATUS } from './enums';
import { notifyEvent, sendPaymentReceipt } from './send';
import { issueTaxInvoice, daftraLive } from './daftra';

export interface InvoiceInput {
  clientId: string;
  documentId?: string | null;
  titleAr: string;
  titleEn: string;
  amountExclVat: number;
  sequence?: number;
  dueDate?: Date | null;
  isGovFeeDeposit?: boolean;
  /** GOV_FEE = عهدة رسوم حكومية · SUPPLY = قيمة توريد · null = أتعاب */
  depositKind?: 'GOV_FEE' | 'SUPPLY' | null;
}

export async function createInvoice(input: InvoiceInput, actor = 'admin') {
  const amount = round2(input.amountExclVat);
  // عهدة الرسوم الحكومية ليست إيراداً ولا تخضع لضريبة القيمة المضافة
  const vatAmount = input.isGovFeeDeposit ? 0 : round2(amount * VAT_RATE);
  const invoice = await prisma.invoice.create({
    data: {
      number: await nextInvoiceNumber(),
      clientId: input.clientId,
      documentId: input.documentId ?? null,
      titleAr: input.titleAr,
      titleEn: input.titleEn,
      amountExclVat: amount,
      vatRate: input.isGovFeeDeposit ? 0 : VAT_RATE,
      vatAmount,
      total: round2(amount + vatAmount),
      sequence: input.sequence ?? 1,
      dueDate: input.dueDate ?? null,
      isGovFeeDeposit: input.isGovFeeDeposit ?? false,
      depositKind: input.depositKind ?? (input.isGovFeeDeposit ? 'GOV_FEE' : null),
      payToken: publicToken(),
    },
  });

  await logEvent({
    entityType: 'invoice',
    entityId: invoice.id,
    clientId: input.clientId,
    code: 'INVOICE_CREATED',
    titleAr: `أُصدرت الفاتورة ${invoice.number} بمبلغ ${fmtMoney(invoice.total)} ريال شامل الضريبة`,
    titleEn: `Invoice ${invoice.number} issued for SAR ${fmtMoney(invoice.total)} including VAT`,
    actor,
    actorKind: 'admin',
  });
  await audit({
    action: 'INVOICE_CREATED',
    entityType: 'invoice',
    entityId: invoice.id,
    actor,
    amount: invoice.total,
  });

  return invoice;
}

/**
 * توليد جدول الدفعات من بنود العقد.
 * تُقرأ شروط الدفع النصية لاستخراج الدفعات الصريحة (مثل 15,000 + 15,000)،
 * وما لم تُستخرَج دفعات تُنشأ فاتورة واحدة بكامل قيمة البند.
 */
export function parseInstalments(paymentTermsAr: string, lineTotal: number): number[] {
  const nums = Array.from(paymentTermsAr.matchAll(/([\d][\d,]*(?:\.\d+)?)\s*ريال/g)).map((m) =>
    Number(m[1].replace(/,/g, '')),
  );
  const sum = round2(nums.reduce((a, b) => a + b, 0));
  if (nums.length >= 2 && Math.abs(sum - lineTotal) < 0.5) return nums.map(round2);
  return [round2(lineTotal)];
}

export async function createInvoicesForContract(documentId: string, actor = 'admin') {
  const doc = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });
  const existing = await prisma.invoice.count({ where: { documentId } });
  if (existing) return prisma.invoice.findMany({ where: { documentId }, orderBy: { sequence: 'asc' } });

  const parts: { titleAr: string; titleEn: string; amount: number }[] = [];
  for (const item of doc.items) {
    const inst = parseInstalments(item.paymentTermsAr, item.lineTotal);
    inst.forEach((amount, i) => {
      parts.push({
        titleAr: inst.length > 1 ? `${item.nameAr} — الدفعة ${i + 1} من ${inst.length}` : item.nameAr,
        titleEn: inst.length > 1 ? `${item.nameEn} — instalment ${i + 1} of ${inst.length}` : item.nameEn,
        amount,
      });
    });
  }

  const created = [];
  for (let i = 0; i < parts.length; i++) {
    created.push(
      await createInvoice(
        {
          clientId: doc.clientId,
          documentId,
          titleAr: parts[i].titleAr,
          titleEn: parts[i].titleEn,
          amountExclVat: parts[i].amount,
          sequence: i + 1,
        },
        actor,
      ),
    );
  }
  return created;
}

/** تسجيل نجاح الدفع: يحدّث الفاتورة، يقيّد الحركة في المحفظة، ويحدّث حالة المستند. */
export async function markInvoicePaid(
  invoiceId: string,
  info: { provider: string; ref: string; method?: string },
) {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { client: true, document: true },
  });
  if (invoice.status === 'PAID') return invoice;

  // نداء الرجوع من المتصفح وwebhook المزوّد قد يصلان معاً على نفس الدفعة.
  // الانتقال إلى «مدفوعة» مشروط بالحالة نفسها، فمن يفوز به وحده يقيّد الحركة
  // في المحفظة — وإلا قُيّد المبلغ مرتين وارتفع رصيد العميل بلا سداد.
  const claimed = await prisma.invoice.updateMany({
    where: { id: invoiceId, status: { not: 'PAID' } },
    data: {
      status: 'PAID',
      paidAt: new Date(),
      provider: info.provider,
      providerRef: info.ref,
      method: info.method ?? null,
    },
  });
  if (claimed.count === 0) return prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  const paid = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });

  await prisma.walletEntry.create({
    data: {
      clientId: invoice.clientId,
      direction: 'IN',
      kind:
        invoice.depositKind === 'SUPPLY'
          ? 'SUPPLY_DEPOSIT'
          : invoice.depositKind === 'GOV_FEE' || invoice.isGovFeeDeposit
            ? 'GOV_FEE_DEPOSIT'
            : 'PAYMENT',
      amount: invoice.total,
      descAr: `سداد الفاتورة ${invoice.number} — ${invoice.titleAr}`,
      descEn: `Payment of invoice ${invoice.number} — ${invoice.titleEn}`,
      invoiceId: invoice.id,
      actor: 'client',
    },
  });

  await audit({
    action: 'INVOICE_PAID',
    entityType: 'invoice',
    entityId: invoice.id,
    actor: 'payment',
    amount: invoice.total,
    payload: { provider: info.provider, ref: info.ref, method: info.method },
  });
  await logEvent({
    entityType: 'invoice',
    entityId: invoice.id,
    clientId: invoice.clientId,
    code: 'PAID',
    titleAr: `دُفعت الفاتورة ${invoice.number} بمبلغ ${fmtMoney(invoice.total)} ريال عبر ${info.method || info.provider}`,
    titleEn: `Invoice ${invoice.number} paid, SAR ${fmtMoney(invoice.total)} via ${info.method || info.provider}`,
    actor: 'client',
    actorKind: 'payment',
  });

  // العقد الموقّع + الدفعة الأولى = قيد التنفيذ
  if (invoice.document) {
    const doc = invoice.document;
    if (doc.status === DOC_STATUS.SIGNED && invoice.sequence === 1) {
      await prisma.document.update({ where: { id: doc.id }, data: { status: DOC_STATUS.IN_PROGRESS } });
      await logEvent({
        entityType: 'document',
        entityId: doc.id,
        clientId: doc.clientId,
        code: 'IN_PROGRESS',
        titleAr: `العقد ${doc.number} موقّع والدفعة الأولى مدفوعة — الحالة الآن قيد التنفيذ`,
        titleEn: `Agreement ${doc.number} signed and first instalment paid — status is now In progress`,
        actor: 'system',
        actorKind: 'system',
      });
    }
    await notifyEvent(
      'Payment received',
      doc.number,
      invoice.client.companyAr || invoice.client.nameAr,
      `invoice ${invoice.number} — SAR ${fmtMoney(invoice.total)} via ${info.method || info.provider}`,
      `${appBase()}/admin/documents/${doc.id}`,
    );
  } else {
    await notifyEvent(
      'Payment received',
      invoice.number,
      invoice.client.companyAr || invoice.client.nameAr,
      `SAR ${fmtMoney(invoice.total)} via ${info.method || info.provider}`,
      `${appBase()}/admin/clients/${invoice.clientId}`,
    );
  }

  // الفاتورة الضريبية المعتمدة تصدر من الدفترة عبر جسر الموقع. تُستدعى بعد
  // تثبيت السداد لا قبله، ولا تُفشِل السداد إن تعذّرت — المال حُصِّل والحركة
  // قُيِّدت، وإبطال ذلك لأن نظام محاسبة لم يستجب يجعل الحال أسوأ.
  await issueTaxInvoiceFor(paid.id).catch(() => {});

  // إيصال العميل بعد محاولة الإصدار لا قبلها، حتى يحمل رقم الفاتورة الضريبية
  // ورابط نسختها إن صدرت. وإن لم تصدر بعد فالإيصال يقول ذلك ولا يَعِد بما لم يتم.
  await sendPaymentReceipt(paid.id).catch(() => {});

  return paid;
}

/**
 * إصدار الفاتورة الضريبية لفاتورة مدفوعة في هذه اللوحة.
 *
 * تُتخطّى عهدة الرسوم الحكومية وقيمة التوريد: كلاهما إيداع في محفظة العميل
 * لا إيراد، ولا ضريبة عليه — فاتورة ضريبية له تُبلّغ عن إيراد لم يتحقّق.
 *
 * صالحة للاستدعاء مرتين على الفاتورة نفسها: الصادرة فعلاً تُترك كما هي.
 */
export async function issueTaxInvoiceFor(invoiceId: string): Promise<void> {
  if (!daftraLive()) return;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { client: true },
  });
  if (!invoice || invoice.status !== 'PAID') return;
  if (invoice.daftraNumber) return;
  if (invoice.isGovFeeDeposit || invoice.depositKind) return;

  const c = invoice.client;
  const result = await issueTaxInvoice({
    buyer: {
      name: c.companyAr || c.nameAr,
      email: c.email,
      phone: c.phone,
      city: c.city || '',
      taxNumber: c.vatNumber || '',
      isCompany: Boolean(c.companyAr || c.crNumber || c.vatNumber),
      contact: c.companyAr ? c.nameAr : '',
      address: c.addressAr ? { address: c.addressAr, city: c.city || '' } : null,
    },
    items: [{ name: invoice.titleAr, quantity: 1, unitPrice: invoice.amountExclVat }],
    paidHalalas: Math.round(invoice.total * 100),
    payId: invoice.providerRef || '',
    method: invoice.method || invoice.provider || 'Moyasar',
    ref: invoice.number,
    sourceNumber: invoice.number,
  });

  if (!result.ok) {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { daftraError: `${result.error}${result.detail ? ` — ${result.detail}` : ''}`.slice(0, 400) },
    });
    await audit({
      action: 'TAX_INVOICE_FAILED',
      entityType: 'invoice',
      entityId: invoice.id,
      actor: 'system',
      payload: { error: result.error, detail: result.detail, expected: result.expected, paid: result.paid },
    });
    return;
  }

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      daftraId: String(result.id),
      daftraNumber: String(result.number),
      daftraPdfUrl: result.publicUrl || null,
      daftraIssuedAt: new Date(),
      daftraError: null,
    },
  });
  await audit({
    action: 'TAX_INVOICE_ISSUED',
    entityType: 'invoice',
    entityId: invoice.id,
    actor: 'system',
    amount: result.total,
    payload: { daftraNumber: result.number, paymentRecorded: result.paymentRecorded, paymentError: result.paymentError },
  });
  await logEvent({
    entityType: 'invoice',
    entityId: invoice.id,
    clientId: invoice.clientId,
    code: 'TAX_INVOICE',
    titleAr: `صدرت الفاتورة الضريبية ${result.number} من الدفترة`,
    titleEn: `Tax invoice ${result.number} issued from Daftra`,
    actor: 'system',
    actorKind: 'system',
  });
}

// ---------------------------------------------------------------- المحفظة
export interface WalletSummary {
  /** قيمة العقود الموقّعة */
  totalContracted: number;
  /** أتعاب مدفوعة (لا تشمل الإيداعات) */
  paid: number;
  /** أتعاب مستحقة (لا تشمل الإيداعات) */
  due: number;
  govFeeDeposited: number;
  govFeeSpent: number;
  govFeeBalance: number;
  supplyDeposited: number;
  supplierPaid: number;
  supplyBalance: number;
  /**
   * العهدة المتاحة للصرف = الإيداعات ناقص المصروفات.
   * أتعاب بزنس بارتنر المحصّلة إيراد وليست عهدة، فلا تدخل هنا ولا يجوز الصرف منها.
   */
  custodyBalance: number;
}

export async function walletSummary(clientId: string): Promise<WalletSummary> {
  const [docs, invoices, entries] = await Promise.all([
    prisma.document.findMany({
      where: { clientId, status: { in: [DOC_STATUS.SIGNED, DOC_STATUS.IN_PROGRESS] } },
      select: { total: true },
    }),
    prisma.invoice.findMany({
      where: { clientId },
      select: { status: true, total: true, isGovFeeDeposit: true },
    }),
    prisma.walletEntry.findMany({ where: { clientId }, select: { direction: true, kind: true, amount: true } }),
  ]);

  const sum = (arr: { amount: number }[]) => round2(arr.reduce((a, b) => a + b.amount, 0));
  const govIn = sum(entries.filter((e) => e.kind === 'GOV_FEE_DEPOSIT'));
  const govOut = sum(entries.filter((e) => e.kind === 'GOV_FEE_SPEND'));
  const supplyIn = sum(entries.filter((e) => e.kind === 'SUPPLY_DEPOSIT'));
  const supplierOut = sum(entries.filter((e) => e.kind === 'SUPPLIER_PAYOUT'));
  const refunds = sum(entries.filter((e) => e.kind === 'REFUND'));
  const adjustments = sum(entries.filter((e) => e.kind === 'ADJUSTMENT' && e.direction === 'IN'));

  return {
    totalContracted: round2(docs.reduce((a, d) => a + d.total, 0)),
    paid: round2(
      invoices.filter((i) => i.status === 'PAID' && !i.isGovFeeDeposit).reduce((a, i) => a + i.total, 0),
    ),
    due: round2(
      invoices.filter((i) => i.status === 'DUE' && !i.isGovFeeDeposit).reduce((a, i) => a + i.total, 0),
    ),
    govFeeDeposited: govIn,
    govFeeSpent: govOut,
    govFeeBalance: round2(govIn - govOut),
    supplyDeposited: supplyIn,
    supplierPaid: supplierOut,
    supplyBalance: round2(supplyIn - supplierOut),
    custodyBalance: round2(govIn + supplyIn + adjustments - govOut - supplierOut - refunds),
  };
}

export async function walletEntries(clientId: string) {
  return prisma.walletEntry.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' } });
}

/** حركة صرف من المحفظة — تتطلب اعتمادي دائماً. */
export async function walletSpend(input: {
  clientId: string;
  kind: 'GOV_FEE_SPEND' | 'SUPPLIER_PAYOUT' | 'REFUND' | 'ADJUSTMENT';
  amount: number;
  descAr: string;
  descEn: string;
  milestoneId?: string | null;
  receiptPath?: string | null;
  actor: string;
}) {
  const summary = await walletSummary(input.clientId);
  const amount = round2(input.amount);
  if (amount <= 0) throw new Error('المبلغ يجب أن يكون أكبر من صفر');
  // الصرف من العهدة فقط — أتعاب بزنس بارتنر المحصّلة إيراد ولا يُصرف منها
  if (amount > summary.custodyBalance) {
    throw new Error(
      `رصيد العهدة غير كافٍ: المتاح ${fmtMoney(summary.custodyBalance)} ريال والمطلوب ${fmtMoney(amount)} ريال`,
    );
  }

  const entry = await prisma.walletEntry.create({
    data: {
      clientId: input.clientId,
      direction: 'OUT',
      kind: input.kind,
      amount,
      descAr: input.descAr,
      descEn: input.descEn,
      milestoneId: input.milestoneId ?? null,
      receiptPath: input.receiptPath ?? null,
      actor: input.actor,
    },
  });

  await audit({
    action: `WALLET_${input.kind}`,
    entityType: 'wallet',
    entityId: entry.id,
    actor: input.actor,
    amount,
    payload: { clientId: input.clientId, milestoneId: input.milestoneId },
  });
  await logEvent({
    entityType: 'wallet',
    entityId: entry.id,
    clientId: input.clientId,
    code: input.kind,
    titleAr: `${input.descAr} — ${fmtMoney(amount)} ريال`,
    titleEn: `${input.descEn} — SAR ${fmtMoney(amount)}`,
    actor: input.actor,
    actorKind: 'admin',
  });

  return entry;
}
