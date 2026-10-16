// محفول مكفول: «أرسل طلبي» في فعاليات الشركات وزيارة المستثمر يصل فعلاً إلى المستشار.
//
// العطل (شكوى المالك): في /ar/trips?line=corp يختار العميل بطاقةً ويضغط «أرسل طلبي»
// فيُنقَل إلى الرئيسية بمحادثةٍ فارغة وكأن طلبه لم يُرسَل. السبب: الصفحة كانت تكتب
// sessionStorage['sv1_handoff'] بينما الرئيسية لا تقرأ إلا ['bp_sva_request'] (بحقول
// items/door/text/at) — فيضيع الاختيار بصمت. العطل منذ إنشاء الصفحة (a6403f2b6).
//
// ما يُثبَت:
//  ١) ثابت (كل اللغات): الصفحة تكتب المفتاح الذي تقرؤه الرئيسية، ولا أثر لـsv1_handoff،
//     وفيها رسالة الفشل الصادقة.
//  ٢) بمتصفح حقيقي (إن وُجد Chromium) على الصفحات المبنيّة:
//     أ) فعاليات الشركات، بطاقة «فعالية داخل مقر الشركة» ← الرئيسية بمحادثةٍ فيها اختياره
//        ونطاقٌ فيه بندُه — لا محادثة فارغة.
//     ب) زيارة المستثمر المكتملة ← الرئيسية بمحادثةٍ تحمل كل خياراته.
//     ج) تخزين المتصفح ممنوع: لا ننتقل، ويبقى الاختيار، وتظهر رسالة الفشل (لا «خطأ» صامت).
//     د) الرحلات السياحية: «أضف إلى طلبي» ← السلة ← صفحة الدفع تعرض الرحلة.
//     هـ) لا استثناء في صفحة الرحلات في أي من الخطوط الثلاثة.
//  الخادم هنا ثابتٌ بلا api/: لا شيء يُرسَل لأي جهة.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = path.join(ROOT, "site");
const read = (p) => fs.readFileSync(path.join(SITE, p), "utf8");
const PAGES = { en: "trips.html", ar: "ar/trips.html", fr: "fr/trips.html", zh: "zh/trips.html" };
const HOMES = { en: "index.html", ar: "ar/index.html", fr: "fr/index.html", zh: "zh/index.html" };

for (const [lang, file] of Object.entries(PAGES)) {
  test(`الرحلات ${lang}: التسليم للمستشار بالمفتاح الذي تقرؤه الرئيسية`, () => {
    const html = read(file);
    const home = read(HOMES[lang]);
    assert.ok(home.includes("sessionStorage.getItem('bp_sva_request')"), "الرئيسية تقرأ bp_sva_request");
    assert.ok(html.includes("sessionStorage.setItem('bp_sva_request'"), "الرحلات تكتب bp_sva_request");
    assert.ok(!/sv1_handoff/.test(html.replace(/\/\/[^\n]*/g, "")), "لا مفتاح يتيم يكتبه أحدٌ ولا يقرؤه أحد");
    assert.ok(/door:'consulting'/.test(html) && /at:Date\.now\(\)/.test(html), "الشكل: door و at (وإلا تتجاهله الرئيسية)");
    assert.ok(/تعذّر تسليم طلبك|couldn't hand your request|Impossible de transmettre|无法将您的请求/.test(html), "رسالة الفشل الصادقة موجودة");
  });
}

// ------------------------------------------------------- بمتصفح حقيقي (اختياري)
let chromium = null;
for (const spec of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"]) {
  try { ({ chromium } = await import(spec)); break; } catch {}
}

function pageFile(urlPath) {
  const p = urlPath.replace(/^\/+|\/+$/g, "");
  for (const f of [p ? p + ".html" : "index.html", p ? p + "/index.html" : "index.html"]) {
    if (fs.existsSync(path.join(SITE, f))) return f;
  }
  return null;
}
function serve() {
  const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml" };
  const srv = http.createServer((req, res) => {
    const pth = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let f = null;
    const direct = path.join(SITE, pth);
    if (pth !== "/" && !pth.endsWith("/") && fs.existsSync(direct) && fs.statSync(direct).isFile()) f = direct;
    else { const pf = pageFile(pth); if (pf) f = path.join(SITE, pf); }
    if (!f || !f.startsWith(SITE)) { res.writeHead(404); res.end("nf"); return; }
    res.writeHead(200, { "content-type": mime[path.extname(f)] || "application/octet-stream" });
    res.end(fs.readFileSync(f));
  });
  return new Promise((r) => srv.listen(0, "127.0.0.1", () => r(srv)));
}

// ملء مُهيّئ زيارة المستثمر: أول خيار في كل مجموعةٍ ظاهرة حتى تكتمل الحقول المطلوبة.
async function fillInvestor(page) {
  for (let k = 0; k < 8; k++) {
    const n = await page.locator("#trInvForm .sv1-cfg-g").count();
    for (let i = 0; i < n; i++) {
      const g = page.locator("#trInvForm .sv1-cfg-g").nth(i);
      if ((await g.locator(".sv1-cfg-o").count()) && !(await g.locator(".sv1-cfg-o.on").count())) await g.locator(".sv1-cfg-o").first().click();
    }
  }
}

test("بمتصفح حقيقي: «أرسل طلبي» يصل المستشار في الخطوط الثلاثة، والفشل صادقٌ ولا يضيّع الاختيار", { skip: !chromium && "playwright/Chromium غير متاح" }, async () => {
  const srv = await serve();
  const base = "http://127.0.0.1:" + srv.address().port;
  let browser;
  const errors = [];
  const watch = (page) => page.on("pageerror", (e) => errors.push(e.message));
  const msgs = (page) => page.$$eval("#sv1Msgs > *", (e) => e.map((x) => x.textContent));
  try {
    browser = await chromium.launch();

    // أ) فعاليات الشركات — البطاقة التي اشتكى منها المالك
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ar-SA" });
      const page = await ctx.newPage(); watch(page);
      await page.goto(base + "/ar/trips?line=corp", { waitUntil: "load" });
      await page.locator("#trCorpList .sv1-tr-pick", { hasText: "فعالية داخل مقر الشركة" }).click();
      await page.click("#trCorpGo");
      await page.waitForURL(/\/ar\/#advisor$/);
      await page.waitForSelector("#sv1Msgs > *");
      const m = await msgs(page);
      assert.ok(m[0].includes("فعالية داخل مقر الشركة"), "المحادثة تبدأ باختياره، لا فارغة: " + m[0]);
      const scope = await page.$$eval("#sv1Items > *", (e) => e.map((x) => x.textContent));
      assert.ok(scope.some((x) => x.includes("فعالية داخل مقر الشركة")), "بندُه في نطاق الطلب");
      await ctx.close();
    }

    // أ-٢) عدة بطاقات
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ar-SA" });
      const page = await ctx.newPage(); watch(page);
      await page.goto(base + "/ar/trips?line=corp", { waitUntil: "load" });
      await page.locator("#trCorpList .sv1-tr-pick", { hasText: "اليوم الوطني" }).click();
      await page.locator("#trCorpList .sv1-tr-pick", { hasText: "افتتاح فرع" }).click();
      await page.click("#trCorpGo");
      await page.waitForURL(/\/ar\/#advisor$/);
      await page.waitForSelector("#sv1Msgs > *");
      const scope = await page.$$eval("#sv1Items > *", (e) => e.map((x) => x.textContent));
      assert.ok(scope.some((x) => x.includes("اليوم الوطني")) && scope.some((x) => x.includes("افتتاح فرع")), "البنود كلها في النطاق: " + scope.join("|"));
      await ctx.close();
    }

    // ب) زيارة المستثمر
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ar-SA" });
      const page = await ctx.newPage(); watch(page);
      await page.goto(base + "/ar/trips?line=inv", { waitUntil: "load" });
      await page.click("#trInvGo");
      assert.match(await page.textContent("#trInvErr"), /^أكمل:/, "الحقول المطلوبة تُطلَب قبل الإرسال");
      assert.ok(page.url().includes("/trips"), "لا انتقال قبل اكتمال الحقول");
      await fillInvestor(page);
      assert.equal((await page.textContent("#trInvErr")).trim(), "");
      await page.click("#trInvGo");
      await page.waitForURL(/\/ar\/#advisor$/);
      await page.waitForSelector("#sv1Msgs > *");
      const m = await msgs(page);
      assert.ok(m[0].startsWith("زيارة المستثمر:") && m[0].includes("المدن:"), "المحادثة تحمل خيارات الزيارة: " + m[0]);
      await ctx.close();
    }

    // ج) المتصفح يمنع التخزين: لا انتقال صامت، ورسالة صادقة، والاختيار باقٍ
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ar-SA" });
      const page = await ctx.newPage(); watch(page);
      await page.addInitScript(() => {
        const orig = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) { if (k === "bp_sva_request") throw new Error("QuotaExceededError"); return orig.call(this, k, v); };
      });
      await page.goto(base + "/ar/trips?line=corp", { waitUntil: "load" });
      await page.locator("#trCorpList .sv1-tr-pick", { hasText: "فعالية داخل مقر الشركة" }).click();
      await page.click("#trCorpGo");
      await page.waitForTimeout(400);
      assert.ok(page.url().includes("/trips"), "بقي في الصفحة");
      assert.match(await page.textContent("#trCorpN"), /تعذّر تسليم طلبك/, "رسالة صادقة لا «خطأ»");
      assert.equal(await page.locator("#trCorpList .sv1-tr-pick.on").count(), 1, "الاختيار لم يضع");
      assert.equal(await page.locator("#trCorpList input:checked").count(), 1);
      // الزيارة: يبقى ما أدخله
      await page.goto(base + "/ar/trips?line=inv", { waitUntil: "load" });
      await fillInvestor(page);
      const before = await page.locator("#trInvForm .sv1-cfg-o.on").count();
      await page.click("#trInvGo");
      await page.waitForTimeout(400);
      assert.ok(page.url().includes("/trips"));
      assert.match(await page.textContent("#trInvErr"), /تعذّر تسليم طلبك/);
      assert.equal(await page.locator("#trInvForm .sv1-cfg-o.on").count(), before, "خيارات الزيارة باقية");
      await ctx.close();
    }

    // د) الرحلات السياحية ← السلة ← الدفع
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ar-SA" });
      const page = await ctx.newPage(); watch(page);
      await page.goto(base + "/ar/trips?line=tour", { waitUntil: "load" });
      await page.locator("#trGrid button", { hasText: "أضف إلى طلبي" }).first().click();
      assert.equal((await page.textContent("#trTrayN")).trim(), "1");
      await page.click("#trGo");
      await page.waitForURL(/\/ar\/checkout/);
      await page.waitForSelector("#coItems > *");
      assert.ok((await page.textContent("#coItems")).trim().length > 0, "الرحلة في صفحة الدفع");
      await ctx.close();
    }

    // هـ) لا استثناء في أي خطٍّ، بأربع لغات
    for (const lang of ["ar", "en", "fr", "zh"]) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await ctx.newPage(); watch(page);
      for (const line of ["inv", "tour", "corp"]) {
        await page.goto(base + (lang === "en" ? "" : "/" + lang) + "/trips?line=" + line, { waitUntil: "load" });
        await page.waitForTimeout(150);
      }
      await ctx.close();
    }
    assert.deepEqual(errors, [], "استثناءات في المتصفح: " + errors.join(" | "));
  } finally {
    if (browser) await browser.close();
    srv.close();
  }
});
