// دورة حياة المرشّح في EOR — api/_eor-flow.js (وحدة صِرفة، بلا شبكة) + اتساقها مع db/migrations/2026-10-eor-ops.sql.
// كل أسماء الأشخاص والأرقام هنا بيانات اختبار صريحة، لا بيانات حقيقية.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
const F = await import("../api/_eor-flow.js");

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SQL = fs.readFileSync(path.join(ROOT, "db/migrations/2026-10-eor-ops.sql"), "utf8");

const ROLES = F.ROLES;
const rolesAllowed = (from, to, ctx) => ROLES.filter((r) => F.canTransition(from, to, r, ctx));

/* ═════════════ المراحل ═════════════ */
test("المراحل: ١٦ مرحلة بالترتيب المطلوب + ٣ جانبية، بلا تكرار", () => {
  assert.deepEqual([...F.STAGE_ORDER], [
    "sourced", "screened", "shortlisted", "client_interview", "client_selected", "offer", "contract_signed",
    "visa_processing", "visa_issued", "travelling", "onboarding_ksa", "ready", "deployed", "active", "offboarding", "closed",
  ]);
  assert.deepEqual([...F.SIDE_STAGES], ["rejected", "withdrawn", "on_hold"]);
  assert.equal(new Set(F.ALL_STAGES).size, 19);
  assert.deepEqual([...F.ROLES], ["vendor", "ops", "client", "candidate", "system"]);
});

/* ═════════════ الانتقالات الأمامية: من يملك كل خطوة (جدول كامل لكل دور) ═════════════ */
const FORWARD_OWNERS = [
  ["sourced", "screened", ["ops", "system"]],
  ["screened", "shortlisted", ["ops"]],
  ["shortlisted", "client_interview", ["ops", "client"]],
  ["client_interview", "client_selected", ["ops", "client"]],
  ["client_selected", "offer", ["ops"]],
  ["offer", "contract_signed", ["ops", "candidate", "system"]],
  ["contract_signed", "visa_processing", ["ops"]],
  ["visa_processing", "visa_issued", ["ops", "system"]],
  ["visa_issued", "travelling", ["ops", "vendor"]],
  ["travelling", "onboarding_ksa", ["ops", "system"]],
  ["onboarding_ksa", "ready", ["ops", "system"]],
  ["ready", "deployed", ["ops"]],
  ["deployed", "active", ["ops", "client", "system"]],
  ["active", "offboarding", ["ops", "client"]],
  ["offboarding", "closed", ["ops"]],
];

test("كل انتقال أمامي: الأدوار المسموحة بالضبط والباقي ممنوع", () => {
  assert.equal(FORWARD_OWNERS.length, F.STAGE_ORDER.length - 1);
  for (const [from, to, allowed] of FORWARD_OWNERS) {
    assert.equal(F.STAGE_ORDER.indexOf(to), F.STAGE_ORDER.indexOf(from) + 1, `${from}→${to} متجاوران`);
    for (const role of ROLES) {
      assert.equal(F.canTransition(from, to, role), allowed.includes(role), `${from}→${to} للدور ${role}`);
    }
  }
});

test("لا يملك المورّد ولا المرشّح ولا العميل الانتقالات التشغيلية الحاسمة (التأشيرة، الاستقبال، التسليم، الإغلاق)", () => {
  for (const [from, to] of [["contract_signed", "visa_processing"], ["travelling", "onboarding_ksa"], ["onboarding_ksa", "ready"], ["ready", "deployed"], ["offboarding", "closed"], ["client_selected", "offer"]]) {
    for (const role of ["vendor", "client", "candidate"]) assert.equal(F.canTransition(from, to, role), false, `${role}: ${from}→${to}`);
  }
});

/* ═════════════ منع القفز والرجوع ═════════════ */
test("القفز فوق مرحلة ممنوع لكل دور (كل زوج غير متجاور في الترتيب)", () => {
  let checked = 0;
  for (let i = 0; i < F.STAGE_ORDER.length; i++) {
    for (let j = i + 2; j < F.STAGE_ORDER.length; j++) {
      for (const role of ROLES) {
        assert.equal(F.canTransition(F.STAGE_ORDER[i], F.STAGE_ORDER[j], role), false, `${role}: ${F.STAGE_ORDER[i]}→${F.STAGE_ORDER[j]}`);
        checked++;
      }
    }
  }
  assert.ok(checked > 500);
});

test("الرجوع للخلف ممنوع، والبقاء في المرحلة نفسها ليس انتقالاً", () => {
  for (let i = 0; i < F.STAGE_ORDER.length; i++) {
    for (let j = 0; j <= i; j++) {
      for (const role of ROLES) assert.equal(F.canTransition(F.STAGE_ORDER[i], F.STAGE_ORDER[j], role), false, `${role}: ${F.STAGE_ORDER[i]}→${F.STAGE_ORDER[j]}`);
    }
  }
});

test("مراحل نهائية: closed/rejected/withdrawn لا يخرج منها أحد، ولا nextStages لها", () => {
  for (const s of F.TERMINAL_STAGES) {
    for (const to of F.ALL_STAGES) for (const role of ROLES) assert.equal(F.canTransition(s, to, role, { heldFrom: "sourced" }), false, `${role}: ${s}→${to}`);
    for (const role of ROLES) assert.deepEqual(F.nextStages(s, role), []);
  }
});

test("مدخلات مجهولة: مرحلة أو دور غير معروف ⇒ false / مصفوفة فارغة، بلا استثناء", () => {
  assert.equal(F.canTransition("sourced", "screened", "admin"), false);
  assert.equal(F.canTransition("sourced", "screened", undefined), false);
  assert.equal(F.canTransition("nope", "screened", "ops"), false);
  assert.equal(F.canTransition("sourced", "nope", "ops"), false);
  assert.equal(F.canTransition(null, null, "ops"), false);
  assert.deepEqual(F.nextStages("nope", "ops"), []);
  assert.deepEqual(F.nextStages("sourced", "admin"), []);
});

test("employee اسم آخر للمرشّح في الأدوار", () => {
  assert.equal(F.canTransition("offer", "contract_signed", "employee"), true);
  assert.equal(F.canTransition("offer", "contract_signed", "EMPLOYEE"), true);
});

/* ═════════════ الجانبية: رفض وانسحاب وتعليق ═════════════ */
test("الرفض: ops من sourced حتى offer؛ العميل فقط في القائمة المختصرة/المقابلة/الاختيار؛ المورّد والمرشّح لا يرفضان", () => {
  for (const from of ["sourced", "screened", "shortlisted", "client_interview", "client_selected", "offer"]) {
    assert.equal(F.canTransition(from, "rejected", "ops"), true, from);
    assert.equal(F.canTransition(from, "rejected", "vendor"), false, from);
    assert.equal(F.canTransition(from, "rejected", "candidate"), false, from);
  }
  for (const from of ["shortlisted", "client_interview", "client_selected"]) assert.equal(F.canTransition(from, "rejected", "client"), true, from);
  for (const from of ["sourced", "screened", "offer"]) assert.equal(F.canTransition(from, "rejected", "client"), false, from);
  for (const from of ["contract_signed", "visa_processing", "ready", "deployed", "active", "offboarding"]) {
    for (const role of ROLES) assert.equal(F.canTransition(from, "rejected", role), false, `${role}: ${from}→rejected (بعد العقد يكون انسحاباً/إنهاءً لا رفضاً)`);
  }
});

test("الانسحاب: المورّد والمرشّح حتى توقيع العقد فقط؛ بعده ops وحده حتى ready؛ بعد التسليم لا انسحاب", () => {
  for (const from of ["sourced", "screened", "shortlisted", "client_interview", "client_selected", "offer"]) {
    assert.deepEqual(rolesAllowed(from, "withdrawn"), ["vendor", "ops", "candidate"].sort((a, b) => ROLES.indexOf(a) - ROLES.indexOf(b)), from);
  }
  for (const from of ["contract_signed", "visa_processing", "visa_issued", "travelling", "onboarding_ksa", "ready"]) {
    assert.deepEqual(rolesAllowed(from, "withdrawn"), ["ops"], from);
  }
  for (const from of ["deployed", "active", "offboarding", "closed"]) assert.deepEqual(rolesAllowed(from, "withdrawn"), [], from);
});

test("التعليق on_hold: ops وحده من sourced حتى ready", () => {
  for (const from of F.STAGE_ORDER.slice(0, F.STAGE_ORDER.indexOf("ready") + 1)) assert.deepEqual(rolesAllowed(from, "on_hold"), ["ops"], from);
  for (const from of ["deployed", "active", "offboarding", "closed"]) assert.deepEqual(rolesAllowed(from, "on_hold"), [], from);
});

test("الاستئناف من on_hold: إلى المرحلة التي عُلّق منها فقط وبـctx.heldFrom، وبـops وحده", () => {
  assert.equal(F.canTransition("on_hold", "visa_processing", "ops"), false, "بلا ctx لا استئناف");
  assert.equal(F.canTransition("on_hold", "visa_processing", "ops", { heldFrom: "visa_processing" }), true);
  assert.equal(F.canTransition("on_hold", "visa_issued", "ops", { heldFrom: "visa_processing" }), false, "ليس قفزاً للأمام عبر التعليق");
  assert.equal(F.canTransition("on_hold", "sourced", "ops", { heldFrom: "visa_processing" }), false);
  for (const role of ["vendor", "client", "candidate", "system"]) assert.equal(F.canTransition("on_hold", "visa_processing", role, { heldFrom: "visa_processing" }), false, role);
  assert.equal(F.canTransition("on_hold", "active", "ops", { heldFrom: "active" }), false, "لا تعليق بعد التسليم أصلاً");
  assert.equal(F.canTransition("on_hold", "rejected", "ops"), true);
  assert.equal(F.canTransition("on_hold", "withdrawn", "ops"), true);
  assert.equal(F.canTransition("on_hold", "withdrawn", "candidate"), false);
});

/* ═════════════ nextStages ═════════════ */
test("nextStages: ما يملكه كل دور من مرحلة واحدة", () => {
  assert.deepEqual(F.nextStages("shortlisted", "client"), ["client_interview", "rejected"]);
  assert.deepEqual(F.nextStages("shortlisted", "ops"), ["client_interview", "rejected", "withdrawn", "on_hold"]);
  assert.deepEqual(F.nextStages("shortlisted", "vendor"), ["withdrawn"]);
  assert.deepEqual(F.nextStages("shortlisted", "candidate"), ["withdrawn"]);
  assert.deepEqual(F.nextStages("shortlisted", "system"), []);
  assert.deepEqual(F.nextStages("offer", "candidate"), ["contract_signed", "withdrawn"]);
  assert.deepEqual(F.nextStages("active", "client"), ["offboarding"]);
  assert.deepEqual(F.nextStages("on_hold", "ops", { heldFrom: "ready" }), ["ready", "rejected", "withdrawn"]);
  assert.deepEqual(F.nextStages("on_hold", "ops"), ["rejected", "withdrawn"]);
});

test("nextStages ⊆ canTransition: كل ما يُعرض مسموح وكل مسموح يُعرض (مسح كامل)", () => {
  for (const from of F.ALL_STAGES) {
    for (const role of ROLES) {
      const expect = F.ALL_STAGES.filter((to) => F.canTransition(from, to, role, { heldFrom: "screened" }));
      assert.deepEqual(F.nextStages(from, role, { heldFrom: "screened" }), expect);
    }
  }
});

test("rolesFor يطابق canTransition", () => {
  assert.deepEqual(F.rolesFor("offer", "contract_signed"), ["candidate", "ops", "system"]);
  assert.deepEqual(F.rolesFor("sourced", "offer"), []);
});

/* ═════════════ القوائم الافتراضية ═════════════ */
test("visaChecklist: الخطوات الخمس بالترتيب المطلوب، كل خطوة بإثبات ومكتب منفّذ", () => {
  const steps = F.visaChecklist("IN");
  assert.deepEqual(steps.map((s) => s.key), ["criminal_check", "medical_check", "documents_certificates", "application_submission", "visa_issuance"]);
  assert.deepEqual(steps.map((s) => s.position), [1, 2, 3, 4, 5]);
  assert.ok(steps.every((s) => s.requiresProof === true && s.executor === "office" && s.country === "IN" && s.titleAr && s.titleEn));
  assert.equal(steps[0].titleAr, "الفحص الجنائي");
  assert.equal(steps[1].titleAr, "الفحص الطبي");
});

test("visaChecklist: لا ادّعاء نظامي ولا أسماء جهات حكومية في النص", () => {
  const text = JSON.stringify(F.visaChecklist("PK")) + JSON.stringify(F.onboardingChecklist()) + JSON.stringify(F.CHECKLIST_NOTICE);
  for (const banned of ["قوى", "مقيم", "أبشر", "وزارة", "الهيئة", "التأمينات", "منصة", "Qiwa", "Muqeem", "Absher", "GOSI", "Ministry", "MOL", "ZATCA", "نظام العمل", "المادة", "يجب بموجب", "إلزامي نظاماً"]) {
    assert.ok(!text.includes(banned), `النص يحوي «${banned}»`);
  }
  assert.match(F.CHECKLIST_NOTICE.ar, /مراجعة قانونية/);
});

test("visaChecklist: بلد غير صالح/غائب لا يكسر القائمة، ويُرجَع نسخٌ مستقلة", () => {
  for (const c of [undefined, null, "", "india", "X", 5]) {
    const s = F.visaChecklist(c);
    assert.equal(s.length, 5);
    assert.equal(s[0].country, null);
  }
  assert.equal(F.visaChecklist("in")[0].country, "IN");
  const a = F.visaChecklist("IN"); a[0].key = "tampered"; a.pop();
  assert.equal(F.visaChecklist("IN")[0].key, "criminal_check");
  assert.equal(F.visaChecklist("IN").length, 5);
});

test("onboardingChecklist: إقامة وتأمين وفحص طبي ورسوم رخصة العمل، والرسم وحده يحمل مبلغاً", () => {
  const items = F.onboardingChecklist();
  assert.deepEqual(items.map((i) => i.key), ["residency", "insurance", "medical_check", "work_permit_fee"]);
  assert.deepEqual(items.map((i) => i.hasAmount), [false, false, false, true]);
  items[0].key = "x";
  assert.equal(F.onboardingChecklist()[0].key, "residency");
});

/* ═════════════ أقنعة الخصوصية ═════════════ */
const secret = {
  margin: 91237, marginHalalas: 91237, costMonthlyHalalas: 7123456, salaryHalalas: 4137290, vendorFeeHalalas: 555111,
};
const mk = (over = {}) => ({
  id: "pl-1", requestId: "rq-1", itemId: "it-1", clientId: "cl-1", sourceVendorId: "vn-1", candidateKey: "notion-page-abc",
  stage: "shortlisted", heldFrom: null,
  profile: { occupationId: "hosp.waiter", nationality: "IN", experienceYears: 4, headline: "نادل مطعم" },
  contact: { name: "اسم اختباري", phone: "+966500000000", email: "x@example.test", whatsapp: "+966500000000", nationalId: "1000000000", passportNo: "P1234567", dateOfBirth: "1995-01-01", address: "الرياض" },
  salePriceMonthlyHalalas: 669166, currency: "SAR",
  costSheet: { ...secret }, margin: secret.margin, salaryHalalas: secret.salaryHalalas, vendorFeeHalalas: secret.vendorFeeHalalas,
  vendor: { id: "vn-1", nameAr: "مكتب اختباري" }, internalNotes: "ملاحظة داخلية", opsNotes: "x", createdAt: "2026-10-01T00:00:00Z",
  ...over,
});
const dump = (o) => JSON.stringify(o);
const CLIENT = { clientId: "cl-1" }, VENDOR = { vendorId: "vn-1" }, CAND = { candidateKey: "notion-page-abc" };

test("قناع العميل قبل الاختيار: لا مورّد ولا هامش ولا تكلفة ولا راتب ولا بيانات تواصل ولا مفتاح المرشّح", () => {
  for (const stage of ["sourced", "screened", "shortlisted", "client_interview"]) {
    const m = F.maskForRole(mk({ stage }), "client", CLIENT);
    const j = dump(m);
    for (const k of ["contact", "sourceVendorId", "vendor", "margin", "costSheet", "salaryHalalas", "vendorFeeHalalas", "candidateKey", "internalNotes", "opsNotes"]) assert.equal(m[k], undefined, `${stage}: ${k}`);
    for (const val of ["+966500000000", "x@example.test", "1000000000", "P1234567", "1995-01-01", "اسم اختباري", "notion-page-abc", "مكتب اختباري", String(secret.margin), String(secret.salaryHalalas), String(secret.costMonthlyHalalas), String(secret.vendorFeeHalalas)]) {
      assert.ok(!j.includes(val), `${stage}: القيمة ${val} تسرّبت`);
    }
    assert.equal(m.salePriceMonthlyHalalas, 669166);
    assert.deepEqual(m.profile, { occupationId: "hosp.waiter", nationality: "IN", experienceYears: 4, headline: "نادل مطعم" });
  }
});

test("قناع العميل بعد الاختيار: يرى الاسم والجوال والبريد، ولا الهوية/الجواز/الميلاد/العنوان ولا المورّد ولا الهامش", () => {
  for (const stage of ["client_selected", "offer", "contract_signed", "visa_processing", "active"]) {
    const m = F.maskForRole(mk({ stage }), "client", CLIENT);
    assert.deepEqual(Object.keys(m.contact).sort(), ["email", "name", "phone", "whatsapp"], stage);
    const j = dump(m);
    for (const val of ["1000000000", "P1234567", "1995-01-01", "الرياض", "مكتب اختباري", String(secret.margin), String(secret.salaryHalalas), "notion-page-abc"]) assert.ok(!j.includes(val), `${stage}: ${val}`);
    assert.equal(m.vendor, undefined);
    assert.equal(m.sourceVendorId, undefined);
  }
});

test("قناع العميل: رُفض/انسحب بعد الاختيار ⇒ تعود بيانات التواصل مخفيّة؛ المعلّق يُقاس بمرحلته قبل التعليق", () => {
  for (const stage of ["rejected", "withdrawn"]) assert.equal(F.maskForRole(mk({ stage }), "client", CLIENT).contact, undefined, stage);
  assert.equal(F.maskForRole(mk({ stage: "on_hold", heldFrom: "shortlisted" }), "client", CLIENT).contact, undefined);
  assert.ok(F.maskForRole(mk({ stage: "on_hold", heldFrom: "offer" }), "client", CLIENT).contact);
});

test("قناع العميل: يفشل مُغلقاً — بلا ctx أو عميل آخر ⇒ null", () => {
  assert.equal(F.maskForRole(mk(), "client"), null);
  assert.equal(F.maskForRole(mk(), "client", {}), null);
  assert.equal(F.maskForRole(mk(), "client", { clientId: "cl-2" }), null);
  assert.equal(F.maskForRole(mk(), "client", { clientId: "" }), null);
  assert.equal(F.maskForRole(mk({ clientId: undefined }), "client", { clientId: undefined }), null);
});

test("قناع العميل: قائمة بيضاء — حقلٌ جديد غير معلَن يبقى مخفياً، والتنظيف العميق يلتقط المفاتيح الحسّاسة داخل المسموح", () => {
  const m = F.maskForRole(mk({ brandNewField: "x", profile: { occupationId: "a", expected_salary: 9999, vendor_name: "v", nested: { Margin_Rate: 0.2, fine: 1 }, list: [{ cost: 5, ok: 2 }], phone: "+966" } }), "client", CLIENT);
  assert.equal(m.brandNewField, undefined);
  assert.deepEqual(m.profile, { occupationId: "a", nested: { fine: 1 }, list: [{ ok: 2 }] });
});

test("قناع المورّد: مرشّحوه وحدهم، بلا عميل ولا سعر بيع ولا هامش ولا تكلفة، ويرى رسومه هو", () => {
  const m = F.maskForRole(mk({ stage: "client_selected" }), "vendor", VENDOR);
  for (const k of ["clientId", "requestId", "salePriceMonthlyHalalas", "margin", "costSheet", "salaryHalalas", "internalNotes", "vendor"]) assert.equal(m[k], undefined, k);
  assert.equal(m.vendorFeeHalalas, secret.vendorFeeHalalas);
  assert.equal(m.candidateKey, "notion-page-abc");
  assert.ok(m.contact && m.contact.phone);
  const j = dump(m);
  for (const val of ["669166", String(secret.margin), String(secret.costMonthlyHalalas), "cl-1"]) assert.ok(!j.includes(val), val);
  assert.equal(F.maskForRole(mk(), "vendor", { vendorId: "vn-2" }), null, "مرشّح مورّد آخر");
  assert.equal(F.maskForRole(mk(), "vendor"), null);
  assert.equal(F.maskForRole(mk({ sourceVendorId: null }), "vendor", { vendorId: null }), null);
});

test("قناع المورّد: التنظيف العميق يحجب أي مفتاح عن عميل/سعر داخل الحقول المسموحة", () => {
  const m = F.maskForRole(mk({ profile: { occupationId: "a", clientName: "أرامكو اختباري", sale_price: 5, organizationId: "o", ok: 1 } }), "vendor", VENDOR);
  assert.deepEqual(m.profile, { occupationId: "a", ok: 1 });
});

test("قناع الموظف/المرشّح: سجلّه وحده، لا سعر بيع ولا هامش ولا مورّد ولا تكلفة، ويرى راتبه التعاقدي وبياناته", () => {
  for (const role of ["candidate", "employee"]) {
    const m = F.maskForRole(mk({ stage: "contract_signed", visa: { status: "open", officeName: "مكتب", officeVendorId: "vn-9" }, onboarding: [{ key: "residency" }] }), role, CAND);
    for (const k of ["salePriceMonthlyHalalas", "margin", "costSheet", "vendor", "sourceVendorId", "vendorFeeHalalas", "clientId", "requestId", "candidateKey", "internalNotes"]) assert.equal(m[k], undefined, `${role}: ${k}`);
    assert.equal(m.salaryHalalas, secret.salaryHalalas);
    assert.ok(m.contact.name);
    assert.deepEqual(m.visa, { status: "open", officeName: "مكتب" }, "معرّف المورّد داخل التأشيرة محجوب");
    const j = dump(m);
    for (const val of ["669166", String(secret.margin), String(secret.vendorFeeHalalas), String(secret.costMonthlyHalalas), "cl-1", "vn-1"]) assert.ok(!j.includes(val), `${role}: ${val}`);
  }
  assert.equal(F.maskForRole(mk(), "candidate", { candidateKey: "notion-other" }), null);
  assert.equal(F.maskForRole(mk(), "candidate"), null);
});

test("ops وsystem يريان كل شيء (نسخة كاملة)، والدور المجهول لا يرى شيئاً", () => {
  const p = mk();
  for (const role of ["ops", "system"]) assert.deepEqual(F.maskForRole(p, role), p);
  assert.equal(F.maskForRole(p, "admin", CLIENT), null);
  assert.equal(F.maskForRole(p, undefined, CLIENT), null);
  assert.equal(F.maskForRole(null, "ops"), null);
  assert.equal(F.maskForRole("x", "ops"), null);
  assert.equal(F.maskForRole([], "ops"), null);
});

test("القناع نسخة: لا يعدّل المُدخَل ولا يشاركه مراجعه، ويتجاهل __proto__", () => {
  const p = mk();
  const before = dump(p);
  const m = F.maskForRole(p, "client", CLIENT);
  m.profile.headline = "عبث";
  assert.equal(dump(p), before);
  const o = F.maskForRole(p, "ops");
  o.contact.name = "عبث";
  assert.equal(dump(p), before);
  const evil = mk({ profile: JSON.parse('{"__proto__":{"polluted":1},"ok":1}') });
  const e = F.maskForRole(evil, "client", CLIENT);
  assert.equal(({}).polluted, undefined);
  assert.equal(e.profile.ok, 1);
});

test("maskListForRole: يُسقط ما لا يخص الدور بدل أن يكشفه", () => {
  const list = [mk({ id: "a" }), mk({ id: "b", clientId: "cl-2" }), mk({ id: "c" })];
  assert.deepEqual(F.maskListForRole(list, "client", CLIENT).map((p) => p.id), ["a", "c"]);
  assert.deepEqual(F.maskListForRole(null, "client", CLIENT), []);
});

/* ═════════════ اتساق القاعدة والكود ═════════════ */
const quoted = (s) => [...s.matchAll(/'([^']+)'/g)].map((m) => m[1]);

test("مسوّدة SQL: قائمة مراحل eor_placements = ALL_STAGES بالترتيب، وheld_from = مراحل ما قبل التسليم، وأدوار السجل = ROLES", () => {
  const stage = SQL.match(/stage text not null default 'sourced' check \(stage in\s*\(([^)]*)\)\)/);
  assert.ok(stage, "لم يُعثر على قيد المرحلة");
  assert.deepEqual(quoted(stage[1]), [...F.ALL_STAGES]);
  const held = SQL.match(/held_from text check \(held_from is null or held_from in\s*\(([^)]*)\)\)/);
  assert.ok(held, "لم يُعثر على قيد held_from");
  assert.deepEqual(quoted(held[1]), F.STAGE_ORDER.slice(0, F.STAGE_ORDER.indexOf("ready") + 1));
  const actor = SQL.match(/actor_role text not null check \(actor_role in \(([^)]*)\)\)/);
  assert.ok(actor, "لم يُعثر على قيد actor_role");
  assert.deepEqual(quoted(actor[1]), [...F.ROLES]);
});

test("مسوّدة SQL: كل جداول eor_ تفعّل RLS، والقراءة للعميل على الجداول الخالية من الحقول الداخلية فقط، ولا بيانات شخصية للمرشّح", () => {
  const tables = [...SQL.matchAll(/create table if not exists (eor_[a-z_]+)/g)].map((m) => m[1]);
  assert.equal(tables.length, 15);
  const rls = SQL.match(/foreach t in array array\[([\s\S]*?)\]\s*loop/)[1];
  for (const t of tables) assert.ok(rls.includes(`'${t}'`), `RLS مفقود لـ${t}`);
  const policies = [...SQL.matchAll(/create policy (eor_[a-z_]+) on (eor_[a-z_]+)/g)].map((m) => m[2]).sort();
  assert.deepEqual(policies, ["eor_clients", "eor_request_items", "eor_requests", "eor_timesheet_entries", "eor_timesheets"]);
  for (const t of ["eor_cost_sheets", "eor_placements", "eor_vendors", "eor_payslips", "eor_pay_runs"]) assert.ok(!policies.includes(t), `${t} لا يجوز أن يقرأه العميل`);
  const placements = SQL.match(/create table if not exists eor_placements \(([\s\S]*?)\n\);/)[1];
  for (const pii of [" name", "phone", "email", "passport", "national_id", "birth", "address"]) assert.ok(!placements.includes(pii), `eor_placements يحوي ${pii}`);
  assert.match(placements, /candidate_key text not null/);
  const costSheet = SQL.match(/create table if not exists eor_cost_sheets \(/);
  assert.ok(costSheet);
  for (const t of ["eor_requests", "eor_request_items", "eor_timesheets", "eor_timesheet_entries"]) {
    const body = SQL.match(new RegExp(`create table if not exists ${t} \\(([\\s\\S]*?)\\n\\);`))[1];
    // أسماء الأعمدة فقط (target_salary_halalas تصريح العميل نفسه فليس داخلياً)
    const cols = body.split("\n").map((l) => (l.match(/^\s{2}([a-z_]+)\s/) || [])[1]).filter(Boolean);
    for (const internal of ["margin_rate", "margin_halalas", "salary_halalas", "vendor_fee_halalas", "cost_monthly_halalas", "source_vendor_id", "sale_monthly_halalas"]) assert.ok(!cols.includes(internal), `${t} يحوي عموداً داخلياً ${internal}`);
    assert.ok(cols.length > 4, `${t}: لم تُستخرج الأعمدة`);
  }
});
