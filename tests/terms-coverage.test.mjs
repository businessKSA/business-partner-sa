// الشروط والأحكام (أمر المالك 2026-11-02، البند 8): لكل خدمة وباقة ورحلة شروط.
//
// يفشل هذا الاختبار حين:
//   • يُضاف SKU إلى الكتالوج (خدمة أو باقة أو رحلة أو باقة ذكاء) ولا يُربط بفئة في
//     site/assets/data/terms.json → هذه هي «الخدمة بلا شروط» التي جاء منها البند.
//   • تفقد فئة لغةً من اللغات الأربع (ar/en/fr/zh)، أو يُحال إلى بند مشترك غير موجود.
//   • يظهر في النص رقم مادة نظامية («المادة 12» / «Article 12»): لا يُكتب رقم مادة ولا
//     سابقة في هذا الملف أبداً — استشهاد مخترَع أخطر ما قد ينتجه ملف قانوني.
//   • يتخلف terms-index.json عن terms.json (يُولَّد بالبناء: npm run build).
//   • تعجز بوابة terms-gate عن حلّ معرّفات السلة الفعلية (svc-/pkg-/employee-… إلخ).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadTermsData, buildTermsIndex, termsForSku, termsForCart, termsForPage, resolveSku, termsGateClientSource } from "../site/scripts/terms-gate.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const data = loadTermsData();
const catalog = read("site/assets/data/catalog.json");
const LANGS = ["ar", "en", "fr", "zh"];
const catIds = new Set(data.categories.map((c) => c.id));

const sellable = [
  ...catalog.services.map((s) => ["service", s.code]),
  ...catalog.packages.filter((p) => p.code).map((p) => ["package", p.code]),
  ...catalog.trips.map((t) => ["trip", t.code]),
  ...catalog.aiPlans.map((a) => ["aiPlan", a.code]),
];

function walkStrings(o, f, trail = "") {
  if (typeof o === "string") f(o, trail);
  else if (Array.isArray(o)) o.forEach((x, i) => walkStrings(x, f, `${trail}[${i}]`));
  else if (o && typeof o === "object") for (const k of Object.keys(o)) walkStrings(o[k], f, `${trail}.${k}`);
}

test("كل SKU في الكتالوج مربوط بفئة موجودة", () => {
  const missing = sellable.filter(([, code]) => !data.skus[code]).map(([k, c]) => `${k}:${c}`);
  assert.deepEqual(missing, [], "SKU بلا فئة شروط في terms.json (skus)");
  const dangling = Object.entries(data.skus).filter(([, c]) => !catIds.has(c)).map(([k, c]) => `${k}→${c}`);
  assert.deepEqual(dangling, [], "SKU مربوط بفئة غير موجودة");
});

test("لكل فئة وبند الشروط العامة اللغات الأربع", () => {
  const need = (o, where, min = 2) => { for (const l of LANGS) assert.ok(o && typeof o[l] === "string" && o[l].trim().length >= min, `${where} ينقصه ${l}`); };
  for (const s of data.general.sections) { need(s.title, s.id); s.items.forEach((i, n) => need(i, `${s.id}#${n + 1}`)); }
  for (const [id, c] of Object.entries(data.clauses)) need(c, `clause ${id}`);
  for (const c of data.categories) {
    need(c.title, `${c.id}.title`); need(c.summary, `${c.id}.summary`);
    assert.ok(c.items.length >= 3, `${c.id}: أقل من ثلاثة بنود`);
    c.items.forEach((i, n) => need(i, `${c.id}#${n + 1}`));
    for (const u of c.uses || []) assert.ok(data.clauses[u], `${c.id}: بند مشترك غير موجود ${u}`);
  }
  for (const k of ["general", "single", "multi"]) need(data.consent[k], `consent.${k}`);
  need(data.consent.joiner, "consent.joiner", 1);
  need(data.intro, "intro"); need(data.updated, "updated");
});

test("معرّفات الفئات فريدة والمراسي صالحة", () => {
  assert.equal(catIds.size, data.categories.length, "معرّف فئة مكرر");
  for (const id of catIds) assert.match(id, /^[a-z][a-z0-9-]*$/, `معرّف غير صالح للمرساة: ${id}`);
});

test("لا أرقام مواد نظامية ولا سوابق مخترَعة ولا أسرار", () => {
  const bad = [];
  walkStrings(data, (s, trail) => {
    if (/(?:المادة|مادة)\s*[\(٠-٩\d]/.test(s) || /\bArticle\s+\d/i.test(s) || /\bArt\.\s*\d/i.test(s)) bad.push(trail);
    if (/(sk-[A-Za-z0-9]{16,}|SA\d{22}|eyJ[A-Za-z0-9_-]{20,})/.test(s)) bad.push("secret:" + trail);
  });
  assert.deepEqual(bad, []);
});

test("terms-index.json مطابق لـterms.json (يُولَّد بالبناء)", () => {
  const idx = read("site/assets/data/terms-index.json");
  assert.deepEqual(idx, buildTermsIndex(data), "شغّل npm run build ثم أضف terms-index.json");
});

test("البوابة تحلّ معرّفات السلة الفعلية", () => {
  const cases = [
    ["svc-bp-sbc-01", "formation"], ["SVC-BP-HRSD-04", "violations"], ["pkg-silver", "managed"], ["pkg-foreign-formation", "pkgformation"],
    ["pkg-basic-legal", "pkglegal"], ["BP-TRIP-HORSE-TRACK", "trips"], ["svc-bp-aiws-ind", "digital"], ["employer-plan-pro-monthly", "digital"],
    ["employee-hr", "digital"], ["agent-compliance", "digital"], ["agent-shared-services", "digital"], ["companies-data-access", "digital"],
    ["revos-launch", "bizdev"], ["BP-REC-03", "eor"], ["BP-PL-0051", "bank"],
  ];
  for (const [id, cat] of cases) {
    const r = termsForSku(data, { id }, "ar");
    assert.equal(r.matched, true, id);
    assert.equal(r.category, cat, id);
    assert.ok(r.url.startsWith("/ar/terms#cat-"), r.url);
    assert.ok(r.consentText.includes(r.categoryTitle), "جملة الموافقة تسمّي الفئة: " + id);
  }
  for (const [kind, code] of sellable) {
    const viaCart = termsForSku(data, { id: kind === "package" ? "pkg-" + (catalog.packages.find((p) => p.code === code).key) : "svc-" + code.toLowerCase(), kind }, "en");
    assert.equal(viaCart.matched, true, `${kind} ${code} لا يُحلّ من معرّف السلة`);
    assert.equal(viaCart.category, data.skus[code], `${kind} ${code}`);
  }
});

test("بند مجهول لا يرمي ويرجع الشروط العامة وحدها", () => {
  const r = termsForSku(data, "svc-zzz-never-existed", "ar");
  assert.equal(r.matched, false);
  assert.equal(r.category, null);
  assert.equal(r.url, "/ar/terms#general");
  assert.equal(termsForSku(data, null, "en").matched, false);
  assert.equal(termsForSku(data, { id: "" }, "en").matched, false);
  assert.equal(resolveSku(data, undefined).matched, false);
});

test("سلة مختلطة: جملة موافقة واحدة تسمّي كل فئة مرة واحدة", () => {
  const c = termsForCart(data, [{ id: "svc-bp-sbc-01" }, { id: "svc-bp-sbc-02" }, { id: "pkg-gold" }, { id: "svc-unknown" }], "ar");
  assert.deepEqual(c.categories.map((x) => x.id), ["formation", "managed"]);
  assert.deepEqual(c.unmatched, ["svc-unknown"]);
  assert.ok(c.consentText.includes(c.categories[0].title) && c.consentText.includes(c.categories[1].title));
  assert.equal(termsForCart(data, [], "en").consentText, data.consent.general.en);
});

test("الصفحات بلا بند كتالوج (فارينا…) لها فئة", () => {
  assert.equal(termsForPage(data, "/farina", "ar").category, "farina");
  assert.equal(termsForPage(data, "/ar/farina/", "ar").category, "farina");
  assert.equal(termsForPage(data, "/fr/worker-housing", "fr").url, "/fr/terms#cat-housing");
  assert.equal(termsForPage(data, "/nowhere", "en").matched, false);
});

test("نسخة المتصفح من البوابة تعمل وتعطي النتيجة نفسها", async () => {
  const vm = await import("node:vm");
  const ctx = { window: {} };
  vm.runInNewContext(termsGateClientSource(), ctx);
  const idx = buildTermsIndex(data);
  const a = ctx.window.BPTermsGate.termsForSku(idx, { id: "svc-bp-pr-04" }, "zh");
  const b = termsForSku(data, { id: "svc-bp-pr-04" }, "zh");
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
});

test("الصفحة المبنية فيها مرساة لكل فئة (إن كان البناء موجوداً)", () => {
  for (const f of ["site/ar/terms.html", "site/terms.html", "site/fr/terms.html", "site/zh/terms.html"]) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    const html = fs.readFileSync(p, "utf8");
    if (!html.includes("sv1-terms-css")) continue; // بناء قديم لم يُعد توليده
    for (const id of catIds) assert.ok(html.includes(`id="cat-${id}"`), `${f}: ينقصها #cat-${id}`);
    assert.ok(html.includes('id="general"'), `${f}: ينقصها #general`);
  }
});
