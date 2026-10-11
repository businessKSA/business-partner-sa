// Business Partner — Simple V1: «الوظائف» (/careers).
//
// قرار المالك ٢٠٢٦/١٠/١١ (شكوى حرفية: «إيش الغباء هذا في الفوتر، ضغطت على
// الوظائف طلعت هذه الصفحة؟؟؟»): «الوظائف» في التذييل تفتح **الوظائف**، لا
// بقعةً كحلية بعنوان «جاهز لخطوتك القادمة؟» وسهمٍ إلى الأسفل. هذا الملف كان
// يرسم تلك البقعة (بطل منقول عن لقطة careers.letsshineksa.com بطلب المالك
// ٢٠٢٦/٠٩/٢٤)؛ أُزيل البطل كاملاً (الرسمة والشعار والسهم) وحلّت محلّه قائمةُ
// الوظائف نفسها فوق الطيّة.
//
// ما تحويه الصفحة الآن، بالترتيب:
//   ١. عنوان «الوظائف المفتوحة» وتحته العدد الحقيقي، وزرّان صغيران ثانويان:
//      «أرسل سيرتك الذاتية» (مرساة #seeker-form أسفل الصفحة) و«أنا صاحب عمل».
//   ٢. شريط بحث وتصفية (بحث نصّي · المدينة · المجال).
//   ٣. صفوف الوظائف: مسمّى، جهة، موقع، مجال، وزرّا «التفاصيل» و«قدّم».
//      مصادرها ثلاثة، وتُعرض كلها في قائمة واحدة:
//        أ) إعلانات أصحاب العمل الحيّة — GET /api/candidates?openJobs=1
//           (نوشن JOBS_DB). تُجلب في المتصفّح وتُدرَج في رأس القائمة،
//           والتاريخ من postedAt ولا يُرسم إلا إذا عاد تاريخٌ حقيقي.
//        ب) وظائف Business Partner نفسها (JOBS في generate.mjs).
//        ج) حملة ورشة تصنيع الفعاليات (data/workshop-jobs.json).
//      ب وج تُرسم **على الخادم** داخل HTML الصفحة (روابط /jobs/<slug> قابلة
//      للزحف بلا جافاسكربت)، والجافاسكربت لا يفعل إلا التصفية والترقيم وإدراج أ.
//   ٤. تحت القائمة — كما كان بلا حذف: القيم الثلاث، نموذج المرشّح العام
//      (#seeker-form)، و«تابع طلبك». هي البوابة التي يدخل منها مرشّحٌ بلا
//      وظيفة محددة إلى قاعدتنا، ويقودها main.js (setSelectedJob و ?job=).
//
// ⚠️ ما لا يتغيّر: النموذج (parts.seekerForm) و«تابع طلبك» (parts.track)
// يصلان جاهزين من generate.mjs ويوضعان حرفاً بحرف. ولا نضع هنا
// #client-jobs-grid: main.js يملأ ذلك المعرّف بنسخته من البطاقات، ولو بقي لظهرت
// كل وظيفة حيّة مرّتين. زرّ «قدّم» لإعلانٍ حيّ يذهب إلى /job?id=<معرّف>#apply-form
// لأن صفحة /job وحدها تربط الطلب بمعرّف نوشن الحقيقي (انظر simple-v1-hiring.mjs).
//
// لا تاريخ نشر لوظائف ب وج: لا حقل تاريخٍ لها في البيانات (JSON-LD في صفحة
// الوظيفة يكتب تاريخ البناء لا تاريخاً حقيقياً). نرسم تاريخاً لما له تاريخ فقط،
// ولا نخترع واحداً.
//
// التنسيق: styles.css محمَّل على صفحات SV1 وفوقه SV1_LEGACY_CSS؛ هنا أنماط
// القائمة وحدها بسابقة .cj- وكلها داخل .sv1-legacy.

const T = {
  title: { ar: "الوظائف المفتوحة", en: "Open positions", fr: "Postes ouverts", zh: "开放职位" },
  // العدّاد: صيغ الجمع حسب Intl.PluralRules للغة الصفحة (للعربية ست صيغ).
  count: {
    ar: { zero: "لا توجد وظائف مفتوحة حالياً", one: "وظيفة مفتوحة واحدة", two: "وظيفتان مفتوحتان", few: "{n} وظائف مفتوحة", many: "{n} وظيفة مفتوحة", other: "{n} وظيفة مفتوحة" },
    en: { zero: "No open positions right now", one: "1 open position", other: "{n} open positions" },
    fr: { zero: "Aucun poste ouvert pour le moment", one: "1 poste ouvert", many: "{n} postes ouverts", other: "{n} postes ouverts" },
    zh: { zero: "目前没有开放职位", other: "{n} 个开放职位" },
  },
  of: {
    ar: "عرض {n} من {m} وظيفة",
    en: "Showing {n} of {m} positions",
    fr: "{n} postes affichés sur {m}",
    zh: "显示 {n} / {m} 个职位",
  },
  lead: {
    ar: "تصفّح الوظائف وقدّم مباشرة. كل طلب يُسجَّل لدى فريق Business Partner ويُراجَع.",
    en: "Browse the roles and apply directly. Every application is logged with the Business Partner team and reviewed.",
    fr: "Parcourez les postes et postulez directement. Chaque candidature est enregistrée par l'équipe Business Partner et examinée.",
    zh: "浏览职位并直接申请。每份申请都会登记到 Business Partner 团队并被审阅。",
  },
  btnCv: { ar: "أرسل سيرتك الذاتية", en: "Send your CV", fr: "Envoyer votre CV", zh: "提交简历" },
  employer: { ar: "أنا صاحب عمل", en: "I'm an employer", fr: "Je suis employeur", zh: "我是雇主" },
  search: { ar: "ابحث بالمسمّى أو الكلمة", en: "Search by title or keyword", fr: "Rechercher un intitulé ou un mot-clé", zh: "按职位或关键词搜索" },
  lblCity: { ar: "المدينة", en: "City", fr: "Ville", zh: "城市" },
  lblField: { ar: "المجال", en: "Field", fr: "Domaine", zh: "领域" },
  anyCity: { ar: "كل المدن", en: "All cities", fr: "Toutes les villes", zh: "所有城市" },
  anyField: { ar: "كل المجالات", en: "All fields", fr: "Tous les domaines", zh: "所有领域" },
  view: { ar: "التفاصيل", en: "Details", fr: "Détails", zh: "详情" },
  apply: { ar: "قدّم", en: "Apply", fr: "Postuler", zh: "申请" },
  posted: { ar: "نُشرت", en: "Posted", fr: "Publiée le", zh: "发布于" },
  openings: { ar: "{n} شواغر", en: "{n} openings", fr: "{n} postes à pourvoir", zh: "{n} 个名额" },
  more: { ar: "عرض المزيد", en: "Show more", fr: "Voir plus", zh: "显示更多" },
  clear: { ar: "إزالة التصفية", en: "Clear filters", fr: "Effacer les filtres", zh: "清除筛选" },
  none: { ar: "لا توجد وظائف تطابق بحثك.", en: "No positions match your search.", fr: "Aucun poste ne correspond à votre recherche.", zh: "没有符合条件的职位。" },
  loading: { ar: "جارٍ تحميل وظائف أصحاب العمل…", en: "Loading employer postings…", fr: "Chargement des offres des employeurs…", zh: "正在加载雇主发布的职位…" },

  // القيم الثلاث — النصّ نفسه الذي كان على الصفحة، مترجَماً للفرنسية والصينية.
  v1h: { ar: "سيرة واحدة، فرص كثيرة", en: "One CV, many opportunities", fr: "Un CV, de nombreuses opportunités", zh: "一份简历，多个机会" },
  v1p: {
    ar: "سجّل مرة واحدة، ونطابقك مع الفرص المناسبة فور توفّرها.",
    en: "Join the pool once; we match you whenever a fitting role opens.",
    fr: "Inscrivez-vous une fois ; nous vous proposons chaque poste qui vous correspond.",
    zh: "只需登记一次，一旦有合适职位我们就为您匹配。",
  },
  v2h: { ar: "أصحاب العمل يوصلونك", en: "Employers reach you", fr: "Les employeurs vous contactent", zh: "雇主主动联系您" },
  v2p: {
    ar: "الشركات التي توظّف عبرنا تشاهد ملفك للفرص المناسبة.",
    en: "Companies hiring through us see your profile for suitable roles.",
    fr: "Les entreprises qui recrutent via nous consultent votre profil pour les postes adaptés.",
    zh: "通过我们招聘的企业会查看您的资料以匹配合适职位。",
  },
  v3h: { ar: "بياناتك محمية", en: "Your data is protected", fr: "Vos données sont protégées", zh: "您的数据受保护" },
  v3p: {
    ar: "لا نشارك سيرتك دون موافقتك (حماية البيانات).",
    en: "We never share your CV without your consent (PDPL).",
    fr: "Nous ne partageons jamais votre CV sans votre consentement (PDPL).",
    zh: "未经您同意，我们绝不分享您的简历（个人数据保护法）。",
  },

  poolH: { ar: "انضم لقاعدة المرشحين العامة", en: "Join the general candidate pool", fr: "Rejoignez le vivier de candidats", zh: "加入通用候选人才库" },
  poolP: {
    ar: "لا تقدّم على وظيفة محددة أعلاه؟ قدّم هنا وسنطابقك عند توفّر فرصة مناسبة.",
    en: "Not applying for a specific posting above? Submit here and we'll match you when a suitable role opens.",
    fr: "Vous ne postulez pas à une offre précise ci-dessus ? Déposez votre candidature ici et nous vous contacterons dès qu'un poste correspond.",
    zh: "没有申请上面的具体职位？在此提交，一旦有合适职位我们会为您匹配。",
  },
};

// بيانات الوظائف الثابتة (العنوان والملخّص) مكتوبة بالعربية والإنجليزية فقط في
// المستودع؛ وصفحات الوظائف نفسها تعرضها بالإنجليزية في الفرنسية والصينية. هنا
// تُترجَم **الحقول القصيرة** التي تظهر في الصف وفي المرشّحات (الموقع والمجال
// والنوع) حتى لا تقف كلمةٌ إنجليزية وحدها وسط واجهةٍ فرنسية أو صينية. ما لا
// يُعرف يُعرض كما جاء.
const SHORT = {
  fr: { "Riyadh": "Riyad", "Saudi Arabia": "Arabie saoudite", "hybrid": "hybride", "Human resources": "Ressources humaines", "Management": "Direction", "Engineering & Design": "Ingénierie et conception", "Team Leaders": "Chefs d'équipe", "Warehouse & Logistics": "Entrepôt et logistique", "Technicians": "Techniciens", "Skilled Trades & Labor": "Métiers qualifiés et main-d'œuvre", "Finance, HR & Procurement": "Finance, RH et achats", "Full-time": "Temps plein" },
  zh: { "Riyadh": "利雅得", "Saudi Arabia": "沙特阿拉伯", "hybrid": "混合办公", "Human resources": "人力资源", "Management": "管理", "Engineering & Design": "工程与设计", "Team Leaders": "团队主管", "Warehouse & Logistics": "仓储与物流", "Technicians": "技术员", "Skilled Trades & Labor": "技工与劳务", "Finance, HR & Procurement": "财务、人力资源与采购", "Full-time": "全职" },
};

/**
 * صفّ وظيفة واحد — دالةٌ نقيّة تُستعمل **مرّتين من النصّ نفسه**: في Node لرسم
 * وظائف Business Partner على الخادم، وفي المتصفّح (عبر toString) لرسم الإعلانات
 * الحيّة. نسختان مكتوبتان باليد كانتا ستتباعدان عند أول تعديل في التنسيق.
 * ES5 عمداً (تُحقن في الصفحة كما هي) ولا تلمس إلا معاملاتها.
 *
 * @param {{href:string,title:string,meta:string[],tags:string[],desc:string,
 *          city:string,field:string,date:string,dateLabel:string}} j
 * @param {{view:string,apply:string}} X
 */
function cjRow(j, X) {
  var e = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var meta = [];
  for (var i = 0; i < j.meta.length; i++) if (j.meta[i]) meta.push("<span>" + e(j.meta[i]) + "</span>");
  var tags = "";
  for (var k = 0; k < j.tags.length; k++) if (j.tags[k]) tags += '<span class="cj-tg">' + e(j.tags[k]) + "</span>";
  var when = j.date ? '<span class="cj-ag">' + e(j.dateLabel) + "</span>" : "";
  var sep = '<span class="cj-sep" aria-hidden="true">•</span>';
  return '<article class="cj-row" data-city="' + e(j.city) + '" data-field="' + e(j.field) + '">' +
    '<div class="cj-mn"><h2><a href="' + e(j.href) + '">' + e(j.title) + "</a></h2>" +
    '<p class="cj-mt">' + meta.join(sep) + tags + when + "</p>" +
    (j.desc ? '<p class="cj-ds">' + e(j.desc) + "</p>" : "") +
    '</div><div class="cj-ac"><a class="sv1-btn sm" href="' + e(j.href) + '">' + e(X.view) + "</a>" +
    '<a class="sv1-btn sm primary" href="' + e(j.href) + '#apply-form">' + e(X.apply) + "</a></div></article>";
}

/**
 * جسم صفحة /careers: قائمة الوظائف أولاً، ثم القائم كما هو.
 *
 * يُسلَّم إلى sv1LegacyApp() في generate.mjs — فهو وحده الذي يركّب قشرة SV1
 * ويُحمّل main.js وينزع عدّاد القشرة المكرّر. هذا الملف لا يبني صفحة كاملة
 * عمداً: إعادة كتابة ذلك هنا نسخةٌ ثانية من حارسٍ إن تباعدت عُدّت كل زيارة
 * مرّتين بلا عطلٍ ظاهر.
 *
 * @param {{lang:()=>string, esc:(s:string)=>string}} ctx
 * @param {{jobs:Array, jobHref:string, seekerForm:string, track:string, employerHref:string}} parts
 *   jobs: وظائف ثابتة محسومة اللغة والرابط من generate.mjs، كلٌّ
 *   {href,title,org,location,city,field,type,openings,summary}.
 *   jobHref: بادئة رابط الإعلان الحيّ (مثل «/ar/job?id=»).
 *   seekerForm/track قطعٌ جاهزة تُوضع كما هي.
 */
export function careersBody(ctx, parts) {
  const { lang: langFn, esc } = ctx;
  const lang = langFn();
  const t = (k) => { const e = T[k]; return e[lang] != null ? e[lang] : e.en; };
  const p = parts || {};
  const employerHref = p.employerHref || "/employers";
  const jobs = Array.isArray(p.jobs) ? p.jobs : [];
  const X = { view: t("view"), apply: t("apply") };
  const plural = (n) => {
    const forms = T.count[lang] || T.count.en;
    let k = "other";
    try { k = new Intl.PluralRules(lang).select(n); } catch (e) { /* other */ }
    if (n === 0 && forms.zero) k = "zero";
    return String(forms[k] || forms.other).replace("{n}", String(n));
  };

  const dict = SHORT[lang];
  const sh = (s) => {
    if (!dict || !s) return s;
    return Object.keys(dict).sort((a, b) => b.length - a.length).reduce((acc, k) => acc.split(k).join(dict[k]), String(s));
  };

  const rows = jobs.map((j) => cjRow({
    href: j.href,
    title: j.title,
    meta: [j.org, sh(j.location), sh(j.field)],
    tags: [sh(j.type), j.openings > 1 ? t("openings").replace("{n}", String(j.openings)) : ""],
    desc: j.summary,
    city: sh(j.city || ""),
    field: sh(j.field || ""),
    date: "",
    dateLabel: "",
  }, X)).join("");

  const CSS = `<style id="sv1-careers-css">
.sv1-legacy .cj{padding:34px 0 8px}
.sv1-legacy .cj-in{max-width:980px}
.sv1-legacy .cj-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px 28px;flex-wrap:wrap;margin-bottom:20px}
.sv1-legacy .cj-head h1{margin:0;font-size:clamp(28px,4.2vw,40px);font-weight:800;letter-spacing:-.02em;line-height:1.25;color:var(--ink)}
.sv1-legacy .cj-count{margin:6px 0 0;font-size:15px;font-weight:600;color:var(--ac)}
.sv1-legacy .cj-lead{margin:6px 0 0;font-size:14px;color:var(--mut);line-height:1.8;max-width:560px}
.sv1-legacy .cj-quick{display:flex;gap:8px;flex-wrap:wrap}
.sv1-legacy .cj-quick a{font-size:12.5px;padding:8px 14px}

.sv1-legacy .cj-bar{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr) minmax(0,1fr);gap:10px;margin-bottom:16px}
.sv1-legacy .cj-bar input,.sv1-legacy .cj-bar select{width:100%;height:46px;margin:0;padding:0 14px;border:1px solid var(--l);border-radius:10px;
 background:#fff;color:var(--ink);font:inherit;font-size:14px;box-shadow:none}
.sv1-legacy .cj-bar input::placeholder{color:var(--faint)}
.sv1-legacy .cj-bar input:focus,.sv1-legacy .cj-bar select:focus{outline:0;border-color:var(--ac);box-shadow:0 0 0 3px var(--acSoft)}
.sv1-legacy .cj-bar [hidden]{display:none}
.sv1-legacy .cj-sub{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0;font-size:12.5px;color:var(--mut)}
.sv1-legacy .cj-sub [hidden]{display:none}
.sv1-legacy .cj-sub:has(> [hidden]:first-child):has(> [hidden]:last-child){display:none}
.sv1-legacy .cj-sub{padding-bottom:10px}
.sv1-legacy .cj-clear{border:0;background:none;color:var(--ac);font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;padding:2px 0;
 border-bottom:1px solid var(--acLine)}

.sv1-legacy .cj-list{border:1px solid var(--l);border-radius:14px;background:#fff;overflow:hidden}
.sv1-legacy .cj-list[hidden]{display:none}
.sv1-legacy .cj-row{display:flex;align-items:flex-start;gap:18px;padding:20px 22px;border-top:1px solid var(--line2);transition:background .15s}
.sv1-legacy .cj-row:first-child{border-top:0}
.sv1-legacy .cj-row:hover{background:var(--soft)}
.sv1-legacy .cj-row[hidden]{display:none}
.sv1-legacy .cj-mn{flex:1;min-width:0}
.sv1-legacy .cj-row h2{margin:0;font-size:16.5px;font-weight:600;line-height:1.55;letter-spacing:-.01em}
.sv1-legacy .cj-row h2 a{color:var(--ink)}
.sv1-legacy .cj-row h2 a:hover{color:var(--ac);text-decoration:underline}
.sv1-legacy .cj-mt{margin:7px 0 0;font-size:12.5px;color:var(--mut);display:flex;flex-wrap:wrap;align-items:center;gap:7px;line-height:1.7}
.sv1-legacy .cj-sep{color:var(--l);font-size:10px}
.sv1-legacy .cj-tg{border:1px solid var(--acLine);background:var(--acSoft);color:var(--ac);border-radius:999px;padding:2px 10px;font-size:11px;font-weight:500}
.sv1-legacy .cj-ag{color:var(--faint);font-size:11.5px}
.sv1-legacy .cj-ds{margin:10px 0 0;font-size:12.5px;color:var(--s);line-height:1.85;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.sv1-legacy .cj-ac{flex:none;display:flex;flex-direction:column;gap:7px;min-width:130px}
.sv1-legacy .cj-ac .sv1-btn{width:100%;padding-block:9px}
.sv1-legacy .cj-none{padding:34px 22px;text-align:center;color:var(--mut);font-size:14px;border:1px dashed var(--l);border-radius:14px}
.sv1-legacy .cj-none[hidden]{display:none}
.sv1-legacy .cj-more{display:flex;margin:16px auto 0;min-width:180px}
.sv1-legacy .cj-more[hidden]{display:none}
.sv1-legacy .cj-load{font-size:12px;color:var(--faint)}

/* الترويسة لاصقة: بلا هذا الهامش يقف القسم المقصود تحتها فيختفي عنوانه. */
.sv1-legacy #open-jobs,.sv1-legacy #seeker-form{scroll-margin-top:92px}

@media(max-width:640px){
 .sv1-legacy .cj{padding-top:22px}
 .sv1-legacy .cj-bar{grid-template-columns:1fr 1fr}
 .sv1-legacy .cj-bar input{grid-column:1 / -1}
 .sv1-legacy .cj-row{flex-direction:column;gap:13px;padding:17px 16px}
 .sv1-legacy .cj-ac{flex-direction:row;width:100%;min-width:0}
 .sv1-legacy .cj-ac .sv1-btn{flex:1}
}
</style>`;

  const head = `
  <section class="cj" id="open-jobs"><div class="container cj-in">
    <header class="cj-head">
      <div>
        <h1>${esc(t("title"))}</h1>
        <p class="cj-count" id="cjCount" aria-live="polite">${esc(plural(jobs.length))}</p>
        <p class="cj-lead">${esc(t("lead"))}</p>
      </div>
      <div class="cj-quick">
        <a class="sv1-btn sm" href="#seeker-form">${esc(t("btnCv"))}</a>
        <a class="sv1-btn sm" href="${esc(employerHref)}">${esc(t("employer"))}</a>
      </div>
    </header>

    <div class="cj-bar" role="search">
      <input type="search" id="cjQ" placeholder="${esc(t("search"))}" aria-label="${esc(t("search"))}" autocomplete="off">
      <select id="cjCity" aria-label="${esc(t("lblCity"))}" hidden><option value="">${esc(t("anyCity"))}</option></select>
      <select id="cjField" aria-label="${esc(t("lblField"))}" hidden><option value="">${esc(t("anyField"))}</option></select>
    </div>
    <div class="cj-sub"><span id="cjSub" class="cj-load" hidden></span><button type="button" class="cj-clear" id="cjClear" hidden>${esc(t("clear"))}</button></div>

    <span id="client-jobs" aria-hidden="true"></span><!-- مرساة قديمة: «العودة للوظائف» في صفحة الحملة تشير إلى /careers#client-jobs -->
    <div class="cj-list" id="cjList">${rows}</div>
    <div class="cj-none" id="cjNone" hidden>${esc(t("none"))}</div>
    <button type="button" class="sv1-btn cj-more" id="cjMore" hidden>${esc(t("more"))}</button>
  </div></section>`;

  const SCRIPT = `<script>(function(){"use strict";
var LANG=${JSON.stringify(lang)},TX=${JSON.stringify({
    of: T.of[lang] || T.of.en,
    posted: t("posted"),
    loading: t("loading"),
    anyCity: t("anyCity"),
    anyField: t("anyField"),
    counts: T.count[lang] || T.count.en,
    view: X.view,
    apply: X.apply,
  }).replace(/</g, "\\u003c")},
JOB=${JSON.stringify(p.jobHref || "/job?id=")},PAGE=15;
var cjRow=${cjRow.toString()};
var $=function(i){return document.getElementById(i)};
var list=$('cjList');if(!list)return;
var elCount=$('cjCount'),elQ=$('cjQ'),elCity=$('cjCity'),elField=$('cjField'),elMore=$('cjMore'),
    elNone=$('cjNone'),elSub=$('cjSub'),elClear=$('cjClear');
var shown=PAGE,M=[],loadingLive=true;
function clean(v){return String(v==null?'':v).replace(/\\s+/g,' ').trim()}
function norm(v){return clean(v).toLowerCase()}
function cityKey(v){return clean(String(v==null?'':v).split('|')[0])}
function num(n){try{return Number(n).toLocaleString('en-US')}catch(e){return String(n)}}
function plural(n){var k='other';try{k=new Intl.PluralRules(LANG).select(n)}catch(e){}
 if(n===0&&TX.counts.zero)k='zero';
 return String(TX.counts[k]||TX.counts.other).replace('{n}',num(n))}

// النموذج: كل صفٍّ كائنٌ {el,live,city,field,hay}. الصفوف الثابتة تُقرأ من DOM
// الذي رسمه الخادم، والحيّة تُبنى بالدالة نفسها وتُدرَج في رأس القائمة.
function adopt(el,live){
 M.push({el:el,live:!!live,city:cityKey(el.getAttribute('data-city')),field:clean(el.getAttribute('data-field')),hay:norm(el.textContent)})}
Array.prototype.forEach.call(list.querySelectorAll('.cj-row'),function(el){adopt(el,false)});

var F={q:'',city:'',field:''};
function match(m,skip){
 if(skip!=='city'&&F.city&&m.city!==F.city)return false;
 if(skip!=='field'&&F.field&&m.field!==F.field)return false;
 if(F.q){var w=norm(F.q).split(/[^\\p{L}\\p{N}]+/u).filter(function(x){return x.length>1});
  for(var i=0;i<w.length;i++)if(m.hay.indexOf(w[i])<0)return false}
 return true}
// الخيارات مبنيّة من الوظائف الموجودة فعلاً مع عدّادها على بقيّة الفلاتر: خيارٌ
// لا وظيفة تحته لا يُعرض، فلا يعيد فلترٌ صفراً.
function facet(sel,key,any){
 var base=M.filter(function(m){return match(m,key)}),c={},order=[];
 base.forEach(function(m){var v=m[key];if(!v)return;if(c[v]==null){c[v]=0;order.push(v)}c[v]++});
 order.sort(function(a,b){if(c[b]!==c[a])return c[b]-c[a];try{return a.localeCompare(b,LANG)}catch(e){return 0}});
 if(F[key]&&c[F[key]]==null)order.unshift(F[key]);
 // قائمةٌ بخيارٍ واحد لا تصفّي شيئاً — تُخفى حتى تصير ذات معنى.
 sel.hidden=!(order.length>1||F[key]);
 sel.textContent='';
 var o0=document.createElement('option');o0.value='';o0.textContent=any;sel.appendChild(o0);
 order.forEach(function(v){var o=document.createElement('option');o.value=v;o.textContent=v+' ('+num(c[v]||0)+')';sel.appendChild(o)});
 sel.value=F[key]||''}

function paint(){
 var vis=0;
 M.forEach(function(m){if(match(m)){vis++;m.el.hidden=vis>shown}else m.el.hidden=true});
 facet(elCity,'city',TX.anyCity);facet(elField,'field',TX.anyField);
 var active=!!(F.q||F.city||F.field);
 elCount.textContent=active?TX.of.replace('{n}',num(vis)).replace('{m}',num(M.length)):plural(M.length);
 elNone.hidden=vis>0;list.hidden=!vis;
 elMore.hidden=vis-shown<=0;
 elClear.hidden=!active;
 elSub.hidden=!loadingLive;elSub.textContent=loadingLive?TX.loading:''}

function applyF(){shown=PAGE;paint()}
var tmr=null;
elQ.addEventListener('input',function(){clearTimeout(tmr);tmr=setTimeout(function(){F.q=elQ.value.trim();applyF()},180)});
elCity.addEventListener('change',function(){F.city=elCity.value;applyF()});
elField.addEventListener('change',function(){F.field=elField.value;applyF()});
elClear.addEventListener('click',function(){F.q=F.city=F.field='';elQ.value='';applyF()});
elMore.addEventListener('click',function(){shown+=PAGE;paint()});

// الإعلانات الحيّة (نوشن): تُدرَج قبل الوظائف الثابتة، الأحدث أولاً كما تعيدها
// النقطة. فشل الجلب لا يُظهر شيئاً — القائمة الثابتة تبقى كاملة.
function fmtDate(v){var t=Date.parse(v);if(isNaN(t))return '';
 try{return new Intl.DateTimeFormat(LANG==='ar'?'ar-u-nu-latn':LANG,{day:'numeric',month:'short',year:'numeric'}).format(new Date(t))}catch(e){return ''}}
function liveRow(j){
 var d=fmtDate(j.postedAt);
 var html=cjRow({href:JOB+encodeURIComponent(j.id),title:clean(j.title),
  meta:[clean(j.company),cityKey(j.city),clean(j.field)],tags:[clean(j.type),clean(j.mode)],
  desc:clean(j.description).slice(0,160),city:cityKey(j.city),field:clean(j.field),
  date:d,dateLabel:d?TX.posted+' '+d:''},{view:TX.view,apply:TX.apply});
 var box=document.createElement('div');box.innerHTML=html;return box.firstChild}

// الإعلانات تُكتب بالعربية في نوشن؛ في اللغات الأخرى تُترجَم عند الطلب بالنداء
// نفسه الذي يستعمله main.js (task:"translate") ومفتاح التخزين نفسه، على دفعات
// متتابعة لا متوازية (التوازي يستنفد حدّ المزوّد فتسقط اللوحة كلها للعربية).
function translateParts(parts,id){
 if(LANG==='ar')return Promise.resolve(null);
 var key='bp_jobtr_'+LANG+'_'+id;
 try{var hit=JSON.parse(localStorage.getItem(key)||'null');if(hit&&hit.n===parts.length)return Promise.resolve(hit.parts)}catch(e){}
 return fetch('/api/hire',{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({task:'translate',lang:LANG,items:parts})}).then(function(r){return r.json()}).then(function(d){
  if(!d||!d.ok||!Array.isArray(d.items)||d.items.length!==parts.length)return null;
  try{localStorage.setItem(key,JSON.stringify({n:parts.length,parts:d.items}))}catch(e2){}
  return d.items}).catch(function(){return null})}

fetch('/api/candidates?openJobs=1').then(function(r){return r.json()}).then(function(d){
 var js=(d&&d.ok&&d.jobs)||[];
 var first=list.firstChild,made=[];
 js.forEach(function(j){if(!clean(j.title))return;var el=liveRow(j);list.insertBefore(el,first);adopt(el,true);made.push({j:j,el:el})});
 // الصفوف الحيّة أمام الثابتة في الـDOM، فيتبعها النموذج (الترقيم يعدّ بترتيبه).
 M.sort(function(a,b){return (b.live?1:0)-(a.live?1:0)});
 if(LANG!=='ar'&&made.length){
  var batches=[];for(var b=0;b<made.length;b+=8)batches.push(made.slice(b,b+8));
  (function next(i){if(i>=batches.length)return;var bt=batches[i],parts=[];
   bt.forEach(function(x){parts.push(clean(x.j.title),clean(x.j.description).slice(0,160)||'—')});
   var key='board-'+bt.map(function(x){return String(x.j.id).slice(-6)}).join('');
   translateParts(parts,key).then(function(tr){
    if(tr)bt.forEach(function(x,k){var h=x.el.querySelector('h2 a');if(h)h.textContent=tr[k*2];
     var ds=x.el.querySelector('.cj-ds');if(ds&&tr[k*2+1]!=='—')ds.textContent=tr[k*2+1];
     for(var q=0;q<M.length;q++)if(M[q].el===x.el)M[q].hay=norm(x.el.textContent)});
    next(i+1)})})(0)}
}).catch(function(){}).then(function(){loadingLive=false;paint()});
paint();
})();</script>`;

  const value = [
    ["📄", t("v1h"), t("v1p")],
    ["🤝", t("v2h"), t("v2p")],
    ["🔒", t("v3h"), t("v3p")],
  ].map((x) => `<div class="card"><div class="card-icon" style="font-size:1.5rem">${x[0]}</div><h3>${esc(x[1])}</h3><p>${esc(x[2])}</p></div>`).join("");

  // تحت القائمة: القيم الثلاث، ثم النموذج داخل الحاوية نفسها التي تحمل
  // #seeker-form، ثم «تابع طلبك» كما هو.
  return `${CSS}${head}${SCRIPT}

  <section class="section"><div class="container">
    <div class="grid grid-3" style="margin-bottom:36px">${value}</div>
    <div style="max-width:640px;margin:0 auto" id="seeker-form">
      <h2 class="center">${esc(t("poolH"))}</h2>
      <p class="center text-soft" style="margin-top:-8px">${esc(t("poolP"))}</p>
      ${p.seekerForm || ""}
    </div>
  </div></section>

  ${p.track || ""}`;
}
