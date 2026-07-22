// Business Partner 3.0 — Indeed-compatible XML job feed (ESM, Vercel serverless).
//
// Emits an <source>…</source> XML feed of the workshop hiring-campaign vacancies
// that are marked "منشورة على الموقع" in the Notion campaign database, in the format
// Indeed crawls to index jobs organically (https://docs.indeed.com/job-sourcing/xml-feed).
// You register this feed URL once in your Indeed employer account; after that every
// job you publish in Notion appears on Indeed automatically — no manual posting.
//
// The salary range is intentionally NOT emitted (it is marked "سري" / confidential).
//
// Env vars:
//   NOTION_TOKEN            Notion integration secret (share the campaign DB with it)
//   NOTION_WORKSHOP_DB      optional override of the campaign database id
//   JOBS_FEED_COMPANY       company name shown on the listing (default "Business Partner")
//   JOBS_FEED_CITY/STATE/COUNTRY   default location (the campaign DB has no per-row location)
//
// GET /api/jobs-feed  ->  application/xml

import { WORKSHOP_JDS } from "./_workshop-jds.js";

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
const WORKSHOP_DB = process.env.NOTION_WORKSHOP_DB || "f83bce33eab7481a8b803495c6cd7619";
const NOTION_VERSION = "2022-06-28";
const COMPANY = process.env.JOBS_FEED_COMPANY || "Business Partner";
const DEF_CITY = process.env.JOBS_FEED_CITY || "Riyadh";
const DEF_STATE = process.env.JOBS_FEED_STATE || "Riyadh Province";
const DEF_COUNTRY = process.env.JOBS_FEED_COUNTRY || "SA";
const PUBLISHED = "منشورة على الموقع";

export const config = { maxDuration: 30 };

async function notionFetch(path, method, payload) {
  return fetch(`https://api.notion.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });
}

const txt = (p) => {
  if (!p) return "";
  if (p.type === "title") return (p.title || []).map((t) => t.plain_text).join("");
  if (p.type === "rich_text") return (p.rich_text || []).map((t) => t.plain_text).join("");
  if (p.type === "select") return p.select ? p.select.name : "";
  if (p.type === "number") return p.number != null ? String(p.number) : "";
  if (p.type === "url") return p.url || "";
  return "";
};

const xmlEsc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Wrap free text safely in CDATA, neutralizing any accidental "]]>" sequence.
const cdata = (s) => "<![CDATA[" + String(s || "").replace(/]]>/g, "]]]]><![CDATA[>") + "]]>";

// Build an HTML description Indeed can render: the full JD when we have one, else a
// clean generated summary so every listing still has a real, non-empty description.
function buildDescription(slug, title, dept, vacancies) {
  const jd = WORKSHOP_JDS[slug];
  if (jd) {
    const html = jd
      .split(/\n{2,}/)
      .map((para) => {
        const lines = para.split("\n").map((l) => l.trim()).filter(Boolean);
        const bullets = lines.filter((l) => l.startsWith("•"));
        if (bullets.length && bullets.length === lines.length) {
          return "<ul>" + bullets.map((b) => `<li>${xmlEsc(b.replace(/^•\s*/, ""))}</li>`).join("") + "</ul>";
        }
        return "<p>" + lines.map(xmlEsc).join("<br/>") + "</p>";
      })
      .join("");
    return html;
  }
  const parts = [`<p>${xmlEsc(title)} — ${xmlEsc(COMPANY)} (${xmlEsc(dept)}).</p>`];
  if (vacancies) parts.push(`<p>Open positions: ${xmlEsc(vacancies)}.</p>`);
  parts.push("<p>Apply through the link to join our events-fabrication workshop team.</p>");
  return parts.join("");
}

export default async function handler(req, res) {
  if (req.method !== "GET") { res.statusCode = 405; return res.end("method_not_allowed"); }
  if (!NOTION_TOKEN) { res.statusCode = 503; return res.end("not_configured"); }

  const jobs = [];
  try {
    let cursor;
    do {
      const r = await notionFetch(`databases/${WORKSHOP_DB}/query`, "POST", {
        page_size: 100,
        start_cursor: cursor,
        filter: { property: "حالة النشر", select: { equals: PUBLISHED } },
      });
      if (!r.ok) { console.error("workshop feed query error", r.status, (await r.text()).slice(0, 300)); res.statusCode = 502; return res.end("notion_failed"); }
      const data = await r.json();
      for (const pg of data.results || []) {
        const p = pg.properties || {};
        const title = txt(p["الوظيفة"]);
        const url = txt(p["رابط الوظيفة"]);
        const slug = txt(p["معرف الوظيفة ATS"]);
        // A public listing must have a title and a landing URL to apply on.
        if (!title || !url) continue;
        jobs.push({
          title,
          url,
          ref: slug || pg.id,
          dept: txt(p["القسم"]),
          vacancies: txt(p["عدد الشواغر"]),
          date: new Date(pg.last_edited_time || pg.created_time || Date.now()).toUTCString(),
        });
      }
      cursor = data.has_more ? data.next_cursor : undefined;
    } while (cursor);
  } catch (e) {
    console.error("jobs-feed handler error", e);
    res.statusCode = 500;
    return res.end("server_error");
  }

  const items = jobs.map((j) => {
    const desc = buildDescription(j.ref, j.title, j.dept, j.vacancies);
    return [
      "  <job>",
      `    <title>${cdata(j.title)}</title>`,
      `    <date>${cdata(j.date)}</date>`,
      `    <referencenumber>${cdata(j.ref)}</referencenumber>`,
      `    <url>${cdata(j.url)}</url>`,
      `    <company>${cdata(COMPANY)}</company>`,
      `    <city>${cdata(DEF_CITY)}</city>`,
      `    <state>${cdata(DEF_STATE)}</state>`,
      `    <country>${cdata(DEF_COUNTRY)}</country>`,
      `    <jobtype>${cdata("fulltime")}</jobtype>`,
      `    <category>${cdata(j.dept)}</category>`,
      `    <description>${cdata(desc)}</description>`,
      "  </job>",
    ].join("\n");
  }).join("\n");

  const xml =
    '<?xml version="1.0" encoding="utf-8"?>\n' +
    "<source>\n" +
    `  <publisher>${xmlEsc(COMPANY)}</publisher>\n` +
    "  <publisherurl>https://businesspartner.sa</publisherurl>\n" +
    `  <lastBuildDate>${xmlEsc(new Date().toUTCString())}</lastBuildDate>\n` +
    items + (items ? "\n" : "") +
    "</source>\n";

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=1800, s-maxage=1800");
  return res.end(xml);
}
