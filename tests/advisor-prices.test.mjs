// ‏المستشار الذكي (api/chat.js): الأسعار للمسجّلين فقط، وخدمة تطوير الأعمال مخفية.
//
// قرار المالك: SHOW_PRICES=false — صفحات الموقع تخفي السعر عن الزائر، لكن chat.js كان يحقن «الأسعار
// الحية» في تعليمات كل محادثة عامة فيقولها النموذج لزائرٍ بلا حساب. وخدمة تطوير الأعمال (Revenue OS،
// REV-*) مخفية بقرار المالك (site/data/hidden.json) وكان المستشار ما زال يعرضها في الرد والباب.
//
// بلا شبكة: fetch مُقلَّد (Azure وn8n)، والجلسة من api/_db.js فعلاً (LOCAL_DB=1 → ملف JSON مؤقّت).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const DBDIR = fs.mkdtempSync(path.join(os.tmpdir(), "bp-advisor-prices-"));
// حالات «تطوير الأعمال مخفية» لا تُختبر إلا حين تكون صفحتها مخفية في site/data/hidden.json (يتبعه المستشار: api/chat.js).
const BD_HIDDEN = (() => { try { return (JSON.parse(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), "..", "site/data/hidden.json"), "utf8")).pages || []).includes("business-development"); } catch { return true; } })();
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const future = new Date(Date.now() + 86400000).toISOString();
fs.writeFileSync(path.join(DBDIR, "db.json"), JSON.stringify({
  users: [{ id: "u-client", email: "client@example.com", full_name: "عميل", locale: "ar" }],
  organizations: [{ id: "org-client", name_ar: "شركة العميل", created_at: new Date().toISOString() }],
  user_sessions: [
    { id: "s-ok", user_id: "u-client", organization_id: "org-client", token_hash: sha("sid-client"), revoked_at: null, expires_at: future },
    { id: "s-revoked", user_id: "u-client", organization_id: "org-client", token_hash: sha("sid-revoked"), revoked_at: new Date().toISOString(), expires_at: future },
  ],
  audit_logs: [],
}));

// ‏تُضبط قبل الاستيراد: الوحدات تقرأ البيئة وقت التحميل.
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = DBDIR;
process.env.WHATSAPP_MODE = "live";
process.env.PANEL_KEY = "k-test-panel";
process.env.AZURE_OPENAI_ENDPOINT = "https://bp-ai.openai.azure.com";
process.env.AZURE_OPENAI_KEY = "test-key";
process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-test";
delete process.env.APP_ENV;
delete process.env.BP_HIDDEN_FILE;

import test from "node:test";
import assert from "node:assert/strict";

const AZ = "https://bp-ai.openai.azure.com/openai/v1/chat/completions";
const N8N = "businesspartnerai.app.n8n.cloud";
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const azureOk = (text) => json({ choices: [{ message: { content: text } }] });

function stub(handler) {
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const u = String(url && url.url ? url.url : url);
    calls.push({ url: u, body: opts && opts.body ? JSON.parse(opts.body) : null });
    return handler(u, calls.length);
  };
  return { calls, restore: () => { globalThis.fetch = real; } };
}

async function ask(body, cookie) {
  const { default: handler } = await import("../api/chat.js");
  let out = "";
  const res = { statusCode: 0, setHeader() {}, end(s) { out = s; } };
  await handler({ method: "POST", body, headers: cookie ? { cookie } : {} }, res);
  return { status: res.statusCode, json: JSON.parse(out) };
}
const turn = (role, content) => ({ role, content });
const sysOf = (f) => f.calls.find((c) => c.url.startsWith(AZ)).body.messages[0].content;
const azureStub = (text) => stub((u) => (u.startsWith(AZ) ? azureOk(text) : json({}, 500)));

const GUEST = undefined;
const CLIENT = "bp_sid=sid-client";
const ASK_PRICE = [turn("user", "كم سعر تأسيس شركة ذات مسؤولية محدودة؟")];

// ‏سطر سعر في قائمة الكتالوج الحيّة: «- BP-XXX الاسم — 7,500 ﷼»
const PRICE_LINE = /^- (?:BP|REV)-\S+ .+ — /m;

async function catalog() { return (await import("../api/_catalog.js")).loadCatalog(); }

// ───────────────────────────── ١) الزائر بلا جلسة: لا سعر في التعليمات ─────────────────────────────

test("الزائر بلا جلسة: لا قائمة أسعار حيّة في التعليمات، وفيها سياسة «السعر يظهر بعد تسجيل الدخول»", async () => {
  const f = azureStub("أهلاً");
  try {
    const r = await ask({ messages: ASK_PRICE }, GUEST);
    assert.equal(r.status, 200);
    const sys = sysOf(f);
    assert.doesNotMatch(sys, /الأسعار الحية من كتالوج الموقع/, "قائمة الأسعار الحية لا تُحقن للضيف");
    assert.doesNotMatch(sys, PRICE_LINE, "لا سطر سعر على شكل قائمة الكتالوج");
    assert.match(sys, /السعر يظهر بعد تسجيل الدخول/);
    assert.match(sys, /businesspartner\.sa\/ar\/my/, "رابط الدخول");
    assert.match(sys, /wa\.me\/966530540231/, "الإحالة البشرية للطلب باقية");
    assert.equal(r.json.pricesHidden, true);
    assert.equal(r.json.loginUrl, "https://www.businesspartner.sa/ar/my");
  } finally { f.restore(); }
});

test("الزائر بلا جلسة: لا يصل إلى النموذج أي سعر من الكتالوج (لا أتعابنا ولا الباقات)", async () => {
  const cat = await catalog();
  const f = azureStub("أهلاً");
  try {
    // ‏سؤال عن باقات وتأسيس: يفتح أوسع قائمة ممكنة للضيف.
    await ask({ messages: [turn("user", "ما أسعار الباقات وتأسيس الشركات وقيد مؤسسة فردية؟")] }, GUEST);
    const sys = sysOf(f);
    const leaked = [];
    for (const p of cat.packages) if (p.priceAr && sys.includes(p.priceAr)) leaked.push(`${p.nameAr}: ${p.priceAr}`);
    for (const s of cat.services) if (s.priceLabel && /\d/.test(s.priceLabel) && sys.includes(`${s.code} ${s.nameAr} — ${s.priceLabel}`)) leaked.push(`${s.code}: ${s.priceLabel}`);
    assert.deepEqual(leaked, []);
    // ‏وأتعاب الخدمة في المعرفة محجوبة أصلاً (hideServiceFees) — لا رقم بعد «أتعاب الخدمة:».
    assert.doesNotMatch(sys, /أتعاب الخدمة:\s*[\d,٬]+/);
  } finally { f.restore(); }
});

test("الزائر بلا جلسة: كوكي ملغى أو ملفّق أو لغير الجلسة = ضيف", async () => {
  for (const cookie of ["bp_sid=sid-revoked", "bp_sid=nope", "other=1"]) {
    const f = azureStub("أهلاً");
    try {
      const r = await ask({ messages: ASK_PRICE }, cookie);
      assert.doesNotMatch(sysOf(f), /الأسعار الحية من كتالوج الموقع/, cookie);
      assert.equal(r.json.pricesHidden, true, cookie);
    } finally { f.restore(); }
  }
});

// ───────────────────────────── ٢) الحارس: لو تسرّب سعر في الرد ─────────────────────────────

test("الزائر بلا جلسة: سعرٌ تسرّب في رد النموذج يُستبدل بـ«السعر يظهر بعد تسجيل الدخول»", async () => {
  const f = azureStub("تأسيس الشركة ذات المسؤولية المحدودة يكلّف 7,500 ﷼ فقط.\nوالرسوم الحكومية 500 ريال تُدفع للجهة.\nوالباقة الفضية بـ 6,000 ﷼ شهرياً.\nتواصل معنا لبدء الطلب.");
  try {
    const r = await ask({ messages: ASK_PRICE }, GUEST);
    const reply = r.json.reply;
    assert.doesNotMatch(reply, /7,500|6,000/, "سعر الخدمة والباقة محجوبان");
    assert.match(reply, /السعر يظهر بعد تسجيل الدخول/);
    assert.equal((reply.match(/السعر يظهر بعد تسجيل الدخول/g) || []).length, 1, "ملاحظة واحدة لا تتكرر");
    assert.match(reply, /الرسوم الحكومية 500 ريال/, "الرسوم الحكومية الرسمية تمرّ فهي معلومة جهة");
    assert.match(reply, /تواصل معنا لبدء الطلب/, "بقية الرد تبقى");
    assert.equal(r.json.priceGate, "login");
  } finally { f.restore(); }
});

test("الحارس: صيغ المبالغ المختلفة (أرقام هندية، SAR، ألف ريال) كلها تُحجب للضيف", async () => {
  const { guardReply } = await import("../api/chat.js");
  for (const leak of ["السعر ٧٬٥٠٠ ر.س", "السعر 7500 ريال سعودي", "Price is SAR 7,500", "it costs 3000 SAR", "حوالي ألف ريال", "تبدأ من 2,500 ﷼ / شهر"]) {
    const g = guardReply(leak, { priceMode: "login", cfg: null });
    assert.ok(g.gated, leak);
    assert.doesNotMatch(g.text, /7,?500|٧٬٥٠٠|3000|ألف|2,500/, leak);
  }
  // ‏إنجليزي ⇒ ملاحظة بالإنجليزية.
  assert.match(guardReply("it costs 3000 SAR", { priceMode: "login", cfg: null }).text, /Prices are shown after you sign in/);
  // ‏لا مبلغ ⇒ الرد كما جاء حرفاً.
  const plain = "مدة المعاملة 3 أيام.  وتحتاج رسالة رفض مكتوبة.";
  assert.equal(guardReply(plain, { priceMode: "login", cfg: null }).text, plain);
  // ‏«رسائل» لا تُقرأ عملةً («رس» ليست «ر.س»).
  assert.equal(guardReply("وصلتني 5 رسائل", { priceMode: "login", cfg: null }).gated, false);
});

test("ردّ صادق حين يتعذّر السعر على المسجّل: لا رقم مخترَع بل إحالة للفريق", async () => {
  const { guardReply } = await import("../api/chat.js");
  const g = guardReply("السعر 4,000 ﷼ تقريباً", { priceMode: "unavailable", cfg: null });
  assert.doesNotMatch(g.text, /4,000/);
  assert.match(g.text, /تعذّر عرض السعر الآن/);
  assert.match(g.text, /wa\.me\/966530540231/);
});

// ───────────────────────────── ٣) المسجّل: الأسعار من الكتالوج بالـSKU ─────────────────────────────

test("المسجّل بجلسة: قائمة الأسعار الحيّة تصل النموذج، بالرمز وبسعر الكتالوج بالحرف", async () => {
  const cat = await catalog();
  const llc = cat.services.find((s) => s.code === "BP-SBC-01");
  assert.ok(llc && llc.priceLabel, "الخدمة موجودة في الكتالوج");
  const f = azureStub("أتعابنا حسب القائمة.");
  try {
    const r = await ask({ messages: ASK_PRICE }, CLIENT);
    const sys = sysOf(f);
    assert.match(sys, /الأسعار الحية من كتالوج الموقع/);
    assert.ok(sys.includes(`- ${llc.code} ${llc.nameAr} — ${llc.priceLabel}`), "سطر الخدمة بسعره من الكتالوج");
    assert.match(sys, /مسجّل الدخول/);
    assert.match(sys, /لا تذكر سعراً غير موجود فيها/);
    assert.doesNotMatch(sys, /السعر يظهر بعد تسجيل الدخول/);
    assert.equal(r.json.pricesHidden, undefined);
    assert.equal(r.json.reply, "أتعابنا حسب القائمة.", "رد المسجّل لا يُحجب");
  } finally { f.restore(); }
});

test("المسجّل: ذكر السعر في الرد يمرّ كما هو", async () => {
  const f = azureStub("تأسيس ذات المسؤولية المحدودة 7,500 ﷼ (BP-SBC-01).");
  try {
    const r = await ask({ messages: ASK_PRICE }, CLIENT);
    assert.equal(r.json.reply, "تأسيس ذات المسؤولية المحدودة 7,500 ﷼ (BP-SBC-01).");
    assert.equal(r.json.priceGate, undefined);
  } finally { f.restore(); }
});

test("ترتيب الطلب (intake): القائمة أكواد بلا أسعار للضيف وللمسجّل معاً", async () => {
  for (const cookie of [GUEST, CLIENT]) {
    const f = azureStub("تمام.");
    try {
      await ask({ mode: "intake", context: "government", lang: "ar", messages: [turn("user", "التسجيل في التأمينات الاجتماعية (GOSI)")] }, cookie);
      const sys = sysOf(f);
      assert.match(sys, /BP-GOSI-01/, "الكود حاضر لاختيار البند");
      assert.doesNotMatch(sys, PRICE_LINE, "لا سعر في قائمة الاستقبال");
      assert.doesNotMatch(sys, /الأسعار الحية من كتالوج الموقع/);
    } finally { f.restore(); }
  }
});

test("وكيل n8n الاحتياطي: يُرسَل له قيد الأسعار للضيف، ورده يمرّ بالحارس", async () => {
  const f = stub((u) => (u.startsWith(AZ) ? json({ error: "down" }, 500) : u.includes(N8N) ? json({ output: "السعر 7,500 ﷼ فقط" }) : json({}, 404)));
  try {
    const r = await ask({ messages: ASK_PRICE }, GUEST);
    assert.equal(r.json.provider, "baher-n8n");
    const sent = f.calls.find((c) => c.url.includes(N8N)).body.chatInput;
    assert.match(sent, /الزائر غير مسجّل/);
    assert.doesNotMatch(r.json.reply, /7,500/);
    assert.match(r.json.reply, /السعر يظهر بعد تسجيل الدخول/);
  } finally { f.restore(); }
});

// ───────────────────────────── ٤) تطوير الأعمال مخفية ─────────────────────────────

const BIZ_Q = [turn("user", "أبغى عملاء جدد ومبيعاتنا ضعيفة، تعرضون Revenue OS؟")];
const REV = /REV-(?:START|LAUNCH|GROWTH|PRO|TEAM|ENT)/;

test("تطوير الأعمال مخفية: المحادثة العامة لا تحمل قسمها ولا أكواده لا للضيف ولا للمسجّل", { skip: !BD_HIDDEN && "تطوير الأعمال ظاهرة (hidden.json)" }, async () => {
  for (const cookie of [GUEST, CLIENT]) {
    const f = azureStub("حالياً غير متاحة.");
    try {
      await ask({ messages: BIZ_Q }, cookie);
      const sys = sysOf(f);
      assert.doesNotMatch(sys, REV, "لا كود REV-* في التعليمات");
      assert.doesNotMatch(sys, /نظام تشغيل الإيرادات/, "قسم المعرفة المقيَّد منزوع حتى مع نيّة السؤال");
      assert.match(sys, /خدمة «تطوير الأعمال».*غير معروضة حالياً/);
    } finally { f.restore(); }
  }
});

test("تطوير الأعمال مخفية: الباب الرابع يُعامَل كباب الاستشارات، فلا تعليمات ولا نوع ولا نطاق للخدمة", { skip: !BD_HIDDEN && "تطوير الأعمال ظاهرة (hidden.json)" }, async () => {
  const f = azureStub("تمام.");
  try {
    await ask({ mode: "intake", context: "bizdev", lang: "ar", messages: [turn("user", "أبغى عملاء")] }, GUEST);
    const sys = sysOf(f);
    assert.match(sys, /ثلاث خدمات فقط/);
    assert.doesNotMatch(sys, /BUSINESS_DEVELOPMENT/);
    assert.doesNotMatch(sys, REV);
    assert.doesNotMatch(sys, /نظام تشغيل الإيرادات/);
    assert.match(sys, /استشارة أعمال/, "السياق الافتراضي");
  } finally { f.restore(); }
  // ‏النطاق الاحتياطي (كل المزوّدين ساقطون) لا يبني نطاق تطوير أعمال.
  const g = stub(() => json({}, 500));
  try {
    const r = await ask({ mode: "intake", context: "bizdev", lang: "ar", messages: [turn("user", "أبغى عملاء"), turn("assistant", "؟"), turn("user", "شركة مقاولات")] }, GUEST);
    const sc = JSON.parse(/<<SCOPE>>([\s\S]*?)<<END>>/.exec(r.json.reply)[1]);
    assert.equal(sc.type, "CONSULTATION");
    assert.ok(sc.items.every((i) => !/تطوير الأعمال|CRM/.test(i.title)));
  } finally { g.restore(); }
});

test("تطوير الأعمال مخفية: خدمة REV-* لا تُحفظ بنداً ولو طابق اسمها الرسالة الأولى", { skip: !BD_HIDDEN && "تطوير الأعمال ظاهرة (hidden.json)" }, async () => {
  const cat = await catalog();
  const rev = cat.services.find((s) => s.code === "REV-GROWTH");
  assert.ok(rev, "الخدمة ما زالت في الكتالوج المصدري (الإخفاء عند القراءة لا بالحذف)");
  const g = stub(() => json({}, 500));
  try {
    const r = await ask({ mode: "intake", context: "consulting", lang: "ar", messages: [turn("user", rev.nameAr), turn("assistant", "؟"), turn("user", "شركة تقنية")] }, GUEST);
    const sc = JSON.parse(/<<SCOPE>>([\s\S]*?)<<END>>/.exec(r.json.reply)[1]);
    assert.ok(sc.items.every((i) => !/^REV-/.test(i.code)));
  } finally { g.restore(); }
});

test("تطوير الأعمال مخفية: قائمة المسجّل خالية من REV-*، وما سواها كما هي", { skip: !BD_HIDDEN && "تطوير الأعمال ظاهرة (hidden.json)" }, async () => {
  const f = azureStub("تمام");
  try {
    await ask({ messages: [turn("user", "ما أسعار خدمات تطوير الأعمال والمبيعات وتأسيس الشركات؟")] }, CLIENT);
    const sys = sysOf(f);
    assert.doesNotMatch(sys, REV);
    assert.match(sys, /- BP-SBC-01 /, "بقية الخدمات حاضرة");
  } finally { f.restore(); }
});

test("تطوير الأعمال مخفية: كلام النموذج عنها يُحذف، وكتلة النطاق تُنقّى", { skip: !BD_HIDDEN && "تطوير الأعمال ظاهرة (hidden.json)" }, async () => {
  const f = azureStub("ممكن ننظر في باقة REV-GROWTH لك.\nوعندنا أيضاً تأسيس الشركات.\nنظام تشغيل الإيرادات يناسبك.");
  try {
    const r = await ask({ messages: BIZ_Q }, CLIENT);
    assert.doesNotMatch(r.json.reply, REV);
    assert.doesNotMatch(r.json.reply, /نظام تشغيل الإيرادات/);
    assert.match(r.json.reply, /تأسيس الشركات/);
  } finally { f.restore(); }

  const scope = JSON.stringify({ ready: true, type: "BUSINESS_DEVELOPMENT", title: "t", summary: "s", items: [{ code: "REV-GROWTH", title: "باقة النمو", why: "" }, { code: "", title: "استشارة", why: "" }], needs: ["سجل"] });
  const g = azureStub(`رتبت لك النطاق.\n<<SCOPE>>${scope}<<END>>`);
  try {
    const r = await ask({ mode: "intake", context: "consulting", lang: "ar", messages: [turn("user", "أ"), turn("assistant", "؟"), turn("user", "ب")] }, GUEST);
    const sc = JSON.parse(/<<SCOPE>>([\s\S]*?)<<END>>/.exec(r.json.reply)[1]);
    assert.equal(sc.type, "CONSULTATION");
    assert.deepEqual(sc.items.map((i) => i.title), ["استشارة"]);
  } finally { g.restore(); }
});

test("الإخفاء يتبع hidden.json: حين تُزال تطوير الأعمال منه يعود الباب بنصّه وأكواده", async () => {
  const file = path.join(DBDIR, "hidden-empty.json");
  fs.writeFileSync(file, JSON.stringify({ services: [], pages: [] }));
  process.env.BP_HIDDEN_FILE = file;
  const f = azureStub("تمام.");
  try {
    await ask({ mode: "intake", context: "bizdev", lang: "ar", messages: [turn("user", "أبغى عملاء")] }, GUEST);
    const sys = sysOf(f);
    assert.match(sys, /أربع خدمات/);
    assert.match(sys, /BUSINESS_DEVELOPMENT/);
    assert.match(sys, /نظام تشغيل الإيرادات/, "قسم Revenue OS يعود");
  } finally { f.restore(); delete process.env.BP_HIDDEN_FILE; }
});

test("لوحة الإدارة تبقى بقائمتها الكاملة (الإخفاء وحجب الأسعار للمحادثة العامة وترتيب الطلب فقط)", async () => {
  const f = azureStub("حاضر");
  try {
    const r = await ask({ mode: "admin", key: "k-test-panel", messages: [turn("user", "اكتب وصفاً لخدمات تأسيس الشركات")] }, GUEST);
    assert.equal(r.status, 200);
    assert.match(sysOf(f), /الأسعار الحية من كتالوج الموقع/);
    assert.equal(r.json.pricesHidden, undefined);
  } finally { f.restore(); }
});
