// صفحات الخدمات والتصنيفات المبنية: تصميم SV1 كاملاً، وربط السلة/العرض، بلا روابط ميتة.
// (الأرقام الكاملة للمعايير الخمسة: node docs/service-journeys/tools/audit.mjs)
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const out = JSON.parse(execFileSync("node", [path.join(ROOT, "docs/service-journeys/tools/audit.mjs")], { encoding: "utf8", maxBuffer: 1 << 26 }));

test("كل صفحات الخدمات (٤ لغات) على SV1 كاملاً ومربوطة بالسلة/العرض", () => {
  const s = out.summary.service;
  assert.equal(s.pages, out.services * 4);
  assert.equal(s.c1.fail, 0, JSON.stringify(out.failing.service.c1));
  assert.equal(s.c2.fail, 0, JSON.stringify(out.failing.service.c2));
});

test("صفحات التصنيف (٩ × ٤) على SV1 كاملاً وروابطها تُحَل", () => {
  const c = out.summary.category;
  assert.equal(c.pages, 36);
  assert.equal(c.c1.fail, 0, JSON.stringify(out.failing.category.c1));
  assert.equal(c.c2.fail, 0, JSON.stringify(out.failing.category.c2));
});

test("الخدمة المسعّرة لا تخفي الرسوم الحكومية المنفصلة في ملاحظة السعر", () => {
  const reasons = out.failing.service.c4;
  assert.equal(reasons["الرسوم الحكومية لا تُذكر منفصلة في ملاحظة السعر"], undefined);
  assert.equal(reasons["الجهة غائبة من الصفحة"], undefined);
});
