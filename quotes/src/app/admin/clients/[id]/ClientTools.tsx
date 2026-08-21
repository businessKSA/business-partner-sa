'use client';
import { useActionState } from 'react';
import { actionUploadAttachment, actionCreateGovFeeInvoice, actionSpendGovFee } from '@/app/actions';

export default function ClientTools({ clientId }: { clientId: string }) {
  const [up, upAction, upPending] = useActionState(actionUploadAttachment, {});
  const [inv, invAction, invPending] = useActionState(actionCreateGovFeeInvoice, {});
  const [sp, spAction, spPending] = useActionState(actionSpendGovFee, {});

  return (
    <div className="grid c3">
      <form className="card" action={upAction}>
        <h2>رفع مرفق</h2>
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="source" value="admin" />
        <label htmlFor="folder">المجلد</label>
        <select id="folder" name="folder" defaultValue="attachments">
          <option value="attachments">المرفقات</option>
          <option value="quotes">عروض الأسعار</option>
          <option value="contracts">العقود</option>
        </select>
        <label htmlFor="file">الملف (سجل تجاري، جواز، وكالة…)</label>
        <input id="file" name="file" type="file" required />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" type="submit" disabled={upPending}>{upPending ? 'جارٍ الرفع' : 'رفع'}</button>
        </div>
        {up.error ? <div className="notice bad">{up.error}</div> : null}
        {up.ok ? <div className="notice ok">{up.ok}</div> : null}
      </form>

      <form className="card" action={invAction}>
        <h2>فاتورة عهدة رسوم حكومية</h2>
        <p className="muted">إيداع في المحفظة — ليس إيراداً ولا تُحتسب عليه ضريبة القيمة المضافة.</p>
        <input type="hidden" name="clientId" value={clientId} />
        <label htmlFor="gf_titleAr">البيان بالعربي</label>
        <input id="gf_titleAr" name="titleAr" defaultValue="إيداع عهدة رسوم حكومية" />
        <label htmlFor="gf_titleEn">البيان بالإنجليزي</label>
        <input id="gf_titleEn" name="titleEn" defaultValue="Government fees deposit" dir="ltr" />
        <label htmlFor="gf_amount">المبلغ (ريال)</label>
        <input id="gf_amount" name="amount" type="number" step="0.01" min="1" required />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" type="submit" disabled={invPending}>{invPending ? 'جارٍ الإصدار' : 'إصدار الفاتورة'}</button>
        </div>
        {inv.error ? <div className="notice bad">{inv.error}</div> : null}
        {inv.ok ? <div className="notice ok">{inv.ok}</div> : null}
      </form>

      <form className="card" action={spAction}>
        <h2>صرف من عهدة الرسوم</h2>
        <p className="muted">تُسجَّل الحركة في سجل التدقيق غير القابل للتعديل.</p>
        <input type="hidden" name="clientId" value={clientId} />
        <label htmlFor="sp_descAr">البيان بالعربي</label>
        <input id="sp_descAr" name="descAr" placeholder="سداد رخصة الاستثمار" required />
        <label htmlFor="sp_descEn">البيان بالإنجليزي</label>
        <input id="sp_descEn" name="descEn" placeholder="Investment licence payment" dir="ltr" />
        <label htmlFor="sp_amount">المبلغ (ريال)</label>
        <input id="sp_amount" name="amount" type="number" step="0.01" min="1" required />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" type="submit" disabled={spPending}>{spPending ? 'جارٍ التسجيل' : 'تسجيل الصرف'}</button>
        </div>
        {sp.error ? <div className="notice bad">{sp.error}</div> : null}
        {sp.ok ? <div className="notice ok">{sp.ok}</div> : null}
      </form>
    </div>
  );
}
