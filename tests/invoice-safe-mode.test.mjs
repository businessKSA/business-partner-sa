// الوضع الآمن للفاتورة: محلياً ولا مفتاح بريد حيّ (EMAIL_MODE الافتراضي «preview»):
//  • بريد الفاتورة يذهب إلى الصندوق الملفّي (.localdb/outbox.json) لا إلى مزوّد البريد، ولا يصل أحداً؛
//  • الفاتورة تُعدّ مكتملة (لا إعادة محاولة أبدية على بريد لا يُرسَل بحكم الوضع)؛
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "invoice-safe-"));
Object.assign(process.env, {
  APP_ENV: "development", LOCAL_DB_DIR: DIR, LOCAL_DB: "1",
  DAFTRA_API_KEY: "unit-daftra-key", DAFTRA_ALLOW_NONLIVE: "1", MKT_SITE_BASE: "http://unit.local",
});
for (const k of ["EMAIL_MODE", "RESEND_API_KEY", "RESEND_KEY", "RESEND", "ACS_CONNECTION_STRING", "SIMPLE_NOTIFY"]) delete process.env[k];

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");

const outside = [];
let invSeq = 0;
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  outside.push(u);
  if (!u.startsWith("https://businesspartner.daftra.com/api2/")) throw new Error("a local run must not reach the network: " + u);
  const p = new URL(u).pathname.replace("/api2", "");
  if (p === "/taxes.json") return json({ data: [{ Tax: { id: 7, value: "15", is_active: 1 } }] });
  if (p === "/clients.json") return (init.method === "POST") ? json({ result: "successful", id: 11 }) : json({ data: [] });
  if (p === "/invoices.json" && init.method === "POST") return json({ result: "successful", id: 8000 + ++invSeq });
  if (/^\/invoices?\/\d+\.json$/.test(p)) return json({ Invoice: { id: 8001, no: "INV8001" } });
  if (p === "/invoice_payments.json") return json({ result: "successful", id: 1 });
  return new Response("nf", { status: 404 });
};

const { markRequestPaidByRef } = await import("../api/_simple.js");
const { sb } = await import("../api/_db.js");
const { outboxList } = await import("../api/_mode.js");
const { daftraResetPdfCache } = await import("../api/_daftra.js");
daftraResetPdfCache();

const ORG = "2fcd5b83-144c-4434-be82-aac28b9e19c6", USER = "7b2db20a-2404-41ce-b7af-8db1d3fabc95";
async function signedRequest(ref) {
  await sb("requests", { method: "POST", body: [{
    ref, organization_id: ORG, user_id: USER, type: "GOVERNMENT_SERVICE", source: "WEBSITE", status: "SIGNED", lang: "ar", title: "خدمة",
    quote: { number: "Q-9", status: "APPROVED", net: 1000, vat: 150, total: 1150, items: [{ title: "خدمة", qty: 1, price: 1000, line: 1000 }] },
    client_name: "عميل", client_email: "client@test.local", client_phone: "0500000000",
  }] });
}

test("بريد الفاتورة في وضع المعاينة: إلى الصندوق الملفّي، والفاتورة مكتملة، ولا مزوّد بريد يُستدعى", async () => {
  await signedRequest("BP-R-0A0A0A");
  const up = await markRequestPaidByRef("BP-R-0A0A0A", { provider: "moyasar", payId: "mock_card_safe0001", amount: 1150, test: false, actor: "moyasar" });
  assert.equal(up.status, "PAID");
  const inv = (await sb("requests?ref=eq.BP-R-0A0A0A&select=invoice"))[0].invoice;
  assert.equal(inv.mode, "daftra");
  assert.equal(inv.status, "issued", "لا إعادة محاولة أبدية");
  assert.match(inv.delivery.skipped, /email_mode_preview/);
  assert.ok(!inv.delivery.sent_at);
  const mails = (await outboxList(200)).filter((m) => m.kind === "email" && /^فاتورة /.test(m.subject));
  assert.equal(mails.length, 1);
  assert.equal(mails[0].to, "client@test.local");
  assert.ok(mails[0].body.includes(inv.number));
  assert.ok(!outside.some((u) => /resend|azure/i.test(u)), "لا مزوّد بريد");
});
