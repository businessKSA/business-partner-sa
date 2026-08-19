// Business Partner — supplier portal + supplier control panel (ESM).
//
// Replaces the mock partner dashboard, which authenticated nobody (any email
// was accepted) and whose "client requests" feed read the visitor's OWN
// localStorage orders — so a real supplier always saw an empty list and
// registrations landed in the customer CRM as untyped leads.
//
// Two Notion databases back this (under "Core Operating Databases"):
//   Suppliers      — the registry. A supplier can only sign in once the owner
//                    sets الحالة = معتمد, which emails them their access code.
//   SupplierOrders — one work order per assignment, carrying BOTH billing
//                    directions: قيمة أمر العمل is what the owner pays the
//                    supplier (they upload their invoice against it), and
//                    قيمة العمولة is what the owner invoices the supplier for.
//
// Routes
//   POST {type:"register"}                     public  — supplier signs up
//   POST {type:"login", email, code}           supplier
//   GET  ?action=orders&email=&code=           supplier — their work orders
//   POST {type:"order-update", ...}            supplier — status + invoice upload
//   GET  ?action=admin&key=                    owner   — registry + all orders
//   POST {type:"approve", key, ...}            owner   — approve/suspend + email code
//   POST {type:"assign", key, ...}             owner   — create a work order
//   POST {type:"invoice", key, ...}            owner   — issue the commission invoice
//
// Env: NOTION_TOKEN, RESEND_API_KEY, OTP_FROM_EMAIL, BOOKING_EMAIL,
//      LEADS_KEY/PANEL_KEY (owner actions), NOTION_SUPPLIERS_DB,
//      NOTION_SUPPLIER_ORDERS_DB.
//
// Underscore-prefixed so Vercel treats it as a module, not a 13th serverless
// function — the plan caps at 12. /api/suppliers is rewritten to
// /api/requests?__route=suppliers, which delegates here.

import { randomBytes, scryptSync, timingSafeEqual, createHmac, randomInt } from "crypto";

const envFrom = (names) => { for (const n of names) { if (process.env[n] && String(process.env[n]).trim()) return String(process.env[n]).trim(); } return ""; };
const NOTION_TOKEN = envFrom(["NOTION_TOKEN", "BusinessPartnerSiteNotion", "NOTION_SECRET", "NOTION_API_KEY", "NOTION_KEY", "NOTION_INTEGRATION_TOKEN", "NOTION"]);
const NOTION_VERSION = "2022-06-28";
const SUPPLIERS_DB = process.env.NOTION_SUPPLIERS_DB || "d60933ed446e40ee8bcb8a640d5bcb52";
const ORDERS_DB = process.env.NOTION_SUPPLIER_ORDERS_DB || "fde498d5974c48f5a0ca9f21de4c0caf";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM = process.env.OTP_FROM_EMAIL || "Business Partner <onboarding@resend.dev>";
const TEAM_EMAIL = process.env.BOOKING_EMAIL || "business@businesspartner.sa";
const SITE = process.env.MKT_SITE_BASE || "https://www.businesspartner.sa";
// Signs the stateless e-mail verification token. Reuses the same secret as the
// rest of the site so there is one secret to rotate, not two.
const OTP_SECRET = (process.env.OTP_SECRET || "").trim();
// Google Sign-In: the audience every ID token must be issued for.
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || "").trim();
const CODE_TTL_MS = 15 * 60 * 1000;
// Same owner key that gates /monitor. ENV-ONLY: this repo is public, so a
// hardcoded fallback would be a public master key to the supplier registry.
const OWNER_KEYS = new Set([process.env.PANEL_KEY, process.env.LEADS_KEY, process.env.DASHBOARD_KEY].map((k) => String(k || "").trim()).filter(Boolean));
const ownerOk = (k) => OWNER_KEYS.size > 0 && OWNER_KEYS.has(String(k || "").trim());

const isEmail = (e) => typeof e === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const str = (v, n = 200) => String(v == null ? "" : v).trim().slice(0, n);
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const row = (k, v) => `<tr><td style="padding:4px 10px;color:#666">${esc(k)}</td><td style="padding:4px 10px"><b>${esc(v || "—")}</b></td></tr>`;

// A short, unambiguous code: no O/0/I/1 so it survives being read over the phone.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomCode(n) {
  let out = "";
  const bytes = randomBytes(n);
  for (let i = 0; i < n; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

// Salted scrypt, stored as "salt:hash" in the "بيانات الدخول" property. Same
// scheme as api/employer.js — no npm dependency, and the stored value cannot
// be reversed into the password.
function hashPassword(pw) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
}
function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(pw, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}
// Stateless e-mail verification: the code goes to the inbox, an HMAC over
// (email, code, expiry) goes to the browser. Neither alone is enough, so no
// pending-code table is needed.
const sealCode = (email, code, exp) => createHmac("sha256", OTP_SECRET).update(`sup-verify|${email}|${code}|${exp}`).digest("hex");
function checkSealed(email, code, token, exp) {
  if (!OTP_SECRET || !code || !token || !exp) return false;
  if (Date.now() > Number(exp)) return false;
  const expected = Buffer.from(sealCode(email, code, exp));
  const got = Buffer.from(String(token));
  return expected.length === got.length && timingSafeEqual(expected, got);
}

// Verify a Google ID token against Google's published keys. Done by hand
// because google-auth-library is not a dependency and this repo deliberately
// adds none.
async function verifyGoogleIdToken(idToken) {
  if (!GOOGLE_CLIENT_ID) return null;
  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) return null;
  let header, payload;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  } catch { return null; }
  if (header.alg !== "RS256") return null;
  let jwks;
  try {
    const r = await fetch("https://www.googleapis.com/oauth2/v3/certs");
    if (!r.ok) return null;
    jwks = await r.json();
  } catch { return null; }
  const jwk = (jwks.keys || []).find((k) => k.kid === header.kid);
  if (!jwk) return null;
  let ok = false;
  try {
    const { createPublicKey, createVerify } = await import("crypto");
    const key = createPublicKey({ key: jwk, format: "jwk" });
    const v = createVerify("RSA-SHA256");
    v.update(parts[0] + "." + parts[1]);
    v.end();
    ok = v.verify(key, Buffer.from(parts[2], "base64url"));
  } catch { return null; }
  if (!ok) return null;
  const iss = payload.iss || "";
  if (iss !== "accounts.google.com" && iss !== "https://accounts.google.com") return null;
  if (payload.aud !== GOOGLE_CLIENT_ID) return null;
  if (!payload.exp || Date.now() / 1000 > payload.exp) return null;
  if (payload.email_verified !== true && payload.email_verified !== "true") return null;
  if (!isEmail(payload.email)) return null;
  return { email: String(payload.email).toLowerCase(), name: payload.name || "", picture: payload.picture || "" };
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
    if (!r.ok) console.error("notion", path, r.status, JSON.stringify(json).slice(0, 300));
    return { ok: r.ok, status: r.status, json };
  } catch (e) { console.error("notion exception", String(e).slice(0, 200)); return { ok: false, status: 500, json: null }; }
}

async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY || !isEmail(to)) return { ok: false };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
    if (!r.ok) console.error("Resend error", r.status, (await r.text()).slice(0, 200));
    return { ok: r.ok };
  } catch (e) { console.error("email exception", String(e).slice(0, 150)); return { ok: false }; }
}

async function uploadToNotion(base64, filename, contentType) {
  if (!NOTION_TOKEN || !base64) return null;
  try {
    const created = await notion("file_uploads", "POST", {});
    if (!created.ok || !created.json || !created.json.id) return null;
    const form = new FormData();
    form.append("file", new Blob([Buffer.from(base64, "base64")], { type: contentType || "application/pdf" }), filename || "invoice.pdf");
    const send = await fetch(`https://api.notion.com/v1/file_uploads/${created.json.id}/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION },
      body: form,
    });
    if (!send.ok) { console.error("notion upload send", send.status); return null; }
    return created.json.id;
  } catch (e) { console.error("upload exception", String(e).slice(0, 150)); return null; }
}

// ---- property readers (Notion page → plain object) ----
const txt = (p) => ((p && p.rich_text) || []).map((t) => t.plain_text).join("").trim();
const title = (p) => ((p && p.title) || []).map((t) => t.plain_text).join("").trim();
const sel = (p) => (p && p.select && p.select.name) || "";
const multi = (p) => ((p && p.multi_select) || []).map((o) => o.name);
const nnum = (p) => (p && typeof p.number === "number" ? p.number : null);

function supplierOf(pg) {
  const p = pg.properties || {};
  return {
    id: pg.id,
    name: title(p["اسم المورّد"]),
    code: txt(p["كود المورّد"]),
    status: sel(p["الحالة"]),
    person: txt(p["المسؤول"]),
    phone: (p["الجوال"] && p["الجوال"].phone_number) || "",
    email: (p["البريد"] && p["البريد"].email) || "",
    city: txt(p["المدينة"]),
    cr: txt(p["السجل التجاري"]),
    vat: txt(p["الرقم الضريبي"]),
    categories: multi(p["التصنيف"]),
    services: txt(p["الخدمات"]),
    iban: txt(p["الآيبان"]),
    terms: sel(p["شروط السداد"]),
    commission: nnum(p["نسبة العمولة %"]),
    notes: txt(p["ملاحظات"]),
    verified: !!(p["البريد موثّق"] && p["البريد موثّق"].checkbox),
    method: sel(p["طريقة الدخول"]),
    url: pg.url,
  };
}

function orderOf(pg) {
  const p = pg.properties || {};
  return {
    id: pg.id,
    ref: title(p["أمر العمل"]),
    supplierId: ((p["المورّد"] && p["المورّد"].relation) || []).map((r) => r.id)[0] || "",
    clientRef: txt(p["مرجع طلب العميل"]),
    client: txt(p["العميل"]),
    service: txt(p["الخدمة المطلوبة"]),
    details: txt(p["التفاصيل"]),
    city: txt(p["المدينة"]),
    status: sel(p["الحالة"]),
    due: (p["تاريخ التسليم"] && p["تاريخ التسليم"].date && p["تاريخ التسليم"].date.start) || "",
    amount: nnum(p["قيمة أمر العمل"]),
    supplierInvoiceStatus: sel(p["حالة فاتورة المورّد"]),
    commission: nnum(p["قيمة العمولة"]),
    commissionStatus: sel(p["حالة فاتورة العمولة"]),
    commissionRef: txt(p["رقم فاتورة العمولة"]),
    quote: nnum(p["قيمة العرض المقدّم"]),
    leadTime: txt(p["مدة التنفيذ المقترحة"]),
    quotedAt: (p["تاريخ تقديم العرض"] && p["تاريخ تقديم العرض"].date && p["تاريخ تقديم العرض"].date.start) || "",
    notes: txt(p["ملاحظات"]),
    url: pg.url,
  };
}

async function findSupplierByEmail(email) {
  const r = await notion(`databases/${SUPPLIERS_DB}/query`, "POST", {
    page_size: 1,
    filter: { property: "البريد", email: { equals: email } },
  });
  const pg = r.ok && r.json && r.json.results && r.json.results[0];
  return pg ? supplierOf(pg) : null;
}

// Supplier authentication. The account must exist, the password must match and
// the e-mail must be verified. Approval is NOT an access gate any more: an
// unapproved supplier can sign in and watch their own status, they just cannot
// receive work. Every failure returns one generic result so the endpoint can't
// be used to discover which e-mails are registered.
async function authSupplier(email, password) {
  const e = str(email, 160).toLowerCase();
  const pw = String(password == null ? "" : password);
  if (!isEmail(e) || !pw) return null;
  const s = await findSupplierByEmail(e);
  if (!s) return null;
  const r = await notion(`pages/${s.id}`);
  if (!r.ok || !r.json) return null;
  const stored = txt(r.json.properties["بيانات الدخول"]);
  if (!stored || !verifyPassword(pw, stored)) return null;
  return { ...s, verified: !!(r.json.properties["البريد موثّق"] && r.json.properties["البريد موثّق"].checkbox) };
}

async function ordersForSupplier(supplierId) {
  const r = await notion(`databases/${ORDERS_DB}/query`, "POST", {
    page_size: 100,
    filter: { property: "المورّد", relation: { contains: supplierId } },
    sorts: [{ property: "آخر تحديث", direction: "descending" }],
  });
  return r.ok && r.json ? (r.json.results || []).map(orderOf) : [];
}

export async function handleSuppliers(req, res) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  const url = new URL(req.url, "http://x");
  const q = Object.fromEntries(url.searchParams);
  const ok = (o) => { res.statusCode = 200; return res.end(JSON.stringify({ ok: true, ...o })); };
  const bad = (error, status = 400) => { res.statusCode = status; return res.end(JSON.stringify({ ok: false, error })); };

  if (!NOTION_TOKEN) return bad("not_configured", 503);

  // ---------------- GET ----------------
  if (req.method === "GET") {
    // Supplier: my work orders
    if (q.action === "orders") {
      const s = await authSupplier(q.email, q.pw);
      if (!s) return bad("unauthorized", 401);
      if (!s.verified) return bad("email_unverified", 403);
      const orders = await ordersForSupplier(s.id);
      return ok({ supplier: { name: s.name, code: s.code, person: s.person, city: s.city, categories: s.categories, terms: s.terms, status: s.status }, orders });
    }
    // Owner: the whole registry + every work order
    if (q.action === "admin") {
      if (!ownerOk(q.key)) return bad("unauthorized", 401);
      const [sr, or_] = await Promise.all([
        notion(`databases/${SUPPLIERS_DB}/query`, "POST", { page_size: 100, sorts: [{ property: "آخر نشاط", direction: "descending" }] }),
        notion(`databases/${ORDERS_DB}/query`, "POST", { page_size: 100, sorts: [{ property: "آخر تحديث", direction: "descending" }] }),
      ]);
      const suppliers = sr.ok && sr.json ? (sr.json.results || []).map(supplierOf) : [];
      const orders = or_.ok && or_.json ? (or_.json.results || []).map(orderOf) : [];
      return ok({ suppliers, orders });
    }
    return bad("unknown_action", 404);
  }

  if (req.method !== "POST") return bad("method_not_allowed", 405);

  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  if (!b) b = await new Promise((resolve) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } }); });

  // ---------------- sign up: e-mail + password, code to the inbox ----------------
  if (b.type === "register" || b.type === "signup") {
    const name = str(b.company, 200);
    const person = str(b.person, 160);
    const phone = str(b.phone, 40);
    const email = str(b.email, 160).toLowerCase();
    const password = String(b.password == null ? "" : b.password);
    const city = str(b.city, 80);
    const cr = str(b.cr, 40);
    const vat = str(b.vat, 40);
    const services = str(b.services || b.notes, 900);
    const cats = (Array.isArray(b.categories) ? b.categories : [b.category]).map((c) => str(c, 60)).filter(Boolean).slice(0, 8);
    if (!name || !person || !phone || !isEmail(email)) return bad("invalid_fields");
    if (password.length < 8) return bad("weak_password");
    if (!OTP_SECRET) return bad("not_configured", 503);

    // A second sign-up on an existing e-mail must not overwrite the account or
    // reveal that it exists — it just re-sends a verification code.
    const existing = await findSupplierByEmail(email);
    const code = String(randomInt(100000, 1000000));
    const exp = Date.now() + CODE_TTL_MS;
    const token = sealCode(email, code, exp);

    if (!existing) {
      const supCode = "SUP-" + randomCode(6);
      const props = {
        "اسم المورّد": { title: [{ text: { content: name } }] },
        "كود المورّد": { rich_text: [{ text: { content: supCode } }] },
        "بيانات الدخول": { rich_text: [{ text: { content: hashPassword(password) } }] },
        "طريقة الدخول": { select: { name: "كلمة مرور" } },
        "البريد موثّق": { checkbox: false },
        "الحالة": { select: { name: "جديد" } },
        "المسؤول": { rich_text: [{ text: { content: person } }] },
        "الجوال": { phone_number: phone },
        "البريد": { email },
        "المدينة": { rich_text: [{ text: { content: city } }] },
        "السجل التجاري": { rich_text: [{ text: { content: cr } }] },
        "الرقم الضريبي": { rich_text: [{ text: { content: vat } }] },
        "الخدمات": { rich_text: [{ text: { content: services.slice(0, 1900) } }] },
        "تاريخ التسجيل": { date: { start: new Date().toISOString().slice(0, 10) } },
      };
      if (cats.length) props["التصنيف"] = { multi_select: cats.map((n) => ({ name: n })) };
      const created = await notion("pages", "POST", { parent: { database_id: SUPPLIERS_DB }, properties: props });
      if (!created.ok) return bad("save_failed", 502);
      await sendEmail(TEAM_EMAIL, `🏭 مورّد جديد ${supCode} — ${name}`,
        `<div dir="rtl" style="font-family:Arial,sans-serif"><h2 style="color:#0B1B5A">تسجيل مورّد جديد — ${esc(supCode)}</h2><table>${row("الشركة", name) + row("المسؤول", person) + row("الجوال", phone) + row("البريد", email) + row("المدينة", city) + row("السجل التجاري", cr) + row("التصنيف", cats.join("، ")) + row("الخدمات", services)}</table>
        <p>اعتمِده من <a href="${SITE}/suppliers-admin">لوحة تحكم الموردين</a> ليبدأ استلام طلبات عروض الأسعار.</p></div>`);
    }

    await sendEmail(email, `رمز تفعيل حسابك — ${code}`,
      `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:520px;margin:auto;text-align:center">
      <h2 style="color:#0B1B5A">تفعيل حساب المورّد</h2>
      <p>رمز التحقق الخاص بك:</p>
      <p style="font-size:34px;letter-spacing:10px;font-weight:700;color:#0B1B5A;margin:18px 0">${code}</p>
      <p style="color:#666">صالح لمدة 15 دقيقة. إذا لم تطلب هذا الرمز فتجاهل الرسالة.</p></div>`);
    return ok({ token, exp, next: "verify" });
  }

  // ---------------- verify the e-mailed code ----------------
  if (b.type === "verify-email") {
    const email = str(b.email, 160).toLowerCase();
    const code = str(b.code, 10);
    if (!checkSealed(email, code, b.token, b.exp)) return bad("invalid_code", 400);
    const s = await findSupplierByEmail(email);
    if (!s) return bad("invalid_code", 400);
    const upd = await notion(`pages/${s.id}`, "PATCH", { properties: { "البريد موثّق": { checkbox: true } } });
    if (!upd.ok) return bad("save_failed", 502);
    return ok({ verified: true });
  }

  // ---------------- resend the verification code ----------------
  if (b.type === "resend-code") {
    const email = str(b.email, 160).toLowerCase();
    if (!isEmail(email) || !OTP_SECRET) return bad("invalid_fields");
    const s = await findSupplierByEmail(email);
    const code = String(randomInt(100000, 1000000));
    const exp = Date.now() + CODE_TTL_MS;
    const token = sealCode(email, code, exp);
    // Always answer the same shape, whether or not the address is registered.
    if (s) {
      await sendEmail(email, `رمز تفعيل حسابك — ${code}`,
        `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:520px;margin:auto;text-align:center"><h2 style="color:#0B1B5A">رمز التحقق</h2>
        <p style="font-size:34px;letter-spacing:10px;font-weight:700;color:#0B1B5A;margin:18px 0">${code}</p>
        <p style="color:#666">صالح لمدة 15 دقيقة.</p></div>`);
    }
    return ok({ token, exp });
  }

  // ---------------- sign in with Google ----------------
  if (b.type === "google") {
    if (!GOOGLE_CLIENT_ID) return bad("google_not_configured", 503);
    const g = await verifyGoogleIdToken(b.credential);
    if (!g) return bad("bad_google_token", 401);
    let s = await findSupplierByEmail(g.email);
    if (!s) {
      // First Google sign-in creates the account. Google already proved the
      // address, so it starts verified — but still unapproved.
      const supCode = "SUP-" + randomCode(6);
      const created = await notion("pages", "POST", {
        parent: { database_id: SUPPLIERS_DB },
        properties: {
          "اسم المورّد": { title: [{ text: { content: str(b.company, 200) || g.name || g.email } }] },
          "كود المورّد": { rich_text: [{ text: { content: supCode } }] },
          "طريقة الدخول": { select: { name: "Google" } },
          "البريد موثّق": { checkbox: true },
          "الحالة": { select: { name: "جديد" } },
          "المسؤول": { rich_text: [{ text: { content: str(b.person, 160) || g.name } }] },
          "البريد": { email: g.email },
          "تاريخ التسجيل": { date: { start: new Date().toISOString().slice(0, 10) } },
        },
      });
      if (!created.ok) return bad("save_failed", 502);
      await sendEmail(TEAM_EMAIL, `🏭 مورّد جديد عبر Google — ${g.name || g.email}`,
        `<div dir="rtl" style="font-family:Arial,sans-serif"><h2 style="color:#0B1B5A">تسجيل مورّد عبر Google</h2><table>${row("الاسم", g.name) + row("البريد", g.email) + row("كود المورّد", supCode)}</table>
        <p>اعتمِده من <a href="${SITE}/suppliers-admin">لوحة تحكم الموردين</a>.</p></div>`);
      s = await findSupplierByEmail(g.email);
      if (!s) return bad("save_failed", 502);
    } else if (!s.verified) {
      await notion(`pages/${s.id}`, "PATCH", { properties: { "البريد موثّق": { checkbox: true } } });
    }
    const orders = await ordersForSupplier(s.id);
    return ok({ google: true, supplier: { name: s.name, code: s.code, person: s.person, city: s.city, categories: s.categories, terms: s.terms, status: s.status }, orders });
  }

  // ---------------- sign in with e-mail + password ----------------
  if (b.type === "login") {
    const s = await authSupplier(b.email, b.password);
    if (!s) return bad("bad_credentials", 401);
    if (!s.verified) return bad("email_unverified", 403);
    const orders = await ordersForSupplier(s.id);
    return ok({ supplier: { name: s.name, code: s.code, person: s.person, city: s.city, categories: s.categories, terms: s.terms, status: s.status }, orders });
  }

  // ---------------- supplier updates a work order ----------------
  if (b.type === "order-update") {
    const s = await authSupplier(b.email, b.password);
    if (!s) return bad("unauthorized", 401);
    if (!s.verified) return bad("email_unverified", 403);
    const orderId = str(b.orderId, 60);
    if (!orderId) return bad("invalid_fields");
    // The order must belong to this supplier — never trust the id alone.
    const mine = await ordersForSupplier(s.id);
    const order = mine.find((o) => o.id === orderId);
    if (!order) return bad("not_found", 404);

    const props = {};
    // Suppliers may only move an order along their own lane. Approving,
    // rejecting and cancelling stay with the owner.
    const allowed = ["عرض مُقدَّم", "قبله المورّد", "قيد التنفيذ", "تم التسليم"];
    const status = str(b.status, 40);
    if (status && allowed.includes(status)) props["الحالة"] = { select: { name: status } };
    // Answering a request for quotation: price + lead time, stamped with the date.
    const quote = num(b.quote);
    if (quote != null) {
      props["قيمة العرض المقدّم"] = { number: quote };
      props["تاريخ تقديم العرض"] = { date: { start: new Date().toISOString().slice(0, 10) } };
      if (!status) props["الحالة"] = { select: { name: "عرض مُقدَّم" } };
    }
    if (b.leadTime) props["مدة التنفيذ المقترحة"] = { rich_text: [{ text: { content: str(b.leadTime, 200) } }] };
    if (b.notes) props["ملاحظات"] = { rich_text: [{ text: { content: str(b.notes, 1900) } }] };

    let uploaded = null;
    if (b.invoiceBase64) {
      uploaded = await uploadToNotion(b.invoiceBase64, str(b.invoiceName, 120) || `فاتورة-${order.ref}.pdf`, str(b.invoiceType, 80));
      if (uploaded) {
        props["فاتورة المورّد"] = { files: [{ type: "file_upload", file_upload: { id: uploaded }, name: str(b.invoiceName, 100) || `فاتورة ${order.ref}` }] };
        props["حالة فاتورة المورّد"] = { select: { name: "مرفوعة" } };
      }
    }
    if (!Object.keys(props).length) return bad("nothing_to_update");
    const upd = await notion(`pages/${orderId}`, "PATCH", { properties: props });
    if (!upd.ok) return bad("save_failed", 502);

    await sendEmail(TEAM_EMAIL, `📦 تحديث أمر عمل ${order.ref} — ${s.name}`,
      `<div dir="rtl" style="font-family:Arial,sans-serif"><h2 style="color:#0B1B5A">تحديث من المورّد</h2><table>${row("أمر العمل", order.ref) + row("المورّد", s.name) + row("الحالة الجديدة", status || order.status) + row("فاتورة مرفوعة", uploaded ? "نعم" : "لا") + row("ملاحظات", str(b.notes, 400))}</table></div>`);
    return ok({ invoiceUploaded: !!uploaded });
  }

  // ---------------- owner: approve / suspend a supplier ----------------
  if (b.type === "approve") {
    if (!ownerOk(b.key)) return bad("unauthorized", 401);
    const id = str(b.supplierId, 60);
    const status = str(b.status, 20);
    if (!id || !["معتمد", "موقوف", "مرفوض", "جديد"].includes(status)) return bad("invalid_fields");
    const pg = await notion(`pages/${id}`);
    if (!pg.ok || !pg.json) return bad("not_found", 404);
    const s = supplierOf(pg.json);
    const props = { "الحالة": { select: { name: status } } };
    if (b.commission != null && num(b.commission) != null) props["نسبة العمولة %"] = { number: num(b.commission) };
    if (b.terms) props["شروط السداد"] = { select: { name: str(b.terms, 40) } };
    const upd = await notion(`pages/${id}`, "PATCH", { properties: props });
    if (!upd.ok) return bad("save_failed", 502);

    if (status === "معتمد" && s.email) {
      await sendEmail(s.email, `تم اعتمادك كمورّد — رمز دخول بوابة الموردين`,
        `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px"><h2 style="color:#0B1B5A">تم اعتمادكم ✅</h2>
        <p>مرحباً ${esc(s.person || s.name)}، اعتمدنا <b>${esc(s.name)}</b> في شبكة موردي بيزنس بارتنر.</p>
        <table>${row("كود المورّد", s.code) + row("البريد", s.email)}</table>
        <p style="margin:18px 0"><a href="${SITE}/partner-dashboard" style="background:#0B1B5A;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block">افتح بوابة الموردين</a></p>
        <p>ادخل ببريدك وكلمة المرور التي أنشأتها عند التسجيل. من البوابة تستقبل طلبات عروض الأسعار، تتابع أوامر العمل، وترفع فواتيرك.</p>
        <p style="color:#666">بيزنس بارتنر · الرياض</p></div>`);
    }
    if (status === "موقوف" && s.email) {
      await sendEmail(s.email, `إيقاف مؤقت لحساب المورّد — ${s.name}`,
        `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px"><p>مرحباً ${esc(s.person || s.name)}، أُوقف وصولكم لبوابة الموردين مؤقتاً. للتواصل: ${esc(TEAM_EMAIL)}</p></div>`);
    }
    return ok({ status });
  }

  // ---------------- owner: assign a work order to a supplier ----------------
  if (b.type === "assign") {
    if (!ownerOk(b.key)) return bad("unauthorized", 401);
    const supplierId = str(b.supplierId, 60);
    const service = str(b.service, 200);
    if (!supplierId || !service) return bad("invalid_fields");
    const pg = await notion(`pages/${supplierId}`);
    if (!pg.ok || !pg.json) return bad("supplier_not_found", 404);
    const s = supplierOf(pg.json);
    if (s.status !== "معتمد") return bad("supplier_not_approved", 409);

    const ref = "PO-" + Date.now().toString().slice(-6);
    const amount = num(b.amount);
    const commission = num(b.commission);
    const due = /^\d{4}-\d{2}-\d{2}$/.test(str(b.due, 10)) ? str(b.due, 10) : null;
    const props = {
      "أمر العمل": { title: [{ text: { content: `${ref} — ${service}`.slice(0, 200) } }] },
      "المورّد": { relation: [{ id: supplierId }] },
      "مرجع طلب العميل": { rich_text: [{ text: { content: str(b.clientRef, 60) } }] },
      "العميل": { rich_text: [{ text: { content: str(b.client, 160) } }] },
      "الخدمة المطلوبة": { rich_text: [{ text: { content: service } }] },
      "التفاصيل": { rich_text: [{ text: { content: str(b.details, 1900) } }] },
      "المدينة": { rich_text: [{ text: { content: str(b.city, 80) } }] },
      "الحالة": { select: { name: "أُرسل للمورّد" } },
      "حالة فاتورة المورّد": { select: { name: "لم تُرفع" } },
      "حالة فاتورة العمولة": { select: { name: "لم تُصدر" } },
    };
    if (amount != null) props["قيمة أمر العمل"] = { number: amount };
    if (commission != null) props["قيمة العمولة"] = { number: commission };
    if (due) props["تاريخ التسليم"] = { date: { start: due } };
    const created = await notion("pages", "POST", { parent: { database_id: ORDERS_DB }, properties: props });
    if (!created.ok) return bad("save_failed", 502);

    await sendEmail(s.email, `📦 أمر عمل جديد ${ref} — ${service}`,
      `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px"><h2 style="color:#0B1B5A">أمر عمل جديد — ${esc(ref)}</h2>
      <table>${row("الخدمة", service) + row("المدينة", str(b.city, 80)) + row("موعد التسليم", due) + row("قيمة أمر العمل", amount != null ? amount + " ﷼" : "—") + row("التفاصيل", str(b.details, 600))}</table>
      <p style="margin:18px 0"><a href="${SITE}/partner-dashboard" style="background:#0B1B5A;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block">افتح البوابة وأكّد الاستلام</a></p>
      <p>من البوابة تقبل أمر العمل، تحدّث حالته أثناء التنفيذ، وترفع فاتورتك بعد التسليم.</p></div>`);
    return ok({ ref, id: created.json && created.json.id });
  }

  // ---------------- owner: request quotations from several suppliers ----------------
  if (b.type === "rfq") {
    if (!ownerOk(b.key)) return bad("unauthorized", 401);
    const ids = (Array.isArray(b.supplierIds) ? b.supplierIds : []).map((i) => str(i, 60)).filter(Boolean).slice(0, 20);
    const service = str(b.service, 200);
    if (!ids.length || !service) return bad("invalid_fields");
    const ref = "RFQ-" + Date.now().toString().slice(-6);
    const due = /^\d{4}-\d{2}-\d{2}$/.test(str(b.due, 10)) ? str(b.due, 10) : null;
    const made = [];
    for (const id of ids) {
      const pg = await notion(`pages/${id}`);
      if (!pg.ok || !pg.json) continue;
      const s = supplierOf(pg.json);
      if (s.status !== "معتمد") continue;
      const props = {
        "أمر العمل": { title: [{ text: { content: `${ref} — ${service}`.slice(0, 200) } }] },
        "المورّد": { relation: [{ id }] },
        "مرجع طلب العميل": { rich_text: [{ text: { content: str(b.clientRef, 60) } }] },
        "العميل": { rich_text: [{ text: { content: str(b.client, 160) } }] },
        "الخدمة المطلوبة": { rich_text: [{ text: { content: service } }] },
        "التفاصيل": { rich_text: [{ text: { content: str(b.details, 1900) } }] },
        "المدينة": { rich_text: [{ text: { content: str(b.city, 80) } }] },
        "الحالة": { select: { name: "طلب عرض سعر" } },
        "حالة فاتورة المورّد": { select: { name: "لم تُرفع" } },
        "حالة فاتورة العمولة": { select: { name: "لم تُصدر" } },
      };
      if (due) props["تاريخ التسليم"] = { date: { start: due } };
      const created = await notion("pages", "POST", { parent: { database_id: ORDERS_DB }, properties: props });
      if (!created.ok) continue;
      made.push({ supplier: s.name, id: created.json && created.json.id });
      await sendEmail(s.email, `📝 طلب عرض سعر ${ref} — ${service}`,
        `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px"><h2 style="color:#0B1B5A">طلب عرض سعر — ${esc(ref)}</h2>
        <table>${row("الخدمة", service) + row("المدينة", str(b.city, 80)) + row("مطلوب التسليم", due) + row("التفاصيل", str(b.details, 600))}</table>
        <p style="margin:18px 0"><a href="${SITE}/partner-dashboard" style="background:#0B1B5A;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block">قدّم عرض سعرك</a></p>
        <p>ادخل البوابة وأدخل سعرك ومدة التنفيذ. نراجع العروض ونبلغك بالنتيجة.</p></div>`);
    }
    if (!made.length) return bad("no_approved_suppliers", 409);
    return ok({ ref, sent: made.length, suppliers: made });
  }

  // ---------------- owner: award an RFQ to one supplier ----------------
  if (b.type === "award") {
    if (!ownerOk(b.key)) return bad("unauthorized", 401);
    const orderId = str(b.orderId, 60);
    if (!orderId) return bad("invalid_fields");
    const pg = await notion(`pages/${orderId}`);
    if (!pg.ok || !pg.json) return bad("not_found", 404);
    const o = orderOf(pg.json);
    // The awarded value defaults to the price the supplier actually quoted.
    const amount = num(b.amount) != null ? num(b.amount) : (o.quote != null ? o.quote : o.amount);
    const props = { "الحالة": { select: { name: "أُرسل للمورّد" } } };
    if (amount != null) props["قيمة أمر العمل"] = { number: amount };
    if (num(b.commission) != null) props["قيمة العمولة"] = { number: num(b.commission) };
    const upd = await notion(`pages/${orderId}`, "PATCH", { properties: props });
    if (!upd.ok) return bad("save_failed", 502);

    // Close the losing quotes on the same RFQ so the board stays truthful.
    let closed = 0;
    const rfq = (o.ref || "").split(" — ")[0];
    if (rfq && rfq.startsWith("RFQ-")) {
      const sib = await notion(`databases/${ORDERS_DB}/query`, "POST", {
        page_size: 50,
        filter: { and: [{ property: "أمر العمل", title: { starts_with: rfq } }, { property: "الحالة", select: { does_not_equal: "أُرسل للمورّد" } }] },
      });
      for (const pgx of (sib.ok && sib.json ? sib.json.results || [] : [])) {
        if (pgx.id === orderId) continue;
        await notion(`pages/${pgx.id}`, "PATCH", { properties: { "الحالة": { select: { name: "لم يُرسَ" } } } });
        closed++;
      }
    }

    let email = "";
    if (o.supplierId) { const sp = await notion(`pages/${o.supplierId}`); if (sp.ok && sp.json) email = supplierOf(sp.json).email; }
    if (email) {
      await sendEmail(email, `✅ تم ترسية أمر العمل ${o.ref}`,
        `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px"><h2 style="color:#0B1B5A">تمت الترسية عليكم ✅</h2>
        <table>${row("أمر العمل", o.ref) + row("الخدمة", o.service) + row("القيمة المعتمدة", amount != null ? amount + " ﷼" : "—")}</table>
        <p style="margin:18px 0"><a href="${SITE}/partner-dashboard" style="background:#0B1B5A;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block">افتح البوابة وابدأ التنفيذ</a></p></div>`);
    }
    return ok({ amount, closedOthers: closed });
  }

  // ---------------- owner: issue the commission invoice on the supplier ----------------
  if (b.type === "invoice") {
    if (!ownerOk(b.key)) return bad("unauthorized", 401);
    const orderId = str(b.orderId, 60);
    if (!orderId) return bad("invalid_fields");
    const pg = await notion(`pages/${orderId}`);
    if (!pg.ok || !pg.json) return bad("not_found", 404);
    const o = orderOf(pg.json);
    const amount = num(b.amount) != null ? num(b.amount) : o.commission;
    if (amount == null) return bad("no_amount");
    const invRef = str(b.invoiceRef, 40) || "INV-" + Date.now().toString().slice(-6);
    const props = {
      "قيمة العمولة": { number: amount },
      "رقم فاتورة العمولة": { rich_text: [{ text: { content: invRef } }] },
      "حالة فاتورة العمولة": { select: { name: str(b.status, 20) || "صادرة" } },
    };
    const upd = await notion(`pages/${orderId}`, "PATCH", { properties: props });
    if (!upd.ok) return bad("save_failed", 502);

    let supplierEmail = "";
    if (o.supplierId) {
      const sp = await notion(`pages/${o.supplierId}`);
      if (sp.ok && sp.json) supplierEmail = supplierOf(sp.json).email;
    }
    if (supplierEmail) {
      await sendEmail(supplierEmail, `فاتورة ${invRef} — ${o.ref}`,
        `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px"><h2 style="color:#0B1B5A">فاتورة من بيزنس بارتنر</h2>
        <table>${row("رقم الفاتورة", invRef) + row("أمر العمل", o.ref) + row("الخدمة", o.service) + row("المبلغ", amount + " ﷼")}</table>
        <p>تفاصيل الفاتورة وسدادها متاحة في <a href="${SITE}/partner-dashboard">بوابة الموردين</a>.</p></div>`);
    }
    return ok({ invoiceRef: invRef, amount });
  }

  // ---------------- owner: update a work order (status, payment) ----------------
  if (b.type === "order-admin") {
    if (!ownerOk(b.key)) return bad("unauthorized", 401);
    const orderId = str(b.orderId, 60);
    if (!orderId) return bad("invalid_fields");
    const props = {};
    if (b.status) props["الحالة"] = { select: { name: str(b.status, 40) } };
    if (b.supplierInvoiceStatus) props["حالة فاتورة المورّد"] = { select: { name: str(b.supplierInvoiceStatus, 40) } };
    if (b.commissionStatus) props["حالة فاتورة العمولة"] = { select: { name: str(b.commissionStatus, 40) } };
    if (num(b.amount) != null) props["قيمة أمر العمل"] = { number: num(b.amount) };
    if (!Object.keys(props).length) return bad("nothing_to_update");
    const upd = await notion(`pages/${orderId}`, "PATCH", { properties: props });
    if (!upd.ok) return bad("save_failed", 502);
    return ok({});
  }

  return bad("unknown_type", 404);
}
