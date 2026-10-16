// Business Partner — جسر البريد: من Resend إلى Azure Communication Services (ACS) بلا لمس api/.
//
// لماذا جسر: ٢٣ موضع نداء إلى api.resend.com موزّعة على ١٦ ملفاً بملكيات مختلفة (OTP، الفواتير، الدفع،
// التوظيف، النشرة…). ACS مدعوم في الكود لموضعين فقط (_invoicing وجزء من requests). بدل تعديل ١٦ ملفاً
// (وكلٌّ لوكيلٍ يملكه) يعمل خادم Azure بـ`BP_MAIL_BRIDGE=acs` فيعترض `fetch` داخل العملية: كل
// `POST https://api.resend.com/emails` يُترجَم إلى `POST {ACS}/emails:send` بالتوقيع الذي تعرفه ACS،
// ويعود للمتّصل ردٌّ بشكل Resend (`{id}` + 200) فيبقى فحص `r.ok` في الدوال سليماً.
//
// ما يُعترَض:
//   POST /emails                            → ACS emails:send (المرفقات `{filename, content(base64)}` تُنقل)
//   POST /audiences/:id/contacts            → يُحفظ جهة اتصال في Azure Blob (mail/audiences/<id>.json)
//   GET  /audiences/:id/contacts            → يُقرأ منها بشكل Resend: {object:"list", data:[...]}
//   غير ذلك تحت api.resend.com              → 501 صريح (لا يخرج شيء إلى Resend أبداً)
//
// «يفشل مغلقاً»: إن كان الجسر مفعّلاً وإعدادات ACS ناقصة يردّ 503 ولا يمرّر النداء إلى Resend — فلا
// يُستهلك رصيدٌ خارج Azure بالخطأ. الأسرار (سلسلة اتصال ACS، مفتاح التخزين) من متغيّرات البيئة ولا تُطبع.
//
// الاستعمال التشغيلي: docs/azure-cutover-runbook-2026-10-16.md، الخطوة (هـ).
// استيراد جمهور Resend (CSV من لوحة Resend ← Audiences ← Export):
//   node ops/azure/mail-bridge.mjs import-audience <audience-id> <contacts.csv> [--dry-run]
//
// حدود ACS الافتراضية للبريد منخفضة (دقيقة/ساعة) فيُعاد المحاولة تلقائياً عند 429 حسب Retry-After
// (حتى ٣ مرات، ≤ 20ث)؛ وللنشرة الأسبوعية اطلب رفع الحدّ مسبقاً.

import crypto from "node:crypto";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const RESEND_HOST = "api.resend.com";
const ACS_API_VERSION = "2023-03-31";

// ----------------------------------------------------------------- ترجمة --
/** "Name <a@b.c>" أو "a@b.c" → { name, address }؛ ما ليس عنواناً → null. */
export function parseAddress(v) {
  const s = String(v || "").trim();
  const m = /^(?:"?([^"<]*?)"?\s*)?<([^<>\s]+@[^<>\s]+)>$/.exec(s);
  if (m) return { name: (m[1] || "").trim(), address: m[2] };
  return /^[^\s<>@]+@[^\s<>@]+$/.test(s) ? { name: "", address: s } : null;
}

const listOf = (v) => (Array.isArray(v) ? v : v === undefined || v === null || v === "" ? [] : [v]);
const toRecipients = (v) => listOf(v).map(parseAddress).filter(Boolean).map((a) => ({ address: a.address, ...(a.name ? { displayName: a.name } : {}) }));

const MIME = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", txt: "text/plain",
  csv: "text/csv", html: "text/html", json: "application/json", zip: "application/zip", xml: "application/xml",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
const mimeOf = (filename) => MIME[String(filename || "").split(".").pop().toLowerCase()] || "application/octet-stream";

/**
 * جسم Resend → جسم ACS. يرمي Error برمز نصي إن لم يكن للرسالة مستلم أو موضوع، أو إن كان المرفق غير مضمَّن
 * (`path` بدل `content`) — فيُردّ للمتّصل 422 كما كان Resend سيفعل.
 */
export function resendToAcs(body, sender) {
  const to = toRecipients(body.to);
  if (!to.length) throw Object.assign(new Error("missing_to"), { status: 422 });
  if (!String(body.subject || "").trim()) throw Object.assign(new Error("missing_subject"), { status: 422 });
  const content = { subject: String(body.subject) };
  if (body.html) content.html = String(body.html);
  if (body.text) content.plainText = String(body.text);
  if (!content.html && !content.plainText) throw Object.assign(new Error("missing_content"), { status: 422 });
  const out = { senderAddress: sender, content, recipients: { to }, userEngagementTrackingDisabled: true };
  const cc = toRecipients(body.cc); if (cc.length) out.recipients.cc = cc;
  const bcc = toRecipients(body.bcc); if (bcc.length) out.recipients.bcc = bcc;
  const rt = toRecipients(body.reply_to || body.replyTo); if (rt.length) out.replyTo = rt;
  const atts = listOf(body.attachments);
  if (atts.length) {
    out.attachments = atts.map((a) => {
      if (!a || !a.filename || typeof a.content !== "string") throw Object.assign(new Error("attachment_needs_filename_and_base64_content"), { status: 422 });
      return { name: String(a.filename), contentType: a.content_type || a.contentType || mimeOf(a.filename), contentInBase64: a.content };
    });
  }
  return out;
}

// ------------------------------------------------------------------ ACS --
export function acsConfig(env = process.env) {
  const cs = String(env.ACS_CONNECTION_STRING || env.AZURE_COMMUNICATION_CONNECTION_STRING || "").trim();
  const sender = String(env.ACS_SENDER_ADDRESS || env.AZURE_ACS_SENDER || "").trim();
  const endpoint = (cs.match(/endpoint=([^;]+)/i) || [])[1];
  const key = (cs.match(/accesskey=([^;]+)/i) || [])[1];
  const missing = [];
  if (!endpoint || !key) missing.push("ACS_CONNECTION_STRING");
  if (!sender) missing.push("ACS_SENDER_ADDRESS");
  return { ok: !missing.length, missing, endpoint: endpoint ? endpoint.replace(/\/+$/, "") : "", key: key || "", sender };
}

/** توقيع HMAC-SHA256 لنداء ACS (المواصفة نفسها في api/_azure_notify.js). */
export function acsHeaders({ endpoint, key }, method, pathWithQuery, bodyStr, now = new Date()) {
  const host = new URL(endpoint).host;
  const date = now.toUTCString();
  const contentHash = crypto.createHash("sha256").update(bodyStr, "utf8").digest("base64");
  const stringToSign = `${method}\n${pathWithQuery}\n${date};${host};${contentHash}`;
  const signature = crypto.createHmac("sha256", Buffer.from(key, "base64")).update(stringToSign, "utf8").digest("base64");
  return {
    "x-ms-date": date,
    "x-ms-content-sha256": contentHash,
    Authorization: `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}`,
    "content-type": "application/json",
  };
}

const json = (status, obj, headers = {}) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sendViaAcs(cfg, payload, { realFetch, sleepImpl, log }) {
  const pathWithQuery = `/emails:send?api-version=${ACS_API_VERSION}`;
  const body = JSON.stringify(payload);
  for (let attempt = 0; ; attempt++) {
    const r = await realFetch(`${cfg.endpoint}${pathWithQuery}`, { method: "POST", headers: acsHeaders(cfg, "POST", pathWithQuery, body), body });
    if (r.status === 429 && attempt < 3) {
      const wait = Math.min(20, Math.max(1, Number(r.headers.get("retry-after")) || 2 ** attempt)) * 1000;
      log({ level: "warn", msg: "acs_throttled", attempt: attempt + 1, waitMs: wait });
      await sleepImpl(wait);
      continue;
    }
    return r;
  }
}

// ------------------------------------------------------- جمهور (contacts) --
/** مخزن جهات الاتصال في Azure Blob. يُستبدل بمخزن ذاكرة في الاختبارات. */
export function blobAudienceStore() {
  let mod;
  const blob = async () => (mod ||= await import("../../api/_azblob.js"));
  const pathOf = (id) => `mail/audiences/${String(id).replace(/[^A-Za-z0-9_-]/g, "_")}.json`;
  return {
    async ready() { return (await blob()).azureBlobReady(); },
    async load(id) {
      const m = await blob();
      try { return JSON.parse((await m.blobGet(pathOf(id))).toString("utf8")); }
      catch (e) { if (/_404$/.test(String(e.message))) return []; throw e; }
    },
    async save(id, contacts) {
      await (await blob()).blobPut(pathOf(id), Buffer.from(JSON.stringify(contacts)), "application/json");
    },
  };
}

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || ""));

/** إضافة/تحديث جهة اتصال بالبريد (مفتاح فريد، بحروف صغيرة). */
export function upsertContact(list, input, now = new Date()) {
  const email = String(input.email || "").trim().toLowerCase();
  const i = list.findIndex((c) => c.email === email);
  const prev = i >= 0 ? list[i] : null;
  const c = {
    id: prev ? prev.id : crypto.randomUUID(),
    email,
    first_name: input.first_name ?? (prev ? prev.first_name : undefined),
    last_name: input.last_name ?? (prev ? prev.last_name : undefined),
    unsubscribed: input.unsubscribed === undefined ? (prev ? !!prev.unsubscribed : false) : !!input.unsubscribed,
    created_at: prev ? prev.created_at : now.toISOString(),
  };
  if (i >= 0) list[i] = c; else list.push(c);
  return c;
}

// ------------------------------------------------------------- المعالج --
/**
 * يعالج نداءً واحداً إلى api.resend.com ويعيد Response. معزول عن fetch العام كي يُختبر مباشرة.
 */
export async function handleResendCall(url, init, deps) {
  const { cfg, store, log, realFetch, sleepImpl = sleep } = deps;
  const u = new URL(url);
  const method = String(init?.method || "GET").toUpperCase();
  const route = u.pathname.replace(/\/+$/, "");

  if (!cfg.ok) {
    log({ level: "error", msg: "mail_bridge_not_configured", missing: cfg.missing });
    return json(503, { name: "mail_bridge_not_configured", message: `ACS غير مضبوط: ${cfg.missing.join(", ")}` });
  }

  if (route === "/emails" && method === "POST") {
    let body;
    try { body = JSON.parse(typeof init.body === "string" ? init.body : Buffer.from(init.body || "").toString("utf8")); }
    catch { return json(400, { name: "invalid_json", message: "جسم غير JSON" }); }
    let payload;
    try { payload = resendToAcs(body, cfg.sender); }
    catch (e) { return json(e.status || 422, { name: "validation_error", message: e.message }); }
    let r;
    try { r = await sendViaAcs(cfg, payload, { realFetch, sleepImpl, log }); }
    catch (e) {
      log({ level: "error", msg: "acs_unreachable", err: String(e.message || e).slice(0, 120) });
      return json(502, { name: "acs_unreachable", message: "تعذّر الاتصال بـACS" });
    }
    if (r.status === 202 || r.ok) {
      let id = "";
      try { id = (await r.json()).id || ""; } catch { /* الرد الناجح بلا جسم مقبول */ }
      return json(200, { id: id || crypto.randomUUID() });
    }
    // سبب الرفض بلا محتوى الرسالة ولا العناوين: رمز الحالة وأول ١٢٠ حرفاً من ردّ ACS فقط.
    const detail = (await r.text().catch(() => "")).slice(0, 120);
    log({ level: "error", msg: "acs_refused", status: r.status, detail });
    return json(r.status >= 400 && r.status < 600 ? r.status : 502, { name: "acs_refused", message: `ACS ${r.status}` });
  }

  const aud = /^\/audiences\/([^/]+)\/contacts$/.exec(route);
  if (aud) {
    if (!(await store.ready())) return json(503, { name: "audience_store_not_configured", message: "AZURE_STORAGE_* غير مضبوط" });
    const id = decodeURIComponent(aud[1]);
    if (method === "POST") {
      let b; try { b = JSON.parse(String(init.body || "{}")); } catch { return json(400, { name: "invalid_json", message: "جسم غير JSON" }); }
      if (!isEmail(b.email)) return json(422, { name: "validation_error", message: "email" });
      const list = await store.load(id);
      const c = upsertContact(list, b);
      await store.save(id, list);
      return json(200, { object: "contact", id: c.id });
    }
    if (method === "GET") {
      const list = await store.load(id);
      return json(200, { object: "list", data: list });
    }
  }

  log({ level: "error", msg: "mail_bridge_unsupported", method, route });
  return json(501, { name: "not_implemented", message: `جسر البريد لا يدعم ${method} ${route}` });
}

/**
 * يستبدل globalThis.fetch بغلاف يعترض api.resend.com فقط. يعيد { ready, missing, restore }.
 * بلا ACS مضبوط يبقى الغلاف مثبّتاً ويردّ 503 (فشل مغلق) ولا يمرّ نداء إلى Resend.
 */
export function installMailBridge({ env = process.env, target = globalThis, store = blobAudienceStore(), log = () => {}, sleepImpl = sleep } = {}) {
  const realFetch = target.fetch.bind(target);
  const cfg = acsConfig(env);
  target.fetch = async function bridgedFetch(input, init) {
    let url;
    try { url = new URL(typeof input === "string" ? input : input && input.url ? input.url : String(input)); } catch { return realFetch(input, init); }
    if (url.hostname.toLowerCase() !== RESEND_HOST) return realFetch(input, init);
    return handleResendCall(url.href, init || {}, { cfg, store, log, realFetch, sleepImpl });
  };
  return { ready: cfg.ok, missing: cfg.missing, restore() { target.fetch = realFetch; } };
}

// ----------------------------------------------------------- استيراد CSV --
/** محلّل CSV صغير يدعم الحقول المقتبسة والفواصل داخلها والأسطر المزدوجة "". */
export function parseCsv(text) {
  const rows = []; let row = []; let cur = ""; let q = false;
  const s = String(text).replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

/** CSV تصدير Resend (email, first_name, last_name, unsubscribed, created_at) → جهات اتصال؛ ويعيد إحصاءً بلا قيم. */
export function contactsFromCsv(text) {
  const [head, ...rows] = parseCsv(text);
  if (!head) return { contacts: [], stats: { rows: 0, valid: 0, invalid: 0, unsubscribed: 0, duplicates: 0 } };
  const idx = Object.fromEntries(head.map((h, i) => [h.trim().toLowerCase(), i]));
  if (idx.email === undefined) throw new Error("لا عمود email في الملف");
  const get = (r, k) => (idx[k] === undefined ? undefined : String(r[idx[k]] ?? "").trim());
  const list = []; const stats = { rows: rows.length, valid: 0, invalid: 0, unsubscribed: 0, duplicates: 0 };
  for (const r of rows) {
    const email = get(r, "email");
    if (!isEmail(email)) { stats.invalid++; continue; }
    const before = list.length;
    const unsub = /^(true|1|yes)$/i.test(get(r, "unsubscribed") || "");
    upsertContact(list, { email, first_name: get(r, "first_name") || undefined, last_name: get(r, "last_name") || undefined, unsubscribed: unsub },
      get(r, "created_at") ? new Date(get(r, "created_at")) : new Date());
    if (list.length === before) stats.duplicates++; else { stats.valid++; if (unsub) stats.unsubscribed++; }
  }
  return { contacts: list, stats };
}

async function main(argv) {
  const [cmd, audience, file, ...flags] = argv.slice(2);
  if (cmd !== "import-audience" || !audience || !file) {
    console.error("استعمال: node ops/azure/mail-bridge.mjs import-audience <audience-id> <contacts.csv> [--dry-run]");
    return 2;
  }
  const { contacts, stats } = contactsFromCsv(fs.readFileSync(file, "utf8"));
  console.log(`صفوف: ${stats.rows} · صالحة: ${stats.valid} · غير صالحة: ${stats.invalid} · ملغاة الاشتراك: ${stats.unsubscribed} · مكرّرة: ${stats.duplicates}`);
  if (flags.includes("--dry-run")) { console.log("--dry-run: لم يُكتب شيء."); return 0; }
  const store = blobAudienceStore();
  if (!(await store.ready())) { console.error("AZURE_STORAGE_ACCOUNT/AZURE_STORAGE_KEY غير مضبوطين."); return 2; }
  const existing = await store.load(audience);
  for (const c of contacts) upsertContact(existing, c);   // يدمج ولا يمسح ما سبق
  await store.save(audience, existing);
  console.log(`حُفظ الجمهور: ${existing.length} جهة اتصال.`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv).then((c) => process.exit(c), (e) => { console.error(String((e && e.message) || e)); process.exit(1); });
}
