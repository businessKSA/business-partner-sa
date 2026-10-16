// قواعد بيانات دليل المستثمر: docs/sbc-guide/schema.md
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { guideGaps, guideModel, GUIDE_TEXT } from "../site/scripts/simple-v1-guide.mjs";
import { bookingConfig } from "../api/_booking.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const D = path.join(ROOT, "site", "data", "sbc");
const load = (f) => JSON.parse(fs.readFileSync(path.join(D, f), "utf8"));
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "site", "assets", "data", "catalog.json"), "utf8"));
const codes = new Set(catalog.services.map((s) => s.code));
const LANGS = ["ar", "en", "fr", "zh"];

test("القطاعات: كل SKU موجود في الكتالوج، وكل مرحلة معرّفة، والأسماء بأربع لغات", () => {
  const stages = load("stages.json");
  const cats = new Set(catalog.categories.map((c) => c.key));
  const ids = new Set();
  for (const s of load("sectors.json")) {
    assert.ok(!ids.has(s.id), "id مكرر " + s.id); ids.add(s.id);
    assert.ok(cats.has(s.category), `${s.id}: فئة غير موجودة`);
    assert.ok(["formation", "government", "consulting"].includes(s.door), `${s.id}: door`);
    for (const l of LANGS) assert.ok(s.name[l] && s.summary[l], `${s.id}: نص ${l}`);
    for (const c of [...s.bundle, ...s.steps.flatMap((x) => x.skus)]) assert.ok(codes.has(c), `${s.id}: ${c} ليس في الكتالوج`);
    for (const st of s.steps) for (const l of LANGS) assert.ok(stages[st.stage] && stages[st.stage][l], `${s.id}: مرحلة ${st.stage}/${l}`);
    assert.ok(["needs_verification", "verified", "not_applicable"].includes(s.official_order_status));
  }
});

test("كل جهة في الكتالوج لها سجل في entities.json (جهة جديدة تُضاف هناك)", () => {
  const names = new Set(load("entities.json").map((e) => e.catalog_name));
  for (const s of catalog.services) {
    const g = String(s.govPlatform == null ? "" : s.govPlatform).trim();
    assert.ok(names.has(g === "-" ? "" : g), `جهة بلا سجل في entities.json: «${g}» (${s.code})`);
  }
  for (const e of load("entities.json")) for (const l of ["ar", "en"]) assert.ok(e.name[l], `${e.id}: ${l}`);
});

test("الأنظمة: sourced يحمل رابطاً رسمياً https وتاريخ جلب ومرجعاً، وغير ذلك بلا ادعاء", () => {
  const ids = new Set();
  for (const r of load("regulations.json")) {
    assert.ok(!ids.has(r.id), "id مكرر " + r.id); ids.add(r.id);
    assert.ok(["sourced", "needs_verification", "verified", "retired"].includes(r.status), r.id);
    assert.ok(r.title.ar && r.title.en, r.id);
    if (r.status === "sourced" || r.status === "verified") {
      assert.match(r.source_url, /^https:\/\/[^/]+\.gov\.sa\//, `${r.id}: رابط غير رسمي`);
      assert.match(r.fetched_at || r.verified_at, /^\d{4}-\d{2}-\d{2}$/, `${r.id}: تاريخ`);
    }
    if (r.status === "sourced") assert.ok(r.source_ref, `${r.id}: مرجع المستودع`);
    if (r.group === "general") assert.equal(r.status, "needs_verification", `${r.id}: نظام عام بلا رابط يجب أن يبقى «بحاجة تحقق»`);
  }
});

test("مرجع الأنظمة: كل رابط sourced وارد فعلاً في api/_saudi-labor-data.json (لا رابط من الذاكرة)", () => {
  const ref = fs.readFileSync(path.join(ROOT, "api", "_saudi-labor-data.json"), "utf8");
  for (const r of load("regulations.json")) if (r.status === "sourced") assert.ok(ref.includes(r.source_url), `${r.id}: الرابط غير موجود في المرجع`);
});

test("procedures.json: السجل الموثّق فقط يحمل رابطاً وتاريخاً، والرسم رقم أو null، ولا رسم بلا مصدر", () => {
  for (const p of load("procedures.json")) {
    assert.ok(codes.has(p.code), `${p.code} ليس في الكتالوج`);
    assert.ok(p.gov_fee === null || p.gov_fee === undefined || typeof p.gov_fee === "number");
    if (p.status === "verified") {
      assert.match(p.source_url, /^https:\/\//); assert.match(p.verified_at, /^\d{4}-\d{2}-\d{2}$/);
    } else {
      assert.ok(p.gov_fee == null && !p.duration, `${p.code}: رسم أو مدة بلا تحقق`);
    }
  }
});

test("المكاتب والاعتراضات والمخالفات: SKU صحيحة، والنوافذ والدليل الرسمي بحاجة تحقق، ولا وعد بالإلغاء", () => {
  const off = load("offices.json"), ap = load("appeals.json"), v = load("violations.json");
  for (const c of [...off.our_services, ...ap.services]) assert.ok(codes.has(c), c);
  assert.equal(off.directory_status, "needs_verification");
  assert.equal(off.categories.length, 0, "قائمة مكاتب رسمية بلا مصدر");
  assert.equal(ap.windows_status, "needs_verification");
  assert.deepEqual(v.stages.map((s) => s.id), ["review", "eligibility", "prepare", "submit", "follow"]);
  for (const s of v.stages) for (const l of LANGS) assert.ok(s.title[l] && s.text[l]);
  const NEG = { ar: /^لا نضمن/, en: /^We do not guarantee/, fr: /^Nous ne garantissons/, zh: /^我们不保证/ };
  for (const l of LANGS) {
    assert.match(v.no_guarantee[l], NEG[l], "نص عدم الضمان");
    for (const s of v.stages) assert.doesNotMatch(s.text[l], /ضمان|guarantee|garanti|保证/i, `وعد في مرحلة ${s.id}/${l}`);
  }
});

test("الاتصال المرئي: الساعات تطابق منظومة الحجز الافتراضية", () => {
  const v = load("video.json"), c = bookingConfig();
  const m = (h) => { const [a, b] = h.split(":").map(Number); return a * 60 + b; };
  if (!process.env.BOOKING_START && !process.env.BOOKING_END) { assert.equal(m(v.from), c.fromMin); assert.equal(m(v.to), c.toMin); }
  assert.equal(v.path, "/consultation");
});

test("النصوص: كل مفتاح بأربع لغات بلا فراغ", () => {
  const walk = (o, p) => { for (const [k, e] of Object.entries(o)) {
    if (typeof e.ar === "string") for (const l of LANGS) assert.ok(typeof e[l] === "string" && e[l].trim(), `${p}${k}/${l}`);
    else walk(e, p + k + "/"); } };
  walk(GUIDE_TEXT, "");
});

test("نموذج الصفحة: ٩ قطاعات، كل خدمة لها جهة وفئة، وأعداد الجهات تجمع إلى الإجمالي", () => {
  for (const l of LANGS) {
    const m = guideModel(l);
    assert.equal(m.sectors.length, 9);
    assert.equal(m.entities.reduce((a, e) => a + e.count, 0), m.services.length);
    for (const s of m.services) assert.ok(s.entity && s.catLabel, s.code);
    assert.ok(m.services.length <= catalog.services.length);
  }
});

test("الفجوات الحكومية: أرقام متسقة وتُحسب من البيانات", () => {
  const g = guideGaps();
  assert.ok(g.services_total > 100);
  assert.ok(g.services_with_government_entity <= g.services_total);
  assert.equal(g.services_without_verified_official_details, g.services_total - load("procedures.json").filter((p) => p.status === "verified").length);
  assert.equal(g.offices_directory_pending, 1);
});
