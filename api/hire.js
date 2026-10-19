// Business Partner 3.0 — AI Hiring assistant (ESM). Powers the "AI Hiring OS"
// employer dashboard: match candidates to a role, summarise a candidate, draft
// interview questions, and write outreach messages. Free-first provider
// Azure OpenAI first (owner policy, September 2026: the digital infrastructure
// is Microsoft Azure). Once Azure is configured the other providers stay
// dormant unless DOC_AI_ALLOW_FALLBACK=1 — the same valve document reading
// uses. Until Azure is configured the old free-first chain keeps working, so
// the employer dashboard never goes dark waiting for an env var.
//
// POST /api/hire { task, role, candidate, candidates, lang }
//   task: "match" | "summary" | "interview" | "outreach"
// GET  /api/hire  -> { status, providers }
//
// ⚠️ المصادقة والقياس والسقف — أُضيفت 2026-09-29، انظر `authorize` أدناه.
// حتى ذلك اليوم كان المعالج يمضي من قراءة الجسم إلى نداء النموذج مباشرةً: بلا
// جلسة ولا رمز صاحب عمل ولا باقة ولا سقف. أي أحد على الإنترنت كان يستهلك رصيد
// Azure، و`task:"match"` مع `postingId` **يكتب في نوشن** فيعدّل «المرشحون
// المطابقون» في إعلانٍ حقيقي. والمهامّ ليست صنفاً واحداً: بعضها عامٌّ بحقّ
// (ترجمة إعلان لزائر، تحسين سيرة لمرشّح) فإقفاله يكسر خدمةً قائمة.

import { AZURE_KEYS, azureChat, azureConfigured, azureTextDeployment } from "./_azure.js";
import { employerBySession, portalUnlock, resolvePlan } from "./candidates.js";
import {
  anonSubject, countAnonToday, countToday, employerSubject, limits, logCall, windowEnd,
} from "./_hiremeter.js";
const envFrom = (names) => { for (const n of names) { if (process.env[n] && String(process.env[n]).trim()) return String(process.env[n]).trim(); } return ""; };
// Notion access — used to persist per-posting AI matches into the Job Postings
// DB's "المرشحون المطابقون" relation (postings ↔ ATS candidates).
const NOTION_TOKEN = envFrom([
  "NOTION_TOKEN", "NOTION_SECRET", "NOTION_API_KEY", "NOTION_KEY",
  "NOTION_INTEGRATION_TOKEN", "BusinessPartnerSiteNotion",
  "BUSINESS_PARTNER_SITE_NOTION", "NOTION",
]);
// ‏انظر api/chat.js: llama-3.3-70b-versatile أوقفته Groq في ٢٠٢٦/٠٨/١٦.

const SYSTEM = `أنت مساعد توظيف خبير لدى Business Partner (بيزنس بارتنر) في السعودية. تساعد أصحاب العمل على تقييم المرشّحين واتخاذ قرارات توظيف عملية وسريعة. كن دقيقاً وموجزاً ومهنياً، وراعِ أنظمة العمل والتوطين في السعودية. اكتب بلغة المستخدم (العربية افتراضياً). لا تختلق بيانات غير موجودة.`;

// Azure only. The Gemini/Groq/OpenAI/Anthropic callers and the
// DOC_AI_ALLOW_FALLBACK valve are gone on the owner's instruction: resilience
// belongs to the second Azure region (api/_azure.js), not to a second vendor.
const PROVIDERS = [
  { name: "azure", keys: AZURE_KEYS, call: (p, m) => azureChat({ system: SYSTEM, messages: [{ role: "user", content: p }], maxTokens: m || 1200, temperature: 0.4 }) },
];
const available = () => (azureConfigured() ? PROVIDERS : []);

// المسار الداخلي: api/candidate.js يستورد هذه الدالة ولا يمرّ بمعالج HTTP
// أدناه، فتحسين السيرة الحقيقي (buildCvBoostPrompt هناك) كان نداءَ ذكاءٍ بلا
// أي قياس. لا سقف هنا — المستدعي وحدة أخرى لها مصادقتها، والقياس لا يُشترط له
// طالب — لكنه **يُقاس**، وإلا بقي بندٌ في فاتورة Azure بلا سجلّ يشرحه.
export async function aiText(prompt, maxTokens, task = "internal") {
  const t0 = Date.now();
  const out = await ai(prompt, maxTokens);
  await logCall({
    subject: "svc:internal", kind: "internal", task,
    charsIn: String(prompt || "").length, charsOut: String(out || "").length,
    ms: Date.now() - t0, tokens: null, model: azureTextDeployment(),
  });
  return out;
}
export const aiAvailable = () => available().length > 0;

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
  // Job adverts are authored once in Arabic (Notion), so the site translates
  // them on demand for its other languages. Structure must survive intact —
  // the advert page splits the text back into paragraphs.
  if (b.task === "translate") {
    const names = { en: "English", fr: "French", es: "Spanish", zh: "Chinese (Simplified)", ru: "Russian", hi: "Hindi", ko: "Korean", ja: "Japanese", ar: "Arabic" };
    const target = names[String(b.lang || "en").toLowerCase()] || "English";
    const items = Array.isArray(b.items) ? b.items.slice(0, 60).map((x) => String(x == null ? "" : x).slice(0, 4000)) : null;
    // JSON in, JSON out: a delimiter-based contract was unreliable — models
    // drop or reformat separators, and a mismatched split has to be thrown
    // away, which silently left adverts untranslated.
    if (items) {
      return `Translate every string in this JSON array into ${target}.\n\nRules: translate faithfully; keep job titles natural for that language's job market; add nothing and drop nothing; keep line breaks inside a string as \\n. Return ONLY a JSON array of exactly ${items.length} strings in the same order — no code fences, no commentary.\n\n${JSON.stringify(items)}`;
    }
    return `Translate the job advert below into ${target}.\n\nRules: translate faithfully, keep the same paragraph and line breaks, keep job titles natural for that language's job market, do not add or remove any information, do not add commentary. Output only the translation.\n\n---\n${String(b.text || "").slice(0, 12000)}`;
  }
  // Rewrites a CV so it survives applicant-tracking software and reads well in
  // English, and scores it before and after. The rules exist because the
  // tempting version of this feature — inventing a better candidate — would
  // put a person's name on claims they never made, and send them into
  // interviews they cannot answer for.
  if (b.task === "cv-boost") {
    const cv = String(b.cvText || "").slice(0, 14000);
    const target = String(b.targetRole || "").slice(0, 200);
    return `You are an expert CV writer and an ATS (applicant tracking system) analyst.

Below is a candidate's CV, in whatever language and shape they wrote it.

TASK
1. Detect the language it is written in.
2. Rewrite it as an excellent, ATS-friendly CV **in English**. If the original is Arabic, this is also a translation.
3. If the original was NOT English, also give the same improved CV in the original language.
4. Score the ORIGINAL and the REWRITE, 0-100, on how well an ATS and a recruiter would read them.
5. List what you actually improved.

ABSOLUTE RULES — a violation makes the whole output useless:
- Invent NOTHING. No employer, job title, date, degree, certificate, tool or skill that is not in the original.
- Do not inflate seniority, do not extend dates, do not turn a duty into an achievement that was never claimed.
- Numbers may only appear if the candidate gave them. Never estimate a metric.
- If something is missing (no dates, no education), leave it out and name it in "missing" — do not paper over it.
- You improve WORDING, STRUCTURE, ORDER and KEYWORDS. You never improve the FACTS.

The rewrite should: lead with a short professional summary; use standard section headings (Summary, Skills, Work Experience, Education, Certifications, Languages); put the most relevant experience first; start bullets with strong action verbs; surface real keywords a recruiter would search for${target ? ` (target role: ${target})` : ""}; drop photos, tables, columns and graphics that ATS software cannot read.

Scoring must be honest: score_before reflects the original as written. score_after reflects the rewrite. If the original was already strong, the gain is small — say so rather than manufacturing a jump.

Return ONLY this JSON, no code fences, no commentary:
{"source_language":"Arabic|English|other","cv_english":"<full rewritten CV in markdown>","cv_original_language":"<same CV in the original language, or empty string if the original was English>","score_before":0-100,"score_after":0-100,"improvements":["...","..."],"missing":["..."],"target_role_guess":"..."}

CV:
---
${cv}`;
  }
  if (b.task === "jobdesc") {
    const title = String(b.title || "").slice(0, 200);
    const field = String(b.field || "").slice(0, 100);
    const city = String(b.city || "").slice(0, 100);
    return `اكتب وصفاً وظيفياً احترافياً وجاهزاً للنشر لهذه الوظيفة:\nالمسمى الوظيفي: ${title || "-"}${field ? "\nالمجال: " + field : ""}${city ? "\nالموقع: " + city : ""}\n\nيشمل: نبذة قصيرة عن الدور، المهام والمسؤوليات (نقاط)، المؤهلات والخبرة المطلوبة (نقاط). لا تُدرج اسم شركة أو راتب. أعِد النص فقط بدون عناوين Markdown مثل ## — فقرات ونقاط عادية.`;
  }
  return info;
}

// ---------------------------------------------------------------------------
// المصادقة — تصنيف المهامّ السبع، ولكلٍّ سببه من مستدعيه الفعلي في المستودع
// (`grep -rn '/api/hire' site/ api/` — أُجري قبل كتابة هذا السطر):
//
// تتطلّب صاحب عمل (403 locked بلا ذلك):
//   jobdesc    لوحة صاحب العمل الجديدة وحدها (simple-v1-employer.mjs:1449)،
//              وهي بجلسة بريدٍ مُثبت. ومستدعيه الآخر (hr-app.js) في اللوحة
//              القديمة، و/hr/employer* يُحوَّل ٣٠٧ إلى الجديدة (vercel.json).
//   summary · interview · outreach   لا مستدعي لها إلا لوحة main.js القديمة
//              المحوَّلة — وهي تعمل على **بيانات مرشّح شخصية** يرسلها المستدعي.
//   match مع postingId   هذا هو الذي **يكتب في نوشن**. ولا يكفي أن يكون
//              المُستدعي صاحب عملٍ مشتركاً: يجب أن يكون الإعلان إعلانَه
//              (postingOwner أدناه) — كما يفلتر update-posting في
//              api/candidates.js على «رمز صاحب العمل» حرفاً بحرف.
//
// عامّة بحقّ (تبقى مفتوحة، ومقيسة ومسقوفة كزائر):
//   translate  صفحة الإعلان العامة تترجم الإعلان لكل زائر غير عربي
//              (main.js:1254، بلا جلسة). إقفاله = إعلانات بالعربية للعالم كله.
//   cv-boost   للمرشّح لا لصاحب العمل. لا مستدعي له اليوم في المستودع، ومع ذلك
//              يبقى مفتوحاً: إقفاله يكسر خدمة المرشّحين لحظة وصولها، ومالكها
//              وكيلٌ آخر (recruitment-candidate).
//   match بلا postingId  تبويب «صاحب عمل» في /hiring العامة يستدعيه لزائرٍ بلا
//              حساب (simple-v1-hiring.mjs:1050)، وكذلك إيجنت الباحث عن عمل من
//              الخادم إلى الخادم (api/_jobhunt.js:226) بلا جلسة ولا رمز. وهو
//              قراءةٌ محضة: ترتيبٌ لقائمةٍ أرسلها المستدعي نفسه، لا كتابة.
//
// ⚠️ المتبقّي المعروف: نداءٌ عامٌّ يظل يستهلك رصيد Azure. حاجزه هنا سقفان
// (لكل عنوان، وللمجهولين جملةً) لا مصادقة. وإقفاله الكامل قرار مالك، ويلزمه
// قبله رمزٌ داخلي في api/_jobhunt.js (ملك recruitment-candidate) وإلا صمت
// إيجنت الباحث عن عمل.
const EMPLOYER_TASKS = new Set(["jobdesc", "summary", "interview", "outreach"]);
const needsEmployer = (task, b) => EMPLOYER_TASKS.has(task) || (task === "match" && !!b.postingId);
// المهامّ العامة لا تُكلّف الزائر سؤالاً في نوشن: لا يُحلّ صاحب عملٍ لها إلا
// إذا أرسل المستدعي رمزاً صريحاً. صفحة الإعلان العامة تُفتح كثيراً، ولا يُحمَّل
// كل فتحةٍ استعلامَ قاعدة أصحاب العمل.
const PUBLIC_TASKS = new Set(["translate", "cv-boost"]);

const clientIp = (req) => {
  const h = (req && req.headers) || {};
  const raw = String(h["x-forwarded-for"] || h["x-real-ip"] || "").split(",")[0].trim();
  return raw || "unknown";
};

// النمط نفسه الذي في api/candidates.js حرفياً: code:"self" (أو غائب) ← الرمز
// يُحلّ من الجلسة في الخادم ولا يغادرها · رمزٌ صريح ← resolvePlan · وإلا جلسة
// بوابة العميل في التجربة. والفشل ⇒ 403 locked.
async function authorize(req, b, task) {
  const asked = String(b.code || "").trim();
  const skipLookup = PUBLIC_TASKS.has(task) && !asked;
  let acct = null;
  if (!skipLookup) {
    if (!asked || asked === "self") acct = await employerBySession(req);
    else if (!asked.startsWith("org:")) {
      const r = await resolvePlan(asked);
      if (r && r.unlocked) acct = { ...r, code: asked };
    }
    if (!acct) acct = await portalUnlock(req);
  }
  if (acct && acct.code) {
    return {
      ok: true, kind: "employer", owner: !!acct.owner, code: acct.code,
      subject: employerSubject(acct.code),
      company: acct.company || "", plan: acct.plan || "",
    };
  }
  if (needsEmployer(task, b)) return { ok: false };
  const ip = clientIp(req);
  return { ok: true, kind: "anon", owner: false, code: "", subject: anonSubject(ip), company: "", plan: "" };
}

// مالك الإعلان في نوشن — لأن «مشتركاً ما» ليس «صاحب هذا الإعلان». يعيد null
// حين يتعذّر السؤال، وnull تمنع الكتابة: الفشل مغلقٌ في الكتابة وحدها.
async function postingOwner(postingId) {
  if (!NOTION_TOKEN) return null;
  try {
    const r = await fetch(`https://api.notion.com/v1/pages/${String(postingId).trim()}`, {
      headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": "2022-06-28" },
    });
    if (!r.ok) { console.error("posting owner lookup", r.status, (await r.text()).slice(0, 200)); return null; }
    const d = await r.json();
    const rt = ((d && d.properties && d.properties["رمز صاحب العمل"]) || {}).rich_text;
    return Array.isArray(rt) ? rt.map((x) => x.plain_text || "").join("").trim() : "";
  } catch (e) { console.error("posting owner error", String(e).slice(0, 160)); return null; }
}

// السقف اليومي. المالك بلا سقف. وتعذّر العدّ يفتح النداء عمداً: سقفٌ يمنع كل
// خدمةٍ لأن قاعدة البيانات صامتة أسوأ من سقفٍ لا يُطبَّق ساعةً.
async function quota(auth) {
  if (auth.owner) return { ok: true, limit: 0, used: 0 };
  const L = limits();
  const limit = auth.kind === "employer" ? L.employer : L.anon;
  const used = await countToday(auth.subject, limit);
  if (used !== null && used >= limit) return { ok: false, limit, used };
  if (auth.kind === "anon") {
    const total = await countAnonToday(L.anonTotal);
    if (total !== null && total >= L.anonTotal) return { ok: false, limit: L.anonTotal, used: total, shared: true };
  }
  return { ok: true, limit, used: used === null ? 0 : used };
}

function tooManyBody(q) {
  const end = windowEnd();
  const mins = Math.max(1, Math.round((end.getTime() - Date.now()) / 60000));
  const inWord = mins >= 60 ? `${Math.floor(mins / 60)} ساعة${mins % 60 ? ` و${mins % 60} دقيقة` : ""}` : `${mins} دقيقة`;
  const who = q.shared ? "للنداءات العامة (بلا حساب)" : "لحسابك";
  return {
    ok: false, error: "rate_limited", limit: q.limit, used: q.used, resets_at: end.toISOString(),
    message: `بلغتَ الحدّ اليومي لنداءات مساعد التوظيف الذكي ${who}: ${q.limit} نداءً في اليوم. ` +
      `يتجدّد الحدّ في منتصف الليل بتوقيت الرياض — بعد ${inWord}.`,
  };
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method === "GET") {
    return res.end(JSON.stringify({ status: "ok", providers: available().map((p) => p.name) }));
  }
  if (req.method !== "POST") { res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: "method_not_allowed" })); }
  if (!available().length) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "ai_not_configured" })); }

  const b = await readBody(req);
  const task = ["match", "summary", "interview", "outreach", "jobdesc", "translate", "cv-boost"].includes(b.task) ? b.task : "";
  if (!task) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "bad_task" })); }

  // المصادقة قبل أي نداء نموذج — ونفس شكل الردّ الذي يعرفه المتصفّح من
  // ?applicants=1 في api/candidates.js: 403 { ok:false, error:"locked" }.
  const auth = await authorize(req, b, task);
  if (!auth.ok) {
    res.statusCode = 403;
    return res.end(JSON.stringify({
      ok: false, error: "locked",
      message: "هذه الأداة لأصحاب العمل المشتركين — ادخل بحسابك أو فعّل اشتراكك.",
    }));
  }

  const q = await quota(auth);
  if (!q.ok) { res.statusCode = 429; return res.end(JSON.stringify(tooManyBody(q))); }

  try {
    const prompt = buildPrompt(b);
    const t0 = Date.now();
    const out = await ai(prompt, task === "match" ? 2000 : task === "translate" ? 4000 : task === "cv-boost" ? 6000 : 900);
    // القياس: لكل نداءٍ ناجح، وقبل أي فرعٍ يعود بالنتيجة — وفشله لا يُسقط
    // النداء (logCall لا ترمي بحال). انظر api/_hiremeter.js.
    await logCall({
      subject: auth.subject, kind: auth.kind, task,
      company: auth.company, plan: auth.plan,
      charsIn: prompt.length, charsOut: String(out || "").length,
      ms: Date.now() - t0, tokens: null, model: azureTextDeployment(),
    });
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
          // الإعلان يجب أن يكون إعلان المُستدعي. المقارنة كما في
          // api/candidates.js (update-posting): «رمز صاحب العمل» بلا حساسية
          // حالة. وتعذّر السؤال يمنع الكتابة ولا يمنع النتيجة.
          const ownerCode = await postingOwner(b.postingId);
          const mine = !!ownerCode && !!auth.code && ownerCode.toLowerCase() === auth.code.toLowerCase();
          const ids = !mine ? [] : ranked.slice(0, 12).map((m) => String(m.id || "").trim()).filter((s) => /^[0-9a-f]{8}-?[0-9a-f-]{20,28}$/i.test(s));
          if (!mine) console.warn("hire match: posting not owned by caller — relation not written");
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
    if (task === "translate" && Array.isArray(b.items)) {
      let arr = [];
      try { const m = out.match(/\[[\s\S]*\]/); arr = JSON.parse(m ? m[0] : out); } catch { arr = []; }
      if (!Array.isArray(arr) || arr.length !== b.items.length) {
        console.error("translate mismatch", b.items.length, Array.isArray(arr) ? arr.length : "unparsed");
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: false, error: "bad_translation" }));
      }
      return res.end(JSON.stringify({ ok: true, task, items: arr.map((x) => String(x == null ? "" : x)) }));
    }
    return res.end(JSON.stringify({ ok: true, task, result: out }));
  } catch (e) {
    console.error("hire error", String(e).slice(0, 200));
    res.statusCode = 502;
    return res.end(JSON.stringify({ ok: false, error: "ai_failed" }));
  }
}
