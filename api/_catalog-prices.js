// Business Partner — دفتر الأسعار الواحد (Price Book).
//
// مصدر واحد نظيف لأي مكان يحتاج «كم سعر هذا الـSKU؟» أو «جدول كل الخدمات
// والأسعار»: عرض السعر، والعقد (الملحق)، والسلة، وتجهيز البنود في اللوحة.
//
// قبل هذا الملف كان كل مكان يقرأ الكتالوج بطريقته:
//   • `api/_simple.js` يقرأ `services.json` عبر `loadCatalog()` ويحوّل السعر
//     الغائب إلى صفر، فيصدر عرضٌ بسطرٍ بـ«٠ ر.س»؛ ولا يعرف الباقات إطلاقاً.
//   • صفحة /catalog كانت تحمل السعر في بياناتها ولا تعرضه لأحد.
//   • لا جدول واحد للأسعار يُرفق بالعرض والعقد.
//
// القواعد التي يفرضها هذا الملف (قرارات المالك في CLAUDE.md §4):
//   • السعر من الكتالوج بالـSKU فقط — لا نخترع سعراً ولا نغيّر قيمة.
//   • السعر المعروض قبل ضريبة القيمة المضافة 15٪ (الضريبة سطرٌ مستقل في العرض).
//   • الرسوم الحكومية مستثناة دائماً وتُسدَّد للجهات بالتكلفة الفعلية.
//   • «حالة السعر» ثلاثٌ لا غير: fixed (سعر ثابت) · quote (حسب العرض) ·
//     unavailable (غير متوفر). ولا يخرج من هنا `fixed` بمبلغٍ صفر أو فارغ أبداً.
//
// المصدر: `site/assets/data/catalog.json` (يُبنى مع كل `npm run build` بعد
// تصفية الإخفاء المركزي site/data/hidden.json). يُقرأ من الملف المضمَّن أولاً ثم
// من النسخة المنشورة، كما تفعل `cartRefs()` في _simple.js.
//
// واجهة الاستعمال (انظر كل دالة أدناه):
//   const book = await loadPriceBook();            // أو buildPriceBook(catalogJson)
//   resolveSku(book, "BP-CHAMBER-01")  → Entry     // لا يُرجع null ولا يرمي
//   annexRows(book, { kinds })         → Entry[]   // مرتّبة بالتصنيف
//   annexGroups(book, { kinds })       → [{key,titleAr,titleEn,rows}]
//   annexHtml(book, { lang })          → string    // قسم HTML جاهز للإلحاق
//   unpricedTable(book)                → [{sku,nameAr,nameEn,status,reasonAr}]
//
// الملفات التي تبدأ بـ«_» داخل api/ لا تُنشَر دالةً على Vercel (سقف ١٢ دالة).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TTL_MS = 5 * 60 * 1000;
let _cache = null;

export const PRICE_STATUS = Object.freeze({ FIXED: "fixed", QUOTE: "quote", UNAVAILABLE: "unavailable" });
export const STATUS_LABEL_AR = Object.freeze({ fixed: "سعر ثابت", quote: "حسب العرض", unavailable: "غير متوفر" });
export const STATUS_LABEL_EN = Object.freeze({ fixed: "Fixed price", quote: "By quotation", unavailable: "Not available" });
export const VAT_RATE = 0.15;

// نصّا التنبيه اللذان يُطبعان مع أي جدول أسعار (القاعدة: الضريبة سطر مستقل
// والرسوم الحكومية مستثناة بالتكلفة الفعلية — «مطبوعة في كل عرض وعقد»).
export const ANNEX_NOTES_AR = Object.freeze([
  "الأسعار بالريال السعودي وهي غير شاملة ضريبة القيمة المضافة 15٪؛ تُضاف الضريبة سطراً مستقلاً ثم يُذكر الإجمالي شاملاً.",
  "الرسوم الحكومية مستثناة دائماً، وتُسدَّد للجهات الحكومية بالتكلفة الفعلية.",
  "الخدمات المصنّفة «حسب العرض» يُحدَّد سعرها في عرض سعر مخصّص بحسب الحالة، ولا سعر ثابتاً لها في الكتالوج.",
]);
export const ANNEX_NOTES_EN = Object.freeze([
  "Prices are in Saudi Riyals and exclude 15% VAT; VAT is shown as a separate line, then the total including VAT.",
  "Government fees are always excluded and are paid to the authorities at actual cost.",
  "Services marked “By quotation” are priced in a tailored quotation; the catalogue carries no fixed price for them.",
]);

const num = (v) => { if (v == null || v === "") return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const round2 = (n) => Math.round(Number(n) * 100) / 100;
const fmt = (n) => {
  const v = round2(n);
  return v.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
};
export const formatAmount = fmt;
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// الوحدة التي تكتبها لافتة السعر بعد الشرطة المائلة: «100 ﷼ / سيرة ذاتية».
const UNIT_EN = {
  "شهرياً": "month", "شهريًا": "month", "سنوياً": "year", "سنويًا": "year",
  "سيرة ذاتية": "CV", "كيان": "entity", "منشأة": "establishment", "لكل مرشّح": "candidate", "لكل مرشح": "candidate",
};
function unitOfLabel(label) {
  const m = /[﷼]\s*\/\s*(.+?)\s*$/.exec(String(label || ""));
  return m ? m[1].trim() : "";
}

// نموذج التسعير في الكتالوج ← هل هو «السعر» نفسه؟
//   One Time / Per Candidate : مبلغ ثابت يصحّ أن يُكتب في عرض سعر آلياً.
//   Monthly                  : مبلغ ثابت لكن دورياً (ليس دفعة واحدة) — يمرّ على إنسان.
//   Starting From            : حدٌّ أدنى لا السعر — يمرّ على إنسان (سياسة _simple.js).
//   Percent / Requires Proposal / بلا مبلغ : حسب العرض.
const AUTO_MODELS = new Set(["One Time", "Per Candidate"]);

function reasonFor({ status, model, label, isFloor, noAmount }) {
  if (status === "unavailable") return "السعر غير مُدرج في الكتالوج";
  if (status === "fixed") return "";
  if (isFloor) return "الكتالوج يحدّد حدّاً أدنى «يبدأ من» لا سعراً نهائياً — السعر النهائي بعرضٍ مخصّص";
  if (model === "Percent") return "تسعيرها نسبة مئوية من قيمة الصفقة لا مبلغ ثابت" + (label ? ` («${label}»)` : "");
  if (model === "Requires Proposal") return "تتطلّب عرض سعر مخصّصاً" + (label ? ` («${label}»)` : "");
  if (noAmount) return "خدمة حسب الطلب — لا مبلغ في الكتالوج" + (label ? ` («${label}»)` : "");
  return "السعر يُحدَّد بعرض مخصّص";
}

// نصّ السعر كما يُطبع. `cur` رمز العملة: «ر.س» في الوثائق (افتراضي) و«﷼» في صفحات الموقع.
// الحدّ الأدنى يُكتب «يبدأ من …»، والحسب-العرض بلا مبلغ يُكتب بلافتة الكتالوج نفسها.
export function priceText(e, lang = "ar", cur = "") {
  const ar = lang === "ar";
  const sym = cur || (ar ? "ر.س" : "SAR");
  const u = e.unit ? (ar ? e.unit : (UNIT_EN[e.unit] || e.unit)) : "";
  if (e.amount != null && (e.status === "fixed" || e.isFloor)) {
    const n = fmt(e.amount);
    let tail = "";
    if (u) tail = ` / ${u}`;
    else if (e.period === "monthly") tail = ar ? " / شهرياً" : " / month";
    else if (e.period === "yearly") tail = ar ? " / سنوياً" : " / year";
    const body = ar ? `${n} ${sym}${tail}` : `${sym === "SAR" ? "SAR " : ""}${n}${sym === "SAR" ? "" : " " + sym}${tail}`;
    return e.isFloor ? (ar ? `يبدأ من ${body}` : `From ${body}`) : body;
  }
  if (e.status === "quote") return ar ? (e.priceLabelAr || "حسب العرض") : "By quotation";
  return ar ? "غير متوفر" : "Not available";
}

// صفّ الكتالوج ← مدخل موحّد. `kind`: service · package · ai-plan · trip.
function entryFrom(kind, row, extra = {}) {
  const sku = String(row.code || row.sku || "").trim();
  const amount = num(row.amount);
  const label = String(row.priceLabelAr || row.priceLabel || "").trim();
  let model = String(row.pricingModel || "");
  let period = "one_time";
  let isFloor = false;

  if (kind === "package") {
    // الباقة: مدّتها في billingPeriod، و«تبدأ من …» في لافتتها تعني حدّاً أدنى.
    period = row.billingPeriod === "monthly" ? "monthly" : row.billingPeriod === "yearly" ? "yearly" : "one_time";
    isFloor = /^\s*(تبدأ|يبدأ)\s*من|^\s*from\b/i.test(label);
    model = amount == null ? "Requires Proposal" : isFloor ? "Starting From" : period === "monthly" ? "Monthly" : "One Time";
  } else if (kind === "ai-plan") {
    period = row.billingPeriod === "monthly" ? "monthly" : "one_time";
    model = "Monthly";
  } else {
    if (model === "Monthly") period = "monthly";
    isFloor = model === "Starting From";
  }

  const hasAmount = amount != null && amount > 0;
  const labelled = !!label || model === "Percent" || model === "Requires Proposal" || !!row.requiresProposal;
  let status;
  if (amount != null && amount <= 0) status = PRICE_STATUS.UNAVAILABLE; // مبلغٌ صفر أو سالب ليس سعراً
  else if (hasAmount) status = isFloor ? PRICE_STATUS.QUOTE : PRICE_STATUS.FIXED;
  else status = sku && labelled ? PRICE_STATUS.QUOTE : PRICE_STATUS.UNAVAILABLE;

  const unit = unitOfLabel(label);
  const base = {
    sku,
    kind,
    nameAr: String(row.nameAr || row.nameEn || "").trim(),
    nameEn: String(row.nameEn || row.nameAr || "").trim(),
    category: String(row.category || row.group || "").trim(),
    categoryAr: String(row.categoryAr || row.groupNameAr || "").trim(),
    status,
    statusAr: STATUS_LABEL_AR[status],
    statusEn: STATUS_LABEL_EN[status],
    // السعر قبل الضريبة. للحدّ الأدنى («يبدأ من») هو الحدّ، وللحسب-العرض بلا مبلغ null.
    amount: hasAmount ? amount : null,
    isFloor: hasAmount && isFloor,
    period,
    unit,
    model,
    // يصحّ كتابته في عرض سعر دون إنسان: ثابتٌ ودفعة واحدة (سياسة _simple.js).
    autoQuotable: status === PRICE_STATUS.FIXED && (kind === "service" || kind === "trip") && AUTO_MODELS.has(model) && period === "one_time",
    govFeesSeparate: row.govFeesSeparate !== false,
    requiresProposal: !!row.requiresProposal,
    priceLabelAr: label,
    url: String(row.url || ""),
    ...extra,
  };
  base.priceTextAr = priceText(base, "ar");
  base.priceTextEn = priceText(base, "en");
  base.reasonAr = reasonFor({ status, model, label, isFloor: base.isFloor, noAmount: amount == null });
  return Object.freeze(base);
}

// يبني الدفتر من محتوى catalog.json. نقيّ: لا شبكة ولا قراءة ملف.
export function buildPriceBook(catalog) {
  const c = catalog && typeof catalog === "object" ? catalog : {};
  const list = [];
  const bySku = new Map();
  const byKey = new Map(); // مفتاح الباقة القصير («silver»…)
  const add = (e, key) => {
    if (!e.sku) return;
    list.push(e);
    bySku.set(e.sku.toUpperCase(), e);
    if (key) byKey.set(String(key).toUpperCase(), e);
  };
  for (const s of Array.isArray(c.services) ? c.services : []) add(entryFrom("service", s));
  for (const p of Array.isArray(c.packages) ? c.packages : []) add(entryFrom("package", p, { groupAr: String(p.groupNameAr || ""), groupEn: String(p.groupNameEn || "") }), p.key);
  for (const a of Array.isArray(c.aiPlans) ? c.aiPlans : []) add(entryFrom("ai-plan", { ...a, category: "AI Automation", categoryAr: "الأتمتة والذكاء الاصطناعي", requiresProposal: false, govFeesSeparate: false }));
  for (const t of Array.isArray(c.trips) ? c.trips : []) add(entryFrom("trip", t));
  const categories = (Array.isArray(c.categories) ? c.categories : []).map((x) => ({ key: x.key, nameAr: x.nameAr, nameEn: x.nameEn }));
  return Object.freeze({ updatedAt: c.updatedAt || "", currency: c.currency || "SAR", categories, list: Object.freeze(list), bySku, byKey });
}

// معرّفٌ كما تكتبه الصفحات: «svc-bp-chamber-01» · «pkg-BP-PKG-LAUNCH-monthly» · «silver».
function normalizeId(id) {
  let raw = String(id == null ? "" : id).trim().toUpperCase();
  raw = raw.replace(/-(MONTHLY|YEARLY)$/, "");
  return { raw, bare: raw.replace(/^(SVC|PKG)-/, "") };
}

// يحلّ أي معرّف إلى مدخل. لا يُرجع null ولا يرمي: المجهول يعود `unavailable`
// بسببٍ مكتوب، فلا يتحوّل غياب السعر إلى صفرٍ صامت في أي وثيقة.
export function resolveSku(book, id) {
  const { raw, bare } = normalizeId(id);
  const hit = book && (book.bySku.get(raw) || book.bySku.get(bare) || book.byKey.get(bare) || book.byKey.get(raw));
  if (hit) return hit;
  const sku = String(id == null ? "" : id).trim();
  return Object.freeze({
    sku, kind: "unknown", nameAr: "", nameEn: "", category: "", categoryAr: "",
    status: PRICE_STATUS.UNAVAILABLE, statusAr: STATUS_LABEL_AR.unavailable, statusEn: STATUS_LABEL_EN.unavailable,
    amount: null, isFloor: false, period: "one_time", unit: "", model: "", autoQuotable: false,
    govFeesSeparate: true, requiresProposal: false, priceLabelAr: "", url: "",
    priceTextAr: "غير متوفر", priceTextEn: "Not available", reasonAr: "الرمز غير موجود في الكتالوج",
  });
}

// السعر الذي يصحّ كتابته في سطر عرض سعر (قبل الضريبة)، أو null إن كان يحتاج إنساناً.
// لا يُرجع صفراً أبداً.
export function quotablePrice(book, id) {
  const e = resolveSku(book, id);
  return e.status === PRICE_STATUS.FIXED && e.amount > 0 ? e.amount : null;
}

// السعر المرجعي لبندٍ يُجهَّز في اللوحة (يملأ الحقل الفارغ): مبلغ الكتالوج إن وُجد
// (حتى الحدّ الأدنى والاشتراك الشهري)، وإلا null. ليس قراراً — إنسانٌ يعتمده.
export function referencePrice(book, id) {
  const e = resolveSku(book, id);
  return e.amount != null && e.amount > 0 ? e.amount : null;
}

const DEFAULT_KINDS = ["service", "package", "ai-plan"];

// الصفوف بترتيب الكتالوج: التصنيفات حسب `categories` ثم الرمز. الباقات بعد الخدمات.
export function annexRows(book, { kinds = DEFAULT_KINDS, onlyStatus = null } = {}) {
  if (!book) return [];
  const want = new Set(kinds);
  const order = new Map((book.categories || []).map((c, i) => [c.key, i]));
  const rank = (e) => (e.kind === "service" ? (order.has(e.category) ? order.get(e.category) : 99) : e.kind === "package" ? 100 : e.kind === "ai-plan" ? 101 : 102);
  return book.list
    .filter((e) => want.has(e.kind) && (!onlyStatus || e.status === onlyStatus))
    .slice()
    .sort((a, b) => rank(a) - rank(b) || a.sku.localeCompare(b.sku));
}

export function annexGroups(book, opts = {}) {
  const rows = annexRows(book, opts);
  const groups = [];
  const cat = new Map((book && book.categories || []).map((c) => [c.key, c]));
  for (const e of rows) {
    let key, titleAr, titleEn;
    if (e.kind === "service") { key = e.category; const c = cat.get(e.category); titleAr = (c && c.nameAr) || e.categoryAr || e.category; titleEn = (c && c.nameEn) || e.category; }
    else if (e.kind === "package") { key = "pkg:" + (e.groupAr || ""); titleAr = "الباقات" + (e.groupAr ? " — " + e.groupAr : ""); titleEn = "Packages" + (e.groupEn ? " — " + e.groupEn : ""); }
    else if (e.kind === "ai-plan") { key = "ai-plan"; titleAr = "باقات Business Partner AI"; titleEn = "Business Partner AI plans"; }
    else { key = e.kind; titleAr = e.kind; titleEn = e.kind; }
    let g = groups.find((x) => x.key === key);
    if (!g) { g = { key, titleAr, titleEn, rows: [] }; groups.push(g); }
    g.rows.push(e);
  }
  return groups;
}

// الخدمات التي بلا سعر ثابت: جدول القرار لوكيل التسعير. (SKU، الاسم، الحالة، السبب)
export function unpricedTable(book, { kinds = ["service", "package", "ai-plan"] } = {}) {
  return annexRows(book, { kinds })
    .filter((e) => e.status !== PRICE_STATUS.FIXED)
    .map((e) => ({
      sku: e.sku, kind: e.kind, nameAr: e.nameAr, nameEn: e.nameEn, categoryAr: e.categoryAr || e.groupAr || "",
      status: e.status, amount: e.amount, catalogLabel: e.priceLabelAr, reasonAr: e.reasonAr,
    }));
}

export function priceStats(book, { kinds = DEFAULT_KINDS } = {}) {
  const out = { total: 0, fixed: 0, quote: 0, unavailable: 0, floor: 0, monthly: 0 };
  for (const e of annexRows(book, { kinds })) {
    out.total++;
    out[e.status]++;
    if (e.isFloor) out.floor++;
    if (e.period === "monthly" && e.status === PRICE_STATUS.FIXED) out.monthly++;
  }
  return out;
}

const CSS = `<style>
.bp-price-annex{font-family:inherit;color:#1F2430;margin:0}
.bp-price-annex h2{font-size:15pt;margin:0 0 4pt}
.bp-price-annex h3{font-size:11.5pt;margin:12pt 0 4pt;break-after:avoid}
.bp-price-annex .meta{font-size:9pt;color:#5b6272;margin:0 0 8pt}
.bp-price-annex table{width:100%;border-collapse:collapse;font-size:9.5pt}
.bp-price-annex th,.bp-price-annex td{border:1px solid #d9deea;padding:4pt 6pt;text-align:start;vertical-align:top}
.bp-price-annex th{background:#f1f3f9;font-weight:700}
.bp-price-annex td.sku{font-family:monospace;white-space:nowrap;font-size:8.5pt}
.bp-price-annex td.amt{white-space:nowrap;font-variant-numeric:tabular-nums}
.bp-price-annex thead{display:table-header-group}
.bp-price-annex tr{break-inside:avoid}
.bp-price-annex ul.notes{margin:8pt 0 0;padding-inline-start:16pt;font-size:9pt;line-height:1.7}
.bp-price-annex .st-quote,.bp-price-annex .st-unavailable{color:#5b6272}
</style>`;

// قسم HTML جاهز للإلحاق بالعرض أو العقد. lang: ar (الافتراضي) · en · bi (عمودان).
// كل النصوص مهرَّبة؛ لا سكربت ولا مورد خارجي.
export function annexHtml(book, { lang = "ar", kinds = DEFAULT_KINDS, title = "", withStyle = true, vatRate = 15 } = {}) {
  const L = lang === "en" ? "en" : lang === "bi" ? "bi" : "ar";
  const groups = annexGroups(book, { kinds });
  const bi = L === "bi";
  const dir = L === "en" ? "ltr" : "rtl";
  const heading = title || (L === "en" ? "Annex — Services & prices schedule" : bi ? "ملحق — جدول الخدمات والأسعار / Services & prices schedule" : "ملحق — جدول الخدمات والأسعار");
  const notes = (L === "en" ? ANNEX_NOTES_EN : bi ? ANNEX_NOTES_AR.map((a, i) => `${a} / ${ANNEX_NOTES_EN[i]}`) : ANNEX_NOTES_AR)
    .map((n) => n.replace("15%", vatRate + "%").replace("15٪", vatRate + "٪"));
  const th = L === "en" ? ["SKU", "Service", "Price (excl. VAT)", "Status"]
    : bi ? ["الرمز SKU", "الخدمة / Service", "السعر قبل الضريبة / Price excl. VAT", "الحالة / Status"]
    : ["الرمز", "الخدمة", "السعر قبل الضريبة", "الحالة"];
  const name = (e) => (L === "en"
    ? esc(e.nameEn || e.nameAr)
    : bi ? esc(e.nameAr) + (e.nameEn && e.nameEn !== e.nameAr ? `<br><span class="en">${esc(e.nameEn)}</span>` : "") : esc(e.nameAr));
  const price = (e) => (L === "en" ? esc(e.priceTextEn) : bi ? `${esc(e.priceTextAr)}<br><span class="en">${esc(e.priceTextEn)}</span>` : esc(e.priceTextAr));
  const stat = (e) => (L === "en" ? esc(e.statusEn) : bi ? `${esc(e.statusAr)} / ${esc(e.statusEn)}` : esc(e.statusAr));
  const body = groups.map((g) => `<h3>${esc(L === "en" ? g.titleEn : bi ? `${g.titleAr} / ${g.titleEn}` : g.titleAr)}</h3>
<table><thead><tr>${th.map((x) => `<th>${esc(x)}</th>`).join("")}</tr></thead><tbody>${g.rows.map((e) => `<tr><td class="sku">${esc(e.sku)}</td><td>${name(e)}</td><td class="amt st-${e.status}">${price(e)}</td><td class="st-${e.status}">${stat(e)}</td></tr>`).join("")}</tbody></table>`).join("\n");
  const stamp = book && book.updatedAt ? String(book.updatedAt).slice(0, 10) : "";
  return `${withStyle ? CSS : ""}<section class="bp-price-annex" dir="${dir}" lang="${L === "en" ? "en" : "ar"}">
<h2>${esc(heading)}</h2>
<p class="meta">${esc(L === "en" ? "Source: Business Partner catalogue" : "المصدر: كتالوج Business Partner")}${stamp ? ` · ${esc(stamp)}` : ""}</p>
<ul class="notes">${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
${body}
</section>`;
}

// ------------------------------------------------------------------ التحميل --
const SITE_BASE = (process.env.MKT_SITE_BASE || "https://www.businesspartner.sa").replace(/\/+$/, "");

async function readCatalogJson() {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    return JSON.parse(fs.readFileSync(path.join(here, "..", "site", "assets", "data", "catalog.json"), "utf8"));
  } catch { /* لا نسخة مضمَّنة مع الدالة — تُقرأ المنشورة */ }
  const r = await fetch(`${SITE_BASE}/assets/data/catalog.json`, { cache: "no-store" });
  if (!r.ok) throw new Error("catalog_fetch_failed");
  return r.json();
}

export async function loadPriceBook() {
  if (_cache && Date.now() - _cache.at < TTL_MS) return _cache.book;
  const book = buildPriceBook(await readCatalogJson());
  _cache = { at: Date.now(), book };
  return book;
}

// نسخة متزامنة من الملف المضمَّن (للمولّدات وسكربتات البناء). ترمي إن غاب الملف.
export function loadPriceBookSync(file) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const p = file || path.join(here, "..", "site", "assets", "data", "catalog.json");
  return buildPriceBook(JSON.parse(fs.readFileSync(p, "utf8")));
}
