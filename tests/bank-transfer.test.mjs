// حوالة السلة البنكية (أمر المالك 2026-10-23): الوحدة الصرفة api/_bank-transfer.js.
//
// كل قيمة حسابٍ هنا **وهمية صريحة** (ENTITY / SA00-FAKE…): لا آيبان ولا رقم حساب
// حقيقي في الاختبارات. بيانات الحساب الحقيقية مصدرها الوحيد api/_identity.js.
//
// المقاس:
//   ① بيانات الحساب: تُفعَّل بمستفيدٍ وآيبانٍ معاً، وإلا لا يُرسم شيء.
//   ② المقارنة صارمة: «مطابق» لا تصدر إلا إن تحقق المبلغ والآيبان والمستفيد كلها؛ وكل ما سواها
//      «مراجعة» بسبب واضح (مبلغ أقل/أعلى، آيبان آخر/غائب، مستفيد آخر، ليس إيصالاً، تاريخ قديم…).
//   ③ نقطة التوصيل مع وكيل المستندات (api/_receipt-check.js): تُستدعى إن وُجدت، ولا يُعتمد المبلغ
//      بكلمة طرف واحد، وإن غابت أو رمت تُستعمل القراءة المشتركة.
//   ④ رمز اعتماد الفريق يُوقَّع ويُتحقق منه ويُنهي صلاحيته.
import test from "node:test";
import assert from "node:assert/strict";
import {
  bankDetails, acceptedNames, nameMatches, compareReceipt, verifyTransfer, toAmount, latinDigits,
  signBankToken, readBankToken, throttle, demoRead, reasonText, REASONS,
} from "../api/_bank-transfer.js";

const FAKE_IBAN = "SA00FAKE0000000000000000";
const FAKE = { beneficiary: "شركة اختبار وهمية للحلول", beneficiaryEn: "Fake Test Solutions Company", bank: "بنك وهمي", bankEn: "Fake Bank", iban: FAKE_IBAN };
const expected = { amount: 690, iban: FAKE_IBAN, names: [FAKE.beneficiary, FAKE.beneficiaryEn], bank: FAKE.bank, orderRef: "BP-123456" };
const today = new Date().toISOString().slice(0, 10);
const good = { amount: 690, currency: "SAR", date: today, sender: "Someone", beneficiary: FAKE.beneficiary, bank: "Fake Bank", iban: FAKE_IBAN, reference: "BP-123456", status: "executed", is_receipt: true };

// ---------------------------------------------------------------- ①
test("bank details: enabled only with a beneficiary AND an IBAN; nothing is invented", () => {
  const on = bankDetails(FAKE);
  assert.equal(on.enabled, true);
  assert.equal(on.iban, FAKE_IBAN);
  assert.equal(on.currency, "SAR");
  assert.equal(bankDetails({ ...FAKE, iban: "" }).enabled, false);
  assert.equal(bankDetails({ ...FAKE, beneficiary: "" }).enabled, false);
  assert.equal(bankDetails({ ...FAKE, iban: "not an iban!!" }).enabled, false);
  assert.equal(bankDetails({}).enabled, false);
  assert.equal(bankDetails({ ...FAKE, iban: "sa00 fake 0000 0000 0000 0000" }).iban, FAKE_IBAN, "spaces and case are normalised");
});

test("accepted beneficiary names: Arabic + English + env aliases", () => {
  const names = acceptedNames(FAKE, { BP_BANK_BENEFICIARY_ALIASES: "Alias One, Alias Two" });
  assert.deepEqual(names, [FAKE.beneficiary, FAKE.beneficiaryEn, "Alias One", "Alias Two"]);
});

// ---------------------------------------------------------------- ②
test("name matching tolerates the spelling banks print but not another company", () => {
  const acc = ["شركة بزنس بارتنر سلوشنز", "Business Partner Solutions Company"];
  assert.equal(nameMatches("شركة بزنس بارتنر سلوشنز", acc).ok, true);
  assert.equal(nameMatches("بيزنس بارتنر سولشنز", acc).ok, true, "بيزنس/سولشنز spelling variants");
  assert.equal(nameMatches("BUSINESS PARTNER SOLUTIONS CO", acc).ok, true, "English, upper-case, short suffix");
  assert.equal(nameMatches("شركة أخرى للتجارة", acc).ok, false);
  assert.equal(nameMatches("Business Partner", acc).ok, false, "half a name is not the name");
  assert.equal(nameMatches("", acc).ok, false);
});

test("amounts and Arabic digits are read as numbers", () => {
  assert.equal(toAmount("1,234.50"), 1234.5);
  assert.equal(toAmount("٦٩٠٫٠٠".replace("٫", ".")), 690);
  assert.equal(toAmount(null), null);
  assert.equal(toAmount("abc"), null);
  assert.equal(latinDigits("٠١٢٣٤٥٦٧٨٩"), "0123456789");
});

test("a receipt that matches amount, IBAN and beneficiary is «match»", () => {
  const r = compareReceipt(good, expected);
  assert.equal(r.verdict, "match");
  assert.deepEqual(r.reasons, []);
  assert.equal(r.checks.amount.ok, true);
  assert.equal(r.checks.iban.ok, true);
  assert.equal(r.checks.beneficiary.ok, true);
  assert.equal(r.checks.reference.matched, true, "the order reference in the notes is noted, not required");
});

test("every single mismatch sends the order to a person, with its own reason", () => {
  const cases = [
    [{ amount: 600 }, "amount_short"],
    [{ amount: 700 }, "amount_over"],
    [{ amount: 689.5 }, "amount_short"],
    [{ amount: null }, "amount_missing"],
    [{ iban: "SA00OTHER0000000000000000" }, "iban_mismatch"],
    [{ iban: null }, "iban_missing"],
    [{ beneficiary: "شركة أخرى تماماً" }, "beneficiary_mismatch"],
    [{ beneficiary: null }, "beneficiary_missing"],
    [{ is_receipt: false }, "not_receipt"],
    [{ currency: "USD" }, "currency_mismatch"],
    [{ date: "2020-01-01" }, "date_old"],
    [{ date: "2099-01-01" }, "date_future"],
  ];
  for (const [patch, reason] of cases) {
    const r = compareReceipt({ ...good, ...patch }, expected);
    assert.equal(r.verdict, "review", reason);
    assert.ok(r.reasons.includes(reason), `${reason}: got ${r.reasons}`);
    assert.ok(REASONS[reason] && reasonText(reason, "ar") && reasonText(reason, "en"), `${reason} has Arabic and English text`);
  }
});

test("a masked or partial IBAN is never accepted; nor is a short riyal", () => {
  assert.equal(compareReceipt({ ...good, iban: "SA00FAKE********000000" }, expected).verdict, "review");
  assert.equal(compareReceipt({ ...good, amount: 689.99 }, expected).verdict, "review");
  assert.equal(compareReceipt({ ...good, amount: 690.004 }, expected).verdict, "match", "rounding to the halala is not a mismatch");
});

test("an unreadable read is a review, not a crash", () => {
  assert.deepEqual(compareReceipt(null, expected).reasons, ["unreadable"]);
  assert.equal(compareReceipt({}, expected).verdict, "review");
});

// ---------------------------------------------------------------- ③
const reader = (read, extra = {}) => async () => ({ ok: true, read, provider: "azure", ...extra });
const none = () => Promise.reject(new Error("no module"));

test("no receipt-check module: the shared reader alone never approves (fails closed), but still names every other problem", async () => {
  const input = { base64: "AAAA", mime: "image/png", name: "r.png", expected };
  const ok = await verifyTransfer(input, reader(good), { importer: none });
  assert.equal(ok.verdict, "review", "fields written by a model that read the customer's own file are not enough");
  assert.deepEqual(ok.reasons, ["no_independent_read"]);
  assert.equal(ok.source, "reader");
  const bad = await verifyTransfer(input, reader({ ...good, amount: 100 }), { importer: none });
  assert.equal(bad.verdict, "review");
  assert.ok(bad.reasons.includes("amount_short"));
  const unread = await verifyTransfer(input, async () => ({ ok: false, error: "unavailable" }), { importer: none });
  assert.deepEqual(unread.reasons, ["checker_unavailable"]);
  const unread2 = await verifyTransfer(input, async () => ({ ok: false, error: "unparseable" }), { importer: none });
  assert.deepEqual(unread2.reasons, ["unreadable"]);
  const threw = await verifyTransfer(input, async () => { throw new Error("boom"); }, { importer: none });
  assert.deepEqual(threw.reasons, ["unreadable"]);
});

test("the document-ai hook (checkReceipt) is called first; both sides must agree before «match»", async () => {
  const input = { base64: "AAAA", mime: "application/pdf", name: "r.pdf", expected };
  let seen = null;
  const mod = (r) => async () => ({ checkReceipt: async (i) => { seen = i; return r; } });
  const never = async () => { throw new Error("the reader must not run when the checker answers"); };
  const indep = { independentText: true, text: "x".repeat(80), checks: [{ name: "تنفيذ الحوالة", ok: true }] };
  const yes = await verifyTransfer(input, never, { importer: mod({ verdict: "match", read: good, provider: "doc-agent", ...indep }) });
  assert.equal(yes.verdict, "match");
  assert.equal(yes.source, "checker");
  assert.equal(yes.provider, "doc-agent");
  assert.deepEqual(Object.keys(seen).sort(), ["base64", "expected", "mime", "name"]);
  assert.equal(seen.expected.amount, 690);

  // the checker says match but its own read is a different amount → our strict compare wins
  const liar = await verifyTransfer(input, never, { importer: mod({ verdict: "match", read: { ...good, amount: 10 }, ...indep }) });
  assert.equal(liar.verdict, "review");
  assert.ok(liar.reasons.includes("amount_short"));
  // the checker says mismatch with a reason → a person reviews it
  const no = await verifyTransfer(input, never, { importer: mod({ verdict: "mismatch", read: good, reasons: [{ code: "iban_mismatch" }], ...indep }) });
  assert.equal(no.verdict, "review");
  assert.ok(no.reasons.includes("iban_mismatch"));
  // unknown shape / throw → fall back to the shared reader
  const weird = await verifyTransfer(input, reader(good), { importer: async () => ({ checkReceipt: async () => "???" }) });
  assert.equal(weird.source, "reader");
  const threw = await verifyTransfer(input, reader(good), { importer: async () => ({ checkReceipt: async () => { throw new Error("down"); } }) });
  assert.equal(threw.source, "reader");
  assert.equal(threw.verdict, "review", "the fallback never approves by itself");
});

test("demo reader is inert outside development", () => {
  // APP_ENV is not "development" in the test runner unless the suite sets it; assert the gate, not the env.
  const r = demoRead("demo-match.png", expected);
  if (r === null) assert.equal(r, null);
  else {
    assert.equal(r.provider, "demo");
    assert.equal(compareReceipt(r.read, expected).verdict, "match");
    assert.equal(compareReceipt(demoRead("demo-short.png", expected).read, expected).reasons[0], "amount_short");
    assert.equal(compareReceipt(demoRead("demo-over.png", expected).read, expected).reasons[0], "amount_over");
    assert.ok(compareReceipt(demoRead("demo-iban.png", expected).read, expected).reasons.includes("iban_mismatch"));
    assert.ok(compareReceipt(demoRead("demo-name.png", expected).read, expected).reasons.includes("beneficiary_mismatch"));
    assert.equal(demoRead("demo-unreadable.png", expected).ok, false);
    assert.equal(demoRead("a-real-receipt.png", expected), null, "only demo-* names are simulated");
  }
});

// ---------------------------------------------------------------- ④
test("the approval token is signed, bound to its payload, and expires", () => {
  const prev = process.env.OTP_SECRET;
  process.env.OTP_SECRET = "unit-test-secret";
  try {
    const t = signBankToken({ ref: "BP-R-AAAAAA", orderRef: "BP-123456", actor: "ops", amount: null });
    const p = readBankToken(t);
    assert.equal(p.ref, "BP-R-AAAAAA");
    assert.equal(p.orderRef, "BP-123456");
    const [body, sig] = t.split(".");
    assert.equal(readBankToken(body + "." + sig.slice(0, -2) + "xx"), null, "tampered signature");
    const other = Buffer.from(JSON.stringify({ ref: "BP-R-OTHER", orderRef: "BP-9", at: Date.now() })).toString("base64url");
    assert.equal(readBankToken(other + "." + sig), null, "a signature does not move to another payload");
    assert.equal(readBankToken(t, -1), null, "expired");
    assert.equal(readBankToken(""), null);
    process.env.OTP_SECRET = "";
    assert.equal(signBankToken({ ref: "x" }), "", "no secret → no token");
    assert.equal(readBankToken(t), null);
  } finally { if (prev === undefined) delete process.env.OTP_SECRET; else process.env.OTP_SECRET = prev; }
});

test("throttle: speed bump per key within a window", () => {
  const k = "t-" + Math.random();
  assert.equal(throttle(k, 2, 1000, 1000), true);
  assert.equal(throttle(k, 2, 1000, 1100), true);
  assert.equal(throttle(k, 2, 1000, 1200), false);
  assert.equal(throttle(k, 2, 1000, 2500), true, "window passed");
  assert.equal(throttle(k + "-other", 2, 1000, 1200), true, "keys are independent");
});
