import crypto from "node:crypto";

// Business Partner 3.0 — client requests serverless function (ESM).
// Handles two request types from the site:
//   type "event"    — corporate event request from /tourism (company email required)
//   type "supplier" — supplier registration from /suppliers
// Emails the team (+ a confirmation to the requester) via Resend and returns a
// reference number. Works without RESEND_API_KEY too (front-end then offers
// the WhatsApp fallback).
//
// Env vars: RESEND_API_KEY, OTP_FROM_EMAIL, BOOKING_EMAIL (same as api/book.js)

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM = process.env.OTP_FROM_EMAIL || "Business Partner <onboarding@resend.dev>";
const TEAM_EMAIL = process.env.BOOKING_EMAIL || "business@businesspartner.sa";

// ---- CRM (Notion "Sales Pipeline") + newsletter audience ----
const envFrom = (names) => { for (const n of names) { if (process.env[n] && String(process.env[n]).trim()) return String(process.env[n]).trim(); } return ""; };
const NOTION_TOKEN = envFrom(["NOTION_TOKEN", "BusinessPartnerSiteNotion", "NOTION_SECRET", "NOTION_API_KEY", "NOTION_KEY", "NOTION_INTEGRATION_TOKEN", "NOTION"]);
const CRM_DB = process.env.NOTION_CRM_DB || "d9a342be24774be3b4095d439d21fc90";
// Owner key that gates the internal dashboard's "incoming requests" list
// (GET ?action=leads&key=...). Set LEADS_KEY (or DASHBOARD_KEY) in Vercel env.
const LEADS_KEY = process.env.LEADS_KEY || process.env.DASHBOARD_KEY || "";
const RESEND_AUDIENCE = process.env.RESEND_AUDIENCE_ID || "";
const NOTION_VERSION = "2022-06-28";
const LEAD_WEBHOOK = process.env.LEAD_WEBHOOK_URL || "";
async function forwardLead(payload) {
  if (!LEAD_WEBHOOK) return;
  try { await fetch(LEAD_WEBHOOK, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); } catch {}
}

// Live order status lookup (merged from the former api/order-status.js — Vercel
// Hobby caps a deployment at 12 serverless functions, so this rides on the GET
// branch of /api/requests instead of its own endpoint).
// GET /api/requests?refs=BP-506275,BP-988015 -> { ok, statuses: { "BP-506275": "قيد المراجعة", ... }, agents: { "BP-506275": ["badr"] }, emails: { "BP-506275": "client@x.com" } }
// `agents`/`emails` let the AI-employees portal treat a client's own order
// reference as their activation code: once the order status is flipped to a
// confirmed state (see CONFIRMED_ORDER_STATUSES), the portal unlocks exactly
// the agent slugs that were purchased with that order — but only when the
// email typed at login matches the email the order was placed under, so a
// leaked/guessed reference can't be used to unlock someone else's agents.
const CONFIRMED_ORDER_STATUSES = new Set(["مؤكد - قيد التنفيذ", "مكتمل"]);

// Demo/test codes for the AI-employees portal — checked here (server-side)
// instead of shipping the list in the page's client-side JS, so codes meant
// only for internal package-size testing aren't readable via view-source.
// BP-DEMO/demo123 are intentionally advertised on the login screen for public
// trial; the others are for testing specific bundle sizes and stay unlisted.
const DEMO_CODES = {
  "BP-DEMO": "ALL",
  "BP2026": "ALL",
  "DEMO123": "ALL",
  "TRIAL": "ALL",
  "DEMO-ONE": ["badr"],
  "DEMO-THREE": ["badr", "malak", "farah"],
  "DEMO-TEAM": ["baher", "mazen", "nasser", "mishari", "abdulaziz", "badr", "farah", "malak", "mohammed", "ahmed", "abdulrahman", "strategy"],
};
// Public, self-serve free trial (advertised on /connect and /ai-agents) —
// unlocks every agent like the other demo codes, but the client enforces a
// capped number of real messages per agent before prompting to subscribe.
// BP-DEMO/BP2026/DEMO123 stay unlimited — those are for the owner/internal testing.
const TRIAL_CODES = new Set(["TRIAL"]);

async function orderStatuses(refs) {
  if (!refs.length) return { statuses: {}, agents: {}, emails: {} };
  if (!NOTION_TOKEN) return { statuses: {}, agents: {}, emails: {} };
  const r = await fetch(`https://api.notion.com/v1/databases/${CRM_DB}/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
    body: JSON.stringify({
      page_size: refs.length,
      filter: { or: refs.map((ref) => ({ property: "رقم المرجع", rich_text: { equals: ref } })) },
    }),
  });
  if (!r.ok) {
    console.error("order-status query error", r.status, (await r.text()).slice(0, 300));
    throw new Error("notion_failed");
  }
  const data = await r.json();
  const statuses = {};
  const agents = {};
  const emails = {};
  for (const pg of data.results || []) {
    const p = pg.properties || {};
    const refText = (p["رقم المرجع"] && p["رقم المرجع"].rich_text || []).map((t) => t.plain_text).join("").trim();
    const status = p["حالة الطلب"] && p["حالة الطلب"].select && p["حالة الطلب"].select.name;
    if (refText && status) statuses[refText] = status;
    if (refText && status && CONFIRMED_ORDER_STATUSES.has(status)) {
      const notesText = ((p["Notes"] && p["Notes"].rich_text) || []).map((t) => t.plain_text).join("");
      const m = notesText.match(/AGENTS:([a-z0-9,]+)/i);
      // "all" is the bundle entitlement (e.g. the shared-services team SKU) —
      // the portal expects the literal string "ALL" to unlock every employee.
      if (m) {
        const list = m[1].split(",").filter(Boolean);
        agents[refText] = list.map((s) => s.toLowerCase()).includes("all") ? "ALL" : list;
      }
      const em = notesText.match(/البريد:\s*([^\s·]+@[^\s·]+)/);
      if (em) emails[refText] = em[1];
    }
  }
  return { statuses, agents, emails };
}

// Compliance Agent subscribers sign in to the same /portal with the access
// code (رمز الدخول, BP-XXXXXX) emailed on activation — the legacy Astro site
// that used to host their dashboard at businesspartner.sa/ar/portal was
// removed and the domain now serves this site, so the unified portal resolves
// their code here and unlocks Mishari (the compliance agent) for them.
async function complianceByCode(refs) {
  if (!refs.length || !NOTION_TOKEN) return { statuses: {}, agents: {}, emails: {} };
  const r = await fetch(`https://api.notion.com/v1/databases/${COMPLIANCE_DB}/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
    body: JSON.stringify({
      page_size: refs.length,
      filter: { or: refs.map((ref) => ({ property: "رمز الدخول", rich_text: { equals: ref } })) },
    }),
  });
  if (!r.ok) {
    console.error("compliance-code query error", r.status, (await r.text()).slice(0, 300));
    throw new Error("notion_failed");
  }
  const data = await r.json();
  const statuses = {}, agents = {}, emails = {};
  for (const pg of data.results || []) {
    const p = pg.properties || {};
    const code = ((p["رمز الدخول"] && p["رمز الدخول"].rich_text) || []).map((t) => t.plain_text).join("").trim();
    if (!code) continue;
    const active = p["حالة الاشتراك"] && p["حالة الاشتراك"].select && p["حالة الاشتراك"].select.name === "نشط";
    statuses[code] = active ? "مكتمل" : "قيد المراجعة";
    if (active) {
      agents[code] = ["mishari"];
      const em = p["البريد"] && p["البريد"].email;
      if (em) emails[code] = em;
    }
  }
  return { statuses, agents, emails };
}

// List the most recent leads from the CRM (for the internal dashboard's
// "incoming requests" view). Returns lightweight rows the dashboard renders,
// including the phone (parsed from Notes) so the team can WhatsApp the lead.
async function listLeads(limit) {
  if (!NOTION_TOKEN) return [];
  const r = await fetch(`https://api.notion.com/v1/databases/${CRM_DB}/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
    body: JSON.stringify({
      page_size: Math.min(Math.max(Number(limit) || 30, 1), 50),
      sorts: [{ property: "Last Activity", direction: "descending" }],
    }),
  });
  if (!r.ok) { console.error("leads query error", r.status, (await r.text()).slice(0, 300)); throw new Error("notion_failed"); }
  const data = await r.json();
  const txt = (arr) => (arr || []).map((t) => t.plain_text).join("");
  return (data.results || []).map((pg) => {
    const p = pg.properties || {};
    const title = txt(p["Opportunity Name"] && p["Opportunity Name"].title);
    const ref = txt(p["رقم المرجع"] && p["رقم المرجع"].rich_text).trim();
    const notes = txt(p["Notes"] && p["Notes"].rich_text);
    const stage = (p["Stage"] && p["Stage"].select && p["Stage"].select.name) || "";
    const status = (p["حالة الطلب"] && p["حالة الطلب"].select && p["حالة الطلب"].select.name) || "";
    const at = (p["Last Activity"] && p["Last Activity"].date && p["Last Activity"].date.start) || (pg.created_time || "").slice(0, 10);
    const phoneM = notes.match(/الجوال:\s*([+\d][\d\s()-]{5,})/);
    const emailM = notes.match(/البريد:\s*([^\s·]+@[^\s·]+)/);
    return {
      title, ref, at, stage, status,
      phone: phoneM ? phoneM[1].replace(/[\s()-]/g, "").trim() : "",
      email: emailM ? emailM[1] : "",
    };
  });
}

// Upload a base64 file to Notion's File Upload API. Returns the file_upload id
// (attachable to a page's "files" property) or null if it fails — never blocks
// the order itself, since the n8n agent can also be pointed at a fallback.
async function uploadFileToNotion(base64, filename, contentType) {
  if (!NOTION_TOKEN || !base64) return null;
  try {
    const createRes = await fetch("https://api.notion.com/v1/file_uploads", {
      method: "POST",
      headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!createRes.ok) { console.error("Notion file_uploads create error", createRes.status, (await createRes.text()).slice(0, 300)); return null; }
    const created = await createRes.json();
    const buf = Buffer.from(base64, "base64");
    const form = new FormData();
    form.append("file", new Blob([buf], { type: contentType || "application/pdf" }), filename || "receipt.pdf");
    const sendRes = await fetch(`https://api.notion.com/v1/file_uploads/${created.id}/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION },
      body: form,
    });
    if (!sendRes.ok) { console.error("Notion file_uploads send error", sendRes.status, (await sendRes.text()).slice(0, 300)); return null; }
    return created.id;
  } catch (e) { console.error("uploadFileToNotion exception", String(e).slice(0, 200)); return null; }
}

async function crmLead({ title, phone, email, notes, ref, orderStatus, agents, total, receiptUploadId, receiptName, uploads }) {
  if (!NOTION_TOKEN) return;
  const today = new Date().toISOString().slice(0, 10);
  const agentsTag = Array.isArray(agents) && agents.length ? ` · AGENTS:${agents.join(",")}` : "";
  const props = {
    "Opportunity Name": { title: [{ text: { content: `${title} (${ref})`.slice(0, 200) } }] },
    "Stage": { select: { name: "New" } },
    "Lead Source": { select: { name: "Website" } },
    "Human Required": { checkbox: true },
    "Notes": { rich_text: [{ text: { content: `الجوال: ${phone} · البريد: ${email}${notes ? " · " + notes : ""}${agentsTag}`.slice(0, 1900) } }] },
    "Last Activity": { date: { start: today } },
    "رقم المرجع": { rich_text: [{ text: { content: String(ref || "").slice(0, 60) } }] },
  };
  if (orderStatus) props["حالة الطلب"] = { select: { name: orderStatus } };
  if (typeof total === "number" && !Number.isNaN(total)) props["إجمالي الطلب"] = { number: total };
  const fileList = [];
  if (receiptUploadId) fileList.push({ type: "file_upload", file_upload: { id: receiptUploadId }, name: (receiptName || "receipt.pdf").slice(0, 100) });
  for (const uEntry of Array.isArray(uploads) ? uploads : []) {
    if (uEntry && uEntry.id) fileList.push({ type: "file_upload", file_upload: { id: uEntry.id }, name: String(uEntry.name || "file.pdf").slice(0, 100) });
  }
  if (fileList.length) {
    props["الإيصال البنكي"] = { files: fileList.slice(0, 20) };
    if (receiptUploadId) props["تحقق المبلغ"] = { select: { name: "لم يُفحص بعد" } };
  }
  try {
    const r = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
      body: JSON.stringify({ parent: { database_id: CRM_DB }, properties: props }),
    });
    if (!r.ok) console.error("CRM lead error", r.status, (await r.text()).slice(0, 300));
  } catch (e) { console.error("CRM lead exception", String(e).slice(0, 150)); }
}
async function addToAudience(email, name) {
  if (!RESEND_API_KEY || !RESEND_AUDIENCE || !isEmail(email)) return;
  try {
    const p = String(name || "").trim().split(/\s+/).filter(Boolean);
    await fetch(`https://api.resend.com/audiences/${RESEND_AUDIENCE}/contacts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ email, first_name: p[0] || undefined, last_name: p.slice(1).join(" ") || undefined, unsubscribed: false }),
    });
  } catch {}
}

const isEmail = (e) => typeof e === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Free/personal mailbox providers — event requests must come from a company domain.
const FREE_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "outlook.com", "outlook.sa", "live.com", "msn.com",
  "yahoo.com", "ymail.com", "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com",
  "zoho.com", "mail.com", "gmx.com", "gmx.net", "yandex.com", "yandex.ru", "inbox.com", "hey.com",
]);
const isCorporateEmail = (e) => isEmail(e) && !FREE_DOMAINS.has(e.split("@")[1].toLowerCase());

async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY) return { ok: false, error: "email_not_configured" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
    if (!r.ok) { console.error("Resend error", r.status, await r.text()); return { ok: false, error: "email_send_failed" }; }
    return { ok: true };
  } catch (e) { console.error("email exception", e); return { ok: false, error: "email_send_failed" }; }
}

async function readBody(req) {
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  if (body) return body;
  return await new Promise((resolve) => {
    let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
  });
}

const row = (k, v) => `<tr><td style="padding:4px 10px;color:#666">${k}</td><td style="padding:4px 10px"><b>${esc(v || "—")}</b></td></tr>`;

// ---- Shared Services: subscribe → owner approval → emailed access code → unlock ----
const OTP_SECRET = process.env.OTP_SECRET || "";
const OWNER_EMAIL = (process.env.BP_OWNER_EMAIL || "dr.baher.magnas@gmail.com").toLowerCase();
const SITE_BASE = process.env.SITE_BASE || "https://businesspartner.sa";
const SS_BANK = { beneficiary: process.env.BP_BANK_BENEFICIARY || "شركة بيزنس بارتنر", bank: process.env.BP_BANK_NAME || "مصرف الراجحي", iban: process.env.BP_BANK_IBAN || "SA5380000511608016228498" };
const ssKey = () => crypto.createHash("sha256").update(OTP_SECRET).digest();
function ssSeal(o) { const iv = crypto.randomBytes(12); const c = crypto.createCipheriv("aes-256-gcm", ssKey(), iv); const ct = Buffer.concat([c.update(JSON.stringify(o), "utf8"), c.final()]); return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64url"); }
function ssUnseal(t) { const raw = Buffer.from(String(t), "base64url"); const d = crypto.createDecipheriv("aes-256-gcm", ssKey(), raw.subarray(0, 12)); d.setAuthTag(raw.subarray(12, 28)); return JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8")); }
function ssCode(email) { const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; const h = crypto.createHmac("sha256", OTP_SECRET).update("shared|" + String(email).toLowerCase()).digest(); let o = ""; for (let i = 0; i < 6; i++) o += abc[h[i] % abc.length]; return "BP-SS-" + o; }
function ssRef(email) { const h = crypto.createHmac("sha256", OTP_SECRET || "x").update("ref|" + String(email).toLowerCase() + "|" + Date.now()).digest("hex"); return "BP-SS-" + h.slice(0, 6).toUpperCase(); }

// ---- Compliance Agent: order -> owner approval -> Notion activation -> emailed code ----
// Client Compliance Intake DB (same one the n8n intake/portal workflows read/write).
const COMPLIANCE_DB = process.env.NOTION_COMPLIANCE_DB || "5d570a75009b41019857060d0670642f";
const MKT_SITE_BASE = process.env.MKT_SITE_BASE || "https://www.businesspartner.sa";
// Compliance subscribers sign in to the unified AI-employees portal on this
// site with their emailed access code — complianceByCode() above resolves the
// code and unlocks Mishari. (The legacy Astro dashboard at this same path on
// the old site was removed when the domain moved here.)
const COMPLIANCE_PORTAL_URL = `${MKT_SITE_BASE}/ar/portal`;
function complianceCode(seed) { const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; const h = crypto.createHmac("sha256", OTP_SECRET || "x").update("compliance|" + String(seed)).digest(); let o = ""; for (let i = 0; i < 6; i++) o += abc[h[i] % abc.length]; return "BP-" + o; }
async function findComplianceRecord(company) {
  if (!NOTION_TOKEN || !company) return null;
  const r = await fetch(`https://api.notion.com/v1/databases/${COMPLIANCE_DB}/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
    body: JSON.stringify({ page_size: 1, filter: { property: "المنشأة", title: { equals: company } } }),
  });
  if (!r.ok) return null;
  const data = await r.json();
  return (data.results || [])[0] || null;
}
// Looks up (or creates) the client's Compliance Intake record by establishment
// name, flips حالة الاشتراك to نشط, and returns the portal access code (kept
// stable if the record already had one — e.g. from an earlier file-intake).
async function activateComplianceSubscription({ company, email, phone }) {
  if (!NOTION_TOKEN || !company) return null;
  const existing = await findComplianceRecord(company);
  const codeProp = existing && existing.properties && existing.properties["رمز الدخول"];
  const existingCode = codeProp && codeProp.rich_text && codeProp.rich_text[0] && codeProp.rich_text[0].plain_text;
  const code = existingCode || complianceCode(company + "|" + email);
  if (existing) {
    const props = { "حالة الاشتراك": { select: { name: "نشط" } } };
    if (!existingCode) props["رمز الدخول"] = { rich_text: [{ text: { content: code } }] };
    const hasEmail = existing.properties["البريد"] && existing.properties["البريد"].email;
    if (email && !hasEmail) props["البريد"] = { email };
    await fetch(`https://api.notion.com/v1/pages/${existing.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
      body: JSON.stringify({ properties: props }),
    });
  } else {
    const today = new Date().toISOString().slice(0, 10);
    const properties = {
      "المنشأة": { title: [{ text: { content: company } }] },
      "حالة الاشتراك": { select: { name: "نشط" } },
      "الحالة": { select: { name: "بانتظار المعالجة" } },
      "المصدر": { select: { name: "نموذج الموقع" } },
      "رمز الدخول": { rich_text: [{ text: { content: code } }] },
      "تاريخ الاستلام": { date: { start: today } },
    };
    if (email) properties["البريد"] = { email };
    if (phone) properties["واتساب أو الجوال"] = { phone_number: phone };
    await fetch(`https://api.notion.com/v1/pages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
      body: JSON.stringify({ parent: { database_id: COMPLIANCE_DB }, properties }),
    });
  }
  return code;
}

// ---- Employer recruitment plan: order -> owner approval -> Notion activation -> emailed code ----
// Same Employers DB the /employer-join registration form and /api/candidates read.
const EMP_DB = process.env.NOTION_EMPLOYERS_DB || "f1104f8bcc3d4beb84accdbda0aa8322";
const EMP_PLAN_AR = { basic: "أساسية", pro: "احترافية", enterprise: "مؤسسية" };
const EMP_DASHBOARD_URL = `${MKT_SITE_BASE}/employer-dashboard`;
function employerCode(seed) { const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; const h = crypto.createHmac("sha256", OTP_SECRET || "x").update("employer|" + String(seed)).digest(); let o = ""; for (let i = 0; i < 4; i++) o += abc[h[i] % abc.length]; return "BP-EMP-" + o; }
async function findEmployerRecord(company) {
  if (!NOTION_TOKEN || !company) return null;
  const r = await fetch(`https://api.notion.com/v1/databases/${EMP_DB}/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
    body: JSON.stringify({ page_size: 1, filter: { property: "اسم الشركة", title: { equals: company } } }),
  });
  if (!r.ok) return null;
  const data = await r.json();
  return (data.results || [])[0] || null;
}
// Looks up (or creates) the employer's row by company name, flips الحالة to
// مفعّل, and returns the dashboard access code (kept stable if the row
// already had one — e.g. from the earlier bespoke registration form).
async function activateEmployerSubscription({ company, email, phone, planKey }) {
  if (!NOTION_TOKEN || !company) return null;
  const planAr = EMP_PLAN_AR[planKey] || "";
  const existing = await findEmployerRecord(company);
  const codeProp = existing && existing.properties && existing.properties["رمز الوصول"];
  const existingCode = codeProp && codeProp.rich_text && codeProp.rich_text[0] && codeProp.rich_text[0].plain_text;
  const code = existingCode || employerCode(company + "|" + email + "|" + Date.now());
  if (existing) {
    const props = { "الحالة": { select: { name: "مفعّل" } } };
    if (!existingCode) props["رمز الوصول"] = { rich_text: [{ text: { content: code } }] };
    if (planAr) props["الباقة"] = { select: { name: planAr } };
    const hasEmail = existing.properties["البريد"] && existing.properties["البريد"].email;
    if (email && !hasEmail) props["البريد"] = { email };
    await fetch(`https://api.notion.com/v1/pages/${existing.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
      body: JSON.stringify({ properties: props }),
    });
  } else {
    const properties = {
      "اسم الشركة": { title: [{ text: { content: company } }] },
      "الحالة": { select: { name: "مفعّل" } },
      "رمز الوصول": { rich_text: [{ text: { content: code } }] },
    };
    if (planAr) properties["الباقة"] = { select: { name: planAr } };
    if (email) properties["البريد"] = { email };
    if (phone) properties["الجوال"] = { phone_number: phone };
    await fetch(`https://api.notion.com/v1/pages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
      body: JSON.stringify({ parent: { database_id: EMP_DB }, properties }),
    });
  }
  return code;
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  // Shared Services — owner approval link (owner clicks the emailed GET link).
  const q = req.query || {};
  if ((q.action || "") === "approve") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (!OTP_SECRET) { res.statusCode = 503; return res.end("<h3>الخدمة غير مُفعّلة (OTP_SECRET).</h3>"); }
    let d; try { d = ssUnseal(q.t); } catch { res.statusCode = 400; return res.end("<h3>رابط اعتماد غير صالح.</h3>"); }
    const code = ssCode(d.email);
    const codeHtml = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;text-align:right" dir="rtl"><h2 style="color:#0B1B5A">تم تفعيل خدمتك 🎉</h2><p>كود الوصول الخاص بك للخدمات المشتركة:</p><p style="font-size:26px;font-weight:bold;letter-spacing:4px;color:#0B1B5A">${esc(code)}</p><p><a href="${SITE_BASE}/shared-services" style="background:#12b3ad;color:#04211f;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:bold">افتح الخدمة</a> — أدخل بريدك والكود.</p></div>`;
    await sendEmail(d.email, `كود الوصول — الخدمات المشتركة (${code})`, codeHtml);
    await crmLead({ title: `تفعيل خدمات مشتركة — ${d.name || d.email}`, phone: d.phone || "", email: d.email, notes: `معتمد ومفعّل · ${d.ref}`, ref: d.ref });
    res.statusCode = 200;
    return res.end(`<!doctype html><meta charset="utf-8"><div style="font-family:Arial;max-width:520px;margin:60px auto;text-align:center" dir="rtl"><h2 style="color:#0B1B5A">✅ تم الاعتماد</h2><p>أُرسل كود الوصول إلى <b>${esc(d.email)}</b>.</p></div>`);
  }

  // Compliance Agent — owner approval link (clicked after confirming the bank transfer).
  if ((q.action || "") === "approve-compliance") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (!OTP_SECRET) { res.statusCode = 503; return res.end("<h3>الخدمة غير مُفعّلة (OTP_SECRET).</h3>"); }
    let d; try { d = ssUnseal(q.t); } catch { res.statusCode = 400; return res.end("<h3>رابط اعتماد غير صالح.</h3>"); }
    const code = await activateComplianceSubscription({ company: d.company, email: d.email, phone: d.phone });
    if (!code) { res.statusCode = 500; return res.end("<h3>تعذّر التفعيل — تحقّق من إعداد Notion (NOTION_TOKEN) واسم المنشأة.</h3>"); }
    const codeHtml = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;text-align:right" dir="rtl"><h2 style="color:#0B1B5A">تم تفعيل اشتراكك في وكيل الامتثال 🎉</h2><p>المنشأة: <b>${esc(d.company)}</b></p><p>رمز الدخول لبوابة وكيل الامتثال:</p><p style="font-size:26px;font-weight:bold;letter-spacing:4px;color:#0B1B5A">${esc(code)}</p><p><a href="${COMPLIANCE_PORTAL_URL}" style="background:#0B1B5A;color:#fff;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:bold">افتح بوابة وكيل الامتثال</a> — أدخل بريدك (${esc(d.email)}) والرمز أعلاه.</p></div>`;
    await sendEmail(d.email, `تم تفعيل اشتراكك — وكيل الامتثال (${esc(d.company)})`, codeHtml);
    res.statusCode = 200;
    return res.end(`<!doctype html><meta charset="utf-8"><div style="font-family:Arial;max-width:520px;margin:60px auto;text-align:center" dir="rtl"><h2 style="color:#0B1B5A">✅ تم التفعيل</h2><p>أُرسل كود الوصول إلى <b>${esc(d.email)}</b>.</p></div>`);
  }

  // Employer recruitment plan — owner approval link (clicked after confirming the bank transfer).
  if ((q.action || "") === "approve-employer") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (!OTP_SECRET) { res.statusCode = 503; return res.end("<h3>الخدمة غير مُفعّلة (OTP_SECRET).</h3>"); }
    let d; try { d = ssUnseal(q.t); } catch { res.statusCode = 400; return res.end("<h3>رابط اعتماد غير صالح.</h3>"); }
    const code = await activateEmployerSubscription({ company: d.company, email: d.email, phone: d.phone, planKey: d.plan });
    if (!code) { res.statusCode = 500; return res.end("<h3>تعذّر التفعيل — تحقّق من إعداد Notion (NOTION_TOKEN) واسم الشركة.</h3>"); }
    const planAr = EMP_PLAN_AR[d.plan] || "";
    const codeHtml = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;text-align:right" dir="rtl"><h2 style="color:#0B1B5A">تم تفعيل اشتراكك في منصة التوظيف 🎉</h2><p>الشركة: <b>${esc(d.company)}</b>${planAr ? ` — الباقة: <b>${esc(planAr)}</b>` : ""}</p><p>رمز الوصول للوحة التوظيف:</p><p style="font-size:26px;font-weight:bold;letter-spacing:4px;color:#0B1B5A">${esc(code)}</p><p><a href="${EMP_DASHBOARD_URL}" style="background:#0B1B5A;color:#fff;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:bold">افتح لوحة التوظيف</a> — أدخل الرمز أعلاه.</p></div>`;
    await sendEmail(d.email, `تم تفعيل اشتراكك — منصة التوظيف (${esc(d.company)})`, codeHtml);
    res.statusCode = 200;
    return res.end(`<!doctype html><meta charset="utf-8"><div style="font-family:Arial;max-width:520px;margin:60px auto;text-align:center" dir="rtl"><h2 style="color:#0B1B5A">✅ تم التفعيل</h2><p>أُرسل رمز الوصول إلى <b>${esc(d.email)}</b>.</p></div>`);
  }

  // Internal dashboard — list recent incoming requests (gated by LEADS_KEY).
  if ((q.action || "") === "leads") {
    res.setHeader("Cache-Control", "no-store");
    if (!LEADS_KEY) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "not_configured" })); }
    if ((q.key || "") !== LEADS_KEY) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "unauthorized" })); }
    try {
      const leads = await listLeads(q.limit);
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, leads }));
    } catch {
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "notion_failed" }));
    }
  }

  if (req.method === "GET") {
    const url = new URL(req.url, "http://x");
    const refs = (url.searchParams.get("refs") || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 30);
    if (refs.length) {
      res.setHeader("Cache-Control", "no-store");
      const statuses = {}, agents = {}, emails = {}, demo = {}, trial = {};
      const remaining = [];
      for (const ref of refs) {
        const upper = ref.toUpperCase();
        const dc = DEMO_CODES[upper];
        if (dc) { statuses[ref] = "مكتمل"; agents[ref] = dc; demo[ref] = true; if (TRIAL_CODES.has(upper)) trial[ref] = true; }
        else remaining.push(ref);
      }
      if (remaining.length) {
        try {
          const r = await orderStatuses(remaining);
          Object.assign(statuses, r.statuses);
          Object.assign(agents, r.agents);
          Object.assign(emails, r.emails);
          // Codes not found in Sales Pipeline may be Compliance Agent access
          // codes (رمز الدخول) — resolve those against the Compliance Intake DB.
          const unresolved = remaining.filter((ref) => !statuses[ref]);
          if (unresolved.length) {
            const c = await complianceByCode(unresolved);
            Object.assign(statuses, c.statuses);
            Object.assign(agents, c.agents);
            Object.assign(emails, c.emails);
          }
        } catch {
          res.statusCode = 502;
          return res.end(JSON.stringify({ ok: false, error: "notion_failed" }));
        }
      }
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, statuses, agents, emails, demo, trial }));
    }
    res.statusCode = 200;
    return res.end(JSON.stringify({ status: "ok", emailConfigured: !!RESEND_API_KEY }));
  }
  if (req.method !== "POST") { res.statusCode = 405; return res.end(JSON.stringify({ error: "method_not_allowed" })); }

  const b = await readBody(req);

  // Shared Services — client places a subscription order (bank transfer for now).
  if (b.action === "subscribe") {
    if (!OTP_SECRET) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "not_configured", message: "الخدمة غير مُفعّلة بعد." })); }
    const name = String(b.name || "").trim().slice(0, 120);
    const email = String(b.email || "").trim().toLowerCase();
    const phone = String(b.phone || "").trim().slice(0, 40);
    if (!isEmail(email)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_email", message: "أدخل بريداً صحيحاً." })); }
    const ref = ssRef(email);
    const approveUrl = `${SITE_BASE}/api/requests?action=approve&t=${encodeURIComponent(ssSeal({ email, name, phone, ref }))}`;
    const clientHtml = `<div style="font-family:Arial,sans-serif;max-width:540px;margin:auto;text-align:right" dir="rtl"><h2 style="color:#0B1B5A">استلمنا طلبك — الخدمات المشتركة (${esc(ref)})</h2><p>أهلاً ${esc(name)}، لإتمام الاشتراك حوّل قيمة الاشتراك إلى:</p><ul><li>المستفيد: ${esc(SS_BANK.beneficiary)}</li><li>البنك: ${esc(SS_BANK.bank)}</li><li>الآيبان: ${esc(SS_BANK.iban)}</li></ul><p>بعد تأكيد التحويل واعتماد الطلب، يصلك <b>كود وصول</b> على هذا البريد يفتح فريقك التنفيذي مباشرة. لن نطلب كلمة مرور أو رمز تحقق.</p></div>`;
    const ownerHtml = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2 style="color:#0B1B5A">طلب اشتراك جديد — الخدمات المشتركة (${esc(ref)})</h2><table>${row("الاسم", name) + row("البريد", email) + row("الجوال", phone)}</table><p>لاعتماد الطلب وإرسال الكود للعميل:</p><p><a href="${approveUrl}" style="background:#0B1B5A;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold">✅ اعتماد وإرسال الكود</a></p><p style="color:#666;font-size:13px">لا تعتمد إلا بعد تأكيد وصول التحويل. الرابط سرّي.</p></div>`;
    await Promise.all([
      sendEmail(email, `استلمنا طلبك — الخدمات المشتركة (${ref})`, clientHtml),
      sendEmail(OWNER_EMAIL, `طلب اشتراك جديد — ${name || email} (${ref})`, ownerHtml),
      crmLead({ title: `طلب خدمات مشتركة — ${name || email}`, phone, email, notes: `بانتظار الموافقة · تحويل بنكي · ${ref}`, ref }),
      addToAudience(email, name),
    ]);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ref, bank: SS_BANK, message: "استلمنا طلبك. حوّل قيمة الاشتراك ثم ننتظر اعتماد الفريق، ويصلك كود الوصول على بريدك." }));
  }

  // Shared Services — client enters the emailed access code to open the service.
  if (b.action === "unlock") {
    if (!OTP_SECRET) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "not_configured" })); }
    const email = String(b.email || "").trim().toLowerCase();
    const code = String(b.code || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!isEmail(email)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_email" })); }
    const expected = ssCode(email);
    const aa = Buffer.from(code), bb = Buffer.from(expected);
    const ok = aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
    if (!ok) { res.statusCode = 200; return res.end(JSON.stringify({ ok: false, error: "bad_code", message: "الكود غير صحيح لهذا البريد. استخدم نفس البريد الذي اشتركت به." })); }
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, token: ssSeal({ email, plan: "shared", t: Date.now() }), message: "تم التفعيل — أهلاً بك في فريقك التنفيذي." }));
  }

  // Order/purchase from checkout → CRM lead + team notification (lighter validation).
  // A bank receipt (PDF) is mandatory — the n8n verification agent reads it from
  // Notion and checks its amount against "إجمالي الطلب" before an order is confirmed.
  if (b.type === "order") {
    const name = String(b.name || "").trim().slice(0, 160);
    const phone = String(b.phone || "").trim().slice(0, 40);
    const email = String(b.email || "").trim().toLowerCase().slice(0, 160);
    const ref = String(b.ref || "BP-" + Date.now().toString().slice(-6)).slice(0, 40);
    const items = (Array.isArray(b.items) ? b.items.map((x) => (typeof x === "string" ? x : (x && x.name) || "")).filter(Boolean) : [String(b.items || "")]).join("، ").slice(0, 900);
    const totalNum = Number(b.total);
    const total = Number.isFinite(totalNum) ? totalNum : 0;
    const agents = Array.isArray(b.agents) ? b.agents.map((s) => String(s).toLowerCase().trim()).filter((s) => /^[a-z0-9]{1,30}$/.test(s)).slice(0, 20) : [];
    const receiptBase64 = typeof b.receiptBase64 === "string" ? b.receiptBase64.slice(0, 8_000_000) : "";
    const receiptName = String(b.receiptName || "receipt.pdf").slice(0, 100);
    // Accept an image (screenshot — auto-verified by the AI reader) or a PDF. Use the
    // real content type so the file uploads to Notion correctly; infer from the name if absent.
    const rawType = String(b.receiptType || "").toLowerCase();
    const receiptType = /^(image\/(jpeg|jpg|png|webp)|application\/pdf)$/.test(rawType)
      ? rawType.replace("image/jpg", "image/jpeg")
      : /\.(jpe?g)$/i.test(receiptName) ? "image/jpeg"
      : /\.png$/i.test(receiptName) ? "image/png"
      : /\.webp$/i.test(receiptName) ? "image/webp"
      : "application/pdf";
    const compliance = !!b.compliance;
    const employerPlanKey = ["basic", "pro", "enterprise"].includes(b.employerPlan) ? b.employerPlan : "";
    const company = String(b.company || "").trim().slice(0, 200) || name;
    const crNumber = String(b.cr || "").trim().slice(0, 40);
    const headcount = Number.isFinite(Number(b.headcount)) && b.headcount !== "" ? Number(b.headcount) : null;
    const nationalAddress = String(b.nationalAddress || "").trim().slice(0, 200);
    const surchargeFeeNum = Number(b.surchargeFee);
    const surchargeFee = Number.isFinite(surchargeFeeNum) ? surchargeFeeNum : 0;
    if (!name || !phone) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
    if (!receiptBase64) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "receipt_required" })); }
    const receiptUploadId = await uploadFileToNotion(receiptBase64, receiptName, receiptType);
    const agentsNote = agents.length ? `<p>موظفون أذكياء مطلوبون: <strong>${esc(agents.join("، "))}</strong> — بمجرد اعتماد الدفع، تفلّت الحالة لـ«مؤكد - قيد التنفيذ» يفتح للعميل بوابة الموظفين الأذكياء تلقائياً برقم مرجعه ${ref}.</p>` : "";
    const complianceNote = compliance
      ? (OTP_SECRET && isEmail(email)
          ? `<p>طلب اشتراك <strong>وكيل الامتثال</strong> — المنشأة: <strong>${esc(company)}</strong>. بعد تأكيد استلام التحويل البنكي:</p><p><a href="${MKT_SITE_BASE}/api/requests?action=approve-compliance&t=${encodeURIComponent(ssSeal({ company, email, phone, ref }))}" style="background:#0B1B5A;color:#fff;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:bold">✅ تفعيل اشتراك وكيل الامتثال</a></p><p style="color:#666;font-size:13px">لا تعتمد إلا بعد تأكيد وصول التحويل — سيصل العميل بريد فيه رمز الدخول لبوابة الامتثال تلقائياً.</p>`
          : `<p>طلب اشتراك <strong>وكيل الامتثال</strong> — فعّله يدوياً في قاعدة "Client Compliance Intake" في Notion (حالة الاشتراك → نشط) بعد تأكيد التحويل.</p>`)
      : "";
    const employerNote = employerPlanKey
      ? (OTP_SECRET && isEmail(email)
          ? `<p>طلب اشتراك <strong>منصة التوظيف</strong> (${esc(EMP_PLAN_AR[employerPlanKey] || employerPlanKey)}) — الشركة: <strong>${esc(company)}</strong>. بعد تأكيد استلام التحويل البنكي:</p><p><a href="${MKT_SITE_BASE}/api/requests?action=approve-employer&t=${encodeURIComponent(ssSeal({ company, email, phone, ref, plan: employerPlanKey }))}" style="background:#0B1B5A;color:#fff;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:bold">✅ تفعيل اشتراك منصة التوظيف</a></p><p style="color:#666;font-size:13px">لا تعتمد إلا بعد تأكيد وصول التحويل — سيصل العميل بريد فيه رمز الوصول للوحة التوظيف تلقائياً.</p>`
          : `<p>طلب اشتراك <strong>منصة التوظيف</strong> — فعّله يدوياً في قاعدة «أصحاب العمل» في Notion (الحالة → مفعّل) بعد تأكيد التحويل.</p>`)
      : "";
    const receiptNote = receiptUploadId
      ? `<p>إيصال التحويل مرفق بصف الطلب في Notion — إيجنت التحقق في n8n يقارن مبلغه بـ«إجمالي الطلب» (${total} ﷼) تلقائياً.</p>`
      : `<p style="color:#b91c1c">⚠️ تعذّر رفع الإيصال إلى Notion — راجع الإيصال يدوياً قبل التفعيل.</p>`;
    const pkgFieldsNote = (crNumber || headcount != null || nationalAddress)
      ? `<p>بيانات المنشأة — السجل التجاري الموحد: <strong>${esc(crNumber || "—")}</strong> · عدد الموظفين: <strong>${headcount != null ? headcount : "—"}</strong> · العنوان الوطني: <strong>${esc(nationalAddress || "—")}</strong>${surchargeFee ? ` · رسوم موظفين إضافيين مضمّنة: <strong>${surchargeFee} ﷼</strong>` : ""}</p>`
      : "";
    const oHtml = `<div style="font-family:Arial,sans-serif"><h2 style="color:#0B1B5A">طلب جديد ${ref}</h2><table>${row("الاسم", name) + row("الجوال", phone) + row("البريد", email) + row("الخدمات", items) + row("الإجمالي", total ? total + " ﷼" : "")}</table>${pkgFieldsNote}${agentsNote}${complianceNote}${employerNote}${receiptNote}<p>بعد تأكيد مطابقة المبلغ: افتح صف الطلب في قاعدة «Sales Pipeline» في Notion (رقم المرجع ${ref}) وغيّر <strong>حالة الطلب</strong> إلى «مؤكد - قيد التنفيذ» ثم «مكتمل». تظهر الحالة فوراً في لوحة العميل /account بلا إعادة نشر.</p></div>`;
    const pkgNotesText = (crNumber || headcount != null || nationalAddress) ? ` · س.ت: ${crNumber || "—"} · موظفين: ${headcount != null ? headcount : "—"}${nationalAddress ? " · عنوان: " + nationalAddress : ""}` : "";
    // Immediate acknowledgment to the client — "we received your payment, we're verifying it".
    // The n8n verification agent later sends the "confirmed / activated" email once the receipt amount matches.
    const cHtml = `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430"><h2 style="color:#0B1B5A">استلمنا طلبك ودفعتك ✅</h2><p>مرحباً ${esc(name)},</p><p>وصلنا طلبك وإيصال التحويل البنكي بنجاح. فريقنا ووكيل التحقق الآلي يراجعان الإيصال الآن، وبمجرد تأكيد مطابقة المبلغ ستصلك رسالة تأكيد التفعيل مباشرةً.</p><table>${row("رقم المرجع", ref) + row("الخدمات", items) + row("الإجمالي", total ? total + " ﷼" : "")}</table><p>يمكنك متابعة حالة طلبك في لوحتك: <a href="${MKT_SITE_BASE}/account" style="color:#0B1B5A">${MKT_SITE_BASE}/account</a></p><p style="color:#0B1B5A">بزنس بارتنر · محفول مكفول</p></div>`;
    await Promise.all([
      sendEmail(TEAM_EMAIL, `طلب جديد ${ref} — ${name}`, oHtml),
      isEmail(email) ? sendEmail(email, `تم استلام طلبك ودفعتك — ${ref}`, cHtml) : Promise.resolve(),
      crmLead({ title: `طلب/شراء خدمة — ${name}`, phone, email, notes: `طلب · ${items}${total ? " · إجمالي " + total : ""}${pkgNotesText}`, ref, orderStatus: "قيد المراجعة", agents, total, receiptUploadId, receiptName }),
      addToAudience(email, name),
      forwardLead({ source: "order", ref, name, phone, email, items, total }),
    ]);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ref, receiptUploaded: !!receiptUploadId }));
  }

  // Wallet top-up: the client transfers money and uploads the receipt; the team
  // confirms it in the CRM (حالة الطلب → مؤكد/مكتمل) and the dashboard credits
  // the balance through the same live-status sync orders use.
  if (b.type === "wallet-topup") {
    const name = String(b.name || "").trim().slice(0, 160);
    const phone = String(b.phone || "").trim().slice(0, 40);
    const email = String(b.email || "").trim().toLowerCase().slice(0, 160);
    const ref = String(b.ref || "BPW-" + Date.now().toString().slice(-6)).slice(0, 40);
    const amountNum = Number(b.amount);
    const amount = Number.isFinite(amountNum) && amountNum > 0 ? amountNum : 0;
    const receiptBase64 = typeof b.receiptBase64 === "string" ? b.receiptBase64.slice(0, 8_000_000) : "";
    const receiptName = String(b.receiptName || "receipt.pdf").slice(0, 100);
    const rawType = String(b.receiptType || "").toLowerCase();
    const receiptType = /^(image\/(jpeg|jpg|png|webp)|application\/pdf)$/.test(rawType)
      ? rawType.replace("image/jpg", "image/jpeg")
      : /\.(jpe?g)$/i.test(receiptName) ? "image/jpeg"
      : /\.png$/i.test(receiptName) ? "image/png"
      : /\.webp$/i.test(receiptName) ? "image/webp"
      : "application/pdf";
    if (!name || !isEmail(email) || !amount) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
    if (!receiptBase64) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "receipt_required" })); }
    const receiptUploadId = await uploadFileToNotion(receiptBase64, receiptName, receiptType);
    const oHtml = `<div style="font-family:Arial,sans-serif"><h2 style="color:#0B1B5A">شحن محفظة ${ref}</h2><table>${row("الاسم", name) + row("الجوال", phone) + row("البريد", email) + row("مبلغ الشحن", amount + " ﷼")}</table><p>${receiptUploadId ? "الإيصال مرفق بصف الطلب في Notion — قارن مبلغه ثم غيّر حالة الطلب إلى «مؤكد - قيد التنفيذ» ليظهر الرصيد للعميل فوراً في /account." : "⚠️ تعذّر رفع الإيصال — راجعه يدوياً قبل الاعتماد."}</p></div>`;
    const cHtml = `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430"><h2 style="color:#0B1B5A">استلمنا طلب شحن محفظتك ✅</h2><p>مرحباً ${esc(name)},</p><p>وصلنا طلب شحن محفظتك بمبلغ <strong>${amount} ﷼</strong> مع إيصال التحويل. بمجرد تأكيد الفريق يظهر الرصيد في لوحتك ويمكنك السداد منه مباشرة.</p><table>${row("رقم المرجع", ref) + row("المبلغ", amount + " ﷼")}</table><p>تابع رصيدك في لوحتك: <a href="${MKT_SITE_BASE}/account" style="color:#0B1B5A">${MKT_SITE_BASE}/account</a></p><p style="color:#0B1B5A">بزنس بارتنر</p></div>`;
    await Promise.all([
      sendEmail(TEAM_EMAIL, `شحن محفظة ${ref} — ${name} (${amount} ﷼)`, oHtml),
      sendEmail(email, `استلمنا طلب شحن محفظتك — ${ref}`, cHtml),
      crmLead({ title: `شحن محفظة — ${name}`, phone, email, notes: `محفظة · شحن رصيد ${amount} ﷼`, ref, orderStatus: "قيد المراجعة", total: amount, receiptUploadId, receiptName }),
      addToAudience(email, name),
    ]);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ref, receiptUploaded: !!receiptUploadId }));
  }

  // Wallet payment: the client asks us to pay a government fee / SADAD invoice
  // from their wallet balance. The team validates the balance in the CRM ledger
  // (top-ups minus payments), executes the payment, and completes the row.
  if (b.type === "wallet-pay") {
    const name = String(b.name || "").trim().slice(0, 160);
    const email = String(b.email || "").trim().toLowerCase().slice(0, 160);
    const ref = String(b.ref || "BPP-" + Date.now().toString().slice(-6)).slice(0, 40);
    const what = String(b.what || "").trim().slice(0, 400);
    const amountNum = Number(b.amount);
    const amount = Number.isFinite(amountNum) && amountNum > 0 ? amountNum : 0;
    if (!name || !isEmail(email) || !amount || !what) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
    const oHtml = `<div style="font-family:Arial,sans-serif"><h2 style="color:#0B1B5A">سداد من المحفظة ${ref}</h2><table>${row("الاسم", name) + row("البريد", email) + row("المطلوب سداده", what) + row("المبلغ", amount + " ﷼")}</table><p>تحقق من رصيد محفظة العميل (مجموع شحنات BPW المؤكدة ناقص مدفوعات BPP) قبل التنفيذ، ثم نفّذ السداد وأرفق الإثبات وحدّث حالة الطلب إلى «مكتمل».</p></div>`;
    const cHtml = `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430"><h2 style="color:#0B1B5A">استلمنا طلب السداد ✅</h2><p>مرحباً ${esc(name)},</p><p>وصلنا طلبك لسداد: <strong>${esc(what)}</strong> بمبلغ <strong>${amount} ﷼</strong> من محفظتك. سننفذه ونرسل لك إثبات السداد.</p><table>${row("رقم المرجع", ref) + row("المبلغ", amount + " ﷼")}</table><p style="color:#0B1B5A">بزنس بارتنر</p></div>`;
    await Promise.all([
      sendEmail(TEAM_EMAIL, `سداد من المحفظة ${ref} — ${name} (${amount} ﷼)`, oHtml),
      sendEmail(email, `استلمنا طلب السداد — ${ref}`, cHtml),
      crmLead({ title: `سداد رسوم من المحفظة — ${name}`, phone: String(b.phone || "").slice(0, 40), email, notes: `محفظة · سداد ${amount} ﷼ · ${what}`, ref, orderStatus: "قيد المراجعة", total: amount }),
    ]);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ref }));
  }

  // Instalment request: we arrange financing for government fees through the
  // client's bank / BNPL / e-wallets. The financing decision is the provider's;
  // this creates the coordination request in the CRM.
  if (b.type === "installment") {
    const name = String(b.name || "").trim().slice(0, 160);
    const phone = String(b.phone || "").trim().slice(0, 40);
    const email = String(b.email || "").trim().toLowerCase().slice(0, 160);
    const ref = String(b.ref || "BPI-" + Date.now().toString().slice(-6)).slice(0, 40);
    const service = String(b.service || "").trim().slice(0, 400);
    const amountNum = Number(b.amount);
    const amount = Number.isFinite(amountNum) && amountNum > 0 ? amountNum : 0;
    const monthsNum = Number(b.months);
    const months = [3, 6, 12].includes(monthsNum) ? monthsNum : 6;
    const CH = { bank: "بنك العميل", bnpl: "تابي / تمارا", wallet: "محفظة إلكترونية", any: "أفضل عرض متاح" };
    const channel = CH[b.channel] || CH.any;
    if (!name || !phone || !isEmail(email) || !service || !amount) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
    const monthly = Math.ceil(amount / months);
    const oHtml = `<div style="font-family:Arial,sans-serif"><h2 style="color:#0B1B5A">طلب تقسيط ${ref}</h2><table>${row("الاسم", name) + row("الجوال", phone) + row("البريد", email) + row("الخدمة", service) + row("المبلغ", amount + " ﷼") + row("المدة", months + " أشهر") + row("القناة المفضلة", channel) + row("القسط التقديري", monthly + " ﷼/شهر")}</table><p>رتّب عرض التمويل مع الجهة المناسبة وعد للعميل بالعرض، ثم حدّث حالة الطلب في «Sales Pipeline».</p></div>`;
    const cHtml = `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430"><h2 style="color:#0B1B5A">استلمنا طلب التقسيط ✅</h2><p>مرحباً ${esc(name)},</p><p>وصلنا طلبك لتقسيط <strong>${esc(service)}</strong> بمبلغ <strong>${amount} ﷼</strong> على <strong>${months} أشهر</strong> (${channel}). فريقنا يجهّز العروض المتاحة وسيعود لك سريعاً.</p><table>${row("رقم المرجع", ref) + row("القسط التقديري", monthly + " ﷼/شهر")}</table><p>تابع طلبك في لوحتك: <a href="${MKT_SITE_BASE}/account" style="color:#0B1B5A">${MKT_SITE_BASE}/account</a></p><p style="color:#0B1B5A">بزنس بارتنر</p></div>`;
    await Promise.all([
      sendEmail(TEAM_EMAIL, `طلب تقسيط ${ref} — ${name} (${amount} ﷼ / ${months} أشهر)`, oHtml),
      sendEmail(email, `استلمنا طلب التقسيط — ${ref}`, cHtml),
      crmLead({ title: `طلب تقسيط — ${name}`, phone, email, notes: `تقسيط · ${service} · ${amount} ﷼ على ${months} أشهر · ${channel}`, ref, orderStatus: "قيد المراجعة", total: amount }),
      addToAudience(email, name),
      forwardLead({ source: "installment", ref, name, phone, email, items: service, total: amount }),
    ]);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ref }));
  }

  // Corporate bank-account opening: file prepared from the company profile,
  // online appointment with the bank officer — EVERY partner + the manager
  // receive the proposed appointment by email; the team confirms with the bank.
  if (b.type === "bank-account") {
    const company = String(b.company || "").trim().slice(0, 200);
    const cr = String(b.cr || "").trim().slice(0, 40);
    const manager = String(b.manager || "").trim().slice(0, 160);
    const phone = String(b.phone || "").trim().slice(0, 40);
    const email = String(b.email || "").trim().toLowerCase().slice(0, 160);
    const bank = String(b.bank || "").trim().slice(0, 80);
    const when = String(b.when || "").trim().slice(0, 40);
    const ref = String(b.ref || "BPB-" + Date.now().toString().slice(-6)).slice(0, 40);
    const partners = (Array.isArray(b.partners) ? b.partners : []).slice(0, 15).map((p) => ({
      name: String((p && p.name) || "").trim().slice(0, 160),
      phone: String((p && p.phone) || "").trim().slice(0, 40),
      email: String((p && p.email) || "").trim().toLowerCase().slice(0, 160),
    })).filter((p) => p.name && isEmail(p.email));
    if (!company || !cr || !manager || !isEmail(email)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
    const whenTxt = when ? when.replace("T", " الساعة ") : "يُحدد بالتنسيق مع البنك";
    const partnersRows = partners.map((p) => row("شريك", `${p.name} · ${p.phone || "—"} · ${p.email}`)).join("");
    const oHtml = `<div style="font-family:Arial,sans-serif"><h2 style="color:#0B1B5A">طلب فتح حساب بنكي ${ref}</h2><table>${row("الشركة", company) + row("السجل التجاري", cr) + row("البنك المفضل", bank) + row("الموعد المقترح (أونلاين)", whenTxt) + row("المدير", `${manager} · ${phone} · ${email}`) + partnersRows}</table><p>جهّز ملف فتح الحساب من بيانات المنشأة، نسّق مع البنك موعد الاجتماع الأونلاين، ثم أكّد الموعد للجميع — الشركاء والمدير وصلتهم دعوة مبدئية بالفعل.</p></div>`;
    const invite = (who) => `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430"><h2 style="color:#0B1B5A">دعوة: فتح الحساب البنكي لشركة ${esc(company)} 🏦</h2><p>مرحباً ${esc(who)},</p><p>تم تقديم طلب فتح حساب بنكي لشركة <strong>${esc(company)}</strong> (سجل تجاري ${esc(cr)}) لدى <strong>${esc(bank)}</strong>.</p><p><strong>الموعد المقترح للاجتماع الأونلاين مع موظف البنك:</strong> ${esc(whenTxt)}</p><p>حضوركم مطلوب نظاماً بصفتكم من الشركاء/الإدارة. سنؤكد الموعد النهائي ورابط الاجتماع بعد التنسيق مع البنك — فضلاً أبقوا هذا الموعد محجوزاً.</p><table>${row("رقم المرجع", ref)}</table><p style="color:#0B1B5A">بزنس بارتنر · شريك تشغيلك</p></div>`;
    await Promise.all([
      sendEmail(TEAM_EMAIL, `فتح حساب بنكي ${ref} — ${company} (${bank})`, oHtml),
      sendEmail(email, `دعوة موعد فتح الحساب البنكي — ${ref}`, invite(manager)),
      ...partners.map((p) => sendEmail(p.email, `دعوة موعد فتح الحساب البنكي — ${company}`, invite(p.name))),
      crmLead({ title: `فتح حساب بنكي — ${company}`, phone, email, notes: `بنك · ${bank} · س.ت ${cr} · موعد مقترح ${whenTxt} · شركاء: ${partners.map((p) => p.name).join("، ") || "—"}`, ref, orderStatus: "قيد المراجعة" }),
      addToAudience(email, manager),
      forwardLead({ source: "bank-account", ref, name: manager, phone, email, items: `${company} · ${bank}` }),
    ]);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ref, partnersNotified: partners.length }));
  }

  // Multi-partner company formation: incorporation contract drafted and
  // submitted through the Saudi Business Center; every partner is emailed.
  // v2: sensitive full file — partner identity (type, Gregorian DOB, national
  // address, ID/iqama/passport/CR number + document uploads) and managers with
  // their Article-5 powers (exercise mode, delegation right, sub-powers).
  if (b.type === "formation-contract") {
    const company = String(b.company || "").trim().slice(0, 200);
    const entity = { llc: "شركة ذات مسؤولية محدودة", sjsc: "شركة مساهمة مبسطة", other: "أخرى/استشارة" }[b.entity] || "شركة ذات مسؤولية محدودة";
    const capital = Number.isFinite(Number(b.capital)) && b.capital !== "" ? Number(b.capital) : null;
    const activity = String(b.activity || "").trim().slice(0, 200);
    const person = String(b.person || "").trim().slice(0, 160);
    const phone = String(b.phone || "").trim().slice(0, 40);
    const email = String(b.email || "").trim().toLowerCase().slice(0, 160);
    const ref = String(b.ref || "BPF-" + Date.now().toString().slice(-6)).slice(0, 40);
    const TYPE_AR = { saudi: "سعودي", resident: "مقيم", foreign: "مستثمر أجنبي (فرد)", company: "شركة أجنبية" };
    const ID_AR = { saudi: "الهوية الوطنية", resident: "الإقامة", foreign: "جواز السفر", company: "السجل/الرخصة التجارية" };
    const partners = (Array.isArray(b.partners) ? b.partners : []).slice(0, 15).map((p) => ({
      type: TYPE_AR[p && p.type] ? String(p.type) : "saudi",
      name: String((p && p.name) || "").trim().slice(0, 160),
      dob: String((p && p.dob) || "").trim().slice(0, 20),
      idNumber: String((p && p.idNumber) || "").trim().slice(0, 40),
      address: String((p && p.address) || "").trim().slice(0, 20),
      phone: String((p && p.phone) || "").trim().slice(0, 40),
      email: String((p && p.email) || "").trim().toLowerCase().slice(0, 160),
      share: Number.isFinite(Number(p && p.share)) ? Number(p.share) : null,
      files: (Array.isArray(p && p.files) ? p.files : []).slice(0, 3).map((f) => ({
        label: String((f && f.label) || "").slice(0, 80),
        name: String((f && f.name) || "file.pdf").slice(0, 120),
        contentType: String((f && f.contentType) || "application/pdf").slice(0, 80),
        data: typeof (f && f.data) === "string" && f.data.length < 3_600_000 ? f.data : null,
      })).filter((f) => f.data),
    })).filter((p) => p.name && isEmail(p.email));
    const FC_G = { cr: "السجلات التجارية", banking: "الصلاحيات البنكية", assets: "إدارة الأملاك", companies: "الشركات والمشاركات", judicial: "القضاء والتمثيل", gov: "الجهات والمنصات الحكومية", labor: "العمالة والاستقدام والإقامات", fundamental: "تعديل عقد التأسيس والقرارات الجوهرية" };
    const FC_SUBS = {
      cr: { issue: "الإصدار (الرئيسية والفرعية)", confirm: "التأكيد السنوي", amend: "تعديل السجلات ونقلها وإدارتها", strike: "الشطب" },
      banking: { accounts: "فتح وقفل الحسابات البنكية", credits: "فتح الاعتمادات", operate: "الإيداع والسحب وتحديث الحسابات", cheques: "إصدار الشيكات وكشوف الحسابات", facilities: "طلب التسهيلات والضمانات", loans: "عقود القروض والأوراق التجارية وسندات لأمر" },
      assets: { realestate: "شراء وبيع وإفراغ العقار والأراضي", shares: "شراء وبيع الأسهم", mortgage: "الرهن وفك الرهن والقبض", leases: "توقيع وتجديد وفسخ عقود الإيجار" },
      companies: { contracts: "توقيع عقود الشركات وقرارات الشركاء", stakes: "شراء وبيع الحصص", represent: "تمثيل الشركة في الشركات المساهم فيها", incorporate: "تأسيس الشركات باسم الشركة" },
      judicial: { plead: "المرافعة والمدافعة والمطالبة والمخاصمة", settle: "المصالحة والتحكيم والصلح", appoint: "تعيين المحكمين والمحامين", notary: "كتابات العدل وخدمات وزارة العدل" },
      gov: { chamber: "الغرفة التجارية", zakat: "الزكاة والدخل والتأمينات والدفاع المدني", licenses: "استخراج وتجديد وتعديل التراخيص", tenders: "دخول المناقصات واستلام الاستمارات", etimad: "منصة اعتماد والموارد البشرية والاتصالات" },
      labor: { visas: "التأشيرات: استخراجها وإلغاؤها واسترداد مبالغها", recruit: "الاستقدام وفتح الملفات", iqama: "الإقامات والخروج والعودة والخروج النهائي", sponsorship: "نقل الكفالات وتعديل المهن" },
      fundamental: { capital: "زيادة أو تخفيض رأس المال", partners: "دخول وخروج الشركاء والتنازل عن الحصص", entity: "تغيير الكيان القانوني والاندماج", liquidate: "تصفية الشركة أو تحويلها لمؤسسة" },
    };
    const managers = (Array.isArray(b.managers) ? b.managers : []).slice(0, 6).map((m) => ({
      name: String((m && m.name) || "").trim().slice(0, 160),
      nationality: String((m && m.nationality) || "").trim().slice(0, 80),
      partner: !!(m && m.partner),
      perms: m && m.perms && typeof m.perms === "object" ? m.perms : {},
    })).filter((m) => m.name);
    if (!company || !activity || !person || !isEmail(email) || partners.length < 2) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }

    // Upload every partner document to Notion so the whole identity file
    // lands on the CRM lead (capped: the request body itself is size-limited).
    const uploads = [];
    for (const p of partners) {
      for (const f of p.files) {
        if (uploads.length >= 12) break;
        const id = await uploadFileToNotion(f.data, f.name, f.contentType);
        if (id) uploads.push({ id, name: `${p.name} — ${f.label || f.name}`.slice(0, 100) });
      }
    }

    const partnersRows = partners.map((p) =>
      row(`شريك (${TYPE_AR[p.type]})`, `${p.name} · ${p.share != null ? p.share + "%" : "—"} · ${ID_AR[p.type]}: ${p.idNumber || "—"} · ميلاد (ميلادي): ${p.dob || "—"} · عنوان وطني: ${p.address || "—"} · ${p.phone || "—"} · ${p.email} · مرفقات: ${p.files.length}`)
    ).join("");
    const managerRows = managers.map((m) => {
      const groups = Object.entries(m.perms).slice(0, 12).map(([g, v]) => {
        const mode = v && v.mode === "joint" ? "يمارسها بموافقة كل المديرين" : "يمارسها منفرداً";
        const tk = v && v.tawkeel ? " · له حق التوكيل" : "";
        const subs = (Array.isArray(v && v.subs) ? v.subs : []).slice(0, 12).map((s) => (FC_SUBS[g] && FC_SUBS[g][s]) || String(s).slice(0, 40)).join("، ");
        return `<li style="margin-bottom:6px"><strong>${esc(FC_G[g] || String(g).slice(0, 40))}</strong> — ${mode}${tk}<br><span style="color:#555">${esc(subs)}</span></li>`;
      }).join("");
      return row(`مدير${m.partner ? " (من الشركاء)" : m.nationality ? ` (${m.nationality})` : ""}`, m.name) + (groups ? `<tr><td colspan="2" style="padding:4px 10px 12px"><ul style="margin:0;padding-inline-start:18px">${groups}</ul></td></tr>` : "");
    }).join("");
    const oHtml = `<div dir="rtl" style="font-family:Arial,sans-serif"><h2 style="color:#0B1B5A">طلب تأسيس بين شركاء ${ref}</h2><table>${row("الاسم المقترح", company) + row("الكيان", entity) + row("رأس المال", capital != null ? capital + " ﷼" : "—") + row("النشاط", activity) + row("مقدم الطلب", `${person} · ${phone} · ${email}`) + partnersRows}</table><h3 style="color:#0B1B5A">المديرون وصلاحياتهم (المادة الخامسة)</h3><table>${managerRows || row("المديرون", "لم تُحدد")}</table><p>مستندات الشركاء (${uploads.length}) مرفوعة على بطاقة العميل في Notion. صِغ عقد التأسيس وفق الحصص وجدول الصلاحيات أعلاه وقدّمه عبر المركز السعودي للأعمال، ثم رتّب توقيع الشركاء إلكترونياً — وصلتهم رسالة تمهيدية بالفعل.</p></div>`;
    const invite = (who, share) => `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430"><h2 style="color:#0B1B5A">تأسيس شركة ${esc(company)} — أنت من الشركاء 🖋️</h2><p>مرحباً ${esc(who)},</p><p>بدأنا إجراءات تأسيس <strong>${esc(company)}</strong> (${esc(entity)}${share != null ? ` — حصتك ${share}%` : ""}) عبر <strong>المركز السعودي للأعمال</strong>.</p><p>سنصيغ عقد التأسيس بصلاحيات المديرين المحددة ونرسل لكم دعوة التوقيع الإلكتروني فور جاهزيته، ثم نتابع حتى إصدار السجل التجاري.</p><table>${row("رقم المرجع", ref)}</table><p style="color:#0B1B5A">بزنس بارتنر · شريك تشغيلك</p></div>`;
    await Promise.all([
      sendEmail(TEAM_EMAIL, `تأسيس بين شركاء ${ref} — ${company}`, oHtml),
      sendEmail(email, `بدأنا تأسيس ${company} — ${ref}`, invite(person, null)),
      ...partners.map((p) => sendEmail(p.email, `تأسيس شركة ${company} — دعوة الشركاء`, invite(p.name, p.share))),
      crmLead({ title: `تأسيس بين شركاء — ${company}`, phone, email, notes: `تأسيس · ${entity} · ${activity}${capital != null ? " · رأس مال " + capital : ""} · شركاء: ${partners.map((p) => `${p.name} (${TYPE_AR[p.type]}${p.share != null ? " " + p.share + "%" : ""})`).join("، ")} · مديرون: ${managers.map((m) => m.name).join("، ") || "—"}`, ref, orderStatus: "قيد المراجعة", uploads }),
      addToAudience(email, person),
      forwardLead({ source: "formation-contract", ref, name: person, phone, email, items: company }),
    ]);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ref, partnersNotified: partners.length, filesUploaded: uploads.length }));
  }

  // Estrdad (Monsha'at fee-refund) eligibility assessment + file preparation.
  if (b.type === "estrdad") {
    const company = String(b.company || "").trim().slice(0, 200);
    const person = String(b.person || "").trim().slice(0, 160);
    const phone = String(b.phone || "").trim().slice(0, 40);
    const email = String(b.email || "").trim().toLowerCase().slice(0, 160);
    const ref = String(b.ref || "BPE-" + Date.now().toString().slice(-6)).slice(0, 40);
    const startYear = String(b.startYear || "").slice(0, 20);
    const workers = Number.isFinite(Number(b.workers)) && b.workers !== "" ? Number(b.workers) : null;
    const notes = String(b.notes || "").trim().slice(0, 900);
    if (!company || !person || !phone || !isEmail(email)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
    const oHtml = `<div style="font-family:Arial,sans-serif"><h2 style="color:#0B1B5A">طلب استرداد رسوم (منشآت) ${ref}</h2><table>${row("المنشأة", company) + row("المسؤول", person) + row("الجوال", phone) + row("البريد", email) + row("سنة بدء النشاط", startYear || "—") + row("عدد العمالة الأجنبية", workers != null ? String(workers) : "—")}${notes ? row("ملاحظات", notes) : ""}</table><p>قيّم الأهلية وفق اشتراطات مبادرة استرداد (سريان السجل والشهادات، نطاقات المطوّر، بدء النشاط 2024-2026…) وعد للعميل بفجوات الامتثال وخطة التجهيز.</p></div>`;
    const cHtml = `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430"><h2 style="color:#0B1B5A">استلمنا طلب تقييم الاسترداد ✅</h2><p>مرحباً ${esc(person)},</p><p>وصلنا طلبك لتقييم أهلية <strong>${esc(company)}</strong> لمبادرة «استرداد» من منشآت. سنراجع وضع منشأتك وفق الاشتراطات الرسمية ونعود لك بفجوات الامتثال وخطة تجهيز الملف.</p><table>${row("رقم المرجع", ref)}</table><p>تابع طلبك في لوحتك: <a href="${MKT_SITE_BASE}/account" style="color:#0B1B5A">${MKT_SITE_BASE}/account</a></p><p style="color:#0B1B5A">بزنس بارتنر</p></div>`;
    await Promise.all([
      sendEmail(TEAM_EMAIL, `طلب استرداد رسوم ${ref} — ${company}`, oHtml),
      sendEmail(email, `استلمنا طلب تقييم الاسترداد — ${ref}`, cHtml),
      crmLead({ title: `استرداد رسوم (منشآت) — ${company}`, phone, email, notes: `استرداد · بدء النشاط: ${startYear || "—"} · عمالة أجنبية: ${workers != null ? workers : "—"}${notes ? " · " + notes : ""}`, ref, orderStatus: "قيد المراجعة" }),
      addToAudience(email, person),
      forwardLead({ source: "estrdad", ref, name: person, phone, email, items: company }),
    ]);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ref }));
  }

  // Official-quote request from the cost calculator — no payment/receipt step.
  // Lands in the client's dashboard (via bp_orders locally) and in the CRM with
  // status «بانتظار التسعير» so the team prices it and comes back with an offer.
  if (b.type === "quote") {
    const name = String(b.name || "").trim().slice(0, 160);
    const phone = String(b.phone || "").trim().slice(0, 40);
    const email = String(b.email || "").trim().toLowerCase().slice(0, 160);
    const ref = String(b.ref || "BPQ-" + Date.now().toString().slice(-6)).slice(0, 40);
    const items = (Array.isArray(b.items) ? b.items.map((x) => (typeof x === "string" ? x : (x && x.name) || "")).filter(Boolean) : [String(b.items || "")]).join("، ").slice(0, 900);
    if (!name || !isEmail(email) || !items) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
    const oHtml = `<div style="font-family:Arial,sans-serif"><h2 style="color:#0B1B5A">طلب عرض سعر رسمي ${ref}</h2><table>${row("الاسم", name) + row("الجوال", phone) + row("البريد", email) + row("الخدمات", items)}</table><p>العميل طلب عرضاً رسمياً من حاسبة التكلفة — سعّر السلة وارجع له بالعرض، ثم حدّث حالة الطلب في «Sales Pipeline» (رقم المرجع ${ref}).</p></div>`;
    const cHtml = `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430"><h2 style="color:#0B1B5A">استلمنا طلب العرض ✅</h2><p>مرحباً ${esc(name)},</p><p>وصلنا طلبك لعرض سعر رسمي على الخدمات التالية، وفريقنا يجهّز لك العرض الآن وسنعود إليك سريعاً.</p><table>${row("رقم المرجع", ref) + row("الخدمات", items)}</table><p>تابع حالة طلبك في لوحتك: <a href="${MKT_SITE_BASE}/account" style="color:#0B1B5A">${MKT_SITE_BASE}/account</a></p><p style="color:#0B1B5A">بزنس بارتنر</p></div>`;
    await Promise.all([
      sendEmail(TEAM_EMAIL, `طلب عرض رسمي ${ref} — ${name}`, oHtml),
      sendEmail(email, `استلمنا طلب العرض — ${ref}`, cHtml),
      crmLead({ title: `طلب عرض رسمي — ${name}`, phone, email, notes: `عرض سعر · ${items}`, ref, orderStatus: "بانتظار التسعير" }),
      addToAudience(email, name),
      forwardLead({ source: "quote", ref, name, phone, email, items }),
    ]);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ref }));
  }

  // Client-initiated cancellation from /account — only for orders still under
  // review (never a completed one). Flips the CRM row's حالة الطلب to ملغي so
  // /account picks it up on its next live-status sync, and pings the team so
  // no bank transfer gets processed for a cancelled order.
  if (b.type === "cancel-order") {
    const ref = String(b.ref || "").trim().slice(0, 40);
    const email = String(b.email || "").trim().toLowerCase().slice(0, 160);
    const name = String(b.name || "").trim().slice(0, 160);
    if (!ref || !isEmail(email)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
    if (!NOTION_TOKEN) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "not_configured" })); }
    const q = await fetch(`https://api.notion.com/v1/databases/${CRM_DB}/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
      body: JSON.stringify({ page_size: 1, filter: { property: "رقم المرجع", rich_text: { equals: ref } } }),
    });
    if (!q.ok) { console.error("cancel-order query error", q.status, (await q.text()).slice(0, 300)); res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_failed" })); }
    const page = ((await q.json()).results || [])[0];
    if (!page) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: "order_not_found" })); }
    const p = page.properties || {};
    const notesText = ((p["Notes"] && p["Notes"].rich_text) || []).map((t) => t.plain_text).join("");
    const emailM = notesText.match(/البريد:\s*([^\s·]+@[^\s·]+)/);
    if (!emailM || emailM[1].toLowerCase() !== email) { res.statusCode = 403; return res.end(JSON.stringify({ ok: false, error: "email_mismatch" })); }
    const status = p["حالة الطلب"] && p["حالة الطلب"].select && p["حالة الطلب"].select.name;
    if (status === "مكتمل") { res.statusCode = 409; return res.end(JSON.stringify({ ok: false, error: "already_completed" })); }
    if (status !== "ملغي") {
      const patchRes = await fetch(`https://api.notion.com/v1/pages/${page.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
        body: JSON.stringify({ properties: { "حالة الطلب": { select: { name: "ملغي" } } } }),
      });
      if (!patchRes.ok) { console.error("cancel-order patch error", patchRes.status, (await patchRes.text()).slice(0, 300)); res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_failed" })); }
      const cHtml = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto" dir="rtl"><h2 style="color:#0B1B5A">إلغاء طلب — ${esc(ref)}</h2><table>${row("الاسم", name) + row("البريد", email)}</table><p>ألغى العميل هذا الطلب من صفحة حسابه. تأكد أنه لا يوجد تحويل بنكي مستحق قبل إقفال الصف نهائياً في Notion.</p></div>`;
      await sendEmail(TEAM_EMAIL, `إلغاء طلب ${ref}`, cHtml);
    }
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ref }));
  }

  // Task Force intake from /task-force — a complex/multi-party executive task.
  if (b.type === "task-force") {
    const company = String(b.company || "").trim().slice(0, 200);
    const person = String(b.person || "").trim().slice(0, 160);
    const phone = String(b.phone || "").trim().slice(0, 40);
    const email = String(b.email || "").trim().toLowerCase().slice(0, 160);
    const notes = String(b.notes || "").trim().slice(0, 1500);
    if (!company || !person || !phone || !notes) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
    const ref = "TF-" + Date.now().toString().slice(-6);
    const teamHtml = `<div style="font-family:Arial,sans-serif"><h2 style="color:#0B1B5A">مهمة Task Force جديدة — ${ref}</h2><table>${row("الشركة", company) + row("المسؤول", person) + row("الجوال", phone) + row("الإيميل", email) + row("وصف المهمة", notes)}</table></div>`;
    const clientHtml = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
      <h2 style="color:#0B1B5A">تم استلام مهمتك — ${ref}</h2>
      <p>مرحباً ${esc(person)}، استلمنا تفاصيل مهمتك في Task Force. فريقنا يراجع النطاق ويعود إليك بمسار التنفيذ المناسب وعرض سعر حسب تعقيدها.</p>
      <p style="color:#666">Business Partner · Riyadh · wa.me/966507034157</p></div>`;
    const [teamSent, clientSent] = await Promise.all([
      sendEmail(TEAM_EMAIL, `مهمة Task Force جديدة — ${company}`, teamHtml),
      isEmail(email) ? sendEmail(email, `تم استلام مهمتك ${ref} — Business Partner`, clientHtml) : Promise.resolve({ ok: false }),
      crmLead({ title: `Task Force — ${company}`, phone, email, notes: `Task Force · ${notes}`, ref }),
      addToAudience(email, person),
      forwardLead({ source: "task-force", ref, name: person, company, phone, email, notes }),
    ]);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ref, emailSent: !!teamSent.ok }));
  }

  // Deal submission from /deals — offer a deal, seek a partner, or pitch an
  // idea. Reviewed by the team before it's ever published on the deal wall;
  // contact details are never shown publicly (double opt-in "request intro").
  if (b.type === "deal") {
    const DEAL_TYPE_AR = { offer: "🤝 عرض صفقة", seek: "🔎 يبحث عن شريك", idea: "💡 فكرة مشروع" };
    const dealType = ["offer", "seek", "idea"].includes(b.dealType) ? b.dealType : "seek";
    const title = String(b.title || "").trim().slice(0, 200);
    const sector = String(b.sector || "").trim().slice(0, 60);
    const city = String(b.city || "").trim().slice(0, 60);
    const description = String(b.description || "").trim().slice(0, 1500);
    const name = String(b.name || "").trim().slice(0, 160);
    const phone = String(b.phone || "").trim().slice(0, 40);
    const email = String(b.email || "").trim().toLowerCase().slice(0, 160);
    if (!name || !phone || !isEmail(email)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
    const ref = "DL-" + Date.now().toString().slice(-6);
    const typeLabel = DEAL_TYPE_AR[dealType];
    const teamHtml = `<div style="font-family:Arial,sans-serif"><h2 style="color:#0B1B5A">صفقة جديدة — ${ref}</h2><table>${row("النوع", typeLabel) + row("العنوان", title) + row("القطاع", sector) + row("المدينة", city) + row("الوصف", description) + row("الاسم", name) + row("الجوال", phone) + row("الإيميل", email)}</table><p>راجع الملف واعتمده قبل ظهوره على حائط الصفقات.</p></div>`;
    const clientHtml = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto" dir="rtl">
      <h2 style="color:#0B1B5A">وصلنا ملفك بنجاح — ${ref}</h2>
      <p>مرحباً ${esc(name)}، استلمنا ملف صفقتك وسيراجعه فريقنا خلال 24 ساعة. سنرسل لك تأكيداً عند النشر وعند أي مطابقة جديدة.</p>
      <p style="color:#666">Business Partner · Riyadh · wa.me/966507034157</p></div>`;
    const [teamSent] = await Promise.all([
      sendEmail(TEAM_EMAIL, `صفقة جديدة (${typeLabel}) — ${title || name}`, teamHtml),
      sendEmail(email, `وصلنا ملفك ${ref} — Business Partner`, clientHtml),
      crmLead({ title: `صفقة — ${title || name}`, phone, email, notes: `Deals · ${typeLabel} · ${sector} · ${city} · ${description}`, ref }),
      addToAudience(email, name),
      forwardLead({ source: "deal", ref, dealType, title, sector, city, description, name, phone, email }),
    ]);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ref, emailSent: !!teamSent.ok }));
  }

  // Magazine PDF download gate (/magazine) — capture the lead, then email a
  // link to the print-ready issue (the browser's print-to-PDF renders it —
  // no server-side PDF library, so Arabic text shapes correctly for free).
  if (b.type === "magazine") {
    const name = String(b.name || "").trim().slice(0, 160);
    const phone = String(b.phone || "").trim().slice(0, 40);
    const email = String(b.email || "").trim().toLowerCase().slice(0, 160);
    if (!name || !phone || !isEmail(email)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
    const ref = "MAG-" + Date.now().toString().slice(-6);
    const printUrl = `${SITE_BASE}/magazine/print`;
    const clientHtml = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
      <h2 style="color:#0B1B5A">مجلة Business Partner جاهزة 📰</h2>
      <p>مرحباً ${esc(name)}، شكراً لتسجيلك. اضغط الرابط لفتح نسختك من المجلة — واستخدم أمر الطباعة في متصفحك واختر "حفظ كـ PDF" لتنزيلها.</p>
      <p><a href="${printUrl}" style="background:#0B1B5A;color:#fff;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:bold">افتح المجلة</a></p>
      <p style="color:#666">Business Partner · Riyadh · wa.me/966507034157</p></div>`;
    await Promise.all([
      sendEmail(TEAM_EMAIL, `تسجيل جديد لتحميل المجلة — ${name}`, `<div style="font-family:Arial,sans-serif">${row("الاسم", name)}${row("الجوال", phone)}${row("الإيميل", email)}</div>`),
      sendEmail(email, "مجلة Business Partner — رابط التحميل", clientHtml),
      crmLead({ title: `تسجيل مجلة — ${name}`, phone, email, notes: "Magazine PDF gate", ref }),
      addToAudience(email, name),
      forwardLead({ source: "magazine", ref, name, phone, email }),
    ]);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ref, printUrl: "/magazine/print" }));
  }

  // Investor business tourism request — Mahfol Makfol (/mahfol-makfol).
  if (b.type === "investor-tourism") {
    const company = String(b.company || "").trim().slice(0, 200);
    const person = String(b.person || "").trim().slice(0, 160);
    const phone = String(b.phone || "").trim().slice(0, 40);
    const email = String(b.email || "").trim().toLowerCase().slice(0, 160);
    const country = String(b.country || "").trim().slice(0, 120);
    const date = String(b.date || "").trim().slice(0, 60);
    const count = String(b.count || "").trim().slice(0, 20);
    const sector = String(b.sector || "").trim().slice(0, 200);
    const notes = String(b.notes || "").trim().slice(0, 1000);
    if (!company || !person || !phone || !isEmail(email)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
    const ref = "MM-" + Date.now().toString().slice(-6);
    const rows = row("الشركة / الجهة", company) + row("المسؤول", person) + row("الجوال", phone) + row("الإيميل", email) +
      row("الدولة", country) + row("الفترة المفضّلة", date) + row("عدد الوفد", count) + row("مجال الاهتمام", sector) + row("تفاصيل إضافية", notes);
    const teamHtml = `<div style="font-family:Arial,sans-serif"><h2 style="color:#0B1B5A">طلب سياحة أعمال جديد (محفول مكفول) — ${ref}</h2><table>${rows}</table></div>`;
    const clientHtml = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
      <h2 style="color:#0B1B5A">تم استلام طلبك — ${ref}</h2>
      <p>مرحباً ${esc(person)}، استلمنا تفاصيل رحلتك الاستكشافية. فريق محفول مكفول يصمّم لك برنامجاً حسب نشاطك واهتمامك ويعود إليك خلال يوم عمل.</p>
      <p style="color:#666">Business Partner · Riyadh · wa.me/966507034157</p></div>`;
    await Promise.all([
      sendEmail(TEAM_EMAIL, `طلب سياحة أعمال جديد — ${company}`, teamHtml),
      sendEmail(email, `تم استلام طلبك ${ref} — محفول مكفول`, clientHtml),
      crmLead({ title: `سياحة أعمال (محفول مكفول) — ${company}`, phone, email, notes: `Mahfol Makfol · ${sector || "—"} · وفد ${count || "—"} · ${notes}`, ref }),
      addToAudience(email, person),
      forwardLead({ source: "investor-tourism", ref, name: person, company, phone, email, notes: `${country} · ${sector}` }),
    ]);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ref }));
  }

  // Leisure trip request — Mahfol Makfol trips track (/mahfol-makfol/trips).
  if (b.type === "trip") {
    const person = String(b.person || "").trim().slice(0, 160);
    const phone = String(b.phone || "").trim().slice(0, 40);
    const email = String(b.email || "").trim().toLowerCase().slice(0, 160);
    const dest = String(b.dest || "").trim().slice(0, 160);
    const date = String(b.date || "").trim().slice(0, 60);
    const count = String(b.count || "").trim().slice(0, 20);
    const notes = String(b.notes || "").trim().slice(0, 1000);
    if (!person || !phone || !isEmail(email)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
    const ref = "TR-" + Date.now().toString().slice(-6);
    const rows = row("الاسم", person) + row("الجوال", phone) + row("الإيميل", email) +
      row("الوجهة", dest) + row("التواريخ", date) + row("عدد الأشخاص", count) + row("تفاصيل إضافية", notes);
    const teamHtml = `<div style="font-family:Arial,sans-serif"><h2 style="color:#0B1B5A">طلب رحلة جديد (محفول مكفول) — ${ref}</h2><table>${rows}</table></div>`;
    const clientHtml = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
      <h2 style="color:#0B1B5A">تم استلام طلب رحلتك — ${ref}</h2>
      <p>مرحباً ${esc(person)}، استلمنا تفاصيل رحلتك${dest ? " إلى " + esc(dest) : ""}. فريق محفول مكفول يصمّم لك برنامجاً وتسعيرة ويعود إليك خلال يوم.</p>
      <p style="color:#666">Business Partner · Riyadh · wa.me/966507034157</p></div>`;
    await Promise.all([
      sendEmail(TEAM_EMAIL, `طلب رحلة جديد — ${dest || person}`, teamHtml),
      sendEmail(email, `تم استلام طلب رحلتك ${ref} — محفول مكفول`, clientHtml),
      crmLead({ title: `رحلة (محفول مكفول) — ${dest || person}`, phone, email, notes: `Mahfol Makfol trips · ${dest || "—"} · ${count || "—"} أشخاص · ${notes}`, ref }),
      addToAudience(email, person),
      forwardLead({ source: "trip", ref, name: person, phone, email, notes: `${dest} · ${date} · ${count}` }),
    ]);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ref }));
  }

  const type = b.type === "supplier" ? "supplier" : "event";
  const f = {};
  for (const k of ["company", "person", "phone", "email", "date", "count", "klass", "venue", "eventType", "city", "cr", "category", "notes"]) {
    f[k] = String(b[k] || "").trim().slice(0, k === "notes" ? 1000 : 160);
  }
  f.email = f.email.toLowerCase();

  if (!f.company || !f.person || !f.phone || !isEmail(f.email)) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: "invalid_fields" }));
  }
  if (type === "event" && !isCorporateEmail(f.email)) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: "free_email", message: "الرجاء استخدام إيميل الشركة الرسمي — لا تُقبل الإيميلات المجانية (Gmail وغيرها)." }));
  }

  const ref = (type === "event" ? "EV-" : "SP-") + Date.now().toString().slice(-6);
  const title = type === "event" ? `طلب فعالية جديد — ${ref}` : `تسجيل مورّد جديد — ${ref}`;
  const rows = type === "event"
    ? row("الشركة", f.company) + row("المسؤول", f.person) + row("الجوال", f.phone) + row("الإيميل", f.email) +
      row("تاريخ الفعالية", f.date) + row("عدد الأفراد", f.count) + row("المستوى", f.klass) +
      row("نوع المكان", f.venue) + row("نوع الفعالية", f.eventType) + row("تفاصيل", f.notes)
    : row("الشركة", f.company) + row("المسؤول", f.person) + row("الجوال", f.phone) + row("الإيميل", f.email) +
      row("المدينة", f.city) + row("السجل التجاري", f.cr) + row("التصنيف", f.category) + row("الخدمات", f.notes);
  const teamHtml = `<div style="font-family:Arial,sans-serif"><h2 style="color:#0B1B5A">${title}</h2><table>${rows}</table></div>`;
  const clientHtml = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
    <h2 style="color:#0B1B5A">${type === "event" ? "تم استلام طلب فعاليتك" : "تم استلام تسجيلك كمورّد"} — ${ref}</h2>
    <p>مرحباً ${esc(f.person)}، ${type === "event"
      ? "استلمنا طلب فعاليتكم وسنجمع لكم أفضل 5 عروض من المزوّدين ونعود إليكم قريباً."
      : "استلمنا تسجيلكم في بوابة الموردين وسنتواصل معكم لاستكمال الانضمام."}</p>
    <p style="color:#666">Business Partner · Riyadh · wa.me/966507034157</p></div>`;

  const crmNotes = type === "event"
    ? `فعالية · ${f.company} · تاريخ ${f.date} · ${f.count} فرد · ${f.eventType}`
    : `مورّد · ${f.company} · ${f.city} · تصنيف ${f.category}`;
  const [teamSent, clientSent] = await Promise.all([
    sendEmail(TEAM_EMAIL, `${title} — ${f.company}`, teamHtml),
    sendEmail(f.email, `${type === "event" ? "تأكيد طلب الفعالية" : "تأكيد تسجيل المورّد"} ${ref} — Business Partner`, clientHtml),
    crmLead({ title: type === "event" ? `فعالية مؤسسية — ${f.company}` : `تسجيل مورّد — ${f.company}`, phone: f.phone, email: f.email, notes: crmNotes, ref }),
    addToAudience(f.email, f.person),
    forwardLead({ source: type, ref, name: f.person, company: f.company, phone: f.phone, email: f.email, notes: crmNotes }),
  ]);

  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true, ref, emailSent: !!(teamSent.ok && clientSent.ok) }));
}
