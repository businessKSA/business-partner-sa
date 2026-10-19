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
//
// الدفع إلكتروني فقط (أمر المالك 2026-09-24): مدى · فيزا · ماستركارد · Apple Pay
// · Samsung Pay · تمارا. لا تحويل بنكي ولا رفع إيصال من هذه الصفحة — مسار
// `receipt-upload` في api/_simple.js باقٍ للطلبات التي بدأت تحويلاً قبل القرار،
// ولا يدخله طلب جديد من هنا.
//
// Samsung Pay مدعوم في نموذج مُيسّر بقيمة `samsungpay` في `methods`، لكنه لا
// يُعرض إلا حين يعيده /api/pay مع `samsungPay` (معرّف الخدمة من حساب سامسونج
// للمطوّرين) — زرٌّ يفشل عند لمسه أسوأ من زرٍّ لم يُعرض.

const T = {
  title:   { ar: "إتمام الدفع", en: "Checkout", fr: "Paiement", zh: "结账" },
  desc:    { ar: "ادفع إلكترونياً بالبطاقة (مدى · فيزا · ماستركارد) أو Apple Pay أو تمارا — وتصلك فاتورتك الضريبية فور تأكيد الدفع.",
             en: "Pay online by card (mada · Visa · Mastercard), Apple Pay or Tamara — your tax invoice arrives the moment payment is confirmed.",
             fr: "Payez en ligne par carte (mada · Visa · Mastercard), Apple Pay ou Tamara — votre facture fiscale arrive dès confirmation.",
             zh: "在线支付：银行卡（mada · Visa · Mastercard）、Apple Pay 或 Tamara——确认后立即收到税务发票。" },
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
  // يظهر بدل «card» حين يعيد /api/pay إعداد Samsung Pay مكتملاً.
  cardSP:  { ar: "بطاقة · Apple Pay · Samsung Pay", en: "Card · Apple Pay · Samsung Pay", fr: "Carte · Apple Pay · Samsung Pay", zh: "银行卡 · Apple Pay · Samsung Pay" },
  cardSub: { ar: "مدى · فيزا · ماستركارد", en: "mada · Visa · Mastercard", fr: "mada · Visa · Mastercard", zh: "mada · Visa · Mastercard" },
  tamara:  { ar: "تمارا — قسّمها", en: "Tamara — split it", fr: "Tamara — en plusieurs fois", zh: "Tamara 分期" },
  tamaraS: { ar: "ادفع على دفعات بلا فوائد", en: "Interest-free instalments", fr: "Sans frais", zh: "免息分期" },
  needFill:{ ar: "أكمل الاسم والجوال والبريد قبل الدفع.", en: "Fill in name, mobile and e-mail first.",
             fr: "Renseignez nom, mobile et e-mail.", zh: "请先填写姓名、手机号和邮箱。" },
  payNote: { ar: "الدفع يتم على خوادم البوابة المرخّصة — لا تمرّ بيانات بطاقتك من خوادمنا.",
             en: "Payment runs on the licensed gateway — card details never touch our servers.",
             fr: "Le paiement passe par la passerelle agréée — vos données de carte ne transitent pas chez nous.",
             zh: "支付在持牌网关完成——卡片信息不经过我们的服务器。" },
  loading: { ar: "نجهّز نموذج الدفع…", en: "Preparing the payment form…", fr: "Préparation du paiement…", zh: "正在准备支付表单…" },
  // العودة من البوابة — ونتيجتها تُسوّى بنفس نداء التحقق الذي يستعمله الموقع كله.
  payBtn:  { ar: "إتمام الدفع", en: "Complete payment", fr: "Payer", zh: "完成支付" },
  payWait: { ar: "نتحقّق من دفعتك…", en: "Confirming your payment…", fr: "Vérification du paiement…", zh: "正在确认您的付款…" },
  paidOk:  { ar: "تم استلام الدفعة — طلبك مسجّل وفاتورتك الضريبية تصلك على بريدك خلال دقائق.",
             en: "Payment received — your order is recorded and your tax invoice reaches your e-mail within minutes.",
             fr: "Paiement reçu — votre commande est enregistrée et votre facture arrive par e-mail sous peu.",
             zh: "已收到付款——订单已记录，税务发票将在几分钟内发送到您的邮箱。" },
  paidInv: { ar: "رقم الفاتورة:", en: "Invoice no.:", fr: "Facture n° :", zh: "发票号：" },
  paidFail:{ ar: "لم تكتمل الدفعة ولم يُخصم شيء — أعد المحاولة بالبطاقة أو جرّب تمارا.",
             en: "The payment did not go through and nothing was charged — retry by card or try Tamara.",
             fr: "Le paiement n'a pas abouti, rien n'a été débité — réessayez par carte ou avec Tamara.",
             zh: "付款未完成，未扣款——请用银行卡重试或尝试 Tamara。" },
  paidHold:{ ar: "دفعتك تمّت لكن تعذّر تأكيدها آلياً الآن، وقد وصل التنبيه لفريقنا. لا تدفع مرة أخرى — فاتورتك تصلك قريباً.",
             en: "Your payment went through but could not be confirmed automatically; our team has been alerted. Do not pay again — your invoice follows shortly.",
             fr: "Votre paiement a abouti mais n'a pas pu être confirmé automatiquement ; notre équipe est prévenue. Ne payez pas une seconde fois.",
             zh: "您的付款已完成但暂时无法自动确认，团队已收到提醒。请勿重复付款——发票稍后送达。" },
  bnplFail:{ ar: "لم تكتمل عملية التقسيط — تقدر تحاول مرة أخرى أو تدفع بالبطاقة.",
             en: "The instalment payment was not completed — retry, or pay by card.",
             fr: "Le paiement en plusieurs fois n'a pas abouti — réessayez ou payez par carte.",
             zh: "分期付款未完成——请重试或用银行卡支付。" },
  toMy:    { ar: "افتح طلباتي", en: "Open my orders", fr: "Mes commandes", zh: "查看我的订单" },
  mockTag: { ar: "بوابة محلية — لا بطاقة ولا خصم", en: "Local gateway — no card, no charge", fr: "Passerelle locale — aucun débit", zh: "本地网关——不扣款" },
  quoted:  { ar: "يُسعّر عند المراجعة", en: "Quoted on review", fr: "Devis après examen", zh: "审核后报价" },
  signIn:  { ar: "سجّل دخولك لعرض السعر وإتمام الدفع", en: "Sign in to see the price and pay.",
             fr: "Connectez-vous pour voir le prix et payer.", zh: "登录后查看价格并付款。" },
  signInBtn:{ ar: "دخول إلى حسابي", en: "Sign in", fr: "Se connecter", zh: "登录" },
  noAmount:{ ar: "هذه البنود تُسعّر عند المراجعة — سنرسل لك عرض السعر ثم رابط الدفع.",
             en: "These items are quoted on review — we send the quotation, then the payment link.",
             fr: "Ces éléments sont devisés après examen — nous envoyons le devis, puis le lien de paiement.",
             zh: "这些项目将在审核后报价 — 我们会先发送报价，再发送付款链接。" },
  payDown: { ar: "تعذّر فتح نموذج الدفع الآن. جرّب تمارا، أو أعد المحاولة بعد قليل، أو راسلنا على واتساب.",
             en: "The payment form could not load. Try Tamara, retry in a moment, or message us on WhatsApp.",
             fr: "Le formulaire n'a pas pu se charger. Essayez Tamara ou réessayez dans un instant.",
             zh: "支付表单加载失败。请尝试 Tamara 或稍后重试。" },
  secure:  { ar: "اتصال مشفّر", en: "Encrypted", fr: "Chiffré", zh: "加密" },
  zatca:   { ar: "فاتورة ضريبية معتمدة", en: "ZATCA tax invoice", fr: "Facture ZATCA", zh: "ZATCA 税务发票" },
};

export function buildSimpleCheckout(SV1, ctx) {
  const lang = ctx.lang();
  const t = (k) => (T[k][lang] != null ? T[k][lang] : T[k].en);
  const esc = ctx.esc;
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
          <div id="coResult" class="sv1-co-result sv1-hide" role="status" aria-live="polite"></div>
          <div class="sv1-co-ways" id="coWays">
            <button type="button" class="sv1-co-way on" data-way="card">
              <span class="ico"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/></svg></span>
              <span class="tx"><b id="coWayCardLabel">${esc(t("card"))}</b><small>${esc(t("cardSub"))}</small></span>
            </button>
            <button type="button" class="sv1-co-way" data-way="tamara" id="coWayTamara">
              <span class="ico"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 12h18"/><path d="M7 7h10"/><path d="M7 17h10"/></svg></span>
              <span class="tx"><b>${esc(t("tamara"))}</b><small>${esc(t("tamaraS"))}</small></span>
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
.sv1-co-way .ico{width:38px;height:38px;border-radius:10px;background:var(--acSoft);display:grid;place-items:center;color:var(--n);flex:none}
.sv1-co-way .tx b{display:block;font-size:13.5px;color:var(--ink);font-weight:500}
.sv1-co-way .tx small{font-size:11.5px;color:var(--mut)}
.sv1-co-way.on{border-color:var(--n);box-shadow:0 0 0 3px rgba(67,56,245,.10)}
.sv1-co-way[disabled]{opacity:.45;cursor:default}
.sv1-co-mount{min-height:120px}
.sv1-co-wait{font-size:12.5px;color:var(--mut);padding:22px 0;text-align:center}
.sv1-co-fine{font-size:11.5px;color:var(--mut);line-height:1.75;margin:10px 0 0}
.sv1-co-sum{position:sticky;top:88px}
.sv1-co-row{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid #eef1f8;font-size:12.5px}
.sv1-co-row:last-of-type{border-bottom:0}
.sv1-co-row small{display:block;font-size:10.5px;color:var(--mut);margin-top:2px}
.sv1-co-tot{border-top:1px dashed #cfd6e6;margin-top:10px;padding-top:12px;display:grid;gap:7px}
.sv1-co-tot div{display:flex;justify-content:space-between;font-size:12.5px;color:var(--s)}
.sv1-co-tot .big{align-items:baseline;margin-top:4px}
.sv1-co-tot .big span{font-size:13.5px;font-weight:500;color:var(--ink)}
.sv1-co-tot .big b{font-size:23px;color:var(--ac);font-family:var(--fm);font-weight:500}
.sv1-co-trust{display:flex;gap:14px;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid #eef1f8}
.sv1-co-trust div{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--mut)}
.sv1-co-result{border:1px solid var(--l);border-radius:12px;padding:14px;margin-bottom:14px;font-size:13px;line-height:1.8;background:var(--soft)}
.sv1-co-result p{margin:0 0 8px}
.sv1-co-result.ok{border-color:#bfe3d2;background:#f0f9f5}
.sv1-co-result.warn{border-color:#f0d9b8;background:#fdf7ef}
.sv1-co-mock{display:inline-block;background:#b45309;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;margin-bottom:10px}
@media(max-width:900px){.sv1-co-grid{grid-template-columns:1fr}.sv1-co-sum{position:static}}
@media(max-width:600px){.sv1-co-fields{grid-template-columns:1fr}}
</style>`;

  const script = `<script>
(function(){
var LANG=${JSON.stringify(lang)},HOME=${JSON.stringify(home)};
var TX=${JSON.stringify({ empty: t("empty"), browse: t("browse"), needFill: t("needFill"), payDown: t("payDown"), loading: t("loading"), quoted: t("quoted"), signIn: t("signIn"), signInBtn: t("signInBtn"), noAmount: t("noAmount"), cardSP: t("cardSP"), payBtn: t("payBtn"), payWait: t("payWait"), paidOk: t("paidOk"), paidInv: t("paidInv"), paidFail: t("paidFail"), paidHold: t("paidHold"), bnplFail: t("bnplFail"), toMy: t("toMy"), mockTag: t("mockTag") })};
var CART="bp_cart",SNAP="bp_pay_order",VAT=0.15;
var $=function(id){return document.getElementById(id)};
function money(n){return (Math.round(Number(n||0)*100)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' ﷼'}
function readCart(){try{return JSON.parse(localStorage.getItem(CART))||[]}catch(e){return []}}
// شكل بند السلة يكتبه main.js و api/_simple.js: {id,nameAr,nameEn,amount,price,qty}.
// «price» عنوانٌ نصي («3,038 ر.س») لا رقم — قراءته كرقم كانت تُخرج NaN فصفراً،
// فيظهر الإجمالي 0.00 ويرفض مُيسّر التركيب. الرقم في «amount» وحده.
function lineOf(i){return (Number(i.amount)||0)*(Number(i.qty)||1)}
function nameOf(i){var ar=i.nameAr||'',en=i.nameEn||'';return (LANG==='ar'?ar:en)||ar||en||i.name||i.title||i.id||''}
var PRICES_ON=document.documentElement.getAttribute('data-prices')==='on';
function shown(i){return !!(i&&Number(i.amount)&&(PRICES_ON||i.pricePublic))}
var cart=readCart(),net=0;
var unpriced=cart.filter(function(i){return !Number(i.amount)}).length;   // بنودٌ تُسعّر عند المراجعة
var hidden=cart.filter(function(i){return Number(i.amount)&&!shown(i)}).length; // مسعّرة لكنها محجوبة عن غير المسجّل
cart.forEach(function(i){net+=lineOf(i)});
var vat=Math.round(net*VAT*100)/100,total=Math.round((net+vat)*100)/100;
var payable=cart.length&&!unpriced&&!hidden&&total>0;

(function draw(){
 var box=$('coItems');box.innerHTML='';
 if(!cart.length){
  var e=document.createElement('p');e.className='sv1-muted';e.textContent=TX.empty;box.appendChild(e);
  var a=document.createElement('a');a.className='sv1-btn primary sm';a.href=HOME+'catalog';a.textContent=TX.browse;a.style.marginTop='10px';box.appendChild(a);
  return}
 cart.forEach(function(i){
  var r=document.createElement('div');r.className='sv1-co-row';
  var l=document.createElement('div');var b=document.createElement('b');b.style.fontWeight='500';b.textContent=nameOf(i);
  l.appendChild(b);
  if((Number(i.qty)||1)>1){var s=document.createElement('small');s.textContent='×'+(i.qty||1);l.appendChild(s)}
  var v=document.createElement('b');
  if(shown(i)){v.textContent=money(lineOf(i))}else{v.style.fontWeight='400';v.style.color='var(--mut)';v.style.fontSize='11.5px';v.textContent=Number(i.amount)?TX.signIn:TX.quoted}
  r.appendChild(l);r.appendChild(v);box.appendChild(r)});
 if(payable){$('coNet').textContent=money(net);$('coVat').textContent=money(vat);$('coTotal').textContent=money(total)}
 else{var q=unpriced?TX.quoted:TX.signIn;$('coNet').textContent=q;$('coVat').textContent='—';$('coTotal').textContent=q;
  $('coTotal').style.fontSize='14px';$('coTotal').style.fontWeight='600'}
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
var panes={card:$('coPaneCard'),tamara:$('coPaneTamara')};
var PAYCFG=null; // إعداد /api/pay بعد وصوله — يحتاجه زر تمارا في الوضع المحلي

// ---- العودة من البوابة
// مُيسّر يعيد ?id&status، وتمارا ?bnpl=tamara&bnpl_status&orderId، والبوابة
// المحلية ?payment&id. الثلاثة تُسوّى بنداء التحقق نفسه POST /api/pay الذي
// يستعمله الموقع القديم حرفياً: تفعيل + CRM + فاتورة من مسار واحد. وبلا هذا
// الجزء كان العميل يعود من البوابة إلى السلة نفسها بلا كلمة — والمال قد خرج.
var RESULT=$('coResult');
function showResult(kind,txt,extra){RESULT.className='sv1-co-result '+kind;RESULT.textContent='';
 var p=document.createElement('p');p.textContent=txt;RESULT.appendChild(p);
 if(extra){var s=document.createElement('p');s.className='sv1-co-fine';s.style.margin='0 0 8px';s.textContent=extra;RESULT.appendChild(s)}
 if(kind==='ok'){var a=document.createElement('a');a.className='sv1-btn primary sm';a.href=HOME+'my';a.textContent=TX.toMy;RESULT.appendChild(a)}
 try{RESULT.scrollIntoView({behavior:'smooth',block:'center'})}catch(e){}}
(function settleReturn(){
 var u=new URL(location.href),q=u.searchParams;
 var pid=q.get('id'),st=String(q.get('status')||q.get('payment')||'').toLowerCase();
 var bn=q.get('bnpl'),bs=q.get('bnpl_status');
 var bid=q.get('payment_id')||q.get('paymentId')||q.get('orderId')||q.get('order_id')||'';
 var body=null,failed=false;
 if(pid&&(st==='failed'||st==='cancelled'))failed=true;
 else if(pid)body={id:pid,amount:total};
 else if(bn&&(bs||'success')==='success'&&bid)body={action:'bnpl-verify',provider:'tamara',id:bid};
 else if(bn&&bs&&bs!=='success')failed=true;
 if(!body&&!failed)return;
 ['id','status','message','payment','amount','provider','bnpl','bnpl_status','payment_id','paymentId','orderId','order_id'].forEach(function(k){q.delete(k)});
 try{history.replaceState({},'',u.pathname+(q.toString()?'?'+q.toString():''))}catch(e){}
 if(failed){showResult('warn',bn?TX.bnplFail:TX.paidFail);return}
 // اللقطة المحفوظة تحمل المرجع نفسه الذي رُكّب به النموذج — لا لقطة جديدة.
 var stash=null;try{stash=JSON.parse(sessionStorage.getItem(SNAP)||'null')}catch(e){}
 if(stash)body.order=stash;
 showResult('wait',TX.payWait);
 fetch('/api/pay',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
  .then(function(r){return r.json()}).then(function(v){
   if(v&&v.ok){var inv=v.invoice;
    showResult('ok',TX.paidOk,inv&&inv.invoiced&&inv.number?TX.paidInv+' '+inv.number:'');
    $('coWays').classList.add('sv1-hide');for(var k in panes)panes[k].classList.add('sv1-hide');
    try{localStorage.removeItem(CART)}catch(e){}try{sessionStorage.removeItem(SNAP)}catch(e){}
    try{dispatchEvent(new Event('bp:cart'))}catch(e){}return}
   // بطاقة مرفوضة تُعاد؛ ودفعة لم نستطع قراءتها لا تُعاد — وإلا دفع مرتين.
   if(v&&v.error==='verify_unavailable'){showResult('warn',TX.paidHold,v.paymentId||'');return}
   showResult('warn',TX.paidFail)})
  .catch(function(){showResult('warn',TX.paidHold)});
})();

// البوابة المحلية (لا مفتاح مُيسّر و APP_ENV=development): صفحة يخدمها الخادم
// نفسه، تختار فيها النتيجة ثم تعود إلى هنا وتُسوّى بالمسار الحقيقي.
function mockUrl(provider){snapshot();var u=PAYCFG.formUrl;
 return u+(u.indexOf('?')<0?'?':'&')+'back='+encodeURIComponent(location.pathname)+'&amount='+encodeURIComponent(String(total))+'&label='+encodeURIComponent('Business Partner order')+'&provider='+provider}
Array.prototype.forEach.call(document.querySelectorAll('.sv1-co-way'),function(b){
 b.onclick=function(){if(b.disabled)return;
  Array.prototype.forEach.call(document.querySelectorAll('.sv1-co-way'),function(x){x.classList.toggle('on',x===b)});
  for(var k in panes)panes[k].classList.toggle('sv1-hide',k!==b.getAttribute('data-way'))}});

// ---- تمارا
$('coTamaraGo').onclick=function(){
 var n=$('coTamaraNote');
 if(!payable){n.textContent=unpriced?TX.noAmount:TX.signIn;return}
 if(!ready()){n.textContent=TX.needFill;return}
 if(PAYCFG&&PAYCFG.mock&&PAYCFG.formUrl){location.href=mockUrl('tamara');return}
 var self=this;self.disabled=true;n.textContent=TX.loading;
 fetch('/api/pay',{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({action:'bnpl-checkout',provider:'tamara',lang:LANG,order:snapshot()})})
 .then(function(r){return r.json()}).then(function(o){
  if(o&&o.ok&&o.url){location.href=o.url;return}
  self.disabled=false;n.textContent=(o&&o.message)||TX.payDown})
 .catch(function(){self.disabled=false;n.textContent=TX.payDown})};

// ---- البطاقة والمحافظ (مُيسّر) — نفس نداء التركيب في الموقع القديم
var mount=$('coPayMount');
function payFailed(){mount.innerHTML='';var p=document.createElement('p');p.className='sv1-co-fine';p.style.color='#b42318';p.textContent=TX.payDown;mount.appendChild(p)}
// مُيسّر يرفض مبلغ الصفر برسالة إنجليزية عامة «Form configuration issue»؛
// لا نصل إليها أصلاً: نقول للمشتري لماذا لا يوجد مبلغ وماذا يفعل.
function payBlocked(msg,href,label){
 mount.innerHTML='';
 var p=document.createElement('p');p.className='sv1-co-fine';p.textContent=msg;mount.appendChild(p);
 if(href){var a=document.createElement('a');a.className='sv1-btn primary sm';a.href=href;a.textContent=label;a.style.marginTop='10px';mount.appendChild(a)}
 var tg=$('coTamaraGo');if(tg)tg.disabled=true}
if(!cart.length){mount.innerHTML='';}
else if(unpriced){payBlocked(TX.noAmount,HOME+'my',TX.signInBtn);}
else if(hidden){payBlocked(TX.signIn,HOME+'my',TX.signInBtn);}
else if(!(total>0)){payBlocked(TX.noAmount,HOME+'catalog',TX.browse);}
else fetch('/api/pay').then(function(r){return r.json()}).then(function(cfg){
 PAYCFG=cfg||null;
 if(cfg&&cfg.bnpl&&cfg.bnpl.tamara===false){var tb=$('coWayTamara');if(tb)tb.disabled=true}
 if(cfg&&cfg.enabled&&cfg.mock&&cfg.formUrl){
  mount.innerHTML='';
  var tg=document.createElement('span');tg.className='sv1-co-mock';tg.textContent=TX.mockTag;mount.appendChild(tg);
  var bt=document.createElement('button');bt.type='button';bt.className='sv1-btn primary';bt.style.width='100%';bt.id='coMockPay';bt.textContent=TX.payBtn;
  var nt=document.createElement('p');nt.className='sv1-co-fine';
  bt.onclick=function(){if(!ready()){nt.textContent=TX.needFill;return}location.href=mockUrl('card')};
  mount.appendChild(bt);mount.appendChild(nt);return}
 if(!cfg||!cfg.enabled||!cfg.publishableKey||!cfg.scriptUrl){payFailed();return}
 if(cfg.cssUrl){var l=document.createElement('link');l.rel='stylesheet';l.href=cfg.cssUrl;document.head.appendChild(l)}
 var s=document.createElement('script');s.src=cfg.scriptUrl;
 s.onerror=payFailed;
 s.onload=function(){
  if(!(window.Moyasar&&typeof window.Moyasar.init==='function')){payFailed();return}
  var wanted=(cfg.methods||['creditcard']).slice();
  var canAP=false;try{canAP=!!(window.ApplePaySession&&window.ApplePaySession.canMakePayments&&window.ApplePaySession.canMakePayments())}catch(e){}
  if(!canAP)wanted=wanted.filter(function(m){return m!=='applepay'});
  // Samsung Pay: قيمة «samsungpay» في methods مع كائن samsung_pay (service_id
  // من حساب سامسونج للمطوّرين، والمرجع رقمَ طلب). الخادم لا يعيدها إلا مكتملة.
  var sp=cfg.samsungPay&&cfg.samsungPay.service_id?cfg.samsungPay:null;
  if(!sp)wanted=wanted.filter(function(m){return m!=='samsungpay'});
  else{var lb=$('coWayCardLabel');if(lb)lb.textContent=TX.cardSP}
  if(!wanted.length)wanted=['creditcard'];
  function boot(methods,applePay,samsungPay){
   mount.innerHTML='<div id="epay-form"></div>';
   var m=meta();
   window.Moyasar.init({element:'#epay-form',amount:Math.round(total*100),currency:cfg.currency||'SAR',
    description:'Business Partner order',publishable_api_key:cfg.publishableKey,
    callback_url:location.origin+location.pathname,metadata:m,
    on_initiating:async function(){return {metadata:meta()}},
    methods:methods,apple_pay:applePay||undefined,
    samsung_pay:samsungPay?{service_id:samsungPay.service_id,order_number:m.ref,country:samsungPay.country||'SA',
      label:samsungPay.label||'Business Partner',environment:samsungPay.environment||'PRODUCTION'}:undefined});
   // نداءٌ لم يرمِ خطأً ليس نموذجاً على الشاشة: الصندوق الفارغ هو ما يترك
   // المشتري بلا وسيلة دفع ولا رسالة.
   setTimeout(function(){if(mount.querySelector('#epay-form')&&!mount.querySelector('#epay-form').children.length)payFailed()},2500)}
  try{boot(wanted,canAP?cfg.applePay:null,sp)}
  catch(e){try{boot(['creditcard'],null,null)}catch(e2){payFailed()}}};
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
