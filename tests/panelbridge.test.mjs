// اختبار تكامل لجسر القراءة المحلي (المرحلة 3): requests+quote_tokens →
// شكلَي client-documents و owner overview. يعمل على قاعدة LOCAL_DB معزولة.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// لا بد من ضبط البيئة قبل استيراد الوحدات (تُقرأ عند التحميل).
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "bp-panelbridge-"));

let sb, localClientDocs, localOwnerOverview;

before(async () => {
  ({ sb } = await import("../api/_db.js"));
  ({ localClientDocs, localOwnerOverview } = await import("../api/_panelbridge.js"));

  // طلب مهاجَر: عرض مقبول + عقد موقّع + فاتورة مدفوعة، مع روابطه.
  const created = await sb("requests?on_conflict=ref", {
    method: "POST", prefer: "resolution=merge-duplicates,return=representation",
    body: [{
      ref: "BP-R-TEST01", type: "GOVERNMENT_SERVICE", source: "MANUAL", status: "PAID",
      lang: "ar", title: "خدمة اختبار", client_email: "t@ex.sa", company_name: "منشأة الاختبار",
      quote: { number: "BP-X-2026-9", status: "ACCEPTED", total: 2300, currency: "SAR", created_at: "2026-06-01T00:00:00Z", valid_until: "2026-06-15", decided_at: "2026-06-02T00:00:00Z", items: [] },
      contract: { number: "BP-C-9", status: "SIGNED", html: "<p>x</p>", created_at: "2026-06-02T00:00:00Z", signed_at: "2026-06-03T00:00:00Z" },
      invoice: { number: "INV-9", total: 2300 },
      payment: { status: "PAID", at: "2026-06-03T01:00:00Z" },
    }],
  });
  const rid = created[0].id;
  void rid;
  await sb("quote_tokens?on_conflict=token", {
    method: "POST", prefer: "resolution=ignore-duplicates,return=minimal",
    body: [
      { token: "tkq", ref: "BP-R-TEST01", kind: "quote", legacy_number: "BP-X-2026-9" },
      { token: "tkc", ref: "BP-R-TEST01", kind: "contract", legacy_number: "BP-C-9" },
      { token: "tki", ref: "BP-R-TEST01", kind: "invoice", legacy_number: "INV-9" },
    ],
  });

  // طلب Simple V1 أصلي بلا روابط — يجب ألا يظهر في جسر العروض القديم.
  await sb("requests?on_conflict=ref", {
    method: "POST", prefer: "resolution=merge-duplicates,return=minimal",
    body: [{ ref: "BP-R-NATIVE", type: "CONSULTATION", source: "WEBSITE", status: "NEW", lang: "ar", title: "طلب أصلي", client_email: "t@ex.sa" }],
  });
});

test("client-documents المحلي يبني الأقسام الثلاثة بالروابط الصحيحة", async () => {
  const cd = await localClientDocs("t@ex.sa");
  assert.ok(cd && cd.found);
  assert.equal(cd.quotes.length, 1);
  assert.equal(cd.contracts.length, 1);
  assert.equal(cd.invoices.length, 1);
  assert.equal(cd.quotes[0].status, "ACCEPTED");
  assert.equal(cd.quotes[0].url, "/quotes/d/tkq");
  assert.equal(cd.quotes[0].vatExcluded, true);
  assert.equal(cd.contracts[0].url, "/quotes/d/tkc");
  assert.equal(cd.invoices[0].status, "PAID");
  assert.equal(cd.invoices[0].url, null);          // المدفوعة بلا رابط سداد
});

test("بريد بلا صفوف مهاجَرة يُعيد null (ليرجع المنادي للجسر)", async () => {
  assert.equal(await localClientDocs("nobody@none.sa"), null);
});

test("owner overview يَعُدّ ويبني أدمن-URL نحو /ops", async () => {
  const ov = await localOwnerOverview();
  assert.ok(ov);
  assert.equal(ov["عدّادات"]["المستندات"], 2);     // عرض + عقد (الأصلي بلا روابط مستبعد)
  assert.equal(ov["عدّادات"]["الفواتير"], 1);
  assert.ok(ov.documents[0].adminUrl.includes("/ops?ref="));
  assert.ok(ov.documents.some((d) => d.publicUrl === "/quotes/d/tkq"));
  assert.deepEqual(ov.supply, []);
});
