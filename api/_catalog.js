// Business Partner — the published catalog, read once and shared.
//
// Prices live in the site's own data files and are edited there. Every agent
// that used to carry them as frozen prompt text drifted the moment a price
// changed — the packages were repriced twice in one month while the WhatsApp
// agent kept quoting the old figures. This module is the single reader, so
// the site, the website advisor and the API all quote the same number.
//
// Files prefixed with "_" inside api/ are NOT deployed as serverless
// functions by Vercel (same trick as _db.js), which keeps us under the
// 12-function plan cap.

const CATALOG_TTL_MS = 5 * 60 * 1000;
let _catalogCache = null;

export const SITE_BASE_FOR_DATA =
  (process.env.MKT_SITE_BASE || "https://www.businesspartner.sa").replace(/\/+$/, "");

async function readSiteData(name) {
  // 1) bundled file (fast, no network)
  try {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const here = dirname(fileURLToPath(import.meta.url));
    return JSON.parse(readFileSync(join(here, "..", "site", "data", name), "utf8"));
  } catch {}
  // 2) the published copy (same content the pages read)
  const r = await fetch(`${SITE_BASE_FOR_DATA}/data/${name}`, { cache: "no-store" });
  if (!r.ok) throw new Error("catalog_fetch_failed");
  return r.json();
}

export async function loadCatalog() {
  if (_catalogCache && Date.now() - _catalogCache.at < CATALOG_TTL_MS) return _catalogCache.data;

  const [rawServices, site, i18n] = await Promise.all([
    readSiteData("services.json"),
    readSiteData("site.json").catch(() => ({})),
    // Arabic service names live in their own file; without it an Arabic
    // customer would be quoted an English service name.
    readSiteData("service-i18n.json").catch(() => ({})),
  ]);

  const list = Array.isArray(rawServices) ? rawServices : (rawServices.services || []);
  const services = list.map((s) => ({
    code: s.code || "",
    nameAr: (i18n[s.code] && i18n[s.code].ar) || s.nameAr || s.name || "",
    nameEn: (i18n[s.code] && i18n[s.code].en) || s.nameEn || s.name || "",
    category: s.category || "",
    categoryAr: s.categoryAr || "",
    govPlatform: s.govPlatform || "",
    pricingModel: s.pricingModel || "",
    price: (s.price && (s.price.amount ?? null)) ?? null,
    priceLabel: (s.price && s.price.label) || "",
    // Government fees are charged on top wherever the catalog says so — an
    // agent must say this instead of quoting the fee as a total.
    govFeesSeparate: !!s.govFeesSeparate,
    requiresProposal: !!s.requiresProposal,
    url: s.slug ? `${SITE_BASE_FOR_DATA}/ar/services/${s.slug}` : `${SITE_BASE_FOR_DATA}/ar/services`,
  }));

  const groups = (site.packages && site.packages.groups) || [];
  const packages = [];
  for (const g of groups) {
    for (const t of (g.tiers || [])) {
      packages.push({
        group: g.key || "",
        groupAr: g.ar || "",
        key: t.key || "",
        nameAr: t.nameAr || t.name || "",
        nameEn: t.nameEn || t.name || "",
        forAr: t.for || "",
        forEn: t.forEn || "",
        amount: t.amount ?? null,
        priceAr: t.price || "",
        priceEn: t.priceEn || "",
        features: t.features || [],
        url: `${SITE_BASE_FOR_DATA}/ar/packages#pkg-${g.key || ""}`,
      });
    }
  }

  const data = { services, packages, updated: new Date().toISOString() };
  _catalogCache = { at: Date.now(), data };
  return data;
}

// A compact price sheet for a model prompt. The full catalog is far too long
// to paste into every request, so this carries the packages in full (their
// prices are advertised and quotable as-is) and the priced services as one
// line each. Returns "" on any failure: an agent with no sheet answers from
// its own instructions, which is better than an agent that fails to answer.
export async function priceSheetText(limit = 140) {
  try {
    const cat = await loadCatalog();
    const pkgs = cat.packages.map((p) =>
      `- ${p.nameAr} (${p.groupAr}) — ${p.priceAr}${p.forAr ? ` · ${p.forAr}` : ""}`).join("\n");
    const svcs = cat.services
      .filter((s) => s.priceLabel)
      .slice(0, limit)
      .map((s) => `- ${s.code} ${s.nameAr} — ${s.priceLabel}${s.govFeesSeparate ? " (+ الرسوم الحكومية)" : ""}`)
      .join("\n");
    return [
      "=== الأسعار الحية من كتالوج الموقع (المرجع الحاسم للأسعار) ===",
      "⚠️ هذه القائمة تعلو على أي سعر آخر في قاعدة المعرفة أو في تعليماتك. إذا اختلف رقم هنا عن رقم في قاعدة المعرفة فاعتمد الرقم هنا وتجاهل الآخر تماماً. ولا تذكر أي سعر غير موجود في هذه القائمة.",
      "الباقات (أسعارها معلنة رسمياً ويجوز ذكرها كما هي):",
      pkgs,
      "",
      "الخدمات (أتعابنا؛ والرسوم الحكومية تُضاف فوقها حيث أُشير لذلك):",
      svcs,
      "=== نهاية الأسعار الحية ===",
    ].join("\n");
  } catch {
    return "";
  }
}
