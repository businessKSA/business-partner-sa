// إصلاحات استقبال المستندات بعد بناء واجهة /my فوقه (ثلاثة بنود)، ببيانات وهمية صريحة وبلا شبكة:
//   ① عنوان الملف يُفرَّق عبر النداءات (prior) ولا يُدمج في إصدار مستند قائم إلا بتأكيد صريح.
//   ② معرّف المكرر فريد، واقتراح بيانات الشركة لا يسقط بسبب ملف مكرر.
//   ③ me يُرجع vat_number وcity (getSession لا يختارهما).
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

process.env.APP_ENV = "development";
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "doc-intake-fix-"));
for (const k of ["RESEND_API_KEY", "RESEND_KEY", "DAFTRA_API_KEY", "WHATSAPP_TOKEN", "SIMPLE_NOTIFY", "AZURE_OPENAI_KEY", "AZURE_OPENAI_API_KEY", "AZURE_AI_KEY", "AZURE_OPENAI_ENDPOINT", "AZURE_AI_ENDPOINT", "AZURE_DOCINTEL_ENDPOINT", "AZURE_DOCINTEL_KEY"]) delete process.env[k];

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
globalThis.fetch = async (url) => {
  if (String(url).includes("catalog.json")) return new Response(JSON.stringify({ services: [], packages: [], discounts: [] }), { status: 200 });
  throw new Error("a local run must not reach the network: " + url);
};

const { intakeBatch, _resetIntakeThrottle } = await import("../api/_doc-intake.js");
const { handleSimple } = await import("../api/_simple.js");
const { sb, sha256 } = await import("../api/_db.js");

const NOW = new Date("2026-10-23T00:00:00Z");
const FAKE = "شركة اختبار وهمية للتجارة";
const pdf = (mark, pad = "") => ({ name: `${mark}.pdf`, mime: "application/pdf", base64: Buffer.from(`%PDF-1.4\n% MARK:${mark} ${pad}\n%%EOF`).toString("base64") });
const markOf = (b64) => (/MARK:([\w-]+)/.exec(Buffer.from(b64, "base64").toString("latin1")) || [])[1];
const base = { overallConfidence: "high", legible: true, containsInstructionsToAI: false, fieldConfidence: {} };
const FIX = {
  cr: { ...base, docType: "cr", companyNameAr: FAKE, companyNameEn: "FAKE TEST TRADING CO", crNumber: "1010000001", city: "الرياض", issueDate: "2024-03-10", expiryDate: "2030-03-10" },
  other: { ...base, docType: "cr", companyNameAr: "مؤسسة أخرى وهمية للمقاولات", crNumber: "2050000002", issueDate: "2025-06-01" },
  vat: { ...base, docType: "vat_certificate", companyNameAr: FAKE, vatNumber: "399999999900003", issueDate: "2024-04-01" },
};
const reader = async (b64) => { const fx = FIX[markOf(b64)]; return fx ? { ok: true, data: fx, provider: "stub" } : { ok: false, error: "read_failed" }; };
const run = (files, o = {}) => intakeBatch({ files, now: NOW, demo: false, reader, ...o });
const byName = (r, n) => r.files.find((f) => f.fileName === n);
const priorOf = (r) => r.files.map((f) => ({ id: f.id, fileName: f.fileName, sha256: f.sha256, docType: f.docType, issueDate: f.issueDate || null, suspicious: !!f.suspicious, fields: f.fields }));

// ------------------------------------------------------------- جلسات ومنشآت --
const future = new Date(Date.now() + 864e5).toISOString();
async function mkClient(tag, org, orgFields = {}) {
  const c = { email: `${tag}@test.local`, org, user: crypto.randomUUID(), token: `tok-${tag}-fixintake-aaaaaaaa` };
  if (org) await sb("organizations", { method: "POST", prefer: "return=minimal", body: [{ id: org, name_ar: "", name_en: "", cr_number: "", city: "", ...orgFields }] });
  await sb("users", { method: "POST", prefer: "return=minimal", body: [{ id: c.user, email: c.email, full_name: "عميل اختبار", locale: "ar" }] });
  await sb("user_sessions", { method: "POST", prefer: "return=minimal", body: [{ id: crypto.randomUUID(), token_hash: sha256(c.token), user_id: c.user, organization_id: org, expires_at: future, revoked_at: null }] });
  return c;
}
const VER = await mkClient("ver", "44444444-5555-4666-8777-888888888888");
const DUP = await mkClient("dup", "55555555-6666-4777-8888-999999999999");
const MEC = await mkClient("mec", "77777777-8888-4999-8aaa-bbbbbbbbbbbb");
const FOREIGN = await mkClient("foreign", "88888888-9999-4aaa-8bbb-cccccccccccc");
async function call(action, body, who) {
  const out = {};
  const res = { statusCode: 200, setHeader() {}, end(b) { out.status = this.statusCode; out.body = JSON.parse(b); } };
  await handleSimple({ method: "POST", headers: { cookie: `bp_sid=${who.token}` }, socket: {}, query: {}, body: { action, ...body } }, res);
  return out;
}
const docsOf = (org) => sb(`documents?organization_id=eq.${org}&select=id,category,title,document_versions(id,version_no)&order=created_at.asc`);
const demoFile = (n, pad = "") => ({ name: n, mime: "application/pdf", base64: Buffer.from(`%PDF-1.4\n% fake ${n} ${pad}\n%%EOF`).toString("base64") });

// ================================================================ ① العناوين ==
test("① العناوين تُفرَّق عبر النداءات: سجلّ في نداء ثانٍ لا يحمل عنوان السجل الأول", async () => {
  const first = await run([pdf("cr")]);
  assert.equal(first.files[0].title, "السجل التجاري");
  const second = await run([pdf("other")], { prior: priorOf(first) });
  assert.notEqual(second.files[0].title, "السجل التجاري");
  assert.ok(second.files[0].title.startsWith("السجل التجاري — "), second.files[0].title);
  assert.equal((await run([pdf("vat")], { prior: priorOf(first) })).files[0].title, "شهادة التسجيل الضريبي", "نوع آخر لا يُفرَّق");
  assert.equal((await run([pdf("other")])).files[0].title, "السجل التجاري", "بلا prior يبقى الأساسي");
  const unread = await run([pdf("other")], { prior: [{ id: "f_u", fileName: "x.pdf", sha256: "a".repeat(64), docType: "unknown", fields: {} }] });
  assert.equal(unread.files[0].title, "السجل التجاري", "ملف غير مقروء سابق لا يستهلك عنوان السجل");
});

test("① الحفظ لا يدمج في إصدار مستند قائم إلا بتأكيد صريح: ملفان بعنوان واحد على نداءين = مستندان", async () => {
  _resetIntakeThrottle();
  const send = async (f, extra = {}) => {
    const pv = (await call("doc-intake", { files: [f] }, VER)).body;
    assert.equal(pv.ok, true);
    return (await call("doc-intake-confirm", { files: [{ id: pv.files[0].id, name: f.name, mime: f.mime, base64: f.base64, title: "السجل التجاري", category: "cr", docType: "cr", fields: pv.files[0].fields, ...extra }] }, VER)).body;
  };
  const a = await send(demoFile("demo-cr.pdf", "mine"));
  assert.equal(a.saved[0].version, 1); assert.equal(a.saved[0].title, "السجل التجاري"); assert.equal(a.saved[0].renamed, undefined);
  const b = await send(demoFile("demo-cr.pdf", "another-company"));    // سجلّ شركة أخرى بالعنوان نفسه في نداء آخر
  assert.equal(b.saved.length, 1, JSON.stringify(b));
  assert.equal(b.saved[0].version, 1, "لا يصير نسخة ثانية من سجلّي");
  assert.notEqual(b.saved[0].documentId, a.saved[0].documentId);
  assert.equal(b.saved[0].renamed, true);
  assert.notEqual(b.saved[0].title, "السجل التجاري");
  const c = await send(demoFile("demo-cr.pdf", "third"));
  assert.equal(new Set([a, b, c].map((x) => x.saved[0].title)).size, 3, "ثلاثة عناوين فريدة");
  let docs = await docsOf(VER.org);
  assert.equal(docs.length, 3); assert.ok(docs.every((d) => d.document_versions.length === 1));

  const v2 = await send(demoFile("demo-cr.pdf", "renewal"), { asVersion: true });
  assert.equal(v2.saved[0].documentId, a.saved[0].documentId); assert.equal(v2.saved[0].version, 2); assert.equal(v2.saved[0].newVersion, true);
  const v3 = await send(demoFile("demo-cr.pdf", "renewal-2"), { versionOf: b.saved[0].documentId });
  assert.equal(v3.saved[0].documentId, b.saved[0].documentId); assert.equal(v3.saved[0].version, 2);
  assert.equal(v3.saved[0].title, b.saved[0].title, "العنوان يتبع المستند المستهدف");

  // versionOf لمستند منشأة أخرى مرفوض ولا يلمس مستندها
  const fpv = demoFile("demo-cr.pdf", "foreign");
  const fprev = (await call("doc-intake", { files: [fpv] }, FOREIGN)).body;
  await call("doc-intake-confirm", { files: [{ id: fprev.files[0].id, name: fpv.name, mime: fpv.mime, base64: fpv.base64, title: "السجل التجاري", category: "cr" }] }, FOREIGN);
  const foreignDoc = (await docsOf(FOREIGN.org))[0];
  const bad = await send(demoFile("demo-cr.pdf", "steal"), { versionOf: foreignDoc.id });
  assert.equal(bad.saved.length, 0); assert.equal(bad.skipped[0].reason, "version_target_not_found");
  assert.equal((await docsOf(VER.org)).length, 3, "لم يُنشأ مستند ولا دُمج في مستند غيري");
  assert.equal((await docsOf(FOREIGN.org))[0].document_versions.length, 1, "مستند الغير كما كان");
});

test("① المعاينة تُنبّه حين يوجد في الخزانة مستند بالعنوان والتصنيف نفسيهما (sameTitleInVault)", async () => {
  const ex = [{ documentId: "doc-9", category: "cr", title: "السجل التجاري", sha256s: [] }];
  assert.deepEqual((await run([pdf("cr")], { existingDocs: ex })).files[0].sameTitleInVault, { documentId: "doc-9", title: "السجل التجاري" });
  assert.equal((await run([pdf("vat")], { existingDocs: ex })).files[0].sameTitleInVault, undefined);
});

// ================================================================= ② المكرر ==
test("② معرّف المكرر فريد (ليس معرّف أصله) واقتراح الشركة يبقى ولا يُحسب الأصل ونسخته اتفاقاً", async () => {
  const first = await run([pdf("cr"), pdf("vat")]);
  const orig = byName(first, "cr.pdf");
  const again = await run([{ ...pdf("cr"), name: "copy.pdf" }], { prior: priorOf(first) });
  const dup = again.files[0];
  assert.equal(dup.status, "duplicate");
  assert.notEqual(dup.id, orig.id);
  assert.ok(dup.id.startsWith("f_" + orig.sha256.slice(0, 12)), "يبدأ بالبصمة فيتحقق التأكيد منها");
  assert.equal(dup.duplicateOf.fileId, orig.id);
  assert.equal(again.companyFacts.suggested.cr_number.value, "1010000001");
  assert.equal(again.companyFacts.suggested.cr_number.source.fileId, orig.id);
  assert.equal(again.companyFacts.facts.crNumber.agreedBy, 1);

  const three = await run([pdf("cr"), { ...pdf("cr"), name: "c2.pdf" }, { ...pdf("cr"), name: "c3.pdf" }]);
  assert.equal(new Set(three.files.map((f) => f.id)).size, 3);

  const vatId = "f_" + byName(first, "vat.pdf").sha256.slice(0, 12);
  const clash = await run([pdf("vat")], { prior: [{ id: vatId, fileName: "old", sha256: "b".repeat(64), docType: "unknown", fields: {} }] });
  assert.notEqual(clash.files[0].id, vatId, "معرّف محجوز في prior لا يُعاد");
});

test("② مكرر في الخزانة يحمل ما حُفظ لأصله: الاقتراح لا يسقط، ولا يُرسَل حقل vaultFields", async () => {
  let calls = 0;
  const sha = sha256(Buffer.from(pdf("cr").base64, "base64"));
  const r = await run([pdf("cr")], {
    reader: async () => { calls++; return { ok: false, error: "read_failed" }; },
    org: { name_ar: "", cr_number: "" },
    existingDocs: [{ documentId: "doc-1", category: "cr", title: "السجل التجاري", sha256s: [sha], extracted: { docType: "cr", companyNameAr: FAKE, crNumber: "1010000001", issueDate: "2024-03-10", unifiedNumber: "bad" } }],
  });
  assert.equal(calls, 0);
  assert.equal(r.files[0].status, "duplicate");
  assert.equal(r.companyFacts.suggested.name_ar.value, FAKE);
  assert.equal(r.companyFacts.suggested.cr_number.value, "1010000001");
  assert.equal(r.companyFacts.suggested.cr_number.needsReview, false);
  assert.equal(r.companyFacts.facts.unifiedNumber, undefined, "قيمة مخزّنة بصيغة خاطئة تُنظَّف");
  assert.equal(JSON.stringify(r).includes("vaultFields"), false);
});

test("② عبر النقطة: ملف محفوظ ثم يُرفع ثانيةً والمنشأة فارغة — الاقتراح يبقى", async () => {
  _resetIntakeThrottle();
  const f = demoFile("demo-cr.pdf", "dupfacts");
  const pv = (await call("doc-intake", { files: [f] }, DUP)).body;
  const sv = await call("doc-intake-confirm", { files: [{ id: pv.files[0].id, name: f.name, mime: f.mime, base64: f.base64, title: "السجل التجاري", category: "cr", docType: "cr", fields: pv.files[0].fields }] }, DUP);
  assert.equal(sv.body.saved.length, 1, "حُفظ المستند دون تأكيد بيانات الشركة");
  const again = (await call("doc-intake", { files: [f], prior: [] }, DUP)).body;
  assert.equal(again.files[0].status, "duplicate");
  assert.notEqual(again.files[0].id, pv.files[0].id);
  assert.equal(again.companyFacts.suggested.cr_number.value, "1010000001");
  assert.equal(again.companyFacts.suggested.name_ar.value, "شركة اختبار وهمية للتجارة");
});

// ============================================================== ③ me بالأعمدة ==
test("③ me يُرجع vat_number وcity للمنشأة بعد حفظهما، وبقية الحقول كما هي", async () => {
  _resetIntakeThrottle();
  const before = (await call("me", {}, MEC)).body.organization;
  assert.equal(before.id, MEC.org);
  assert.ok(!before.vat_number, "لم يُحفظ بعد");
  const c = await call("doc-intake-confirm", { files: [], facts: { name_ar: "منشأة اختبار وهمية", vat_number: "399999999900003", city: "الدمام" } }, MEC);
  assert.deepEqual(c.body.factsApplied.sort(), ["city", "name_ar", "vat_number"]);
  const me = (await call("me", {}, MEC)).body.organization;
  assert.equal(me.vat_number, "399999999900003"); assert.equal(me.city, "الدمام");
  assert.equal(me.name_ar, "منشأة اختبار وهمية");
  assert.ok("cr_number" in me && "name_en" in me && "id" in me);
});
