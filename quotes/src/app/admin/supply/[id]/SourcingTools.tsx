'use client';
import { useActionState, useMemo, useState, useTransition } from 'react';
import { actionDispatchRfps, actionSelectBid, actionExtractBid, actionBuildResaleQuote } from '@/app/actions';
import { SUPPLIER_CATEGORIES, categoryLabel } from '@/lib/categories';

type SupplierRow = { id: string; nameAr: string; city: string | null; cats: string[] };

function useRunner() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null);
  const run = (fn: () => Promise<unknown>, ok: string) =>
    start(async () => {
      setMsg(null);
      try {
        await fn();
        if (ok) setMsg({ kind: 'ok', text: ok });
      } catch (e) {
        const t = e instanceof Error ? e.message : String(e);
        if (t.includes('NEXT_REDIRECT')) return;
        setMsg({ kind: 'bad', text: t });
      }
    });
  return { pending, msg, run };
}

/**
 * اختيار الموردين وإرسال طلب العرض.
 *
 * التصنيف يرشّح ولا يمنع: قائمة «كل الموردين» تبقى متاحة لأن مورداً واحداً
 * قد يصلح لطلبٍ خارج تصنيفه، ومن يعرف سوقه يعرف ذلك ولا يحتاج أن يعدّل صفّه
 * في نوشن ليرسل له بريداً واحداً.
 */
function Dispatch({
  requestId,
  suppliers,
  alreadySent,
}: {
  requestId: string;
  suppliers: SupplierRow[];
  alreadySent: string[];
}) {
  const [state, action, pending] = useActionState(actionDispatchRfps, {});
  const [cat, setCat] = useState('');
  const sent = useMemo(() => new Set(alreadySent), [alreadySent]);

  const shown = useMemo(
    () => (cat ? suppliers.filter((s) => s.cats.includes(cat)) : suppliers),
    [suppliers, cat],
  );

  return (
    <form className="card" action={action}>
      <h2>إرسال طلب عرض للموردين</h2>
      <input type="hidden" name="supplyRequestId" value={requestId} />

      <label htmlFor="cat">التصنيف</label>
      <select id="cat" value={cat} onChange={(e) => setCat(e.target.value)}>
        <option value="">كل الموردين ({suppliers.length})</option>
        {Object.keys(SUPPLIER_CATEGORIES).map((c) => {
          const n = suppliers.filter((s) => s.cats.includes(c)).length;
          return (
            <option key={c} value={c} disabled={!n}>
              {categoryLabel(c)} ({n})
            </option>
          );
        })}
      </select>

      <div style={{ marginTop: 14 }}>
        {!shown.length ? (
          <p className="muted">
            لا مورد في هذا التصنيف. أضف موردين من <a href="/admin/suppliers">صفحة الموردين</a> —
            ولا بدّ من بريدٍ لكل مورد.
          </p>
        ) : (
          <div className="grid c3">
            {shown.map((s) => (
              <label key={s.id} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  name="supplierIds"
                  value={s.id}
                  defaultChecked={sent.has(s.id)}
                  style={{ marginTop: 4 }}
                />
                <span>
                  {s.nameAr}
                  {sent.has(s.id) ? <span className="pill st-ACCEPTED"> أُرسل</span> : null}
                  <div className="muted">
                    {[s.city, s.cats.map(categoryLabel).join('، ')].filter(Boolean).join(' — ') || ' '}
                  </div>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn" type="submit" disabled={pending || !shown.length}>
          {pending ? 'جارٍ الإرسال' : 'أرسل طلب العرض'}
        </button>
      </div>
      <p className="muted" style={{ marginTop: 10 }}>
        يصل كل مورد بريدٌ برابطه وحده، فيه نطاق العمل بلا اسم العميل ولا بريده ولا هاتفه. ومن
        سبق إرساله لا يُنشأ له رابط جديد — يُعاد إرسال رابطه نفسه.
      </p>
      {state.error ? <div className="notice bad">{state.error}</div> : null}
      {state.ok ? <div className="notice ok">{state.ok}</div> : null}
    </form>
  );
}

function CopyLink({ url }: { url: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn ghost sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          window.prompt('انسخ الرابط', url);
        }
      }}
    >
      {done ? 'نُسخ' : 'نسخ الرابط'}
    </button>
  );
}

function BidButtons({
  requestId,
  bidId,
  hasFile,
  isSelected,
}: {
  requestId: string;
  bidId: string;
  hasFile: boolean;
  isSelected: boolean;
}) {
  const { pending, msg, run } = useRunner();
  return (
    <>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
        {hasFile ? (
          <button
            type="button"
            className="btn ghost sm"
            disabled={pending}
            onClick={() => run(() => actionExtractBid(bidId, requestId), 'قُرئ مستند المورد')}
          >
            استخراج البنود
          </button>
        ) : null}
        {isSelected ? (
          <b>مختار</b>
        ) : (
          <button
            type="button"
            className="btn sm"
            disabled={pending}
            onClick={() => run(() => actionSelectBid(requestId, bidId), '')}
          >
            اختيار
          </button>
        )}
      </div>
      {msg ? <div className={`notice ${msg.kind}`}>{msg.text}</div> : null}
    </>
  );
}

function BuildQuote({ requestId }: { requestId: string }) {
  const { pending, msg, run } = useRunner();
  return (
    <>
      <div className="row" style={{ marginTop: 12 }}>
        <button
          type="button"
          className="btn"
          disabled={pending}
          onClick={() => run(() => actionBuildResaleQuote(requestId), '')}
        >
          {pending ? 'جارٍ البناء' : 'ابنِ عرض السعر باسمنا'}
        </button>
      </div>
      {msg ? <div className={`notice ${msg.kind}`}>{msg.text}</div> : null}
    </>
  );
}

const SourcingTools = { Dispatch, CopyLink, BidButtons, BuildQuote };
export default SourcingTools;
