// رحلة العميل من «إنشاء عرض سعر» إلى الفاتورة بلا موافقة المالك، وإلغاؤه واختفاؤه.
// (api/_simple.js — على قاعدة محلية مؤقتة وبلا شبكة؛ يُقاس على handleSimple الحقيقي.)
//
// الشكوى (المالك باهر، 2026-10-23، حرفياً): «العميل لما يضغط على إنشاء عرض سعر يدخل على لوحة
// العميل، ولما يدخل يسوي موافق على العرض ما يتولد بشكل مباشر العرض، ويطلب مني كمالك أني أسوي
// توليد لعرض السعر … إذا وافق على عرض السعر يطلع له العقد مباشرة، وبعدها الدفع مباشرة،
// والفاتورة مباشرة … والعميل يقدر يلغي وتنمسح والمفروض ما تظهر».
//
// السبب الجذري الذي أُعيد إنتاجه في المتصفح: صفحة المحادثة تُضيف إلى النطاق سطرَي بذرة
// («فحص المشكلة أو المعاملة»…) بلا علامة seed، فيراها الخادم «بنداً بلا سعر» ويوقف العرض
// ويفتح مهمة تسعير للمالك — حتى لو كانت الخدمة المختارة نفسها مسعّرة في الكتالوج.
//
// ما يُثبته هذا الملف:
//   ١) طلب عرض السعر ← عرض فوراً ← اعتماد ← عقد فوراً ← توقيع ← دفع ← فاتورة، بلا أي حدث بشري.
//   ٢) بندٌ بلا سعر نهائي في الكتالوج لا يُخترع له سعر: يذهب إلى الفريق وسببه مكتوب بجانبه
//      ويراه العميل، وإصدار الفريق للعرض يُكمل الرحلة نفسها.
//   ٣) العقد المعتمد بلا عقد (فشل أو طلب قديم) يصدر وحده، مرةً واحدة.
//   ٤) إلغاء العميل لطلبٍ لا توقيع عليه ولا دفع يخفيه من كل ما يقرؤه ويُبقي الصف للمالك في «المحذوفة»؛
//      وما عليه توقيع أو دفع لا يختفي ولا يُمسّ.
//   ٥) لا تجاوز للإذن: طلب غيرك، لوحة العمليات بلا مفتاح، دور المبيعات، وتخطّي مراحل الرحلة.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DBDIR = fs.mkdtempSync(path.join(os.tmpdir(), "bp-quote-flow-auto-"));
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const future = new Date(Date.now() + 864e5).toISOString();
const now = new Date().toISOString();
const TOK = { a: "tok-a-flow", np: "tok-np-flow", b: "tok-b-flow", sales: "tok-sales-flow", owner: "tok-owner-flow" };
const EMAIL = { a: "ahmed.client@example.com", np: "sara.client@example.com", b: "other.client@example.com", sales: "sales.member@example.com" };

fs.writeFileSync(path.join(DBDIR, "db.json"), JSON.stringify({
  users: [
    { id: "u-a", email: EMAIL.a, full_name: "أحمد العميل", phone: "+966501234567", locale: "ar" },
    { id: "u-np", email: EMAIL.np, full_name: "سارة الحربي", locale: "ar" },          // بلا جوال
    { id: "u-b", email: EMAIL.b, full_name: "خالد آخر", phone: "+966507654321", locale: "ar" },
    { id: "u-sales", email: EMAIL.sales, full_name: "عضو المبيعات", locale: "ar" },
  ],
  organizations: [
    { id: "org-a", name_ar: "شركة أحمد", created_at: now }, { id: "org-np", name_ar: "شركة سارة", created_at: now },
    { id: "org-b", name_ar: "شركة خالد", created_at: now }, { id: "org-sales", name_ar: "المبيعات", created_at: now },
  ],
  user_sessions: [
    { id: "s-a", user_id: "u-a", organization_id: "org-a", token_hash: sha(TOK.a), revoked_at: null, expires_at: future },
    { id: "s-np", user_id: "u-np", organization_id: "org-np", token_hash: sha(TOK.np), revoked_at: null, expires_at: future },
    { id: "s-b", user_id: "u-b", organization_id: "org-b", token_hash: sha(TOK.b), revoked_at: null, expires_at: future },
    { id: "s-sales", user_id: "u-sales", organization_id: "org-sales", token_hash: sha(TOK.sales), revoked_at: null, expires_at: future },
  ],
  requests: [], request_events: [], tasks: [],
}, null, 2));

process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = DBDIR;
process.env.SIMPLE_TEST_MODE = "1";
process.env.EMAIL_MODE = "preview";
process.env.WHATSAPP_MODE = "mock";
for (const k of ["RESEND_API_KEY", "RESEND_KEY", "DAFTRA_API_KEY", "WHATSAPP_TOKEN", "SIMPLE_NOTIFY", "SIMPLE_AUTO_QUOTE"]) delete process.env[k];
process.env.SALES_TEAM_EMAILS = EMAIL.sales;
globalThis.fetch = async (u) => { throw new Error("no network in tests: " + u); };

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
const { handleSimple } = await import("../api/_simple.js");
const { sb } = await import("../api/_db.js");
const { clientDocuments } = await import("../api/_quotes.js");

async function call(action, body = {}, who = "a", { key } = {}) {
  const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(s) { this.body = s; } };
  const cookie = who ? `bp_sid=${TOK[who]}` : "";
  await handleSimple({ method: "POST", body: { action, ...(key ? { key } : {}), ...body }, query: {}, headers: { cookie, "user-agent": "test" }, socket: {} }, res);
  return { http: res.statusCode, ...JSON.parse(res.body || "{}") };
}
const ops = (action, body = {}) => call(action, body, null, { key: "test-ops" });
const rowOf = async (ref) => (await sb(`requests?ref=eq.${encodeURIComponent(ref)}&select=*&limit=1`))[0];
const eventsOf = async (ref) => sb(`request_events?request_id=eq.${(await rowOf(ref)).id}&select=event,actor_kind,details`);
const FIXED = { code: "BP-SBC-01", title: "خدمة ثابتة", qty: 1 };           // «One Time» 7500
const SEED = [{ code: "", title: "فحص المشكلة أو المعاملة", qty: 1, seed: true }, { code: "", title: "تحديد الخدمات الحكومية المطلوبة", qty: 1, seed: true }];
async function create(scope, extra = {}, who = "a") {
  const r = await call("request-create", { type: "GOVERNMENT_SERVICE", title: "طلب اختبار", scope, auto_quote: true, ...extra }, who);
  assert.equal(r.ok, true, JSON.stringify(r));
  return r.ref;
}

// ============================================================ ١) الرحلة كاملة ==
test("من «إنشاء عرض سعر» إلى الفاتورة: كل خطوة تنتقل وحدها، والمالك يُبلَّغ فقط", async () => {
  const ref = await create([FIXED, ...SEED]);
  // العرض صدر قبل أن يصل العميل إلى لوحته — لا زرّ «اعتمد النطاق» ولا انتظار للمالك
  let row = await rowOf(ref);
  assert.equal(row.status, "QUOTE_SENT");
  assert.equal(row.quote.status, "SENT");
  assert.equal(row.quote.net, 7500);
  assert.deepEqual(row.quote.items.map((i) => i.title), ["تأسيس شركة سعودية"], "بند واحد باسم الكتالوج، وبنود البذرة لا تُطبع في العرض");
  assert.equal((await call("request-get", { ref })).request.quote.number, row.quote.number, "يظهر للعميل في لوحته");

  // الاعتماد ← العقد فوراً
  const ap = await call("quote-approve", { ref });
  assert.equal(ap.ok, true); assert.equal(ap.status, "CONTRACT_SENT");
  assert.ok(ap.contract.number, "العقد صدر في الردّ نفسه");
  row = await rowOf(ref);
  assert.equal(row.contract.status, "SENT"); assert.ok(row.contract.html.length > 500, "ورقة العقد كاملة");

  // التوقيع ← الدفع مفتوح
  const sg = await call("contract-sign", { ref, consent: true, name: "أحمد العميل" });
  assert.equal(sg.ok, true); assert.equal(sg.status, "SIGNED");
  assert.equal((await rowOf(ref)).payment.status, "PENDING", "الدفع مفتوح مباشرة بعد التوقيع");

  // الدفع ← الفاتورة
  const pay = await call("pay-test", { ref, outcome: "success", provider: "card" });
  assert.equal(pay.ok, true); assert.equal(pay.status, "PAID");
  row = await rowOf(ref);
  assert.equal(row.payment.status, "PAID");
  assert.ok(row.invoice && /^TEST-INV-/.test(row.invoice.number), "الفاتورة صدرت تلقائياً عند الدفع");
  assert.equal(row.invoice.total, 8625);

  // لم يتدخل إنسان في أي خطوة، والمالك أُبلِغ بكل خطوة
  const ev = await eventsOf(ref);
  assert.ok(!ev.some((e) => ["human", "ops"].includes(e.actor_kind)), "لا حدث بشري: " + ev.filter((e) => ["human", "ops"].includes(e.actor_kind)).map((e) => e.event));
  for (const step of ["quote", "contract", "signed", "paid"]) {
    const n = ev.find((e) => e.event === `notify.${step}`);
    assert.ok(n, `إشعار ${step}`);
    assert.ok(n.details.ops_email !== false || n.details.ops_wa !== false, `المالك أُبلِغ بـ ${step}`);
  }
  assert.ok(ev.some((e) => e.event === "quote.auto"), "الحدث يقول إن العرض آلي");
  const tasks = await sb(`tasks?request_id=eq.${row.id}&human_action=eq.true&status=in.(open,in_progress,blocked)&select=source`);
  assert.deepEqual(tasks.map((t) => t.source), [], "لا مهمة بشرية معلّقة تنتظر المالك");
});

test("بلا auto_quote لا يتغيّر شيء: الطلب يبقى NEW كما كان", async () => {
  const r = await call("request-create", { type: "GOVERNMENT_SERVICE", title: "x", scope: [FIXED], name: "أحمد العميل", phone: "0501234567" });
  assert.equal(r.ok, true);
  assert.equal((await rowOf(r.ref)).status, "NEW");
  assert.equal((await rowOf(r.ref)).quote || null, null);
});

test("اسم أو جوال ناقص: يبقى NEW، وما إن يُكمله العميل في لوحته يصدر العرض وحده", async () => {
  const ref = await create([FIXED, ...SEED], {}, "np");
  assert.equal((await rowOf(ref)).status, "NEW", "بلا جوال لا يصدر عرض باسمٍ ناقص");
  const ps = await call("profile-set", { name: "سارة الحربي", phone: "0555555555" }, "np");
  assert.equal(ps.ok, true); assert.equal(ps.quoted, 1);
  const row = await rowOf(ref);
  assert.equal(row.status, "QUOTE_SENT"); assert.equal(row.quote.net, 7500);
  assert.equal(row.client_phone, "+966555555555", "الجوال على الورقة المصدَرة");
});

test("طلبٌ قديم مضى عليه أكثر من يوم لا يُحيى بنموذج الملف الشخصي", async () => {
  const ref = await create([FIXED], {}, "np");     // سارة الآن بلا اسم/جوال على الصف؟ لا — لها جوال بعد الاختبار السابق
  await sb(`requests?ref=eq.${ref}`, { method: "PATCH", body: { status: "NEW", quote: null, created_at: new Date(Date.now() - 3 * 864e5).toISOString() } });
  await sb(`request_events?request_id=eq.${(await rowOf(ref)).id}&event=eq.quote.auto`, { method: "DELETE" });
  const ps = await call("profile-set", { name: "سارة الحربي", phone: "0555555555" }, "np");
  assert.equal(ps.quoted, 0);
  assert.equal((await rowOf(ref)).status, "NEW");
});

// =========================================================== ٢) بند بلا سعر ==
const HOLD_CASES = [
  ["BP-RE-02", "from", "يبدأ من"],
  ["BP-AI-02", "recurring", "اشتراك"],
  ["BP-REC-03", "proposal", "دراسة"],
  ["BP-REC-04", "percent", "نسبة"],
  ["GOV-GEN", "no_price", "لا سعر"],
  ["BP-NO-SUCH", "unknown_code", "غير موجود"],
  ["", "custom", "كتبتَه"],
];
for (const [code, reason, word] of HOLD_CASES) {
  test(`بند «${reason}»: لا سعر يُخترع، والسبب مكتوب بجانب البند ويراه العميل والمالك`, async () => {
    const ref = await create([FIXED, { code, title: "بند يحتاج تسعيراً", qty: 1 }, ...SEED]);
    const row = await rowOf(ref);
    assert.equal(row.status, "REVIEWING", "ينتظر إنساناً");
    assert.equal(row.quote || null, null, "لم يصدر عرض ولا سعر");
    const line = row.scope.find((s) => s.title === "بند يحتاج تسعيراً");
    assert.equal(line.hold.reason, reason);
    assert.ok(line.hold.reason_ar.includes(word), line.hold.reason_ar);
    assert.equal(row.scope.find((s) => s.title === "خدمة ثابتة").hold, undefined, "البند المسعّر لا يُوسَم");
    // العميل يرى البند وسببه (لا الأسعار الداخلية)
    const seen = (await call("request-get", { ref })).request;
    assert.equal(seen.scope.find((s) => s.title === "بند يحتاج تسعيراً").hold.reason, reason);
    assert.ok(seen.events.some((e) => e.event === "quote.pending"), "المرحلة ظاهرة في خطّه الزمني");
    // والمالك: مهمة واحدة بالسبب، وحدث فيه البند
    const tasks = await sb(`tasks?request_id=eq.${row.id}&source=eq.pricing&select=details,status`);
    assert.equal(tasks.length, 1);
    assert.ok(tasks[0].details.includes("بند يحتاج تسعيراً") && tasks[0].details.includes(line.hold.reason_ar), tasks[0].details);
    const pend = (await sb(`request_events?request_id=eq.${row.id}&event=eq.quote.pending&select=details`))[0];
    assert.equal(pend.details.holds[0].reason, reason);
  });
}

test("إصدار الفريق للعرض بعد التسعير يُكمل الرحلة نفسها ويُنهي مهمة التسعير", async () => {
  const ref = await create([{ code: "BP-RE-02", title: "تبدأ من", qty: 1 }]);
  assert.equal((await rowOf(ref)).status, "REVIEWING");
  const q = await ops("ops-quote", { ref, items: [{ code: "BP-RE-02", title: "تبدأ من", qty: 1, price: 950 }] });
  assert.equal(q.ok, true); assert.equal(q.quote.net, 950);
  const row = await rowOf(ref);
  assert.equal(row.status, "QUOTE_SENT");
  assert.ok(!row.scope.some((s) => s.hold), "بعد التسعير لا بند معلّق");
  assert.equal((await sb(`tasks?request_id=eq.${row.id}&source=eq.pricing&select=status`))[0].status, "done");
  const ap = await call("quote-approve", { ref });
  assert.equal(ap.status, "CONTRACT_SENT", "ثم العقد وحده");
});

test("بند البذرة غير الموسوم (سبب العطل) يوقف العرض، والموسوم لا يوقفه؛ وتعديل العميل لنصّ البذرة يجعله بنداً حقيقياً", async () => {
  const unflagged = SEED.map(({ seed, ...x }) => x);
  const stuck = await create([FIXED, ...unflagged]);
  const row = await rowOf(stuck);
  assert.equal(row.status, "REVIEWING", "هذا ما كانت صفحة المحادثة ترسله قبل الإصلاح");
  assert.deepEqual(row.scope.filter((s) => s.hold).map((s) => s.hold.reason), ["custom", "custom"]);
  const fine = await create([FIXED, ...SEED]);
  assert.equal((await rowOf(fine)).status, "QUOTE_SENT");
});

test("بنودٌ كلها بذرة: لا عرض ولا مهمة تسعير — العميل يختار خدمته أولاً", async () => {
  const ref = await create([...SEED]);
  const row = await rowOf(ref);
  assert.equal(row.status, "NEW");
  assert.equal((await sb(`tasks?request_id=eq.${row.id}&source=eq.pricing&select=id`)).length, 0);
});

test("اعتماد النطاق من اللوحة (scope-confirm) يمرّ بالمسار نفسه: يصدر للمسعّر ويُعلَّق مع السبب لغيره", async () => {
  const a = await call("request-create", { type: "GOVERNMENT_SERVICE", title: "x", scope: [FIXED] });
  const c1 = await call("scope-confirm", { ref: a.ref });
  assert.equal(c1.stage, "QUOTE");
  const b = await call("request-create", { type: "GOVERNMENT_SERVICE", title: "x", scope: [FIXED, { code: "BP-AI-02", title: "اشتراك", qty: 1 }] });
  const c2 = await call("scope-confirm", { ref: b.ref });
  assert.equal(c2.stage, "PRICING"); assert.deepEqual(c2.unpriced, ["اشتراك"]); assert.equal(c2.holds[0].reason, "recurring");
});

// ============================================== ٣) العقد لا ينتظر المالك أبداً ==
test("عرضٌ معتمد بلا عقد: يُصدَر العقد عند فتح العميل للطلب، مرةً واحدة حتى مع فتحين متزامنين", async () => {
  const ref = await create([FIXED, ...SEED]);
  const row = await rowOf(ref);
  // الحالة القديمة: اعتُمد العرض يوم كان العقد ينتظر زرّ المالك
  await sb(`requests?id=eq.${row.id}`, { method: "PATCH", body: { status: "QUOTE_APPROVED", quote: { ...row.quote, status: "APPROVED" } } });
  const [x, y] = await Promise.all([call("request-get", { ref }), call("request-get", { ref })]);
  assert.equal(x.ok && y.ok, true);
  const after = await rowOf(ref);
  assert.equal(after.status, "CONTRACT_SENT"); assert.ok(after.contract && after.contract.number);
  const sent = (await eventsOf(ref)).filter((e) => e.event === "contract.sent");
  assert.equal(sent.length, 1, "عقدٌ واحد لا اثنان");
});

test("قائمة العميل (me) والمتابعة الذكية (ops-sweep) تُصدران العقد المعلّق بدل أن تفتحا مهمة «جهّز العقد» للمالك", async () => {
  const mk = async () => {
    const ref = await create([FIXED, ...SEED]);
    const row = await rowOf(ref);
    await sb(`requests?id=eq.${row.id}`, { method: "PATCH", body: { status: "QUOTE_APPROVED", quote: { ...row.quote, status: "APPROVED" }, updated_at: new Date(Date.now() - 5 * 864e5).toISOString() } });
    return ref;
  };
  const r1 = await mk();
  const me = await call("me");
  assert.equal(me.requests.find((r) => r.ref === r1).status, "CONTRACT_SENT");
  const r2 = await mk();
  const sw = await ops("ops-sweep", {});
  assert.equal(sw.ok, true);
  assert.equal((await rowOf(r2)).status, "CONTRACT_SENT");
  const t = await sb(`tasks?request_id=eq.${(await rowOf(r2)).id}&source=eq.sweep-contract&select=id`);
  assert.equal(t.length, 0, "لا مهمة بشرية لخطوة آلية");
});

test("فشل بناء العقد لا يُسقط الاعتماد: يبقى معتمداً وتُفتح مهمة وتُعاد المحاولة وحدها", async () => {
  const ref = await create([FIXED, ...SEED]);
  const row = await rowOf(ref);
  // عرضٌ بلا بنود يُسقط buildContract — الاعتماد نفسه يجب ألا يضيع
  await sb(`requests?id=eq.${row.id}`, { method: "PATCH", body: { quote: { ...row.quote, items: undefined } } });
  const ap = await call("quote-approve", { ref });
  assert.equal(ap.ok, true); assert.equal(ap.contract_pending, true); assert.equal(ap.status, "QUOTE_APPROVED");
  assert.equal((await rowOf(ref)).quote.status, "APPROVED");
  const t = await sb(`tasks?request_id=eq.${row.id}&source=eq.contract.issue&select=status`);
  assert.equal(t.length, 1, "الفريق يُبلَّغ");
  // أُصلح العرض فيُصدر العقد عند أول فتح
  await sb(`requests?id=eq.${row.id}`, { method: "PATCH", body: { quote: { ...(await rowOf(ref)).quote, items: row.quote.items } } });
  const g = await call("request-get", { ref });
  assert.equal(g.request.status, "CONTRACT_SENT");
});

// =================================================== ٤) الإلغاء والاختفاء ==
async function stageRow(status, extra = {}, who = "a") {
  const ref = await create([FIXED, ...SEED], {}, who);
  const row = await rowOf(ref);
  await sb(`requests?id=eq.${row.id}`, { method: "PATCH", body: { status, ...extra } });
  return ref;
}
const mineRefs = async (who = "a") => (await call("me", {}, who)).requests.map((r) => r.ref);

test("العميل يلغي طلباً لا توقيع عليه ولا دفع: يختفي من كل ما يقرؤه، ويبقى الصف للمالك", async () => {
  const quoted = await create([FIXED, ...SEED]);                         // QUOTE_SENT
  const fresh = await call("request-create", { type: "GOVERNMENT_SERVICE", title: "جديد", scope: [FIXED] }); // NEW
  const contractSent = await create([FIXED, ...SEED]);
  await call("quote-approve", { ref: contractSent });                    // CONTRACT_SENT غير موقَّع
  for (const ref of [quoted, fresh.ref, contractSent]) {
    const o = await call("request-cancel", { ref, note: "غيّرت رأيي" });
    assert.equal(o.ok, true, ref); assert.equal(o.cancelled, true); assert.equal(o.hidden, true, "أُخفي: " + ref);
    const row = await rowOf(ref);
    assert.ok(row, "الصف لم يُحذف من القاعدة");
    assert.ok(row.deleted_at, "مُعلَّم للتدقيق");
    assert.equal(row.status, "CANCELLED");
    assert.ok(!(await mineRefs()).includes(ref), "لا يظهر في me");
    assert.ok(!(await call("requests")).requests.some((r) => r.ref === ref), "ولا في requests");
    const g = await call("request-get", { ref });
    assert.equal(g.http, 404); assert.equal(g.error, "not_found");
    const tr = await call("support-track", { ref, email: EMAIL.a });
    assert.equal(tr.found, false, "ولا في تتبّع الدعم");
    assert.equal((await call("quote-view", { ref })).http, 404, "ولا عرضه ولا عقده");
  }
  assert.ok(!(await clientDocuments(EMAIL.a)).quotes.some((q) => q.ref === quoted), "ولا في «عروضي وعقودي»");
  const counts = (await call("me")).counts;
  assert.equal(counts.quotes, (await call("me")).requests.filter((r) => r.status === "QUOTE_SENT").length, "العدّادات لا تعدّه");
});

test("المالك يراه في «المحذوفة» للتدقيق فقط، ولا يزاحم قائمة العمل", async () => {
  const ref = await create([FIXED, ...SEED]);
  await call("request-cancel", { ref, note: "سبب الإلغاء" });
  const list = await ops("ops-deleted");
  assert.equal(list.ok, true);
  const hit = list.deleted.find((r) => r.ref === ref);
  assert.ok(hit, "ظاهر في المحذوفة");
  assert.equal(hit.by, "customer"); assert.equal(hit.note, "سبب الإلغاء"); assert.equal(hit.stage, "QUOTE_SENT");
  assert.equal(hit.signed, false); assert.equal(hit.paid, false);
  assert.ok(!(await ops("ops-requests")).requests.some((r) => r.ref === ref), "ليس في قائمة الطلبات العاملة");
  assert.equal((await ops("ops-request", { ref })).ok, true, "لكن فتحه للتدقيق ممكن");
  const sum = await ops("ops-summary");
  assert.ok(!sum.recent.some((r) => r.ref === ref), "ولا في ملخص اللوحة");
  assert.ok(!(await ops("ops-inbox")).threads.some((t) => t.ref === ref), "ولا في صندوق المحادثات");
});

test("ما عليه عقد موقَّع أو دفعة لا يختفي: العقد الموقَّع يُلغى ويبقى ظاهراً، والمدفوع يُطلَب إلغاؤه من الفريق", async () => {
  // موقَّع بلا دفع: يُلغى فوراً (قرار المالك 2026-10-17) لكنه سجلّ التزام — لا يُخفى
  const signed = await create([FIXED, ...SEED]);
  await call("quote-approve", { ref: signed }); await call("contract-sign", { ref: signed, consent: true, name: "أحمد العميل" });
  const s = await call("request-cancel", { ref: signed });
  assert.equal(s.cancelled, true); assert.equal(s.hidden, false);
  assert.ok(!(await rowOf(signed)).deleted_at);
  assert.ok((await mineRefs()).includes(signed), "ما زال ظاهراً للعميل بحالة ملغي");
  assert.equal((await call("me")).requests.find((r) => r.ref === signed).status, "CANCELLED");
  assert.ok(!(await ops("ops-deleted")).deleted.some((r) => r.ref === signed));

  // مدفوع: لا إلغاء فوري ولا إخفاء
  const paid = await create([FIXED, ...SEED]);
  await call("quote-approve", { ref: paid }); await call("contract-sign", { ref: paid, consent: true, name: "أحمد العميل" });
  await call("pay-test", { ref: paid, outcome: "success", provider: "card" });
  const p = await call("request-cancel", { ref: paid });
  assert.equal(p.requested, true); assert.notEqual(p.cancelled, true);
  const row = await rowOf(paid);
  assert.equal(row.status, "PAID"); assert.ok(!row.deleted_at, "الصف المدفوع لا يُمسّ");
  assert.ok((await mineRefs()).includes(paid));
  assert.ok(!(await ops("ops-deleted")).deleted.some((r) => r.ref === paid));
});

test("إعادة فتح المالك لطلبٍ أُخفي تُعيده إلى العميل", async () => {
  const ref = await create([FIXED, ...SEED]);
  await call("request-cancel", { ref });
  assert.ok(!(await mineRefs()).includes(ref));
  const re = await ops("ops-reopen", { ref });
  assert.equal(re.ok, true);
  const row = await rowOf(ref);
  assert.ok(!row.deleted_at); assert.equal(row.status, "QUOTE_SENT");
  assert.ok((await mineRefs()).includes(ref));
  assert.ok(!(await ops("ops-deleted")).deleted.some((r) => r.ref === ref));
});

test("لا يستطيع العميل كتابة deleted_at ولا إخفاء ما ليس له، وإلغاء المخفيّ لا يعمل", async () => {
  const ref = await create([FIXED, ...SEED]);
  await call("request-message", { ref, content: "مرحبا", deleted_at: now });
  await call("scope-update", { ref, scope: [FIXED], deleted_at: now });
  await call("attachment-add", { ref, name: "x", url: "https://example.com/x", deleted_at: now });
  assert.ok(!(await rowOf(ref)).deleted_at, "الحقل ليس مدخلاً من العميل");
  await call("request-cancel", { ref });
  assert.equal((await call("request-cancel", { ref })).http, 404, "مخفيّ: لا يُلغى ثانيةً ولا يُقرأ");
});

// ====================================================== ٥) لا تجاوز للإذن ==
test("عميلٌ آخر لا يرى طلب غيره ولا يعتمده ولا يوقّعه ولا يدفعه ولا يلغيه", async () => {
  const ref = await create([FIXED, ...SEED]);
  for (const [action, body] of [["request-get", {}], ["quote-approve", {}], ["quote-reject", { note: "x" }], ["contract-sign", { consent: true }], ["checkout-start", {}], ["pay-test", { outcome: "success" }], ["request-cancel", {}], ["scope-confirm", {}], ["request-message", { content: "x" }], ["quote-view", {}]]) {
    const r = await call(action, { ref, ...body }, "b");
    assert.equal(r.http, 404, `${action}: ${JSON.stringify(r)}`);
  }
  const row = await rowOf(ref);
  assert.equal(row.status, "QUOTE_SENT"); assert.ok(!row.deleted_at);
  assert.ok(!(await mineRefs("b")).includes(ref));
  assert.equal((await call("support-track", { ref, email: EMAIL.b }, "b")).found, false);
});

test("بلا جلسة لا شيء: 401، وبلا مفتاح اللوحة لا تُفتح أي ops- ولا «المحذوفة»", async () => {
  const ref = await create([FIXED, ...SEED]);
  for (const action of ["me", "request-get", "quote-approve", "request-cancel", "pay-test"]) assert.equal((await call(action, { ref }, null)).http, 401, action);
  for (const [action, who, key] of [["ops-deleted", null, undefined], ["ops-deleted", "a", undefined], ["ops-deleted", "b", undefined], ["ops-deleted", null, "wrong-key"], ["ops-requests", "a", undefined], ["ops-quote", "a", undefined], ["ops-contract", null, undefined], ["ops-cancel", "a", undefined], ["ops-reopen", "a", undefined]]) {
    const r = await call(action, { ref }, who, { key });
    assert.equal(r.http, 401, `${action} (${who || "anon"}${key ? ", مفتاح خاطئ" : ""})`);
  }
});

test("دور المبيعات لا يبلغ «المحذوفة» ولا يصدر عرضاً ولا يلغي ولا يعيد الفتح", async () => {
  const ref = await create([FIXED, ...SEED]);
  for (const action of ["ops-deleted", "ops-quote", "ops-contract", "ops-cancel", "ops-reopen", "ops-requests-all", "ops-summary"]) {
    const r = await call(action, { ref }, "sales");
    assert.equal(r.http, 403, action); assert.equal(r.error, "forbidden_role");
  }
});

test("لا تخطّي للمراحل: توقيعٌ قبل الاعتماد، دفعٌ قبل التوقيع، واعتمادٌ مرتين، كلها مرفوضة", async () => {
  const ref = await create([FIXED, ...SEED]);
  assert.equal((await call("contract-sign", { ref, consent: true, name: "أحمد" })).http, 409, "لا عقد بعد");
  assert.equal((await call("pay-test", { ref, outcome: "success" })).http, 409, "لا دفع قبل التوقيع");
  assert.equal((await call("checkout-start", { ref })).http, 409);
  assert.equal((await call("quote-approve", { ref })).ok, true);
  assert.equal((await call("quote-approve", { ref })).http, 409, "اعتمادٌ ثانٍ");
  assert.equal((await call("pay-test", { ref, outcome: "success" })).http, 409, "العقد لم يُوقَّع");
  assert.equal((await call("contract-sign", { ref, consent: false, name: "أحمد" })).http, 400, "بلا موافقة صريحة لا توقيع");
  assert.equal((await rowOf(ref)).payment || null, null, "لم يُسجَّل دفع");
  // عرضٌ منتهي الصلاحية لا يُعتمد (القاعدة القائمة تبقى)
  const exp = await create([FIXED, ...SEED]);
  const row = await rowOf(exp);
  await sb(`requests?id=eq.${row.id}`, { method: "PATCH", body: { quote: { ...row.quote, valid_until: "2020-01-01" } } });
  assert.equal((await call("quote-approve", { ref: exp })).error, "quote_expired");
});

test("التسعير الآلي المُطفأ (SIMPLE_AUTO_QUOTE=0) يعيد الطلب إلى اللوحة ولا يصدر شيئاً", async () => {
  // الوحدة تقرأ المتغيّر وقت التحميل، فنفحصه في عمليةٍ جديدة فوق نسخةٍ من القاعدة
  await new Promise((r) => setTimeout(r, 200));
  const DBDIR2 = fs.mkdtempSync(path.join(os.tmpdir(), "bp-quote-flow-auto2-"));
  fs.copyFileSync(path.join(DBDIR, "db.json"), path.join(DBDIR2, "db.json"));
  const { spawnSync } = await import("node:child_process");
  const script = `
    process.env.LOCAL_DB="1";process.env.LOCAL_DB_DIR=${JSON.stringify(DBDIR2)};process.env.SIMPLE_TEST_MODE="1";process.env.SIMPLE_AUTO_QUOTE="0";
    globalThis.fetch=async()=>{throw new Error("no net")};
    const {handleSimple}=await import(${JSON.stringify(new URL("../api/_simple.js", import.meta.url).href)});
    const res={statusCode:0,headers:{},setHeader(){},end(s){this.body=s}};
    await handleSimple({method:"POST",body:{action:"request-create",type:"GOVERNMENT_SERVICE",title:"x",scope:[{code:"BP-SBC-01",title:"ثابتة",qty:1}],auto_quote:true},query:{},headers:{cookie:"bp_sid=${TOK.a}"},socket:{}},res);
    const o=JSON.parse(res.body);console.log(JSON.stringify({ok:o.ok,quote:!!o.quote_issued,status:o.request&&o.request.status}));`;
  const out = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8" });
  const j = JSON.parse(out.stdout.trim().split("\n").pop());
  assert.equal(j.ok, true); assert.equal(j.quote, false); assert.equal(j.status, "REVIEWING");
});

// ====== ٧) نص العميل لا يدخل العرض ولا العقد المؤتمتين (فحص الأمان ٦، 2026-10-23) ==
const PHRASE = "تضمن الشركة استرداد كامل المبلغ";
test("نصّ العميل فوق رمز كتالوج حقيقي لا يصير بنداً في العرض ولا العقد: الاسم والوصف من الكتالوج، ونصّه ملاحظة قصيرة منفصلة", async () => {
  const ref = await create([{ code: "BP-SBC-01", title: PHRASE, why: PHRASE + " " + "ي".repeat(600), qty: 1 }, ...SEED]);
  const row = await rowOf(ref);
  assert.equal(row.status, "QUOTE_SENT");
  const line = row.quote.items[0];
  assert.ok(!line.title.includes("استرداد") && !line.description.includes("استرداد"), "العنوان والوصف من الكتالوج: " + line.title);
  assert.equal(line.price, 7500, "والسعر من الكتالوج");
  assert.ok(row.quote.client_notes.includes(PHRASE), "نصّه محفوظ كملاحظة");
  assert.ok(row.quote.client_notes.length <= 160, "ومحدود الطول: " + row.quote.client_notes.length);
  const view = await call("quote-view", { ref });
  assert.ok(view.html.includes("ملاحظات العميل"), "يُطبع في خانة ملاحظات العميل");
  const ap = await call("quote-approve", { ref });
  assert.equal(ap.ok, true);
  const contract = (await rowOf(ref)).contract.html;
  assert.ok(!contract.includes("استرداد كامل"), "العقد لا يحمل نصّ العميل");
  assert.ok(!contract.includes("ي".repeat(50)), "ولا الوصف الطويل");
});

test("نصّ حرّ بلا رمز (أو برمز مجهول) لا يصل العرض ولا العقد آلياً: بند حرّ بلا سعر يذهب للتسعير البشري", async () => {
  for (const code of ["", "BP-NO-SUCH"]) {
    const ref = await create([FIXED, { code, title: PHRASE, qty: 1 }, ...SEED]);
    const row = await rowOf(ref);
    assert.equal(row.status, "REVIEWING"); assert.equal(row.quote || null, null); assert.equal(row.contract || null, null);
    assert.equal(row.scope.find((x) => x.title === PHRASE).hold.reason, code ? "unknown_code" : "custom");
  }
});

test("العميل لا يفرض سعراً ولا اسماً: حقل price في بنده يُهمل", async () => {
  const ref = await create([{ code: "BP-SBC-01", title: "x", qty: 1, price: 1 }, ...SEED]);
  assert.equal((await rowOf(ref)).quote.net, 7500);
});

// ====== ٨) الإخفاء قبل limit: المخفية لا تأكل الحصة (فحص الأمان ٩) ==
test("مئة طلب مخفيّ أحدث لا تُخرج طلباً ظاهراً من «طلباتي» ولا من قائمة اللوحة", async () => {
  const mk = (i, hidden, ageMs) => ({
    ref: `BP-R-LIM${String(i).padStart(3, "0")}`, type: "CONSULTATION", source: "WEBSITE", status: hidden ? "CANCELLED" : "NEW", lang: "ar", title: hidden ? "مخفي" : "ظاهر-قديم",
    summary: "", conversation: [], scope: [], documents: [], client_name: "أحمد العميل", client_email: EMAIL.b, client_phone: "+966507654321", organization_id: "org-b",
    created_at: new Date(Date.now() - ageMs).toISOString(), updated_at: new Date(Date.now() - ageMs).toISOString(), ...(hidden ? { deleted_at: new Date().toISOString() } : {}),
  });
  const rows = [mk(0, false, 9e8), ...Array.from({ length: 320 }, (_, i) => mk(i + 1, true, 1000 + i))];
  await sb("requests", { method: "POST", prefer: "return=minimal", body: rows });
  const mine = await call("requests", {}, "b");
  assert.ok(mine.requests.some((r) => r.title === "ظاهر-قديم"), "طلب العميل الظاهر لم تأكله المخفيّات");
  assert.ok(!mine.requests.some((r) => r.title === "مخفي"));
  const list = await ops("ops-requests", { q: "ظاهر-قديم" });
  assert.ok(list.requests.some((r) => r.title === "ظاهر-قديم"));
  const all = await ops("ops-requests");
  assert.ok(all.requests.every((r) => r.title !== "مخفي"), "ولا تدخل قائمة العمل");
  assert.ok(all.requests.some((r) => r.title === "ظاهر-قديم"), "والظاهر القديم يدخلها رغم 320 مخفياً أحدث منه");
  const docs = await clientDocuments(EMAIL.b);
  assert.ok(Array.isArray(docs.quotes));
});

// ====== ٩) رفع الإيصال على طلبٍ أُلغي: رسالة مفهومة (فحص الأمان ١١) ==
test("إعادة رفع إيصال بمرجع طلبٍ أُلغي وأُخفي تعطي رسالة عربية مفهومة لا رمزاً وحده", async () => {
  const { bankOrderPrecheck, cartRequestRef } = await import("../api/_simple.js");
  await sb("requests", { method: "POST", prefer: "return=minimal", body: [{
    ref: cartRequestRef("bank_ORD-CLOSED", 0), type: "CONSULTATION", source: "WEBSITE", status: "CANCELLED", lang: "ar", title: "طلب بنكي ملغى",
    summary: "", conversation: [], scope: [], documents: [], client_name: "أحمد العميل", client_email: EMAIL.a, organization_id: "org-a",
    payment: { source: "cart", pay_ref: "bank_ORD-CLOSED", status: "PENDING" }, deleted_at: new Date().toISOString(),
  }] });
  const out = await bankOrderPrecheck({ ref: "ORD-CLOSED", email: EMAIL.a, fp: "any" });
  assert.equal(out.ok, false); assert.equal(out.error, "request_closed"); assert.equal(out.status, 409);
  assert.ok(/أُلغي/.test(out.message) && /راسلنا/.test(out.message), out.message);
});

// ================================================== ٦) الواجهة تُرسل ما يحتاجه الخادم ==
test("صفحة المحادثة تُرسل سطور البذرة موسومة seed، وزرّ «إنشاء عرض سعر» يطلب الإصدار الفوري", () => {
  const home = fs.readFileSync(new URL("../site/scripts/simple-v1.mjs", import.meta.url), "utf8");
  const seedLines = home.split("\n").filter((l) => /TX\.seed\[/.test(l) && /\.map\(function\(x\)\{return \{code:''/.test(l));
  assert.ok(seedLines.length >= 2, "موضعا إضافة البذرة موجودان");
  for (const l of seedLines) assert.ok(l.includes("seed:true"), "سطر البذرة موسوم: " + l.slice(0, 120));
  assert.ok(home.includes("delete state.items[i].seed"), "تعديل العميل لنصّ البذرة يجعله بنداً حقيقياً");
  const flow = fs.readFileSync(new URL("../site/scripts/sv1-quote-auth-flow.mjs", import.meta.url), "utf8");
  assert.ok(flow.includes("action:'request-create',auto_quote:true"), "الزرّ الذي يُنفَّذ فعلاً (المحقون) يطلب الإصدار الفوري");
});
