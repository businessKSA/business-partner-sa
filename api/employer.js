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

import crypto from "node:crypto";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

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
function makeRef(_seed) {
  // SECURITY: the access code is the sole bearer token that unlocks all
  // candidate PII once the row is activated, so it must be unguessable. The
  // old 4-char hash (~9.5e5 space, derived deterministically from the form
  // fields) was brute-forceable and predictable — replaced with 12 chars of
  // CSPRNG entropy from a 31-symbol alphabet (~2.5e17 combinations).
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) out += abc[bytes[i] % abc.length];
  return "BP-EMP-" + out;
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

// ---- Passwordless email-OTP login ------------------------------------------
// A fresh 6-digit code is emailed and sealed (AES-256-GCM) into a short-lived
// challenge token handed to the client — no DB/session store needed (same
// stateless pattern as api/otp.js). The employer's access code is only ever
// returned AFTER the emailed code is verified against the sealed challenge, so
// possession of the inbox alone gates the dashboard. Lets the owner/employers
// sign in with just their email + a mailed code — no password, no bearer code.
const OTP_SECRET = process.env.OTP_SECRET || "";
const OTP_TTL_MS = 10 * 60 * 1000;
function otpKey() { return crypto.createHash("sha256").update(String(OTP_SECRET)).digest(); }
function sealOtp(obj) {
  const iv = randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", otpKey(), iv);
  const enc = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64url");
}
function unsealOtp(token) {
  try {
    const raw = Buffer.from(String(token || ""), "base64url");
    if (raw.length < 29) return null;
    const iv = raw.subarray(0, 12), tag = raw.subarray(12, 28), enc = raw.subarray(28);
    const d = crypto.createDecipheriv("aes-256-gcm", otpKey(), iv);
    d.setAuthTag(tag);
    return JSON.parse(Buffer.concat([d.update(enc), d.final()]).toString("utf8"));
  } catch { return null; }
}
async function findEmployerByEmail(email) {
  const q = await notion(`databases/${DB_ID}/query`, { page_size: 1, filter: { property: "البريد", email: { equals: email } } });
  if (!q.ok) return null;
  const data = await q.json();
  return (data.results || [])[0] || null;
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
      const q = await notion(`databases/${DB_ID}/query`, { page_size: 1, filter: { property: "البريد", email: { equals: email } } });
      if (!q.ok) { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_error" })); }
      const data = await q.json();
      const row = (data.results || [])[0];
      const stored = row && row.properties && row.properties["بيانات الدخول"];
      const storedHash = stored && stored.rich_text && stored.rich_text[0] && stored.rich_text[0].plain_text;
      if (!row || !storedHash || !verifyPassword(password, storedHash)) {
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
  // Passwordless login step 1 — email a fresh 6-digit code. The sealed
  // challenge is returned to the client, but the code is only actually
  // DELIVERED to a registered + ACTIVE employer; the response is identical
  // either way so it can't enumerate accounts.
  if (b.action === "otp-send") {
    const email = clip(b.email, 160).toLowerCase();
    if (!isEmail(email)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_email" })); }
    if (!OTP_SECRET) { res.statusCode = 500; return res.end(JSON.stringify({ ok: false, error: "otp_not_configured" })); }
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    const challenge = sealOtp({ email, code, exp: Date.now() + OTP_TTL_MS });
    try {
      if (NOTION_TOKEN && DB_ID) {
        const row = await findEmployerByEmail(email);
        const status = row ? txtProp(row.properties["الحالة"], "select") : "";
        if (row && status === "مفعّل") {
          const company = txtProp(row.properties["اسم الشركة"], "title").replace(/[<>&]/g, "");
          await sendMail(email, `رمز الدخول: ${code} — Business Partner`, `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
            <h2 style="color:#0B1B5A">رمز الدخول للوحة التوظيف</h2>
            <p>${company ? "حساب: " + company + "<br>" : ""}رمز الدخول لمرة واحدة (صالح 10 دقائق):</p>
            <p style="font-size:30px;font-weight:bold;letter-spacing:8px;color:#0B1B5A">${code}</p>
            <p style="color:#666">إذا لم تطلب هذا الرمز، تجاهل هذه الرسالة.</p>
          </div>`);
        }
      }
    } catch (e) { console.error("otp-send lookup error", String(e).slice(0, 150)); }
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, challenge, to: email, message: "إذا كان بريدك مسجلاً ومفعّلاً فسيصلك رمز الدخول خلال دقائق." }));
  }

  // Passwordless login step 2 — verify the mailed code against the sealed
  // challenge, then hand back the employer's access code + plan so the
  // dashboard unlocks without the user ever seeing a bearer code.
  if (b.action === "otp-login") {
    const email = clip(b.email, 160).toLowerCase();
    const code = String(b.code || "").trim();
    const payload = unsealOtp(b.challenge);
    if (!payload || String(payload.email) !== email) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "otp_invalid" })); }
    if (Date.now() > Number(payload.exp || 0)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "expired" })); }
    const want = Buffer.from(String(payload.code)); const got = Buffer.from(code);
    if (want.length !== got.length || !timingSafeEqual(want, got)) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "otp_invalid" })); }
    if (!NOTION_TOKEN || !DB_ID) { res.statusCode = 500; return res.end(JSON.stringify({ ok: false, error: "not_configured" })); }
    try {
      const row = await findEmployerByEmail(email);
      const status = row ? txtProp(row.properties["الحالة"], "select") : "";
      if (!row || status !== "مفعّل") { res.statusCode = 403; return res.end(JSON.stringify({ ok: false, error: "not_active" })); }
      res.statusCode = 200;
      return res.end(JSON.stringify({
        ok: true,
        code: txtProp(row.properties["رمز الوصول"]),
        plan: txtProp(row.properties["الباقة"], "select"),
        status,
        company: txtProp(row.properties["اسم الشركة"], "title"),
      }));
    } catch (e) {
      console.error("otp-login error", String(e).slice(0, 200));
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
      const q = await notion(`databases/${DB_ID}/query`, { page_size: 1, filter: { property: "البريد", email: { equals: email } } });
      if (q.ok) {
        const data = await q.json();
        const row = (data.results || [])[0];
        const code = row ? txtProp(row.properties["رمز الوصول"]) : "";
        const company = (row ? txtProp(row.properties["اسم الشركة"], "title") : "").replace(/[<>&]/g, "");
        if (code) {
          await sendMail(email, `رمز الوصول: ${code} — Business Partner`, `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
            <h2 style="color:#0B1B5A">رمز الوصول للوحة التوظيف</h2>
            <p>${company ? "حساب: " + company + "<br>" : ""}رمز الوصول الخاص بك هو:</p>
            <p style="font-size:28px;font-weight:bold;letter-spacing:3px;color:#0B1B5A">${code}</p>
            <p>ادخل به من صفحة <a href="https://www.businesspartner.sa/ar/employer-login">تسجيل دخول أصحاب العمل</a> لفتح لوحة التوظيف.</p>
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
  const notes = clip(b.notes, 600);

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
      <p>يُفعّل هذا الرمز فور تأكيد الدفع، وبعدها تدخل لوحة التوظيف وتتصفّح المرشّحين ببياناتهم الكاملة.</p>
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
