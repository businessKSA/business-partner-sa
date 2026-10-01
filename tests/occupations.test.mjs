// المهنة الموحَّدة (api/_occupations.js) — 2026-10-01.
//
// السبب: جدول المرشّحين في Notion فيه ٧٤٦٢ مسمّىً مختلفاً في «Original Position» لنحو ١٧ ألف سيرة (٧٨٠٠ منها
// يظهر مرّةً واحدة)، والمهنة الواحدة تُكتب بعشر صيغٍ (CDP، Chef de Partie، شيف دي بارتي، شيف قسم، Demi CDP...).
// فلا بحثٌ ولا مطابقةٌ تعمل على نصٍّ حرّ. هذه الاختبارات تثبّت: (١) الدمج الصحيح لما هو مهنةٌ واحدة،
// (٢) بقاء المراتب القياسية مستقلة، (٣) أن «غير مصنّف» جوابٌ صريح لا تخمين، (٤) أن الخريطة المحفوظة
// في api/_occupation-map.json هي ناتج المصنِّف نفسه الآن، لا نسخةٌ قديمة.
//
// المسمّيات كلها حقيقية من القاعدة (بلا اسمٍ ولا رقم)، وتعمل بلا شبكة.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  canonicalOccupation, occupationById, occupationOptionName, titleKey, searchOccupations, occupationLadder,
  OCCUPATIONS, OCC_CONFLICTS, OCC_VERSION, SECTORS, CONFIDENCE_AR, UNCLASSIFIED,
} from "../api/_occupations.js";

// [المسمّى كما في Notion، المهنة المتوقّعة، المستوى المتوقّع ("" = بلا)]
const CASES = [
  // ── سلّم المطبخ: كل مرتبةٍ مستقلة، وكل تسميةٍ لنفس المرتبة تجتمع ──
  ["chef de partie", "hosp.chef-de-partie", ""], ["cdp", "hosp.chef-de-partie", ""], ["CDP", "hosp.chef-de-partie", ""],
  ["chef de party", "hosp.chef-de-partie", ""], ["شيف دي بارتي", "hosp.chef-de-partie", ""], ["شيف قسم", "hosp.chef-de-partie", ""],
  ["senior chef de partie", "hosp.chef-de-partie", "senior"], ["chef de partie (cdp)", "hosp.chef-de-partie", ""],
  ["demi chef de partie", "hosp.demi-chef-de-partie", ""], ["demi cdp", "hosp.demi-chef-de-partie", ""], ["dcdp", "hosp.demi-chef-de-partie", ""], ["demi chef", "hosp.demi-chef-de-partie", ""],
  ["commis chef", "hosp.commis-chef", ""], ["commis 1", "hosp.commis-chef", ""], ["commi chef", "hosp.commis-chef", ""], ["كومي شيف", "hosp.commis-chef", ""],
  ["cook", "hosp.cook", ""], ["كوك", "hosp.cook", ""], ["line cook", "hosp.cook", ""], ["طباخ", "hosp.cook", ""],
  ["sous chef", "hosp.sous-chef", ""], ["سو شيف", "hosp.sous-chef", ""], ["junior sous chef", "hosp.sous-chef", "junior"],
  ["executive sous chef", "hosp.executive-sous-chef", ""],
  ["head chef", "hosp.head-chef", ""], ["chef de cuisine", "hosp.head-chef", ""], ["executive chef", "hosp.executive-chef", ""],
  ["pastry chef", "hosp.pastry-chef", ""], ["شيف حلويات", "hosp.pastry-chef", ""], ["executive pastry chef", "hosp.head-pastry-chef", ""],
  // ── سلّم الصالة ──
  ["waiter", "hosp.waiter", ""], ["Waitress", "hosp.waiter", ""], ["server", "hosp.waiter", ""], ["نادل", "hosp.waiter", ""], ["senior waiter", "hosp.waiter", "senior"],
  ["captain waiter", "hosp.captain", ""], ["head waiter", "hosp.head-waiter", ""], ["رئيس نادل", "hosp.head-waiter", ""], ["head waitress", "hosp.head-waiter", ""],
  ["restaurant supervisor", "hosp.restaurant-supervisor", ""], ["f&b supervisor", "hosp.restaurant-supervisor", ""], ["مشرف مطعم", "hosp.restaurant-supervisor", ""],
  ["restaurant manager", "hosp.restaurant-manager", ""], ["assistant restaurant manager", "hosp.restaurant-manager", "assistant"], ["مدير مطعم", "hosp.restaurant-manager", ""],
  ["F&B Manager", "hosp.fb-manager", ""], ["barista", "hosp.barista", ""], ["باريستا", "hosp.barista", ""], ["bartender", "hosp.bartender", ""], ["hostess", "hosp.host", ""],
  // ── مجالاتٌ أخرى ──
  ["customer service representative", "cs.representative", ""], ["ممثل خدمة عملاء", "cs.representative", ""], ["CSR", "cs.representative", ""],
  ["accountant", "fin.accountant", ""], ["محاسب أول", "fin.accountant", "senior"], ["Senior Accountant", "fin.accountant", "senior"], ["chief accountant", "fin.chief-accountant", ""],
  ["finance manager", "fin.finance-manager", ""], ["مدير مالي", "fin.finance-manager", ""], ["financial analyst", "fin.financial-analyst", ""],
  ["hr specialist", "hr.specialist", ""], ["أخصائي موارد بشرية", "hr.specialist", ""], ["HR Manager", "hr.manager", ""], ["مدير موارد بشرية", "hr.manager", ""],
  ["project manager", "project.manager", ""], ["مدير مشروع", "project.manager", ""], ["operations manager", "ops.manager", ""], ["مدير عمليات", "ops.manager", ""],
  ["supply chain manager", "scm.manager", ""], ["مدير سلسلة الإمداد", "scm.manager", ""], ["procurement officer", "procurement.specialist", ""], ["مدير مشتريات", "procurement.manager", ""],
  ["warehouse supervisor", "warehouse.supervisor", ""], ["مدير لوجستيات", "logistics.manager", ""],
  ["sales executive", "sales.sales-executive", ""], ["مندوب مبيعات", "sales.sales-executive", ""], ["salesman", "sales.retail-sales-associate", ""],
  ["business development manager", "sales.business-development-manager", ""], ["مدير علاقات عامة", "pr.manager", ""], ["public relations officer", "pr.specialist", ""],
  ["social media manager", "social.manager", ""], ["receptionist", "adm.receptionist", ""], ["موظفة استقبال", "adm.receptionist", ""], ["executive secretary", "adm.secretary", ""],
  ["administrative assistant", "adm.administrative-assistant", ""], ["مدخل بيانات", "adm.data-entry", ""], ["cashier", "ret.cashier", ""], ["كاشير", "ret.cashier", ""], ["driver", "log.driver", ""], ["سائق", "log.driver", ""],
  ["mechanical engineer", "eng.mechanical-engineer", ""], ["مهندس مدني", "eng.civil-engineer", ""], ["Sr. Planning Engineer", "eng.planning-engineer", "senior"], ["QA/QC Engineer", "eng.qaqc-engineer", ""],
  ["software developer", "it.software-developer", ""], ["teacher", "edu.teacher", ""], ["معلمة", "edu.teacher", ""], ["english teacher", "edu.english-teacher", ""],
  // ── جهة العمل والأقواس وبدائل «/» لا تغيّر المهنة ──
  ["senior accountant - salama cooperative insurance", "fin.accountant", "senior"], ["executive chef — aswad group، المنطقة الشرقية", "hosp.executive-chef", ""],
  ["head waiter - madeleine restaurant (adyaf group)", "hosp.head-waiter", ""], ["operations manager / hr in charge - chili house", "ops.manager", ""],
  ["waiter / barista", "hosp.waiter", ""], ["production - hot mill supervisor - arcelormittal tubular products", "production.supervisor", ""],
  // ── أخطاء إملائية وترتيب كلمات ──
  ["accountent", "fin.accountant", ""], ["wiater", "hosp.waiter", ""], ["resturant manager", "hosp.restaurant-manager", ""], ["costumer service representative", "cs.representative", ""],
  ["marketng manager", "marketing.manager", ""], ["manager restaurant", "hosp.restaurant-manager", ""], ["chef executive", "hosp.executive-chef", ""],
  // ── ويتر بالعربية والواو الأصلية ──
  ["ويتر", "hosp.waiter", ""], ["مدير الأغذية والمشروبات", "hosp.fb-manager", ""],
];

test("المصنِّف: ٩٠+ مسمّىً حقيقياً (عربي/إنجليزي/مختصر/خطأ إملائي) → المهنة والمستوى المتوقعان", () => {
  assert.ok(CASES.length >= 90, `الحالات ${CASES.length}`);
  const bad = [];
  for (const [title, id, level] of CASES) {
    const r = canonicalOccupation(title);
    if (r.id !== id || r.level !== level) bad.push(`${JSON.stringify(title)} → ${r.id}/${r.level || "-"} (المتوقع ${id}/${level || "-"})`);
  }
  assert.deepEqual(bad, []);
});

test("الجمع/المفرد والمؤنّث/المذكّر والتشكيل وهمزات الألف والتاء المربوطة = مهنةٌ واحدة", () => {
  const same = (...xs) => { const ids = new Set(xs.map((x) => canonicalOccupation(x).id)); assert.equal(ids.size, 1, `${xs.join(" | ")} → ${[...ids].join(",")}`); };
  same("waiter", "Waiters", "WAITER", "  waiter ", "Waiter.");
  same("accountant", "Accountants", "محاسب", "محاسبة", "محَاسِب");
  same("موظف استقبال", "موظفة استقبال", "موظفه استقبال");
  same("أخصائي موارد بشرية", "اخصائي موارد بشرية", "إخصائي موارد بشرية", "أخصائية موارد بشرية");
  same("مدير مطعم", "مديرة مطعم", "مدير المطعم");
});

test("المراتب القياسية تبقى مستقلة، وما هو مستوىً لا يصير مهنةً", () => {
  const id = (t) => canonicalOccupation(t).id;
  // سلّم المطبخ: لا اثنان منها مهنةٌ واحدة
  const ladder = ["commis chef", "demi chef de partie", "chef de partie", "sous chef", "executive sous chef", "head chef", "executive chef"].map(id);
  assert.equal(new Set(ladder).size, ladder.length, ladder.join(" > "));
  // سلّم الصالة
  const floor = ["runner", "waiter", "captain waiter", "head waiter", "restaurant supervisor", "restaurant manager"].map(id);
  assert.equal(new Set(floor).size, floor.length, floor.join(" > "));
  // Senior/Junior/Assistant مستويات
  assert.equal(id("senior accountant"), id("accountant"));
  assert.equal(id("junior accountant"), id("accountant"));
  assert.equal(id("assistant accountant"), id("accountant"));
  assert.equal(canonicalOccupation("junior accountant").level, "junior");
  assert.equal(canonicalOccupation("assistant restaurant manager").level, "assistant");
  assert.equal(id("senior cdp"), id("cdp"));
  // المدير والمشرف والأخصائي في المجال الواحد ثلاث مهن
  const hr = ["hr specialist", "hr supervisor", "hr manager"].map(id);
  assert.equal(new Set(hr).size, 3);
});

test("غير المصنّف جوابٌ صريح بسببه — لا تخمين: المسمّى العامّ، المتدرّب، الطالب، الفارغ", () => {
  const cases = [["manager", "generic"], ["supervisor", "generic"], ["مدير", "generic"], ["مشرف", "generic"], ["specialist", "generic"], ["assistant manager", "generic"], ["موظف", "generic"],
    ["trainee", "trainee"], ["intern", "trainee"], ["bar trainee", "trainee"], ["تدريب في الحلويات", "trainee"], ["متدربة", "trainee"], ["marketing department intern", "trainee"],
    ["student", "nojob"], ["طالب", "nojob"], ["fresh graduate", "nojob"], ["غير محدد", "nojob"], ["", "empty"], ["   ", "empty"]];
  for (const [t, via] of cases) {
    const r = canonicalOccupation(t);
    assert.equal(r.id, UNCLASSIFIED.id, t);
    assert.equal(r.via, via, t);
    assert.equal(r.confidence, "low");
  }
  // المتدرّب: لا مهنة من العنوان، لكن يُعاد تلميحٌ بما تدرّب عليه ليُحسم من نصّ السيرة لا من العنوان
  const t = canonicalOccupation("trainee lawyer");
  assert.equal(t.id, "unclassified"); assert.equal(t.level, "trainee"); assert.equal(t.hintId, "law.lawyer");
  // «student affairs officer» مهنةٌ حقيقية لا طالب
  assert.equal(canonicalOccupation("student affairs officer").id, "edu.student-affairs");
});

test("«training specialist» مهنةٌ و«training» وحدها تدريب", () => {
  assert.equal(canonicalOccupation("training specialist").id, "hr.trainer");
  assert.equal(canonicalOccupation("training manager").id, "hr.training-manager");
  assert.equal(canonicalOccupation("training").via, "trainee");
});

test("الثقة: عالية للمطابقة التامة، وتنزل للمُصحَّح إملائياً، ومنخفضة للمبهم التخصّص", () => {
  assert.equal(canonicalOccupation("chef de partie").confidence, "high");
  assert.equal(canonicalOccupation("accountent").confidence, "medium");
  assert.equal(canonicalOccupation("chef").confidence, "low");       // بلا رتبة
  assert.equal(canonicalOccupation("engineer").confidence, "low");   // بلا تخصّص
  assert.ok(["high", "medium", "low"].every((c) => CONFIDENCE_AR[c]));
});

test("الحقل `field` لا يخمّن مهنةً، ويحسم المتجانس فقط: «مدير حسابات»", () => {
  assert.equal(canonicalOccupation("manager", { field: "ضيافة ومطاعم" }).id, "unclassified");
  assert.equal(canonicalOccupation("manager", { field: "ضيافة ومطاعم" }).sector, "ضيافة ومطاعم");
  assert.equal(canonicalOccupation("مدير حسابات").id, "fin.finance-manager");
  assert.equal(canonicalOccupation("مدير حسابات", { field: "مبيعات وتسويق" }).id, "sales.account-manager");
});

test("حتمية وصفاء: المدخل نفسه ⇒ المخرج نفسه، والمدخلات الغريبة لا تُسقط", () => {
  for (const [t] of CASES.slice(0, 40)) assert.deepEqual(canonicalOccupation(t), canonicalOccupation(t));
  for (const x of [null, undefined, 0, 12345, {}, [], "   ", "---", "()", "؟؟؟", "x".repeat(5000), "مدير ".repeat(500)]) {
    const r = canonicalOccupation(x);
    assert.ok(r && typeof r.id === "string" && typeof r.confidence === "string");
  }
  // لا يغيّر خيارات المستدعي
  const opts = Object.freeze({ field: "هندسة" });
  assert.doesNotThrow(() => canonicalOccupation("engineer", opts));
});

test("سلامة القائمة المرجعية: معرّفاتٌ فريدة، أسماءٌ ثنائية اللغة، قطاعاتٌ من «Field»، لا تضارب عبارات", () => {
  assert.deepEqual(OCC_CONFLICTS, [], "عبارةٌ واحدة تعود لمهنتين");
  const ids = OCCUPATIONS.map((o) => o.id);
  assert.equal(new Set(ids).size, ids.length, "معرّفٌ مكرّر");
  assert.ok(OCCUPATIONS.length >= 250 && OCCUPATIONS.length <= 600, `حجم القائمة ${OCCUPATIONS.length} (مئات لا آلاف)`);
  const opts = new Set();
  for (const o of OCCUPATIONS) {
    assert.match(o.id, /^[a-z0-9-]+\.[a-z0-9-]+$/, o.id);
    assert.ok(o.nameAr && /[؀-ۿ]/.test(o.nameAr), `${o.id}: الاسم العربي`);
    assert.ok(o.nameEn && /[A-Za-z]/.test(o.nameEn), `${o.id}: الاسم الإنجليزي`);
    assert.ok(SECTORS.includes(o.sector), `${o.id}: قطاعٌ خارج Field: ${o.sector}`);
    const opt = occupationOptionName(o.id);
    assert.ok(opt.length <= 100 && !opt.includes(","), `${o.id}: اسم الخيار «${opt}» (Notion يمنع الفاصلة ويحدّ بمئة حرف)`);
    assert.match(opt, /^[A-Za-z0-9 &\/()+\-.|\u0600-\u06FF]+$/, `${o.id}: «${opt}» فيه حرفٌ قد يكسر جملة DDL (فاصلة/علامة اقتباس/نقطتان)`);
    assert.ok(!opts.has(opt), `اسم خيارٍ مكرّر ${opt}`); opts.add(opt);
    assert.deepEqual(occupationById(o.id).nameEn, o.nameEn);
  }
  assert.equal(occupationOptionName("nope"), "غير مصنّف | Unclassified");
});

test("titleKey = lower(trim) كما يفعله SQLite في Notion (ASCII وحده)", () => {
  assert.equal(titleKey("  Chef De Partie "), "chef de partie");
  assert.equal(titleKey("\tX"), "\tx");               // trim() في SQLite يقصّ المسافات وحدها
  assert.equal(titleKey("É"), "É");                    // lower() في SQLite لا يلمس غير ASCII
  assert.equal(titleKey("مدير مطعم"), "مدير مطعم");
});

test("الخريطة المحفوظة (api/_occupation-map.json) = ناتج المصنِّف الآن، وتغطّي ≥٩٠٪ من الصفوف", () => {
  const j = JSON.parse(fs.readFileSync(new URL("../api/_occupation-map.json", import.meta.url), "utf8"));
  assert.equal(j.version, OCC_VERSION, "عدّلتَ المصنِّف ولم تُعد توليد الخريطة (غيّر OCC_VERSION وأعد التوليد)");
  const C = { high: "h", medium: "m", low: "l" };
  let rows = 0, covered = 0, stale = [];
  for (const [title, [id, conf, via, n]] of Object.entries(j.map)) {
    const r = canonicalOccupation(title);
    if (r.id !== id || (r.id !== "unclassified" && C[r.confidence] !== conf) || r.via !== via) stale.push(`${title} → ${r.id}/${r.via} (الخريطة ${id}/${via})`);
    rows += n; if (id !== "unclassified") covered += n;
  }
  assert.deepEqual(stale.slice(0, 10), [], `${stale.length} مسمّىً تغيّر ناتجه`);
  assert.equal(Object.keys(j.map).length, j.titles);
  assert.ok(covered / rows >= 0.9, `التغطية ${(covered / rows * 100).toFixed(1)}٪ من ${rows} صفاً`);
  // كل مهنةٍ في الخريطة معرَّفة، وكل خيارٍ مذكورٌ هو اسم الخيار الحالي
  for (const [id, o] of Object.entries(j.occupations)) assert.equal(o.option, occupationOptionName(id));
  // الخريطة لا تحوي بريداً ولا جوّالاً (مفاتيحها مسمّيات)
  assert.ok(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(Object.keys(j.map).join("\n")), "بريدٌ داخل مسمّى");
});

test("للبحث: ما يكتبه صاحب العمل يُطابَق على مهنةٍ دقيقة، و«chef» تفتح مهن الطهي وحدها", () => {
  const ids = (q, n = 20) => searchOccupations(q, { limit: n }).map((o) => o.id);
  assert.equal(ids("CDP")[0], "hosp.chef-de-partie");
  assert.equal(ids("شيف قسم")[0], "hosp.chef-de-partie");
  assert.equal(ids("مدير مطعم")[0], "hosp.restaurant-manager");
  assert.ok(ids("مدير مطعم").length <= 3, "«مدير مطعم» اتّسعت لمهنٍ لا تخصّها");
  const chef = ids("chef", 50);
  for (const id of ["hosp.executive-chef", "hosp.sous-chef", "hosp.chef-de-partie", "hosp.commis-chef", "hosp.pastry-chef", "hosp.head-chef"]) assert.ok(chef.includes(id), id);
  assert.ok(!chef.includes("fin.accountant") && !chef.includes("eng.civil-engineer"));
  assert.deepEqual(searchOccupations(""), []);
  assert.deepEqual(searchOccupations("supervisor"), [], "مرتبةٌ بلا مجال ليست مهنة");
  assert.deepEqual(searchOccupations("zzzzqq"), []);
  assert.ok(searchOccupations("accountant", { limit: 3 }).length <= 3);
  // حتمي
  assert.deepEqual(searchOccupations("chef"), searchOccupations("chef"));
});

test("السلالم المهنية: المرتبة المجاورة لما يماثل المهنة", () => {
  const l = occupationLadder("hosp.chef-de-partie");
  assert.equal(l.below, "hosp.demi-chef-de-partie");
  assert.equal(l.above, "hosp.sous-chef");
  assert.equal(occupationLadder("hosp.waiter").above, "hosp.captain");
  assert.equal(occupationLadder("hosp.executive-chef").above, null);
  assert.equal(occupationLadder("fin.accountant").above, "fin.accounting-supervisor");
  assert.equal(occupationLadder("sales.sales-executive"), null);
  // كل معرّفٍ في السلالم موجودٌ في القائمة
  for (const id of ["hosp.cook", "hosp.head-chef", "hosp.food-runner", "fin.cfo", "hosp.bar-manager"]) assert.ok(occupationLadder(id).steps.every((x) => occupationById(x)), id);
});
