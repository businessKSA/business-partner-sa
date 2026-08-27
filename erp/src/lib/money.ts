/**
 * الحساب المالي.
 *
 * Float محرّم هنا. جمع ٠٫١ و٠٫٢ في الفاصلة العائمة لا يساوي ٠٫٣، وميزانٌ
 * يختل بهللة ميزانٌ مرفوض. كل مبلغ يمرّ على Decimal، والتقريب يقع مرة
 * واحدة عند حدود واضحة: سطر الفاتورة، وإجمالي الضريبة.
 */
import { Decimal } from 'decimal.js';

// ٢٨ رقماً معنوياً تكفي أي مبلغ تجاري، والتقريب نصف-لأعلى هو المعتمد
// محاسبياً في السعودية ولدى هيئة الزكاة والضريبة.
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

export type Money = Decimal;
export type Num = Decimal | number | string | null | undefined;

/** يحوّل أي مدخل إلى Decimal. `null` و`undefined` تصير صفراً لا NaN. */
export function d(v: Num): Decimal {
  if (v === null || v === undefined || v === '') return new Decimal(0);
  if (v instanceof Decimal) return v;
  return new Decimal(v as never);
}

/** تقريب نقدي إلى منزلتين — هللتان للريال. */
export function money(v: Num): Decimal {
  return d(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** تقريب الكميات إلى ست منازل — يكفي الوحدات الصغيرة والنسب. */
export function qty(v: Num): Decimal {
  return d(v).toDecimalPlaces(6, Decimal.ROUND_HALF_UP);
}

export function sum(values: Num[]): Decimal {
  return values.reduce<Decimal>((a, b) => a.plus(d(b)), new Decimal(0));
}

export function isZero(v: Num): boolean {
  return d(v).isZero();
}

/** المقارنة النقدية تتم بعد التقريب — لا تُقارن الكسور الخام. */
export function eq(a: Num, b: Num): boolean {
  return money(a).equals(money(b));
}

/** صياغة عربية للعرض: ١٬٢٣٤٫٥٠ ر.س */
export function fmt(v: Num, currency = 'SAR', locale = 'ar-SA'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(money(v).toNumber());
}

/** رقم بلا رمز عملة — للجداول التي تعرض العملة في الترويسة. */
export function fmtNum(v: Num, dp = 2, locale = 'ar-SA'): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(d(v).toDecimalPlaces(dp).toNumber());
}

/**
 * يوزّع مبلغاً على حصص بحيث يساوي مجموعُ الأنصبة المبلغَ تماماً.
 *
 * التقريب المستقل لكل حصة يضيّع هللة أو يزيدها؛ هنا تُحمَّل الفروق على
 * الحصة الأكبر، فلا يبقى فرقٌ معلّق في قيدٍ لا يتزن.
 */
export function allocate(total: Num, weights: Num[]): Decimal[] {
  const t = money(total);
  const w = weights.map(d);
  const wSum = sum(w);
  if (wSum.isZero()) return w.map(() => new Decimal(0));

  const shares = w.map((x) => money(t.times(x).dividedBy(wSum)));
  const diff = t.minus(sum(shares));
  if (!diff.isZero()) {
    let maxIdx = 0;
    for (let i = 1; i < w.length; i++) if (w[i].greaterThan(w[maxIdx])) maxIdx = i;
    shares[maxIdx] = shares[maxIdx].plus(diff);
  }
  return shares;
}
