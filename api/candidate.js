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
// The AI provider chain lives in hire.js (gemini → groq → openai → anthropic
// failover); reusing it directly avoids an HTTP hop to our own function.
import { aiText, aiAvailable } from "./hire.js";
// قارئ المستندات الخاص بنا — ملكُ `document-ai`، يُقرأ منه ولا يُكتب فيه.
// المُصدَّر وحده، بحدوده كما هي (DOC_MIME_OK, MAX_DOC_BYTES).
import { readDocumentRaw, DOC_MIME_OK, MAX_DOC_BYTES, azureReady, docIntelReady } from "./_docread.js";

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

async function notion(path, method, payload, signal) {
  return fetch(`https://api.notion.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
    signal,
  });
}

// ── وقود وكلاء التوظيف: نصّ السيرة الذاتية ───────────────────────────────────
// وكلاء التوظيف (فرز، تقييم، أسئلة مقابلة، عرض، عقد) تتغذّى كلها من حقل واحد:
// «ATS CV Text». وكان استخراجه معلّقاً بكامله على خطّاف n8n خارجي: ننتظره ٥٠
// ثانية، وإن تأخّر أو فشل يُنشأ المرشّح **بلا نصّ سيرة ولا علامة**، بينما
// «حالة القراءة» تُكتب «مكتمل» على أي حال.
//
// القياس على القاعدة الحقيقية (2026-09-29، ٢٦٤٠٢ صفاً): «ATS CV Text» غير فارغ
// في **صفٍّ واحد**. ومن صفوف الموقع الـ٢٠٣٧ كُتب «مكتمل» على ١٠٢٥ صفاً لا نصّ
// فيها. فالوقود لم يكن ينقطع أحياناً — لم يكن يجري أصلاً، والحقل الذي من وظيفته
// أن يقول ذلك كان يقول عكسه.
//
// فصار لنا خطٌّ احتياطي في البيت على قارئ المستندات نفسه الذي تستعمله خمسة
// ملفات أخرى (api/_docread.js → Azure). و n8n يبقى الأول ولا يُعطَّل: هو من
// يصنع مستندات Drive ويرسل بريده، ولا نكرّر عمله.
//
// ⚠️ الميزانية — المسار كله ٦٠ ثانية على Vercel (`maxDuration` في vercel.json)،
// وتجاوزها يفقد **الطلب كله** لا السيرة وحدها، وهذا أسوأ من الحال الراهنة. لذا
// كل نداءٍ شبكي محسوبٌ من `startedAt`:
//   • انتظار n8n يبقى ٥٠ ثانية كما كان **حين لا احتياطي أصلاً** (لا ملف مرفوع،
//     أو نوعٌ لا يُقرأ، أو أزور غير مهيّأ) — لا معنى لتوفير وقتٍ لا مستفيد منه.
//   • وينزل إلى ٢٥ ثانية **حين يوجد احتياطي**، فتُترك بقيةُ النافذة له. وهذه
//     ليست مقايضةً مؤلمة: على مسار الموقع أرجع n8n نصّ سيرة مرةً واحدة، ومستندَ
//     Drive في ٤١ صفاً من ٢٠٣٧ — أي أن الخمسين ثانية تنجح نحو ٢٪ من الوقت.
//     وقطعُ الانتظار لا يُلغي مسار n8n، فعملُه في Drive والبريد يكمل عنده.
//   • ولا يبدأ أي نداء بعد `HARD_MS`، ويُترك `TAIL_MS` لكتابة نوشن والبريدين.
//     وما لا يتّسع يُوسَم ويُلتقط بمسار الاستدراك (`extract-cvs`) أدناه.
const ROUTE_MS = 60000;
const TAIL_MS = 11000;
const HARD_MS = ROUTE_MS - TAIL_MS;
const N8N_MS_SOLO = 50000;
const N8N_MS_SHARED = 25000;
// أقلّ نافذة يُعتدّ بها: قراءة صفحتين بأزور تحت العشر ثوانٍ نادرة، وبدءُ نداءٍ
// نعلم أنه لن يكمل هو إحراقُ ما بقي من ميزانية الطلب بلا مقابل.
const LOCAL_MIN_MS = 12000;

// نصّ السيرة كما هو، لا ملخّصاً ولا تقييماً: الفرز والتقييم وكلاء أخرى، وهذا
// وقودها. و`readDocumentRaw` يمرّر النصّ المستخرج **كبيانات لا كتعليمات**.
const CV_TEXT_PROMPT = `أنت تقرأ سيرة ذاتية (CV) وتُعيد نصّها كاملاً بصيغة Markdown.

القواعد:
- انسخ ما في المستند فقط. لا تُضف جهة عمل ولا تاريخاً ولا شهادةً ولا مهارةً غير مذكورة، ولا تلخّص ولا تحذف.
- احتفظ باللغة التي كُتبت بها السيرة كما هي — لا تترجم.
- رتّب بعناوين قياسية إن ظهرت في المستند: الملخص، المهارات، الخبرات، التعليم، الشهادات، اللغات، بيانات التواصل.
- إن كان المستند ليس سيرة ذاتية، أو لا يحمل نصاً مقروءاً، أعِد cv_markdown نصاً فارغاً.

أعِد JSON فقط، بلا شرح وبلا علامات تنسيق:
{"cv_markdown":"<نصّ السيرة كاملاً بـMarkdown>"}`;

// أسبابُ عدم الاستخراج، بنصٍّ واحد لكلٍّ منها يُكتب في نوشن كما هو. والفصل بين
// «سيرةٌ ضعيفة» و«سيرةٌ لم تُقرأ» هو كلّ الغرض: خلطهما يرفض مرشّحاً جيداً بصمت.
export const CV_FAIL = {
  no_file: "لا ملف سيرة مرفوع — لم يُرفع شيءٌ لقراءته",
  bad_type: "نوع الملف لا يُقرأ آلياً (المقبول PDF أو صورة) — يحتاج تحويلاً",
  too_large: "حجم الملف فوق الحدّ المقروء (٦ م.ب)",
  azure_off: "قارئ المستندات (Azure) غير مهيّأ",
  timeout: "انتهت مهلة القراءة قبل أن تكتمل",
  no_time: "لم يبقَ من مهلة الطلب وقتٌ للقراءة — مؤجّلة للاستدراك",
  read_failed: "فشلت قراءة الملف",
  empty: "قُرئ الملف ولم يُخرج نصاً (PDF مصوّر أو صفحات فارغة)",
  fetch_failed: "تعذّر تنزيل الملف من رابطه",
};

// خيارات «حالة القراءة» الأربعة في القاعدة كما هي — لا يُختلق خيارٌ خامس. ما
// ليس هنا يقع على «فشل التحليل».
const READ_STATUS = {
  empty: "غير مقروء - PDF مصور",
  bad_type: "ناقص - بيانات غير كافية",
  too_large: "ناقص - بيانات غير كافية",
  no_file: "ناقص - بيانات غير كافية",
};
const READ_STATUS_OK = "مكتمل";
const READ_PROP = "حالة القراءة";
const REASON_PROP = "سبب عدم الاكتمال";
const today = () => new Date().toISOString().slice(0, 10);

// هل يوجد احتياطي أصلاً لهذا الطلب؟ يُسأل **قبل** نداء n8n لأن جوابه هو ما
// يحدّد نافذته. وشروطه هي شروط `extractCvText` نفسها حرفياً — لو تفرّقا لقصّرنا
// انتظار n8n لأجل احتياطيٍّ لا يعمل.
export function cvFallbackPossible(cvFile) {
  const f = cvFile || {};
  const mime = String(f.type || "");
  if (!f.base64 || !DOC_MIME_OK.test(mime)) return false;
  if (Buffer.byteLength(f.base64, "base64") > MAX_DOC_BYTES) return false;
  if (!azureReady()) return false;
  return /pdf/i.test(mime) ? docIntelReady() : true;
}

/**
 * الخطّ الاحتياطي: نستخرج النصّ بأنفسنا من بايتات الملف.
 * لا يرمي أبداً — يعيد `{ text, reason }`، و`reason` مفتاحٌ في CV_FAIL.
 * @param {{base64?:string,type?:string}|null} cvFile
 * @param {number} budgetMs ما بقي من ميزانية الطلب لهذه القراءة
 */
export async function extractCvText(cvFile, budgetMs) {
  const f = cvFile || {};
  const mime = String(f.type || "");
  if (!f.base64) return { text: "", reason: "no_file" };
  if (!DOC_MIME_OK.test(mime)) return { text: "", reason: "bad_type" };
  if (Buffer.byteLength(f.base64, "base64") > MAX_DOC_BYTES) return { text: "", reason: "too_large" };
  // تُفحص التهيئة ولا تُفترض. وقراءة الـPDF خدمةٌ أخرى بمفتاحٍ آخر
  // (Document Intelligence)، فحضور مفتاح المحادثة لا يعني حضورها.
  if (!azureReady()) return { text: "", reason: "azure_off" };
  if (/pdf/i.test(mime) && !docIntelReady()) return { text: "", reason: "azure_off" };
  const ms = Number(budgetMs) || 0;
  if (ms < LOCAL_MIN_MS) return { text: "", reason: "no_time" };

  let timer;
  const expired = Symbol("cv_read_expired");
  try {
    // `readDocumentRaw` لا يقبل إشارة إلغاء، فالمهلة سباقٌ عليه: ننصرف عند
    // انتهائها ويُكتب المرشّح، ولا ننتظر نداءً لن يُغيّر شيئاً بعد الآن.
    const r = await Promise.race([
      readDocumentRaw(f.base64, mime, CV_TEXT_PROMPT, 4000),
      new Promise((resolve) => { timer = setTimeout(() => resolve(expired), ms); }),
    ]);
    if (r === expired) return { text: "", reason: "timeout" };
    if (!r || !r.ok) return { text: "", reason: r && r.error === "not_configured" ? "azure_off" : "read_failed" };
    const text = String((r.data && r.data.cv_markdown) || "").trim();
    // أقلّ من أربعين حرفاً ليست سيرة — هي ترويسةٌ أو صفحةٌ بيضاء، وكتابتها
    // كسيرةٍ تجعل الفرز يحكم على فراغ.
    if (text.length < 40) return { text: "", reason: "empty" };
    return { text, reason: "" };
  } catch (e) {
    console.error("local cv extract failed", String(e).slice(0, 200));
    return { text: "", reason: "read_failed" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * يكتب الحقيقة عن السيرة في الصفّ: النصّ إن وُجد، وحالةُ القراءة وسببها.
 * @param props        خصائص نوشن التي ستُكتب
 * @param outcome      { text, source:"n8n"|"local"|"", reason, note }
 * @param keepExisting صفٌّ قائم فيه نصّ سيرة سابق — لا يُنزَّل بإعادة تقديمٍ
 *                     بلا مرفق، فحالته الحقيقية «مكتمل» ولم تتغيّر.
 */
export function applyCvReadStatus(props, outcome, keepExisting) {
  const o = outcome || {};
  const text = String(o.text || "").trim();
  if (text) {
    props["ATS CV Text"] = { rich_text: rtChunks(text) };
    props[READ_PROP] = { select: { name: READ_STATUS_OK } };
    props[REASON_PROP] = o.source === "local"
      ? { rich_text: rt(`استُخرج النصّ محلياً عبر Azure — ${o.note || "n8n لم يُرجع نصّ سيرة"} (${today()})`) }
      : { rich_text: [] };
    return props;
  }
  if (keepExisting) {
    // لا نصّ جديد، والصفّ فيه نصّ سابق: لا حالةَ تُكتب ولا سببَ — وإلا وسمنا
    // مرشّحاً سيرتُه مقروءةٌ عندنا بأنها لم تُقرأ.
    delete props["ATS CV Text"];
    delete props[READ_PROP];
    delete props[REASON_PROP];
    return props;
  }
  props[READ_PROP] = { select: { name: READ_STATUS[o.reason] || "فشل التحليل" } };
  props[REASON_PROP] = { rich_text: rt(
    `السيرة لم تُستخرج — ${CV_FAIL[o.reason] || o.reason || "سبب غير معروف"}${o.note ? ` · ${o.note}` : ""} (${today()})`) };
  return props;
}

/* ═════════════════════ التوطين والامتثال للمتقدّم عبر الموقع ═════════════════════
 *
 * صاحب العمل يرى على كل مرشّح رقاقتين: «التوطين» و«الامتثال». والقيم التي
 * تلوّنهما يحسبها **وكيل Outlook** في n8n (السيناريو TfsAjfMoTXc8i2uw، العقدتان
 * «🧠 التحليل (Azure)» و«🏗️ بناء السجل + السيرة») — ولا يمرّ به المتقدّم عبر
 * الموقع إطلاقاً. فكان قياس 2026-09-29: ٢٤٥٨٦ صفّاً من ٢٦٤١٩ لها توطين، وصفرٌ
 * من الـ١١٧ صفّاً التي تظهر فعلاً في لوحة صاحب العمل. الشاشة تقول «لم يُفحص»
 * لكل من يظهر فيها. هذا القسم يحسبها هنا، بمنطق الوكيل نفسه.
 *
 * منطق الوكيل حرفياً: نداءُ نموذجٍ واحد يطلب JSON فيه مفاتيح كثيرة، ثم
 * `pick(v, allow, dflt)` يقصّ الناتج على القائمة المسموحة و«بحاجة فحص» هو
 * الافتراضي. نتّبعه: **القيم الأربع كما هي، والمجهول يقع على «بحاجة فحص»**.
 *
 * وموضعُ خلافٍ واحد، مقصود: الوكيل يسأل النموذج عن `saudization` و`compliance`
 * **مفتاحين مستقلّين**، ولا يتحقّق من اتّساقهما — فوُلد في القاعدة ٢٢٠ صفّاً
 * توطينها «مسموح لغير السعوديين» وامتثالها «⛔ مهنة سعودية - غير سعودي»، وهما
 * نقيضان. هنا **لا يُسأل النموذج عن الامتثال أصلاً**: يُسأل عن المهنة وحدها،
 * ويُشتقّ الامتثال في الكود من (التوطين × جنسية المرشّح) بدالة واحدة
 * `complianceFor` — فالتناقض يصير مستحيلاً بنيةً لا انتباهاً.
 *
 * وحدّ لا يُتجاوز (CLAUDE.md §4): لا نسبة ولا رقم ولا اسم قرار وزاري. النموذج
 * يُمنع منها في النصّ، ثم تُنزع من جوابه مهما قال (`NUM_CLAIM_RE`) — لأن المنع
 * بالطلب وحده ليس منعاً. وما لا نعرفه يُقال «بحاجة فحص»، وهي قيمةٌ موجودة في
 * القاعدة لهذا الغرض بالضبط.
 */
export const SAUD_VALUES = ["مقصورة على السعوديين", "نسبة توطين + اشتراطات", "مسموح لغير السعوديين", "بحاجة فحص"];
export const COMP_VALUES = ["✅ مطابق", "⛔ مهنة سعودية - غير سعودي", "⚠️ اشتراطات", "🔍 بحاجة فحص"];
const SAUD_NEEDS = "بحاجة فحص";
const COMP_NEEDS = "🔍 بحاجة فحص";
const SAUD_PROP = "التوطين Saudization";
const COMP_PROP = "الامتثال Compliance";
const SAUD_DET_PROP = "تفاصيل التوطين";
export const SAUD_PROPS = [SAUD_PROP, COMP_PROP, SAUD_DET_PROP];

// سعوديٌّ أم لا — من الاستمارة، بلا نموذج. «مواطن سعودي» خيارٌ مُنتقى فهو
// قاطع، وحالتا الإقامة تقطعان بالعكس. و«خارج السعودية» لا تدلّ على شيء: سعوديٌّ
// مغترب يختارها. والفراغ يبقى فراغاً — لا يُحسب «غير سعودي» بالافتراض، لأن
// الافتراض هنا يكتب ⛔ على شخصٍ لم يقل جنسيته.
// ويُقرأ الرمز **داخل** النصّ لا كمساواةٍ له: «سعودي/أمريكي» مزدوجُ جنسية،
// وهو سعوديٌّ فعلاً — ومطابقةٌ حرفية كانت تقرؤه «غير سعودي» فتكتب ⛔ على مواطن.
// والاتجاه مقصود: الخطأ الأرخص أن نعدّه سعودياً فيُفحص، لا أن نُسقط طلبه.
const SAUDI_TOKEN = /(?:^|[\s/،,+&])(?:سعودي(?:ة)?|السعودية|saudi(?:\s+arabian?)?|ksa)(?=$|[\s/،,+&])/i;
const NOT_SAUDI = /غير\s*سعودي|non[\s-]?saudi|not\s+saudi/i;
export function nationalityKind(nationality, residenceStatus) {
  if (residenceStatus === "مواطن سعودي") return "سعودي";
  const n = String(nationality || "").trim();
  if (n && !NOT_SAUDI.test(n) && SAUDI_TOKEN.test(n)) return "سعودي";
  if (/^مقيم بإقامة/.test(String(residenceStatus || ""))) return "غير سعودي";
  return n ? "غير سعودي" : "";
}

// الامتثال = دالةٌ صِرفة من (التوطين × الجنسية). القاعدة الوحيدة التي ينصّ عليها
// نصّ وكيل Outlook هي «مقصورة على السعوديين + غير سعودي = ⛔»، وما عداها يُشتقّ
// بأضيق ما تحتمله القيمة المخزّنة:
//   • «نسبة توطين + اشتراطات» ⇒ ⚠️ للجميع. القيمة نفسها تقول إن ثمّة اشتراطات،
//     فإعادة قولها ليست حكماً جديداً — أما وسمُ سعوديٍّ «مطابق» فشهادةُ سلامةٍ
//     لا نملكها (قد تكون الاشتراطات رخصةً مهنية تلزمه هو أيضاً).
//   • جنسيةٌ مجهولة على مهنةٍ مقصورة ⇒ 🔍، لا ⛔ ولا ✅.
//   • توطينٌ «بحاجة فحص» ⇒ 🔍 دائماً: لا امتثال يُبنى على مجهول.
export function complianceFor(saudization, natKind) {
  const s = SAUD_VALUES.includes(saudization) ? saudization : SAUD_NEEDS;
  if (s === "نسبة توطين + اشتراطات") return "⚠️ اشتراطات";
  if (s === "مسموح لغير السعوديين") return "✅ مطابق";
  if (s === "مقصورة على السعوديين") {
    if (natKind === "سعودي") return "✅ مطابق";
    if (natKind === "غير سعودي") return "⛔ مهنة سعودية - غير سعودي";
    return COMP_NEEDS;
  }
  return COMP_NEEDS;
}

// أي أثر لرقمٍ أو نسبةٍ أو مرجعٍ نظامي في جملة النموذج ⇒ تُطرح الجملة كلها.
// «نسبة التوطين ٣٠٪» و«القرار الوزاري ٤٩٠٤» معلومةٌ حكومية لا نملك مصدرها، ولا
// فرق بين اختلاقها وبين نقلها عن نموذجٍ اختلقها.
const NUM_CLAIM_RE = /[0-9٠-٩]|%|٪|قرار|القرار|المادة|اللائحة|لائحة|تعميم/;
const SAUD_NOTE = {
  "مقصورة على السعوديين": "المهنة مُصنَّفة مقصورة على السعوديين.",
  "نسبة توطين + اشتراطات": "على المهنة نسبة توطين واشتراطات تُراجع قبل التعاقد.",
  "مسموح لغير السعوديين": "المهنة غير مقصورة على السعوديين حسب التصنيف.",
  "بحاجة فحص": "لم تُحدَّد حالة التوطين لهذه المهنة آلياً.",
};
function cleanDetail(v) {
  const s = String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, 220);
  return s && !NUM_CLAIM_RE.test(s) ? s : "";
}
// السطر يقول دائماً **من حسبه وعلى أي أساس**، لأن صاحب العمل يبني عليه قراراً:
// جملةٌ عن مهنةٍ لا تقول إنها محسوبةٌ آلياً من مسمّى تُقرأ كأنها فحصٌ رسمي.
function saudDetailLine(value, role, extra) {
  const parts = [SAUD_NOTE[value] || SAUD_NOTE[SAUD_NEEDS]];
  const x = cleanDetail(extra);
  if (x) parts.push(x);
  parts.push(role
    ? `حُسب آلياً من المسمّى «${clip(role, 90)}» ولا يقوم مقام فحص رسمي لدى الجهة المختصة (${today()})`
    : `لا مسمّى مهنة في الطلب (${today()})`);
  return parts.join(" — ");
}

const saudPrompt = (role) => `أنت مختص امتثال توطين في سوق العمل السعودي.
المسمّى المهني: «${role}»

أعد JSON صالحاً فقط، بلا شرح وبلا أسوار كود، بمفتاحين:
{"saudization":"…","saudization_details":"…"}

saudization — واحدة من هذه الأربع حرفاً بحرف ولا شيء غيرها:
"مقصورة على السعوديين"
"نسبة توطين + اشتراطات"
"مسموح لغير السعوديين"
"بحاجة فحص"

saudization_details — سطر عربي واحد قصير يشرح السبب.

قواعد ملزمة:
- حالة المهنة غير معلومة لك يقيناً، أو المسمّى مبهم أو ليس مهنة؟ اكتب "بحاجة فحص" ولا تخمّن.
- ممنوع ذكر نسبة مئوية أو رقم أو اسم قرار وزاري أو مادة أو تاريخ.
- لا تذكر جنسية المرشّح ولا تحكم عليه — السؤال عن المهنة وحدها.`;

// ذاكرةٌ لعمر الحاوية: المسميات تتكرّر بكثافة («محاسب»، «سائق»، «مهندس مدني»)،
// فنداءٌ واحد لكل مسمّى بدل نداءٍ لكل متقدّم. لا يُخزَّن فيها إلا جوابُ نموذجٍ
// نجح — كي لا يُثبِّت فشلٌ عارض «بحاجة فحص» على مسمّى إلى آخر النشرة.
const SAUD_CACHE = new Map();
const SAUD_CACHE_MAX = 500;

// نداءٌ واحد صغير على المسار المدفوع القائم في هذا الملف (`aiText` → أزور، وهو
// مقيس في _hiremeter). سؤالٌ عن **المهنة وحدها**: لا سيرة ولا جنسية ولا اسم —
// فالحمولة أسطرٌ لا صفحات، والجواب مفتاحان. ولا يرمي أبداً: فشلُه «بحاجة فحص»،
// ولا يُسقط إنشاء المرشّح.
// ومهلةٌ خاصّةٌ به: `aiText` لا يقبل مهلة، ومهلة أزور نفسها ٤٥ ثانية لكل منطقة
// ومنطقتان — فنداءٌ متعثّر وحده يتجاوز سقفَ المسار كله (٦٠ ثانية) ويُسقط تقديماً
// ناجحاً. الحدّ هنا لا يُلغي النداء الجاري، لكنه يُطلق المعالجَ بـ«بحاجة فحص».
const SAUD_MS = 25000;
export async function occupationSaudization(role, budgetMs) {
  const r = String(role || "").trim().slice(0, 160);
  const fail = (note) => ({ saudization: SAUD_NEEDS, details: saudDetailLine(SAUD_NEEDS, r, note), source: "" });
  if (!r) return fail("");
  const key = r.toLowerCase().replace(/\s+/g, " ");
  if (SAUD_CACHE.has(key)) return { ...SAUD_CACHE.get(key) };
  if (!aiAvailable()) return fail("محرّك التحليل غير مهيّأ");
  let raw;
  let timer = null;
  try {
    const ms = Number(budgetMs) > 0 ? Number(budgetMs) : SAUD_MS;
    const late = new Promise((resolve) => { timer = setTimeout(() => resolve(Symbol.for("bp.saud.late")), ms); });
    raw = await Promise.race([aiText(saudPrompt(r), 400, "saudization"), late]);
    if (raw === Symbol.for("bp.saud.late")) return fail("تجاوز التحليل مهلته — يُعاد لاحقاً");
  } catch (e) {
    console.error("saudization ai failed", String(e).slice(0, 200));
    return fail("تعذّر التحليل الآلي — يُعاد لاحقاً");
  } finally {
    if (timer) clearTimeout(timer);
  }
  const body = String(raw || "").replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  const start = body.indexOf("{"), end = body.lastIndexOf("}");
  let d = null;
  if (start >= 0 && end > start) { try { d = JSON.parse(body.slice(start, end + 1)); } catch { d = null; } }
  if (!d) return fail("ردٌّ غير مقروء من محرّك التحليل");
  // نفس `pick` في وكيل Outlook: ما ليس في القائمة يقع على «بحاجة فحص». قيمةٌ
  // خامسة تعني رقاقةً رمادية بنصٍّ لا تعرفه الواجهة.
  const picked = SAUD_VALUES.includes(d.saudization) ? d.saudization : SAUD_NEEDS;
  const out = { saudization: picked, details: saudDetailLine(picked, r, d.saudization_details), source: "azure" };
  if (SAUD_CACHE.size >= SAUD_CACHE_MAX) SAUD_CACHE.clear();
  SAUD_CACHE.set(key, { ...out });
  return out;
}

// الكتابة على الخصائص الثلاث. وصفٌّ قائم عليه توطينٌ **محسوم** لا يُنسخ عليه
// حسابُنا: قد يكون وكيل Outlook كتبه من السيرة كاملةً، أو كتبه موظّف. وحينها
// يُشتقّ الامتثال من قيمته هو لا من قيمتنا — وإلا وُلد تناقضٌ جديد من طرفين
// صحيحين كلٌّ على حدة. والامتثال المحسوم لا يُلمس أصلاً.
export function applySaudization(props, calc, natKind, existingProps) {
  const sel = (k) => { const p = existingProps && existingProps[k]; return (p && p.select && p.select.name) || ""; };
  const curSaud = sel(SAUD_PROP), curComp = sel(COMP_PROP);
  const decided = !!curSaud && curSaud !== SAUD_NEEDS;
  const saudization = decided ? curSaud : (SAUD_VALUES.includes(calc && calc.saudization) ? calc.saudization : SAUD_NEEDS);
  if (!decided) {
    props[SAUD_PROP] = { select: { name: saudization } };
    if (calc && calc.details) props[SAUD_DET_PROP] = { rich_text: rt(calc.details) };
  }
  if (!curComp || curComp === COMP_NEEDS) props[COMP_PROP] = { select: { name: complianceFor(saudization, natKind) } };
  return props;
}

/* ══════════════ إصلاح الصفوف المتناقضة القائمة (مسار مالك) ══════════════
 *
 * قياس القاعدة 2026-09-29 (استعلامٌ على القاعدة الحقيقية، تجميعٌ بلا أي حقل
 * شخصي): ٢٢٠ صفّاً توطينها «مسموح لغير السعوديين» وامتثالها «⛔ مهنة سعودية -
 * غير سعودي». وهذا نقيضٌ حرفي: الرقاقة الأولى تقول إن المهنة مفتوحة، والثانية
 * تقول إنها مقصورة. وفي القياس نفسه ٣ صفوف ⛔ على **سعودي**، وصفٌّ واحد
 * «✅ مطابق» على (مقصورة × غير سعودي) — أي التناقض نفسه معكوساً.
 *
 * ⚠️ والأهم ما **لا** يُمسّ. الحدّ الذي رسمه المالك: يُصلَح المتناقض فعلاً، لا
 * ما يخالف حسابنا. ففي القياس ٥٠٠ صفّ «نسبة توطين + اشتراطات» + «✅ مطابق» على
 * سعودي — وحسابُ `complianceFor` يقول «⚠️ اشتراطات». لكنها ليست متناقضة:
 * «✅ مطابق» لا تنفي وجود اشتراطات، وقد كتبها وكيلٌ قرأ السيرة كاملةً أو كتبها
 * موظّف. إعادةُ كتابتها بحسابٍ على المسمّى وحده تمحو حكماً أعلمَ من حكمنا.
 * ولذلك المعيار هنا **ما تنفيه القيمة نفسها**، لا الفرق عن حسابنا:
 *   ⛔ «مهنة سعودية - غير سعودي» جملةٌ تدّعي شيئين معاً — المهنة مقصورة،
 *      والشخص غير سعودي. فهي متناقضة إن نفى الصفّ أيّاً منهما.
 *   ✅ «مطابق» تُنفى بالقاعدة الوحيدة المنصوصة: مقصورة × غير سعودي.
 *   ⚠️ و🔍 لا تدّعيان شيئاً يُنفى — **لا تُمسّان أبداً**، ولو خالفتا حسابنا.
 * وتوطينٌ فارغ مع ⛔ ليس تناقضاً بل ادّعاءٌ بلا سند — ويُترك أيضاً (وهو صفرٌ في
 * القياس: كل صفّ بلا توطين بلا امتثال كذلك).
 */
const COMP_BLOCKED = "⛔ مهنة سعودية - غير سعودي";
const COMP_OK = "✅ مطابق";
export function complianceConflict(saudization, natKind, current) {
  const s = SAUD_VALUES.includes(saudization) ? saudization : "";
  const n = natKind === "سعودي" || natKind === "غير سعودي" ? natKind : "";
  if (current === COMP_BLOCKED) {
    if (s && s !== "مقصورة على السعوديين") return true; // المهنة مفتوحة والرقاقة تقول مقصورة
    if (n !== "غير سعودي") return true;                  // ⛔ تقول «غير سعودي» والصفّ لا يقولها
    return false;
  }
  if (current === COMP_OK) return s === "مقصورة على السعوديين" && n === "غير سعودي";
  return false;
}

// القيمة الصحيحة للصفّ المتناقض — حسابيةٌ بحتة، بلا نداء نموذج: نفس
// `complianceFor` التي يكتب بها المسار الحيّ. وحدُّ المالك الثاني: صفٌّ بلا
// جنسية مسجّلة **لا يُحسم له شيء** — 🔍 «بحاجة فحص» هي قيمة «لم نعرف» في
// القاعدة، ولا يُفترض «غير سعودي» أبداً. ويعود "" أي «لا تكتب شيئاً».
export function complianceRepair(saudization, natKind, current) {
  if (!complianceConflict(saudization, natKind, current)) return "";
  if (natKind !== "سعودي" && natKind !== "غير سعودي") return COMP_NEEDS;
  const fixed = complianceFor(saudization, natKind);
  return fixed === current ? "" : fixed;
}

// جنسيةُ صفٍّ قائم. الخيار المخزّن `Nationality Type` هو المصدر، وحين يكون
// فارغاً يُقرأ ما سجّله الصفّ فعلاً (نصّ الجنسية وحالة الإقامة) بـ
// `nationalityKind` — وهو التعريف الواحد نفسه، لا منطقٌ ثانٍ. وهذه قراءةٌ لا
// افتراض: `nationalityKind` يعيد "" حين لا يقول الصفّ شيئاً.
export function rowNationalityKind(props) {
  const p = props || {};
  const sel = (p["Nationality Type"] && p["Nationality Type"].select && p["Nationality Type"].select.name) || "";
  if (sel === "سعودي" || sel === "غير سعودي") return sel;
  return nationalityKind(txt(p["Nationality"]), txt(p["حالة الإقامة"]));
}

// نوشن يردّ 400 على اسم خاصية لا وجود له — و**يُسقط إنشاء الصفحة كلها**، فيضيع
// طلبُ مرشّحٍ حقيقي لأجل حقل حالة. الحقلان موجودان فعلاً (فُحص المخطّط
// 2026-09-29: «حالة القراءة» select بأربعة خيارات، و«سبب عدم الاكتمال» نصّ)،
// لكن اسم الخاصية في نوشن يُعاد تسميته بضغطة، فلا يُبنى قبولُ مرشّحٍ على ذلك.
// نفس نمط `notionWriteOptional` في api/candidates.js.
const MISSING_PROP_RE = /is not a property that exists|could not find property|invalid property identifier/i;
async function notionWriteOptional(path, method, payload, optionalProps, label) {
  const names = optionalProps.filter((n) => payload.properties && payload.properties[n] != null);
  const r = await notion(path, method, payload);
  if (r.ok || !names.length || r.status !== 400) return r;
  const body = await r.text();
  if (!MISSING_PROP_RE.test(body)) {
    return { ok: false, status: r.status, text: async () => body, json: async () => { try { return JSON.parse(body); } catch { return {}; } } };
  }
  console.warn(`${label}: قاعدة المرشحين لا تحتوي ${names.join(" / ")} — أُعيدت الكتابة بدونها. نوشن قال:`, body.slice(0, 220));
  const props = { ...payload.properties };
  for (const n of names) delete props[n];
  const r2 = await notion(path, method, { ...payload, properties: props });
  try { r2.droppedProps = names; } catch { /* الردّ مُجمَّد — لا يضرّ */ }
  return r2;
}
// الخصائص التي يُعاد الكتابة بدونها إن لم تكن في المخطّط. التوطين والامتثال
// ثلاثُ خصائص قائمة (فُحصت على القاعدة الحقيقية)، لكن إعادة تسمية إحداها
// بضغطة في نوشن لا يجوز أن تُسقط تقديمَ مرشّحٍ حقيقي.
const STATUS_PROPS = [READ_PROP, REASON_PROP, ...SAUD_PROPS];

// Calls the n8n ATS workflow and waits for its enrichment (CV text extraction,
// AI screening, Drive storage links) so it can be folded into the same Notion
// write below — n8n itself no longer writes to Notion, to avoid creating a
// second candidate record for every submission (this handler is always the
// sole Notion writer). On timeout/failure we skip enrichment and continue, and
// the record still gets created from the form fields alone.
//
// المهلة `waitMs` صارت قراراً للمُنادي لا رقماً ثابتاً هنا: كانت ٥٠ ثانية دائماً
// لأنه لم يكن بعدها شيء — وصار بعدها خطٌّ احتياطي، فمن حقّه نصيبٌ من النافذة حين
// يوجد (انظر ميزانية `HARD_MS` أعلاه). ومن ينادي بوسيطٍ واحد (api/_agencies.js)
// يبقى على الخمسين كما كان.
export async function forwardToN8n(payload, waitMs) {
  if (!N8N_ATS_WEBHOOK) return { configured: false, ok: false };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(waitMs) > 0 ? Number(waitMs) : N8N_MS_SOLO);
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

function buildCvBoostPrompt(cv, targetRole) {
  const target = String(targetRole || "").slice(0, 200);
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
${String(cv || "").slice(0, 14000)}`;
}

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

  const bo = o.boost || null;
  const gainBlock = bo && bo.before != null && bo.after != null && bo.after > bo.before
    ? `<div style="background:#ecfdf5;border-radius:12px;padding:14px 16px;margin:18px 0">
        <h3 style="color:#047857;margin:0 0 6px;font-size:15px">${T("How readable your CV is to hiring software", "مدى وضوح سيرتك لبرامج التوظيف")}</h3>
        <p style="margin:0 0 8px;line-height:1.8;font-size:15px">${T("Before", "قبل")}: <b>${bo.before}/100</b> → ${T("after", "بعد")}: <b style="color:#047857">${bo.after}/100</b></p>
        ${bo.improvements.length ? `<p style="margin:0 0 4px;font-size:13px;color:#5A6478">${T("What we changed:", "ما غيّرناه:")}</p><ul style="margin:0;padding-inline-start:20px;line-height:1.8;font-size:13px">${bo.improvements.slice(0, 5).map((x) => `<li>${e(x)}</li>`).join("")}</ul>` : ""}
        <p style="margin:8px 0 0;font-size:12px;color:#5A6478">${T("We only changed the wording and the layout — none of your facts, dates or employers were altered.", "غيّرنا الصياغة والترتيب فقط — لم نغيّر أي معلومة أو تاريخ أو جهة عمل.")}</p>
      </div>` : "";
  const missingBlock = bo && bo.missing && bo.missing.length
    ? `<div style="background:#fffbeb;border-radius:12px;padding:14px 16px;margin:18px 0">
        <h3 style="color:#92400e;margin:0 0 6px;font-size:15px">${T("Add these and your CV gets stronger", "أضف هذه ليصير ملفك أقوى")}</h3>
        <ul style="margin:0;padding-inline-start:20px;line-height:1.8;font-size:13px">${bo.missing.slice(0, 6).map((x) => `<li>${e(x)}</li>`).join("")}</ul>
        <p style="margin:8px 0 0;font-size:12px;color:#5A6478">${T("Reply to this email with them and we'll update your profile.", "ردّ على هذه الرسالة بها ونحدّث ملفك.")}</p>
      </div>` : "";

  const cvBlock = o.atsCv ? `<div style="border:1px solid #E2E8F0;border-radius:12px;padding:18px 20px;margin:18px 0">
      <p style="margin:0 0 2px;color:#5A6478;font-size:12px">${T("Yours to keep and send anywhere", "نسخة لك، استخدمها كيفما شئت")}</p>
      <h3 style="color:#0B1B5A;margin:0 0 10px;font-size:17px">${bo && bo.lang === "Arabic"
        ? T("Your CV, rewritten in English for applicant tracking systems", "سيرتك الذاتية بالإنجليزية بصيغة تقرأها أنظمة التوظيف (ATS)")
        : T("Your CV, rewritten for applicant tracking systems", "سيرتك الذاتية بصيغة تقرأها أنظمة التوظيف (ATS)")}</h3>
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
    return await sendMail(to, subject, head + summaryBlock + gainBlock + cvBlock + missingBlock + foot);
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

// Reads a posting's own title when an application arrives with a REAL job id
// but an empty title. That window is real: /job?id=<id> sets jobId
// synchronously from the query string, while jobTitle is only known once the
// posting has loaded — so an early (or failed-load) submission stamps the ATS
// row "General candidate pool (<real id>)", text that contradicts its own id
// and that humans then read in Notion.
// Best-effort exactly like notifyEmployerOfApplication: a genuine
// "candidate-pool" signup, a missing token, a deleted page, a slow or failing
// Notion — every one of them returns "" and the caller keeps its default. The
// abort caps how long a candidate can ever wait on this, and nothing here
// throws, so the candidate's own row is written either way.
async function jobTitleById(jobId) {
  if (!jobId || jobId === "candidate-pool" || !NOTION_TOKEN) return "";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const r = await notion(`pages/${jobId}`, "GET", null, controller.signal);
    if (!r.ok) return "";
    const data = await r.json();
    return clip(txt(data.properties && data.properties["العنوان الوظيفي"]), 220);
  } catch (e) {
    console.error("job title lookup failed", String(e).slice(0, 200));
    return "";
  } finally {
    clearTimeout(timer);
  }
}

const OWNER_KEY = envFrom(["PANEL_KEY", "LEADS_KEY"]);

// Rewrites a CV so applicant-tracking software can read it, translates it into
// English when it wasn't, and scores it before and after. What it must never do
// is invent a better candidate — the prompt forbids adding an employer, a date,
// a degree or a metric the person didn't claim, because a CV that wins an
// interview the candidate can't answer for has helped nobody. The score rises
// because the same facts are finally legible, not because they changed.
export async function boostCv(cvText, targetRole) {
  const text = String(cvText || "").trim();
  if (text.length < 120 || !aiAvailable()) return null;
  let raw;
  try {
    raw = await aiText(buildCvBoostPrompt(text, targetRole), 6000);
  } catch (e) {
    console.error("cv boost ai failed", String(e).slice(0, 200));
    return null;
  }
  const body = String(raw || "").replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  const start = body.indexOf("{"), end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let d;
  try { d = JSON.parse(body.slice(start, end + 1)); } catch { return null; }
  const clamp = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null; };
  const cvEn = String(d.cv_english || "").trim();
  if (cvEn.length < 100) return null;
  return {
    lang: ["Arabic", "English"].includes(d.source_language) ? d.source_language : "other",
    cvEn,
    cvNative: String(d.cv_original_language || "").trim(),
    before: clamp(d.score_before),
    after: clamp(d.score_after),
    improvements: Array.isArray(d.improvements) ? d.improvements.map(String).slice(0, 12) : [],
    missing: Array.isArray(d.missing) ? d.missing.map(String).slice(0, 12) : [],
    targetRole: String(d.target_role_guess || "").slice(0, 200),
  };
}

// Maps a boost result onto the Notion properties, so the inline path and the
// catch-up path write exactly the same shape.
function applyCvBoost(props, boost) {
  if (!boost) { props["حالة تحسين السيرة"] = { select: { name: "فشل" } }; return props; }
  props["السيرة المحسّنة (EN)"] = { rich_text: rtChunks(boost.cvEn) };
  if (boost.cvNative) props["السيرة المحسّنة (لغة المرشح)"] = { rich_text: rtChunks(boost.cvNative) };
  props["لغة السيرة الأصلية"] = { select: { name: boost.lang } };
  if (boost.before != null) props["الدرجة قبل التحسين"] = { number: boost.before };
  if (boost.after != null) props["الدرجة بعد التحسين"] = { number: boost.after };
  if (boost.improvements.length) props["تحسينات السيرة"] = { rich_text: rt(boost.improvements.map((x, i) => `${i + 1}. ${x}`).join("\n")) };
  if (boost.missing.length) props["نواقص السيرة"] = { rich_text: rt(boost.missing.join(" · ")) };
  props["حالة تحسين السيرة"] = { select: { name: "تم" } };
  return props;
}
const CRON_SECRET = (process.env.CRON_SECRET || "").trim();
const cronOk = (req) => !!CRON_SECRET && String((req.headers && req.headers.authorization) || "") === `Bearer ${CRON_SECRET}`;
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
async function backfillCandidateCopies(b, res, req) {
  const send = (status, obj) => { res.statusCode = status; return res.end(JSON.stringify(obj)); };
  const authed = (OWNER_KEY && String(b.key || "").trim() === OWNER_KEY) || cronOk(req);
  if (!authed) return send(403, { ok: false, error: "forbidden" });
  if (!NOTION_TOKEN) return send(503, { ok: false, error: "not_configured" });
  const dryRun = b.dryRun === true || b.dryRun === "true";
  // 30 is what fits in the 60s budget at the send rate below, not a UI choice:
  // each person costs a mail call, a pause, and one or more Notion writes.
  const limit = Math.min(Math.max(Number(b.limit) || 25, 1), 30);
  const requireCv = b.requireCv === true || b.requireCv === "true";

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
  const seen = new Set();
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

    // 1,876 rows carry only 1,456 distinct addresses — people reapply, and a
    // row is not a person. Sending per row would mail the same person up to
    // four times, so a batch never mails one address twice...
    const key = to.toLowerCase();
    if (seen.has(key)) { results.push({ id: row.id, name, to, skipped: "duplicate" }); continue; }
    seen.add(key);

    if (dryRun) { results.push({ id: row.id, name, to, hasCv: !!atsCv, hasSummary: !!summary, jobTitle }); continue; }
    const ok = await sendCandidateCopy(to, name, { jobTitle, ref: "CV-" + row.id.slice(-6), summary, atsCv });
    if (ok) {
      // ...and every other row for that address is flagged too, so the next
      // batch doesn't pick the duplicates up again.
      const dupes = await notion("databases/" + DB_ID + "/query", "POST", {
        page_size: 20, filter: { property: "Email", email: { equals: to } },
      });
      const ids = dupes.ok ? (((await dupes.json()).results) || []).map((r) => r.id) : [row.id];
      const stamp = { [SENT_FLAG]: { checkbox: true }, [SENT_DATE]: { date: { start: new Date().toISOString().slice(0, 10) } } };
      for (const id of ids.length ? ids : [row.id]) await notion("pages/" + id, "PATCH", { properties: stamp });
    }
    results.push({ id: row.id, name, to, sent: !!ok, hadCv: !!atsCv });
    // Resend allows 2 requests a second by default; 600ms keeps a margin under
    // it, so a full batch is well inside the 60s function budget.
    await new Promise((r) => setTimeout(r, 600));
  }

  const sent = results.filter((r) => r.sent).length;
  return send(200, { ok: true, dryRun, batch: rows.length, sent, results });
}

// Catch-up pass for rows the inline attempt had no time for, and for anyone
// whose CV predates this feature. One bounded batch per call, same shape as the
// back-fill: the panel drives it, the flag on the row is what tracks progress.
async function boostPendingCvs(b, res, req) {
  const send = (status, obj) => { res.statusCode = status; return res.end(JSON.stringify(obj)); };
  const authed = (OWNER_KEY && String(b.key || "").trim() === OWNER_KEY) || cronOk(req);
  if (!authed) return send(403, { ok: false, error: "forbidden" });
  if (!NOTION_TOKEN) return send(503, { ok: false, error: "not_configured" });
  if (!aiAvailable()) return send(503, { ok: false, error: "ai_not_configured" });
  // A rewrite is one AI call of several seconds, so the batch is small — the
  // panel loops it the same way it loops the back-fill.
  const limit = Math.min(Math.max(Number(b.limit) || 5, 1), 8);

  const q = await notion("databases/" + DB_ID + "/query", "POST", {
    page_size: limit,
    filter: {
      and: [
        { property: "ATS CV Text", rich_text: { is_not_empty: true } },
        { or: [
          { property: "حالة تحسين السيرة", select: { is_empty: true } },
          { property: "حالة تحسين السيرة", select: { equals: "لم يبدأ" } },
        ] },
      ],
    },
    sorts: [{ timestamp: "created_time", direction: "descending" }],
  });
  if (!q.ok) return send(502, { ok: false, error: "notion_failed" });
  const rows = ((await q.json()).results) || [];

  const results = [];
  for (const row of rows) {
    const props = row.properties || {};
    const name = txt(props["Candidate Name"]);
    const cvText = (props["ATS CV Text"] && props["ATS CV Text"].rich_text || []).map((t) => t.plain_text).join("");
    const boost = await boostCv(cvText, txt(props["Target Role"]));
    const patch = applyCvBoost({}, boost);
    await notion("pages/" + row.id, "PATCH", { properties: patch });
    results.push({ id: row.id, name, ok: !!boost, before: boost && boost.before, after: boost && boost.after, lang: boost && boost.lang });
  }
  return send(200, { ok: true, batch: rows.length, done: results.filter((r) => r.ok).length, results });
}

// ── الاستدراك: من سبق ومرّ بلا نصّ سيرة ──────────────────────────────────────
// القياس يوم كتابة هذا (2026-09-29): ٢٦٤٠١ صفاً من ٢٦٤٠٢ بلا «ATS CV Text»،
// منها ٢٤٨٨٢ صفاً **يحمل رابط ملف** فيمكن إعادة قراءته؛ ومن صفوف الموقع وحدها
// ١٠٦٩. فالمشكلة ليست نظرية، والوقود ليس ناقصاً بل غائب.
//
// دفعةٌ واحدة مقيّدة في كل نداء: كل صفٍّ تنزيلُ ملفٍ ثم نداءُ أزور، والمسار
// نفسه ٦٠ ثانية. والوسمُ في «سبب عدم الاكتمال» هو ما يمنع إعادة محاولة صفٍّ لن
// يُقرأ أبداً في كل دفعة بعده.
const CATCHUP_MARK = "[استدراك";

// روابط درايف تُفتح على صفحة عرض لا على بايتات؛ هذه صيغة التنزيل المباشر. وما
// ليس درايف يُنزَّل كما هو.
function directFileUrl(url) {
  const u = String(url || "");
  if (!/^https?:\/\/(drive|docs)\.google\.com/i.test(u)) return u;
  const m = /(?:\/d\/|[?&]id=)([A-Za-z0-9_-]{16,})/.exec(u);
  return m ? `https://drive.google.com/uc?export=download&id=${m[1]}` : u;
}

// يعيد `{ base64, type }` أو null. النوع من البصمة الأولى لا من الترويسة: درايف
// يردّ `text/html` على ملفٍ غير عام و`octet-stream` على الباقي، وكلاهما يكذب
// عن المحتوى.
async function fetchCvBytes(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const r = await fetch(directFileUrl(url), { redirect: "follow", signal: controller.signal });
    if (!r.ok) return null;
    const ct = String(r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length) return null;
    const head = buf.subarray(0, 4).toString("latin1");
    const type = head === "%PDF" ? "application/pdf"
      : buf[0] === 0x89 && head.slice(1) === "PNG" ? "image/png"
      : buf[0] === 0xff && buf[1] === 0xd8 ? "image/jpeg"
      : ct;
    return { base64: buf.toString("base64"), type, size: buf.length };
  } catch (e) {
    console.error("cv fetch failed", String(e).slice(0, 160));
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function extractPendingCvs(b, res, req) {
  const send = (status, obj) => { res.statusCode = status; return res.end(JSON.stringify(obj)); };
  const authed = (OWNER_KEY && String(b.key || "").trim() === OWNER_KEY) || cronOk(req);
  if (!authed) return send(403, { ok: false, error: "forbidden" });
  if (!NOTION_TOKEN) return send(503, { ok: false, error: "not_configured" });
  if (!azureReady()) return send(503, { ok: false, error: "azure_not_configured" });
  const dryRun = b.dryRun === true || b.dryRun === "true";
  // تنزيلٌ ثم قراءةٌ لكل صفّ — ثلاثة صفوف هي ما يتّسع في ميزانية المسار بأمان.
  const limit = Math.min(Math.max(Number(b.limit) || 2, 1), dryRun ? 50 : 3);
  const startedAt = Date.now();

  const q = await notion("databases/" + DB_ID + "/query", "POST", {
    page_size: limit,
    filter: {
      and: [
        { property: "ATS CV Text", rich_text: { is_empty: true } },
        { property: "CV Link", url: { is_not_empty: true } },
        { property: REASON_PROP, rich_text: { does_not_contain: CATCHUP_MARK } },
      ],
    },
    sorts: [{ timestamp: "created_time", direction: "descending" }],
  });
  if (!q.ok) return send(502, { ok: false, error: "notion_failed" });
  const body = await q.json();
  const rows = body.results || [];
  if (dryRun) {
    return send(200, {
      ok: true, dryRun: true, queued: rows.length, more: !!body.has_more,
      rows: rows.map((r) => ({ id: r.id, name: txt(r.properties && r.properties["Candidate Name"]), link: txt(r.properties && r.properties["CV Link"]) })),
    });
  }

  const results = [];
  for (const row of rows) {
    // لا يبدأ صفٌّ جديد إن لم يبقَ له وقت — نصفُ قراءةٍ تُقتل مع المسار تكتب
    // لا شيء، وتحرق الميزانية على من بعده.
    if (Date.now() - startedAt > HARD_MS - LOCAL_MIN_MS - 8000) { results.push({ id: row.id, skipped: "out_of_budget" }); break; }
    const props = row.properties || {};
    const name = txt(props["Candidate Name"]);
    const link = txt(props["CV Link"]);
    const file = await fetchCvBytes(link, 10000);
    const out = file
      ? await extractCvText(file, HARD_MS - (Date.now() - startedAt))
      : { text: "", reason: "fetch_failed" };
    const patch = applyCvReadStatus({}, { text: out.text, source: out.text ? "local" : "", reason: out.reason, note: `${CATCHUP_MARK} ${today()}] من الرابط` }, false);
    const w = await notionWriteOptional("pages/" + row.id, "PATCH", { properties: patch }, STATUS_PROPS, "cv catch-up");
    results.push({ id: row.id, name, ok: !!out.text, chars: out.text.length, reason: out.reason || "", written: !!w.ok });
  }
  return send(200, { ok: true, batch: rows.length, done: results.filter((r) => r.ok).length, results });
}

// مصادقةُ مسارات المالك واحدة في هذا الملف: مفتاح اللوحة أو رأس الكرون. تُجمع
// هنا كي لا يُفتح مسارٌ جديد بشرطٍ أرخص من أخويه سهواً.
const ownerAuthed = (b, req) => (OWNER_KEY && String(b.key || "").trim() === OWNER_KEY) || cronOk(req);
const boolArg = (v) => v === true || v === "true";
// لا حقل شخصي في ردود هذين المسارين: لا اسم ولا بريد ولا جوال. اللوحة تحتاج
// أن تعرف **ماذا تغيّر**، لا **مَن** — والاسم في ردٍّ لا يعرضه أحد تسريبٌ مجاني.

/* ───────────── ① إصلاح الامتثال المتناقض في الصفوف القائمة ─────────────
 * حسابيٌّ بحت: صفر نداء نموذج، صفر ريال. المرشّح الذي تنطبق عليه الشروط يُقاس
 * بـ`complianceRepair` — والقرار كله في تلك الدالة الصِرفة المختبَرة، لا في
 * مُرشِّح نوشن. المُرشِّح يضيّق النطاق فقط (٤٢٤ صفّاً في القياس بدل ٢٦٤١٩).
 * ويحتاج مؤشّراً (`cursor`): الصفوف السليمة تبقى في نطاق المُرشِّح بعد الجولة،
 * فبلا مؤشّرٍ تدور الجولة على أول صفحةٍ إلى الأبد.
 */
async function fixCompliance(b, res, req) {
  const send = (status, obj) => { res.statusCode = status; return res.end(JSON.stringify(obj)); };
  if (!ownerAuthed(b, req)) return send(403, { ok: false, error: "forbidden" });
  if (!NOTION_TOKEN) return send(503, { ok: false, error: "not_configured" });
  const dryRun = boolArg(b.dryRun);
  const limit = Math.min(Math.max(Number(b.limit) || 25, 1), dryRun ? 100 : 50);
  const cursor = clip(b.cursor, 200);
  const startedAt = Date.now();

  const q = await notion("databases/" + DB_ID + "/query", "POST", {
    page_size: limit,
    ...(cursor ? { start_cursor: cursor } : {}),
    filter: {
      or: [
        // كل ⛔ — ٤٢٣ صفّاً، والدالة تفصل المتناقض منها عن السليم.
        { property: COMP_PROP, select: { equals: COMP_BLOCKED } },
        // والاتجاه المعكوس، مُرشَّحاً بدقّة: «✅ مطابق» على مهنةٍ مقصورة لغير
        // سعودي. لا يُمشّط الـ✅ كله (٢١٦٠٠ صفّاً) لأجل صفٍّ واحد.
        { and: [
          { property: COMP_PROP, select: { equals: COMP_OK } },
          { property: SAUD_PROP, select: { equals: "مقصورة على السعوديين" } },
          { property: "Nationality Type", select: { equals: "غير سعودي" } },
        ] },
      ],
    },
  });
  if (!q.ok) return send(502, { ok: false, error: "notion_failed" });
  const body = await q.json();
  const rows = body.results || [];

  const changes = [], counts = {};
  let fixed = 0, intact = 0, failed = 0, deferred = 0;
  for (const row of rows) {
    const props = row.properties || {};
    const saud = txt(props[SAUD_PROP]);
    const cur = txt(props[COMP_PROP]);
    const nat = rowNationalityKind(props);
    const to = complianceRepair(saud, nat, cur);
    if (!to) { intact += 1; continue; }
    // ما لم يتّسع من الدفعة لا يُحسب مُصلَحاً ولا يُعرَض كأنه تغيّر: المؤشّر
    // يُعاد كما هو، والصفّ يعود في الجولة القادمة لأنه لم يُكتب.
    if (!dryRun && Date.now() - startedAt > HARD_MS) { deferred += 1; continue; }
    const key = `${saud || "—"} × ${nat || "—"}: ${cur} ⇒ ${to}`;
    counts[key] = (counts[key] || 0) + 1;
    changes.push({ id: row.id, saudization: saud, nationality: nat, from: cur, to });
    if (dryRun) { fixed += 1; continue; }
    const w = await notionWriteOptional(
      "pages/" + row.id, "PATCH", { properties: { [COMP_PROP]: { select: { name: to } } } }, SAUD_PROPS, "compliance fix");
    if (w.ok) fixed += 1; else failed += 1;
  }
  return send(200, {
    ok: true, dryRun, scanned: rows.length, fixed, intact, failed, deferred,
    // `more` وحده يقول هل بقي عمل، و`next` هو المؤشّر الذي يُمرَّر في الجولة
    // التالية. وفُصلا لأن مؤشّراً فارغاً يعني «الصفحة الأولى» لا «انتهت»: دفعةٌ
    // تأجّل بعضها لضيق الوقت تُعاد بالمؤشّر **نفسه**، وقد يكون فارغاً.
    more: deferred ? true : !!body.has_more,
    next: deferred ? cursor : (body.has_more ? (body.next_cursor || "") : ""),
    counts, changes: changes.slice(0, 100),
  });
}

/* ───────────── ② استدراك التوطين للصفوف الظاهرة ─────────────
 * الصفوف المختومة بوظيفة هي بالضبط ما يراه صاحب العمل في لوحته، وكلها بلا
 * توطين (١١٧ من ١١٧ في قياس 2026-09-29) — فالشاشة تقول «لم يُفحص» لكل من
 * يظهر فيها. وكلفتها الحقيقية **عدد المسميات المتميّزة** لا عدد الصفوف:
 * ٣٨ مسمّى حقيقياً لـ١١٧ صفّاً (وصفّان بلا مسمّى أصلاً ⇒ صفر نداء لهما)،
 * لأن ذاكرة `SAUD_CACHE` تُجيب المكرّر بلا نداء.
 *
 * ولا يدهس قيمةً موجودة: الكتابة تمرّ بـ`applySaudization` نفسها التي يمرّ بها
 * المسار الحيّ، وهي تترك التوطين المحسوم والامتثال المحسوم كما هما. والمُرشِّح
 * نفسه «التوطين فارغ»، فالجولة تُفرِّغ نفسها ولا تعيد صفّاً كُتب.
 */
async function backfillSaudization(b, res, req) {
  const send = (status, obj) => { res.statusCode = status; return res.end(JSON.stringify(obj)); };
  if (!ownerAuthed(b, req)) return send(403, { ok: false, error: "forbidden" });
  if (!NOTION_TOKEN) return send(503, { ok: false, error: "not_configured" });
  const dryRun = boolArg(b.dryRun);
  if (!dryRun && !aiAvailable()) return send(503, { ok: false, error: "ai_not_configured" });
  const limit = Math.min(Math.max(Number(b.limit) || 10, 1), dryRun ? 100 : 40);
  // الظاهرون أولاً — وهم المقصودون. و`scope=all` يوسّعها إلى كل صفّ بلا توطين
  // حين يطلب المالك ذلك صراحةً، لا افتراضاً.
  const stampedOnly = clip(b.scope, 20) !== "all";
  const startedAt = Date.now();

  const q = await notion("databases/" + DB_ID + "/query", "POST", {
    page_size: limit,
    filter: {
      and: [
        { property: SAUD_PROP, select: { is_empty: true } },
        ...(stampedOnly ? [{ property: "الوظيفة المتقدم لها", rich_text: { is_not_empty: true } }] : []),
      ],
    },
    sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
  });
  if (!q.ok) return send(502, { ok: false, error: "notion_failed" });
  const body = await q.json();
  const rows = body.results || [];

  // المسمّى المسؤول عنه السؤال: ما كتبه المرشّح عن نفسه (Target Role)، ثم
  // تصنيف المجال. وعنوان الإعلان **لا** يُستعمل هنا: الصفّ قد يكون مختوماً
  // بوظيفةٍ تقدّم لها ولا تعبّر عن مهنته، والتوطين خاصيّةُ مهنته هو.
  const roleOf = (props) => clip(txt(props["Target Role"]) || txt(props["Field"]), 160);
  const roles = new Map();
  for (const r of rows) { const k = roleOf(r.properties || {}); if (k) roles.set(k.toLowerCase(), (roles.get(k.toLowerCase()) || 0) + 1); }
  if (dryRun) {
    return send(200, {
      ok: true, dryRun: true, queued: rows.length, more: !!body.has_more,
      scope: stampedOnly ? "stamped" : "all",
      // الكلفة الحقيقية، لا عدد الصفوف: نداءٌ واحد لكل مسمّى متميّز.
      distinctRoles: roles.size, noRole: rows.filter((r) => !roleOf(r.properties || {})).length,
      roles: [...roles.entries()].map(([role, n]) => ({ role, rows: n })),
    });
  }

  const results = [];
  for (const row of rows) {
    const props = row.properties || {};
    const role = roleOf(props);
    const left = HARD_MS - (Date.now() - startedAt);
    // مسمّى مُجابٌ في الذاكرة لا يكلّف شيئاً فيمرّ دائماً؛ ومسمّى جديد لا يُبدأ
    // إلا إن بقي له وقتٌ يكفي — ونصفُ نداءٍ يُقتل مع المسار يكتب «بحاجة فحص»
    // على صفٍّ كان سيُحسم، ويخرجه من المُرشِّح فلا يُعاد.
    if (left < LOCAL_MIN_MS && role && !SAUD_CACHE.has(role.toLowerCase().replace(/\s+/g, " "))) {
      results.push({ id: row.id, skipped: "out_of_budget" });
      break;
    }
    const calc = await occupationSaudization(role, Math.max(left - 6000, 5000));
    const patch = applySaudization({}, calc, rowNationalityKind(props), props);
    if (!Object.keys(patch).length) { results.push({ id: row.id, skipped: "already_decided" }); continue; }
    const w = await notionWriteOptional("pages/" + row.id, "PATCH", { properties: patch }, SAUD_PROPS, "saudization catch-up");
    results.push({
      id: row.id, role, source: calc.source || "",
      saudization: (patch[SAUD_PROP] && patch[SAUD_PROP].select.name) || "",
      compliance: (patch[COMP_PROP] && patch[COMP_PROP].select.name) || "",
      written: !!w.ok,
    });
  }
  return send(200, {
    ok: true, batch: rows.length, more: !!body.has_more,
    written: results.filter((r) => r.written).length,
    calls: results.filter((r) => r.source === "azure").length,
    results,
  });
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "GET") {
    const url = new URL(req.url, "http://x");
    // Cron drains the back-fill queue on a schedule; the owner panel can also
    // drive it by hand. Same handler, same batch limits, same de-duplication.
    if (url.searchParams.get("action") === "extract-cvs") {
      return extractPendingCvs({
        key: url.searchParams.get("key") || "",
        limit: url.searchParams.get("limit") || 2,
        dryRun: url.searchParams.get("dryRun") || false,
      }, res, req);
    }
    // إصلاحُ الامتثال المتناقض واستدراكُ التوطين: مسارا مالكٍ بنفس مصادقة
    // `extract-cvs` ونفس شكل الدفعات و`dryRun`.
    if (url.searchParams.get("action") === "fix-compliance") {
      return fixCompliance({
        key: url.searchParams.get("key") || "",
        limit: url.searchParams.get("limit") || 25,
        cursor: url.searchParams.get("cursor") || "",
        dryRun: url.searchParams.get("dryRun") || false,
      }, res, req);
    }
    if (url.searchParams.get("action") === "saudization") {
      return backfillSaudization({
        key: url.searchParams.get("key") || "",
        limit: url.searchParams.get("limit") || 10,
        scope: url.searchParams.get("scope") || "",
        dryRun: url.searchParams.get("dryRun") || false,
      }, res, req);
    }
    if (url.searchParams.get("action") === "boost-cvs") {
      return boostPendingCvs({ key: url.searchParams.get("key") || "", limit: url.searchParams.get("limit") || 5 }, res, req);
    }
    if (url.searchParams.get("action") === "backfill") {
      return backfillCandidateCopies({
        key: url.searchParams.get("key") || "",
        limit: url.searchParams.get("limit") || 25,
        requireCv: url.searchParams.get("requireCv") || false,
        dryRun: url.searchParams.get("dryRun") || false,
      }, res, req);
    }
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

  const startedAt = Date.now();
  const b = await readBody(req);

  // Owner-only maintenance action, not part of the public application flow.
  if (b.type === "backfill-copies") return backfillCandidateCopies(b, res, req);
  if (b.type === "boost-cvs") return boostPendingCvs(b, res, req);
  if (b.type === "extract-cvs") return extractPendingCvs(b, res, req);
  if (b.type === "fix-compliance") return fixCompliance(b, res, req);
  if (b.type === "saudization") return backfillSaudization(b, res, req);

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
  // Derived once, here, because every consumer downstream reads this one
  // value: the ATS "الوظيفة المتقدم لها" stamp, the Notes line, the n8n
  // payload, the employer's email and the candidate's own copy. A lookup only
  // happens in the narrow real-id/empty-title window; a pool signup and a
  // form that did send a title never touch the network.
  const jobTitle = clip(b.jobTitle, 220)
    || (await jobTitleById(jobId))
    || "General candidate pool";
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
    // «حالة القراءة» لم تعد تُكتب هنا: كانت «مكتمل» ثابتةً على كل صفّ، بما فيه
    // ١٠٢٥ صفاً لا نصّ سيرة فيها. صاحبها الآن `applyCvReadStatus` وحده — يكتبها
    // بعد أن يُعرف هل استُخرجت السيرة فعلاً.
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
  if (nationality) props["Nationality"] = { rich_text: rt(nationality) };
  // Best-effort citizenship signal for the employer browse filter — a
  // dedicated "Saudi national" pick on Residence Status is authoritative;
  // otherwise infer from the nationality text itself.
  //
  // صار الاشتقاق في `nationalityKind` وحدها، لأن الامتثال يُبنى عليه: تعريفان
  // للجنسية يعنيان رقاقةً تقول ⛔ وحقلاً يقول «سعودي». وتُكتب الآن حتى بلا نصّ
  // جنسية — «مقيم بإقامة…» خيارٌ يقطع بها.
  const natKind = nationalityKind(nationality, residenceStatus);
  if (natKind) props["Nationality Type"] = { select: { name: natKind } };
  if (residenceStatus) props["حالة الإقامة"] = { select: { name: residenceStatus } };
  // المسمّى الذي يُسأل عنه التوطين: ما كتبه المرشّح عن نفسه. وعنوانُ الإعلان
  // بديلٌ عنه إن لم يكتب شيئاً — إلا «سلّة المرشحين» فهي ليست مهنة.
  const POOL_TITLE = "General candidate pool";
  const roleForSaud = field || (jobId === "candidate-pool" || jobTitle === POOL_TITLE ? "" : jobTitle);

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
    // يُطلق **قبل** انتظار n8n لا بعده: نافذة n8n وحدها تبلغ خمسين ثانية،
    // فسؤالُ التوطين يجري داخلها ولا يضيف إلى انتظار المتقدّم شيئاً. والدالة
    // لا ترمي أبداً، فلا وعدٌ معلّق يسقط العملية قبل أن يُنتظر.
    const saudWork = occupationSaudization(roleForSaud);
    // الاحتياطي يُسأل عن وجوده قبل النداء، لأن جوابه يحدّد نافذة n8n.
    const n8n = await forwardToN8n(n8nPayload, cvFallbackPossible(cvFile) ? N8N_MS_SHARED : N8N_MS_SOLO);

    // n8n أولاً دائماً. والاحتياطي لا يُنادى إلا إذا لم يُرجع نصّاً — فنجاحه
    // يعني صفر نداءٍ وصفر تكلفةٍ على أزور.
    let cvOutcome = { text: String(n8nAi(n8n).ats_cv_markdown || "").trim(), source: "n8n", reason: "" };
    if (!cvOutcome.text) {
      const why = n8n.configured === false ? "n8n غير مهيّأ"
        : n8n.ok ? "n8n ردّ بلا نصّ سيرة" : "مهلة n8n أو فشله";
      const local = await extractCvText(cvFile, HARD_MS - (Date.now() - startedAt));
      cvOutcome = { text: local.text, source: local.text ? "local" : "", reason: local.reason, note: why };
    }

    // n8n أولاً هنا أيضاً، كنصّ السيرة تماماً: إن ردّ خطّافُ الموقع بتوطينٍ من
    // القائمة فهو محسوبٌ على السيرة كاملة، وحسابُنا على المسمّى وحده. وما ليس
    // في القائمة الأربع لا يُكتب — الخطّاف مصدرٌ خارجي، لا يُوسَّع به المخزون.
    const fromN8n = n8nAi(n8n);
    // يُنتظر على أي حال — لا وعدٌ سائب يُترك بعد الردّ. وهو انطلق أولاً وحمولته
    // أسطرٌ، فانتظارُه هنا صفرٌ عملياً بعد نافذة n8n.
    const mine = await saudWork;
    const saud = SAUD_VALUES.includes(fromN8n.saudization)
      ? { saudization: fromN8n.saudization, details: saudDetailLine(fromN8n.saudization, roleForSaud, fromN8n.saudization_details), source: "n8n" }
      : mine;

    const existing = await findExisting(email, phone);
    if (existing) {
      // SECURITY / data-integrity: a resubmission must NOT re-expose a
      // candidate an admin deliberately hid, nor wipe recruiter notes. Both
      // props are create-only — drop them from the update so the existing
      // hide flag and Notes are left exactly as the recruiter left them.
      delete props["مخفي عن الموقع"];
      delete props["Notes"];
      applyN8nEnrichment(props, n8n, false);
      // إعادة تقديمٍ بلا مرفق لا تُنزّل حالة صفٍّ سيرتُه مقروءةٌ عندنا أصلاً.
      const hadCv = !!((existing.properties && existing.properties["ATS CV Text"] && existing.properties["ATS CV Text"].rich_text) || []).length;
      applyCvReadStatus(props, cvOutcome, hadCv);
      applySaudization(props, saud, natKind, existing.properties);
      const r = await notionWriteOptional("pages/" + existing.id, "PATCH", { properties: props }, STATUS_PROPS, "candidate update");
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
    applyCvReadStatus(props, cvOutcome, false);
    applySaudization(props, saud, natKind, null);
    // n8n has already spent most of the budget, so the rewrite only runs inline
    // when there is real time left; otherwise the row is queued and the catch-up
    // pass picks it up. Either way the candidate's mail carries the best CV we
    // have at the moment it is sent.
    const cvText = cvOutcome.text;
    let boost = null;
    if (cvText && Date.now() - startedAt < 30000) {
      boost = await boostCv(cvText, field);
      applyCvBoost(props, boost);
    } else if (cvText) {
      props["حالة تحسين السيرة"] = { select: { name: "لم يبدأ" } };
    } else {
      props["حالة تحسين السيرة"] = { select: { name: "لا توجد سيرة" } };
    }
    const r = await notionWriteOptional("pages", "POST", { parent: { database_id: DB_ID }, properties: props }, STATUS_PROPS, "candidate create");
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
      summary: n8nAi(n8n).candidate_summary,
      atsCv: (boost && boost.cvEn) || cvText,
      boost,
    });
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ref, updated: false, n8n }));
  } catch (e) {
    console.error("candidate handler error", e);
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "server_error" }));
  }
}
