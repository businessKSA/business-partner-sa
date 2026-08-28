import Link from 'next/link';
import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { generalLedger } from '@/lib/accounting/reports.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Money, Empty, Kpi } from '@/components/ui.tsx';
import { Decimal } from '@/lib/money.ts';

export default async function BanksPage() {
  const session = await requireAuth('treasury.payment.read');
  const year = new Date().getUTCFullYear();
  const from = new Date(Date.UTC(1970, 0, 1));
  const to = new Date();

  const rows = await withTenant(session.tenantId, async (tx) => {
    const accounts = await tx.bankAccount.findMany({
      where: { tenantId: session.tenantId },
      include: { account: { select: { id: true, code: true, nameAr: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return Promise.all(accounts.map(async (b) => {
      const gl = await generalLedger(tx, session.tenantId, b.accountId, from, to);
      return { bank: b, balance: gl.closing, movements: gl.movements.length };
    }));
  });

  const total = rows.reduce((s, r) => s.plus(r.balance), new Decimal(0));

  return (
    <>
      <PageHead title="الحسابات البنكية والصناديق" sub={`${rows.length} حساباً`} />

      <div className="content">
        <div className="kpis">
          <Kpi label="إجمالي النقد المتاح" value={<Money value={total} currency="ر.س" />} />
        </div>

        <Card flush>
          {rows.length === 0 ? (
            <Empty title="لا حسابات" hint="أضِف حساباً بنكياً لتسجّل عليه السندات." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>الحساب</th>
                    <th style={{ width: 90 }}>النوع</th>
                    <th style={{ width: 200 }}>الآيبان</th>
                    <th style={{ width: 90 }}>العملة</th>
                    <th className="num" style={{ width: 80 }}>الحركات</th>
                    <th className="num" style={{ width: 150 }}>الرصيد</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ bank, balance, movements }) => (
                    <tr key={bank.id}>
                      <td>
                        <Link href={`/accounting/ledger/${bank.accountId}`}>{bank.nameAr}</Link>
                        <div className="muted small">
                          {bank.bankName ?? ''} · حساب {bank.account.code}
                        </div>
                      </td>
                      <td>
                        <span className="badge mute">{bank.kind === 'CASH' ? 'صندوق' : 'بنك'}</span>
                      </td>
                      <td className="mono small">{bank.iban ?? <span className="muted">—</span>}</td>
                      <td className="mono">{bank.currency}</td>
                      <td className="num">{movements}</td>
                      <td className="num"><Money value={balance} colored /></td>
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
