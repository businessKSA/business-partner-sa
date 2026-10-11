// بطاقة EOR في الرئيسية الجديدة (أمر المالك 2026-10-01): بابٌ برابط إلى /eor بأربع لغات.
// تقرأ الصفحات المولَّدة — شغّل `npm run build` قبلها.
import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { EOR_PAGE_TEXT } from "../site/scripts/simple-v1-eor.mjs";

const HOMES = { en: ["site/index.html", "/eor"], ar: ["site/ar/index.html", "/ar/eor"], fr: ["site/fr/index.html", "/fr/eor"], zh: ["site/zh/index.html", "/zh/eor"] };
const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");

for (const [lang, [file, link]] of Object.entries(HOMES)) {
  test(`الرئيسية ${lang}: بطاقة EOR بالنص المعتمد والرابط الصحيح`, () => {
    const html = read(file);
    const m = html.match(/<a class="sv1-door" id="door-eor" href="([^"]+)"[^>]*>(.*?)<\/a>/s);
    assert.ok(m, "بطاقة EOR غير موجودة في " + file);
    assert.equal(m[1], link);
    assert.ok(m[2].includes(`<h3>${EOR_PAGE_TEXT[lang].title}</h3>`));
    assert.ok(m[2].includes(`<p>${EOR_PAGE_TEXT[lang].desc}</p>`));
    assert.ok(fs.existsSync(new URL("../" + link.replace(/^\//, "site/") + ".html", import.meta.url)), "صفحة الهدف غير مبنيّة");
    // الأبواب الثلاثة الأصلية ما زالت أزرار المستشار، وEOR ليس منها
    for (const k of ["consulting", "government", "formation"]) assert.ok(html.includes(`data-door="${k}"`));
    assert.ok(!html.includes('data-door="eor"'));
    // الرئيسية الجديدة بلا main.js القديم
    assert.ok(!/<script[^>]+src="[^"]*main\.js/.test(html));
    // لا سعر في البطاقة
    assert.ok(!/ر\.س|SAR|ريال/.test(m[2]));
  });
}
