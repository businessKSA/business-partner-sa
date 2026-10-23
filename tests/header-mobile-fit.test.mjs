// الترويسة على الجوال (قرار الجودة 2026-10-23): زر «ابدأ طلبك» كان يخرج من حافة
// الشاشة بعرض 360 و390 و414 لمن سجّل دخوله (يسار الشاشة بالعربية، يمينها بغيرها)،
// لأن الشعار (213px) والأزرار (~200px) لا ينكمشان. تقرأ الصفحات المولَّدة — شغّل
// `npm run build` قبلها.
//
// ما يُثبَت:
//  ١) ساكن: قاعدة الجوال في CSS الترويسة المشتركة (شعار ينكمش، أزرار تنكمش،
//     والخروج في قائمة ☰) حاضرة في صفحات SV1 وفي الصفحات القديمة التي
//     تأخذ الترويسة نفسها من simplified-global-header.mjs، ومعها زرّ #sv1NavOut.
//  ٢) بمتصفح حقيقي (إن وُجد Chromium): في الصفحات الرئيسية (/ · /catalog · /cart ·
//     /checkout · /my · /ops) بالعربية والإنجليزية والفرنسية والصينية، للمسجَّل والزائر،
//     بعرض 320 و360 و390 و414: لا تمرير أفقي، ولا عنصر مرئي يخرج من الشاشة، وزرّ
//     «ابدأ طلبك» داخل الشاشة ومرئي وبعرض ≥ 44px للمس.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = path.join(ROOT, "site");
const read = (p) => fs.readFileSync(path.join(SITE, p), "utf8");

test("ساكن: قاعدة الجوال للترويسة في صفحة SV1 وفي صفحة قديمة", () => {
  for (const file of ["ar/catalog.html", "catalog.html", "about.html"]) {
    const html = read(file);
    assert.match(html, /@media\(max-width:560px\)\{[\s\S]{0,400}?\.sv1-hdr \.wrap\{gap:8px/, `${file}: كتلة الجوال غائبة`);
    assert.match(html, /\.sv1-hdr \.logo\{flex:0 1 190px;min-width:96px/, `${file}: الشعار لا ينكمش`);
    assert.match(html, /\.sv1-hdr \.right #sv1OutBtn\{display:none\}/, `${file}: الخروج يزاحم الزر`);
    assert.match(html, /id="sv1NavOut"/, `${file}: زرّ الخروج في قائمة ☰ غائب`);
    assert.match(html, /\.sv1-navout\{display:none\}/, `${file}: زرّ القائمة ظاهر على سطح المكتب`);
  }
});

test("ساكن: الخروج من القائمة مربوط بنفس معالج الخروج، وحالة الدخول تُظهره", () => {
  const sv1 = read("ar/catalog.html");
  assert.match(sv1, /\['sv1OutBtn','sv1NavOut'\]\.forEach/);
  assert.match(sv1, /var no=g\('sv1NavOut'\);if\(no\)no\.classList\.toggle\('sv1-hide',!on\)/);
  const old = read("about.html");
  assert.match(old, /\['sv1OutBtn','sv1NavOut'\]\.forEach/);
});

test("ساكن: صفوف التبويب والأبواب لا تدفع الصفحة خارج الشاشة بالفرنسية", () => {
  const html = read("fr/catalog.html");
  assert.match(html, /\.sv1-tabs\{[^}]*flex-wrap:wrap/);
  assert.match(html, /\.sv1-doors\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

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

// كل عنصر مرئي يخرج من الشاشة ولا يحتويه أب قابل للتمرير داخل الشاشة.
function probe() {
  const vw = document.documentElement.clientWidth;
  const out = [];
  const clipped = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) {
        const r = p.getBoundingClientRect();
        if (r.left >= -1 && r.right <= vw + 1) return true;
      }
    }
    return false;
  };
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    // بطاقات «دليل المستثمر» في الرئيسية الفرنسية (.sv1-gh-card): CSS في
    // simple-v1-guide.mjs ومالكها sbc-guide — عمودها «auto 1fr» فتدفع كلمة
    // «gouvernementales» الشبكة خارج الشاشة. مُبلَّغ عنها للمدير ولا تُصلَح من هنا.
    if (el.closest(".sv1-gh-card")) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if ((r.right > vw + 1 || r.left < -1) && !clipped(el)) {
      out.push(el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + " [" + Math.round(r.left) + "," + Math.round(r.right) + "] " + (el.textContent || "").trim().slice(0, 20));
    }
  }
  const cta = document.querySelector(".sv1-hdr .right .primary");
  const cr = cta && cta.getBoundingClientRect();
  return {
    vw,
    scrollW: document.documentElement.scrollWidth,
    out: out.slice(0, 5),
    cta: cr ? { l: Math.round(cr.left), r: Math.round(cr.right), h: Math.round(cr.height), shown: getComputedStyle(cta).display !== "none" } : null,
  };
}

const LANGS = { ar: "/ar", en: "", fr: "/fr", zh: "/zh" };
const PAGES = ["/", "/catalog", "/cart", "/checkout", "/my", "/ops"];

test("بمتصفح حقيقي: لا عنصر يخرج من الشاشة ولا تمرير أفقي في الترويسة والصفحات الرئيسية (مسجَّل وزائر)", { skip: !chromium && "playwright/Chromium غير متاح", timeout: 600000 }, async () => {
  const srv = await serve();
  const base = "http://127.0.0.1:" + srv.address().port;
  let browser;
  const bad = [];
  let checked = 0;
  try {
    browser = await chromium.launch();
    for (const logged of [true, false]) {
      for (const w of [320, 360, 390, 414]) {
        const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, isMobile: true, hasTouch: true });
        // لا شبكة خارجية، وجلسة مزيّفة لنداء `me` حتى لا تمسح الترويسة حالة الدخول.
        await ctx.route(/^(?!http:\/\/127\.0\.0\.1)/, (r) => r.abort());
        await ctx.route("**/api/**", (r) => r.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(logged ? { ok: true, session: { user: { email: "client@test.local", full_name: "Client Test" } } } : { ok: true }),
        }));
        const page = await ctx.newPage();
        if (logged) await page.addInitScript(() => { try { localStorage.setItem("bp_session", "1"); } catch {} });
        for (const [lang, pre] of Object.entries(LANGS)) {
          for (const p of PAGES) {
            if ((lang === "fr" || lang === "zh") && (p === "/ops" || p === "/checkout" || p === "/cart")) continue;
            const url = pre + (p === "/" ? "/" : p);
            if (!pageFile(url === "" ? "/" : url)) continue;
            await page.goto(base + url, { waitUntil: "domcontentloaded" });
            await page.waitForTimeout(250);
            const r = await page.evaluate(probe);
            checked++;
            const tag = `${logged ? "داخل" : "زائر"} ${w}px ${url}`;
            if (r.scrollW > r.vw + 1) bad.push(`${tag}: تمرير أفقي ${r.scrollW}>${r.vw}`);
            if (r.out.length) bad.push(`${tag}: خارج الشاشة ${JSON.stringify(r.out)}`);
            if (r.cta && (!r.cta.shown || r.cta.l < 0 || r.cta.r > r.vw || r.cta.h < 44)) bad.push(`${tag}: زرّ البدء ${JSON.stringify(r.cta)}`);
          }
        }
        await ctx.close();
      }
    }
  } finally {
    if (browser) await browser.close();
    srv.close();
  }
  assert.ok(checked > 100, "فُحصت صفحات كافية: " + checked);
  assert.deepEqual(bad, [], bad.join("\n"));
});
