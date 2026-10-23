// SHR-HR — إعلانات الوظائف (بوست توظيف). ملف مساعد (لا يُحتسب دالة): يُستدعى من api/shr.js وحده.
//
// الدورة كلها داخل النظام: draft → pending_approval → approved → published → closed.
// «published» تعني «ظاهر داخل صفحة SHR الخاصة» فقط. قرار موضع النشر العام (صفحة /jobs لـBP أو منصات
// خارجية) معلّق عند المالك: القناة الوحيدة المقبولة shr_private، وغيرها 409 channel_not_enabled
// (معطّلة في shr_post_channels؛ وحتى لو فُعّلت فلا شيء ينشر خارجاً في هذه المرحلة).
//
// كل وصول للبيانات عبر db = scoped(ctx) من _shr.js. لا شبكة ولا ذكاء اصطناعي ولا رسائل:
// post-suggest قالب قاعدي محلي. بيانات وهمية. لا حذف: الإغلاق فقط.
import { HttpError, audit } from "./_shr.js";
import { getSettings, assertEstablishmentOpen, effectiveState } from "./_shr_compliance.js";
import * as ats from "./_shr_ats.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const STATUSES = ["draft", "pending_approval", "approved", "published", "closed"];
export const CHANNELS = ["shr_private", "public_bp_jobs", "external"];
const LANGS = ["ar", "en"];
const APPROVER_ROLES = new Set(["tenant_owner", "operator"]);
const BLOCKING = new Set(["restricted", "suspected"]);
const SALARY_MAX = 1000000;

export const POST_GET = new Set(["posts"]);
export const POST_POST = new Set(["post-create", "post-update", "post-submit", "post-approve", "post-publish", "post-close", "post-suggest", "post-applicant-add"]);
export const isPostAction = (a) => POST_GET.has(a) || POST_POST.has(a);

const bad = (code, extra) => new HttpError(400, code, extra);
const str = (v, max) => String(v ?? "").trim().slice(0, max);
const needId = (v) => { if (!UUID.test(String(v || ""))) throw bad("bad_id"); return String(v); };
const nowIso = () => new Date().toISOString();

// --------------------------------------------------------- حرس المحتوى ----
// يعمل على نص مطبَّع (أرقام عربية→لاتينية، حذف التشكيل، توحيد الألف والتاء المربوطة والياء)،
// فالأنماط أدناه مكتوبة بالصورة المطبَّعة. ما لا يمرّ يُرفض بسبب مسمّى ومقطع ظاهر.
const IND = "٠١٢٣٤٥٦٧٨٩", PER = "۰۱۲۳۴۵۶۷۸۹";
export const normText = (s) => String(s ?? "")
  .replace(/[٠-٩]/g, (d) => IND.indexOf(d)).replace(/[۰-۹]/g, (d) => PER.indexOf(d))
  .normalize("NFKC").toLowerCase()
  .replace(/[ً-ٰٟـ]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
  .replace(/[ \t ]+/g, " ");

// رخصة قيادة/مهنة شرط على المرشح لا ادعاء من المُعلِن: تُستثنى.
const LICENCE_OK = /^\s*(?:ال)?(?:قياده|سياقه|سواقه|مهنيه|مزاوله|مهنه|رافعه|معدات|سلامه|حفر)/;
const RULES = [
  ["guarantee", /ضمان|نضمن|ضامن|مضمون|guarante|نتعهد|بدون رفض|دون رفض|قبول مؤكد|نجاح مؤكد|(?:100|مئه)\s*%?\s*(?:نجاح|قبول|مضمون)/g],
  ["compliance_claim", /امتثال|compliant|compliance|accredited|معتمدون|معتمدين رسميا|اعتماد رسمي من|(?:متوافق|مطابق|ملتزم)(?:ه|ون|ين)?\s*(?:مع|بال|ل(?:ل)?)\s*(?:انظمه|نظام|قوانين|لوايح|لوائح)|نظامي(?:ه)?\s*(?:بالكامل|100)|(?:نحن|شركتنا|مؤسستنا|مكتبنا|منشاتنا)\s+[^.،\n]{0,25}?(?:معتمد|ملتزم|متوافق|مطابق)|iso\s?\d{3,5}/g],
  ["gov_outcome_promise", /(?:نستخرج|نصدر|نخلص|ننجز|نجهز|نتكفل|نتولي)\s*(?:لك|لكم)?\s*(?:ب|ل)?(?:ال)?(?:تاشيره|اقامه|كفاله|فيزا|فيزه|تصريح|رخصه عمل|نقل\s*(?:ال)?(?:خدمات|كفاله)|موافقه)|(?:نوفر|نؤمن|توفير)\s*(?:لك|لكم)?\s*(?:ال)?(?:تاشيره|اقامه|فيزا|فيزه|تصريح عمل)|(?:تاشيره|اقامه|فيزا|فيزه|نقل\s*(?:ال)?(?:كفاله|خدمات)|تصريح عمل)\s*(?:جاهز|جاهزه|فوري|فوريه|مضمون|مضمونه|خلال)|(?:موافقه|قبول|قرار)\s*(?:ال)?(?:جهه|وزاره|جوازات|قوي|مقيم|ابشر)\s*(?:مؤكد|مضمون|حتمي)/g],
  ["contact_info", /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|https?:\/\/|www\.|\.(?:com|net|org|sa)\b|(?:\+|00)?966[\s-]?\d|\b0?5\d[\s-]?\d{3}[\s-]?\d{4}\b|(?:\d[\s-]?){9,}|واتس|whats?\s?app|تليجرام|تلقرام|telegram|سناب|snapchat|انستغرام|instagram|اتصل|راسلنا/g],
];

// أرقام الراتب في النص: ما حول كلمة راتب/أجر، أو عدد تتبعه عملة، أو «ألف». كلها يجب أن تطابق النطاق المُدخَل.
const NOT_MONEY = /^\s*(?:سنه|سنوات|سنين|year|yr|يوم|ايام|اشهر|شهر|ساعه|ساعات|%|٪|مقابله|وظيفه|فني|عامل)/;
function moneyNumbers(t) {
  const out = [];
  const toNum = (s) => Number(String(s).replace(/[,،\s]/g, ""));
  const take = (m, i, mult = 1) => { const n = toNum(m[i]) * mult; if (Number.isFinite(n)) out.push({ n, m: m[0].trim() }); };
  let m;
  const k = /(\d[\d,.]*)\s*(?:الف|الاف|k)(?![ء-يa-z])/gi; while ((m = k.exec(t))) take(m, 1, 1000);
  const cur = /(\d[\d,.]*)\s*(?:-|الي|الى|to|–)\s*(\d[\d,.]*)\s*(?:ريال|ر\.?\s?س|sar|sr|riyal)|(\d[\d,.]*)\s*(?:ريال|ر\.?\s?س|sar|sr|riyal)/gi;
  while ((m = cur.exec(t))) { if (m[1]) { take(m, 1); take(m, 2); } else take(m, 3); }
  const ctx = /(?<![ء-ي])(?:ال)?(?:راتب|رواتب|اجر|اجور)(?![ء-ي])|(?<![a-z])(?:salary|wage|pay)(?![a-z])/g;
  while ((m = ctx.exec(t))) {
    const win = t.slice(m.index, m.index + 60).split(/[\n.]/)[0];
    const nums = /(\d[\d,.]*)(?!\d)(.{0,12})/g; let x;
    while ((x = nums.exec(win))) { if (!NOT_MONEY.test(x[2])) { const n = toNum(x[1]); if (Number.isFinite(n)) out.push({ n, m: win.trim().slice(0, 40) }); } }
  }
  return out;
}
const WORD_MONEY = /(?<![ء-ي])(?:الف|الفين|الاف|مئه|ميه|مئتين|ثلاثه|اربعه|خمسه|سته|سبعه|ثمانيه|تسعه|عشره|عشرين|ثلاثين|اربعين|خمسين)(?![ء-ي])[^.\n]{0,20}?(?:ريال|ر\.?\s?س)/g;

// guardText({title, description, requirements, city}, {min, max}, clientNames) → [{code, field, match}]
export function guardText(fields, salary = {}, clientNames = []) {
  const reasons = [];
  const allowed = new Set([salary.min, salary.max].filter((x) => x !== null && x !== undefined).map(Number));
  const names = clientNames.map(normText).map((x) => x.trim()).filter((x) => x.length >= 3);
  for (const [field, raw] of Object.entries(fields)) {
    const t = normText(raw);
    if (!t.trim()) continue;
    const seen = new Set();
    const add = (code, match) => { const key = code + "|" + match; if (!seen.has(key)) { seen.add(key); reasons.push({ code, field, match: String(match).trim().slice(0, 60) }); } };
    for (const [code, rx] of RULES) { rx.lastIndex = 0; let m; while ((m = rx.exec(t))) { add(code, m[0]); if (m[0] === "") rx.lastIndex++; } }
    // ادعاء الترخيص
    let m;
    const lic = /مرخص\S*|مرخوص\S*|licen[cs]ed|ترخيص|رخصه|licen[cs]e/g;
    while ((m = lic.exec(t))) {
      const tail = t.slice(m.index + m[0].length);
      const head = t.slice(Math.max(0, m.index - 8), m.index);
      if ((m[0] === "ترخيص" || m[0] === "رخصه") && LICENCE_OK.test(tail)) continue;
      if (m[0] === "license" && /driving\s*$/.test(head)) continue;
      add("licence_claim", m[0]);
    }
    // راتب غير مُدخَل بشرياً
    for (const x of moneyNumbers(t)) if (!allowed.has(x.n)) add("invented_salary", x.m);
    WORD_MONEY.lastIndex = 0;
    while ((m = WORD_MONEY.exec(t))) add("invented_salary", m[0]);
    // اسم عميل
    for (const nm of names) if (t.includes(nm)) add("client_name", nm);
  }
  return reasons;
}

async function assertContent(db, fields, salary) {
  const clients = await db.get("shr_client_companies?select=name_ar");
  const reasons = guardText(fields, salary, clients.map((c) => c.name_ar));
  if (reasons.length) throw bad("content_rejected", { reasons });
}
const fieldsOf = (p) => ({ title: p.title, description: p.description, requirements: p.requirements, city: p.city });

// ------------------------------------------------------------ مساعدات ----
async function getPost(db, id) {
  const p = (await db.get(`shr_job_posts?id=eq.${needId(id)}&select=*`))[0];
  if (!p) throw new HttpError(404, "not_found");
  return p;
}
async function getJob(db, id) {
  const j = (await db.get(`shr_jobs?id=eq.${needId(id)}&select=*`))[0];
  if (!j) throw new HttpError(404, "not_found");
  return j;
}
async function getEstablishment(db, id) {
  const e = (await db.get(`shr_establishments?id=eq.${needId(id)}&select=id,name_ar`))[0];
  if (!e) throw new HttpError(404, "not_found");
  return e;
}
// القناة: shr_private وحدها. غيرها معطّل (409) أو غير مُنفَّذ (409) أو مجهول (400).
async function assertChannel(db, channel) {
  if (channel === undefined || channel === null || channel === "") return "shr_private";
  const c = String(channel);
  if (!CHANNELS.includes(c)) throw bad("bad_channel");
  if (c === "shr_private") return c;
  const row = (await db.get(`shr_post_channels?channel=eq.${c}&select=channel_enabled`))[0];
  if (!row || row.channel_enabled !== true) throw new HttpError(409, "channel_not_enabled", { channel: c });
  throw new HttpError(409, "channel_not_implemented", { channel: c });
}
function salaryField(v, name) {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > SALARY_MAX) throw bad("bad_" + name);
  return n;
}
function readInput(b, base = {}) {
  const o = {};
  if (b.title !== undefined) o.title = str(b.title, 120);
  if (b.description !== undefined) o.description = str(b.description, 1500) || null;
  if (b.requirements !== undefined) o.requirements = str(b.requirements, 1500) || null;
  if (b.city !== undefined) o.city = str(b.city, 60) || null;
  if (b.language !== undefined) { if (!LANGS.includes(String(b.language))) throw bad("bad_language"); o.language = String(b.language); }
  const lo = salaryField(b.salary_min, "salary"), hi = salaryField(b.salary_max, "salary");
  if (lo !== undefined) o.salary_min = lo;
  if (hi !== undefined) o.salary_max = hi;
  const min = o.salary_min !== undefined ? o.salary_min : base.salary_min, max = o.salary_max !== undefined ? o.salary_max : base.salary_max;
  if (min !== null && min !== undefined && max !== null && max !== undefined && min > max) throw bad("bad_salary_range");
  return o;
}
async function writeEvent(db, user, post, to, note) {
  await db.post("shr_job_post_events", { post_id: post.id, from_status: post.status || null, to_status: to, actor: user.sub, note: str(note, 300) || null, at: nowIso() });
}

// التحقق المشترك قبل أي طلب نشر: وظيفة مفتوحة، منشأة معلِنة غير محجوبة، قناة خاصة، محتوى سليم.
async function assertPublishable(db, post) {
  const job = await getJob(db, post.job_id);
  if (job.status !== "open") throw new HttpError(409, "job_closed");
  if (!post.establishment_id) throw bad("establishment_required");
  await getEstablishment(db, post.establishment_id);
  const warnings = await assertEstablishmentOpen(db, post.establishment_id, await getSettings(db));
  await assertChannel(db, post.channel);
  await assertContent(db, fieldsOf(post), { min: post.salary_min, max: post.salary_max });
  return warnings;
}
async function move(db, user, post, to, patch, note) {
  await db.patch(`shr_job_posts?id=eq.${post.id}&status=eq.${post.status}`, { status: to, updated_at: nowIso(), ...patch });
  await writeEvent(db, user, post, to, note);
  await audit(db, user, `post.status.${post.status}->${to}`, "shr_job_posts", post.id);
}
const illegal = (from, to) => new HttpError(409, "bad_transition", { from, to });

// ----------------------------------------------------------------- list ----
export async function listPosts(db, user, q) {
  const st = q.status ? String(q.status) : "";
  if (st && !STATUSES.includes(st)) throw bad("bad_status");
  const [posts, jobs, ests, snaps, apps, events, users, chans] = await Promise.all([
    db.get(`shr_job_posts?select=*${st ? `&status=eq.${st}` : ""}&order=created_at.desc`),
    db.get("shr_jobs?select=id,title,status"),
    db.get("shr_establishments?select=id,name_ar,restriction_state"),
    db.get("shr_establishment_compliance?select=*"),
    db.get("shr_applications?select=id,post_id,stage,archived_at"),
    db.get("shr_job_post_events?select=post_id,from_status,to_status,actor,note,at&order=at.asc"),
    db.get("shr_users?select=id,full_name"),
    db.get("shr_post_channels?select=channel,channel_enabled"),
  ]);
  const J = Object.fromEntries(jobs.map((j) => [j.id, j])), E = Object.fromEntries(ests.map((e) => [e.id, e]));
  const U = Object.fromEntries(users.map((u) => [u.id, u.full_name]));
  const eff = {};
  for (const e of ests) eff[e.id] = effectiveState(snaps.filter((s) => s.establishment_id === e.id), e.restriction_state);
  const channels = [{ channel: "shr_private", enabled: true }].concat(["public_bp_jobs", "external"].map((c) => ({ channel: c, enabled: !!(chans.find((x) => x.channel === c) || {}).channel_enabled })));
  return {
    statuses: STATUSES, channels,
    posts: posts.map((p) => {
      const mine = apps.filter((a) => a.post_id === p.id && !a.archived_at);
      const ef = p.establishment_id ? eff[p.establishment_id] : null;
      const blocked = ef && BLOCKING.has(ef.state) && p.status !== "closed" ? { state: ef.state, reason: ef.reason || null } : null;
      // قائمة بيضاء: لا client_company_id ولا اسم عميل ولا بيانات تواصل في أي ردّ عن الإعلان.
      return {
        id: p.id, job: { id: p.job_id, title: (J[p.job_id] || {}).title || null, status: (J[p.job_id] || {}).status || null },
        title: p.title, description: p.description, requirements: p.requirements, city: p.city, headcount: p.headcount, language: p.language,
        salary_min: p.salary_min ?? null, salary_max: p.salary_max ?? null, status: p.status, channel: p.channel,
        establishment: p.establishment_id ? { id: p.establishment_id, name_ar: (E[p.establishment_id] || {}).name_ar || null } : null, blocked,
        applicants: mine.length, created_by_name: U[p.created_by] || null, approved_by_name: p.approved_by ? U[p.approved_by] || null : null,
        mine: p.created_by === user.sub, created_at: p.created_at, published_at: p.published_at || null, closed_at: p.closed_at || null, demo: p.demo !== false,
        history: events.filter((e) => e.post_id === p.id).map((e) => ({ from: e.from_status, to: e.to_status, by: U[e.actor] || null, note: e.note, at: e.at })),
      };
    }),
  };
}

// --------------------------------------------------------------- create ----
export async function createPost(db, user, b) {
  const job = await getJob(db, b.job_id);
  if (job.status !== "open") throw new HttpError(409, "job_closed");
  const channel = await assertChannel(db, b.channel);
  let establishment_id = null;
  if (b.establishment_id) establishment_id = (await getEstablishment(db, b.establishment_id)).id;
  const f = readInput(b, {});
  const title = f.title !== undefined ? f.title : "";
  if (title.length < 2) throw bad("title_required");
  const row = {
    job_id: job.id, establishment_id, title, description: f.description ?? null, requirements: f.requirements ?? null,
    city: f.city !== undefined ? f.city : (job.city || null), headcount: job.headcount,        // العدد من الوظيفة لا من الطلب
    language: f.language || "ar", salary_min: f.salary_min ?? null, salary_max: f.salary_max ?? null,
    salary_entered_by: (f.salary_min ?? null) !== null || (f.salary_max ?? null) !== null ? user.sub : null,
    status: "draft", channel, created_by: user.sub, submitted_by: null, submitted_at: null, approved_by: null, approved_at: null,
    published_by: null, published_at: null, closed_by: null, closed_at: null, close_reason: null, demo: true, updated_at: null,
  };
  await assertContent(db, fieldsOf(row), { min: row.salary_min, max: row.salary_max });
  const p = (await db.post("shr_job_posts", row))[0];
  await writeEvent(db, user, { id: p.id, status: null }, "draft", "إنشاء مسودة");
  await audit(db, user, "post.create", "shr_job_posts", p.id);
  return { id: p.id, status: "draft", title: p.title };
}

export async function updatePost(db, user, b) {
  const p = await getPost(db, b.id);
  if (p.status !== "draft") throw new HttpError(409, "not_draft");
  if (b.job_id !== undefined && b.job_id !== p.job_id) throw bad("job_not_editable");
  const patch = readInput(b, p);
  if (b.channel !== undefined) patch.channel = await assertChannel(db, b.channel);
  if (b.establishment_id !== undefined) patch.establishment_id = b.establishment_id ? (await getEstablishment(db, b.establishment_id)).id : null;
  if (patch.title !== undefined && patch.title.length < 2) throw bad("title_required");
  if (patch.salary_min !== undefined || patch.salary_max !== undefined) {
    const lo = patch.salary_min !== undefined ? patch.salary_min : p.salary_min, hi = patch.salary_max !== undefined ? patch.salary_max : p.salary_max;
    patch.salary_entered_by = (lo ?? null) !== null || (hi ?? null) !== null ? user.sub : null;
  }
  const merged = { ...p, ...patch };
  await assertContent(db, fieldsOf(merged), { min: merged.salary_min, max: merged.salary_max });
  if (!Object.keys(patch).length) throw bad("nothing_to_update");
  await db.patch(`shr_job_posts?id=eq.${p.id}&status=eq.draft`, { ...patch, updated_at: nowIso() });
  await audit(db, user, "post.update", "shr_job_posts", p.id);
  return { id: p.id, status: "draft" };
}

// ------------------------------------------------------------ lifecycle ----
export async function submitPost(db, user, b) {
  const p = await getPost(db, b.id);
  if (p.status !== "draft") throw illegal(p.status, "pending_approval");
  const warnings = await assertPublishable(db, p);
  await move(db, user, p, "pending_approval", { submitted_by: user.sub, submitted_at: nowIso() }, b.note);
  return { id: p.id, status: "pending_approval", warnings };
}

export async function approvePost(db, user, b) {
  if (!APPROVER_ROLES.has(user.role)) throw new HttpError(403, "role_not_allowed");
  const p = await getPost(db, b.id);
  if (p.status !== "pending_approval") throw illegal(p.status, "approved");
  // من يكتب لا يعتمد.
  if (p.created_by && p.created_by === user.sub) throw new HttpError(403, "maker_checker");
  const warnings = await assertPublishable(db, p);
  await move(db, user, p, "approved", { approved_by: user.sub, approved_at: nowIso() }, b.note);
  return { id: p.id, status: "approved", warnings };
}

export async function publishPost(db, user, b) {
  if (!APPROVER_ROLES.has(user.role)) throw new HttpError(403, "role_not_allowed");
  const p = await getPost(db, b.id);
  if (p.status !== "approved") throw illegal(p.status, "published");
  const warnings = await assertPublishable(db, p);
  await move(db, user, p, "published", { published_by: user.sub, published_at: nowIso() }, b.note);
  // published = ظاهر داخل صفحة SHR الخاصة فقط؛ لا شيء يُرسل أو يُنشر خارجها.
  return { id: p.id, status: "published", visibility: "shr_private_only", warnings };
}

export async function closePost(db, user, b) {
  const p = await getPost(db, b.id);
  if (p.status === "closed") return { id: p.id, status: "closed" };
  await move(db, user, p, "closed", { closed_by: user.sub, closed_at: nowIso(), close_reason: str(b.reason, 200) || null }, b.reason);
  return { id: p.id, status: "closed" };
}

// ------------------------------------------------------------ applicants ----
// لا صفحة تقديم عامة: المشغّل يضيف طلب التقديم يدوياً، لمرشح موافقته سارية (409 no_consent).
export async function addApplicant(db, user, b) {
  const p = await getPost(db, b.post_id);
  if (p.status !== "published") throw new HttpError(409, "post_not_published");
  if (p.establishment_id) await assertEstablishmentOpen(db, p.establishment_id, await getSettings(db));
  const a = await ats.createApplication(db, user, { job_id: p.job_id, candidate_id: b.candidate_id, note: b.note }, { post_id: p.id });
  await audit(db, user, "post.applicant_add", "shr_job_posts", p.id);
  return { post_id: p.id, application: a };
}

// --------------------------------------------------------------- suggest ----
// مقترح صياغة من قالب قاعدي محلي: لا ذكاء اصطناعي ولا شبكة. يملأ العنوان والفقرات من بيانات
// الوظيفة ويعدّله الإنسان. لا يقرر شيئاً ولا يضع راتباً ولا يذكر تفضيل الجنسية.
const KEY_AR = { profession: "المهنة المطلوبة", residency: "إقامة قابلة لنقل الخدمات", experience: "الخبرة المطلوبة", location: "الموقع", availability: "التوفر للمباشرة", skills: "المهارات المطلوبة" };
const KEY_EN = { profession: "Required profession", residency: "Transferable residency", experience: "Required experience", location: "Location", availability: "Availability to start", skills: "Required skills" };
export async function suggestPost(db, b) {
  const job = await getJob(db, b.job_id);
  if (job.status !== "open") throw new HttpError(409, "job_closed");
  const language = b.language === undefined ? "ar" : String(b.language);
  if (!LANGS.includes(language)) throw bad("bad_language");
  const ar = language === "ar";
  const role = job.profession || job.title, city = job.city || null;
  const title = ar ? `مطلوب ${role}${city ? " في " + city : ""}` : `${role}${city ? " — " + city : ""} wanted`;
  const desc = [];
  desc.push(ar ? `نبحث عن ${role}${city ? " للعمل في " + city : ""}. عدد المطلوبين: ${job.headcount}.` : `We are looking for a ${role}${city ? " to work in " + city : ""}. Positions: ${job.headcount}.`);
  desc.push(ar ? "تفاصيل العمل تُحدَّد عند المقابلة. يراجع الفريق هذا النص قبل الإرسال للاعتماد." : "Work details are set at the interview. The team reviews this text before submitting for approval.");
  // أسطر المتطلبات: ما يأتي من نص حرّ في الوظيفة (مهارات/شروط) يمرّ بالحرس سطراً سطراً ويُحذف ما يُرفض.
  const free = [], fixed = [];
  if (job.experience_years !== null && job.experience_years !== undefined) fixed.push(ar ? `خبرة لا تقل عن ${job.experience_years} سنوات` : `At least ${job.experience_years} years of experience`);
  if (job.residency_required === "transferable") fixed.push(ar ? "إقامة قابلة لنقل الخدمات" : "Transferable residency");
  for (const s of Array.isArray(job.skills) ? job.skills : []) free.push(ar ? `مهارة: ${s}` : `Skill: ${s}`);
  for (const m of Array.isArray(job.must_have) ? job.must_have : []) {
    if (m === "nationality") continue;                                   // لا يُدرَج تفضيل الجنسية في نص الإعلان
    const k = (ar ? KEY_AR : KEY_EN)[m];
    if (k) fixed.push((ar ? "شرط أساسي: " : "Must have: ") + k); else free.push((ar ? "شرط أساسي: " : "Must have: ") + m);
  }
  const omitted = [];
  const clients = (await db.get("shr_client_companies?select=name_ar")).map((c) => c.name_ar);
  const keep = free.filter((line) => { const r = guardText({ line }, {}, clients); if (r.length) { omitted.push({ line, codes: r.map((x) => x.code) }); return false; } return true; });
  const requirements = fixed.concat(keep).map((l) => "• " + l).join("\n") || null;
  return {
    source: "local_template", ai: false, language,
    suggestion: { title, description: desc.join("\n"), requirements, city, headcount: job.headcount, language },
    omitted,
    notes: ["صياغة مقترحة من قالب محلي بلا ذكاء اصطناعي: عدّلها قبل الحفظ.", "لا راتب فيها: نطاق الراتب يدخله موظف عند الحاجة فقط.", "لا يُذكر تفضيل الجنسية ولا اسم العميل في الإعلان."],
  };
}

export async function dispatchPost(action, { db, user, b, q }) {
  switch (action) {
    case "posts": return await listPosts(db, user, q);
    case "post-create": return { post: await createPost(db, user, b) };
    case "post-update": return { post: await updatePost(db, user, b) };
    case "post-submit": return { post: await submitPost(db, user, b) };
    case "post-approve": return { post: await approvePost(db, user, b) };
    case "post-publish": return { post: await publishPost(db, user, b) };
    case "post-close": return { post: await closePost(db, user, b) };
    case "post-suggest": return await suggestPost(db, b);
    case "post-applicant-add": return await addApplicant(db, user, b);
  }
  throw new HttpError(404, "unknown_action");
}
