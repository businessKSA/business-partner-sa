/** Moyasar — بوابة دفع سعودية تدعم مدى وفيزا وآبل باي. المبالغ بالهللات. */
import type { PaymentProvider, PaymentIntent, PaymentStatus } from './index';
import { hmac, safeEqual } from '../tokens';

const BASE = 'https://api.moyasar.com/v1';

function authHeader(): string {
  const key = process.env.MOYASAR_SECRET_KEY;
  if (!key) throw new Error('MOYASAR_SECRET_KEY غير معرّف');
  return `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
}

function eq(a: string, b: string): boolean {
  return a.length === b.length && safeEqual(a, b);
}

export const moyasarProvider: PaymentProvider = {
  name: 'moyasar',
  supportsApplePay: true,

  async createPayment({ metadata }): Promise<PaymentIntent> {
    // في Moyasar تُنشأ الدفعة من الواجهة عبر نموذج Moyasar بالمفتاح العام،
    // ثم تُؤكَّد بالخادم. لا يُمرَّر المبلغ في الرابط إطلاقاً — صفحة السداد
    // تقرأ الفاتورة من قاعدة البيانات برمزها حتى لا يُعدَّل المبلغ من العنوان.
    const payToken = metadata.payToken;
    if (!payToken) throw new Error('رمز الفاتورة مفقود في بيانات الدفع');
    return {
      ref: `pending-${metadata.invoiceId ?? ''}`,
      url: `/portal/pay/${payToken}/checkout`,
      provider: 'moyasar',
    };
  },

  async fetchPayment(ref: string): Promise<PaymentStatus> {
    const res = await fetch(`${BASE}/payments/${ref}`, { headers: { Authorization: authHeader() } });
    const body = (await res.json().catch(() => ({}))) as {
      id?: string;
      status?: string;
      amount?: number;
      source?: { type?: string; company?: string };
      message?: string;
    };
    if (!res.ok) throw new Error(`فشل الاستعلام عن الدفعة: ${body.message || res.status}`);
    return {
      ref: body.id || ref,
      paid: body.status === 'paid',
      status: body.status || 'unknown',
      amount: (body.amount ?? 0) / 100,
      method: body.source?.type === 'creditcard' ? body.source?.company : body.source?.type,
      raw: body,
    };
  },

  /**
   * تتحقق من أن الطلب فعلاً من Moyasar. الصيغة المعتمدة لدى Moyasar هي
   * رمز سرّي داخل جسم الطلب (secret_token) يُضبط عند إنشاء الـwebhook في
   * لوحة التاجر. وتُقبل أيضاً ترويسة توقيع HMAC إن أرسلها المزوّد.
   * بلا رمز مضبوط ترفض الدالة كل شيء — نقطة تعلن سداد الفواتير لا تُترك مفتوحة.
   */
  verifyWebhook(rawBody: string, headers: Headers): boolean {
    const secret = process.env.MOYASAR_WEBHOOK_SECRET;
    if (!secret) return false;

    try {
      const body = JSON.parse(rawBody) as { secret_token?: unknown };
      if (typeof body.secret_token === 'string' && eq(body.secret_token, secret)) return true;
    } catch {
      // جسم غير قابل للتحليل — يُترك للتحقق بالترويسة أدناه
    }

    const sig = headers.get('x-moyasar-signature') || headers.get('x-signature');
    if (!sig) return false;
    return eq(hmac(secret, rawBody, 'hex'), sig);
  },
};
