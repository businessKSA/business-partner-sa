'use client';

import { useActionState, useState } from 'react';
import {
  autoMatchStatement, matchStatementLine, unmatchStatementLine,
  adjustStatementLine, finalizeStatement, type ActionResult,
} from '@/app/actions/treasury.ts';

export function AutoMatchButton({ statementId }: { statementId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    autoMatchStatement, null,
  );

  return (
    <div>
      <form action={action}>
        <input type="hidden" name="statementId" value={statementId} />
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? 'جارٍ…' : 'مطابقة آلية'}
        </button>
      </form>
      {state && state.ok ? <div className="small pos">{state.note}</div> : null}
      {state && !state.ok ? <div className="small neg">{state.error}</div> : null}
    </div>
  );
}

export function FinalizeButton({
  statementId, blocked,
}: { statementId: string; blocked: boolean }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    finalizeStatement, null,
  );

  return (
    <div>
      <form action={action}>
        <input type="hidden" name="statementId" value={statementId} />
        <button className="btn" type="submit" disabled={pending || blocked}>
          {pending ? 'جارٍ…' : 'قفل التسوية'}
        </button>
      </form>
      {blocked ? (
        <div className="small muted">فسِّر كل بند أوّلاً — القفل إقرارٌ بأن الفرق كلّه مفهوم.</div>
      ) : null}
      {state && !state.ok ? <div className="small neg">{state.error}</div> : null}
    </div>
  );
}

export function UnmatchButton({
  statementId, lineId,
}: { statementId: string; lineId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    unmatchStatementLine, null,
  );

  return (
    <>
      <form action={action}>
        <input type="hidden" name="statementId" value={statementId} />
        <input type="hidden" name="lineId" value={lineId} />
        <button className="btn sm" type="submit" disabled={pending}>
          {pending ? 'جارٍ…' : 'فكّ المطابقة'}
        </button>
      </form>
      {state && !state.ok ? <div className="small neg">{state.error}</div> : null}
    </>
  );
}

/**
 * خياران لسطرٍ غير مطابَق: أن يُقابَل بقيدٍ قائم، أو أن يُنشأ له قيد تسوية.
 * والثاني للحالة التي لا مقابل لها أصلاً — رسومٌ خصمها البنك ولم يخبر أحداً.
 */
export function LineMatch({
  statementId, lineId, candidates, counterAccounts, allAccounts,
}: {
  statementId: string;
  lineId: string;
  candidates: { journalLineId: string; label: string }[];
  counterAccounts: { id: string; code: string; nameAr: string }[];
  allAccounts: { id: string; code: string; nameAr: string }[];
}) {
  const [matchState, matchAction, matching] = useActionState<ActionResult | null, FormData>(
    matchStatementLine, null,
  );
  const [adjState, adjAction, adjusting] = useActionState<ActionResult | null, FormData>(
    adjustStatementLine, null,
  );
  const [mode, setMode] = useState<'none' | 'match' | 'adjust'>('none');
  const [showAll, setShowAll] = useState(false);

  const state = matchState ?? adjState;
  const accounts = showAll ? allAccounts : counterAccounts;

  if (mode === 'none') {
    return (
      <>
        <div style={{ display: 'flex', gap: 6 }}>
          {candidates.length > 0 ? (
            <button className="btn sm" type="button" onClick={() => setMode('match')}>
              مطابقة ({candidates.length})
            </button>
          ) : null}
          <button className="btn sm" type="button" onClick={() => setMode('adjust')}>
            قيد تسوية
          </button>
        </div>
        {state && !state.ok ? <div className="small neg">{state.error}</div> : null}
      </>
    );
  }

  if (mode === 'match') {
    return (
      <form action={matchAction}>
        <input type="hidden" name="statementId" value={statementId} />
        <input type="hidden" name="lineId" value={lineId} />
        <select name="journalLineId" required defaultValue={candidates[0]?.journalLineId}>
          {candidates.map((c) => (
            <option key={c.journalLineId} value={c.journalLineId}>{c.label}</option>
          ))}
        </select>
        {state && !state.ok ? <div className="small neg">{state.error}</div> : null}
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <button className="btn sm primary" type="submit" disabled={matching}>
            {matching ? 'جارٍ…' : 'تأكيد'}
          </button>
          <button className="btn sm" type="button" onClick={() => setMode('none')}>إلغاء</button>
        </div>
      </form>
    );
  }

  return (
    <form action={adjAction}>
      <input type="hidden" name="statementId" value={statementId} />
      <input type="hidden" name="lineId" value={lineId} />
      <select name="counterAccountId" required>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>{a.code} — {a.nameAr}</option>
        ))}
      </select>
      <div className="small">
        <button
          type="button"
          className="btn sm"
          style={{ marginTop: 6 }}
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? 'الحسابات الشائعة' : 'كل الحسابات'}
        </button>
      </div>
      {state && !state.ok ? <div className="small neg">{state.error}</div> : null}
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <button className="btn sm primary" type="submit" disabled={adjusting}>
          {adjusting ? 'جارٍ…' : 'ترحيل القيد'}
        </button>
        <button className="btn sm" type="button" onClick={() => setMode('none')}>إلغاء</button>
      </div>
    </form>
  );
}
