// Business Partner 3.0 — live order status lookup (ESM).
// Reads the "حالة الطلب" (order status) field for one or more reference numbers
// from the Notion "Sales Pipeline" database, so /account can show the real status
// instead of a frozen "Under review" set once at checkout. The team updates the
// status manually in Notion after confirming payment — no redeploy needed.
//
// Env vars:
//   NOTION_TOKEN     Notion integration secret (share the Sales Pipeline DB with it)
//   NOTION_CRM_DB    optional override of the Sales Pipeline database id
//
// GET /api/order-status?refs=BP-506275,BP-988015  -> { ok, statuses: { "BP-506275": "قيد المراجعة", ... } }

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
const CRM_DB = process.env.NOTION_CRM_DB || "d9a342be24774be3b4095d439d21fc90";
const NOTION_VERSION = "2022-06-28";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: "method_not_allowed" })); }

  const url = new URL(req.url, "http://x");
  const refs = (url.searchParams.get("refs") || "")
    .split(",").map((s) => s.trim()).filter(Boolean).slice(0, 30);
  if (!refs.length) return res.end(JSON.stringify({ ok: true, statuses: {} }));
  if (!NOTION_TOKEN) return res.end(JSON.stringify({ ok: true, statuses: {}, configured: false }));

  try {
    const r = await fetch(`https://api.notion.com/v1/databases/${CRM_DB}/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
      body: JSON.stringify({
        page_size: refs.length,
        filter: { or: refs.map((ref) => ({ property: "رقم المرجع", rich_text: { equals: ref } })) },
      }),
    });
    if (!r.ok) {
      console.error("order-status query error", r.status, (await r.text()).slice(0, 300));
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "notion_failed" }));
    }
    const data = await r.json();
    const statuses = {};
    for (const pg of data.results || []) {
      const p = pg.properties || {};
      const refText = (p["رقم المرجع"] && p["رقم المرجع"].rich_text || []).map((t) => t.plain_text).join("").trim();
      const status = p["حالة الطلب"] && p["حالة الطلب"].select && p["حالة الطلب"].select.name;
      if (refText && status) statuses[refText] = status;
    }
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, statuses }));
  } catch (e) {
    console.error("order-status handler error", String(e).slice(0, 200));
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "server_error" }));
  }
}
