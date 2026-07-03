// Business Partner 3.0 — AI Hiring assistant (ESM). Powers the "AI Hiring OS"
// employer dashboard: match candidates to a role, summarise a candidate, draft
// interview questions, and write outreach messages. Free-first provider
// failover (Gemini → Groq → OpenAI → Anthropic), same keys as the advisor.
//
// POST /api/hire { task, role, candidate, candidates, lang }
//   task: "match" | "summary" | "interview" | "outreach"
// GET  /api/hire  -> { status, providers }

const envFrom = (names) => { for (const n of names) { if (process.env[n] && String(process.env[n]).trim()) return String(process.env[n]).trim(); } return ""; };
const GEMINI_KEYS = ["GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GEMINI_API_KEY", "GEMINI_KEY", "GEMINI_APIKEY", "GEMINI", "BusinessPartnerGimini", "BusinessPartnerGemini"];
const GROQ_KEYS = ["GROQ_API_KEY", "GROQ_KEY", "GROQ"];
const OPENAI_KEYS = ["OPENAI_API_KEY", "OPENAI_KEY", "OPENAI"];
const ANTHROPIC_KEYS = ["ANTHROPIC_API_KEY", "ANTHROPIC_KEY", "CLAUDE_API_KEY"];

const SYSTEM = `أنت مساعد توظيف خبير لدى Business Partner (بيزنس بارتنر) في السعودية. تساعد أصحاب العمل على تقييم المرشّحين واتخاذ قرارات توظيف عملية وسريعة. كن دقيقاً وموجزاً ومهنياً، وراعِ أنظمة العمل والتوطين في السعودية. اكتب بلغة المستخدم (العربية افتراضياً). لا تختلق بيانات غير موجودة.`;

async function callGemini(prompt, maxTokens) {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": envFrom(GEMINI_KEYS), "content-type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens || 1200, temperature: 0.4 },
    }),
  });
  if (!r.ok) throw new Error(`gemini ${r.status}`);
  const d = await r.json();
  return (d?.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
}
async function callOAI(url, key, model, prompt, maxTokens) {
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: maxTokens || 1200, temperature: 0.4, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }] }),
  });
  if (!r.ok) throw new Error(`${new URL(url).hostname} ${r.status}`);
  const d = await r.json();
  return (d?.choices?.[0]?.message?.content || "").trim();
}
async function callAnthropic(prompt, maxTokens) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": envFrom(ANTHROPIC_KEYS), "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.MODEL || "claude-opus-4-8", max_tokens: maxTokens || 1200, system: SYSTEM, messages: [{ role: "user", content: prompt }] }),
  });
  if (!r.ok) throw new Error(`anthropic ${r.status}`);
  const d = await r.json();
  return (d?.content || []).map((b) => b.text || "").join("").trim();
}

const PROVIDERS = [
  { name: "gemini", keys: GEMINI_KEYS, call: (p, m) => callGemini(p, m) },
  { name: "groq", keys: GROQ_KEYS, call: (p, m) => callOAI("https://api.groq.com/openai/v1/chat/completions", envFrom(GROQ_KEYS), process.env.GROQ_MODEL || "llama-3.3-70b-versatile", p, m) },
  { name: "openai", keys: OPENAI_KEYS, call: (p, m) => callOAI("https://api.openai.com/v1/chat/completions", envFrom(OPENAI_KEYS), process.env.OPENAI_MODEL || "gpt-4o-mini", p, m) },
  { name: "anthropic", keys: ANTHROPIC_KEYS, call: (p, m) => callAnthropic(p, m) },
];
const available = () => PROVIDERS.filter((p) => p.keys.some((k) => process.env[k]));

async function ai(prompt, maxTokens) {
  const errs = [];
  for (const p of available()) {
    try { const out = await p.call(prompt, maxTokens); if (out) return out; } catch (e) { errs.push(`${p.name}: ${String(e).slice(0, 80)}`); }
  }
  throw new Error(errs.join(" | ") || "no_provider");
}

async function readBody(req) {
  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  if (b && typeof b === "object") return b;
  return await new Promise((resolve) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } }); });
}

const cCompact = (c) => ({ id: c.id, role: c.role, field: c.field, city: c.city, experience: c.experience, education: c.education, nationality: c.nationalityType, skills: c.skills });

function buildPrompt(b) {
  const role = String(b.role || "").slice(0, 1200);
  if (b.task === "match") {
    const list = (Array.isArray(b.candidates) ? b.candidates : []).slice(0, 120).map(cCompact);
    return `المطلوب توظيفه (وصف الدور أو المتطلبات):\n${role}\n\nقائمة المرشّحين (JSON):\n${JSON.stringify(list)}\n\nرتّب أفضل حتى 12 مرشّحاً مطابقة للدور. أعِد **فقط** مصفوفة JSON صحيحة بدون أي نص إضافي، كل عنصر: {"id":"...","score":0-100,"reason":"سبب موجز بجملة واحدة"}. رتّبها تنازلياً حسب score. لا تُدرج من لا يناسب إطلاقاً.`;
  }
  const c = b.candidate || {};
  const info = `المرشّح:\nالدور: ${c.role || "-"} · المجال: ${c.field || "-"} · المدينة: ${c.city || "-"} · الخبرة: ${c.experience || "-"} · التعليم: ${c.education || "-"} · الجنسية: ${c.nationalityType || "-"}\nالمهارات: ${c.skills || "-"}`;
  if (b.task === "summary") return `${info}\n\nاكتب تقييماً موجزاً (3-4 أسطر): نقاط القوة، مدى الملاءمة، وأي ملاحظة توطين مهمة.`;
  if (b.task === "interview") return `${info}\n${role ? "الدور المستهدف: " + role + "\n" : ""}\nاكتب 6 أسئلة مقابلة عملية ومخصّصة لهذا المرشّح (مزيج تقني وسلوكي)، مرقّمة.`;
  if (b.task === "outreach") return `${info}\n${role ? "الفرصة: " + role + "\n" : ""}\nاكتب رسالة تواصل قصيرة ومهنية (واتساب) لدعوة المرشّح للتقدّم عبر Business Partner. ودّية ومباشرة، أقل من 60 كلمة.`;
  return info;
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method === "GET") {
    return res.end(JSON.stringify({ status: "ok", providers: available().map((p) => p.name) }));
  }
  if (req.method !== "POST") { res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: "method_not_allowed" })); }
  if (!available().length) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "ai_not_configured" })); }

  const b = await readBody(req);
  const task = ["match", "summary", "interview", "outreach"].includes(b.task) ? b.task : "";
  if (!task) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "bad_task" })); }

  try {
    const out = await ai(buildPrompt(b), task === "match" ? 2000 : 900);
    if (task === "match") {
      let ranked = [];
      try {
        const m = out.match(/\[[\s\S]*\]/);
        ranked = JSON.parse(m ? m[0] : out);
      } catch { ranked = []; }
      return res.end(JSON.stringify({ ok: true, task, ranked, raw: ranked.length ? undefined : out }));
    }
    return res.end(JSON.stringify({ ok: true, task, result: out }));
  } catch (e) {
    console.error("hire error", String(e).slice(0, 200));
    res.statusCode = 502;
    return res.end(JSON.stringify({ ok: false, error: "ai_failed" }));
  }
}
