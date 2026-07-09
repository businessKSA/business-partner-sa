// Business Partner 3.0 — job-seeker (candidate) intake → Notion (ESM).
// Writes a submission from the /careers "Submit your CV" form directly into
// the main "🧑‍💼 BP Candidates — ATS" database — the same one /api/candidates
// serves to employers — so self-registered candidates actually show up in
// the pool instead of sitting in a disconnected silo. De-duplicates by
// email/phone so a mass public post never creates repeat rows for the same
// person. Works without a token too (the front-end then offers the
// WhatsApp fallback).
//
// Env vars:
//   NOTION_TOKEN            Notion internal integration secret (share the DB with it)
//   NOTION_ATS_DB           optional override of the ATS database id
//
// GET  /api/candidate  -> { status, configured }
// POST /api/candidate  -> { ok, ref, updated } | { ok:false, error }

// Accept the token under any of these env-var names (people name it differently
// in Vercel — be forgiving so a mis-named key never silently disables intake).
const envFrom = (names) => {
  for (const n of names) {
    const v = process.env[n];
    if (v && String(v).trim()) return String(v).trim();
  }
  return "";
};
const NOTION_TOKEN = envFrom([
  "NOTION_TOKEN", "NOTION_SECRET", "NOTION_API_KEY", "NOTION_KEY",
  "NOTION_INTEGRATION_TOKEN", "BusinessPartnerSiteNotion",
  "BUSINESS_PARTNER_SITE_NOTION", "NOTION",
]);
const DB_ID = process.env.NOTION_ATS_DB || "71792742873e4de398135c7855542b95";
const NOTION_VERSION = "2022-06-28";

const isEmail = (e) => typeof e === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const clip = (s, n = 300) => String(s || "").trim().slice(0, n);
const rt = (v) => (v ? [{ text: { content: clip(v, 1800) } }] : []);

// First integer found in a free-text years-of-experience value (the careers
// form's combobox produces things like "5+ سنوات" / "5+ years" / "بدون خبرة").
function experienceYears(exp) {
  const m = String(exp || "").match(/\d+/);
  return m ? Number(m[0]) : 0;
}
// First integer found in a salary-range string (e.g. "8,000–12,000").
function firstNumber(s) {
  const m = String(s || "").replace(/,/g, "").match(/\d+/);
  return m ? Number(m[0]) : null;
}

// Maps a free-typed/picked job title to one of the ATS's fixed Field select
// options (same taxonomy the careers-form combobox and the Outlook→ATS
// pipeline both use) so self-registered candidates are searchable/filterable
// exactly like every other source.
const FIELD_RULES = [
  [/محاسب|مالي|تدقيق|رواتب|خزينة|ائتمان|استثمار|مصرف|accountant|financial|audit|payroll|treasury|credit|investment|bank/i, "محاسبة ومالية"],
  [/مطور|برمج|بيانات|شبكات|أنظمة|أمن سيبراني|تقنية|قواعد بيانات|سحاب|developer|software|data (analyst|scientist|engineer)|network|system admin|cyber|devops|cloud|qa engineer|database|it support|it manager/i, "تقنية معلومات"],
  [/مبيعات|تسويق|علامة تجارية|سوشيال|محتوى|علاقات عامة|sales|marketing|brand|social media|content|public relations/i, "مبيعات وتسويق"],
  [/إداري|سكرتير|استقبال|مساعد شخصي|مدخل بيانات|مشتريات|مدير مكتب|admin|secretary|receptionist|personal assistant|data entry|procurement|office manager/i, "إداري وسكرتارية"],
  [/موارد بشرية|توظيف|تدريب وتطوير|تعويضات ومزايا|استقطاب|hr specialist|hr manager|recruiter|talent acquisition|training & development|compensation/i, "موارد بشرية"],
  [/شيف|طاه|نادل|فندق|مطعم|ضيافة|باريستا|ساقي|نزلاء|chef|waiter|hotel|restaurant|hospitality|barista|bartender|guest relations|housekeeping/i, "ضيافة ومطاعم"],
  [/مهندس مدني|مهندس ميكانيك|مهندس كهرباء|إنشائي|موقع|مقاولات|معماري|مساح|سلامة|مقدم عمال|civil engineer|mechanical engineer|electrical engineer|structural|construction|architect|surveyor|site engineer|safety officer|hse|foreman|quantity surveyor/i, "مقاولات وإنشاءات"],
  [/طبيب|ممرض|صيدل|علاج طبيعي|مختبر|أشعة|physician|nurse|pharmacist|dentist|physiotherap|lab technician|radiolog/i, "صحة وطب"],
  [/معلم|مدرس|مدير مدرسة|مرشد أكاديمي|مناهج|teacher|tutor|principal|academic advisor|curriculum/i, "تعليم"],
  [/سائق|مستودع|لوجستيات|شحن|جمارك|أسطول|رافعة|driver|warehouse|logistics|shipping|customs|fleet|forklift/i, "لوجستيات ونقل"],
];
function guessField(title) {
  const t = String(title || "");
  for (const [re, cat] of FIELD_RULES) if (re.test(t)) return cat;
  return "";
}

async function readBody(req) {
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  if (body) return body;
  return await new Promise((resolve) => {
    let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
  });
}

async function notion(path, method, payload) {
  return fetch(`https://api.notion.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });
}

// De-dup guard: a mass public post means many people may submit twice (retry,
// different device, etc). Match by email OR phone against the same DB
// employers browse, so a repeat submission updates the existing row instead
// of creating a duplicate candidate.
async function findExisting(email, phone) {
  const or = [];
  if (isEmail(email)) or.push({ property: "Email", email: { equals: email } });
  if (phone) or.push({ property: "Phone", phone_number: { equals: phone } });
  if (!or.length) return null;
  const r = await notion("databases/" + DB_ID + "/query", "POST", { page_size: 1, filter: { or } });
  if (!r.ok) return null;
  const data = await r.json();
  return (data.results || [])[0] || null;
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "GET") {
    res.statusCode = 200;
    // seenKeyNames helps diagnose a mis-named / wrong-project token without leaking it.
    const seenKeyNames = Object.keys(process.env).filter((k) => /notion/i.test(k));
    return res.end(JSON.stringify({ status: "ok", configured: !!NOTION_TOKEN, seenKeyNames }));
  }
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: "method_not_allowed" }));
  }
  if (!NOTION_TOKEN) {
    res.statusCode = 503;
    return res.end(JSON.stringify({ ok: false, error: "not_configured" }));
  }

  const b = await readBody(req);
  const name = clip(b.name, 160);
  const phone = clip(b.phone, 40);
  const email = clip(b.email, 160).toLowerCase();
  const field = clip(b.field, 200);
  const exp = clip(b.experience, 80);
  const city = clip(b.city, 120);
  const salary = clip(b.salary, 80);
  const linkedin = clip(b.linkedin, 400);
  const cvUrl = clip(b.cvUrl, 600);
  const consent = b.consent === true || b.consent === "true";

  if (!name || !phone) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: "invalid_fields" }));
  }

  const expYears = experienceYears(exp);
  const expectedSalary = firstNumber(salary);
  const fieldCat = guessField(field);

  const props = {
    "Candidate Name": { title: [{ text: { content: name } }] },
    "Phone": { phone_number: phone },
    "City": { rich_text: rt(city) },
    "Target Role": { rich_text: rt(field) },
    "Experience Years": { number: expYears },
    "Skills": { rich_text: rt([field, linkedin].filter(Boolean).join(" · ")) },
    "Source": { select: { name: "الموقع" } },
    "مخفي عن الموقع": { checkbox: false },
    "حالة القراءة": { select: { name: "مكتمل" } },
    "Notes": { rich_text: rt(`تسجيل ذاتي عبر الموقع${consent ? " — وافق على التقديم نيابةً" : ""}`) },
  };
  if (isEmail(email)) props["Email"] = { email };
  if (fieldCat) props["Field"] = { select: { name: fieldCat } };
  if (expectedSalary != null) props["Expected Salary"] = { number: expectedSalary };
  if (/^https?:\/\//i.test(cvUrl)) props["CV Link"] = { url: cvUrl };

  try {
    const existing = await findExisting(email, phone);
    if (existing) {
      const r = await notion("pages/" + existing.id, "PATCH", { properties: props });
      if (!r.ok) {
        console.error("Notion update error", r.status, (await r.text()).slice(0, 400));
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, error: "notion_failed" }));
      }
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, ref: "CV-" + existing.id.slice(-6), updated: true }));
    }
    // New candidates always start at the top of the pipeline, pending review.
    props["Pipeline Stage"] = { select: { name: "جديد" } };
    const r = await notion("pages", "POST", { parent: { database_id: DB_ID }, properties: props });
    if (!r.ok) {
      console.error("Notion create error", r.status, (await r.text()).slice(0, 400));
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "notion_failed" }));
    }
    const page = await r.json();
    const ref = "CV-" + page.id.slice(-6);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ref, updated: false }));
  } catch (e) {
    console.error("candidate handler error", e);
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "server_error" }));
  }
}
