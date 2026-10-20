// فهارس نموذج طلب الموظفين (api/_eor-catalogs.json) — بنيتها وسلامة مراجعها.
//
// السبب: الملف بيانات محضة تُقرأ لاحقاً من النموذج والمساعد الذكي، فأي معرّف مكرر أو مرجع مقطوع
// (مهنة تشير إلى قطاع غير موجود، أو existing_id لا يقابل شيئاً في _occupations.js) يظهر عطلاً في الواجهة لا هنا.
// هذه الاختبارات تمسكه عند المصدر، وتتأكد أن الملف هو ناتج المولِّد نفسه لا نسخة عُدّلت يدوياً.
//
// الدول (Intl.DisplayNames) تتغير أسماؤها بين إصدارات ICU، فلا تُقارَن بالمولِّد؛ تُفحص بنيتها فقط.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OCCUPATIONS } from "../api/_occupations.js";
import { SECTORS as EOR_SECTORS } from "../api/_eor.js";
import { buildCatalogs } from "../site/scripts/build-eor-catalogs.mjs";

const FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../api/_eor-catalogs.json");
const RAW = fs.readFileSync(FILE, "utf8");
const C = JSON.parse(RAW);

const hasAr = (s) => /[؀-ۿ]/.test(s);
const hasLatin = (s) => /[A-Za-z]/.test(s);
const uniq = (arr, what) => {
  const seen = new Set();
  for (const x of arr) {
    assert.ok(!seen.has(x), `${what} مكرر: ${x}`);
    seen.add(x);
  }
  return seen;
};

test("البنية العليا والحجم", () => {
  for (const k of ["meta", "countries", "regions", "cities", "isic_sections", "sectors", "seniority", "isco_groups", "occupations"]) {
    assert.ok(C[k], `المفتاح ${k} مفقود`);
  }
  assert.ok(RAW.length <= 1.5 * 1024 * 1024, `الملف ${RAW.length} بايت يتجاوز 1.5 م.ب`);
  assert.match(C.meta.version, /^\d{4}-\d{2}-\d{2}\.\d+$/);
});

test("الدول: ≥240، السعودية مُعلَّمة، أربع لغات، لا تكرار", () => {
  assert.ok(C.countries.length >= 240, `عدد الدول ${C.countries.length}`);
  uniq(C.countries.map((c) => c.code), "رمز دولة");
  for (const c of C.countries) {
    assert.match(c.code, /^[A-Z]{2}$/, c.code);
    for (const l of ["ar", "en", "fr", "zh"]) {
      assert.ok(typeof c[l] === "string" && c[l].trim() && c[l] !== c.code, `اسم ${l} ناقص لـ ${c.code}`);
    }
    assert.ok(hasAr(c.ar), `الاسم العربي لـ ${c.code} بلا حروف عربية`);
    assert.ok(Number.isInteger(c.priority) && c.priority >= 0, `priority لـ ${c.code}`);
  }
  const sa = C.countries.filter((c) => c.saudi);
  assert.equal(sa.length, 1);
  assert.equal(sa[0].code, "SA");
  assert.equal(sa[0].priority, 0);
  // الأولوية: ما ذكره المالك أولاً وبالترتيب
  const first = C.countries.filter((c) => c.priority > 0 && c.priority < 999).sort((a, b) => a.priority - b.priority).slice(0, 12).map((c) => c.code);
  assert.deepEqual(first, ["IN", "PK", "PH", "BD", "EG", "NP", "ID", "LK", "SD", "JO", "SY", "YE"]);
  // مجموعة الدول مرتبة: الأولوية تصاعدياً
  const prios = C.countries.map((c) => c.priority);
  assert.deepEqual(prios, [...prios].sort((a, b) => a - b));
});

test("المدن والمناطق: ≥150، ثلاث عشرة منطقة، لكل منطقة عاصمة موجودة", () => {
  assert.equal(C.regions.length, 13);
  uniq(C.regions.map((r) => r.id), "منطقة");
  assert.ok(C.cities.length >= 150, `عدد المدن ${C.cities.length}`);
  uniq(C.cities.map((c) => c.id), "معرّف مدينة");
  const regionIds = new Set(C.regions.map((r) => r.id));
  for (const c of C.cities) {
    assert.match(c.id, /^[a-z0-9-]+$/, c.id);
    assert.ok(regionIds.has(c.region), `منطقة غير موجودة لـ ${c.id}`);
    assert.ok(c.ar.trim() && hasAr(c.ar), `ar ناقص لـ ${c.id}`);
    assert.ok(c.en.trim() && hasLatin(c.en), `en ناقص لـ ${c.id}`);
  }
  for (const r of C.regions) {
    assert.ok(hasAr(r.ar) && hasLatin(r.en));
    const cap = C.cities.find((c) => c.id === r.capital);
    assert.ok(cap, `عاصمة ${r.id} غير موجودة بين المدن`);
    assert.equal(cap.region, r.id, `عاصمة ${r.id} في منطقة أخرى`);
    assert.ok(cap.capital, `عاصمة ${r.id} غير مُعلَّمة capital`);
    assert.equal(C.cities.filter((c) => c.region === r.id && c.capital).length, 1, `أكثر من عاصمة في ${r.id}`);
  }
  for (const id of ["riyadh", "jeddah", "makkah", "madinah", "dammam", "al-khobar", "abha", "tabuk"]) {
    assert.ok(C.cities.some((c) => c.id === id), `مدينة كبرى مفقودة: ${id}`);
  }
});

test("القطاعات: 60–120، ISIC صالح، ربط بقطاعات _eor.js القديمة", () => {
  assert.ok(C.sectors.length >= 60 && C.sectors.length <= 120, `عدد القطاعات ${C.sectors.length}`);
  uniq(C.sectors.map((s) => s.id), "قطاع");
  uniq(C.sectors.map((s) => s.ar), "اسم قطاع عربي");
  uniq(C.sectors.map((s) => s.en), "اسم قطاع إنجليزي");
  assert.equal(C.isic_sections.length, 21);
  assert.deepEqual(C.isic_sections.map((s) => s.code), "ABCDEFGHIJKLMNOPQRSTU".split(""));
  const secs = new Set(C.isic_sections.map((s) => s.code));
  const oldIds = new Set(EOR_SECTORS.map((s) => s.id));
  for (const s of C.sectors) {
    assert.match(s.id, /^[a-z0-9-]+$/, s.id);
    assert.ok(hasAr(s.ar) && hasLatin(s.en), `اسم ناقص: ${s.id}`);
    assert.ok(secs.has(s.section), `قسم ISIC غير معروف: ${s.id}`);
    assert.ok(s.composite === true || /^\d{2,4}$/.test(s.isic), `isic غير صالح: ${s.id}`);
    assert.ok(oldIds.has(s.eor_sector), `eor_sector غير موجود في _eor.js: ${s.id} -> ${s.eor_sector}`);
  }
  // كل قسم ISIC له قطاع واحد على الأقل
  for (const code of secs) assert.ok(C.sectors.some((s) => s.section === code), `قسم ISIC بلا قطاع: ${code}`);
  // القطاعات التي طلبها المالك صراحةً
  for (const id of ["fintech", "defense-security", "tourism-hospitality", "renewable-energy", "healthcare", "education", "retail",
    "fmcg", "logistics", "contracting", "mining", "telecom-it", "media-marketing", "real-estate", "professional-services", "nonprofit", "government"]) {
    assert.ok(C.sectors.some((s) => s.id === id), `قطاع مطلوب مفقود: ${id}`);
  }
});

test("مستويات الوظيفة", () => {
  const ids = C.seniority.map((s) => s.id);
  uniq(ids, "مستوى");
  for (const id of ["c-level", "director", "manager", "team-lead", "senior", "mid", "entry", "labor"]) assert.ok(ids.includes(id), `مستوى مفقود: ${id}`);
  uniq(C.seniority.map((s) => s.order), "ترتيب مستوى");
  for (const s of C.seniority) assert.ok(hasAr(s.ar) && hasLatin(s.en), s.id);
});

test("المهن: ≥600، معرّفات فريدة، مراجع سليمة، لا تكرار", () => {
  assert.ok(C.occupations.length >= 600, `عدد المهن ${C.occupations.length}`);
  uniq(C.occupations.map((o) => o.id), "معرّف مهنة");
  uniq(C.occupations.map((o) => o.en.toLowerCase()), "اسم مهنة إنجليزي");
  uniq(C.occupations.map((o) => o.ar), "اسم مهنة عربي");

  const sectorIds = new Set(C.sectors.map((s) => s.id));
  const senIds = new Set(C.seniority.map((s) => s.id));
  const subMajor = new Set(C.isco_groups.submajor.map((g) => g.code));
  const major = new Set(C.isco_groups.major.map((g) => g.code));
  const existing = new Set(OCCUPATIONS.map((o) => o.id));
  const sectorUse = new Map();
  const senUse = new Set();

  for (const o of C.occupations) {
    assert.match(o.id, /^[a-z0-9]+\.[a-z0-9-]+$/, `صيغة المعرّف: ${o.id}`);
    assert.ok(o.ar.trim() && hasAr(o.ar), `ar ناقص: ${o.id}`);
    assert.ok(o.en.trim() && hasLatin(o.en), `en ناقص: ${o.id}`);
    assert.match(o.group, /^\d{4}$/, `group: ${o.id}`);
    assert.ok(major.has(o.group[0]) && subMajor.has(o.group.slice(0, 2)), `مجموعة ISCO غير معروفة: ${o.id} ${o.group}`);
    assert.ok(Array.isArray(o.seniority) && o.seniority.length > 0, `seniority فارغ: ${o.id}`);
    for (const s of o.seniority) { assert.ok(senIds.has(s), `مستوى غير موجود ${s} في ${o.id}`); senUse.add(s); }
    assert.equal(new Set(o.seniority).size, o.seniority.length, `مستوى مكرر في ${o.id}`);
    assert.ok(Array.isArray(o.sectors) && o.sectors.length > 0, `sectors فارغ: ${o.id}`);
    if (o.sectors.includes("*")) {
      assert.deepEqual(o.sectors, ["*"], `«*» يأتي وحده: ${o.id}`);
    } else {
      assert.equal(new Set(o.sectors).size, o.sectors.length, `قطاع مكرر في ${o.id}`);
      for (const s of o.sectors) { assert.ok(sectorIds.has(s), `قطاع غير موجود ${s} في ${o.id}`); sectorUse.set(s, (sectorUse.get(s) || 0) + 1); }
    }
    if (o.existing_id !== undefined) assert.ok(existing.has(o.existing_id), `existing_id غير موجود في _occupations.js: ${o.id} -> ${o.existing_id}`);
  }
  // كل مستوى مستعمل، وكل قطاع تشير إليه مهنة صراحةً
  for (const s of senIds) assert.ok(senUse.has(s), `مستوى غير مستعمل: ${s}`);
  for (const s of sectorIds) assert.ok(sectorUse.get(s), `قطاع بلا مهنة تشير إليه: ${s}`);
  // المناصب التنفيذية المطلوبة
  for (const id of ["mgmt.ceo", "fin.cfo", "mgmt.coo", "mgmt.cmo", "mkt.marketing-manager", "sales.sales-manager", "hr.hr-manager", "fin.finance-manager"]) {
    assert.ok(C.occupations.some((o) => o.id === id), `منصب مطلوب مفقود: ${id}`);
  }
});

test("المهن الموجودة في _occupations.js تُغطّى (إعادة استعمال المعرّفات)", () => {
  const covered = new Set(C.occupations.map((o) => o.existing_id).filter(Boolean));
  const missing = OCCUPATIONS.map((o) => o.id).filter((id) => !covered.has(id));
  // نسمح بحدٍّ صغير (مهنٌ مركّبة لا تقابلها مهنة واحدة هنا)، لا بتجاهل التصنيف الموحّد.
  assert.ok(missing.length <= 5, `مهن موحّدة غير مغطّاة (${missing.length}): ${missing.join(", ")}`);
});

test("الملف هو ناتج المولِّد (القطاعات والمدن والمهن والمستويات)", async () => {
  const fresh = await buildCatalogs();
  for (const k of ["meta", "regions", "cities", "isic_sections", "sectors", "seniority", "isco_groups", "occupations"]) {
    assert.deepEqual(C[k], JSON.parse(JSON.stringify(fresh[k])), `القسم ${k} لا يطابق المولِّد — أعد التوليد: node site/scripts/build-eor-catalogs.mjs`);
  }
  assert.equal(C.countries.length, fresh.countries.length);
});
