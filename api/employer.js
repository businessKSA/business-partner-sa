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
// GET  /api/employer  -> { status, configured }
// POST /api/employer  -> { ok, ref } | { ok:false, error }

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
function makeRef(seed) {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const salted = seed + "|" + Date.now() + "|" + Math.random();
  let h = 0;
  for (let i = 0; i < salted.length; i++) h = (h * 31 + salted.charCodeAt(i)) >>> 0;
  let out = "";
  for (let i = 0; i < 4; i++) { out += abc[h % abc.length]; h = Math.floor(h / abc.length) + salted.length * (i + 7); }
  return "BP-EMP-" + out;
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

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "GET") {
    const seenKeyNames = Object.keys(process.env).filter((k) => /notion/i.test(k));
    return res.end(JSON.stringify({ status: "ok", configured: !!NOTION_TOKEN, store: DB_ID ? "database" : "page", seenKeyNames }));
  }
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: "method_not_allowed" }));
  }

  const b = await readBody(req);
  const company = clip(b.company, 200);
  const cr = clip(b.cr, 60);
  const contact = clip(b.contact, 160);
  const email = clip(b.email, 160).toLowerCase();
  const phone = clip(b.phone, 40);
  const planKey = ["basic", "pro", "enterprise"].includes(b.plan) ? b.plan : "";
  const billing = b.billing === "yearly" ? "سنوي" : "شهري";
  const notes = clip(b.notes, 600);

  // Owner testing override — the owner's own registrations activate instantly
  // (top-tier plan, no manual Notion approval) so they can test live.
  const OWNER_EMAIL = (process.env.OWNER_EMAIL || "dr.baher.magnas@gmail.com").toLowerCase();
  const isOwner = email === OWNER_EMAIL;
  const planAr = isOwner ? PLAN_AR.enterprise : (PLAN_AR[planKey] || "");

  if (!company || !phone) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: "invalid_fields" }));
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
        "الحالة": { select: { name: isOwner ? "مفعّل" : "بانتظار الدفع" } },
        "رمز الوصول": { rich_text: rt(ref) },
      };
      if (cr) props["السجل التجاري"] = { rich_text: rt(cr) };
      if (contact) props["جهة الاتصال"] = { rich_text: rt(contact) };
      if (isEmail(email)) props["البريد"] = { email };
      if (planAr) props["الباقة"] = { select: { name: planAr } };
      props["ملاحظات"] = { rich_text: rt((notes ? notes + " — " : "") + `الفوترة: ${billing}` + (isOwner ? " — تفعيل تلقائي (مالك)" : "")) };
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
        line("الحالة", isOwner ? "مفعّل" : "بانتظار الدفع"),
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
