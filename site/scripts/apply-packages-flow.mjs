import fs from "node:fs";
import path from "node:path";

const root = path.resolve("site");

const servicesAr = ["قوى", "أبشر أعمال / مقيم حسب نوع الكيان", "هيئة الزكاة والضريبة والجمارك", "المركز السعودي للأعمال", "مدد", "التأمينات الاجتماعية", "بلدي", "سلامة والدفاع المدني", "الغرفة التجارية والتصاديق", "سبل والعنوان الوطني", "تذاكر دعم خدمات المنصات"];
const servicesEn = ["Qiwa", "Absher Business / Muqeem by entity type", "Zakat, Tax and Customs Authority", "Saudi Business Center", "Mudad", "GOSI", "Balady", "Salamah and Civil Defense", "Chamber of Commerce and attestations", "SPL and National Address", "Platform support tickets"];

const tiers = [
  ["micro", "Micro", "متناهية الصغر", "1-5 employees", "1–5 موظفين", "800", "ابتداءً من 800 ﷼ / شهرياً"],
  ["small", "Small", "صغيرة", "6-49 employees", "6–49 موظفاً", "1500", "ابتداءً من 1,500 ﷼ / شهرياً"],
  ["medium", "Medium", "متوسطة", "50-249 employees", "50–249 موظفاً", "4500", "ابتداءً من 4,500 ﷼ / شهرياً"],
  ["large", "Large", "كبيرة", "250+ employees", "250 موظفاً فأكثر", "7500", "ابتداءً من 7,500 ﷼ / شهرياً"],
];
const extras = [
  ["extra-employees", "Extra employees outside package limit", "إضافة موظفين خارج حد الباقة", "75–250 ﷼"],
  ["extra-branch", "Branch or operating location", "إضافة فرع أو موقع تشغيلي", "500–1,500 ﷼ / شهرياً"],
  ["extra-authority", "Extra government authority or platform", "إضافة جهة أو منصة حكومية خارج نطاق الباقة", "500–2,000 ﷼ / شهرياً"],
  ["balady-licenses", "Balady and municipal licenses", "إضافة بلدي والرخص البلدية", "750–2,000 ﷼ / شهرياً"],
  ["mudad-wps", "Advanced Mudad and WPS", "إضافة مدد وحماية الأجور المتقدمة", "500–1,500 ﷼ / شهرياً"],
  ["advanced-compliance", "Advanced compliance and alerts", "إضافة الامتثال والتنبيهات المتقدمة", "1,500–5,000 ﷼ / شهرياً"],
  ["smart-client-agent", "Smart client service agent", "إضافة الموظف الذكي لخدمات العميل", "1,000–3,000 ﷼ / شهرياً"],
  ["initial-setup", "Initial platform and permissions setup", "إعداد أولي للمنصات والصلاحيات", "يبدأ من 2,500 ﷼ مرة واحدة"],
];
const other = [
  ["foreign-company", "Foreign company formation", "تأسيس الشركات الأجنبية", "Starting from 15,000 SAR", "تبدأ من 15,000 ريال", "15000"],
  ["licenses", "Government licenses", "التراخيص الحكومية", "Fees start from 3,500 SAR", "تبدأ أتعابها من 3,500 ريال", "3500"],
  ["premium-residency", "Premium Residency", "الإقامة المميزة", "Starting from 5,000 SAR", "تبدأ من 5,000 ريال", "5000"],
];

function L(lang, en, ar) { return lang === "ar" ? ar : en; }
function card(lang, row) {
  const [id, en, ar, forEn, forAr, amount, price] = row;
  return `<article class="pk-card" data-group="platforms"><div class="pk-name">${L(lang, en, ar)}</div><div class="pk-price">${price}</div><p>${L(lang, forEn, forAr)}</p><ul>${(lang === "ar" ? servicesAr : servicesEn).map((s) => `<li>${s}</li>`).join("")}</ul><button type="button" class="btn btn-primary pkg-order" data-id="pkg-${id}" data-name-en="${en}" data-name-ar="${ar}" data-amount="${amount}" data-price="${price}">${L(lang, "Request package", "اطلب الباقة")}</button></article>`;
}
function simpleCard(lang, row) {
  const [id, en, ar, priceEn, priceAr, amount] = row;
  return `<article class="pk-card" data-group="${id}"><div class="pk-name">${L(lang, en, ar)}</div><div class="pk-price">${L(lang, priceEn, priceAr)}</div><p>${L(lang, "A consultant reviews scope before payment when needed.", "يراجع المستشار نطاق العمل قبل الدفع عند الحاجة.")}</p><button type="button" class="btn btn-ghost pkg-order" data-id="pkg-${id}" data-name-en="${en}" data-name-ar="${ar}" data-amount="${amount}" data-price="${L(lang, priceEn, priceAr)}">${L(lang, "Request package", "اطلب الباقة")}</button></article>`;
}
function extraCard(lang, row) {
  const [id, en, ar, price] = row;
  return `<article class="pk-card" data-group="addons"><div class="pk-name">${L(lang, en, ar)}</div><div class="pk-price">${price}</div><button type="button" class="btn btn-ghost pkg-order" data-id="pkg-${id}" data-name-en="${en}" data-name-ar="${ar}" data-amount="" data-price="${price}">${L(lang, "Add to request", "أضف للطلب")}</button></article>`;
}
function main(lang) {
  const tabs = [["platforms", "Platform and HR management", "إدارة المنصات والموارد البشرية"], ["foreign-company", "Foreign company formation", "تأسيس الشركات الأجنبية"], ["licenses", "Government licenses", "التراخيص الحكومية"], ["premium-residency", "Premium Residency", "الإقامة المميزة"], ["addons", "Add-ons", "الإضافات"], ["terms", "Terms", "الشروط والأحكام"]];
  const addonChecks = extras.map(([id, en, ar, price]) => `<label class="bp-chk"><input type="checkbox" value="${id}" data-name-en="${en}" data-name-ar="${ar}" data-price="${price}"> ${L(lang, en, ar)} <small>${price}</small></label>`).join("");
  return `<main><section class="hero"><div class="container hero-inner"><span class="eyebrow">${L(lang, "Packages", "الباقات")}</span><h1>${L(lang, "Choose the package that fits your business", "اختر الباقة التي تناسب منشأتك")}</h1><p>${L(lang, "Full platform, HR, government licensing and premium residency packages with a clear checkout path.", "باقات كاملة لإدارة المنصات والموارد البشرية والتراخيص والإقامة المميزة مع مسار شراء واضح.")}</p></div></section><section class="section"><div class="container"><div class="pk-tabs" role="tablist">${tabs.map(([k, en, ar], i) => `<button type="button" class="pk-tab ${i ? "" : "active"}" data-group="${k}">${L(lang, en, ar)}</button>`).join("")}</div><div class="pk-grid">${tiers.map((r) => card(lang, r)).join("")}${other.map((r) => simpleCard(lang, r)).join("")}${extras.map((r) => extraCard(lang, r)).join("")}<article class="pk-card" data-group="terms"><div class="pk-name">${L(lang, "Terms and conditions", "الشروط والأحكام")}</div><ul><li>${L(lang, "Establishments use Absher Business up to 100 workers, then move to Muqeem when the rule applies.", "المؤسسات تستخدم أبشر أعمال حتى 100 عامل، وبعدها يتم الانتقال إلى مقيم عند انطباق القاعدة.")}</li><li>${L(lang, "Companies use Muqeem from day one.", "الشركات تستخدم مقيم من اليوم الأول.")}</li><li>${L(lang, "Government fees and out-of-scope services are billed separately.", "الرسوم الحكومية والخدمات خارج النطاق تحتسب منفصلة.")}</li></ul></article></div></div></section><section class="section section--gray" id="package-order"><div class="container"><div class="order-box package-order-box"><div class="section-head"><span class="eyebrow">${L(lang, "Checkout", "الشراء")}</span><h2>${L(lang, "Complete package request", "أكمل طلب الباقة")}</h2><p>${L(lang, "Choose package, entity type, employees, branches, add-ons, then continue to checkout or quote review.", "اختر الباقة ونوع الكيان وعدد الموظفين والفروع والإضافات، ثم انتقل للدفع أو مراجعة عرض السعر.")}</p></div><form id="package-order-form" class="calc-form"><input type="hidden" id="po-package-id"><input type="hidden" id="po-package-name-en"><input type="hidden" id="po-package-name-ar"><input type="hidden" id="po-package-amount"><input type="hidden" id="po-package-price"><div class="field"><label>${L(lang, "Selected package", "الباقة المختارة")}</label><input id="po-package-label" readonly placeholder="${L(lang, "Pick a package above", "اختر باقة من الأعلى")}"></div><div class="grid-2"><div class="field"><label>${L(lang, "Entity type", "نوع الكيان")}</label><select id="po-entity" required><option value="">${L(lang, "Select", "اختر")}</option><option value="establishment">${L(lang, "Establishment", "مؤسسة")}</option><option value="company">${L(lang, "Company", "شركة")}</option></select></div><div class="field"><label>${L(lang, "Employees", "عدد الموظفين")}</label><input id="po-employees" type="number" min="1" value="1" required></div><div class="field"><label>${L(lang, "Branches", "عدد الفروع")}</label><input id="po-branches" type="number" min="0" value="1" required></div></div><div class="field"><label>${L(lang, "Add-ons", "الإضافات")}</label><div class="bp-chips package-addons">${addonChecks}</div></div><label class="bp-chk package-terms"><input id="po-terms" type="checkbox" required> ${L(lang, "I accept the package terms and checkout conditions.", "أوافق على شروط الباقة وأحكام الشراء.")}</label><button class="btn btn-primary" type="submit">${L(lang, "Continue to checkout", "المتابعة للدفع")}</button><a class="btn btn-ghost" href="${lang === "ar" ? "/ar/account" : "/account"}">${L(lang, "Open Client Portal", "فتح صفحة العميل")}</a><div class="form-success" id="package-order-success" hidden></div></form></div></div></section></main>`;
}
function injectAssets(html) {
  if (!html.includes("packages-flow.css")) html = html.replace("</head>", '<link rel="stylesheet" href="/assets/css/packages-flow.css">\n</head>');
  if (!html.includes("packages-flow.js")) html = html.replace("</body>", '<script src="/assets/js/packages-flow.js"></script>\n</body>');
  return html;
}
function replaceMain(file, lang) {
  let html = fs.readFileSync(file, "utf8");
  html = html.replace(/<main>[\s\S]*?<\/main>/, main(lang));
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
