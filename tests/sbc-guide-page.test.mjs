// صفحة /guide ومدخلها في الرئيسية: البنية، noindex، الأسعار، اللغات، والقواعد.
import test from "node:test";
import assert from "node:assert/strict";
import { buildSimpleGuide, guideEntrance, GUIDE_TABS } from "../site/scripts/simple-v1-guide.mjs";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const SV1 = { header: (p) => `<header data-p="${p}"></header>`, footer: () => "<footer></footer>", shell: (o) => JSON.stringify(o) };
const render = (lang) => JSON.parse(buildSimpleGuide(SV1, { lang: () => lang, esc }));
const LANGS = ["ar", "en", "fr", "zh"];

test("الصفحة noindex ما دامت بانتظار موافقة المالك، ومسارها /guide", () => {
  const r = render("ar");
  assert.equal(r.noindex, true);
  assert.equal(r.path, "/guide");
});

for (const lang of LANGS) {
  test(`${lang}: سبعة تبويبات ولوحاتها بأدوار ARIA، ومعرّفات غير مكررة`, () => {
    const { body } = render(lang);
    assert.equal((body.match(/role="tab"/g) || []).length, 7 + 9, "٧ رئيسية + ٩ قطاعات");
    assert.equal((body.match(/role="tabpanel"/g) || []).length, 7 + 9);
    for (const k of GUIDE_TABS) assert.match(body, new RegExp(`aria-controls="sbc-panel-${k}"`));
    const ids = [...body.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, "معرّف مكرر");
    assert.equal((body.match(/<h1[\s>]/g) || []).length, 1);
  });

  test(`${lang}: الإجراءات حسب الجهة — بحث وشرائح جهات وكل بطاقة تحمل جهتها ووجهتها`, () => {
    const { body } = render(lang);
    assert.match(body, /id="sbcQ"/);
    assert.match(body, /id="sbcChips"/);
    const cards = body.match(/<article class="sv1-gd-svc" data-entity="[^"]+" data-q="[^"]*">/g) || [];
    assert.ok(cards.length >= 150, "بطاقات الإجراءات: " + cards.length);
    const pre = lang === "en" ? "" : "/" + lang;
    assert.match(body, new RegExp(`href="${pre}/services/bp-sbc-02"`));
    assert.match(body, new RegExp(`href="${pre}/services/category/company-formation"`));
    assert.match(body, new RegExp(`href="${pre}/consultation"`));
  });

  test(`${lang}: لا سعر خارج صنف price-amt (يخفيه SHOW_PRICES=false) ولا واتساب ولا «شريك الأعمال»`, () => {
    const { body } = render(lang);
    const stripped = body.replace(/<span class="sv1-gd-amt price-amt">[^<]*<\/span>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<script[\s\S]*?<\/script>/g, "");
    assert.doesNotMatch(stripped, /\d[\d,.]*\s*(﷼|ر\.س|SAR|ريال)/, "سعر ظاهر");
    assert.ok((body.match(/price-amt/g) || []).length > 50, "الأسعار موسومة");
    assert.doesNotMatch(body, /wa\.me|api\.whatsapp|whatsapp/i);
    assert.doesNotMatch(body, /شريك الأعمال|شريك أعمالك/);
  });

  test(`${lang}: الأنظمة روابط رسمية مفتوحة بأمان، وغير الموثّق موسوم بلا رابط`, () => {
    const { body } = render(lang);
    const links = [...body.matchAll(/<a class="sv1-btn sm" href="(https:\/\/[^"]+)" target="_blank" rel="noopener noreferrer">/g)].map((m) => m[1]);
    assert.ok(links.length >= 10, "روابط رسمية: " + links.length);
    for (const l of links) assert.match(l, /^https:\/\/[^/]+\.gov\.sa\//);
    assert.match(body, /sv1-gd-badge/);
  });

  test(`${lang}: مراحل المخالفات الخمس وعدم الضمان`, () => {
    const { body } = render(lang);
    assert.equal((body.match(/<ol class="sv1-gd-vflow">[\s\S]*?<\/ol>/)[0].match(/<li>/g) || []).length, 5);
    assert.match(body, /class="sv1-gd-guarantee"/);
  });
}

test("العربية: مصطلحات المالك للمخالفات ولا «الوكيل» للمستشار", () => {
  const { body } = render("ar");
  for (const w of ["مراجعة", "دراسة أهلية الاعتراض", "تجهيز", "تقديم", "متابعة", "تحدّث مع المستشار الذكي", "نموذج — بحاجة تحقق"]) assert.ok(body.includes(w), w);
  assert.doesNotMatch(body, /الوكيل الذكي/);
  assert.match(body, /٣ عصراً إلى ١٠ مساءً/);
});

test("الإنجليزية: نصوصها ولا عربية متسرّبة في الهيكل", () => {
  const { body } = render("en");
  assert.match(body, /Investor guide/);
  assert.match(body, /Sample — needs verification/);
  const text = body.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
  // أسماء بعض الخدمات قد تبقى عربية لو فقدت ترجمتها؛ الهيكل لا.
  assert.doesNotMatch(text.replace(/﷼/g, ""), /دليل المستثمر|إجراءات الخدمات|الاتصال المرئي/);
});

test("مدخل الرئيسية: تسع بطاقات قطاعات + زر «افتح الدليل»، والمعرّف #how باقٍ، ولا خطوات الرحلة الستّ", () => {
  for (const lang of LANGS) {
    const href = (p) => (lang === "en" ? "" : "/" + lang) + p;
    const { html, css } = guideEntrance({ esc, href, lang: () => lang });
    assert.match(html, /^<section class="sv1-sec sv1-gray" id="how">/);
    assert.equal((html.match(/class="sv1-gh-card"/g) || []).length, 9);
    assert.ok(html.includes(`href="${href("/guide")}"`));
    for (const id of ["company-formation", "ai-automation"]) assert.ok(html.includes(`${href("/guide")}#journey-${id}`));
    assert.ok(css.includes("sv1-gd-home-css"));
    assert.doesNotMatch(html, /sv1-flow|wa\.me/);
    assert.equal((html.match(/<h1/g) || []).length, 0, "h1 واحد فقط في الرئيسية");
  }
});
