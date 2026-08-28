import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, Status, DateText, Money, Kpi, Alert, Empty } from '@/components/ui.tsx';
import { can } from '@/lib/rbac.ts';
import { DomainError } from '@/lib/errors.ts';
import {
  suggestMatches, reconciliationReport, AUTO_MATCH_THRESHOLD,
} from '@/lib/treasury/reconciliation.ts';
import { AutoMatchButton, LineMatch, UnmatchButton, FinalizeButton } from './match-actions.tsx';

export default async function StatementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAuth('treasury.statement.read');
  const canMatch = can(session.permissions, 'treasury.statement.match');
  const canFinalize = can(session.permissions, 'treasury.statement.finalize');
  const { id } = await params;

  const data = await withTenant(session.tenantId, async (tx) => {
    try {
      const report = await reconciliationReport(tx, session.tenantId, id);
      const { suggestions } = await suggestMatches(tx, session.tenantId, id);
      const matchedLines = report.statement.lines.filter((l) => l.status === 'MATCHED');

      // القيود المقابلة للسطور المطابَقة — لتُعرض بجانبها لا كمعرّفات
      const journalLineIds = matchedLines.map((l) => l.journalLineId!).filter(Boolean);
      const ledger = journalLineIds.length
        ? await tx.journalLine.findMany({
            where: { tenantId: session.tenantId, id: { in: journalLineIds } },
            include: { entry: { select: { number: true, date: true, memoAr: true } } },
          })
        : [];

      const counterAccounts = await tx.account.findMany({
        where: { tenantId: session.tenantId, isGroup: false, active: true, allowManual: true },
        select: { id: true, code: true, nameAr: true, subtype: true },
        orderBy: { code: 'asc' },
      });

      return { report, suggestions, ledger, counterAccounts };
    } catch (e) {
      if (e instanceof DomainError && e.code === 'NOT_FOUND') return null;
      throw e;
    }
  });

  if (!data) notFound();

  const { report, suggestions, ledger, counterAccounts } = data;
  const statement = report.statement;
  const ledgerById = new Map(ledger.map((l) => [l.id, l]));
  const suggestionByLine = new Map(suggestions.map((s) => [s.lineId, s]));
  const done = statement.status === 'RECONCILED';

  // الرسوم والفوائد أشيع قيود التسوية، فتُقدَّم في القائمة
  const suggestedCounters = counterAccounts.filter((a) =>
    ['BANK_CHARGES', 'OTHER_INCOME', 'FX_DIFFERENCE'].includes(a.subtype ?? ''),
  );

  return (
    <>
      <PageHead
        title={`تسوية ${statement.bankAccount.nameAr}`}
        sub={`${statement.fromDate.toISOString().slice(0, 10)} إلى ${statement.toDate.toISOString().slice(0, 10)}${statement.reference ? ` · ${statement.reference}` : ''}`}
        actions={
          <>
            <Status value={statement.status} />
            <Link className="btn sm" href="/treasury/reconciliation">رجوع</Link>
          </>
        }
      />

      <div className="content">
        <div className="kpis">
          <Kpi label="رصيد البنك" value={<Money value={report.bankBalance} />} note="ختامي الكشف" />
          <Kpi label="رصيد الدفتر" value={<Money value={report.bookBalance} />} note="حتى تاريخ الكشف" />
          <Kpi
            label="معلَّق في الدفتر"
            value={<Money value={report.outstandingLedger} colored />}
            note="قُيِّد ولم يظهر في الكشف"
          />
          <Kpi
            label="غير مقيَّد"
            value={<Money value={report.unrecordedStatement} colored />}
            note="ظهر في الكشف ولم يُقيَّد"
          />
        </div>

        <Card title="معادلة التسوية">
          <div className="table-wrap">
            <table>
              <tbody>
                <tr>
                  <td>رصيد البنك الختامي</td>
                  <td className="num" style={{ width: 160 }}><Money value={report.bankBalance} /></td>
                </tr>
                <tr>
                  <td>زائداً ما في الدفتر ولم يظهر في الكشف</td>
                  <td className="num"><Money value={report.outstandingLedger} colored /></td>
                </tr>
                <tr>
                  <td>ناقصاً ما في الكشف ولم يُقيَّد</td>
                  <td className="num"><Money value={report.unrecordedStatement} colored /></td>
                </tr>
                <tr>
                  <td><strong>الرصيد المعدَّل</strong></td>
                  <td className="num"><strong><Money value={report.adjustedBank} /></strong></td>
                </tr>
                <tr>
                  <td><strong>رصيد الدفتر</strong></td>
                  <td className="num"><strong><Money value={report.bookBalance} /></strong></td>
                </tr>
                <tr>
                  <td><strong>الفرق غير المفسَّر</strong></td>
                  <td className="num">
                    <strong><Money value={report.difference} colored /></strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {report.explained ? (
            <Alert kind="ok" title="كل ريال في الفرق له تفسير">
              الرصيدان يفترقان بمقدارٍ تفسّره البنود المعلّقة تماماً.
              {report.unmatchedStatement.length > 0
                ? ' يبقى في الكشف بنودٌ لم تُقيَّد بعد — لا يُقفَل الكشف قبل تفسيرها.'
                : ''}
            </Alert>
          ) : (
            <Alert kind="error" title="فرقٌ لا يفسّره شيء">
              <Money value={report.difference} /> — راجِع البنود المعلّقة، فربّما
              سطرٌ في الدفتر بتاريخٍ خارج مدى الكشف أو قيدٌ مكرَّر.
            </Alert>
          )}
        </Card>

        {!done && canMatch ? (
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <AutoMatchButton statementId={statement.id} />
            {canFinalize ? (
              <FinalizeButton
                statementId={statement.id}
                blocked={report.unmatchedStatement.length > 0 || !report.explained}
              />
            ) : null}
            <span className="small muted" style={{ alignSelf: 'center' }}>
              المطابقة الآلية تأخذ ما بلغت ثقتُه {AUTO_MATCH_THRESHOLD} فأكثر
              <strong> وكان متفرّداً</strong>؛ المتعادلان يبقيان لك.
            </span>
          </div>
        ) : null}

        <Card
          title="سطور الكشف"
          hint={`${report.matchedCount} مطابَقاً من ${report.totalLines}`}
          flush
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 105 }}>التاريخ</th>
                  <th>الوصف</th>
                  <th className="num" style={{ width: 130 }}>المبلغ</th>
                  <th style={{ width: 110 }}>الحالة</th>
                  <th>المقابل في الدفتر</th>
                  {canMatch && !done ? <th style={{ width: 240 }} /> : null}
                </tr>
              </thead>
              <tbody>
                {statement.lines.map((line) => {
                  const sug = suggestionByLine.get(line.id);
                  const matched = line.journalLineId ? ledgerById.get(line.journalLineId) : null;

                  return (
                    <tr key={line.id}>
                      <td><DateText value={line.valueDate} /></td>
                      <td>
                        {line.descRaw}
                        {line.reference ? (
                          <div className="small muted mono">{line.reference}</div>
                        ) : null}
                      </td>
                      <td className="num"><Money value={line.amount} colored /></td>
                      <td>
                        <Status value={line.status} />
                        {line.matchScore != null ? (
                          <div className="small muted">ثقة {line.matchScore}٪</div>
                        ) : null}
                      </td>
                      <td className="small">
                        {matched ? (
                          <>
                            <span className="mono">{matched.entry.number}</span>{' '}
                            {matched.descAr ?? matched.entry.memoAr ?? ''}
                            {line.adjustmentEntryId ? (
                              <div className="muted">قيد تسوية أُنشئ لهذا السطر</div>
                            ) : null}
                          </>
                        ) : sug?.ambiguous ? (
                          <span className="muted">
                            {sug.candidates.length} مرشّحين بالدرجة نفسها — الاختيار لك
                          </span>
                        ) : sug?.best ? (
                          <span className="muted">
                            مرشّح بثقة {sug.best.score}٪ — دون العتبة
                          </span>
                        ) : (
                          <span className="muted">لا مقابل في الدفتر</span>
                        )}
                      </td>
                      {canMatch && !done ? (
                        <td>
                          {line.status === 'MATCHED' ? (
                            <UnmatchButton statementId={statement.id} lineId={line.id} />
                          ) : (
                            <LineMatch
                              statementId={statement.id}
                              lineId={line.id}
                              candidates={(sug?.candidates ?? []).map((c) => ({
                                journalLineId: c.journalLineId,
                                label: `${c.entryNumber} · ${c.date.toISOString().slice(0, 10)} · ${c.amount.toFixed(2)} · ثقة ${c.score}٪`,
                              }))}
                              counterAccounts={suggestedCounters.length ? suggestedCounters : counterAccounts}
                              allAccounts={counterAccounts}
                            />
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          title="بنود الدفتر التي لم تظهر في الكشف"
          hint="شيكاتٌ صُرفت ولم تُقدَّم، وحوالاتٌ في الطريق"
          flush
        >
          {report.unmatchedLedger.length === 0 ? (
            <div style={{ padding: 16 }}>
              <Empty title="لا بنود معلّقة" hint="كل ما في الدفتر ظهر في الكشف." />
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 130 }}>القيد</th>
                    <th style={{ width: 110 }}>التاريخ</th>
                    <th>البيان</th>
                    <th className="num" style={{ width: 140 }}>المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {report.unmatchedLedger.map((l) => (
                    <tr key={l.id}>
                      <td className="mono small">{l.entryNumber}</td>
                      <td><DateText value={l.date} /></td>
                      <td>{l.descAr}</td>
                      <td className="num"><Money value={l.amount} colored /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}><strong>الإجمالي</strong></td>
                    <td className="num">
                      <strong><Money value={report.outstandingLedger} colored /></strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>

        {statement.reconciledAt ? (
          <div className="small muted">
            قُفلت التسوية في <DateText value={statement.reconciledAt} />
            {statement.reconciledBy ? ` بواسطة ${statement.reconciledBy}` : ''}.
          </div>
        ) : null}
      </div>
    </>
  );
}
