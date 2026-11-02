// FROZEN — quotation template v3 (api/_bp-docs-v3.js + api/_bp-docs-logo-v3.js).
//
// A quotation is rendered from its stored data every time it is opened, so one changed byte in the template
// changes every v3 quotation ever issued — the paper a client has already approved, printed or forwarded.
// This test pins the two source files and the output of fixed inputs (their own company snapshot and
// service data, independent of site/data), byte for byte.
//
// IF THIS TEST FAILS: do NOT update the fingerprints to make it pass. A change of design, CSS or wording is a
// NEW template — copy api/_bp-docs-v3.js to api/_bp-docs-v4.js, change the copy, register it in
// api/_bp-docs.js (CURRENT_QUOTE_TEMPLATE), and add a frozen test for v4. Quotations stored as v3 keep
// rendering with this file. (A deliberate, pre-release correction of v3 itself — before any v3 quotation has
// reached a client — is the only exception, and it says so in its commit message.)
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
const { quoteDocV3 } = await import("../api/_bp-docs-v3.js");
const sha = (s) => createHash("sha256").update(s).digest("hex");
const read = (rel) => readFileSync(new URL(rel, import.meta.url));

const COMPANY = {
  nameAr: "شركة بزنس بارتنر سلوشنز", nameEn: "Business Partner Solutions Company", unified: "7038825860", vat: "312079341500003", shortAddress: "RDAA9214",
  addrEn: ["9214 King Khaled Branch Road, Al Asemah Dist.", "Ad Diriyah 13714, Saudi Arabia"], addrAr: ["9214 طريق الملك خالد الفرعي، حي العاصمة", "الدرعية 13714، المملكة العربية السعودية"],
  phone: "+966 53 054 0231", email: "business@businesspartner.sa", website: "www.businesspartner.sa",
  bank: { beneficiaryAr: "شركة بزنس بارتنر سلوشنز", beneficiaryEn: "Business Partner Solutions Company", bankAr: "مصرف الراجحي", bankEn: "Al Rajhi Bank", iban: "SA53 8000 0511 6080 1622 8498" },
  signer: { nameAr: "باهر بكر علي مقنص", nameEn: "Baher Bakr Ali Magnas", titleAr: "المدير العام", titleEn: "General Manager" },
};
const SERVICES = {
  "BP-ABSHER-01": { featuresAr: ["تفعيل حساب أبشر أعمال", "تحديد المستخدم المفوض"], featuresEn: ["Activating the Absher Business account", "Assigning the authorized user"], durationAr: "يوم عمل واحد عادةً", durationEn: "Usually one business day" },
  "BP-BALADY-01": { featuresAr: ["مراجعة اشتراطات الموقع والنشاط"], featuresEn: ["Reviewing site and activity requirements"], durationAr: "", durationEn: "" },
};
const DOCS = [{ ar: "السجل التجاري", en: "Commercial Registration" }, { ar: "هوية المفوض", en: "Authorized person's ID" }];
const REV = {
  selected: "REV-GROWTH",
  packages: [
    { code: "REV-LAUNCH", key: "LAUNCH", en: "Launch", ar: "الانطلاق", monthly: 2500, projectEn: "Up to 500,000", projectAr: "حتى 500,000", leads: 4, vendors: 4, meetings: 4, features: [1, 1, 0, 1, 0, 0, 0, 1, 1] },
    { code: "REV-GROWTH", key: "GROWTH", en: "Growth", ar: "النمو", monthly: 5000, projectEn: "1,000,000 to 5,000,000", projectAr: "من 1,000,000 إلى 5,000,000", leads: 8, vendors: 8, meetings: 8, features: [1, 1, 1, 1, 1, 0, 0, 1, 1] },
    { code: "REV-PRO", key: "PRO", en: "Pro", ar: "الاحترافية", monthly: 9500, projectEn: "5,000,000 to 10,000,000", projectAr: "من 5,000,000 إلى 10,000,000", leads: 16, vendors: 16, meetings: 16, features: [1, 1, 1, 1, 1, 1, 1, 1, 1] },
  ],
  tiers: [{ en: "Up to 1,000,000", ar: "حتى 1,000,000", handover: "10%", closing: "12.5%" }, { en: "1,000,000 to 5,000,000", ar: "من 1,000,000 إلى 5,000,000", handover: "5%", closing: "7.5%" }, { en: "Above 5,000,000", ar: "أكثر من 5,000,000", handover: "2.5%", closing: "5%" }],
};
const base = { ref: "BP-R-AB12CD", number: "Q-AB12CD", clientName: "شركة المثال للتجارة", issuedAt: "2026-10-29T10:00:00Z", validityDays: 14, validUntil: "2026-11-12", paymentTerms: "الدفع مقدماً بعد توقيع العقد" };
const line = (code, title, titleEn, qty, price) => ({ code, title, titleEn, description: "", qty, price, line: qty * price });
const CASES = {
  "one line": () => { const items = [line("BP-ABSHER-01", "تفعيل أبشر أعمال", "Absher Business Setup", 1, 300)]; return { ...base, items, net: 300, vat: 45, total: 345, doc: { company: COMPANY, services: SERVICES, documents: DOCS } }; },
  "three lines, documents, waiting line, notes, NDA": () => {
    const items = [line("BP-ABSHER-01", "تفعيل أبشر أعمال", "Absher Business Setup", 1, 300), line("BP-BALADY-01", "إصدار رخصة بلدية (مقر تجاري)", "Municipal License Issuance", 2, 1000), line("", "بند كتبه الفريق", "", 1, 50.5)];
    return { ...base, items, net: 2350.5, vat: 352.58, total: 2703.08, notes: "ملاحظة من الفريق", clientNotes: "أحتاجها قبل الأحد", hasNda: true,
      pending: [{ title: "الاستقطاب التنفيذي", reasonAr: "سعرها حسب دراسة حالتك", reasonEn: "priced after studying the case" }], doc: { company: COMPANY, services: SERVICES, documents: DOCS } };
  },
  "REV package": () => { const items = [line("REV-GROWTH", "تطوير الأعمال — باقة النمو", "Business Development — Growth Package", 3, 5000)]; return { ...base, items, net: 15000, vat: 2250, total: 17250, doc: { company: COMPANY, rev: REV } }; },
  "addendum": () => { const items = [line("BP-BALADY-01", "إصدار رخصة بلدية (مقر تجاري)", "Municipal License Issuance", 1, 900)]; return { ...base, kind: "addendum", number: "Q-AB12CD-A1", baseNumber: "Q-AB12CD", items, net: 900, vat: 135, total: 1035, doc: { company: COMPANY, services: SERVICES } }; },
  "with print bar": () => { const items = [line("BP-ABSHER-01", "تفعيل أبشر أعمال", "Absher Business Setup", 1, 300)]; return { ...base, items, net: 300, vat: 45, total: 345, doc: { company: COMPANY }, bar: true }; },
};
const FINGERPRINTS = {
  source: { "api/_bp-docs-v3.js": "7cb54f98f6f4ce3e7c094d7fdf99d1e4af34468baccce7a9a7c8446c4fee3491", "api/_bp-docs-logo-v3.js": "2f592dc22921ff6407a9ff6bbbf0f4476a6fd9be6869104f52d8d6c441e09c84" },
  output: { "one line": "969760fd5f9b8b27c45425631d2eee94a841051962b13f553a4ce4a07f12eeb6", "three lines, documents, waiting line, notes, NDA": "277b1c42485c3362f750e10d8bf851324fbb5bd73209bfd20e9c7cf13718b54d", "REV package": "5b964c64fba508659b503893defae5df8ff6228f2db89e8100c362520f4b599b", "addendum": "8c04991bb2f74dbf35a4027b02506727fad538a5a1ebaf60c6759a968cb05545", "with print bar": "8a62198b39f6e3b160955053af815642196d0c2e99727f4bc04d7fa127587cc0" },
};

const WHY = "v3 is FROZEN: a change of design, CSS or wording is a new template (api/_bp-docs-v4.js), never an edit of v3 — see the header of this test. Do not update the fingerprints to make it pass.";
test("v3 source files are byte for byte what they were when the template was frozen", () => {
  for (const [file, want] of Object.entries(FINGERPRINTS.source)) assert.equal(sha(read("../" + file)), want, `${file} changed. ${WHY}`);
});
for (const [name, make] of Object.entries(CASES)) {
  test(`v3 output is byte for byte what it was when frozen: ${name}`, () => {
    const out = quoteDocV3(make());
    assert.equal(sha(out), FINGERPRINTS.output[name], `the paper changed for «${name}». ${WHY}`);
    assert.equal(sha(quoteDocV3(make())), sha(out), "deterministic");
  });
}
