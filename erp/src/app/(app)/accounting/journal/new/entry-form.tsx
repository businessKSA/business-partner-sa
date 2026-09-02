'use client';

import { useActionState, useState } from 'react';
import { createJournalEntry, type ActionResult } from '@/app/actions/accounting.ts';

type Account = { id: string; code: string; nameAr: string };
type CostCenter = { id: string; code: string; nameAr: string };

type Line = { accountId: string; debit: string; credit: string; descAr: string; costCenterId: string };

const EMPTY: Line = { accountId: '', debit: '', credit: '', descAr: '', costCenterId: '' };

/**
 * محرّر القيد.
 *
 * الفرق يُحسب في المتصفح ويُعرض لحظياً — لا ليحلّ محلّ تحقّق الخادم بل
 * ليمنع رحلةً كاملة تنتهي برسالة «القيد غير متزن». الخادم يفحص من جديد،
 * دائماً.
 */
export function EntryForm({ accounts, costCenters }: { accounts: Account[]; costCenters: CostCenter[] }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    createJournalEntry, null,
  );
  const [lines, setLines] = useState<Line[]>([{ ...EMPTY }, { ...EMPTY }]);

  const num = (s: string) => {
    const n = Number(s.replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  const totalDebit = lines.reduce((s, l) => s + num(l.debit), 0);
  const totalCredit = lines.reduce((s, l) => s + num(l.credit), 0);
  const diff = Math.round((totalDebit - totalCredit) * 100) / 100;
  const balanced = diff === 0 && totalDebit > 0;

  function update(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  const fmt = (n: number) =>
    n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return (
    <form action={action}>
      {state && !state.ok ? <div className="alert error">{state.error}</div> : null}

      <div className="card">
        <div className="card-body">
          <div className="grid-3">
            <div className="field">
              <label htmlFor="date">التاريخ</label>
              <input id="date" name="date" type="date" required
                defaultValue={new Date().toISOString().slice(0, 10)} />
              <div className="help">يجب أن يقع في فترة محاسبية مفتوحة.</div>
            </div>
            <div className="field">
              <label htmlFor="ref">المرجع</label>
              <input id="ref" name="ref" type="text" placeholder="رقم مستند أو إشارة" />
            </div>
            <div className="field">
              <label htmlFor="memoAr">البيان</label>
              <input id="memoAr" name="memoAr" type="text" placeholder="وصف القيد" />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>سطور القيد</h2>
            <div className="hint">كل سطر مدينٌ أو دائن — لا الاثنان معاً، ولا مبلغ سالب.</div>
          </div>
          <button type="button" className="btn sm"
            onClick={() => setLines((p) => [...p, { ...EMPTY }])}>
            إضافة سطر
          </button>
        </div>

        <div className="card-body flush">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: 220 }}>الحساب</th>
                  <th style={{ minWidth: 170 }}>البيان</th>
                  {costCenters.length > 0 ? <th style={{ minWidth: 140 }}>مركز التكلفة</th> : null}
                  <th className="num" style={{ width: 140 }}>مدين</th>
                  <th className="num" style={{ width: 140 }}>دائن</th>
                  <th style={{ width: 44 }} />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i}>
                    <td>
                      <select name={`accountId-${i}`} value={line.accountId}
                        onChange={(e) => update(i, { accountId: e.target.value })}>
                        <option value="">— اختر حساباً —</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>{a.code} · {a.nameAr}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input name={`descAr-${i}`} type="text" value={line.descAr}
                        onChange={(e) => update(i, { descAr: e.target.value })} />
                    </td>
                    {costCenters.length > 0 ? (
                      <td>
                        <select name={`costCenterId-${i}`} value={line.costCenterId}
                          onChange={(e) => update(i, { costCenterId: e.target.value })}>
                          <option value="">—</option>
                          {costCenters.map((c) => (
                            <option key={c.id} value={c.id}>{c.nameAr}</option>
                          ))}
                        </select>
                      </td>
                    ) : null}
                    <td>
                      <input name={`debit-${i}`} type="number" step="0.01" min="0" value={line.debit}
                        onChange={(e) => update(i, { debit: e.target.value, credit: '' })} />
                    </td>
                    <td>
                      <input name={`credit-${i}`} type="number" step="0.01" min="0" value={line.credit}
                        onChange={(e) => update(i, { credit: e.target.value, debit: '' })} />
                    </td>
                    <td>
                      {lines.length > 2 ? (
                        <button type="button" className="btn sm"
                          onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}
                          title="حذف السطر">×</button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={costCenters.length > 0 ? 3 : 2}>الإجمالي</td>
                  <td className="num">{fmt(totalDebit)}</td>
                  <td className="num">{fmt(totalCredit)}</td>
                  <td />
                </tr>
                <tr>
                  <td colSpan={costCenters.length > 0 ? 3 : 2}>الفرق</td>
                  <td className="num" colSpan={2}>
                    <span className={diff === 0 ? 'pos' : 'neg'}>{fmt(diff)}</span>
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <div className="actions">
        <button className="btn primary" type="submit" disabled={pending || !balanced}>
          {pending ? 'جارٍ الترحيل…' : 'ترحيل القيد'}
        </button>
        {!balanced ? (
          <span className="muted small">
            {totalDebit === 0
              ? 'أدخل المبالغ.'
              : `القيد غير متزن — الفرق ${fmt(diff)}. الترحيل معطّل حتى يتزن.`}
          </span>
        ) : null}
      </div>
    </form>
  );
}
