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

// Arabic folds so a customer's spelling matches ours: hamza forms → ا,
// ة → ه, ى → ي, tashkeel and tatweel dropped, and the clitics ال/و/ب/ل
// stripped from word starts so «الإقامة» and «إقامة» are one word.
export function normalizeText(v) {
  return String(v || "")
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/(^|\s)(?:ال|و|وال|بال|لل|ب|ل)(?=\S{3,})/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

// The site is more than the 140 services: whole features with their own
// pages. An agent that only knows the service list sends a worker-housing
// customer to a generic page. Each entry carries the Arabic words a customer
// actually types; search matches on them and returns the page to link.
export const FEATURE_PAGES = [
  { key: "worker-housing", nameAr: "سكن العمالة والإعاشة والنقل", nameEn: "Worker housing, catering & transport", path: "/worker-housing", kw: "سكن عمال عمالة اعاشة نقل مساكن كامب camp housing labor accommodation" },
  { key: "workspaces", nameAr: "مساحات الأعمال والمكاتب", nameEn: "Workspaces & offices", path: "/workspaces", kw: "مكتب مكاتب مساحة عمل عنوان وطني مقر office coworking workspace" },
  { key: "farina", nameAr: "التموين والضيافة للشركات", nameEn: "Corporate catering & hospitality", path: "/farina", kw: "تموين ضيافة اكل وجبات كافتيريا catering food meals" },
  { key: "packages", nameAr: "الباقات", nameEn: "Packages", path: "/packages", kw: "باقة باقات اشتراك شهري سنوي package packages subscription" },
  { key: "services", nameAr: "كل الخدمات (+140 خدمة)", nameEn: "All services", path: "/services", kw: "خدمات خدمة services" },
  { key: "calculator", nameAr: "حاسبة التكاليف", nameEn: "Cost calculator", path: "/calculator", kw: "حاسبة تكلفة تكاليف كم يكلف calculator cost estimate" },
  { key: "consultation", nameAr: "احجز استشارة مجانية", nameEn: "Book a free consultation", path: "/consultation", kw: "استشارة موعد حجز مكالمة خبير consultation appointment call" },
  { key: "contact", nameAr: "تواصل معنا", nameEn: "Contact us", path: "/contact", kw: "تواصل اتصال عنوان موقع contact address phone" },
  { key: "business-development", nameAr: "تطوير الأعمال كخدمة", nameEn: "Business development as a service", path: "/business-development", kw: "تطوير اعمال مبيعات عملاء شراكات نمو business development sales growth" },
  { key: "ai-agents", nameAr: "المستشارون الأذكياء", nameEn: "AI advisors", path: "/ai-agents", kw: "ذكاء اصطناعي وكيل مستشار ذكي اتمتة ai agent automation" },
  { key: "compliance-agent", nameAr: "مستشار الامتثال والمخالفات", nameEn: "Compliance advisor", path: "/compliance-agent", kw: "امتثال مخالفة مخالفات غرامة غرامات التزام compliance violation fine" },
  { key: "ai-document-agent", nameAr: "المستشار الذكي للمستندات", nameEn: "AI document advisor", path: "/ai-document-agent", kw: "مستند مستندات وثيقة عقد مراجعة تدقيق document contract review" },
  { key: "hr", nameAr: "التوظيف والاستقدام", nameEn: "Hiring & recruitment", path: "/hr", kw: "توظيف استقدام موظف موظفين عامل عمال تاشيرة تأشيرة فيزا recruitment hiring visa" },
  { key: "task-force", nameAr: "تاسك فورس — فريق تنفيذي عند الطلب", nameEn: "Task force", path: "/task-force", kw: "فريق تنفيذي مشروع مؤقت task force team project" },
  { key: "shared-services", nameAr: "فريق الخدمات المشتركة", nameEn: "Shared services team", path: "/shared-services", kw: "خدمات مشتركة فريق مشترك محاسبة سكرتارية shared services back office" },
  { key: "bank-account", nameAr: "فتح حساب بنكي", nameEn: "Open a bank account", path: "/bank-account", kw: "حساب بنكي بنك مصرف iban bank account" },
  { key: "estrdad", nameAr: "استرداد الرسوم", nameEn: "Fee refunds", path: "/estrdad", kw: "استرداد رسوم مبلغ ارجاع refund fees" },
  { key: "formation-contract", nameAr: "تأسيس شركة بين شركاء", nameEn: "Formation between partners", path: "/formation-contract", kw: "شركاء شريك عقد تاسيس تأسيس حصص partners partnership formation" },
  { key: "deals", nameAr: "الصفقات والعروض", nameEn: "Deals", path: "/deals", kw: "صفقة صفقات عرض عروض خصم deals offers discount" },
  { key: "mahfol-makfol", nameAr: "سياحة الأعمال", nameEn: "Business tourism", path: "/mahfol-makfol", kw: "سياحة زيارة اعمال رحلة tourism business visit trip" },
  { key: "tourism", nameAr: "السياحة", nameEn: "Tourism", path: "/tourism", kw: "سياحة سياحية فندق tourism hotel" },
  { key: "suppliers", nameAr: "تسجيل الشركاء والموردين", nameEn: "Partner & supplier registration", path: "/suppliers", kw: "مورد موردين شريك تسجيل supplier vendor partner register" },
  { key: "employer-join", nameAr: "لأصحاب العمل", nameEn: "For employers", path: "/employer-join", kw: "صاحب عمل اصحاب عمل employer" },
  { key: "careers", nameAr: "الوظائف", nameEn: "Careers", path: "/careers", kw: "وظيفة وظائف سيرة ذاتية تقديم careers job jobs cv apply" },
  { key: "account", nameAr: "منصة العملاء (مركز عمليات العميل)", nameEn: "Client portal", path: "/account", kw: "حساب حسابي لوحة بوابة طلبي طلباتي تذكرة تذاكر دعم portal account order ticket support" },
  { key: "saudi-arabia", nameAr: "الاستثمار في السعودية", nameEn: "Investing in Saudi Arabia", path: "/saudi-arabia", kw: "استثمار مستثمر اجنبي السعودية invest investment saudi" },
  { key: "opportunities", nameAr: "الفرص الاستثمارية", nameEn: "Investment opportunities", path: "/opportunities", kw: "فرصة فرص استثمارية opportunities" },
  { key: "directory", nameAr: "دليل ريادة الأعمال", nameEn: "Entrepreneurship directory", path: "/directory", kw: "دليل ريادة رائد اعمال directory entrepreneur" },
  { key: "tools-and-calculators", nameAr: "الأدوات والحاسبات", nameEn: "Tools & calculators", path: "/tools-and-calculators", kw: "ادوات حاسبات tools calculators" },
  { key: "news", nameAr: "الرؤى والأخبار", nameEn: "Insights & news", path: "/news", kw: "اخبار خبر مقال نظام جديد news article" },
  { key: "data", nameAr: "قاعدة عملاء الأعمال", nameEn: "Business client database", path: "/data", kw: "قاعدة بيانات عملاء data database leads" },
].map((f) => ({
  ...f,
  url: `${SITE_BASE_FOR_DATA}/ar${f.path}`,
  urlEn: `${SITE_BASE_FOR_DATA}${f.path}`,
  search: normalizeText(`${f.nameAr} ${f.nameEn} ${f.kw}`),
}));

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
    descAr: String(s.description || "").replace(/\s+/g, " ").trim().slice(0, 240),
    url: s.slug ? `${SITE_BASE_FOR_DATA}/ar/services/${s.slug}` : `${SITE_BASE_FOR_DATA}/ar/services`,
    urlEn: s.slug ? `${SITE_BASE_FOR_DATA}/services/${s.slug}` : `${SITE_BASE_FOR_DATA}/services`,
    // What a customer types rarely equals a service's name; the description,
    // deliverables, target client and government platform carry the rest.
    search: normalizeText([
      (i18n[s.code] && i18n[s.code].ar) || s.nameAr || "", (i18n[s.code] && i18n[s.code].en) || s.nameEn || s.name || "",
      s.category, s.categoryAr, s.govPlatform, s.code, s.description, s.targetClient,
      Array.isArray(s.deliverables) ? s.deliverables.join(" ") : s.deliverables,
    ].join(" ")),
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

  const data = { services, packages, pages: FEATURE_PAGES, updated: new Date().toISOString() };
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
