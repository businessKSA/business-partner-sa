import Link from 'next/link';
import { notFound } from 'next/navigation';
import { guardAdmin } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { fmtMoney, fmtDate } from '@/lib/money';
import { clientJourney, journeyStatus } from '@/lib/timeline';
import { walletSummary, walletEntries } from '@/lib/billing';
import { StatusPill, Kpi, Timeline } from '@/components/ui';
import { CLIENT_FOLDERS, FOLDER_LABEL, storage } from '@/lib/storage';
import { WALLET_KIND_LABEL, INVOICE_STATUS_LABEL } from '@/lib/enums';
import ClientTools from './ClientTools';

export const dynamic = 'force-dynamic';

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  await guardAdmin();
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      documents: { orderBy: { createdAt: 'desc' } },
      files: { orderBy: { createdAt: 'desc' } },
      invoices: { orderBy: { createdAt: 'desc' } },
      supplyRequests: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!client) notFound();

  const [journey, status, wallet, entries] = await Promise.all([
    clientJourney(id),
    journeyStatus(id),
    walletSummary(id),
    walletEntries(id),
  ]);
  const s = storage();

  return (
    <>
      <h1>{client.companyAr || client.nameAr}</h1>
      <p className="sub" dir="ltr" style={{ textAlign: 'right' }}>
        {client.companyEn || client.nameEn || ''} — {client.email} — {client.phone}
      </p>

      <div className="notice">
        <b>حالة الرحلة:</b> {status.ar}
        <div className="muted" dir="ltr" style={{ textAlign: 'left' }}>{status.en}</div>
      </div>

      <div className="grid c4" style={{ marginBottom: 18 }}>
        <Kpi label="إجمالي التعاقدات الموقّعة" value={fmtMoney(wallet.totalContracted)} unit="ريال" />
        <Kpi label="المدفوع" value={fmtMoney(wallet.paid)} unit="ريال" />
        <Kpi label="المستحق" value={fmtMoney(wallet.due)} unit="ريال" negative={wallet.due > 0} />
        <Kpi label="رصيد العهدة المتاح" value={fmtMoney(wallet.custodyBalance)} unit="ريال" />
      </div>

      <div className="card">
        <h2>المستندات</h2>
        <div className="row" style={{ marginBottom: 10 }}>
          <Link className="btn sm" href={`/admin/documents/new?client=${client.id}`}>عرض سعر جديد لهذا العميل</Link>
          <Link className="btn ghost sm" href={`/admin/agent?client=${client.id}`}>توليد بالوكيل الذكي</Link>
          <Link className="btn ghost sm" href={`/admin/clients/${client.id}/edit`}>تعديل بيانات العميل</Link>
        </div>
        <table>
          <thead>
            <tr><th>الرقم</th><th>النوع</th><th>العنوان</th><th className="num">الإجمالي</th><th>الحالة</th><th className="num">التاريخ</th></tr>
          </thead>
          <tbody>
            {client.documents.map((d) => (
              <tr key={d.id}>
                <td className="mono"><Link href={`/admin/documents/${d.id}`}>{d.number}</Link></td>
                <td>{d.type === 'QUOTE' ? 'عرض سعر' : d.type === 'CONTRACT' ? 'عقد' : 'اتفاقية توريد'}</td>
                <td>{d.titleAr}</td>
                <td className="num">{fmtMoney(d.total)}</td>
                <td><StatusPill status={d.status} /></td>
                <td className="num">{fmtDate(d.createdAt, 'en')}</td>
              </tr>
            ))}
            {!client.documents.length ? <tr><td colSpan={6} className="muted">لا توجد مستندات.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>مجلد العميل</h2>
        <p className="muted mono">{client.folderPath}</p>
        <div className="grid c3">
          {CLIENT_FOLDERS.map((f) => {
            const files = client.files.filter((x) => x.folder === f);
            return (
              <div key={f}>
                <h3>{FOLDER_LABEL[f].ar} <span className="muted" dir="ltr">({FOLDER_LABEL[f].en})</span></h3>
                {!files.length ? <p className="muted">فارغ</p> : (
                  <ul style={{ paddingInlineStart: 18, margin: 0, fontSize: 13 }}>
                    {files.map((x) => (
                      <li key={x.id} style={{ marginBottom: 4 }}>
                        <a href={s.urlFor(x.path)}>{x.name}</a>
                        <span className="muted"> — {Math.max(1, Math.round(x.size / 1024))} كيلوبايت</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h2>الفواتير</h2>
        <table>
          <thead>
            <tr><th>الرقم</th><th>البيان</th><th className="num">الإجمالي</th><th>الحالة</th><th className="num">تاريخ السداد</th></tr>
          </thead>
          <tbody>
            {client.invoices.map((i) => (
              <tr key={i.id}>
                <td className="mono">{i.number}</td>
                <td>{i.titleAr}{i.isGovFeeDeposit ? ' (عهدة — بدون ضريبة)' : ''}</td>
                <td className="num">{fmtMoney(i.total)}</td>
                <td><span className={`pill st-${i.status}`}>{INVOICE_STATUS_LABEL[i.status]?.ar ?? i.status}</span></td>
                <td className="num">{i.paidAt ? fmtDate(i.paidAt, 'en') : '—'}</td>
              </tr>
            ))}
            {!client.invoices.length ? <tr><td colSpan={5} className="muted">لا توجد فواتير.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>المحفظة</h2>
        <p className="muted">
          العهدة أموال العميل المودعة لدينا (رسوم حكومية أو قيمة توريد) ولا يُصرف منها إلا بإيصال.
          أتعاب بزنس بارتنر المحصّلة إيراد ولا تدخل في العهدة ولا يجوز الصرف منها.
        </p>
        <div className="grid c3" style={{ marginBottom: 14 }}>
          <Kpi label="عهدة الرسوم الحكومية — المودع" value={fmtMoney(wallet.govFeeDeposited)} unit="ريال" />
          <Kpi label="عهدة الرسوم الحكومية — المصروف" value={fmtMoney(wallet.govFeeSpent)} unit="ريال" />
          <Kpi label="عهدة الرسوم الحكومية — الرصيد" value={fmtMoney(wallet.govFeeBalance)} unit="ريال" />
          <Kpi label="إيداعات التوريد — المودع" value={fmtMoney(wallet.supplyDeposited)} unit="ريال" />
          <Kpi label="إيداعات التوريد — المصروف للموردين" value={fmtMoney(wallet.supplierPaid)} unit="ريال" />
          <Kpi label="إيداعات التوريد — الرصيد" value={fmtMoney(wallet.supplyBalance)} unit="ريال" />
        </div>
        <table>
          <thead>
            <tr><th className="num">التاريخ</th><th>البيان</th><th>النوع</th><th className="num">وارد</th><th className="num">صادر</th></tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="num">{fmtDate(e.createdAt, 'en')}</td>
                <td>{e.descAr}{e.receiptPath ? <span className="muted"> — إيصال مرفق</span> : null}</td>
                <td>{WALLET_KIND_LABEL[e.kind]?.ar ?? e.kind}</td>
                <td className="num">{e.direction === 'IN' ? fmtMoney(e.amount) : '—'}</td>
                <td className="num">{e.direction === 'OUT' ? fmtMoney(e.amount) : '—'}</td>
              </tr>
            ))}
            {!entries.length ? <tr><td colSpan={5} className="muted">لا توجد حركات.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <ClientTools clientId={client.id} />

      <div className="card">
        <h2>طلبات التوريد</h2>
        <div className="row" style={{ marginBottom: 10 }}>
          <Link className="btn sm" href={`/admin/suppliers?newRequest=${client.id}`}>طلب توريد جديد</Link>
        </div>
        <table>
          <thead><tr><th>الرقم</th><th>العنوان</th><th>الحالة</th><th className="num">التاريخ</th></tr></thead>
          <tbody>
            {client.supplyRequests.map((r) => (
              <tr key={r.id}>
                <td className="mono"><Link href={`/admin/supply/${r.id}`}>{r.number}</Link></td>
                <td>{r.titleAr}</td>
                <td><span className="pill">{r.status}</span></td>
                <td className="num">{fmtDate(r.createdAt, 'en')}</td>
              </tr>
            ))}
            {!client.supplyRequests.length ? <tr><td colSpan={4} className="muted">لا توجد طلبات توريد.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>الخط الزمني — رحلة العميل كاملة</h2>
        <Timeline events={journey} />
      </div>
    </>
  );
}
