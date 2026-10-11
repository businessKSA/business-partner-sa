// اختبار خريطة هجرة bp-quotes → Simple V1 (نقي، بلا قاعدة ولا شبكة).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mapBundle, refFromSeed } from "../scripts/lib/map-quotes.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(HERE, "..", "scripts", "fixtures", "quotes-sample.json");
const bundles = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));

test("refFromSeed ثابت ومتوافق مع صيغة BP-R-", () => {
  const a = refFromSeed("tok_quote_abc123def456");
  assert.equal(a, refFromSeed("tok_quote_abc123def456"));   // إعادة التشغيل تنتج نفس المرجع
  assert.match(a, /^BP-R-[0-9A-Z]{6}$/);
  assert.notEqual(a, refFromSeed("tok_quote_sara014"));      // بذور مختلفة → مراجع مختلفة
});

test("عرض مقبول + عقد موقّع + فاتورة مدفوعة → طلب PAID مكتمل", () => {
  const [res] = mapBundle(bundles[0]);
  const r = res.request;
  assert.equal(r.status, "PAID");
  assert.equal(r.quote.number, "BP-FI-2026-001");
  assert.equal(r.quote.status, "ACCEPTED");   // حرفيًا من bp-quotes
  assert.equal(r.quote.items.length, 2);
  assert.equal(r.quote.net, 10000);
  assert.equal(r.quote.vat, 1500);
  assert.equal(r.quote.total, 11500);
  assert.ok(r.contract && r.contract.status === "SIGNED");
  assert.ok(r.contract.html && r.contract.html.includes("عقد خدمات"));
  assert.ok(r.contract.signature && r.contract.signature.name === "محمد العتيبي");
  assert.ok(r.payment && r.payment.status === "PAID");
  assert.equal(r.client_email, "owner@alufuq.sa");      // طُبّع لحروف صغيرة
  assert.equal(r.company_name, "مؤسسة الأفق التجارية");
});

test("الروابط الثلاثة تُولَّد بالأنواع الصحيحة وتشير لنفس المرجع", () => {
  const [res] = mapBundle(bundles[0]);
  const byKind = Object.fromEntries(res.tokens.map((t) => [t.kind, t]));
  assert.equal(res.tokens.length, 3);
  assert.equal(byKind.quote.token, "tok_quote_abc123def456");
  assert.equal(byKind.contract.token, "tok_contract_xyz789");
  assert.equal(byKind.invoice.token, "tok_pay_inv001");
  assert.ok(res.tokens.every((t) => t.ref === res.request.ref));
  assert.equal(byKind.quote.legacy_number, "BP-FI-2026-001");
});

test("الأحداث تُحوَّل مع تطبيع نوع الفاعل", () => {
  const [res] = mapBundle(bundles[0]);
  assert.equal(res.events.length, 3);
  const kinds = new Set(res.events.map((e) => e.actor_kind));
  assert.ok(kinds.has("human"));      // admin → human
  assert.ok(kinds.has("customer"));   // client → customer
  assert.ok(res.events.every((e) => e.event.startsWith("legacy.")));
});

test("عرض مُرسَل بلا عقد ولا فاتورة → QUOTE_SENT ورابط واحد", () => {
  const [res] = mapBundle(bundles[1]);
  assert.equal(res.request.status, "QUOTE_SENT");
  assert.equal(res.request.contract, null);
  assert.equal(res.request.payment, null);
  assert.equal(res.tokens.length, 1);
  assert.equal(res.tokens[0].kind, "quote");
});
