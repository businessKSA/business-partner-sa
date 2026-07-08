// Business Partner 3.0 — Shared Services subscription + activation (ESM).
//
// Flow (manual owner approval + emailed access code):
//   1) subscribe: client registers/orders -> we log to Notion (Pending),
//      email the client (received + bank transfer details), and email the
//      OWNER an approval link. Payment is bank transfer for now.
//   2) approve: OWNER clicks the emailed link -> we email the client their
//      access code and mark the order Approved. Only the owner's inbox holds
//      the link, so approval is owner-gated.
//   3) unlock: client enters the access code -> verified statelessly -> the
//      service (team chat) opens on /shared-services.
//
// Access code is deterministic per email: HMAC(OTP_SECRET, email) -> no DB
// needed to verify. It is only ever EMAILED after the owner approves.
//
// Env: OTP_SECRET (required for codes), RESEND_API_KEY + OTP_FROM_EMAIL (email),
//      NOTION_TOKEN (CRM), NOTION_SHARED_DB (optional) / NOTION_SHARED_PARENT,
//      BP_OWNER_EMAIL (approver; default dr.baher.magnas@gmail.com),
//      SITE_BASE (default https://businesspartner.sa).
import crypto from "node:crypto";

const envFrom = (names) => { for (const n of names) { const v = process.env[n]; if (v && String(v).trim()) return String(v).trim(); } return ""; };

const SECRET = process.env.OTP_SECRET || "";
const RESEND_API_KEY = envFrom(["RESEND_API_KEY", "RESEND_KEY", "RESEND"]);
const FROM = process.env.OTP_FROM_EMAIL || "Business Partner <onboarding@resend.dev>";
const OWNER_EMAIL = (process.env.BP_OWNER_EMAIL || "dr.baher.magnas@gmail.com").toLowerCase();
const SITE_BASE = process.env.SITE_BASE || "https://businesspartner.sa";

const NOTION_TOKEN = envFrom(["NOTION_TOKEN", "NOTION_SECRET", "NOTION_API_KEY", "NOTION_KEY", "NOTION_INTEGRATION_TOKEN", "BusinessPartnerSiteNotion", "BUSINESS_PARTNER_SITE_NOTION", "NOTION"]);
const SHARED_DB = process.env.NOTION_SHARED_DB || "";
const SHARED_PARENT = process.env.NOTION_SHARED_PARENT || "392d108dee5c81ea9e4bf01fa2bb2f45"; // AI Executive Team hub
const NOTION_VERSION = "2022-06-28";

// Bank transfer details (public — same as the checkout page).
const BANK = {
  beneficiary: process.env.BP_BANK_BENEFICIARY || "شركة بيزنس بارتنر",
  bank: process.env.BP_BANK_NAME || "مصرف الراجحي",
  iban: process.env.BP_BANK_IBAN || "SA5380000511608016228498",
};
const PLAN_LABEL = { shared: "فريق الخدمات المشتركة" };

const isEmail = (e) => typeof e === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const clip = (s, n = 300) => String(s || "").trim().slice(0, n);
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const keyFromSecret = () => crypto.createHash("sha256").update(SECRET).digest();
function seal(obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyFromSecret(), iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(obj), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64url");
}
function unseal(token) {
  const raw = Buffer.from(String(token), "base64url");
  const iv = raw.subarray(0, 12), tag = raw.subarray(12, 28), ct = raw.subarray(28);
  const d = crypto.createDecipheriv("aes-256-gcm", keyFromSecret(), iv);
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(ct), d.final()]).toString("utf8"));
}

// Deterministic, unguessable access code per email (needs the server secret).
function accessCode(email) {
  const b32 = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const h = crypto.createHmac("sha256", SECRET).update("shared|" + String(email).toLowerCase()).digest();
  let out = "";
  for (let i = 0; i < 6; i++) out += b32[h[i] % b32.length];
  return "BP-SS-" + out;
}
function makeRef(email) {
  const h = crypto.createHmac("sha256", SECRET || "x").update("ref|" + String(email).toLowerCase() + "|" + Date.now()).digest("hex");
  return "BP-SS-" + h.slice(0, 6).toUpperCase();
}

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

const rt = (v) => (v ? [{ text: { content: clip(v, 1800) } }] : []);
async function notionCreate(props, childText) {
  if (!NOTION_TOKEN) return;
  const parent = SHARED_DB ? { database_id: SHARED_DB } : { page_id: SHARED_PARENT };
  // When writing to a plain page (no DB), only "title" is valid; fold details into children.
  const payload = SHARED_DB
    ? { parent, properties: props }
    : { parent, properties: { title: [{ text: { content: clip(props.__title, 200) } }] },
        children: [{ object: "block", type: "paragraph", paragraph: { rich_text: rt(childText) } }] };
  try {
    const r = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) console.error("notion shared error", r.status, (await r.text()).slice(0, 300));
  } catch (e) { console.error("notion shared exception", String(e).slice(0, 150)); }
}

async function readBody(req) {
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  if (body && typeof body === "object") return body;
  return await new Promise((resolve) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } }); });
}

function ownerEmailHtml({ name, email, phone, plan, ref, approveUrl }) {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
    <h2 style="color:#0B1B5A">طلب اشتراك جديد — الخدمات المشتركة</h2>
    <p><b>المرجع:</b> ${esc(ref)}</p>
    <ul>
      <li><b>الاسم:</b> ${esc(name)}</li>
      <li><b>البريد:</b> ${esc(email)}</li>
      <li><b>الجوال:</b> ${esc(phone || "—")}</li>
      <li><b>الباقة:</b> ${esc(PLAN_LABEL[plan] || plan)}</li>
    </ul>
    <p>لاعتماد الطلب وإرسال كود الوصول للعميل، اضغط:</p>
    <p><a href="${approveUrl}" style="background:#0B1B5A;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold">✅ اعتماد وإرسال الكود</a></p>
    <p style="color:#666;font-size:13px">لا تعتمد إلا بعد تأكيد وصول التحويل البنكي. هذا الرابط سرّي — لا تُعِد توجيهه.</p>
  </div>`;
}
function clientReceivedHtml({ name, ref }) {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;text-align:right" dir="rtl">
    <h2 style="color:#0B1B5A">استلمنا طلبك — الخدمات المشتركة</h2>
    <p>أهلاً ${esc(name || "")}، استلمنا طلب اشتراكك في <b>فريق الخدمات المشتركة</b>.</p>
    <p><b>رقم طلبك:</b> ${esc(ref)}</p>
    <p><b>لإتمام الطلب، حوّل قيمة الاشتراك إلى:</b></p>
    <ul>
      <li><b>المستفيد:</b> ${esc(BANK.beneficiary)}</li>
      <li><b>البنك:</b> ${esc(BANK.bank)}</li>
      <li><b>الآيبان:</b> ${esc(BANK.iban)}</li>
    </ul>
    <p>بعد تأكيد التحويل واعتماد الطلب، يصلك <b>كود وصول</b> على هذا البريد تدخله في صفحة الخدمة ليفتح فريقك التنفيذي مباشرة.</p>
    <p style="color:#666;font-size:13px">لن نطلب منك كلمة مرور أو رمز تحقق. أي إجراء ملزم يتم بعد موافقتك.</p>
  </div>`;
}
function clientCodeHtml({ name, code }) {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;text-align:right" dir="rtl">
    <h2 style="color:#0B1B5A">تم تفعيل خدمتك 🎉</h2>
    <p>أهلاً ${esc(name || "")}، تم اعتماد اشتراكك في <b>فريق الخدمات المشتركة</b>.</p>
    <p><b>كود الوصول الخاص بك:</b></p>
    <p style="font-size:26px;font-weight:bold;letter-spacing:4px;color:#0B1B5A">${esc(code)}</p>
    <p>افتح صفحة الخدمة، أدخل بريدك والكود، ويبدأ فريقك التنفيذي بالعمل معك مباشرة:</p>
    <p><a href="${SITE_BASE}/shared-services" style="background:#12b3ad;color:#04211f;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold">افتح الخدمة</a></p>
  </div>`;
}

export default async function handler(req, res) {
  const html = (code, s) => { res.statusCode = code; res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(s); };
  const json = (code, o) => { res.statusCode = code; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(o)); };

  const action = (req.method === "GET" ? (req.query && req.query.action) : null) || (await (async () => { req._b = await readBody(req); return req._b.action; })().catch(() => null));

  if (req.method === "GET" && !action) {
    return json(200, { status: "ok", secretConfigured: !!SECRET, emailConfigured: !!RESEND_API_KEY, notionConfigured: !!NOTION_TOKEN, owner: OWNER_EMAIL });
  }
  if (!SECRET) return json(503, { ok: false, error: "not_configured", message: "الخدمة غير مُفعّلة بعد (OTP_SECRET غير مضبوط)." });

  // --- approve: owner clicks the emailed link (GET) ---
  if (action === "approve") {
    const t = (req.query && req.query.t) || (req._b && req._b.t) || "";
    let data;
    try { data = unseal(t); } catch { return html(400, "<h3>رابط اعتماد غير صالح.</h3>"); }
    const code = accessCode(data.email);
    await sendMail(data.email, `كود الوصول — الخدمات المشتركة (${code})`, clientCodeHtml({ name: data.name, code }));
    await notionCreate({ __title: `تفعيل — ${data.name || data.email} — ${data.ref}` }, `الحالة: معتمد ومفعّل · البريد: ${data.email} · الجوال: ${data.phone || "—"} · الباقة: ${PLAN_LABEL[data.plan] || data.plan} · المرجع: ${data.ref}`);
    return html(200, `<!doctype html><meta charset="utf-8"><div style="font-family:Arial;max-width:520px;margin:60px auto;text-align:center" dir="rtl"><h2 style="color:#0B1B5A">✅ تم الاعتماد</h2><p>أُرسل كود الوصول إلى <b>${esc(data.email)}</b>. سيفتح العميل الخدمة بإدخال الكود.</p></div>`);
  }

  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });
  const body = req._b || (await readBody(req));

  // --- subscribe: client places the order ---
  if (action === "subscribe") {
    const name = clip(body.name, 120);
    const email = String(body.email || "").trim().toLowerCase();
    const phone = clip(body.phone, 40);
    const plan = body.plan === "shared" || !body.plan ? "shared" : clip(body.plan, 40);
    if (!isEmail(email)) return json(400, { ok: false, error: "invalid_email", message: "أدخل بريداً صحيحاً." });
    const ref = makeRef(email);
    const approveUrl = `${SITE_BASE}/api/shared?action=approve&t=${encodeURIComponent(seal({ email, name, phone, plan, ref }))}`;
    await notionCreate(
      { __title: `طلب — ${name || email} — ${ref}` },
      `الحالة: بانتظار الموافقة · البريد: ${email} · الجوال: ${phone || "—"} · الباقة: ${PLAN_LABEL[plan] || plan} · المرجع: ${ref} · القناة: تحويل بنكي`
    );
    await sendMail(email, `استلمنا طلبك — الخدمات المشتركة (${ref})`, clientReceivedHtml({ name, ref }));
    await sendMail(OWNER_EMAIL, `طلب اشتراك جديد — ${name || email} (${ref})`, ownerEmailHtml({ name, email, phone, plan, ref, approveUrl }));
    return json(200, { ok: true, ref, bank: BANK, message: "استلمنا طلبك. حوّل قيمة الاشتراك ثم ننتظر اعتماد الفريق، ويصلك كود الوصول على بريدك." });
  }

  // --- unlock: client enters the emailed access code ---
  if (action === "unlock") {
    const email = String(body.email || "").trim().toLowerCase();
    const code = String(body.code || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!isEmail(email)) return json(400, { ok: false, error: "invalid_email" });
    const expected = accessCode(email);
    const a = Buffer.from(code), b = Buffer.from(expected);
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!ok) return json(200, { ok: false, error: "bad_code", message: "الكود غير صحيح لهذا البريد. تأكد أنك تستخدم نفس البريد الذي اشتركت به." });
    const token = seal({ email, plan: "shared", t: Date.now() });
    return json(200, { ok: true, token, message: "تم التفعيل — أهلاً بك في فريقك التنفيذي." });
  }

  return json(400, { ok: false, error: "unknown_action" });
}
