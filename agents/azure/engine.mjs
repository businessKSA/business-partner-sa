// محرّك الفريق: Azure OpenAI، نداءً مباشراً بلا وسيط.
//
// لماذا لا SDK: هذا المستودع بلا تبعيات إطلاقاً (`installCommand: echo "no
// dependencies"`)، وإضافة حزمة لأجل غلافٍ حول `fetch` تجرّ شجرة تبعيات كاملة
// إلى صورة الحاوية. الواجهة هنا نداء HTTP واحد وحلقة أدوات — والوضوح أثمن.
//
// لماذا Azure: قرار المالك 2026-09-15 (CLAUDE.md §2.6) — منحة Microsoft for
// Startups تموّل كل نداء مدفوع، ولا يُشحن رصيد على أي مزوّد. والطبقة السابقة
// كانت على Claude Managed Agents وهي مدفوعة من Anthropic، فأُعيد بناؤها هنا.
//
// **حقل `model` في Azure هو اسم النشر (deployment) لا اسم الموديل.** هذا
// الخلط أسقط محاولتين سابقتين بـ«could not be found»، فيُقال صراحةً هنا.

const ENDPOINT = (process.env.AZURE_OPENAI_ENDPOINT
  || `https://${process.env.AZURE_OPENAI_RESOURCE || "bp-ai-ksa-2026"}.openai.azure.com`)
  .replace(/\/+$/, "");
const API_VERSION = process.env.AZURE_OPENAI_API_VERSION || "2025-03-01-preview";
const DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || "";
const KEY = (process.env.AZURE_OPENAI_API_KEY || "").trim();

export const ENGINE_READY = !!(KEY && DEPLOYMENT);

// رسالة عطل تقول ما ينقص بالاسم. «غير مهيّأ» تترك صاحبها يخمّن.
export function engineWhyNot() {
  const miss = [];
  if (!KEY) miss.push("AZURE_OPENAI_API_KEY");
  if (!DEPLOYMENT) miss.push("AZURE_OPENAI_DEPLOYMENT (اسم النشر من ai.azure.com ← Deployments ← عمود Name)");
  return miss.length ? `ينقص: ${miss.join("، ")}` : "";
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 429 و5xx ليست أعطالاً نهائية بل ازدحام. والفشل من أول محاولة يوقف جولة
   صباحية كاملة لأن ثانيةً واحدة كانت مزدحمة. التراجع أسّي مع حدّ. */
async function callOnce(body, signal) {
  const url = `${ENDPOINT}/openai/deployments/${encodeURIComponent(DEPLOYMENT)}/chat/completions?api-version=${API_VERSION}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "api-key": KEY, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { ok: r.ok, status: r.status, json, text };
}

export async function chat(messages, { tools, temperature = 0.3, maxTokens = 2000, timeoutMs = 120000 } = {}) {
  if (!ENGINE_READY) throw new Error(`المحرّك غير مهيّأ — ${engineWhyNot()}`);

  const body = { messages, temperature, max_tokens: maxTokens };
  if (tools && tools.length) { body.tools = tools; body.tool_choice = "auto"; }

  let last = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await sleep(Math.min(2000 * 2 ** (attempt - 1), 16000));
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      last = await callOnce(body, ac.signal);
    } catch (e) {
      last = { ok: false, status: 0, text: String(e.message || e) };
    } finally {
      clearTimeout(timer);
    }
    if (last.ok) return last.json.choices[0].message;
    // 4xx غير 429 خطأ في الطلب نفسه: إعادة المحاولة تكرّره حرفياً.
    if (last.status >= 400 && last.status < 500 && last.status !== 429) break;
  }

  const detail = (last && last.json && last.json.error && last.json.error.message) || (last && last.text) || "";
  throw new Error(`azure_openai_${last ? last.status : 0}: ${String(detail).slice(0, 300)}`);
}

export const ENGINE_INFO = { endpoint: ENDPOINT, deployment: DEPLOYMENT, apiVersion: API_VERSION };
