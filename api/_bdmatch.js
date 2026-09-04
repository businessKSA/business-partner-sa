// Matchmaking between a client's Business Development profile and the
// companies database — the Notion "🏢 قاعدة الشركات — مبيعات" that the paid
// /data portal serves through /api/pay?resource=leads.
//
// The database is keyed on a Sector select (and a City select) whose values
// are the exact English strings in api/_bdprofile.js. The profile stores those
// same values, so the query here is an OR over the client's target sectors,
// narrowed by their target cities when they picked any. Nothing fuzzy: a fuzzy
// match that returns a plumbing supplier to a hospital-equipment vendor reads
// as noise, and noise is what makes a client stop opening the page.
//
// Contact details are not part of a match row. A match is a company, a sector,
// a city, a website and a description — enough to decide whether to reach
// out. Phone and e-mail are revealed one company at a time, on request, and
// each reveal is written to the audit log. Two reasons, both the owner's:
// every trial account getting a bulk contact export would hand out the exact
// asset the 375 SAR/month data subscription sells, and it would expose the
// business under the personal-data law with no record of who took what.
//
// Underscore-prefixed on purpose: Vercel turns every other file in api/ into a
// serverless function and the plan caps a deployment at 12. See api/README.md.

export const LEADS_DB = process.env.NOTION_LEADS_DB || "26faca2761884b6ab584924c374f2d22";
export const MATCH_PAGE_SIZE = 25;

/**
 * The Notion filter for a profile, or null when there is nothing to match on.
 * Null means "do not query" — an unfiltered query would return the whole
 * database, which is not a match, it is a leak.
 */
export function matchFilter(profile) {
  const sectors = Array.isArray(profile && profile.targetSectors) ? profile.targetSectors.filter(Boolean) : [];
  if (!sectors.length) return null;
  const cities = Array.isArray(profile && profile.targetCities) ? profile.targetCities.filter(Boolean) : [];

  const and = [];
  // One sector → a plain equals; several → an OR. Notion rejects an "or" with
  // a single member on some versions, so the shape depends on the count.
  and.push(sectors.length === 1
    ? { property: "Sector", select: { equals: sectors[0] } }
    : { or: sectors.map((s) => ({ property: "Sector", select: { equals: s } })) });
  if (cities.length) {
    and.push(cities.length === 1
      ? { property: "City", select: { equals: cities[0] } }
      : { or: cities.map((c) => ({ property: "City", select: { equals: c } })) });
  }
  // The same two guards the paid portal applies: no duplicates, and only
  // companies that can actually be contacted.
  and.push({ property: "Duplicate", checkbox: { equals: false } });
  and.push({ or: [
    { property: "Phone", phone_number: { is_not_empty: true } },
    { property: "Email", email: { is_not_empty: true } },
  ] });
  return { and };
}

/** The request body for one page of matches. */
export function matchQuery(profile, cursor) {
  const filter = matchFilter(profile);
  if (!filter) return null;
  const body = { page_size: MATCH_PAGE_SIZE, filter, sorts: [{ property: "Sector", direction: "ascending" }] };
  if (cursor) body.start_cursor = String(cursor);
  return body;
}

const title = (p) => ((p && p.title) || []).map((t) => t.plain_text).join("").trim();
const text = (p) => ((p && p.rich_text) || []).map((t) => t.plain_text).join("").trim();
const sel = (p) => (p && p.select && p.select.name) || "";

/**
 * A Notion page → a match row. Contact fields are only included when `reveal`
 * is true; the default row carries nothing a client could dial or mail.
 */
export function mapCompany(page, reveal = false) {
  const pr = (page && page.properties) || {};
  const row = {
    id: page && page.id ? String(page.id) : "",
    name: title(pr["Name"]),
    sector: sel(pr["Sector"]),
    city: sel(pr["City"]),
    ownership: sel(pr["Ownership"]),
    website: (pr["Domain"] && pr["Domain"].url) || "",
    linkedin: (pr["LinkedIn"] && pr["LinkedIn"].url) || "",
    description: text(pr["Description"]).slice(0, 400),
    hasPhone: !!(pr["Phone"] && pr["Phone"].phone_number),
    hasEmail: !!(pr["Email"] && pr["Email"].email),
  };
  if (reveal) {
    row.phone = (pr["Phone"] && pr["Phone"].phone_number) || "";
    row.email = (pr["Email"] && pr["Email"].email) || "";
  }
  return row;
}

/**
 * Why this company was matched, in the client's language — the sector they
 * asked for, and the city when that narrowed it. Shown on the row so the list
 * reads as "these are yours because…" rather than a bare table.
 */
export function explainMatch(row, profile, labels) {
  const parts = [];
  const sectorLabel = labels && labels.sector ? labels.sector : (v) => v;
  const cityLabel = labels && labels.city ? labels.city : (v) => v;
  if (row.sector && (profile.targetSectors || []).includes(row.sector)) parts.push(sectorLabel(row.sector));
  if (row.city && (profile.targetCities || []).includes(row.city)) parts.push(cityLabel(row.city));
  return parts.join(" · ");
}
