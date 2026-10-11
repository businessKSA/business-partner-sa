// بلا مفتاح الدفترة محلياً: يبقى رقم الاختبار الداخلي TEST-INV- (لا يُختلق رقم «INV-» يظنّه العميل فاتورة)،
// ولا يُستدعى أحد، والفاتورة تُعدّ مكتملة فلا إعادة محاولة ولا مهمة للفريق على بيئة تطوير.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "invoice-nokey-"));
Object.assign(process.env, { APP_ENV: "development", LOCAL_DB_DIR: DIR, LOCAL_DB: "1", MKT_SITE_BASE: "http://unit.local" });
for (const k of ["DAFTRA_API_KEY", "EMAIL_MODE", "RESEND_API_KEY", "RESEND_KEY", "RESEND", "SIMPLE_NOTIFY"]) delete process.env[k];

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
const outside = [];
globalThis.fetch = async (url) => { outside.push(String(url)); throw new Error("a local run must not reach the network: " + url); };

const { markRequestPaidByRef } = await import("../api/_simple.js");
const { sb } = await import("../api/_db.js");

test("بلا مفتاح الدفترة: TEST-INV- داخلي بسبب مكتوب، وبلا شبكة ولا مهمة", async () => {
  await sb("requests", { method: "POST", body: [{
    ref: "BP-R-0B0B0B", organization_id: "2fcd5b83-144c-4434-be82-aac28b9e19c6", user_id: "7b2db20a-2404-41ce-b7af-8db1d3fabc95",
    type: "GOVERNMENT_SERVICE", source: "WEBSITE", status: "SIGNED", lang: "ar", title: "خدمة",
    quote: { number: "Q-9", status: "APPROVED", net: 1000, vat: 150, total: 1150, items: [{ title: "خدمة", qty: 1, price: 1000, line: 1000 }] },
    client_name: "عميل", client_email: "client@test.local", client_phone: "0500000000",
  }] });
  const up = await markRequestPaidByRef("BP-R-0B0B0B", { provider: "moyasar", payId: "mock_card_nokey001", amount: 1150, test: false, actor: "moyasar" });
  assert.equal(up.status, "PAID");
  const row = (await sb("requests?ref=eq.BP-R-0B0B0B&select=id,invoice"))[0];
  assert.equal(row.invoice.number, "TEST-INV-0B0B0B");
  assert.equal(row.invoice.mode, "test");
  assert.equal(row.invoice.daftra.reason, "daftra_not_configured");
  assert.deepEqual(outside, []);
  assert.equal((await sb(`tasks?request_id=eq.${row.id}&select=source`)).filter((t) => t.source === "invoice-failed").length, 0);
});
