// اتفاقية عدم الإفصاح المتبادلة على الطلب (api/_simple.js ← ops-nda / nda-view / nda-sign).
// كان ndaDocV2 (api/_bp-docs-v2.js) لا يستدعيه أي مسار. الاتفاقية اختيارية: يصدرها الفريق من /ops،
// أو تصدر آلياً قبل العرض لخدمات NDA_REQUIRED_SERVICES وحدها (الافتراضي فارغ)، ولا تعطّل أي طلب.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DBDIR = fs.mkdtempSync(path.join(os.tmpdir(), "bp-nda-flow-"));
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const future = new Date(Date.now() + 864e5).toISOString();
const now = new Date().toISOString();
const TOK = { a: "tok-a-nda", b: "tok-b-nda", sales: "tok-sales-nda" };
const EMAIL = { a: "nda.client@example.com", b: "nda.other@example.com", sales: "nda.sales@example.com" };

fs.writeFileSync(path.join(DBDIR, "db.json"), JSON.stringify({
  users: [
    { id: "u-a", email: EMAIL.a, full_name: "أحمد العميل", phone: "+966501234567", locale: "ar" },
    { id: "u-b", email: EMAIL.b, full_name: "خالد آخر", phone: "+966507654321", locale: "ar" },
    { id: "u-sales", email: EMAIL.sales, full_name: "عضو المبيعات", locale: "ar" },
  ],
  organizations: [{ id: "org-a", name_ar: "شركة أحمد", created_at: now }, { id: "org-b", name_ar: "شركة خالد", created_at: now }, { id: "org-s", name_ar: "المبيعات", created_at: now }],
  user_sessions: [
    { id: "s-a", user_id: "u-a", organization_id: "org-a", token_hash: sha(TOK.a), revoked_at: null, expires_at: future },
    { id: "s-b", user_id: "u-b", organization_id: "org-b", token_hash: sha(TOK.b), revoked_at: null, expires_at: future },
    { id: "s-s", user_id: "u-sales", organization_id: "org-s", token_hash: sha(TOK.sales), revoked_at: null, expires_at: future },
  ],
  requests: [], request_events: [], tasks: [],
}, null, 2));

process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = DBDIR;
process.env.SIMPLE_TEST_MODE = "1";
process.env.EMAIL_MODE = "preview";
process.env.WHATSAPP_MODE = "mock";
for (const k of ["RESEND_API_KEY", "RESEND_KEY", "DAFTRA_API_KEY", "WHATSAPP_TOKEN", "SIMPLE_NOTIFY", "SIMPLE_AUTO_QUOTE", "NDA_REQUIRED_SERVICES", "BP_DOCS_TEMPLATE"]) delete process.env[k];
process.env.SALES_TEAM_EMAILS = EMAIL.sales;
globalThis.fetch = async (u) => { throw new Error("no network in tests: " + u); };

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
const { handleSimple, buildNda } = await import("../api/_simple.js");
const { sb } = await import("../api/_db.js");

async function call(action, body = {}, who = "a", { key } = {}) {
  const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(s) { this.body = s; } };
  await handleSimple({ method: "POST", body: { action, ...(key ? { key } : {}), ...body }, query: {}, headers: { cookie: who ? `bp_sid=${TOK[who]}` : "", "user-agent": "test" }, socket: {} }, res);
  return { http: res.statusCode, ...JSON.parse(res.body || "{}") };
}
const ops = (action, body = {}) => call(action, body, null, { key: "test-ops" });
const rowOf = async (ref) => (await sb(`requests?ref=eq.${encodeURIComponent(ref)}&select=*&limit=1`))[0];
const eventsOf = async (ref) => (await sb(`request_events?request_id=eq.${(await rowOf(ref)).id}&select=event,actor_kind`)).map((e) => e.event);
const FIXED = { code: "BP-SBC-01", title: "x", qty: 1 };
const SEED = [{ code: "", title: "حشو", qty: 1, seed: true }];
async function create(scope = [FIXED, ...SEED], extra = {}) {
  const r = await call("request-create", { type: "GOVERNMENT_SERVICE", title: "خدمة سرّية", scope, auto_quote: true, ...extra });
  assert.equal(r.ok, true, JSON.stringify(r));
  return r.ref;
}
const PARTY = { client_reg_no: "1010123456", client_address: "الرياض", signatory_name: "أحمد العميل", signatory_title: "المدير العام" };

test("الفريق يصدر الاتفاقية من اللوحة، فتظهر للعميل بغلافها وبياناتها", async () => {
  const ref = await create();
  const out = await ops("ops-nda", { ref, ...PARTY });
  assert.equal(out.ok, true); assert.equal(out.nda.status, "SENT"); assert.equal(out.nda.template_version, "v2");
  assert.equal(out.nda.html, undefined, "الردّ بلا نصّ الورقة");
  const row = await rowOf(ref);
  assert.ok(row.nda.html.includes('data-bp-doc="v2"') && row.nda.html.includes('data-kind="nda"'), "ورقة القالب v2");
  assert.ok(row.nda.html.includes("NON-DISCLOSURE") && row.nda.html.includes("1010123456"), "بياناتها");
  assert.ok(row.nda.build.company && row.nda.build.company.nameAr, "لقطة الشركة محفوظة");
  const v = await call("nda-view", { ref });
  assert.equal(v.ok, true); assert.ok(v.html.includes("اتفاقية عدم الإفصاح"), "الغلاف");
  assert.ok(!v.html.includes("/sig1/"), "لا مراسي توقيع ظاهرة");
  assert.equal(v.nda.html, undefined);
  const mine = (await call("request-get", { ref })).request;
  assert.equal(mine.nda.number, row.nda.number); assert.equal(mine.nda.html, undefined, "clientView بلا النص");
  assert.equal((await call("me")).requests.find((r) => r.ref === ref).nda.status, "SENT", "في قائمة العميل");
  assert.ok((await eventsOf(ref)).includes("nda.sent"));
  assert.equal((await ops("ops-request", { ref })).request.nda.html, undefined, "ولا يتسرّب نصّها من ops-request");
  assert.ok((await ops("ops-nda-html", { ref })).html.includes("NON-DISCLOSURE"), "والفريق يقرؤها بـops-nda-html");
});

test("العميل يوقّعها بآلية العقد: اسم + رسم + موافقة، وبصمة SHA-256 للبايتات المخزَّنة", async () => {
  const ref = await create();
  await ops("ops-nda", { ref });
  assert.equal((await call("nda-sign", { ref, name: "أحمد العميل" })).error, "consent_required", "لا توقيع بلا موافقة صريحة");
  const img = "data:image/png;base64," + "A".repeat(200);
  const s = await call("nda-sign", { ref, consent: true, name: "أحمد العميل", signature: img });
  assert.equal(s.ok, true); assert.equal(s.nda.status, "SIGNED");
  const row = await rowOf(ref);
  assert.equal(row.nda.status, "SIGNED");
  assert.equal(row.nda.signature.name, "أحمد العميل"); assert.equal(row.nda.signature.image, img); assert.equal(row.nda.signature.email, EMAIL.a);
  assert.equal(row.nda.signature.doc_sha256, sha(row.nda.html), "بصمة الورقة المخزَّنة");
  assert.equal(row.nda.signature.template_version, "v2");
  assert.ok((await eventsOf(ref)).includes("nda.signed"));
});

test("لا توقيعان: الثاني مرفوض (حتى المتزامن)، وما وُقّع لا يُستبدل بإصدار جديد", async () => {
  const ref = await create();
  await ops("ops-nda", { ref });
  const [x, y] = await Promise.all([call("nda-sign", { ref, consent: true, signature: "data:image/png;base64," + "A".repeat(200), name: "أحمد العميل" }), call("nda-sign", { ref, consent: true, name: "أحمد العميل", signature: "data:image/png;base64," + "A".repeat(200) })]);
  assert.equal([x, y].filter((r) => r.ok).length, 1, "توقيع واحد ينجح");
  assert.equal([x, y].find((r) => !r.ok).error, "already_signed");
  const hash = (await rowOf(ref)).nda.signature.doc_sha256;
  assert.equal((await call("nda-sign", { ref, consent: true, signature: "data:image/png;base64," + "A".repeat(200), name: "غيره" })).http, 409);
  assert.equal((await ops("ops-nda", { ref })).http, 409, "الفريق لا يعيد إصدار الموقَّعة");
  assert.equal((await rowOf(ref)).nda.signature.doc_sha256, hash, "التوقيع الأول باقٍ");
});

test("غير الموقَّعة تُستبدل بإصدار مصحَّح بنفس الرقم، ولا توقيع بلا اتفاقية", async () => {
  const ref = await create();
  assert.equal((await call("nda-sign", { ref, consent: true, signature: "data:image/png;base64," + "A".repeat(200), name: "أ" })).error, "no_open_nda");
  assert.equal((await call("nda-view", { ref })).http, 404);
  const a = await ops("ops-nda", { ref, client_address: "الرياض" });
  const b = await ops("ops-nda", { ref, client_address: "جدة" });
  assert.equal(a.nda.number, b.nda.number);
  assert.ok((await rowOf(ref)).nda.html.includes("جدة"));
});

test("لا تظهر لعميل آخر ولا يوقّعها، ولا يصدرها إلا الفريق", async () => {
  const ref = await create();
  await ops("ops-nda", { ref });
  for (const [action, body] of [["nda-view", {}], ["nda-sign", { consent: true, signature: "data:image/png;base64," + "A".repeat(200), name: "x" }]]) assert.equal((await call(action, { ref, ...body }, "b")).http, 404, action);
  assert.equal((await rowOf(ref)).nda.status, "SENT");
  assert.equal((await call("me", {}, "b")).requests.some((r) => r.ref === ref), false);
  assert.equal((await call("ops-nda", { ref }, "a")).http, 401, "العميل لا يصدرها بنفسه");
  assert.equal((await call("ops-nda", { ref }, null)).http, 401);
  assert.equal((await call("ops-nda", { ref }, null, { key: "bad" })).http, 401);
  const sales = await call("ops-nda", { ref }, "sales");
  assert.equal(sales.http, 403); assert.equal(sales.error, "forbidden_role");
  assert.equal((await call("nda-view", { ref }, null)).http, 401);
});

test("ثبات القالب: الورقة تُحفظ كما طُبعت ولا تُعاد بناؤها بالأحدث، والمبنيّ من الحزمة المخزَّنة يطابقها", async () => {
  const ref = await create();
  await ops("ops-nda", { ref, ...PARTY });
  const stored = (await rowOf(ref)).nda;
  // مفتاح القالب القديم لا يمسّ ورقةً صدرت، ولا يمنع إصدار اتفاقية (لا نسخة v1 لها)
  process.env.BP_DOCS_TEMPLATE = "v1";
  try {
    assert.equal((await call("nda-view", { ref })).html.includes("NON-DISCLOSURE"), true);
    assert.equal((await rowOf(ref)).nda.html, stored.html, "البايتات المخزَّنة لم تتغير");
    // إعادة البناء بحزمتها المخزَّنة (قالبها + لقطة الشركة + تاريخها) تعطي الورقة نفسها بالحرف
    const row = await rowOf(ref);
    const again = buildNda(row, { ...stored.build, template_version: stored.template_version, at: stored.created_at });
    assert.equal(again.html, stored.html, "حتى لو تغيّر اليوم وبيانات الشركة الحيّة");
  } finally { delete process.env.BP_DOCS_TEMPLATE; }
  // الوقّع على ما قرأه
  await call("nda-sign", { ref, consent: true, signature: "data:image/png;base64," + "A".repeat(200), name: "أحمد العميل" });
  assert.equal((await rowOf(ref)).nda.signature.doc_sha256, sha(stored.html));
  // قالبٌ لا وجود له لا يُبنى بصمت بغيره
  assert.throws(() => buildNda(row0(), { template_version: "v99" }), /no_nda_template/);
  function row0() { return { ref: "BP-R-AAAAAA", title: "x", client_email: "a@b.co", client_name: "أحمد العميل", lang: "ar" }; }
});

test("بلا اتفاقية لا يتعطل شيء: الرحلة كاملة، وغير الموقَّعة لا تمنع العرض ولا العقد ولا الدفع", async () => {
  const plain = await create();
  assert.equal((await rowOf(plain)).nda || null, null, "الافتراضي: لا اتفاقية آلية");
  const withNda = await create();
  await ops("ops-nda", { ref: withNda });
  for (const ref of [plain, withNda]) {
    assert.equal((await rowOf(ref)).status, "QUOTE_SENT");
    assert.equal((await call("quote-approve", { ref })).status, "CONTRACT_SENT");
    assert.equal((await call("contract-sign", { ref, consent: true, signature: "data:image/png;base64," + "A".repeat(200), name: "أحمد العميل" })).status, "SIGNED");
    assert.equal((await call("pay-test", { ref, outcome: "success", provider: "card" })).status, "PAID");
  }
  assert.equal((await rowOf(withNda)).nda.status, "SENT", "اتفاقيتها بقيت غير موقَّعة وما عطّلت شيئاً");
});

test("NDA_REQUIRED_SERVICES: تصدر آلياً قبل العرض للخدمات المذكورة وحدها", async () => {
  process.env.NDA_REQUIRED_SERVICES = " bp-sbc-01 , BP-NOPE ";
  try {
    const hit = await create([FIXED, ...SEED]);
    const row = await rowOf(hit);
    assert.ok(row.nda && row.nda.status === "SENT", "صدرت آلياً");
    assert.ok(row.quote && row.status === "QUOTE_SENT", "والعرض صدر بعدها (لا بوابة)");
    const ev = await sb(`request_events?request_id=eq.${row.id}&select=event,created_at&order=created_at.asc`);
    assert.ok(ev.findIndex((e) => e.event === "nda.sent") < ev.findIndex((e) => e.event === "quote.sent"), "قبل العرض");
    const miss = await create([{ code: "BP-AI-02", title: "اشتراك", qty: 1 }]);
    assert.equal((await rowOf(miss)).nda || null, null, "خدمة غير مذكورة: لا اتفاقية");
    const seedOnly = await call("request-create", { type: "GOVERNMENT_SERVICE", title: "حشو", scope: [...SEED] });
    assert.equal((await rowOf(seedOnly.ref)).nda || null, null, "ولا لبنود الحشو");
    // لا تتكرر: اعتماد النطاق ثانيةً لا يصدر اتفاقية ثانية
    const n = (await eventsOf(hit)).filter((e) => e === "nda.sent").length;
    assert.equal(n, 1);
  } finally { delete process.env.NDA_REQUIRED_SERVICES; }
  const off = await create([FIXED, ...SEED]);
  assert.equal((await rowOf(off)).nda || null, null, "ومتغيّر فارغ: لا شيء");
});

test("طلب ملغى أو مغلق لا تُصدر عليه اتفاقية ولا توقَّع", async () => {
  const ref = await create();
  await ops("ops-nda", { ref });
  await call("request-cancel", { ref });
  assert.equal((await ops("ops-nda", { ref })).http, 409);
  const ref2 = await create();
  await ops("ops-nda", { ref: ref2 });
  await sb(`requests?ref=eq.${ref2}`, { method: "PATCH", body: { status: "CANCELLED" } });
  assert.equal((await call("nda-sign", { ref: ref2, consent: true, signature: "data:image/png;base64," + "A".repeat(200), name: "x" })).http, 409);
});
