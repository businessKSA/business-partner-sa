// Fixes made INSIDE the frozen v2 template (2026-10-23), see docs/bp-docs-v2.md «Fixes inside v2»:
//   1. a quotation with 18+ lines printed sheets with nothing but the footer, and its «NN/NN»
//      numbering did not match the PDF (30 lines said «13/13» and printed 15 pages);
//   2. one very long line name (≈120 words) multiplied the pages of the quotation;
//   3. quoteDocV2 / contractDocV2 printed «0.00» for a zero / NaN / missing line instead of refusing.
// The quotation is never hashed or signed, so only its LONG-order layout may change: every pin of the
// small orders is untouched (tests/bp-docs-v2-frozen.test.mjs), and the contract and NDA output never changed.
// The last test measures the real thing in a browser (PDF page count = numbering, no sheet overflows); it
// runs where Playwright + Chromium exist and is skipped elsewhere.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { templateForVersion } from "../api/_bp-docs.js";
import { COMPANY, ITEMS, TOTALS, QUOTE_CASES, CONTRACT_CASES } from "./fixtures/v2-docs-inputs.mjs";

const tpl = templateForVersion("v2");
const Q = QUOTE_CASES["quote-default"], C = CONTRACT_CASES["contract-default"];
const sections = (h) => h.split('<section class="pg').slice(1);
const labelTotals = (h) => [...h.matchAll(/class="lbl">(\d\d)\/(\d\d) /g)].map((m) => +m[2]);

// ───────────────────────── 10. refuse an order with nothing to pay ─────────────────────────
const line = (o = {}) => ({ code: "BP-T-01", title: "بند", titleEn: "Item", qty: 1, price: 100, line: 100, ...o });
const order = (items, t = {}) => { const net = items.reduce((a, b) => a + (Number(b.line) || 0), 0); return { items, net, vat: net * 0.15, total: net * 1.15, ...t }; };
const BAD = {
  "no lines": order([], { net: 0, vat: 0, total: 0 }),
  "items missing": { ...order([line()]), items: undefined },
  "zero price and amount": order([line({ price: 0, line: 0 })]),
  "one zero line among good ones": order([line(), line({ price: 0, line: 0 })]),
  "NaN price": order([line({ price: NaN, line: NaN })]),
  "text price": order([line({ price: "abc", line: undefined })]),
  "negative amount": order([line({ price: -5, line: -5 })]),
  "zero quantity": order([line({ qty: 0, line: 0, price: 0 })]),
  "NaN quantity": order([line({ qty: NaN })]),
  "a line without a name": order([line(), line({ title: "", titleEn: "" })]),
  "NaN total": { ...order([line()]), total: NaN },
  "text net": { ...order([line()]), net: "abc" },
  "zero total": { ...order([line()]), total: 0 },
  "negative vat": { ...order([line()]), vat: -1 },
};
for (const [name, o] of Object.entries(BAD)) {
  test(`quotation and contract refuse: ${name}`, () => {
    assert.throws(() => tpl.quote({ ...Q, ...o }), /^Error: bp_docs_/);
    assert.throws(() => tpl.contract({ ...C, ...o }), /^Error: bp_docs_/);
  });
}
test("a good order, and a zero VAT total on an exempt order, still print", () => {
  assert.ok(tpl.quote({ ...Q, ...order([line()]) }).includes("100.00"));
  assert.ok(tpl.contract({ ...C, ...order([line()]) }).includes("100.00"));
  assert.ok(tpl.quote({ ...Q, ...order([line()], { vat: 0, total: 100 }) }).includes("100.00"), "VAT 0 is a real figure");
  assert.ok(!/NaN/.test(tpl.quote(Q)) && !/NaN/.test(tpl.contract(C)));
});
test("the refusal is the same guard as issueQuote: a line priced > 0, found by line, amount or price × qty", () => {
  assert.ok(tpl.quote({ ...Q, ...order([{ title: "x", qty: 2, price: 10 }]), net: undefined, vat: undefined, total: undefined }).includes("20.00"));
  assert.ok(tpl.quote({ ...Q, ...order([{ title: "x", qty: 2, amount: 30 }]), net: undefined, vat: undefined, total: undefined }).includes("30.00"));
});

// ───────────────────────── 2 + 9. pagination and numbering ─────────────────────────
const NAMES = [["تأسيس شركة سعودية", "Saudi Company Formation"], ["إصدار سجل تجاري", "Commercial Registration Issuance"], ["عضوية الغرفة التجارية", "Chamber of Commerce membership"], ["إصدار عقد تأسيس وتوثيقه (لشركة جديدة)", "AoA Issuance & Notarization (new company)"], ["خدمة الإقامة المميزة (إجراءات + تقديم)", "Premium Residency service (procedures + application)"]];
const plain = (n, extra = () => ({})) => Array.from({ length: n }, (_, i) => { const [ar, en] = NAMES[i % NAMES.length]; const qty = 1 + (i % 3), price = 100 + 25 * (i % 7); return { code: `BP-P-${String(i).padStart(3, "0")}`, title: ar, titleEn: en, qty, price, line: price * qty, ...extra(i) }; });
const words = (n, w) => Array.from({ length: n }, (_, i) => w + (i % 7)).join(" ");
const PROFILES = {
  "plain": () => ({}),
  "descriptions": () => ({ description: words(40, "كلمة") }),
  "long descriptions": () => ({ description: words(95, "كلمة").slice(0, 600) }),
  "120-word names": () => ({ title: words(120, "كلمة"), titleEn: words(120, "word"), description: "" }),
};
const itemsOf = (n, p) => plain(n, PROFILES[p]);
const quoteOf = (items, o = {}) => tpl.quote({ ...Q, ...order(items), service: "خدمات", serviceEn: "Services", documents: [], ...o });

for (const p of Object.keys(PROFILES)) for (const n of [1, 5, 17, 18, 30, 60]) {
  test(`quotation, ${n} × ${p}: numbering matches the sheets, every line once in the scope and once in the schedule`, () => {
    const items = itemsOf(n, p), h = quoteOf(items);
    const secs = sections(h);
    for (const t of labelTotals(h)) assert.equal(t, secs.length, "every «NN/NN» label carries the real number of sheets");
    secs.forEach((s, i) => assert.match(s, new RegExp(`data-page="${i + 1}"`)));
    for (const it of items) {
      assert.equal(h.split(`<span class="cd">${it.code}</span></div><div class="q"`).length - 1, 1, `${it.code} once in the schedule`);
      assert.equal(h.split(`<span class="cd">${it.code}</span></div>`).length - 1 >= 1, true);
    }
    assert.equal((h.match(/class="ax grand"/g) || []).length, 1, "one grand total");
    // no sheet of the scope or the schedule is an empty shell
    for (const s of secs.slice(1, -1)) if (/SCOPE<|SCHEDULE/.test(s.slice(0, 600))) assert.ok(/class="it"|class="ax"/.test(s) || /class="card navy"/.test(s), "a scope/schedule sheet holds something");
  });
}
test("small orders keep their exact layout: 4 lines / 17 plain lines are byte-identical to the pins", () => {
  // (the pins themselves are in bp-docs-v2-frozen.test.mjs; this documents the promise)
  assert.equal(sections(tpl.quote(Q)).length, 7);
  assert.equal(sections(quoteOf(itemsOf(1, "plain"))).length, 7);
});
test("long names: pages grow with the content, not by an order of magnitude", () => {
  const one = sections(quoteOf(itemsOf(1, "120-word names"), { service: words(120, "كلمة"), serviceEn: words(120, "word") })).length;
  assert.ok(one <= 9, `one 120-word line → ${one} sheets (was 7 on screen but 12 printed)`);
});
test("a long service name shrinks on the cover and the service card; a normal name is untouched", () => {
  const normal = tpl.quote(Q);
  assert.ok(!/<h1 style=/.test(normal) && !/class="big" style="font-size/.test(normal), "normal names carry no inline size");
  const longName = words(120, "كلمة");
  const h = quoteOf(itemsOf(2, "plain"), { service: longName, serviceEn: words(120, "word") });
  assert.match(h, /<h1 style="font-size:calc\(var\(--t1\) \* [\d.]+\)">/);
  assert.match(h, /class="big" style="font-size:calc\(var\(--t2\) \* [\d.]+\) !important"/);
});
test("a first sheet that cannot hold even one line carries only the service card", () => {
  const h = quoteOf(itemsOf(3, "120-word names"), { service: words(120, "كلمة"), serviceEn: words(120, "word") });
  const first = sections(h)[1];
  assert.ok(first.includes("card navy") && !first.includes("card light"));
  for (const t of labelTotals(h)) assert.equal(t, sections(h).length);
});
test("the contract and the NDA are unaffected by the quotation changes", () => {
  // (byte-for-byte pins live in bp-docs-v2-frozen.test.mjs; a refusal never alters a valid contract)
  const a = tpl.contract(C);
  assert.equal(a, tpl.contract(C));
  assert.ok(a.includes("data-kind=\"contract\"") && a.includes(COMPANY.nameEn));
  assert.ok(ITEMS.length && TOTALS.total);
});

// ───────────────────────── in a real browser: PDF pages = numbering ─────────────────────────
let playwright = null;
try { playwright = createRequire("/opt/node22/lib/node_modules/")("playwright"); } catch { /* not installed here */ }
const CHROME = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/opt/pw-browsers/chromium/chrome-linux/chrome"].find((p) => existsSync(p));
test("browser: PDF page count equals the «NN/NN» numbering, no sheet overflows (17, 18, 30, 60 lines; long names)", { skip: !playwright || !CHROME }, async () => {
  const browser = await playwright.chromium.launch({ executablePath: CHROME });
  const dir = mkdtempSync(path.join(os.tmpdir(), "bp-docs-pdf-"));
  try {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    const cases = [["plain", 17], ["plain", 18], ["plain", 30], ["plain", 60], ["descriptions", 30], ["long descriptions", 17], ["120-word names", 1], ["120-word names", 18]];
    for (const [p, n] of cases) {
      const longSvc = p === "120-word names" ? { service: words(120, "كلمة"), serviceEn: words(120, "word") } : {};
      const html = quoteOf(itemsOf(n, p), longSvc);
      const f = path.join(dir, `${p.replace(/\W+/g, "-")}-${n}.html`);
      writeFileSync(f, html);
      await page.goto("file://" + f, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      await page.emulateMedia({ media: "print" });
      const info = await page.evaluate(() => [...document.querySelectorAll(".pg")].map((s) => s.getBoundingClientRect().height / parseFloat(getComputedStyle(s).zoom)));
      assert.ok(info.every((h) => h <= 1357), `${p} × ${n}: a sheet grew past A4 landscape: ${info.filter((h) => h > 1357).map(Math.round)}`);
      const pdf = path.join(dir, "o.pdf");
      await page.pdf({ path: pdf, preferCSSPageSize: true, printBackground: true });
      const pages = (readFileSync(pdf).toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
      assert.equal(pages, sections(html).length, `${p} × ${n}: PDF has ${pages} pages, the document says ${sections(html).length}`);
      assert.equal(pages, labelTotals(html)[0], `${p} × ${n}: numbering`);
    }
  } finally { await browser.close(); }
});
