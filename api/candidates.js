// Business Partner 3.0 — employer candidate browser (read the ATS from Notion, ESM).
// Returns a SANITIZED list of candidates from the "🧑‍💼 BP Candidates — ATS" database
// for the /employers page. Contact details (name, phone, email, CV) are hidden by
// default and only revealed when a valid subscription code is supplied — so the pool
// stays a paid product while employers can still browse the anonymized talent.
//
// Env vars:
//   NOTION_TOKEN            Notion integration secret (share the ATS DB with it)
//   NOTION_ATS_DB           optional override of the ATS database id
//   EMPLOYER_CODES          comma-separated subscription codes that unlock contacts
//
// GET /api/candidates?field=&city=&nat=&q=&code=   -> { ok, unlocked, total, candidates:[...] }
// GET /api/candidates?feed=jobs   -> Indeed-compatible XML job feed (see jobsFeed below)

import { WORKSHOP_JDS } from "../lib/workshop-jds.js";
import { getSession } from "./_db.js";
import { bdTrial, openFor } from "./_trial.js";

// Accept the token under any of these env-var names (be forgiving about naming).
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
const CODES = (process.env.EMPLOYER_CODES || "").split(",").map((s) => s.trim()).filter(Boolean);
const NOTION_VERSION = "2022-06-28";
// Employers subscriptions DB — a paid, ACTIVE row unlocks access dynamically (no redeploy).
const EMP_DB = process.env.NOTION_EMPLOYERS_DB || "f1104f8bcc3d4beb84accdbda0aa8322";
// Job postings DB — an employer can open more than one, each screened by AI against this pool.
const JOBS_DB = process.env.NOTION_JOBS_DB || "260d76959d464631943f79f313fbf3c9";
// Workshop hiring-campaign DB — source of the public Indeed XML job feed (?feed=jobs).
const WORKSHOP_DB = process.env.NOTION_WORKSHOP_DB || "f83bce33eab7481a8b803495c6cd7619";
// Notion has no COUNT endpoint, so the pool total is walked 100 rows at a time
// — 25,000 rows is ~250 round trips, which no page load should be doing. The
// finished total is parked here and served instantly for a day.
const METRICS_DB = process.env.NOTION_METRICS_DB || "245f3a1ffb1844b19707bb67120b9605";
const POOL_METRIC = "حجم قاعدة المواهب";

// Every advert on the site is published by Business Partner — the end client
// the role is staffed for is our own commercial detail, not the publisher's
// name. The Notion "الشركة" field keeps whatever was written there, so the
// internal attribution survives; this only decides the name on the card.
const PUBLISHER = "Business Partner — بيزنس بارتنر";
const publisherName = () => PUBLISHER;

async function readCachedCount() {
  try {
    const r = await notionFetch(`databases/${METRICS_DB}/query`, "POST", {
      page_size: 1, filter: { property: "المقياس", title: { equals: POOL_METRIC } },
    });
    if (!r.ok) return null;
    const row = ((await r.json()).results || [])[0];
    if (!row) return null;
    const p = row.properties || {};
    const value = p["القيمة"] && typeof p["القيمة"].number === "number" ? p["القيمة"].number : null;
    const at = p["آخر حساب"] && p["آخر حساب"].date ? p["آخر حساب"].date.start : "";
    if (value == null || !at) return null;
    const ageH = (Date.now() - new Date(at).getTime()) / 36e5;
    return { id: row.id, value, at, stale: !(ageH >= 0 && ageH < 24) };
  } catch { return null; }
}

async function writeCachedCount(total, existingId) {
  const props = {
    "القيمة": { number: total },
    "آخر حساب": { date: { start: new Date().toISOString() } },
    "ملاحظة": { rich_text: [{ text: { content: "المرشحون غير المخفيين عن الموقع. يُحسب مرة يومياً بعد اكتمال أول مشي كامل." } }] },
  };
  try {
    if (existingId) return void (await notionFetch(`pages/${existingId}`, "PATCH", { properties: props }));
    props["المقياس"] = { title: [{ text: { content: POOL_METRIC } }] };
    await notionFetch("pages", "POST", { parent: { database_id: METRICS_DB }, properties: props });
  } catch { /* a cache miss is not worth failing the request over */ }
}
const FEED_COMPANY = process.env.JOBS_FEED_COMPANY || "Business Partner";
const FEED_CITY = process.env.JOBS_FEED_CITY || "Riyadh";
const FEED_STATE = process.env.JOBS_FEED_STATE || "Riyadh Province";
const FEED_COUNTRY = process.env.JOBS_FEED_COUNTRY || "SA";
const FEED_PUBLISHED = "منشورة على الموقع";
// Canonical Field taxonomy — must stay in sync with site/scripts/generate.mjs's
// FIELD_TAXONOMY, site/assets/js/main.js's BP.FIELD_TAXONOMY and this file's
// own FIELD_RULES-equivalent in api/candidate.js (guessField()).
const FIELD_OPTIONS = [
  "هندسة", "تقنية معلومات", "مبيعات وتسويق", "محاسبة ومالية", "إداري وسكرتارية", "موارد بشرية",
  "ضيافة وسياحة", "مقاولات وإنشاءات", "عقارات", "صحة وطب", "تعليم", "لوجستيات ونقل",
  "قانون", "تصنيع وصناعة", "طاقة ونفط وغاز", "إعلام وإبداع", "حكومي وقطاع عام", "زراعة وبيئة",
  "تجزئة وتجارة إلكترونية", "أمن وسلامة", "حرف مهنية وصيانة", "علوم وأبحاث", "طيران وبحري", "تجميل وعناية",
  "خدمات منزلية", "أخرى",
];

async function readBody(req) {
  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  if (b && typeof b === "object") return b;
  return await new Promise((resolve) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } }); });
}
async function notionFetch(path, method, payload) {
  return fetch(`https://api.notion.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });
}

// Paging through the ~14k-row ATS needs more than the default serverless
// budget — an unfiltered browse can be ~120 sequential Notion API calls.
export const config = { maxDuration: 300 };

const txt = (p) => {
  if (!p) return "";
  if (p.type === "title") return (p.title || []).map((t) => t.plain_text).join("");
  if (p.type === "rich_text") return (p.rich_text || []).map((t) => t.plain_text).join("");
  if (p.type === "select") return p.select ? p.select.name : "";
  if (p.type === "multi_select") return (p.multi_select || []).map((s) => s.name).join("، ");
  if (p.type === "number") return p.number != null ? String(p.number) : "";
  if (p.type === "email") return p.email || "";
  if (p.type === "phone_number") return p.phone_number || "";
  if (p.type === "url") return p.url || "";
  return "";
};

// Mask a name to initials-ish preview (e.g. "محمد العتيبي" -> "م. ا.")
const maskName = (n) => {
  const parts = String(n || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  return parts.slice(0, 2).map((w) => w[0] + ".").join(" ");
};

// Shared row → API-shape mapper for both the list/browse scan and the
// single-candidate detail lookup, so the two never drift out of sync on
// what fields exist or how locked/unlocked masking works.
function mapCandidate(pg, unlocked, opts) {
  opts = opts || {};
  const p = pg.properties || {};
  // "Candidate Name" is often an auto-transliterated guess (esp. for
  // LinkedIn-sourced, non-Arab candidates — e.g. "غيردار سينغ" for
  // "Girdhar Singh"). "Name (EN)" is the clean, source-accurate name, so
  // it takes priority; we keep the other one alongside when it differs
  // so employers see both scripts instead of a garbled single name.
  const nameAr = txt(p["Candidate Name"]);
  const nameEn = txt(p["Name (EN)"]);
  const primary = nameEn || nameAr;
  const secondary = nameEn && nameAr && nameAr !== nameEn ? nameAr : "";
  const cvAts = txt(p["ATS CV (Drive)"]);
  const cvRaw = txt(p["CV Link"]);
  const rec = {
    id: pg.id,
    field: txt(p["Field"]),
    role: txt(p["Target Role"]) || txt(p["Original Position"]),
    city: txt(p["City"]),
    country: txt(p["Country"]),
    residenceStatus: txt(p["حالة الإقامة"]),
    experience: txt(p["Experience Years"]),
    education: txt(p["Education"]),
    nationalityType: txt(p["Nationality Type"]),
    availability: txt(p["Availability"]),
    languages: txt(p["Languages"]),
    // Where this person has actually worked, so the console can sort a pool of
    // thousands into "has Saudi experience" / "Gulf" / "international".
    region: txt(p["الخبرة الإقليمية"]),
    countries: (p["دول الخبرة"] && p["دول الخبرة"].multi_select ? p["دول الخبرة"].multi_select : []).map((o) => o.name),
    // Whether a partner office supplied this candidate — a boolean only. The
    // office's name, contact and e-mail stay internal and are never sent to a
    // client, on the site or in the console.
    viaPartner: !!txt(p["مكتب الاستقدام"]),
    skills: opts.full ? txt(p["Skills"]) : txt(p["Skills"]).slice(0, 160),
    saudization: txt(p["التوطين Saudization"]),
  };
  if (opts.full) {
    rec.registered = pg.created_time || "";
    rec.interviewDate = p["Interview Date"] && p["Interview Date"].date ? p["Interview Date"].date.start : "";
    rec.hiredDate = p["Hired Date"] && p["Hired Date"].date ? p["Hired Date"].date.start : "";
    rec.pipelineStage = txt(p["Pipeline Stage"]);
    rec.interviewStatus = txt(p["Interview Status"]);
    rec.interviewMode = txt(p["Interview Mode"]);
    rec.interviewLink = txt(p["رابط المقابلة"]);
    rec.interviewPlace = txt(p["مكان المقابلة"]);
  }
  if (unlocked) {
    rec.name = primary;
    rec.nameAlt = secondary;
    rec.phone = txt(p["Phone"]);
    rec.email = txt(p["Email"]);
    // Show the ATS-formatted CV to the client, never the raw original —
    // only fall back to the raw file when no ATS version exists yet.
    rec.cv = cvAts || cvRaw;
    rec.cvKind = cvAts ? "ats" : (cvRaw ? "raw" : "");
    // The actual CV text (not just a link to it), so the profile can be
    // rendered as formatted content on the site itself.
    rec.cvText = txt(p["ATS CV Text"]);
  } else {
    rec.name = maskName(primary);
  }
  return rec;
}

// Owner testing override — always unlocks the top-tier plan, no Notion lookup.
// ENV-ONLY: the old "demo123" default was a public master code exposing the
// whole ATS candidate pool (names/phones/CVs) — repo is public, so any
// hardcoded default is public. No env var → no owner bypass code.
const OWNER_CODE = process.env.OWNER_DEMO_CODE || "";

// Resolve a subscription code → { unlocked, plan }. Checks the owner override,
// then the static EMPLOYER_CODES env (legacy), then the Employers Notion DB
// for an ACTIVE row by access code.
async function resolvePlan(code) {
  if (!code) return { unlocked: false, plan: "" };
  // Access codes are treated case-insensitively — "Demo123"/"DEMO123"/"demo123"
  // all resolve the same way, matching how the front-end already normalizes
  // its own client-only demo trigger codes.
  if (OWNER_CODE && code.toLowerCase() === OWNER_CODE.toLowerCase()) return { unlocked: true, plan: "مؤسسية", owner: true };
  if (CODES.some((c) => c.toLowerCase() === code.toLowerCase())) return { unlocked: true, plan: "" };
  try {
    const r = await fetch(`https://api.notion.com/v1/databases/${EMP_DB}/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
      body: JSON.stringify({
        page_size: 1,
        filter: { and: [
          { property: "رمز الوصول", rich_text: { equals: code } },
          { property: "الحالة", select: { equals: "مفعّل" } },
        ] },
      }),
    });
    if (r.ok) {
      const d = await r.json();
      const row = (d.results || [])[0];
      if (row) {
        const p = row.properties && row.properties["الباقة"] && row.properties["الباقة"].select;
        // The platform owner's account (matched by registered email) also owns
        // the site's own vacancies — see the SITE_ROLES append in list-postings.
        const email = (row.properties && row.properties["البريد"] && row.properties["البريد"].email) || "";
        return { unlocked: true, plan: (p && p.name) || "", owner: email.toLowerCase() === OWNER_EMAIL };
      }
    } else {
      console.error("employer lookup error", r.status, (await r.text()).slice(0, 200));
    }
  } catch (e) { console.error("resolvePlan error", String(e).slice(0, 200)); }
  return { unlocked: false, plan: "" };
}

const OWNER_EMAIL = (process.env.OWNER_EMAIL || "dr.baher.magnas@gmail.com").toLowerCase();

// Portal-session unlock — every signed-in client-portal account gets the
// hiring dashboard during the 30-day platform trial (see api/_trial.js).
// The effective employer code is derived from the session's organization id
// on every request, never taken from the client: a supplied "org:…" code is
// always ignored and re-derived here, so it cannot be forged to reach
// another tenant's postings or the candidate pool.
async function portalUnlock(req) {
  try {
    const sess = await getSession(req);
    const org = sess && sess.organization;
    if (!org || !org.id) return null;
    if (openFor(sess)) return { unlocked: true, plan: "مفتوح لحسابك", code: "org:" + org.id, days: null, portal: true, open: true };
    const t = bdTrial(org, false);
    if (t.state !== "trial") return null;
    return { unlocked: true, plan: "تجربة مجانية", code: "org:" + org.id, days: t.days, portal: true };
  } catch { return null; }
}
// Business Partner's own careers-page roles — static pages in the generator,
// not JOBS_DB rows. Ids are the apply slugs the application stamp uses, so
// applicant grouping lines up with these postings in the console.
const SITE_ROLES = [
  { id: "hr-operations-specialist", title: "أخصائي عمليات موارد بشرية وعلاقات حكومية", city: "الرياض", field: "موارد بشرية", description: "إدارة قوى، التأمينات، مدد، مقيم، وعمليات الموارد البشرية اليومية لعملاء بيزنس بارتنر.", status: "نشطة", site: true, url: "/ar/careers/hr-operations-specialist" },
  { id: "recruitment-coordinator", title: "منسق توظيف", city: "الرياض", field: "موارد بشرية", description: "تنسيق الاستقطاب، فرز السير، المقابلات، المتابعة مع أصحاب العمل والمرشحين.", status: "نشطة", site: true, url: "/ar/careers/recruitment-coordinator" },
  { id: "candidate-pool", title: "قاعدة المرشحين العامة", city: "", field: "عام", description: "التسجيلات العامة في قاعدة المرشحين من الموقع — مرشحون بانتظار مطابقتهم مع وظيفة مناسبة.", status: "نشطة", site: true, url: "/ar/careers#open-jobs" },
];

// Job postings: an employer can open more than one, each with its own title/
// city/description, and pull an AI-screened shortlist against the pool from
// that description via /api/hire (task:"match") on the client side.
async function handlePostings(req, res) {
  const b = await readBody(req);
  let code = String(b.code || "").trim();
  let unlocked = false, owner = false;
  if (code && !code.startsWith("org:")) ({ unlocked, owner } = await resolvePlan(code));
  if (!unlocked) {
    const pu = await portalUnlock(req);
    if (pu) { unlocked = true; owner = false; code = pu.code; }
  }
  if (!unlocked) { res.statusCode = 403; return res.end(JSON.stringify({ ok: false, error: "locked" })); }

  if (b.action === "create-posting") {
    const title = String(b.title || "").trim().slice(0, 200);
    const city = String(b.city || "").trim().slice(0, 120);
    const description = String(b.description || "").trim().slice(0, 4000);
    const field = String(b.field || "").trim();
    if (!title || !description) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
    const props = {
      "العنوان الوظيفي": { title: [{ text: { content: title } }] },
      "رمز صاحب العمل": { rich_text: [{ text: { content: code } }] },
      "الشركة": { rich_text: [{ text: { content: String(b.company || "").trim().slice(0, 200) } }] },
      "المدينة": { rich_text: [{ text: { content: city } }] },
      "الوصف والمتطلبات": { rich_text: [{ text: { content: description } }] },
      "الحالة": { select: { name: "نشطة" } },
    };
    if (FIELD_OPTIONS.includes(field)) props["المجال"] = { select: { name: field } };
    const r = await notionFetch("pages", "POST", { parent: { database_id: JOBS_DB }, properties: props });
    if (!r.ok) { console.error("posting create error", r.status, (await r.text()).slice(0, 300)); res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_failed" })); }
    const page = await r.json();
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, id: page.id, title, city, field, description }));
  }

  // Edit an existing posting in place. Ownership is enforced server-side:
  // the page's "رمز صاحب العمل" must match the caller's code before any patch.
  if (b.action === "update-posting") {
    const id = String(b.id || "").trim();
    if (!id) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
    const pageR = await notionFetch(`pages/${id}`, "GET");
    if (!pageR.ok) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: "not_found" })); }
    const page = await pageR.json();
    const ownerCode = txt(page.properties && page.properties["رمز صاحب العمل"]);
    if (!ownerCode || ownerCode.toLowerCase() !== code.toLowerCase()) {
      res.statusCode = 403;
      return res.end(JSON.stringify({ ok: false, error: "not_owner" }));
    }
    const props = {};
    if (b.title) props["العنوان الوظيفي"] = { title: [{ text: { content: String(b.title).trim().slice(0, 200) } }] };
    if (b.city != null) props["المدينة"] = { rich_text: [{ text: { content: String(b.city).trim().slice(0, 120) } }] };
    if (b.description) props["الوصف والمتطلبات"] = { rich_text: [{ text: { content: String(b.description).trim().slice(0, 4000) } }] };
    if (b.field && FIELD_OPTIONS.includes(String(b.field).trim())) props["المجال"] = { select: { name: String(b.field).trim() } };
    if (b.status === "نشطة" || b.status === "مغلقة") props["الحالة"] = { select: { name: b.status } };
    if (!Object.keys(props).length) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
    const r = await notionFetch(`pages/${id}`, "PATCH", { properties: props });
    if (!r.ok) { console.error("posting update error", r.status, (await r.text()).slice(0, 300)); res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_failed" })); }
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true }));
  }

  if (b.action === "close-posting") {
    const id = String(b.id || "").trim();
    if (!id) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
    const page = await notionFetch(`pages/${id}`, "GET");
    const pdata = page.ok ? await page.json() : null;
    const owner = pdata && txt(pdata.properties && pdata.properties["رمز صاحب العمل"]);
    if (!pdata || owner !== code) { res.statusCode = 403; return res.end(JSON.stringify({ ok: false, error: "forbidden" })); }
    await notionFetch(`pages/${id}`, "PATCH", { properties: { "الحالة": { select: { name: "مغلقة" } } } });
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true }));
  }

  if (b.action === "list-postings") {
    const r = await notionFetch(`databases/${JOBS_DB}/query`, "POST", {
      page_size: 50,
      filter: { property: "رمز صاحب العمل", rich_text: { equals: code } },
      sorts: [{ property: "تاريخ النشر", direction: "descending" }],
    });
    if (!r.ok) { console.error("postings list error", r.status, (await r.text()).slice(0, 300)); res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_failed" })); }
    const data = await r.json();
    const postings = (data.results || []).map((pg) => {
      const p = pg.properties || {};
      return {
        id: pg.id,
        title: txt(p["العنوان الوظيفي"]),
        city: txt(p["المدينة"]),
        field: txt(p["المجال"]),
        description: txt(p["الوصف والمتطلبات"]),
        status: txt(p["الحالة"]),
      };
    });
    // The platform owner's console also lists the site's own careers-page
    // roles (static pages, not JOBS_DB rows) so every advert with applicants
    // is visible in one place.
    if (owner) postings.push(...SITE_ROLES);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, postings }));
  }

  // Moves a candidate through the hiring pipeline (New/Screening/Interview/
  // Offer/Hired/Rejected) — previously this only lived in the employer's own
  // browser (localStorage), so there was no internal record of *when* a
  // candidate was interviewed or hired. Persists the stage to Notion and,
  // the first time a candidate reaches Interview or Hired, stamps that date
  // (never overwritten on later stage changes, so it stays the true first date).
  if (b.action === "update-stage") {
    const id = String(b.id || "").trim();
    const STAGE_MAP = { new: "جديد", screening: "فرز", review: "فرز", shortlist: "قائمة مختصرة", interview: "مقابلة", offer: "عرض", hired: "تم التوظيف", rejected: "مرفوض", future: "مؤجل" };
    const stageAr = STAGE_MAP[String(b.stage || "")];
    if (!id || !stageAr) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
    const page = await notionFetch(`pages/${id}`, "GET");
    if (!page.ok) { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_failed" })); }
    const pdata = await page.json();
    const props = { "Pipeline Stage": { select: { name: stageAr } } };
    const today = new Date().toISOString().slice(0, 10);
    if (stageAr === "مقابلة" && !(pdata.properties && pdata.properties["Interview Date"] && pdata.properties["Interview Date"].date)) {
      props["Interview Date"] = { date: { start: today } };
    }
    if (stageAr === "تم التوظيف" && !(pdata.properties && pdata.properties["Hired Date"] && pdata.properties["Hired Date"].date)) {
      props["Hired Date"] = { date: { start: today } };
    }
    const r = await notionFetch(`pages/${id}`, "PATCH", { properties: props });
    if (!r.ok) { console.error("update-stage error", r.status, (await r.text()).slice(0, 300)); res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_failed" })); }
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true }));
  }

  // An employer asks to meet a candidate. When a partner office supplied that
  // candidate the request is routed to the office to arrange — the employer
  // never learns which office it is, and the office never sees the rest of the
  // employer's pipeline. Both sides only ever see this one candidate.
  if (b.action === "request-interview") {
    const id = String(b.id || "").trim();
    if (!id) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
    const page = await notionFetch(`pages/${id}`, "GET");
    if (!page.ok) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: "not_found" })); }
    const pdata = await page.json();
    const props = pdata.properties || {};
    const office = txt(props["مكتب الاستقدام"]);
    const officeEmail = txt(props["بريد المكتب"]);
    const candidate = txt(props["Candidate Name"]) || txt(props["Name (EN)"]);
    const role = txt(props["Target Role"]) || txt(props["مهنة الترشيح"]);
    const requester = String(b.employer || "").trim().slice(0, 160) || "صاحب عمل";

    const patch = {
      // Routed to the office when one supplied the candidate; otherwise it
      // sits on our own desk to arrange.
      "Interview Status": { select: { name: office ? "بانتظار جدولة المكتب" : "مطلوبة من صاحب العمل" } },
      "طالب المقابلة": { rich_text: [{ text: { content: requester } }] },
    };
    const prefer = String(b.preferred || "").trim().slice(0, 300);
    if (prefer) patch["ملاحظات المقابلة"] = { rich_text: [{ text: { content: `تفضيل صاحب العمل: ${prefer}` } }] };
    const MODES = ["حضوري", "أونلاين", "هاتف"];
    if (MODES.includes(b.mode)) patch["Interview Mode"] = { select: { name: b.mode } };
    const r = await notionFetch(`pages/${id}`, "PATCH", { properties: patch });
    if (!r.ok) { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_failed" })); }

    const inbox = office && officeEmail ? officeEmail : NOTIFY_EMAIL;
    await sendMail(inbox, `📅 طلب مقابلة — ${candidate}`, `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px">
      <h2 style="color:#0B1B5A">صاحب عمل يريد مقابلة مرشّحك</h2>
      <p><b>${htmlEsc(candidate)}</b>${role ? ` — ${htmlEsc(role)}` : ""}</p>
      ${prefer ? `<p>التوقيت المفضّل لصاحب العمل: <b>${htmlEsc(prefer)}</b></p>` : ""}
      <p>جهّز المرشّح واحجز الموعد من بوابتك: <a href="https://businesspartner.sa/ar/agency-portal">بوابة المزوّد</a> ← «طلبات المقابلات».</p>
      <p style="color:#666">لا تشارك بيانات تواصل المرشّح خارج المنصة.</p></div>`);
    if (inbox !== NOTIFY_EMAIL) {
      await sendMail(NOTIFY_EMAIL, `📅 طلب مقابلة أُرسل للمكتب — ${candidate}`, `<div dir="rtl" style="font-family:Arial,sans-serif">
        <p>طلب <b>${htmlEsc(requester)}</b> مقابلة <b>${htmlEsc(candidate)}</b>، وأُشعر مكتب <b>${htmlEsc(office)}</b> بالجدولة.</p></div>`);
    }
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, routed: office ? "office" : "internal" }));
  }

  res.statusCode = 400;
  return res.end(JSON.stringify({ ok: false, error: "bad_action" }));
}

// Small Resend wrapper — this endpoint only sends interview notifications, so
// it does not need the full mailer the portals share.
const RESEND_KEY = envFrom(["RESEND_API_KEY", "RESEND_KEY", "RESEND"]);
const MAIL_FROM = process.env.OTP_FROM_EMAIL || "Business Partner <onboarding@resend.dev>";
const NOTIFY_EMAIL = process.env.BP_NOTIFY_EMAIL || "business@businesspartner.sa";
const htmlEsc = (x) => String(x == null ? "" : x).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
async function sendMail(to, subject, html) {
  if (!RESEND_KEY || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(to || ""))) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, html }),
    });
    return r.ok;
  } catch (e) {
    console.error("candidates sendMail", String(e).slice(0, 160));
    return false;
  }
}

// ---- Indeed XML job feed (?feed=jobs, also served at /jobs-feed.xml, /indeed.xml) ----
// Emits a <source> feed of the workshop-campaign vacancies marked "منشورة على الموقع"
// in the Notion campaign DB, in the format Indeed crawls to index jobs organically.
// Register the feed URL once in Indeed and every published job appears automatically —
// no manual posting. The confidential salary range is intentionally not emitted.
const xmlEsc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const cdata = (s) => "<![CDATA[" + String(s || "").replace(/]]>/g, "]]]]><![CDATA[>") + "]]>";
function feedDescription(slug, title, dept, vacancies) {
  const jd = WORKSHOP_JDS[slug];
  if (jd) {
    return jd.split(/\n{2,}/).map((para) => {
      const lines = para.split("\n").map((l) => l.trim()).filter(Boolean);
      const bullets = lines.filter((l) => l.startsWith("•"));
      if (bullets.length && bullets.length === lines.length) {
        return "<ul>" + bullets.map((b) => `<li>${xmlEsc(b.replace(/^•\s*/, ""))}</li>`).join("") + "</ul>";
      }
      return "<p>" + lines.map(xmlEsc).join("<br/>") + "</p>";
    }).join("");
  }
  const parts = [`<p>${xmlEsc(title)} — ${xmlEsc(FEED_COMPANY)} (${xmlEsc(dept)}).</p>`];
  if (vacancies) parts.push(`<p>Open positions: ${xmlEsc(vacancies)}.</p>`);
  parts.push("<p>Apply through the link to join our events-fabrication workshop team.</p>");
  return parts.join("");
}
async function jobsFeed(res) {
  const jobs = [];
  let cursor;
  do {
    const r = await notionFetch(`databases/${WORKSHOP_DB}/query`, "POST", {
      page_size: 100, start_cursor: cursor,
      filter: { property: "حالة النشر", select: { equals: FEED_PUBLISHED } },
    });
    if (!r.ok) { console.error("jobs feed query error", r.status, (await r.text()).slice(0, 300)); res.statusCode = 502; res.setHeader("Content-Type", "text/plain"); return res.end("notion_failed"); }
    const data = await r.json();
    for (const pg of data.results || []) {
      const p = pg.properties || {};
      const title = txt(p["الوظيفة"]);
      const url = txt(p["رابط الوظيفة"]);
      if (!title || !url) continue;
      const slug = txt(p["معرف الوظيفة ATS"]) || pg.id;
      jobs.push({
        title, url, ref: slug, dept: txt(p["القسم"]), vacancies: txt(p["عدد الشواغر"]),
        date: new Date(pg.last_edited_time || pg.created_time || Date.now()).toUTCString(),
      });
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  const items = jobs.map((j) => [
    "  <job>",
    `    <title>${cdata(j.title)}</title>`,
    `    <date>${cdata(j.date)}</date>`,
    `    <referencenumber>${cdata(j.ref)}</referencenumber>`,
    `    <url>${cdata(j.url)}</url>`,
    `    <company>${cdata(FEED_COMPANY)}</company>`,
    `    <city>${cdata(FEED_CITY)}</city>`,
    `    <state>${cdata(FEED_STATE)}</state>`,
    `    <country>${cdata(FEED_COUNTRY)}</country>`,
    `    <jobtype>${cdata("fulltime")}</jobtype>`,
    `    <category>${cdata(j.dept)}</category>`,
    `    <description>${cdata(feedDescription(j.ref, j.title, j.dept, j.vacancies))}</description>`,
    "  </job>",
  ].join("\n")).join("\n");

  const xml =
    '<?xml version="1.0" encoding="utf-8"?>\n<source>\n' +
    `  <publisher>${xmlEsc(FEED_COMPANY)}</publisher>\n` +
    "  <publisherurl>https://businesspartner.sa</publisherurl>\n" +
    `  <lastBuildDate>${xmlEsc(new Date().toUTCString())}</lastBuildDate>\n` +
    items + (items ? "\n" : "") + "</source>\n";
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=1800, s-maxage=1800");
  return res.end(xml);
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "POST") {
    if (!NOTION_TOKEN) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "not_configured" })); }
    try { return await handlePostings(req, res); } catch (e) { console.error("postings handler error", e); res.statusCode = 500; return res.end(JSON.stringify({ ok: false, error: "server_error" })); }
  }
  if (req.method !== "GET") { res.statusCode = 405; return res.end(JSON.stringify({ error: "method_not_allowed" })); }
  if (!NOTION_TOKEN) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "not_configured" })); }

  const url0 = new URL(req.url, "http://x");
  // Public Indeed XML job feed — no code/auth (served at /jobs-feed.xml & /indeed.xml).
  if (url0.searchParams.get("feed") === "jobs") {
    try { return await jobsFeed(res); }
    catch (e) { console.error("jobs feed handler error", e); res.statusCode = 500; res.setHeader("Content-Type", "text/plain"); return res.end("server_error"); }
  }
  // Public job board: every ACTIVE posting from every employer, for the /careers
  // "Jobs from our employer clients" section — no code/auth needed (unlike the
  // employer-only browse/create/list-postings actions above).
  if (url0.searchParams.get("openJobs") === "1") {
    try {
      const r = await notionFetch(`databases/${JOBS_DB}/query`, "POST", {
        page_size: 50,
        filter: { property: "الحالة", select: { equals: "نشطة" } },
        sorts: [{ property: "تاريخ النشر", direction: "descending" }],
      });
      if (!r.ok) { console.error("open jobs query error", r.status, (await r.text()).slice(0, 300)); res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_failed" })); }
      const data = await r.json();
      const jobs = (data.results || []).map((pg) => {
        const p = pg.properties || {};
        return {
          id: pg.id,
          title: txt(p["العنوان الوظيفي"]),
          company: publisherName(),
          city: txt(p["المدينة"]),
          field: txt(p["المجال"]),
          description: txt(p["الوصف والمتطلبات"]).slice(0, 400),
        };
      }).filter((j) => j.title);
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, jobs }));
    } catch (e) {
      console.error("open jobs handler error", e);
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false, error: "server_error" }));
    }
  }

  // Single public job posting (?posting=<id>) for the per-advert page
  // (/job?id=…). Public on purpose — a job advert is public content — but
  // only active postings resolve, and only advert fields are returned (never
  // the employer code or anything else on the row).
  if (url0.searchParams.get("posting")) {
    try {
      const pid = url0.searchParams.get("posting").trim();
      const r = await notionFetch(`pages/${pid}`, "GET");
      if (r.status === 404) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: "not_found" })); }
      if (!r.ok) { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_failed" })); }
      const pg = await r.json();
      const p = pg.properties || {};
      const title = txt(p["العنوان الوظيفي"]);
      const status = txt(p["الحالة"]);
      if (!title || !p["رمز صاحب العمل"]) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: "not_found" })); }
      res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
      res.statusCode = 200;
      return res.end(JSON.stringify({
        ok: true,
        posting: {
          id: pg.id, title, status,
          company: publisherName(),
          city: txt(p["المدينة"]),
          field: txt(p["المجال"]),
          description: txt(p["الوصف والمتطلبات"]),
          postedAt: pg.created_time,
          open: status !== "مغلقة",
        },
      }));
    } catch (e) {
      console.error("posting handler error", e);
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false, error: "server_error" }));
    }
  }

  // Live pool count (?count=1) — Notion has no COUNT endpoint, so this pages
  // through the visible pool with title-only payloads (filter_properties keeps
  // each response tiny) under a time budget, handing back a cursor so the
  // client can keep adding until the real total. CDN-cached per cursor URL so
  // repeat visitors get the number instantly while it revalidates behind them.
  if (url0.searchParams.get("count") === "1") {
    try {
      res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
      const countCursor = (url0.searchParams.get("cursor") || "").trim() || null;
      // Rows already counted by earlier links in this chain — the client passes
      // it back so the final link knows the real total and can park it.
      const soFar = Math.max(0, Number(url0.searchParams.get("sofar")) || 0);
      // A fresh cached total short-circuits the whole walk. Only on the first
      // link: mid-chain the caller is explicitly asking to keep counting.
      const cached = countCursor ? null : await readCachedCount();
      if (cached && !cached.stale) {
        return res.end(JSON.stringify({ ok: true, total: cached.value, nextCursor: null, done: true, cached: true, countedAt: cached.at }));
      }
      if (!handler._titleProp) {
        const dbr = await notionFetch(`databases/${DB_ID}`, "GET");
        if (dbr.ok) {
          const db = await dbr.json();
          for (const p of Object.values(db.properties || {})) if (p.type === "title") { handler._titleProp = p.id; break; }
        }
      }
      const fp = handler._titleProp ? `?filter_properties=${encodeURIComponent(handler._titleProp)}` : "";
      const deadline = Date.now() + 40000;
      let total = 0, cursor = countCursor, truncated = false;
      for (let guard = 0; guard < 300; guard++) {
        const body = { page_size: 100, filter: { property: "مخفي عن الموقع", checkbox: { equals: false } } };
        if (cursor) body.start_cursor = cursor;
        let r;
        for (let attempt = 0; ; attempt++) {
          r = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query${fp}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
            body: JSON.stringify(body),
          });
          if (r.ok) break;
          if (r.status === 429 && attempt < 4 && Date.now() < deadline) {
            const retryAfter = Number(r.headers.get("retry-after"));
            await new Promise((resolve) => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 300 * Math.pow(2, attempt)));
            continue;
          }
          console.error("pool count query error", r.status, (await r.text()).slice(0, 300));
          res.statusCode = 502;
          return res.end(JSON.stringify({ ok: false, error: "notion_failed" }));
        }
        const data = await r.json();
        total += (data.results || []).length;
        if (!data.has_more || !data.next_cursor) { cursor = null; break; }
        cursor = data.next_cursor;
        if (Date.now() > deadline) { truncated = true; break; }
      }
      res.statusCode = 200;
      const done = !cursor && !truncated;
      // The last link in the chain knows the real total — park it so the next
      // visitor gets the number in one request instead of two hundred.
      if (done) await writeCachedCount(soFar + total, cached && cached.id);
      return res.end(JSON.stringify({ ok: true, total, nextCursor: cursor || null, done, sofar: soFar + total }));
    } catch (e) {
      console.error("pool count handler error", e);
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false, error: "server_error" }));
    }
  }

  const url = new URL(req.url, "http://x");
  const qField = (url.searchParams.get("field") || "").trim();
  const qCity = (url.searchParams.get("city") || "").trim().toLowerCase();
  const qCountry = (url.searchParams.get("country") || "").trim().toLowerCase();
  const qNat = (url.searchParams.get("nat") || "").trim();
  // Where the candidate is right now, and where they have actually worked —
  // the two dimensions an employer sorts a pool of thousands by when deciding
  // between hiring locally and deploying from abroad.
  const qRes = (url.searchParams.get("res") || "").trim();
  const qRegion = (url.searchParams.get("region") || "").trim();
  const qText = (url.searchParams.get("q") || "").trim().toLowerCase();
  let code = (url.searchParams.get("code") || "").trim();
  // Resume a previous, still-in-progress scan (see the time-budget note below)
  // instead of re-querying from the start every time.
  const startCursor = (url.searchParams.get("cursor") || "").trim() || null;
  let unlocked = false, plan = "";
  if (code && !code.startsWith("org:")) ({ unlocked, plan } = await resolvePlan(code));
  let portal = null;
  if (!unlocked) {
    portal = await portalUnlock(req);
    if (portal) { unlocked = true; plan = portal.plan; code = portal.code; }
  }

  // Lightweight code check (?validate=1&code=…) for the login page and the
  // dashboard's saved-code revalidation — one Employers-DB lookup instead of
  // paging the whole candidate pool just to learn whether a code is active.
  // With no (or an "org:…") code it also answers for the portal session, so
  // any signed-in client's dashboard opens itself during the platform trial.
  if (url.searchParams.get("validate") === "1") {
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, unlocked, plan, ...(portal ? { portal: true, code: portal.code, days: portal.days } : {}) }));
  }

  // Per-job applicants for the employer console (?applicants=1&code=…).
  // Every website application stamps its job as "title (id)" into
  // "الوظيفة المتقدم لها" (and, for rows created before that property
  // existed, into Notes as "تقديم عبر الموقع — الوظيفة: title (id)"), so
  // grouping parses that stamp — it covers console postings (JOBS_DB page
  // ids) and careers-campaign slugs alike. Contact fields ride along because
  // reaching this branch already requires a valid employer code.
  if (url.searchParams.get("applicants") === "1") {
    if (!unlocked) { res.statusCode = 403; return res.end(JSON.stringify({ ok: false, error: "locked" })); }
    try {
      let rowsRaw = [];
      let cursor = null, guard = 0;
      // 1,893 people have applied through the site; the old five-page ceiling
      // showed the newest 500 of them and silently dropped the rest, so a job
      // posted a while ago looked like it had no applicants at all. Bounded by
      // the clock as well as the page count, so a growing pool slows this down
      // rather than truncating it without saying so.
      const deadline = Date.now() + 40000;
      do {
        const r = await notionFetch(`databases/${DB_ID}/query`, "POST", {
          page_size: 100,
          ...(cursor ? { start_cursor: cursor } : {}),
          filter: {
            or: [
              { property: "الوظيفة المتقدم لها", rich_text: { is_not_empty: true } },
              { property: "Notes", rich_text: { contains: "تقديم عبر الموقع" } },
            ],
          },
          sorts: [{ timestamp: "created_time", direction: "descending" }],
        });
        if (!r.ok) { console.error("applicants query error", r.status, (await r.text()).slice(0, 300)); break; }
        const d = await r.json();
        rowsRaw = rowsRaw.concat(d.results || []);
        cursor = d.has_more ? d.next_cursor : null;
      } while (cursor && ++guard < 40 && Date.now() < deadline);
      const truncated = !!cursor;

      const STAGE_KEY = { "جديد": "new", "فرز": "review", "قائمة مختصرة": "shortlist", "رُشّح لصاحب عمل": "shortlist", "مقابلة": "interview", "عرض": "offer", "تم التوظيف": "hired", "مرفوض": "rejected", "مؤجل": "future" };
      const groups = {};
      for (const pg of rowsRaw) {
        const p = pg.properties || {};
        if (p["مخفي عن الموقع"] && p["مخفي عن الموقع"].checkbox) continue;
        const stamp = txt(p["الوظيفة المتقدم لها"]);
        const notes = txt(p["Notes"]);
        let m = stamp ? stamp.match(/^(.*?)\s*\(([^()\n]+)\)\s*$/) : null;
        if (!m) m = notes.match(/تقديم عبر الموقع — الوظيفة:\s*([^\n(]+?)\s*\(([^()\n]+)\)/);
        if (!m) continue;
        let jobTitle = m[1].trim(), jobId = m[2].trim();
        if (jobId === "candidate-pool") jobTitle = "قاعدة المرشحين العامة";
        const key = jobId || jobTitle;
        if (!groups[key]) groups[key] = { jobId, jobTitle, applicants: [] };
        const scoreM = notes.match(/score\s*(\d{1,3})\s*\/\s*100/i);
        groups[key].applicants.push({
          id: pg.id,
          name: txt(p["Candidate Name"]),
          role: txt(p["Target Role"]) || txt(p["Original Position"]),
          city: txt(p["City"]),
          nationalityType: txt(p["Nationality Type"]),
          stage: STAGE_KEY[txt(p["Pipeline Stage"])] || "new",
          score: scoreM ? Number(scoreM[1]) : null,
          registered: pg.created_time,
          experience: (p["Experience Years"] && p["Experience Years"].number) || 0,
          skills: txt(p["Skills"]),
          email: txt(p["Email"]),
          phone: txt(p["Phone"]),
          cv: (p["CV Link"] && p["CV Link"].url) || (p["ATS CV (Drive)"] && p["ATS CV (Drive)"].url) || "",
        });
      }
      res.statusCode = 200;
      // Say so when the pool outgrew even the raised ceiling, rather than
      // handing back a short list that looks complete.
      return res.end(JSON.stringify({ ok: true, jobs: Object.values(groups), scanned: rowsRaw.length, truncated }));
    } catch (e) {
      console.error("applicants handler error", e);
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false, error: "server_error" }));
    }
  }

  // Single-candidate detail lookup for the dedicated /candidate-profile page
  // — one cheap page GET instead of paging the whole filtered pool, with the
  // exact same locked/unlocked masking as the browse list.
  const qId = (url.searchParams.get("id") || "").trim();
  if (qId) {
    const page = await notionFetch(`pages/${qId}`, "GET");
    if (page.status === 404) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: "not_found" })); }
    if (!page.ok) { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_failed" })); }
    const pdata = await page.json();
    if (pdata.properties && pdata.properties["مخفي عن الموقع"] && pdata.properties["مخفي عن الموقع"].checkbox) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ ok: false, error: "not_found" }));
    }
    const cand = mapCandidate(pdata, unlocked, { full: true });
    // The formatted ATS CV usually lives as the candidate PAGE BODY in Notion
    // (structured sections), not in the "ATS CV Text" property — read the
    // blocks as a markdown-ish fallback so the site can render the CV inline
    // instead of only offering a file download.
    if (unlocked && !cand.cvText) {
      try {
        let cur = null, guard = 0;
        const out = [];
        do {
          const br = await notionFetch(`blocks/${qId}/children?page_size=100${cur ? `&start_cursor=${cur}` : ""}`, "GET");
          if (!br.ok) break;
          const bd = await br.json();
          for (const blk of bd.results || []) {
            const t = blk[blk.type];
            if (!t || !Array.isArray(t.rich_text)) continue;
            const line = t.rich_text.map((x) => x.plain_text).join("");
            if (!line.trim()) continue;
            const pre = /^heading/.test(blk.type) ? "## " : /list_item$/.test(blk.type) ? "- " : "";
            out.push(pre + line);
          }
          cur = bd.has_more ? bd.next_cursor : null;
        } while (cur && ++guard < 5);
        if (out.length) cand.cvText = out.join("\n");
      } catch (e) { console.error("cv body read error", String(e).slice(0, 120)); }
    }
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, unlocked, plan, candidate: cand }));
  }

  // Server-side Notion filter: only the website-sourced / active candidates.
  // "مخفي عن الموقع" = true means the CV failed to parse / is unreadable — the
  // ingestion pipeline flags it for review and it must never reach employers.
  // City/country/field/nationality are pushed into the query too (not just
  // filtered from the fetched page client-side) so a filtered search doesn't
  // have to page through the whole ~17k-row database to find a few hundred matches.
  const notHidden = { property: "مخفي عن الموقع", checkbox: { equals: false } };
  const andFilters = [notHidden];
  if (qField) andFilters.push({ property: "Field", select: { equals: qField } });
  if (qCity) andFilters.push({ property: "City", rich_text: { contains: qCity } });
  if (qCountry) andFilters.push({ property: "Country", rich_text: { contains: qCountry } });
  if (qNat) andFilters.push({ property: "Nationality Type", select: { equals: qNat } });
  // "inside" is every residence state that isn't "outside" — an employer
  // thinking "already here" doesn't care which iqama class it is.
  if (qRes === "داخل السعودية") andFilters.push({ property: "حالة الإقامة", select: { does_not_equal: "خارج السعودية" } });
  else if (qRes) andFilters.push({ property: "حالة الإقامة", select: { equals: qRes } });
  if (qRegion) andFilters.push({ property: "الخبرة الإقليمية", select: { equals: qRegion } });
  const base = {
    page_size: 100,
    sorts: [{ property: "Candidate ID", direction: "descending" }],
    filter: andFilters.length > 1 ? { and: andFilters } : notHidden,
  };

  try {
    // Page through the (filtered) result set so employers see ALL matching
    // candidates, not just the first page (Notion caps a page at 100) — but
    // bounded by a wall-clock time budget, not just a page-count guard: the
    // pool (~17k rows and growing) can take longer to fully page through than
    // Vercel's function timeout allows in one request. Rather than silently
    // truncating at whatever page happens to be in flight when the platform
    // kills the function (which is what produced a suspicious flat "10000"
    // total in production), this stops itself early at a safe margin, reports
    // exactly how far it actually got, and hands back a cursor so the caller
    // can resume the scan — main.js's loadMore() does this automatically in
    // the background so the displayed count keeps climbing to the real total
    // instead of freezing on a partial number.
    const deadline = Date.now() + 45000;
    let results = [];
    let cursor = startCursor;
    let truncated = false;
    for (let guard = 0; guard < 300; guard++) {
      const body = cursor ? { ...base, start_cursor: cursor } : base;
      // A full scan can take 100+ sequential requests against Notion's
      // ~3 req/s rate limit, so a single 429 mid-scan used to fail the whole
      // request (that's what "Couldn't query Notion" meant in practice, not
      // an actual sharing/permission problem). Retry 429s a few times with
      // backoff (honoring Retry-After when Notion sends one) before giving up.
      let r, data;
      for (let attempt = 0; ; attempt++) {
        r = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
          method: "POST",
          headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (r.ok) { data = await r.json(); break; }
        if (r.status === 429 && attempt < 4 && Date.now() < deadline) {
          const retryAfter = Number(r.headers.get("retry-after"));
          const waitMs = retryAfter > 0 ? retryAfter * 1000 : 300 * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }
        console.error("Notion query error", r.status, (await r.text()).slice(0, 400));
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, error: "notion_failed" }));
      }
      results = results.concat(data.results || []);
      if (!data.has_more || !data.next_cursor) { cursor = null; break; }
      cursor = data.next_cursor;
      if (Date.now() > deadline) { truncated = true; break; }
    }
    let rows = results.map((pg) => mapCandidate(pg, unlocked));

    // Free-text search across role/skills/field — no clean single Notion
    // filter for an OR-across-properties "contains", so it's applied here
    // against the already city/nationality/field-filtered rows from Notion.
    if (qText) rows = rows.filter((x) => (x.role + " " + x.skills + " " + x.field).toLowerCase().includes(qText));

    res.statusCode = 200;
    // nextCursor/done let the client resume the scan in the background (see
    // main.js's loadMore()) instead of trusting a single request to fetch the
    // entire filtered pool — the count it displays keeps climbing to the real
    // total instead of silently freezing on whatever fit in one time budget.
    return res.end(JSON.stringify({
      ok: true, unlocked, plan, total: rows.length, candidates: rows,
      nextCursor: cursor || null, done: !cursor && !truncated,
    }));
  } catch (e) {
    console.error("candidates handler error", e);
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "server_error" }));
  }
}
