// مسار الزائر في الرئيسية الجديدة (أمر المالك 2026-10-10: «مسار واضح للعميل أول ما يدخل الموقع»).
// تقرأ الصفحات المولَّدة — شغّل `npm run build` قبلها.
//
// ما يُثبَت:
//  ١) في كل لغة: h1 واحد، أربع بطاقات مسارات، مربع بحث، لا زر واتساب في المحتوى،
//     ولا نصّ خام (مفتاح قاموس) ولا «شريك الأعمال».
//  ٢) لا رابط في الرئيسية إلى صفحة مخفية (site/data/hidden.json) — والباب الرابع
//     «تطوير الأعمال» لا يظهر بطاقةً ولا رقاقةً.
//  ٣) وجهات البطاقات موجودة في الموقع المبني وبتصميم Simple V1 (body.sv1-page بلا main.js).
//  ٤) /catalog يقرأ ?door= و?q= (معامل التصفية الذي تستعمله البطاقتان والبحث).
//  ٥) بمتصفح حقيقي (إن وُجد Chromium): h1 والبطاقات الأربع ومربع البحث ظاهرة فوق الطيّ
//     على 390×844 و1280×800، وضغط بطاقة التأسيس يصل /catalog مصفّى، وبحث «تجديد سجل تجاري»
//     يعرض اقتراحاً يؤدي إلى صفحة الخدمة.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { isHiddenHref } from "../site/scripts/hidden.mjs";
import { SV1_TEXT } from "../site/scripts/simple-v1.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = path.join(ROOT, "site");
const HOMES = { en: "index.html", ar: "ar/index.html", fr: "fr/index.html", zh: "zh/index.html" };
const read = (p) => fs.readFileSync(path.join(SITE, p), "utf8");
const pre = (lang) => (lang === "en" ? "" : "/" + lang);

// صفحة مبنيّة لمسارٍ عام: /x → x.html ، /x/ → x/index.html ، / → index.html
function pageFile(urlPath) {
  const p = urlPath.replace(/^\/+|\/+$/g, "");
  for (const f of [p ? p + ".html" : "index.html", p ? p + "/index.html" : "index.html"]) {
    if (fs.existsSync(path.join(SITE, f))) return f;
  }
  return null;
}
const mainOf = (html) => (html.match(/<main>([\s\S]*?)<\/main>/) || [, ""])[1];

for (const [lang, file] of Object.entries(HOMES)) {
  const html = read(file);
  const main = mainOf(html);

  test(`الرئيسية ${lang}: h1 واحد، أربع بطاقات مسارات، مربع بحث`, () => {
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, "h1 واحد");
    assert.equal((html.match(/<a class="sv1-pcard"/g) || []).length, 4, "أربع بطاقات");
    for (const k of ["formation", "government", "unsure", "account"]) assert.ok(html.includes(`id="path-${k}"`), k);
    assert.match(html, /<input id="hpQ" name="q" type="search"/);
    assert.match(html, new RegExp(`<form class="sv1-psearch" id="hpSearch" action="${pre(lang)}/catalog" method="get"`));
    // الصفحة الجديدة: ترويسة SV1 وبلا main.js القديم
    assert.ok(html.includes('class="sv1-page"'));
    assert.ok(!/<script[^>]+src="[^"]*main\.js/.test(html));
  });

  test(`الرئيسية ${lang}: نصوص حقيقية بلا مفاتيح خام ولا واتساب في المحتوى ولا «شريك الأعمال»`, () => {
    // كل مفتاح hp* في القاموس له نصّ بهذه اللغة، ولا يظهر اسم المفتاح في الصفحة
    for (const k of Object.keys(SV1_TEXT).filter((x) => x.startsWith("hp"))) {
      const e = SV1_TEXT[k][lang];
      assert.ok(typeof e === "string" && e.trim(), `${k} بلا نص ${lang}`);
      assert.ok(!main.includes(`>${k}<`), `مفتاح خام ${k}`);
    }
    for (const k of ["hpTitle", "hpQ", "hpCardFormation", "hpCardGov", "hpCardUnsure", "hpCardAccount", "hpHow", "hpPopular", "hpFaq"]) {
      assert.ok(main.includes(SV1_TEXT[k][lang].replace(/&/g, "&amp;")) || main.includes(SV1_TEXT[k][lang]), `${k} غائب`);
    }
    assert.ok(!/wa\.me|api\.whatsapp|whatsapp\.com/i.test(main), "رابط واتساب داخل المحتوى");
    assert.ok(!/sv1-btn wa/.test(main), "زر واتساب داخل المحتوى");
    assert.ok(!/شريك الأعمال|شريك أعمالك/.test(html), "الاسم يبقى Business Partner");
    assert.ok(html.includes('alt="Business Partner"'));
    // لا «الوكيل» تسميةً للمستشار في نصوص المسار
    assert.ok(!/الوكيل/.test(main));
  });

  test(`الرئيسية ${lang}: لا رابط إلى صفحة مخفية، ولا باب «تطوير الأعمال»`, () => {
    const hrefs = [...html.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(hrefs.length > 10);
    for (const h of hrefs) assert.equal(isHiddenHref(h), false, `رابط مخفي: ${h}`);
    assert.ok(!html.includes('data-door="bizdev"'));
    assert.ok(!/business-development/.test(main));
  });

  test(`الرئيسية ${lang}: وجهات البطاقات والبحث والشائعة موجودة وبتصميم SV1`, () => {
    const cardHrefs = ["formation", "government", "unsure", "account"].map((k) => {
      const m = html.match(new RegExp(`<a class="sv1-pcard" id="path-${k}" href="([^"]+)"`));
      assert.ok(m, k);
      return m[1];
    });
    const eor = html.match(/<a id="door-eor" href="([^"]+)"/);
    assert.ok(eor, "رابط EOR");
    const popular = [...main.matchAll(/<a class="sv1-btn sm" href="([^"]*\/services\/[^"]+)"/g)].map((m) => m[1]);
    assert.ok(popular.length >= 4 && popular.length <= 6, "الخدمات الشائعة: " + popular.length);
    assert.equal((main.match(/data-pop="\d"/g) || []).length > 0, true, "زر أضف للسلة للمسعّر");
    const dests = [...cardHrefs.filter((h) => !h.startsWith("#")), eor[1], `${pre(lang)}/catalog`, ...popular];
    for (const d of dests) {
      const f = pageFile(d.split(/[?#]/)[0]);
      assert.ok(f, `الوجهة غير مبنيّة: ${d}`);
      const dest = read(f);
      assert.ok(dest.includes('class="sv1-page"'), `وجهة قديمة: ${d}`);
      assert.ok(!/<script[^>]+src="[^"]*main\.js/.test(dest), `وجهة تحمّل main.js القديم: ${d}`);
    }
    // معاملا التصفية موجّهان لمجالين مختلفين، وبطاقة «لا أعرف» ترسو على المستشار بباب الاستشارة
    assert.equal(cardHrefs[0], `${pre(lang)}/catalog?door=formation`);
    assert.equal(cardHrefs[1], `${pre(lang)}/catalog?door=government`);
    assert.equal(cardHrefs[2], "#advisor");
    assert.match(html, /id="path-unsure"[^>]*data-door="consulting"/);
    assert.equal(cardHrefs[3], `${pre(lang)}/my`);
  });

  test(`الرئيسية ${lang}: المستشار ما زال في الصفحة بسياقاته الثلاثة`, () => {
    assert.ok(html.includes('id="advisor"'));
    assert.ok(html.includes('id="sv1Create"'));
    for (const k of ["consulting", "government", "formation"]) assert.ok(html.includes(`class="${k === "consulting" ? "on" : ""}" data-door="${k}"`), k);
  });

  test(`/catalog ${lang}: يقرأ ?door= و?q=`, () => {
    const cat = read(`${lang === "en" ? "" : lang + "/"}catalog.html`);
    assert.ok(cat.includes("new URLSearchParams(location.search)"));
    assert.ok(cat.includes("QS.get('door')") && cat.includes("QS.get('q')"));
    assert.ok(cat.includes('id="catFilter"'));
    for (const k of ["formation", "government", "consulting"]) assert.ok(cat.includes(`"${k}":`), `اسم الباب ${k}`);
  });
}

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

test("لا سعر في مسار الرئيسية (SHOW_PRICES=false)", () => {
  for (const file of Object.values(HOMES)) {
    const m = mainOf(read(file));
    const hero = m.slice(0, m.indexOf('id="advisor"'));
    assert.ok(!/\d[\d,.]*\s*(﷼|ر\.س|SAR|ريال)/.test(hero.replace(/<script[\s\S]*?<\/script>/g, "")), "سعر ظاهر في " + file);
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

test("بمتصفح حقيقي: h1 والبطاقات والبحث فوق الطيّ (390×844 و1280×800) والمسارات تعمل", { skip: !chromium && "playwright/Chromium غير متاح" }, async () => {
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
          const box = (el) => { const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, w: b.width, h: b.height }; };
          return {
            vh: innerHeight,
            h1: [...document.querySelectorAll("h1")].map(box),
            cards: [...document.querySelectorAll(".sv1-pcard")].map(box),
            search: box(document.getElementById("hpQ")),
            overflow: document.documentElement.scrollWidth - innerWidth,
          };
        });
        const tag = `${lang} ${w}x${h}`;
        assert.equal(r.h1.length, 1, tag + " h1");
        assert.equal(r.cards.length, 4, tag + " cards");
        assert.ok(r.h1[0].bottom < r.vh && r.h1[0].h > 0, tag + " h1 فوق الطيّ");
        assert.ok(r.search.bottom <= r.vh && r.search.h > 0, tag + " البحث فوق الطيّ");
        for (const c of r.cards) assert.ok(c.h > 0 && c.bottom <= r.vh, `${tag} بطاقة تتجاوز الطيّ (${Math.round(c.bottom)}>${r.vh})`);
        assert.ok(r.overflow <= 1, tag + " تمرير أفقي " + r.overflow);
        await ctx.close();
      }
    }

    // بطاقة التأسيس ← /catalog مصفّى بالتأسيس والاستثمار الأجنبي فقط
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(base + "/ar/", { waitUntil: "load" });
    await page.click("#path-formation");
    await page.waitForURL(/\/ar\/catalog\?door=formation/);
    await page.waitForSelector(".sv1-grp");
    const cats = await page.$$eval(".sv1-grp > button b", (els) => els.map((e) => e.textContent.trim()));
    assert.deepEqual(cats.sort(), ["الاستثمار الأجنبي", "تأسيس الشركات"].sort());
    assert.equal(await page.$$eval(".sv1-grp.open", (e) => e.length), cats.length, "المجموعات مفتوحة");
    assert.equal(await page.isVisible("#catFilter"), true);

    // بطاقة الخدمة الحكومية ← مجالات الباب الحكومي فقط
    await page.goto(base + "/ar/catalog?door=government", { waitUntil: "load" });
    const gcats = await page.$$eval(".sv1-grp > button b", (els) => els.map((e) => e.textContent.trim()));
    assert.ok(gcats.includes("العلاقات الحكومية") && !gcats.includes("تأسيس الشركات"), gcats.join("|"));

    // البحث: اقتراح فوري ثم صفحة الخدمة، و«كل النتائج» تحمل ?q= فيعرضها الكتالوج
    await page.goto(base + "/ar/", { waitUntil: "load" });
    await page.fill("#hpQ", "تجديد سجل تجاري");
    await page.waitForSelector("#hpSug a");
    const sugs = await page.$$eval("#hpSug a:not(.all)", (els) => els.map((e) => [e.textContent.trim(), e.getAttribute("href")]));
    assert.ok(sugs.some(([n, h]) => n.includes("تجديد سجل تجاري") && h === "/ar/services/bp-sbc-19"), JSON.stringify(sugs));
    await page.press("#hpQ", "Enter");
    await page.waitForURL(/\/ar\/catalog\?q=/);
    await page.waitForSelector(".sv1-grp.open");
    assert.equal(await page.inputValue("#svcQ"), "تجديد سجل تجاري");
    const rows = await page.$$eval(".sv1-pick .tx b", (els) => els.map((e) => e.textContent.trim()));
    assert.ok(rows.length >= 1 && rows.every((n) => /تجديد/.test(n)), rows.join("|"));

    // المستشار يُفتح بسياق الاستشارة من بطاقة «لا أعرف»
    await page.goto(base + "/ar/", { waitUntil: "load" });
    await page.click("#path-unsure");
    assert.equal(await page.$eval("#sv1ChatTitle", (e) => e.textContent.trim()), SV1_TEXT.ctxConsulting.ar);
    assert.equal(await page.$eval('.sv1-chatctx [data-door="consulting"]', (e) => e.classList.contains("on")), true);
    await ctx.close();
  } finally {
    if (browser) await browser.close();
    srv.close();
  }
});
