// Sales documents, template v2 (api/_bp-docs-v2.js, frozen — see bp-docs-v2-frozen.test.mjs): quotation, services agreement, NDA.
// Pure generator tests — no database, no network. The flow (version stamping, rebuild,
// signing) is in tests/bp-docs-flow.test.mjs; the frozen v1 paper in tests/bp-docs-v1-frozen.test.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { quoteDocV2, contractDocV2, ndaDocV2, normLines, annexTotals, priceAnnexHtml, companyFacts, fmtDate } from "../api/_bp-docs-v2.js";
import { finalizeBpDoc, isBpDoc as isBpDocV2, templateForLang, defaultTemplateVersion } from "../api/_bp-docs.js";
import { portalContractHtml, contractHtml } from "../api/_docusign.js";

const catalog = JSON.parse(readFileSync(new URL("../site/assets/data/catalog.json", import.meta.url), "utf8"));
const bySku = new Map(catalog.services.map((s) => [s.code, s]));
const priced = catalog.services.filter((s) => s.amount > 0).slice(0, 7);
// lines exactly as priceItems() in api/_simple.js builds them: the price IS the catalogue amount for the SKU
const items = priced.map((s, i) => ({ code: s.code, title: s.nameAr, titleEn: s.nameEn, description: i === 0 ? "وصف البند" : "", qty: i === 1 ? 2 : 1, price: s.amount, line: s.amount * (i === 1 ? 2 : 1) }));
const net = items.reduce((a, b) => a + b.line, 0);
const vat = Math.round(net * 15) / 100;
const total = Math.round((net + vat) * 100) / 100;
const money = (n) => Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const Q = { ref: "BP-R-A1B2C3", number: "Q-A1B2C3", clientName: "شركة الأفق المتقدم", service: "خدمات تأسيس", serviceEn: "Business setup services", items, net, vat, total, issuedAt: "2026-10-23T09:00:00Z", validUntil: "2026-11-06", documents: ["صورة الهوية"] };
const C = { ref: Q.ref, number: "C-A1B2C3", clientName: Q.clientName, service: Q.service, serviceEn: Q.serviceEn, items, net, vat, total, issuedAt: Q.issuedAt, leadTime: "10 أيام عمل", executor: "Business Partner" };
const N = { ref: Q.ref, number: "NDA-A1B2C3", clientName: Q.clientName, service: Q.service, serviceEn: Q.serviceEn, issuedAt: Q.issuedAt };

const sections = (h) => h.split('<section class="pg').slice(1);
const textOf = (h) => h.replace(/<style>[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");

// ───────────────────────── structure: cover, inner pages, back cover ─────────────────────────
for (const [name, make] of [["quotation", () => quoteDocV2(Q)], ["services agreement", () => contractDocV2(C)], ["NDA", () => ndaDocV2(N)]]) {
  test(`${name}: cover first, inner pages, company back cover last`, () => {
    const pages = sections(make());
    assert.ok(pages.length >= 4, `${name} has ${pages.length} pages`);
    assert.match(pages[0], /^ dark cv"/, "first page is the navy cover");
    assert.match(pages[pages.length - 1], /^ dark bk"/, "last page is the navy back cover");
    for (const p of pages.slice(1, -1)) assert.ok(!/ dark /.test(p.slice(0, 12)), "inner pages are light");
    // the back cover carries the company's details, from site.json (no invented data)
    const back = textOf(pages[pages.length - 1]);
    const c = companyFacts();
    for (const v of [c.nameEn, c.nameAr, c.unified, c.vat, c.shortAddress, c.email, c.website]) assert.ok(v && back.includes(v), `back cover has ${v}`);
    // the cover names the document, the client and the number
    const cover = textOf(pages[0]);
    assert.ok(cover.includes("شركة الأفق المتقدم"), "client on the cover");
    assert.ok(cover.includes(name === "NDA" ? "NDA-A1B2C3" : name === "quotation" ? "Q-A1B2C3" : "C-A1B2C3"), "document number on the cover");
    assert.ok(cover.includes("23 October 2026") && cover.includes("23 أكتوبر 2026"), "date on the cover, both languages");
  });
  test(`${name}: page numbers are consecutive and total matches`, () => {
    const pages = sections(make());
    pages.forEach((p, i) => assert.match(p, new RegExp(`data-page="${i + 1}"`)));
    const labels = [...make().matchAll(/class="lbl">[^<]*?(\d\d)\/(\d\d)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    assert.ok(labels.length >= pages.length - 1);
    for (const [, tot] of labels) assert.equal(tot, pages.length);
  });
  test(`${name}: deterministic — same input, same bytes`, () => {
    assert.equal(make(), make());
  });
}

// ───────────────────────── English left, Arabic right ─────────────────────────
test("quotation: every two-column block is English first (left), Arabic second (right)", () => {
  const h = quoteDocV2(Q);
  const blocks = [...h.matchAll(/<div class="cols[^"]*">(<div class="col (\w+)"[^>]*>)[\s\S]*?<\/div>(?=<div class="col (\w+)")/g)];
  assert.ok(blocks.length >= 5);
  for (const m of blocks) { assert.equal(m[2], "en"); assert.equal(m[3], "ar"); }
  // the grid is forced left-to-right so the order holds whatever the page direction is
  assert.match(h, /\.cols\{[^}]*direction:ltr/);
  assert.match(h, /\.col\.en,\.col\.b\{direction:ltr;text-align:left\}/);
  assert.match(h, /\.col\.ar,\.col\.a\{direction:rtl;text-align:right\}/);
});
test("contract and NDA: each clause row is EN then AR; signature blocks EN then AR", () => {
  for (const h of [contractDocV2(C), ndaDocV2(N)]) {
    const rows = [...h.matchAll(/<div class="g[^"]*"><div class="e" lang="en">[\s\S]*?<\/div><div class="a" lang="ar">/g)];
    assert.ok(rows.length > 10);
    assert.match(h, /\.g\{[^}]*direction:ltr/);
    const sign = h.slice(h.lastIndexOf('<div class="sign">'));
    assert.ok(sign.indexOf('lang="en"') < sign.indexOf('lang="ar"'));
  }
});
test("contract is bilingual: Arabic and English text for the same clause", () => {
  const t = textOf(contractDocV2(C));
  for (const s of ["Services Agreement", "عقد تقديم خدمات", "GOVERNING LAW", "النظام الواجب التطبيق", "CONFIDENTIALITY", "السرية", "Schedule of items and prices", "جدول البنود والأسعار"]) assert.ok(t.includes(s), s);
});

// ───────────────────────── the schedule of items and prices ─────────────────────────
for (const [name, make] of [["quotation", () => quoteDocV2(Q)], ["services agreement", () => contractDocV2(C)]]) {
  test(`${name}: the schedule lists every line with SKU, quantity, catalogue price and amount`, () => {
    const h = make();
    const t = textOf(h);
    assert.ok(/Schedule of items and prices/.test(t) && /جدول البنود والأسعار/.test(t));
    for (const it of items) {
      const cat = bySku.get(it.code);
      assert.equal(cat.amount, it.price, "test input is catalogue-priced");
      const row = h.split('<div class="ax">').slice(1).map((r) => r.split('<div class="ax')[0]).find((r) => r.includes(`>${it.code}<`));
      assert.ok(row, `row for ${it.code}`);
      assert.ok(row.includes(esc(it.title)) && row.includes(esc(it.titleEn)), "both names");
      assert.ok(new RegExp(`<div class="q"[^>]*>${it.qty}</div>`).test(row), "qty");
      assert.ok(new RegExp(`<div class="u"[^>]*>${money(it.price).replace(".", "\\.")}</div>`).test(row), `unit price ${it.price} of ${it.code} is the catalogue amount`);
      assert.ok(new RegExp(`<div class="a"[^>]*>${money(it.line).replace(".", "\\.")}</div>`).test(row), "line amount");
    }
  });
  test(`${name}: subtotal, 15% VAT and total are printed and add up`, () => {
    const h = make();
    const grand = h.match(/<div class="ax grand">[\s\S]*?<\/div><\/div>/)[0];
    assert.ok(grand.includes(money(total)));
    assert.ok(h.includes(`<div class="a">${money(net)}</div>`) && h.includes(`<div class="a">${money(vat)}</div>`));
    assert.ok(/VAT 15%/.test(h) && /ضريبة القيمة المضافة <bdi>15%<\/bdi>/.test(h));
    assert.equal(Math.round((net + vat) * 100) / 100, total);
  });
}
test("no price is changed: amounts are read from the lines, and the caller's totals win", () => {
  const lines = normLines(items);
  assert.deepEqual(lines.map((l) => [l.code, l.unit, l.line]), items.map((i) => [i.code, i.price, i.line]));
  const t = annexTotals(lines, { net: 100, vat: 15, total: 115 });
  assert.deepEqual([t.net, t.vat, t.total], [100, 15, 115]);
  // with no totals given they are computed: subtotal + 15%
  const t2 = annexTotals(lines, {});
  assert.equal(t2.net, net); assert.equal(t2.vat, vat); assert.equal(t2.total, total);
  // an old-style line (amount / price only) is still read
  assert.equal(normLines([{ title: "x", qty: 3, price: 10 }])[0].line, 30);
});
test("a long order paginates: every SKU appears once in the quote and once in the contract, totals once", () => {
  const many = catalog.services.filter((s) => s.amount > 0).slice(0, 45).map((s) => ({ code: s.code, title: s.nameAr, titleEn: s.nameEn, description: "وصف طويل ".repeat(12), qty: 1, price: s.amount, line: s.amount }));
  const mnet = many.reduce((a, b) => a + b.line, 0);
  const args = { net: mnet, vat: Math.round(mnet * 15) / 100, total: Math.round(mnet * 115) / 100 };
  for (const h of [quoteDocV2({ ...Q, items: many, ...args }), contractDocV2({ ...C, items: many, ...args })]) {
    for (const it of many) assert.equal(h.split(`<span class="cd">${it.code}</span></div><div class="q"`).length - 1, 1, `${it.code} once in the schedule`);
    assert.equal((h.match(/class="ax grand"/g) || []).length, 1, "one grand total");
    assert.ok(sections(h).length > 8);
  }
});
test("priceAnnexHtml: totals only when asked (last page)", () => {
  const l = normLines(items), t = annexTotals(l, { net, vat, total });
  assert.ok(!priceAnnexHtml(l, t, { last: false }).includes("ax grand"));
  assert.ok(priceAnnexHtml(l, t, { last: true }).includes("ax grand"));
});

// ───────────────────────── printing ─────────────────────────
test("print format: quotation is A4 landscape, contract and NDA A4 portrait, backgrounds print", () => {
  assert.match(quoteDocV2(Q), /@page\{size:297mm 210mm;margin:0\}/);
  for (const h of [contractDocV2(C), ndaDocV2(N)]) assert.match(h, /@page\{size:210mm 297mm;margin:0\}/);
  for (const h of [quoteDocV2(Q), contractDocV2(C)]) {
    assert.match(h, /print-color-adjust:exact/);
    assert.match(h, /break-after:page/);
    assert.match(h, /@media print\{[\s\S]*\.bpd-bar\{display:none !important\}/);
  }
  // pages scale to exactly A4: 297mm / 1920px and 210mm / 1240px
  assert.match(quoteDocV2(Q), /@media print\{[\s\S]*?zoom:0\.58465 !important/);
  assert.match(contractDocV2(C), /@media print\{[\s\S]*?zoom:0\.64008 !important/);
});
test("print button: on the quotation and on a contract on its way out; never in the stored (hashed) paper", () => {
  assert.match(quoteDocV2(Q), /class="bpd-bar"[^>]*>.*Print \/ Save as PDF/s);
  assert.ok(!quoteDocV2({ ...Q, bar: false }).includes('class="bpd-bar"'));
  const stored = contractDocV2(C);
  assert.ok(!stored.includes('class="bpd-bar"'), "stored contract has no screen chrome");
  assert.ok(portalContractHtml(stored).includes('class="bpd-bar"'), "the portal view has it");
  assert.equal(finalizeBpDoc(finalizeBpDoc(stored)), finalizeBpDoc(stored), "idempotent");
});
test("no server-side PDF: the module imports no PDF library or browser", () => {
  const src = readFileSync(new URL("../api/_bp-docs-v2.js", import.meta.url), "utf8");
  const imports = [...src.matchAll(/^import .* from "([^"]+)"/gm)].map((m) => m[1]);
  assert.deepEqual(imports.sort(), ["./_bp-docs-logo.js", "./_identity.js", "node:fs", "node:path", "node:url"]);
});
test("design tokens: navy only, the three fonts, no gold/yellow", () => {
  const h = quoteDocV2(Q);
  assert.match(h, /IBM\+Plex\+Sans\+Arabic/); assert.match(h, /Playfair\+Display/); assert.match(h, /IBM\+Plex\+Mono/);
  for (const c of ["#0B1B5A", "#071442", "#9DB4FF", "#F7F8FD", "#DDE1EE", "#1B2340", "#4A5578"]) assert.ok(h.includes(c), c);
  assert.ok(!/#E2B04A|#9A6B12|#f59e0b|#fbbf24|gold|orange/i.test(h.replace(/data:image\/png;base64,[A-Za-z0-9+/=]+/, "")));
  assert.match(h, /data:image\/png;base64,/, "the logo is embedded, not fetched");
});

// ───────────────────────── signing compatibility (shared with v1) ─────────────────────────
test("contract: DocuSign anchors in the stored paper, none on the page a person reads", () => {
  const stored = contractDocV2(C);
  for (const a of ["/sig1/", "/date1/", "/sig2/", "/date2/"]) assert.equal((stored.match(new RegExp(a, "g")) || []).length, 1, a);
  const shown = portalContractHtml(stored);
  for (const a of ["/sig1/", "/date1/", "/sig2/", "/date2/"]) assert.ok(!shown.includes(a), a);
  assert.ok(shown.includes("خانة التوقيع"), "pending-signature note");
});
test("contract: signed view carries the signer's name, date, drawing and short fingerprint; clauses unchanged", () => {
  const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const sig = { name: "أحمد العميل", at: "2026-10-23T10:30:00.000Z", contract_sha256: "0123456789abcdef0123456789abcdef", image: PNG };
  const stored = contractDocV2(C);
  const p = portalContractHtml(stored, { signature: sig, signedAt: sig.at });
  assert.ok(p.includes("أحمد العميل") && p.includes(`<img src="${PNG}"`) && p.includes("0123456789abcdef") && !p.includes("0123456789abcdef0"));
  // the print button is added on the way out; everything else before the signature block is the paper
  const noBar = (h) => h.replace(/\n<div class="bpd-bar"[\s\S]*?<\/script>/, "");
  const clauseText = (h) => { const x = noBar(h).replace(/\/(sig|date)2\//g, ""); return x.slice(0, x.lastIndexOf('<div class="sign">')); };
  assert.equal(clauseText(stored), clauseText(portalContractHtml(stored)));
  assert.equal(clauseText(stored), clauseText(p));
  assert.ok(p.includes("23 October 2026 at 13:30") || p.includes("23 أكتوبر 2026"));
});
test("v1 output is untouched by finalizeBpDoc and the portal wrapper", () => {
  const v1 = contractHtml({ ref: "R", clientName: "x", lines: [], net: 1, vat: 0.15, total: 1.15, today: "t" });
  assert.equal(finalizeBpDoc(v1), v1);
  assert.ok(!isBpDocV2(v1));
  assert.ok(isBpDocV2(contractDocV2(C)) && isBpDocV2(quoteDocV2(Q)) && isBpDocV2(ndaDocV2(N)));
});

// ───────────────────────── subscription, delivery, NDA content ─────────────────────────
test("contract: subscription terms and success fee, or delivery time", () => {
  const sub = textOf(contractDocV2({ ...C, subscription: { renewsAt: 800, commissionPercent: 5 } }));
  assert.ok(/monthly subscription/.test(sub) && /SAR 800/.test(sub) && /success fee of 5%/.test(sub));
  const del = textOf(contractDocV2(C));
  assert.ok(/within 10 أيام عمل/.test(del) && !/monthly subscription/.test(del));
  assert.ok(/المقابل المالي/.test(del));
});
test("NDA: mutual, 2 years + 3 survival, Saudi law / Riyadh courts, purpose from the order", () => {
  const t = textOf(ndaDocV2(N));
  for (const s of ["MUTUAL NON-DISCLOSURE AGREEMENT", "اتفاقية عدم الإفصاح المتبادلة", "two (2) years", "three (3) years", "Courts of Riyadh", "محاكم الرياض", "Business setup services", "خدمات تأسيس"]) assert.ok(t.includes(s), s);
  for (let k = 1; k <= 8; k++) assert.ok(t.includes(`${k}.1 `) || t.includes(`${k}. `), `clause ${k}`);
  assert.ok(/\/sig1\//.test(ndaDocV2(N)));
});
test("NDA: nothing is assumed about the client's legal form or country", () => {
  const t = textOf(ndaDocV2({ ...N, clientName: "فلان" }));
  assert.ok(!/private company limited by shares|شركة مساهمة خاصة|Director/.test(t));
});

// ───────────────────────── company data and versioning ─────────────────────────
test("company data comes from site.json; the CR number is printed only when configured", () => {
  const prev = process.env.COMPANY_CR_NUMBER, prevD = process.env.COMPANY_CR_DATE;
  delete process.env.COMPANY_CR_NUMBER; delete process.env.COMPANY_CR_DATE;
  try {
    assert.equal(companyFacts().cr, "");
    for (const h of [quoteDocV2(Q), contractDocV2(C), ndaDocV2(N)]) assert.ok(!h.includes("1009014355"), "no unverified government number");
    process.env.COMPANY_CR_NUMBER = "1009014355"; process.env.COMPANY_CR_DATE = "16/04/2024";
    const t = textOf(contractDocV2(C));
    assert.ok(t.includes("Commercial Registration no. 1009014355 dated 16/04/2024") && t.includes("سجل تجاري رقم 1009014355 بتاريخ 16/04/2024"));
    assert.ok(textOf(quoteDocV2(Q)).includes("1009014355"));
  } finally {
    if (prev === undefined) delete process.env.COMPANY_CR_NUMBER; else process.env.COMPANY_CR_NUMBER = prev;
    if (prevD === undefined) delete process.env.COMPANY_CR_DATE; else process.env.COMPANY_CR_DATE = prevD;
  }
  const site = JSON.parse(readFileSync(new URL("../site/data/site.json", import.meta.url), "utf8"));
  assert.equal(companyFacts().shortAddress, site.legal.shortAddress);
  assert.equal(companyFacts().unified, site.legal.unified);
});
test("a stored company snapshot makes a rebuild identical even if the live data later changes", () => {
  const snap = companyFacts();
  const a = contractDocV2({ ...C, company: snap });
  const changed = { ...snap, phone: "+966 50 000 0000", addressEn: "Somewhere else", cr: "1234567890" };
  assert.notEqual(contractDocV2({ ...C, company: changed }), a);
  assert.equal(contractDocV2({ ...C, company: JSON.parse(JSON.stringify(snap)) }), a);
});
test("template version: v2 for ar/en, v1 for other languages, kill switch BP_DOCS_TEMPLATE=v1", () => {
  const prev = process.env.BP_DOCS_TEMPLATE;
  try {
    delete process.env.BP_DOCS_TEMPLATE;
    assert.equal(defaultTemplateVersion(), "v2");
    assert.equal(templateForLang("ar"), "v2"); assert.equal(templateForLang("en"), "v2"); assert.equal(templateForLang(undefined), "v2");
    assert.equal(templateForLang("fr"), "v1"); assert.equal(templateForLang("zh"), "v1");
    process.env.BP_DOCS_TEMPLATE = "v1";
    assert.equal(templateForLang("ar"), "v1");
  } finally { if (prev === undefined) delete process.env.BP_DOCS_TEMPLATE; else process.env.BP_DOCS_TEMPLATE = prev; }
});
test("dates are fixed-format Gregorian at Riyadh time, independent of the ICU build", () => {
  assert.equal(fmtDate("2026-10-23T21:30:00Z", "en"), "24 October 2026");
  assert.equal(fmtDate("2026-10-23T09:00:00Z", "ar"), "23 أكتوبر 2026");
  assert.equal(fmtDate("2026-11-06", "en"), "6 November 2026");
  assert.equal(fmtDate("", "ar"), ""); assert.equal(fmtDate("not a date", "en"), "");
});

// ───────────────────────── safety ─────────────────────────
test("user text is escaped in all three documents", () => {
  const evil = '<img src=x onerror=alert(1)> "q" & co';
  const outs = [quoteDocV2({ ...Q, clientName: evil, service: evil, notes: evil, items: [{ ...items[0], title: evil, description: evil }] }),
    contractDocV2({ ...C, clientName: evil, service: evil, items: [{ ...items[0], title: evil }] }), ndaDocV2({ ...N, clientName: evil, service: evil })];
  for (const h of outs) { assert.ok(!h.includes("<img src=x"), "raw tag"); assert.ok(h.includes("&lt;img src=x")); }
});
test("an empty order still renders a complete document", () => {
  for (const h of [quoteDocV2({ ...Q, items: [], net: 0, vat: 0, total: 0 }), contractDocV2({ ...C, items: [], net: 0, vat: 0, total: 0 })]) {
    assert.ok(sections(h).length >= 4); assert.match(sections(h)[0], /^ dark cv"/);
  }
});

function esc(v) { return String(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
