// قواعد بيانات دليل المستثمر: docs/sbc-guide/schema.md
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const D = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "site", "data", "sbc");
const load = (f) => JSON.parse(fs.readFileSync(path.join(D, f), "utf8"));
const STATUS = ["needs_verification", "verified", "retired"];
const files = { sectors: load("sectors.json"), entities: load("entities.json"), procedures: load("procedures.json") };

test("كل سجل: id فريد وحقول المصدر والحالة صحيحة", () => {
  for (const [name, rows] of Object.entries(files)) {
    const ids = new Set();
    for (const r of rows) {
      assert.ok(r.id && !ids.has(r.id), `${name}: id مكرر أو مفقود ${r.id}`);
      ids.add(r.id);
      assert.ok(STATUS.includes(r.status), `${name}/${r.id}: status غير صالح`);
      for (const k of ["source_url", "verified_at"]) assert.equal(typeof r[k], "string", `${name}/${r.id}: ${k}`);
      if (r.status === "verified") {
        assert.match(r.source_url, /^https:\/\//, `${name}/${r.id}: verified بلا رابط رسمي`);
        assert.match(r.verified_at, /^\d{4}-\d{2}-\d{2}$/, `${name}/${r.id}: verified بلا تاريخ`);
      }
    }
  }
});

test("الإجراءات تشير لجهة وقطاع موجودين، والرسم الحكومي رقم أو null", () => {
  const ent = new Set(files.entities.map((e) => e.id)), sec = new Set(files.sectors.map((s) => s.id));
  for (const p of files.procedures) {
    assert.ok(ent.has(p.entity), `${p.id}: جهة مجهولة`);
    assert.ok(sec.has(p.sector), `${p.id}: قطاع مجهول`);
    assert.ok(p.gov_fee === null || typeof p.gov_fee === "number", `${p.id}: gov_fee`);
    assert.ok(p.title.ar && p.title.en, `${p.id}: عنوان ثنائي اللغة`);
  }
});

test("البيانات النموذجية لا تدّعي حالة verified ولا تحمل رسماً أو مدة", () => {
  assert.equal(load("meta.json").sample, true);
  for (const rows of Object.values(files)) for (const r of rows) assert.equal(r.status, "needs_verification");
  for (const p of files.procedures) assert.ok(p.gov_fee === null && p.duration === null);
});
