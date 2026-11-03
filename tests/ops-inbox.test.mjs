// الوارد في /ops — صندوق المحادثات المنقول من /monitor.
//
// شغّله: npm test
//
// ما يُثبَّت هنا:
//   ① محادثة موقع بلا رقم ولا بريد تظهر في الوارد (كان /ops يعرض ما ارتبط بطلب
//      فقط، وما سواه يحوّله إلى /admin) — وتُعلَّم «ساخنة» حين يترك الزائر وسيلة
//      تواصل، وتُعلَّم «غير مقروءة» حتى تُفتح.
//   ② لا وصول بلا مفتاح أو جلسة المالك، ولا يُقبل مفتاح الدخول من الرابط في
//      إجراءات الوارد الجديدة (يُقبل من جسم الطلب فقط).
//   ③ الرد لا يقبل وجهةً من المتصفح: الجوال والبريد يُقرآن من المحادثة نفسها،
//      وما يشبه سعراً أو ضماناً يُحجز حتى يؤكّده الموظف.
//   ④ الصفحة المولَّدة لا تضع المفتاح في أي رابط، ولا تحوّل الوارد إلى
//      /admin أو /monitor.
//
// الاختبار يشغّل `handleSimple` و`handler` الحقيقيين على قاعدة JSON مؤقتة
// (LOCAL_DB=1). نوشن وحده مُحاكى في الذاكرة؛ أي fetch إلى غيره يرمي، فلا شبكة
// ولا مفتاح حقيقي ولا رسالة تصل أحداً.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DBDIR = fs.mkdtempSync(path.join(os.tmpdir(), "bp-ops-inbox-"));
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = DBDIR;
process.env.APP_ENV = "development";
process.env.SIMPLE_TEST_MODE = "1";
process.env.SIMPLE_OPS_KEY = "test-ops";
process.env.NOTION_TOKEN = "notion-test-token-never-leaves-this-process";
process.env.PANEL_KEY = "panel-key-for-this-test";
process.env.WHATSAPP_MODE = "mock";
process.env.EMAIL_MODE = "preview";
process.env.NOTIFY_ON = "0";
delete process.env.PANEL_REQUIRE_NAFATH;
delete process.env.OWNER_DEMO_CODE;

// ------------------------------------------------------------ نوشن مُحاكى --
// يفهم ما يستعمله الكود فعلاً: استعلام بمرشّح مصدر ومرجع، وإنشاء صفحة، وتعديلها.
const pages = [];
const plain = (v) => ({ type: "rich_text", rich_text: [{ plain_text: v }] });
const fromRequest = (props) => {
  const out = {};
  for (const [k, v] of Object.entries(props || {})) {
    if (v.rich_text) out[k] = plain(v.rich_text.map((t) => t.text.content).join(""));
    else if (v.select) out[k] = { type: "select", select: v.select };
    else if (v.title) out[k] = { type: "title", title: v.title.map((t) => ({ plain_text: t.text.content })) };
    else out[k] = v;
  }
  return out;
};
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (!u.startsWith("https://api.notion.com/v1/")) throw new Error("network blocked in test: " + u);
  const json = (obj, status = 200) => ({ ok: status < 300, status, json: async () => obj, text: async () => JSON.stringify(obj) });
  const body = init.body ? JSON.parse(init.body) : {};
  if (u.includes("/databases/") && u.endsWith("/query")) {
    const clauses = body.filter && body.filter.and ? body.filter.and : body.filter ? [body.filter] : [];
    let rows = pages.filter((p) => clauses.every((c) => {
      const prop = p.properties[c.property];
      if (c.select) return prop && prop.select && prop.select.name === c.select.equals;
      if (c.rich_text) return prop && prop.rich_text.map((t) => t.plain_text).join("") === c.rich_text.equals;
      return true;
    }));
    rows = rows.slice().sort((a, b) => (a.last_edited_time < b.last_edited_time ? 1 : -1));
    return json({ results: rows.slice(0, body.page_size || 100) });
  }
  if (u.endsWith("/pages") && init.method === "POST") {
    const now = new Date().toISOString();
    const pg = { id: "pg-" + (pages.length + 1), created_time: now, last_edited_time: now, properties: fromRequest(body.properties) };
    pages.push(pg);
    return json(pg);
  }
  const m = u.match(/\/pages\/([^/?]+)$/);
  if (m && init.method === "PATCH") {
    const pg = pages.find((p) => p.id === m[1]);
    if (!pg) return json({}, 404);
    Object.assign(pg.properties, fromRequest(body.properties));
    pg.last_edited_time = new Date().toISOString();
    return json(pg);
  }
  return json({ results: [] });
};

const { handleSimple } = await import("../api/_simple.js");
const requestsHandler = (await import("../api/requests.js")).default;

// ---------------------------------------------------------------- أدوات --
const call = async (handler, { method = "POST", body = {}, query = {}, headers = {} } = {}) => {
  const res = { statusCode: 200, headers: {}, payload: "", setHeader(k, v) { this.headers[k] = v; }, end(s) { this.payload = s || ""; } };
  await handler({ method, body, query, headers, url: "/api/requests", socket: {} }, res);
  let data = null;
  try { data = JSON.parse(res.payload); } catch {}
  return { status: res.statusCode, data };
};
const ops = (action, extra = {}, { key = "test-ops", query = {} } = {}) =>
  call(handleSimple, { body: { action, ...(key ? { key } : {}), ...extra }, query: { __route: "simple", ...query } });
const chat = (sid, messages, contact) =>
  call(requestsHandler, { body: { type: "advisor-chat", sid, messages, contact, notify: false }, query: {} });

const Q = (c) => [{ role: "user", content: c }, { role: "assistant", content: "أهلاً بك، كيف أخدمك؟" }];

// نبذر ثلاث محادثات: بلا وسيلة تواصل، وبجوال، وببريد.
test("بذر المحادثات", async () => {
  assert.equal((await chat("anon1", Q("كم تستغرق إجراءات السجل التجاري؟"), {})).data.ok, true);
  assert.equal((await chat("hot1", Q("أبغى أنقل كفالة 3 موظفين"), { name: "سعد العتيبي", phone: "0555000111" })).data.ok, true);
  assert.equal((await chat("mail1", Q("استفسار عن تأسيس شركة"), { name: "ليلى", email: "Laila@Example.com" })).data.ok, true);
  assert.equal(pages.length, 3);
});

test("① محادثة بلا رقم تظهر في الوارد، والساخنة معلَّمة", async () => {
  const r = await ops("ops-inbox-feed");
  assert.equal(r.status, 200);
  assert.equal(r.data.ok, true);
  const by = Object.fromEntries(r.data.threads.map((t) => [t.id, t]));
  assert.ok(by["WEB-anon1"], "المحادثة المجهولة غائبة عن الوارد");
  assert.equal(by["WEB-anon1"].hot, false);
  assert.equal(by["WEB-anon1"].phone, "");
  assert.equal(by["WEB-anon1"].channel, "WEBSITE");
  assert.equal(by["WEB-hot1"].hot, true);
  assert.equal(by["WEB-hot1"].name, "سعد العتيبي");
  assert.equal(by["WEB-mail1"].hot, true);
  assert.equal(by["WEB-mail1"].email, "laila@example.com");
  assert.ok(r.data.threads.every((t) => t.unread), "كل محادثة جديدة غير مقروءة");
  assert.equal(r.data.counts.unread, 3);
  assert.equal(r.data.counts.hot, 2);
  // الأحدث أولاً
  const ats = r.data.threads.map((t) => t.at);
  assert.deepEqual(ats, ats.slice().sort().reverse());
  // القائمة لا تحمل نص المحادثة كاملاً (يُجلب عند الفتح)
  assert.equal(by["WEB-anon1"].messages, undefined);
  assert.match(by["WEB-anon1"].last.content, /أهلاً بك/);
});

test("فتح المحادثة يعيدها كاملة بالاسم والجوال ويعلّمها مقروءة", async () => {
  const t = await ops("ops-inbox-thread", { id: "WEB-hot1" });
  assert.equal(t.status, 200);
  assert.equal(t.data.thread.name, "سعد العتيبي");
  assert.equal(t.data.thread.phone, "0555000111");
  assert.equal(t.data.thread.messages.length, 2);
  assert.equal(t.data.thread.messages[0].role, "user");
  assert.match(t.data.thread.messages[0].content, /3 موظفين/);
  const feed = await ops("ops-inbox-feed");
  const row = feed.data.threads.find((x) => x.id === "WEB-hot1");
  assert.equal(row.unread, false);
  assert.equal(feed.data.counts.unread, 2);
  assert.equal((await ops("ops-inbox-thread", { id: "WEB-nope" })).status, 404);
  assert.equal((await ops("ops-inbox-thread", { id: "../etc/passwd" })).status, 400);
});

test("وحين يكتب الزائر مرة ثانية تعود غير مقروءة", async () => {
  await new Promise((r) => setTimeout(r, 15));
  await chat("hot1", [...Q("أبغى أنقل كفالة 3 موظفين"), { role: "user", content: "وكم المدة؟" }, { role: "assistant", content: "نراجع حالتك." }], { name: "سعد العتيبي", phone: "0555000111" });
  const feed = await ops("ops-inbox-feed");
  assert.equal(feed.data.threads.find((x) => x.id === "WEB-hot1").unread, true);
});

test("② لا وصول بلا مفتاح أو جلسة، ولا مفتاح من الرابط", async () => {
  for (const action of ["ops-inbox-feed", "ops-inbox-thread", "ops-inbox-read", "ops-inbox-reply", "ops-inbox-suggest"]) {
    const none = await ops(action, { id: "WEB-anon1", text: "x" }, { key: "" });
    assert.equal(none.status, 401, `${action} بلا مفتاح`);
    const wrong = await ops(action, { id: "WEB-anon1", text: "x" }, { key: "غلط" });
    assert.equal(wrong.status, 401, `${action} بمفتاح خاطئ`);
    // مفتاح صحيح لكن في الرابط: مرفوض للإجراءات الجديدة.
    const inUrl = await ops(action, { id: "WEB-anon1", text: "x" }, { key: "", query: { key: "test-ops" } });
    assert.equal(inUrl.status, 401, `${action} يقبل المفتاح من الرابط`);
    const urlPanel = await ops(action, { id: "WEB-anon1", text: "x" }, { key: "", query: { key: "panel-key-for-this-test" } });
    assert.equal(urlPanel.status, 401, `${action} يقبل مفتاح اللوحة من الرابط`);
  }
  // المفتاح في الجسم يعمل: التجريبي ومفتاح اللوحة.
  assert.equal((await ops("ops-inbox-feed", {}, { key: "test-ops" })).status, 200);
  assert.equal((await ops("ops-inbox-feed", {}, { key: "panel-key-for-this-test" })).status, 200);
});

test("③ الرد: الوجهة من المحادثة، والالتزام يُحجز، والمحادثة بلا وسيلة تواصل لا يُرد عليها", async () => {
  // بلا جوال ولا بريد
  const a = await ops("ops-inbox-reply", { id: "WEB-anon1", channel: "whatsapp", text: "أهلاً بك" });
  assert.equal(a.status, 400);
  assert.equal(a.data.error, "no_phone");
  const b = await ops("ops-inbox-reply", { id: "WEB-anon1", channel: "email", text: "أهلاً بك" });
  assert.equal(b.data.error, "no_email");
  // وجهة يرسلها المتصفح تُتجاهل: المرسَل إليه جوال المحادثة
  const ok = await ops("ops-inbox-reply", { id: "WEB-hot1", channel: "whatsapp", text: "أهلاً سعد، نراجع طلبك ونعود إليك اليوم.", to: "0500999999", phone: "0500999999" });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.ok, true);
  assert.equal(ok.data.mode, "outbox", "واتساب في وضع المحاكاة لا يُرسل فعلاً");
  assert.equal(ok.data.delivered, false);
  const outbox = JSON.parse(fs.readFileSync(path.join(DBDIR, "outbox.json"), "utf8"));
  const wa = outbox.find((o) => o.kind === "whatsapp");
  assert.ok(wa, "الرد لم يُسجَّل في الصندوق الصادر");
  assert.equal(wa.to, "966555000111");
  assert.ok(!outbox.some((o) => String(o.to).includes("500999999")), "وجهة المتصفح وصلت إلى الإرسال");
  // بريد: الوجهة بريد المحادثة
  const em = await ops("ops-inbox-reply", { id: "WEB-mail1", channel: "email", text: "أهلاً ليلى، سنتواصل معك." });
  assert.equal(em.data.ok, true);
  assert.equal(JSON.parse(fs.readFileSync(path.join(DBDIR, "outbox.json"), "utf8")).find((o) => o.kind === "email").to, "laila@example.com");
  // التزام: سعر
  const price = await ops("ops-inbox-reply", { id: "WEB-hot1", channel: "whatsapp", text: "السعر 1500 ريال شامل الضريبة" });
  assert.equal(price.status, 409);
  assert.equal(price.data.error, "commitment");
  const forced = await ops("ops-inbox-reply", { id: "WEB-hot1", channel: "whatsapp", text: "السعر 1500 ريال شامل الضريبة", confirm_commitment: true });
  assert.equal(forced.data.ok, true);
  // رد فارغ، ومعرّف غير صالح
  assert.equal((await ops("ops-inbox-reply", { id: "WEB-hot1", text: "  " })).status, 400);
  assert.equal((await ops("ops-inbox-reply", { id: "x", text: "hi" })).status, 400);
  // الردود المرسلة تظهر في المحادثة وتجعلها مقروءة
  const t = await ops("ops-inbox-thread", { id: "WEB-hot1" });
  assert.equal(t.data.thread.replies.length, 2);
  assert.equal(t.data.thread.replies[0].role, "bp");
  const feed = await ops("ops-inbox-feed");
  assert.equal(feed.data.threads.find((x) => x.id === "WEB-hot1").unread, false);
});

test("اقتراح الرد مسودة فقط: بلا محرّك يفشل بوضوح ولا يرسل شيئاً", async () => {
  const before = JSON.parse(fs.readFileSync(path.join(DBDIR, "outbox.json"), "utf8")).length;
  const s = await ops("ops-inbox-suggest", { id: "WEB-hot1" });
  assert.equal(s.status, 200);
  assert.equal(s.data.ok, false);
  assert.ok(s.data.message);
  assert.equal(JSON.parse(fs.readFileSync(path.join(DBDIR, "outbox.json"), "utf8")).length, before);
  assert.equal((await ops("ops-inbox-suggest", { id: "WEB-nope" })).status, 404);
});

test("④ الصفحة المولَّدة: لا مفتاح في أي رابط، ولا تحويل للوارد إلى /admin أو /monitor", async () => {
  const { buildSimpleOps } = await import("../site/scripts/simple-v1-ops.mjs");
  const sv1 = { header: () => "", shell: (o) => o.script };
  const script = buildSimpleOps(sv1, { lang: () => "ar" });
  assert.ok(script.includes("ops-inbox-feed"), "الصفحة لا تستعمل الوارد الجديد");
  // موضع واحد قديم معروف خارج الوارد: جلب الإحصائيات (analytics) يمرّر المفتاح
  // في الرابط. لم يُمَسّ هنا (ليس من نطاق نقل الوارد) وهو مسجَّل في التقرير؛
  // الاختبار يمنع أن يصير اثنين.
  const urlKeys = script.match(/[?&]key=/g) || [];
  assert.ok(urlKeys.length <= 1, "مفتاح في رابط جديد داخل الصفحة");
  if (urlKeys.length) assert.match(script.slice(script.indexOf("&key=") - 120, script.indexOf("&key=")), /analytics/);
  assert.ok(!script.includes("advisor-inbox"), "الصفحة ما زالت تقرأ advisor-inbox بالمفتاح في الرابط");
  assert.ok(!script.includes("n8n.cloud"), "رابط n8n داخل المتصفح");
  // دالة الوارد نفسها لا تحوّل إلى لوحة قديمة.
  const start = script.indexOf("function vInbox(");
  const end = script.indexOf("function waFmt(");
  assert.ok(start > 0 && end > start);
  const inbox = script.slice(script.indexOf("// ---------- الوارد"), end);
  assert.ok(!/location\.href\s*=\s*['"]\/(admin|monitor)/.test(inbox), "الوارد يحوّل إلى لوحة قديمة");
  assert.ok(!/href:\s*['"]\/(admin|monitor)/.test(inbox), "الوارد يربط بلوحة قديمة");
  assert.ok(!/[?&]key=|encodeURIComponent\(\s*state\.key/.test(inbox), "الوارد يضع المفتاح في رابط");
  // والمفتاح يخرج من جسم الطلب فقط.
  assert.match(script, /body:JSON\.stringify\(Object\.assign\(\{action:action,key:state\.key/);
  // السكربت المضمَّن سليم نحوياً.
  const m = script.match(/<script>([\s\S]*)<\/script>/);
  assert.ok(m, "لا سكربت");
  new Function(m[1]);
});

test("تنظيف", () => {
  globalThis.fetch = realFetch;
  fs.rmSync(DBDIR, { recursive: true, force: true });
  assert.ok(fileURLToPath(import.meta.url));
});
