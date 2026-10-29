// لوحة /ops الديناميكية: إحاطة اليوم، حركة الموقع الحيّة، الأدوات، المراجعة.
// قاعدة محلية وبلا شبكة. القاعدة التي يحرسها هذا الملف: ما لا مصدر له «غير مقيس» (null) لا صفر،
// وما يكتبه النموذج لا يصل المالك إن فيه رقماً لا أصل له.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

process.env.APP_ENV = "development";
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "ops-dynamic-"));
for (const k of ["RESEND_API_KEY", "RESEND_KEY", "DAFTRA_API_KEY", "WHATSAPP_TOKEN", "SIMPLE_NOTIFY", "AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_KEY", "AZURE_OPENAI_API_KEY", "AZURE_AI_KEY", "AZURE_AI_ENDPOINT", "NOTION_TOKEN", "BusinessPartnerSiteNotion", "NOTION_SECRET", "NOTION_API_KEY", "NOTION_KEY", "NOTION_INTEGRATION_TOKEN", "NOTION"]) delete process.env[k];

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
globalThis.fetch = async (url) => { throw new Error("a local run must not reach the network: " + url); };

const M = await import("../api/_ops-dynamic.js");
const { buildSimpleOps } = await import("../site/scripts/simple-v1-ops.mjs");
const { handleSimple, SALES_ACTIONS } = await import("../api/_simple.js");
const { default: requestsHandler } = await import("../api/requests.js");
const { sb } = await import("../api/_db.js");

const NOW = Date.parse("2026-10-29T06:30:00Z"); // 09:30 الرياض، الخميس
const ago = (d, h = 0) => new Date(NOW - d * 864e5 - h * 3600e3).toISOString();
const req = (ref, status, o = {}) => ({ ref, status, title: "طلب " + ref, client_name: "عميل " + ref, created_at: ago(5), updated_at: ago(o.idle ?? 1), ...o });

// ------------------------------------------------------------- الوحدة --
test("حقائق اليوم: الأعداد من الصفوف، والمتابعات بلا مزوّد «غير مقيس» لا صفر", () => {
  const f = M.buildTodayFacts({
    now: NOW,
    requests: [req("A1", "NEW", { idle: 0 }), req("A2", "NEW", { idle: 4 }), req("A3", "SIGNED", { quote: { total: 1000 } }), req("A4", "PAYMENT_PENDING", { quote: { total: 2500 } }), req("A5", "PAID"), req("A6", "CONTRACT_SENT"),
      req("A7", "QUOTE_SENT"), req("A8", "COMPLETED"),
      req("A9", "REVIEWING", { appointment: { date: "2026-10-29", time: "11:00", status: "BOOKED", topic: "تأسيس" } })],
    tasks: [{ id: "t1", status: "open", due_at: ago(2) }, { id: "t2", status: "open", due_at: new Date(NOW + 3600e3).toISOString() }, { id: "t3", status: "in_progress", human_action: true }, { id: "t4", status: "done", due_at: ago(9) }],
    events: [{ event: "request.created.manual" }, { event: "payment.paid" }, { event: "message.customer" }, { event: "message.customer" }],
  });
  const v = (k) => f.metrics.find((m) => m.key === k);
  assert.equal(v("new").value, 2);
  assert.equal(v("new").oldest_days, 4);
  assert.equal(v("payments").value, 2);
  assert.equal(v("payments").amount, 3500);
  assert.equal(v("paid").value, 1);
  assert.equal(v("contracts").value, 1);
  assert.equal(v("quotes").value, 1);
  assert.equal(v("tasks_overdue").value, 1, "المنجزة لا تُحسب متأخرة");
  assert.equal(v("human").value, 1);
  assert.equal(v("appointments").value, 1);
  assert.equal(f.appointments[0].time, "11:00");
  assert.equal(f.moved.created, 1);
  assert.equal(f.moved.messages, 2);
  const fu = v("followups");
  assert.equal(fu.value, null, "بلا مزوّد نوشن: لا صفر");
  assert.equal(fu.state, "na");
  assert.equal(f.need[0].why, "دفع وصل ولم يبدأ التنفيذ", "الأولوية: المدفوع الذي لم يبدأ");
});

test("القالب الثابت: يقول الحقيقة، ولا يكتب صفراً لما لم يُقَس", () => {
  const f = M.buildTodayFacts({ now: NOW, requests: [req("B1", "NEW")], tasks: [], events: [] });
  const t = M.templateBrief(f);
  assert.match(t, /صباح الخير/);
  assert.match(t, /الخميس 29 أكتوبر 2026/);
  assert.match(t, /طلب واحد جديداً/);
  assert.ok(!/نوشن/.test(t), "المتابعات غير المقيسة لا تُذكر أصفاراً");
  const empty = M.templateBrief(M.buildTodayFacts({ now: NOW }));
  assert.match(empty, /لا شيء عالق/);
});

test("الجمع العربي: واحد ومثنى وقلّة وكثرة", () => {
  assert.equal(M.plural(1, ["عقد واحد", "عقدان", "عقود", "عقداً"]), "عقد واحد");
  assert.equal(M.plural(2, ["عقد واحد", "عقدان", "عقود", "عقداً"]), "عقدان");
  assert.equal(M.plural(5, ["عقد واحد", "عقدان", "عقود", "عقداً"]), "5 عقود");
  assert.equal(M.plural(12, ["عقد واحد", "عقدان", "عقود", "عقداً"]), "12 عقداً");
});

const facts = M.buildTodayFacts({ now: NOW, requests: [req("C1", "NEW"), req("C2", "NEW"), req("C3", "PAID")], tasks: [], events: [{ event: "payment.paid" }] });
const good = "صباح الخير، اليوم الخميس 29 أكتوبر 2026. لديك 2 من الطلبات الجديدة التي لم تُراجع بعد، وطلب واحد مدفوع ينتظر بدء التنفيذ. وصلت دفعة واحدة منذ أمس.";

test("حارس النص: يقبل ما أرقامه من الحقائق، ويرفض الرقم المخترع والروابط", () => {
  assert.equal(M.guardBrief(good, facts).ok, true);
  const invented = M.guardBrief(good + " وهناك 14 عقداً بلا توقيع.", facts);
  assert.equal(invented.ok, false);
  assert.match(invented.why, /^number:14$/);
  assert.equal(M.guardBrief(good + " https://evil.example", facts).ok, false);
  assert.equal(M.guardBrief("قصير", facts).ok, false);
  const ar = M.guardBrief(good.replace("2 من", "٢ من"), facts);
  assert.equal(ar.ok, true, "الأرقام العربية تُطبَّع قبل الفحص");
});

test("الموجّه: أرقام وعناوين المقاييس فقط — لا أسماء عملاء ولا عناوين طلبات", () => {
  const p = M.promptFor(facts);
  assert.ok(!p.user.includes("عميل C1") && !p.user.includes("طلب C1"));
  assert.match(p.system, /لا تخترع/);
});

test("إحاطة Azure: تُخزَّن مؤقتاً، والإعادة القسرية لا تتكرر قبل دقيقة، والفشل يعود للقالب", async () => {
  M.__resetBriefCache();
  let calls = 0;
  const chat = async () => { calls++; return good; };
  const a = await M.makeBrief({ facts, chat, configured: true, now: NOW });
  assert.equal(a.source, "azure");
  assert.equal(a.cached, false);
  const b = await M.makeBrief({ facts, chat, configured: true, now: NOW + 60e3 });
  assert.equal(b.cached, true);
  assert.equal(calls, 1, "لا نداء ثانٍ داخل عشرين دقيقة");
  const forced = await M.makeBrief({ facts, chat, configured: true, now: NOW + 30e3, force: true });
  assert.equal(forced.cached, true, "الإلحاح قبل دقيقة يُعاد من الذاكرة");
  const after = await M.makeBrief({ facts, chat, configured: true, now: NOW + 5 * 60e3, force: true });
  assert.equal(after.cached, false);
  assert.equal(calls, 2);
  // الأرقام تغيّرت داخل المدة: النص يُعاد ويُعلَّم قديماً
  const f2 = M.buildTodayFacts({ now: NOW, requests: [req("C1", "NEW")], tasks: [], events: [] });
  const stale = await M.makeBrief({ facts: f2, chat, configured: true, now: NOW + 6 * 60e3 });
  assert.equal(stale.cached, true);
  assert.equal(stale.stale_facts, true);

  M.__resetBriefCache();
  const bad = await M.makeBrief({ facts, chat: async () => good + " و99 عقداً.", configured: true, now: NOW });
  assert.equal(bad.source, "template");
  assert.match(bad.reason, /^guard_number:99$/);
  M.__resetBriefCache();
  const boom = await M.makeBrief({ facts, chat: async () => { throw new Error("azure 500"); }, configured: true, now: NOW });
  assert.equal(boom.source, "template");
  assert.equal(boom.reason, "azure_failed");
  const cool = await M.makeBrief({ facts, chat: async () => good, configured: true, now: NOW + 30e3 });
  assert.equal(cool.reason, "cooldown", "بعد الفشل لا إلحاح على Azure");
  M.__resetBriefCache();
  const off = await M.makeBrief({ facts, chat: async () => good, configured: false, now: NOW });
  assert.equal(off.source, "template");
  assert.equal(off.reason, "azure_not_configured");
});

test("المراجعة: العالق بحسب العتبة، وصحة المصدر قبل الأرقام", () => {
  const r = M.buildReview({
    now: NOW, staleDays: 3,
    requests: [req("D1", "QUOTE_SENT", { idle: 5 }), req("D2", "QUOTE_SENT", { idle: 1 }), req("D3", "CONTRACT_SENT", { idle: 9 }), req("D4", "PAID", { idle: 4 }), req("D5", "NEW", { idle: 0 }),
      req("D6", "COMPLETED", { idle: 30 }), req("D7", "PAID", { idle: 2, payment: { status: "PAID", amount: 400, at: ago(2) } })],
    tasks: [
      { id: "1", status: "open", title: "قديمة", created_at: ago(40), due_at: ago(6) },
      { id: "2", status: "open", created_at: ago(30) }, { id: "3", status: "open", created_at: ago(20) }, { id: "4", status: "open", created_at: ago(1) }],
    events: [{ event: "quote.sent", created_at: ago(1) }, { event: "quote.sent", created_at: ago(2) }, { event: "quote.sent", created_at: ago(10) }, { event: "payment.paid", created_at: ago(1) }],
    health: { followup_last_at: ago(5), digest_last_at: null },
  });
  const q = r.stuck.find((g) => g.status === "QUOTE_SENT");
  assert.equal(q.count, 1, "العرض الساكن يوماً واحداً ليس عالقاً");
  assert.equal(q.items[0].ref, "D1");
  assert.ok(r.stuck.some((g) => g.status === "CONTRACT_SENT" && g.oldest_days === 9));
  assert.ok(!r.stuck.some((g) => g.status === "NEW"), "طلب اليوم ليس عالقاً");
  assert.equal(r.stuck.find((g) => g.status === "PAID").hot, true);
  assert.equal(r.alert.level, "bad", "مدفوع لم يبدأ ⇒ تنبيه حرج");
  assert.equal(r.tasks.overdue, 1);
  assert.equal(r.tasks.old_open, 3);
  assert.equal(r.week.current.quotes_sent, 2);
  assert.equal(r.week.previous.quotes_sent, 1);
  assert.equal(r.week.current.revenue, 400);
  const c = Object.fromEntries(r.health.checks.map((x) => [x.key, x]));
  assert.equal(c.tasks.state, "bad", "٧٥٪ من المهام متروكة");
  assert.equal(c.followup.state, "bad", "المتابعة لم تعمل منذ خمسة أيام");
  assert.equal(c.digest.state, "na", "لا سجلّ = غير مقيس لا سليم");
  assert.equal(r.health.level, "bad");
});

test("المراجعة بلا بيانات: غير مقيس، لا «كل شيء سليم»", () => {
  const r = M.buildReview({ now: NOW });
  assert.equal(r.health.checks.find((c) => c.key === "requests").state, "na");
  assert.equal(r.alert.level, "ok");
});

test("الأدوات: المسار بلا بادئة اللغة يُعدّ، والزوار الفريدون، والمدة السابقة", () => {
  const strip = (p) => String(p).replace(/^\/(ar|en)(?=\/|$)/, "") || "/";
  const v = (visitor, p) => ({ visitor, path: p, kind: "view" });
  const out = M.toolUsage([v("a", "/ar/calculators/gosi"), v("a", "/calculators/gosi"), v("b", "/calculators/gosi"), v("c", "/compliance-solutions"), v("d", "/guide/residency"), v("e", "/catalog")], [v("a", "/calculators/gosi")], strip);
  const by = Object.fromEntries(out.map((x) => [x.key, x]));
  assert.equal(by["calc-gosi"].views, 3);
  assert.equal(by["calc-gosi"].visitors, 2);
  assert.equal(by["calc-gosi"].prev_views, 1);
  assert.equal(by.localization.views, 1);
  assert.equal(by.guide.views, 1, "/guide/* تحت الدليل");
  assert.equal(out.reduce((s, x) => s + x.views, 0), 5, "/catalog ليست أداة");
});

// -------------------------------------------------------------- الخادم --
async function ops(action, body = {}, key = "test-ops") {
  const out = { status: 200, body: null };
  const res = { statusCode: 200, setHeader() {}, end(b) { out.status = this.statusCode; try { out.body = JSON.parse(b); } catch { out.body = b; } } };
  await handleSimple({ method: "POST", headers: {}, socket: {}, query: {}, body: { action, key, ...body } }, res);
  return out;
}
async function viaRequests(query, headers = {}) {
  const out = { status: 200, body: null };
  const res = { statusCode: 200, setHeader() {}, end(b) { out.status = this.statusCode; try { out.body = JSON.parse(b); } catch { out.body = b; } } };
  await requestsHandler({ method: "GET", headers: { host: "localhost:3000", ...headers }, socket: {}, query }, res);
  return out;
}
const live = new Date().toISOString();
const agoR = (d, h = 0) => new Date(Date.now() - d * 864e5 - h * 3600e3).toISOString(); // الخادم يقرأ الساعة الحقيقية
const orgId = crypto.randomUUID();
// القاعدة المحلية تُبذَّر من db/seed.local.json — نفرّغ ما تقرؤه اللوحة ليكون العدّ عدّنا وحدنا.
for (const t of ["requests?ref=neq.-", "tasks?title=neq.-", "request_events?event=neq.-", "page_hits?path=neq.-", "site_errors?path=neq.-"]) await sb(t, { method: "DELETE" }).catch(() => {});
await sb("requests", { method: "POST", prefer: "return=minimal", body: [
  { ref: "BP-R-DYN001", type: "CONSULTATION", source: "WEBSITE", status: "NEW", title: "استشارة تأسيس", client_name: "عميل أول", conversation: [], scope: [], created_at: live, updated_at: live },
  { ref: "BP-R-DYN002", type: "GOVERNMENT_SERVICE", source: "AI_ASSISTANT", status: "PAID", title: "تعديل مهنة", client_name: "عميل ثان", payment: { status: "PAID", amount: 1150, at: live }, quote: { total: 1150 }, conversation: [], scope: [], created_at: agoR(2), updated_at: agoR(4) },
  { ref: "BP-R-DYN003", type: "GOVERNMENT_SERVICE", source: "WEBSITE", status: "QUOTE_SENT", title: "عرض بلا رد", client_name: "عميل ثالث", quote: { total: 800, status: "SENT" }, conversation: [], scope: [], created_at: agoR(8), updated_at: agoR(7) },
] });
await sb("tasks", { method: "POST", prefer: "return=minimal", body: [
  { organization_id: orgId, title: "اتصل بالعميل", assignee: "bp", status: "open", urgency: "normal", human_action: true, due_at: agoR(3), created_at: agoR(20) },
] });

test("ops-today: حقائق حيّة + إحاطة قالب حين لا Azure + نوشن غير مقيس", async () => {
  M.__resetBriefCache();
  const r = await ops("ops-today");
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.ok, true);
  assert.equal(r.body.azure, false);
  assert.equal(r.body.brief.source, "template");
  assert.equal(r.body.brief.reason, "azure_not_configured");
  const v = (k) => r.body.facts.metrics.find((m) => m.key === k);
  assert.equal(v("new").value, 1);
  assert.equal(v("paid").value, 1);
  assert.equal(v("quotes").value, 1);
  assert.equal(v("tasks_overdue").value, 1);
  assert.equal(v("human").value, 1);
  assert.equal(v("followups").value, null, "بلا رمز نوشن: غير مقيس");
  assert.equal(v("followups").state, "na");
  assert.ok(r.body.brief.text.includes("يحتاجك"));
});

test("ops-today: Azure مضبوط ⇒ النص من النموذج (azureChat) مرّ بالحارس وخُزّن", async () => {
  M.__resetBriefCache();
  process.env.AZURE_OPENAI_ENDPOINT = "https://example.openai.azure.com";
  process.env.AZURE_OPENAI_KEY = "k";
  let seen = null;
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    seen = { url: String(url), body: JSON.parse(init.body) };
    return { ok: true, json: async () => ({ choices: [{ message: { content: "صباح الخير، اليوم أمامك طلب واحد جديد وطلب واحد مدفوع ينتظر بدء التنفيذ، وعرض سعر واحد ينتظر ردّ العميل، ومهمة متأخرة واحدة تحتاج تدخلاً." } }] }) };
  };
  try {
    const r = await ops("ops-today");
    assert.equal(r.body.brief.source, "azure", JSON.stringify(r.body.brief));
    assert.match(seen.url, /openai\.azure\.com/, "Azure وحده");
    assert.ok(!seen.body.messages.some((m) => /عميل أول|استشارة تأسيس/.test(String(m.content))), "لا نص حرّ من العملاء في الموجّه");
    const again = await ops("ops-today");
    assert.equal(again.body.brief.cached, true);
  } finally {
    globalThis.fetch = real;
    delete process.env.AZURE_OPENAI_ENDPOINT; delete process.env.AZURE_OPENAI_KEY;
    M.__resetBriefCache();
  }
});

test("ops-review: عالق وصحة مصدر، للقراءة فقط", async () => {
  const r = await ops("ops-review", { stale_days: 3 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const rv = r.body.review;
  assert.ok(rv.stuck.some((g) => g.status === "QUOTE_SENT" && g.count === 1));
  assert.ok(rv.stuck.some((g) => g.status === "PAID" && g.hot));
  assert.ok(rv.health.checks.find((c) => c.key === "followup").state === "na", "لا سجلّ متابعة = غير مقيس");
  assert.equal(rv.stale_days, 3);
  const clamp = await ops("ops-review", { stale_days: 9999 });
  assert.equal(clamp.body.review.stale_days, 30);
});

test("الإجراءان الجديدان مغلقان: بلا مفتاح 401، وليسا في دور المبيعات", async () => {
  for (const a of ["ops-today", "ops-review"]) {
    assert.equal((await ops(a, {}, "wrong")).status, 401, a);
    assert.ok(!SALES_ACTIONS.has(a), a);
  }
});

const hit = (visitor, p, minsAgo = 0, kind = "view") => sb("page_hits", { method: "POST", prefer: "return=minimal", body: [{ at: new Date(Date.now() - minsAgo * 60e3).toISOString(), kind, path: p, visitor, lang: "ar", device: "mobile", ref: "" }] });
await hit("v1", "/ar/calculators/gosi", 1);
await hit("v2", "/compliance-solutions", 3);
await hit("v3", "/", 12);
await hit("v1", "/calculators/gosi", 40);   // خارج نصف الساعة
await hit("staff", "/ar", 2);
await hit("staff", "/ar/ops", 1);           // فتح لوحة ⇒ كل ما له يُستبعد
await sb("site_errors", { method: "POST", prefer: "return=minimal", body: [{ at: live, path: "/x", message: "boom", source: "a.js:1" }] });

test("ops-live: نشطون الآن، زيارات بالدقيقة، الفريق مستبعد، والمفتاح من الترويسة لا الرابط", async () => {
  const no = await viaRequests({ action: "ops-live", key: "test-ops" });
  assert.equal(no.status, 401, "المفتاح في الرابط لا يُقبل لهذا المسار");
  const r = await viaRequests({ action: "ops-live" }, { "x-ops-key": "test-ops" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.active_5m, 2, "v1 وv2 (الفريق مستبعد)");
  assert.equal(r.body.active_30m, 3);
  assert.equal(r.body.views_30m, 3);
  assert.equal(r.body.per_minute.length, 30);
  assert.equal(r.body.per_minute.reduce((a, b) => a + b, 0), 3);
  assert.equal(r.body.errors_1h, 1);
  assert.equal(r.body.requests_1h, 1);
  assert.ok(!r.body.recent.some((x) => /ops/.test(x.path)));
  assert.ok(!JSON.stringify(r.body).includes("v1"), "رمز الزائر لا يخرج");
});

test("ops-analytics: سلسلة المدة السابقة، الأدوات، عدّادات الإنجاز، وأخطاء المدة السابقة", async () => {
  const r = await viaRequests({ action: "ops-analytics", period: "week" }, { "x-ops-key": "test-ops" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const o = r.body;
  assert.equal(o.prevSeries.length, o.series.length);
  assert.equal(typeof o.prev.errors, "number");
  const g = o.tools.find((t) => t.key === "calc-gosi");
  assert.equal(g.views, 2);
  assert.equal(g.visitors, 1);
  assert.equal(o.tools.find((t) => t.key === "localization").views, 1);
  const adv = o.done.find((d) => d.key === "advisor-req");
  assert.equal(adv.measured, true);
  assert.equal(adv.cur, 1, "طلب المستشار عمره يومان: داخل الأسبوع");
  assert.ok(o.done.every((d) => d.measured === true || (d.measured === false && d.why)), "كل عدّاد إما مقيس أو غير مقيس بسببه");
  assert.ok(o.toolsUnmeasured.some((x) => x.key === "advisor-chat"));
  assert.ok(o.pages.every((p) => typeof p.prev_views === "number"));
});

// ---------------------------------------------------------------- الواجهة --
const html = buildSimpleOps({ header: () => "", shell: (o) => o.script }, { lang: () => "ar" });
const js = html.replace(/^<script>/, "").replace(/<\/script>$/, "");

test("الواجهة: سليمة نحوياً، سبعة عناوين، والأقسام الجديدة تبويبات تحت النظرة العامة", () => {
  assert.doesNotThrow(() => new Function(js));
  const block = js.slice(js.indexOf("var SECS=["), js.indexOf("var VSEC="));
  assert.ok(block.includes("['today','اليوم']") && block.includes("['tools','الأدوات']") && block.includes("['review','المراجعة']"));
  assert.ok(block.includes("['analytics','حركة الموقع']") && block.includes("['brain',"));
  assert.equal([...block.matchAll(/^ \['(\w+)','([^']+)','/gm)].length, 7, "سبعة عناوين لا ثمانية");
  assert.ok(js.includes("view:'today'"), "الفتح يبدأ باليوم");
});

test("الواجهة: تحديث دوري يُمسح عند تبديل الصفحة، وحالة لكل بطاقة، ولا مكتبة خارجية", () => {
  assert.ok(js.includes("function render(){clearTimers();"));
  for (const s of ["every(60000", "every(20000", "every(120000", "every(300000", "يعمل · ", "قديم · ", "غير متصل", "غير مقيس", "document.hidden"]) assert.ok(js.includes(s), s);
  assert.ok(!/<script[^>]+src=|https?:\/\/(cdn|unpkg|cdnjs)/.test(html), "الرسوم SVG مضمّنة");
  assert.ok(js.includes("svgSeries(") && js.includes("stroke-dasharray"), "المدة السابقة متقطّعة على الرسم");
});

test("الواجهة: مفتاح اللوحة لا يُرسل في الرابط للإحصائيات والشريط الحيّ", () => {
  assert.ok(!/ops-(analytics|live)[^"']*[?&]key=/.test(js) && !js.includes("'&key='"));
  assert.ok(js.includes("'x-ops-key'"));
});

test("الواجهة: الدماغ وتاريخ الأعمال والعلامة مخطّطة لا مبنية — بلا أرقام", () => {
  const brain = js.slice(js.indexOf("function vBrain"), js.indexOf("function vRequests"));
  assert.ok(brain.includes("مخطّط"));
  assert.ok(!/n0\(|money\(|String\(0\)/.test(brain));
});
