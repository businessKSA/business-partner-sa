// إعداد الإنتاج الحقيقي بلا أي مفتاح تجربة: APP_ENV=production (لا DEV) ⇒ PAYMENTS_MODE وEMAIL_MODE «live»
// افتراضياً، ولا DAFTRA_ALLOW_NONLIVE. هنا يُثبَت أن الإصدار الفعلي مسموح بذاته في الإنتاج، وأن بريد الفاتورة
// يخرج إلى مزوّد البريد الحيّ (محاكى) وإلى العميل، وأن المالك لا يتلقى نسخة منه.
// ثم الحالة الأسوأ: دفعة حقيقية والدفترة غير مضبوطة — لا رقم مختلق، ولا صمت.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "invoice-live-"));
const OWNER = "owner@unit.local";
Object.assign(process.env, {
  APP_ENV: "production", LOCAL_DB_DIR: DIR, LOCAL_DB: "1", MKT_SITE_BASE: "http://unit.local",
  RESEND_API_KEY: "re_unit_key", OTP_FROM_EMAIL: "Business Partner <invoices@unit.local>", BP_OWNER_EMAIL: OWNER,
});
for (const k of ["DAFTRA_ALLOW_NONLIVE", "EMAIL_MODE", "PAYMENTS_MODE", "SIMPLE_TEST_MODE", "VERCEL_ENV", "WHATSAPP_TOKEN", "ACS_CONNECTION_STRING"]) delete process.env[k];
// الملف يعمل مرتين بالحالتين عبر عملية فرعية (الثوابت تُقرأ عند الاستيراد)
if (process.env.INVOICE_LIVE_CHILD !== "1") {
  const { default: test } = await import("node:test");
  const { default: assert } = await import("node:assert/strict");
  const { spawnSync } = await import("node:child_process");
  const here = new URL(import.meta.url).pathname;
  for (const [label, keyed] of [["الدفترة مضبوطة", "1"], ["الدفترة غير مضبوطة", "0"]]) {
    test(`إنتاج حقيقي — ${label}`, () => {
      const env = { ...process.env, INVOICE_LIVE_CHILD: "1", INVOICE_LIVE_KEYED: keyed };
      delete env.NODE_TEST_CONTEXT;
      const r = spawnSync(process.execPath, [here], { env, encoding: "utf8" });
      assert.equal(r.status, 0, (r.stdout || "").slice(-3000) + (r.stderr || "").slice(-1500));
    });
  }
} else {
  if (process.env.INVOICE_LIVE_KEYED === "1") process.env.DAFTRA_API_KEY = "unit-daftra-key"; else delete process.env.DAFTRA_API_KEY;
  const keyed = !!process.env.DAFTRA_API_KEY;

  const assert = (await import("node:assert/strict")).default;
  const sent = [], daftraCalls = [], other = [];
  let invSeq = 0;
  const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u === "https://api.resend.com/emails") {
      const b = JSON.parse(init.body);
      sent.push({ to: b.to[0], subject: b.subject, html: b.html, from: b.from });
      return json({ id: "em" });
    }
    if (u.startsWith("https://businesspartner.daftra.com/api2/")) {
      const p = new URL(u).pathname.replace("/api2", "");
      daftraCalls.push((init.method || "GET") + " " + p);
      if (p === "/taxes.json") return json({ data: [{ Tax: { id: 7, value: "15", is_active: 1 } }] });
      if (p === "/clients.json") return init.method === "POST" ? json({ result: "successful", id: 11 }) : json({ data: [] });
      if (p === "/invoices.json" && init.method === "POST") return json({ result: "successful", id: 8000 + ++invSeq });
      if (/^\/invoices?\/\d+\.json$/.test(p)) return json({ Invoice: { id: 8001, no: "INV8001" } });
      if (p === "/invoice_payments.json") return json({ result: "successful", id: 1 });
      return new Response("nf", { status: 404 });
    }
    other.push(u);
    return json({}, 200);
  };

  const { markRequestPaidByRef } = await import("../api/_simple.js");
  const { sb } = await import("../api/_db.js");
  const { PAYMENTS_LIVE, EMAIL_LIVE } = await import("../api/_mode.js");
  assert.equal(PAYMENTS_LIVE, true, "الإنتاج: الدفع حقيقي");
  assert.equal(EMAIL_LIVE, true, "الإنتاج: البريد حيّ");

  await sb("requests", { method: "POST", body: [{
    ref: "BP-R-0C0C0C", organization_id: "2fcd5b83-144c-4434-be82-aac28b9e19c6", user_id: "7b2db20a-2404-41ce-b7af-8db1d3fabc95",
    type: "GOVERNMENT_SERVICE", source: "WEBSITE", status: "SIGNED", lang: "ar", title: "خدمة",
    quote: { number: "Q-9", status: "APPROVED", net: 1000, vat: 150, total: 1150, items: [{ title: "خدمة", qty: 1, price: 1000, line: 1000 }] },
    client_name: "عميل", client_email: "buyer@client.example", client_phone: "0500000000",
  }] });
  await markRequestPaidByRef("BP-R-0C0C0C", { provider: "moyasar", payId: "pay_live_0001", amount: 1150, test: false, actor: "moyasar" });
  const row = (await sb("requests?ref=eq.BP-R-0C0C0C&select=id,invoice,status"))[0];
  assert.equal(row.status, "PAID");
  const invMails = sent.filter((m) => /^فاتورة /.test(m.subject));

  if (keyed) {
    assert.equal(row.invoice.mode, "daftra");
    assert.equal(row.invoice.status, "issued");
    assert.match(row.invoice.number, /^INV\d+$/);
    assert.ok(daftraCalls.includes("POST /invoices.json") && daftraCalls.includes("POST /invoice_payments.json"));
    assert.equal(invMails.length, 1);
    assert.equal(invMails[0].to, "buyer@client.example", "إلى العميل");
    assert.equal(invMails[0].from, "Business Partner <invoices@unit.local>");
    assert.ok(!sent.some((m) => m.to === OWNER && /^فاتورة /.test(m.subject)), "المالك لا يتلقى نسخة العميل");
  } else {
    assert.equal(daftraCalls.length, 0);
    assert.ok(!row.invoice.number, "لا رقم مختلق");
    assert.equal(row.invoice.status, "failed");
    assert.equal(row.invoice.last_error, "daftra_not_configured");
    assert.equal(invMails.length, 0, "لا بريد فاتورة للعميل");
    const alerts = sent.filter((m) => m.to === OWNER && /لم تصدر من الدفترة/.test(m.subject));
    assert.equal(alerts.length, 1, sent.map((m) => m.subject).join(" | "));
    assert.equal((await sb(`tasks?request_id=eq.${row.id}&select=source`)).filter((t) => t.source === "invoice-failed").length, 1);
  }
  console.log("live-mode ok", keyed ? "keyed" : "no-key");
}
