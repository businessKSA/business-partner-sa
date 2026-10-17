import test from "node:test";
import assert from "node:assert/strict";
import { classifyNotification as c, gateProactiveText, parseGateAnswer, buildGatePrompt } from "./farah-notify-gate.mjs";

// every sample below is a paraphrase of a real notification seen in the 7 days before 2026-10-17, names/numbers replaced
test("money: payment, quote, tax deadline, failed payment", () => {
  assert.equal(c({ origin: "payment", text: "وصلت دفعة 5,000 ريال من العميل (فاتورة INV-100)" }).label, "money");
  assert.equal(c({ origin: "watchdog", text: "1) شركة (س) — عرض سعر — منظومة رقمية — 80,000 ريال — 👤 عليك أنت" }).decision, "send");
  assert.equal(c({ origin: "mail", sender: "noreply@tax.gov.sa", subject: "تذكير بتقديم إقرار ضريبة القيمة المضافة", text: "آخر موعد الأحد" }).label, "money");
  assert.equal(c({ origin: "error", text: "خلل: فشلت عملية الدفع عبر مُيسّر للفاتورة 22" }).label, "money");
});
test("customer: new deal, inquiry waiting, complaint, meeting with client", () => {
  assert.equal(c({ origin: "deal", text: "🟢 صفقة/عميل جديد: شركة (ص) · تأسيس · المرحلة جديد" }).label, "customer");
  assert.equal(c({ origin: "reader", text: "باهر، ترى في واحد وصل معك:\nأحمد — لم تردّ عليه بعد\nيسأل عن تأشيرات العمال ويريد عرضاً.\nالمقترح أن تردّ: «تمام»" }).decision, "send");
  assert.equal(c({ origin: "website-notice", text: "محادثة جديدة من الموقع" }).decision, "send");
  assert.equal(c({ origin: "other", text: "العميل غاضب ويطلب استرداد المبلغ" }).label, "customer");
  assert.equal(c({ origin: "calendar", text: "⏰ بعد ساعة: اجتماع أونلاين: باهر × خالد — ٠٨:٠٠ م" }).decision, "send");
});
test("other: news, system status, account security mail, hiring, internal meeting, digest", () => {
  assert.equal(c({ origin: "news", text: "هيئة (ع) تطلق تحديثاً تنظيمياً جديداً" }).decision, "log");
  assert.equal(c({ origin: "error", text: "⚠️ خلل في النظام — الوركفلو: ATS Intake — This model's maximum context length is 300000 tokens" }).decision, "log");
  assert.equal(c({ origin: "mail", sender: "no-reply@elevenlabs.io", subject: "New login from Chrome on MacOS", text: "" }).decision, "log");
  assert.equal(c({ origin: "mail", sender: "verification@verify.snapchat.com", subject: "Confirm Your Email Address", text: "" }).decision, "log");
  assert.equal(c({ origin: "mail", sender: "business@x.com", subject: "طلب توظيف جديد — نورة — أخصائي موارد بشرية", text: "المرحلة المقترحة: جديد" }).decision, "log");
  assert.equal(c({ origin: "calendar", text: "⏰ بعد ساعة: اجتماع فريق العمل الداخلي" }).decision, "log");
  assert.equal(c({ origin: "digest", text: "🗒️ ملخص محادثات الموقع (آخر 24 ساعة): 5 محادثة — 4 للعلم" }).decision, "log");
});
test("his own requests are never held back", () => {
  assert.equal(c({ origin: "minutes", text: "📝 محضر: اختبار" }).decision, "send");
  assert.equal(c({ origin: "reply", text: "تم" }).decision, "send");
});
test("boilerplate does not drive the score; strong signals beat noise; fingerprint ignores digits", () => {
  const a = c({ origin: "reader", text: "x — آخر ردّ منك\nباهر يعتذر.\nالطلب سُجّل في Notion: https://n.so/a" });
  assert.equal(a.decision, "log");
  assert.equal(c({ origin: "reader", text: "مجموعة بلا اسم (مجموعة)\nفاتورة صدرت بمبلغ 2128.86 ريال ويطلب سدادها" }).decision, "send");
  assert.equal(c({ origin: "watchdog", text: "عرض سعر — 80,000 ريال — 5 خطوة" }).hash, c({ origin: "watchdog", text: "عرض سعر — 80,000 ريال — 7 خطوة" }).hash);
});
test("proactive update: keeps customer/money blocks, drops mail noise, empty when nothing is left", () => {
  const upd = "فرح — تحديث ٠٦:٠٠ ص\n\n🟢 صفقة/عميل جديد: شركة (ص) · تأسيس · المرحلة جديد · المالك بدر\n\n📧 بريد جديد: Confirm Your Email Address\n   من: Snapchat <verification@verify.snapchat.com>\n\n📧 بريد جديد: تعثّر الدفع للفاتورة 31\n   من: عميل <client@example.com>\n\nردّ عليّ هنا وأكمل معك.";
  const g = gateProactiveText(upd, c);
  assert.equal(g.kept, 2); assert.equal(g.dropped, 1);
  assert.match(g.text, /صفقة/); assert.doesNotMatch(g.text, /Snapchat/); assert.match(g.text, /^فرح — تحديث/); assert.match(g.text, /ردّ عليّ هنا/);
  const none = gateProactiveText("فرح — تحديث ٠٧:٣٠ م\n\n📧 بريد جديد: New optional scopes available\n   من: Google <no-reply@accounts.google.com>\n\nردّ عليّ هنا وأكمل معك.", c);
  assert.equal(none.text, ""); assert.equal(none.kept, 0);
});
test("model answer parsing is strict and fails closed (log, not send)", () => {
  assert.deepEqual(parseGateAnswer('{"label":"money","reason":"فاتورة"}').decision, "send");
  assert.equal(parseGateAnswer("مش JSON").decision, "log");
  assert.equal(parseGateAnswer('{"label":"hack"}').label, "other");
  assert.match(buildGatePrompt({ text: "x", origin: "mail" }), /JSON فقط/);
});
