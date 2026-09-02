import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Money, Status, DateText, Alert } from '@/components/ui.tsx';
import { PrintButton } from '@/components/print-button.tsx';
import { ReverseButton } from './reverse-button.tsx';
import { can } from '@/lib/rbac.ts';

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth('accounting.journal.read');
  const { id } = await params;

  const entry = await withTenant(session.tenantId, (tx) =>
    tx.journalEntry.findFirst({
      where: { id, tenantId: session.tenantId },
      include: {
        lines: {
          include: {
            account: { select: { code: true, nameAr: true, id: true } },
            partner: { select: { nameAr: true } },
            costCenter: { select: { nameAr: true } },
            project: { select: { nameAr: true } },
          },
          orderBy: { sortOrder: 'asc' },
        },
        period: { select: { name: true, status: true } },
        reversalOf: { select: { id: true, number: true } },
        reversedBy: { select: { id: true, number: true } },
      },
    }),
  );

  if (!entry) notFound();

  const canReverse =
    can(session.permissions, 'accounting.journal.reverse') &&
    entry.status === 'POSTED' &&
    !entry.reversedBy;

  return (
    <>
      <PageHead
        title={`قيد ${entry.number}`}
        sub={entry.memoAr ?? undefined}
        actions={
          <>
            <PrintButton />
            {canReverse ? <ReverseButton entryId={entry.id} number={entry.number} /> : null}
          </>
        }
      />

      <div className="content">
        {entry.reversedBy ? (
          <Alert kind="warn" title="هذا القيد معكوس">
            عُكس بالقيد{' '}
            <Link href={`/accounting/journal/${entry.reversedBy.id}`}>{entry.reversedBy.number}</Link>.
            الأصل يبقى في الدفتر ومعه عاكسه، فتُقرأ القصّة كاملة.
          </Alert>
        ) : null}

        {entry.reversalOf ? (
          <Alert kind="info" title="هذا قيدٌ عاكس">
            يعكس القيد{' '}
            <Link href={`/accounting/journal/${entry.reversalOf.id}`}>{entry.reversalOf.number}</Link>.
          </Alert>
        ) : null}

        <div className="grid-4" style={{ marginBottom: 16 }}>
          <Card><div className="small muted">التاريخ</div><div><DateText value={entry.date} /></div></Card>
          <Card><div className="small muted">الحالة</div><div><Status value={entry.status} /></div></Card>
          <Card>
            <div className="small muted">الفترة</div>
            <div>
              {entry.period?.name ?? '—'}
              {entry.period?.status === 'CLOSED'
                ? <span className="badge mute" style={{ marginInlineStart: 6 }}>مقفلة</span> : null}
            </div>
          </Card>
          <Card><div className="small muted">المرجع</div><div className="mono">{entry.ref ?? '—'}</div></Card>
        </div>

        <Card title="السطور" flush>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 80 }}>الرمز</th>
                  <th>الحساب</th>
                  <th>البيان</th>
                  <th>الأبعاد</th>
                  <th className="num" style={{ width: 140 }}>مدين</th>
                  <th className="num" style={{ width: 140 }}>دائن</th>
                </tr>
              </thead>
              <tbody>
                {entry.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="mono">{l.account.code}</td>
                    <td>
                      <Link href={`/accounting/ledger/${l.account.id}`}>{l.account.nameAr}</Link>
                    </td>
                    <td>{l.descAr ?? <span className="muted">—</span>}</td>
                    <td className="small muted">
                      {[l.partner?.nameAr, l.costCenter?.nameAr, l.project?.nameAr]
                        .filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="num">{l.debit.toString() === '0' ? '' : <Money value={l.debit} />}</td>
                    <td className="num">{l.credit.toString() === '0' ? '' : <Money value={l.credit} />}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>الإجمالي</td>
                  <td className="num"><Money value={entry.totalDebit} /></td>
                  <td className="num"><Money value={entry.totalCredit} /></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        <p className="muted small">
          أنشأه {entry.createdBy ?? 'النظام'}
          {entry.postedAt ? ` · رُحِّل في ${entry.postedAt.toISOString().slice(0, 16).replace('T', ' ')}` : ''}
        </p>
      </div>
    </>
  );
}
