import Link from 'next/link';
import { guardAdmin } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { fmtMoney, fmtDate } from '@/lib/money';
import { StatusPill, Kpi } from '@/components/ui';
import { DOC_STATUS, STATUS_LABEL } from '@/lib/enums';
import { docusignStatus } from '@/lib/docusign/jwt';
import { agentReady } from '@/lib/agent';

export const dynamic = 'force-dynamic';

const TYPE_LABEL: Record<string, string> = {
  QUOTE: 'عرض سعر',
  CONTRACT: 'عقد',
  SUPPLY_AGREEMENT: 'اتفاقية توريد',
};

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; client?: string; type?: string }>;
}) {
  await guardAdmin();
  const sp = await searchParams;
  const q = (sp.q || '').trim();

  const where = {
    ...(sp.status ? { status: sp.status } : {}),
    ...(sp.client ? { clientId: sp.client } : {}),
    ...(sp.type ? { type: sp.type } : {}),
    ...(q
      ? {
          OR: [
            { number: { contains: q } },
            { titleAr: { contains: q } },
            { titleEn: { contains: q } },
            { client: { is: { nameAr: { contains: q } } } },
            { client: { is: { companyAr: { contains: q } } } },
            { client: { is: { email: { contains: q } } } },
          ],
        }
      : {}),
  };

  const [docs, clients, counts, sums] = await Promise.all([
    prisma.document.findMany({
      where,
      include: { client: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.client.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.document.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.document.aggregate({
      where: { status: { in: [DOC_STATUS.SIGNED, DOC_STATUS.IN_PROGRESS] } },
      _sum: { total: true },
    }),
  ]);

  const ds = docusignStatus();
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;

  return (
    <>
      <h1>لوحة التحكم</h1>
      <p className="sub">عروض الأسعار والعقود — بحث وفلترة بالحالة والعميل</p>

      {!ds.ready ? (
        <div className="notice warn">
          تكامل DocuSign غير مكتمل الإعداد (الوضع: {ds.mode}). المتغيرات الناقصة: {ds.missing.join(', ')}.
          بقية النظام يعمل بشكل طبيعي — راجع docs/docusign.md.
        </div>
      ) : null}
      {!agentReady() ? (
        <div className="notice warn">
          الوكيل الذكي غير مفعّل: ANTHROPIC_API_KEY غير معرّف في ملف .env. بقية النظام يعمل بشكل طبيعي.
        </div>
      ) : null}

      <div className="grid c4" style={{ marginBottom: 18 }}>
        <Kpi label="مسودات بانتظار الاعتماد" value={String(countOf('DRAFT'))} />
        <Kpi label="مُرسَلة" value={String(countOf('SENT'))} />
        <Kpi label="مقبولة" value={String(countOf('ACCEPTED'))} />
        <Kpi label="قيمة العقود الموقّعة" value={fmtMoney(sums._sum.total ?? 0)} unit="ريال" />
      </div>

      <form className="card no-print" method="get">
        <div className="grid c4">
          <div>
            <label htmlFor="q">بحث</label>
            <input id="q" name="q" defaultValue={q} placeholder="رقم المستند أو اسم العميل أو بريده" />
          </div>
          <div>
            <label htmlFor="status">الحالة</label>
            <select id="status" name="status" defaultValue={sp.status || ''}>
              <option value="">الكل</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v.ar}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="client">العميل</label>
            <select id="client" name="client" defaultValue={sp.client || ''}>
              <option value="">الكل</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.companyAr || c.nameAr}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="type">النوع</label>
            <select id="type" name="type" defaultValue={sp.type || ''}>
              <option value="">الكل</option>
              <option value="QUOTE">عرض سعر</option>
              <option value="CONTRACT">عقد</option>
              <option value="SUPPLY_AGREEMENT">اتفاقية توريد</option>
            </select>
          </div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" type="submit">تطبيق</button>
          <Link className="btn ghost" href="/admin">إلغاء الفلترة</Link>
          <Link className="btn ghost" href="/admin/documents/new">عرض سعر جديد</Link>
        </div>
      </form>

      <div className="card">
        <h2>المستندات ({docs.length})</h2>
        {!docs.length ? (
          <p className="muted">لا توجد مستندات مطابقة.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>الرقم</th>
                <th>النوع</th>
                <th>العميل</th>
                <th>العنوان</th>
                <th className="num">الإجمالي شامل الضريبة</th>
                <th>الحالة</th>
                <th className="num">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td className="mono">
                    <Link href={`/admin/documents/${d.id}`}>{d.number}</Link>
                  </td>
                  <td>{TYPE_LABEL[d.type] ?? d.type}</td>
                  <td>
                    <Link href={`/admin/clients/${d.clientId}`}>{d.client.companyAr || d.client.nameAr}</Link>
                  </td>
                  <td>{d.titleAr}</td>
                  <td className="num">{fmtMoney(d.total)}</td>
                  <td><StatusPill status={d.status} /></td>
                  <td className="num">{fmtDate(d.createdAt, 'en')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
