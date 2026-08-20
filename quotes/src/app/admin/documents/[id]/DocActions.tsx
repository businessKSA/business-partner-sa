'use client';
import { useState, useTransition } from 'react';
import {
  actionApprove,
  actionGenerateContract,
  actionBuildPdf,
  actionSendEmail,
  actionPrepareWhatsApp,
  actionSendForSignature,
  actionCreateInvoices,
} from '@/app/actions';

export default function DocActions(props: {
  id: string;
  status: string;
  type: string;
  hasContract: boolean;
  hasPdf: boolean;
  hasInvoices: boolean;
  publicLink: string;
  docusignReady: boolean;
  docusignMode: string;
  docusignMissing: string[];
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null);
  const [withArabic, setWithArabic] = useState(true);

  const run = (fn: () => Promise<unknown>, okText: string) =>
    start(async () => {
      setMsg(null);
      try {
        await fn();
        setMsg({ kind: 'ok', text: okText });
      } catch (e) {
        const text = e instanceof Error ? e.message : String(e);
        // إعادة التوجيه من داخل server action ليست خطأ
        if (text.includes('NEXT_REDIRECT')) return;
        setMsg({ kind: 'bad', text });
      }
    });

  const isDraft = props.status === 'DRAFT';
  const approved = !isDraft && !['REJECTED', 'EXPIRED', 'CANCELLED'].includes(props.status);
  const isQuote = props.type === 'QUOTE';

  return (
    <div className="card no-print">
      <h2>الإجراءات</h2>

      <div className="row">
        <button
          className="btn"
          disabled={!isDraft || pending}
          onClick={() => run(() => actionApprove(props.id), 'اعتُمد المستند. الإرسال متاح الآن.')}
          title={isDraft ? '' : 'المستند معتمد بالفعل'}
        >
          اعتماد
        </button>

        <button
          className="btn ghost"
          disabled={pending}
          onClick={() => run(() => actionBuildPdf(props.id), 'وُلّد الـPDF وأُرشف في مجلد العميل.')}
        >
          توليد PDF وأرشفته
        </button>

        {isQuote ? (
          <button
            className="btn ghost"
            disabled={pending || props.hasContract}
            onClick={() => run(() => actionGenerateContract(props.id), 'تولّد العقد.')}
          >
            {props.hasContract ? 'العقد مولَّد بالفعل' : 'توليد العقد من هذا العرض'}
          </button>
        ) : null}
      </div>

      <h3>الإرسال — متاح بعد الاعتماد فقط</h3>
      <div className="row">
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', margin: 0 }}>
          <input
            type="checkbox"
            checked={withArabic}
            onChange={(e) => setWithArabic(e.target.checked)}
            style={{ width: 'auto' }}
          />
          إرفاق النسخة العربية في البريد
        </label>
        <button
          className="btn"
          disabled={!approved || pending}
          onClick={() => run(() => actionSendEmail(props.id, withArabic), 'أُرسل البريد مع مرفق PDF.')}
        >
          إرسال بالبريد
        </button>
        <button
          className="btn ghost"
          disabled={!approved || pending}
          onClick={() => run(() => actionPrepareWhatsApp(props.id, 'ar'), '')}
        >
          واتساب (عربي)
        </button>
        <button
          className="btn ghost"
          disabled={!approved || pending}
          onClick={() => run(() => actionPrepareWhatsApp(props.id, 'en'), '')}
        >
          واتساب (إنجليزي)
        </button>
      </div>

      {!isQuote ? (
        <>
          <h3>التوقيع الإلكتروني</h3>
          {!props.docusignReady ? (
            <div className="notice warn">
              DocuSign غير مكتملة الإعداد (الوضع: {props.docusignMode}). الناقص: {props.docusignMissing.join(', ')}.
              بقية النظام يعمل بشكل طبيعي.
            </div>
          ) : null}
          <div className="row">
            <button
              className="btn"
              disabled={!approved || pending || !props.docusignReady || props.status === 'SIGNED'}
              onClick={() =>
                run(
                  () => actionSendForSignature(props.id),
                  'أُرسل العقد للتوقيع عبر DocuSign. ترتيب التوقيع: العميل ثم أنت.',
                )
              }
            >
              إرسال للتوقيع عبر DocuSign
            </button>
            <button
              className="btn ghost"
              disabled={pending || props.hasInvoices}
              onClick={() => run(() => actionCreateInvoices(props.id), 'أُنشئ جدول الدفعات.')}
            >
              {props.hasInvoices ? 'جدول الدفعات موجود' : 'إنشاء جدول الدفعات'}
            </button>
          </div>
        </>
      ) : null}

      {pending ? <div className="notice">جارٍ التنفيذ…</div> : null}
      {msg ? <div className={`notice ${msg.kind}`}>{msg.text}</div> : null}
    </div>
  );
}
