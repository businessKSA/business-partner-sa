import type { APIRoute } from 'astro';
import { createGmailService } from '../../utils/gmail';

export const prerender = false;

// Unified recruitment intake endpoint.
// Handles two submission types via `type`:
//   - "employer"  : company registration + (optional) job posting
//   - "candidate" : job seeker application / CV submission
// Storage-agnostic: today it emails the recruitment inbox; a Supabase/Notion
// adapter can be plugged in later without changing the page-side contract.

const INBOX = 'business@businesspartnerksa.com';

function enc(subject: string): string {
  return /[-￿]/.test(subject)
    ? `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`
    : subject;
}

function row(label: string, value: string): string {
  if (!value) return '';
  return `<tr><td style="padding:8px 0;color:#64748b;font-weight:600;width:170px;">${label}</td><td style="padding:8px 0;color:#0f172a;">${value}</td></tr>`;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const type = data.type === 'employer' ? 'employer' : 'candidate';
    const lang = data.lang === 'en' ? 'en' : 'ar';
    const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' });

    let subject = '';
    let rows = '';

    if (type === 'employer') {
      subject = `🏢 New Employer: ${data.companyName || 'Unknown'}${data.jobTitle ? ` — hiring ${data.jobTitle}` : ''}`;
      rows =
        row('🏢 Company', data.companyName) +
        row('👤 Contact', data.contactName) +
        row('📧 Email', data.email) +
        row('📱 Phone', data.phone) +
        row('🧩 Hiring track', data.track) +
        row('💼 Job title', data.jobTitle) +
        row('🔢 Openings', data.openings) +
        row('📍 Work model', data.workModel) +
        row('🇸🇦 Nationality pref', data.nationality) +
        row('📝 Details', data.details);
    } else {
      subject = `👤 New Candidate: ${data.fullName || 'Unknown'}${data.role ? ` — ${data.role}` : ''}`;
      rows =
        row('👤 Full name', data.fullName) +
        row('📧 Email', data.email) +
        row('📱 Phone', data.phone) +
        row('💼 Desired role', data.role) +
        row('🎓 Experience', data.experience) +
        row('🌆 City', data.city) +
        row('🇸🇦 Nationality', data.nationality) +
        row('⏱️ Availability', data.availability) +
        row('🔗 CV / LinkedIn', data.cvLink) +
        row('📝 Summary', data.summary);
    }

    const htmlBody = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#1e293b,#334155);color:#fff;padding:26px;border-radius:12px 12px 0 0;text-align:center;">
        <h1 style="margin:0;font-size:22px;">${type === 'employer' ? '🏢 New Employer Request' : '👤 New Candidate Application'}</h1>
        <p style="margin:8px 0 0;opacity:.9;">Business Partner — Recruitment</p>
      </div>
      <div style="background:#f8fafc;padding:26px;border:1px solid #e2e8f0;border-radius:0 0 12px 12px;">
        <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;padding:12px;">${rows}</table>
        <p style="margin-top:18px;color:#64748b;font-size:13px;">⏰ ${now} (Riyadh) · lang: ${lang} · source: /recruitment</p>
      </div>
    </div>`;

    const textBody = `${subject}\n\n${rows.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')}\n\n${now} (Riyadh)`;

    let sent = false;
    let err = '';
    try {
      const gmail = createGmailService();
      if (gmail) {
        sent = await gmail.sendEmail({ to: INBOX, subject: enc(subject), htmlBody, textBody });
      } else {
        err = 'Gmail service not configured';
        console.log('recruitment-intake:', err, data);
      }
    } catch (e) {
      err = `Gmail error: ${e}`;
      console.error('recruitment-intake gmail error:', e);
    }

    const okMsg = lang === 'ar'
      ? (type === 'employer' ? 'تم استلام طلبك! سيتواصل معك فريق التوظيف خلال 24 ساعة.' : 'تم استلام سيرتك بنجاح! سنتواصل معك عند توفر فرصة مناسبة.')
      : (type === 'employer' ? 'Request received! Our recruitment team will contact you within 24 hours.' : 'Your application was received! We will reach out when a suitable role opens.');
    const failMsg = lang === 'ar'
      ? 'تعذّر الإرسال حالياً. جرّب مرة أخرى أو تواصل عبر واتساب.'
      : 'Could not submit right now. Please try again or reach us on WhatsApp.';

    return new Response(JSON.stringify({ success: sent, message: sent ? okMsg : failMsg, error: sent ? undefined : err }), {
      status: sent ? 200 : 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: 'Error processing submission.', error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
};

export const GET: APIRoute = async () =>
  new Response(JSON.stringify({ message: 'Recruitment intake API is working', gmail: createGmailService() ? 'Available' : 'Not configured' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
