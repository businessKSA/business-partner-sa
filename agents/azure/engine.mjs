// محرّك الفريق: Azure OpenAI أساساً، وOllama المحلي احتياطاً.
//
// لماذا لا SDK: هذا المستودع بلا تبعيات إطلاقاً (`installCommand: echo "no
// dependencies"`)، وإضافة حزمة لأجل غلافٍ حول `fetch` تجرّ شجرة تبعيات كاملة
// إلى صورة الحاوية. الواجهة هنا نداء HTTP واحد وحلقة أدوات — والوضوح أثمن.
//
// لماذا Azure أساساً: قرار المالك 2026-09-15 (CLAUDE.md §2.6) — منحة
// Microsoft for Startups تموّل كل نداء مدفوع، ولا يُشحن رصيد على أي مزوّد.
//
// ولماذا Ollama احتياطاً لا أساساً: جهازٌ ينام يوقف الفريق، وهذا نقيض
// «لا ينامون». فالمحلي للتطوير، وللبيانات التي لا تغادر الجهاز، ولحين تنفد
// حصة Azure — لا ليكون العمود. ونداء Ollama يمرّ بـ`/v1/chat/completions`
// المتوافق مع OpenAI، فالجسم واحد والأدوات تعمل بلا فرع ثانٍ في الكود.
//
// **حقل `model` في Azure هو اسم النشر (deployment) لا اسم الموديل.** هذا
// الخلط أسقط محاولتين سابقتين بـ«could not be found»، فيُقال صراحةً هنا.

/* لا افتراض لاسم المورد. في هذا الحساب مَورِدان يصلحان كلاهما:
   `bp-ai-ksa-2026` (Azure OpenAI، Sweden Central) و`drbahermagnas-6763-resource`
   (مشروع Foundry، East US 2). وافتراضُ أحدهما يعني أن مفتاحاً صحيحاً على
   المورد الآخر يفشل بـ«not found» — عطلٌ يبدو خطأ مفتاح وهو خطأ عنوان،
   وهذا الصنف بالضبط أضاع يومين هنا. فيُطلب صراحةً ويُقال ذلك. */
const AZ_RESOURCE = (process.env.AZURE_OPENAI_RESOURCE || "").trim();
const AZ_ENDPOINT = (process.env.AZURE_OPENAI_ENDPOINT
  || (AZ_RESOURCE ? `https://${AZ_RESOURCE}.openai.azure.com` : ""))
  .replace(/\/+$/, "");
const AZ_VERSION = process.env.AZURE_OPENAI_API_VERSION || "2025-03-01-preview";
const AZ_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || "";
const AZ_KEY = (process.env.AZURE_OPENAI_API_KEY || "").trim();

const OLLAMA_BASE = (process.env.OLLAMA_BASE || "http://127.0.0.1:11434").replace(/\/+$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "";

const AZURE_OK = !!(AZ_KEY && AZ_DEPLOYMENT && AZ_ENDPOINT);
const OLLAMA_OK = !!OLLAMA_MODEL;

export const ENGINE_READY = AZURE_OK || OLLAMA_OK;

// رسالة عطل تقول ما ينقص بالاسم. «غير مهيّأ» تترك صاحبها يخمّن.
export function engineWhyNot() {
  if (ENGINE_READY) return "";
  const az = [];
  if (!AZ_KEY) az.push("AZURE_OPENAI_API_KEY");
  if (!AZ_DEPLOYMENT) az.push("AZURE_OPENAI_DEPLOYMENT (اسم النشر من ai.azure.com ← Deployments ← عمود Name، لا اسم الموديل)");
  if (!AZ_ENDPOINT) az.push("AZURE_OPENAI_RESOURCE (اسم المورد الذي فيه النشر — عندك bp-ai-ksa-2026 وdrbahermagnas-6763-resource، فحدّد أيّهما)");
  return `لا محرّك. للأساس ينقص: ${az.join("، ")}.`
    + ` وللاحتياطي المحلي: OLLAMA_MODEL (مثل qwen2.5:7b) وOllama يعمل على ${OLLAMA_BASE}.`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function target(which) {
  return which === "azure"
    ? {
        url: `${AZ_ENDPOINT}/openai/deployments/${encodeURIComponent(AZ_DEPLOYMENT)}/chat/completions?api-version=${AZ_VERSION}`,
        headers: { "api-key": AZ_KEY, "content-type": "application/json" },
        model: null,               // Azure يأخذ النشر من المسار لا من الجسم
      }
    : {
        url: `${OLLAMA_BASE}/v1/chat/completions`,
        headers: { "content-type": "application/json" },
        model: OLLAMA_MODEL,
      };
}

async function callOnce(which, body, signal) {
  const t = target(which);
  const payload = t.model ? { ...body, model: t.model } : body;
  const r = await fetch(t.url, { method: "POST", headers: t.headers, body: JSON.stringify(payload), signal });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { ok: r.ok, status: r.status, json, text };
}

/* 429 و5xx ليست أعطالاً نهائية بل ازدحام. والفشل من أول محاولة يوقف جولة
   صباحية كاملة لأن ثانيةً واحدة كانت مزدحمة. التراجع أسّي مع حدّ. */
async function tryEngine(which, body, timeoutMs, tries) {
  let last = null;
  for (let attempt = 0; attempt < tries; attempt++) {
    if (attempt) await sleep(Math.min(2000 * 2 ** (attempt - 1), 16000));
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      last = await callOnce(which, body, ac.signal);
    } catch (e) {
      last = { ok: false, status: 0, text: String(e.message || e) };
    } finally {
      clearTimeout(timer);
    }
    if (last.ok) return { ok: true, message: last.json.choices[0].message };
    // 4xx غير 429 خطأ في الطلب نفسه: إعادة المحاولة تكرّره حرفياً.
    if (last.status >= 400 && last.status < 500 && last.status !== 429) break;
  }
  const detail = (last && last.json && last.json.error && last.json.error.message) || (last && last.text) || "";
  return { ok: false, error: `${which}_${last ? last.status : 0}: ${String(detail).slice(0, 300)}` };
}

// آخر محرّك خدم فعلاً. الجولة التي تُنفَّذ على الاحتياطي يجب أن تقول ذلك في
// سجلّها — وإلا ظُنّ أن Azure يعمل وهو صامت، وهو الخطأ الذي أبقى أحد عشر
// مديراً على محرّك ميت أسبوعاً.
export let LAST_ENGINE = null;

export async function chat(messages, { tools, temperature = 0.3, maxTokens = 2000, timeoutMs = 120000 } = {}) {
  if (!ENGINE_READY) throw new Error(`المحرّك غير مهيّأ — ${engineWhyNot()}`);

  const body = { messages, temperature, max_tokens: maxTokens };
  if (tools && tools.length) { body.tools = tools; body.tool_choice = "auto"; }

  const chain = [];
  if (AZURE_OK) chain.push("azure");
  if (OLLAMA_OK) chain.push("ollama");

  const errors = [];
  for (const which of chain) {
    /* الإلحاح على Azure حين يوجد احتياطي يؤخّر بلا طائل: أربع محاولات
       بتراجع أسّي = أربع عشرة ثانية قبل التحويل، في كل نداء من حلقة أدوات
       قد تبلغ اثني عشر نداءً. فالمحاولتان تكفيان لعبور ازدحام عابر، وما
       بعدهما شأن الاحتياطي. وبلا احتياطي يُلحّ لأن البديل لا شيء. */
    const tries = (which === "azure" && OLLAMA_OK) ? 2 : 4;
    const r = await tryEngine(which, body, timeoutMs, tries);
    if (r.ok) {
      if (LAST_ENGINE !== which) console.error(`▸ المحرّك: ${which}${which === "ollama" ? " (احتياطي محلي)" : ""}`);
      LAST_ENGINE = which;
      return r.message;
    }
    errors.push(r.error);
    if (which === "azure" && OLLAMA_OK) console.error(`⚠ Azure تعذّر (${r.error.slice(0, 120)}) — أجرّب Ollama المحلي`);
  }
  throw new Error(errors.join(" | "));
}

export const ENGINE_INFO = {
  azure: AZURE_OK ? { endpoint: AZ_ENDPOINT, deployment: AZ_DEPLOYMENT, apiVersion: AZ_VERSION } : null,
  ollama: OLLAMA_OK ? { base: OLLAMA_BASE, model: OLLAMA_MODEL } : null,
};
