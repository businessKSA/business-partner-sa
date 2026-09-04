// Simple V1 — the client portal (/my). One page, four languages, rendered
// client-side from /api/simple + /api/otp. Deliberately small: the customer
// sees what needs attention, their requests, and the one action each request
// is waiting on (approve quote → sign contract → pay → done).

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
  attachments: { ar: "المرفقات", en: "Attachments", fr: "Pièces jointes", zh: "附件" },
  quote: { ar: "عرض السعر", en: "Quotation", fr: "Devis", zh: "报价" },
  contract: { ar: "العقد", en: "Contract", fr: "Contrat", zh: "合同" },
  payment: { ar: "الدفع", en: "Payment", fr: "Paiement", zh: "付款" },
  invoice: { ar: "الفاتورة", en: "Invoice", fr: "Facture", zh: "发票" },
  timeline: { ar: "الخط الزمني", en: "Timeline", fr: "Chronologie", zh: "时间线" },
  writeMsg: { ar: "اكتب رسالة للفريق…", en: "Write a message to the team…", fr: "Écrire un message à l'équipe…", zh: "给团队留言…" },
  send: { ar: "إرسال", en: "Send", fr: "Envoyer", zh: "发送" },
  saveScope: { ar: "حفظ التعديلات", en: "Save changes", fr: "Enregistrer", zh: "保存修改" },
  confirmScope: { ar: "اعتمد النطاق وتابع", en: "Confirm scope & continue", fr: "Confirmer et continuer", zh: "确认范围并继续" },
  scopePricing: { ar: "تم اعتماد النطاق ✓ — الفريق يجهّز عرض السعر ويصلك هنا وعلى بريدك.", en: "Scope confirmed ✓ — our team is preparing your quotation; it will appear here and in your inbox.", fr: "Périmètre confirmé ✓ — l'équipe prépare votre devis.", zh: "范围已确认 ✓ — 团队正在准备报价。" },
  docs: { ar: "المستندات المطلوبة", en: "Documents required", fr: "Documents requis", zh: "所需文件" },
  docsNote: { ar: "جهّز هذه المستندات — نطلبها لإتمام طلبك.", en: "Prepare these documents — we need them to complete your request.", fr: "Préparez ces documents — ils sont nécessaires pour traiter votre demande.", zh: "请准备这些文件 — 我们需要它们来完成您的申请。" },
  docsNone: { ar: "لا مستندات مطلوبة حتى الآن.", en: "No documents requested yet.", fr: "Aucun document demandé pour l'instant.", zh: "暂无所需文件。" },
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
  apptNote: { ar: "المواعيد من الأحد إلى الخميس، بتوقيت الرياض. نؤكد الموعد على بريدك.", en: "Sunday to Thursday, Riyadh time. We confirm by email.", fr: "Du dimanche au jeudi, heure de Riyad. Confirmation par e-mail.", zh: "周日至周四，利雅得时间。我们将通过邮件确认。" },
  cancelReq: { ar: "إلغاء الطلب", en: "Cancel request", fr: "Annuler la demande", zh: "取消申请" },
  company: { ar: "اسم الشركة", en: "Company name", fr: "Nom de l'entreprise", zh: "公司名称" },
  cr: { ar: "السجل التجاري", en: "CR number", fr: "Numéro RC", zh: "商业登记号" },
  nameEn: { ar: "الاسم بالإنجليزية", en: "Name in English", fr: "Nom en anglais", zh: "英文名称" },
  save: { ar: "حفظ", en: "Save", fr: "Enregistrer", zh: "保存" },
  saved: { ar: "تم الحفظ", en: "Saved", fr: "Enregistré", zh: "已保存" },
  you: { ar: "أنت", en: "You", fr: "Vous", zh: "您" },
  team: { ar: "الفريق", en: "Team", fr: "Équipe", zh: "团队" },
  assistant: { ar: "المساعد", en: "Assistant", fr: "Assistant", zh: "助手" },
  loginTitle: { ar: "تسجيل الدخول", en: "Sign in", fr: "Connexion", zh: "登录" },
  loginText: { ar: "أدخل بريدك ونرسل لك رمز دخول.", en: "Enter your email and we'll send a sign-in code.", fr: "Saisissez votre e-mail, nous envoyons un code.", zh: "输入邮箱，我们将发送登录验证码。" },
  email: { ar: "البريد الإلكتروني", en: "Email", fr: "E-mail", zh: "邮箱" },
  sendCode: { ar: "أرسل الرمز", en: "Send code", fr: "Envoyer le code", zh: "发送验证码" },
  password: { ar: "كلمة المرور", en: "Password", fr: "Mot de passe", zh: "密码" },
  loginPw: { ar: "دخول بكلمة المرور", en: "Sign in with password", fr: "Se connecter avec mot de passe", zh: "使用密码登录" },
  usePw: { ar: "لديك كلمة مرور؟ ادخل بها", en: "Have a password? Sign in with it", fr: "Vous avez un mot de passe ?", zh: "使用密码登录" },
  useCode: { ar: "ادخل برمز البريد بدلاً من ذلك", en: "Use an emailed code instead", fr: "Utiliser un code par e-mail", zh: "改用邮箱验证码" },
  orGoogle: { ar: "أو ادخل بحساب Google", en: "Or continue with Google", fr: "Ou continuer avec Google", zh: "或使用 Google 登录" },
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
  waitingTeam: { ar: "الفريق يراجع طلبك", en: "The team is reviewing your request", fr: "L'équipe examine votre demande", zh: "团队正在审核您的申请" },
  needYou: { ar: "بانتظارك", en: "Waiting for you", fr: "En attente de vous", zh: "等待您处理" },
  tasksTitle: { ar: "مطلوب منك", en: "Required from you", fr: "Requis de votre part", zh: "需要您完成" },
  done: { ar: "تم", en: "Done", fr: "Fait", zh: "完成" },
  requestCreated: { ar: "تم إنشاء الطلب", en: "Request created", fr: "Demande créée", zh: "申请已创建" },
  testRibbon: { ar: "وضع الاختبار — لا مدفوعات حقيقية", en: "TEST MODE — no real payments", fr: "MODE TEST — aucun paiement réel", zh: "测试模式 — 无真实付款" },
  sourceLbl: { ar: "المصدر", en: "Source", fr: "Source", zh: "来源" },
};
const STATUS = {
  NEW: { ar: "جديد", en: "New", fr: "Nouveau", zh: "新" }, REVIEWING: { ar: "قيد المراجعة", en: "Reviewing", fr: "En cours d'examen", zh: "审核中" },
  WAITING_CLIENT: { ar: "بانتظار ردك", en: "Waiting for you", fr: "En attente de vous", zh: "等待您回复" }, QUOTE_SENT: { ar: "عرض سعر بانتظار اعتمادك", en: "Quote awaiting approval", fr: "Devis à approuver", zh: "报价待确认" },
  QUOTE_APPROVED: { ar: "العرض معتمد", en: "Quote approved", fr: "Devis approuvé", zh: "报价已确认" }, CONTRACT_SENT: { ar: "عقد بانتظار توقيعك", en: "Contract awaiting signature", fr: "Contrat à signer", zh: "合同待签署" },
  SIGNED: { ar: "موقّع — بانتظار الدفع", en: "Signed — payment due", fr: "Signé — paiement dû", zh: "已签署 — 待付款" }, PAYMENT_PENDING: { ar: "بانتظار الدفع", en: "Payment pending", fr: "Paiement en attente", zh: "待付款" },
  PAID: { ar: "مدفوع — جاهز للتنفيذ", en: "Paid — ready for execution", fr: "Payé — prêt pour exécution", zh: "已付款 — 准备执行" }, IN_PROGRESS: { ar: "قيد التنفيذ", en: "In progress", fr: "En cours", zh: "执行中" },
  WAITING_INTERNAL: { ar: "قيد التنفيذ", en: "In progress", fr: "En cours", zh: "执行中" }, COMPLETED: { ar: "مكتمل", en: "Completed", fr: "Terminé", zh: "已完成" }, CANCELLED: { ar: "ملغي", en: "Cancelled", fr: "Annulé", zh: "已取消" },
};
const EVENTS = { ar: {"request.created": "أنشأ الطلب", "request.created.manual": "أُنشئ الطلب يدوياً", "scope.proposed": "اقترح النطاق", "scope.edited": "عدّل النطاق", "scope.confirmed": "اعتمد النطاق", "quote.pending": "بانتظار عرض السعر", "message.customer": "رسالة من العميل", "message.bp": "رد الفريق", "attachment.added": "أضاف مرفقاً", "quote.drafted": "مسودة عرض سعر", "quote.sent": "أرسل عرض السعر", "quote.approved": "اعتمد العرض", "quote.rejected": "طلب تعديل العرض", "contract.sent": "أرسل العقد", "contract.signed": "وقّع العقد", "payment.paid": "تم الدفع", "payment.failed": "فشل الدفع", "payment.cancelled": "أُلغي الدفع", "payment.pending": "دفع معلّق", "invoice.issued": "صدرت الفاتورة", "appointment.booked": "حجز موعداً", "appointment.rescheduled": "أعاد جدولة الموعد", "appointment.cancelled": "ألغى الموعد", "appointment.set": "ثبّت الموعد", "task.created": "أنشأ مهمة", "task.human_required": "مهمة تحتاج تدخلاً بشرياً", "task.done": "أنجز المهمة", "task.in_progress": "بدأ المهمة", "task.waiting": "مهمة بانتظار", "task.todo": "أعاد فتح المهمة", "execution.started": "بدأ التنفيذ", "request.cancelled": "ألغى الطلب", "request.updated": "حدّث الطلب"}, en: {"request.created": "created the request", "request.created.manual": "request created manually", "scope.proposed": "proposed the scope", "scope.edited": "edited the scope", "scope.confirmed": "confirmed the scope", "quote.pending": "awaiting the quotation", "message.customer": "customer message", "message.bp": "team reply", "attachment.added": "added an attachment", "quote.drafted": "quote drafted", "quote.sent": "sent the quotation", "quote.approved": "approved the quotation", "quote.rejected": "requested changes", "contract.sent": "sent the contract", "contract.signed": "signed the contract", "payment.paid": "payment received", "payment.failed": "payment failed", "payment.cancelled": "payment cancelled", "payment.pending": "payment pending", "invoice.issued": "invoice issued", "appointment.booked": "booked an appointment", "appointment.rescheduled": "rescheduled the appointment", "appointment.cancelled": "cancelled the appointment", "appointment.set": "set the appointment", "task.created": "created a task", "task.human_required": "task needs a human", "task.done": "completed the task", "task.in_progress": "started the task", "task.waiting": "task waiting", "task.todo": "reopened the task", "execution.started": "execution started", "request.cancelled": "cancelled the request", "request.updated": "updated the request"} };
const TYPES = { CONSULTATION: { ar: "استشارة", en: "Consultation", fr: "Consultation", zh: "咨询" }, GOVERNMENT_SERVICE: { ar: "خدمة حكومية", en: "Government service", fr: "Service gouvernemental", zh: "政府服务" }, COMPANY_FORMATION: { ar: "تأسيس شركة", en: "Company formation", fr: "Création d'entreprise", zh: "公司注册" } };

export function buildSimpleMy(sv1, ctx) {
  const l = ctx.lang();
  const tx = {}; for (const k of Object.keys(P)) tx[k] = P[k][l] != null ? P[k][l] : P[k].en;
  const st = {}; for (const k of Object.keys(STATUS)) st[k] = STATUS[k][l] || STATUS[k].en;
  const ty = {}; for (const k of Object.keys(TYPES)) ty[k] = TYPES[k][l] || TYPES[k].en;
  const home = sv1.href("/");
  const CSS = `<style>
.my{display:grid;grid-template-columns:240px 1fr;min-height:calc(100vh - 68px)}
.my-side{background:#fff;border-inline-end:1px solid var(--line);padding:16px 12px;position:sticky;top:68px;height:calc(100vh - 68px);overflow:auto}
.my-side a{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;font-weight:600;font-size:.92rem;color:#2c3550;cursor:pointer}
.my-side a.on{background:var(--n);color:#fff}
.my-side a .b{margin-inline-start:auto;background:#e11d48;color:#fff;font-size:.7rem;border-radius:999px;padding:2px 7px;font-weight:800}
.my-side a.on .b{background:#fff;color:var(--n)}
.my-side .who{padding:8px 12px 14px;border-bottom:1px solid var(--line);margin-bottom:8px}
.my-side .who b{display:block;color:var(--n)}
.my-side .who small{color:var(--mut)}
.my-main{background:var(--g);padding:24px}
.my-main h1{margin:0 0 16px;color:var(--n);font-size:1.4rem}
.my-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:22px}
.my-kpi{background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px;cursor:pointer}
.my-kpi b{display:block;font-size:1.7rem;color:var(--n);line-height:1.1}
.my-kpi span{color:var(--mut);font-size:.82rem}
.my-kpi.hot{border-color:#f59e0b;background:#fffbeb}
.card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px;margin-bottom:14px}
.card h2,.card h3{margin:0 0 10px;color:var(--n);font-size:1.05rem}
.list{display:grid;gap:10px}
.row{display:flex;gap:12px;align-items:center;border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:#fff;cursor:pointer}
.row:hover{border-color:#b7c4e8}
.row .tt{flex:1;min-width:0}
.row .tt b{display:block;color:var(--n);font-size:.95rem}
.row .tt small{color:var(--mut);font-size:.78rem}
.pill{display:inline-block;border-radius:999px;padding:4px 10px;font-size:.74rem;font-weight:700;background:#eef2ff;color:#2b56c3;white-space:nowrap}
.pill.warn{background:#fff3e6;color:#b45309}.pill.ok{background:#eaf7ef;color:#118657}.pill.bad{background:#fee2e2;color:#b91c1c}.pill.mut{background:#eef0f5;color:#5f6880}
.grid2{display:grid;grid-template-columns:1.4fr 1fr;gap:14px;align-items:start}
.msgs{display:flex;flex-direction:column;gap:8px;max-height:380px;overflow:auto;padding:4px}
.m{max-width:85%;padding:10px 13px;border-radius:14px;font-size:.92rem;line-height:1.7;white-space:pre-wrap}
.m.user{background:var(--n);color:#fff;align-self:flex-end}.m.assistant,.m.bp,.m.system{background:var(--g);align-self:flex-start}
.m small{display:block;opacity:.7;font-size:.7rem;margin-top:3px}
.msgform{display:flex;gap:8px;margin-top:10px}
.msgform input,.inp{flex:1;border:1px solid var(--line);border-radius:10px;padding:10px 12px;font:inherit;width:100%}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:9px 14px;border-radius:10px;font-weight:700;font-size:.88rem;border:1px solid var(--n);background:var(--n);color:#fff;cursor:pointer;line-height:1.2}
.btn.ghost{background:#fff;color:var(--n)}.btn.danger{background:#fff;color:#b91c1c;border-color:#fecaca}.btn.sm{padding:6px 10px;font-size:.8rem}.btn[disabled]{opacity:.5}
.items{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.items li{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--line);border-radius:10px;padding:9px 12px}
.items li .ic{width:24px;height:24px;border-radius:7px;background:#eaf7ef;color:#118657;display:grid;place-items:center;font-weight:900;flex:none;font-size:.8rem}
.items li b[contenteditable]{outline:none;padding:1px 4px;border-radius:5px}.items li b[contenteditable]:focus{background:#fffbe6}
.items li small{display:block;color:var(--mut);font-size:.76rem}
.items li .rm{border:0;background:transparent;color:#b91c1c;font-size:.76rem;font-weight:700;cursor:pointer;margin-inline-start:auto}
table.q{width:100%;border-collapse:collapse;font-size:.9rem}
table.q th,table.q td{padding:8px 6px;border-bottom:1px solid var(--line);text-align:start}
table.q tfoot td{font-weight:700}
.tl{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.tl li{display:flex;gap:10px;font-size:.84rem}
.tl li time{color:var(--mut);white-space:nowrap;font-size:.76rem;min-width:110px}
.tl li i{font-style:normal;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:.7rem;flex:none;background:#eef2ff}
.tl li i.ai{background:#efe7ff}.tl li i.human{background:#e6f4ea}.tl li i.customer{background:#eef2ff}.tl li i.system{background:#fff3e6}
.stat{display:flex;flex-wrap:wrap;gap:8px 16px;font-size:.86rem;color:var(--mut);margin-bottom:12px}
.stat b{color:var(--ink)}
.contract-frame{border:1px solid var(--line);border-radius:12px;background:#fff;padding:18px;max-height:420px;overflow:auto;font-size:.9rem;line-height:1.8}
canvas.sig{border:1px dashed #c7cfe2;border-radius:10px;background:#fff;width:100%;height:150px;touch-action:none}
.note{font-size:.82rem;color:var(--mut)}
.ok{color:#118657;font-weight:700}.err{color:#b91c1c;font-size:.84rem}
.login{max-width:440px;margin:60px auto;background:#fff;border:1px solid var(--line);border-radius:18px;padding:26px}
.login .alt{margin-top:12px;display:flex;gap:14px;flex-wrap:wrap}
.login .lnk{color:var(--navy);text-decoration:underline;cursor:pointer;font-size:13px}
.login .gbtn{margin-top:16px;padding-top:14px;border-top:1px solid var(--line);display:flex;flex-direction:column;align-items:center;gap:8px}
.login h1{margin:0 0 6px;color:var(--n);font-size:1.3rem}
.login p{color:var(--mut);margin:0 0 14px;font-size:.9rem}
.login input{width:100%;border:1px solid var(--line);border-radius:10px;padding:11px 12px;font:inherit;margin-bottom:8px}
.form{display:grid;gap:8px;max-width:520px}
.form label{font-size:.82rem;color:var(--mut)}
.mob{display:none}
@media(max-width:900px){.my{grid-template-columns:1fr}.my-side{position:static;height:auto;display:none}.my-side.open{display:block}.mob{display:flex;gap:6px;overflow:auto;padding:10px 12px;background:#fff;border-bottom:1px solid var(--line)}.mob a{white-space:nowrap;padding:7px 11px;border-radius:999px;border:1px solid var(--line);font-size:.82rem;font-weight:700;color:#2c3550}.mob a.on{background:var(--n);color:#fff;border-color:var(--n)}.my-kpis{grid-template-columns:1fr 1fr}.grid2{grid-template-columns:1fr}.my-main{padding:14px}}
</style>`;
  const body = `
${sv1.header("/my", { cta: false })}
<div id="app"></div>
${sv1.footer()}`;
  const script = `<script>
(function(){
var LANG=${JSON.stringify(l)},EV=${JSON.stringify(EVENTS[l === "ar" ? "ar" : "en"])},TX=${JSON.stringify(tx)},ST=${JSON.stringify(st)},TY=${JSON.stringify(ty)},HOME=${JSON.stringify(home)},CHECKOUT=${JSON.stringify(sv1.href("/checkout"))};
var app=document.getElementById('app'),state={me:null,view:'home',ref:null,req:null,testMode:false,contractHtml:''};
var $=function(s,r){return (r||document).querySelector(s)};
function h(tag,attrs,kids){var e=document.createElement(tag);if(attrs)for(var k in attrs){if(k==='class')e.className=attrs[k];else if(k==='html')e.innerHTML=attrs[k];else if(k.indexOf('on')===0)e.addEventListener(k.slice(2),attrs[k]);else if(attrs[k]!=null)e.setAttribute(k,attrs[k])}(kids||[]).forEach(function(c){if(c==null)return;e.appendChild(typeof c==='string'?document.createTextNode(c):c)});return e}
function api(action,data){return fetch('/api/simple',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({action:action},data||{}))}).then(function(r){return r.json()})}
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
function pillClass(s){return ['QUOTE_SENT','CONTRACT_SENT','SIGNED','PAYMENT_PENDING','WAITING_CLIENT'].indexOf(s)>=0?'warn':['PAID','COMPLETED','QUOTE_APPROVED'].indexOf(s)>=0?'ok':s==='CANCELLED'?'bad':['IN_PROGRESS','WAITING_INTERNAL'].indexOf(s)>=0?'':'mut'}
function pill(s){return h('span',{class:'pill '+pillClass(s)},[ST[s]||s])}
function go(view,ref){state.view=view;state.ref=ref||null;var u=new URL(location.href);u.searchParams.set('view',view);if(ref)u.searchParams.set('ref',ref);else u.searchParams.delete('ref');history.replaceState(null,'',u.toString());render()}
// ---------- login
function renderLogin(){app.innerHTML='';var email='',challenge='';var box=h('div',{class:'login'});var errEl=h('div',{class:'err'});
var e1=h('input',{type:'email',placeholder:TX.email,autocomplete:'email'}),b1=h('button',{class:'btn',onclick:function(){email=e1.value.trim().toLowerCase();errEl.textContent='';b1.disabled=true;otp({action:'start',email:email}).then(function(o){b1.disabled=false;if(!o||!o.ok){errEl.textContent=(o&&o.message)||TX.loginErr;return}challenge=o.challenge;s1.hidden=true;s2.hidden=false;if(o.testLogin)e2.placeholder='TEST: 123456';e2.focus()}).catch(function(){b1.disabled=false;errEl.textContent=TX.loginErr})}},[TX.sendCode]);
var e2=h('input',{inputmode:'numeric',maxlength:'6',placeholder:TX.code}),b2=h('button',{class:'btn',onclick:function(){b2.disabled=true;otp({action:'verify',email:email,code:e2.value.trim(),challenge:challenge}).then(function(o){b2.disabled=false;if(!o||!o.ok){errEl.textContent=TX.codeErr;return}try{localStorage.setItem('bp_session','1')}catch(x){}boot()}).catch(function(){b2.disabled=false;errEl.textContent=TX.codeErr})}},[TX.verify]);
var s1=h('div',{},[e1,b1]),s2=h('div',{hidden:''},[e2,b2]);
// Three doors to the same account: emailed code, password, Google. Only the
// ones this deployment has configured are drawn.
var e3=h('input',{type:'password',placeholder:TX.password,autocomplete:'current-password'});
var b3=h('button',{class:'btn',onclick:function(){errEl.textContent='';b3.disabled=true;otp({action:'password-login',email:e1.value.trim().toLowerCase(),password:e3.value}).then(function(o){b3.disabled=false;if(!o||!o.ok){errEl.textContent=(o&&o.message)||TX.loginErr;return}try{localStorage.setItem('bp_session','1')}catch(x){}boot()}).catch(function(){b3.disabled=false;errEl.textContent=TX.loginErr})}},[TX.loginPw]);
var sp=h('div',{hidden:''},[e3,b3]);
var toPw=h('a',{class:'lnk',onclick:function(){sp.hidden=false;toPw.hidden=true;toCode.hidden=false;e3.focus()}},[TX.usePw]);
var toCode=h('a',{class:'lnk',hidden:'',onclick:function(){sp.hidden=true;toPw.hidden=false;toCode.hidden=true}},[TX.useCode]);
var gwrap=h('div',{class:'gbtn',hidden:''});
box.appendChild(h('h1',{},[TX.loginTitle]));box.appendChild(h('p',{},[TX.loginText]));box.appendChild(s1);box.appendChild(s2);box.appendChild(sp);box.appendChild(h('div',{class:'alt'},[toPw,toCode]));box.appendChild(gwrap);box.appendChild(errEl);app.appendChild(box);
otp({action:'methods'}).then(function(m){if(!m||!m.ok)return;if(!m.password){toPw.hidden=true}if(m.google&&m.googleClientId)mountGoogle(gwrap,m.googleClientId,errEl)}).catch(function(){})}
// Google Identity Services is loaded only when a client id exists, so a
// deployment without Google never pulls a script it cannot use.
function mountGoogle(wrap,cid,errEl){wrap.hidden=false;wrap.appendChild(h('p',{class:'note'},[TX.orGoogle]));var slot=h('div',{id:'bpGoogleBtn'});wrap.appendChild(slot);
window.__bpGoogleCb=function(resp){otp({action:'google',credential:resp&&resp.credential}).then(function(o){if(!o||!o.ok){errEl.textContent=TX.loginErr;return}try{localStorage.setItem('bp_session','1')}catch(x){}boot()})};
function init(){try{google.accounts.id.initialize({client_id:cid,callback:window.__bpGoogleCb});google.accounts.id.renderButton(slot,{theme:'outline',size:'large',width:280,locale:LANG==='ar'?'ar':'en'})}catch(e){wrap.hidden=true}}
if(window.google&&window.google.accounts&&window.google.accounts.id)return init();
var sc=document.createElement('script');sc.src='https://accounts.google.com/gsi/client';sc.async=true;sc.defer=true;sc.onload=init;sc.onerror=function(){wrap.hidden=true};document.head.appendChild(sc)}
// ---------- shell
var NAV=[['home',TX.navHome,'🏠'],['new',TX.navNew,'➕'],['requests',TX.navRequests,'📋'],['quotes',TX.navQuotes,'🧾'],['contracts',TX.navContracts,'📝'],['appointments',TX.navAppts,'📅'],['pay',TX.navPay,'💳'],['invoices',TX.navInvoices,'🧮'],['chats',TX.navChats,'💬'],['company',TX.navCompany,'🏢']];
function badges(){var c=state.me.counts||{};return {quotes:c.quotes,contracts:c.contracts,pay:c.payments}}
function render(){var me=state.me;app.innerHTML='';var bd=badges();
var side=h('nav',{class:'my-side',id:'mySide'},[h('div',{class:'who'},[h('b',{},[me.user.name||me.user.email]),h('small',{},[(me.organization&&(me.organization.name_ar||me.organization.name_en))||me.user.email])])].concat(NAV.map(function(n){return h('a',{class:state.view===n[0]?'on':'',onclick:function(){go(n[0])}},[n[2]+' '+n[1],bd[n[0]]?h('span',{class:'b'},[String(bd[n[0]])]):null])})).concat([h('a',{href:HOME},['🌐 '+TX.site]),h('a',{onclick:function(){otp({action:'logout'}).then(function(){try{localStorage.removeItem('bp_session')}catch(x){}location.href=HOME})}},['↩ '+TX.logout])]));
var mob=h('div',{class:'mob'},NAV.map(function(n){return h('a',{class:state.view===n[0]?'on':'',onclick:function(){go(n[0])}},[n[2]+' '+n[1]])}));
var main=h('div',{class:'my-main',id:'myMain'});
app.appendChild(mob);var wrap=h('div',{class:'my'},[side,main]);app.appendChild(wrap);
var v=state.view;if(v==='home')viewHome(main);else if(v==='new')viewNew(main);else if(v==='request')viewRequest(main);else if(v==='requests')viewList(main,TX.navRequests,function(r){return true});else if(v==='quotes')viewList(main,TX.navQuotes,function(r){return !!r.quote});else if(v==='contracts')viewList(main,TX.navContracts,function(r){return !!r.contract});else if(v==='appointments')viewAppts(main);else if(v==='pay')viewPay(main);else if(v==='invoices')viewInvoices(main);else if(v==='chats')viewChats(main);else if(v==='company')viewCompany(main);else viewHome(main)}
function reqRow(r){return h('div',{class:'row',onclick:function(){go('request',r.ref)}},[h('div',{class:'tt'},[h('b',{},[r.title]),h('small',{},[r.ref+' · '+(TY[r.type]||r.type)+' · '+when(r.updated_at||r.created_at)])]),pill(r.status),h('span',{class:'btn ghost sm'},[TX.open])])}
function viewHome(m){var c=state.me.counts||{};m.appendChild(h('h1',{},[TX.attention]));
var k=[['active',TX.kActive,'requests'],['quotes',TX.kQuotes,'quotes'],['contracts',TX.kContracts,'contracts'],['payments',TX.kPayments,'pay'],['appointments',TX.kAppts,'appointments']];
m.appendChild(h('div',{class:'my-kpis'},k.map(function(x){return h('div',{class:'my-kpi'+(x[0]!=='active'&&c[x[0]]?' hot':''),onclick:function(){go(x[2])}},[h('b',{},[String(c[x[0]]||0)]),h('span',{},[x[1]])])})));
var need=state.me.requests.filter(function(r){return ['QUOTE_SENT','CONTRACT_SENT','SIGNED','PAYMENT_PENDING','WAITING_CLIENT'].indexOf(r.status)>=0});
if(need.length)m.appendChild(h('div',{class:'card'},[h('h2',{},[TX.needYou]),h('div',{class:'list'},need.map(reqRow))]));
m.appendChild(h('div',{class:'card'},[h('h2',{},[TX.today]),h('p',{class:'note'},[TX.navNew]),h('a',{class:'btn',href:HOME+'#chat'},[TX.navNew])]));
var others=state.me.requests.filter(function(r){return need.indexOf(r)<0}).slice(0,6);
if(others.length)m.appendChild(h('div',{class:'card'},[h('h2',{},[TX.navRequests]),h('div',{class:'list'},others.map(reqRow))]))}
function viewNew(m){m.appendChild(h('h1',{},[TX.navNew]));m.appendChild(h('div',{class:'card'},[h('p',{},[TX.today]),h('a',{class:'btn',href:HOME+'#chat'},[TX.navNew])]))}
function viewList(m,title,f){m.appendChild(h('h1',{},[title]));var rows=state.me.requests.filter(f);m.appendChild(rows.length?h('div',{class:'list'},rows.map(function(r){var row=reqRow(r);if(r.quote&&title===TX.navQuotes)row.insertBefore(h('span',{class:'pill '+(r.quote.status==='APPROVED'?'ok':'warn')},[r.quote.number+' · '+money(r.quote.total)]),row.children[1]);if(r.contract&&title===TX.navContracts)row.insertBefore(h('span',{class:'pill '+(r.contract.status==='SIGNED'?'ok':'warn')},[r.contract.number+' · '+(r.contract.status==='SIGNED'?TX.signed:TX.contract)]),row.children[1]);return row})):h('p',{class:'note'},[TX.empty]))}
function viewInvoices(m){m.appendChild(h('h1',{},[TX.navInvoices]));var rows=state.me.requests.filter(function(r){return r.invoice});m.appendChild(rows.length?h('div',{class:'list'},rows.map(function(r){var row=reqRow(r);row.insertBefore(h('span',{class:'pill ok'},[r.invoice.number+' · '+money(r.invoice.total)]),row.children[1]);return row})):h('p',{class:'note'},[TX.empty]))}
function viewPay(m){m.appendChild(h('h1',{},[TX.navPay]));var rows=state.me.requests.filter(function(r){return ['SIGNED','PAYMENT_PENDING'].indexOf(r.status)>=0});m.appendChild(rows.length?h('div',{class:'list'},rows.map(function(r){var row=reqRow(r);row.insertBefore(h('span',{class:'pill warn'},[money(r.quote?r.quote.total:0)]),row.children[1]);return row})):h('p',{class:'note'},[TX.empty]));m.appendChild(h('div',{class:'card'},[h('a',{class:'btn ghost',href:CHECKOUT},[TX.navPay+' →'])]))}
function viewChats(m){m.appendChild(h('h1',{},[TX.navChats]));var rows=state.me.requests.filter(function(r){return r.last_message});m.appendChild(rows.length?h('div',{class:'list'},rows.map(function(r){var row=reqRow(r);row.querySelector('small').textContent=(r.last_message.content||'').slice(0,90);return row})):h('p',{class:'note'},[TX.empty]))}
function viewAppts(m){m.appendChild(h('h1',{},[TX.navAppts]));var rows=state.me.requests.filter(function(r){return r.appointment&&r.appointment.status!=='CANCELLED'});m.appendChild(rows.length?h('div',{class:'list'},rows.map(function(r){var row=reqRow(r);row.insertBefore(h('span',{class:'pill'},[r.appointment.date+' '+r.appointment.time]),row.children[1]);return row})):h('p',{class:'note'},[TX.empty]));var cons=state.me.requests.filter(function(r){return r.type==='CONSULTATION'&&(!r.appointment||r.appointment.status==='CANCELLED')&&r.status!=='CANCELLED'});if(cons.length)m.appendChild(h('div',{class:'card'},[h('h2',{},[TX.book]),h('div',{class:'list'},cons.map(reqRow))]))}
function viewCompany(m){m.appendChild(h('h1',{},[TX.navCompany]));var o=state.me.organization||{};var f=h('div',{class:'form'});var nAr=h('input',{class:'inp',value:o.name_ar||''}),nEn=h('input',{class:'inp',value:o.name_en||''}),cr=h('input',{class:'inp',value:o.cr_number||''}),msg=h('span',{class:'ok'});
f.appendChild(h('label',{},[TX.company]));f.appendChild(nAr);f.appendChild(h('label',{},[TX.nameEn]));f.appendChild(nEn);f.appendChild(h('label',{},[TX.cr]));f.appendChild(cr);
f.appendChild(h('button',{class:'btn',onclick:function(){fetch('/api/requests',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({action:'my-org-update',name_ar:nAr.value,name_en:nEn.value,cr_number:cr.value})}).then(function(r){return r.json()}).then(function(o){msg.textContent=o&&o.ok?TX.saved:TX.error})}},[TX.save]));f.appendChild(msg);
m.appendChild(h('div',{class:'card'},[h('div',{class:'stat'},[h('span',{},[TX.email+': ',h('b',{},[state.me.user.email])])]),f]));
// Setting a password needs a live session, which is exactly where we are —
// so the client picks one here and stops waiting for a code every visit.
var pw=h('input',{class:'inp',type:'password',autocomplete:'new-password',placeholder:TX.password}),pmsg=h('span',{class:'ok'});
var pf=h('div',{class:'form'},[h('p',{class:'note'},[TX.pwNote]),h('label',{},[TX.password]),pw,h('div',{class:'msgform'},[h('button',{class:'btn',onclick:function(){pmsg.className='ok';if((pw.value||'').length<8){pmsg.className='err';pmsg.textContent=TX.pwShort;return}otp({action:'password-set',password:pw.value}).then(function(o){if(o&&o.ok){pmsg.textContent=TX.pwSaved;pw.value=''}else{pmsg.className='err';pmsg.textContent=(o&&o.message)||TX.error}})}},[TX.pwSave]),pmsg])]);
m.appendChild(h('div',{class:'card'},[h('h3',{},[TX.pwTitle]),pf]))}
// ---------- request detail
function viewRequest(m){m.appendChild(h('a',{class:'btn ghost sm',onclick:function(){go('requests')}},['← '+TX.back]));var hd=h('h1',{style:'margin-top:10px'},['…']);m.appendChild(hd);var box=h('div');m.appendChild(box);
api('request-get',{ref:state.ref}).then(function(o){if(!o||!o.ok){box.appendChild(h('p',{class:'err'},[TX.error]));return}state.req=o.request;state.testMode=!!o.testMode;drawRequest(hd,box)})}
function drawRequest(hd,box){var r=state.req;hd.textContent=r.title;box.innerHTML='';
box.appendChild(h('div',{class:'stat'},[h('span',{},[TX.ref+': ',h('b',{},[r.ref])]),h('span',{},[TX.status+': ',pill(r.status)]),h('span',{},[(TY[r.type]||r.type)]),h('span',{},[when(r.created_at)])]));
var left=h('div'),right=h('div');box.appendChild(h('div',{class:'grid2'},[left,right]));
// conversation
var msgs=h('div',{class:'msgs'},(r.conversation||[]).map(function(mm){return h('div',{class:'m '+mm.role},[stripScope(mm.content),h('small',{},[(mm.role==='user'?TX.you:mm.role==='bp'?TX.team:TX.assistant)+' · '+when(mm.at)])])}));
var inp=h('input',{placeholder:TX.writeMsg}),sb=h('button',{class:'btn',onclick:function(){var v=inp.value.trim();if(!v)return;sb.disabled=true;api('request-message',{ref:r.ref,content:v}).then(function(o){sb.disabled=false;if(o&&o.ok){r.conversation=o.conversation;r.status=o.status||r.status;inp.value='';drawRequest(hd,box)}})}},[TX.send]);
left.appendChild(h('div',{class:'card'},[h('h3',{},[TX.conversation]),msgs,h('div',{class:'msgform'},[inp,sb])]));setTimeout(function(){msgs.scrollTop=msgs.scrollHeight},0);
// scope
var editable=['NEW','REVIEWING','WAITING_CLIENT'].indexOf(r.status)>=0;var sc=h('div',{class:'card'});sc.appendChild(h('h3',{},[TX.scope]));if(r.summary)sc.appendChild(h('p',{class:'note'},[r.summary]));
var ul=h('ul',{class:'items'});function drawItems(){ul.innerHTML='';(r.scope||[]).forEach(function(it,i){var li=h('li',{},[h('span',{class:'ic'},['✓']),h('div',{},[h('b',editable?{contenteditable:'true',oninput:function(){it.title=this.textContent.trim()}}:{},[it.title]),it.why?h('small',{},[it.why]):null]),editable?h('button',{class:'rm',onclick:function(){r.scope.splice(i,1);drawItems()}},[TX.remove]):null]);ul.appendChild(li)})}drawItems();sc.appendChild(ul);
// documents the advisor asked for — every service has its own list
var dc=h('div',{class:'card'});dc.appendChild(h('h3',{},[TX.docs]));
dc.appendChild(h('p',{class:'note'},[(r.documents&&r.documents.length)?TX.docsNote:TX.docsNone]));
if(r.documents&&r.documents.length){var dul=h('ul',{class:'items'});(r.documents||[]).forEach(function(d){dul.appendChild(h('li',{},[h('span',{class:'ic'},['\ud83d\udcc4']),h('div',{},[h('b',{},[d.title]),d.note?h('small',{},[d.note]):null])]))});dc.appendChild(dul)}
if(editable){var ai=h('input',{class:'inp',placeholder:TX.addItem}),msgS=h('span',{class:'ok'});
// Confirming the scope is what moves the request on to the quotation; the
// plain save stays for intermediate edits.
var goBtn=h('button',{class:'btn',onclick:function(){msgS.className='ok';msgS.textContent='';goBtn.disabled=true;api('scope-confirm',{ref:r.ref,scope:r.scope}).then(function(o){goBtn.disabled=false;if(!o||!o.ok){msgS.className='err';msgS.textContent=(o&&o.message)||TX.error;return}state.flash=TX.scopePricing;api('request-get',{ref:r.ref}).then(function(g){if(g&&g.ok){state.req=g.request;drawRequest(hd,box);var q=document.getElementById('sv1Quote');if(q&&q.scrollIntoView)q.scrollIntoView({behavior:'smooth',block:'start'})}})})}},[TX.confirmScope]);
sc.appendChild(h('div',{class:'msgform'},[ai,h('button',{class:'btn ghost',onclick:function(){if(!ai.value.trim())return;r.scope.push({code:'',title:ai.value.trim(),why:''});ai.value='';drawItems()}},[TX.addItem]),h('button',{class:'btn ghost',onclick:function(){api('scope-update',{ref:r.ref,scope:r.scope}).then(function(o){msgS.className='ok';msgS.textContent=o&&o.ok?TX.saved:TX.error})}},[TX.saveScope]),goBtn,msgS]));
if(state.flash){sc.appendChild(h('p',{class:'ok'},[state.flash]));state.flash=null}}else sc.appendChild(h('p',{class:'note'},[TX.scopeLocked]));
sc.appendChild(dc.firstChild?dc:document.createComment(''));
left.appendChild(sc);
// tasks for client
if(r.tasks&&r.tasks.length)left.appendChild(h('div',{class:'card'},[h('h3',{},[TX.tasksTitle]),h('ul',{class:'items'},r.tasks.map(function(t){return h('li',{},[h('span',{class:'ic'},[t.status==='DONE'?'✓':'•']),h('div',{},[h('b',{},[t.title]),t.details?h('small',{},[t.details]):null])])}))]));
// quote — while it is being priced the customer sees the step, not silence
if(!r.quote&&(r.events||[]).some(function(e){return e.event==='quote.pending'}))right.appendChild(h('div',{class:'card',id:'sv1Quote'},[h('h3',{},[TX.quote]),h('p',{class:'note'},[TX.scopePricing])]));
if(r.quote){var qc=h('div',{class:'card',id:'sv1Quote'});qc.appendChild(h('h3',{},[TX.quote+' '+r.quote.number]));var tb=h('table',{class:'q'});tb.appendChild(h('thead',{},[h('tr',{},[h('th',{},[TX.scope]),h('th',{},[TX.qty]),h('th',{},[TX.price])])]));tb.appendChild(h('tbody',{},r.quote.items.map(function(i){return h('tr',{},[h('td',{},[i.title]),h('td',{},[String(i.qty)]),h('td',{},[money(lineOf(i))])])})));tb.appendChild(h('tfoot',{},[h('tr',{},[h('td',{colspan:'2'},[TX.net]),h('td',{},[money(r.quote.net)])]),h('tr',{},[h('td',{colspan:'2'},[TX.vat]),h('td',{},[money(r.quote.vat)])]),h('tr',{},[h('td',{colspan:'2'},[TX.total]),h('td',{},[money(r.quote.total)])])]));qc.appendChild(tb);
qc.appendChild(h('p',{class:'note'},[TX.validUntil+': '+(r.quote.valid_until||'')+' · '+TX.terms+': '+(r.quote.payment_terms||'')]));if(r.quote.notes)qc.appendChild(h('p',{class:'note'},[r.quote.notes]));
if(r.status==='QUOTE_SENT'){var rn=h('input',{class:'inp',placeholder:TX.rejectNote,style:'margin-top:8px'});qc.appendChild(h('div',{class:'msgform'},[h('button',{class:'btn',onclick:function(){api('quote-approve',{ref:r.ref}).then(function(o){if(o&&o.ok){r.status=o.status;r.quote=o.quote;if(o.contract)r.contract=o.contract;refreshMe();drawRequest(hd,box)}})}},[TX.approve]),h('button',{class:'btn ghost',onclick:function(){api('quote-reject',{ref:r.ref,note:rn.value}).then(function(o){if(o&&o.ok){r.status=o.status;r.quote=o.quote;refreshMe();drawRequest(hd,box)}})}},[TX.reject])]));qc.appendChild(rn)}
else if(r.quote.status==='APPROVED')qc.appendChild(h('p',{class:'ok'},[TX.quoteApproved]));
right.appendChild(qc)}
// contract
if(r.contract){var cc=h('div',{class:'card'});cc.appendChild(h('h3',{},[TX.contract+' '+r.contract.number]));var frame=h('div',{class:'contract-frame'},['…']);cc.appendChild(frame);api('contract-view',{ref:r.ref}).then(function(o){frame.innerHTML=o&&o.ok?o.html:'';state.contractHtml=o&&o.html||''});
if(r.status==='CONTRACT_SENT'){cc.appendChild(h('h3',{style:'margin-top:14px'},[TX.signTitle]));var nm=h('input',{class:'inp',placeholder:TX.signName,value:state.me.user.name||''});cc.appendChild(nm);cc.appendChild(h('p',{class:'note',style:'margin:8px 0 4px'},[TX.signDraw]));var cv=h('canvas',{class:'sig',width:'600',height:'150'});cc.appendChild(cv);var ctx2=cv.getContext('2d'),drawing=false,drew=false;ctx2.lineWidth=2;ctx2.lineCap='round';ctx2.strokeStyle='#0B1B5A';function pos(e){var rc=cv.getBoundingClientRect();var p=e.touches?e.touches[0]:e;return [(p.clientX-rc.left)*cv.width/rc.width,(p.clientY-rc.top)*cv.height/rc.height]}
cv.addEventListener('pointerdown',function(e){drawing=true;var p=pos(e);ctx2.beginPath();ctx2.moveTo(p[0],p[1])});cv.addEventListener('pointermove',function(e){if(!drawing)return;var p=pos(e);ctx2.lineTo(p[0],p[1]);ctx2.stroke();drew=true});window.addEventListener('pointerup',function(){drawing=false});
var cons=h('input',{type:'checkbox',id:'consent'});var err=h('div',{class:'err'});cc.appendChild(h('div',{class:'msgform'},[h('button',{class:'btn ghost sm',onclick:function(){ctx2.clearRect(0,0,cv.width,cv.height);drew=false}},[TX.signClear])]));cc.appendChild(h('label',{style:'display:flex;gap:8px;align-items:flex-start;margin:10px 0;font-size:.86rem'},[cons,h('span',{},[TX.signConsent])]));
cc.appendChild(h('button',{class:'btn',onclick:function(){err.textContent='';if(!cons.checked||!nm.value.trim()){err.textContent=TX.signConsent;return}api('contract-sign',{ref:r.ref,name:nm.value.trim(),consent:true,signature:drew?cv.toDataURL('image/png'):null}).then(function(o){if(o&&o.ok){r.status=o.status;r.contract=o.contract;r.payment={status:'PENDING',amount:r.quote.total};refreshMe();drawRequest(hd,box)}else err.textContent=(o&&o.message)||TX.error})}},[TX.signBtn]));cc.appendChild(err)}
else if(r.contract.status==='SIGNED')cc.appendChild(h('p',{class:'ok'},['✓ '+TX.signed+' · '+when(r.contract.signed_at)]));
right.appendChild(cc)}
// payment
if(['SIGNED','PAYMENT_PENDING'].indexOf(r.status)>=0&&r.quote){var pc=h('div',{class:'card'});pc.appendChild(h('h3',{},[TX.payment+' · '+money(r.quote.total)]));if(r.payment&&r.payment.status&&r.payment.status!=='PENDING'&&r.payment.status!=='PAID')pc.appendChild(h('p',{class:'err'},[TX.payment+': '+r.payment.status]));
function gwGo(provider){var back=encodeURIComponent(location.pathname+'?view=request&ref='+encodeURIComponent(r.ref));
location.href='/api/pay?action=mock-form&provider='+provider+'&amount='+encodeURIComponent(String((r.quote&&r.quote.total)||0))+'&label='+encodeURIComponent(r.ref)+'&back='+back}
function payHere(provider){
  // Test/local: the gateway this server hosts. Otherwise the cart + checkout
  // the rest of the site uses, which needs the classic session.
  if(state.testMode){gwGo(provider);return}
  api('checkout-start',{ref:r.ref}).then(function(o){if(!o||!o.ok)return;try{var cart=JSON.parse(localStorage.getItem('bp_cart')||'[]');cart=cart.filter(function(i){return i.id!==o.item.id});cart.push(o.item);localStorage.setItem('bp_cart',JSON.stringify(cart))}catch(x){}location.href=CHECKOUT})}
var payRow=h('div',{style:'display:flex;gap:7px;flex-wrap:wrap'},[
  h('button',{class:'btn',onclick:function(){payHere('card')}},[TX.payCardNow]),
  h('button',{class:'btn ghost',onclick:function(){payHere('tamara')}},[TX.payTamaraNow])]);
pc.appendChild(payRow);pc.appendChild(h('p',{class:'note'},[TX.payVia]));
if(state.testMode){
pc.appendChild(h('h3',{style:'margin-top:12px'},[TX.testPay]));var tp=h('div',{style:'display:flex;gap:6px;flex-wrap:wrap'});[['success','card',TX.paySuccess,''],['success','tamara',TX.payTamara,''],['failed','card',TX.payFailed,'danger'],['cancelled','card',TX.payCancelled,'ghost'],['pending','card',TX.payPending,'ghost']].forEach(function(x){tp.appendChild(h('button',{class:'btn sm '+x[3],onclick:function(){api('pay-test',{ref:r.ref,outcome:x[0],provider:x[1]}).then(function(o){if(o&&o.ok){r.status=o.status;r.payment=o.payment;if(o.invoice)r.invoice=o.invoice;refreshMe();drawRequest(hd,box)}})}},[x[2]]))});pc.appendChild(tp)}
right.appendChild(pc)}
if(r.payment&&r.payment.status==='PAID')right.appendChild(h('div',{class:'card'},[h('h3',{},[TX.payment]),h('p',{class:'ok'},['✓ '+TX.paid+' · '+money(r.payment.amount)+' · '+(r.payment.provider||'')+' · '+when(r.payment.at)])]));
if(r.invoice)right.appendChild(h('div',{class:'card'},[h('h3',{},[TX.invoice+' '+r.invoice.number]),h('p',{},[money(r.invoice.total)+' · '+when(r.invoice.issued_at)]),h('button',{class:'btn ghost sm',onclick:function(){openInvoice(r)}},[TX.download])]));
// appointment
if(r.type==='CONSULTATION'){var ac=h('div',{class:'card'});ac.appendChild(h('h3',{},[TX.navAppts]));var a=r.appointment;if(a&&a.status!=='CANCELLED')ac.appendChild(h('p',{class:'ok'},['📅 '+a.date+' · '+a.time+' · '+(a.topic||'')+(a.gcal?' ':'') ,a.gcal?h('a',{href:a.gcal,target:'_blank',class:'btn ghost sm'},['Google Calendar']):null]));
var d=h('input',{class:'inp',type:'date',min:new Date().toISOString().slice(0,10)}),tm=h('input',{class:'inp',type:'time',value:'10:00',step:'1800'}),tp2=h('input',{class:'inp',placeholder:TX.topic,value:(a&&a.topic)||r.title}),ae=h('div',{class:'err'});
ac.appendChild(h('div',{class:'form'},[h('label',{},[TX.date]),d,h('label',{},[TX.time]),tm,h('label',{},[TX.topic]),tp2,h('div',{class:'msgform'},[h('button',{class:'btn',onclick:function(){api(a&&a.status!=='CANCELLED'?'appointment-reschedule':'appointment-book',{ref:r.ref,date:d.value,time:tm.value,topic:tp2.value}).then(function(o){if(o&&o.ok){r.appointment=o.appointment;refreshMe();drawRequest(hd,box)}else ae.textContent=(o&&o.error)||TX.error})}},[a&&a.status!=='CANCELLED'?TX.reschedule:TX.book]),a&&a.status!=='CANCELLED'?h('button',{class:'btn danger',onclick:function(){api('appointment-cancel',{ref:r.ref}).then(function(o){if(o&&o.ok){r.appointment=o.appointment;refreshMe();drawRequest(hd,box)}})}},[TX.cancelAppt]):null]),ae,h('p',{class:'note'},[TX.apptNote])]));right.appendChild(ac)}
// timeline
right.appendChild(h('div',{class:'card'},[h('h3',{},[TX.timeline]),h('ul',{class:'tl'},(r.events||[]).slice().reverse().map(function(e){return h('li',{},[h('time',{},[when(e.created_at)]),h('i',{class:e.actor_kind},[e.actor_kind==='ai'?'AI':e.actor_kind==='human'?'👤':e.actor_kind==='customer'?'🙂':'⚙']),h('span',{},[(e.actor?e.actor+': ':'')+(EV[e.event]||e.event)+(e.details&&e.details.number?' '+e.details.number:'')])])}))]));
if(['NEW','REVIEWING','WAITING_CLIENT','QUOTE_SENT'].indexOf(r.status)>=0)right.appendChild(h('button',{class:'btn danger sm',onclick:function(){if(!confirm(TX.cancelReq+'?'))return;api('request-cancel',{ref:r.ref}).then(function(o){if(o&&o.ok){r.status='CANCELLED';refreshMe();drawRequest(hd,box)}})}},[TX.cancelReq]))}
function openInvoice(r){var inv=r.invoice;var w=window.open('','_blank');if(!w)return;var rows=(inv.items||[]).map(function(i){return '<tr><td>'+esc(i.title)+'</td><td>'+i.qty+'</td><td>'+money(lineOf(i))+'</td></tr>'}).join('');w.document.write('<!doctype html><html dir="'+(LANG==='ar'?'rtl':'ltr')+'"><head><meta charset="utf-8"><title>'+inv.number+'</title><style>body{font-family:"IBM Plex Sans Arabic",system-ui;padding:32px;color:#1F2430}h1{color:#0B1B5A}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #e4e8f1;text-align:start}.t{font-weight:700}.tm{background:#b45309;color:#fff;padding:6px 10px;display:inline-block;border-radius:6px}</style></head><body>'+(inv.mode==='test'?'<span class="tm">TEST MODE</span>':'')+'<h1>Business Partner — '+TX.invoice+' '+inv.number+'</h1><p>'+TX.ref+': '+r.ref+' · '+when(inv.issued_at)+'</p><p>'+esc((inv.bill_to&&(inv.bill_to.company||inv.bill_to.name))||'')+'</p><table><thead><tr><th>'+TX.scope+'</th><th>'+TX.qty+'</th><th>'+TX.price+'</th></tr></thead><tbody>'+rows+'</tbody><tfoot><tr><td colspan="2">'+TX.net+'</td><td>'+money(inv.net)+'</td></tr><tr><td colspan="2">'+TX.vat+'</td><td>'+money(inv.vat)+'</td></tr><tr class="t"><td colspan="2">'+TX.total+'</td><td>'+money(inv.total)+'</td></tr></tfoot></table><p><b>'+TX.paid+'</b></p></body></html>');w.document.close()}
function esc(s){return String(s==null?'':s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})}
function refreshMe(){api('me').then(function(o){if(o&&o.ok){state.me=o;var side=$('#mySide');if(side){/* re-render nav badges */}}})}
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
function boot(){api('me').then(function(o){if(!o||!o.ok){renderLogin();return}var nx=nextPath();if(nx){location.replace(nx);return}state.me=o;state.testMode=!!o.testMode;var u=new URL(location.href);var v=u.searchParams.get('view'),ref=u.searchParams.get('ref');if(ref){state.view='request';state.ref=ref}else if(v)state.view=v;settleReturn(u).then(function(){render()})}).catch(function(){renderLogin()})}
boot();
})();</script>`;
  return sv1.shell({ title: tx.title, desc: tx.attention, path: "/my", body: CSS + body, script, noindex: true });
}
