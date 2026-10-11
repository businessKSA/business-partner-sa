// لوحة /ops: واجهة «تسليم العمل» وبطاقة المستندات المطلوبة وترجمة الخط الزمني.
// الخادم (ops-deliverable-add / ops-deliverable-delete) مُختبَر في simple-after-order.test.mjs؛
// هنا نثبت أن اللوحة تستدعيه فعلاً، وأن سكربتها سليم نحوياً، وأن مفاتيح الآلة لا تُطبع للمالك.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSimpleOps } from "../site/scripts/simple-v1-ops.mjs";

const html = buildSimpleOps({ header: () => "", shell: (o) => o.script }, { lang: () => "ar" });
const js = html.replace(/^<script>/, "").replace(/<\/script>$/, "");

test("سكربت /ops سليم نحوياً", () => {
  assert.doesNotThrow(() => new Function(js));
});

test("زر تسليم العمل يستدعي ops-deliverable-add و ops-deliverable-delete بحقول العقد", () => {
  assert.match(js, /api\('ops-deliverable-add',\{ref:r\.ref,title:/);
  for (const f of ["note:", "name:f.name", "base64:data", "complete:closable&&cc2.checked", "notify:nn.checked", "force:force"]) assert.ok(js.includes(f), f);
  assert.match(js, /api\('ops-deliverable-delete',\{ref:r\.ref,id:a\.id\}/);
  assert.ok(js.includes("not_paid"), "تأكيد صريح قبل التسليم غير المدفوع");
  assert.ok(js.includes("MAXB=3*1024*1024"), "سقف يناسب حدّ جسم الطلب في الاستضافة");
});

test("الحالات التي لها مسارها لا تمرّ من قائمة الحالة", () => {
  assert.ok(js.includes("to==='CANCELLED'") && js.includes("to==='PAID'&&!paidOk"));
  assert.ok(js.includes("client_note:"));
});

test("الخط الزمني يترجم مفاتيح الآلة", () => {
  assert.ok(js.includes("function evLabel"));
  for (const k of ["status-in-progress", "documents.requested", "'deliverable.added'", "notify."]) assert.ok(js.includes(k), k);
});

test("بطاقة المستندات المطلوبة تحفظ عبر ops-request-update documents", () => {
  assert.match(js, /api\('ops-request-update',\{ref:r\.ref,documents:docs\}/);
});
