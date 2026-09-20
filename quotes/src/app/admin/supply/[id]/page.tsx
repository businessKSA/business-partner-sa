import Link from 'next/link';
import { notFound } from 'next/navigation';
import { guardAdmin } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { fmtMoney, fmtDate } from '@/lib/money';
import { walletSummary } from '@/lib/billing';
import { timelineFor } from '@/lib/timeline';
import { Timeline, Kpi } from '@/components/ui';
import { SUPPLY_STATUS_LABEL } from '@/lib/enums';
import SupplyTools from './SupplyTools';
import ResaleView from './ResaleView';

export const dynamic = 'force-dynamic';

export default async function SupplyPage({ params }: { params: Promise<{ id: string }> }) {
  await guardAdmin();
  const { id } = await params;

  // الوضعان شاشتان لا شاشة بشرطين: أدوات الأمانة والمراحل لا معنى لها في
  // إعادة البيع، وتكلفة المورد وهامشنا لا معنى لهما في الثلاثي.
  const head = await prisma.supplyRequest.findUnique({ where: { id }, select: { mode: true } });
  if (!head) notFound();
  if (head.mode === 'RESALE') return <ResaleView requestId={id} />;

  const req = await prisma.supplyRequest.findUnique({
    where: { id },
    include: {
      client: true,
      bids: { include: { supplier: true }, orderBy: { amount: 'asc' } },
      milestones: { orderBy: { sortOrder: 'asc' } },
      documents: true,
    },
  });
  if (!req) notFound();

  const [suppliers, wallet, events] = await Promise.all([
    prisma.supplier.findMany({ where: { active: true }, orderBy: { nameAr: 'asc' } }),
    walletSummary(req.clientId),
    timelineFor('supply_request', id),
  ]);

  const agreement = req.documents.find((d) => d.type === 'SUPPLY_AGREEMENT');
  const milestoneTotal = req.milestones.reduce((a, m) => a + m.amount, 0);

  return (
    <>
      <h1>
        {req.number} <span className="pill">{SUPPLY_STATUS_LABEL[req.status]?.ar ?? req.status}</span>
      </h1>
      <p className="sub">
        {req.titleAr} — <Link href={`/admin/clients/${req.clientId}`}>{req.client.companyAr || req.client.nameAr}</Link>
      </p>

      <div className="grid c4" style={{ marginBottom: 18 }}>
        <Kpi label="رصيد عهدة العميل المتاح" value={fmtMoney(wallet.custodyBalance)} unit="ريال" />
        <Kpi label="قيمة المورد المختار" value={fmtMoney(req.bids.find((b) => b.id === req.selectedBidId)?.amount ?? 0)} unit="ريال" />
        <Kpi label="إجمالي المراحل" value={fmtMoney(milestoneTotal)} unit="ريال" />
        <Kpi label="أتعاب التنسيق" value={fmtMoney(req.coordinationFee)} unit="ريال" />
      </div>

      {req.scopeAr ? (
        <div className="card">
          <h2>النطاق</h2>
          <p style={{ whiteSpace: 'pre-line' }}>{req.scopeAr}</p>
          {req.scopeEn ? <p className="muted" dir="ltr" style={{ textAlign: 'left', whiteSpace: 'pre-line' }}>{req.scopeEn}</p> : null}
        </div>
      ) : null}

      <div className="card">
        <h2>عروض الموردين — مقارنة</h2>
        {!req.bids.length ? <p className="muted">لم تُسجَّل عروض بعد.</p> : (
          <table>
            <thead>
              <tr><th>المورد</th><th className="num">المبلغ</th><th className="num">شامل الضريبة</th><th>مدة التنفيذ</th><th>الحالة</th><th className="num">الاختيار</th></tr>
            </thead>
            <tbody>
              {req.bids.map((b) => (
                <tr key={b.id} style={b.id === req.selectedBidId ? { background: '#E7F5EC' } : undefined}>
                  <td>{b.supplier.nameAr}</td>
                  <td className="num">{fmtMoney(b.amount)}</td>
                  <td className="num">{fmtMoney(b.amount * (1 + b.vatRate))}</td>
                  <td>{b.deliveryAr ?? '—'}</td>
                  <td><span className="pill">{b.status}</span></td>
                  <td className="num">
                    {req.selectedBidId === b.id ? <b>مختار</b> : <SupplyTools.SelectButton requestId={req.id} bidId={b.id} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <SupplyTools
        requestId={req.id}
        status={req.status}
        hasSelected={Boolean(req.selectedBidId)}
        hasAgreement={Boolean(agreement)}
        agreementId={agreement?.id ?? null}
        agreementNumber={agreement?.number ?? null}
        hasMilestones={req.milestones.length > 0}
        suppliers={suppliers.map((s) => ({ id: s.id, label: `${s.nameAr}${s.crNumber ? ` — ${s.crNumber}` : ''}` }))}
      />

      <div className="card">
        <h2>مراحل الإنجاز والصرف</h2>
        <p className="muted">لا يُصرف لأي مورد إلا بعد اعتمادك للمرحلة، والصرف يخصم من محفظة العميل ويُسجَّل في سجل التدقيق.</p>
        {!req.milestones.length ? <p className="muted">لم تُحدَّد مراحل بعد.</p> : (
          <table>
            <thead><tr><th>المرحلة</th><th className="num">المبلغ</th><th>الحالة</th><th className="num">الإجراء</th></tr></thead>
            <tbody>
              {req.milestones.map((m) => (
                <tr key={m.id}>
                  <td>{m.titleAr}<div className="muted" dir="ltr" style={{ textAlign: 'left' }}>{m.titleEn}</div></td>
                  <td className="num">{fmtMoney(m.amount)}</td>
                  <td>
                    <span className={`pill ${m.status === 'PAID' ? 'st-ACCEPTED' : m.status === 'APPROVED' ? 'st-SIGNING' : 'st-DRAFT'}`}>
                      {m.status === 'PAID' ? 'مصروفة' : m.status === 'APPROVED' ? 'معتمدة' : 'بانتظار الاعتماد'}
                    </span>
                    {m.paidAt ? <div className="muted">{fmtDate(m.paidAt, 'en')}</div> : null}
                  </td>
                  <td className="num">
                    <SupplyTools.MilestoneButtons milestoneId={m.id} requestId={req.id} status={m.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>الخط الزمني</h2>
        <Timeline events={events} />
      </div>
    </>
  );
}
