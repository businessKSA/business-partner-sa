import type { APIRoute } from 'astro';
import { createGmailService } from '../../utils/gmail';

export const prerender = false;

// n8n lead pipeline (Notion Leads DB + WhatsApp to us & client + dashboard).
// Set N8N_INVESTOR_LEAD_WEBHOOK in env to enable once the n8n plan allows executions.
const N8N_WEBHOOK = import.meta.env.N8N_INVESTOR_LEAD_WEBHOOK || process.env.N8N_INVESTOR_LEAD_WEBHOOK || 'https://businesspartnerai.app.n8n.cloud/webhook/investor-lead';

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const {
      purpose = '', sector = '', region = '', timeline = '',
      lang = 'en', name = '', company = '', phone = '', email = '', source = 'Concierge wizard',
    } = data || {};

    const summary =
      `Purpose: ${purpose}\nSector: ${sector}\nRegion: ${region}\nTimeline: ${timeline}\n` +
      `Language: ${lang}\nName: ${name || '-'}\nCompany: ${company || '-'}\nPhone: ${phone || '-'}\nEmail: ${email || '-'}\nSource: ${source}`;

    // 1) Forward to n8n (Notion + WhatsApp to us & client + dashboard) if configured
    let forwarded = false;
    if (N8N_WEBHOOK) {
      try {
        const r = await fetch(N8N_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, kind: 'investor_lead', receivedAt: new Date().toISOString() }),
        });
        forwarded = r.ok;
      } catch (e) { console.error('n8n forward failed', e); }
    }

    // 2) Immediate email notification to the team (works without n8n)
    let emailSent = false;
    const rawSubject = `🇸🇦 New Investor Lead — ${region || 'KSA'} · ${sector || 'General'}`;
    const emailSubject = /[-￿]/.test(rawSubject)
      ? `=?UTF-8?B?${Buffer.from(rawSubject, 'utf8').toString('base64')}?=`
      : rawSubject;
    const htmlBody = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#fff">
        <div style="background:linear-gradient(135deg,#0B1B5A,#13246e);color:#fff;padding:28px;border-radius:12px 12px 0 0;text-align:center">
          <h1 style="margin:0;font-size:22px">🇸🇦 New Investor Lead</h1>
          <p style="margin:8px 0 0;opacity:.85">Mahfol Makfol By Business Partner</p>
        </div>
        <div style="background:#f6f8fd;padding:26px;border-radius:0 0 12px 12px;border:1px solid #e5e8f3">
          <table style="width:100%;border-collapse:collapse;font-size:15px">
            <tr><td style="padding:7px 0;color:#5b6480;width:130px">🎯 Goal</td><td style="padding:7px 0;color:#14213d">${purpose || '-'}</td></tr>
            <tr><td style="padding:7px 0;color:#5b6480">🏭 Sector</td><td style="padding:7px 0;color:#14213d">${sector || '-'}</td></tr>
            <tr><td style="padding:7px 0;color:#5b6480">📍 Region</td><td style="padding:7px 0;color:#14213d">${region || '-'}</td></tr>
            <tr><td style="padding:7px 0;color:#5b6480">🗓️ Timeline</td><td style="padding:7px 0;color:#14213d">${timeline || '-'}</td></tr>
            <tr><td style="padding:7px 0;color:#5b6480">🌐 Language</td><td style="padding:7px 0;color:#14213d">${lang}</td></tr>
            <tr><td style="padding:7px 0;color:#5b6480">👤 Name</td><td style="padding:7px 0;color:#14213d">${name || '-'}</td></tr>
            <tr><td style="padding:7px 0;color:#5b6480">🏢 Company</td><td style="padding:7px 0;color:#14213d">${company || '-'}</td></tr>
            <tr><td style="padding:7px 0;color:#5b6480">📱 Phone</td><td style="padding:7px 0;color:#14213d">${phone || '-'}</td></tr>
            <tr><td style="padding:7px 0;color:#5b6480">📧 Email</td><td style="padding:7px 0;color:#14213d">${email || '-'}</td></tr>
            <tr><td style="padding:7px 0;color:#5b6480">🔗 Source</td><td style="padding:7px 0;color:#14213d">${source}</td></tr>
          </table>
          <p style="margin:16px 0 0;color:#5b6480;font-size:13px">⏰ ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' })} (Riyadh)</p>
        </div>
      </div>`;

    try {
      const gmail = createGmailService();
      if (gmail) {
        emailSent = await gmail.sendEmail({
          to: 'business@businesspartnerksa.com',
          subject: emailSubject,
          htmlBody,
          textBody: `New Investor Lead\n\n${summary}\n\n${new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' })} (Riyadh)`,
        });
      }
    } catch (e) { console.error('Gmail send failed', e); }

    return new Response(JSON.stringify({ success: true, emailSent, forwarded }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (error) {
    console.error('investor-lead error', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
};

export const GET: APIRoute = async () =>
  new Response(JSON.stringify({ ok: true, service: 'investor-lead', n8n: !!N8N_WEBHOOK }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
