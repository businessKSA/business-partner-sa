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
// · Samsung Pay · Google Pay · تمارا. لا تحويل بنكي ولا رفع إيصال من هذه
// الصفحة — مسار `receipt-upload` في api/_simple.js باقٍ للطلبات التي بدأت
// تحويلاً قبل القرار، ولا يدخله طلب جديد من هنا.
//
// المحافظ ثلاث، ولكلٍّ شرطان لا يكفي أحدهما: تفعيلٌ عند المالك (يعيده /api/pay:
// `applePay` · `samsungPay` · `googlePay`) **وجاهزيةٌ على جهاز الزائر** (Apple:
// `ApplePaySession.canMakePayments` · Samsung/Google: `isReadyToPay` من SDK
// المحفظة نفسها). زرٌّ يفشل عند لمسه أسوأ من زرٍّ لم يُعرض، وعنوانُ بطاقةٍ يَعِد
// بمحفظةٍ لا تظهر أسوأ منهما — فعنوان البطاقة يسمّي المحافظ الجاهزة فعلاً فقط،
// وما سواها لا يُذكر ولا يُمرَّر إلى النموذج.
//
// Google Pay في نموذج مُيسّر 2.2.10 كائنُ `google_pay` (merchant_id · country ·
// label · environment) لا قيمةً في `methods` — الزر يُرسم من `merchant_id`.
// نطلب `CRYPTOGRAM_3DS` وحده (توثيق مُيسّر): `PAN_ONLY` يعني رقم بطاقة خام بلا 3DS.

import { recurringMap } from "./simple-v1-cart.mjs";

const T = {
  title:   { ar: "إتمام الدفع", en: "Checkout", fr: "Paiement", zh: "结账" },
  desc:    { ar: "ادفع إلكترونياً بالبطاقة (مدى · فيزا · ماستركارد) أو قسّطها عبر تمارا — وتصلك فاتورتك الضريبية فور تأكيد الدفع.",
             en: "Pay online by card (mada · Visa · Mastercard) or split it with Tamara — your tax invoice arrives the moment payment is confirmed.",
             fr: "Payez en ligne par carte (mada · Visa · Mastercard) ou en plusieurs fois avec Tamara — votre facture fiscale arrive dès confirmation.",
             zh: "在线支付：银行卡（mada · Visa · Mastercard）或 Tamara 分期——确认后立即收到税务发票。" },
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
  // عنوان الطريقة «بطاقة» وحدها؛ والسكربت يُلحق به أسماء المحافظ التي ثبتت
  // جاهزيتها على هذا الجهاز فعلاً (Apple Pay · Google Pay · Samsung Pay).
  card:    { ar: "بطاقة", en: "Card", fr: "Carte", zh: "银行卡" },
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
  // اشتراك منصة التوظيف (BP-EMP-*): يُفعَّل الحساب آلياً بعد تأكيد الدفع.
  needCo:  { ar: "اكتب اسم المنشأة — الاشتراك يُفتح باسمها.", en: "Enter the company name — the subscription is opened in its name.",
             fr: "Indiquez la société — l'abonnement est ouvert à son nom.", zh: "请填写公司名称——订阅将以其名义开通。" },
  empFail: { ar: "تعذّر تجهيز اشتراكك الآن ولم يُخصم شيء — أعد المحاولة بعد قليل أو راسلنا.",
             en: "We could not prepare your subscription and nothing was charged — retry shortly or contact us.",
             fr: "Impossible de préparer votre abonnement, rien n'a été débité — réessayez ou contactez-nous.",
             zh: "暂时无法准备您的订阅，未扣款——请稍后重试或联系我们。" },
  empDone: { ar: "تم الدفع وفُعِّل اشتراكك في منصة التوظيف. ادخل بوابة صاحب العمل بالبريد الذي دفعت به.",
             en: "Payment received and your recruitment-platform subscription is active. Sign in to the employer portal with the e-mail you paid with.",
             fr: "Paiement reçu et abonnement activé. Connectez-vous au portail employeur avec l'e-mail utilisé pour payer.",
             zh: "已收到付款，您的招聘平台订阅已开通。请用付款时的邮箱登录雇主门户。" },
  empHold: { ar: "دفعتك تمّت وجارٍ تفعيل اشتراكك — وصل التنبيه لفريقنا وسيُفعَّل خلال ساعات العمل. لا تدفع مرة أخرى.",
             en: "Your payment went through and the subscription is being activated — our team has been alerted. Do not pay again.",
             fr: "Votre paiement a abouti et l'abonnement est en cours d'activation — notre équipe est prévenue. Ne payez pas une seconde fois.",
             zh: "付款已完成，订阅正在开通——团队已收到提醒。请勿重复付款。" },
  onePlan: { ar: "اشتراك واحد في كل طلب — أبقِ باقة واحدة في السلة.", en: "One subscription per order — keep a single plan in the cart.",
             fr: "Un seul abonnement par commande.", zh: "每个订单仅限一个订阅。" },
  toCart:  { ar: "العودة إلى السلة", en: "Back to the cart", fr: "Retour au panier", zh: "返回购物车" },
  empSignIn:{ ar: "سجّل دخولك بالبريد الذي سيُفتح به الاشتراك ثم أكمل الدفع.", en: "Sign in with the e-mail the subscription will be opened for, then pay.",
             fr: "Connectez-vous avec l'e-mail de l'abonnement, puis payez.", zh: "请先用将开通订阅的邮箱登录，再付款。" },
  empMail: { ar: "بريد الدفع يجب أن يطابق بريد حسابك المسجَّل دخوله — الاشتراك يُفتح لحسابك.", en: "The e-mail must match the account you are signed in with — the subscription opens for that account.",
             fr: "L'e-mail doit correspondre au compte connecté.", zh: "邮箱必须与当前登录账户一致。" },
  toEmployer:{ ar: "افتح بوابة صاحب العمل", en: "Open the employer portal", fr: "Ouvrir le portail employeur", zh: "打开雇主门户" },
  tamaraYr:{ ar: "تمارا متاحة للاشتراك السنوي فقط.", en: "Tamara is available for the yearly plan only.",
             fr: "Tamara n'est disponible que pour l'abonnement annuel.", zh: "Tamara 仅适用于年度订阅。" },
  secure:  { ar: "اتصال مشفّر", en: "Encrypted", fr: "Chiffré", zh: "加密" },
  zatca:   { ar: "فاتورة ضريبية معتمدة", en: "ZATCA tax invoice", fr: "Facture ZATCA", zh: "ZATCA 税务发票" },

  // ---- الدفعة الواحدة والاشتراك: يُعرضان منفصلين (كما في السلة) وبوسم الدورة.
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
  tamaraSub:{ ar: "تمارا غير متاحة للاشتراكات الشهرية — ادفع بالبطاقة.", en: "Tamara is not available for monthly subscriptions — pay by card.",
             fr: "Tamara n'est pas disponible pour les abonnements mensuels — payez par carte.", zh: "Tamara 不适用于月度订阅——请用银行卡支付。" },

  // ---- رسالة ما بعد الدفع: ما حدث فعلاً، ورقم يُحتفظ به، والخطوة التالية.
  lblOrder:{ ar: "رقم الطلب", en: "Order no.", fr: "N° de commande", zh: "订单号" },
  lblPay:  { ar: "مرجع الدفعة", en: "Payment ref.", fr: "Réf. du paiement", zh: "付款编号" },
  lblAmt:  { ar: "المبلغ المدفوع (شامل الضريبة)", en: "Amount paid (incl. VAT)", fr: "Montant payé (TTC)", zh: "已付金额（含税）" },
  lblInv:  { ar: "رقم الفاتورة", en: "Invoice no.", fr: "N° de facture", zh: "发票号" },
  okDone:  { ar: "تم استلام دفعتك وتأكيد طلبك.", en: "Payment received and your order is confirmed.",
             fr: "Paiement reçu et commande confirmée.", zh: "已收到付款，订单已确认。" },
  nextInv: { ar: "الخطوة التالية: تصلك على بريدك رسالة تأكيد الطلب وفاتورتك الضريبية، ثم يبدأ الفريق التنفيذ.",
             en: "Next: an order confirmation and your tax invoice reach your e-mail, then the team starts work.",
             fr: "Ensuite : la confirmation et votre facture fiscale arrivent par e-mail, puis l'équipe commence le travail.",
             zh: "下一步：订单确认和税务发票将发送到您的邮箱，随后团队开始执行。" },
  nextNoInv:{ ar: "الخطوة التالية: تصلك على بريدك رسالة تأكيد الطلب. وفاتورتك الضريبية يجهّزها الفريق وتصلك على البريد نفسه.",
             en: "Next: an order confirmation reaches your e-mail. The team is preparing your tax invoice and sends it to the same address.",
             fr: "Ensuite : la confirmation arrive par e-mail. L'équipe prépare votre facture fiscale et vous l'enverra à la même adresse.",
             zh: "下一步：订单确认将发送到您的邮箱。团队正在准备税务发票，并发送到同一邮箱。" },
  reviewT: { ar: "استلمنا دفعتك وسنؤكد التفعيل خلال ساعات العمل.",
             en: "We received your payment and will confirm activation during working hours.",
             fr: "Nous avons reçu votre paiement et confirmerons l'activation pendant les heures de bureau.",
             zh: "我们已收到您的付款，将在工作时间内确认开通。" },
  reviewN: { ar: "لم نستطع مطابقة المبلغ آلياً مع الأسعار المعتمدة، فيراجعه الفريق قبل التفعيل. يصلك تأكيد على بريدك، ولا حاجة لإعادة الدفع.",
             en: "We could not match the amount to the published prices automatically, so the team reviews it before activation. A confirmation reaches your e-mail — do not pay again.",
             fr: "Nous n'avons pas pu rapprocher le montant des tarifs automatiquement ; l'équipe le vérifie avant l'activation. Une confirmation arrive par e-mail — ne payez pas une seconde fois.",
             zh: "我们无法自动将金额与公布价格核对，团队将在开通前复核。确认邮件将发送到您的邮箱——请勿重复付款。" },
  // الدفع صار يفتح طلباً حقيقياً في «طلباتي»: رقمه هنا، وزرّ يفتحه. الرسالة لا تقول إلا ما صدر عن الخادم.
  lblReq:  { ar: "رقم طلبك في لوحتك", en: "Your request no.", fr: "N° de votre demande", zh: "您的申请编号" },
  openReq: { ar: "افتح طلبك", en: "Open your request", fr: "Ouvrir votre demande", zh: "打开您的申请" },
  nextReqDocs:{ ar: "الخطوة التالية: افتح طلبك وارفع المستندات المطلوبة ليبدأ الفريق التنفيذ، وتتابع كل مرحلة من هناك.",
             en: "Next: open your request and upload the required documents so the team can start; you follow every stage from there.",
             fr: "Ensuite : ouvrez votre demande et téléversez les documents requis pour que l'équipe démarre ; vous suivez chaque étape de là.",
             zh: "下一步：打开您的申请并上传所需文件，团队即可开始执行；您可在那里跟进每个阶段。" },
  nextReq: { ar: "الخطوة التالية: تابع مراحل طلبك من لوحتك، ونبلغك حين يبدأ التنفيذ.",
             en: "Next: follow your request from your dashboard; we tell you when work starts.",
             fr: "Ensuite : suivez votre demande depuis votre espace ; nous vous prévenons au début du travail.",
             zh: "下一步：在您的面板中跟进申请进度；执行开始时我们会通知您。" },
  invSent: { ar: "وتصلك فاتورتك الضريبية على بريدك.", en: "Your tax invoice reaches your e-mail.", fr: "Votre facture fiscale arrive par e-mail.", zh: "税务发票将发送到您的邮箱。" },
  invSoon: { ar: "ويجهّز الفريق فاتورتك الضريبية وتصلك على البريد نفسه.", en: "The team prepares your tax invoice and sends it to the same e-mail.", fr: "L'équipe prépare votre facture fiscale et vous l'enverra à la même adresse.", zh: "团队正在准备税务发票，并发送到同一邮箱。" },
  signInGo:{ ar: "سجّل الدخول", en: "Sign in", fr: "Se connecter", zh: "登录" },
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
            <div class="sv1-hide" id="coOnceRow"><span>${esc(t("onceLine"))}</span><b class="price-amt" id="coOnce">—</b></div>
            <div class="sv1-hide" id="coRecRow"><span>${esc(t("recLine"))}</span><b class="price-amt" id="coRec">—</b></div>
            <div><span>${esc(t("net"))}</span><b class="price-amt" id="coNet">—</b></div>
            <div><span>${esc(t("vat"))}</span><b class="price-amt" id="coVat">—</b></div>
            <div class="big"><span>${esc(t("total"))}</span><b class="price-amt" id="coTotal">—</b></div>
          </div>
          <p class="sv1-co-fine sv1-hide" id="coRecNote"></p>
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
.sv1-co-rows{margin:0 0 10px;padding:10px 12px;background:#fff;border:1px solid var(--l);border-radius:10px;display:grid;gap:6px}
.sv1-co-rows div{display:flex;justify-content:space-between;gap:12px;font-size:12.5px}
.sv1-co-rows dt{color:var(--mut);margin:0}
.sv1-co-rows dd{margin:0;font-family:var(--fm);color:var(--ink);direction:ltr;text-align:end;overflow-wrap:anywhere;min-width:0}
.sv1-co-grp{margin:10px 0 0;font-size:11px;font-weight:600;color:var(--mut)}
.sv1-co-grp:first-child{margin-top:0}
.sv1-co-bill{display:inline-block;margin-inline-start:6px;padding:1px 8px;border-radius:999px;font-size:10.5px;font-weight:600;background:var(--acSoft);color:var(--n)}
.sv1-co-result.ok{border-color:#bfe3d2;background:#f0f9f5}
.sv1-co-result.warn{border-color:#f0d9b8;background:#fdf7ef}
.sv1-co-mock{display:inline-block;background:#b45309;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;margin-bottom:10px}
@media(max-width:900px){.sv1-co-grid{grid-template-columns:1fr}.sv1-co-sum{position:static}}
@media(max-width:600px){.sv1-co-fields{grid-template-columns:1fr}}
</style>`;

  const script = `<script>
(function(){
var LANG=${JSON.stringify(lang)},HOME=${JSON.stringify(home)};
var TX=${JSON.stringify({ empty: t("empty"), browse: t("browse"), needFill: t("needFill"), payDown: t("payDown"), loading: t("loading"), quoted: t("quoted"), signIn: t("signIn"), signInBtn: t("signInBtn"), noAmount: t("noAmount"), card: t("card"), payBtn: t("payBtn"), payWait: t("payWait"), paidOk: t("paidOk"), paidInv: t("paidInv"), paidFail: t("paidFail"), paidHold: t("paidHold"), bnplFail: t("bnplFail"), toMy: t("toMy"), mockTag: t("mockTag"), needCo: t("needCo"), empFail: t("empFail"), empDone: t("empDone"), empHold: t("empHold"), toEmployer: t("toEmployer"), tamaraYr: t("tamaraYr"), empSignIn: t("empSignIn"), empMail: t("empMail"), onePlan: t("onePlan"), toCart: t("toCart"),
  onceHd: t("onceHd"), recHd: t("recHd"), billM: t("billM"), billY: t("billY"), recNote: t("recNote"), tamaraSub: t("tamaraSub"),
  lblOrder: t("lblOrder"), lblPay: t("lblPay"), lblAmt: t("lblAmt"), lblInv: t("lblInv"), okDone: t("okDone"),
  nextInv: t("nextInv"), nextNoInv: t("nextNoInv"), reviewT: t("reviewT"), reviewN: t("reviewN"), signInGo: t("signInGo"),
  lblReq: t("lblReq"), openReq: t("openReq"), nextReqDocs: t("nextReqDocs"), nextReq: t("nextReq"), invSent: t("invSent"), invSoon: t("invSoon") })};
var CART="bp_cart",SNAP="bp_pay_order",VAT=0.15;
var REC=${JSON.stringify(recurringMap())};
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
// دورة الدفع — نفس قاعدة السلة حرفاً بحرف: ما كتبته الصفحة، ثم لاحقة المعرّف، ثم الكتالوج.
function billOf(i){
 var b=String((i&&i.billingPeriod)||'').toLowerCase();
 if(b==='monthly'||b==='yearly')return b;
 var id=String((i&&i.id)||'').toLowerCase();
 if(/-yearly$/.test(id))return 'yearly';
 if(/-monthly$/.test(id))return 'monthly';
 return REC[id.replace(/^(svc|pkg)-/,'')]||''}
function billLabel(b){return b==='yearly'?TX.billY:TX.billM}
// سؤال الجلسة مرة واحدة: يملأ بيانات العميل، ويحسم هل تُعرض الأسعار (انظر whenSession).
var ME=null;
function getMe(){
 if(!ME)ME=fetch('/api/otp',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:'{"action":"me"}'})
  .then(function(r){return r.json()}).then(function(o){return (o&&o.session&&o.session.user)||null}).catch(function(){return null});
 return ME}
// بنود اشتراك منصة التوظيف (BP-EMP-*): السعر من الخادم لا مما في السلة. ما كتبته
// الصفحة التي أضافت البند تلميحٌ فقط؛ المخصوم هو ما يقوله /api/pay?action=emp-offer.
// سلةٌ بلا هذه البنود تعمل كما كانت، بلا نداءٍ واحد إضافي.
var EMPANY=/^BP-EMP-/i,cart=readCart();
var empLines=cart.filter(function(i){return EMPANY.test(String(i&&i.id||''))});
var hasEmp=empLines.length>0,empSku=hasEmp?String(empLines[0].id).toUpperCase():'',empBnplOk=true;
function priceEmp(cb){
 if(!hasEmp){cb();return}
 var left=empLines.length;
 empLines.forEach(function(i){
  fetch('/api/pay?action=emp-offer&sku='+encodeURIComponent(i.id)).then(function(r){return r.json()}).then(function(o){
   if(o&&o.ok){i.amount=o.amountSar;i.qty=1;i.pricePublic=true;i.nameAr=o.name.ar;i.nameEn=o.name.en;if(!o.bnpl)empBnplOk=false}
   else{i.amount=0;empBnplOk=false}
  }).catch(function(){i.amount=0;empBnplOk=false}).then(function(){
   if(--left===0){try{localStorage.setItem(CART,JSON.stringify(cart))}catch(e){}cb()}})})}
function run(){
var net=0;
var unpriced=cart.filter(function(i){return !Number(i.amount)}).length;   // بنودٌ تُسعّر عند المراجعة
var hidden=cart.filter(function(i){return Number(i.amount)&&!shown(i)}).length; // مسعّرة لكنها محجوبة عن غير المسجّل
cart.forEach(function(i){net+=lineOf(i)});
var vat=Math.round(net*VAT*100)/100,total=Math.round((net+vat)*100)/100;
var payable=cart.length&&!unpriced&&!hidden&&total>0&&empLines.length<=1;

(function draw(){
 var box=$('coItems');box.innerHTML='';
 if(!cart.length){
  var e=document.createElement('p');e.className='sv1-muted';e.textContent=TX.empty;box.appendChild(e);
  var a=document.createElement('a');a.className='sv1-btn primary sm';a.href=HOME+'catalog';a.textContent=TX.browse;a.style.marginTop='10px';box.appendChild(a);
  return}
 // دفعة واحدة أولاً ثم الاشتراكات (بوسم الدورة)؛ ولا عنوان للمجموعتين إلا إن اجتمعتا.
 var once=[],rec=[],onceNet=0,recNet=0;
 cart.forEach(function(i){var bl=billOf(i);if(bl){rec.push([i,bl]);recNet+=lineOf(i)}else{once.push([i,'']);onceNet+=lineOf(i)}});
 function rowEl(i,bl){
  var r=document.createElement('div');r.className='sv1-co-row';
  var l=document.createElement('div');var b=document.createElement('b');b.style.fontWeight='500';b.textContent=nameOf(i);
  if(bl){var pill=document.createElement('span');pill.className='sv1-co-bill';pill.textContent=billLabel(bl);b.appendChild(pill)}
  l.appendChild(b);
  if((Number(i.qty)||1)>1){var s=document.createElement('small');s.textContent='×'+(i.qty||1);l.appendChild(s)}
  var v=document.createElement('b');
  if(shown(i)){v.textContent=money(lineOf(i))}else{v.style.fontWeight='400';v.style.color='var(--mut)';v.style.fontSize='11.5px';v.textContent=Number(i.amount)?TX.signIn:TX.quoted}
  r.appendChild(l);r.appendChild(v);return r}
 [[once,TX.onceHd],[rec,TX.recHd]].forEach(function(g){
  if(!g[0].length)return;
  if(once.length&&rec.length){var hd=document.createElement('div');hd.className='sv1-co-grp';hd.textContent=g[1];box.appendChild(hd)}
  g[0].forEach(function(x){box.appendChild(rowEl(x[0],x[1]))})});
 if(payable&&rec.length){
  if(once.length){$('coOnceRow').classList.remove('sv1-hide');$('coOnce').textContent=money(onceNet)}
  $('coRecRow').classList.remove('sv1-hide');$('coRec').textContent=money(recNet)}
 if(rec.length){var rn=$('coRecNote');rn.textContent=TX.recNote;rn.classList.remove('sv1-hide')}
 if(payable){$('coNet').textContent=money(net);$('coVat').textContent=money(vat);$('coTotal').textContent=money(total)}
 else{var q=unpriced?TX.quoted:TX.signIn;$('coNet').textContent=q;$('coVat').textContent='—';$('coTotal').textContent=q;
  $('coTotal').style.fontSize='14px';$('coTotal').style.fontWeight='600'}
})();

// تعبئة من الجلسة: من دخل حسابه لا يعيد كتابة بريده عند الدفع.
getMe().then(function(u){if(!u)return;
  if(!$('coEmail').value)$('coEmail').value=u.email||'';
  if(!$('coName').value)$('coName').value=u.full_name||'';});

// اللقطة والبيانات الوصفية بنفس شكل الموقع القديم حرفياً — المرجع يبقى ثابتاً
// بين تركيب النموذج والعودة من التحقق البنكي، وإلا صارت الدفعة بلا طلب.
function snapshot(){
 var prev='',pe='',pk='';try{var ps=JSON.parse(sessionStorage.getItem(SNAP)||'{}')||{};prev=ps.ref||'';pe=ps.empRef||'';pk=ps.empKey||''}catch(e){}
 var o={ref:prev||'BP-'+Date.now().toString().slice(-6),empRef:pe,empKey:pk,
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
// الاشتراك يُفتح باسم منشأة: الحقل الاختياري يصير مطلوباً هنا فقط.
function readyEmp(){return !hasEmp||!!$('coCo').value.trim()}
// يفتح صفّ الاشتراك «بانتظار الدفع» ويُلبس مرجعه الطلبَ كلَّه قبل أن يتحرّك المال؛
// فخطّاف مُيسّر وعودة تمارا يسميان الصفّ نفسه. مرةً لكل (بريد · منشأة · باقة).
var empWhy='';
function empMsg(){return empWhy==='not_signed_in'?TX.empSignIn:empWhy==='email_mismatch'?TX.empMail:TX.empFail}
function prepareEmp(){
 empWhy='';
 if(!hasEmp)return Promise.resolve(true);
 var s=snapshot(),key=s.email+'|'+s.company+'|'+empSku;
 if(s.empRef&&s.empKey===key)return Promise.resolve(true);
 return fetch('/api/pay',{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({action:'emp-prepare',sku:empSku,email:s.email,company:s.company})})
  .then(function(r){return r.json()}).then(function(o){
   if(!(o&&o.ok&&o.reference)){empWhy=(o&&o.error)||'';return false}
   try{var cur=JSON.parse(sessionStorage.getItem(SNAP)||'{}')||{};cur.ref=o.reference;cur.empRef=o.reference;cur.empKey=key;
    sessionStorage.setItem(SNAP,JSON.stringify(cur))}catch(e){return false}
   return true}).catch(function(){return false})}

// ---- اختيار الطريقة
var panes={card:$('coPaneCard'),tamara:$('coPaneTamara')};
var PAYCFG=null; // إعداد /api/pay بعد وصوله — يحتاجه زر تمارا في الوضع المحلي

// ---- العودة من البوابة
// مُيسّر يعيد ?id&status، وتمارا ?bnpl=tamara&bnpl_status&orderId، والبوابة
// المحلية ?payment&id. الثلاثة تُسوّى بنداء التحقق نفسه POST /api/pay الذي
// يستعمله الموقع القديم حرفياً: تفعيل + CRM + فاتورة من مسار واحد. وبلا هذا
// الجزء كان العميل يعود من البوابة إلى السلة نفسها بلا كلمة — والمال قد خرج.
var RESULT=$('coResult');
// det (اختياري) = {rows:[[تسمية،قيمة]…], next:'الخطوة التالية', note:'ملاحظة'} — ما يحتفظ به العميل
// بعد الدفع: رقم الطلب ومرجع الدفعة والمبلغ ورقم الفاتورة، وما سيحدث بعد ذلك.
function showResult(kind,txt,extra,link,det){RESULT.className='sv1-co-result '+kind;RESULT.textContent='';
 var p=document.createElement('p');p.textContent=txt;RESULT.appendChild(p);
 if(det&&det.rows&&det.rows.length){var dl=document.createElement('dl');dl.className='sv1-co-rows';
  det.rows.forEach(function(r){var d=document.createElement('div');var dt=document.createElement('dt');dt.textContent=r[0];
   var dd=document.createElement('dd');dd.textContent=r[1];d.appendChild(dt);d.appendChild(dd);dl.appendChild(d)});
  RESULT.appendChild(dl)}
 if(det&&det.next){var nx=document.createElement('p');nx.textContent=det.next;RESULT.appendChild(nx)}
 if(extra){var s=document.createElement('p');s.className='sv1-co-fine';s.style.margin='0 0 8px';s.textContent=extra;RESULT.appendChild(s)}
 if(det&&det.note){var nt=document.createElement('p');nt.className='sv1-co-fine';nt.style.margin='0 0 10px';nt.textContent=det.note;RESULT.appendChild(nt)}
 if(kind==='ok'||link){var a=document.createElement('a');a.className='sv1-btn primary sm';a.href=link?link.href:HOME+'my';a.textContent=link?link.label:TX.toMy;RESULT.appendChild(a)}
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
   if(v&&v.ok){var inv=v.invoice,st2=v.settle;
    var hadEmp=!!(stash&&(stash.items||[]).some(function(i){return EMPANY.test(String(i&&i.id||''))}));
    // ما يحتفظ به العميل: كلُّ رقمٍ هنا يقوله الخادم أو اللقطة، ولا يُكتب رقمٌ لم يصل.
    var rows=[],oref=(st2&&st2.ref)||(stash&&stash.ref)||'',payRef=pid||bid||'',paidSar=Number(v.amount)>0?Number(v.amount)/100:total;
    if(oref)rows.push([TX.lblOrder,oref]);
    if(payRef)rows.push([TX.lblPay,payRef]);
    if(paidSar>0)rows.push([TX.lblAmt,money(paidSar)]);
    var hasInv=!!(inv&&inv.invoiced&&inv.number);
    if(hasInv)rows.push([TX.lblInv,String(inv.number)]);
    // الطلب الذي فتحه الخادم لهذه الدفعة في «طلباتي»: رقمه وزرّ يفتحه، من رد الخادم لا من التخمين.
    var rq=st2&&st2.request,rqRef=(rq&&rq.ok&&rq.ref)?String(rq.ref):'',rqLink=rqRef?{href:HOME+'my?ref='+encodeURIComponent(rqRef),label:TX.openReq}:null;
    if(rqRef)rows.unshift([TX.lblReq,rqRef]);
    var invSettled=hasInv||(inv&&inv.reason==='already_settled');
    var det={rows:rows};
    if(hadEmp&&v.employer&&v.employer.activated)showResult('ok',TX.empDone,'',{href:HOME+'employer',label:TX.toEmployer},det);
    else if(hadEmp)showResult('warn',TX.empHold,'',null,det);
    // دفعٌ نجح لكن تسجيله لم يكتمل (الخادم نبّه الفريق): لا نقول «تمّ» ولا نطلب إعادة الدفع.
    else if(!(st2&&st2.ok))showResult('warn',TX.paidHold,'',null,det);
    // دفعٌ سُجّل ولم يُطابَق مبلغه آلياً (باقة سنوية، بند خارج الكتالوج…): مراجعة بشرية، ونقولها.
    // دفعٌ سُجّل ولم يُفتح طلبه في اللوحة (الخادم نبّه الفريق): الرسالة الصادقة نفسها، ولا نعد بما لم يحدث.
    // (طلب بلا بنود جديدة — دفعُ عرضٍ قائم — يُسوّى في طلبه نفسه فلا يُنتظر منه رقم.)
    else if(!rqRef&&!(rq&&rq.skipped))showResult('warn',TX.paidHold,'',null,det);
    else if(!st2.verified)showResult('warn',TX.reviewT,TX.reviewN,rqLink||{href:HOME+'my',label:TX.toMy},det);
    // «already_settled»: القناة الأخرى (خطّاف مُيسّر) سبقت وأصدرت الفاتورة، فهي في طريقها لا قيد التجهيز.
    else showResult('ok',TX.okDone,'',rqLink,{rows:rows,next:rqRef?((rq.documents?TX.nextReqDocs:TX.nextReq)+' '+(invSettled?TX.invSent:TX.invSoon)):(invSettled?TX.nextInv:TX.nextNoInv)});
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
// الاشتراك الشهري لا يُقسَّط (تمارا للسنوي وحده) — الخادم يرفضه أيضاً.
if(hasEmp&&!empBnplOk){var tw=$('coWayTamara');if(tw)tw.disabled=true;var tn=$('coTamaraNote');if(tn)tn.textContent=TX.tamaraYr}
// باقةٌ شهرية: الخادم لا يفتح لها جلسة تمارا (لم تكن مسعّرة هناك أصلاً)، فلا يُعرض الزر
// ثم يفشل عند اللمس — يُقال السبب ويُوجَّه العميل إلى البطاقة.
var monthlyPkg=cart.some(function(i){return /^(bp-)?pkg-.+-monthly$/i.test(String(i&&i.id||''))});
if(monthlyPkg){var tw2=$('coWayTamara');if(tw2)tw2.disabled=true;var tn2=$('coTamaraNote');if(tn2)tn2.textContent=TX.tamaraSub}
$('coTamaraGo').onclick=function(){
 var n=$('coTamaraNote');
 if(monthlyPkg){n.textContent=TX.tamaraSub;return}
 if(!payable){n.textContent=unpriced?TX.noAmount:TX.signIn;return}
 if(!ready()){n.textContent=TX.needFill;return}
 if(!readyEmp()){n.textContent=TX.needCo;return}
 if(hasEmp&&!empBnplOk){n.textContent=TX.tamaraYr;return}
 if(PAYCFG&&PAYCFG.mock&&PAYCFG.formUrl){
  var sm=this;sm.disabled=true;prepareEmp().then(function(ok){if(ok){location.href=mockUrl('tamara');return}sm.disabled=false;n.textContent=empMsg()});return}
 var self=this;self.disabled=true;n.textContent=TX.loading;
 prepareEmp().then(function(ok){
  if(!ok){self.disabled=false;n.textContent=empMsg();return}
  return fetch('/api/pay',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({action:'bnpl-checkout',provider:'tamara',lang:LANG,order:snapshot()})})
  .then(function(r){return r.json()}).then(function(o){
   if(o&&o.ok&&o.url){location.href=o.url;return}
   self.disabled=false;n.textContent=(o&&o.message)||TX.payDown})})
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
else if(empLines.length>1){payBlocked(TX.onePlan,HOME+'cart',TX.toCart);}
else if(unpriced){payBlocked(TX.noAmount,HOME+'my',TX.signInBtn);}
// الدخول يرجع إلى هذه الصفحة (next) لا إلى لوحة العميل، فتبقى السلة أمامه.
else if(hidden){payBlocked(TX.signIn,HOME+'my?next='+encodeURIComponent(HOME+'checkout'),TX.signInBtn);}
else if(!(total>0)){payBlocked(TX.noAmount,HOME+'catalog',TX.browse);}
else fetch('/api/pay').then(function(r){return r.json()}).then(function(cfg){
 PAYCFG=cfg||null;
 if(cfg&&cfg.bnpl&&cfg.bnpl.tamara===false){var tb=$('coWayTamara');if(tb)tb.disabled=true}
 if(cfg&&cfg.enabled&&cfg.mock&&cfg.formUrl){
  mount.innerHTML='';
  var tg=document.createElement('span');tg.className='sv1-co-mock';tg.textContent=TX.mockTag;mount.appendChild(tg);
  var bt=document.createElement('button');bt.type='button';bt.className='sv1-btn primary';bt.style.width='100%';bt.id='coMockPay';bt.textContent=TX.payBtn;
  var nt=document.createElement('p');nt.className='sv1-co-fine';
  bt.onclick=function(){if(!ready()){nt.textContent=TX.needFill;return}if(!readyEmp()){nt.textContent=TX.needCo;return}
   bt.disabled=true;prepareEmp().then(function(ok){if(ok){location.href=mockUrl('card');return}bt.disabled=false;nt.textContent=empMsg()})};
  mount.appendChild(bt);mount.appendChild(nt);return}
 if(!cfg||!cfg.enabled||!cfg.publishableKey||!cfg.scriptUrl){payFailed();return}
 if(cfg.cssUrl){var l=document.createElement('link');l.rel='stylesheet';l.href=cfg.cssUrl;document.head.appendChild(l)}
 var s=document.createElement('script');s.src=cfg.scriptUrl;
 s.onerror=payFailed;
 s.onload=function(){
  if(!(window.Moyasar&&typeof window.Moyasar.init==='function')){payFailed();return}
  var wanted=(cfg.methods||['creditcard']).slice();
  // Apple Pay: جاهزيته معروفة بنداءٍ متزامن من المتصفح نفسه.
  var canAP=false;try{canAP=!!(window.ApplePaySession&&window.ApplePaySession.canMakePayments&&window.ApplePaySession.canMakePayments())}catch(e){}
  var ap=cfg.applePay&&canAP?cfg.applePay:null;
  if(!ap)wanted=wanted.filter(function(m){return m!=='applepay'});
  // Samsung Pay: قيمة «samsungpay» في methods مع كائن samsung_pay (service_id
  // من حساب سامسونج للمطوّرين، والمرجع رقمَ طلب). الخادم لا يعيدها إلا مكتملة.
  var sp0=cfg.samsungPay&&cfg.samsungPay.service_id?cfg.samsungPay:null;
  // Google Pay: كائن google_pay (merchant_id من لوحة Google Pay & Wallet).
  var gp0=cfg.googlePay&&cfg.googlePay.merchant_id?cfg.googlePay:null;
  // سؤال المحفظة نفسها «هل جهازي جاهز؟» — نفس السؤال الذي يطرحه النموذج قبل أن
  // يرسم زرّه، لكن هنا قبل أن نسمّي المحفظة في العنوان أو نمرّرها. أي فشل
  // (SDK محجوب، مهلة، رفض) = غير جاهزة، فلا يظهر شيء ولا يُوعَد بشيء.
  function probe(src,have,ask,done){
   var fin=false;function end(ok){if(!fin){fin=true;done(!!ok)}}
   setTimeout(function(){end(false)},3000);
   function run(){try{ask(end)}catch(e){end(false)}}
   if(have()){run();return}
   var sc=document.createElement('script');sc.src=src;sc.onload=run;sc.onerror=function(){end(false)};document.head.appendChild(sc)}
  function askSamsung(end){
   var c=new window.SamsungPay.PaymentClient({environment:sp0.environment||'PRODUCTION'});
   c.isReadyToPay({version:'2',serviceId:sp0.service_id,protocol:'PROTOCOL_3DS',allowedBrands:['visa','mastercard','mada']})
    .then(function(r){end(r&&r.result)},function(){end(false)})}
  function askGoogle(end){
   var c=new window.google.payments.api.PaymentsClient({environment:gp0.environment||'PRODUCTION'});
   c.isReadyToPay({apiVersion:2,apiVersionMinor:0,allowedPaymentMethods:[{type:'CARD',parameters:{allowedAuthMethods:['CRYPTOGRAM_3DS'],allowedCardNetworks:['VISA','MASTERCARD']}}]})
    .then(function(r){end(r&&r.result)},function(){end(false)})}
  var pending=(sp0?1:0)+(gp0?1:0),spOk=false,gpOk=false,started=false;
  function oneDone(){if(--pending<=0&&!started){started=true;go()}}
  function go(){
   var sp=sp0&&spOk?sp0:null,gp=gp0&&gpOk?gp0:null;
   wanted=wanted.filter(function(m){return m!=='samsungpay'&&m!=='googlepay'});
   if(sp)wanted.push('samsungpay');
   if(gp)wanted.push('googlepay');
   if(!wanted.length)wanted=['creditcard'];
   // عنوان الطريقة يسمّي ما سيظهر فعلاً على هذا الجهاز، لا ما هو مكتوب في الإعداد.
   var names=[];if(ap)names.push('Apple Pay');if(gp)names.push('Google Pay');if(sp)names.push('Samsung Pay');
   var lb=$('coWayCardLabel');if(lb)lb.textContent=TX.card+(names.length?' · '+names.join(' · '):'');
   try{boot(wanted,ap,sp,gp)}
   catch(e){try{boot(['creditcard'],null,null,null)}catch(e2){payFailed()}}}
  function boot(methods,applePay,samsungPay,googlePay){
   mount.innerHTML='<div id="epay-form"></div>';
   var m=meta();
   var opt={element:'#epay-form',amount:Math.round(total*100),currency:cfg.currency||'SAR',
    description:'Business Partner order',publishable_api_key:cfg.publishableKey,
    callback_url:location.origin+location.pathname,metadata:m,
    on_initiating:async function(){
     // اشتراك منصة التوظيف: لا يتحرّك المال قبل أن يُفتح الصفّ المعلّق ويُلبس مرجعه الطلب.
     if(hasEmp){
      if(!ready()||!readyEmp()){showResult('warn',ready()?TX.needCo:TX.needFill);return false}
      if(!(await prepareEmp())){showResult('warn',empMsg());return false}}
     return {metadata:meta()}},
    methods:methods,apple_pay:applePay||undefined,
    samsung_pay:samsungPay?{service_id:samsungPay.service_id,order_number:m.ref,country:samsungPay.country||'SA',
      label:samsungPay.label||'Business Partner',environment:samsungPay.environment||'PRODUCTION'}:undefined};
   if(googlePay){
    opt.google_pay={merchant_id:googlePay.merchant_id,country:googlePay.country||'SA',
     label:googlePay.label||'Business Partner',environment:googlePay.environment||'PRODUCTION',auth_methods:['CRYPTOGRAM_3DS']};
    // زرّ Google Pay يُسمّي الشبكات بأسماء Google (VISA · MASTERCARD)؛ القيمة
    // الافتراضية للنموذج تضيف UNIONPAY وليست من أسمائها فتُسقط الزرّ.
    opt.supported_networks=['mada','visa','mastercard']}
   window.Moyasar.init(opt);
   // نداءٌ لم يرمِ خطأً ليس نموذجاً على الشاشة: الصندوق الفارغ هو ما يترك
   // المشتري بلا وسيلة دفع ولا رسالة.
   setTimeout(function(){if(mount.querySelector('#epay-form')&&!mount.querySelector('#epay-form').children.length)payFailed()},2500)}
  if(!pending){started=true;go()}
  else{
   if(sp0)probe('https://img.mpay.samsung.com/gsmpi/sdk/samsungpay_web_sdk.js',function(){return !!window.SamsungPay},askSamsung,function(ok){spOk=ok;oneDone()});
   if(gp0)probe('https://pay.google.com/gp/p/js/pay.js',function(){return !!(window.google&&window.google.payments&&window.google.payments.api)},askGoogle,function(ok){gpOk=ok;oneDone()})}};
 document.head.appendChild(s)}).catch(payFailed);
}
// جلسةٌ صالحة بلا مفتاح bp_session في المتصفح (أول زيارة بعد الدخول) كانت تُعامَل كضيف
// فتظهر «سجّل دخولك لعرض السعر وإتمام الدفع» لعميلٍ داخلٍ فعلاً. إن كان في السلة بندٌ
// مسعّر محجوب يُسأل الخادم قبل الرسم (بحدّ ٢٫٥ ثانية)؛ للضيف الفعلي لا يتغيّر شيء.
function whenSession(cb){
 if(PRICES_ON||!cart.some(function(i){return Number(i&&i.amount)&&!i.pricePublic})){cb();return}
 var fin=false;function go(){if(!fin){fin=true;cb()}}
 setTimeout(go,2500);
 getMe().then(function(u){if(u){PRICES_ON=true;document.documentElement.setAttribute('data-prices','on')}go()})}
priceEmp(function(){whenSession(run)});
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
