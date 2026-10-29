// إعادة فحص الرحلة (2026-10-23): (أ) بنود المستشار العامة حشو، (ب) إنشاء بمعرّف مسودة لا يكرّر الطلب ولا يُنشئ فارغاً،
// (ج) عناوين الخط الزمني، (د) العرض بلغة الطلب، (هـ) إصدار الاتفاقية مرة، (و) غلاف العرض بالمسعّر فقط.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DBDIR = fs.mkdtempSync(path.join(os.tmpdir(), "bp-journey-fix2-"));
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const future = new Date(Date.now() + 864e5).toISOString();
const now = new Date().toISOString();
const TOK = { a: "tok-a-jf2", b: "tok-b-jf2" };
fs.writeFileSync(path.join(DBDIR, "db.json"), JSON.stringify({
  users: [
    { id: "u-a", email: "jf2.a@example.com", full_name: "أحمد العميل", phone: "+966501234567", locale: "ar" },
    { id: "u-b", email: "jf2.b@example.com", full_name: "خالد آخر", phone: "+966507654321", locale: "ar" },
  ],
  organizations: [{ id: "org-a", name_ar: "شركة أحمد", created_at: now }, { id: "org-b", name_ar: "شركة خالد", created_at: now }],
  user_sessions: [
    { id: "s-a", user_id: "u-a", organization_id: "org-a", token_hash: sha(TOK.a), revoked_at: null, expires_at: future },
    { id: "s-b", user_id: "u-b", organization_id: "org-b", token_hash: sha(TOK.b), revoked_at: null, expires_at: future },
  ],
  requests: [], request_events: [], tasks: [],
}, null, 2));
process.env.LOCAL_DB = "1"; process.env.LOCAL_DB_DIR = DBDIR; process.env.SIMPLE_TEST_MODE = "1";
process.env.EMAIL_MODE = "preview"; process.env.WHATSAPP_MODE = "mock";
for (const k of ["RESEND_API_KEY", "RESEND_KEY", "DAFTRA_API_KEY", "WHATSAPP_TOKEN", "SIMPLE_NOTIFY", "SIMPLE_AUTO_QUOTE", "NDA_REQUIRED_SERVICES", "BP_DOCS_TEMPLATE"]) delete process.env[k];
globalThis.fetch = async (u) => { throw new Error("no network in tests: " + u); };

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
const { handleSimple } = await import("../api/_simple.js");
const { ADVISOR_FILLER_TITLES, isSeedTitle } = await import("../api/_scope-seeds.js");
const { sb } = await import("../api/_db.js");

async function call(action, body = {}, who = "a", { key } = {}) {
  const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(s) { this.body = s; } };
  await handleSimple({ method: "POST", body: { action, ...(key ? { key } : {}), ...body }, query: {}, headers: { cookie: who ? `bp_sid=${TOK[who]}` : "", "user-agent": "test" }, socket: {} }, res);
  return { http: res.statusCode, ...JSON.parse(res.body || "{}") };
}
const ops = (action, body = {}) => call(action, body, null, { key: "test-ops" });
const rowOf = async (ref) => (await sb(`requests?ref=eq.${encodeURIComponent(ref)}&select=*&limit=1`))[0];
const eventsOf = async (ref) => (await sb(`request_events?request_id=eq.${(await rowOf(ref)).id}&select=event`)).map((e) => e.event);
const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), "utf8");
const PRICED = { code: "BP-SBC-01", title: "تأسيس شركة سعودية", qty: 1 };
const PERCENT = { code: "BP-REC-04", title: "الاستقطاب التنفيذي", qty: 1 };
async function create(scope, extra = {}, who = "a") {
  const r = await call("request-create", { type: "COMPANY_FORMATION", title: "طلب", scope, auto_quote: true, ...extra }, who);
  assert.equal(r.ok, true, JSON.stringify(r));
  return r.ref;
}

// ===================================================== (أ) بنود المستشار العامة حشو ==
test("بنود المستشار العامة («تحديد مسار التأسيس المناسب»…) حشو: لا تُعدّ بنداً كتبه العميل ولا تفتح مهمة تسعير", async () => {
  const ref = await create([PRICED, { code: "", title: "تحديد مسار التأسيس المناسب", qty: 1 }, { code: "", title: "تجهيز متطلبات ووثائق التأسيس", qty: 1 }, { code: "", title: "إجراءات التأسيس والتسجيلات الحكومية الأساسية", qty: 1 }]);
  const row = await rowOf(ref);
  assert.equal(row.status, "QUOTE_SENT");
  assert.equal(row.quote.pending_items, undefined, "ليست بنوداً منتظرة");
  assert.deepEqual(row.quote.items.map((i) => i.code), ["BP-SBC-01"]);
  assert.equal((await sb(`tasks?request_id=eq.${row.id}&source=eq.pricing&select=id`)).length, 0, "ولا مهمة «تسعير نطاق» للمالك");
  assert.ok(!JSON.stringify(row.scope).includes("hold"), "ولا تُوسَم «بند كتبتَه بنفسك»");
});

test("قائمة بنود المستشار لا تنحرف عن api/chat.js، وبنودٌ حقيقية تشبهها لا تُبتلع", () => {
  const chat = read("../api/chat.js");
  assert.ok(ADVISOR_FILLER_TITLES.length >= 12);
  for (const t of ADVISOR_FILLER_TITLES) assert.ok(chat.includes(JSON.stringify(t)), "موجود في presets المستشار: " + t);
  assert.equal(isSeedTitle("تأسيس شركة سعودية"), false, "اسم خدمة كتالوج ليس حشواً");
  assert.equal(isSeedTitle("ترجمة عقد خاصة"), false);
});

// ============================================= (ب) الإنشاء بمعرّف مسودة، ولا إنشاء فارغ ==
test("المعرّف نفسه يُعيد الطلب نفسه: تبويبان أو إعادة تحميل أو نقرتان لا تنشئ طلباً ولا عرضاً ثانياً", async () => {
  const draft_id = "pid-" + Date.now();
  const first = await call("request-create", { type: "COMPANY_FORMATION", title: "ط", scope: [PRICED], auto_quote: true, draft_id });
  assert.equal(first.ok, true); assert.ok(!first.duplicate);
  const again = await call("request-create", { type: "COMPANY_FORMATION", title: "ط", scope: [PRICED], auto_quote: true, draft_id });
  assert.equal(again.ok, true); assert.equal(again.ref, first.ref); assert.equal(again.duplicate, true);
  assert.equal((await sb(`requests?client_email=eq.jf2.a@example.com&title=eq.${encodeURIComponent("ط")}&select=ref`)).length, 1, "صفٌّ واحد");
  assert.equal((await eventsOf(first.ref)).filter((e) => e === "quote.sent").length, 1, "وعرضٌ واحد");
  // نقرتان متزامنتان
  const id2 = "pid2-" + Date.now();
  const [x, y] = await Promise.all([1, 2].map(() => call("request-create", { type: "COMPANY_FORMATION", title: "ط2", scope: [PRICED], auto_quote: true, draft_id: id2 })));
  assert.equal(x.ok && y.ok, true); assert.equal(x.ref, y.ref);
  assert.equal((await sb(`requests?title=eq.${encodeURIComponent("ط2")}&select=ref`)).length, 1);
  // عميلٌ آخر بالمعرّف نفسه يحصل على طلبه هو
  const other = await call("request-create", { type: "COMPANY_FORMATION", title: "ط", scope: [PRICED], auto_quote: true, draft_id }, "b");
  assert.equal(other.ok, true); assert.notEqual(other.ref, first.ref);
  assert.equal((await rowOf(other.ref)).client_email, "jf2.b@example.com");
  // وبعد أن يلغي العميل طلبه (مخفيّ) يبدأ المعرّف نفسه طلباً جديداً لا يعيد المخفيّ
  await call("request-cancel", { ref: first.ref });
  const fresh = await call("request-create", { type: "COMPANY_FORMATION", title: "ط", scope: [PRICED], auto_quote: true, draft_id });
  assert.equal(fresh.ok, true); assert.notEqual(fresh.ref, first.ref);
});

test("إنشاء عرض بلا بنود يُرفض ولا ينشئ صفاً: «رجوع ثم إنشاء» لا يفتح استشارة فارغة", async () => {
  const before = (await sb("requests?select=ref")).length;
  for (const body of [{ scope: [] }, { scope: [{ code: "", title: "فحص المشكلة أو المعاملة", qty: 1, seed: true }] }, { scope: [{ code: "", title: "Examine the problem or the transaction", qty: 1 }] }]) {
    for (const extra of [{ auto_quote: true }, { draft_id: "d-" + Math.random() }]) {
      const r = await call("request-create", { type: "CONSULTATION", title: "استشارة", ...body, ...extra });
      assert.equal(r.http, 400); assert.equal(r.error, "no_items"); assert.ok(r.message.includes("أضف خدمة"));
    }
  }
  assert.equal((await sb("requests?select=ref")).length, before, "لم يُنشأ شيء");
  // كلام العميل نفسه (محادثة أو ملخّص) طلبٌ حقيقي، والإنشاء العادي بلا auto_quote كما كان
  const talk = await call("request-create", { type: "CONSULTATION", title: "استشارة", scope: [], auto_quote: true, conversation: [{ role: "user", content: "أريد استشارة في التأسيس" }] });
  assert.equal(talk.ok, true);
  const plain = await call("request-create", { type: "CONSULTATION", title: "عادي", scope: [] });
  assert.equal(plain.ok, true);
});

test("الصفحة: معرّف المسودة يُرسَل مع الإنشاء، ورسالة الخادم تُعرض للعميل", () => {
  const flow = read("../site/scripts/sv1-quote-auth-flow.mjs");
  assert.ok(flow.includes("draft_id:draftId()") && flow.includes("function draftId()") && flow.includes("p.pid"), "معرّف المسودة المشترك بين التبويبات");
  assert.ok(flow.includes("alert(e&&e.message&&e.message!=='request_failed'?e.message:LABELS.error)"), "رسالة الخادم");
});

// =============================================== (ج) عناوين الخط الزمني مفهومة ==
test("الخط الزمني: nda.sent وnda.signed وaddendum.* لها عناوين عربية وإنجليزية (لا مفاتيح خام)", async () => {
  const my = read("../site/scripts/simple-v1-my.mjs");
  const ops_ = read("../site/scripts/simple-v1-ops.mjs");
  for (const k of ["nda.sent", "nda.signed", "addendum.sent", "addendum.approved", "addendum.rejected"]) {
    assert.ok(my.includes(`Object.assign(EVENTS.ar,`) && new RegExp(`EVENTS\\.ar, \\{[^}]*"${k.replace(".", "\\.")}": "[^"]*[\\u0600-\\u06FF]`).test(my), "عربي في /my: " + k);
    assert.ok(new RegExp(`EVENTS\\.en, \\{[^}]*"${k.replace(".", "\\.")}": "[a-z]`).test(my), "إنجليزي في /my: " + k);
    assert.ok(ops_.includes(`'${k}':'`), "في /ops: " + k);
  }
  // كل حدث يكتبه المحرّك ويراه العميل له عنوان (لا مفتاح خام)
  const src = read("../api/_simple.js");
  const written = new Set([...src.matchAll(/logEvent\([^,]+,\s*(?:"[a-z]+"|actorKind|[a-zA-Z]+),\s*[^,]+,\s*"([a-z]+\.[a-z.]+)"/g)].map((m) => m[1]));
  for (const k of ["nda.sent", "nda.signed", "addendum.sent", "addendum.approved", "addendum.rejected"]) assert.ok(written.has(k) || src.includes(`"${k}"`) || src.includes(`approve ? "addendum.approved"`), "الحدث يُكتب: " + k);
});

// ==================================================== (د) العرض بلغة الطلب ==
test("عرض بالإنجليزية: اسم الكتالوج الإنجليزي، وملاحظات وشروط بالإنجليزية، ولا جملة عربية من النظام", async () => {
  const ref = await create([PRICED, PERCENT], { lang: "en" });
  const row = await rowOf(ref);
  assert.equal(row.lang, "en"); assert.ok(row.quote.items[0].titleEn, "titleEn محفوظ من الكتالوج");
  const view = await call("quote-view", { ref });
  assert.ok(view.html.includes(row.quote.items[0].titleEn), "اسم الخدمة الإنجليزي في المستند");
  assert.ok(view.html.includes("Lines awaiting a price"), "قسم المنتظرة بالإنجليزية");
  assert.ok(view.html.includes("Payment in advance after the contract is signed"), "شروط الدفع بالإنجليزية");
  // القالب v3 ثنائي اللغة دائماً (قرار المالك 2026-10-29): كل جملة نظام بلغتين في صفٍّ واحد، العربية يميناً
  assert.ok(view.html.includes("بنود بانتظار التسعير") && view.html.includes("الدفع مقدماً بعد توقيع العقد"), "والجملة العربية في عمودها المقابل");
  const seen = (await call("request-get", { ref })).request;
  assert.equal(seen.scope.find((x) => x.code === "BP-SBC-01").titleEn, row.quote.items[0].titleEn, "والصفحة تحصل على الاسم الإنجليزي لسطر النطاق");
  const my = read("../site/scripts/simple-v1-my.mjs");
  assert.ok(my.includes("function nmOf(i)") && my.includes("LANG!=='ar'&&i&&i.titleEn"), "وتعرضه في الصفحة الإنجليزية");
  // الفرنسية (القالب القديم): لا وصف عربي في عمود فرنسي
  const fr = await create([PRICED], { lang: "fr" });
  const v2 = await call("quote-view", { ref: fr });
  const desc = (await rowOf(fr)).quote.items[0].description;
  assert.ok(desc && !v2.html.includes(desc), "وصف الكتالوج العربي لا يُطبع في عرض فرنسي");
  assert.ok(read("../api/_quotes.js").includes('lang !== "ar" && (it.titleEn || it.nameEn)'), "ومستند الروابط القديمة يفضّل الاسم الإنجليزي");
});

// ================================================== (هـ) إصدار الاتفاقية مرة واحدة ==
test("ضغطتان على «إصدار NDA» تُسجّلان حدثاً واحداً: بالتتابع وبالتزامن؛ وتغيير البيانات يستبدلها", async () => {
  const ref = await create([PRICED]);
  const a = await ops("ops-nda", { ref, client_address: "الرياض" });
  const b = await ops("ops-nda", { ref, client_address: "الرياض" });
  assert.equal(a.ok && b.ok, true);
  assert.equal((await eventsOf(ref)).filter((e) => e === "nda.sent").length, 1, "حدث واحد بعد ضغطتين");
  const ref2 = await create([PRICED]);
  await Promise.all([ops("ops-nda", { ref: ref2 }), ops("ops-nda", { ref: ref2 })]);
  assert.equal((await eventsOf(ref2)).filter((e) => e === "nda.sent").length, 1, "وبالتزامن");
  const c = await ops("ops-nda", { ref, client_address: "جدة" });
  assert.equal(c.ok, true);
  assert.equal((await eventsOf(ref)).filter((e) => e === "nda.sent").length, 2, "بيانات مختلفة: إصدار مصحَّح");
  assert.ok((await rowOf(ref)).nda.html.includes("جدة"));
});

// =============================== (و) غلاف العرض والعقد يذكر المسعَّر وحده ==
test("غلاف العرض والعقد لطلبٍ فيه بند منتظر يذكر خدمات البنود المسعّرة فقط", async () => {
  const ref = await create([PRICED, PERCENT], { title: "تأسيس شركة سعودية + الاستقطاب التنفيذي" });
  const row = await rowOf(ref);
  assert.equal(row.quote.service, "تأسيس شركة سعودية", "الخدمة المسجّلة بالمسعّر");
  const view = await call("quote-view", { ref });
  const cut = view.html.indexOf("Lines awaiting a price");
  assert.ok(cut > 0 && !view.html.slice(0, cut).includes("الاستقطاب التنفيذي"), "لا الغلاف ولا جدول البنود يذكرانه، وهو في قسم المنتظرة فقط");
  assert.ok(view.html.slice(cut).includes("الاستقطاب التنفيذي"));
  await call("quote-approve", { ref });
  const contract = (await rowOf(ref)).contract.html;
  assert.ok(!contract.includes("الاستقطاب التنفيذي"), "ولا العقد (غلافه وبنوده)");
  // وبعد الملحق لا يتبدّل نصّ العقد الصادر (لا «يلزم توقيع جديد»)
  await ops("ops-quote-addendum", { ref, items: [{ pending_title: "الاستقطاب التنفيذي", price: 900 }] });
  const v = await call("contract-view", { ref });
  assert.equal(v.needsResign, false);
  assert.equal((await rowOf(ref)).contract.html, contract);
  // وطلبٌ بلا بند منتظر يبقى بعنوان الطلب كما كان
  const plain = await create([PRICED], { title: "عنوان الطلب الخاص" });
  assert.equal((await rowOf(plain)).quote.service, undefined);
});
