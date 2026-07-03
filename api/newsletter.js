// Business Partner 3.0 — newsletter signup → Notion (ESM).
// Captures an email (optionally a name) for the weekly newsletter. Stores a row
// in NOTION_NEWSLETTER_DB if set, otherwise a child page under
// NOTION_NEWSLETTER_PARENT (defaults to the "Business Partner 2.0" page which is
// already shared with the site integration) so it works with zero setup.
//
// Env vars:
//   NOTION_TOKEN / BusinessPartnerSiteNotion / …  Notion integration secret
//   NOTION_NEWSLETTER_DB       optional database id to store rows in
//   NOTION_NEWSLETTER_PARENT   optional parent page id (default: Business Partner 2.0)
//
// GET  /api/newsletter  -> { status, configured }
// POST /api/newsletter  -> { ok } | { ok:false, error }

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
const DB_ID = process.env.NOTION_NEWSLETTER_DB || "";
const PARENT_PAGE = process.env.NOTION_NEWSLETTER_PARENT || "23cd108dee5c821bb7e781285c4b4323";
const NOTION_VERSION = "2022-06-28";

const clip = (s, n = 200) => String(s || "").trim().slice(0, n);
const isEmail = (e) => typeof e === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

// Confirmation email (Resend) — activates once RESEND_API_KEY is set.
const RESEND_API_KEY = envFrom(["RESEND_API_KEY", "RESEND_KEY", "RESEND"]);
const FROM = process.env.OTP_FROM_EMAIL || "Business Partner <onboarding@resend.dev>";
async function sendMail(to, subject, html) {
  if (!RESEND_API_KEY || !isEmail(to)) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
  } catch {}
}

async function readBody(req) {
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  if (body && typeof body === "object") return body;
  return await new Promise((resolve) => {
    let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
  });
}

async function notion(payload) {
  return fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": NOTION_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
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
  const email = clip(b.email, 160).toLowerCase();
  const name = clip(b.name, 120);
  const source = clip(b.source, 60) || "website";

  if (!isEmail(email)) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: "invalid_email" }));
  }

  // Not connected yet — accept gracefully so the visitor still gets a success.
  if (!NOTION_TOKEN) return res.end(JSON.stringify({ ok: true, stored: false }));

  try {
    let r;
    if (DB_ID) {
      const props = {
        "البريد": { title: [{ text: { content: email } }] },
        "المصدر": { rich_text: [{ text: { content: source } }] },
        "الحالة": { select: { name: "مشترك" } },
      };
      if (name) props["الاسم"] = { rich_text: [{ text: { content: name } }] };
      r = await notion({ parent: { database_id: DB_ID }, properties: props });
    } else {
      r = await notion({
        parent: { page_id: PARENT_PAGE },
        icon: { type: "emoji", emoji: "📧" },
        properties: { title: [{ text: { content: `اشتراك نشرة — ${email}` } }] },
        children: [{
          object: "block", type: "bulleted_list_item",
          bulleted_list_item: { rich_text: [{ type: "text", text: { content: `${email}${name ? " — " + name : ""} · ${source}` } }] },
        }],
      });
    }
    if (!r.ok) {
      console.error("Notion newsletter error", r.status, (await r.text()).slice(0, 300));
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "notion_error" }));
    }
    await sendMail(email, "تم اشتراكك في نشرة Business Partner ✅", `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#111">
      <h2 style="color:#0B1B5A">تم اشتراكك بنجاح 🎉</h2>
      <p>${name ? "مرحباً " + name + "،<br>" : ""}شكراً لاشتراكك في نشرة <strong>Business Partner</strong>. راح توصلك آخر الأخبار والأدلة وتحديثات المنصات الحكومية في السعودية.</p>
      <p style="color:#666">إذا ما طلبت هذا الاشتراك، تجاهل الرسالة.</p>
    </div>`);
    return res.end(JSON.stringify({ ok: true, stored: true }));
  } catch (e) {
    console.error("newsletter handler error", String(e).slice(0, 200));
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "server_error" }));
  }
}
