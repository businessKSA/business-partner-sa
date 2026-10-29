// عرض السعر الآلي بتصميم الهوية الدائمة (قرار المالك 2026-10-29) داخل الرحلة الحقيقية (api/_simple.js)،
// على قاعدة محلية مؤقتة وبلا شبكة:
//   ١) اعتماد النطاق (أو الإنشاء بعرض فوري) يصدر العرض فوراً بالقالب v3 ويخزّن لقطة ما تحتاجه الورقة.
//   ٢) الرابط العام الموقَّع: قراءة فقط، مقيَّد برقم العرض، يموت بالتجديد والإلغاء والانتهاء، 404 موحّد، ومفتاح إيقاف.
//   ٣) باقات REV: لا تصدر آلياً (اشتراك شهري)؛ يصدرها إنسان وتحمل صفحات الباقات من الكتالوج.
//   ٤) الملحق يُعرض بورقته، والعقد وNDA لم يتغيّرا (ما زالا v2)، والعرض القديم يبقى بورقته.
//   ٥) مفاتيح الإيقاف: BP_DOCS_QUOTE_TEMPLATE=v2 و BP_DOCS_TEMPLATE=v1 والفرنسية/الصينية.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DBDIR = fs.mkdtempSync(path.join(os.tmpdir(), "bp-quote-v3-flow-"));
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const future = new Date(Date.now() + 864e5).toISOString();
const now = new Date().toISOString();
const TOK = { a: "tok-a-v3flow", b: "tok-b-v3flow" };
fs.writeFileSync(path.join(DBDIR, "db.json"), JSON.stringify({
  users: [
    { id: "u-a", email: "v3.a@example.com", full_name: "أحمد العميل", phone: "+966501234567", locale: "ar" },
    { id: "u-b", email: "v3.b@example.com", full_name: "خالد آخر", phone: "+966507654321", locale: "ar" },
  ],
  organizations: [{ id: "org-a", name_ar: "شركة أحمد للتجارة", created_at: now }, { id: "org-b", name_ar: "شركة خالد", created_at: now }],
  user_sessions: [
    { id: "s-a", user_id: "u-a", organization_id: "org-a", token_hash: sha(TOK.a), revoked_at: null, expires_at: future },
    { id: "s-b", user_id: "u-b", organization_id: "org-b", token_hash: sha(TOK.b), revoked_at: null, expires_at: future },
  ],
  requests: [], request_events: [], tasks: [],
}, null, 2));
process.env.LOCAL_DB = "1"; process.env.LOCAL_DB_DIR = DBDIR; process.env.SIMPLE_TEST_MODE = "1";
process.env.EMAIL_MODE = "preview"; process.env.WHATSAPP_MODE = "mock"; process.env.OTP_SECRET = "test-secret-quote-v3-flow";
for (const k of ["RESEND_API_KEY", "RESEND_KEY", "DAFTRA_API_KEY", "WHATSAPP_TOKEN", "SIMPLE_NOTIFY", "SIMPLE_AUTO_QUOTE", "NDA_REQUIRED_SERVICES", "BP_DOCS_TEMPLATE", "BP_DOCS_QUOTE_TEMPLATE", "QUOTE_PUBLIC_LINK"]) delete process.env[k];
globalThis.fetch = async (u) => { throw new Error("no network in tests: " + u); };

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
const { handleSimple } = await import("../api/_simple.js");
const { sb } = await import("../api/_db.js");
const { quoteLinkToken, _resetQuoteLinkThrottle } = await import("../api/_quote-doc.js");

async function call(action, body = {}, who = "a", { key } = {}) {
  const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(s) { this.body = s; } };
  await handleSimple({ method: "POST", body: { action, ...(key ? { key } : {}), ...body }, query: {}, headers: { cookie: who ? `bp_sid=${TOK[who]}` : "", "user-agent": "test" }, socket: {} }, res);
  return { http: res.statusCode, ...JSON.parse(res.body || "{}") };
}
const ops = (action, body = {}) => call(action, body, null, { key: "test-ops" });
// the public door: a GET with NO cookie at all
async function pub(query, { ip = "10.0.0.1", method = "GET" } = {}) {
  const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(s) { this.body = s; } };
  await handleSimple({ method, query: { action: "quote-public", ...query }, headers: { "x-forwarded-for": ip }, socket: {} }, res);
  return res;
}
const rowOf = async (ref) => (await sb(`requests?ref=eq.${encodeURIComponent(ref)}&select=*&limit=1`))[0];
const FIXED = { code: "BP-SBC-01", title: "خدمة ثابتة", qty: 1 };           // «One Time» 7500
const GOV = [{ code: "BP-ABSHER-01", title: "تفعيل أبشر أعمال", qty: 1 }, { code: "BP-BALADY-01", title: "رخصة بلدية", qty: 1 }];
const PERCENT = { code: "BP-REC-04", title: "الاستقطاب التنفيذي", qty: 1 };
async function create(scope, extra = {}, who = "a") {
  const r = await call("request-create", { type: "GOVERNMENT_SERVICE", title: "طلب اختبار", scope, auto_quote: true, ...extra }, who);
  assert.equal(r.ok, true, JSON.stringify(r));
  return r.ref;
}
const linkOf = async (ref) => { const u = new URL((await call("request-get", { ref })).request.quote.public_url, "http://x"); return { ref: u.searchParams.get("ref"), t: u.searchParams.get("t"), path: u.pathname + u.search }; };

test("اعتماد النطاق يصدر العرض فوراً بقالب الهوية الدائمة v3، ولقطة ما تحتاجه الورقة تُخزَّن مرة واحدة", async () => {
  const ref = await create(GOV, { auto_quote: false, documents: [{ title: "السجل التجاري" }, { title: "وثيقة طلبها المستشار" }] });
  assert.equal((await rowOf(ref)).quote, undefined, "قبل اعتماد النطاق لا عرض");
  const c = await call("scope-confirm", { ref, scope: GOV });
  assert.equal(c.ok, true); assert.equal(c.stage, "QUOTE"); assert.equal(c.auto, true, "فوراً وبلا إنسان");
  const row = await rowOf(ref);
  assert.equal(row.status, "QUOTE_SENT");
  assert.equal(row.quote.template_version, "v3");
  assert.deepEqual(row.quote.items.map((i) => i.code), ["BP-ABSHER-01", "BP-BALADY-01"]);
  assert.equal(row.quote.validity_days, 14);
  assert.equal(row.quote.net, 1300); assert.equal(row.quote.vat, 195); assert.equal(row.quote.total, 1495);
  const doc = row.quote.doc;
  assert.ok(doc.company && doc.company.unified && doc.company.bank.iban, "الشركة كما يقرؤها تذييل الموقع");
  assert.ok(doc.services["BP-ABSHER-01"].featuresEn.length && doc.services["BP-ABSHER-01"].durationAr, "نطاق الخدمة من صفحتها");
  assert.ok(doc.documents.some((d) => d.ar === "السجل التجاري" && d.en === "Commercial Registration") && doc.documents.some((d) => d.ar === "وثيقة طلبها المستشار"));
  const v = await call("quote-view", { ref });
  assert.equal(v.ok, true); assert.equal(v.number, row.quote.number);
  assert.match(v.html, /data-bp-doc="v3" data-kind="quote"/);
  for (const x of ["BP-ABSHER-01", "BP-BALADY-01", "1,300.00", "195.00", "1,495.00", row.quote.number, "شركة أحمد للتجارة", "Quote validity", "صلاحية العرض", 'class="bpd-bar"']) assert.ok(v.html.includes(x), x);
  assert.ok(!v.html.includes("Revenue model"), "صفحات REV لا تظهر لخدمة عادية");
  assert.ok(!/مسودة|draft/i.test(v.html));
});

test("الإنشاء بعرض فوري (من المحادثة) يصدر v3 كذلك، وطلبٌ بلا بند منتظر لا يحمل قسم المنتظرة", async () => {
  const ref = await create([FIXED]);
  const row = await rowOf(ref);
  assert.equal(row.quote.template_version, "v3"); assert.equal(row.quote.total, 8625);
  assert.ok(!(await call("quote-view", { ref })).html.includes("Lines awaiting a price"));
});

test("المستند ثابت بعد الإصدار: تغيير قائمة المستندات أو صفحة الخدمة لاحقاً لا يعيد كتابة عرضٍ في يد العميل", async () => {
  const ref = await create(GOV, { documents: [{ title: "السجل التجاري" }] });
  const before = (await call("quote-view", { ref })).html;
  const row = await rowOf(ref);
  await sb(`requests?id=eq.${row.id}`, { method: "PATCH", body: { documents: [{ title: "مستند جديد تماماً", status: "requested" }] } });
  assert.equal((await call("quote-view", { ref })).html, before, "المستندات كما صدرت");
});

test("الرابط العام الموقَّع: يُسلَّم لصاحب الجلسة فقط، يقرأ العرض بلا جلسة، ولا يعطي شيئاً سواه", async () => {
  _resetQuoteLinkThrottle();
  const ref = await create(GOV);
  const mine = (await call("request-get", { ref })).request;
  assert.match(mine.quote.public_url, /^\/api\/simple\?action=quote-public&ref=BP-R-[A-Z0-9]+&t=[A-Za-z0-9_-]{32}$/, "نسبي: يفتح على أي مضيف");
  assert.notEqual((await call("request-get", { ref }, "b")).ok, true, "ليس لغير صاحب الطلب");
  const { t } = await linkOf(ref);
  assert.equal(t, quoteLinkToken(ref, mine.quote.number));
  const r = await pub({ ref, t });
  assert.equal(r.statusCode, 200);
  assert.match(r.headers["content-type"], /^text\/html/);
  assert.match(r.body, /data-bp-doc="v3" data-kind="quote"/);
  assert.ok(r.body.includes("1,495.00") && r.body.includes('class="bpd-bar"'), "الورقة كاملة بزر الطباعة");
  assert.equal(r.headers["cache-control"], "private, no-store");
  assert.match(r.headers["x-robots-tag"], /noindex/); assert.equal(r.headers["referrer-policy"], "no-referrer");
  assert.match(r.headers["content-security-policy"], /default-src 'none'/); assert.match(r.headers["content-security-policy"], /frame-ancestors 'none'/);
  assert.ok(!("set-cookie" in r.headers), "بلا كوكي");
  // قراءة فقط: لا اعتماد ولا توقيع ولا دفع عبر الرابط (كلها تحتاج حساب العميل)
  assert.equal((await call("quote-approve", { ref }, null)).error, "no_session");
  assert.equal((await pub({ ref, t }, { method: "POST" })).statusCode, 404, "GET فقط");
});

test("الرابط العام: كل فشل يردّ 404 واحداً (لا يُعرف أي مرجع موجود)، وبصمة خاطئة أو مرجع غيره أو شكلٌ مشوَّه لا تفتح", async () => {
  const ref = await create(GOV), other = await create([FIXED], {}, "b");
  const { t } = await linkOf(ref);
  const bodies = new Set();
  for (const q of [{ ref, t: "x".repeat(32) }, { ref, t: t.slice(0, 31) + (t.endsWith("A") ? "B" : "A") }, { ref, t: "" }, { ref, t: t + "x" }, { ref: other, t }, { ref: "BP-R-NOPE99", t }, { ref: "../../etc/passwd", t }, { ref: "", t }, { t }, { ref: ref.toLowerCase().replace("bp-r-", "bp-r-"), t: "short" }]) {
    const r = await pub(q);
    assert.equal(r.statusCode, 404, JSON.stringify(q)); bodies.add(r.body);
  }
  assert.equal(bodies.size, 1, "الجواب نفسه في كل الحالات");
  assert.equal((await pub({ ref: ref.toLowerCase(), t })).statusCode, 200, "حالة الأحرف في المرجع لا تهم");
});

test("الرابط مقيَّد برقم العرض: التجديد بعد «طلب تعديل» يُميت القديم، والإلغاء والانتهاء يغلقانه، ومفتاح الإيقاف يغلق الباب كله", async () => {
  const ref = await create(GOV);
  const old = await linkOf(ref);
  assert.equal((await pub(old)).statusCode, 200);
  assert.equal((await call("quote-reject", { ref, note: "أريد تعديل البنود" })).ok, true);
  assert.equal((await pub(old)).statusCode, 200, "ما زال العرض نفسه (مرفوض لكنه قائم)");
  assert.equal((await ops("ops-quote", { ref, items: [{ code: "BP-ABSHER-01", price: 300, qty: 1 }], confirm_prices: true })).ok, true);
  const row = await rowOf(ref);
  assert.match(row.quote.number, /-R$/, "عرض منقَّح برقم جديد");
  assert.equal((await pub(old)).statusCode, 404, "الرابط القديم مات");
  const fresh = await linkOf(ref);
  assert.notEqual(fresh.t, old.t);
  assert.equal((await pub(fresh)).statusCode, 200);
  // الانتهاء: بعد ٣٠ يوماً من نهاية صلاحية العرض
  await sb(`requests?id=eq.${row.id}`, { method: "PATCH", body: { quote: { ...row.quote, valid_until: new Date(Date.now() - 31 * 864e5).toISOString().slice(0, 10) } } });
  assert.equal((await pub(fresh)).statusCode, 404, "منتهٍ");
  await sb(`requests?id=eq.${row.id}`, { method: "PATCH", body: { quote: { ...row.quote, valid_until: new Date(Date.now() - 5 * 864e5).toISOString().slice(0, 10) } } });
  assert.equal((await pub(fresh)).statusCode, 200, "العرض المنتهي صلاحيته يُقرأ (مهلة ٣٠ يوماً) لكنه لا يُعتمد");
  // الإلغاء
  await sb(`requests?id=eq.${row.id}`, { method: "PATCH", body: { status: "CANCELLED" } });
  assert.equal((await pub(fresh)).statusCode, 404, "طلب ملغى");
  await sb(`requests?id=eq.${row.id}`, { method: "PATCH", body: { status: "QUOTE_SENT" } });
  assert.equal((await pub(fresh)).statusCode, 200);
  // مفتاح الإيقاف
  process.env.QUOTE_PUBLIC_LINK = "0";
  try {
    assert.equal((await pub(fresh)).statusCode, 404, "الباب مغلق");
    assert.equal((await call("request-get", { ref })).request.quote.public_url, undefined, "ولا يُسلَّم رابط");
  } finally { delete process.env.QUOTE_PUBLIC_LINK; }
});

test("الرابط العام: حدّ سرعة لكل عنوان (٣٠ فتحة / ١٠ دقائق)، والعنوان الآخر لا يتأثر", async () => {
  _resetQuoteLinkThrottle();
  const ref = await create(GOV);
  const l = await linkOf(ref);
  for (let i = 0; i < 30; i++) assert.equal((await pub(l, { ip: "10.9.9.9" })).statusCode, 200);
  assert.equal((await pub(l, { ip: "10.9.9.9" })).statusCode, 429);
  assert.equal((await pub(l, { ip: "10.8.8.8" })).statusCode, 200);
  _resetQuoteLinkThrottle();
});

test("باقة REV: لا تصدر آلياً (اشتراك شهري) فتنتظر إنساناً كما اليوم؛ وحين يصدرها يحمل العرض صفحات الباقات من سعر الكتالوج", async () => {
  const ref = await create([{ code: "REV-GROWTH", title: "تطوير الأعمال — باقة النمو", qty: 1 }], { auto_quote: false });
  const c = await call("scope-confirm", { ref, scope: [{ code: "REV-GROWTH", title: "تطوير الأعمال — باقة النمو", qty: 1 }] });
  assert.equal(c.ok, true); assert.equal(c.stage, "PRICING", "ما سعره اشتراك شهري يبقى على التسعير البشري");
  assert.equal((await rowOf(ref)).quote, undefined);
  const q = await ops("ops-quote", { ref, items: [{ code: "REV-GROWTH", price: 5000, qty: 3 }], confirm_prices: true });
  assert.equal(q.ok, true, JSON.stringify(q));
  const row = await rowOf(ref);
  assert.equal(row.quote.template_version, "v3"); assert.equal(row.quote.net, 15000); assert.equal(row.quote.total, 17250);
  assert.equal(row.quote.doc.rev.selected, "REV-GROWTH");
  assert.deepEqual(row.quote.doc.rev.packages.map((p) => p.monthly), [2500, 5000, 9500]);
  const html = (await call("quote-view", { ref })).html;
  for (const x of ["Revenue model (hybrid)", "نموذج الإيراد (هجين)", "Business Development as a Service", "17,250.00", "Qualified leads per month"]) assert.ok(html.includes(x), x);
});

test("ملحق العرض يُعرض بورقته: برقمه، ويسمّي العرض الأصلي، ولا يُغيّر العرض الأصلي ولا عقده", async () => {
  const ref = await create([FIXED, PERCENT]);
  const row0 = await rowOf(ref);
  assert.equal(row0.quote.pending_items.length, 1, "بند بنسبة ينتظر التسعير");
  const base = (await call("quote-view", { ref })).html;
  assert.ok(base.includes("Lines awaiting a price") && base.includes("الاستقطاب التنفيذي"));
  assert.equal((await call("quote-approve", { ref })).ok, true);
  const contract = (await rowOf(ref)).contract;
  assert.equal(contract.template_version, "v2", "العقد ما زال v2 (قالبه التالي)"); assert.match(contract.html, /data-bp-doc="v2" data-kind="contract"/);
  const a = await ops("ops-quote-addendum", { ref, items: [{ pending_title: "الاستقطاب التنفيذي", price: 900 }] });
  assert.equal(a.ok, true, JSON.stringify(a));
  const number = a.addendum.number;
  assert.match(number, /-A1$/);
  assert.ok((await rowOf(ref)).quote.addenda[0].doc.company, "لقطة الملحق");
  const v = await call("quote-view", { ref, number });
  assert.equal(v.ok, true); assert.equal(v.number, number);
  assert.match(v.html, /data-bp-doc="v3" data-kind="addendum"/);
  for (const x of ["QUOTATION ADDENDUM", "ملحق عرض سعر", number, "900.00", "1,035.00", `This addendum supplements quotation ${row0.quote.number}`]) assert.ok(v.html.includes(x), x);
  assert.equal((await call("quote-view", { ref, number: "Q-NOPE-A9" })).http, 404);
  assert.equal((await call("quote-view", { ref })).html, base, "العرض الأصلي كما هو");
  assert.equal((await rowOf(ref)).contract.html, contract.html, "والعقد لم يتغيّر بايتاً");
});

test("عرضٌ صدر بالورقة السابقة (v2 أو بلا قالب) يبقى بورقته ولا يُسلَّم له رابط عام", async () => {
  const ref = await create([FIXED]);
  const row = await rowOf(ref);
  const { doc, ...rest } = row.quote;
  await sb(`requests?id=eq.${row.id}`, { method: "PATCH", body: { quote: { ...rest, template_version: "v2" } } });
  const v = await call("quote-view", { ref });
  assert.match(v.html, /data-bp-doc="v2" data-kind="quote"/);
  assert.equal((await call("request-get", { ref })).request.quote.public_url, undefined);
  const l = { ref, t: quoteLinkToken(ref, row.quote.number) };
  assert.equal((await pub(l)).statusCode, 404, "حتى بتوقيعٍ صحيح: لا يُخدَم إلا v3");
  const { template_version, ...legacy } = rest;
  await sb(`requests?id=eq.${row.id}`, { method: "PATCH", body: { quote: legacy } });
  assert.ok(!/data-bp-doc="v3"/.test((await call("quote-view", { ref })).html), "بلا قالب مخزَّن: الورقة الأصلية v1");
  assert.ok(!(await call("quote-view", { ref })).html.includes("data-bp-doc="), "بلا علامة نسخة (v1 أصلي)");
});

test("مفاتيح الإيقاف: BP_DOCS_QUOTE_TEMPLATE=v2 يُصدر الورقة السابقة، BP_DOCS_TEMPLATE=v1 الأقدم، والفرنسية والصينية تبقيان على الأقدم", async () => {
  process.env.BP_DOCS_QUOTE_TEMPLATE = "v2";
  try {
    const ref = await create([FIXED]);
    assert.equal((await rowOf(ref)).quote.template_version, "v2");
    assert.equal((await rowOf(ref)).quote.doc, undefined, "بلا لقطة لورقة لا تحتاجها");
    assert.match((await call("quote-view", { ref })).html, /data-bp-doc="v2" data-kind="quote"/);
    process.env.BP_DOCS_TEMPLATE = "v1";
    const r1 = await create([FIXED]);
    assert.equal((await rowOf(r1)).quote.template_version, "v1");
  } finally { delete process.env.BP_DOCS_QUOTE_TEMPLATE; delete process.env.BP_DOCS_TEMPLATE; }
  for (const lang of ["fr", "zh"]) { const r = await create([FIXED], { lang }); assert.equal((await rowOf(r)).quote.template_version, "v1", lang); }
  const en = await create([FIXED], { lang: "en" });
  assert.equal((await rowOf(en)).quote.template_version, "v3", "الإنجليزية v3 (الورقة ثنائية اللغة دائماً)");
});

test("ما بلا سعر يبقى على التسعير البشري كما اليوم: لا عرض آلي لبندٍ بلا سعر كتالوج، ولا ورقة بسعر صفر", async () => {
  const ref = await create([{ code: "", title: "خدمة كتبها العميل بنفسه", qty: 1 }], { auto_quote: false });
  const c = await call("scope-confirm", { ref, scope: [{ code: "", title: "خدمة كتبها العميل بنفسه", qty: 1 }] });
  assert.equal(c.stage, "PRICING"); assert.equal((await rowOf(ref)).quote, undefined);
  const bad = await ops("ops-quote", { ref, items: [{ title: "خدمة", price: 0, qty: 1 }] });
  assert.equal(bad.error, "unpriced_items");
});
