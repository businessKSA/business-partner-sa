// Business Partner — Simple V1: فهرس الخدمات (/services).
//
// كانت الصفحة صفحةً قديمة بطول ٦٥ ألف بكسل على الجوال: ١٩٥ بطاقة في تمريرة
// واحدة تحت غلاف «B10X» وبطاقات مستشارين وتسعة عناوين تصنيف، ثم طبقاتٌ
// تُحقن بعد البناء (`b10x-services-catalog-v2.mjs`) وبلا أيٍّ من عادات
// الموقع الجديد. صارت داخل `SV1.shell()` كبقية الموقع الجديد:
//
//   ترويسة قصيرة ← بحث ← تصفية بالتصنيف وبنوع الشراء ← بطاقات مرقّمة (١٢ في
//   الصفحة، ٨ على الجوال) ← تصنيفات كروابط ← «اشرح احتياجك».
//
// القواعد التي تُحمل حرفاً من صفحتَي التصنيف والخدمة (فلا تخالف البطاقةُ صفحتَها):
//  • مسعّرة = `priced` نفسها (سعرٌ في الكتالوج وليست عقاراً ولا سياحة): بسعرها
//    وزرّ «أضف إلى السلة» ← `localStorage.bp_cart` ثم /cart؛ ومعها «اطلب عرض
//    سعر» إن كانت `requiresProposal`. غير المسعّرة: «تحتاج عرض سعر» وزرّها عرض
//    السعر (أو «اطلب مساحة عمل» لخدمات المساحات). لا رقمَ يُخترع.
//  • «اطلب عرض سعر» يسلّم الخدمة إلى محادثة الرئيسية بـ`bp_sva_request`، ومنها
//    تكمل الرحلة إلى /my: نطاق ← عرض ← عقد ← دفع ← فاتورة. لا رابطَ إلى القديم.
//  • سياسة الأسعار: الرقم بصنف `price-amt` فتخفيه القاعدة العامة عن الزائر
//    وتُظهره للمسجَّل (SHOW_PRICES=false)، ويظهر للزائر `data-guest-note`.
//    والسعر الحيّ من `live-prices.js` عبر `data-bp-price`.
//  • لا زرّ واتساب داخل المحتوى — الزرّ العائم في تذييل SV1 وحده.
//  • كل البطاقات في الـHTML (للفهرسة ولمن يعطّل JS)؛ الترقيم يخفي ما عدا
//    الصفحة الحالية، و`<noscript>` يُظهرها كلها.
//
// الحالة في الرابط: ?cat=<slug>&t=cart|quote&q=<كلمات>&p=<رقم> — صفحة قابلة للمشاركة.

const T = {
  title:     { ar: "الخدمات", en: "Services", fr: "Services", zh: "服务" },
  lead:      { ar: "ابحث أو اختر التصنيف. أضف الخدمة المسعّرة إلى السلة وادفع إلكترونياً، أو اطلب عرض سعر لحالتك.",
               en: "Search or pick a category. Add a priced service to your cart and pay online, or request a quotation for your case.",
               fr: "Recherchez ou choisissez une catégorie. Ajoutez un service au tarif affiché au panier et payez en ligne, ou demandez un devis.",
               zh: "搜索或选择分类。定价明确的服务可直接加入购物车并在线支付，也可为您的情况申请报价。" },
  note:      { ar: "الأسعار لا تشمل ضريبة القيمة المضافة 15٪ (تُضاف سطراً مستقلاً ثم الإجمالي شاملاً)، والرسوم الحكومية مستثناة وتُسدَّد للجهات بالتكلفة الفعلية.",
               en: "Prices exclude 15% VAT (added as its own line, then the total including VAT). Government fees are excluded and paid to the authorities at actual cost.",
               fr: "Prix hors TVA 15 % (ajoutée sur une ligne distincte, puis total TTC). Les frais gouvernementaux sont exclus et réglés aux autorités au coût réel.",
               zh: "价格不含 15% 增值税（单列一行，随后为含税总额）。政府规费不含在内，按实际费用向相关机构缴纳。" },
  home:      { ar: "الرئيسية", en: "Home", fr: "Accueil", zh: "首页" },
  svcWord:   { ar: "خدمة", en: "services", fr: "services", zh: "项服务" },
  catWord:   { ar: "تصنيفات", en: "categories", fr: "catégories", zh: "个分类" },
  search:    { ar: "ابحث: إقامة، رخصة، سجل تجاري، توظيف…", en: "Search: visa, licence, registration, hiring…",
               fr: "Rechercher : visa, licence, registre, recrutement…", zh: "搜索：签证、许可、注册、招聘…" },
  all:       { ar: "الكل", en: "All", fr: "Tout", zh: "全部" },
  kindAll:   { ar: "كل الأنواع", en: "All types", fr: "Tous types", zh: "全部类型" },
  kindCart:  { ar: "جاهزة للسلة", en: "Ready for cart", fr: "Prêts pour le panier", zh: "可直接加购" },
  kindQuote: { ar: "بعرض سعر", en: "By quotation", fr: "Sur devis", zh: "需报价" },
  showing:   { ar: "يعرض {a}–{b} من {n} خدمة", en: "Showing {a}–{b} of {n} services", fr: "{a}–{b} sur {n} services", zh: "显示第 {a}–{b} 项，共 {n} 项服务" },
  none:      { ar: "لا نتيجة بهذه الكلمة. جرّب كلمة أعمّ أو امسح التصفية.", en: "Nothing matched. Try a broader word or clear the filters.",
               fr: "Aucun résultat. Essayez un terme plus large ou effacez les filtres.", zh: "没有匹配项。请尝试更宽泛的词或清除筛选。" },
  clear:     { ar: "امسح التصفية", en: "Clear filters", fr: "Effacer les filtres", zh: "清除筛选" },
  prev:      { ar: "السابق", en: "Previous", fr: "Précédent", zh: "上一页" },
  next:      { ar: "التالي", en: "Next", fr: "Suivant", zh: "下一页" },
  page:      { ar: "الصفحة", en: "Page", fr: "Page", zh: "页码" },
  catPage:   { ar: "صفحة التصنيف ←", en: "Category page →", fr: "Page de la catégorie →", zh: "分类页面 →" },
  fee:       { ar: "أتعاب الخدمة", en: "Service fee", fr: "Honoraires", zh: "服务费" },
  guest:     { ar: "سجّل الدخول لعرض الأتعاب", en: "Sign in to see the fee", fr: "Connectez-vous pour voir les honoraires", zh: "登录后查看服务费" },
  needQuote: { ar: "تحتاج عرض سعر", en: "Needs a quotation", fr: "Sur devis", zh: "需报价" },
  addCart:   { ar: "أضف إلى السلة", en: "Add to cart", fr: "Ajouter au panier", zh: "加入购物车" },
  added:     { ar: "أُضيف ✓", en: "Added ✓", fr: "Ajouté ✓", zh: "已加入 ✓" },
  addedToast:{ ar: "أُضيفت الخدمة إلى السلة", en: "Added to your cart", fr: "Ajouté à votre panier", zh: "已加入购物车" },
  viewCart:  { ar: "عرض السلة ←", en: "View cart →", fr: "Voir le panier →", zh: "查看购物车 →" },
  cartFail:  { ar: "تعذّر حفظ السلة في هذا المتصفح. اطلب عرض سعر بدلاً من ذلك.",
               en: "Your browser could not save the cart. Request a quotation instead.",
               fr: "Ce navigateur n'a pas pu enregistrer le panier. Demandez plutôt un devis.",
               zh: "此浏览器无法保存购物车。请改为申请报价。" },
  quote:     { ar: "اطلب عرض سعر", en: "Request a quotation", fr: "Demander un devis", zh: "申请报价" },
  workspace: { ar: "اطلب مساحة عمل", en: "Request a workspace", fr: "Demander un espace de travail", zh: "申请办公空间" },
  details:   { ar: "التفاصيل ←", en: "Details →", fr: "Détails →", zh: "详情 →" },
  browse:    { ar: "تصفّح بالتصنيف", en: "Browse by category", fr: "Parcourir par catégorie", zh: "按分类浏览" },
  pkg:       { ar: "تبحث عن باقات بأسعار واضحة؟", en: "Looking for fixed-price bundles?", fr: "Des forfaits à prix fixe ?", zh: "想要明码标价的套餐？" },
  pkgCta:    { ar: "استعرض الباقات", en: "View packages", fr: "Voir les forfaits", zh: "查看套餐" },
  ask:       { ar: "محتار أي خدمة تناسبك؟", en: "Not sure which service fits?", fr: "Quel service choisir ?", zh: "不确定哪项服务适合您？" },
  askCta:    { ar: "اشرح احتياجك في المحادثة", en: "Describe your need in the chat", fr: "Décrivez votre besoin", zh: "在对话中描述您的需求" },
};

// ‏الباب الذي يفتحه المستشار لكل تصنيف — نسخة من خريطة صفحة الخدمة والتصنيف
// حتى لا يفتح الزرّ نفسه بابين مختلفين.
const DOOR = {
  "Company Formation": "formation", "Foreign Investment": "formation",
  "Government Relations": "government", "Recruitment": "government",
  "HR Services": "government", "Premium Residency": "government",
};

// view = { cats: [{ key, slug, label, href, count }], items: [...], seoDesc, liveV }
// item = { code, slug, href, name, nameEn, nameAr, gov, catKey, catSlug, catLabel, priced, amount,
//          priceLabel, requiresProposal, special: ""|"workspace"|"tourism", cartId, workspaceHref }
export function buildSimpleServicesHub(SV1, ctx, view) {
  const lang = ctx.lang();
  const esc = ctx.esc;
  const t = (k) => (T[k][lang] != null ? T[k][lang] : T[k].en);
  const home = lang === "en" ? "/" : "/" + lang + "/";
  const total = view.items.length;
  const PAGE = 12;

  const card = (s, i) => {
    let price, acts = "";
    if (s.priced) {
      price = `<span class="sv1-sh-lbl">${esc(t("fee"))}</span>
        <span class="sv1-sh-amt price-amt" data-bp-price="${esc(s.code.toUpperCase())}" data-bp-pending>${esc(s.priceLabel)}</span>
        <span class="sv1-sh-guest" data-guest-note>${esc(t("guest"))}</span>`;
      acts += `<button type="button" class="sv1-btn primary sm add-cart sv1-sh-add" data-id="${esc(s.cartId)}" data-name-en="${esc(s.nameEn)}" data-name-ar="${esc(s.nameAr)}" data-amount="${esc(String(s.amount))}" data-price="" data-kind="service" data-bp-code="${esc(s.code.toUpperCase())}">${esc(t("addCart"))}</button>`;
      if (s.requiresProposal) acts += `<a class="sv1-btn sm sv1-sh-quote" href="${home}#advisor" data-track="طلب عرض سعر" data-code="${esc(s.code)}" data-name="${esc(s.name)}" data-gov="${esc(s.gov)}">${esc(t("quote"))}</a>`;
    } else {
      price = `<span class="sv1-sh-need">${esc(t("needQuote"))}</span>`;
      if (s.special === "workspace") acts += `<a class="sv1-btn primary sm" href="${esc(s.workspaceHref)}">${esc(t("workspace"))}</a>`;
      else acts += `<a class="sv1-btn primary sm sv1-sh-quote" href="${home}#advisor" data-track="طلب عرض سعر" data-code="${esc(s.code)}" data-name="${esc(s.name)}" data-gov="${esc(s.gov)}">${esc(t("quote"))}</a>`;
    }
    const kind = s.priced ? "cart" : "quote";
    const hay = (s.name + " " + s.nameEn + " " + s.code + " " + s.gov + " " + s.catLabel).toLowerCase();
    return `<article class="sv1-sh-card"${i >= PAGE ? " hidden" : ""} data-sh data-cat="${esc(s.catSlug)}" data-kind="${kind}" data-door="${esc(DOOR[s.catKey] || "consulting")}" data-q="${esc(hay)}">
      <span class="sv1-sh-cat">${esc(s.catLabel)}</span>
      <a class="sv1-sh-name" href="${esc(s.href)}">${esc(s.name)}</a>
      ${s.gov ? `<div class="sv1-sh-gov">${esc(s.gov)}</div>` : ""}
      <div class="sv1-sh-price">${price}</div>
      <div class="sv1-sh-acts">${acts}<a class="sv1-sh-more" href="${esc(s.href)}">${esc(t("details"))}</a></div>
    </article>`;
  };

  const chips = `<button type="button" class="sv1-sh-chip on" data-chip="">${esc(t("all"))}<span>${total}</span></button>`
    + view.cats.map((c) => `<button type="button" class="sv1-sh-chip" data-chip="${esc(c.slug)}">${esc(c.label)}<span>${c.count}</span></button>`).join("");
  const kinds = [["", "kindAll"], ["cart", "kindCart"], ["quote", "kindQuote"]]
    .map(([v, k]) => `<button type="button" class="sv1-sh-kind${v === "" ? " on" : ""}" data-kind-btn="${v}">${esc(t(k))}</button>`).join("");
  const catLinks = view.cats.map((c) => `<a class="sv1-sh-lnk" href="${esc(c.href)}">${esc(c.label)}<span>${c.count}</span></a>`).join("");

  const body = `<style id="sv1-sh-css">
.sv1-sh-hero{padding:30px 0 22px}
.sv1-sh-hero .sv1-tag{margin-top:14px}
.sv1-sh-hero h1{font-size:clamp(28px,4.2vw,44px);line-height:1.2;margin:14px 0 10px;font-weight:200}
.sv1-sh-hero .sv1-lead{max-width:62ch;margin:0}
.sv1-sh-hero .sv1-sh-note{margin:12px 0 0;font-size:12px;color:var(--mut);max-width:78ch;line-height:1.8}
.sv1-crumb{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12.5px;color:var(--mut)}
.sv1-crumb a:hover{color:var(--ac)}
.sv1-crumb i{font-style:normal;color:var(--faint)}
.sv1 .sv1-sh-body{padding:24px 22px 64px}
.sv1-sh-q{width:100%;border:1px solid var(--l);border-radius:12px;padding:13px 15px;font:inherit;font-size:15px;outline:none;background:#fff}
.sv1-sh-q:focus{border-color:var(--n)}
.sv1-sh-chips{display:flex;gap:7px;overflow-x:auto;padding:12px 0 4px;scrollbar-width:none}.sv1-sh-chips::-webkit-scrollbar{display:none}
.sv1-sh-chip{flex:0 0 auto;display:inline-flex;align-items:center;gap:7px;border:1px solid var(--l);background:#fff;border-radius:999px;padding:7px 13px;font:inherit;font-size:13px;color:var(--ink);cursor:pointer;white-space:nowrap}
.sv1-sh-chip span{font-family:var(--fm);font-size:11px;color:var(--ac);background:var(--acSoft);border-radius:999px;padding:1px 8px}
.sv1-sh-chip:hover{border-color:var(--acLine)}
.sv1-sh-chip.on{background:var(--n);border-color:var(--n);color:#fff}.sv1-sh-chip.on span{background:rgba(255,255,255,.18);color:#fff}
.sv1-sh-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:10px 0 14px}
.sv1-sh-kinds{display:inline-flex;border:1px solid var(--l);border-radius:10px;overflow:hidden;background:#fff}
.sv1-sh-kind{border:0;background:none;font:inherit;font-size:12.5px;padding:7px 13px;cursor:pointer;color:var(--s)}
.sv1-sh-kind+.sv1-sh-kind{border-inline-start:1px solid var(--l)}
.sv1-sh-kind.on{background:var(--acSoft);color:var(--ink);font-weight:600}
.sv1-sh-count{font-size:12.5px;color:var(--mut);display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.sv1-sh-count a{color:var(--ac);font-weight:600}
.sv1-sh-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
.sv1-sh-card{border:1px solid var(--l);border-radius:14px;background:#fff;padding:18px;display:flex;flex-direction:column;gap:9px;transition:border-color .15s,box-shadow .15s}
.sv1-sh-card:hover{border-color:var(--acLine);box-shadow:var(--sh2)}
.sv1-sh-card[hidden]{display:none}
.sv1-sh-cat{align-self:flex-start;font-size:11px;color:var(--ac);background:var(--acSoft);border-radius:999px;padding:2px 10px;font-weight:500}
.sv1-sh-name{font-size:15.5px;font-weight:500;color:var(--ink);line-height:1.55}
.sv1-sh-name:hover{color:var(--ac)}
.sv1-sh-gov{font-size:11.5px;color:var(--mut)}
.sv1-sh-price{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;margin-top:auto;padding-top:4px}
.sv1-sh-lbl{font-size:11px;color:var(--mut)}
.sv1-sh-amt{font-family:var(--fm);font-size:19px;font-weight:500;color:var(--ink);font-variant-numeric:tabular-nums}
.sv1-sh-amt[data-bp-pending]{visibility:hidden;animation:sv1shshow .01s linear 2.2s forwards}
@keyframes sv1shshow{to{visibility:visible}}
.sv1-sh-guest{font-size:12px;color:var(--mut)}
.sv1-sh-need{font-size:13.5px;font-weight:500;color:var(--ink)}
.sv1-sh-acts{display:flex;flex-wrap:wrap;gap:7px;align-items:center}
.sv1-sh-more{margin-inline-start:auto;font-size:12px;color:var(--ac);white-space:nowrap}
.sv1-sh-more:hover{text-decoration:underline}
.sv1-sh-none{text-align:center;color:var(--mut);font-size:14px;padding:36px 0}.sv1-sh-none .sv1-btn{margin-top:12px}
.sv1-sh-pager{display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap;margin:26px 0 0}
.sv1-sh-pg{min-width:38px;height:38px;border:1px solid var(--l);border-radius:10px;background:#fff;font:inherit;font-size:13.5px;color:var(--ink);cursor:pointer;padding:0 12px}
.sv1-sh-pg:hover:not([disabled]){border-color:var(--acLine);background:var(--acSoft)}
.sv1-sh-pg[aria-current="page"]{background:var(--n);border-color:var(--n);color:#fff;font-weight:600}
.sv1-sh-pg[disabled]{opacity:.4;cursor:default}
.sv1-sh-gap{color:var(--faint);padding:0 2px}
.sv1-sh-browse{margin-top:44px}
.sv1-sh-browse h2{font-size:18px;margin:0 0 12px;font-weight:300}
.sv1-sh-lnks{display:flex;flex-wrap:wrap;gap:8px}
.sv1-sh-lnk{display:inline-flex;gap:8px;align-items:center;border:1px solid var(--l);border-radius:999px;background:#fff;padding:7px 13px;font-size:13px;color:var(--ink)}
.sv1-sh-lnk span{font-family:var(--fm);font-size:11px;color:var(--ac);background:var(--acSoft);border-radius:999px;padding:1px 8px}
.sv1-sh-lnk:hover{border-color:var(--acLine);background:var(--acSoft)}
.sv1-sh-pkg{margin-top:30px;display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap;background:var(--soft);border:1px solid var(--l);border-radius:14px;padding:16px 18px}
.sv1-sh-pkg b{color:var(--ink);font-size:15px;font-weight:500}
.sv1-sh-ask{margin-top:20px;text-align:center}
.sv1-sh-ask h4{margin:0 0 10px;color:var(--ink);font-size:15px}
.sv1-sh-toast{position:fixed;inset-inline:0;top:84px;margin-inline:auto;width:max-content;max-width:calc(100vw - 28px);z-index:2147483100;background:var(--ink);color:#fff;border-radius:12px;padding:11px 16px;font-size:13px;font-weight:600;box-shadow:0 10px 28px rgba(11,27,90,.3);display:flex;gap:14px;align-items:center}
.sv1-sh-toast a{color:#fff;text-decoration:underline;white-space:nowrap}
.sv1-sh-toast.err{background:#8a1c1c}
@media(max-width:600px){.sv1-sh-hero{padding:22px 0 16px}.sv1-sh-grid{grid-template-columns:1fr}.sv1 .sv1-sh-body{padding-top:18px}.sv1-sh-kinds{width:100%}.sv1-sh-kind{flex:1;padding:8px 4px;font-size:12px}}
</style>
<noscript><style>.sv1-sh-card[hidden]{display:flex!important}.sv1-sh-tools,.sv1-sh-pager{display:none}</style></noscript>
${SV1.header("/services")}
<main>
  <section class="sv1-hero sv1-sh-hero"><div class="wrap">
    <nav class="sv1-crumb" aria-label="breadcrumb"><a href="${SV1.href("/")}">${esc(t("home"))}</a><i>/</i><span>${esc(t("title"))}</span></nav>
    <span class="sv1-tag">${total} ${esc(t("svcWord"))} · ${view.cats.length} ${esc(t("catWord"))}</span>
    <h1>${esc(t("title"))}</h1>
    <p class="sv1-lead">${esc(t("lead"))}</p>
    <p class="sv1-sh-note">${esc(t("note"))}</p>
  </div></section>
  <div class="wrap sv1-sh-body">
    <div class="sv1-sh-tools">
      <input id="shQ" class="sv1-sh-q" type="search" placeholder="${esc(t("search"))}" aria-label="${esc(t("search"))}" autocomplete="off">
      <div class="sv1-sh-chips" id="shChips" role="group">${chips}</div>
      <div class="sv1-sh-row">
        <div class="sv1-sh-kinds" id="shKinds" role="group">${kinds}</div>
        <div class="sv1-sh-count"><span id="shCount" role="status" aria-live="polite"></span><a id="shCatLink" href="#" class="sv1-hide"></a></div>
      </div>
    </div>
    <div class="sv1-sh-grid" id="shGrid">${view.items.map(card).join("")}</div>
    <div class="sv1-sh-none sv1-hide" id="shNone"><p>${esc(t("none"))}</p><button type="button" class="sv1-btn sm" id="shClear">${esc(t("clear"))}</button></div>
    <nav class="sv1-sh-pager" id="shPager" aria-label="${esc(t("page"))}"></nav>
    <section class="sv1-sh-browse">
      <h2>${esc(t("browse"))}</h2>
      <div class="sv1-sh-lnks">${catLinks}</div>
    </section>
    <div class="sv1-sh-pkg"><b>${esc(t("pkg"))}</b><a class="sv1-btn sm" href="${SV1.href("/packages")}">${esc(t("pkgCta"))}</a></div>
    <div class="sv1-panel sv1-sh-ask">
      <h4>${esc(t("ask"))}</h4>
      <a class="sv1-btn primary sm" href="${home}#advisor">${esc(t("askCta"))}</a>
    </div>
  </div>
</main>
<div class="sv1-sh-toast sv1-hide" id="shToast" role="status" aria-live="polite"><span id="shToastTx"></span><a id="shToastCart" href="${SV1.href("/cart")}">${esc(t("viewCart"))}</a></div>
${SV1.footer()}`;

  const cfg = {
    page: PAGE, pageMobile: 8, total, rtl: lang === "ar",
    cats: Object.fromEntries(view.cats.map((c) => [c.slug, { label: c.label, href: c.href }])),
    tx: {
      added: t("added"), addCart: t("addCart"), toast: t("addedToast"), fail: t("cartFail"),
      showing: t("showing"), prev: t("prev"), next: t("next"), page: t("page"), catPage: t("catPage"),
    },
  };
  const script = `<script src="/assets/js/live-prices.js?v=${view.liveV}" defer></script><script>
(function(){
var C=${JSON.stringify(cfg).replace(/</g, "\\u003c")};
var $=function(id){return document.getElementById(id)};
// ---- السلة: عقد bp_cart نفسه (انظر simple-v1-service-detail.mjs: cartItem/cartAdd). amount يُقرأ
// من الزرّ وقت الضغط فيحمل الرقم الحيّ إن بدّله live-prices.js (data-bp-code).
function cartItem(b){var a=b.getAttribute('data-amount');
 return {id:b.getAttribute('data-id'),nameEn:b.getAttribute('data-name-en')||'',nameAr:b.getAttribute('data-name-ar')||'',amount:a?Number(a):null,price:'',kind:'service',qty:1,
  surchargeAmount:null,surchargeFreeCount:null,pricePublic:0,billingPeriod:'',renewsAt:null,commissionPercent:0}}
function cartAdd(b){var c;
 try{c=JSON.parse(localStorage.getItem('bp_cart'))||[];if(!Array.isArray(c))c=[]}catch(e){c=[]}
 var it=cartItem(b),ex=c.filter(function(x){return x.id===it.id})[0];
 if(ex)ex.qty=(ex.qty||1)+1;else c.push(it);
 try{localStorage.setItem('bp_cart',JSON.stringify(c))}catch(e){return false}
 try{document.dispatchEvent(new CustomEvent('bp:cart',{bubbles:true}))}catch(e){}
 return true}
var tt=0;
function toast(msg,err,link){var bx=$('shToast');$('shToastTx').textContent=msg;$('shToastCart').style.display=link?'':'none';
 bx.classList.toggle('err',!!err);bx.classList.remove('sv1-hide');clearTimeout(tt);tt=setTimeout(function(){bx.classList.add('sv1-hide')},4200)}
var grid=$('shGrid'),cards=Array.prototype.slice.call(grid.querySelectorAll('[data-sh]'));
grid.addEventListener('click',function(e){
 var add=e.target.closest&&e.target.closest('.sv1-sh-add');
 if(add){
  if(!cartAdd(add)){toast(C.tx.fail,true,false);return}
  add.textContent=C.tx.added;setTimeout(function(){add.textContent=C.tx.addCart},1600);
  toast(C.tx.toast,false,true);return}
 // ---- طلب عرض سعر: تسليمٌ إلى محادثة الرئيسية (يُقرأ المفتاح ويُحذف هناك في خطوة واحدة).
 var q=e.target.closest&&e.target.closest('.sv1-sh-quote');
 if(q){var nm=q.getAttribute('data-name')||'',cd=q.getAttribute('data-code')||'',card=q.closest('[data-sh]');
  try{sessionStorage.setItem('bp_sva_request',JSON.stringify({items:[{code:cd,title:nm,why:q.getAttribute('data-gov')||''}],door:(card&&card.getAttribute('data-door'))||'consulting',text:nm,name:nm,code:cd,at:Date.now()}))}catch(x){}}
});
// ---- التصفية والترقيم. الحالة في الرابط فتُشارَك.
function norm(x){return String(x||'').toLowerCase().replace(/[\\u064B-\\u0652\\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي')}
cards.forEach(function(c){c._h=norm(c.getAttribute('data-q'))});
var S={cat:'',kind:'',q:'',p:1},mq=window.matchMedia?window.matchMedia('(max-width:600px)'):{matches:false};
var qi=$('shQ'),chips=Array.prototype.slice.call($('shChips').querySelectorAll('[data-chip]')),kinds=Array.prototype.slice.call($('shKinds').querySelectorAll('[data-kind-btn]'));
function perPage(){return mq.matches?C.pageMobile:C.page}
function readUrl(){
 try{var u=new URLSearchParams(location.search);
  var c=u.get('cat')||'';S.cat=C.cats[c]?c:'';
  var k=u.get('t')||'';S.kind=(k==='cart'||k==='quote')?k:'';
  S.q=(u.get('q')||'').slice(0,80);S.p=Math.max(1,parseInt(u.get('p'),10)||1)}catch(e){}
}
function writeUrl(){
 try{var u=new URLSearchParams();
  if(S.cat)u.set('cat',S.cat);if(S.kind)u.set('t',S.kind);if(S.q)u.set('q',S.q);if(S.p>1)u.set('p',String(S.p));
  var s=u.toString();history.replaceState(null,'',location.pathname+(s?'?'+s:''))}catch(e){}
}
function pagerBtn(label,page,cur,dis,aria){
 var b=document.createElement('button');b.type='button';b.className='sv1-sh-pg';b.textContent=label;
 if(aria)b.setAttribute('aria-label',aria);
 if(cur)b.setAttribute('aria-current','page');
 if(dis)b.disabled=true;else b.onclick=function(){S.p=page;draw(true)};
 return b}
function drawPager(pages){
 var box=$('shPager');box.innerHTML='';
 if(pages<2)return;
 box.appendChild(pagerBtn(C.rtl?'›':'‹',S.p-1,false,S.p<=1,C.tx.prev));
 var want=[1,pages,S.p-1,S.p,S.p+1].filter(function(n){return n>=1&&n<=pages});
 want=want.filter(function(n,i){return want.indexOf(n)===i}).sort(function(a,b){return a-b});
 var last=0;
 want.forEach(function(n){
  if(last&&n-last>1){var g=document.createElement('span');g.className='sv1-sh-gap';g.textContent='…';box.appendChild(g)}
  box.appendChild(pagerBtn(String(n),n,n===S.p,false,C.tx.page+' '+n));last=n});
 box.appendChild(pagerBtn(C.rtl?'‹':'›',S.p+1,false,S.p>=pages,C.tx.next));
}
function draw(scroll){
 var tk=norm(S.q).trim().split(/\\s+/).filter(Boolean);
 var hits=cards.filter(function(c){
  if(S.cat&&c.getAttribute('data-cat')!==S.cat)return false;
  if(S.kind&&c.getAttribute('data-kind')!==S.kind)return false;
  return tk.every(function(x){return c._h.indexOf(x)>=0})});
 var pp=perPage(),pages=Math.max(1,Math.ceil(hits.length/pp));
 if(S.p>pages)S.p=pages;
 var a=(S.p-1)*pp,b=Math.min(hits.length,a+pp);
 var show=hits.slice(a,b);
 cards.forEach(function(c){c.hidden=show.indexOf(c)<0});
 $('shNone').classList.toggle('sv1-hide',hits.length>0);
 $('shCount').textContent=hits.length?C.tx.showing.replace('{a}',a+1).replace('{b}',b).replace('{n}',hits.length):'';
 chips.forEach(function(x){x.classList.toggle('on',x.getAttribute('data-chip')===S.cat)});
 kinds.forEach(function(x){x.classList.toggle('on',x.getAttribute('data-kind-btn')===S.kind)});
 var cl=$('shCatLink');
 if(S.cat&&C.cats[S.cat]){cl.href=C.cats[S.cat].href;cl.textContent=C.tx.catPage;cl.classList.remove('sv1-hide')}else cl.classList.add('sv1-hide');
 drawPager(pages);writeUrl();
 if(scroll){var top=$('shChips').getBoundingClientRect().top+window.pageYOffset-90;window.scrollTo({top:Math.max(0,top),behavior:'smooth'})}
}
chips.forEach(function(x){x.onclick=function(){S.cat=x.getAttribute('data-chip')||'';S.p=1;draw()}});
kinds.forEach(function(x){x.onclick=function(){S.kind=x.getAttribute('data-kind-btn')||'';S.p=1;draw()}});
qi.addEventListener('input',function(){S.q=qi.value||'';S.p=1;draw()});
$('shClear').onclick=function(){S={cat:'',kind:'',q:'',p:1};qi.value='';draw()};
if(mq.addEventListener)mq.addEventListener('change',function(){S.p=1;draw()});
readUrl();qi.value=S.q;draw();
})();</script>`;

  return SV1.shell({
    title: `${t("title")} — Business Partner`,
    desc: view.seoDesc,
    path: "/services",
    body,
    script,
  });
}
