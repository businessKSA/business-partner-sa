import Link from 'next/link';
import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Status, DateText, Empty, Money } from '@/components/ui.tsx';
import { can } from '@/lib/rbac.ts';
import { ImportForm } from './import-form.tsx';

export default async function ReconciliationListPage() {
  const session = await requireAuth('treasury.statement.read');
  const canImport = can(session.permissions, 'treasury.statement.import');

  const { statements, banks } = await withTenant(session.tenantId, async (tx) => ({
    statements: await tx.bankStatement.findMany({
      where: { tenantId: session.tenantId },
      include: {
        bankAccount: { select: { nameAr: true, bankName: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { toDate: 'desc' },
      take: 40,
    }),
    banks: await tx.bankAccount.findMany({
      where: { tenantId: session.tenantId, active: true },
      select: { id: true, nameAr: true, bankName: true },
      orderBy: { nameAr: 'asc' },
    }),
  }));

  // عدد السطور غير المفسَّرة لكل كشف — وهي ما يمنع القفل
  const pending = await withTenant(session.tenantId, (tx) =>
    tx.bankStatementLine.groupBy({
      by: ['statementId'],
      where: { tenantId: session.tenantId, status: 'UNMATCHED' },
      _count: { _all: true },
    }),
  );
  const pendingBy = new Map(pending.map((p) => [p.statementId, p._count._all]));

  return (
    <>
      <PageHead
        title="التسوية البنكية"
        sub="التسوية ليست إجبار الرقمين على التساوي، بل تفسير الفرق بينهما بنداً بنداً."
      />

      <div className="content">
        {canImport ? <ImportForm banks={banks} /> : null}

        <Card title="كشوف الحساب" hint={`${statements.length} كشفاً`} flush>
          {statements.length === 0 ? (
            <div style={{ padding: 16 }}>
              <Empty
                title="لا كشوف بعد"
                hint="استورد كشف حسابٍ بصيغة CSV لتبدأ المطابقة."
              />
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>الحساب البنكي</th>
                    <th style={{ width: 130 }}>المرجع</th>
                    <th style={{ width: 110 }}>من</th>
                    <th style={{ width: 110 }}>إلى</th>
                    <th className="num" style={{ width: 140 }}>الرصيد الختامي</th>
                    <th className="num" style={{ width: 80 }}>السطور</th>
                    <th className="num" style={{ width: 100 }}>بلا تفسير</th>
                    <th style={{ width: 120 }}>الحالة</th>
                    <th style={{ width: 90 }} />
                  </tr>
                </thead>
                <tbody>
                  {statements.map((s) => {
                    const open = pendingBy.get(s.id) ?? 0;
                    return (
                      <tr key={s.id}>
                        <td>
                          {s.bankAccount.nameAr}
                          {s.bankAccount.bankName ? (
                            <div className="small muted">{s.bankAccount.bankName}</div>
                          ) : null}
                        </td>
                        <td className="mono small">{s.reference ?? '—'}</td>
                        <td><DateText value={s.fromDate} /></td>
                        <td><DateText value={s.toDate} /></td>
                        <td className="num"><Money value={s.closingBalance} /></td>
                        <td className="num">{s._count.lines}</td>
                        <td className="num">
                          {open > 0 ? <span className="neg">{open}</span> : '—'}
                        </td>
                        <td><Status value={s.status} /></td>
                        <td>
                          <Link className="btn sm" href={`/treasury/reconciliation/${s.id}`}>
                            فتح
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
