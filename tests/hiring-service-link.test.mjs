// زرّ «استشارة التوظيف والاستقدام» في /hiring يفتح الموقع الجديد لا /services/rec-gen القديمة.
// قرار المالك: «لما أدخل خدمات التوظيف يودّيني للموقع القديم». الاختبار يقرأ الصفحات المولَّدة
// (شغّل npm run build قبله).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRE = { ar: "/ar", en: "", fr: "/fr", zh: "/zh" };
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

for (const lang of Object.keys(PRE)) {
  const pre = PRE[lang];
  const hiring = read(`site${pre}/hiring.html`);
  const book = read(`site${pre}/consultation.html`);

  test(`${lang}: /hiring لا يصل إلى /services/rec-gen في أي موضع`, () => {
    assert.equal(/\/services\/rec-gen/.test(hiring), false);
  });

  test(`${lang}: الزرّ يشير إلى صفحة الحجز الجديدة بالبادئة الصحيحة (href وثابت السكربت)`, () => {
    const want = `${pre}/consultation?topic=rec-gen`;
    assert.ok(hiring.includes(`id="hireSecB" href="${want}"`), "href الزرّ");
    assert.ok(hiring.includes(`var SVC_EMP=${JSON.stringify(want)};`), "SVC_EMP");
  });

  test(`${lang}: وجهة الزرّ صفحة جديدة بلا main.js وفيها منطق التعبئة المسبقة`, () => {
    assert.equal(/<script[^>]*main\.js/.test(book), false);
    assert.ok(book.includes('id="bkTopic"'));
    assert.ok(/get\('topic'\)/.test(book) && /'rec-gen'/.test(book) && /!ti\.value\.trim\(\)/.test(book));
    assert.ok(/"tpRecGen":"[^"]{10,}"/.test(book), "نصّ التعبئة بلغة الصفحة");
  });

  test(`${lang}: topic يمرّ إلى /api/book كما هو`, () => {
    assert.ok(/topic:\$\('bkTopic'\)\.value\.trim\(\)/.test(book));
  });
}
