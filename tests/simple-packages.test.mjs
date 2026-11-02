// صفحة /packages على الموقع الجديد (simple-v1-packages.mjs). المقاس:
//   • كل باقة في catalog.json → packages (BP-PKG-*) تظهر في الصفحة، وزر «أضف للسلة»
//     لكل باقة بسعر فقط، وبند السلة id = pkg-<sku بأحرف صغيرة> و amount = رقم الكتالوج
//     نفسه (لا رقمٌ كتبته الصفحة)؛
//   • الباقة حسب الطلب (amount=null) لا زر سلة لها بل «اطلب عرضاً»؛
//   • لا رابط إلى /account القديم ولا إلى بوابة عروض الأسعار المتقاعدة ولا إلى الحاسبة؛
//   • كل رقم سعر يحمل price-amt (سياسة: الأسعار للمسجّلين فقط) ومعه data-guest-note.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { buildSimplePackages } = await import(pathToFileURL(path.join(ROOT, "site", "scripts", "simple-v1-packages.mjs")).href);
const site = JSON.parse(fs.readFileSync(path.join(ROOT, "site", "data", "site.json"), "utf8"));
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "site", "assets", "data", "catalog.json"), "utf8"));

const SV1 = { header: () => "", footer: () => "", shell: (o) => o };
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const build = (lang) => buildSimplePackages(SV1, { lang: () => lang, esc, site });
const pkgMap = (page) => JSON.parse(/var PK=(\{.*?\}),TX=/s.exec(page.script)[1]);

const pkgs = (catalog.packages || []).filter((p) => /^BP-PKG-/.test(p.code || ""));

test("catalog has the BP-PKG rows this page is built from", () => {
  assert.ok(pkgs.length >= 11);
});

for (const lang of ["ar", "en", "fr", "zh"]) {
  test(`/packages (${lang}): every catalog package is on the page with its catalog amount`, () => {
    const page = build(lang);
    const PK = pkgMap(page);
    for (const p of pkgs) {
      assert.ok(page.body.includes(`data-code="${p.code}"`), `${p.code} missing from page`);
      const e = PK[p.code];
      assert.ok(e, `${p.code} missing from cart map`);
      assert.equal(e.id, "pkg-" + p.code.toLowerCase());
      assert.equal(e.amount, p.amount, `${p.code} amount differs from catalog`);
      const addBtn = new RegExp(`class="sv1-btn [^"]*sv1-pk-add"[^>]*data-code="${p.code}"`);
      if (p.amount != null) assert.match(page.body, addBtn, `${p.code} has no add-to-cart button`);
      else assert.doesNotMatch(page.body, addBtn, `${p.code} is custom-priced and must not be sold from the cart`);
    }
  });
}

test("/packages: monthly packages are flagged monthly in the cart item (Tamara off, recurring label)", () => {
  const PK = pkgMap(build("ar"));
  for (const p of pkgs) assert.equal(PK[p.code].monthly, p.billingPeriod === "monthly", p.code);
});

test("/packages: no link to the old account, the retired quotes portal or the calculator", () => {
  const html = build("ar").body;
  assert.doesNotMatch(html, /href="[^"]*\/account/);
  assert.doesNotMatch(html, /quotes\/portal/);
  assert.doesNotMatch(html, /href="[^"]*\/calculator/);
  assert.doesNotMatch(html, /wa\.me|api\.whatsapp/);
});

test("/packages: prices carry price-amt with a guest note beside them", () => {
  const html = build("ar").body;
  const amts = html.match(/class="[^"]*price-amt[^"]*"/g) || [];
  const guest = html.match(/data-guest-note/g) || [];
  assert.ok(amts.length >= pkgs.filter((p) => p.amount != null).length);
  assert.ok(guest.length >= amts.length);
});

test("/packages: the management comparison inherits «كل ما في باقة …» rather than showing it as a row", () => {
  const html = build("ar").body;
  const cmp = /<div class="sv1-pk-cmp" id="cmp-management">[\s\S]*?<\/table>/.exec(html)[0];
  assert.doesNotMatch(cmp, /كل ما في باقة/);
  // Growth inherits Launch's five features: its column has a check on the first feature row.
  assert.match(cmp, /تشغيل وإدارة السجل التجاري/);
});
