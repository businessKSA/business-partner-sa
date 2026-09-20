import { NextResponse } from 'next/server';
import { appBase } from '@/lib/base';
import { prisma } from '@/lib/db';
import { adminEmail, createMagicLink } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * جسر المالك: لوحة الموقع تقرأ من لوحة العروض، وتفتحها بجلسة مدير.
 *
 * المالك يدير عمله من لوحة الموقع، ولوحة العروض كانت بابها الوحيد رابطاً
 * سحرياً يصل بريد ADMIN_EMAIL. فمن لم يكن ذلك بريده — أو وصل بريده متأخراً
 * أو لم يصل — وقف خارج نظامه هو. وسجّل بعضهم نفسه عميلاً ليرى شيئاً، فرأى
 * ما يراه العميل لا ما يملكه المالك.
 *
 * فهنا بابان بالسرّ المشترك نفسه الذي تُصدَّر به الفواتير:
 *
 *   overview — كل ما في اللوحة: عروض وعقود وفواتير وطلبات توريد، بأسماء
 *              العملاء ومبالغهم، تُعرض داخل لوحة الموقع بلا انتقال.
 *   login    — رابط دخول لمرة واحدة بجلسة مدير، بلا انتظار بريد.
 *
 * ومن يملك PANEL_BRIDGE_TOKEN يملك اللوحة كاملة. وهذا مقصود: السرّ في
 * متغيّرات بيئة مشروع الموقع، ومن يبلغها يملك الموقع أصلاً. لكنه يعني أن
 * السرّ لا يُشارَك ولا يُوضع في متصفح ولا في صفحة — النداء من خادم الموقع
 * إلى خادم اللوحة، والمالك بينهما لا يرى السرّ.
 */

function authorized(req: Request): boolean {
  const expected = process.env.PANEL_BRIDGE_TOKEN || '';
  if (!expected) return false;
  const given = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

const money = (n: number) => Math.round(n * 100) / 100;

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { action?: string };
  const action = String(body.action || 'overview');
  const base = appBase(req);

  if (action === 'login') {
    const email = adminEmail();
    if (!email) {
      return NextResponse.json(
        { ok: false, error: 'admin_email_not_set', ملاحظة: 'اضبط ADMIN_EMAIL في مشروع اللوحة ثم أعد النشر' },
        { status: 503 },
      );
    }
    // رابط لمرة واحدة ينتهي بثلاثين دقيقة — لا يُرسل بريداً ولا يُخزَّن في
    // الموقع، ويُستهلك بأول فتح.
    const url = await createMagicLink(email, 'ADMIN');
    return NextResponse.json({ ok: true, url }, { headers: { 'cache-control': 'no-store' } });
  }

  if (action !== 'overview') {
    return NextResponse.json({ ok: false, error: 'unknown_action' }, { status: 400 });
  }

  const [documents, invoices, supply, clientCount, unpaid] = await Promise.all([
    prisma.document.findMany({
      orderBy: { issuedAt: 'desc' },
      take: 60,
      select: {
        id: true,
        type: true,
        number: true,
        status: true,
        titleAr: true,
        total: true,
        issuedAt: true,
        publicToken: true,
        client: { select: { nameAr: true, companyAr: true, email: true } },
      },
    }),
    prisma.invoice.findMany({
      orderBy: { createdAt: 'desc' },
      take: 60,
      select: {
        id: true,
        number: true,
        status: true,
        titleAr: true,
        total: true,
        dueDate: true,
        paidAt: true,
        client: { select: { nameAr: true, companyAr: true } },
      },
    }),
    prisma.supplyRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        number: true,
        status: true,
        mode: true,
        titleAr: true,
        createdAt: true,
        client: { select: { nameAr: true, companyAr: true } },
        _count: { select: { bids: true, rfps: true } },
      },
    }),
    prisma.client.count(),
    prisma.invoice.aggregate({ _sum: { total: true }, where: { status: { not: 'PAID' } } }),
  ]);

  const who = (c: { nameAr: string; companyAr: string | null } | null) =>
    c ? c.companyAr || c.nameAr : '—';

  return NextResponse.json(
    {
      ok: true,
      panelUrl: base,
      عدّادات: {
        العملاء: clientCount,
        المستندات: documents.length,
        الفواتير: invoices.length,
        غيرالمسددة: money(unpaid._sum.total || 0),
      },
      documents: documents.map((d) => ({
        id: d.id,
        type: d.type,
        number: d.number,
        status: d.status,
        titleAr: d.titleAr,
        total: money(d.total),
        client: who(d.client),
        email: d.client?.email || '',
        issuedAt: d.issuedAt.toISOString(),
        adminUrl: `${base}/admin/documents/${d.id}`,
        publicUrl: `${base}/d/${d.publicToken}`,
      })),
      invoices: invoices.map((v) => ({
        id: v.id,
        number: v.number,
        status: v.status,
        titleAr: v.titleAr,
        total: money(v.total),
        client: who(v.client),
        dueDate: v.dueDate ? v.dueDate.toISOString() : null,
        paidAt: v.paidAt ? v.paidAt.toISOString() : null,
        adminUrl: `${base}/admin/invoices`,
      })),
      supply: supply.map((s) => ({
        id: s.id,
        number: s.number,
        status: s.status,
        mode: s.mode,
        titleAr: s.titleAr,
        client: who(s.client),
        bids: s._count.bids,
        rfps: s._count.rfps,
        createdAt: s.createdAt.toISOString(),
        adminUrl: `${base}/admin/supply/${s.id}`,
      })),
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
