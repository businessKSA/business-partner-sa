// قائمة واتساب: الملف الجاهز للّصق في n8n يجب أن يطابق الكتالوج.
//
// كان المولِّد يكتب n8n/wa-menu-data.js وحده، وبقي n8n/wa-build-menu-response.js
// (الذي يُلصق فعلاً في العقدة) على كتالوج قديم: ٢٠١ خدمة تضم ست باقات REV-*
// المخفية (hidden.json) بينما الكتالوج ١٩٥. فكانت قائمة واتساب تعرض للعميل
// خدمةً تحوّلها صفحتها إلى /catalog.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const catalog = JSON.parse(read("site/assets/data/catalog.json"));
const hidden = JSON.parse(read("site/data/hidden.json")).services.map((s) => String(s).toUpperCase());
const paste = read("n8n/wa-build-menu-response.js");
const codesIn = (src) => [...src.matchAll(/^    \["([^"]+)"/gm)].map((m) => m[1]);

test("ملف اللصق في n8n يحمل خدمات الكتالوج بالضبط", () => {
  const want = catalog.services.map((s) => s.code).sort();
  const got = codesIn(paste).sort();
  assert.deepEqual(got, want);
});

test("ملف اللصق لا يحمل أي خدمة مخفية", () => {
  for (const c of codesIn(paste)) assert.ok(!hidden.includes(c.toUpperCase()), c + " مخفية لكنها في قائمة واتساب");
});

test("ملف اللصق كودٌ صالح لعقدة n8n (return على مستوى أعلى مسموح هناك)", () => {
  assert.doesNotThrow(() => new Function(paste));
});

test("wa-menu.mjs --check ينجح (الملفان مطابقان للكتالوج)", () => {
  const r = spawnSync(process.execPath, ["site/scripts/wa-menu.mjs", "--check"], { cwd: new URL("../", import.meta.url).pathname, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
});
