// Business Partner — Simple V1: صفحة تفاصيل الخدمة (/services/<sku>).
//
// كانت الصفحة قشرةً جديدة (ترويسة وتذييل SV1 حُقنا بعد البناء) فوق جسمٍ قديم:
// `styles.css` و`main.js` وطبقة `bp-public-brand-v5`، وبطاقة «مشخّص الخدمة»
// الطويلة (٤ أسئلة وثلاثة أزرار منها واتساب) فوق الوصف، ثم زرّان للتصرّف في
// عمود الشراء وثالثٌ للاستشارة، وجملتان تَعِدان بشيئين («تصدر فوراً» مع «تتطلب
// عرضاً»). هذا الملف يبنيها كلها داخل `SV1.shell()` بصفحةٍ واحدة المعنى:
//
//   سعر واحد ← زرٌّ رئيسي واحد ← زرٌّ ثانوي واحد (إن كانت الخدمة تتطلب عرضاً)
//   ثم: الوصف، المستندات المطلوبة، ما نتولّاه، والأسئلة المخصّصة للخدمة.
//
// ما يبقى كما هو بحرفه:
//  • السلة: عقد `localStorage.bp_cart` نفسه الذي في `simple-v1-catalog.mjs` —
//    العنصر بمفتاح `svc-<sku>` و`amount` رقم و`price` نصّ عرض فارغ، وتكرار
//    الإضافة يزيد `qty` ولا يُضيف سطراً.
//  • السعر الحيّ: عنصر السعر يحمل `data-bp-price="<CODE>"` وزرّ السلة
//    `data-bp-code="<CODE>"` فيبدّلهما `live-prices.js` من `/api/live-catalog`.
//    ويحمل `data-bp-pending` فلا يُرى رقم البناء قبل وصول الرقم الحيّ (انظر
//    الـCSS: يظهر وحده بعد ثانيتين إن تعذّرت القراءة).
//  • سياسة الأسعار: عنصر السعر والملاحظة المرتبطة به بصنف `price-amt` فتخفيهما
//    القاعدة العامة عن الزائر وتُظهرهما للمسجَّل، ويظهر للزائر `data-guest-note`.
//  • لا زرّ واتساب في الصفحة — الزرّ العائم في تذييل SV1 وحده.
//  • «طلب عرض سعر» يسلّم الخدمة إلى محادثة الرئيسية بـ`bp_sva_request` كما يفعل
//    «ابدأ طلبك بها» في /catalog، فالمسار نفسه: نطاق ← عرض ← عقد ← دفع ← فاتورة.

const T = {
  home:      { ar: "الرئيسية", en: "Home", fr: "Accueil", zh: "首页" },
  services:  { ar: "الخدمات", en: "Services", fr: "Services", zh: "服务" },
  fee:       { ar: "أتعاب الخدمة", en: "Service fee", fr: "Honoraires du service", zh: "服务费" },
  custom:    { ar: "السعر حسب حالتك", en: "Priced to your case", fr: "Tarif selon votre cas", zh: "按您的情况报价" },
  noteVat:   { ar: "لا تشمل ضريبة القيمة المضافة 15٪؛ تُضاف سطراً مستقلاً ثم الإجمالي شاملاً.",
               en: "Excludes 15% VAT — added as its own line, then the total including VAT.",
               fr: "Hors TVA 15 % — ajoutée sur une ligne distincte, puis le total TTC.",
               zh: "不含 15% 增值税——单列一行，随后为含税总额。" },
  noteGov:   { ar: "لا تشمل ضريبة القيمة المضافة 15٪ (تُضاف سطراً مستقلاً ثم الإجمالي شاملاً)، ولا الرسوم الحكومية — تُسدَّد للجهات بالتكلفة الفعلية.",
               en: "Excludes 15% VAT (added as its own line, then the total including VAT) and government fees, which are paid to the authorities at actual cost.",
               fr: "Hors TVA 15 % (ajoutée sur une ligne distincte, puis total TTC) et hors frais gouvernementaux, réglés aux autorités au coût réel.",
               zh: "不含 15% 增值税（单列一行，随后为含税总额），也不含政府规费——按实际费用向相关机构缴纳。" },
  guest:     { ar: "سجّل الدخول لعرض أتعاب الخدمة لحالتك.", en: "Sign in to see the fee for your case.",
               fr: "Connectez-vous pour voir les honoraires de votre cas.", zh: "登录后可查看适用于您情况的服务费。" },
  addCart:   { ar: "أضف إلى السلة", en: "Add to cart", fr: "Ajouter au panier", zh: "加入购物车" },
  added:     { ar: "أُضيف ✓", en: "Added ✓", fr: "Ajouté ✓", zh: "已加入 ✓" },
  addedToast:{ ar: "أُضيفت الخدمة إلى السلة", en: "Added to your cart", fr: "Ajouté à votre panier", zh: "已加入购物车" },
  viewCart:  { ar: "عرض السلة ←", en: "View cart →", fr: "Voir le panier →", zh: "查看购物车 →" },
  cartFail:  { ar: "تعذّر حفظ السلة في هذا المتصفح. اطلب عرض سعر بدلاً من ذلك.",
               en: "Your browser could not save the cart. Request a quotation instead.",
               fr: "Ce navigateur n'a pas pu enregistrer le panier. Demandez plutôt un devis.",
               zh: "此浏览器无法保存购物车。请改为申请报价。" },
  quote:     { ar: "اطلب عرض سعر", en: "Request a quotation", fr: "Demander un devis", zh: "申请报价" },
  consult:   { ar: "احجز استشارة", en: "Book a consultation", fr: "Réserver une consultation", zh: "预约咨询" },
  workspace: { ar: "اطلب مساحة عمل", en: "Request a workspace", fr: "Demander un espace de travail", zh: "申请办公空间" },
  tourism:   { ar: "استعرض خدمات السياحة", en: "Explore tourism services", fr: "Découvrir les services de tourisme", zh: "浏览旅游服务" },
  fDuration: { ar: "المدة", en: "Duration", fr: "Délai", zh: "办理时长" },
  fAuthority:{ ar: "الجهة", en: "Authority", fr: "Autorité", zh: "办理机构" },
  fCode:     { ar: "الرمز", en: "Code", fr: "Code", zh: "编号" },
  docs:      { ar: "المستندات المطلوبة", en: "Required documents", fr: "Documents requis", zh: "所需文件" },
  docsGen:   { ar: "نؤكّد لك قائمة المستندات الدقيقة لحالتك عند بدء الطلب.",
               en: "We confirm the exact document list for your case when you start the request.",
               fr: "Nous confirmons la liste exacte des documents pour votre cas au démarrage de la demande.",
               zh: "发起申请时，我们会确认适用于您情况的准确文件清单。" },
  does:      { ar: "ما نتولّاه", en: "What we handle", fr: "Ce que nous prenons en charge", zh: "我们负责的事项" },
  faq:       { ar: "أسئلة عن هذه الخدمة", en: "Questions about this service", fr: "Questions sur ce service", zh: "关于此服务的常见问题" },
};

// ‏الباب الذي يفتحه المستشار لكل تصنيف (مفاتيح الكتالوج بالإنجليزية).
const DOOR = {
  "Company Formation": "formation", "Foreign Investment": "formation",
  "Government Relations": "government", "Recruitment": "government",
  "HR Services": "government", "Premium Residency": "government",
};

export function buildSimpleServiceDetail(SV1, ctx, v) {
  const lang = ctx.lang();
  const esc = ctx.esc;
  const t = (k) => (T[k][lang] != null ? T[k][lang] : T[k].en);
  const home = lang === "en" ? "/" : "/" + lang + "/";
  const door = DOOR[v.category] || "consulting";

  const crumbs = `<nav class="sv1-crumb" aria-label="breadcrumb">
      <a href="${SV1.href("/")}">${esc(t("home"))}</a><i>/</i><a href="${SV1.href("/catalog")}">${esc(t("services"))}</a><i>/</i><a href="${esc(v.catHref)}">${esc(v.catLabel)}</a>
    </nav>`;

  // ---- عمود الشراء: سعر واحد، زرّ رئيسي واحد، وثانوي واحد على الأكثر.
  let price, primary, secondary = "";
  const quoteBtn = (cls) => `<a class="sv1-btn ${cls}" id="svcQuote" href="${home}#advisor" data-track="طلب عرض سعر">${esc(t("quote"))}</a>`;
  if (v.priced) {
    const note = v.priceNote || (v.govFeesSeparate ? t("noteGov") : t("noteVat"));
    price = `<div class="sv1-svc-lbl">${esc(t("fee"))}</div>
      <div class="sv1-svc-price price-amt" data-bp-price="${esc(v.code.toUpperCase())}" data-bp-pending>${esc(v.priceLabel)}</div>
      <p class="sv1-svc-note price-amt">${esc(note)}</p>
      <p class="sv1-svc-note" data-guest-note>${esc(t("guest"))}</p>`;
    primary = `<button type="button" class="sv1-btn primary add-cart" id="svcAdd" data-id="${esc(v.cartId)}" data-name-en="${esc(v.nameEn)}" data-name-ar="${esc(v.nameAr)}" data-amount="${esc(String(v.amount))}" data-price="" data-kind="service" data-bp-code="${esc(v.code.toUpperCase())}">${esc(t("addCart"))}</button>`;
    if (v.requiresProposal) secondary = quoteBtn("");
  } else {
    price = `<div class="sv1-svc-price sv1-svc-custom">${esc(t("custom"))}</div>`;
    if (v.special === "workspace") primary = `<a class="sv1-btn primary" href="${esc(v.hrefs.workspace)}">${esc(t("workspace"))}</a>`;
    else if (v.special === "tourism") primary = `<a class="sv1-btn primary" href="${esc(v.hrefs.tourism)}">${esc(t("tourism"))}</a>`;
    else primary = quoteBtn("primary");
    if (!v.special) secondary = `<a class="sv1-btn" href="${esc(v.hrefs.consult)}">${esc(t("consult"))}</a>`;
  }

  const fact = (k, val) => (val ? `<div><dt>${esc(t(k))}</dt><dd>${esc(val)}</dd></div>` : "");
  const facts = `<dl class="sv1-svc-facts">${fact("fDuration", v.duration)}${fact("fAuthority", v.gov)}<div><dt>${esc(t("fCode"))}</dt><dd class="sv1-mono">${esc(v.code)}</dd></div></dl>`;

  const docs = `<section class="sv1-svc-sec"><h2>${esc(t("docs"))}</h2>
      <ul class="sv1-svc-docs">${v.docs.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>
      ${v.docsGeneric ? `<p class="sv1-svc-hint">${esc(t("docsGen"))}</p>` : ""}
    </section>`;
  const does = v.feats.length
    ? `<section class="sv1-svc-sec"><h2>${esc(t("does"))}</h2>
      <ul class="sv1-svc-does">${v.feats.map((f) => `<li>${esc(f)}</li>`).join("")}</ul></section>` : "";
  const faq = v.faq.length
    ? `<section class="sv1-svc-sec"><h2>${esc(t("faq"))}</h2>
      ${v.faq.map((f) => `<details class="sv1-svc-q"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</section>` : "";

  const body = `<style id="sv1-svc-css">
.sv1-svc-hero{padding:34px 0 30px}
.sv1-svc-hero .sv1-tag{margin-top:14px}
.sv1-svc-hero h1{font-size:clamp(28px,4.2vw,46px);line-height:1.2;margin:16px 0 14px;max-width:22ch;font-weight:200}
.sv1-svc-hero .sv1-lead{max-width:62ch}
.sv1-crumb{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12.5px;color:var(--mut)}
.sv1-crumb a:hover{color:var(--ac)}
.sv1-crumb i{font-style:normal;color:var(--faint)}
.sv1 .sv1-svc-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:30px;align-items:start;padding:38px 22px 64px}
.sv1-svc-sec{margin-bottom:34px}
.sv1-svc-sec h2{font-size:21px;margin:0 0 14px;font-weight:300}
.sv1-svc-docs,.sv1-svc-does{list-style:none;margin:0;padding:0;display:grid;gap:7px}
.sv1-svc-docs li{display:flex;gap:10px;align-items:center;background:#fbfcfe;border:1px solid var(--l);border-radius:10px;padding:10px 13px;font-size:14px;color:var(--t)}
.sv1-svc-docs li::before{content:"\\1F4C4";font-size:14px;flex:none}
.sv1-svc-does li{display:flex;gap:10px;align-items:flex-start;font-size:14.5px;line-height:1.75;color:var(--t)}
.sv1-svc-does li::before{content:"\\2713";color:var(--ok);font-weight:700;flex:none}
.sv1-svc-hint{margin:10px 2px 0;font-size:12.5px;color:var(--mut)}
.sv1-svc-q{border:1px solid var(--l);border-radius:12px;background:#fff;margin-bottom:8px}
.sv1-svc-q summary{cursor:pointer;list-style:none;padding:13px 15px;font-size:14px;font-weight:500;color:var(--ink);display:flex;justify-content:space-between;gap:12px;align-items:center}
.sv1-svc-q summary::-webkit-details-marker{display:none}
.sv1-svc-q summary::after{content:"\\2304";color:var(--mut);transition:transform .2s;flex:none}
.sv1-svc-q[open] summary::after{transform:rotate(180deg)}
.sv1-svc-q p{margin:0;padding:0 15px 14px;font-size:13.5px;color:var(--s);line-height:1.8}
.sv1-svc-buy{border:1px solid var(--acLine);border-radius:15px;background:#fff;box-shadow:var(--sh2);padding:22px;position:sticky;top:96px}
.sv1-svc-lbl{font-size:11.5px;color:var(--mut);font-weight:500}
.sv1-svc-price{font-family:var(--fm);font-size:34px;font-weight:500;color:var(--ink);line-height:1.25;margin:2px 0 8px;font-variant-numeric:tabular-nums}
.sv1-svc-price.sv1-svc-custom{font-family:inherit;font-size:21px;font-weight:300;margin:0 0 16px}
/* الرقم المبني لا يُرى قبل أن يصل الحيّ (live-prices.js ينزع data-bp-pending)؛
   وإن تعذّرت القراءة يظهر وحده بعد ثانيتين فلا تبقى الخانة فارغة. */
.sv1-svc-price[data-bp-pending]{visibility:hidden;animation:sv1svcshow .01s linear 2.2s forwards}
@keyframes sv1svcshow{to{visibility:visible}}
.sv1-svc-note{margin:0 0 14px;font-size:12px;line-height:1.75;color:var(--mut)}
.sv1-svc-buy .sv1-btn{display:flex;width:100%;padding:13px 19px;font-size:14px}
.sv1-svc-buy .sv1-btn+.sv1-btn{margin-top:9px}
.sv1-svc-facts{margin:18px 0 0;padding-top:14px;border-top:1px solid var(--l);display:grid;gap:9px}
.sv1-svc-facts div{display:flex;justify-content:space-between;gap:14px;align-items:baseline}
.sv1-svc-facts dt{font-size:11.5px;color:var(--mut);flex:none}
.sv1-svc-facts dd{margin:0;font-size:12.5px;color:var(--ink);text-align:end;font-weight:500}
.sv1-svc-toast{position:fixed;inset-inline:0;top:84px;margin-inline:auto;width:max-content;max-width:calc(100vw - 28px);z-index:2147483100;background:var(--ink);color:#fff;border-radius:12px;padding:11px 16px;font-size:13px;font-weight:600;box-shadow:0 10px 28px rgba(11,27,90,.3)}
.sv1-svc-toast a{color:#fff;text-decoration:underline;white-space:nowrap;margin-inline-start:10px}
.sv1-svc-toast.err{background:#8a1c1c}
@media(max-width:900px){.sv1 .sv1-svc-grid{grid-template-columns:1fr;gap:22px;padding-top:24px}.sv1-svc-buy{position:static;order:-1}}
@media(max-width:600px){.sv1-svc-hero{padding:24px 0 22px}.sv1-svc-buy{padding:18px}}
</style>
${SV1.header("/services/" + v.slug)}
<main>
  <section class="sv1-hero sv1-svc-hero"><div class="wrap">
    ${crumbs}
    <span class="sv1-tag">${esc(v.catLabel)}</span>
    <h1>${esc(v.name)}</h1>
    <p class="sv1-lead">${esc(v.desc)}</p>
  </div></section>
  <div class="wrap sv1-svc-grid">
    <div class="sv1-svc-main">
      ${docs}
      ${does}
      ${faq}
    </div>
    <aside class="sv1-svc-buy" aria-label="${esc(t("fee"))}">
      ${price}
      ${primary}
      ${secondary}
      ${facts}
    </aside>
  </div>
</main>
<div class="sv1-svc-toast sv1-hide" id="svcToast" role="status" aria-live="polite"><span id="svcToastTx"></span><a id="svcToastCart" href="${SV1.href("/cart")}">${esc(t("viewCart"))}</a></div>
${SV1.footer()}`;

  const cfg = {
    code: v.code, name: v.name, gov: v.gov, door,
    tx: { added: t("added"), addCart: t("addCart"), toast: t("addedToast"), fail: t("cartFail") },
  };
  const script = `<script src="/assets/js/live-prices.js?v=${v.liveV}" defer></script><script>
(function(){
var C=${JSON.stringify(cfg).replace(/</g, "\\u003c")};
var $=function(id){return document.getElementById(id)};
// ---- السلة: عقد bp_cart نفسه (انظر simple-v1-catalog.mjs: cartItem/cartAdd). amount يُقرأ
// من الزرّ وقت الضغط، فيحمل الرقم الحيّ إن بدّله live-prices.js (data-bp-code).
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
function toast(msg,err,link){var bx=$('svcToast');$('svcToastTx').textContent=msg;$('svcToastCart').style.display=link?'':'none';
 bx.classList.toggle('err',!!err);bx.classList.remove('sv1-hide');clearTimeout(tt);tt=setTimeout(function(){bx.classList.add('sv1-hide')},4200)}
var add=$('svcAdd');
if(add)add.addEventListener('click',function(){
 if(!cartAdd(add)){toast(C.tx.fail,true,false);return}
 add.textContent=C.tx.added;setTimeout(function(){add.textContent=C.tx.addCart},1600);
 toast(C.tx.toast,false,true)});
// ---- طلب عرض سعر: تسليمٌ إلى محادثة الرئيسية (يُقرأ المفتاح ويُحذف هناك في خطوة واحدة).
var q=$('svcQuote');
if(q)q.addEventListener('click',function(){
 try{sessionStorage.setItem('bp_sva_request',JSON.stringify({items:[{code:C.code,title:C.name,why:C.gov||''}],door:C.door,text:C.name,name:C.name,code:C.code,at:Date.now()}))}catch(e){}});
})();</script>`;

  return SV1.shell({ title: v.title, desc: v.seoDesc, path: "/services/" + v.slug, body, script });
}
