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
import { verifyGoogleIdToken } from "./_suppliers.js";
import { nafathRequest, nafathStatus, nationalIdState, nafathPing, nafathIdHash, nafathSeal, nafathUnseal, isOwnerId, mintOwnerTicket } from "./_nafath.js";

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
// Shared DB helpers live in api/_db.js (not a deployed function).
import { SUPABASE_URL, SUPABASE_KEY, DB_ON, sb, sha256, readCookie, getSession as dbGetSession, SESSION_COOKIE as COOKIE } from "./_db.js";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
// The session must be the same on businesspartner.sa and www.businesspartner.sa:
// a host-only cookie left a client signed in on one and locked out on the
// other. Scoped to the apex on production hosts; preview hosts stay host-only.
function cookieDomain(res) {
  const host = String((res && res.__bpHost) || "").toLowerCase().split(":")[0];
  return /(^|\.)businesspartner\.sa$/.test(host) ? "; Domain=.businesspartner.sa" : "";
}
function setSessionCookie(res, raw, maxAgeS) {
  res.setHeader("Set-Cookie", `${COOKIE}=${raw}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeS}${cookieDomain(res)}`);
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

const getSession = dbGetSession;

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
  res.__bpHost = req.headers["x-forwarded-host"] || req.headers.host || "";
  if (req.method === "GET") {
    res.statusCode = 200;
    // dbConfigured = env vars present; dbReachable = a live probe against the
    // sessions table (surfaces schema-not-applied and bad-key cases early).
    // dbError carries a safe hint (HTTP status + error code only, no secrets)
    // so setup mistakes (wrong URL / wrong key / missing schema) are
    // diagnosable remotely.
    let dbReachable = null, dbError = null, usersCount = null;
    if (DB_ON) {
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/user_sessions?select=id&limit=1`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        });
        if (r.ok) {
          dbReachable = true;
          // Non-sensitive aggregate so first-login writes are verifiable
          // remotely (a count, never row data).
          try {
            const c = await fetch(`${SUPABASE_URL}/rest/v1/users?select=id`, {
              headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: "count=exact", Range: "0-0" },
            });
            const cr = c.headers.get("content-range") || "";
            const total = parseInt(cr.split("/")[1], 10);
            if (!Number.isNaN(total)) usersCount = total;
          } catch {}
        }
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
      usersCount,
      // Non-sensitive booleans so the owner can verify /admin gating without
      // exposing any value: is a panel key set, and did it need trimming?
      // Nafath: whether the login screens should offer it at all, and whether
      // the owner's panels are set to demand it.
      nafath: nafathPing(),
      panelRequiresNafath: /^(1|true|yes)$/i.test(String(process.env.PANEL_REQUIRE_NAFATH || "")),
      panelKeyConfigured: !!(process.env.PANEL_KEY || "").trim(),
      panelKeyHadWhitespace: (process.env.PANEL_KEY || "") !== (process.env.PANEL_KEY || "").trim(),
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
  // Google sign-in reaches the same place the emailed code does: Google has
  // already verified the address, so a checked ID token stands in for the
  // round trip and mints exactly the same session. Nothing downstream can tell
  // the two apart, which is the point — one account, two ways in.
  if (action === "google") {
    let g = null;
    try { g = await verifyGoogleIdToken(String(body.credential || "")); }
    catch (e) { console.error("otp google verify", String(e.message || e).slice(0, 160)); }
    if (!g || !g.email) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "bad_token" })); }
    const email = String(g.email).trim().toLowerCase();
    if (DB_ON) {
      try {
        const { raw, user, orgId } = await createSession(req, {
          email,
          name: String(g.name || body.name || "").slice(0, 120),
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
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, db: false, token: sessionToken(email), email }));
      }
    }
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, db: false, token: sessionToken(email), email }));
  }

  /* ---------------- Nafath: prove who you are, not what you know -----------
   * Two purposes share one mechanism.
   *
   *   purpose "panel"  — the owner's own screens. Success is checked against
   *                      OWNER_NATIONAL_IDS and answers with a sealed ticket.
   *                      No account, no cookie: it is a door, not a login.
   *   purpose "portal" — a client signing in. Nafath does not return an email
   *                      and our accounts are keyed by one, so the first
   *                      verification binds the identity to an account; every
   *                      one after that is enough on its own.
   *
   * The national id never travels back to the browser. It goes out once, and
   * what the browser holds afterwards is a sealed blob it cannot read.
   */

  // Nafath pushes a notification to a real person's phone. Anyone could
  // therefore use this endpoint to pester an id they do not own, so the same
  // id cannot be started twice in a minute and one address cannot start many.
  // This counter lives in the lambda instance: it blunts a casual flood, and
  // does nothing against a distributed one — Elm's own limits are the backstop.
  const nafathSeen = (globalThis.__bpNafathSeen ||= new Map());
  function nafathThrottle(key, windowMs, max) {
    const now = Date.now();
    for (const [k, v] of nafathSeen) if (now - v.at > 10 * 60 * 1000) nafathSeen.delete(k);
    const hit = nafathSeen.get(key);
    if (!hit || now - hit.at > windowMs) { nafathSeen.set(key, { at: now, n: 1 }); return true; }
    hit.n += 1;
    return hit.n <= max;
  }

  if (action === "nafath-start") {
    const id = nationalIdState(body.nationalId);
    if (!id.ok) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: id.reason, message:
        id.reason === "must_be_10_digits" ? "رقم الهوية أو الإقامة عشرة أرقام."
        : id.reason === "unsupported_prefix_9" ? "هذا الرقم لا تدعمه خدمة نفاذ للتحقق."
        : "رقم الهوية غير صحيح." }));
    }
    const purpose = body.purpose === "panel" ? "panel" : "portal";
    const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "?";
    if (!nafathThrottle("id:" + id.value, 60 * 1000, 1) || !nafathThrottle("ip:" + ip, 10 * 60 * 1000, 5)) {
      res.statusCode = 429;
      return res.end(JSON.stringify({ ok: false, error: "too_many", message: "محاولات كثيرة. انتظر دقيقة ثم أعد المحاولة." }));
    }
    // An id that could never open the panel should not ring anyone's phone.
    if (purpose === "panel" && !isOwnerId(id.value)) {
      res.statusCode = 403;
      return res.end(JSON.stringify({ ok: false, error: "not_owner", message: "هذه الهوية غير مصرّح لها بفتح هذه اللوحة." }));
    }
    let started;
    try {
      started = await nafathRequest({ nationalId: id.value, locale: body.locale === "en" ? "en" : "ar" });
    } catch (e) {
      const why = String(e.message || e);
      console.error("nafath start", why, String(e.detail || "").slice(0, 200));
      res.statusCode = why === "nafath_not_configured" || why === "nafath_service_not_configured" ? 503 : 502;
      return res.end(JSON.stringify({ ok: false, error: why, message:
        why === "nafath_not_configured" || why === "nafath_service_not_configured" ? "الدخول عبر نفاذ غير مُفعّل بعد."
        : why === "nafath_unauthorized" ? "بيانات الاتصال بنفاذ مرفوضة."
        : "تعذّر الوصول إلى نفاذ الآن." }));
    }
    if (!started.transId) {
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "no_transaction", message: "لم تُنشئ نفاذ طلباً. حاول مرة أخرى." }));
    }
    res.statusCode = 200;
    return res.end(JSON.stringify({
      ok: true,
      // The number the user must pick inside the Nafath app. Showing it is the
      // whole anti-phishing device: a fake site cannot know the number the
      // real request produced.
      random: started.random,
      challenge: nafathSeal({
        t: "pending", nid: id.value, transId: started.transId, random: started.random,
        purpose, exp: Date.now() + 10 * 60 * 1000,
      }),
    }));
  }

  if (action === "nafath-poll") {
    const p = nafathUnseal(String(body.challenge || ""));
    if (!p || p.t !== "pending") {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: "expired_challenge", message: "انتهت مهلة الطلب. ابدأ من جديد." }));
    }
    let st;
    try { st = await nafathStatus({ nationalId: p.nid, transId: p.transId, random: p.random }); }
    catch (e) {
      console.error("nafath poll", String(e.message || e), String(e.detail || "").slice(0, 200));
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "status_failed", message: "تعذّر قراءة حالة الطلب." }));
    }
    if (st.status === "WAITING") { res.statusCode = 200; return res.end(JSON.stringify({ ok: true, status: "WAITING" })); }
    if (st.status !== "COMPLETED") {
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, status: st.status, message:
        st.status === "REJECTED" ? "رُفض الطلب من تطبيق نفاذ." : "انتهت صلاحية الطلب. ابدأ من جديد." }));
    }

    // ---- verified from here on ----
    if (p.purpose === "panel") {
      const ticket = mintOwnerTicket(p.nid);
      if (!ticket) { res.statusCode = 403; return res.end(JSON.stringify({ ok: false, error: "not_owner" })); }
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, status: "COMPLETED", ticket }));
    }

    if (!DB_ON) {
      res.statusCode = 503;
      return res.end(JSON.stringify({ ok: false, error: "db_off", message: "تم التحقق، لكن قاعدة الحسابات غير مهيأة." }));
    }
    const hash = nafathIdHash(p.nid);
    try {
      // Returning by identity alone: this id has been bound to an account
      // before, so there is nothing left to ask for.
      const known = await sb(`users?nafath_id=eq.${encodeURIComponent(hash)}&select=id,email&limit=1`);
      if (known.length) {
        const { raw, user, orgId } = await createSession(req, { email: String(known[0].email) });
        setSessionCookie(res, raw, Math.floor(SESSION_TTL_MS / 1000));
        res.statusCode = 200;
        return res.end(JSON.stringify({
          ok: true, status: "COMPLETED", db: true, email: user.email, verified: true,
          user: { id: user.id, email: user.email, name: user.full_name || "" },
          organizationId: orgId,
        }));
      }

      // First time. Nafath proves WHO someone is; it says nothing about which
      // mailbox is theirs. Opening a session on an address typed at this point
      // would let anyone with a valid Nafath identity sign in as any client by
      // typing that client's e-mail — so the binding attaches to a session the
      // person already holds, and never creates one from an unproven address.
      const sess = await dbGetSession(req);
      if (!sess || !sess.user || !sess.user.id) {
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: false, status: "COMPLETED", error: "identity_not_linked",
          // The verification really did happen, so it is not thrown away: this
          // is our own sealed note that this identity passed, good for ten
          // minutes. The client signs in the ordinary way and hands it back,
          // and the binding completes without troubling Nafath again.
          link: nafathSeal({ t: "verified", hash, exp: Date.now() + 10 * 60 * 1000 }),
          message: "تم التحقق من هويتك عبر نفاذ ✓ — ادخل مرة واحدة بالبريد أو بحساب جوجل، وسنربط هويتك بحسابك تلقائياً." }));
      }
      try {
        await sb(`users?id=eq.${sess.user.id}`, { method: "PATCH", prefer: "return=minimal", body: { nafath_id: hash } });
      } catch (e) {
        // A unique index guards the column, so the likeliest cause is that
        // another account already claimed this identity between the lookup
        // above and this write. The reason is logged; the client is not told
        // which account, because that would leak one.
        console.error("nafath bind", String(e.message || e).slice(0, 160));
        res.statusCode = 409;
        return res.end(JSON.stringify({ ok: false, error: "bind_failed",
          message: "تعذّر ربط الهوية بهذا الحساب. تواصل معنا إن تكرر." }));
      }
      res.statusCode = 200;
      return res.end(JSON.stringify({
        ok: true, status: "COMPLETED", db: true, linked: true, verified: true,
        email: sess.user.email || "",
        message: "تم ربط هويتك الوطنية بحسابك ✓ — تقدر تدخل بنفاذ مباشرة بعد الآن.",
      }));
    } catch (e) {
      console.error("nafath session", String(e.message || e).slice(0, 160));
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "session_failed", message: "تم التحقق، لكن تعذّر فتح الجلسة." }));
    }
  }

  // Finish a binding that was verified before the client had a session.
  if (action === "nafath-link") {
    const v = nafathUnseal(String(body.link || ""));
    if (!v || v.t !== "verified" || !v.hash) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: "expired_proof" }));
    }
    if (!DB_ON) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "db_off" })); }
    try {
      const sess = await dbGetSession(req);
      if (!sess || !sess.user || !sess.user.id) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: "no_session" })); }
      const taken = await sb(`users?nafath_id=eq.${encodeURIComponent(v.hash)}&select=id&limit=1`);
      if (taken.length && taken[0].id !== sess.user.id) {
        res.statusCode = 409;
        return res.end(JSON.stringify({ ok: false, error: "identity_already_linked", message: "هذه الهوية مرتبطة بحساب آخر." }));
      }
      if (!taken.length) await sb(`users?id=eq.${sess.user.id}`, { method: "PATCH", prefer: "return=minimal", body: { nafath_id: v.hash } });
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, linked: true, message: "تم توثيق هويتك عبر نفاذ ✓" }));
    } catch (e) {
      console.error("nafath link", String(e.message || e).slice(0, 160));
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "link_failed" }));
    }
  }

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
