// إلغاء الطلب من بوابة العميل /my  (api/_simple.js ← request-cancel، و simple-v1-my.mjs)
//
// شغّله: npm test
//
// الشكوى: «ابغى ألغي طلب ما يلغي». السبب لم يكن زراً مكسوراً بل ثلاثة أشياء:
//   ① كل طلبٍ مرّ بتوقيع العقد (CONTRACT_SENT/SIGNED/PAYMENT_PENDING…) لا يُلغى
//      بل يُسجَّل «طلب إلغاء» — والبوابة لا تقرأه: تعيد الزرّ كما كان وتسمح
//      بتكراره، فيبدو للعميل أن شيئاً لم يحدث (وتتكرر المهمة والبريد للفريق).
//   ② إلغاء الاستشارة لا يُلغي موعدها: تبقى في «المواعيد» وفي العدّاد.
//   ③ نافذة التأكيد window.confirm: إن حُجبت (متصفحٌ مدمج) عادت «لا» دون سؤال.
//
// يُقاس هنا على `handleSimple` الحقيقي فوق قاعدة محلية مؤقّتة، لا على نسخةٍ منه.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import vm from "node:vm";

const DBDIR = fs.mkdtempSync(path.join(os.tmpdir(), "bp-client-cancel-"));
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const future = new Date(Date.now() + 86400000).toISOString();
const SID = { me: "sid-me", other: "sid-other" };
const ME = "me@example.com", OTHER = "other@example.com";
const today = new Date().toISOString().slice(0, 10);
const nextWeek = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);

const req = (ref, status, extra = {}) => ({
  id: "id-" + ref, ref, type: "COMPANY_FORMATION", source: "WEBSITE", status, lang: "ar",
  title: "طلب " + ref, summary: "", conversation: [], scope: [{ title: "بند", qty: 1 }], documents: [],
  client_name: "عميل", client_email: ME, client_phone: "", company_name: "شركة", organization_id: "org-me",
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...extra,
});
const quote = { number: "Q-1", status: "APPROVED", items: [{ title: "بند", qty: 1, price: 1000, line: 1000 }], net: 1000, vat: 150, total: 1150 };
const signed = { number: "C-1", status: "SIGNED", signed_at: new Date().toISOString(), html: "<p>x</p>" };
const unsigned = { number: "C-2", status: "SENT", html: "<p>x</p>" };

fs.writeFileSync(path.join(DBDIR, "db.json"), JSON.stringify({
  users: [
    { id: "u-me", email: ME, full_name: "عميل", locale: "ar" },
    { id: "u-other", email: OTHER, full_name: "آخر", locale: "ar" },
  ],
  organizations: [
    { id: "org-me", name_ar: "شركتي", created_at: new Date().toISOString() },
    { id: "org-other", name_ar: "شركة أخرى", created_at: new Date().toISOString() },
  ],
  user_sessions: [
    { id: "s1", user_id: "u-me", organization_id: "org-me", token_hash: sha(SID.me), revoked_at: null, expires_at: future },
    { id: "s2", user_id: "u-other", organization_id: "org-other", token_hash: sha(SID.other), revoked_at: null, expires_at: future },
  ],
  requests: [
    req("T-NEW", "NEW"),
    req("T-REVIEW", "REVIEWING"),
    req("T-QUOTE", "QUOTE_SENT", { quote: { ...quote, status: "SENT" } }),
    req("T-CONTRACT", "CONTRACT_SENT", { quote, contract: unsigned }),
    req("T-SIGNED", "SIGNED", { quote, contract: signed, payment: { status: "PENDING", amount: 1150 } }),
    req("T-SIGNMONEY", "SIGNED", { quote, contract: signed, payment: { status: "PAID", amount: 1150 } }),
    req("T-PAYPEND", "PAYMENT_PENDING", { quote, contract: signed, payment: { status: "FAILED", amount: 1150, test: true } }),
    req("T-PAYGATE", "PAYMENT_PENDING", { quote, contract: signed }),
    req("T-PAYMONEY", "PAYMENT_PENDING", { quote, contract: signed, payment: { status: "PAID", amount: 1150 } }),
    req("T-PAID", "PAID", { quote, contract: signed, payment: { status: "PAID", amount: 1150 }, invoice: { number: "INV-1", total: 1150 } }),
    req("T-WORK", "IN_PROGRESS", { quote, contract: signed, payment: { status: "PAID", amount: 1150 } }),
    req("T-DONE", "COMPLETED"),
    req("T-GONE", "CANCELLED", { cancel: { at: new Date().toISOString(), by: "customer", stage: "NEW" } }),
    req("T-APPT", "NEW", { type: "CONSULTATION", appointment: { date: nextWeek, time: "10:00", status: "BOOKED", topic: "استشارة" } }),
    req("T-BC", "NEW", { ref: "BC-123456", type: "CONSULTATION", organization_id: null, appointment: { date: nextWeek, time: "11:00", status: "BOOKED" } }),
    req("T-TASKS", "NEW"),
    req("T-RACE", "CANCELLED", { quote, contract: signed, cancel: { at: new Date().toISOString(), by: "customer", stage: "PAYMENT_PENDING" } }),
    req("T-THEIRS", "NEW", { client_email: OTHER, organization_id: "org-other" }),
  ],
  request_events: [],
  tasks: [
    { id: "task-1", organization_id: "org-me", request_id: "id-T-TASKS", title: "راجع الطلب الجديد", source: "sweep-new", status: "open", assignee: "bp", created_at: new Date().toISOString() },
    { id: "task-2", organization_id: "org-me", request_id: "id-T-TASKS", title: "اتصل بالعميل", source: "manual", status: "open", assignee: "bp", created_at: new Date().toISOString() },
  ],
}, null, 2));

// تُضبط قبل الاستيراد: الوحدات تقرأ البيئة وقت التحميل.
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = DBDIR;
process.env.SIMPLE_TEST_MODE = "1";
process.env.EMAIL_MODE = "preview";
process.env.WHATSAPP_MODE = "mock";
// لا شبكة: أي نداء خارجي يفشل فتُسجَّل القناة فاشلة ولا يسقط الإلغاء.
const realFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error("no network in tests"); };

const { handleSimple, cancelPolicy, markRequestPaidByRef } = await import("../api/_simple.js");
const { sb } = await import("../api/_db.js");

async function call(action, body = {}, sid = SID.me) {
  const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(s) { this.body = s; } };
  await handleSimple({ method: "POST", body: { action, ...body }, query: {}, headers: { cookie: sid ? `bp_sid=${sid}` : "", "user-agent": "test" }, socket: {} }, res);
  return { http: res.statusCode, ...JSON.parse(res.body || "{}") };
}
const rowOf = async (ref) => (await sb(`requests?ref=eq.${encodeURIComponent(ref)}&select=*&limit=1`))[0];
const eventsOf = async (ref) => sb(`request_events?request_id=eq.${(await rowOf(ref)).id}&select=event`);

// ----------------------------------------------------------------- السياسة --
test("cancelPolicy: يُلغى فوراً ما لم يُوقَّع ولم يُدفع، وغيره يُطلَب", () => {
  const now = ["NEW", "REVIEWING", "WAITING_CLIENT", "QUOTE_SENT", "QUOTE_APPROVED", "CONTRACT_SENT"];
  for (const s of now) assert.equal(cancelPolicy({ status: s }), "now", s);
  // بدء الدفع بلا دفعةٍ ناجحة (الحالة التي اشتكى منها المالك)
  assert.equal(cancelPolicy({ status: "PAYMENT_PENDING" }), "now");
  assert.equal(cancelPolicy({ status: "PAYMENT_PENDING", payment: { status: "FAILED" } }), "now");
  assert.equal(cancelPolicy({ status: "PAYMENT_PENDING", payment: { status: "CANCELLED" } }), "now");
  assert.equal(cancelPolicy({ status: "PAYMENT_PENDING", payment: { status: "PENDING" } }), "now");
  // الدفعة الناجحة تُقرأ من سجل الطلب لا من اسم الحالة
  assert.equal(cancelPolicy({ status: "PAYMENT_PENDING", payment: { status: "PAID" } }), "ask");
  assert.equal(cancelPolicy({ status: "PAYMENT_PENDING", payment: { status: "captured" } }), "ask");
  assert.equal(cancelPolicy({ status: "PAYMENT_PENDING", invoice: { number: "INV-1" } }), "ask");
  assert.equal(cancelPolicy({ status: "NEW", payment: { status: "PAID" } }), "ask");
  // ما بعد التوقيع والدفع والتنفيذ
  // موقَّع بلا دفعة ولا فاتورة: يُلغى فوراً (قرار المالك 2026-10-17)؛ وموقَّع وفيه دفعة: للفريق
  assert.equal(cancelPolicy({ status: "SIGNED" }), "now");
  assert.equal(cancelPolicy({ status: "SIGNED", payment: { status: "PAID" } }), "ask");
  for (const s of ["PAID", "IN_PROGRESS", "WAITING_INTERNAL"]) assert.equal(cancelPolicy({ status: s }), "ask", s);
  for (const s of ["CANCELLED", "COMPLETED"]) assert.equal(cancelPolicy({ status: s }), "closed", s);
});

// ---------------------------------------------------------- الإلغاء الفوري --
test("NEW/REVIEWING/QUOTE_SENT/CONTRACT_SENT: إلغاء فوري، والطلب يخرج من النشطة", async () => {
  const before = (await call("me")).counts.active;
  let n = 0;
  for (const ref of ["T-NEW", "T-REVIEW", "T-QUOTE", "T-CONTRACT"]) {
    const o = await call("request-cancel", { ref, note: "غيّرت رأيي" });
    assert.equal(o.http, 200, ref);
    assert.equal(o.ok, true); assert.equal(o.cancelled, true); assert.equal(o.status, "CANCELLED");
    const r = await rowOf(ref);
    assert.equal(r.status, "CANCELLED", ref);
    assert.equal(r.cancel.by, "customer"); assert.equal(r.cancel.note, "غيّرت رأيي"); assert.ok(r.cancel.at);
    assert.equal(r.cancel_request || null, null);
    assert.ok((await eventsOf(ref)).some((e) => e.event === "request.cancelled"), "الحدث مسجَّل: " + ref);
    n++;
  }
  const after = await call("me");
  assert.equal(after.counts.active, before - n, "عدّاد «طلبات نشطة» يتحدّث");
  assert.equal(after.counts.quotes, 0, "عرض السعر المُلغى لا يبقى «بانتظار اعتمادك»");
  assert.equal(after.counts.contracts, 0, "العقد المُلغى لا يبقى «بانتظار توقيعك»");
  // «والعميل يقدر يلغي وتنمسح» (2026-10-23): ما لا توقيع عليه ولا دفع يختفي من قوائمه
  // نهائياً — الصف باقٍ في القاعدة مُعلَّماً deleted_at للتدقيق في /ops، ولم يُحذف.
  assert.equal(after.requests.find((r) => r.ref === "T-QUOTE"), undefined, "الملغى لا يظهر في قائمة العميل");
  assert.ok((await rowOf("T-QUOTE")).deleted_at, "الصف باقٍ ومُعلَّم، لا محذوف");
});

test("PAYMENT_PENDING وSIGNED بلا دفعة ناجحة: يُلغى فوراً، ويُدوَّن أن العقد كان موقَّعاً", async () => {
  for (const ref of ["T-PAYPEND", "T-PAYGATE", "T-SIGNED"]) {
    const o = await call("request-cancel", { ref });
    assert.equal(o.ok, true, ref); assert.equal(o.cancelled, true, ref);
    const r = await rowOf(ref);
    assert.equal(r.status, "CANCELLED");
    assert.ok(["PAYMENT_PENDING", "SIGNED"].includes(r.cancel.stage), r.cancel.stage);
    assert.equal(r.cancel.contract_signed, true, "الفريق يرى أن العقد كان موقَّعاً");
    assert.equal(r.contract.status, "SIGNED", "نسخة العقد الموقَّعة لا تُمسّ");
  }
  assert.equal((await call("me")).counts.payments, 2, "لم يبقَ مستحقاً إلا T-PAYMONEY و T-SIGNMONEY (فيهما دفعة)");
});

test("PAYMENT_PENDING وفيه دفعة ناجحة: لا يُلغى فوراً بل يُطلَب", async () => {
  const o = await call("request-cancel", { ref: "T-PAYMONEY" });
  assert.equal(o.ok, true); assert.equal(o.requested, true); assert.notEqual(o.cancelled, true);
  const r = await rowOf("T-PAYMONEY");
  assert.equal(r.status, "PAYMENT_PENDING", "الحالة كما هي");
  assert.ok(r.cancel_request && r.cancel_request.at);
});

test("إلغاء استشارة يُلغي موعدها ويخرجها من عدّاد المواعيد", async () => {
  const before = (await call("me")).counts.appointments;
  assert.equal(before, 2, "موعدان قادمان");
  for (const ref of ["T-APPT", "BC-123456"]) {
    const o = await call("request-cancel", { ref });
    assert.equal(o.ok, true, ref); assert.equal(o.cancelled, true, ref);
    const r = await rowOf(ref);
    assert.equal(r.status, "CANCELLED");
    assert.equal(r.appointment.status, "CANCELLED", "الموعد يُلغى مع الطلب: " + ref);
    assert.ok(r.appointment.cancelled_at);
    assert.ok((await eventsOf(ref)).some((e) => e.event === "appointment.cancelled"));
  }
  assert.equal((await call("me")).counts.appointments, 0);
});

test("الإلغاء الفوري يغلق مهام المتابعة الآلية ويبقي اليدوية", async () => {
  await call("request-cancel", { ref: "T-TASKS" });
  const t = await sb("tasks?request_id=eq.id-T-TASKS&select=id,source,status");
  assert.equal(t.find((x) => x.id === "task-1").status, "cancelled");
  assert.equal(t.find((x) => x.id === "task-2").status, "open");
});

// ------------------------------------------------------------ طلب الإلغاء --
test("SIGNED المدفوع/PAID/IN_PROGRESS: يُسجَّل طلب إلغاء للفريق ولا تتغيّر الحالة", async () => {
  for (const ref of ["T-SIGNMONEY", "T-PAID", "T-WORK"]) {
    const o = await call("request-cancel", { ref, note: "لا أريد المتابعة" });
    assert.equal(o.ok, true, ref); assert.equal(o.requested, true, ref); assert.notEqual(o.cancelled, true, ref);
    const r = await rowOf(ref);
    assert.notEqual(r.status, "CANCELLED", ref);
    assert.equal(r.cancel_request.note, "لا أريد المتابعة");
    assert.equal(r.cancel_request.stage, r.status);
  }
});

test("تكرار طلب الإلغاء لا يضاعف المهمة ولا الحدث (idempotent)", async () => {
  const again = await call("request-cancel", { ref: "T-SIGNMONEY" });
  assert.equal(again.ok, true); assert.equal(again.already, true); assert.equal(again.requested, true);
  const tasks = await sb("tasks?request_id=eq.id-T-SIGNMONEY&source=eq.cancel.request&select=id");
  assert.equal(tasks.length, 1, "مهمة واحدة للفريق");
  const ev = (await eventsOf("T-SIGNMONEY")).filter((e) => e.event === "cancel.requested");
  assert.equal(ev.length, 1, "حدث واحد");
});

test("البوابة ترى طلب الإلغاء: cancel_requested في القائمة و cancel_policy في الطلب", async () => {
  const me = await call("me");
  assert.ok(me.requests.find((r) => r.ref === "T-SIGNMONEY").cancel_requested, "القائمة تعرضه");
  assert.equal(me.requests.find((r) => r.ref === "T-DONE").cancel_requested || null, null);
  const got = await call("request-get", { ref: "T-SIGNMONEY" });
  assert.equal(got.request.cancel_policy, "ask");
  assert.ok(got.request.cancel_request && got.request.cancel_request.at, "الصفحة تقرأ ما سُجِّل فلا تعيد الزرّ كأن شيئاً لم يحدث");
  assert.equal((await call("request-get", { ref: "T-GONE" })).request.cancel_policy, "closed");
});

// ------------------------------------------------------------------ الأخطاء --
test("أخطاء بأكواد ثابتة يترجمها العميل: لا رموز خام ولا نصوص عربية مطلوبة من الخادم", async () => {
  const closed = await call("request-cancel", { ref: "T-DONE" });
  assert.equal(closed.http, 409); assert.equal(closed.error, "already_closed");
  const gone = await call("request-cancel", { ref: "T-GONE" });
  assert.equal(gone.http, 409); assert.equal(gone.error, "already_closed");
  const foreign = await call("request-cancel", { ref: "T-THEIRS" });
  assert.equal(foreign.http, 404); assert.equal(foreign.error, "not_found");
  const nosess = await call("request-cancel", { ref: "T-NEW" }, "");
  assert.equal(nosess.http, 401); assert.equal(nosess.error, "no_session");
  const noref = await call("request-cancel", {});
  assert.equal(noref.http, 400); assert.equal(noref.error, "missing_ref");
});

// -------------------------------------------------- دفعة تصل بعد الإلغاء --
test("دفعة تصل على طلب مُلغى لا تُحييه بصمت: تُسجَّل وتُفتح مهمة للفريق", async () => {
  const out = await markRequestPaidByRef("T-RACE", { provider: "moyasar", payId: "pay_race_1", amount: 1150, test: false, actor: "moyasar" });
  assert.ok(out);
  const r = await rowOf("T-RACE");
  assert.equal(r.status, "CANCELLED", "الحالة تبقى ملغاة");
  assert.equal(r.payment.status, "PAID"); assert.equal(r.payment.after_cancel, true); assert.equal(r.payment.ref, "pay_race_1");
  assert.equal(r.invoice || null, null, "لا فاتورة تلقائية على طلب ملغى");
  assert.ok((await eventsOf("T-RACE")).some((e) => e.event === "payment.after_cancel"));
  const tasks = await sb("tasks?request_id=eq.id-T-RACE&select=title,urgency,status");
  assert.equal(tasks.length, 1); assert.equal(tasks[0].urgency, "urgent");   // db/schema.sql: tasks.urgency is urgent|soon|normal (the plays say «high»; sweepTask translates)
  // نفس الدفعة مرتين (webhook + callback) لا تضاعف شيئاً
  await markRequestPaidByRef("T-RACE", { provider: "moyasar", payId: "pay_race_1", amount: 1150, test: false, actor: "moyasar" });
  assert.equal((await sb("tasks?request_id=eq.id-T-RACE&select=id")).length, 1);
});

// ------------------------------------------------------------------ الواجهة --
test("واجهة /my: لا window.confirm، وكل نصوص الإلغاء بالعربية والإنجليزية والفرنسية والصينية", async () => {
  const { buildSimpleMy } = await import("../site/scripts/simple-v1-my.mjs");
  const stub = { href: (p) => p, header: () => "", footer: () => "", shell: ({ body, script }) => (body || "") + (script || "") };
  const KEYS = ["cxNowTitle", "cxAskTitle", "cxNowGo", "cxAskGo", "cxKeep", "cxSigned", "cxPaid", "cxAppt", "cxNowNote", "cxDoneNow", "cxDoneNowT",
    "cxPendTitle", "cxPendText", "cxSentAt", "cxPill", "cxNewReq", "cxAlready", "cxErrClosed", "cxErrSess", "cxErrNet", "cxErrNF", "cxErrGen", "evNotify"];
  const seen = {};
  for (const lang of ["ar", "en", "fr", "zh"]) {
    const html = buildSimpleMy(stub, { lang: () => lang });
    // الصفحة فيها عدة وسوم script (أبواب الدخول وغيرها): نأخذ سكربت البوابة الذي يحوي request-cancel
    const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((x) => x.includes("request-cancel")) || "";
    assert.ok(script, lang + ": سكربت البوابة غير موجود");
    new vm.Script(script); // خطأ نحوي واحد يُسقط البوابة كلها
    // (حذف المستند له تأكيده الخاص خارج هذا النطاق — الفحص حول نداء الإلغاء وحده)
    for (let i = script.indexOf("request-cancel"); i >= 0; i = script.indexOf("request-cancel", i + 1))
      assert.ok(!/\bconfirm\s*\(/.test(script.slice(Math.max(0, i - 900), i + 400)), lang + ": window.confirm يعود صامتاً حيث تُحجب النوافذ");
    const tx = JSON.parse(/TX=(\{.*?\}),ST=/s.exec(script)[1]);
    for (const k of KEYS) { assert.ok(tx[k] && tx[k].length >= 2, `${lang}.${k}`); (seen[k] ||= new Set()).add(tx[k]); }
  }
  for (const k of KEYS) assert.equal(seen[k].size, 4, `${k} مترجمة فعلاً، لا نسخة واحدة في اللغات الأربع`);
});

test.after(() => { globalThis.fetch = realFetch; try { fs.rmSync(DBDIR, { recursive: true, force: true }); } catch {} });
