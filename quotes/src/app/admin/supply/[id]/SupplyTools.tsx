'use client';
import { useActionState, useState, useTransition } from 'react';
import {
  actionAddBid,
  actionSelectBid,
  actionCreateSupplyAgreement,
  actionFundSupply,
  actionAddMilestones,
  actionApproveMilestone,
  actionPayMilestone,
} from '@/app/actions';

function useRunner() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null);
  const run = (fn: () => Promise<unknown>, ok: string) =>
    start(async () => {
      setMsg(null);
      try {
        await fn();
        setMsg({ kind: 'ok', text: ok });
      } catch (e) {
        const t = e instanceof Error ? e.message : String(e);
        if (t.includes('NEXT_REDIRECT')) return;
        setMsg({ kind: 'bad', text: t });
      }
    });
  return { pending, msg, run };
}

function SelectButton({ requestId, bidId }: { requestId: string; bidId: string }) {
  const { pending, run } = useRunner();
  return (
    <button className="btn ghost sm" disabled={pending} onClick={() => run(() => actionSelectBid(requestId, bidId), '')}>
      اختيار
    </button>
  );
}

function MilestoneButtons({ milestoneId, requestId, status }: { milestoneId: string; requestId: string; status: string }) {
  const { pending, msg, run } = useRunner();
  return (
    <>
      {status === 'PENDING' ? (
        <button
          className="btn sm"
          disabled={pending}
          onClick={() => run(() => actionApproveMilestone(milestoneId, requestId), 'اعتُمدت المرحلة')}
        >
          اعتماد
        </button>
      ) : null}
      {status === 'APPROVED' ? (
        <button
          className="btn sm"
          disabled={pending}
          onClick={() => run(() => actionPayMilestone(milestoneId, requestId), 'صُرفت المرحلة من المحفظة')}
        >
          صرف من المحفظة
        </button>
      ) : null}
      {status === 'PAID' ? <span className="muted">تم</span> : null}
      {msg && msg.kind === 'bad' ? <div className="notice bad" style={{ fontSize: 12 }}>{msg.text}</div> : null}
    </>
  );
}

interface Props {
  requestId: string;
  status: string;
  hasSelected: boolean;
  hasAgreement: boolean;
  agreementId: string | null;
  agreementNumber: string | null;
  hasMilestones: boolean;
  suppliers: { id: string; label: string }[];
}

function SupplyTools(props: Props) {
  const [bid, bidAction, bidPending] = useActionState(actionAddBid, {});
  const [ms, msAction, msPending] = useActionState(actionAddMilestones, {});
  const { pending, msg, run } = useRunner();
  const [rows, setRows] = useState([0, 1]);

  return (
    <>
      <div className="grid c2">
        <form className="card" action={bidAction}>
          <h2>إضافة عرض مورد</h2>
          <input type="hidden" name="supplyRequestId" value={props.requestId} />
          <label htmlFor="b_supplier">المورد *</label>
          <select id="b_supplier" name="supplierId" required>
            <option value="">— اختر مورداً —</option>
            {props.suppliers.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <div className="grid c2">
            <div><label htmlFor="b_amount">المبلغ (ريال) *</label><input id="b_amount" name="amount" type="number" step="0.01" min="0" required /></div>
            <div><label htmlFor="b_delAr">مدة التنفيذ</label><input id="b_delAr" name="deliveryAr" /></div>
          </div>
          <label htmlFor="b_notesAr">ملاحظات</label>
          <textarea id="b_notesAr" name="notesAr" />
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" type="submit" disabled={bidPending}>{bidPending ? 'جارٍ الإضافة' : 'إضافة العرض'}</button>
          </div>
          {bid.error ? <div className="notice bad">{bid.error}</div> : null}
          {bid.ok ? <div className="notice ok">{bid.ok}</div> : null}
        </form>

        <div className="card">
          <h2>خطوات المنسّق</h2>
          <div className="row">
            <button
              className="btn"
              disabled={!props.hasSelected || pending || props.hasAgreement}
              onClick={() => run(() => actionCreateSupplyAgreement(props.requestId), '')}
            >
              {props.hasAgreement ? `الاتفاقية ${props.agreementNumber} أُنشئت` : 'إنشاء الاتفاقية الثلاثية'}
            </button>
            {props.agreementId ? (
              <a className="btn ghost" href={`/admin/documents/${props.agreementId}`}>فتح الاتفاقية للاعتماد والتوقيع</a>
            ) : null}
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button
              className="btn ghost"
              disabled={!props.hasSelected || pending}
              onClick={() => run(() => actionFundSupply(props.requestId), 'أُصدرت فاتورة إيداع قيمة التوريد في المحفظة')}
            >
              إصدار فاتورة إيداع قيمة التوريد في المحفظة
            </button>
          </div>
          <p className="muted" style={{ marginTop: 10 }}>
            التسلسل: اختيار المورد ثم الاتفاقية الثلاثية (اعتماد ثم توقيع عبر DocuSign) ثم إيداع العميل في المحفظة ثم الصرف على مراحل باعتمادك.
          </p>
          {msg ? <div className={`notice ${msg.kind}`}>{msg.text}</div> : null}
        </div>
      </div>

      <form className="card" action={msAction}>
        <h2>تحديد مراحل الإنجاز</h2>
        <input type="hidden" name="supplyRequestId" value={props.requestId} />
        <input type="hidden" name="rowCount" value={rows.length} />
        {rows.map((r, i) => (
          <div key={r} className="grid c3">
            <div><label>المرحلة بالعربي</label><input name={`ms_${i}_titleAr`} placeholder="الدفعة المقدمة" /></div>
            <div><label>المرحلة بالإنجليزي</label><input name={`ms_${i}_titleEn`} dir="ltr" placeholder="Advance payment" /></div>
            <div><label>المبلغ (ريال)</label><input name={`ms_${i}_amount`} type="number" step="0.01" min="0" /></div>
          </div>
        ))}
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" className="btn ghost" onClick={() => setRows((x) => [...x, x.length])}>إضافة مرحلة</button>
          <button className="btn" type="submit" disabled={msPending || props.hasMilestones}>
            {props.hasMilestones ? 'المراحل محددة' : msPending ? 'جارٍ الحفظ' : 'حفظ المراحل'}
          </button>
        </div>
        {ms.error ? <div className="notice bad">{ms.error}</div> : null}
        {ms.ok ? <div className="notice ok">{ms.ok}</div> : null}
      </form>
    </>
  );
}

SupplyTools.SelectButton = SelectButton;
SupplyTools.MilestoneButtons = MilestoneButtons;

export default SupplyTools;
