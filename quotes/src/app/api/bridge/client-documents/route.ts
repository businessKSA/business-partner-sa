import { NextResponse } from 'next/server';
import { appBase } from '@/lib/base';
import { prisma } from '@/lib/db';
import { CHANNEL, resolveClient } from '@/lib/identity';

export const dynamic = 'force-dynamic';

/**
 * جسر الاتجاه المعاكس: الموقع يسأل اللوحة «ما عروض هذا العميل وعقوده؟».
 *
 * كان للعميل حسابان: حساب في businesspartner.sa يرى فيه طلباته ومدفوعاته،
 * وبوابة منفصلة في لوحة العروض لا يصلها إلا من رابط في بريد قديم. فمن فتح
 * حسابه ليقرّر في عرض سعر لم يجد للعرض أثراً، ومن ضاع منه البريد ضاع منه
 * العرض. النقطة هنا تجعل صفحة الحساب مصدر العرض والعقد كما هي مصدر الطلب.
 *
 * الحراسة نفسها التي يحرس بها الموقعُ نقطةَ الدفترة: PANEL_BRIDGE_TOKEN
 * سرّاً مشتركاً في ترويسة Bearer، ومقارنة ثابتة الطول. والهوية لا تأتي من
 * المتصفح بل من جلسة الموقع نفسها، فالموقع هو من تحقّق من البريد برمز.
 *
 * لا يُعاد هنا أي مبلغ لم يره العميل أصلاً في مستنده، ولا أي مستند في حالة
 * DRAFT: المسودة ورقة عمل داخلية، وظهورها للعميل وعدٌ لم يُقطع بعد.
 */

/** المسودات داخلية. وما بعدها هو ما أُرسل فعلاً للعميل أو قرّر فيه. */
const CLIENT_VISIBLE = ['APPROVED', 'SENT', 'ACCEPTED', 'SIGNING', 'SIGNED', 'IN_PROGRESS', 'REJECTED', 'EXPIRED'];

function authorized(req: Request): boolean {
  const expected = process.env.PANEL_BRIDGE_TOKEN || '';
  if (!expected) return false;
  const given = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = String(body.email || '').trim().toLowerCase().slice(0, 160);
  if (!email) {
    return NextResponse.json({ ok: false, error: 'missing_identity' }, { status: 400 });
  }

  // البريد وحده: هو ما تحقّق منه الموقع برمز، ولا يُقبل غيره هوية. البحث
  // المباشر أولاً، ثم جدول الهويات لمن سُجّل بريده هناك بحالة أحرف أخرى.
  let client = await prisma.client.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });
  if (!client) client = await resolveClient(CHANNEL.EMAIL, email);

  // عميل بلا سجلّ في اللوحة ليس خطأً: أغلب زوّار الموقع لم يُعرض عليهم شيء
  // بعد. قائمة فارغة تُقرأ في الواجهة «لا يوجد»، والخطأ يُقرأ «تعطّل».
  if (!client) {
    return NextResponse.json({ ok: true, found: false, quotes: [], contracts: [], invoices: [] });
  }

  const base = appBase(req);

  const [documents, invoices] = await Promise.all([
    prisma.document.findMany({
      where: { clientId: client.id, status: { in: CLIENT_VISIBLE } },
      orderBy: { issuedAt: 'desc' },
      take: 40,
      select: {
        type: true,
        number: true,
        status: true,
        titleAr: true,
        titleEn: true,
        total: true,
        currency: true,
        issuedAt: true,
        validUntil: true,
        acceptedAt: true,
        signedAt: true,
        publicToken: true,
      },
    }),
    prisma.invoice.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        number: true,
        status: true,
        titleAr: true,
        titleEn: true,
        total: true,
        dueDate: true,
        paidAt: true,
        payToken: true,
      },
    }),
  ]);

  const doc = (d: (typeof documents)[number]) => ({
    number: d.number,
    status: d.status,
    titleAr: d.titleAr,
    titleEn: d.titleEn,
    total: d.total,
    currency: d.currency,
    // كل الأسعار غير شاملة ضريبة القيمة المضافة، والرسوم الحكومية مستثناة —
    // تُعرَض الراية هنا كي لا تُعيد الواجهة اختراع الصياغة أو تنساها.
    vatExcluded: true,
    govFeesExcluded: true,
    issuedAt: d.issuedAt.toISOString(),
    validUntil: d.validUntil ? d.validUntil.toISOString() : null,
    decidedAt: (d.acceptedAt || d.signedAt)?.toISOString() || null,
    url: `${base}/d/${d.publicToken}`,
  });

  // لا تُصنع هنا جلسة بوابة: روابط المستندات أدناه هي الروابط نفسها التي
  // تصل العميل بالبريد، ومنها يقرأ ويقبل ويوقّع ويسدّد. جسر يمنح جلسة بلا
  // حاجة إليها سطحُ هجومٍ زائد لا مقابل له.

  return NextResponse.json(
    {
      ok: true,
      found: true,
      client: { nameAr: client.companyAr || client.nameAr, email: client.email },
      quotes: documents.filter((d) => d.type === 'QUOTE').map(doc),
      contracts: documents.filter((d) => d.type !== 'QUOTE').map(doc),
      invoices: invoices.map((v) => ({
        number: v.number,
        status: v.status,
        titleAr: v.titleAr,
        titleEn: v.titleEn,
        total: v.total,
        // الفاتورة بالريال دائماً — لا عمود عملة في نموذجها، ولا تُخترع هنا.
        currency: 'SAR',
        dueDate: v.dueDate ? v.dueDate.toISOString() : null,
        paidAt: v.paidAt ? v.paidAt.toISOString() : null,
        url: v.status === 'PAID' ? null : `${base}/portal/pay/${v.payToken}`,
      })),
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
