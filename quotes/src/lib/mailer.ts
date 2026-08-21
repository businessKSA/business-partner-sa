/**
 * البريد: SMTP أو Resend أو log (تسجيل فقط في بيئة التطوير).
 * كل شيء عبر متغيرات البيئة — MAIL_PROVIDER.
 */
export interface Attachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface MailInput {
  to: string;
  subject: string;
  text: string;
  attachments?: Attachment[];
  replyTo?: string;
}

export interface MailResult {
  ok: boolean;
  provider: string;
  id?: string;
  error?: string;
}

function from(): string {
  return process.env.MAIL_FROM || 'Business Partner Solutions <no-reply@businesspartner.sa>';
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
    from: from(),
    to: m.to,
    subject: m.subject,
    text: m.text,
    replyTo: m.replyTo,
    attachments: m.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  });
  return { ok: true, provider: 'smtp', id: info.messageId };
}

async function sendResend(m: MailInput): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY غير معرّف');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: from(),
      to: [m.to],
      subject: m.subject,
      text: m.text,
      reply_to: m.replyTo,
      attachments: m.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content.toString('base64'),
      })),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok) throw new Error(body.message || `Resend HTTP ${res.status}`);
  return { ok: true, provider: 'resend', id: body.id };
}

export async function sendMail(m: MailInput): Promise<MailResult> {
  const provider = (process.env.MAIL_PROVIDER || 'log').toLowerCase();
  try {
    if (provider === 'smtp') return await sendSmtp(m);
    if (provider === 'resend') return await sendResend(m);
    // log: لا يُرسل شيء فعلياً — للاختبار المحلي
    console.log(
      `\n[MAIL:log] إلى: ${m.to}\nالموضوع: ${m.subject}\n${m.text}\n` +
        (m.attachments?.length
          ? `مرفقات: ${m.attachments.map((a) => `${a.filename} (${a.content.length} بايت)`).join(', ')}\n`
          : ''),
    );
    return { ok: true, provider: 'log', id: `log-${Date.now()}` };
  } catch (e) {
    return { ok: false, provider, error: e instanceof Error ? e.message : String(e) };
  }
}

/** إشعار داخلي لي فقط — لا يصل العميل ولا تنطبق عليه قيود صياغة العميل. */
export async function notifyAdmin(subject: string, text: string): Promise<MailResult> {
  const to = process.env.NOTIFY_EMAIL || process.env.ADMIN_EMAIL;
  if (!to) return { ok: false, provider: 'none', error: 'NOTIFY_EMAIL غير معرّف' };
  return sendMail({ to, subject, text });
}
