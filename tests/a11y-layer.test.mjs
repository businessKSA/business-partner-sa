// وضع الإتاحة (2026-10-16): الطبقة المحقونة في كل صفحة، وبيان الإتاحة، وأصول الزرّ واللوحة.
// الجزء الأول لا يحتاج بناءً؛ الثاني يفحص الصفحات المبنيّة إن وُجدت (بعد npm run build).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { injectA11y, a11yTags } from "../site/scripts/a11y-layer.mjs";
import { buildSimpleAccessibility } from "../site/scripts/simple-v1-accessibility.mjs";

const SITE = path.resolve("site");
const V = { cssV: "abc", jsV: "def" };
const page = (lang, body, head = "") => `<!DOCTYPE html><html lang="${lang}" dir="${lang === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8">${head}</head><body class="x">${body}</body></html>`;

test("injectA11y: skip link, main id, assets and early script", () => {
  const out = injectA11y(page("ar", "<header></header><main><h1>x</h1></main>"), "ar/x.html", V);
  assert.match(out, /<body class="x"><a class="bpa-skip" href="#bp-main">تخطَّ إلى المحتوى<\/a>/);
  assert.match(out, /<main><span id="bp-main" tabindex="-1"><\/span><h1>x<\/h1>/, "bare <main> stays literal");
  assert.match(out, /bp-a11y\.css\?v=abc/);
  assert.match(out, /<script defer src="\/assets\/js\/bp-a11y\.js\?v=def">/);
  assert.match(out, /localStorage\.getItem\('bp_a11y'\)/);
  // الأصول قبل </head> لا بعده
  assert.ok(out.indexOf("bp-a11y.css") < out.indexOf("</head>"));
});

test("injectA11y: English text for en/fr/zh, existing main id kept, idempotent", () => {
  for (const l of ["en", "fr", "zh"]) {
    assert.match(injectA11y(page(l, "<main>a</main>"), "x.html", V), />Skip to content<\/a>/);
  }
  const keep = injectA11y(page("en", '<main id="content">a</main>'), "x.html", V);
  assert.match(keep, /href="#content"/);
  assert.match(keep, /<main id="content" tabindex="-1">/);
  assert.equal(injectA11y(keep, "x.html", V), keep, "second run changes nothing");
});

test("injectA11y: a page without <main> gets no dead skip link", () => {
  const out = injectA11y(page("en", "<div>no landmark</div>"), "account.html", V);
  assert.doesNotMatch(out, /bpa-skip/);
  assert.match(out, /bp-a11y\.js/);
});

test("injectA11y: skips non-pages and internal owner tools", () => {
  const h = page("en", "<main>a</main>");
  assert.equal(injectA11y(h, "sitemap.xml", V), h);
  for (const rel of ["admin.html", "monitor.html", "doc-agent-admin.html", "suppliers-admin.html", "ar/agencies-admin.html"]) {
    assert.equal(injectA11y(h, rel, V), h, rel);
  }
  assert.notEqual(injectA11y(h, "ops.html", V), h);
  // لا <head>/<body> → لا يمسّ شيئاً
  assert.equal(injectA11y("<main>x</main>", "frag.html", V), "<main>x</main>");
});

test("injectA11y: a <main> mentioned inside a head script is not the target", () => {
  const out = injectA11y(page("en", "<main>real</main>", "<script>var s='<main>';</script>"), "x.html", V);
  assert.match(out, /<script>var s='<main>';<\/script>/);
  assert.match(out, /<main><span id="bp-main" tabindex="-1"><\/span>real/);
  const attr = injectA11y(page("en", '<main class="m">x</main>'), "x.html", V);
  assert.match(attr, /<main class="m" id="bp-main" tabindex="-1">x/);
});

test("early script and bp-a11y.js agree on the setting keys", () => {
  const early = a11yTags(V);
  const js = fs.readFileSync(path.join(SITE, "assets/js/bp-a11y.js"), "utf8");
  const m = /,k=\[([^\]]+)\]/.exec(early);
  const earlyKeys = m[1].replace(/'/g, "").split(",");
  const jsKeys = /var FLAGS = \[([^\]]+)\]/.exec(js)[1].replace(/"/g, "").split(",").map((s) => s.trim());
  assert.deepEqual(earlyKeys, jsKeys);
  // وتُقرأ القيم كأرقام أو "dark" فقط
  assert.match(early, /typeof v==='number'\|\|v==='dark'/);
});

test("bp-a11y.js parses, is storage-safe and has the promised features", () => {
  const js = fs.readFileSync(path.join(SITE, "assets/js/bp-a11y.js"), "utf8");
  new vm.Script(js, { filename: "bp-a11y.js" });
  assert.match(js, /speechSynthesis/);
  assert.match(js, /getElementById\("sv1Mic"\)/, "voice-first reuses the advisor's microphone");
  assert.doesNotMatch(js, /getUserMedia|MediaRecorder|\/api\/chat/, "no second recorder or chat call here");
  assert.match(js, /e\.key|k !== "Escape"/);
  // كل localStorage داخل try
  const lines = js.split("\n");
  const uses = lines.map((l, i) => [l, i]).filter(([l]) => /localStorage/.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l));
  assert.ok(uses.length >= 2);
  for (const [l, i] of uses) assert.match(lines.slice(Math.max(0, i - 2), i + 1).join("\n"), /try/, l.trim());
  assert.match(js, /aria-modal.*false/);
});

test("bp-a11y.css: every setting has a rule, panel is exempt, reduced motion honoured", () => {
  const css = fs.readFileSync(path.join(SITE, "assets/css/bp-a11y.css"), "utf8");
  for (const k of ["zoom", "spacing", "font", "contrast", "theme", "links", "cursor", "focus", "motion", "imgs"]) {
    assert.ok(css.includes(`data-bpa-${k}`), `rule for ${k}`);
  }
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /:not\(\.bpa-ui\)/);
  assert.doesNotMatch(css, /font:[^;}]*\binherit\s*;/, "no invalid font shorthand with inherit");
  // مؤشر الأهداف ≥ 44px
  assert.match(css, /\.bpa-x\{width:44px;height:44px/);
});

test("accessibility statement: honest wording and contact from site.json", () => {
  const site = JSON.parse(fs.readFileSync(path.join(SITE, "data/site.json"), "utf8"));
  const sv1 = { header: () => "<header></header>", footer: () => "<footer></footer>", shell: (o) => o };
  for (const l of ["ar", "en", "fr", "zh"]) {
    const o = buildSimpleAccessibility(sv1, { lang: () => l, esc: (s) => String(s), site });
    assert.equal(o.path, "/accessibility");
    assert.match(o.body, /<main>/);
    assert.ok(o.body.includes(site.contact.phone), "phone from site.json " + l);
    assert.ok(o.body.includes(site.contact.email), "email from site.json " + l);
    assert.match(o.body, /WCAG\)? 2\.1/);
    // لا ادّعاء امتثال/شهادة
    assert.doesNotMatch(o.body, /(مطابق|متوافق مع WCAG|certified|fully compliant|compliant with WCAG)/i);
    assert.match(o.body, l === "ar" ? /لم يُجرِ جهةٌ خارجية تدقيقاً/ : /no outside body has audited/);
    if (l === "fr" || l === "zh") assert.match(o.body, /lang="en"/, "English text is marked lang=en");
  }
});

// ------------------------------------------------------ صفحات مبنيّة (بعد البناء)
const built = (rel) => { const f = path.join(SITE, rel); return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null; };
const SAMPLE = ["index.html", "ar/index.html", "cart.html", "ar/cart.html", "checkout.html", "ar/checkout.html", "my.html", "ar/my.html", "catalog.html", "ar/accessibility.html", "accessibility.html", "fr/accessibility.html", "zh/accessibility.html", "ar/about.html", "ar/terms.html", "account.html"];

test("built pages: skip link, one #bp-main landmark, assets, banner and footer", { skip: !built("index.html") && "no build output" }, () => {
  for (const rel of SAMPLE) {
    const h = built(rel);
    if (!h) continue;
    if (!/<main[\s>]/.test(h)) { assert.doesNotMatch(h, /bpa-skip/, rel + " no dead skip link"); continue; }
    assert.match(h, /<body[^>]*><a class="bpa-skip" href="#[^"]+">/, rel + " skip link first in body");
    const id = /<a class="bpa-skip" href="#([^"]+)"/.exec(h)[1];
    assert.ok(new RegExp(`<main[^>]*\\bid="${id}"|<main><span id="${id}"`).test(h), `${rel}: skip target #${id} is at the start of <main>`);
    assert.equal((h.match(new RegExp(`id="${id}"`, "g")) || []).length, 1, rel + " target id unique");
    assert.match(h, /bp-a11y\.css\?v=[0-9a-f]{10}/, rel);
    assert.match(h, /bp-a11y\.js\?v=[0-9a-f]{10}/, rel);
    assert.match(h, /<html[^>]*\blang="/, rel);
  }
});

test("built SV1 pages: banner + nav + footer landmarks, named nav, translated menu label", { skip: !built("index.html") && "no build output" }, () => {
  for (const rel of ["index.html", "ar/index.html", "cart.html", "ar/checkout.html", "ar/my.html", "ar/accessibility.html"]) {
    const h = built(rel);
    if (!h) continue;
    assert.match(h, /<header class="sv1-hdr">/, rel);
    assert.match(h, /<nav class="sv1-nav" id="sv1Nav" aria-label="[^"]+">/, rel);
    assert.match(h, /<footer class="sv1-foot">/, rel);
    assert.match(h, /<div class="sv1-bar" role="region" aria-label="[^"]+">/, rel);
    assert.match(h, /id="sv1Burger" aria-label="[^"]+" aria-controls="sv1Nav"/, rel);
    assert.match(h, /href="[^"]*accessibility">/, rel + " footer links to the statement");
    assert.equal((h.match(/<main[\s>]/g) || []).length >= 1, true, rel + " has a main");
  }
  // لوحتا /my و/ops كانتا بلا <main>
  assert.match(built("ar/my.html") || "<main", /<main/);
  if (built("ops.html")) assert.match(built("ops.html"), /<main[^>]*>[\s\S]*id="app"/);
});

test("built: homepage advisor markup the voice-first mode attaches to is still there", { skip: !built("ar/index.html") && "no build output" }, () => {
  const h = built("ar/index.html");
  for (const id of ["sv1Msgs", "sv1Mic", "sv1In", "sv1Form", "advisor"]) assert.ok(h.includes(`id="${id}"`), id);
});

test("built: internal owner tools are not given the widget; sitemap lists the statement", { skip: !built("index.html") && "no build output" }, () => {
  for (const rel of ["admin.html", "monitor.html"]) {
    const h = built(rel);
    if (h) assert.doesNotMatch(h, /bp-a11y/, rel);
  }
  const sm = built("sitemap.xml");
  if (sm) assert.match(sm, /\/accessibility<\/loc>/);
});
