// مسار الذكاء لصفحة /compliance-solutions — POST /api/chat {action:"compliance-ai"}
//
// شغّله: npm test
//
// المطلوب إثباته، وكلٌّ منه يمنع حادثةً بعينها:
//   ① مقفل افتراضاً: بلا مفتاح، بمفتاح خاطئ، وحين CS_ACCESS_KEY غير مضبوط أصلاً.
//      الرفض لا يكشف إن كان المفتاح مضبوطاً، ولا يُنادى Azure.
//   ② يُفتح بثلاثة أبواب: ترويسة x-cs-key، الحقل key، وباب المالك (مفتاح اللوحة
//      أو تذكرة نفاذ) بلا CS_ACCESS_KEY.
//   ③ الحماية من استنزاف الرصيد: حدّ المعدّل (IP والمفتاح)، السقف اليومي (نداءات
//      وحجم ملفات، من الذاكرة ومن قاعدة البيانات)، مفتاح الإيقاف، الحجم والنوع.
//   ④ في كل رفضٍ أعلاه Azure لا يُنادى — يُقاس بعدّاد على الـfetch المُحاكى.
//   ⑤ Azure وحده: أي مضيف آخر يُرمى. ولا سرّ ولا نصّ مستخدم في السجلات.
//
// على `handler` الحقيقي في api/chat.js، والقاعدة LOCAL_DB=1 في ملفٍ مؤقّت.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DBDIR = fs.mkdtempSync(path.join(os.tmpdir(), "bp-cs-ai-"));
fs.writeFileSync(path.join(DBDIR, "db.json"), JSON.stringify({ audit_logs: [] }));

// تُضبط قبل الاستيراد: chat.js يقرأ مفاتيح اللوحة وقت التحميل.
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = DBDIR;
process.env.AZURE_OPENAI_ENDPOINT = "https://azure.test";
process.env.AZURE_OPENAI_KEY = "azure-secret-key-xyz";
process.env.AZURE_OPENAI_TEXT_DEPLOYMENT = "gpt-text";
process.env.AZURE_OPENAI_VISION_DEPLOYMENT = "gpt-vision";
delete process.env.AZURE_OPENAI_ENDPOINT_2;
delete process.env.AZURE_DOCINTEL_ENDPOINT;
delete process.env.AZURE_DOCINTEL_KEY;
process.env.PANEL_KEY = "panel-key-owner-1";
delete process.env.LEADS_KEY; delete process.env.DASHBOARD_KEY;
delete process.env.PANEL_REQUIRE_NAFATH;
process.env.NAFATH_HASH_SECRET = "test-hash-secret-for-tickets";
process.env.OWNER_NATIONAL_IDS = "1000000001";

const GOOD = "cs-good-key-123";
const setKey = () => { process.env.CS_ACCESS_KEY = GOOD; };
const clearLimits = () => {
  for (const k of ["CS_AI_ENABLED", "CS_AI_DAILY_CALLS", "CS_AI_DAILY_FILE_MB", "CS_AI_RATE_MAX", "CS_AI_KEY_RATE_MAX"]) delete process.env[k];
};

// ------------------------------------------------------------- الشبكة --
let azureCalls = 0;
let docintelCalls = 0;
let lastAzure = null;
let azureMode = "ok";            // ok | down | empty
const strayHosts = [];

const json = (o, status = 200, headers = {}) =>
  new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", ...headers } });

globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.startsWith("https://azure.test/openai/v1/chat/completions")) {
    azureCalls++;
    lastAzure = { headers: init.headers || {}, body: JSON.parse(init.body) };
    if (azureMode === "down") return json({ error: { message: "boom secret-detail" } }, 500);
    if (azureMode === "empty") return json({ choices: [{ message: { content: "" } }] });
    return json({ choices: [{ message: { content: "ردّ من النموذج المُحاكى" } }] });
  }
  if (u.startsWith("https://docs.test/")) {
    docintelCalls++;
    if (init.method === "POST") return new Response("", { status: 202, headers: { "operation-location": "https://docs.test/poll/1" } });
    return json({ status: "succeeded", analyzeResult: { content: "نص الشهادة: الرقم الضريبي ٣٠٠٠٠٠٠٠٠٠٠٠٠٠٣" } });
  }
  strayHosts.push(u);
  throw new Error("forbidden host in test: " + u);
};

const { default: handler } = await import("../api/chat.js");
const { _resetCsAi, CS_ACTION } = await import("../api/_cs-ai.js");
const { sb } = await import("../api/_db.js");
const { mintOwnerTicket } = await import("../api/_nafath.js");
const { localReset } = await import("../api/_localdb.js");

let ipN = 0;
const freshIp = () => `198.51.100.${(++ipN % 250) + 1}`;

function post(body, { headers = {}, ip } = {}) {
  let out = "", status = 0;
  const res = {
    setHeader() {},
    set statusCode(v) { status = v; },
    get statusCode() { return status; },
    end(b) { out = b; },
  };
  const req = { method: "POST", url: "/api/chat", body, headers: { "x-forwarded-for": ip || freshIp(), ...headers }, on() {} };
  return handler(req, res).then(() => ({ status, data: (() => { try { return JSON.parse(out); } catch { return null; } })(), raw: out }));
}
const msg = (t = "ما الفرق بين مخالفة الجوازات ومخالفة قوى؟") => [{ role: "user", content: t }];
const ask = (extra = {}) => ({ action: "compliance-ai", messages: msg(), ...extra });
const withKey = { "x-cs-key": GOOD };
const png = (n = 64) => ({ name: "x.png", mime: "image/png", data: Buffer.alloc(n, 7).toString("base64") });

function fresh() {
  _resetCsAi();
  clearLimits();
  setKey();
  azureCalls = 0; docintelCalls = 0; lastAzure = null; azureMode = "ok";
  delete process.env.AZURE_DOCINTEL_ENDPOINT; delete process.env.AZURE_DOCINTEL_KEY;
  localReset();
}

// ══════════════════════════════════════════════════════════ ① القفل ══
test("بلا مفتاح: 401 locked ولا يُنادى Azure", async () => {
  fresh();
  const r = await post(ask());
  assert.equal(r.status, 401);
  assert.deepEqual(r.data, { ok: false, error: "locked" });
  assert.equal(azureCalls, 0);
});

test("مفتاح خاطئ (ترويسة أو حقل): 401 locked ولا يُنادى Azure", async () => {
  fresh();
  const a = await post(ask(), { headers: { "x-cs-key": "wrong" } });
  const b = await post(ask({ key: "wrong-too" }));
  assert.equal(a.status, 401); assert.equal(a.data.error, "locked");
  assert.equal(b.status, 401); assert.equal(b.data.error, "locked");
  assert.equal(azureCalls, 0);
});

test("CS_ACCESS_KEY غير مضبوط: مقفل، ولا يختلف الرد عن المفتاح الخاطئ", async () => {
  fresh();
  const wrong = await post(ask(), { headers: { "x-cs-key": "wrong" } });
  delete process.env.CS_ACCESS_KEY;
  for (const headers of [{}, { "x-cs-key": "" }, { "x-cs-key": "anything" }]) {
    const r = await post(ask({ key: "" }), { headers });
    assert.equal(r.status, 401);
    assert.equal(r.raw, wrong.raw, "الرد يكشف أن المفتاح غير مضبوط");
  }
  const r = await post(ask({ key: "undefined" }));
  assert.equal(r.status, 401);
  assert.equal(azureCalls, 0);
});

test("القفل قبل مفتاح الإيقاف: غير المصرَّح لا يرى حالة الخدمة", async () => {
  fresh();
  process.env.CS_AI_ENABLED = "0";
  const r = await post(ask());
  assert.equal(r.status, 401);
  assert.equal(r.data.error, "locked");
});

// ═════════════════════════════════════════════════ ② الأبواب المفتوحة ══
test("مفتاح صحيح بالترويسة: 200 وAzure يُنادى مرة واحدة بالشكل الصحيح", async () => {
  fresh();
  const r = await post(ask({ system: "أنت مساعد امتثال." }), { headers: withKey });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data, { ok: true, reply: "ردّ من النموذج المُحاكى" });
  assert.equal(azureCalls, 1);
  assert.equal(lastAzure.body.model, "gpt-text");
  assert.equal(lastAzure.body.messages[0].role, "system");
  assert.match(lastAzure.body.messages[0].content, /^أنت مساعد امتثال\./);
  assert.match(lastAzure.body.messages[0].content, /لا وعد بإلغاء/, "قواعد الخادم الثابتة غائبة");
  assert.equal(lastAzure.body.messages.at(-1).role, "user");
  assert.equal(lastAzure.body.response_format, undefined);
  assert.equal(lastAzure.headers["api-key"], "azure-secret-key-xyz");
});

test("مفتاح صحيح بحقل key في الجسم", async () => {
  fresh();
  const r = await post(ask({ key: GOOD }));
  assert.equal(r.status, 200);
  assert.equal(azureCalls, 1);
});

test("باب المالك: مفتاح اللوحة بلا CS_ACCESS_KEY", async () => {
  fresh();
  delete process.env.CS_ACCESS_KEY;
  const r = await post(ask({ key: "panel-key-owner-1" }));
  assert.equal(r.status, 200);
  assert.equal(azureCalls, 1);
});

test("باب المالك: تذكرة نفاذ بلا CS_ACCESS_KEY", async () => {
  fresh();
  delete process.env.CS_ACCESS_KEY;
  const ticket = mintOwnerTicket("1000000001");
  assert.ok(ticket, "لم تُصدَر التذكرة");
  const r = await post(ask({ ticket }));
  assert.equal(r.status, 200);
  assert.equal(azureCalls, 1);
  const bad = await post(ask({ ticket: ticket.slice(0, -4) + "AAAA" }));
  assert.equal(bad.status, 401);
  assert.equal(azureCalls, 1, "تذكرة مزوّرة مرّت");
});

test("مفتاح اللوحة في ترويسة CS لا يفتح (المالك يدخل بالجسم كما في mode:admin)", async () => {
  fresh();
  const r = await post(ask(), { headers: { "x-cs-key": "panel-key-owner-1" } });
  assert.equal(r.status, 401);
  assert.equal(azureCalls, 0);
});

// ═══════════════════════════════════════════════════ ③ حدّ المعدّل ══
test("حدّ IP: 60 ثم 429 rate — ولا نداء Azure بعد الحدّ", async () => {
  fresh();
  const ip = "203.0.113.50";
  // مفاتيح مختلفة للاستعمال لا تفكّ حدّ الـIP: الباب نفسه، لكن حدّ المفتاح يُرفع.
  process.env.CS_AI_KEY_RATE_MAX = "1000";
  for (let i = 0; i < 60; i++) assert.equal((await post(ask(), { headers: withKey, ip })).status, 200, "رُفض قبل الحدّ عند " + i);
  assert.equal(azureCalls, 60);
  const r = await post(ask(), { headers: withKey, ip });
  assert.equal(r.status, 429);
  assert.deepEqual(r.data, { ok: false, error: "rate" });
  assert.equal(azureCalls, 60, "نُودي Azure بعد الحدّ");
  const other = await post(ask(), { headers: withKey, ip: "203.0.113.51" });
  assert.equal(other.status, 200, "الحدّ يخصّ العنوان وحده");
});

test("حدّ المفتاح: 120 ثم 429", async () => {
  fresh();
  process.env.CS_AI_RATE_MAX = "100000";
  for (let i = 0; i < 120; i++) assert.equal((await post(ask(), { headers: withKey })).status, 200);
  const r = await post(ask(), { headers: withKey });
  assert.equal(r.status, 429);
  assert.equal(r.data.error, "rate");
  assert.equal(azureCalls, 120);
});

test("الحدّ يُضبط بمتغيّر بيئة", async () => {
  fresh();
  process.env.CS_AI_RATE_MAX = "2";
  const ip = "203.0.113.60";
  assert.equal((await post(ask(), { headers: withKey, ip })).status, 200);
  assert.equal((await post(ask(), { headers: withKey, ip })).status, 200);
  assert.equal((await post(ask(), { headers: withKey, ip })).status, 429);
});

test("تخمين المفتاح: بعد 20 محاولة خاطئة من عنوانٍ يُرفض حتى الصحيح بـ429", async () => {
  fresh();
  const ip = "203.0.113.70";
  for (let i = 0; i < 20; i++) assert.equal((await post(ask(), { headers: { "x-cs-key": "g" + i }, ip })).status, 401);
  const r = await post(ask(), { headers: withKey, ip });
  assert.equal(r.status, 429, "المخمِّن ما زال يُقارَن مفتاحه");
  assert.equal(azureCalls, 0);
});

test("الطلب المرفوض بالشكل لا يستهلك الحدّ", async () => {
  fresh();
  process.env.CS_AI_RATE_MAX = "2";
  const ip = "203.0.113.80";
  for (let i = 0; i < 5; i++) assert.equal((await post({ action: "compliance-ai", messages: [] }, { headers: withKey, ip })).status, 400);
  assert.equal((await post(ask(), { headers: withKey, ip })).status, 200);
});

// ═════════════════════════════════════════════════ ③ السقف اليومي ══
test("السقف اليومي للنداءات: CS_AI_DAILY_CALLS ثم 402 budget بلا Azure", async () => {
  fresh();
  process.env.CS_AI_DAILY_CALLS = "3";
  for (let i = 0; i < 3; i++) assert.equal((await post(ask(), { headers: withKey })).status, 200);
  const r = await post(ask(), { headers: withKey });
  assert.equal(r.status, 402);
  assert.deepEqual(r.data, { ok: false, error: "budget" });
  assert.equal(azureCalls, 3);
});

test("السقف اليومي يُحسب من القاعدة أيضاً: نسخةٌ أخرى استهلكته", async () => {
  fresh();
  process.env.CS_AI_DAILY_CALLS = "5";
  // خمسة نداءات سجّلتها نسخٌ أخرى اليوم — ذاكرة هذه النسخة فارغة.
  await sb("audit_logs", { method: "POST", prefer: "return=minimal", body: Array.from({ length: 5 }, () => ({
    action: CS_ACTION, actor_label: "cs:other", entity_type: "cs_ai", after: { files: 0, file_bytes: 0, chars_in: 10 } })) });
  const r = await post(ask(), { headers: withKey });
  assert.equal(r.status, 402);
  assert.equal(azureCalls, 0);
});

test("سجلّات الأمس لا تُحسب", async () => {
  fresh();
  process.env.CS_AI_DAILY_CALLS = "2";
  const y = new Date(Date.now() - 2 * 86400000).toISOString();
  await sb("audit_logs", { method: "POST", prefer: "return=minimal", body: Array.from({ length: 4 }, () => ({
    action: CS_ACTION, actor_label: "cs:old", entity_type: "cs_ai", created_at: y, after: { files: 0, file_bytes: 0 } })) });
  assert.equal((await post(ask(), { headers: withKey })).status, 200);
});

test("سقف حجم الملفات اليومي: CS_AI_DAILY_FILE_MB ثم 402 budget", async () => {
  fresh();
  process.env.CS_AI_DAILY_FILE_MB = "1";
  const big = { name: "b.png", mime: "image/png", data: Buffer.alloc(600 * 1024, 1).toString("base64") };
  assert.equal((await post(ask({ files: [big] }), { headers: withKey })).status, 200);
  const r = await post(ask({ files: [big] }), { headers: withKey });
  assert.equal(r.status, 402);
  assert.equal(r.data.error, "budget");
  assert.equal(azureCalls, 1);
});

test("الافتراضي 300 نداءً في اليوم", async () => {
  fresh();
  const { csConfig } = await import("../api/_cs-ai.js");
  assert.equal(csConfig().dailyCalls, 300);
  assert.equal(csConfig().enabled, true);
  process.env.CS_AI_DAILY_CALLS = "abc";
  assert.equal(csConfig().dailyCalls, 300, "قيمة فاسدة يجب ألا تُسقط السقف");
});

// ═══════════════════════════════════════════════════ ④ مفتاح الإيقاف ══
test("CS_AI_ENABLED=0: 503 ai_unavailable للمصرَّح — ولا Azure", async () => {
  fresh();
  for (const off of ["0", "false", "off"]) {
    process.env.CS_AI_ENABLED = off;
    const r = await post(ask(), { headers: withKey });
    assert.equal(r.status, 503, off);
    assert.deepEqual(r.data, { ok: false, error: "ai_unavailable" });
  }
  const owner = await post(ask({ key: "panel-key-owner-1" }));
  assert.equal(owner.status, 503, "المالك لا يتجاوز مفتاح الإيقاف");
  assert.equal(azureCalls, 0);
  process.env.CS_AI_ENABLED = "1";
  assert.equal((await post(ask(), { headers: withKey })).status, 200);
});

test("Azure غير مضبوط: 503 ai_unavailable", async () => {
  fresh();
  const k = process.env.AZURE_OPENAI_KEY;
  delete process.env.AZURE_OPENAI_KEY;
  try {
    const r = await post(ask(), { headers: withKey });
    assert.equal(r.status, 503);
    assert.equal(r.data.error, "ai_unavailable");
    assert.equal(azureCalls, 0);
  } finally { process.env.AZURE_OPENAI_KEY = k; }
});

test("Azure يفشل (500) أو يردّ فارغاً: 503 ai_unavailable بلا تسريب", async () => {
  fresh();
  azureMode = "down";
  const a = await post(ask(), { headers: withKey });
  assert.equal(a.status, 503);
  assert.deepEqual(a.data, { ok: false, error: "ai_unavailable" });
  assert.ok(!a.raw.includes("secret-detail") && !a.raw.includes("azure-secret-key-xyz"));
  azureMode = "empty";
  const b = await post(ask(), { headers: withKey });
  assert.equal(b.status, 503);
});

// ═══════════════════════════════════════════════ ⑤ الشكل والحجم والنوع ══
test("الحجم: ملفات فوق 3MB، أكثر من 6 ملفات، رسالة فوق 8000، system فوق 12000 → 413", async () => {
  fresh();
  const seven = Buffer.alloc(7 * 1024 * 1024, 1).toString("base64");
  const cases = {
    "ملف 7MB": ask({ files: [{ name: "a.png", mime: "image/png", data: seven }] }),
    "مجموع 3×2.5MB": ask({ files: [1, 2, 3].map((i) => ({ name: `a${i}.png`, mime: "image/png", data: Buffer.alloc(2.5 * 1024 * 1024, i).toString("base64") })) }),
    "7 ملفات": ask({ files: Array.from({ length: 7 }, png) }),
    "رسالة 8001": ask({ messages: [{ role: "user", content: "ا".repeat(8001) }] }),
    "system 12001": ask({ system: "ا".repeat(12001) }),
  };
  for (const [name, body] of Object.entries(cases)) {
    const r = await post(body, { headers: withKey });
    assert.equal(r.status, 413, name);
    assert.deepEqual(r.data, { ok: false, error: "too_large" }, name);
  }
  assert.equal(azureCalls, 0);
});

test("الحدود تُقبل عند الحدّ بالضبط، وأكثر من 24 رسالة تُقصّ إلى آخر 24", async () => {
  fresh();
  const many = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "m" + i }));
  many.push({ role: "user", content: "ا".repeat(8000) });
  const r = await post({ action: "compliance-ai", messages: many.slice(1), system: "ا".repeat(12000) }, { headers: withKey });
  assert.equal(r.status, 200);
  assert.equal(lastAzure.body.messages.length, 1 + 24);
  const six = await post(ask({ files: Array.from({ length: 6 }, png) }), { headers: withKey });
  assert.equal(six.status, 200);
});

test("نوع أو شكل غير صالح: 400 bad_request ولا Azure", async () => {
  fresh();
  const cases = {
    "نوع ملف غير مسموح": ask({ files: [{ name: "a.exe", mime: "application/x-msdownload", data: "AAAA" }] }),
    "gif": ask({ files: [{ name: "a.gif", mime: "image/gif", data: "AAAA" }] }),
    "base64 فاسد": ask({ files: [{ name: "a.png", mime: "image/png", data: "not base64 !!" }] }),
    "ملف بلا data": ask({ files: [{ name: "a.png", mime: "image/png" }] }),
    "files ليست مصفوفة": ask({ files: "x" }),
    "بلا messages": { action: "compliance-ai" },
    "messages فارغة": ask({ messages: [] }),
    "آخر رسالة من المساعد": ask({ messages: [{ role: "user", content: "a" }, { role: "assistant", content: "b" }] }),
    "role مجهول": ask({ messages: [{ role: "system", content: "a" }] }),
    "content ليست نصاً": ask({ messages: [{ role: "user", content: { a: 1 } }] }),
    "رسالة فارغة": ask({ messages: [{ role: "user", content: "   " }] }),
    "system ليس نصاً": ask({ system: 5 }),
  };
  for (const [name, body] of Object.entries(cases)) {
    const r = await post(body, { headers: withKey });
    assert.equal(r.status, 400, name);
    assert.deepEqual(r.data, { ok: false, error: "bad_request" }, name);
  }
  assert.equal(azureCalls, 0);
});

// ═══════════════════════════════════════════════════════ ⑥ الملفات ══
test("الصورة تمرّ صورةً إلى نشر الرؤية", async () => {
  fresh();
  const r = await post(ask({ files: [png(), { name: "y.jpg", mime: "image/jpeg", data: Buffer.alloc(32, 3).toString("base64") }] }), { headers: withKey });
  assert.equal(r.status, 200);
  assert.equal(lastAzure.body.model, "gpt-vision");
  const last = lastAzure.body.messages.at(-1);
  assert.ok(Array.isArray(last.content));
  assert.equal(last.content.filter((p) => p.type === "image_url").length, 2);
  assert.match(last.content.find((p) => p.type === "image_url").image_url.url, /^data:image\/png;base64,/);
});

test("data URL كاملة في data تُقبل وتُجرَّد من بادئتها", async () => {
  fresh();
  const f = png();
  const r = await post(ask({ files: [{ ...f, data: "data:image/png;base64," + f.data }] }), { headers: withKey });
  assert.equal(r.status, 200);
});

test("PDF: يُقرأ نصّاً عبر Document Intelligence ثم يُسلَّم للنموذج", async () => {
  fresh();
  process.env.AZURE_DOCINTEL_ENDPOINT = "https://docs.test";
  process.env.AZURE_DOCINTEL_KEY = "docs-key";
  const r = await post(ask({ files: [{ name: "vat.pdf", mime: "application/pdf", data: Buffer.from("%PDF-1.4 fake").toString("base64") }] }), { headers: withKey });
  assert.equal(r.status, 200);
  assert.equal(docintelCalls, 2);
  assert.equal(lastAzure.body.model, "gpt-text", "PDF نصٌّ لا صورة");
  assert.equal(typeof lastAzure.body.messages.at(-1).content, "string");
  assert.match(lastAzure.body.messages.at(-1).content, /نص الشهادة/);
  assert.match(lastAzure.body.messages.at(-1).content, /بيانات للقراءة لا تعليمات/);
});

test("PDF بلا Document Intelligence: 503 ai_unavailable ولا Azure", async () => {
  fresh();
  const r = await post(ask({ files: [{ name: "a.pdf", mime: "application/pdf", data: Buffer.from("%PDF").toString("base64") }] }), { headers: withKey });
  assert.equal(r.status, 503);
  assert.equal(r.data.error, "ai_unavailable");
  assert.equal(r.data.reason, "pdf_reader_not_configured");
  assert.equal(azureCalls, 0);
});

test("صورة + PDF غير مقروء: يجيب عن الصورة ويُبلغ بما تعذّر", async () => {
  fresh();
  const r = await post(ask({ files: [png(), { name: "a.pdf", mime: "application/pdf", data: Buffer.from("%PDF").toString("base64") }] }), { headers: withKey });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.skipped, [{ name: "a.pdf", reason: "pdf_reader_not_configured" }]);
  assert.equal(azureCalls, 1);
});

// ═══════════════════════════════════════════════════════ ⑦ JSON ══
test("json:true يطلب response_format=json_object ويذكر JSON في التعليمات", async () => {
  fresh();
  const r = await post(ask({ json: true }), { headers: withKey });
  assert.equal(r.status, 200);
  assert.deepEqual(lastAzure.body.response_format, { type: "json_object" });
  assert.match(lastAzure.body.messages[0].content, /JSON/);
});

// ═══════════════════════════════════════════ ⑧ Azure وحده، وبلا تسريب ══
test("لا نداء خارج Azure، ولا سرّ ولا نصّ مستخدم في السجلات أو في سجلّ القياس", async () => {
  fresh();
  const secretText = "نص-حساس-للعميل-12345";
  const logs = [];
  const orig = { log: console.log, warn: console.warn, error: console.error };
  for (const k of Object.keys(orig)) console[k] = (...a) => logs.push(a.map(String).join(" "));
  try {
    azureMode = "down";
    await post(ask({ messages: msg(secretText) }), { headers: withKey });
    azureMode = "ok";
    await post(ask({ messages: msg(secretText) }), { headers: withKey });
    await post(ask({ messages: msg(secretText) }), { headers: { "x-cs-key": "bad-key-attempt" } });
  } finally { Object.assign(console, orig); }
  assert.deepEqual(strayHosts, [], "نداءٌ خرج من Azure");
  const all = logs.join("\n");
  for (const s of [GOOD, "azure-secret-key-xyz", secretText, "bad-key-attempt", "secret-detail"]) assert.ok(!all.includes(s), "تسرّب إلى السجلات: " + s);
  const rows = JSON.stringify(await sb(`audit_logs?action=eq.${CS_ACTION}&select=actor_label,after`));
  assert.ok(rows.length > 10, "لا سجلّ قياس");
  for (const s of [GOOD, secretText, "203.0.113", "198.51.100"]) assert.ok(!rows.includes(s), "تسرّب إلى audit_logs: " + s);
});

test("كل نداءٍ ناجح يُسجَّل بأعداده فقط", async () => {
  fresh();
  await post(ask({ files: [png(100)] }), { headers: withKey });
  const rows = await sb(`audit_logs?action=eq.${CS_ACTION}&select=actor_label,after`);
  assert.equal(rows.length, 1);
  assert.match(rows[0].actor_label, /^cs:key:[0-9a-f]{16}$/);
  assert.equal(rows[0].after.files, 1);
  assert.equal(rows[0].after.file_bytes, 100);
  assert.equal(rows[0].after.door, "key");
});

test("غير المصرَّح لا يُسجَّل ولا يستهلك السقف", async () => {
  fresh();
  process.env.CS_AI_DAILY_CALLS = "1";
  await post(ask());
  await post(ask(), { headers: { "x-cs-key": "nope" } });
  assert.equal((await sb(`audit_logs?action=eq.${CS_ACTION}&select=id`)).length, 0);
  assert.equal((await post(ask(), { headers: withKey })).status, 200);
});

test("المسارات الأخرى في /api/chat لم تتأثر (mode:admin بلا مفتاح ما زال 401)", async () => {
  fresh();
  const r = await post({ mode: "admin", messages: msg() });
  assert.equal(r.status, 401);
  assert.equal(r.data.error, "unauthorized");
  assert.equal(azureCalls, 0);
});
