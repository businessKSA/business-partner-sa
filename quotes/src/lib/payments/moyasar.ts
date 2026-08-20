/** Moyasar — بوابة دفع سعودية تدعم مدى وفيزا وآبل باي. المبالغ بالهللات. */
import type { PaymentProvider, PaymentIntent, PaymentStatus } from './index';
import { hmac, safeEqual } from '../tokens';

const BASE = 'https://api.moyasar.com/v1';

function authHeader(): string {
  const key = process.env.MOYASAR_SECRET_KEY;
  if (!key) throw new Error('MOYASAR_SECRET_KEY غير معرّف');
  return `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
}

export const moyasarProvider: PaymentProvider = {
  name: 'moyasar',
  supportsApplePay: true,

  async createPayment({ amount, description, callbackUrl, metadata }): Promise<PaymentIntent> {
    // في Moyasar تُنشأ الدفعة من الواجهة (Moyasar Form) ثم تُؤكَّد بالخادم.
    // نعيد رابط صفحة الدفع عندنا التي تحمّل نموذج Moyasar بالمفتاح العام.
    const q = new URLSearchParams({
      amount: String(Math.round(amount * 100)),
      description,
      callback: callbackUrl,
      ...metadata,
    });
    return {
      ref: `pending-${metadata.invoiceId ?? ''}`,
      url: `/portal/pay/checkout?${q.toString()}`,
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

  verifyWebhook(rawBody: string, headers: Headers): boolean {
    const secret = process.env.MOYASAR_WEBHOOK_SECRET;
    if (!secret) return true;
    const sig = headers.get('x-moyasar-signature') || headers.get('x-signature');
    if (!sig) return false;
    const expected = hmac(secret, rawBody, 'hex');
    return expected.length === sig.length && safeEqual(expected, sig);
  },
};
