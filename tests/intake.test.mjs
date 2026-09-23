import test from "node:test";
import assert from "node:assert/strict";
import {
  parseChatExport, splitBlocks, detectChainHint, extractPhones,
  buildChain, dedupKey, findDuplicates, channelLabel, chainRoleLabel, CHANNELS,
  classifyMessage,
} from "../api/_rematch.js";

test("تصدير واتساب: الصيغة بالأقواس مع ص/م", () => {
  const out = parseChatExport(
    "[12/03/2025, 9:41:22 ص] أبو سعد: مطلوب أرض خام شمال الرياض 5000 متر\n" +
    "[12/03/2025, 2:10:00 م] بندر: تمام أبحث لك"
  );
  assert.equal(out.length, 2);
  assert.equal(out[0].sender, "أبو سعد");
  assert.match(out[0].text, /أرض خام/);
  assert.equal(out[0].at.slice(0, 10), "2025-03-12");
  // ٢:١٠ مساءً = 14:10 لا 02:10 — ص/م تقلب اليوم كله إن أُهملت.
  assert.equal(out[1].at.slice(11, 16), "14:10");
});

test("تصدير واتساب: الصيغة بالشرطة، ورسالة تمتد أسطراً", () => {
  const out = parseChatExport(
    "04/07/2025, 10:12 - محمد العتيبي: مطلوب عمارة سكنية\nالميزانية 9 مليون\nمؤجرة\n" +
    "04/07/2025, 10:30 - سعد: عندي واحدة"
  );
  assert.equal(out.length, 2);
  assert.match(out[0].text, /الميزانيه|الميزانية/);
  assert.match(out[0].text, /مؤجرة|موجره|مؤجره/);
  assert.equal(out[1].sender, "سعد");
});

test("تصدير واتساب: أسطر النظام لا تُعدّ رسائل", () => {
  const out = parseChatExport(
    "[01/01/2025, 1:00:00 ص] واتساب: الرسائل والمكالمات مشفرة من طرف إلى طرف\n" +
    "[01/01/2025, 1:05:00 ص] سعد: <Media omitted>\n" +
    "[01/01/2025, 1:06:00 ص] سعد: مطلوب أرض في جدة 800 متر"
  );
  assert.equal(out.length, 1);
  assert.match(out[0].text, /جدة|جده/);
});

test("ترتيب اليوم والشهر خيار لا تخمين", () => {
  const line = "[03/04/2025, 1:00:00 م] سعد: مطلوب أرض";
  assert.equal(parseChatExport(line)[0].at.slice(0, 10), "2025-04-03");
  assert.equal(parseChatExport(line, { dayFirst: false })[0].at.slice(0, 10), "2025-03-04");
});

test("الكتل تُقسَّم بسطر فارغ أو سطر شُرَط", () => {
  const blocks = splitBlocks("مطلوب أرض 5000 متر\n\nمطلوب عمارة سكنية\n---\nمطلوب مستودع");
  assert.equal(blocks.length, 3);
});

test("الأرقام تُستخرج بأي صيغة وتُوحَّد إلى صيغة واتساب", () => {
  const out = extractPhones("رقمه 0555556666 وشريكه +966501234567 والثالث ٠٥٣٣٣٣٣٣٣٣");
  assert.deepEqual(out, ["966555556666", "966501234567", "966533333333"]);
});

test("تلميح السلسلة يُلتقط من صيغة السوق", () => {
  assert.equal(detectChainHint("الطلب جاني من وسيط عن وسيط ثاني").hinted, true);
  assert.equal(detectChainHint("مطلوب أرض خام 5000 متر").hinted, false);
});

test("السلسلة تُرتَّب من الأقرب إلينا وتُرقَّم من جديد", () => {
  const built = buildChain([
    { name: "المالك", role: "OWNER", position: 3 },
    { name: "أبو سعد", phone: "0555556666", role: "BROKER", position: 1 },
    { name: "وسيط ثانٍ", role: "BROKER", position: 2 },
  ]);
  assert.equal(built.length, 3);
  assert.equal(built.chain[0].name, "أبو سعد");
  assert.equal(built.chain[0].phone, "966555556666");
  assert.equal(built.chain[2].position, 3);
  // المالك في السلسلة يعني أن الطرف الأصلي معروف لنا.
  assert.equal(built.principal_known, true);
});

test("سلسلة بلا مالك ولا صاحب طلب: الطرف الأصلي مجهول", () => {
  const built = buildChain([{ name: "أبو سعد", role: "BROKER" }]);
  assert.equal(built.principal_known, false);
});

test("مجموع حصص لا يساوي مئة يُبلَّغ ولا يُصحَّح", () => {
  const built = buildChain([
    { name: "أ", role: "BROKER", share_pct: 30 },
    { name: "ب", role: "BROKER", share_pct: 30 },
  ]);
  assert.match(built.share_warning, /60/);
  assert.equal(built.chain[0].share_pct, 30);
});

test("مفتاح التكرار يجمع الوصف المتقارب ويفرّق البعيد", () => {
  const a = { property_type: "LAND", city: "الرياض", area_min: 5000, budget_max: 8000000 };
  const b = { property_type: "LAND", city: "الرياض", area_min: 5100, budget_max: 8100000 };
  const c = { property_type: "LAND", city: "جدة", area_min: 5000, budget_max: 8000000 };
  assert.equal(dedupKey(a), dedupKey(b));
  assert.notEqual(dedupKey(a), dedupKey(c));
});

test("التكرار يُرشَّح بالوصف وبجهة الاتصال، ويُرتَّب بالثقة", () => {
  const fields = { property_type: "LAND", city: "الرياض", area_min: 5000, budget_max: 8000000, contact_id: "c1" };
  const rows = [
    { id: "1", ref: "BD-T-000001", contact_id: "c1", property_type: "LAND", city: "الرياض", area_min: 5000, budget_max: 8000000, status: "OPEN", created_at: new Date().toISOString() },
    { id: "2", ref: "BD-T-000002", contact_id: "c9", property_type: "LAND", city: "الرياض", area_min: 5200, budget_max: 8000000, status: "OPEN", created_at: new Date().toISOString() },
    { id: "3", ref: "BD-T-000003", contact_id: "c9", property_type: "VILLA", city: "جدة", status: "OPEN", created_at: new Date().toISOString() },
  ];
  const dups = findDuplicates(fields, rows);
  assert.equal(dups[0].ref, "BD-T-000001");
  assert.equal(dups.length, 2);
  assert.ok(!dups.some((d) => d.ref === "BD-T-000003"));
});

test("الطلب المنتهي والقديم لا يُقترح تكراراً", () => {
  const fields = { property_type: "LAND", city: "الرياض", area_min: 5000 };
  const old = new Date(Date.now() - 200 * 86400000).toISOString();
  const rows = [
    { id: "1", ref: "BD-T-000001", property_type: "LAND", city: "الرياض", area_min: 5000, status: "LOST", created_at: new Date().toISOString() },
    { id: "2", ref: "BD-T-000002", property_type: "LAND", city: "الرياض", area_min: 5000, status: "OPEN", created_at: old, updated_at: old },
  ];
  assert.equal(findDuplicates(fields, rows).length, 0);
});

test("طلب أرشيفي أُدخل اليوم يُفحص للتكرار ولو كانت رسالته قبل سنة", () => {
  // العمر عمرُ الصفّ عندنا لا عمرُ الرسالة: لولا ذلك لسقط كل ما يُستورد
  // من الأرشيف خارج نافذة التكرار لحظة إدخاله.
  const fields = { property_type: "RESIDENTIAL_BUILDING", city: "الرياض", area_min: 5500, area_max: 5500 };
  const rows = [{
    id: "1", ref: "BD-T-000001", property_type: "RESIDENTIAL_BUILDING", city: "الرياض",
    area_min: 5000, area_max: 6000, budget_max: 700000, status: "SEARCHING",
    received_at: new Date(Date.now() - 500 * 86400000).toISOString(),
    created_at: new Date().toISOString(),
  }];
  assert.equal(findDuplicates(fields, rows).length, 1);
});

test("كل قناة لها مسمّى عربي، والمجهول يسقط على «أخرى»", () => {
  assert.equal(channelLabel("INSTAGRAM"), CHANNELS.INSTAGRAM);
  assert.equal(channelLabel("call"), CHANNELS.CALL);
  assert.equal(channelLabel("nope"), CHANNELS.OTHER);
  assert.equal(chainRoleLabel("CLIENT"), "صاحب الطلب");
});

test("الطلب نفسه من وسيط آخر بصيغة أخرى يُرصد تكراراً", () => {
  // هذا ما سقط عليه المفتاح الحرفي: «من ٥٠٠٠ إلى ٦٠٠٠ متر بميزانية»
  // و«٥٥٠٠ متر» بلا ميزانية — طلبٌ واحد وصيغتان.
  const incoming = { property_type: "RESIDENTIAL_BUILDING", city: "الرياض", area_min: 5500, area_max: 5500 };
  const rows = [{
    id: "1", ref: "BD-T-000001", property_type: "RESIDENTIAL_BUILDING", city: "الرياض",
    area_min: 5000, area_max: 6000, budget_max: 9000000, status: "OPEN",
    created_at: new Date().toISOString(),
  }];
  const dups = findDuplicates(incoming, rows);
  assert.equal(dups.length, 1);
  assert.equal(dups[0].ref, "BD-T-000001");
  assert.match(dups[0].reason, /المدينة/);
});

test("مساحتان لا تلتقيان ليستا طلباً واحداً ولو اتفق النوع والمدينة", () => {
  const incoming = { property_type: "LAND", city: "الرياض", area_min: 400, area_max: 600 };
  const rows = [{ id: "1", ref: "BD-T-000001", property_type: "LAND", city: "الرياض", area_min: 9000, area_max: 10000, status: "OPEN", created_at: new Date().toISOString() }];
  assert.equal(findDuplicates(incoming, rows).length, 0);
});

test("طلب رُبحت صفقته لا يُقترح تكراراً", () => {
  const incoming = { property_type: "LAND", city: "الرياض", area_min: 5000 };
  const rows = [{ id: "1", ref: "BD-T-000001", property_type: "LAND", city: "الرياض", area_min: 5000, status: "WON", created_at: new Date().toISOString() }];
  assert.equal(findDuplicates(incoming, rows).length, 0);
});

test("وسيط ينقل رغبة عميله بضمير الغائب: طلب لا عرض", () => {
  assert.equal(classifyMessage("يبغى مستودع في جدة 2000 متر للايجار").intent, "REQUEST");
  assert.equal(classifyMessage("أبغى شقة في الرياض للإيجار").intent, "REQUEST");
  // «يبيع» يجب ألا تُقرأ «يبي» — حرفٌ واحد يقلب العرض طلباً.
  assert.equal(classifyMessage("يبيع عمارة سكنية بالرياض 5000 متر").intent, "LISTING");
  assert.equal(classifyMessage("للبيع مستودع في جدة 2000 متر").intent, "LISTING");
});

test("جواب المكتب نفسه لا يدخل الأرشيف طلباً", () => {
  // «تمام أبحث لك» دخل طلباً يوم كان حدّ التصنيف رقماً تتجاوزه أوزان
  // الكلمات. الحدّ الآن وجود وصفٍ عقاري، فلا يتأثر برفع وزن «أبحث».
  assert.equal(classifyMessage("تمام أبحث لك").intent, "QUESTION");
  assert.equal(classifyMessage("ابشر").intent, "QUESTION");
  assert.equal(classifyMessage("عميلي يبحث عن فرصة").intent, "QUESTION");
  // والدراسة مستثناة: لا متر فيها ولا ريال وهي طلب صحيح.
  assert.equal(classifyMessage("أبغى استشارة عقارية").intent, "STUDY");
});
