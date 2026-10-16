// صفحات تصنيف الخدمات (/services/category/*) — ٩ تصنيفات × ٤ لغات — على Simple V1.
//
// تُقرأ الصفحات المبنيّة في site/ وتُقارَن بالكتالوج (site/assets/data/catalog.json،
// وهو يُبنى من المصدر نفسه بعد تصفية الإخفاء) وبـ site/data/hidden.json:
//  • الجسم جديد (body.sv1-page، ترويسة وتذييل SV1، بلا main.js ولا طبقة القديم)؛
//  • بطاقة لكل خدمة ظاهرة في التصنيف، بلا خدمة مخفية؛
//  • المسعّرة بسعرها الحقيقي (بصنف price-amt وdata-bp-price) وزرّ السلة،
//    وغيرها «تحتاج عرض سعر» بلا رقم — ولا «سعر حسب حالتك» لخدمة مسعّرة؛
//  • بطاقة تطابق صفحة خدمتها: المسعّرة هناك مسعّرة هنا.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = path.join(REPO, "site");
const read = (p) => fs.readFileSync(p, "utf8");
const catalog = JSON.parse(read(path.join(SITE, "assets/data/catalog.json")));
const hidden = JSON.parse(read(path.join(SITE, "data/hidden.json")));
const hiddenCodes = new Set((hidden.services || []).map((c) => String(c).toLowerCase()));

const LANGS = ["en", "ar", "fr", "zh"];
const dir = (lang) => path.join(SITE, lang === "en" ? "" : lang, "services/category");
const slugOf = (key) => key.toLowerCase().replace(/\s+/g, "-");
const NO_CART = new Set(["Real Estate", "Tourism"]);
const isPriced = (s) => s.amount != null && Number(s.amount) > 0 && !NO_CART.has(s.category);

const cats = [...new Set(catalog.services.map((s) => s.category))];

test("الكتالوج يحوي تسعة تصنيفات ولا خدمة مخفية فيه", () => {
  assert.equal(cats.length, 9);
  for (const s of catalog.services) assert.ok(!hiddenCodes.has(s.code.toLowerCase()), s.code + " مخفية لكنها في الكتالوج");
});

for (const lang of LANGS) {
  for (const key of cats) {
    test(`${lang}/${slugOf(key)}: تصميم الموقع الجديد وقائمة الخدمات والأسعار`, () => {
      const file = path.join(dir(lang), slugOf(key) + ".html");
      assert.ok(fs.existsSync(file), "الصفحة غير مبنيّة: " + file);
      const html = read(file);

      // الجسم والقشرة
      assert.match(html, /<body class="sv1-page">/);
      assert.ok(html.includes('class="sv1-hdr') && html.includes('class="sv1-foot'), "ترويسة وتذييل SV1");
      assert.ok(!/assets\/js\/main\.js/.test(html), "لا main.js");
      assert.ok(!/bp-public-brand-v5/.test(html), "لا طبقة القديم");
      assert.ok(!/class="[^"]*\bsvc-card\b/.test(html), "لا بطاقات القديم");
      assert.ok(!/سعر حسب حالتك|Custom quote/.test(html), "لا «سعر حسب حالتك» في صفحة التصنيف");
      assert.match(html, /<h1>[^<]+<\/h1>/);

      // البطاقات = خدمات التصنيف الظاهرة بالضبط
      const want = catalog.services.filter((s) => s.category === key);
      const cards = [...html.matchAll(/<article class="sv1-cp-card"[\s\S]*?<\/article>/g)].map((m) => m[0]);
      assert.equal(cards.length, want.length, "عدد البطاقات");
      const prefix = lang === "en" ? "" : "/" + lang;
      for (const s of want) {
        const slug = s.code.toLowerCase();
        const card = cards.find((c) => c.includes(`href="${prefix}/services/${slug}"`));
        assert.ok(card, "بطاقة " + s.code);
        if (isPriced(s)) {
          assert.ok(card.includes(`data-bp-price="${s.code.toUpperCase()}"`), s.code + ": سعر حيّ");
          assert.match(card, /class="sv1-cp-amt price-amt"/, s.code + ": السعر بصنف price-amt (للمسجَّل وحده)");
          assert.ok(card.includes(`data-id="svc-${slug}"`) && card.includes(`data-amount="${s.amount}"`), s.code + ": زرّ السلة بالمبلغ نفسه");
          assert.ok(!card.includes("sv1-cp-need"), s.code + ": مسعّرة فلا «تحتاج عرض سعر»");
          // الرقم المعروض هو رقم الكتالوج
          const shown = card.match(/data-bp-pending>([^<]*)</)[1].replace(/[^\d]/g, "");
          assert.equal(shown.slice(0, String(s.amount).length), String(s.amount).replace(/,/g, ""), s.code + ": " + shown);
          if (s.requiresProposal) assert.ok(card.includes("sv1-cp-quote"), s.code + ": تتطلب عرضاً فيظهر زرّه");
        } else {
          assert.ok(card.includes("sv1-cp-need"), s.code + ": «تحتاج عرض سعر»");
          assert.ok(!card.includes("data-bp-price") && !card.includes("sv1-cp-add") && !card.includes("price-amt"), s.code + ": لا سعر ولا سلة");
        }
      }
      // لا خدمة مخفية ولا رابطٌ إليها
      for (const code of hiddenCodes) assert.ok(!html.toLowerCase().includes("/services/" + code), "مخفية: " + code);
    });
  }
}

test("بطاقة التصنيف تطابق صفحة خدمتها: المسعّرة هناك مسعّرة هنا (ar)", () => {
  for (const key of cats) {
    const html = read(path.join(dir("ar"), slugOf(key) + ".html"));
    for (const s of catalog.services.filter((x) => x.category === key)) {
      const detail = read(path.join(SITE, "ar/services", s.code.toLowerCase() + ".html"));
      const detailHasCart = detail.includes('id="svcAdd"');
      const cardHasCart = new RegExp(`data-id="svc-${s.code.toLowerCase()}"`).test(html);
      assert.equal(cardHasCart, detailHasCart, s.code + ": زرّ السلة في البطاقة وصفحة الخدمة");
    }
  }
});

test("صفحات التصنيف ترتبط ببعضها وبفتات الخبز الصحيحة", () => {
  const html = read(path.join(dir("ar"), "company-formation.html"));
  for (const k of cats.filter((c) => c !== "Company Formation")) assert.ok(html.includes(`/ar/services/category/${slugOf(k)}"`), "تصنيف آخر: " + k);
  assert.ok(html.includes('href="/ar/catalog"'), "رابط الكتالوج");
});
