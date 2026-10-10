// Business Partner — Simple V1: السلة (/cart).
//
// كانت السلة آخر صفحةٍ قديمة في مسار الشراء: العميل يتصفّح الكتالوج بالتصميم
// الجديد، فتنقلب الهوية تحت يده في السلة، ثم تعود جديدةً في الدفع. انقلابٌ
// مرتان في ثلاث خطوات، وأسوؤها أنه يقع قبل الدفع مباشرة.
//
// الصفحة القديمة تبقى مبنيّة على /cart-classic — روابطها قد تكون في يد عميل،
// ولا شيء في الموقع الجديد يرسل إليها.
//
// **صيغة بند السلة تُقرأ هنا حرفياً كما تكتبها main.js و api/_simple.js:**
//
//   {id, nameAr, nameEn, amount, price, qty}
//
// «amount» هو الرقم. «price» عنوانٌ نصي («3,038 ر.س») لا رقم — وقراءته كرقم
// أخرجت NaN فصفراً من قبل، فظهر الإجمالي 0.00 ورفض مُيسّر التركيب. لا تقرأ
// «price» حسابياً أبداً.
//
// وصفحة الدفع تقرأ نفس المفتاح (bp_cart) بنفس القواعد، فأي اختلافٍ هنا يعني
// سلةً تعرض مبلغاً ودفعاً يطلب غيره.
import fs from "node:fs";
import path from "node:path";

const T = {
  title:   { ar: "سلة طلبك", en: "Your cart", fr: "Votre panier", zh: "您的购物车" },
  desc:    { ar: "راجع ما اخترته، ثم أكمل إلى الدفع — وتصلك فاتورتك الضريبية فور تأكيد الدفع.",
             en: "Review what you picked, then continue to payment — your tax invoice arrives the moment payment is confirmed.",
             fr: "Vérifiez votre sélection, puis passez au paiement — votre facture fiscale arrive dès confirmation.",
             zh: "确认所选项目后继续付款——确认后立即收到税务发票。" },
  items:   { ar: "البنود", en: "Items", fr: "Articles", zh: "项目" },
  summary: { ar: "الملخّص", en: "Summary", fr: "Récapitulatif", zh: "摘要" },
  subtotal:{ ar: "المجموع (الأتعاب)", en: "Subtotal (fees)", fr: "Sous-total (honoraires)", zh: "小计（服务费）" },
  vat:     { ar: "ضريبة القيمة المضافة ١٥٪", en: "VAT 15%", fr: "TVA 15 %", zh: "增值税 15%" },
  total:   { ar: "الإجمالي", en: "Total", fr: "Total", zh: "合计" },
  checkout:{ ar: "أكمل إلى الدفع", en: "Continue to payment", fr: "Passer au paiement", zh: "继续付款" },
  empty:   { ar: "سلتك فارغة.", en: "Your cart is empty.", fr: "Votre panier est vide.", zh: "您的购物车是空的。" },
  browse:  { ar: "تصفّح الخدمات", en: "Browse services", fr: "Parcourir les services", zh: "浏览服务" },
  remove:  { ar: "إزالة", en: "Remove", fr: "Retirer", zh: "移除" },
  quoted:  { ar: "يُسعّر عند المراجعة", en: "Quoted on review", fr: "Sur devis", zh: "审核后报价" },
  hidden:  { ar: "السعر يظهر بعد تسجيل الدخول", en: "Price shown after you sign in",
             fr: "Prix affiché après connexion", zh: "登录后显示价格" },
  note:    { ar: "الأسعار غير شاملة ضريبة القيمة المضافة، والرسوم الحكومية مستثناة وتُسدَّد للجهات بالتكلفة الفعلية.",
             en: "Prices exclude VAT. Government fees are excluded and paid to the authorities at actual cost.",
             fr: "Prix hors TVA. Les frais gouvernementaux sont exclus et payés aux autorités au coût réel.",
             zh: "价格不含增值税。政府费用不包含在内，按实际成本支付给相关部门。" },
  needQuote:{ ar: "بعض البنود تُسعّر عند المراجعة — يؤكد الفريق المبلغ النهائي قبل الدفع.",
             en: "Some items are quoted on review — the team confirms the final amount before payment.",
             fr: "Certains articles sont sur devis — l'équipe confirme le montant final avant paiement.",
             zh: "部分项目需审核后报价——团队将在付款前确认最终金额。" },
  signIn:  { ar: "سجّل الدخول لرؤية الأسعار وإكمال الطلب", en: "Sign in to see prices and complete your order",
             fr: "Connectez-vous pour voir les prix et finaliser", zh: "登录以查看价格并完成订单" },
  signInGo:{ ar: "سجّل الدخول", en: "Sign in", fr: "Se connecter", zh: "登录" },
  // الدفعة الواحدة والاشتراك لا يُعرضان كأنهما شيء واحد: الاشتراك يتكرر، والعميل
  // يجب أن يرى ذلك قبل الدفع لا بعده.
  onceHd:  { ar: "دفعة واحدة", en: "One-time", fr: "Paiement unique", zh: "一次性付款" },
  recHd:   { ar: "اشتراكات", en: "Subscriptions", fr: "Abonnements", zh: "订阅" },
  billM:   { ar: "شهرياً", en: "Monthly", fr: "Mensuel", zh: "每月" },
  billY:   { ar: "سنوياً", en: "Yearly", fr: "Annuel", zh: "每年" },
  onceLine:{ ar: "دفعة واحدة", en: "One-time items", fr: "Paiement unique", zh: "一次性项目" },
  recLine: { ar: "اشتراكات (قسط الفترة الأولى)", en: "Subscriptions (first period)", fr: "Abonnements (première période)", zh: "订阅（首期）" },
  recNote: { ar: "مبلغ الاشتراك المعروض هو قسط فترة واحدة (شهر أو سنة)، وهو ما يُدفع الآن.",
             en: "A subscription's amount is one period's instalment (a month or a year) — that is what is paid now.",
             fr: "Le montant d'un abonnement correspond à une période (mois ou année) — c'est ce qui est payé maintenant.",
             zh: "订阅金额为一个周期（一个月或一年）的费用，即现在支付的金额。" },
  // نوع البند: كان يُطبع كما هو في السلة («service» · «package») فيظهر إنجليزياً في صفحة عربية.
  k_service:     { ar: "خدمة", en: "Service", fr: "Service", zh: "服务" },
  k_package:     { ar: "باقة", en: "Package", fr: "Forfait", zh: "套餐" },
  k_subscription:{ ar: "اشتراك", en: "Subscription", fr: "Abonnement", zh: "订阅" },
  k_agent:       { ar: "مستشار ذكي", en: "AI advisor", fr: "Conseiller IA", zh: "AI 顾问" },
  k_employee:    { ar: "موظف ذكي", en: "AI employee", fr: "Employé IA", zh: "AI 员工" },
  k_misa:        { ar: "مسار مستثمر", en: "Investor track", fr: "Parcours investisseur", zh: "投资者通道" },
  k_trip:        { ar: "رحلة", en: "Trip", fr: "Voyage", zh: "行程" },
};

// أي بند يتكرر؟ السلة لا تحمل ذلك دائماً: صفحات الخدمات الجديدة تكتب billingPeriod فارغاً
// حتى للخدمة الشهرية، فيُعرف من الكتالوج وقت البناء (pricingModel / billingPeriod) ومن
// لاحقة المعرّف (pkg-…-monthly · …-yearly). الخريطة تلميح عرضٍ فقط — المبلغ المخصوم
// يقوله الخادم، وهذا لا يغيّر حساباً.
export function recurringMap() {
  const m = {};
  try {
    const c = JSON.parse(fs.readFileSync(path.resolve("site/assets/data/catalog.json"), "utf8"));
    for (const s of c.services || []) if (s.code && /^monthly$/i.test(String(s.pricingModel || ""))) m[String(s.code).toLowerCase()] = "monthly";
    for (const p of c.packages || []) {
      if (p.billingPeriod !== "monthly") continue;
      for (const k of [p.key, p.code]) if (k) m[String(k).toLowerCase()] = "monthly";
    }
  } catch {}
  return m;
}

export function buildSimpleCart(SV1, ctx) {
  const lang = ctx.lang();
  const t = (k) => (T[k][lang] != null ? T[k][lang] : T[k].en);
  const esc = ctx.esc;
  const home = lang === "en" ? "/" : "/" + lang + "/";

  let vatNote = "";
  try {
    const site = JSON.parse(fs.readFileSync(path.resolve("site/data/site.json"), "utf8"));
    vatNote = (site.commerce && (lang === "ar" ? site.commerce.vatNote : site.commerce.vatNoteEn)) || "";
  } catch {}

  const CSS = `<style>
.sv1-cart-grid{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:20px;align-items:start}
.sv1-cart-row{display:grid;grid-template-columns:1fr auto auto auto;gap:12px;align-items:center;
 padding:14px 0;border-bottom:1px solid var(--line2)}
.sv1-cart-row:last-child{border-bottom:0}
.sv1-cart-row .nm{min-width:0}
.sv1-cart-row .nm b{display:block;font-weight:500;color:var(--ink);font-size:14px;line-height:1.5}
.sv1-cart-row .nm small{display:block;color:var(--faint);font-size:11.5px;margin-top:2px}
.sv1-qty{display:inline-flex;align-items:center;border:1px solid var(--l);border-radius:9px;overflow:hidden}
.sv1-qty button{width:30px;height:30px;border:0;background:#fff;color:var(--ink);font-size:15px;cursor:pointer;line-height:1;font-family:inherit}
.sv1-qty button:hover{background:var(--g)}
.sv1-qty button:disabled{opacity:.35;cursor:default}
.sv1-qty span{min-width:30px;text-align:center;font-family:var(--fm);font-size:13px}
.sv1-cart-row .amt{font-family:var(--fm);font-size:13.5px;color:var(--ink);white-space:nowrap;text-align:end}
.sv1-cart-row .amt.soft{font-family:inherit;font-size:12px;color:var(--mut)}
.sv1-grp-hd{margin:18px 0 2px;font-size:12px;font-weight:600;color:var(--mut)}
.sv1-grp-hd:first-child{margin-top:0}
.sv1-bill{display:inline-block;margin-inline-start:6px;padding:1px 8px;border-radius:999px;font-size:10.5px;font-weight:600;
 background:var(--acSoft);color:var(--n);vertical-align:middle}
.sv1-del{border:0;background:none;color:var(--faint);cursor:pointer;font-size:15px;line-height:1;padding:6px}
.sv1-del:hover{color:#b91c1c}
.sv1-sum-line{display:flex;justify-content:space-between;gap:12px;padding:7px 0;font-size:13px;color:var(--mut)}
.sv1-sum-line .v{font-family:var(--fm);color:var(--t)}
.sv1-sum-total{display:flex;justify-content:space-between;gap:12px;padding:12px 0 0;margin-top:8px;
 border-top:1px solid var(--l);font-size:15px;font-weight:600;color:var(--ink)}
.sv1-sum-total .v{font-family:var(--fm)}
@media(max-width:860px){
 .sv1-cart-grid{grid-template-columns:1fr}
 .sv1-cart-row{grid-template-columns:1fr auto;row-gap:8px}
 .sv1-cart-row .amt{grid-column:1;text-align:start}
 .sv1-del{grid-row:1;grid-column:2}
}
</style>`;

  const body = `${SV1.header("/cart", { cta: false })}
  <main>
  <section class="sv1-sec"><div class="wrap">
    <div class="sv1-title" style="margin-bottom:26px;">
      <span class="sv1-tag">${esc(t("title"))}</span>
      <h2>${esc(t("title"))}</h2>
      <p>${esc(t("desc"))}</p>
    </div>

    <div class="sv1-cart-grid">
      <div class="sv1-panel">
        <h4>${esc(t("items"))}</h4>
        <div id="cartItems"></div>
      </div>

      <aside class="sv1-panel" id="cartSum">
        <h4>${esc(t("summary"))}</h4>
        <div class="sv1-sum-line sv1-hide" id="cartOnceRow"><span>${esc(t("onceLine"))}</span><span class="v" id="cartOnce">—</span></div>
        <div class="sv1-sum-line sv1-hide" id="cartRecRow"><span>${esc(t("recLine"))}</span><span class="v" id="cartRec">—</span></div>
        <div class="sv1-sum-line"><span>${esc(t("subtotal"))}</span><span class="v" id="cartNet">—</span></div>
        <div class="sv1-sum-line"><span>${esc(t("vat"))}</span><span class="v" id="cartVat">—</span></div>
        <div class="sv1-sum-total"><span>${esc(t("total"))}</span><span class="v" id="cartTotal">—</span></div>
        <a class="sv1-btn primary" id="cartGo" href="${home}checkout"
           style="width:100%;margin-top:16px;justify-content:center">${esc(t("checkout"))}</a>
        <p class="sv1-muted" id="cartHint" style="font-size:11.5px;margin:10px 0 0;line-height:1.7"></p>
        <p class="sv1-muted" id="cartRecNote" style="font-size:11.5px;margin:8px 0 0;line-height:1.7"></p>
        <p class="sv1-muted" style="font-size:11px;margin:10px 0 0;line-height:1.7">${esc(vatNote || t("note"))}</p>
      </aside>
    </div>
  </div></section>
  </main>
  ${SV1.footer()}`;

  const TX = {
    empty: t("empty"), browse: t("browse"), quoted: t("quoted"), hidden: t("hidden"),
    remove: t("remove"), needQuote: t("needQuote"), signIn: t("signIn"), signInGo: t("signInGo"),
    onceHd: t("onceHd"), recHd: t("recHd"), billM: t("billM"), billY: t("billY"), recNote: t("recNote"),
    kinds: Object.fromEntries(["service", "package", "subscription", "agent", "employee", "misa", "trip"].map((k) => [k, t("k_" + k)])),
  };

  const script = `<script>(function(){
var CART="bp_cart",VAT=0.15,LANG=${JSON.stringify(lang)},HOME=${JSON.stringify(home)};
var TX=${JSON.stringify(TX)};
var REC=${JSON.stringify(recurringMap())};
var $=function(id){return document.getElementById(id)};
function money(n){return (Math.round(Number(n||0)*100)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' ﷼'}
function readCart(){try{return JSON.parse(localStorage.getItem(CART))||[]}catch(e){return []}}
function writeCart(c){try{localStorage.setItem(CART,JSON.stringify(c))}catch(e){}
 try{document.dispatchEvent(new CustomEvent('bp:cart'))}catch(e){}}
// نفس قواعد صفحة الدفع حرفاً بحرف — أي اختلاف يعني سلةً تعرض مبلغاً ودفعاً يطلب غيره.
function lineOf(i){return (Number(i.amount)||0)*(Number(i.qty)||1)}
function nameOf(i){var ar=i.nameAr||'',en=i.nameEn||'';return (LANG==='ar'?ar:en)||ar||en||i.name||i.title||i.id||''}
var PRICES_ON=document.documentElement.getAttribute('data-prices')==='on';
function shown(i){return !!(i&&Number(i.amount)&&(PRICES_ON||i.pricePublic))}
// دورة الدفع: ما كتبته الصفحة (billingPeriod) أولاً، ثم لاحقة المعرّف، ثم الكتالوج.
function billOf(i){
 var b=String((i&&i.billingPeriod)||'').toLowerCase();
 if(b==='monthly'||b==='yearly')return b;
 var id=String((i&&i.id)||'').toLowerCase();
 if(/-yearly$/.test(id))return 'yearly';
 if(/-monthly$/.test(id))return 'monthly';
 return REC[id.replace(/^(svc|pkg)-/,'')]||''}
function billLabel(b){return b==='yearly'?TX.billY:TX.billM}
function kindOf(i){var k=String((i&&i.kind)||'service');return TX.kinds[k]||TX.kinds.service}

// جلسةٌ صالحة بلا مفتاح bp_session في المتصفح (أول زيارة بعد الدخول من /my مثلاً) كانت
// تُعامَل كضيف: «السعر يظهر بعد تسجيل الدخول» لعميلٍ داخلٍ فعلاً. يُسأل الخادم مرة، وفقط
// إن كان في السلة بندٌ مسعّر محجوب — وللضيف الفعلي لا يتغيّر شيء.
function needsSession(){return !PRICES_ON&&readCart().some(function(i){return Number(i.amount)&&!i.pricePublic})}
function checkSession(done){
 if(!needsSession()){done();return}
 var fin=false;function end(){if(!fin){fin=true;done()}}
 setTimeout(end,2500);
 fetch('/api/otp',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:'{"action":"me"}'})
  .then(function(r){return r.json()}).then(function(o){
   if(o&&o.session&&o.session.user){PRICES_ON=true;document.documentElement.setAttribute('data-prices','on')}
   end()}).catch(end)}

var EMPRE=/^BP-EMP-/i;
// سعر بند الاشتراك يقوله الخادم (/api/pay?action=emp-offer) لا الصفحة التي أضافته؛
// تُصحَّح السلة مرة واحدة عند الفتح، وصفحة الدفع تعيد التصحيح قبل أن تأخذ مبلغاً.
(function syncEmp(){
 readCart().forEach(function(it,idx){
  if(!EMPRE.test(String(it.id||'')))return;
  fetch('/api/pay?action=emp-offer&sku='+encodeURIComponent(it.id)).then(function(r){return r.json()}).then(function(o){
   var c=readCart(),cur=c[idx];if(!cur||cur.id!==it.id)return;
   var next=(o&&o.ok)?{amount:o.amountSar,qty:1,pricePublic:true,nameAr:o.name.ar,nameEn:o.name.en}:{amount:0,qty:1};
   var same=Number(cur.amount)===next.amount&&(Number(cur.qty)||1)===1;
   if(same)return;
   Object.keys(next).forEach(function(k){cur[k]=next[k]});writeCart(c)}).catch(function(){})})})();

function draw(){
 var cart=readCart(),box=$('cartItems');box.innerHTML='';
 if(!cart.length){
  var e=document.createElement('p');e.className='sv1-muted';e.textContent=TX.empty;box.appendChild(e);
  var a=document.createElement('a');a.className='sv1-btn primary sm';a.href=HOME+'catalog';
  a.textContent=TX.browse;a.style.marginTop='12px';box.appendChild(a);
  $('cartNet').textContent='—';$('cartVat').textContent='—';$('cartTotal').textContent='—';
  $('cartGo').setAttribute('aria-disabled','true');$('cartGo').style.opacity='.45';
  $('cartGo').style.pointerEvents='none';$('cartHint').textContent='';
  $('cartOnceRow').classList.add('sv1-hide');$('cartRecRow').classList.add('sv1-hide');$('cartRecNote').textContent='';
  return}

 var net=0,unpriced=0,hiddenN=0,onceNet=0,recNet=0,onceN=0,recN=0;
 // دفعة واحدة أولاً ثم الاشتراكات، ولا عنوان للمجموعتين إلا إن اجتمعتا.
 var once=[],rec=[];
 cart.forEach(function(i,idx){
  net+=lineOf(i);
  if(!Number(i.amount))unpriced++;else if(!shown(i))hiddenN++;
  var bl=billOf(i);
  if(bl){recNet+=lineOf(i);recN++;rec.push([i,idx,bl])}else{onceNet+=lineOf(i);onceN++;once.push([i,idx,''])}});
 [[once,TX.onceHd],[rec,TX.recHd]].forEach(function(g){
  if(!g[0].length)return;
  if(once.length&&rec.length){var hd=document.createElement('div');hd.className='sv1-grp-hd';hd.textContent=g[1];box.appendChild(hd)}
  g[0].forEach(function(x){box.appendChild(rowEl(x[0],x[1],x[2]))})});

 function rowEl(i,idx,bl){
  var r=document.createElement('div');r.className='sv1-cart-row';

  var nm=document.createElement('div');nm.className='nm';
  var b=document.createElement('b');b.textContent=nameOf(i);nm.appendChild(b);
  // نوع البند بالعربية (كان يُطبع «service» · «package» كما في السلة) ووسم الدورة للاشتراك.
  var s=document.createElement('small');s.textContent=kindOf(i);
  if(bl){var pill=document.createElement('span');pill.className='sv1-bill';pill.textContent=billLabel(bl);s.appendChild(pill)}
  nm.appendChild(s);
  r.appendChild(nm);

  var q=document.createElement('div');q.className='sv1-qty';
  var isEmp=EMPRE.test(String(i.id||''));
  var dec=document.createElement('button');dec.type='button';dec.textContent='−';
  dec.setAttribute('aria-label','-');if((Number(i.qty)||1)<=1)dec.disabled=true;
  var val=document.createElement('span');val.textContent=String(Number(i.qty)||1);
  var inc=document.createElement('button');inc.type='button';inc.textContent='+';inc.setAttribute('aria-label','+');
  dec.onclick=function(){var c=readCart();c[idx].qty=Math.max(1,(Number(c[idx].qty)||1)-1);writeCart(c);draw()};
  inc.onclick=function(){var c=readCart();c[idx].qty=(Number(c[idx].qty)||1)+1;writeCart(c);draw()};
  // اشتراك منصة التوظيف واحدٌ لا يُضاعَف: لا أزرار كمية له.
  if(!isEmp){q.appendChild(dec);q.appendChild(val);q.appendChild(inc)}
  r.appendChild(q);

  var amt=document.createElement('div');amt.className='amt';
  if(!Number(i.amount)){amt.className='amt soft';amt.textContent=TX.quoted}
  else if(!shown(i)){amt.className='amt soft';amt.textContent=TX.hidden}
  else amt.textContent=money(lineOf(i));
  r.appendChild(amt);

  var del=document.createElement('button');del.type='button';del.className='sv1-del';
  del.textContent='✕';del.title=TX.remove;del.setAttribute('aria-label',TX.remove);
  del.onclick=function(){var c=readCart();c.splice(idx,1);writeCart(c);draw()};
  r.appendChild(del);
  return r}

 var vat=Math.round(net*VAT*100)/100,total=Math.round((net+vat)*100)/100;
 var showTotals=!unpriced&&!hiddenN;
 $('cartNet').textContent=showTotals?money(net):'—';
 $('cartVat').textContent=showTotals?money(vat):'—';
 $('cartTotal').textContent=showTotals?money(total):'—';
 // تفصيل المجموع يظهر حين يوجد اشتراك فقط؛ والمجموع الكلي لا يتغيّر (نفس حساب صفحة الدفع).
 $('cartOnceRow').classList.toggle('sv1-hide',!(showTotals&&recN&&onceN));
 $('cartRecRow').classList.toggle('sv1-hide',!(showTotals&&recN));
 $('cartOnce').textContent=money(onceNet);$('cartRec').textContent=money(recNet);
 $('cartRecNote').textContent=recN?TX.recNote:'';

 // الزر يبقى مفتوحاً حتى مع بندٍ غير مسعّر: الدفع هو حيث يُسجَّل الطلب ويراجعه
 // الفريق. لكن السبب يُقال هنا بدل أن يكتشفه العميل في الصفحة التالية.
 $('cartGo').removeAttribute('aria-disabled');$('cartGo').style.opacity='';$('cartGo').style.pointerEvents='';
 var hint=$('cartHint');hint.textContent='';
 if(unpriced)hint.textContent=TX.needQuote;
 else if(hiddenN){
  // رابط الدخول يعيد العميل إلى السلة لا إلى لوحته (next) — مثل مسار «طلب عرض السعر».
  hint.appendChild(document.createTextNode(TX.signIn+' · '));
  var a2=document.createElement('a');a2.href=HOME+'my?next='+encodeURIComponent(HOME+'cart');a2.textContent=TX.signInGo;hint.appendChild(a2)}
}
checkSession(function(){draw()});
document.addEventListener('bp:cart',draw);
window.addEventListener('storage',function(e){if(e.key===CART)draw()});
})();</script>`;

  return SV1.shell({
    title: `${t("title")} — Business Partner`,
    desc: t("desc"),
    path: "/cart",
    body: CSS + body,
    script,
    noindex: true,
  });
}
