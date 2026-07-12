import fs from "node:fs";
import path from "node:path";

const root = path.resolve("site");

const tabs = [
  ["platforms", "Platform and HR", "إدارة المنصات والموارد البشرية"],
  ["foreign", "Foreign companies", "تأسيس الشركات الأجنبية"],
  ["licenses", "Government licenses", "التراخيص الحكومية"],
  ["residency", "Premium Residency", "الإقامة المميزة"],
  ["addons", "Add-ons", "الإضافات"],
  ["terms", "Terms", "الشروط والأحكام"],
];

const coreServices = {
  ar: [
    "قوى",
    "أبشر أعمال / مقيم حسب نوع الكيان",
    "هيئة الزكاة والضريبة والجمارك",
    "المركز السعودي للأعمال",
    "مدد",
    "التأمينات الاجتماعية",
    "تذاكر دعم خدمات المنصات",
  ],
  en: [
    "Qiwa",
    "Absher Business / Muqeem by entity type",
    "Zakat, Tax and Customs Authority",
    "Saudi Business Center",
    "Mudad",
    "GOSI",
    "Platform support tickets",
  ],
};

const tiers = [
  {
    id: "micro",
    en: "Micro",
    ar: "متناهية الصغر",
    sizeEn: "1-5 employees",
    sizeAr: "1-5 موظفين",
    amount: "800",
    vatEn: "SAR 920 incl. VAT",
    vatAr: "شامل الضريبة: 920 ريال",
    priceEn: "Starting from SAR 800 / month",
    priceAr: "تبدأ من 800 ريال شهرياً",
    descEn: "For very small businesses that need essential platform coverage.",
    descAr: "للمنشآت الصغيرة جداً التي تحتاج تغطية أساسية للمنصات.",
  },
  {
    id: "small",
    en: "Small",
    ar: "صغيرة",
    sizeEn: "6-49 employees",
    sizeAr: "6-49 موظفاً",
    amount: "1500",
    vatEn: "SAR 1,725 incl. VAT",
    vatAr: "شامل الضريبة: 1,725 ريال",
    priceEn: "Starting from SAR 1,500 / month",
    priceAr: "تبدأ من 1,500 ريال شهرياً",
    descEn: "Wider request follow-up, more tickets, and optional added platforms.",
    descAr: "متابعة أوسع للطلبات وتذاكر أكثر وإمكانية إضافة منصات.",
  },
  {
    id: "medium",
    en: "Medium",
    ar: "متوسطة",
    sizeEn: "50-249 employees",
    sizeAr: "50-249 موظفاً",
    amount: "4500",
    vatEn: "SAR 5,175 incl. VAT",
    vatAr: "شامل الضريبة: 5,175 ريال",
    priceEn: "Starting from SAR 4,500 / month",
    priceAr: "تبدأ من 4,500 ريال شهرياً",
    descEn: "Expanded HR and government platform operations with monthly reporting.",
    descAr: "إدارة موسعة للمنصات الحكومية والموارد البشرية مع تقرير شهري.",
  },
  {
    id: "large",
    en: "Large",
    ar: "كبيرة",
    sizeEn: "250+ employees",
    sizeAr: "250 موظفاً فأكثر",
    amount: "7500",
    vatEn: "SAR 8,625 incl. VAT",
    vatAr: "شامل الضريبة: 8,625 ريال",
    priceEn: "Starting from SAR 7,500 / month",
    priceAr: "تبدأ من 7,500 ريال شهرياً",
    descEn: "Custom scope by entities, branches, platforms, SLA and reporting needs.",
    descAr: "نطاق مخصص حسب الكيانات والفروع والمنصات واتفاقية مستوى الخدمة.",
  },
];

const addons = [
  ["extra-employees", "Extra employees outside package limit", "إضافة موظفين خارج حد الباقة", "75-250 SAR", "75-250 ريال حسب الحجم والمنصات"],
  ["extra-branch", "Branch or operating location", "إضافة فرع أو موقع تشغيلي", "500-1,500 SAR / month", "500-1,500 ريال شهرياً"],
  ["extra-authority", "Extra government authority or platform", "إضافة جهة أو منصة حكومية خارج نطاق الباقة", "500-2,000 SAR / month", "500-2,000 ريال شهرياً"],
  ["balady-licenses", "Balady and municipal licenses", "إضافة بلدي والرخص البلدية", "750-2,000 SAR / month", "750-2,000 ريال شهرياً"],
  ["mudad-wps", "Advanced Mudad and WPS", "إضافة مدد وحماية الأجور المتقدمة", "500-1,500 SAR / month", "500-1,500 ريال شهرياً"],
  ["advanced-compliance", "Advanced compliance and alerts", "إضافة الامتثال والتنبيهات المتقدمة", "1,500-5,000 SAR / month", "1,500-5,000 ريال شهرياً"],
  ["smart-client-agent", "Smart client service agent", "إضافة الموظف الذكي لخدمات العميل", "1,000-3,000 SAR / month", "1,000-3,000 ريال شهرياً"],
  ["initial-setup", "Initial platform and permissions setup", "إعداد أولي للمنصات والصلاحيات", "Starting from SAR 2,500 one time", "يبدأ من 2,500 ريال مرة واحدة"],
];

const otherPackages = {
  foreign: {
    id: "foreign-company",
    en: "Foreign company formation",
    ar: "تأسيس الشركات الأجنبية",
    priceEn: "Starting from SAR 15,000",
    priceAr: "تبدأ من 15,000 ريال",
    amount: "15000",
    listEn: ["Requirements review", "Document preparation", "Formation follow-up", "Post-issuance platform setup", "Client portal connection"],
    listAr: ["مراجعة المتطلبات", "تجهيز المستندات", "متابعة التأسيس", "تهيئة المنصات بعد الإصدار", "ربط العميل بالبورتال"],
  },
  licenses: {
    id: "licenses",
    en: "Government licenses",
    ar: "التراخيص الحكومية",
    priceEn: "Fees start from SAR 3,500",
    priceAr: "تبدأ أتعابها من 3,500 ريال",
    amount: "3500",
    listEn: ["Requirements analysis", "Application preparation", "Government authority follow-up", "Post-issuance compliance plan"],
    listAr: ["تحليل المتطلبات", "تجهيز الطلب", "متابعة الجهة الحكومية", "خطة امتثال بعد الإصدار"],
  },
  residency: {
    id: "premium-residency",
    en: "Premium Residency",
    ar: "الإقامة المميزة",
    priceEn: "Starting from SAR 5,000",
    priceAr: "تبدأ من 5,000 ريال",
    amount: "5000",
    listEn: ["Eligibility review", "File preparation", "Application follow-up", "Government fees are separate"],
    listAr: ["مراجعة الأهلية", "تجهيز الملف", "متابعة الطلب", "الرسوم الحكومية منفصلة"],
  },
};

function L(lang, en, ar) {
  return lang === "ar" ? ar : en;
}

function services(lang, extra = []) {
  return [...coreServices[lang], ...extra].map((s) => `<li>${s}</li>`).join("");
}

function tierCard(lang, tier, featured = false) {
  const extra = tier.id === "medium"
    ? [L(lang, "Monthly report", "تقرير شهري"), L(lang, "Periodic follow-up", "متابعة دورية")]
    : tier.id === "large"
      ? [L(lang, "Custom request limits", "حدود طلبات مخصصة"), L(lang, "SLA and meetings by agreement", "تقارير واجتماعات حسب الاتفاقية")]
      : [];
  return `<article class="pk-card ${featured ? "featured" : ""}">
    ${featured ? `<span class="pk-badge">${L(lang, "Most popular", "الأكثر طلباً")}</span>` : ""}
    <div class="pk-card-top">
      <span class="pk-size">${L(lang, tier.sizeEn, tier.sizeAr)}</span>
      <h3>${L(lang, tier.en, tier.ar)}</h3>
      <strong>${L(lang, tier.priceEn, tier.priceAr)}</strong>
      <small>${L(lang, tier.vatEn, tier.vatAr)}</small>
      <p>${L(lang, tier.descEn, tier.descAr)}</p>
    </div>
    <ul class="pk-list">${services(lang, extra)}</ul>
    <button type="button" class="btn btn-primary pkg-order" data-id="pkg-${tier.id}" data-name-en="${tier.en}" data-name-ar="${tier.ar}" data-amount="${tier.amount}" data-price="${L(lang, tier.priceEn, tier.priceAr)}">${L(lang, "Request package", "اطلب الباقة")}</button>
  </article>`;
}

function otherCard(lang, key) {
  const item = otherPackages[key];
  return `<article class="pk-service-card">
    <div>
      <span class="eyebrow">${L(lang, "Package", "باقة")}</span>
      <h3>${L(lang, item.en, item.ar)}</h3>
      <strong>${L(lang, item.priceEn, item.priceAr)}</strong>
      <ul class="pk-list">${item[`list${lang === "ar" ? "Ar" : "En"}`].map((s) => `<li>${s}</li>`).join("")}</ul>
    </div>
    <button type="button" class="btn btn-primary pkg-order" data-id="pkg-${item.id}" data-name-en="${item.en}" data-name-ar="${item.ar}" data-amount="${item.amount}" data-price="${L(lang, item.priceEn, item.priceAr)}">${L(lang, "Request package", "اطلب الباقة")}</button>
  </article>`;
}

function addonsPanel(lang) {
  return `<div class="pk-addons-grid">${addons.map(([id, en, ar, priceEn, priceAr]) => `<article class="pk-addon">
    <h3>${L(lang, en, ar)}</h3>
    <strong>${L(lang, priceEn, priceAr)}</strong>
    <button type="button" class="btn btn-ghost pkg-order" data-id="pkg-${id}" data-name-en="${en}" data-name-ar="${ar}" data-amount="" data-price="${L(lang, priceEn, priceAr)}">${L(lang, "Add to request", "أضف للطلب")}</button>
  </article>`).join("")}</div>`;
}

function termsPanel(lang) {
  const terms = [
    ["Establishments use Absher Business for passport-related worker services up to 100 workers, then move to Muqeem when the rule applies.", "المؤسسات تستخدم أبشر أعمال لخدمات العمالة التابعة للجوازات حتى 100 عامل، وبعدها يتم الانتقال إلى مقيم عند انطباق القاعدة."],
    ["Companies use Muqeem from day one.", "الشركات تستخدم مقيم من اليوم الأول."],
    ["Government fees, subscriptions and penalties are separate from Business Partner fees.", "الرسوم الحكومية والاشتراكات والغرامات منفصلة عن أتعاب Business Partner."],
    ["Business Partner does not guarantee government approvals.", "Business Partner لا يضمن موافقة الجهات الحكومية."],
    ["Work starts after payment and after receiving required permissions and documents.", "التنفيذ يبدأ بعد السداد وتوفير الصلاحيات والتفويضات والمستندات."],
    ["No passwords or OTP codes are requested in public chat.", "لا يتم طلب كلمات مرور أو OTP داخل الشات العام."],
  ];
  return `<article class="pk-terms"><h3>${L(lang, "Terms and conditions", "الشروط والأحكام")}</h3><ul class="pk-list">${terms.map(([en, ar]) => `<li>${L(lang, en, ar)}</li>`).join("")}</ul></article>`;
}

function comparison(lang) {
  const rows = [
    ["Qiwa", "قوى"],
    ["Absher Business / Muqeem", "أبشر أعمال / مقيم"],
    ["Zakat, Tax and Customs Authority", "هيئة الزكاة والضريبة والجمارك"],
    ["Saudi Business Center", "المركز السعودي للأعمال"],
    ["Mudad", "مدد"],
    ["GOSI", "التأمينات الاجتماعية"],
    ["Balady", "بلدي"],
    ["Salamah and Civil Defense", "سلامة والدفاع المدني"],
    ["Chamber attestations", "الغرفة التجارية والتصاديق"],
    ["SPL and National Address", "سبل والعنوان الوطني"],
    ["Document upload", "رفع المستندات"],
    ["Smart agent support", "دعم الوكيل الذكي"],
  ];
  return `<div class="pk-compare"><h3>${L(lang, "Included service matrix", "مقارنة الخدمات المشمولة")}</h3><div>${rows.map(([en, ar]) => `<span>${L(lang, en, ar)}</span><b>✓</b><b>✓</b><b>✓</b><b>✓</b>`).join("")}</div></div>`;
}

function orderForm(lang) {
  const addonChecks = addons.map(([id, en, ar, priceEn, priceAr]) => `<label class="bp-chk"><input type="checkbox" value="${id}" data-name-en="${en}" data-name-ar="${ar}" data-price="${L(lang, priceEn, priceAr)}"> ${L(lang, en, ar)} <small>${L(lang, priceEn, priceAr)}</small></label>`).join("");
  return `<section class="section section--gray" id="package-order"><div class="container"><div class="package-order-box">
    <div class="section-head">
      <span class="eyebrow">${L(lang, "Checkout", "الشراء")}</span>
      <h2>${L(lang, "Complete package request", "أكمل طلب الباقة")}</h2>
      <p>${L(lang, "Pick a package and complete the required details. Fixed-price packages continue to checkout; custom scopes become quote requests.", "اختر الباقة وأكمل البيانات المطلوبة. الباقات ذات السعر الواضح تنتقل للشراء، والنطاق المخصص يتحول إلى طلب عرض سعر.")}</p>
    </div>
    <form id="package-order-form" class="pk-form">
      <input type="hidden" id="po-package-id"><input type="hidden" id="po-package-name-en"><input type="hidden" id="po-package-name-ar"><input type="hidden" id="po-package-amount"><input type="hidden" id="po-package-price">
      <div class="field"><label>${L(lang, "Selected package", "الباقة المختارة")}</label><input id="po-package-label" readonly placeholder="${L(lang, "Choose a package above", "اختر باقة من الأعلى")}"></div>
      <div class="grid-2">
        <div class="field"><label>${L(lang, "Entity type", "نوع الكيان")}</label><select id="po-entity" required><option value="">${L(lang, "Select", "اختر")}</option><option value="establishment">${L(lang, "Establishment", "مؤسسة")}</option><option value="company">${L(lang, "Company", "شركة")}</option></select></div>
        <div class="field"><label>${L(lang, "Employees", "عدد الموظفين")}</label><input id="po-employees" type="number" min="1" value="1" required></div>
        <div class="field"><label>${L(lang, "Branches", "عدد الفروع")}</label><input id="po-branches" type="number" min="0" value="1" required></div>
      </div>
      <div class="field"><label>${L(lang, "Add-ons", "الإضافات")}</label><div class="bp-chips package-addons">${addonChecks}</div></div>
      <label class="bp-chk package-terms"><input id="po-terms" type="checkbox" required> ${L(lang, "I accept the package terms and checkout conditions.", "أوافق على شروط الباقة وأحكام الشراء.")}</label>
      <div class="pk-actions"><button class="btn btn-primary" type="submit">${L(lang, "Continue", "متابعة الطلب")}</button><a class="btn btn-ghost" href="${lang === "ar" ? "/ar/account" : "/account"}">${L(lang, "Client Portal", "صفحة العميل")}</a></div>
      <div class="form-success" id="package-order-success" hidden></div>
    </form>
  </div></div></section>`;
}

function main(lang) {
  return `<main class="packages-page">
    <section class="hero pk-hero"><div class="container hero-inner">
      <span class="eyebrow">${L(lang, "Packages", "الباقات")}</span>
      <h1>${L(lang, "Business operations packages", "باقات تشغيل الأعمال")}</h1>
      <p>${L(lang, "Clear packages for platform management, HR operations, government licenses and premium residency, connected to checkout and the client portal.", "باقات واضحة لإدارة المنصات والموارد البشرية والتراخيص الحكومية والإقامة المميزة، مرتبطة بالشراء وصفحة العميل.")}</p>
    </div></section>
    <section class="section pk-shell"><div class="container">
      <div class="pk-tabs" role="tablist">${tabs.map(([key, en, ar], i) => `<button type="button" class="pk-tab ${i === 0 ? "active" : ""}" data-group="${key}">${L(lang, en, ar)}</button>`).join("")}</div>
      <section class="pk-panel active" data-panel="platforms">
        <div class="pk-grid">${tiers.map((tier, index) => tierCard(lang, tier, index === 1)).join("")}</div>
        <article class="pk-rule"><h3>${L(lang, "Absher Business / Muqeem rule", "قاعدة أبشر أعمال / مقيم")}</h3>${termsPanel(lang)}</article>
        ${comparison(lang)}
      </section>
      <section class="pk-panel" data-panel="foreign">${otherCard(lang, "foreign")}</section>
      <section class="pk-panel" data-panel="licenses">${otherCard(lang, "licenses")}</section>
      <section class="pk-panel" data-panel="residency">${otherCard(lang, "residency")}</section>
      <section class="pk-panel" data-panel="addons">${addonsPanel(lang)}</section>
      <section class="pk-panel" data-panel="terms">${termsPanel(lang)}</section>
    </div></section>
    ${orderForm(lang)}
  </main>`;
}

function injectAssets(html) {
  if (!html.includes("packages-flow.css")) html = html.replace("</head>", '<link rel="stylesheet" href="/assets/css/packages-flow.css">\n</head>');
  if (!html.includes("packages-flow.js")) html = html.replace("</body>", '<script src="/assets/js/packages-flow.js"></script>\n</body>');
  return html;
}

function replaceMain(file, lang) {
  let html = fs.readFileSync(file, "utf8");
  html = html.replace(/<main[\s\S]*?<\/main>/, main(lang));
  fs.writeFileSync(file, injectAssets(html));
}

for (const p of ["packages.html", "fr/packages.html", "es/packages.html", "zh/packages.html", "ru/packages.html", "hi/packages.html", "ko/packages.html", "ja/packages.html"]) {
  const file = path.join(root, p);
  if (fs.existsSync(file)) replaceMain(file, "en");
}

const ar = path.join(root, "ar/packages.html");
if (fs.existsSync(ar)) replaceMain(ar, "ar");

for (const p of ["account.html", "ar/account.html", "checkout.html", "ar/checkout.html"]) {
  const file = path.join(root, p);
  if (fs.existsSync(file)) fs.writeFileSync(file, injectAssets(fs.readFileSync(file, "utf8")));
}
