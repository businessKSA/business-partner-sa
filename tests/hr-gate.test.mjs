// بوابة الدخول /hr-portal (simple-v1-hr.mjs): «من أنت؟» بست بطاقات، أربع لغات، noindex، غير مربوطة في أي قائمة أو فوتر أو sitemap،
// وبلا ألوان حرفية (متغيرات SV1 وأصناف sv1-* وحدها). وزرّ «ادخل بوابة Business Partner HR» في /eor.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import { simpleV1 } from "../site/scripts/simple-v1.mjs";
import { buildSimpleHr, HR_TEXT } from "../site/scripts/simple-v1-hr.mjs";
import { buildSimpleEor } from "../site/scripts/simple-v1-eor.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pathInLang = (p, l) => (l === "en" ? p : "/" + l + p);
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

function sv1For(l) {
  const LANG = l;
  const head = (title) => `<!doctype html><html lang="${LANG}"><head><meta charset="utf-8"><title>${esc(title)}</title></head>`;
  return simpleV1({ lang: () => LANG, esc, site: {}, head, pathInLang, assetV: (x) => x, knowledge: null });
}
const renderHr = (l) => buildSimpleHr(sv1For(l), { lang: () => l, esc });
const renderEor = (l) => buildSimpleEor(sv1For(l), { lang: () => l, esc });
const pre = (l) => (l === "en" ? "" : "/" + l);

for (const l of ["ar", "en", "fr", "zh"]) {
  const h = renderHr(l);
  test(`/hr-portal (${l}): قشرة SV1، noindex، بلا main.js ولا تخزين ولا واتساب، ست بطاقات بوجهاتها`, () => {
    assert.ok(h.includes('class="sv1"'), "قشرة SV1");
    assert.ok(/name="robots" content="noindex, nofollow"/.test(h), "noindex");
    assert.equal(/<script[^>]*main\.js/.test(h), false);
    const js0 = h.indexOf("var b=document.getElementById('hr-employee')");
    const c0 = h.indexOf('<style id="sv1-hr-css">');
    const own = h.slice(c0, h.indexOf("</style>", c0)) + h.slice(h.indexOf("<main>"), h.indexOf("</main>")) + h.slice(js0, h.indexOf("</script>", js0));
    assert.ok(own.includes("hr-employee"));
    assert.equal(/localStorage|sessionStorage|indexedDB|document\.cookie/.test(own), false);
    assert.equal(/wa\.me|whatsapp/i.test(h.slice(h.indexOf("<main>"), h.indexOf("</main>"))), false, "لا واتساب في المحتوى");
    const doors = [...h.matchAll(/data-hr-door="([a-z]+)"/g)].map((m) => m[1]);
    assert.deepEqual(doors, ["employer", "candidate", "employee", "office", "freelancer", "platform"]);
    const href = (id) => (h.match(new RegExp(`<a class="sv1-door" id="hr-${id}"[^>]*href="([^"]+)"`)) || [])[1];
    assert.equal(href("employer"), `${pre(l)}/employer`);
    assert.equal(href("candidate"), `${pre(l)}/careers`);
    for (const id of ["office", "freelancer", "platform"]) assert.equal(href(id), `${pre(l)}/vendor`, id);
    // الموظف على بند التعاقد: لا بوابة بعد ⇒ زرّ يكشف رسالة «الدخول بدعوة» لا رابطاً
    assert.equal(href("employee"), undefined);
    assert.match(h, /<button type="button" class="sv1-door" id="hr-employee"[^>]*aria-controls="hrInvite"/);
    assert.ok(h.includes(esc(HR_TEXT.inviteMsg[{ ar: 0, en: 1, fr: 2, zh: 3 }[l]])));
    assert.match(h, /class="sv1-hr-invite sv1-hide" id="hrInvite"/);
  });

  test(`/hr-portal (${l}): سطر التسعير حاضر، والاسم «Business Partner»، وبلا ألوان حرفية في ما كتبناه`, () => {
    const li = { ar: 0, en: 1, fr: 2, zh: 3 }[l];
    assert.ok(h.includes(esc(HR_TEXT.price[li])), "سطر التسعير");
    assert.match(h, /<title>[^<]*Business Partner[^<]*<\/title>/);
    assert.equal(/شريك الأعمال|شريك أعمالك/.test(h), false);
    const css = h.slice(h.indexOf('<style id="sv1-hr-css">'), h.indexOf("</style>", h.indexOf('<style id="sv1-hr-css">')));
    assert.ok(css.length > 200);
    assert.equal(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(css), false, "لا ألوان حرفية في CSS الصفحة");
    const main = h.slice(h.indexOf("<main>"), h.indexOf("</main>"));
    assert.equal(/style="[^"]*(color|background)/i.test(main), false, "لا لون مضمَّن");
    assert.ok(css.includes("var(--"));
  });
}

test("كل نصّ بأربع لغات غير فارغ، والعربية بحروف عربية والصينية بحروف صينية", () => {
  const latinOk = new Set(["tag"]);
  for (const [k, v] of Object.entries(HR_TEXT)) {
    assert.equal(v.length, 4, k);
    v.forEach((s, i) => assert.ok(typeof s === "string" && s.trim().length > 0, `${k}[${i}]`));
    if (!latinOk.has(k)) { assert.ok(/[؀-ۿ]/.test(v[0]), `${k} ar`); assert.ok(/[一-鿿]/.test(v[3]), `${k} zh`); }
  }
});

test("سطر التسعير يحمل المعنيين: أصحاب العمل يسجّلون مجاناً والبيانات بالاشتراك، والمكاتب لا تدفع بل تُدفع لها", () => {
  assert.match(HR_TEXT.price[0], /يسجّلون مجاناً/);
  assert.match(HR_TEXT.price[0], /بالاشتراك/);
  assert.match(HR_TEXT.price[0], /لا تدفع بل تُدفع لها/);
});

/* ───────────── زرّ /eor ───────────── */
for (const l of ["ar", "en", "fr", "zh"]) {
  test(`/eor (${l}): زرّ «ادخل بوابة Business Partner HR» يفتح /hr-portal بعد قسم الأسئلة وقبل النموذج`, () => {
    const h = renderEor(l);
    const BTN = { ar: "ادخل بوابة Business Partner HR", en: "Enter the Business Partner HR portal", fr: "Accéder au portail Business Partner HR", zh: "进入 Business Partner HR 门户" };
    const m = h.match(/<a class="sv1-btn primary" id="eorHrGate" href="([^"]+)"[^>]*>([^<]+)<\/a>/);
    assert.ok(m, "الزر");
    assert.equal(m[1], `${pre(l)}/hr-portal`);
    assert.equal(m[2], BTN[l]);
    assert.ok(h.indexOf("eorHrGate") > h.indexOf("sv1-eor-faq"), "بعد شرح الخدمة والأسئلة");
    assert.ok(h.indexOf("eorHrGate") < h.indexOf('id="eorForm"'), "قبل النموذج");
  });
}
test("زرّ /eor بالعربية نصه «ادخل بوابة Business Partner HR»", () => {
  assert.match(renderEor("ar"), /id="eorHrGate"[^>]*>ادخل بوابة Business Partner HR<\/a>/);
});

/* ───────────── غير مربوطة ───────────── */
const SITEMAP = read("site/sitemap.xml");
const flatHrefs = (node, out = []) => {
  if (Array.isArray(node)) node.forEach((n) => flatHrefs(n, out));
  else if (node && typeof node === "object") { if (typeof node.href === "string") out.push(node.href); Object.values(node).forEach((v) => flatHrefs(v, out)); }
  return out;
};
const NAV = flatHrefs(JSON.parse(read("site/data/nav.json")));
const FOOTER = flatHrefs(JSON.parse(read("site/data/footer.json")));
const isPath = (h, p) => h === p || h.startsWith(p + "/") || h.startsWith(p + "?") || h.startsWith(p + "#");
const inSitemap = (p) => new RegExp(`<loc>https://businesspartner\\.sa(/(ar|fr|zh))?${p}</loc>`).test(SITEMAP);

test("/vendor غير مربوطة: ليست في sitemap ولا nav.json ولا footer.json", () => {
  assert.equal(inSitemap("/vendor"), false, "sitemap");
  assert.equal(NAV.some((h) => isPath(h, "/vendor")), false, "nav.json");
  assert.equal(FOOTER.some((h) => isPath(h, "/vendor")), false, "footer.json");
});

// /hr القديمة (التوظيف) تبقى كما هي في sitemap وnav وfooter؛ البوابة الجديدة على مسار منفصل /hr-portal ولا تُربط في أي منها.
test("/hr-portal غير مربوطة: ليست في sitemap ولا nav.json ولا footer.json", () => {
  assert.equal(inSitemap("/hr-portal"), false, "sitemap");
  assert.equal(NAV.some((h) => isPath(h, "/hr-portal")), false, "nav.json");
  assert.equal(FOOTER.some((h) => isPath(h, "/hr-portal")), false, "footer.json");
});

test("لا صفحة مولَّدة تربط /vendor أو /hr/gate (البوابة تُدخَل بالرابط أو من زرّ /eor وحده)", () => {
  // الصفحات المبنيّة: /eor هي الوحيدة التي تحمل رابط /hr الجديد؛ وبوابة /vendor تصلها بطاقات /hr فقط.
  const offenders = [];
  for (const rel of ["site/index.html", "site/ar/index.html", "site/about.html", "site/contact.html", "site/hiring.html"]) {
    if (!fs.existsSync(path.join(ROOT, rel))) continue;
    if (/href="(\/(ar|fr|zh))?\/vendor"/.test(read(rel))) offenders.push(rel);
  }
  assert.deepEqual(offenders, []);
});

test("simple-v1-hr.mjs ملف مساعد في site/scripts: لا ملف api/ جديد ولا استيراد للحاسبة أو التسعير", () => {
  const src = read("site/scripts/simple-v1-hr.mjs");
  assert.equal(/_eor-cost|_eor-pricing|api\//.test(src.replace(/\/\/.*$/gm, "")), false);
  const files = fs.readdirSync(path.join(ROOT, "api")).filter((f) => f.endsWith(".js") && !f.startsWith("_"));
  assert.ok(files.length <= 12);
});
