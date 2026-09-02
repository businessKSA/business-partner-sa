/**
 * إقرار ضريبة القيمة المضافة.
 *
 * يُبنى من سطور الدفتر الحاملة وسماً ضريبياً (`taxCodeId`) ووعاءً (`taxBase`)،
 * لا من جدول الفواتير. الفرق ليس شكلياً: التسويات اليدوية وقيود الاحتساب
 * العكسي وإشعارات الدائن لا تمرّ كلها بجدول الفواتير، ومن يبني الإقرار من
 * الفواتير وحدها يقدّم رقماً ناقصاً ويكتشفه في الفحص لا قبله.
 *
 * تنبيه: هذا التقرير يُجهِّز الأرقام. تقديم الإقرار لدى الهيئة يبقى فعلاً
 * بشرياً مسؤولاً — النظام لا يقدّم نيابةً عن المكلَّف.
 */
import type { Tx } from '../db.ts';
import { d, money, Decimal } from '../money.ts';

export type VatBox = {
  key: string;
  labelAr: string;
  labelEn: string;
  /** الوعاء الخاضع (المبلغ قبل الضريبة) */
  amount: Decimal;
  /** الضريبة المستحقة على هذا الوعاء */
  vat: Decimal;
};

type Agg = { base: Decimal; vat: Decimal };

function emptyAgg(): Agg {
  return { base: new Decimal(0), vat: new Decimal(0) };
}

/**
 * @param from بداية فترة الإقرار (شهرية أو ربع سنوية حسب حجم المنشأة)
 */
export async function vatReturn(tx: Tx, tenantId: string, from: Date, to: Date) {
  // الأدوار تُحدَّد بالحساب لا بالرمز: حساب المخرجات = ضريبة على مبيعاتنا،
  // وحساب المدخلات = ضريبة دفعناها على مشترياتنا وتُخصم.
  const outAccs = await tx.account.findMany({ where: { tenantId, subtype: 'VAT_OUTPUT' }, select: { id: true } });
  const inAccs = await tx.account.findMany({ where: { tenantId, subtype: 'VAT_INPUT' }, select: { id: true } });
  const outIds = new Set(outAccs.map((a) => a.id));
  const inIds = new Set(inAccs.map((a) => a.id));

  const lines = await tx.journalLine.findMany({
    where: {
      tenantId,
      taxCodeId: { not: null },
      entry: { status: { in: ['POSTED', 'REVERSED'] }, date: { gte: from, lte: to } },
    },
    select: {
      debit: true, credit: true, taxBase: true, accountId: true,
      taxCode: { select: { code: true, kind: true, rate: true, zatcaCategory: true } },
    },
  });

  const sales: Record<string, Agg> = {
    STANDARD: emptyAgg(), ZERO: emptyAgg(), EXPORT: emptyAgg(), EXEMPT: emptyAgg(),
  };
  const purchases: Record<string, Agg> = {
    STANDARD: emptyAgg(), REVERSE_CHARGE: emptyAgg(), ZERO: emptyAgg(), EXEMPT: emptyAgg(),
  };

  for (const l of lines) {
    const kind = l.taxCode?.kind ?? 'STANDARD';
    const base = d(l.taxBase);
    // ضريبة المخرجات دائنة، وضريبة المدخلات مدينة — والعكس في الإشعارات
    // الدائنة، فنأخذ الصافي بالإشارة الصحيحة لكل جانب.
    const outVat = d(l.credit).minus(d(l.debit));
    const inVat = d(l.debit).minus(d(l.credit));

    if (outIds.has(l.accountId)) {
      const bucket = kind === 'STANDARD' ? 'STANDARD' : kind === 'ZERO' ? 'ZERO' : kind === 'EXEMPT' ? 'EXEMPT' : 'ZERO';
      sales[bucket].base = sales[bucket].base.plus(base);
      sales[bucket].vat = sales[bucket].vat.plus(outVat);
    } else if (inIds.has(l.accountId)) {
      const bucket =
        kind === 'REVERSE_CHARGE' ? 'REVERSE_CHARGE' :
        kind === 'STANDARD' ? 'STANDARD' :
        kind === 'EXEMPT' ? 'EXEMPT' : 'ZERO';
      purchases[bucket].base = purchases[bucket].base.plus(base);
      purchases[bucket].vat = purchases[bucket].vat.plus(inVat);
    }
    // سطور موسومة على حسابات أخرى (الإيراد نفسه مثلاً) لا تُحتسب مرّتين —
    // الوعاء يُقرأ من سطر الضريبة وحده.
  }

  const salesBoxes: VatBox[] = [
    { key: 'standardSales', labelAr: 'المبيعات الخاضعة للنسبة الأساسية', labelEn: 'Standard rated sales', amount: money(sales.STANDARD.base), vat: money(sales.STANDARD.vat) },
    { key: 'zeroSales', labelAr: 'المبيعات الخاضعة لنسبة الصفر', labelEn: 'Zero rated sales', amount: money(sales.ZERO.base), vat: new Decimal(0) },
    { key: 'exemptSales', labelAr: 'المبيعات المعفاة', labelEn: 'Exempt sales', amount: money(sales.EXEMPT.base), vat: new Decimal(0) },
  ];

  const purchaseBoxes: VatBox[] = [
    { key: 'standardPurchases', labelAr: 'المشتريات الخاضعة للنسبة الأساسية', labelEn: 'Standard rated purchases', amount: money(purchases.STANDARD.base), vat: money(purchases.STANDARD.vat) },
    { key: 'reverseCharge', labelAr: 'المشتريات الخاضعة للاحتساب العكسي', labelEn: 'Reverse charge purchases', amount: money(purchases.REVERSE_CHARGE.base), vat: money(purchases.REVERSE_CHARGE.vat) },
    { key: 'zeroPurchases', labelAr: 'المشتريات الخاضعة لنسبة الصفر', labelEn: 'Zero rated purchases', amount: money(purchases.ZERO.base), vat: new Decimal(0) },
    { key: 'exemptPurchases', labelAr: 'المشتريات المعفاة', labelEn: 'Exempt purchases', amount: money(purchases.EXEMPT.base), vat: new Decimal(0) },
  ];

  const outputVat = money(salesBoxes.reduce((s, b) => s.plus(b.vat), new Decimal(0)));
  const inputVat = money(purchaseBoxes.reduce((s, b) => s.plus(b.vat), new Decimal(0)));
  const netVat = money(outputVat.minus(inputVat));

  return {
    from, to,
    salesBoxes, purchaseBoxes,
    totalSales: money(salesBoxes.reduce((s, b) => s.plus(b.amount), new Decimal(0))),
    totalPurchases: money(purchaseBoxes.reduce((s, b) => s.plus(b.amount), new Decimal(0))),
    outputVat,
    inputVat,
    /** موجب = مستحقّ للهيئة، سالب = رصيد دائن يُرحَّل أو يُسترد */
    netVat,
    payable: netVat.greaterThan(0) ? netVat : new Decimal(0),
    refundable: netVat.lessThan(0) ? netVat.negated() : new Decimal(0),
  };
}
