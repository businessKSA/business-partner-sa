// Simple V1 — the client portal (/my). One page, four languages, rendered
// client-side from /api/simple + /api/otp. Deliberately small: the customer
// sees what needs attention, their requests, and the one action each request
// is waiting on (approve quote → sign contract → pay → done).

import fs from "node:fs";
import { CLIENT_LOGIN_CSS, clientLoginScript } from "./client-login.mjs";

// The seller printed on the invoice page comes from the one place the company's
// legal identity lives (site/data/site.json → legal), never typed here.
function sellerFromSite() {
  try {
    const L = JSON.parse(fs.readFileSync(new URL("../data/site.json", import.meta.url), "utf8")).legal || {};
    return { name: L.name || "", nameEn: L.nameEn || "", vat: String(L.vat || ""), city: L.city || "", cityEn: L.cityEn || "" };
  } catch { return { name: "", nameEn: "", vat: "", city: "", cityEn: "" }; }
}

const P = {
  title: { ar: "حسابي — Business Partner", en: "My account — Business Partner", fr: "Mon compte — Business Partner", zh: "我的账户 — Business Partner" },
  navHome: { ar: "الرئيسية", en: "Home", fr: "Accueil", zh: "首页" },
  navNew: { ar: "ابدأ طلب جديد", en: "New request", fr: "Nouvelle demande", zh: "新申请" },
  navRequests: { ar: "طلباتي", en: "My requests", fr: "Mes demandes", zh: "我的申请" },
  navQuotes: { ar: "عروض الأسعار", en: "Quotations", fr: "Devis", zh: "报价" },
  navContracts: { ar: "العقود", en: "Contracts", fr: "Contrats", zh: "合同" },
  navAppts: { ar: "المواعيد", en: "Appointments", fr: "Rendez-vous", zh: "预约" },
  navPay: { ar: "السلة والدفع", en: "Cart & payment", fr: "Panier et paiement", zh: "购物车与付款" },
  navInvoices: { ar: "الفواتير", en: "Invoices", fr: "Factures", zh: "发票" },
  navChats: { ar: "المحادثات", en: "Conversations", fr: "Conversations", zh: "对话" },
  navCompany: { ar: "بيانات الشركة", en: "Company details", fr: "Données de l'entreprise", zh: "公司信息" },
  logout: { ar: "تسجيل الخروج", en: "Sign out", fr: "Déconnexion", zh: "退出登录" },
  site: { ar: "الموقع", en: "Website", fr: "Site", zh: "网站" },
  attention: { ar: "وش يحتاج انتباهك الآن؟", en: "What needs your attention now?", fr: "Qu'est-ce qui demande votre attention ?", zh: "现在需要您关注什么？" },
  kActive: { ar: "طلبات نشطة", en: "Active requests", fr: "Demandes actives", zh: "进行中的申请" },
  kQuotes: { ar: "عروض بانتظار اعتمادك", en: "Quotes awaiting approval", fr: "Devis à approuver", zh: "待确认的报价" },
  kContracts: { ar: "عقود بانتظار توقيعك", en: "Contracts awaiting signature", fr: "Contrats à signer", zh: "待签署的合同" },
  kPayments: { ar: "مدفوعات مستحقة", en: "Payments due", fr: "Paiements dus", zh: "待付款项" },
  kAppts: { ar: "موعد قادم", en: "Upcoming appointment", fr: "Prochain rendez-vous", zh: "即将到来的预约" },
  today: { ar: "وش تحتاج اليوم؟", en: "What do you need today?", fr: "De quoi avez-vous besoin aujourd'hui ?", zh: "今天需要什么帮助？" },
  empty: { ar: "لا يوجد شيء هنا بعد.", en: "Nothing here yet.", fr: "Rien ici pour le moment.", zh: "这里还没有内容。" },
  ref: { ar: "رقم الطلب", en: "Reference", fr: "Référence", zh: "编号" },
  status: { ar: "الحالة", en: "Status", fr: "Statut", zh: "状态" },
  open: { ar: "فتح", en: "Open", fr: "Ouvrir", zh: "打开" },
  back: { ar: "رجوع", en: "Back", fr: "Retour", zh: "返回" },
  conversation: { ar: "المحادثة", en: "Conversation", fr: "Conversation", zh: "对话" },
  // One name for one thing: the homepage, the portal and the operations board
  // all say «نطاق الخدمات» / "Scope of Work". The portal was still saying
  // «النطاق» after the rename, so a customer met two names for the same list.
  scope: { ar: "نطاق الخدمات", en: "Scope of Work", fr: "Périmètre des services", zh: "服务范围" },
  cancelTitle:{ ar: "إلغاء الطلب", en: "Cancel this request", fr: "Annuler la demande", zh: "取消此请求" },
  cancelAsk:  { ar: "اطلب الإلغاء", en: "Request cancellation", fr: "Demander l'annulation", zh: "申请取消" },
  cancelWhy:  { ar: "سبب الإلغاء (اختياري)", en: "Reason (optional)", fr: "Motif (facultatif)", zh: "原因（可选）" },
  cancelEarly:{ ar: "الطلب لم يصل مرحلةً يترتّب عليها التزام — الإلغاء يتم فوراً.",
                en: "Nothing is committed yet — cancelling takes effect immediately.",
                fr: "Rien n'est encore engage — l'annulation prend effet immediatement.",
                zh: "尚无任何约束 — 取消将立即生效。" },
  cancelLate: { ar: "الطلب وصل مرحلةً يترتّب عليها التزامات (عقد أو دفعة أو تنفيذ). نستلم طلب الإلغاء ويراجعه الفريق ويعود لك.",
                en: "This request has reached a stage with commitments (contract, payment or execution). We take your request and the team reviews it and gets back to you.",
                fr: "Cette demande comporte des engagements (contrat, paiement ou execution). Nous enregistrons votre demande et l'equipe revient vers vous.",
                zh: "此请求已进入有约束的阶段（合同、付款或执行）。我们会受理并由团队审核后回复您。" },
  cancelSent: { ar: "استلمنا طلب الإلغاء ويراجعه الفريق.", en: "Cancellation request received and under review.",
                fr: "Demande d'annulation recue et en cours d'examen.", zh: "已收到取消申请，正在审核。" },
  cancelDone: { ar: "أُلغي الطلب", en: "Request cancelled", fr: "Demande annulee", zh: "请求已取消" },
  // Cancellation, in the order the customer meets it: the sheet he confirms in,
  // the state the request then shows, and what an error says. The sheet is
  // ours, not window.confirm — an embedded browser or a blocked dialog answers
  // «no» without asking, and the button then looks dead.
  cxNowTitle: { ar: "إلغاء هذا الطلب؟", en: "Cancel this request?", fr: "Annuler cette demande ?", zh: "取消此请求？" },
  cxAskTitle: { ar: "طلب إلغاء هذا الطلب", en: "Request cancellation", fr: "Demander l'annulation", zh: "申请取消此请求" },
  cxNowGo:    { ar: "نعم، ألغِ الطلب", en: "Yes, cancel the request", fr: "Oui, annuler la demande", zh: "是，取消请求" },
  cxAskGo:    { ar: "أرسل طلب الإلغاء", en: "Send cancellation request", fr: "Envoyer la demande d'annulation", zh: "提交取消申请" },
  cxKeep:     { ar: "تراجع، أبقِ الطلب", en: "No, keep it", fr: "Non, la garder", zh: "不，保留" },
  cxSigned:   { ar: "العقد موقَّع من جهتك، فلا يُلغى بضغطة: نسجّل طلب الإلغاء ويراجعه الفريق ويعود لك. يبقى الطلب كما هو إلى ذلك الحين.",
                en: "The contract is signed, so it cannot be cancelled with one click: we record your request, the team reviews it and gets back to you. The request stays as it is until then.",
                fr: "Le contrat est signé : l'annulation n'est pas immédiate. Nous enregistrons votre demande, l'équipe l'examine et revient vers vous. La demande reste en l'état d'ici là.",
                zh: "合同已签署，无法一键取消：我们会记录您的申请，由团队审核后回复您。在此期间请求保持不变。" },
  cxPaid:     { ar: "تم الدفع، فلا يُلغى بضغطة: نسجّل طلب الإلغاء ويراجعه الفريق، وأي استرداد يقرّره بعد المراجعة. يبقى الطلب كما هو إلى ذلك الحين.",
                en: "Payment has been made, so it cannot be cancelled with one click: we record your request and the team reviews it, including any refund. The request stays as it is until then.",
                fr: "Le paiement a été effectué : l'annulation n'est pas immédiate. Nous enregistrons votre demande et l'équipe l'examine, remboursement compris. La demande reste en l'état d'ici là.",
                zh: "款项已支付，无法一键取消：我们会记录您的申请，由团队审核（包括退款）。在此期间请求保持不变。" },
  evNotify:   { ar: "أُرسل إشعار", en: "Notification sent", fr: "Notification envoyée", zh: "已发送通知" },
  cxAppt:     { ar: "وسيُلغى معه موعد الاستشارة المحجوز.", en: "The booked consultation slot will be cancelled with it.", fr: "Le rendez-vous de consultation réservé sera annulé avec elle.", zh: "已预约的咨询时间也将一并取消。" },
  cxNowNote:  { ar: "الإلغاء يتم فوراً، ولم يُخصم منك شيء.", en: "Cancellation is immediate and nothing has been charged.", fr: "L'annulation est immédiate et rien n'a été débité.", zh: "立即取消，且未产生任何扣款。" },
  cxDoneNow:  { ar: "أُلغي الطلب", en: "Request cancelled", fr: "Demande annulée", zh: "请求已取消" },
  cxDoneNowT: { ar: "ألغينا طلبك كما طلبت، وسُحب من طلباتك النشطة. تقدر تبدأ طلباً جديداً في أي وقت.", en: "Your request is cancelled and removed from your active requests. You can start a new one any time.", fr: "Votre demande est annulée et retirée de vos demandes actives. Vous pouvez en créer une nouvelle à tout moment.", zh: "您的请求已取消，并已从进行中的申请中移除。您可以随时发起新申请。" },
  cxPendTitle:{ ar: "طلب الإلغاء قيد مراجعة الفريق", en: "Cancellation request under team review", fr: "Demande d'annulation en cours d'examen", zh: "取消申请正在由团队审核" },
  cxPendText: { ar: "نراجع ما ترتّب على الطلب من عقد أو دفعة أو تنفيذ ونعود لك. يبقى الطلب كما هو إلى ذلك الحين.", en: "We are reviewing what the request involves (contract, payment, execution) and will get back to you. The request stays as it is until then.", fr: "Nous examinons ce que la demande implique (contrat, paiement, exécution) et revenons vers vous. La demande reste en l'état d'ici là.", zh: "我们正在审核该请求涉及的合同、付款或执行情况并会回复您。在此期间请求保持不变。" },
  cxSentAt:   { ar: "أُرسل في", en: "Sent on", fr: "Envoyée le", zh: "提交于" },
  cxPill:     { ar: "إلغاء قيد المراجعة", en: "Cancellation under review", fr: "Annulation en examen", zh: "取消审核中" },
  cxNewReq:   { ar: "ابدأ طلباً جديداً", en: "Start a new request", fr: "Nouvelle demande", zh: "发起新申请" },
  cxAlready:  { ar: "طلب الإلغاء مسجَّل مسبقاً ويراجعه الفريق.", en: "A cancellation request is already on file and under review.", fr: "Une demande d'annulation est déjà enregistrée et en cours d'examen.", zh: "取消申请已登记，正在审核。" },
  cxErrClosed:{ ar: "هذا الطلب مُغلق أصلاً (ملغى أو مكتمل).", en: "This request is already closed (cancelled or completed).", fr: "Cette demande est déjà close (annulée ou terminée).", zh: "此请求已关闭（已取消或已完成）。" },
  cxErrSess:  { ar: "انتهت جلستك. سجّل دخولك من جديد ثم أعد المحاولة.", en: "Your session has expired. Sign in again, then retry.", fr: "Votre session a expiré. Reconnectez-vous puis réessayez.", zh: "登录已过期，请重新登录后再试。" },
  cxErrNet:   { ar: "تعذّر الاتصال بالخادم. تأكد من الإنترنت وأعد المحاولة.", en: "Could not reach the server. Check your connection and try again.", fr: "Serveur injoignable. Vérifiez votre connexion et réessayez.", zh: "无法连接服务器。请检查网络后重试。" },
  cxErrNF:    { ar: "لم نجد هذا الطلب في حسابك.", en: "We could not find this request in your account.", fr: "Cette demande est introuvable dans votre compte.", zh: "在您的账户中找不到此请求。" },
  cxErrGen:   { ar: "تعذّر تنفيذ الإلغاء الآن. أعد المحاولة بعد قليل أو راسل الفريق من المحادثة.", en: "We could not cancel right now. Try again shortly or message the team from the conversation.", fr: "Annulation impossible pour le moment. Réessayez ou écrivez à l'équipe depuis la conversation.", zh: "暂时无法取消。请稍后重试，或在对话中联系团队。" },
  resign: { ar: "صدرت نسخة مصحَّحة من هذا العقد بعد توقيعك — سنرسلها لك للتوقيع من جديد.",
            en: "A corrected version of this contract was issued after your signature — we will send it to you to sign again.",
            fr: "Une version corrigee de ce contrat a ete emise apres votre signature — nous vous l'enverrons a signer de nouveau.",
            zh: "本合同在您签署后已出具更正版本 — 我们会再次发送给您签署。" },
  openFull: { ar: "افتح بالحجم الكامل", en: "Open full size", fr: "Ouvrir en grand", zh: "全屏打开" },
  docPrint: { ar: "طباعة / حفظ PDF", en: "Print / Save PDF", fr: "Imprimer / PDF", zh: "打印 / 保存 PDF" },
  docClose: { ar: "إغلاق", en: "Close", fr: "Fermer", zh: "关闭" },
  docWait:  { ar: "نجهّز المستند…", en: "Preparing the document…", fr: "Préparation du document…", zh: "正在准备文件…" },
  attachments: { ar: "المرفقات", en: "Attachments", fr: "Pièces jointes", zh: "附件" },
  quote: { ar: "عرض السعر", en: "Quotation", fr: "Devis", zh: "报价" },
  contract: { ar: "العقد", en: "Contract", fr: "Contrat", zh: "合同" },
  payment: { ar: "الدفع", en: "Payment", fr: "Paiement", zh: "付款" },
  invoice: { ar: "الفاتورة", en: "Invoice", fr: "Facture", zh: "发票" },
  timeline: { ar: "الخط الزمني", en: "Timeline", fr: "Chronologie", zh: "时间线" },
  writeMsg: { ar: "اكتب رسالة للفريق…", en: "Write a message to the team…", fr: "Écrire un message à l'équipe…", zh: "给团队留言…" },
  send: { ar: "إرسال", en: "Send", fr: "Envoyer", zh: "发送" },
  saveScope: { ar: "حفظ التعديلات", en: "Save changes", fr: "Enregistrer", zh: "保存修改" },
  // A line the catalogue cannot price is never given an invented price: it waits
  // for the team, and the customer is told which line and why (api/_simple.js
  // writes the reason beside the line: scope[i].hold).
  quoteIssuedFlash: { ar: "تم اعتماد النطاق ✓ — صدر عرض السعر وتجده في هذه الصفحة.", en: "Scope confirmed ✓ — your quotation has been issued and is on this page.", fr: "Périmètre confirmé ✓ — votre devis a été émis, il est sur cette page.", zh: "范围已确认 ✓ — 报价已出具，就在本页面。" },
  holdFlash: { ar: "تم اعتماد النطاق ✓ — بعض البنود يسعّرها الفريق، وسبب ذلك بجانب كل بند.", en: "Scope confirmed ✓ — our team prices some lines; the reason is beside each one.", fr: "Périmètre confirmé ✓ — l'équipe chiffre certaines lignes ; le motif figure à côté de chacune.", zh: "范围已确认 ✓ — 部分项目由团队定价，原因见各项目旁。" },
  signNameErr: { ar: "اكتب اسمك الكامل (٣ أحرف على الأقل) في خانة الاسم.", en: "Type your full name (at least 3 letters) in the name box.", fr: "Saisissez votre nom complet (3 lettres au moins).", zh: "请在姓名栏填写全名（至少3个字符）。" },
  signDrawErr: { ar: "ارسم توقيعك في المربع قبل التوقيع.", en: "Draw your signature in the box before signing.", fr: "Dessinez votre signature dans le cadre avant de signer.", zh: "签署前请在框内手写签名。" },
  expiredNote: { ar: "انتهت صلاحية هذا العرض، فلا يمكن اعتماده. اطلب تجديده ليصلك بسعر اليوم.", en: "This quotation has expired and can no longer be approved. Ask for a renewal at today's price.", fr: "Ce devis a expiré et ne peut plus être approuvé. Demandez un renouvellement au prix du jour.", zh: "此报价已过期，无法确认。请申请按今日价格续期。" },
  renewAsk: { ar: "انتهت الصلاحية — اطلب تجديداً", en: "Expired — request a renewal", fr: "Expiré — demander un renouvellement", zh: "已过期 — 申请续期" },
  renewMsg: { ar: "أرجو تجديد عرض السعر", en: "Please renew quotation", fr: "Merci de renouveler le devis", zh: "请续期报价" },
  renewSent: { ar: "وصل طلب التجديد إلى الفريق، وسيصلك عرض محدَّث.", en: "Your renewal request reached the team; an updated quotation will follow.", fr: "Votre demande a été transmise ; un devis mis à jour suivra.", zh: "续期申请已送达团队，更新后的报价随后发送。" },
  pendTitle: { ar: "بنود بانتظار التسعير (يصلك لها عرض ملحق)", en: "Lines awaiting a price (an addendum quotation will follow)", fr: "Lignes en attente de prix (un devis complémentaire suivra)", zh: "待定价项目（将另发补充报价）" },
  pendLead: { ar: "هذه البنود ليست في المجموع ولا في العقد. يسعّرها الفريق ثم يصلك ملحق عرض مستقل، وعرضك هذا لا يتغيّر.", en: "These lines are not in the total or the contract. The team prices them and you receive a separate addendum; this quotation does not change.", fr: "Ces lignes ne figurent ni dans le total ni dans le contrat. L'équipe les chiffre et vous recevez un avenant ; ce devis ne change pas.", zh: "这些项目不计入总额和合同。团队定价后您将收到独立的补充报价，本报价不变。" },
  adTitle: { ar: "ملحق عرض السعر", en: "Quotation addendum", fr: "Avenant au devis", zh: "补充报价" },
  adApprove: { ar: "اعتماد الملحق", en: "Approve addendum", fr: "Approuver l'avenant", zh: "确认补充报价" },
  adReject: { ar: "لا أوافق", en: "Decline", fr: "Refuser", zh: "不同意" },
  adNote: { ar: "سبب عدم الموافقة", en: "Reason", fr: "Motif", zh: "原因" },
  adDone: { ar: "اعتُمد الملحق، ويتابعه الفريق معك.", en: "Addendum approved; the team will follow up with you.", fr: "Avenant approuvé ; l'équipe vous recontacte.", zh: "补充报价已确认，团队将与您跟进。" },
  reqGone: { ar: "هذا الطلب لم يعد متاحاً: ألغيته أو أُزيل من حسابك. يمكنك البدء بطلب جديد.", en: "This request is no longer available: it was cancelled or removed from your account. You can start a new one.", fr: "Cette demande n'est plus disponible : annulée ou retirée de votre compte. Vous pouvez en commencer une autre.", zh: "此申请已不可用：已被取消或从您的账户移除。您可以重新开始。" },
  nda: { ar: "اتفاقية عدم الإفصاح", en: "Non-disclosure agreement", fr: "Accord de confidentialité", zh: "保密协议" },
  ndaLead: { ar: "اتفاقية متبادلة بينك وبين Business Partner. توقيعها لا يوقف طلبك، وتُحفظ معه.", en: "A mutual agreement between you and Business Partner. Signing it does not hold up your request, and it is kept with it.", fr: "Accord réciproque entre vous et Business Partner. Le signer ne retarde pas votre demande ; il est conservé avec elle.", zh: "您与 Business Partner 之间的双向协议。签署不会影响您的申请，并随申请一并保存。" },
  ndaSignBtn: { ar: "توقيع الاتفاقية", en: "Sign the agreement", fr: "Signer l'accord", zh: "签署协议" },
  ndaSigned: { ar: "تم توقيع الاتفاقية", en: "Agreement signed", fr: "Accord signé", zh: "协议已签署" },
  ndaDone: { ar: "اتفاقية موقّعة", en: "NDA signed", fr: "NDA signé", zh: "保密协议已签" },
  ndaWait: { ar: "اتفاقية بانتظار التوقيع", en: "NDA awaiting signature", fr: "NDA à signer", zh: "保密协议待签" },
  clientNotes: { ar: "ملاحظاتك (للعلم، وليست بنداً تعاقدياً)", en: "Your notes (for information, not a contractual line)", fr: "Vos remarques (à titre informatif, hors contrat)", zh: "您的备注（仅供参考，不属于合同条款）" },
  holdTitle: { ar: "عرض السعر بانتظار تسعير بشري", en: "Quotation waiting for a person to price it", fr: "Devis en attente d'un chiffrage humain", zh: "报价等待人工定价" },
  holdLead:  { ar: "اعتمدنا نطاقك. لا نضع سعراً غير معتمد في الكتالوج، لذلك يسعّر الفريق البنود التالية ثم يصلك العرض هنا وعلى بريدك — لا يلزمك فعل شيء.",
               en: "We confirmed your scope. We never put a price the catalogue does not hold, so our team prices the lines below and your quotation then arrives here and by e-mail — nothing is needed from you.",
               fr: "Nous avons confirmé votre périmètre. Nous ne mettons jamais un prix absent du catalogue : l'équipe chiffre les lignes ci-dessous puis le devis arrive ici et par e-mail — rien à faire de votre côté.",
               zh: "我们已确认您的服务范围。目录中没有的价格我们不会臆造，因此由团队为以下项目定价，随后报价将发送到此处和您的邮箱——您无需任何操作。" },
  hold_custom:       { ar: "بند كتبتَه بنفسك ولا سعر له في الكتالوج", en: "A line you wrote yourself, with no catalogue price", fr: "Une ligne que vous avez saisie, sans prix au catalogue", zh: "您自行填写的项目，目录中没有价格" },
  hold_unknown_code: { ar: "رمز الخدمة غير موجود في الكتالوج", en: "Service code not found in the catalogue", fr: "Code de service absent du catalogue", zh: "目录中找不到该服务代码" },
  hold_proposal:     { ar: "سعرها حسب دراسة حالتك وليس رقماً ثابتاً", en: "Priced after studying your case, not a fixed figure", fr: "Chiffrée après étude de votre cas, pas un prix fixe", zh: "需根据您的情况评估后定价，并非固定价格" },
  hold_from:         { ar: "الكتالوج يذكر لها سعراً «يبدأ من» وليس سعراً نهائياً", en: "The catalogue lists a «starting from» price, not a final one", fr: "Le catalogue indique un prix « à partir de », pas un prix final", zh: "目录仅列出“起价”，并非最终价格" },
  hold_recurring:    { ar: "اشتراك دوري وليس دفعة واحدة", en: "A recurring subscription, not a single payment", fr: "Un abonnement récurrent, pas un paiement unique", zh: "为周期性订阅，并非一次性付款" },
  hold_percent:      { ar: "تُحتسب بنسبة وليس بمبلغ ثابت", en: "Calculated as a percentage, not a fixed amount", fr: "Calculée en pourcentage, pas un montant fixe", zh: "按比例计算，并非固定金额" },
  hold_no_price:     { ar: "لا سعر لها في الكتالوج", en: "No catalogue price", fr: "Pas de prix au catalogue", zh: "目录中没有价格" },
  cxGone:     { ar: "أُلغي الطلب وأُزيل من قائمتك.", en: "The request was cancelled and removed from your list.", fr: "La demande a été annulée et retirée de votre liste.", zh: "请求已取消，并已从您的列表中移除。" },
  confirmScope: { ar: "اعتمد النطاق وتابع", en: "Confirm scope & continue", fr: "Confirmer et continuer", zh: "确认范围并继续" },
  scopePricing: { ar: "تم اعتماد النطاق ✓ — الفريق يجهّز عرض السعر ويصلك هنا وعلى بريدك.", en: "Scope confirmed ✓ — our team is preparing your quotation; it will appear here and in your inbox.", fr: "Périmètre confirmé ✓ — l'équipe prépare votre devis.", zh: "范围已确认 ✓ — 团队正在准备报价。" },
  docs: { ar: "المستندات المطلوبة", en: "Documents required", fr: "Documents requis", zh: "所需文件" },
  docsNote: { ar: "نطلب هذه المستندات لإتمام طلبك — ارفع كل مستند من زره هنا، ويصل الفريق مباشرة.", en: "We need these documents to complete your request — upload each one with its button and our team receives it right away.", fr: "Ces documents sont nécessaires pour traiter votre demande — téléversez chacun avec son bouton, l'équipe le reçoit aussitôt.", zh: "我们需要这些文件来完成您的申请 — 用对应按钮上传，团队会立即收到。" },
  docsNone: { ar: "لا مستندات مطلوبة حتى الآن. تقدر مع ذلك ترفع أي مستند يخص الطلب.", en: "No documents requested yet. You can still upload any document that belongs to this request.", fr: "Aucun document demandé pour l'instant. Vous pouvez tout de même téléverser un document lié à cette demande.", zh: "暂无所需文件。您仍可上传与此申请相关的任何文件。" },
  docUp: { ar: "ارفع", en: "Upload", fr: "Téléverser", zh: "上传" },
  docUpMore: { ar: "ارفع ملفاً آخر", en: "Upload another", fr: "Téléverser un autre", zh: "再上传一个" },
  docUpAny: { ar: "ارفع مستنداً آخر", en: "Upload another document", fr: "Téléverser un autre document", zh: "上传其他文件" },
  docRecv: { ar: "استُلم ✓", en: "Received ✓", fr: "Reçu ✓", zh: "已收到 ✓" },
  docWaived: { ar: "معفى", en: "Not needed", fr: "Non requis", zh: "无需提供" },
  docAsked: { ar: "مطلوب", en: "Requested", fr: "Demandé", zh: "待提供" },
  docSent: { ar: "وصل مستندك للفريق ✓", en: "Your document reached the team ✓", fr: "Votre document est arrivé à l'équipe ✓", zh: "您的文件已送达团队 ✓" },
  fOpen: { ar: "فتح", en: "Open", fr: "Ouvrir", zh: "打开" },
  eMany: { ar: "وصلت إلى الحدّ الأقصى لعدد الملفات في هذا الطلب.", en: "You reached the maximum number of files for this request.", fr: "Nombre maximal de fichiers atteint pour cette demande.", zh: "此申请的文件数量已达上限。" },
  eClosed: { ar: "الطلب مغلق ولا يقبل مستندات.", en: "This request is closed and takes no more documents.", fr: "Cette demande est close.", zh: "此申请已关闭，无法再上传文件。" },
  delivTitle: { ar: "مخرجات الطلب", en: "Deliverables", fr: "Livrables", zh: "交付成果" },
  // مراحل الطلب وتحديثات الفريق — تظهر فقط لطلب له مراحل أو تحديث منشور.
  progTitle: { ar: "مراحل عملك", en: "Your progress", fr: "Votre avancement", zh: "办理进度" },
  stDone: { ar: "تمّت", en: "Done", fr: "Terminée", zh: "已完成" },
  stActive: { ar: "جارية الآن", en: "In progress", fr: "En cours", zh: "进行中" },
  stPending: { ar: "قادمة", en: "Upcoming", fr: "À venir", zh: "待办" },
  updTitle: { ar: "آخر التحديثات", en: "Latest updates", fr: "Dernières mises à jour", zh: "最新动态" },
  updMore: { ar: "عرض كل التحديثات", en: "Show all updates", fr: "Voir toutes les mises à jour", zh: "显示全部动态" },
  updLess: { ar: "عرض الأحدث فقط", en: "Show latest only", fr: "Afficher les plus récentes", zh: "仅显示最新" },
  delivNone: { ar: "ستظهر هنا الملفات التي نسلّمها لك، وننبّهك بالبريد فور تسليمها.", en: "The files we hand over will appear here, and we e-mail you as soon as they are delivered.", fr: "Les fichiers que nous vous remettons apparaîtront ici ; nous vous prévenons par e-mail dès la livraison.", zh: "我们交付的文件会显示在这里，交付后会立即发邮件通知您。" },
  delivNoneDone: { ar: "اكتمل الطلب ولا توجد ملفات مسلَّمة داخله.", en: "The request is complete and has no delivered files.", fr: "La demande est terminée et ne comporte aucun fichier livré.", zh: "申请已完成，没有交付文件。" },
  delivDl: { ar: "تنزيل", en: "Download", fr: "Télécharger", zh: "下载" },
  delivErr: { ar: "تعذّر فتح الملف — حاول مرة أخرى.", en: "The file could not be opened — try again.", fr: "Impossible d'ouvrir le fichier — réessayez.", zh: "无法打开文件 — 请重试。" },
  invSeller: { ar: "البائع", en: "Seller", fr: "Vendeur", zh: "卖方" },
  invVat: { ar: "الرقم الضريبي للبائع", en: "Seller VAT number", fr: "N° de TVA du vendeur", zh: "卖方税号" },
  invBuyer: { ar: "العميل", en: "Bill to", fr: "Client", zh: "买方" },
  invOfficial: { ar: "الفاتورة الرسمية (PDF)", en: "Official invoice (PDF)", fr: "Facture officielle (PDF)", zh: "正式发票 (PDF)" },
  addItem: { ar: "إضافة بند", en: "Add item", fr: "Ajouter", zh: "添加条目" },
  remove: { ar: "حذف", en: "Remove", fr: "Supprimer", zh: "删除" },
  scopeLocked: { ar: "النطاق مقفل بعد إصدار عرض السعر.", en: "Scope is locked once a quotation is issued.", fr: "Le périmètre est verrouillé après l'émission du devis.", zh: "报价发出后范围已锁定。" },
  qty: { ar: "الكمية", en: "Qty", fr: "Qté", zh: "数量" },
  price: { ar: "السعر", en: "Price", fr: "Prix", zh: "价格" },
  net: { ar: "الإجمالي قبل الضريبة", en: "Subtotal", fr: "Sous-total", zh: "小计" },
  vat: { ar: "ضريبة القيمة المضافة 15%", en: "VAT 15%", fr: "TVA 15 %", zh: "增值税 15%" },
  total: { ar: "الإجمالي", en: "Total", fr: "Total", zh: "总计" },
  validUntil: { ar: "صالح حتى", en: "Valid until", fr: "Valable jusqu'au", zh: "有效期至" },
  terms: { ar: "شروط الدفع", en: "Payment terms", fr: "Conditions de paiement", zh: "付款条款" },
  approve: { ar: "اعتماد العرض", en: "Approve quote", fr: "Approuver le devis", zh: "确认报价" },
  reject: { ar: "طلب تعديل", en: "Request changes", fr: "Demander des modifications", zh: "要求修改" },
  rejectNote: { ar: "ما الذي تريد تعديله؟", en: "What would you like changed?", fr: "Que souhaitez-vous modifier ?", zh: "您希望修改什么？" },
  quoteApproved: { ar: "تم اعتماد العرض، والعقد جاهز للتوقيع الآن.", en: "Quote approved — your contract is ready to sign now.", fr: "Devis approuvé — votre contrat est prêt à signer.", zh: "报价已确认，合同现已可供签署。" },
  quoteApprovedDone: { ar: "تم اعتماد العرض ✓", en: "Quote approved ✓", fr: "Devis approuvé ✓", zh: "报价已确认 ✓" },
  quoteExpired: { ar: "انتهت صلاحية عرض السعر هذا. اكتب لنا من داخل الطلب ليُجدَّد لك بسعر اليوم.", en: "This quotation has expired. Message us in the request and we will renew it at today's price.", fr: "Ce devis a expiré. Écrivez-nous depuis la demande et nous le renouvelons au prix du jour.", zh: "此报价已过期。请在申请中留言，我们将按当日价格为您更新。" },
  viewContract: { ar: "عرض العقد", en: "View contract", fr: "Voir le contrat", zh: "查看合同" },
  signTitle: { ar: "التوقيع الإلكتروني", en: "Electronic signature", fr: "Signature électronique", zh: "电子签名" },
  signName: { ar: "الاسم الكامل للموقّع", en: "Signer's full name", fr: "Nom complet du signataire", zh: "签署人全名" },
  signDraw: { ar: "ارسم توقيعك", en: "Draw your signature", fr: "Dessinez votre signature", zh: "请手写签名" },
  signClear: { ar: "مسح", en: "Clear", fr: "Effacer", zh: "清除" },
  signConsent: { ar: "أوافق على أن توقيعي الإلكتروني ملزم وفق نظام التعاملات الإلكترونية.", en: "I agree that my electronic signature is binding under the Electronic Transactions Law.", fr: "J'accepte que ma signature électronique soit contraignante selon la loi sur les transactions électroniques.", zh: "我同意我的电子签名根据《电子交易法》具有约束力。" },
  signBtn: { ar: "توقيع العقد", en: "Sign contract", fr: "Signer le contrat", zh: "签署合同" },
  signed: { ar: "تم توقيع العقد", en: "Contract signed", fr: "Contrat signé", zh: "合同已签署" },
  payNow: { ar: "ادفع الآن", en: "Pay now", fr: "Payer maintenant", zh: "立即付款" },
  payCardNow: { ar: "ادفع بالبطاقة", en: "Pay by card", fr: "Payer par carte", zh: "银行卡付款" },
  payBankNow: { ar: "ادفع بحوالة بنكية", en: "Pay by bank transfer", fr: "Payer par virement bancaire", zh: "银行转账付款" },
  bkTitle: { ar: "الدفع بحوالة بنكية", en: "Pay by bank transfer", fr: "Paiement par virement bancaire", zh: "银行转账付款" },
  bkHow: { ar: "حوّل المبلغ بالضبط إلى حساب الشركة أدناه واكتب مرجع الطلب في ملاحظات الحوالة، ثم ارفع صورة الإيصال أو ملف PDF. يتحقق المستشار الذكي من المبلغ والمستفيد والآيبان؛ فإن تطابقت اعتُمد الدفع وصدرت فاتورتك، وإلا يراجعه فريقنا ونبلغك بالسبب.", en: "Transfer the exact amount to the company account below, put the request reference in the transfer notes, then upload the receipt image or PDF. The smart advisor checks the amount, the beneficiary and the IBAN: if they match the payment is approved and your invoice is issued, otherwise our team reviews it and tells you why.", fr: "Virez le montant exact sur le compte de l'entreprise ci-dessous, indiquez la référence de la demande dans les notes du virement, puis téléversez l'image ou le PDF du reçu. Le conseiller intelligent vérifie le montant, le bénéficiaire et l'IBAN : s'ils correspondent, le paiement est approuvé et votre facture émise, sinon notre équipe l'examine et vous en indique le motif.", zh: "请将准确金额转入下方公司账户，并在转账备注中填写申请编号，然后上传回单图片或 PDF。智能顾问会核对金额、收款人和 IBAN：一致则确认付款并开具发票，否则由团队复核并告知原因。" },
  bkBene: { ar: "اسم المستفيد", en: "Beneficiary", fr: "Bénéficiaire", zh: "收款人" },
  bkBank: { ar: "البنك", en: "Bank", fr: "Banque", zh: "银行" },
  bkIban: { ar: "الآيبان", en: "IBAN", fr: "IBAN", zh: "IBAN" },
  bkAmt: { ar: "المبلغ المطلوب (شامل الضريبة)", en: "Amount to transfer (incl. VAT)", fr: "Montant à virer (TTC)", zh: "应转金额（含税）" },
  bkRef: { ar: "مرجع الطلب — اكتبه في الملاحظات", en: "Request reference — put it in the notes", fr: "Référence — à indiquer dans les notes", zh: "申请编号——请填写在备注中" },
  bkFile: { ar: "إيصال الحوالة (صورة أو PDF)", en: "Transfer receipt (image or PDF)", fr: "Reçu du virement (image ou PDF)", zh: "转账回单（图片或 PDF）" },
  bkGo: { ar: "رفع الإيصال", en: "Upload the receipt", fr: "Téléverser le reçu", zh: "上传回单" },
  copy: { ar: "نسخ", en: "Copy", fr: "Copier", zh: "复制" },
  copied: { ar: "تم النسخ", en: "Copied", fr: "Copié", zh: "已复制" },
  bkSending: { ar: "نرفع الإيصال ونتحقق منه…", en: "Uploading and checking the receipt…", fr: "Téléversement et vérification du reçu…", zh: "正在上传并核对回单…" },
  bkNeedFile: { ar: "اختر صورة الإيصال أو ملف PDF أولاً.", en: "Choose the receipt image or PDF first.", fr: "Choisissez d'abord l'image ou le PDF du reçu.", zh: "请先选择回单图片或 PDF。" },
  bkBadType: { ar: "الملف يجب أن يكون صورة (JPG أو PNG أو WebP) أو PDF.", en: "The file must be an image (JPG, PNG or WebP) or a PDF.", fr: "Le fichier doit être une image (JPG, PNG ou WebP) ou un PDF.", zh: "文件必须是图片（JPG、PNG 或 WebP）或 PDF。" },
  bkTooBig: { ar: "حجم الملف كبير. استخدم ملفاً أصغر من ٣ ميغابايت.", en: "The file is too large. Use one under 3 MB.", fr: "Fichier trop volumineux (max 3 Mo).", zh: "文件过大，请使用小于 3 MB 的文件。" },
  bkFail: { ar: "تعذّر رفع الإيصال الآن ولم يُسجَّل شيء. أعد المحاولة بعد قليل، أو ادفع بالبطاقة.", en: "The receipt could not be uploaded and nothing was recorded. Try again shortly, or pay by card.", fr: "Le reçu n'a pas pu être téléversé et rien n'a été enregistré. Réessayez bientôt, ou payez par carte.", zh: "回单上传失败，未记录任何内容。请稍后重试，或使用银行卡付款。" },
  bkLogin: { ar: "انتهت جلستك. سجّل دخولك من جديد ثم ارفع الإيصال.", en: "Your session ended. Sign in again, then upload the receipt.", fr: "Votre session a expiré. Reconnectez-vous puis téléversez le reçu.", zh: "登录已过期，请重新登录后上传回单。" },
  bkSlow: { ar: "محاولات كثيرة — انتظر قليلاً ثم أعد المحاولة.", en: "Too many attempts — wait a moment and retry.", fr: "Trop de tentatives — patientez puis réessayez.", zh: "尝试次数过多，请稍候再试。" },
  bkClosed: { ar: "هذا الطلب لم يعد يقبل إيصالات. إن كنت حوّلت المبلغ فعلاً فراسلنا من المحادثة أدناه.", en: "This request no longer accepts receipts. If you already transferred the money, message us in the conversation below.", fr: "Cette demande n'accepte plus de reçus. Si vous avez déjà viré le montant, écrivez-nous dans la conversation ci-dessous.", zh: "该申请不再接受回单。如已转账，请在下方对话中联系我们。" },
  bkPaid: { ar: "هذا الطلب مدفوع بالفعل.", en: "This request is already paid.", fr: "Cette demande est déjà payée.", zh: "该申请已付款。" },
  bkOff: { ar: "الحوالة البنكية غير متاحة في الوقت الحالي. ادفع بالبطاقة أو تمارا.", en: "Bank transfer is not available right now. Pay by card or Tamara.", fr: "Le virement n'est pas disponible pour le moment. Payez par carte ou Tamara.", zh: "银行转账暂不可用，请使用银行卡或 Tamara 付款。" },
  bkApproved: { ar: "تحقق المستشار الذكي من إيصالك: المبلغ والمستفيد والآيبان مطابقة، فاعتُمد دفعك وصدرت فاتورتك.", en: "The smart advisor checked your receipt: the amount, the beneficiary and the IBAN match, so your payment is approved and your invoice issued.", fr: "Le conseiller intelligent a vérifié votre reçu : le montant, le bénéficiaire et l'IBAN correspondent, votre paiement est approuvé et votre facture émise.", zh: "智能顾问已核对您的回单：金额、收款人和 IBAN 一致，付款已确认并开具发票。" },
  bkInv: { ar: "رقم الفاتورة", en: "Invoice no.", fr: "N° de facture", zh: "发票号" },
  bkReview: { ar: "استلمنا إيصالك وهو قيد المراجعة. لا تحوّل المبلغ مرة أخرى؛ نبلغك فور الاعتماد.", en: "We received your receipt and it is under review. Do not transfer the amount again; we will tell you as soon as it is approved.", fr: "Nous avons reçu votre reçu, il est en cours d'examen. Ne virez pas le montant une seconde fois ; nous vous informerons dès l'approbation.", zh: "已收到您的回单，正在复核。请勿重复转账，确认后我们会通知您。" },
  bkWhy: { ar: "سبب المراجعة البشرية: ", en: "Reason for human review: ", fr: "Motif de la vérification humaine : ", zh: "转人工复核原因：" },
  reviewTitle: { ar: "إيصالك قيد المراجعة", en: "Your receipt is under review", fr: "Votre reçu est en cours d'examen", zh: "您的回单正在复核" },
  reviewText: { ar: "استلمنا إيصال حوالتك ويراجعه فريقنا. لا تحوّل المبلغ مرة أخرى ولا حاجة لأي دفع جديد؛ نبلغك فور الاعتماد. إن كان الإيصال غير واضح فراسلنا من المحادثة أدناه.", en: "We received your transfer receipt and our team is reviewing it. Do not transfer again and no new payment is needed; we will tell you as soon as it is approved. If the receipt was unclear, message us in the conversation below.", fr: "Nous avons reçu votre reçu de virement et notre équipe l'examine. Ne virez pas à nouveau, aucun nouveau paiement n'est nécessaire ; nous vous informerons dès l'approbation. Si le reçu n'était pas clair, écrivez-nous dans la conversation ci-dessous.", zh: "已收到您的转账回单，团队正在复核。请勿重复转账，也无需再次付款，确认后我们会通知您。如回单不清晰，请在下方对话中联系我们。" },
  reviewList: { ar: "إيصالات قيد المراجعة", en: "Receipts under review", fr: "Reçus en cours d'examen", zh: "复核中的回单" },
  payTamaraNow: { ar: "قسّطها مع تمارا", en: "Pay in instalments with Tamara", fr: "Payer en plusieurs fois avec Tamara", zh: "使用 Tamara 分期" },
  payReturning: { ar: "نؤكّد دفعتك…", en: "Confirming your payment…", fr: "Confirmation du paiement…", zh: "正在确认您的付款…" },
  payVia: { ar: "الدفع عبر صفحة الدفع الآمنة (مدى، فيزا، ماستركارد، Apple Pay، تمارا عند توفرها)", en: "Pay on the secure checkout page (mada, Visa, Mastercard, Apple Pay, Tamara when available)", fr: "Payer sur la page de paiement sécurisée (mada, Visa, Mastercard, Apple Pay, Tamara si disponible)", zh: "通过安全支付页面付款（mada、Visa、Mastercard、Apple Pay，Tamara 可用时）" },
  testPay: { ar: "محاكاة الدفع (وضع الاختبار)", en: "Simulate payment (test mode)", fr: "Simuler le paiement (mode test)", zh: "模拟付款（测试模式）" },
  paySuccess: { ar: "نجاح — بطاقة", en: "Success — card", fr: "Succès — carte", zh: "成功 — 银行卡" },
  payTamara: { ar: "نجاح — تمارا", en: "Success — Tamara", fr: "Succès — Tamara", zh: "成功 — Tamara" },
  payFailed: { ar: "فشل", en: "Failed", fr: "Échec", zh: "失败" },
  payCancelled: { ar: "إلغاء", en: "Cancelled", fr: "Annulé", zh: "取消" },
  payPending: { ar: "معلّق", en: "Pending", fr: "En attente", zh: "待处理" },
  paid: { ar: "مدفوع", en: "Paid", fr: "Payé", zh: "已付款" },
  download: { ar: "عرض الفاتورة", en: "View invoice", fr: "Voir la facture", zh: "查看发票" },
  book: { ar: "احجز موعداً", en: "Book an appointment", fr: "Prendre rendez-vous", zh: "预约" },
  reschedule: { ar: "إعادة جدولة", en: "Reschedule", fr: "Reprogrammer", zh: "改期" },
  cancelAppt: { ar: "إلغاء الموعد", en: "Cancel appointment", fr: "Annuler le rendez-vous", zh: "取消预约" },
  date: { ar: "التاريخ", en: "Date", fr: "Date", zh: "日期" },
  time: { ar: "الوقت", en: "Time", fr: "Heure", zh: "时间" },
  topic: { ar: "الموضوع", en: "Topic", fr: "Sujet", zh: "主题" },
  confirm: { ar: "تأكيد", en: "Confirm", fr: "Confirmer", zh: "确认" },
  apptNote: { ar: "جلسة بالفيديو عبر Google Meet، مجانية، وكل الأوقات بتوقيت الرياض. نؤكد الموعد على بريدك ونرسل دعوة تقويم.", en: "A free video session on Google Meet; all times are Riyadh time. We confirm by e-mail and send a calendar invitation.", fr: "Séance vidéo gratuite sur Google Meet ; heures de Riyad. Confirmation par e-mail et invitation d'agenda.", zh: "通过 Google Meet 进行的免费视频会谈；均为利雅得时间。我们将通过邮件确认并发送日历邀请。" },
  apptHours: { ar: "الجلسات من {a} إلى {b} بتوقيت الرياض (GMT+3)، مدة الجلسة {n} دقيقة.", en: "Sessions run {a} – {b} Riyadh time (GMT+3), {n} minutes each.", fr: "Séances de {a} à {b}, heure de Riyad (GMT+3), {n} minutes chacune.", zh: "会谈时间 {a}–{b}（利雅得时间 GMT+3），每次 {n} 分钟。" },
  apptDays: { ar: "كل الأيام عدا {d}.", en: "Every day except {d}.", fr: "Tous les jours sauf {d}.", zh: "除{d}外每天。" },
  apptDaysAll: { ar: "كل أيام الأسبوع.", en: "Every day of the week.", fr: "Tous les jours de la semaine.", zh: "每周每天。" },
  apptLoading: { ar: "نقرأ المواعيد المتاحة…", en: "Loading available times…", fr: "Chargement des créneaux…", zh: "正在加载可预约时间…" },
  apptNone: { ar: "لا مواعيد متاحة الآن. راسلنا على واتساب ونرتّب لك موعداً.", en: "No times are available now. Message us on WhatsApp and we will arrange one.", fr: "Aucun créneau disponible. Écrivez-nous sur WhatsApp.", zh: "目前没有可用时间。请通过 WhatsApp 联系我们。" },
  apptOut: { ar: "هذا الوقت خارج ساعات الجلسات — اختر وقتاً من القائمة.", en: "That time is outside session hours — pick one from the list.", fr: "Cet horaire est hors des heures de séance — choisissez dans la liste.", zh: "该时间不在会谈时段内 — 请从列表中选择。" },
  apptSoon: { ar: "نحتاج ساعةً على الأقل قبل الجلسة — اختر وقتاً أبعد.", en: "We need at least one hour before a session — pick a later time.", fr: "Il faut au moins une heure avant la séance — choisissez plus tard.", zh: "预约需至少提前一小时 — 请选择更晚的时间。" },
  apptFar: { ar: "هذا التاريخ أبعد من المدى المفتوح للحجز.", en: "That date is beyond the booking window.", fr: "Cette date dépasse la période de réservation.", zh: "该日期超出可预约范围。" },
  apptTaken: { ar: "حُجزت هذه الفترة قبل قليل — اختر فترة أخرى.", en: "That slot was just taken — pick another.", fr: "Ce créneau vient d'être pris — choisissez-en un autre.", zh: "该时段刚被预订 — 请另选。" },
  apptMany: { ar: "لديك موعدان قادمان بالفعل — ألغِ أحدهما أو انتظر حتى يمضي.", en: "You already have two upcoming sessions — cancel one or wait for it to pass.", fr: "Vous avez déjà deux séances à venir — annulez-en une ou attendez.", zh: "您已有两个即将进行的预约 — 请取消其一或等待其结束。" },
  apptRate: { ar: "محاولات كثيرة — انتظر قليلاً ثم أعد المحاولة.", en: "Too many attempts — wait a little and try again.", fr: "Trop de tentatives — patientez un peu.", zh: "尝试次数过多 — 请稍后再试。" },
  nextAppt: { ar: "موعدك القادم", en: "Your next appointment", fr: "Votre prochain rendez-vous", zh: "您的下一次预约" },
  videoFree: { ar: "الاتصال المرئي — استشارة مجانية", en: "Video call — free consultation", fr: "Appel vidéo — consultation gratuite", zh: "视频通话 — 免费咨询" },
  joinNow: { ar: "انضم إلى الاجتماع", en: "Join the meeting", fr: "Rejoindre la réunion", zh: "加入会议" },
  joinSoon: { ar: "يُفتح الانضمام قبل الموعد بخمس دقائق.", en: "Joining opens five minutes before the start.", fr: "L'accès s'ouvre cinq minutes avant le début.", zh: "开始前五分钟开放加入。" },
  meetLink: { ar: "رابط الاجتماع", en: "Meeting link", fr: "Lien de la réunion", zh: "会议链接" },
  addCal: { ar: "أضِف إلى التقويم", en: "Add to calendar", fr: "Ajouter à l'agenda", zh: "添加到日历" },
  apptPending: { ar: "الموعد بانتظار تأكيد الفريق — يصلك رابط الاجتماع ودعوة التقويم على بريدك بعد التثبيت.", en: "The time is awaiting the team's confirmation — the meeting link and calendar invitation reach your e-mail once it is set.", fr: "Le créneau attend la confirmation de l'équipe — le lien et l'invitation arrivent par e-mail.", zh: "时间等待团队确认 — 确认后会议链接和日历邀请将发送到您的邮箱。" },
  apptOver: { ar: "انتهت هذه الجلسة.", en: "This session has ended.", fr: "Cette séance est terminée.", zh: "此会谈已结束。" },
  riyadh: { ar: "بتوقيت الرياض", en: "Riyadh time", fr: "heure de Riyad", zh: "利雅得时间" },
  cancelReq: { ar: "إلغاء الطلب", en: "Cancel request", fr: "Annuler la demande", zh: "取消申请" },
  company: { ar: "اسم الشركة", en: "Company name", fr: "Nom de l'entreprise", zh: "公司名称" },
  cr: { ar: "السجل التجاري", en: "CR number", fr: "Numéro RC", zh: "商业登记号" },
  nameEn: { ar: "الاسم بالإنجليزية", en: "Name in English", fr: "Nom en anglais", zh: "英文名称" },
  save: { ar: "حفظ", en: "Save", fr: "Enregistrer", zh: "保存" },
  saved: { ar: "تم الحفظ", en: "Saved", fr: "Enregistré", zh: "已保存" },
  // Messages for things that used to fail silently or show a raw server code
  // («friday», «bad_datetime», «card») to the customer.
  sessEnd: { ar: "انتهت جلستك — سجّل دخولك من جديد لتكمل.", en: "Your session has ended — sign in again to continue.", fr: "Votre session a expiré — reconnectez-vous pour continuer.", zh: "会话已过期 — 请重新登录后继续。" },
  apptBad: { ar: "اختر التاريخ والوقت أولاً.", en: "Pick a date and a time first.", fr: "Choisissez d'abord une date et une heure.", zh: "请先选择日期和时间。" },
  apptFri: { ar: "لا جلسات في هذا اليوم — اختر يوماً آخر.", en: "No sessions on this day — please pick another day.", fr: "Pas de séance ce jour-là — choisissez un autre jour.", zh: "当天不安排会谈 — 请选择其他日期。" },
  apptPast: { ar: "هذا الموعد مضى — اختر وقتاً قادماً.", en: "That time has already passed — pick a later one.", fr: "Cet horaire est déjà passé — choisissez-en un autre.", zh: "该时间已过 — 请选择之后的时间。" },
  provCard: { ar: "بطاقة", en: "Card", fr: "Carte", zh: "银行卡" },
  provTamara: { ar: "تمارا", en: "Tamara", fr: "Tamara", zh: "Tamara" },
  provBank: { ar: "تحويل بنكي", en: "Bank transfer", fr: "Virement bancaire", zh: "银行转账" },
  actAi: { ar: "المستشار الذكي", en: "Smart advisor", fr: "Conseiller intelligent", zh: "智能顾问" },
  actSys: { ar: "النظام", en: "System", fr: "Système", zh: "系统" },
  actTeam: { ar: "فريق Business Partner", en: "Business Partner team", fr: "Équipe Business Partner", zh: "Business Partner 团队" },
  you: { ar: "أنت", en: "You", fr: "Vous", zh: "您" },
  team: { ar: "الفريق", en: "Team", fr: "Équipe", zh: "团队" },
  assistant: { ar: "المساعد", en: "Assistant", fr: "Assistant", zh: "助手" },
  loginTitle: { ar: "تسجيل الدخول", en: "Sign in", fr: "Connexion", zh: "登录" },
  loginText: { ar: "اختر طريقة الدخول — حسابك واحد مهما اخترت.", en: "Choose how to sign in — it is one account whichever you pick.", fr: "Choisissez comment vous connecter — un seul compte, quel que soit le moyen.", zh: "选择登录方式——无论哪种方式都是同一个账户。" },
  tabPw: { ar: "كلمة المرور", en: "Password", fr: "Mot de passe", zh: "密码" },
  tabNew: { ar: "حساب جديد", en: "New account", fr: "Nouveau compte", zh: "新账户" },
  tabLink: { ar: "رابط بالبريد", en: "E-mail link", fr: "Lien par e-mail", zh: "邮件链接" },
  forgot: { ar: "نسيت كلمة المرور؟ ادخل برابط يصلك بالبريد", en: "Forgot it? Sign in with an e-mailed link", fr: "Oublié ? Connectez-vous par lien e-mail", zh: "忘记密码？使用邮件链接登录" },
  badCreds: { ar: "البريد أو كلمة المرور غير صحيحة.", en: "Wrong e-mail or password.", fr: "E-mail ou mot de passe incorrect.", zh: "邮箱或密码不正确。" },
  tooMany: { ar: "محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.", en: "Too many attempts. Wait a little and try again.", fr: "Trop de tentatives. Patientez un peu puis réessayez.", zh: "尝试次数过多，请稍等后再试。" },
  pwNew: { ar: "اختر كلمة مرور", en: "Choose a password", fr: "Choisissez un mot de passe", zh: "设置密码" },
  pwConfirm: { ar: "أعد كتابة كلمة المرور", en: "Repeat the password", fr: "Répétez le mot de passe", zh: "再次输入密码" },
  pwMismatch: { ar: "كلمتا المرور غير متطابقتين.", en: "The passwords do not match.", fr: "Les mots de passe ne correspondent pas.", zh: "两次输入的密码不一致。" },
  pwRule: { ar: "٨ أحرف على الأقل، وتحوي حرفاً ورقماً.", en: "At least 8 characters, with a letter and a digit.", fr: "8 caractères minimum, avec une lettre et un chiffre.", zh: "至少 8 个字符，包含字母和数字。" },
  pwr_short: { ar: "كلمة المرور ٨ أحرف على الأقل.", en: "The password must be at least 8 characters.", fr: "8 caractères minimum.", zh: "密码至少 8 个字符。" },
  pwr_long: { ar: "كلمة المرور أطول من المسموح.", en: "That password is too long.", fr: "Ce mot de passe est trop long.", zh: "密码过长。" },
  pwr_no_letter: { ar: "كلمة المرور تحتاج حرفاً واحداً على الأقل.", en: "The password needs at least one letter.", fr: "Le mot de passe doit contenir au moins une lettre.", zh: "密码至少需要一个字母。" },
  pwr_no_digit: { ar: "كلمة المرور تحتاج رقماً واحداً على الأقل.", en: "The password needs at least one digit.", fr: "Le mot de passe doit contenir au moins un chiffre.", zh: "密码至少需要一个数字。" },
  pwr_repetitive: { ar: "كلمة المرور متكررة الأحرف. اختر غيرها.", en: "That password repeats too much. Pick another.", fr: "Ce mot de passe est trop répétitif. Choisissez-en un autre.", zh: "密码字符过于重复，请换一个。" },
  pwr_common: { ar: "كلمة المرور شائعة جداً. اختر غيرها.", en: "That password is too common. Pick another.", fr: "Ce mot de passe est trop courant. Choisissez-en un autre.", zh: "密码过于常见，请换一个。" },
  pwr_has_email: { ar: "لا تضع بريدك داخل كلمة المرور.", en: "Do not put your e-mail inside the password.", fr: "Ne mettez pas votre e-mail dans le mot de passe.", zh: "密码中不要包含您的邮箱。" },
  signupGo: { ar: "أنشئ حسابي وأرسل الرمز", en: "Create my account and send the code", fr: "Créer mon compte et envoyer le code", zh: "创建账户并发送验证码" },
  signupNote: { ar: "سنرسل رمزاً إلى بريدك. لا تُفعَّل كلمة المرور قبل تأكيده.", en: "We e-mail you a code. The password is not active until you confirm it.", fr: "Nous vous envoyons un code. Le mot de passe n'est actif qu'après confirmation.", zh: "我们会向您的邮箱发送验证码，确认后密码才会生效。" },
  codeSent: { ar: "أرسلنا رمز التحقق إلى {e}.", en: "We sent a verification code to {e}.", fr: "Code de vérification envoyé à {e}.", zh: "验证码已发送到 {e}。" },
  codeOld: { ar: "انتهت صلاحية الرمز. ابدأ من جديد.", en: "That code has expired. Start again.", fr: "Ce code a expiré. Recommencez.", zh: "验证码已过期，请重新开始。" },
  confirmGo: { ar: "أكّد وادخل", en: "Confirm and sign in", fr: "Confirmer et se connecter", zh: "确认并登录" },
  cStep: { ar: "خطوة واحدة تُطلب مرة واحدة", en: "One step, asked once", fr: "Une seule étape, demandée une fois", zh: "仅需一步，只需一次" },
  cTitle: { ar: "أكمل حسابك", en: "Complete your account", fr: "Complétez votre compte", zh: "完善您的账户" },
  cText: { ar: "تم التحقق من هويتك عبر نفاذ. نحتاج بريدك لتصلك عليه الفاتورة الضريبية وإشعارات طلباتك، وجوالك ليتواصل معك الفريق.", en: "Your identity is verified through Nafath. We need your e-mail for your tax invoice and request updates, and your mobile so the team can reach you.", fr: "Votre identité est vérifiée par Nafath. Nous avons besoin de votre e-mail pour la facture fiscale et le suivi, et de votre mobile pour vous joindre.", zh: "您的身份已通过 Nafath 验证。我们需要您的邮箱以发送税务发票和申请进度，并需要您的手机号以便团队联系您。" },
  cPhone: { ar: "رقم الجوال", en: "Mobile number", fr: "Numéro de mobile", zh: "手机号码" },
  cPhonePh: { ar: "05XXXXXXXX", en: "05XXXXXXXX", fr: "05XXXXXXXX", zh: "05XXXXXXXX" },
  cBadPhone: { ar: "اكتب رقم جوال صحيحاً، مثل 05XXXXXXXX.", en: "Enter a valid mobile number, such as 05XXXXXXXX.", fr: "Saisissez un numéro de mobile valide, par ex. 05XXXXXXXX.", zh: "请输入有效的手机号，例如 05XXXXXXXX。" },
  cSend: { ar: "أرسل رمز التحقق", en: "Send the verification code", fr: "Envoyer le code de vérification", zh: "发送验证码" },
  cMismatch: { ar: "هذا البريد مرتبط بهوية وطنية أخرى. استعمل بريداً آخر أو تواصل معنا.", en: "This e-mail is linked to a different national ID. Use another e-mail or contact us.", fr: "Cet e-mail est lié à une autre identité nationale. Utilisez un autre e-mail ou contactez-nous.", zh: "此邮箱已关联另一个身份。请使用其他邮箱或联系我们。" },
  email: { ar: "البريد الإلكتروني", en: "Email", fr: "E-mail", zh: "邮箱" },
  sendCode: { ar: "أرسل الرمز", en: "Send code", fr: "Envoyer le code", zh: "发送验证码" },
  password: { ar: "كلمة المرور", en: "Password", fr: "Mot de passe", zh: "密码" },
  loginPw: { ar: "دخول بكلمة المرور", en: "Sign in with password", fr: "Se connecter avec mot de passe", zh: "使用密码登录" },
  usePw: { ar: "لديك كلمة مرور؟ ادخل بها", en: "Have a password? Sign in with it", fr: "Vous avez un mot de passe ?", zh: "使用密码登录" },
  useCode: { ar: "ادخل برمز البريد بدلاً من ذلك", en: "Use an emailed code instead", fr: "Utiliser un code par e-mail", zh: "改用邮箱验证码" },
  sendLink: { ar: "أرسل لي رابط الدخول", en: "Email me a sign-in link", fr: "Envoyez-moi un lien de connexion", zh: "给我发送登录链接" },
  badEmail: { ar: "اكتب بريداً إلكترونياً صحيحاً.", en: "Enter a valid e-mail address.", fr: "Saisissez une adresse e-mail valide.", zh: "请输入有效的邮箱地址。" },
  linkSent: { ar: "أرسلنا رابط الدخول إلى {e} — افتح بريدك واضغط الرابط وتدخل مباشرة (صالح ١٥ دقيقة).", en: "We sent a sign-in link to {e} — open your mailbox and tap it to get in (valid for 15 minutes).", fr: "Lien de connexion envoyé à {e} — ouvrez votre boîte mail et cliquez dessus (valable 15 minutes).", zh: "登录链接已发送到 {e}——打开邮箱点击即可登录（15 分钟内有效）。" },
  orCode: { ar: "أو اكتب الرمز المرسل في الرسالة نفسها:", en: "Or type the code from the same message:", fr: "Ou saisissez le code du même message :", zh: "或输入同一封邮件中的验证码：" },
  resend: { ar: "أرسل الرابط مرة أخرى", en: "Send the link again", fr: "Renvoyer le lien", zh: "重新发送链接" },
  resendIn: { ar: "إعادة الإرسال بعد {n} ث", en: "Send again in {n}s", fr: "Renvoyer dans {n} s", zh: "{n} 秒后可重发" },
  changeEmail: { ar: "بريد آخر", en: "Use another e-mail", fr: "Autre e-mail", zh: "更换邮箱" },
  openLink: { ar: "افتح رابط الاختبار", en: "Open the test link", fr: "Ouvrir le lien de test", zh: "打开测试链接" },
  linkTitle: { ar: "تأكيد الدخول", en: "Confirm sign-in", fr: "Confirmer la connexion", zh: "确认登录" },
  linkText: { ar: "اضغط الزرّ لإكمال الدخول إلى حسابك.", en: "Tap the button to finish signing in to your account.", fr: "Appuyez sur le bouton pour terminer la connexion.", zh: "点击按钮完成登录。" },
  linkGo: { ar: "أكمل الدخول", en: "Continue to my account", fr: "Continuer vers mon compte", zh: "继续进入我的账户" },
  linkBad: { ar: "الرابط منتهٍ أو استُعمل من قبل. اطلب رابطاً جديداً.", en: "This link has expired or was already used. Request a new one.", fr: "Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau.", zh: "此链接已过期或已被使用，请重新获取。" },
  linkNew: { ar: "اطلب رابطاً جديداً", en: "Request a new link", fr: "Demander un nouveau lien", zh: "获取新链接" },
  pwTitle: { ar: "كلمة المرور", en: "Password", fr: "Mot de passe", zh: "密码" },
  pwNote: { ar: "اضبط كلمة مرور لحسابك لتدخل بها مباشرة بدل انتظار رمز البريد في كل مرة.", en: "Set a password so you can sign in directly instead of waiting for an emailed code.", fr: "Définissez un mot de passe pour vous connecter directement.", zh: "设置密码即可直接登录，无需每次等待验证码。" },
  pwSave: { ar: "حفظ كلمة المرور", en: "Save password", fr: "Enregistrer", zh: "保存密码" },
  pwShort: { ar: "كلمة المرور ٨ أحرف على الأقل.", en: "The password must be at least 8 characters.", fr: "8 caractères minimum.", zh: "密码至少 8 个字符。" },
  pwSaved: { ar: "تم حفظ كلمة المرور ✓", en: "Password saved ✓", fr: "Mot de passe enregistré ✓", zh: "密码已保存 ✓" },
  code: { ar: "رمز الدخول", en: "Sign-in code", fr: "Code", zh: "验证码" },
  verify: { ar: "دخول", en: "Sign in", fr: "Se connecter", zh: "登录" },
  loginErr: { ar: "تعذّر إرسال الرمز.", en: "Couldn't send the code.", fr: "Impossible d'envoyer le code.", zh: "无法发送验证码。" },
  codeErr: { ar: "الرمز غير صحيح.", en: "Wrong code.", fr: "Code incorrect.", zh: "验证码错误。" },
  error: { ar: "حدث خطأ. حاول مرة أخرى.", en: "Something went wrong. Try again.", fr: "Une erreur est survenue. Réessayez.", zh: "出错了，请重试。" },
  // D3 — who the client is: asked once, written onto the quotation, contract, invoice and the team's board.
  pfStep: { ar: "خطوة واحدة تُطلب مرة واحدة", en: "One step, asked once", fr: "Une seule étape, demandée une fois", zh: "仅需一步，只需一次" },
  pfTitle: { ar: "عرّفنا بنفسك", en: "Tell us who you are", fr: "Dites-nous qui vous êtes", zh: "请告诉我们您是谁" },
  pfText: { ar: "نكتب اسمك الكامل في عرض السعر والعقد والفاتورة، ونتواصل معك على جوالك بخصوص طلبك.", en: "Your full name appears on the quotation, the contract and the invoice, and we reach you on your mobile about your request.", fr: "Votre nom complet figure sur le devis, le contrat et la facture, et nous vous joignons sur votre mobile au sujet de votre demande.", zh: "您的全名将出现在报价单、合同和发票上，我们也会通过手机与您联系。" },
  pfName: { ar: "الاسم الكامل", en: "Full name", fr: "Nom complet", zh: "全名" },
  pfNamePh: { ar: "الاسم الأول واسم العائلة", en: "First and family name", fr: "Prénom et nom", zh: "名和姓" },
  pfSave: { ar: "احفظ وتابع", en: "Save and continue", fr: "Enregistrer et continuer", zh: "保存并继续" },
  pfBadName: { ar: "اكتب اسمك الكامل (كلمتان على الأقل، بلا أرقام).", en: "Enter your full name (at least two words, no digits).", fr: "Saisissez votre nom complet (deux mots au moins, sans chiffres).", zh: "请输入全名（至少两个词，不含数字）。" },
  pfLater: { ar: "لاحقاً", en: "Later", fr: "Plus tard", zh: "稍后" },
  // D2 — the request started in another tab finishes here.
  resumeNote: { ar: "طلبك الذي بدأته في المحادثة محفوظ — بعد الدخول نكمل إنشاءه تلقائياً.", en: "The request you started in the chat is saved — once you are in, we finish creating it for you.", fr: "La demande commencée dans le chat est enregistrée — une fois connecté, nous la finalisons pour vous.", zh: "您在聊天中开始的申请已保存 — 登录后我们会自动为您完成创建。" },
  // D4 — asking for changes to a quotation: say what, confirm, and be told what happens next.
  revTitle: { ar: "طلب تعديل على عرض السعر", en: "Request changes to the quotation", fr: "Demander des modifications du devis", zh: "要求修改报价" },
  revText: { ar: "اكتب ما تريد تعديله (بند، كمية، شروط…). يراجعه الفريق ويصلك عرض معدَّل هنا وعلى بريدك — ولا يُعتمد العرض الحالي.", en: "Say what you want changed (an item, a quantity, terms…). The team reviews it and a revised quotation reaches you here and by e-mail. The current quotation will not be approved.", fr: "Dites ce que vous voulez modifier (une ligne, une quantité, des conditions…). L'équipe l'examine et un devis révisé vous parvient ici et par e-mail. Le devis actuel ne sera pas approuvé.", zh: "请说明需要修改的内容（项目、数量、条款…）。团队审核后，修订报价将发送到此处和您的邮箱。当前报价将不会被确认。" },
  revNeed: { ar: "اكتب التعديل المطلوب (ثلاثة أحرف على الأقل).", en: "Write the change you need (at least three characters).", fr: "Écrivez la modification souhaitée (trois caractères au moins).", zh: "请填写需要的修改（至少三个字符）。" },
  revGo: { ar: "أرسل طلب التعديل", en: "Send the change request", fr: "Envoyer la demande", zh: "提交修改请求" },
  revSentTitle: { ar: "استلمنا طلب التعديل", en: "We received your change request", fr: "Demande de modification reçue", zh: "已收到您的修改请求" },
  revSentText: { ar: "الفريق يراجعه الآن ويصلك عرض معدَّل هنا وعلى بريدك. لا حاجة لأي إجراء منك حتى ذلك الحين.", en: "The team is reviewing it now and a revised quotation will reach you here and by e-mail. Nothing is needed from you until then.", fr: "L'équipe l'examine et un devis révisé vous parviendra ici et par e-mail. Rien n'est requis de votre part d'ici là.", zh: "团队正在审核，修订报价将发送到此处和您的邮箱。在此之前您无需任何操作。" },
  revYouAsked: { ar: "طلبك:", en: "Your request:", fr: "Votre demande :", zh: "您的请求：" },
  // D8 — a payment that did not complete is explained, with the next step.
  payFailedMsg: { ar: "لم تكتمل عملية الدفع. تقدر تحاول مرة أخرى أو تختار وسيلة أخرى. وإن ظهر خصم على بطاقتك فراسلنا من المحادثة ونراجعه معك.", en: "The payment did not complete. You can try again or choose another method. If you see a charge on your card, message us from the conversation and we will check it with you.", fr: "Le paiement n'a pas abouti. Vous pouvez réessayer ou choisir un autre moyen. Si un débit apparaît sur votre carte, écrivez-nous dans la conversation et nous le vérifierons avec vous.", zh: "付款未完成。您可以重试或选择其他方式。若您的卡上出现扣款，请在对话中联系我们，我们会与您核实。" },
  payCancelledMsg: { ar: "ألغيتَ عملية الدفع قبل إتمامها. لم يتم شيء — تقدر تدفع متى جهّزت.", en: "You cancelled the payment before completing it. Nothing was done — pay whenever you are ready.", fr: "Vous avez annulé le paiement avant de le finaliser. Rien n'a été fait — payez quand vous êtes prêt.", zh: "您在完成前取消了付款。没有任何操作 — 准备好后可随时付款。" },
  payPendingMsg: { ar: "الدفع قيد التأكيد من البوابة. نحدّث حالة طلبك تلقائياً حال وصول النتيجة.", en: "The payment is awaiting confirmation from the gateway. Your request updates automatically when the result arrives.", fr: "Le paiement attend la confirmation de la passerelle. Votre demande se met à jour automatiquement à réception du résultat.", zh: "付款正在等待支付网关确认。结果到达后您的申请会自动更新。" },
  // D20 — cancelling something already paid: what the team does, and what we do not promise.
  cxPaidDone: { ar: "بما أنّ الطلب كان مدفوعاً، يراجع الفريق الدفعة ويتواصل معك بشأنها. لا نَعِد بمبلغ أو بمدة قبل اكتمال المراجعة.", en: "Because this request had been paid, the team is reviewing the payment and will contact you about it. We promise no amount or timeframe before the review is complete.", fr: "Cette demande ayant été payée, l'équipe examine le paiement et vous contactera à ce sujet. Nous ne promettons ni montant ni délai avant la fin de l'examen.", zh: "由于此申请已付款，团队正在审核该笔付款并会就此联系您。在审核完成前，我们不承诺任何金额或时限。" },
  cxPendPaid: { ar: "وبما أنّ الطلب مدفوع، تشمل المراجعة الدفعة نفسها؛ لا نَعِد بمبلغ أو بمدة قبل اكتمالها.", en: "Because the request is paid, the review includes the payment itself; we promise no amount or timeframe before it is complete.", fr: "La demande étant payée, l'examen porte aussi sur le paiement ; nous ne promettons ni montant ni délai avant la fin.", zh: "由于申请已付款，审核也包括该笔付款；在审核完成前，我们不承诺任何金额或时限。" },
  waitingTeam: { ar: "الفريق يراجع طلبك", en: "The team is reviewing your request", fr: "L'équipe examine votre demande", zh: "团队正在审核您的申请" },
  needYou: { ar: "بانتظارك", en: "Waiting for you", fr: "En attente de vous", zh: "等待您处理" },
  tasksTitle: { ar: "مطلوب منك", en: "Required from you", fr: "Requis de votre part", zh: "需要您完成" },
  done: { ar: "تم", en: "Done", fr: "Fait", zh: "完成" },
  requestCreated: { ar: "تم إنشاء الطلب", en: "Request created", fr: "Demande créée", zh: "申请已创建" },
  testRibbon: { ar: "وضع الاختبار — لا مدفوعات حقيقية", en: "TEST MODE — no real payments", fr: "MODE TEST — aucun paiement réel", zh: "测试模式 — 无真实付款" },
  sourceLbl: { ar: "المصدر", en: "Source", fr: "Source", zh: "来源" },
  // ---- شراء مباشر بالسلة: طلب يبدأ مدفوعاً، بلا عرض سعر ولا عقد.
  direct: { ar: "شراء مباشر", en: "Direct purchase", fr: "Achat direct", zh: "直接购买" },
  // تذكرة الدعم من مركز التواصل (baher-support): صفٌّ في requests نفسه مرجعه BP-TKT-.
  ticket: { ar: "تذكرة دعم", en: "Support ticket", fr: "Ticket d'assistance", zh: "支持工单" },
  bought: { ar: "ما اشتريته", en: "What you bought", fr: "Votre achat", zh: "您购买的内容" },
  directNote: { ar: "اشتريت هذه الخدمة مباشرة من السلة ودفعت قبل فتح الطلب، فلا عرض سعر ولا عقد له. تتابع هنا مراحله، وترفع مستنداتك، وتستلم مخرجاته.", en: "You bought this directly from the cart and paid before the request opened, so it has no quotation or contract. Follow its stages here, upload your documents and receive the deliverables.", fr: "Vous avez acheté ceci directement depuis le panier et payé avant l'ouverture de la demande : pas de devis ni de contrat. Suivez ici les étapes, téléversez vos documents et recevez les livrables.", zh: "您直接通过购物车购买并已付款，因此没有报价和合同。您可以在此跟进进度、上传文件并接收交付成果。" },
  cycM: { ar: "شهري", en: "monthly", fr: "mensuel", zh: "按月" },
  cycY: { ar: "سنوي", en: "yearly", fr: "annuel", zh: "按年" },
  unverifiedNote: { ar: "مبلغ هذه الدفعة لم يُطابَق آلياً مع الأسعار المعتمدة، فيراجعه الفريق قبل بدء التنفيذ. لا حاجة لإعادة الدفع.", en: "This payment's amount could not be matched automatically to the published prices, so the team reviews it before work starts. No need to pay again.", fr: "Le montant de ce paiement n'a pas pu être rapproché automatiquement des tarifs ; l'équipe le vérifie avant de commencer. Inutile de payer à nouveau.", zh: "此笔付款金额无法自动与公布价格核对，团队将在开始执行前复核。无需重复付款。" },
  // ---- خزانة المستندات (/my) — نفس خزانة الحساب: جدول documents نفسه،
  // فالمستند المرفوع من هنا يظهر هناك والعكس. لا خزانة ثانية.
  navDocs: { ar: "مستنداتي", en: "My documents", fr: "Mes documents", zh: "我的文件" },
  vaultNote: { ar: "ارفع مستندك مرّة واحدة — نستعمله في كل طلب، ولا يراه أحد خارج حسابك.",
               en: "Upload a document once — we use it across your requests, and nobody outside your account sees it.",
               fr: "Téléversez un document une fois — nous l'utilisons pour toutes vos demandes, et personne d'autre ne le voit.",
               zh: "文件只需上传一次 — 我们会在您的各项申请中使用，账户之外无人可见。" },
  dzPick: { ar: "اسحب الملف هنا أو اضغط للاختيار", en: "Drop a file here, or click to choose",
            fr: "Déposez un fichier ici, ou cliquez pour choisir", zh: "将文件拖到此处，或点击选择" },
  dzHint: { ar: "PDF أو صورة (JPG · PNG · WEBP) — حتى ٨ ميجابايت",
            en: "PDF or image (JPG · PNG · WEBP) — up to 8 MB",
            fr: "PDF ou image (JPG · PNG · WEBP) — jusqu'à 8 Mo",
            zh: "PDF 或图片（JPG · PNG · WEBP）— 最大 8 MB" },
  dName: { ar: "اسم المستند", en: "Document name", fr: "Nom du document", zh: "文件名称" },
  dCat: { ar: "نوعه", en: "Type", fr: "Type", zh: "类型" },
  dExp: { ar: "تاريخ الانتهاء (اختياري)", en: "Expiry date (optional)", fr: "Date d'expiration (facultatif)", zh: "到期日（可选）" },
  dSend: { ar: "ارفع المستند", en: "Upload document", fr: "Téléverser", zh: "上传文件" },
  dOther: { ar: "اختر ملفاً آخر", en: "Choose another file", fr: "Choisir un autre fichier", zh: "选择其他文件" },
  dUploading: { ar: "جارٍ الرفع", en: "Uploading", fr: "Téléversement", zh: "正在上传" },
  dDone: { ar: "تم رفع المستند ✓", en: "Document uploaded ✓", fr: "Document téléversé ✓", zh: "文件已上传 ✓" },
  dNewVerDone: { ar: "رُفعت نسخة جديدة ✓", en: "New version uploaded ✓", fr: "Nouvelle version téléversée ✓", zh: "已上传新版本 ✓" },
  eBig: { ar: "الملف أكبر من ٨ ميجابايت", en: "The file is larger than 8 MB",
          fr: "Le fichier dépasse 8 Mo", zh: "文件超过 8 MB" },
  eType: { ar: "هذه الصيغة غير مقبولة. المقبول: PDF · JPG · PNG · WEBP.",
           en: "This format is not accepted. Accepted: PDF · JPG · PNG · WEBP.",
           fr: "Format non accepté. Acceptés : PDF · JPG · PNG · WEBP.",
           zh: "不接受此格式。可用格式：PDF · JPG · PNG · WEBP。" },
  eEmpty: { ar: "الملف فارغ.", en: "The file is empty.", fr: "Le fichier est vide.", zh: "文件为空。" },
  eName: { ar: "اكتب اسم المستند أولاً.", en: "Enter a document name first.",
           fr: "Saisissez d'abord un nom de document.", zh: "请先填写文件名称。" },
  eNet: { ar: "تعذّر الوصول إلى الخادم — تحقّق من اتصالك وأعد المحاولة.",
          en: "Could not reach the server — check your connection and try again.",
          fr: "Serveur injoignable — vérifiez votre connexion et réessayez.",
          zh: "无法连接服务器 — 请检查网络后重试。" },
  eUp: { ar: "تعذّر رفع الملف", en: "The file could not be uploaded",
         fr: "Le fichier n'a pas pu être téléversé", zh: "文件上传失败" },
  eRead: { ar: "تعذّرت قراءة الملف من جهازك.", en: "The file could not be read from your device.",
           fr: "Impossible de lire le fichier depuis votre appareil.", zh: "无法从您的设备读取该文件。" },
  eNoOrg: { ar: "أضف اسم شركتك في «بيانات الشركة» أولاً — الخزانة مرتبطة بالمنشأة.",
            en: "Add your company name under «Company details» first — the vault belongs to the company.",
            fr: "Ajoutez d'abord le nom de votre entreprise dans « Données de l'entreprise » — le coffre appartient à l'entreprise.",
            zh: "请先在“公司信息”中填写公司名称 — 文件保险库归属于公司。" },
  dOpen: { ar: "فتح", en: "Open", fr: "Ouvrir", zh: "打开" },
  dNewVer: { ar: "نسخة جديدة", en: "New version", fr: "Nouvelle version", zh: "新版本" },
  dDel: { ar: "حذف", en: "Delete", fr: "Supprimer", zh: "删除" },
  dDelAsk: { ar: "حذف هذا المستند نهائياً من خزانتك؟", en: "Delete this document from your vault for good?",
             fr: "Supprimer définitivement ce document de votre coffre ?", zh: "确定要从保险库中永久删除此文件吗？" },
  dVer: { ar: "نسخة", en: "v", fr: "v", zh: "版本" },
  dExpires: { ar: "ينتهي", en: "Expires", fr: "Expire le", zh: "到期" },
  dExpired: { ar: "منتهي", en: "Expired", fr: "Expiré", zh: "已过期" },
  dLeftA: { ar: "باقي", en: "", fr: "encore", zh: "还剩" },
  dLeftB: { ar: "يوم", en: "days left", fr: "jours", zh: "天" },
  dPending: { ar: "قيد التحقق", en: "Pending review", fr: "En cours de vérification", zh: "待核验" },
  dReadOk: { ar: "مقروء آلياً ✓", en: "Read automatically ✓", fr: "Lu automatiquement ✓", zh: "已自动识别 ✓" },
  dNone: { ar: "لا مستندات بعد — ابدأ بأول مستند من الأعلى.",
           en: "No documents yet — upload your first one above.",
           fr: "Aucun document — téléversez le premier ci-dessus.",
           zh: "还没有文件 — 请在上方上传第一个。" },
  dLoading: { ar: "نحمّل خزانتك…", en: "Loading your vault…", fr: "Chargement de votre coffre…", zh: "正在加载…" },
  dEntity: { ar: "المنشأة", en: "Entity", fr: "Entité", zh: "主体" },
  dCr: { ar: "س.ت", en: "CR", fr: "RC", zh: "商业登记号" },
  dVat: { ar: "الرقم الضريبي", en: "VAT", fr: "TVA", zh: "税号" },
  dIssued: { ar: "الإصدار", en: "Issued", fr: "Émis le", zh: "签发" },
  dRetry: { ar: "أعد المحاولة", en: "Try again", fr: "Réessayer", zh: "重试" },
  // ---- الامتثال والمخالفات (/my) — نفس مسارات my-ops الحيّة، بلا منطق جديد:
  // compliance-access للحالة، violations للمخالفات، وop-violation-add/object.
  // المستشار الذكي للامتثال اسمه «مشاري» — لا «الوكيل».
  navCompliance: { ar: "الامتثال والمخالفات", en: "Compliance & violations", fr: "Conformité et infractions", zh: "合规与违规" },
  cIntro: { ar: "«مشاري»، المستشار الذكي للامتثال، يتابع استحقاقات منشأتك ومخالفاتها ويجهّز الاعتراضات.", en: "“Mishari”, the compliance smart advisor, tracks your company's obligations and violations and prepares objections.", fr: "« Mishari », le conseiller intelligent de conformité, suit les échéances et infractions de votre entreprise et prépare les objections.", zh: "合规智能顾问“Mishari”跟踪贵公司的义务与违规并准备申诉。" },
  cLoading: { ar: "نحمّل بيانات الامتثال…", en: "Loading compliance…", fr: "Chargement de la conformité…", zh: "正在加载合规信息…" },
  cActive: { ar: "اشتراك الامتثال نشط", en: "Compliance subscription active", fr: "Abonnement conformité actif", zh: "合规订阅已激活" },
  cTrialLbl: { ar: "تجربة مجانية للامتثال", en: "Free compliance trial", fr: "Essai gratuit de conformité", zh: "合规免费试用" },
  cLockedTitle: { ar: "انتهت التجربة المجانية", en: "Your free trial has ended", fr: "Votre essai gratuit est terminé", zh: "免费试用已结束" },
  cLocked: { ar: "اشترك في خدمة الامتثال لتتابع استحقاقاتك ومخالفاتك وتقدّم اعتراضاتك من هنا.", en: "Subscribe to the compliance service to keep tracking your obligations and violations and file objections here.", fr: "Abonnez-vous au service de conformité pour continuer à suivre vos échéances et infractions et déposer vos objections ici.", zh: "订阅合规服务以继续在此跟踪义务与违规并提交申诉。" },
  cSubscribe: { ar: "اشترك في خدمة الامتثال", en: "Subscribe to compliance", fr: "S'abonner à la conformité", zh: "订阅合规服务" },
  cDocsTitle: { ar: "استحقاقات قريبة", en: "Upcoming renewals", fr: "Échéances à venir", zh: "即将到期" },
  cDocsNone: { ar: "لا استحقاقات قريبة في مستنداتك خلال ٦٠ يوماً.", en: "No document renewals due within 60 days.", fr: "Aucune échéance de document dans les 60 jours.", zh: "60 天内没有文件需续期。" },
  cManageDocs: { ar: "إدارة مستنداتك ورفعها", en: "Manage & upload your documents", fr: "Gérer et téléverser vos documents", zh: "管理并上传您的文件" },
  cViolTitle: { ar: "المخالفات", en: "Violations", fr: "Infractions", zh: "违规" },
  cViolIntro: { ar: "سجّل أي مخالفة حكومية (بلدي، قوى، زاتكا، الدفاع المدني…) وقدّم اعتراضاً عليها، ويتابع فريقنا الاعتراض لدى الجهة نيابةً عنك.", en: "Log any government violation (Baladi, Qiwa, ZATCA, Civil Defense…) and file an objection; our team pursues it with the authority on your behalf.", fr: "Enregistrez toute infraction gouvernementale (Baladi, Qiwa, ZATCA, Protection civile…) et déposez une objection ; notre équipe la poursuit auprès de l'autorité en votre nom.", zh: "登记任何政府违规（Baladi、Qiwa、ZATCA、民防…）并提交申诉，我们的团队将代您向主管机关跟进。" },
  cStages: { ar: "مسار الاعتراض: مراجعة ← دراسة أهلية الاعتراض ← تجهيز ← تقديم ← متابعة. لا نَعِد بإلغاء المخالفة؛ ندرس أهلية الاعتراض ونتابعه لدى الجهة.", en: "Objection path: review → eligibility study → preparation → submission → follow-up. We do not promise cancellation; we study eligibility and pursue the objection with the authority.", fr: "Parcours de l'objection : examen → étude de recevabilité → préparation → dépôt → suivi. Nous ne promettons pas l'annulation ; nous étudions la recevabilité et assurons le suivi auprès de l'autorité.", zh: "申诉流程：审查 → 受理资格研究 → 准备 → 提交 → 跟进。我们不承诺撤销；我们研究受理资格并向主管机关跟进。" },
  cViolNone: { ar: "لا مخالفات مسجّلة. إن وصلتك مخالفة، سجّلها بالأسفل.", en: "No violations logged. If you receive one, log it below.", fr: "Aucune infraction enregistrée. Si vous en recevez une, enregistrez-la ci-dessous.", zh: "尚无违规记录。如收到违规，请在下方登记。" },
  cNew: { ar: "جديدة", en: "New", fr: "Nouvelle", zh: "新" },
  cDeadline: { ar: "آخر موعد للاعتراض", en: "Objection deadline", fr: "Délai d'objection", zh: "申诉截止" },
  cObjectBtn: { ar: "قدّم اعتراض", en: "File an objection", fr: "Déposer une objection", zh: "提交申诉" },
  cObjectNote: { ar: "مبرراتك للاعتراض — الوقائع والمستندات المؤيدة…", en: "Your grounds — the facts and supporting documents…", fr: "Vos motifs — les faits et documents à l'appui…", zh: "您的申诉理由——事实与证明文件…" },
  cObjectFiled: { ar: "قيد الاعتراض — الفريق يتابعه", en: "Objection in progress — our team is on it", fr: "Objection en cours — notre équipe s'en occupe", zh: "申诉进行中 — 团队正在处理" },
  cAddTitle: { ar: "سجّل مخالفة", en: "Log a violation", fr: "Enregistrer une infraction", zh: "登记违规" },
  cAuthority: { ar: "الجهة (بلدي، قوى، زاتكا…)", en: "Authority (Baladi, Qiwa, ZATCA…)", fr: "Autorité (Baladi, Qiwa, ZATCA…)", zh: "主管机关（Baladi、Qiwa、ZATCA…）" },
  cVTitle: { ar: "وصف المخالفة", en: "Violation description", fr: "Description de l'infraction", zh: "违规描述" },
  cVNumber: { ar: "رقم المخالفة (اختياري)", en: "Violation number (optional)", fr: "Numéro d'infraction (facultatif)", zh: "违规编号（可选）" },
  cVAmount: { ar: "المبلغ بالريال (اختياري)", en: "Amount in SAR (optional)", fr: "Montant en SAR (facultatif)", zh: "金额（里亚尔，可选）" },
  cVDate: { ar: "تاريخ المخالفة (اختياري)", en: "Violation date (optional)", fr: "Date de l'infraction (facultatif)", zh: "违规日期（可选）" },
  cVDeadline: { ar: "آخر موعد للاعتراض (اختياري)", en: "Objection deadline (optional)", fr: "Délai d'objection (facultatif)", zh: "申诉截止日期（可选）" },
  cAddBtn: { ar: "سجّل المخالفة", en: "Log violation", fr: "Enregistrer", zh: "登记违规" },
  cAddDone: { ar: "سُجّلت المخالفة ✓", en: "Violation logged ✓", fr: "Infraction enregistrée ✓", zh: "违规已登记 ✓" },
  ndaTitle: { ar: "اتفاقية حفظ السرية وحماية بياناتك", en: "Confidentiality & data-protection agreement", fr: "Accord de confidentialité et de protection des données", zh: "保密与数据保护协议" },
  ndaIntro: { ar: "قبل رفع مستنداتك ومعلومات منشأتك، نوضّح كيف نحميها:", en: "Before you upload your documents and company information, here is how we protect them:", fr: "Avant de téléverser vos documents et les informations de votre entreprise, voici comment nous les protégeons :", zh: "在上传您的文件和企业信息之前，我们说明如何保护它们：" },
  ndaP1: { ar: "السرية: كل معلوماتك ومستنداتك سرية، ولا تُشارك مع أي طرف ثالث دون إذنك، إلا ما يلزم قانوناً أو لإنجاز الخدمة الحكومية التي طلبتها.", en: "Confidentiality: all your information and documents are confidential and are not shared with any third party without your consent, except as required by law or to complete the government service you requested.", fr: "Confidentialité : toutes vos informations et documents sont confidentiels et ne sont partagés avec aucun tiers sans votre consentement, sauf obligation légale ou pour réaliser le service public demandé.", zh: "保密：您的所有信息和文件均属机密，未经您同意不会与任何第三方共享，除非法律要求或为完成您所申请的政府服务。" },
  ndaP2: { ar: "الاستخدام: نستخدم بياناتك فقط لتقديم خدمة الامتثال (متابعة التزاماتك، التنبيهات، الاعتراضات).", en: "Use: we use your data only to provide the compliance service (tracking your obligations, alerts, objections).", fr: "Utilisation : nous utilisons vos données uniquement pour fournir le service de conformité (suivi de vos obligations, alertes, objections).", zh: "使用：我们仅将您的数据用于提供合规服务（跟踪义务、提醒、申诉）。" },
  ndaP3: { ar: "الوصول: بياناتك مقيّدة بمنشأتك، ولا يصل إليها إلا الفريق المخوّل لخدمتك.", en: "Access: your data is restricted to your company, and only the team authorized to serve you can access it.", fr: "Accès : vos données sont limitées à votre entreprise et seule l'équipe autorisée à vous servir y a accès.", zh: "访问：您的数据仅限于您的企业，只有获授权为您服务的团队才能访问。" },
  ndaP4: { ar: "الحفظ والحذف: تُخزَّن بأمان، ولك طلب حذفها عند إنهاء الخدمة.", en: "Retention & deletion: it is stored securely, and you may request its deletion when the service ends.", fr: "Conservation et suppression : elles sont stockées en toute sécurité et vous pouvez en demander la suppression à la fin du service.", zh: "保存与删除：数据安全存储，服务结束时您可请求删除。" },
  ndaP5: { ar: "موافقتك: بالموافقة أدناه تقرّ باطّلاعك على هذه الشروط وتأذن لـBusiness Partner بمعالجة بياناتك لغرض الخدمة.", en: "Your consent: by agreeing below you acknowledge that you have read these terms and authorize Business Partner to process your data for the purpose of the service.", fr: "Votre consentement : en acceptant ci-dessous, vous reconnaissez avoir lu ces conditions et autorisez Business Partner à traiter vos données aux fins du service.", zh: "您的同意：在下方同意即表示您已阅读这些条款，并授权 Business Partner 为服务目的处理您的数据。" },
  ndaAgree: { ar: "أوافق على اتفاقية حفظ السرية وحماية البيانات.", en: "I agree to the confidentiality & data-protection agreement.", fr: "J'accepte l'accord de confidentialité et de protection des données.", zh: "我同意保密与数据保护协议。" },
  ndaBtn: { ar: "موافقة ومتابعة", en: "Agree & continue", fr: "Accepter et continuer", zh: "同意并继续" },
  ndaLocked: { ar: "وافق على اتفاقية السرية لتفعيل رفع مستنداتك.", en: "Agree to the confidentiality agreement to activate your document uploads.", fr: "Acceptez l'accord de confidentialité pour activer le téléversement de vos documents.", zh: "同意保密协议以启用文件上传。" },
};
const STATUS = {
  NEW: { ar: "جديد", en: "New", fr: "Nouveau", zh: "新" }, REVIEWING: { ar: "قيد المراجعة", en: "Reviewing", fr: "En cours d'examen", zh: "审核中" },
  WAITING_CLIENT: { ar: "بانتظار ردك", en: "Waiting for you", fr: "En attente de vous", zh: "等待您回复" }, QUOTE_SENT: { ar: "عرض سعر بانتظار اعتمادك", en: "Quote awaiting approval", fr: "Devis à approuver", zh: "报价待确认" },
  QUOTE_APPROVED: { ar: "العرض معتمد", en: "Quote approved", fr: "Devis approuvé", zh: "报价已确认" }, CONTRACT_SENT: { ar: "عقد بانتظار توقيعك", en: "Contract awaiting signature", fr: "Contrat à signer", zh: "合同待签署" },
  SIGNED: { ar: "موقّع — بانتظار الدفع", en: "Signed — payment due", fr: "Signé — paiement dû", zh: "已签署 — 待付款" }, PAYMENT_PENDING: { ar: "بانتظار الدفع", en: "Payment pending", fr: "Paiement en attente", zh: "待付款" },
  PAID: { ar: "مدفوع — جاهز للتنفيذ", en: "Paid — ready for execution", fr: "Payé — prêt pour exécution", zh: "已付款 — 准备执行" }, IN_PROGRESS: { ar: "قيد التنفيذ", en: "In progress", fr: "En cours", zh: "执行中" },
  BANK_REVIEW: { ar: "إيصالك قيد المراجعة", en: "Receipt under review", fr: "Reçu en cours d'examen", zh: "回单复核中" },
  WAITING_INTERNAL: { ar: "قيد التنفيذ", en: "In progress", fr: "En cours", zh: "执行中" }, COMPLETED: { ar: "مكتمل", en: "Completed", fr: "Terminé", zh: "已完成" }, CANCELLED: { ar: "ملغي", en: "Cancelled", fr: "Annulé", zh: "已取消" },
};
const EVENTS = { ar: {"request.created": "أنشأ الطلب", "request.created.manual": "أُنشئ الطلب يدوياً", "request.created.cart": "أُنشئ الطلب من شراء مباشر بالسلة", "scope.proposed": "اقترح النطاق", "scope.edited": "عدّل النطاق", "scope.confirmed": "اعتمد النطاق", "quote.pending": "بانتظار عرض السعر", "message.customer": "رسالة من العميل", "message.bp": "رد الفريق", "attachment.added": "أضاف مرفقاً", "quote.drafted": "مسودة عرض سعر", "quote.sent": "أرسل عرض السعر", "quote.approved": "اعتمد العرض", "quote.rejected": "طلب تعديل العرض", "contract.sent": "أرسل العقد", "contract.signed": "وقّع العقد", "payment.paid": "تم الدفع", "payment.failed": "فشل الدفع", "payment.cancelled": "أُلغي الدفع", "payment.pending": "دفع معلّق", "invoice.issued": "صدرت الفاتورة", "appointment.booked": "حجز موعداً", "appointment.rescheduled": "أعاد جدولة الموعد", "appointment.cancelled": "ألغى الموعد", "appointment.set": "ثبّت الموعد", "task.created": "أنشأ مهمة", "task.human_required": "مهمة تحتاج تدخلاً بشرياً", "task.done": "أنجز المهمة", "task.in_progress": "بدأ المهمة", "task.waiting": "مهمة بانتظار", "task.todo": "أعاد فتح المهمة", "execution.started": "بدأ التنفيذ", "request.cancelled": "ألغى الطلب", "request.updated": "حدّث الطلب", "document.received": "استلمنا المستند", "deliverable.added": "سلّم مخرجاً من الطلب", "deliverable.removed": "سحب مخرجاً", "status.completed": "اكتمل الطلب", "status.in_progress": "بدأ التنفيذ", "status.waiting_internal": "قيد التنفيذ", "status.reviewing": "قيد المراجعة", "status.waiting_client": "بانتظار ردّك", "status.cancelled": "أُلغي الطلب", "quote.auto": "أصدر عرض السعر آلياً", "documents.requested": "حدّد المستندات المطلوبة", "payment.receipt": "استلم إيصال التحويل", "message.whatsapp": "رسالة واتساب", "contract.reissued": "أعاد إصدار العقد", "request.reopened": "أعاد فتح الطلب", "cancel.requested": "طلب الإلغاء", "payment.after_cancel": "وصلت دفعة بعد الإلغاء", "followup.reminded": "ذكّرك بالخطوة التالية"}, en: {"request.created": "created the request", "request.created.manual": "request created manually", "request.created.cart": "request opened from a direct cart purchase", "scope.proposed": "proposed the scope", "scope.edited": "edited the scope", "scope.confirmed": "confirmed the scope", "quote.pending": "awaiting the quotation", "message.customer": "customer message", "message.bp": "team reply", "attachment.added": "added an attachment", "quote.drafted": "quote drafted", "quote.sent": "sent the quotation", "quote.approved": "approved the quotation", "quote.rejected": "requested changes", "contract.sent": "sent the contract", "contract.signed": "signed the contract", "payment.paid": "payment received", "payment.failed": "payment failed", "payment.cancelled": "payment cancelled", "payment.pending": "payment pending", "invoice.issued": "invoice issued", "appointment.booked": "booked an appointment", "appointment.rescheduled": "rescheduled the appointment", "appointment.cancelled": "cancelled the appointment", "appointment.set": "set the appointment", "task.created": "created a task", "task.human_required": "task needs a human", "task.done": "completed the task", "task.in_progress": "started the task", "task.waiting": "task waiting", "task.todo": "reopened the task", "execution.started": "execution started", "request.cancelled": "cancelled the request", "request.updated": "updated the request", "document.received": "document received", "deliverable.added": "delivered a file", "deliverable.removed": "withdrew a delivered file", "status.completed": "request completed", "status.in_progress": "execution started", "status.waiting_internal": "in progress", "status.reviewing": "under review", "status.waiting_client": "waiting for your reply", "status.cancelled": "request cancelled", "quote.auto": "issued the quotation automatically", "documents.requested": "listed the required documents", "payment.receipt": "received the transfer receipt", "message.whatsapp": "WhatsApp message", "contract.reissued": "re-issued the contract", "request.reopened": "reopened the request", "cancel.requested": "cancellation requested", "payment.after_cancel": "payment received after cancellation", "followup.reminded": "reminded you of the next step"} };
const DOC_CATS = [
  ["cr",       { ar: "سجل تجاري", en: "Commercial registration", fr: "Registre de commerce", zh: "商业登记" }],
  ["vat",      { ar: "شهادة ضريبية", en: "VAT certificate", fr: "Certificat de TVA", zh: "增值税证书" }],
  ["contract", { ar: "عقد", en: "Contract", fr: "Contrat", zh: "合同" }],
  ["id",       { ar: "هوية / إقامة", en: "ID / Iqama", fr: "Pièce d'identité / Iqama", zh: "身份证 / 居留证" }],
  ["other",    { ar: "أخرى", en: "Other", fr: "Autre", zh: "其他" }],
];
const TYPES = { CONSULTATION: { ar: "استشارة", en: "Consultation", fr: "Consultation", zh: "咨询" }, GOVERNMENT_SERVICE: { ar: "خدمة حكومية", en: "Government service", fr: "Service gouvernemental", zh: "政府服务" }, COMPANY_FORMATION: { ar: "تأسيس شركة", en: "Company formation", fr: "Création d'entreprise", zh: "公司注册" }, BUSINESS_DEVELOPMENT: { ar: "تطوير الأعمال", en: "Business development", fr: "Développement commercial", zh: "业务拓展" } };

export function buildSimpleMy(sv1, ctx) {
  const l = ctx.lang();
  const tx = {}; for (const k of Object.keys(P)) tx[k] = P[k][l] != null ? P[k][l] : P[k].en;
  const st = {}; for (const k of Object.keys(STATUS)) st[k] = STATUS[k][l] || STATUS[k].en;
  const ty = {}; for (const k of Object.keys(TYPES)) ty[k] = TYPES[k][l] || TYPES[k].en;
  const cats = DOC_CATS.map(([code, n]) => [code, n[l] || n.en]);
  const home = sv1.href("/");
  const CSS = `<style>
.my{display:grid;grid-template-columns:240px 1fr;min-height:calc(100vh - 68px)}
.my-side{background:#fff;border-inline-end:1px solid var(--line);padding:16px 12px;position:sticky;top:68px;height:calc(100vh - 68px);overflow:auto}
.my-side a{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;font-weight:600;font-size:.92rem;color:#2c3550;cursor:pointer}
.my-side a.on{background:var(--n);color:#fff}
.my-side a .b{margin-inline-start:auto;background:#e11d48;color:#fff;font-size:.7rem;border-radius:999px;padding:2px 7px;font-weight:800}
.my-side a.on .b{background:#fff;color:var(--n)}
.my-side .who{padding:8px 12px 14px;border-bottom:1px solid var(--line);margin-bottom:8px}
.my-side .who b{display:block;color:var(--ink)}
.my-side .who small{color:var(--mut)}
.my-main{background:var(--g);padding:24px;min-width:0}
/* .sv1 a{color:inherit} outranks .btn, so a link-button drew navy text on its navy fill. */
.my a.btn:not(.ghost):not(.danger){color:#fff}
.toast{position:fixed;inset-inline:16px;bottom:88px;max-width:460px;margin-inline:auto;background:#b91c1c;color:#fff;border-radius:12px;padding:12px 16px;z-index:95;font-size:.9rem;box-shadow:0 8px 24px rgba(0,0,0,.2)}
.toast.good{background:#118657}
.my-main h1{margin:0 0 16px;color:var(--ink);font-size:1.45rem;font-weight:300}
.my-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:22px}
.my-kpi{background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px;cursor:pointer}
.my-kpi b{display:block;font-size:1.7rem;color:var(--ink);line-height:1.1;font-family:var(--fm);font-weight:500}
.my-kpi span{color:var(--mut);font-size:.82rem}
.my-kpi.hot{border-color:#f59e0b;background:#fffbeb}
.card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px;margin-bottom:14px}
.card h2,.card h3{margin:0 0 10px;color:var(--ink);font-size:1.05rem;font-weight:500}
.list{display:grid;grid-template-columns:minmax(0,1fr);gap:10px}
.row{display:flex;gap:12px;align-items:center;border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:#fff;cursor:pointer}
.row:hover{border-color:#b7c4e8}
.row .tt{flex:1;min-width:0}
.row .tt b{display:block;color:var(--ink);font-size:.95rem;font-weight:500}
.row .tt small{color:var(--mut);font-size:.78rem}
.pill{display:inline-block;border-radius:999px;padding:4px 10px;font-size:.74rem;font-weight:700;background:#eef2ff;color:#2b56c3;white-space:nowrap}
.pill.warn{background:#fff3e6;color:#b45309}.pill.ok{background:#eaf7ef;color:#118657}.pill.bad{background:#fee2e2;color:#b91c1c}.pill.mut{background:#eef0f5;color:#5f6880}
.grid2{display:grid;grid-template-columns:1.4fr 1fr;gap:14px;align-items:start}.grid2>*{min-width:0}.grid2 .note,.grid2 small{overflow-wrap:anywhere}
.msgs{display:flex;flex-direction:column;gap:8px;max-height:380px;overflow:auto;padding:4px}
.m{max-width:85%;padding:10px 13px;border-radius:14px;font-size:.92rem;line-height:1.7;white-space:pre-wrap}
.m.user{background:var(--n);color:#fff;align-self:flex-end}.m.assistant,.m.bp,.m.system{background:var(--g);align-self:flex-start}
.m small{display:block;opacity:.7;font-size:.7rem;margin-top:3px}
.msgform{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.msgform input,.inp{flex:1 1 150px;min-width:0;border:1px solid var(--line);border-radius:10px;padding:10px 12px;font:inherit;width:100%}
.cx-box textarea{display:block;width:100%;box-sizing:border-box;border:1px solid #b9c3dc;border-radius:10px;padding:11px 12px;font:inherit;background:#fff;color:#1F2430;margin-top:4px;resize:vertical}
.cx-box textarea:focus{outline:2px solid var(--n);outline-offset:1px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:9px 14px;border-radius:10px;font-weight:700;font-size:.88rem;border:1px solid var(--n);background:var(--n);color:#fff;cursor:pointer;line-height:1.2}
.btn.ghost{background:#fff;color:var(--ink)}.btn.danger{background:#fff;color:#b91c1c;border-color:#fecaca}.btn.sm{padding:6px 10px;font-size:.8rem}.btn[disabled]{opacity:.5}
.items{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.items li{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--line);border-radius:10px;padding:9px 12px}
.items li .ic{width:24px;height:24px;border-radius:7px;background:#eaf7ef;color:#118657;display:grid;place-items:center;font-weight:900;flex:none;font-size:.8rem}
.items li b[contenteditable]{outline:none;padding:1px 4px;border-radius:5px}.items li b[contenteditable]:focus{background:#fffbe6}
.items li small{display:block;color:var(--mut);font-size:.76rem}
.items li small.hold{color:#B45309;font-weight:700}
.holdbox{border:1px solid #f3d9a4;background:#fffaf0;border-radius:12px;padding:12px 14px}
.holdbox ul{margin:8px 0 0;padding:0;list-style:none;display:grid;gap:6px}
.holdbox li b{display:block}.holdbox li small{color:#92400e}
.items li .rm{border:0;background:transparent;color:#b91c1c;font-size:.76rem;font-weight:700;cursor:pointer;margin-inline-start:auto}
table.q{width:100%;border-collapse:collapse;font-size:.9rem}
table.q th,table.q td{padding:8px 6px;border-bottom:1px solid var(--line);text-align:start}
table.q tfoot td{font-weight:700}
.tl{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.prog ol{list-style:none;margin:6px 0 0;padding:0;display:flex}
.prog li{flex:1 1 0;min-width:0;position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:0 4px}
.prog li::before{content:"";position:absolute;top:14px;inset-inline-start:-50%;width:100%;height:2px;background:var(--line)}
.prog li:first-child::before{display:none}
.prog li.done::before,.prog li.active::before{background:#118657}
.prog .dot{position:relative;z-index:1;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font-size:.82rem;font-weight:800;background:#fff;border:2px solid var(--line);color:var(--mut)}
.prog li.done .dot{background:#118657;border-color:#118657;color:#fff}
.prog li.active .dot{background:var(--n);border-color:var(--n);color:#fff;box-shadow:0 0 0 4px #e3e9fb}
.prog .lb{display:grid;gap:2px;min-width:0}
.prog .lb b{font-size:.88rem;font-weight:600;color:var(--ink);overflow-wrap:anywhere}
.prog .lb small{font-size:.74rem;color:var(--mut)}
.prog li.active .lb small:first-of-type{color:var(--n);font-weight:700}
.prog li.done .lb small:first-of-type{color:#118657}
.prog .lb small.sn{font-size:.76rem;color:var(--ink);background:var(--g);border-radius:8px;padding:3px 8px;overflow-wrap:anywhere}
.upl li{align-items:flex-start}
.upl li span{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.7}
@media(max-width:640px){.prog ol{flex-direction:column;gap:14px}.prog li{flex-direction:row;align-items:flex-start;text-align:start;gap:12px;padding:0}.prog li::before{top:-14px;height:14px;width:2px;inset-inline-start:14px}}
.tl li{display:flex;gap:10px;font-size:.84rem}
.tl li time{color:var(--mut);white-space:nowrap;font-size:.76rem;min-width:110px}
.tl li i{font-style:normal;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:.7rem;flex:none;background:#eef2ff}
.tl li i.ai{background:#efe7ff}.tl li i.human{background:#e6f4ea}.tl li i.customer{background:#eef2ff}.tl li i.system{background:#fff3e6}
.stat{display:flex;flex-wrap:wrap;gap:8px 16px;font-size:.86rem;color:var(--mut);margin-bottom:12px}
.stat b{color:var(--ink)}
.contract-frame{display:block;width:100%;height:420px;border:1px solid var(--line);border-radius:12px;background:#fff}
.doc-open{display:inline-flex;align-items:center;gap:6px;margin-top:10px}
.docovl{position:fixed;inset:0;z-index:90;background:rgba(12,18,40,.55);display:flex;flex-direction:column}
.docovl-bar{flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:10px 16px;background:var(--n2,#081345);color:#fff}
.docovl-bar b{font-size:.95rem;font-weight:600}
.docovl-bar .acts{display:flex;gap:8px}
.docovl-bar button{border:1px solid rgba(255,255,255,.28);background:transparent;color:#fff;
  border-radius:8px;padding:8px 14px;font:inherit;font-size:.82rem;cursor:pointer}
.docovl-bar button:hover{background:rgba(255,255,255,.12)}
.docovl-bar button.p{background:#fff;color:#0B1B5A;border-color:#fff;font-weight:600}
.docovl iframe{flex:1;width:100%;border:0;background:#fff}
@media print{body>*:not(.docovl){display:none!important}
  .docovl{position:static;background:#fff} .docovl-bar{display:none}}
canvas.sig{border:1px dashed #c7cfe2;border-radius:10px;background:#fff;width:100%;height:150px;touch-action:none}
.note{font-size:.82rem;color:var(--mut)}
/* the cancel sheet: ours, not window.confirm, so it also works where a native dialog is blocked */
.cx-ovl{position:fixed;inset:0;z-index:95;background:rgba(12,18,40,.55);display:flex;align-items:center;justify-content:center;padding:16px}
.cx-box{background:#fff;border-radius:18px;max-width:460px;width:100%;padding:22px;box-shadow:0 24px 60px rgba(12,18,40,.35);max-height:calc(100vh - 32px);overflow:auto}
.cx-box h3{margin:0 0 8px;color:var(--ink);font-size:1.1rem;font-weight:600}
.cx-box p{margin:0 0 10px;font-size:.9rem;line-height:1.8;color:#3b4561}
.cx-box input{display:block;width:100%;box-sizing:border-box;border:1px solid #b9c3dc;border-radius:10px;padding:11px 12px;font:inherit;background:#fff;color:#1F2430;margin-top:4px}
.cx-box input:focus{outline:2px solid var(--n);outline-offset:1px}
.cx-box .acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.cx-box .acts .btn{flex:1;min-width:140px;padding:11px 14px}
.btn.solid-danger{background:#b91c1c;border-color:#b91c1c;color:#fff}
/* the sheet is appended to <body>, outside .my, so it has no --n: say the colour outright */
.cx-box .btn:not(.ghost):not(.solid-danger){background:#0B1B5A;border-color:#0B1B5A;color:#fff}
.cx-box .btn.ghost{color:#0B1B5A;border-color:#b9c3dc}
/* D11: the floating «إتاحة» and «تواصل معنا» buttons sit above everything (z-index 2147483000) and
   covered the signature lines of a full-size contract and the sheet's buttons — they step aside while one is open. */
body:has(.docovl) .bps-fab,body:has(.docovl) .bpa-fab,body:has(.docovl) .sv1-wa-fab,body:has(.cx-ovl) .bps-fab,body:has(.cx-ovl) .bpa-fab,body:has(.cx-ovl) .sv1-wa-fab{display:none!important}
.cx-state{border-radius:16px;padding:16px 18px;margin-bottom:14px;border:1px solid}
.cx-state h3{margin:0 0 6px;font-size:1.02rem;font-weight:600}
.cx-state p{margin:0;font-size:.88rem;line-height:1.8}
.cx-state.done{background:#fef2f2;border-color:#fecaca;color:#7f1d1d}
.cx-state.pend{background:#fff7ed;border-color:#fed7aa;color:#7c2d12}
.cx-state .btn{margin-top:10px}
.stat .cxbtn{margin-inline-start:auto}
.ok{color:#118657;font-weight:700}.err{color:#b91c1c;font-size:.84rem}
.login{max-width:440px;margin:60px auto;background:#fff;border:1px solid var(--line);border-radius:18px;padding:26px}
.login .alt{margin-top:12px;display:flex;gap:14px;flex-wrap:wrap}
.login .lnk{color:var(--navy);text-decoration:underline;cursor:pointer;font-size:13px}
.login .btn{width:100%}.login .btn.sm{width:auto}.login .note{margin:12px 0 8px}.login .sent{color:var(--ink);font-size:.92rem;line-height:1.8;margin:0 0 4px}.login .alt{justify-content:space-between}
${CLIENT_LOGIN_CSS}
.login .seg{display:flex;gap:4px;padding:3px;margin:0 0 10px;border-radius:12px;background:var(--soft,#F5F7FB);border:1px solid var(--line)}
.login .segb{flex:1;min-height:38px;border:0;border-radius:9px;background:transparent;font:inherit;font-size:.84rem;font-weight:700;color:var(--mut);cursor:pointer;padding:0 6px}
.login .segb.on{background:#fff;color:var(--ink);box-shadow:0 1px 3px rgba(11,27,90,.12)}
.login .segb[hidden]{display:none}
.login .rule{margin:0 0 8px;font-size:.8rem}.login .rule.bad{color:#b91c1c}.login .rule.good{color:var(--ok,#047857)}
.login .cstep{display:inline-block;margin:0 0 8px;padding:3px 10px;border-radius:999px;background:var(--acSoft,#EEF2FB);color:var(--ink);font-size:.76rem;font-weight:700}
.login label{display:block;margin:6px 0 4px;font-size:.84rem;font-weight:600;color:var(--ink)}
@media(max-width:520px){.login{margin:18px 12px;padding:18px}}
.login h1{margin:0 0 6px;color:var(--ink);font-size:1.35rem;font-weight:400}
.login p{color:var(--mut);margin:0 0 14px;font-size:.9rem}
.login input{width:100%;border:1px solid var(--line);border-radius:10px;padding:11px 12px;font:inherit;margin-bottom:8px}
.form{display:grid;gap:8px;max-width:520px}
.form label{font-size:.82rem;color:var(--mut)}
/* خزانة المستندات — منطقة إفلات واحدة، ثم بطاقة لكل مستند. */
.dz{border:2px dashed #c7cfe2;border-radius:16px;background:#fff;padding:26px 18px;text-align:center;cursor:pointer;transition:border-color .15s,background .15s}
.dz:hover,.dz.over{border-color:var(--n);background:#f7f9ff}
.dz:focus-visible{outline:2px solid var(--n);outline-offset:2px}
.dz .ico{font-size:1.7rem;display:block;margin-bottom:6px;line-height:1}
.dz b{display:block;color:var(--ink);font-weight:500;font-size:.97rem}
.dz small{color:var(--mut);font-size:.8rem}
.dfile{display:flex;align-items:center;gap:10px;border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:#fff;margin-top:12px}
select.inp{background:#fff;color:inherit}
.dgrid label{display:block;margin-bottom:4px}
.dfile .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.88rem;color:var(--ink)}
.dfile .sz{color:var(--mut);font-size:.78rem;white-space:nowrap;font-family:var(--fm)}
.bar{height:6px;border-radius:999px;background:#eef0f5;overflow:hidden;margin-top:10px}
.bar i{display:block;height:100%;background:var(--n);width:0;transition:width .18s}
.bar.bad i{background:#b91c1c}
.dgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.doc{border:1px solid var(--line);border-radius:14px;padding:13px 15px;background:#fff}
.doc.soon{border-color:#f59e0b;background:#fffbeb}
.doc.gone{border-color:#fecaca;background:#fff5f5}
.doc .hd{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.doc .hd b{color:var(--ink);font-size:.95rem;font-weight:500}
.doc .meta{color:var(--mut);font-size:.78rem;margin-top:5px}
.doc .read{font-size:.78rem;color:var(--mut);margin-top:6px;line-height:1.9}
.doc .acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
@media(max-width:620px){.tl li{flex-wrap:wrap;gap:2px 10px}.tl li time{min-width:0;flex:1 1 100%}.tl li span{flex:1 1 0;min-width:0;overflow-wrap:anywhere}.my-main{padding:16px 14px 120px}.msgform .btn{flex:1 1 auto}.dgrid{grid-template-columns:1fr}.row{flex-wrap:wrap}.row .tt{flex:1 1 100%}.items li{flex-wrap:wrap}.items li>div{flex:1 1 140px;min-width:0}.items li .btn{max-width:100%;white-space:normal;text-align:start}}
.mob{display:none}
@media(max-width:900px){.my{grid-template-columns:minmax(0,1fr)}.my-side{position:static;height:auto;display:none}.my-side.open{display:block}.mob{display:flex;gap:6px;overflow:auto;padding:10px 12px;background:#fff;border-bottom:1px solid var(--line)}.mob a{white-space:nowrap;padding:7px 11px;border-radius:999px;border:1px solid var(--line);font-size:.82rem;font-weight:700;color:#2c3550}.mob a.on{background:var(--n);color:#fff;border-color:var(--n)}.my-kpis{grid-template-columns:1fr 1fr}.grid2{grid-template-columns:minmax(0,1fr)}.my-main{padding:14px}}
</style>`;
  const body = `
${sv1.header("/my", { cta: false })}
<div id="app"></div>
${sv1.footer()}`;
  const script = clientLoginScript(l) + `<script>
(function(){
var LANG=${JSON.stringify(l)},EV=${JSON.stringify(EVENTS[l === "ar" ? "ar" : "en"])},TX=${JSON.stringify(tx)},ST=${JSON.stringify(st)},TY=${JSON.stringify(ty)},HOME=${JSON.stringify(home)},CHECKOUT=${JSON.stringify(sv1.href("/checkout"))},SELLER=${JSON.stringify(sellerFromSite())};
var app=document.getElementById('app'),state={me:null,view:'home',ref:null,req:null,testMode:false,contractHtml:'',docs:null,violations:null};
var $=function(s,r){return (r||document).querySelector(s)};
function h(tag,attrs,kids){var e=document.createElement(tag);if(attrs)for(var k in attrs){if(k==='class')e.className=attrs[k];else if(k==='html')e.innerHTML=attrs[k];else if(k.indexOf('on')===0)e.addEventListener(k.slice(2),attrs[k]);else if(attrs[k]!=null)e.setAttribute(k,attrs[k])}(kids||[]).forEach(function(c){if(c==null)return;e.appendChild(typeof c==='string'?document.createTextNode(c):c)});return e}
function api(action,data){return fetch('/api/simple',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({action:action},data||{}))}).then(function(r){return r.json()}).catch(function(){return {ok:false,error:'network'}}).then(function(o){if(o&&o.error==='no_session'&&state.me)sessionEnded();return o})}
// A session that ends mid-visit used to leave every button doing nothing. Say so, and show the door.
function sessionEnded(){state.me=null;try{localStorage.removeItem('bp_session')}catch(x){}renderLogin(TX.sessEnd)}
// A failed action is never silent: the customer is told, in their language, and the page stays as it was.
function holdWhy(h){return h?(TX['hold_'+h.reason]||h.reason_ar||''):''}
function toast(msg,ok){var t=h('div',{class:'toast'+(ok?' good':''),role:'alert'},[msg]);document.body.appendChild(t);setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t)},5000)}
function failText(o){return (o&&o.error==='network')?TX.eNet:TX.error}
function provName(p){p=String(p||'').toLowerCase();return p==='card'||p==='moyasar'||p==='mada'?TX.provCard:p==='tamara'?TX.provTamara:(p==='bank'||p==='bank_transfer')?TX.provBank:p}
function actorName(e){if(LANG==='ar'||!e.actor)return e.actor||'';return e.actor_kind==='ai'?TX.actAi:e.actor_kind==='system'?TX.actSys:e.actor_kind==='human'?TX.actTeam:e.actor}
function otp(data){return fetch('/api/otp',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(data)}).then(function(r){return r.json()})}
// A quotation line may predate the server-side line field (older rows, and
// anything imported by hand). Falling back to qty x price keeps an invoice
// from printing 0 for a line that was really charged.
// Mirrors the server: a machine block must never surface in a chat bubble,
// even when the model forgot to close it.
function stripScope(t){return String(t==null?'':t).replace(/<*\\s*SCOPE\\s*>>[\\s\\S]*?(?:<*\\s*END\\s*>>|$)/gi,'').replace(/<*\\s*(?:SCOPE|END)\\s*>>/gi,'').trim()}
function lineOf(i){var l=Number(i&&i.line);if(isFinite(l)&&l>0)return l;return Math.round((Number((i&&i.qty)||1)*Number((i&&i.price)||0))*100)/100}
function money(n){return (Math.round(Number(n||0)*100)/100).toLocaleString(LANG==='ar'?'ar-SA-u-nu-latn':'en-US')+' '+(LANG==='ar'?'ر.س':'SAR')}
function when(s){if(!s)return '';try{return new Date(s).toLocaleString(LANG==='ar'?'ar-SA-u-ca-gregory-nu-latn':LANG==='zh'?'zh-CN':LANG,{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Riyadh'})}catch(e){return s}}
function pillClass(s){if(s==='BANK_REVIEW')return '';return ['QUOTE_SENT','CONTRACT_SENT','SIGNED','PAYMENT_PENDING','WAITING_CLIENT'].indexOf(s)>=0?'warn':['PAID','COMPLETED','QUOTE_APPROVED'].indexOf(s)>=0?'ok':s==='CANCELLED'?'bad':['IN_PROGRESS','WAITING_INTERNAL'].indexOf(s)>=0?'':'mut'}
// Enter does the one obvious thing in a single-field form; without it the phone keyboard's «Go» key did nothing.
function onEnter(inp,btn){inp.addEventListener('keydown',function(ev){if(ev.key==='Enter'&&!ev.isComposing){ev.preventDefault();btn.click()}})}
function pill(s){return h('span',{class:'pill '+pillClass(s)},[ST[s]||s])}
// حوالة رُفع إيصالها وتنتظر التحقق (يضع الخادم payment.review): ليست «بانتظار الدفع» ولا مستحقة ولا عليها زرُّ دفعٍ جديد.
function payReview(r){return !!(r&&r.payment&&r.payment.review)}
function statusOf(r){return payReview(r)&&r.status==='PAYMENT_PENDING'?'BANK_REVIEW':r.status}
// مبلغ الطلب: إجمالي عرض السعر إن وُجد، وإلا ما سُجّل على الدفعة (طلب السلة لا عرض سعر له ومبلغه الحقيقي في payment.amount).
function payAmt(r){var q=Number(r&&r.quote&&r.quote.total),p=Number(r&&r.payment&&r.payment.amount);return q>0?q:(p>0?p:0)}
function go(view,ref){state.view=view;state.ref=ref||null;var u=new URL(location.href);u.searchParams.set('view',view);if(ref)u.searchParams.set('ref',ref);else u.searchParams.delete('ref');history.replaceState(null,'',u.toString());render()}
// ---------- login
// One page, one decision. Google first (the official button, with a written
// failure state instead of vanishing), then an e-mailed link that carries its own
// code as a fallback, then — small and last — the password for those who set one.
// Every success path keeps the literal «localStorage…boot()» sequence: the build
// step sv1-quote-auth-flow.mjs rewrites it into a full navigation so the browser
// commits the session cookie before the portal asks for the account.
function hashParam(k){try{var m=String(location.hash||'').replace('#','').split('&');for(var i=0;i<m.length;i++){var p=m[i].split('=');if(p[0]===k)return decodeURIComponent(p.slice(1).join('='))}}catch(e){}return ''}
function noHash(){try{history.replaceState(null,'',location.pathname+location.search)}catch(x){}}
function renderLogin(note){app.innerHTML='';var email='',challenge='',wait=0,timer=null,pwChallenge='',pwEmail='';var box=h('div',{class:'login'});var errEl=h('div',{class:'err',role:'alert'});
function fail(m){errEl.textContent=m||TX.loginErr}
// 1 · Nafath — the first and largest door. A first sign-in creates the account;
// the next screen (renderContact) asks for the e-mail and mobile once.
var nslot=h('div',{id:'bpNafath'});
// 2 · Google — the official button, with a written failure state.
var gslot=h('div',{id:'bpGoogleBtn'});
var orA=h('div',{class:'bpg-or'},[(window.SV1Login&&window.SV1Login.orPlain)||'']);
var orB=h('div',{class:'bpg-or'},[(window.SV1Login&&window.SV1Login.or)||'']);
// 3 · E-mail: password (sign in / new account) or an e-mailed link and code.
var e1=h('input',{type:'email',placeholder:TX.email,autocomplete:'email',inputmode:'email','aria-label':TX.email});
var tabs=h('div',{class:'seg',role:'tablist'});var panels={};
function tab(id,label){var a=h('button',{type:'button',role:'tab',class:'segb',onclick:function(){pick(id)}},[label]);a.setAttribute('data-tab',id);tabs.appendChild(a);return a}
var tPw=tab('login',TX.tabPw),tNew=tab('signup',TX.tabNew),tLink=tab('link',TX.tabLink);
function pick(id){errEl.textContent='';[tPw,tNew,tLink].forEach(function(b){b.className='segb'+(b.getAttribute('data-tab')===id?' on':'');b.setAttribute('aria-selected',b.getAttribute('data-tab')===id?'true':'false')});for(var k in panels)panels[k].hidden=(k!==id)}
// -- password sign-in
var e3=h('input',{type:'password',placeholder:TX.password,autocomplete:'current-password','aria-label':TX.password});
var b3=h('button',{class:'btn',onclick:function(){errEl.textContent='';if(e1.value.indexOf('@')<1){fail(TX.badEmail);return}b3.disabled=true;otp({action:'password-login',email:e1.value.trim().toLowerCase(),password:e3.value}).then(function(o){b3.disabled=false;if(!o||!o.ok){fail(o&&o.error==='too_many'?TX.tooMany:o&&o.error==='bad_credentials'?TX.badCreds:TX.loginErr);return}try{localStorage.setItem('bp_session','1')}catch(x){}boot()}).catch(function(){b3.disabled=false;fail(TX.loginErr)})}},[TX.loginPw]);
var forgot=h('a',{class:'lnk',onclick:function(){pick('link')}},[TX.forgot]);
panels.login=h('div',{},[e3,b3,h('div',{class:'alt'},[forgot])]);
onEnter(e3,b3);
// -- new account: the password only counts once the mailbox is proven
function pwWhy(p,e){if(p.length<8)return 'short';if(p.length>128)return 'long';var L=false,D=false,i,c,seen={},n=0;for(i=0;i<p.length;i++){c=p.charCodeAt(i);if((c>=48&&c<=57)||(c>=1632&&c<=1641))D=true;else if((c>=65&&c<=90)||(c>=97&&c<=122)||c>=192)L=true;if(!seen[c]){seen[c]=1;n++}}
 if(!L)return 'no_letter';if(!D)return 'no_digit';if(n<4)return 'repetitive';var lp=String(e||'').split('@')[0].toLowerCase();if(lp.length>=4&&p.toLowerCase().indexOf(lp)>=0)return 'has_email';return ''}
var npw=h('input',{type:'password',placeholder:TX.pwNew,autocomplete:'new-password','aria-label':TX.pwNew});
var npw2=h('input',{type:'password',placeholder:TX.pwConfirm,autocomplete:'new-password','aria-label':TX.pwConfirm});
var rule=h('p',{class:'note rule'},[TX.pwRule]);
npw.addEventListener('input',function(){var w=pwWhy(npw.value,e1.value);rule.className='note rule'+(npw.value&&w?' bad':npw.value?' good':'');rule.textContent=npw.value&&w?(TX['pwr_'+w]||TX.pwRule):TX.pwRule});
var bNew=h('button',{class:'btn',onclick:function(){errEl.textContent='';var e=e1.value.trim().toLowerCase();if(e.indexOf('@')<1||e.indexOf('.')<0){fail(TX.badEmail);return}var w=pwWhy(npw.value,e);if(w){fail(TX['pwr_'+w]);return}if(npw.value!==npw2.value){fail(TX.pwMismatch);return}
 bNew.disabled=true;otp({action:'password-signup-start',email:e,password:npw.value}).then(function(o){bNew.disabled=false;if(!o||!o.ok){fail(o&&o.error==='weak'?(TX['pwr_'+o.reason]||TX.pwRule):o&&o.error==='too_many'?TX.tooMany:(o&&o.message)||TX.loginErr);return}pwChallenge=o.challenge;pwEmail=e;nSent.textContent=TX.codeSent.replace('{e}',e);if(o.testLogin)nCode.placeholder='TEST: 123456';nStep1.hidden=true;nStep2.hidden=false;nCode.focus()}).catch(function(){bNew.disabled=false;fail(TX.loginErr)})}},[TX.signupGo]);
var nStep1=h('div',{},[npw,npw2,rule,h('p',{class:'note'},[TX.signupNote]),bNew]);
var nSent=h('p',{class:'sent'});var nCode=h('input',{inputmode:'numeric',maxlength:'6',placeholder:TX.code,autocomplete:'one-time-code','aria-label':TX.code});
var bNC=h('button',{class:'btn',onclick:function(){errEl.textContent='';bNC.disabled=true;otp({action:'password-signup-verify',email:pwEmail,code:nCode.value.trim(),challenge:pwChallenge}).then(function(o){bNC.disabled=false;if(!o||!o.ok){fail(o&&o.error==='too_many'?TX.tooMany:o&&o.error==='expired'?TX.codeOld:TX.codeErr);return}try{localStorage.setItem('bp_session','1')}catch(x){}boot()}).catch(function(){bNC.disabled=false;fail(TX.codeErr)})}},[TX.confirmGo]);
var nBack=h('a',{class:'lnk',onclick:function(){nStep2.hidden=true;nStep1.hidden=false;errEl.textContent=''}},[TX.changeEmail]);
var nStep2=h('div',{hidden:''},[nSent,nCode,bNC,h('div',{class:'alt'},[nBack])]);
onEnter(nCode,bNC);
panels.signup=h('div',{hidden:''},[nStep1,nStep2]);
// -- e-mailed link (with its own code as a fallback in the same message)
var b1=h('button',{class:'btn',onclick:function(){sendLink()}},[TX.sendLink]);
var s1=h('div',{},[b1]);
var sentMsg=h('p',{class:'sent'}),dev=h('div',{});
var e2=h('input',{inputmode:'numeric',maxlength:'6',placeholder:TX.code,autocomplete:'one-time-code','aria-label':TX.code});
var b2=h('button',{class:'btn',onclick:function(){b2.disabled=true;errEl.textContent='';otp({action:'verify',email:email,code:e2.value.trim(),challenge:challenge}).then(function(o){b2.disabled=false;if(!o||!o.ok){fail(o&&o.error==='too_many'?TX.tooMany:TX.codeErr);return}try{localStorage.setItem('bp_session','1')}catch(x){}boot()}).catch(function(){b2.disabled=false;fail(TX.codeErr)})}},[TX.verify]);
var resend=h('a',{class:'lnk',onclick:function(){if(wait>0)return;sendLink()}},[TX.resend]);
var change=h('a',{class:'lnk',onclick:function(){s2.hidden=true;s1.hidden=false;errEl.textContent='';e1.focus()}},[TX.changeEmail]);
var s2=h('div',{hidden:''},[sentMsg,dev,h('p',{class:'note'},[TX.orCode]),e2,b2,h('div',{class:'alt'},[resend,change])]);
function cool(){wait=30;resend.textContent=TX.resendIn.replace('{n}',wait);clearInterval(timer);timer=setInterval(function(){wait--;if(wait<=0){clearInterval(timer);resend.textContent=TX.resend}else resend.textContent=TX.resendIn.replace('{n}',wait)},1000)}
function sendLink(){email=e1.value.trim().toLowerCase();errEl.textContent='';if(email.indexOf('@')<1||email.indexOf('.')<0){fail(TX.badEmail);return}b1.disabled=true;
otp({action:'link-start',email:email,lang:LANG,next:nextPath()}).then(function(o){b1.disabled=false;if(!o||!o.ok){fail(o&&o.error==='too_many'?TX.tooMany:(o&&o.message)||TX.loginErr);return}challenge=o.challenge;sentMsg.textContent=TX.linkSent.replace('{e}',email);if(o.testLogin)e2.placeholder='TEST: 123456';dev.innerHTML='';if(o.devLink)dev.appendChild(h('a',{class:'btn ghost sm',href:o.devLink,id:'devLink'},['DEV · '+TX.openLink]));s1.hidden=true;s2.hidden=false;e2.focus();cool()}).catch(function(){b1.disabled=false;fail(TX.loginErr)})}
e1.addEventListener('keydown',function(ev){if(ev.key==='Enter'&&!ev.isComposing){var on=document.querySelector('.login .segb.on');var t=on&&on.getAttribute('data-tab');ev.preventDefault();if(t==='link')sendLink();else if(t==='login')b3.click()}});
e2.addEventListener('keydown',function(ev){if(ev.key==='Enter')b2.click()});
panels.link=h('div',{hidden:''},[s1,s2]);
var mail=h('div',{class:'mailbox'},[tabs,e1,panels.login,panels.signup,panels.link]);
box.appendChild(h('h1',{},[TX.loginTitle]));box.appendChild(h('p',{},[TX.loginText]));if(note)box.appendChild(h('p',{class:'err'},[note]));
box.appendChild(nslot);box.appendChild(orA);box.appendChild(gslot);box.appendChild(orB);box.appendChild(mail);box.appendChild(errEl);app.appendChild(box);pick('login');
otp({action:'methods'}).then(function(m){if(m&&m.ok&&!m.password){tPw.hidden=true;tNew.hidden=true;pick('link')}else if(m&&m.ok&&!m.passwordSignup){tNew.hidden=true}}).catch(function(){});
if(window.SV1Login){window.SV1Login.mountNafath(nslot,{purpose:'portal',onSuccess:function(){try{localStorage.setItem('bp_session','1')}catch(x){}boot()}});
 window.SV1Login.mountGoogle(gslot,{onSuccess:function(){try{localStorage.setItem('bp_session','1')}catch(x){}boot()},onError:function(msg){errEl.textContent=msg},onHide:function(){orB.style.display='none'}})}else{orA.style.display='none';orB.style.display='none'}}
// The one-time step after a first Nafath sign-in: the account exists (keyed by the
// national-id digest, never the number); this asks for the real e-mail and mobile.
// The e-mail is proven with a code. If it already has an account, the two are joined.
function renderContact(){app.innerHTML='';var box=h('div',{class:'login'});var errEl=h('div',{class:'err',role:'alert'});var chal='',sentTo='';
function fail(m){errEl.textContent=m||TX.error}
var ce=h('input',{type:'email',placeholder:TX.email,autocomplete:'email',inputmode:'email','aria-label':TX.email});
var cp=h('input',{type:'tel',placeholder:TX.cPhonePh,autocomplete:'tel',inputmode:'tel','aria-label':TX.cPhone,dir:'ltr'});
function phoneOk(v){var d='',i,c;v=String(v||'');for(i=0;i<v.length;i++){c=v.charCodeAt(i);if(c>=48&&c<=57)d+=v.charAt(i);else if(c>=1632&&c<=1641)d+=String(c-1632);else if(c>=1776&&c<=1785)d+=String(c-1776)}return d.length>=8&&d.length<=15}
var b1=h('button',{class:'btn',onclick:function(){errEl.textContent='';var e=ce.value.trim().toLowerCase();if(e.indexOf('@')<1||e.indexOf('.')<0){fail(TX.badEmail);return}if(!phoneOk(cp.value)){fail(TX.cBadPhone);return}b1.disabled=true;
 otp({action:'nafath-contact-start',email:e,phone:cp.value}).then(function(o){b1.disabled=false;if(!o||!o.ok){fail(o&&o.error==='invalid_phone'?TX.cBadPhone:o&&o.error==='invalid_email'?TX.badEmail:o&&o.error==='too_many'?TX.tooMany:TX.loginErr);return}chal=o.challenge;sentTo=e;sent.textContent=TX.codeSent.replace('{e}',e);if(o.testLogin)code.placeholder='TEST: 123456';s1.hidden=true;s2.hidden=false;code.focus()}).catch(function(){b1.disabled=false;fail(TX.loginErr)})}},[TX.cSend]);
var s1=h('div',{},[h('label',{},[TX.email]),ce,h('label',{},[TX.cPhone]),cp,b1]);
var sent=h('p',{class:'sent'});var code=h('input',{inputmode:'numeric',maxlength:'6',placeholder:TX.code,autocomplete:'one-time-code','aria-label':TX.code});
var b2=h('button',{class:'btn',onclick:function(){errEl.textContent='';b2.disabled=true;otp({action:'nafath-contact-verify',code:code.value.trim(),challenge:chal}).then(function(o){b2.disabled=false;if(!o||!o.ok){fail(o&&o.error==='too_many'?TX.tooMany:o&&o.error==='expired'?TX.codeOld:o&&o.error==='identity_mismatch'?TX.cMismatch:o&&o.error==='wrong_code'?TX.codeErr:TX.error);return}try{localStorage.setItem('bp_session','1')}catch(x){}boot()}).catch(function(){b2.disabled=false;fail(TX.error)})}},[TX.confirmGo]);
var back=h('a',{class:'lnk',onclick:function(){s2.hidden=true;s1.hidden=false;errEl.textContent=''}},[TX.changeEmail]);
var out=h('a',{class:'lnk',onclick:function(){otp({action:'logout'}).then(function(){try{localStorage.removeItem('bp_session')}catch(x){}location.href=HOME})}},[TX.logout]);
var s2=h('div',{hidden:''},[sent,code,b2,h('div',{class:'alt'},[back])]);
onEnter(code,b2);
box.appendChild(h('div',{class:'cstep'},[TX.cStep]));box.appendChild(h('h1',{},[TX.cTitle]));box.appendChild(h('p',{},[TX.cText]));box.appendChild(s1);box.appendChild(s2);box.appendChild(h('div',{class:'alt'},[out]));box.appendChild(errEl);app.appendChild(box)}
// The page a sign-in link lands on. Opening the link signs nobody in: mail
// scanners open every URL they find, so only this button (a POST) spends it.
function renderLinkConfirm(token){app.innerHTML='';var box=h('div',{class:'login'});var errEl=h('div',{class:'err',role:'alert'});
var back=h('a',{class:'lnk',hidden:'',onclick:function(){noHash();renderLogin()}},[TX.linkNew]);
var go1=h('button',{class:'btn',id:'linkGo',onclick:function(){go1.disabled=true;errEl.textContent='';otp({action:'link-verify',token:token}).then(function(o){if(o&&o.ok&&o.db!==false){noHash();try{if(pendingQuote())sessionStorage.setItem('sv1_link_resume','1')}catch(x){}try{localStorage.setItem('bp_session','1')}catch(x){}boot();return}go1.disabled=false;errEl.textContent=TX.linkBad;back.hidden=false}).catch(function(){go1.disabled=false;errEl.textContent=TX.loginErr})}},[TX.linkGo]);
box.appendChild(h('h1',{},[TX.linkTitle]));box.appendChild(h('p',{},[TX.linkText]));if(pendingQuote())box.appendChild(h('p',{class:'ok',id:'resumeNote'},[TX.resumeNote]));box.appendChild(go1);box.appendChild(h('div',{class:'alt'},[back]));box.appendChild(errEl);app.appendChild(box)}
window.addEventListener('hashchange',function(){if(hashParam('ml'))boot()});
// ---------- shell
var NAV=[['home',TX.navHome,'🏠'],['new',TX.navNew,'➕'],['requests',TX.navRequests,'📋'],['quotes',TX.navQuotes,'🧾'],['contracts',TX.navContracts,'📝'],['appointments',TX.navAppts,'📅'],['pay',TX.navPay,'💳'],['invoices',TX.navInvoices,'🧮'],['chats',TX.navChats,'💬'],['documents',TX.navDocs,'\ud83d\udcc1'],['compliance',TX.navCompliance,'🛡️'],['company',TX.navCompany,'🏢']];
function badges(){var c=state.me.counts||{};var d=(state.docs||[]).filter(function(x){var n=daysLeft(x.expiry_date);return n!==null&&n<=30}).length;return {quotes:c.quotes,contracts:c.contracts,pay:c.payments,documents:d,compliance:(state.violations||[]).filter(isActionableViol).length}}
function render(){var me=state.me;app.innerHTML='';joinBoxes=[];var bd=badges();
var side=h('nav',{class:'my-side',id:'mySide'},[h('div',{class:'who'},[h('b',{},[me.user.name||me.user.email]),h('small',{},[(me.organization&&(me.organization.name_ar||me.organization.name_en))||me.user.email])])].concat(NAV.map(function(n){return h('a',{'data-nav':n[0],class:state.view===n[0]?'on':'',onclick:function(){go(n[0])}},[n[2]+' '+n[1],bd[n[0]]?h('span',{class:'b'},[String(bd[n[0]])]):null])})).concat([h('a',{href:HOME},['🌐 '+TX.site]),h('a',{onclick:function(){otp({action:'logout'}).then(function(){try{localStorage.removeItem('bp_session')}catch(x){}location.href=HOME})}},['↩ '+TX.logout])]));
var mob=h('div',{class:'mob'},NAV.map(function(n){return h('a',{class:state.view===n[0]?'on':'',onclick:function(){go(n[0])}},[n[2]+' '+n[1]])}));
var main=h('div',{class:'my-main',id:'myMain'});
app.appendChild(mob);var wrap=h('div',{class:'my'},[side,main]);app.appendChild(wrap);
var v=state.view;if(v==='home')viewHome(main);else if(v==='new')viewNew(main);else if(v==='request')viewRequest(main);else if(v==='requests')viewList(main,TX.navRequests,function(r){return true});else if(v==='quotes')viewList(main,TX.navQuotes,function(r){return !!r.quote});else if(v==='contracts')viewList(main,TX.navContracts,function(r){return !!(r.contract||r.nda)});else if(v==='appointments')viewAppts(main);else if(v==='pay')viewPay(main);else if(v==='invoices')viewInvoices(main);else if(v==='chats')viewChats(main);else if(v==='documents')viewDocuments(main);else if(v==='compliance')viewCompliance(main);else if(v==='company')viewCompany(main);else viewHome(main)}
function reqRow(r){return h('div',{class:'row',onclick:function(){go('request',r.ref)}},[h('div',{class:'tt'},[h('b',{},[r.title]),h('small',{},[r.ref+' · '+(r.origin==='ticket'?TX.ticket:(TY[r.type]||r.type))+' · '+when(r.updated_at||r.created_at)])]),(r.origin==='cart'?h('span',{class:'pill mut'},[TX.direct]):null),pill(statusOf(r)),(r.cancel_requested&&r.status!=='CANCELLED')?h('span',{class:'pill warn'},[TX.cxPill]):null,h('span',{class:'btn ghost sm'},[TX.open])])}
function viewHome(m){var c=state.me.counts||{};m.appendChild(h('h1',{},[TX.attention]));
var k=[['active',TX.kActive,'requests'],['quotes',TX.kQuotes,'quotes'],['contracts',TX.kContracts,'contracts'],['payments',TX.kPayments,'pay'],['appointments',TX.kAppts,'appointments']];
m.appendChild(h('div',{class:'my-kpis'},k.map(function(x){return h('div',{class:'my-kpi'+(x[0]!=='active'&&c[x[0]]?' hot':''),onclick:function(){go(x[2])}},[h('b',{},[String(c[x[0]]||0)]),h('span',{},[x[1]])])})));
var nca=nextApptCard();if(nca)m.appendChild(nca);
var need=state.me.requests.filter(function(r){return !payReview(r)&&['QUOTE_SENT','CONTRACT_SENT','SIGNED','PAYMENT_PENDING','WAITING_CLIENT'].indexOf(r.status)>=0});
if(need.length)m.appendChild(h('div',{class:'card'},[h('h2',{},[TX.needYou]),h('div',{class:'list'},need.map(reqRow))]));
m.appendChild(h('div',{class:'card'},[h('h2',{},[TX.today]),h('p',{class:'note'},[TX.navNew]),h('a',{class:'btn',href:HOME+'#chat'},[TX.navNew])]));
var others=state.me.requests.filter(function(r){return need.indexOf(r)<0}).slice(0,6);
if(others.length)m.appendChild(h('div',{class:'card'},[h('h2',{},[TX.navRequests]),h('div',{class:'list'},others.map(reqRow))]))}
function viewNew(m){m.appendChild(h('h1',{},[TX.navNew]));m.appendChild(h('div',{class:'card'},[h('p',{},[TX.today]),h('a',{class:'btn',href:HOME+'#chat'},[TX.navNew])]))}
// المستند بالحجم الكامل: طبقةٌ فوق اللوحة، والمستند داخل iframe معزول فلا
// تُصادر أنماطُه أنماطَ اللوحة ولا العكس، ويطبع وحده.
function docOverlay(title,loader){
 var ovl=h('div',{class:'docovl'});
 var frame=h('iframe',{title:title,srcdoc:'<!doctype html><meta charset=utf-8><body style="font:14px system-ui;padding:24px;color:#64748b">'+TX.docWait+'</body>'});
 function close(){document.removeEventListener('keydown',esc2);ovl.remove()}
 function esc2(e){if(e.key==='Escape')close()}
 var bar=h('div',{class:'docovl-bar'},[
   h('b',{},[title]),
   h('div',{class:'acts'},[
     h('button',{class:'p',onclick:function(){try{frame.contentWindow.focus();frame.contentWindow.print()}catch(e){window.print()}}},[TX.docPrint]),
     h('button',{onclick:close},[TX.docClose])])]);
 ovl.appendChild(bar);ovl.appendChild(frame);
 ovl.addEventListener('click',function(e){if(e.target===ovl)close()});
 document.addEventListener('keydown',esc2);
 document.body.appendChild(ovl);
 loader().then(function(html){if(html)frame.srcdoc=html});
 return ovl}

function docBtn(label,title,loader){
 return h('button',{class:'btn ghost sm doc-open',onclick:function(){docOverlay(title,loader)}},[label])}

function viewList(m,title,f){m.appendChild(h('h1',{},[title]));var rows=state.me.requests.filter(f);m.appendChild(rows.length?h('div',{class:'list'},rows.map(function(r){var row=reqRow(r);if(r.quote&&title===TX.navQuotes)row.insertBefore(h('span',{class:'pill '+(r.quote.status==='APPROVED'?'ok':'warn')},[r.quote.number+' · '+money(r.quote.total)]),row.children[1]);if(r.contract&&title===TX.navContracts)row.insertBefore(h('span',{class:'pill '+(r.contract.status==='SIGNED'?'ok':'warn')},[r.contract.number+' · '+(r.contract.status==='SIGNED'?TX.signed:TX.contract)]),row.children[1]);if(r.nda&&title===TX.navContracts)row.insertBefore(h('span',{class:'pill '+(r.nda.status==='SIGNED'?'ok':'warn')},[r.nda.status==='SIGNED'?TX.ndaDone:TX.ndaWait]),row.children[1]);return row})):h('p',{class:'note'},[TX.empty]))}
function viewInvoices(m){m.appendChild(h('h1',{},[TX.navInvoices]));var rows=state.me.requests.filter(function(r){return r.invoice});m.appendChild(rows.length?h('div',{class:'list'},rows.map(function(r){var row=reqRow(r);row.insertBefore(h('span',{class:'pill ok'},[r.invoice.number+' · '+money(r.invoice.total)]),row.children[1]);return row})):h('p',{class:'note'},[TX.empty]))}
function viewPay(m){m.appendChild(h('h1',{},[TX.navPay]));var all=state.me.requests.filter(function(r){return ['SIGNED','PAYMENT_PENDING'].indexOf(r.status)>=0});var rows=all.filter(function(r){return !payReview(r)}),held=all.filter(payReview);
if(rows.length)m.appendChild(h('div',{class:'list'},rows.map(function(r){var row=reqRow(r);row.insertBefore(h('span',{class:'pill warn'},[money(payAmt(r))]),row.children[1]);return row})));else if(!held.length)m.appendChild(h('p',{class:'note'},[TX.empty]));
if(held.length){m.appendChild(h('h2',{style:'margin:18px 0 10px'},[TX.reviewList]));m.appendChild(h('div',{class:'list'},held.map(function(r){var row=reqRow(r);row.insertBefore(h('span',{class:'pill'},[money(payAmt(r))]),row.children[1]);return row})))}
m.appendChild(h('div',{class:'card'},[h('a',{class:'btn ghost',href:CHECKOUT},[TX.navPay+' →'])]))}
function viewChats(m){m.appendChild(h('h1',{},[TX.navChats]));var rows=state.me.requests.filter(function(r){return r.last_message});m.appendChild(rows.length?h('div',{class:'list'},rows.map(function(r){var row=reqRow(r);row.querySelector('small').textContent=(r.last_message.content||'').slice(0,90);return row})):h('p',{class:'note'},[TX.empty]))}
// ---------- الاتصال المرئي: الموعد القادم والانضمام (قبل خمس دقائق)
function apptStart(a){return new Date(a.date+'T'+a.time+':00+03:00').getTime()}
function apptEnd(a){return apptStart(a)+(Number(a.minutes)||30)*60000}
function nextAppt(){var now=Date.now(),best=null;((state.me&&state.me.requests)||[]).forEach(function(r){var a=r.appointment;if(!a||!a.date||!a.time||a.status==='CANCELLED'||r.status==='CANCELLED')return;if(apptEnd(a)<now)return;if(!best||apptStart(a)<apptStart(best.a))best={a:a,r:r}});return best}
function c12(hm){var p=String(hm).split(':'),hh=+p[0],h12=((hh+11)%12)+1;return h12+':'+p[1]+' '+(LANG==='ar'?(hh<12?'ص':'م'):(hh<12?'AM':'PM'))}
function fillT(t,o){return String(t).replace(/\\{(\\w)\\}/g,function(_,k){return o[k]==null?'':o[k]})}
function dayNameOf(i){try{return new Intl.DateTimeFormat(LANG==='ar'?'ar-SA':LANG==='zh'?'zh-CN':LANG,{weekday:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2024,0,7+i)))}catch(e){return String(i)}}
function hoursText(o){if(!o||!o.hours)return TX.apptNote;var off=o.offDays||[];return fillT(TX.apptHours,{a:c12(o.hours.from),b:c12(o.hours.to),n:o.slotMinutes||30})+' '+(off.length?fillT(TX.apptDays,{d:off.map(dayNameOf).join(LANG==='ar'?' و':' & ')}):TX.apptDaysAll)}
function p2(n){return (n<10?'0':'')+n}
function gcalAdd(a){var s=apptStart(a),e=apptEnd(a);function f(t){var d=new Date(t+3*3600000);return d.getUTCFullYear()+p2(d.getUTCMonth()+1)+p2(d.getUTCDate())+'T'+p2(d.getUTCHours())+p2(d.getUTCMinutes())+'00'}
 return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text='+encodeURIComponent(TX.videoFree+(a.topic?' - '+a.topic:''))+'&dates='+f(s)+'/'+f(e)+'&ctz=Asia%2FRiyadh&details='+encodeURIComponent(a.meet||'')+'&location='+encodeURIComponent(a.meet||'Google Meet')}
var joinBoxes=[];
setInterval(function(){joinBoxes=joinBoxes.filter(function(b){return b.box.isConnected});joinBoxes.forEach(function(b){b.upd()})},15000);
// رابط الاجتماع يظهر دائماً؛ زرّ «انضم» يُفتح قبل الموعد بخمس دقائق ويُغلق بانتهائه.
function joinBox(a){var box=h('div',{class:'joinbox','data-join':'1'});
 function upd(){box.innerHTML='';var now=Date.now(),s=apptStart(a),e=apptEnd(a);
  if(a.status==='PENDING'||!a.meet){box.appendChild(h('p',{class:'note'},[TX.apptPending]));return}
  if(now>e){box.appendChild(h('p',{class:'note'},[TX.apptOver]));return}
  var open=now>=s-300000;
  box.appendChild(h('p',{class:'note'},[TX.meetLink+': ',h('a',{href:a.meet,target:'_blank',rel:'noopener',dir:'ltr'},[a.meet])]));
  var row=h('div',{class:'msgform'});
  if(open)row.appendChild(h('a',{class:'btn','data-join-open':'1',href:a.meet,target:'_blank',rel:'noopener'},[TX.joinNow]));
  else row.appendChild(h('button',{class:'btn',type:'button',disabled:'disabled','data-join-open':'0'},[TX.joinNow]));
  row.appendChild(h('a',{class:'btn ghost',href:gcalAdd(a),target:'_blank',rel:'noopener'},[TX.addCal]));
  box.appendChild(row);
  if(!open)box.appendChild(h('p',{class:'note'},[TX.joinSoon]))}
 upd();joinBoxes.push({box:box,upd:upd});return box}
function nextApptCard(){var na=nextAppt();if(!na)return null;var a=na.a;
 return h('div',{class:'card',id:'sv1NextAppt'},[h('h2',{},[TX.nextAppt]),h('p',{class:'note'},[TX.videoFree]),h('p',{},['📅 '+a.date+' · '+a.time+' ('+c12(a.time)+') · '+TX.riyadh+(a.topic?' · '+a.topic:'')]),joinBox(a),h('div',{class:'msgform'},[h('a',{class:'btn ghost sm',onclick:function(){go('request',na.r.ref)}},[TX.open])])])}
// مختار الفترات من الخادم نفسه (api/book?action=slots): لا ساعات مكتوبة هنا — ما يُعرض هو ما يقبله الخادم.
function slotPicker(){var st={days:[]};var d=h('select',{class:'inp'}),tm=h('select',{class:'inp'}),note=h('p',{class:'note'},[TX.apptLoading]);
 function dayLabel(ds){try{return new Date(ds+'T12:00:00+03:00').toLocaleDateString(LANG==='ar'?'ar-SA-u-ca-gregory-nu-latn':LANG==='zh'?'zh-CN':LANG,{weekday:'long',day:'numeric',month:'long',timeZone:'Asia/Riyadh'})}catch(e){return ds}}
 function fillTimes(){tm.innerHTML='';var x=st.days.filter(function(y){return y.date===d.value})[0];(x?x.slots:[]).forEach(function(t){tm.appendChild(h('option',{value:t},[t+' ('+c12(t)+')']))})}
 d.addEventListener('change',fillTimes);
 fetch('/api/book?action=slots').then(function(r){return r.json()}).then(function(o){
  if(!o||!o.ok||!(o.days||[]).length){note.textContent=TX.apptNone;return}
  st.days=o.days;o.days.forEach(function(x){d.appendChild(h('option',{value:x.date},[dayLabel(x.date)]))});fillTimes();note.textContent=hoursText(o)})
 .catch(function(){note.textContent=TX.apptNone});
 return {day:d,time:tm,note:note}}
function apptErr(o){var e=o&&o.error;return e==='bad_datetime'?TX.apptBad:(e==='off_day'||e==='friday')?TX.apptFri:e==='past'?TX.apptPast:e==='out_of_hours'?TX.apptOut:e==='too_soon'?TX.apptSoon:e==='too_far'?TX.apptFar:e==='slot_taken'?TX.apptTaken:e==='too_many_active'?TX.apptMany:e==='rate_limited'?TX.apptRate:failText(o)}
function viewAppts(m){m.appendChild(h('h1',{},[TX.navAppts]));var nc=nextApptCard();if(nc)m.appendChild(nc);var rows=state.me.requests.filter(function(r){return r.appointment&&r.appointment.status!=='CANCELLED'&&r.status!=='CANCELLED'});m.appendChild(rows.length?h('div',{class:'list'},rows.map(function(r){var row=reqRow(r);row.insertBefore(h('span',{class:'pill'},[r.appointment.date+' '+r.appointment.time]),row.children[1]);return row})):h('p',{class:'note'},[TX.empty]));var cons=state.me.requests.filter(function(r){return r.type==='CONSULTATION'&&(!r.appointment||r.appointment.status==='CANCELLED')&&r.status!=='CANCELLED'});if(cons.length)m.appendChild(h('div',{class:'card'},[h('h2',{},[TX.book]),h('div',{class:'list'},cons.map(reqRow))]))}
function viewCompany(m){m.appendChild(h('h1',{},[TX.navCompany]));var o=state.me.organization||{};var f=h('div',{class:'form'});var nAr=h('input',{class:'inp',value:o.name_ar||''}),nEn=h('input',{class:'inp',value:o.name_en||''}),cr=h('input',{class:'inp',value:o.cr_number||''}),msg=h('span',{class:'ok'});
f.appendChild(h('label',{},[TX.company]));f.appendChild(nAr);f.appendChild(h('label',{},[TX.nameEn]));f.appendChild(nEn);f.appendChild(h('label',{},[TX.cr]));f.appendChild(cr);
f.appendChild(h('button',{class:'btn',onclick:function(){fetch('/api/requests',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({action:'my-org-update',name_ar:nAr.value,name_en:nEn.value,cr:cr.value,cr_number:cr.value})}).then(function(r){return r.json()}).catch(function(){return {ok:false,error:'network'}}).then(function(o){if(o&&o.error==='unauthorized'){sessionEnded();return}msg.className=o&&o.ok?'ok':'err';msg.textContent=o&&o.ok?TX.saved:failText(o);if(o&&o.ok&&o.organization)state.me.organization=o.organization})}},[TX.save]));f.appendChild(msg);
m.appendChild(h('div',{class:'card'},[h('div',{class:'stat'},[h('span',{},[TX.email+': ',h('b',{},[state.me.user.email])])]),f]));
// Setting a password needs a live session, which is exactly where we are —
// so the client picks one here and stops waiting for a code every visit.
var pw=h('input',{class:'inp',type:'password',autocomplete:'new-password',placeholder:TX.password}),pmsg=h('span',{class:'ok'});
var pf=h('div',{class:'form'},[h('p',{class:'note'},[TX.pwNote]),h('label',{},[TX.password]),pw,h('div',{class:'msgform'},[h('button',{class:'btn',onclick:function(){pmsg.className='ok';if((pw.value||'').length<8){pmsg.className='err';pmsg.textContent=TX.pwShort;return}otp({action:'password-set',password:pw.value}).then(function(o){if(o&&o.ok){pmsg.textContent=TX.pwSaved;pw.value=''}else{pmsg.className='err';pmsg.textContent=(o&&o.reason&&TX['pwr_'+o.reason])||(o&&o.message)||TX.error}})}},[TX.pwSave]),pmsg])]);
m.appendChild(h('div',{class:'card'},[h('h3',{},[TX.pwTitle]),pf]))}

// ---------- المستندات: خزانة واحدة للعميل
// هذه هي خزانة /account نفسها — الجداول documents و document_versions
// والمسارات my-ops الموجودة أصلاً. لا خزانة ثانية ولا دالة api جديدة: مستندٌ
// يُرفع هنا يظهر هناك، وفي المقابل ينتقل العميل بين البوابتين بلا فقدان ورقة.
//
// attachment-add في /api/simple ليست المسار: عقدها الفعلي {name,url,note} —
// بياناتٌ عن مرفق، لا بايتات ملف. راجع تقرير المهمة.
var DOC_CATS=${JSON.stringify(cats)};
var MAX_DOC=8*1024*1024;
var OK_MIME={'application/pdf':'application/pdf','image/jpeg':'image/jpeg','image/jpg':'image/jpeg','image/png':'image/png','image/webp':'image/webp'};
var OK_EXT={pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'};
function extOf(n){var t=String(n||'');var i=t.lastIndexOf('.');return i<0?'':t.slice(i+1).toLowerCase()}
// النوع من ترويسة المتصفح أولاً، ومن الامتداد حين لا يعرفه المتصفح (يحدث على
// أندرويد ومع بعض ملفات PDF) — فلا يُرفض ملفٌ سليم لأن المتصفح صمت عن نوعه.
function mimeOf(f){return OK_MIME[String((f&&f.type)||'').toLowerCase()]||OK_EXT[extOf(f&&f.name)]||''}
function kb(n){n=Number(n||0);return n>=1048576?((n/1048576).toFixed(1)+' MB'):(Math.max(1,Math.round(n/1024))+' KB')}
function baseName(n){var t=String(n||'').replace(/\\.[^.]+$/,'');return t.slice(0,120)}
function daysLeft(d){if(!d)return null;var t=Date.parse(String(d).slice(0,10)+'T00:00:00Z');if(!isFinite(t))return null;
 var today=Date.parse(new Date().toISOString().slice(0,10)+'T00:00:00Z');return Math.round((t-today)/86400000)}
function dayStr(n){return LANG==='en'?(n+' '+TX.dLeftB):(TX.dLeftA+' '+n+' '+TX.dLeftB)}
// الحارس الذي يشتغل قبل أن يغادر الملف الجهاز. صار الخادم يرفض الصيغة
// والحجم فعلاً (bad_type / too_large)، لكن الرفض هنا أرخص: لا ينتظر
// العميل رفع ثمانية ميجابايت ليُقال له «غير مقبول». والرسالتان واحدة في
// الموضعين — upErr يترجم ردّ الخادم إلى النصّ نفسه.
function fileErr(f){if(!f)return TX.eType;if(!f.size)return TX.eEmpty;
 if(!mimeOf(f))return TX.eType;if(f.size>MAX_DOC)return TX.eBig+' ('+kb(f.size)+')';return ''}
function toB64(f){return new Promise(function(res,rej){var fr=new FileReader();
 fr.onload=function(){var t=String(fr.result||'');var i=t.indexOf(',');i<0?rej(new Error('read')):res(t.slice(i+1))};
 fr.onerror=function(){rej(new Error('read'))};fr.readAsDataURL(f)})}
function opsGet(what,extra){return fetch('/api/requests?action=my-ops&what='+what+(extra||''),{credentials:'same-origin',cache:'no-store'})
 .then(function(r){return r.json()}).catch(function(){return {ok:false,error:'network'}})}
function opsPost(b){return fetch('/api/requests',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(b)})
 .then(function(r){return r.json()}).catch(function(){return {ok:false,error:'network'}})}
// ردّ الخادم رمزٌ إنجليزي، وما يقرؤه العميل جملةٌ بلغته تقول ما المشكلة وما
// الحلّ. bad_type و too_large حالتا رفضٍ للملف نفسه: إعادة المحاولة بالملف
// ذاته لن تنجح أبداً، فلا تُعرض بنصّ «حاول مرة أخرى» العامّ. والرمز لا يظهر
// للعميل في أي حال — يذهب إلى الـconsole لمن يشخّص.
function upErr(e){e=String(e||'');
 if(e==='network')return TX.eNet;
 if(e==='no_org')return TX.eNoOrg;
 if(e==='bad_type')return TX.eType;
 if(e==='too_large'||e==='http_413')return TX.eBig;
 if(e==='empty')return TX.eEmpty;
 if(e==='too_many_files')return TX.eMany;
 if(e==='request_closed')return TX.eClosed;
 if(e==='invalid_fields')return TX.eName;
 if(e&&window.console)console.warn('upload:',e);
 return TX.eUp}
// رفعٌ بنسبة مئوية حقيقية: XHR لأن fetch لا يُبلّغ عن تقدّم الرفع. وكل نهاية
// لها فرع — نجاح، أو خطأ من الخادم برسالته، أو انقطاع شبكة — ولا فرع صامت.
function sendDoc(payload,onp,url){return new Promise(function(res){
 var x=new XMLHttpRequest();x.open('POST',url||'/api/requests',true);x.withCredentials=true;
 x.setRequestHeader('content-type','application/json');
 if(x.upload&&onp)x.upload.onprogress=function(e){if(e.lengthComputable)onp(e.loaded/e.total)};
 x.onload=function(){var o=null;try{o=JSON.parse(x.responseText||'null')}catch(e){}
  if(o&&typeof o==='object'&&('ok' in o))res(o);else res({ok:false,error:'http_'+x.status})};
 x.onerror=function(){res({ok:false,error:'network'})};
 x.onabort=function(){res({ok:false,error:'network'})};
 x.ontimeout=function(){res({ok:false,error:'network'})};
 try{x.send(JSON.stringify(payload))}catch(e){res({ok:false,error:'network'})}})}
function setDocBadge(){var a=document.querySelector('[data-nav="documents"]');if(!a)return;
 var n=badges().documents;var b=a.querySelector('.b');
 if(!n){if(b)b.remove();return}
 if(b)b.textContent=String(n);else a.appendChild(h('span',{class:'b'},[String(n)]))}
function loadDocs(){return opsGet('documents').then(function(o){if(o&&o.ok)state.docs=o.items||[];setDocBadge();return o})}

function viewDocuments(m){
 m.appendChild(h('h1',{},[TX.navDocs]));
 var noOrg=!(state.me.organization&&state.me.organization.id);
 var card=h('div',{class:'card'});
 card.appendChild(h('p',{class:'note',style:'margin:0 0 12px'},[TX.vaultNote]));
 var file=h('input',{type:'file',accept:'application/pdf,image/jpeg,image/png,image/webp',style:'display:none'});
 var dz=h('div',{class:'dz',tabindex:'0',role:'button'},[h('span',{class:'ico'},['📄']),h('b',{},[TX.dzPick]),h('small',{},[TX.dzHint])]);
 var err=h('div',{class:'err',style:'margin-top:10px'}),okm=h('div',{class:'ok',style:'margin-top:10px'});
 var form=h('div',{hidden:'',style:'margin-top:12px'});
 var picked=null,version=null;   // version = {id,title,category} حين تكون نسخةً جديدة من مستند قائم
 var fname=h('span',{class:'nm'}),fsize=h('span',{class:'sz'});
 var again=h('button',{class:'btn ghost sm',onclick:function(){file.click()}},[TX.dOther]);
 var title=h('input',{class:'inp',maxlength:'200',placeholder:TX.dName});
 var cat=h('select',{class:'inp'},DOC_CATS.map(function(c){return h('option',{value:c[0]},[c[1]])}));
 var exp=h('input',{class:'inp',type:'date'});
 var bar=h('div',{class:'bar',hidden:''},[h('i',{})]);
 var send=h('button',{class:'btn'},[TX.dSend]);
 var fields=h('div',{class:'dgrid',style:'margin-top:10px'},[
  h('div',{},[h('label',{class:'note'},[TX.dName]),title]),
  h('div',{},[h('label',{class:'note'},[TX.dCat]),cat]),
  h('div',{},[h('label',{class:'note'},[TX.dExp]),exp])]);
 form.appendChild(h('div',{class:'dfile'},[h('span',{},['📎']),fname,fsize,again]));
 form.appendChild(fields);form.appendChild(bar);
 form.appendChild(h('div',{style:'margin-top:12px'},[send]));
 function reset(){picked=null;version=null;form.hidden=true;fields.hidden=false;file.value='';
  title.value='';exp.value='';cat.value='other';bar.hidden=true;bar.className='bar';bar.firstChild.style.width='0';
  send.disabled=false;send.textContent=TX.dSend}
 function take(f){err.textContent='';okm.textContent='';
  var e=fileErr(f);
  if(e){err.textContent=e;picked=null;form.hidden=true;file.value='';return}
  picked=f;fname.textContent=f.name;fsize.textContent=kb(f.size);
  bar.hidden=true;bar.className='bar';bar.firstChild.style.width='0';
  send.disabled=false;send.textContent=TX.dSend;
  if(version){title.value=version.title;cat.value=version.category||'other';fields.hidden=true}
  else{fields.hidden=false;if(!title.value)title.value=baseName(f.name)}
  form.hidden=false;if(!version)title.focus()}
 file.addEventListener('change',function(){take(file.files&&file.files[0])});
 dz.addEventListener('click',function(){if(!noOrg)file.click()});
 dz.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!noOrg)file.click()}});
 ['dragenter','dragover'].forEach(function(n){dz.addEventListener(n,function(e){e.preventDefault();dz.classList.add('over')})});
 ['dragleave','drop'].forEach(function(n){dz.addEventListener(n,function(e){e.preventDefault();dz.classList.remove('over')})});
 dz.addEventListener('drop',function(e){if(noOrg)return;var f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];if(f)take(f)});
 send.addEventListener('click',function(){
  err.textContent='';okm.textContent='';
  if(!picked){err.textContent=TX.eType;return}
  var e=fileErr(picked);if(e){err.textContent=e;return}
  var t=(title.value||'').trim();if(!t){err.textContent=TX.eName;title.focus();return}
  var wasVersion=!!version;
  send.disabled=true;bar.hidden=false;bar.className='bar';bar.firstChild.style.width='4%';
  send.textContent=TX.dUploading+' 0%';
  toB64(picked).then(function(b64){
   return sendDoc({action:'ops-doc-upload',title:t,category:cat.value,expiry:exp.value||'',
                   fileName:picked.name,mime:mimeOf(picked),base64:b64},
    function(p){var pc=Math.max(4,Math.min(99,Math.round(p*100)));
     bar.firstChild.style.width=pc+'%';send.textContent=TX.dUploading+' '+pc+'%'})
  }).then(function(o){
   if(o&&o.ok){bar.firstChild.style.width='100%';
    okm.textContent=(wasVersion?TX.dNewVerDone:TX.dDone)+(o.version>1?(' · '+verLbl(o.version)):'');
    setTimeout(reset,600);return loadDocs().then(draw)}
   if(o&&o.error==='unauthorized'){location.reload();return}
   bar.className='bar bad';err.textContent=upErr(o&&o.error);
   send.disabled=false;send.textContent=TX.dRetry;
  }).catch(function(){bar.className='bar bad';err.textContent=TX.eRead;
   send.disabled=false;send.textContent=TX.dRetry})});
 card.appendChild(dz);card.appendChild(file);card.appendChild(err);card.appendChild(okm);card.appendChild(form);
 if(noOrg){dz.style.opacity='.55';dz.style.cursor='not-allowed';err.textContent=TX.eNoOrg}
 m.appendChild(card);

 var list=h('div',{class:'list',style:'margin-top:14px'});m.appendChild(list);
 list.appendChild(h('p',{class:'note'},[TX.dLoading]));
 function draw(){
  list.innerHTML='';
  var items=state.docs||[];
  if(!items.length){list.appendChild(h('p',{class:'note'},[TX.dNone]));return}
  items.forEach(function(d){
   var n=daysLeft(d.expiry_date);
   var box=h('div',{class:'doc'+(n===null?'':n<0?' gone':n<=30?' soon':'')});
   var chips=[h('b',{},[d.title||'']),h('span',{class:'pill mut'},[catName(d.category)])];
   if(n!==null&&n<=30)chips.push(h('span',{class:'pill '+(n<0?'bad':'warn')},[n<0?TX.dExpired:dayStr(n)]));
   chips.push(h('span',{class:'pill '+(d.extracted?'ok':'mut')},[d.extracted?TX.dReadOk:TX.dPending]));
   box.appendChild(h('div',{class:'hd'},chips));
   var vers=(d.document_versions||[]).slice().sort(function(a,b){return (b.version_no||0)-(a.version_no||0)});
   var cur=vers[0]||null;
   var meta=[];
   if(cur)meta.push((cur.file_name||'')+' · '+verLbl(cur.version_no||1));
   if(d.expiry_date)meta.push(TX.dExpires+' '+String(d.expiry_date).slice(0,10));
   meta.push(when(d.created_at));
   box.appendChild(h('div',{class:'meta'},[meta.join(' · ')]));
   if(d.extracted){var x=d.extracted,bits=[];
    if(x.companyNameAr||x.companyNameEn)bits.push(TX.dEntity+': '+(x.companyNameAr||x.companyNameEn));
    if(x.crNumber)bits.push(TX.dCr+': '+x.crNumber);
    if(x.vatNumber)bits.push(TX.dVat+': '+x.vatNumber);
    if(d.issue_date||x.issueDate)bits.push(TX.dIssued+': '+String(d.issue_date||x.issueDate).slice(0,10));
    if(bits.length)box.appendChild(h('div',{class:'read'},['🤖 '+bits.join(' · ')]))}
   var dmsg=h('span',{class:'err'});
   var acts=h('div',{class:'acts'});
   if(cur)acts.appendChild(h('button',{class:'btn ghost sm',onclick:function(){
     dmsg.textContent='';opsGet('doc-link','&version='+encodeURIComponent(cur.id)).then(function(o){
      if(o&&o.ok&&o.url)window.open(o.url,'_blank','noopener');else dmsg.textContent=upErr(o&&o.error)})}},[TX.dOpen]));
   acts.appendChild(h('button',{class:'btn ghost sm',onclick:function(){
     version={id:d.id,title:d.title,category:d.category};okm.textContent='';err.textContent='';
     file.value='';file.click();
     try{card.scrollIntoView({behavior:'smooth',block:'start'})}catch(e){}}},[TX.dNewVer]));
   acts.appendChild(h('button',{class:'btn danger sm',onclick:function(){
     if(!window.confirm(TX.dDelAsk+'\\n\\n'+(d.title||'')))return;
     dmsg.textContent='';opsPost({action:'ops-doc-delete',id:d.id}).then(function(o){
      if(o&&o.ok){loadDocs().then(draw);return}dmsg.textContent=upErr(o&&o.error)})}},[TX.dDel]));
   acts.appendChild(dmsg);
   box.appendChild(acts);
   list.appendChild(box)})}
 if(state.docs)draw();
 loadDocs().then(function(o){if(o&&!o.ok&&o.error==='network'){list.innerHTML='';list.appendChild(h('p',{class:'err'},[TX.eNet]))}else draw()})}
function verLbl(n){return (LANG==='ar'||LANG==='zh')?(TX.dVer+' '+n):(TX.dVer+n)}
function catName(c){for(var i=0;i<DOC_CATS.length;i++)if(DOC_CATS[i][0]===c)return DOC_CATS[i][1];
 return DOC_CATS[DOC_CATS.length-1][1]}
// ---------- الامتثال والمخالفات
// لا منطق امتثال جديد هنا: الحالة من compliance-access، والمخالفات من
// violations، والتسجيل والاعتراض عبر ops-violation-add/object — كلها مسارات
// my-ops الحيّة نفسها. المستندات تُدار من قسم «مستنداتي» (go('documents')),
// فلا نكرّر خزانةً ثانية. ومشاري لا يَعِد بإلغاء مخالفة — ندرس الأهلية ونتابع.
function isActionableViol(v){var s=String((v&&v.status)||'').trim();return !s||/جديد/.test(s)}
function violPill(s){s=String(s||'').trim();if(!s)return h('span',{class:'pill warn'},[TX.cNew]);
 var good=/مقبول|ملغا|مغلق|منجز|accepted|closed/i.test(s),bad=/مرفوض|rejected/i.test(s),obj=/اعتراض/.test(s);
 return h('span',{class:'pill '+(good?'ok':bad?'bad':obj?'warn':'mut')},[s])}
function setComplianceBadge(){var a=document.querySelector('[data-nav="compliance"]');if(!a)return;
 var n=(state.violations||[]).filter(isActionableViol).length;var b=a.querySelector('.b');
 if(!n){if(b)b.remove();return}if(b)b.textContent=String(n);else a.appendChild(h('span',{class:'b'},[String(n)]))}
function viewCompliance(m){
 m.appendChild(h('h1',{},[TX.navCompliance]));
 m.appendChild(h('p',{class:'note',style:'margin:-6px 0 14px'},[TX.cIntro]));
 var access=h('div',{class:'card'});access.appendChild(h('p',{class:'note'},[TX.cLoading]));m.appendChild(access);
 var body=h('div');m.appendChild(body);
 opsGet('compliance-access').then(function(a){
  access.innerHTML='';
  if(!a||!a.ok){access.appendChild(h('p',{class:'err'},[TX.eNet]));return}
  // بلا منشأة: الخزانة والمخالفات مرتبطتان بالمنشأة، فنوجّه لبيانات الشركة.
  if(!('active' in a)){access.appendChild(h('p',{class:'note'},[TX.eNoOrg]));
   access.appendChild(h('button',{class:'btn ghost sm',style:'margin-top:8px',onclick:function(){go('company')}},['🏢 '+TX.navCompany]));return}
  var days=Number(a.days_left)||0;
  if(a.active){access.appendChild(h('span',{class:'pill ok'},['🛡️ '+TX.cActive]))}
  else if(a.trial&&days>0){access.appendChild(h('span',{class:'pill warn'},['🛡️ '+TX.cTrialLbl+' · '+dayStr(days)]));
   if(a.ends_at)access.appendChild(h('p',{class:'note',style:'margin-top:8px'},[TX.validUntil+': '+String(a.ends_at).slice(0,10)]))}
  else{access.appendChild(h('h3',{},['🛡️ '+TX.cLockedTitle]));access.appendChild(h('p',{class:'note'},[TX.cLocked]));
   access.appendChild(h('a',{class:'btn',style:'margin-top:8px',href:'/ar/compliance-agent'},[TX.cSubscribe]));return}
  drawComplianceBody(body);
 })}
// بوابة NDA: تُعرض قبل أي رفع/إدخال في قسم الامتثال. الموافقة تُحفظ محلياً للعرض الآن
// (علامة لكل متصفح). التسجيل القانوني الكامل (وقت + مستخدم + نسخة النص) يحتاج نقطة
// نهاية في api/ يملكها client-portal — لم تُلمس هنا.
function ndaConsented(){try{return localStorage.getItem('bp_nda_compliance')==='1'}catch(e){return false}}
function drawComplianceBody(body){
 body.innerHTML='';
 if(!ndaConsented()){drawNdaGate(body);return}
 drawComplianceSections(body);
}
function drawNdaGate(body){
 var card=h('div',{class:'card'});
 card.appendChild(h('h3',{},['🔒 '+TX.ndaTitle]));
 card.appendChild(h('p',{class:'note'},[TX.ndaIntro]));
 var ul=h('ol',{class:'note',style:'margin:8px 0 4px;padding-'+(LANG==='ar'?'right':'left')+':20px;line-height:1.9'});
 [TX.ndaP1,TX.ndaP2,TX.ndaP3,TX.ndaP4,TX.ndaP5].forEach(function(t){ul.appendChild(h('li',{},[t]))});
 card.appendChild(ul);
 var chk=h('input',{type:'checkbox',id:'ndaAgree'});
 var btn=h('button',{class:'btn',disabled:'disabled'},[TX.ndaBtn]);
 chk.addEventListener('change',function(){if(chk.checked)btn.removeAttribute('disabled');else btn.setAttribute('disabled','disabled')});
 btn.addEventListener('click',function(){if(!chk.checked)return;
  try{localStorage.setItem('bp_nda_compliance','1')}catch(e){}
  drawComplianceBody(body)});
 card.appendChild(h('label',{style:'display:flex;gap:8px;align-items:flex-start;margin:10px 0;font-size:.9rem'},[chk,h('span',{},[TX.ndaAgree])]));
 card.appendChild(h('div',{style:'margin-top:6px'},[btn]));
 body.appendChild(card);
 body.appendChild(h('p',{class:'note',style:'color:#b45309;margin-top:12px'},['🔒 '+TX.ndaLocked]));
}
function drawComplianceSections(body){
 body.innerHTML='';
 // 1) استحقاقات قريبة من مستنداتك + زر الإدارة والرفع (يعيد استعمال قسم المستندات)
 var dcard=h('div',{class:'card'});dcard.appendChild(h('h3',{},[TX.cDocsTitle]));
 var dlist=h('div',{class:'list'});dcard.appendChild(dlist);
 dcard.appendChild(h('button',{class:'btn ghost sm',style:'margin-top:10px',onclick:function(){go('documents')}},['📁 '+TX.cManageDocs]));
 body.appendChild(dcard);
 function fillDocs(){dlist.innerHTML='';
  var items=(state.docs||[]).map(function(d){return {d:d,n:daysLeft(d.expiry_date)}}).filter(function(x){return x.n!==null&&x.n<=60}).sort(function(a,b){return a.n-b.n});
  if(!items.length){dlist.appendChild(h('p',{class:'note'},[TX.cDocsNone]));return}
  items.forEach(function(x){var n=x.n;dlist.appendChild(h('div',{class:'row',onclick:function(){go('documents')}},[
   h('div',{class:'tt'},[h('b',{},[x.d.title||'']),h('small',{},[x.d.expiry_date?(TX.dExpires+' '+String(x.d.expiry_date).slice(0,10)):''])]),
   h('span',{class:'pill '+(n<0?'bad':'warn')},[n<0?TX.dExpired:dayStr(n)])]))})}
 if(state.docs)fillDocs();else{dlist.appendChild(h('p',{class:'note'},[TX.dLoading]));loadDocs().then(fillDocs)}
 // 2) المخالفات + تقديم الاعتراض
 var vcard=h('div',{class:'card'});vcard.appendChild(h('h3',{},[TX.cViolTitle]));
 vcard.appendChild(h('p',{class:'note'},[TX.cViolIntro]));
 vcard.appendChild(h('p',{class:'note',style:'color:#b45309'},[TX.cStages]));
 var vlist=h('div',{class:'list',style:'margin-top:10px'});vcard.appendChild(vlist);
 vlist.appendChild(h('p',{class:'note'},[TX.cLoading]));
 body.appendChild(vcard);
 function openObject(v,box,redraw){
  if(box.querySelector('.objform'))return;
  var note=h('textarea',{class:'inp',rows:'3',placeholder:TX.cObjectNote});
  var msg=h('div',{class:'err'});
  var send=h('button',{class:'btn sm'},['⚖️ '+TX.cObjectBtn]);
  var cancel=h('button',{class:'btn ghost sm',onclick:function(){wrap.remove()}},[TX.docClose]);
  send.addEventListener('click',function(){msg.className='err';msg.textContent='';
   if(!note.value.trim()){msg.textContent=TX.eName;note.focus();return}
   send.disabled=true;
   opsPost({action:'ops-violation-object',id:v.id,note:note.value.trim()}).then(function(o){
    send.disabled=false;
    if(o&&o.ok){opsGet('violations').then(function(r){if(r&&r.ok)state.violations=r.items||[];redraw()})}
    else{msg.textContent=upErr(o&&o.error)}})});
  var wrap=h('div',{class:'objform',style:'margin-top:10px'},[note,h('div',{class:'msgform'},[send,cancel]),msg]);
  box.appendChild(wrap);note.focus()}
 function drawViol(){vlist.innerHTML='';var items=state.violations||[];
  if(!items.length){vlist.appendChild(h('p',{class:'note'},[TX.cViolNone]));return}
  items.forEach(function(v){
   var box=h('div',{class:'doc'});
   box.appendChild(h('div',{class:'hd'},[h('b',{},[v.title||'']),violPill(v.status)]));
   var meta=[v.authority||''];if(v.violation_number)meta.push('#'+v.violation_number);if(v.amount)meta.push(money(v.amount));if(v.violation_date)meta.push(String(v.violation_date).slice(0,10));
   box.appendChild(h('div',{class:'meta'},[meta.filter(Boolean).join(' · ')]));
   if(v.objection_deadline){var dn=daysLeft(v.objection_deadline);box.appendChild(h('div',{class:'meta'},[TX.cDeadline+': '+String(v.objection_deadline).slice(0,10)+(dn!==null?(' · '+(dn<0?TX.dExpired:dayStr(dn))):'')]))}
   var acts=h('div',{class:'acts'});
   if(/اعتراض/.test(String(v.status||''))){acts.appendChild(h('span',{class:'ok'},['✓ '+TX.cObjectFiled]));
    if(v.objection_note)box.appendChild(h('div',{class:'read'},['📝 '+v.objection_note]))}
   else{acts.appendChild(h('button',{class:'btn sm',onclick:function(){openObject(v,box,draw)}},['⚖️ '+TX.cObjectBtn]))}
   box.appendChild(acts);vlist.appendChild(box)})}
 function draw(){drawViol();setComplianceBadge()}
 if(state.violations)draw();
 opsGet('violations').then(function(o){if(o&&o.ok)state.violations=o.items||[];
  if(o&&!o.ok&&o.error==='network'){vlist.innerHTML='';vlist.appendChild(h('p',{class:'err'},[TX.eNet]))}else draw()});
 // 3) سجّل مخالفة
 var add=h('div',{class:'card'});add.appendChild(h('h3',{},[TX.cAddTitle]));
 var authority=h('input',{class:'inp',maxlength:'80',placeholder:TX.cAuthority});
 var vtitle=h('input',{class:'inp',maxlength:'300',placeholder:TX.cVTitle});
 var vnum=h('input',{class:'inp',maxlength:'80',placeholder:TX.cVNumber});
 var vamount=h('input',{class:'inp',type:'number',min:'0',placeholder:TX.cVAmount});
 var vdate=h('input',{class:'inp',type:'date'});
 var vdeadline=h('input',{class:'inp',type:'date'});
 var amsg=h('div',{class:'err'});
 var abtn=h('button',{class:'btn'},[TX.cAddBtn]);
 abtn.addEventListener('click',function(){amsg.className='err';amsg.textContent='';
  if(!authority.value.trim()||!vtitle.value.trim()){amsg.textContent=TX.eName;return}
  abtn.disabled=true;
  opsPost({action:'ops-violation-add',authority:authority.value.trim(),title:vtitle.value.trim(),number:vnum.value.trim(),amount:vamount.value,date:vdate.value,deadline:vdeadline.value}).then(function(o){
   abtn.disabled=false;
   if(o&&o.ok){amsg.className='ok';amsg.textContent=TX.cAddDone;
    authority.value='';vtitle.value='';vnum.value='';vamount.value='';vdate.value='';vdeadline.value='';
    opsGet('violations').then(function(r){if(r&&r.ok){state.violations=r.items||[];draw()}})}
   else{amsg.textContent=upErr(o&&o.error)}})});
 add.appendChild(h('div',{class:'dgrid',style:'margin-top:6px'},[
  h('div',{},[h('label',{class:'note'},[TX.cAuthority]),authority]),
  h('div',{},[h('label',{class:'note'},[TX.cVTitle]),vtitle]),
  h('div',{},[h('label',{class:'note'},[TX.cVNumber]),vnum]),
  h('div',{},[h('label',{class:'note'},[TX.cVAmount]),vamount]),
  h('div',{},[h('label',{class:'note'},[TX.cVDate]),vdate]),
  h('div',{},[h('label',{class:'note'},[TX.cVDeadline]),vdeadline])]));
 add.appendChild(h('div',{style:'margin-top:12px'},[abtn,amsg]));
 body.appendChild(add)}
// ---------- files inside a request
// A link to one file is made at the moment of the click, by the server, after it
// has checked the request is this customer's — nothing long-lived is stored in
// the page. The window is opened first (inside the click, so the browser lets
// it) and pointed at the link when it arrives.
function openFile(a,btn){
 if(a.url&&!a.file){window.open(a.url,'_blank','noopener');return}
 var w=null;try{w=window.open('','_blank')}catch(e){}
 var old=btn?btn.textContent:'';if(btn)btn.disabled=true;
 function done(){if(btn){btn.disabled=false;btn.textContent=old}}
 function fail(){if(w){try{w.close()}catch(e){}}done();if(btn){btn.textContent=TX.delivErr;setTimeout(function(){btn.textContent=old},3500)}}
 api('attachment-link',{ref:state.req.ref,id:a.id}).then(function(o){
  if(o&&o.ok&&o.url){done();if(w){try{w.opener=null}catch(e){}w.location.href=o.url}else location.href=o.url}else fail()}).catch(fail)}
// «المستندات المطلوبة»: each line is a real upload. The file goes to the request
// (not to the vault), the server flips the line to «received», and the team is
// told. Same guard as the vault, in the browser first: type and size are
// refused before a megabyte leaves the device.
function docsCard(r,again){
 var open=r.status!=='CANCELLED';
 var dc=h('div',{class:'card',id:'sv1Docs'});dc.appendChild(h('h3',{},[TX.docs]));
 dc.appendChild(h('p',{class:'note'},[(r.documents&&r.documents.length)?TX.docsNote:TX.docsNone]));
 var msg=h('div',{class:'err',style:'margin-top:8px'}),okm=h('div',{class:'ok',style:'margin-top:8px'});
 if(state.docFlash){okm.textContent=state.docFlash;state.docFlash=null}
 var file=h('input',{type:'file',accept:'application/pdf,image/jpeg,image/png,image/webp',style:'display:none'});
 var target=null;
 function pick(t){if(!open)return;target=t;msg.textContent='';okm.textContent='';file.value='';file.click()}
 file.addEventListener('change',function(){
  var f=file.files&&file.files[0];file.value='';if(!f||!target)return;
  var e=fileErr(f);if(e){msg.textContent=e;return}
  var t=target,old=t.btn.textContent;t.btn.disabled=true;t.btn.textContent=TX.dUploading+' 0%';
  function reset(){t.btn.disabled=false;t.btn.textContent=old}
  toB64(f).then(function(b64){
   return sendDoc({action:'attachment-add',ref:r.ref,name:f.name,mime:mimeOf(f),base64:b64,
     doc_index:t.index>=0?t.index:'',doc_title:t.title||''},
    function(p){t.btn.textContent=TX.dUploading+' '+Math.max(1,Math.min(99,Math.round(p*100)))+'%'},'/api/simple')
  }).then(function(o){
   if(o&&o.ok){r.attachments=o.attachments||r.attachments;if(o.documents)r.documents=o.documents;state.docFlash=TX.docSent;again();return}
   if(o&&(o.error==='no_session'||o.error==='unauthorized')){location.reload();return}
   reset();msg.textContent=upErr(o&&o.error);
  }).catch(function(){reset();msg.textContent=TX.eRead})});
 dc.appendChild(file);
 if(r.documents&&r.documents.length){
  var ul=h('ul',{class:'items'});
  r.documents.forEach(function(d,i){
   var got=(r.attachments||[]).filter(function(a){return a.kind==='document'&&a.doc===d.title});
   var st=d.status==='received'?h('span',{class:'pill ok'},[TX.docRecv]):d.status==='waived'?h('span',{class:'pill mut'},[TX.docWaived]):h('span',{class:'pill warn'},[TX.docAsked]);
   var info=h('div',{},[h('b',{},[d.title]),d.note?h('small',{},[d.note]):null]);
   got.forEach(function(a){
    var ob=h('button',{class:'btn ghost sm',style:'margin-top:4px;margin-inline-end:6px',onclick:function(){openFile(a,ob)}},['📎 '+a.name+' · '+kb(a.size)]);
    if(a.id&&a.file)info.appendChild(h('div',{},[ob]));else info.appendChild(h('small',{},['📎 '+a.name]))});
   var li=h('li',{},[h('span',{class:'ic'},[d.status==='received'?'✓':'📄']),info,st]);
   if(open&&d.status!=='waived'){var b=h('button',{class:'btn'+(got.length?' ghost':'')+' sm',onclick:function(){pick({index:i,title:d.title,btn:b})}},[got.length?TX.docUpMore:TX.docUp]);li.appendChild(b)}
   ul.appendChild(li)});
  dc.appendChild(ul)}
 // anything else that belongs to the request, not tied to a line above
 var loose=(r.attachments||[]).filter(function(a){return a.kind!=='deliverable'&&!(a.kind==='document'&&a.doc)&&(a.file||a.url)});
 if(loose.length){var lu=h('ul',{class:'items',style:'margin-top:10px'});loose.forEach(function(a){
   var ob=h('button',{class:'btn ghost sm',onclick:function(){openFile(a,ob)}},[TX.fOpen]);
   lu.appendChild(h('li',{},[h('span',{class:'ic'},['📎']),h('div',{},[h('b',{},[a.name]),h('small',{},[(a.note?a.note+' · ':'')+when(a.at)])]),ob]))});dc.appendChild(lu)}
 if(open){var any=h('button',{class:'btn ghost sm',style:'margin-top:10px',onclick:function(){pick({index:-1,title:'',btn:any})}},['＋ '+TX.docUpAny]);dc.appendChild(any)}
 dc.appendChild(msg);dc.appendChild(okm);
 return dc}
// «مخرجات الطلب»: the finished work the team handed over. It is drawn from the
// moment payment is in, so the customer sees where the work will arrive before
// it does — and a completed request is never an empty page.
function delivCard(r){
 var files=(r.attachments||[]).filter(function(a){return a.kind==='deliverable'});
 var stage=['PAID','IN_PROGRESS','WAITING_INTERNAL','COMPLETED'].indexOf(r.status)>=0;
 if(!files.length&&!stage)return null;
 var c=h('div',{class:'card',id:'sv1Deliv'});c.appendChild(h('h3',{},[TX.delivTitle]));
 if(!files.length){c.appendChild(h('p',{class:'note'},[r.status==='COMPLETED'?TX.delivNoneDone:TX.delivNone]));return c}
 var ul=h('ul',{class:'items'});
 files.forEach(function(a){
  var b=h('button',{class:'btn sm',onclick:function(){openFile(a,b)}},[TX.delivDl]);
  ul.appendChild(h('li',{},[h('span',{class:'ic'},['📦']),h('div',{},[h('b',{},[a.title||a.name]),h('small',{},[(a.note?a.note+' · ':'')+a.name+' · '+kb(a.size)+' · '+when(a.at)])]),b]))});
 c.appendChild(ul);return c}
// ---------- request detail
function viewRequest(m){m.appendChild(h('a',{class:'btn ghost sm',onclick:function(){go('requests')}},['← '+TX.back]));var hd=h('h1',{style:'margin-top:10px'},['…']);m.appendChild(hd);var box=h('div');m.appendChild(box);
api('request-get',{ref:state.ref}).then(function(o){if(!o||!o.ok){if(o&&o.error==='not_found'){box.appendChild(h('div',{class:'card',id:'sv1Gone'},[h('p',{class:'note'},[TX.reqGone]),h('button',{class:'btn ghost',onclick:function(){go('requests')}},[TX.navRequests])]));return}box.appendChild(h('p',{class:'err'},[TX.error]));return}state.req=o.request;state.testMode=!!o.testMode;drawRequest(hd,box)})}
// Progress line and team updates. Drawn only when the request has them, so a
// customer who has neither (every cart order) sees the page exactly as before.
// The Arabic text is the source; the other languages show the English text when
// the team wrote one, and fall back to the Arabic.
function lt(ar,en){return LANG==='ar'?(ar||en||''):(en||ar||'')}
function stageLine(r){var st=r.stages||[];if(!st.length)return null;
 var ol=h('ol',{},st.map(function(s,i){var sub=s.status==='done'?TX.stDone+(s.at?' \u00b7 '+when(s.at):''):(s.status==='active'?TX.stActive:TX.stPending);
  return h('li',{class:s.status},[h('span',{class:'dot'},[s.status==='done'?'\u2713':String(i+1)]),h('div',{class:'lb'},[h('b',{},[lt(s.title_ar,s.title_en)]),h('small',{},[sub]),s.note?h('small',{class:'sn'},[s.note]):null])])}));
 return h('div',{class:'card prog',id:'sv1Stages'},[h('h3',{},[TX.progTitle]),ol])}
function updatesCard(r){var up=r.updates||[];if(!up.length)return null;var all=false;var card=h('div',{class:'card',id:'sv1Updates'});
 function draw(){card.innerHTML='';card.appendChild(h('h3',{},[TX.updTitle]));var shown=all?up:up.slice(0,3);
  card.appendChild(h('ul',{class:'tl upl'},shown.map(function(u){return h('li',{},[h('time',{},[when(u.at)]),h('span',{},[lt(u.text_ar,u.text_en)])])})));
  if(up.length>3)card.appendChild(h('button',{class:'btn ghost sm',onclick:function(){all=!all;draw()}},[all?TX.updLess:TX.updMore]))}
 draw();return card}
function tlEvents(r){var ev=r.events||[],up={};ev.forEach(function(e){if(e.event==='attachment.added'&&e.details&&e.details.doc)up[e.details.doc]=1});return ev.filter(function(e){return !(e.event==='document.received'&&e.details&&up[e.details.title])})}
function drawRequest(hd,box){var r=state.req;var isTicket=r.origin==='ticket';hd.textContent=r.title;box.innerHTML='';
var cxm=cxMode(r),cxPend=!!r.cancel_request&&r.status!=='CANCELLED';
box.appendChild(h('div',{class:'stat'},[h('span',{},[TX.ref+': ',h('b',{},[r.ref])]),h('span',{},[TX.status+': ',pill(statusOf(r)),cxPend?h('span',{class:'pill warn',style:'margin-inline-start:6px'},[TX.cxPill]):null]),h('span',{},[isTicket?TX.ticket:(TY[r.type]||r.type)]),(r.payment&&r.payment.source==='cart'?h('span',{class:'pill mut'},[TX.direct]):null),h('span',{},[when(r.created_at)]),
 (cxm!=='closed'&&!cxPend)?h('button',{class:'btn danger sm cxbtn',id:'sv1CancelTop',onclick:function(){cxSheet(r)}},[cxm==='now'?TX.cancelReq:TX.cancelAsk]):null]));
var cxb=cxBanner(r);if(cxb)box.appendChild(cxb);
var pl=r.status==='CANCELLED'?null:stageLine(r);if(pl)box.appendChild(pl);
var left=h('div'),right=h('div');box.appendChild(h('div',{class:'grid2'},[left,right]));
var uc=updatesCard(r);if(uc)right.appendChild(uc);
// conversation
var msgs=h('div',{class:'msgs'},(r.conversation||[]).map(function(mm){return h('div',{class:'m '+mm.role},[stripScope(mm.content),h('small',{},[(mm.role==='user'?TX.you:mm.role==='bp'?TX.team:TX.assistant)+' · '+when(mm.at)])])}));
var inp=h('input',{placeholder:TX.writeMsg}),sb=h('button',{class:'btn',onclick:function(){var v=inp.value.trim();if(!v)return;sb.disabled=true;api('request-message',{ref:r.ref,content:v}).then(function(o){sb.disabled=false;if(o&&o.ok){r.conversation=o.conversation;r.status=o.status||r.status;inp.value='';drawRequest(hd,box)}else if(!o||o.error!=='no_session')toast(failText(o))})}},[TX.send]);
onEnter(inp,sb);left.appendChild(h('div',{class:'card'},[h('h3',{},[TX.conversation]),msgs,h('div',{class:'msgform'},[inp,sb])]));setTimeout(function(){msgs.scrollTop=msgs.scrollHeight},0);
// scope
var isCart=!!(r.payment&&r.payment.source==='cart');var editable=!isCart&&['NEW','REVIEWING','WAITING_CLIENT'].indexOf(r.status)>=0&&!(r.quote&&['REJECTED','DRAFT'].indexOf(r.quote.status)<0);var sc=h('div',{class:'card'});sc.appendChild(h('h3',{},[TX.scope]));if(r.summary)sc.appendChild(h('p',{class:'note'},[r.summary]));
var ul=h('ul',{class:'items'});function drawItems(){ul.innerHTML='';(r.scope||[]).forEach(function(it,i){var li=h('li',{},[h('span',{class:'ic'},['✓']),h('div',{},[h('b',editable?{contenteditable:'true',oninput:function(){it.title=this.textContent.trim();delete it.hold}}:{},[it.title]),it.why?h('small',{},[it.why]):null,it.hold?h('small',{class:'hold'},['⏳ '+holdWhy(it.hold)]):null]),editable?h('button',{class:'rm',onclick:function(){r.scope.splice(i,1);drawItems()}},[TX.remove]):null]);ul.appendChild(li)})}drawItems();sc.appendChild(ul);
// documents the advisor asked for — every service has its own list
var dc=docsCard(r,function(){drawRequest(hd,box)});
if(editable){var ai=h('input',{class:'inp',placeholder:TX.addItem}),msgS=h('span',{class:'ok'});
// Confirming the scope is what moves the request on to the quotation; the
// plain save stays for intermediate edits.
var goBtn=h('button',{class:'btn',onclick:function(){msgS.className='ok';msgS.textContent='';goBtn.disabled=true;api('scope-confirm',{ref:r.ref,scope:r.scope}).then(function(o){goBtn.disabled=false;if(o&&o.error==='profile_required'){renderProfile(state.me,function(){refreshMe().then(function(){render()})});return}if(!o||!o.ok){msgS.className='err';msgS.textContent=(o&&o.message)||TX.error;return}state.flash=(o.stage==='QUOTE')?TX.quoteIssuedFlash:(o.holds&&o.holds.length)?TX.holdFlash:TX.scopePricing;api('request-get',{ref:r.ref}).then(function(g){if(g&&g.ok){state.req=g.request;drawRequest(hd,box);var q=document.getElementById('sv1Quote');if(q&&q.scrollIntoView)q.scrollIntoView({behavior:'smooth',block:'start'})}})})}},[TX.confirmScope]);
sc.appendChild(h('div',{class:'msgform'},[ai,h('button',{class:'btn ghost',onclick:function(){if(!ai.value.trim())return;r.scope.push({code:'',title:ai.value.trim(),why:''});ai.value='';drawItems()}},[TX.addItem]),h('button',{class:'btn ghost',onclick:function(){api('scope-update',{ref:r.ref,scope:r.scope}).then(function(o){msgS.className='ok';msgS.textContent=o&&o.ok?TX.saved:TX.error})}},[TX.saveScope]),goBtn,msgS]));
if(state.flash){sc.appendChild(h('p',{class:'ok'},[state.flash]));state.flash=null}}else if(r.status!=='CANCELLED')sc.appendChild(h('p',{class:'note'},[isCart?TX.directNote:TX.scopeLocked]));
sc.appendChild(dc.firstChild?dc:document.createComment(''));
if(!isTicket)left.appendChild(sc);
// tasks for client
if(r.tasks&&r.tasks.length)left.appendChild(h('div',{class:'card'},[h('h3',{},[TX.tasksTitle]),h('ul',{class:'items'},r.tasks.map(function(t){return h('li',{},[h('span',{class:'ic'},[t.status==='DONE'?'✓':'•']),h('div',{},[h('b',{},[t.title]),t.details?h('small',{},[t.details]):null])])}))]));
// quote — while it is being priced the customer sees the step, not silence
var heldLines=(r.scope||[]).filter(function(it){return it&&it.hold});
if(!r.quote&&heldLines.length&&['NEW','REVIEWING','WAITING_CLIENT'].indexOf(r.status)>=0)right.appendChild(h('div',{class:'card holdbox',id:'sv1Quote'},[h('h3',{},[TX.holdTitle]),h('p',{class:'note'},[TX.holdLead]),h('ul',{id:'sv1Holds'},heldLines.map(function(it){return h('li',{},[h('b',{},[it.title]),h('small',{},[holdWhy(it.hold)])])}))]));
else if(!r.quote&&(r.events||[]).some(function(e){return e.event==='quote.pending'}))right.appendChild(h('div',{class:'card',id:'sv1Quote'},[h('h3',{},[TX.quote]),h('p',{class:'note'},[TX.scopePricing])]));
if(r.quote){var qc=h('div',{class:'card',id:'sv1Quote'});qc.appendChild(h('h3',{},[TX.quote+' '+r.quote.number]));var tb=h('table',{class:'q'});tb.appendChild(h('thead',{},[h('tr',{},[h('th',{},[TX.scope]),h('th',{},[TX.qty]),h('th',{},[TX.price])])]));tb.appendChild(h('tbody',{},r.quote.items.map(function(i){return h('tr',{},[h('td',{},[i.title]),h('td',{},[String(i.qty)]),h('td',{},[money(lineOf(i))])])})));tb.appendChild(h('tfoot',{},[h('tr',{},[h('td',{colspan:'2'},[TX.net]),h('td',{},[money(r.quote.net)])]),h('tr',{},[h('td',{colspan:'2'},[TX.vat]),h('td',{},[money(r.quote.vat)])]),h('tr',{},[h('td',{colspan:'2'},[TX.total]),h('td',{},[money(r.quote.total)])])]));qc.appendChild(tb);
qc.appendChild(h('p',{class:'note'},[TX.validUntil+': '+(r.quote.valid_until||'')+' · '+TX.terms+': '+(r.quote.payment_terms||'')]));qc.appendChild(docBtn(TX.openFull,TX.quote+' '+r.quote.number,function(){return api('quote-view',{ref:r.ref}).then(function(o){return o&&o.ok?o.html:''})}));if(r.quote.notes)qc.appendChild(h('p',{class:'note'},[r.quote.notes]));if(r.quote.pending_items&&r.quote.pending_items.length)qc.appendChild(h('div',{class:'holdbox',id:'sv1Pending'},[h('h3',{},[TX.pendTitle]),h('p',{class:'note'},[TX.pendLead]),h('ul',{id:'sv1PendingList'},r.quote.pending_items.map(function(it){return h('li',{},[h('b',{},[it.title]),h('small',{},['⏳ '+holdWhy(it)])])}))]));
(r.quote.addenda||[]).forEach(function(ad){var ac=h('div',{class:'holdbox',id:'sv1Addendum-'+ad.number,style:'margin-top:12px;background:transparent;border-color:var(--line)'});ac.appendChild(h('h3',{},[TX.adTitle+' '+ad.number+' · '+money(ad.total)]));
var at=h('table',{class:'q'});at.appendChild(h('tbody',{},ad.items.map(function(i){return h('tr',{},[h('td',{},[i.title]),h('td',{},[String(i.qty)]),h('td',{},[money(lineOf(i))])])})));ac.appendChild(at);ac.appendChild(h('p',{class:'note'},[TX.validUntil+': '+(ad.valid_until||'')]));
if(ad.status==='SENT'){var aerr=h('div',{class:'err'}),anote=h('input',{class:'inp',placeholder:TX.adNote});ac.appendChild(h('div',{class:'msgform'},[h('button',{class:'btn',onclick:function(e){var bt=e.currentTarget;bt.disabled=true;api('quote-addendum-approve',{ref:r.ref,number:ad.number}).then(function(o){if(o&&o.ok){state.flash2=false;api('request-get',{ref:r.ref}).then(function(g){if(g&&g.ok){state.req=g.request;drawRequest(hd,box)}})}else{bt.disabled=false;aerr.textContent=o&&o.error==='quote_expired'?TX.quoteExpired:((o&&o.message)||TX.error)}})}},[TX.adApprove]),anote,h('button',{class:'btn ghost',onclick:function(e){var bt=e.currentTarget;if(anote.value.trim().length<3){aerr.textContent=TX.adNote;return}bt.disabled=true;api('quote-addendum-reject',{ref:r.ref,number:ad.number,note:anote.value.trim()}).then(function(o){bt.disabled=false;if(o&&o.ok){api('request-get',{ref:r.ref}).then(function(g){if(g&&g.ok){state.req=g.request;drawRequest(hd,box)}})}else aerr.textContent=(o&&o.message)||TX.error})}},[TX.adReject])]));ac.appendChild(aerr)}
else if(ad.status==='APPROVED')ac.appendChild(h('p',{class:'ok'},['✓ '+TX.adDone]));
qc.appendChild(ac)});
if(r.quote.client_notes)qc.appendChild(h('p',{class:'note',id:'sv1ClientNotes'},[TX.clientNotes+': '+r.quote.client_notes]));
if(r.status==='QUOTE_SENT'){var qerr=h('div',{class:'err'});var isExp=/^\\d{4}-\\d{2}-\\d{2}$/.test(String(r.quote.valid_until||''))&&r.quote.valid_until<new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Riyadh'});var renewBtn=h('button',{class:'btn',id:'sv1Renew',onclick:function(e){var bt=e.currentTarget;bt.disabled=true;api('request-message',{ref:r.ref,content:TX.renewMsg+' '+r.quote.number}).then(function(o){if(o&&o.ok){toast(TX.renewSent,true)}else{bt.disabled=false;toast(failText(o))}})}},[TX.renewAsk]);if(isExp)qc.appendChild(h('p',{class:'err',id:'sv1Expired'},[TX.expiredNote]));function qfail(bt,o){bt.disabled=false;qerr.textContent=o&&o.error==='quote_expired'?TX.quoteExpired:((o&&o.message)||TX.error)}
qc.appendChild(h('div',{class:'msgform'},[isExp?renewBtn:h('button',{class:'btn',id:'sv1Approve',onclick:function(e){var bt=e.currentTarget;qerr.textContent='';bt.disabled=true;api('quote-approve',{ref:r.ref}).then(function(o){if(o&&o.ok){r.status=o.status;r.quote=o.quote;if(o.contract)r.contract=o.contract;refreshMe();drawRequest(hd,box)}else{bt.disabled=false;toast(o&&o.error==='quote_expired'?TX.quoteExpired:failText(o))}}).catch(function(){qfail(bt)})}},[TX.approve]),h('button',{class:'btn ghost',id:'sv1Revise',onclick:function(){qerr.textContent='';reviseSheet(r,function(o){r.status=o.status;r.quote=o.quote;state.flash2=true;refreshMe();drawRequest(hd,box)})}},[TX.reject])]));qc.appendChild(qerr)}
else if(r.quote.status==='REJECTED'){qc.appendChild(h('div',{class:'cx-state pend',id:'sv1ReviseState'},[h('h3',{},[TX.revSentTitle]),h('p',{},[TX.revSentText]),r.quote.decision_note?h('p',{style:'margin-top:6px'},[TX.revYouAsked+' « '+r.quote.decision_note+' »']):null]))}
else if(r.quote.status==='APPROVED')qc.appendChild(h('p',{class:'ok'},[(r.status==='QUOTE_APPROVED'||r.status==='CONTRACT_SENT')?TX.quoteApproved:TX.quoteApprovedDone]));
right.appendChild(qc)}
// contract
if(r.contract){var cc=h('div',{class:'card'});cc.appendChild(h('h3',{},[TX.contract+' '+r.contract.number]));var frame=h('iframe',{class:'contract-frame',title:TX.contract});cc.appendChild(frame);cc.appendChild(docBtn(TX.openFull,TX.contract+' '+r.contract.number,function(){return api('contract-view',{ref:r.ref}).then(function(o){return o&&o.ok?o.html:''})}));api('contract-view',{ref:r.ref}).then(function(o){var ht=o&&o.ok?o.html:'';frame.srcdoc=ht;state.contractHtml=ht;if(o&&o.needsResign)cc.appendChild(h('p',{class:'note',style:'color:#B45309'},[TX.resign]))});
if(r.status==='CONTRACT_SENT'){cc.appendChild(h('h3',{style:'margin-top:14px'},[TX.signTitle]));var nm=h('input',{class:'inp',placeholder:TX.signName,value:state.me.user.name||''});cc.appendChild(nm);cc.appendChild(h('p',{class:'note',style:'margin:8px 0 4px'},[TX.signDraw]));var cv=h('canvas',{class:'sig',width:'600',height:'150'});cc.appendChild(cv);var ctx2=cv.getContext('2d'),drawing=false,drew=false;ctx2.lineWidth=2;ctx2.lineCap='round';ctx2.strokeStyle='#0B1B5A';function pos(e){var rc=cv.getBoundingClientRect();var p=e.touches?e.touches[0]:e;return [(p.clientX-rc.left)*cv.width/rc.width,(p.clientY-rc.top)*cv.height/rc.height]}
cv.addEventListener('pointerdown',function(e){drawing=true;var p=pos(e);ctx2.beginPath();ctx2.moveTo(p[0],p[1])});cv.addEventListener('pointermove',function(e){if(!drawing)return;var p=pos(e);ctx2.lineTo(p[0],p[1]);ctx2.stroke();drew=true});window.addEventListener('pointerup',function(){drawing=false});
var cons=h('input',{type:'checkbox',id:'consent'});var err=h('div',{class:'err'});nm.addEventListener('input',function(){err.textContent=''});cons.addEventListener('change',function(){err.textContent=''});cv.addEventListener('pointerup',function(){err.textContent=''});cc.appendChild(h('div',{class:'msgform'},[h('button',{class:'btn ghost sm',onclick:function(){ctx2.clearRect(0,0,cv.width,cv.height);drew=false}},[TX.signClear])]));cc.appendChild(h('label',{style:'display:flex;gap:8px;align-items:flex-start;margin:10px 0;font-size:.86rem'},[cons,h('span',{},[TX.signConsent])]));
cc.appendChild(h('button',{class:'btn',onclick:function(){err.textContent='';if(nm.value.replace(/\\s+/g,'').length<3){err.textContent=TX.signNameErr;return}if(!drew){err.textContent=TX.signDrawErr;return}if(!cons.checked){err.textContent=TX.signConsent;return}api('contract-sign',{ref:r.ref,name:nm.value.trim(),consent:true,signature:cv.toDataURL('image/png')}).then(function(o){if(o&&o.ok){r.status=o.status;r.contract=o.contract;r.payment={status:'PENDING',amount:r.quote.total};refreshMe();drawRequest(hd,box)}else err.textContent=(o&&o.message)||TX.error})}},[TX.signBtn]));cc.appendChild(err)}
else if(r.contract.status==='SIGNED')cc.appendChild(h('p',{class:'ok'},['✓ '+TX.signed+' · '+when(r.contract.signed_at)]));
right.appendChild(cc)}
// NDA (optional): the paper as it was printed, signed once with the same steps as the contract
if(r.nda){var nc=h('div',{class:'card',id:'sv1Nda'});nc.appendChild(h('h3',{},[TX.nda+' '+r.nda.number]));nc.appendChild(h('p',{class:'note'},[TX.ndaLead]));
nc.appendChild(docBtn(TX.openFull,TX.nda+' '+r.nda.number,function(){return api('nda-view',{ref:r.ref}).then(function(o){return o&&o.ok?o.html:''})}));
if(r.nda.status==='SIGNED')nc.appendChild(h('p',{class:'ok'},['✓ '+TX.ndaSigned+' · '+when(r.nda.signed_at)]));
else if(r.status!=='CANCELLED'){var nnm=h('input',{class:'inp',id:'ndaName',placeholder:TX.signName,value:state.me.user.name||''});nc.appendChild(nnm);nc.appendChild(h('p',{class:'note',style:'margin:8px 0 4px'},[TX.signDraw]));var ncv=h('canvas',{class:'sig',id:'ndaSig',width:'600',height:'150'});nc.appendChild(ncv);var nx=ncv.getContext('2d'),ndr=false,ndrew=false;nx.lineWidth=2;nx.lineCap='round';nx.strokeStyle='#0B1B5A';
function npos(e){var rc=ncv.getBoundingClientRect();var p=e.touches?e.touches[0]:e;return [(p.clientX-rc.left)*ncv.width/rc.width,(p.clientY-rc.top)*ncv.height/rc.height]}
ncv.addEventListener('pointerdown',function(e){ndr=true;var p=npos(e);nx.beginPath();nx.moveTo(p[0],p[1])});ncv.addEventListener('pointermove',function(e){if(!ndr)return;var p=npos(e);nx.lineTo(p[0],p[1]);nx.stroke();ndrew=true});window.addEventListener('pointerup',function(){ndr=false});
var ncons=h('input',{type:'checkbox',id:'ndaConsent'});var nerr=h('div',{class:'err'});
nc.appendChild(h('div',{class:'msgform'},[h('button',{class:'btn ghost sm',onclick:function(){nx.clearRect(0,0,ncv.width,ncv.height);ndrew=false}},[TX.signClear])]));
nc.appendChild(h('label',{style:'display:flex;gap:8px;align-items:flex-start;margin:10px 0;font-size:.86rem'},[ncons,h('span',{},[TX.signConsent])]));
nc.appendChild(h('button',{class:'btn',id:'ndaSignBtn',onclick:function(){nerr.textContent='';if(nnm.value.replace(/\\s+/g,'').length<3){nerr.textContent=TX.signNameErr;return}if(!ndrew){nerr.textContent=TX.signDrawErr;return}if(!ncons.checked){nerr.textContent=TX.signConsent;return}api('nda-sign',{ref:r.ref,name:nnm.value.trim(),consent:true,signature:ncv.toDataURL('image/png')}).then(function(o){if(o&&o.ok){r.nda=o.nda;refreshMe();drawRequest(hd,box)}else nerr.textContent=(o&&o.error==='already_signed')?TX.ndaSigned:((o&&o.message)||TX.error)})}},[TX.ndaSignBtn]));nc.appendChild(nerr)}
right.appendChild(nc)}
// payment
if(['SIGNED','PAYMENT_PENDING'].indexOf(r.status)>=0&&r.quote&&payReview(r)){var rc=h('div',{class:'card',id:'sv1PayReview'});rc.appendChild(h('h3',{},[TX.reviewTitle+' · '+money(payAmt(r))]));rc.appendChild(h('p',{class:'note'},[TX.reviewText]));right.appendChild(rc)}
else if(['SIGNED','PAYMENT_PENDING'].indexOf(r.status)>=0&&r.quote){var pc=h('div',{class:'card'});pc.appendChild(h('h3',{},[TX.payment+' · '+money(r.quote.total)]));if(r.payment&&r.payment.status&&r.payment.status!=='PENDING'&&r.payment.status!=='PAID'){var ps=String(r.payment.status).toUpperCase();pc.appendChild(h('p',{class:ps==='FAILED'?'err':'note',id:'sv1PayState'},[ps==='FAILED'?TX.payFailedMsg:ps==='CANCELLED'?TX.payCancelledMsg:TX.payPendingMsg]))}
function gwGo(provider){var back=encodeURIComponent(location.pathname+'?view=request&ref='+encodeURIComponent(r.ref));
location.href='/api/pay?action=mock-form&provider='+provider+'&amount='+encodeURIComponent(String((r.quote&&r.quote.total)||0))+'&label='+encodeURIComponent(r.ref)+'&back='+back}
function payHere(provider){
  // Test/local: the gateway this server hosts. Otherwise the cart + checkout
  // the rest of the site uses, which needs the classic session.
  if(state.testMode){gwGo(provider);return}
  api('checkout-start',{ref:r.ref}).then(function(o){if(!o||!o.ok){if(!o||o.error!=='no_session')toast(failText(o));return}try{var cart=JSON.parse(localStorage.getItem('bp_cart')||'[]');cart=cart.filter(function(i){return i.id!==o.item.id});cart.push(o.item);localStorage.setItem('bp_cart',JSON.stringify(cart))}catch(x){}location.href=CHECKOUT})}
var payRow=h('div',{style:'display:flex;gap:7px;flex-wrap:wrap'},[
  h('button',{class:'btn',onclick:function(){payHere('card')}},[TX.payCardNow]),
  h('button',{class:'btn ghost',onclick:function(){payHere('tamara')}},[TX.payTamaraNow]),
  h('button',{class:'btn ghost',id:'sv1PayBank',onclick:function(){bankToggle()}},[TX.payBankNow])]);
pc.appendChild(payRow);pc.appendChild(h('p',{class:'note'},[TX.payVia]));
var bankBox=h('div',{id:'sv1BankPanel',hidden:true,style:'margin-top:12px'}),bankReady=false,bankBusy=false;
function bankNote(msg,kind){var n=bankBox.querySelector('#sv1BankNote');if(n){n.textContent=msg||'';n.className=kind||'note'}}
function bankCopy(txt,btn){function done(){btn.textContent=TX.copied;setTimeout(function(){btn.textContent=TX.copy},1500)}
 try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(done,function(){});return}}catch(e){}
 try{var ta=document.createElement('textarea');ta.value=txt;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);done()}catch(e){}}
function bankRow(label,val,raw,ltr){return h('div',{style:'display:flex;gap:8px;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding:7px 0;flex-wrap:wrap'},[h('span',{class:'note',style:'margin:0'},[label]),h('b',{style:'overflow-wrap:anywhere'+(ltr?';direction:ltr':'')},[val]),h('button',{class:'btn ghost sm',onclick:function(ev){bankCopy(raw||val,ev.currentTarget)}},[TX.copy])])}
function bankErr(code){return code==='login_required'?TX.bkLogin:code==='slow_down'?TX.bkSlow:code==='request_closed'||code==='not_payable'||code==='not_found'?TX.bkClosed:code==='already_paid'?TX.bkPaid:code==='too_large'?TX.bkTooBig:code==='bad_type'?TX.bkBadType:code==='bank_not_configured'?TX.bkOff:TX.bkFail}
function bankShrink(file){return new Promise(function(res){if(!/^image\\//.test(file.type)||file.size<=900*1024){res(file);return}
 try{var img=new Image(),u=URL.createObjectURL(file);img.onload=function(){var k=Math.min(1,1800/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);c.getContext('2d').drawImage(img,0,0,c.width,c.height);try{URL.revokeObjectURL(u)}catch(e){}c.toBlob(function(b){res(b&&b.size<file.size?b:file)},'image/jpeg',0.82)};img.onerror=function(){res(file)};img.src=u}catch(e){res(file)}})}
function bankB64(blob){return new Promise(function(res,rej){var fr=new FileReader();fr.onload=function(){var u=String(fr.result||'');res(u.slice(u.indexOf(',')+1))};fr.onerror=function(){rej(new Error('read'))};fr.readAsDataURL(blob)})}
function bankSend(inp,btn){
 if(bankBusy)return;var f=inp.files&&inp.files[0];
 if(!f){bankNote(TX.bkNeedFile,'err');return}
 if(!/^(image\\/(jpeg|png|webp)|application\\/pdf)$/.test(String(f.type||'').toLowerCase())){bankNote(TX.bkBadType,'err');return}
 bankBusy=true;btn.disabled=true;bankNote(TX.bkSending);
 bankShrink(f).then(function(g){if(g.size>3*1024*1024)throw new Error('big');return bankB64(g).then(function(b64){return {name:f.name,mime:String(g.type||f.type),base64:b64}})})
 .then(function(file){return fetch('/api/pay',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({action:'bank-receipt',lang:LANG,requestRef:r.ref,file:file})}).then(function(x){return x.json()})})
 .then(function(j){bankBusy=false;btn.disabled=false;
  if(!(j&&j.ok)){bankNote(bankErr(j&&j.error),'err');return}
  var inv=j.invoice&&j.invoice.number?String(j.invoice.number):'';
  if(j.state==='approved'){toast(TX.bkApproved+(inv?' · '+TX.bkInv+': '+inv:''),true)}
  else{var why=(j.reasonsText||[]).filter(Boolean).join(' · ');toast(TX.bkReview+(why?' '+TX.bkWhy+why:''),true)}
  api('request-get',{ref:r.ref}).then(function(o){if(o&&o.ok){state.req=o.request;refreshMe();drawRequest(hd,box)}})})
 .catch(function(e){bankBusy=false;btn.disabled=false;bankNote(e&&e.message==='big'?TX.bkTooBig:TX.bkFail,'err')})}
function bankBuild(bk){
 bankBox.innerHTML='';
 if(!bk||!bk.enabled){bankBox.appendChild(h('p',{class:'note'},[TX.bkOff]));return}
 bankBox.appendChild(h('h3',{},[TX.bkTitle]));bankBox.appendChild(h('p',{class:'note'},[TX.bkHow]));
 var iban=String(bk.iban||'').replace(/\\s+/g,'');
 bankBox.appendChild(bankRow(TX.bkBene,LANG==='ar'?bk.beneficiary:(bk.beneficiaryEn||bk.beneficiary),''));
 bankBox.appendChild(bankRow(TX.bkBank,LANG==='ar'?(bk.bank||bk.bankEn):(bk.bankEn||bk.bank),''));
 bankBox.appendChild(bankRow(TX.bkIban,iban.replace(/(.{4})/g,'$1 ').trim(),iban,true));
 bankBox.appendChild(bankRow(TX.bkAmt,money(r.quote.total),Number(r.quote.total).toFixed(2)));
 bankBox.appendChild(bankRow(TX.bkRef,r.ref,r.ref,true));
 var inp=h('input',{type:'file',id:'sv1BankFile',accept:'image/jpeg,image/png,image/webp,application/pdf','aria-label':TX.bkFile,style:'margin-top:12px;max-width:100%'});
 var go=h('button',{class:'btn',id:'sv1BankGo',style:'margin-top:10px',onclick:function(){bankSend(inp,go)}},[TX.bkGo]);
 bankBox.appendChild(h('p',{class:'note',style:'margin:12px 0 0'},[TX.bkFile]));bankBox.appendChild(inp);bankBox.appendChild(go);
 bankBox.appendChild(h('p',{class:'note',id:'sv1BankNote',role:'status','aria-live':'polite'},['']))}
function bankToggle(){
 if(!bankReady){bankReady=true;bankBox.hidden=false;
  fetch('/api/pay',{credentials:'same-origin',cache:'no-store'}).then(function(x){return x.json()}).then(function(o){bankBuild(o&&o.bank)}).catch(function(){bankBuild(null)});return}
 bankBox.hidden=!bankBox.hidden}
pc.appendChild(bankBox);

if(state.testMode){
pc.appendChild(h('h3',{style:'margin-top:12px'},[TX.testPay]));var tp=h('div',{style:'display:flex;gap:6px;flex-wrap:wrap'});[['success','card',TX.paySuccess,''],['success','tamara',TX.payTamara,''],['failed','card',TX.payFailed,'danger'],['cancelled','card',TX.payCancelled,'ghost'],['pending','card',TX.payPending,'ghost']].forEach(function(x){tp.appendChild(h('button',{class:'btn sm '+x[3],onclick:function(){api('pay-test',{ref:r.ref,outcome:x[0],provider:x[1]}).then(function(o){if(o&&o.ok){r.status=o.status;r.payment=o.payment;if(o.invoice)r.invoice=o.invoice;refreshMe();drawRequest(hd,box)}else if(!o||o.error!=='no_session')toast(failText(o))})}},[x[2]]))});pc.appendChild(tp)}
right.appendChild(pc)}
// شراء مباشر بالسلة: ما اشتُري ومبالغه ودورته، من سجلّ الدفع نفسه (لا عرض سعر لهذا الطلب).
if(r.payment&&r.payment.source==='cart'){var pi=r.payment,bc=h('div',{class:'card',id:'sv1Bought'});bc.appendChild(h('h3',{},[TX.bought]));var bt=h('table',{class:'q'});bt.appendChild(h('thead',{},[h('tr',{},[h('th',{},[TX.scope]),h('th',{},[TX.qty]),h('th',{},[TX.price])])]));bt.appendChild(h('tbody',{},(pi.items||[]).map(function(i){return h('tr',{},[h('td',{},[i.name+(i.cycle?' · '+(i.cycle==='yearly'?TX.cycY:TX.cycM):'')]),h('td',{},[String(i.qty||1)]),h('td',{},[i.amount==null?'—':money(i.amount)])])})));bt.appendChild(h('tfoot',{},[h('tr',{},[h('td',{colspan:'2'},[TX.net]),h('td',{},[money(pi.net)])]),h('tr',{},[h('td',{colspan:'2'},[TX.vat]),h('td',{},[money(pi.vat)])]),h('tr',{},[h('td',{colspan:'2'},[TX.total]),h('td',{},[money(pi.total||pi.amount)])])]));bc.appendChild(bt);if(pi.verified===false)bc.appendChild(h('p',{class:'note'},[TX.unverifiedNote]));right.appendChild(bc)}
if(r.payment&&r.payment.status==='PAID')right.appendChild(h('div',{class:'card'},[h('h3',{},[TX.payment]),h('p',{class:'ok'},['✓ '+TX.paid+' · '+money(r.payment.amount)+' · '+provName(r.payment.provider)+' · '+when(r.payment.at)])]));
if(r.invoice)right.appendChild(h('div',{class:'card'},[h('h3',{},[TX.invoice+' '+r.invoice.number]),h('p',{},[money(r.invoice.total)+' · '+when(r.invoice.issued_at)]),h('button',{class:'btn ghost sm',onclick:function(){openInvoice(r)}},[r.invoice.pdf_url?TX.invOfficial:TX.download])]));
var dvc=delivCard(r);if(dvc)right.appendChild(dvc);
// appointment
if(r.type==='CONSULTATION'&&!isTicket){var ac=h('div',{class:'card'});ac.appendChild(h('h3',{},[TX.navAppts]));var a=r.appointment;if(a&&a.status!=='CANCELLED'){ac.appendChild(h('p',{class:'note'},[TX.videoFree]));ac.appendChild(h('p',{class:'ok'},['📅 '+a.date+' · '+a.time+' ('+c12(a.time)+') · '+TX.riyadh+' · '+(a.topic||'')]));ac.appendChild(joinBox(a))}
var sp=slotPicker(),d=sp.day,tm=sp.time,tp2=h('input',{class:'inp',placeholder:TX.topic,value:(a&&a.topic)||r.title}),ae=h('div',{class:'err'});
ac.appendChild(h('div',{class:'form'},[h('label',{},[TX.date]),d,h('label',{},[TX.time]),tm,h('label',{},[TX.topic]),tp2,h('div',{class:'msgform'},[h('button',{class:'btn',onclick:function(){ae.textContent='';if(!d.value||!tm.value){ae.textContent=TX.apptBad;return}api(a&&a.status!=='CANCELLED'?'appointment-reschedule':'appointment-book',{ref:r.ref,date:d.value,time:tm.value,topic:tp2.value}).then(function(o){if(o&&o.ok){r.appointment=o.appointment;refreshMe();drawRequest(hd,box)}else if(o&&o.error==='no_session'){}else ae.textContent=apptErr(o)})}},[a&&a.status!=='CANCELLED'?TX.reschedule:TX.book]),a&&a.status!=='CANCELLED'?h('button',{class:'btn danger',onclick:function(){api('appointment-cancel',{ref:r.ref}).then(function(o){if(o&&o.ok){r.appointment=o.appointment;refreshMe();drawRequest(hd,box)}else if(!o||o.error!=='no_session')toast(failText(o))})}},[TX.cancelAppt]):null]),ae,sp.note,h('p',{class:'note'},[TX.apptNote])]));right.appendChild(ac)}
// timeline
right.appendChild(h('div',{class:'card'},[h('h3',{},[TX.timeline]),h('ul',{class:'tl'},tlEvents(r).slice().reverse().map(function(e){return h('li',{},[h('time',{},[when(e.created_at)]),h('i',{class:e.actor_kind},[e.actor_kind==='ai'?'AI':e.actor_kind==='human'?'👤':e.actor_kind==='customer'?'🙂':'⚙']),h('span',{},[(actorName(e)?actorName(e)+': ':'')+(EV[e.event]||e.event)+(e.details&&e.details.number?' '+e.details.number:'')])])}))]));
if(cxm!=='closed'&&!cxPend){right.appendChild(h('div',{class:'card',id:'sv1Cancel'},[h('h3',{},[TX.cancelTitle]),h('p',{class:'note'},[cxText(r)+((cxm==='now'&&cxApptLive(r))?' '+TX.cxAppt:'')]),h('div',{class:'msgform',style:'margin-top:8px'},[h('button',{class:'btn danger sm',onclick:function(){cxSheet(r)}},[cxm==='now'?TX.cancelReq:TX.cancelAsk])])]))}}
// ---------- asking for changes to a quotation (D4)
// A reason is required (the team needs something to act on), the customer
// confirms, and is told what happens next. Ours, not window.prompt.
function reviseSheet(r,done){
 if(document.getElementById('sv1ReviseSheet'))return;
 var note=h('textarea',{id:'sv1ReviseNote',rows:'4',maxlength:'500',placeholder:TX.rejectNote,'aria-label':TX.rejectNote});
 var err=h('div',{class:'err',role:'alert',style:'margin-top:8px'});
 var ok=h('button',{class:'btn',id:'sv1ReviseOk'},[TX.revGo]);
 var keep=h('button',{class:'btn ghost',id:'sv1ReviseKeep'},[TX.cxKeep]);
 var ovl=h('div',{class:'cx-ovl',id:'sv1ReviseSheet',role:'dialog','aria-modal':'true','aria-label':TX.revTitle},[
  h('div',{class:'cx-box'},[h('h3',{},[TX.revTitle]),h('p',{},[TX.revText]),note,err,h('div',{class:'acts'},[ok,keep])])]);
 function close(){document.removeEventListener('keydown',onKey);ovl.remove()}
 function onKey(e){if(e.key==='Escape')close()}
 keep.addEventListener('click',close);
 ovl.addEventListener('click',function(e){if(e.target===ovl)close()});
 note.addEventListener('input',function(){err.textContent=''});
 document.addEventListener('keydown',onKey);
 ok.addEventListener('click',function(){
  err.textContent='';var v=note.value.trim();
  if(v.length<3){err.textContent=TX.revNeed;note.focus();return}
  ok.disabled=true;keep.disabled=true;
  api('quote-reject',{ref:r.ref,note:v}).then(function(o){
   ok.disabled=false;keep.disabled=false;
   if(!o||!o.ok){err.textContent=(o&&o.error==='note_required')?TX.revNeed:failText(o);return}
   close();done(o)})});
 document.body.appendChild(ovl);try{note.focus()}catch(x){}}
// ---------- cancellation
// One policy, held by the server (cancel_policy on the request): 'now' when
// nothing has been signed or paid, 'ask' when the team has to look first.
// This page only words it — it never decides it.
function cxApi(action,data){return fetch('/api/simple',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({action:action},data||{}))}).then(function(r){return r.json().catch(function(){return {ok:false,error:'server_error'}})}).catch(function(){return {ok:false,error:'network'}})}
function cxErr(o){var e=(o&&o.error)||'';return e==='already_closed'?TX.cxErrClosed:(e==='no_session'||e==='unauthorized')?TX.cxErrSess:e==='network'?TX.cxErrNet:e==='not_found'?TX.cxErrNF:TX.cxErrGen}
function cxMode(r){if(['CANCELLED','COMPLETED'].indexOf(r.status)>=0)return 'closed';return r.cancel_policy==='now'?'now':'ask'}
function cxText(r){if(cxMode(r)==='now')return TX.cxNowNote;if(r.payment&&r.payment.status==='PAID')return TX.cxPaid;if(r.contract&&r.contract.status==='SIGNED')return TX.cxSigned;return TX.cancelLate}
function paidReq(r){return !!(r.payment&&r.payment.status==='PAID')||!!(r.invoice&&r.invoice.number)}
function cxApptLive(r){return !!(r.appointment&&r.appointment.status!=='CANCELLED')}
function cxBanner(r){
 if(r.status==='CANCELLED'){var c=r.cancel||{};return h('div',{class:'cx-state done',id:'sv1CancelState'},[h('h3',{},[TX.cxDoneNow+(c.at?' · '+when(c.at):'')]),h('p',{},[(c.by==='ops'?'':TX.cxDoneNowT+' ')+(c.note?'« '+c.note+' »':'')]),(c.was_paid||paidReq(r))?h('p',{id:'sv1CancelPaid',style:'margin-top:6px'},[TX.cxPaidDone]):null,h('a',{class:'btn ghost sm',href:HOME+'#chat'},[TX.cxNewReq])])}
 if(r.cancel_request){var q=r.cancel_request;return h('div',{class:'cx-state pend',id:'sv1CancelState'},[h('h3',{},[TX.cxPendTitle]),h('p',{},[TX.cxPendText+' '+TX.cxSentAt+' '+when(q.at)+'.'+(q.note?' « '+q.note+' »':'')+(paidReq(r)?' '+TX.cxPendPaid:'')])])}
 return null}
function cxSheet(r){
 if(document.getElementById('sv1CancelSheet'))return;
 var now=cxMode(r)==='now';
 var note=h('input',{class:'inp',placeholder:TX.cancelWhy,maxlength:'500',style:'border-color:#cfd6e6'});
 var err=h('div',{class:'err',role:'alert',style:'margin-top:8px'});
 var ok=h('button',{class:'btn solid-danger',id:'sv1CancelOk'},[now?TX.cxNowGo:TX.cxAskGo]);
 var keep=h('button',{class:'btn ghost',id:'sv1CancelKeep'},[TX.cxKeep]);
 var ovl=h('div',{class:'cx-ovl',id:'sv1CancelSheet',role:'dialog','aria-modal':'true','aria-label':now?TX.cxNowTitle:TX.cxAskTitle},[
  h('div',{class:'cx-box'},[h('h3',{},[now?TX.cxNowTitle:TX.cxAskTitle]),h('p',{},[cxText(r)+((now&&cxApptLive(r))?' '+TX.cxAppt:'')]),note,err,h('div',{class:'acts'},[ok,keep])])]);
 function close(){document.removeEventListener('keydown',onKey);ovl.remove()}
 function onKey(e){if(e.key==='Escape')close()}
 keep.addEventListener('click',close);
 ovl.addEventListener('click',function(e){if(e.target===ovl)close()});
 document.addEventListener('keydown',onKey);
 ok.addEventListener('click',function(){
  err.textContent='';ok.disabled=true;keep.disabled=true;
  cxApi('request-cancel',{ref:r.ref,note:note.value.trim()}).then(function(o){
   ok.disabled=false;keep.disabled=false;
   if(!o||!o.ok){err.textContent=cxErr(o);return}
   close();
   // a cancelled request's line must not wait in the cart
   try{var cart=JSON.parse(localStorage.getItem('bp_cart')||'[]');localStorage.setItem('bp_cart',JSON.stringify(cart.filter(function(i){return i.id!=='sv1:'+r.ref})))}catch(x){}
   // re-read everything: the page then shows what the server holds, and the
   // sidebar badges and counters move with it. A request that was removed from
   // the customer's list (nothing signed, nothing paid) has nothing left to show:
   // go back to the list instead of re-reading a page that no longer exists.
   refreshMe().then(function(){if(o.hidden){toast(TX.cxGone,true);go('requests');window.scrollTo(0,0);return}render();window.scrollTo(0,0)})})});
 document.body.appendChild(ovl);
 try{keep.focus()}catch(x){}}
// The official invoice is the PDF the accounting system issued and the request
// kept (invoice.pdf_url): that is what opens when it exists. Only when it does
// not does the page below stand in — it carries the seller's tax number, taken
// from the site's legal data, so it is never a bare list of lines.
function openInvoice(r){var inv=r.invoice;
 if(inv.pdf_url&&/^https?:[/][/]/i.test(String(inv.pdf_url))){window.open(inv.pdf_url,'_blank','noopener');return}
 var w=window.open('','_blank');if(!w)return;var sellerName=LANG==='ar'?(SELLER.name||SELLER.nameEn):(SELLER.nameEn||SELLER.name);var sellerBlock='<p><b>'+TX.invSeller+':</b> '+esc(sellerName)+(SELLER.vat?'<br><b>'+TX.invVat+':</b> '+esc(SELLER.vat):'')+'</p>';var rows=(inv.items||[]).map(function(i){return '<tr><td>'+esc(i.title)+'</td><td>'+i.qty+'</td><td>'+money(lineOf(i))+'</td></tr>'}).join('');w.document.write('<!doctype html><html dir="'+(LANG==='ar'?'rtl':'ltr')+'"><head><meta charset="utf-8"><title>'+inv.number+'</title><style>body{font-family:"IBM Plex Sans Arabic",system-ui;padding:32px;color:#1F2430}h1{color:#0B1B5A}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #e4e8f1;text-align:start}.t{font-weight:700}.tm{background:#b45309;color:#fff;padding:6px 10px;display:inline-block;border-radius:6px}</style></head><body>'+(inv.mode==='test'?'<span class="tm">TEST MODE</span>':'')+'<h1>Business Partner — '+TX.invoice+' '+inv.number+'</h1><p><span>'+TX.ref+':</span> <bdi dir="ltr">'+esc(r.ref)+'</bdi> · <bdi>'+esc(when(inv.issued_at))+'</bdi></p>'+sellerBlock+'<p><b>'+TX.invBuyer+':</b> '+esc((inv.bill_to&&(inv.bill_to.company||inv.bill_to.name))||'')+'</p><table><thead><tr><th>'+TX.scope+'</th><th>'+TX.qty+'</th><th>'+TX.price+'</th></tr></thead><tbody>'+rows+'</tbody><tfoot><tr><td colspan="2">'+TX.net+'</td><td>'+money(inv.net)+'</td></tr><tr><td colspan="2">'+TX.vat+'</td><td>'+money(inv.vat)+'</td></tr><tr class="t"><td colspan="2">'+TX.total+'</td><td>'+money(inv.total)+'</td></tr></tfoot></table><p><b>'+TX.paid+'</b></p></body></html>');w.document.close()}
function esc(s){return String(s==null?'':s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})}
function refreshMe(){return api('me').then(function(o){if(o&&o.ok){state.me=o}}).catch(function(){})}
// Coming back from a payment gateway (local or hosted): the outcome rides on
// the URL exactly as Moyasar and Tamara return it, and is settled through the
// same action the test buttons use — one settle path, not two.
function settleReturn(u){
  var pay=u.searchParams.get('payment'),pid=u.searchParams.get('id'),ref=u.searchParams.get('ref');
  if(!pay||!ref)return Promise.resolve(false);
  var outcome=pay==='paid'?'success':(pay==='failed'?'failed':(pay==='cancelled'?'cancelled':'pending'));
  var provider=u.searchParams.get('provider')==='tamara'?'tamara':'card';
  return api('pay-test',{ref:ref,outcome:outcome,provider:provider,reference:pid||''}).then(function(){
    u.searchParams.delete('payment');u.searchParams.delete('id');u.searchParams.delete('amount');u.searchParams.delete('provider');
    history.replaceState({},'',u.pathname+u.search);return true}).catch(function(){return false});
}
// A visitor sent here to sign in (from /ops, say) lands back where he was
// going. Only a same-origin path is honoured — never a full URL, and never a
// protocol-relative «//host», which a browser reads as another site.
// بمقارنة الحروف لا بتعبير نمطي: هذا السطر يُكتب داخل قالب نصّي، والقالب
// يلتهم الشرطة المائلة العكسية عند البناء — فيخرج /^/[^/]/ إلى الصفحة، وهو
// خطأ نحوي يُسقط سكربت اللوحة كله فلا تُفتح البوابة أصلاً. المقارنة تفعل
// الشيء نفسه: مسارٌ محلي يبدأ بشرطة واحدة، ولا يبدأ بشرطتين («//host» يقرؤه
// المتصفح موقعاً آخر).
function nextPath(){try{var n=decodeURIComponent(new URL(location.href).searchParams.get('next')||'');return (n.charAt(0)==='/'&&n.charAt(1)!=='/')?n:''}catch(e){return ''}}
// D2 — a request built in the chat lives in that tab's sessionStorage, and an
// e-mailed link opens a NEW tab that cannot see it. The home page therefore
// leaves a copy in localStorage (one hour, removed when the request is created);
// the tab the link opens picks it up after sign-in and finishes the job.
function pendingQuote(){try{var p=JSON.parse(localStorage.getItem('sv1_pending_quote')||'null');if(p&&p.at&&Date.now()-p.at<36e5&&p.draft&&p.draft.items&&p.draft.items.length)return p}catch(e){}return null}
function resumePath(){try{if(sessionStorage.getItem('sv1_link_resume')==='1'&&pendingQuote()){sessionStorage.removeItem('sv1_link_resume');sessionStorage.setItem('sv1_resume_quote','1');return HOME+'?resume=quote#advisor'}}catch(e){}return ''}
// D3 — the name and mobile step. Optional only for someone who is already
// contracted (so a client who must pay is never locked out of paying).
function digitsOf(v){var d='',i,c;v=String(v||'');for(i=0;i<v.length;i++){c=v.charCodeAt(i);if(c>=48&&c<=57)d+=v.charAt(i);else if(c>=1632&&c<=1641)d+=String(c-1632);else if(c>=1776&&c<=1785)d+=String(c-1776)}return d}
function phoneValid(v){var d=digitsOf(v);return d.length>=8&&d.length<=15}
function nameValid(v){var w=String(v||'').split(' ').filter(function(x){return x.length>=2}),i,c,t=String(v||'');if(t.trim().length<5||w.length<2)return false;for(i=0;i<t.length;i++){c=t.charCodeAt(i);if((c>=48&&c<=57)||(c>=1632&&c<=1641)||(c>=1776&&c<=1785)||'@<>{}'.indexOf(t.charAt(i))>=0)return false}return true}
function profileLater(o){try{if(sessionStorage.getItem('sv1_profile_later')==='1')return true}catch(e){}return false}
function profileSkippable(o){return ((o&&o.requests)||[]).some(function(r){return ['CONTRACT_SENT','SIGNED','PAYMENT_PENDING','PAID','IN_PROGRESS'].indexOf(r.status)>=0})}
function renderProfile(o,after){app.innerHTML='';var box=h('div',{class:'login',id:'sv1Profile'});var errEl=h('div',{class:'err',role:'alert'});
var nm=h('input',{id:'pfName',type:'text',placeholder:TX.pfNamePh,autocomplete:'name','aria-label':TX.pfName,value:(o&&o.user&&o.user.name)||''});
var ph=h('input',{id:'pfPhone',type:'tel',placeholder:TX.cPhonePh,autocomplete:'tel',inputmode:'tel','aria-label':TX.cPhone,dir:'ltr',value:(o&&o.user&&o.user.phone)||''});
var go1=h('button',{class:'btn',id:'pfSave',onclick:function(){errEl.textContent='';if(!nameValid(nm.value)){errEl.textContent=TX.pfBadName;nm.focus();return}if(!phoneValid(ph.value)){errEl.textContent=TX.cBadPhone;ph.focus();return}go1.disabled=true;api('profile-set',{name:nm.value.trim(),phone:ph.value.trim()}).then(function(r){go1.disabled=false;if(!r||!r.ok){errEl.textContent=r&&r.error==='invalid_phone'?TX.cBadPhone:r&&r.error==='invalid_name'?TX.pfBadName:TX.error;return}if(after)after();else boot()})}},[TX.pfSave]);
onEnter(ph,go1);
box.appendChild(h('div',{class:'cstep'},[TX.pfStep]));box.appendChild(h('h1',{},[TX.pfTitle]));box.appendChild(h('p',{},[TX.pfText]));
box.appendChild(h('label',{for:'pfName'},[TX.pfName]));box.appendChild(nm);box.appendChild(h('label',{for:'pfPhone'},[TX.cPhone]));box.appendChild(ph);box.appendChild(go1);
if(profileSkippable(state.me||o)){box.appendChild(h('div',{class:'alt'},[h('a',{class:'lnk',id:'pfLater',onclick:function(){try{sessionStorage.setItem('sv1_profile_later','1')}catch(e){}if(after)after();else boot()}},[TX.pfLater])]))}
box.appendChild(errEl);app.appendChild(box)}
function boot(){var ml=hashParam('ml');if(ml){renderLinkConfirm(ml);return}api('me').then(function(o){if(!o||!o.ok){renderLogin();return}if(o.user&&o.user.contactPending){renderContact();return}
if(o.user&&o.user.needsProfile&&!profileLater(o)){state.me=o;renderProfile(o);return}
var nx=nextPath();if(nx){location.replace(nx);return}
var rs=resumePath();if(rs){location.replace(rs);return}state.me=o;state.testMode=!!o.testMode;var u=new URL(location.href);var v=u.searchParams.get('view'),ref=u.searchParams.get('ref');if(ref){state.view='request';state.ref=ref}else if(v)state.view=v;settleReturn(u).then(function(){render();if(state.view!=='documents')loadDocs().catch(function(){});if(state.view!=='compliance')opsGet('violations').then(function(o){if(o&&o.ok){state.violations=o.items||[];setComplianceBadge()}}).catch(function(){})})}).catch(function(){renderLogin()})}
boot();
})();</script>`;
  return sv1.shell({ title: tx.title, desc: tx.attention, path: "/my", body: CSS + body, script, noindex: true });
}
