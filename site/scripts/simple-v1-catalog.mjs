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
// وللجاهز منها مسارٌ مباشر بلا محادثة: «أضف للسلة» لكل بندٍ له سعر في الكتالوج،
// ثم /cart ثم /checkout والدفع الإلكتروني. العقد هو عقد صفحات الخدمات القديمة
// حرفاً بحرف: `localStorage.bp_cart` — عنصرٌ بمفتاح `svc-<sku>`، و`amount` رقم
// و`price` نصّ عرض فارغ، وتكرار الإضافة يزيد `qty` لا يضيف سطراً. وشرط الظهور
// هو شرط القديم نفسه (`generate.mjs`): للبند سعرٌ، وليس عقاراً ولا سياحة. ما
// سواه يحتاج عرضاً مخصّصاً فيبقى «ابدأ طلبك».
//
// الأسعار لا تظهر للزائر: سياسة المالك أن الكتالوج وأسعاره في الخلفية. سعر
// الباقة يحمل صنف `price-amt` الذي تخفيه قاعدة `html[data-prices="off"]`
// العامة، فيراه العميل المسجَّل ولا يراه الزائر — قاعدة واحدة لا استثناء لها.
import fs from "node:fs";
import path from "node:path";
import { visibleCatalogRows } from "./hidden.mjs";

const T = {
  title:  { ar: "الخدمات والباقات", en: "Services & packages", fr: "Services et forfaits", zh: "服务与套餐" },
  desc:   { ar: "كل ما ننفّذه — مرتّباً بالمجال. أشّر على ما تحتاجه وابدأ طلبك بها كلها، أو أضف الجاهز منها إلى السلة وادفع إلكترونياً.",
            en: "Everything we deliver, grouped by field. Tick what you need and start one request with all of it — or add ready-priced services to your cart and pay online.",
            fr: "Tout ce que nous réalisons, par domaine. Cochez vos besoins et lancez une seule demande — ou ajoutez les services au tarif fixe au panier et payez en ligne.",
            zh: "我们提供的全部服务，按领域分类。勾选所需项目，一次性发起申请；定价明确的服务也可直接加入购物车并在线支付。" },
  tabSvc: { ar: "الخدمات", en: "Services", fr: "Services", zh: "服务" },
  tabPkg: { ar: "الباقات", en: "Packages", fr: "Forfaits", zh: "套餐" },
  tabTrip:{ ar: "الرحلات", en: "Trips", fr: "Voyages", zh: "行程" },
  tabHire:{ ar: "التوظيف", en: "Hiring", fr: "Recrutement", zh: "招聘" },
  addCart: { ar: "أضف للسلة", en: "Add to cart", fr: "Ajouter au panier", zh: "加入购物车" },
  addPicked: { ar: "أضف المختار للسلة", en: "Add selected to cart", fr: "Ajouter la sélection au panier", zh: "将所选加入购物车" },
  added:  { ar: "أُضيف ✓", en: "Added ✓", fr: "Ajouté ✓", zh: "已加入 ✓" },
  addedToast: { ar: "أُضيف إلى السلة", en: "Added to your cart", fr: "Ajouté à votre panier", zh: "已加入购物车" },
  addedN: { ar: "أُضيف {n} إلى السلة", en: "{n} added to your cart", fr: "{n} ajouté(s) à votre panier", zh: "已将 {n} 项加入购物车" },
  viewCart: { ar: "عرض السلة ←", en: "View cart →", fr: "Voir le panier →", zh: "查看购物车 →" },
  cartFail: { ar: "تعذّر حفظ السلة في هذا المتصفح. ابدأ طلبك بالمحادثة بدلاً من ذلك.",
              en: "Your browser could not save the cart. Start a request in the chat instead.",
              fr: "Ce navigateur n'a pas pu enregistrer le panier. Lancez plutôt une demande dans le chat.",
              zh: "此浏览器无法保存购物车。请改为在对话中发起申请。" },
  custom: { ar: "بعرض سعر مخصّص", en: "Custom quote", fr: "Devis sur mesure", zh: "定制报价" },
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
  openAll:{ ar: "افتح الكل", en: "Expand all", fr: "Tout ouvrir", zh: "全部展开" },
  closeAll:{ar: "اطوِ الكل", en: "Collapse all", fr: "Tout fermer", zh: "全部收起" },
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

// ‏فئات الكتالوج (بالإنجليزية كما في catalog.json) التي لا تُباع بالسلة.
const NO_CART = new Set(["Real Estate", "Tourism"]);

export function buildSimpleCatalog(SV1, ctx) {
  const lang = ctx.lang();
  const t = (k) => (T[k][lang] != null ? T[k][lang] : T[k].en);
  const esc = ctx.esc;
  const catLabel = ctx.catLabel;
  const govLabel = ctx.govLabel;
  const ar = lang === "ar";

  let raw = { services: [], packages: [] };
  try { raw = JSON.parse(fs.readFileSync(path.resolve("site/assets/data/catalog.json"), "utf8")); } catch {}
  // ‏catalog.json يُكتب في آخر المولّد، وهذه الصفحة تُبنى قبله — فتقرأ نسخة
  // البناء السابق. الإخفاء (site/data/hidden.json) يُطبَّق هنا أيضاً حتى لا
  // يتأخر بناءٍ كاملاً عن الكتالوج.
  raw = { ...raw, services: visibleCatalogRows(raw.services || []), packages: visibleCatalogRows(raw.packages || []) };

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
    door: DOOR[s.categoryAr] || "consulting",
    // ‏قابل للشراء المباشر؟ الشرط نفسه في صفحة الخدمة القديمة (generate.mjs):
    // سعرٌ في الكتالوج، وليس عقاراً ولا سياحة. الحقول بصيغة عنصر السلة القديمة؛
    // `amount` هو الرقم الذي يُحسب منه كل شيء.
    buy: s.amount != null && Number(s.amount) > 0 && !NO_CART.has(s.category)
      ? { id: "svc-" + (s.code || "").toLowerCase(), nameAr: s.nameAr || s.nameEn || "",
          nameEn: s.nameEn || s.nameAr || "", amount: Number(s.amount) }
      : null,
  })).filter((s) => s.name);

  const groups = [];
  for (const s of services) {
    let g = groups.find((x) => x.cat === s.cat);
    if (!g) { g = { cat: s.cat || "—", items: [] }; groups.push(g); }
    g.items.push(s);
  }

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
        <button type="button" class="sv1-btn sm ghost" id="svcToggleAll">${esc(t("openAll"))}</button>
      </div>
      <div id="svcList"></div>
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
      <button type="button" class="sv1-btn sm sv1-hide" id="trayCart" data-track="أضف المختار للسلة">${esc(t("addPicked"))}</button>
      <button type="button" class="sv1-btn primary sm" id="trayGo">${esc(t("start"))}</button>
    </div>
  </div></div>
  <div class="sv1-cat-toast sv1-hide" id="catToast" role="status" aria-live="polite"><span id="catToastTx"></span><a id="catToastCart" href="${(ar || lang !== "en" ? "/" + lang : "") + "/cart"}">${esc(t("viewCart"))}</a></div>
${SV1.footer()}`;

  const CSS = `<style id="sv1-cat-css">
.sv1-cat-journey{display:flex;align-items:center;gap:14px;flex-wrap:wrap;justify-content:center;background:var(--soft);border:1px solid var(--l);border-radius:14px;padding:12px 16px;margin-bottom:22px}
.sv1-cat-journey .lbl{font-size:12px;color:var(--mut);font-weight:700}
.sv1-cat-journey ol{list-style:none;display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0;counter-reset:j}
.sv1-cat-journey li{counter-increment:j;font-size:11.5px;color:var(--ink);background:#fff;border:1px solid var(--l);border-radius:999px;padding:5px 11px;font-weight:600}
.sv1-cat-journey li::before{content:counter(j) " · ";color:var(--mut);font-weight:700}
.sv1-cat-tools{display:flex;gap:8px;align-items:center;margin-bottom:16px}
.sv1-cat-q{flex:1;border:1px solid var(--l);border-radius:12px;padding:13px 15px;font:inherit;font-size:15px;outline:none;background:#fff}
.sv1-cat-q:focus{border-color:var(--n)}
.sv1-grp{border:1px solid var(--l);border-radius:14px;background:#fff;margin-bottom:9px;overflow:hidden}
.sv1-grp>button{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;background:none;border:0;padding:15px 17px;cursor:pointer;font-family:inherit;text-align:start}
.sv1-grp>button b{font-size:14.5px;color:var(--ink);font-weight:500}
.sv1-grp>button .meta{display:flex;align-items:center;gap:10px;color:var(--mut);font-size:12px}
.sv1-grp>button .chev{transition:.2s;display:inline-block}
.sv1-grp.open>button .chev{transform:rotate(180deg)}
.sv1-grp .body{display:none;border-top:1px solid var(--l);padding:8px}
.sv1-grp.open .body{display:block}
.sv1-pick{display:flex;gap:10px;align-items:flex-start;padding:10px 11px;border-radius:10px}
.sv1-pick-lab{display:flex;gap:10px;align-items:flex-start;flex:1;min-width:0;cursor:pointer}
.sv1-pick-more{flex:none;align-self:center;font-size:11.5px;color:var(--ac);text-decoration:none;border:1px solid var(--acLine);border-radius:8px;padding:4px 9px;background:var(--acSoft);white-space:nowrap}
.sv1-pick-more:hover{background:var(--ac);color:#fff;border-color:var(--ac)}
.sv1-pick-add{flex:none;align-self:center;font:inherit;font-size:11.5px;font-weight:600;color:#fff;background:var(--ac);border:1px solid var(--ac);border-radius:8px;padding:4px 10px;cursor:pointer;white-space:nowrap}
.sv1-pick-add:hover{background:#16307F;border-color:#16307F}
.sv1-pick-add.done{background:#fff;color:var(--ac)}
.sv1-pick-custom{flex:none;align-self:center;font-size:11px;color:var(--mut);white-space:nowrap}
.sv1-pick-acts{display:flex;gap:6px;align-items:center;flex:none;align-self:center;flex-wrap:wrap;justify-content:flex-end}
.sv1-cat-toast{position:fixed;inset-inline:0;top:84px;margin-inline:auto;width:max-content;max-width:calc(100vw - 28px);z-index:2147483100;background:var(--ink);color:#fff;border-radius:12px;padding:11px 16px;font-size:13px;font-weight:600;box-shadow:0 10px 28px rgba(11,27,90,.3);display:flex;gap:14px;align-items:center}
.sv1-cat-toast.sv1-hide{display:none}
.sv1-cat-toast a{color:#fff;text-decoration:underline;white-space:nowrap}
.sv1-cat-toast.err{background:#8a1c1c}
.sv1-pick:hover{background:var(--soft)}
.sv1-pick input{margin:2px 0 0;width:17px;height:17px;accent-color:var(--n);flex:none}
.sv1-pick .tx b{display:block;font-size:13.5px;color:var(--ink);font-weight:600;line-height:1.55}
.sv1-pick .tx small{font-size:11.5px;color:var(--mut)}
.sv1-pick.on{background:#eef1f9}
.sv1-grp .badge{background:var(--acSoft);color:var(--ac);border-radius:999px;padding:2px 9px;font-size:11px;font-weight:500;font-family:var(--fm)}
.sv1-tray{position:sticky;bottom:0;z-index:25;background:var(--n);color:#fff;box-shadow:0 -8px 24px rgba(11,27,90,.22)}
.sv1-tray .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 22px}
.sv1-tray #trayCount{font-weight:700;font-size:13.5px}
.sv1-tray .acts{display:flex;gap:8px}
.sv1-tray .sv1-btn{border-color:rgba(255,255,255,.35);background:transparent;color:#fff}
.sv1-tray .sv1-btn.primary{background:#fff;color:var(--n);border-color:#fff}
/* شريط الاختيار يجلس فوق زر واتساب العائم؛ يُرفع الزر ما دام الشريط ظاهراً. */
body.sv1-tray-on .sv1-wa-fab,body.sv1-tray-on .bps-fab{bottom:78px}
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
@media(max-width:600px){.sv1-cat-journey{display:none}.sv1-tray .wrap{padding:10px 14px;flex-wrap:wrap}.sv1-tray #trayCount{font-size:12.5px;flex:1 0 100%}.sv1-tray .acts{flex:1 0 100%}.sv1-tray .acts .sv1-btn{flex:1;padding:9px 6px}.sv1-pick{flex-wrap:wrap}.sv1-pick-lab{flex:1 0 100%}.sv1-pick-acts{margin-inline-start:27px}body.sv1-tray-on .sv1-wa-fab,body.sv1-tray-on .bps-fab{bottom:124px}.sv1-cat-tools .sv1-btn{flex:none}.sv1-cat-q{min-width:0}}
</style>`;

  const script = `<script>
(function(){
var GROUPS=${JSON.stringify(groups)},PKGS=${JSON.stringify(packages)},LANG=${JSON.stringify(lang)};
var TX=${JSON.stringify({ none: t("none"), picked: t("picked"), svcWord: t("svcWord"), openAll: t("openAll"), closeAll: t("closeAll"), pkgAsk: t("pkgAsk"), monthly: t("monthly"), details: t("details"), addCart: t("addCart"), addPicked: t("addPicked"), added: t("added"), addedToast: t("addedToast"), addedN: t("addedN"), cartFail: t("cartFail"), custom: t("custom") })};
var HOME=${JSON.stringify(lang === "en" ? "/" : "/" + lang + "/")};
var $=function(id){return document.getElementById(id)};
var list=$('svcList'),q=$('svcQ'),tray=$('svcTray'),cnt=$('trayCount');
var picked=[];   // [{code,title,why,door,buy}]
function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}
function isPicked(code,name){return picked.some(function(p){return p.code===code&&p.title===name})}
function drawTray(){
 if(!picked.length){tray.classList.add('sv1-hide');document.body.classList.remove('sv1-tray-on');return}
 tray.classList.remove('sv1-hide');document.body.classList.add('sv1-tray-on');
 cnt.textContent=TX.picked+' '+picked.length+' '+TX.svcWord;
 var nb=picked.filter(function(p){return p.buy}).length,tc=$('trayCart');
 tc.classList.toggle('sv1-hide',!nb);
 tc.textContent=TX.addPicked+' ('+nb+')';
}
// ---- السلة: عقد صفحات الخدمات القديمة (main.js: itemFromBtn + add) حرفاً بحرف.
// المفتاح bp_cart، والعنصر بهذه الحقول بهذا الترتيب، و amount رقم و price نصّ
// عرض (فارغ هنا كما في القديم) — لا يُقرأ price رقماً أبداً. تكرار الإضافة
// يزيد qty على السطر نفسه (بالـid) ولا يُضيف سطراً ثانياً.
function cartItem(b){
 return {id:b.id,nameEn:b.nameEn||'',nameAr:b.nameAr||'',amount:b.amount?Number(b.amount):null,price:'',kind:'service',qty:1,
  surchargeAmount:null,surchargeFreeCount:null,pricePublic:0,billingPeriod:'',renewsAt:null,commissionPercent:0};
}
function cartAdd(bs){
 var c;
 try{c=JSON.parse(localStorage.getItem('bp_cart'))||[];if(!Array.isArray(c))c=[]}catch(e){c=[]}
 bs.forEach(function(b){
  var ex=c.filter(function(x){return x.id===b.id})[0];
  if(ex)ex.qty=(ex.qty||1)+1;else c.push(cartItem(b));
 });
 try{localStorage.setItem('bp_cart',JSON.stringify(c))}catch(e){return false}
 // الترويسة تستمع لـ bp:cart على النافذة؛ الحدث الفقّاع يصل المستمعَين (document وwindow).
 // و storage لا يُطلَق في النافذة نفسها.
 try{document.dispatchEvent(new CustomEvent('bp:cart',{bubbles:true}))}catch(e){}
 return true;
}
var toastT=0;
function toast(msg,err,withLink){
 var bx=$('catToast');$('catToastTx').textContent=msg;
 $('catToastCart').style.display=withLink?'':'none';
 bx.classList.toggle('err',!!err);bx.classList.remove('sv1-hide');
 clearTimeout(toastT);toastT=setTimeout(function(){bx.classList.add('sv1-hide')},4200);
}
function addOne(s,btn){
 if(!s.buy)return;
 if(!cartAdd([s.buy])){toast(TX.cartFail,true,false);return}
 if(btn){btn.textContent=TX.added;btn.classList.add('done');setTimeout(function(){btn.textContent=TX.addCart;btn.classList.remove('done')},1600)}
 toast(TX.addedToast,false,true);
}
function addPicked(){
 var items=picked.filter(function(p){return p.buy});
 if(!items.length)return;
 if(!cartAdd(items.map(function(p){return p.buy}))){toast(TX.cartFail,true,false);return}
 // ما دخل السلة يخرج من الاختيار؛ ما بقي (يحتاج عرضاً مخصّصاً) يبقى لـ«ابدأ طلبك بها».
 picked=picked.filter(function(p){return !p.buy});
 drawTray();draw();
 toast(TX.addedN.replace('{n}',items.length),false,true);
}
function toggle(s,on){
 if(on){if(!isPicked(s.code,s.name))picked.push({code:s.code,title:s.name,why:s.gov||'',door:s.door,buy:s.buy})}
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
function draw(){
 var f=(q.value||'').trim().toLowerCase();
 list.innerHTML='';
 var any=false;
 GROUPS.forEach(function(g){
  var hits=g.items.filter(function(s){return !f||(s.name+' '+s.code+' '+s.cat+' '+s.gov).toLowerCase().indexOf(f)>=0});
  if(!hits.length)return;
  any=true;
  var box=el('div','sv1-grp');
  // البحث يفتح ما طابق: نتيجةٌ مخبّأة خلف عنوان مطويّ ليست نتيجة.
  if(f)box.classList.add('open');
  var head=el('button');head.type='button';
  var left=el('span');left.appendChild(el('b',null,g.cat));
  var meta=el('span','meta');
  meta.appendChild(el('span','badge',String(hits.length)));
  meta.appendChild(el('span','chev','⌄'));
  head.appendChild(left);head.appendChild(meta);
  head.onclick=function(){box.classList.toggle('open')};
  var body=el('div','body');
  hits.forEach(function(s){
   var row=el('div','sv1-pick');
   var lab=document.createElement('label');lab.className='sv1-pick-lab';
   var cb=document.createElement('input');cb.type='checkbox';cb.checked=isPicked(s.code,s.name);
   if(cb.checked)row.classList.add('on');
   cb.onchange=function(){row.classList.toggle('on',cb.checked);toggle(s,cb.checked)};
   var tx=el('span','tx');tx.appendChild(el('b',null,s.name));
   if(s.gov)tx.appendChild(el('small',null,s.gov));
   lab.appendChild(cb);lab.appendChild(tx);
   row.appendChild(lab);
   var acts=el('span','sv1-pick-acts');
   if(s.buy){var ab=el('button','sv1-pick-add',TX.addCart);ab.type='button';
    ab.setAttribute('data-track','أضف للسلة');
    ab.onclick=function(e){e.stopPropagation();addOne(s,ab)};acts.appendChild(ab)}
   else acts.appendChild(el('span','sv1-pick-custom',TX.custom));
   if(s.slug){var a=document.createElement('a');a.className='sv1-pick-more';
    a.href=HOME+'services/'+s.slug;a.textContent=TX.details;
    a.onclick=function(e){e.stopPropagation()};acts.appendChild(a)}
   row.appendChild(acts);
   body.appendChild(row)});
  box.appendChild(head);box.appendChild(body);
  list.appendChild(box)});
 if(!any)list.appendChild(el('p','sv1-muted',TX.none));
}
q.addEventListener('input',draw);
$('svcToggleAll').onclick=function(){
 var boxes=list.querySelectorAll('.sv1-grp');
 var open=list.querySelectorAll('.sv1-grp.open').length>=boxes.length/2;
 Array.prototype.forEach.call(boxes,function(b){b.classList.toggle('open',!open)});
 this.textContent=open?TX.openAll:TX.closeAll;
};
$('trayClear').onclick=function(){picked=[];drawTray();draw()};
$('trayGo').onclick=go;
$('trayCart').onclick=addPicked;

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
draw();drawPkgs();drawTray();
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
