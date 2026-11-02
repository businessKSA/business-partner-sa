// /suppliers و/partner-dashboard على SV1 كاملةً (وكيل suppliers-partners): بلا main.js ولا قشرة قديمة ولا localStorage للجلسة،
// وكل زرّ في التعريف يقود إلى مسار التسجيل الحيّ، والقراءة بـPOST لا بكلمة مرور في الرابط.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import { simpleV1 } from "../site/scripts/simple-v1.mjs";
import { buildSimplePartners, buildSimplePartnerDashboard } from "../site/scripts/simple-v1-partner.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pathInLang = (p, l) => (l === "en" ? p : "/" + l + p);
const CATS = [{ en: "HR services", ar: "خدمات الموارد البشرية" }, { en: "Other", ar: "أخرى" }];

function render(l) {
  let LANG = l;
  const head = (title) => `<!doctype html><html lang="${LANG}"><head><meta charset="utf-8"><title>${esc(title)}</title></head>`;
  const SV1 = simpleV1({ lang: () => LANG, esc, site: {}, head, pathInLang, assetV: (x) => x, knowledge: null });
  const Lraw = (en, ar) => (LANG === "ar" ? ar : en);
  const u = (h) => (LANG === "en" ? h : "/" + LANG + h);
  return {
    sup: buildSimplePartners(SV1, { esc, Lraw, u, cats: CATS }),
    dash: buildSimplePartnerDashboard(SV1, { lang: () => LANG, esc, Lraw, cats: CATS }),
  };
}

for (const l of ["ar", "en"]) {
  const { sup, dash } = render(l);
  test(`/suppliers (${l}): كل زرّ يقود إلى لوحة الشريك الجديدة (#signup/#login) بلا صفحات قديمة`, () => {
    assert.ok(!/assets\/js\/main\.js/.test(sup), "لا main.js");
    assert.ok(!/class="(btn |hero hero--sm|section )/.test(sup), "لا أصناف قديمة");
    assert.match(sup, /partner-dashboard#signup/);
    assert.match(sup, /partner-dashboard#login/);
    assert.ok(!/(href="[^"]*\/(account|admin)\b)/.test(sup), "لا روابط إلى /account ولا /admin");
    assert.ok(!/ليش|وش تلقى|تجيك|تشوف/.test(sup), "فصحى لا عامية");
    assert.ok(!/الوكيل/.test(sup), "التسمية «المستشار الذكي» لا «الوكيل»");
  });
  test(`/partner-dashboard (${l}): SV1 بلا main.js، دخول وتسجيل وتفعيل ولوحة، وجلسة في sessionStorage فقط`, () => {
    assert.ok(!/assets\/js\/main\.js/.test(dash));
    assert.match(dash, /noindex/);
    for (const id of ["pLogin", "pSignup", "pVerify", "pDash", "pdQual", "pwForm"]) assert.ok(dash.includes(`id="${id}"`), id);
    assert.ok(/sessionStorage\.setItem\(KEY/.test(dash), "الجلسة في sessionStorage");
    assert.ok(!/localStorage\.setItem\("bp_supplier"/.test(dash), "لا كلمة مرور في localStorage");
    assert.ok(/localStorage\.removeItem\("bp_supplier"\)/.test(dash), "تنظيف أثر كلمة المرور القديمة");
    assert.ok(!/action=orders|action=wallet|[?&]pw=/.test(dash), "لا كلمة مرور في رابط");
    assert.match(dash, /type: "portal"|"portal"/);
  });
}

test("api/_suppliers.js: قراءة الطلبات والمحفظة تقبل POST بنوع portal/wallet وتُبقي GET للقديم", () => {
  const src = fs.readFileSync(path.join(ROOT, "api/_suppliers.js"), "utf8");
  assert.match(src, /b\.type === "portal" \|\| b\.type === "wallet"/);
  assert.match(src, /req\.method === "GET" \|\| postRead/);
});
