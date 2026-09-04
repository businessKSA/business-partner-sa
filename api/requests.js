import crypto from "node:crypto";
import { DB_ON, sb, getSession, audit, notify, storagePut, storageSign, storageDelete } from "./_db.js";

import { loadCatalog, normalizeText } from "./_catalog.js";
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
import { handleSuppliers, progressForClientRefs, quotesForClientRefs, decideQuote, markOrderPaid, parseSubsFromNotes } from "./_suppliers.js";
import { bdTrial, isPaidBdOrder, openFor } from "./_trial.js";
import {
  SECTORS as BD_SECTORS, CITIES as BD_CITIES, normalizeProfile, profileCompleteness,
  canMatch, mergeExtracted, sectorLabel, cityLabel, PROFILE_READ_PROMPT,
} from "./_bdprofile.js";
import { LEADS_DB as BD_LEADS_DB, matchQuery as bdMatchQuery, mapCompany as bdMapCompany, explainMatch as bdExplainMatch } from "./_bdmatch.js";
import { handleAgencies } from "./_agencies.js";
import { handleJobhunt } from "./_jobhunt.js";
import { stageChannels, announce, waSend } from "./_stage.js";
import { moyasarPing, mpfCheck } from "./_moyasar.js";
import { nafathPing, ownerTicketOk, panelRequiresNafath } from "./_nafath.js";
import { etimadPing, etimadConfigured } from "./_etimad.js";
import { sellerProfile } from "./_zatca.js";
import { BANK } from "./_identity.js";
import { readDocument, readDocumentRaw, parseJson, MAX_DOC_BYTES, DOC_MIME_OK } from "./_docread.js";
import { handleDocAgent } from "./_docagent.js";
import { handleSimple } from "./_simple.js";
import { daftraPing, daftraFindOrCreateClient, daftraCreateInvoice, daftraRecordPayment, daftraPublicInvoiceLink, daftraConfigured, daftraVatRate, nationalAddressLine, daftraInspectInvoice, daftraSyncCatalog, daftraResetProductCache, daftraCreateEstimate, daftraDocPdf, daftraListClients, daftraPdfProbe, daftraUpdateClient, daftraFindInvoice, daftraSetInvoiceClient, daftraCreateCreditNote, daftraProbeEndpoints, daftraPayLink, daftraPayLinkProbe, daftraSendProbe} from "./_daftra.js";
const envFrom = (names) => { for (const n of names) { if (process.env[n] && String(process.env[n]).trim()) return String(process.env[n]).trim(); } return ""; };
const NOTION_TOKEN = envFrom(["NOTION_TOKEN", "BusinessPartnerSiteNotion", "NOTION_SECRET", "NOTION_API_KEY", "NOTION_KEY", "NOTION_INTEGRATION_TOKEN", "NOTION"]);
const CRM_DB = process.env.NOTION_CRM_DB || "d9a342be24774be3b4095d439d21fc90";
// Owner key that gates the internal dashboard's "incoming requests" list and
// every /admin panel action. ENV-ONLY on purpose: this repo is public, so a
// hardcoded fallback key (the old "demo123") would be a public master key to
// customer data, order statuses, activations and GitHub content writes.
// Set PANEL_KEY (or LEADS_KEY / DASHBOARD_KEY) in Vercel env.
// Values are trimmed: a stray space/newline pasted into the Vercel env UI
// must not permanently lock the owner out.
const LEADS_KEY = (process.env.LEADS_KEY || process.env.DASHBOARD_KEY || "").trim();
const PANEL_KEY = (process.env.PANEL_KEY || "").trim();
const PANEL_KEYS = new Set([PANEL_KEY, LEADS_KEY].filter(Boolean));
// Two ways through the same door, and they are not equivalent. A key proves
// someone knows a secret — which is forwardable, copyable and anonymous. A
// Nafath ticket proves an identity on the OWNER_NATIONAL_IDS list actually
// approved this session on their own phone. With PANEL_REQUIRE_NAFATH=1 only
// the second is accepted.
const panelKeyOk = (k) => !panelRequiresNafath() && PANEL_KEYS.size > 0 && PANEL_KEYS.has(String(k || "").trim());
const panelOk = (src) => {
  const s = src && typeof src === "object" ? src : { key: src };
  return ownerTicketOk(s.ticket) || panelKeyOk(s.key);
};
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
// Shared Services: free trial length (days) for every registered client.
const SS_TRIAL_DAYS = Number(process.env.SS_TRIAL_DAYS || 30) || 30;

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
      page_size: Math.min(Math.max(Number(limit) || 40, 1), 100),
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
    const source = (p["Lead Source"] && p["Lead Source"].select && p["Lead Source"].select.name) || "";
    const at = (p["Last Activity"] && p["Last Activity"].date && p["Last Activity"].date.start) || (pg.created_time || "").slice(0, 10);
    const phoneM = notes.match(/الجوال:\s*([+\d][\d\s()-]{5,})/);
    const emailM = notes.match(/البريد:\s*([^\s·]+@[^\s·]+)/);
    const totalProp = p["إجمالي الطلب"];
    const total = totalProp && typeof totalProp.number === "number" ? totalProp.number : null;
    const receiptFiles = (p["الإيصال البنكي"] && p["الإيصال البنكي"].files) || [];
    const detailsM = notes.match(/طلب\s*·\s*([^·]+)/);
    // The buyer chose their invoice type at checkout; parse it back so the
    // panel's invoice form is prefilled rather than re-keyed from the email.
    // Anchored on the separator so «المسؤول» cannot match inside «جوال المسؤول».
    const field = (label) => {
      const m = notes.match(new RegExp(`(?:^|·)\\s*${label}:\\s*([^·\\n]+)`));
      return m ? m[1].trim() : "";
    };
    const taxKind = /نوع الفاتورة:\s*منشأة/.test(notes) ? "company" : (/نوع الفاتورة:\s*شخصي/.test(notes) ? "personal" : "");
    return {
      title, ref, at, stage, status, source,
      channel: channelOf({ ref, source, order: status, title }),
      // Whose name the invoice belongs in, when the buyer named an
      // establishment but did not go through the tax-profile step.
      company: field("المنشأة"),
      tax: taxKind ? {
        kind: taxKind,
        nameAr: field("اسم المنشأة"),
        vat: field("الرقم الضريبي").replace(/\D/g, ""),
        cr: field("س\\.ت الضريبي"),
        contact: field("المسؤول"),
        contactPhone: field("جوال المسؤول"),
        addressLine: field("العنوان الوطني"),
      } : null,
      phone: phoneM ? phoneM[1].replace(/[\s()-]/g, "").trim() : "",
      email: emailM ? emailM[1] : "",
      total,
      // Monthly subscriptions recorded on the order, parsed back out of the
      // note so /admin can show the renewal price and the agreed commission
      // without the owner re-reading a paragraph to find them.
      subscriptions: parseSubsFromNotes(notes),
      hasReceipt: receiptFiles.length > 0,
      details: detailsM ? detailsM[1].trim().slice(0, 140) : "",
      // Everything the owner needs to actually read a request without leaving
      // /admin: the full note body, the attached receipts, and a deep link back
      // to the CRM page. The table used to ship a 140-char excerpt only.
      notes: notes.slice(0, 6000),
      receipts: receiptFiles.map((f) => ({
        name: String(f.name || "الإيصال"),
        url: (f.file && f.file.url) || (f.external && f.external.url) || "",
      })).filter((f) => f.url),
      createdAt: pg.created_time || "",
      url: pg.url || "",
    };
  });
}

// Website advisor conversations → flat message list for the BP Inbox monitor.
// Each CRM page (Lead Source = «مستشار الموقع») is one thread keyed by its ref;
// Notes carries the meta line + labelled transcript we parse back into bubbles.
// One Saudi number, one spelling: 05…, +966…, 00966… and 9665… all collapse to
// 9665XXXXXXXX so a customer is recognised as themselves.
function canonicalPhone(raw) {
  let d = String(raw || "").replace(/[^0-9]/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("966")) return d;
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length === 9 && d.startsWith("5")) return "966" + d;
  return d;
}

async function listConversations(limit) {
  if (!NOTION_TOKEN) return [];
  const r = await fetch(`https://api.notion.com/v1/databases/${CRM_DB}/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
    body: JSON.stringify({
      page_size: Math.min(Math.max(Number(limit) || 40, 1), 80),
      filter: { or: [{ property: "Lead Source", select: { equals: CONV_SOURCE } }, { property: "Lead Source", select: { equals: TICKET_SOURCE } }] },
      sorts: [{ property: "Last Activity", direction: "descending" }],
    }),
  });
  if (!r.ok) { console.error("conv query error", r.status, (await r.text()).slice(0, 200)); throw new Error("notion_failed"); }
  const data = await r.json();
  const txt = (arr) => (arr || []).map((t) => t.plain_text).join("");
  const out = [];
  for (const pg of data.results || []) {
    const p = pg.properties || {};
    const src = (p["Lead Source"] && p["Lead Source"].select && p["Lead Source"].select.name) || CONV_SOURCE;
    const isTicket = src === TICKET_SOURCE;
    const ref = txt(p["رقم المرجع"] && p["رقم المرجع"].rich_text).trim() || pg.id;
    const notes = txt(p["Notes"] && p["Notes"].rich_text);
    const nameM = notes.match(/(?:الموقع\)|دعم)\s*·\s*([^·\n]+?)(?:\s*·|\n)/);
    const phoneM = notes.match(/الجوال:\s*([+\d][\d\s()-]{5,})/);
    const emailM = notes.match(/البريد:\s*([^\s·]+@[^\s·]+)/);
    const name = nameM ? nameM[1].trim() : "";
    const phone = phoneM ? phoneM[1].replace(/[\s()-]/g, "").trim() : "";
    const email = emailM ? emailM[1] : "";
    const crm = `https://www.notion.so/${String(pg.id).replace(/-/g, "")}`;
    // A ticket happened when it was filed; last_edited_time is when the row was
    // last touched by a sync, which is identical across a bulk write and made
    // every ticket in the inbox claim the same minute. Advisor chats are
    // upserted as they grow, so there last_edited_time really is the last line.
    const created = new Date(pg.created_time || pg.last_edited_time || Date.now()).getTime();
    const edited = new Date(pg.last_edited_time || pg.created_time || Date.now()).getTime();
    const base = isTicket ? created : edited;
    // One customer is one conversation. Keying threads by the ticket reference
    // split a client across as many threads as they had tickets — three from
    // the same person read as three strangers with one message each. Website
    // threads stay under their own key so a read-only ticket never merges into
    // a repliable WhatsApp thread.
    // 0566552055 and +966566552055 are the same customer; keying on the raw
    // string would still split them into two threads.
    const identity = canonicalPhone(phone) || email.toLowerCase() || ref;
    // An advisor reference is already "WEB-<sid>"; prefixing again produced the
    // nonsense key "WEB-WEB-<sid>" for visitors who left no contact details.
    const threadKey = identity.startsWith("WEB-") ? identity : "WEB-" + identity;
    const source = isTicket ? "تذكرة" : "المستشار";
    if (isTicket) {
      // A ticket is a single record — render it as one summary message.
      const body = notes.split("\n").filter((l) => /^(الخدمة|تفاصيل):/.test(l)).join(" · ") || notes;
      out.push({ phone: threadKey, source, ref, name: name || "عميل", contactPhone: phone, contactEmail: email, sender: "العميل", text: "🎫 " + body, time: new Date(base).toISOString(), crm });
      continue;
    }
    const lines = notes.split("\n").slice(1).filter((l) => /^(🧑|🤖)/.test(l));
    lines.forEach((line, i) => {
      const isBot = line.startsWith("🤖");
      const text = line.replace(/^(🧑\s*الزائر:|🤖\s*باهر:)\s*/, "").trim();
      out.push({ phone: threadKey, source, ref, name: name || "زائر الموقع", contactPhone: phone, contactEmail: email, sender: isBot ? "الوكيل" : "العميل", text, time: new Date(base - (lines.length - i) * 1000).toISOString(), crm });
    });
    if (!lines.length) out.push({ phone: threadKey, source, ref, name: name || "زائر الموقع", contactPhone: phone, contactEmail: email, sender: "الوكيل", text: "—", time: new Date(base).toISOString(), crm });
  }
  out.sort((a, b) => new Date(a.time) - new Date(b.time));
  return out;
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

// The CRM's own pipeline is what makes follow-up possible: the board groups by
// Stage and the "New Leads" view filters on it. Writing only «حالة الطلب» left
// every row in "New" forever — cancelled ones, finished ones, all of them — so
// the board was one column and the follow-up view never emptied. The order
// status the owner already sets is mapped onto the stage it means.
const STAGE_OF = {
  "قيد المراجعة": "Qualified",
  "بانتظار الدفع": "Proposal Sent",
  "مؤكد - قيد التنفيذ": "Won",
  "مكتمل": "Won",
  "ملغي": "Lost",
  "حجز استشارة": "Meeting",
};
// Conversations and tickets are not deals; moving them through a sales board
// would only add noise to it.
const CLOSED = new Set(["مكتمل", "ملغي"]);
const plusDaysISO = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

async function crmLead({ title, phone, email, notes, ref, orderStatus, agents, total, receiptUploadId, receiptName, uploads, leadSource, followUpDays }) {
  if (!NOTION_TOKEN) return;
  const today = new Date().toISOString().slice(0, 10);
  const agentsTag = Array.isArray(agents) && agents.length ? ` · AGENTS:${agents.join(",")}` : "";
  const props = {
    "Opportunity Name": { title: [{ text: { content: `${title} (${ref})`.slice(0, 200) } }] },
    // A paid order arriving from the site is a qualified opportunity, not an
    // unsorted lead. Landing everything in "New" is what made the board
    // useless: the follow-up view could never tell a real request from noise.
    "Stage": { select: { name: orderStatus && STAGE_OF[orderStatus] ? STAGE_OF[orderStatus] : "New" } },
    // Lead Source names the actual channel, not a generic "Website" — the same
    // vocabulary channelOf() uses, so Notion, the panel and the digests agree.
    "Lead Source": { select: { name:
      leadSource ? String(leadSource).slice(0, 60)
      : orderStatus === "حجز استشارة" ? "حجز استشارة"
      : String(ref || "").startsWith("MAG-") ? "تحميل مجلة"
      : String(ref || "").startsWith("BP-WS") ? "مساحة عمل"
      : (typeof total === "number" && total > 0) || String(ref || "").startsWith("BPB-") ? "شراء خدمة"
      : "نموذج الموقع" } },
    "Human Required": { checkbox: true },
    "Notes": { rich_text: [{ text: { content: `الجوال: ${phone} · البريد: ${email}${notes ? " · " + notes : ""}${agentsTag}`.slice(0, 1900) } }] },
    "Last Activity": { date: { start: today } },
    // Every open row carries a date, so nothing depends on being remembered.
    // A deferred invoice sets its own date: the chase lands on the due day.
    "Next Follow Up": { date: { start: plusDaysISO(Number.isFinite(Number(followUpDays)) ? Number(followUpDays) : 2) } },
    "رقم المرجع": { rich_text: [{ text: { content: String(ref || "").slice(0, 60) } }] },
  };
  if (orderStatus) props["حالة الطلب"] = { select: { name: orderStatus } };
  // The pipeline has dedicated Phone/Email columns; burying contact info only
  // inside Notes made every row unreadable at a glance and unfilterable.
  if (phone) props["Phone"] = { phone_number: String(phone).slice(0, 40) };
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) props["Email"] = { email: String(email).slice(0, 160) };
  if (typeof total === "number" && !Number.isNaN(total)) {
    props["إجمالي الطلب"] = { number: total };
    // The board and every pipeline roll-up read Estimated Value, so a request
    // worth 2,712 riyals stopped showing as worth nothing.
    props["Estimated Value"] = { number: total };
  }
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

// ---- Unified CRM: ONE master board (Sales Pipeline), everything feeds it ----
// The owner was juggling a WhatsApp leads database, a Sales Pipeline, the BP
// Inbox and e-mail alerts — and losing clients between them. The rule now:
// the Sales Pipeline in Notion is the single record; the WhatsApp
// qualification database (written by the n8n orchestrator) is mirrored into
// it, and a daily sweep turns whatever needs attention into ONE digest sent
// to the owner on WhatsApp + e-mail, with the same list shown at the top of
// /admin as «متابعات اليوم».
const WA_CRM_DB = process.env.NOTION_WA_CRM_DB || "b322a7ec23a94ceb875e52c07b00eadf";
// دفتر المالية الداخلي — إيرادات ومصروفات (قاعدة نوشن يحررها المالك من نوشن
// أو من لوحة /admin؛ لوحة «المالية» تقرأ منها مباشرة).
const FINANCE_DB = process.env.NOTION_FINANCE_DB || "ee216ff23a9a4165acb0c4e6603f495f";
// The owner's WhatsApp — same number published on the site as the advisor
// line. Digits only, and overridable without a deploy.
const OWNER_WA = String(process.env.CRM_OWNER_WHATSAPP || process.env.OWNER_WHATSAPP || "966530540231").replace(/\D/g, "");

// Databases the in-panel Notion viewer may read AND write. Notion refuses to
// be iframed, so /admin gets a live API-backed mirror instead: these are the
// workspaces the site itself already works with, nothing else is reachable.
const NOTION_PANEL_DBS = {
  pipeline: { id: CRM_DB, title: "📈 Sales Pipeline — السي آر إم الرئيسي" },
  wacrm: { id: WA_CRM_DB, title: "📱 عملاء الواتساب" },
  consultations: { id: process.env.NOTION_CONSULT_DB || "912dceb1d8c345b1b8d4ca1f6cd76fb3", title: "📅 الاستشارات القادمة" },
  companies: { id: process.env.NOTION_COMPANIES_DB || "26faca2761884b6ab584924c374f2d22", title: "🏢 قاعدة الشركات — مبيعات" },
};
// Human-readable value for ANY Notion property type (viewer display only).
function propDisplay(p) {
  if (!p) return "";
  switch (p.type) {
    case "title": case "rich_text": return (p[p.type] || []).map((t) => t.plain_text || "").join("");
    case "select": return (p.select && p.select.name) || "";
    case "status": return (p.status && p.status.name) || "";
    case "multi_select": return (p.multi_select || []).map((o) => o.name).join("، ");
    case "number": return p.number == null ? "" : String(p.number);
    case "checkbox": return p.checkbox ? "✓" : "";
    case "date": return (p.date && (p.date.start + (p.date.end ? " ← " + p.date.end : ""))) || "";
    case "email": return p.email || "";
    case "phone_number": return p.phone_number || "";
    case "url": return p.url || "";
    case "people": return (p.people || []).map((u) => u.name || "").join("، ");
    case "files": return (p.files || []).length ? `${p.files.length} ملف` : "";
    case "formula": { const f = p.formula || {}; return f.type === "string" ? (f.string || "") : f.type === "number" ? String(f.number == null ? "" : f.number) : f.type === "boolean" ? (f.boolean ? "✓" : "") : ((f.date && f.date.start) || ""); }
    case "created_time": return String(p.created_time || "").slice(0, 10);
    case "last_edited_time": return String(p.last_edited_time || "").slice(0, 10);
    case "relation": return (p.relation || []).length ? `${(p.relation || []).length} مرتبط` : "";
    default: return "";
  }
}

async function notionQuery(db, body) {
  const r = await fetch(`https://api.notion.com/v1/databases/${db}/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!r.ok) { const t = (await r.text()).slice(0, 200); throw new Error(`notion_query_${r.status}:${t}`); }
  return r.json();
}
// One reader for every Notion property flavour we touch — the WhatsApp
// database mixes rich_text/phone_number/select for what is logically "text".
function propAny(p) {
  if (!p) return "";
  if (p.type === "phone_number") return p.phone_number || "";
  if (p.type === "email") return p.email || "";
  if (p.type === "select") return (p.select && p.select.name) || "";
  if (p.type === "number") return p.number == null ? "" : String(p.number);
  if (p.type === "date") return (p.date && p.date.start) || "";
  if (p.type === "checkbox") return p.checkbox ? "yes" : "";
  const arr = p[p.type];
  return Array.isArray(arr) ? arr.map((t) => t.plain_text || "").join("") : "";
}

// One source-of-truth channel classifier: WHERE did this client come from?
// The same labels appear in Notion (Lead Source), the admin panel, the
// WhatsApp digest and the e-mail report — one vocabulary everywhere.
function channelOf({ ref, source, order, title }) {
  let r = String(ref || ""), s = String(source || ""), o = String(order || ""), t = String(title || "");
  // Older rows keep the reference only inside the title «… (BC-039919)».
  if (!r) { const m = t.match(/\(([A-Z]{2,4}-[A-Za-z0-9-]+)\)\s*$/); if (m) r = m[1]; }
  if (s === "WhatsApp" || r.startsWith("WA-")) return { key: "whatsapp", label: "واتساب", icon: "📱", color: "#128C7E" };
  if (s === "إدخال يدوي") return { key: "manual", label: "إدخال يدوي", icon: "📞", color: "#0F766E" };
  if (s === "B10X" || s === "Ask B10X" || r.startsWith("B10X")) return { key: "b10x", label: "B10X", icon: "🚀", color: "#9A3412" };
  if (r.startsWith("SP-") || /تسجيل مورّ?د/.test(t)) return { key: "supplier", label: "تسجيل مورّد", icon: "🏭", color: "#92400E" };
  if (r.startsWith("BPI-") || /طلب تقسيط/.test(t)) return { key: "installment", label: "طلب تقسيط", icon: "💳", color: "#BE185D" };
  if (r.startsWith("DL-")) return { key: "deal", label: "صفقة", icon: "🤝", color: "#166534" };
  if (r.startsWith("MM-")) return { key: "tourism", label: "سياحة أعمال", icon: "✈️", color: "#1D4ED8" };
  if (r.startsWith("BK-")) return { key: "consult", label: "حجز استشارة", icon: "📅", color: "#0E7490" };
  if (s === CONV_SOURCE || r.startsWith("WEB-")) return { key: "advisor", label: "مستشار الموقع", icon: "🤖", color: "#7C3AED" };
  if (s === TICKET_SOURCE || r.startsWith("BPT-")) return { key: "ticket", label: "تذكرة دعم", icon: "🎫", color: "#B45309" };
  if (o === "حجز استشارة" || s === "حجز استشارة" || r.startsWith("BC-")) return { key: "consult", label: "حجز استشارة", icon: "📅", color: "#0E7490" };
  if (s === "تحميل مجلة" || r.startsWith("MAG-")) return { key: "magazine", label: "تحميل مجلة", icon: "📰", color: "#64748B" };
  if (s === "مساحة عمل" || r.startsWith("BP-WS")) return { key: "workspace", label: "مساحة عمل", icon: "🏢", color: "#4338CA" };
  if (s === "شراء خدمة") return { key: "purchase", label: "شراء خدمة", icon: "🛒", color: "#0B1B5A" };
  if (/^(🛒|طلب\/شراء|طلب مدفوع)/.test(t) || r.startsWith("BPB-") || r.startsWith("BPW-") || r.startsWith("RFQ-")) return { key: "purchase", label: "شراء خدمة", icon: "🛒", color: "#0B1B5A" };
  if (r.startsWith("BP-") && o && o !== "محادثة موقع") return { key: "purchase", label: "شراء خدمة", icon: "🛒", color: "#0B1B5A" };
  return { key: "website", label: "نموذج الموقع", icon: "🌐", color: "#334155" };
}

// One row of «متابعات اليوم»: who, how to reach them, and the single next
// step — the owner asked to always know «ايش المطلوب عشان اتواصل مع العميل».
function followupRow(pg) {
  const pr = pg.properties || {};
  const notes = propAny(pr["Notes"]);
  const phone = (propAny(pr["Phone"]) || (notes.match(/الجوال:\s*([+\d][\d\s-]{6,})/) || [])[1] || "").trim();
  const email = (propAny(pr["Email"]) || (notes.match(/البريد:\s*([^\s·]+@[^\s·،]+)/) || [])[1] || "").trim();
  const stage = propAny(pr["Stage"]);
  const order = propAny(pr["حالة الطلب"]);
  const human = !!(pr["Human Required"] && pr["Human Required"].checkbox);
  let action = "تابع العميل واسأله عن قراره";
  if (order === "بانتظار الدفع") action = "ذكّره بالدفع وأرسل له رابط السداد";
  else if (order === "حجز استشارة" || stage === "Meeting") action = "أكّد معه موعد الاستشارة";
  else if (human) action = "يحتاج ردّك الآن — افتح المحادثة من BP Inbox";
  else if (stage === "Proposal Needed") action = "جهّز له عرض السعر وأرسله";
  else if (stage === "Proposal Sent" || stage === "Negotiation") action = "اسأله عن رأيه في العرض المرسل";
  else if (stage === "New" || stage === "مهتم") action = "تواصل أول: اتصال أو رسالة واتساب";
  const ref = propAny(pr["رقم المرجع"]);
  const title = (propAny(pr["Opportunity Name"]) || "عميل بلا اسم").slice(0, 120);
  return {
    id: pg.id,
    title,
    phone, email, stage, order,
    ref,
    due: propAny(pr["Next Follow Up"]),
    last: propAny(pr["Last Activity"]),
    created: String(pg.created_time || "").slice(0, 10),
    human, action,
    channel: channelOf({ ref, source: propAny(pr["Lead Source"]), order, title }),
    url: pg.url || "",
  };
}

// Everything that must not be forgotten today: due/overdue follow-ups, rows
// flagged for a human, and orders parked on «بانتظار الدفع». Won/Lost rows
// are closed — chasing them is noise.
async function collectFollowups(limit) {
  if (!NOTION_TOKEN) return [];
  const today = new Date().toISOString().slice(0, 10);
  const data = await notionQuery(CRM_DB, {
    page_size: Math.min(Math.max(Number(limit) || 60, 1), 100),
    filter: {
      and: [
        { or: [
          { property: "Next Follow Up", date: { on_or_before: today } },
          { property: "Human Required", checkbox: { equals: true } },
          { property: "حالة الطلب", select: { equals: "بانتظار الدفع" } },
        ] },
        { property: "Stage", select: { does_not_equal: "Won" } },
        { property: "Stage", select: { does_not_equal: "Lost" } },
      ],
    },
    sorts: [{ property: "Next Follow Up", direction: "ascending" }],
  });
  return (data.results || []).map(followupRow);
}

// The full live board: every recent pipeline row (most recently edited
// first), bucketed so the panel can lane them — «due» needs contact now,
// «followed» has a future follow-up booked, «fresh» is active with nothing
// scheduled, «done» is Won/Lost. The due-only digest keeps collectFollowups.
async function collectBoard(limit, cursor) {
  if (!NOTION_TOKEN) return { items: [], next: null };
  const today = new Date().toISOString().slice(0, 10);
  const q = {
    page_size: Math.min(Math.max(Number(limit) || 100, 1), 100),
    sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
  };
  if (cursor) q.start_cursor = String(cursor).slice(0, 200);
  const data = await notionQuery(CRM_DB, q);
  const items = (data.results || []).map((pg) => {
    const f = followupRow(pg);
    f.bucket = (f.stage === "Won" || f.stage === "Lost") ? "done"
      : (f.human || f.order === "بانتظار الدفع" || (f.due && f.due <= today)) ? "due"
      : f.due ? "followed"
      : "fresh";
    return f;
  });
  return { items, next: data.has_more ? data.next_cursor : null };
}

// Mirror fresh WhatsApp-qualification rows into the master pipeline, keyed by
// «رقم المرجع» = WA-<digits>. Create sets a next-day follow-up; update never
// clobbers a follow-up date the owner set by hand.
const WA_STAGE_OF = {
  "New Lead": "New", "Contacted": "مهتم", "Qualified": "Qualified",
  "Discovery Scheduled": "Meeting", "Discovery Complete": "Meeting",
  "Proposal Draft": "Proposal Needed", "Proposal Sent": "Proposal Sent",
  "Negotiation": "Negotiation", "Won": "Won", "Lost": "Lost", "Nurture": "مهتم",
};
async function syncWhatsappLeads() {
  if (!NOTION_TOKEN) return { synced: 0, skipped: 0 };
  const since = new Date(Date.now() - 3 * 864e5).toISOString();
  const today = new Date().toISOString().slice(0, 10);
  let synced = 0, skipped = 0;
  const freshLeads = [];
  const data = await notionQuery(WA_CRM_DB, {
    page_size: 50,
    filter: { timestamp: "last_edited_time", last_edited_time: { on_or_after: since } },
    sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
  });
  for (const pg of data.results || []) {
    const pr = pg.properties || {};
    const status = propAny(pr["Status"]);
    if (status === "Duplicate") { skipped++; continue; }
    const phone = (propAny(pr["WhatsApp Phone"]) || propAny(pr["WhatsApp"])).replace(/[^\d+]/g, "");
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8) { skipped++; continue; }
    const ref = ("WA-" + digits).slice(0, 60);
    const name = (propAny(pr["title"]) || "").replace(/^WhatsApp\s*-\s*/i, "").trim();
    const email = propAny(pr["Email"]).trim();
    const lines = [`قناة: واتساب · الجوال: ${phone}${email ? " · البريد: " + email : ""}`];
    const svc = propAny(pr["Service Required"]) || propAny(pr["Selected Service Path"]);
    if (svc) lines.push("الخدمة المطلوبة: " + svc);
    const nx = propAny(pr["Next Action"]);
    if (nx) lines.push("الإجراء التالي: " + nx);
    const lastMsg = propAny(pr["Last WhatsApp Message"]);
    if (lastMsg) lines.push("آخر رسالة: " + String(lastMsg).replace(/\s+/g, " ").slice(0, 300));
    const comp = propAny(pr["Company Name"]);
    if (comp) lines.push("الشركة: " + comp);
    const props = {
      "Opportunity Name": { title: [{ text: { content: `📱 واتساب — ${name || phone}`.slice(0, 200) } }] },
      "Lead Source": { select: { name: "WhatsApp" } },
      "Stage": { select: { name: WA_STAGE_OF[status] || "New" } },
      "Human Required": { checkbox: !!(pr["Human Required"] && pr["Human Required"].checkbox) },
      "Phone": { phone_number: phone.slice(0, 40) },
      "Notes": { rich_text: richChunks(lines.join("\n")) },
      "Last Activity": { date: { start: today } },
      "رقم المرجع": { rich_text: [{ text: { content: ref } }] },
    };
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) props["Email"] = { email: email.slice(0, 160) };
    try {
      const existing = await findConvPage(ref);
      // A brand-new WhatsApp contact needs a FIRST contact — today, not
      // tomorrow: due now + human-required puts them straight into
      // «متابعات اليوم» and the half-hour reminders.
      if (!existing) { props["Next Follow Up"] = { date: { start: plusDaysISO(0) } }; props["Human Required"] = { checkbox: true }; }
      const r = await fetch(existing ? `https://api.notion.com/v1/pages/${existing}` : "https://api.notion.com/v1/pages", {
        method: existing ? "PATCH" : "POST",
        headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
        body: JSON.stringify(existing ? { properties: props } : { parent: { database_id: CRM_DB }, properties: props }),
      });
      if (r.ok) { synced++; if (!existing) freshLeads.push({ name, phone, ref, svc, lastMsg }); }
      else { skipped++; console.error("wa sync error", r.status, (await r.text()).slice(0, 200)); }
    } catch (e) { skipped++; console.error("wa sync exception", String(e).slice(0, 150)); }
  }
  // A brand-new WhatsApp contact pings the owner the moment the sync sees it
  // — email + the live n8n WhatsApp hook (the same one tickets and
  // consultations use) — instead of waiting for tomorrow's digest.
  for (const f of freshLeads.slice(0, 6)) {
    const who = f.name || f.phone;
    try {
      fetch(process.env.OWNER_WA_WEBHOOK || "https://businesspartnerai.app.n8n.cloud/webhook/website-lead-notify", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "whatsapp-new", ref: f.ref, name: f.name, phone: f.phone,
          transcript: `📱 عميل واتساب جديد — ${who}\nالجوال: ${f.phone}${f.svc ? "\nالخدمة: " + f.svc : ""}${f.lastMsg ? "\nآخر رسالة: " + String(f.lastMsg).slice(0, 200) : ""}`,
          url: `${MKT_SITE_BASE}/admin`,
        }),
      }).catch(() => {});
      const html = `<div dir="rtl" style="font-family:Arial,sans-serif"><h2 style="color:#128C7E">📱 عميل واتساب جديد — ${esc(who)}</h2><p><b>الجوال:</b> <a href="https://wa.me/${esc(f.phone.replace(/\D/g, ""))}" style="direction:ltr;display:inline-block">${esc(f.phone)}</a></p>${f.svc ? `<p><b>الخدمة المطلوبة:</b> ${esc(f.svc)}</p>` : ""}${f.lastMsg ? `<p><b>آخر رسالة:</b> ${esc(String(f.lastMsg).slice(0, 300))}</p>` : ""}<p><b>المرجع:</b> ${esc(f.ref)} — العميل الآن في «متابعات اليوم» بلوحة التحكم.</p></div>`;
      await sendEmail(TEAM_EMAIL, `📱 عميل واتساب جديد — ${who}`, html);
      if (OWNER_EMAIL !== TEAM_EMAIL) await sendEmail(OWNER_EMAIL, `📱 عميل واتساب جديد — ${who}`, html);
    } catch (e) { console.error("wa fresh notify failed", String(e).slice(0, 120)); }
  }
  return { synced, skipped, fresh: freshLeads.length };
}

// ---- Website advisor ("باهر") conversations ----
// Each browser session is one CRM page (رقم المرجع = "WEB-<sid>") so the /monitor
// inbox and the CRM show the whole thread, upserted as it grows. Notes holds a
// meta line + the labelled transcript ("🧑 الزائر: …" / "🤖 باهر: …") which the
// monitor feed (GET ?action=advisor-inbox) parses straight back into messages.
const CONV_SOURCE = "مستشار الموقع";
const TICKET_SOURCE = "تذكرة دعم";
function convNotes({ phone, email, name, messages }) {
  const meta = `قناة: المستشار (الموقع)${name ? " · " + name : ""}${phone ? " · الجوال: " + phone : ""}${email ? " · البريد: " + email : ""}`;
  const lines = messages.map((m) => (m.role === "assistant" ? "🤖 باهر: " : "🧑 الزائر: ") + String(m.content || "").replace(/\s+/g, " ").trim());
  return (meta + "\n" + lines.join("\n")).slice(-6000);
}
// Notion caps a single rich_text object at 2000 chars — split long transcripts.
function richChunks(text) {
  const out = []; let s = String(text || "");
  while (s.length) { out.push({ text: { content: s.slice(0, 1900) } }); s = s.slice(1900); }
  return out.length ? out : [{ text: { content: "" } }];
}
async function findConvPage(ref) {
  const r = await fetch(`https://api.notion.com/v1/databases/${CRM_DB}/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
    body: JSON.stringify({ page_size: 1, filter: { property: "رقم المرجع", rich_text: { equals: ref } } }),
  });
  if (!r.ok) return null;
  const data = await r.json();
  return (data.results && data.results[0] && data.results[0].id) || null;
}
async function upsertConversation({ sid, messages, phone, email, name, hot }) {
  if (!NOTION_TOKEN || !sid) return;
  const ref = ("WEB-" + sid).slice(0, 60);
  const today = new Date().toISOString().slice(0, 10);
  const firstQ = (messages.find((m) => m.role === "user") || {}).content || "محادثة موقع";
  const title = `💬 محادثة موقع — ${String(firstQ).replace(/\s+/g, " ").trim().slice(0, 60)}`;
  const props = {
    "Opportunity Name": { title: [{ text: { content: title.slice(0, 200) } }] },
    "Lead Source": { select: { name: CONV_SOURCE } },
    "Stage": { select: { name: hot ? "مهتم" : "New" } },
    "Human Required": { checkbox: !!hot },
    "Notes": { rich_text: richChunks(convNotes({ phone, email, name, messages })) },
    "Last Activity": { date: { start: today } },
    "رقم المرجع": { rich_text: [{ text: { content: ref } }] },
    "حالة الطلب": { select: { name: "محادثة موقع" } },
  };
  try {
    const existing = await findConvPage(ref);
    const url = existing ? `https://api.notion.com/v1/pages/${existing}` : "https://api.notion.com/v1/pages";
    const body = existing ? { properties: props } : { parent: { database_id: CRM_DB }, properties: props };
    const r = await fetch(url, {
      method: existing ? "PATCH" : "POST",
      headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) console.error("conv upsert error", r.status, (await r.text()).slice(0, 200));
  } catch (e) { console.error("conv upsert exception", String(e).slice(0, 150)); }
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

// attachments: [{ filename, content }] where content is base64 — Resend's own
// attachment shape, passed straight through.
async function sendEmail(to, subject, html, attachments) {
  if (!RESEND_API_KEY) return { ok: false, error: "email_not_configured" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, ...(attachments && attachments.length ? { attachments } : {}) }),
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

// The gateway is enabled inside Daftra (PayTabs / PayFort), so Daftra's own
// invoice page is the payment page. Linking to it means the payment lands
// against the invoice in the books — no reconciliation step invented here.
// The PDF stays attached: the document is the document, the link is to pay.
const payButton = (url) => url
  ? `<p style="margin:18px 0"><a href="${esc(url)}" style="background:#0B1B5A;color:#fff;padding:12px 26px;border-radius:10px;text-decoration:none;font-weight:bold;display:inline-block">💳 ادفع الآن</a></p>
     <p style="color:#94a3b8;font-size:12px">أو حوّل بنكياً على الحساب أدناه.</p>`
  : "";

// ---- Shared Services: subscribe → owner approval → emailed access code → unlock ----
const OTP_SECRET = process.env.OTP_SECRET || "";
// إشعارات المالك تذهب لإيميل الشركة افتراضياً (لا للإيميل الشخصي).
// عند تساويه مع TEAM_EMAIL تصبح النسخ المكررة أدناه no-op تلقائياً.
const OWNER_EMAIL = (process.env.BP_OWNER_EMAIL || "business@businesspartner.sa").toLowerCase();
const SITE_BASE = process.env.SITE_BASE || "https://businesspartner.sa";
// اسم المستفيد والآيبان من مصدر واحد (api/_identity.js ← site/data/site.json).
// كان الاسم مكتوباً هنا بيد ومخالفاً لسجل البنك، وهذا البريد هو الذي يطلب
// من العميل أن يحوّل — فالخطأ فيه يُرفض عند الصرّاف لا عندنا.
const SS_BANK = BANK;
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

/* ---------- /admin panel: owner-gated management (status, approvals, content) ---------- */
// Every panel action below is gated by PANEL_KEYS — the same key that unlocks
// the leads list and the /admin page itself.
const PANEL_STATUSES = new Set(["قيد المراجعة", "بانتظار الدفع", "مؤكد - قيد التنفيذ", "مكتمل", "ملغي"]);
// Content editing commits straight to GitHub; Vercel then rebuilds the site,
// so a saved change is live in ~2 minutes. Needs a repo-write token in env.
const CONTENT_REPO = process.env.CONTENT_REPO || "businessKSA/business-partner-sa";
// The live site deploys from the production branch, so panel edits are read
// from and committed to it (a save is live in ~2 minutes). master is kept in
// sync with a best-effort second commit so the default branch doesn't drift.
const CONTENT_BRANCH = process.env.CONTENT_BRANCH || "claude/bpic-marketing-site-jvrnga";
const CONTENT_SYNC_BRANCH = process.env.CONTENT_SYNC_BRANCH || "master";
const GH_TOKEN = envFrom(["GITHUB_TOKEN", "GH_TOKEN", "GITHUB_PAT", "CONTENT_GITHUB_TOKEN"]);
const CONTENT_FILES = {
  "services": "site/data/services.json",
  "opportunities": "site/data/opportunities.json",
  "categories": "site/data/categories.json",
  "site": "site/data/site.json",
  "nav": "site/data/nav.json",
  "footer": "site/data/footer.json",
  "ecosystem": "site/data/ecosystem.json",
  "service-i18n": "site/data/service-i18n.json",
};

// Flip a CRM lead's حالة الطلب by its BP-xxxxxx reference.
// Archive (Notion "trash") — the page leaves every query but stays recoverable.
async function archiveNotionPage(pageId) {
  const r = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
    body: JSON.stringify({ archived: true }),
  });
  if (!r.ok) throw new Error("archive_failed");
}

async function setLeadStatus(ref, status) {
  if (!NOTION_TOKEN) throw new Error("notion_not_configured");
  const r = await fetch(`https://api.notion.com/v1/databases/${CRM_DB}/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
    body: JSON.stringify({ page_size: 1, filter: { property: "رقم المرجع", rich_text: { equals: ref } } }),
  });
  if (!r.ok) throw new Error("notion_failed");
  const pg = ((await r.json()).results || [])[0];
  if (!pg) throw new Error("ref_not_found");
  const u = await fetch(`https://api.notion.com/v1/pages/${pg.id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
    body: JSON.stringify({ properties: {
      "حالة الطلب": { select: { name: status } },
      "Last Activity": { date: { start: new Date().toISOString().slice(0, 10) } },
      ...(STAGE_OF[status] ? { "Stage": { select: { name: STAGE_OF[status] } } } : {}),
      // A closed row needs no human and no next date; an open one gets a date
      // so it surfaces in a follow-up view instead of waiting to be remembered.
      ...(CLOSED.has(status)
        ? { "Human Required": { checkbox: false }, "Next Follow Up": { date: null } }
        : (STAGE_OF[status] ? { "Next Follow Up": { date: { start: plusDaysISO(2) } } } : {})),
    } }),
  });
  if (!u.ok) { console.error("panel status error", u.status, (await u.text()).slice(0, 300)); throw new Error("notion_failed"); }
}

// Fetch one CRM row by its BP-xxxxxx reference — the whole order as the owner
// needs to see it: amount, contact, receipt files and the notes trail.
async function findLeadByRef(ref) {
  if (!NOTION_TOKEN) throw new Error("notion_not_configured");
  const r = await fetch(`https://api.notion.com/v1/databases/${CRM_DB}/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
    body: JSON.stringify({ page_size: 1, filter: { property: "رقم المرجع", rich_text: { equals: ref } } }),
  });
  if (!r.ok) throw new Error("notion_failed");
  return ((await r.json()).results || [])[0] || null;
}

// The bits of a CRM row the note flow needs: who to tell, and the current state.
function leadContact(pg) {
  const p = pg.properties || {};
  const txt = (arr) => (arr || []).map((t) => t.plain_text).join("");
  const notes = txt(p["Notes"] && p["Notes"].rich_text);
  const emailM = notes.match(/البريد:\s*([^\s·]+@[^\s·]+)/);
  return {
    ref: txt(p["رقم المرجع"] && p["رقم المرجع"].rich_text).trim(),
    email: emailM ? emailM[1] : "",
    status: (p["حالة الطلب"] && p["حالة الطلب"].select && p["حالة الطلب"].select.name) || "",
  };
}

// Append a line to the row's Notes so the note the client received is part of
// the order's record, not only in their inbox.
async function appendLeadNote(pg, line) {
  const p = pg.properties || {};
  const existing = ((p["Notes"] && p["Notes"].rich_text) || []).map((t) => t.plain_text).join("");
  const merged = (existing ? existing + " · " : "") + line;
  const r = await fetch(`https://api.notion.com/v1/pages/${pg.id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
    body: JSON.stringify({ properties: {
      "Notes": { rich_text: [{ text: { content: merged.slice(-1900) } }] },
      "Last Activity": { date: { start: new Date().toISOString().slice(0, 10) } },
    } }),
  });
  if (!r.ok) { console.error("append note error", r.status, (await r.text()).slice(0, 200)); throw new Error("notion_failed"); }
}

const GH_HEADERS = () => ({ Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "bp-admin-panel", "content-type": "application/json" });
// Returns null when the file doesn't exist on that branch yet (a newly
// data-driven file that hasn't reached the deploy branch) — a subsequent
// ghPutFile without a sha then creates it.
async function ghGetFile(filePath, branch) {
  const r = await fetch(`https://api.github.com/repos/${CONTENT_REPO}/contents/${filePath}?ref=${encodeURIComponent(branch || CONTENT_BRANCH)}`, { headers: GH_HEADERS() });
  if (r.status === 404) return null;
  if (!r.ok) { console.error("gh get error", r.status, (await r.text()).slice(0, 300)); throw new Error("github_failed"); }
  const d = await r.json();
  return { sha: d.sha, content: Buffer.from(d.content || "", "base64").toString("utf8") };
}
async function ghPutFile(filePath, content, sha, message, branch) {
  const body = { message, branch: branch || CONTENT_BRANCH, content: Buffer.from(content, "utf8").toString("base64") };
  if (sha) body.sha = sha;
  const r = await fetch(`https://api.github.com/repos/${CONTENT_REPO}/contents/${filePath}`, {
    method: "PUT",
    headers: GH_HEADERS(),
    body: JSON.stringify(body),
  });
  if (!r.ok) { console.error("gh put error", r.status, (await r.text()).slice(0, 300)); throw new Error("github_failed"); }
  const d = await r.json();
  return d.commit && d.commit.sha;
}

// The three approval flows, shared by the emailed sealed links (GET branches
// below) and the /admin panel's activate action. Each returns the client code
// (null = activation failed) after emailing it to the client.
async function approveShared({ email, name, phone, ref }) {
  const code = ssCode(email);
  const codeHtml = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;text-align:right" dir="rtl"><h2 style="color:#0B1B5A">تم تفعيل خدمتك 🎉</h2><p>كود الوصول الخاص بك للخدمات المشتركة:</p><p style="font-size:26px;font-weight:bold;letter-spacing:4px;color:#0B1B5A">${esc(code)}</p><p><a href="${SITE_BASE}/shared-services" style="background:#12b3ad;color:#04211f;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:bold">افتح الخدمة</a> — أدخل بريدك والكود.</p></div>`;
  await sendEmail(email, `كود الوصول — الخدمات المشتركة (${code})`, codeHtml);
  await crmLead({ title: `تفعيل خدمات مشتركة — ${name || email}`, phone: phone || "", email, notes: `معتمد ومفعّل · ${ref}`, ref });
  return code;
}
// Generic activation for anything the owner sells that has no gated portal of
// its own (the 116 catalog services, workspace bookings, magazine listings…).
// There is no access code to hand out here, so this does the two things that
// are actually real: it emails the client a confirmation that the paid request
// was approved and execution has started, and it flips the CRM status.
async function approveService({ service, company, email, phone, ref, note }) {
  const svc = String(service || "").trim() || "طلبك";
  const refLine = ref ? `<p style="color:#475569">رقم المرجع: <b style="direction:ltr;display:inline-block">${esc(ref)}</b></p>` : "";
  const coLine = company ? `<p style="color:#475569">المنشأة: <b>${esc(company)}</b></p>` : "";
  const noteLine = note ? `<p style="color:#475569">${esc(note)}</p>` : "";
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;text-align:right" dir="rtl"><h2 style="color:#0B1B5A">تم اعتماد طلبك وبدأ التنفيذ ✅</h2><p>الخدمة: <b>${esc(svc)}</b></p>${coLine}${refLine}${noteLine}<p style="color:#475569;line-height:1.9">فريق بيزنس بارتنر بدأ العمل على طلبك، وسنوافيك بالتحديثات أولاً بأول على هذا البريد. لأي استفسار رد على هذه الرسالة مباشرة.</p><p><a href="${SITE_BASE}/ar/contact" style="background:#0B1B5A;color:#fff;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:bold">تواصل معنا</a></p></div>`;
  const sent = await sendEmail(email, `تم اعتماد طلبك — ${svc}${ref ? ` (${ref})` : ""}`, html);
  if (!sent || !sent.ok) return null;
  // No portal code exists for these — the sentinel just tells the caller the
  // confirmation went out, and /admin words the success line accordingly.
  return "CONFIRMED";
}
async function approveCompliance({ company, email, phone }) {
  const code = await activateComplianceSubscription({ company, email, phone });
  if (!code) return null;
  const codeHtml = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;text-align:right" dir="rtl"><h2 style="color:#0B1B5A">تم تفعيل اشتراكك في وكيل الامتثال 🎉</h2><p>المنشأة: <b>${esc(company)}</b></p><p>رمز الدخول لبوابة وكيل الامتثال:</p><p style="font-size:26px;font-weight:bold;letter-spacing:4px;color:#0B1B5A">${esc(code)}</p><p><a href="${COMPLIANCE_PORTAL_URL}" style="background:#0B1B5A;color:#fff;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:bold">افتح بوابة وكيل الامتثال</a> — أدخل بريدك (${esc(email)}) والرمز أعلاه.</p></div>`;
  await sendEmail(email, `تم تفعيل اشتراكك — وكيل الامتثال (${esc(company)})`, codeHtml);
  return code;
}
async function approveEmployer({ company, email, phone, plan }) {
  const code = await activateEmployerSubscription({ company, email, phone, planKey: plan });
  if (!code) return null;
  const planAr = EMP_PLAN_AR[plan] || "";
  const codeHtml = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;text-align:right" dir="rtl"><h2 style="color:#0B1B5A">تم تفعيل اشتراكك في منصة التوظيف 🎉</h2><p>الشركة: <b>${esc(company)}</b>${planAr ? ` — الباقة: <b>${esc(planAr)}</b>` : ""}</p><p>رمز الوصول للوحة التوظيف:</p><p style="font-size:26px;font-weight:bold;letter-spacing:4px;color:#0B1B5A">${esc(code)}</p><p><a href="${EMP_DASHBOARD_URL}" style="background:#0B1B5A;color:#fff;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:bold">افتح لوحة التوظيف</a> — أدخل الرمز أعلاه.</p></div>`;
  await sendEmail(email, `تم تفعيل اشتراكك — منصة التوظيف (${esc(company)})`, codeHtml);
  return code;
}

/* ---------- P2: operational orders + wallet (Supabase) ---------- */
// Catalog prices are read from the deploy branch's public catalog.json on
// GitHub raw (the repo is public; this is published content, not a secret).
// Cached per warm instance for 10 minutes.
const RAW_CATALOG_URL = process.env.CATALOG_URL ||
  `https://raw.githubusercontent.com/${CONTENT_REPO}/${CONTENT_BRANCH}/site/assets/data/catalog.json`;
let _catCache = null, _catAt = 0, _svcIds = null;
// Cart item ids carry a kind prefix ("svc-bp-chamber-01", "pkg-silver") while
// the catalog price map is keyed by the bare service code / package key.
// Strip the known prefixes so server-side re-pricing actually finds the row.
function catalogKey(id) {
  const k = String(id || "").toLowerCase();
  if (k.startsWith("svc-")) return k.slice(4);
  if (k.startsWith("pkg-")) return k.slice(4);
  return k;
}
async function catalogPrices() {
  if (_catCache && Date.now() - _catAt < 10 * 60 * 1000) return _catCache;
  const r = await fetch(RAW_CATALOG_URL);
  if (!r.ok) throw new Error("catalog_fetch_failed");
  const c = await r.json();
  const map = {};
  for (const s of c.services || []) {
    if (!s.code) continue;
    map[String(s.code).toLowerCase()] = { amount: Number(s.amount) || 0, name: s.nameAr || s.nameEn || s.code };
  }
  for (const p of c.packages || []) {
    // The cart names a package by its key ("pkg-silver") while the invoice
    // names it by code (BP-PKG-LAUNCH) — index both so either resolves.
    const entry = { amount: Number(p.amount) || 0, name: p.nameAr || p.nameEn || p.code || p.key };
    for (const k of [p.code, p.key].map((x) => String(x || "").toLowerCase()).filter(Boolean)) {
      if (!map[k]) map[k] = entry;
    }
  }
  _catCache = map; _catAt = Date.now();
  _catDiscounts = Array.isArray(c.discounts) ? c.discounts : [];
  return map;
}
// The whole catalog (not just the price map) — the in-portal store lists
// services from it, so the client never has to leave the portal to browse.
let _catFull = null, _catFullAt = 0;
async function catalogFull() {
  if (_catFull && Date.now() - _catFullAt < 10 * 60 * 1000) return _catFull;
  const r = await fetch(RAW_CATALOG_URL);
  if (!r.ok) throw new Error("catalog_fetch_failed");
  _catFull = await r.json();
  _catFullAt = Date.now();
  return _catFull;
}
// Published discount codes — validated server-side so a typed code can only
// ever mean what the catalog says it means.
let _catDiscounts = [];
function catalogDiscountSync(code) {
  const c = String(code || "").trim().toUpperCase();
  if (!c) return null;
  const hit = _catDiscounts.find((d) => String(d.code || "").toUpperCase() === c);
  if (!hit) return null;
  if (hit.expires && new Date(hit.expires + "T23:59:59Z") < new Date()) return null;
  const percent = Number(hit.percent) > 0 ? Math.min(90, Number(hit.percent)) : 0;
  const amount = Number(hit.amount) > 0 ? Number(hit.amount) : 0;
  if (!percent && !amount) return null;
  const services = Array.isArray(hit.services)
    ? hit.services.map((s) => catalogKey(String(s).toLowerCase())).filter(Boolean).slice(0, 60)
    : [];
  return { code: c, percent, amount, services };
}
// Sync the catalog read-model into the services table (once per warm
// instance) and return code(lower) → row id for order_items FKs.
async function ensureServiceIds(map) {
  if (_svcIds) return _svcIds;
  const rows = Object.entries(map).map(([code, v]) => ({ code, name_ar: v.name, one_time_fee: v.amount, active: true }));
  if (rows.length) {
    await sb("services?on_conflict=code", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: rows });
  }
  const got = await sb("services?select=id,code&limit=2000");
  const ids = {};
  for (const r of got || []) ids[String(r.code).toLowerCase()] = r.id;
  _svcIds = ids;
  return ids;
}
// Dual-write a website order into the operational DB with SERVER-side
// pricing (client totals are recorded for comparison only, never trusted).
async function recordOrderInDb(req, b, ref) {
  if (!DB_ON) return;
  const sess = await getSession(req).catch(() => null);
  const orgId = sess && sess.organization && sess.organization.id;
  if (!orgId) return; // guest checkout: legacy flow only until sessions are universal
  const prices = await catalogPrices().catch(() => null);
  const ids = prices ? await ensureServiceIds(prices).catch(() => null) : null;
  const items = Array.isArray(b.itemsData) ? b.itemsData.slice(0, 40) : [];
  let bp = 0; const itemRows = [];
  for (const it of items) {
    const key = catalogKey(String(it.id || "").toLowerCase());
    const cat = prices && prices[key];
    const unit = cat ? cat.amount : 0;
    const qty = Math.max(1, Math.min(99, Number(it.qty) || 1));
    bp += unit * qty;
    itemRows.push({ key, qty, unit, line: unit * qty });
  }
  const vat = Math.round(bp * 0.15 * 100) / 100;
  const total = Math.round((bp + vat) * 100) / 100;
  const orders = await sb("orders", {
    method: "POST",
    body: [{
      ref,
      organization_id: orgId,
      created_by: sess.user && sess.user.id,
      status: "payment_verification",
      bp_fees: bp, gov_fees: 0, vat, total,
    }],
  });
  const orderId = orders[0].id;
  const oi = itemRows
    .filter((r) => ids && ids[r.key])
    .map((r) => ({ order_id: orderId, service_id: ids[r.key], quantity: r.qty, unit_price: r.unit, line_total: r.line }));
  if (oi.length) await sb("order_items", { method: "POST", prefer: "return=minimal", body: oi });
  const clientTotal = Number(b.total) || 0;
  await audit({
    organization_id: orgId,
    actor_user_id: sess.user && sess.user.id,
    action: "order.created",
    entity_type: "order", entity_id: orderId,
    after: { ref, server_total: total, client_total: clientTotal, mismatch: Math.abs(clientTotal - total) > 1 },
  });
  await notify({
    organization_id: orgId,
    event: "order_created", channel: "inapp",
    title: `تم إنشاء طلبك ${ref} — بانتظار التحقق من الدفع`,
    idempotency_key: `order_created:${ref}`,
  });
}

// ---- جسر لوحة العروض: الفاتورة الضريبية تصدر من هنا وحدها ----
//
// لوحة العروض (bp-quotes) تُصدر مطالبات سداد بترقيمها الخاص، والفاتورة
// الضريبية المعتمدة تصدر من الدفترة. لو أصدرت اللوحة فواتيرها في الدفترة
// بشيفرة موازية لصار للمنشأة تسلسلان لأرقام الفواتير — وهو ما لا تقبله هيئة
// الزكاة والضريبة. فالنقطة هنا تنادي الشيفرة المجرَّبة نفسها التي ينادي بها
// الموقع منذ شهور: مصدر واحد، وتسلسل واحد.
//
// لا تُرسل بريداً: اللوحة لها قوالبها ومُرسِلها، وإرسالان يعنيان رسالتين
// للعميل عن فاتورة واحدة.
const PANEL_BRIDGE_TOKEN = process.env.PANEL_BRIDGE_TOKEN || "";
// عنوان لوحة العروض — للاتجاه المعاكس: الموقع يسألها عن عروض العميل وعقوده.
//
// له افتراضٌ لأن عنوانها ليس سرّاً ولا مجهولاً: هو مكتوب في vercel.json
// تمريرةً للكتالوج، وفي لوحة التحكم رابطاً ظاهراً. وحين كان بلا افتراض،
// قالت صفحة الحساب لصاحبها «هذا القسم غير مربوط» وكل شيء عنده مضبوط —
// السرّ المشترك موضوع، والجسر يعمل في اتجاهه الآخر — إلا سطرٌ في Vercel
// لم يُكتب. فمتغيّر بيئة لقيمةٍ واحدة معروفة يمنع التشغيل ولا يحمي شيئاً.
//
// والمتغيّر يبقى ليغلب الافتراض في بيئة تجربة أو عند تغيّر العنوان.
// من خادمٍ إلى خادم يُنادى نطاق Vercel مباشرةً لا نطاق الموقع: نداء الموقع
// لنفسه على /quotes يمرّ بحافته ثم يعود إلى اللوحة — قفزة بلا فائدة. والجذر
// /quotes جزء من عنوان اللوحة على أي نطاق (basePath)، فيُذكر هنا.
const PANEL_URL = (function () {
  // اللوحة تحت /quotes. أي قيمة قديمة بلا الجذر تُصحَّح هنا كي لا
  // يسقط الجسر لو بقي المتغيّر في إعدادات النشر على عنوان ما قبل التوحيد.
  const raw = (process.env.QUOTES_PANEL_URL || "https://bp-quotes-three.vercel.app/quotes")
    .trim()
    .replace(/\/+$/, "");
  return raw.endsWith("/quotes") ? raw : raw + "/quotes";
})();

function bridgeAuthorized(req) {
  if (!PANEL_BRIDGE_TOKEN) return false;
  const given = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (given.length !== PANEL_BRIDGE_TOKEN.length) return false;
  let diff = 0;
  for (let i = 0; i < PANEL_BRIDGE_TOKEN.length; i++) diff |= given.charCodeAt(i) ^ PANEL_BRIDGE_TOKEN.charCodeAt(i);
  return diff === 0;
}

/* ---- قراءة عرض مورد للوحة العروض -------------------------------------
 * اللوحة تحتاج أن تقرأ ملف عرض المورد (PDF أو صورة) وتستخرج بنوده. ومفاتيح
 * نماذج الرؤية معرَّفة هنا وحدها منذ شهور — Gemini ثم Anthropic ثم OpenAI —
 * فنسخها إلى مشروع ثانٍ يعني مفتاحين لكل مزوّد ونسختين تتفارقان.
 *
 * لا يُخزَّن هنا شيء: البايتات تُقرأ وتُعاد البنود وتُهمل. والحفظ في اللوحة
 * حيث الملف أصلاً.
 */
async function handleSupplierQuoteRead(req, res) {
  const send = (code, obj) => { res.statusCode = code; return res.end(JSON.stringify(obj)); };
  if (req.method !== "POST") return send(405, { ok: false, error: "method_not_allowed" });
  if (!bridgeAuthorized(req)) return send(401, { ok: false, error: "unauthorized" });

  const b = await readBody(req);
  const base64 = String(b.base64 || "");
  const mime = String(b.mime || "");
  if (!base64) return send(400, { ok: false, error: "no_file" });
  if (!DOC_MIME_OK.test(mime)) return send(400, { ok: false, error: "bad_type" });

  const prompt = `أنت تقرأ عرض سعر من مورد سعودي وتستخرج بنوده كما هي.

استخرج ما يظهر فعلاً في المستند فقط. لا تخمّن ولا تُكمل ناقصاً.

أعِد JSON فقط بلا شرح وبلا علامات تنسيق، بهذا الشكل:
{
  "currency": "SAR",
  "vatIncluded": true أو false — هل الأسعار الظاهرة شاملة ضريبة القيمة المضافة,
  "total": الإجمالي كما يظهر رقماً,
  "lines": [
    { "nameAr": "اسم البند", "descAr": "وصفه إن وُجد", "qty": الكمية رقماً, "unitAr": "الوحدة", "unitPrice": سعر الوحدة رقماً }
  ]
}

قواعد مهمة:
- الأسعار أرقام بلا فواصل ولا رمز عملة.
- إن لم تظهر كمية فاجعلها 1.
- لا تُدرج في أسماء البنود ولا أوصافها: اسم المورد، أرقام سجله أو ترخيصه أو
  رقمه الضريبي، بياناته البنكية، ولا شروط ضمانه — نحن نستخرج ما بيع وكم، لا
  من باعه ولا بأي شروط.`;

  const out = await readDocumentRaw(base64, mime, prompt, 3000);
  if (!out.ok) return send(502, { ok: false, error: out.error });

  let parsed = null;
  try {
    const t = String(out.data).replace(/^```(json)?|```$/gm, "").trim();
    parsed = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
  } catch {
    // النص الخام يُعاد حتى حين يتعذّر تفسيره: مراجع بشري يقرؤه أفضل من لا شيء.
    return send(200, { ok: true, provider: out.provider, raw: String(out.data).slice(0, 8000), parsed: null });
  }
  return send(200, { ok: true, provider: out.provider, raw: String(out.data).slice(0, 8000), parsed });
}

/* ---- قاعدة موردي نوشن للوحة العروض -----------------------------------
 * اللوحة توجّه طلبات عروض الأسعار إلى موردين مصنَّفين، وقاعدتهم في نوشن.
 * والمفتاح هنا وحده، فالقراءة من هنا: مفتاح واحد يُدوَّر، لا اثنان.
 *
 * الاستخراج بالنوع لا بالاسم: قواعد الموردين في نوشن أكثر من واحدة وأسماء
 * أعمدتها تختلف — «نوع المورد» في قاعدة العقار، و«التصنيف» في غيرها. فما
 * يُعتمد هو نوع العمود: العنوان اسمٌ، وحقل البريد بريدٌ، والقائمة المتعددة
 * تصنيف. وتسميةٌ تتغيّر لا تكسر المزامنة.
 *
 * ولا تُترجم القيم هنا: العربية كما كتبها صاحبها تعبر إلى اللوحة، وهي التي
 * تعرف أكوادها فتربطها. ومن ترجم في الطرفين اختلفت ترجمتاه.
 */
const NOTION_SUPPLIER_ROUTE_DB = process.env.NOTION_SOURCING_SUPPLIERS_DB || "";

function notionPropOf(props, types, nameHints = []) {
  const entries = Object.entries(props || {});
  for (const hint of nameHints) {
    const hit = entries.find(([k, v]) => k.includes(hint) && types.includes(v?.type));
    if (hit) return hit[1];
  }
  const any = entries.find(([, v]) => types.includes(v?.type));
  return any ? any[1] : null;
}

const notionPlain = (p) => {
  if (!p) return "";
  if (p.type === "title") return (p.title || []).map((t) => t.plain_text).join("").trim();
  if (p.type === "rich_text") return (p.rich_text || []).map((t) => t.plain_text).join("").trim();
  if (p.type === "email") return String(p.email || "").trim();
  if (p.type === "phone_number") return String(p.phone_number || "").trim();
  if (p.type === "select") return String(p.select?.name || "").trim();
  if (p.type === "status") return String(p.status?.name || "").trim();
  return "";
};

async function handleNotionSuppliers(req, res) {
  const send = (code, obj) => { res.statusCode = code; return res.end(JSON.stringify(obj)); };
  if (req.method !== "POST") return send(405, { ok: false, error: "method_not_allowed" });
  if (!bridgeAuthorized(req)) return send(401, { ok: false, error: "unauthorized" });
  if (!NOTION_TOKEN) return send(503, { ok: false, error: "notion_not_configured" });

  const b = await readBody(req);
  const db = String(b.databaseId || NOTION_SUPPLIER_ROUTE_DB || "").replace(/-/g, "").trim();
  if (!/^[0-9a-f]{32}$/i.test(db)) return send(400, { ok: false, error: "bad_database_id" });

  const rows = [];
  let cursor;
  // نوشن يعيد مئةً في الصفحة، والقاعدة قد تفوقها. وخمس صفحات سقفٌ يمنع
  // نداءً لا ينتهي إن دار المؤشّر، ويكفي خمسمئة مورد.
  for (let page = 0; page < 5; page++) {
    const r = await fetch(`https://api.notion.com/v1/databases/${db}/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
      body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
    });
    if (!r.ok) return send(502, { ok: false, error: `notion_${r.status}`, detail: (await r.text()).slice(0, 300) });
    const data = await r.json();
    for (const pg of data.results || []) {
      const props = pg.properties || {};
      const name = notionPlain(notionPropOf(props, ["title"]));
      if (!name) continue;
      const multi = notionPropOf(props, ["multi_select"], ["نوع المورد", "التصنيف", "الفئة", "Category", "Type"]);
      rows.push({
        notionPageId: String(pg.id || "").replace(/-/g, ""),
        nameAr: name,
        email: notionPlain(notionPropOf(props, ["email"], ["البريد", "Email"])).toLowerCase(),
        phone: notionPlain(notionPropOf(props, ["phone_number"], ["الجوال", "الهاتف", "Phone"])),
        city: notionPlain(notionPropOf(props, ["select"], ["المدينة", "City"])),
        priority: notionPlain(notionPropOf(props, ["select"], ["الأولوية", "Priority"])),
        // القيم كما هي بالعربية — اللوحة تربطها بأكوادها.
        types: (multi?.multi_select || []).map((o) => String(o.name || "").trim()).filter(Boolean),
        notes: notionPlain(notionPropOf(props, ["rich_text"], ["ملاحظات", "الأحياء", "Notes"])),
      });
    }
    if (!data.has_more || !data.next_cursor) break;
    cursor = data.next_cursor;
  }
  return send(200, { ok: true, database: db, count: rows.length, suppliers: rows });
}

async function handleDaftraInvoice(req, res) {
  const send = (code, obj) => { res.statusCode = code; return res.end(JSON.stringify(obj)); };
  if (req.method !== "POST") return send(405, { ok: false, error: "method_not_allowed" });
  if (!bridgeAuthorized(req)) return send(401, { ok: false, error: "unauthorized" });
  if (!daftraConfigured()) return send(503, { ok: false, error: "daftra_not_configured" });

  const b = await readBody(req);
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 60)
    .map((it) => ({
      name: String(it.name || "").slice(0, 140),
      quantity: Math.max(1, Math.min(999, Number(it.quantity) || 1)),
      unitPrice: Math.round(Number(it.unitPrice || 0) * 100) / 100,
    }))
    .filter((it) => it.name && it.unitPrice > 0);
  if (!items.length) return send(400, { ok: false, error: "no_priced_items" });

  const who = {
    name: String(b.buyer?.name || "").slice(0, 200),
    email: String(b.buyer?.email || "").toLowerCase(),
    phone: String(b.buyer?.phone || "").slice(0, 20),
    city: String(b.buyer?.city || "").slice(0, 60),
    taxNumber: String(b.buyer?.taxNumber || "").replace(/\D/g, ""),
    address: b.buyer?.address || null,
    isCompany: !!b.buyer?.isCompany,
    contact: String(b.buyer?.contact || "").slice(0, 120),
  };
  if (!who.name || !isEmail(who.email)) return send(400, { ok: false, error: "missing_buyer" });

  // المبلغ المحصَّل يُقارَن بمجموع البنود قبل الإصدار: فاتورة لا تطابق ما
  // دُفع فعلاً أسوأ من غياب الفاتورة. التسامح ريال واحد لفروق التقريب.
  const rate = Number(daftraVatRate()) || 15;
  const net = items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
  const expected = Math.round(net * (1 + rate / 100) * 100);
  const paidHalalas = Number(b.paidHalalas || 0);
  if (paidHalalas > 0 && Math.abs(expected - paidHalalas) > 100) {
    return send(409, { ok: false, error: "amount_mismatch", expected, paid: paidHalalas });
  }

  const { client } = await daftraFindOrCreateClient(who);
  if (!client || !client.id) return send(502, { ok: false, error: "client_failed" });

  const notes = [
    b.ref ? `مرجع المستند: ${b.ref}` : "",
    b.sourceNumber ? `مطالبة السداد في لوحة العروض: ${b.sourceNumber}` : "",
    "صادرة من لوحة العروض",
    who.isCompany && who.taxNumber ? `الرقم الضريبي: ${who.taxNumber}` : "",
    who.isCompany && who.address ? `العنوان الوطني: ${nationalAddressLine(who.address)}` : "",
    who.contact ? `الشخص المسؤول: ${who.contact}` : "",
  ].filter(Boolean).join("\n");

  let inv;
  try {
    inv = await daftraCreateInvoice({ clientId: client.id, items, notes, ref: String(b.ref || "") });
  } catch (e) {
    return send(502, { ok: false, error: "invoice_failed", detail: String(e.message || e).slice(0, 300) });
  }

  // فشل تقييد السداد لا يُبطل الفاتورة — تبقى صادرة، ويُبلَّغ المنادي ليعرضه.
  let paymentRecorded = false;
  let paymentError = "";
  if (paidHalalas > 0) {
    try {
      await daftraRecordPayment({
        invoiceId: inv.id,
        amount: inv.total,
        transactionId: String(b.payId || ""),
        method: String(b.method || "Moyasar"),
      });
      paymentRecorded = true;
    } catch (e) {
      paymentError = String(e.message || e).slice(0, 200);
    }
  }

  let pdf = null;
  try { pdf = await daftraDocPdf("invoice", inv.id); } catch { pdf = null; }
  let publicUrl = "";
  if (!pdf) {
    try { publicUrl = (await daftraPublicInvoiceLink(inv.id, inv.publicUrl || inv.url || "")).url || ""; } catch { publicUrl = ""; }
  }

  return send(200, {
    ok: true,
    id: inv.id,
    number: inv.number,
    net: inv.net,
    vat: inv.vat,
    total: inv.total,
    vatRate: rate,
    paymentRecorded,
    paymentError,
    pdfBase64: pdf ? pdf.base64 : "",
    publicUrl,
  });
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  // Shared Services — owner approval link (owner clicks the emailed GET link).
  const q = req.query || {};

  // /api/suppliers is rewritten here (vercel.json) rather than shipped as its
  // own file: the plan caps serverless functions at 12 and this repo is at the
  // cap. The supplier portal lives in ./_suppliers.js and owns the request
  // entirely once delegated.
  // الفاتورة الضريبية للوحة العروض — تُصدَر من الشيفرة المجرَّبة نفسها لا من نسخة ثانية.
  if ((q.__route || "") === "daftra-invoice") return handleDaftraInvoice(req, res);
  if ((q.__route || "") === "supplier-quote-read") return handleSupplierQuoteRead(req, res);
  if ((q.__route || "") === "notion-suppliers") return handleNotionSuppliers(req, res);
  if ((q.__route || "") === "suppliers") return handleSuppliers(req, res);
  // Same reason for /api/agencies — the overseas recruitment-agency registry
  // and portal live in ./_agencies.js.
  if ((q.__route || "") === "agencies") return handleAgencies(req, res);
  // Same reason for /api/jobhunt — the candidate-side job-search service and
  // the agent that runs it live in ./_jobhunt.js.
  if ((q.__route || "") === "jobhunt") return handleJobhunt(req, res);
  // Same reason for /api/doc-agent — المستشار الذكي للمستندات lives in
  // ./_docagent.js: intake, classification, extraction, chat, filling, QA.
  if ((q.__route || "") === "doc-agent") return handleDocAgent(req, res);
  if ((q.__route || "") === "simple") return handleSimple(req, res);
  if ((q.action || "") === "approve") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (!OTP_SECRET) { res.statusCode = 503; return res.end("<h3>الخدمة غير مُفعّلة (OTP_SECRET).</h3>"); }
    let d; try { d = ssUnseal(q.t); } catch { res.statusCode = 400; return res.end("<h3>رابط اعتماد غير صالح.</h3>"); }
    await approveShared({ email: d.email, name: d.name, phone: d.phone, ref: d.ref });
    res.statusCode = 200;
    return res.end(`<!doctype html><meta charset="utf-8"><div style="font-family:Arial;max-width:520px;margin:60px auto;text-align:center" dir="rtl"><h2 style="color:#0B1B5A">✅ تم الاعتماد</h2><p>أُرسل كود الوصول إلى <b>${esc(d.email)}</b>.</p></div>`);
  }

  // Compliance Agent — owner approval link (clicked after confirming the bank transfer).
  if ((q.action || "") === "approve-compliance") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (!OTP_SECRET) { res.statusCode = 503; return res.end("<h3>الخدمة غير مُفعّلة (OTP_SECRET).</h3>"); }
    let d; try { d = ssUnseal(q.t); } catch { res.statusCode = 400; return res.end("<h3>رابط اعتماد غير صالح.</h3>"); }
    const code = await approveCompliance({ company: d.company, email: d.email, phone: d.phone });
    if (!code) { res.statusCode = 500; return res.end("<h3>تعذّر التفعيل — تحقّق من إعداد Notion (NOTION_TOKEN) واسم المنشأة.</h3>"); }
    res.statusCode = 200;
    return res.end(`<!doctype html><meta charset="utf-8"><div style="font-family:Arial;max-width:520px;margin:60px auto;text-align:center" dir="rtl"><h2 style="color:#0B1B5A">✅ تم التفعيل</h2><p>أُرسل كود الوصول إلى <b>${esc(d.email)}</b>.</p></div>`);
  }

  // Employer recruitment plan — owner approval link (clicked after confirming the bank transfer).
  if ((q.action || "") === "approve-employer") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (!OTP_SECRET) { res.statusCode = 503; return res.end("<h3>الخدمة غير مُفعّلة (OTP_SECRET).</h3>"); }
    let d; try { d = ssUnseal(q.t); } catch { res.statusCode = 400; return res.end("<h3>رابط اعتماد غير صالح.</h3>"); }
    const code = await approveEmployer({ company: d.company, email: d.email, phone: d.phone, plan: d.plan });
    if (!code) { res.statusCode = 500; return res.end("<h3>تعذّر التفعيل — تحقّق من إعداد Notion (NOTION_TOKEN) واسم الشركة.</h3>"); }
    res.statusCode = 200;
    return res.end(`<!doctype html><meta charset="utf-8"><div style="font-family:Arial;max-width:520px;margin:60px auto;text-align:center" dir="rtl"><h2 style="color:#0B1B5A">✅ تم التفعيل</h2><p>أُرسل رمز الوصول إلى <b>${esc(d.email)}</b>.</p></div>`);
  }

  // Internal dashboard — list recent incoming requests (gated by LEADS_KEY).
  if ((q.action || "") === "leads") {
    res.setHeader("Cache-Control", "no-store");
    if (!panelOk(q)) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "unauthorized" })); }
    try {
      const leads = await listLeads(q.limit);
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, leads }));
    } catch {
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "notion_failed" }));
    }
  }


  // ---------------------------------------------------------------------
  // Live service catalog — the single price source the WhatsApp agent reads.
  //
  // The agent used to carry prices as frozen text in its prompt, so a price
  // edited on the site kept being quoted at its old value on WhatsApp. This
  // serves the published catalog itself (the same site/data files the pages
  // render from), so there is one number in one place.
  //
  // Public on purpose: every figure here is already printed on the website.
  // GET /api/requests?action=catalog                 -> packages + all services
  // GET /api/requests?action=catalog&q=سجل تجاري      -> matching services only
  // GET /api/requests?action=catalog&code=BP-SBC-02  -> one service
  // ---------------------------------------------------------------------
  if ((q.action || "") === "catalog") {
    res.setHeader("Cache-Control", "public, max-age=300");
    try {
      const cat = await loadCatalog();
      const term = normalizeText(q.q || "");
      const code = String(q.code || "").trim().toUpperCase();
      const strip = ({ search, ...rest }) => rest;
      let services = cat.services;
      let pages = [];
      if (code) services = services.filter((s) => s.code === code);
      else if (term) {
        // Every word the customer typed must appear (in any order, Arabic
        // folded); if that finds nothing, any word will do — a thin answer
        // beats "no service found" for a question we clearly cover.
        const tokens = term.split(" ").filter((t) => t.length > 1);
        // Word-prefix match: "عمال" finds "عمالة" but not "أعمال".
        const has = (hay, t) => (" " + hay).includes(" " + t);
        const all = (hay) => tokens.every((t) => has(hay, t));
        const any = (hay) => tokens.some((t) => has(hay, t));
        const rank = (hay) => tokens.filter((t) => has(hay, t)).length;
        let hit = services.filter((s) => all(s.search));
        if (!hit.length) hit = services.filter((s) => any(s.search));
        services = hit.sort((a, b) => rank(b.search) - rank(a.search));
        pages = cat.pages.filter((p) => any(p.search)).sort((a, b) => rank(b.search) - rank(a.search)).slice(0, 5);
      } else {
        pages = cat.pages;
      }
      const limit = Math.min(Math.max(parseInt(q.limit, 10) || 40, 1), 200);
      res.statusCode = 200;
      return res.end(JSON.stringify({
        ok: true,
        currency: "SAR",
        updated: cat.updated,
        note: "أسعار الخدمات الفردية إرشادية وتُحسم بعرض سعر رسمي؛ أسعار الباقات معلنة كما هي. url = الصفحة العربية، urlEn = الإنجليزية.",
        packages: cat.packages,
        pages: pages.map(strip),
        count: services.length,
        services: services.slice(0, limit).map(strip),
      }));
    } catch (e) {
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "catalog_unavailable" }));
    }
  }

  // Website advisor conversations feed for the BP Inbox (/monitor). Same key as
  // the leads feed (set LEADS_KEY in Vercel to the value you type in the inbox).
  // Returns a flat message array — same shape the WhatsApp feed uses — so the
  // monitor merges them into one list, tagged «المستشار».
  if ((q.action || "") === "advisor-inbox") {
    res.setHeader("Cache-Control", "no-store");
    // The same gate as every other owner surface. This one endpoint used to
    // demand LEADS_KEY specifically, so an owner who set PANEL_KEY — which
    // opens everything else — got 503 "not_configured" here every seven
    // seconds, and the inbox showed the website's own conversations as simply
    // absent. A second key name for one endpoint was never a security
    // boundary; it was a way to lose messages.
    if (!panelOk(q)) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "unauthorized" })); }
    try {
      const messages = await listConversations(q.limit);
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, messages }));
    } catch {
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "notion_failed" }));
    }
  }

  // Client Operations Center — session-scoped overview (orders + wallet).
  // Auth = the httpOnly bp_sid session cookie; RLS-equivalent scoping is
  // enforced here by deriving organization_id from the session, never input.
  if ((q.action || "") === "my-overview") {
    res.setHeader("Cache-Control", "no-store");
    if (!DB_ON) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "db_not_configured" })); }
    let sess = null;
    try { sess = await getSession(req); } catch { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "db_failed" })); }
    if (!sess) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "unauthorized" })); }
    const orgId = sess.organization && sess.organization.id;
    try {
      const [orders, bal, tx] = await Promise.all([
        orgId ? sb(`orders?organization_id=eq.${orgId}&select=ref,status,bp_fees,gov_fees,vat,total,created_at&order=created_at.desc&limit=30`) : [],
        orgId ? sb(`wallet_balances?organization_id=eq.${orgId}&select=balance`) : [],
        orgId ? sb(`wallet_transactions?organization_id=eq.${orgId}&select=type,amount,note,created_at&order=created_at.desc&limit=20`) : [],
      ]);
      res.statusCode = 200;
      return res.end(JSON.stringify({
        ok: true,
        user: sess.user,
        organization: sess.organization,
        orders: orders || [],
        walletBalance: (bal && bal[0] && Number(bal[0].balance)) || 0,
        walletTransactions: tx || [],
      }));
    } catch {
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "db_failed" }));
    }
  }

  // عروض الأسعار والعقود والمطالبات من لوحة العروض — داخل صفحة الحساب.
  //
  // كانت اللوحة عالماً منفصلاً: العميل يفتح /ar/account فيرى طلبه ومحفظته،
  // ولا يرى عرض السعر المرسل له ولا العقد الذي وقّعه، لأن ذاك كله خلف بوابة
  // ثانية لا يصلها إلا برابط في بريد. فمن أضاع البريد أضاع العرض.
  //
  // الهوية هنا من الجلسة وحدها — البريد الذي تحقّق منه الموقع برمز — ولا
  // تُقرأ من الطلب أبداً، وإلا صار كل من يعرف بريد غيره يقرأ عقوده.
  if ((q.action || "") === "my-documents") {
    res.setHeader("Cache-Control", "no-store");
    if (!PANEL_BRIDGE_TOKEN) {
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, configured: false, quotes: [], contracts: [], invoices: [] }));
    }
    let sess = null;
    try { sess = await getSession(req); } catch { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "db_failed" })); }
    if (!sess) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "unauthorized" })); }
    const email = String((sess.user && sess.user.email) || "").toLowerCase();
    if (!email) {
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, configured: true, found: false, quotes: [], contracts: [], invoices: [] }));
    }
    try {
      const r = await fetch(`${PANEL_URL}/api/bridge/client-documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${PANEL_BRIDGE_TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({ email }),
        signal: AbortSignal.timeout(12000),
      });
      const j = await r.json().catch(() => null);
      // ٤٠١ ليست عطلاً عابراً بل سرّان مختلفان: الموقع يرسل قيمته واللوحة
      // تقارنها بقيمتها. وقولها «تعذّرت القراءة، سنعيد المحاولة» يجعل صاحبها
      // يحدّث الصفحة أبداً بلا فائدة، فتُميَّز عمّا سواها.
      if (r.status === 401) throw new Error("panel_token_mismatch");
      if (!r.ok || !j || j.ok !== true) throw new Error(`panel_http_${r.status}`);
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, configured: true, ...j }));
    } catch (e) {
      // تعذّر الوصول للوحة لا يُسقط صفحة الحساب: بقيتها تعمل، وهذا القسم
      // وحده يقول إنه لم يستطع القراءة الآن.
      const why = String(e.message || e).slice(0, 200);
      console.error("my-documents bridge failed", why);
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: why === "panel_token_mismatch" ? why : "panel_unreachable" }));
    }
  }

  // ---- لوحة العروض داخل لوحة الموقع (للمالك) ------------------------------
  //
  // المالك يدير عمله من هنا، وبابُ لوحة العروض رابطٌ سحري يصل بريد ADMIN_EMAIL
  // وحده. فمن لم يكن ذلك بريده وقف خارج نظامه هو، ومن أراد أن يرى شيئاً سجّل
  // نفسه عميلاً — فرأى ما يراه العميل لا ما يملكه المالك.
  //
  // النداء يمضي من خادم الموقع إلى خادم اللوحة بالسرّ المشترك، فلا يصل السرّ
  // متصفحاً ولا صفحة. والحارس هنا هو حارس بقية اللوحة: مفتاح المالك أو تذكرة
  // نفاذ.
  if ((q.action || "") === "panel-quotes") {
    res.setHeader("Cache-Control", "no-store");
    if (!panelOk(q)) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "unauthorized" })); }
    if (!PANEL_BRIDGE_TOKEN) {
      res.statusCode = 200;
      return res.end(JSON.stringify({
        ok: true,
        configured: false,
        ملاحظة: "اضبط PANEL_BRIDGE_TOKEN في متغيرات هذا المشروع بالقيمة نفسها الموضوعة في اللوحة، ثم أعد النشر",
      }));
    }
    // login يصنع جلسة مدير في اللوحة — لا يُنفَّذ إلا بطلب صريح من الزرّ.
    const want = String(q.want || "overview") === "login" ? "login" : "overview";
    try {
      const r = await fetch(`${PANEL_URL}/api/bridge/owner`, {
        method: "POST",
        headers: { Authorization: `Bearer ${PANEL_BRIDGE_TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({ action: want }),
        signal: AbortSignal.timeout(15000),
      });
      const j = await r.json().catch(() => null);
      if (r.status === 401) {
        // السرّان مختلفان. والمالك هو من يملك إصلاحه، فيُقال له بالاسم أين
        // وكيف — لا «تعذّر» يتركه يعيد المحاولة على جدار.
        res.statusCode = 502;
        return res.end(JSON.stringify({
          ok: false,
          error: "panel_token_mismatch",
          ملاحظة: "PANEL_BRIDGE_TOKEN في هذا المشروع لا يطابق قيمته في مشروع اللوحة. انسخ القيمة من bp-quotes إلى مشروع الموقع ثم أعد النشر.",
        }));
      }
      if (!r.ok || !j || j.ok !== true) {
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, error: (j && j.error) || `panel_http_${r.status}`, ملاحظة: (j && j["ملاحظة"]) || "" }));
      }
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, configured: true, ...j }));
    } catch (e) {
      console.error("panel-quotes bridge failed", String(e.message || e).slice(0, 200));
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "panel_unreachable" }));
    }
  }

  // First-party analytics feed for the /admin overview: daily series, top
  // pages, top clicked CTAs, referrers, and the latest client-side errors.
  if ((q.action || "") === "panel-analytics") {
    res.setHeader("Cache-Control", "no-store");
    if (!panelOk(q)) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "unauthorized" })); }
    if (!DB_ON) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "db_not_configured" })); }
    try {
      const [daily, pages, clicks, refs, errors] = await Promise.all([
        sb("analytics_daily?select=*"),
        sb("analytics_top_pages?select=*"),
        sb("analytics_top_clicks?select=*"),
        sb("analytics_top_refs?select=*"),
        sb("site_errors?select=at,path,message,source&order=at.desc&limit=20"),
      ]);
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, daily: daily || [], pages: pages || [], clicks: clicks || [], refs: refs || [], errors: errors || [] }));
    } catch { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "db_failed" })); }
  }

  // The in-panel Notion viewer: which databases it may open…
  if ((q.action || "") === "panel-notion-sources") {
    res.setHeader("Cache-Control", "no-store");
    if (!panelOk(q)) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "unauthorized" })); }
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, sources: Object.entries(NOTION_PANEL_DBS).map(([key, s]) => ({ key, title: s.title })) }));
  }

  // …and one database's live rows + schema (select options included, so the
  // panel can render real dropdowns that write straight back to Notion).
  if ((q.action || "") === "panel-notion-db") {
    res.setHeader("Cache-Control", "no-store");
    if (!panelOk(q)) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "unauthorized" })); }
    if (!NOTION_TOKEN) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "crm_not_configured" })); }
    const src = NOTION_PANEL_DBS[String(q.db || "")];
    if (!src) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "bad_db" })); }
    try {
      const hdrs = { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION };
      const [meta, data] = await Promise.all([
        fetch(`https://api.notion.com/v1/databases/${src.id}`, { headers: hdrs }).then((r) => (r.ok ? r.json() : null)),
        notionQuery(src.id, { page_size: Math.min(Math.max(Number(q.limit) || 60, 1), 100), sorts: [{ timestamp: "last_edited_time", direction: "descending" }] }),
      ]);
      const schema = {};
      for (const [name, def] of Object.entries((meta && meta.properties) || {})) {
        schema[name] = {
          type: def.type,
          options: def.type === "select" ? (def.select.options || []).map((o) => o.name)
            : def.type === "status" ? (def.status.options || []).map((o) => o.name)
            : def.type === "multi_select" ? (def.multi_select.options || []).map((o) => o.name)
            : undefined,
        };
      }
      const rows = (data.results || []).map((pg) => {
        const props = {}; let title = "";
        for (const [name, p] of Object.entries(pg.properties || {})) {
          const v = propDisplay(p);
          if (p.type === "title") title = v;
          props[name] = v;
        }
        return { id: pg.id, url: pg.url, edited: String(pg.last_edited_time || "").slice(0, 16).replace("T", " "), title: title || "بدون عنوان", props };
      });
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, title: src.title, notionUrl: `https://www.notion.so/${String(src.id).replace(/-/g, "")}`, schema, rows }));
    } catch (e) {
      console.error("panel-notion-db failed", String(e).slice(0, 200));
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "crm_failed" }));
    }
  }

  // «متابعات اليوم» feed for the /admin overview — the same list the daily
  // digest is built from, so the panel and the WhatsApp message never disagree.
  if ((q.action || "") === "panel-followups") {
    res.setHeader("Cache-Control", "no-store");
    if (!panelOk(q)) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "unauthorized" })); }
    if (!NOTION_TOKEN) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "crm_not_configured" })); }
    try {
      if ((q.scope || "") === "all") {
        const board = await collectBoard(q.limit, q.cursor);
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, followups: board.items, next: board.next, due: board.items.filter((f) => f.bucket === "due").length }));
      }
      const followups = await collectFollowups(q.limit);
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, followups }));
    } catch (e) {
      console.error("panel-followups failed", String(e).slice(0, 200));
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "crm_failed" }));
    }
  }

  // متجر لوحة العميل: الكتالوج كاملاً + رصيد المحفظة + حدود «ادفع لاحقاً»،
  // بجلسة العميل نفسها — فلا يخرج رائد الأعمال من لوحته ليطلب خدمة.
  if ((q.action || "") === "portal-store") {
    res.setHeader("Cache-Control", "no-store");
    const sess = await getSession(req).catch(() => null);
    if (!sess) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "unauthorized" })); }
    try {
      const cat = await catalogFull();
      const services = (cat.services || [])
        .filter((s) => s.code)
        .map((s) => ({
          id: String(s.code).toLowerCase(),
          name: s.nameAr || s.nameEn || s.code,
          nameEn: s.nameEn || "",
          cat: s.categoryAr || s.category || "أخرى",
          amount: Number(s.amount) || 0,
          days: s.days || s.duration || "",
          gov: Number(s.govFees) || 0,
        }));
      const packages = (cat.packages || []).map((p) => ({
        id: String(p.code || p.key || "").toLowerCase(),
        name: p.nameAr || p.nameEn || p.code || p.key,
        cat: "الباقات",
        amount: Number(p.amount) || 0,
      })).filter((p) => p.id);
      let walletBalance = 0;
      const orgId = sess.organization && sess.organization.id;
      if (DB_ON && orgId) {
        const bal = await sb(`wallet_balances?organization_id=eq.${orgId}&select=balance`).catch(() => null);
        walletBalance = (bal && bal[0] && Number(bal[0].balance)) || 0;
      }
      res.statusCode = 200;
      return res.end(JSON.stringify({
        ok: true,
        services: services.concat(packages),
        walletBalance,
        vatRate: 15,
        payLaterDays: [7, 14, 30],
        user: { name: (sess.user && sess.user.full_name) || "", email: (sess.user && sess.user.email) || "" },
        org: sess.organization ? { name: sess.organization.name_ar || sess.organization.name_en || "" } : null,
      }));
    } catch (e) {
      console.error("portal-store failed", String(e).slice(0, 200));
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "store_failed" }));
    }
  }

  // «المالية» — القيود المالية للاثني عشر شهراً الأخيرة مجمّعة شهرياً
  // وبالفئات، مع مؤشرات من الـ CRM (عملاء الشهر الجدد وصفقات Won).
  if ((q.action || "") === "panel-finance") {
    res.setHeader("Cache-Control", "no-store");
    if (!panelOk(q)) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "unauthorized" })); }
    if (!NOTION_TOKEN) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "crm_not_configured" })); }
    try {
      const from = new Date(Date.now() - 370 * 864e5).toISOString().slice(0, 10);
      let raw = [], cursor = null;
      for (let i = 0; i < 5; i++) {
        const data = await notionQuery(FINANCE_DB, {
          page_size: 100,
          ...(cursor ? { start_cursor: cursor } : {}),
          filter: { property: "التاريخ", date: { on_or_after: from } },
          sorts: [{ property: "التاريخ", direction: "descending" }],
        });
        raw = raw.concat(data.results || []);
        if (!data.has_more) break;
        cursor = data.next_cursor;
      }
      const entries = raw.map((pg) => {
        const p = pg.properties || {};
        return {
          id: pg.id,
          title: propAny(p["البيان"]),
          type: propAny(p["النوع"]) === "إيراد" ? "إيراد" : "مصروف",
          amount: p["المبلغ"] && typeof p["المبلغ"].number === "number" ? p["المبلغ"].number : 0,
          date: propAny(p["التاريخ"]).slice(0, 10),
          cat: propAny(p["الفئة"]),
          method: propAny(p["طريقة الدفع"]),
          ref: propAny(p["رقم المرجع"]),
          note: propAny(p["ملاحظات"]),
        };
      }).filter((e) => e.amount > 0 && e.date);
      const monthKey = new Date().toISOString().slice(0, 7);
      const yearKey = monthKey.slice(0, 4);
      const monthly = {}, byCat = {};
      let mRev = 0, mExp = 0, yRev = 0, yExp = 0;
      for (const e of entries) {
        const mk = e.date.slice(0, 7);
        monthly[mk] = monthly[mk] || { rev: 0, exp: 0 };
        if (e.type === "إيراد") monthly[mk].rev += e.amount; else monthly[mk].exp += e.amount;
        if (mk === monthKey) { if (e.type === "إيراد") mRev += e.amount; else mExp += e.amount; }
        if (mk.slice(0, 4) === yearKey) { if (e.type === "إيراد") yRev += e.amount; else yExp += e.amount; }
        if (e.type === "مصروف" && mk.slice(0, 4) === yearKey) byCat[e.cat || "أخرى"] = (byCat[e.cat || "أخرى"] || 0) + e.amount;
      }
      // CRM pulse for the KPI row — bounded windows, best effort.
      let newMonth = 0, wonYear = 0;
      try {
        const nm = await notionQuery(CRM_DB, { page_size: 100, filter: { timestamp: "created_time", created_time: { on_or_after: monthKey + "-01" } } });
        newMonth = (nm.results || []).length + (nm.has_more ? 100 : 0);
        const wq = await notionQuery(CRM_DB, { page_size: 100, filter: { and: [ { property: "Stage", select: { equals: "Won" } }, { timestamp: "last_edited_time", last_edited_time: { on_or_after: yearKey + "-01-01" } } ] } });
        wonYear = (wq.results || []).length + (wq.has_more ? 100 : 0);
      } catch (eK) { console.error("finance kpi crm", String(eK).slice(0, 120)); }
      res.statusCode = 200;
      return res.end(JSON.stringify({
        ok: true,
        entries: entries.slice(0, 100),
        monthly, byCat,
        totals: { mRev, mExp, mNet: mRev - mExp, yRev, yExp, yNet: yRev - yExp },
        kpi: { newMonth, wonYear },
      }));
    } catch (e) {
      console.error("panel-finance failed", String(e).slice(0, 200));
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "finance_failed" }));
    }
  }

  // ---- The revenue board -----------------------------------------------------
  // Most of the money that passes through Business Partner is not Business
  // Partner's. A company tops up its wallet so we can pay its GOSI
  // subscription, renew its iqamas and work permits, settle municipality
  // licences and platform fees, and run its payroll — all so it never collects
  // a violation. That money is the client's while it sits with us, and it
  // becomes a government platform's the moment we pay. Calling any of it
  // "revenue" would inflate the business several times over and put a tax
  // liability on the wrong side of the ledger.
  //
  // So this endpoint answers four separate questions instead of one:
  //   1. كم دخل الصندوق؟     cash actually collected, whatever it belongs to
  //   2. كم منه لنا؟          bp_fees on orders that were really paid — this
  //                           alone is revenue
  //   3. كم منه ليس لنا؟      gov fees (pass-through), VAT (owed to ZATCA),
  //                           wallet balances (clients'), escrow (suppliers')
  //   4. كم لم يصل بعد؟       orders awaiting payment and quotes still out
  //
  // The manual Notion ledger stays, but as one source beside the system's own
  // records rather than the only one — it is where cash and bank movements
  // that never touched the site get written down.
  if ((q.action || "") === "panel-revenue") {
    res.setHeader("Cache-Control", "no-store");
    if (!panelOk(q)) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "unauthorized" })); }
    if (!DB_ON) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "db_not_configured" })); }

    // An order counts as revenue only once the money is in. Anything still
    // waiting on a transfer or a receipt review is pipeline, not income.
    const PAID = ["paid", "in_progress", "delivered", "completed"];
    const WAITING = ["payment_verification", "awaiting_payment", "draft"];
    const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
    const r2 = (x) => Math.round(x * 100) / 100;
    const monthKey = new Date().toISOString().slice(0, 7);
    const yearKey = monthKey.slice(0, 4);

    try {
      const [orders, payments, wallets, escrows, walletTx] = await Promise.all([
        sb("orders?select=ref,status,bp_fees,gov_fees,vat,total,currency,created_at&order=created_at.desc&limit=1000"),
        sb("payments?select=method,status,amount,gateway_ref,order_id,created_at&order=created_at.desc&limit=1000"),
        sb("wallet_balances?select=*").catch(() => []),
        sb("escrows?select=ref,amount,status,supplier_name,title,created_at&order=created_at.desc&limit=500"),
        sb("wallet_transactions?select=type,amount,note,created_at&order=created_at.desc&limit=500"),
      ]);

      // ---- what is ours, month by month
      const monthly = {};
      const bucket = (mk) => (monthly[mk] = monthly[mk] || { revenue: 0, govFees: 0, vat: 0, cash: 0 });
      let revMonth = 0, revYear = 0, revAll = 0, paidCount = 0;
      let govMonth = 0, govYear = 0, govAll = 0;
      let vatMonth = 0, vatYear = 0, vatAll = 0;
      let pipeN = 0, pipeFees = 0, pipeTotal = 0;

      for (const o of orders || []) {
        const mk = String(o.created_at || "").slice(0, 7);
        const fees = n(o.bp_fees), gov = n(o.gov_fees), vat = n(o.vat);
        if (PAID.includes(o.status)) {
          paidCount++;
          revAll += fees; govAll += gov; vatAll += vat;
          if (mk.slice(0, 4) === yearKey) { revYear += fees; govYear += gov; vatYear += vat; }
          if (mk === monthKey) { revMonth += fees; govMonth += gov; vatMonth += vat; }
          const b = bucket(mk); b.revenue += fees; b.govFees += gov; b.vat += vat;
        } else if (WAITING.includes(o.status)) {
          pipeN++; pipeFees += fees; pipeTotal += n(o.total);
        }
      }

      // ---- what actually reached the account, by channel
      const byMethod = {};
      let cashTotal = 0, cashMonth = 0;
      for (const p of payments || []) {
        if (String(p.status) !== "paid") continue;
        const amt = n(p.amount), mk = String(p.created_at || "").slice(0, 7);
        byMethod[p.method || "أخرى"] = r2((byMethod[p.method || "أخرى"] || 0) + amt);
        cashTotal += amt;
        if (mk === monthKey) cashMonth += amt;
        bucket(mk).cash += amt;
      }

      // ---- money held that is not ours
      const walletHeld = (wallets || []).reduce((s, w) => s + n(w.balance), 0);
      let escrowHeld = 0, escrowReleased = 0, escrowRefunded = 0;
      for (const e of escrows || []) {
        const a = n(e.amount);
        if (e.status === "held" || e.status === "delivered" || e.status === "refund_requested") escrowHeld += a;
        else if (e.status === "released") escrowReleased += a;
        else if (e.status === "refunded") escrowRefunded += a;
      }
      const topUps = (walletTx || []).filter((t) => t.type === "topup").reduce((s, t) => s + n(t.amount), 0);

      // ---- quotes still out, from the invoicing app (best effort)
      let quotes = { n: 0, total: 0, reachable: false };
      try {
        if (PANEL_BRIDGE_TOKEN) {
          const qr = await fetch(`${PANEL_URL}/api/bridge/owner`, {
            method: "POST",
            headers: { Authorization: `Bearer ${PANEL_BRIDGE_TOKEN}`, "content-type": "application/json" },
            body: JSON.stringify({ action: "overview" }),
            signal: AbortSignal.timeout(8000),
          });
          const qj = await qr.json().catch(() => null);
          if (qr.ok && qj && qj.ok) {
            quotes = { n: n(qj.openQuotes || qj.quotesOpen), total: n(qj.openQuotesValue || qj.quotesValue), reachable: true };
          }
        }
      } catch { /* the board renders without it */ }

      // ---- the manual ledger, as one source among several
      let ledger = { configured: false, mRev: 0, mExp: 0, yRev: 0, yExp: 0, entries: 0 };
      if (NOTION_TOKEN) {
        try {
          const from = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10);
          const data = await notionQuery(FINANCE_DB, {
            page_size: 100,
            filter: { property: "التاريخ", date: { on_or_after: from } },
            sorts: [{ property: "التاريخ", direction: "descending" }],
          });
          let mRev = 0, mExp = 0, yRev = 0, yExp = 0, cnt = 0;
          for (const pg of data.results || []) {
            const p = pg.properties || {};
            const amt = p["المبلغ"] && typeof p["المبلغ"].number === "number" ? p["المبلغ"].number : 0;
            const date = propAny(p["التاريخ"]).slice(0, 10);
            if (!(amt > 0) || !date) continue;
            cnt++;
            const isRev = propAny(p["النوع"]) === "إيراد";
            const mk = date.slice(0, 7);
            if (mk.slice(0, 4) === yearKey) { if (isRev) yRev += amt; else yExp += amt; }
            if (mk === monthKey) { if (isRev) mRev += amt; else mExp += amt; }
          }
          ledger = { configured: true, mRev: r2(mRev), mExp: r2(mExp), yRev: r2(yRev), yExp: r2(yExp), entries: cnt };
        } catch (e) { console.error("panel-revenue ledger", String(e).slice(0, 120)); }
      }

      // ---- what the owner should not be left to infer
      const notes = [];
      if (!paidCount && (orders || []).length) {
        notes.push("لا يوجد طلب واحد مسجَّل كمدفوع في قاعدة البيانات رغم وجود طلبات — راجع «تنبيهات المطابقة» أدناه.");
      }
      if (pipeN) notes.push(`${pipeN} طلباً ما زال بانتظار تأكيد السداد — قيمتها ${r2(pipeTotal)} ﷼ ليست إيراداً بعد.`);
      if (!ledger.configured) notes.push("دفتر نوشن اليدوي غير متاح — الأرقام هنا من قاعدة البيانات وحدها.");
      else if (!ledger.entries) notes.push("دفتر نوشن اليدوي فارغ — أي تحصيل بنكي أو نقدي خارج الموقع لن يظهر حتى يُسجَّل فيه.");
      if (escrowHeld > 0) notes.push(`${r2(escrowHeld)} ﷼ محجوزة في الضمان لموردين — أمانة لدينا، لا إيراداً.`);
      if (walletHeld > 0) notes.push(`${r2(walletHeld)} ﷼ أرصدة عملاء في المحافظ — مالهم لدينا لسداد التزاماتهم، لا إيراداً.`);

      res.statusCode = 200;
      return res.end(JSON.stringify({
        ok: true,
        asOf: new Date().toISOString(),
        currency: "SAR",
        cash: { total: r2(cashTotal), month: r2(cashMonth), byMethod, topUps: r2(topUps) },
        revenue: { month: r2(revMonth), year: r2(revYear), all: r2(revAll), paidOrders: paidCount },
        notOurs: {
          govFees: { month: r2(govMonth), year: r2(govYear), all: r2(govAll) },
          vat: { month: r2(vatMonth), year: r2(vatYear), all: r2(vatAll) },
          walletHeld: r2(walletHeld),
          escrowHeld: r2(escrowHeld),
          escrowReleased: r2(escrowReleased),
          escrowRefunded: r2(escrowRefunded),
        },
        pipeline: { orders: pipeN, orderFees: r2(pipeFees), orderTotal: r2(pipeTotal), quotes },
        ledger,
        monthly: Object.fromEntries(Object.entries(monthly).map(([k, v]) => [k, {
          revenue: r2(v.revenue), govFees: r2(v.govFees), vat: r2(v.vat), cash: r2(v.cash),
        }])),
        counts: { orders: (orders || []).length, payments: (payments || []).length, escrows: (escrows || []).length },
        notes,
      }));
    } catch (e) {
      console.error("panel-revenue failed", String(e).slice(0, 200));
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "revenue_failed" }));
    }
  }

  // Daily CRM sweep, called by the n8n schedule — no human in the loop.
  // Keyless like escrow-sweep, and safe to be: it only (1) mirrors the
  // WhatsApp leads database into the master pipeline (idempotent upserts keyed
  // by رقم المرجع) and (2) sends the owner's own follow-up digest to the
  // owner's own addresses — at most once per day, enforced through an
  // audit_logs stamp, so hammering the URL cannot spam anyone.
  if ((q.action || "") === "crm-followup-sweep") {
    res.setHeader("Cache-Control", "no-store");
    if (!NOTION_TOKEN) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "crm_not_configured" })); }
    let synced = 0, waSkipped = 0, syncError = null;
    try { const s = await syncWhatsappLeads(); synced = s.synced; waSkipped = s.skipped; }
    catch (e) { syncError = String(e && e.message || e).slice(0, 120); console.error("wa lead sync failed", syncError); }
    let due = [];
    try { due = await collectFollowups(60); }
    catch (e) {
      console.error("followup collect failed", String(e).slice(0, 200));
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "crm_failed", synced, syncError }));
    }
    let digestSent = false, waNotified = false, waError = null;
    if (due.length) {
      const day = new Date().toISOString().slice(0, 10);
      // Once-per-day stamp. If today's stamp says the WhatsApp leg failed, a
      // rerun retries ONLY WhatsApp (never the e-mail) and re-stamps on
      // success — a failed send delivers nothing, so retries cannot spam.
      let fresh = true, waRetryOnly = false;
      if (DB_ON) {
        try {
          const prior = await sb(`audit_logs?action=eq.crm.digest&created_at=gte.${day}T00:00:00Z&select=id,after&order=created_at.desc&limit=1`);
          if (prior && prior.length) { fresh = false; waRetryOnly = !!(OWNER_WA && prior[0].after && prior[0].after.waNotified === false); }
        } catch {}
      }
      // Per-channel tallies drive the summary line and the report sections.
      const byChannel = {};
      for (const f of due) { (byChannel[f.channel.key] = byChannel[f.channel.key] || { ch: f.channel, rows: [] }).rows.push(f); }
      const chGroups = Object.values(byChannel).sort((a, b) => b.rows.length - a.rows.length);
      const chSummary = chGroups.map((g) => `${g.ch.icon} ${g.ch.label} ${g.rows.length}`).join(" · ");
      const items = due.slice(0, 12);
      const waText = [
        `📋 متابعات اليوم — ${due.length} عميل يحتاج تواصلك:`,
        chSummary,
        ...items.map((f, i) => `${i + 1}) ${f.channel.icon} ${f.channel.label} · ${f.title}${f.phone ? " · " + f.phone : f.email ? " · " + f.email : ""}\n← ${f.action}`),
        due.length > items.length ? `…و ${due.length - items.length} آخرون.` : "",
        `القائمة كاملة بأزرار الاتصال: ${MKT_SITE_BASE}/admin`,
      ].filter(Boolean).join("\n").slice(0, 3400);
      if (fresh) {
        // A real report, not a wall of text: date header, per-channel counter
        // chips, then one section per channel with its own accent colour.
        const today2 = new Date().toLocaleDateString("ar-SA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
        const chips = chGroups.map((g) => `<td style="padding:0 4px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${g.ch.color}14;border:1px solid ${g.ch.color}33;border-radius:20px;padding:6px 14px;font-size:13px;color:${g.ch.color};white-space:nowrap">${g.ch.icon} ${esc(g.ch.label)} <b>${g.rows.length}</b></td></tr></table></td>`).join("");
        const sections = chGroups.map((g) => {
          const rowsHtml = g.rows.map((f) => `<tr><td style="padding:10px 8px;border-bottom:1px solid #EEF1F7"><b style="color:#1F2430">${esc(f.title)}</b><br><span style="color:#8A93A6;font-size:12px">${esc([f.ref, f.stage, f.order].filter(Boolean).join(" · "))}</span><br><span style="color:#8A93A6;font-size:11.5px">📆 وصل: ${esc(f.created || "—")} · آخر نشاط: ${esc(f.last || "—")} · متابعته: ${f.due ? `<span style="color:${f.due <= new Date().toISOString().slice(0, 10) ? "#B91C1C" : "#8A93A6"}">${esc(f.due)}</span>` : "اليوم"}</span></td><td style="padding:10px 8px;border-bottom:1px solid #EEF1F7;white-space:nowrap">${f.phone ? `<a href="https://wa.me/${esc(f.phone.replace(/\D/g, ""))}" style="background:#25D366;color:#fff;padding:5px 12px;border-radius:6px;text-decoration:none;font-size:12px">💬 واتساب</a> <a href="tel:${esc(f.phone)}" style="color:#0B1B5A;font-size:12px">📞 ${esc(f.phone)}</a>` : ""}${f.email ? `<br><a href="mailto:${esc(f.email)}" style="color:#0B1B5A;font-size:12px">✉️ ${esc(f.email)}</a>` : ""}${!f.phone && !f.email ? `<span style="color:#B91C1C;font-size:12px">لا وسيلة تواصل</span>` : ""}</td><td style="padding:10px 8px;border-bottom:1px solid #EEF1F7;color:#0B1B5A;font-size:13px">← ${esc(f.action)}</td></tr>`).join("");
          return `<tr><td style="padding:22px 24px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-right:4px solid ${g.ch.color};padding-right:10px;font-size:16px;font-weight:bold;color:${g.ch.color}">${g.ch.icon} ${esc(g.ch.label)} — ${g.rows.length} عميل</td></tr></table><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin-top:8px"><thead><tr style="background:#F4F6FB"><th style="padding:8px;text-align:right;color:#5B6478;font-size:12px">العميل</th><th style="padding:8px;text-align:right;color:#5B6478;font-size:12px">التواصل</th><th style="padding:8px;text-align:right;color:#5B6478;font-size:12px">المطلوب</th></tr></thead><tbody>${rowsHtml}</tbody></table></td></tr>`;
        }).join("");
        const digestHtml = `<div dir="rtl" style="font-family:Arial,'Segoe UI',Tahoma,sans-serif;background:#F2F4FA;padding:24px 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #E2E7F2"><tr><td style="background:#0B1B5A;padding:22px 26px"><span style="color:#fff;font-size:20px;font-weight:bold">📋 تقرير متابعات اليوم</span><br><span style="color:#B9C4E8;font-size:13px">${esc(today2)} · ${due.length} عميل يحتاج تواصلك — مصنّفون حسب مصدر الوصول</span></td></tr><tr><td style="padding:18px 20px 0"><table role="presentation" cellpadding="0" cellspacing="0"><tr>${chips}</tr></table></td></tr>${sections}<tr><td style="padding:24px;text-align:center"><a href="${MKT_SITE_BASE}/admin" style="background:#0B1B5A;color:#fff;padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">افتح لوحة التحكم — بأزرار الاتصال</a><p style="color:#8A93A6;font-size:12px;margin-top:14px">تقرير آلي يومي من نظام المتابعة الموحّد · بيزنس بارتنر — حتى لا يضيع عميل.</p></td></tr></table></div>`;
        try {
          const [waRes] = await Promise.all([
            OWNER_WA ? waSend(OWNER_WA, waText) : Promise.resolve({ ok: false, error: "no_owner_number" }),
            sendEmail(TEAM_EMAIL, `📋 متابعات اليوم — ${due.length} عميل يحتاج تواصلك`, digestHtml),
          ]);
          waNotified = !!(waRes && waRes.ok);
          waError = waNotified ? null : String((waRes && waRes.error) || "wa_failed").slice(0, 160);
          digestSent = true;
          await audit({ action: "crm.digest", actor_label: "n8n", after: { day, due: due.length, synced, waNotified, waError } });
        } catch (e) { console.error("digest send failed", String(e).slice(0, 200)); }
      } else if (waRetryOnly) {
        try {
          const w = await waSend(OWNER_WA, waText);
          waNotified = !!(w && w.ok);
          waError = waNotified ? null : String((w && w.error) || "wa_failed").slice(0, 160);
          if (waNotified) await audit({ action: "crm.digest", actor_label: "n8n", after: { day, due: due.length, waNotified: true, retry: true } });
        } catch (e) { waError = String(e).slice(0, 160); }
      }
    }
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, due: due.length, synced, waSkipped, digestSent, waNotified, waError, syncError }));
  }

  // Automation sweep, called by the n8n daily schedule — no human in the loop.
  // Deliberately keyless: it takes no input and performs only deterministic,
  // deadline-based transitions that were announced to both parties up front,
  // so an outside caller can only make the schedule run early, never choose an
  // outcome. The rules (the same ones the freelance marketplaces use):
  //   * delivered + client silent for ESCROW_AUTO_RELEASE_DAYS → release to
  //     the supplier (silence = acceptance).
  //   * refund requested on an UNDELIVERED job + supplier silent for
  //     ESCROW_AUTO_REFUND_DAYS → refund the client (silence = consent).
  //   * a refund dispute over CLAIMED-delivered work is the one case left to
  //     Business Partner — arbitration is the product there, not overhead.
  // Reminder emails go out in the final two days before each deadline.
  if ((q.action || "") === "escrow-sweep") {
    res.setHeader("Cache-Control", "no-store");
    if (!DB_ON) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "db_not_configured" })); }
    const relDays = Number(process.env.ESCROW_AUTO_RELEASE_DAYS) > 0 ? Number(process.env.ESCROW_AUTO_RELEASE_DAYS) : 7;
    const refDays = Number(process.env.ESCROW_AUTO_REFUND_DAYS) > 0 ? Number(process.env.ESCROW_AUTO_REFUND_DAYS) : 7;
    const now = Date.now(), DAY = 864e5;
    let released = 0, refunded = 0, reminders = 0;
    try {
      const open = await sb("escrows?status=in.(delivered,refund_requested)&select=*&order=created_at.asc&limit=200");
      for (const e of open || []) {
        const amount = Number(e.amount);
        if (e.status === "delivered" && e.delivered_at) {
          const left = relDays - (now - Date.parse(e.delivered_at)) / DAY;
          if (left <= 0) {
            const rows = await sb(`escrows?id=eq.${e.id}&status=eq.delivered`, { method: "PATCH", body: { status: "released", released_at: new Date().toISOString() } });
            if (!rows.length) continue;
            released++;
            await sb("supplier_wallet_transactions", { method: "POST", prefer: "return=minimal", body: [{ supplier_email: e.supplier_email, type: "escrow_release", amount, note: `تحرير تلقائي لضمان ${e.ref} — مضت ${relDays} أيام على إعلان التسليم دون اعتراض العميل` }] });
            await notify({ organization_id: e.organization_id, event: "escrow_auto_released", channel: "inapp", title: `تحرر ضمان ${e.ref} تلقائياً للمورد (مضت ${relDays} أيام على التسليم دون اعتراض)`, idempotency_key: `escrow_auto_rel:${e.ref}` }).catch(() => {});
            await Promise.all([
              sendEmail(e.supplier_email, `✅ تحرر ضمانك تلقائياً — ${e.ref} (${amount} ﷼)`, `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430"><p>مضت ${relDays} أيام على إعلانك التسليم دون اعتراض من العميل، فتحرر مبلغ <strong>${amount} ﷼</strong> تلقائياً إلى محفظتك في <a href="${MKT_SITE_BASE}/partner-dashboard" style="color:#0B1B5A">لوحة الشريك</a>.</p></div>`),
              sendEmail(e.client_email, `تحرر الضمان ${e.ref} تلقائياً`, `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430"><p>مضت ${relDays} أيام على إعلان المورد تسليم «${esc(e.title)}» دون اعتراض منك، فتحرر مبلغ الضمان (${amount} ﷼) للمورد تلقائياً وفق آلية المنصة المعلنة.</p></div>`),
            ]).catch(() => {});
          } else if (left <= 2) {
            reminders++;
            await sendEmail(e.client_email, `⏰ تذكير: اعتمد استلام «${String(e.title).slice(0, 60)}» — ${e.ref}`, `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430"><p>أعلن المورد تسليم <b>${esc(e.title)}</b> ولم تعتمد الاستلام بعد. أمامك <b>${Math.ceil(left)} يوم${Math.ceil(left) > 1 ? "ين" : ""}</b> — بعدها يتحرر المبلغ (${amount} ﷼) للمورد تلقائياً. اعتمد أو اطلب الاسترجاع من <a href="${MKT_SITE_BASE}/account" style="color:#0B1B5A">لوحتك ← المحفظة</a>.</p></div>`).catch(() => {});
          }
        }
        if (e.status === "refund_requested" && !e.delivered_at && e.refund_requested_at) {
          const left = refDays - (now - Date.parse(e.refund_requested_at)) / DAY;
          if (left <= 0) {
            const rows = await sb(`escrows?id=eq.${e.id}&status=eq.refund_requested`, { method: "PATCH", body: { status: "refunded" } });
            if (!rows.length) continue;
            refunded++;
            await sb("wallet_transactions", { method: "POST", prefer: "return=minimal", body: [{ organization_id: e.organization_id, type: "refund", amount, note: `استرجاع تلقائي لضمان ${e.ref} — لم يرد المورد على طلب الاسترجاع خلال ${refDays} أيام ولم يعلن أي تسليم` }] });
            await notify({ organization_id: e.organization_id, event: "escrow_auto_refunded", channel: "inapp", title: `أُرجع ضمان ${e.ref} (+${amount} ﷼) لمحفظتك تلقائياً`, idempotency_key: `escrow_auto_ref:${e.ref}` }).catch(() => {});
            await Promise.all([
              sendEmail(e.client_email, `↩️ أُرجع الضمان ${e.ref} إلى محفظتك تلقائياً`, `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430"><p>لم يرد المورد على طلب الاسترجاع خلال ${refDays} أيام ولم يعلن أي تسليم، فعاد مبلغ <strong>${amount} ﷼</strong> إلى محفظتك تلقائياً وفق آلية المنصة.</p></div>`),
              sendEmail(e.supplier_email, `الضمان ${e.ref} أُرجع للعميل تلقائياً`, `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430"><p>مضت ${refDays} أيام على طلب العميل الاسترجاع دون رد منك ودون إعلان تسليم، فأُرجع المبلغ للعميل تلقائياً وفق آلية المنصة المعلنة.</p></div>`),
            ]).catch(() => {});
          } else if (left <= 2) {
            reminders++;
            await sendEmail(e.supplier_email, `⏰ تذكير: طلب استرجاع على الضمان ${e.ref} — أمامك ${Math.ceil(left)} يوم`, `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430"><p>طلب العميل استرجاع الضمان <b>${e.ref}</b> (${Number(e.amount)} ﷼) ولم تسلّم العمل بعد. إن كنت أنجزت العمل فأعلن التسليم الآن من <a href="${MKT_SITE_BASE}/partner-dashboard" style="color:#0B1B5A">لوحة الشريك</a>، وإلا يُرجع المبلغ للعميل تلقائياً بعد <b>${Math.ceil(left)} يوم${Math.ceil(left) > 1 ? "ين" : ""}</b>.</p></div>`).catch(() => {});
          }
        }
      }
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, released, refunded, reminders, rules: { autoReleaseDays: relDays, autoRefundDays: refDays } }));
    } catch (e) {
      console.error("escrow sweep failed", String(e).slice(0, 200));
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "db_failed", released, refunded }));
    }
  }

  // Escrows the session's active organization opened — shown in the client's
  // wallet view alongside the balance they draw from.
  if ((q.action || "") === "my-escrows") {
    res.setHeader("Cache-Control", "no-store");
    if (!DB_ON) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "db_not_configured" })); }
    let sess = null;
    try { sess = await getSession(req); } catch { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "db_failed" })); }
    if (!sess) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "unauthorized" })); }
    const orgId = sess.organization && sess.organization.id;
    try {
      const [escrows, bal] = await Promise.all([
        orgId ? sb(`escrows?organization_id=eq.${orgId}&select=id,ref,supplier_email,supplier_name,title,amount,status,created_at,released_at,delivered_at,supplier_note&order=created_at.desc&limit=50`) : [],
        orgId ? sb(`wallet_balances?organization_id=eq.${orgId}&select=balance`) : [],
      ]);
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, escrows: escrows || [], walletBalance: (bal && bal[0] && Number(bal[0].balance)) || 0, hasOrg: !!orgId }));
    } catch { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "db_failed" })); }
  }

  // P4 — orders belong to the ACCOUNT, not the browser: list the session
  // email's CRM orders so cart purchases show up in the client ops center
  // from any device (localStorage stays only as a legacy-refs fallback).
  if ((q.action || "") === "my-orders") {
    res.setHeader("Cache-Control", "no-store");
    let sess = null;
    try { sess = await getSession(req); } catch { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "db_failed" })); }
    if (!sess) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "unauthorized" })); }
    if (!NOTION_TOKEN) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "notion_not_configured" })); }
    const myEmail = String((sess.user && sess.user.email) || "").toLowerCase();
    if (!myEmail) { res.statusCode = 200; return res.end(JSON.stringify({ ok: true, orders: [], bd: bdTrial(sess.organization, false, new Date(), openFor(sess)) })); }
    try {
      const r = await fetch(`https://api.notion.com/v1/databases/${CRM_DB}/query`, {
        method: "POST",
        headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
        body: JSON.stringify({
          page_size: 30,
          filter: { property: "Notes", rich_text: { contains: myEmail } },
          sorts: [{ timestamp: "created_time", direction: "descending" }],
        }),
      });
      if (!r.ok) throw new Error("notion_failed");
      const rows = (await r.json()).results || [];
      const orders = rows
        .map((pg) => {
          const p = pg.properties || {};
          const ref = ((p["رقم المرجع"] && p["رقم المرجع"].rich_text) || []).map((t) => t.plain_text).join("").trim();
          let title = ((p["Opportunity Name"] && p["Opportunity Name"].title) || []).map((t) => t.plain_text).join("").trim();
          if (ref && title.endsWith(`(${ref})`)) title = title.slice(0, -(ref.length + 2)).trim();
          const status = (p["حالة الطلب"] && p["حالة الطلب"].select && p["حالة الطلب"].select.name) || "";
          const totalProp = p["إجمالي الطلب"];
          const total = totalProp && typeof totalProp.number === "number" ? totalProp.number : null;
          // The opportunity title is generic ("طلب/شراء خدمة — <name>"), so what
          // the client actually bought lives only in the note. Without this the
          // client's own dashboard cannot tell a Revenue OS subscription from a
          // one-off service and its subscription banner can never flip.
          const notes = ((p["Notes"] && p["Notes"].rich_text) || []).map((t) => t.plain_text).join("");
          const itemsM = notes.match(/طلب\s*·\s*([^·]+)/);
          return {
            ref, title, status, total, at: String(pg.created_time || "").slice(0, 10),
            items: itemsM ? itemsM[1].trim().slice(0, 300) : "",
            subscriptions: parseSubsFromNotes(notes),
          };
        })
        // Orders and Revenue OS requests only: web-chat threads (WEB-<sid>)
        // also carry the email in Notes but are conversations, not orders.
        .filter((o) => o.ref && /^(BP|RV|BPW|BPP|BPQ|BPI)-/i.test(o.ref));
      // Whether this client may use Business Development as a Service, decided
      // here rather than in the dashboard: the trial clock is the organization's
      // registration date, and a browser that computes its own eligibility can
      // simply clear storage for another fortnight.
      res.statusCode = 200;
      return res.end(JSON.stringify({
        ok: true,
        orders,
        bd: bdTrial(sess.organization, orders.some(isPaidBdOrder), new Date(), openFor(sess)),
      }));
    } catch {
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "notion_failed" }));
    }
  }

  // P3 — unified portal opening: the logged-in client's own credentials are
  // looked up server-side (Notion is queried by the SESSION email only —
  // never by client input) and returned as localStorage seeds + target URL.
  // Legacy manual logins keep working unchanged; no n8n workflows touched.
  if ((q.action || "") === "sso-open") {
    res.setHeader("Cache-Control", "no-store");
    let sess = null;
    try { sess = await getSession(req); } catch { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "db_failed" })); }
    if (!sess) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "unauthorized" })); }
    const email = String((sess.user && sess.user.email) || "").toLowerCase();
    const portal = String(q.portal || "");
    const nq = async (db, filter, size) => {
      const r = await fetch(`https://api.notion.com/v1/databases/${db}/query`, {
        method: "POST",
        headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
        body: JSON.stringify({ page_size: size || 5, filter }),
      });
      if (!r.ok) throw new Error("notion_failed");
      return (await r.json()).results || [];
    };
    const rtxt = (p, k) => ((p[k] && p[k].rich_text) || []).map((t) => t.plain_text).join("").trim();
    try {
      if (portal === "compliance") {
        const rows = await nq(COMPLIANCE_DB, { and: [{ property: "البريد", email: { equals: email } }, { property: "حالة الاشتراك", select: { equals: "نشط" } }] }, 1);
        const p = rows[0] && rows[0].properties;
        const code = p ? rtxt(p, "رمز الدخول") : "";
        if (!code) { res.statusCode = 200; return res.end(JSON.stringify({ ok: false, error: "no_subscription" })); }
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, url: "/ar/compliance-dashboard", seed: { bp_portal_email: email, bp_portal_code: code } }));
      }
      if (portal === "employees") {
        // Latest confirmed CRM order for this email that carries an AGENTS tag.
        const rows = await nq(CRM_DB, {
          and: [
            { property: "Notes", rich_text: { contains: email } },
            { or: [{ property: "حالة الطلب", select: { equals: "مؤكد - قيد التنفيذ" } }, { property: "حالة الطلب", select: { equals: "مكتمل" } }] },
          ],
        }, 10);
        let agents = null;
        for (const pg of rows) {
          const notes = rtxt(pg.properties || {}, "Notes");
          const m = notes.match(/AGENTS:([a-z0-9,]+)/i);
          if (m) { const list = m[1].split(",").filter(Boolean); agents = list.map((s) => s.toLowerCase()).includes("all") ? "ALL" : list; break; }
        }
        // Compliance subscribers get Mishari in the unified portal.
        if (!agents) {
          const c = await nq(COMPLIANCE_DB, { and: [{ property: "البريد", email: { equals: email } }, { property: "حالة الاشتراك", select: { equals: "نشط" } }] }, 1);
          if (c.length) agents = ["mishari"];
        }
        if (!agents) { res.statusCode = 200; return res.end(JSON.stringify({ ok: false, error: "no_subscription" })); }
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, url: "/ar/portal", seed: { bp_portal_email: email, bp_portal_sub: "1", bp_portal_agents: JSON.stringify(agents) } }));
      }
      if (portal === "employer") {
        const rows = await nq(EMP_DB, { and: [{ property: "البريد", email: { equals: email } }, { property: "الحالة", select: { equals: "مفعّل" } }] }, 1);
        const p = rows[0] && rows[0].properties;
        const code = p ? rtxt(p, "رمز الوصول") : "";
        if (!code) { res.statusCode = 200; return res.end(JSON.stringify({ ok: false, error: "no_subscription" })); }
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, url: "/employer-dashboard", seed: { bp_emp_code: code } }));
      }
      if (portal === "shared") {
        if (!OTP_SECRET) { res.statusCode = 200; return res.end(JSON.stringify({ ok: false, error: "no_subscription" })); }
        // SS access codes are the deterministic HMAC issued at approval time,
        // so the client's own code can be re-derived for auto-login. The SS
        // dashboard still validates it against n8n /ss-login as usual.
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, url: "/shared-services/dashboard", seed: { bp_ss_client_v1: JSON.stringify({ code: ssCode(email), email }) } }));
      }
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: "bad_portal" }));
    } catch {
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "notion_failed" }));
    }
  }

  // P4 — session-scoped operations data: notifications / tickets / documents /
  // approvals / tasks. One GET with ?what=…; org always derived from session.
  if ((q.action || "") === "my-ops") {
    res.setHeader("Cache-Control", "no-store");
    if (!DB_ON) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "db_not_configured" })); }
    let sess = null;
    try { sess = await getSession(req); } catch { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "db_failed" })); }
    if (!sess) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "unauthorized" })); }
    const orgId = sess.organization && sess.organization.id;
    if (!orgId) { res.statusCode = 200; return res.end(JSON.stringify({ ok: true, items: [] })); }
    const what = String(q.what || "");
    try {
      if (what === "notifications") {
        const items = await sb(`notifications?organization_id=eq.${orgId}&channel=eq.inapp&select=id,event,title,body,read_at,created_at&order=created_at.desc&limit=40`);
        const unread = items.filter((n) => !n.read_at).length;
        res.statusCode = 200; return res.end(JSON.stringify({ ok: true, items, unread }));
      }
      if (what === "tickets") {
        const items = await sb(`support_tickets?organization_id=eq.${orgId}&select=id,number,subject,category,priority,status,created_at,ticket_messages(author_kind,body,created_at)&order=created_at.desc&limit=30`);
        res.statusCode = 200; return res.end(JSON.stringify({ ok: true, items }));
      }
      if (what === "documents") {
        // The read-out columns are a later migration; fall back to the older
        // shape on a database that has not run it yet.
        let items;
        try {
          items = await sb(`documents?organization_id=eq.${orgId}&select=id,category,title,expiry_date,issue_date,extracted,verify_status,created_at,document_versions(id,version_no,file_name,storage_key,uploaded_at)&order=created_at.desc&limit=60`);
        } catch {
          items = await sb(`documents?organization_id=eq.${orgId}&select=id,category,title,expiry_date,verify_status,created_at,document_versions(id,version_no,file_name,storage_key,uploaded_at)&order=created_at.desc&limit=60`);
        }
        res.statusCode = 200; return res.end(JSON.stringify({ ok: true, items }));
      }
      if (what === "doc-link") {
        // Signed, short-lived download URL for one of the org's own versions.
        const vid = String(q.version || "");
        const vs = await sb(`document_versions?id=eq.${vid}&select=storage_key,documents!inner(organization_id)&limit=1`);
        const v = vs[0];
        if (!v || !v.documents || v.documents.organization_id !== orgId) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: "not_found" })); }
        const url = await storageSign(v.storage_key, 600);
        await audit({ organization_id: orgId, actor_user_id: sess.user && sess.user.id, action: "document.downloaded", entity_type: "document_version", entity_id: vid });
        res.statusCode = 200; return res.end(JSON.stringify({ ok: true, url }));
      }
      if (what === "approvals") {
        const items = await sb(`approvals?organization_id=eq.${orgId}&select=id,action_type,title,amount,target_entity,risk_note,deadline,status,decision_comment,created_at&order=created_at.desc&limit=30`);
        res.statusCode = 200; return res.end(JSON.stringify({ ok: true, items }));
      }
      if (what === "tasks") {
        const items = await sb(`tasks?organization_id=eq.${orgId}&select=id,title,details,assignee,status,urgency,due_at,created_at,completed_at,source&order=created_at.desc&limit=80`);
        res.statusCode = 200; return res.end(JSON.stringify({ ok: true, items }));
      }
      if (what === "violations") {
        const items = await sb(`violations?organization_id=eq.${orgId}&select=id,authority,violation_number,title,amount,violation_date,objection_deadline,status,objection_note,objection_filed_at,created_at&order=created_at.desc&limit=60`);
        res.statusCode = 200; return res.end(JSON.stringify({ ok: true, items }));
      }
      if (what === "compliance-access") {
        // الامتثال متاح لكل حساب مسجّل: المشترك النشط بلا حدود، وغيره تجربة
        // مجانية 30 يوماً تبدأ من إنشاء حساب الشركة.
        let active = false;
        const accEmail = (sess.user && sess.user.email) || "";
        if (NOTION_TOKEN && accEmail) {
          try {
            const r = await fetch(`https://api.notion.com/v1/databases/${COMPLIANCE_DB}/query`, {
              method: "POST",
              headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
              body: JSON.stringify({ page_size: 1, filter: { and: [{ property: "البريد", email: { equals: accEmail } }, { property: "حالة الاشتراك", select: { equals: "نشط" } }] } }),
            });
            if (r.ok) active = ((await r.json()).results || []).length > 0;
          } catch {}
        }
        // Open policy / owner: always active, never a countdown.
        if (openFor(sess)) active = true;
        let daysLeft = 0, endsAt = null;
        if (!active) {
          const orgs = await sb(`organizations?id=eq.${orgId}&select=created_at&limit=1`);
          const created = orgs[0] && orgs[0].created_at ? new Date(orgs[0].created_at).getTime() : Date.now();
          const ends = created + 30 * 86400000;
          endsAt = new Date(ends).toISOString().slice(0, 10);
          daysLeft = Math.max(0, Math.ceil((ends - Date.now()) / 86400000));
        }
        res.statusCode = 200; return res.end(JSON.stringify({ ok: true, active, trial: !active, days_left: daysLeft, ends_at: endsAt }));
      }
      res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "bad_what" }));
    } catch {
      res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "db_failed" }));
    }
  }

  // /admin panel — read an editable content file (site/data/*.json) from GitHub.
  if ((q.action || "") === "panel-content") {
    res.setHeader("Cache-Control", "no-store");
    if (!panelOk(q)) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "unauthorized" })); }
    const filePath = CONTENT_FILES[q.file || ""];
    if (!filePath) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "bad_file" })); }
    if (!GH_TOKEN) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "content_not_configured" })); }
    try {
      const f = await ghGetFile(filePath);
      if (!f) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: "file_not_found" })); }
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, file: q.file, path: filePath, branch: CONTENT_BRANCH, sha: f.sha, content: f.content }));
    } catch {
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "github_failed" }));
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
      // What the partner executing the work has reported, for these refs only.
      // Best-effort: a client's status must not fail because a journey lookup did.
      let journey = {}, quotes = {};
      try { journey = await progressForClientRefs(remaining); } catch { journey = {}; }
      // Quotes awaiting this client's decision, so the portal can show them
      // instead of the client having to find an email to act on their own order.
      try { quotes = await quotesForClientRefs(remaining); } catch { quotes = {}; }
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, statuses, agents, emails, demo, trial, journey, quotes }));
    }
    res.statusCode = 200;
    return res.end(JSON.stringify({ status: "ok", emailConfigured: !!RESEND_API_KEY }));
  }
  if (req.method !== "POST") { res.statusCode = 405; return res.end(JSON.stringify({ error: "method_not_allowed" })); }

  const b = await readBody(req);

  // ---- P4: client operations actions (session cookie, POST) ----
  if (String(b.action || "").startsWith("ops-")) {
    res.setHeader("Cache-Control", "no-store");
    if (!DB_ON) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "db_not_configured" })); }
    let sess = null;
    try { sess = await getSession(req); } catch { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "db_failed" })); }
    if (!sess) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "unauthorized" })); }
    const orgId = sess.organization && sess.organization.id;
    const userId = sess.user && sess.user.id;
    const email = (sess.user && sess.user.email) || "";
    if (!orgId) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "no_org" })); }
    try {
      if (b.action === "ops-notif-read") {
        await sb(`notifications?organization_id=eq.${orgId}&read_at=is.null`, { method: "PATCH", prefer: "return=minimal", body: { read_at: new Date().toISOString() } });
        res.statusCode = 200; return res.end(JSON.stringify({ ok: true }));
      }
      if (b.action === "ops-ticket-create") {
        const subject = String(b.subject || "").trim().slice(0, 200);
        const bodyTxt = String(b.body || "").trim().slice(0, 4000);
        const category = String(b.category || "عام").slice(0, 60);
        if (!subject || !bodyTxt) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
        const number = "BP-TKT-" + String(crypto.randomInt(0, 1000000)).padStart(6, "0");
        const tk = await sb("support_tickets", { method: "POST", body: [{ number, organization_id: orgId, portal_source: "account", category, subject, status: "new", opened_by: userId }] });
        await sb("ticket_messages", { method: "POST", prefer: "return=minimal", body: [{ ticket_id: tk[0].id, author_kind: "client", author_user_id: userId, body: bodyTxt }] });
        await notify({ organization_id: orgId, event: "ticket_opened", channel: "inapp", title: `فُتحت تذكرتك ${number} — سنرد عليك قريباً`, idempotency_key: `ticket_opened:${number}` });
        await sendEmail(TEAM_EMAIL, `تذكرة دعم جديدة ${number} — ${subject}`, `<div dir="rtl" style="font-family:Arial"><h3 style="color:#0B1B5A">${esc(number)}</h3><p><b>العميل:</b> ${esc(email)}</p><p><b>الموضوع:</b> ${esc(subject)}</p><p>${esc(bodyTxt)}</p><p>الرد: من لوحة /admin (قسم التذاكر) أو بالبريد مباشرة.</p></div>`);
        await audit({ organization_id: orgId, actor_user_id: userId, action: "ticket.created", entity_type: "support_ticket", entity_id: tk[0].id });
        res.statusCode = 200; return res.end(JSON.stringify({ ok: true, number }));
      }
      if (b.action === "ops-ticket-reply") {
        const tid = String(b.ticketId || "");
        const bodyTxt = String(b.body || "").trim().slice(0, 4000);
        if (!tid || !bodyTxt) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
        const tks = await sb(`support_tickets?id=eq.${tid}&organization_id=eq.${orgId}&select=id,number,subject&limit=1`);
        if (!tks.length) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: "not_found" })); }
        await sb("ticket_messages", { method: "POST", prefer: "return=minimal", body: [{ ticket_id: tid, author_kind: "client", author_user_id: userId, body: bodyTxt }] });
        await sb(`support_tickets?id=eq.${tid}`, { method: "PATCH", prefer: "return=minimal", body: { status: "waiting_bp" } });
        await sendEmail(TEAM_EMAIL, `رد عميل على ${tks[0].number} — ${tks[0].subject}`, `<div dir="rtl" style="font-family:Arial"><p><b>${esc(email)}:</b></p><p>${esc(bodyTxt)}</p></div>`);
        res.statusCode = 200; return res.end(JSON.stringify({ ok: true }));
      }
      if (b.action === "ops-doc-upload") {
        const category = String(b.category || "other").slice(0, 40);
        const title = String(b.title || "").trim().slice(0, 200);
        const fileName = String(b.fileName || "document.pdf").slice(0, 120);
        const base64 = typeof b.base64 === "string" ? b.base64.slice(0, 11_000_000) : "";
        const mime = /^(application\/pdf|image\/(jpeg|png|webp)|application\/vnd\.openxmlformats-officedocument\.(spreadsheetml\.sheet|wordprocessingml\.document)|application\/vnd\.ms-excel)$/.test(String(b.mime)) ? b.mime : "application/pdf";
        const expiry = /^\d{4}-\d{2}-\d{2}$/.test(String(b.expiry || "")) ? b.expiry : null;
        if (!title || !base64) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
        const buf = Buffer.from(base64, "base64");
        if (buf.length > 8 * 1024 * 1024) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "too_large" })); }
        // versioning: reuse the doc row per (category,title); versions append
        const existing = await sb(`documents?organization_id=eq.${orgId}&category=eq.${encodeURIComponent(category)}&title=eq.${encodeURIComponent(title)}&select=id&limit=1`);
        let docId;
        if (existing.length) docId = existing[0].id;
        else {
          const d = await sb("documents", { method: "POST", body: [{ organization_id: orgId, category, title, expiry_date: expiry, verify_status: "pending" }] });
          docId = d[0].id;
        }
        const vers = await sb(`document_versions?document_id=eq.${docId}&select=version_no&order=version_no.desc&limit=1`);
        const vno = vers.length ? vers[0].version_no + 1 : 1;
        const key = `${orgId}/${docId}/v${vno}-${Date.now()}-${fileName.replace(/[^\w.\-]+/g, "_")}`;
        await storagePut(key, buf, mime);
        const vrow = await sb("document_versions", { method: "POST", body: [{ document_id: docId, version_no: vno, storage_key: key, file_name: fileName, mime, size_bytes: buf.length, sha256: crypto.createHash("sha256").update(buf).digest("hex"), malware_scan: "skipped", uploaded_by: userId }] });
        // The extraction agent reads the document the moment it lands: type,
        // entity, numbers, and the issue/expiry dates — so the client never
        // types what their own papers already say. Best-effort: a provider
        // hiccup stores the file exactly as before, just unread.
        let extracted = null;
        if (DOC_MIME_OK.test(mime) && buf.length <= MAX_DOC_BYTES) {
          try {
            const read = await readDocument(base64, mime);
            if (read.ok) extracted = read.fields;
          } catch (e) { console.error("doc-upload extract", String(e.message || e).slice(0, 120)); }
        }
        const effectiveExpiry = expiry || (extracted && extracted.expiryDate) || null;
        const basePatch = { current_version_id: vrow[0].id, ...(effectiveExpiry ? { expiry_date: effectiveExpiry } : {}), verify_status: extracted ? "verified" : "pending" };
        // The extracted/issue_date columns are a later migration; a database
        // that has not run it yet gets the patch without them, never an error.
        try {
          await sb(`documents?id=eq.${docId}`, { method: "PATCH", prefer: "return=minimal", body: { ...basePatch, ...(extracted ? { extracted, ...(extracted.issueDate ? { issue_date: extracted.issueDate } : {}) } : {}) } });
        } catch {
          await sb(`documents?id=eq.${docId}`, { method: "PATCH", prefer: "return=minimal", body: basePatch });
        }
        await notify({ organization_id: orgId, event: "document_uploaded", channel: "inapp", title: extracted ? `رُفع المستند «${title}» (نسخة ${vno}) وقُرئ آلياً ✓` : `رُفع المستند «${title}» (نسخة ${vno}) — قيد التحقق`, idempotency_key: `doc_up:${docId}:${vno}` });
        await audit({ organization_id: orgId, actor_user_id: userId, action: "document.uploaded", entity_type: "document", entity_id: docId, after: { version: vno, file: fileName, read: !!extracted } });
        res.statusCode = 200; return res.end(JSON.stringify({ ok: true, documentId: docId, version: vno, ...(extracted ? { extracted } : {}) }));
      }
      if (b.action === "ops-doc-delete") {
        // Delete one of the org's own documents: vault objects, versions, row.
        const did = String(b.id || "").trim();
        if (!did) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
        const rows = await sb(`documents?id=eq.${encodeURIComponent(did)}&organization_id=eq.${orgId}&select=id,title,document_versions(id,storage_key)&limit=1`);
        const doc = rows[0];
        if (!doc) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: "not_found" })); }
        // current_version_id points into document_versions; clear it first so
        // the version rows can go. Older schemas without the column just skip.
        try { await sb(`documents?id=eq.${did}`, { method: "PATCH", prefer: "return=minimal", body: { current_version_id: null } }); } catch {}
        for (const v of doc.document_versions || []) { if (v.storage_key) { try { await storageDelete(v.storage_key); } catch {} } }
        await sb(`document_versions?document_id=eq.${did}`, { method: "DELETE", prefer: "return=minimal" });
        await sb(`documents?id=eq.${did}`, { method: "DELETE", prefer: "return=minimal" });
        await notify({ organization_id: orgId, event: "document_deleted", channel: "inapp", title: `حُذف المستند «${doc.title || ""}» من خزنة مستنداتك`, idempotency_key: `doc_del:${did}` });
        await audit({ organization_id: orgId, actor_user_id: userId, action: "document.deleted", entity_type: "document", entity_id: did, after: { title: doc.title || "" } });
        res.statusCode = 200; return res.end(JSON.stringify({ ok: true }));
      }
      if (b.action === "ops-approval-decide") {
        const aid = String(b.id || "");
        const decision = b.decision === "approved" ? "approved" : "rejected";
        const comment = String(b.comment || "").trim().slice(0, 500);
        if (!aid || (decision === "rejected" && !comment)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "comment_required" })); }
        const rows = await sb(`approvals?id=eq.${aid}&organization_id=eq.${orgId}&status=eq.pending&select=id,title,target_entity&limit=1`);
        if (!rows.length) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: "not_found" })); }
        // An approval that only records itself is a second inbox, not a gate.
        // When it points at a quote, approving it IS accepting the quote:
        // the order moves, the contract goes out, the client is told.
        let acted = null;
        const target = String(rows[0].target_entity || "");
        if (target.startsWith("quote:")) {
          const [, quoteId, token] = target.split(":");
          try {
            const r = await decideQuote({ id: quoteId, t: token, decision: decision === "approved" ? "accept" : "decline", note: comment });
            acted = r.error ? { ok: false, error: r.error } : { ok: true, decision: r.decision, contract: r.contract };
          } catch (e) { acted = { ok: false, error: String(e.message || "quote_failed").slice(0, 80) }; }
          // A quote the portal could not act on must not be marked decided —
          // otherwise the client sees "approved" and nothing ever happens.
          if (acted && !acted.ok && acted.error !== "already_decided") {
            res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: acted.error }));
          }
        }
        await sb(`approvals?id=eq.${aid}`, { method: "PATCH", prefer: "return=minimal", body: { status: decision, decided_by: userId, decided_at: new Date().toISOString(), decision_comment: comment || null } });
        await audit({ organization_id: orgId, actor_user_id: userId, action: `approval.${decision}`, entity_type: "approval", entity_id: aid, after: { comment } });
        await sendEmail(TEAM_EMAIL, `قرار العميل: ${decision === "approved" ? "موافقة ✅" : "رفض ❌"} — ${rows[0].title}`, `<div dir="rtl" style="font-family:Arial"><p><b>${esc(email)}</b> ${decision === "approved" ? "وافق على" : "رفض"}: ${esc(rows[0].title)}</p>${comment ? `<p>التعليق: ${esc(comment)}</p>` : ""}</div>`);
        res.statusCode = 200; return res.end(JSON.stringify({ ok: true, acted }));
      }
      if (b.action === "ops-task-done") {
        const tid = String(b.id || "");
        await sb(`tasks?id=eq.${tid}&organization_id=eq.${orgId}&assignee=eq.client`, { method: "PATCH", prefer: "return=minimal", body: { status: "done", completed_at: new Date().toISOString() } });
        res.statusCode = 200; return res.end(JSON.stringify({ ok: true }));
      }
      // The client's own task list: they add what they need to do, tick it
      // off, and reopen it — their tasks, their control, alongside the ones
      // the platform derives from their orders.
      if (b.action === "ops-task-add") {
        const title = String(b.title || "").trim().slice(0, 200);
        if (!title) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
        const due = /^\d{4}-\d{2}-\d{2}$/.test(String(b.due || "")) ? b.due : null;
        const urgency = ["urgent", "soon", "normal"].includes(b.urgency) ? b.urgency : "normal";
        const rows = await sb("tasks", { method: "POST", body: [{ organization_id: orgId, title, details: String(b.details || "").trim().slice(0, 1000) || null, assignee: "client", status: "open", urgency, due_at: due, source: "manual" }] });
        await audit({ organization_id: orgId, actor_user_id: userId, action: "task.created", entity_type: "task", entity_id: rows[0] && rows[0].id });
        res.statusCode = 200; return res.end(JSON.stringify({ ok: true, task: rows[0] || null }));
      }
      if (b.action === "ops-task-reopen") {
        const tid = String(b.id || "");
        await sb(`tasks?id=eq.${tid}&organization_id=eq.${orgId}&assignee=eq.client`, { method: "PATCH", prefer: "return=minimal", body: { status: "open", completed_at: null } });
        res.statusCode = 200; return res.end(JSON.stringify({ ok: true }));
      }
      if (b.action === "ops-task-delete") {
        const tid = String(b.id || "");
        await sb(`tasks?id=eq.${tid}&organization_id=eq.${orgId}&assignee=eq.client&source=eq.manual`, { method: "DELETE", prefer: "return=minimal" });
        res.statusCode = 200; return res.end(JSON.stringify({ ok: true }));
      }
      // Shared Services free trial — every registered client gets SS_TRIAL_DAYS
      // days from the moment their organization was created, with no purchase
      // and nothing to activate. Derived from organizations.created_at so there
      // is no extra state to provision, migrate or keep in sync.
      if (b.action === "ops-ss-trial") {
        const orgs = await sb(`organizations?id=eq.${orgId}&select=id,name_ar,name_en,created_at&limit=1`);
        const org = orgs[0] || null;
        if (!org) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: "not_found" })); }
        const started = new Date(org.created_at || Date.now());
        const ends = new Date(started.getTime() + SS_TRIAL_DAYS * 86400000);
        const msLeft = ends.getTime() - Date.now();
        const daysLeft = Math.max(0, Math.ceil(msLeft / 86400000));
        const open = openFor(sess);
        res.statusCode = 200;
        return res.end(JSON.stringify({
          ok: true,
          name: org.name_ar || org.name_en || "",
          startedAt: started.toISOString(),
          endsAt: ends.toISOString(),
          daysLeft: open ? null : daysLeft,
          active: open || msLeft > 0,
          open,
          totalDays: SS_TRIAL_DAYS,
        }));
      }
      // ---- Business Development profile: the input side of matchmaking ----
      // What the client sells, who they want to sell it to, and their company
      // profile document. Sectors and cities are stored as the exact values the
      // companies database filters on — see api/_bdprofile.js for why storing
      // the Arabic label instead would silently match nothing.
      if (b.action === "ops-bd-profile") {
        const rows = await sb(`bd_profiles?organization_id=eq.${orgId}&limit=1`).catch(() => []);
        const r = rows[0] || null;
        res.statusCode = 200;
        return res.end(JSON.stringify({
          ok: true,
          sectors: BD_SECTORS, cities: BD_CITIES,
          profile: r ? {
            servicesText: r.services_text || "",
            idealCustomer: r.ideal_customer || "",
            targetSectors: r.target_sectors || [],
            targetCities: r.target_cities || [],
            profileName: r.profile_name || "",
            hasProfile: !!r.profile_path,
            extracted: r.extracted || null,
            completeness: r.completeness || 0,
          } : null,
        }));
      }
      // ---- Matchmaking: the profile against the companies database ----
      // Open to anyone the server already lets into the workspace: the open
      // policy, the owner, a live trial or a paid plan. The query is built from
      // the stored profile only — never from the request body — so a client
      // cannot widen their own match into a database dump.
      if (b.action === "ops-bd-matches" || b.action === "ops-bd-reveal") {
        const trial = bdTrial(sess.organization, false);
        const allowed = openFor(sess) || trial.state === "trial" || trial.state === "subscribed";
        if (!allowed) { res.statusCode = 402; return res.end(JSON.stringify({ ok: false, error: "not_open", trial })); }
        if (!NOTION_TOKEN) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "not_configured" })); }
        const rows = await sb(`bd_profiles?organization_id=eq.${orgId}&select=target_sectors,target_cities&limit=1`).catch(() => []);
        const prof = rows[0] ? { targetSectors: rows[0].target_sectors || [], targetCities: rows[0].target_cities || [] } : { targetSectors: [], targetCities: [] };
        const labels = { sector: sectorLabel, city: cityLabel };

        if (b.action === "ops-bd-reveal") {
          // One company, on request, and it leaves a trace: who revealed what.
          const pageId = String(b.id || "").replace(/[^0-9a-f-]/gi, "").slice(0, 40);
          if (!pageId) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "bad_id" })); }
          const r = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
            headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION },
          });
          if (!r.ok) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: "not_found" })); }
          const page = await r.json();
          const row = bdMapCompany(page, true);
          // A page the client's own filter would not have returned is not theirs
          // to reveal, whatever id they typed.
          if (!(prof.targetSectors || []).includes(row.sector)) { res.statusCode = 403; return res.end(JSON.stringify({ ok: false, error: "not_matched" })); }
          await audit({ organization_id: orgId, actor_user_id: userId, action: "bd_match.reveal", entity_type: "company", entity_id: pageId });
          res.statusCode = 200;
          return res.end(JSON.stringify({ ok: true, company: row }));
        }

        const query = bdMatchQuery(prof, b.cursor);
        if (!query) { res.statusCode = 200; return res.end(JSON.stringify({ ok: true, ready: false, companies: [], profile: prof })); }
        const r = await fetch(`https://api.notion.com/v1/databases/${BD_LEADS_DB}/query`, {
          method: "POST",
          headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
          body: JSON.stringify(query),
        });
        if (!r.ok) { console.error("bd matches query error", r.status, (await r.text()).slice(0, 300)); res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_failed" })); }
        const data = await r.json();
        const companies = (data.results || []).map((p) => bdMapCompany(p)).filter((c) => c.name)
          .map((c) => ({ ...c, why: bdExplainMatch(c, prof, labels) }));
        res.statusCode = 200;
        return res.end(JSON.stringify({
          ok: true, ready: true, companies, profile: prof,
          sectors: (prof.targetSectors || []).map(sectorLabel), cities: (prof.targetCities || []).map(cityLabel),
          next_cursor: data.next_cursor || "", has_more: !!data.has_more,
        }));
      }
      if (b.action === "ops-bd-profile-save") {
        const p = normalizeProfile(b);
        // An uploaded company profile is read once, here, and what the reader
        // finds is folded in without overwriting anything the client typed.
        let profilePath = null, profileName = null, profileBytes = null, extracted = null;
        if (b.fileBase64 && b.fileName) {
          const mime = String(b.fileMime || "").toLowerCase();
          if (!DOC_MIME_OK.test(mime)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "bad_type" })); }
          let buf;
          try { buf = Buffer.from(String(b.fileBase64), "base64"); } catch { buf = null; }
          if (!buf || !buf.length) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "bad_file" })); }
          if (buf.length > MAX_DOC_BYTES) { res.statusCode = 413; return res.end(JSON.stringify({ ok: false, error: "too_large" })); }
          profileName = String(b.fileName).slice(0, 160);
          profileBytes = buf.length;
          profilePath = `bd-profiles/${orgId}/${Date.now()}-${profileName.replace(/[^\w.\-]+/g, "_")}`;
          await storagePut(profilePath, buf, mime);
          // Reading is best-effort: a profile that saved but could not be parsed
          // is still a profile, and losing the client's typing to a model
          // timeout would be the worse failure.
          try {
            const raw = await readDocumentRaw(String(b.fileBase64), mime, PROFILE_READ_PROMPT, 1200);
            extracted = parseJson(raw) || null;
          } catch (e) { console.error("bd profile read failed", String(e).slice(0, 200)); }
        }
        const merged = extracted ? mergeExtracted({ ...p, profilePath }, extracted) : { ...p, profilePath };
        const completeness = profileCompleteness(merged);
        const row = {
          organization_id: orgId,
          services_text: merged.servicesText || null,
          ideal_customer: merged.idealCustomer || null,
          target_sectors: merged.targetSectors || [],
          target_cities: merged.targetCities || [],
          extracted: extracted ? {
            services: merged.extractedServices || [],
            keywords: merged.extractedKeywords || [],
            suggestedSectors: merged.suggestedSectors || [],
          } : undefined,
          completeness,
          created_by: userId,
          updated_at: new Date().toISOString(),
        };
        if (profilePath) { row.profile_path = profilePath; row.profile_name = profileName; row.profile_bytes = profileBytes; }
        for (const k of Object.keys(row)) if (row[k] === undefined) delete row[k];
        // bd_profiles ships in db/schema.sql and has to be applied to Supabase
        // before this can store anything. Until it is, the generic handler below
        // would answer "try again" to a client who can retry forever without
        // anything changing — the fault is ours and unprompted retrying will
        // never fix it. Say that instead, and log it where the owner will see it.
        try {
          await sb("bd_profiles?on_conflict=organization_id", {
            method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: [row],
          });
        } catch (e) {
          const msg = String(e && e.message ? e.message : e);
          if (/bd_profiles/i.test(msg) && /(does not exist|relation|schema cache|42P01|PGRST205)/i.test(msg)) {
            console.error("bd_profiles table missing — apply db/schema.sql to Supabase");
            res.statusCode = 503;
            return res.end(JSON.stringify({ ok: false, error: "not_provisioned" }));
          }
          throw e;
        }
        // The owner asked to hear about this in the panel. Notify once, when the
        // profile first becomes usable for matching — not on every keystroke
        // save, and not while it is still too thin to match on.
        if (canMatch(merged)) {
          const existing = await sb(`bd_profiles?organization_id=eq.${orgId}&select=notified_at&limit=1`).catch(() => []);
          if (!(existing[0] && existing[0].notified_at)) {
            const org = (sess && sess.organization) || {};
            const who = org.name_ar || org.name_en || "منشأة";
            const secs = (merged.targetSectors || []).map(sectorLabel).join("، ");
            await notify({
              organization_id: orgId, event: "bd_profile_ready", channel: "inapp",
              title: `جاهز للمطابقة — ${who} يستهدف: ${secs}`,
              idempotency_key: `bd_profile:${orgId}`,
            });
            await sendEmail(TEAM_EMAIL, `🎯 ملف تطوير أعمال جديد — ${who}`,
              `<p><b>${esc(who)}</b> عبّأ ملف تطوير الأعمال وصار جاهزاً للمطابقة.</p>` +
              `<p><b>القطاعات المستهدفة:</b> ${esc(secs)}</p>` +
              `<p><b>المدن:</b> ${esc((merged.targetCities || []).map(cityLabel).join("، ") || "—")}</p>` +
              `<p><b>ماذا يبيع:</b> ${esc((merged.servicesText || "").slice(0, 600))}</p>` +
              `<p><b>البروفايل المرفق:</b> ${esc(profileName || "لم يُرفق")}</p>`);
            await sb(`bd_profiles?organization_id=eq.${orgId}`, {
              method: "PATCH", prefer: "return=minimal", body: { notified_at: new Date().toISOString() },
            }).catch(() => {});
          }
        }
        await audit({ organization_id: orgId, actor_user_id: userId, action: "bd_profile.saved", entity_type: "bd_profile", entity_id: orgId });
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, completeness, canMatch: canMatch(merged), extracted: row.extracted || null }));
      }
      if (b.action === "ops-violation-add") {
        const authority = String(b.authority || "").trim().slice(0, 80);
        const title = String(b.title || "").trim().slice(0, 300);
        const number = String(b.number || "").trim().slice(0, 80);
        const amount = Number(b.amount);
        const vdate = /^\d{4}-\d{2}-\d{2}$/.test(String(b.date || "")) ? b.date : null;
        const deadline = /^\d{4}-\d{2}-\d{2}$/.test(String(b.deadline || "")) ? b.deadline : null;
        if (!authority || !title) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
        const v = await sb("violations", { method: "POST", body: [{ organization_id: orgId, authority, violation_number: number || null, title, amount: isFinite(amount) && amount > 0 ? amount : null, violation_date: vdate, objection_deadline: deadline, created_by: userId }] });
        await notify({ organization_id: orgId, event: "violation_added", channel: "inapp", title: `سُجّلت مخالفة «${title}» — تقدر تقدّم اعتراضاً عليها من قسم الامتثال`, idempotency_key: `violation_add:${v[0].id}` });
        await audit({ organization_id: orgId, actor_user_id: userId, action: "violation.created", entity_type: "violation", entity_id: v[0].id });
        res.statusCode = 200; return res.end(JSON.stringify({ ok: true, id: v[0].id }));
      }
      if (b.action === "ops-violation-object") {
        const vid = String(b.id || "");
        const note = String(b.note || "").trim().slice(0, 2000);
        if (!vid || !note) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
        const rows = await sb(`violations?id=eq.${vid}&organization_id=eq.${orgId}&select=id,authority,title,violation_number,amount,status&limit=1`);
        if (!rows.length) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: "not_found" })); }
        if (rows[0].status === "قيد الاعتراض") { res.statusCode = 200; return res.end(JSON.stringify({ ok: true, already: true })); }
        // الاعتراض يتحول فوراً إلى مهمة تنفيذ عند فريق BP — لا محادثات جانبية.
        const t = await sb("tasks", { method: "POST", body: [{ organization_id: orgId, title: ("اعتراض على مخالفة: " + rows[0].title).slice(0, 200), details: `الجهة: ${rows[0].authority}${rows[0].violation_number ? " · رقم المخالفة: " + rows[0].violation_number : ""}${rows[0].amount ? " · المبلغ: " + rows[0].amount + " ريال" : ""}\nمبررات العميل: ${note}`, assignee: "bp", status: "open", urgency: "high" }] });
        await sb(`violations?id=eq.${vid}`, { method: "PATCH", prefer: "return=minimal", body: { status: "قيد الاعتراض", objection_note: note, objection_filed_at: new Date().toISOString(), objection_task_id: t[0].id, updated_at: new Date().toISOString() } });
        await notify({ organization_id: orgId, event: "objection_filed", channel: "inapp", title: `قُدّم اعتراضك على «${rows[0].title}» — فريق بيزنس بارتنر باشر المعالجة`, idempotency_key: `objection:${vid}` });
        await sendEmail(TEAM_EMAIL, `⚖️ اعتراض جديد على مخالفة — ${rows[0].authority}`, `<div dir="rtl" style="font-family:Arial"><h3 style="color:#0B1B5A">اعتراض على مخالفة</h3><p><b>العميل:</b> ${esc(email)}</p><p><b>الجهة:</b> ${esc(rows[0].authority)}</p><p><b>المخالفة:</b> ${esc(rows[0].title)}${rows[0].violation_number ? " (رقم " + esc(rows[0].violation_number) + ")" : ""}</p>${rows[0].amount ? `<p><b>المبلغ:</b> ${esc(String(rows[0].amount))} ريال</p>` : ""}<p><b>مبررات العميل:</b> ${esc(note)}</p><p>نفّذ الاعتراض لدى الجهة ثم حدّث حالة المخالفة من /admin.</p></div>`);
        await audit({ organization_id: orgId, actor_user_id: userId, action: "violation.objection_filed", entity_type: "violation", entity_id: vid });
        res.statusCode = 200; return res.end(JSON.stringify({ ok: true }));
      }
      res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "unknown_action" }));
    } catch (e) {
      console.error("ops action failed", b.action, String(e).slice(0, 200));
      res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "db_failed" }));
    }
  }

  // ---- /admin panel actions (owner key, POST) ----
  if (String(b.action || "").startsWith("panel-")) {
    res.setHeader("Cache-Control", "no-store");
    if (!panelOk(b)) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "unauthorized" })); }

    // «سي آر إم أكتف»: the متابعات اليوم rows in /admin write straight back to
    // the master pipeline — mark contacted, add a note, or snooze — so the
    // half-hour WhatsApp reminders stop the moment the work is actually done.
    // قيد مالي جديد — إيراد أو مصروف — يُكتب مباشرة في دفتر نوشن.
    if (b.action === "panel-finance-add") {
      if (!NOTION_TOKEN) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "crm_not_configured" })); }
      const kind = b.kind === "إيراد" ? "إيراد" : "مصروف";
      const amount = Math.abs(Number(b.amount) || 0);
      const title = String(b.title || "").trim().slice(0, 150);
      if (!amount || !title) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "bad_request" })); }
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(b.date || "")) ? String(b.date) : new Date().toISOString().slice(0, 10);
      const props = {
        "البيان": { title: [{ text: { content: title } }] },
        "النوع": { select: { name: kind } },
        "المبلغ": { number: amount },
        "التاريخ": { date: { start: date } },
      };
      if (b.cat) props["الفئة"] = { select: { name: String(b.cat).slice(0, 60) } };
      if (b.method) props["طريقة الدفع"] = { select: { name: String(b.method).slice(0, 40) } };
      if (b.ref) props["رقم المرجع"] = { rich_text: [{ text: { content: String(b.ref).slice(0, 80) } }] };
      if (b.note) props["ملاحظات"] = { rich_text: [{ text: { content: String(b.note).slice(0, 500) } }] };
      try {
        const r = await fetch("https://api.notion.com/v1/pages", {
          method: "POST",
          headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
          body: JSON.stringify({ parent: { database_id: FINANCE_DB }, properties: props }),
        });
        if (!r.ok) { console.error("finance add error", r.status, (await r.text()).slice(0, 200)); res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "finance_failed" })); }
        audit({ action: "finance.add", actor_label: "panel", after: { kind, amount, title: title.slice(0, 60) } }).catch(() => {});
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        console.error("finance add exception", String(e).slice(0, 150));
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, error: "finance_failed" }));
      }
    }

    if (b.action === "panel-followup-update") {
      if (!NOTION_TOKEN) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "crm_not_configured" })); }
      const pid = String(b.id || "").replace(/[^a-fA-F0-9-]/g, "").slice(0, 40);
      if (!pid) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "bad_request" })); }
      const today = new Date().toISOString().slice(0, 10);
      const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
      const props = { "Last Activity": { date: { start: today } } };
      let line = "";
      if (b.done) {
        const days = Number(b.followupDays) > 0 ? Math.min(Number(b.followupDays), 60) : 3;
        props["Human Required"] = { checkbox: false };
        props["Next Follow Up"] = { date: { start: plusDaysISO(days) } };
        line = `✅ تم التواصل (${stamp} UTC)`;
      }
      const snooze = Number(b.snoozeDays);
      if (!b.done && snooze > 0) {
        props["Next Follow Up"] = { date: { start: plusDaysISO(Math.min(snooze, 60)) } };
        line = `⏰ تأجيل المتابعة إلى ${plusDaysISO(Math.min(snooze, 60))} (${stamp} UTC)`;
      }
      const noteTxt = String(b.note || "").trim().slice(0, 800);
      if (noteTxt) line = (line ? line + " — " : `📝 ملاحظة (${stamp} UTC): `) + noteTxt;
      try {
        if (line) {
          const pg = await fetch(`https://api.notion.com/v1/pages/${pid}`, { headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION } });
          if (pg.ok) {
            const pj = await pg.json();
            const existing = (((pj.properties || {}).Notes || {}).rich_text || []).map((t) => t.plain_text || "").join("");
            props["Notes"] = { rich_text: richChunks((existing + "\n" + line).slice(-6000)) };
          }
        }
        const r = await fetch(`https://api.notion.com/v1/pages/${pid}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
          body: JSON.stringify({ properties: props }),
        });
        if (!r.ok) { console.error("followup update error", r.status, (await r.text()).slice(0, 200)); res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "crm_failed" })); }
        audit({ action: "crm.followup_update", actor_label: "panel", after: { pid, done: !!b.done, snooze: snooze > 0 ? snooze : null } }).catch(() => {});
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        console.error("followup update exception", String(e).slice(0, 150));
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, error: "crm_failed" }));
      }
    }

    // Direct-contact clients (a phone call, a walk-in) get a real record with
    // a generated reference — typed like every other channel so classification
    // and follow-up treat them identically. Lead Source = «إدخال يدوي».
    if (b.action === "panel-manual-lead") {
      const name = String(b.name || "").trim().slice(0, 120);
      const phone = String(b.phone || "").trim().slice(0, 40);
      const email = String(b.email || "").trim().toLowerCase().slice(0, 160);
      const kind = ["ticket", "consult", "order"].includes(b.kind) ? b.kind : "ticket";
      const subject = String(b.subject || "").trim().slice(0, 200);
      const note = String(b.note || "").trim().slice(0, 1200);
      const total = Number(b.total);
      if (!name || (!phone && !isEmail(email)) || !subject) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
      const prefix = kind === "consult" ? "BC" : kind === "order" ? "BP" : "BPT";
      const ref = `${prefix}-${Date.now().toString().slice(-6)}`;
      const orderStatus = kind === "consult" ? "حجز استشارة" : kind === "order" ? "قيد المراجعة" : "تذكرة دعم";
      const icon = kind === "consult" ? "📅" : kind === "order" ? "🛒" : "🎫";
      try {
        await crmLead({
          title: `${icon} ${subject} — ${name}`,
          phone, email,
          notes: `قناة: إدخال يدوي (اتصال مباشر)${note ? " · " + note : ""}`,
          ref, orderStatus,
          total: Number.isFinite(total) && total > 0 ? total : undefined,
          leadSource: "إدخال يدوي",
        });
        audit({ action: "crm.manual_lead", actor_label: "panel", after: { ref, kind } }).catch(() => {});
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, ref }));
      } catch (e) {
        console.error("manual lead exception", String(e).slice(0, 150));
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, error: "crm_failed" }));
      }
    }

    // One edit from the in-panel Notion viewer: a single property on a single
    // page. The page must belong to a whitelisted database — verified against
    // its parent, so a leaked page id from elsewhere cannot be written to.
    if (b.action === "panel-notion-update") {
      if (!NOTION_TOKEN) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "crm_not_configured" })); }
      const src = NOTION_PANEL_DBS[String(b.db || "")];
      const pid = String(b.id || "").replace(/[^a-fA-F0-9-]/g, "").slice(0, 40);
      const prop = String(b.prop || "").slice(0, 80);
      const type = String(b.type || "");
      if (!src || !pid || !prop) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "bad_request" })); }
      const hdrs = { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" };
      try {
        const pgRes = await fetch(`https://api.notion.com/v1/pages/${pid}`, { headers: hdrs });
        if (!pgRes.ok) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: "page_not_found" })); }
        const pj = await pgRes.json();
        const parent = String((pj.parent && pj.parent.database_id) || "").replace(/-/g, "");
        if (parent !== String(src.id).replace(/-/g, "")) { res.statusCode = 403; return res.end(JSON.stringify({ ok: false, error: "wrong_db" })); }
        const raw = b.value == null ? "" : String(b.value).slice(0, 1900);
        let value;
        if (type === "select") value = raw ? { select: { name: raw } } : { select: null };
        else if (type === "status") value = raw ? { status: { name: raw } } : { status: null };
        else if (type === "checkbox") value = { checkbox: raw === "true" || raw === "1" };
        else if (type === "date") value = raw ? { date: { start: raw } } : { date: null };
        else if (type === "number") value = { number: raw === "" ? null : Number(raw) };
        else if (type === "email") value = { email: raw || null };
        else if (type === "phone_number") value = { phone_number: raw || null };
        else if (type === "url") value = { url: raw || null };
        else if (type === "rich_text") value = { rich_text: richChunks(raw) };
        else if (type === "title") value = { title: [{ text: { content: raw.slice(0, 200) } }] };
        else { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "bad_type" })); }
        const r = await fetch(`https://api.notion.com/v1/pages/${pid}`, { method: "PATCH", headers: hdrs, body: JSON.stringify({ properties: { [prop]: value } }) });
        if (!r.ok) { console.error("notion update error", r.status, (await r.text()).slice(0, 200)); res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_rejected" })); }
        audit({ action: "crm.notion_edit", actor_label: "panel", after: { db: String(b.db || ""), pid, prop, type } }).catch(() => {});
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        console.error("notion update exception", String(e).slice(0, 150));
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, error: "crm_failed" }));
      }
    }

    // Change a CRM lead's حالة الطلب (approve / complete / cancel …).
    if (b.action === "panel-status") {
      const ref = String(b.ref || "").trim();
      const status = String(b.status || "").trim();
      if (!ref || !PANEL_STATUSES.has(status)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "bad_request" })); }
      try {
        await setLeadStatus(ref, status);
        // Confirming a bank transfer is a payment like any other, so it says
        // the same thing to the client as the gateway does — and starts the
        // work order rather than leaving it parked on "بانتظار الدفع".
        let announced = null;
        if (status === "مؤكد - قيد التنفيذ") {
          try { announced = await markOrderPaid(ref, { method: "bank", total: b.total == null ? null : Number(b.total) }); }
          catch (e2) { console.error("panel-status announce failed", String(e2.message || e2).slice(0, 160)); }
        }
        res.statusCode = 200;
        // Flipping a status is not issuing an invoice, and an agent who does
        // only this leaves a paid client without a tax invoice. Say so here
        // rather than letting the silence read as "done".
        return res.end(JSON.stringify({ ok: true, ...(announced ? { announced } : {}),
          ...(status === "مؤكد - قيد التنفيذ" ? { invoiceIssued: false, hint: "لم تصدر فاتورة بهذا الإجراء — للتحويل البنكي استخدم «تأكيد تحويل بنكي» ليصدر المستند." } : {}) }));
      } catch (e) {
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, error: String(e.message || "failed") }));
      }
    }

    // Write a note to the client: it reaches their inbox, shows up in their
    // portal notifications, and stays on the order's record in the CRM.
    if (b.action === "panel-note") {
      const ref = String(b.ref || "").trim();
      const note = String(b.note || "").trim().slice(0, 1500);
      const newStatus = String(b.status || "").trim();
      if (!ref || !note) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "bad_request" })); }
      if (newStatus && !PANEL_STATUSES.has(newStatus)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "bad_status" })); }
      try {
        const pg = await findLeadByRef(ref);
        if (!pg) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: "ref_not_found" })); }
        const d = leadContact(pg);
        const emailed = isEmail(d.email)
          ? await sendEmail(d.email, `تحديث على طلبك ${ref} — Business Partner`,
              `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430"><h2 style="color:#0B1B5A">تحديث على طلبك ${esc(ref)}</h2>` +
              `<p>${esc(note).replace(/\n/g, "<br>")}</p>` +
              `<table>${row("رقم المرجع", ref) + row("الحالة", newStatus || d.status)}</table>` +
              `<p>تابع طلبك في لوحتك: <a href="${MKT_SITE_BASE}/ar/account" style="color:#0B1B5A">${MKT_SITE_BASE}/ar/account</a></p>` +
              `<p style="color:#0B1B5A">بزنس بارتنر</p></div>`)
          : { ok: false };
        // in-app notification when the client has an operational account
        let notified = false;
        if (DB_ON && isEmail(d.email)) {
          try {
            const users = await sb(`users?email=eq.${encodeURIComponent(d.email)}&select=id&limit=1`);
            if (users.length) {
              const mem = await sb(`organization_members?user_id=eq.${users[0].id}&status=eq.active&select=organization_id&limit=1`);
              if (mem.length) {
                await notify({ organization_id: mem[0].organization_id, event: "order_note", channel: "inapp",
                  title: `تحديث على طلبك ${ref}: ${note.slice(0, 120)}`,
                  idempotency_key: `order_note:${ref}:${Date.now()}` });
                notified = true;
              }
            }
          } catch (e) { console.error("note notify failed", String(e).slice(0, 120)); }
        }
        await appendLeadNote(pg, `ملاحظة للعميل: ${note}`);
        if (newStatus && newStatus !== d.status) { try { await setLeadStatus(ref, newStatus); } catch (e) { console.error("note status failed", String(e).slice(0, 120)); } }
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, emailed: !!(emailed && emailed.ok), notified, to: d.email || null }));
      } catch (e) {
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, error: String(e.message || "failed") }));
      }
    }

    // Activate a subscription and email the client their access code —
    // same flows as the emailed approval links, driven from the panel.
    if (b.action === "panel-activate") {
      const kind = String(b.kind || "");
      const email = String(b.email || "").trim();
      const company = String(b.company || "").trim();
      if (!isEmail(email)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "bad_email" })); }
      if ((kind === "compliance" || kind === "employer") && !company) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "bad_company" })); }
      try {
        let code = null;
        if (kind === "shared") {
          if (!OTP_SECRET) throw new Error("not_configured");
          code = await approveShared({ email, name: String(b.name || ""), phone: String(b.phone || ""), ref: String(b.ref || "") });
        } else if (kind === "compliance") {
          code = await approveCompliance({ company, email, phone: String(b.phone || "") });
        } else if (kind === "employer") {
          code = await approveEmployer({ company, email, phone: String(b.phone || ""), plan: String(b.plan || "") });
        } else if (kind === "service") {
          code = await approveService({
            service: String(b.service || ""), company, email,
            phone: String(b.phone || ""), ref: String(b.ref || ""), note: String(b.note || ""),
          });
        } else {
          res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "bad_kind" }));
        }
        if (!code) { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "activation_failed" })); }
        // Best-effort: reflect the approval on the originating lead too.
        if (b.ref) { try { await setLeadStatus(String(b.ref).trim(), "مؤكد - قيد التنفيذ"); } catch {} }
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, code }));
      } catch (e) {
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, error: String(e.message || "failed") }));
      }
    }

    // ---- Daftra (الدفترة): real accounting invoices ----
    // Connection check. Returns the field names Daftra actually sent back so a
    // mismatch is visible in the panel instead of only in the server log.
    if (b.action === "panel-daftra-ping") {
      const out = await daftraPing();
      res.statusCode = out.ok ? 200 : 502;
      return res.end(JSON.stringify(out));
    }

    // Dump one existing invoice from the account verbatim. Daftra rejects our
    // payload without naming a field, so the shape of an invoice it already
    // accepted is the only reliable specification available.
    if (b.action === "panel-daftra-inspect") {
      try {
        const out = await daftraInspectInvoice();
        res.statusCode = out.ok ? 200 : 502;
        return res.end(JSON.stringify(out));
      } catch (e) {
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, error: String(e.message || "failed"), detail: String(e.detail || "").slice(0, 400) }));
      }
    }

    // Read a client's VAT certificate / CR / national address document and
    // return the invoice fields, so the owner does not re-key them.
    if (b.action === "panel-read-doc") {
      const out = await readDocument(String(b.fileBase64 || ""), String(b.fileType || ""));
      res.statusCode = out.ok ? 200 : (out.error === "not_configured" ? 503 : 400);
      return res.end(JSON.stringify(out));
    }

    // The account's client list for the panel's picker: issuing against an id
    // the owner picked is what stops a duplicate record being created for a
    // customer already in the books.
    if (b.action === "panel-daftra-clients") {
      if (!daftraConfigured()) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "daftra_not_configured" })); }
      try {
        const clients = await daftraListClients(500);
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, clients }));
      } catch (e) {
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, error: String(e.message || "failed"), detail: String(e.detail || "").slice(0, 300) }));
      }
    }

    // Look an invoice up by the number printed on it, so a wrong one can be
    // corrected without hunting for internal ids.
    if (b.action === "panel-daftra-find-invoice") {
      if (!daftraConfigured()) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "daftra_not_configured" })); }
      try {
        const hit = await daftraFindInvoice(b.q);
        if (!hit) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: "not_found" })); }
        const r = hit.row || {};
        res.statusCode = 200;
        return res.end(JSON.stringify({
          ok: true,
          invoice: {
            id: hit.id,
            number: String(r.no || r.invoice_number || r.number || hit.id),
            date: r.date || "",
            clientId: r.client_id || "",
            clientName: r.client_business_name || r.client_name || "",
            total: r.summary_total ?? r.total ?? null,
            status: r.payment_status || r.status || "",
            draft: r.draft === 1 || r.draft === "1" || r.draft === true,
            email: hit.email || "",
            url: (hit.links && (hit.links.publicUrl || hit.links.url)) || "",
          },
        }));
      } catch (e) {
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, error: String(e.message || "failed"), detail: String(e.detail || "").slice(0, 400) }));
      }
    }

    // Correct a client's registered details in the books — the company name,
    // VAT number, CR and national address the buyer actually trades under.
    // This is the half that always works and always matters: every future
    // invoice to that client comes out right, whatever happens to the old one.
    if (b.action === "panel-daftra-fix-client") {
      if (!daftraConfigured()) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "daftra_not_configured" })); }
      const clientId = String(b.clientId || "").trim();
      const name = String(b.name || "").trim();
      if (!clientId || !name) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
      try {
        const done = await daftraUpdateClient(clientId, {
          name,
          taxNumber: String(b.taxNumber || "").replace(/\D/g, ""),
          address: (b.address && typeof b.address === "object") ? b.address : {},
          city: String((b.address && b.address.city) || "").trim(),
          email: String(b.email || "").trim(),
          phone: String(b.phone || "").trim(),
        }, { rename: true });
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, updated: done }));
      } catch (e) {
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, error: String(e.message || "failed"), detail: String(e.detail || "").slice(0, 400) }));
      }
    }

    // Re-point an issued invoice at a client record. Daftra decides whether an
    // invoice is still editable; when it refuses, its own reason is shown so
    // the owner knows a credit note is what is left, rather than retrying.
    if (b.action === "panel-daftra-fix-invoice") {
      if (!daftraConfigured()) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "daftra_not_configured" })); }
      const invoiceId = String(b.invoiceId || "").trim();
      const clientId = String(b.clientId || "").trim();
      if (!invoiceId || !clientId) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
      try {
        await daftraSetInvoiceClient(invoiceId, clientId);
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, error: String(e.message || "failed"), detail: String(e.detail || "").slice(0, 400) }));
      }
    }

    // Send an invoice to the client with the PDF attached. Daftra's own file
    // is preferred and fetched automatically; when the account serves it to a
    // logged-in browser only — which no API key can stand in for — the owner
    // attaches the file they already have and the client still receives the
    // document rather than a link they may have to sign in to open.
    if (b.action === "panel-send-invoice") {
      const to = String(b.email || "").trim();
      if (!isEmail(to)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "bad_email" })); }
      const number = String(b.number || "").trim() || "—";
      const total = b.total == null ? null : Number(b.total);
      const link = String(b.url || "").trim();
      let pdf = String(b.fileBase64 || "");
      let source = pdf ? "uploaded" : "";
      if (!pdf && b.invoiceId && daftraConfigured()) {
        try {
          const got = await daftraDocPdf("invoice", String(b.invoiceId));
          if (got) { pdf = got.base64; source = "daftra"; }
        } catch { /* fall through to the link */ }
      }
      if (Buffer.byteLength(pdf || "", "base64") > 12 * 1024 * 1024) { res.statusCode = 413; return res.end(JSON.stringify({ ok: false, error: "too_large" })); }
      let payUrl = "";
      if (b.invoiceId && daftraConfigured()) { try { payUrl = (await daftraPayLink(String(b.invoiceId))).url; } catch { payUrl = ""; } }
      const html = `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px;margin:auto;text-align:right"><h2 style="color:#0B1B5A">فاتورتك من بيزنس بارتنر</h2>
        <p>رقم الفاتورة: <b>${esc(number)}</b>${total != null && Number.isFinite(total) ? ` · الإجمالي: <b>${total} ﷼</b>` : ""}</p>
        ${pdf ? "<p>نسخة الفاتورة الضريبية بصيغة PDF مرفقة مع هذه الرسالة.</p>" : ""}
        ${payButton(payUrl || link)}
        <p style="color:#475569">للتحويل البنكي: ${esc(SS_BANK.beneficiary)} — ${esc(SS_BANK.bank)} — <span style="direction:ltr;display:inline-block">${esc(SS_BANK.iban)}</span></p>
        <p style="color:#94a3b8;font-size:12px">فاتورة ضريبية صادرة عبر نظام الدفترة ومتوافقة مع متطلبات هيئة الزكاة والضريبة والجمارك.</p></div>`;
      const sent = await sendEmail(to, `فاتورة ${number} — بيزنس بارتنر`, html,
        pdf ? [{ filename: `TAX_Invoice-${number.replace(/[^\w-]/g, "")}.pdf`, content: pdf }] : undefined);
      res.statusCode = (sent && sent.ok) ? 200 : 502;
      return res.end(JSON.stringify({ ok: !!(sent && sent.ok), attached: !!pdf, source, payUrl, error: (sent && sent.error) || undefined }));
    }

    // Reverse an invoice with a credit note, so the wrong one stops standing
    // as a receivable and the corrected one can replace it cleanly.
    if (b.action === "panel-daftra-credit-note") {
      if (!daftraConfigured()) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "daftra_not_configured" })); }
      const invoiceId = String(b.invoiceId || "").trim();
      if (!invoiceId) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
      try {
        const note = await daftraCreateCreditNote(invoiceId, { reason: String(b.reason || "") });
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, note }));
      } catch (e) {
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, error: String(e.message || "failed"), detail: String(e.detail || "").slice(0, 400) }));
      }
    }

    // Which route, if any, makes Daftra e-mail its own invoice. Answering this
    // is what lets the tax invoice stay in one numbering series and one set of
    // books — the alternative is a second invoice issued by us, which is how
    // accounting drifts apart.
    if (b.action === "panel-daftra-send-probe") {
      if (!daftraConfigured()) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "daftra_not_configured" })); }
      const id = String(b.invoiceId || "").trim();
      if (!id) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
      try {
        const out = await daftraSendProbe(id);
        res.statusCode = 200;
        return res.end(JSON.stringify(out));
      } catch (e) {
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, error: String(e.message || "failed") }));
      }
    }

    // Which document endpoints this account actually exposes. Daftra names the
    // credit note differently between versions and documents none of them, so
    // the account is asked instead of a name being assumed.
    if (b.action === "panel-daftra-probe-endpoints") {
      if (!daftraConfigured()) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "daftra_not_configured" })); }
      try {
        const out = await daftraProbeEndpoints();
        res.statusCode = 200;
        return res.end(JSON.stringify(out));
      } catch (e) {
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, error: String(e.message || "failed") }));
      }
    }

    // One place that says what is actually wired and what is not. Built because
    // a diagnostic that guessed from env-var names reported a configured
    // provider as missing, and the wrong answer was acted on more than once.
    // Names of the satisfying variable only — never a value, not even a prefix.
    if (b.action === "panel-health") {
      const has = (...names) => names.find((n) => process.env[n] && String(process.env[n]).trim()) || null;
      const svc = (label, via, note = "") => ({ label, ok: !!via, via, note });
      const out = [
        svc("الذكاء — Gemini (مجاني)", has("GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GEMINI_API_KEY", "GEMINI_KEY", "GEMINI_APIKEY", "GEMINI", "BusinessPartnerGimini", "BusinessPartnerGemini"), "يقرأ شهادة الضريبة والسجل"),
        svc("الذكاء — Anthropic", has("ANTHROPIC_API_KEY", "ANTHROPIC_KEY", "CLAUDE_API_KEY"), "بديل لقراءة المستندات"),
        svc("الذكاء — Groq (مجاني)", has("GROQ_API_KEY", "GROQ_KEY", "GROQ"), "بديل سريع للمستشار"),
        svc("الذكاء — OpenAI", has("OPENAI_API_KEY", "OPENAI_KEY", "OPENAI"), "بديل للصور فقط"),
        svc("الدفترة", has("DAFTRA_API_KEY"), "الفواتير وعروض الأسعار"),
        svc("DocuSign", has("DOCUSIGN_INTEGRATION_KEY") && has("DOCUSIGN_USER_ID") && has("DOCUSIGN_ACCOUNT_ID") && has("DOCUSIGN_PRIVATE_KEY") ? "DOCUSIGN_*" : null,
          /^prod/i.test(String(process.env.DOCUSIGN_ENV || "demo"))
            ? "العقود والتوقيع — بيئة الإنتاج ✓"
            : "⚠ بيئة تجريبية (demo): التوقيعات الصادرة منها غير ملزمة قانوناً. اضبط DOCUSIGN_ENV=production"),
        svc("مُيسّر — نموذج الدفع", has("MOYASAR_PUBLISHABLE_KEY"), "يظهر نموذج البطاقة للعميل"),
        svc("مُيسّر — تأكيد الدفع", has("MOYASAR_SECRET_KEY"), "يتحقق من الدفعة ويصدر الفاتورة"),
        svc("مُيسّر — Webhook", has("MOYASAR_WEBHOOK_SECRET"), "يلتقط الدفعة لو أغلق العميل الصفحة"),
        svc("البريد — Resend", has("RESEND_API_KEY"), "كل الرسائل والمرفقات"),
        svc("نوشن — CRM", has("NOTION_TOKEN", "BusinessPartnerSiteNotion", "NOTION_SECRET", "NOTION_API_KEY", "NOTION_KEY", "NOTION_INTEGRATION_TOKEN", "NOTION"), "الطلبات والموردون"),
        svc("الدخول عبر Google", has("GOOGLE_CLIENT_ID"), "اختياري"),
        svc("رموز الدخول (OTP)", has("OTP_SECRET"), "روابط عروض الأسعار تعتمد عليه"),
        svc("GitHub (تحرير المحتوى)", has("GITHUB_TOKEN", "GH_TOKEN"), "حفظ ونشر من اللوحة"),
        svc("قاعدة البيانات", has("SUPABASE_URL", "DATABASE_URL"), "بوابة العميل"),
        // A tax invoice we render ourselves is only worth sending if it can
        // carry the seller's registration — without it there is no lawful QR.
        svc("هوية البائع الضريبية", sellerProfile().ready ? "COMPANY_VAT_NUMBER" : null, "مطلوبة لإصدار فاتورة ضريبية من موقعنا"),
        // Nafath is Elm's; it needs both an app id and the service name they
        // registered for us. Either one missing means the flow cannot start,
        // so the line names which.
        (() => {
          const n = nafathPing();
          const ready = n.configured && n.serviceConfigured && n.hashSecret;
          const note = !ready ? `ينقص: ${n.missing.join("، ")}`
            : !n.owners ? "جاهز — لكن لا هوية مصرّح لها بعد. أضف OWNER_NATIONAL_IDS"
            : `جاهز — بيئة ${n.environment === "production" ? "الإنتاج" : "الاختبار"} · ${n.owners} هوية مصرّح لها` +
              (panelRequiresNafath() ? " · اللوحة تفتح بنفاذ فقط 🔒" : " · مفتاح الوصول ما زال يفتح اللوحة");
          return svc("نفاذ — التحقق من الهوية", ready ? "NAFATH_*" : null, note);
        })(),
        svc("اعتماد — واجهة العقود الحكومية", etimadConfigured() ? "ETIMAD_*" : null, "استعلام العقود والمستخلصات — افحص الاتصال من بطاقة اعتماد"),
        svc("واتساب العميل (Cloud API)", has("WHATSAPP_TOKEN", "WHATSAPP_ACCESS_TOKEN", "META_WHATSAPP_TOKEN") && has("WHATSAPP_PHONE_ID", "WHATSAPP_PHONE_NUMBER_ID") ? "WHATSAPP_*" : null, "إشعار العميل بكل خطوة على واتساب"),
      ];
      res.statusCode = 200;
      // channels says which legs of the client's notification actually fire —
      // the portal, the e-mail, WhatsApp — so a silent client is diagnosed
      // instead of guessed at.
      return res.end(JSON.stringify({ ok: true, services: out, channels: stageChannels(), mpf: await mpfCheck() }));
    }

    // Ask Moyasar whether the key works, rather than whether the variable
    // exists. The two are not the same claim, and this project has already
    // lost an evening to the difference.
    // Ask Etimad for a token with the credential we hold. A variable that is
    // merely set proves nothing — a wrong secret sets it just as well.
    if (b.action === "panel-etimad-ping") {
      const out = await etimadPing();
      res.statusCode = 200; // a configuration answer is not a server error
      return res.end(JSON.stringify(out));
    }

    if (b.action === "panel-moyasar-ping") {
      const out = await moyasarPing();
      res.statusCode = 200; // a configuration answer is not a server error
      return res.end(JSON.stringify(out));
    }

    // Send one real stage notification, to prove the loop end to end. Uses the
    // same code path a live order uses; nothing about it is a special case.
    if (b.action === "panel-stage-test") {
      const stage = String(b.stage || "quote_sent");
      const ref = String(b.ref || "").trim();
      if (!ref) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
      try {
        const report = await announce({
          stage, clientRef: ref,
          email: String(b.email || "").trim() || undefined,
          phone: String(b.phone || "").trim() || undefined,
          service: String(b.service || "خدمة تجريبية"),
          total: b.total == null ? null : Number(b.total),
          extra: String(b.note || "").slice(0, 300) || undefined,
        });
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, report, channels: stageChannels() }));
      } catch (e) {
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, error: String(e.message || "failed") }));
      }
    }

    // Which client-facing route this account publishes for an invoice. The
    // gateway is enabled inside Daftra, so that page is the payment page —
    // and which URL serves it is answered by asking, not by assuming.
    if (b.action === "panel-daftra-paylink-probe") {
      if (!daftraConfigured()) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "daftra_not_configured" })); }
      try {
        const id = String(b.invoiceId || "").trim();
        if (!id) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
        const link = await daftraPayLink(id);
        const probe = await daftraPayLinkProbe(id, link.hasHash ? String(link.url).split("/").pop() : "");
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, link, probe: probe.results }));
      } catch (e) {
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, error: String(e.message || "failed") }));
      }
    }

    // Which PDF route this account answers, with each candidate's status and
    // content type — the API documents none, so this reports evidence.
    if (b.action === "panel-daftra-pdf-probe") {
      if (!daftraConfigured()) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "daftra_not_configured" })); }
      try {
        const out = await daftraPdfProbe("invoice", b.id || null);
        res.statusCode = out.ok ? 200 : 502;
        return res.end(JSON.stringify(out));
      } catch (e) {
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, error: String(e.message || "failed") }));
      }
    }

    // Mirror the published service catalogue into Daftra's product list, one
    // slice per call — 116 services is well past what a single invocation can
    // do inside its time limit, so the panel walks the offsets.
    if (b.action === "panel-daftra-sync-catalog") {
      if (!daftraConfigured()) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "daftra_not_configured" })); }
      try {
        const r = await fetch(RAW_CATALOG_URL, { cache: "no-store" });
        if (!r.ok) throw new Error("catalog_unreachable");
        const cat = await r.json();
        // Packages are sold like services and carry their own codes, so they
        // belong in the product list too.
        const services = [
          ...(Array.isArray(cat.services) ? cat.services : []),
          ...(Array.isArray(cat.packages) ? cat.packages : []).map((p) => ({
            code: p.code, nameAr: p.nameAr, nameEn: p.nameEn, amount: p.amount,
            categoryAr: p.groupNameAr || "الباقات", pricingModel: p.billingPeriod === "monthly" ? "Monthly" : "One Time",
          })),
        ].filter((x) => x && x.code);
        if (b.offset === 0 || b.offset === undefined) daftraResetProductCache();
        const out = await daftraSyncCatalog(services, Number(b.offset) || 0, Math.min(Math.max(Number(b.limit) || 15, 1), 25));
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, ...out }));
      } catch (e) {
        console.error("daftra catalog sync failed", String(e.message || e).slice(0, 200));
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, error: String(e.message || "sync_failed"), detail: String(e.detail || "").slice(0, 300) }));
      }
    }

    // Issue a tax invoice in Daftra for a client request, then (optionally)
    // email the client the total and the invoice link. The client record is
    // reused when their email or phone already exists in the books, so
    // repeat customers do not accumulate duplicates.
    /* ---- Bank transfer: no invoice without a person ------------------------
     * An online card payment is confirmed by the gateway: the money is
     * verifiably in the account before anything is issued, so the invoice is
     * automatic. A bank transfer has no such confirmation — a receipt is an
     * image the buyer produced, and an image is not money in the account.
     *
     * So this path requires a human to state two separate things: that they
     * read the receipt, and that they saw the funds arrive. They are asked
     * apart because they fail apart — a receipt can be genuine for a transfer
     * that was later reversed, and money can arrive against a receipt that
     * shows a different amount.
     *
     * Once satisfied, this deliberately falls through to panel-invoice rather
     * than issuing anything itself: both payment routes must produce the same
     * document from the same code, or the books end up with two kinds of
     * invoice that only differ by how they were triggered.
     */
    if (b.action === "panel-confirm-transfer") {
      const missing = [];
      if (b.receiptRead !== true) missing.push("قراءة الإيصال");
      if (b.fundsArrived !== true) missing.push("تأكيد وصول المبلغ للحساب البنكي");
      if (missing.length) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ ok: false, error: "confirmation_required", missing,
          message: `لم تُؤكَّد بعد: ${missing.join(" · ")}` }));
      }
      // Typed by the person, not carried over from the order. Reading the
      // figure off the receipt is the act that catches a short transfer.
      const received = Number(b.amountReceived);
      if (!(received > 0)) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ ok: false, error: "amount_required",
          message: "أدخل المبلغ الذي وصل فعلاً كما هو في الإيصال." }));
      }
      const expected = Number(b.expectedTotal) || 0;
      // Half a riyal of tolerance covers rounding, nothing else. A real
      // difference is shown and must be accepted explicitly — invoicing the
      // full amount against a short transfer puts the books out by the gap.
      if (expected > 0 && Math.abs(expected - received) > 0.5 && b.acceptMismatch !== true) {
        res.statusCode = 409;
        return res.end(JSON.stringify({ ok: false, error: "amount_mismatch",
          expected, received, difference: Math.round((received - expected) * 100) / 100,
          message: received < expected
            ? `وصل ${received} ﷼ والمطلوب ${expected} ﷼ — ناقص ${Math.round((expected - received) * 100) / 100} ﷼.`
            : `وصل ${received} ﷼ والمطلوب ${expected} ﷼ — زائد ${Math.round((received - expected) * 100) / 100} ﷼.` }));
      }
      // Who stood behind this. A Nafath ticket names an identity from
      // OWNER_NATIONAL_IDS; a shared key names only that someone knew it, and
      // the record should not pretend otherwise.
      const by = ownerTicketOk(b.ticket) ? "هوية موثّقة عبر نفاذ" : "مفتاح وصول (بلا هوية)";
      const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
      b.notes = [
        String(b.notes || "").trim(),
        `تحويل بنكي مؤكَّد يدوياً — المبلغ المستلم ${received} ﷼${expected && Math.abs(expected - received) > 0.5 ? ` (المطلوب ${expected} ﷼)` : ""}`,
        `تأكيد قراءة الإيصال ووصول المبلغ · ${by} · ${stamp} UTC`,
      ].filter(Boolean).join("\n");
      console.log("panel-confirm-transfer", String(b.ref || ""), received, by);
      // Fall through to panel-invoice with the confirmation recorded on it.
      b.action = "panel-invoice";
    }

    if (b.action === "panel-invoice") {
      if (!daftraConfigured()) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "daftra_not_configured" })); }
      const email = String(b.email || "").trim();
      const items = Array.isArray(b.items) ? b.items.slice(0, 30) : [];
      if (!items.length) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "no_items" })); }
      if (!email && !String(b.phone || "").trim()) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "no_contact" })); }
      const ref = String(b.ref || "").trim();
      try {
        const pickedId = String(b.daftraClientId || "").trim();
        const address = (b.address && typeof b.address === "object") ? b.address : {};
        const taxNumber = String(b.taxNumber || "").replace(/\D/g, "");
        const who = {
          name: String(b.clientName || "").trim(),
          email, phone: String(b.phone || "").trim(), city: String(b.city || address.city || "").trim(),
          taxNumber, address,
          notes: ref ? `طلب ${ref} — من موقع بيزنس بارتنر` : "من موقع بيزنس بارتنر",
        };
        // An explicitly picked client is used as-is — no lookup, no creation.
        // Matching on email or phone is a heuristic, and a heuristic that
        // guesses wrong either duplicates a customer or invoices the wrong one.
        let client, created = false;
        if (pickedId) {
          client = { id: pickedId };
          // A company invoice carries the registered name the buyer gave, so it
          // corrects the record too — a client first created from a personal
          // order keeps that person's name on every later company invoice
          // otherwise, which is exactly the defect this fixes.
          if (taxNumber || nationalAddressLine(address)) {
            try { await daftraUpdateClient(pickedId, who, { rename: !!(taxNumber && who.name) }); } catch {}
          }
        } else {
          ({ client, created } = await daftraFindOrCreateClient(who));
        }
        const clientId = client.id || client.client_id;
        // Repeat the buyer's tax details in the invoice notes as well. They
        // belong on the client record and Daftra prints them from there, but a
        // field name this account does not recognise would silently drop them —
        // and a tax invoice missing the buyer's VAT number is not compliant.
        const addrLine = nationalAddressLine(address);
        const taxBlock = [
          taxNumber ? `الرقم الضريبي للعميل: ${taxNumber}` : "",
          addrLine ? `العنوان الوطني للعميل: ${addrLine}` : "",
        ].filter(Boolean).join("\n");
        // Same form issues either document: a quote is what the client sees
        // before agreeing, an invoice is what they owe after.
        const isQuote = String(b.docType || "invoice") === "estimate";
        const make = isQuote ? daftraCreateEstimate : daftraCreateInvoice;
        const inv = await make({
          clientId, items,
          notes: [String(b.notes || "").trim(), taxBlock].filter(Boolean).join("\n").slice(0, 900),
          ref, dueDays: Number(b.dueDays) || 0,
          draft: !!b.draft,
        });
        // Emailing the client is best-effort: the invoice exists in the books
        // either way, so a mail failure must not read as a failed issuance.
        // The client gets Daftra's own printed document as an attachment: it is
        // the one carrying the ZATCA QR code and the seller's tax details.
        let pdf = null;
        if (!b.draft) { try { pdf = await daftraDocPdf(isQuote ? "estimate" : "invoice", inv.id); } catch { pdf = null; } }
        // Where the client pays. Best-effort: a missing link must not stop an
        // invoice that already exists in the books from reaching them.
        let payUrl = "";
        if (!isQuote && !b.draft) { try { payUrl = (await daftraPayLink(inv.id)).url; } catch { payUrl = inv.publicUrl || inv.url || ""; } }
        // No PDF means no email. A message whose only content is a link the
        // client may not be able to open is a message that should not have been
        // sent — it reads as "your invoice" and carries no invoice. The panel is
        // told to attach the file instead, and the one email the client gets is
        // the one with the document in it.
        const pendingPdf = !pdf && !b.draft && !!email && b.sendEmail !== false;
        let emailed = false;
        if (email && b.sendEmail !== false && !b.draft && pdf) {
          const docAr = isQuote ? "عرض سعر" : "فاتورة";
          const rows = items.map((it) => `<tr><td style="padding:5px 10px">${esc(String(it.name || ""))}</td><td style="padding:5px 10px">${Number(it.quantity) || 1}</td><td style="padding:5px 10px">${Number(it.unitPrice) || 0} ﷼</td></tr>`).join("");
          const r2 = await sendEmail(email, `${docAr} ${inv.number} — بيزنس بارتنر`,
            `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px;margin:auto;text-align:right"><h2 style="color:#0B1B5A">${isQuote ? "عرض سعر من بيزنس بارتنر" : "فاتورتك من بيزنس بارتنر"}</h2>
             <p>رقم ${docAr}: <b>${esc(inv.number)}</b>${ref ? ` · مرجع الطلب: <b style="direction:ltr;display:inline-block">${esc(ref)}</b>` : ""}</p>
             <table style="border-collapse:collapse;width:100%"><thead><tr style="background:#f1f5f9"><th style="padding:6px 10px;text-align:right">البند</th><th style="padding:6px 10px;text-align:right">الكمية</th><th style="padding:6px 10px;text-align:right">السعر</th></tr></thead><tbody>${rows}</tbody></table>
             <p style="line-height:2">الإجمالي قبل الضريبة: <b>${inv.net} ﷼</b><br>ضريبة القيمة المضافة (${daftraVatRate()}%): <b>${inv.vat} ﷼</b><br>${isQuote ? "الإجمالي شامل الضريبة" : "الإجمالي المستحق"}: <b style="color:#0B1B5A;font-size:18px">${inv.total} ﷼</b></p>
             <p style="color:#475569">للتحويل البنكي: ${esc(SS_BANK.beneficiary)} — ${esc(SS_BANK.bank)} — <span style="direction:ltr;display:inline-block">${esc(SS_BANK.iban)}</span></p>
             <p style="color:#0B1B5A">نسخة ${docAr} بصيغة PDF مرفقة مع هذه الرسالة.</p>
             ${isQuote ? "" : payButton(payUrl)}
             <p style="color:#94a3b8;font-size:12px">${isQuote ? "عرض سعر صادر عبر نظام الدفترة — يتحول إلى فاتورة ضريبية عند الاعتماد." : "فاتورة ضريبية صادرة عبر نظام الدفترة ومتوافقة مع متطلبات هيئة الزكاة والضريبة والجمارك."}</p></div>`,
            pdf ? [{ filename: `${isQuote ? "Quote" : "TAX_Invoice"}-${String(inv.number).replace(/[^\w-]/g, "")}.pdf`, content: pdf.base64 }] : undefined);
          emailed = !!(r2 && r2.ok);
        }
        // A quote is an offer, not an agreement — only an invoice moves the
        // lead to «مؤكد - قيد التنفيذ».
        if (ref && !isQuote) { try { await setLeadStatus(ref, "مؤكد - قيد التنفيذ"); } catch {} }
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, invoice: inv, clientCreated: created, emailed, pdfAttached: !!pdf, pendingPdf, email, payUrl }));
      } catch (e) {
        console.error("daftra invoice failed", String(e.message || e).slice(0, 200));
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, error: String(e.message || "daftra_failed"), detail: String(e.detail || "").slice(0, 200) }));
      }
    }

    // Owner confirms a wallet movement after verifying the transfer/receipt:
    // type=topup credits, type=payment debits. The ledger is the only place
    // balance comes from — there is no writable balance field anywhere.
    if (b.action === "panel-wallet-entry") {
      if (!DB_ON) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "db_not_configured" })); }
      const email = String(b.email || "").trim().toLowerCase();
      const kind = b.type === "payment" ? "payment" : "topup";
      const amountNum = Math.abs(Number(b.amount));
      const note = String(b.note || "").slice(0, 300);
      if (!isEmail(email) || !Number.isFinite(amountNum) || amountNum <= 0) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "bad_request" })); }
      try {
        const users = await sb(`users?email=eq.${encodeURIComponent(email)}&select=id&limit=1`);
        if (!users.length) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: "user_not_found" })); }
        const mem = await sb(`organization_members?user_id=eq.${users[0].id}&status=eq.active&select=organization_id&limit=1`);
        if (!mem.length) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: "org_not_found" })); }
        const orgId = mem[0].organization_id;
        await sb("wallet_accounts?on_conflict=organization_id", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: [{ organization_id: orgId }] });
        const signed = kind === "payment" ? -amountNum : amountNum;
        await sb("wallet_transactions", { method: "POST", prefer: "return=minimal", body: [{ organization_id: orgId, type: kind, amount: signed, note }] });
        const bal = await sb(`wallet_balances?organization_id=eq.${orgId}&select=balance`);
        await audit({ organization_id: orgId, actor_label: "bp_operator:panel", action: `wallet.${kind}`, entity_type: "wallet", after: { amount: signed, note } });
        await notify({ organization_id: orgId, event: `wallet_${kind}_confirmed`, channel: "inapp", title: kind === "topup" ? `تم اعتماد شحن محفظتك (+${amountNum} ﷼)` : `تم سداد ${amountNum} ﷼ من محفظتك`, idempotency_key: `wallet_entry:${kind}:${email}:${amountNum}:${note}` });
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, balance: (bal[0] && Number(bal[0].balance)) || 0 }));
      } catch {
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, error: "db_failed" }));
      }
    }

    // Owner: escrow oversight. List everything, decide refund requests, and
    // record a supplier payout after the bank transfer is made.
    if (b.action === "panel-escrows") {
      if (!DB_ON) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "db_not_configured" })); }
      try {
        const [escrows, balances] = await Promise.all([
          sb("escrows?select=id,ref,client_email,supplier_email,supplier_name,title,amount,status,note,created_at&order=created_at.desc&limit=100"),
          sb("supplier_wallet_balances?select=supplier_email,balance&order=balance.desc&limit=100"),
        ]);
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, escrows: escrows || [], supplierBalances: balances || [] }));
      } catch { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "db_failed" })); }
    }
    if (b.action === "panel-escrow-decide") {
      if (!DB_ON) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "db_not_configured" })); }
      const id = String(b.id || "").slice(0, 60);
      const decision = b.decision === "release" ? "release" : "refund";
      if (!id) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "id_required" })); }
      try {
        if (decision === "release") {
          const rows = await sb(`escrows?id=eq.${encodeURIComponent(id)}&status=in.(held,delivered,refund_requested)`, { method: "PATCH", body: { status: "released", released_at: new Date().toISOString() } });
          if (!rows.length) { res.statusCode = 409; return res.end(JSON.stringify({ ok: false, error: "not_releasable" })); }
          const e2 = rows[0];
          await sb("supplier_wallet_transactions", { method: "POST", prefer: "return=minimal", body: [{ supplier_email: e2.supplier_email, type: "escrow_release", amount: Number(e2.amount), note: `تحرير ضمان ${e2.ref} (قرار الإدارة)` }] });
          await sendEmail(e2.supplier_email, `✅ تحرّر ضمانك — ${e2.ref} (${e2.amount} ﷼)`, `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430"><p>قررت إدارة بيزنس بارتنر تحرير الضمان <b>${e2.ref}</b> (${e2.amount} ﷼) إلى محفظتك في لوحة الشريك.</p></div>`).catch(() => {});
          res.statusCode = 200;
          return res.end(JSON.stringify({ ok: true, escrow: e2 }));
        }
        const rows = await sb(`escrows?id=eq.${encodeURIComponent(id)}&status=in.(held,delivered,refund_requested)`, { method: "PATCH", body: { status: "refunded" } });
        if (!rows.length) { res.statusCode = 409; return res.end(JSON.stringify({ ok: false, error: "not_refundable" })); }
        const e2 = rows[0];
        await sb("wallet_transactions", { method: "POST", prefer: "return=minimal", body: [{ organization_id: e2.organization_id, type: "refund", amount: Number(e2.amount), note: `استرجاع ضمان ${e2.ref}` }] });
        await notify({ organization_id: e2.organization_id, event: "escrow_refunded", channel: "inapp", title: `أُرجع ضمان ${e2.ref} (+${e2.amount} ﷼) إلى محفظتك`, idempotency_key: `escrow_refund:${e2.ref}` }).catch(() => {});
        await Promise.all([
          sendEmail(e2.client_email, `تم استرجاع الضمان ${e2.ref} إلى محفظتك ✅`, `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430"><p>أُعيد مبلغ <strong>${e2.amount} ﷼</strong> من الضمان <b>${e2.ref}</b> إلى محفظتك في <a href="${MKT_SITE_BASE}/account" style="color:#0B1B5A">لوحتك</a>.</p></div>`),
          sendEmail(e2.supplier_email, `قرار الضمان ${e2.ref}: استرجاع للعميل`, `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430"><p>بعد المراجعة قررت إدارة بيزنس بارتنر إرجاع مبلغ الضمان <b>${e2.ref}</b> للعميل.</p></div>`),
        ]).catch(() => {});
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, escrow: e2 }));
      } catch { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "db_failed" })); }
    }
    // Records the debit AFTER the owner has actually transferred the money to
    // the supplier's bank — the ledger mirrors reality, it never causes it.
    if (b.action === "panel-supplier-payout") {
      if (!DB_ON) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "db_not_configured" })); }
      const email = String(b.email || "").trim().toLowerCase();
      const amountNum = Math.abs(Number(b.amount));
      const note = String(b.note || "").slice(0, 300);
      if (!isEmail(email) || !Number.isFinite(amountNum) || amountNum <= 0) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "bad_request" })); }
      try {
        const bal = await sb(`supplier_wallet_balances?supplier_email=eq.${encodeURIComponent(email)}&select=balance`);
        const balance = (bal[0] && Number(bal[0].balance)) || 0;
        if (balance < amountNum) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "insufficient_funds", balance })); }
        await sb("supplier_wallet_transactions", { method: "POST", prefer: "return=minimal", body: [{ supplier_email: email, type: "withdrawal", amount: -amountNum, note: note || "تحويل بنكي للمورد" }] });
        await sendEmail(email, `تم تحويل ${amountNum} ﷼ من محفظتك ✅`, `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430"><p>حوّلنا لك مبلغ <strong>${amountNum} ﷼</strong> من محفظتك في بيزنس بارتنر.${note ? "<br>" + esc(note) : ""}</p></div>`).catch(() => {});
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, balance: Math.round((balance - amountNum) * 100) / 100 }));
      } catch { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "db_failed" })); }
    }

    // P4 owner-side: find an org by client email (shared helper for the three
    // actions below).
    const orgByEmail = async (em) => {
      const users = await sb(`users?email=eq.${encodeURIComponent(String(em).toLowerCase())}&select=id&limit=1`);
      if (!users.length) return null;
      const mem = await sb(`organization_members?user_id=eq.${users[0].id}&status=eq.active&select=organization_id&limit=1`);
      return mem.length ? mem[0].organization_id : null;
    };
    if (b.action === "panel-tickets") {
      if (!DB_ON) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "db_not_configured" })); }
      const items = await sb(`support_tickets?select=id,number,subject,status,priority,created_at,organization_id,ticket_messages(author_kind,body,created_at)&order=created_at.desc&limit=30`);
      res.statusCode = 200; return res.end(JSON.stringify({ ok: true, items }));
    }
    if (b.action === "panel-ticket-reply") {
      if (!DB_ON) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "db_not_configured" })); }
      const number = String(b.number || "").trim();
      const bodyTxt = String(b.body || "").trim().slice(0, 4000);
      const close = !!b.close;
      if (!number || !bodyTxt) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
      try {
        const tks = await sb(`support_tickets?number=eq.${encodeURIComponent(number)}&select=id,organization_id,subject&limit=1`);
        if (!tks.length) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: "not_found" })); }
        await sb("ticket_messages", { method: "POST", prefer: "return=minimal", body: [{ ticket_id: tks[0].id, author_kind: "bp", body: bodyTxt }] });
        await sb(`support_tickets?id=eq.${tks[0].id}`, { method: "PATCH", prefer: "return=minimal", body: { status: close ? "closed" : "waiting_client", ...(close ? { closed_at: new Date().toISOString() } : {}) } });
        await notify({ organization_id: tks[0].organization_id, event: "ticket_replied", channel: "inapp", title: `رد جديد على تذكرتك ${number}`, idempotency_key: `ticket_reply:${number}:${Date.now()}` });
        res.statusCode = 200; return res.end(JSON.stringify({ ok: true }));
      } catch { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "db_failed" })); }
    }
    if (b.action === "panel-approval-create") {
      if (!DB_ON) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "db_not_configured" })); }
      const title = String(b.title || "").trim().slice(0, 200);
      const actionType = String(b.actionType || "gov_submission").slice(0, 40);
      const amount = Number.isFinite(Number(b.amount)) ? Number(b.amount) : null;
      if (!isEmail(String(b.email || "")) || !title) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
      try {
        const orgId = await orgByEmail(b.email);
        if (!orgId) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: "org_not_found" })); }
        await sb("approvals", { method: "POST", prefer: "return=minimal", body: [{ organization_id: orgId, action_type: actionType, title, amount, target_entity: String(b.target || "").slice(0, 120) || null, risk_note: String(b.risk || "").slice(0, 400) || null, deadline: b.deadline || null, status: "pending" }] });
        await notify({ organization_id: orgId, event: "approval_requested", channel: "inapp", title: `موافقة مطلوبة: ${title}${amount ? ` (${amount} ﷼)` : ""}`, idempotency_key: `approval_req:${orgId}:${title}` });
        res.statusCode = 200; return res.end(JSON.stringify({ ok: true }));
      } catch { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "db_failed" })); }
    }
    if (b.action === "panel-task-create") {
      if (!DB_ON) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "db_not_configured" })); }
      const title = String(b.title || "").trim().slice(0, 200);
      if (!isEmail(String(b.email || "")) || !title) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
      try {
        const orgId = await orgByEmail(b.email);
        if (!orgId) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: "org_not_found" })); }
        await sb("tasks", { method: "POST", prefer: "return=minimal", body: [{ organization_id: orgId, title, details: String(b.details || "").slice(0, 1000) || null, assignee: "client", urgency: ["urgent", "soon", "normal"].includes(b.urgency) ? b.urgency : "normal", due_at: b.due || null, source: "manual" }] });
        await notify({ organization_id: orgId, event: "task_assigned", channel: "inapp", title: `مهمة جديدة: ${title}`, idempotency_key: `task:${orgId}:${title}` });
        res.statusCode = 200; return res.end(JSON.stringify({ ok: true }));
      } catch { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "db_failed" })); }
    }

    // Save an editable content file: validate JSON, commit to GitHub —
    // Vercel rebuilds and the change is live in ~2 minutes.
    if (b.action === "panel-save-content") {
      const filePath = CONTENT_FILES[b.file || ""];
      if (!filePath) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "bad_file" })); }
      if (!GH_TOKEN) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "content_not_configured" })); }
      let parsed;
      try { parsed = JSON.parse(String(b.content || "")); } catch { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_json" })); }
      try {
        const pretty = JSON.stringify(parsed, null, 2) + "\n";
        const msg = `Update ${filePath} from /admin panel`;
        const cur = await ghGetFile(filePath);
        const commit = await ghPutFile(filePath, pretty, cur && cur.sha, msg);
        // Best-effort sync commit so the default branch doesn't drift.
        if (CONTENT_SYNC_BRANCH && CONTENT_SYNC_BRANCH !== CONTENT_BRANCH) {
          try {
            const syncCur = await ghGetFile(filePath, CONTENT_SYNC_BRANCH);
            if (!syncCur || syncCur.content !== pretty) await ghPutFile(filePath, pretty, syncCur && syncCur.sha, msg, CONTENT_SYNC_BRANCH);
          } catch (e) { console.error("content sync-branch error", String(e).slice(0, 150)); }
        }
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, commit }));
      } catch {
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, error: "github_failed" }));
      }
    }

    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: "unknown_action" }));
  }

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
  // Client updates their own establishment record (session-scoped; creates
  // the organization + membership on first save if the account has none).
  // ---- the client's own control over their orders --------------------------
  // Cancelling from the dashboard: allowed while the order is still under
  // review or awaiting payment. Once it is confirmed and work has started,
  // cancellation is a conversation, not a button — the client is told to open
  // a ticket so nobody discards half-done government work with one tap.
  if (b.action === "my-order-cancel") {
    let sess = null;
    try { sess = await getSession(req); } catch { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "db_failed" })); }
    if (!sess) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "unauthorized" })); }
    if (!NOTION_TOKEN) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "notion_not_configured" })); }
    const myEmail = String((sess.user && sess.user.email) || "").toLowerCase();
    const ref = String(b.ref || "").trim().slice(0, 40);
    if (!ref || !/^(BP|RV|BPW|BPP|BPQ|BPI)-/i.test(ref)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "bad_ref" })); }
    try {
      const r = await fetch(`https://api.notion.com/v1/databases/${CRM_DB}/query`, {
        method: "POST",
        headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
        body: JSON.stringify({ page_size: 1, filter: { property: "رقم المرجع", rich_text: { equals: ref } } }),
      });
      if (!r.ok) throw new Error("notion_failed");
      const pg = ((await r.json()).results || [])[0];
      if (!pg) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: "not_found" })); }
      const p = pg.properties || {};
      const notes = ((p["Notes"] && p["Notes"].rich_text) || []).map((t) => t.plain_text).join("").toLowerCase();
      // The order must belong to the person cancelling it.
      if (!myEmail || !notes.includes(myEmail)) { res.statusCode = 403; return res.end(JSON.stringify({ ok: false, error: "not_yours" })); }
      const status = (p["حالة الطلب"] && p["حالة الطلب"].select && p["حالة الطلب"].select.name) || "";
      if (status === "ملغي") { res.statusCode = 200; return res.end(JSON.stringify({ ok: true, already: true })); }
      if (!["قيد المراجعة", "بانتظار الدفع"].includes(status)) {
        res.statusCode = 409;
        return res.end(JSON.stringify({ ok: false, error: "in_progress", message: "بدأ العمل على هذا الطلب — لإلغائه افتح تذكرة دعم ويرجع لك الفريق بالتفاصيل." }));
      }
      await setLeadStatus(ref, "ملغي");
      try { await appendLeadNote(pg, `ألغاه العميل بنفسه من لوحته (${myEmail}) في ${new Date().toISOString().slice(0, 16).replace("T", " ")}`); } catch {}
      // Owner (2026-09): a client who cancels wants the order gone from their
      // lists, not a greyed-out row. Archiving keeps it recoverable from the
      // Notion trash for the team while it disappears from every client view.
      let removed = false;
      if (b.remove) { try { await archiveNotionPage(pg.id); removed = true; } catch {} }
      sendEmail(OWNER_EMAIL, `🚫 العميل ألغى الطلب ${ref}`, `<div dir="rtl" style="font-family:Arial,sans-serif;text-align:right"><p>العميل <b>${esc(myEmail)}</b> ألغى الطلب <b style="direction:ltr;display:inline-block">${esc(ref)}</b> من لوحته وكانت حالته «${esc(status)}». لا يلزمك إجراء — الحالة صارت «ملغي»${removed ? " وأُرشف الطلب (يمكن استرجاعه من سلة نوشن)" : ""}.</p></div>`).catch(() => {});
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, removed }));
    } catch {
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "cancel_failed" }));
    }
  }

  // Remove an already-cancelled (or still unstarted) order from the client's
  // lists. Same ownership rule as cancelling; archived, never hard-deleted.
  if (b.action === "my-order-delete") {
    let sess = null;
    try { sess = await getSession(req); } catch { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "db_failed" })); }
    if (!sess) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "unauthorized" })); }
    if (!NOTION_TOKEN) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "notion_not_configured" })); }
    const myEmail = String((sess.user && sess.user.email) || "").toLowerCase();
    const ref = String(b.ref || "").trim().slice(0, 40);
    if (!ref || !/^(BP|RV|BPW|BPP|BPQ|BPI)-/i.test(ref)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "bad_ref" })); }
    try {
      const r = await fetch(`https://api.notion.com/v1/databases/${CRM_DB}/query`, {
        method: "POST",
        headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
        body: JSON.stringify({ page_size: 1, filter: { property: "رقم المرجع", rich_text: { equals: ref } } }),
      });
      if (!r.ok) throw new Error("notion_failed");
      const pg = ((await r.json()).results || [])[0];
      if (!pg) { res.statusCode = 200; return res.end(JSON.stringify({ ok: true, already: true })); }
      const p = pg.properties || {};
      const notes = ((p["Notes"] && p["Notes"].rich_text) || []).map((t) => t.plain_text).join("").toLowerCase();
      if (!myEmail || !notes.includes(myEmail)) { res.statusCode = 403; return res.end(JSON.stringify({ ok: false, error: "not_yours" })); }
      const status = (p["حالة الطلب"] && p["حالة الطلب"].select && p["حالة الطلب"].select.name) || "";
      if (!["ملغي", "مرفوض", "قيد المراجعة", "بانتظار الدفع"].includes(status)) {
        res.statusCode = 409;
        return res.end(JSON.stringify({ ok: false, error: "in_progress", message: "بدأ العمل على هذا الطلب — لإزالته افتح تذكرة دعم ويرجع لك الفريق بالتفاصيل." }));
      }
      if (status !== "ملغي" && status !== "مرفوض") await setLeadStatus(ref, "ملغي");
      try { await appendLeadNote(pg, `حذفه العميل من لوحته (${myEmail}) في ${new Date().toISOString().slice(0, 16).replace("T", " ")}`); } catch {}
      await archiveNotionPage(pg.id);
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true }));
    } catch {
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "delete_failed" }));
    }
  }

  // The client composes the service they actually need, in their own words —
  // and the existing quote machinery takes it from there: the team prices it,
  // the client gets the quotation link, accepts, signs the contract and pays
  // online, and the invoice issues itself. This is just the front door.
  if (b.action === "custom-request") {
    let sess = null;
    try { sess = await getSession(req); } catch { sess = null; }
    const email = String((sess && sess.user && sess.user.email) || b.email || "").toLowerCase().slice(0, 160);
    const name = String(b.name || (sess && sess.user && sess.user.full_name) || "").trim().slice(0, 160);
    const phone = String(b.phone || "").trim().slice(0, 40);
    const need = String(b.need || "").trim().slice(0, 2000);
    const details = String(b.details || "").trim().slice(0, 2000);
    const budget = String(b.budget || "").trim().slice(0, 60);
    const deadline = String(b.deadline || "").trim().slice(0, 40);
    const company = String(b.company || "").trim().slice(0, 200);
    if (!need || need.length < 10) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "need_required" })); }
    if (!isEmail(email)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "email_required" })); }
    const ref = "BPQ-" + Date.now().toString().slice(-6);
    const lines = [
      `طلب مخصص من العميل — بانتظار التسعير`,
      `الاحتياج: ${need}`,
      details ? `تفاصيل: ${details}` : "",
      company ? `المنشأة: ${company}` : "",
      budget ? `ميزانية تقريبية: ${budget}` : "",
      deadline ? `الموعد المطلوب: ${deadline}` : "",
    ].filter(Boolean).join(" · ");
    const oHtml = `<div dir="rtl" style="font-family:Arial,sans-serif"><h2 style="color:#0B1B5A">🧩 طلب خدمة مخصص ${esc(ref)} — يحتاج تسعير</h2><table>${row("الاسم", name) + row("البريد", email) + row("الجوال", phone) + row("المنشأة", company)}</table><p style="background:#f1f5f9;padding:12px;border-radius:10px;line-height:1.9"><b>ما يحتاجه العميل:</b><br>${esc(need)}${details ? `<br><b>تفاصيل:</b> ${esc(details)}` : ""}${budget ? `<br><b>ميزانية تقريبية:</b> ${esc(budget)}` : ""}${deadline ? `<br><b>الموعد:</b> ${esc(deadline)}` : ""}</p><p><b>الخطوة التالية:</b> أنشئ أمر العمل وأصدر عرض السعر من اللوحة — يصل العميل رابط العرض فيوافق ويوقّع العقد ويدفع إلكترونياً وتصدر فاتورته وحدها.</p></div>`;
    const cHtml = `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430"><h2 style="color:#0B1B5A">استلمنا طلبك المخصص ✅</h2><p>مرحباً ${esc(name || "")}،</p><p>وصلنا وصف احتياجك وفريقنا يسعّره الآن. يصلك <b>عرض السعر</b> على هذا البريد وفي لوحتك — وبمجرد موافقتك توقّع العقد إلكترونياً وتدفع أونلاين ويبدأ التنفيذ فوراً.</p><table>${row("رقم المرجع", ref)}</table><p>تابع طلبك من لوحتك: <a href="${MKT_SITE_BASE}/ar/account" style="color:#0B1B5A">${MKT_SITE_BASE}/ar/account</a></p></div>`;
    await Promise.all([
      crmLead({ title: `🧩 طلب مخصص — ${name || email}`, phone, email, notes: lines, ref, orderStatus: "قيد المراجعة" }),
      sendEmail(TEAM_EMAIL, `🧩 طلب مخصص ${ref} — يحتاج تسعير`, oHtml),
      OWNER_EMAIL && OWNER_EMAIL !== TEAM_EMAIL ? sendEmail(OWNER_EMAIL, `🧩 طلب مخصص ${ref} — يحتاج تسعير`, oHtml) : Promise.resolve(),
      sendEmail(email, `استلمنا طلبك المخصص — ${ref}`, cHtml),
      addToAudience(email, name),
      forwardLead({ source: "custom-request", ref, name, phone, email, items: need.slice(0, 200) }),
    ]);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ref }));
  }

  // ---- multiple establishments per account ---------------------------------
  // A client manages every company they own from one login: list them, switch
  // the session's active one, add another. Documents, orders and purchases all
  // key off the session's organization_id, so switching company switches the
  // whole dashboard with it.
  if (b.action === "my-orgs") {
    if (!DB_ON) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "db_not_configured" })); }
    let sess = null;
    try { sess = await getSession(req); } catch { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "db_failed" })); }
    if (!sess) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "unauthorized" })); }
    try {
      const rows = await sb(`organization_members?user_id=eq.${sess.user.id}&status=eq.active&select=organization_id,role_id,organizations(id,name_ar,name_en,cr_number)`);
      const orgs = rows.map((r) => r.organizations).filter(Boolean);
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, activeId: (sess.organization && sess.organization.id) || null, orgs }));
    } catch { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "db_failed" })); }
  }
  if (b.action === "my-org-switch") {
    if (!DB_ON) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "db_not_configured" })); }
    let sess = null;
    try { sess = await getSession(req); } catch { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "db_failed" })); }
    if (!sess) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "unauthorized" })); }
    const orgId = String(b.orgId || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(orgId)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "bad_org" })); }
    try {
      // Membership is the authorization: a session can only point at a
      // company its user actually belongs to.
      const m = await sb(`organization_members?user_id=eq.${sess.user.id}&organization_id=eq.${orgId}&status=eq.active&select=organization_id&limit=1`);
      if (!m.length) { res.statusCode = 403; return res.end(JSON.stringify({ ok: false, error: "not_member" })); }
      await sb(`user_sessions?id=eq.${sess.sessionId}`, { method: "PATCH", prefer: "return=minimal", body: { organization_id: orgId } });
      const orgs = await sb(`organizations?id=eq.${orgId}&select=id,name_ar,name_en,cr_number&limit=1`);
      audit({ actor_user_id: sess.user.id, action: "org.switch", entity_type: "organization", entity_id: orgId });
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, organization: orgs[0] || null }));
    } catch { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "db_failed" })); }
  }
  if (b.action === "my-org-create") {
    if (!DB_ON) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "db_not_configured" })); }
    let sess = null;
    try { sess = await getSession(req); } catch { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "db_failed" })); }
    if (!sess) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "unauthorized" })); }
    const nameAr = String(b.name_ar || "").trim().slice(0, 200);
    const nameEn = String(b.name_en || "").trim().slice(0, 200);
    const crNum = String(b.cr || "").trim().slice(0, 40);
    if (!nameAr && !nameEn) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "name_required" })); }
    try {
      // Hard product limit: at most 100 companies per user, enforced here on the
      // server — the client-side form is not a security boundary. Counting
      // memberships (not owned orgs) keeps the check simple and errs on the
      // strict side; at the target scale the difference is irrelevant.
      const mine = await sb(`organization_members?user_id=eq.${sess.user.id}&status=eq.active&select=organization_id&limit=101`);
      if (mine.length >= 100) {
        res.statusCode = 403;
        return res.end(JSON.stringify({ ok: false, error: "org_limit_reached", limit: 100 }));
      }
      const orgs = await sb("organizations", { method: "POST", body: [{ name_ar: nameAr || nameEn, ...(nameEn ? { name_en: nameEn } : {}), ...(crNum ? { cr_number: crNum } : {}) }] });
      const orgId = orgs[0].id;
      await sb("organization_members", { method: "POST", prefer: "return=minimal", body: [{ organization_id: orgId, user_id: sess.user.id, role_id: "owner", status: "active" }] });
      await sb(`user_sessions?id=eq.${sess.sessionId}`, { method: "PATCH", prefer: "return=minimal", body: { organization_id: orgId } });
      audit({ actor_user_id: sess.user.id, action: "org.create", entity_type: "organization", entity_id: String(orgId) });
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, organization: orgs[0] }));
    } catch { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "db_failed" })); }
  }

  if (b.action === "my-org-update") {
    if (!DB_ON) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "db_not_configured" })); }
    let sess = null;
    try { sess = await getSession(req); } catch { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "db_failed" })); }
    if (!sess) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "unauthorized" })); }
    const nameAr = String(b.name_ar || "").trim().slice(0, 200);
    const nameEn = String(b.name_en || "").trim().slice(0, 200);
    const crNum = String(b.cr || "").trim().slice(0, 40);
    if (!nameAr && !nameEn && !crNum) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "empty" })); }
    try {
      let orgId = sess.organization && sess.organization.id;
      if (!orgId) {
        const orgs = await sb("organizations", { method: "POST", body: [{ name_ar: nameAr || nameEn || "منشأة" }] });
        orgId = orgs[0].id;
        await sb("organization_members", { method: "POST", prefer: "return=minimal", body: [{ organization_id: orgId, user_id: sess.user.id, role_id: "owner", status: "active" }] });
        await sb(`user_sessions?id=eq.${sess.sessionId}`, { method: "PATCH", prefer: "return=minimal", body: { organization_id: orgId } });
      }
      const patch = {};
      if (nameAr) patch.name_ar = nameAr;
      if (nameEn) patch.name_en = nameEn;
      if (crNum) patch.cr_number = crNum;
      const rows = await sb(`organizations?id=eq.${orgId}`, { method: "PATCH", body: patch });
      audit({ actor_user_id: sess.user && sess.user.id, action: "org.update", entity_type: "organization", entity_id: String(orgId) });
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, organization: (rows && rows[0]) || null }));
    } catch {
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "db_failed" }));
    }
  }

  // Analytics beacon: one page view / CTA click / client error per call, sent
  // by every page via sendBeacon. Public and fire-and-forget by design — it
  // always answers ok fast and stores nothing identifying beyond a random
  // per-browser token, so it can never block or slow a real page.
  if (b.action === "hit") {
    res.statusCode = 200;
    const done = () => res.end(JSON.stringify({ ok: true }));
    if (!DB_ON) return done();
    const kind = b.kind === "click" ? "click" : b.kind === "err" ? "err" : "view";
    const path = String(b.path || "").slice(0, 200);
    if (path.charAt(0) !== "/") return done();
    try {
      if (kind === "err") {
        await sb("site_errors", { method: "POST", prefer: "return=minimal", body: [{ path, message: String(b.name || "").slice(0, 300), source: String(b.source || "").slice(0, 160), ua: String(req.headers["user-agent"] || "").slice(0, 200) }] });
      } else {
        await sb("page_hits", { method: "POST", prefer: "return=minimal", body: [{ kind, path, name: kind === "click" ? String(b.name || "").slice(0, 80) : null, ref: String(b.ref || "").slice(0, 120), lang: String(b.lang || "").slice(0, 8), device: String(b.device || "").slice(0, 12), visitor: String(b.visitor || "").slice(0, 48) }] });
      }
    } catch {}
    return done();
  }

  // ---- escrow: wallet money held between client and supplier ---------------
  // The client funds the guarantee from their wallet; the amount leaves the
  // balance the moment the escrow opens and reaches the supplier's ledger only
  // when the client approves delivery. Refunds go through the owner.
  if (b.action === "escrow-create" || b.action === "escrow-release" || b.action === "escrow-refund") {
    if (!DB_ON) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "db_not_configured" })); }
    let sess = null;
    try { sess = await getSession(req); } catch { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "db_failed" })); }
    if (!sess) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "unauthorized" })); }
    const orgId = sess.organization && sess.organization.id;
    const myEmail = String((sess.user && sess.user.email) || "").toLowerCase();
    const myName = String((sess.user && sess.user.full_name) || "").trim() || myEmail;
    if (!orgId) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "no_org" })); }
    try {
      if (b.action === "escrow-create") {
        const supplierEmail = String(b.supplierEmail || "").trim().toLowerCase().slice(0, 160);
        const supplierName = String(b.supplierName || "").trim().slice(0, 160);
        const title = String(b.title || "").trim().slice(0, 300);
        const amount = Math.round((Number(b.amount) || 0) * 100) / 100;
        if (!isEmail(supplierEmail) || !title || !(amount > 0)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
        const bal = await sb(`wallet_balances?organization_id=eq.${orgId}&select=balance`);
        const balance = (bal[0] && Number(bal[0].balance)) || 0;
        if (balance < amount) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "insufficient_funds", balance })); }
        const ref = "BPE-" + crypto.randomInt(100000, 999999);
        const rows = await sb("escrows", { method: "POST", body: [{ ref, organization_id: orgId, client_email: myEmail, supplier_email: supplierEmail, supplier_name: supplierName, title, amount, status: "held" }] });
        await sb("wallet_transactions", { method: "POST", prefer: "return=minimal", body: [{ organization_id: orgId, type: "payment", amount: -amount, note: `حجز ضمان ${ref} — ${supplierName || supplierEmail}` }] });
        await audit({ organization_id: orgId, actor_user_id: sess.user.id, action: "escrow.create", entity_type: "escrow", entity_id: String(rows[0].id), after: { amount, supplierEmail } }).catch(() => {});
        await notify({ organization_id: orgId, event: "escrow_held", channel: "inapp", title: `تم حجز ${amount} ﷼ ضمان تنفيذ (${ref})`, idempotency_key: `escrow_held:${ref}` }).catch(() => {});
        await Promise.all([
          sendEmail(supplierEmail, `💼 ضمان تنفيذ محجوز لصالحك — ${ref}`, `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430"><h2 style="color:#0B1B5A">مبلغ ضمان محجوز لصالحك</h2><p>حجز العميل <b>${esc(myName)}</b> مبلغ <strong>${amount} ﷼</strong> ضمان تنفيذ عبر منصة بيزنس بارتنر:</p><table>${row("المرجع", ref) + row("موضوع الاتفاق", title) + row("المبلغ", amount + " ﷼")}</table><p>المبلغ محجوز لدى بيزنس بارتنر بضمان الطرفين. عند إتمام العمل اضغط <b>«سلّمت المشروع»</b> من <a href="${MKT_SITE_BASE}/partner-dashboard" style="color:#0B1B5A">لوحة الشريك ← محفظتي</a>، وبعد اعتماد العميل للاستلام يتحرر المبلغ إلى محفظتك فوراً.</p><p style="color:#0B1B5A">بزنس بارتنر</p></div>`),
          sendEmail(myEmail, `تم حجز الضمان ✅ — ${ref}`, `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430"><h2 style="color:#0B1B5A">تم حجز الضمان ✅</h2><p>خُصم <strong>${amount} ﷼</strong> من محفظتك وحُجز كضمان تنفيذ لدى بيزنس بارتنر — بتعميد الطرفين: المورد يعلن التسليم أولاً، ثم تعتمد أنت الاستلام فيتحرر المبلغ. ولا يُسترجع المبلغ إلا بموافقة المورد أو بقرار من فريقنا.</p><table>${row("المرجع", ref) + row("المورد", supplierName || supplierEmail) + row("الموضوع", title)}</table></div>`),
          sendEmail(TEAM_EMAIL, `💼 ضمان جديد ${ref} — ${myName} ← ${supplierName || supplierEmail} (${amount} ﷼)`, `<div dir="rtl" style="font-family:Arial,sans-serif"><p>ضمان تنفيذ فُتح من محفظة العميل — لا إجراء مطلوب حتى يعتمد العميل أو يطلب استرجاعاً.</p><table>${row("العميل", myName + " · " + myEmail) + row("المورد", (supplierName || "") + " · " + supplierEmail) + row("الموضوع", title) + row("المبلغ", amount + " ﷼")}</table></div>`),
          crmLead({ title: `ضمان تنفيذ — ${myName} ← ${supplierName || supplierEmail}`, phone: "", email: myEmail, notes: `ضمان · ${title} · ${amount} ﷼ · المورد: ${supplierEmail}`, ref, orderStatus: "مؤكد - قيد التنفيذ", total: amount }),
        ]).catch(() => {});
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, escrow: rows[0], balance: Math.round((balance - amount) * 100) / 100 }));
      }
      // release / refund-request act on one escrow this org owns.
      const id = String(b.id || "").slice(0, 60);
      if (!id) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "id_required" })); }
      if (b.action === "escrow-release") {
        // Two-sided handshake, like the freelance marketplaces: the money moves
        // to the supplier only after the supplier has declared delivery AND the
        // client approves receipt — this call is the client's half only.
        const cur = await sb(`escrows?id=eq.${encodeURIComponent(id)}&organization_id=eq.${orgId}&select=id,status,delivered_at`);
        const e0 = cur[0];
        if (!e0) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: "not_found" })); }
        const releasable = e0.status === "delivered" || (e0.status === "refund_requested" && e0.delivered_at);
        if (!releasable) {
          res.statusCode = 409;
          return res.end(JSON.stringify({ ok: false, error: e0.status === "held" ? "not_delivered_yet" : "not_releasable" }));
        }
        // The status guard makes this idempotent: a raced second click updates 0 rows.
        const rows = await sb(`escrows?id=eq.${encodeURIComponent(id)}&status=eq.${encodeURIComponent(e0.status)}`, { method: "PATCH", body: { status: "released", released_at: new Date().toISOString() } });
        if (!rows.length) { res.statusCode = 409; return res.end(JSON.stringify({ ok: false, error: "not_releasable" })); }
        const e2 = rows[0];
        await sb("supplier_wallet_transactions", { method: "POST", prefer: "return=minimal", body: [{ supplier_email: e2.supplier_email, type: "escrow_release", amount: Number(e2.amount), note: `تحرير ضمان ${e2.ref} — ${e2.title}`.slice(0, 300) }] });
        await audit({ organization_id: orgId, actor_user_id: sess.user.id, action: "escrow.release", entity_type: "escrow", entity_id: id }).catch(() => {});
        await Promise.all([
          sendEmail(e2.supplier_email, `✅ تحرّر ضمانك — ${e2.ref} (${e2.amount} ﷼)`, `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430"><h2 style="color:#047857">اعتمد العميل التسليم ✅</h2><p>تحرّر مبلغ <strong>${e2.amount} ﷼</strong> إلى محفظتك في <a href="${MKT_SITE_BASE}/partner-dashboard" style="color:#0B1B5A">لوحة الشريك</a> — اطلب السحب من هناك متى شئت.</p><table>${row("المرجع", e2.ref) + row("الموضوع", e2.title)}</table></div>`),
          sendEmail(TEAM_EMAIL, `✅ تحرير ضمان ${e2.ref} — إلى ${e2.supplier_email} (${e2.amount} ﷼)`, `<div dir="rtl" style="font-family:Arial,sans-serif"><p>اعتمد العميل التسليم وتحرّر الضمان إلى محفظة المورد. حوّل للمورد بنكياً عندما يطلب السحب (يصلك طلبه بالبريد).</p><table>${row("المورد", e2.supplier_email) + row("المبلغ", e2.amount + " ﷼")}</table></div>`),
        ]).catch(() => {});
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, escrow: e2 }));
      }
      // escrow-refund: the client asks for the money back. It reaches their
      // wallet only when the SUPPLIER consents (from the partner dashboard) or
      // Business Partner arbitrates — never on the client's word alone.
      const rows = await sb(`escrows?id=eq.${encodeURIComponent(id)}&organization_id=eq.${orgId}&status=in.(held,delivered)`, { method: "PATCH", body: { status: "refund_requested", note: String(b.reason || "").slice(0, 400), refund_requested_at: new Date().toISOString() } });
      if (!rows.length) { res.statusCode = 409; return res.end(JSON.stringify({ ok: false, error: "not_refundable" })); }
      const e3 = rows[0];
      await Promise.all([
        sendEmail(TEAM_EMAIL, `⚠️ طلب استرجاع ضمان ${e3.ref} — ${myName} (${e3.amount} ﷼)`, `<div dir="rtl" style="font-family:Arial,sans-serif"><p>طلب العميل استرجاع مبلغ الضمان. إن وافق المورد من لوحته يُسترجع تلقائياً؛ وإن اعترض فافصل أنت من لوحة /admin ← الأدوات ← الضمانات (استرجاع للعميل أو تحرير للمورد).</p><table>${row("العميل", myName + " · " + myEmail) + row("المورد", e3.supplier_email) + row("الموضوع", e3.title) + row("المبلغ", e3.amount + " ﷼") + row("سبب الطلب", String(b.reason || "—").slice(0, 400))}</table></div>`),
        sendEmail(e3.supplier_email, `⚠️ طلب استرجاع على الضمان ${e3.ref} — موافقتك مطلوبة`, `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430"><p>طلب العميل استرجاع مبلغ الضمان <b>${e3.ref}</b> (${e3.amount} ﷼).</p><p>السبب المذكور: ${esc(String(b.reason || "—").slice(0, 400))}</p><p>من <a href="${MKT_SITE_BASE}/partner-dashboard" style="color:#0B1B5A">لوحة الشريك ← محفظتي</a>: إن كنت موافقاً اضغط «أوافق على الإرجاع» ويعود المبلغ للعميل فوراً.</p><p>${e3.delivered_at
          ? "وإن كنت معترضاً وقد سلّمت العمل فعلاً فلا تضغط شيئاً — يفصل فريق بيزنس بارتنر بينكما ويبقى المبلغ محجوزاً حتى القرار."
          : "⏳ تنبيه: لم يُسجَّل أي تسليم على هذا الضمان — إن كنت أنجزت العمل فأعلن التسليم الآن من لوحتك، وإلا فسيُرجَع المبلغ للعميل <b>تلقائياً</b> إذا مضت المهلة المعلنة دون رد منك."}</p></div>`),
      ]).catch(() => {});
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, escrow: e3 }));
    } catch (e) {
      console.error("escrow action failed", String(e).slice(0, 200));
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "db_failed" }));
    }
  }

  // Checkout's "upload your certificate and we fill the form" step. Public by
  // necessity — the buyer is not signed into anything at that point — so the
  // size and type caps are enforced before a provider is called, and the reply
  // carries only the fixed invoice-field set.
  if (b.type === "read-doc") {
    res.setHeader("Cache-Control", "no-store");
    const b64 = String(b.fileBase64 || "");
    if (Buffer.byteLength(b64, "base64") > MAX_DOC_BYTES) { res.statusCode = 413; return res.end(JSON.stringify({ ok: false, error: "too_large" })); }
    const out = await readDocument(b64, String(b.fileType || ""));
    res.statusCode = out.ok ? 200 : (out.error === "not_configured" ? 503 : 400);
    return res.end(JSON.stringify(out));
  }

  // ---- Confirmed online payment → automatic activation ----------------------
  // POSTed server-to-server by api/pay.js after Moyasar confirms a cart
  // payment. The payload arrives sealed with OTP_SECRET, so only code that
  // holds the server secret — never a browser — can declare an order paid.
  // Everything the owner used to do by hand after checking a bank receipt
  // happens here in one pass: the CRM row lands already confirmed, the gated
  // portals activate, and the client's access codes go out by email.
  // A confirmed Moyasar wallet top-up, sealed by /api/pay with the server
  // secret — the browser can never credit a wallet; only the payment gateway's
  // verified confirmation can. Idempotent on the payment id, so the webhook
  // and the browser callback (both fire for one charge) credit exactly once.
  if (b.action === "wallet-paid") {
    if (!OTP_SECRET) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "not_configured" })); }
    let d; try { d = ssUnseal(b.t); } catch { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "bad_seal" })); }
    if (!d || !(Date.now() - (Number(d.at) || 0) < 30 * 60 * 1000)) {
      res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "expired" }));
    }
    const email = String(d.email || "").trim().toLowerCase().slice(0, 160);
    const name = String(d.name || "").trim().slice(0, 160);
    const amount = Math.round((Number(d.amount) || 0) * 100) / 100;
    const payId = String(d.payId || "").slice(0, 64);
    const ref = String(d.ref || "BPW-" + Date.now().toString().slice(-6)).slice(0, 40);
    if (!isEmail(email) || !(amount > 0) || !payId) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "bad_request" })); }
    let credited = false, already = false, balance = null;
    if (DB_ON) {
      try {
        const dup = await sb(`wallet_transactions?note=like.*PAYID:${encodeURIComponent(payId)}*&select=id&limit=1`);
        if (dup.length) { already = true; }
        else {
          // Resolve the wallet's organization from the payer's account —
          // metadata may nominate one of their orgs, never someone else's.
          let users = await sb(`users?email=eq.${encodeURIComponent(email)}&select=id&limit=1`);
          if (!users.length) users = await sb("users", { method: "POST", body: [{ email, ...(name ? { full_name: name } : {}) }] });
          const uid = users[0].id;
          const mems = await sb(`organization_members?user_id=eq.${uid}&status=eq.active&select=organization_id`);
          const wanted = String(d.org || "").trim();
          let orgId = (mems.find((m) => m.organization_id === wanted) || mems[0] || {}).organization_id;
          if (!orgId) {
            const orgs = await sb("organizations", { method: "POST", body: [{ name_ar: name || email }] });
            orgId = orgs[0].id;
            await sb("organization_members", { method: "POST", prefer: "return=minimal", body: [{ organization_id: orgId, user_id: uid, role_id: "owner", status: "active" }] });
          }
          await sb("wallet_accounts?on_conflict=organization_id", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: [{ organization_id: orgId }] });
          await sb("wallet_transactions", { method: "POST", prefer: "return=minimal", body: [{ organization_id: orgId, type: "topup", amount, note: `شحن إلكتروني (ميسر) · PAYID:${payId} · ${ref}` }] });
          await sb("payments", { method: "POST", prefer: "return=minimal", body: [{ organization_id: orgId, method: "moyasar", status: "paid", amount, gateway_ref: payId }] }).catch(() => {});
          const bal = await sb(`wallet_balances?organization_id=eq.${orgId}&select=balance`);
          balance = (bal[0] && Number(bal[0].balance)) || 0;
          credited = true;
          await audit({ organization_id: orgId, actor_label: "moyasar:webhook", action: "wallet.topup", entity_type: "wallet", after: { amount, payId } }).catch(() => {});
          await notify({ organization_id: orgId, event: "wallet_topup_paid", channel: "inapp", title: `تم شحن محفظتك إلكترونياً (+${amount} ﷼)`, idempotency_key: `wallet_paid:${payId}` }).catch(() => {});
        }
      } catch (e) { console.error("wallet-paid credit failed", String(e).slice(0, 200)); }
    }
    if (!already) {
      await Promise.all([
        crmLead({ title: `شحن محفظة (إلكتروني) — ${name || email}`, phone: "", email, notes: `محفظة · شحن إلكتروني ${amount} ﷼ · PAYID:${payId}${credited ? "" : " · ⚠️ لم يُقيَّد في قاعدة البيانات — قيّده يدوياً"}`, ref, orderStatus: credited ? "مكتمل" : "قيد المراجعة", total: amount }),
        sendEmail(email, `تم شحن محفظتك ✅ — ${ref}`, `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430"><h2 style="color:#0B1B5A">تم شحن محفظتك ✅</h2><p>وصل مبلغ <strong>${amount} ﷼</strong> إلى محفظتك ورصيدك محدث الآن في لوحتك.</p><table>${row("رقم المرجع", ref) + row("المبلغ", amount + " ﷼")}</table><p><a href="${MKT_SITE_BASE}/account" style="color:#0B1B5A">افتح لوحتك</a></p><p style="color:#0B1B5A">بزنس بارتنر</p></div>`),
        credited
          ? sendEmail(TEAM_EMAIL, `💰 شحن محفظة إلكتروني ${ref} — ${name || email} (${amount} ﷼) — لا إجراء مطلوب`, `<div dir="rtl" style="font-family:Arial,sans-serif"><p>دفعة ميسر مؤكدة قُيّدت تلقائياً في محفظة العميل.</p><table>${row("العميل", name || email) + row("البريد", email) + row("المبلغ", amount + " ﷼") + row("رقم الدفعة", payId)}</table></div>`)
          : sendEmail(TEAM_EMAIL, `⚠️ شحن محفظة إلكتروني ${ref} لم يُقيَّد — ${email} (${amount} ﷼)`, `<div dir="rtl" style="font-family:Arial,sans-serif"><p>الدفعة مؤكدة في ميسر لكن القيد في قاعدة البيانات لم يكتمل — قيّده يدوياً من لوحة /admin (إدخال محفظة).</p><table>${row("البريد", email) + row("المبلغ", amount + " ﷼") + row("رقم الدفعة", payId)}</table></div>`),
      ]).catch(() => {});
    }
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, already, credited, balance }));
  }

  if (b.action === "paid-order") {
    if (!OTP_SECRET) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "not_configured" })); }
    let d; try { d = ssUnseal(b.t); } catch { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "bad_seal" })); }
    // A seal older than half an hour is a replay, not a payment settling.
    if (!d || !d.ref || !(Date.now() - (Number(d.at) || 0) < 30 * 60 * 1000)) {
      res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "expired" }));
    }
    const ref = String(d.ref).slice(0, 40);
    const name = String(d.name || "").trim().slice(0, 160);
    const email = String(d.email || "").trim().toLowerCase().slice(0, 160);
    const phone = String(d.phone || "").trim().slice(0, 40);
    const company = String(d.company || "").trim().slice(0, 200) || name;
    const total = Number(d.total) || 0;
    const payId = String(d.payId || "").slice(0, 64);
    const verified = !!d.verified;
    const ids = (Array.isArray(d.ids) ? d.ids : []).slice(0, 40)
      .map((x) => ({ id: String((x && x.id) || "").slice(0, 80), qty: Math.max(1, Math.min(99, Number(x && x.qty) || 1)) }))
      .filter((x) => x.id);
    // Entitlements come from the paid item ids themselves, not from flags a
    // page could claim — the same ids the amount was verified against.
    const lower = (s) => String(s || "").toLowerCase();
    const agents = ids.filter((x) => lower(x.id).indexOf("employee-") === 0).map((x) => x.id.slice("employee-".length).toLowerCase()).filter((s) => /^[a-z0-9]{1,30}$/.test(s));
    const boughtShared = ids.some((x) => lower(x.id).indexOf("agent-shared-services") === 0);
    if (boughtShared) agents.push("all");
    const boughtCompliance = ids.some((x) => lower(x.id).indexOf("agent-compliance") === 0);
    const empItem = ids.map((x) => lower(x.id)).find((id) => id.indexOf("employer-plan-") === 0) || "";
    const employerPlan = empItem ? empItem.replace("employer-plan-", "").replace(/-monthly$|-yearly$/, "") : "";
    const boughtData = ids.some((x) => lower(x.id) === "companies-data-access");
    const gatedCount = (boughtCompliance ? 1 : 0) + (employerPlan ? 1 : 0) + (boughtShared ? 1 : 0) + (boughtData ? 1 : 0) + agents.filter((a) => a !== "all").length;
    const plainItems = ids.filter((x) => {
      const id = lower(x.id);
      return !(id.indexOf("employee-") === 0 || id.indexOf("agent-") === 0 || id.indexOf("employer-plan-") === 0 || id === "companies-data-access");
    });
    const itemsText = (Array.isArray(d.items) && d.items.length ? d.items.map(String) : ids.map((x) => x.id + " ×" + x.qty)).join("، ").slice(0, 900);

    // Idempotent: the browser callback and the Moyasar webhook both land here
    // for the same payment; the CRM row records which one arrived first. The
    // payment id is checked too — one paid charge must not activate twice
    // under two invented references.
    let dup = null;
    try { dup = await findConvPage(ref); } catch { dup = null; }
    if (!dup && payId && NOTION_TOKEN) {
      try {
        const rq = await fetch(`https://api.notion.com/v1/databases/${CRM_DB}/query`, {
          method: "POST",
          headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
          body: JSON.stringify({ page_size: 1, filter: { property: "Notes", rich_text: { contains: "PAYID:" + payId } } }),
        });
        if (rq.ok) dup = (((await rq.json()) || {}).results || [])[0] || null;
      } catch { /* best-effort */ }
    }
    if (dup) { res.statusCode = 200; return res.end(JSON.stringify({ ok: true, already: true })); }

    // The companies-data portal has no per-account backend, so its access code
    // is minted here and written on the CRM row — /api/pay?resource=leads
    // accepts it by looking the row up (status must stay confirmed).
    const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const dh = crypto.createHmac("sha256", OTP_SECRET).update("data|" + ref + "|" + email).digest();
    let dataCode = ""; if (boughtData) { let o = ""; for (let i = 0; i < 6; i++) o += abc[dh[i] % abc.length]; dataCode = "BP-DATA-" + o; }

    const statusForRow = verified ? "مؤكد - قيد التنفيذ" : "قيد المراجعة";
    await crmLead({
      title: `💳 طلب مدفوع إلكترونياً — ${name || email}`,
      phone, email,
      notes: `دفع إلكتروني (ميسر) مؤكد · PAYID:${payId}${d.disc ? ` · كود خصم: ${String(d.disc).slice(0, 30)}` : ""} · ${itemsText}${dataCode ? ` · DATACODE:${dataCode}` : ""}${company && company !== name ? ` · المنشأة: ${company}` : ""}${verified ? "" : " · ⚠️ المبلغ لم يُطابَق آلياً مع الكتالوج"}`,
      ref, orderStatus: statusForRow, agents, total,
    });

    const activated = {};
    if (verified) {
      if (boughtCompliance && isEmail(email)) {
        try { activated.compliance = !!(await approveCompliance({ company, email, phone })); } catch (e) { console.error("paid-order compliance", String(e).slice(0, 120)); activated.compliance = false; }
      }
      if (employerPlan && isEmail(email)) {
        try { activated.employer = !!(await approveEmployer({ company, email, phone, plan: employerPlan })); } catch (e) { console.error("paid-order employer", String(e).slice(0, 120)); activated.employer = false; }
      }
      if (boughtShared && isEmail(email)) {
        try { activated.shared = !!(await approveShared({ email, name, phone, ref })); } catch (e) { console.error("paid-order shared", String(e).slice(0, 120)); activated.shared = false; }
      }
      if (boughtData && isEmail(email)) {
        try {
          const dHtml = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;text-align:right" dir="rtl"><h2 style="color:#0B1B5A">تم تفعيل اشتراكك — قاعدة بيانات الشركات 🎉</h2><p>كود الوصول الخاص بك:</p><p style="font-size:26px;font-weight:bold;letter-spacing:4px;color:#0B1B5A">${esc(dataCode)}</p><p><a href="${MKT_SITE_BASE}/data" style="background:#0B1B5A;color:#fff;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:bold">افتح قاعدة البيانات</a> — أدخل الكود أعلاه.</p></div>`;
          activated.data = !!(await sendEmail(email, `كود الوصول — قاعدة بيانات الشركات (${dataCode})`, dHtml)).ok;
        } catch { activated.data = false; }
      }
      if (agents.length && !boughtShared && isEmail(email)) {
        try {
          const aHtml = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;text-align:right" dir="rtl"><h2 style="color:#0B1B5A">تم تفعيل موظفيك الأذكياء 🎉</h2><p>بوابتك مفتوحة الآن. رمز الدخول هو <b>رقم مرجع طلبك</b>:</p><p style="font-size:26px;font-weight:bold;letter-spacing:4px;color:#0B1B5A">${esc(ref)}</p><p><a href="${MKT_SITE_BASE}/ar/connect" style="background:#0B1B5A;color:#fff;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:bold">افتح بوابة الموظفين الأذكياء</a> — أدخل الرمز أعلاه مع بريدك (${esc(email)}).</p></div>`;
          activated.agents = !!(await sendEmail(email, `تم تفعيل موظفيك الأذكياء — رمز الدخول ${ref}`, aHtml)).ok;
        } catch { activated.agents = false; }
      }
      if (plainItems.length && isEmail(email)) {
        try { activated.service = !!(await approveService({ service: itemsText, company: company !== name ? company : "", email, phone, ref, note: "تم تأكيد دفعتك الإلكترونية وبدأ التنفيذ مباشرة." })); } catch { activated.service = false; }
      }
    }

    // The owner hears about it, but as news — not as a task. Unless the amount
    // could not be matched to the catalogue, in which case the old approval
    // links are attached and nothing gated activates until one is clicked.
    const doneList = Object.keys(activated).filter((k) => activated[k]);
    const okHtml = `<div dir="rtl" style="font-family:Arial,sans-serif"><h2 style="color:#0B1B5A">💳 طلب مدفوع إلكترونياً ${esc(ref)} — مفعّل تلقائياً</h2><table>${row("الاسم", name) + row("الجوال", phone) + row("البريد", email) + row("الخدمات", itemsText) + row("الإجمالي المدفوع", total ? total + " ﷼" : "") + row("رقم عملية ميسر", payId)}</table><p>✅ الدفع تحقّقنا منه من ميسر مباشرة، والحالة في CRM «مؤكد - قيد التنفيذ».</p>${doneList.length ? `<p>تفعيلات آلية تمت: <b>${doneList.join("، ")}</b> — وصلت العميل أكواد الوصول على بريده.</p>` : ""}<p style="color:#666;font-size:13px">لا يلزمك أي إجراء.</p></div>`;
    const reviewLinks = [
      boughtCompliance && isEmail(email) ? `<p><a href="${MKT_SITE_BASE}/api/requests?action=approve-compliance&t=${encodeURIComponent(ssSeal({ company, email, phone, ref }))}" style="background:#0B1B5A;color:#fff;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:bold">✅ تفعيل وكيل الامتثال</a></p>` : "",
      employerPlan && isEmail(email) ? `<p><a href="${MKT_SITE_BASE}/api/requests?action=approve-employer&t=${encodeURIComponent(ssSeal({ company, email, phone, ref, plan: employerPlan }))}" style="background:#0B1B5A;color:#fff;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:bold">✅ تفعيل منصة التوظيف</a></p>` : "",
      boughtShared && isEmail(email) ? `<p><a href="${MKT_SITE_BASE}/api/requests?action=approve&t=${encodeURIComponent(ssSeal({ email, name, phone, ref }))}" style="background:#0B1B5A;color:#fff;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:bold">✅ اعتماد الخدمات المشتركة</a></p>` : "",
    ].filter(Boolean).join("");
    const reviewHtml = `<div dir="rtl" style="font-family:Arial,sans-serif"><h2 style="color:#b45309">💳 دفعة إلكترونية ${esc(ref)} تحتاج مراجعة سريعة</h2><table>${row("الاسم", name) + row("الجوال", phone) + row("البريد", email) + row("الخدمات", itemsText) + row("الإجمالي المدفوع", total ? total + " ﷼" : "") + row("رقم عملية ميسر", payId)}</table><p>الدفع نفسه مؤكد من ميسر، لكن المبلغ لم يُطابَق آلياً مع أسعار الكتالوج، فلم نفعّل البوابات تلقائياً.</p><p>بعد مراجعة المبلغ: افتح صف الطلب (رقم المرجع ${esc(ref)}) وغيّر حالة الطلب إلى «مؤكد - قيد التنفيذ»${reviewLinks ? "، وفعّل الاشتراكات:" : "."}</p>${reviewLinks}</div>`;
    const ownerSubject = verified ? `💳 طلب مدفوع إلكترونياً ${ref} — مفعّل تلقائياً` : `⚠️ دفعة إلكترونية ${ref} تحتاج مراجعة`;
    const ownerHtml2 = verified ? okHtml : reviewHtml;
    const cHtml2 = `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430"><h2 style="color:#0B1B5A">تم استلام دفعتك${verified ? " وتفعيل خدمتك" : ""} ✅</h2><p>مرحباً ${esc(name || "")}،</p><p>${verified ? "وصلتنا دفعتك الإلكترونية بنجاح وبدأ التنفيذ مباشرة — أي أكواد وصول لخدماتك تصلك في رسائل منفصلة على هذا البريد." : "وصلتنا دفعتك الإلكترونية بنجاح، وجاري تفعيل خدمتك — يصلك تأكيد التفعيل خلال ساعات العمل."}</p><table>${row("رقم المرجع", ref) + row("الخدمات", itemsText) + row("الإجمالي", total ? total + " ﷼" : "")}</table><p>تابع حالة طلبك من لوحتك: <a href="${MKT_SITE_BASE}/ar/account" style="color:#0B1B5A">${MKT_SITE_BASE}/ar/account</a></p></div>`;
    await Promise.all([
      sendEmail(TEAM_EMAIL, ownerSubject, ownerHtml2),
      OWNER_EMAIL && OWNER_EMAIL !== TEAM_EMAIL ? sendEmail(OWNER_EMAIL, ownerSubject, ownerHtml2) : Promise.resolve(),
      isEmail(email) ? sendEmail(email, verified ? `تم الدفع وتفعيل خدمتك — ${ref}` : `تم استلام دفعتك — ${ref}`, cHtml2) : Promise.resolve(),
      addToAudience(email, name),
      forwardLead({ source: "paid-order", ref, name, phone, email, items: itemsText, total }),
    ]);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, already: false, verified, activated, ...(gatedCount ? { gated: gatedCount } : {}) }));
  }

  if (b.type === "order") {
    const name = String(b.name || "").trim().slice(0, 160);
    const phone = String(b.phone || "").trim().slice(0, 40);
    const email = String(b.email || "").trim().toLowerCase().slice(0, 160);
    const ref = String(b.ref || "BP-" + Date.now().toString().slice(-6)).slice(0, 40);
    const items = (Array.isArray(b.items) ? b.items.map((x) => (typeof x === "string" ? x : (x && x.name) || "")).filter(Boolean) : [String(b.items || "")]).join("، ").slice(0, 900);
    const totalNum = Number(b.total);
    const clientTotal = Number.isFinite(totalNum) ? totalNum : 0;
    // Server-side authoritative pricing: re-price the cart from the public
    // catalog by item id so a client-side glitch can never record a 0-riyal
    // order. The client total (subtotal + 15% VAT) is kept for comparison.
    const itemsData = Array.isArray(b.itemsData) ? b.itemsData.slice(0, 40) : [];
    let serverSubtotal = 0;
    const pricedItems = [], pricedRows = [];
    if (itemsData.length) {
      const priceMap = await catalogPrices().catch(() => null);
      if (priceMap) {
        for (const it of itemsData) {
          const rawKey = String((it && it.id) || "").toLowerCase();
          // Cart ids are prefixed (svc-bp-chamber-01, pkg-silver) while the
          // catalog map keys are bare codes — normalize before the lookup.
          const key = catalogKey(rawKey);
          const qty = Math.max(1, Math.min(99, Number(it && it.qty) || 1));
          const cat = key && priceMap[key];
          const unit = cat ? cat.amount : 0;
          serverSubtotal += unit * qty;
          pricedRows.push({ key, line: unit * qty });
          if (rawKey) pricedItems.push(`${key || rawKey}×${qty}${unit ? "=" + unit * qty : ""}`);
        }
      }
    }
    const surchargeForTotal = Number.isFinite(Number(b.surchargeFee)) ? Number(b.surchargeFee) : 0;
    // The same discount the checkout showed, re-derived from the catalog: the
    // receipt's amount is compared against a figure the client cannot invent.
    // A code scoped to specific services cuts only from its own lines.
    const orderDisc = catalogDiscountSync(b.discountCode);
    let discCut = 0;
    if (orderDisc && serverSubtotal + surchargeForTotal > 0) {
      const preNet = orderDisc.services.length
        ? pricedRows.reduce((s, r) => s + (orderDisc.services.includes(r.key) ? r.line : 0), 0)
        : serverSubtotal + surchargeForTotal;
      discCut = orderDisc.percent ? Math.round(((preNet * orderDisc.percent) / 100) * 100) / 100 : Math.min(preNet, orderDisc.amount);
    }
    const serverTotal = serverSubtotal > 0 ? Math.round((serverSubtotal + surchargeForTotal - discCut) * 1.15 * 100) / 100 : 0;
    // Effective total: prefer the client total when present, else the server
    // re-price — so orders never land as 0 when the catalog knows the price.
    const total = clientTotal > 0 ? clientTotal : serverTotal;
    const totalMismatch = clientTotal > 0 && serverTotal > 0 && Math.abs(clientTotal - serverTotal) > 1;
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
    // The buyer's tax-invoice profile, chosen at checkout. A standard tax
    // invoice cannot be amended once issued, so this travels with the order
    // and is written into the CRM row the invoice is later issued from.
    const tp = (b.taxProfile && typeof b.taxProfile === "object") ? b.taxProfile : {};
    const taxIsCompany = tp.kind === "company";
    const taxVat = String(tp.vat || "").replace(/\D/g, "").slice(0, 15);
    const taxNameAr = String(tp.nameAr || "").trim().slice(0, 200);
    const taxContact = String(tp.contact || "").trim().slice(0, 120);
    const taxContactPhone = String(tp.contactPhone || "").trim().slice(0, 40);
    const taxAddr = (tp.address && typeof tp.address === "object") ? tp.address : {};
    const taxAddrLine = nationalAddressLine(taxAddr);
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
    const taxNote = taxIsCompany
      ? `<p style="background:#f1f5f9;padding:10px 12px;border-radius:8px">🧾 <strong>فاتورة باسم منشأة</strong> — الاسم: <strong>${esc(taxNameAr)}</strong> · الرقم الضريبي: <strong>${esc(taxVat)}</strong>${tp.cr ? ` · س.ت: <strong>${esc(String(tp.cr))}</strong>` : ""}<br>المسؤول: <strong>${esc(taxContact)}</strong> — ${esc(taxContactPhone)}<br>العنوان الوطني: <strong>${esc(taxAddrLine || "—")}</strong></p>`
      : `<p style="background:#f1f5f9;padding:10px 12px;border-radius:8px">🧾 <strong>فاتورة باسم شخصي</strong> (مبسّطة) — لا يوجد رقم ضريبي للمشتري.</p>`;
    const mismatchNote = totalMismatch
      ? `<p style="color:#b91c1c">⚠️ إجمالي العميل (${clientTotal} ﷼) لا يطابق إعادة التسعير من الكتالوج (${serverTotal} ﷼) — راجع المبلغ قبل الاعتماد.</p>`
      : "";
    const codesNote = pricedItems.length ? `<p style="color:#666;font-size:13px">أكواد الخدمات: ${esc(pricedItems.join(" · "))}</p>` : "";
    const discNote = orderDisc ? `<p style="color:#047857">🎟️ كود خصم مطبق: <b>${esc(orderDisc.code)}</b>${discCut ? ` (−${discCut} ﷼ قبل الضريبة)` : ""}</p>` : "";
    // Monthly subscriptions (Revenue OS packages). The renewal price and the
    // success-fee percentage were shown to the buyer and accepted by them at
    // checkout; recording them on the order is what makes them enforceable and
    // what stops the team from looking a percentage up later. Values are
    // re-clamped here — the browser may display terms, it may not decide them.
    const subs = (Array.isArray(b.subscriptions) ? b.subscriptions : []).slice(0, 10).map((s) => ({
      id: String((s && s.id) || "").slice(0, 60),
      name: String((s && s.name) || "").slice(0, 160),
      firstAmount: Math.max(0, Math.min(1e6, Number(s && s.firstAmount) || 0)),
      renewsAt: Math.max(0, Math.min(1e6, Number(s && s.renewsAt) || 0)),
      commissionPercent: Math.max(0, Math.min(50, Number(s && s.commissionPercent) || 0)),
    })).filter((s) => s.id);
    const subsNotesText = subs.length
      ? " · اشتراك شهري: " + subs.map((s) => `${s.name || s.id} (يتجدد ${s.renewsAt} ﷼/شهر · عمولة ${s.commissionPercent}%)`).join(" ، ")
      : "";
    const subsNote = subs.length
      ? `<p style="background:#FFFBF2;border:1px solid #E7D9B8;padding:10px 12px;border-radius:8px">🔁 <strong>اشتراك شهري — وافق عليه العميل عند الدفع</strong><br>${subs.map((s) => `${esc(s.name || s.id)}: أول دفعة <strong>${s.firstAmount} ﷼</strong> · يتجدد بـ <strong>${s.renewsAt} ﷼ شهرياً</strong> · عمولة نجاح <strong>${s.commissionPercent}%</strong> على الإيراد المحصّل`).join("<br>")}<br><span style="color:#7C530E">التجديد ليس آلياً — أضف تذكير التجديد يدوياً بعد اعتماد الطلب.</span></p>`
      : "";
    const oHtml = `<div style="font-family:Arial,sans-serif"><h2 style="color:#0B1B5A">طلب جديد ${ref}</h2><table>${row("الاسم", name) + row("الجوال", phone) + row("البريد", email) + row("الخدمات", items) + row("الإجمالي", total ? total + " ﷼" : "")}</table>${codesNote}${discNote}${mismatchNote}${subsNote}${taxNote}${pkgFieldsNote}${agentsNote}${complianceNote}${employerNote}${receiptNote}<p>بعد تأكيد مطابقة المبلغ: افتح صف الطلب في قاعدة «Sales Pipeline» في Notion (رقم المرجع ${ref}) وغيّر <strong>حالة الطلب</strong> إلى «مؤكد - قيد التنفيذ» ثم «مكتمل». تظهر الحالة فوراً في لوحة العميل /account بلا إعادة نشر.</p></div>`;
    const pkgNotesText = (crNumber || headcount != null || nationalAddress) ? ` · س.ت: ${crNumber || "—"} · موظفين: ${headcount != null ? headcount : "—"}${nationalAddress ? " · عنوان: " + nationalAddress : ""}` : "";
    // The establishment the buyer typed at checkout. It was only ever used for
    // the subscription approval emails, so an order placed for a company was
    // invoiced under the individual's name — the buyer had already said whose
    // name it should carry and nothing carried it forward.
    const companyNotesText = company && company !== name ? ` · المنشأة: ${company}` : "";
    // Labelled so listLeads can parse it back and the /admin invoice form
    // prefills instead of the owner re-keying it off the notification email.
    const taxNotesText = taxIsCompany
      ? ` · نوع الفاتورة: منشأة · اسم المنشأة: ${taxNameAr} · الرقم الضريبي: ${taxVat}${tp.cr ? ` · س.ت الضريبي: ${String(tp.cr).slice(0, 40)}` : ""} · المسؤول: ${taxContact} · جوال المسؤول: ${taxContactPhone}${taxAddrLine ? ` · العنوان الوطني: ${taxAddrLine}` : ""}`
      : " · نوع الفاتورة: شخصي";
    // Which partner sent this buyer, when one did. Recorded on the row so the
    // commission is settled against evidence rather than a claim after the fact.
    const partnerRefCode = String(b.partnerRef || "").trim().toUpperCase().slice(0, 24);
    const partnerRefText = /^[A-Z0-9-]{4,24}$/.test(partnerRefCode) ? ` · عبر الشريك: ${partnerRefCode}` : "";
    // Immediate acknowledgment to the client — "we received your payment, we're verifying it".
    // The n8n verification agent later sends the "confirmed / activated" email once the receipt amount matches.
    const cHtml = `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430"><h2 style="color:#0B1B5A">استلمنا طلبك ودفعتك ✅</h2><p>مرحباً ${esc(name)},</p><p>وصلنا طلبك وإيصال التحويل البنكي بنجاح. فريقنا ووكيل التحقق الآلي يراجعان الإيصال الآن، وبمجرد تأكيد مطابقة المبلغ ستصلك رسالة تأكيد التفعيل مباشرةً.</p><table>${row("رقم المرجع", ref) + row("الخدمات", items) + row("الإجمالي", total ? total + " ﷼" : "")}</table><p>يمكنك متابعة حالة طلبك في لوحتك: <a href="${MKT_SITE_BASE}/account" style="color:#0B1B5A">${MKT_SITE_BASE}/account</a></p><p style="color:#0B1B5A">بزنس بارتنر · محفول مكفول</p></div>`;
    const [teamSent, ownerSent] = await Promise.all([
      sendEmail(TEAM_EMAIL, `طلب جديد ${ref} — ${name}`, oHtml),
      // Also notify the owner mailbox directly — if the team address ever has a
      // delivery issue (e.g. unverified sender domain), the order is still seen.
      OWNER_EMAIL && OWNER_EMAIL !== TEAM_EMAIL ? sendEmail(OWNER_EMAIL, `طلب جديد ${ref} — ${name}`, oHtml) : Promise.resolve({ ok: false }),
      isEmail(email) ? sendEmail(email, `تم استلام طلبك ودفعتك — ${ref}`, cHtml) : Promise.resolve(),
      crmLead({ title: `طلب/شراء خدمة — ${name}`, phone, email, notes: `طلب · ${items}${total ? " · إجمالي " + total : ""}${orderDisc ? " · كود خصم: " + orderDisc.code : ""}${pricedItems.length ? " · أكواد: " + pricedItems.join(",") : ""}${pkgNotesText}${subsNotesText}${companyNotesText}${taxNotesText}${partnerRefText}`, ref, orderStatus: "قيد المراجعة", agents, total, receiptUploadId, receiptName }),
      addToAudience(email, name),
      forwardLead({ source: "order", ref, name, phone, email, items, total }),
    ]);
    if (!(teamSent && teamSent.ok) && !(ownerSent && ownerSent.ok)) console.error("order notification email failed for", ref);
    // P2: operational-DB dual write with server-side pricing (session-scoped).
    // Best-effort — a DB hiccup must never fail the customer's order.
    try { await recordOrderInDb(req, b, ref); } catch (e) { console.error("db order write failed", String(e).slice(0, 200)); }
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
    // P2: record the pending top-up in the operational DB (credit happens
    // only when the owner confirms via panel-wallet-entry — never here).
    if (DB_ON) {
      try {
        const sess = await getSession(req).catch(() => null);
        const orgId = sess && sess.organization && sess.organization.id;
        if (orgId) {
          await sb("wallet_accounts?on_conflict=organization_id", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: [{ organization_id: orgId }] });
          await sb("payments", { method: "POST", prefer: "return=minimal", body: [{ organization_id: orgId, method: "bank_transfer", status: "pending_review", amount }] });
          await notify({ organization_id: orgId, event: "wallet_topup_pending", channel: "inapp", title: `طلب شحن المحفظة ${ref} (${amount} ﷼) — بانتظار التحقق`, idempotency_key: `wallet_topup:${ref}` });
        }
      } catch (e) { console.error("db wallet write failed", String(e).slice(0, 200)); }
    }
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ref, receiptUploaded: !!receiptUploadId }));
  }

  // Wallet payment: the client asks us to pay a government fee / SADAD invoice
  // from their wallet balance. The team validates the balance in the CRM ledger
  // (top-ups minus payments), executes the payment, and completes the row.
  // طلب من داخل لوحة العميل: يختار الخدمات ويدفع الآن (محفظة/بطاقة/تحويل)
  // أو لاحقاً بفاتورة مؤجلة لها تاريخ استحقاق — بلا مغادرة اللوحة.
  // التسعير من الكتالوج على الخادم: العميل لا يملك تحديد ما يدفعه.
  if (b.type === "portal-order") {
    const sess = await getSession(req).catch(() => null);
    if (!sess) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "unauthorized" })); }
    const email = String((sess.user && sess.user.email) || "").toLowerCase();
    const name = String((sess.user && sess.user.full_name) || "").slice(0, 160) || email.split("@")[0];
    const orgId = sess.organization && sess.organization.id;
    const orgName = (sess.organization && (sess.organization.name_ar || sess.organization.name_en)) || "";
    const PAY_MODES = { wallet: "المحفظة", later: "ادفع لاحقاً", card: "بطاقة إلكترونية", transfer: "تحويل بنكي" };
    const pay = PAY_MODES[String(b.pay || "")] ? String(b.pay) : "later";
    const dueDays = pay === "later" ? Math.min(60, Math.max(1, Number(b.dueDays) || 14)) : 0;
    const wanted = (Array.isArray(b.items) ? b.items : []).slice(0, 30);
    if (!wanted.length) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "empty_cart" })); }

    let priceMap = null;
    try { priceMap = await catalogPrices(); } catch { priceMap = null; }
    if (!priceMap) { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "catalog_unavailable" })); }
    let subtotal = 0;
    const lines = [];
    for (const it of wanted) {
      const key = catalogKey(String((it && it.id) || "").toLowerCase());
      const qty = Math.max(1, Math.min(20, Number(it && it.qty) || 1));
      const hit = key && priceMap[key];
      if (!hit) continue;
      subtotal += hit.amount * qty;
      lines.push({ key, name: hit.name, qty, line: hit.amount * qty });
    }
    if (!lines.length) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "no_priced_items" })); }
    const vat = Math.round(subtotal * 0.15 * 100) / 100;
    const total = Math.round((subtotal + vat) * 100) / 100;
    const ref = "BPO-" + Date.now().toString().slice(-6);
    const itemsTxt = lines.map((l) => `${l.name}${l.qty > 1 ? " ×" + l.qty : ""}`).join("، ").slice(0, 800);
    const dueISO = pay === "later" ? plusDaysISO(dueDays) : plusDaysISO(0);

    // Paying from the wallet is the only mode that settles instantly — and
    // only when the balance actually covers it. Everything else books the
    // order and puts the money question on a dated follow-up.
    let paid = false, walletAfter = null;
    if (pay === "wallet") {
      if (!DB_ON || !orgId) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "wallet_unavailable" })); }
      try {
        const bal = await sb(`wallet_balances?organization_id=eq.${orgId}&select=balance`);
        const balance = (bal && bal[0] && Number(bal[0].balance)) || 0;
        if (balance < total) {
          res.statusCode = 200;
          return res.end(JSON.stringify({ ok: false, error: "insufficient_balance", balance, total, short: Math.round((total - balance) * 100) / 100 }));
        }
        await sb("wallet_transactions", {
          method: "POST", prefer: "return=minimal",
          body: [{ organization_id: orgId, type: "payment", amount: -total, note: `سداد طلب ${ref} — ${itemsTxt.slice(0, 120)}` }],
        });
        paid = true;
        walletAfter = Math.round((balance - total) * 100) / 100;
      } catch (e) {
        console.error("portal-order wallet debit failed", String(e).slice(0, 160));
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, error: "wallet_failed" }));
      }
    }

    if (DB_ON && orgId) {
      try {
        await sb("orders", {
          method: "POST", prefer: "return=minimal",
          body: [{
            ref, organization_id: orgId, created_by: sess.user && sess.user.id,
            status: paid ? "paid" : "awaiting_payment",
            bp_fees: subtotal, gov_fees: 0, vat, total,
          }],
        });
      } catch (e) { console.error("portal-order db insert failed", String(e).slice(0, 160)); }
    }

    const statusAr = paid ? "مدفوع" : "بانتظار الدفع";
    const payAr = PAY_MODES[pay];
    const notes = [
      `طلب من لوحة العميل · ${payAr}`,
      orgName ? `المنشأة: ${orgName}` : "",
      `الخدمات: ${itemsTxt}`,
      `الإجمالي: ${total} ﷼ (شامل ضريبة ${vat} ﷼)`,
      pay === "later" ? `فاتورة مؤجلة — تاريخ الاستحقاق: ${dueISO} (${dueDays} يوماً)` : "",
      paid ? `سُدد من المحفظة — الرصيد بعد السداد: ${walletAfter} ﷼` : "",
    ].filter(Boolean).join("\n");

    const ownerHtml = `<div dir="rtl" style="font-family:Arial,sans-serif"><h2 style="color:#0B1B5A">🛒 طلب جديد من لوحة العميل — ${esc(ref)}</h2><table>${row("العميل", name) + row("البريد", email) + (orgName ? row("المنشأة", orgName) : "") + row("الخدمات", itemsTxt) + row("الإجمالي", total + " ﷼") + row("طريقة الدفع", payAr) + row("الحالة", statusAr) + (pay === "later" ? row("تاريخ الاستحقاق", dueISO) : "")}</table>${paid ? "<p style='color:#047857'><b>مدفوع من المحفظة — ابدأ التنفيذ.</b></p>" : "<p>الطلب في «متابعات اليوم» بلوحة التحكم بتاريخ استحقاقه.</p>"}</div>`;
    const clientHtml = `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430;max-width:560px"><h2 style="color:#0B1B5A">${paid ? "تم استلام طلبك وسداده ✅" : "استلمنا طلبك ✅"}</h2><p>مرحباً ${esc(name)}، سجّلنا طلبك برقم <b>${esc(ref)}</b>.</p><table>${row("الخدمات", itemsTxt) + row("الإجمالي", total + " ﷼ (شامل الضريبة)") + row("طريقة الدفع", payAr)}</table>${pay === "later" ? `<p style="background:#FEF3C7;padding:10px;border-radius:8px">🗓 <b>فاتورة مؤجلة:</b> تاريخ استحقاق السداد <b>${dueISO}</b>. نذكّرك قبلها، وتقدر تسدد في أي وقت من لوحتك.</p>` : ""}${paid ? `<p style="background:#D1FAE5;padding:10px;border-radius:8px">💳 سُدد من محفظتك. الرصيد المتبقي: <b>${walletAfter} ﷼</b></p>` : ""}<p><a href="${MKT_SITE_BASE}/account" style="background:#0B1B5A;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block">افتح لوحتك ←</a></p></div>`;

    fetch(process.env.OWNER_WA_WEBHOOK || "https://businesspartnerai.app.n8n.cloud/webhook/website-lead-notify", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "portal-order", ref, name, email, transcript: `🛒 طلب من لوحة العميل — ${name}\n${itemsTxt}\n${total} ﷼ · ${payAr} · ${statusAr}`, url: `${MKT_SITE_BASE}/admin` }),
    }).catch(() => {});

    await Promise.all([
      sendEmail(TEAM_EMAIL, `🛒 طلب من اللوحة ${ref} — ${name} · ${total} ﷼ (${payAr})`, ownerHtml),
      OWNER_EMAIL !== TEAM_EMAIL ? sendEmail(OWNER_EMAIL, `🛒 طلب من اللوحة ${ref} — ${name} · ${total} ﷼`, ownerHtml) : Promise.resolve(),
      isEmail(email) ? sendEmail(email, `${paid ? "تم سداد طلبك" : "استلمنا طلبك"} — ${ref}`, clientHtml) : Promise.resolve(),
      crmLead({
        title: `🛒 طلب لوحة — ${name}${orgName ? " (" + orgName + ")" : ""}`,
        email, notes, ref, orderStatus: statusAr, total,
        leadSource: "شراء خدمة",
        followUpDays: pay === "later" ? dueDays : 1,
      }),
    ]);
    if (orgId) {
      notify({
        organization_id: orgId, event: "order_created", channel: "inapp",
        title: `${paid ? "سُدد طلبك" : "سُجّل طلبك"} ${ref} — ${total} ﷼${pay === "later" ? ` (الاستحقاق ${dueISO})` : ""}`,
        idempotency_key: `portal_order:${ref}`,
      }).catch(() => {});
    }
    audit({ action: "portal.order", actor_label: email, after: { ref, total, pay, paid } }).catch(() => {});

    res.statusCode = 200;
    return res.end(JSON.stringify({
      ok: true, ref, total, vat, subtotal, paid, pay, payAr,
      due: pay === "later" ? dueISO : null,
      walletBalance: walletAfter,
      payUrl: pay === "card" ? `${MKT_SITE_BASE}/pay?ref=${encodeURIComponent(ref)}&amount=${total}` : null,
    }));
  }

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
    const company = String(b.company || "").trim().slice(0, 200);
    const cr = String(b.cr || "").trim().slice(0, 40);
    const phone = String(b.phone || "").trim().slice(0, 40);
    const email = String(b.email || "").trim().toLowerCase().slice(0, 160);
    const ref = String(b.ref || "BPI-" + Date.now().toString().slice(-6)).slice(0, 40);
    const service = String(b.service || "").trim().slice(0, 400);
    const amountNum = Number(b.amount);
    const amount = Number.isFinite(amountNum) && amountNum > 0 ? amountNum : 0;
    const monthsNum = Number(b.months);
    const months = [3, 6, 12].includes(monthsNum) ? monthsNum : 6;
    const CH = { bank: "بنك العميل", bnpl: "تمارا", wallet: "محفظة إلكترونية", any: "أفضل عرض متاح" };
    const channel = CH[b.channel] || CH.any;
    if (!name || !phone || !isEmail(email) || !service || !amount) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
    const monthly = Math.ceil(amount / months);
    const oHtml = `<div style="font-family:Arial,sans-serif"><h2 style="color:#0B1B5A">طلب تقسيط ${ref}</h2><p style="color:#8a6d1a;background:#fff8ec;padding:8px 12px;border-radius:8px">🧪 خدمة تحت التجربة · للمنشآت الصغيرة والمتوسطة فقط (لا للأفراد)</p><table>${row("المنشأة", company || "—") + (cr ? row("السجل التجاري", cr) : "") + row("المسؤول", name) + row("الجوال", phone) + row("البريد", email) + row("الخدمة", service) + row("المبلغ", amount + " ﷼") + row("المدة", months + " أشهر") + row("القناة المفضلة", channel) + row("القسط التقديري", monthly + " ﷼/شهر")}</table><p>رتّب عرض التمويل مع الجهة المناسبة وعد للعميل بالعرض، ثم حدّث حالة الطلب في «Sales Pipeline».</p></div>`;
    const cHtml = `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430"><h2 style="color:#0B1B5A">استلمنا طلب التقسيط ✅</h2><p>مرحباً ${esc(name)},</p><p>وصلنا طلبك لتقسيط <strong>${esc(service)}</strong> بمبلغ <strong>${amount} ﷼</strong> على <strong>${months} أشهر</strong> (${channel}). فريقنا يجهّز العروض المتاحة وسيعود لك سريعاً.</p><table>${row("رقم المرجع", ref) + row("القسط التقديري", monthly + " ﷼/شهر")}</table><p>تابع طلبك في لوحتك: <a href="${MKT_SITE_BASE}/account" style="color:#0B1B5A">${MKT_SITE_BASE}/account</a></p><p style="color:#0B1B5A">بزنس بارتنر</p></div>`;
    await Promise.all([
      sendEmail(TEAM_EMAIL, `طلب تقسيط ${ref} — ${name} (${amount} ﷼ / ${months} أشهر)`, oHtml),
      sendEmail(email, `استلمنا طلب التقسيط — ${ref}`, cHtml),
      crmLead({ title: `طلب تقسيط — ${company || name}`, phone, email, notes: `تقسيط (تجريبي/منشآت) · ${company ? "المنشأة: " + company + (cr ? " · س.ت: " + cr : "") + " · " : ""}${service} · ${amount} ﷼ على ${months} أشهر · ${channel}`, ref, orderStatus: "قيد المراجعة", total: amount }),
      addToAudience(email, name),
      forwardLead({ source: "installment", ref, name, phone, email, items: service, total: amount }),
    ]);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ref }));
  }

  // Company-documents checklist submitted from the client dashboard. We can't
  // receive the binary files through this JSON endpoint, so this records WHICH
  // documents the client has ready (names + any links + owner IDs) and notifies
  // the team; the client then shares the actual files on WhatsApp.
  if (b.type === "documents") {
    const name = String(b.name || "").trim().slice(0, 160);
    const email = String(b.email || "").trim().toLowerCase().slice(0, 160);
    const company = String(b.company || "").trim().slice(0, 200) || name;
    const cr = String(b.cr || "").trim().slice(0, 40);
    const ref = String(b.ref || "BPD-" + Date.now().toString().slice(-6)).slice(0, 40);
    const DOC_LABELS = {
      cr: "السجل التجاري", aoa: "عقد التأسيس", chamber: "اشتراك الغرفة التجارية",
      "national-address": "شهادة العنوان الوطني", zakat: "شهادة الزكاة", vat: "شهادة الضريبة",
      "gosi-cert": "شهادة التأمينات", wps: "شهادة حماية الأجور (قوى)", "qiwa-debts": "شهادة المديونيات (قوى)",
      "gosi-excel": "ملف التأمينات (Excel)", "employee-contracts": "عقود الموظفين (قوى)", "manager-id": "هوية المدير",
    };
    const ID_LABELS = { national: "هوية وطنية", iqama: "إقامة", passport: "جواز سفر", "": "—" };
    const docs = Array.isArray(b.docs) ? b.docs.slice(0, 40) : [];
    const owners = Array.isArray(b.owners) ? b.owners.slice(0, 30) : [];
    const docRows = docs.map((d) => {
      const label = DOC_LABELS[d && d.k] || String((d && d.k) || "").slice(0, 60);
      const parts = [];
      if (d && d.name) parts.push(esc(String(d.name).slice(0, 160)));
      if (d && d.idtype) parts.push(ID_LABELS[d.idtype] || esc(String(d.idtype)));
      if (d && d.link) parts.push(`<a href="${esc(String(d.link).slice(0, 400))}">${esc(String(d.link).slice(0, 80))}</a>`);
      return row(label, parts.join(" · ") || "✓");
    }).join("");
    const ownerRows = owners.map((o, i) => row(`مالك ${i + 1}`, `${ID_LABELS[(o && o.idtype) || ""] || "—"}${o && o.name ? " · " + esc(String(o.name).slice(0, 160)) : ""}`)).join("");
    if (!docRows && !ownerRows) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "no_documents" })); }
    const readyCount = docs.length + owners.length;
    const oHtml = `<div style="font-family:Arial,sans-serif"><h2 style="color:#0B1B5A">مستندات منشأة ${ref}</h2><table>${row("المنشأة", company) + (cr ? row("السجل التجاري", cr) : "") + (name ? row("المسؤول", name) : "") + (email ? row("البريد", email) : "")}</table><h3 style="color:#0B1B5A">المستندات الجاهزة (${readyCount})</h3><table>${docRows}${ownerRows}</table><p>العميل سيشارك الملفات نفسها عبر واتساب — جهّز ملف المنشأة في «Sales Pipeline» / نظام الملفات.</p></div>`;
    const notes = `مستندات المنشأة (${readyCount} جاهز): ${docs.map((d) => DOC_LABELS[d && d.k] || (d && d.k)).filter(Boolean).join("، ")}${owners.length ? ` · ملّاك: ${owners.length}` : ""}`;
    await Promise.all([
      sendEmail(TEAM_EMAIL, `مستندات منشأة ${ref} — ${company} (${readyCount})`, oHtml),
      email && isEmail(email) ? crmLead({ title: `مستندات منشأة — ${company}`, phone: "", email, notes, ref, orderStatus: "قيد المراجعة", total: 0 }) : Promise.resolve(),
    ]);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ref }));
  }

  // Partner offer on a client request (from the partner dashboard). Routes the
  // partner's competing offer to the team, who coordinate with the client.
  if (b.type === "partner-offer") {
    const company = String(b.company || "").trim().slice(0, 200);
    const person = String(b.person || "").trim().slice(0, 160);
    const email = String(b.email || "").trim().toLowerCase().slice(0, 160);
    const phone = String(b.phone || "").trim().slice(0, 40);
    const category = String(b.category || "").trim().slice(0, 120);
    const requestRef = String(b.requestRef || "").trim().slice(0, 60);
    const notes = String(b.notes || "").trim().slice(0, 900);
    const priceNum = Number(b.price);
    const price = Number.isFinite(priceNum) && priceNum > 0 ? priceNum : null;
    const ref = "BPO-" + Date.now().toString().slice(-6);
    if (!company) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
    const oHtml = `<div style="font-family:Arial,sans-serif"><h2 style="color:#0B1B5A">عرض شريك ${ref}</h2><table>${row("الشركة الشريكة", company) + (person ? row("المسؤول", person) : "") + (phone ? row("الجوال", phone) : "") + (email ? row("البريد", email) : "") + (category ? row("التصنيف", category) : "") + row("على الطلب", requestRef || "—") + (price != null ? row("السعر المعروض", price + " ﷼") : "") + (notes ? row("تفاصيل العرض", esc(notes)) : "")}</table><p>نسّق العرض مع العميل صاحب الطلب ${esc(requestRef)} وحدّث الحالة في «Sales Pipeline».</p></div>`;
    await Promise.all([
      sendEmail(TEAM_EMAIL, `عرض شريك ${ref} — ${company}${price != null ? " (" + price + " ﷼)" : ""}`, oHtml),
      email && isEmail(email) ? crmLead({ title: `عرض شريك — ${company}`, phone, email, notes: `عرض على الطلب ${requestRef} · ${category} · ${price != null ? price + " ﷼" : "بدون سعر"} · ${notes}`.slice(0, 900), ref, orderStatus: "قيد المراجعة", total: price || 0 }) : Promise.resolve(),
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

  // Support ticket from the advisor's guided desk: the visitor gave their
  // contact first, then picked a service (main window → sub-service). Creates a
  // CRM ticket, emails the team + owner, fires the WhatsApp lead pipe, and shows
  // up in the BP Inbox tagged «تذكرة». One ticket = one CRM page (ref BPT-…).
  // ---- B10X Faster™ — flagship product ----
  // Deterministic engine classification for Ask B10X (no AI dependency: a
  // wrong-but-visible engine label beats a request lost in a model hiccup).
  const b10xEngineOf = (text) => {
    const t = String(text || "");
    const M = [
      ["الحكومة والامتثال 🏛️", /قوى|قوي|تأمينات|مقيم|مدد|بلدي|زكاة|ضريب|أبشر|اعتماد|ناجز|امتثال|تجديد|حكوم|سلامة|فسح|سابر/i],
      ["الانتقال والسكن 🧳", /سكن|شقة|فيلا|كمباوند|مدرسة|مدارس|انتقال|عائلة|مطار|فندق|relocat|housing|school|apartment/i],
      ["العقارات والمقار 🏢", /مكتب|مستودع|مصنع|معرض|أرض|عقار|warehouse|office|showroom|factory/i],
      ["الموظفون والتوظيف 👥", /موظف|توظيف|استقدام|تأشير|عقد عمل|راتب|recruit|hire|visa|staff/i],
      ["الموردون والشراكات 🔗", /مورد|توريد|موزع|وكيل|packaging|rfq|supplier|distributor|vendor/i],
      ["العملاء والمبيعات 📈", /عميل|عملاء|مبيعات|اجتماعات|بايبلاين|عرض سعر|client|sales|pipeline|meeting/i],
      ["النمو والصفقات 🚀", /استحواذ|اندماج|توسع|شراء شركة|بيع شركة|شريك|acquisition|m&a|merger|expand|franchise/i],
      ["التأسيس 🏗️", /تأسيس|سجل تجاري|رخصة استثمار|فرع أجنبي|misa|license|formation|branch/i],
      ["الهوية والحضور الرقمي 🎨", /موقع|هوية|شعار|لوقو|بروفايل|سوشال|لينكد|website|logo|brand|instagram/i],
      ["استكشاف السوق 🧭", /دراسة|استكشاف|سوق|منافس|market|research|competitor/i],
    ];
    for (const [label, re] of M) if (re.test(t)) return label;
    return "طلب عام 📨";
  };

  // Public «Start B10X» application from /b10x — a flagship lead with its own
  // channel, confirmed to the applicant and routed to the team.
  if (b.type === "b10x-apply") {
    const name = String(b.name || "").trim().slice(0, 120);
    const company = String(b.company || "").trim().slice(0, 160);
    const country = String(b.country || "").trim().slice(0, 80);
    const sector = String(b.sector || "").trim().slice(0, 120);
    const phone = String(b.phone || "").trim().slice(0, 40);
    const email = String(b.email || "").trim().toLowerCase().slice(0, 160);
    const message = String(b.message || "").trim().slice(0, 1500);
    if (!name || !company || !phone || !isEmail(email)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
    const ref = "B10X-" + Date.now().toString().slice(-6);
    const oHtml = `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430"><h2 style="color:#0B1B5A">🚀 طلب B10X جديد — ${esc(company)}</h2><table>${row("المرجع", ref) + row("الاسم", name) + row("الشركة", company) + row("الدولة", country || "—") + row("القطاع", sector || "—") + row("الجوال", phone) + row("البريد", email) + row("الهدف", message || "—")}</table><p>عميل Flagship محتمل (تفعيل 50,000 + اشتراك B10X 365) — تواصل خلال يوم عمل.</p></div>`;
    const cHtml = `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430;max-width:560px"><h2 style="color:#0B1B5A">استلمنا طلب B10X الخاص بك ✅</h2><p>مرحباً ${esc(name)}، سجلنا اهتمام <b>${esc(company)}</b> بمنظومة <b>B10X Faster™ — Saudi Landing OS</b> برقم مرجع <b>${ref}</b>. سيتواصل معك مختص B10X خلال يوم عمل بخطة دخولك للسوق السعودي.</p><p><a href="${MKT_SITE_BASE}/consultation" style="background:#0B1B5A;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block">📅 أو احجز استشارتك المجانية الآن</a></p><p style="color:#666;margin-top:18px">Business Partner · Riyadh · businesspartner.sa</p></div>`;
    await Promise.all([
      crmLead({ title: `🚀 B10X — ${company} (${name})`, phone, email, notes: `قناة: B10X · الدولة: ${country || "—"} · القطاع: ${sector || "—"}${message ? "\nالهدف: " + message : ""}`, ref, orderStatus: "قيد المراجعة", leadSource: "B10X" }),
      sendEmail(TEAM_EMAIL, `🚀 طلب B10X جديد — ${company} (${ref})`, oHtml),
      sendEmail(email, `استلمنا طلب B10X — ${ref}`, cHtml),
      addToAudience(email, name),
      forwardLead({ source: "b10x", ref, name, phone, email, items: company }),
    ]);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ref }));
  }

  // «Ask B10X» from inside the client portal: free text → classified service
  // request with a tracking reference, assigned to the account manager flow.
  // Session-gated: only a logged-in client can file one, under their identity.
  if (b.type === "b10x-request") {
    let sess = null;
    try { sess = await getSession(req); } catch {}
    if (!sess) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "unauthorized" })); }
    const text = String(b.text || "").trim().slice(0, 1200);
    if (text.length < 5) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
    const engine = b10xEngineOf(text);
    const ref = "B10XR-" + Date.now().toString().slice(-6);
    const email = (sess.user && sess.user.email) || "";
    const name = (sess.user && sess.user.full_name) || "";
    const org = (sess.organization && (sess.organization.name_ar || sess.organization.name_en)) || "";
    const oHtml = `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430"><h2 style="color:#0B1B5A">🚀 Ask B10X — ${esc(engine)}</h2><table>${row("المرجع", ref) + row("العميل", name) + row("المنشأة", org || "—") + row("البريد", email)}</table><p style="background:#F4F6FB;border-radius:8px;padding:12px 16px">${esc(text)}</p><p>أسندها لمدير الحساب وتابع التنفيذ من CRM.</p></div>`;
    await Promise.all([
      crmLead({ title: `🚀 طلب B10X — ${engine} — ${org || name || email}`, phone: "", email, notes: `قناة: Ask B10X · المحرك: ${engine} · المنشأة: ${org || "—"} · البريد: ${email}\nالطلب: ${text}`, ref, orderStatus: "قيد المراجعة", leadSource: "Ask B10X" }),
      sendEmail(TEAM_EMAIL, `🚀 Ask B10X — ${engine} (${ref})`, oHtml),
      sess.organization && sess.organization.id
        ? notify({ organization_id: sess.organization.id, event: "b10x_request", channel: "inapp", title: `استلمنا طلبك ${ref} (${engine}) — سيتابعه مدير حسابك`, idempotency_key: `b10x:${ref}` }).catch(() => {})
        : Promise.resolve(),
    ]);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ref, engine }));
  }

  if (b.type === "support-ticket") {
    const sid = String(b.sid || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
    const c = b.contact && typeof b.contact === "object" ? b.contact : {};
    const name = String(c.name || "").trim().slice(0, 120);
    const phone = String(c.phone || "").trim().slice(0, 40);
    const email = String(c.email || "").trim().toLowerCase().slice(0, 160);
    const s = b.service && typeof b.service === "object" ? b.service : {};
    const svcAr = String(s.nameAr || s.nameEn || "طلب عام").trim().slice(0, 200);
    const catAr = String(s.categoryAr || "").trim().slice(0, 120);
    const svcCode = String(s.code || "").trim().slice(0, 40);
    const note = String(b.note || "").trim().slice(0, 1200);
    if (!name || (!phone && !isEmail(email))) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
    const ref = ("BPT-" + Date.now().toString().slice(-6)).slice(0, 40);
    const today = new Date().toISOString().slice(0, 10);
    const notesText = `قناة: تذكرة دعم · ${name}${phone ? " · الجوال: " + phone : ""}${email ? " · البريد: " + email : ""}\nالخدمة: ${svcAr}${catAr ? " (" + catAr + ")" : ""}${svcCode ? " [" + svcCode + "]" : ""}${note ? "\nتفاصيل: " + note : ""}`;
    if (NOTION_TOKEN) {
      const props = {
        "Opportunity Name": { title: [{ text: { content: `🎫 تذكرة — ${svcAr}`.slice(0, 200) } }] },
        "Lead Source": { select: { name: TICKET_SOURCE } },
        "Stage": { select: { name: "مهتم" } },
        "Human Required": { checkbox: true },
        "Notes": { rich_text: richChunks(notesText) },
        "Last Activity": { date: { start: today } },
        "رقم المرجع": { rich_text: [{ text: { content: ref } }] },
        "حالة الطلب": { select: { name: "تذكرة دعم" } },
      };
      try {
        const r = await fetch("https://api.notion.com/v1/pages", {
          method: "POST",
          headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
          body: JSON.stringify({ parent: { database_id: CRM_DB }, properties: props }),
        });
        if (!r.ok) console.error("ticket create error", r.status, (await r.text()).slice(0, 200));
      } catch (e) { console.error("ticket create exception", String(e).slice(0, 150)); }
    }
    const oHtml = `<div dir="rtl" style="font-family:Arial,sans-serif"><h2 style="color:#0B1B5A">🎫 تذكرة دعم جديدة ${ref}</h2><table>${row("الاسم", name) + row("الجوال", phone) + row("البريد", email) + row("الخدمة", svcAr) + row("المجال", catAr) + row("تفاصيل", note || "—")}</table><p>تواصل مع العميل على رقمه/بريده لخدمته — والتذكرة ظاهرة في «BP Inbox» تحت وسم «تذكرة».</p></div>`;
    // تأكيد للعميل: فتحنا تذكرة + خيار حجز موعد أو واتساب المستشار باهر
    const bookUrl = `${MKT_SITE_BASE}/consultation`;
    const waAdvisor = "https://wa.me/966530540231";
    const cHtml = `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430;max-width:560px">
      <h2 style="color:#0B1B5A">استلمنا طلبك لعرض السعر ✅</h2>
      <p>مرحباً ${esc(name) || "بك"}، شكراً لتواصلك مع بيزنس بارتنر بخصوص <b>${esc(svcAr)}</b>. سجّلنا طلبك برقم مرجع <b>${ref}</b>، وبيجهّز لك مستشارك <b>باهر</b> عرض سعر حسب حالتك ويتواصل معك قريباً على رقمك/بريدك.</p>
      <p style="margin:18px 0"><b>وتقدر تبدأ الآن مباشرة:</b></p>
      <p><a href="${bookUrl}" style="background:#0B1B5A;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block">📅 احجز موعد استشارتك المجانية</a></p>
      <p style="margin-top:12px"><a href="${waAdvisor}" style="background:#25D366;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block">💬 تواصل مع مستشارك باهر على واتساب</a></p>
      <p style="color:#666;margin-top:22px">بزنس بارتنر · الرياض · businesspartner.sa</p></div>`;
    const waNotify = fetch(process.env.OWNER_WA_WEBHOOK || "https://businesspartnerai.app.n8n.cloud/webhook/website-lead-notify", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "support-ticket", ref, name, phone, email, transcript: `🎫 تذكرة: ${svcAr}${catAr ? " (" + catAr + ")" : ""}${note ? "\n" + note : ""}`, url: `${MKT_SITE_BASE}/monitor` }),
    }).catch(() => {});
    await Promise.all([
      sendEmail(TEAM_EMAIL, `🎫 تذكرة دعم ${ref} — ${name} · ${svcAr}`, oHtml),
      OWNER_EMAIL !== TEAM_EMAIL ? sendEmail(OWNER_EMAIL, `🎫 تذكرة دعم ${ref} — ${name} · ${svcAr}`, oHtml) : Promise.resolve(),
      isEmail(email) ? sendEmail(email, `فتحنا لك تذكرة دعم — بيزنس بارتنر (${ref})`, cHtml) : Promise.resolve(),
      waNotify,
      forwardLead({ source: "support-ticket", ref, name, phone, email, items: svcAr }),
      email ? addToAudience(email, name) : Promise.resolve(),
    ]);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ref }));
  }

  // حجز استشارة من ودجت باهر — العميل يختار يوماً ووقتاً ضمن دوام بزنس بارتنر
  // (٩ص–٦م بتوقيت الرياض، الجمعة إجازة). ننشئ رابط موعد Google Calendar، ونؤكّد
  // للعميل ونشعر الفريق (بريد + واتساب) ونسجّل في CRM. باهر يؤكّد الموعد يدوياً.
  if (b.type === "booking") {
    const contact = b.contact && typeof b.contact === "object" ? b.contact : {};
    const name = String(contact.name || "").trim().slice(0, 120);
    const phone = String(contact.phone || "").trim().slice(0, 40);
    const email = String(contact.email || "").trim().toLowerCase().slice(0, 160);
    const date = String(b.date || "").trim();
    const time = String(b.time || "").trim();
    // تحقّق: التاريخ صحيح ومستقبلي وليس جمعة، والوقت ضمن ٩ص–٥م
    const okDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
    const okTime = /^(0[9]|1[0-7]):00$/.test(time);
    const d = okDate ? new Date(date + "T12:00:00Z") : null; // ظهر UTC = نفس اليوم التقويمي لكل المناطق
    const isFriday = d && d.getUTCDay() === 5; // 5 = الجمعة
    if (!name || !isEmail(email) || !okDate || !okTime || !d || isFriday) {
      res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_slot" }));
    }
    const ref = "BK-" + Date.now().toString().slice(-6);
    const dt = date.replace(/-/g, "");
    const hh = time.slice(0, 2);
    const startG = `${dt}T${hh}0000`;
    const endG = `${dt}T${("0" + (Number(hh) + 1)).slice(-2)}0000`;
    const gcalUrl = "https://calendar.google.com/calendar/render?" + new URLSearchParams({
      action: "TEMPLATE",
      text: "استشارة Business Partner",
      dates: `${startG}/${endG}`,
      ctz: "Asia/Riyadh",
      details: `استشارة مجانية مع فريق بزنس بارتنر.\nرقم المرجع: ${ref}\nمستشارك: باهر · wa.me/966530540231`,
      location: "Business Partner — Riyadh / Online",
    }).toString();
    const whenTxt = `${date} · ${time} ${Number(hh) >= 12 ? "م" : "ص"} (توقيت الرياض)`;
    // Owner-side calendar link carries the CLIENT's details so one click puts
    // the meeting (with who/how to reach them) on the team calendar.
    const gcalOwner = "https://calendar.google.com/calendar/render?" + new URLSearchParams({
      action: "TEMPLATE",
      text: `استشارة — ${name}`,
      dates: `${startG}/${endG}`,
      ctz: "Asia/Riyadh",
      details: `استشارة مجانية.\nالعميل: ${name}\nالجوال: ${phone}\nالبريد: ${email}\nرقم المرجع: ${ref}`,
      location: "Business Partner — Riyadh / Online",
    }).toString();
    const oHtml = `<div dir="rtl" style="font-family:Arial,sans-serif"><h2 style="color:#0B1B5A">📅 حجز استشارة جديد ${ref}</h2><table>${row("الاسم", name) + row("الجوال", phone) + row("البريد", email) + row("الموعد", whenTxt)}</table>
      <p style="margin:16px 0"><a href="${gcalOwner}" style="background:#0B1B5A;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block">📅 أضِف الموعد إلى تقويم Google</a></p>
      <p>أكّد الموعد مع العميل، وهو ظاهر في «BP Inbox».</p></div>`;
    const cHtml = `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430;max-width:560px">
      <h2 style="color:#0B1B5A">تم حجز استشارتك ✅</h2>
      <p>مرحباً ${esc(name)}، حجزنا لك استشارة مجانية بتاريخ <b>${esc(whenTxt)}</b> (رقم المرجع <b>${ref}</b>)، وبيأكّد لك مستشارك <b>باهر</b> قريباً.</p>
      <p style="margin:16px 0"><a href="${gcalUrl}" style="background:#0B1B5A;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block">📅 أضِف الموعد إلى تقويم Google</a></p>
      <p><a href="https://wa.me/966530540231" style="background:#25D366;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block">💬 تواصل مع مستشارك باهر</a></p>
      <p style="color:#666;margin-top:20px">بزنس بارتنر · الرياض · businesspartner.sa</p></div>`;
    const waNotify = fetch(process.env.OWNER_WA_WEBHOOK || "https://businesspartnerai.app.n8n.cloud/webhook/website-lead-notify", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "booking", ref, name, phone, email, date, time, transcript: `📅 حجز استشارة: ${whenTxt}`, url: `${MKT_SITE_BASE}/monitor` }),
    }).catch(() => {});
    await Promise.all([
      sendEmail(TEAM_EMAIL, `📅 حجز استشارة ${ref} — ${name} · ${whenTxt}`, oHtml),
      sendEmail(email, `تم حجز استشارتك — بيزنس بارتنر (${ref})`, cHtml),
      waNotify,
      crmLead({ title: `📅 حجز استشارة — ${name}`, phone, email, notes: `حجز استشارة · ${whenTxt}`, ref, orderStatus: "حجز استشارة" }),
      addToAudience(email, name),
    ]);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ref, gcalUrl }));
  }

  // Website advisor ("باهر") conversation sync — the widget posts this in the
  // background as the chat grows (notify:false = silent upsert for the /monitor
  // inbox + CRM), and once, on buying intent with the visitor's contact
  // (notify:true), it also emails the owner and fires the WhatsApp lead pipe so
  // they can follow up. Never blocks the chat reply (that's a separate call).
  if (b.type === "advisor-chat") {
    const sid = String(b.sid || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
    const messages = (Array.isArray(b.messages) ? b.messages : [])
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-24)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
    if (!sid || !messages.length) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
    const contact = b.contact && typeof b.contact === "object" ? b.contact : {};
    const name = String(contact.name || "").trim().slice(0, 120);
    const phone = String(contact.phone || "").trim().slice(0, 40);
    const email = String(contact.email || "").trim().toLowerCase().slice(0, 160);
    const notify = !!b.notify && (phone || isEmail(email));
    await upsertConversation({ sid, messages, phone, email, name, hot: notify });
    if (notify) {
      const ref = "WEB-" + sid;
      const bookUrl = `${MKT_SITE_BASE}/consultation`;
      const waAdvisor = "https://wa.me/966530540231"; // واتساب المستشار باهر
      const transcript = messages.map((m) => (m.role === "assistant" ? "باهر: " : "الزائر: ") + m.content).join("\n").slice(-3500);
      // إشعار الشركة فقط (business@) — بلا نسخة على الإيميل الشخصي
      const oHtml = `<div dir="rtl" style="font-family:Arial,sans-serif"><h2 style="color:#0B1B5A">عميل من «المستشار» يريد المتابعة 💬</h2><table>${row("الاسم", name) + row("الجوال", phone) + row("البريد", email) + row("المرجع", ref)}</table><h3 style="color:#0B1B5A">نص المحادثة</h3><pre style="white-space:pre-wrap;background:#f6f7fb;padding:12px;border-radius:8px;font-family:inherit">${esc(transcript)}</pre><p>تابع العميل عبر واتساب أو البريد أعلاه — والمحادثة كاملة في شاشة «BP Inbox» تحت وسم «المستشار».</p></div>`;
      // تأكيد للعميل: فتحنا تذكرة + خيار حجز موعد أو واتساب المستشار
      const cHtml = `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430;max-width:560px">
        <h2 style="color:#0B1B5A">استلمنا طلبك وفتحنا لك تذكرة متابعة ✅</h2>
        <p>مرحباً ${esc(name) || "بك"}، شكراً لتواصلك مع بيزنس بارتنر. سجّلنا طلبك برقم مرجع <b>${ref}</b>، وسيتواصل معك مستشارك <b>باهر</b> قريباً.</p>
        <p style="margin:18px 0"><b>وتقدر تبدأ الآن مباشرة:</b></p>
        <p><a href="${bookUrl}" style="background:#0B1B5A;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block">📅 احجز موعد استشارتك المجانية</a></p>
        <p style="margin-top:12px"><a href="${waAdvisor}" style="background:#25D366;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block">💬 تواصل مع مستشارك باهر على واتساب</a></p>
        <p style="color:#666;margin-top:22px">بزنس بارتنر · الرياض · businesspartner.sa</p></div>`;
      // إشعار واتساب لباهر عبر ورك فلو n8n (best-effort — لا يوقف شيئاً إن فشل)
      const waNotify = fetch(process.env.OWNER_WA_WEBHOOK || "https://businesspartnerai.app.n8n.cloud/webhook/website-lead-notify", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "advisor-chat", ref, name, phone, email, transcript, url: `${MKT_SITE_BASE}/monitor` }),
      }).catch(() => {});
      await Promise.all([
        sendEmail(TEAM_EMAIL, `🌐 عميل من المستشار — ${name || phone || email}`, oHtml),
        isEmail(email) ? sendEmail(email, `تم استلام طلبك — بيزنس بارتنر (${ref})`, cHtml) : Promise.resolve(),
        forwardLead({ source: "advisor-chat", ref, name, phone, email, items: (messages.find((m) => m.role === "user") || {}).content || "" }),
        waNotify,
        email ? addToAudience(email, name) : Promise.resolve(),
      ]);
    }
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ref: "WEB-" + sid, notified: notify }));
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

  // Revenue OS diagnosis-session lead from /revenue-os — lands in the CRM and
  // notifies the team + owner immediately (this form used to be a demo stub).
  // Homepage hero «ابدأ الآن» — the shortest path from landing to a lead:
  // a service and a mobile number, nothing else. Every extra required field
  // costs conversions here, so name/email stay optional and the team collects
  // the rest on the call. Lands in the CRM like any other website lead and
  // fires the owner's instant email + WhatsApp alert.
  if (b.type === "quick-start") {
    const service = String(b.service || "").trim().slice(0, 200);
    const code = String(b.code || "").trim().slice(0, 40);
    const phone = String(b.phone || "").replace(/[^\d+]/g, "").slice(0, 20);
    const name = String(b.name || "").trim().slice(0, 160);
    const email = String(b.email || "").trim().toLowerCase().slice(0, 160);
    if (!service || !/^(\+?966|0)?5\d{8}$/.test(phone.replace(/^\+/, ""))) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: "invalid_fields" }));
    }
    const ref = "QS-" + Date.now().toString().slice(-6);
    const notes = `طلب سريع من الصفحة الرئيسية · الخدمة: ${service}${code && code !== "other" ? ` (${code})` : ""}`;
    const oHtml = `<div dir="rtl" style="font-family:Arial,sans-serif"><h2 style="color:#0B1B5A">طلب سريع من الموقع — ${ref}</h2><table>${row("الخدمة المطلوبة", service) + row("رمز الخدمة", code || "—") + row("الجوال", phone) + (name ? row("الاسم", name) : "") + (email ? row("البريد", email) : "")}</table><p style="color:#b91c1c;font-weight:700">اتصل بالعميل اليوم — الطلب مسجّل في «Sales Pipeline» برقم ${ref}.</p></div>`;
    await Promise.all([
      sendEmail(TEAM_EMAIL, `⚡ طلب سريع ${ref} — ${service}`, oHtml),
      OWNER_EMAIL && OWNER_EMAIL !== TEAM_EMAIL ? sendEmail(OWNER_EMAIL, `⚡ طلب سريع ${ref} — ${service}`, oHtml) : Promise.resolve(),
      crmLead({ title: `طلب سريع — ${service}`, phone, email, notes, ref, leadSource: "نموذج الموقع", followUpDays: 1 }),
      isEmail(email) ? addToAudience(email, name) : Promise.resolve(),
      forwardLead({ source: "quick-start", ref, name, phone, email, notes, service, code }),
    ]);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ref }));
  }

  if (b.type === "revenue-lead") {
    const name = String(b.name || "").trim().slice(0, 160);
    const company = String(b.company || "").trim().slice(0, 200);
    const phone = String(b.phone || "").trim().slice(0, 40);
    const email = String(b.email || "").trim().toLowerCase().slice(0, 160);
    const track = String(b.track || "").trim().slice(0, 80);
    const notes = String(b.notes || "").trim().slice(0, 1500);
    if (!name || !company || !phone || !isEmail(email)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
    const ref = "RV-" + Date.now().toString().slice(-6);
    const oHtml = `<div dir="rtl" style="font-family:Arial,sans-serif"><h2 style="color:#0B1B5A">طلب Revenue OS جديد — ${ref}</h2><table>${row("الشركة", company) + row("المسؤول", name) + row("الجوال", phone) + row("البريد", email) + row("المسار", track) + row("الوصف", notes)}</table><p>حضّر تصور التشغيل والباقة المناسبة وعد للعميل خلال يوم عمل. الطلب مسجّل في «Sales Pipeline» برقم ${ref}.</p></div>`;
    const cHtml = `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430"><h2 style="color:#0B1B5A">استلمنا طلب جلسة التشخيص ✅</h2><p>مرحباً ${esc(name)},</p><p>وصلنا طلبك لبناء الـPipeline (${esc(track)}) لشركة <strong>${esc(company)}</strong>. فريق Revenue OS يجهّز تصور التشغيل والباقة المناسبة وسيتواصل معك خلال يوم عمل.</p><table>${row("رقم المرجع", ref)}</table><p style="color:#0B1B5A">Business Partner · Revenue OS</p></div>`;
    await Promise.all([
      sendEmail(TEAM_EMAIL, `طلب Revenue OS ${ref} — ${company}`, oHtml),
      OWNER_EMAIL && OWNER_EMAIL !== TEAM_EMAIL ? sendEmail(OWNER_EMAIL, `طلب Revenue OS ${ref} — ${company}`, oHtml) : Promise.resolve(),
      sendEmail(email, `استلمنا طلبك — Revenue OS (${ref})`, cHtml),
      crmLead({ title: `Revenue OS — ${company}`, phone, email, notes: `Revenue OS · ${track} · ${notes}`.slice(0, 900), ref, orderStatus: "قيد المراجعة" }),
      addToAudience(email, name),
      forwardLead({ source: "revenue-os", ref, name, company, phone, email, notes: `${track} · ${notes}` }),
    ]);
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
