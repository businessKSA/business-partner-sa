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
// طرق الدفع (أمر المالك 2026-10-23، وهو يلغي «إلكتروني فقط» من 2026-09-24): بطاقة (مدى · فيزا
// · ماستركارد) · Apple Pay · Samsung Pay · Google Pay · تمارا · **حوالة بنكية مع رفع الإيصال**.
// الحوالة: تُعرض بيانات حساب الشركة (من /api/pay → `bank`، مصدرها api/_identity.js) مع زر نسخ
// لكل حقل، ثم يرفع العميل إيصال الحوالة فيُفتح طلبه «بانتظار التحقق»؛ وإن طابق المستشار الذكي
// المبلغ والمستفيد والآيبان اعتُمد الدفع وصدرت الفاتورة، وإلا راجعه إنسان بسببٍ يُقال للعميل
// (POST /api/pay {action:"bank-receipt"}).
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
import { CLIENT_LOGIN_CSS, clientLoginJs } from "./client-login.mjs";

const T = {
  title:   { ar: "إتمام الدفع", en: "Checkout", fr: "Paiement", zh: "结账" },
  desc:    { ar: "ادفع بالبطاقة (مدى · فيزا · ماستركارد) أو بالمحافظ الرقمية أو قسّطها عبر تمارا، أو حوّل بنكياً وارفع الإيصال — وتصلك فاتورتك الضريبية فور تأكيد الدفع.",
             en: "Pay by card (mada · Visa · Mastercard), digital wallet, or split it with Tamara — or transfer to our bank account and upload the receipt. Your tax invoice arrives the moment payment is confirmed.",
             fr: "Payez par carte (mada · Visa · Mastercard), portefeuille numérique ou en plusieurs fois avec Tamara — ou par virement bancaire avec le reçu. Votre facture fiscale arrive dès confirmation.",
             zh: "银行卡（mada · Visa · Mastercard）、数字钱包、Tamara 分期，或银行转账并上传回单——确认后立即收到税务发票。" },
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
  // ---- صفّ المحافظ (Apple Pay · Samsung Pay · Google Pay): ظاهر دائماً بحالة صادقة، وزرُّ كلٍّ منها
  // يُفعَّل فقط حين تكون جاهزة. ثلاث حالات: ready = مفعّلة عندنا والجهاز جاهز · dev = مفعّلة عندنا
  // لكن هذا الجهاز لا يدعمها (ويُقال له السبب بالتحديد) · off = لم تُفعَّل على الموقع بعد.
  wHd:     { ar: "المحافظ الرقمية", en: "Digital wallets", fr: "Portefeuilles numériques", zh: "数字钱包" },
  wChk:    { ar: "نتحقّق…", en: "Checking…", fr: "Vérification…", zh: "检测中…" },
  wReady:  { ar: "جاهز", en: "Ready", fr: "Prêt", zh: "可用" },
  wDev:    { ar: "غير متاح على جهازك", en: "Not on this device", fr: "Indisponible ici", zh: "此设备不可用" },
  wOff:    { ar: "غير مفعّل بعد", en: "Not enabled yet", fr: "Pas encore activé", zh: "尚未开通" },
  wReadyWhy:{ ar: "اضغط هنا ثم استخدم زرّها في نموذج الدفع أدناه.", en: "Tap here, then use its button in the payment form below.",
             fr: "Touchez ici, puis utilisez son bouton dans le formulaire ci-dessous.", zh: "点此选择，然后使用下方支付表单中的按钮。" },
  wOffWhy: { ar: "هذه المحفظة لم تُفعَّل على الموقع بعد. تقدر تدفع الآن بالبطاقة أو بالحوالة البنكية أو بتمارا.",
             en: "This wallet is not enabled on the site yet. You can pay now by card, bank transfer or Tamara.",
             fr: "Ce portefeuille n'est pas encore activé sur le site. Vous pouvez payer par carte, virement ou Tamara.",
             zh: "该钱包尚未在本站开通。您现在可使用银行卡、银行转账或 Tamara 支付。" },
  wApNoApi:{ ar: "Apple Pay يعمل في متصفح Safari على آيفون وآيباد وماك فقط، وأنت تتصفح من متصفح آخر. افتح هذه الصفحة في Safari.",
             en: "Apple Pay works only in Safari on iPhone, iPad and Mac, and you are in another browser. Open this page in Safari.",
             fr: "Apple Pay fonctionne uniquement dans Safari sur iPhone, iPad et Mac. Ouvrez cette page dans Safari.",
             zh: "Apple Pay 仅在 iPhone、iPad 和 Mac 的 Safari 中可用。请在 Safari 中打开此页面。" },
  wApNoCard:{ ar: "لا توجد بطاقة جاهزة في محفظة آبل على هذا الجهاز. أضف بطاقة (مدى أو فيزا أو ماستركارد) في تطبيق Wallet ثم أعد تحميل الصفحة.",
             en: "No card is ready in Apple Wallet on this device. Add a card (mada, Visa or Mastercard) in the Wallet app, then reload.",
             fr: "Aucune carte n'est prête dans Apple Wallet sur cet appareil. Ajoutez une carte dans l'app Wallet puis rechargez.",
             zh: "此设备的 Apple Wallet 中没有可用的卡。请在 Wallet 应用中添加银行卡后重新加载页面。" },
  wApHttp: { ar: "Apple Pay يتطلب اتصالاً آمناً (https).", en: "Apple Pay requires a secure (https) connection.",
             fr: "Apple Pay exige une connexion sécurisée (https).", zh: "Apple Pay 需要安全连接（https）。" },
  wSpNo:   { ar: "Samsung Pay يعمل على جوالات سامسونج (Galaxy) التي فيها تطبيق Samsung Pay وبطاقة مضافة، من متصفح Samsung Internet أو Chrome.",
             en: "Samsung Pay works on Samsung Galaxy phones with the Samsung Pay app and a card added, from Samsung Internet or Chrome.",
             fr: "Samsung Pay fonctionne sur les Samsung Galaxy avec l'app Samsung Pay et une carte ajoutée, depuis Samsung Internet ou Chrome.",
             zh: "Samsung Pay 适用于已安装 Samsung Pay 并添加银行卡的三星 Galaxy 手机，使用 Samsung Internet 或 Chrome。" },
  wSpBlocked:{ ar: "تعذّر الاتصال بخدمة Samsung Pay. تحقق من الإنترنت أو من مانع الإعلانات ثم أعد تحميل الصفحة.",
             en: "Could not reach the Samsung Pay service. Check your connection or ad blocker, then reload.",
             fr: "Impossible de joindre Samsung Pay. Vérifiez votre connexion ou votre bloqueur de publicités puis rechargez.",
             zh: "无法连接 Samsung Pay 服务。请检查网络或广告拦截器后重新加载。" },
  wGpNo:   { ar: "Google Pay يعمل في Chrome على أندرويد أو سطح المكتب مع حساب Google فيه بطاقة محفوظة.",
             en: "Google Pay works in Chrome on Android or desktop with a Google account that has a saved card.",
             fr: "Google Pay fonctionne dans Chrome (Android ou ordinateur) avec un compte Google ayant une carte enregistrée.",
             zh: "Google Pay 适用于 Android 或电脑上的 Chrome，且 Google 账户中已保存银行卡。" },
  wGpBlocked:{ ar: "تعذّر الاتصال بخدمة Google Pay. تحقق من الإنترنت أو من مانع الإعلانات ثم أعد تحميل الصفحة.",
             en: "Could not reach the Google Pay service. Check your connection or ad blocker, then reload.",
             fr: "Impossible de joindre Google Pay. Vérifiez votre connexion ou votre bloqueur de publicités puis rechargez.",
             zh: "无法连接 Google Pay 服务。请检查网络或广告拦截器后重新加载。" },
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
  noAmount:{ ar: "بعض بنود السلة تُسعّر عند المراجعة ولا تُدفع من هنا. احذفها من السلة لتدفع باقي البنود، أو اطلب لها عرض سعر من صفحة الخدمة.",
             en: "Some cart items are quoted on review and cannot be paid here. Remove them from the cart to pay for the rest, or request a quotation from the service page.",
             fr: "Certains articles sont sur devis et ne se paient pas ici. Retirez-les du panier pour payer le reste, ou demandez un devis depuis la page du service.",
             zh: "购物车中部分项目需审核后报价，无法在此付款。请从购物车移除这些项目后支付其余部分，或在服务页面申请报价。" },
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

  // ---- حوالة بنكية مع رفع الإيصال (أمر المالك 2026-10-23)
  bank:    { ar: "حوالة بنكية", en: "Bank transfer", fr: "Virement bancaire", zh: "银行转账" },
  bankSub: { ar: "حوّل ثم ارفع الإيصال", en: "Transfer, then upload the receipt", fr: "Virez puis téléversez le reçu", zh: "转账后上传回单" },
  bankOffShort:{ ar: "غير متاحة حالياً", en: "Not available right now", fr: "Indisponible pour le moment", zh: "暂不可用" },
  bankOff: { ar: "الحوالة البنكية غير متاحة في الوقت الحالي. ادفع بالبطاقة أو بتمارا، أو راسلنا.",
             en: "Bank transfer is not available right now. Pay by card or Tamara, or contact us.",
             fr: "Le virement bancaire n'est pas disponible pour le moment. Payez par carte ou Tamara, ou contactez-nous.",
             zh: "银行转账暂不可用。请使用银行卡或 Tamara，或联系我们。" },
  bankNoPlan:{ ar: "غير متاحة لاشتراك منصة التوظيف", en: "Not available for the recruitment plan", fr: "Indisponible pour l'abonnement", zh: "不适用于招聘订阅" },
  bankNoPlanMsg:{ ar: "اشتراك منصة التوظيف يُدفع بالبطاقة أو تمارا فقط، لأن حسابه يُفعَّل لحظة الدفع.",
             en: "The recruitment-platform subscription is paid by card or Tamara only, because the account is activated at payment.",
             fr: "L'abonnement se paie par carte ou Tamara uniquement, car le compte est activé au paiement.",
             zh: "招聘平台订阅仅支持银行卡或 Tamara，因为账户在付款时开通。" },
  bankNoQuote:{ ar: "دفع عرضٍ موقّع يتم من صفحة طلبك", en: "A signed quotation is paid from its request page", fr: "Un devis signé se paie depuis sa page", zh: "已签报价请在申请页面支付" },
  bankStep1:{ ar: "حوّل المبلغ بالضبط إلى حساب الشركة أدناه، واكتب مرجع الطلب في خانة ملاحظات الحوالة.",
             en: "Transfer the exact amount to the company account below, and write the order reference in the transfer notes.",
             fr: "Virez le montant exact au compte ci-dessous et indiquez la référence de commande dans les notes.",
             zh: "将准确金额转入下方公司账户，并在转账备注中填写订单编号。" },
  bankStep2:{ ar: "ارفع صورة الإيصال أو ملف PDF الذي يصدره بنكك.", en: "Upload the receipt image or the PDF your bank issues.",
             fr: "Téléversez l'image ou le PDF du reçu émis par votre banque.", zh: "上传银行出具的回单图片或 PDF。" },
  bankStep3:{ ar: "يتحقق المستشار الذكي من المبلغ واسم المستفيد والآيبان؛ فإن تطابقت اعتُمد الدفع وصدرت فاتورتك فوراً، وإلا راجعه فريقنا وأخبرناك بالسبب.",
             en: "The smart advisor checks the amount, beneficiary and IBAN; if they match, payment is approved and your invoice issued at once — otherwise our team reviews it and tells you why.",
             fr: "Le conseiller intelligent vérifie montant, bénéficiaire et IBAN ; s'ils correspondent le paiement est approuvé et la facture émise, sinon notre équipe examine et vous explique.",
             zh: "智能顾问核对金额、收款人和 IBAN；一致则立即确认付款并开具发票，否则由团队复核并告知原因。" },
  bkBene:  { ar: "اسم المستفيد", en: "Beneficiary", fr: "Bénéficiaire", zh: "收款人" },
  bkBank:  { ar: "البنك", en: "Bank", fr: "Banque", zh: "银行" },
  bkIban:  { ar: "الآيبان", en: "IBAN", fr: "IBAN", zh: "IBAN" },
  bkAmt:   { ar: "المبلغ المطلوب (شامل الضريبة)", en: "Amount to transfer (incl. VAT)", fr: "Montant à virer (TTC)", zh: "应转金额（含税）" },
  bkRef:   { ar: "مرجع الطلب — اكتبه في الملاحظات", en: "Order reference — put it in the notes", fr: "Référence — à indiquer dans les notes", zh: "订单编号——填写在备注中" },
  copy:    { ar: "نسخ", en: "Copy", fr: "Copier", zh: "复制" },
  copied:  { ar: "تم النسخ", en: "Copied", fr: "Copié", zh: "已复制" },
  bankFile:{ ar: "إيصال الحوالة (صورة أو PDF)", en: "Transfer receipt (image or PDF)", fr: "Reçu du virement (image ou PDF)", zh: "转账回单（图片或 PDF）" },
  bankGo:  { ar: "رفع الإيصال وإرسال الطلب", en: "Upload receipt and submit", fr: "Téléverser le reçu et envoyer", zh: "上传回单并提交" },
  bankSending:{ ar: "نرفع الإيصال ونتحقق منه…", en: "Uploading and checking the receipt…", fr: "Téléversement et vérification du reçu…", zh: "正在上传并核对回单…" },
  bankNeedFile:{ ar: "اختر صورة الإيصال أو ملف PDF أولاً.", en: "Choose the receipt image or PDF first.", fr: "Choisissez d'abord l'image ou le PDF du reçu.", zh: "请先选择回单图片或 PDF。" },
  bankBadType:{ ar: "الملف يجب أن يكون صورة (JPG أو PNG أو WebP) أو PDF.", en: "The file must be an image (JPG, PNG or WebP) or a PDF.",
             fr: "Le fichier doit être une image (JPG, PNG ou WebP) ou un PDF.", zh: "文件必须是图片（JPG、PNG 或 WebP）或 PDF。" },
  bankTooBig:{ ar: "حجم الملف كبير. استخدم ملفاً أصغر من ٣ ميغابايت.", en: "The file is too large. Use one under 3 MB.", fr: "Fichier trop volumineux (max 3 Mo).", zh: "文件过大，请使用小于 3 MB 的文件。" },
  bankFail:{ ar: "تعذّر رفع الإيصال الآن ولم يُسجَّل شيء. أعد المحاولة بعد قليل، أو ادفع بالبطاقة.",
             en: "The receipt could not be uploaded and nothing was recorded. Retry shortly, or pay by card.",
             fr: "Le reçu n'a pas pu être envoyé, rien n'a été enregistré. Réessayez ou payez par carte.", zh: "回单上传失败，未记录任何内容。请稍后重试或用银行卡支付。" },
  bankSlow:{ ar: "محاولات كثيرة — انتظر قليلاً ثم أعد المحاولة.", en: "Too many attempts — wait a moment and retry.", fr: "Trop de tentatives — patientez puis réessayez.", zh: "尝试次数过多，请稍候再试。" },
  bankTaken:{ ar: "هذا المرجع مرتبط ببريد آخر. أعد تحميل الصفحة وجرّب مجدداً.", en: "This reference belongs to another e-mail. Reload and try again.",
             fr: "Cette référence appartient à un autre e-mail. Rechargez et réessayez.", zh: "该编号属于另一邮箱。请刷新后重试。" },
  bankPaid:{ ar: "هذا الطلب مدفوع بالفعل.", en: "This order is already paid.", fr: "Cette commande est déjà payée.", zh: "该订单已付款。" },
  bankApproved:{ ar: "تحقق المستشار الذكي من إيصالك: المبلغ والمستفيد والآيبان ومرجع المصرف مطابقة، فاعتُمد دفعك وسُجّل طلبك. ويطابق فريقنا الحوالة مع كشف الحساب البنكي.",
             en: "The smart advisor checked your receipt: amount, beneficiary, IBAN and bank reference match, so your payment is approved and your order recorded. Our team also matches the transfer against the bank statement.",
             fr: "Le conseiller a vérifié votre reçu : montant, bénéficiaire, IBAN et référence bancaire correspondent ; le paiement est approuvé et la commande enregistrée. Notre équipe rapproche aussi le virement du relevé.",
             zh: "智能顾问已核对回单：金额、收款人、IBAN 和银行流水号一致，付款已确认，订单已记录。团队还会将转账与银行对账单核对。" },
  bankLimit:{ ar: "استلمنا إيصالك وبياناته مطابقة. لأن المبلغ يتجاوز حدّ الاعتماد الآلي ({n} ريال)، يؤكد فريقنا وصوله من كشف الحساب البنكي ثم يُعتمد طلبك. لا تحوّل المبلغ مرة أخرى.",
             en: "We received your receipt and its details match. Because the amount is above the automatic-approval limit ({n} SAR), our team confirms it in the bank statement and then approves your order. Do not transfer again.",
             fr: "Reçu reçu, les informations correspondent. Le montant dépassant la limite d'approbation automatique ({n} SAR), notre équipe le confirme dans le relevé bancaire avant d'approuver. Ne virez pas à nouveau.",
             zh: "已收到回单，信息一致。由于金额超过自动确认上限（{n} 里亚尔），团队将在银行对账单中确认到账后批准订单。请勿重复转账。" },
  bankLogin:{ ar: "سجّل دخولك أولاً بالبريد الذي ستُفتح به الطلب، ثم ارفع الإيصال من هنا.",
             en: "Sign in first with the e-mail the order will be opened for, then upload the receipt here.",
             fr: "Connectez-vous d'abord avec l'e-mail de la commande, puis téléversez le reçu ici.", zh: "请先使用将创建订单的邮箱登录，然后在此上传回单。" },
  bankMismatch:{ ar: "بريد الطلب يجب أن يطابق بريد حسابك المسجَّل دخوله.", en: "The order e-mail must match the account you are signed in with.",
             fr: "L'e-mail de la commande doit correspondre au compte connecté.", zh: "订单邮箱必须与当前登录账户一致。" },
  bankChanged:{ ar: "هذا المرجع مرتبط بسلة مختلفة سبق رفع إيصالها. أنشأنا لك مرجعاً جديداً: راجع سلتك ثم ارفع الإيصال من جديد.",
             en: "This reference belongs to a different basket whose receipt was already uploaded. We created a new reference: check your cart and upload again.",
             fr: "Cette référence correspond à un autre panier dont le reçu a déjà été envoyé. Nouvelle référence créée : vérifiez le panier puis réessayez.", zh: "该编号对应另一个已上传回单的购物车。已为您生成新编号：请核对购物车后重新上传。" },
  bankClosed:{ ar: "هذا الطلب أُلغي. أنشأنا لك مرجعاً جديداً: ارفع الإيصال من جديد.", en: "That order was cancelled. We created a new reference: upload the receipt again.",
             fr: "Cette commande a été annulée. Nouvelle référence créée : téléversez à nouveau le reçu.", zh: "该订单已取消。已为您生成新编号：请重新上传回单。" },
  bankOpenMany:{ ar: "لديك عدّة حوالات بانتظار التحقق. انتظر اعتمادها أو تواصل معنا قبل أن ترفع غيرها.", en: "You already have several transfers awaiting verification. Wait for them or contact us before uploading more.",
             fr: "Plusieurs virements sont déjà en attente de vérification. Patientez ou contactez-nous.", zh: "您已有多笔转账待核验。请等待或联系我们后再上传。" },
  bankReview:{ ar: "استلمنا إيصالك وطلبك بانتظار التحقق. لا تحوّل المبلغ مرة أخرى؛ نبلغك فور الاعتماد.",
             en: "We received your receipt and your order is awaiting verification. Do not transfer again — we tell you as soon as it is approved.",
             fr: "Reçu reçu : votre commande est en attente de vérification. Ne virez pas à nouveau — nous vous prévenons dès l'approbation.",
             zh: "已收到回单，订单待核验。请勿重复转账——确认后立即通知您。" },
  bankWhy: { ar: "سبب المراجعة البشرية: ", en: "Reason for human review: ", fr: "Motif de la vérification humaine : ", zh: "转人工复核原因：" },
  lblStatus:{ ar: "حالة الطلب", en: "Order status", fr: "Statut", zh: "订单状态" },
  stApproved:{ ar: "معتمد — الدفع مؤكد", en: "Approved — payment confirmed", fr: "Approuvé — paiement confirmé", zh: "已确认付款" },
  stPending:{ ar: "بانتظار التحقق", en: "Awaiting verification", fr: "En attente de vérification", zh: "待核验" },
  rs_unreadable:{ ar: "تعذّرت قراءة الإيصال آلياً", en: "The receipt could not be read automatically", fr: "Reçu illisible automatiquement", zh: "无法自动读取回单" },
  rs_not_receipt:{ ar: "الملف لا يبدو إيصال حوالة بنكية", en: "The file does not look like a bank-transfer receipt", fr: "Le fichier ne ressemble pas à un reçu de virement", zh: "文件不像银行转账回单" },
  rs_amount_missing:{ ar: "لم يظهر مبلغ الحوالة في الإيصال", en: "The amount is not visible on the receipt", fr: "Montant non visible sur le reçu", zh: "回单上看不到金额" },
  rs_amount_short:{ ar: "المبلغ في الإيصال أقل من إجمالي الطلب", en: "The receipt amount is lower than the order total", fr: "Montant du reçu inférieur au total", zh: "回单金额低于订单总额" },
  rs_amount_over:{ ar: "المبلغ في الإيصال أعلى من إجمالي الطلب", en: "The receipt amount is higher than the order total", fr: "Montant du reçu supérieur au total", zh: "回单金额高于订单总额" },
  rs_currency_mismatch:{ ar: "عملة الحوالة ليست الريال السعودي", en: "The currency is not Saudi riyal", fr: "La devise n'est pas le riyal saoudien", zh: "币种不是沙特里亚尔" },
  rs_iban_missing:{ ar: "الآيبان غير ظاهر في الإيصال", en: "The IBAN is not visible on the receipt", fr: "IBAN non visible sur le reçu", zh: "回单上看不到 IBAN" },
  rs_iban_mismatch:{ ar: "الآيبان في الإيصال لا يطابق حساب الشركة", en: "The receipt IBAN does not match the company account", fr: "L'IBAN du reçu ne correspond pas au compte", zh: "回单 IBAN 与公司账户不一致" },
  rs_beneficiary_missing:{ ar: "اسم المستفيد غير ظاهر في الإيصال", en: "The beneficiary name is not visible on the receipt", fr: "Nom du bénéficiaire non visible", zh: "回单上看不到收款人" },
  rs_beneficiary_mismatch:{ ar: "اسم المستفيد في الإيصال لا يطابق اسم الشركة", en: "The beneficiary does not match the company name", fr: "Le bénéficiaire ne correspond pas à la société", zh: "收款人与公司名称不一致" },
  rs_date_old:{ ar: "تاريخ الحوالة قديم (أكثر من ١٤ يوماً)", en: "The transfer date is older than 14 days", fr: "Date de virement trop ancienne (> 14 jours)", zh: "转账日期超过 14 天" },
  rs_date_future:{ ar: "تاريخ الحوالة في المستقبل", en: "The transfer date is in the future", fr: "Date de virement dans le futur", zh: "转账日期在未来" },
  rs_duplicate_receipt:{ ar: "هذا الإيصال سبق رفعه على طلبٍ آخر", en: "This receipt was already used for another order", fr: "Ce reçu a déjà servi pour une autre commande", zh: "该回单已用于其他订单" },
  rs_checker_unavailable:{ ar: "خدمة قراءة الإيصالات غير متاحة الآن", en: "The receipt reading service is unavailable now", fr: "Service de lecture indisponible", zh: "回单读取服务暂不可用" },
  rs_date_missing:{ ar: "تاريخ الحوالة غير ظاهر في الإيصال", en: "The transfer date is not visible on the receipt", fr: "Date du virement non visible", zh: "回单上看不到转账日期" },
  rs_date_unclear:{ ar: "تعذّر فهم تاريخ الحوالة في الإيصال (أو هو هجري)", en: "The transfer date could not be understood (or is Hijri)", fr: "Date de virement illisible (ou hégirienne)", zh: "无法识别转账日期（或为伊斯兰历）" },
  rs_not_executed:{ ar: "الإيصال لا يثبت أن الحوالة نُفِّذت", en: "The receipt does not show the transfer was executed", fr: "Le reçu ne prouve pas l'exécution du virement", zh: "回单无法证明转账已执行" },
  rs_reference_missing:{ ar: "رقم مرجع المصرف غير ظاهر في الإيصال", en: "The bank reference number is not visible", fr: "Référence bancaire non visible", zh: "回单上看不到银行流水号" },
  rs_no_independent_read:{ ar: "تعذّرت قراءة الإيصال قراءةً مستقلة للتأكد منه", en: "The receipt could not be independently read and checked", fr: "Le reçu n'a pas pu être lu de façon indépendante", zh: "无法对回单进行独立读取核验" },
  rs_above_auto_limit:{ ar: "المبلغ يتجاوز حدّ الاعتماد الآلي", en: "The amount is above the automatic-approval limit", fr: "Le montant dépasse la limite d'approbation automatique", zh: "金额超过自动确认上限" },
  rs_duplicate_check_unavailable:{ ar: "تعذّر التأكد أن الإيصال لم يُستعمل من قبل", en: "We could not confirm the receipt was not used before", fr: "Impossible de confirmer que le reçu n'a pas déjà servi", zh: "无法确认该回单未被使用过" },
  rs_checker_review:{ ar: "المدقق الآلي طلب مراجعة بشرية للإيصال", en: "The automatic checker asked for a human review", fr: "Le vérificateur automatique demande une revue humaine", zh: "自动核验器要求人工复核" },
  rs_settle_failed:{ ar: "تطابق الإيصال لكن تعذّر تسجيل الدفع آلياً", en: "The receipt matched but recording the payment failed", fr: "Le reçu correspond mais l'enregistrement a échoué", zh: "回单一致，但自动记账失败" },

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

  // صفّ المحافظ: كلُّ محفظة زرٌّ معطَّل حتى تثبت جاهزيتها (تفعيلٌ عندنا + جهازٌ جاهز) — فلا زرّ
  // يُنقر ثم يفشل. والمعطَّل يقول سببه تحته نصّاً مقروءاً لا تلميحاً. الزرّ الحقيقي للدفع يرسمه
  // نموذج مُيسّر في لوحة البطاقة؛ نقرُ هذا الزرّ يختار تلك اللوحة ويقودك إليه. الحالة تُحسم في
  // السكربت بعد وصول الإعداد وسؤال المحفظة نفسها عن جهازك.
  const WALLETS = [
    { k: "apple", name: "Apple Pay" },
    { k: "samsung", name: "Samsung Pay" },
    { k: "google", name: "Google Pay" },
  ];
  const walletItems = WALLETS.map((w) => `
                <li id="coW-${w.k}" data-st="chk">
                  <button type="button" class="wbtn" id="coWb-${w.k}" data-wallet="${w.k}" disabled aria-describedby="coW-${w.k}-why">
                    <span class="nm"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a2 2 0 0 1 2 2v1"/><path d="M3 7.5V17a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5.5A2.5 2.5 0 0 1 3 6.5"/><circle cx="16.5" cy="14" r="1.1" fill="currentColor"/></svg><b dir="ltr">${w.name}</b></span>
                    <span class="pill" id="coW-${w.k}-pill">${esc(t("wChk"))}</span>
                  </button>
                  <small id="coW-${w.k}-why"></small>
                </li>`).join("");

  const bankRow = (id, key, extra = "") => `
                <div><dt>${esc(t(key))}</dt><dd><span id="coBk-${id}" class="v"${extra}>—</span><button type="button" class="cp" data-copy="coBk-${id}" aria-label="${esc(t("copy"))} ${esc(t(key))}">${esc(t("copy"))}</button></dd></div>`;

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
            <button type="button" class="sv1-co-way" data-way="bank" id="coWayBank">
              <span class="ico"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10 12 4l9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8"/><path d="M3 20h18"/></svg></span>
              <span class="tx"><b>${esc(t("bank"))}</b><small id="coWayBankSub">${esc(t("bankSub"))}</small></span>
            </button>
            <button type="button" class="sv1-co-way" data-way="tamara" id="coWayTamara">
              <span class="ico"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 12h18"/><path d="M7 7h10"/><path d="M7 17h10"/></svg></span>
              <span class="tx"><b>${esc(t("tamara"))}</b><small>${esc(t("tamaraS"))}</small></span>
            </button>
          </div>

          <div class="sv1-co-wallets" id="coWallets" role="group" aria-label="${esc(t("wHd"))}">
            <p class="sv1-co-grp">${esc(t("wHd"))}</p>
            <ul>${walletItems}</ul>
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
            <p class="sv1-co-fine sv1-hide" id="coBankOff">${esc(t("bankOff"))}</p>
            <div id="coBankOn">
              <div id="coBankLogin" class="sv1-co-result warn sv1-hide"><p>${esc(t("bankLogin"))}</p><a class="sv1-btn primary sm" href="${home}my?next=${encodeURIComponent(home + "checkout")}">${esc(t("signInBtn"))}</a></div>
              <ol class="sv1-co-steps">
                <li>${esc(t("bankStep1"))}</li>
                <li>${esc(t("bankStep2"))}</li>
                <li>${esc(t("bankStep3"))}</li>
              </ol>
              <dl class="sv1-co-bank" id="coBankRows">${bankRow("bene", "bkBene")}${bankRow("bank", "bkBank")}${bankRow("iban", "bkIban", ' dir="ltr"')}${bankRow("amount", "bkAmt")}${bankRow("ref", "bkRef", ' dir="ltr"')}
              </dl>
              <label class="sv1-co-flabel" for="coBankFile">${esc(t("bankFile"))}</label>
              <input id="coBankFile" class="sv1-co-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf">
              <button type="button" class="sv1-btn primary" style="width:100%;margin-top:12px" id="coBankGo">${esc(t("bankGo"))}</button>
              <p class="sv1-co-fine" id="coBankNote" role="status" aria-live="polite"></p>
            </div>
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
.sv1-co-ways{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:12px}
@media(max-width:900px){.sv1-co-ways{grid-template-columns:1fr}}
.sv1-co-way{display:flex;align-items:center;gap:12px;text-align:start;background:#fff;border:1px solid var(--l);border-radius:13px;padding:14px;cursor:pointer;font-family:inherit;color:var(--ink)}
.sv1-co-way .ico{width:38px;height:38px;border-radius:10px;background:var(--acSoft);display:grid;place-items:center;color:var(--n);flex:none}
.sv1-co-way .tx b{display:block;font-size:13.5px;color:var(--ink);font-weight:500}
.sv1-co-way .tx small{font-size:11.5px;color:var(--mut)}
.sv1-co-way.on{border-color:var(--n);box-shadow:0 0 0 3px rgba(67,56,245,.10)}
.sv1-co-way[disabled]{opacity:.5;cursor:default}
.sv1-co-way .tx{min-width:0}
.sv1-co-wallets{margin:0 0 16px}
.sv1-co-wallets ul{list-style:none;margin:8px 0 0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.sv1-co-wallets li{border:1px solid var(--l);border-radius:12px;padding:10px 11px;background:#fff;display:flex;flex-direction:column;gap:6px}
.sv1-co-wallets .wbtn{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:8px;width:100%;cursor:default;font-family:inherit;border-radius:8px}
.sv1-co-wallets .nm{display:inline-flex;align-items:center;gap:6px;color:var(--ink);font-size:12.5px}
.sv1-co-wallets .nm svg{color:var(--n);flex:none}
.sv1-co-wallets .nm b{font-weight:500}
.sv1-co-wallets .pill{margin-inline-start:auto;padding:2px 9px;border-radius:999px;font-size:10.5px;font-weight:600;background:#eef1f8;color:var(--mut);white-space:nowrap}
.sv1-co-wallets small{font-size:11px;line-height:1.75;color:var(--mut)}
.sv1-co-wallets li[data-st="ready"]{border-color:#bfe3d2;background:#f0f9f5}
.sv1-co-wallets li[data-st="ready"] .wbtn{cursor:pointer}
.sv1-co-wallets li[data-st="ready"] .wbtn:focus-visible{outline:2px solid var(--n);outline-offset:3px}
.sv1-co-wallets li[data-st="ready"] .pill{background:#16815A;color:#fff}
.sv1-co-wallets li[data-st="dev"]{background:#fdf7ef;border-color:#f0d9b8}
.sv1-co-wallets li[data-st="dev"] .pill{background:#fbe9c9;color:#8a5a12}
.sv1-co-wallets li[data-st="off"]{background:var(--soft)}
.sv1-co-wallets li[data-st="off"] .nm{opacity:.7}
.sv1-co-wallets li.pick{box-shadow:0 0 0 3px rgba(67,56,245,.16);border-color:var(--n)}
@media(max-width:640px){.sv1-co-wallets ul{grid-template-columns:1fr}}
.sv1-co-steps{margin:0 0 14px;padding:0 20px 0 0;display:grid;gap:7px;font-size:12.5px;line-height:1.8;color:var(--s)}
html[dir="ltr"] .sv1-co-steps{padding:0 0 0 20px}
.sv1-co-bank{margin:0 0 14px;padding:4px 12px;background:#fff;border:1px solid var(--l);border-radius:12px;display:grid}
.sv1-co-bank>div{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 12px;padding:9px 0;border-bottom:1px solid #eef1f8}
.sv1-co-bank>div:last-child{border-bottom:0}
.sv1-co-bank dt{font-size:11.5px;color:var(--mut);margin:0}
.sv1-co-bank dd{margin:0;display:flex;align-items:center;gap:10px;min-width:0;max-width:100%}
.sv1-co-bank .v{font-family:var(--fm);font-size:13px;color:var(--ink);overflow-wrap:anywhere;min-width:0}
.sv1-co-bank .cp{flex:none;border:1px solid var(--l);background:var(--soft);color:var(--n);border-radius:8px;padding:4px 11px;font:inherit;font-size:11.5px;cursor:pointer}
.sv1-co-bank .cp.done{background:#16815A;border-color:#16815A;color:#fff}
.sv1-co-flabel{display:block;font-size:11.5px;color:var(--mut);margin:0 0 6px}
.sv1-co-file{width:100%;border:1px dashed #b7c0d8;border-radius:11px;padding:12px;font:inherit;font-size:12.5px;background:#fff;color:var(--ink)}
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

  // سكربتٌ واحد: باب الدخول المشترك أولاً (بلا وسمه) ثم صفحة الدفع. اختبارات هذه الصفحة
  // تشغّل `script` كله في بيئة مصغَّرة وتنتظر وسماً واحداً.
  const script = `<script>
${clientLoginJs(lang)}
(function(){
var LANG=${JSON.stringify(lang)},HOME=${JSON.stringify(home)};
var TX=${JSON.stringify(Object.fromEntries(Object.keys(T).map((k) => [k, t(k)])))};
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

// عودةٌ من بوابةٍ فشلت أو أُلغيت: ما كتبه العميل قبل أن يضغط «ادفع» محفوظٌ في اللقطة
// (sessionStorage)، فيُعاد إلى الحقول بدل أن يجد جواله فارغاً ويكتب من جديد.
(function restoreTyped(){var s=null;try{s=JSON.parse(sessionStorage.getItem(SNAP)||'null')}catch(e){}
 if(!s)return;
 [['coName','name'],['coPhone','phone'],['coEmail','email'],['coCo','company']].forEach(function(p){
  var el=$(p[0]);if(el&&!el.value&&s[p[1]])el.value=String(s[p[1]])})})();
// تعبئة من الجلسة: من دخل حسابه لا يعيد كتابة بريده عند الدفع.
getMe().then(function(u){if(!u)return;
  // حسابٌ أنشأه أول دخول بنفاذ ولم يُكمِل بريده وجواله: لا بريد حقيقياً بعد لخانة الفاتورة.
  // يُرسَل إلى خطوة الإكمال في /my ثم يعود إلى هنا.
  if(u.contactPending){location.replace(HOME+'my?next='+encodeURIComponent(HOME+'checkout'));return}
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
function ready(){return !!($('coName').value.trim()&&$('coPhone').value.trim()&&/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test($('coEmail').value.trim()))}
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
var panes={card:$('coPaneCard'),tamara:$('coPaneTamara'),bank:$('coPaneBank')};
var wayBtns=Array.prototype.slice.call(document.querySelectorAll('.sv1-co-way'));
function selectWay(k){
 wayBtns.forEach(function(x){x.classList.toggle('on',x.getAttribute('data-way')===k)});
 for(var n in panes)if(panes[n])panes[n].classList.toggle('sv1-hide',n!==k)}
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
    closeOrder();return}
   // بطاقة مرفوضة تُعاد؛ ودفعة لم نستطع قراءتها لا تُعاد — وإلا دفع مرتين.
   if(v&&v.error==='verify_unavailable'){showResult('warn',TX.paidHold,v.paymentId||'');return}
   showResult('warn',TX.paidFail)})
  .catch(function(){showResult('warn',TX.paidHold)});
})();

// البوابة المحلية (لا مفتاح مُيسّر و APP_ENV=development): صفحة يخدمها الخادم
// نفسه، تختار فيها النتيجة ثم تعود إلى هنا وتُسوّى بالمسار الحقيقي.
function mockUrl(provider){snapshot();var u=PAYCFG.formUrl;
 return u+(u.indexOf('?')<0?'?':'&')+'back='+encodeURIComponent(location.pathname)+'&amount='+encodeURIComponent(String(total))+'&label='+encodeURIComponent('Business Partner order')+'&provider='+provider}
wayBtns.forEach(function(b){
 b.onclick=function(){if(b.disabled)return;selectWay(b.getAttribute('data-way'));
  if(b.getAttribute('data-way')==='bank')fillBank()}});

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

// ---- الحوالة البنكية مع رفع الإيصال (أمر المالك 2026-10-23)
// بيانات الحساب من /api/pay (الحقل bank، مصدرها api/_identity.js) — لا رقم حساب في هذا الملف. الإيصال يُرفع
// إلى POST /api/pay {action:"bank-receipt"} فيفتح الخادم الطلب «بانتظار التحقق» ثم يقارن المستشار
// الذكي المبلغ والمستفيد والآيبان: مطابق → يُعتمد الدفع وتصدر الفاتورة، وإلا مراجعة بشرية بسبب يُقال هنا.
var BANK=null,bankBusy=false,SESS_EMAIL='',noQuoteLine=cart.some(function(i){return /^sv1:/i.test(String(i&&i.id||''))});
var OKTYPE=/^(image\\/(jpeg|png|webp)|application\\/pdf)$/,MAXB=3*1024*1024;
function setText(id,v){var e=$(id);if(e)e.textContent=v}
function bankNote(m){setText('coBankNote',m||'')}
function fmtIban(v){return String(v||'').replace(/\\s+/g,'').replace(/(.{4})/g,'$1 ').trim()}
function setupBank(b){
 var tile=$('coWayBank');BANK=b&&b.enabled?b:null;
 function off(sub,msg){if(tile)tile.disabled=true;setText('coWayBankSub',sub);
  var o=$('coBankOff'),on=$('coBankOn');if(o){o.textContent=msg||TX.bankOff;o.classList.remove('sv1-hide')}if(on)on.classList.add('sv1-hide')}
 if(!BANK){off(TX.bankOffShort);return}
 if(hasEmp){off(TX.bankNoPlan,TX.bankNoPlanMsg);return}
 if(noQuoteLine){off(TX.bankNoQuote,TX.bankNoQuote);return}
 setText('coBk-bene',LANG==='ar'?BANK.beneficiary:(BANK.beneficiaryEn||BANK.beneficiary));
 setText('coBk-bank',LANG==='ar'?(BANK.bank||BANK.bankEn):(BANK.bankEn||BANK.bank));
 setText('coBk-iban',fmtIban(BANK.iban));$('coBk-iban').setAttribute('data-raw',String(BANK.iban||''));
 fillBank();
 // الحوالة تُفتح باسم حسابٍ مسجَّل دخوله: بلا جلسة يُطلب الدخول بدل رفعٍ يرفضه الخادم.
 getMe().then(function(u){SESS_EMAIL=u&&u.email?String(u.email).toLowerCase():'';
  var lg=$('coBankLogin');if(lg)lg.classList.toggle('sv1-hide',!!SESS_EMAIL)})}
function newRef(){try{var o=JSON.parse(sessionStorage.getItem(SNAP)||'{}')||{};o.ref='';sessionStorage.setItem(SNAP,JSON.stringify(o))}catch(e){}fillBank()}
function fillBank(){
 if(!BANK)return;
 setText('coBk-amount',money(total));$('coBk-amount').setAttribute('data-raw',total.toFixed(2));
 try{setText('coBk-ref',snapshot().ref)}catch(e){}}
function copyText(txt,btn){
 function done(){btn.textContent=TX.copied;btn.classList.add('done');setTimeout(function(){btn.textContent=TX.copy;btn.classList.remove('done')},1600)}
 function legacy(){try{var ta=document.createElement('textarea');ta.value=txt;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.opacity='0';
  document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);done()}catch(e){}}
 try{if(typeof navigator!=='undefined'&&navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(done,legacy);return}}catch(e){}
 legacy()}
Array.prototype.forEach.call(document.querySelectorAll('[data-copy]'),function(btn){
 btn.onclick=function(){var el=$(btn.getAttribute('data-copy'));if(!el)return;copyText(el.getAttribute('data-raw')||el.textContent,btn)}});
function readB64(blob){return new Promise(function(res,rej){var r=new FileReader();
 r.onload=function(){var u=String(r.result||'');res(u.slice(u.indexOf(',')+1))};r.onerror=function(){rej(new Error('read'))};r.readAsDataURL(blob)})}
// صورة كبيرة تُصغَّر إلى JPEG قبل الرفع: جسم الطلب على الاستضافة محدود، وصور الجوال تتجاوز ٥ ميغابايت.
function shrink(file){return new Promise(function(res){
 if(!/^image\\//.test(file.type)||file.size<=900*1024){res(file);return}
 try{var img=new Image(),u=URL.createObjectURL(file);
  img.onload=function(){var k=Math.min(1,1800/Math.max(img.width,img.height)),c=document.createElement('canvas');
   c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);c.getContext('2d').drawImage(img,0,0,c.width,c.height);
   try{URL.revokeObjectURL(u)}catch(e){}
   c.toBlob(function(b){res(b&&b.size<file.size?b:file)},'image/jpeg',0.82)};
  img.onerror=function(){res(file)};img.src=u}catch(e){res(file)}})}
function bankErr(code){
 if(code==='login_required'){SESS_EMAIL='';var lg=$('coBankLogin');if(lg)lg.classList.remove('sv1-hide');return TX.bankLogin}
 // مرجعٌ لا يصلح لهذه السلة (سلة أخرى · طلب أُلغي · بريد آخر): يُولَّد مرجع جديد ولا يُترك العميل عالقاً.
 if(code==='cart_changed'){newRef();return TX.bankChanged}
 if(code==='request_closed'){newRef();return TX.bankClosed}
 if(code==='ref_taken'){newRef();return TX.bankTaken}
 return code==='email_mismatch'?TX.bankMismatch:code==='too_many_open'?TX.bankOpenMany:code==='slow_down'?TX.bankSlow:code==='already_paid'?TX.bankPaid:code==='too_large'?TX.bankTooBig
  :code==='bad_type'?TX.bankBadType:code==='quote_only_items'?TX.noAmount:code==='bank_not_for_plan'?TX.bankNoPlanMsg:code==='bank_not_configured'?TX.bankOff:TX.bankFail}
// الطلب سُجّل على الخادم: لا سلة ولا نموذج يبقيان فيُرسَل مرتين.
function closeOrder(){
 $('coWays').classList.add('sv1-hide');for(var k in panes)if(panes[k])panes[k].classList.add('sv1-hide');
 var w=$('coWallets');if(w)w.classList.add('sv1-hide');
 try{localStorage.removeItem(CART)}catch(e){}try{sessionStorage.removeItem(SNAP)}catch(e){}
 try{dispatchEvent(new Event('bp:cart'))}catch(e){}}
function onBankReply(j){
 if(!(j&&j.ok)){bankNote(bankErr(j&&j.error));return}
 bankNote('');
 var inv=!!(j.invoice&&j.invoice.invoiced&&j.invoice.number),ok=j.state==='approved';
 var rows=[[TX.lblOrder,j.orderRef],[TX.lblReq,j.ref],[ok?TX.lblAmt:TX.bkAmt,Number(j.amount)>0?money(j.amount):''],[TX.lblStatus,ok?TX.stApproved:TX.stPending],[TX.lblInv,inv?String(j.invoice.number):'']]
  .filter(function(r){return r[1]});
 var link=j.ref?{href:HOME+'my?ref='+encodeURIComponent(j.ref),label:TX.openReq}:null;
 if(ok)showResult('ok',TX.bankApproved,'',link,{rows:rows,next:inv?TX.nextInv:TX.nextNoInv});
 else if((j.reasons||[]).length===1&&j.reasons[0]==='above_auto_limit')
  showResult('warn',TX.bankLimit.replace('{n}',String(j.autoLimit||'')),'',link,{rows:rows});
 else{var why=(j.reasons||[]).map(function(c){return TX['rs_'+c]||''}).filter(Boolean).join(' · ');
  showResult('warn',TX.bankReview,why?TX.bankWhy+why:'',link,{rows:rows})}
 closeOrder()}
$('coBankGo').onclick=function(){
 var btn=this;if(bankBusy||!BANK)return;
 if(!payable){bankNote(unpriced?TX.noAmount:TX.signIn);return}
 if(!ready()){bankNote(TX.needFill);return}
 if(!SESS_EMAIL){var lg=$('coBankLogin');if(lg)lg.classList.remove('sv1-hide');bankNote(TX.bankLogin);return}
 var inp=$('coBankFile'),f=inp&&inp.files&&inp.files[0];
 if(!f){bankNote(TX.bankNeedFile);return}
 if(!OKTYPE.test(String(f.type||'').toLowerCase())){bankNote(TX.bankBadType);return}
 bankBusy=true;btn.disabled=true;bankNote(TX.bankSending);
 shrink(f).then(function(g){
  if(g.size>MAXB)throw new Error('big');
  return readB64(g).then(function(b64){return {name:f.name,mime:String(g.type||f.type),base64:b64}})})
 .then(function(file){
  return fetch('/api/pay',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({action:'bank-receipt',lang:LANG,order:snapshot(),file:file})}).then(function(r){return r.json()})})
 .then(function(j){bankBusy=false;btn.disabled=false;onBankReply(j)})
 .catch(function(e){bankBusy=false;btn.disabled=false;bankNote(e&&e.message==='big'?TX.bankTooBig:TX.bankFail)})};

// ---- البطاقة والمحافظ (مُيسّر) — نفس نداء التركيب في الموقع القديم
var mount=$('coPayMount');
// ---- صفّ المحافظ: حالة صادقة لكلٍّ، من الإعداد + جاهزية هذا الجهاز (لا من الوعود).
//   ready = مفعّلة عندنا والجهاز جاهز (زرّها الحقيقي في نموذج مُيسّر، ونقر هذا الزرّ يقود إليه)
//   dev   = مفعّلة عندنا لكن هذا الجهاز لا يدعمها — يُقال السبب بالتحديد (متصفح · بطاقة · SDK)
//   off   = لم تُفعَّل على الموقع بعد (الإعداد يعيدها null) — يُقال ذلك ولا يُوعَد بموعد
// الزرّ معطَّل ما لم تكن ready، فلا زرّ يُنقر ثم يفشل.
var WHY={apple:{noapi:TX.wApNoApi,nocard:TX.wApNoCard,http:TX.wApHttp},samsung:{no:TX.wSpNo,blocked:TX.wSpBlocked},google:{no:TX.wGpNo,blocked:TX.wGpBlocked}};
function setWallet(k,st,why){
 var li=$('coW-'+k);if(!li)return;li.setAttribute('data-st',st);
 var b=$('coWb-'+k);if(b)b.disabled=st!=='ready';
 $('coW-'+k+'-pill').textContent=st==='ready'?TX.wReady:st==='dev'?TX.wDev:st==='off'?TX.wOff:TX.wChk;
 $('coW-'+k+'-why').textContent=st==='ready'?TX.wReadyWhy:st==='dev'?(why||''):st==='off'?TX.wOffWhy:''}
// dv = ما قالته الأجهزة عن نفسها: {apple:'ok'|'noapi'|'nocard'|'http', samsung:'ok'|'no'|'blocked', google:…}
function settleWallets(cfg,dv){dv=dv||{};
 [['apple',cfg&&cfg.applePay],['samsung',cfg&&cfg.samsungPay&&cfg.samsungPay.service_id],['google',cfg&&cfg.googlePay&&cfg.googlePay.merchant_id]].forEach(function(x){
  var k=x[0],r=dv[k]||'';
  if(!x[1])setWallet(k,'off');
  else if(r==='ok')setWallet(k,'ready');
  else{var m=WHY[k];setWallet(k,'dev',m[r]||m[Object.keys(m)[0]])}})}
['apple','samsung','google'].forEach(function(k){var b=$('coWb-'+k);if(!b)return;
 b.onclick=function(){if(b.disabled)return;selectWay('card');
  ['apple','samsung','google'].forEach(function(j){var li=$('coW-'+j);if(li)li.classList.toggle('pick',j===k)});
  try{mount.scrollIntoView({behavior:'smooth',block:'center'})}catch(e){}}});
// لا نموذج دفع على الشاشة (سلة فارغة · دخول مطلوب · عطل البوابة): لا صفّ يوحي بمحافظ جاهزة.
function hideWallets(){var w=$('coWallets');if(w)w.classList.add('sv1-hide')}
function payFailed(){hideWallets();mount.innerHTML='';var p=document.createElement('p');p.className='sv1-co-fine';p.style.color='#b42318';p.textContent=TX.payDown;mount.appendChild(p)}
// مُيسّر يرفض مبلغ الصفر برسالة إنجليزية عامة «Form configuration issue»؛
// لا نصل إليها أصلاً: نقول للمشتري لماذا لا يوجد مبلغ وماذا يفعل.
function payBlocked(msg,href,label){
 hideWallets();mount.innerHTML='';
 var p=document.createElement('p');p.className='sv1-co-fine';p.textContent=msg;mount.appendChild(p);
 if(href){var a=document.createElement('a');a.className='sv1-btn primary sm';a.href=href;a.textContent=label;a.style.marginTop='10px';mount.appendChild(a)}
 var tg=$('coTamaraGo');if(tg)tg.disabled=true;var bw=$('coWayBank');if(bw)bw.disabled=true}
// الضيف عند الدفع يرى «المتابعة بجوجل» هنا في الصفحة نفسها: يدخل وتبقى سلته أمامه
// (إعادة تحميل بعد الدخول لا انتقال). والزرّ الآخر يذهب إلى /my بالبريد وبـnext.
// الترتيب كما قرّر المالك: نفاذ أولاً، ثم جوجل، ثم البريد (الزرّ الأخير يذهب إلى /my).
// أول دخول بنفاذ ينشئ الحساب، فيُرسَل إلى /my خطوةً واحدة لبريده وجواله ثم يعود إلى الدفع.
function guestGoogle(){var L=window.SV1Login;if(!L)return;var a=mount.querySelector('a');if(!a)return;
 var ns=document.createElement('div');ns.style.marginTop='12px';
 var or0=document.createElement('div');or0.className='bpg-or';or0.textContent=L.orPlain;
 var s=document.createElement('div');
 var or=document.createElement('div');or.className='bpg-or';or.textContent=L.or;
 mount.insertBefore(ns,a);mount.insertBefore(or0,a);mount.insertBefore(s,a);mount.insertBefore(or,a);
 L.mountNafath(ns,{purpose:'portal',onSuccess:function(o){try{localStorage.setItem('bp_session','1')}catch(x){}
  if(o&&o.needsContact){location.href=HOME+'my?next='+encodeURIComponent(HOME+'checkout')}else{location.reload()}}});
 L.mountGoogle(s,{onSuccess:function(){try{localStorage.setItem('bp_session','1')}catch(x){}location.reload()},
  onError:function(m){var p=document.createElement('p');p.className='sv1-co-fine';p.style.color='#b42318';p.textContent=m;mount.insertBefore(p,or)},
  onHide:function(){or.style.display='none'}})}
if(!cart.length){hideWallets();mount.innerHTML='';}
else if(empLines.length>1){payBlocked(TX.onePlan,HOME+'cart',TX.toCart);}
else if(unpriced){payBlocked(TX.noAmount,HOME+'cart',TX.toCart);}
// الدخول يرجع إلى هذه الصفحة (next) لا إلى لوحة العميل، فتبقى السلة أمامه.
else if(hidden){payBlocked(TX.signIn,HOME+'my?next='+encodeURIComponent(HOME+'checkout'),TX.signInBtn);guestGoogle();}
else if(!(total>0)){payBlocked(TX.noAmount,HOME+'catalog',TX.browse);}
else fetch('/api/pay').then(function(r){return r.json()}).then(function(cfg){
 PAYCFG=cfg||null;
 setupBank(cfg&&cfg.bank);
 if(cfg&&cfg.bnpl&&cfg.bnpl.tamara===false){var tb=$('coWayTamara');if(tb)tb.disabled=true}
 if(cfg&&cfg.enabled&&cfg.mock&&cfg.formUrl){
  settleWallets(cfg,{});
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
  // وأي نتيجة غير «جاهز» تُسمّى بسببها: متصفح بلا Apple Pay · لا بطاقة في Wallet · اتصال غير آمن.
  var apDv='noapi';
  try{
   if(location.protocol==='http:'&&!/^(localhost|127\\.0\\.0\\.1)$/.test(String(location.hostname||'')))apDv='http';
   else if(window.ApplePaySession)apDv=(window.ApplePaySession.canMakePayments&&window.ApplePaySession.canMakePayments())?'ok':'nocard'
  }catch(e){}
  var canAP=apDv==='ok';
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
   var fin=false;function end(ok,why){if(!fin){fin=true;done(!!ok,ok?'ok':(why||'no'))}}
   setTimeout(function(){end(false,'blocked')},6000);
   function run(){try{ask(function(ok){end(ok,'no')})}catch(e){end(false,'no')}}
   if(have()){run();return}
   var sc=document.createElement('script');sc.src=src;sc.onload=run;sc.onerror=function(){end(false,'blocked')};document.head.appendChild(sc)}
  function askSamsung(end){
   var c=new window.SamsungPay.PaymentClient({environment:sp0.environment||'PRODUCTION'});
   c.isReadyToPay({version:'2',serviceId:sp0.service_id,protocol:'PROTOCOL_3DS',allowedBrands:['visa','mastercard','mada']})
    .then(function(r){end(r&&r.result)},function(){end(false)})}
  function askGoogle(end){
   var c=new window.google.payments.api.PaymentsClient({environment:gp0.environment||'PRODUCTION'});
   c.isReadyToPay({apiVersion:2,apiVersionMinor:0,allowedPaymentMethods:[{type:'CARD',parameters:{allowedAuthMethods:['CRYPTOGRAM_3DS'],allowedCardNetworks:['VISA','MASTERCARD']}}]})
    .then(function(r){end(r&&r.result)},function(){end(false)})}
  var pending=(sp0?1:0)+(gp0?1:0),spOk=false,gpOk=false,spDv='no',gpDv='no',started=false;
  function oneDone(){if(--pending<=0&&!started){started=true;go()}}
  function go(){
   var sp=sp0&&spOk?sp0:null,gp=gp0&&gpOk?gp0:null;
   wanted=wanted.filter(function(m){return m!=='samsungpay'&&m!=='googlepay'});
   if(sp)wanted.push('samsungpay');
   if(gp)wanted.push('googlepay');
   if(!wanted.length)wanted=['creditcard'];
   // عنوان الطريقة يسمّي ما سيظهر فعلاً على هذا الجهاز، لا ما هو مكتوب في الإعداد.
   settleWallets(cfg,{apple:apDv,samsung:spOk?'ok':spDv,google:gpOk?'ok':gpDv});
   var names=[];if(ap)names.push('Apple Pay');if(gp)names.push('Google Pay');if(sp)names.push('Samsung Pay');
   var lb=$('coWayCardLabel');if(lb)lb.textContent=TX.card+(names.length?' · '+names.join(' · '):'');
   try{boot(wanted,ap,sp,gp)}
   catch(e){hideWallets();try{boot(['creditcard'],null,null,null)}catch(e2){payFailed()}}}
  function boot(methods,applePay,samsungPay,googlePay){
   mount.innerHTML='<div id="epay-form"></div>';
   var m=meta();
   // نموذج مُيسّر يقرأ لغته من <html lang> إن لم تُمرَّر، ولا يعرف إلا العربية والإنجليزية:
   // على /fr و/zh كان يرسم «Something went wrong» بدل البطاقة (لا يلتقطه فحص الصندوق الفارغ).
   var opt={element:'#epay-form',language:LANG==='ar'?'ar':'en',amount:Math.round(total*100),currency:cfg.currency||'SAR',
    description:'Business Partner order '+m.ref,publishable_api_key:cfg.publishableKey,
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
   if(sp0)probe('https://img.mpay.samsung.com/gsmpi/sdk/samsungpay_web_sdk.js',function(){return !!window.SamsungPay},askSamsung,function(ok,why){spOk=ok;spDv=why;oneDone()});
   if(gp0)probe('https://pay.google.com/gp/p/js/pay.js',function(){return !!(window.google&&window.google.payments&&window.google.payments.api)},askGoogle,function(ok,why){gpOk=ok;gpDv=why;oneDone()})}};
 document.head.appendChild(s)}).catch(function(){setupBank(null);payFailed()});
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
    body: CSS + `<style id="sv1-co-login-css">${CLIENT_LOGIN_CSS}</style>` + body,
    script,
    noindex: true,
  });
}
