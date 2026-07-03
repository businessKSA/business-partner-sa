import type { APIRoute } from 'astro';

export const prerender = false;

// Server-side proxy for the voice assistant.
// Browser (voice page) → this route → Khaled orchestrator (n8n chat webhook).
// Keeps the n8n webhook URL private and avoids browser CORS.
const KHALED_CHAT_URL =
  process.env.N8N_KHALED_CHAT_URL ||
  'https://businesspartnerai.app.n8n.cloud/webhook/f08bf4a4-62e9-4aa6-9a44-bf3080682fb3/chat';

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
  json({ message: 'BP voice assistant proxy is running', timestamp: new Date().toISOString() });

export const POST: APIRoute = async ({ request }) => {
  let data: any = {};
  try {
    data = await request.json();
  } catch {
    return json({ ok: false, reply: 'طلب غير صالح.' }, 400);
  }

  const message = String(data.message || '').trim();
  const sessionId = String(data.sessionId || `web-${Date.now()}`);
  if (!message) return json({ ok: false, reply: 'الرجاء كتابة أو نطق رسالتك.' }, 400);

  const busyReply =
    'الفريق مشغول جداً الحين ووصلنا حد الاستخدام المجاني اليومي لمحرّك الذكاء. جرّب بعد شوي.';

  try {
    const res = await fetch(KHALED_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sendMessage', sessionId, chatInput: message }),
    });

    const raw = await res.text();
    let reply = '';
    try {
      const d = JSON.parse(raw);
      reply = d.output ?? d.text ?? d.reply ?? d.answer ?? '';
      if (!reply && (d.message || d.code || d.stack)) reply = ''; // n8n error shape
    } catch {
      if (!/error in workflow|too many requests|quota|<html/i.test(raw)) reply = raw;
    }
    reply = (typeof reply === 'string' ? reply : '').trim();

    if (!reply) return json({ ok: false, busy: true, reply: busyReply });
    return json({ ok: true, reply });
  } catch {
    return json({ ok: false, reply: 'تعذّر الاتصال بالفريق حالياً. حاول مرة ثانية بعد لحظات.' }, 502);
  }
};
