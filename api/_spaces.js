// Business Partner 3.0 — public office/workspace gallery (read supply from Notion, ESM).
// Returns a SANITIZED list of AVAILABLE workspaces from "Property Workspace Supply".
// Vendor identity, contacts and raw price are hidden (BP is the intermediary and
// keeps its margin) — the public sees the space; enquiries route through BP.
//
// Env vars:
//   NOTION_TOKEN / BusinessPartnerSiteNotion / …   Notion integration secret
//   NOTION_SUPPLY_DB   optional override of the supply database id
//
// GET /api/spaces?city=&type=&q=   -> { ok, total, spaces:[...] }

const envFrom = (names) => {
  for (const n of names) { const v = process.env[n]; if (v && String(v).trim()) return String(v).trim(); }
  return "";
};
const NOTION_TOKEN = envFrom([
  "NOTION_TOKEN", "NOTION_SECRET", "NOTION_API_KEY", "NOTION_KEY",
  "NOTION_INTEGRATION_TOKEN", "BusinessPartnerSiteNotion", "BUSINESS_PARTNER_SITE_NOTION", "NOTION",
]);
const DB_ID = process.env.NOTION_SUPPLY_DB || "644ac54670e44fdb8f03904fe9eed362";
const NOTION_VERSION = "2022-06-28";

const plain = (p) => {
  if (!p) return "";
  if (p.type === "title" || p.type === "rich_text") return (p[p.type] || []).map((x) => x.plain_text).join("").trim();
  if (p.type === "select") return p.select ? p.select.name : "";
  if (p.type === "number") return p.number;
  if (p.type === "checkbox") return !!p.checkbox;
  if (p.type === "url") return p.url || "";
  return "";
};

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (!NOTION_TOKEN) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "not_configured" })); }

  const url = new URL(req.url, "http://x");
  const fCity = (url.searchParams.get("city") || "").trim();
  const fType = (url.searchParams.get("type") || "").trim();
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();

  try {
    const body = { page_size: 100, filter: { property: "Status", select: { equals: "Available" } } };
    const r = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      console.error("Notion spaces error", r.status, (await r.text()).slice(0, 300));
      res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_error" }));
    }
    const data = await r.json();
    let spaces = (data.results || []).map((pg) => {
      const p = pg.properties || {};
      return {
        name: plain(p["Listing Name"]),
        city: plain(p["City"]),
        district: plain(p["District"]),
        type: plain(p["Property Type"]) || plain(p["Supply Category"]),
        area: plain(p["Area sqm"]) || null,
        seats: plain(p["Seats Capacity"]) || null,
        furnished: plain(p["Furnished"]),
        parking: plain(p["Parking"]),
        nationalAddress: plain(p["National Address Available"]),
        licenseSupport: plain(p["License Support"]),
        description: plain(p["Description"]).slice(0, 300),
        suitableFor: plain(p["Suitable For"]),
        photo: plain(p["Photos URL"]) || "",
        // Deliberately omitted (business margin): Vendor Name, Contact Person, Phone, Email, exact price.
      };
    });
    // Only publish listings that actually have a name (skip empty/legacy rows).
    spaces = spaces.filter((s) => s.name);
    if (fCity) spaces = spaces.filter((s) => s.city === fCity);
    if (fType) spaces = spaces.filter((s) => (s.type || "").toLowerCase().indexOf(fType.toLowerCase()) !== -1);
    if (q) spaces = spaces.filter((s) => (s.name + " " + s.district + " " + s.suitableFor + " " + s.description).toLowerCase().indexOf(q) !== -1);

    return res.end(JSON.stringify({ ok: true, total: spaces.length, spaces }));
  } catch (e) {
    console.error("spaces handler error", String(e).slice(0, 200));
    res.statusCode = 500; return res.end(JSON.stringify({ ok: false, error: "server_error" }));
  }
}
