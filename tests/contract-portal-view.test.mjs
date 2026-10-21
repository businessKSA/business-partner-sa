// The contract paper a client reads in the portal must never show DocuSign's
// anchor strings (/sig1/ and /date1/), and once signed it must carry the
// signer's name, date and drawn signature. The version sent to DocuSign must
// keep the anchors (DocuSign places its tabs on them), and the default output
// of contractHtml must not change at all: the portal stores it, hashes it at
// signing and compares a rebuild against it.
import test from "node:test";
import assert from "node:assert/strict";
import { contractHtml, portalContractHtml, quoteHtml } from "../api/_docusign.js";

const base = {
  ref: "BP-R-TEST01", clientName: "شركة الاختبار", service: "خدمة",
  lines: [{ name: "بند", qty: 1, price: 100 }],
  net: 100, vat: 15, total: 115, today: "21 أكتوبر 2026",
};
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const signature = {
  name: "أحمد العميل", email: "a@x.test", at: "2026-10-21T10:30:00.000Z",
  contract_sha256: "0123456789abcdef0123456789abcdef", image: PNG, mode: "portal-esign",
};
const clauseText = (h) => h.slice(0, h.lastIndexOf('<div class="sign">'));

test("default (DocuSign) mode keeps the anchors and is unchanged", () => {
  const d = contractHtml(base);
  assert.equal((d.match(/\/sig1\//g) || []).length, 1);
  assert.equal((d.match(/\/date1\//g) || []).length, 1);
  assert.equal(d, contractHtml({ ...base, mode: "docusign" }));
  // a portal-only argument must not leak into the default output
  assert.equal(d, contractHtml({ ...base, signature, signedAt: signature.at }));
});

test("portal mode, before signing: no anchors, a clear signature box", () => {
  for (const lang of ["ar", "en", "fr", "zh"]) {
    const p = contractHtml({ ...base, lang, mode: "portal" });
    assert.ok(!p.includes("/sig1/") && !p.includes("/date1/"), lang + ": no anchors");
    assert.ok(p.includes("خانة التوقيع"), lang + ": says where to sign");
    assert.ok(!p.includes("<img"), lang + ": no image yet");
  }
});

test("portal mode, after signing: name, date, drawn signature, short fingerprint", () => {
  const p = contractHtml({ ...base, mode: "portal", signature });
  assert.ok(!p.includes("/sig1/") && !p.includes("/date1/"));
  assert.ok(p.includes("أحمد العميل"), "signer name");
  assert.ok(p.includes(`<img src="${PNG}"`), "drawn signature image");
  assert.ok(/21 أكتوبر 2026/.test(p.slice(p.lastIndexOf('<div class="sign">'))), "signing date");
  assert.ok(p.includes("0123456789abcdef") && !p.includes("0123456789abcdef0"), "16-char fingerprint only");
});

test("clauses are identical in every mode", () => {
  const d = clauseText(contractHtml(base));
  assert.equal(d, clauseText(contractHtml({ ...base, mode: "portal" })));
  assert.equal(d, clauseText(contractHtml({ ...base, mode: "portal", signature })));
});

test("bilingual contract: the Client-language column is filled in too", () => {
  const p = contractHtml({ ...base, lang: "en", mode: "portal", signature });
  const sign = p.slice(p.lastIndexOf('<div class="sign">'));
  assert.ok((sign.match(/أحمد العميل/g) || []).length >= 2, "name in both columns");
  assert.equal((sign.match(/<img /g) || []).length, 1, "the drawn image once");
  assert.ok(/Riyadh time/.test(sign));
});

test("a corrected-after-signing paper does not display the old signature", () => {
  const p = contractHtml({ ...base, mode: "portal", signature, stale: true });
  assert.ok(!p.includes("<img") && !p.includes("أحمد العميل"));
  assert.ok(p.includes("يلزم توقيع جديد"));
});

test("portalContractHtml works on stored html and never lets a hostile value through", () => {
  const stored = contractHtml(base);
  const out = portalContractHtml(stored, { signature: { ...signature, name: '<script>alert(1)</script>', image: 'javascript:alert(1)' } });
  assert.ok(!out.includes("<script>") && !out.includes("javascript:"));
  assert.ok(!out.includes("/sig1/"));
  assert.equal(portalContractHtml("<p>no sign block /sig1/</p>"), "<p>no sign block </p>");
});

test("quote paper has no anchors (unchanged)", () => {
  const q = quoteHtml({ ref: "BP-R-1", number: "Q-1", clientName: "ع", items: [{ title: "x", qty: 1, price: 1 }], net: 1, vat: 0.15, total: 1.15 });
  assert.ok(!q.includes("/sig1/") && !q.includes("/date1/"));
});
