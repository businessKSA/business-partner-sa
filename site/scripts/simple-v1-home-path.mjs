// Business Partner — Simple V1: إضافات الرئيسية «تحت المحادثة» (أمر المالك 2026-10-11).
//
// القاعدة: المحادثة (المستشار الذكي بأبوابه الثلاثة وبطاقة EOR) هي أساس الرئيسية
// وتبقى في الأعلى كما كانت حرفاً. هذا الملف لا يرسم شيئاً فوقها. ما يضيفه أقسامٌ
// مستقلة تأتي بعد قسم #advisor مباشرة، ولكل قسم مفتاح في site/data/features.json:
//
//   "homeExtras": { "search": true, "how": true, "popular": true, "faq": true }
//
// حذف قسم = تغيير قيمته إلى false (أو حذف سطره) ثم البناء. غياب المفتاح كله يعني
// الرئيسية القديمة بلا أي إضافة. الأقسام:
//   search  — شريط «ابحث عن خدمتك»: اقتراحات فورية من الأسماء الظاهرة المضمَّنة وقت
//             البناء (ما أُخفي في site/data/hidden.json لا يظهر)، و«كل النتائج»
//             تنقل إلى /catalog?q= حيث يعمل بحث الكتالوج نفسه — لا محرّك جديد.
//   how     — «كيف يعمل» بأربع خطوات وثلاث جمل ثقة.
//   popular — ست خدمات شائعة بلا أسعار (SHOW_PRICES=false): زر «أضف للسلة» لما له
//             سعر في الكتالوج وليس عقاراً ولا سياحة (عقد السلة `localStorage.bp_cart`)،
//             و«التفاصيل» إلى صفحة الخدمة.
//   faq     — أربعة أسئلة سريعة.
//
// لا واتساب في المحتوى (الزر العائم وحده) ولا سعر ولا رقم حكومي مخترع.
import fs from "node:fs";
import path from "node:path";
import { visibleCatalogRows } from "./hidden.mjs";

// ست خدمات شائعة بأكوادها (اختيار تحريري لا بيانات مخترعة): تُرسم من الكتالوج
// المبني بأسمائه، وما أُخفي أو غاب عن الكتالوج يُسقَط ولا يترك فراغاً.
const POPULAR = ["BP-SBC-02", "BP-SBC-19", "BP-ZATCA-04", "BP-GOSI-01", "BP-MUQEEM-03", "BP-SAIP-01"];
const NO_CART = new Set(["Real Estate", "Tourism"]);

export const HOME_EXTRA_KEYS = ["search", "how", "popular", "faq"];

// نصوص الإضافات بالأربع لغات — هنا لا في قاموس الرئيسية حتى يبقى جسم الرئيسية
// القديم كما هو، وتُحذف الإضافات كلها بحذف هذا الملف وأربعة أسطر.
export const HOME_EXTRAS_TEXT = {
  findTitle: { ar: "ابحث عن خدمتك", en: "Find your service", fr: "Trouvez votre service", zh: "查找您的服务" },
  findSub: { ar: "تعرف اسم الخدمة؟ اكتب جزءاً منه وانتقل إليها مباشرة.", en: "Know the service name? Type part of it and go straight to it.", fr: "Vous connaissez le nom du service ? Tapez-en une partie et allez-y directement.", zh: "知道服务名称？输入部分名称即可直达。" },
  // الأسماء في صفحات fr وzh إنجليزية (كما في /catalog)، فمثالها إنجليزي ليطابق ما يُكتب.
  findPh: { ar: "مثال: تجديد سجل تجاري", en: "e.g. Commercial registration renewal", fr: "ex. Commercial registration renewal", zh: "例如：Commercial registration renewal" },
  findGo: { ar: "ابحث", en: "Search", fr: "Rechercher", zh: "搜索" },
  none: { ar: "لا نتيجة مطابقة. جرّب كلمة أعمّ أو اشرح احتياجك في المحادثة أعلاه.", en: "No match. Try a broader word or describe your need in the chat above.", fr: "Aucun résultat. Essayez un mot plus large ou décrivez votre besoin dans la conversation ci-dessus.", zh: "没有匹配项。请尝试更宽泛的词，或在上方对话中说明需求。" },
  sugAll: { ar: "عرض كل النتائج في الخدمات", en: "See all results in Services", fr: "Voir tous les résultats", zh: "查看全部结果" },
  how: { ar: "كيف يعمل", en: "How it works", fr: "Comment ça marche", zh: "如何运作" },
  s1: { ar: "اختر", en: "Choose", fr: "Choisissez", zh: "选择" },
  s1s: { ar: "ابحث عن خدمتك أو اشرح احتياجك للمستشار.", en: "Find your service or describe your need to the advisor.", fr: "Trouvez votre service ou décrivez votre besoin au conseiller.", zh: "查找服务，或向顾问说明需求。" },
  s2: { ar: "قدّم طلبك أو اشترِ", en: "Request or buy", fr: "Demandez ou achetez", zh: "申请或购买" },
  s2s: { ar: "اشترِ الجاهز بالسلة، أو اطلب عرض سعر لما يحتاج نطاقاً.", en: "Buy ready services with the cart, or ask for a quotation when scope is needed.", fr: "Achetez les services prêts au panier, ou demandez un devis si un périmètre est nécessaire.", zh: "现成服务直接加入购物车购买；需确定范围的可申请报价。" },
  s3: { ar: "ادفع إلكترونياً", en: "Pay online", fr: "Payez en ligne", zh: "在线支付" },
  s3s: { ar: "بطاقة (مدى · فيزا · ماستركارد) أو تقسيط تمارا.", en: "Card (mada · Visa · Mastercard) or Tamara instalments.", fr: "Carte (mada · Visa · Mastercard) ou paiement en plusieurs fois avec Tamara.", zh: "银行卡（mada · Visa · Mastercard）或 Tamara 分期。" },
  s4: { ar: "تابع واستلم عملك", en: "Follow and receive your work", fr: "Suivez et recevez votre travail", zh: "跟进并接收成果" },
  s4s: { ar: "داخل لوحتك: الحالة والمستندات والفاتورة.", en: "Inside your account: status, documents and invoice.", fr: "Dans votre compte : statut, documents et facture.", zh: "在您的账户中：状态、文件与发票。" },
  t1: { ar: "الأسعار قبل الضريبة وتُعرض للمسجّلين", en: "Prices are before VAT and shown to registered users", fr: "Les prix sont hors TVA et affichés aux utilisateurs inscrits", zh: "价格不含增值税，仅向注册用户显示" },
  t2: { ar: "دفع إلكتروني فقط", en: "Online payment only", fr: "Paiement en ligne uniquement", zh: "仅支持在线支付" },
  t3: { ar: "تتبّع وتسليم داخل لوحتك", en: "Tracking and delivery inside your account", fr: "Suivi et livraison dans votre compte", zh: "在您的账户中跟进与交付" },
  popular: { ar: "خدمات شائعة", en: "Popular services", fr: "Services courants", zh: "常用服务" },
  add: { ar: "أضف للسلة", en: "Add to cart", fr: "Ajouter au panier", zh: "加入购物车" },
  cart: { ar: "أُضيف — عرض السلة ←", en: "Added — view cart →", fr: "Ajouté — voir le panier →", zh: "已加入 — 查看购物车 →" },
  details: { ar: "التفاصيل", en: "Details", fr: "Détails", zh: "详情" },
  all: { ar: "تصفّح كل الخدمات", en: "Browse all services", fr: "Parcourir tous les services", zh: "浏览全部服务" },
  faq: { ar: "أسئلة سريعة", en: "Quick questions", fr: "Questions rapides", zh: "常见问题" },
  q1: { ar: "هل يجب أن أعرف اسم الخدمة؟", en: "Do I need to know the name of the service?", fr: "Dois-je connaître le nom du service ?", zh: "我需要知道服务名称吗？" },
  a1: { ar: "لا. اشرح احتياجك للمستشار الذكي فيقترح لك نطاق الخدمات، وتراجعه وتعدّله قبل عرض السعر.", en: "No. Describe your need to the smart advisor; it proposes the scope of services and you review and edit it before the quotation.", fr: "Non. Décrivez votre besoin au conseiller intelligent : il propose le périmètre, que vous revoyez et modifiez avant le devis.", zh: "不需要。向智能顾问说明需求，它会提出服务范围，您在报价前可自行检查和修改。" },
  q2: { ar: "كم تكلفة الخدمة؟", en: "How much does a service cost?", fr: "Combien coûte un service ?", zh: "服务费用是多少？" },
  a2: { ar: "تظهر الأسعار للمسجّلين بعد الدخول، وهي قبل ضريبة القيمة المضافة. الرسوم الحكومية، إن وُجدت، منفصلة عن الأتعاب وتُعلن قبل البدء.", en: "Prices appear after you sign in and are before VAT. Government fees, where they apply, are separate from our fees and announced before work starts.", fr: "Les prix s'affichent après connexion et sont hors TVA. Les frais gouvernementaux, le cas échéant, sont distincts de nos honoraires et annoncés avant le début.", zh: "登录后显示价格，且不含增值税。政府规费（如有）与服务费分开，并在开始前告知。" },
  q3: { ar: "كيف أدفع؟", en: "How do I pay?", fr: "Comment payer ?", zh: "如何付款？" },
  a3: { ar: "إلكترونياً فقط: بطاقة (مدى · فيزا · ماستركارد) أو التقسيط عبر تمارا، وتصلك فاتورة ضريبية عن كل عملية مدفوعة.", en: "Online only: card (mada · Visa · Mastercard) or instalments with Tamara, and you receive a tax invoice for every paid order.", fr: "En ligne uniquement : carte (mada · Visa · Mastercard) ou paiement en plusieurs fois avec Tamara, avec une facture fiscale pour chaque commande payée.", zh: "仅限在线支付：银行卡（mada · Visa · Mastercard）或 Tamara 分期，每笔已付订单均开具税务发票。" },
  q4: { ar: "أين أتابع طلبي؟", en: "Where do I follow my request?", fr: "Où suivre ma demande ?", zh: "在哪里跟进我的申请？" },
  a4: { ar: "في حسابك: اضغط «حسابي» وسجّل دخولك برمز يصلك على بريدك.", en: "In your account: press “My account” and sign in with a code sent to your email.", fr: "Dans votre compte : cliquez sur « Mon compte » et connectez-vous avec un code envoyé par e-mail.", zh: "在您的账户中：点击“我的账户”，使用发送到邮箱的验证码登录。" },
};

// المفاتيح المفعّلة من features.json. أي خلل في القراءة = لا إضافات (الرئيسية القديمة).
export function homeExtraFlags() {
  try {
    const f = JSON.parse(fs.readFileSync(new URL("../data/features.json", import.meta.url), "utf8")).homeExtras || {};
    return Object.fromEntries(HOME_EXTRA_KEYS.map((k) => [k, f[k] === true]));
  } catch {
    return Object.fromEntries(HOME_EXTRA_KEYS.map((k) => [k, false]));
  }
}

export function buildHomeExtras({ esc, href, lang, flags = homeExtraFlags() }) {
  const l = lang();
  const ar = l === "ar";
  const arrow = ar ? "←" : "→";
  const t = (k) => (HOME_EXTRAS_TEXT[k] || {})[l] || (HOME_EXTRAS_TEXT[k] || {}).en || "";

  let raw = { services: [] };
  try { raw = JSON.parse(fs.readFileSync(path.resolve("site/assets/data/catalog.json"), "utf8")); } catch {}
  const rows = visibleCatalogRows(raw.services || []);
  const nameOf = (s) => (ar ? s.nameAr : s.nameEn) || s.nameAr || s.nameEn || "";

  let search = "", how = "", popular = "", faq = "";
  let data = "";

  if (flags.search) {
    // مصفوفة مضغوطة للاقتراحات: [الاسم بلغة الصفحة، الـslug، نص البحث الأولي]
    const idx = rows.filter((s) => s.code && nameOf(s)).map((s) => [nameOf(s), s.code.toLowerCase(), `${s.nameAr || ""} ${s.nameEn || ""} ${s.code}`]);
    data += `var SVC=${JSON.stringify(idx)},TXS=${JSON.stringify({ none: t("none"), all: t("sugAll") })},CATALOG=${JSON.stringify(href("/catalog"))},SERV=${JSON.stringify(href("/services/"))};\n`;
    search = `
  <section class="sv1-sec sv1-hx" id="find" data-home-extra="search"><div class="wrap">
    <div class="sv1-title"><h2>${t("findTitle")}</h2><p>${t("findSub")}</p></div>
    <form class="sv1-psearch" id="hpSearch" action="${esc(href("/catalog"))}" method="get" role="search" autocomplete="off">
      <label for="hpQ" class="sv1-vh">${t("findTitle")}</label>
      <div class="row">
        <input id="hpQ" name="q" type="search" placeholder="${esc(t("findPh"))}" enterkeyhint="search">
        <button type="submit" class="sv1-btn primary" data-track="بحث الرئيسية">${t("findGo")}</button>
      </div>
      <div class="sv1-psug" id="hpSug" hidden></div>
    </form>
  </div></section>`;
  }

  if (flags.how) {
    const steps = [1, 2, 3, 4].map((n) => `<li><i>${n}</i><b>${t("s" + n)}</b><small>${t("s" + n + "s")}</small></li>`).join("");
    how = `
  <section class="sv1-sec sv1-gray sv1-hx" id="how-steps" data-home-extra="how"><div class="wrap">
    <div class="sv1-title"><h2>${t("how")}</h2></div>
    <ol class="sv1-hsteps">${steps}</ol>
    <ul class="sv1-htrust"><li><b>${t("t1")}</b></li><li><b>${t("t2")}</b></li><li><b>${t("t3")}</b></li></ul>
  </div></section>`;
  }

  if (flags.popular) {
    const pops = POPULAR.map((c) => rows.find((s) => s.code === c)).filter(Boolean).map((s) => ({
      slug: s.code.toLowerCase(),
      name: nameOf(s),
      buy: s.amount != null && Number(s.amount) > 0 && !NO_CART.has(s.category)
        ? { id: "svc-" + s.code.toLowerCase(), nameAr: s.nameAr || s.nameEn || "", nameEn: s.nameEn || s.nameAr || "", amount: Number(s.amount) }
        : null,
    }));
    if (pops.length) {
      data += `var POP=${JSON.stringify(pops)},CART=${JSON.stringify(href("/cart"))},TXC=${JSON.stringify({ cart: t("cart") })};\n`;
      popular = `
  <section class="sv1-sec sv1-hx" id="popular" data-home-extra="popular"><div class="wrap">
    <div class="sv1-title"><h2>${t("popular")}</h2></div>
    <div class="sv1-pops">${pops.map((p, i) => `<div class="sv1-pop">
      <b>${esc(p.name)}</b>
      <div class="acts">${p.buy ? `<button type="button" class="sv1-btn primary sm" data-pop="${i}" data-track="أضف للسلة">${t("add")}</button>` : ""}<a class="sv1-btn sm" href="${esc(href("/services/" + p.slug))}">${t("details")}</a></div>
    </div>`).join("")}</div>
    <p class="sv1-pall"><a href="${esc(href("/catalog"))}" data-track="تصفّح الخدمات واشترِ مباشرة">${t("all")} ${arrow}</a></p>
  </div></section>`;
    }
  }

  if (flags.faq) {
    faq = `
  <section class="sv1-sec sv1-gray sv1-hx" id="faq" data-home-extra="faq"><div class="wrap">
    <div class="sv1-title"><h2>${t("faq")}</h2></div>
    <div class="sv1-faq">${[1, 2, 3, 4].map((n) => `<details><summary>${t("q" + n)}</summary><p>${t("a" + n)}</p></details>`).join("")}</div>
  </div></section>`;
  }

  const any = search || how || popular || faq;
  if (!any) return { search, how, popular, faq, css: "", script: "" };

  const css = `<style id="sv1-extras-css">
.sv1-vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.sv1-hx .sv1-title{text-align:center}
.sv1-psearch{position:relative;max-width:660px;margin:0 auto;text-align:start}
.sv1-psearch .row{display:flex;gap:8px}
.sv1-psearch input{flex:1;min-width:0;border:1.5px solid var(--acLine);border-radius:12px;padding:14px 16px;font:inherit;font-size:16px;background:#fff;outline:none;box-shadow:var(--sh)}
.sv1-psearch input:focus{border-color:var(--ac)}
.sv1-psearch .sv1-btn{padding:0 24px;border-radius:12px;font-size:15px}
.sv1-psug{position:absolute;inset-inline:0;top:calc(100% + 4px);z-index:15;background:#fff;border:1px solid var(--l);border-radius:12px;box-shadow:var(--sh2);padding:6px;display:grid;text-align:start}
.sv1-psug[hidden]{display:none}
.sv1-psug a{padding:10px 12px;border-radius:8px;font-size:14px;color:var(--ink)}
.sv1-psug a:hover,.sv1-psug a:focus{background:var(--acSoft)}
.sv1-psug a.all{color:var(--ac);font-weight:600;border-top:1px solid var(--line2);border-radius:0 0 8px 8px;margin-top:4px}
.sv1-psug .none{padding:10px 12px;font-size:13px;color:var(--mut)}
.sv1-hsteps{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.sv1-hsteps li{background:#fff;border:1px solid var(--l);border-radius:12px;padding:18px;text-align:center}
.sv1-hsteps i{font-style:normal;font-family:var(--fm);width:34px;height:34px;background:var(--acSoft);color:var(--ac);border-radius:9px;display:grid;place-items:center;margin:0 auto 10px;font-weight:500;font-size:13px}
.sv1-hsteps b{display:block;font-size:15px;color:var(--ink);font-weight:600}
.sv1-hsteps small{display:block;font-size:12.5px;color:var(--s);margin-top:4px;line-height:1.65}
.sv1-htrust{list-style:none;margin:18px 0 0;padding:0;display:flex;gap:8px 26px;flex-wrap:wrap;justify-content:center;font-size:13.5px;color:var(--t)}
.sv1-htrust li::before{content:"✓";color:var(--ok);font-weight:700;margin-inline-end:7px}
.sv1-htrust b{font-weight:500}
.sv1-pops{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.sv1-pop{display:flex;flex-direction:column;justify-content:space-between;gap:14px;background:#fff;border:1px solid var(--l);border-radius:12px;padding:16px}
.sv1-pop>b{font-size:15px;color:var(--ink);font-weight:600;line-height:1.55}
.sv1-pop .acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.sv1-pall{text-align:center;margin:18px 0 0;font-size:14px}
.sv1-pall a{color:var(--ac);font-weight:600}
.sv1-faq{max-width:760px;margin:0 auto;display:grid;gap:8px}
.sv1-faq details{background:#fff;border:1px solid var(--l);border-radius:12px;padding:0 16px}
.sv1-faq summary{cursor:pointer;padding:14px 0;font-weight:600;color:var(--ink);font-size:14.5px}
.sv1-faq p{margin:0 0 14px;color:var(--s);font-size:13.5px;line-height:1.85}
@media(max-width:900px){.sv1-hsteps{grid-template-columns:1fr 1fr}.sv1-pops{grid-template-columns:1fr 1fr}}
@media(max-width:600px){
 .sv1-psearch input{padding:12px 13px;font-size:15px}
 .sv1-psearch .sv1-btn{padding:0 16px;font-size:14px}
 .sv1-hsteps,.sv1-pops{grid-template-columns:1fr}
}
</style>`;

  const script = `<script>
(function(){
${data}var $=function(id){return document.getElementById(id)};
${flags.search ? `// تطبيع خفيف يطابق بحث /catalog: حروف صغيرة، وهمزات وتاء مربوطة وألف مقصورة وتشكيل.
function norm(s){return String(s||'').toLowerCase().replace(/[\\u064B-\\u0652\\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي')}
var q=$('hpQ'),sug=$('hpSug');
if(q&&sug){
 var IDX=SVC.map(function(r){return {n:r[0],s:r[1],h:norm(r[0]+' '+r[2])}});
 var draw=function(){
  var v=norm(q.value).trim();sug.innerHTML='';
  if(v.length<2){sug.hidden=true;return}
  var tk=v.split(/\\s+/),hits=IDX.filter(function(r){return tk.every(function(x){return r.h.indexOf(x)>=0})});
  hits.slice(0,6).forEach(function(r){var a=document.createElement('a');a.href=SERV+r.s;a.textContent=r.n;sug.appendChild(a)});
  if(!hits.length){var d=document.createElement('div');d.className='none';d.textContent=TXS.none;sug.appendChild(d)}
  var all=document.createElement('a');all.className='all';all.href=CATALOG+'?q='+encodeURIComponent(q.value.trim());all.textContent=TXS.all+(hits.length>6?' ('+hits.length+')':'');sug.appendChild(all);
  sug.hidden=false};
 q.addEventListener('input',draw);
 q.addEventListener('keydown',function(e){if(e.key==='Escape')sug.hidden=true});
 document.addEventListener('click',function(e){if(!$('hpSearch').contains(e.target))sug.hidden=true});
}` : ""}
${flags.popular ? `// السلة: عقد صفحات الخدمات وsimple-v1-catalog.mjs نفسه (bp_cart، qty يزيد).
function cartAdd(b){var c;try{c=JSON.parse(localStorage.getItem('bp_cart'))||[];if(!Array.isArray(c))c=[]}catch(e){c=[]}
 var ex=c.filter(function(x){return x.id===b.id})[0];
 if(ex)ex.qty=(ex.qty||1)+1;else c.push({id:b.id,nameEn:b.nameEn||'',nameAr:b.nameAr||'',amount:b.amount?Number(b.amount):null,price:'',kind:'service',qty:1,surchargeAmount:null,surchargeFreeCount:null,pricePublic:0,billingPeriod:'',renewsAt:null,commissionPercent:0});
 try{localStorage.setItem('bp_cart',JSON.stringify(c))}catch(e){return false}
 try{document.dispatchEvent(new CustomEvent('bp:cart',{bubbles:true}))}catch(e){}return true}
Array.prototype.forEach.call(document.querySelectorAll('[data-pop]'),function(btn){btn.onclick=function(){
 var p=POP[Number(btn.getAttribute('data-pop'))];if(!p||!p.buy||!cartAdd(p.buy))return;
 var a=document.createElement('a');a.className='sv1-btn sm';a.href=CART;a.textContent=TXC.cart;btn.parentNode.replaceChild(a,btn)}});` : ""}
})();</script>`;

  return { search, how, popular, faq, css, script };
}
