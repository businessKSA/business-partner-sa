/**
 * إرسال البريد.
 *
 * ثلاثة مزوّدين يختارها `MAIL_PROVIDER`: `smtp` أو `resend` أو `log`.
 * و`log` ليس مزوّداً وهمياً للاختبار فحسب — هو المخرَج الآمن حين لا يُضبط
 * شيء: يطبع الرسالة في السجلّ بدل أن يرميَ خطأً يمنع الدخول كلّه.
 *
 * ولماذا لا يُرمى الخطأ؟ لأن أول من سيصطدم به هو من ينشر النظام أول مرّة
 * قبل أن يشتري نطاق بريد. وأن يرى الرابط في سجلّ النشر فيدخل به ثم يضبط
 * المزوّد على مهل، خيرٌ من نظامٍ لا يُدخَل إليه أصلاً.
 *
 * ولا يُستعمل `log` في الإنتاج بلا قصد: `assertMailConfigured` أدناه
 * يُنبّه في السجلّ حين يكون `NODE_ENV=production` والمزوّدُ غيرَ مضبوط.
 */

export type MailInput = {
  to: string;
  subject: string;
  /** النسخة النصية إلزامية: بعض برامج البريد لا تعرض HTML أصلاً. */
  text: string;
  html?: string;
};

export type MailResult = { ok: boolean; provider: string; id?: string; error?: string };

function fromAddress(): string {
  return process.env.MAIL_FROM || 'Business Partner ERP <no-reply@businesspartner.sa>';
}

/** المزوّد الفعّال: ما ضُبط صراحةً، وإلّا `log`. */
export function mailProvider(): 'smtp' | 'resend' | 'log' {
  const p = (process.env.MAIL_PROVIDER || '').toLowerCase();
  if (p === 'smtp' || p === 'resend') return p;
  return 'log';
}

async function sendSmtp(m: MailInput): Promise<MailResult> {
  const nodemailer = (await import('nodemailer')).default;
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === '1',
    auth:
      process.env.SMTP_USER || process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
  const info = await transport.sendMail({
    from: fromAddress(),
    to: m.to,
    subject: m.subject,
    text: m.text,
    html: m.html,
  });
  return { ok: true, provider: 'smtp', id: info.messageId };
}

async function sendResend(m: MailInput): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, provider: 'resend', error: 'RESEND_API_KEY غير مضبوط' };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: fromAddress(),
      to: [m.to],
      subject: m.subject,
      text: m.text,
      html: m.html,
    }),
  });

  if (!res.ok) {
    return { ok: false, provider: 'resend', error: `${res.status} ${await res.text()}` };
  }
  const body = (await res.json()) as { id?: string };
  return { ok: true, provider: 'resend', id: body.id };
}

export async function sendMail(m: MailInput): Promise<MailResult> {
  const provider = mailProvider();
  try {
    if (provider === 'smtp') return await sendSmtp(m);
    if (provider === 'resend') return await sendResend(m);

    // `log`: تُطبع الرسالة كاملةً ليُنسخ منها الرابط في التطوير.
    console.log(
      `\n──────── بريد (لم يُرسَل — MAIL_PROVIDER=log) ────────\n` +
        `إلى: ${m.to}\nالموضوع: ${m.subject}\n\n${m.text}\n` +
        `────────────────────────────────────────────────────\n`,
    );
    return { ok: true, provider: 'log' };
  } catch (e) {
    // لا يُرمى للأعلى: فشل الإرسال لا يجوز أن يكشف للزائر أن البريد مسجَّل،
    // ولا أن يُظهر أثر الاستثناء في الصفحة.
    const error = e instanceof Error ? e.message : String(e);
    console.error(`✗ فشل إرسال البريد عبر ${provider}: ${error}`);
    return { ok: false, provider, error };
  }
}

/** تنبيهٌ في السجلّ حين يُنشر النظام بلا مزوّد بريد. */
export function assertMailConfigured(): void {
  if (process.env.NODE_ENV === 'production' && mailProvider() === 'log') {
    console.warn(
      '⚠ MAIL_PROVIDER غير مضبوط في الإنتاج: روابط الدخول تُطبع في السجلّ ولا تصل بريداً. ' +
        'اضبط MAIL_PROVIDER=resend مع RESEND_API_KEY، أو =smtp مع بيانات الخادم.',
    );
  }
}
