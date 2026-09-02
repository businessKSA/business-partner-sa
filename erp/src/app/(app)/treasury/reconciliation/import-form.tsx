'use client';

import { useActionState, useState } from 'react';
import { importBankStatement, type ActionResult } from '@/app/actions/treasury.ts';

const SAMPLE = `التاريخ,الوصف,المرجع,المبلغ,الرصيد
2026-03-01,تحويل وارد,TRF-9001,12000.00,12000.00
2026-03-08,شيك صادر,CHQ-1201,(3000.00),9000.00
2026-03-31,رسوم خدمات,,-25.00,8975.00`;

export function ImportForm({
  banks,
}: { banks: { id: string; nameAr: string; bankName: string | null }[] }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    importBankStatement, null,
  );
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState('');

  async function readFile(file: File | undefined) {
    if (!file) return;
    setCsv(await file.text());
  }

  if (!open) {
    return (
      <div style={{ marginBottom: 16 }}>
        <button className="btn primary" type="button" onClick={() => setOpen(true)}>
          استيراد كشف حساب
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>استيراد كشف حساب</h2>
          <div className="hint">
            الافتتاحي زائد مجموع الحركات يجب أن يساوي الختامي — وإلّا رُفض الكشف.
          </div>
        </div>
        <div className="actions">
          <button className="btn sm" type="button" onClick={() => setOpen(false)}>إغلاق</button>
        </div>
      </div>
      <div className="card-body">
        {state && !state.ok ? <div className="alert error">{state.error}</div> : null}
        {state && state.ok ? <div className="alert ok">{state.note}</div> : null}

        <form action={action}>
          <div className="grid-3">
            <div className="field">
              <label htmlFor="bankAccountId">الحساب البنكي</label>
              <select id="bankAccountId" name="bankAccountId" required>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nameAr}{b.bankName ? ` — ${b.bankName}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="reference">مرجع الكشف</label>
              <input id="reference" name="reference" type="text" placeholder="SNB-2026-03" />
            </div>
            <div className="field">
              <label htmlFor="file">ملف CSV</label>
              <input
                id="file" type="file" accept=".csv,text/csv,text/plain"
                onChange={(e) => readFile(e.target.files?.[0])}
              />
            </div>

            <div className="field">
              <label htmlFor="fromDate">من تاريخ</label>
              <input id="fromDate" name="fromDate" type="date" required />
            </div>
            <div className="field">
              <label htmlFor="toDate">إلى تاريخ</label>
              <input id="toDate" name="toDate" type="date" required />
            </div>
            <div className="field" />

            <div className="field">
              <label htmlFor="openingBalance">الرصيد الافتتاحي</label>
              <input
                id="openingBalance" name="openingBalance" type="text"
                inputMode="decimal" required defaultValue="0"
              />
            </div>
            <div className="field">
              <label htmlFor="closingBalance">الرصيد الختامي</label>
              <input
                id="closingBalance" name="closingBalance" type="text"
                inputMode="decimal" required placeholder="0.00"
              />
            </div>
            <div className="field" />
          </div>

          <div className="field">
            <label htmlFor="csv">سطور الكشف</label>
            <textarea
              id="csv" name="csv" rows={10} required
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={SAMPLE}
              style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13 }}
            />
            <div className="help">
              الأعمدة: التاريخ، الوصف، المرجع، المبلغ، الرصيد. يُقبل التاريخ
              بصيغتَي <span className="mono">YYYY-MM-DD</span> و
              <span className="mono">DD/MM/YYYY</span>، ويُقرأ السالب بالإشارة أو
              بين قوسين. الوارد موجب والصادر سالب.
            </div>
          </div>

          <button className="btn primary" type="submit" disabled={pending || !csv.trim()}>
            {pending ? 'جارٍ الاستيراد…' : 'استيراد'}
          </button>
        </form>
      </div>
    </div>
  );
}
