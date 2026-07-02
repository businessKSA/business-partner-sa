// Business Partner 3.0 — OTP verification serverless function (ESM).
// Stateless email OTP: the code is sealed into an encrypted "challenge" with
// AES-256-GCM (server secret) and emailed to the user. Verify unseals the
// challenge and compares the entered code. No database required.
//
// Channels: "email" (live via Resend) now; "sms" is scaffolded for later.
//
// Required env vars (Vercel → Settings → Environment Variables):
//   OTP_SECRET       strong random string (>= 32 chars) — signs/encrypts codes
//   RESEND_API_KEY   Resend API key (email delivery)
//   OTP_FROM_EMAIL   verified sender, e.g. "Business Partner <noreply@businesspartner.sa>"
// Optional:
//   OTP_DEV_ECHO=1   returns the code in the response (TESTING ONLY — never in production)
import crypto from "node:crypto";

const SECRET = process.env.OTP_SECRET || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM = process.env.OTP_FROM_EMAIL || "Business Partner <onboarding@resend.dev>";
const TTL_MS = 10 * 60 * 1000; // code valid for 10 minutes
const DEV_ECHO = process.env.OTP_DEV_ECHO === "1";

const b64u = (buf) => Buffer.from(buf).toString("base64url");
const keyFromSecret = () => crypto.createHash("sha256").update(SECRET).digest(); // 32 bytes

function seal(obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyFromSecret(), iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(obj), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return b64u(Buffer.concat([iv, tag, ct]));
}
function unseal(token) {
  const raw = Buffer.from(token, "base64url");
  const iv = raw.subarray(0, 12), tag = raw.subarray(12, 28), ct = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", keyFromSecret(), iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  return JSON.parse(pt);
}
const sessionToken = (email) =>
  b64u(email) + "." + crypto.createHmac("sha256", SECRET).update(email + "|" + Date.now()).digest("base64url");
const maskEmail = (e) => e.replace(/^(.).*(.@.*)$/, "$1***$2");
const isEmail = (e) => typeof e === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

async function sendEmail(to, code) {
  if (!RESEND_API_KEY) return { ok: false, error: "email_not_configured" };
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
    <h2 style="color:#0B1B5A">رمز التحقق — Business Partner</h2>
    <p>رمز الدخول الخاص بك هو / Your verification code is:</p>
    <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#0B1B5A">${code}</p>
    <p style="color:#666">صالح لمدة 10 دقائق. إذا لم تطلبه، تجاهل هذه الرسالة.<br>Valid for 10 minutes. If you didn't request it, ignore this email.</p>
  </div>`;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject: `رمز التحقق: ${code} — Business Partner`, html }),
    });
    if (!r.ok) { console.error("Resend error", r.status, await r.text()); return { ok: false, error: "email_send_failed" }; }
    return { ok: true };
  } catch (e) { console.error("email exception", e); return { ok: false, error: "email_send_failed" }; }
}

// Scaffold for SMS OTP — wire a provider (e.g. Unifonic/Twilio) here later.
async function sendSms(_phone, _code) {
  return { ok: false, error: "sms_not_configured" };
}

async function readBody(req) {
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  if (body) return body;
  return await new Promise((resolve) => {
    let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
  });
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method === "GET") {
    res.statusCode = 200;
    return res.end(JSON.stringify({
      status: "ok",
      secretConfigured: !!SECRET,
      emailConfigured: !!RESEND_API_KEY,
      smsConfigured: false,
      devEcho: DEV_ECHO,
    }));
  }
  if (req.method !== "POST") { res.statusCode = 405; return res.end(JSON.stringify({ error: "method_not_allowed" })); }
  if (!SECRET) { res.statusCode = 503; return res.end(JSON.stringify({ error: "otp_not_configured", message: "التحقق غير مُفعّل بعد (OTP_SECRET غير مضبوط)." })); }

  const body = await readBody(req);
  const action = body.action;

  // 1) Start: generate + send a code, return an opaque challenge.
  if (action === "start") {
    const email = String(body.email || "").trim().toLowerCase();
    const channel = body.channel === "sms" ? "sms" : "email";
    if (!isEmail(email)) { res.statusCode = 400; return res.end(JSON.stringify({ error: "invalid_email" })); }
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    const challenge = seal({ email, code, channel, exp: Date.now() + TTL_MS });
    let delivery;
    if (channel === "sms") delivery = await sendSms(body.phone, code);
    else delivery = await sendEmail(email, code);
    if (!delivery.ok && !DEV_ECHO) {
      res.statusCode = 503;
      return res.end(JSON.stringify({ error: delivery.error, message: "تعذّر إرسال الرمز الآن. تأكد من إعداد البريد أو تواصل عبر واتساب." }));
    }
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, challenge, channel, to: maskEmail(email), ...(DEV_ECHO ? { devCode: code } : {}) }));
  }

  // 2) Verify: unseal challenge, compare code + expiry.
  if (action === "verify") {
    const code = String(body.code || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    let data;
    try { data = unseal(String(body.challenge || "")); }
    catch { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_challenge" })); }
    if (Date.now() > data.exp) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "expired" })); }
    if (data.email !== email) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "email_mismatch" })); }
    const expected = String(data.code);
    const ok = code.length === expected.length && crypto.timingSafeEqual(Buffer.from(code), Buffer.from(expected));
    if (!ok) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "wrong_code" })); }
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, token: sessionToken(email), email }));
  }

  res.statusCode = 400;
  return res.end(JSON.stringify({ error: "unknown_action" }));
}
