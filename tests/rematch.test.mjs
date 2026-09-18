// اختبارات محرك المطابقة — الألماس الأزرق.
// النصوص أدناه مكتوبة على صيغة رسائل السوق الحقيقية لا على صيغة نموذج
// إدخال: بلا تشكيل، بأرقام هندية أحياناً، وبكلمات مختصرة. هذا هو ما يصل
// واتساب، وهو ما يجب أن يُقرأ.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeAr, detectPropertyType, detectCity, extractPrice, extractArea,
  extractIncomeProducing, extractYield, classifyMessage, parseRequestText,
  parseListingText, scoreMatch, rankListings, rankRequests, requestCompleteness,
  nextQuestion, broadcastText, listingCard,
} from "../api/_rematch.js";

test("التطبيع يوحّد الهمزة والتاء المربوطة والأرقام الهندية", () => {
  assert.equal(normalizeAr("أرض ٥٠٠٠م"), "ارض 5000م");
  assert.equal(normalizeAr("عمارة"), "عماره");
  assert.equal(normalizeAr("الريــاض"), "الرياض");
});

test("نوع العقار يُقرأ من كلمات السوق لا من قائمة منسدلة", () => {
  assert.equal(detectPropertyType("ارض خام شمال الرياض"), "LAND");
  assert.equal(detectPropertyType("عمارة سكنية مؤجرة"), "RESIDENTIAL_BUILDING");
  assert.equal(detectPropertyType("مبنى تجاري على شارع تجاري"), "COMMERCIAL_BUILDING");
  assert.equal(detectPropertyType("معرض للايجار"), "SHOWROOM");
  assert.equal(detectPropertyType("سلام عليكم"), null);
});

test("المدينة تُقرأ ولو كُتبت بلا همزة", () => {
  assert.equal(detectCity("قطعة في جده"), "جدة");
  assert.equal(detectCity("شمال الرياض"), "الرياض");
  assert.equal(detectCity("الاحساء الهفوف"), "الأحساء");
});

test("«٨ مليون» و«8م» بعد كلمة السعر مبلغٌ لا مساحة", () => {
  assert.equal(extractPrice("المطلوب 8 مليون"), 8_000_000);
  assert.equal(extractPrice("السعر 8م"), 8_000_000);
  assert.equal(extractPrice("بسعر 850 الف"), 850_000);
  assert.equal(extractPrice("الميزانية ١٢ مليون"), 12_000_000);
  assert.equal(extractPrice("ارض بدون سعر"), null);
});

test("«٥٠٠٠م» في سياق المساحة أمتار لا ملايين", () => {
  assert.equal(extractArea("المساحة 5000").value, 5000);
  assert.equal(extractArea("ارض 750 م2").value, 750);
  assert.equal(extractArea("من 400 الى 600 متر").min, 400);
  assert.equal(extractArea("من 400 الى 600 متر").max, 600);
});

test("«مدر للدخل» ثلاث حالات لا اثنتان", () => {
  assert.equal(extractIncomeProducing("عمارة مؤجرة بالكامل"), true);
  assert.equal(extractIncomeProducing("ارض خام"), false);
  assert.equal(extractIncomeProducing("فيلا في حي النرجس"), null);
});

test("العائد يُقرأ من نصّه ويُحسب من الدخل حين يغيب", () => {
  assert.equal(extractYield("عائد 7.5%"), 7.5);
  const l = parseListingText("عمارة سكنية بالرياض السعر 10 مليون والدخل السنوي 700 الف");
  assert.equal(l.price, 10_000_000);
  assert.equal(l.annual_income, 700_000);
  assert.equal(l.yield_pct, 7);
});

test("التصنيف يفرّق الطلب عن العرض بالاتجاه لا بالمحتوى", () => {
  assert.equal(classifyMessage("عميلي يبحث عن ارض خام شمال الرياض 5000م بحدود 8 مليون").intent, "REQUEST");
  assert.equal(classifyMessage("للبيع عمارة سكنية بحي الملقا مؤجرة بالكامل السعر 12 مليون").intent, "LISTING");
  assert.equal(classifyMessage("ابغى دراسة جدوى لمشروع سكني").intent, "STUDY");
  assert.equal(classifyMessage("السلام عليكم كيف حالك").intent, "QUESTION");
});

test("طلب حقيقي يُقرأ كاملاً من رسالة واحدة", () => {
  const r = parseRequestText("السلام عليكم، عميلي يبحث عن ارض خام شمال الرياض مساحة 5000 متر والميزانية 8 مليون، للاستثمار");
  assert.equal(r.property_type, "LAND");
  assert.equal(r.city, "الرياض");
  assert.equal(r.area_min, 5000);
  assert.equal(r.budget_max, 8_000_000);
  assert.equal(r.purpose, "INVEST");
  assert.ok(r.districts.includes("شمال"));
});

test("عرض حقيقي يُقرأ ويُحسب سعر متره", () => {
  const l = parseListingText("للبيع ارض خام بالرياض حي النرجس المساحة 900 م2 السعر 2.7 مليون صك الكتروني");
  assert.equal(l.property_type, "LAND");
  assert.equal(l.city, "الرياض");
  assert.equal(l.area, 900);
  assert.equal(l.price, 2_700_000);
  assert.equal(l.price_per_m, 3000);
  assert.equal(l.deed_type, "صك إلكتروني");
  assert.equal(l.offer_kind, "SALE");
});

test("المرشّحات القاطعة تمنع إرسال ما لا يُرسل", () => {
  const req = { purpose: "BUY", property_type: "LAND", city: "الرياض", income_producing: true };
  assert.match(scoreMatch(req, { property_type: "LAND", city: "جدة", status: "ACTIVE" }).rejected, /المدينة/);
  assert.match(scoreMatch(req, { property_type: "VILLA", city: "الرياض", status: "ACTIVE" }).rejected, /نوع العقار مختلف/);
  assert.match(scoreMatch(req, { property_type: "LAND", city: "الرياض", status: "SOLD" }).rejected, /غير متاح/);
  assert.match(
    scoreMatch(req, { property_type: "LAND", city: "الرياض", status: "ACTIVE", income_producing: false }).rejected,
    /غير مدر/,
  );
  // الطلب الذي يشترط الشاغر لا يُرسل له المؤجّر
  const vacant = { purpose: "BUY", property_type: "LAND", city: "الرياض", income_producing: false };
  assert.match(scoreMatch(vacant, { property_type: "LAND", city: "الرياض", status: "ACTIVE", income_producing: true }).rejected, /مؤجر/);
});

test("الحقل المجهول لا يُحتسب ولا يُعاقَب", () => {
  // طلبٌ بلا ميزانية يجب ألا تنخفض درجته لأنه لم يذكرها.
  const withBudget = scoreMatch(
    { purpose: "BUY", property_type: "LAND", city: "الرياض", area_min: 800, area_max: 1000, budget_max: 3_000_000 },
    { property_type: "LAND", city: "الرياض", area: 900, price: 2_700_000, status: "ACTIVE" },
  );
  const noBudget = scoreMatch(
    { purpose: "BUY", property_type: "LAND", city: "الرياض", area_min: 800, area_max: 1000 },
    { property_type: "LAND", city: "الرياض", area: 900, price: 2_700_000, status: "ACTIVE" },
  );
  assert.ok(withBudget.score >= 80, `مطابقة تامة يجب أن تتجاوز ٨٠، جاءت ${withBudget.score}`);
  assert.ok(noBudget.score > 0);
  // الدرجة تُقاس على ما قيل، لكن الثقة أقل حين كان المقيس أقل.
  assert.ok(noBudget.score < withBudget.score);
});

test("تجاوز السقف بقليل يبقى مطابقة مع ذكر الفجوة", () => {
  const near = scoreMatch(
    { purpose: "BUY", property_type: "LAND", city: "الرياض", budget_max: 3_000_000, area_min: 800, area_max: 1000 },
    { property_type: "LAND", city: "الرياض", area: 900, price: 3_100_000, status: "ACTIVE" },
  );
  assert.equal(near.rejected, null);
  assert.ok(near.score > 40, `تجاوز ٣٪ يجب أن يبقى مرشحاً، جاء ${near.score}`);
  const far = scoreMatch(
    { purpose: "BUY", property_type: "LAND", city: "الرياض", budget_max: 3_000_000, area_min: 800, area_max: 1000 },
    { property_type: "LAND", city: "الرياض", area: 900, price: 6_000_000, status: "ACTIVE" },
  );
  assert.ok(far.score < near.score);
  assert.ok(far.gaps.some((g) => /يتجاوز السقف/.test(g)));
});

test("الترتيب يُسقط الضجيج ويقدّم الأقرب", () => {
  const req = parseRequestText("ابغى عمارة سكنية مدرة للدخل بالرياض بحدود 12 مليون مساحة 600 متر");
  const listings = [
    { ref: "BD-A-1", ...parseListingText("للبيع عمارة سكنية بالرياض مؤجرة المساحة 620 متر السعر 11.5 مليون الدخل السنوي 800 الف"), status: "ACTIVE" },
    { ref: "BD-A-2", ...parseListingText("للبيع ارض خام بالرياض المساحة 600 متر السعر 3 مليون"), status: "ACTIVE" },
    { ref: "BD-A-3", ...parseListingText("للبيع عمارة سكنية بجدة مؤجرة المساحة 600 متر السعر 11 مليون"), status: "ACTIVE" },
  ];
  const ranked = rankListings(req, listings);
  assert.equal(ranked.length, 1, "الأرض وجدة يجب أن تُستبعدا");
  assert.equal(ranked[0].listing.ref, "BD-A-1");
  assert.ok(ranked[0].reasons.length > 0, "المطابقة تُعلَّل");
});

test("الاتجاه المعاكس: عرضٌ يصل الآن يجد الطلب الذي ينتظره", () => {
  const listing = { ...parseListingText("للبيع ارض خام شمال الرياض 5200 متر السعر 7.8 مليون"), status: "ACTIVE" };
  const requests = [
    { id: "r1", status: "OPEN", ...parseRequestText("عميلي يبحث عن ارض خام شمال الرياض 5000 متر بحدود 8 مليون") },
    { id: "r2", status: "WON", ...parseRequestText("عميلي يبحث عن ارض خام شمال الرياض 5000 متر بحدود 8 مليون") },
    { id: "r3", status: "OPEN", ...parseRequestText("ابغى فيلا في جده") },
  ];
  const hits = rankRequests(listing, requests);
  assert.equal(hits.length, 1, "الطلب المغلق والطلب المختلف يُستبعدان");
  assert.equal(hits[0].request.id, "r1");
});

test("الاكتمال يقود السؤال التالي، ولا يمنع الحفظ", () => {
  const partial = parseRequestText("ابغى ارض");
  const { completeness, missing } = requestCompleteness(partial);
  assert.ok(completeness > 0 && completeness < 100);
  assert.equal(missing[0].key, "city", "المدينة قبل الصك — الترتيب هو الأولوية");
  assert.match(nextQuestion(partial).ask, /مدينة/);
  const full = parseRequestText("ابغى ارض خام بالرياض 900 متر بحدود 3 مليون غير مدرة للدخل");
  assert.equal(requestCompleteness(full).completeness, 100);
  assert.equal(nextQuestion(full), null);
});

test("نص طلب السوق يحمل ما يحتاجه المسوّق ليرد بعرض مطابق", () => {
  const req = { ref: "BD-T-000101", ...parseRequestText("ارض خام شمال الرياض من 4000 الى 6000 متر بحدود 8 مليون") };
  const text = broadcastText(req);
  assert.match(text, /أرض خام/);
  assert.match(text, /الرياض/);
  assert.match(text, /BD-T-000101/);
  assert.match(text, /من لديه ما يطابق/);
});

test("بطاقة العرض تذكر الفجوة كما تذكر الميزة", () => {
  const listing = { ref: "BD-A-9", ...parseListingText("للبيع ارض خام بالرياض 900 متر السعر 3.4 مليون"), status: "ACTIVE" };
  const req = { purpose: "BUY", property_type: "LAND", city: "الرياض", area_min: 800, area_max: 1000, budget_max: 3_000_000 };
  const card = listingCard(listing, scoreMatch(req, listing));
  assert.match(card, /BD-A-9/);
  assert.match(card, /⚠️/, "الفجوة تُقال قبل المعاينة لا بعدها");
});

// ------------------------------------------------ تراجعات أمسكها الاختبار --
test("مدى المساحة لا يُقرأ ميزانية", () => {
  // «من ٥٠٠٠ إلى ٦٠٠٠ متر» كانت تُقرأ ميزانيةً من ٥٠٠٠ إلى ٦٠٠٠ ريال،
  // فيُرفض كل عرض في السوق — وهي أشيع جملة في رسائل الطلبات.
  const r = parseRequestText("عميلي يبحث عن ارض خام شمال الرياض من 5000 الى 6000 متر بحدود 8 مليون");
  assert.equal(r.area_min, 5000);
  assert.equal(r.area_max, 6000);
  assert.equal(r.budget_max, 8_000_000);
  assert.equal(r.budget_min, null);
});

test("مدى بوحدة مال يبقى ميزانية", () => {
  const r = parseRequestText("ابحث عن عماره سكنيه بالرياض من 10 الى 12 مليون");
  assert.equal(r.budget_min, 10_000_000);
  assert.equal(r.budget_max, 12_000_000);
});

test("العرض غير الموثّق يُطابَق ويُذكر تحفّظه، ولا يُقصى", () => {
  // كل عرض يصل واتساب يبدأ UNVERIFIED. إقصاؤه يعني ألا تقع مطابقة أبداً.
  const req = { purpose: "BUY", property_type: "LAND", city: "الرياض", area_min: 800, area_max: 1000, budget_max: 3_000_000 };
  const fresh = { property_type: "LAND", city: "الرياض", area: 900, price: 2_800_000, status: "UNVERIFIED", available: true };
  const m = scoreMatch(req, fresh);
  assert.equal(m.rejected, null);
  assert.ok(m.score > 50);
  assert.ok(m.gaps.some((g) => /لم يُوثَّق/.test(g)), "التحفّظ يُقال لا يُخفى");
  // أما المُباع فيُقصى فعلاً.
  assert.match(scoreMatch(req, { ...fresh, status: "SOLD" }).rejected, /غير متاح/);
});
