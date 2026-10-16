// صفحة /guide: بنية التبويبات، noindex للنموذج، عربي/إنجليزي.
import test from "node:test";
import assert from "node:assert/strict";
import { buildSimpleGuide } from "../site/scripts/simple-v1-guide.mjs";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const SV1 = {
  header: (p) => `<header data-p="${p}"></header>`,
  footer: () => "<footer></footer>",
  shell: (o) => JSON.stringify(o),
};
const render = (lang) => JSON.parse(buildSimpleGuide(SV1, { lang: () => lang, esc }));

test("الصفحة نموذجية: noindex ولافتة «نموذج — بحاجة تحقق»", () => {
  const r = render("ar");
  assert.equal(r.noindex, true);
  assert.equal(r.path, "/guide");
  assert.match(r.body, /نموذج — بحاجة تحقق/);
});

test("سبعة تبويبات بأدوار ARIA ولوحاتها", () => {
  const { body } = render("ar");
  assert.equal((body.match(/role="tab"/g) || []).length, 7);
  assert.equal((body.match(/role="tabpanel"/g) || []).length, 7);
  assert.match(body, /role="tablist"/);
  for (const k of ["journey", "procedures", "regulations", "offices", "appeals", "violations", "video"])
    assert.match(body, new RegExp(`aria-controls="sbc-panel-${k}"`));
});

test("مرشّح الجهة والبحث موجودان وكل بطاقة إجراء تحمل جهتها", () => {
  const { body } = render("ar");
  assert.match(body, /id="sbcEnt"/);
  assert.match(body, /id="sbcQ"/);
  assert.match(body, /data-entity="sample-entity-a"/);
});

test("الإنجليزية تعرض نصوصها والعربية لا تتسرب إليها", () => {
  const en = render("en");
  assert.match(en.body, /Investor guide/);
  assert.match(en.body, /Sample — needs verification/);
  assert.doesNotMatch(en.body, /دليل المستثمر/);
});

test("لا رابط واتساب في المحتوى (سياسة §4)", () => {
  assert.doesNotMatch(render("ar").body, /wa\.me|whatsapp/i);
});
