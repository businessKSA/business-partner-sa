// Business Partner 3.0 — workspace demand intake → Notion matching board (ESM).
// Writes a client "Demand - Client Request" record into the unified
// "Real Estate Demand & Supply Board" so the matchmaking engine can match it
// against available supply.
//
// Env vars:
//   NOTION_TOKEN / BusinessPartnerSiteNotion / …   Notion integration secret
//   NOTION_BOARD_DB   optional override of the demand/supply board id
//
// GET  /api/workspace  -> { status, configured }
// POST /api/workspace  -> { ok, ref } | { ok:false, error }

const envFrom = (names) => {
  for (const n of names) { const v = process.env[n]; if (v && String(v).trim()) return String(v).trim(); }
  return "";
};
const NOTION_TOKEN = envFrom([
  "NOTION_TOKEN", "NOTION_SECRET", "NOTION_API_KEY", "NOTION_KEY",
  "NOTION_INTEGRATION_TOKEN", "BusinessPartnerSiteNotion", "BUSINESS_PARTNER_SITE_NOTION", "NOTION",
]);
const DB_ID = process.env.NOTION_BOARD_DB || "f416606b4fab4cbb80ced171f75e0a3b";
const NOTION_VERSION = "2022-06-28";

const CITIES = ["Riyadh", "Jeddah", "Dammam", "Khobar", "Makkah", "Madinah", "Other"];
const CATEGORIES = ["Residential", "Commercial", "Office", "Co-working Space", "Retail", "Showroom", "Industrial", "Land", "Labor Camp", "Compound", "Mixed-use", "Hospitality", "Other"];

const clip = (s, n = 300) => String(s || "").trim().slice(0, n);
const isEmail = (e) => typeof e === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const numOr = (v) => { const n = parseFloat(String(v).replace(/[^\d.]/g, "")); return isFinite(n) && n > 0 ? n : null; };

async function readBody(req) {
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  if (body && typeof body === "object") return body;
  return await new Promise((resolve) => {
    let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
  });
}

function makeRef(seed) {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  let out = ""; for (let i = 0; i < 4; i++) { out += abc[h % abc.length]; h = Math.floor(h / abc.length) + seed.length * (i + 5); }
  return "BP-WS-" + out;
}
const rt = (v) => (v ? [{ text: { content: clip(v, 1800) } }] : []);

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "GET") {
    const seenKeyNames = Object.keys(process.env).filter((k) => /notion/i.test(k));
    return res.end(JSON.stringify({ status: "ok", configured: !!NOTION_TOKEN, seenKeyNames }));
  }
  if (req.method !== "POST") { res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: "method_not_allowed" })); }

  const b = await readBody(req);
  const contact = clip(b.contact, 160);
  const phone = clip(b.phone, 40);
  const email = clip(b.email, 160).toLowerCase();
  const city = CITIES.includes(b.city) ? b.city : "";
  const category = CATEGORIES.includes(b.category) ? b.category : "";
  const district = clip(b.district, 160);
  const size = numOr(b.size);
  const seats = numOr(b.seats);
  const budget = numOr(b.budget);
  const purpose = b.purpose === "buy" ? "شراء" : "إيجار";
  const notes = clip(b.notes, 800);

  if (!phone || (!city && !district)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }

  const ref = makeRef(contact + phone + (city || district));
  if (!NOTION_TOKEN) return res.end(JSON.stringify({ ok: true, ref, stored: false }));

  const title = `طلب مساحة — ${city || district || ""}${contact ? " — " + contact : ""} (${ref})`;
  const summary = [`نوع العملية: ${purpose}`, notes].filter(Boolean).join(" · ");
  const props = {
    "Name": { title: [{ text: { content: title } }] },
    "Record Type": { select: { name: "Demand - Client Request" } },
    "Status": { select: { name: "New" } },
    "Original Source": { rich_text: rt("Website — businesspartner.sa") },
  };
  if (city) props["City"] = { select: { name: city } };
  if (category) props["Property Category"] = { select: { name: category } };
  if (district) props["District"] = { rich_text: rt(district) };
  if (size != null) props["Size sqm"] = { number: size };
  if (seats != null) props["Seats / Capacity"] = { number: seats };
  if (budget != null) props["Budget / Price"] = { number: budget };
  if (contact) props["Contact Person"] = { rich_text: rt(contact) };
  if (phone) props["Phone"] = { phone_number: phone };
  if (isEmail(email)) props["Email"] = { email };
  if (summary) props["AI Summary"] = { rich_text: rt(summary) };

  try {
    const r = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
      body: JSON.stringify({ parent: { database_id: DB_ID }, properties: props }),
    });
    if (!r.ok) {
      console.error("Notion workspace error", r.status, (await r.text()).slice(0, 400));
      res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_error", ref }));
    }
    return res.end(JSON.stringify({ ok: true, ref, stored: true }));
  } catch (e) {
    console.error("workspace handler error", String(e).slice(0, 200));
    res.statusCode = 500; return res.end(JSON.stringify({ ok: false, error: "server_error", ref }));
  }
}
