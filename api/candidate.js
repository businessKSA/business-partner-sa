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
const N8N_ATS_WEBHOOK = envFrom(["N8N_ATS_WEBHOOK", "N8N_CANDIDATE_WEBHOOK", "BP_ATS_WEBHOOK"])
  || "https://businesspartnerai.app.n8n.cloud/webhook/bp-ats-application";
// Job postings + employer subscriptions DBs — used to look up who owns a
// posting so we can email them when a candidate applies to it.
const JOBS_DB = process.env.NOTION_JOBS_DB || "260d76959d464631943f79f313fbf3c9";
const EMP_DB = process.env.NOTION_EMPLOYERS_DB || "f1104f8bcc3d4beb84accdbda0aa8322";

// Email (Resend) — optional; activates once RESEND_API_KEY is set in Vercel.
const RESEND_API_KEY = envFrom(["RESEND_API_KEY", "RESEND_KEY", "RESEND"]);
const FROM = process.env.OTP_FROM_EMAIL || "Business Partner <onboarding@resend.dev>";
async function sendMail(to, subject, html) {
  if (!RESEND_API_KEY || !isEmail(to)) return { ok: false };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
    return { ok: r.ok };
  } catch { return { ok: false }; }
}

const isEmail = (e) => typeof e === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const clip = (s, n = 300) => String(s || "").trim().slice(0, n);
const rt = (v) => (v ? [{ text: { content: clip(v, 1800) } }] : []);
// Notion rich_text values are arrays of text objects, each capped at ~2000
// chars by the API — chunking (unlike rt()'s single truncated block) lets a
// property hold something as long as a full CV.
function rtChunks(v, maxChars = 1900, maxChunks = 6) {
  const s = String(v || "").trim();
  if (!s) return [];
  const chunks = [];
  for (let i = 0; i < s.length && chunks.length < maxChunks; i += maxChars) chunks.push({ text: { content: s.slice(i, i + maxChars) } });
  return chunks;
}

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
  [/مطور|برمج|بيانات|شبكات|أنظمة|أمن سيبراني|تقنية|قواعد بيانات|سحاب|developer|software|data (analyst|scientist|engineer)|network|system admin|cyber|devops|cloud|qa engineer|database|it support|it manager|ai engineer|blockchain|iot engineer/i, "تقنية معلومات"],
  [/مبيعات|تسويق|علامة تجارية|سوشيال|محتوى|علاقات عامة|sales|marketing|brand|social media|content|public relations|copywriter|media buyer/i, "مبيعات وتسويق"],
  [/إداري|سكرتير|استقبال|مساعد شخصي|مدخل بيانات|مشتريات|مدير مكتب|admin|secretary|receptionist|personal assistant|data entry|procurement|office manager/i, "إداري وسكرتارية"],
  [/موارد بشرية|توظيف|تدريب وتطوير|تعويضات ومزايا|استقطاب|hr specialist|hr manager|recruiter|talent acquisition|training & development|compensation/i, "موارد بشرية"],
  [/شيف|طاه|نادل|فندق|مطعم|ضيافة|باريستا|ساقي|نزلاء|سياح|رحلات|chef|waiter|hotel|restaurant|hospitality|barista|bartender|guest relations|housekeeping|tour|travel|cruise/i, "ضيافة وسياحة"],
  [/مهندس مدني|مهندس ميكانيك|مهندس كهرباء|إنشائي|موقع|مقاولات|معماري|مساح|سلامة|مقدم عمال|civil engineer|mechanical engineer|electrical engineer|structural|construction|architect|surveyor|site engineer|safety officer|hse|foreman|quantity surveyor/i, "مقاولات وإنشاءات"],
  [/عقار|تأجير|إيجار|real estate|property|leasing|appraiser/i, "عقارات"],
  [/طبيب|ممرض|صيدل|علاج طبيعي|مختبر|أشعة|جرّاح|تخدير|أطفال|قلب|جلدية|نفسي|بصريات|قابلة|مسعف|physician|nurse|pharmacist|dentist|physiotherap|lab technician|radiolog|surgeon|pediatric|cardiolog|dermatolog|psychiatr|optometr|midwife|paramedic/i, "صحة وطب"],
  [/معلم|مدرس|مدير مدرسة|مرشد أكاديمي|مناهج|teacher|tutor|principal|academic advisor|curriculum|lecturer|librarian/i, "تعليم"],
  [/سائق|مستودع|لوجستيات|شحن|جمارك|أسطول|رافعة|driver|warehouse|logistics|shipping|customs|fleet|forklift|courier|dispatcher|bus driver|taxi/i, "لوجستيات ونقل"],
  [/محامٍ|قانون|قضائي|عقود|كاتب عدل|ملكية فكرية|lawyer|legal|attorney|paralegal|notary|litigation|intellectual property|contract manager/i, "قانون"],
  [/تصنيع|مصنع|إنتاج|CNC|لحّام|نجّار|دهّان|manufactur|production supervisor|plant manager|assembly|machine operator|welder|carpenter|textile|packaging/i, "تصنيع وصناعة"],
  [/بترول|نفط|غاز|حفر|مكامن|طاقة|شمسية|رياح|petroleum|drilling|reservoir|oil|gas|energy|solar|wind turbine|power plant/i, "طاقة ونفط وغاز"],
  [/إعلام|صحفي|محرر|مخرج|منتج|سيناريو|مصور|فنان|موسيقى|journalist|editor|film director|producer|screenwriter|photograph|animator|actor|musician|dj\b/i, "إعلام وإبداع"],
  [/حكومي|بلدي|جمارك|جوازات|دبلوماسي|دفاع مدني|government|municipal|customs officer|immigration officer|diplomat|civil defense|public sector/i, "حكومي وقطاع عام"],
  [/زراع|مزرعة|ري|نحّال|بيطري|farm|agricultur|irrigation|beekeep|veterinar|agronomist|fisheries|greenhouse/i, "زراعة وبيئة"],
  [/تجزئة|متجر|كاشير|أمين صندوق|تجارة إلكترونية|retail|cashier|store manager|merchandis|e-commerce|category manager/i, "تجزئة وتجارة إلكترونية"],
  [/أمن|حراسة|سلامة من الحريق|طوارئ|مراقبة|security|guard|cctv|fire safety|emergency response|close protection/i, "أمن وسلامة"],
  [/سبّاك|كهربائي|فني|صيانة|حداد|بنّاء|زجاج|أقفال|plumber|electrician|technician|maintenance|mason|blacksmith|glazier|locksmith|hvac|mechanic/i, "حرف مهنية وصيانة"],
  [/باحث|كيميائي|فيزيائي|أحيائي|إحصائي|فلكي|researcher|scientist|chemist|physicist|biologist|statistician|laboratory manager/i, "علوم وأبحاث"],
  [/طيار|طاقم طيران|بحري|ربان|ميناء|pilot|cabin crew|air traffic|aircraft maintenance|marine|seaman|deck officer|port operations/i, "طيران وبحري"],
  [/تجميل|مكياج|سبا|تدليك|يوغا|حلاق|مصفف|beauty|makeup|spa|massage|yoga|barber|hairstylist|esthetician|salon/i, "تجميل وعناية"],
  [/عاملة منزلية|مربية|جليسة|طباخ منزلي|بستاني|خادم|مرافق كبار سن|domestic worker|nanny|babysitter|private driver|private chef|butler|elderly caregiver/i, "خدمات منزلية"],
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

// Calls the n8n ATS workflow and waits for its enrichment (CV text extraction,
// AI screening, Drive storage links) so it can be folded into the same Notion
// write below — n8n itself no longer writes to Notion, to avoid creating a
// second candidate record for every submission (this handler is always the
// sole Notion writer). A 25s cap keeps this under Vercel's function timeout
// even though the full n8n chain (PDF parse + AI + Drive + emails) can run
// close to that; on timeout/failure we just skip enrichment and continue —
// the candidate record still gets created from the form fields alone.
async function forwardToN8n(payload) {
  if (!N8N_ATS_WEBHOOK) return { configured: false, ok: false };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const r = await fetch(N8N_ATS_WEBHOOK, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    let data = null;
    try { data = await r.json(); } catch { /* non-JSON or empty body */ }
    return { configured: true, ok: r.ok, status: r.status, data };
  } catch (e) {
    console.error("n8n ATS forward failed", String(e).slice(0, 200));
    return { configured: true, ok: false, error: "forward_failed" };
  } finally {
    clearTimeout(timer);
  }
}

// Folds the n8n workflow's CV-processing result (Drive links + AI screening)
// into the Notion properties this handler is about to write. Safe no-op when
// n8n didn't respond in time or found nothing — the base form-field record
// still gets created either way.
function applyN8nEnrichment(props, n8nResult, isNewCandidate) {
  const data = n8nResult && n8nResult.ok ? n8nResult.data : null;
  if (!data) return;
  const drive = data.drive || {};
  if (!props["CV Link"] && /^https?:\/\//i.test(drive.originalCvUrl || "")) {
    props["CV Link"] = { url: drive.originalCvUrl };
  }
  if (/^https?:\/\//i.test(drive.atsCvDocUrl || "")) {
    props["ATS CV (Drive)"] = { url: drive.atsCvDocUrl };
  }
  if (/^https?:\/\//i.test(drive.candidateFolderUrl || "")) {
    props["مجلد المرشح (Drive)"] = { url: drive.candidateFolderUrl };
  }
  const ai = data.ai || {};
  if (ai.candidate_summary) {
    const notesSoFar = (props["Notes"]?.rich_text || []).map((t) => t.text.content).join("\n");
    props["Notes"] = { rich_text: rt([notesSoFar, `ملخص الذكاء الاصطناعي: ${ai.candidate_summary}`].filter(Boolean).join("\n\n")) };
  }
  // The full AI-generated CV text, stored directly (not just the Drive doc
  // link) so the site can render it as formatted text on the candidate's
  // profile instead of sending employers to an external file. rt() caps at
  // 1800 chars in one block — a full CV needs more, so this is chunked
  // across several Notion rich_text blocks instead.
  if (ai.ats_cv_markdown) {
    props["ATS CV Text"] = { rich_text: rtChunks(ai.ats_cv_markdown) };
  }
  // Only a brand-new candidate's starting stage is AI-informed — an existing
  // candidate may already be further along the pipeline and must not be
  // pushed backward by a resubmission.
  const pipelineStage = data.screening && data.screening.pipelineStage;
  if (isNewCandidate && pipelineStage) {
    props["Pipeline Stage"] = { select: { name: pipelineStage } };
  }
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

const txt = (p) => {
  if (!p) return "";
  if (p.type === "title") return (p.title || []).map((t) => t.plain_text).join("");
  if (p.type === "rich_text") return (p.rich_text || []).map((t) => t.plain_text).join("");
  if (p.type === "select") return p.select ? p.select.name : "";
  if (p.type === "number") return p.number != null ? String(p.number) : "";
  if (p.type === "email") return p.email || "";
  if (p.type === "phone_number") return p.phone_number || "";
  if (p.type === "url") return p.url || "";
  return "";
};

// Best-effort — never throws, never blocks the candidate's own submission
// from succeeding. jobId is the JOBS_DB page id the "Apply" button set, or
// the "candidate-pool" placeholder for a general (not job-specific) signup,
// which has no owner to notify.
async function notifyEmployerOfApplication(jobId, jobTitle, candidate) {
  if (!jobId || jobId === "candidate-pool" || !RESEND_API_KEY) return;
  try {
    const jobPage = await notion(`pages/${jobId}`, "GET");
    if (!jobPage.ok) return;
    const jobData = await jobPage.json();
    const employerCode = txt(jobData.properties && jobData.properties["رمز صاحب العمل"]);
    if (!employerCode) return;
    const empR = await notion(`databases/${EMP_DB}/query`, "POST", {
      page_size: 1,
      filter: { property: "رمز الوصول", rich_text: { equals: employerCode } },
    });
    if (!empR.ok) return;
    const empData = await empR.json();
    const empRow = (empData.results || [])[0];
    if (!empRow) return;
    const employerEmail = txt(empRow.properties && empRow.properties["البريد"]);
    if (!isEmail(employerEmail)) return;
    const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const html = `<p>مرشّح جديد تقدّم على وظيفة <strong>${esc(jobTitle)}</strong> اللي نشرتها في نظام التوظيف.</p>
      <p><strong>الاسم:</strong> ${esc(candidate.name)}<br><strong>الجوال:</strong> ${esc(candidate.phone)}${candidate.field ? `<br><strong>المجال:</strong> ${esc(candidate.field)}` : ""}${candidate.city ? `<br><strong>المدينة:</strong> ${esc(candidate.city)}` : ""}</p>
      <p>سجّل الدخول للوحة التوظيف لمراجعة الملف الكامل والتواصل معه.</p>`;
    await sendMail(employerEmail, `مرشّح جديد تقدّم على وظيفة ${jobTitle}`, html);
  } catch (e) {
    console.error("employer application notify error", String(e).slice(0, 200));
  }
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "GET") {
    const url = new URL(req.url, "http://x");
    const checkPhone = clip(url.searchParams.get("phone"), 40);
    const checkEmail = clip(url.searchParams.get("email"), 160).toLowerCase();
    // Self-view: a candidate looks up their own record by the same
    // phone+email pair they applied with — no separate login system, and
    // no data is exposed unless both match the same record (candidates
    // don't know each other's phone AND email together by chance).
    if (checkPhone && checkEmail) {
      if (!NOTION_TOKEN) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "not_configured" })); }
      const r = await notion("databases/" + DB_ID + "/query", "POST", {
        page_size: 1,
        filter: { and: [{ property: "Phone", phone_number: { equals: checkPhone } }, { property: "Email", email: { equals: checkEmail } }] },
      });
      if (!r.ok) { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_failed" })); }
      const data = await r.json();
      const page = (data.results || [])[0];
      if (!page) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: "not_found" })); }
      const p = page.properties || {};
      res.statusCode = 200;
      return res.end(JSON.stringify({
        ok: true,
        candidate: {
          name: txt(p["Name (EN)"]) || txt(p["Candidate Name"]),
          field: txt(p["Field"]),
          targetRole: txt(p["Target Role"]),
          city: txt(p["City"]),
          country: txt(p["Country"]),
          nationality: txt(p["Nationality"]),
          residenceStatus: txt(p["حالة الإقامة"]),
          experienceYears: txt(p["Experience Years"]),
          expectedSalary: txt(p["Expected Salary"]),
          pipelineStage: txt(p["Pipeline Stage"]),
          cvLink: txt(p["CV Link"]),
          atsCvLink: txt(p["ATS CV (Drive)"]),
          registered: page.created_time,
        },
      }));
    }
    res.statusCode = 200;
    // seenKeyNames helps diagnose a mis-named / wrong-project token without leaking it.
    const seenKeyNames = Object.keys(process.env).filter((k) => /notion/i.test(k));
    return res.end(JSON.stringify({ status: "ok", configured: !!NOTION_TOKEN, n8n: !!N8N_ATS_WEBHOOK, seenKeyNames }));
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
  const country = clip(b.country, 120);
  const nationality = clip(b.nationality, 120);
  const RESIDENCE_STATUSES = ["مواطن سعودي", "مقيم بإقامة نظامية قابلة للنقل", "مقيم بإقامة غير قابلة للنقل", "خارج السعودية", "أخرى"];
  const residenceStatus = RESIDENCE_STATUSES.includes(b.residenceStatus) ? b.residenceStatus : "";
  const salary = clip(b.salary, 80);
  const linkedin = clip(b.linkedin, 400);
  const cvUrl = clip(b.cvUrl, 600);
  const consent = b.consent === true || b.consent === "true";
  const jobId = clip(b.jobId || "candidate-pool", 120);
  const jobTitle = clip(b.jobTitle || "General candidate pool", 220);
  const questions = b.questions && typeof b.questions === "object" ? b.questions : {};
  const cvFile = b.cvFile && typeof b.cvFile === "object" ? {
    name: clip(b.cvFile.name, 220),
    type: clip(b.cvFile.type, 120),
    size: Number(b.cvFile.size) || 0,
    base64: typeof b.cvFile.base64 === "string" ? b.cvFile.base64 : "",
  } : null;

  if (!name || !phone) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: "invalid_fields" }));
  }

  const expYears = experienceYears(exp);
  const expectedSalary = firstNumber(salary);
  const fieldCat = guessField(field);
  const answerLines = [
    `تقديم عبر الموقع — الوظيفة: ${jobTitle} (${jobId})`,
    consent ? "وافق على الانضمام والمشاركة بموافقة" : "لم يوافق صراحة",
    questions.interest ? `سبب الاهتمام: ${clip(questions.interest, 700)}` : "",
    questions.strengths ? `أقوى المهارات: ${clip(questions.strengths, 700)}` : "",
    questions.notice ? `فترة الإشعار: ${clip(questions.notice, 120)}` : "",
    residenceStatus ? `حالة الإقامة: ${residenceStatus}` : "",
    cvFile && cvFile.name ? `ملف مرفوع للـ n8n: ${cvFile.name} (${cvFile.type || "file"})` : "",
  ].filter(Boolean).join("\n");

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
    "Notes": { rich_text: rt(answerLines) },
  };
  if (isEmail(email)) props["Email"] = { email };
  if (fieldCat) props["Field"] = { select: { name: fieldCat } };
  if (expectedSalary != null) props["Expected Salary"] = { number: expectedSalary };
  if (/^https?:\/\//i.test(cvUrl)) props["CV Link"] = { url: cvUrl };
  if (country) props["Country"] = { rich_text: rt(country) };
  if (nationality) {
    props["Nationality"] = { rich_text: rt(nationality) };
    // Best-effort citizenship signal for the employer browse filter — a
    // dedicated "Saudi national" pick on Residence Status is authoritative;
    // otherwise infer from the nationality text itself.
    const isSaudiNational = residenceStatus === "مواطن سعودي" || /^(saudi arabia|السعودية)$/i.test(nationality);
    props["Nationality Type"] = { select: { name: isSaudiNational ? "سعودي" : "غير سعودي" } };
  }
  if (residenceStatus) props["حالة الإقامة"] = { select: { name: residenceStatus } };

  try {
    const n8nPayload = {
      source: "website-careers",
      receivedAt: new Date().toISOString(),
      candidate: { name, phone, email, field, fieldCategory: fieldCat, experience: exp, city, country, nationality, residenceStatus, salary, linkedin, consent },
      job: { id: jobId, title: jobTitle },
      questions,
      cvFile,
      ats: { notionDatabaseId: DB_ID },
    };
    const n8n = await forwardToN8n(n8nPayload);
    const existing = await findExisting(email, phone);
    if (existing) {
      applyN8nEnrichment(props, n8n, false);
      const r = await notion("pages/" + existing.id, "PATCH", { properties: props });
      if (!r.ok) {
        console.error("Notion update error", r.status, (await r.text()).slice(0, 400));
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, error: "notion_failed" }));
      }
      await notifyEmployerOfApplication(jobId, jobTitle, { name, phone, field, city });
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, ref: "CV-" + existing.id.slice(-6), updated: true, n8n }));
    }
    // New candidates always start at the top of the pipeline, pending review —
    // applyN8nEnrichment may raise this to an AI-informed stage below.
    props["Pipeline Stage"] = { select: { name: "جديد" } };
    applyN8nEnrichment(props, n8n, true);
    const r = await notion("pages", "POST", { parent: { database_id: DB_ID }, properties: props });
    if (!r.ok) {
      console.error("Notion create error", r.status, (await r.text()).slice(0, 400));
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "notion_failed" }));
    }
    const page = await r.json();
    const ref = "CV-" + page.id.slice(-6);
    await notifyEmployerOfApplication(jobId, jobTitle, { name, phone, field, city });
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ref, updated: false, n8n }));
  } catch (e) {
    console.error("candidate handler error", e);
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "server_error" }));
  }
}
