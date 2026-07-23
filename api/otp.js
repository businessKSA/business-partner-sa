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

// ---- Client Operations Center: real server-side sessions (Supabase) --------
// When SUPABASE_URL + SUPABASE_SERVICE_KEY are set (db/schema.sql applied),
// a successful OTP verify upserts the user, ensures an organization, creates
// a user_sessions row and sets an httpOnly cookie. Without them, verify
// degrades to the legacy stateless behavior (db:false in the response).
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const DB_ON = !!(SUPABASE_URL && SUPABASE_KEY);
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const COOKIE = "bp_sid";

async function sb(path, { method = "GET", body, prefer } = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "content-type": "application/json",
      Prefer: prefer || (method === "GET" ? "" : "return=representation"),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch {}
  if (!r.ok) { console.error("supabase error", method, path, r.status, text.slice(0, 300)); throw new Error("db_failed"); }
  return data;
}
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
function readCookie(req, name) {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return "";
}
function setSessionCookie(res, raw, maxAgeS) {
  res.setHeader("Set-Cookie", `${COOKIE}=${raw}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeS}`);
}

// Upsert user + ensure org membership + mint a session. Returns cookie payload.
async function createSession(req, { email, name, company }) {
  const users = await sb(`users?on_conflict=email`, {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: [{ email, email_verified_at: new Date().toISOString(), ...(name ? { full_name: name } : {}) }],
  });
  const user = users[0];
  let orgId = null;
  const membership = await sb(`organization_members?user_id=eq.${user.id}&status=eq.active&select=organization_id&limit=1`);
  if (membership.length) {
    orgId = membership[0].organization_id;
  } else {
    const orgs = await sb(`organizations`, {
      method: "POST",
      body: [{ name_ar: company || name || email.split("@")[0] }],
    });
    orgId = orgs[0].id;
    await sb(`organization_members`, {
      method: "POST", prefer: "return=minimal",
      body: [{ organization_id: orgId, user_id: user.id, role_id: "owner", status: "active" }],
    });
  }
  const raw = crypto.randomBytes(32).toString("base64url");
  await sb(`user_sessions`, {
    method: "POST", prefer: "return=minimal",
    body: [{
      user_id: user.id,
      token_hash: sha256(raw),
      organization_id: orgId,
      ip: String(req.headers["x-forwarded-for"] || "").split(",")[0] || null,
      user_agent: String(req.headers["user-agent"] || "").slice(0, 250),
      expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    }],
  });
  return { raw, user, orgId };
}

async function getSession(req) {
  const raw = readCookie(req, COOKIE);
  if (!raw || !DB_ON) return null;
  const rows = await sb(
    `user_sessions?token_hash=eq.${sha256(raw)}&revoked_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}` +
    `&select=id,organization_id,expires_at,users(id,email,full_name,locale)&limit=1`
  );
  if (!rows.length) return null;
  const s = rows[0];
  let org = null;
  if (s.organization_id) {
    const orgs = await sb(`organizations?id=eq.${s.organization_id}&select=id,name_ar,name_en,cr_number,profile_completeness&limit=1`);
    org = orgs[0] || null;
  }
  return { sessionId: s.id, user: s.users, organization: org, expiresAt: s.expires_at };
}

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
    // dbConfigured = env vars present; dbReachable = a live probe against the
    // sessions table (surfaces schema-not-applied and bad-key cases early).
    // dbError carries a safe hint (HTTP status + error code only, no secrets)
    // so setup mistakes (wrong URL / wrong key / missing schema) are
    // diagnosable remotely.
    let dbReachable = null, dbError = null;
    if (DB_ON) {
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/user_sessions?select=id&limit=1`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        });
        if (r.ok) dbReachable = true;
        else {
          dbReachable = false;
          const t = await r.text();
          let code = ""; try { code = (JSON.parse(t).code || JSON.parse(t).message || "").slice(0, 60); } catch { code = t.slice(0, 60); }
          dbError = `http_${r.status}${code ? ":" + code : ""}`;
        }
      } catch (e) {
        dbReachable = false;
        dbError = "fetch_failed:" + String(e && e.cause && e.cause.code || e.message || e).slice(0, 60);
      }
    }
    return res.end(JSON.stringify({
      status: "ok",
      secretConfigured: !!SECRET,
      emailConfigured: !!RESEND_API_KEY,
      smsConfigured: false,
      devEcho: DEV_ECHO,
      dbConfigured: DB_ON,
      dbReachable,
      dbError,
    }));
  }
  if (req.method !== "POST") { res.statusCode = 405; return res.end(JSON.stringify({ error: "method_not_allowed" })); }
  if (!SECRET) { res.statusCode = 503; return res.end(JSON.stringify({ error: "otp_not_configured", message: "التحقق غير مُفعّل بعد (OTP_SECRET غير مضبوط)." })); }

  const body = await readBody(req);
  const action = body.action;

  // Who am I — resolves the httpOnly session cookie server-side.
  if (action === "me") {
    try {
      const sess = await getSession(req);
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, db: DB_ON, session: sess }));
    } catch {
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "db_failed" }));
    }
  }

  // Logout — revoke the session row and clear the cookie.
  if (action === "logout") {
    try {
      const raw = readCookie(req, COOKIE);
      if (raw && DB_ON) {
        await sb(`user_sessions?token_hash=eq.${sha256(raw)}`, {
          method: "PATCH", prefer: "return=minimal",
          body: { revoked_at: new Date().toISOString() },
        });
      }
    } catch {}
    setSessionCookie(res, "", 0);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true }));
  }

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
    // OTP passed — mint a real server session when the operational DB is
    // configured; otherwise keep the legacy stateless token so nothing breaks.
    if (DB_ON) {
      try {
        const { raw, user, orgId } = await createSession(req, {
          email,
          name: String(body.name || "").slice(0, 120),
          company: String(body.company || "").slice(0, 160),
        });
        setSessionCookie(res, raw, Math.floor(SESSION_TTL_MS / 1000));
        res.statusCode = 200;
        return res.end(JSON.stringify({
          ok: true, db: true, email,
          user: { id: user.id, email: user.email, name: user.full_name || "" },
          organizationId: orgId,
        }));
      } catch {
        // DB hiccup must not lock clients out of the legacy flow.
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, db: false, token: sessionToken(email), email }));
      }
    }
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, db: false, token: sessionToken(email), email }));
  }

  res.statusCode = 400;
  return res.end(JSON.stringify({ error: "unknown_action" }));
}
