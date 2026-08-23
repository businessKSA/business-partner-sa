// Business Partner — overseas recruitment agency registry + agency portal (ESM).
//
// Recruitment offices and agencies OUTSIDE Saudi Arabia register themselves,
// the owner reviews and approves, and an approved agency signs in to see the
// hiring demand addressed to it and to submit candidates against it.
//
// Two Notion databases back this (under "HR & Recruitment Center"):
//   Agencies         — the registry. An agency can only sign in once the owner
//                      sets الحالة = معتمد, which emails it an access code.
//   AgencyRequests   — one demand order per requirement. An agency sees the
//                      orders addressed to it plus any marked open to all.
// Candidate submissions land in the existing ATS database, carrying the
// agency's name so every profile stays attributable to who supplied it.
//
// Routes (all under /api/agencies, rewritten to /api/requests?__route=agencies)
//   POST {type:"register", ...}                public  — agency signs up
//   POST {type:"login", email, code}           agency  — returns its profile
//   GET  ?action=requests&email=&code=         agency  — demand orders for it
//   GET  ?action=submissions&email=&code=      agency  — candidates it sent
//   POST {type:"submit-candidate", ...}        agency  — send a candidate
//   GET  ?action=admin&key=                    owner   — registry + requests
//   POST {type:"approve", key, id, decision}   owner   — approve/suspend + code
//
// Env: NOTION_TOKEN, RESEND_API_KEY, OTP_FROM_EMAIL, BP_NOTIFY_EMAIL,
//      PANEL_KEY/LEADS_KEY (owner actions), NOTION_AGENCIES_DB,
//      NOTION_AGENCY_REQUESTS_DB, NOTION_ATS_DB.
//
// Underscore-prefixed so Vercel treats it as a module, not another serverless
// function — the plan caps at 12 and this repo is at the cap.

import { randomBytes, timingSafeEqual, createHmac, randomInt } from "crypto";
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
    status: txt(p["الحالة"]),
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

// Every sign-in path — access code, Google, or an emailed code — ends here:
// proving the address is not enough, the owner must also have approved the
// office, so a pending or suspended agency still sees nothing.
function gateApproved(agency) {
  if (!agency) return { ok: false, error: "invalid_credentials" };
  if (agency.status !== "معتمد") return { ok: false, error: "not_approved", status: 403, agencyStatus: agency.status };
  return { ok: true, agency };
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
  if (agency.status !== "معتمد") return { ok: false, error: "not_approved", status: 403, agencyStatus: agency.status };
  return { ok: true, agency };
}

export async function handleAgencies(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
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
          return { id: pg.id, title: txt(p["عنوان الطلب"]), status: txt(p["الحالة"]), count: txt(p["العدد المطلوب"]), profession: txt(p["المهنة"]) };
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
        filter: { property: "Matched Employer", rich_text: { equals: auth.agency.name } },
        sorts: [{ timestamp: "created_time", direction: "descending" }],
      });
      if (!r.ok) { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_failed" })); }
      const submissions = (((r.json || {}).results) || []).map((pg) => {
        const p = pg.properties || {};
        return {
          id: pg.id,
          name: txt(p["Candidate Name"]),
          role: txt(p["Target Role"]),
          nationality: txt(p["Nationality"]),
          stage: txt(p["Pipeline Stage"]),
          job: txt(p["الوظيفة المتقدم لها"]),
          submitted: pg.created_time || "",
        };
      });
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, submissions }));
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

    const KINDS = ["مكتب استقدام", "وكالة توظيف", "الاثنان"];
    const YESNO = ["نعم", "لا"];
    const MUSANED = ["نعم", "لا", "قيد التسجيل"];
    const props = {
      "اسم المكتب": { title: [{ text: { content: name } }] },
      "البريد": { email },
      "الدولة": { rich_text: rt(country) },
      "الجوال": { phone_number: phone },
    };
    if (KINDS.includes(b.kind)) props["نوع الجهة"] = { select: { name: b.kind } };
    if (MUSANED.includes(b.musaned)) props["مسجل في مساند"] = { select: { name: b.musaned } };
    if (YESNO.includes(b.ksaExperience)) props["تعامل سابق مع السعودية"] = { select: { name: b.ksaExperience } };
    const textFields = [
      ["city", "المدينة"], ["license", "رقم الترخيص"], ["licenseBy", "جهة الترخيص"],
      ["contact", "جهة الاتصال"], ["role", "المنصب"], ["whatsapp", "واتساب"],
      ["nationalities", "الجنسيات المتاحة"], ["professions", "المهن والتخصصات"], ["about", "نبذة"],
    ];
    for (const [key, prop] of textFields) if (clip(b[key], 1900)) props[prop] = { rich_text: rt(b[key]) };
    if (/^https?:\/\//i.test(clip(b.website, 300))) props["الموقع الإلكتروني"] = { url: clip(b.website, 300) };
    const capacity = Number(b.capacity);
    if (Number.isFinite(capacity) && capacity > 0) props["الطاقة الشهرية"] = { number: Math.round(capacity) };
    const years = Number(b.years);
    if (Number.isFinite(years) && years >= 0) props["سنوات الخبرة"] = { number: Math.round(years) };

    // The company profile is filed onto the registry row itself, so the owner
    // reviews the licence and the profile in one place.
    const pf = b.profileFile && typeof b.profileFile === "object" ? b.profileFile : null;
    if (pf && typeof pf.base64 === "string" && pf.base64 && Number(pf.size) <= 8 * 1024 * 1024) {
      const uploadId = await uploadToNotion(pf.base64, clip(pf.name, 200) || "company-profile.pdf", clip(pf.type, 120));
      if (uploadId) props["المستندات"] = { files: [{ type: "file_upload", file_upload: { id: uploadId }, name: clip(pf.name, 100) || "company-profile" }] };
    }

    let r;
    if (dupe) {
      r = await notion(`pages/${dupe.id}`, "PATCH", { properties: props });
    } else {
      props["الحالة"] = { select: { name: "جديد" } };
      r = await notion("pages", "POST", { parent: { database_id: AGENCIES_DB }, properties: props, icon: { type: "emoji", emoji: "🌍" } });
    }
    if (!r.ok) { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_failed" })); }

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
    await sendEmail(email, "تم استلام طلب تسجيل مكتبك — Business Partner", `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:520px">
      <h2 style="color:#0B1B5A">وصلنا طلبك ✅</h2>
      <p>شكراً لتسجيل <b>${esc(name)}</b> في شبكة مكاتب الاستقدام ووكالات التوظيف لدى Business Partner.</p>
      <p>سيراجع فريقنا بيانات الترخيص، وعند الاعتماد سيصلك <b>رمز دخول</b> إلى بوابة المكاتب لمتابعة الطلبات ورفع المرشحين.</p></div>`);

    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, updated: !!dupe }));
  }

  // ---------------- agency login ----------------
  if (type === "login") {
    const auth = await authAgency(b.email, b.code);
    if (!auth.ok) { res.statusCode = auth.status || 401; return res.end(JSON.stringify({ ok: false, error: auth.error, agencyStatus: auth.agencyStatus })); }
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, agency: auth.agency }));
  }

  // ---------------- agency submits a candidate ----------------
  if (type === "submit-candidate") {
    const auth = await authAgency(b.email, b.code);
    if (!auth.ok) { res.statusCode = auth.status || 401; return res.end(JSON.stringify({ ok: false, error: auth.error, agencyStatus: auth.agencyStatus })); }
    const name = clip(b.candidateName, 200);
    const role = clip(b.role, 160);
    if (!name || !role) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }

    const candEmail = isEmail(clip(b.candidateEmail, 160)) ? clip(b.candidateEmail, 160).toLowerCase() : "";
    const candPhone = clip(b.candidatePhone, 40);
    const jobTitle = clip(b.requestTitle, 200);
    const jobId = clip(b.requestId, 120) || "agency-submission";
    const cvFile = b.cvFile && typeof b.cvFile === "object" ? {
      name: clip(b.cvFile.name, 220),
      type: clip(b.cvFile.type, 120),
      size: Number(b.cvFile.size) || 0,
      base64: typeof b.cvFile.base64 === "string" ? b.cvFile.base64 : "",
    } : null;

    // Same payload shape the careers form sends, so the n8n workflow needs no
    // special case: it reads the CV, files it on Drive, builds the ATS-friendly
    // version and returns the screening result.
    const n8n = await forwardToN8n({
      source: "agency-portal",
      receivedAt: new Date().toISOString(),
      agency: { id: auth.agency.id, name: auth.agency.name, country: auth.agency.country },
      candidate: {
        name, phone: candPhone, email: candEmail, field: role,
        fieldCategory: guessField(role), experience: clip(b.experience, 40),
        city: clip(b.city, 80), country: clip(b.country, 80) || auth.agency.country,
        nationality: clip(b.nationality, 80), residenceStatus: "خارج السعودية",
        salary: clip(b.salary, 80), linkedin: "", consent: true,
      },
      job: { id: jobId, title: jobTitle || "طلب استقدام" },
      questions: {},
      cvFile,
      ats: { notionDatabaseId: ATS_DB },
    });

    const notes = [
      `مرشّح مقدَّم من مكتب: ${auth.agency.name} (${auth.agency.country})`,
      jobTitle ? `على الطلب/الوظيفة: ${jobTitle}` : "",
      clip(b.notes, 900) ? `ملاحظات المكتب: ${clip(b.notes, 900)}` : "",
    ].filter(Boolean).join("\n");

    const props = {
      "Candidate Name": { title: [{ text: { content: name } }] },
      "Target Role": { rich_text: rt(role) },
      "Source": { select: { name: "ترشيح" } },
      "Matched Employer": { rich_text: rt(auth.agency.name) },
      "Notes": { rich_text: rt(notes) },
      "مخفي عن الموقع": { checkbox: false },
      // Agency candidates are overseas by definition — the employer console
      // reads these two to show them as ready for interview and deployment.
      "حالة الإقامة": { select: { name: "خارج السعودية" } },
      "Nationality Type": { select: { name: "غير سعودي" } },
      "الوظيفة المتقدم لها": { rich_text: rt(`${jobTitle || "طلب استقدام"} (${jobId})`) },
    };
    if (candPhone) props["Phone"] = { phone_number: candPhone };
    if (candEmail) props["Email"] = { email: candEmail };
    if (clip(b.nationality, 80)) props["Nationality"] = { rich_text: rt(b.nationality) };
    if (clip(b.city, 80)) props["City"] = { rich_text: rt(b.city) };
    if (clip(b.country, 80) || auth.agency.country) props["Country"] = { rich_text: rt(clip(b.country, 80) || auth.agency.country) };
    if (clip(b.skills, 900)) props["Skills"] = { rich_text: rt(b.skills) };
    const fieldCat = guessField(role);
    if (fieldCat) props["Field"] = { select: { name: fieldCat } };
    const exp = Number(b.experience);
    if (Number.isFinite(exp) && exp >= 0) props["Experience Years"] = { number: Math.round(exp) };
    if (/^https?:\/\//i.test(clip(b.cvUrl, 500))) props["CV Link"] = { url: clip(b.cvUrl, 500) };

    // De-duplicate against the pool exactly like the public form does, so a
    // candidate already known to us is updated rather than doubled.
    const existing = await findExisting(candEmail, candPhone).catch(() => null);
    let r;
    if (existing) {
      applyN8nEnrichment(props, n8n, false);
      r = await notion(`pages/${existing.id}`, "PATCH", { properties: props });
    } else {
      props["Pipeline Stage"] = { select: { name: "جديد" } };
      props["حالة القراءة"] = { select: { name: "مكتمل" } };
      applyN8nEnrichment(props, n8n, true);
      r = await notion("pages", "POST", { parent: { database_id: ATS_DB }, properties: props });
    }
    if (!r.ok) { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_failed" })); }

    const enriched = n8n && n8n.ok && n8n.data ? n8n.data : null;
    await sendEmail(NOTIFY, `👤 مرشّح جديد من ${auth.agency.name} — ${name}`, `<div dir="rtl" style="font-family:Arial,sans-serif">
      <p>رفع مكتب <b>${esc(auth.agency.name)}</b> مرشّحاً${cvFile && cvFile.name ? " مع سيرة ذاتية مرفقة" : ""}:</p>
      <p><b>${esc(name)}</b> — ${esc(role)}${b.nationality ? " · " + esc(clip(b.nationality, 80)) : ""}</p>
      <p style="color:#666">${esc(jobTitle || "بدون طلب محدد")}</p>
      ${enriched && enriched.drive && enriched.drive.atsCvDocUrl ? `<p><a href="${esc(enriched.drive.atsCvDocUrl)}">السيرة الذاتية ATS</a></p>` : ""}</div>`);

    res.statusCode = 200;
    return res.end(JSON.stringify({
      ok: true,
      id: r.json && r.json.id,
      updated: !!existing,
      // Tell the office what actually happened to the file it attached.
      cvProcessed: !!(enriched && enriched.drive && (enriched.drive.atsCvDocUrl || enriched.drive.originalCvUrl)),
      atsCv: enriched && enriched.drive ? enriched.drive.atsCvDocUrl || "" : "",
    }));
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
    if (!hit) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: "not_registered", email: g.email })); }
    const gate = gateApproved(hit.agency);
    if (!gate.ok) { res.statusCode = gate.status || 401; return res.end(JSON.stringify({ ok: false, error: gate.error, agencyStatus: gate.agencyStatus })); }
    // Hand back the office's own access code so the portal can keep using the
    // existing session shape for its data calls.
    const code = txt(hit.row.properties["رمز الوصول"]);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, agency: gate.agency, email: g.email, code }));
  }

  // ---------------- sign in with an emailed code ----------------
  if (type === "email-code") {
    if (!OTP_SECRET) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "not_configured" })); }
    const email = clip(b.email, 160).toLowerCase();
    if (!isEmail(email)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_email" })); }
    const hit = await agencyByEmail(email);
    // The response never reveals whether an address is registered; a code is
    // only actually sent to a registered, approved office.
    if (hit && hit.agency.status === "معتمد") {
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
    const code = txt(hit.row.properties["رمز الوصول"]);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, agency: gate.agency, email, code }));
  }

  // ---------------- owner: approve / suspend, issuing the access code ----------------
  if (type === "approve") {
    if (!ownerOk(b.key)) { res.statusCode = 403; return res.end(JSON.stringify({ ok: false, error: "forbidden" })); }
    const id = clip(b.id, 60);
    const decision = ["معتمد", "موقوف", "مرفوض", "قيد المراجعة"].includes(b.decision) ? b.decision : "";
    if (!id || !decision) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }

    const page = await notion(`pages/${id}`, "GET");
    if (!page.ok) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: "not_found" })); }
    const agency = mapAgency(page.json);
    const props = { "الحالة": { select: { name: decision } } };
    if (clip(b.note, 900)) props["ملاحظات المراجعة"] = { rich_text: rt(b.note) };

    // Approval mints the access code once and keeps it stable afterwards, so
    // re-approving a suspended agency does not invalidate a code it already has.
    let code = txt(page.json.properties["رمز الوصول"]);
    if (decision === "معتمد" && !code) {
      code = makeCode();
      props["رمز الوصول"] = { rich_text: rt(code) };
    }
    const r = await notion(`pages/${id}`, "PATCH", { properties: props });
    if (!r.ok) { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_failed" })); }

    if (decision === "معتمد" && isEmail(agency.email)) {
      await sendEmail(agency.email, "تم اعتماد مكتبك — رمز الدخول للبوابة", `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:520px">
        <h2 style="color:#0B1B5A">تم اعتماد ${esc(agency.name)} ✅</h2>
        <p>أصبح بإمكانك الدخول إلى بوابة مكاتب الاستقدام لمتابعة طلبات التوظيف ورفع مرشحيك.</p>
        <p>رمز الدخول الخاص بك:</p>
        <p style="font-size:26px;font-weight:bold;letter-spacing:3px;color:#0B1B5A">${esc(code)}</p>
        <p>ادخل من: <a href="https://www.businesspartner.sa/ar/agency-portal">بوابة مكاتب الاستقدام</a> باستخدام بريدك ورمز الدخول.</p>
        <p style="color:#666">احتفظ بالرمز، ولا تشاركه خارج فريقك.</p></div>`);
    }
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, code: decision === "معتمد" ? code : undefined }));
  }

  res.statusCode = 400;
  return res.end(JSON.stringify({ ok: false, error: "unknown_type" }));
}
