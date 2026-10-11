// الرئيسية الجديدة: المحادثة بأبوابها هي الأساس في الأعلى كما كانت، وأي إضافة تأتي
// تحتها فقط وبمفتاح (أمر المالك 2026-10-11: «لو في تعديلات تكون تحت المحادثة اللي
// هي أساس الموقع»). تقرأ الصفحات المولَّدة — شغّل `npm run build` قبلها.
//
// ما يُثبَت:
//  ١) الأعلى كما كان: h1 واحد، الأبواب الثلاثة + بطاقة EOR + رابط «تصفّح الخدمات واشترِ
//     مباشرة» داخل الهيرو، ثم قسم المحادثة #advisor — ولا بطاقات مسار ولا بحث فوقه.
//  ٢) الإضافات (search · how · popular · faq) كلها بعد #advisor، ولا واحدة قبله، وكل
//     واحدة تُزال بمفتاحها في site/data/features.json (homeExtras) عبر buildHomeExtras.
//  ٣) لا رابط مخفي، لا واتساب في المحتوى، لا «شريك الأعمال»، لا سعر في الإضافات، ولا باب
//     «تطوير الأعمال» (مخفي).
//  ٤) وجهات الإضافات موجودة في الموقع المبني وبتصميم SV1 (body.sv1-page بلا main.js).
//  ٥) /catalog يقرأ ?door= و?q=.
//  ٦) بمتصفح حقيقي (إن وُجد Chromium): الأبواب فوق الطيّ، الإضافات تحت المحادثة، البحث يقترح
//     وينتقل، وضغط باب المستشار يغيّر سياقه.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { isHiddenHref } from "../site/scripts/hidden.mjs";
import { buildHomeExtras, HOME_EXTRAS_TEXT, HOME_EXTRA_KEYS, homeExtraFlags } from "../site/scripts/simple-v1-home-path.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = path.join(ROOT, "site");
const HOMES = { en: "index.html", ar: "ar/index.html", fr: "fr/index.html", zh: "zh/index.html" };
const read = (p) => fs.readFileSync(path.join(SITE, p), "utf8");
const pre = (lang) => (lang === "en" ? "" : "/" + lang);
const FLAGS = homeExtraFlags();

// صفحة مبنيّة لمسارٍ عام: /x → x.html ، /x/ → x/index.html ، / → index.html
function pageFile(urlPath) {
  const p = urlPath.replace(/^\/+|\/+$/g, "");
  for (const f of [p ? p + ".html" : "index.html", p ? p + "/index.html" : "index.html"]) {
    if (fs.existsSync(path.join(SITE, f))) return f;
  }
  return null;
}
// معاينة اللوحة داخل الرئيسية فيها <main class="sv1-pmain"> لذا نقصّ من <main> إلى آخر </main>.
const mainOf = (html) => { const a = html.indexOf("<main>"); const b = html.lastIndexOf("</main>"); return a >= 0 && b > a ? html.slice(a + 6, b) : ""; };
const stripScripts = (s) => s.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");

for (const [lang, file] of Object.entries(HOMES)) {
  const html = read(file);
  const main = mainOf(html);
  const advisorAt = main.indexOf('id="advisor"');

  test(`الرئيسية ${lang}: الأعلى كما كان — h1 واحد، ثلاثة أبواب + EOR + تصفّح مباشر، ثم المحادثة`, () => {
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, "h1 واحد");
    assert.ok(advisorAt > 0, "قسم المحادثة غير موجود");
    const top = main.slice(0, advisorAt);
    for (const k of ["consulting", "government", "formation"]) {
      assert.ok(top.includes(`id="door-${k}" data-door="${k}"`), `باب ${k} ليس فوق المحادثة`);
    }
    assert.ok(top.includes('id="door-eor"'), "بطاقة EOR فوق المحادثة");
    assert.equal((top.match(/class="sv1-door[ "]/g) || []).length, 4, "أربع بطاقات: ثلاثة أبواب + EOR");
    assert.ok(top.includes('class="sv1-browse"') && top.includes('href="' + (lang === "en" ? "" : "/" + lang) + '/catalog"'), "رابط تصفّح الخدمات واشترِ مباشرة");
    // لا شيء من مسار الزائر المُلغى
    for (const bad of ["sv1-pcard", 'id="hpCards"', "sv1-path", "sv1-pask"]) assert.ok(!html.includes(bad), "بقايا مسار الزائر: " + bad);
    // الصفحة الجديدة: ترويسة SV1 وبلا main.js القديم
    assert.ok(html.includes('class="sv1-page"'));
    assert.ok(!/<script[^>]+src="[^"]*main\.js/.test(html));
    // المحادثة بأدواتها
    assert.ok(html.includes('id="sv1Create"'));
    assert.ok(!html.includes('data-door="bizdev"'));
  });

  test(`الرئيسية ${lang}: كل إضافة تحت المحادثة فقط ولا شيء منها فوقها`, () => {
    const ids = { search: "find", how: "how-steps", popular: "popular", faq: "faq" };
    // لا علامة إضافة قبل المحادثة
    assert.ok(!main.slice(0, advisorAt).includes("data-home-extra"), "إضافة فوق المحادثة");
    assert.ok(!main.slice(0, advisorAt).includes('id="hpSearch"'), "بحث فوق المحادثة");
    let last = advisorAt;
    for (const k of HOME_EXTRA_KEYS) {
      const at = main.indexOf(`data-home-extra="${k}"`);
      if (FLAGS[k]) {
        assert.ok(at > advisorAt, `${k} يجب أن يأتي بعد المحادثة`);
        assert.ok(at > last, `ترتيب ${k}`);
        assert.ok(main.includes(`id="${ids[k]}"`), `معرّف ${k}`);
        last = at;
      } else {
        assert.equal(at, -1, `${k} مُطفأ لكنه ظاهر`);
      }
    }
    // «كيف نبدأ» في الترويسة ما زال يرسو على رحلة الستّ خطوات الأصلية لا على الإضافة
    assert.ok(main.includes('<section class="sv1-sec sv1-gray" id="how">'), "قسم الرحلة الأصلي #how");
    // المعرّفات لا تتكرر
    const idList = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    for (const id of ["how", "how-steps", "find", "popular", "faq", "advisor"]) assert.ok(idList.filter((x) => x === id).length <= 1, "معرّف مكرّر " + id);
  });

  test(`الرئيسية ${lang}: نصوص حقيقية بلا مفاتيح خام ولا واتساب ولا «شريك الأعمال»`, () => {
    for (const [k, e] of Object.entries(HOME_EXTRAS_TEXT)) {
      assert.ok(typeof e[lang] === "string" && e[lang].trim(), `${k} بلا نص ${lang}`);
    }
    const shown = {
      search: ["findTitle", "findSub", "findGo"], how: ["how", "s1", "s4", "t1"],
      popular: ["popular", "details", "all"], faq: ["faq", "q1", "a4"],
    };
    for (const k of HOME_EXTRA_KEYS) {
      if (!FLAGS[k]) continue;
      for (const key of shown[k]) {
        const txt = HOME_EXTRAS_TEXT[key][lang];
        assert.ok(main.includes(txt.replace(/&/g, "&amp;")) || main.includes(txt), `${key} غائب`);
      }
    }
    // زر «أكمل على واتساب» في هيرو الرئيسية القديمة (المعتمدة من المالك) عاد كما كان؛ الإضافات الجديدة بلا واتساب
    const extras = [...main.matchAll(/<section[^>]*data-home-extra[\s\S]*?<\/section>/g)].map((m) => m[0]).join("");
    assert.ok(!/wa\.me|api\.whatsapp|whatsapp/i.test(extras) && !/sv1-btn wa/.test(extras), "واتساب داخل الإضافات");
    assert.ok(!/شريك الأعمال|شريك أعمالك/.test(html), "الاسم يبقى Business Partner");
    assert.ok(html.includes('alt="Business Partner"'));
    assert.ok(!/الوكيل/.test(extras), "«الوكيل» تسميةً للمستشار في الإضافات");
  });

  test(`الرئيسية ${lang}: لا رابط إلى صفحة مخفية، ولا باب «تطوير الأعمال»`, () => {
    const hrefs = [...html.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(hrefs.length > 10);
    for (const h of hrefs) assert.equal(isHiddenHref(h), false, `رابط مخفي: ${h}`);
    assert.ok(!html.includes('data-door="bizdev"'));
    assert.ok(!/business-development/.test(main));
  });

  test(`الرئيسية ${lang}: وجهات الإضافات موجودة وبتصميم SV1`, () => {
    const popular = [...main.matchAll(/<a class="sv1-btn sm" href="([^"]*\/services\/[^"]+)"/g)].map((m) => m[1]);
    if (FLAGS.popular) {
      assert.ok(popular.length >= 4 && popular.length <= 6, "الخدمات الشائعة: " + popular.length);
      assert.equal((main.match(/data-pop="\d"/g) || []).length > 0, true, "زر أضف للسلة للمسعّر");
    } else assert.equal(popular.length, 0);
    const doors = ["/eor", `${pre(lang)}/catalog`];
    const dests = [...doors.map((d) => (d === "/eor" ? `${pre(lang)}/eor` : d)), ...popular];
    if (FLAGS.search) assert.match(html, new RegExp(`<form class="sv1-psearch" id="hpSearch" action="${pre(lang)}/catalog" method="get"`));
    for (const d of dests) {
      const f = pageFile(d.split(/[?#]/)[0]);
      assert.ok(f, `الوجهة غير مبنيّة: ${d}`);
      const dest = read(f);
      assert.ok(dest.includes('class="sv1-page"'), `وجهة قديمة: ${d}`);
      assert.ok(!/<script[^>]+src="[^"]*main\.js/.test(dest), `وجهة تحمّل main.js القديم: ${d}`);
    }
  });

  test(`/catalog ${lang}: يقرأ ?door= و?q=`, () => {
    const cat = read(`${lang === "en" ? "" : lang + "/"}catalog.html`);
    assert.ok(cat.includes("new URLSearchParams(location.search)"));
    assert.ok(cat.includes("QS.get('door')") && cat.includes("QS.get('q')"));
    assert.ok(cat.includes('id="catFilter"'));
    for (const k of ["formation", "government", "consulting"]) assert.ok(cat.includes(`"${k}":`), `اسم الباب ${k}`);
  });
}

test("كل إضافة تُزال بمفتاحها وحده، وبلا مفاتيح تعود الرئيسية بلا إضافات", () => {
  const ctx = { esc: (s) => String(s), href: (p) => (p === "/" ? "/ar/" : "/ar" + p), lang: () => "ar" };
  const none = buildHomeExtras({ ...ctx, flags: { search: false, how: false, popular: false, faq: false } });
  assert.deepEqual([none.search, none.how, none.popular, none.faq, none.css, none.script], ["", "", "", "", "", ""]);
  const marks = { search: 'data-home-extra="search"', how: 'data-home-extra="how"', popular: 'data-home-extra="popular"', faq: 'data-home-extra="faq"' };
  for (const k of HOME_EXTRA_KEYS) {
    const only = buildHomeExtras({ ...ctx, flags: { search: false, how: false, popular: false, faq: false, [k]: true } });
    for (const j of HOME_EXTRA_KEYS) {
      if (j === k) assert.ok(only[j].includes(marks[j]), `${k} لم يُرسم`);
      else assert.equal(only[j], "", `${j} ظهر والمفتاح مُطفأ`);
    }
    assert.ok(only.css.includes("sv1-extras-css"));
  }
  // الشائعة بلا مبلغ
  const pop = buildHomeExtras({ ...ctx, flags: { popular: true } }).popular;
  assert.ok(pop.length > 0 && !/\d[\d,.]*\s*(﷼|ر\.س|SAR|ريال)/.test(pop), "سعر في الخدمات الشائعة");
});

test("features.json: homeExtras مفتاحه موجود ويقبل الأربعة", () => {
  const f = JSON.parse(read("data/features.json"));
  assert.ok(f.homeExtras && typeof f.homeExtras === "object");
  for (const k of Object.keys(f.homeExtras)) assert.ok(HOME_EXTRA_KEYS.includes(k), "مفتاح مجهول " + k);
});

test("الخدمات الشائعة: كلها في الكتالوج الظاهر، وكل خدمة مبنية لها صفحة", () => {
  const cat = JSON.parse(read("assets/data/catalog.json"));
  const codes = new Set(cat.services.map((s) => s.code));
  const html = read("ar/index.html");
  const slugs = [...mainOf(html).matchAll(/href="\/ar\/services\/([^"]+)"/g)].map((m) => m[1]);
  for (const s of slugs) {
    assert.ok(codes.has(s.toUpperCase()), `${s} ليست في الكتالوج الظاهر`);
    assert.ok(pageFile(`/ar/services/${s}`), `${s} بلا صفحة`);
  }
});

test("لا سعر في الإضافات (SHOW_PRICES=false)", () => {
  for (const file of Object.values(HOMES)) {
    const m = mainOf(read(file));
    const extras = [...m.matchAll(/<section[^>]*data-home-extra[\s\S]*?<\/section>/g)].map((x) => stripScripts(x[0])).join("");
    assert.ok(!/\d[\d,.]*\s*(﷼|ر\.س|SAR|ريال)/.test(extras), "سعر ظاهر في الإضافات " + file);
  }
});

// ------------------------------------------------------- بمتصفح حقيقي (اختياري)
let chromium = null;
for (const spec of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"]) {
  try { ({ chromium } = await import(spec)); break; } catch {}
}

function serve() {
  const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml" };
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    const pth = decodeURIComponent(u.pathname);
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

test("بمتصفح حقيقي: الأبواب فوق الطيّ، الإضافات تحت المحادثة، البحث يعمل", { skip: !chromium && "playwright/Chromium غير متاح" }, async () => {
  const srv = await serve();
  const base = "http://127.0.0.1:" + srv.address().port;
  let browser;
  try {
    browser = await chromium.launch();
    for (const lang of ["ar", "en"]) {
      for (const [w, h] of [[390, 844], [1280, 800]]) {
        const ctx = await browser.newContext({ viewport: { width: w, height: h } });
        const page = await ctx.newPage();
        await page.goto(base + (lang === "en" ? "/" : "/" + lang + "/"), { waitUntil: "load" });
        const r = await page.evaluate(() => {
          const top = (el) => (el ? el.getBoundingClientRect().top + scrollY : null);
          return {
            h1: document.querySelectorAll("h1").length,
            h1top: top(document.querySelector("h1")),
            doorTop: top(document.getElementById("door-consulting")),
            advisor: top(document.getElementById("advisor")),
            find: top(document.getElementById("find")),
            steps: top(document.getElementById("how-steps")),
            pop: top(document.getElementById("popular")),
            faq: top(document.getElementById("faq")),
            overflow: document.documentElement.scrollWidth - innerWidth,
          };
        });
        const tag = `${lang} ${w}x${h}`;
        assert.equal(r.h1, 1, tag + " h1");
        assert.ok(r.doorTop != null && r.doorTop < r.advisor, tag + " الأبواب فوق المحادثة");
        assert.ok(r.h1top < r.advisor, tag + " العنوان فوق المحادثة");
        for (const [k, v] of Object.entries({ find: r.find, steps: r.steps, pop: r.pop, faq: r.faq })) {
          if (v != null) assert.ok(v > r.advisor, `${tag} ${k} يجب أن يكون تحت المحادثة`);
        }
        assert.ok(r.overflow <= 1, tag + " تمرير أفقي " + r.overflow);
        await ctx.close();
      }
    }

    // البحث: اقتراح فوري ثم صفحة الخدمة، و«كل النتائج» تحمل ?q= فيعرضها الكتالوج
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    if (FLAGS.search) {
      await page.goto(base + "/ar/", { waitUntil: "load" });
      await page.fill("#hpQ", "تجديد سجل تجاري");
      await page.waitForSelector("#hpSug a");
      const sugs = await page.$$eval("#hpSug a:not(.all)", (els) => els.map((e) => [e.textContent.trim(), e.getAttribute("href")]));
      assert.ok(sugs.some(([n, h]) => n.includes("تجديد سجل تجاري") && h === "/ar/services/bp-sbc-19"), JSON.stringify(sugs));
      await page.press("#hpQ", "Enter");
      await page.waitForURL(/\/ar\/catalog\?q=/);
      await page.waitForSelector(".sv1-grp.open");
      assert.equal(await page.inputValue("#svcQ"), "تجديد سجل تجاري");
    }

    // باب الحكومية في الأعلى يغيّر سياق المحادثة كما كان
    await page.goto(base + "/ar/", { waitUntil: "load" });
    await page.click("#door-government");
    assert.equal(await page.$eval("#door-government", (e) => e.classList.contains("on")), true);
    assert.equal(await page.$eval("#door-consulting", (e) => e.classList.contains("on")), false);
    await ctx.close();
  } finally {
    if (browser) await browser.close();
    srv.close();
  }
});
