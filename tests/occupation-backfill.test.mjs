// ملف الباك فيل المدمج (api/_occupation-backfill.json) — 2026-10-01.
//
// يقرؤه سيناريو n8n خارج هذا المستودع (عقدة Code) ليكتب «المهنة الموحّدة» و«ثقة المهنة» في صفوف
// الجدول: مفتاحُ المسمّى ← [فهرس خيار، ثقة]. وما يُكتب في قاعدة حية لا يجوز أن يكون نسخةً قديمة،
// فهذا الاختبار يفشل إن تغيّر المصنِّف أو الخريطة دون إعادة توليد الملف.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { canonicalOccupation, occupationOptionName, titleKey, OCCUPATIONS } from "../api/_occupations.js";

const read = (f) => JSON.parse(fs.readFileSync(new URL("../api/" + f, import.meta.url), "utf8"));
const B = read("_occupation-backfill.json");
const M = read("_occupation-map.json");
const NONE = occupationOptionName("unclassified");
const CONF = { h: "high", m: "medium", l: "low" };

// الدالة التي تُلصق كما هي في عقدة Code. تُختبر هنا بنصّها لا بنسخةٍ منها.
const N8N_KEY_SRC = `(t) => String(t == null ? "" : t).replace(/^ +| +$/g, "").replace(/[A-Z]/g, (c) => c.toLowerCase())`;
const n8nKey = eval(N8N_KEY_SRC);

test("الشكل: { v, labels, map } وقيمٌ سليمة، بلا حقولٍ زائدة", () => {
  assert.deepEqual(Object.keys(B).sort(), ["labels", "map", "v"]);
  assert.equal(B.v, 1);
  assert.equal(new Set(B.labels).size, B.labels.length, "خيارٌ مكرّر في labels");
  const valid = new Set([...OCCUPATIONS.map((o) => occupationOptionName(o.id)), NONE]);
  for (const l of B.labels) assert.ok(valid.has(l), `خيارٌ غير معروف: ${l}`);
  assert.ok(B.labels.includes(NONE), "«غير مصنّف» لازمةٌ كي لا تبقى مسمّياتها في الطابور");
  for (const [k, v] of Object.entries(B.map)) {
    assert.ok(Array.isArray(v) && v.length === 2, k);
    assert.ok(Number.isInteger(v[0]) && v[0] >= 0 && v[0] < B.labels.length, `${k}: فهرس`);
    assert.ok(["h", "m", "l"].includes(v[1]), `${k}: ثقة`);
    assert.equal(k, titleKey(k), `${k}: مفتاحٌ غير مطبَّع`);
  }
});

test("كل مفتاح يعطي نفس نتيجة canonicalOccupation: الاسم والثقة (و«غير مصنّف» بثقة منخفضة)", () => {
  const bad = [];
  for (const [k, [i, c]] of Object.entries(B.map)) {
    const r = canonicalOccupation(k);
    const name = occupationOptionName(r.id);
    const conf = r.id === "unclassified" ? "l" : r.confidence[0];
    if (B.labels[i] !== name || c !== conf) bad.push(`${k} → ${B.labels[i]}/${c} (المصنِّف ${name}/${conf})`);
  }
  assert.deepEqual(bad.slice(0, 10), [], `${bad.length} مفتاحاً تقادم — أعد توليد الملف`);
});

test("لم يتقادم عن _occupation-map.json: نفس المسمّيات، ونفس المهنة والثقة", () => {
  const mapKeys = Object.keys(M.map);
  assert.equal(Object.keys(B.map).length, mapKeys.length);
  const bad = [];
  for (const t of mapKeys) {
    const [id, conf] = M.map[t];
    const b = B.map[titleKey(t)];
    if (!b) { bad.push(`${t}: غائب`); continue; }
    const name = id === "unclassified" ? NONE : M.occupations[id].option;
    if (B.labels[b[0]] !== name || b[1] !== conf) bad.push(`${t}: ${B.labels[b[0]]}/${b[1]} ≠ ${name}/${conf}`);
  }
  assert.deepEqual(bad.slice(0, 10), [], `${bad.length} فرقاً بين الملف والخريطة`);
});

test("دالة المفتاح في n8n = titleKey حرفياً (lower ASCII وقصّ المسافات وحدها كما في SQLite)", () => {
  for (const s of ["  Chef De Partie ", "CDP", "\tX", "É", "مدير مطعم", null, undefined, "", "Waiter  ", "  F&B Manager"]) {
    assert.equal(n8nKey(s), titleKey(s), JSON.stringify(s));
  }
  // وكل مفتاح في الملف ثابتٌ تحتها: لا يُعاد تطبيعه
  for (const k of Object.keys(B.map)) assert.equal(n8nKey(k), k);
  // ومسمّى بحروفٍ كبيرة يجد مفتاحه
  assert.ok(B.map[n8nKey("Chef de Partie ")], "chef de partie غائب");
});

test("حجم الملف معقول لعقدة n8n (أقلّ من ٦٠٠ ألف بايت)", () => {
  const bytes = fs.statSync(new URL("../api/_occupation-backfill.json", import.meta.url)).size;
  assert.ok(bytes < 600_000, `الحجم ${bytes}`);
});
