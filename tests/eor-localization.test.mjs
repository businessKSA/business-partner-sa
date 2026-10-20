// مستشار التوطين (الشريحة ب، أمر المالك 2026-10-08): تنبيه معلوماتي بنسبة توطين المهنة وتاريخ سريانها من api/_saudi-labor-data.json، لا يمنع الطلب
// (localization.mode = advise الافتراضي) إلا بالمفتاح block للمهن المقصورة على السعوديين. api/_eor-localization.js + api/_eor.js + صفحة /eor.
// النسب والتواريخ تُقرأ من الملف نفسه في الاختبار (لا أرقام نظامية مكتوبة هنا إلا مثالَي المالك: التسويق 60% والمساندة 100%)؛ والنصوص حذرة
// وتحتاج مراجعة قانونية (انظر رأس api/_eor-localization.js).
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.APP_ENV = "development";
process.env.LOCAL_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "eor-loc-"));

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
const LZ = await import("../api/_eor-localization.js");
const E = await import("../api/_eor.js");
const F = await import("../api/_eor-form.js");
const { bootPage } = await import("./eor-fake-dom.mjs");
const { stripCat, cfgFromHtml } = await import("./eor-test-util.mjs");
const { eorCore, buildSimpleEor } = await import("../site/scripts/simple-v1-eor.mjs");
const { simpleV1 } = await import("../site/scripts/simple-v1.mjs");

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRICING = JSON.parse(fs.readFileSync(path.join(ROOT, "api/_eor-pricing.json"), "utf8"));
const RAW = JSON.parse(fs.readFileSync(path.join(ROOT, "api/_saudi-labor-data.json"), "utf8"));
const CAT = JSON.parse(fs.readFileSync(path.join(ROOT, "api/_eor-catalogs.json"), "utf8"));
const NOW = Date.parse("2026-10-09T09:00:00Z");
const TODAY = "2026-10-09";
const clone = (o) => JSON.parse(JSON.stringify(o));
const LOOK = F.localizationLookup;
const notice = (id, ref = TODAY, raw = RAW, extra = {}) => LZ.localizationNotices([{ occupationId: id, ...extra }], { refDate: ref, raw, lookup: LOOK })[0].notice;
const DEC = Object.fromEntries(RAW.localization.profession_decisions.map((d) => [d.id, d]));
const norm = (s) => F.normText(s);

/* ═════════════ الجدول: سلامته أمام الفهرس والملف ═════════════ */
test("جدول التطابق: كل معرّف موجود في الفهرس، وكل رمز مساندة موجود في الملف، واسم المطابقة التامة (exact) يحتوي اسم مهنة مذكورة في القرار", () => {
  const byId = new Map(CAT.occupations.map((o) => [o.id, o]));
  const names = (cat) => {
    const d = DEC[cat];
    const lists = [];
    if (Array.isArray(d.professions)) lists.push(d.professions);
    if (d.professions_groups) lists.push(...Object.values(d.professions_groups));
    return lists.flat().map((p) => norm(p.name_ar)).filter(Boolean);
  };
  const scoCodes = new Map();
  for (const arr of Object.values(DEC.admin_support.professions_groups)) for (const p of arr) scoCodes.set(p.sco_code, p.name_ar);
  for (const [cat, list] of Object.entries(LZ.LOCALIZATION_MAP)) {
    assert.ok(DEC[cat], "القرار في الملف: " + cat);
    assert.ok(LZ.LOCALIZATION_CATEGORIES.includes(cat));
    const ids = new Set();
    for (const e of list) {
      assert.ok(byId.has(e.id), `${cat}: ${e.id} غير موجود في الفهرس`);
      assert.equal(ids.has(e.id), false, "تكرار " + e.id);
      ids.add(e.id);
      assert.ok(e.kind === "exact" || e.kind === "close");
      if (cat === "admin_support") assert.ok(scoCodes.has(e.sco), `${e.id}: رمز ${e.sco} غير موجود في مجموعات المساندة`);
      if (e.kind === "exact" && Array.isArray(DEC[cat].professions) || (e.kind === "exact" && cat === "admin_support")) {
        const ar = norm(byId.get(e.id).ar);
        assert.ok(names(cat).some((n) => ar.includes(n)), `${cat}: «${byId.get(e.id).ar}» لا يطابق مهنة مذكورة في القرار`);
      }
    }
  }
  assert.ok(LZ.LOCALIZATION_CATEGORIES.every((c) => c in LZ.LOCALIZATION_MAP || c === "engineering"));
});

test("الحد الأدنى لعدد العاملين (MIN_WORKERS) يطابق نص applies_when في الملف", () => {
  const WORDS = { ثلاثة: 3, خمسة: 5 };
  // العدد الذي يسبق كلمة «عاملين» («3 عاملين» · «خمسة عاملين») أو «عامل واحد».
  const first = (t) => { const m = t.match(/(\d+|ثلاثة|خمسة)\s*عاملين/); if (m) return WORDS[m[1]] || Number(m[1]); return /عامل واحد/.test(t) ? 1 : null; };
  for (const [cat, n] of Object.entries(LZ.MIN_WORKERS)) assert.equal(first(DEC[cat].applies_when), n, cat);
  assert.deepEqual(Object.keys(LZ.MIN_WORKERS).sort(), [...LZ.LOCALIZATION_CATEGORIES].sort());
});

test("الهندسة: بالمجموعة الدولية للمهنة بشرط eng.* واسم يبدأ بـ«مهندس»، لا الاتصالات ولا «آخرون» ولا المخططون", () => {
  const hit = CAT.occupations.filter((o) => notice(o.id) && notice(o.id).category === "engineering");
  assert.ok(hit.length >= 30, "عدد المهن الهندسية المطابقة: " + hit.length);
  for (const o of hit) { assert.ok(o.id.startsWith("eng.")); assert.ok(o.ar.startsWith("مهندس")); assert.ok(["2141", "2142", "2143", "2144", "2145", "2146", "2151", "2152", "2161", "2162"].includes(o.group)); }
  for (const id of ["eng.civil-engineer", "eng.electrical-engineer", "eng.architect", "eng.quality-engineer", "eng.mechanical-engineer"]) assert.equal(notice(id).category, "engineering", id);
  for (const id of ["it.embedded-systems-engineer", "tel.telecom-engineer", "eng.quantity-surveyor", "eng.maintenance-planner", "eng.civil-technician", "eng.project-engineer", "it.software-developer"]) assert.equal(notice(id), null, id);
  const e = notice("eng.civil-engineer");
  assert.deepEqual([e.percent, e.from, e.minWorkers, e.close, e.upcoming], [DEC.engineering.percent, "2026-06-30", 5, true, false]);
});

/* ═════════════ المطابقة: الفئات بنسبها وتواريخها ═════════════ */
test("التسويق 60% (مثال المالك) من تاريخ 2026-04-19 بعدد أدنى 3، والمطابقة التامة غير التقريبية", () => {
  const n = notice("mkt.marketing-manager");
  assert.deepEqual(n, { category: "marketing", percent: 60, from: "2026-04-19", upcoming: false, saudiOnly: false, close: false, verify: false, minWorkers: 3 });
  assert.equal(n.percent, DEC.marketing.percent, "من الملف");
  assert.equal(notice("mkt.advertising-manager").close, true);
  // قبل السريان ⇒ لم يبدأ بعد
  const early = notice("mkt.marketing-specialist", "2026-03-01");
  assert.deepEqual([early.percent, early.upcoming, early.from], [60, true, "2026-04-19"]);
});

test("المهن الإدارية المساندة 100% (مقصورة على السعوديين): التاريخ من مجموعة رمزها في الملف، والأعلى يغلب (العلاقات العامة 60% ثم 100%)", () => {
  const sec = notice("adm.secretary");
  assert.deepEqual([sec.category, sec.percent, sec.saudiOnly, sec.from, sec.upcoming, sec.minWorkers, sec.close], ["admin_support", 100, true, "2026-04-05", false, 1, false]);
  const rec = notice("adm.receptionist");
  assert.deepEqual([rec.saudiOnly, rec.from, rec.upcoming], [true, "2026-10-04", false], "مجموعة الـ50 مهنة");
  const before = notice("adm.receptionist", "2026-09-20");
  assert.deepEqual([before.saudiOnly, before.upcoming], [true, true], "قبل 2026-10-04 لم يبدأ");
  // العلاقات العامة في التسويق (60%) وفي المساندة (100%) ⇒ 100%
  const pr = notice("mkt.pr-specialist");
  assert.deepEqual([pr.category, pr.percent, pr.saudiOnly], ["admin_support", 100, true]);
  assert.equal(notice("mkt.pr-manager").saudiOnly, true);
  // الموارد البشرية والحراسة والترجمة والاستقبال ضمنها
  for (const id of ["hr.recruiter", "hr.compensation-benefits-specialist", "sec.security-guard", "adm.translator", "adm.data-entry-clerk", "hosp.front-desk-agent", "ret.cashier"]) assert.equal(notice(id).saudiOnly, true, id);
  for (const id of ["hr.hr-manager", "hr.hr-specialist", "hr.istiqdam-officer", "adm.executive-assistant"]) { const x = notice(id); assert.deepEqual([x.saudiOnly, x.close], [true, true], id); }
});

test("المحاسبة بمراحلها: 40% الآن ثم 50% من 2026-10-27 ثم 60% ثم 70%، ومرحلة المنشآت الصغيرة (30%) لا تحلّ محلها", () => {
  const at = (ref) => { const n = notice("fin.accountant", ref); return [n.percent, n.from, n.upcoming, n.next ? [n.next.percent, n.next.from] : null]; };
  assert.deepEqual(at("2026-10-09"), [40, "2025-10-27", false, [50, "2026-10-27"]]);
  assert.deepEqual(at("2026-10-27"), [50, "2026-10-27", false, [60, "2027-10-27"]]);
  assert.deepEqual(at("2027-10-27"), [60, "2027-10-27", false, [70, "2028-10-27"]]);
  assert.deepEqual(at("2028-10-27"), [70, "2028-10-27", false, null]);
  assert.deepEqual(at("2030-01-01"), [70, "2028-10-27", false, null], "30% للمنشآت الصغيرة لا تنزل بالنسبة");
  assert.deepEqual(at("2025-06-01").slice(0, 3), [40, "2025-10-27", true]);
  assert.equal(notice("fin.accountant").minWorkers, 5);
  assert.equal(notice("fin.cost-accountant").close, false);
  assert.equal(notice("fin.chief-accountant").close, true);
});

test("المشتريات (verify) وإدارة المشاريع (لم تبدأ) والصيدلة (مدى بحسب المنشأة) والأسنان (مرحلتان)", () => {
  const pr = notice("scm.procurement-manager");
  assert.deepEqual([pr.category, pr.percent, pr.from, pr.verify], ["procurement", 70, "2026-05-31", true], "المشتريات verify:true في الملف");
  const pm = notice("pm.project-manager");
  assert.deepEqual([pm.category, pm.percent, pm.from, pm.upcoming, pm.close], ["project_management", 70, "2027-02-14", true, true]);
  assert.equal(notice("pm.project-manager", "2027-03-01").upcoming, false);
  const ph = notice("health.pharmacist");
  assert.deepEqual([ph.percent, ph.percentMax, ph.from, ph.saudiOnly, ph.verify], [35, 65, "2025-07-27", false, true]);
  assert.deepEqual([notice("health.dentist").percent, notice("health.dentist").from], [55, "2026-01-27"]);
  assert.equal(notice("health.dentist", "2025-09-01").percent, 45);
  assert.equal(notice("health.dentist", "2025-01-01").upcoming, true);
});

test("مهنة غير مخضعة بلا تنبيه، والتقنية غير مطبَّقة، وما لا تطابق له لا يُطبَّق (مدير عام التسويق، منسق التسويق، المدير المالي التنفيذي)", () => {
  for (const id of ["hosp.cook", "hosp.waiter", "it.software-developer", "it.devops-engineer", "mgmt.ceo", "fin.cfo", "mkt.marketing-director", "mkt.marketing-coordinator", "mkt.digital-marketing-specialist", "sales.sales-director", "hr.hr-director", "health.dental-assistant", "nope.nothing", "", undefined, null, 42]) {
    assert.equal(notice(id), null, String(id));
  }
  assert.deepEqual(LZ.localizationNotices([null, "x", { occupationId: "mkt.marketing-manager" }], { refDate: TODAY, lookup: LOOK }).map((x) => !!x.notice), [false, false, true]);
  assert.equal(LZ.localizationNotices([{ occupationId: "mkt.marketing-manager" }], { refDate: "bad", lookup: LOOK })[0].notice, null);
  assert.equal(LZ.localizationNotices([{ occupationId: "mkt.marketing-manager" }], { refDate: TODAY, lookup: LOOK, raw: null })[0].notice, null, "الملف غائب");
});

test("المعرّف القديم: يُطابق عبر مقابله في الفهرس بشرط اتفاق كل المقابلات، وإلا لا تنبيه", () => {
  const old = (id) => LZ.localizationNotices([{ occupationId: id }], { refDate: TODAY, lookup: LOOK })[0].notice;
  const cats = (oldId) => LOOK.catalogIdsForOld(oldId);
  assert.deepEqual(cats("marketing.manager"), ["mkt.marketing-manager"]);
  assert.equal(old("marketing.manager").percent, 60);
  // المعرّف القديم الذي يقابل مهناً مختلفة النتيجة (أخصائي تسويق + منسق + محلل) ⇒ لا تنبيه، ومعه المعرّف الدقيق ⇒ تنبيه
  assert.ok(cats("marketing.specialist").length > 1);
  assert.equal(old("marketing.specialist"), null);
  assert.equal(LZ.localizationNotices([{ occupationId: "marketing.specialist", occupationCatalogId: "mkt.marketing-specialist" }], { refDate: TODAY, lookup: LOOK })[0].notice.percent, 60);
});

test("البيانات من الملف: تغيير النسبة أو حذف القرار أو تغيير نسبة المساندة يغيّر التنبيه (لا نسبة في الكود)", () => {
  const a = clone(RAW); a.localization.profession_decisions.find((d) => d.id === "marketing").percent = 75;
  assert.equal(notice("mkt.marketing-manager", TODAY, a).percent, 75);
  const b = clone(RAW); b.localization.profession_decisions = b.localization.profession_decisions.filter((d) => d.id !== "marketing");
  assert.equal(notice("mkt.marketing-manager", TODAY, b), null);
  const c = clone(RAW); c.localization.profession_decisions.find((d) => d.id === "admin_support").percent = 50;
  assert.equal(notice("adm.secretary", TODAY, c), null, "الملف لا يقول 100 ⇒ لا نفترض القصر");
  const d = clone(RAW); d.localization.profession_decisions.find((x) => x.id === "marketing").verify = true;
  assert.equal(notice("mkt.marketing-manager", TODAY, d).verify, true);
  const src = fs.readFileSync(path.join(ROOT, "api/_eor-localization.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const lit of ["101319", "132249", "2026-04-19", "2026-10-04", "5500", "hrsd.gov"]) assert.equal(src.includes(lit), false, lit);
});

test("ما يخرج للعميل: الفئة والنسبة والتاريخ والعدد الأدنى فقط — لا رقم قرار ولا رابط ولا حدّ أجر ولا مسار حساب", () => {
  const ALLOWED = new Set(["category", "percent", "percentMax", "from", "upcoming", "saudiOnly", "close", "verify", "minWorkers", "next"]);
  for (const o of CAT.occupations) {
    const n = notice(o.id);
    if (!n) continue;
    for (const k of Object.keys(n)) assert.ok(ALLOWED.has(k), `${o.id}: حقل غير مسموح ${k}`);
  }
  const j = JSON.stringify(CAT.occupations.map((o) => notice(o.id)));
  assert.equal(/101319|132249|103108|77050|93483|41454|103111|103107|hrsd|http|sco_code|5500|8000|6000|4500|formula|required_saudis/.test(j), false);
});

/* ═════════════ الإجراء والوضعان ═════════════ */
const good = (over = {}) => ({
  company: "شركة الأمل", contactName: "سارة", email: "sara@example.com", phone: "0501234567", city: "الرياض",
  workerType: "foreign", recruitment: "no", items: [{ occupationId: "adm.secretary", count: 1, nationalities: ["IN"], salary: 3000 }],
  startDate: "2026-11-01", durationMonths: 12, lang: "ar", ...over,
});
const withMode = (mode) => { const p = clone(PRICING); if (mode === undefined) delete p.localization; else p.localization = { mode }; return p; };
const v = (b, pricing, now = NOW) => E.validateEorRequest(b, { now, pricing });
const ask = (items, extra = {}, pricing = PRICING) => E.handleEor({ action: "localization", items, ...extra }, { now: NOW, ip: "", pricing });

test("الإجراء localization: تنبيه لكل بند بتاريخ البدء مرجعاً، بلا كتابة ولا بريد، ويحمل mode", async () => {
  let wrote = 0;
  const ctx = { now: NOW, ip: "", pricing: PRICING, fetch: async () => { wrote++; return {}; }, sendEmail: async () => { wrote++; return {}; }, notify: async () => { wrote++; return {}; }, notionToken: "t" };
  const r = await E.handleEor({ action: "localization", workerType: "foreign", startDate: "2026-11-01", items: [{ occupationId: "mkt.marketing-manager", nationalities: ["IN"] }, { occupationId: "fin.accountant" }, { occupationId: "hosp.cook" }, { occupationId: "zzz" }, null] }, ctx);
  assert.equal(r.ok, true);
  assert.equal(r.mode, "advise");
  assert.equal(r.notices.length, 5);
  assert.deepEqual(r.notices.map((n) => n.category || null), ["marketing", "accounting", null, null, null]);
  assert.equal(r.notices[1].percent, 50, "تاريخ البدء 2026-11-01 بعد 2026-10-27");
  assert.deepEqual(r.notices[0].blocked, false);
  assert.equal(wrote, 0);
  const today = await ask([{ occupationId: "fin.accountant" }]);
  assert.equal(today.notices[0].percent, 40, "بلا تاريخ بدء ⇒ اليوم");
  const badDate = await ask([{ occupationId: "fin.accountant" }], { startDate: "2020-01-01" });
  assert.equal(badDate.notices[0].percent, 40, "تاريخ خارج النافذة يُهمَل");
  // الحدود والتنظيف
  const many = await ask(Array.from({ length: 50 }, () => ({ occupationId: "mkt.marketing-manager" })));
  assert.equal(many.notices.length, E.EOR_LIMITS.maxItems);
  assert.deepEqual((await ask("x")).notices, []);
  // المعرّف الدقيق للفهرس يُقبل (الصفحة ترسله)
  assert.equal((await ask([{ occupationId: "mkt.marketing-specialist" }])).notices[0].percent, 60);
  // ما يصل العميل لا يحمل مراجع
  assert.equal(/101319|hrsd|http|5500|sco_code/.test(JSON.stringify(await ask([{ occupationId: "mkt.marketing-manager" }, { occupationId: "adm.secretary" }]))), false);
});

test("advise (الافتراضي): لا يُمنع طلب ولو مقصورة على السعوديين؛ والغائب والفاسد = advise", async () => {
  assert.equal(LZ.localizationModeFrom(PRICING), "advise");
  for (const bad of [undefined, null, "", "BLOCK", "blocked", "convert", 1, {}]) assert.equal(LZ.localizationModeFrom(withMode(bad)), "advise", String(bad));
  assert.equal(LZ.localizationModeFrom(null), "advise");
  assert.equal(LZ.localizationModeFrom({}), "advise");
  for (const mode of [undefined, "advise", "convert"]) {
    const r = v(good(), withMode(mode));
    assert.equal(r.ok, true, String(mode));
  }
  const sp = await ask([{ occupationId: "adm.secretary", nationalities: ["IN"] }]);
  assert.deepEqual([sp.mode, sp.notices[0].saudiOnly, sp.notices[0].blocked], ["advise", true, false]);
});

test("block: يرفض المقصورة على السعوديين بجنسية غير سعودية أو مختلطة (occupation_saudi_only) ولا يمنع غيرها", async () => {
  const P = withMode("block");
  const rej = (items, over = {}) => { const r = v(good({ items, ...over }), P); return r.ok ? null : r; };
  const sec = (nationalities, over = {}) => [{ occupationId: "adm.secretary", count: 1, nationalities, salary: 4500, ...over }];
  const r1 = rej(sec(["IN"]));
  assert.deepEqual([r1.error, r1.status, r1.field, r1.index], ["occupation_saudi_only", 400, "items", 0]);
  assert.equal(rej(sec(["SA", "IN"])).error, "occupation_saudi_only", "مختلط");
  assert.equal(rej(sec([]), { workerType: "foreign" }).error, "occupation_saudi_only", "نوع الطلب أجانب بلا جنسية");
  assert.equal(rej(sec(["SA"]), { workerType: "saudi" }), null, "سعودي مسموح");
  assert.equal(rej(sec([]), { workerType: "saudi" }), null);
  assert.equal(rej(sec([]), { workerType: "both" }), null, "غير محسوم لا يُمنع");
  // مهنة ذات نسبة (لا 100%) لا تُمنع أبداً، ولا مهنة غير مخضعة
  assert.equal(rej([{ occupationId: "mkt.marketing-manager", count: 1, nationalities: ["IN"], salary: 3000 }]), null);
  assert.equal(rej([{ occupationId: "hosp.cook", count: 1, nationalities: ["IN"], salary: 2000 }]), null);
  // البند الثاني هو المقصور ⇒ الفهرس 1
  assert.equal(rej([{ occupationId: "hosp.cook", count: 1, nationalities: ["IN"], salary: 2000 }, ...sec(["PK"])]).index, 1);
  // القصر لم يبدأ بعد (قبل 2026-10-04 لموظف الاستقبال) ⇒ لا منع
  const early = Date.parse("2026-09-20T09:00:00Z");
  const rec = good({ items: [{ occupationId: "adm.receptionist", count: 1, nationalities: ["IN"], salary: 3000 }], startDate: "2026-09-25" });
  assert.equal(v(rec, P, early).ok, true, "لم يسرِ بعد");
  assert.equal(v({ ...rec, startDate: "2026-10-10" }, P, early).error, "occupation_saudi_only", "سرى بحلول تاريخ البدء");
  // الإجراء يُعلِّم blocked ليعرض منعاً
  const act = await E.handleEor({ action: "localization", workerType: "foreign", items: [{ occupationId: "adm.secretary", nationalities: ["IN"] }, { occupationId: "adm.secretary", nationalities: ["SA"] }, { occupationId: "mkt.marketing-manager", nationalities: ["IN"] }] }, { now: NOW, ip: "", pricing: P });
  assert.deepEqual([act.mode, ...act.notices.map((n) => n.blocked)], ["block", true, false, false]);
});

test("block عند الإرسال الكامل: 400 occupation_saudi_only بلا Notion ولا بريد ولا تنبيه؛ وadvise يقبل ويكتب", async () => {
  const run = async (pricing) => {
    const calls = { fetch: 0, mail: 0, notify: 0 };
    const ctx = { dev: false, notionToken: "secret_test", dbId: "db", now: NOW, ip: "", pricing, refGen: () => "EOR-111111",
      fetch: async () => { calls.fetch++; return { ok: true, status: 200, text: async () => "{}", json: async () => ({ id: "11111111-2222-3333-4444-555555555555" }) }; },
      sendEmail: async () => { calls.mail++; return { ok: true }; }, notify: async () => { calls.notify++; return { ok: true }; }, teamEmail: "t@x.co", ownerEmail: "o@x.co" };
    return { r: await E.handleEor(good(), ctx), calls };
  };
  const blocked = await run(withMode("block"));
  assert.deepEqual([blocked.r.ok, blocked.r.status, blocked.r.error], [false, 400, "occupation_saudi_only"]);
  assert.deepEqual(blocked.calls, { fetch: 0, mail: 0, notify: 0 });
  const advised = await run(withMode("advise"));
  assert.deepEqual(advised.r, { ok: true, ref: "EOR-111111" });
  assert.ok(advised.calls.fetch >= 1 && advised.calls.mail >= 1);
});

test("سجلّ الفريق: تنبيه التوطين في بريد الفريق ومتن Notion، وليس في بريد العميل ولا في مرجع المورّدين", async () => {
  const sent = { mail: [], fetch: [] };
  const ctx = { dev: false, notionToken: "secret_test", dbId: "db", now: NOW, ip: "", pricing: PRICING, refGen: () => "EOR-222222",
    fetch: async (u, init) => { sent.fetch.push(init.body); return { ok: true, status: 200, text: async () => "{}", json: async () => ({ id: "11111111-2222-3333-4444-555555555555" }) }; },
    sendEmail: async (to, subject, html) => { sent.mail.push({ to, html }); return { ok: true }; }, notify: async () => ({ ok: true }), teamEmail: "team@x.co", ownerEmail: "owner@x.co" };
  const r = await E.handleEor(good({ items: [{ occupationId: "mkt.marketing-manager", count: 2, nationalities: ["IN"], salary: 3000 }, { occupationId: "hosp.cook", count: 1, nationalities: ["IN"], salary: 2000 }] }), ctx);
  assert.equal(r.ok, true);
  const team = sent.mail.find((m) => m.to === "team@x.co").html;
  assert.match(team, /تنبيه التوطين/);
  assert.match(team, /بند 1: التسويق — 60% يسري 2026-04-19/);
  assert.equal(/بند 2/.test(team.slice(team.indexOf("تنبيه التوطين"))), false, "المهنة غير المخضعة بلا سطر");
  assert.match(sent.fetch.join("\n"), /localization/);
  assert.equal(/توطين|التسويق — 60/.test(sent.mail.find((m) => m.to === "sara@example.com").html), false, "بريد العميل بلا تنبيه");
  assert.equal(/101319|hrsd|http:\/\/www\.hrsd/.test(team + sent.fetch.join("")), false, "لا رقم قرار ولا رابط حتى في سجل الفريق");
  assert.equal(E.localizationTeamText([]), "");
  assert.match(E.localizationTeamText([{ item: 3, category: "admin_support", percent: 100, saudiOnly: true, upcoming: true, from: "2026-10-04", close: true, verify: false }]), /بند 3: المهن الإدارية المساندة — مقصورة على السعوديين يبدأ 2026-10-04 \(تطابق تقريبي\)/);
});

/* ═════════════ الصفحة: النصوص بالأربع لغات والتدفق ═════════════ */
const LANGS = ["ar", "en", "fr", "zh"];
const esc = (x) => String(x == null ? "" : x).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const render = (l) => {
  const head = (title) => `<!doctype html><html lang="${l}"><head><meta charset="utf-8"><title>${esc(title)}</title></head>`;
  const sv1 = simpleV1({ lang: () => l, esc, site: {}, head, pathInLang: (p, x) => (x === "en" ? p : "/" + x + p), assetV: (x) => x, knowledge: null });
  return buildSimpleEor(sv1, { lang: () => l, esc });
};
const HTML = Object.fromEntries(LANGS.map((l) => [l, render(l)]));
const CORE = eorCore();

test("نص التنبيه بالأربع لغات: الفئة والنسبة والتاريخ والعدد الأدنى و«يُراجَع»، بلا عربية في غير العربية ولا بقايا {}", () => {
  const cats = [...LZ.LOCALIZATION_CATEGORIES];
  for (const l of LANGS) {
    const tx = cfgFromHtml(HTML[l]).tx;
    for (const cat of cats) {
      const n = { category: cat, percent: 60, from: "2026-04-19", upcoming: false, saudiOnly: false, close: false, verify: false, minWorkers: 3 };
      const t = CORE.locMessage(n, tx);
      assert.ok(t.length > 30, `${l}/${cat}`);
      assert.match(t, /60/);
      assert.match(t, /2026-04-19/);
      assert.match(t, /3/);
      assert.equal(/[{}]/.test(t), false, `${l}/${cat}: بقايا قالب: ${t}`);
      if (l !== "ar") assert.equal(/[؀-ۿ]/.test(t), false, `${l}/${cat}: عربية في صفحة ${l}`);
    }
    const ok = { category: "marketing", percent: 60, from: "2026-04-19", upcoming: false, saudiOnly: false, close: false, verify: false, minWorkers: 3 };
    const base = CORE.locMessage(ok, tx);
    assert.notEqual(CORE.locMessage({ ...ok, close: true }, tx), base, l + ": المطابقة التقريبية بصياغة «قد»");
    assert.notEqual(CORE.locMessage({ ...ok, upcoming: true }, tx), base, l + ": لم يبدأ بعد");
    assert.ok(CORE.locMessage({ ...ok, next: { percent: 70, from: "2028-10-27" } }, tx).includes("2028-10-27"));
    const range = CORE.locMessage({ category: "pharmacy", percent: 35, percentMax: 65, from: "2025-07-27", upcoming: false, saudiOnly: false, close: false, verify: true, minWorkers: 5 }, tx);
    assert.ok(range.includes("35") && range.includes("65"), l);
    const only = CORE.locMessage({ category: "admin_support", percent: 100, from: "2026-04-05", upcoming: false, saudiOnly: true, close: false, verify: false, minWorkers: 1 }, tx);
    assert.ok(only.includes("2026-04-05") && only.length > 40, l);
    assert.notEqual(only, base);
    const blockedTxt = CORE.locMessage({ category: "admin_support", percent: 100, from: "2026-04-05", upcoming: false, saudiOnly: true, blocked: true, close: false, verify: false, minWorkers: 1 }, tx);
    assert.ok(blockedTxt.length > only.length, l + ": المنع يضيف جملة");
    if (l === "ar") { assert.match(base, /خاضعة لقرار توطين بنسبة 60%/); assert.match(base, /قد يلزمك توظيف سعودي/); assert.match(base, /يُراجَع للتأكد/); assert.match(only, /مقصورة على السعوديين/); }
    // مدخل فاسد ⇒ نص فارغ لا استثناء
    for (const bad of [null, {}, { category: "x", percent: 1, from: "2026-01-01" }, { category: "marketing", percent: "60", from: "2026-01-01" }, "str"]) assert.equal(CORE.locMessage(bad, tx), "");
  }
  // لا نص منها فتوى: لا «يجب» ولا «ممنوع» ولا وعد
  for (const cat of cats) assert.equal(/يجب عليك|ممنوع|مخالفة|غرامة|ضمان|نضمن/.test(CORE.locMessage({ category: cat, percent: 60, from: "2026-04-19", upcoming: false, saudiOnly: false, close: false, minWorkers: 3 }, cfgFromHtml(HTML.ar).tx)), false);
});

const cardOf = (dom, i = 0) => dom.$("eorItems").children[i];
const partsOf = (dom, card) => {
  const inputs = dom.find(card, (e) => e.tagName === "INPUT");
  const numbers = inputs.filter((e) => e.type === "number");
  return {
    occ: inputs.find((e) => e.getAttribute("role") === "combobox" && !e._cls.includes("sv1-eor-chipin")), nat: dom.byClass(card, "sv1-eor-chipin")[0],
    count: numbers[0], sal: numbers[1], date: inputs.find((e) => e.type === "date"), loc: dom.byClass(card, "sv1-eor-loc")[0], price: dom.byClass(card, "sv1-eor-price")[0],
  };
};
const boot = (l = "ar", pricing = PRICING) => {
  const submitted = [];
  const server = async (b) => { if (b && Array.isArray(b.items) && !b.action) submitted.push(b); return E.handleEor(b, { ip: "", now: NOW, dev: true, pricing }); };
  const dom = bootPage(HTML[l], { server });
  dom.submitted = submitted;
  return dom;
};
const addNat = (dom, p, q) => { dom.type(p.nat, q); dom.key(p.nat, "Enter"); };
const pickOcc = (dom, p, q) => { dom.type(p.occ, q); dom.key(p.occ, "Enter"); };
const fillBasics = (dom) => { dom.$("eorCompany").value = "شركة الأمل"; dom.$("eorContact").value = "سارة"; dom.$("eorEmail").value = "sara@example.com"; dom.$("eorPhone").value = "0501234567"; dom.$("eorCity").value = "الرياض"; };
const pill = (dom, id) => dom.find(dom.$("eorDurPresets"), (e) => e.tagName === "INPUT").find((e) => e.value === id);

test("الصفحة: اختيار المهنة يُظهر التنبيه من الخادم (المسوّق 60%)، والمهنة غير المخضعة بلا تنبيه، والتبديل يمسحه", async () => {
  const dom = boot("ar"); await dom.flush();
  const p = partsOf(dom, cardOf(dom));
  assert.ok(p.loc._cls.includes("sv1-hide"), "مخفي قبل الاختيار");
  pickOcc(dom, p, "مدير تسويق"); await dom.flush();
  assert.equal(dom.calls.filter((c) => c.body.action === "localization").length, 1);
  assert.ok(!p.loc._cls.includes("sv1-hide"));
  assert.match(p.loc.textContent, /مهن التسويق/);
  assert.match(p.loc.textContent, /60%/);
  assert.match(p.loc.textContent, /2026-04-19/);
  assert.match(p.loc.textContent, /يُراجَع للتأكد/);
  assert.ok(!p.loc._cls.includes("fix"), "نسبة لا قصر ⇒ لا تحذير");
  // تغيير المهنة يمسح التنبيه فوراً ثم يعيده
  p.occ.value = "طباخ"; p.occ.fire("input");
  assert.ok(p.loc._cls.includes("sv1-hide"));
  pickOcc(dom, p, "طباخ"); await dom.flush();
  assert.ok(p.loc._cls.includes("sv1-hide"), "طباخ غير مخضع");
  // المقصورة على السعوديين بتحذير
  pickOcc(dom, p, "موظف استقبال"); await dom.flush();
  assert.ok(p.loc._cls.includes("fix"));
  assert.match(p.loc.textContent, /مقصورة على السعوديين/);
  assert.equal(/لا يمكن إرسال/.test(p.loc.textContent), false, "advise: بلا منع");
});

test("الصفحة: تاريخ البدء يغيّر مرجع النسبة (المحاسبة 40% ثم 50%) ويُرسَل للخادم", async () => {
  const dom = boot("ar"); await dom.flush();
  const p = partsOf(dom, cardOf(dom));
  pickOcc(dom, p, "محاسب"); await dom.flush();
  assert.match(p.loc.textContent, /40%/);
  assert.match(p.loc.textContent, /وتزداد إلى 50% من 2026-10-27/);
  dom.$("eorStart").value = "2026-11-15"; dom.$("eorStart").fire("change"); await dom.flush();
  assert.match(p.loc.textContent, /50%/);
  const last = dom.calls.filter((c) => c.body.action === "localization").at(-1).body;
  assert.equal(last.startDate, "2026-11-15");
  assert.deepEqual(last.items, [{ occupationId: last.items[0].occupationId, nationalities: [] }]);
});

test("الصفحة: وضع block يعرض منعاً ويرفض الإرسال برسالة، وadvise يرسل", async () => {
  const sendIt = async (pricing) => {
    const dom = boot("ar", pricing); await dom.flush();
    fillBasics(dom);
    const p = partsOf(dom, cardOf(dom));
    pickOcc(dom, p, "سكرتير"); p.count.value = "1"; addNat(dom, p, "الهند"); p.sal.value = "3000"; await dom.flush();
    dom.pick(dom.$("eorRC2")); dom.pick(pill(dom, "m6"));
    dom.$("eorForm").fire("submit"); await dom.flush();
    return { dom, p };
  };
  const b = await sendIt(withMode("block"));
  assert.match(b.p.loc.textContent, /لا يمكن إرسال هذا الطلب بجنسية غير سعودية/);
  assert.equal(b.dom.submitted.length, 1, "الخادم هو من يمنع");
  assert.match(b.dom.$("eorMsg").textContent, /هذه المهنة مقصورة على السعوديين حالياً/);
  assert.ok(b.dom.$("eorMsg")._cls.includes("err"));
  const a = await sendIt(withMode("advise"));
  assert.equal(a.dom.submitted.length, 1);
  assert.equal(a.dom.$("eorDone")._cls.includes("sv1-hide"), false, "advise ⇒ تمّ الإرسال");
  // سعودي في block ⇒ يمرّ
  const dom = boot("ar", withMode("block")); await dom.flush();
  fillBasics(dom);
  const p = partsOf(dom, cardOf(dom));
  pickOcc(dom, p, "سكرتير"); p.count.value = "1"; addNat(dom, p, "السعودية"); p.sal.value = "4500"; await dom.flush();
  assert.equal(/لا يمكن إرسال/.test(p.loc.textContent), false);
  dom.pick(dom.$("eorRC2")); dom.pick(pill(dom, "m6"));
  dom.$("eorForm").fire("submit"); await dom.flush();
  assert.equal(dom.$("eorDone")._cls.includes("sv1-hide"), false);
});

test("الصفحة: حقل تاريخ أول اشتراك للسعودي وحده، ويُرسَل مع السعر ومع الطلب، والفاسد يُرفض في الصفحة", async () => {
  const dom = boot("ar"); await dom.flush();
  fillBasics(dom);
  const p = partsOf(dom, cardOf(dom));
  const wrap = p.date.parentNode;
  assert.ok(wrap._cls.includes("sv1-hide"), "مخفي بلا جنسية سعودية");
  addNat(dom, p, "الهند");
  assert.ok(wrap._cls.includes("sv1-hide"), "غير سعودي");
  const x = dom.byClass(cardOf(dom), "sv1-eor-chipx")[0]; dom.click(x);
  addNat(dom, p, "السعودية");
  assert.equal(wrap._cls.includes("sv1-hide"), false, "سعودي");
  pickOcc(dom, p, "طباخ"); p.count.value = "1"; p.sal.value = "6000";
  dom.$("eorStart").value = "2026-11-01";
  p.date.value = "2019-03-01"; p.date.fire("change"); await dom.flush();
  const priceCall = dom.calls.filter((c) => c.body.action === "price").at(-1).body;
  assert.equal(priceCall.startDate, "2026-11-01");
  assert.equal(priceCall.items[0].firstSubscriptionDate, "2019-03-01");
  assert.ok(!p.price._cls.includes("sv1-hide"), "السعودي يُسعَّر الآن");
  assert.match(p.price.textContent, /التأمينات الاجتماعية/);
  assert.equal(/رخصة العمل/.test(p.price.textContent), false, "السعودي بلا رسوم حكومية");
  dom.pick(dom.$("eorRC2")); dom.pick(pill(dom, "m6"));
  dom.$("eorForm").fire("submit"); await dom.flush();
  assert.equal(dom.submitted[0].items[0].firstSubscriptionDate, "2019-03-01");
  // تاريخ مستقبلي (فوق max) ⇒ رسالة ولا إرسال
  const dom2 = boot("ar"); await dom2.flush();
  fillBasics(dom2);
  const q = partsOf(dom2, cardOf(dom2));
  addNat(dom2, q, "السعودية"); pickOcc(dom2, q, "طباخ"); q.count.value = "1"; q.sal.value = "6000";
  q.date.value = "2999-01-01"; dom2.pick(dom2.$("eorRC2")); dom2.pick(pill(dom2, "m6"));
  dom2.$("eorForm").fire("submit"); await dom2.flush();
  assert.equal(dom2.submitted.length, 0);
  assert.match(dom2.$("eorMsg").textContent, /تاريخ أول اشتراك غير صالح/);
});

test("الصفحات الأربع: مفاتيح التنبيه والحقل موجودة، والصفحة لا تحمل رقم قرار ولا رابطاً ولا حدّ أجر", () => {
  const KEYS = ["fsH", "fsHelp", "eFirstSub", "locLead", "locLeadClose", "locAt", "locAtRange", "locFrom", "locStarts", "locMin", "locMin1", "locNext", "locOnly", "locReview", "locBlocked", "eSaudiOnly", ...cfgKeys("loc")];
  for (const l of LANGS) {
    const cfg = cfgFromHtml(HTML[l]);
    for (const k of KEYS) assert.ok(typeof cfg.tx[k] === "string" && cfg.tx[k].length >= 2, `${l}.${k}`);
    const page = stripCat(HTML[l]);
    assert.equal(/101319|101278|103108|77050|93483|41454|132249|103111|103107|hrsd\.gov|sco_code|5,?500/.test(page), false, l);
  }
  function cfgKeys(prefix) { return Object.keys(cfgFromHtml(HTML.ar).tx).filter((k) => k.startsWith(prefix + "Cat")); }
  assert.equal(cfgKeys("loc").length, 9);
});
