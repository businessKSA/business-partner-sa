import Link from 'next/link';
import { guardClient } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { fmtMoney, fmtDate } from '@/lib/money';
import { walletSummary, walletEntries } from '@/lib/billing';
import { clientJourney, journeyStatus } from '@/lib/timeline';
import { StatusPill, Kpi, Timeline } from '@/components/ui';
import { CLIENT_FOLDERS, FOLDER_LABEL, storage } from '@/lib/storage';
import { INVOICE_STATUS_LABEL, WALLET_KIND_LABEL } from '@/lib/enums';
import PortalUpload from './PortalUpload';

export const dynamic = 'force-dynamic';

export default async function PortalHome() {
  const clientId = await guardClient();
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: clientId },
    include: {
      documents: { orderBy: { createdAt: 'desc' } },
      invoices: { orderBy: { createdAt: 'desc' } },
      files: { orderBy: { createdAt: 'desc' } },
    },
  });
  const [wallet, entries, journey, status] = await Promise.all([
    walletSummary(clientId),
    walletEntries(clientId),
    clientJourney(clientId, true),
    journeyStatus(clientId),
  ]);
  const s = storage();
  // المسودات لا تظهر للعميل إطلاقاً
  const visibleDocs = client.documents.filter((d) => d.status !== 'DRAFT');

  return (
    <>
      <h1>مرحباً، {client.companyAr || client.nameAr}</h1>
      <p className="sub">عروضك وعقودك ومرفقاتك ومدفوعاتك ومحفظتك في مكان واحد.</p>

      <div className="notice"><b>أين وصلنا:</b> {status.ar}</div>

      <div className="grid c4" style={{ marginBottom: 18 }}>
        <Kpi label="إجمالي التعاقدات" value={fmtMoney(wallet.totalContracted)} unit="ريال" />
        <Kpi label="المدفوع" value={fmtMoney(wallet.paid)} unit="ريال" />
        <Kpi label="المستحق" value={fmtMoney(wallet.due)} unit="ريال" negative={wallet.due > 0} />
        <Kpi label="رصيد العهدة المتاح" value={fmtMoney(wallet.custodyBalance)} unit="ريال" />
      </div>

      <div className="card">
        <h2>الفواتير والمدفوعات</h2>
        <table>
          <thead>
            <tr><th>الرقم</th><th>البيان</th><th className="num">الإجمالي</th><th>الحالة</th><th className="num">الدفع</th></tr>
          </thead>
          <tbody>
            {client.invoices.map((i) => (
              <tr key={i.id}>
                <td className="mono">{i.number}</td>
                <td>{i.titleAr}</td>
                <td className="num">{fmtMoney(i.total)}</td>
                <td><span className={`pill st-${i.status}`}>{INVOICE_STATUS_LABEL[i.status]?.ar ?? i.status}</span></td>
                <td className="num">
                  {i.status === 'DUE' ? (
                    <Link className="btn sm" href={`/portal/pay/${i.payToken}`}>ادفع الآن</Link>
                  ) : i.paidAt ? (
                    <span className="muted">{fmtDate(i.paidAt, 'en')}</span>
                  ) : '—'}
                </td>
              </tr>
            ))}
            {!client.invoices.length ? <tr><td colSpan={5} className="muted">لا توجد فواتير.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>عروض الأسعار والعقود</h2>
        <table>
          <thead><tr><th>الرقم</th><th>النوع</th><th>العنوان</th><th className="num">الإجمالي</th><th>الحالة</th><th className="num">فتح</th></tr></thead>
          <tbody>
            {visibleDocs.map((d) => (
              <tr key={d.id}>
                <td className="mono">{d.number}</td>
                <td>{d.type === 'QUOTE' ? 'عرض سعر' : d.type === 'CONTRACT' ? 'عقد' : 'اتفاقية توريد'}</td>
                <td>{d.titleAr}</td>
                <td className="num">{fmtMoney(d.total)}</td>
                <td><StatusPill status={d.status} /></td>
                <td className="num"><a className="btn ghost sm" href={`/d/${d.publicToken}`}>عرض</a></td>
              </tr>
            ))}
            {!visibleDocs.length ? <tr><td colSpan={6} className="muted">لا توجد مستندات بعد.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>المحفظة</h2>
        <p className="muted">كل حركة مالية مسجّلة بتاريخها وبيانها — لتروا أموالكم بشفافية كاملة.</p>
        <table>
          <thead><tr><th className="num">التاريخ</th><th>البيان</th><th>النوع</th><th className="num">وارد</th><th className="num">صادر</th></tr></thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="num">{fmtDate(e.createdAt, 'en')}</td>
                <td>{e.descAr}</td>
                <td>{WALLET_KIND_LABEL[e.kind]?.ar ?? e.kind}</td>
                <td className="num">{e.direction === 'IN' ? fmtMoney(e.amount) : '—'}</td>
                <td className="num">{e.direction === 'OUT' ? fmtMoney(e.amount) : '—'}</td>
              </tr>
            ))}
            {!entries.length ? <tr><td colSpan={5} className="muted">لا توجد حركات.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>ملفاتك</h2>
        <div className="grid c3">
          {CLIENT_FOLDERS.map((f) => {
            const files = client.files.filter((x) => x.folder === f);
            return (
              <div key={f}>
                <h3>{FOLDER_LABEL[f].ar}</h3>
                {!files.length ? <p className="muted">فارغ</p> : (
                  <ul style={{ paddingInlineStart: 18, margin: 0, fontSize: 13 }}>
                    {files.map((x) => (
                      <li key={x.id}><a href={s.urlFor(x.path)}>{x.name}</a></li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <PortalUpload clientId={clientId} />

      <div className="card">
        <h2>مسار العمل</h2>
        <Timeline events={journey} />
      </div>
    </>
  );
}
