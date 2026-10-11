// Business Partner — Simple V1: صفحة تصنيف الخدمات (/services/category/<slug>).
//
// كانت الصفحة ترويسة SV1 مُلصقة فوق جسمٍ قديم (`hero` و`svc-card` من
// styles.css) وتكتب «سعر حسب حالتك» تحت كل بطاقة حتى المسعّرة منها، وبلا زرّ
// شراء: من يصل إلى التصنيف من فتات الخبز كان يرى هويةً غير التي في صفحة
// الخدمة التي جاء منها، ثم لا يجد سعراً ولا طريقاً إلى السلة. صارت بنفس صفحة
// تفاصيل الخدمة (`simple-v1-service-detail.mjs`): داخل `SV1.shell()`، بلا
// `main.js` ولا `bp-public-brand-v5`.
//
// القواعد التي تُحمل حرفاً من صفحة الخدمة (فلا يرى العميل بطاقةً تخالف صفحتها):
//  • مسعّرة = `priced` نفسها: سعرٌ في الكتالوج وليست عقاراً ولا سياحة. تظهر
//    بسعرها وزرّ «أضف إلى السلة»؛ وإن كانت `requiresProposal` ظهر معه «اطلب عرض
//    سعر» كما في صفحتها.
//  • غير المسعّرة تقول «تحتاج عرض سعر» وزرّها عرض السعر (أو «اطلب مساحة عمل»
//    لخدمات المساحات). لا رقمَ يُخترع لها.
//  • السلة: عقد `localStorage.bp_cart` نفسه (مفتاح `svc-<sku>`، `amount` رقم،
//    `price` نصّ فارغ، تكرار الإضافة يزيد `qty`).
//  • سياسة الأسعار: الرقم بصنف `price-amt` فتخفيه القاعدة العامة عن الزائر
//    وتُظهره للمسجَّل، ويظهر للزائر `data-guest-note`. والسعر الحيّ من
//    `live-prices.js` عبر `data-bp-price` و`data-bp-code`.
//  • «اطلب عرض سعر» يسلّم الخدمة إلى محادثة الرئيسية بـ`bp_sva_request`.
//  • الخدمات المخفية (site/data/hidden.json) لا تصل إلى هنا أصلاً: المولّد يمرّر
//    قائمة `services` بعد التصفية، وهذا الملف لا يقرأ الكتالوج بنفسه.

const T = {
  home:      { ar: "الرئيسية", en: "Home", fr: "Accueil", zh: "首页" },
  services:  { ar: "الخدمات", en: "Services", fr: "Services", zh: "服务" },
  svcWord:   { ar: "خدمة", en: "services", fr: "services", zh: "项服务" },
  svcWord1:  { ar: "خدمة", en: "service", fr: "service", zh: "项服务" },
  lead:      { ar: "أضف الخدمة المسعّرة إلى السلة وادفع إلكترونياً، أو اطلب عرض سعر لحالتك. الرسوم الحكومية، إن وُجدت، تُسدَّد للجهة بتكلفتها الفعلية.",
               en: "Add a priced service to your cart and pay online, or request a quotation for your case. Government fees, where they apply, are paid to the authority at actual cost.",
               fr: "Ajoutez un service au tarif affiché au panier et payez en ligne, ou demandez un devis pour votre cas. Les frais gouvernementaux, le cas échéant, sont réglés à l'autorité au coût réel.",
               zh: "定价明确的服务可直接加入购物车并在线支付，也可为您的情况申请报价。政府规费（如有）按实际费用向相关机构缴纳。" },
  search:    { ar: "ابحث في هذا التصنيف", en: "Search this category", fr: "Rechercher dans cette catégorie", zh: "在此分类中搜索" },
  none:      { ar: "لا نتيجة بهذه الكلمة. جرّب كلمة أعمّ.", en: "Nothing matched. Try a broader word.",
               fr: "Aucun résultat. Essayez un terme plus large.", zh: "没有匹配项。请尝试更宽泛的词。" },
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
  others:    { ar: "تصنيفات أخرى", en: "Other categories", fr: "Autres catégories", zh: "其他分类" },
  all:       { ar: "كل الخدمات والباقات", en: "All services & packages", fr: "Tous les services et forfaits", zh: "全部服务与套餐" },
  ask:       { ar: "محتار أي خدمة تناسبك؟", en: "Not sure which service fits?", fr: "Quel service choisir ?", zh: "不确定哪项服务适合您？" },
  askCta:    { ar: "اشرح احتياجك في المحادثة", en: "Describe your need in the chat", fr: "Décrivez votre besoin", zh: "在对话中描述您的需求" },
};

// ‏الباب الذي يفتحه المستشار لكل تصنيف — نسخة من خريطة صفحة الخدمة
// (simple-v1-service-detail.mjs: DOOR) حتى لا يفتح الزرّ نفسه بابين مختلفين.
const DOOR = {
  "Company Formation": "formation", "Foreign Investment": "formation",
  "Government Relations": "government", "Recruitment": "government",
  "HR Services": "government", "Premium Residency": "government",
};

// view = { key, label, slug, count, items: [...], others: [{label, href, count}] }
// item = { code, slug, href, name, nameEn, nameAr, gov, priced, amount, priceLabel,
//          requiresProposal, special: ""|"workspace"|"tourism", cartId, workspaceHref }
export function buildSimpleServiceCategory(SV1, ctx, v) {
  const lang = ctx.lang();
  const esc = ctx.esc;
  const t = (k) => (T[k][lang] != null ? T[k][lang] : T[k].en);
  const home = lang === "en" ? "/" : "/" + lang + "/";
  const door = DOOR[v.key] || "consulting";
  const n = v.items.length;

  const crumbs = `<nav class="sv1-crumb" aria-label="breadcrumb">
      <a href="${SV1.href("/")}">${esc(t("home"))}</a><i>/</i><a href="${SV1.href("/catalog")}">${esc(t("services"))}</a><i>/</i><span>${esc(v.label)}</span>
    </nav>`;

  const card = (s) => {
    let price, acts = "";
    if (s.priced) {
      price = `<span class="sv1-cp-lbl">${esc(t("fee"))}</span>
        <span class="sv1-cp-amt price-amt" data-bp-price="${esc(s.code.toUpperCase())}" data-bp-pending>${esc(s.priceLabel)}</span>
        <span class="sv1-cp-guest" data-guest-note>${esc(t("guest"))}</span>`;
      acts += `<button type="button" class="sv1-btn primary sm add-cart sv1-cp-add" data-id="${esc(s.cartId)}" data-name-en="${esc(s.nameEn)}" data-name-ar="${esc(s.nameAr)}" data-amount="${esc(String(s.amount))}" data-price="" data-kind="service" data-bp-code="${esc(s.code.toUpperCase())}">${esc(t("addCart"))}</button>`;
      if (s.requiresProposal) acts += `<a class="sv1-btn sm sv1-cp-quote" href="${home}#advisor" data-track="طلب عرض سعر" data-code="${esc(s.code)}" data-name="${esc(s.name)}" data-gov="${esc(s.gov)}">${esc(t("quote"))}</a>`;
    } else {
      price = `<span class="sv1-cp-need">${esc(t("needQuote"))}</span>`;
      if (s.special === "workspace") acts += `<a class="sv1-btn primary sm" href="${esc(s.workspaceHref)}">${esc(t("workspace"))}</a>`;
      else acts += `<a class="sv1-btn primary sm sv1-cp-quote" href="${home}#advisor" data-track="طلب عرض سعر" data-code="${esc(s.code)}" data-name="${esc(s.name)}" data-gov="${esc(s.gov)}">${esc(t("quote"))}</a>`;
    }
    const hay = (s.name + " " + s.code + " " + s.gov).toLowerCase();
    return `<article class="sv1-cp-card" data-q="${esc(hay)}">
      <a class="sv1-cp-name" href="${esc(s.href)}">${esc(s.name)}</a>
      ${s.gov ? `<div class="sv1-cp-gov">${esc(s.gov)}</div>` : ""}
      <div class="sv1-cp-price">${price}</div>
      <div class="sv1-cp-acts">${acts}<a class="sv1-cp-more" href="${esc(s.href)}">${esc(t("details"))}</a></div>
    </article>`;
  };

  const others = v.others.map((c) => `<a class="sv1-cp-chip" href="${esc(c.href)}">${esc(c.label)}<span>${esc(String(c.count))}</span></a>`).join("");

  const body = `<style id="sv1-cp-css">
.sv1-cp-hero{padding:34px 0 28px}
.sv1-cp-hero .sv1-tag{margin-top:14px}
.sv1-cp-hero h1{font-size:clamp(28px,4.2vw,46px);line-height:1.2;margin:16px 0 14px;max-width:22ch;font-weight:200}
.sv1-cp-hero .sv1-lead{max-width:62ch}
.sv1-crumb{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12.5px;color:var(--mut)}
.sv1-crumb a:hover{color:var(--ac)}
.sv1-crumb i{font-style:normal;color:var(--faint)}
.sv1 .sv1-cp-body{padding:30px 22px 64px}
.sv1-cp-q{width:100%;max-width:460px;border:1px solid var(--l);border-radius:12px;padding:13px 15px;font:inherit;font-size:15px;outline:none;background:#fff;margin-bottom:18px}
.sv1-cp-q:focus{border-color:var(--n)}
.sv1-cp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
.sv1-cp-card{border:1px solid var(--l);border-radius:14px;background:#fff;padding:18px;display:flex;flex-direction:column;gap:9px;transition:border-color .15s,box-shadow .15s}
.sv1-cp-card:hover{border-color:var(--acLine);box-shadow:var(--sh2)}
.sv1-cp-card[hidden]{display:none}
.sv1-cp-name{font-size:15.5px;font-weight:500;color:var(--ink);line-height:1.55}
.sv1-cp-name:hover{color:var(--ac)}
.sv1-cp-gov{font-size:11.5px;color:var(--mut)}
.sv1-cp-price{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;margin-top:auto;padding-top:4px}
.sv1-cp-lbl{font-size:11px;color:var(--mut)}
.sv1-cp-amt{font-family:var(--fm);font-size:19px;font-weight:500;color:var(--ink);font-variant-numeric:tabular-nums}
.sv1-cp-amt[data-bp-pending]{visibility:hidden;animation:sv1cpshow .01s linear 2.2s forwards}
@keyframes sv1cpshow{to{visibility:visible}}
.sv1-cp-guest{font-size:12px;color:var(--mut)}
.sv1-cp-need{font-size:13.5px;font-weight:500;color:var(--ink)}
.sv1-cp-acts{display:flex;flex-wrap:wrap;gap:7px;align-items:center}
.sv1-cp-more{margin-inline-start:auto;font-size:12px;color:var(--ac);white-space:nowrap}
.sv1-cp-more:hover{text-decoration:underline}
.sv1-cp-none{color:var(--mut);font-size:14px;margin:18px 2px}
.sv1-cp-others{margin-top:40px}
.sv1-cp-others h2{font-size:18px;margin:0 0 12px;font-weight:300}
.sv1-cp-chips{display:flex;flex-wrap:wrap;gap:8px}
.sv1-cp-chip{display:inline-flex;gap:8px;align-items:center;border:1px solid var(--l);border-radius:999px;background:#fff;padding:7px 13px;font-size:13px;color:var(--ink)}
.sv1-cp-chip span{font-family:var(--fm);font-size:11px;color:var(--ac);background:var(--acSoft);border-radius:999px;padding:1px 8px}
.sv1-cp-chip:hover{border-color:var(--acLine);background:var(--acSoft)}
.sv1-cp-ask{margin-top:30px;text-align:center}
.sv1-cp-ask h4{margin:0 0 10px;color:var(--ink);font-size:15px}
.sv1-cp-toast{position:fixed;inset-inline:0;top:84px;margin-inline:auto;width:max-content;max-width:calc(100vw - 28px);z-index:2147483100;background:var(--ink);color:#fff;border-radius:12px;padding:11px 16px;font-size:13px;font-weight:600;box-shadow:0 10px 28px rgba(11,27,90,.3);display:flex;gap:14px;align-items:center}
.sv1-cp-toast a{color:#fff;text-decoration:underline;white-space:nowrap}
.sv1-cp-toast.err{background:#8a1c1c}
@media(max-width:600px){.sv1-cp-hero{padding:24px 0 20px}.sv1-cp-grid{grid-template-columns:1fr}}
</style>
${SV1.header("/services/category/" + v.slug)}
<main>
  <section class="sv1-hero sv1-cp-hero"><div class="wrap">
    ${crumbs}
    <span class="sv1-tag">${esc(String(n))} ${esc(n === 1 ? t("svcWord1") : t("svcWord"))}</span>
    <h1>${esc(v.label)}</h1>
    <p class="sv1-lead">${esc(t("lead"))}</p>
  </div></section>
  <div class="wrap sv1-cp-body">
    <input id="cpQ" class="sv1-cp-q" type="search" placeholder="${esc(t("search"))}" aria-label="${esc(t("search"))}">
    <div class="sv1-cp-grid" id="cpGrid">${v.items.map(card).join("")}</div>
    <p class="sv1-cp-none sv1-hide" id="cpNone">${esc(t("none"))}</p>
    <section class="sv1-cp-others">
      <h2>${esc(t("others"))}</h2>
      <div class="sv1-cp-chips">${others}<a class="sv1-cp-chip" href="${SV1.href("/catalog")}">${esc(t("all"))}</a></div>
    </section>
    <div class="sv1-panel sv1-cp-ask">
      <h4>${esc(t("ask"))}</h4>
      <a class="sv1-btn primary sm" href="${home}#advisor">${esc(t("askCta"))}</a>
    </div>
  </div>
</main>
<div class="sv1-cp-toast sv1-hide" id="cpToast" role="status" aria-live="polite"><span id="cpToastTx"></span><a id="cpToastCart" href="${SV1.href("/cart")}">${esc(t("viewCart"))}</a></div>
${SV1.footer()}`;

  const cfg = {
    door,
    tx: { added: t("added"), addCart: t("addCart"), toast: t("addedToast"), fail: t("cartFail") },
  };
  const script = `<script src="/assets/js/live-prices.js?v=${v.liveV}" defer></script><script>
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
function toast(msg,err,link){var bx=$('cpToast');$('cpToastTx').textContent=msg;$('cpToastCart').style.display=link?'':'none';
 bx.classList.toggle('err',!!err);bx.classList.remove('sv1-hide');clearTimeout(tt);tt=setTimeout(function(){bx.classList.add('sv1-hide')},4200)}
var grid=$('cpGrid');
grid.addEventListener('click',function(e){
 var add=e.target.closest&&e.target.closest('.sv1-cp-add');
 if(add){
  if(!cartAdd(add)){toast(C.tx.fail,true,false);return}
  add.textContent=C.tx.added;setTimeout(function(){add.textContent=C.tx.addCart},1600);
  toast(C.tx.toast,false,true);return}
 // ---- طلب عرض سعر: تسليمٌ إلى محادثة الرئيسية (يُقرأ المفتاح ويُحذف هناك في خطوة واحدة).
 var q=e.target.closest&&e.target.closest('.sv1-cp-quote');
 if(q){var nm=q.getAttribute('data-name')||'',cd=q.getAttribute('data-code')||'';
  try{sessionStorage.setItem('bp_sva_request',JSON.stringify({items:[{code:cd,title:nm,why:q.getAttribute('data-gov')||''}],door:C.door,text:nm,name:nm,code:cd,at:Date.now()}))}catch(x){}}
});
// ---- بحث داخل التصنيف: يُخفي البطاقات ولا يحذفها (تبقى في الصفحة للفهرسة).
var qi=$('cpQ');
if(qi)qi.addEventListener('input',function(){
 var f=(qi.value||'').trim().toLowerCase(),cards=grid.querySelectorAll('.sv1-cp-card'),shown=0;
 Array.prototype.forEach.call(cards,function(c){var hit=!f||(c.getAttribute('data-q')||'').indexOf(f)>=0;c.hidden=!hit;if(hit)shown++});
 $('cpNone').classList.toggle('sv1-hide',shown>0)});
})();</script>`;

  return SV1.shell({
    title: `${v.label} — Business Partner`,
    desc: v.seoDesc,
    path: "/services/category/" + v.slug,
    body,
    script,
  });
}
