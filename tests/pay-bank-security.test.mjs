// فحص الأمان على مسار الحوالة البنكية (تقرير مروان QA على integration-1023، بنود ٢ و٣ و٤ و٥ و٧ و١٠–١٢).
//
// كل اختبار هنا يعيد إنتاج عيب من التقرير بالمعالجات الحقيقية (api/pay.js ← api/requests.js ← api/_simple.js)
// على قاعدة JSON مؤقتة، والشبكة مُحاكاة. بيانات الحساب وهمية صريحة. الأسماء demo-* تُحاكي ما يقرؤه
// المستشار (وضع التطوير وحده). الجلسة تُحاكى برأس x-test-user عبر __setSessionForTest.
//
//   ٢  تبديل السلة على المرجع نفسه بعد إيصال ناقص (بصمة السلة تُربط بالصف)
//   ٣  اعتماد آلي على صورة قابلة للتزوير: يفشل مغلقاً (نص مستقل، تاريخ، حالة تنفيذ، مرجع مصرفي، بصمة موحّدة، سقف)
//   ٤  لا فتح طلب بلا جلسة أو ببريد غير بريدها؛ حدّ سرعة على مفتاح لا يزوّره العميل؛ لا طلب يتيم بلا إيصال
//   ٥  السباق: تسوية واحدة وبريد واحد مهما تزامنت الرفعات أو ضغطات «تأكيد الدفع»
//   ٧  urgency بقيم المخطط، وعطل مهمة الفريق لا يعيد 500
//  ١٠  كشف تكرار الإيصال لا يقرأ ٦٠٠ صف (مفتاح مفهرس)
//  ١١  إعادة الرفع على طلب أُلغي تعطي رسالة مفهومة
//  ١٢  toAmount يرفض ما ليس رقماً صرفاً
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-banksec-"));
Object.assign(process.env, {
  LOCAL_DB: "1", LOCAL_DB_DIR: dir, APP_ENV: "development", SIMPLE_TEST_MODE: "1", SIMPLE_OPS_KEY: "test-ops",
  EMAIL_MODE: "preview", WHATSAPP_MODE: "mock", OTP_SECRET: "unit-test-secret-never-used-elsewhere",
  MKT_SITE_BASE: "http://localhost.test", CATALOG_URL: "http://catalog.test/catalog.json",
  BP_BANK_BENEFICIARY: "شركة اختبار وهمية للحلول", BP_BANK_NAME: "بنك وهمي", BP_BANK_IBAN: "SA00FAKE0000000000000000",
});
delete process.env.BANK_AUTO_APPROVE_MAX_SAR;

const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "site/assets/data/catalog.json"), "utf8"));
const mkRes = () => { const r = { statusCode: 200, headers: {}, setHeader(k, v) { r.headers[k] = v; }, end(t) { r.body = t; } }; return r; };
const pay = (await import("../api/pay.js")).default;
const requests = (await import("../api/requests.js")).default;
const simple = await import("../api/_simple.js");
const bt = await import("../api/_bank-transfer.js");
const emp = await import("../api/_emp-pay.js");
const { sb } = await import("../api/_db.js");
const { outboxList } = await import("../api/_mode.js");
const local = await import("../api/_localdb.js");

emp.__setSessionForTest(async (req) => { const u = req.headers && req.headers["x-test-user"]; return u ? { user: { email: String(u) } } : null; });

let ipn = 0;
async function route(handler, method, body, headers = {}) {
  const res = mkRes();
  await handler({ method, body, query: {}, headers: { "x-forwarded-for": "10.2." + Math.floor(++ipn / 250) + "." + (ipn % 250), ...headers }, socket: {}, url: "/api/x" }, res);
  return { status: res.statusCode, json: JSON.parse(res.body || "{}") };
}
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (u.startsWith("http://catalog.test/")) return new Response(JSON.stringify(catalog), { status: 200 });
  if (u === "http://localhost.test/api/requests") { const r = await route(requests, "POST", JSON.parse(opts.body)); return new Response(JSON.stringify(r.json), { status: r.status }); }
  if (u === "http://localhost.test/api/pay") { const r = await route(pay, "POST", JSON.parse(opts.body)); return new Response(JSON.stringify(r.json), { status: r.status }); }
  return new Response("{}", { status: 404 });
};
const realLog = console.log;
console.log = (...a) => { if (!String(a[0]).startsWith("[outbox")) realLog(...a); };
const realErr = console.error;
console.error = () => {};   // the failure-injection tests make the server log on purpose

// ---------------------------------------------------------------- helpers
function crc32(buf) { let c, crc = 0xffffffff; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function pngChunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body)); return Buffer.concat([len, body, crc]); }
// a real, decodable PNG whose pixels depend on `seed`
function realPng(seed = 1) {
  const w = 8, h = 8, raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w * 3; x++) raw[y * (w * 3 + 1) + 1 + x] = (seed * 37 + x * 5 + y * 11) & 255;
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pngChunk("IHDR", ihdr), pngChunk("IDAT", zlib.deflateSync(raw)), pngChunk("IEND", Buffer.alloc(0))]);
}
// a minimal but structurally valid JPEG (SOI, APP0, DQT, SOF0, DHT, SOS + entropy bytes, EOI)
function fakeJpeg(scan = [0x12, 0x34, 0xff, 0x00, 0x56]) {
  const seg = (m, data) => Buffer.concat([Buffer.from([0xff, m]), Buffer.from([(data.length + 2) >> 8, (data.length + 2) & 255]), Buffer.from(data)]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), seg(0xe0, [0x4a, 0x46, 0x49, 0x46, 0]), seg(0xdb, new Array(65).fill(3)), seg(0xc0, [8, 0, 8, 0, 8, 1, 1, 0x11, 0]), seg(0xc4, new Array(20).fill(1)), seg(0xda, [1, 1, 0, 0, 63, 0]), Buffer.from(scan), Buffer.from([0xff, 0xd9])]);
}
const ITEMS = [{ id: "bp-absher-01", qty: 2 }];            // 2 × 300 + 15% = 690.00
const CV10 = [{ id: "CV-10", qty: 1 }];                    // 100 + 15% = 115.00
const BIG = [{ id: "FI-100", qty: 1 }];                    // 30,000 + 15% = 34,500.00
let seq = 5000;
const order = (over = {}) => ({
  ref: "BP-" + (++seq), name: "عميل اختبار", email: `sec${seq}@example.com`, phone: "0500000000",
  items: ITEMS, company: "", surchargeFee: 0, discountCode: "", taxProfile: { kind: "personal" }, ...over,
});
const upload = (o, { name = "demo-match.png", buf = realPng(++seq), mime = "image/png", user = o.email, headers = {} } = {}) =>
  route(pay, "POST", { action: "bank-receipt", lang: "ar", order: o, file: { name, mime, base64: buf.toString("base64") } }, { ...(user ? { "x-test-user": user } : {}), ...headers });
const allRows = async () => (await sb("requests?select=*&limit=5000")) || [];
const orderRows = async (orderRef) => (await allRows()).filter((r) => r.payment && r.payment.order_ref === orderRef);
const tasksOf = async (row) => (await sb(`tasks?request_id=eq.${row.id}&select=source,status,urgency,priority,human_action`)) || [];
const eventsOf = async (row) => (await sb(`request_events?request_id=eq.${row.id}&select=event`)).map((e) => e.event);
const flush = () => new Promise((r) => setTimeout(r, 120));
const opsCall = async (body) => { const res = mkRes(); await simple.handleSimple({ method: "POST", body: { key: "test-ops", ...body }, query: {}, headers: { "user-agent": "sec" }, socket: {} }, res); return { status: res.statusCode, json: JSON.parse(res.body) }; };

// ---------------------------------------------------------------- ٢ cart swap
test("٢ a receipt-bearing row cannot be re-priced: swapping the basket on the same reference and e-mail is refused, never PAID", async () => {
  const big = order({ items: BIG });
  const first = await upload(big, { name: "demo-short.png" });
  assert.equal(first.json.state, "review");
  const [row0] = await orderRows(big.ref);
  assert.equal(row0.payment.expected_total, 34500);
  const swap = { ...big, items: CV10 };
  const second = await upload(swap, { name: "demo-match.png" });
  assert.equal(second.status, 409, JSON.stringify(second.json));
  assert.equal(second.json.error, "cart_changed");
  const rows = await orderRows(big.ref);
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].status, "PAID");
  assert.equal(rows[0].payment.status, "REVIEW");
  assert.equal(rows[0].payment.expected_total, 34500, "the priced total on the row never moved");
  assert.ok(String(rows[0].title + JSON.stringify(rows[0].payment.items)).includes("FI-100") || String(JSON.stringify(rows[0].payment.items)).includes("fi-100") || rows[0].payment.items.length === 1, "items unchanged");
  assert.equal(rows[0].payment.items.reduce((s, i) => s + i.amount, 0), 30000);
});

test("٢ the basket fingerprint covers quantities, surcharge and discount code, not only item ids", async () => {
  const o = order();
  assert.equal((await upload(o, { name: "demo-short.png" })).json.state, "review");
  for (const patch of [{ items: [{ id: "bp-absher-01", qty: 1 }] }, { surchargeFee: 50 }, { discountCode: "SOMECODE" }]) {
    const r = await upload({ ...o, ...patch }, { name: "demo-match.png" });
    assert.equal(r.status, 409, JSON.stringify(patch));
    assert.equal(r.json.error, "cart_changed", JSON.stringify(patch));
  }
  const same = await upload({ ...o }, { name: "demo-match.png" });
  assert.equal(same.json.state, "approved", "the unchanged basket may be re-uploaded and approved");
});

// ---------------------------------------------------------------- ٣ fail closed
test("٣ compareReceipt: no match without a date, with an unreadable or Hijri date, a non-executed status, or no bank reference", () => {
  const expected = { amount: 690, iban: "SA00FAKE0000000000000000", names: ["شركة اختبار وهمية للحلول"], orderRef: "BP-1" };
  const today = new Date().toISOString().slice(0, 10);
  const good = { amount: 690, currency: "SAR", date: today, beneficiary: "شركة اختبار وهمية للحلول", iban: "SA00FAKE0000000000000000", reference: "TRX0099887766", status: "executed", is_receipt: true };
  assert.equal(bt.compareReceipt(good, expected).verdict, "match");
  const cases = [
    [{ date: null }, "date_missing"], [{ date: "" }, "date_missing"], [{ date: "soon-ish" }, "date_unclear"], [{ date: "1447/05/01" }, "date_unclear"],
    [{ status: "pending" }, "not_executed"], [{ status: "failed" }, "not_executed"], [{ status: undefined }, "not_executed"], [{ status: "unknown" }, "not_executed"],
    [{ reference: null }, "reference_missing"], [{ reference: "123" }, "reference_missing"],
  ];
  for (const [patch, reason] of cases) {
    const r = bt.compareReceipt({ ...good, ...patch }, expected);
    assert.equal(r.verdict, "review", reason + JSON.stringify(patch));
    assert.ok(r.reasons.includes(reason), `${reason}: ${r.reasons}`);
    assert.ok(bt.REASONS[reason], `${reason} has a text`);
  }
  assert.equal(bt.compareReceipt({ ...good, status: undefined }, expected, { executedByText: true }).verdict, "match", "the independent text may vouch for execution");
});

test("٣ verifyTransfer fails closed: the checker answering «match» without an independent text read is a review; the shared reader alone never matches", async () => {
  const expected = { amount: 690, iban: "SA00FAKE0000000000000000", names: ["شركة اختبار وهمية للحلول"], orderRef: "BP-1" };
  const today = new Date().toISOString().slice(0, 10);
  const read = { amount: 690, currency: "SAR", date: today, beneficiary: "شركة اختبار وهمية للحلول", iban: "SA00FAKE0000000000000000", reference: "TRX0099887766", status: "executed", is_receipt: true };
  const input = { base64: "AAAA", mime: "image/png", name: "r.png", expected };
  const checker = (extra) => async () => ({ checkReceipt: async () => ({ verdict: "match", read, provider: "doc-agent", checks: [{ name: "تنفيذ الحوالة", ok: true }], ...extra }) });
  const no = await bt.verifyTransfer(input, async () => ({ ok: true, read }), { importer: checker({ independentText: false }) });
  assert.equal(no.verdict, "review");
  assert.ok(no.reasons.includes("no_independent_read"));
  const missing = await bt.verifyTransfer(input, async () => ({ ok: true, read }), { importer: checker({}) });
  assert.equal(missing.verdict, "review", "a checker that does not say it read the text independently is not trusted");
  const yes = await bt.verifyTransfer(input, async () => ({ ok: true, read }), { importer: checker({ independentText: true, text: "x".repeat(80) }) });
  assert.equal(yes.verdict, "match");
  const readerOnly = await bt.verifyTransfer(input, async () => ({ ok: true, read, provider: "azure" }), { importer: async () => { throw new Error("none"); } });
  assert.equal(readerOnly.verdict, "review", "fields written by a model that read an attacker's file are never enough");
  assert.ok(readerOnly.reasons.includes("no_independent_read"));
});

test("٣ the content fingerprint ignores appended bytes and metadata; a different picture differs", () => {
  assert.equal(typeof bt.normalizedFileHash, "function");
  const a = realPng(1);
  const h = bt.normalizedFileHash(a, "image/png");
  assert.equal(bt.normalizedFileHash(Buffer.concat([a, Buffer.from("\0")]), "image/png"), h, "one extra trailing byte");
  assert.equal(bt.normalizedFileHash(Buffer.concat([a, Buffer.from("x".repeat(500))]), "image/png"), h, "a long trailer");
  const withText = Buffer.concat([a.subarray(0, 33), pngChunk("tEXt", Buffer.from("Comment\0hello")), a.subarray(33)]);
  assert.equal(bt.normalizedFileHash(withText, "image/png"), h, "an ancillary text chunk");
  assert.notEqual(bt.normalizedFileHash(realPng(2), "image/png"), h);
  const j = fakeJpeg();
  const jh = bt.normalizedFileHash(j, "image/jpeg");
  const jWithCom = Buffer.concat([j.subarray(0, 2), Buffer.from([0xff, 0xfe, 0x00, 0x06, 0x61, 0x62, 0x63, 0x64]), j.subarray(2)]);
  assert.equal(bt.normalizedFileHash(jWithCom, "image/jpeg"), jh, "a JPEG comment segment");
  assert.equal(bt.normalizedFileHash(Buffer.concat([j, Buffer.from("trailing junk")]), "image/jpeg"), jh, "bytes after EOI");
  assert.notEqual(bt.normalizedFileHash(fakeJpeg([1, 2, 3]), "image/jpeg"), jh);
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
  assert.equal(bt.normalizedFileHash(Buffer.concat([pdf, Buffer.from("incremental update appended\n%%EOF\n")]), "application/pdf"), bt.normalizedFileHash(pdf, "application/pdf"));
  assert.equal(bt.normalizedFileHash(Buffer.from("not an image at all"), "image/png").length, 64, "unparseable input still hashes");
});

test("٣ the same receipt with one extra byte on another order is refused (not auto-approved)", async () => {
  const png = realPng(77);
  const first = await upload(order(), { buf: png });
  assert.equal(first.json.state, "approved");
  const second = order();
  const r = await upload(second, { buf: Buffer.concat([png, Buffer.from("\0")]) });
  assert.equal(r.json.state, "review");
  assert.ok(r.json.reasons.includes("duplicate_receipt"));
  const [row] = await orderRows(second.ref);
  assert.equal(row.status, "PAYMENT_PENDING");
});

test("٣ the bank reference is the duplicate key: a different picture of the same transfer is refused, and a receipt with no reference is never auto-approved", async () => {
  assert.equal(typeof bt.__setCheckerForTest, "function", "tests need a seam to stand in for the document checker");
  const today = new Date().toISOString().slice(0, 10);
  const mk = (ref, o = {}) => async ({ expected }) => ({
    verdict: "match", provider: "stub", independentText: true, text: "تحويل ناجح " + "x".repeat(60) + (o.text || ""),
    checks: [{ name: "تنفيذ الحوالة", ok: true }],
    read: { amount: expected.amount, currency: "SAR", date: today, beneficiary: expected.names[0], iban: expected.iban, reference: ref, status: "executed", is_receipt: true },
  });
  try {
    bt.__setCheckerForTest(mk("TRXAAA111222"));
    const a = await upload(order(), { buf: realPng(901), name: "real-a.png" });
    assert.equal(a.json.state, "approved", JSON.stringify(a.json));
    const o2 = order();
    const b = await upload(o2, { buf: realPng(902), name: "real-b.png" });
    assert.equal(b.json.state, "review");
    assert.ok(b.json.reasons.includes("duplicate_receipt"), "same bank reference, other picture");
    bt.__setCheckerForTest(mk(null));
    const c = await upload(order(), { buf: realPng(903), name: "real-c.png" });
    assert.equal(c.json.state, "review");
    assert.ok(c.json.reasons.includes("reference_missing"));
    // the same independent text on a re-encoded picture is the same document
    bt.__setCheckerForTest(mk("TRXBBB333444", { text: " unique-body-1" }));
    assert.equal((await upload(order(), { buf: realPng(904), name: "real-d.png" })).json.state, "approved");
    bt.__setCheckerForTest(mk("TRXCCC555666", { text: " unique-body-1" }));
    const e = await upload(order(), { buf: realPng(905), name: "real-e.png" });
    assert.ok(e.json.reasons.includes("duplicate_receipt"), "same text fingerprint, other reference and picture");
  } finally { bt.__setCheckerForTest(null); }
});

test("٣ auto-approval stops at BANK_AUTO_APPROVE_MAX_SAR (default 3000): above it the order waits for a person with a clear reason", async () => {
  assert.equal(bt.autoApproveMaxSar({}), 3000);
  assert.equal(bt.autoApproveMaxSar({ BANK_AUTO_APPROVE_MAX_SAR: "800" }), 800);
  assert.equal(bt.autoApproveMaxSar({ BANK_AUTO_APPROVE_MAX_SAR: "garbage" }), 3000);
  assert.equal(bt.autoApproveMaxSar({ BANK_AUTO_APPROVE_MAX_SAR: "-5" }), 3000);
  const big = order({ items: BIG });
  const r = await upload(big, { name: "demo-match.png" });
  assert.equal(r.status, 200);
  assert.equal(r.json.state, "review", "34,500 is above the cap even though every check passed");
  assert.deepEqual(r.json.reasons, ["above_auto_limit"]);
  assert.equal(r.json.autoLimit, 3000);
  const [row] = await orderRows(big.ref);
  assert.equal(row.status, "PAYMENT_PENDING");
  assert.equal(row.payment.receipt.verdict, "review");
  const tasks = await tasksOf(row);
  assert.ok(tasks.some((t) => t.source === "bank-review" && t.human_action));
  assert.ok(bt.reasonText("above_auto_limit", "ar").includes("حدّ"));
  process.env.BANK_AUTO_APPROVE_MAX_SAR = "800";
  try {
    const mid = order({ items: [{ id: "bp-absher-01", qty: 3 }] });            // 1,035
    assert.equal((await upload(mid)).json.state, "review");
    process.env.BANK_AUTO_APPROVE_MAX_SAR = "1035";
    assert.equal((await upload(order({ items: [{ id: "bp-absher-01", qty: 3 }] }))).json.state, "approved", "exactly at the cap is allowed");
  } finally { delete process.env.BANK_AUTO_APPROVE_MAX_SAR; }
  // a person can still approve the large one after checking the bank statement
  const done = await opsCall({ action: "ops-mark-paid", ref: r.json.ref });
  assert.equal(done.status, 200, JSON.stringify(done.json));
  assert.equal((await orderRows(big.ref))[0].status, "PAID");
});

// ---------------------------------------------------------------- ٤ auth, rate limit, no orphan rows
test("٤ no session → 401 and nothing is created; another e-mail's session → 403 and nothing is created", async () => {
  const before = (await allRows()).length;
  const o = order();
  const none = await upload(o, { user: null });
  assert.equal(none.status, 401);
  assert.equal(none.json.error, "login_required");
  const other = await upload(o, { user: "someone.else@example.com" });
  assert.equal(other.status, 403);
  assert.equal(other.json.error, "email_mismatch");
  const caseOnly = await upload(o, { user: o.email.toUpperCase() });
  assert.equal(caseOnly.status, 200, "the same address in another case is the same account");
  assert.equal((await allRows()).length, before + 1, "only the legitimate upload opened an order");
});

test("٤ a victim's e-mail cannot be used to open an order in their account, and the rate limit does not trust x-forwarded-for", async () => {
  const victim = "victim.account@example.com";
  const before = (await orderRows("none")).length;
  let blocked = 0;
  for (let i = 0; i < 6; i++) { const r = await upload(order({ email: victim }), { user: "attacker@example.com", name: "demo-short.png" }); if (r.status === 403) blocked++; }
  assert.equal(blocked, 6);
  assert.equal((await allRows()).filter((r) => String(r.client_email) === victim).length, 0, "nothing appeared in the victim's account");
  assert.equal(before, 0);
  // one signed-in user, a fresh spoofed address on every request
  const me = "heavy.user@example.com";
  let last = null, first429 = -1;
  for (let i = 0; i < 16; i++) {
    last = await upload(order({ email: me }), { user: me, name: "demo-unreadable.png", headers: { "x-forwarded-for": `203.0.113.${i + 1}` } });
    if (last.status === 429 && first429 < 0) first429 = i;
  }
  assert.ok(first429 > 0 && first429 <= 12, `the same account was slowed (first 429 at ${first429})`);
  assert.equal(last.json.error, "slow_down");
});

test("٤ at most a few unverified bank orders may be open at once per account", async () => {
  const me = "quota.user@example.com";
  const results = [];
  for (let i = 0; i < 8; i++) results.push(await upload(order({ email: me }), { user: me, name: "demo-unreadable.png" }));
  const ok = results.filter((r) => r.status === 200).length;
  assert.ok(ok <= 5, `opened ${ok}`);
  assert.ok(results.some((r) => r.json.error === "too_many_open"));
});

test("٤ an upload that fails validation leaves no order behind", async () => {
  const before = (await allRows()).length;
  const bad = [
    [{ name: "x.exe", buf: Buffer.from("MZ....."), mime: "application/x-msdownload" }, "bad_type"],
    [{ name: "fake.png", buf: Buffer.from("this is not a png"), mime: "image/png" }, "bad_type"],
    [{ name: "page.html", buf: Buffer.from("<html></html>"), mime: "text/html" }, "bad_type"],
    [{ name: "big.png", buf: Buffer.concat([realPng(5), Buffer.alloc(9 * 1024 * 1024)]), mime: "image/png" }, "too_large"],
  ];
  for (const [opts, error] of bad) {
    const o = order();
    const r = await upload(o, opts);
    assert.equal(r.json.error, error);
    assert.equal((await orderRows(o.ref)).length, 0, error + ": no pending order without a receipt");
  }
  assert.equal((await allRows()).length, before);
});

test("٤ if storing the receipt fails after the order was opened, the order is withdrawn (not left «بانتظار التحقق» with no receipt)", async () => {
  const o = order();
  const real = simple.__setStoreForTest;
  assert.equal(typeof real, "function", "a seam to fail the storage write");
  simple.__setStoreForTest(async () => { throw new Error("storage down"); });
  try {
    const r = await upload(o);
    assert.notEqual(r.status, 200);
    assert.equal(r.json.ok, false);
    const rows = await orderRows(o.ref);
    assert.ok(rows.every((x) => x.status === "CANCELLED" && x.deleted_at), "no visible pending order without a receipt");
  } finally { simple.__setStoreForTest(null); }
  const again = await upload(o);
  assert.equal(again.json.state, "approved", "the retry works once storage is back");
});

// ---------------------------------------------------------------- ٥ races
const settleMails = async (orderRef) => (await outboxList(500)).filter((m) => String(m.subject || "").includes(orderRef) && /تم الدفع|اعتُمد دفعك|مفعّل تلقائياً/.test(String(m.subject)));
test("٥ six concurrent uploads of one order settle exactly once: one payment event, one start task, one set of mails", async () => {
  const o = order();
  const rs = await Promise.all(Array.from({ length: 6 }, () => upload(o, { buf: realPng(++seq) })));
  assert.ok(rs.every((r) => r.status === 200 || r.status === 409), JSON.stringify(rs.map((r) => r.json.error || r.json.state)));
  const rows = await orderRows(o.ref);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "PAID");
  assert.equal(rows[0].payment.status, "PAID");
  const ev = await eventsOf(rows[0]);
  assert.equal(ev.filter((e) => e === "payment.paid").length, 1, "one payment.paid event");
  const tasks = await tasksOf(rows[0]);
  assert.equal(tasks.filter((t) => t.source === "sweep-start").length, 1);
  assert.equal(tasks.filter((t) => t.source === "bank-reconcile").length, 1);
  await flush();
  const mails = await settleMails(o.ref);
  const subjects = mails.map((m) => m.subject);
  assert.equal(new Set(subjects).size, subjects.length, "no mail was sent twice: " + JSON.stringify(subjects));
  assert.ok(rs.filter((r) => r.json.state === "approved").length >= 1);
});

test("٥ four concurrent «تأكيد الدفع» presses approve once", async () => {
  const o = order();
  const up = await upload(o, { name: "demo-iban.png" });
  assert.equal(up.json.state, "review");
  const rs = await Promise.all(Array.from({ length: 4 }, () => opsCall({ action: "ops-mark-paid", ref: up.json.ref })));
  assert.ok(rs.every((r) => r.status === 200 || r.status === 409), JSON.stringify(rs.map((r) => [r.status, r.json.error])));
  assert.equal(rs.filter((r) => r.status === 200 && !r.json.already).length, 1, "exactly one press did the work: " + JSON.stringify(rs.map((r) => r.json)));
  const [row] = await orderRows(o.ref);
  assert.equal(row.status, "PAID");
  assert.equal((await eventsOf(row)).filter((e) => e === "payment.paid").length, 1);
  assert.equal((await tasksOf(row)).filter((t) => t.source === "sweep-start").length, 1);
  await flush();
  const subjects = (await settleMails(o.ref)).map((m) => m.subject);
  assert.equal(new Set(subjects).size, subjects.length, "no duplicated mail: " + JSON.stringify(subjects));
});

test("٥ a late verdict write cannot downgrade a row that was already settled", async () => {
  const o = order();
  const a = await upload(o, { name: "demo-short.png" });
  const [rowBefore] = await orderRows(o.ref);
  const done = await opsCall({ action: "ops-mark-paid", ref: a.json.ref });
  assert.equal(done.status, 200);
  await simple.bankReceiptVerdict(rowBefore, { auto: false, reasons: ["unreadable"], reasonsAr: ["x"], expected: { amount: 690 } });   // a stale in-flight request
  const [row] = await orderRows(o.ref);
  assert.equal(row.status, "PAID");
  assert.equal(row.payment.status, "PAID", "the stale verdict did not put payment back to REVIEW");
});

// ---------------------------------------------------------------- ٧ urgency + task failure
test("٧ every task the bank flow writes uses an urgency the schema accepts (urgent / soon / normal)", async () => {
  const o1 = order(), o2 = order();
  await upload(o1, { name: "demo-short.png" });
  await upload(o2);
  const ALLOWED = new Set(["urgent", "soon", "normal"]);
  const seen = [];
  for (const o of [o1, o2]) for (const row of await orderRows(o.ref)) for (const t of await tasksOf(row)) { seen.push(t); assert.ok(ALLOWED.has(t.urgency), `${t.source} wrote urgency "${t.urgency}"`); }
  assert.ok(seen.length >= 3);
  assert.ok(seen.some((t) => t.source === "bank-review" && t.urgency === "urgent"));
  assert.ok(seen.some((t) => t.source === "sweep-start"));
  const sweepSrc = fs.readFileSync(path.join(ROOT, "api/_simple.js"), "utf8");
  assert.doesNotMatch(sweepSrc, /urgency: "high", priority: "high",\s*\n\s*human_action/, "the pricing task no longer writes urgency high");
});

// Makes inserts into one local table throw (a frozen array), as a failing check constraint would. localReset()
// starts a clean database and returns the live cache object the engine reads from.
async function breakTable(name) {
  await flush();
  const db = local.localReset();
  Object.defineProperty(db, name, { value: Object.freeze([]), writable: false, configurable: true, enumerable: true });
  return async () => { delete db[name]; };
}
test("٧ when the team task cannot be written the customer still gets the verdict (no 500) and the receipt is kept", async () => {
  const o = order();
  const restore = await breakTable("tasks");
  let r;
  try { r = await upload(o, { name: "demo-short.png" }); } finally { await restore(); }
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.state, "review");
  const [row] = await orderRows(o.ref);
  assert.equal(row.payment.receipt.verdict, "review");
  assert.ok((row.attachments || []).some((a) => a.kind === "receipt"));
});

// ---------------------------------------------------------------- ١٠ indexed duplicate lookup
test("١٠ duplicate detection does not depend on a 600-row window: an old receipt is still found after 700 newer rows", async () => {
  const png = realPng(31337);
  assert.equal((await upload(order(), { buf: png })).json.state, "approved");
  const rows = [];
  for (let i = 0; i < 700; i++) rows.push({ ref: "BP-R-FILL" + String(i).padStart(3, "0"), type: "CONSULTATION", source: "WEBSITE", status: "PAID", lang: "ar", title: "filler " + i, payment: { status: "PAID", provider: "moyasar", amount: 1 }, client_email: "filler@example.com" });
  await sb("requests", { method: "POST", prefer: "return=minimal", body: rows });
  const again = order();
  const r = await upload(again, { buf: Buffer.concat([png, Buffer.from("!")]) });
  assert.equal(r.json.state, "review");
  assert.ok(r.json.reasons.includes("duplicate_receipt"), "found despite 700 newer rows");
});

test("١٠ the duplicate lookup is one indexed query on the fingerprint keys, not a scan of request rows", () => {
  const src = fs.readFileSync(path.join(ROOT, "api/_simple.js"), "utf8");
  const fn = src.slice(src.indexOf("export async function bankReceiptSeen"));
  assert.doesNotMatch(fn.slice(0, 1500), /limit=600|payment=not\.is\.null/);
  assert.match(src, /bank_receipt_keys\?key=in\./);
  const mig = fs.readFileSync(path.join(ROOT, "db/migrations/2026-10-bank-receipt-keys.sql"), "utf8");
  assert.match(mig, /create table if not exists bank_receipt_keys/i);
  assert.match(mig, /key\s+text\s+primary key/i);
});

// ---------------------------------------------------------------- ١١ closed order
test("١١ re-uploading on a cancelled order's reference says so clearly; a fresh reference works", async () => {
  const o = order();
  const a = await upload(o, { name: "demo-short.png" });
  assert.equal(a.json.state, "review");
  await sb(`requests?ref=eq.${a.json.ref}`, { method: "PATCH", body: { status: "CANCELLED" } });
  const r = await upload(o, { name: "demo-match.png" });
  assert.equal(r.status, 409);
  assert.equal(r.json.error, "request_closed");
  const fresh = await upload({ ...o, ref: "BP-" + (++seq) }, { name: "demo-match.png" });
  assert.equal(fresh.json.state, "approved");
});

// ---------------------------------------------------------------- ١٢ toAmount
test("١٢ toAmount reads plain numbers only: «115/5», «1e2», «1 15», «12abc» are refused, not read as 1155 / 12 / 115", () => {
  for (const bad of ["115/5", "1e2", "1 15", "12abc", "1.2.3", "--5", "١١٥/٥", "1,15", "NaN", "Infinity", "0x10", "1_000", "٣٥٠٠٫٥٠٫١"]) assert.equal(bt.toAmount(bad), null, String(bad));
  const good = [["115", 115], ["115.5", 115.5], ["1,234.50", 1234.5], ["١١٥٫٥٠", 115.5], ["690.00", 690], [690, 690], ["SAR 690.00", 690], ["690 ريال", 690], ["  45  ", 45]];
  for (const [v, want] of good) assert.equal(bt.toAmount(v), want, String(v));
  assert.equal(bt.toAmount(null), null);
  assert.equal(bt.toAmount(""), null);
  assert.equal(bt.toAmount(-5), null, "a negative transfer is not a payment");
  assert.equal(bt.toAmount(0), null);
});
