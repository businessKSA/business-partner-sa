// Business Partner — recruitment-provider registry + provider portal (ESM).
//
// Recruitment offices and agencies (mostly outside Saudi Arabia) sign
// themselves up — e-mail + password or Google — and land straight in their own
// control panel. There is no approval queue: the profile questions are asked
// inside the portal after the account exists, the way provider onboarding works
// on the global platforms. The owner panel can still suspend an office.
//
// Notion, under "HR & Recruitment Center":
//   Agencies         — one row per provider: profile, fees, access code and a
//                      running count of the candidates it has supplied.
//   AgencyRequests   — one demand order per requirement. An office sees the
//                      orders addressed to it plus any marked open to all.
// Candidates go into the one shared ATS database (the same pool the site and
// the employer console read), tagged with مكتب الاستقدام / مسؤول المكتب /
// مهنة الترشيح so every office can be counted and viewed on its own. None of
// those columns is rendered publicly, so a candidate appears on the site with
// no trace of the office that supplied them.
//
// Routes (all under /api/agencies, rewritten to /api/requests?__route=agencies)
//   POST {type:"signup", name, email, password}   public  — create an account
//   POST {type:"login", email, password|code}     office  — returns its profile
//   POST {type:"google", credential}              public  — sign in / sign up
//   POST {type:"email-code" | "email-verify"}     office  — code by e-mail
//   POST {type:"save-profile", ...}               office  — onboarding answers
//   POST {type:"register", ...}                   public  — one-shot sign-up
//   GET  ?action=requests&email=&code=            office  — demand + open jobs
//   GET  ?action=submissions&email=&code=         office  — candidates it sent
//   POST {type:"submit-candidate", ...}           office  — send a candidate
//   GET  ?action=admin&key=                       owner   — registry + requests
//   POST {type:"approve", key, id, decision}      owner   — suspend / reinstate
//   POST {type:"create-request" | "request-status", key, ...}  owner
//
// Env: NOTION_TOKEN, RESEND_API_KEY, OTP_FROM_EMAIL, BP_NOTIFY_EMAIL,
//      PANEL_KEY/LEADS_KEY (owner actions), GOOGLE_CLIENT_ID, OTP_SECRET,
//      NOTION_AGENCIES_DB, NOTION_AGENCY_REQUESTS_DB, NOTION_ATS_DB.
//
// Underscore-prefixed so Vercel treats it as a module, not another serverless
// function — the plan caps at 12 and this repo is at the cap.

import { randomBytes, scryptSync, timingSafeEqual, createHmac, randomInt } from "crypto";
import { verifyGoogleIdToken, uploadToNotion } from "./_suppliers.js";
import { nafathPing } from "./_nafath.js";
// The agency portal runs candidates through the SAME pipeline as the site's own
// intake — n8n reads the attached CV, files it on Drive, writes an ATS-friendly
// version and screens it — so an agency profile lands in the pool as clean,
// structured data rather than a hand-typed row.
import { forwardToN8n, applyN8nEnrichment, findExisting, guessField } from "./candidate.js";

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
const NOTION_VERSION = "2022-06-28";
const AGENCIES_DB = process.env.NOTION_AGENCIES_DB || "32f564a5c1dd4370b5af6567c27eee40";
const REQUESTS_DB = process.env.NOTION_AGENCY_REQUESTS_DB || "9023896619e24c7592d97fbd43dda7f9";
const ATS_DB = process.env.NOTION_ATS_DB || "71792742873e4de398135c7855542b95";
const JOBS_DB = process.env.NOTION_JOBS_DB || "260d76959d464631943f79f313fbf3c9";
const RESEND_API_KEY = envFrom(["RESEND_API_KEY", "RESEND_KEY", "RESEND"]);
const FROM = process.env.OTP_FROM_EMAIL || "Business Partner <onboarding@resend.dev>";
const NOTIFY = process.env.BP_NOTIFY_EMAIL || "business@businesspartner.sa";
const OWNER_KEY = envFrom(["PANEL_KEY", "LEADS_KEY"]);
const OTP_SECRET = (process.env.OTP_SECRET || "").trim();
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || "").trim();

// Stateless e-mail sign-in: the code goes to the office's inbox, an HMAC over
// (email, code, expiry) goes to its browser. Neither alone is enough, so no
// pending-code table is needed — the same scheme the supplier portal uses.
const sealCode = (email, code, exp) => createHmac("sha256", OTP_SECRET).update(`ag-verify|${email}|${code}|${exp}`).digest("hex");
function sealOk(email, code, token, exp) {
  if (!OTP_SECRET || !email || !code || !token || !exp) return false;
  if (Date.now() > Number(exp)) return false;
  const want = Buffer.from(sealCode(email, code, exp)), got = Buffer.from(String(token));
  return want.length === got.length && timingSafeEqual(want, got);
}

// Salted scrypt, stored as "salt:hash" in "بيانات الدخول" — the same scheme
// the supplier portal uses. The stored value can be read by anyone with access
// to the registry and still cannot be turned back into the password.
function hashPassword(pw) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
}
function passwordOk(pw, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  try {
    const want = Buffer.from(hash, "hex");
    const got = scryptSync(pw, salt, 64);
    return want.length === got.length && timingSafeEqual(want, got);
  } catch { return false; }
}

const clip = (s, n = 300) => String(s == null ? "" : s).trim().slice(0, n);
const isEmail = (e) => typeof e === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const rt = (v) => (v ? [{ text: { content: clip(v, 1900) } }] : []);
function rtChunks(v, maxChars = 1900, maxChunks = 6) {
  const str = String(v || "").trim();
  if (!str) return [];
  const chunks = [];
  for (let i = 0; i < str.length && chunks.length < maxChunks; i += maxChars) chunks.push({ text: { content: str.slice(i, i + maxChars) } });
  return chunks;
}
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function txt(p) {
  if (!p) return "";
  if (p.type === "title") return (p.title || []).map((t) => t.plain_text).join("");
  if (p.type === "rich_text") return (p.rich_text || []).map((t) => t.plain_text).join("");
  if (p.type === "select") return p.select ? p.select.name : "";
  if (p.type === "number") return p.number != null ? String(p.number) : "";
  if (p.type === "email") return p.email || "";
  if (p.type === "phone_number") return p.phone_number || "";
  if (p.type === "url") return p.url || "";
  if (p.type === "checkbox") return p.checkbox ? "نعم" : "";
  if (p.type === "date") return p.date ? p.date.start : "";
  if (p.type === "relation") return (p.relation || []).map((r) => r.id).join(",");
  return "";
}

async function notion(path, method = "GET", body) {
  if (!NOTION_TOKEN) return { ok: false, status: 503, json: null };
  try {
    const r = await fetch("https://api.notion.com/v1/" + path, {
      method,
      headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await r.json().catch(() => null);
    if (!r.ok) console.error("agencies notion", path, r.status, JSON.stringify(json).slice(0, 300));
    return { ok: r.ok, status: r.status, json };
  } catch (e) {
    console.error("agencies notion exception", String(e).slice(0, 200));
    return { ok: false, status: 500, json: null };
  }
}

async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY || !isEmail(to)) return { ok: false };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
    if (!r.ok) console.error("agencies email", r.status, (await r.text()).slice(0, 200));
    return { ok: r.ok };
  } catch (e) { return { ok: false }; }
}

// The access code is the bearer token for an approved agency's portal, so it
// carries real entropy rather than a short derived reference.
// One welcome mail for every way in — the office is live immediately, so it
// says what it can do now rather than "we'll be in touch".
function welcomeEmail(name, code) {
  return `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px">
    <h2 style="color:#0B1B5A">أهلاً بك في شبكة مزودي التوظيف ✅</h2>
    <p>حساب <b>${esc(name)}</b> جاهز الآن في Business Partner — لا حاجة لانتظار أي موافقة.</p>
    <p>رمز الدخول الاحتياطي لبوابتك:</p>
    <p style="font-size:22px;font-weight:bold;letter-spacing:2px;color:#0B1B5A">${esc(code)}</p>
    <p>ادخل على <a href="https://businesspartner.sa/ar/agency-portal">بوابة المكاتب</a> لإكمال ملف مكتبك، ثم:</p>
    <ul style="line-height:1.9">
      <li>تصفّح طلبات التوظيف والوظائف المفتوحة كلها.</li>
      <li>ارفع مرشحيك بالسيرة الذاتية — نقرأها ونصدر نسخة ATS تلقائياً.</li>
      <li>تابع مرحلة كل مرشح رفعته من لوحتك.</li>
    </ul>
    <p style="color:#666">كل مرشح ترفعه يُسجَّل باسم مكتبك في نظامنا، ويظهر في الوقت نفسه لدى صاحب العمل — بدون أن تظهر بيانات مكتبك على الموقع.</p></div>`;
}

function makeCode() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(10);
  let out = "";
  for (let i = 0; i < 10; i++) out += abc[bytes[i] % abc.length];
  return "BP-AG-" + out;
}
const codeEq = (a, b) => {
  const x = Buffer.from(String(a || "").toUpperCase()), y = Buffer.from(String(b || "").toUpperCase());
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
};
const ownerOk = (key) => !!OWNER_KEY && String(key || "").trim() === OWNER_KEY;

async function readBody(req) {
  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  if (b && typeof b === "object") return b;
  return await new Promise((resolve) => {
    let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
  });
}

function mapAgency(pg) {
  const p = pg.properties || {};
  return {
    id: pg.id,
    name: txt(p["اسم المكتب"]),
    kind: txt(p["نوع الجهة"]),
    country: txt(p["الدولة"]),
    city: txt(p["المدينة"]),
    license: txt(p["رقم الترخيص"]),
    licenseBy: txt(p["جهة الترخيص"]),
    musaned: txt(p["مسجل في مساند"]),
    contact: txt(p["جهة الاتصال"]),
    role: txt(p["المنصب"]),
    email: txt(p["البريد"]),
    phone: txt(p["الجوال"]),
    whatsapp: txt(p["واتساب"]),
    website: txt(p["الموقع الإلكتروني"]),
    nationalities: txt(p["الجنسيات المتاحة"]),
    professions: txt(p["المهن والتخصصات"]),
    capacity: txt(p["الطاقة الشهرية"]),
    years: txt(p["سنوات الخبرة"]),
    ksaExperience: txt(p["تعامل سابق مع السعودية"]),
    about: txt(p["نبذة"]),
    scope: txt(p["نطاق الخدمة"]),
    sourcingFee: txt(p["رسوم الاستقطاب"]),
    deploymentFee: txt(p["رسوم الاستقدام"]),
    feeModel: txt(p["نموذج الرسوم"]),
    feeCurrency: txt(p["عملة الرسوم"]),
    candidates: Number(txt(p["عدد المرشحين"]) || 0) || 0,
    // The portal shows the onboarding questions until this is set, then opens
    // the dashboard — nobody has to approve anything in between.
    completed: !!(p["اكتمال الملف"] && p["اكتمال الملف"].checkbox),
    signupMethod: txt(p["طريقة التسجيل"]),
    status: txt(p["الحالة"]),
    code: txt(p["رمز الوصول"]),
    registered: pg.created_time || "",
  };
}

// Look up the registry row for an email, regardless of how the office proved
// it owns that address.
async function agencyByEmail(email) {
  const mail = clip(email, 160).toLowerCase();
  if (!isEmail(mail)) return null;
  const q = await notion(`databases/${AGENCIES_DB}/query`, "POST", {
    page_size: 1, filter: { property: "البريد", email: { equals: mail } },
  });
  if (!q.ok) return null;
  const row = ((q.json && q.json.results) || [])[0];
  return row ? { row, agency: mapAgency(row) } : null;
}

// Registration is self-serve: an office that proves it owns its address is in.
// The owner does not gate the door — the only thing that closes it is an
// explicit موقوف/مرفوض set from the owner panel, which every sign-in path
// checks here.
const BLOCKED = ["موقوف", "مرفوض"];
function gateApproved(agency) {
  if (!agency) return { ok: false, error: "invalid_credentials" };
  if (BLOCKED.includes(agency.status)) return { ok: false, error: "suspended", status: 403, agencyStatus: agency.status };
  return { ok: true, agency };
}

// Offices registered before self-serve sign-up existed may have no access code
// on the row; mint one the first time they sign in rather than locking them out.
async function ensureCode(row) {
  const cur = txt(row.properties["رمز الوصول"]);
  if (cur) return cur;
  const code = makeCode();
  await notion(`pages/${row.id}`, "PATCH", { properties: { "رمز الوصول": { rich_text: rt(code) } } });
  return code;
}

// The office profile, mapped from the portal's onboarding answers onto the
// registry row. Shared by the public registration form and by the in-portal
// questionnaire so both write the same shape.
function profileProps(b) {
  const props = {};
  const KINDS = ["مكتب استقدام", "وكالة توظيف", "الاثنان"];
  const YESNO = ["نعم", "لا"];
  const MUSANED = ["نعم", "لا", "قيد التسجيل"];
  const SCOPES = ["استقطاب", "استقدام", "كلاهما"];
  const FEE_MODELS = ["رسوم ثابتة لكل مرشح", "نسبة من الراتب السنوي", "نسبة من الراتب الشهري", "بدون رسوم على المرشح", "حسب الاتفاق"];
  const CURRENCIES = ["SAR", "USD", "EUR", "أخرى"];
  if (clip(b.name, 200)) props["اسم المكتب"] = { title: [{ text: { content: clip(b.name, 200) } }] };
  if (KINDS.includes(b.kind)) props["نوع الجهة"] = { select: { name: b.kind } };
  if (MUSANED.includes(b.musaned)) props["مسجل في مساند"] = { select: { name: b.musaned } };
  if (YESNO.includes(b.ksaExperience)) props["تعامل سابق مع السعودية"] = { select: { name: b.ksaExperience } };
  if (SCOPES.includes(b.scope)) props["نطاق الخدمة"] = { select: { name: b.scope } };
  if (FEE_MODELS.includes(b.feeModel)) props["نموذج الرسوم"] = { select: { name: b.feeModel } };
  if (CURRENCIES.includes(b.feeCurrency)) props["عملة الرسوم"] = { select: { name: b.feeCurrency } };
  const textFields = [
    ["country", "الدولة"], ["city", "المدينة"], ["license", "رقم الترخيص"], ["licenseBy", "جهة الترخيص"],
    ["contact", "جهة الاتصال"], ["role", "المنصب"], ["whatsapp", "واتساب"],
    ["nationalities", "الجنسيات المتاحة"], ["professions", "المهن والتخصصات"], ["about", "نبذة"],
    ["sourcingFee", "رسوم الاستقطاب"], ["deploymentFee", "رسوم الاستقدام"],
  ];
  for (const [key, prop] of textFields) if (clip(b[key], 1900)) props[prop] = { rich_text: rt(b[key]) };
  if (clip(b.phone, 40)) props["الجوال"] = { phone_number: clip(b.phone, 40) };
  if (/^https?:\/\//i.test(clip(b.website, 300))) props["الموقع الإلكتروني"] = { url: clip(b.website, 300) };
  const capacity = Number(b.capacity);
  if (Number.isFinite(capacity) && capacity > 0) props["الطاقة الشهرية"] = { number: Math.round(capacity) };
  const years = Number(b.years);
  if (Number.isFinite(years) && years >= 0) props["سنوات الخبرة"] = { number: Math.round(years) };
  return props;
}

// Resolve an agency by email, and only treat it as signed in when the code
// matches AND the owner has approved it — a pending or suspended agency can
// hold a code and still see nothing.
async function authAgency(email, code) {
  const mail = clip(email, 160).toLowerCase();
  if (!isEmail(mail) || !clip(code, 40)) return { ok: false, error: "invalid_credentials" };
  const q = await notion(`databases/${AGENCIES_DB}/query`, "POST", {
    page_size: 1,
    filter: { property: "البريد", email: { equals: mail } },
  });
  if (!q.ok) return { ok: false, error: "notion_failed", status: 502 };
  const row = ((q.json && q.json.results) || [])[0];
  if (!row) return { ok: false, error: "invalid_credentials" };
  const agency = mapAgency(row);
  const stored = txt(row.properties["رمز الوصول"]);
  if (!stored || !codeEq(stored, code)) return { ok: false, error: "invalid_credentials" };
  const gate = gateApproved(agency);
  if (!gate.ok) return gate;
  return { ok: true, agency, row };
}


// The five residence states the ATS recognises, and the coarse "where has this
// person actually worked" bucket the employer console filters on. An office
// supplies both: the first decides whether the employer is hiring locally or
// deploying from abroad, the second is what they sort candidates by.
const RESIDENCE_OPTIONS = ["مواطن سعودي", "مقيم بإقامة نظامية قابلة للنقل", "مقيم بإقامة غير قابلة للنقل", "خارج السعودية", "أخرى"];
const REGION_OPTIONS = ["خبرة سعودية", "خبرة خليجية", "خبرة عربية", "خبرة دولية", "بدون خبرة إقليمية"];
const GULF = ["الإمارات", "الكويت", "قطر", "البحرين", "عُمان", "عمان"];

// Work out the regional-experience bucket from the countries ticked, unless
// the office set it explicitly — so an office that only fills in the country
// list still gets a filterable candidate.
function regionFromCountries(countries, explicit) {
  if (REGION_OPTIONS.includes(explicit)) return explicit;
  const list = (countries || []).map((x) => clip(x, 60)).filter(Boolean);
  if (!list.length) return "";
  if (list.includes("السعودية")) return "خبرة سعودية";
  if (list.some((c) => GULF.includes(c))) return "خبرة خليجية";
  if (list.some((c) => ["الأردن", "مصر", "لبنان", "سوريا", "العراق", "اليمن", "السودان", "المغرب", "تونس", "الجزائر", "ليبيا"].includes(c))) return "خبرة عربية";
  return "خبرة دولية";
}

// One candidate, mapped onto a master ATS row. Shared by the single-candidate
// form and the sheet importer so both produce rows the employer console reads
// identically. The office columns are internal: the public pool and the
// employer console both render the candidate with no trace of who supplied them.
function candidateProps(agency, c, opts = {}) {
  const name = clip(c.name, 200);
  const role = clip(c.role, 160);
  const jobTitle = clip(c.jobTitle, 200);
  const jobId = clip(c.jobId, 120);
  const residence = RESIDENCE_OPTIONS.includes(c.residence) ? c.residence : "خارج السعودية";
  const countries = Array.isArray(c.experienceCountries) ? c.experienceCountries.slice(0, 20).map((x) => clip(x, 60)).filter(Boolean) : [];
  const region = regionFromCountries(countries, c.regionExperience);

  const notes = [
    `مرشّح مقدَّم من مكتب: ${agency.name}${agency.country ? ` (${agency.country})` : ""}`,
    jobTitle ? `على الطلب/الوظيفة: ${jobTitle}` : "مرشّح من قاعدة المكتب — بدون طلب محدد",
    countries.length ? `دول الخبرة: ${countries.join("، ")}` : "",
    clip(c.notes, 900) ? `ملاحظات المكتب: ${clip(c.notes, 900)}` : "",
  ].filter(Boolean).join("\n");

  const props = {
    "Candidate Name": { title: [{ text: { content: name } }] },
    "Target Role": { rich_text: rt(role) },
    "Source": { select: { name: opts.bulk ? "استيراد مكتب" : "مكتب توظيف" } },
    "مكتب الاستقدام": { select: { name: clip(agency.name, 90).replace(/,/g, "،") } },
    "مسؤول المكتب": { rich_text: rt(agency.contact || agency.name) },
    "بريد المكتب": { email: agency.email || null },
    "دولة المكتب": { rich_text: rt(agency.country) },
    "مدينة المكتب": { rich_text: rt(agency.city) },
    "مهنة الترشيح": { rich_text: rt(role) },
    "تاريخ الترشيح": { date: { start: new Date().toISOString().slice(0, 10) } },
    "Notes": { rich_text: rt(notes) },
    "مخفي عن الموقع": { checkbox: false },
    "حالة الإقامة": { select: { name: residence } },
    "Nationality Type": { select: { name: residence === "مواطن سعودي" ? "سعودي" : "غير سعودي" } },
    "الوظيفة المتقدم لها": { rich_text: rt(jobTitle ? `${jobTitle}${jobId ? ` (${jobId})` : ""}` : "قاعدة المكتب") },
  };
  if (countries.length) props["دول الخبرة"] = { multi_select: countries.map((n) => ({ name: n })) };
  if (region) props["الخبرة الإقليمية"] = { select: { name: region } };
  if (clip(c.phone, 40)) props["Phone"] = { phone_number: clip(c.phone, 40) };
  if (isEmail(clip(c.email, 160))) props["Email"] = { email: clip(c.email, 160).toLowerCase() };
  if (clip(c.nationality, 80)) props["Nationality"] = { rich_text: rt(c.nationality) };
  if (clip(c.city, 80)) props["City"] = { rich_text: rt(c.city) };
  if (clip(c.country, 80) || agency.country) props["Country"] = { rich_text: rt(clip(c.country, 80) || agency.country) };
  if (clip(c.skills, 900)) props["Skills"] = { rich_text: rt(c.skills) };
  if (clip(c.education, 400)) props["Education"] = { rich_text: rt(c.education) };
  const fieldCat = guessField(role);
  if (fieldCat) props["Field"] = { select: { name: fieldCat } };
  const exp = Number(c.experience);
  if (Number.isFinite(exp) && exp >= 0) props["Experience Years"] = { number: Math.round(exp) };
  const salary = Number(String(c.salary || "").replace(/[^\d.]/g, ""));
  if (Number.isFinite(salary) && salary > 0) props["Expected Salary"] = { number: Math.round(salary) };
  if (/^https?:\/\//i.test(clip(c.cvUrl, 500))) props["CV Link"] = { url: clip(c.cvUrl, 500) };
  const AVAIL = ["فوري", "خلال شهر", "خلال 3 أشهر"];
  if (AVAIL.includes(c.availability)) props["Availability"] = { select: { name: c.availability } };
  return props;
}

// The office's private mirror row for the same candidate.
function mirrorProps(c, atsUrl, atsCvUrl) {
  const m = {
    "اسم المرشح": { title: [{ text: { content: clip(c.name, 200) } }] },
    "المهنة": { rich_text: rt(c.role) },
    "المرحلة": { select: { name: "جديد" } },
    "الطلب / الوظيفة": { rich_text: rt(clip(c.jobTitle, 200) || "قاعدة المكتب") },
  };
  if (clip(c.nationality, 80)) m["الجنسية"] = { rich_text: rt(c.nationality) };
  if (clip(c.phone, 40)) m["الجوال"] = { rich_text: rt(c.phone) };
  if (isEmail(clip(c.email, 160))) m["البريد"] = { email: clip(c.email, 160).toLowerCase() };
  const exp = Number(c.experience);
  if (Number.isFinite(exp) && exp >= 0) m["سنوات الخبرة"] = { number: Math.round(exp) };
  if (clip(c.notes, 900)) m["ملاحظات"] = { rich_text: rt(c.notes) };
  if (/^https?:\/\//i.test(clip(c.cvUrl, 500))) m["رابط السيرة"] = { url: clip(c.cvUrl, 500) };
  if (atsCvUrl) m["سيرة ATS (Drive)"] = { url: atsCvUrl };
  if (atsUrl) m["الملف في ATS"] = { url: atsUrl };
  return m;
}

// One ATS row as the office sees it: its own candidate, with the stage the
// employer moved them to and whatever interview has been asked for or booked.
function mapSubmission(pg) {
  const p = pg.properties || {};
  const iv = p["Interview Date"] && p["Interview Date"].date ? p["Interview Date"].date.start : "";
  return {
    id: pg.id,
    name: txt(p["Candidate Name"]),
    role: txt(p["مهنة الترشيح"]) || txt(p["Target Role"]),
    nationality: txt(p["Nationality"]),
    residence: txt(p["حالة الإقامة"]),
    region: txt(p["الخبرة الإقليمية"]),
    countries: (p["دول الخبرة"] && p["دول الخبرة"].multi_select ? p["دول الخبرة"].multi_select : []).map((o) => o.name),
    years: txt(p["Experience Years"]),
    stage: txt(p["Pipeline Stage"]),
    job: txt(p["الوظيفة المتقدم لها"]),
    atsCv: txt(p["ATS CV (Drive)"]),
    interviewStatus: txt(p["Interview Status"]),
    interviewMode: txt(p["Interview Mode"]),
    interviewAt: iv,
    interviewLink: txt(p["رابط المقابلة"]),
    interviewPlace: txt(p["مكان المقابلة"]),
    requestedBy: txt(p["طالب المقابلة"]),
    submitted: pg.created_time || "",
  };
}

// Write one candidate into the pool: de-duplicate, run the attached CV through
// the shared n8n pipeline, write the ATS row, mirror it into the office's own
// database and bump the office's running total.
async function intakeCandidate(agency, c, opts = {}) {
  const name = clip(c.name, 200);
  const role = clip(c.role, 160);
  if (!name || !role) return { ok: false, error: "invalid_fields" };
  const candEmail = isEmail(clip(c.email, 160)) ? clip(c.email, 160).toLowerCase() : "";
  const candPhone = clip(c.phone, 40);

  // Only a real attachment is worth a pipeline round-trip; a bulk sheet row
  // has no file, so it skips straight to the write.
  const cvFile = c.cvFile && typeof c.cvFile === "object" && typeof c.cvFile.base64 === "string" && c.cvFile.base64 ? {
    name: clip(c.cvFile.name, 220), type: clip(c.cvFile.type, 120),
    size: Number(c.cvFile.size) || 0, base64: c.cvFile.base64,
  } : null;

  let n8n = null;
  if (cvFile || /^https?:\/\//i.test(clip(c.cvUrl, 500))) {
    n8n = await forwardToN8n({
      source: opts.bulk ? "agency-import" : "agency-portal",
      receivedAt: new Date().toISOString(),
      agency: { id: agency.id, name: agency.name, country: agency.country },
      candidate: {
        name, phone: candPhone, email: candEmail, field: role,
        fieldCategory: guessField(role), experience: clip(c.experience, 40),
        city: clip(c.city, 80), country: clip(c.country, 80) || agency.country,
        nationality: clip(c.nationality, 80),
        residenceStatus: RESIDENCE_OPTIONS.includes(c.residence) ? c.residence : "خارج السعودية",
        salary: clip(c.salary, 80), cvUrl: clip(c.cvUrl, 500), linkedin: "", consent: true,
      },
      job: { id: clip(c.jobId, 120) || "agency-pool", title: clip(c.jobTitle, 200) || "قاعدة المكتب" },
      questions: {}, cvFile, ats: { notionDatabaseId: ATS_DB },
    }).catch(() => null);
  }

  const props = candidateProps(agency, c, opts);
  const existing = await findExisting(candEmail, candPhone).catch(() => null);
  let r;
  if (existing) {
    applyN8nEnrichment(props, n8n, false);
    r = await notion(`pages/${existing.id}`, "PATCH", { properties: props });
  } else {
    props["Pipeline Stage"] = { select: { name: "جديد" } };
    props["حالة القراءة"] = { select: { name: n8n ? "مكتمل" : "ناقص - بيانات غير كافية" } };
    applyN8nEnrichment(props, n8n, true);
    r = await notion("pages", "POST", { parent: { database_id: ATS_DB }, properties: props });
  }
  if (!r.ok) return { ok: false, error: "notion_failed" };

  const enriched = n8n && n8n.ok && n8n.data ? n8n.data : null;
  const atsCv = enriched && enriched.drive ? enriched.drive.atsCvDocUrl || "" : "";
  if (opts.officeDb) {
    await notion("pages", "POST", {
      parent: { database_id: opts.officeDb },
      properties: mirrorProps(c, (r.json && r.json.url) || "", atsCv),
    });
  }
  return {
    ok: true, id: r.json && r.json.id, url: (r.json && r.json.url) || "",
    updated: !!existing, atsCv,
    cvProcessed: !!(enriched && enriched.drive && (enriched.drive.atsCvDocUrl || enriched.drive.originalCvUrl)),
  };
}

export async function handleAgencies(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const send = (status, obj) => { res.statusCode = status; return res.end(JSON.stringify(obj)); };
  const url = new URL(req.url, "http://x");
  const q = url.searchParams;

  if (req.method === "GET") {
    const action = (q.get("action") || "").trim();

    // ---- owner: the whole registry + every request ----
    if (action === "admin") {
      if (!ownerOk(q.get("key"))) { res.statusCode = 403; return res.end(JSON.stringify({ ok: false, error: "forbidden" })); }
      const [ag, rq] = await Promise.all([
        notion(`databases/${AGENCIES_DB}/query`, "POST", { page_size: 100, sorts: [{ timestamp: "created_time", direction: "descending" }] }),
        notion(`databases/${REQUESTS_DB}/query`, "POST", { page_size: 100, sorts: [{ timestamp: "created_time", direction: "descending" }] }),
      ]);
      res.statusCode = 200;
      return res.end(JSON.stringify({
        ok: true,
        agencies: (((ag.json || {}).results) || []).map(mapAgency),
        requests: (((rq.json || {}).results) || []).map((pg) => {
          const p = pg.properties || {};
          return {
            id: pg.id, title: txt(p["عنوان الطلب"]), status: txt(p["الحالة"]),
            count: txt(p["العدد المطلوب"]), profession: txt(p["المهنة"]),
            city: txt(p["المدينة"]), nationalities: txt(p["الجنسيات المطلوبة"]),
            toAll: !!(p["متاح لكل المكاتب"] && p["متاح لكل المكاتب"].checkbox),
            targets: (p["موجّه إلى"] && p["موجّه إلى"].relation || []).length,
            created: pg.created_time || "",
          };
        }),
      }));
    }

    // ---- agency: the demand addressed to it, plus anything open to all ----
    if (action === "requests") {
      const auth = await authAgency(q.get("email"), q.get("code"));
      if (!auth.ok) { res.statusCode = auth.status || 401; return res.end(JSON.stringify({ ok: false, error: auth.error, agencyStatus: auth.agencyStatus })); }
      const r = await notion(`databases/${REQUESTS_DB}/query`, "POST", {
        page_size: 100,
        filter: {
          and: [
            { or: [{ property: "الحالة", select: { equals: "مفتوح" } }, { property: "الحالة", select: { equals: "قيد التنفيذ" } }] },
            { or: [
              { property: "متاح لكل المكاتب", checkbox: { equals: true } },
              { property: "موجّه إلى", relation: { contains: auth.agency.id } },
            ] },
          ],
        },
        sorts: [{ timestamp: "created_time", direction: "descending" }],
      });
      if (!r.ok) { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_failed" })); }
      const requests = (((r.json || {}).results) || []).map((pg) => {
        const p = pg.properties || {};
        return {
          id: pg.id,
          title: txt(p["عنوان الطلب"]),
          profession: txt(p["المهنة"]),
          count: txt(p["العدد المطلوب"]),
          nationalities: txt(p["الجنسيات المطلوبة"]),
          gender: txt(p["الجنس"]),
          city: txt(p["المدينة"]),
          salary: txt(p["الراتب المعروض"]),
          experience: txt(p["الخبرة المطلوبة"]),
          extra: txt(p["متطلبات إضافية"]),
          deadline: txt(p["موعد التسليم"]),
          status: txt(p["الحالة"]),
        };
      });
      // Approved offices also see every open job on the platform, so they can
      // supply against the whole board rather than only the demand routed to
      // them.
      const jr = await notion(`databases/${JOBS_DB}/query`, "POST", {
        page_size: 100,
        filter: { property: "الحالة", select: { equals: "نشطة" } },
        sorts: [{ timestamp: "created_time", direction: "descending" }],
      });
      const jobs = (((jr.json || {}).results) || []).map((pg) => {
        const p = pg.properties || {};
        return {
          id: pg.id,
          title: txt(p["العنوان الوظيفي"]),
          company: txt(p["الشركة"]),
          city: txt(p["المدينة"]),
          field: txt(p["المجال"]),
          description: txt(p["الوصف والمتطلبات"]).slice(0, 400),
        };
      }).filter((j) => j.title);
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, agency: auth.agency, requests, jobs }));
    }

    // ---- agency: the candidates it has submitted ----
    if (action === "submissions") {
      const auth = await authAgency(q.get("email"), q.get("code"));
      if (!auth.ok) { res.statusCode = auth.status || 401; return res.end(JSON.stringify({ ok: false, error: auth.error, agencyStatus: auth.agencyStatus })); }
      const r = await notion(`databases/${ATS_DB}/query`, "POST", {
        page_size: 100,
        filter: { property: "مكتب الاستقدام", select: { equals: clip(auth.agency.name, 90).replace(/,/g, "،") } },
        sorts: [{ timestamp: "created_time", direction: "descending" }],
      });
      if (!r.ok) { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_failed" })); }
      const submissions = (((r.json || {}).results) || []).map(mapSubmission);
      return send(200, { ok: true, submissions });
    }

    // The office's interview inbox: everyone an employer has asked to meet,
    // plus the ones already booked so the office can see its own diary.
    if (action === "interview-requests") {
      const auth = await authAgency(q.get("email"), q.get("code"));
      if (!auth.ok) return send(auth.status || 401, { ok: false, error: auth.error, agencyStatus: auth.agencyStatus });
      const r = await notion(`databases/${ATS_DB}/query`, "POST", {
        page_size: 100,
        filter: {
          and: [
            { property: "مكتب الاستقدام", select: { equals: clip(auth.agency.name, 90).replace(/,/g, "،") } },
            { or: [
              { property: "Interview Status", select: { equals: "مطلوبة من صاحب العمل" } },
              { property: "Interview Status", select: { equals: "بانتظار جدولة المكتب" } },
              { property: "Interview Status", select: { equals: "مجدول" } },
              { property: "Interview Status", select: { equals: "أُعيدت الجدولة" } },
            ] },
          ],
        },
        sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
      });
      if (!r.ok) return send(502, { ok: false, error: "notion_failed" });
      return send(200, { ok: true, requests: (((r.json || {}).results) || []).map(mapSubmission) });
    }

    res.statusCode = 200;
    return res.end(JSON.stringify({
      ok: true, status: "ok", configured: !!NOTION_TOKEN,
      // The portal renders only the sign-in methods that are actually usable.
      methods: { code: true, google: !!GOOGLE_CLIENT_ID, email: !!OTP_SECRET && !!RESEND_API_KEY, nafath: false },
      nafath: nafathPing ? "soon" : "soon",
    }));
  }

  if (req.method !== "POST") { res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: "method_not_allowed" })); }

  const b = await readBody(req);
  const type = clip(b.type, 40);

  // ---------------- public registration ----------------
  if (type === "register") {
    const name = clip(b.name, 200);
    const email = clip(b.email, 160).toLowerCase();
    const country = clip(b.country, 80);
    const phone = clip(b.phone, 40);
    if (!name || !isEmail(email) || !country || !phone) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: "invalid_fields" }));
    }
    if (!NOTION_TOKEN) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "not_configured" })); }

    // One registry row per email — a repeat submission updates the existing
    // record instead of creating a duplicate the owner has to reconcile.
    const existing = await notion(`databases/${AGENCIES_DB}/query`, "POST", {
      page_size: 1, filter: { property: "البريد", email: { equals: email } },
    });
    const dupe = ((existing.json && existing.json.results) || [])[0];

    const props = profileProps({ ...b, name, country, phone });
    props["البريد"] = { email };

    // The company profile is filed onto the registry row itself, so the owner
    // reviews the licence and the profile in one place.
    const pf = b.profileFile && typeof b.profileFile === "object" ? b.profileFile : null;
    if (pf && typeof pf.base64 === "string" && pf.base64 && Number(pf.size) <= 8 * 1024 * 1024) {
      const uploadId = await uploadToNotion(pf.base64, clip(pf.name, 200) || "company-profile.pdf", clip(pf.type, 120));
      if (uploadId) props["المستندات"] = { files: [{ type: "file_upload", file_upload: { id: uploadId }, name: clip(pf.name, 100) || "company-profile" }] };
    }

    // Self-serve: the office is live the moment it registers and gets its
    // portal code straight away — no approval step in between.
    const code = dupe ? await ensureCode(dupe) : makeCode();
    props["اكتمال الملف"] = { checkbox: true };
    let r;
    if (dupe) {
      r = await notion(`pages/${dupe.id}`, "PATCH", { properties: props });
    } else {
      props["الحالة"] = { select: { name: "مفعّل" } };
      props["طريقة التسجيل"] = { select: { name: "تسجيل يدوي" } };
      props["رمز الوصول"] = { rich_text: rt(code) };
      if (clip(b.password, 200).length >= 8) props["بيانات الدخول"] = { rich_text: rt(hashPassword(String(b.password))) };
      r = await notion("pages", "POST", { parent: { database_id: AGENCIES_DB }, properties: props, icon: { type: "emoji", emoji: "🌍" } });
    }
    if (!r.ok) { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_failed" })); }
    const registered = mapAgency(r.json || { properties: {} });

    const rows = [
      ["نوع الجهة", b.kind], ["الدولة", country], ["المدينة", b.city], ["رقم الترخيص", b.license],
      ["جهة الترخيص", b.licenseBy], ["مساند", b.musaned], ["جهة الاتصال", b.contact],
      ["البريد", email], ["الجوال", phone], ["واتساب", b.whatsapp],
      ["الجنسيات", b.nationalities], ["المهن", b.professions], ["الطاقة الشهرية", b.capacity],
    ].filter(([, v]) => clip(v)).map(([k, v]) => `<tr><td style="padding:4px 10px;color:#666">${esc(k)}</td><td style="padding:4px 10px"><b>${esc(clip(v, 300))}</b></td></tr>`).join("");
    await sendEmail(NOTIFY, `🌍 تسجيل مكتب استقدام — ${name} (${country})`, `<div dir="rtl" style="font-family:Arial,sans-serif">
      <h2 style="color:#0B1B5A">تسجيل جديد في سجل مكاتب الاستقدام</h2>
      <table style="border-collapse:collapse">${rows}</table>
      <p style="color:#666">راجع الطلب في Notion، واضبط الحالة = «معتمد» لإصدار رمز الدخول للمكتب.</p></div>`);
    await sendEmail(email, "بوابة مكتبك جاهزة — Business Partner", welcomeEmail(name, code));

    return send(200, { ok: true, updated: !!dupe, agency: registered, email, code });
  }

  // ---------------- self-serve sign-up: e-mail + password ----------------
  // No approval queue: the office creates its account, gets its portal code by
  // e-mail, answers the profile questions inside the portal and starts working.
  if (type === "signup") {
    const email = clip(b.email, 160).toLowerCase();
    const password = String(b.password == null ? "" : b.password);
    const name = clip(b.name, 200);
    if (!isEmail(email) || !name) return send(400, { ok: false, error: "invalid_fields" });
    if (password.length < 8) return send(400, { ok: false, error: "weak_password" });
    if (!NOTION_TOKEN) return send(503, { ok: false, error: "not_configured" });

    // An address that already has an account signs in with the same call when
    // the password matches, so a repeat sign-up is never a dead end.
    const hit = await agencyByEmail(email);
    if (hit) {
      const stored = txt(hit.row.properties["بيانات الدخول"]);
      if (stored && passwordOk(password, stored)) {
        const gate = gateApproved(hit.agency);
        if (!gate.ok) return send(gate.status || 401, { ok: false, error: gate.error, agencyStatus: gate.agencyStatus });
        return send(200, { ok: true, agency: gate.agency, email, code: await ensureCode(hit.row) });
      }
      return send(409, { ok: false, error: "already_registered" });
    }

    const code = makeCode();
    const props = {
      "اسم المكتب": { title: [{ text: { content: name } }] },
      "البريد": { email },
      "الحالة": { select: { name: "مفعّل" } },
      "طريقة التسجيل": { select: { name: "بريد وكلمة مرور" } },
      "رمز الوصول": { rich_text: rt(code) },
      "بيانات الدخول": { rich_text: rt(hashPassword(password)) },
      "اكتمال الملف": { checkbox: false },
    };
    if (clip(b.country, 80)) props["الدولة"] = { rich_text: rt(b.country) };
    if (clip(b.phone, 40)) props["الجوال"] = { phone_number: clip(b.phone, 40) };
    const r = await notion("pages", "POST", { parent: { database_id: AGENCIES_DB }, properties: props, icon: { type: "emoji", emoji: "🌍" } });
    if (!r.ok) return send(502, { ok: false, error: "notion_failed" });
    const agency = mapAgency(r.json);
    await sendEmail(email, "بوابة مكتبك جاهزة — Business Partner", welcomeEmail(name, code));
    await sendEmail(NOTIFY, `🌍 مزود توظيف جديد سجّل بنفسه — ${name}`, `<div dir="rtl" style="font-family:Arial,sans-serif">
      <h2 style="color:#0B1B5A">مكتب جديد أنشأ حسابه</h2>
      <p><b>${esc(name)}</b> — ${esc(email)}</p>
      <p style="color:#666">الحساب مفعّل تلقائياً. مرشحوه سيظهرون في قاعدة ATS موسومين باسم مكتبه — راجع بياناته في لوحة مكاتب الاستقدام.</p></div>`);
    return send(200, { ok: true, agency, email, code });
  }

  // ---------------- the office fills in its profile from inside the portal ----
  if (type === "save-profile") {
    const auth = await authAgency(b.email, b.code);
    if (!auth.ok) return send(auth.status || 401, { ok: false, error: auth.error, agencyStatus: auth.agencyStatus });
    const props = profileProps(b);
    props["اكتمال الملف"] = { checkbox: true };

    const pf = b.profileFile && typeof b.profileFile === "object" ? b.profileFile : null;
    if (pf && typeof pf.base64 === "string" && pf.base64 && Number(pf.size) <= 8 * 1024 * 1024) {
      const uploadId = await uploadToNotion(pf.base64, clip(pf.name, 200) || "company-profile.pdf", clip(pf.type, 120));
      if (uploadId) props["المستندات"] = { files: [{ type: "file_upload", file_upload: { id: uploadId }, name: clip(pf.name, 100) || "company-profile" }] };
    }

    const r = await notion(`pages/${auth.agency.id}`, "PATCH", { properties: props });
    if (!r.ok) return send(502, { ok: false, error: "notion_failed" });
    const agency = mapAgency(r.json);
    // Only announce the first completion — later edits shouldn't page the owner.
    if (!auth.agency.completed) {
      const rows = [
        ["نوع الجهة", agency.kind], ["نطاق الخدمة", agency.scope], ["الدولة", agency.country], ["المدينة", agency.city],
        ["رقم الترخيص", agency.license], ["مساند", agency.musaned], ["الجنسيات", agency.nationalities],
        ["المهن", agency.professions], ["رسوم الاستقطاب", agency.sourcingFee], ["رسوم الاستقدام", agency.deploymentFee],
        ["نموذج الرسوم", agency.feeModel], ["الطاقة الشهرية", agency.capacity],
      ].filter(([, v]) => clip(v)).map(([k, v]) => `<tr><td style="padding:4px 10px;color:#666">${esc(k)}</td><td style="padding:4px 10px"><b>${esc(clip(v, 300))}</b></td></tr>`).join("");
      await sendEmail(NOTIFY, `📋 اكتمل ملف مزود التوظيف — ${agency.name}`, `<div dir="rtl" style="font-family:Arial,sans-serif">
        <h2 style="color:#0B1B5A">ملف مكتب مكتمل</h2><table style="border-collapse:collapse">${rows}</table></div>`);
    }
    return send(200, { ok: true, agency });
  }

  // ---------------- agency login ----------------
  if (type === "login") {
    // Password sign-in for accounts created through the portal; the permanent
    // access code still works for offices we onboarded by hand.
    const password = String(b.password == null ? "" : b.password);
    if (password) {
      const hit = await agencyByEmail(b.email);
      if (!hit) return send(401, { ok: false, error: "invalid_credentials" });
      const stored = txt(hit.row.properties["بيانات الدخول"]);
      if (!stored || !passwordOk(password, stored)) return send(401, { ok: false, error: "invalid_credentials" });
      const gate = gateApproved(hit.agency);
      if (!gate.ok) return send(gate.status || 401, { ok: false, error: gate.error, agencyStatus: gate.agencyStatus });
      return send(200, { ok: true, agency: gate.agency, email: clip(b.email, 160).toLowerCase(), code: await ensureCode(hit.row) });
    }
    const auth = await authAgency(b.email, b.code);
    if (!auth.ok) { res.statusCode = auth.status || 401; return res.end(JSON.stringify({ ok: false, error: auth.error, agencyStatus: auth.agencyStatus })); }
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, agency: auth.agency }));
  }

  // ---------------- agency submits a candidate ----------------
  if (type === "submit-candidate") {
    const auth = await authAgency(b.email, b.code);
    if (!auth.ok) return send(auth.status || 401, { ok: false, error: auth.error, agencyStatus: auth.agencyStatus });

    const c = {
      name: b.candidateName, role: b.role, nationality: b.nationality, experience: b.experience,
      phone: b.candidatePhone, email: b.candidateEmail, city: b.city, country: b.country,
      skills: b.skills, education: b.education, salary: b.salary, availability: b.availability,
      notes: b.notes, cvUrl: b.cvUrl, cvFile: b.cvFile,
      residence: b.residence, regionExperience: b.regionExperience,
      experienceCountries: b.experienceCountries,
      // A candidate from the office's own pool carries no request — the fields
      // are simply absent, and the row says "قاعدة المكتب" instead.
      jobId: b.requestId, jobTitle: b.requestTitle,
    };
    if (!clip(c.name, 200) || !clip(c.role, 160)) return send(400, { ok: false, error: "invalid_fields" });

    const officeDb = await ensureCandidatesDb(auth.agency, auth.agency.id);
    const out = await intakeCandidate(auth.agency, c, { officeDb });
    if (!out.ok) return send(out.error === "invalid_fields" ? 400 : 502, { ok: false, error: out.error });

    if (!out.updated) {
      await notion(`pages/${auth.agency.id}`, "PATCH", { properties: { "عدد المرشحين": { number: (auth.agency.candidates || 0) + 1 } } });
    }

    await sendEmail(NOTIFY, `👤 مرشّح جديد من ${auth.agency.name} — ${clip(c.name, 200)}`, `<div dir="rtl" style="font-family:Arial,sans-serif">
      <p>رفع مكتب <b>${esc(auth.agency.name)}</b> مرشّحاً${c.cvFile && c.cvFile.name ? " مع سيرة ذاتية مرفقة" : ""}:</p>
      <p><b>${esc(clip(c.name, 200))}</b> — ${esc(clip(c.role, 160))}${c.nationality ? " · " + esc(clip(c.nationality, 80)) : ""}</p>
      <p style="color:#666">${esc(clip(c.jobTitle, 200) || "من قاعدة المكتب — بدون طلب محدد")}</p>
      ${out.atsCv ? `<p><a href="${esc(out.atsCv)}">السيرة الذاتية ATS</a></p>` : ""}</div>`);

    return send(200, { ok: true, id: out.id, updated: out.updated, cvProcessed: out.cvProcessed, atsCv: out.atsCv });
  }

  // ---------------- office imports a sheet of candidates ----------------
  // The browser parses the .xlsx/.csv and posts plain rows, so the function
  // never has to unzip a spreadsheet. Rows are written one at a time against
  // the same de-duplication the single form uses; a bad row is reported back
  // by line number rather than failing the whole import.
  if (type === "bulk-import") {
    const auth = await authAgency(b.email, b.code);
    if (!auth.ok) return send(auth.status || 401, { ok: false, error: auth.error, agencyStatus: auth.agencyStatus });
    const rows = Array.isArray(b.rows) ? b.rows.slice(0, 60) : [];
    if (!rows.length) return send(400, { ok: false, error: "no_rows" });

    const officeDb = await ensureCandidatesDb(auth.agency, auth.agency.id);
    const errors = [];
    let created = 0, updated = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] && typeof rows[i] === "object" ? rows[i] : {};
      const line = Number(row.line) || i + 1;
      if (!clip(row.name, 200) || !clip(row.role, 160)) { errors.push({ line, error: "missing_name_or_role" }); continue; }
      const out = await intakeCandidate(auth.agency, row, { officeDb, bulk: true });
      if (!out.ok) { errors.push({ line, error: out.error }); continue; }
      if (out.updated) updated++; else created++;
    }
    if (created) {
      await notion(`pages/${auth.agency.id}`, "PATCH", { properties: { "عدد المرشحين": { number: (auth.agency.candidates || 0) + created } } });
    }
    if (created || updated) {
      await sendEmail(NOTIFY, `📥 استيراد ${created + updated} مرشّحاً من ${auth.agency.name}`, `<div dir="rtl" style="font-family:Arial,sans-serif">
        <p>استورد مكتب <b>${esc(auth.agency.name)}</b> قائمة مرشحين:</p>
        <p>جديد: <b>${created}</b> · محدَّث: <b>${updated}</b>${errors.length ? ` · متجاوَز: <b>${errors.length}</b>` : ""}</p></div>`);
    }
    return send(200, { ok: true, created, updated, skipped: errors.length, errors: errors.slice(0, 25) });
  }

  // ---------------- office schedules a requested interview ----------------
  if (type === "interview-schedule") {
    const auth = await authAgency(b.email, b.code);
    if (!auth.ok) return send(auth.status || 401, { ok: false, error: auth.error, agencyStatus: auth.agencyStatus });
    const id = clip(b.candidateId, 60);
    const date = clip(b.date, 10);
    const time = clip(b.time, 5);
    const MODES = ["حضوري", "أونلاين", "هاتف"];
    const mode = MODES.includes(b.mode) ? b.mode : "أونلاين";
    if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return send(400, { ok: false, error: "invalid_fields" });

    // The row must belong to this office — an id alone must never let one
    // office write onto another office's candidate.
    const page = await notion(`pages/${id}`, "GET");
    if (!page.ok) return send(404, { ok: false, error: "not_found" });
    const owner = txt(page.json.properties["مكتب الاستقدام"]);
    if (owner !== clip(auth.agency.name, 90).replace(/,/g, "،")) return send(403, { ok: false, error: "forbidden" });

    const startsAt = /^\d{2}:\d{2}$/.test(time) ? `${date}T${time}:00` : date;
    const props = {
      "Interview Status": { select: { name: "مجدول" } },
      "Interview Mode": { select: { name: mode } },
      "Interview Date": { date: { start: startsAt } },
      "Pipeline Stage": { select: { name: "مقابلة" } },
    };
    if (/^https?:\/\//i.test(clip(b.link, 500))) props["رابط المقابلة"] = { url: clip(b.link, 500) };
    if (clip(b.location, 400)) props["مكان المقابلة"] = { rich_text: rt(b.location) };
    if (clip(b.notes, 900)) props["ملاحظات المقابلة"] = { rich_text: rt(b.notes) };
    const r = await notion(`pages/${id}`, "PATCH", { properties: props });
    if (!r.ok) return send(502, { ok: false, error: "notion_failed" });

    const candidate = txt(page.json.properties["Candidate Name"]);
    const requester = txt(page.json.properties["طالب المقابلة"]);
    const when = /^\d{2}:\d{2}$/.test(time) ? `${date} الساعة ${time}` : date;
    await sendEmail(NOTIFY, `📅 موعد مقابلة مؤكَّد — ${candidate}`, `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:520px">
      <h2 style="color:#0B1B5A">تم تأكيد موعد المقابلة</h2>
      <p><b>${esc(candidate)}</b> — ${esc(txt(page.json.properties["Target Role"]))}</p>
      <p>الموعد: <b>${esc(when)}</b> · النوع: <b>${esc(mode)}</b></p>
      ${clip(b.location, 400) ? `<p>المكان: ${esc(clip(b.location, 400))}</p>` : ""}
      ${/^https?:\/\//i.test(clip(b.link, 500)) ? `<p><a href="${esc(clip(b.link, 500))}">رابط المقابلة</a></p>` : ""}
      <p style="color:#666">جدوَلها مكتب ${esc(auth.agency.name)}${requester ? ` بناءً على طلب ${esc(requester)}` : ""}.</p></div>`);
    return send(200, { ok: true, when: startsAt, mode });
  }

  // ---------------- sign in with Google ----------------
  // The office's Google account must carry the same address it registered
  // with; a verified Google email replaces the access code, it never creates
  // an account and never bypasses approval.
  if (type === "google") {
    if (!GOOGLE_CLIENT_ID) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "google_not_configured" })); }
    const g = await verifyGoogleIdToken(b.credential);
    if (!g) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "bad_google_token" })); }
    const hit = await agencyByEmail(g.email);
    // A Google account we've never seen creates the office there and then —
    // the profile questions are asked inside the portal, not before it.
    if (!hit) {
      const code = makeCode();
      const r = await notion("pages", "POST", {
        parent: { database_id: AGENCIES_DB },
        icon: { type: "emoji", emoji: "🌍" },
        properties: {
          "اسم المكتب": { title: [{ text: { content: clip(g.name || g.email, 200) } }] },
          "البريد": { email: g.email },
          "الحالة": { select: { name: "مفعّل" } },
          "طريقة التسجيل": { select: { name: "Google" } },
          "رمز الوصول": { rich_text: rt(code) },
          "اكتمال الملف": { checkbox: false },
        },
      });
      if (!r.ok) return send(502, { ok: false, error: "notion_failed" });
      const agency = mapAgency(r.json);
      await sendEmail(g.email, "بوابة مكتبك جاهزة — Business Partner", welcomeEmail(agency.name, code));
      await sendEmail(NOTIFY, `🌍 مزود توظيف جديد عبر Google — ${agency.name}`, `<div dir="rtl" style="font-family:Arial,sans-serif">
        <p>سجّل <b>${esc(agency.name)}</b> (${esc(g.email)}) عبر Google. الحساب مفعّل تلقائياً.</p></div>`);
      return send(200, { ok: true, agency, email: g.email, code, created: true });
    }
    const gate = gateApproved(hit.agency);
    if (!gate.ok) { res.statusCode = gate.status || 401; return res.end(JSON.stringify({ ok: false, error: gate.error, agencyStatus: gate.agencyStatus })); }
    // Hand back the office's own access code so the portal can keep using the
    // existing session shape for its data calls.
    return send(200, { ok: true, agency: gate.agency, email: g.email, code: await ensureCode(hit.row) });
  }

  // ---------------- sign in with an emailed code ----------------
  if (type === "email-code") {
    if (!OTP_SECRET) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "not_configured" })); }
    const email = clip(b.email, 160).toLowerCase();
    if (!isEmail(email)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_email" })); }
    const hit = await agencyByEmail(email);
    // The response never reveals whether an address is registered; a code is
    // only actually sent to a registered, approved office.
    if (hit && !BLOCKED.includes(hit.agency.status)) {
      const code = String(randomInt(100000, 1000000));
      const exp = Date.now() + 15 * 60 * 1000;
      await sendEmail(email, `رمز الدخول لبوابة المكاتب: ${code}`, `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:480px">
        <h2 style="color:#0B1B5A">رمز الدخول</h2>
        <p>رمز دخولك إلى بوابة مكاتب الاستقدام (صالح 15 دقيقة):</p>
        <p style="font-size:30px;font-weight:bold;letter-spacing:6px;color:#0B1B5A">${esc(code)}</p>
        <p style="color:#666">إذا لم تطلبه، تجاهل هذه الرسالة.</p></div>`);
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, sent: true, t: sealCode(email, code, exp), exp }));
    }
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, sent: true }));
  }

  if (type === "email-verify") {
    const email = clip(b.email, 160).toLowerCase();
    if (!sealOk(email, clip(b.code, 10), clip(b.t, 200), b.exp)) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ ok: false, error: "invalid_credentials" }));
    }
    const hit = await agencyByEmail(email);
    const gate = gateApproved(hit && hit.agency);
    if (!gate.ok) { res.statusCode = gate.status || 401; return res.end(JSON.stringify({ ok: false, error: gate.error, agencyStatus: gate.agencyStatus })); }
    return send(200, { ok: true, agency: gate.agency, email, code: await ensureCode(hit.row) });
  }

  // ---------------- owner: publish a demand order to the network ----------------
  if (type === "create-request") {
    if (!ownerOk(b.key)) { res.statusCode = 403; return res.end(JSON.stringify({ ok: false, error: "forbidden" })); }
    const title = clip(b.title, 200);
    if (!title) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
    const props = {
      "عنوان الطلب": { title: [{ text: { content: title } }] },
      "الحالة": { select: { name: "مفتوح" } },
      "متاح لكل المكاتب": { checkbox: b.toAll !== false },
    };
    const textFields = [["profession", "المهنة"], ["nationalities", "الجنسيات المطلوبة"], ["city", "المدينة"], ["salary", "الراتب المعروض"], ["experience", "الخبرة المطلوبة"], ["extra", "متطلبات إضافية"], ["client", "العميل"], ["notes", "ملاحظات"]];
    for (const [key, prop] of textFields) if (clip(b[key], 1900)) props[prop] = { rich_text: rt(b[key]) };
    const count = Number(b.count);
    if (Number.isFinite(count) && count > 0) props["العدد المطلوب"] = { number: Math.round(count) };
    if (["ذكر", "أنثى", "كلاهما"].includes(b.gender)) props["الجنس"] = { select: { name: b.gender } };
    if (/^\d{4}-\d{2}-\d{2}$/.test(clip(b.deadline, 20))) props["موعد التسليم"] = { date: { start: clip(b.deadline, 20) } };
    // Addressing specific offices narrows who sees it; otherwise it goes to the
    // whole approved network.
    const targets = Array.isArray(b.agencyIds) ? b.agencyIds.filter((x) => typeof x === "string").slice(0, 25) : [];
    if (targets.length) {
      props["موجّه إلى"] = { relation: targets.map((id) => ({ id })) };
      props["متاح لكل المكاتب"] = { checkbox: false };
    }
    const r = await notion("pages", "POST", { parent: { database_id: REQUESTS_DB }, properties: props, icon: { type: "emoji", emoji: "📦" } });
    if (!r.ok) { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_failed" })); }

    // Tell the offices that can act on it — the ones addressed, or everyone
    // approved when it is open to the network.
    try {
      const q = await notion(`databases/${AGENCIES_DB}/query`, "POST", {
        page_size: 50, filter: { property: "الحالة", select: { equals: "معتمد" } },
      });
      const all = (((q.json || {}).results) || []).map(mapAgency);
      const notify = targets.length ? all.filter((a) => targets.includes(a.id)) : all;
      for (const a of notify.slice(0, 40)) {
        if (!isEmail(a.email)) continue;
        await sendEmail(a.email, `طلب توظيف جديد: ${title}`, `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:520px">
          <h2 style="color:#0B1B5A">طلب جديد متاح لمكتبك</h2>
          <p><b>${esc(title)}</b></p>
          <p>${[clip(b.profession, 120), clip(b.city, 80), clip(b.nationalities, 160), count ? `العدد: ${Math.round(count)}` : ""].filter(Boolean).map(esc).join(" · ")}</p>
          <p><a href="https://www.businesspartner.sa/ar/agency-portal">ادخل بوابة المكاتب لرفع مرشحيك</a></p></div>`);
      }
    } catch (e) { console.error("agency notify failed", String(e).slice(0, 150)); }

    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, id: r.json && r.json.id }));
  }

  // ---------------- owner: move a demand order's status ----------------
  if (type === "request-status") {
    if (!ownerOk(b.key)) { res.statusCode = 403; return res.end(JSON.stringify({ ok: false, error: "forbidden" })); }
    const id = clip(b.id, 60);
    const status = ["مفتوح", "قيد التنفيذ", "مكتمل", "مغلق"].includes(b.status) ? b.status : "";
    if (!id || !status) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
    const r = await notion(`pages/${id}`, "PATCH", { properties: { "الحالة": { select: { name: status } } } });
    if (!r.ok) { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_failed" })); }
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true }));
  }

  // ---------------- owner: verify / suspend / reinstate an office ----------------
  // Sign-up no longer waits on this — an office is live the moment it registers.
  // What the owner sets here is a badge (معتمد = licence checked) or a block
  // (موقوف / مرفوض), which every sign-in path honours.
  if (type === "approve") {
    if (!ownerOk(b.key)) { res.statusCode = 403; return res.end(JSON.stringify({ ok: false, error: "forbidden" })); }
    const id = clip(b.id, 60);
    const decision = ["معتمد", "مفعّل", "موقوف", "مرفوض", "قيد المراجعة"].includes(b.decision) ? b.decision : "";
    if (!id || !decision) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }

    const page = await notion(`pages/${id}`, "GET");
    if (!page.ok) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: "not_found" })); }
    const agency = mapAgency(page.json);
    const props = { "الحالة": { select: { name: decision } } };
    if (clip(b.note, 900)) props["ملاحظات المراجعة"] = { rich_text: rt(b.note) };

    // Approval mints the access code once and keeps it stable afterwards, so
    // re-approving a suspended agency does not invalidate a code it already has.
    let code = txt(page.json.properties["رمز الوصول"]);
    if ((decision === "معتمد" || decision === "مفعّل") && !code) {
      code = makeCode();
      props["رمز الوصول"] = { rich_text: rt(code) };
    }
    const r = await notion(`pages/${id}`, "PATCH", { properties: props });
    if (!r.ok) { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_failed" })); }

    if (decision === "معتمد" && isEmail(agency.email)) {
      await sendEmail(agency.email, "تم توثيق مكتبك — Business Partner", `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:520px">
        <h2 style="color:#0B1B5A">تم توثيق ${esc(agency.name)} ✅</h2>
        <p>راجعنا بيانات ترخيصك ووثّقنا مكتبك — يظهر الآن كمزوّد موثّق لدى أصحاب العمل.</p>
        <p>رمز الدخول الخاص بك:</p>
        <p style="font-size:26px;font-weight:bold;letter-spacing:3px;color:#0B1B5A">${esc(code)}</p>
        <p>ادخل من: <a href="https://www.businesspartner.sa/ar/agency-portal">بوابة مكاتب الاستقدام</a> باستخدام بريدك ورمز الدخول.</p>
        <p style="color:#666">احتفظ بالرمز، ولا تشاركه خارج فريقك.</p></div>`);
    }
    if (decision === "موقوف" && isEmail(agency.email)) {
      await sendEmail(agency.email, "إيقاف مؤقت لحساب مكتبك — Business Partner", `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:520px">
        <h2 style="color:#0B1B5A">حساب ${esc(agency.name)} موقوف مؤقتاً</h2>
        <p>تم إيقاف دخول بوابتك مؤقتاً${clip(b.note, 400) ? `: ${esc(clip(b.note, 400))}` : "."}</p>
        <p>بياناتك ومرشحوك محفوظون كما هم. راسلنا على ${esc(NOTIFY)} لإعادة التفعيل.</p></div>`);
    }
    return send(200, { ok: true, code: decision === "معتمد" || decision === "مفعّل" ? code : undefined });
  }

  res.statusCode = 400;
  return res.end(JSON.stringify({ ok: false, error: "unknown_type" }));
}
