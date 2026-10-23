// Template v2 inside the real flow (api/_simple.js), on a local DB and no network:
//   • a NEW quotation and contract are issued as v2 and the version is stored with them
//   • the contract is rebuilt for comparison with the SAME template and company snapshot, so a
//     signed v2 contract is never flagged "needs_resign" — even if the company's live details change
//   • an EXISTING quotation / contract (no template_version) stays on the old paper, byte for byte,
//     and a signed old contract is not flagged either
//   • a client who reads French or Chinese keeps the old paper; BP_DOCS_TEMPLATE=v1 keeps issuing it
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

process.env.APP_ENV = "development";
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "bp-docs-flow-"));
for (const k of ["RESEND_API_KEY", "RESEND_KEY", "DAFTRA_API_KEY", "WHATSAPP_TOKEN", "SIMPLE_NOTIFY", "BP_DOCS_TEMPLATE", "COMPANY_CR_NUMBER"]) delete process.env[k];

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
globalThis.fetch = async (url) => { throw new Error("a local run must not reach the network: " + url); };

const { handleSimple } = await import("../api/_simple.js");
const { sb, sha256 } = await import("../api/_db.js");
const { contractHtml, quoteHtml } = await import("../api/_docusign.js");
const { createHash } = await import("node:crypto");

const CLIENT = { email: "client@test.local", org: "2fcd5b83-144c-4434-be82-aac28b9e19c6", user: "7b2db20a-2404-41ce-b7af-8db1d3fabc95", token: "tok-client-bpdocs-aaaaaaaa" };
await sb("user_sessions", { method: "POST", prefer: "return=minimal", body: [{ id: crypto.randomUUID(), token_hash: sha256(CLIENT.token), user_id: CLIENT.user, organization_id: CLIENT.org, expires_at: new Date(Date.now() + 864e5).toISOString(), revoked_at: null }] });

async function call(action, body = {}) {
  const out = { status: 200, body: null };
  const isOps = action.startsWith("ops-");
  const res = { statusCode: 200, setHeader() {}, end(b) { out.status = this.statusCode; try { out.body = JSON.parse(b); } catch { out.body = b; } } };
  await handleSimple({ method: "POST", headers: { cookie: isOps ? "" : `bp_sid=${CLIENT.token}` }, socket: {}, query: {}, body: { action, ...(isOps ? { key: "test-ops" } : {}), ...body } }, res);
  return out;
}
const rowOf = async (ref) => (await sb(`requests?ref=eq.${ref}&select=*`))[0];
async function newRequest(extra = {}) {
  const r = await call("request-create", { type: "GOVERNMENT_SERVICE", title: "اختبار القوالب", phone: "0501234567", name: "عميل تجريبي", scope: [{ code: "BP-SBC-01", title: "خدمة ثابتة", qty: 1 }], ...extra });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  return r.body.ref;
}
const issue = async (ref) => {
  assert.equal((await call("ops-quote", { ref, items: [{ code: "BP-SBC-01", title: "تأسيس شركة سعودية", price: 7500, qty: 1 }, { title: "بند إضافي", price: 100, qty: 2 }] })).body.ok, true);
  assert.equal((await call("quote-approve", { ref })).body.ok, true);
};

test("a new quotation is v2: stored with the version, and quote-view serves the new paper", async () => {
  const ref = await newRequest();
  await call("ops-quote", { ref, items: [{ code: "BP-SBC-01", title: "تأسيس شركة سعودية", price: 7500, qty: 1 }, { title: "بند إضافي", price: 100, qty: 2 }] });
  const row = await rowOf(ref);
  assert.equal(row.quote.template_version, "v2");
  const v = await call("quote-view", { ref });
  assert.equal(v.body.ok, true);
  assert.match(v.body.html, /data-bp-doc="v2" data-kind="quote"/);
  assert.ok(v.body.html.includes("BP-SBC-01") && v.body.html.includes("7,500.00") && v.body.html.includes("200.00"), "schedule from the quote lines");
  assert.ok(v.body.html.includes("Schedule of items and prices"));
  assert.ok(v.body.html.includes(`${(7700 * 1.15).toLocaleString("en-US", { minimumFractionDigits: 2 })}`), "total incl. 15% VAT");
});

test("a new contract is v2, signs, and is never flagged needs_resign — even if the company's live details change", async () => {
  const ref = await newRequest();
  await issue(ref);
  const row = await rowOf(ref);
  assert.equal(row.contract.template_version, "v2");
  assert.equal(row.contract.build.template_version, "v2");
  assert.ok(row.contract.build.company && row.contract.build.company.unified, "company snapshot stored with the paper");
  assert.match(row.contract.html, /data-bp-doc="v2" data-kind="contract"/);
  assert.ok(row.contract.html.includes("/sig1/") && row.contract.html.includes("/sig2/"), "the stored (hashed) paper keeps the anchors");
  assert.ok(!row.contract.html.includes('class="bpd-bar"'), "no screen chrome in what is hashed");

  const v0 = await call("contract-view", { ref });
  assert.equal(v0.body.needsResign, false);
  assert.ok(v0.body.html.includes('class="bpd-bar"') && !v0.body.html.includes("/sig1/"), "a person reads it without anchors, with the print button");
  const s = await call("contract-sign", { ref, consent: true, name: "عميل تجريبي" });
  assert.equal(s.body.ok, true);
  const signed = await rowOf(ref);
  const hash = createHash("sha256").update(signed.contract.html).digest("hex");
  assert.equal(signed.contract.signature.contract_sha256, hash, "the fingerprint is of the stored v2 paper");

  // rebuild happens on every view; the company's live details changing later must not matter
  const prev = process.env.COMPANY_CR_NUMBER;
  process.env.COMPANY_CR_NUMBER = "1234567890";
  try {
    const v1 = await call("contract-view", { ref });
    assert.equal(v1.body.needsResign, false, "a signed v2 contract is stable");
    assert.ok(v1.body.html.includes("عميل تجريبي"), "the signature shows");
    const again = await rowOf(ref);
    assert.equal(again.contract.html, signed.contract.html);
    assert.equal(again.contract.html_signed, undefined);
  } finally { if (prev === undefined) delete process.env.COMPANY_CR_NUMBER; else process.env.COMPANY_CR_NUMBER = prev; }
});

test("an unsigned v2 contract follows a corrected quotation (rebuild keeps the template)", async () => {
  const ref = await newRequest();
  await issue(ref);
  const row = await rowOf(ref);
  const items = row.quote.items.map((l, i) => (i === 1 ? { ...l, price: 150, line: 300 } : l));
  await sb(`requests?id=eq.${row.id}`, { method: "PATCH", body: { quote: { ...row.quote, items, net: 7800, vat: 1170, total: 8970 } } });
  const v = await call("contract-view", { ref });
  assert.equal(v.body.needsResign, false, "not signed, so nothing to re-sign");
  const after = await rowOf(ref);
  assert.match(after.contract.html, /data-bp-doc="v2"/);
  assert.ok(after.contract.html.includes("300.00") && after.contract.html.includes("8,970.00"));
});

test("an EXISTING quotation and contract (no template_version) stay on the old paper, byte for byte", async () => {
  const ref = await newRequest();
  await issue(ref);
  const row = await rowOf(ref);
  // turn it into what was stored before v2 existed: no version anywhere, built by the old template
  const { template_version: _q, ...oldQuote } = row.quote;
  const at = new Date(row.contract.created_at);
  const today = at.toLocaleDateString("ar-SA-u-nu-latin", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Riyadh" });
  const html = contractHtml({
    ref, clientName: row.contract.build.party, service: row.title,
    lines: oldQuote.items.map((l) => ({ name: l.title, nameEn: l.titleEn, qty: l.qty, price: l.price, line: l.line })),
    net: oldQuote.net, vat: oldQuote.vat, total: oldQuote.total, vatRate: 15, leadTime: "", executor: "Business Partner", today, lang: "ar",
  });
  const { template_version: _c, ...oldContract } = row.contract;
  const { template_version: _b, company: _co, ...oldBuild } = row.contract.build;
  await sb(`requests?id=eq.${row.id}`, { method: "PATCH", body: { quote: oldQuote, contract: { ...oldContract, html, build: oldBuild } } });

  const qv = await call("quote-view", { ref });
  assert.ok(!qv.body.html.includes("data-bp-doc"), "old quotation view is the old paper");
  const expectedQuote = quoteHtml({ ref, number: oldQuote.number, clientName: oldBuild.party, items: oldQuote.items, net: oldQuote.net, vat: oldQuote.vat, total: oldQuote.total, validUntil: oldQuote.valid_until || "", paymentTerms: oldQuote.payment_terms || "", notes: oldQuote.notes || "", lang: "ar", today: new Date(oldQuote.created_at).toLocaleDateString("ar-SA-u-nu-latin", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Riyadh" }) });
  assert.equal(qv.body.html, expectedQuote, "byte for byte");

  // unsigned old contract: rebuilt with the old template, identical
  const v = await call("contract-view", { ref });
  assert.ok(!v.body.html.includes("data-bp-doc"));
  assert.equal(v.body.needsResign, false);
  assert.equal((await rowOf(ref)).contract.html, html, "stored paper untouched");

  // signed old contract: still not flagged, and still the old paper
  assert.equal((await call("contract-sign", { ref, consent: true, name: "ع" })).body.ok, true);
  const v2 = await call("contract-view", { ref });
  assert.equal(v2.body.needsResign, false, "a signed old contract is not flagged by the new templates");
  const after = await rowOf(ref);
  assert.equal(after.contract.html, html);
  assert.equal(after.contract.html_signed, undefined);
  assert.ok(!after.contract.html.includes("data-bp-doc"));
});

test("a reissued contract keeps the version of the paper it replaces", async () => {
  const ref = await newRequest();
  await issue(ref);
  const r = await call("ops-contract-reissue", { ref });
  assert.equal(r.body.ok, true);
  assert.equal((await rowOf(ref)).contract.template_version, "v2");
  // …and an old (v1) one reissues as v1
  const row = await rowOf(ref);
  const { template_version: _c, ...oc } = row.contract;
  const { template_version: _b, company: _co, ...ob } = row.contract.build;
  await sb(`requests?id=eq.${row.id}`, { method: "PATCH", body: { contract: { ...oc, build: ob } } });
  assert.equal((await call("ops-contract-reissue", { ref })).body.ok, true);
  const re = await rowOf(ref);
  assert.equal(re.contract.template_version, undefined);
  assert.ok(!re.contract.html.includes("data-bp-doc"));
});

test("French and Chinese clients keep the old (multi-language) paper; BP_DOCS_TEMPLATE=v1 switches new documents back", async () => {
  const fr = await newRequest({ lang: "fr" });
  await issue(fr);
  const rf = await rowOf(fr);
  assert.equal(rf.quote.template_version, "v1");
  assert.ok(!rf.contract.html.includes("data-bp-doc") && rf.contract.template_version === undefined);

  process.env.BP_DOCS_TEMPLATE = "v1";
  try {
    const ar = await newRequest();
    await issue(ar);
    const ra = await rowOf(ar);
    assert.equal(ra.quote.template_version, "v1");
    assert.ok(!ra.contract.html.includes("data-bp-doc"));
  } finally { delete process.env.BP_DOCS_TEMPLATE; }
});
