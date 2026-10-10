// الرحلة بعد الطلب في /my (api/_simple.js) — على قاعدة محلية وبلا شبكة.
//
// ما يُثبته هذا الملف:
//   ١) تغيير الحالة و«بدء التنفيذ» و«مكتمل» وتغيير الموعد وإلغاؤه تصل العميل (صندوق الصادر) برابط
//      /my?ref= ، ولا تذهب إلى المالك (هو من فعلها). ولا يظهر مفتاح notify.* في خط العميل.
//   ٢) رسالة العميل داخل طلبه تنبّه المالك (بريد + واتساب) وتفتح مهمة ردّ واحدة، ولا تتكرر داخل
//      النافذة، وردّ المالك يغلق المهمة ويصل العميل.
//   ٣) المستند المطلوب: رفع حقيقي، يُحفظ بمسار لا برابط، ويقلب البند إلى «استُلم»، ويُرفض الخارج عن
//      الصيغ والحجم والتوقيع الحقيقي للملف، ولا يمرّ رابط javascript:.
//   ٤) المخرجات: لا تُسلَّم قبل الدفع بلا تأكيد، ويراها العميل ويحمّلها برابط قصير بعد التحقق من
//      الملكية، ولا يفتحها عميل آخر، ويُبلَّغ بالبريد، ولوحة العمليات ترى كل الملفات برابط موقّع.
//   ٥) لا مسار تخزين ولا رابط طويل العمر يصل متصفح العميل.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

process.env.APP_ENV = "development";
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "simple-after-order-"));
for (const k of ["RESEND_API_KEY", "RESEND_KEY", "DAFTRA_API_KEY", "WHATSAPP_TOKEN", "SIMPLE_NOTIFY"]) delete process.env[k];

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");

// لا شبكة: أي نداء خارجي يفشل بصوت عالٍ، والكتالوج فارغ.
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes("catalog.json")) return new Response(JSON.stringify({ services: [], packages: [], discounts: [] }), { status: 200 });
  throw new Error("a local run must not reach the network: " + u);
};

const { handleSimple } = await import("../api/_simple.js");
const { sb, sha256 } = await import("../api/_db.js");
const { outboxList } = await import("../api/_mode.js");

const CLIENT = { email: "client@test.local", org: "2fcd5b83-144c-4434-be82-aac28b9e19c6", user: "7b2db20a-2404-41ce-b7af-8db1d3fabc95", token: "tok-client-aaaaaaaaaaaaaaaa" };
const OTHER = { email: "other@test.local", org: "31c1fef8-8ead-4007-acb1-3044a6b9dd29", user: "11111111-2222-4333-8444-555555555555", token: "tok-other-bbbbbbbbbbbbbbbbb" };
const future = new Date(Date.now() + 864e5).toISOString();
await sb("users", { method: "POST", prefer: "return=minimal", body: [{ id: OTHER.user, email: OTHER.email, full_name: "عميل آخر", locale: "ar" }] });
for (const c of [CLIENT, OTHER]) {
  await sb("user_sessions", { method: "POST", prefer: "return=minimal", body: [{ id: crypto.randomUUID(), token_hash: sha256(c.token), user_id: c.user, organization_id: c.org, expires_at: future, revoked_at: null }] });
}

async function call(action, body = {}, who = CLIENT) {
  const out = { status: 200, body: null };
  const isOps = action.startsWith("ops-");
  const res = { statusCode: 200, setHeader() {}, end(b) { out.status = this.statusCode; try { out.body = JSON.parse(b); } catch { out.body = b; } } };
  await handleSimple({
    method: "POST", headers: { cookie: isOps ? "" : `bp_sid=${who.token}` }, socket: {}, query: {},
    body: { action, ...(isOps ? { key: "test-ops" } : {}), ...body },
  }, res);
  return out;
}
const pdf = (n = 1) => Buffer.from("%PDF-1.4\n" + "x".repeat(n) + "\n%%EOF").toString("base64");
const mail = async (ref) => (await outboxList(500)).filter((m) => JSON.stringify(m).includes(ref));
const toClient = (list) => list.filter((m) => m.kind === "email" && m.to === CLIENT.email);
const toOwner = (list) => list.filter((m) => m.kind === "email" && /businesspartner/.test(m.to));

async function newRequest(title) {
  const r = await call("request-create", { type: "GOVERNMENT_SERVICE", title, phone: "0501234567", name: "عميل تجريبي", documents: [{ title: "صورة الإقامة" }, { title: "السجل التجاري" }] });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  return r.body.ref;
}
async function makePaid(ref) {
  const row = (await sb(`requests?ref=eq.${ref}&select=id`))[0];
  await sb(`requests?id=eq.${row.id}`, { method: "PATCH", body: { status: "PAID", quote: { number: "Q-T", total: 115, net: 100, vat: 15, items: [] }, payment: { status: "PAID", amount: 115 } } });
}

test("بدء التنفيذ والحالة والإكمال تصل العميل برابط /my?ref= ولا تصل المالك", async () => {
  const ref = await newRequest("تجديد إقامة");
  await makePaid(ref);

  let before = (await mail(ref)).length;
  let r = await call("ops-ready", { ref });
  assert.equal(r.body.ok, true);
  let m = (await mail(ref)).slice(0, (await mail(ref)).length - before);
  assert.equal(toClient(m).length, 1, "بريد واحد للعميل");
  assert.match(toClient(m)[0].subject, /بدأ تنفيذ طلبك/);
  assert.ok(toClient(m)[0].body.includes(`/my?ref=${ref}`), "رابط /my?ref=");
  assert.equal(toOwner(m).length, 0, "المالك هو من فعلها — لا بريد له");
  assert.ok(m.some((x) => x.kind === "whatsapp" && x.to === "966501234567"), "واتساب العميل في الصندوق");
  assert.ok(!m.some((x) => x.kind === "whatsapp" && x.to === "966530540231"), "لا واتساب للمالك");

  // نفس الحالة مرة ثانية ⇒ لا خبر جديد
  before = (await mail(ref)).length;
  await call("ops-request-update", { ref, status: "WAITING_INTERNAL" });      // تُقرأ للعميل «قيد التنفيذ» أيضاً
  assert.equal((await mail(ref)).length, before, "IN_PROGRESS ⇄ WAITING_INTERNAL ليس خبراً");

  before = (await mail(ref)).length;
  r = await call("ops-request-update", { ref, status: "COMPLETED", client_note: "شكراً لصبرك." });
  assert.equal(r.body.ok, true);
  m = (await mail(ref)).slice(0, (await mail(ref)).length - before);
  assert.match(toClient(m)[0].subject, /اكتمل طلبك/);
  assert.ok(toClient(m)[0].body.includes("شكراً لصبرك."));

  // تصحيح صامت
  before = (await mail(ref)).length;
  await call("ops-request-update", { ref, status: "IN_PROGRESS", notify: false });
  assert.equal((await mail(ref)).length, before, "notify:false يصمت");

  // ما يراه العميل: لا مفاتيح آلية
  const g = await call("request-get", { ref });
  const keys = g.body.request.events.map((e) => e.event);
  assert.ok(keys.includes("status.completed"));
  assert.ok(!keys.some((k) => /^notify\./.test(k) || k === "followup.task"), "لا notify.* في خط العميل: " + keys.join());
});

test("تغيير الموعد وإلغاؤه يصلان العميل، وإعادة الحفظ بلا تغيير لا تفعل", async () => {
  const ref = await newRequest("استشارة");
  const day = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
  let before = (await mail(ref)).length;
  await call("ops-appointment", { ref, date: day, time: "11:00" });
  let m = (await mail(ref)).slice(0, (await mail(ref)).length - before);
  assert.match(toClient(m)[0].subject, /تم تثبيت موعدك/);
  assert.ok(toClient(m)[0].body.includes(day) && toClient(m)[0].body.includes("11:00"));
  assert.equal(toOwner(m).length, 0);

  before = (await mail(ref)).length;
  await call("ops-appointment", { ref, date: day, time: "11:00" });
  assert.equal((await mail(ref)).length, before, "لا تغيير ⇒ لا بريد");

  before = (await mail(ref)).length;
  await call("ops-appointment", { ref, date: day, time: "13:30" });
  m = (await mail(ref)).slice(0, (await mail(ref)).length - before);
  assert.match(toClient(m)[0].subject, /تعديل موعدك/);

  before = (await mail(ref)).length;
  await call("ops-appointment", { ref, cancel: true });
  m = (await mail(ref)).slice(0, (await mail(ref)).length - before);
  assert.match(toClient(m)[0].subject, /أُلغي موعدك/);
});

test("رسالة العميل تنبّه المالك وتفتح مهمة ردّ واحدة؛ وردّ المالك يغلقها ويصل العميل", async () => {
  const ref = await newRequest("مخالفة نطاقات");
  let before = (await mail(ref)).length;
  let r = await call("request-message", { ref, content: "هل وصلكم ملفي؟" });
  assert.equal(r.body.ok, true);
  let m = (await mail(ref)).slice(0, (await mail(ref)).length - before);
  assert.equal(toOwner(m).length, 2, "بريد لكل صندوق من صندوقي الشركة");
  assert.ok(toOwner(m)[0].body.includes("هل وصلكم ملفي؟"));
  assert.ok(toOwner(m)[0].body.includes(`/ops?ref=${ref}`));
  assert.equal(toClient(m).length, 0, "لا شيء للعميل");
  assert.ok(m.some((x) => x.kind === "whatsapp" && x.to === "966530540231"), "واتساب المالك");

  // رسالة ثانية داخل النافذة: لا تنبيه جديد، ولا مهمة ثانية
  before = (await mail(ref)).length;
  await call("request-message", { ref, content: "وأيضاً سؤال آخر" });
  assert.equal((await mail(ref)).length, before, "نافذة التهدئة");
  const row = (await sb(`requests?ref=eq.${ref}&select=id`))[0];
  let tasks = await sb(`tasks?request_id=eq.${row.id}&source=eq.reply.customer&select=id,status`);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].status, "open");

  // التنبيه لا يظهر في خط العميل
  const g = await call("request-get", { ref });
  assert.ok(!g.body.request.events.some((e) => /^notify\./.test(e.event)));

  // ردّ المالك
  before = (await mail(ref)).length;
  r = await call("ops-request-message", { ref, content: "وصلنا وجارٍ العمل." });
  assert.equal(r.body.ok, true);
  m = (await mail(ref)).slice(0, (await mail(ref)).length - before);
  assert.equal(toClient(m).length, 1);
  assert.ok(toClient(m)[0].body.includes(`/my?ref=${ref}`));
  tasks = await sb(`tasks?request_id=eq.${row.id}&source=eq.reply.customer&select=id,status`);
  assert.equal(tasks[0].status, "done", "ردّ المالك يغلق مهمة الردّ");
});

test("المستند المطلوب: رفع حقيقي يقلب البند إلى استُلم ويُحفظ بمسار لا برابط", async () => {
  const ref = await newRequest("رخصة");
  const before = (await mail(ref)).length;
  const up = await call("attachment-add", { ref, name: "iqama.pdf", mime: "application/pdf", base64: pdf(), doc_index: 0 });
  assert.equal(up.body.ok, true, JSON.stringify(up.body));
  assert.equal(up.body.received, "صورة الإقامة");
  assert.equal(up.body.documents[0].status, "received");
  assert.ok(up.body.documents[0].received_at);
  assert.equal(up.body.documents[1].status, "requested");
  const att = up.body.attachments[0];
  assert.ok(att.id && att.file === true);
  assert.equal(att.path, undefined, "المسار لا يصل المتصفح");
  assert.equal(att.doc, "صورة الإقامة");

  const row = (await sb(`requests?ref=eq.${ref}&select=attachments,documents`))[0];
  assert.match(row.attachments[0].path, /^requests\/BP-R-[0-9A-F]+\/\d+-[0-9a-f]+\.pdf$/);
  assert.equal(row.attachments[0].url, undefined, "لا رابط طويل العمر في الصف");

  // المالك ينبَّه
  const m = (await mail(ref)).slice(0, (await mail(ref)).length - before);
  assert.equal(toOwner(m).length, 2);
  assert.ok(toOwner(m)[0].body.includes("صورة الإقامة"));

  // ويراه في طلبه برابط موقّع بلا أي تعديل في اللوحة (name + url + note)
  const o = await call("ops-request", { ref });
  const a = o.body.request.attachments[0];
  assert.ok(a.url && !a.path, "لوحة العمليات: رابط موقّع");
  assert.match(a.note, /مستند مطلوب: صورة الإقامة/);

  // المالك يعفي بنداً يدوياً
  const r = await call("ops-request-update", { ref, documents: [{ title: "صورة الإقامة", status: "received" }, { title: "السجل التجاري", status: "waived" }] });
  assert.equal(r.body.ok, true);
  const docs = (await sb(`requests?ref=eq.${ref}&select=documents`))[0].documents;
  assert.equal(docs[1].status, "waived");
  assert.ok(docs[1].received_at);
});

test("الرفع يرفض الصيغة والحجم والملف المتنكّر ورابط javascript:", async () => {
  const ref = await newRequest("رفض الملفات");
  const bad = await call("attachment-add", { ref, name: "x.exe", mime: "application/x-msdownload", base64: Buffer.from("MZ....").toString("base64") });
  assert.equal(bad.status, 400); assert.equal(bad.body.error, "bad_type");
  // يدّعي PDF وهو ليس كذلك
  const fake = await call("attachment-add", { ref, name: "fake.pdf", mime: "application/pdf", base64: Buffer.from("<html>not a pdf</html>").toString("base64") });
  assert.equal(fake.status, 400); assert.equal(fake.body.error, "bad_type");
  // أكبر من ٨ ميجابايت: يُرفض قبل أن يُبنى Buffer
  const big = await call("attachment-add", { ref, name: "big.pdf", mime: "application/pdf", base64: "A".repeat(11 * 1024 * 1024) });
  assert.equal(big.status, 413); assert.equal(big.body.error, "too_large");
  // مجرّد القسم الأخير: نوع صامت يُستنتج من الامتداد
  const quiet = await call("attachment-add", { ref, name: "scan.PDF", mime: "", base64: pdf() });
  assert.equal(quiet.body.ok, true);
  // الرابط القديم: javascript: لا يُحفظ
  const js = await call("attachment-add", { ref, name: "link", url: "javascript:alert(1)" });
  assert.equal(js.body.ok, true);
  const row = (await sb(`requests?ref=eq.${ref}&select=attachments`))[0];
  assert.ok(row.attachments.every((a) => !/^javascript:/i.test(a.url || "")));
  // عميل آخر لا يرفع على طلب ليس طلبه
  const other = await call("attachment-add", { ref, name: "a.pdf", mime: "application/pdf", base64: pdf() }, OTHER);
  assert.equal(other.status, 404);
});

test("المخرجات: لا تسليم قبل الدفع، ثم يراها العميل ويحمّلها بعد التحقق من الملكية ويُبلَّغ", async () => {
  const ref = await newRequest("تسليم");
  await call("ops-quote", { ref, items: [{ title: "خدمة", price: 100, qty: 1 }] });
  const row0 = (await sb(`requests?ref=eq.${ref}&select=id,quote`))[0];
  assert.ok(row0.quote);

  let r = await call("ops-deliverable-add", { ref, title: "التقرير", name: "report.pdf", mime: "application/pdf", base64: pdf() });
  assert.equal(r.status, 409); assert.equal(r.body.error, "not_paid");

  await sb(`requests?id=eq.${row0.id}`, { method: "PATCH", body: { status: "IN_PROGRESS", payment: { status: "PAID", amount: 115 } } });
  const before = (await mail(ref)).length;
  r = await call("ops-deliverable-add", { ref, title: "التقرير النهائي", note: "نسخة معتمدة", name: "report.pdf", mime: "application/pdf", base64: pdf(50) });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.equal(r.body.deliverable.path, undefined);
  const m = (await mail(ref)).slice(0, (await mail(ref)).length - before);
  assert.equal(toClient(m).length, 1);
  assert.match(toClient(m)[0].subject, /سلّمنا لك: التقرير النهائي/);
  assert.ok(toClient(m)[0].body.includes(`/my?ref=${ref}`));
  assert.equal(toOwner(m).length, 0);

  // العميل يراه
  const g = await call("request-get", { ref });
  const d = g.body.request.attachments.find((a) => a.kind === "deliverable");
  assert.equal(d.title, "التقرير النهائي");
  assert.equal(d.by, "team");
  assert.equal(d.path, undefined);
  assert.ok(d.id && d.file);

  // ويحمّله برابط قصير
  const link = await call("attachment-link", { ref, id: d.id });
  assert.equal(link.body.ok, true);
  assert.ok(link.body.url);
  // عميل آخر: لا طلب ولا ملف
  assert.equal((await call("attachment-link", { ref, id: d.id }, OTHER)).status, 404);
  // معرّف من طلب آخر لا يُفتح عبر هذا الطلب
  const ref2 = await newRequest("طلب ثانٍ");
  assert.equal((await call("attachment-link", { ref: ref2, id: d.id })).status, 404);

  // «تسليم وإغلاق» برسالة واحدة
  const before2 = (await mail(ref)).length;
  r = await call("ops-deliverable-add", { ref, title: "الملحق", name: "annex.pdf", mime: "application/pdf", base64: pdf(5), complete: true });
  assert.equal(r.body.status, "COMPLETED");
  const m2 = (await mail(ref)).slice(0, (await mail(ref)).length - before2);
  assert.equal(toClient(m2).length, 1, "رسالة واحدة لا اثنتان");
  assert.match(toClient(m2)[0].body, /اكتمل طلبك/);

  // اللوحة ترى الملفين برابط موقّع، والحذف يزيل الملف
  const o = await call("ops-request", { ref });
  const files = o.body.request.attachments.filter((a) => a.kind === "deliverable");
  assert.equal(files.length, 2);
  assert.ok(files.every((f) => f.url && !f.path));
  const del = await call("ops-deliverable-delete", { ref, id: d.id });
  assert.equal(del.body.ok, true);
  assert.equal((await call("attachment-link", { ref, id: d.id })).status, 404);
});
