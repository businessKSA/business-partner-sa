/**
 * طبقة تجريد بوابة الدفع — يُبدَّل المزوّد من متغير بيئة واحد
 * دون تغيير أي كود مستدعٍ. المزوّد الحالي: Moyasar (مدى، فيزا، آبل باي).
 */
export interface PaymentIntent {
  /** معرّف الدفعة لدى المزوّد */
  ref: string;
  /** رابط الدفع الذي يُفتح للعميل */
  url: string;
  provider: string;
}

export interface PaymentStatus {
  ref: string;
  paid: boolean;
  status: string;
  amount: number;
  method?: string;
  raw?: unknown;
}

export interface PaymentProvider {
  readonly name: string;
  readonly supportsApplePay: boolean;
  /** المبلغ بالريال (يحوَّل داخلياً للهللات عند الحاجة). */
  createPayment(input: {
    amount: number;
    description: string;
    callbackUrl: string;
    metadata: Record<string, string>;
  }): Promise<PaymentIntent>;
  fetchPayment(ref: string): Promise<PaymentStatus>;
  verifyWebhook(rawBody: string, headers: Headers): boolean;
}

import { moyasarProvider } from './moyasar';
import { mockProvider } from './mock';

let cached: PaymentProvider | null = null;

export function payments(): PaymentProvider {
  if (cached) return cached;
  cached = (process.env.PAYMENT_PROVIDER || 'mock').toLowerCase() === 'moyasar'
    ? moyasarProvider
    : mockProvider;
  return cached;
}

export function paymentStatusLabel(paid: boolean): { ar: string; en: string } {
  return paid ? { ar: 'مدفوعة', en: 'Paid' } : { ar: 'مستحقة', en: 'Due' };
}
