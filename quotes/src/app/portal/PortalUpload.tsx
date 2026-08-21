'use client';
import { useActionState } from 'react';
import { actionUploadAttachment } from '@/app/actions';

export default function PortalUpload({ clientId }: { clientId: string }) {
  const [state, action, pending] = useActionState(actionUploadAttachment, {});
  return (
    <form className="card" action={action}>
      <h2>رفع مرفق</h2>
      <p className="muted">السجل التجاري، الجوازات، الوكالات وغيرها. تُحفظ في مجلد المرفقات الخاص بك.</p>
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="folder" value="attachments" />
      <input type="hidden" name="source" value="client" />
      <label htmlFor="pfile">الملف</label>
      <input id="pfile" name="file" type="file" required />
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn" type="submit" disabled={pending}>{pending ? 'جارٍ الرفع' : 'رفع'}</button>
      </div>
      {state.error ? <div className="notice bad">{state.error}</div> : null}
      {state.ok ? <div className="notice ok">{state.ok}</div> : null}
    </form>
  );
}
