// عيوب فحص الرحلة الكاملة في نطاق العروض والعقود (2026-10-23): عرض جزئي بدل التعليق الكامل،
// بنود المحادثة بلا رمز، وملحق العرض، والتوقيع برسمٍ واسمٍ كاملين، وشروط الدفع بلغة العميل،
// واللغة والاستئناف والمسودة في الصفحات (فحص ساكن + تشغيل الدالة المستخرجة).
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";

const DBDIR = fs.mkdtempSync(path.join(os.tmpdir(), "bp-journey-fix-"));
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const future = new Date(Date.now() + 864e5).toISOString();
const now = new Date().toISOString();
const TOK = { a: "tok-a-jf", b: "tok-b-jf", sales: "tok-s-jf" };
const EMAIL = { a: "jf.client@example.com", b: "jf.other@example.com", sales: "jf.sales@example.com" };
fs.writeFileSync(path.join(DBDIR, "db.json"), JSON.stringify({
  users: [
    { id: "u-a", email: EMAIL.a, full_name: "أحمد العميل", phone: "+966501234567", locale: "ar" },
    { id: "u-b", email: EMAIL.b, full_name: "خالد آخر", phone: "+966507654321", locale: "ar" },
    { id: "u-s", email: EMAIL.sales, full_name: "عضو المبيعات", locale: "ar" },
  ],
  organizations: [{ id: "org-a", name_ar: "شركة أحمد", created_at: now }, { id: "org-b", name_ar: "شركة خالد", created_at: now }, { id: "org-s", name_ar: "م", created_at: now }],
  user_sessions: [
    { id: "s-a", user_id: "u-a", organization_id: "org-a", token_hash: sha(TOK.a), revoked_at: null, expires_at: future },
    { id: "s-b", user_id: "u-b", organization_id: "org-b", token_hash: sha(TOK.b), revoked_at: null, expires_at: future },
    { id: "s-s", user_id: "u-s", organization_id: "org-s", token_hash: sha(TOK.sales), revoked_at: null, expires_at: future },
  ],
  requests: [], request_events: [], tasks: [],
}, null, 2));
process.env.LOCAL_DB = "1"; process.env.LOCAL_DB_DIR = DBDIR; process.env.SIMPLE_TEST_MODE = "1";
process.env.EMAIL_MODE = "preview"; process.env.WHATSAPP_MODE = "mock";
for (const k of ["RESEND_API_KEY", "RESEND_KEY", "DAFTRA_API_KEY", "WHATSAPP_TOKEN", "SIMPLE_NOTIFY", "SIMPLE_AUTO_QUOTE", "NDA_REQUIRED_SERVICES", "BP_DOCS_TEMPLATE"]) delete process.env[k];
process.env.SALES_TEAM_EMAILS = EMAIL.sales;
globalThis.fetch = async (u) => { throw new Error("no network in tests: " + u); };

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
const { handleSimple, signatureProblem } = await import("../api/_simple.js");
const { SEED_TITLES, isSeedTitle } = await import("../api/_scope-seeds.js");
const { sb } = await import("../api/_db.js");

async function call(action, body = {}, who = "a", { key } = {}) {
  const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(s) { this.body = s; } };
  await handleSimple({ method: "POST", body: { action, ...(key ? { key } : {}), ...body }, query: {}, headers: { cookie: who ? `bp_sid=${TOK[who]}` : "", "user-agent": "test" }, socket: {} }, res);
  return { http: res.statusCode, ...JSON.parse(res.body || "{}") };
}
const ops = (action, body = {}) => call(action, body, null, { key: "test-ops" });
const rowOf = async (ref) => (await sb(`requests?ref=eq.${encodeURIComponent(ref)}&select=*&limit=1`))[0];
const SIG = "data:image/png;base64," + "A".repeat(200);
const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), "utf8");
async function create(scope, extra = {}) {
  const r = await call("request-create", { type: "GOVERNMENT_SERVICE", title: "طلب", scope, auto_quote: true, ...extra });
  assert.equal(r.ok, true, JSON.stringify(r));
  return r.ref;
}
const PRICED = { code: "BP-SBC-02", title: "سجل تجاري", qty: 1 };          // One Time، 250
const PERCENT = { code: "BP-REC-04", title: "الاستقطاب التنفيذي", qty: 1 };  // «نسبة من قيمة الصفقة»

// ======================================================== ١) عرض جزئي بدل التعليق الكامل ==
test("بند بلا سعر ثابت لا يعلّق العرض: المسعّر يصدر فوراً والآخر في pending_items خارج المجموع والعقد", async () => {
  const ref = await create([PRICED, PERCENT]);
  const row = await rowOf(ref);
  assert.equal(row.status, "QUOTE_SENT", "كان يبقى «قيد المراجعة» بلا عرض");
  assert.deepEqual(row.quote.items.map((i) => i.code), ["BP-SBC-02"]);
  assert.equal(row.quote.net, 250); assert.equal(row.quote.total, 287.5, "المجموع بلا البند المنتظر");
  assert.equal(row.quote.pending_items.length, 1);
  assert.equal(row.quote.pending_items[0].code, "BP-REC-04"); assert.equal(row.quote.pending_items[0].reason, "percent");
  assert.ok(row.quote.pending_items[0].reason_ar.includes("نسبة"));
  assert.equal(row.scope.find((x) => x.code === "BP-REC-04").hold.reason, "percent", "ويظهر في نطاق العميل بسببه");
  // مهمة التسعير للمنتظر وحده
  const tasks = await sb(`tasks?request_id=eq.${row.id}&source=eq.pricing&select=details,status`);
  assert.equal(tasks.length, 1); assert.ok(tasks[0].details.includes("الاستقطاب التنفيذي") && !tasks[0].details.includes("سجل تجاري"), tasks[0].details);
  // العميل يراه في العرض، والعرض المطبوع يذكره
  const seen = (await call("request-get", { ref })).request;
  assert.equal(seen.quote.pending_items[0].title, "الاستقطاب التنفيذي");
  const view = await call("quote-view", { ref });
  assert.ok(view.html.includes("بنود بانتظار التسعير") && view.html.includes("الاستقطاب التنفيذي"), "قسم البنود المنتظرة في مستند العرض");
  // والعقد بلا المنتظر
  const ap = await call("quote-approve", { ref });
  assert.equal(ap.status, "CONTRACT_SENT");
  const html = (await rowOf(ref)).contract.html;
  assert.ok(!html.includes("الاستقطاب التنفيذي"), "ليس في العقد");
});

test("عرضٌ بكل بنوده بلا سعر ثابت يبقى معلّقاً بسببه (لا شيء يُعرض)", async () => {
  const ref = await create([PERCENT, { code: "BP-NO-SUCH", title: "غريب", qty: 1 }]);
  const row = await rowOf(ref);
  assert.equal(row.status, "REVIEWING"); assert.equal(row.quote || null, null);
  assert.deepEqual(row.scope.filter((x) => x.hold).map((x) => x.hold.reason).sort(), ["percent", "unknown_code"]);
});

// ===================================================================== ٢) ملحق العرض ==
test("تسعير المنتظر بعد اعتماد العرض يصدر ملحقاً (Q-…-A1) ولا يمسّ المعتمد ولا عقده", async () => {
  const ref = await create([PRICED, PERCENT]);
  assert.equal((await ops("ops-quote-addendum", { ref, items: [{ pending_title: "الاستقطاب التنفيذي", price: 1000 }] })).error, "use_ops_quote", "قبل الاعتماد يُعاد العرض كاملاً");
  await call("quote-approve", { ref });
  const before = await rowOf(ref);
  const bad1 = await ops("ops-quote-addendum", { ref, items: [{ pending_title: "الاستقطاب التنفيذي", price: 0 }] });
  assert.equal(bad1.http, 400); assert.equal(bad1.error, "unpriced_items");
  assert.equal((await ops("ops-quote-addendum", { ref, items: [{ pending_title: "ما ليس منتظراً", price: 10 }] })).error, "not_pending");
  const out = await ops("ops-quote-addendum", { ref, items: [{ pending_title: "الاستقطاب التنفيذي", title: "الاستقطاب التنفيذي", price: 1000 }] });
  assert.equal(out.ok, true); assert.ok(/-A1$/.test(out.addendum.number)); assert.equal(out.addendum.net, 1000); assert.equal(out.addendum.total, 1150); assert.equal(out.pending_left, 0);
  const after = await rowOf(ref);
  assert.equal(after.quote.net, before.quote.net, "المعتمد لم يتغيّر"); assert.deepEqual(after.quote.items, before.quote.items);
  assert.equal(after.quote.status, "APPROVED"); assert.equal(after.contract.html, before.contract.html, "والعقد لم يُمسّ");
  assert.equal(after.quote.pending_items, undefined); assert.ok(!after.scope.some((x) => x.hold));
  assert.equal((await sb(`tasks?request_id=eq.${after.id}&source=eq.pricing&select=status`))[0].status, "done");
  // العميل يعتمد الملحق مرةً واحدة، وعميلٌ آخر لا يراه
  assert.equal((await call("quote-addendum-approve", { ref, number: out.addendum.number }, "b")).http, 404);
  const ok = await call("quote-addendum-approve", { ref, number: out.addendum.number });
  assert.equal(ok.ok, true); assert.equal(ok.addendum.status, "APPROVED");
  assert.equal((await call("quote-addendum-approve", { ref, number: out.addendum.number })).error, "no_open_addendum");
  const t = await sb(`tasks?request_id=eq.${after.id}&source=eq.quote.addendum&select=title`);
  assert.equal(t.length, 1); assert.ok(t[0].title.includes("ملحق"), "الفريق يتابع ملحق العقد والمبلغ الإضافي");
  assert.equal((await rowOf(ref)).contract.html, before.contract.html);
});

test("الملحق: انتهاؤه يمنع اعتماده، ورفضه برسالة، والصلاحيات", async () => {
  const ref = await create([PRICED, PERCENT]);
  await call("quote-approve", { ref });
  const o = await ops("ops-quote-addendum", { ref, items: [{ pending_title: "الاستقطاب التنفيذي", price: 500 }] });
  assert.equal((await call("ops-quote-addendum", { ref, items: [] }, "a")).http, 401, "العميل لا يصدره");
  assert.equal((await call("ops-quote-addendum", { ref, items: [] }, "sales")).http, 403, "ولا المبيعات");
  const row = await rowOf(ref);
  await sb(`requests?id=eq.${row.id}`, { method: "PATCH", body: { quote: { ...row.quote, addenda: row.quote.addenda.map((a) => ({ ...a, valid_until: "2020-01-01" })) } } });
  assert.equal((await call("quote-addendum-approve", { ref, number: o.addendum.number })).error, "quote_expired");
  assert.equal((await call("quote-addendum-reject", { ref, number: o.addendum.number })).error, "note_required");
  const rj = await call("quote-addendum-reject", { ref, number: o.addendum.number, note: "غالٍ" });
  assert.equal(rj.ok, true); assert.equal(rj.addendum.status, "REJECTED");
});

// ============================================== ٣) بنود المحادثة بلا رمز تُحلّ بالاسم ==
test("بند المحادثة الذي يطابق اسم خدمة الكتالوج يُحلّ إلى رمزها ويُسعَّر منه؛ وما لا يُحلّ ينتظر ولا يعلّق الباقي", async () => {
  const ref = await create([{ code: "", title: "إصدار سجل تجاري جديد", why: "نص من المحادثة", qty: 1 }, { code: "", title: "خدمة لا وجود لها في الكتالوج", qty: 1 }]);
  const row = await rowOf(ref);
  assert.equal(row.status, "QUOTE_SENT", "كان بنداً «كتبتَه بنفسك» يعلّق الطلب");
  assert.equal(row.quote.items[0].code, "BP-SBC-02"); assert.equal(row.quote.items[0].price, 250);
  assert.equal(row.quote.pending_items[0].title, "خدمة لا وجود لها في الكتالوج"); assert.equal(row.quote.pending_items[0].reason, "custom");
  // بالاسم الإنجليزي، وبرمزٍ مجهول مع اسمٍ صحيح
  const en = await create([{ code: "", title: "Saudi Company Formation", qty: 1 }]);
  const r2 = await rowOf(en);
  const nameEn = r2.quote ? r2.quote.items[0].code : null;
  assert.ok(nameEn === "BP-SBC-01" || r2.status === "REVIEWING", "إن وُجد الاسم الإنجليزي حُلّ، وإلا ينتظر");
  const wrong = await create([{ code: "BP-OLD-9", title: "تأسيس شركة سعودية", qty: 1 }]);
  assert.equal((await rowOf(wrong)).quote.items[0].code, "BP-SBC-01", "رمز مجهول باسمٍ صحيح يُصحَّح");
});

test("سطور البذرة بلا علامة تُعرَف بعنوانها بأي لغة، وقائمة العناوين لا تنحرف عن صفحة المحادثة", async () => {
  assert.ok(isSeedTitle("Examine the problem or the transaction")); assert.ok(isSeedTitle("检查问题或事务")); assert.ok(isSeedTitle("  فحص المشكلة أو المعاملة "));
  assert.equal(isSeedTitle("خدمة حقيقية"), false);
  const home = read("../site/scripts/simple-v1.mjs");
  for (const t of SEED_TITLES) assert.ok(home.includes(JSON.stringify(t)), "عنوان البذرة موجود في صفحة المحادثة: " + t);
  const ref = await create([PRICED, { code: "", title: "Identify the government services required", qty: 1 }]);
  const row = await rowOf(ref);
  assert.equal(row.status, "QUOTE_SENT"); assert.equal(row.quote.pending_items, undefined);
});

// ============================================================== ٤) التوقيع: اسم ورسم ==
async function toContract() {
  const ref = await create([PRICED]);
  await call("quote-approve", { ref });
  return ref;
}
test("التوقيع يلزمه اسم من ٣ أحرف فأكثر ورسمٌ صالح، برسالةٍ مفهومة", async () => {
  const ref = await toContract();
  const short = await call("contract-sign", { ref, consent: true, name: "أ", signature: SIG });
  assert.equal(short.http, 400); assert.equal(short.error, "name_too_short"); assert.ok(short.message.includes("اسمك الكامل"));
  const blank = await call("contract-sign", { ref, consent: true, name: "أحمد العميل" });
  assert.equal(blank.http, 400); assert.equal(blank.error, "signature_required"); assert.ok(blank.message.includes("ارسم توقيعك"));
  assert.equal((await call("contract-sign", { ref, consent: true, name: "أحمد العميل", signature: "data:text/html;base64,PHNjcmlwdD4=" })).error, "signature_required");
  assert.equal((await rowOf(ref)).contract.status, "SENT", "لم يُوقَّع شيء");
  const ok = await call("contract-sign", { ref, consent: true, name: "أحمد العميل", signature: SIG });
  assert.equal(ok.ok, true); assert.equal((await rowOf(ref)).contract.signature.image, SIG);
  // الاتفاقية بالقاعدة نفسها
  const n = await create([PRICED]);
  await ops("ops-nda", { ref: n });
  assert.equal((await call("nda-sign", { ref: n, consent: true, name: "أ", signature: SIG })).error, "name_too_short");
  assert.equal((await call("nda-sign", { ref: n, consent: true, name: "أحمد العميل" })).error, "signature_required");
  assert.equal((await call("nda-sign", { ref: n, consent: true, name: "أحمد العميل", signature: SIG })).ok, true);
  assert.equal(signatureProblem("  ا ب ", SIG).error, "name_too_short", "المسافات لا تُعدّ حروفاً");
});

// ============================================================ ٥) شروط الدفع بلغة العميل ==
test("شروط الدفع الافتراضية تظهر بلغة العميل (مستند العرض وبطاقته)، وما خُزِّن يبقى كما كُتب", async () => {
  const ref = await create([PRICED], { lang: "en" });
  const row = await rowOf(ref);
  assert.equal(row.lang, "en"); assert.equal(row.quote.payment_terms, "الدفع مقدماً بعد توقيع العقد", "المخزَّن كما كُتب");
  const view = await call("quote-view", { ref });
  assert.ok(view.html.includes("Payment in advance after the contract is signed"), "بالإنجليزية في مستند العرض");
  assert.ok(!view.html.includes("الدفع مقدماً بعد توقيع العقد"));
  assert.equal((await call("request-get", { ref })).request.quote.payment_terms, "Payment in advance after the contract is signed");
  const ar = await create([PRICED]);
  assert.equal((await call("request-get", { ref: ar })).request.quote.payment_terms, "الدفع مقدماً بعد توقيع العقد");
  const custom = await rowOf(ref);
  await sb(`requests?id=eq.${custom.id}`, { method: "PATCH", body: { quote: { ...custom.quote, payment_terms: "٥٠٪ مقدماً" } } });
  assert.equal((await call("request-get", { ref })).request.quote.payment_terms, "٥٠٪ مقدماً", "شروط كتبها إنسان لا تُترجم");
});

// ====================================================== ٦) الصفحات: لغة، استئناف، مسودة ==
test("تبديل اللغة يحفظ مرجع الطلب والعرض والمحادثة: الروابط تحمل query والـhash، والمحادثة لا تسقط بتغيّر اللغة", () => {
  const home = read("../site/scripts/simple-v1.mjs");
  assert.ok(home.includes("closest('a[data-lang]')") && home.includes("u.search=location.search") && home.includes("u.hash=location.hash"), "روابط اللغة تحمل query وhash");
  assert.ok(home.includes("if(sv&&sv.ctx){"), "المحادثة المحفوظة تُستعاد أياً كانت لغتها");
  assert.ok(!home.includes("sv.lang===LANG&&sv.ctx"), "ولم يعد شرط اللغة قائماً");
  // التنفيذ الفعلي للمعالج على DOM مصغَّر
  const m = home.match(/document\.addEventListener\('click',function\(e\)\{var a=e\.target&&e\.target\.closest&&e\.target\.closest\('a\[data-lang\]'\);[\s\S]*?\},true\);/);
  assert.ok(m, "المعالج موجود");
  let handler; const a = { href: "/en/my", getAttribute() { return this.href; }, setAttribute(k, v) { this.href = v; } };
  vm.runInNewContext(m[0], { document: { addEventListener: (_, f) => { handler = f; } }, location: { search: "?view=request&ref=BP-R-ABC123", hash: "#advisor", href: "https://x.test/ar/my?view=request&ref=BP-R-ABC123" }, URL });
  handler({ target: { closest: () => a } });
  assert.equal(a.href, "/en/my?view=request&ref=BP-R-ABC123#advisor");
});

test("الدخول من تبويب آخر يكمل إنشاء العرض: الاستئناف يعتمد المسودة في localStorage لا علامة التبويب وحدها", () => {
  const flow = read("../site/scripts/sv1-quote-auth-flow.mjs");
  assert.ok(flow.includes("searchParams.get('resume')==='quote' && (sessionStorage.getItem('sv1_resume_quote')==='1' || pending())"));
  assert.ok(flow.includes("localStorage.removeItem('bp_quote_draft')"), "وتُستهلك المسودة عند الإنشاء");
});

test("«اطلب عرض سعر» يضيف إلى مسودة الطلب بدل أن يستبدلها (صفحة الخدمة والتصنيف)", () => {
  for (const f of ["../site/scripts/simple-v1-service-detail.mjs", "../site/scripts/simple-v1-service-category.mjs"]) {
    const src = read(f);
    const fn = src.match(/function qdAdd\(it,door\)\{[\s\S]*?return nd\}/);
    assert.ok(fn, f);
    assert.ok(!/setItem\('bp_sva_request',JSON\.stringify\(\{items:\[\{code:/.test(src), "لم يعد يكتب بنداً واحداً فقط: " + f);
    const store = {}; const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
    const ctx = { localStorage: ls, JSON, Date }; vm.createContext(ctx); vm.runInContext(fn[0] + ";globalThis.qdAdd=qdAdd", ctx);
    const one = ctx.qdAdd({ code: "BP-SBC-01", title: "تأسيس", why: "" }, "formation");
    assert.equal(one.items.length, 1);
    const two = ctx.qdAdd({ code: "BP-SBC-02", title: "سجل", why: "" }, "formation");
    assert.equal(JSON.stringify(two.items.map((x) => x.code)), '["BP-SBC-01","BP-SBC-02"]', "الثانية أُضيفت إلى الأولى");
    assert.equal(ctx.qdAdd({ code: "BP-SBC-02", title: "سجل", why: "" }, "formation").items.length, 2, "ولا تتكرر");
    store.bp_quote_draft = JSON.stringify({ at: Date.now() - 7 * 36e5, items: [{ code: "OLD", title: "قديم" }] });
    assert.equal(JSON.stringify(ctx.qdAdd({ code: "BP-SBC-01", title: "تأسيس", why: "" }).items.map((x) => x.code)), '["BP-SBC-01"]', "مسودة عمرها أكثر من ست ساعات تُنسى");
  }
  const home = read("../site/scripts/simple-v1.mjs");
  assert.ok(home.includes("bp_quote_draft"), "والمحادثة تعكس بنودها في المسودة وتستهلكها");
});

test("بطاقة العميل: لا زرّ اعتماد لعرضٍ منتهٍ، ورسالة مفهومة لرابط طلبٍ ألغي، وتحقّق التوقيع في الصفحة", () => {
  const my = read("../site/scripts/simple-v1-my.mjs");
  assert.ok(my.includes("isExp?renewBtn:h('button',{class:'btn',id:'sv1Approve'"), "الاعتماد يُستبدل بطلب التجديد عند الانتهاء");
  assert.ok(my.includes("TX.renewAsk") && my.includes("انتهت الصلاحية — اطلب تجديداً"));
  assert.ok(my.includes("o.error==='not_found'") && my.includes("id:'sv1Gone'") && my.includes("لم يعد متاحاً"), "رابط الطلب الملغى");
  assert.ok(my.includes("TX.signNameErr") && my.includes("TX.signDrawErr") && my.includes("signature:cv.toDataURL('image/png')"), "اسم ورسم قبل الإرسال");
  assert.ok(my.includes("sv1Pending") && my.includes("بنود بانتظار التسعير (يصلك لها عرض ملحق)"));
});
