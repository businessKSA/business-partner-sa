// صفحة /vendor (الشريحة الأولى): الباني simple-v1-vendor.mjs على قشرة SV1 الحقيقية، بلا حاجة لتوصيله في generate.mjs.
// وإن وُجدت الصفحات المولَّدة (site/**/vendor.html بعد توصيل generate.mjs) فُحصت هي أيضاً.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import { simpleV1 } from "../site/scripts/simple-v1.mjs";
import { buildSimpleVendor, VENDOR_TEXT } from "../site/scripts/simple-v1-vendor.mjs";
import { INTERNAL_SOURCE_PROPS, SOURCE_TAG_RE } from "../api/_sources.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pathInLang = (p, l) => (l === "en" ? p : "/" + l + p);

function render(l) {
  let LANG = l;
  const head = (title) => `<!doctype html><html lang="${LANG}"><head><meta charset="utf-8"><title>${esc(title)}</title></head>`;
  const SV1 = simpleV1({ lang: () => LANG, esc, site: {}, head, pathInLang, assetV: (x) => x, knowledge: null });
  return buildSimpleVendor(SV1, { lang: () => LANG, esc });
}
const PAGES = [["ar", render("ar")], ["en", render("en")], ["fr", render("fr")], ["zh", render("zh")]];
for (const l of ["ar", "en", "fr", "zh"]) {
  const gen = path.join(ROOT, l === "en" ? "site/vendor.html" : `site/${l}/vendor.html`);
  if (fs.existsSync(gen)) PAGES.push([l + " (generated)", fs.readFileSync(gen, "utf8")]);
}

for (const [name, h] of PAGES) {
  test(`/vendor (${name}): قشرة SV1، الحقول والتبويبان، بلا فهرسة ولا main.js ولا localStorage`, () => {
    assert.ok(/<html[^>]*lang="(ar|en|fr|zh)"/.test(h));
    assert.ok(h.includes('class="sv1"'), "قشرة SV1");
    assert.equal(/<script[^>]*main\.js/.test(h), false);
    assert.ok(/name="robots" content="noindex/.test(h), "noindex");
    for (const id of ["vAuthForm", "vName", "vKind", "vEmail", "vPass", "vTabDemand", "vTabCands", "vDemand", "vCandForm", "cName", "cNat", "cRole", "cExp", "cSal", "cCv", "vCands", "vOut", "vTabs", "vTabOffers", "vPaneOffers", "vOffers", "vPend", "vPendGo", "vAuthNote"]) assert.ok(h.includes(`id="${id}"`), id);
    assert.ok(h.includes('accept="application/pdf,.pdf"'));
    assert.ok(h.includes('"/api/agencies"') || h.includes("/api/agencies"), "نقطة النداء");
    // الجلسة في sessionStorage فقط، والنصوص القادمة من الخادم بـtextContent.
    const own = h.slice(h.indexOf('<style id="sv1-vnd-css">'));
    const client = own.slice(own.indexOf("function vendorClient"));
    assert.equal(/localStorage/.test(client), false, "localStorage");
    assert.equal(/innerHTML/.test(client), false, "innerHTML");
    assert.ok(client.includes("sessionStorage"));
  });
  test(`/vendor (${name}): لا وسم مصدر ولا اسم عمود داخلي ولا راتب/سعر عميل، والسكربت العميل يُحلَّل`, () => {
    for (const col of INTERNAL_SOURCE_PROPS) assert.equal(h.includes(col), false, col);
    assert.equal(SOURCE_TAG_RE.test(h), false);
    const m = h.match(/<script>\((function vendorClient[\s\S]*?)\)\((\{[\s\S]*?\})\);<\/script>/);
    assert.ok(m, "السكربت العميل");
    assert.doesNotThrow(() => new Function(`return (${m[1]})`));
    const cfg = JSON.parse(m[2]);
    assert.ok(cfg.occ.length > 100 && cfg.nats.length > 20);
    assert.deepEqual(Object.keys(cfg).sort(), ["lang", "maxCv", "nats", "occ", "ostatus", "stages", "tx"]);
    // الأنواع الأربعة في التسجيل، والمؤسسي بقيمته المعتمدة في الخادم.
    assert.ok(h.includes('<option value="مورّد مؤسسي">'), "نوع مؤسسي");
    for (const v of ["مكتب استقدام", "مستقل", "منصة"]) assert.ok(h.includes(`<option value="${v}">`), v);
    // ما يخصّ الإدارة لا يصل الصفحة: لا اسم متغير بيئة ولا عمود في قاعدة العروض.
    for (const w of ["VENDOR_OFFERS_DB", "BP Vendor Offers", "العدد المرسّى", "ملاحظة المالك", "المكتب المحدَّد", "من يتقاضى رسم المكتب"]) assert.equal(h.includes(w), false, w);
  });
}

// الهوية: متغيرات SV1 وأصنافه فقط. لا لون حرفي في ما تضيفه الصفحة (أنماطها، سكربتها، سمات style في جسمها).
const HEX = /#[0-9a-fA-F]{3,8}\b/;
const FUNC = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\s*\(/i;
const NAMED = /(?:^|[;{\s"'])(?:color|background(?:-color)?|border(?:-[a-z]+)?-color|fill|stroke|outline-color)\s*:\s*(?:white|black|red|blue|green|gray|grey|orange|yellow|purple|pink|navy|silver|teal|maroon|lime|aqua)\b/i;
for (const [name, h] of PAGES) {
  test(`/vendor (${name}): لا لون حرفي — متغيرات SV1 وأصنافه وحدها`, () => {
    const a = h.indexOf('<style id="sv1-vnd-css">');
    assert.ok(a >= 0);
    const css = h.slice(a, h.indexOf("</style>", a));
    const main = h.indexOf("<main>");
    const body = h.slice(main, h.indexOf("</main>", main));
    const script = h.slice(h.indexOf("function vendorClient"), h.indexOf("</script>", h.indexOf("function vendorClient")));
    for (const [label, src] of [["css", css], ["body", body], ["script", script]]) {
      assert.equal(HEX.test(src), false, `${label}: لون سداسي ${(src.match(HEX) || [])[0]}`);
      assert.equal(FUNC.test(src), false, `${label}: دالة لون`);
      assert.equal(NAMED.test(src), false, `${label}: لون مسمّى`);
    }
    // كل لون في أنماط الصفحة يأتي من var(--…) أو الكلمات المحايدة.
    for (const m of css.matchAll(/(?:^|[;{])\s*(color|background(?:-color)?|border(?:-[a-z]+)?(?:-color)?|box-shadow|fill|stroke|outline)\s*:\s*([^;}]+)/g)) {
      const v = m[2].replace(/var\([^)]*\)/g, "").replace(/\b(?:transparent|inherit|currentColor|none|solid|dashed|dotted|\d+(?:\.\d+)?(?:px|em|rem|%)?|auto)\b/g, "").trim();
      assert.equal(v, "", `${m[1]} فيه قيمة غير متغيّر: ${m[2]}`);
    }
    for (const cls of ["sv1-err", "sv1-btn", "sv1-hide", "sv1-tag"]) assert.ok(h.includes(cls), `صنف SV1 ${cls}`);
  });
}

test("المصدر نفسه (simple-v1-vendor.mjs) بلا لون حرفي", () => {
  const src = fs.readFileSync(path.join(ROOT, "site/scripts/simple-v1-vendor.mjs"), "utf8");
  assert.equal(HEX.test(src), false, (src.match(HEX) || [])[0]);
  assert.equal(FUNC.test(src), false);
});

test("كل نصّ بأربع لغات غير فارغ، والعربية بحروف عربية والصينية بحروف صينية", () => {
  const latinOk = new Set(["fEmail"]);   // «E-mail» لاتينية في أكثر من لغة
  for (const [k, v] of Object.entries(VENDOR_TEXT)) {
    assert.equal(v.length, 4, k);
    v.forEach((s, i) => assert.ok(typeof s === "string" && s.trim().length > 0, `${k}[${i}]`));
    assert.ok(/[؀-ۿ]/.test(v[0]), `${k} ar`);
    if (!latinOk.has(k)) assert.ok(/[一-鿿]/.test(v[3]), `${k} zh`);
  }
});
