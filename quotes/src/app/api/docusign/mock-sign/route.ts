import { NextResponse } from 'next/server';
import { appBase } from '@/lib/base';
import { prisma } from '@/lib/db';
import { docusignMode } from '@/lib/docusign/jwt';
import { applyEnvelopeStatus } from '@/lib/docusign/webhook';
import { COMPANY } from '@config/company';

export const dynamic = 'force-dynamic';

/**
 * شاشة توقيع محلية تحاكي DocuSign — تعمل فقط عندما DOCUSIGN_MODE=mock.
 * تحاكي ترتيب التوقيع: العميل أولاً ثم بزنس بارتنر، ثم تُطلق حدث completed
 * عبر نفس المعالج الذي يستخدمه الـwebhook الحقيقي.
 */
function page(body: string): NextResponse {
  return new NextResponse(
    `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
     <title>محاكاة التوقيع — DocuSign</title>
     <link rel="stylesheet" href="/fonts/tajawal.css">
     <style>body{font-family:'Tajawal',sans-serif;background:#F5F7FB;color:#1F2430;margin:0;padding:40px}
     .box{max-width:620px;margin:0 auto;background:#fff;border:1px solid #D9DDE7;border-radius:10px;padding:26px}
     h1{color:#0B1B5A;font-size:20px;margin:0 0 8px}.muted{color:#5B6172;font-size:13px}
     .btn{display:inline-block;background:#0B1B5A;color:#fff;border:0;border-radius:7px;padding:10px 20px;
     font-family:inherit;font-size:14px;cursor:pointer;text-decoration:none;margin-top:14px}
     .warn{border:1px solid #EDD9A5;background:#FDF9EF;border-radius:8px;padding:10px 14px;font-size:13px;margin:14px 0}
     </style></head><body><div class="box">${body}</div></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

export async function GET(req: Request) {
  if (docusignMode() !== 'mock') {
    return NextResponse.json({ error: 'متاح في وضع المحاكاة فقط' }, { status: 404 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get('envelope') || '';
  const who = url.searchParams.get('who') === 'bp' ? 'bp' : 'client';
  const returnUrl = url.searchParams.get('returnUrl') || '/';

  const env = await prisma.envelope.findUnique({ where: { id }, include: { document: true } });
  if (!env) return NextResponse.json({ error: 'ظرف غير موجود' }, { status: 404 });

  const signer = who === 'client' ? `${env.clientName} (${env.clientEmail})` : `${env.bpName} (${env.bpEmail})`;
  const order = who === 'client' ? 'الموقّع الأول — الطرف الثاني (العميل)' : 'الموقّع الثاني — الطرف الأول (بزنس بارتنر)';

  return page(`
    <h1>محاكاة توقيع DocuSign</h1>
    <p class="muted">العقد ${env.document.number} — ${order}</p>
    <p>الموقّع: ${signer}</p>
    <div class="warn">
      هذه شاشة محاكاة محلية تعمل لأن DOCUSIGN_MODE=mock. في وضع demo أو production
      يُفتح هنا مباشرةً واجهة التوقيع الرسمية من DocuSign بعلامات الربط
      /sig_client/ و/date_client/ و/sig_bp/ و/date_bp/.
    </div>
    <form method="post">
      <input type="hidden" name="envelope" value="${id}">
      <input type="hidden" name="who" value="${who}">
      <input type="hidden" name="returnUrl" value="${returnUrl}">
      <button class="btn" type="submit">توقيع الآن</button>
    </form>
    <p class="muted" style="margin-top:18px">${COMPANY.legalName.ar}</p>
  `);
}

export async function POST(req: Request) {
  if (docusignMode() !== 'mock') {
    return NextResponse.json({ error: 'متاح في وضع المحاكاة فقط' }, { status: 404 });
  }
  const fd = await req.formData();
  const id = String(fd.get('envelope') || '');
  const who = String(fd.get('who') || 'client');
  const returnUrl = String(fd.get('returnUrl') || '/');

  const env = await prisma.envelope.findUnique({ where: { id } });
  if (!env) return NextResponse.json({ error: 'ظرف غير موجود' }, { status: 404 });

  // من وقّع حتى الآن يُقرأ من صفوف التوقيع نفسها لا من حقل جانبي، فالمحاكاة
  // تمر بالمسار الذي يمر به الحدث الحقيقي بالضبط
  const prior = await prisma.signature.findMany({ where: { envelopeDbId: id } });
  const signed = new Set(prior.filter((s) => s.signedAt).map((s) => s.role));
  signed.add(who);

  const now = new Date().toISOString();
  const at = (role: string) => (role === who ? now : prior.find((s) => s.role === role)?.signedAt?.toISOString());

  // الشكل نفسه الذي يرسله DocuSign Connect مع eventData.includeData=['recipients']
  const payload = {
    event: signed.has('client') && signed.has('bp') ? 'envelope-completed' : 'envelope-delivered',
    data: {
      envelopeId: env.envelopeId,
      envelopeSummary: {
        recipients: {
          signers: [
            {
              recipientId: '1',
              name: env.clientName,
              email: env.clientEmail,
              status: signed.has('client') ? 'completed' : 'sent',
              signedDateTime: at('client'),
              ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
              userAgentString: req.headers.get('user-agent') || undefined,
            },
            {
              recipientId: '2',
              name: env.bpName,
              email: env.bpEmail,
              status: signed.has('bp') ? 'completed' : 'sent',
              signedDateTime: at('bp'),
              ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
              userAgentString: req.headers.get('user-agent') || undefined,
            },
          ],
        },
      },
      mock: true,
    },
  };

  // العميل وقّع أولاً => delivered ؛ وقّع الطرفان => completed
  const next = signed.has('client') && signed.has('bp') ? 'completed' : 'delivered';
  await applyEnvelopeStatus(env.envelopeId, next, payload);

  const base = appBase(req);
  return NextResponse.redirect(returnUrl.startsWith('http') ? returnUrl : `${base}${returnUrl}`, 303);
}
