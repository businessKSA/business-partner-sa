import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { auditLedgerIntegrity } from '@/lib/accounting/posting.ts';
import { reconcileStock } from '@/lib/inventory/costing.ts';
import { balanceSheet } from '@/lib/accounting/reports.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Money, Alert, Empty } from '@/components/ui.tsx';

/**
 * سجل التدقيق وفحص السلامة.
 *
 * ما يعرضه ليس «من فعل ماذا» فحسب، بل جواب أربعة أسئلة لا يجيب عنها أي
 * تقرير مالي — لأنها أسئلةٌ عن التقارير نفسها.
 */
export default async function AuditPage() {
  const session = await requireAuth('admin.audit.read');
  const now = new Date();
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

  const data = await withTenant(session.tenantId, async (tx) => {
    const [ledger, stock, bs] = await Promise.all([
      auditLedgerIntegrity(tx, session.tenantId),
      reconcileStock(tx, session.tenantId),
      balanceSheet(tx, session.tenantId, now, yearStart),
    ]);

    const negativeLiabilities = await tx.$queryRaw<
      { code: string; nameAr: string; balance: string }[]
    >`
      SELECT a."code", a."nameAr",
             (COALESCE(SUM(l."credit"),0) - COALESCE(SUM(l."debit"),0))::text AS balance
      FROM "Account" a
      JOIN "JournalLine" l ON l."accountId" = a."id"
      JOIN "JournalEntry" e ON e."id" = l."entryId"
      WHERE a."tenantId" = ${session.tenantId}
        AND a."type" = 'LIABILITY'
        AND e."status" IN ('POSTED','REVERSED')
      GROUP BY a."id", a."code", a."nameAr"
      HAVING (COALESCE(SUM(l."credit"),0) - COALESCE(SUM(l."debit"),0)) < 0
    `;

    const logs = await tx.auditLog.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { seq: 'desc' },
      take: 100,
    });

    return { ledger, stock, bs, negativeLiabilities, logs };
  });

  const checks = [
    {
      label: 'المركز المالي يتوازن',
      ok: data.bs.balanced,
      detail: data.bs.balanced ? 'الأصول = الخصوم + حقوق الملكية' : `فارق ${data.bs.difference.toFixed(2)} ريالاً`,
    },
    {
      label: 'كل قيد متزن في سطوره',
      ok: data.ledger.length === 0,
      detail: data.ledger.length === 0 ? 'لا قيد مختلّ' : `${data.ledger.length} قيداً غير متزن`,
    },
    {
      label: 'أرصدة المخزون تطابق حركاته',
      ok: data.stock.length === 0,
      detail: data.stock.length === 0 ? 'لا انحراف' : `${data.stock.length} صنفاً منحرفاً`,
    },
    {
      label: 'لا حساب خصوم برصيد مدين',
      ok: data.negativeLiabilities.length === 0,
      detail: data.negativeLiabilities.length === 0
        ? 'الترتيب سليم'
        : `${data.negativeLiabilities.length} حساباً — علامة صرفٍ سبق استحقاقه`,
    },
  ];

  const failed = checks.filter((c) => !c.ok);

  return (
    <>
      <PageHead title="سجل التدقيق وفحص السلامة" sub={now.toISOString().slice(0, 10)} />

      <div className="content">
        {failed.length === 0 ? (
          <Alert kind="ok" title="الدفاتر سليمة">
            اجتازت الفحوص الأربعة كلها.
          </Alert>
        ) : (
          <Alert kind="error" title={`${failed.length} فحصاً لم يجتز`}>
            راجِعها قبل أي إقفال أو تقديم إقرار.
          </Alert>
        )}

        <Card title="فحوص السلامة" flush>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>الفحص</th><th style={{ width: 120 }}>النتيجة</th><th>التفصيل</th></tr>
              </thead>
              <tbody>
                {checks.map((c) => (
                  <tr key={c.label}>
                    <td>{c.label}</td>
                    <td>
                      <span className={`badge ${c.ok ? 'ok' : 'bad'}`}>
                        {c.ok ? 'اجتاز' : 'لم يجتز'}
                      </span>
                    </td>
                    <td className="small muted">{c.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {data.ledger.length > 0 ? (
          <Card title="قيود غير متزنة" flush>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>القيد</th><th className="num">مدين</th><th className="num">دائن</th><th className="num">الفرق</th></tr>
                </thead>
                <tbody>
                  {data.ledger.map((e) => (
                    <tr key={e.entryId}>
                      <td className="mono">{e.number}</td>
                      <td className="num">{e.debit}</td>
                      <td className="num">{e.credit}</td>
                      <td className="num neg">{e.difference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}

        <Card
          title="سجل الأحداث"
          hint="مسلسل بسلسلة تجزئة: كل صف يحمل تجزئة سابقه، فالتلاعب بصفٍّ قديم يكسر السلسلة ويُكشف."
          flush
        >
          {data.logs.length === 0 ? (
            <Empty title="لا أحداث مسجَّلة بعد" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="num" style={{ width: 70 }}>#</th>
                    <th style={{ width: 170 }}>الحدث</th>
                    <th style={{ width: 150 }}>الكيان</th>
                    <th>المستخدم</th>
                    <th className="num" style={{ width: 130 }}>المبلغ</th>
                    <th style={{ width: 150 }}>الوقت</th>
                  </tr>
                </thead>
                <tbody>
                  {data.logs.map((l) => (
                    <tr key={l.id}>
                      <td className="num">{String(l.seq)}</td>
                      <td className="mono small">{l.action}</td>
                      <td className="small">{l.entityType}</td>
                      <td className="small">{l.actorEmail ?? '—'}</td>
                      <td className="num">{l.amount ? <Money value={l.amount} /> : '—'}</td>
                      <td className="mono small">
                        {l.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
