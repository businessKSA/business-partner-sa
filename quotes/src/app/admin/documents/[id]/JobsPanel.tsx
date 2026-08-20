'use client';
import { useState, useTransition } from 'react';
import { actionRetryJob } from '@/app/actions';

const KIND_LABEL: Record<string, string> = {
  'document.pdf': 'توليد PDF',
  'document.docx': 'توليد DOCX',
  'document.email': 'إرسال بالبريد',
  'docusign.signed-copy': 'تنزيل النسخة الموقّعة',
};

const STATUS: Record<string, { ar: string; cls: string }> = {
  QUEUED: { ar: 'في الطابور', cls: 'st-DRAFT' },
  RUNNING: { ar: 'قيد التنفيذ', cls: 'st-SIGNING' },
  DONE: { ar: 'تم', cls: 'st-ACCEPTED' },
  FAILED: { ar: 'فشل', cls: 'st-REJECTED' },
};

export interface JobRow {
  id: string;
  kind: string;
  status: string;
  attempts: number;
  error: string | null;
  createdAt: string;
}

export default function JobsPanel({ documentId, jobs }: { documentId: string; jobs: JobRow[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  if (!jobs.length) return null;

  return (
    <div className="card no-print">
      <h2>المهام الخلفية</h2>
      <p className="muted">
        توليد المستندات والإرسال ينفَّذان خلف الطابور فلا يحجزان الواجهة. أي مهمة فاشلة تُعاد من هنا.
      </p>
      <table>
        <thead>
          <tr><th>المهمة</th><th>الحالة</th><th className="num">المحاولات</th><th className="num">الإجراء</th></tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id}>
              <td>
                {KIND_LABEL[j.kind] ?? j.kind}
                <div className="muted" style={{ fontSize: 11 }}>
                  {j.createdAt.slice(0, 16).replace('T', ' ')} UTC
                </div>
              </td>
              <td>
                <span className={`pill ${STATUS[j.status]?.cls ?? ''}`}>{STATUS[j.status]?.ar ?? j.status}</span>
                {j.error ? <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>{j.error}</div> : null}
              </td>
              <td className="num">{j.attempts}</td>
              <td className="num">
                {j.status === 'FAILED' ? (
                  <button
                    className="btn ghost sm"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        setMsg(null);
                        try {
                          await actionRetryJob(j.id, documentId);
                          setMsg('أُعيد تشغيل المهمة.');
                        } catch (e) {
                          setMsg(e instanceof Error ? e.message : String(e));
                        }
                      })
                    }
                  >
                    إعادة التشغيل
                  </button>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {msg ? <div className="notice">{msg}</div> : null}
    </div>
  );
}
