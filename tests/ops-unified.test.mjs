// لوحة /ops الواحدة (المرحلتان ١ و٢): الشريط بسبعة عناوين، «نظرة عامة على الأعمال»،
// إجراء «حسابات جديدة»، واستبعاد زيارات اللوحات من أرقام الزوّار. قاعدة محلية وبلا شبكة.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

process.env.APP_ENV = "development";
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "ops-unified-"));
for (const k of ["RESEND_API_KEY", "RESEND_KEY", "DAFTRA_API_KEY", "WHATSAPP_TOKEN", "SIMPLE_NOTIFY"]) delete process.env[k];

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
globalThis.fetch = async (url) => { throw new Error("a local run must not reach the network: " + url); };

const { buildSimpleOps } = await import("../site/scripts/simple-v1-ops.mjs");
const { handleSimple } = await import("../api/_simple.js");
const { default: requestsHandler } = await import("../api/requests.js");
const { sb } = await import("../api/_db.js");

const html = buildSimpleOps({ header: () => "", shell: (o) => o.script }, { lang: () => "ar" });
const js = html.replace(/^<script>/, "").replace(/<\/script>$/, "");

test("سكربت /ops سليم نحوياً", () => {
  assert.doesNotThrow(() => new Function(js));
});

test("الشريط الجانبي سبعة عناوين عربية بالترتيب المطلوب", () => {
  const titles = ["نظرة عامة على الأعمال", "العمليات", "الصندوق", "العملاء", "المالية", "الفريق والوكلاء", "الإعدادات"];
  const block = js.slice(js.indexOf("var SECS=["), js.indexOf("var VSEC="));
  const found = [...block.matchAll(/^ \['(\w+)','([^']+)'/gm)].map((m) => m[2]);
  assert.deepEqual(found, titles);
});

test("كل صفحات /ops القديمة ما زالت تبويباً تحت قسم، وروابط ?view= القديمة تعمل", () => {
  const block = js.slice(js.indexOf("var SECS=["), js.indexOf("var VSEC="));
  for (const v of ["requests", "quotes", "contracts", "appointments", "tasks", "human", "deleted", "catalog", "inbox", "whatsapp", "email", "clients", "payments", "invoices", "follow", "settings", "analytics"])
    assert.ok(block.includes(`['${v}',`), "تبويب " + v);
  assert.ok(js.includes("home:'overview'"), "?view=home يقود إلى نظرة عامة");
});

test("الأقسام غير المنقولة تقول «تُنقل قريباً» وتفتح اللوحة القديمة، بلا أصفار مختلقة", () => {
  assert.ok(js.includes("تُنقل قريباً"));
  for (const href of ["href:'/admin'", "href:'/monitor'", "href:'/dashboard'"]) assert.ok(js.includes(href), href);
  const soon = js.slice(js.indexOf("function vFinanceSoon"), js.indexOf("// ---------- نظرة عامة على الأعمال"));
  assert.ok(!/money\(|n0\(|String\(0\)/.test(soon), "صفحات «قريباً» بلا أي رقم");
});

test("نظرة عامة: ثلاثة أرقام متجاورة وتسمية صريحة للمدفوع والقنوات غير المقيسة", () => {
  for (const s of ["زوّار مختلفون", "حسابات جديدة", "طلبات جديدة", "api('ops-new-accounts')", "إجمالي المدفوع شاملاً الضريبة", "غير مقيس", "غير متاح"]) assert.ok(js.includes(s), s);
  assert.ok(!js.includes("عملاء جدد هذا الشهر"), "التقريب المضلّل القديم حُذف");
});

// ------------------------------------------------------------ الخادم --
async function ops(action, body = {}, key = "test-ops") {
  const out = { status: 200, body: null };
  const res = { statusCode: 200, setHeader() {}, end(b) { out.status = this.statusCode; try { out.body = JSON.parse(b); } catch { out.body = b; } } };
  await handleSimple({ method: "POST", headers: {}, socket: {}, query: {}, body: { action, key, ...body } }, res);
  return out;
}
const ago = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const user = (email, hoursAgo, staff = false) => ({ id: crypto.randomUUID(), email, full_name: email, locale: "ar", is_bp_staff: staff, created_at: ago(hoursAgo), updated_at: ago(hoursAgo) });
await sb("users", { method: "POST", prefer: "return=minimal", body: [
  user("a@clients.example", 1), user("b@clients.example", 3), user("c@clients.example", 24 * 3),
  user("d@clients.example", 24 * 15), user("e@clients.example", 24 * 70),
  user("staff@businesspartner.sa", 2, true), user("dr.baher.magnas@gmail.com", 2), user("t@test.local", 2),
] });

test("ops-new-accounts: يعدّ حسابات العملاء فقط ويستبعد الموظفين والمالك وحسابات الاختبار", async () => {
  const r = await ops("ops-new-accounts");
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.windows.day.count, 2, "يوم: a و b");
  assert.equal(r.body.windows.week.count, 3, "أسبوع: + c");
  assert.equal(r.body.windows.month.count, 4, "شهر: + d");
  assert.ok(r.body.excluded >= 3, "موظف + مالك + test.local");
  assert.equal(r.body.source, "users.created_at");
});

test("ops-new-accounts: مغلق بلا مفتاح، ومغلق على دور المبيعات", async () => {
  const bad = await ops("ops-new-accounts", {}, "wrong");
  assert.equal(bad.status, 401);
  const { SALES_ACTIONS } = await import("../api/_simple.js");
  assert.ok(!SALES_ACTIONS.has("ops-new-accounts"));
});

async function analytics(period = "week") {
  const out = { status: 200, body: null };
  const res = { statusCode: 200, setHeader() {}, end(b) { out.status = this.statusCode; try { out.body = JSON.parse(b); } catch { out.body = b; } } };
  await requestsHandler({ method: "GET", headers: {}, socket: {}, query: { action: "ops-analytics", period, key: "test-ops" } }, res);
  return out;
}
const hit = (visitor, p) => sb("page_hits", { method: "POST", prefer: "return=minimal", body: [{ at: new Date().toISOString(), kind: "view", path: p, visitor, lang: "ar", device: "desktop", ref: "" }] });
for (const p of ["/ar", "/ar/catalog"]) await hit("cust-1", p);
await hit("cust-2", "/ar");
await hit("team-1", "/ar");
await hit("team-1", "/ar/ops");
await hit("team-2", "/admin");

test("ops-analytics: زائر فتح صفحة لوحة واحدة يُستبعد كله، وصفحات اللوحات لا تُحسب", async () => {
  const r = await analytics("week");
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.totals.visitors, 2, "العميلان فقط");
  assert.equal(r.body.totals.views, 3);
  assert.equal(r.body.excluded.visitors, 2);
  assert.equal(r.body.excluded.rows, 3);
  assert.ok(!r.body.pages.some((x) => /^\/(ops|admin)/.test(x.path)));
  assert.ok(!r.body.excluded.panel_paths.includes("/dashboard"), "/dashboard على مضيف التوظيف لوحة عملاء حقيقيين");
});
