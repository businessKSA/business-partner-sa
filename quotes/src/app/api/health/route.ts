import { NextResponse } from 'next/server';
import { tamaraStatus } from '@/lib/payments/tamara';
import { daftraStatus } from '@/lib/daftra';

export const dynamic = 'force-dynamic';

/**
 * حالة الإعداد — بلا تسجيل دخول، وبلا سرّ واحد.
 *
 * سببها حادثة حقيقية: أُضيف RESEND_API_KEY بعد أن بدأ البناء، فلم تره
 * النشرة الشغالة، ففشل إرسال رابط دخول المدير. والشاشة قالت «سيصلك
 * الرابط»، ولم يكن في النظام موضع واحد يُسأل: هل البريد مضبوط أصلاً؟
 * وكل ما يجيب عن ذلك كان خلف تسجيل دخول يحتاج ذلك البريد نفسه.
 *
 * القاعدة هنا كالقاعدة في api/pay.js على الموقع: قيم منطقية وأسماء أوضاع
 * فقط — لا مفتاح ولا بادئته ولا طوله. «المتغير غير مضبوط» و«مضبوط لكنه
 * خاطئ» يبدوان من الخارج سواءً، وهكذا يبقى مسار معطّل معطّلاً عبر إصلاحات
 * لم تكن لتمسّه.
 */
export async function GET() {
  const mailProvider = (process.env.MAIL_PROVIDER || 'log').toLowerCase();
  const mail = {
    provider: mailProvider,
    // «log» ليس عطلاً بل وضعُ تسجيل: يكتب الرسالة في السجل ولا يرسلها
    sends: mailProvider === 'smtp' || mailProvider === 'resend',
    configured:
      mailProvider === 'resend'
        ? Boolean(process.env.RESEND_API_KEY)
        : mailProvider === 'smtp'
          ? Boolean(process.env.SMTP_HOST && process.env.SMTP_USER)
          : true,
    fromSet: Boolean(process.env.MAIL_FROM),
  };

  const t = tamaraStatus();
  const d = daftraStatus();

  return NextResponse.json(
    {
      البريد: {
        ...mail,
        // الحالة التي أوقعتنا: الوضع «resend» والمفتاح غائب عن هذه النشرة
        ملاحظة: mail.sends && !mail.configured
          ? 'الوضع يرسل لكن مفتاحه غائب عن هذه النشرة — أضِف المفتاح ثم أعد النشر'
          : mail.sends
            ? 'مضبوط'
            : 'وضع تسجيل: لا تصل رسالة أحداً',
      },
      تمارا: {
        mode: t.mode,
        configured: t.configured,
        enabled: t.enabled,
        notificationTokenSet: t.notificationTokenSet,
      },
      الدفترة: d,
      الجسر: {
        tokenSet: Boolean(process.env.PANEL_BRIDGE_TOKEN),
        siteUrlSet: Boolean(process.env.SITE_API_URL),
      },
      appUrlSet: Boolean(process.env.APP_URL),
    },
    {
      headers: {
        'cache-control': 'no-store',
        // لوحة تحكم الموقع تقرأ هذه النقطة من متصفح المدير لتعرض حالة هذه
        // اللوحة إلى جانب حالة بقية الخدمات. النقطة بلا سرّ وبلا تسجيل دخول
        // أصلاً، فالسماح بالقراءة عبر الأصول لا يكشف ما لم يكن مكشوفاً.
        'access-control-allow-origin': '*',
      },
    },
  );
}
