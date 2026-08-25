import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { payments } from '@/lib/payments';
import { markInvoicePaid } from '@/lib/billing';
import { markMockPaid } from '@/lib/payments/mock';

export const dynamic = 'force-dynamic';

/**
 * نقطة رجوع الدفع وwebhook المزوّد معاً.
 * GET  — رجوع المتصفح بعد الدفع (وشاشة المحاكاة).
 * POST — webhook المزوّد بتوقيع مُتحقَّق منه.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const invoiceId = url.searchParams.get('invoice') || '';
  const ref = url.searchParams.get('ref') || url.searchParams.get('id') || '';
  const status = url.searchParams.get('status') || '';
  const method = url.searchParams.get('method') || undefined;
  const back = url.searchParams.get('redirect') || '/portal';
  const base = process.env.APP_URL || url.origin;

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return NextResponse.redirect(`${base}/portal`, 303);

  const provider = payments();
  let paid = status === 'paid';
  let resolvedMethod = method;

  if (provider.name === 'mock') {
    markMockPaid(ref, invoice.total, method || 'mada');
  } else if (ref) {
    // لا نثق بمعامل الرابط في الإنتاج — نتحقق من المزوّد مباشرةً
    try {
      const st = await provider.fetchPayment(ref);
      paid = st.paid;
      resolvedMethod = st.method ?? method;
    } catch {
      paid = false;
    }
  }

  if (paid) {
    await markInvoicePaid(invoice.id, { provider: provider.name, ref, method: resolvedMethod });
  }
  return NextResponse.redirect(`${base}${back}`, 303);
}

export async function POST(req: Request) {
  const raw = await req.text();
  const provider = payments();
  if (!provider.verifyWebhook(raw, req.headers)) {
    return NextResponse.json({ error: 'توقيع غير صالح' }, { status: 401 });
  }

  /**
   * Moyasar يغلّف الدفعة داخل `data` ويضع نوع الحدث في `type`.
   * نقبل الشكلين — المغلَّف والمسطَّح — حتى لا يكسرنا اختلاف نسخة المزوّد.
   */
  type Payment = {
    id?: string;
    status?: string;
    metadata?: { invoiceId?: string };
    source?: { type?: string; company?: string };
  };
  let envelope: Payment & { type?: string; data?: Payment };
  try {
    envelope = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'حمولة غير صالحة' }, { status: 400 });
  }
  const payment: Payment = envelope.data ?? envelope;

  const invoiceId = payment.metadata?.invoiceId;
  if (!invoiceId) return NextResponse.json({ error: 'لا يوجد معرّف فاتورة' }, { status: 400 });
  if (payment.status !== 'paid') return NextResponse.json({ ok: true, message: 'حالة غير مدفوعة — تُجوهلت' });

  await markInvoicePaid(invoiceId, {
    provider: provider.name,
    ref: payment.id || '',
    method: payment.source?.type === 'creditcard' ? payment.source?.company : payment.source?.type,
  });
  return NextResponse.json({ ok: true });
}
