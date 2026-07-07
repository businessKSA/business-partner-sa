// Business Partner 3.0 — employer candidate browser (read the ATS from Notion, ESM).
// Returns a SANITIZED list of candidates from the "🧑‍💼 BP Candidates — ATS" database
// for the /employers page. Contact details (name, phone, email, CV) are hidden by
// default and only revealed when a valid subscription code is supplied — so the pool
// stays a paid product while employers can still browse the anonymized talent.
//
// Env vars:
//   NOTION_TOKEN            Notion integration secret (share the ATS DB with it)
//   NOTION_ATS_DB           optional override of the ATS database id
//   EMPLOYER_CODES          comma-separated subscription codes that unlock contacts
//
// GET /api/candidates?field=&city=&nat=&q=&code=   -> { ok, unlocked, total, candidates:[...] }

// Accept the token under any of these env-var names (be forgiving about naming).
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
const DB_ID = process.env.NOTION_ATS_DB || "71792742873e4de398135c7855542b95";
const CODES = (process.env.EMPLOYER_CODES || "").split(",").map((s) => s.trim()).filter(Boolean);
const NOTION_VERSION = "2022-06-28";

const txt = (p) => {
  if (!p) return "";
  if (p.type === "title") return (p.title || []).map((t) => t.plain_text).join("");
  if (p.type === "rich_text") return (p.rich_text || []).map((t) => t.plain_text).join("");
  if (p.type === "select") return p.select ? p.select.name : "";
  if (p.type === "multi_select") return (p.multi_select || []).map((s) => s.name).join("، ");
  if (p.type === "number") return p.number != null ? String(p.number) : "";
  if (p.type === "email") return p.email || "";
  if (p.type === "phone_number") return p.phone_number || "";
  if (p.type === "url") return p.url || "";
  return "";
};

// Mask a name to initials-ish preview (e.g. "محمد العتيبي" -> "م. ا.")
const maskName = (n) => {
  const parts = String(n || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  return parts.slice(0, 2).map((w) => w[0] + ".").join(" ");
};

// A record with no real name yet — the ATS agent stores a placeholder when a CV
// couldn't be read/parsed. These must never surface on the public browser (they
// render as empty "م. ب." / "—" cards). This is a safety net in addition to the
// "مخفي عن الموقع" Notion filter, in case an incomplete row lacks that flag.
const isPlaceholderName = (n) => {
  const s = String(n || "").trim();
  if (!s) return true;
  if (s === "مرشح بدون اسم" || s === "سيرة غير مقروءة") return true;
  if (s.startsWith("[غير مقروء]")) return true;
  return false;
};

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.statusCode = 405; return res.end(JSON.stringify({ error: "method_not_allowed" })); }
  if (!NOTION_TOKEN) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "not_configured" })); }

  const url = new URL(req.url, "http://x");
  const qField = (url.searchParams.get("field") || "").trim();
  const qCity = (url.searchParams.get("city") || "").trim().toLowerCase();
  const qNat = (url.searchParams.get("nat") || "").trim();
  const qText = (url.searchParams.get("q") || "").trim().toLowerCase();
  const code = (url.searchParams.get("code") || "").trim();
  const unlocked = !!code && CODES.includes(code);

  // Server-side Notion filter: only complete, website-visible candidates.
  // "مخفي عن الموقع" is set by the ATS agent on any record that is incomplete,
  // missing data, or unreadable — those must not reach the public /employers
  // browser. An unset checkbox matches equals:false, so the existing pool that
  // predates the flag stays visible; only flagged rows are excluded.
  const visibleFilter = { property: "مخفي عن الموقع", checkbox: { equals: false } };
  const base = {
    page_size: 100,
    sorts: [{ property: "Candidate ID", direction: "descending" }],
    filter: qField
      ? { and: [visibleFilter, { property: "Field", select: { equals: qField } }] }
      : visibleFilter,
  };

  try {
    // Page through the whole database so employers see ALL candidates, not just
    // the first page (Notion caps a page at 100). Guarded to a sane maximum.
    let results = [];
    let cursor = null;
    for (let guard = 0; guard < 25; guard++) {
      const body = cursor ? { ...base, start_cursor: cursor } : base;
      const r = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
        method: "POST",
        headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        console.error("Notion query error", r.status, (await r.text()).slice(0, 400));
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, error: "notion_failed" }));
      }
      const data = await r.json();
      results = results.concat(data.results || []);
      if (!data.has_more || !data.next_cursor) break;
      cursor = data.next_cursor;
    }
    let rows = results.map((pg) => {
      const p = pg.properties || {};
      const name = txt(p["Candidate Name"]);
      const nameEn = txt(p["Name (EN)"]);
      // Skip records with no usable name (unread/incomplete CVs) regardless of flag.
      if (isPlaceholderName(name) && isPlaceholderName(nameEn)) return null;
      const rec = {
        id: txt(p["Candidate ID"]),
        field: txt(p["Field"]),
        role: txt(p["Target Role"]) || txt(p["Original Position"]),
        city: txt(p["City"]),
        experience: txt(p["Experience Years"]),
        education: txt(p["Education"]),
        nationalityType: txt(p["Nationality Type"]),
        availability: txt(p["Availability"]),
        languages: txt(p["Languages"]),
        skills: txt(p["Skills"]).slice(0, 160),
        saudization: txt(p["التوطين Saudization"]),
      };
      if (unlocked) {
        rec.name = name || nameEn;
        rec.phone = txt(p["Phone"]);
        rec.email = txt(p["Email"]);
        rec.cv = txt(p["CV Link"]);
      } else {
        rec.name = maskName(name || nameEn);
      }
      return rec;
    }).filter(Boolean);

    // Client-ish filters that Notion can't do cheaply here.
    if (qCity) rows = rows.filter((x) => x.city.toLowerCase().includes(qCity));
    if (qNat) rows = rows.filter((x) => x.nationalityType === qNat);
    if (qText) rows = rows.filter((x) => (x.role + " " + x.skills + " " + x.field).toLowerCase().includes(qText));

    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, unlocked, total: rows.length, candidates: rows }));
  } catch (e) {
    console.error("candidates handler error", e);
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "server_error" }));
  }
}
