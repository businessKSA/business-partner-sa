// Business Partner 3.0 — AI Hiring assistant (ESM). Powers the "AI Hiring OS"
// employer dashboard: match candidates to a role, summarise a candidate, draft
// interview questions, and write outreach messages. Free-first provider
// failover (Gemini → Groq → OpenAI → Anthropic), same keys as the advisor.
//
// POST /api/hire { task, role, candidate, candidates, lang }
//   task: "match" | "summary" | "interview" | "outreach"
// GET  /api/hire  -> { status, providers }

const envFrom = (names) => { for (const n of names) { if (process.env[n] && String(process.env[n]).trim()) return String(process.env[n]).trim(); } return ""; };
// Notion access — used to persist per-posting AI matches into the Job Postings
// DB's "المرشحون المطابقون" relation (postings ↔ ATS candidates).
const NOTION_TOKEN = envFrom([
  "NOTION_TOKEN", "NOTION_SECRET", "NOTION_API_KEY", "NOTION_KEY",
  "NOTION_INTEGRATION_TOKEN", "BusinessPartnerSiteNotion",
  "BUSINESS_PARTNER_SITE_NOTION", "NOTION",
]);
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
    // Dedicated ANTHROPIC_MODEL, not a shared "MODEL" var — a generic name here
    // is a confirmed collision risk with another integration on the same
    // Vercel project, which broke every Anthropic call in production before.
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-opus-4-8", max_tokens: maxTokens || 1200, system: SYSTEM, messages: [{ role: "user", content: prompt }] }),
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

// Cheap keyword-overlap score between the role/JD text and a candidate's role+field+skills.
// Used only to pick WHICH 120 candidates reach the AI when the pool is larger than that —
// picking the first 120 as they arrive (most-recently-added first) silently drops relevant,
// older candidates from consideration entirely as the ATS grows past a few hundred profiles.
function keywordScore(text, c) {
  const words = String(text || "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1);
  if (!words.length) return 0;
  const hay = `${c.role || ""} ${c.field || ""} ${c.skills || ""}`.toLowerCase();
  return words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0);
}

function buildPrompt(b) {
  const role = String(b.role || "").slice(0, 1200);
  if (b.task === "match") {
    const all = Array.isArray(b.candidates) ? b.candidates : [];
    const ranked = all.length > 120
      ? all.map((c, i) => ({ c, i, s: keywordScore(role, c) })).sort((a, z) => z.s - a.s || a.i - z.i).map((x) => x.c)
      : all;
    const list = ranked.slice(0, 120).map(cCompact);
    return `المطلوب توظيفه (وصف الدور أو المتطلبات):\n${role}\n\nقائمة المرشّحين (JSON):\n${JSON.stringify(list)}\n\nرتّب أفضل حتى 12 مرشّحاً مطابقة للدور. أعِد **فقط** مصفوفة JSON صحيحة بدون أي نص إضافي، كل عنصر: {"id":"...","score":0-100,"reason":"سبب موجز بجملة واحدة"}. رتّبها تنازلياً حسب score. لا تُدرج من لا يناسب إطلاقاً.`;
  }
  const c = b.candidate || {};
  const info = `المرشّح:\nالدور: ${c.role || "-"} · المجال: ${c.field || "-"} · المدينة: ${c.city || "-"} · الخبرة: ${c.experience || "-"} · التعليم: ${c.education || "-"} · الجنسية: ${c.nationalityType || "-"}\nالمهارات: ${c.skills || "-"}`;
  if (b.task === "summary") return `${info}\n\nاكتب تقييماً موجزاً (3-4 أسطر): نقاط القوة، مدى الملاءمة، وأي ملاحظة توطين مهمة.`;
  if (b.task === "interview") return `${info}\n${role ? "الدور المستهدف: " + role + "\n" : ""}\nاكتب 6 أسئلة مقابلة عملية ومخصّصة لهذا المرشّح (مزيج تقني وسلوكي)، مرقّمة.`;
  if (b.task === "outreach") return `${info}\n${role ? "الفرصة: " + role + "\n" : ""}\nاكتب رسالة تواصل قصيرة ومهنية (واتساب) لدعوة المرشّح للتقدّم عبر Business Partner. ودّية ومباشرة، أقل من 60 كلمة.`;
  if (b.task === "jobdesc") {
    const title = String(b.title || "").slice(0, 200);
    const field = String(b.field || "").slice(0, 100);
    const city = String(b.city || "").slice(0, 100);
    return `اكتب وصفاً وظيفياً احترافياً وجاهزاً للنشر لهذه الوظيفة:\nالمسمى الوظيفي: ${title || "-"}${field ? "\nالمجال: " + field : ""}${city ? "\nالموقع: " + city : ""}\n\nيشمل: نبذة قصيرة عن الدور، المهام والمسؤوليات (نقاط)، المؤهلات والخبرة المطلوبة (نقاط). لا تُدرج اسم شركة أو راتب. أعِد النص فقط بدون عناوين Markdown مثل ## — فقرات ونقاط عادية.`;
  }
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
  const task = ["match", "summary", "interview", "outreach", "jobdesc"].includes(b.task) ? b.task : "";
  if (!task) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "bad_task" })); }

  try {
    const out = await ai(buildPrompt(b), task === "match" ? 2000 : 900);
    if (task === "match") {
      let ranked = [];
      try {
        const m = out.match(/\[[\s\S]*\]/);
        ranked = JSON.parse(m ? m[0] : out);
      } catch { ranked = []; }
      // When screening a published posting, mirror the shortlist into Notion:
      // the posting's "المرشحون المطابقون" relation links to the matched ATS
      // candidate pages (candidate ids ARE Notion page ids). Non-fatal — the
      // dashboard still gets its live results even if the relation write fails.
      if (b.postingId && Array.isArray(ranked) && ranked.length && NOTION_TOKEN) {
        try {
          const ids = ranked.slice(0, 12).map((m) => String(m.id || "").trim()).filter((s) => /^[0-9a-f]{8}-?[0-9a-f-]{20,28}$/i.test(s));
          if (ids.length) {
            const pr = await fetch(`https://api.notion.com/v1/pages/${String(b.postingId).trim()}`, {
              method: "PATCH",
              headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": "2022-06-28", "content-type": "application/json" },
              body: JSON.stringify({ properties: { "المرشحون المطابقون": { relation: ids.map((id) => ({ id })) } } }),
            });
            if (!pr.ok) console.error("posting relation update failed", pr.status, (await pr.text()).slice(0, 200));
          }
        } catch (e) { console.error("posting relation update error", e); }
      }
      return res.end(JSON.stringify({ ok: true, task, ranked, raw: ranked.length ? undefined : out }));
    }
    return res.end(JSON.stringify({ ok: true, task, result: out }));
  } catch (e) {
    console.error("hire error", String(e).slice(0, 200));
    res.statusCode = 502;
    return res.end(JSON.stringify({ ok: false, error: "ai_failed" }));
  }
}
