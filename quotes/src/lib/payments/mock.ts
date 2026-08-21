/** مزوّد محاكاة للاختبار المحلي — يحاكي بوابة دفع ناجحة بدون أي مفاتيح. */
import type { PaymentProvider, PaymentIntent, PaymentStatus } from './index';
import { shortToken } from '../tokens';

const store = new Map<string, PaymentStatus>();

export const mockProvider: PaymentProvider = {
  name: 'mock',
  supportsApplePay: false,

  async createPayment({ amount, description, callbackUrl, metadata }): Promise<PaymentIntent> {
    const ref = `mock_${shortToken(10)}`;
    store.set(ref, { ref, paid: false, status: 'initiated', amount });
    const q = new URLSearchParams({ ref, amount: String(amount), description, callback: callbackUrl, ...metadata });
    return { ref, url: `/portal/pay/mock?${q.toString()}`, provider: 'mock' };
  },

  async fetchPayment(ref: string): Promise<PaymentStatus> {
    return store.get(ref) ?? { ref, paid: true, status: 'paid', amount: 0, method: 'mada' };
  },

  verifyWebhook(): boolean {
    return true;
  },
};

/** تُستدعى من شاشة الدفع الوهمية لتأكيد نجاح الدفع. */
export function markMockPaid(ref: string, amount: number, method = 'mada') {
  store.set(ref, { ref, paid: true, status: 'paid', amount, method });
}
