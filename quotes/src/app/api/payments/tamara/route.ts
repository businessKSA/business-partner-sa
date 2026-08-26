import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { markInvoicePaid } from '@/lib/billing';
import { logEvent } from '@/lib/timeline';
import {
  authoriseTamaraOrder,
  captureTamaraOrder,
  getTamaraOrder,
  tamaraEnabled,
  tamaraTokenValid,
} from '@/lib/payments/tamara';

export const dynamic = 'force-dynamic';

/**
 * إشعار تمارا ورجوع المتصفح.
 *
 * POST — الإشعار. عليه وحده يُبنى قرار «سُدِّدت»، لا على رجوع المتصفح:
 *        الرجوع مُعامل رابط يكتبه من يشاء.
 * GET  — رجوع العميل بعد الإكمال. يُعيده إلى صفحة الفاتورة ولا يغيّر حالة
 *        شيء؛ إن كان الإشعار قد وصل فالصفحة تعرضها مسددة، وإلا فبعد لحظات.
 */

/** يقرأ الرمز من مُعامل الرابط أو من ترويسة Authorization — تمارا ترسله فيهما. */
function presentedToken(req: Request, url: URL): string | null {
  const q = url.searchParams.get('tamaraToken');
  if (q) return q;
  const h = req.headers.get('authorization') || '';
  return h.toLowerCase().startsWith('bearer ') ? h.slice(7).trim() : null;
}

export async function POST(req: Request) {
  const url = new URL(req.url);

  if (!tamaraEnabled()) {
    return NextResponse.json({ error: 'تمارا غير مفعّلة' }, { status: 404 });
  }
  if (!tamaraTokenValid(presentedToken(req, url))) {
    return NextResponse.json({ error: 'رمز إشعار غير صالح' }, { status: 401 });
  }

  let payload: {
    order_id?: string;
    order_reference_id?: string;
    event_type?: string;
    order_status?: string;
  };
  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: 'حمولة غير صالحة' }, { status: 400 });
  }

  const orderId = payload.order_id;
  if (!orderId) return NextResponse.json({ error: 'بلا order_id' }, { status: 400 });

  // الربط بمعرّف الطلبية المحفوظ عند فتح الجلسة، وبرقم الفاتورة احتياطاً
  const invoice =
    (await prisma.invoice.findFirst({ where: { tamaraOrderId: orderId } })) ??
    (payload.order_reference_id
      ? await prisma.invoice.findFirst({ where: { number: payload.order_reference_id } })
      : null);

  if (!invoice) {
    // رد ناجح: إعادة المحاولة لن تجد فاتورة لم تُنشأ عندنا قط
    return NextResponse.json({ ok: true, ignored: 'فاتورة غير معروفة' });
  }

  const event = (payload.event_type || payload.order_status || '').toLowerCase();

  if (event.includes('declined') || event.includes('expired') || event.includes('cancel')) {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { tamaraStatus: event, tamaraOrderId: orderId },
    });
    await logEvent({
      entityType: 'invoice',
      entityId: invoice.id,
      clientId: invoice.clientId,
      code: 'TAMARA_NOT_APPROVED',
      titleAr: `تمارا لم تعتمد تقسيط الفاتورة ${invoice.number} — ${event}`,
      titleEn: `Tamara did not approve instalments for invoice ${invoice.number} — ${event}`,
      actor: 'tamara',
      actorKind: 'payment',
    });
    return NextResponse.json({ ok: true });
  }

  if (!event.includes('approved')) {
    // أحداث أخرى تُسجَّل ولا تُغيّر مالاً
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { tamaraStatus: event || 'unknown', tamaraOrderId: orderId },
    });
    return NextResponse.json({ ok: true });
  }

  if (invoice.status === 'PAID') return NextResponse.json({ ok: true, already: true });

  // موافَق عليها: نُقرّ بالاستلام ثم نُحصّل. الخطوتان مطلوبتان — الطلبية
  // بلا تفويض لا تتقدّم، وبلا تحصيل تنتظر واحداً وعشرين يوماً.
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { tamaraOrderId: orderId, tamaraStatus: 'approved', tamaraError: null },
  });

  const auth = await authoriseTamaraOrder(orderId);
  if (!auth.ok) {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { tamaraError: `تعذّر التفويض: ${auth.error}`.slice(0, 500) },
    });
    await logEvent({
      entityType: 'invoice',
      entityId: invoice.id,
      clientId: invoice.clientId,
      code: 'TAMARA_AUTHORISE_FAILED',
      titleAr: `تعذّر تفويض طلبية تمارا للفاتورة ${invoice.number}: ${auth.error}`,
      titleEn: `Could not authorise Tamara order for invoice ${invoice.number}: ${auth.error}`,
      actor: 'tamara',
      actorKind: 'payment',
      clientVisible: false,
    });
    // خطأ خادم كي تعيد تمارا المحاولة
    return NextResponse.json({ error: 'authorise failed' }, { status: 500 });
  }

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { tamaraStatus: 'authorised' },
  });

  const cap = await captureTamaraOrder(orderId, invoice.total, invoice.vatAmount);
  if (!cap.ok) {
    // التفويض تمّ والمال مضمون؛ التحصيل يقع تلقائياً بعد واحد وعشرين يوماً.
    // لذلك تُعلَّم مسددة ويُسجَّل سبب تعذّر التعجيل بدل تعليق العميل.
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { tamaraError: `تعذّر التحصيل الفوري: ${cap.error}`.slice(0, 500) },
    });
    await logEvent({
      entityType: 'invoice',
      entityId: invoice.id,
      clientId: invoice.clientId,
      code: 'TAMARA_CAPTURE_FAILED',
      titleAr: `فُوِّضت طلبية تمارا للفاتورة ${invoice.number} وتعذّر تحصيلها فوراً: ${cap.error}`,
      titleEn: `Tamara order authorised for invoice ${invoice.number}, immediate capture failed: ${cap.error}`,
      actor: 'tamara',
      actorKind: 'payment',
      clientVisible: false,
    });
  } else {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { tamaraStatus: 'captured' },
    });
  }

  // نقطة الاختناق الواحدة: المحفظة والتدقيق والفاتورة الضريبية وإيصال العميل
  await markInvoicePaid(invoice.id, {
    provider: 'tamara',
    ref: cap.ok && cap.captureId ? cap.captureId : orderId,
    method: 'tamara',
  });

  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = process.env.APP_URL || url.origin;
  const token = url.searchParams.get('pay') || '';
  const outcome = url.searchParams.get('outcome') || '';

  // تأكيد الحالة من تمارا مباشرةً عند الرجوع، فقد يسبق المتصفحُ الإشعار
  const orderId = url.searchParams.get('orderId') || '';
  if (orderId) {
    const invoice = await prisma.invoice.findFirst({ where: { tamaraOrderId: orderId } });
    if (invoice && invoice.status !== 'PAID') {
      const st = await getTamaraOrder(orderId);
      if (st.ok && st.data.status) {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { tamaraStatus: st.data.status.toLowerCase() },
        });
      }
    }
  }

  const dest = token ? `/portal/pay/${token}` : '/portal';
  const q = outcome ? `?tamara=${encodeURIComponent(outcome)}` : '';
  return NextResponse.redirect(`${base}${dest}${q}`, 303);
}
