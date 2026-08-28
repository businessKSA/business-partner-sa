/**
 * وسائل السداد — تعريف واحد يقرأ منه نموذج الدفع وخريطة الكتالوج معاً.
 *
 * كانت القائمة محسوبة داخل صفحة السداد وحدها، فلم يكن في اللوحة موضع واحد
 * يجيب: «هذه الخدمة، بأي وسيلة تُسدَّد؟». هنا صار الجواب واحداً في المكانين.
 *
 * مدى وفيزا وماستركارد كلها تمر عبر creditcard في نموذج ميسر — بطاقة مدى
 * تُعرَف من رقمها ولا تحتاج طريقة منفصلة. آبل باي وSTC Pay طريقتان مستقلتان،
 * وآبل باي لا تعمل قبل توثيق النطاق لدى ميسر فتبقى خلف مفتاح بيئة.
 * التحويل البنكي ليس طريقة لدى ميسر — هو المسار الوحيد الذي يبقى يدوياً.
 */
export type PaymentMethodKey =
  | 'creditcard'
  | 'stcpay'
  | 'applepay'
  | 'banktransfer'
  | 'tamara';

export type PaymentMethodInfo = {
  key: PaymentMethodKey;
  ar: string;
  en: string;
  /** يُقيَّد السداد في النظام تلقائياً عند التأكيد. */
  automatic: boolean;
  /** يمر عبر نموذج ميسر. */
  gateway: boolean;
};

export const PAYMENT_METHODS: Record<PaymentMethodKey, PaymentMethodInfo> = {
  creditcard: { key: 'creditcard', ar: 'مدى · فيزا · ماستركارد', en: 'mada · Visa · Mastercard', automatic: true, gateway: true },
  stcpay: { key: 'stcpay', ar: 'STC Pay', en: 'STC Pay', automatic: true, gateway: true },
  applepay: { key: 'applepay', ar: 'Apple Pay', en: 'Apple Pay', automatic: true, gateway: true },
  tamara: { key: 'tamara', ar: 'تمارا — تقسيط', en: 'Tamara — instalments', automatic: true, gateway: false },
  banktransfer: { key: 'banktransfer', ar: 'تحويل بنكي', en: 'Bank transfer', automatic: false, gateway: false },
};

const ON = (v: string | undefined, dflt: boolean) =>
  v === undefined || v === '' ? dflt : v !== '0' && v.toLowerCase() !== 'false';

/** الوسائل المفعّلة على مستوى النظام، بحسب متغيرات البيئة. */
export function enabledPaymentMethods(): PaymentMethodKey[] {
  const out: PaymentMethodKey[] = ['creditcard'];
  if (ON(process.env.MOYASAR_STC_PAY, true)) out.push('stcpay');
  if (ON(process.env.MOYASAR_APPLE_PAY, false)) out.push('applepay');
  if (ON(process.env.PAY_TAMARA, false)) out.push('tamara');
  out.push('banktransfer');
  return out;
}

/** الوسائل التي تمر عبر نموذج ميسر فقط — هذه ما يُمرَّر للنموذج. */
export function gatewayMethods(allowed = enabledPaymentMethods()): string[] {
  return allowed.filter((m) => PAYMENT_METHODS[m].gateway);
}

/**
 * وسائل خدمة بعينها: حقل الخدمة يضيّق القائمة العامة ولا يوسّعها،
 * فلا يظهر للعميل خيار غير مفعّل في النظام أصلاً.
 */
export function methodsForService(serviceMethods: string | null | undefined): PaymentMethodKey[] {
  const enabled = enabledPaymentMethods();
  const raw = String(serviceMethods || '').trim();
  if (!raw) return enabled;
  const wanted = new Set(
    raw.split(/[,\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean),
  );
  const narrowed = enabled.filter((m) => wanted.has(m));
  return narrowed.length ? narrowed : enabled;
}
