// Inputs for the "v1 templates never change" guard (tests/bp-docs-v1-frozen.test.mjs).
// The hashes in v1-docs-hashes.json were taken from api/_docusign.js BEFORE the v2
// templates existed. A contract that is signed is hashed (SHA-256) and later rebuilt
// for comparison; one changed byte in the old template would flag it needs_resign.
export const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
export const SIG = { name: "أحمد العميل", email: "a@x.test", at: "2026-10-21T10:30:00.000Z", contract_sha256: "0123456789abcdef0123456789abcdef", image: PNG, mode: "portal-esign" };
const lines = [
  { name: "تسجيل علامة تجارية", nameEn: "Trademark registration", qty: 1, price: 1200, line: 1200 },
  { name: "رخصة بلدية", nameEn: "Municipal licence", qty: 2, price: 450, line: 900 },
  { name: "بند بلا اسم إنجليزي", qty: 3, price: 99.5 },
];
const base = { ref: "BP-R-TEST01", clientName: "شركة الاختبار <&> المحدودة", clientCr: "1010123456", clientVat: "300000000000003", service: "خدمة اختبار", lines, net: 2399.5, vat: 359.93, total: 2759.43, vatRate: 15, today: "21 أكتوبر 2026", leadTime: "10 أيام عمل", executor: "شريك معتمد" };
export const CONTRACT_CASES = {
  "contract-ar": { ...base },
  "contract-en": { ...base, lang: "en" },
  "contract-fr": { ...base, lang: "fr" },
  "contract-zh": { ...base, lang: "zh" },
  "contract-nolines": { ...base, lines: [] },
  "contract-sub": { ...base, subscription: { renewsAt: 800, commissionPercent: 5 } },
  "contract-sub-nopct": { ...base, subscription: { renewsAt: 800 }, lang: "en" },
  "contract-portal": { ...base, mode: "portal" },
  "contract-portal-signed": { ...base, mode: "portal", signature: SIG, signedAt: SIG.at, lang: "en" },
  "contract-portal-stale": { ...base, mode: "portal", stale: true },
};
export const QUOTE_CASES = {
  "quote-ar": { ref: "BP-R-TEST01", number: "Q-TEST01", clientName: "شركة الاختبار", items: [{ code: "BP-CHAMBER-01", title: "عضوية الغرفة التجارية", titleEn: "Chamber of Commerce membership", description: "وصف", qty: 1, price: 300, line: 300 }], net: 300, vat: 45, total: 345, validUntil: "2026-11-04", paymentTerms: "الدفع مقدماً", notes: "ملاحظة", today: "21 أكتوبر 2026" },
  "quote-en": { ref: "BP-R-TEST01", number: "Q-TEST01", clientName: "Test Co", clientCr: "1010", clientVat: "3000", items: [{ title: "بند", qty: 2, price: 10 }], net: 20, vat: 3, total: 23, lang: "en", today: "21 October 2026" },
  "quote-zh": { ref: "BP-R-TEST02", number: "Q-TEST02", clientName: "测试", items: [], net: 0, vat: 0, total: 0, lang: "zh" },
};
