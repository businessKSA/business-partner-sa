import Link from 'next/link';
import { prisma } from '@/lib/db';
import { fmtMoney, fmtDate, round2 } from '@/lib/money';
import { timelineFor } from '@/lib/timeline';
import { Timeline, Kpi } from '@/components/ui';
import { SUPPLY_STATUS_LABEL } from '@/lib/enums';
import { categoryLabel, resalePrice, rfpUrl, type ExtractedLine } from '@/lib/sourcing';
import SourcingTools from './SourcingTools';

/**
 * شاشة طلب التوريد بوضع إعادة البيع.
 *
 * ما فيها لا يخرج منها: تكلفة المورد، وهامشنا، واسم من نشتري منه. والعميل
 * يرى مستنداً واحداً باسمنا بسعرٍ واحد — وهذه الشاشة هي المكان الوحيد الذي
 * يُقارَن فيه ما دفعنا بما نبيع.
 *
 * والمراحل والمحفظة ليست هنا: في إعادة البيع لا مال أمانة يُصرف بمراحل،
 * بل فاتورة منّا للعميل وشراءٌ منّا للمورد. عرضُ أدوات الوضع الثلاثي هنا
 * يدعو إلى عملٍ لا معنى له في هذا الوضع.
 */
export default async function ResaleView({ requestId }: { requestId: string }) {
  const req = await prisma.supplyRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: {
      client: true,
      bids: { include: { supplier: true }, orderBy: { amount: 'asc' } },
      rfps: { include: { supplier: true }, orderBy: { createdAt: 'asc' } },
      documents: true,
    },
  });

  const [suppliers, events] = await Promise.all([
    prisma.supplier.findMany({
      where: { active: true, email: { not: null } },
      orderBy: { nameAr: 'asc' },
      select: { id: true, nameAr: true, categories: true, city: true, email: true },
    }),
    timelineFor('supply_request', requestId),
  ]);

  const selected = req.bids.find((b) => b.id === req.selectedBidId) ?? null;
  const cheapest = req.bids[0] ?? null;
  const quote = req.documents.find((d) => d.type === 'QUOTE') ?? null;
  const markupLabel = `${Math.round(req.markupPct * 100)}%`;

  const asked = req.rfps.filter((r) => r.sentAt).length;
  const answered = req.rfps.filter((r) => r.bidId).length;

  const lineCount = (json: string | null) => {
    if (!json) return 0;
    try {
      const p = JSON.parse(json) as ExtractedLine[];
      return Array.isArray(p) ? p.length : 0;
    } catch {
      return 0;
    }
  };

  return (
    <>
      <h1>
        {req.number}{' '}
        <span className="pill">{SUPPLY_STATUS_LABEL[req.status]?.ar ?? req.status}</span>{' '}
        <span className="pill">إعادة بيع</span>
      </h1>
      <p className="sub">
        {req.titleAr} —{' '}
        <Link href={`/admin/clients/${req.clientId}`}>
          {req.client.companyAr || req.client.nameAr}
        </Link>
      </p>

      <div className="grid c4" style={{ marginBottom: 18 }}>
        <Kpi label="موردون سُئلوا" value={String(asked)} unit={`ردّ ${answered}`} />
        <Kpi label="أقل تكلفة وصلتنا" value={cheapest ? fmtMoney(cheapest.amount) : '—'} unit="ريال" />
        <Kpi
          label="سعر البيع بهامش"
          value={selected ? fmtMoney(resalePrice(selected.amount, req.markupPct)) : '—'}
          unit={`ريال — هامش ${markupLabel}`}
        />
        <Kpi
          label="ربحنا من الصفقة"
          value={selected ? fmtMoney(round2(resalePrice(selected.amount, req.markupPct) - selected.amount)) : '—'}
          unit="ريال قبل الضريبة"
        />
      </div>

      <div className="card">
        <h2>طلب العميل كما كتبه</h2>
        <p style={{ whiteSpace: 'pre-line' }}>{req.intakeAr || req.scopeAr || '—'}</p>
        {req.serviceCode ? (
          <p className="muted">
            الخدمة: <span dir="ltr">{req.serviceCode}</span>
          </p>
        ) : null}
      </div>

      <SourcingTools.Dispatch
        requestId={req.id}
        suppliers={suppliers.map((s) => ({
          id: s.id,
          nameAr: s.nameAr,
          city: s.city,
          cats: String(s.categories || '')
            .split(',')
            .map((c) => c.trim().toLowerCase())
            .filter(Boolean),
        }))}
        alreadySent={req.rfps.filter((r) => r.sentAt).map((r) => r.supplierId)}
      />

      <div className="card">
        <h2>حال طلبات العروض</h2>
        {!req.rfps.length ? (
          <p className="muted">لم يُرسل طلب عرض بعد.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>المورد</th>
                <th>أُرسل</th>
                <th>فتح</th>
                <th>الحال</th>
                <th>رابطه</th>
              </tr>
            </thead>
            <tbody>
              {req.rfps.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.supplier.nameAr}
                    {r.supplier.categories ? (
                      <div className="muted">
                        {String(r.supplier.categories)
                          .split(',')
                          .map((c) => categoryLabel(c.trim().toLowerCase()))
                          .filter(Boolean)
                          .join('، ')}
                      </div>
                    ) : null}
                  </td>
                  <td>{r.sentAt ? fmtDate(r.sentAt, 'en') : <span className="muted">لم يُرسل</span>}</td>
                  <td>{r.openedAt ? fmtDate(r.openedAt, 'en') : <span className="muted">لم يفتح</span>}</td>
                  <td>
                    {r.bidId ? (
                      <span className="pill st-ACCEPTED">قدّم عرضه</span>
                    ) : r.declinedAt ? (
                      <span className="pill st-DRAFT">اعتذر</span>
                    ) : r.expiresAt && r.expiresAt.getTime() < Date.now() ? (
                      <span className="pill st-DRAFT">انتهت المدة</span>
                    ) : (
                      <span className="pill st-SIGNING">بانتظار ردّه</span>
                    )}
                  </td>
                  <td>
                    <SourcingTools.CopyLink url={rfpUrl(r.token)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>العروض الواصلة — مقارنة</h2>
        <p className="muted">
          التكلفة وسعر البيع هنا لنا وحدنا. ولا يظهر في مستند العميل إلا سعر بيع واحد بلا ذكر
          المورد ولا سطر باسم رسوم إدارية.
        </p>
        {!req.bids.length ? (
          <p className="muted">لم يصل عرض بعد.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>المورد</th>
                <th className="num">تكلفته لنا</th>
                <th className="num">بيعنا بهامش {markupLabel}</th>
                <th>مدة التنفيذ</th>
                <th>مستنده</th>
                <th className="num">الإجراء</th>
              </tr>
            </thead>
            <tbody>
              {req.bids.map((b) => {
                const lines = lineCount(b.extractedJson);
                return (
                  <tr key={b.id} style={b.id === req.selectedBidId ? { background: '#E7F5EC' } : undefined}>
                    <td>
                      {b.supplier.nameAr}
                      {b.notesAr ? (
                        <div className="muted" style={{ whiteSpace: 'pre-line' }}>{b.notesAr}</div>
                      ) : null}
                    </td>
                    <td className="num">{fmtMoney(b.amount)}</td>
                    <td className="num">{fmtMoney(resalePrice(b.amount, req.markupPct))}</td>
                    <td>{b.deliveryAr ?? '—'}</td>
                    <td>
                      {!b.filePath ? (
                        <span className="muted">بلا مرفق</span>
                      ) : lines ? (
                        <span className="pill st-ACCEPTED">{lines} بند مستخرج</span>
                      ) : b.extractedRaw ? (
                        <span className="pill st-DRAFT">قُرئ بلا بنود</span>
                      ) : (
                        <span className="muted">لم يُقرأ</span>
                      )}
                    </td>
                    <td className="num">
                      <SourcingTools.BidButtons
                        requestId={req.id}
                        bidId={b.id}
                        hasFile={Boolean(b.filePath)}
                        isSelected={req.selectedBidId === b.id}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>عرض السعر للعميل</h2>
        {quote ? (
          <p>
            بُني العرض <Link href={`/admin/documents/${quote.id}`}>{quote.number}</Link> — راجعه ثم
            اعتمده وأرسله من صفحته.
          </p>
        ) : !selected ? (
          <p className="muted">اختر عرض مورد أولاً، ثم يُبنى عرض العميل منه.</p>
        ) : (
          <>
            <p className="muted">
              يُبنى من البنود المستخرجة بعد تنقيتها. وبلا بنود مستخرجة يُبنى ببند واحد بقيمة
              الطلب كاملة — لا ببنود تُخترع.
            </p>
            <SourcingTools.BuildQuote requestId={req.id} />
          </>
        )}
      </div>

      <div className="card">
        <h2>الخط الزمني</h2>
        <Timeline events={events} />
      </div>
    </>
  );
}
