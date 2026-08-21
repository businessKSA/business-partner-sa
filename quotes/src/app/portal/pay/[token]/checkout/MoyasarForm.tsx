'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    Moyasar?: { init: (opts: Record<string, unknown>) => void };
  }
}

/**
 * نموذج Moyasar — يُحمَّل من شبكة توزيع المزوّد ويُهيّأ بالمفتاح العام فقط.
 * المبلغ يصل من الخادم بالهللات بعد قراءته من الفاتورة، فلا يمكن تعديله من المتصفح.
 */
export default function MoyasarForm(props: {
  version: string;
  publishableKey: string;
  amountHalalas: number;
  description: string;
  callbackUrl: string;
  metadata: Record<string, string>;
  methods: string[];
}) {
  const done = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const base = `https://cdn.moyasar.com/mpf/${props.version}`;
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `${base}/moyasar.css`;
    document.head.appendChild(css);

    const script = document.createElement('script');
    script.src = `${base}/moyasar.js`;
    script.onload = () => {
      if (!window.Moyasar) {
        setError('تعذّر تحميل نموذج الدفع. حدّث الصفحة أو استخدم التحويل البنكي.');
        return;
      }
      window.Moyasar.init({
        element: '.moyasar-form',
        amount: props.amountHalalas,
        currency: 'SAR',
        description: props.description,
        publishable_api_key: props.publishableKey,
        callback_url: props.callbackUrl,
        methods: props.methods,
        metadata: props.metadata,
      });
    };
    script.onerror = () => setError('تعذّر الوصول إلى بوابة الدفع. تحقق من اتصالك ثم أعد المحاولة.');
    document.body.appendChild(script);
  }, [props]);

  if (error) return <div className="notice warn">{error}</div>;
  return <div className="moyasar-form" style={{ marginTop: 16 }} />;
}
