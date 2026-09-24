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
};

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
        <div class="sv1-sum-line"><span>${esc(t("subtotal"))}</span><span class="v" id="cartNet">—</span></div>
        <div class="sv1-sum-line"><span>${esc(t("vat"))}</span><span class="v" id="cartVat">—</span></div>
        <div class="sv1-sum-total"><span>${esc(t("total"))}</span><span class="v" id="cartTotal">—</span></div>
        <a class="sv1-btn primary" id="cartGo" href="${home}checkout"
           style="width:100%;margin-top:16px;justify-content:center">${esc(t("checkout"))}</a>
        <p class="sv1-muted" id="cartHint" style="font-size:11.5px;margin:10px 0 0;line-height:1.7"></p>
        <p class="sv1-muted" style="font-size:11px;margin:10px 0 0;line-height:1.7">${esc(vatNote || t("note"))}</p>
      </aside>
    </div>
  </div></section>
  </main>
  ${SV1.footer()}`;

  const TX = {
    empty: t("empty"), browse: t("browse"), quoted: t("quoted"), hidden: t("hidden"),
    remove: t("remove"), needQuote: t("needQuote"), signIn: t("signIn"),
  };

  const script = `<script>(function(){
var CART="bp_cart",VAT=0.15,LANG=${JSON.stringify(lang)},HOME=${JSON.stringify(home)};
var TX=${JSON.stringify(TX)};
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

function draw(){
 var cart=readCart(),box=$('cartItems');box.innerHTML='';
 if(!cart.length){
  var e=document.createElement('p');e.className='sv1-muted';e.textContent=TX.empty;box.appendChild(e);
  var a=document.createElement('a');a.className='sv1-btn primary sm';a.href=HOME+'catalog';
  a.textContent=TX.browse;a.style.marginTop='12px';box.appendChild(a);
  $('cartNet').textContent='—';$('cartVat').textContent='—';$('cartTotal').textContent='—';
  $('cartGo').setAttribute('aria-disabled','true');$('cartGo').style.opacity='.45';
  $('cartGo').style.pointerEvents='none';$('cartHint').textContent='';
  return}

 var net=0,unpriced=0,hiddenN=0;
 cart.forEach(function(i,idx){
  net+=lineOf(i);
  if(!Number(i.amount))unpriced++;else if(!shown(i))hiddenN++;

  var r=document.createElement('div');r.className='sv1-cart-row';

  var nm=document.createElement('div');nm.className='nm';
  var b=document.createElement('b');b.textContent=nameOf(i);nm.appendChild(b);
  if(i.kind){var s=document.createElement('small');s.textContent=i.kind;nm.appendChild(s)}
  r.appendChild(nm);

  var q=document.createElement('div');q.className='sv1-qty';
  var dec=document.createElement('button');dec.type='button';dec.textContent='−';
  dec.setAttribute('aria-label','-');if((Number(i.qty)||1)<=1)dec.disabled=true;
  var val=document.createElement('span');val.textContent=String(Number(i.qty)||1);
  var inc=document.createElement('button');inc.type='button';inc.textContent='+';inc.setAttribute('aria-label','+');
  dec.onclick=function(){var c=readCart();c[idx].qty=Math.max(1,(Number(c[idx].qty)||1)-1);writeCart(c);draw()};
  inc.onclick=function(){var c=readCart();c[idx].qty=(Number(c[idx].qty)||1)+1;writeCart(c);draw()};
  q.appendChild(dec);q.appendChild(val);q.appendChild(inc);r.appendChild(q);

  var amt=document.createElement('div');amt.className='amt';
  if(!Number(i.amount)){amt.className='amt soft';amt.textContent=TX.quoted}
  else if(!shown(i)){amt.className='amt soft';amt.textContent=TX.hidden}
  else amt.textContent=money(lineOf(i));
  r.appendChild(amt);

  var del=document.createElement('button');del.type='button';del.className='sv1-del';
  del.textContent='✕';del.title=TX.remove;del.setAttribute('aria-label',TX.remove);
  del.onclick=function(){var c=readCart();c.splice(idx,1);writeCart(c);draw()};
  r.appendChild(del);

  box.appendChild(r)});

 var vat=Math.round(net*VAT*100)/100,total=Math.round((net+vat)*100)/100;
 var showTotals=!unpriced&&!hiddenN;
 $('cartNet').textContent=showTotals?money(net):'—';
 $('cartVat').textContent=showTotals?money(vat):'—';
 $('cartTotal').textContent=showTotals?money(total):'—';

 // الزر يبقى مفتوحاً حتى مع بندٍ غير مسعّر: الدفع هو حيث يُسجَّل الطلب ويراجعه
 // الفريق. لكن السبب يُقال هنا بدل أن يكتشفه العميل في الصفحة التالية.
 $('cartGo').removeAttribute('aria-disabled');$('cartGo').style.opacity='';$('cartGo').style.pointerEvents='';
 $('cartHint').textContent=unpriced?TX.needQuote:(hiddenN?TX.signIn:'');
}
draw();
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
