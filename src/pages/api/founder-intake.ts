import type { APIRoute } from 'astro';
import { createGmailService } from '../../utils/gmail';

export const prerender = false;

// Founder intake (Shared Services — Phase 1b).
// One submission does two things:
//   1. Captures the lead by email (so nothing is lost even if the AI engine is busy).
//   2. Kicks off Khaled (the executive team) live and returns his first reply
//      (the Lead Consultant's smart questions / next steps).
// No OTP, no passwords, no binding commitments. Budget is a placeholder band only.

const KHALED_CHAT_URL =
  process.env.N8N_KHALED_CHAT_URL ||
  'https://businesspartnerai.app.n8n.cloud/webhook/f08bf4a4-62e9-4aa6-9a44-bf3080682fb3/chat';

const LEAD_TO = process.env.LEAD_INBOX || 'business@businesspartnerksa.com';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });

export const OPTIONS: APIRoute = async () => json({ ok: true });

export const GET: APIRoute = async () =>
  json({ message: 'BP founder-intake proxy is running', timestamp: new Date().toISOString() });

const STAGE_LABEL: Record<string, string> = {
  idea: 'فكرة فقط',
  validating: 'أتحقق من الفكرة',
  licensed: 'لدي سجل/ترخيص',
  operating: 'شركة قائمة',
};

function s(v: unknown) {
  return String(v ?? '').trim();
}

export const POST: APIRoute = async ({ request }) => {
  let data: any = {};
  try {
    data = await request.json();
  } catch {
    return json({ ok: false, reply: 'طلب غير صالح.' }, 400);
  }

  const name = s(data.name);
  const phone = s(data.phone);
  const email = s(data.email);
  const company = s(data.company);
  const stage = s(data.stage);
  const sector = s(data.sector);
  const goal = s(data.goal);
  const budget = s(data.budget);
  const channel = s(data.channel);
  const lang = s(data.lang) || 'ar';
  const sessionId = s(data.sessionId) || `intake-${Date.now()}`;

  if (!name || !goal) {
    return json({ ok: false, reply: 'الرجاء إدخال الاسم ووصف الهدف على الأقل.' }, 400);
  }

  const stageLabel = STAGE_LABEL[stage] || stage || 'غير محدد';

  // 1) Capture the lead by email (best-effort, never blocks the AI kickoff).
  const subjectRaw = `Shared Services Lead: ${name} — ${company || sector || 'مؤسِّس جديد'}`;
  const subject = /[-￿]/.test(subjectRaw)
    ? `=?UTF-8?B?${Buffer.from(subjectRaw, 'utf8').toString('base64')}?=`
    : subjectRaw;
  const textBody =
    `طلب اشتراك في الخدمات المشتركة (الفريق التنفيذي الذكي)\n` +
    `────────────────────────\n` +
    `الاسم: ${name}\n` +
    `الجوال: ${phone || '—'}\n` +
    `البريد: ${email || '—'}\n` +
    `الشركة/الفكرة: ${company || '—'}\n` +
    `المرحلة: ${stageLabel}\n` +
    `القطاع: ${sector || '—'}\n` +
    `الهدف: ${goal}\n` +
    `نطاق الميزانية: ${budget || '—'} (تقديري — لا التزام)\n` +
    `قناة التواصل المفضّلة: ${channel || '—'}\n` +
    `────────────────────────\n` +
    `الوقت: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' })} (توقيت الرياض)\n`;

  let emailed = false;
  try {
    const gmail = createGmailService();
    if (gmail) {
      emailed = await gmail.sendEmail({
        to: LEAD_TO,
        subject,
        htmlBody: `<pre style="font-family:Tahoma,Arial,sans-serif;font-size:14px;line-height:1.7;white-space:pre-wrap">${textBody}</pre>`,
        textBody,
      });
    }
  } catch (e) {
    console.error('founder-intake email error:', e);
  }

  // 2) Kick off Khaled with a composed briefing so he replies as the Lead Consultant.
  const kickoff =
    `طلب جديد من مؤسِّس عبر نموذج الخدمات المشتركة.\n` +
    `الاسم: ${name}. المرحلة: ${stageLabel}. القطاع: ${sector || 'غير محدد'}.\n` +
    `الشركة/الفكرة: ${company || 'غير محدد'}.\n` +
    `الهدف: ${goal}.\n` +
    `نطاق الميزانية التقديري: ${budget || 'غير محدد'} (لا تلتزم بأي سعر — السعر يحتاج اعتماداً بشرياً).\n\n` +
    `بصفتك قائد الفريق، رحّب به باختصار ثم اطرح 4 إلى 6 أسئلة ذكية فقط تكفي لفهم مشروعه وبناء خطة، ` +
    `واقترح أول خطوة عملية. لا تطلب كلمات مرور أو رموز تحقق.`;

  const busyReply =
    'استلمنا طلبك وسنتواصل معك قريباً. محرّك الفريق مشغول الآن (وصلنا حد الاستخدام المجاني اليومي)، ' +
    'وتقدر تكمّل معنا مباشرة عبر المحادثة الصوتية.';

  let reply = '';
  try {
    const res = await fetch(KHALED_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sendMessage', sessionId, chatInput: kickoff }),
    });
    const raw = await res.text();
    try {
      const d = JSON.parse(raw);
      reply = d.output ?? d.text ?? d.reply ?? d.answer ?? '';
    } catch {
      if (!/error in workflow|too many requests|quota|<html/i.test(raw)) reply = raw;
    }
    reply = (typeof reply === 'string' ? reply : '').trim();
  } catch (e) {
    console.error('founder-intake khaled error:', e);
  }

  if (!reply) {
    return json({ ok: emailed, busy: true, emailed, sessionId, reply: busyReply });
  }
  return json({ ok: true, emailed, sessionId, reply });
};
