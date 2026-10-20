// صفحة /eor المُثراة: دورة حياة الموظف (٨ خطوات)، أسئلة شائعة مكتملة، «لماذا Business Partner»،
// مدة التعاقد (وحدة + قيمة)، وقائمة شركات التأمين وأوصاف الفئات — بالأربع لغات.
//
// تقرأ الصفحات المولَّدة (شغّل npm run build قبلها)، كبقية اختبارات الصفحات في هذا المجلد.
// لا شبكة ولا Notion ولا Supabase. الضمانات الأساسية:
//   • لا رقم مختلق في الأقسام الجديدة (لا مدد ولا نسب ولا عملاء)، ولا سعر ولا معامل ولا تكلفة في الصفحة.
//   • لا لون حرفي في أنماط الصفحة، ولا main.js ولا localStorage.
//   • الحساب كله على الخادم: الواجهة تعرض إجمالي المدة كما يعيده الخادم ولا تضرب ولا تجمع.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = { ar: "site/ar/eor.html", en: "site/eor.html", fr: "site/fr/eor.html", zh: "site/zh/eor.html" };
const page = (lang) => fs.readFileSync(path.join(ROOT, PAGES[lang]), "utf8");
const SRC = fs.readFileSync(path.join(ROOT, "site/scripts/simple-v1-eor.mjs"), "utf8");

const between = (h, from, to) => { const a = h.indexOf(from); assert.ok(a >= 0, from); const b = h.indexOf(to, a); assert.ok(b > a, to); return h.slice(a, b); };
const text = (h) => h.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
const cfgOf = (h) => { const m = h.match(/\)\((\{"lang":.*\})\);<\/script>/s); assert.ok(m, "CFG"); return JSON.parse(m[1]); };
const durOf = (h) => { const m = h.match(/id="eorDurUnit" data-dur="([^"]*)"/); assert.ok(m, "data-dur"); return JSON.parse(m[1].replace(/&quot;/g, '"')); };
const clientOf = (h) => { const s0 = h.indexOf("<script>(function eorClient"); assert.ok(s0 > 0, "eorClient"); return h.slice(s0, h.indexOf("</script>", s0)); };
const sections = (h) => ({
  life: between(h, '<section class="sv1-sec" id="eor-life"', "</section>"),
  why: between(h, '<div class="sv1-eor-whyg"', "</section>"),
  faq: between(h, '<div class="sv1-eor-faq"', "</section>"),
});
const DIGIT = /[0-9٠-٩۰-۹]/;

const LIFE_AR = ["الطلب والسعر الفوري", "عرض مرشحين مطابقين", "اختيار وتأكيد", "التعاقد والتأشيرة", "الوصول والتسكين والمباشرة", "الدوام", "فاتورة شهرية واحدة", "الإنهاء والتسوية"];
const INSURER_IDS = ["any", "bupa", "tawuniya", "medgulf", "malath", "walaa", "rajhi_takaful", "arabian_shield", "allianz_sf"];

for (const lang of Object.keys(PAGES)) {
  test(`/eor (${lang}): دورة الحياة ثماني خطوات مرتّبة، وبطاقات «لماذا» أربع، والأسئلة الشائعة ١٤`, () => {
    const h = page(lang);
    const { life, why, faq } = sections(h);
    assert.equal((life.match(/<ol class="sv1-eor-life">/g) || []).length, 1);
    assert.equal((life.match(/<li><div><b>[^<]+<\/b><span>[^<]+<\/span><\/div><\/li>/g) || []).length, 8, "٨ خطوات بعنوان ووصف");
    assert.equal((why.match(/class="sv1-eor-why"/g) || []).length, 4, "٤ بطاقات");
    assert.equal((faq.match(/<details><summary>[^<]+<\/summary><p>[^<]+<\/p><\/details>/g) || []).length, 14, "١٤ سؤالاً");
    // العناوين لا تتكرر ولا تبقى فارغة
    const titles = [...life.matchAll(/<b>([^<]+)<\/b>/g)].map((m) => m[1]);
    assert.equal(new Set(titles).size, 8);
    if (lang === "ar") assert.deepEqual(titles, LIFE_AR);
    assert.equal(/\{\{|\[object|undefined|NaN/.test(text(life + why + faq)), false, "لا بقايا قوالب");
  });

  test(`/eor (${lang}): لا أرقام ولا نسب ولا مدد مختلقة في دورة الحياة و«لماذا» والأسئلة`, () => {
    const h = page(lang);
    const { life, why, faq } = sections(h);
    for (const [name, html] of [["life", life], ["why", why], ["faq", faq]]) {
      const tx = text(html);
      assert.equal(DIGIT.test(tx), false, `${name}: لا أرقام في النص`);
      assert.equal(/%|٪|％|百分/.test(tx), false, `${name}: لا نسب`);
      assert.equal(/\b150\b|١٥٠|40[,،]?000|٤٠[,،]?٠٠٠/.test(tx), false, `${name}: لا أرقام عملاء`);
      // لا تقييمات ولا «رقم ١» ولا تفوّق مطلق
      assert.equal(/number one|no\.\s?1|#1|\bleading\b|\bbest\b|n°\s?1|numéro un|premier|leader|رقم\s?(1|١|واحد)|الأول|الأفضل|أفضل|第一|最好|领先|五星|rating|étoiles|stars|تقييم|评分/i.test(tx), false, `${name}: لا ادعاء تفوّق أو تقييم`);
      // لا مدة منفّذة موعودة (يوم واحد / X يوم عمل / ساعات / خلال)
      assert.equal(/في يوم واحد|within a day|within 24|24 ?h|in one day|en un jour|一天内|يوم عمل|working days?|business days?|jours? ouvr|工作日|خلال\s/i.test(tx), false, `${name}: لا مدد موعودة`);
      // لا ادعاء ترخيص
      assert.equal(/ترخيص|مرخّص|مرخص|licen[cs]|agréé|accredit|持牌|执照|许可证|certified|معتمدون/i.test(tx), false, `${name}: لا ادعاء ترخيص`);
      // لا وعد بنتيجة
      assert.equal(/نضمن|مضمون|we guarantee|guaranteed|nous garantissons|garanti[es]? (de )?résultat|我们保证|保证结果/i.test(tx), false, `${name}: لا ضمانات`);
    }
  });

  test(`/eor (${lang}): خطوة التعاقد تقول «حسب نوع الحالة»، والاستبدال «يُحدَّد في العقد» بلا وعد`, () => {
    const h = page(lang);
    const { life, faq } = sections(h);
    const l4 = life.match(/<li><div><b>[^<]+<\/b><span>([^<]+)<\/span>/g)[3];
    const caseWord = { ar: "حسب نوع الحالة", en: "depending on the type of case", fr: "selon le type de cas", zh: "视具体情况" }[lang];
    assert.ok(l4.includes(caseWord), "خطوة ٤: " + caseWord);
    // الاستبدال: جواب قصير واحد بلا مدة ولا عدد ولا وعد
    const rep = { ar: "يُحدَّد في العقد.", en: "This is set in the contract.", fr: "Cela est précisé dans le contrat.", zh: "以合同约定为准。" }[lang];
    assert.ok(faq.includes(`<p>${rep}</p>`), "جواب الاستبدال");
  });

  test(`/eor (${lang}): لا سعر ولا معامل ولا تكلفة ولا هامش في الصفحة وإعدادها`, () => {
    const h = page(lang);
    const main = h.slice(h.indexOf("<main>"), h.indexOf("</main>"));
    const c = cfgOf(h);
    // نص الصفحة الظاهر + إعداد الواجهة بلا الكتالوج العام (مسمّيات مثل «مراقب تكاليف» و«Non-profit» ليست تسعيراً)
    const { cat, ...cfgRest } = c;
    const hay = text(main) + " " + JSON.stringify(cfgRest);
    assert.equal(/\d\s*(﷼|ر\.س|ريال|SAR|riyal)/i.test(text(main)), false, "لا رقم + عملة في الصفحة");
    assert.equal(/معامل|مضاعف|هامش|تكلفة|ربح|multiplier|coefficient|markup|margin|our costs?\b|cost price|\bprofit\b|marge|coût|bénéfice|系数|倍数|利润|成本|毛利/i.test(hay), false, "لا معاملات ولا تكلفة");
    // إعداد الواجهة: لا أرقام تسعير، الأرقام الوحيدة حدود إدخال
    assert.deepEqual(Object.keys(c.lim).sort(), ["hDef", "hMax", "hMin", "maxItemCount", "maxItems", "maxMonths", "maxNats", "maxSalary", "maxTotal"]);
    assert.equal(/"(price|rate|mult|factor|cost|margin|fee)[a-zA-Z]*":\s*-?\d/i.test(JSON.stringify(c)), false, "لا قيم تسعير رقمية في الإعداد");
    assert.equal(/%|٪/.test(text(main)), false, "لا نسب في الصفحة");
  });

  test(`/eor (${lang}): مدة التعاقد وحدة + قيمة، والوحدات حسب نوع التعاقد، والإجمالي من الخادم`, () => {
    const h = page(lang);
    assert.ok(h.includes('id="eorDurUnit"') && h.includes('id="eorDurValue"'), "حقلا المدة");
    assert.equal(h.includes("eorMonths"), false, "الحقل القديم زال");
    assert.equal(/<option value="(12|24|36)"/.test(h), false, "لا قائمة ١٢/٢٤/٣٦");
    const c = { dur: durOf(h) };
    assert.equal("dur" in cfgOf(h), false, "المدة خارج كتلة CFG المثبّتة");
    assert.deepEqual(c.dur.contract.map((d) => d[0]), ["month", "year"], "تعاقد: شهر/سنة");
    assert.deepEqual(c.dur.casual.map((d) => d[0]), ["hour", "day", "month"], "عمالة مرنة: ساعة/يوم/شهر");
    for (const d of [...c.dur.contract, ...c.dur.casual]) { assert.ok(d[1] && !DIGIT.test(d[1]), "اسم الوحدة"); assert.ok(Number.isInteger(d[2]) && d[2] > 0, "سقف الوحدة"); }
    if (lang === "ar") assert.deepEqual(c.dur.casual.map((d) => d[1]), ["ساعة", "يوم", "شهر"]);
    if (lang === "ar") assert.deepEqual(c.dur.contract.map((d) => d[1]), ["شهر", "سنة"]);
    const cl = clientOf(h);
    // الحقلان الجديدان يُرسلان مع الطلب ومع طلب السعر، والقديم باقٍ للتوافق
    assert.equal((cl.match(/durationUnit:/g) || []).length, 2);
    assert.equal((cl.match(/durationValue:/g) || []).length, 2);
    assert.equal((cl.match(/durationMonths: (dm|durMonths\(dr\))/g) || []).length, 2);
    // الإجمالي كما يعيده الخادم فقط: لا ضرب ولا جمع عليه
    assert.ok(cl.includes("q.termTotal") && cl.includes("q.durationTotal") && cl.includes("fmtNum(dt)") && cl.includes("pDurTotal"), "عرض إجمالي المدة");
    assert.equal(/(monthlyTotal|unitTotal|termTotal|durationTotal|\bdt)\s*[*+]|[*+]\s*(q\.monthlyTotal|q\.unitTotal|q\.termTotal|q\.durationTotal|\bdt\b)/.test(cl), false, "لا حساب على الإجماليات");
    assert.equal((cl.match(/\* 12/g) || []).length, 1, "تحويل سنة→أشهر الوحيد (توافق durationMonths)");
  });

  test(`/eor (${lang}): قائمة شركات التأمين (٨ + «أي شركة») وأوصاف الفئات الخمس، بلا سعر ولا فرق`, () => {
    const h = page(lang);
    const c = cfgOf(h);
    assert.deepEqual(c.ins.insurers.map((x) => x[0]), INSURER_IDS);
    for (const [id, nm] of c.ins.insurers) { assert.ok(nm && nm.trim(), "اسم " + id); assert.equal(DIGIT.test(nm), false, "بلا رقم: " + id); }
    const any = c.ins.insurers[0][1];
    const anyWant = { ar: "أي شركة معتمدة، نختار لك الأنسب", en: "Any approved company; we choose the best fit for you", fr: "Toute compagnie agréée ; nous choisissons la plus adaptée", zh: "任一认可公司，由我们为您选择最合适的" }[lang];
    assert.equal(any, anyWant);
    if (lang === "ar") assert.deepEqual(c.ins.insurers.slice(1).map((x) => x[1]), ["بوبا العربية", "التعاونية", "ميدغلف", "ملاذ للتأمين", "ولاء للتأمين", "الراجحي تكافل", "الدرع العربي", "أليانز السعودي الفرنسي"]);
    if (lang === "en") assert.ok(c.ins.insurers.some((x) => x[1] === "Bupa Arabia") && c.ins.insurers.some((x) => x[1] === "Tawuniya"));
    // القائمة تُبنى في بند التعاقد ويُرسَل اختيارها كتفضيل (بند العمالة المرنة بلا تأمين)
    const cl = clientOf(h);
    assert.ok(cl.includes("it.rIn = sel(TX.insurerL, INS.insurers"), "قائمة شركة التأمين في البند");
    assert.equal((cl.match(/insurer: io\.insurer/g) || []).length, 2, "تُرسَل مع السعر ومع الطلب");
    assert.ok(cl.includes('insurer: on ? it.rIn.value : "any"'));
    // أوصاف الفئات: خمس فئات، وصف غير فارغ بلا رقم ولا سعر
    const ul = between(h, 'id="eorInsClasses"', "</ul>");
    const lis = [...ul.matchAll(/<li data-cls="([^"]+)">([^<]+)<\/li>/g)];
    assert.deepEqual(lis.map((m) => m[1]), ["basic", "C", "B", "A", "quote"]);
    for (const m of lis) { assert.ok(m[2].trim().length > 10, "وصف " + m[1]); assert.equal(DIGIT.test(m[2]), false, "وصف بلا رقم: " + m[1]); assert.equal(/﷼|SAR|ريال/.test(m[2]), false); }
    // الوصف يُستبدل بما يعيده الخادم (insuranceUi.classes) بـtextContent لا innerHTML
    assert.ok(cl.includes("applyClassInfo(q.insuranceUi.classes)"));
    assert.ok(cl.includes("c.descAr") && cl.includes("c.descEn"), "العربية والإنجليزية من الخادم (descAr/descEn)");
    // السكربت العميل يُترجَم بلا خطأ نحوي
    new vm.Script(cl.replace(/^<script>/, ""));
    assert.equal(/innerHTML|insertAdjacentHTML|document\.write/.test(cl), false, "لا HTML من الخادم");
    // لا فروق أسعار بين الشركات: لا اسم شركة بجوار رقم أو عملة في نص الصفحة
    const tx = text(h.slice(h.indexOf("<main>"), h.indexOf("</main>")));
    assert.equal(/(bupa|tawuniya|medgulf|malath|walaa|takaful|shield|allianz|بوبا|التعاونية|ميدغلف|ملاذ|ولاء|تكافل|الدرع|أليانز)[^.]{0,30}\d/i.test(tx), false, "لا أرقام بجوار الشركات");
  });

  test(`/eor (${lang}): لا لون حرفي في أنماط الصفحة، ولا main.js ولا تخزين متصفّح`, () => {
    const h = page(lang);
    const css = between(h, 'id="sv1-eor-css"', "</style>");
    assert.equal(/#[0-9a-f]{3,8}\b/i.test(css), false, "لا لون سداسي");
    assert.equal(/\b(rgb|rgba|hsl|hsla|hwb|lab|lch|oklch|oklab|color-mix)\s*\(/i.test(css), false, "لا دوال ألوان");
    assert.equal(/(^|[:\s(,])(white|black|red|blue|green|gray|grey|orange|yellow|purple|navy|silver|teal|maroon)\b/i.test(css.replace(/\[[^\]]*\]/g, "")), false, "لا أسماء ألوان");
    // الأنماط المضمّنة في الصفحة: الألوان من متغيرات SV1 فقط
    const main = h.slice(h.indexOf("<main>"), h.indexOf("</main>"));
    for (const m of main.matchAll(/style="([^"]*)"/g)) {
      for (const d of m[1].split(";")) if (/(^|-)color|background|border/.test(d.split(":")[0])) assert.match(d, /var\(--[a-zA-Z0-9]+\)/, "لون مضمّن: " + d);
    }
    assert.equal(/<script[^>]*main\.js/.test(h), false);
    const cl = clientOf(h);
    assert.equal(/localStorage|sessionStorage|indexedDB|document\.cookie/.test(css + main + cl), false);
  });
}

test("/eor: الصفحات الأربع تحمل اللغة الصحيحة وعناوين الأقسام الجديدة", () => {
  const want = {
    ar: ["دورة حياة الموظف معنا", "لماذا Business Partner", "شركة التأمين"],
    en: ["The employee lifecycle with us", "Why Business Partner"],
    fr: ["Le cycle de vie de l'employé avec nous", "Pourquoi Business Partner"],
    zh: ["员工在我们这里的全周期", "为什么选择 Business Partner"],
  };
  for (const [lang, arr] of Object.entries(want)) {
    const h = page(lang);
    assert.ok(new RegExp(`<html[^>]*lang="${lang}"`).test(h), "lang " + lang);
    for (const s of arr) assert.ok(h.includes(s.replace(/'/g, "&#39;")) || h.includes(s), `${lang}: ${s}`);
  }
});

test("«لماذا Business Partner»: أربع حقائق موجودة في الخدمة فقط (حاسبة، فاتورة واحدة، عمالة مرنة بالساعة، تأمين بفئات)", () => {
  const { why } = sections(page("ar"));
  const titles = [...why.matchAll(/<h3>([^<]+)<\/h3>/g)].map((m) => m[1]);
  assert.deepEqual(titles, ["حاسبة سعر فورية", "فاتورة شهرية واحدة", "عمالة مرنة بالساعة", "تأمين طبي بفئات"]);
});

test("مصدر الصفحة: التعليق القانوني داخلي، والملف لا يستورد التسعير ولا التكلفة ولا الفوترة", () => {
  assert.ok(SRC.includes("يراجَع قانونياً"), "وسم المراجعة القانونية في تعليق الكود");
  for (const lang of Object.keys(PAGES)) assert.equal(page(lang).includes("يراجَع قانونياً"), false, "الوسم لا يظهر في الصفحة");
  const imports = SRC.split("\n").filter((l) => /^import\s/.test(l));
  for (const l of imports) assert.match(l, /_occupations\.js|\/api\/_eor\.js|api\/_eor\.js/, l);
  assert.equal(/_eor-cost|_eor-pricing|_eor-billing/.test(imports.join("\n")), false);
});
