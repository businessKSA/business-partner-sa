import type { APIRoute } from 'astro';

export const prerender = false;

// Server-side proxy: the browser talks to this route, this route talks to n8n.
// Keeps the n8n webhook URLs private and avoids browser CORS issues.
//
// Registry of specialized-team agents. `path` is the n8n production webhook path
// (POST {base}/{path}). live:false → the workflow isn't built/published yet.
const N8N_BASE = process.env.N8N_WEBHOOK_BASE || 'https://businesspartnerai.app.n8n.cloud/webhook';

type AgentDef = { path: string; live: boolean };

const AGENTS: Record<string, AgentDef> = {
  consultant: { path: 'consultant-intake', live: true },
  market: { path: 'market-intake', live: true },
  model: { path: 'model-intake', live: true },
  finance: { path: 'finance-intake', live: true },
  badr: { path: 'badr-intake', live: true },
  malak: { path: 'malak-intake', live: true },
  ahmed: { path: 'ahmed-procurement', live: true },
  farah: { path: 'farah-intake', live: true },
  mohammed: { path: 'mohammed-intake', live: true },
  abdulaziz: { path: 'abdulaziz-intake', live: true },
  mazen: { path: 'mazen-intake', live: true },
};

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
  json({
    message: 'BP Agents proxy is running',
    agents: Object.fromEntries(Object.entries(AGENTS).map(([k, v]) => [k, v.live ? 'live' : 'pending'])),
    timestamp: new Date().toISOString(),
  });

export const POST: APIRoute = async ({ request }) => {
  let data: any = {};
  try {
    data = await request.json();
  } catch {
    return json({ ok: false, reply: 'طلب غير صالح.' }, 400);
  }

  const agentKey = String(data.agent || '').toLowerCase();
  const message = String(data.message || '').trim();
  const def = AGENTS[agentKey];

  if (!def) return json({ ok: false, reply: 'إيجنت غير معروف.' }, 404);
  if (!message) return json({ ok: false, reply: 'الرجاء كتابة رسالة للاختبار.' }, 400);

  if (!def.live) {
    return json({
      ok: true,
      pending: true,
      reply: `وكيل «${agentKey}» قيد البناء في n8n ولم يُفعّل بعد. بمجرد بنائه ونشره يصير قابلاً للاختبار من هنا مباشرة.`,
    });
  }

  // Payload shape expected by the Badr-style intake webhooks.
  const payload = {
    client_name: data.client_name || 'اختبار — لوحة التحكم',
    phone: data.phone || '',
    channel: 'web-dashboard',
    crm_lead_id: '',
    service_hint: data.service_hint || '',
    message,
  };

  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 45000);
    const res = await fetch(`${N8N_BASE}/${def.path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(t);

    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      // n8n may return a bare string
    }

    const reply =
      (parsed && (parsed.reply || parsed.output || parsed.message)) ||
      (typeof text === 'string' && text) ||
      'لم يصل رد من الوكيل.';

    return json({
      ok: res.ok,
      reply,
      proposal_ready: parsed?.proposal_ready === true,
      human_required: parsed?.human_required === true,
      engine_fallback: parsed?.engine_fallback === true,
    });
  } catch (err) {
    return json({
      ok: false,
      reply: 'تعذّر الوصول للوكيل حالياً. تأكد أن الورك فلو مُفعّل في n8n وأن الرابط صحيح.',
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
