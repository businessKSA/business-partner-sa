// The quotation paper of the permanent identity (api/_bp-docs-v3.js): what the standard
// (docs/sales/templates/REV-quote-design-standard.md on claude/sales-team-under-badr) demands, checked on the
// HTML itself — no network, no database, no browser (the browser checks are in bp-docs-v3-layout.test.mjs).
import { createHash } from "node:crypto";
const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
const { quoteDocV3 } = await import("../api/_bp-docs-v3.js");
const { LOGO_V3_PNG_B64 } = await import("../api/_bp-docs-logo-v3.js");
const { templateForVersion, templateForQuoteLang, finalizeBpDoc, versionOfHtml, CURRENT_TEMPLATE } = await import("../api/_bp-docs.js");
const { quoteDocSnapshot } = await import("../api/_quote-doc.js");

const COMPANY = {
  nameAr: "شركة بزنس بارتنر سلوشنز", nameEn: "Business Partner Solutions Company", unified: "7038825860", vat: "312079341500003", shortAddress: "RDAA9214",
  addrEn: ["9214 King Khaled Branch Road, Al Asemah Dist.", "Ad Diriyah 13714, Saudi Arabia"], addrAr: ["9214 طريق الملك خالد الفرعي، حي العاصمة", "الدرعية 13714، المملكة العربية السعودية"],
  phone: "+966 53 054 0231", email: "business@businesspartner.sa", website: "www.businesspartner.sa",
  bank: { beneficiaryAr: "شركة بزنس بارتنر سلوشنز", beneficiaryEn: "Business Partner Solutions Company", bankAr: "مصرف الراجحي", bankEn: "Al Rajhi Bank", iban: "SA53 8000 0511 6080 1622 8498" },
  signer: { nameAr: "باهر بكر علي مقنص", nameEn: "Baher Bakr Ali Magnas", titleAr: "المدير العام", titleEn: "General Manager" },
};
const L1 = { code: "BP-ABSHER-01", title: "تفعيل أبشر أعمال", titleEn: "Absher Business Setup", description: "وصف", qty: 1, price: 300 };
const L2 = { code: "BP-BALADY-01", title: "إصدار رخصة بلدية (مقر تجاري)", titleEn: "Municipal License Issuance", description: "", qty: 2, price: 1000 };
function paper(items, extra = {}) {
  const lines = items.map((i) => ({ ...i, line: i.qty * i.price }));
  const net = lines.reduce((s, l) => s + l.line, 0), vat = Math.round(net * 15) / 100;
  const doc = { ...quoteDocSnapshot(lines, extra.snap || {}), company: COMPANY };
  return quoteDocV3({ ref: "BP-R-AB12CD", number: "Q-AB12CD", clientName: "شركة المثال للتجارة", issuedAt: "2026-10-29T10:00:00Z", validityDays: 14, validUntil: "2026-11-12", items: lines, net, vat, total: net + vat, paymentTerms: "الدفع مقدماً بعد توقيع العقد", doc, bar: false, ...(extra.q || {}) });
}
const sheets = (html) => html.split('<section class="sheet land"').slice(1);

test("the paper is the template's: A4 landscape ivory sheets, cover + services + content + signatures + back cover, numbered n / N", () => {
  const html = paper([L1]);
  const s = sheets(html);
  assert.equal(s.length, 8, "an ordinary one-line order is the template's eight pages");
  assert.match(html, /@page\{size:A4 landscape;margin:0\}/);
  assert.match(html, /\.sheet\.land\{width:1123px;height:794px;padding:30px 36px 0\}/);
  assert.match(html, /\.sheet\{background:#FDFDFC/);
  s.forEach((x, i) => assert.ok(x.includes(`<span class="m">${i + 1} / ${s.length}</span>`), `footer numbering of page ${i + 1}`));
  assert.ok(s[0].includes('class="cv lt"') && s[0].includes("QUOTATION") && s[0].includes("عرض سعر"), "navy cover with both titles");
  assert.ok(s[1].includes("Other Business Partner services") && s[1].includes("خدمات Business Partner الأخرى") && (s[1].match(/class="card"/g) || []).length === 10, "five cards, each in both languages");
  assert.ok(s[s.length - 2].includes("Signatures") && s[s.length - 2].includes("التوقيعان") && (s[s.length - 2].match(/Signature &amp; Stamp/g) || []).length === 2, "two signature boxes");
  assert.ok(s[s.length - 1].includes("CONTACT &amp; BANK TRANSFER") && s[s.length - 1].includes("IBAN") && s[s.length - 1].includes("SA53 8000 0511 6080 1622 8498"), "back cover: contact + bank transfer");
});

test("Arabic on the right, English on the left, rows aligned: every row is an EN column then an AR column; every table row has one gap cell", () => {
  const html = paper([L1, L2], { snap: { documents: [{ title: "السجل التجاري" }] } });
  const rows = html.match(/<div class="rw[^"]*">/g) || [];
  const paired = html.match(/<div class="rw[^"]*"><div class="col" dir="ltr">[\s\S]*?<\/div><div class="col" dir="rtl">/g) || [];
  assert.ok(rows.length > 10 && paired.length === rows.length, "all flex rows are LTR-left / RTL-right");
  const tables = html.match(/<table class="pt[\s\S]*?<\/table>/g) || [];
  assert.ok(tables.length >= 6);
  for (const t of tables) for (const tr of t.match(/<tr[\s\S]*?<\/tr>/g)) assert.equal((tr.match(/class="gp"/g) || []).length, 1, "one centre gap per table row: " + tr.slice(0, 80));
  const price = tables[0];
  const head = price.match(/<tr>([\s\S]*?)<\/tr>/)[1];
  assert.ok(head.indexOf("Service") < head.indexOf('class="gp"') && head.indexOf('class="gp"') < head.indexOf("الخدمة"), "English columns first, Arabic after the gap, in the same row");
  assert.match(html, /<html lang="ar" dir="rtl"/);
});

test("prices before 15% VAT: each line, subtotal, VAT 15%, total; government fees separate; the figures are the quotation's own", () => {
  const html = paper([L1, L2]);
  for (const v of ["300.00", "1,000.00", "2,000.00", "2,300.00", "345.00", "2,645.00"]) assert.ok(html.includes(v), "figure " + v);
  assert.ok(html.includes("Subtotal (before VAT)") && html.includes("الإجمالي قبل الضريبة") && html.includes("VAT 15%") && html.includes("Total incl. VAT") && html.includes("الإجمالي شامل الضريبة"));
  assert.ok(html.includes("Prices exclude 15% VAT. Government fees, if any, are separate and not part of this price."));
  assert.ok(html.includes("الأسعار قبل ضريبة القيمة المضافة <bdi>15%</bdi>. الرسوم الحكومية، إن وجدت، منفصلة ولا تدخل في هذا السعر."));
  assert.ok(html.includes("BP-ABSHER-01") && html.includes("BP-BALADY-01"), "SKUs");
});

test("the identity: palette of the standard only, the three fonts only, the transparent logo byte for byte, no word «draft» in the client's paper", () => {
  const html = paper([L1, L2, { code: "", title: "بند مكتوب", qty: 1, price: 50 }], { q: { clientNotes: "ملاحظة", notes: "ملاحظات الفريق" } });
  const ALLOWED = new Set(["#0B1B5A", "#071442", "#13246E", "#1E3A9E", "#9DB4FF", "#1B2340", "#4A5578", "#F7F8FD", "#F2F4FB", "#EEF1FB", "#DDE1EE", "#8A93B0", "#FDFDFC", "#FFF", "#FFFFFF"]);
  const used = new Set((html.match(/#[0-9A-Fa-f]{3,6}\b/g) || []).map((c) => c.toUpperCase()));
  for (const c of used) assert.ok(ALLOWED.has(c), "a colour outside the standard's table: " + c);
  assert.deepEqual([...(html.matchAll(/rgba?\([^)]*\)/g))].map((m) => m[0]).filter((x, i, a) => a.indexOf(x) === i).sort(), ["rgba(11,27,90,.16)"], "only the navy shadow of the screen view");
  const fonts = new Set([...html.matchAll(/font-family:([^;}"]+)/g)].flatMap((m) => m[1].split(",").map((f) => f.trim().replace(/^'|'$/g, ""))));
  for (const f of fonts) assert.ok(["IBM Plex Sans Arabic", "Playfair Display", "IBM Plex Mono", "sans-serif", "serif", "monospace", "inherit"].includes(f), "a font outside the three: " + f);
  assert.ok(html.includes("fonts.googleapis.com/css2?family=IBM+Plex+Mono&family=IBM+Plex+Sans+Arabic:wght@400;700&family=Playfair+Display:wght@700"));
  assert.equal(createHash("sha256").update(Buffer.from(LOGO_V3_PNG_B64, "base64")).digest("hex"), "a190832f46af358b2ae188d9a4d69e6d14b04be08dfb861cb6b15b68ea530087", "the approved transparent logo, unchanged");
  assert.ok(html.includes("url(data:image/png;base64," + LOGO_V3_PNG_B64.slice(0, 40)));
  assert.ok(!/مسودة|draft/i.test(html), "no «draft» inside a client's paper");
  assert.ok(!html.includes("[●]"), "no placeholder boxes in a client's paper");
});

test("the paper adapts to an ordinary order: no package comparison or revenue model; the scope of each service from its own page; documents bilingual", () => {
  const html = paper([L1, L2]);
  assert.ok(!html.includes("Revenue model") && !html.includes("REV-") && !html.includes("Qualified lead"), "REV content only for REV orders");
  assert.ok(html.includes("Activating the Absher Business account") && html.includes("تفعيل حساب أبشر أعمال"), "scope bullets in both languages from the service's own page");
  assert.ok(html.includes("Duration: Usually one business day") && html.includes("المدة: يوم عمل واحد عادةً"));
  assert.ok(html.includes("Commercial Registration") && html.includes("السجل التجاري"), "required documents, bilingual");
  assert.ok(html.includes("Validity and duration") && html.includes("الصلاحية والمدة") && html.includes("until 12 November 2026") && html.includes("حتى 12 نوفمبر 2026"));
  assert.ok(html.includes("Payment in advance after the contract is signed") && html.includes("الدفع مقدماً بعد توقيع العقد"), "default payment terms in both languages");
  assert.ok(html.includes("Secure online payment from your account in the client portal after the contract is signed"));
});

test("REV orders only: the package comparison, the revenue model and the template's own terms, with the monthly fee read from the catalogue", () => {
  const html = paper([{ code: "REV-GROWTH", title: "تطوير الأعمال — باقة النمو", titleEn: "Business Development — Growth Package", qty: 3, price: 5000 }]);
  const s = sheets(html);
  assert.equal(s.length, 8, "the template's eight pages");
  for (const x of ["Revenue model (hybrid)", "نموذج الإيراد (هجين)", "Qualified leads per month (committed minimum)", "12.5%", "7.5%", "Hands-on help completing vendor registration", "Business Development as a Service", "تطوير الأعمال كخدمة", "Months"]) assert.ok(html.includes(x), x);
  for (const v of ["2,500", "5,000", "9,500", "15,000", "28,500", "114,000"]) assert.ok(html.includes(`<span class="num">${v}</span>`), "package figure " + v);
  assert.ok(html.includes("15,000.00") && html.includes("17,250.00"), "the order: 3 months of Growth + VAT");
  assert.equal((html.match(/th colspan="1" class="c (?:en|ar) sel"/g) || []).length, 4, "the chosen package column is marked in the price table and in the scope table (both languages)");
  assert.ok(s[2].includes("Price") && s[2].includes("Revenue model"));
  // a REV line with no package data (catalogue price missing) prints as an ordinary line, never with invented numbers
  const plain = quoteDocV3({ ref: "BP-R-AB12CD", number: "Q-1", clientName: "x", issuedAt: "2026-10-29T10:00:00Z", items: [{ code: "REV-GROWTH", title: "باقة", qty: 1, price: 5000, line: 5000 }], doc: { company: COMPANY }, bar: false });
  assert.ok(!plain.includes("Revenue model"));
});

test("lines waiting for a price, customer notes, team notes and a custom payment term are printed, in the right column, and nothing is dropped silently", () => {
  const html = paper([L1], { q: {
    pending: [{ title: "الاستقطاب التنفيذي", reasonAr: "سعرها حسب دراسة حالتك", reasonEn: "priced after studying the case" }],
    clientNotes: "أحتاجها قبل الأحد", notes: "Extra team note", paymentTerms: "٥٠٪ مقدماً", hasNda: true } });
  for (const x of ["Lines awaiting a price", "بنود بانتظار التسعير", "الاستقطاب التنفيذي", "priced after studying the case", "Customer notes", "ملاحظات العميل", "أحتاجها قبل الأحد", "Extra team note", "٥٠٪ مقدماً", "Information exchanged is subject to the Non-Disclosure Agreement"]) assert.ok(html.includes(x), x);
  assert.ok(!paper([L1]).includes("Non-Disclosure Agreement"), "the NDA sentence only when the request has an NDA");
});

test("an addendum is the same paper with its own title and its base quotation named", () => {
  const html = paper([L2], { q: { kind: "addendum", number: "Q-AB12CD-A1", baseNumber: "Q-AB12CD" } });
  assert.match(html, /data-kind="addendum"/);
  assert.ok(html.includes("QUOTATION ADDENDUM") && html.includes("ملحق عرض سعر") && html.includes("This addendum supplements quotation Q-AB12CD") && html.includes("Q-AB12CD-A1"));
});

test("a paper with no priced line is refused, like the contract and issueQuote refuse it", () => {
  const base = { ref: "R", number: "Q", clientName: "x", issuedAt: "2026-10-29T10:00:00Z", doc: { company: COMPANY } };
  assert.throws(() => quoteDocV3({ ...base, items: [] }), /bp_docs_no_items/);
  assert.throws(() => quoteDocV3({ ...base, items: [{ title: "x", qty: 1, price: 0 }] }), /bp_docs_bad_line/);
  assert.throws(() => quoteDocV3({ ...base, items: [{ title: "x", qty: -1, price: 5 }] }), /bp_docs_bad_line/);
  assert.throws(() => quoteDocV3({ ...base, items: [{ title: "x", qty: 1, price: 5 }, { qty: 1, price: 5 }] }), /bp_docs_unnamed_item/);
  assert.throws(() => quoteDocV3({ ...base, items: [{ title: "x", qty: 1, price: 5 }], total: 0 }), /bp_docs_bad_total/);
});

test("deterministic, escaped, and the print button is added on the way out only", () => {
  const a = paper([L1]), b = paper([L1]);
  assert.equal(a, b);
  const hostile = paper([{ ...L1, title: '<img src=x onerror=alert(1)>', titleEn: '"><script>alert(2)</script>' }], { q: { clientName: "<b>x</b>", notes: "<script>1</script>" } });
  assert.ok(!/<script>alert|<img src=x|<b>x<\/b>|<script>1/.test(hostile), "markup in names and notes is escaped");
  const withBar = quoteDocV3({ ref: "R", number: "Q-1", clientName: "x", issuedAt: "2026-10-29T10:00:00Z", items: [{ title: "x", qty: 1, price: 5 }], doc: { company: COMPANY } });
  assert.ok(withBar.includes('class="bpd-bar"') && withBar.includes("window.print()") && withBar.includes("in-frame"));
  assert.ok(!paper([L1]).includes('class="bpd-bar"'));
  assert.equal(finalizeBpDoc(withBar), withBar, "idempotent through the one door");
});

test("the door: v3 is registered for QUOTATIONS only — contracts and NDAs stay v2; kill switches; French and Chinese keep the old paper", () => {
  const t = templateForVersion("v3");
  assert.equal(t.version, "v3"); assert.equal(typeof t.quote, "function"); assert.equal(t.contract, undefined); assert.equal(t.nda, undefined);
  assert.equal(CURRENT_TEMPLATE, "v2", "new contracts and NDAs are still v2");
  const keep = { a: process.env.BP_DOCS_TEMPLATE, b: process.env.BP_DOCS_QUOTE_TEMPLATE };
  try {
    delete process.env.BP_DOCS_TEMPLATE; delete process.env.BP_DOCS_QUOTE_TEMPLATE;
    assert.equal(templateForQuoteLang("ar"), "v3"); assert.equal(templateForQuoteLang("en"), "v3"); assert.equal(templateForQuoteLang(""), "v3");
    assert.equal(templateForQuoteLang("fr"), "v1"); assert.equal(templateForQuoteLang("zh"), "v1");
    process.env.BP_DOCS_QUOTE_TEMPLATE = "v2"; assert.equal(templateForQuoteLang("ar"), "v2", "BP_DOCS_QUOTE_TEMPLATE=v2 keeps the previous quotation paper");
    process.env.BP_DOCS_TEMPLATE = "v1"; assert.equal(templateForQuoteLang("ar"), "v1", "BP_DOCS_TEMPLATE=v1 is still the kill switch of every paper");
  } finally { for (const [k, v] of [["BP_DOCS_TEMPLATE", keep.a], ["BP_DOCS_QUOTE_TEMPLATE", keep.b]]) { if (v == null) delete process.env[k]; else process.env[k] = v; } }
  const html = paper([L1]);
  assert.equal(versionOfHtml(html), "v3");
  assert.equal(templateForVersion("v3").finalize(html), finalizeBpDoc(html));
});

test("the snapshot: scope, duration and documents come from the service's own page; REV figures from the catalogue; never invented", () => {
  const snap = quoteDocSnapshot([{ code: "BP-ABSHER-01", title: "x", price: 300 }, { code: "REV-GROWTH", title: "y", price: 5000 }], { documents: [{ title: "السجل التجاري" }, { title: "ورقة لا ترجمة لها" }] });
  assert.ok(snap.services["BP-ABSHER-01"].featuresEn.length >= 1 && snap.services["BP-ABSHER-01"].durationEn);
  assert.equal(snap.services["REV-GROWTH"], undefined, "a package has no service page: nothing invented");
  assert.deepEqual(snap.documents.filter((d) => d.ar === "السجل التجاري").map((d) => d.en), ["Commercial Registration"], "the same document is listed once, with its English title");
  assert.ok(snap.documents.some((d) => d.ar === "ورقة لا ترجمة لها" && d.en === "ورقة لا ترجمة لها"), "no translation source: the Arabic title stands in both columns");
  assert.deepEqual(snap.rev.packages.map((p) => p.monthly), [2500, 5000, 9500], "monthly fees from services.json");
  assert.equal(snap.rev.selected, "REV-GROWTH");
  assert.ok(snap.company && snap.company.unified && snap.company.bank && snap.company.addrEn.length, "the company, as the site footer reads it");
  assert.equal(quoteDocSnapshot([{ code: "BP-ABSHER-01", title: "x", price: 300 }]).rev, undefined, "no REV block for an ordinary order");
});
