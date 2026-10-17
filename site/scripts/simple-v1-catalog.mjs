// Business Partner — Simple V1: «الخدمات والباقات» (/catalog).
//
// كانت الصفحة قائمة مسطّحة من ١٤٠ بطاقة: من يفتحها على جواله يمرّر دقيقة
// كاملة قبل أن يصل إلى قسمه. صارت مجموعات مطويّة — كل مجال بطاقة واحدة تُفتح
// على خدماته — وتبويباً ثانياً للباقات.
//
// والأهم: الاختيار متعدد. من يؤسّس شركة يحتاج السجل والعنوان الوطني وقوى
// والتأمينات معاً، فيؤشّر عليها كلها ويبدأ طلباً واحداً بنطاقٍ فيه البنود
// الأربعة — بدل أن يبدأ أربعة طلبات أو يشرحها بالكلام. الاختيار يُسلَّم إلى
// المحادثة في الصفحة الرئيسية عبر `bp_sva_request`، ومنها تكمل الرحلة نفسها:
// نطاق → عرض سعر → عقد → دفع → فاتورة.
//
// الأسعار لا تظهر للزائر: سياسة المالك أن الكتالوج وأسعاره في الخلفية. سعر
// الباقة يحمل صنف `price-amt` الذي تخفيه قاعدة `html[data-prices="off"]`
// العامة، فيراه العميل المسجَّل ولا يراه الزائر — قاعدة واحدة لا استثناء لها.
import fs from "node:fs";
import path from "node:path";

const T = {
  title:  { ar: "الخدمات والباقات", en: "Services & packages", fr: "Services et forfaits", zh: "服务与套餐" },
  desc:   { ar: "كل ما ننفّذه — مرتّباً بالمجال. أشّر على ما تحتاجه وابدأ طلبك بها كلها.",
            en: "Everything we deliver, grouped by field. Tick what you need and start one request with all of it.",
            fr: "Tout ce que nous réalisons, par domaine. Cochez vos besoins et lancez une seule demande.",
            zh: "我们提供的全部服务，按领域分类。勾选所需项目，一次性发起申请。" },
  tabSvc: { ar: "الخدمات", en: "Services", fr: "Services", zh: "服务" },
  tabPkg: { ar: "الباقات", en: "Packages", fr: "Forfaits", zh: "套餐" },
  tabTrip:{ ar: "الرحلات", en: "Trips", fr: "Voyages", zh: "行程" },
  tabHire:{ ar: "التوظيف", en: "Hiring", fr: "Recrutement", zh: "招聘" },
  details: { ar: "التفاصيل ←", en: "Details →", fr: "Détails →", zh: "详情 →" },
  search: { ar: "ابحث: إقامة، رخصة، توظيف، سجل تجاري…", en: "Search: visa, licence, hiring, registration…",
            fr: "Rechercher : visa, licence, recrutement…", zh: "搜索：签证、许可、招聘…" },
  none:   { ar: "لا نتيجة بهذه الكلمة. جرّب كلمة أعمّ، أو اشرح احتياجك في المحادثة.",
            en: "Nothing matched. Try a broader word, or describe your need in the chat.",
            fr: "Aucun résultat. Essayez un terme plus large, ou décrivez votre besoin.",
            zh: "没有匹配项。请尝试更宽泛的词，或在对话中描述您的需求。" },
  picked: { ar: "اخترت", en: "Selected", fr: "Sélectionné", zh: "已选" },
  svcWord:{ ar: "خدمة", en: "services", fr: "services", zh: "项服务" },
  start:  { ar: "ابدأ طلبك بها", en: "Start a request", fr: "Lancer la demande", zh: "开始申请" },
  clear:  { ar: "مسح", en: "Clear", fr: "Effacer", zh: "清除" },
  byField:{ ar: "حسب المجال", en: "By field", fr: "Par domaine", zh: "按领域" },
  byGov:  { ar: "حسب الجهة", en: "By authority", fr: "Par autorité", zh: "按主管部门" },
  all:    { ar: "الكل", en: "All", fr: "Tout", zh: "全部" },
  govLbl: { ar: "الجهة", en: "Authority", fr: "Autorité", zh: "主管部门" },
  askSvc: { ar: "اسأل المستشار عنها", en: "Ask the Smart Advisor", fr: "Demander au conseiller intelligent", zh: "咨询智能顾问" },
  add:    { ar: "أضف للطلب", en: "Add to request", fr: "Ajouter à la demande", zh: "加入申请" },
  added:  { ar: "أُضيفت ✓", en: "Added ✓", fr: "Ajoutée ✓", zh: "已加入 ✓" },
  more:   { ar: "عرض المزيد", en: "Show more", fr: "Voir plus", zh: "显示更多" },
  shown:  { ar: "من", en: "of", fr: "sur", zh: "/" },
  vat:    { ar: "قبل ضريبة القيمة المضافة ١٥٪", en: "Excl. 15% VAT", fr: "Hors TVA 15 %", zh: "不含15%增值税" },
  govFee: { ar: "الرسوم الحكومية مستثناة", en: "Government fees excluded", fr: "Frais gouvernementaux exclus", zh: "不含政府规费" },
  quote:  { ar: "السعر حسب حالتك", en: "Priced to your case", fr: "Prix selon votre cas", zh: "按您的情况报价" },
  pctDeal:{ ar: "نسبة من قيمة الصفقة", en: "Percentage of deal value", fr: "Pourcentage de la valeur", zh: "按交易额百分比" },
  from:   { ar: "يبدأ من", en: "From", fr: "À partir de", zh: "起" },
  perCand:{ ar: "لكل مرشّح", en: "per candidate", fr: "par candidat", zh: "每位候选人" },
  perCv:  { ar: "سيرة ذاتية", en: "per CV", fr: "par CV", zh: "每份简历" },
  perEnt: { ar: "كيان", en: "per entity", fr: "par entité", zh: "每个实体" },
  perEst: { ar: "منشأة", en: "per establishment", fr: "par établissement", zh: "每个机构" },
  svcCount:{ar: "خدمة", en: "services", fr: "services", zh: "项服务" },
  askQ:   { ar: "أريد أن أعرف عن خدمة «{n}»: المتطلبات والخطوات.", en: "I'd like to know about “{n}”: requirements and steps.",
            fr: "Je souhaite en savoir plus sur « {n} » : conditions et étapes.", zh: "我想了解“{n}”：所需材料与步骤。" },
  pkgAsk: { ar: "اطلب هذه الباقة", en: "Request this package", fr: "Demander ce forfait", zh: "申请此套餐" },
  pkgNote:{ ar: "الباقة اشتراك شهري يُدار من حسابك — تبدأ بطلب، ثم عرض سعر وعقد وفاتورة كبقية الخدمات.",
            en: "A package is a monthly subscription managed from your account — it starts as a request, then quotation, contract and invoice like any service.",
            fr: "Un forfait est un abonnement mensuel géré depuis votre compte — demande, devis, contrat et facture comme tout service.",
            zh: "套餐为按月订阅，在您的账户中管理——与其他服务一样，从申请到报价、合同与发票。" },
  monthly:{ ar: "شهرياً", en: "monthly", fr: "par mois", zh: "每月" },
  journey:{ ar: "من هنا تبدأ الرحلة نفسها لكل خدمة", en: "Every service starts the same journey",
            fr: "Chaque service suit le même parcours", zh: "每项服务都走同一流程" },
  ask:    { ar: "ما لقيت اللي تبيه؟", en: "Not finding it?", fr: "Vous ne trouvez pas ?", zh: "没找到？" },
  askCta: { ar: "اشرح احتياجك في المحادثة", en: "Describe your need in the chat", fr: "Décrivez votre besoin", zh: "在对话中描述您的需求" },
};

// أي باب يفتح لهذا المجال، ليبدأ المستشار في السياق الصحيح.
const DOOR = {
  "تأسيس الشركات": "formation",
  "الاستثمار الأجنبي": "formation",
  "العلاقات الحكومية": "government",
  "التوظيف والاستقدام": "government",
  "الموارد البشرية": "government",
  "الإقامة المميزة": "government",
  "دعم الأعمال": "consulting",
  "الأتمتة والذكاء الاصطناعي": "consulting",
  "العقارات": "consulting",
  "المكاتب ومساحات العمل": "consulting",
};

export function buildSimpleCatalog(SV1, ctx) {
  const lang = ctx.lang();
  const t = (k) => (T[k][lang] != null ? T[k][lang] : T[k].en);
  const esc = ctx.esc;
  const catLabel = ctx.catLabel;
  const govLabel = ctx.govLabel;
  const ar = lang === "ar";

  let raw = { services: [], packages: [] };
  try { raw = JSON.parse(fs.readFileSync(path.resolve("site/assets/data/catalog.json"), "utf8")); } catch {}

  // ‏السعر من الكتالوج بالـSKU حصراً (amount/priceLabel). العربية تعرض
  // `priceLabel` كما هو؛ واللغات الأخرى تُبنى من `amount` + `pricingModel`،
  // وأي لاحقةٍ لا نعرف ترجمتها تسقط إلى «السعر حسب حالتك» بدل أن تُعرض
  // خاطئة. لا يُخترع رقم ولا مدة ولا جهة.
  const SUFFIX = { "شهرياً": "monthly", "شهر": "monthly", "لكل مرشّح": "perCand", "سيرة ذاتية": "perCv", "كيان": "perEnt", "منشأة": "perEst" };
  const priceOf = (s) => {
    const label = String(s.priceLabel || "").trim();
    const amt = s.amount != null ? Number(s.amount) : null;
    if (!(amt > 0)) {
      if (ar) return label;
      return label === "نسبة من قيمة الصفقة" ? t("pctDeal") : t("quote");
    }
    if (ar) return label || (amt.toLocaleString("en-US") + " ﷼");
    const num = amt.toLocaleString("en-US") + " ﷼";
    const m = label.match(/\/\s*(.+)$/);
    let suffix = "";
    if (m) {
      const key = SUFFIX[m[1].trim()];
      if (!key) return t("quote");
      suffix = " · " + t(key);
    }
    return (s.pricingModel === "Starting From" ? t("from") + " " : "") + num + suffix;
  };

  const services = (raw.services || []).map((s) => ({
    code: s.code || "",
    // ‏رابط صفحة الخدمة. الصفحات الـ٢٠٠ تُبنى بنطاق عملها ومستنداتها وأسئلتها
    // ثم لا يصلها أحد: هذه الصفحة — باب الخدمات في الموقع الجديد — كانت
    // مربّعات اختيار بلا رابطٍ واحد إليها.
    slug: (s.code || "").toLowerCase(),
    name: (ar ? s.nameAr : s.nameEn) || s.nameAr || s.nameEn || "",
    // ‏التصنيف واسم الجهة بلغة الصفحة. كانا بالعربية دائماً، فتظهر في
    // الصفحة الإنجليزية عناوين عربية فوق أسماء إنجليزية — لغتان في بطاقة
    // واحدة.
    cat: (catLabel ? catLabel(s.category || s.categoryAr) : s.categoryAr) || s.categoryAr || "",
    gov: s.govPlatform && s.govPlatform !== "بدون جهة حكومية"
      ? (govLabel ? govLabel(s.govPlatform) : s.govPlatform) : "",
    price: priceOf(s),
    govFees: s.govFeesSeparate === true,
    // ‏الضريبة تُذكر فقط مع رقمٍ فعلي؛ «حسب حالتك» لا رقم فيه ليُقال قبل ضريبته.
    hasAmt: Number(s.amount) > 0,
    door: DOOR[s.categoryAr] || "consulting",
  })).filter((s) => s.name);

  // ‏مرشّحات التصفية: القطاع (كل خدمة لها قطاع) والجهة (حقل `govPlatform` الحقيقي).
  // الجهات تُعرض أزراراً فقط إن غطّت ٥ خدمات فأكثر؛ الباقي يبقى قابلاً للبحث
  // النصي. لا تجميع يدوي للجهات ولا أسماء من خارج الكتالوج.
  const tally = (key) => {
    const out = [];
    for (const s of services) {
      const k = s[key];
      if (!k) continue;
      const hit = out.find((x) => x.k === k);
      if (hit) hit.n++; else out.push({ k, n: 1 });
    }
    return out;
  };
  const cats = tally("cat");
  const govs = tally("gov").filter((x) => x.n >= 5).sort((x, y) => y.n - x.n);

  const packages = (raw.packages || []).map((p) => ({
    code: p.code || "",
    name: (ar ? p.nameAr : p.nameEn) || p.nameAr || p.nameEn || "",
    group: (ar ? p.groupNameAr : p.groupNameEn) || p.groupNameAr || "",
    price: p.amount != null ? Number(p.amount) : null,
    period: p.billingPeriod === "monthly" ? t("monthly") : "",
    features: ((ar ? p.featuresAr : p.featuresEn) || p.featuresAr || []).slice(0, 8),
  })).filter((p) => p.name);

  const steps = ar
    ? ["محادثة", "نطاق الخدمات", "عرض السعر", "العقد", "الدفع", "الفاتورة"]
    : lang === "fr" ? ["Discussion", "Périmètre", "Devis", "Contrat", "Paiement", "Facture"]
    : lang === "zh" ? ["对话", "服务范围", "报价", "合同", "支付", "发票"]
    : ["Chat", "Scope", "Quotation", "Contract", "Payment", "Invoice"];

  const body = `${SV1.header("/catalog")}
  <main>
  <section class="sv1-sec"><div class="wrap">
    <div class="sv1-title">
      <span class="sv1-tag">${esc(String(services.length))} ${esc(t("svcWord"))} · ${esc(String(packages.length))} ${esc(t("tabPkg"))}</span>
      <h2>${esc(t("title"))}</h2>
      <p>${esc(t("desc"))}</p>
    </div>

    <div class="sv1-cat-journey" aria-label="${esc(t("journey"))}">
      <span class="lbl">${esc(t("journey"))}</span>
      <ol>${steps.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>
    </div>

    <div class="sv1-tabs">
      <button type="button" class="sv1-tab on" id="tabSvc">${esc(t("tabSvc"))}</button>
      <button type="button" class="sv1-tab" id="tabPkg">${esc(t("tabPkg"))}</button>
      <a class="sv1-tab" href="${(ar || lang !== "en" ? "/" + lang : "") + "/trips"}">${esc(t("tabTrip"))}</a>
      <a class="sv1-tab" href="${(ar || lang !== "en" ? "/" + lang : "") + "/hiring"}">${esc(t("tabHire"))}</a>
    </div>

    <div id="paneSvc">
      <div class="sv1-cat-tools">
        <input id="svcQ" class="sv1-cat-q" type="search" placeholder="${esc(t("search"))}" aria-label="${esc(t("search"))}">
      </div>
      <div class="sv1-cat-mode" role="group" aria-label="${esc(t("byField"))} / ${esc(t("byGov"))}">
        <button type="button" class="on" id="modeCat" aria-pressed="true">${esc(t("byField"))}</button>
        <button type="button" id="modeGov" aria-pressed="false">${esc(t("byGov"))}</button>
      </div>
      <div class="sv1-cat-chips" id="svcChips" role="group"></div>
      <p class="sv1-muted sv1-cat-count" id="svcCount" aria-live="polite"></p>
      <div class="sv1-cat-grid" id="svcList"></div>
      <div class="sv1-cat-morewrap"><button type="button" class="sv1-btn sm sv1-hide" id="svcMore">${esc(t("more"))}</button></div>
    </div>

    <div id="panePkg" class="sv1-hide">
      <p class="sv1-muted" style="text-align:center;max-width:640px;margin:0 auto 18px">${esc(t("pkgNote"))}</p>
      <div id="pkgList"></div>
    </div>

    <div class="sv1-panel sv1-cat-ask">
      <h4>${esc(t("ask"))}</h4>
      <a class="sv1-btn primary sm" href="${ar || lang !== "en" ? "/" + lang + "/" : "/"}#advisor">${esc(t("askCta"))}</a>
    </div>
  </div></section>
  </main>
  <div class="sv1-tray sv1-hide" id="svcTray"><div class="wrap">
    <span id="trayCount"></span>
    <div class="acts">
      <button type="button" class="sv1-btn sm" id="trayClear">${esc(t("clear"))}</button>
      <button type="button" class="sv1-btn primary sm" id="trayGo">${esc(t("start"))}</button>
    </div>
  </div></div>
${SV1.footer()}`;

  const CSS = `<style id="sv1-cat-css">
.sv1-cat-journey{display:flex;align-items:center;gap:14px;flex-wrap:wrap;justify-content:center;background:var(--soft);border:1px solid var(--l);border-radius:14px;padding:12px 16px;margin-bottom:22px}
.sv1-cat-journey .lbl{font-size:12px;color:var(--mut);font-weight:700}
.sv1-cat-journey ol{list-style:none;display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0;counter-reset:j}
.sv1-cat-journey li{counter-increment:j;font-size:11.5px;color:var(--ink);background:#fff;border:1px solid var(--l);border-radius:999px;padding:5px 11px;font-weight:600}
.sv1-cat-journey li::before{content:counter(j) " · ";color:var(--mut);font-weight:700}
.sv1-cat-tools{display:flex;gap:8px;align-items:center;margin-bottom:12px}
.sv1-cat-q{flex:1;min-width:0;border:1px solid var(--l);border-radius:12px;padding:13px 15px;font:inherit;font-size:16px;outline:none;background:#fff}
.sv1-cat-q:focus{border-color:var(--n)}
.sv1-cat-mode{display:flex;gap:6px;margin-bottom:10px}
.sv1-cat-mode button{flex:1;min-height:44px;border:1px solid var(--l);background:#fff;border-radius:10px;font:inherit;font-size:13px;font-weight:600;color:var(--mut);cursor:pointer}
.sv1-cat-mode button.on{background:var(--acSoft);color:var(--ac);border-color:var(--acLine)}
.sv1-cat-chips{display:flex;gap:8px;overflow-x:auto;max-width:100%;padding:2px 0 8px;margin-bottom:4px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.sv1-cat-chips::-webkit-scrollbar{display:none}
.sv1-cat-chips button{flex:none;min-height:44px;border:1px solid var(--l);background:#fff;border-radius:999px;padding:0 15px;font:inherit;font-size:13px;color:var(--ink);cursor:pointer;white-space:nowrap}
.sv1-cat-chips button small{color:var(--mut);font-size:11px;margin-inline-start:6px}
.sv1-cat-chips button.on{background:var(--ac);border-color:var(--ac);color:#fff}
.sv1-cat-chips button.on small{color:rgba(255,255,255,.75)}
.sv1-cat-count{font-size:12px;margin:0 0 10px}
.sv1-cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:10px}
.sv1-svc{border:1px solid var(--l);border-radius:14px;background:#fff;padding:14px;display:flex;flex-direction:column;gap:8px;min-width:0}
.sv1-svc.on{border-color:var(--ac);background:#f6f8fd}
.sv1-svc h3{margin:0;font-size:15px;line-height:1.6;color:var(--ink);font-weight:600;overflow-wrap:anywhere}
.sv1-svc .meta{display:grid;gap:3px;font-size:12px;color:var(--mut)}
.sv1-svc .meta b{color:var(--s);font-weight:600}
.sv1-svc .cat{font-size:11px;color:var(--mut)}
.sv1-svc .pr{display:grid;gap:2px;border-top:1px dashed var(--l);padding-top:8px}
.sv1-svc .pr b{font-size:15px;font-weight:600;color:var(--ink);font-family:var(--fm)}
.sv1-svc .pr small{font-size:11px;color:var(--mut);line-height:1.6}
.sv1-svc .acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:auto;padding-top:4px}
.sv1-svc .acts .sv1-btn{min-height:44px;flex:1 1 auto;justify-content:center}
.sv1-svc .acts .ask{flex:1 1 100%}
.sv1-svc .acts a.sv1-btn{text-decoration:none;display:inline-flex;align-items:center}
.sv1-cat-morewrap{text-align:center;margin-top:14px}
.sv1-cat-morewrap .sv1-btn{min-height:44px;padding-inline:24px}
.sv1-tray{position:sticky;bottom:0;z-index:25;background:var(--n);color:#fff;box-shadow:0 -8px 24px rgba(11,27,90,.22)}
.sv1-tray .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 22px}
.sv1-tray #trayCount{font-weight:700;font-size:13.5px}
.sv1-tray .acts{display:flex;gap:8px}
.sv1-tray .sv1-btn{border-color:rgba(255,255,255,.35);background:transparent;color:#fff}
.sv1-tray .sv1-btn.primary{background:#fff;color:var(--n);border-color:#fff}
/* شريط الاختيار يجلس فوق زر واتساب العائم؛ يُرفع الزر ما دام الشريط ظاهراً. */
body.sv1-tray-on .sv1-wa-fab{bottom:78px}
.sv1-pkg{border:1px solid var(--l);border-radius:16px;background:#fff;padding:20px;display:flex;flex-direction:column;gap:10px}
.sv1-pkg h3{font-size:17px;margin:0}
.sv1-pkg .grp{font-size:11px;color:var(--mut);font-weight:700}
.sv1-pkg .amt{font-size:21px;font-weight:500;color:var(--ink);font-family:var(--fm)}
.sv1-pkg ul{margin:0;padding-inline-start:18px;display:grid;gap:5px}
.sv1-pkg li{font-size:12.5px;color:var(--s);line-height:1.65}
.sv1-pkg .sv1-btn{margin-top:auto}
.sv1-pkg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
.sv1-pkg-h{font-size:14px;margin:22px 0 10px;color:var(--ink)}
.sv1-cat-ask{margin-top:30px;text-align:center}
.sv1-cat-ask h4{margin:0 0 10px;color:var(--ink);font-size:15px}
@media(max-width:600px){.sv1-cat-journey{display:none}.sv1-tray .wrap{padding:10px 14px}.sv1-tray #trayCount{font-size:12.5px}.sv1-tabs{gap:6px}.sv1-tabs .sv1-tab{flex:1;padding:11px 6px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;box-sizing:border-box}}
/* داخل التطبيق: شريط التبويب السفلي ثابت فوق كل شيء، فيجلس شريط الاختيار فوقه لا تحته. */
html.bp-native .sv1-tray{bottom:calc(64px + max(env(safe-area-inset-bottom,0px),var(--safe-area-inset-bottom,0px)))}
html.bp-native body.sv1-tray-on .sv1-wa-fab{bottom:calc(136px + max(env(safe-area-inset-bottom,0px),var(--safe-area-inset-bottom,0px)))!important}
html.bp-native .sv1-cat-ask{margin-bottom:12px}
</style>`;

  const script = `<script>
(function(){
var SVCS=${JSON.stringify(services)},CATS=${JSON.stringify(cats)},GOVS=${JSON.stringify(govs)},PKGS=${JSON.stringify(packages)},LANG=${JSON.stringify(lang)};
var TX=${JSON.stringify({ none: t("none"), picked: t("picked"), svcWord: t("svcWord"), pkgAsk: t("pkgAsk"), monthly: t("monthly"), details: t("details"), all: t("all"), govLbl: t("govLbl"), askSvc: t("askSvc"), add: t("add"), added: t("added"), more: t("more"), shown: t("shown"), svcCount: t("svcCount"), vat: t("vat"), govFee: t("govFee"), askQ: t("askQ") })};
var HOME=${JSON.stringify(lang === "en" ? "/" : "/" + lang + "/")};
var $=function(id){return document.getElementById(id)};
var list=$('svcList'),q=$('svcQ'),tray=$('svcTray'),cnt=$('trayCount');
var picked=[];   // [{code,title,why,door}]
function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}
function isPicked(code,name){return picked.some(function(p){return p.code===code&&p.title===name})}
function drawTray(){
 if(!picked.length){tray.classList.add('sv1-hide');document.body.classList.remove('sv1-tray-on');return}
 tray.classList.remove('sv1-hide');document.body.classList.add('sv1-tray-on');
 cnt.textContent=TX.picked+' '+picked.length+' '+TX.svcWord;
}
function toggle(s,on){
 if(on){if(!isPicked(s.code,s.name))picked.push({code:s.code,title:s.name,why:s.gov||'',door:s.door})}
 else picked=picked.filter(function(p){return !(p.code===s.code&&p.title===s.name)});
 drawTray();
}
// التسليم إلى محادثة الصفحة الرئيسية: البنود المختارة تصير نطاق الطلب، والباب
// يُختار بالأغلبية حتى يفتح المستشار في السياق الذي يخدم أكثر ما اختير.
function handoff(items,door,text){
 try{sessionStorage.setItem('bp_sva_request',JSON.stringify({items:items,door:door,text:text,name:items[0]&&items[0].title,code:items[0]&&items[0].code,at:Date.now()}))}catch(e){}
 location.href=HOME+'#advisor';
}
function go(){
 if(!picked.length)return;
 var tally={};picked.forEach(function(p){tally[p.door]=(tally[p.door]||0)+1});
 var door=Object.keys(tally).sort(function(a,b){return tally[b]-tally[a]})[0]||'consulting';
 handoff(picked.map(function(p){return {code:p.code,title:p.title,why:p.why}}),door,picked.map(function(p){return p.title}).join('، '));
}
// ---- التصفية: وضعان على الحقلين الحقيقيين في الكتالوج — القطاع أو الجهة.
var PAGE=24,limit=PAGE,mode='cat',sel='';
var chipsBox=$('svcChips'),cntEl=$('svcCount'),moreBtn=$('svcMore');
function drawChips(){
 chipsBox.innerHTML='';
 var src=mode==='cat'?CATS:GOVS;
 function chip(label,n,val){
  var b=el('button',null,label);b.type='button';
  if(n!=null)b.appendChild(el('small',null,String(n)));
  var on=(sel===val);b.classList.toggle('on',on);b.setAttribute('aria-pressed',on?'true':'false');
  b.onclick=function(){sel=val;limit=PAGE;drawChips();draw()};
  chipsBox.appendChild(b)}
 chip(TX.all,SVCS.length,'');
 src.forEach(function(x){chip(x.k,x.n,x.k)});
}
function setMode(m){
 mode=m;sel='';limit=PAGE;
 $('modeCat').classList.toggle('on',m==='cat');$('modeCat').setAttribute('aria-pressed',m==='cat'?'true':'false');
 $('modeGov').classList.toggle('on',m==='gov');$('modeGov').setAttribute('aria-pressed',m==='gov'?'true':'false');
 drawChips();draw();
}
$('modeCat').onclick=function(){setMode('cat')};
$('modeGov').onclick=function(){setMode('gov')};
// «اسأل المستشار»: يستعمل آلية التسليم القائمة نفسها (bp_sva_request) فتُفتح
// المحادثة في «/» والسؤال أول رسالة فيها.
function askAbout(s){handoff([{code:s.code,title:s.name,why:s.gov||''}],s.door,TX.askQ.replace('{n}',s.name))}
function card(s){
 var c=el('article','sv1-svc');
 if(isPicked(s.code,s.name))c.classList.add('on');
 c.appendChild(el('h3',null,s.name));
 var meta=el('div','meta');
 if(s.gov){var g=el('span');g.appendChild(el('b',null,TX.govLbl+': '));g.appendChild(document.createTextNode(s.gov));meta.appendChild(g)}
 if(s.cat)meta.appendChild(el('span','cat',s.cat));
 c.appendChild(meta);
 // ‏كل ما يخص السعر داخل .price-amt: القاعدة العامة تخفيه عن الزائر كاملاً
 // (SHOW_PRICES=false) فلا يبقى رقمٌ ولا تلميحٌ بالسعر.
 if(s.price){
  var pr=el('div','pr price-amt');pr.appendChild(el('b',null,s.price));
  if(s.hasAmt)pr.appendChild(el('small',null,TX.vat+(s.govFees?' · '+TX.govFee:'')));
  c.appendChild(pr)}
 var acts=el('div','acts');
 var ask=el('button','sv1-btn primary sm ask',TX.askSvc);ask.type='button';ask.onclick=function(){askAbout(s)};
 acts.appendChild(ask);
 var add=el('button','sv1-btn sm',isPicked(s.code,s.name)?TX.added:TX.add);add.type='button';
 add.setAttribute('aria-pressed',isPicked(s.code,s.name)?'true':'false');
 add.onclick=function(){var on=!isPicked(s.code,s.name);toggle(s,on);c.classList.toggle('on',on);add.textContent=on?TX.added:TX.add;add.setAttribute('aria-pressed',on?'true':'false')};
 acts.appendChild(add);
 if(s.slug){var a=document.createElement('a');a.className='sv1-btn sm';a.href=HOME+'services/'+s.slug;a.textContent=TX.details;acts.appendChild(a)}
 c.appendChild(acts);
 return c}
function draw(){
 var f=(q.value||'').trim().toLowerCase();
 var hits=SVCS.filter(function(s){
  if(sel&&(mode==='cat'?s.cat:s.gov)!==sel)return false;
  return !f||(s.name+' '+s.code+' '+s.cat+' '+s.gov).toLowerCase().indexOf(f)>=0});
 list.innerHTML='';
 hits.slice(0,limit).forEach(function(s){list.appendChild(card(s))});
 if(!hits.length)list.appendChild(el('p','sv1-muted',TX.none));
 cntEl.textContent=hits.length?(Math.min(limit,hits.length)+' '+TX.shown+' '+hits.length+' '+TX.svcCount):'';
 moreBtn.classList.toggle('sv1-hide',hits.length<=limit);
}
q.addEventListener('input',function(){limit=PAGE;draw()});
moreBtn.onclick=function(){limit+=PAGE;draw()};
$('trayClear').onclick=function(){picked=[];drawTray();draw()};
$('trayGo').onclick=go;

// ---- الباقات
var pkgBox=$('pkgList');
function drawPkgs(){
 pkgBox.innerHTML='';
 var seen=[];
 PKGS.forEach(function(p){if(seen.indexOf(p.group)<0)seen.push(p.group)});
 seen.forEach(function(gname){
  if(gname)pkgBox.appendChild(el('h3','sv1-pkg-h',gname));
  var grid=el('div','sv1-pkg-grid');
  PKGS.filter(function(p){return p.group===gname}).forEach(function(p){
   var c=el('div','sv1-pkg');
   c.appendChild(el('h3',null,p.name));
   if(p.price!=null){
    // صنف price-amt: القاعدة العامة تخفيه عن الزائر وتظهره للعميل المسجَّل.
    var amt=el('div','amt price-amt',Number(p.price).toLocaleString('en-US')+' ﷼'+(p.period?' / '+p.period:''));
    c.appendChild(amt)}
   if(p.features.length){var ul=el('ul');p.features.forEach(function(x){ul.appendChild(el('li',null,x))});c.appendChild(ul)}
   var b=el('button','sv1-btn primary sm',TX.pkgAsk);b.type='button';
   b.onclick=function(){handoff([{code:p.code,title:p.name,why:p.group||''}],'consulting',p.name)};
   c.appendChild(b);
   grid.appendChild(c)});
  pkgBox.appendChild(grid)});
}
$('tabSvc').onclick=function(){this.classList.add('on');$('tabPkg').classList.remove('on');$('paneSvc').classList.remove('sv1-hide');$('panePkg').classList.add('sv1-hide')};
$('tabPkg').onclick=function(){this.classList.add('on');$('tabSvc').classList.remove('on');$('panePkg').classList.remove('sv1-hide');$('paneSvc').classList.add('sv1-hide')};
drawChips();draw();drawPkgs();drawTray();
if(/[?&]tab=packages/.test(location.search))$('tabPkg').click();
})();</script>`;

  return SV1.shell({
    title: `${t("title")} — Business Partner`,
    desc: t("desc"),
    path: "/catalog",
    body: CSS + body,
    script,
  });
}
