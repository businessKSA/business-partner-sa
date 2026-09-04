// Business Partner — Simple V1: صفحة الدفع (/checkout).
//
// كان الدفع يفتح صفحة الموقع القديم: ترويسة أخرى، وتصميم آخر، ومسار يخرج
// العميل من الموقع الذي جاء منه في أحرج لحظة — لحظة الدفع.
//
// هذه الصفحة تحلّ محلّها بتصميم Simple V1، **وتستعمل نفس آلة الدفع بحرفها**:
//
//   • السلة        localStorage["bp_cart"]        — سلة العميل الحالية تنتقل كما هي
//   • لقطة الطلب   sessionStorage["bp_pay_order"] — والمرجع فيها يبقى ثابتاً
//   • الإعداد      GET  /api/pay
//   • تمارا        POST /api/pay {action:"bnpl-checkout"}
//   • البطاقة      نموذج مُيسّر بنفس الحقول والبيانات الوصفية
//
// البيانات الوصفية بالذات تُنسخ حرفياً: هي ما يسمح لخطّاف مُيسّر بتفعيل الطلب
// حين يدفع العميل ثم يغلق الصفحة قبل أن يعود. شكلٌ مختلف للبيانات = دفعةٌ
// وصلت ولا أحد يعرف لمن.
import fs from "node:fs";
import path from "node:path";

const T = {
  title:   { ar: "إتمام الدفع", en: "Checkout", fr: "Paiement", zh: "结账" },
  desc:    { ar: "ادفع بالبطاقة أو Apple Pay أو تمارا — وتصلك فاتورتك الضريبية فور تأكيد الدفع.",
             en: "Pay by card, Apple Pay or Tamara — your tax invoice arrives the moment payment is confirmed.",
             fr: "Payez par carte, Apple Pay ou Tamara — votre facture fiscale arrive dès confirmation.",
             zh: "使用银行卡、Apple Pay 或 Tamara 付款——确认后立即收到税务发票。" },
  yourData:{ ar: "بياناتك", en: "Your details", fr: "Vos informations", zh: "您的信息" },
  name:    { ar: "الاسم الكامل", en: "Full name", fr: "Nom complet", zh: "姓名" },
  phone:   { ar: "رقم الجوال", en: "Mobile", fr: "Mobile", zh: "手机号" },
  email:   { ar: "البريد الإلكتروني", en: "E-mail", fr: "E-mail", zh: "邮箱" },
  company: { ar: "المنشأة (اختياري)", en: "Company (optional)", fr: "Société (optionnel)", zh: "公司（选填）" },
  summary: { ar: "ملخص طلبك", en: "Order summary", fr: "Récapitulatif", zh: "订单摘要" },
  net:     { ar: "قبل الضريبة", en: "Subtotal", fr: "Sous-total", zh: "小计" },
  vat:     { ar: "ضريبة القيمة المضافة ١٥٪", en: "VAT 15%", fr: "TVA 15 %", zh: "增值税 15%" },
  total:   { ar: "الإجمالي", en: "Total", fr: "Total", zh: "合计" },
  empty:   { ar: "سلتك فارغة.", en: "Your cart is empty.", fr: "Votre panier est vide.", zh: "购物车为空。" },
  browse:  { ar: "استعرض الخدمات", en: "Browse services", fr: "Voir les services", zh: "浏览服务" },
  how:     { ar: "طريقة الدفع", en: "Payment method", fr: "Mode de paiement", zh: "支付方式" },
  card:    { ar: "بطاقة · Apple Pay", en: "Card · Apple Pay", fr: "Carte · Apple Pay", zh: "银行卡 · Apple Pay" },
  cardSub: { ar: "مدى · فيزا · ماستركارد", en: "mada · Visa · Mastercard", fr: "mada · Visa · Mastercard", zh: "mada · Visa · Mastercard" },
  tamara:  { ar: "تمارا — قسّمها", en: "Tamara — split it", fr: "Tamara — en plusieurs fois", zh: "Tamara 分期" },
  tamaraS: { ar: "ادفع على دفعات بلا فوائد", en: "Interest-free instalments", fr: "Sans frais", zh: "免息分期" },
  bank:    { ar: "تحويل بنكي", en: "Bank transfer", fr: "Virement bancaire", zh: "银行转账" },
  bankSub: { ar: "حوّل ثم أرسل الإيصال", en: "Transfer, then send the receipt", fr: "Virez puis envoyez le reçu", zh: "转账后发送回执" },
  needFill:{ ar: "أكمل الاسم والجوال والبريد قبل الدفع.", en: "Fill in name, mobile and e-mail first.",
             fr: "Renseignez nom, mobile et e-mail.", zh: "请先填写姓名、手机号和邮箱。" },
  payNote: { ar: "الدفع يتم على خوادم البوابة المرخّصة — لا تمرّ بيانات بطاقتك من خوادمنا.",
             en: "Payment runs on the licensed gateway — card details never touch our servers.",
             fr: "Le paiement passe par la passerelle agréée — vos données de carte ne transitent pas chez nous.",
             zh: "支付在持牌网关完成——卡片信息不经过我们的服务器。" },
  loading: { ar: "نجهّز نموذج الدفع…", en: "Preparing the payment form…", fr: "Préparation du paiement…", zh: "正在准备支付表单…" },
  payDown: { ar: "تعذّر فتح نموذج الدفع الآن. جرّب تمارا أو التحويل البنكي، أو راسلنا على واتساب.",
             en: "The payment form could not load. Try Tamara or bank transfer, or message us on WhatsApp.",
             fr: "Le formulaire n'a pas pu se charger. Essayez Tamara ou le virement.",
             zh: "支付表单加载失败。请尝试 Tamara 或银行转账。" },
  bene:    { ar: "المستفيد", en: "Beneficiary", fr: "Bénéficiaire", zh: "收款人" },
  bankName:{ ar: "البنك", en: "Bank", fr: "Banque", zh: "银行" },
  iban:    { ar: "الآيبان", en: "IBAN", fr: "IBAN", zh: "IBAN" },
  receipt: { ar: "بعد التحويل أرسل صورة الإيصال على واتساب أو البريد — ونفعّل طلبك فور التحقق.",
             en: "After transferring, send the receipt on WhatsApp or by e-mail — we activate on verification.",
             fr: "Après le virement, envoyez le reçu par WhatsApp ou e-mail.",
             zh: "转账后请通过 WhatsApp 或邮件发送回执。" },
  secure:  { ar: "اتصال مشفّر", en: "Encrypted", fr: "Chiffré", zh: "加密" },
  zatca:   { ar: "فاتورة ضريبية معتمدة", en: "ZATCA tax invoice", fr: "Facture ZATCA", zh: "ZATCA 税务发票" },
};

export function buildSimpleCheckout(SV1, ctx) {
  const lang = ctx.lang();
  const t = (k) => (T[k][lang] != null ? T[k][lang] : T[k].en);
  const esc = ctx.esc;
  const ar = lang === "ar";
  let bank = {};
  try { bank = (JSON.parse(fs.readFileSync(path.resolve("site/data/site.json"), "utf8")).bank) || {}; } catch {}
  const home = lang === "en" ? "/" : "/" + lang + "/";

  const body = `${SV1.header("/checkout", { cta: false })}
  <main>
  <section class="sv1-sec"><div class="wrap">
    <div class="sv1-title" style="margin-bottom:26px;">
      <span class="sv1-tag">${esc(t("title"))}</span>
      <h2>${esc(t("title"))}</h2>
      <p>${esc(t("desc"))}</p>
    </div>

    <div class="sv1-co-grid">

      <div class="sv1-co-main">
        <div class="sv1-panel">
          <h4>${esc(t("yourData"))}</h4>
          <div class="sv1-co-fields">
            <div><label for="coName">${esc(t("name"))}</label><input id="coName" class="sv1-co-in" autocomplete="name"></div>
            <div><label for="coPhone">${esc(t("phone"))}</label><input id="coPhone" class="sv1-co-in" inputmode="tel" autocomplete="tel"></div>
            <div><label for="coEmail">${esc(t("email"))}</label><input id="coEmail" class="sv1-co-in" type="email" autocomplete="email"></div>
            <div><label for="coCo">${esc(t("company"))}</label><input id="coCo" class="sv1-co-in" autocomplete="organization"></div>
          </div>
        </div>

        <div class="sv1-panel" style="margin-top:14px;">
          <h4>${esc(t("how"))}</h4>
          <div class="sv1-co-ways" id="coWays">
            <button type="button" class="sv1-co-way on" data-way="card">
              <span class="ico"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/></svg></span>
              <span class="tx"><b>${esc(t("card"))}</b><small>${esc(t("cardSub"))}</small></span>
            </button>
            <button type="button" class="sv1-co-way" data-way="tamara" id="coWayTamara">
              <span class="ico"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 12h18"/><path d="M7 7h10"/><path d="M7 17h10"/></svg></span>
              <span class="tx"><b>${esc(t("tamara"))}</b><small>${esc(t("tamaraS"))}</small></span>
            </button>
            <button type="button" class="sv1-co-way" data-way="bank">
              <span class="ico"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 21h18"/><path d="M5 21V10l7-5 7 5v11"/><path d="M9 21v-6h6v6"/></svg></span>
              <span class="tx"><b>${esc(t("bank"))}</b><small>${esc(t("bankSub"))}</small></span>
            </button>
          </div>

          <div id="coPaneCard" class="sv1-co-pane">
            <div id="coPayMount" class="sv1-co-mount"><div class="sv1-co-wait">${esc(t("loading"))}</div></div>
            <p class="sv1-co-fine">${esc(t("payNote"))}</p>
          </div>

          <div id="coPaneTamara" class="sv1-co-pane sv1-hide">
            <button type="button" class="sv1-btn primary" style="width:100%" id="coTamaraGo">${esc(t("tamara"))}</button>
            <p class="sv1-co-fine" id="coTamaraNote">${esc(t("tamaraS"))}</p>
          </div>

          <div id="coPaneBank" class="sv1-co-pane sv1-hide">
            <div class="sv1-co-bank">
              <div><span>${esc(t("bene"))}</span><b>${esc(ar ? (bank.beneficiary || "") : (bank.beneficiaryEn || bank.beneficiary || ""))}</b></div>
              <div><span>${esc(t("bankName"))}</span><b>${esc(ar ? (bank.bankName || "") : (bank.bankNameEn || bank.bankName || ""))}</b></div>
              <div><span>${esc(t("iban"))}</span><b><bdi dir="ltr">${esc(bank.iban || "")}</bdi></b></div>
            </div>
            <p class="sv1-co-fine">${esc(t("receipt"))}</p>
          </div>
        </div>
      </div>

      <div class="sv1-co-side">
        <div class="sv1-panel sv1-co-sum">
          <h4>${esc(t("summary"))}</h4>
          <div id="coItems"></div>
          <div class="sv1-co-tot">
            <div><span>${esc(t("net"))}</span><b class="price-amt" id="coNet">—</b></div>
            <div><span>${esc(t("vat"))}</span><b class="price-amt" id="coVat">—</b></div>
            <div class="big"><span>${esc(t("total"))}</span><b class="price-amt" id="coTotal">—</b></div>
          </div>
          <div class="sv1-co-trust">
            <div><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16815A" stroke-width="2" stroke-linecap="round"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>${esc(t("secure"))}</div>
            <div><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16815A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>${esc(t("zatca"))}</div>
          </div>
        </div>
      </div>

    </div>
  </div></section>
  </main>
${SV1.footer()}`;

  const CSS = `<style id="sv1-co-css">
.sv1-co-grid{display:grid;grid-template-columns:1.5fr 1fr;gap:18px;align-items:start}
.sv1-co-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.sv1-co-fields label{display:block;font-size:11.5px;color:var(--mut);margin-bottom:5px}
.sv1-co-in{width:100%;border:1px solid var(--l);border-radius:11px;padding:12px 13px;font:inherit;font-size:14px;outline:none;background:#fff}
.sv1-co-in:focus{border-color:var(--n)}
.sv1-co-ways{display:grid;gap:8px;margin-bottom:16px}
.sv1-co-way{display:flex;align-items:center;gap:12px;text-align:start;background:#fff;border:1px solid var(--l);border-radius:13px;padding:14px;cursor:pointer;font-family:inherit;color:var(--ink)}
.sv1-co-way .ico{width:38px;height:38px;border-radius:10px;background:var(--soft);display:grid;place-items:center;color:var(--n);flex:none}
.sv1-co-way .tx b{display:block;font-size:13.5px;color:var(--n)}
.sv1-co-way .tx small{font-size:11.5px;color:var(--mut)}
.sv1-co-way.on{border-color:var(--n);box-shadow:0 0 0 3px rgba(11,27,90,.07)}
.sv1-co-way[disabled]{opacity:.45;cursor:default}
.sv1-co-mount{min-height:120px}
.sv1-co-wait{font-size:12.5px;color:var(--mut);padding:22px 0;text-align:center}
.sv1-co-fine{font-size:11.5px;color:var(--mut);line-height:1.75;margin:10px 0 0}
.sv1-co-bank{display:grid;gap:9px;background:var(--soft);border:1px solid var(--l);border-radius:12px;padding:14px}
.sv1-co-bank div{display:flex;justify-content:space-between;gap:12px;align-items:baseline}
.sv1-co-bank span{font-size:11.5px;color:var(--mut)}
.sv1-co-bank b{font-size:13px;color:var(--n);font-weight:600}
.sv1-co-sum{position:sticky;top:88px}
.sv1-co-row{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid #eef1f8;font-size:12.5px}
.sv1-co-row:last-of-type{border-bottom:0}
.sv1-co-row small{display:block;font-size:10.5px;color:var(--mut);margin-top:2px}
.sv1-co-tot{border-top:1px dashed #cfd6e6;margin-top:10px;padding-top:12px;display:grid;gap:7px}
.sv1-co-tot div{display:flex;justify-content:space-between;font-size:12.5px;color:var(--s)}
.sv1-co-tot .big{align-items:baseline;margin-top:4px}
.sv1-co-tot .big span{font-size:13.5px;font-weight:700;color:var(--n)}
.sv1-co-tot .big b{font-size:22px;color:var(--n)}
.sv1-co-trust{display:flex;gap:14px;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid #eef1f8}
.sv1-co-trust div{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--mut)}
@media(max-width:900px){.sv1-co-grid{grid-template-columns:1fr}.sv1-co-sum{position:static}}
@media(max-width:600px){.sv1-co-fields{grid-template-columns:1fr}}
</style>`;

  const script = `<script>
(function(){
var LANG=${JSON.stringify(lang)},HOME=${JSON.stringify(home)};
var TX=${JSON.stringify({ empty: t("empty"), browse: t("browse"), needFill: t("needFill"), payDown: t("payDown"), loading: t("loading") })};
var CART="bp_cart",SNAP="bp_pay_order",VAT=0.15;
var $=function(id){return document.getElementById(id)};
function money(n){return (Math.round(Number(n||0)*100)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' ﷼'}
function readCart(){try{return JSON.parse(localStorage.getItem(CART))||[]}catch(e){return []}}
function lineOf(i){var p=Number(i.price!=null?i.price:i.amount)||0;return p*(Number(i.qty)||1)}
var cart=readCart(),net=0;
cart.forEach(function(i){net+=lineOf(i)});
var vat=Math.round(net*VAT*100)/100,total=Math.round((net+vat)*100)/100;

(function draw(){
 var box=$('coItems');box.innerHTML='';
 if(!cart.length){
  var e=document.createElement('p');e.className='sv1-muted';e.textContent=TX.empty;box.appendChild(e);
  var a=document.createElement('a');a.className='sv1-btn primary sm';a.href=HOME+'catalog';a.textContent=TX.browse;a.style.marginTop='10px';box.appendChild(a);
  return}
 cart.forEach(function(i){
  var r=document.createElement('div');r.className='sv1-co-row';
  var l=document.createElement('div');var b=document.createElement('b');b.style.fontWeight='500';b.textContent=i.name||i.title||i.id||'';
  l.appendChild(b);
  if((Number(i.qty)||1)>1){var s=document.createElement('small');s.textContent='×'+(i.qty||1);l.appendChild(s)}
  var v=document.createElement('b');v.className='price-amt';v.textContent=money(lineOf(i));
  r.appendChild(l);r.appendChild(v);box.appendChild(r)});
 $('coNet').textContent=money(net);$('coVat').textContent=money(vat);$('coTotal').textContent=money(total);
})();

// تعبئة من الجلسة: من دخل حسابه لا يعيد كتابة بريده عند الدفع.
fetch('/api/otp',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:'{"action":"me"}'})
 .then(function(r){return r.json()}).then(function(o){var u=o&&o.session&&o.session.user;if(!u)return;
  if(!$('coEmail').value)$('coEmail').value=u.email||'';
  if(!$('coName').value)$('coName').value=u.full_name||'';}).catch(function(){});

// اللقطة والبيانات الوصفية بنفس شكل الموقع القديم حرفياً — المرجع يبقى ثابتاً
// بين تركيب النموذج والعودة من التحقق البنكي، وإلا صارت الدفعة بلا طلب.
function snapshot(){
 var prev='';try{prev=(JSON.parse(sessionStorage.getItem(SNAP)||'{}')||{}).ref||''}catch(e){}
 var o={ref:prev||'BP-'+Date.now().toString().slice(-6),
   name:$('coName').value.trim(),email:$('coEmail').value.trim().toLowerCase(),phone:$('coPhone').value.trim(),
   items:cart.map(function(i){return {id:i.id||'',qty:i.qty||1}}),company:$('coCo').value.trim(),
   surchargeFee:0,discountCode:'',taxProfile:{kind:'personal'}};
 try{sessionStorage.setItem(SNAP,JSON.stringify(o))}catch(e){}
 return o}
function meta(){
 var s=snapshot(),items='';
 try{items=(s.items||[]).map(function(i){return i.id+'~'+(i.qty||1)}).join(',');if(items.length>400)items=''}catch(e){items=''}
 return {ref:String(s.ref||''),email:String(s.email||'').slice(0,120),name:String(s.name||'').slice(0,60),
   phone:String(s.phone||'').slice(0,30),co:String(s.company||'').slice(0,80),items:items,disc:'',tax:'personal'}}
function ready(){return $('coName').value.trim()&&$('coPhone').value.trim()&&$('coEmail').value.trim().indexOf('@')>0}

// ---- اختيار الطريقة
var panes={card:$('coPaneCard'),tamara:$('coPaneTamara'),bank:$('coPaneBank')};
Array.prototype.forEach.call(document.querySelectorAll('.sv1-co-way'),function(b){
 b.onclick=function(){if(b.disabled)return;
  Array.prototype.forEach.call(document.querySelectorAll('.sv1-co-way'),function(x){x.classList.toggle('on',x===b)});
  for(var k in panes)panes[k].classList.toggle('sv1-hide',k!==b.getAttribute('data-way'))}});

// ---- تمارا
$('coTamaraGo').onclick=function(){
 var n=$('coTamaraNote');
 if(!ready()){n.textContent=TX.needFill;return}
 var self=this;self.disabled=true;n.textContent=TX.loading;
 fetch('/api/pay',{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({action:'bnpl-checkout',provider:'tamara',lang:LANG,order:snapshot()})})
 .then(function(r){return r.json()}).then(function(o){
  if(o&&o.ok&&o.url){location.href=o.url;return}
  self.disabled=false;n.textContent=(o&&o.message)||TX.payDown})
 .catch(function(){self.disabled=false;n.textContent=TX.payDown})};

// ---- البطاقة (مُيسّر) — نفس نداء التركيب في الموقع القديم
var mount=$('coPayMount');
function payFailed(){mount.innerHTML='';var p=document.createElement('p');p.className='sv1-co-fine';p.style.color='#b42318';p.textContent=TX.payDown;mount.appendChild(p)}
if(!cart.length){mount.innerHTML='';}
else fetch('/api/pay').then(function(r){return r.json()}).then(function(cfg){
 if(!cfg||!cfg.enabled||!cfg.publishableKey||!cfg.scriptUrl){payFailed();return}
 if(cfg.bnpl&&cfg.bnpl.tamara===false){var tb=$('coWayTamara');if(tb)tb.disabled=true}
 if(cfg.cssUrl){var l=document.createElement('link');l.rel='stylesheet';l.href=cfg.cssUrl;document.head.appendChild(l)}
 var s=document.createElement('script');s.src=cfg.scriptUrl;
 s.onerror=payFailed;
 s.onload=function(){
  if(!(window.Moyasar&&typeof window.Moyasar.init==='function')){payFailed();return}
  var wanted=(cfg.methods||['creditcard']).slice();
  var canAP=false;try{canAP=!!(window.ApplePaySession&&window.ApplePaySession.canMakePayments&&window.ApplePaySession.canMakePayments())}catch(e){}
  if(!canAP)wanted=wanted.filter(function(m){return m!=='applepay'});
  if(!wanted.length)wanted=['creditcard'];
  function boot(methods,applePay){
   mount.innerHTML='<div id="epay-form"></div>';
   window.Moyasar.init({element:'#epay-form',amount:Math.round(total*100),currency:cfg.currency||'SAR',
    description:'Business Partner order',publishable_api_key:cfg.publishableKey,
    callback_url:location.origin+location.pathname,metadata:meta(),
    on_initiating:async function(){return {metadata:meta()}},
    methods:methods,apple_pay:applePay||undefined});
   // نداءٌ لم يرمِ خطأً ليس نموذجاً على الشاشة: الصندوق الفارغ هو ما يترك
   // المشتري بلا وسيلة دفع ولا رسالة.
   setTimeout(function(){if(mount.querySelector('#epay-form')&&!mount.querySelector('#epay-form').children.length)payFailed()},2500)}
  try{boot(wanted,canAP?cfg.applePay:null)}
  catch(e){try{boot(['creditcard'],null)}catch(e2){payFailed()}}};
 document.head.appendChild(s)}).catch(payFailed);
})();</script>`;

  return SV1.shell({
    title: `${t("title")} — Business Partner`,
    desc: t("desc"),
    path: "/checkout",
    body: CSS + body,
    script,
    noindex: true,
  });
}
