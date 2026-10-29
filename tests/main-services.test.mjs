// «خدماتنا الرئيسية» (طلب المالك 2026-10-29): ست بطاقات تحت المحادثة في الرئيسية وفي /services.
// تقرأ الصفحات المولَّدة — شغّل `npm run build` قبلها.
//
// ما يُثبَت:
//  ١) الرئيسية: القسم بعد #advisor مباشرةً (قبل أي إضافة أخرى)، والأبواب والمحادثة فوقه كما كانت
//     (أربع بطاقات في الهيرو + باب EOR). وصفحة /services فيها القسم نفسه بالأربع لغات.
//  ٢) سبع بطاقات بترتيبها، لكل بطاقة (غير المخفية) أربعة أزرار: ابدأ الطلب · اسأل المستشار ·
//     تفاصيل الخدمة · الباقات والأسعار.
//  ٣) كل رابط في القسم يصل إلى صفحة مبنيّة؛ ولا رابط إلى صفحة مخفية (تطوير الأعمال).
//  ٤) لا سعر، لا واتساب، لا «شريك الأعمال»، لا «الوكيل»، ولا وعد بإلغاء مخالفة.
//  ٥) «اسأل المستشار» في الرئيسية يشير إلى أبواب موجودة فعلاً (#door-consulting/formation/government).
//  ٦) إطفاء المفتاح يُسقط القسم.
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { isHiddenHref, pageVisible } from "../site/scripts/hidden.mjs";
import { buildHomeExtras } from "../site/scripts/simple-v1-home-path.mjs";
import { MAIN_SERVICE_KEYS, askMap } from "../site/scripts/simple-v1-main-services.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = path.join(ROOT, "site");
const read = (p) => fs.readFileSync(path.join(SITE, p), "utf8");
const FILES = {
  home: { en: "index.html", ar: "ar/index.html", fr: "fr/index.html", zh: "zh/index.html" },
  services: { en: "services.html", ar: "ar/services.html", fr: "fr/services.html", zh: "zh/services.html" },
};
const LANGS = ["ar", "en", "fr", "zh"];

function pageFile(urlPath) {
  const p = urlPath.replace(/^\/+|\/+$/g, "");
  for (const f of [p ? p + ".html" : "index.html", p ? p + "/index.html" : "index.html"]) {
    if (fs.existsSync(path.join(SITE, f))) return f;
  }
  return null;
}
const sectionOf = (html) => {
  const a = html.indexOf('<section class="msv ');
  const b = html.indexOf("</section>", a);
  return a >= 0 && b > a ? html.slice(a, b + 10) : "";
};
const stripStyle = (s) => s.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");

for (const where of ["home", "services"]) {
  for (const lang of LANGS) {
    const html = read(FILES[where][lang]);
    const sec = sectionOf(html);

    test(`خدماتنا الرئيسية ${where} ${lang}: سبع بطاقات بترتيبها`, () => {
      assert.ok(sec, "القسم غير موجود");
      const keys = [...sec.matchAll(/data-msv="([a-z]+)"/g)].map((m) => m[1]);
      assert.deepEqual(keys, MAIN_SERVICE_KEYS);
      assert.equal((sec.match(/<h2[ >]/g) || []).length, 1);
    });

    test(`خدماتنا الرئيسية ${where} ${lang}: أزرار كل بطاقة وروابطها تصل إلى صفحات مبنيّة`, () => {
      const cards = sec.split('<article class="msv-card"').slice(1);
      assert.equal(cards.length, 7);
      for (const c of cards) {
        const key = /data-msv="([a-z]+)"/.exec(c)[1];
        const hrefs = [...c.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
        const soon = c.includes("msv-soon");
        assert.equal(hrefs.length, soon ? 1 : 4, `${key}: عدد الأزرار`);
        for (const h of hrefs) {
          assert.equal(isHiddenHref(h), false, `${key}: رابط مخفي ${h}`);
          const p = h.split(/[?#]/)[0];
          assert.ok(pageFile(p), `${key}: الوجهة غير مبنيّة ${h}`);
        }
      }
    });

    test(`خدماتنا الرئيسية ${where} ${lang}: لا سعر ولا واتساب ولا «شريك الأعمال» ولا «الوكيل» ولا وعد بالإلغاء`, () => {
      const txt = stripStyle(sec);
      assert.ok(!/\d[\d,.]*\s*(﷼|ر\.س|SAR|ريال)/.test(txt), "سعر ظاهر");
      assert.ok(!/wa\.me|whatsapp|sv1-btn wa/i.test(txt), "واتساب داخل المحتوى");
      assert.ok(!/شريك الأعمال|شريك أعمالك/.test(txt));
      assert.ok(!/الوكيل/.test(txt), "«الوكيل» تسميةً للمستشار");
      assert.ok(!/إلغاء المخالفة|ضمان|نضمن|guarantee/i.test(txt), "وعدٌ بنتيجة");
    });
  }
}

for (const lang of LANGS) {
  test(`الرئيسية ${lang}: القسم تحت المحادثة مباشرةً، والأبواب فوقها كما كانت`, () => {
    const html = read(FILES.home[lang]);
    const a = html.indexOf('id="advisor"');
    const m = html.indexOf('id="main-services"');
    assert.ok(a > 0 && m > a, "القسم ليس بعد #advisor");
    // لا شيء بين نهاية قسم المحادثة وبداية القسم غير إغلاقه
    const between = html.slice(a, m);
    assert.equal((between.match(/<section\b/g) || []).length, 1, "قسم آخر بين المحادثة وخدماتنا الرئيسية");
    const top = html.slice(0, a);
    for (const k of ["consulting", "government", "formation"]) assert.ok(top.includes(`id="door-${k}" data-door="${k}"`));
    assert.ok(top.includes('id="door-eor"'));
    assert.equal((top.match(/class="sv1-door[ "]/g) || []).length, 4);
    assert.ok(!top.includes('<section class="msv') && !top.includes('data-msv='), "شيء من القسم فوق المحادثة");
  });
}

test("اسأل المستشار: الأبواب المشار إليها موجودة في الرئيسية، وروابط /services تنقل إليها", () => {
  for (const lang of LANGS) {
    const home = read(FILES.home[lang]);
    const map = askMap(lang);
    for (const [k, v] of Object.entries(map)) assert.ok(home.includes(`id="door-${v.door}" data-door="${v.door}"`), `${k}: باب ${v.door} غير موجود`);
    // الباب الرابع مخفي → تطوير الأعمال يذهب إلى الاستشارات
    if (!pageVisible("business-development")) assert.equal(map.bizdev.door, "consulting");
    // بذور نص المحادثة بلغة الصفحة وبلا إرسال تلقائي
    assert.ok(map.compliance.text && map.shared.text && map.bizdev.text);
    const svc = sectionOf(read(FILES.services[lang]));
    const base = lang === "en" ? "/" : `/${lang}/`;
    assert.ok(svc.includes(`href="${base}?ask=compliance#advisor"`), `${lang}: رابط المستشار من /services`);
  }
  const home = read(FILES.home.ar);
  assert.ok(home.includes("new URLSearchParams(location.search).get('ask')"));
  assert.ok(!/\/api\/chat/.test(sectionOf(home)), "القسم لا ينادي المحادثة بنفسه");
});

test("تطوير الأعمال: صفحته مخفية ⇒ بطاقته بلا روابط إليها وبوسم «قريباً»", () => {
  if (pageVisible("business-development")) return;
  for (const lang of LANGS) {
    const sec = sectionOf(read(FILES.home[lang]));
    const card = sec.split('data-msv="bizdev"')[1].split("</article>")[0];
    assert.ok(card.includes("msv-soon"));
    assert.ok(!/business-development/.test(stripStyle(card).replace(/<li>[\s\S]*?<\/li>/g, "")), "رابط لصفحة مخفية");
  }
});

test("المفتاح: إطفاء mainServices يُسقط القسم", () => {
  const ctx = { esc: (s) => String(s), href: (p) => (p === "/" ? "/ar/" : "/ar" + p), lang: () => "ar" };
  assert.equal(buildHomeExtras({ ...ctx, flags: { mainServices: false } }).mainServices, "");
  const on = buildHomeExtras({ ...ctx, flags: { mainServices: true } });
  assert.ok(on.mainServices.includes('id="main-services"') && on.css.includes("msv-css") && on.script.includes("data-msv-ask"));
  const f = JSON.parse(read("data/features.json"));
  assert.ok(f.mainServices && typeof f.mainServices === "object");
});

test("خدمة الكوادر الوطنية المشتركة: اسم المالك، «قريباً» بزر المستشار وحده، بلا رابط إلى /shared-services القديمة", () => {
  const names = { ar: "خدمة الكوادر الوطنية المشتركة", en: "Shared National Talent service", fr: "Service des talents nationaux partagés", zh: "共享沙特人才服务" };
  for (const where of ["home", "services"]) {
    for (const lang of LANGS) {
      const sec = sectionOf(read(FILES[where][lang]));
      assert.ok(sec.includes(names[lang]), `${where} ${lang}: الاسم`);
      const card = sec.split('data-msv="shared"')[1].split("</article>")[0];
      assert.ok(card.includes("msv-soon"), "وسم قريباً");
      assert.equal((card.match(/<a\b/g) || []).length, 1, "زر المستشار وحده");
      assert.ok(!/shared-services/.test(sec), "رابط إلى /shared-services القديمة (فيها سعر)");
      assert.ok(!/الخدمات المشتركة|فريقك التنفيذي|BP-AI-04/.test(stripStyle(card)), "خلط مع فريق المستشارين الأذكياء");
      assert.ok(!/نطاقات|Nitaqat|كفالة|sponsorship/i.test(stripStyle(card)), "وعد أو ادّعاء نظامي في البطاقة");
    }
  }
});
