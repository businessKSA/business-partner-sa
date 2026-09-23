// الألماس الأزرق العقارية — المستشار العقاري الذكي ومنظومة الطلب/العرض.
//
// العميل: بندر الأحمد، مستشار ومحلل عقاري مرخّص من الهيئة العامة للعقار،
// شركة الألماس الأزرق العقارية (سجل تجاري 1009029650).
//
// المشكلة التي يحلّها هذا الملف، بكلمات المالك: «شغله أغلبه في الواتساب».
// الطلبات تصل واتساب، والعروض تصل واتساب، والربط بينهما يجري في رأس بندر
// وحده. ما يحدث أنّ عرضاً يصل اليوم كان يطابق طلباً وصل قبل ثلاثة أسابيع،
// ولا أحد يتذكره — فتضيع الصفقة لا لأن العرض لم يوجد، بل لأن أحداً لم
// يربط. هذا الملف هو الرابط: كل رسالة واردة تُقرأ، وتُصنَّف طلباً أو عرضاً،
// وتُطابَق في الاتجاهين فوراً.
//
// المسار كاملاً (docs/blue-diamond-realestate.md فيه الرسم):
//
//   رسالة واتساب ──▶ تصنيف ──┬── طلب  ─▶ استكمال ناقصه بسؤال واحد
//                            │            └─▶ مطابقة على العروض المخزّنة
//                            │                 ├─ وُجد: بطاقات للعميل
//                            │                 └─ لم يوجد: «طلب سوق» للشبكة
//                            ├── عرض  ─▶ حفظ ─▶ مطابقة عكسية على الطلبات
//                            │                   المفتوحة ─▶ تنبيه بندر
//                            └── دراسة ─▶ فتح ملف تحليل/جدوى/تقييم
//
// ثلاثة مبادئ حكمت التنفيذ:
//
// ١) لا شيء يسقط لأن مزوّداً سقط. الاستخراج الحتمي في api/_rematch.js يعمل
//    بلا مفتاح API، والنموذج — حين يوجد مفتاح — يملأ ما فات القواعد فقط.
//    مكتب عقاري لا يتوقف لأن رصيد واجهة برمجية نفد.
//
// ٢) لا رسالة تُعالَج مرتين. ميتا تعيد إرسال الحدث نفسه عند أي تأخّر، ومعالجة
//    عرض مرتين تعني عرضين متطابقين في القاعدة ومطابقتين تُرسلان للعميل.
//    wa_message_id مفتاح فريد في re_messages، وهو الحارس.
//
// ٣) بندر يبقى في الحلقة. المستشار يقرأ ويرتّب ويقترح؛ الإرسال للعميل قرار
//    بشري من اللوحة (إلا ما أذن به صراحة). وسيطٌ مرخّص مسؤول نظاماً عمّا
//    يُرسل باسمه، وأتمتة تُرسل عروضاً بلا مراجعة تُعرّض الرخصة لا الوقت.
//
// ملف بادئته «_»: Vercel تحوّل كل ملف آخر في api/ إلى دالة والسقف ١٢، لذلك
// يُنادى عبر /api/realestate المُعاد كتابته إلى /api/requests?__route=realestate.

import crypto from "node:crypto";
import { sb, DB_ON, audit } from "./_db.js";
import { waSend, waNumber } from "./_stage.js";
import { DEV, WHATSAPP_LIVE, outbox } from "./_mode.js";
import {
  classifyMessage, parseRequestText, parseListingText, propertyTypeLabel,
  requestCompleteness, nextQuestion, rankListings, rankRequests, scoreMatch,
  listingCard, broadcastText, PROPERTY_TYPES, CITIES, normalizeAr,
  CHANNELS, SOCIAL_CHANNELS, channelLabel, CHAIN_ROLES, chainRoleLabel,
  parseChatExport, splitBlocks, detectChainHint, extractPhones, buildChain,
  dedupKey, findDuplicates,
} from "./_rematch.js";

const env = (k, d = "") => String(process.env[k] || d).trim();

// المكتب. قابل للتهيئة لأن المنظومة نفسها تصلح لأي وسيط مرخّص — والقيم
// الافتراضية من الملف التعريفي للعميل لا من الخيال.
export const OFFICE = {
  nameAr: env("BD_OFFICE_AR", "شركة الألماس الأزرق العقارية"),
  nameEn: env("BD_OFFICE_EN", "Blue Diamond Real Estate"),
  cr: env("BD_CR", "1009029650"),
  phone: env("BD_PHONE", "+966505556150"),
  email: env("BD_EMAIL", "info@bluediamond.sa"),
  site: env("BD_SITE", "https://www.bluediamond.sa"),
  city: env("BD_CITY", "الرياض"),
  ceo: env("BD_CEO", "بندر الأحمد"),
  ceoTitle: env("BD_CEO_TITLE", "مستشار ومحلل عقاري مُرخّص من الهيئة العامة للعقار"),
};

// رقم واتساب بندر — إليه تذهب كل التنبيهات. بدونه تعمل المنظومة وتُسجّل،
// لكن لا أحد يُنبَّه، واللوحة وحدها تُظهر الجديد.
const OWNER_WA = env("BD_OWNER_WA", env("BD_PHONE", ""));
const VERIFY_TOKEN = env("BD_WA_VERIFY_TOKEN", "");
const OPS_KEY = env("BD_OPS_KEY", env("PANEL_KEY", ""));
// إرسال المطابقات للعميل تلقائياً — مطفأ افتراضياً (المبدأ ٣ أعلاه).
const AUTO_SEND = env("BD_AUTO_SEND", "") === "1";
const MATCH_MIN = Number(env("BD_MATCH_MIN", "45")) || 45;

const ANTHROPIC_KEY = env("ANTHROPIC_API_KEY");
const BD_MODEL = env("BD_MODEL", "claude-haiku-4-5-20251001");

const json = (res, code, body) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.statusCode = code;
  return res.end(JSON.stringify(body));
};
const bodyOf = (req) => {
  if (req && req.body && typeof req.body === "object") return req.body;
  if (req && typeof req.body === "string") { try { return JSON.parse(req.body); } catch {} }
  return {};
};
const opsOk = (src) => !!OPS_KEY && String((src && (src.key || src.opsKey)) || "").trim() === OPS_KEY;
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const nowIso = () => new Date().toISOString();

// العدد بالعربية يوافق معدوده: واحد، مثنّى، جمع قلّة (٣–١٠)، ثم تمييز
// منصوب. «لدينا 1 عرضاً» جملةٌ تكشف أن الذي كتبها آلة، ورسائل وسيط مرخّص
// تُقرأ على أنها منه هو.
function countAr(n, one, two, few, many) {
  const c = Number(n) || 0;
  if (c === 1) return one;
  if (c === 2) return two;
  if (c >= 3 && c <= 10) return `${c} ${few}`;
  return `${c} ${many}`;
}
// المثنّى يختلف بموقعه من الجملة: «لدينا عرضان» مرفوع، و«يطابق طلبين»
// منصوب. لكل دالة صيغتها لأن لكل واحدة موقعاً واحداً في نصّها — ومن
// غيّر النصّ لاحقاً فليراجع الصيغة معه.
const offersAr = (n) => countAr(n, "عرض واحد", "عرضان", "عروض", "عرضاً");     // مرفوع: «لدينا …»
const requestsAr = (n) => countAr(n, "طلباً واحداً", "طلبين", "طلبات", "طلباً"); // منصوب: «يطابق …»

// ------------------------------------------------- مراحل الصفقة والدراسة --
// المفاتيح إنجليزية لأنها تُخزَّن وتُقيَّد بـcheck في db/schema.sql، والعربية
// للعرض. تُصدَّر مع «status» فتقرأها اللوحة من هنا بدل أن تكرّرها عندها —
// قائمتان تنحرفان عن بعضهما تعنيان لوحةً تعرض مرحلةً لا تقبلها القاعدة.
export const DEAL_STAGES = {
  OFFER:       "عرض مقدَّم",
  NEGOTIATION: "تفاوض",
  AGREED:      "اتفاق مبدئي",
  DEPOSIT:     "عربون",
  CONTRACT:    "عقد",
  EJAR:        "توثيق إيجار",
  TRANSFERRED: "إفراغ",
  CLOSED:      "مُقفلة",
  LOST:        "خسرت",
};
export const STUDY_KINDS = {
  ANALYSIS:              "تحليل عقاري",
  FEASIBILITY:           "دراسة جدوى",
  VALUATION:             "تقييم",
  FINANCIAL_STRUCTURING: "هندسة مالية",
  STRATEGY:              "استشارة استراتيجية",
  MARKET_STUDY:          "دراسة سوق",
};
export const STUDY_STATUSES = {
  NEW:         "جديدة",
  SCOPED:      "حُدِّد النطاق",
  QUOTED:      "عرض أتعاب",
  APPROVED:    "معتمدة",
  IN_PROGRESS: "تحت التنفيذ",
  DELIVERED:   "مُسلَّمة",
  CANCELLED:   "ملغاة",
};
// المرحلتان اللتان تُنهيان الصفقة، ولكلٍّ أثرها على الطلب والعرض.
const DEAL_DONE = new Set(["CLOSED", "LOST"]);
// نسبة العمولة الافتراضية تأتي من البيئة لا من الشيفرة: النسبة تفاوضية
// وتختلف بالصفقة، ورقمٌ مكتوبٌ هنا يصير «سعراً» لم يقرّه أحد.
const DEFAULT_COMMISSION = num(env("BD_COMMISSION_PCT", ""));

// ---------------------------------------------------------- أرقام مرجعية --
// الشكل BD-T-000123. الحرف يقول ماذا تقرأ قبل أن تفتح الصفّ، وهذا وحده
// يختصر نصف أسئلة الواتساب: «إيش رقم BD-A-000456؟» جوابها في الحرف.
const SERIES = { request: "T", listing: "A", broadcast: "S", deal: "D", study: "C", intake: "W" };
async function nextRef(kind) {
  const letter = SERIES[kind] || "X";
  const table = { request: "re_requests", listing: "re_listings", broadcast: "re_broadcasts", deal: "re_deals", study: "re_studies", intake: "re_intake" }[kind];
  let n = 1;
  if (DB_ON && table) {
    try {
      // الترتيب بالمرجع لا بوقت الإنشاء. صفّان يُدرجان في الملّي ثانية
      // نفسها — وهذا ما يجري في إدخال الأرشيف دفعةً — يتساوى وقتهما،
      // فيعيد ترتيبُ الوقت الأقدمَ منهما، فيتكرّر المرجع. محلياً مرّ
      // التكرار بصمت؛ وفي الإنتاج `ref` فريدٌ فيسقط الإدراج وتتوقف
      // الدفعة في منتصفها. والمرجع مصفوف بأصفار، فترتيبه النصّي هو
      // ترتيبه العددي.
      const rows = await sb(`${table}?select=ref&order=ref.desc&limit=1`);
      const last = rows && rows[0] && rows[0].ref;
      const m = last && String(last).match(/(\d+)$/);
      if (m) n = Number(m[1]) + 1;
    } catch {}
  }
  return `BD-${letter}-${String(n).padStart(6, "0")}`;
}

// -------------------------------------------------------- جهات الاتصال --
/**
 * إيجاد جهة الاتصال بالرقم أو إنشاؤها، وإضافة دور جديد إن لزم.
 * الرقم هو المفتاح لا الاسم: في هذا السوق يُعرف الناس بأرقامهم، والاسم
 * يصل ناقصاً أو لا يصل.
 */
export async function upsertContact({ phone, name, roles = [], company, city, email }) {
  const wa = waNumber(phone);
  if (!wa || !DB_ON) return null;
  try {
    const found = await sb(`re_contacts?wa_phone=eq.${encodeURIComponent(wa)}&select=*&limit=1`);
    if (found && found.length) {
      const c = found[0];
      const merged = Array.from(new Set([...(c.roles || []), ...roles]));
      const patch = { last_seen_at: nowIso(), updated_at: nowIso() };
      if (merged.length !== (c.roles || []).length) patch.roles = merged;
      // الاسم لا يُستبدل باسم أضعف: من سجّل نفسه «أبو محمد» في رسالة ثم
      // «محمد العتيبي — عقارات» في أخرى، الثاني أنفع، والعكس ليس صحيحاً.
      if (name && (!c.name || String(name).length > String(c.name).length)) patch.name = name;
      if (company && !c.company) patch.company = company;
      if (city && !c.city) patch.city = city;
      if (email && !c.email) patch.email = email;
      const upd = await sb(`re_contacts?id=eq.${c.id}`, { method: "PATCH", body: patch });
      return (upd && upd[0]) || { ...c, ...patch };
    }
    const ins = await sb("re_contacts", { method: "POST", body: [{
      wa_phone: wa, name: name || null, company: company || null, city: city || null,
      email: email || null, roles, last_seen_at: nowIso(),
      // صريحة للسبب نفسه: blocked=eq.false هو مرشّح جمهور طلب السوق.
      blocked: false, offers_count: 0, matched_count: 0, deals_count: 0,
    }] });
    return (ins && ins[0]) || null;
  } catch (e) { console.error("re contact", e.message); return null; }
}

// ------------------------------------------------------ استكمال بالنموذج --
// القواعد تقرأ الشائع؛ النموذج يقرأ ما شذّ. يُستدعى بحقول ما زالت فارغة
// فقط، ولا يُسمح له بتغيير ما استخرجته القواعد — القواعد مُختبَرة، وناتج
// النموذج ليس كذلك. وإن غاب المفتاح أو فشل النداء، يمضي كل شيء كما هو.
async function aiFill(text, partial, kind) {
  if (!ANTHROPIC_KEY) return partial;
  const missing = Object.entries(partial).filter(([, v]) => v === null || v === undefined || (Array.isArray(v) && !v.length)).map(([k]) => k);
  if (!missing.length) return partial;
  const schema = kind === "listing"
    ? "property_type, city, district, area (م²), price (ريال), annual_income, yield_pct, income_producing (true/false/null), deed_type, offer_kind (SALE|RENT|INVESTMENT)"
    : "property_type, city, districts (مصفوفة), area_min, area_max, budget_min, budget_max, income_producing, target_yield, deed_type, purpose (BUY|RENT|INVEST|DEVELOP), timeline, financing";
  const types = Object.keys(PROPERTY_TYPES).join(" | ");
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: BD_MODEL,
        max_tokens: 700,
        system: `أنت قارئ رسائل سوق عقاري سعودي. تُخرج JSON فقط بلا أي نص آخر.
الحقول: ${schema}
قيم property_type المسموحة: ${types}
لا تخترع قيمة لم ترد في النص — الحقل الذي لا دليل عليه اتركه null.
المبالغ بالريال رقماً صحيحاً (٨ مليون = 8000000)، والمساحات بالمتر المربع.`,
        messages: [{ role: "user", content: `اقرأ هذه الرسالة وأخرج الحقول الناقصة فقط: ${missing.join(", ")}\n\nالرسالة:\n${String(text).slice(0, 2000)}` }],
      }),
    });
    if (!r.ok) return partial;
    const d = await r.json();
    const raw = ((d.content || []).find((c) => c.type === "text") || {}).text || "";
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return partial;
    const got = JSON.parse(m[0]);
    const out = { ...partial };
    for (const k of missing) {
      if (got[k] === undefined || got[k] === null || got[k] === "") continue;
      if (k === "property_type" && !PROPERTY_TYPES[got[k]]) continue;
      out[k] = got[k];
    }
    return out;
  } catch (e) { console.error("re aiFill", e.message); return partial; }
}

// --------------------------------------------------------------- الإرسال --
// كل خروج من المنظومة يمر هنا: محلياً يُكتب في صندوق الصادر ولا يغادر
// الجهاز (api/_mode.js)، وفي الإنتاج يذهب عبر واجهة ميتا.
async function send(phone, text, meta = {}) {
  const to = waNumber(phone);
  if (!to) return { ok: false, error: "no_phone" };
  if (!WHATSAPP_LIVE) {
    await outbox({ kind: "whatsapp", to, body: String(text).slice(0, 500), ...meta });
    return { ok: true, mode: "mock" };
  }
  const r = await waSend(to, text);
  return r;
}

async function logMessage(row) {
  if (!DB_ON) return null;
  try {
    const ins = await sb("re_messages", { method: "POST", body: [row] });
    return (ins && ins[0]) || null;
  } catch (e) {
    // المفتاح الفريد على wa_message_id يرفض التكرار — وهذا نجاحٌ لا فشل.
    if (String(e.message).includes("db_failed")) return null;
    return null;
  }
}

async function alertOwner(text) {
  if (!OWNER_WA) return { ok: false, error: "owner_not_configured" };
  return send(OWNER_WA, text, { subject: "تنبيه الألماس الأزرق" });
}

// --------------------------------------------------------- حفظ ومطابقة --
async function saveRequest(fields, { contact, source = "WHATSAPP", sourceDetail = null, receivedAt = null, enteredBy = null, intakeRef = null, chain = null, backlog = false }) {
  const { completeness } = requestCompleteness(fields);
  const ref = await nextRef("request");
  const built = chain ? buildChain(chain) : null;
  const row = {
    ref,
    contact_id: contact ? contact.id : null,
    source,
    source_detail: sourceDetail || null,
    // وقت الوصول الفعلي لا وقت الإدخال: أرشيفُ سنةٍ يُدخل اليوم يحمل
    // تواريخه هو، وإلا بدا كل طلب قديم طازجاً وضاع ترتيب الأقدمية.
    received_at: receivedAt || nowIso(),
    entered_by: enteredBy || null,
    intake_ref: intakeRef || null,
    dedup_key: dedupKey(fields),
    chain_len: built ? built.length : 0,
    principal_known: built ? built.principal_known : true,
    backlog: !!backlog,
    purpose: fields.purpose || "BUY",
    property_type: fields.property_type || null,
    city: fields.city || null,
    districts: fields.districts || [],
    area_min: num(fields.area_min), area_max: num(fields.area_max),
    budget_min: num(fields.budget_min), budget_max: num(fields.budget_max),
    income_producing: typeof fields.income_producing === "boolean" ? fields.income_producing : null,
    target_yield: num(fields.target_yield),
    deed_type: fields.deed_type || null,
    timeline: fields.timeline || null,
    financing: fields.financing || null,
    notes: fields.notes || null,
    raw_text: fields.raw_text || null,
    completeness,
    status: "OPEN",
    priority: "normal",
  };
  if (!DB_ON) return { ...row, id: crypto.randomUUID() };
  const ins = await sb("re_requests", { method: "POST", body: [row] });
  return (ins && ins[0]) || row;
}

async function saveListing(fields, { contact, source = "WHATSAPP", sourceDetail = null, receivedAt = null, enteredBy = null, intakeRef = null, chain = null, backlog = false }) {
  const ref = await nextRef("listing");
  const built = chain ? buildChain(chain) : null;
  const row = {
    ref,
    contact_id: contact ? contact.id : null,
    source,
    source_detail: sourceDetail || null,
    received_at: receivedAt || nowIso(),
    entered_by: enteredBy || null,
    intake_ref: intakeRef || null,
    chain_len: built ? built.length : 0,
    backlog: !!backlog,
    offer_kind: fields.offer_kind || "SALE",
    property_type: fields.property_type || null,
    city: fields.city || null,
    district: fields.district || null,
    area: num(fields.area),
    price: num(fields.price),
    price_per_m: num(fields.price_per_m),
    annual_income: num(fields.annual_income),
    yield_pct: num(fields.yield_pct),
    income_producing: typeof fields.income_producing === "boolean" ? fields.income_producing : null,
    deed_no: fields.deed_no || null,
    deed_type: fields.deed_type || null,
    location_url: fields.location_url || null,
    exclusive: !!fields.exclusive,
    // القيم الافتراضية تُكتب صريحةً ولا تُترك لـ default في SQL: محاكي
    // القاعدة المحلي لا يطبّق الافتراضيات، فصفٌّ بلا available يسقط من
    // مرشّح available=eq.true على الجهاز ويمرّ في الإنتاج.
    available: true,
    raw_text: fields.raw_text || null,
    // عرضٌ وصل من رسالة لم يُعاينه أحد بعد. الحالة تقول ذلك صراحةً بدل أن
    // يُقدَّم للعميل كأنه موثّق — والتوثيق خطوة بشرية من اللوحة.
    status: source === "WHATSAPP" ? "UNVERIFIED" : "ACTIVE",
  };
  if (!DB_ON) return { ...row, id: crypto.randomUUID() };
  const ins = await sb("re_listings", { method: "POST", body: [row] });
  const saved = (ins && ins[0]) || row;
  if (contact && DB_ON) {
    try {
      await sb(`re_contacts?id=eq.${contact.id}`, { method: "PATCH", body: { offers_count: (contact.offers_count || 0) + 1, updated_at: nowIso() } });
    } catch {}
  }
  return saved;
}

/** العروض المرشّحة لطلب: تُقرأ بمرشّح خشن من القاعدة ثم تُدرَّج في الذاكرة. */
async function candidateListings(request) {
  if (!DB_ON) return [];
  // eq.true لا is.true: الأخيرة تعني في محاكي القاعدة المحلي «ليس null»،
  // فتمرّ بها العروض المسحوبة. صيغة واحدة تصحّ على الاثنين أفضل من صيغة
  // تصحّ في الإنتاج وتكذب محلياً.
  const q = ["status=in.(ACTIVE,UNVERIFIED)", "available=eq.true", "select=*", "limit=400", "order=created_at.desc"];
  if (request.city) q.unshift(`city=eq.${encodeURIComponent(request.city)}`);
  try { return await sb(`re_listings?${q.join("&")}`); } catch { return []; }
}

async function candidateRequests(listing) {
  if (!DB_ON) return [];
  const q = ["status=in.(OPEN,SEARCHING,MATCHED,VIEWING)", "select=*", "limit=400", "order=created_at.desc"];
  if (listing.city) q.unshift(`city=eq.${encodeURIComponent(listing.city)}`);
  try { return await sb(`re_requests?${q.join("&")}`); } catch { return []; }
}

/** تخزين المطابقات. التكرار يُتجاهل: نفس الزوج لا يُسجَّل مرتين. */
async function persistMatches(requestId, ranked) {
  if (!DB_ON || !ranked.length) return [];
  const rows = ranked.map((m) => ({
    request_id: requestId,
    listing_id: m.listing.id,
    score: m.score,
    reasons: m.reasons,
    gaps: m.gaps,
    status: "NEW",
  }));
  try {
    return await sb("re_matches?on_conflict=request_id,listing_id", {
      method: "POST", prefer: "resolution=ignore-duplicates,return=representation", body: rows,
    }) || [];
  } catch { return []; }
}

/**
 * مطابقة طلب على المخزون، وتخزين النتيجة، وتحديث حالة الطلب.
 * تُستدعى عند وصول الطلب وعند كل تحديث له ومن اللوحة يدوياً.
 */
export async function matchRequest(request) {
  const listings = await candidateListings(request);
  const ranked = rankListings(request, listings, { min: MATCH_MIN, limit: 10 });
  if (request.id && DB_ON) {
    await persistMatches(request.id, ranked);
    try {
      await sb(`re_requests?id=eq.${request.id}`, {
        method: "PATCH",
        body: { status: ranked.length ? "MATCHED" : "SEARCHING", updated_at: nowIso() },
      });
    } catch {}
  }
  return ranked;
}

/** الاتجاه المعاكس: عرضٌ وصل الآن — أي طلبٍ مفتوح كان ينتظره؟ */
export async function matchListing(listing) {
  const requests = await candidateRequests(listing);
  const hits = rankRequests(listing, requests, { min: MATCH_MIN, limit: 10 });
  if (DB_ON && listing.id) {
    for (const h of hits) await persistMatches(h.request.id, [{ listing, score: h.score, reasons: h.reasons, gaps: h.gaps }]);
  }
  return hits;
}

// -------------------------------------------------------- طلب السوق --
/**
 * إخراج الطلب إلى الشبكة: رسالة واحدة موحّدة إلى المسوّقين والمطوّرين
 * المناسبين. هذا هو «كيف يبحث عن عروض في السوق» — نداءٌ موجَّه لا بحثٌ
 * عشوائي، وجوابه يعود عرضاً يدخل القاعدة ويُطابَق بالطلب نفسه تلقائياً.
 */
export async function broadcastRequest(request, { limit = 40, actor = "ops" } = {}) {
  const text = broadcastText(request, OFFICE.nameAr);
  let audience = [];
  if (DB_ON) {
    // الشريحة: من في شبكته دورُ تسويق أو تطوير، ولم يُحظر، ويفضَّل من
    // يعمل في مدينة الطلب — والترتيب بمن سبق أن أرسل عرضاً طابق فعلاً.
    try {
      // الأدوار تُرشَّح في الذاكرة لا بـ roles=ov.{...}: معامل تقاطع المصفوفات
      // لا يفهمه محاكي القاعدة المحلي فيرمي، فينتهي الطرح على السوق صامتاً
      // على الجهاز ويعمل في الإنتاج — وهذا أسوأ أنواع الاختلاف.
      const rows = await sb(
        `re_contacts?blocked=eq.false` +
        `&select=id,name,wa_phone,city,roles,matched_count&order=matched_count.desc&limit=500`,
      );
      const WANTED = new Set(["MARKETER", "DEVELOPER", "BROKER", "OWNER"]);
      const city = request.city ? normalizeAr(request.city) : "";
      audience = (rows || [])
        .filter((c) => c.wa_phone && (c.roles || []).some((r) => WANTED.has(r)))
        .sort((a, b) => {
          const ac = city && normalizeAr(a.city || "") === city ? 1 : 0;
          const bc = city && normalizeAr(b.city || "") === city ? 1 : 0;
          return bc - ac || (b.matched_count || 0) - (a.matched_count || 0);
        })
        .slice(0, limit);
    } catch {}
  }
  const results = [];
  for (const c of audience) {
    const r = await send(c.wa_phone, text, { subject: `طلب سوق ${request.ref || ""}` });
    results.push({ contact_id: c.id, phone: c.wa_phone, name: c.name || "", ok: !!r.ok, error: r.ok ? null : r.error || "failed" });
    if (DB_ON) await logMessage({ contact_id: c.id, wa_phone: c.wa_phone, direction: "out", body: text, intent: "BROADCAST", request_id: request.id || null });
  }
  const ref = await nextRef("broadcast");
  const row = {
    ref, request_id: request.id || null, message: text,
    audience: results, sent_count: results.filter((r) => r.ok).length, created_by: actor,
  };
  if (DB_ON) {
    try { await sb("re_broadcasts", { method: "POST", prefer: "return=minimal", body: [row] }); } catch {}
    try { await sb(`re_requests?id=eq.${request.id}`, { method: "PATCH", body: { status: "SEARCHING", updated_at: nowIso() } }); } catch {}
  }
  return row;
}

// ------------------------------------------------------ الصفقة والدراسة --
// نهاية المسار. الصفقة تُفتح من زوج (طلب، عرض) لأن سؤال «من أين جاءت هذه
// الصفقة» جوابه الطلب الذي بدأها لا العرض الذي أغلقها، والعمولة في هذا
// السوق تُحسب على الطرفين أحياناً فيُحفظ الطرفان.

/** العمولة: تُحسب حين يتوفر مبلغ ونسبة، وتبقى null حين ينقص أحدهما. */
function commissionOf(amount, pct) {
  const a = num(amount), p = num(pct);
  if (a == null || p == null) return null;
  return Math.round(a * (p / 100) * 100) / 100;
}

/**
 * فتح صفقة على زوج (طلب، عرض).
 * تنقل الطلب إلى التفاوض وتعلّم المطابقة صفقةً، فلا يبقى الطلب معروضاً
 * على السوق وصفقته جارية.
 */
export async function openDeal({ requestRef, listingRef, amount, commissionPct, notes, actor = "ops" }) {
  const request = await byRef("re_requests", requestRef);
  const listing = await byRef("re_listings", listingRef);
  if (!request || !listing) return { error: "not_found" };

  // صفقة واحدة لكل زوج: فتحها مرتين يعني عمولةً محسوبةً مرتين في اللوحة.
  if (DB_ON) {
    try {
      const dup = await sb(`re_deals?request_id=eq.${request.id}&listing_id=eq.${listing.id}&stage=not.in.(CLOSED,LOST)&select=*&limit=1`);
      if (dup && dup.length) return { error: "already_open", deal: dup[0] };
    } catch {}
  }

  let matchId = null;
  if (DB_ON) {
    try {
      const m = await sb(`re_matches?request_id=eq.${request.id}&listing_id=eq.${listing.id}&select=id&limit=1`);
      matchId = m && m[0] ? m[0].id : null;
    } catch {}
  }

  const amt = num(amount) != null ? num(amount) : num(listing.price);
  const pct = num(commissionPct) != null ? num(commissionPct)
    : num(listing.commission_pct) != null ? num(listing.commission_pct)
    : DEFAULT_COMMISSION;
  const ref = await nextRef("deal");
  const row = {
    ref,
    request_id: request.id, listing_id: listing.id, match_id: matchId,
    buyer_contact_id: request.contact_id || null,
    seller_contact_id: listing.contact_id || null,
    amount: amt, commission_pct: pct, commission_amount: commissionOf(amt, pct),
    stage: "OFFER", notes: notes || null, lost_reason: null, closed_at: null,
  };
  if (!DB_ON) return { deal: { ...row, id: crypto.randomUUID() }, request, listing };

  const ins = await sb("re_deals", { method: "POST", body: [row] });
  const deal = (ins && ins[0]) || row;
  try { await sb(`re_requests?id=eq.${request.id}`, { method: "PATCH", body: { status: "NEGOTIATING", updated_at: nowIso() } }); } catch {}
  if (matchId) { try { await sb(`re_matches?id=eq.${matchId}`, { method: "PATCH", body: { status: "DEAL", updated_at: nowIso() } }); } catch {} }
  await audit({ action: "re.deal.open", entity_type: "re_deals", entity_id: deal.id, details: { ref, request: request.ref, listing: listing.ref, actor } });
  await alertOwner([
    `🤝 *صفقة جديدة* ${ref}`,
    `الطلب ${request.ref} · العرض ${listing.ref}`,
    summarizeListing(listing),
    amt != null ? `القيمة: ${Number(amt).toLocaleString("en-US")} ريال` : "",
    row.commission_amount != null ? `العمولة: ${Number(row.commission_amount).toLocaleString("en-US")} ريال (${pct}%)` : "",
  ].filter(Boolean).join("\n"));
  return { deal, request, listing };
}

/**
 * نقل صفقة بين المراحل، بآثارها لا بتغيير حقل وحده.
 *
 * الإقفال يسحب العرض من السوق ويغلق الطلب ويزيد عدّاد الطرفين؛ والخسارة
 * تُعيد الطلب إلى البحث فيدخل المطابقة من جديد — وهذا هو الفرق بين لوحة
 * تعكس الواقع ولوحة تسجّل حالةً ويبقى ما حولها كاذباً.
 */
export async function moveDealStage({ ref, stage, lostReason, amount, commissionPct, notes, actor = "ops" }) {
  if (!DEAL_STAGES[stage]) return { error: "bad_stage" };
  const deal = await byRef("re_deals", ref);
  if (!deal) return { error: "not_found" };
  if (stage === "LOST" && !String(lostReason || "").trim()) return { error: "lost_reason_required" };

  const amt = num(amount) != null ? num(amount) : num(deal.amount);
  const pct = num(commissionPct) != null ? num(commissionPct) : num(deal.commission_pct);
  const patch = {
    stage,
    amount: amt, commission_pct: pct, commission_amount: commissionOf(amt, pct),
    updated_at: nowIso(),
  };
  if (notes != null) patch.notes = String(notes).slice(0, 2000);
  if (stage === "LOST") patch.lost_reason = String(lostReason).slice(0, 500);
  if (DEAL_DONE.has(stage)) patch.closed_at = nowIso();
  else patch.closed_at = null;   // صفقة أُعيد فتحها لا تحمل تاريخ إقفال

  if (!DB_ON) return { deal: { ...deal, ...patch } };
  const upd = await sb(`re_deals?id=eq.${deal.id}`, { method: "PATCH", body: patch });
  const after = (upd && upd[0]) || { ...deal, ...patch };

  if (stage === "CLOSED") {
    if (deal.listing_id) { try { await sb(`re_listings?id=eq.${deal.listing_id}`, { method: "PATCH", body: { status: "SOLD", available: false, updated_at: nowIso() } }); } catch {} }
    if (deal.request_id) { try { await sb(`re_requests?id=eq.${deal.request_id}`, { method: "PATCH", body: { status: "WON", updated_at: nowIso() } }); } catch {} }
    for (const id of [deal.buyer_contact_id, deal.seller_contact_id].filter(Boolean)) {
      try {
        const c = (await sb(`re_contacts?id=eq.${id}&select=deals_count&limit=1`))[0];
        await sb(`re_contacts?id=eq.${id}`, { method: "PATCH", body: { deals_count: ((c && c.deals_count) || 0) + 1, updated_at: nowIso() } });
      } catch {}
    }
  } else if (stage === "LOST") {
    // العرض يعود للسوق، والطلب يعود للبحث لا إلى «مُغلق»: العميل ما زال يريد.
    if (deal.request_id) { try { await sb(`re_requests?id=eq.${deal.request_id}`, { method: "PATCH", body: { status: "SEARCHING", updated_at: nowIso() } }); } catch {} }
    if (deal.match_id) { try { await sb(`re_matches?id=eq.${deal.match_id}`, { method: "PATCH", body: { status: "REJECTED", updated_at: nowIso() } }); } catch {} }
  }

  await audit({ action: "re.deal.stage", entity_type: "re_deals", entity_id: deal.id, details: { ref, stage, actor } });
  if (DEAL_DONE.has(stage)) {
    await alertOwner([
      stage === "CLOSED" ? `✅ *صفقة مُقفلة* ${ref}` : `❌ *صفقة خسرت* ${ref}`,
      after.amount != null ? `القيمة: ${Number(after.amount).toLocaleString("en-US")} ريال` : "",
      stage === "CLOSED" && after.commission_amount != null ? `العمولة: ${Number(after.commission_amount).toLocaleString("en-US")} ريال` : "",
      stage === "LOST" ? `السبب: ${after.lost_reason}` : "",
    ].filter(Boolean).join("\n"));
  }
  return { deal: after };
}

/** فتح ملف دراسة/تحليل — الخدمة الأخرى للمكتب خارج مسار الطلب والعرض. */
export async function openStudy({ phone, name, kind, title, city, propertyType, brief, fee, dueAt, actor = "ops" }) {
  if (kind && !STUDY_KINDS[kind]) return { error: "bad_kind" };
  const t = String(title || "").trim();
  if (!t) return { error: "title_required" };
  const contact = phone ? await upsertContact({ phone, name, roles: ["CLIENT"] }) : null;
  const ref = await nextRef("study");
  const row = {
    ref, contact_id: contact ? contact.id : null,
    kind: kind || "ANALYSIS", title: t.slice(0, 200),
    city: city || null, property_type: propertyType || null,
    brief: brief ? String(brief).slice(0, 2000) : null,
    fee: num(fee), status: "NEW", due_at: dueAt || null, output_url: null,
  };
  if (!DB_ON) return { study: { ...row, id: crypto.randomUUID() } };
  const ins = await sb("re_studies", { method: "POST", body: [row] });
  const study = (ins && ins[0]) || row;
  await audit({ action: "re.study.open", entity_type: "re_studies", entity_id: study.id, details: { ref, kind: row.kind, actor } });
  await alertOwner([
    `📊 *${STUDY_KINDS[row.kind]}* ${ref}`,
    row.title,
    row.city ? `المدينة: ${row.city}` : "",
    row.fee != null ? `الأتعاب: ${Number(row.fee).toLocaleString("en-US")} ريال` : "",
  ].filter(Boolean).join("\n"));
  return { study };
}

/** تحديث حالة دراسة. التسليم يحتاج مخرجاً — «مُسلَّمة» بلا ملف ادعاء. */
export async function setStudyStatus({ ref, status, fee, outputUrl, dueAt, actor = "ops" }) {
  if (!STUDY_STATUSES[status]) return { error: "bad_status" };
  const study = await byRef("re_studies", ref);
  if (!study) return { error: "not_found" };
  const out = outputUrl != null ? String(outputUrl).trim() : (study.output_url || "");
  if (status === "DELIVERED" && !out) return { error: "output_required" };

  const patch = { status, updated_at: nowIso() };
  if (num(fee) != null) patch.fee = num(fee);
  if (outputUrl != null) patch.output_url = out || null;
  if (dueAt != null) patch.due_at = dueAt || null;
  if (!DB_ON) return { study: { ...study, ...patch } };
  const upd = await sb(`re_studies?id=eq.${study.id}`, { method: "PATCH", body: patch });
  await audit({ action: "re.study.status", entity_type: "re_studies", entity_id: study.id, details: { ref, status, actor } });
  if (status === "DELIVERED") await alertOwner(`📦 *سُلِّمت* ${ref} — ${study.title}`);
  return { study: (upd && upd[0]) || { ...study, ...patch } };
}

// ------------------------------------------------- المستشار على واتساب --
const GREETING = (name) => `أهلاً ${name || "وسهلاً"} 👋
معك المستشار العقاري الذكي لدى *${OFFICE.nameAr}*.

اكتب طلبك أو عرضك بطريقتك وأنا أرتّبه:
• *طلب* — «أبحث عن أرض خام شمال الرياض ٥٠٠٠م بحدود ٨ مليون»
• *عرض* — «للبيع عمارة سكنية بحي الملقا مؤجرة، السعر ١٢ مليون»
• *دراسة* — «أبغى دراسة جدوى / تحليل عقاري / تقييم»`;

/**
 * معالجة رسالة واردة واحدة. هذه هي الحلقة كاملة.
 *
 * @param {{from:string, text:string, name?:string, messageId?:string}} msg
 * @returns {Promise<object>} تقرير بما فُهم وما أُرسل — تقرأه اللوحة والاختبار
 */
export async function handleInbound(msg) {
  const from = waNumber(msg.from);
  const text = String(msg.text || "").trim();
  const report = { from, intent: null, ref: null, replied: false, matches: 0 };
  if (!from || !text) return { ...report, error: "empty" };

  // (٢) لا رسالة تُعالَج مرتين.
  if (msg.messageId && DB_ON) {
    try {
      const seen = await sb(`re_messages?wa_message_id=eq.${encodeURIComponent(msg.messageId)}&select=id&limit=1`);
      if (seen && seen.length) return { ...report, duplicate: true };
    } catch {}
  }

  const contact = await upsertContact({ phone: from, name: msg.name, roles: [] });
  const cls = classifyMessage(text);
  report.intent = cls.intent;

  let reply = "";
  let requestRow = null, listingRow = null;

  if (cls.intent === "REQUEST") {
    let fields = parseRequestText(text);
    fields = await aiFill(text, fields, "request");
    requestRow = await saveRequest(fields, { contact, source: "WHATSAPP" });
    report.ref = requestRow.ref;
    if (contact) await upsertContact({ phone: from, roles: ["CLIENT"] });

    const q = nextQuestion(requestRow);
    if (q) {
      // سؤال واحد لا استمارة: النموذج الطويل يُهجر في واتساب، والطلب
      // الناقص محفوظٌ أصلاً فلا شيء يضيع إن لم يُجب.
      reply = [
        `سجّلت طلبك برقم *${requestRow.ref}* ✅`,
        summarizeRequest(requestRow),
        "",
        q.ask,
      ].filter(Boolean).join("\n");
    } else {
      const ranked = await matchRequest(requestRow);
      report.matches = ranked.length;
      if (ranked.length) {
        reply = [
          `سجّلت طلبك برقم *${requestRow.ref}* ✅`,
          // صيغة النقطتين تتجنّب مطابقة الفعل والصفة للعدد: تصحّ مع الواحد
          // والمثنّى والجمع بلا ثلاث جمل.
          `مبدئياً لدينا ما يطابق مواصفاتك: ${offersAr(ranked.length)}. ${ranked.length === 1 ? "يراجعه" : "يراجعها"} المستشار ويرسل لك المناسب.`,
          AUTO_SEND ? "" : "",
        ].filter(Boolean).join("\n");
        if (AUTO_SEND) {
          const cards = ranked.slice(0, 3).map((m) => listingCard(m.listing, m)).join("\n\n———\n\n");
          reply += `\n\n${cards}`;
          await markMatchesSent(requestRow.id, ranked.slice(0, 3));
        }
      } else {
        reply = [
          `سجّلت طلبك برقم *${requestRow.ref}* ✅`,
          summarizeRequest(requestRow),
          "",
          "ما عندنا حالياً عرض مطابق في المخزون — بنطرح طلبك على شبكة المسوّقين والمطوّرين ونوافيك بما يصل.",
        ].join("\n");
      }
    }
    await alertOwner([
      `📥 *طلب جديد* ${requestRow.ref}`,
      `من: ${msg.name || ""} ${from}`,
      summarizeRequest(requestRow),
      `الاكتمال: ${requestRow.completeness}%`,
      report.matches ? `مطابقات مبدئية: ${report.matches}` : "لا مطابقات — يحتاج طرحاً على السوق",
    ].filter(Boolean).join("\n"));
  } else if (cls.intent === "LISTING") {
    let fields = parseListingText(text);
    fields = await aiFill(text, fields, "listing");
    listingRow = await saveListing(fields, { contact, source: "WHATSAPP" });
    report.ref = listingRow.ref;
    await upsertContact({ phone: from, roles: ["MARKETER"] });

    const hits = await matchListing(listingRow);
    report.matches = hits.length;
    reply = [
      `وصلنا عرضك وسجّلناه برقم *${listingRow.ref}* ✅`,
      summarizeListing(listingRow),
      "",
      hits.length
        ? "العرض يطابق طلباً قائماً لدينا — المستشار بيتواصل معك."
        : "ما فيه طلب مطابق حالياً، والعرض محفوظ عندنا وبنرجع لك أول ما يجي طلب يناسبه.",
    ].join("\n");

    if (hits.length) {
      await alertOwner([
        `🎯 *عرض يطابق ${requestsAr(hits.length)}* ${listingRow.ref}`,
        summarizeListing(listingRow),
        `من: ${msg.name || ""} ${from}`,
        "",
        ...hits.slice(0, 5).map((h) => `• ${h.request.ref} — ${h.score}% — ${h.reasons.slice(0, 2).join(" · ")}`),
      ].join("\n"));
    } else {
      await alertOwner(`📦 *عرض جديد* ${listingRow.ref}\n${summarizeListing(listingRow)}\nمن: ${from}`);
    }
  } else if (cls.intent === "STUDY") {
    const ref = await nextRef("study");
    const row = {
      ref, contact_id: contact ? contact.id : null,
      kind: /جدوي|جدوى/.test(normalizeAr(text)) ? "FEASIBILITY" : /تقييم|تثمين/.test(normalizeAr(text)) ? "VALUATION" : "ANALYSIS",
      title: text.slice(0, 120),
      city: parseRequestText(text).city,
      property_type: parseRequestText(text).property_type,
      brief: text.slice(0, 2000),
      status: "NEW",
    };
    if (DB_ON) { try { await sb("re_studies", { method: "POST", prefer: "return=minimal", body: [row] }); } catch {} }
    report.ref = ref;
    await upsertContact({ phone: from, roles: ["CLIENT"] });
    reply = [
      `فتحنا لك ملف *${ref}* ✅`,
      "خدمات الاستشارات والتحليل العقاري لدينا: دراسات الجدوى وتحليل السوق، الهندسة المالية للمشاريع العقارية، والاستشارات الاستراتيجية المتخصصة.",
      "",
      `المستشار ${OFFICE.ceo} بيتواصل معك لتحديد النطاق والأتعاب.`,
    ].join("\n");
    await alertOwner(`📊 *طلب دراسة/تحليل* ${ref}\nمن: ${msg.name || ""} ${from}\n${text.slice(0, 300)}`);
  } else {
    reply = await answerQuestion(text, msg.name);
  }

  const inRow = await logMessage({
    contact_id: contact ? contact.id : null, wa_phone: from, direction: "in",
    wa_message_id: msg.messageId || null, body: text, intent: cls.intent,
    parsed: { confidence: cls.confidence, scores: cls.scores },
    request_id: requestRow ? requestRow.id : null,
    listing_id: listingRow ? listingRow.id : null,
  });
  report.messageId = inRow ? inRow.id : null;

  if (reply) {
    const sent = await send(from, reply, { subject: "رد المستشار" });
    report.replied = !!sent.ok;
    await logMessage({
      contact_id: contact ? contact.id : null, wa_phone: from, direction: "out",
      body: reply, intent: "REPLY",
      request_id: requestRow ? requestRow.id : null,
      listing_id: listingRow ? listingRow.id : null,
    });
  }
  await audit({ action: "re.inbound", entity_type: "re_messages", details: { from, intent: cls.intent, ref: report.ref } });
  return report;
}

function summarizeRequest(r) {
  const money = (n) => (n == null ? "" : Number(n).toLocaleString("en-US"));
  return [
    r.property_type ? `النوع: ${propertyTypeLabel(r.property_type)}` : "",
    r.city ? `المدينة: ${r.city}${(r.districts || []).length ? ` (${r.districts.join("، ")})` : ""}` : "",
    r.area_min || r.area_max ? `المساحة: ${money(r.area_min || r.area_max)} م²` : "",
    r.budget_max ? `الميزانية: حتى ${money(r.budget_max)} ريال` : "",
    r.income_producing === true ? "الشرط: مدر للدخل" : r.income_producing === false ? "الشرط: غير مدر" : "",
  ].filter(Boolean).join("\n");
}

function summarizeListing(l) {
  const money = (n) => (n == null ? "" : Number(n).toLocaleString("en-US"));
  return [
    l.property_type ? `النوع: ${propertyTypeLabel(l.property_type)}` : "",
    l.city ? `المدينة: ${l.city}${l.district ? ` — ${l.district}` : ""}` : "",
    l.area ? `المساحة: ${money(l.area)} م²` : "",
    l.price ? `السعر: ${money(l.price)} ريال` : "",
    l.yield_pct ? `العائد: ${l.yield_pct}%` : "",
  ].filter(Boolean).join("\n");
}

// سؤال عام: يُجاب بالنموذج حين يتوفر مفتاح، وبقائمة ثابتة حين لا يتوفر.
// القائمة ليست اعتذاراً — هي أسرع طريق لأن يكتب المرسل طلباً أو عرضاً.
async function answerQuestion(text, name) {
  if (!ANTHROPIC_KEY) return GREETING(name);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: BD_MODEL,
        max_tokens: 500,
        system: `أنت المستشار العقاري الذكي لدى ${OFFICE.nameAr} (${OFFICE.nameEn})، وسيط ومحلل عقاري مرخّص من الهيئة العامة للعقار، السجل التجاري ${OFFICE.cr}، ${OFFICE.city}.
خدمات المكتب: التسويق العقاري، الوساطة العقارية (بيع/شراء/تأجير)، إدارة الأملاك، توثيق عقود الإيجار عبر منصة إيجار، والاستشارات والتحليل العقاري (دراسات الجدوى وتحليل السوق، الهندسة المالية للمشاريع، الاستشارات الاستراتيجية).
قواعد لا تُخالَف:
- لا تذكر سعراً ولا تقديراً لعقار ولا عائداً متوقعاً من عندك؛ التسعير والتقييم يصدر عن المستشار المرخّص بعد دراسة.
- لا تعد بإنجاز نظامي ولا بموافقة جهة حكومية.
- لا تخترع معلومة عن عقار أو نظام؛ ما لا تعرفه تحيله للمستشار.
- ردّ بالعربية، بإيجاز (٤ أسطر فأقل)، واختم بدعوة لكتابة الطلب أو العرض.`,
        messages: [{ role: "user", content: String(text).slice(0, 1500) }],
      }),
    });
    if (!r.ok) return GREETING(name);
    const d = await r.json();
    const out = ((d.content || []).find((c) => c.type === "text") || {}).text || "";
    return out.trim() || GREETING(name);
  } catch { return GREETING(name); }
}

async function markMatchesSent(requestId, ranked) {
  if (!DB_ON) return;
  for (const m of ranked) {
    try {
      await sb(`re_matches?request_id=eq.${requestId}&listing_id=eq.${m.listing.id}`, {
        method: "PATCH", body: { status: "SENT", sent_at: nowIso(), updated_at: nowIso() },
      });
    } catch {}
  }
}

// ------------------------------------------------------ ويبهوك واتساب --
// ميتا ترسل شكلاً متداخلاً؛ هذه الدالة تسطّحه إلى ما يهم فقط. صورة أو
// موقع بلا نص يصلان كرسالة بلا body — تُسجَّل ولا تُصنَّف، لأن تصنيف
// الفراغ تخمين.
export function parseMetaWebhook(payload) {
  const out = [];
  for (const entry of (payload && payload.entry) || []) {
    for (const ch of entry.changes || []) {
      const v = ch.value || {};
      const profileByWa = {};
      for (const c of v.contacts || []) profileByWa[c.wa_id] = (c.profile && c.profile.name) || "";
      for (const m of v.messages || []) {
        const text = m.type === "text" ? (m.text && m.text.body) || ""
          : m.type === "button" ? (m.button && m.button.text) || ""
          : m.type === "interactive" ? ((m.interactive && ((m.interactive.button_reply || {}).title || (m.interactive.list_reply || {}).title)) || "")
          : (m.caption || "");
        out.push({ from: m.from, text, name: profileByWa[m.from] || "", messageId: m.id, type: m.type });
      }
    }
  }
  return out;
}

// ------------------------------------------------------------- المناوِل --
export async function handleRealEstate(req, res) {
  const q = req.query || {};
  const b = bodyOf(req);
  const action = String(q.action || b.action || "").trim();

  // تحقق ميتا من الويبهوك (GET مرة واحدة عند الربط).
  if (req.method === "GET" && (q["hub.mode"] || action === "wa-webhook")) {
    const mode = q["hub.mode"], token = q["hub.verify_token"], challenge = q["hub.challenge"];
    if (mode === "subscribe" && VERIFY_TOKEN && token === VERIFY_TOKEN) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/plain");
      return res.end(String(challenge || ""));
    }
    if (q["hub.mode"]) { res.statusCode = 403; return res.end("forbidden"); }
  }

  // الرسائل الواردة. الرد على ميتا يكون 200 دائماً وسريعاً: أي شيء آخر
  // يجعلها تعيد الإرسال، والإعادة تعني معالجة مكرّرة — ولذلك يُبتلع الخطأ
  // هنا بعد تسجيله بدل أن يُرجَّع.
  if (req.method === "POST" && action === "wa-webhook") {
    const msgs = parseMetaWebhook(b);
    const reports = [];
    for (const m of msgs) {
      try { reports.push(await handleInbound(m)); }
      catch (e) { console.error("re inbound", e.message); reports.push({ from: m.from, error: e.message }); }
    }
    return json(res, 200, { ok: true, handled: reports.length, reports });
  }

  // ---- نماذج الموقع العامة ----
  if (req.method === "POST" && action === "request") {
    const fields = { ...parseRequestText(b.notes || b.text || ""), ...pickRequestFields(b) };
    if (!fields.property_type && !fields.city) return json(res, 400, { error: "incomplete" });
    const contact = await upsertContact({ phone: b.phone, name: b.name, email: b.email, city: b.city, roles: ["CLIENT"] });
    const row = await saveRequest({ ...fields, raw_text: b.notes || null }, {
      contact, source: "WEBSITE", sourceDetail: b.page || null, chain: b.chain || null,
    });
    if (b.chain && b.chain.length) await setChain({ subjectRef: row.ref, kind: "REQUEST", entries: b.chain });
    const ranked = await matchRequest(row);
    await alertOwner(`🌐 *طلب من الموقع* ${row.ref}\n${b.name || ""} ${b.phone || ""}\n${summarizeRequest(row)}\nمطابقات: ${ranked.length}`);
    return json(res, 200, { ok: true, ref: row.ref, matches: ranked.length });
  }

  if (req.method === "POST" && action === "offer") {
    const fields = { ...parseListingText(b.notes || b.text || ""), ...pickListingFields(b) };
    if (!fields.property_type && !fields.city) return json(res, 400, { error: "incomplete" });
    const contact = await upsertContact({ phone: b.phone, name: b.name, company: b.company, email: b.email, roles: [b.role === "OWNER" ? "OWNER" : b.role === "DEVELOPER" ? "DEVELOPER" : "MARKETER"] });
    const row = await saveListing({ ...fields, raw_text: b.notes || null }, {
      contact, source: "WEBSITE", sourceDetail: b.page || null, chain: b.chain || null,
    });
    if (b.chain && b.chain.length) await setChain({ subjectRef: row.ref, kind: "LISTING", entries: b.chain });
    const hits = await matchListing(row);
    await alertOwner(`🌐 *عرض من الموقع* ${row.ref}\n${b.name || ""} ${b.phone || ""}\n${summarizeListing(row)}\nيطابق: ${hits.length} طلباً`);
    return json(res, 200, { ok: true, ref: row.ref, matchedRequests: hits.length });
  }

  // اختبار القارئ — مفتوح عمداً: لا يكتب شيئاً ولا يقرأ بيانات، ويجعل
  // ضبط صيغ الرسائل ممكناً بلا مفتاح ولا قاعدة.
  if (action === "parse") {
    const text = String(b.text || q.text || "");
    const cls = classifyMessage(text);
    return json(res, 200, {
      intent: cls.intent, confidence: cls.confidence,
      request: parseRequestText(text), listing: parseListingText(text),
    });
  }

  // ---- ما بعده للوحة فقط ----
  // مفتاح غير مضبوط على الخادم يرفض كل مفتاح يكتبه المستخدم، فتبدو اللوحة
  // معطوبة بلا سبب ظاهر. يُفصل السببان حتى يعرف من يشغّلها أيّهما وقع.
  if (!OPS_KEY) return json(res, 503, { error: "ops_key_unset" });
  if (!opsOk({ ...q, ...b })) return json(res, 401, { error: "unauthorized" });

  if (action === "dashboard") return json(res, 200, await dashboard());

  if (action === "list") {
    const table = { requests: "re_requests", listings: "re_listings", contacts: "re_contacts", matches: "re_matches", deals: "re_deals", studies: "re_studies", messages: "re_messages", intake: "re_intake", chain: "re_chain" }[String(q.of || b.of || "")];
    if (!table) return json(res, 400, { error: "unknown_list" });
    if (!DB_ON) return json(res, 200, { rows: [] });
    const limit = Math.min(200, Number(q.limit || b.limit || 50) || 50);
    const filters = [];
    if (q.status) filters.push(`status=eq.${encodeURIComponent(q.status)}`);
    if (q.city) filters.push(`city=eq.${encodeURIComponent(q.city)}`);
    if (q.request_id) filters.push(`request_id=eq.${encodeURIComponent(q.request_id)}`);
    const rows = await sb(`${table}?${[...filters, "select=*", `limit=${limit}`, "order=created_at.desc"].join("&")}`);
    return json(res, 200, { rows: rows || [] });
  }

  if (action === "match" && req.method === "POST") {
    const row = await byRef("re_requests", b.ref);
    if (!row) return json(res, 404, { error: "not_found" });
    const ranked = await matchRequest(row);
    return json(res, 200, {
      ok: true, count: ranked.length,
      matches: ranked.map((m) => ({ ref: m.listing.ref, id: m.listing.id, score: m.score, reasons: m.reasons, gaps: m.gaps, listing: m.listing })),
    });
  }

  if (action === "send-matches" && req.method === "POST") {
    const row = await byRef("re_requests", b.ref);
    if (!row) return json(res, 404, { error: "not_found" });
    const contact = row.contact_id && DB_ON ? (await sb(`re_contacts?id=eq.${row.contact_id}&select=*&limit=1`))[0] : null;
    if (!contact) return json(res, 400, { error: "no_contact" });
    const ranked = await matchRequest(row);
    const chosen = Array.isArray(b.listingIds) && b.listingIds.length
      ? ranked.filter((m) => b.listingIds.includes(m.listing.id))
      : ranked.slice(0, 3);
    if (!chosen.length) return json(res, 200, { ok: true, sent: 0 });
    const text = [
      `*${OFFICE.nameAr}*`,
      `بخصوص طلبك ${row.ref} — هذه العروض المطابقة:`,
      "",
      chosen.map((m) => listingCard(m.listing, m)).join("\n\n———\n\n"),
      "",
      "للمعاينة أو التفاصيل رد على هذه الرسالة.",
    ].join("\n");
    const sent = await send(contact.wa_phone, text, { subject: `مطابقات ${row.ref}` });
    if (sent.ok) await markMatchesSent(row.id, chosen);
    await logMessage({ contact_id: contact.id, wa_phone: contact.wa_phone, direction: "out", body: text, intent: "MATCHES", request_id: row.id });
    return json(res, 200, { ok: !!sent.ok, sent: chosen.length, error: sent.ok ? null : sent.error });
  }

  if (action === "broadcast" && req.method === "POST") {
    const row = await byRef("re_requests", b.ref);
    if (!row) return json(res, 404, { error: "not_found" });
    const out = await broadcastRequest(row, { limit: Math.min(100, Number(b.limit) || 40), actor: b.actor || "ops" });
    return json(res, 200, { ok: true, ref: out.ref, sent: out.sent_count, audience: out.audience.length, message: out.message });
  }

  if (action === "update" && req.method === "POST") {
    const table = { request: "re_requests", listing: "re_listings", match: "re_matches", contact: "re_contacts", deal: "re_deals", study: "re_studies" }[String(b.of || "")];
    if (!table || !b.id || !b.patch || typeof b.patch !== "object") return json(res, 400, { error: "bad_request" });
    if (!DB_ON) return json(res, 200, { ok: true, local: true });
    // قائمة بيضاء: تعديل يأتي من متصفح لا يُمرَّر إلى القاعدة كما هو.
    const ALLOWED = new Set(["status", "priority", "assigned_to", "notes", "internal_notes", "available", "exclusive",
      "verified_at", "stage", "amount", "commission_pct", "commission_amount", "lost_reason", "blocked", "roles",
      "price", "area", "annual_income", "yield_pct", "city", "district", "property_type", "income_producing",
      "budget_min", "budget_max", "area_min", "area_max", "target_yield", "fee", "due_at", "output_url", "closed_at"]);
    const patch = {};
    for (const [k, v] of Object.entries(b.patch)) if (ALLOWED.has(k)) patch[k] = v;
    if (!Object.keys(patch).length) return json(res, 400, { error: "no_allowed_fields" });
    patch.updated_at = nowIso();
    const upd = await sb(`${table}?id=eq.${encodeURIComponent(b.id)}`, { method: "PATCH", body: patch });
    await audit({ action: "re.update", entity_type: table, entity_id: b.id, details: patch });
    return json(res, 200, { ok: true, row: (upd && upd[0]) || null });
  }

  // ------------------------------------------------------ الوارد ------
  if (action === "intake" && req.method === "POST") {
    const row = await saveIntake({
      text: b.text, channel: b.channel, channelDetail: b.channelDetail || b.detail,
      name: b.name, phone: b.phone, email: b.email,
      receivedAt: b.receivedAt || b.received_at, enteredBy: b.actor || b.enteredBy,
      backlog: !!b.backlog,
    });
    if (row && row.error) return json(res, row.error === "unknown_channel" ? 400 : 422, row);
    // التكرار يُعرض مع الصفّ لا بعده: من يراجع الوارد يقرّر وهو يراه.
    // والفحص للطلبات وحدها: طلبُ دراسةٍ عن أرضٍ ليس طلبَ شراءٍ لها، وقد
    // وُسم في أول تشغيل للديمو بأنه يكرّر طلب شراء — تنبيهٌ خاطئ يُفقد
    // بقيةَ التنبيهات قيمتَها.
    const dups = row.intent === "REQUEST" ? await duplicatesFor(row.parsed || {}, row.contact_id) : [];
    return json(res, 200, { ok: true, row, duplicates: dups });
  }

  if (action === "intake-bulk" && req.method === "POST") {
    const out = await bulkIntake({
      text: b.text, format: b.format || "blocks", channel: b.channel || "IMPORT",
      enteredBy: b.actor || b.enteredBy, onlyFrom: b.onlyFrom || null,
      dayFirst: b.dayFirst !== false, backlog: b.backlog !== false,
      limit: Math.min(Number(b.limit) || 300, 500),
    });
    return json(res, 200, out);
  }

  // قراءة التصدير بلا حفظ — معاينة قبل الالتزام بثلاثمئة صفّ.
  if (action === "intake-preview" && req.method === "POST") {
    const format = b.format || "blocks";
    const items = format === "whatsapp"
      ? parseChatExport(b.text, { dayFirst: b.dayFirst !== false })
      : splitBlocks(b.text).map((t) => ({ at: null, sender: null, text: t }));
    const senders = {};
    for (const m of items) if (m.sender) senders[m.sender] = (senders[m.sender] || 0) + 1;
    const sample = items.slice(0, 25).map((m) => ({
      at: m.at, sender: m.sender, text: m.text.slice(0, 220),
      intent: classifyMessage(m.text).intent,
    }));
    return json(res, 200, { total: items.length, senders, sample });
  }

  if (action === "intake-convert" && req.method === "POST") {
    const out = await convertIntake({ ref: b.ref, kind: b.kind, overrides: b.fields || {}, chain: b.chain || null, actor: b.actor || null });
    if (out && out.error) return json(res, out.error === "not_found" ? 404 : 409, out);
    return json(res, 200, out);
  }

  if (action === "intake-close" && req.method === "POST") {
    const out = await closeIntake({ ref: b.ref, status: b.status, dupOf: b.dupOf || null, actor: b.actor || null });
    if (out && out.error) return json(res, 400, out);
    return json(res, 200, out);
  }

  // ------------------------------------------------- سلسلة الوسطاء ----
  if (action === "chain" && req.method === "POST") {
    const kind = String(b.kind || "REQUEST").toUpperCase();
    if (!b.ref) return json(res, 400, { error: "ref_required" });
    const built = await setChain({ subjectRef: b.ref, kind, entries: b.chain || [] });
    return json(res, 200, { ok: true, ...built });
  }
  if (action === "chain") {
    if (!q.ref) return json(res, 400, { error: "ref_required" });
    return json(res, 200, { rows: await chainFor(q.ref) });
  }

  if (action === "duplicates" && req.method === "POST") {
    return json(res, 200, { rows: await duplicatesFor(b.fields || parseRequestText(b.text || ""), b.contactId || null) });
  }

  if (action === "deal" && req.method === "POST") {
    const out = await openDeal({
      requestRef: b.requestRef, listingRef: b.listingRef,
      amount: b.amount, commissionPct: b.commissionPct, notes: b.notes, actor: b.actor || "ops",
    });
    if (out.error === "not_found") return json(res, 404, { error: "not_found" });
    if (out.error === "already_open") return json(res, 409, { error: "already_open", ref: out.deal.ref });
    if (out.error) return json(res, 400, out);
    return json(res, 200, { ok: true, ref: out.deal.ref, deal: out.deal });
  }

  if (action === "deal-stage" && req.method === "POST") {
    const out = await moveDealStage({
      ref: b.ref, stage: b.stage, lostReason: b.lostReason,
      amount: b.amount, commissionPct: b.commissionPct, notes: b.notes, actor: b.actor || "ops",
    });
    if (out.error === "not_found") return json(res, 404, { error: "not_found" });
    if (out.error) return json(res, 400, out);
    return json(res, 200, { ok: true, deal: out.deal });
  }

  if (action === "study" && req.method === "POST") {
    const out = await openStudy({
      phone: b.phone, name: b.name, kind: b.kind, title: b.title, city: b.city,
      propertyType: b.propertyType, brief: b.brief, fee: b.fee, dueAt: b.dueAt, actor: b.actor || "ops",
    });
    if (out.error) return json(res, 400, out);
    return json(res, 200, { ok: true, ref: out.study.ref, study: out.study });
  }

  if (action === "study-status" && req.method === "POST") {
    const out = await setStudyStatus({
      ref: b.ref, status: b.status, fee: b.fee, outputUrl: b.outputUrl, dueAt: b.dueAt, actor: b.actor || "ops",
    });
    if (out.error === "not_found") return json(res, 404, { error: "not_found" });
    if (out.error) return json(res, 400, out);
    return json(res, 200, { ok: true, study: out.study });
  }

  // محاكاة رسالة واردة — الطريق لتجربة المسار كاملاً محلياً بلا ربط ميتا.
  if (action === "simulate" && req.method === "POST") {
    const out = await handleInbound({ from: b.from || "966500000000", text: b.text || "", name: b.name || "تجربة", messageId: b.messageId || `sim-${Date.now()}` });
    return json(res, 200, out);
  }

  if (action === "status") {
    return json(res, 200, {
      office: OFFICE,
      db: DB_ON,
      whatsappLive: WHATSAPP_LIVE,
      webhookVerify: !!VERIFY_TOKEN,
      ownerAlerts: !!OWNER_WA,
      ai: !!ANTHROPIC_KEY,
      autoSend: AUTO_SEND,
      matchMin: MATCH_MIN,
      commissionPct: DEFAULT_COMMISSION,
      // اللوحة تقرأ مسمّياتها من هنا: قائمة تُكتب مرتين تنحرف مرةً واحدة.
      labels: { dealStages: DEAL_STAGES, studyKinds: STUDY_KINDS, studyStatuses: STUDY_STATUSES,
                channels: CHANNELS, social: SOCIAL_CHANNELS, chainRoles: CHAIN_ROLES,
                propertyTypes: Object.fromEntries(Object.entries(PROPERTY_TYPES).map(([k, v]) => [k, v.ar])) },
      missing: [
        DB_ON ? null : "SUPABASE_SERVICE_KEY",
        VERIFY_TOKEN ? null : "BD_WA_VERIFY_TOKEN",
        OWNER_WA ? null : "BD_OWNER_WA",
        WHATSAPP_LIVE ? null : "WHATSAPP_MODE=live",
      ].filter(Boolean),
    });
  }

  return json(res, 400, { error: "unknown_action" });
}

async function byRef(table, ref) {
  if (!DB_ON || !ref) return null;
  try {
    const rows = await sb(`${table}?ref=eq.${encodeURIComponent(String(ref).trim())}&select=*&limit=1`);
    return (rows && rows[0]) || null;
  } catch { return null; }
}

// ============================================================ الاستقبال ==
// قمع واحد لكل القنوات. واتساب هو الأغلب، لكن الطلب يصل أيضاً من نموذج
// الموقع، ومن رسالة إنستقرام، ومن بريد، ومن مكالمة يدوّنها أحد الفريق،
// ومن وسيط ينقل عن وسيط. القنوات تختلف في الغلاف لا في المضمون: كلها نصّ
// عربي حرّ. لذلك لا محلّل لكل قناة — محلّل واحد، وحقلُ قناة على الصفّ.
//
// ولماذا صفّ وسيط (re_intake) بدل الحفظ مباشرةً طلباً؟ لأن ما لم يُفهم لا
// يجوز أن يضيع ولا أن يُسجَّل طلباً ناقصاً يلوّث المطابقة. يبقى في الوارد
// بنصّه حتى يراه إنسان. ولأن الأرشيف يُدخل مئاتٍ دفعةً واحدة، ومراجعتها
// قبل التحويل أرخص من تنظيفها بعده.

/** صفّ وارد جديد — لا يُرسل شيئاً ولا يطابق؛ الفهم أولاً ثم التحويل. */
export async function saveIntake({
  text, channel = "WHATSAPP", channelDetail = null, name = null, phone = null,
  email = null, receivedAt = null, enteredBy = null, backlog = false,
}) {
  const raw = String(text || "").trim();
  if (!raw) return { error: "empty" };
  const ch = String(channel || "WHATSAPP").toUpperCase();
  if (!CHANNELS[ch]) return { error: "unknown_channel" };
  const cls = classifyMessage(raw);
  const intent = cls.intent || "UNKNOWN";
  const parsed = intent === "LISTING" ? parseListingText(raw) : parseRequestText(raw);
  const hint = detectChainHint(raw);
  const ref = await nextRef("intake");
  // جهة الاتصال تُنشأ فقط حين يوجد رقم. وارد من بريد أو حساب اجتماعي بلا
  // رقم يبقى بلا جهة اتصال حتى تُعرف — ولا يُخترع له رقم ليكتمل الصفّ.
  const contact = phone ? await upsertContact({ phone, name, email, roles: [] }) : null;
  const row = {
    ref, channel: ch, channel_detail: channelDetail || null,
    contact_id: contact ? contact.id : null,
    sender_name: name || null,
    sender_phone: phone ? waNumber(phone) : null,
    sender_email: email || null,
    raw_text: raw.slice(0, 4000),
    received_at: receivedAt || nowIso(),
    entered_by: enteredBy || null,
    intent,
    parsed: { ...parsed, chain_hint: hint, phones_in_text: extractPhones(raw), confidence: cls.confidence },
    status: "NEW",
    backlog: !!backlog,
  };
  if (!DB_ON) return { ...row, id: crypto.randomUUID() };
  try {
    const ins = await sb("re_intake", { method: "POST", body: [row] });
    return (ins && ins[0]) || row;
  } catch (e) { console.error("re intake", e.message); return { error: "save_failed" }; }
}

/**
 * إدخال دفعة: إمّا تصدير محادثة واتساب، وإمّا لصقة كتلٍ يفصلها سطر فارغ.
 * كل رسالة تحمل تاريخها هي. والدفعة تُدخل أرشيفاً افتراضاً — لأن هذا هو
 * سببها: تسجيل ما مضى. أرشيفٌ يُرسل رسائلَ لأصحابه بعد شهور عطلٌ لا ميزة.
 */
export async function bulkIntake({
  text, format = "blocks", channel = "IMPORT", enteredBy = null,
  onlyFrom = null, dayFirst = true, backlog = true, limit = 300,
}) {
  const items = [];
  if (format === "whatsapp") {
    for (const m of parseChatExport(text, { dayFirst })) {
      // «فقط من» يستبعد رسائل بندر نفسه من أرشيفه: تصدير محادثة فيه
      // طرفاها، ونصفها منه هو، وليست طلبات.
      if (onlyFrom && normalizeAr(m.sender) !== normalizeAr(onlyFrom)) continue;
      items.push({ text: m.text, name: m.sender, receivedAt: m.at });
    }
  } else {
    for (const b of splitBlocks(text)) items.push({ text: b, name: null, receivedAt: null });
  }
  const chosen = items.slice(0, limit);
  const saved = [], skipped = [];
  for (const it of chosen) {
    const cls = classifyMessage(it.text);
    // سؤالٌ عامّ أو كلامٌ لا يحمل وصفاً عقارياً ليس طلباً. يُحصى ولا يُدخل.
    if (cls.intent === "QUESTION" || cls.intent === "UNKNOWN") { skipped.push({ text: it.text.slice(0, 80), why: "ليست طلباً ولا عرضاً" }); continue; }
    const row = await saveIntake({
      text: it.text, channel, name: it.name, receivedAt: it.receivedAt,
      enteredBy, backlog,
      // رقم ظاهر في النص أولى من لا شيء: أرشيف الواتساب يحمل أرقام
      // أصحابه في متنه كثيراً («رقمه 0555…»).
      phone: extractPhones(it.text)[0] || null,
    });
    if (row && !row.error) saved.push(row); else skipped.push({ text: it.text.slice(0, 80), why: row && row.error ? row.error : "تعذّر الحفظ" });
  }
  return {
    read: items.length, saved: saved.length, skipped: skipped.length,
    truncated: items.length > chosen.length ? items.length - chosen.length : 0,
    rows: saved, skippedRows: skipped.slice(0, 20),
  };
}

/** حفظ سلسلة الوسطاء لطلب أو عرض. تُستبدل كاملةً لا تُضاف إليها. */
export async function setChain({ subjectRef, kind = "REQUEST", entries = [] }) {
  const built = buildChain(entries);
  if (!DB_ON) return built;
  try {
    await sb(`re_chain?subject_ref=eq.${encodeURIComponent(subjectRef)}`, { method: "DELETE" });
    if (built.chain.length) {
      const rows = [];
      for (const e of built.chain) {
        // كل فرد في السلسلة جهةُ اتصال إن كان له رقم: هكذا يصير السؤال
        // «ما الذي جاءنا عن طريق أبو سعد؟» قابلاً للإجابة.
        const c = e.phone ? await upsertContact({ phone: e.phone, name: e.name, roles: [e.role === "CLIENT" ? "CLIENT" : e.role === "OWNER" ? "OWNER" : "BROKER"] }) : null;
        rows.push({
          subject_kind: kind, subject_ref: subjectRef, position: e.position,
          contact_id: c ? c.id : null, name: e.name, phone: e.phone,
          role: e.role, share_pct: e.share_pct, notes: e.notes,
        });
      }
      await sb("re_chain", { method: "POST", body: rows });
    }
    const table = kind === "LISTING" ? "re_listings" : "re_requests";
    const patch = { chain_len: built.length, updated_at: nowIso() };
    if (kind === "REQUEST") patch.principal_known = built.principal_known;
    await sb(`${table}?ref=eq.${encodeURIComponent(subjectRef)}`, { method: "PATCH", body: patch });
  } catch (e) { console.error("re chain", e.message); }
  return built;
}

/** السلسلة كما هي مخزّنة، مرتّبة من الأقرب إلينا. */
export async function chainFor(subjectRef) {
  if (!DB_ON) return [];
  try {
    return await sb(`re_chain?subject_ref=eq.${encodeURIComponent(subjectRef)}&select=*&order=position.asc`) || [];
  } catch { return []; }
}

/** طلبات قريبة من هذا الوصف — لعرضها قبل التحويل، لا لدمجها آلياً. */
export async function duplicatesFor(fields, contactId = null) {
  if (!DB_ON) return [];
  try {
    const rows = await sb("re_requests?select=id,ref,contact_id,property_type,city,area_min,area_max,budget_min,budget_max,income_producing,status,created_at,received_at&order=created_at.desc&limit=400") || [];
    return findDuplicates({ ...fields, contact_id: contactId }, rows);
  } catch { return []; }
}

/**
 * تحويل وارد إلى طلب أو عرض. هنا وحدها يبدأ أثر المنظومة: المطابقة
 * والتنبيه. والأرشيف يُحوَّل صامتاً — يُسجَّل ويُطابَق في القاعدة، ولا
 * تُرسل عنه رسالة ولا يُنبَّه أحد، لأن أصحابه أُجيبوا قبل شهور.
 */
export async function convertIntake({ ref, kind = null, overrides = {}, chain = null, actor = null }) {
  if (!DB_ON) return { error: "db_off" };
  const rows = await sb(`re_intake?ref=eq.${encodeURIComponent(ref)}&select=*&limit=1`);
  const row = rows && rows[0];
  if (!row) return { error: "not_found" };
  if (row.status === "LINKED") return { error: "already_linked", linked_ref: row.linked_ref };
  const target = String(kind || (row.intent === "LISTING" ? "LISTING" : "REQUEST")).toUpperCase();
  const contact = row.sender_phone
    ? await upsertContact({ phone: row.sender_phone, name: row.sender_name, email: row.sender_email, roles: [target === "LISTING" ? "MARKETER" : "CLIENT"] })
    : null;
  const base = target === "LISTING" ? parseListingText(row.raw_text) : parseRequestText(row.raw_text);
  const fields = { ...base, ...(overrides || {}) };
  const opts = {
    contact, source: row.channel, sourceDetail: row.channel_detail,
    receivedAt: row.received_at, enteredBy: actor || row.entered_by,
    intakeRef: row.ref, chain, backlog: row.backlog,
  };
  const saved = target === "LISTING" ? await saveListing(fields, opts) : await saveRequest(fields, opts);
  if (chain && chain.length) await setChain({ subjectRef: saved.ref, kind: target, entries: chain });
  await sb(`re_intake?id=eq.${row.id}`, { method: "PATCH", body: {
    status: "LINKED", linked_kind: target, linked_ref: saved.ref, updated_at: nowIso(),
  } });
  // المطابقة تجري للأرشيف أيضاً — فطلبٌ قديم قد يطابق عرضاً قائماً اليوم،
  // وهذا بالضبط ما يجعل إدخال الأرشيف مربحاً لا توثيقاً.
  const matches = target === "LISTING" ? await matchListing(saved) : await matchRequest(saved);
  if (!row.backlog) await alertOwner(
    target === "LISTING"
      ? `عرض جديد ${saved.ref} من ${channelLabel(row.channel)}${matches.length ? ` — يطابق ${matches.length}` : ""}`
      : `طلب جديد ${saved.ref} من ${channelLabel(row.channel)}${matches.length ? ` — ${matches.length} مطابقة` : ""}`
  );
  await audit("re.intake.convert", { ref: row.ref, to: saved.ref, kind: target, actor });
  return { ok: true, kind: target, ref: saved.ref, row: saved, matches: matches.length };
}

/** إغلاق وارد بلا تحويل: مكرر أو ليس طلباً. لا يُحذف، ليبقى أثره. */
export async function closeIntake({ ref, status = "DISCARDED", dupOf = null, actor = null }) {
  if (!DB_ON) return { error: "db_off" };
  const allowed = new Set(["DISCARDED", "DUPLICATE", "NEEDS_INFO", "NEW"]);
  if (!allowed.has(status)) return { error: "bad_status" };
  if (status === "DUPLICATE" && !dupOf) return { error: "dup_of_required" };
  const upd = await sb(`re_intake?ref=eq.${encodeURIComponent(ref)}`, { method: "PATCH", body: {
    status, dup_of: dupOf || null, updated_at: nowIso(),
  } });
  await audit("re.intake.close", { ref, status, dupOf, actor });
  return { ok: true, row: (upd && upd[0]) || null };
}

async function dashboard() {
  if (!DB_ON) return { db: false, counts: {}, recent: {} };
  const count = async (table, filter) => {
    try { return (await sb(`${table}?${filter ? filter + "&" : ""}select=id&limit=1000`) || []).length; } catch { return 0; }
  };
  const recent = async (table, limit = 10) => {
    try { return await sb(`${table}?select=*&order=created_at.desc&limit=${limit}`) || []; } catch { return []; }
  };
  const [openReq, activeLst, newMatches, contacts, deals, studies, inbox] = await Promise.all([
    count("re_requests", "status=in.(OPEN,SEARCHING,MATCHED,VIEWING,NEGOTIATING)"),
    count("re_listings", "status=in.(ACTIVE,UNVERIFIED)"),
    count("re_matches", "status=eq.NEW"),
    count("re_contacts"),
    count("re_deals", "stage=not.in.(CLOSED,LOST)"),
    count("re_studies", "status=not.in.(DELIVERED,CANCELLED)"),
    count("re_intake", "status=in.(NEW,NEEDS_INFO)"),
  ]);
  const [requests, listings, matches, messages, dealRows, studyRows] = await Promise.all([
    recent("re_requests"), recent("re_listings"), recent("re_matches", 15), recent("re_messages", 15),
    recent("re_deals", 40), recent("re_studies", 40),
  ]);
  // الوارد يُرتَّب بوقت الوصول لا بوقت الإدخال: أرشيفٌ أُدخل اليوم يجب
  // أن يقع في مكانه من الزمن، لا أن يتصدّر ما وصل فعلاً هذا الصباح.
  let intakeRows = [];
  try {
    intakeRows = await sb("re_intake?status=in.(NEW,NEEDS_INFO)&select=*&order=received_at.desc&limit=40") || [];
  } catch {}

  // توزيع القنوات — يجيب سؤالاً تشغيلياً: من أين يأتي الشغل فعلاً؟
  const channels = {};
  for (const r of [...requests, ...intakeRows]) {
    const c = r.channel || r.source;
    if (c) channels[c] = (channels[c] || 0) + 1;
  }

  // خطّ الأنابيب: كم صفقة في كل مرحلة وبكم. يُحسب هنا لا في المتصفح لأن
  // اللوحة تعرض أربعين صفاً وقد تكون الصفقات أكثر — فيصير المجموع ناقصاً.
  const pipeline = {};
  let openValue = 0, wonValue = 0, wonCommission = 0;
  for (const d of dealRows) {
    const st = d.stage || "OFFER";
    pipeline[st] = (pipeline[st] || 0) + 1;
    if (st === "CLOSED") { wonValue += Number(d.amount) || 0; wonCommission += Number(d.commission_amount) || 0; }
    else if (st !== "LOST") openValue += Number(d.amount) || 0;
  }

  return {
    db: true,
    counts: { openRequests: openReq, activeListings: activeLst, newMatches, contacts, openDeals: deals, openStudies: studies, inbox },
    pipeline, money: { openValue, wonValue, wonCommission }, channels,
    recent: { requests, listings, matches, messages, deals: dealRows, studies: studyRows, intake: intakeRows },
  };
}

// حقول النموذج تُقرأ صريحة حين تُرسل، ويكمّلها النص الحر — والصريح يفوز
// لأن من اختار من قائمة قال ما يريد بلا لبس.
function pickRequestFields(b) {
  const out = {};
  const map = { property_type: "property_type", city: "city", purpose: "purpose", deed_type: "deed_type", timeline: "timeline", financing: "financing" };
  for (const [k, v] of Object.entries(map)) if (b[v]) out[k] = b[v];
  for (const k of ["area_min", "area_max", "budget_min", "budget_max", "target_yield"]) if (num(b[k]) != null) out[k] = num(b[k]);
  if (b.districts) out.districts = Array.isArray(b.districts) ? b.districts : String(b.districts).split(/[,،]/).map((s) => s.trim()).filter(Boolean);
  if (b.income_producing === true || b.income_producing === "true") out.income_producing = true;
  else if (b.income_producing === false || b.income_producing === "false") out.income_producing = false;
  if (b.notes) out.notes = String(b.notes).slice(0, 2000);
  return out;
}

function pickListingFields(b) {
  const out = {};
  for (const k of ["property_type", "city", "district", "deed_type", "deed_no", "location_url", "offer_kind"]) if (b[k]) out[k] = b[k];
  for (const k of ["area", "price", "annual_income", "yield_pct", "commission_pct"]) if (num(b[k]) != null) out[k] = num(b[k]);
  if (out.price != null && out.area) out.price_per_m = Math.round((out.price / out.area) * 100) / 100;
  if (out.annual_income != null && out.price) out.yield_pct = out.yield_pct != null ? out.yield_pct : Math.round((out.annual_income / out.price) * 10000) / 100;
  if (b.income_producing === true || b.income_producing === "true") out.income_producing = true;
  else if (b.income_producing === false || b.income_producing === "false") out.income_producing = false;
  if (b.exclusive === true || b.exclusive === "true") out.exclusive = true;
  return out;
}

export { CITIES as RE_CITIES, PROPERTY_TYPES as RE_TYPES };
