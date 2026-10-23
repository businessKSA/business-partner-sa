// مدقّق إيصال الحوالة: كل القيم هنا وهمية صريحة (TEST…). لا آيبان حقيقي في الملف.
import test from "node:test";
import assert from "node:assert/strict";
import {
  verifyTransferReceipt, isSaudiIban, ibanChecksumOk, normalizeIban, maskIban, findIbans,
  receiptFileHash, parseReceiptDate, companyBankFromEnv, RECEIPT_READ_PROMPT,
  AMOUNT_TOLERANCE_SAR, MAX_RECEIPT_AGE_DAYS,
} from "../api/_receipt-check.js";

// آيبان سعودي صحيح الصيغة بقيمة وهمية: يُحسب رقما التحقق برمجياً من جسم يحوي TEST.
function makeIban(body20) {
  const rearr = body20 + "SA00";
  let rem = 0;
  for (const ch of rearr) {
    const part = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of part) rem = (rem * 10 + Number(d)) % 97;
  }
  return "SA" + String(98 - rem).padStart(2, "0") + body20;
}
const COMPANY_IBAN = makeIban("99TEST00000000000001");
const OTHER_IBAN = makeIban("99TEST00000000000002");
const SENDER_IBAN = makeIban("99TEST00000000000003");
const spaced = (iban) => iban.replace(/(.{4})/g, "$1 ").trim();

const NAME_AR = "شركة تست للاختبار المحدودة";
const NAME_EN = "TEST Company For Testing";
const NOW = new Date("2026-10-23T09:00:00Z");

const expected = (over = {}) => ({
  amount: 1150, currency: "SAR", iban: COMPANY_IBAN, beneficiaryName: [NAME_AR, NAME_EN],
  referenceHint: "BP-TEST01", requestRef: "BP-TEST01", ...over,
});

const goodText = (over = {}) => {
  const o = { amount: "1,150.00", date: "2026-10-22 14:05", iban: spaced(COMPANY_IBAN), ben: NAME_AR, ref: "TESTREF0001", status: "تمت العملية بنجاح", ...over };
  return [
    "بنك تست الوطني", "إشعار تحويل", `حالة العملية: ${o.status}`,
    `التاريخ: ${o.date}`, `المبلغ: ${o.amount} SAR`,
    `المستفيد: ${o.ben}`, `آيبان المستفيد: ${o.iban}`,
    `من حساب: ${spaced(SENDER_IBAN)}`, `رقم المرجع: ${o.ref}`, "ملاحظة: BP-TEST01",
  ].join("\n");
};
const run = (text, over = {}, extra = {}) => verifyTransferReceipt({ text, fileHash: "h-" + Math.random(), seen: [], expected: expected(over), now: NOW, ...extra });
const failing = (r) => r.checks.filter((c) => !c.ok && c.severity !== "info").map((c) => c.name);

test("الآيبان الوهمي المُولَّد صحيح الصيغة ومجموعه سليم، وعبثٌ بخانة يُسقطه", () => {
  assert.equal(COMPANY_IBAN.length, 24);
  assert.ok(isSaudiIban(COMPANY_IBAN));
  assert.ok(ibanChecksumOk(COMPANY_IBAN));
  const bad = COMPANY_IBAN.slice(0, 23) + (COMPANY_IBAN.endsWith("1") ? "2" : "1");
  assert.equal(isSaudiIban(bad), false);
});

test("تطبيع الآيبان: مسافات وأحرف صغيرة وأرقام عربية وشرطات", () => {
  const arabic = COMPANY_IBAN.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
  assert.equal(normalizeIban(spaced(COMPANY_IBAN).toLowerCase()), COMPANY_IBAN);
  assert.equal(normalizeIban(arabic), COMPANY_IBAN);
  assert.equal(normalizeIban(COMPANY_IBAN.replace(/(.{4})/g, "$1-")), COMPANY_IBAN);
  assert.ok(findIbans(`حول إلى ${spaced(COMPANY_IBAN)} شكراً`).includes(COMPANY_IBAN));
  assert.match(maskIban(COMPANY_IBAN), /^SA\d{2}…\d{4}$/);
});

test("إيصال صحيح بنص خام: match بكل الفحوص ناجحة", () => {
  const r = run(goodText());
  assert.equal(r.verdict, "match", JSON.stringify(failing(r)));
  assert.deepEqual(r.reasons, []);
  assert.ok(r.checks.every((c) => c.ok || c.severity === "info"));
  assert.equal(r.extracted.amount, 1150);
  assert.match(r.customerMessage, /مطابقة/);
  assert.match(r.teamNote, /كشف الحساب/);
});

test("إيصال صحيح بحقول مقروءة (مخرجات القارئ الآلي) بلا نص: match", () => {
  const r = verifyTransferReceipt({
    fields: { amount: 1150, currency: "SAR", date: "2026-10-22", beneficiary: NAME_EN, iban: COMPANY_IBAN, bank: "TEST Bank", reference: "TESTREF0002", status: "executed", is_receipt: true },
    fileHash: "h1", expected: expected(), now: NOW,
  });
  assert.equal(r.verdict, "match", JSON.stringify(r.checks.filter((c) => !c.ok)));
});

test("المبلغ: داخل التسامح يطابق، وخارجه ناقصاً أو زائداً review بسبب مكتوب", () => {
  assert.equal(AMOUNT_TOLERANCE_SAR, 1);
  assert.equal(run(goodText({ amount: "1,149.20" })).verdict, "match");
  assert.equal(run(goodText({ amount: "1,151.00" })).verdict, "match");
  const less = run(goodText({ amount: "1,000.00" }));
  assert.equal(less.verdict, "review");
  assert.deepEqual(failing(less), ["المبلغ"]);
  assert.match(less.reasons[0], /أقل من المطلوب 1150 بمقدار 150/);
  const more = run(goodText({ amount: "1,300.00" }));
  assert.equal(more.verdict, "review");
  assert.match(more.reasons[0], /أعلى من المطلوب/);
});

test("مستفيد مختلف: review، ولا يصير match ولو طابق الآيبان", () => {
  const r = run(goodText({ ben: "مؤسسة أخرى للمقاولات" }), {}, { fields: { beneficiary: "مؤسسة أخرى للمقاولات" } });
  assert.equal(r.verdict, "review");
  assert.deepEqual(failing(r), ["اسم المستفيد"]);
  assert.match(r.reasons[0], /لا يطابق اسم الشركة/);
});

test("اسم المستفيد: همزات وتشكيل وتطويل وقصّ البنك للاسم لا تُسقط المطابقة", () => {
  assert.equal(run(goodText({ ben: "شَرِكَـة تسـت للإختبار" })).verdict, "match");
  assert.equal(run(goodText({ ben: "TEST COMPANY FOR TESTING LTD" })).verdict, "match");
  // البنك قصّ آخر كلمة من خمس: ٤/٥ = 80% وهو الحد
  assert.equal(run(goodText({ ben: "تست للاختبار" })).verdict, "match");
});

test("آيبان مختلف صحيح الصيغة: reject (حوالة لحساب آخر)", () => {
  const r = run(goodText({ iban: spaced(OTHER_IBAN) }));
  assert.equal(r.verdict, "reject");
  assert.ok(failing(r).includes("آيبان المستفيد"));
  assert.match(r.reasons.join(" "), /لحساب آخر/);
  assert.match(r.customerMessage, /لم نستطع قبول/);
  // بحقل مقروء صريح كذلك
  const r2 = verifyTransferReceipt({ fields: { amount: 1150, currency: "SAR", date: "2026-10-22", beneficiary: NAME_AR, iban: OTHER_IBAN, reference: "TESTREF0003", status: "executed" }, fileHash: "x", expected: expected(), now: NOW });
  assert.equal(r2.verdict, "reject");
});

test("آيبان بصيغة خاطئة أو مجموع تحقق خاطئ: review لا match (خطأ قراءة محتمل)", () => {
  const badSum = COMPANY_IBAN.slice(0, 23) + (COMPANY_IBAN.endsWith("1") ? "2" : "1");
  const r1 = verifyTransferReceipt({ fields: { amount: 1150, currency: "SAR", date: "2026-10-22", beneficiary: NAME_AR, iban: badSum, reference: "TESTREF0004", status: "executed" }, fileHash: "y", expected: expected(), now: NOW });
  assert.equal(r1.verdict, "review");
  assert.match(r1.reasons.join(" "), /مجموع تحققه خاطئ/);
  const r2 = verifyTransferReceipt({ fields: { amount: 1150, currency: "SAR", date: "2026-10-22", beneficiary: NAME_AR, iban: "SA12 3456", reference: "TESTREF0005", status: "executed" }, fileHash: "z", expected: expected(), now: NOW });
  assert.equal(r2.verdict, "review");
  assert.match(r2.reasons.join(" "), /ليس بصيغة آيبان سعودي/);
});

test("آيبان مخفي جزئياً: لا يكفي للتأكيد (review) وإن خالف الظاهر منه فـreject", () => {
  const maskedOk = COMPANY_IBAN.slice(0, 6) + "**************" + COMPANY_IBAN.slice(-4);
  const maskedBad = "SA99" + "**************" + COMPANY_IBAN.slice(-4);
  const base = { amount: 1150, currency: "SAR", date: "2026-10-22", beneficiary: NAME_AR, reference: "TESTREF0006", status: "executed" };
  const a = verifyTransferReceipt({ fields: { ...base, iban: maskedOk }, fileHash: "m1", expected: expected(), now: NOW });
  assert.equal(a.verdict, "review");
  const b = verifyTransferReceipt({ fields: { ...base, iban: maskedBad }, fileHash: "m2", expected: expected(), now: NOW });
  assert.equal(b.verdict, "reject");
});

test("إيصال قديم: reject، وإيصال حدّه الأعلى يمرّ", () => {
  assert.equal(MAX_RECEIPT_AGE_DAYS, 7);
  const old = run(goodText({ date: "2026-09-01 10:00" }));
  assert.equal(old.verdict, "reject");
  assert.match(old.reasons.join(" "), /الإيصال قديم/);
  assert.equal(run(goodText({ date: "2026-10-17 12:00" })).verdict, "match");
  const future = run(goodText({ date: "2026-11-30 12:00" }));
  assert.equal(future.verdict, "review");
  assert.match(future.reasons.join(" "), /المستقبل/);
});

test("تاريخ الإيصال أسبق من تاريخ الطلب: reject", () => {
  const r = run(goodText({ date: "2026-10-20 10:00" }), { notBefore: "2026-10-22T00:00:00Z" });
  assert.equal(r.verdict, "reject");
  assert.match(r.reasons.join(" "), /أسبق من تاريخ الطلب/);
});

test("تواريخ بأرقام عربية وبصيغة يوم/شهر/سنة، والهجري لا يُخمَّن", () => {
  assert.ok(parseReceiptDate("٢٢/١٠/٢٠٢٦").date instanceof Date);
  assert.equal(parseReceiptDate("1448/04/10").hijri, true);
  assert.equal(parseReceiptDate("31/02/2026"), null);
  const r = run(goodText({ date: "1448/04/10" }));
  assert.equal(r.verdict, "review");
  assert.match(r.reasons.join(" "), /هجري/);
  assert.equal(run(goodText({ date: "٢٢-١٠-٢٠٢٦" })).verdict, "match");
});

test("إيصال مكرر: بصمة الملف نفسها أو المرجع نفسه على طلب آخر = reject؛ على الطلب نفسه ليس تكراراً", () => {
  const t = goodText();
  const hash = receiptFileHash(Buffer.from("receipt-bytes-TEST"));
  const dupHash = verifyTransferReceipt({ text: t, fileHash: hash, seen: [{ hash, reference: "OTHER-0001", requestRef: "BP-TEST99" }], expected: expected(), now: NOW });
  assert.equal(dupHash.verdict, "reject");
  assert.match(dupHash.reasons.join(" "), /سبق رفعه على طلب آخر \(BP-TEST99\)/);
  const dupRef = verifyTransferReceipt({ text: t, fileHash: "different-hash", seen: [{ hash: "zzz", reference: "testref-0001", requestRef: "BP-TEST99" }], expected: expected(), now: NOW });
  assert.equal(dupRef.verdict, "reject");
  assert.match(dupRef.reasons.join(" "), /رقم المرجع نفسه/);
  const same = verifyTransferReceipt({ text: t, fileHash: hash, seen: [{ hash, reference: "TESTREF0001", requestRef: "BP-TEST01" }], expected: expected(), now: NOW });
  assert.equal(same.verdict, "match");
  assert.equal(receiptFileHash(Buffer.from("receipt-bytes-TEST")), receiptFileHash("cmVjZWlwdC1ieXRlcy1URVNU"));
  assert.match(hash, /^[0-9a-f]{64}$/);
});

test("بلا بصمة ولا مرجع لا يمكن نفي التكرار: review", () => {
  const t = goodText().replace(/رقم المرجع:.*\n?/, "");
  const r = verifyTransferReceipt({ text: t, seen: [], expected: expected({ referenceHint: "" }), now: NOW });
  assert.equal(r.verdict, "review");
  assert.deepEqual(failing(r), ["عدم تكرار الإيصال"]);
});

test("نص ليس إيصالاً (فاتورة / رسالة عشوائية / فارغ): reject", () => {
  const inv = run("فاتورة ضريبية رقم TEST-1\nالإجمالي 1150 ريال\nشكراً لتعاملكم");
  assert.equal(inv.verdict, "reject");
  assert.ok(failing(inv).includes("إيصال حوالة بنكية"));
  const rand = run("مرحباً، هذه لقطة شاشة لمحادثة عادية بلا أي بيانات بنكية. 1150");
  assert.equal(rand.verdict, "reject");
  const empty = run("");
  assert.equal(empty.verdict, "reject");
  assert.match(empty.reasons.join(" "), /لم يصل أي نص/);
  const flagged = verifyTransferReceipt({ fields: { amount: 1150, is_receipt: false }, fileHash: "q", expected: expected(), now: NOW });
  assert.equal(flagged.verdict, "reject");
});

test("حوالة معلّقة أو مجدولة أو فاشلة لم تدخل الحساب", () => {
  const pending = run(goodText({ status: "مجدولة بانتظار التنفيذ" }));
  assert.equal(pending.verdict, "review");
  assert.match(pending.reasons.join(" "), /معلّقة أو مجدولة/);
  const failed = run(goodText({ status: "فشلت العملية" }));
  assert.equal(failed.verdict, "reject");
  const unknown = run(goodText({ status: "" }));
  assert.equal(unknown.verdict, "review");
  assert.match(unknown.reasons.join(" "), /ما يثبت أن الحوالة نُفِّذت/);
});

test("عملة غير الريال: reject؛ وعملة غير مذكورة: review", () => {
  const usd = verifyTransferReceipt({ fields: { amount: 1150, currency: "USD", date: "2026-10-22", beneficiary: NAME_AR, iban: COMPANY_IBAN, reference: "TESTREF0007", status: "executed" }, fileHash: "u", expected: expected(), now: NOW });
  assert.equal(usd.verdict, "reject");
  const none = verifyTransferReceipt({ fields: { amount: 1150, date: "2026-10-22", beneficiary: NAME_AR, iban: COMPANY_IBAN, reference: "TESTREF0008", status: "executed" }, fileHash: "n", expected: expected(), now: NOW });
  assert.equal(none.verdict, "review");
});

test("إعدادات الشركة تُقرأ من البيئة فقط؛ غيابها review لا match", () => {
  const saved = { a: process.env.COMPANY_IBAN, b: process.env.COMPANY_BENEFICIARY_NAME, c: process.env.BP_BANK_IBAN, d: process.env.BP_BANK_BENEFICIARY };
  try {
    delete process.env.COMPANY_IBAN; delete process.env.COMPANY_BENEFICIARY_NAME; delete process.env.BP_BANK_IBAN; delete process.env.BP_BANK_BENEFICIARY;
    const noCfg = verifyTransferReceipt({ text: goodText(), fileHash: "e1", expected: { amount: 1150, currency: "SAR" }, now: NOW });
    assert.equal(noCfg.verdict, "review");
    assert.ok(failing(noCfg).includes("آيبان الشركة"));
    assert.ok(failing(noCfg).includes("اسم المستفيد"));

    process.env.COMPANY_IBAN = spaced(COMPANY_IBAN).toLowerCase();
    process.env.COMPANY_BENEFICIARY_NAME = `${NAME_AR}|${NAME_EN}`;
    assert.deepEqual(companyBankFromEnv(), { iban: COMPANY_IBAN, names: [NAME_AR, NAME_EN] });
    const fromEnv = verifyTransferReceipt({ text: goodText(), fileHash: "e2", expected: { amount: 1150, currency: "SAR" }, now: NOW });
    assert.equal(fromEnv.verdict, "match", JSON.stringify(failing(fromEnv)));

    process.env.COMPANY_IBAN = "SA00BROKEN";
    const broken = verifyTransferReceipt({ text: goodText(), fileHash: "e3", expected: { amount: 1150, currency: "SAR" }, now: NOW });
    assert.equal(broken.verdict, "review");
    assert.match(broken.reasons.join(" "), /يلزم تصحيحه/);
  } finally {
    for (const [k, v] of [["COMPANY_IBAN", saved.a], ["COMPANY_BENEFICIARY_NAME", saved.b], ["BP_BANK_IBAN", saved.c], ["BP_BANK_BENEFICIARY", saved.d]]) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
});

test("لا يكشف الآيبان كاملاً في تفاصيل الفحوص ولا في النتيجة", () => {
  const r = run(goodText({ iban: spaced(OTHER_IBAN) }));
  const blob = JSON.stringify(r);
  assert.ok(!blob.includes(COMPANY_IBAN));
  assert.ok(!blob.includes(OTHER_IBAN));
});

test("مطالبة القارئ تطلب الآيبان والحالة، ولا تحوي أي آيبان", () => {
  assert.match(RECEIPT_READ_PROMPT, /"iban"/);
  assert.match(RECEIPT_READ_PROMPT, /"status"/);
  assert.ok(!/SA\d{22}/.test(RECEIPT_READ_PROMPT));
});

test("المرجع المقترح معلومة لا حاجز: غيابه لا يمنع match", () => {
  const r = run(goodText().replace("ملاحظة: BP-TEST01", ""));
  assert.equal(r.verdict, "match");
  const hint = r.checks.find((c) => c.name === "رقم الطلب في الحوالة");
  assert.equal(hint.ok, false);
  assert.equal(hint.severity, "info");
});

test("تناقض الحقول المقروءة مع النص الخام: review (حماية من ملف يوجّه النموذج)", () => {
  // النص يقول 100 ريال، والنموذج «قرأ» 1150
  const r = run(goodText({ amount: "100.00" }), {}, { fields: { amount: 1150, currency: "SAR", date: "2026-10-22", beneficiary: NAME_AR, iban: COMPANY_IBAN, reference: "TESTREF0001", status: "executed" } });
  assert.equal(r.verdict, "review");
  assert.ok(failing(r).includes("اتساق القراءة"));
  // آيبان الحقول للشركة لكنه غائب عن النص الذي فيه آيبان آخر
  const r2 = run(goodText({ iban: spaced(OTHER_IBAN) }), {}, { fields: { amount: 1150, currency: "SAR", date: "2026-10-22", beneficiary: NAME_AR, iban: COMPANY_IBAN, reference: "TESTREF0001", status: "executed" } });
  assert.notEqual(r2.verdict, "match");
  assert.ok(failing(r2).includes("اتساق القراءة"));
  // وعند الاتساق يبقى match
  const ok = run(goodText(), {}, { fields: { amount: 1150, currency: "SAR", date: "2026-10-22", beneficiary: NAME_AR, iban: COMPANY_IBAN, reference: "TESTREF0001", status: "executed" } });
  assert.equal(ok.verdict, "match", JSON.stringify(failing(ok)));
});

test("أدوار الآيبان في النص: آيبان بلا دور أو بصفة المرسِل لا يكفي للقبول ولا للرفض الجازم", () => {
  const lines = (benLine) => ["بنك تست", "إشعار تحويل", "حالة العملية: تمت العملية بنجاح", "التاريخ: 2026-10-22 14:05", "المبلغ: 1,150.00 SAR", `المستفيد: ${NAME_AR}`, "-".repeat(50), benLine, "رقم المرجع: TESTREF0009"].join("\n");
  // آيبان الشركة بلا أي عنوان: غامض
  const unknown = run(lines(spaced(COMPANY_IBAN)));
  assert.equal(unknown.verdict, "review");
  assert.match(unknown.reasons.join(" "), /دوره/);
  // آيبان الشركة بصفة المرسِل
  const asSender = run(lines(`من حساب: ${spaced(COMPANY_IBAN)}`));
  assert.equal(asSender.verdict, "review");
  assert.match(asSender.reasons.join(" "), /بصفة المرسِل/);
  // آيبان غريب صحيح بلا عنوان (قد يكون المرسل) ولا آيبان للشركة: review لا reject
  const strangerUnknown = run(lines(spaced(SENDER_IBAN)));
  assert.equal(strangerUnknown.verdict, "review");
  // الآيبان الغريب بصفة المستفيد صراحة: reject
  assert.equal(run(lines(`آيبان المستفيد: ${spaced(SENDER_IBAN)}`)).verdict, "reject");
  // آيبان تالف الخانة مع آيبان مرسل سليم: review (خطأ قراءة) لا «حساب آخر»
  const broken = run(lines(`آيبان المستفيد: ${spaced(COMPANY_IBAN.slice(0, 23) + (COMPANY_IBAN.endsWith("1") ? "2" : "1"))}`) + `\nمن حساب: ${spaced(SENDER_IBAN)}`);
  assert.equal(broken.verdict, "review");
});

test("readDocumentText: بلا مفاتيح Document Intelligence يعود not_configured ولا يتصل بشيء", async () => {
  const keys = ["AZURE_DOCINTEL_ENDPOINT", "AZURE_FORMRECOGNIZER_ENDPOINT", "AZURE_DOCINTEL_KEY", "AZURE_DOCINTEL_API_KEY", "AZURE_FORMRECOGNIZER_KEY"];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("no network in test"); };
  try {
    for (const k of keys) delete process.env[k];
    const { readDocumentText } = await import("../api/_docread.js");
    const b64 = Buffer.from("x").toString("base64");
    assert.deepEqual(await readDocumentText(b64, "application/pdf"), { ok: false, error: "not_configured" });
    assert.equal((await readDocumentText("", "application/pdf")).error, "no_file");
    assert.equal((await readDocumentText(b64, "text/plain")).error, "bad_type");
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = realFetch;
    for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
});
