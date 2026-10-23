// Inputs for the "v2 template never changes" guard (tests/bp-docs-v2-frozen.test.mjs).
// Every input is literal — including the company snapshot — so the output depends on the
// template alone, not on site.json, the environment, the clock or the catalogue.
// The hashes in v2-docs-hashes.json were taken from the v2 generator the day it was frozen.
export const COMPANY = {
  nameAr: "شركة بزنس بارتنر سلوشنز", nameEn: "Business Partner Solutions Company", unified: "7038825860", vat: "312079341500003",
  cr: "", crDate: "", shortAddress: "RDAA9214", cityEn: "Ad Diriyah", cityAr: "الدرعية",
  addressAr: "مبنى 9214 · طريق الملك خالد الفرعي · حي العاصمة · الدرعية 13714 · الرقم الفرعي 5076",
  addressEn: "Building 9214 · King Khaled Branch Rd. · Al Asemah Dist. · Ad Diriyah 13714 · Additional no. 5076",
  phone: "+966 53 054 0231", email: "business@businesspartner.sa", website: "www.businesspartner.sa",
  hoursAr: "الأحد – الخميس · 9 صباحاً – 6 مساءً", hoursEn: "Sun–Thu · 9 AM – 6 PM",
  signer: { nameAr: "باهر بكر علي مقنص", nameEn: "Baher Bakr Ali Magnas", titleAr: "المدير العام", titleEn: "General Manager" },
};
export const COMPANY_WITH_CR = { ...COMPANY, cr: "1009014355", crDate: "16/04/2024" };

export const ITEMS = [
  { code: "BP-SBC-01", title: "تأسيس شركة سعودية", titleEn: "Saudi Company Formation", description: "نجهّز الملف ونتابع الطلب حتى صدور القرار.", qty: 1, price: 7500, line: 7500 },
  { code: "BP-SBC-04", title: "إصدار سجل تجاري", titleEn: "Commercial Registration Issuance", description: "", qty: 2, price: 450, line: 900 },
  { code: "BP-CHAMBER-01", title: "عضوية الغرفة التجارية", titleEn: "Chamber of Commerce membership", qty: 1, price: 300, line: 300 },
  { title: "بند بلا كود ولا اسم إنجليزي <&>", qty: 3, price: 99.5 },
];
export const TOTALS = { net: 8999.5, vat: 1349.93, total: 10349.43 };
const MANY = Array.from({ length: 30 }, (_, i) => ({ code: `BP-X-${String(i).padStart(2, "0")}`, title: `خدمة رقم ${i + 1}`, titleEn: `Service no. ${i + 1}`, description: "وصف طويل نسبياً للبند. ".repeat(5), qty: 1 + (i % 3), price: 100 + i, line: (100 + i) * (1 + (i % 3)) }));
const mnet = MANY.reduce((a, b) => a + b.line, 0);
const MANY_T = { net: mnet, vat: Math.round(mnet * 15) / 100, total: Math.round(mnet * 115) / 100 };

const Q = { ref: "BP-R-FRZ001", number: "Q-FRZ001", clientName: "شركة الأفق المتقدم", service: "خدمات تأسيس", serviceEn: "Business setup services", items: ITEMS, ...TOTALS, issuedAt: "2026-10-23T09:00:00Z", validUntil: "2026-11-06", paymentTerms: "الدفع مقدماً بعد توقيع العقد", notes: "ملاحظة للعميل", documents: ["صورة الهوية", { title: "عقد التأسيس" }], company: COMPANY };
const C = { ref: "BP-R-FRZ001", number: "C-FRZ001", clientName: "شركة الأفق المتقدم", clientCr: "1010123456", clientVat: "300000000000003", service: "خدمات تأسيس", serviceEn: "Business setup services", items: ITEMS, ...TOTALS, vatRate: 15, leadTime: "10 أيام عمل", executor: "Business Partner", issuedAt: "2026-10-23T09:00:00Z", company: COMPANY };
const N = { ref: "BP-R-FRZ001", number: "NDA-FRZ001", clientName: "شركة الأفق المتقدم", service: "خدمات تأسيس", serviceEn: "Business setup services", issuedAt: "2026-10-23T09:00:00Z", company: COMPANY };

export const QUOTE_CASES = {
  "quote-default": Q,
  "quote-nobar": { ...Q, bar: false },
  "quote-en": { ...Q, lang: "en" },
  "quote-one-item": { ...Q, items: [ITEMS[0]], net: 7500, vat: 1125, total: 8625, documents: [], notes: "" },
  "quote-many": { ...Q, items: MANY, ...MANY_T },
  "quote-empty": { ...Q, items: [], net: 0, vat: 0, total: 0 },
  "quote-with-cr": { ...Q, company: COMPANY_WITH_CR },
};
export const CONTRACT_CASES = {
  "contract-default": C,
  "contract-en": { ...C, lang: "en" },
  "contract-no-leadtime": { ...C, leadTime: "", executor: "", clientCr: "", clientVat: "" },
  "contract-sub": { ...C, subscription: { renewsAt: 800, commissionPercent: 5 } },
  "contract-sub-nopct": { ...C, subscription: { renewsAt: 800 } },
  "contract-many": { ...C, items: MANY, ...MANY_T },
  "contract-no-date": { ...C, issuedAt: null },
  "contract-with-cr": { ...C, company: COMPANY_WITH_CR },
  "contract-signatory": { ...C, signatory: { name: "خالد العميل", title: "المدير" } },
};
export const NDA_CASES = {
  "nda-default": N,
  "nda-full": { ...N, clientRegNo: "1010123456", clientAddress: "الرياض", clientCountry: "المملكة العربية السعودية", signatory: { name: "خالد العميل", title: "المدير" } },
  "nda-no-service": { ...N, service: "", serviceEn: "" },
  "nda-with-cr": { ...N, company: COMPANY_WITH_CR },
};
export const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
export const SIG = { name: "أحمد العميل", at: "2026-10-23T10:30:00.000Z", contract_sha256: "0123456789abcdef0123456789abcdef", image: PNG };
