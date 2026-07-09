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
      if (m) agents[refText] = m[1].split(",").filter(Boolean);
      const em = notesText.match(/البريد:\s*([^\s·]+@[^\s·]+)/);
      if (em) emails[refText] = em[1];
    }
  }
  return { statuses, agents, emails };
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

async function crmLead({ title, phone, email, notes, ref, orderStatus, agents, total, receiptUploadId, receiptName }) {
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
  if (receiptUploadId) {
    props["الإيصال البنكي"] = { files: [{ type: "file_upload", file_upload: { id: receiptUploadId }, name: (receiptName || "receipt.pdf").slice(0, 100) }] };
    props["تحقق المبلغ"] = { select: { name: "لم يُفحص بعد" } };
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

  if (req.method === "GET") {
    const url = new URL(req.url, "http://x");
    const refs = (url.searchParams.get("refs") || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 30);
    if (refs.length) {
      res.setHeader("Cache-Control", "no-store");
      try {
        const { statuses, agents, emails } = await orderStatuses(refs);
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, statuses, agents, emails }));
      } catch {
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, error: "notion_failed" }));
      }
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
    if (!name || !phone) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
    if (!receiptBase64) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "receipt_required" })); }
    const receiptUploadId = await uploadFileToNotion(receiptBase64, receiptName, "application/pdf");
    const agentsNote = agents.length ? `<p>موظفون أذكياء مطلوبون: <strong>${esc(agents.join("، "))}</strong> — بمجرد اعتماد الدفع، تفلّت الحالة لـ«مؤكد - قيد التنفيذ» يفتح للعميل بوابة الموظفين الأذكياء تلقائياً برقم مرجعه ${ref}.</p>` : "";
    const receiptNote = receiptUploadId
      ? `<p>إيصال التحويل مرفق بصف الطلب في Notion — إيجنت التحقق في n8n يقارن مبلغه بـ«إجمالي الطلب» (${total} ﷼) تلقائياً.</p>`
      : `<p style="color:#b91c1c">⚠️ تعذّر رفع الإيصال إلى Notion — راجع الإيصال يدوياً قبل التفعيل.</p>`;
    const oHtml = `<div style="font-family:Arial,sans-serif"><h2 style="color:#0B1B5A">طلب جديد ${ref}</h2><table>${row("الاسم", name) + row("الجوال", phone) + row("البريد", email) + row("الخدمات", items) + row("الإجمالي", total ? total + " ﷼" : "")}</table>${agentsNote}${receiptNote}<p>بعد تأكيد مطابقة المبلغ: افتح صف الطلب في قاعدة «Sales Pipeline» في Notion (رقم المرجع ${ref}) وغيّر <strong>حالة الطلب</strong> إلى «مؤكد - قيد التنفيذ» ثم «مكتمل». تظهر الحالة فوراً في لوحة العميل /account بلا إعادة نشر.</p></div>`;
    await Promise.all([
      sendEmail(TEAM_EMAIL, `طلب جديد ${ref} — ${name}`, oHtml),
      crmLead({ title: `طلب/شراء خدمة — ${name}`, phone, email, notes: `طلب · ${items}${total ? " · إجمالي " + total : ""}`, ref, orderStatus: "قيد المراجعة", agents, total, receiptUploadId, receiptName }),
      addToAudience(email, name),
      forwardLead({ source: "order", ref, name, phone, email, items, total }),
    ]);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ref, receiptUploaded: !!receiptUploadId }));
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
    crmLead({ title, phone: f.phone, email: f.email, notes: crmNotes, ref }),
    addToAudience(f.email, f.person),
    forwardLead({ source: type, ref, name: f.person, company: f.company, phone: f.phone, email: f.email, notes: crmNotes }),
  ]);

  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true, ref, emailSent: !!(teamSent.ok && clientSent.ok) }));
}
