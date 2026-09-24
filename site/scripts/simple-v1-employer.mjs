// Business Partner — Simple V1: بوابة صاحب العمل (/employer).
//
// لماذا صفحة واحدة، ولماذا من جديد:
// اللوحة القديمة (/hr/employer/*) عشرون صفحة HTML منفصلة، كل واحدة تعيد تحميل
// hr-app.js (‏١٧٣KB) و‏٣٢KB أنماطاً وخطوطاً حاجبة و hr-mock.json (‏٤١KB) وعدة
// نداءات على /api/candidates — وهي نداءات نوشن، الأبطأ في المنصّة. حتى صفحة
// «الإعدادات» كانت تجلب بيانات المرشحين وهي لا تحتاجها. فالبطء بنيوي لا
// تجميلي، ولا يُصلَح بتغيير ألوان: تُحمَّل الصفحة مرة واحدة، ويُتنقَّل بينها
// بلا إعادة تحميل، ولا يُجلب إلا ما تحتاجه الشاشة المفتوحة.
//
// خمس شاشات فقط — هي التي تعمل فعلاً على بيانات حقيقية:
//   الدخول · وظائفي · نشر إعلان · من تقدّم · ملف المرشّح
// أما التسع الأخرى في اللوحة القديمة فواجهاتٌ على بيانات وهمية، ولم تُنقل.
// ولا يُحمَّل hr-mock.json هنا إطلاقاً: هذه بوابة على بيانات حقيقية وحدها.
//
// الدخول: طريق واحد ظاهر — البريد ورمزٌ لمرة واحدة (api/otp.js). لا حقل
// للصق رمز الوصول، ولا «أرسله إلى بريدي». رمز الوصول هو الرمز الحامل الوحيد
// الذي يفتح بيانات كل المرشحين الشخصية، وكانت البوابة القديمة تطلب من صاحب
// العمل أن يحمله في بريده وحافظته ويلصقه بيده — ومن نسخه مرّة بقي عند من رآه.
// الآن: بريدٌ مُثبت ← يحلّ الخادم الرمز من صف نوشن (employerBySession في
// api/candidates.js) ← المتصفّح يكتب code:"self" ولا يرى الرمز أبداً.
// كلمة المرور تبقى باباً ثانوياً لمن عيّنها، وتحتها «نسيت كلمة المرور».
//
// الأفعال المستعملة، كلها قائمة تعمل:
//   POST /api/otp        start · verify · logout
//   GET  /api/candidates validate=1 · applicants=1        (بـ code=self)
//   POST /api/candidates list-postings · create-posting · update-posting
//                        close-posting · update-stage · request-interview
//   POST /api/hire       task:"jobdesc"   — يكتب الوصف من المسمّى
//   POST /api/employer   account · update-phone · reset-password
//
// request-interview فعلٌ قائم يعمل ويرسل إشعاراً ويربط مكتب الاستقدام، وكان
// مفقوداً من اللوحة القديمة تماماً — فأُضيف هنا في ملف المرشّح.

const T = {
  title:   { ar: "بوابة صاحب العمل", en: "Employer portal", fr: "Espace employeur", zh: "雇主门户" },
  desc:    { ar: "انشر وظيفة، واستقبل المتقدمين، وتابعهم من الفرز إلى العرض الوظيفي — في صفحة واحدة.",
             en: "Post a vacancy, receive applicants, and track them from screening to offer — in one page.",
             fr: "Publiez un poste, recevez les candidatures et suivez-les jusqu'à l'offre — en une seule page.",
             zh: "发布职位、接收申请，并从筛选跟进至录用——全部在一个页面中。" },

  // ------------------------------------------------------------- الدخول --
  loginH:  { ar: "ادخل بوابتك", en: "Sign in to your portal", fr: "Connectez-vous à votre espace", zh: "登录您的门户" },
  loginP:  { ar: "اكتب بريد شركتك ويصلك رمز لمرة واحدة. لا كلمة مرور تُنسى، ولا رمز دائم تحمله معك.",
             en: "Enter your company email and we send a one-time code. No password to forget, no permanent code to carry.",
             fr: "Saisissez l'e-mail de votre entreprise : un code à usage unique vous sera envoyé.",
             zh: "输入您的公司邮箱，我们会发送一次性验证码。无需记密码，也无需保管长期密钥。" },
  emailL:  { ar: "البريد الإلكتروني", en: "Email address", fr: "Adresse e-mail", zh: "电子邮箱" },
  sendOtp: { ar: "أرسل الرمز", en: "Send the code", fr: "Envoyer le code", zh: "发送验证码" },
  sending: { ar: "جارٍ الإرسال…", en: "Sending…", fr: "Envoi…", zh: "发送中…" },
  otpSent: { ar: "أرسلنا رمزاً من ٦ أرقام إلى", en: "We sent a 6-digit code to", fr: "Code à 6 chiffres envoyé à", zh: "我们已发送 6 位验证码至" },
  otpL:    { ar: "الرمز", en: "Code", fr: "Code", zh: "验证码" },
  otpGo:   { ar: "ادخل", en: "Sign in", fr: "Entrer", zh: "登录" },
  otpBack: { ar: "← بريد آخر", en: "← Different email", fr: "← Autre e-mail", zh: "← 更换邮箱" },
  pwOpen:  { ar: "الدخول بكلمة المرور بدلاً من ذلك", en: "Sign in with a password instead", fr: "Se connecter avec un mot de passe", zh: "改用密码登录" },
  otpOpen: { ar: "← الدخول برمز البريد", en: "← Sign in with an email code", fr: "← Se connecter par code e-mail", zh: "← 改用邮箱验证码登录" },
  pwH:     { ar: "الدخول بكلمة المرور", en: "Password sign-in", fr: "Connexion par mot de passe", zh: "密码登录" },
  pwL:     { ar: "كلمة المرور", en: "Password", fr: "Mot de passe", zh: "密码" },
  pwGo:    { ar: "دخول", en: "Sign in", fr: "Connexion", zh: "登录" },
  forgot:  { ar: "نسيت كلمة المرور", en: "Forgot your password", fr: "Mot de passe oublié", zh: "忘记密码" },
  rsH:     { ar: "استعادة كلمة المرور", en: "Reset your password", fr: "Réinitialiser le mot de passe", zh: "重置密码" },
  rsSend:  { ar: "أرسل رمز الاستعادة", en: "Send the reset code", fr: "Envoyer le code", zh: "发送重置码" },
  rsCodeL: { ar: "رمز الاستعادة", en: "Reset code", fr: "Code de réinitialisation", zh: "重置码" },
  rsNewL:  { ar: "كلمة المرور الجديدة (٨ أحرف فأكثر)", en: "New password (8+ characters)", fr: "Nouveau mot de passe (8+ caractères)", zh: "新密码（至少 8 位）" },
  rsGo:    { ar: "عيّن كلمة المرور", en: "Set the password", fr: "Définir le mot de passe", zh: "设置密码" },
  noSub:   { ar: "هذا البريد ليس عليه اشتراك مفعّل. التفعيل يدوي بعد تأكيد الدفع — تواصل معنا وسنفعّله.",
             en: "This email has no active subscription. Activation is manual after payment — contact us and we'll enable it.",
             fr: "Cet e-mail n'a pas d'abonnement actif. L'activation est manuelle après paiement — contactez-nous.",
             zh: "此邮箱没有已激活的订阅。付款后需人工激活——请联系我们。" },
  register:{ ar: "لا اشتراك لديك بعد؟ سجّل شركتك", en: "No subscription yet? Register your company", fr: "Pas encore abonné ? Inscrivez votre entreprise", zh: "还没有订阅？注册您的公司" },

  // ------------------------------------------------------------- الأخطاء --
  eEmail:  { ar: "اكتب بريداً صحيحاً.", en: "Enter a valid email address.", fr: "Saisissez un e-mail valide.", zh: "请输入有效的邮箱地址。" },
  eSend:   { ar: "تعذّر إرسال الرمز الآن. حاول بعد قليل أو ادخل بكلمة المرور.",
             en: "Couldn't send the code right now. Try again shortly, or sign in with a password.",
             fr: "Impossible d'envoyer le code. Réessayez ou utilisez un mot de passe.",
             zh: "暂时无法发送验证码。请稍后重试，或使用密码登录。" },
  eOtp:    { ar: "الرمز غير صحيح أو انتهت صلاحيته.", en: "That code is wrong or has expired.", fr: "Code incorrect ou expiré.", zh: "验证码错误或已过期。" },
  eNoSess: { ar: "تعذّر إنشاء الجلسة. ادخل بكلمة المرور هذه المرة.",
             en: "Couldn't start a session. Please sign in with a password this time.",
             fr: "Impossible d'ouvrir la session. Connectez-vous avec un mot de passe.",
             zh: "无法建立会话。请本次改用密码登录。" },
  ePw:     { ar: "البريد أو كلمة المرور غير صحيحة.", en: "Wrong email or password.", fr: "E-mail ou mot de passe incorrect.", zh: "邮箱或密码错误。" },
  eWeak:   { ar: "كلمة المرور قصيرة — ٨ أحرف فأكثر.", en: "Password too short — 8 characters or more.", fr: "Mot de passe trop court — 8 caractères minimum.", zh: "密码太短——至少 8 位。" },
  eNet:    { ar: "تعذّر الاتصال. حدّث الصفحة وحاول مرة أخرى.", en: "Connection failed. Refresh and try again.", fr: "Échec de connexion. Actualisez et réessayez.", zh: "连接失败。请刷新后重试。" },
  eSave:   { ar: "تعذّر الحفظ. حاول مرة أخرى.", en: "Couldn't save. Try again.", fr: "Échec de l'enregistrement. Réessayez.", zh: "保存失败。请重试。" },

  // -------------------------------------------------------------- التنقّل --
  navJobs: { ar: "وظائفي", en: "My vacancies", fr: "Mes postes", zh: "我的职位" },
  navNew:  { ar: "نشر إعلان", en: "Post a vacancy", fr: "Publier un poste", zh: "发布职位" },
  navApps: { ar: "من تقدّم", en: "Applicants", fr: "Candidatures", zh: "申请人" },
  acct:    { ar: "الحساب", en: "Account", fr: "Compte", zh: "账户" },
  logout:  { ar: "تسجيل الخروج", en: "Sign out", fr: "Se déconnecter", zh: "退出登录" },
  acctPw:  { ar: "تغيير كلمة المرور", en: "Change password", fr: "Changer le mot de passe", zh: "修改密码" },
  acctPh:  { ar: "رقم الجوال", en: "Mobile number", fr: "Numéro de mobile", zh: "手机号码" },
  acctSave:{ ar: "حفظ الرقم", en: "Save number", fr: "Enregistrer", zh: "保存号码" },
  acctOk:  { ar: "تم الحفظ.", en: "Saved.", fr: "Enregistré.", zh: "已保存。" },
  acctPhNo:{ ar: "تغيير الرقم متاحٌ عند الدخول برمز البريد. ادخل به لتعديله.",
             en: "Changing the number requires signing in with the email code. Sign in that way to edit it.",
             fr: "La modification du numéro nécessite la connexion par code e-mail.",
             zh: "修改号码需使用邮箱验证码登录后进行。" },
  acctPwNo:{ ar: "تغيير كلمة المرور يتم عبر «نسيت كلمة المرور» في شاشة الدخول: يصلك رمز على بريدك ثم تعيّن كلمة جديدة.",
             en: "Change your password via \"Forgot your password\" on the sign-in screen: a code reaches your inbox, then you set a new one.",
             fr: "Changez votre mot de passe via « Mot de passe oublié » sur l'écran de connexion.",
             zh: "请通过登录页的“忘记密码”修改密码：验证码发送至邮箱后设置新密码。" },
  plan:    { ar: "الباقة", en: "Plan", fr: "Forfait", zh: "套餐" },

  // ------------------------------------------------------------- وظائفي --
  jobsH:   { ar: "وظائفي", en: "My vacancies", fr: "Mes postes", zh: "我的职位" },
  loading: { ar: "جارٍ التحميل…", en: "Loading…", fr: "Chargement…", zh: "加载中…" },
  jobsNone:{ ar: "لا إعلانات بعد. انشر أول إعلان وسيظهر على صفحة الوظائف خلال دقائق.",
             en: "No vacancies yet. Post your first one and it appears on the jobs page within minutes.",
             fr: "Aucun poste. Publiez le premier : il paraîtra sur la page emplois en quelques minutes.",
             zh: "暂无职位。发布第一个职位，几分钟内即会出现在职位页面。" },
  stActive:{ ar: "نشطة", en: "Active", fr: "Active", zh: "招聘中" },
  stClosed:{ ar: "مغلقة", en: "Closed", fr: "Clôturé", zh: "已关闭" },
  edit:    { ar: "تعديل", en: "Edit", fr: "Modifier", zh: "编辑" },
  closeJob:{ ar: "إغلاق", en: "Close", fr: "Clôturer", zh: "关闭" },
  closeAsk:{ ar: "إغلاق هذا الإعلان؟ سيختفي من صفحة الوظائف ولن يصلك متقدّمون جدد.",
             en: "Close this vacancy? It leaves the jobs page and no new applicants reach you.",
             fr: "Clôturer ce poste ? Il disparaît de la page emplois.",
             zh: "关闭此职位？它将从职位页面移除，不再接收新申请。" },
  viewJob: { ar: "الإعلان العام", en: "Public advert", fr: "Annonce publique", zh: "公开招聘页" },

  // ---------------------------------------------------------- نشر إعلان --
  newH:    { ar: "نشر إعلان", en: "Post a vacancy", fr: "Publier un poste", zh: "发布职位" },
  editH:   { ar: "تعديل الإعلان", en: "Edit the vacancy", fr: "Modifier le poste", zh: "编辑职位" },
  fTitle:  { ar: "المسمّى الوظيفي", en: "Job title", fr: "Intitulé du poste", zh: "职位名称" },
  fCity:   { ar: "المدينة", en: "City", fr: "Ville", zh: "城市" },
  fField:  { ar: "المجال", en: "Field", fr: "Domaine", zh: "领域" },
  fFieldN: { ar: "— اختر —", en: "— choose —", fr: "— choisir —", zh: "— 请选择 —" },
  fDesc:   { ar: "الوصف والمتطلبات", en: "Description and requirements", fr: "Description et exigences", zh: "职位描述与要求" },
  aiWrite: { ar: "✦ اكتب الوصف من المسمّى", en: "✦ Write the description from the title", fr: "✦ Rédiger la description", zh: "✦ 根据职位名称生成描述" },
  aiWork:  { ar: "جارٍ الكتابة…", en: "Writing…", fr: "Rédaction…", zh: "生成中…" },
  aiNeed:  { ar: "اكتب المسمّى الوظيفي أولاً.", en: "Enter the job title first.", fr: "Saisissez d'abord l'intitulé.", zh: "请先填写职位名称。" },
  aiFail:  { ar: "تعذّرت الكتابة الآن — اكتب الوصف بنفسك.", en: "Couldn't write it now — please write the description yourself.", fr: "Rédaction impossible — écrivez la description vous-même.", zh: "暂时无法生成——请自行撰写描述。" },
  publish: { ar: "انشر الإعلان", en: "Publish", fr: "Publier", zh: "发布" },
  saveJob: { ar: "احفظ التعديل", en: "Save changes", fr: "Enregistrer", zh: "保存修改" },
  saving:  { ar: "جارٍ الحفظ…", en: "Saving…", fr: "Enregistrement…", zh: "保存中…" },
  published:{ ar: "نُشر الإعلان.", en: "Published.", fr: "Publié.", zh: "已发布。" },
  eFields: { ar: "المسمّى والوصف مطلوبان.", en: "Title and description are required.", fr: "L'intitulé et la description sont obligatoires.", zh: "职位名称和描述为必填项。" },
  cancel:  { ar: "إلغاء", en: "Cancel", fr: "Annuler", zh: "取消" },

  // ----------------------------------------------------------- من تقدّم --
  appsH:   { ar: "من تقدّم", en: "Applicants", fr: "Candidatures", zh: "申请人" },
  appsNone:{ ar: "لا متقدّمين بعد على إعلاناتك.", en: "No applicants on your vacancies yet.", fr: "Aucune candidature pour l'instant.", zh: "您的职位暂无申请人。" },
  appsAll: { ar: "كل الإعلانات", en: "All vacancies", fr: "Tous les postes", zh: "全部职位" },
  appsN:   { ar: "متقدّم", en: "applicants", fr: "candidats", zh: "位申请人" },
  appsCut: { ar: "القائمة طويلة وقُطع جزء منها — حدّث الصفحة لرؤية البقية.",
             en: "The list is long and part of it was cut — refresh to see the rest.",
             fr: "La liste est longue et tronquée — actualisez pour voir la suite.",
             zh: "列表过长已被截断——请刷新查看其余内容。" },
  open:    { ar: "افتح الملف", en: "Open profile", fr: "Ouvrir le profil", zh: "查看档案" },

  // ------------------------------------------------------- ملف المرشّح --
  profBack:{ ar: "← عودة إلى المتقدّمين", en: "← Back to applicants", fr: "← Retour aux candidatures", zh: "← 返回申请人" },
  stage:   { ar: "المرحلة", en: "Stage", fr: "Étape", zh: "阶段" },
  sNew:    { ar: "جديد", en: "New", fr: "Nouveau", zh: "新申请" },
  sReview: { ar: "فرز", en: "Screening", fr: "Présélection", zh: "筛选中" },
  sShort:  { ar: "قائمة مختصرة", en: "Shortlist", fr: "Présélectionné", zh: "候选名单" },
  sInt:    { ar: "مقابلة", en: "Interview", fr: "Entretien", zh: "面试" },
  sOffer:  { ar: "عرض", en: "Offer", fr: "Offre", zh: "录用意向" },
  sHired:  { ar: "تم التوظيف", en: "Hired", fr: "Recruté", zh: "已录用" },
  sRej:    { ar: "مرفوض", en: "Rejected", fr: "Refusé", zh: "未通过" },
  sFuture: { ar: "مؤجل", en: "On hold", fr: "En attente", zh: "暂缓" },
  fRole:   { ar: "الدور", en: "Role", fr: "Poste", zh: "职位" },
  fCityL:  { ar: "المدينة", en: "City", fr: "Ville", zh: "城市" },
  fExp:    { ar: "الخبرة", en: "Experience", fr: "Expérience", zh: "工作年限" },
  fYears:  { ar: "سنة", en: "years", fr: "ans", zh: "年" },
  fSkills: { ar: "المهارات", en: "Skills", fr: "Compétences", zh: "技能" },
  fPhone:  { ar: "الجوال", en: "Mobile", fr: "Mobile", zh: "手机" },
  fEmail:  { ar: "البريد", en: "Email", fr: "E-mail", zh: "邮箱" },
  fCv:     { ar: "السيرة الذاتية", en: "CV", fr: "CV", zh: "简历" },
  cvOpen:  { ar: "افتح الملف", en: "Open file", fr: "Ouvrir le fichier", zh: "打开文件" },
  reqH:    { ar: "اطلب مقابلة", en: "Request an interview", fr: "Demander un entretien", zh: "申请面试" },
  reqP:    { ar: "نتولّى نحن جدولة الموعد مع المرشّح ونعود إليك به — أو مع مكتب الاستقدام الذي رشّحه إن كان الترشيح عبر مكتب.",
             en: "We arrange the appointment with the candidate and come back to you with it — or with the recruitment office that nominated them.",
             fr: "Nous organisons le rendez-vous avec le candidat et revenons vers vous.",
             zh: "我们将与候选人（或推荐该候选人的招聘机构）安排时间并回复您。" },
  reqPref: { ar: "توقيت يناسبك (اختياري)", en: "A time that suits you (optional)", fr: "Créneau souhaité (facultatif)", zh: "您方便的时间（可选）" },
  reqMode: { ar: "طريقة المقابلة", en: "Interview format", fr: "Format de l'entretien", zh: "面试方式" },
  mIn:     { ar: "حضوري", en: "In person", fr: "En présentiel", zh: "现场" },
  mOn:     { ar: "أونلاين", en: "Online", fr: "En ligne", zh: "线上" },
  mPh:     { ar: "هاتف", en: "Phone", fr: "Téléphone", zh: "电话" },
  reqGo:   { ar: "أرسل الطلب", en: "Send the request", fr: "Envoyer la demande", zh: "发送申请" },
  reqOk:   { ar: "وصل طلبك — نرجع إليك بالموعد.", en: "Your request is in — we'll come back with the appointment.", fr: "Demande reçue — nous revenons vers vous avec le rendez-vous.", zh: "已收到您的申请——我们会回复面试时间。" },
  reqWork: { ar: "جارٍ الإرسال…", en: "Sending…", fr: "Envoi…", zh: "发送中…" },
};

// نفس تصنيف المجالات في api/candidates.js (FIELD_OPTIONS) — القيمة المرسلة
// عربية دائماً لأن نوشن يخزّنها كذلك، والعرض بلغة الصفحة حيث تُرجمت.
const FIELDS = [
  "هندسة", "تقنية معلومات", "مبيعات وتسويق", "محاسبة ومالية", "إداري وسكرتارية", "موارد بشرية",
  "ضيافة وسياحة", "مقاولات وإنشاءات", "عقارات", "صحة وطب", "تعليم", "لوجستيات ونقل",
  "قانون", "تصنيع وصناعة", "طاقة ونفط وغاز", "إعلام وإبداع", "حكومي وقطاع عام", "زراعة وبيئة",
  "تجزئة وتجارة إلكترونية", "أمن وسلامة", "حرف مهنية وصيانة", "علوم وأبحاث", "طيران وبحري", "تجميل وعناية",
  "خدمات منزلية", "أخرى",
];

export function buildSimpleEmployer(SV1, ctx) {
  const { lang: langFn, esc } = ctx;
  const lang = langFn();
  const t = (k) => { const e = T[k]; return e && e[lang] != null ? e[lang] : (e ? e.en : k); };
  const pre = lang === "en" ? "" : "/" + lang;
  const u = (p) => pre + p;

  const fieldOpts = [`<option value="">${esc(t("fFieldN"))}</option>`]
    .concat(FIELDS.map((f) => `<option value="${esc(f)}">${esc(f)}</option>`)).join("");

  const CSS = `<style id="sv1-emp-css">
.sv1-emp{max-width:1080px;margin:0 auto;padding:0 20px}
.sv1-emp-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;
 border-bottom:1px solid var(--l);padding:14px 0;margin-bottom:22px}
.sv1-emp-who{display:flex;align-items:baseline;gap:9px;min-width:0}
.sv1-emp-who b{font-size:16px;font-weight:600;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sv1-emp-who span{font-size:11.5px;color:var(--mut);white-space:nowrap}
.sv1-emp-nav{display:flex;gap:7px;flex-wrap:wrap}
.sv1-emp-nav button{border:1px solid var(--l);background:#fff;border-radius:9px;padding:8px 15px;font:inherit;
 font-size:13px;font-weight:500;color:var(--mut);cursor:pointer}
.sv1-emp-nav button.on{background:var(--ac);border-color:var(--ac);color:#fff}
.sv1-acct{position:relative}
.sv1-acct summary{list-style:none;cursor:pointer;border:1px solid var(--l);background:#fff;border-radius:9px;
 padding:8px 14px;font-size:13px;font-weight:500;color:var(--ink);display:inline-flex;align-items:center;gap:7px}
.sv1-acct summary::-webkit-details-marker{display:none}
.sv1-acct .menu{position:absolute;inset-inline-end:0;top:calc(100% + 6px);background:#fff;border:1px solid var(--l);
 border-radius:12px;box-shadow:var(--sh2);width:290px;padding:14px;z-index:9}
.sv1-acct .menu h5{margin:0 0 3px;font-size:13px;color:var(--ink);font-weight:600}
.sv1-acct .menu .ro{font-size:12px;color:var(--mut);margin:0 0 12px;word-break:break-all}
.sv1-acct .menu label{display:block;font-size:11.5px;color:var(--mut);margin:10px 0 4px}
.sv1-emp-h{font-size:22px;font-weight:300;margin:0 0 4px;color:var(--ink)}
.sv1-emp-sub{font-size:12.5px;color:var(--mut);margin:0 0 18px}
.sv1-emp-f input,.sv1-emp-f select,.sv1-emp-f textarea,.sv1-acct input{
 width:100%;border:1px solid var(--l);border-radius:10px;padding:10px 12px;font:inherit;font-size:13.5px;
 outline:none;background:#fff;color:var(--ink)}
.sv1-emp-f textarea{min-height:200px;resize:vertical;line-height:1.85}
.sv1-emp-f input:focus,.sv1-emp-f select:focus,.sv1-emp-f textarea:focus{border-color:var(--ac)}
.sv1-emp-f label{display:block;font-size:12px;color:var(--mut);margin:14px 0 5px;font-weight:500}
.sv1-emp-f .row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.sv1-emp-f .acts{display:flex;gap:8px;margin-top:18px;flex-wrap:wrap;align-items:center}
.sv1-emp-card{background:#fff;border:1px solid var(--l);border-radius:13px;padding:16px 18px;margin-bottom:10px;
 box-shadow:var(--sh);display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap}
.sv1-emp-card .g{flex:1;min-width:220px}
.sv1-emp-card h4{margin:0 0 5px;font-size:15.5px;font-weight:600;color:var(--ink);line-height:1.5}
.sv1-emp-card p{margin:0;font-size:12.5px;color:var(--s);line-height:1.7}
.sv1-emp-card .acts{display:flex;gap:7px;flex-wrap:wrap;align-items:center}
.sv1-pill{display:inline-block;font-size:10.5px;font-weight:600;padding:4px 9px;border-radius:999px;
 background:#eef1f7;color:#5a6280;white-space:nowrap}
.sv1-pill.ok{background:#e6f6ec;color:#12693a}
.sv1-pill.off{background:#f3f4f6;color:#8b90a0}
.sv1-emp-jobsel{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:16px}
.sv1-emp-jobsel button{border:1px solid var(--l);background:#fff;border-radius:999px;padding:7px 14px;
 font:inherit;font-size:12px;color:var(--mut);cursor:pointer}
.sv1-emp-jobsel button.on{border-color:var(--ac);color:var(--ac);background:var(--acSoft);font-weight:600}
.sv1-emp-kv{display:grid;grid-template-columns:auto 1fr;gap:7px 16px;font-size:13px;margin:0 0 16px}
.sv1-emp-kv dt{color:var(--mut);font-size:12px}
.sv1-emp-kv dd{margin:0;color:var(--ink);word-break:break-word}
.sv1-emp-login{max-width:420px;margin:30px auto 60px;background:#fff;border:1px solid var(--l);
 border-radius:15px;padding:26px;box-shadow:var(--sh2)}
.sv1-emp-login h2{font-size:22px;font-weight:300;margin:0 0 6px;color:var(--ink)}
.sv1-emp-login p.lead{font-size:12.5px;color:var(--mut);line-height:1.8;margin:0 0 18px}
.sv1-emp-login label{display:block;font-size:12px;color:var(--mut);margin:12px 0 5px;font-weight:500}
.sv1-emp-login input{width:100%;border:1px solid var(--l);border-radius:10px;padding:11px 13px;font:inherit;
 font-size:14px;outline:none}
.sv1-emp-login input:focus{border-color:var(--ac)}
.sv1-emp-login .sv1-btn{width:100%;margin-top:16px}
.sv1-emp-link{background:none;border:0;padding:0;font:inherit;font-size:12.5px;color:var(--ac);
 cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.sv1-emp-alt{margin-top:18px;padding-top:16px;border-top:1px solid var(--l);text-align:center}
.sv1-emp-msg{font-size:12.5px;line-height:1.75;margin:12px 0 0}
.sv1-emp-msg.err{color:#b42318}
.sv1-emp-msg.ok{color:#12693a}
.sv1-emp-code{font-family:var(--fm);letter-spacing:.35em;text-align:center;font-size:19px}
.sv1-hidden{display:none !important}
@media(max-width:700px){
 .sv1-emp-f .row{grid-template-columns:1fr}
 .sv1-emp-bar{padding:12px 0}
 .sv1-acct .menu{width:min(290px,calc(100vw - 40px))}
}
</style>`;

  const body = `${SV1.header("/employer", { cta: false })}
<main>
<section class="sv1-sec" style="padding:26px 0 70px"><div class="sv1-emp">

  <!-- الدخول -->
  <div id="empLogin">
    <div class="sv1-emp-login">
      <h2>${esc(t("loginH"))}</h2>
      <p class="lead">${esc(t("loginP"))}</p>

      <form id="fOtpStart">
        <label for="otpEmail">${esc(t("emailL"))}</label>
        <input id="otpEmail" type="email" autocomplete="email" inputmode="email" dir="ltr" required>
        <button class="sv1-btn primary" type="submit" id="otpStartBtn">${esc(t("sendOtp"))}</button>
      </form>

      <form id="fOtpVerify" class="sv1-hidden">
        <p class="sv1-emp-msg">${esc(t("otpSent"))} <b id="otpTo" dir="ltr"></b></p>
        <label for="otpCode">${esc(t("otpL"))}</label>
        <input id="otpCode" class="sv1-emp-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required>
        <button class="sv1-btn primary" type="submit" id="otpGoBtn">${esc(t("otpGo"))}</button>
        <p style="margin-top:12px;text-align:center"><button type="button" class="sv1-emp-link" id="otpBack">${esc(t("otpBack"))}</button></p>
      </form>

      <form id="fPw" class="sv1-hidden">
        <h2 style="font-size:17px;margin-bottom:12px">${esc(t("pwH"))}</h2>
        <label for="pwEmail">${esc(t("emailL"))}</label>
        <input id="pwEmail" type="email" autocomplete="email" dir="ltr" required>
        <label for="pwPass">${esc(t("pwL"))}</label>
        <input id="pwPass" type="password" autocomplete="current-password" required>
        <button class="sv1-btn primary" type="submit" id="pwGoBtn">${esc(t("pwGo"))}</button>
        <p style="margin-top:12px;text-align:center">
          <button type="button" class="sv1-emp-link" id="toReset">${esc(t("forgot"))}</button>
        </p>
      </form>

      <form id="fReset" class="sv1-hidden">
        <h2 style="font-size:17px;margin-bottom:12px">${esc(t("rsH"))}</h2>
        <label for="rsEmail">${esc(t("emailL"))}</label>
        <input id="rsEmail" type="email" autocomplete="email" dir="ltr" required>
        <div id="rsStep2" class="sv1-hidden">
          <label for="rsCode">${esc(t("rsCodeL"))}</label>
          <input id="rsCode" class="sv1-emp-code" inputmode="numeric" maxlength="6">
          <label for="rsNew">${esc(t("rsNewL"))}</label>
          <input id="rsNew" type="password" autocomplete="new-password">
        </div>
        <button class="sv1-btn primary" type="submit" id="rsBtn">${esc(t("rsSend"))}</button>
      </form>

      <p class="sv1-emp-msg err sv1-hidden" id="loginErr"></p>
      <p class="sv1-emp-msg ok sv1-hidden" id="loginOk"></p>

      <div class="sv1-emp-alt">
        <button type="button" class="sv1-emp-link" id="toPw">${esc(t("pwOpen"))}</button>
      </div>
      <p style="text-align:center;margin:14px 0 0">
        <a class="sv1-emp-link" href="${esc(u("/employer-join"))}">${esc(t("register"))}</a>
      </p>
    </div>
  </div>

  <!-- البوابة -->
  <div id="empApp" class="sv1-hidden">
    <div class="sv1-emp-bar">
      <div class="sv1-emp-who">
        <b id="empCo">Business Partner</b>
        <span id="empPlan"></span>
      </div>
      <div class="sv1-emp-nav">
        <button type="button" data-go="jobs" id="tabJobs">${esc(t("navJobs"))}</button>
        <button type="button" data-go="new" id="tabNew">${esc(t("navNew"))}</button>
        <button type="button" data-go="apps" id="tabApps">${esc(t("navApps"))}</button>
        <details class="sv1-acct" id="acctBox">
          <summary>${esc(t("acct"))} ▾</summary>
          <div class="menu">
            <h5 id="acctCo">—</h5>
            <p class="ro" id="acctEmail" dir="ltr"></p>
            <div id="acctPhoneWrap">
              <label for="acctPhone">${esc(t("acctPh"))}</label>
              <input id="acctPhone" type="tel" dir="ltr" autocomplete="tel">
              <button type="button" class="sv1-btn sm" id="acctPhoneBtn" style="margin-top:8px">${esc(t("acctSave"))}</button>
            </div>
            <p class="sv1-emp-msg" id="acctMsg" style="margin-top:8px"></p>
            <p class="sv1-emp-msg" style="margin-top:12px">${esc(t("acctPwNo"))}</p>
            <button type="button" class="sv1-btn sm" id="acctOut" style="margin-top:14px;width:100%">${esc(t("logout"))}</button>
          </div>
        </details>
      </div>
    </div>

    <!-- وظائفي -->
    <div id="scJobs" class="sv1-hidden">
      <h3 class="sv1-emp-h">${esc(t("jobsH"))}</h3>
      <p class="sv1-emp-sub" id="jobsStatus">${esc(t("loading"))}</p>
      <div id="jobsList"></div>
    </div>

    <!-- نشر إعلان -->
    <div id="scNew" class="sv1-hidden">
      <h3 class="sv1-emp-h" id="newH">${esc(t("newH"))}</h3>
      <p class="sv1-emp-sub" id="newSub"></p>
      <form class="sv1-emp-f" id="fJob" style="max-width:720px">
        <div class="row">
          <div><label for="jTitle">${esc(t("fTitle"))}</label><input id="jTitle" required maxlength="200"></div>
          <div><label for="jCity">${esc(t("fCity"))}</label><input id="jCity" maxlength="120"></div>
        </div>
        <label for="jField">${esc(t("fField"))}</label>
        <select id="jField">${fieldOpts}</select>
        <label for="jDesc">${esc(t("fDesc"))}</label>
        <textarea id="jDesc" required maxlength="4000"></textarea>
        <div class="acts">
          <button type="button" class="sv1-btn sm" id="jAi">${esc(t("aiWrite"))}</button>
          <button type="submit" class="sv1-btn primary" id="jSave">${esc(t("publish"))}</button>
          <button type="button" class="sv1-btn sm sv1-hidden" id="jCancel">${esc(t("cancel"))}</button>
          <span class="sv1-emp-msg" id="jMsg"></span>
        </div>
      </form>
    </div>

    <!-- من تقدّم -->
    <div id="scApps" class="sv1-hidden">
      <h3 class="sv1-emp-h">${esc(t("appsH"))}</h3>
      <p class="sv1-emp-sub" id="appsStatus">${esc(t("loading"))}</p>
      <div class="sv1-emp-jobsel" id="appsJobs"></div>
      <div id="appsList"></div>
    </div>

    <!-- ملف المرشّح -->
    <div id="scCand" class="sv1-hidden">
      <p style="margin:0 0 14px"><button type="button" class="sv1-emp-link" id="candBack">${esc(t("profBack"))}</button></p>
      <div id="candBody"></div>
    </div>
  </div>

</div></section>
</main>
${SV1.footer()}`;

  const TX = {};
  for (const k of Object.keys(T)) TX[k] = t(k);

  const script = `<script>(function(){"use strict";
var TX=${JSON.stringify(TX)},HOME=${JSON.stringify(u("/employer"))},JOB=${JSON.stringify(u("/job") + "?id=")};
var $=function(i){return document.getElementById(i)};
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){
 return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function show(el,on){if(el)el.classList.toggle('sv1-hidden',!on)}
function j(r){return r.json().catch(function(){return{}})}

// ── الهوية ────────────────────────────────────────────────────────────────
// mode 'session' = بريدٌ مُثبت برمز لمرة واحدة؛ الخادم يحلّ رمز الوصول بنفسه
// من صفّ نوشن، والمتصفّح لا يراه ولا يخزّنه. mode 'code' = الدخول بكلمة
// المرور، والرمز الذي يعيده /api/employer يبقى في الذاكرة وحدها: لا
// localStorage ولا sessionStorage ولا شاشة تعرضه. إغلاق التبويب يمحوه.
var AUTH=null, CO='', PLAN='';
function authCode(){return AUTH&&AUTH.mode==='code'?AUTH.code:'self'}
function get(qs){return fetch('/api/candidates?'+qs+'&code='+encodeURIComponent(authCode()),
 {credentials:'same-origin'}).then(j)}
function post(url,body){body.code=authCode();
 return fetch(url,{method:'POST',credentials:'same-origin',
  headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(j)}

// ── شاشة الدخول ───────────────────────────────────────────────────────────
var lErr=$('loginErr'),lOk=$('loginOk');
function err(m){lErr.textContent=m;show(lErr,!!m);show(lOk,false)}
function ok(m){lOk.textContent=m;show(lOk,!!m);show(lErr,false)}
// الزرّ السفلي بابٌ ذو اتجاهين: من مسار رمز البريد إلى كلمة المرور، ومن
// كلمة المرور (أو الاستعادة) رجوعاً إليه. كان اتجاهاً واحداً فيُحبس من نزل
// إلى كلمة المرور فيها حتى يحدّث الصفحة.
function pane(id){['fOtpStart','fOtpVerify','fPw','fReset'].forEach(function(f){show($(f),f===id)});
 var onOtp=(id==='fOtpStart'||id==='fOtpVerify');
 $('toPw').textContent=onOtp?TX.pwOpen:TX.otpOpen;
 $('toPw').setAttribute('data-to',onOtp?'fPw':'fOtpStart');
 err('');ok('')}

var challenge='',otpEmail='';
$('fOtpStart').onsubmit=function(e){e.preventDefault();
 var em=$('otpEmail').value.trim().toLowerCase();
 if(em.indexOf('@')<1){err(TX.eEmail);return}
 var b=$('otpStartBtn');b.disabled=true;b.textContent=TX.sending;err('');
 fetch('/api/otp',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},
  body:JSON.stringify({action:'start',email:em})}).then(j).then(function(d){
  b.disabled=false;b.textContent=TX.sendOtp;
  if(!d||!d.ok){err(TX.eSend);return}
  challenge=d.challenge||'';otpEmail=em;
  $('otpTo').textContent=d.to||em;pane('fOtpVerify');
  if(d.devCode)$('otpCode').value=d.devCode;
  $('otpCode').focus()
 }).catch(function(){b.disabled=false;b.textContent=TX.sendOtp;err(TX.eNet)})};

$('otpBack').onclick=function(){pane('fOtpStart')};
$('toPw').onclick=function(){
 if($('toPw').getAttribute('data-to')==='fOtpStart'){rsToken='';show($('rsStep2'),false);pane('fOtpStart');return}
 pane('fPw');if(!$('pwEmail').value)$('pwEmail').value=$('otpEmail').value};
$('toReset').onclick=function(){pane('fReset');$('rsEmail').value=$('pwEmail').value};

$('fOtpVerify').onsubmit=function(e){e.preventDefault();
 var c=$('otpCode').value.trim();if(!c){return}
 var b=$('otpGoBtn');b.disabled=true;b.textContent=TX.sending;err('');
 fetch('/api/otp',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},
  body:JSON.stringify({action:'verify',email:otpEmail,code:c,challenge:challenge})}).then(j).then(function(d){
  b.disabled=false;b.textContent=TX.otpGo;
  if(!d||!d.ok){err(TX.eOtp);return}
  // ‏api/otp.js يثبت ملكية البريد ويفتح جلسة Business Partner — ولا يعرف شيئاً
  // عن اشتراك صاحب العمل. الربط يتم في الخادم بعد ذلك: validate=1&code=self
  // يبحث عن صفٍّ «مفعّل» بهذا البريد ويحلّ منه رمز الوصول بلا أن يعيده.
  if(!d.db){err(TX.eNoSess);return}
  enter()
 }).catch(function(){b.disabled=false;b.textContent=TX.otpGo;err(TX.eNet)})};

$('fPw').onsubmit=function(e){e.preventDefault();
 var em=$('pwEmail').value.trim().toLowerCase(),pw=$('pwPass').value;
 if(em.indexOf('@')<1){err(TX.eEmail);return}
 var b=$('pwGoBtn');b.disabled=true;b.textContent=TX.sending;err('');
 fetch('/api/employer',{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({action:'login',email:em,password:pw})}).then(j).then(function(d){
  b.disabled=false;b.textContent=TX.pwGo;
  if(!d||!d.ok||!d.code){err(TX.ePw);return}
  AUTH={mode:'code',code:d.code,email:em};CO=d.company||'';PLAN=d.plan||'';
  $('pwPass').value='';
  enter()
 }).catch(function(){b.disabled=false;b.textContent=TX.pwGo;err(TX.eNet)})};

var rsToken='';
$('fReset').onsubmit=function(e){e.preventDefault();
 var em=$('rsEmail').value.trim().toLowerCase();
 if(em.indexOf('@')<1){err(TX.eEmail);return}
 var b=$('rsBtn');b.disabled=true;b.textContent=TX.sending;err('');
 if(!rsToken){
  fetch('/api/employer',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({action:'reset-password',email:em})}).then(j).then(function(d){
   b.disabled=false;
   if(!d||!d.ok){b.textContent=TX.rsSend;err(TX.eSend);return}
   rsToken=d.t||'';show($('rsStep2'),true);b.textContent=TX.rsGo;ok(d.message||'')
  }).catch(function(){b.disabled=false;b.textContent=TX.rsSend;err(TX.eNet)});
  return}
 var np=$('rsNew').value;
 if(!np||np.length<8){b.disabled=false;b.textContent=TX.rsGo;err(TX.eWeak);return}
 fetch('/api/employer',{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({action:'reset-password',email:em,code:$('rsCode').value.trim(),t:rsToken,password:np})})
 .then(j).then(function(d){
  b.disabled=false;b.textContent=TX.rsGo;
  if(!d||!d.ok){err((d&&d.message)||TX.eOtp);return}
  rsToken='';show($('rsStep2'),false);pane('fPw');ok(d.message||'')
 }).catch(function(){b.disabled=false;b.textContent=TX.rsGo;err(TX.eNet)})};

// ── الدخول إلى البوابة ────────────────────────────────────────────────────
function enter(){
 if(!AUTH)AUTH={mode:'session'};
 get('validate=1').then(function(d){
  if(!d||!d.unlocked){
   if(AUTH.mode==='session')AUTH=null;
   err(TX.noSub);return}
  CO=d.company||CO;PLAN=d.plan||PLAN;
  $('empCo').textContent=CO||'Business Partner';
  $('empPlan').textContent=PLAN?TX.plan+': '+PLAN:'';
  show($('empLogin'),false);show($('empApp'),true);
  route()
 }).catch(function(){err(TX.eNet)})}

// ── التنقّل: لا إعادة تحميل، ولا جلبٌ لشاشة غير مفتوحة ────────────────────
var loaded={jobs:false,apps:false};
function route(){
 var h=(location.hash||'').replace(/^#\\/?/,'');
 var sc=h.split('/')[0]||'jobs';
 if(sc==='c'){openCand(h.split('/').slice(1).join('/'));return}
 if(sc!=='jobs'&&sc!=='new'&&sc!=='apps')sc='jobs';
 show($('scJobs'),sc==='jobs');show($('scNew'),sc==='new');
 show($('scApps'),sc==='apps');show($('scCand'),false);
 $('tabJobs').classList.toggle('on',sc==='jobs');
 $('tabNew').classList.toggle('on',sc==='new');
 $('tabApps').classList.toggle('on',sc==='apps');
 if(sc==='jobs'&&!loaded.jobs)loadJobs();
 if(sc==='apps'&&!loaded.apps)loadApps();
 if(sc==='new'&&editId===null&&!$('jTitle').value)resetJobForm()}
window.addEventListener('hashchange',function(){if(AUTH)route()});
Array.prototype.forEach.call(document.querySelectorAll('[data-go]'),function(b){
 b.onclick=function(){location.hash='#/'+b.getAttribute('data-go')}});

// ── وظائفي ────────────────────────────────────────────────────────────────
var postings=[];
function loadJobs(){
 loaded.jobs=true;$('jobsStatus').textContent=TX.loading;$('jobsList').innerHTML='';
 post('/api/candidates',{action:'list-postings'}).then(function(d){
  if(!d||!d.ok){loaded.jobs=false;$('jobsStatus').textContent=TX.eNet;return}
  postings=d.postings||[];drawJobs()
 }).catch(function(){loaded.jobs=false;$('jobsStatus').textContent=TX.eNet})}

function drawJobs(){
 if(!postings.length){$('jobsStatus').textContent=TX.jobsNone;$('jobsList').innerHTML='';return}
 $('jobsStatus').textContent='';
 $('jobsList').innerHTML=postings.map(function(p,i){
  var closed=p.status==='مغلقة';
  var meta=[p.city,p.field].filter(Boolean).join(' · ');
  // الإعلانات الثابتة في صفحة «الوظائف» لدينا ليست صفوفاً في قاعدة الإعلانات،
  // فلا تُعدَّل ولا تُغلق من هنا — تُعرض لأن عليها متقدّمين.
  var acts=p.site
   ?'<a class="sv1-btn sm" href="'+esc(p.url||'#')+'">'+esc(TX.viewJob)+'</a>'
   :'<a class="sv1-btn sm" href="'+JOB+encodeURIComponent(p.id)+'">'+esc(TX.viewJob)+'</a>'+
    '<button type="button" class="sv1-btn sm" data-edit="'+i+'">'+esc(TX.edit)+'</button>'+
    (closed?'':'<button type="button" class="sv1-btn sm" data-close="'+i+'">'+esc(TX.closeJob)+'</button>');
  return '<div class="sv1-emp-card"><div class="g"><h4>'+esc(p.title)+'</h4>'+
   (meta?'<p>'+esc(meta)+'</p>':'')+'</div>'+
   '<span class="sv1-pill '+(closed?'off':'ok')+'">'+esc(closed?TX.stClosed:TX.stActive)+'</span>'+
   '<div class="acts">'+acts+'</div></div>'}).join('');
 Array.prototype.forEach.call($('jobsList').querySelectorAll('[data-edit]'),function(b){
  b.onclick=function(){editJob(postings[+b.getAttribute('data-edit')])}});
 Array.prototype.forEach.call($('jobsList').querySelectorAll('[data-close]'),function(b){
  b.onclick=function(){
   var p=postings[+b.getAttribute('data-close')];
   if(!window.confirm(TX.closeAsk))return;
   b.disabled=true;
   post('/api/candidates',{action:'close-posting',id:p.id}).then(function(d){
    if(d&&d.ok){p.status='مغلقة';drawJobs()}else{b.disabled=false;window.alert(TX.eSave)}
   }).catch(function(){b.disabled=false;window.alert(TX.eSave)})}});
}

// ── نشر إعلان / تعديله ────────────────────────────────────────────────────
var editId=null;
function resetJobForm(){editId=null;
 $('newH').textContent=TX.newH;$('newSub').textContent='';
 $('jTitle').value='';$('jCity').value='';$('jField').value='';$('jDesc').value='';
 $('jSave').textContent=TX.publish;$('jMsg').textContent='';$('jMsg').className='sv1-emp-msg';
 show($('jCancel'),false)}
function editJob(p){editId=p.id;
 $('newH').textContent=TX.editH;$('newSub').textContent=p.title||'';
 $('jTitle').value=p.title||'';$('jCity').value=p.city||'';
 $('jField').value=p.field||'';$('jDesc').value=p.description||'';
 $('jSave').textContent=TX.saveJob;$('jMsg').textContent='';$('jMsg').className='sv1-emp-msg';
 show($('jCancel'),true);location.hash='#/new';window.scrollTo(0,0)}
$('jCancel').onclick=function(){resetJobForm();location.hash='#/jobs'};

$('jAi').onclick=function(){
 var title=$('jTitle').value.trim();
 var m=$('jMsg');m.className='sv1-emp-msg';
 if(!title){m.className='sv1-emp-msg err';m.textContent=TX.aiNeed;return}
 var b=$('jAi');b.disabled=true;b.textContent=TX.aiWork;m.textContent='';
 fetch('/api/hire',{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({task:'jobdesc',title:title,field:$('jField').value,city:$('jCity').value.trim()})})
 .then(j).then(function(d){b.disabled=false;b.textContent=TX.aiWrite;
  if(d&&d.ok&&d.result)$('jDesc').value=d.result;
  else{m.className='sv1-emp-msg err';m.textContent=TX.aiFail}
 }).catch(function(){b.disabled=false;b.textContent=TX.aiWrite;
  m.className='sv1-emp-msg err';m.textContent=TX.aiFail})};

$('fJob').onsubmit=function(e){e.preventDefault();
 var title=$('jTitle').value.trim(),desc=$('jDesc').value.trim();
 var m=$('jMsg');m.className='sv1-emp-msg';
 if(!title||!desc){m.className='sv1-emp-msg err';m.textContent=TX.eFields;return}
 var b=$('jSave'),was=b.textContent;b.disabled=true;b.textContent=TX.saving;m.textContent='';
 var body={action:editId?'update-posting':'create-posting',title:title,description:desc,
  city:$('jCity').value.trim(),field:$('jField').value};
 if(editId)body.id=editId;
 post('/api/candidates',body).then(function(d){
  b.disabled=false;b.textContent=was;
  if(!d||!d.ok){m.className='sv1-emp-msg err';m.textContent=TX.eSave;return}
  loaded.jobs=false;resetJobForm();location.hash='#/jobs';
  window.setTimeout(function(){$('jobsStatus').textContent=TX.published},60)
 }).catch(function(){b.disabled=false;b.textContent=was;
  m.className='sv1-emp-msg err';m.textContent=TX.eSave})};

// ── من تقدّم ──────────────────────────────────────────────────────────────
var groups=[],pick='';
var STAGES=[['new',TX.sNew],['review',TX.sReview],['shortlist',TX.sShort],['interview',TX.sInt],
 ['offer',TX.sOffer],['hired',TX.sHired],['rejected',TX.sRej],['future',TX.sFuture]];
function stageName(k){for(var i=0;i<STAGES.length;i++)if(STAGES[i][0]===k)return STAGES[i][1];return TX.sNew}

function loadApps(){
 loaded.apps=true;$('appsStatus').textContent=TX.loading;
 $('appsJobs').innerHTML='';$('appsList').innerHTML='';
 return get('applicants=1').then(function(d){
  if(!d||!d.ok){loaded.apps=false;$('appsStatus').textContent=TX.eNet;return}
  groups=d.jobs||[];
  $('appsStatus').textContent=d.truncated?TX.appsCut:'';
  drawApps()
 }).catch(function(){loaded.apps=false;$('appsStatus').textContent=TX.eNet})}

function allApplicants(){var out=[];groups.forEach(function(g){
 g.applicants.forEach(function(a){a._job=g.jobTitle;out.push(a)})});return out}

function drawApps(){
 var total=allApplicants().length;
 if(!total){$('appsStatus').textContent=TX.appsNone;$('appsJobs').innerHTML='';$('appsList').innerHTML='';return}
 $('appsJobs').innerHTML=['<button type="button" data-pick="" class="'+(pick?'':'on')+'">'+
  esc(TX.appsAll)+' ('+total+')</button>'].concat(groups.map(function(g){
  return '<button type="button" data-pick="'+esc(g.jobId)+'" class="'+(pick===g.jobId?'on':'')+'">'+
   esc(g.jobTitle)+' ('+g.applicants.length+')</button>'})).join('');
 Array.prototype.forEach.call($('appsJobs').querySelectorAll('[data-pick]'),function(b){
  b.onclick=function(){pick=b.getAttribute('data-pick');drawApps()}});
 var rows=pick?(groups.filter(function(g){return g.jobId===pick})[0]||{applicants:[]}).applicants
  :allApplicants();
 $('appsList').innerHTML=rows.map(function(a){
  var meta=[a.role,a.city,a.experience?a.experience+' '+TX.fYears:''].filter(Boolean).join(' · ');
  return '<div class="sv1-emp-card"><div class="g"><h4>'+esc(a.name||'—')+'</h4>'+
   (meta?'<p>'+esc(meta)+'</p>':'')+'</div>'+
   '<span class="sv1-pill">'+esc(stageName(a.stage))+'</span>'+
   '<div class="acts"><a class="sv1-btn sm" href="#/c/'+encodeURIComponent(a.id)+'">'+
   esc(TX.open)+'</a></div></div>'}).join('')}

// ── ملف المرشّح ───────────────────────────────────────────────────────────
function findCand(id){var all=allApplicants();
 for(var i=0;i<all.length;i++)if(all[i].id===id)return all[i];return null}

function openCand(id){
 id=decodeURIComponent(id||'');
 if(!loaded.apps){loadApps().then(function(){openCand(encodeURIComponent(id))});return}
 var c=findCand(id);
 if(!c){location.hash='#/apps';return}
 show($('scJobs'),false);show($('scNew'),false);show($('scApps'),false);show($('scCand'),true);
 ['tabJobs','tabNew','tabApps'].forEach(function(x){$(x).classList.remove('on')});
 var kv=[[TX.fRole,c.role],[TX.fCityL,c.city],
  [TX.fExp,c.experience?c.experience+' '+TX.fYears:''],[TX.fSkills,c.skills],
  [TX.fPhone,c.phone],[TX.fEmail,c.email]]
  .filter(function(p){return p[1]}).map(function(p){
   return '<dt>'+esc(p[0])+'</dt><dd>'+esc(p[1])+'</dd>'}).join('');
 var opts=STAGES.map(function(s){
  return '<option value="'+s[0]+'"'+(s[0]===c.stage?' selected':'')+'>'+esc(s[1])+'</option>'}).join('');
 $('candBody').innerHTML=
  '<h3 class="sv1-emp-h">'+esc(c.name||'—')+'</h3>'+
  '<p class="sv1-emp-sub">'+esc(c._job||'')+'</p>'+
  '<dl class="sv1-emp-kv">'+kv+'</dl>'+
  (c.cv?'<p style="margin:0 0 18px"><a class="sv1-btn sm" href="'+esc(c.cv)+
   '" target="_blank" rel="noopener">'+esc(TX.fCv)+' — '+esc(TX.cvOpen)+'</a></p>':'')+
  '<div class="sv1-emp-f" style="max-width:520px">'+
   '<label for="cStage">'+esc(TX.stage)+'</label>'+
   '<select id="cStage">'+opts+'</select>'+
   '<p class="sv1-emp-msg" id="cStageMsg"></p>'+
   '<div style="margin-top:26px;padding-top:20px;border-top:1px solid var(--l)">'+
    '<h4 style="margin:0 0 5px;font-size:16px;font-weight:600">'+esc(TX.reqH)+'</h4>'+
    '<p class="sv1-emp-sub">'+esc(TX.reqP)+'</p>'+
    '<label for="cPref">'+esc(TX.reqPref)+'</label>'+
    '<input id="cPref" maxlength="300">'+
    '<label for="cMode">'+esc(TX.reqMode)+'</label>'+
    '<select id="cMode"><option value="حضوري">'+esc(TX.mIn)+'</option>'+
     '<option value="أونلاين">'+esc(TX.mOn)+'</option>'+
     '<option value="هاتف">'+esc(TX.mPh)+'</option></select>'+
    '<div class="acts"><button type="button" class="sv1-btn primary" id="cReq">'+esc(TX.reqGo)+'</button>'+
    '<span class="sv1-emp-msg" id="cReqMsg"></span></div>'+
   '</div></div>';
 window.scrollTo(0,0);

 $('cStage').onchange=function(){
  var sel=$('cStage'),m=$('cStageMsg'),v=sel.value;sel.disabled=true;
  m.className='sv1-emp-msg';m.textContent=TX.saving;
  post('/api/candidates',{action:'update-stage',id:c.id,stage:v}).then(function(d){
   sel.disabled=false;
   if(d&&d.ok){c.stage=v;m.className='sv1-emp-msg ok';m.textContent=TX.acctOk}
   else{sel.value=c.stage;m.className='sv1-emp-msg err';m.textContent=TX.eSave}
  }).catch(function(){sel.disabled=false;sel.value=c.stage;
   m.className='sv1-emp-msg err';m.textContent=TX.eSave})};

 $('cReq').onclick=function(){
  var b=$('cReq'),m=$('cReqMsg');b.disabled=true;b.textContent=TX.reqWork;
  m.className='sv1-emp-msg';m.textContent='';
  post('/api/candidates',{action:'request-interview',id:c.id,
   employer:CO||'صاحب عمل',preferred:$('cPref').value.trim(),mode:$('cMode').value})
  .then(function(d){b.textContent=TX.reqGo;
   if(d&&d.ok){m.className='sv1-emp-msg ok';m.textContent=TX.reqOk}
   else{b.disabled=false;m.className='sv1-emp-msg err';m.textContent=TX.eSave}
  }).catch(function(){b.disabled=false;b.textContent=TX.reqGo;
   m.className='sv1-emp-msg err';m.textContent=TX.eSave})}}

$('candBack').onclick=function(){location.hash='#/apps'};

// ── قائمة الحساب ──────────────────────────────────────────────────────────
// لا تُجلب بيانات الحساب إلا عند أول فتحٍ للقائمة — شاشةٌ مغلقة لا تُكلّف نداءً.
var acctLoaded=false;
$('acctBox').addEventListener('toggle',function(){
 if(!$('acctBox').open||acctLoaded)return;
 acctLoaded=true;
 $('acctCo').textContent=CO||'—';
 if(AUTH&&AUTH.mode==='code'){
  // الدخول بكلمة المرور لا يفتح جلسة، و/api/employer يصادق بالجلسة وحدها —
  // فالحقل يُعرض للقراءة مع السطر الذي يقول كيف يُغيَّر، لا زرٌّ لا يعمل.
  $('acctEmail').textContent=AUTH.email||'';
  show($('acctPhoneWrap'),false);
  $('acctMsg').className='sv1-emp-msg';$('acctMsg').textContent=TX.acctPhNo;
  return}
 fetch('/api/employer',{method:'POST',credentials:'same-origin',
  headers:{'content-type':'application/json'},body:JSON.stringify({action:'account'})})
 .then(j).then(function(d){
  if(!d||!d.ok){show($('acctPhoneWrap'),false);return}
  $('acctCo').textContent=d.company||CO||'—';
  $('acctEmail').textContent=d.email||'';
  $('acctPhone').value=d.phone||''
 }).catch(function(){show($('acctPhoneWrap'),false)})});

$('acctPhoneBtn').onclick=function(){
 var b=$('acctPhoneBtn'),m=$('acctMsg');b.disabled=true;m.className='sv1-emp-msg';m.textContent=TX.saving;
 fetch('/api/employer',{method:'POST',credentials:'same-origin',
  headers:{'content-type':'application/json'},
  body:JSON.stringify({action:'update-phone',phone:$('acctPhone').value.trim()})})
 .then(j).then(function(d){b.disabled=false;
  if(d&&d.ok){m.className='sv1-emp-msg ok';m.textContent=TX.acctOk}
  else{m.className='sv1-emp-msg err';m.textContent=TX.eSave}
 }).catch(function(){b.disabled=false;m.className='sv1-emp-msg err';m.textContent=TX.eNet})};

$('acctOut').onclick=function(){
 var done=function(){location.href=HOME};
 if(AUTH&&AUTH.mode==='code'){AUTH=null;done();return}
 fetch('/api/otp',{method:'POST',credentials:'same-origin',
  headers:{'content-type':'application/json'},body:JSON.stringify({action:'logout'})})
 .then(done).catch(done)};

// ── الإقلاع: نداءٌ واحد يسأل «هل لي جلسة تفتح بوابة؟» ─────────────────────
// ولا شيء غيره: ولا بيانات مرشحين، ولا إعلانات، ولا ملف وهمي. بقية الشاشات
// تُجلب عند فتحها أول مرة فقط.
pane('fOtpStart');
get('validate=1').then(function(d){
 if(d&&d.unlocked){AUTH={mode:'session'};
  CO=d.company||'';PLAN=d.plan||'';
  $('empCo').textContent=CO||'Business Partner';
  $('empPlan').textContent=PLAN?TX.plan+': '+PLAN:'';
  show($('empLogin'),false);show($('empApp'),true);route()}
}).catch(function(){});
})();</script>`;

  return SV1.shell({
    title: `${t("title")} — Business Partner`,
    desc: t("desc"),
    path: "/employer",
    body: CSS + body,
    script,
    noindex: true,
  });
}
