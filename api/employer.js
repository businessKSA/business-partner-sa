// Business Partner 3.0 — employer subscription intake → Notion (ESM).
// Registers a company that wants to subscribe to the recruitment platform.
// Writes to a Notion "Employers" database if NOTION_EMPLOYERS_DB is set;
// otherwise creates a child page under NOTION_EMPLOYERS_PARENT (defaults to the
// HR & Recruitment Center page) so it works with zero manual DB setup. Always
// returns a reference so the front-end can proceed to payment / bank transfer.
//
// Env vars:
//   NOTION_TOKEN / BusinessPartnerSiteNotion / …  Notion integration secret
//   NOTION_EMPLOYERS_DB       optional database id to store rows in
//   NOTION_EMPLOYERS_PARENT   optional parent page id (default: HR center)
//
// GET  /api/employer                              -> { status, configured }
// POST /api/employer                               -> { ok, ref } | { ok:false, error }   (register/signup)
// POST /api/employer { action:"login", email, password } -> { ok, code, plan, status } | { ok:false, error }
//
// الدفع الإلكتروني للاشتراك (قرار المالك): ثلاث دوال مُصدَّرة يستعملها مسار السلة/الدفع
// (cart-checkout) من الخادم إلى الخادم — لا فعلَ HTTP لها هنا عمداً:
//   getPlanOffer(plan, billing)          السعر الوحيد من site.json (بالهللات)
//   createPendingSubscription({...})     صفٌّ «بانتظار الدفع» + مرجع اشتراك (ليس رمز الوصول)
//   activateSubscription({...})          التفعيل بعد دفعٍ تحقّق منه المنادي لدى مُيسّر/تمارا
// التفعيل بلا دفعٍ مُتحقَّق منه ما زال يدوياً في نوشن بأمر المالك (التعليق الأمني فوق planAr).

import { randomBytes, scryptSync, timingSafeEqual, createHmac, randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getSession } from "./_db.js";

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
const DB_ID = process.env.NOTION_EMPLOYERS_DB || "f1104f8bcc3d4beb84accdbda0aa8322";
const PARENT_PAGE = process.env.NOTION_EMPLOYERS_PARENT || "697adb5a6a734b449f86952203c4faf9";
const NOTION_VERSION = "2022-06-28";

const clip = (s, n = 300) => String(s || "").trim().slice(0, n);
const isEmail = (e) => typeof e === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const PLAN_AR = { basic: "أساسية", pro: "احترافية", enterprise: "مؤسسية" };

// Email (Resend) — optional; activates once RESEND_API_KEY is set in Vercel.
const RESEND_API_KEY = envFrom(["RESEND_API_KEY", "RESEND_KEY", "RESEND"]);
const FROM = process.env.OTP_FROM_EMAIL || "Business Partner <onboarding@resend.dev>";
const NOTIFY = process.env.BP_NOTIFY_EMAIL || "business@businesspartner.sa";

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

async function readBody(req) {
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  if (body && typeof body === "object") return body;
  return await new Promise((resolve) => {
    let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
  });
}

// A short human reference like BP-EMP-3F9K. Mixes in the current time (and a
// random component) so repeat/duplicate registrations never collide on the
// same code — each submission gets its own row and its own access code.
const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function rand12() {
  const bytes = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) out += REF_ALPHABET[bytes[i] % REF_ALPHABET.length];
  return out;
}
function makeRef(_seed) {
  // SECURITY: the access code is the sole bearer token that unlocks all
  // candidate PII once the row is activated, so it must be unguessable. The
  // old 4-char hash (~9.5e5 space, derived deterministically from the form
  // fields) was brute-forceable and predictable — replaced with 12 chars of
  // CSPRNG entropy from a 31-symbol alphabet (~2.5e17 combinations).
  return "BP-EMP-" + rand12();
}

// Salted scrypt hash, stored as "salt:hash" (both hex) in the "بيانات الدخول"
// rich_text property — no external dependency needed (bcrypt isn't in
// package.json and this project stays within Vercel's function count cap by
// not adding npm deps just for this).
function hashPassword(pw) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pw, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(pw, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

async function notion(path, payload) {
  return fetch("https://api.notion.com/v1/" + path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": NOTION_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

// كل استعلامات البريد تمرّ من هنا بترتيبٍ واحد. كانت كلها page_size:1 بلا
// ترتيب، ونوشن لا يضمن ترتيباً بلا `sorts` — فمن سجّل شركته مرّتين بالبريد
// نفسه كان يُسلَّم صفّاً عشوائياً يختلف بين نداءٍ وآخر: يدخل بكلمة مروره
// فتُقبل مرّة وتُرفض مرّة، وتُكتب كلمة المرور الجديدة على صفٍّ ويُقرأ آخر.
// الآن: الصفّ الأقدم دائماً (أول تسجيل)، وهو نفسه الذي يختاره
// employerRowFor في api/candidates.js — فلوحةُ البوابة وشاشةُ الحساب
// تتكلّمان عن شركةٍ واحدة لا عن اثنتين.
const EMAIL_SORT = [{ timestamp: "created_time", direction: "ascending" }];
const byEmail = (email, n = 1) => ({ page_size: n, filter: { property: "البريد", email: { equals: email } }, sorts: EMAIL_SORT });

// وبريد الصفّ نفسه مكتوبٌ بيد إنسان في نوشن: حرفٌ كبير أو مسافةٌ في طرفه
// تُسقط مطابقة `equals` الحرفية، فيُقال لصاحب اشتراكٍ قائم «البريد أو كلمة
// المرور غير صحيحة». فإن خلت الحرفية، يُسأل بـ`contains` (غير حسّاس
// للحالة) وتُحسم المطابقة هنا بحروفٍ صغيرة — البريد نفسه بعينه لا بريدٌ
// يحتويه. يُعاد null عند تعذّر السؤال، وهو غير المصفوفة الفارغة.
async function rowsByEmail(email, n = 1) {
  let q = await notion(`databases/${DB_ID}/query`, byEmail(email, n));
  if (!q.ok) return null;
  let rows = ((await q.json()).results || []);
  if (rows.length) return rows;
  q = await notion(`databases/${DB_ID}/query`, { page_size: Math.max(n, 10), filter: { property: "البريد", email: { contains: email } }, sorts: EMAIL_SORT });
  if (!q.ok) return null;
  return ((await q.json()).results || [])
    .filter((pg) => {
      const p = pg.properties && pg.properties["البريد"];
      return String((p && p.email) || "").trim().toLowerCase() === email;
    })
    .slice(0, n);
}

const rt = (v) => (v ? [{ text: { content: clip(v, 1800) } }] : []);
// Reads a Notion property's plain text regardless of its underlying type
// (title/rich_text default to the "rich_text"/"title" array shape; select
// properties need the explicit type hint since their shape differs).
function txtProp(p, type) {
  if (!p) return "";
  if (type === "select") return (p.select && p.select.name) || "";
  if (type === "title") return (p.title || []).map((t) => t.plain_text).join("");
  return (p.rich_text || []).map((t) => t.plain_text).join("");
}

// ════════════════════════════════════════════════════════════════════════════
// الاشتراك بالدفع الإلكتروني (مُيسّر + تمارا عبر السلة/الدفع)
// ════════════════════════════════════════════════════════════════════════════
// العقد مع مسار الدفع (cart-checkout). كل ما هنا من الخادم إلى الخادم؛ **لا فعلَ
// HTTP يستدعي activateSubscription** — المنادي هو من يتحقّق من الدفع لدى المزوّد
// (حالة paid ومبلغه) ثم يمرّر paymentRef. ما يصل هنا من المتصفّح لا يُصدَّق أبداً.
//
// • المرجع (reference) ليس رمز الوصول. رمز الوصول هو الرمز الحامل الذي يفتح بيانات
//   المرشحين، فلا يخرج من هذا الملف إلى سلةٍ ولا بياناتٍ وصفية لدفعةٍ ولا ردّ.
//   المرجع «BP-EMPSUB-» + اثنا عشر رمزاً عشوائياً، يُحفظ في عمود «ملاحظات» (لا عمود
//   جديد في نوشن: تغيير مخطّط قاعدة حيّة قرار مالك) بسطرٍ لكل نيّة اشتراك:
//       اشتراك إلكتروني | <المرجع> | <الباقة> | <الفوترة>
//   وكل دفعةٍ مُفعِّلة بسطر:
//       دفعة | <paymentRef> | <المرجع> | <التاريخ>
//   هذا السجل هو ما يجعل التفعيل idempotent: نفس paymentRef لا يمدّد مرّتين، ويعيد
//   {ok:true, activated:true, code:"already_processed"} — «activated» هنا حالة الحساب
//   (مفعّلٌ بهذه الدفعة) لا «فعلُ هذا النداء»، فرجوع المتصفّح بعد الخطّاف ليس فشلاً.
//   وحقل code في كل ردّ **سببٌ نصّي** (amount_mismatch…)، لا رمز وصول أبداً.
// • الصف الموقوف («موقوف») لا يُفعَّل ولا يُجدَّد آلياً أبداً: إيقافه قرار مالك.
// • الدفع لا يُنزل صفّاً مفعّلاً إلى «بانتظار الدفع» أبداً (تجديد/ترقية صاحب
//   اشتراكٍ قائم): الصف المفعّل يبقى كما هو حتى تصل دفعةٌ مُتحقَّق منها.
// • فشل نوشن = {ok:false}، لا استثناء ولا نجاحٌ كاذب.
const PAYABLE_PLANS = ["basic", "pro"];          // enterprise عرض سعر، لا دفع
const BILLINGS = ["monthly", "yearly"];
const SUB_SKU = {
  basic: { monthly: "BP-EMP-BASIC-M", yearly: "BP-EMP-BASIC-Y" },
  pro: { monthly: "BP-EMP-PRO-M", yearly: "BP-EMP-PRO-Y" },
};
const BILLING_AR = { monthly: "شهري", yearly: "سنوي" };
const STATUS_ACTIVE = "مفعّل", STATUS_PENDING = "بانتظار الدفع", STATUS_SUSPENDED = "موقوف";
const SUBREF_RE = /^BP-EMPSUB-[A-HJ-NP-Z2-9]{12}$/;
const PAYREF_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{5,99}$/;
const L_INTENT = "اشتراك إلكتروني", L_PAY = "دفعة";
const KEEP_PAYS = 14, KEEP_INTENTS = 5, NOTES_MAX = 1800;

// الأسعار من site.json وحده (employerPlans) — لا رقم مكتوباً هنا. تعذّر القراءة
// = لا عرض = لا تفعيل (يُغلق ولا يُفتح).
const EMP_PLANS = (() => {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const d = JSON.parse(readFileSync(join(here, "..", "site", "data", "site.json"), "utf8"));
    return (d && d.employerPlans) || null;
  } catch { return null; }
})();

// يعيد null لما لا يُباع بالدفع الإلكتروني (enterprise، باقة مجهولة، فوترة مجهولة،
// أو بياناتٌ ناقصة). السنوي = الشهري × ١٢ × (١ − الخصم)، بالهللات وتقريبٌ واحد.
export function getPlanOffer(plan, billing) {
  if (!PAYABLE_PLANS.includes(plan) || !BILLINGS.includes(billing) || !EMP_PLANS) return null;
  const tier = (EMP_PLANS.tiers || []).find((t) => t && t.key === plan);
  const price = Number(tier && tier.price);
  if (!Number.isFinite(price) || price <= 0) return null;
  if ((EMP_PLANS.currency || "SAR") !== "SAR") return null;
  const discount = Number(EMP_PLANS.yearlyDiscount || 0);
  if (!Number.isFinite(discount) || discount < 0 || discount >= 1) return null;
  const monthly = Math.round(price * 100);
  const amountHalalas = billing === "yearly" ? Math.round(monthly * 12 * (1 - discount)) : monthly;
  return { amountHalalas, currency: "SAR", plan, billing, sku: SUB_SKU[plan][billing] };
}

// SKU ← → (باقة، فوترة): لمنادي الدفع الذي يصله من السلة SKU فقط.
export function parseEmployerSku(sku) {
  for (const plan of PAYABLE_PLANS) for (const billing of BILLINGS) {
    if (SUB_SKU[plan][billing] === sku) return { plan, billing };
  }
  return null;
}

function parseNotes(text) {
  const free = [], intents = [], pays = [];
  for (const raw of String(text || "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const f = line.split("|").map((x) => x.trim());
    if (f[0] === L_INTENT && f.length === 4 && SUBREF_RE.test(f[1]) && PAYABLE_PLANS.includes(f[2]) && BILLINGS.includes(f[3])) {
      intents.push({ ref: f[1], plan: f[2], billing: f[3] });
    } else if (f[0] === L_PAY && f.length === 4 && PAYREF_RE.test(f[1]) && SUBREF_RE.test(f[2])) {
      pays.push({ paymentRef: f[1], ref: f[2], date: f[3] });
    } else free.push(line);
  }
  return { free, intents, pays };
}
// الدفعات أولاً ثم النيّات ثم النص الحرّ: إن اضطُرّ القصّ عند ١٨٠٠ حرف سقط الحرّ
// قبل أي سطرٍ يحمل idempotency.
function serializeNotes({ free, intents, pays }) {
  const lines = [
    ...pays.slice(-KEEP_PAYS).map((p) => `${L_PAY} | ${p.paymentRef} | ${p.ref} | ${p.date}`),
    ...intents.slice(-KEEP_INTENTS).map((i) => `${L_INTENT} | ${i.ref} | ${i.plan} | ${i.billing}`),
  ];
  const head = lines.join("\n");
  const room = NOTES_MAX - head.length - 1;
  const rest = room > 0 ? free.join("\n").slice(0, room) : "";
  return rest ? head + "\n" + rest : head;
}

const notionJson = async (path, payload, method = "POST") => {
  const r = await fetch("https://api.notion.com/v1/" + path, {
    method,
    headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return r;
};
const subReady = () => !!(NOTION_TOKEN && DB_ID);
const rowsByNotes = async (needle) => {
  const q = await notion(`databases/${DB_ID}/query`, {
    page_size: 10, filter: { property: "ملاحظات", rich_text: { contains: needle } }, sorts: EMAIL_SORT,
  });
  if (!q.ok) return null;
  return (await q.json()).results || [];
};
const rowNotes = (pg) => txtProp(pg.properties && pg.properties["ملاحظات"]);
const rowStatus = (pg) => txtProp(pg.properties && pg.properties["الحالة"], "select");

export async function createPendingSubscription({ email, company, plan, billing } = {}) {
  if (plan === "enterprise") return { ok: false, code: "enterprise_quote_only" };
  if (!PAYABLE_PLANS.includes(plan)) return { ok: false, code: "invalid_plan" };
  if (!BILLINGS.includes(billing)) return { ok: false, code: "invalid_billing" };
  const mail = clip(email, 160).toLowerCase();
  if (!isEmail(mail)) return { ok: false, code: "invalid_email" };
  if (!getPlanOffer(plan, billing)) return { ok: false, code: "price_unavailable" };
  if (!subReady()) return { ok: false, code: "not_configured" };
  try {
    const rows = await rowsByEmail(mail, 10);
    if (!rows) return { ok: false, code: "notion_error" };
    if (rows.some((pg) => rowStatus(pg) === STATUS_SUSPENDED)) return { ok: false, code: "suspended" };
    const row = rows.find((pg) => rowStatus(pg) === STATUS_ACTIVE) || rows[0] || null;
    const intent = { plan, billing };

    if (!row) {
      const ref = "BP-EMPSUB-" + rand12();
      const co = clip(company, 200) || mail;
      const r = await notionJson("pages", {
        parent: { database_id: DB_ID },
        properties: {
          "اسم الشركة": { title: [{ text: { content: co } }] },
          "البريد": { email: mail },
          "الحالة": { select: { name: STATUS_PENDING } },
          "رمز الوصول": { rich_text: rt(makeRef()) },
          "الباقة": { select: { name: PLAN_AR[plan] } },
          "الفوترة": { select: { name: BILLING_AR[billing] } },
          "ملاحظات": { rich_text: rt(serializeNotes({ free: [], pays: [], intents: [{ ref, ...intent }] })) },
        },
      });
      if (!r.ok) { console.error("sub create", r.status, (await r.text()).slice(0, 200)); return { ok: false, code: "notion_error" }; }
      return { ok: true, reference: ref, renewal: false };
    }

    const notes = parseNotes(rowNotes(row));
    const renewal = rowStatus(row) === STATUS_ACTIVE;
    const paid = new Set(notes.pays.map((p) => p.ref));
    const same = notes.intents.find((i) => i.plan === plan && i.billing === billing && !paid.has(i.ref));
    if (same) return { ok: true, reference: same.ref, renewal };

    const ref = "BP-EMPSUB-" + rand12();
    notes.intents.push({ ref, ...intent });
    const props = { "ملاحظات": { rich_text: rt(serializeNotes(notes)) } };
    // الصف غير المدفوع يعرض ما ينوي شراءه؛ الصف المفعّل لا يُمسّ بابه قبل الدفع.
    if (!renewal) {
      props["الباقة"] = { select: { name: PLAN_AR[plan] } };
      props["الفوترة"] = { select: { name: BILLING_AR[billing] } };
    }
    const u = await notionJson(`pages/${row.id}`, { properties: props }, "PATCH");
    if (!u.ok) { console.error("sub intent patch", u.status, (await u.text()).slice(0, 200)); return { ok: false, code: "notion_error" }; }
    return { ok: true, reference: ref, renewal };
  } catch (e) {
    console.error("createPendingSubscription", String(e).slice(0, 200));
    return { ok: false, code: "notion_error" };
  }
}

const isoDay = (d) => d.toISOString().slice(0, 10);
function addMonths(day, n) {
  const d = new Date(day + "T00:00:00Z");
  const dom = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dom, last));
  return isoDay(d);
}
const escHtml = (s) => String(s || "").replace(/[<>&"]/g, "");

export async function activateSubscription({ reference, paymentRef, amountHalalas, billing, now = Date.now() } = {}) {
  const no = (code) => ({ ok: false, activated: false, code });
  // لا تفعيلَ بلا دفعٍ صالح — أول فحصٍ وقبل أي اتصال.
  if (typeof paymentRef !== "string" || !paymentRef.trim()) return no("payment_ref_required");
  paymentRef = paymentRef.trim();
  if (!PAYREF_RE.test(paymentRef)) return no("invalid_payment_ref");
  if (typeof reference !== "string" || !SUBREF_RE.test(reference)) return no("invalid_reference");
  if (!BILLINGS.includes(billing)) return no("invalid_billing");
  if (!subReady()) return no("not_configured");
  try {
    // ١) هل عولجت هذه الدفعة؟ (بحثٌ في القاعدة كلها لا في صفّ المرجع وحده)
    const seen = await rowsByNotes(paymentRef);
    if (!seen) return no("notion_error");
    for (const pg of seen) {
      const hit = parseNotes(rowNotes(pg)).pays.find((p) => p.paymentRef === paymentRef);
      if (hit) return hit.ref === reference ? { ok: true, activated: true, code: "already_processed" } : no("payment_ref_reused");
    }
    // ٢) صفّ المرجع ونيّته
    const found = await rowsByNotes(reference);
    if (!found) return no("notion_error");
    let row = null, notes = null, intent = null;
    for (const pg of found) {
      const n = parseNotes(rowNotes(pg));
      const i = n.intents.find((x) => x.ref === reference);
      if (i) { row = pg; notes = n; intent = i; break; }
      if (n.pays.some((p) => p.ref === reference)) return no("reference_already_paid");
    }
    if (!row) return no("unknown_reference");
    // ٣) الباقة من النيّة المحفوظة لا من المنادي؛ enterprise لا يُدفع أبداً
    if (intent.plan === "enterprise") return no("enterprise_quote_only");
    if (intent.billing !== billing) return no("billing_mismatch");
    const offer = getPlanOffer(intent.plan, intent.billing);
    if (!offer) return no("price_unavailable");
    if (!Number.isInteger(amountHalalas) || amountHalalas !== offer.amountHalalas) return no("amount_mismatch");
    const status = rowStatus(row);
    if (status === STATUS_SUSPENDED) return no("suspended");

    // ٤) المدّة: تجديد نفس الباقة يمتدّ من نهاية المدّة الجارية، وما عداه من اليوم
    const today = isoDay(new Date(now));
    const p = row.properties || {};
    const cur = (p["تاريخ التفعيل"] && p["تاريخ التفعيل"].date) || {};
    const samePlan = txtProp(p["الباقة"], "select") === PLAN_AR[intent.plan];
    const running = status === STATUS_ACTIVE && samePlan && cur.end && cur.end >= today;
    const start = running && cur.start ? cur.start : today;
    const end = addMonths(running ? cur.end : today, intent.billing === "yearly" ? 12 : 1);

    notes.intents = notes.intents.filter((x) => x.ref !== reference);
    notes.pays.push({ paymentRef, ref: reference, date: today });
    const props = {
      "الحالة": { select: { name: STATUS_ACTIVE } },
      "الباقة": { select: { name: PLAN_AR[intent.plan] } },
      "الفوترة": { select: { name: BILLING_AR[intent.billing] } },
      "تاريخ التفعيل": { date: { start, end } },
      "ملاحظات": { rich_text: rt(serializeNotes(notes)) },
    };
    // صفٌّ مفعّل بلا رمز وصول لوحةٌ تُفتح على لا شيء (حدث بـBP-HOUSE).
    if (!txtProp(p["رمز الوصول"])) props["رمز الوصول"] = { rich_text: rt(makeRef()) };
    const u = await notionJson(`pages/${row.id}`, { properties: props }, "PATCH");
    if (!u.ok) { console.error("sub activate patch", u.status, (await u.text()).slice(0, 200)); return no("notion_error"); }

    // إشعارٌ best-effort بلا رمز وصول: يدخل ببريده كما يدخل كل مشترك.
    const co = escHtml(txtProp(p["اسم الشركة"], "title")), mail = (p["البريد"] && p["البريد"].email) || "";
    await Promise.allSettled([
      sendMail(mail, "تم تفعيل اشتراكك — Business Partner", `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
        <h2 style="color:#0B1B5A">اشتراكك مفعّل</h2>
        <p>تم تفعيل باقة <strong>${PLAN_AR[intent.plan]}</strong> (${BILLING_AR[intent.billing]}) حتى ${end}.</p>
        <p>ادخل <a href="https://www.businesspartner.sa/ar/employer">بوابة صاحب العمل</a> ببريدك هذا — يصلك رمزٌ لمرة واحدة.</p></div>`),
      sendMail(NOTIFY, `تفعيل اشتراك مدفوع: ${co}`, `<p>${co} — ${PLAN_AR[intent.plan]} (${BILLING_AR[intent.billing]}) حتى ${end}. المرجع ${reference}.</p>`),
    ]);
    return { ok: true, activated: true };
  } catch (e) {
    console.error("activateSubscription", String(e).slice(0, 200));
    return no("notion_error");
  }
}


export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "GET") {
    return res.end(JSON.stringify({ status: "ok", configured: !!NOTION_TOKEN, store: DB_ID ? "database" : "page" }));
  }
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: "method_not_allowed" }));
  }

  const b = await readBody(req);

  // Stateless password reset: step 1 emails a 6-digit code and returns an
  // HMAC-sealed token (email|code|exp — verifying requires the code, so the
  // token is safe client-side). Step 2 verifies code+token and stores the new
  // scrypt hash. Responses never reveal whether an email is registered.
  if (b.action === "reset-password") {
    const email = clip(b.email, 160).toLowerCase();
    const SECRET = (process.env.OTP_SECRET || "").trim();
    if (!isEmail(email)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_email" })); }
    if (!SECRET || !NOTION_TOKEN || !DB_ID) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "not_configured" })); }
    const sealOf = (exp, code) => createHmac("sha256", SECRET).update(`emp-reset|${email}|${code}|${exp}`).digest("hex");
    const code = String(b.code || "").trim();
    const token = String(b.t || "").trim();
    const newPassword = String(b.password || "").slice(0, 200);
    if (!code || !token) {
      // step 1 — send the code
      try {
        const rows = await rowsByEmail(email);
        if (rows) {
          const row = rows[0];
          if (row) {
            const c = String(randomInt(100000, 1000000));
            const exp = Date.now() + 15 * 60 * 1000;
            await sendMail(email, `رمز استعادة كلمة المرور — Business Partner`, `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
              <h2 style="color:#0B1B5A">استعادة كلمة المرور</h2>
              <p>رمز الاستعادة الخاص بك (صالح 15 دقيقة):</p>
              <p style="font-size:28px;font-weight:bold;letter-spacing:3px;color:#0B1B5A">${c}</p>
              <p style="color:#666">إذا لم تطلب استعادة كلمة المرور، تجاهل هذه الرسالة.</p>
            </div>`);
            res.statusCode = 200;
            return res.end(JSON.stringify({ ok: true, t: `${exp}.${sealOf(exp, c)}`, message: "إذا كان البريد مسجلاً لدينا فسيصلك رمز الاستعادة خلال دقائق." }));
          }
        }
      } catch (e) { console.error("reset send error", String(e).slice(0, 200)); }
      // same shape whether or not the account exists (dummy token)
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, t: `${Date.now() + 15 * 60 * 1000}.${randomBytes(32).toString("hex")}`, message: "إذا كان البريد مسجلاً لدينا فسيصلك رمز الاستعادة خلال دقائق." }));
    }
    // step 2 — verify and set the new password
    if (!newPassword || newPassword.length < 8) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "weak_password" })); }
    const dot = token.indexOf(".");
    const exp = dot > 0 ? Number(token.slice(0, dot)) : 0;
    const mac = dot > 0 ? token.slice(dot + 1) : "";
    const expected = sealOf(exp, code);
    const macBuf = Buffer.from(mac.padEnd(expected.length, "0").slice(0, expected.length), "utf8");
    const expBuf = Buffer.from(expected, "utf8");
    if (!exp || Date.now() > exp || !timingSafeEqual(macBuf, expBuf)) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ ok: false, error: "invalid_code", message: "الرمز غير صحيح أو انتهت صلاحيته." }));
    }
    try {
      const rows = await rowsByEmail(email);
      if (!rows) throw new Error("notion_failed");
      const row = rows[0];
      if (!row) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: "not_found" })); }
      const u = await fetch(`https://api.notion.com/v1/pages/${row.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
        body: JSON.stringify({ properties: { "بيانات الدخول": { rich_text: rt(hashPassword(newPassword)) } } }),
      });
      if (!u.ok) throw new Error("notion_failed");
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, message: "تم تعيين كلمة المرور الجديدة — سجّل دخولك بها الآن." }));
    } catch (e) {
      console.error("reset set error", String(e).slice(0, 200));
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "server_error" }));
    }
  }

  // تغيير رقم الجوال من قائمة الحساب في البوابة. لم يكن له فعلٌ إطلاقاً قبل
  // اليوم، والبديل الوحيد المقبول لغيابه هو عرض الحقل للقراءة — لا واجهةٌ
  // تَعِد بزرٍّ لا يعمل.
  //
  // المصادقة بالجلسة وحدها: البريد يُقرأ من جلسة Business Partner (api/otp.js
  // أثبت ملكيته برمزٍ لمرة واحدة) ولا يُقبل من العميل بحال، فلا يستطيع أحد
  // تحريك رقم شركةٍ غير شركته. ولا يُطلب رمز الوصول هنا ولا يُعاد في الردّ.
  if (b.action === "update-phone") {
    const phone = clip(b.phone, 40);
    if (!/^\+?[\d][\d\s()-]{6,}$/.test(phone)) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: "invalid_phone" }));
    }
    if (!NOTION_TOKEN || !DB_ID) {
      res.statusCode = 503;
      return res.end(JSON.stringify({ ok: false, error: "not_configured" }));
    }
    let email = "";
    try {
      const sess = await getSession(req);
      email = String((sess && sess.user && sess.user.email) || "").toLowerCase();
    } catch (e) { console.error("update-phone session error", String(e).slice(0, 200)); }
    if (!isEmail(email)) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ ok: false, error: "not_signed_in" }));
    }
    try {
      const rows = await rowsByEmail(email);
      if (!rows) { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_error" })); }
      const row = rows[0];
      if (!row) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: "not_found" })); }
      const u = await fetch(`https://api.notion.com/v1/pages/${row.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
        body: JSON.stringify({ properties: { "الجوال": { phone_number: phone } } }),
      });
      if (!u.ok) { console.error("update-phone patch", u.status, (await u.text()).slice(0, 200)); res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_error" })); }
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, phone }));
    } catch (e) {
      console.error("update-phone error", String(e).slice(0, 200));
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false, error: "server_error" }));
    }
  }

  // قراءة بيانات الحساب لقائمة الحساب (الشركة، البريد، الجوال) — بالجلسة
  // وحدها، وبلا رمز وصول في الردّ.
  if (b.action === "account") {
    if (!NOTION_TOKEN || !DB_ID) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "not_configured" })); }
    let email = "";
    try {
      const sess = await getSession(req);
      email = String((sess && sess.user && sess.user.email) || "").toLowerCase();
    } catch (e) { console.error("account session error", String(e).slice(0, 200)); }
    if (!isEmail(email)) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "not_signed_in" })); }
    try {
      const rows = await rowsByEmail(email);
      if (!rows) { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_error" })); }
      const row = rows[0];
      if (!row) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: "not_found" })); }
      const p = row.properties || {};
      res.statusCode = 200;
      return res.end(JSON.stringify({
        ok: true, email,
        company: txtProp(p["اسم الشركة"], "title"),
        contact: txtProp(p["جهة الاتصال"]),
        phone: (p["الجوال"] && p["الجوال"].phone_number) || "",
        plan: txtProp(p["الباقة"], "select"),
        status: txtProp(p["الحالة"], "select"),
        hasPassword: !!(p["بيانات الدخول"] && p["بيانات الدخول"].rich_text && p["بيانات الدخول"].rich_text.length),
      }));
    } catch (e) {
      console.error("account error", String(e).slice(0, 200));
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false, error: "server_error" }));
    }
  }

  if (b.action === "login") {
    const email = clip(b.email, 160).toLowerCase();
    const password = String(b.password || "");
    if (!isEmail(email) || !password) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: "invalid_fields" }));
    }
    if (!NOTION_TOKEN || !DB_ID) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false, error: "not_configured" }));
    }
    try {
      // عشرة صفوف لا صفّ: من سجّل شركته مرّتين بالبريد نفسه كانت كلمة مروره
      // تُقارَن بصفٍّ واحد يُختار عشوائياً — فتُرفض كلمةٌ صحيحة لأن الصفّ
      // المُسلَّم لا يحمل تجزئتها أو لا يحمل كلمة مرور أصلاً. يُجرَّب الصفوف
      // بالترتيب، ويدخل الصفّ الذي تُطابقه كلمته هو. لا توسيع في الصلاحية:
      // الدخول ما زال يحتاج كلمة مرور صحيحة لصفٍّ ببريده هو.
      const rows = await rowsByEmail(email, 10);
      if (!rows) { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_error" })); }
      let row = null;
      for (const pg of rows) {
        const stored = pg.properties && pg.properties["بيانات الدخول"];
        const storedHash = stored && stored.rich_text && stored.rich_text[0] && stored.rich_text[0].plain_text;
        if (storedHash && verifyPassword(password, storedHash)) { row = pg; break; }
      }
      if (!row) {
        res.statusCode = 401;
        return res.end(JSON.stringify({ ok: false, error: "invalid_credentials" }));
      }
      const code = txtProp(row.properties["رمز الوصول"]);
      const status = txtProp(row.properties["الحالة"], "select");
      const plan = txtProp(row.properties["الباقة"], "select");
      const company = txtProp(row.properties["اسم الشركة"], "title");
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, code, plan, status, company }));
    } catch (e) {
      console.error("employer login error", String(e).slice(0, 200));
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false, error: "server_error" }));
    }
  }
  // «أرسل رمزي إلى بريدي» — emails the registered access code to the
  // account's own email address. The response is identical whether or not
  // the email exists, so this can't be used to probe which emails are
  // registered; the code only ever travels to the address stored in Notion.
  if (b.action === "send-code") {
    const email = clip(b.email, 160).toLowerCase();
    if (!isEmail(email)) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: "invalid_email" }));
    }
    if (!NOTION_TOKEN || !DB_ID) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false, error: "not_configured" }));
    }
    try {
      const rows = await rowsByEmail(email);
      if (rows) {
        const row = rows[0];
        const code = row ? txtProp(row.properties["رمز الوصول"]) : "";
        const company = (row ? txtProp(row.properties["اسم الشركة"], "title") : "").replace(/[<>&]/g, "");
        if (code) {
          await sendMail(email, `رمز الوصول: ${code} — Business Partner`, `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
            <h2 style="color:#0B1B5A">رمز الوصول للوحة التوظيف</h2>
            <p>${company ? "حساب: " + company + "<br>" : ""}رمز الوصول الخاص بك هو:</p>
            <p style="font-size:28px;font-weight:bold;letter-spacing:3px;color:#0B1B5A">${code}</p>
            <p><b>الأسهل:</b> افتح <a href="https://www.businesspartner.sa/ar/employer">بوابة صاحب العمل</a> واكتب هذا البريد نفسه — يصلك رمزٌ لمرة واحدة وتدخل بلا حاجة إلى الرمز أعلاه.</p>
            <p>والرمز أعلاه لصفحة تصفّح المرشحين: <a href="https://www.businesspartner.sa/ar/employers?code=${encodeURIComponent(code)}">افتحها به مباشرة</a>.</p>
            <p style="color:#666">إذا لم تطلب هذا الرمز، تجاهل هذه الرسالة.</p>
          </div>`);
        }
      }
    } catch (e) { console.error("send-code error", String(e).slice(0, 200)); }
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, message: "إذا كان البريد مسجلاً لدينا فسيصلك رمز الوصول خلال دقائق." }));
  }

  const company = clip(b.company, 200);
  const cr = clip(b.cr, 60);
  const contact = clip(b.contact, 160);
  const email = clip(b.email, 160).toLowerCase();
  const phone = clip(b.phone, 40);
  const password = String(b.password || "").slice(0, 200);
  const planKey = ["basic", "pro", "enterprise"].includes(b.plan) ? b.plan : "";
  const billing = b.billing === "yearly" ? "سنوي" : "شهري";
  // سطرٌ واحد: «ملاحظات» تحمل أيضاً سجلّ الدفع الإلكتروني (سطراً لكل دفعة)، فلا
  // يُسمح لتسجيلٍ عام بأن يكتب أسطراً يحاكي بها ذلك السجل.
  const notes = clip(b.notes, 600).replace(/[\r\n|]+/g, " ");

  // SECURITY: registration is fully unauthenticated, so no email value may
  // grant an instantly-active subscription — matching a well-known owner email
  // was a full auth bypass (anyone POSTing that email received an ACTIVE code
  // that unlocks all candidate PII). Every registration is now created as
  // "بانتظار الدفع" and is activated only by flipping the row to "مفعّل" in
  // Notion (the same manual step the confirmation screen already instructs).
  // An operator email may still be set via OWNER_EMAIL purely to auto-assign
  // the enterprise plan LABEL — it never activates access on its own.
  const OWNER_EMAIL = (process.env.OWNER_EMAIL || "").toLowerCase();
  const isOwner = !!OWNER_EMAIL && email === OWNER_EMAIL;
  const planAr = isOwner ? PLAN_AR.enterprise : (PLAN_AR[planKey] || "");

  if (!company || !phone) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: "invalid_fields" }));
  }
  if (password && password.length < 8) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: "weak_password" }));
  }

  const ref = makeRef(company + phone + email);

  if (!NOTION_TOKEN) {
    // Not connected yet — still hand back a reference so the flow continues.
    return res.end(JSON.stringify({ ok: true, ref, stored: false }));
  }

  try {
    let r;
    if (DB_ID) {
      const props = {
        "اسم الشركة": { title: [{ text: { content: company } }] },
        "الجوال": { phone_number: phone },
        "الحالة": { select: { name: "بانتظار الدفع" } },
        "رمز الوصول": { rich_text: rt(ref) },
      };
      if (cr) props["السجل التجاري"] = { rich_text: rt(cr) };
      if (contact) props["جهة الاتصال"] = { rich_text: rt(contact) };
      if (isEmail(email)) props["البريد"] = { email };
      if (password) props["بيانات الدخول"] = { rich_text: rt(hashPassword(password)) };
      if (planAr) props["الباقة"] = { select: { name: planAr } };
      props["ملاحظات"] = { rich_text: rt((notes ? notes + " — " : "") + `الفوترة: ${billing}`) };
      r = await notion("pages", { parent: { database_id: DB_ID }, properties: props });
    } else {
      // No dedicated DB: create a child page under the HR center page.
      const line = (label, val) => ({
        object: "block", type: "bulleted_list_item",
        bulleted_list_item: { rich_text: [{ type: "text", text: { content: `${label}: ${val}` } }] },
      });
      const children = [
        line("رمز الوصول", ref),
        line("الباقة", planAr || "—"),
        line("الفوترة", billing),
        line("جهة الاتصال", contact || "—"),
        line("الجوال", phone),
        line("البريد", email || "—"),
        line("السجل التجاري", cr || "—"),
        line("الحالة", "بانتظار الدفع"),
      ];
      if (notes) children.push(line("ملاحظات", notes));
      r = await notion("pages", {
        parent: { page_id: PARENT_PAGE },
        icon: { type: "emoji", emoji: "🏢" },
        properties: { title: [{ text: { content: `${company} — اشتراك صاحب عمل (${ref})` } }] },
        children,
      });
    }
    if (!r.ok) {
      const errText = (await r.text()).slice(0, 400);
      console.error("Notion employer create error", r.status, errText);
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "notion_error", ref }));
    }

    // Notify the company (with its access code) and the BP team. Best-effort.
    const brand = "#0B1B5A";
    const coHtml = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#111">
      <h2 style="color:${brand}">تم استلام تسجيلك — Business Partner</h2>
      <p>مرحباً${contact ? " " + contact : ""}،</p>
      <p>سجّلنا اشتراك <strong>${company}</strong>${planAr ? ` في الباقة <strong>${planAr}</strong> (${billing})` : ""} في منصة التوظيف.</p>
      <p>رمز وصولك:</p>
      <p style="font-size:24px;font-weight:bold;letter-spacing:3px;color:${brand}">${ref}</p>
      <p>يُفعّل هذا الرمز فور تأكيد الدفع، وبعدها تدخل <a href="https://www.businesspartner.sa/ar/employer">بوابة صاحب العمل</a> ببريدك هذا — يصلك رمزٌ لمرة واحدة، ولا تحتاج أن تحمل رمز الوصول معك — وتتصفّح المرشّحين ببياناتهم الكاملة.</p>
      <p style="color:#666">لأي استفسار: واتساب 966507034157+</p>
    </div>`;
    const bpHtml = `<div style="font-family:Arial,sans-serif">
      <h3>طلب اشتراك صاحب عمل جديد (${ref})</h3>
      <ul>
        <li>الشركة: ${company}</li><li>الباقة: ${planAr || "—"} (${billing})</li>
        <li>المسؤول: ${contact || "—"}</li><li>الجوال: ${phone}</li><li>البريد: ${email || "—"}</li>
        <li>السجل: ${cr || "—"}</li>${notes ? `<li>ملاحظات: ${notes}</li>` : ""}
      </ul>
      <p>لتفعيل الوصول بعد تأكيد الدفع: افتح صف الشركة في قاعدة «أصحاب العمل — الاشتراكات» في Notion وغيّر <strong>الحالة</strong> إلى «مفعّل». يعمل الرمز <strong>${ref}</strong> فوراً بلا إعادة نشر.</p>
    </div>`;
    await Promise.allSettled([
      sendMail(email, `رمز وصولك ${ref} — Business Partner`, coHtml),
      sendMail(NOTIFY, `اشتراك صاحب عمل جديد: ${company} (${ref})`, bpHtml),
    ]);

    return res.end(JSON.stringify({ ok: true, ref, stored: true }));
  } catch (e) {
    console.error("employer handler error", String(e).slice(0, 200));
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "server_error", ref }));
  }
}
