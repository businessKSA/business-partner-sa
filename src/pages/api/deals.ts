import type { APIRoute } from 'astro';
import { createGmailService } from '../../utils/gmail';

export const prerender = false;

// n8n deal-matching pipeline (Notion Deals DB + match scoring + email).
// Set N8N_DEALS_WEBHOOK in env to enable once the workflow is published.
const N8N_WEBHOOK = import.meta.env.N8N_DEALS_WEBHOOK || process.env.N8N_DEALS_WEBHOOK || 'https://businesspartnerai.app.n8n.cloud/webhook/deals-lead';

const SECTOR_LABELS: Record<string, string> = {
  food: 'Restaurants & Food', retail: 'Retail', tech: 'Tech', services: 'Services',
  industry: 'Industry', logistics: 'Logistics', beauty: 'Beauty', hr: 'HR', other: 'Other',
};
const CITY_LABELS: Record<string, string> = {
  riyadh: 'Riyadh', jeddah: 'Jeddah', dammam: 'Dammam', other: 'Other',
};
const TYPE_LABELS: Record<string, string> = {
  offer: '🤝 Offering a deal', seek: '🔎 Seeking a partner', idea: '💡 Pitching an idea',
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const {
      dealType = 'seek', title = '', sector = '', city = '', description = '',
      name = '', phone = '', email = '', consent = false,
      lang = 'en', source = 'businesspartner.sa/deals',
    } = data || {};

    if (!name || !phone || !email) {
      return new Response(JSON.stringify({ success: false, error: 'Missing contact details' }), {
        status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const typeLabel = TYPE_LABELS[dealType] || dealType;
    const sectorLabel = SECTOR_LABELS[sector] || sector;
    const cityLabel = CITY_LABELS[city] || city;

    // 1) Forward to n8n (Notion Deals DB + match scoring + email) if configured
    let forwarded = false;
    if (N8N_WEBHOOK) {
      try {
        const r = await fetch(N8N_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, kind: 'deal_lead', status: 'new', receivedAt: new Date().toISOString() }),
        });
        forwarded = r.ok;
      } catch (e) { console.error('n8n forward failed', e); }
    }

    // 2) Immediate email notification to the team (works without n8n)
    let emailSent = false;
    const rawSubject = `🤝 New Deal Submission — ${typeLabel} · ${sectorLabel}`;
    const emailSubject = /[^\x00-\x7F]/.test(rawSubject)
      ? `=?UTF-8?B?${Buffer.from(rawSubject, 'utf8').toString('base64')}?=`
      : rawSubject;
    const htmlBody = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#fff">
        <div style="background:linear-gradient(135deg,#1e293b,#334155);color:#fff;padding:28px;border-radius:12px 12px 0 0;text-align:center">
          <h1 style="margin:0;font-size:22px">🤝 New Deal Submission</h1>
          <p style="margin:8px 0 0;opacity:.85">Business Partner — Deals & Matchmaking</p>
        </div>
        <div style="background:#f8fafc;padding:26px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0">
          <table style="width:100%;border-collapse:collapse;font-size:15px">
            <tr><td style="padding:7px 0;color:#64748b;width:130px">Type</td><td style="padding:7px 0;color:#1e293b">${typeLabel}</td></tr>
            <tr><td style="padding:7px 0;color:#64748b">Title</td><td style="padding:7px 0;color:#1e293b">${title || '-'}</td></tr>
            <tr><td style="padding:7px 0;color:#64748b">Sector</td><td style="padding:7px 0;color:#1e293b">${sectorLabel || '-'}</td></tr>
            <tr><td style="padding:7px 0;color:#64748b">City</td><td style="padding:7px 0;color:#1e293b">${cityLabel || '-'}</td></tr>
            <tr><td style="padding:7px 0;color:#64748b;vertical-align:top">Description</td><td style="padding:7px 0;color:#1e293b">${description || '-'}</td></tr>
            <tr><td style="padding:7px 0;color:#64748b">Name</td><td style="padding:7px 0;color:#1e293b">${name}</td></tr>
            <tr><td style="padding:7px 0;color:#64748b">Phone</td><td style="padding:7px 0;color:#1e293b"><a href="tel:${phone}" style="color:#0066cc;text-decoration:none">${phone}</a></td></tr>
            <tr><td style="padding:7px 0;color:#64748b">Email</td><td style="padding:7px 0;color:#1e293b"><a href="mailto:${email}" style="color:#0066cc;text-decoration:none">${email}</a></td></tr>
            <tr><td style="padding:7px 0;color:#64748b">Consent</td><td style="padding:7px 0;color:#1e293b">${consent ? 'Yes' : 'No'}</td></tr>
            <tr><td style="padding:7px 0;color:#64748b">Language</td><td style="padding:7px 0;color:#1e293b">${lang}</td></tr>
            <tr><td style="padding:7px 0;color:#64748b">Source</td><td style="padding:7px 0;color:#1e293b">${source}</td></tr>
          </table>
          <p style="margin:16px 0 0;color:#64748b;font-size:13px">⏰ ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' })} (Riyadh)</p>
        </div>
      </div>`;
    const textBody = `New Deal Submission\n\nType: ${typeLabel}\nTitle: ${title || '-'}\nSector: ${sectorLabel || '-'}\nCity: ${cityLabel || '-'}\nDescription: ${description || '-'}\nName: ${name}\nPhone: ${phone}\nEmail: ${email}\nConsent: ${consent ? 'Yes' : 'No'}\nLanguage: ${lang}\nSource: ${source}`;

    try {
      const gmail = createGmailService();
      if (gmail) {
        emailSent = await gmail.sendEmail({
          to: 'business@businesspartnerksa.com',
          subject: emailSubject,
          htmlBody,
          textBody,
        });
      }
    } catch (e) { console.error('Gmail send failed', e); }

    return new Response(JSON.stringify({ success: true, emailSent, forwarded }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (error) {
    console.error('deals lead error', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
};

export const GET: APIRoute = async () =>
  new Response(JSON.stringify({ ok: true, service: 'deals', n8n: !!N8N_WEBHOOK }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
