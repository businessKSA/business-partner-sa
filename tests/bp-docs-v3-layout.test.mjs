// The quotation paper in a real browser (Chromium via Playwright; skipped where it is not installed):
// the server has no browser, so it ESTIMATES how tall each block is and moves a block that does not fit to
// the next sheet — never shrinking the font (the standard). This test is what keeps those estimates honest:
// over seeded random orders (1–24 lines, long names, many documents, waiting lines, notes, REV packages)
// no sheet's content passes the footer margin of the standard (650px of 794), no sheet is empty, nothing
// overflows sideways, and the PDF has exactly one A4 landscape page per sheet, numbered n / N.
import { createRequire } from "node:module";
import { existsSync, mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
const { quoteDocV3 } = await import("../api/_bp-docs-v3.js");
const { quoteDocSnapshot } = await import("../api/_quote-doc.js");

let playwright = null;
try { playwright = createRequire("/opt/node22/lib/node_modules/")("playwright"); } catch { /* not installed here */ }
const CHROME = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/opt/pw-browsers/chromium/chrome-linux/chrome"].find((p) => existsSync(p));

const sv = JSON.parse(readFileSync(new URL("../site/data/services.json", import.meta.url), "utf8"));
const i18n = JSON.parse(readFileSync(new URL("../site/data/service-i18n.json", import.meta.url), "utf8"));
const SEEDS = Number(process.env.V3_LAYOUT_SEEDS) || 40;
const catalogue = (Array.isArray(sv) ? sv : sv.services).filter((s) => s.price && s.price.amount > 0 && s.pricingModel === "One Time");
const COMPANY = {
  nameAr: "شركة بزنس بارتنر سلوشنز", nameEn: "Business Partner Solutions Company", unified: "7038825860", vat: "312079341500003", shortAddress: "RDAA9214",
  addrEn: ["9214 King Khaled Branch Road, Al Asemah Dist.", "Ad Diriyah 13714, Saudi Arabia"], addrAr: ["9214 طريق الملك خالد الفرعي، حي العاصمة", "الدرعية 13714، المملكة العربية السعودية"],
  phone: "+966 53 054 0231", email: "business@businesspartner.sa", website: "www.businesspartner.sa",
  bank: { beneficiaryAr: "شركة بزنس بارتنر سلوشنز", beneficiaryEn: "Business Partner Solutions Company", bankAr: "مصرف الراجحي", bankEn: "Al Rajhi Bank", iban: "SA53 8000 0511 6080 1622 8498" },
  signer: { nameAr: "باهر بكر علي مقنص", nameEn: "Baher Bakr Ali Magnas", titleAr: "المدير العام", titleEn: "General Manager" },
};
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const WORDS_AR = ["خدمة", "استخراج", "تجديد", "رخصة", "السجل", "التجاري", "المنشأة", "الغرفة", "تعديل", "عقد", "شركة", "الاستثمار", "الأجنبي", "مقر", "بلدي"];
const WORDS_EN = ["service", "issuance", "renewal", "licence", "commercial", "registration", "establishment", "chamber", "amendment", "contract", "company", "investment", "foreign", "premises", "municipal"];
const words = (r, n, list) => Array.from({ length: n }, () => list[Math.floor(r() * list.length)]).join(" ");

function randomOrder(seed) {
  const r = rng(seed);
  const n = 1 + Math.floor(r() * (seed % 7 === 0 ? 24 : 9));
  const items = [];
  for (let i = 0; i < n; i++) {
    const kind = r();
    if (kind < 0.6) {
      const s = catalogue[Math.floor(r() * catalogue.length)];
      items.push({ code: s.code, title: (i18n[s.code] && i18n[s.code].ar) || s.name, titleEn: (i18n[s.code] && i18n[s.code].en) || "", description: s.description, qty: 1 + Math.floor(r() * 3), price: s.price.amount });
    } else {
      const long = kind < 0.8;
      items.push({ code: r() < 0.5 ? `BP-X-${i}` : "", title: words(r, long ? 18 + Math.floor(r() * 30) : 3 + Math.floor(r() * 4), WORDS_AR), titleEn: r() < 0.7 ? words(r, long ? 18 + Math.floor(r() * 30) : 3 + Math.floor(r() * 4), WORDS_EN) : "", description: words(r, 12 + Math.floor(r() * 60), WORDS_AR), qty: 1 + Math.floor(r() * 4), price: 50 + Math.floor(r() * 90000) / 100 });
    }
  }
  if (seed % 5 === 0) items.unshift({ code: "REV-GROWTH", title: "تطوير الأعمال — باقة النمو", titleEn: "Business Development — Growth Package", qty: 3, price: 5000 });
  const lines = items.map((i) => ({ ...i, line: Math.round(i.qty * i.price * 100) / 100 }));
  const net = Math.round(lines.reduce((s, l) => s + l.line, 0) * 100) / 100, vat = Math.round(net * 15) / 100;
  const documents = Array.from({ length: Math.floor(r() * (seed % 3 === 0 ? 14 : 5)) }, () => ({ title: words(r, 2 + Math.floor(r() * 9), WORDS_AR) }));
  const doc = { ...quoteDocSnapshot(lines, { documents }), company: COMPANY };
  const pending = r() < 0.3 ? Array.from({ length: 1 + Math.floor(r() * 3) }, () => ({ title: words(r, 3 + Math.floor(r() * 6), WORDS_AR), reasonAr: "سعرها حسب دراسة حالتك وليس رقماً ثابتاً", reasonEn: "priced after studying the case" })) : [];
  return {
    ref: "BP-R-TEST01", number: "Q-TEST01", clientName: r() < 0.3 ? words(r, 14, WORDS_AR) : "شركة المثال للتجارة", issuedAt: "2026-10-29T10:00:00Z", validityDays: 14, validUntil: "2026-11-12",
    items: lines, net, vat, total: Math.round((net + vat) * 100) / 100, paymentTerms: r() < 0.2 ? words(r, 30, WORDS_AR) : "الدفع مقدماً بعد توقيع العقد",
    notes: r() < 0.3 ? words(r, 40, WORDS_AR) : "", clientNotes: r() < 0.2 ? words(r, 25, WORDS_AR) : "", pending, hasNda: r() < 0.3, doc, bar: false,
  };
}

test("browser: over seeded random orders no sheet passes the footer margin, none is empty or overflows sideways, and the PDF has one page per sheet", { skip: !playwright || !CHROME }, async () => {
  const browser = await playwright.chromium.launch({ executablePath: CHROME });
  const dir = mkdtempSync(path.join(os.tmpdir(), "bp-quote-v3-"));
  const worst = { bottom: 0, seed: 0 };
  try {
    const page = await (await browser.newContext({ viewport: { width: 1200, height: 800 } })).newPage();
    for (let seed = 1; seed <= SEEDS; seed++) {
      const q = randomOrder(seed);
      const html = quoteDocV3(q);
      const f = path.join(dir, `q-${seed}.html`);
      writeFileSync(f, html);
      await page.goto("file://" + f, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      const info = await page.evaluate(() => [...document.querySelectorAll("section.sheet")].map((s, i) => {
        const sr = s.getBoundingClientRect(), bp = s.querySelector(".bp");
        const kids = bp ? [...bp.children] : [];
        const bottom = kids.length ? Math.max(...kids.map((k) => k.getBoundingClientRect().bottom)) - sr.top : 0;
        const foot = (s.querySelector(".ft .m") || {}).textContent || "";
        return { i: i + 1, h: Math.round(sr.height), w: Math.round(sr.width), bottom: Math.round(bottom), kids: kids.length, content: bp ? kids.reduce((t, k) => t + k.getBoundingClientRect().height, 0) : 0, sideways: bp ? bp.scrollWidth - bp.clientWidth : 0, foot: foot.trim() };
      }));
      const n = info.length;
      info.forEach((s) => {
        assert.equal(s.w, 1123, `seed ${seed} page ${s.i}: A4 landscape width`);
        assert.equal(s.h, 794, `seed ${seed} page ${s.i}: A4 landscape height`);
        assert.equal(s.foot, `${s.i} / ${n}`, `seed ${seed}: numbering`);
        assert.ok(s.sideways <= 1, `seed ${seed} page ${s.i}: content overflows sideways by ${s.sideways}`);
        if (s.i > 1 && s.i < n) assert.ok(s.kids > 0 && s.content > 20, `seed ${seed} page ${s.i}: an empty sheet`);
        if (s.bottom > worst.bottom) { worst.bottom = s.bottom; worst.seed = seed; }
        assert.ok(s.bottom <= 652, `seed ${seed} page ${s.i}/${n}: content reaches ${s.bottom}px, past the footer margin of the standard (650px)`);
      });
      await page.emulateMedia({ media: "print" });
      const pdf = path.join(dir, `q-${seed}.pdf`);
      await page.pdf({ path: pdf, preferCSSPageSize: true, printBackground: true });
      const pages = (readFileSync(pdf).toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
      assert.equal(pages, n, `seed ${seed}: PDF has ${pages} pages, the paper has ${n} sheets`);
      await page.emulateMedia({ media: "screen" });
    }
  } finally { await browser.close(); }
  console.log(`# lowest content edge over ${SEEDS} random orders: ${worst.bottom}px (seed ${worst.seed}); the standard allows 650px`);
});

test("browser: on a phone the sheets scale to the screen width (no sideways scroll), and the print button is hidden inside the portal's frame", { skip: !playwright || !CHROME }, async () => {
  const browser = await playwright.chromium.launch({ executablePath: CHROME });
  const dir = mkdtempSync(path.join(os.tmpdir(), "bp-quote-v3-m-"));
  try {
    const q = randomOrder(3);
    const f = path.join(dir, "q.html");
    writeFileSync(f, quoteDocV3({ ...q, bar: true }));
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto("file://" + f, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const m = await page.evaluate(() => ({ docW: document.documentElement.scrollWidth, win: window.innerWidth, sheetW: document.querySelector("section.sheet").getBoundingClientRect().width, bar: getComputedStyle(document.querySelector(".bpd-bar")).display }));
    assert.ok(m.docW <= m.win + 1, `sideways scroll on a phone: ${m.docW} > ${m.win}`);
    assert.ok(m.sheetW <= m.win - 16 + 1 && m.sheetW > 250, `the sheet is scaled to the screen: ${m.sheetW}px in ${m.win}px`);
    assert.notEqual(m.bar, "none", "the print button is visible when the paper is opened on its own");
    await page.setContent(`<iframe id="x" srcdoc="" style="width:800px;height:600px"></iframe>`);
    await page.evaluate((h) => { document.getElementById("x").srcdoc = h; }, readFileSync(f, "utf8"));
    await page.waitForTimeout(600);
    const inFrame = await page.frames()[1].evaluate(() => getComputedStyle(document.querySelector(".bpd-bar")).display);
    assert.equal(inFrame, "none", "inside the portal's own frame the portal's button prints, not a second one");
  } finally { await browser.close(); }
});
