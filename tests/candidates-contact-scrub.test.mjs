// بيانات التواصل لا تصل زائراً مجهولاً عبر حقلٍ نصيٍّ حرّ (2026-10-01).
// الحادثة: «Skills» حملت «Private Chef / Cook · <بريد>» فظهر البريد في /hiring العامّة.
import test from "node:test";
import assert from "node:assert/strict";
import { cleanSkills, scrubContact, roleOf } from "../api/candidates.js";

test("البريد داخل المهارات يُحذف ولو التصق بالمسمّى بنقطة وسطية", () => {
  const out = cleanSkills("Private Chef / Cook · mohammed123rubel321@gmail.com", []);
  assert.ok(!/@|gmail/i.test(out), out);
  assert.match(out, /Private Chef/);
});

test("الجوّال بكل صيغه يُحذف من النص الحرّ", () => {
  for (const ph of ["+966 50 123 4567", "00966501234567", "0501234567", "050-123-4567"]) {
    const out = scrubContact("Cook " + ph + " Baker");
    assert.ok(!/\d{6,}|\d{3}-\d{3}/.test(out), ph + " → " + out);
  }
});

test("لا يمسّ الأرقام القصيرة ولا السنوات", () => {
  assert.equal(scrubContact("5 years, 2019 - 2023, Oracle 12c"), "5 years, 2019 - 2023, Oracle 12c");
});

test("المسمّى المعروض يُنقَّى أيضاً", () => {
  const p = { Source: { select: { name: "ترشيح" } }, "Original Position": { rich_text: [{ plain_text: "Chef a.b@x.com" }] } };
  assert.ok(!/@/.test(roleOf(p)));
});
