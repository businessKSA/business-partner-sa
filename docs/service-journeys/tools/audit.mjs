// Business Partner — تدقيق رحلة الخدمات والباقات (قراءة فقط، من المبني في site/).
// الاستعمال:  node docs/service-journeys/tools/audit.mjs [--md]
// يطبع JSON بالأرقام، و--md يكتب docs/service-journeys/audit.md من الأرقام نفسها.
// المعايير الخمسة (.claude/agents/service-journey.md):
//   c1 التصميم SV1 كاملاً · c2 الربط بالسلة/التفاصيل · c3 اكتمال الرحلة
//   c4 المستندات + الجهة + المنصة + الرسوم منفصلة · c5 المصدر (source_url + verified_at)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SITE = path.join(ROOT, "site");
const LANGS = ["ar", "en", "fr", "zh"];
const read = (p) => fs.readFileSync(p, "utf8");
const catalog = JSON.parse(read(path.join(SITE, "assets/data/catalog.json")));
const siteJson = JSON.parse(read(path.join(SITE, "data/site.json")));
const JDIR = path.join(SITE, "data/service-journeys");
const journeyOf = (code) => {
  const f = path.join(JDIR, code.toLowerCase() + ".json");
  return fs.existsSync(f) ? JSON.parse(read(f)) : null;
};
const pageFile = (lang, rel) => path.join(SITE, lang === "en" ? "" : lang, rel + ".html");
const slugOf = (s) => s.code.toLowerCase();
const priced = (s) => s.amount != null && s.category !== "Real Estate" && s.category !== "Tourism";

function mainOf(html) {
  const a = html.indexOf("<main"), b = html.indexOf("</main>");
  return a >= 0 && b > a ? html.slice(a, b) : "";
}
function resolves(href) {
  const p = href.split("#")[0].split("?")[0];
  if (!p || /^(https?:|mailto:|tel:|javascript:)/.test(p)) return true;
  if (p.startsWith("/api/") || p.startsWith("/assets/")) return true;
  const rel = p.replace(/^\//, "").replace(/\/$/, "");
  const cands = [rel + ".html", rel + "/index.html", rel === "" ? "index.html" : "\0"];
  return cands.some((c) => fs.existsSync(path.join(SITE, c)));
}

// ---- فحص صفحة خدمة واحدة بلغة واحدة
function checkService(s, lang) {
  const file = pageFile(lang, "services/" + slugOf(s));
  const r = { code: s.code, lang, fails: {} };
  const fail = (c, why) => ((r.fails[c] ||= []).push(why));
  if (!fs.existsSync(file)) { fail("c1", "الصفحة غير مبنية"); return r; }
  const html = read(file), main = mainOf(html);
  const body = (html.match(/<body[^>]*>/) || [""])[0];
  // c1
  if (!/class="sv1-page"/.test(body)) fail("c1", "ليس body.sv1-page");
  if (/\/assets\/js\/main\.js/.test(html)) fail("c1", "يحمّل main.js");
  if (/bp-public-brand-v5/.test(html)) fail("c1", "طبقة brand-v5 القديمة");
  if (/href="(\/[a-z]{2})?\/(account|admin)(["/?#])/.test(main)) fail("c1", "رابط للموقع القديم داخل المحتوى");
  if (/wa\.me|api\.whatsapp\.com/.test(main)) fail("c1", "واتساب داخل المحتوى");
  // c2
  const hasAdd = /id="svcAdd"/.test(main), hasQuote = /id="svcQuote"/.test(main);
  if (priced(s)) {
    if (!hasAdd) fail("c2", "مسعّرة بلا زر سلة");
    else {
      if (!html.includes(`data-id="svc-${slugOf(s)}"`)) fail("c2", "معرّف عنصر السلة ≠ svc-<slug>");
      if (!html.includes(`data-amount="${s.amount}"`)) fail("c2", "مبلغ الزر ≠ الكتالوج");
      if (!html.includes("bp_cart")) fail("c2", "لا عقد bp_cart");
    }
    // قرار المالك 2026-10-16: المسعّرة شراء مباشر بالسلة ولو requiresProposal — لا زرّ عرض سعر يزاحمه،
    // ولا سؤال يَعِد بعرض مخصّص، وبعد الدفع يظهر ما سيحدث.
    if (hasQuote) fail("c2", "خدمة مسعّرة فيها زر عرض سعر");
    if (!/sv1-svc-after/.test(main)) fail("c3", "لا قسم «بعد الدفع» للمسعّرة");
    if (/عرض مخصّص|اطلب عرضاً|tailored proposal|request a quote/i.test(main)) fail("c2", "نص يَعِد بعرض سعر في خدمة مسعّرة");
  } else if (!hasQuote && !/workspace-request|\/tourism/.test(main)) fail("c2", "بلا مسار شراء ولا عرض");
  const bad = [...new Set([...main.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).filter((h) => !resolves(h)))];
  if (bad.length) fail("c2", "روابط لا تُحَل: " + bad.slice(0, 3).join(" "));
  // c3: قسم خطوات الرحلة (ينفّذ كل خطوة من، مدة، حالة ما بعد الشراء)
  if (!/sv1-svc-steps/.test(main)) fail("c3", "لا قسم خطوات الرحلة موثّقة");
  // c4
  const ov = siteJson.overrides[slugOf(s)] || {};
  if (!(ov.documents || ov.documentsEn)) fail("c4", "مستندات عامة (٣ بنود افتراضية)");
  const hasAuth = s.govPlatform && !/بدون جهة/.test(s.govPlatform);
  if (hasAuth && !/<dt>(الجهة|Authority|Autorité|办理机构)/.test(main)) fail("c4", "الجهة غائبة من الصفحة");
  if (!ov.duration) fail("c4", "المدة غائبة");
  if (priced(s) && !/sv1-svc-note price-amt/.test(main)) fail("c4", "ملاحظة الرسوم الحكومية/الضريبة غائبة");
  else if (priced(s) && s.govFeesSeparate) {
    const note = (main.match(/<p class="sv1-svc-note price-amt">([^<]*)<\/p>/) || ["", ""])[1];
    if (!/الرسوم الحكومية|government fees|frais gouvernementaux|政府规费/.test(note)) fail("c4", "الرسوم الحكومية لا تُذكر منفصلة في ملاحظة السعر");
  }
  // c5
  const j = journeyOf(s.code);
  if (!j) fail("c5", "لا ملف رحلة");
  else {
    const claims = [j.authority, j.duration, j.documents, j.gov_fees].filter(Boolean);
    const unv = claims.filter((c) => !(c.source_url && c.verified_at && c.status === "verified"));
    if (unv.length || !claims.length) fail("c5", "معلومة حكومية بلا مصدر موثّق");
  }
  return r;
}

function checkCategory(cat, lang) {
  const file = pageFile(lang, "services/category/" + cat.slug);
  const r = { code: "category:" + cat.slug, lang, fails: {} };
  const fail = (c, why) => ((r.fails[c] ||= []).push(why));
  if (!fs.existsSync(file)) { fail("c1", "غير مبنية"); return r; }
  const html = read(file), main = mainOf(html);
  if (!/class="sv1-page"/.test((html.match(/<body[^>]*>/) || [""])[0])) fail("c1", "ليس body.sv1-page");
  if (/\/assets\/js\/main\.js/.test(html) || /bp-public-brand-v5/.test(html)) fail("c1", "طبقة قديمة");
  const bad = [...new Set([...main.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).filter((h) => !resolves(h)))];
  if (bad.length) fail("c2", "روابط لا تُحَل: " + bad.slice(0, 3).join(" "));
  r.na = ["c3", "c4", "c5"];
  return r;
}

// ---- الباقات
function checkPackages(lang) {
  const file = pageFile(lang, "packages");
  const r = { code: "packages", lang, fails: {} };
  const fail = (c, why) => ((r.fails[c] ||= []).push(why));
  if (!fs.existsSync(file)) { fail("c1", "غير مبنية"); return r; }
  const html = read(file), body = (html.match(/<body[^>]*>/) || [""])[0];
  if (!/sv1-page/.test(body)) fail("c1", "ليس body.sv1-page");
  if (/\/assets\/js\/main\.js/.test(html)) fail("c1", "يحمّل main.js");
  if (/bp-public-brand-v5/.test(html)) fail("c1", "طبقة brand-v5 القديمة");
  for (const p of catalog.packages) {
    const id = p.code.toLowerCase();
    if (!html.includes(p.code) && !html.includes(id) && !html.includes(p.key)) fail("c2", "الباقة غير ظاهرة: " + p.code);
  }
  if (!/bp_cart/.test(html)) fail("c2", "لا عقد bp_cart");
  r.na = ["c4"];
  fail("c3", "لا خطوات رحلة للباقات");
  fail("c5", "لا مصدر/تاريخ تحقق");
  return r;
}

const rows = [];
for (const lang of LANGS) for (const s of catalog.services) rows.push(checkService(s, lang));
const cats = [...new Set(fs.readdirSync(path.join(SITE, "services/category")).map((f) => f.replace(/\.html$/, "")))].map((slug) => ({ slug }));
for (const lang of LANGS) for (const c of cats) rows.push(checkCategory(c, lang));
for (const lang of LANGS) rows.push(checkPackages(lang));

const kinds = { service: (r) => !r.code.startsWith("category:") && r.code !== "packages", category: (r) => r.code.startsWith("category:"), packages: (r) => r.code === "packages" };
const svcs = catalog.services;
const commercial = {
  pricedAndRequiresProposal: svcs.filter((s) => priced(s) && s.requiresProposal).length,
  pricedOnly: svcs.filter((s) => priced(s) && !s.requiresProposal).length,
  unpriced: svcs.filter((s) => !priced(s)).length,
  withGovAuthority: svcs.filter((s) => s.govPlatform && !/بدون جهة/.test(s.govPlatform)).length,
  govFeesSeparateFlag: svcs.filter((s) => s.govFeesSeparate).length,
  withCuratedDocuments: svcs.filter((s) => { const o = siteJson.overrides[s.code.toLowerCase()]; return o && (o.documents || o.documentsEn); }).length,
  withDuration: svcs.filter((s) => { const o = siteJson.overrides[s.code.toLowerCase()]; return o && o.duration; }).length,
};
const out = { commercial, generatedAt: new Date().toISOString().slice(0, 10), services: catalog.services.length, packagesInCatalog: catalog.packages.length, summary: {}, failing: {} };
for (const [k, f] of Object.entries(kinds)) {
  const set = rows.filter(f);
  const sum = { pages: set.length };
  for (const c of ["c1", "c2", "c3", "c4", "c5"]) {
    const app = set.filter((r) => !(r.na || []).includes(c));
    sum[c] = app.length ? { pass: app.filter((r) => !r.fails[c]).length, fail: app.filter((r) => r.fails[c]).length } : "n/a";
  }
  out.summary[k] = sum;
  out.failing[k] = {};
  for (const c of ["c1", "c2", "c3", "c4", "c5"]) {
    const reasons = {};
    for (const r of set) for (const w of r.fails[c] || []) (reasons[w.replace(/: .*/, "")] ||= new Set()).add(r.lang === "ar" ? r.code : r.code + "@" + r.lang);
    out.failing[k][c] = Object.fromEntries(Object.entries(reasons).map(([w, s]) => [w, { count: s.size, sample: [...s].slice(0, 6) }]));
  }
}
if (process.argv.includes("--md")) {
  fs.writeFileSync(path.join(ROOT, "docs/service-journeys/audit-data.json"), JSON.stringify(out, null, 1) + "\n");
}
console.log(JSON.stringify(out, null, 1));
