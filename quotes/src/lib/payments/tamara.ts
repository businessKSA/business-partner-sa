/**
 * تمارا — التقسيط.
 *
 * تدفّقها ليس تدفّق بوابة بطاقة، فلا تدخل في واجهة `PaymentProvider`:
 *
 *   جلسة سداد  ──▶  العميل يكمل عند تمارا  ──▶  إشعار order_approved
 *        └──▶  تفويض (authorise)  ──▶  تحصيل (capture)  ──▶  markInvoicePaid
 *
 * التفويض إقرار باستلام الإشعار، والتحصيل إقرار بتسليم الخدمة. نحن نسلّم
 * خدمة لا شحنة، فالتحصيل يلي التفويض مباشرةً. وتمارا تُحصّل تلقائياً بعد
 * واحد وعشرين يوماً على أي حال، فتأخيره لا يفيد شيئاً ويؤخّر التوريد.
 *
 * الأرقام من الاتفاقية الموقّعة في 26/08/2026: خصم التاجر 6.99% ورسم ثابت
 * 1.50 ريال لكل عملية، تصنيف Public Service & Government.
 */
import { COMPANY } from '../../../config/company';
import { round2 } from '../money';

/** نسبة خصم التاجر كما في الاتفاقية الموقّعة. */
export const TAMARA_MDR = 0.0699;
/** الرسم الثابت لكل عملية بالريال. */
export const TAMARA_FIXED_FEE = 1.5;

export type TamaraMode = 'off' | 'sandbox' | 'live';

export function tamaraMode(): TamaraMode {
  const m = (process.env.TAMARA_MODE || 'off').toLowerCase();
  return m === 'live' || m === 'sandbox' ? m : 'off';
}

function baseUrl(): string {
  return tamaraMode() === 'live' ? 'https://api.tamara.co' : 'https://api-sandbox.tamara.co';
}

export function tamaraConfigured(): boolean {
  return Boolean(process.env.TAMARA_API_TOKEN);
}

/** مفعّلة فعلاً: الوضع ليس off والمفتاح معرّف. */
export function tamaraEnabled(): boolean {
  return tamaraMode() !== 'off' && tamaraConfigured();
}

/**
 * الحد الأعلى لمبلغ يُسدَّد عبر تمارا.
 *
 * لتمارا حدودها على المستهلك، ولنا سبب مستقل: الخصم نسبة، فكلما كبر المبلغ
 * كبرت التكلفة بلا مقابل. عشرة آلاف افتراضاً، ويُرفع من متغير بيئة عند الحاجة.
 */
export function tamaraMaxAmount(): number {
  const v = Number(process.env.TAMARA_MAX_AMOUNT || 10000);
  return Number.isFinite(v) && v > 0 ? v : 10000;
}

export function tamaraMinAmount(): number {
  const v = Number(process.env.TAMARA_MIN_AMOUNT || 100);
  return Number.isFinite(v) && v > 0 ? v : 100;
}

/** تكلفة قبول المبلغ عبر تمارا — تُعرض في اللوحة ولا تُحمَّل على العميل. */
export function tamaraFee(total: number): number {
  return round2(total * TAMARA_MDR + TAMARA_FIXED_FEE);
}

export interface EligibilityInput {
  total: number;
  isGovFeeDeposit: boolean;
  depositKind: string | null;
  status: string;
}

export interface Eligibility {
  ok: boolean;
  reasonAr?: string;
}

/**
 * هل تُعرض تمارا لهذه الفاتورة؟
 *
 * العهدة مستثناة قطعاً: مبلغها يمرّ بنا إلى الجهة أو المورّد ولا إيراد لنا
 * فيه، فدفع 6.99% عليه خسارة صافية بلا مقابل تُغطّى منه. وهو الاستثناء
 * نفسه المطبَّق على الفاتورة الضريبية، وللسبب نفسه.
 */
export function tamaraEligible(inv: EligibilityInput): Eligibility {
  if (!tamaraEnabled()) return { ok: false, reasonAr: 'تمارا غير مفعّلة' };
  if (inv.status === 'PAID') return { ok: false, reasonAr: 'الفاتورة مسددة' };
  if (inv.isGovFeeDeposit || inv.depositKind) {
    return { ok: false, reasonAr: 'العهدة تُسدَّد نقداً أو بالتحويل — لا تقسيط على مبلغ يمرّ للجهات' };
  }
  if (inv.total < tamaraMinAmount()) {
    return { ok: false, reasonAr: `أقل مبلغ للتقسيط ${tamaraMinAmount()} ريال` };
  }
  if (inv.total > tamaraMaxAmount()) {
    return { ok: false, reasonAr: `أعلى مبلغ للتقسيط ${tamaraMaxAmount()} ريال` };
  }
  return { ok: true };
}

async function call<T>(
  path: string,
  init: { method: string; body?: unknown },
): Promise<{ ok: true; data: T } | { ok: false; error: string; status?: number }> {
  const token = process.env.TAMARA_API_TOKEN;
  if (!token) return { ok: false, error: 'TAMARA_API_TOKEN غير معرّف' };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(`${baseUrl()}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    if (!res.ok) {
      const detail =
        parsed && typeof parsed === 'object' && 'message' in parsed
          ? String((parsed as { message: unknown }).message)
          : text.slice(0, 300);
      return { ok: false, error: detail || `HTTP ${res.status}`, status: res.status };
    }
    return { ok: true, data: parsed as T };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg === 'The operation was aborted.' ? 'انتهت مهلة تمارا' : msg };
  } finally {
    clearTimeout(timer);
  }
}

/** يقسم الاسم الكامل إلى أول وأخير — تمارا تشترط الحقلين. */
function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: 'Client', last: '.' };
  if (parts.length === 1) return { first: parts[0], last: '.' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

export interface CheckoutInput {
  invoiceNumber: string;
  invoiceId: string;
  titleAr: string;
  titleEn: string;
  amountExclVat: number;
  vatAmount: number;
  total: number;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  /** أين يعود العميل بعد الإكمال أو الإلغاء. */
  successUrl: string;
  failureUrl: string;
  cancelUrl: string;
  notificationUrl: string;
}

export interface CheckoutCreated {
  orderId: string;
  checkoutUrl: string;
  status: string;
}

/**
 * ينشئ جلسة سداد ويعيد رابط تمارا.
 *
 * المبلغ المرسل هو الإجمالي شامل الضريبة، والضريبة تُذكر منفصلة في
 * `tax_amount` كما تذكرها الفاتورة — لا يُجمَع الرقمان مرتين.
 */
export async function createTamaraCheckout(
  input: CheckoutInput,
): Promise<{ ok: true; data: CheckoutCreated } | { ok: false; error: string }> {
  const { first, last } = splitName(input.clientName);

  const body = {
    order_reference_id: input.invoiceNumber,
    order_number: input.invoiceNumber,
    total_amount: { amount: input.total, currency: 'SAR' },
    tax_amount: { amount: input.vatAmount, currency: 'SAR' },
    shipping_amount: { amount: 0, currency: 'SAR' },
    discount: null,
    items: [
      {
        name: input.titleAr,
        type: 'Digital',
        reference_id: input.invoiceId,
        sku: input.invoiceNumber,
        quantity: 1,
        unit_price: { amount: input.amountExclVat, currency: 'SAR' },
        discount_amount: { amount: 0, currency: 'SAR' },
        tax_amount: { amount: input.vatAmount, currency: 'SAR' },
        total_amount: { amount: input.total, currency: 'SAR' },
      },
    ],
    consumer: {
      first_name: first,
      last_name: last,
      email: input.clientEmail,
      phone_number: input.clientPhone,
    },
    // تمارا تطلب العنوانين حتى في الخدمات الرقمية. تكامل الموقع في
    // api/_bnpl.js يرسلهما، فيُرسلان هنا بالشكل نفسه — تكاملان لمنشأة
    // واحدة يجب أن يقولا الشيء نفسه لتمارا، وإلا اختلف قبولها بينهما.
    billing_address: {
      first_name: first,
      last_name: last,
      line1: 'الرياض',
      city: 'Riyadh',
      country_code: 'SA',
      phone_number: input.clientPhone,
    },
    shipping_address: {
      first_name: first,
      last_name: last,
      line1: 'الرياض',
      city: 'Riyadh',
      country_code: 'SA',
      phone_number: input.clientPhone,
    },
    country_code: 'SA',
    description: `${input.invoiceNumber} — ${input.titleEn}`,
    merchant_url: {
      success: input.successUrl,
      failure: input.failureUrl,
      cancel: input.cancelUrl,
      notification: input.notificationUrl,
    },
    payment_type: 'PAY_BY_INSTALMENTS',
    locale: 'ar_SA',
    platform: COMPANY.website,
    is_mobile: false,
  };

  const res = await call<{ order_id?: string; checkout_url?: string; status?: string; checkout_id?: string }>(
    '/checkout',
    { method: 'POST', body },
  );
  if (!res.ok) return { ok: false, error: res.error };

  const orderId = res.data?.order_id;
  const checkoutUrl = res.data?.checkout_url;
  if (!orderId || !checkoutUrl) {
    return { ok: false, error: 'رد تمارا بلا order_id أو checkout_url' };
  }
  return { ok: true, data: { orderId, checkoutUrl, status: res.data?.status || 'new' } };
}

/** إقرار باستلام إشعار الموافقة — بدونه لا تتقدّم الطلبية. */
export async function authoriseTamaraOrder(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await call<unknown>(`/orders/${encodeURIComponent(orderId)}/authorise`, { method: 'POST' });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

/**
 * تحصيل المبلغ. تمارا تُحصّل تلقائياً بعد واحد وعشرين يوماً من التفويض،
 * فالتحصيل هنا تعجيلٌ لما سيقع لا إضافةٌ إليه.
 */
export async function captureTamaraOrder(
  orderId: string,
  total: number,
  taxAmount: number,
): Promise<{ ok: true; captureId?: string } | { ok: false; error: string }> {
  const res = await call<{ capture_id?: string }>('/payments/capture', {
    method: 'POST',
    body: {
      order_id: orderId,
      total_amount: { amount: total, currency: 'SAR' },
      tax_amount: { amount: taxAmount, currency: 'SAR' },
      shipping_amount: { amount: 0, currency: 'SAR' },
      discount_amount: { amount: 0, currency: 'SAR' },
    },
  });
  return res.ok ? { ok: true, captureId: res.data?.capture_id } : { ok: false, error: res.error };
}

export async function getTamaraOrder(
  orderId: string,
): Promise<{ ok: true; data: { status?: string } } | { ok: false; error: string }> {
  const res = await call<{ status?: string }>(`/orders/${encodeURIComponent(orderId)}`, { method: 'GET' });
  return res.ok ? { ok: true, data: res.data ?? {} } : { ok: false, error: res.error };
}

/**
 * يتحقّق من رمز الإشعار.
 *
 * تمارا تُرفقه في مُعامل الرابط `tamaraToken` وفي ترويسة Authorization معاً.
 * المقارنة بطول ثابت، والغياب رفض لا تجاوز — إشعار سداد يُقبل بلا تحقّق
 * يعني أن أي أحد يستطيع تعليم فاتورة مدفوعة.
 */
export function tamaraTokenValid(presented: string | null): boolean {
  const expected = process.env.TAMARA_NOTIFICATION_TOKEN || '';
  if (!expected || !presented) return false;
  if (expected.length !== presented.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ presented.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * فحص حيّ للمفتاح بلا أثر.
 *
 * طلبية بمعرّف لا وجود له: 401 يعني مفتاحاً خاطئاً، و404 يعني أن المفتاح
 * صحيح والحساب يردّ — وهو المطلوب إثباته. لا يُنشئ شيئاً ولا يحرّك مالاً.
 */
export async function pingTamara(): Promise<{
  reachable: boolean;
  authorised: boolean;
  httpStatus?: number;
  detail?: string;
}> {
  const token = process.env.TAMARA_API_TOKEN;
  if (!token) return { reachable: false, authorised: false, detail: 'TAMARA_API_TOKEN غير معرّف' };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`${baseUrl()}/orders/00000000-0000-0000-0000-000000000000`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (res.status === 401 || res.status === 403) {
      return { reachable: true, authorised: false, httpStatus: res.status, detail: 'المفتاح مرفوض' };
    }
    return {
      reachable: true,
      authorised: true,
      httpStatus: res.status,
      detail: res.status === 404 ? 'المفتاح مقبول والحساب يردّ' : `رد بحالة ${res.status}`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { reachable: false, authorised: false, detail: msg };
  } finally {
    clearTimeout(timer);
  }
}

/** الأحداث التي نعالجها فعلاً — تسجيل غيرها ضجيج لا يُقرأ. */
export const TAMARA_EVENTS = [
  'order_approved',
  'order_declined',
  'order_expired',
  'order_canceled',
] as const;

export async function listTamaraWebhooks(): Promise<
  { ok: true; data: unknown } | { ok: false; error: string }
> {
  const res = await call<unknown>('/webhooks', { method: 'GET' });
  return res.ok ? { ok: true, data: res.data } : { ok: false, error: res.error };
}

/**
 * يسجّل رابط الإشعار لدى تمارا.
 *
 * الرابط يُمرَّر أيضاً في كل جلسة سداد (`merchant_url.notification`)، لكن
 * التسجيل هو ما تعتمد عليه تمارا رسمياً، و`order_approved` إلزامي عندها.
 */
export async function registerTamaraWebhook(
  url: string,
): Promise<{ ok: true; id?: string } | { ok: false; error: string }> {
  if (!/^https:\/\//i.test(url)) {
    return { ok: false, error: 'رابط الإشعار يجب أن يكون https' };
  }
  const res = await call<{ webhook_id?: string; id?: string }>('/webhooks', {
    method: 'POST',
    body: { url, events: [...TAMARA_EVENTS], headers: {} },
  });
  return res.ok ? { ok: true, id: res.data?.webhook_id ?? res.data?.id } : { ok: false, error: res.error };
}

export function tamaraStatus(): {
  mode: TamaraMode;
  configured: boolean;
  enabled: boolean;
  notificationTokenSet: boolean;
  baseUrl: string;
  minAmount: number;
  maxAmount: number;
  mdr: string;
  fixedFee: number;
} {
  return {
    mode: tamaraMode(),
    configured: tamaraConfigured(),
    enabled: tamaraEnabled(),
    notificationTokenSet: Boolean(process.env.TAMARA_NOTIFICATION_TOKEN),
    baseUrl: baseUrl(),
    minAmount: tamaraMinAmount(),
    maxAmount: tamaraMaxAmount(),
    mdr: `${(TAMARA_MDR * 100).toFixed(2)}%`,
    fixedFee: TAMARA_FIXED_FEE,
  };
}
