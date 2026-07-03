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
const DB_ID = process.env.NOTION_EMPLOYERS_DB || "";
const PARENT_PAGE = process.env.NOTION_EMPLOYERS_PARENT || "697adb5a6a734b449f86952203c4faf9";
const NOTION_VERSION = "2022-06-28";

const clip = (s, n = 300) => String(s || "").trim().slice(0, n);
const isEmail = (e) => typeof e === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const PLAN_AR = { basic: "أساسية", pro: "احترافية", enterprise: "مؤسسية" };

async function readBody(req) {
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  if (body && typeof body === "object") return body;
  return await new Promise((resolve) => {
    let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
  });
}

// A short human reference like BP-EMP-3F9K
function makeRef(seed) {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  let out = "";
  for (let i = 0; i < 4; i++) { out += abc[h % abc.length]; h = Math.floor(h / abc.length) + seed.length * (i + 7); }
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
  const planAr = PLAN_AR[planKey] || "";
  const notes = clip(b.notes, 600);

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
        "الحالة": { select: { name: "بانتظار الدفع" } },
        "رمز الوصول": { rich_text: rt(ref) },
      };
      if (cr) props["السجل التجاري"] = { rich_text: rt(cr) };
      if (contact) props["جهة الاتصال"] = { rich_text: rt(contact) };
      if (isEmail(email)) props["البريد"] = { email };
      if (planAr) props["الباقة"] = { select: { name: planAr } };
      if (notes) props["ملاحظات"] = { rich_text: rt(notes) };
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
    return res.end(JSON.stringify({ ok: true, ref, stored: true }));
  } catch (e) {
    console.error("employer handler error", String(e).slice(0, 200));
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "server_error", ref }));
  }
}
