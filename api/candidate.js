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
export function guessField(title) {
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
// sole Notion writer). A 50s cap — under this route's 60s maxDuration —
// keeps us waiting long enough for the full n8n chain (PDF parse + AI +
// Drive + emails), which regularly ran past the old 25s cap and left the
// record with no ATS CV at all; on timeout/failure we skip enrichment and
// continue, and the record still gets created from the form fields alone.
export async function forwardToN8n(payload) {
  if (!N8N_ATS_WEBHOOK) return { configured: false, ok: false };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 50000);
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
export function applyN8nEnrichment(props, n8nResult, isNewCandidate) {
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
  // Notes is create-only: on a resubmission (isNewCandidate false) we must not
  // overwrite whatever the recruiter has since written into Notes, so the AI
  // summary is folded in only for a brand-new candidate row.
  if (isNewCandidate && ai.candidate_summary) {
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
export async function findExisting(email, phone) {
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

// Renders the AI-written CV (markdown) as e-mail HTML. Deliberately tiny —
// the generator only ever emits headings, list items, bold and blank lines.
const n8nAi = (r) => (r && r.ok && r.data && r.data.ai) || {};

export function cvMarkdownToHtml(md) {
  const e = (x) => String(x || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const inline = (x) => e(x).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  const out = [];
  let inList = false;
  const closeList = () => { if (inList) { out.push("</ul>"); inList = false; } };
  for (const raw of String(md || "").split(/\r?\n/)) {
    // Drive exports escape markdown punctuation, so "\# Name" arrives as-is.
    const line = raw.replace(/\\(?=[#*\-])/g, "").trim();
    // A blank line does NOT end the list: the Drive export puts one between
    // every bullet, so closing here would split each bullet into its own list.
    if (!line) continue;
    const heading = line.match(/^(#{1,6})\s*(.+)$/);
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (heading) {
      closeList();
      out.push(heading[1].length <= 1
        ? `<h2 style="color:#0B1B5A;font-size:19px;margin:20px 0 4px">${inline(heading[2])}</h2>`
        : `<h3 style="color:#0B1B5A;font-size:15px;margin:18px 0 6px;border-bottom:1px solid #E2E8F0;padding-bottom:4px">${inline(heading[2])}</h3>`);
    } else if (bullet) {
      if (!inList) { out.push('<ul style="margin:6px 0;padding-inline-start:20px">'); inList = true; }
      out.push(`<li style="margin:4px 0;line-height:1.7">${inline(bullet[1])}</li>`);
    } else {
      closeList();
      out.push(`<p style="margin:6px 0;line-height:1.7">${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join("\n");
}

// The candidate's own copy of what our pipeline produced for them: the summary
// the AI wrote about their profile, and their CV rewritten in ATS-friendly
// form. Deliberately NOT a forward of the internal notification — the
// screening score, the suggested pipeline stage and the internal Drive folder
// are our working notes ABOUT a person, not something to hand the person.
// Best-effort: never throws, never blocks the submission from succeeding.
export async function sendCandidateCopy(to, name, opts) {
  const o = opts || {};
  if (!isEmail(to) || !RESEND_API_KEY) return false;
  const ar = String(o.lang || "ar").toLowerCase().indexOf("en") !== 0;
  const T = (en, arabic) => (ar ? arabic : en);
  const e = (x) => String(x || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const first = String(name || "").trim().split(/\s+/)[0] || "";
  const applied = o.jobTitle && !/candidate pool|قاعدة المرشحين/i.test(o.jobTitle);

  const head = `<div dir="${ar ? "rtl" : "ltr"}" style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#1B2437">
    <h2 style="color:#0B1B5A;margin:0 0 6px">${T(`Hi ${e(first)} 👋`, `أهلاً ${e(first)} 👋`)}</h2>
    <p style="line-height:1.8;margin:0 0 14px">${applied
      ? T(`We received your application for <strong>${e(o.jobTitle)}</strong>.`, `استلمنا تقديمك على وظيفة <strong>${e(o.jobTitle)}</strong>.`)
      : T("You're now in the Business Partner candidate pool.", "أصبحت الآن ضمن قاعدة مرشحي Business Partner.")}${
      o.ref ? T(` Your reference: <strong>${e(o.ref)}</strong>.`, ` رقمك المرجعي: <strong>${e(o.ref)}</strong>.`) : ""}</p>`;

  const summaryBlock = o.summary ? `<div style="background:#F5F7FB;border-radius:12px;padding:14px 16px;margin:18px 0">
      <h3 style="color:#0B1B5A;margin:0 0 6px;font-size:15px">${T("Your professional summary", "ملخص ملفك المهني")}</h3>
      <p style="margin:0;line-height:1.8">${e(o.summary)}</p>
    </div>` : "";

  const cvBlock = o.atsCv ? `<div style="border:1px solid #E2E8F0;border-radius:12px;padding:18px 20px;margin:18px 0">
      <p style="margin:0 0 2px;color:#5A6478;font-size:12px">${T("Yours to keep and send anywhere", "نسخة لك، استخدمها كيفما شئت")}</p>
      <h3 style="color:#0B1B5A;margin:0 0 10px;font-size:17px">${T("Your CV, rewritten for applicant tracking systems", "سيرتك الذاتية بصيغة تقرأها أنظمة التوظيف (ATS)")}</h3>
      <p style="margin:0 0 14px;line-height:1.8;color:#5A6478;font-size:13px">${T(
        "Most employers filter CVs with software before a person ever reads them. This version is structured the way that software expects — copy it into a document and use it for any application, not only ours.",
        "أغلب أصحاب العمل يفرزون السير الذاتية ببرامج قبل أن يقرأها إنسان. هذه النسخة مرتّبة بالشكل الذي تتوقعه تلك البرامج — انسخها في ملف واستخدمها في أي تقديم، وليس لدينا فقط.")}</p>
      ${cvMarkdownToHtml(o.atsCv)}
    </div>` : "";

  const foot = `<h3 style="color:#0B1B5A;font-size:15px;margin:22px 0 6px">${T("What happens next", "ماذا بعد؟")}</h3>
    <ul style="margin:0 0 16px;padding-inline-start:20px;line-height:1.9">
      <li>${T("Our team reviews your profile against the roles we're hiring for.", "فريقنا يراجع ملفك مقابل الوظائف المفتوحة لدينا.")}</li>
      <li>${T("If there's a match, we contact you to arrange an interview.", "إذا كان هناك تطابق نتواصل معك لترتيب مقابلة.")}</li>
      <li>${T("Your profile stays with us for future openings — no need to reapply.", "ملفك يبقى محفوظاً للوظائف القادمة — لا حاجة لإعادة التقديم.")}</li>
    </ul>
    <p style="line-height:1.8;margin:0 0 6px">${T(
      `Everything open right now: <a href="https://www.businesspartner.sa/careers" style="color:#0B1B5A">businesspartner.sa/careers</a>`,
      `كل الوظائف المفتوحة: <a href="https://www.businesspartner.sa/ar/careers" style="color:#0B1B5A">businesspartner.sa/ar/careers</a>`)}</p>
    <p style="line-height:1.8;margin:0 0 18px">${T(
      `Want us to do the job hunting for you? <a href="https://www.businesspartner.sa/job-search-service" style="color:#0B1B5A">See how that works</a>.`,
      `تبي نبحث لك عن الوظيفة بالنيابة عنك؟ <a href="https://www.businesspartner.sa/ar/job-search-service" style="color:#0B1B5A">شوف كيف تعمل الخدمة</a>.`)}</p>
    <p style="color:#5A6478;font-size:12px;line-height:1.7;border-top:1px solid #E2E8F0;padding-top:12px;margin:0">
      Business Partner · ${T("Riyadh, Saudi Arabia", "الرياض، السعودية")} · business@businesspartner.sa<br>
      ${T("You're receiving this because you applied through businesspartner.sa.", "وصلتك هذه الرسالة لأنك تقدّمت عبر موقع businesspartner.sa.")}</p>
  </div>`;

  const subject = o.atsCv
    ? T("Your ATS-ready CV — Business Partner", "سيرتك الذاتية بصيغة ATS جاهزة — Business Partner")
    : T("We received your application — Business Partner", "استلمنا طلبك — Business Partner");
  try {
    return await sendMail(to, subject, head + summaryBlock + cvBlock + foot);
  } catch (err) {
    console.error("candidate copy failed", String(err).slice(0, 200));
    return false;
  }
}

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

const OWNER_KEY = envFrom(["PANEL_KEY", "LEADS_KEY"]);
const SENT_FLAG = "أُرسلت نسخة المرشح";
const SENT_DATE = "تاريخ إرسال نسخة المرشح";

// Everyone who applied before this existed got nothing back — the pipeline's
// output went only to us. This walks the applicants and sends each of them
// their own copy, one bounded batch per call so a run can be watched, paused
// and resumed rather than firing thousands of e-mails in one go.
//
// Scoped to people who actually applied through the site (Source = الموقع).
// The imported/sourced rows are people who never gave us their address for
// this, so mailing them would be unsolicited, not a service.
async function backfillCandidateCopies(b, res) {
  const send = (status, obj) => { res.statusCode = status; return res.end(JSON.stringify(obj)); };
  if (!OWNER_KEY || String(b.key || "").trim() !== OWNER_KEY) return send(403, { ok: false, error: "forbidden" });
  if (!NOTION_TOKEN) return send(503, { ok: false, error: "not_configured" });
  const dryRun = b.dryRun === true || b.dryRun === "true";
  const limit = Math.min(Math.max(Number(b.limit) || 25, 1), 100);
  // Default to the people the CV pipeline actually produced something for —
  // a bare "we got your application" months later is noise, not a service.
  const requireCv = b.requireCv !== false && b.requireCv !== "false";

  const filter = {
    and: [
      { property: "Source", select: { equals: "الموقع" } },
      { property: "Email", email: { is_not_empty: true } },
      { property: SENT_FLAG, checkbox: { equals: false } },
    ],
  };
  if (requireCv) filter.and.push({ property: "ATS CV Text", rich_text: { is_not_empty: true } });

  const q = await notion("databases/" + DB_ID + "/query", "POST", {
    page_size: limit, filter, sorts: [{ timestamp: "created_time", direction: "descending" }],
  });
  if (!q.ok) return send(502, { ok: false, error: "notion_failed" });
  const rows = ((await q.json()).results) || [];

  const results = [];
  for (const row of rows) {
    const props = row.properties || {};
    const to = txt(props["Email"]);
    const name = txt(props["Candidate Name"]);
    const atsCv = (props["ATS CV Text"] && props["ATS CV Text"].rich_text || []).map((t) => t.plain_text).join("");
    // The AI summary was folded into Notes at intake, behind a known prefix.
    const notes = txt(props["Notes"]);
    const m = notes.match(/ملخص الذكاء الاصطناعي:\s*([\s\S]+?)(?:\n\n|$)/);
    const summary = m ? m[1].trim() : "";
    const jobStamp = txt(props["الوظيفة المتقدم لها"]);
    const jobTitle = jobStamp.replace(/\s*\([^)]*\)\s*$/, "").trim();
    if (!isEmail(to)) { results.push({ id: row.id, name, skipped: "no_email" }); continue; }

    if (dryRun) { results.push({ id: row.id, name, to, hasCv: !!atsCv, hasSummary: !!summary, jobTitle }); continue; }
    const ok = await sendCandidateCopy(to, name, { jobTitle, ref: "CV-" + row.id.slice(-6), summary, atsCv });
    if (ok) {
      await notion("pages/" + row.id, "PATCH", {
        properties: { [SENT_FLAG]: { checkbox: true }, [SENT_DATE]: { date: { start: new Date().toISOString().slice(0, 10) } } },
      });
    }
    results.push({ id: row.id, name, to, sent: !!ok, hadCv: !!atsCv });
    // Gentle on the mail provider's rate limit; a batch of 25 costs ~5s.
    await new Promise((r) => setTimeout(r, 200));
  }

  const sent = results.filter((r) => r.sent).length;
  return send(200, { ok: true, dryRun, batch: rows.length, sent, results });
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
          // SECURITY: expected salary is deliberately NOT echoed here — this
          // self-view is gated only by a phone+email pair (no OTP), so the
          // most sensitive field must not be exposed on that weak check.
          pipelineStage: txt(p["Pipeline Stage"]),
          cvLink: txt(p["CV Link"]),
          atsCvLink: txt(p["ATS CV (Drive)"]),
          registered: page.created_time,
        },
      }));
    }
    res.statusCode = 200;
    // SECURITY: never enumerate env-var names to unauthenticated callers — it
    // hands an attacker the secret-naming scheme. Booleans only.
    return res.end(JSON.stringify({ status: "ok", configured: !!NOTION_TOKEN, n8n: !!N8N_ATS_WEBHOOK }));
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

  // Owner-only maintenance action, not part of the public application flow.
  if (b.type === "backfill-copies") return backfillCandidateCopies(b, res);

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
    // The ATS database's Target Role property is a select, not rich text —
    // a select name must be non-empty, comma-free and at most 100 chars.
    ...(field ? { "Target Role": { select: { name: String(field).replace(/,/g, "،").slice(0, 90) } } } : {}),
    "Experience Years": { number: expYears },
    "Skills": { rich_text: rt([field, linkedin].filter(Boolean).join(" · ")) },
    "Source": { select: { name: "الموقع" } },
    // Job linkage the employer console groups by — "title (id)". Notes carries
    // the same stamp for rows created before this property existed.
    "الوظيفة المتقدم لها": { rich_text: rt(`${jobTitle} (${jobId})`) },
    "مخفي عن الموقع": { checkbox: false },
    "حالة القراءة": { select: { name: "مكتمل" } },
    "Notes": { rich_text: rt(answerLines) },
  };

  // "Search for a job on my behalf" — ticked on the application form. This
  // records the intent and the chosen plan; the service is activated by a
  // human afterwards, so submitting an application never starts any billing.
  const js = b.jobSearch && typeof b.jobSearch === "object" ? b.jobSearch : null;
  if (js && js.interested) {
    const PLANS = ["اشتراك شهري 100 ريال", "راتب شهر على 3 دفعات"];
    props["خدمة البحث عن وظيفة"] = { select: { name: "مهتم — بانتظار الاختيار" } };
    props["حالة الدفع"] = { select: { name: "لم يبدأ" } };
    if (PLANS.includes(js.plan)) props["باقة الخدمة"] = { select: { name: js.plan } };
  }
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
      // SECURITY / data-integrity: a resubmission must NOT re-expose a
      // candidate an admin deliberately hid, nor wipe recruiter notes. Both
      // props are create-only — drop them from the update so the existing
      // hide flag and Notes are left exactly as the recruiter left them.
      delete props["مخفي عن الموقع"];
      delete props["Notes"];
      applyN8nEnrichment(props, n8n, false);
      const r = await notion("pages/" + existing.id, "PATCH", { properties: props });
      if (!r.ok) {
        console.error("Notion update error", r.status, (await r.text()).slice(0, 400));
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, error: "notion_failed" }));
      }
      await notifyEmployerOfApplication(jobId, jobTitle, { name, phone, field, city });
      await sendCandidateCopy(email, name, {
        jobTitle, ref: "CV-" + existing.id.slice(-6), lang: b.lang,
        summary: n8nAi(n8n).candidate_summary, atsCv: n8nAi(n8n).ats_cv_markdown,
      });
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
    // Everything the pipeline just produced about this person also goes to the
    // person. When n8n didn't answer in time there's no CV yet, and this is
    // still a confirmation they applied — which is more than they used to get.
    await sendCandidateCopy(email, name, {
      jobTitle, ref, lang: b.lang,
      summary: n8nAi(n8n).candidate_summary, atsCv: n8nAi(n8n).ats_cv_markdown,
    });
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ref, updated: false, n8n }));
  } catch (e) {
    console.error("candidate handler error", e);
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "server_error" }));
  }
}
