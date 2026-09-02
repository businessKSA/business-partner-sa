import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Money, Empty } from '@/components/ui.tsx';
import { trialBalance } from '@/lib/accounting/reports.ts';
import Link from 'next/link';

const TYPE_AR: Record<string, string> = {
  ASSET: 'أصول', LIABILITY: 'خصوم', EQUITY: 'حقوق ملكية',
  REVENUE: 'إيرادات', EXPENSE: 'مصروفات',
};

export default async function AccountsPage() {
  const session = await requireAuth('accounting.account.read');
  const year = new Date().getUTCFullYear();

  const { accounts, balances } = await withTenant(session.tenantId, async (tx) => {
    const accounts = await tx.account.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { code: 'asc' },
    });
    const tb = await trialBalance(
      tx, session.tenantId,
      new Date(Date.UTC(1970, 0, 1)), new Date(Date.UTC(year, 11, 31)),
      { includeZero: true },
    );
    const balances = new Map(
      tb.rows.map((r) => [r.accountId, r.closingDebit.minus(r.closingCredit)]),
    );
    return { accounts, balances };
  });

  return (
    <>
      <PageHead
        title="شجرة الحسابات"
        sub={`${accounts.length} حساباً — الأرصدة حتى نهاية ${year}`}
      />

      <div className="content">
        <Card
          title="الحسابات"
          hint="الحساب التجميعي يجمع أبناءه ولا يقبل قيداً. والحسابات ذات الدور الوظيفي يعتمد عليها الترحيل التلقائي فلا تُحذف."
          flush
        >
          {accounts.length === 0 ? (
            <Empty title="لا حسابات" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>الرمز</th>
                    <th>الاسم</th>
                    <th style={{ width: 110 }}>النوع</th>
                    <th style={{ width: 160 }}>الدور الوظيفي</th>
                    <th className="num" style={{ width: 150 }}>الرصيد</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => {
                    const depth = a.code.length <= 1 ? 0 : a.code.length <= 2 ? 1 : 2;
                    const bal = balances.get(a.id);
                    return (
                      <tr key={a.id} className={a.isGroup ? 'row-group' : undefined}>
                        <td className="mono">{a.code}</td>
                        <td className={depth ? `tree-indent-${depth}` : undefined}>
                          {a.isGroup ? a.nameAr : (
                            <Link href={`/accounting/ledger/${a.id}`}>{a.nameAr}</Link>
                          )}
                          {!a.active ? <span className="badge mute" style={{ marginInlineStart: 6 }}>مقفل</span> : null}
                          {a.isSystem ? <span className="badge info" style={{ marginInlineStart: 6 }}>نظام</span> : null}
                          <div className="muted small">{a.nameEn}</div>
                        </td>
                        <td>{TYPE_AR[a.type]}</td>
                        <td className="mono small muted">{a.subtype ?? '—'}</td>
                        <td className="num">
                          {a.isGroup ? <span className="muted">—</span> : <Money value={bal ?? 0} colored />}
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
