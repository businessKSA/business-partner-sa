import Link from 'next/link';
import { notFound } from 'next/navigation';
import { guardAdmin } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { buildDocModel } from '@/lib/doc-model';
import DocumentView from '@/components/DocumentView';
import { StatusPill, Timeline } from '@/components/ui';
import { fmtMoney, fmtDate, fmtDateTime } from '@/lib/money';
import { timelineFor } from '@/lib/timeline';
import { publicUrl } from '@/lib/send';
import { docusignStatus } from '@/lib/docusign/jwt';
import { INVOICE_STATUS_LABEL, ENVELOPE_STATUS_LABEL, DOC_STATUS } from '@/lib/enums';
import { storage } from '@/lib/storage';
import DocActions from './DocActions';
import JobsPanel from './JobsPanel';

export const dynamic = 'force-dynamic';

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  await guardAdmin();
  const { id } = await params;
  const doc = await prisma.document.findUnique({
    where: { id },
    include: {
      client: true,
      deliveries: { orderBy: { sentAt: 'desc' } },
      envelopes: { orderBy: { createdAt: 'desc' } },
      invoices: { orderBy: { sequence: 'asc' } },
      contract: { select: { id: true, number: true } },
      sourceQuote: { select: { id: true, number: true } },
    },
  });
  if (!doc) notFound();

  const [model, events, jobs] = await Promise.all([
    buildDocModel(id),
    timelineFor('document', id),
    prisma.job.findMany({
      where: { entityType: 'document', entityId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);
  if (!model) notFound();
  const ds = docusignStatus();
  const s = storage();
  const isQuote = doc.type === 'QUOTE';
  const link = publicUrl(doc.publicToken);

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>
            {doc.number} <StatusPill status={doc.status} />
          </h1>
          <p className="sub">
            {doc.titleAr} — <Link href={`/admin/clients/${doc.clientId}`}>{doc.client.companyAr || doc.client.nameAr}</Link>
            {doc.sourceQuote ? (
              <> — صادر عن العرض <Link href={`/admin/documents/${doc.sourceQuote.id}`}>{doc.sourceQuote.number}</Link></>
            ) : null}
            {doc.contract ? (
              <> — العقد المولَّد <Link href={`/admin/documents/${doc.contract.id}`}>{doc.contract.number}</Link></>
            ) : null}
          </p>
        </div>
      </div>

      {doc.status === DOC_STATUS.DRAFT ? (
        <div className="notice warn">
          هذا المستند مسودة. لا يمكن إرساله بأي قناة قبل الضغط على «اعتماد».
          {doc.aiGenerated ? ' وقد ولّده الوكيل الذكي، ويحتاج مراجعتك واعتمادك.' : ''}
        </div>
      ) : null}

      <DocActions
        id={doc.id}
        status={doc.status}
        type={doc.type}
        hasContract={Boolean(doc.contract)}
        hasPdf={Boolean(doc.pdfPath)}
        hasInvoices={doc.invoices.length > 0}
        publicLink={link}
        docusignReady={ds.ready}
        docusignMode={ds.mode}
        docusignMissing={ds.missing}
      />

      <div className="card">
        <h2>الروابط والملفات</h2>
        <p className="muted">الرابط العام غير قابل للتخمين ويفتحه العميل بدون تسجيل دخول.</p>
        <div className="mono" style={{ marginBottom: 8 }}>
          <a href={link} target="_blank" rel="noreferrer">{link}</a>
        </div>
        <div className="row">
          <a className="btn ghost sm" href={`/d/${doc.publicToken}/pdf`} target="_blank" rel="noreferrer">تنزيل PDF</a>
          <a className="btn ghost sm" href={`/d/${doc.publicToken}/docx`}>تنزيل DOCX</a>
          {doc.pdfPath ? <a className="btn ghost sm" href={s.urlFor(doc.pdfPath)}>النسخة المؤرشفة</a> : null}
          {doc.signedPdfPath ? <a className="btn ghost sm" href={s.urlFor(doc.signedPdfPath)}>النسخة الموقّعة</a> : null}
          {doc.certPath ? <a className="btn ghost sm" href={s.urlFor(doc.certPath)}>شهادة الإتمام</a> : null}
        </div>
      </div>

      <div className="grid c2">
        <div className="card">
          <h2>الإجماليات</h2>
          <table>
            <tbody>
              <tr><td>المجموع غير شامل الضريبة</td><td className="num">{fmtMoney(doc.subtotal)}</td></tr>
              <tr><td>ضريبة القيمة المضافة <span dir="ltr">15%</span></td><td className="num">{fmtMoney(doc.vatAmount)}</td></tr>
              <tr><td><b>الإجمالي شامل الضريبة</b></td><td className="num"><b>{fmtMoney(doc.total)}</b></td></tr>
              {isQuote ? <tr><td>صالح حتى</td><td className="num">{fmtDate(doc.validUntil, 'en')}</td></tr> : null}
              {doc.acceptedAt ? (
                <tr><td>قبله العميل</td><td className="num">{doc.acceptedByName} — {fmtDateTime(doc.acceptedAt, 'en')}</td></tr>
              ) : null}
              {doc.signedAt ? <tr><td>وُقّع</td><td className="num">{fmtDateTime(doc.signedAt, 'en')}</td></tr> : null}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2>سجل الإرسال</h2>
          {!doc.deliveries.length ? <p className="muted">لم يُرسَل بعد.</p> : (
            <table>
              <thead><tr><th>القناة</th><th>إلى</th><th>الحالة</th><th className="num">التاريخ</th></tr></thead>
              <tbody>
                {doc.deliveries.map((d) => (
                  <tr key={d.id}>
                    <td>{d.channel}</td>
                    <td dir="ltr" style={{ textAlign: 'left', fontSize: 12 }}>{d.toAddress}</td>
                    <td>{d.status}{d.error ? <div className="muted">{d.error}</div> : null}</td>
                    <td className="num">{fmtDate(d.sentAt, 'en')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {doc.envelopes.length ? (
        <div className="card">
          <h2>ظروف DocuSign</h2>
          <table>
            <thead><tr><th>معرّف الظرف</th><th>الحالة</th><th>الموقّعون</th><th className="num">التوقيع المدمج</th></tr></thead>
            <tbody>
              {doc.envelopes.map((e) => (
                <tr key={e.id}>
                  <td className="mono">{e.envelopeId}{e.demo ? <div className="muted">بيئة تجريبية</div> : null}</td>
                  <td><span className="pill">{ENVELOPE_STATUS_LABEL[e.status]?.ar ?? e.status}</span></td>
                  <td style={{ fontSize: 12 }} dir="ltr">
                    1. {e.clientName} &lt;{e.clientEmail}&gt;<br />2. {e.bpName} &lt;{e.bpEmail}&gt;
                  </td>
                  <td className="num">
                    {e.status !== 'completed' && e.clientClientUserId ? (
                      <>
                        <a className="btn ghost sm" href={`/api/docusign/sign?envelope=${e.id}&who=client`}>توقيع العميل</a>{' '}
                        <a className="btn ghost sm" href={`/api/docusign/sign?envelope=${e.id}&who=bp`}>توقيعي</a>
                      </>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {doc.invoices.length ? (
        <div className="card">
          <h2>جدول الدفعات</h2>
          <table>
            <thead><tr><th className="num">#</th><th>الرقم</th><th>البيان</th><th className="num">الإجمالي</th><th>الحالة</th></tr></thead>
            <tbody>
              {doc.invoices.map((i) => (
                <tr key={i.id}>
                  <td className="num">{i.sequence}</td>
                  <td className="mono">{i.number}</td>
                  <td>{i.titleAr}</td>
                  <td className="num">{fmtMoney(i.total)}</td>
                  <td><span className={`pill st-${i.status}`}>{INVOICE_STATUS_LABEL[i.status]?.ar ?? i.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <JobsPanel
        documentId={doc.id}
        jobs={jobs.map((j) => ({
          id: j.id, kind: j.kind, status: j.status, attempts: j.attempts,
          error: j.error, createdAt: j.createdAt.toISOString(),
        }))}
      />

      <div className="card">
        <h2>الخط الزمني</h2>
        <Timeline events={events} />
      </div>

      <div className="card">
        <h2>المعاينة ثنائية اللغة</h2>
        <p className="muted">هذه المعاينة هي نفسها الصفحة العامة ونفسها مصدر الـPDF.</p>
        <DocumentView d={model} />
      </div>
    </>
  );
}
