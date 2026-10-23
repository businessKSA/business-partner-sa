// العرض ← العقد ← التوقيع في /my (api/_simple.js) — على قاعدة محلية وبلا شبكة.
//
// ما يُثبته هذا الملف (تدقيق 2026-10-11):
//   ١) عرضٌ انتهت صلاحيته لا يُعتمد (409 quote_expired) ولا يصدر له عقد؛ ورفضه يبقى مفتوحاً.
//   ٢) العقد لا يتبدّل بتغيّر اليوم: فتحُه بعد التوقيع بيومٍ لا يضع عليه «يلزم توقيع جديد»،
//      ولا تضيع مدة التنفيذ والجهة المنفِّذة التي كتبها المالك عند الإصدار.
//   ٣) صورة التوقيع المرسومة تُحفظ كاملة أو لا تُحفظ — لا تُقطع إلى صورة تالفة.
//   ٤) التسعير الآلي لا يضع رقماً ملزماً على «يبدأ من» ولا على اشتراكٍ شهري؛ ويصدر لما سعره ثابت.
//   ٥) بند الحشو `seed` لا يمنع صدور العرض الآلي ولا يُطبع فيه.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

process.env.APP_ENV = "development";
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "quote-contract-flow-"));
// These cases pin the date / lead-time / signed-paper behaviour of the ORIGINAL (v1) paper, whose text
// they edit by hand. New documents are issued with template v2 now (api/_bp-docs.js → _bp-docs-v2.js, covered by
// tests/bp-docs-flow.test.mjs); BP_DOCS_TEMPLATE=v1 is the kill switch that keeps issuing v1.
process.env.BP_DOCS_TEMPLATE = "v1";
for (const k of ["RESEND_API_KEY", "RESEND_KEY", "DAFTRA_API_KEY", "WHATSAPP_TOKEN", "SIMPLE_NOTIFY"]) delete process.env[k];

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");

// الكتالوج يُقرأ من site/data/services.json المضمَّن: BP-SBC-01 ثابت (7500)،
// BP-RE-02 «يبدأ من 800»، BP-AI-04 اشتراك شهري.
globalThis.fetch = async (url) => { throw new Error("a local run must not reach the network: " + url); };

const { handleSimple } = await import("../api/_simple.js");
const { sb, sha256 } = await import("../api/_db.js");

const CLIENT = { email: "client@test.local", org: "2fcd5b83-144c-4434-be82-aac28b9e19c6", user: "7b2db20a-2404-41ce-b7af-8db1d3fabc95", token: "tok-client-qcflow-aaaaaaaa" };
await sb("user_sessions", { method: "POST", prefer: "return=minimal", body: [{ id: crypto.randomUUID(), token_hash: sha256(CLIENT.token), user_id: CLIENT.user, organization_id: CLIENT.org, expires_at: new Date(Date.now() + 864e5).toISOString(), revoked_at: null }] });

async function call(action, body = {}) {
  const out = { status: 200, body: null };
  const isOps = action.startsWith("ops-");
  const res = { statusCode: 200, setHeader() {}, end(b) { out.status = this.statusCode; try { out.body = JSON.parse(b); } catch { out.body = b; } } };
  await handleSimple({
    method: "POST", headers: { cookie: isOps ? "" : `bp_sid=${CLIENT.token}` }, socket: {}, query: {},
    body: { action, ...(isOps ? { key: "test-ops" } : {}), ...body },
  }, res);
  return out;
}
const rowOf = async (ref) => (await sb(`requests?ref=eq.${ref}&select=*`))[0];
async function newRequest(scope = [{ code: "BP-SBC-01", title: "خدمة ثابتة", qty: 1 }]) {
  const r = await call("request-create", { type: "GOVERNMENT_SERVICE", title: "اختبار العرض", phone: "0501234567", name: "عميل تجريبي", scope });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  return r.body.ref;
}
const fmtDay = (d) => d.toLocaleDateString("ar-SA-u-nu-latin", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Riyadh" });

test("عرض منتهي الصلاحية لا يُعتمد، ويبقى رفضه ممكناً، والعرض الساري يُعتمد", async () => {
  const ref = await newRequest();
  const q = await call("ops-quote", { ref, items: [{ title: "بند", price: 1000, qty: 1 }], validity_days: 7 });
  assert.equal(q.body.ok, true);
  const row = await rowOf(ref);
  await sb(`requests?id=eq.${row.id}`, { method: "PATCH", body: { quote: { ...row.quote, valid_until: "2020-01-01" } } });

  const a = await call("quote-approve", { ref });
  assert.equal(a.status, 409);
  assert.equal(a.body.error, "quote_expired");
  const after = await rowOf(ref);
  assert.equal(after.status, "QUOTE_SENT", "الحالة لم تتحرك");
  assert.equal(after.contract || null, null, "لا عقد لعرضٍ منتهٍ");

  // الفريق يجدّده فيُعتمد
  const renew = await call("ops-quote", { ref, items: [{ title: "بند", price: 1000, qty: 1 }], validity_days: 7 });
  assert.equal(renew.body.ok, true);
  const ok = await call("quote-approve", { ref });
  assert.equal(ok.body.ok, true);
  assert.equal(ok.body.status, "CONTRACT_SENT");
});

test("رفض عرضٍ منتهٍ مسموح", async () => {
  const ref = await newRequest();
  await call("ops-quote", { ref, items: [{ title: "بند", price: 500, qty: 1 }] });
  const row = await rowOf(ref);
  await sb(`requests?id=eq.${row.id}`, { method: "PATCH", body: { quote: { ...row.quote, valid_until: "2020-01-01" } } });
  const r = await call("quote-reject", { ref, note: "غالٍ" });
  assert.equal(r.body.ok, true);
});

test("«طلب تعديل» يصير رسالة في الطلب ومهمة للفريق، والحالة «قيد المراجعة» لا «بانتظار ردك»", async () => {
  const ref = await newRequest();
  await call("ops-quote", { ref, items: [{ title: "بند", price: 500, qty: 1 }] });
  const r = await call("quote-reject", { ref, note: "السعر مرتفع علينا" });
  assert.equal(r.body.ok, true);
  assert.equal(r.body.status, "REVIEWING");
  const row = await rowOf(ref);
  assert.ok(row.conversation.some((m) => m.role === "user" && m.content.includes("السعر مرتفع علينا")), "ملاحظة العميل في المحادثة");
  const tasks = await sb(`tasks?request_id=eq.${row.id}&source=eq.reply.customer&select=title,status`);
  assert.equal(tasks.length, 1, "مهمة واحدة للفريق");
  assert.equal(tasks[0].status, "open");
  // يستطيع الفريق إعادة التسعير والعميل اعتماده
  const again = await call("ops-quote", { ref, items: [{ title: "بند", price: 400, qty: 1 }] });
  assert.equal(again.body.ok, true);
  assert.equal((await call("quote-approve", { ref })).body.ok, true);
});

test("العقد ثابت: لا يتبدّل بتغيّر اليوم، وتبقى مدة التنفيذ، ولا يُطلب توقيع جديد", async () => {
  const ref = await newRequest();
  await call("ops-quote", { ref, items: [{ title: "بند", price: 1000, qty: 1 }] });
  await call("quote-approve", { ref });
  const c = await call("ops-contract", { ref, lead_time: "٣٠ يوم عمل", executor: "فريق الامتثال" });
  assert.equal(c.body.ok, true);

  // العقد صدر قبل ثلاثة أيام (نعيد تأريخ الورقة نفسها)
  const row = await rowOf(ref);
  const then = new Date(Date.now() - 3 * 864e5);
  const html = row.contract.html.replace(fmtDay(new Date()), fmtDay(then));
  assert.notEqual(html, row.contract.html, "التاريخ مطبوع في الورقة");
  await sb(`requests?id=eq.${row.id}`, { method: "PATCH", body: { contract: { ...row.contract, html, created_at: then.toISOString() } } });

  const v1 = await call("contract-view", { ref });
  assert.equal(v1.body.needsResign, false);
  assert.ok(v1.body.html.includes("٣٠ يوم عمل"), "مدة التنفيذ باقية");
  assert.ok(v1.body.html.includes("فريق الامتثال"), "الجهة المنفِّذة باقية");
  assert.ok(v1.body.html.includes(fmtDay(then)), "تاريخ الإصدار الأصلي لا تاريخ اليوم");

  const s = await call("contract-sign", { ref, consent: true, name: "عميل تجريبي" });
  assert.equal(s.body.ok, true);
  const v2 = await call("contract-view", { ref });
  assert.equal(v2.body.needsResign, false, "عقدٌ موقّع لا يُوسَم «يلزم توقيع جديد» لأن اليوم تغيّر");
  const signed = await rowOf(ref);
  assert.equal(signed.contract.html_signed, undefined, "لا نسخة مصحَّحة");
  const keys = (await sb(`request_events?request_id=eq.${row.id}&select=event`)).map((e) => e.event);
  assert.ok(!keys.includes("contract.corrected"), "لا حدث تصحيح");
});

test("عقد موقّع قديم بلا build لا يُعاد بناؤه ولا يُوسَم", async () => {
  const ref = await newRequest();
  await call("ops-quote", { ref, items: [{ title: "بند", price: 1000, qty: 1 }] });
  await call("quote-approve", { ref });
  await call("ops-contract", { ref, lead_time: "١٠ أيام" });
  await call("contract-sign", { ref, consent: true, name: "ع" });
  const row = await rowOf(ref);
  const { build, ...legacy } = row.contract;
  await sb(`requests?id=eq.${row.id}`, { method: "PATCH", body: { contract: legacy } });
  const v = await call("contract-view", { ref });
  assert.equal(v.body.needsResign, false);
  assert.ok(v.body.html.includes("١٠ أيام"));
});

test("صورة التوقيع: تُحفظ كاملة أو لا تُحفظ", async () => {
  const big = "data:image/png;base64," + "A".repeat(80000);   // أطول من الحد القديم ٦٠٠٠٠ وتحت الجديد
  const huge = "data:image/png;base64," + "A".repeat(300000);
  for (const [img, expect] of [[big, big], [huge, null], ["data:text/html;base64,PHNjcmlwdD4=", null], ["javascript:alert(1)", null]]) {
    const ref = await newRequest();
    await call("ops-quote", { ref, items: [{ title: "بند", price: 100, qty: 1 }] });
    await call("quote-approve", { ref });
    const s = await call("contract-sign", { ref, consent: true, name: "ع", signature: img });
    assert.equal(s.body.ok, true);
    assert.equal((await rowOf(ref)).contract.signature.image, expect);
  }
});

test("التسعير الآلي: الثابت يصدر فوراً، و«يبدأ من» والشهري يذهبان إلى إنسان", async () => {
  const fixed = await newRequest([{ code: "BP-SBC-01", title: "خدمة ثابتة", qty: 1 }]);
  const a = await call("scope-confirm", { ref: fixed });
  assert.equal(a.body.stage, "QUOTE");
  assert.equal(a.body.quote.net, 7500);

  const from = await newRequest([{ code: "BP-RE-02", title: "تبدأ من", qty: 1 }]);
  const b = await call("scope-confirm", { ref: from });
  assert.equal(b.body.stage, "PRICING", "رقم «يبدأ من» ليس سعراً");
  assert.deepEqual(b.body.unpriced, ["تبدأ من"]);
  assert.equal((await rowOf(from)).quote || null, null);

  const monthly = await newRequest([{ code: "BP-AI-04", title: "اشتراك شهري", qty: 1 }]);
  const c = await call("scope-confirm", { ref: monthly });
  assert.equal(c.body.stage, "PRICING", "اشتراك شهري ليس دفعة واحدة");

  // مع ذلك، حين يسعّره إنسان يصدر العرض
  const q = await call("ops-quote", { ref: from, items: [{ code: "BP-RE-02", title: "تبدأ من", qty: 1, price: 950 }] });
  assert.equal(q.body.quote.net, 950);
});

test("بند الحشو seed لا يحجب العرض الآلي ولا يُطبع فيه؛ والبند المكتوب بيد العميل يحجبه", async () => {
  const ref = await newRequest([{ code: "BP-SBC-01", title: "خدمة ثابتة", qty: 1 }, { code: "", title: "تحديد المسار", qty: 1, seed: true }]);
  const r = await call("scope-confirm", { ref, scope: [{ code: "BP-SBC-01", title: "خدمة ثابتة", qty: 1 }, { code: "", title: "تحديد المسار", qty: 1, seed: true }] });
  assert.equal(r.body.stage, "QUOTE");
  assert.deepEqual(r.body.quote.items.map((i) => i.title), ["خدمة ثابتة"]);

  const ref2 = await newRequest([{ code: "BP-SBC-01", title: "خدمة ثابتة", qty: 1 }]);
  const r2 = await call("scope-confirm", { ref: ref2, scope: [{ code: "BP-SBC-01", title: "خدمة ثابتة", qty: 1 }, { code: "", title: "ترجمة عقد خاصة", qty: 1 }] });
  assert.equal(r2.body.stage, "PRICING", "بندٌ كتبه العميل يحتاج سعراً بشرياً");

  // seed بلا أي بند حقيقي لا يُصدر شيئاً
  const ref3 = await newRequest([{ code: "", title: "حشو", qty: 1, seed: true }]);
  const r3 = await call("scope-confirm", { ref: ref3, scope: [{ code: "", title: "حشو", qty: 1, seed: true }] });
  assert.equal(r3.body.stage, "PRICING");
});
