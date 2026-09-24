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
//
// «من تقدّم» لوحة مسار لا جدول (2026-09-24): عمودٌ لكل مرحلة من المراحل
// الثمانية، وبطاقةٌ لكل مرشّح تُنقل بينها. الجدول كان يعرض المرحلة نصّاً ولا
// يغيّرها إلا بعد فتح ملف المرشّح، فكان فرز عشرين متقدّماً عشرين فتحاً
// ورجوعاً. ثلاث قواعد تحكم اللوحة، وكلّها مكتوبة عند موضعها في الكود:
//   • «انقل إلى…» قائمةٌ أصلية على كل بطاقة، والسحب إضافةٌ فوقها لا بديل.
//   • النقل متفائل، والفشل يُرجع البطاقة ويقول ذلك — لا صمت.
//   • لا إعادة جلبٍ بعد النقلة: الحالة تُعدَّل في النموذج المحلي.
// ولم تُبنَ ملاحظات فريق ولا تقييم: لا نقطة حفظ لهما في api/candidates.js،
// والقديمة كانت تكتبهما في localStorage — فلا يراهما الفريق وتضيع بتغيير
// الجهاز. ميزةٌ بهذا الشكل عطلٌ يُنقل، لا ميزةٌ تُنقل.

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
  // أثبتّ بريدك ولم يفتح شيء: ثلاث حالات مختلفة كانت تُقال بجملة واحدة
  // تتّهم اشتراكك. الآن لكلٍّ جملتها، ولكلٍّ خطوةٌ تالية مكتوبة.
  pendSub: { ar: "بريدك مسجّل، واشتراكك لم يُفعّل بعد — حالته الآن: «{s}». التفعيل يدوي بعد تأكيد الدفع: راسلنا على business@businesspartner.sa ومعك اسم شركتك وسنفعّله.",
             en: "Your email is registered but the subscription is not active yet — its status now: \u201c{s}\u201d. Activation is manual after payment: write to business@businesspartner.sa with your company name and we\u2019ll enable it.",
             fr: "Votre e-mail est enregistré mais l\u2019abonnement n\u2019est pas encore actif — statut actuel : \u00ab {s} \u00bb. L\u2019activation est manuelle après paiement : écrivez à business@businesspartner.sa.",
             zh: "您的邮箱已登记，但订阅尚未激活——当前状态：“{s}”。付款后需人工激活：请发邮件至 business@businesspartner.sa 并注明公司名称。" },
  empErr:  { ar: "تعذّر التحقق من اشتراكك الآن — العطل عندنا لا عند حسابك. أعد المحاولة بعد دقيقة، وإن تكرّر راسلنا على business@businesspartner.sa.",
             en: "We couldn\u2019t check your subscription right now — the fault is ours, not your account\u2019s. Try again in a minute; if it persists write to business@businesspartner.sa.",
             fr: "Impossible de vérifier votre abonnement pour l\u2019instant — le problème vient de chez nous. Réessayez dans une minute ou écrivez à business@businesspartner.sa.",
             zh: "暂时无法核验您的订阅——问题出在我们这边，与您的账户无关。请一分钟后重试，若仍然如此请联系 business@businesspartner.sa。" },
  noCodeE: { ar: "اشتراكك مفعّل لكن صفّه بلا رمز وصول، ولا تُفتح اللوحة بدونه. راسلنا على business@businesspartner.sa وسنصلحه اليوم.",
             en: "Your subscription is active but its row carries no access code, and the dashboard cannot open without one. Write to business@businesspartner.sa and we\u2019ll fix it today.",
             fr: "Votre abonnement est actif mais sans code d\u2019accès ; le tableau de bord ne peut pas s\u2019ouvrir. Écrivez à business@businesspartner.sa.",
             zh: "您的订阅已激活，但记录中没有访问码，面板无法打开。请联系 business@businesspartner.sa，我们今天就修复。" },
  // دخلتَ بحساب بيزنس بارتنر لا باشتراك صاحب عمل مفعّل: البوابة تُفتح،
  // لكن إعلاناتك المنشورة تحت رمز الاشتراك لا تظهر فيها. لوحةٌ فارغة بلا
  // سبب هي أسوأ ما يُعرض، فيُقال السبب فوقها.
  portalW: { ar: "أنت داخل بحساب Business Partner، لا باشتراك صاحب عمل مفعّل (حالة اشتراكك: «{s}»). ما تنشره هنا الآن لن يظهر مع إعلانات اشتراكك حتى يُفعّل.",
             en: "You are signed in with a Business Partner account, not an active employer subscription (its status: \u201c{s}\u201d). What you post here now will not appear alongside your subscription\u2019s vacancies until it is activated.",
             fr: "Vous êtes connecté avec un compte Business Partner, sans abonnement employeur actif (statut : \u00ab {s} \u00bb). Ce que vous publiez ici n\u2019apparaîtra pas avec les postes de votre abonnement.",
             zh: "您使用的是 Business Partner 账户，而非已激活的雇主订阅（状态：“{s}”）。在订阅激活前，此处发布的内容不会与订阅下的职位一并显示。" },

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
  // بنود الشريط الجانبي — أربعة، بالتسمية القصيرة التي تُقرأ في عمود ضيّق.
  sideHome:{ ar: "الرئيسية", en: "Overview", fr: "Accueil", zh: "总览" },
  sideJobs:{ ar: "الوظائف", en: "Vacancies", fr: "Postes", zh: "职位" },
  sideApps:{ ar: "المتقدمون", en: "Applicants", fr: "Candidatures", zh: "申请人" },
  sideSet: { ar: "الإعدادات", en: "Settings", fr: "Paramètres", zh: "设置" },
  sideFold:{ ar: "اطوِ الشريط", en: "Collapse the sidebar", fr: "Réduire le menu", zh: "折叠侧栏" },
  sideMenu:{ ar: "القائمة", en: "Menu", fr: "Menu", zh: "菜单" },
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

  // ------------------------------------------------------------ الرئيسية --
  // ⚠️ لا رقم في هذه الشاشة إلا محسوباً من الصفوف العائدة من الخادم. البوابة
  // القديمة تكتب «+18%» و«+4» نصّاً ثابتاً في hr-app.js لا يُحسب من شيء، وصاحب
  // عملٍ يبني على ذلك قراراً. فما لا نستطيع حسابه لا يُعرض هنا أصلاً — ولا
  // نسبة نموٍّ واحدة في الملف كلّه.
  homeH:   { ar: "الرئيسية", en: "Overview", fr: "Vue d'ensemble", zh: "总览" },
  homeSub: { ar: "كل رقم هنا محسوبٌ من إعلاناتك ومتقدّميك الآن — لا تقديرات.",
             en: "Every figure here is counted from your vacancies and applicants right now — no estimates.",
             fr: "Chaque chiffre ici est calculé à partir de vos postes et candidatures — aucune estimation.",
             zh: "此处每个数字均由您当前的职位与申请人实时统计得出——没有估算。" },
  kActive: { ar: "وظائف نشطة", en: "Active vacancies", fr: "Postes actifs", zh: "在招职位" },
  kAll:    { ar: "إجمالي المتقدمين", en: "Total applicants", fr: "Total des candidatures", zh: "申请人总数" },
  kAllN:   { ar: "على الإعلانات الظاهرة في لوحتك", en: "across the vacancies shown in your board", fr: "sur les postes affichés dans votre tableau", zh: "涵盖您看板中显示的职位" },
  kNew:    { ar: "جدد خلال ٧ أيام", en: "New in the last 7 days", fr: "Nouveaux (7 derniers jours)", zh: "近 7 天新增" },
  kNewN:   { ar: "بتاريخ تسجيل المتقدّم", en: "by the applicant's registration date", fr: "selon la date d'inscription", zh: "按申请人登记日期" },
  kJobsN:  { ar: "من أصل {n}", en: "of {n} in total", fr: "sur {n} au total", zh: "共 {n} 个" },
  pipeH:   { ar: "المسار", en: "Pipeline", fr: "Pipeline", zh: "招聘流程" },
  pipeSub: { ar: "عدد من في كل مرحلة — اضغط المرحلة لفتح لوحة المسار.",
             en: "How many sit at each stage — tap a stage to open the board.",
             fr: "Nombre de candidats par étape — cliquez pour ouvrir le tableau.",
             zh: "各阶段人数——点击阶段可打开看板。" },
  emptyH:  { ar: "لوحتك جاهزة، وينقصها إعلان",
             en: "Your dashboard is ready — it just needs a vacancy",
             fr: "Votre tableau de bord est prêt — il ne manque qu'un poste",
             zh: "您的面板已就绪——只差一个职位" },
  emptyP:  { ar: "انشر أول إعلان وستمتلئ هذه الأرقام وحدها: كل من يتقدّم يصلك هنا، وتنقله بين المراحل من لوحة المسار.",
             en: "Post your first vacancy and these figures fill themselves: every applicant lands here, and you move them between stages on the board.",
             fr: "Publiez votre premier poste et ces chiffres se rempliront d'eux-mêmes : chaque candidature arrive ici.",
             zh: "发布第一个职位后，这些数字会自动填充：每位申请人都会出现在此，并可在看板中流转。" },
  emptyGo: { ar: "انشر أول إعلان", en: "Post your first vacancy", fr: "Publier le premier poste", zh: "发布第一个职位" },
  numWait: { ar: "جارٍ العدّ…", en: "Counting…", fr: "Comptage…", zh: "统计中…" },
  numFail: { ar: "تعذّر عدّ المتقدّمين الآن.", en: "Couldn't count the applicants right now.", fr: "Impossible de compter les candidatures.", zh: "暂时无法统计申请人。" },

  // --------------------------------------------------------------- البحث --
  // بحثٌ في المتصفّح على ما هو محمّل أصلاً — ولا نداء واحد لكل حرف. لهذا
  // يُقال صراحةً إنه لا يبحث إلا فيما فُتح: وعدٌ أصغر يُوفى خيرٌ من وعدٍ يكذب.
  searchPh:{ ar: "ابحث في وظائفك ومتقدّميك", en: "Search your vacancies and applicants", fr: "Rechercher dans vos postes et candidats", zh: "搜索您的职位与申请人" },
  searchNo:{ ar: "لا نتيجة في المحمَّل", en: "Nothing in what's loaded", fr: "Aucun résultat dans les données chargées", zh: "已加载的数据中无结果" },
  searchJ: { ar: "وظائف", en: "Vacancies", fr: "Postes", zh: "职位" },
  searchC: { ar: "مرشّحون", en: "Candidates", fr: "Candidats", zh: "候选人" },
  searchMr:{ ar: "و{n} غيرها", en: "and {n} more", fr: "et {n} de plus", zh: "另有 {n} 条" },

  // -------------------------------------------------------- جدول الوظائف --
  thTitle: { ar: "العنوان", en: "Title", fr: "Intitulé", zh: "职位名称" },
  thCity:  { ar: "المدينة", en: "City", fr: "Ville", zh: "城市" },
  thField: { ar: "المجال", en: "Field", fr: "Domaine", zh: "领域" },
  thType:  { ar: "الدوام", en: "Type", fr: "Type", zh: "类型" },
  thApps:  { ar: "المتقدمون", en: "Applicants", fr: "Candidatures", zh: "申请人" },
  thStat:  { ar: "الحالة", en: "Status", fr: "Statut", zh: "状态" },
  thDate:  { ar: "تاريخ النشر", en: "Posted", fr: "Publié le", zh: "发布日期" },
  thActs:  { ar: "إجراءات", en: "Actions", fr: "Actions", zh: "操作" },

  // ------------------------------------------------------------ الإعدادات --
  setH:    { ar: "الإعدادات", en: "Settings", fr: "Paramètres", zh: "设置" },
  setSub:  { ar: "حساب شركتك في البوابة.", en: "Your company's account in the portal.", fr: "Le compte de votre entreprise.", zh: "您公司在门户中的账户。" },
  setCo:   { ar: "الشركة", en: "Company", fr: "Entreprise", zh: "公司" },
  langL:   { ar: "اللغة", en: "Language", fr: "Langue", zh: "语言" },

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
  fType:   { ar: "نوع الدوام", en: "Employment type", fr: "Type de contrat", zh: "工作类型" },
  fMode:   { ar: "نمط العمل", en: "Workplace", fr: "Mode de travail", zh: "工作方式" },
  fAny:    { ar: "— غير محدّد —", en: "— not specified —", fr: "— non précisé —", zh: "— 未指定 —" },
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

  // ------------------------------------------------- لوحة المسار (أعمدة) --
  // المراحل الثمانية أعمدةٌ، والبطاقة تُنقل بينها. «انقل إلى…» قائمةٌ أصلية
  // (‏select) لا قائمة مصنوعة: تعمل باللمس وبلوحة المفاتيح وقارئ الشاشة بلا
  // سطر واحد من كود الإتاحة. السحب إضافةٌ فوقها لا بديلٌ عنها — فسحب HTML5
  // لا يعمل على الجوال أصلاً، ومن يستعمله وحده يُقصي نصف المستخدمين.
  moveTo:  { ar: "انقل إلى…", en: "Move to…", fr: "Déplacer vers…", zh: "移动至…" },
  moving:  { ar: "جارٍ النقل…", en: "Moving…", fr: "Déplacement…", zh: "移动中…" },
  moveOk:  { ar: "نُقل إلى", en: "Moved to", fr: "Déplacé vers", zh: "已移至" },
  moveFail:{ ar: "تعذّر النقل — أعدنا البطاقة إلى عمودها. حاول مرة أخرى.",
             en: "The move failed — we put the card back in its column. Try again.",
             fr: "Échec du déplacement — la carte est revenue dans sa colonne. Réessayez.",
             zh: "移动失败——卡片已退回原栏。请重试。" },
  boardHint:{ ar: "اسحب البطاقة إلى عمود آخر، أو استعمل «انقل إلى…» داخلها.",
             en: "Drag a card to another column, or use “Move to…” inside it.",
             fr: "Faites glisser une carte vers une autre colonne, ou utilisez « Déplacer vers… ».",
             zh: "将卡片拖到其他栏，或使用卡片内的“移动至…”。" },
  colEmpty:{ ar: "لا أحد في هذه المرحلة", en: "Nobody at this stage", fr: "Personne à cette étape", zh: "此阶段暂无人" },
  more:    { ar: "أظهر المزيد", en: "Show more", fr: "Afficher plus", zh: "显示更多" },
  matchS:  { ar: "مطابقة", en: "Match", fr: "Correspondance", zh: "匹配度" },

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

// نوع الدوام ونمط العمل — نفس القائمتين الثابتتين في api/candidates.js
// (JOB_TYPES و JOB_MODES). القيمة المرسلة عربية دائماً لأن نوشن يخزّنها كذلك،
// والمعروض بلغة الصفحة. كلتا القائمتين اختيارية بخيار فارغ أوّل: صاحب عملٍ
// لا ينطبق عليه أيٌّ منهما يترك الوظيفة بلا نوع، ولا يُخترع له واحد.
const JOB_TYPES = [
  { v: "دوام كامل",    en: "Full-time",   fr: "Temps plein",      zh: "全职" },
  { v: "دوام جزئي",    en: "Part-time",   fr: "Temps partiel",    zh: "兼职" },
  { v: "عقد مؤقت",     en: "Temporary contract", fr: "Contrat temporaire", zh: "临时合同" },
  { v: "تدريب تعاوني", en: "Co-op training", fr: "Stage coopératif", zh: "实习培训" },
  { v: "عمل موسمي",    en: "Seasonal",    fr: "Saisonnier",       zh: "季节性工作" },
];
const JOB_MODES = [
  { v: "في الموقع", en: "On-site", fr: "Sur site", zh: "现场办公" },
  { v: "عن بُعد",   en: "Remote",  fr: "À distance", zh: "远程办公" },
  { v: "هجين",      en: "Hybrid",  fr: "Hybride",  zh: "混合办公" },
];

export function buildSimpleEmployer(SV1, ctx) {
  const { lang: langFn, esc } = ctx;
  const lang = langFn();
  const t = (k) => { const e = T[k]; return e && e[lang] != null ? e[lang] : (e ? e.en : k); };
  const pre = lang === "en" ? "" : "/" + lang;
  const u = (p) => pre + p;

  const fieldOpts = [`<option value="">${esc(t("fFieldN"))}</option>`]
    .concat(FIELDS.map((f) => `<option value="${esc(f)}">${esc(f)}</option>`)).join("");
  const pickOpts = (list) => [`<option value="">${esc(t("fAny"))}</option>`]
    .concat(list.map((o) => `<option value="${esc(o.v)}">${esc(lang === "ar" ? o.v : (o[lang] || o.en))}</option>`)).join("");
  const typeOpts = pickOpts(JOB_TYPES);
  const modeOpts = pickOpts(JOB_MODES);

  // مبدّل اللغة داخل شريط البوابة نفسه: قشرة الموقع لا تصدّر langSwitch، والمسار
  // ثابتٌ ومعروف — ‎/employer في الإنجليزية و‎/<lang>/employer فيما عداها، وهي
  // القاعدة نفسها التي يبنيها u() أعلاه.
  const LANGS = [["ar", "العربية"], ["en", "English"], ["fr", "Français"], ["zh", "中文"]];
  const langItems = LANGS.map(([l, n]) =>
    `<a href="${esc((l === "en" ? "" : "/" + l) + "/employer")}" hreflang="${l}"${l === lang ? ' class="on"' : ""}>${esc(n)}</a>`).join("");

  // أيقونات الشريط الجانبي: SVG مرسومة بـcurrentColor فترث لون البند وحالته
  // ‎.on بلا ملف ولا خط أيقونات يُحمَّل.
  const sv = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICON = {
    home: sv('<path d="M3.2 10.4 12 3.4l8.8 7"/><path d="M5.2 9.2V20.6h13.6V9.2"/><path d="M9.6 20.6v-5.8h4.8v5.8"/>'),
    jobs: sv('<rect x="2.8" y="7.2" width="18.4" height="13" rx="2.2"/><path d="M8.6 7.2V5.4a1.8 1.8 0 0 1 1.8-1.8h3.2a1.8 1.8 0 0 1 1.8 1.8v1.8"/><path d="M2.8 12.4h18.4"/>'),
    apps: sv('<circle cx="9" cy="8.2" r="3.2"/><path d="M3.4 20c0-3.1 2.5-5.4 5.6-5.4s5.6 2.3 5.6 5.4"/><path d="M16.4 5.4a3.2 3.2 0 0 1 0 6"/><path d="M17.8 14.9c1.8.7 3 2.4 3 4.4"/>'),
    set:  sv('<path d="M4 7.5h10"/><path d="M18 7.5h2"/><path d="M4 16.5h6"/><path d="M14 16.5h6"/><circle cx="16" cy="7.5" r="2.2"/><circle cx="12" cy="16.5" r="2.2"/>'),
  };

  const CSS = `<style id="sv1-emp-css">
.sv1-emp{max-width:1280px;margin:0 auto;padding:0 20px}

/* ── الإطار: شريط علويّ + شريط جانبي ──────────────────────────────────────
   كل ما في هذا القسم بخصائص منطقية (inline-start/‏inline-end/‏padding-inline)
   ولا خاصية left/right فيه — تماماً كلوحة المسار أدناه. فالشريط الجانبي يقف
   حيث تبدأ القراءة في العربية والإنجليزية معاً، والدرج ينزلق من الجهة نفسها،
   بلا فرعٍ في الكود ولا ورقةٍ ثانية للـLTR. */
.sv1-emp-top{display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--l);
 padding:11px 0;margin-bottom:18px}
.sv1-emp-burger{display:none;flex:none;border:1px solid var(--l);background:#fff;border-radius:9px;
 width:36px;height:36px;font-size:15px;line-height:1;color:var(--ink);cursor:pointer;padding:0}
.sv1-emp-who{display:flex;flex-direction:column;min-width:0;flex:none;max-width:38%}
.sv1-emp-who b{font-size:15px;font-weight:600;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sv1-emp-who span{font-size:11px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* البحث: في المتصفّح على ما هو محمّل، فلا مؤشّر انتظار ولا نداء لكل حرف. */
.sv1-emp-q{position:relative;flex:1;min-width:0;max-width:430px;margin-inline-start:auto}
.sv1-emp-q input{width:100%;border:1px solid var(--l);border-radius:10px;padding:9px 13px;font:inherit;
 font-size:13px;outline:none;background:var(--soft);color:var(--ink)}
.sv1-emp-q input:focus{border-color:var(--ac);background:#fff}
.sv1-emp-res{position:absolute;inset-inline-start:0;inset-inline-end:0;top:calc(100% + 6px);background:#fff;
 border:1px solid var(--l);border-radius:12px;box-shadow:var(--sh2);z-index:14;padding:6px;
 max-height:min(60vh,380px);overflow-y:auto}
.sv1-emp-res h6{margin:8px 8px 3px;font-size:10.5px;font-weight:600;color:var(--faint);letter-spacing:.04em}
.sv1-emp-res a{display:block;padding:8px 10px;border-radius:9px;text-decoration:none;color:var(--ink)}
.sv1-emp-res a:hover,.sv1-emp-res a:focus-visible{background:var(--acSoft);outline:none}
.sv1-emp-res a b{display:block;font-size:13px;font-weight:600;line-height:1.5;
 overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sv1-emp-res a small{display:block;font-size:11px;color:var(--mut);line-height:1.6;
 overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sv1-emp-res p{margin:0;padding:12px 10px;font-size:12px;color:var(--faint);text-align:center}
.sv1-emp-more{margin:2px 8px 6px;font-size:11px;color:var(--faint)}

.sv1-emp-shell{display:grid;grid-template-columns:214px minmax(0,1fr);gap:26px;align-items:start}
.sv1-emp-shell.mini{grid-template-columns:60px minmax(0,1fr)}
.sv1-emp-side{position:sticky;top:14px;background:#fff;border:1px solid var(--l);border-radius:14px;
 padding:9px;box-shadow:var(--sh);display:flex;flex-direction:column;gap:3px}
.sv1-emp-side .grp{display:flex;flex-direction:column;gap:3px}
.sv1-emp-side hr{border:0;border-top:1px solid var(--l);margin:7px 2px}
.sv1-emp-side button{display:flex;align-items:center;gap:10px;width:100%;border:0;
 border-inline-start:3px solid transparent;background:none;border-radius:9px;padding:9px 10px;font:inherit;
 font-size:13.5px;color:var(--mut);cursor:pointer;text-align:start}
.sv1-emp-side button:hover{background:var(--soft);color:var(--ink)}
.sv1-emp-side button.on{background:var(--acSoft);border-inline-start-color:var(--ac);color:var(--ac);font-weight:600}
.sv1-emp-side button svg{flex:none;width:17px;height:17px}
.sv1-emp-side button span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sv1-emp-side .cta{background:var(--ac);color:#fff;font-weight:600;justify-content:center;
 border-inline-start-color:transparent}
.sv1-emp-side .cta:hover{background:var(--ac2);color:#fff}
.sv1-emp-side .fold{font-size:11.5px;color:var(--faint);justify-content:center;padding:7px 10px}
.sv1-emp-shell.mini .sv1-emp-side button{justify-content:center;padding-inline:6px}
.sv1-emp-shell.mini .sv1-emp-side button span{display:none}
.sv1-emp-back{display:none}
@media(max-width:900px){
 /* الجوال: الشريط يصير درجاً ينزلق من جهة بداية القراءة ولا يبتلع الشاشة —
    عرضٌ ثابت وخلفيةٌ تُغلقه باللمس. والانزلاق بـinset-inline-start لا
    بـtranslateX: الأخيرة تحتاج إشارةً معكوسة في RTL، وهذا فرعٌ لا داعي له. */
 .sv1-emp-shell,.sv1-emp-shell.mini{grid-template-columns:minmax(0,1fr)}
 .sv1-emp-burger{display:block}
 .sv1-emp-side{position:fixed;inset-block:0;inset-inline-start:-272px;width:248px;z-index:41;
  border-radius:0;border-block:0;border-inline-start:0;overflow-y:auto;padding:14px 10px;
  transition:inset-inline-start .22s ease}
 .sv1-emp-shell.open .sv1-emp-side{inset-inline-start:0}
 .sv1-emp-shell.mini .sv1-emp-side button{justify-content:flex-start;padding-inline:10px}
 .sv1-emp-shell.mini .sv1-emp-side button span{display:block}
 .sv1-emp-side .fold{display:none}
 .sv1-emp-shell.open .sv1-emp-back{display:block;position:fixed;inset:0;z-index:40;
  background:rgba(11,27,90,.34)}
 .sv1-emp-q{max-width:none}
 .sv1-emp-who{display:none}
}
@media (prefers-reduced-motion:reduce){.sv1-emp-side{transition:none}}
.sv1-acct,.sv1-emp-lang{position:relative;flex:none}
.sv1-acct summary,.sv1-emp-lang summary{list-style:none;cursor:pointer;border:1px solid var(--l);background:#fff;
 border-radius:9px;padding:8px 12px;font-size:12.5px;font-weight:500;color:var(--ink);
 display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.sv1-acct summary::-webkit-details-marker,.sv1-emp-lang summary::-webkit-details-marker{display:none}
.sv1-acct .menu,.sv1-emp-lang .menu{position:absolute;inset-inline-end:0;top:calc(100% + 6px);background:#fff;
 border:1px solid var(--l);border-radius:12px;box-shadow:var(--sh2);width:290px;padding:14px;z-index:15}
.sv1-emp-lang .menu{width:180px;padding:7px}
.sv1-emp-lang .menu a{display:block;padding:8px 11px;border-radius:8px;font-size:13px;color:var(--ink);
 text-decoration:none}
.sv1-emp-lang .menu a:hover{background:var(--soft)}
.sv1-emp-lang .menu a.on{background:var(--acSoft);color:var(--ac);font-weight:600}
.sv1-acct .menu h5{margin:0 0 3px;font-size:13px;color:var(--ink);font-weight:600}
.sv1-acct .menu .ro{font-size:12px;color:var(--mut);margin:0 0 12px;word-break:break-all}
.sv1-acct .menu label{display:block;font-size:11.5px;color:var(--mut);margin:10px 0 4px}
.sv1-emp-h{font-size:22px;font-weight:300;margin:0 0 4px;color:var(--ink)}
.sv1-emp-h2{font-size:15px;font-weight:600;color:var(--ink);margin:26px 0 3px}
.sv1-emp-sub{font-size:12.5px;color:var(--mut);margin:0 0 18px}
.sv1-emp-f input,.sv1-emp-f select,.sv1-emp-f textarea,.sv1-acct input{
 width:100%;border:1px solid var(--l);border-radius:10px;padding:10px 12px;font:inherit;font-size:13.5px;
 outline:none;background:#fff;color:var(--ink)}
.sv1-emp-f textarea{min-height:200px;resize:vertical;line-height:1.85}
.sv1-emp-f input:focus,.sv1-emp-f select:focus,.sv1-emp-f textarea:focus{border-color:var(--ac)}
.sv1-emp-f label{display:block;font-size:12px;color:var(--mut);margin:14px 0 5px;font-weight:500}
.sv1-emp-f .row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.sv1-emp-f .acts{display:flex;gap:8px;margin-top:18px;flex-wrap:wrap;align-items:center}
/* ── بطاقات الإحصاء ───────────────────────────────────────────────────────
   تُرسم كاملةً على الصفر: حساب المالك نفسه بلا إعلانات، والأربعون وظيفة
   لأصحاب عملٍ آخرين. لوحةٌ تُخفي بطاقاتها عند الصفر تبدو معطوبة، والبطاقة
   الفارغة المرسومة تبدو مقصودة — وتحتها دعوةٌ إلى أول إعلان. */
.sv1-kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:12px;margin:0 0 6px}
.sv1-kpi>div{background:#fff;border:1px solid var(--l);border-radius:14px;padding:15px 17px;box-shadow:var(--sh)}
.sv1-kpi b{display:block;font-family:var(--fm);font-size:27px;font-weight:400;color:var(--ink);line-height:1.3}
.sv1-kpi em{display:block;font-family:var(--fm);font-size:16px;font-style:normal;color:var(--faint);line-height:2.2}
.sv1-kpi i{display:block;font-style:normal;font-size:12.5px;color:var(--s);font-weight:600;margin-top:3px}
.sv1-kpi small{display:block;font-size:11px;color:var(--faint);margin-top:5px;line-height:1.6}
.sv1-pipe{display:grid;grid-template-columns:repeat(auto-fit,minmax(126px,1fr));gap:9px}
.sv1-pipe a{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--l);
 border-radius:11px;padding:10px 12px;text-decoration:none}
.sv1-pipe a:hover{border-color:var(--ac)}
.sv1-pipe i{width:8px;height:8px;border-radius:50%;flex:none}
.sv1-pipe span{font-size:11.5px;color:var(--mut);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sv1-pipe b{font-family:var(--fm);font-size:14.5px;font-weight:600;color:var(--ink);margin-inline-start:auto}
/* الألوان نفسها التي تعنون أعمدة لوحة المسار، فالمرحلة تُعرف بلونها في
   الشاشتين. (مكرّرة هنا بدل توسيع محدِّد اللوحة: قسم اللوحة لا يُمسّ.) */
.sv1-dot.d-new{background:#8D97AE}
.sv1-dot.d-review{background:#5B7CC4}
.sv1-dot.d-shortlist{background:#7C5BC4}
.sv1-dot.d-interview{background:#C48A2E}
.sv1-dot.d-offer{background:#2E8B6B}
.sv1-dot.d-hired{background:#12693A}
.sv1-dot.d-rejected{background:#B42318}
.sv1-dot.d-future{background:#A9AEBD}
.sv1-empty{background:var(--acSoft);border:1px solid var(--acLine);border-radius:14px;
 padding:22px 20px;margin:16px 0 0;text-align:center}
.sv1-empty h4{margin:0 0 6px;font-size:16px;font-weight:600;color:var(--ink)}
.sv1-empty p{margin:0 auto 14px;font-size:12.5px;color:var(--s);line-height:1.8;max-width:520px}

/* ── جدول الوظائف ────────────────────────────────────────────────────────
   جدولٌ لا بطاقات: العنوان والمدينة والمجال والدوام والمتقدّمون والحالة في
   سطرٍ واحد تُقرأ عمودياً بالعين. وعلى الجوال ينهار إلى بطاقات بعناوينها من
   data-l — لا تمريرَ أفقيّ لجدول، فهو أسوأ ما يُعطى لإصبع. */
.sv1-tb{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--l);
 border-radius:13px;overflow:hidden;box-shadow:var(--sh)}
.sv1-tb th{font-size:11px;font-weight:600;color:var(--mut);text-align:start;padding:10px 12px;
 background:var(--soft);border-bottom:1px solid var(--l);white-space:nowrap}
.sv1-tb td{padding:11px 12px;font-size:12.5px;color:var(--s);border-bottom:1px solid var(--l);vertical-align:middle}
.sv1-tb tr:last-child td{border-bottom:0}
.sv1-tb td.t{font-size:13.5px;font-weight:600;color:var(--ink);line-height:1.5}
.sv1-tb td.n{font-family:var(--fm);font-size:13px;color:var(--ink)}
.sv1-tb td .acts{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
@media(max-width:860px){
 .sv1-tb,.sv1-tb tbody,.sv1-tb tr,.sv1-tb td{display:block}
 .sv1-tb thead{display:none}
 .sv1-tb{border:0;background:none;box-shadow:none;border-radius:0}
 .sv1-tb tr{background:#fff;border:1px solid var(--l);border-radius:13px;box-shadow:var(--sh);
  margin-bottom:10px;padding:8px 2px}
 .sv1-tb td{border-bottom:0;display:flex;align-items:center;gap:12px;padding:5px 13px}
 .sv1-tb td::before{content:attr(data-l);flex:none;min-width:88px;font-size:11px;color:var(--mut)}
 .sv1-tb td.t{padding-bottom:8px}
 .sv1-tb td.t::before{display:none}
}
.sv1-pill{display:inline-block;font-size:10.5px;font-weight:600;padding:4px 9px;border-radius:999px;
 background:#eef1f7;color:#5a6280;white-space:nowrap}
.sv1-pill.ok{background:#e6f6ec;color:#12693a}
.sv1-pill.off{background:#f3f4f6;color:#8b90a0}
.sv1-emp-jobsel{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:16px}
.sv1-emp-jobsel button{border:1px solid var(--l);background:#fff;border-radius:999px;padding:7px 14px;
 font:inherit;font-size:12px;color:var(--mut);cursor:pointer}
.sv1-emp-jobsel button.on{border-color:var(--ac);color:var(--ac);background:var(--acSoft);font-weight:600}

/* ── لوحة المسار: عمودٌ لكل مرحلة ─────────────────────────────────────────
   الاتجاه لا يُكتب هنا: الحاوية flex والصفحة ‎<html dir="rtl">‎ في العربية،
   فالأعمدة تبدأ من اليمين حيث تبدأ القراءة وحدها. ولا خاصية left/right في
   هذا القسم كلّه لهذا السبب — الكل منطقيّ (‏inline-start/‏inline-end). */
.sv1-kb{display:flex;gap:12px;overflow-x:auto;overflow-y:hidden;padding:2px 2px 16px;
 scroll-snap-type:x proximity;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch}
.sv1-kb-col{flex:0 0 266px;width:266px;background:var(--g);border:1px solid var(--l);border-radius:14px;
 display:flex;flex-direction:column;scroll-snap-align:start;transition:border-color .15s ease,background .15s ease}
.sv1-kb-col.over{border-color:var(--ac);background:var(--acSoft)}
.sv1-kb-head{display:flex;align-items:center;gap:8px;padding:11px 13px 9px;border-bottom:1px solid var(--l)}
.sv1-kb-head i{width:8px;height:8px;border-radius:50%;flex:none;background:#8D97AE}
.sv1-kb-head b{font-size:12.5px;font-weight:600;color:var(--ink);flex:1;min-width:0;
 overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sv1-kb-head span{font-size:11px;font-weight:600;color:var(--mut);background:#fff;border:1px solid var(--l);
 border-radius:999px;padding:1px 8px;font-family:var(--fm)}
.sv1-kb-head i.d-new{background:#8D97AE}
.sv1-kb-head i.d-review{background:#5B7CC4}
.sv1-kb-head i.d-shortlist{background:#7C5BC4}
.sv1-kb-head i.d-interview{background:#C48A2E}
.sv1-kb-head i.d-offer{background:#2E8B6B}
.sv1-kb-head i.d-hired{background:#12693A}
.sv1-kb-head i.d-rejected{background:#B42318}
.sv1-kb-head i.d-future{background:#A9AEBD}
.sv1-kb-body{list-style:none;margin:0;padding:9px;display:flex;flex-direction:column;gap:8px;
 max-height:min(62vh,620px);overflow-y:auto;overscroll-behavior-y:contain}
.sv1-kb-empty{font-size:11.5px;color:var(--faint);text-align:center;padding:16px 6px;line-height:1.7}
.sv1-kb-card{background:#fff;border:1px solid var(--l);border-radius:12px;padding:11px 12px 10px;
 box-shadow:var(--sh);cursor:grab}
.sv1-kb-card:active{cursor:grabbing}
.sv1-kb-card.drag{opacity:.45}
.sv1-kb-top{display:flex;align-items:flex-start;gap:9px}
.sv1-kb-av{width:32px;height:32px;flex:none;border-radius:50%;background:var(--acSoft);color:var(--ac);
 display:grid;place-items:center;font-style:normal;font-size:11.5px;font-weight:600;font-family:var(--fm)}
.sv1-kb-nm{flex:1;min-width:0}
.sv1-kb-nm b{display:block;font-size:13px;font-weight:600;color:var(--ink);line-height:1.5;
 overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sv1-kb-nm small{display:block;font-size:11px;color:var(--mut);line-height:1.6;
 overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sv1-kb-score{flex:none;font-size:10px;font-weight:600;color:#5a6280;background:#eef1f7;
 border-radius:999px;padding:3px 7px;white-space:nowrap}
.sv1-kb-meta{margin:8px 0 0;font-size:11.5px;color:var(--s);line-height:1.65;
 display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.sv1-kb-acts{display:flex;align-items:center;gap:7px;margin-top:10px}
.sv1-kb-move{flex:1;min-width:0;border:1px solid var(--l);border-radius:8px;background:#fff;
 padding:5px 8px;font:inherit;font-size:11px;color:var(--mut);cursor:pointer;outline:none}
.sv1-kb-move:focus-visible{border-color:var(--ac);color:var(--ac)}
.sv1-kb-open{flex:none;font-size:11px;color:var(--ac);text-decoration:underline;text-underline-offset:3px}
.sv1-kb-more{width:calc(100% - 18px);margin:0 9px 9px;border:1px solid var(--l);background:#fff;border-radius:9px;
 padding:7px 10px;font:inherit;font-size:11.5px;color:var(--mut);cursor:pointer}
.sv1-kb-more:hover{border-color:var(--ac);color:var(--ac)}
.sv1-emp-hint{font-size:11.5px;color:var(--faint);margin:0 0 12px;line-height:1.7}
@media(max-width:700px){
 /* الجوال: الأعمدة تبقى أعمدةً وتُمرَّر أفقياً بالإصبع مع التقاط (snap) —
    لا شبكةٌ تنكسر ولا عمودٌ يُقصّ نصفه. */
 .sv1-kb-col{flex:0 0 82vw;width:82vw}
 .sv1-kb-body{max-height:none}
 /* بلا سقفٍ لارتفاع العمود، يمدّ stretch الأعمدةَ الفارغة إلى طول أطولها —
    شريطٌ رماديّ فارغ بطول الشاشة. كل عمودٍ بطوله هو. */
 .sv1-kb{scroll-snap-type:x mandatory;align-items:flex-start}
}
@media (prefers-reduced-motion:reduce){.sv1-kb-col{transition:none}}

.sv1-emp-langs a{color:var(--ac);text-decoration:underline;text-underline-offset:3px;
 margin-inline-end:14px;font-size:12.5px}
.sv1-emp-langs a.on{color:var(--ink);text-decoration:none;font-weight:600}
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
 .sv1-emp{padding:0 16px}
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
    <!-- الشريط العلوي: الهوية، بحثٌ في المحمَّل، اللغة، وقائمة الحساب -->
    <div class="sv1-emp-top">
      <button type="button" class="sv1-emp-burger" id="empBurger"
        aria-label="${esc(t("sideMenu"))}" aria-expanded="false" aria-controls="empSide">☰</button>
      <div class="sv1-emp-who">
        <b id="empCo">Business Partner</b>
        <span id="empPlan"></span>
      </div>
      <div class="sv1-emp-q">
        <input id="empQ" type="search" autocomplete="off" spellcheck="false"
          placeholder="${esc(t("searchPh"))}" aria-label="${esc(t("searchPh"))}">
        <div class="sv1-emp-res sv1-hidden" id="empRes" role="listbox"></div>
      </div>
      <details class="sv1-emp-lang" id="langBox">
        <summary aria-label="${esc(t("langL"))}">🌐 ${esc(lang.toUpperCase())}</summary>
        <div class="menu">${langItems}</div>
      </details>
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

    <p class="sv1-emp-msg err sv1-hidden" id="empWarn" style="margin:0 0 14px"></p>

    <div class="sv1-emp-shell" id="empShell">
      <div class="sv1-emp-back" id="empBack"></div>
      <aside class="sv1-emp-side" id="empSide">
        <button type="button" class="cta" data-go="new" id="tabNew">+ ${esc(t("navNew"))}</button>
        <hr>
        <nav class="grp" aria-label="${esc(t("sideMenu"))}">
          <button type="button" data-go="home" id="tabHome">${ICON.home}<span>${esc(t("sideHome"))}</span></button>
          <button type="button" data-go="jobs" id="tabJobs">${ICON.jobs}<span>${esc(t("sideJobs"))}</span></button>
          <button type="button" data-go="apps" id="tabApps">${ICON.apps}<span>${esc(t("sideApps"))}</span></button>
        </nav>
        <!-- مكان المجموعة الثانية: المطابقة الذكية وقاعدة المواهب. تُضاف هنا
             كـ<nav class="grp"> ثانية فوق الفاصل — ولا يُوضع بندٌ يفتح على
             فراغ قبل أن تُبنى شاشته. -->
        <hr>
        <nav class="grp" aria-label="${esc(t("sideSet"))}">
          <button type="button" data-go="settings" id="tabSet">${ICON.set}<span>${esc(t("sideSet"))}</span></button>
        </nav>
        <button type="button" class="fold" id="sideFold" aria-label="${esc(t("sideFold"))}"
          title="${esc(t("sideFold"))}" aria-pressed="false">⇔</button>
      </aside>

      <div class="sv1-emp-main">

    <!-- الرئيسية -->
    <div id="scHome" class="sv1-hidden">
      <h3 class="sv1-emp-h">${esc(t("homeH"))}</h3>
      <p class="sv1-emp-sub">${esc(t("homeSub"))}</p>
      <div class="sv1-kpi" id="homeKpi"></div>
      <p class="sv1-emp-hint sv1-hidden" id="homeNote" style="margin-top:10px"></p>
      <div class="sv1-empty sv1-hidden" id="homeEmpty">
        <h4>${esc(t("emptyH"))}</h4>
        <p>${esc(t("emptyP"))}</p>
        <button type="button" class="sv1-btn primary" data-go="new">${esc(t("emptyGo"))}</button>
      </div>
      <h4 class="sv1-emp-h2">${esc(t("pipeH"))}</h4>
      <p class="sv1-emp-sub">${esc(t("pipeSub"))}</p>
      <div class="sv1-pipe" id="homePipe"></div>
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
        <div class="row">
          <div><label for="jType">${esc(t("fType"))}</label><select id="jType">${typeOpts}</select></div>
          <div><label for="jMode">${esc(t("fMode"))}</label><select id="jMode">${modeOpts}</select></div>
        </div>
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
      <p class="sv1-emp-hint sv1-hidden" id="appsHint">${esc(t("boardHint"))}</p>
      <p class="sv1-emp-msg sv1-hidden" id="appsMsg" role="status" aria-live="polite"></p>
      <div class="sv1-kb" id="appsBoard"></div>
    </div>

    <!-- ملف المرشّح -->
    <div id="scCand" class="sv1-hidden">
      <p style="margin:0 0 14px"><button type="button" class="sv1-emp-link" id="candBack">${esc(t("profBack"))}</button></p>
      <div id="candBody"></div>
    </div>

    <!-- الإعدادات -->
    <div id="scSettings" class="sv1-hidden">
      <h3 class="sv1-emp-h">${esc(t("setH"))}</h3>
      <p class="sv1-emp-sub">${esc(t("setSub"))}</p>
      <dl class="sv1-emp-kv">
        <dt>${esc(t("setCo"))}</dt><dd id="setCo">—</dd>
        <dt>${esc(t("emailL"))}</dt><dd id="setEmail" dir="ltr">—</dd>
        <dt>${esc(t("plan"))}</dt><dd id="setPlan">—</dd>
        <dt>${esc(t("langL"))}</dt><dd class="sv1-emp-langs">${langItems}</dd>
      </dl>
      <div class="sv1-emp-f" style="max-width:480px">
        <div id="setPhoneWrap">
          <label for="setPhone">${esc(t("acctPh"))}</label>
          <input id="setPhone" type="tel" dir="ltr" autocomplete="tel">
          <div class="acts">
            <button type="button" class="sv1-btn sm" id="setPhoneBtn">${esc(t("acctSave"))}</button>
            <span class="sv1-emp-msg" id="setMsg"></span>
          </div>
        </div>
        <p class="sv1-emp-hint" style="margin-top:18px">${esc(t("acctPwNo"))}</p>
        <button type="button" class="sv1-btn sm" id="setOut" style="margin-top:8px">${esc(t("logout"))}</button>
      </div>
    </div>

      </div>
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
// «لم يفتح» ليست حالةً واحدة. الخادم يعيد السبب باسمه في validate=1، وهذه
// تترجمه إلى الجملة التي تخصّ صاحبه — ولا تتّهم اشتراكَ من كان العطل عندنا.
function subMsg(d){var r=d&&d.emp,st=(d&&d.empStatus)||'—';
 if(r==='pending')return TX.pendSub.replace('{s}',st);
 if(r==='error')return TX.empErr;
 if(r==='nocode')return TX.noCodeE;
 return TX.noSub}
// شريطٌ فوق اللوحة حين فُتحت بحساب العميل لا باشتراك صاحب العمل. ثلاث
// حالاتٍ تستحقّه، وواحدةٌ لا:
//   pending/nocode — لصاحبه اشتراكٌ لا يفتح، وإعلاناته المنشورة تحته لا
//     تظهر في هذه اللوحة. لوحةٌ فارغة بلا سبب أسوأ من رسالة.
//   error — تعذّر سؤال نوشن أصلاً، فقد يكون له اشتراكٌ مفعّل واختفت
//     إعلاناته هذه الجلسة وحدها. أخطرها، لأنه يبدو حذفاً.
//   none — لا اشتراك له أصلاً، وهو يعمل هنا بحساب Business Partner عمله
//     كاملاً: ما ينشره يعود إليه. لا شيء يُقال، ولا شريط.
function warnBar(d){var r=(d&&d.portal)?(d.emp||''):'';
 var m=r==='pending'?TX.portalW.replace('{s}',(d&&d.empStatus)||'—')
   :r==='nocode'?TX.noCodeE:r==='error'?TX.empErr:'';
 if(m)$('empWarn').textContent=m;
 show($('empWarn'),!!m)}
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
  AUTH={mode:'session'};enter()
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
  if(!d||!d.ok){AUTH=null;err(TX.eNet);return}
  if(!d.unlocked){
   // يُمحى وضع الهوية في الحالتين. كان يُمحى في وضع الجلسة وحده، فمن جرّب
   // كلمة مرور لحسابٍ غير مفعّل يبقى رمزه العالق في AUTH؛ ثم يدخل برمز
   // البريد فيُرسَل الرمز العالق بدل جلسته، ويُردّ عليه «لا اشتراك» أبداً
   // حتى يحدّث الصفحة. بابٌ يُغلق على من دخل من الباب الآخر.
   AUTH=null;
   err(subMsg(d));return}
  CO=d.company||CO;PLAN=d.plan||PLAN;
  $('empCo').textContent=CO||'Business Partner';
  $('empPlan').textContent=PLAN?TX.plan+': '+PLAN:'';
  warnBar(d);
  show($('empLogin'),false);show($('empApp'),true);
  route()
 }).catch(function(){AUTH=null;err(TX.eNet)})}

// ── التنقّل: لا إعادة تحميل، ولا جلبٌ لشاشة غير مفتوحة ────────────────────
// جدولٌ واحد: المفتاح ← الشاشة ← بند الشريط الجانبي الذي يضيء معها. كانت
// ثلاثة أسطر متوازية لكل شاشة، فإضافة شاشةٍ رابعة تعني ثلاثة مواضع يُنسى
// أحدها — وقد نُسي: ملف المرشّح كان يطفئ الأزرار بقائمة مكتوبة بيدها.
var loaded={jobs:false,apps:false};
var SC=[['home','scHome','tabHome'],['jobs','scJobs','tabJobs'],['new','scNew','tabNew'],
 ['apps','scApps','tabApps'],['settings','scSettings','tabSet']];
function navOn(k){SC.forEach(function(s){var b=$(s[2]);if(!b)return;
 var on=s[0]===k;b.classList.toggle('on',on);
 if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')})}
function hideScreens(){SC.forEach(function(s){show($(s[1]),false)});show($('scCand'),false)}
function route(){
 var h=(location.hash||'').replace(/^#\\/?/,'');
 var sc=h.split('/')[0]||'home';
 closeDrawer();hideRes();
 if(sc==='c'){openCand(h.split('/').slice(1).join('/'));return}
 var known=false;SC.forEach(function(s){if(s[0]===sc)known=true});
 if(!known)sc='home';
 hideScreens();SC.forEach(function(s){if(s[0]===sc)show($(s[1]),true)});
 navOn(sc);
 if(sc==='home')loadHome();
 if(sc==='jobs'&&!loaded.jobs)loadJobs();
 // عودةٌ إلى اللوحة بعد تغيير المرحلة من ملف المرشّح: تُرسم من النموذج
 // المحلي، بلا نداءٍ جديد — وإلا بقيت البطاقة في عمودها القديم.
 if(sc==='apps'){if(!loaded.apps)loadApps();else if(flat.length)drawApps()}
 if(sc==='settings')loadAcct();
 if(sc==='new'&&editId===null&&!$('jTitle').value)resetJobForm()}
window.addEventListener('hashchange',function(){if(AUTH)route()});
// يُستدعى على المحقون حديثاً أيضاً (زرّ «انشر أول إعلان» في حالة الفراغ)،
// فالربط مرةً واحدة عند الإقلاع كان يترك كل زرٍّ يُرسم لاحقاً ميتاً.
function wireGo(root){
 Array.prototype.forEach.call((root||document).querySelectorAll('[data-go]'),function(b){
  b.onclick=function(){location.hash='#/'+b.getAttribute('data-go')}})}
wireGo(document);

// ── الشريط الجانبي: درجٌ على الجوال، وطيٌّ إلى أيقونات على الحاسب ─────────
// وضع الطيّ يبقى في الذاكرة ولا يُكتب في localStorage: هذه بوابةٌ لا تكتب
// شيئاً في جهاز من يفتحها، وتحديث الصفحة يعيدها إلى وضعها الكامل.
function closeDrawer(){var s=$('empShell');if(!s)return;
 s.classList.remove('open');$('empBurger').setAttribute('aria-expanded','false')}
$('empBurger').onclick=function(){var s=$('empShell'),on=!s.classList.contains('open');
 s.classList.toggle('open',on);$('empBurger').setAttribute('aria-expanded',on?'true':'false')};
$('empBack').onclick=closeDrawer;
$('sideFold').onclick=function(){var s=$('empShell'),on=!s.classList.contains('mini');
 s.classList.toggle('mini',on);$('sideFold').setAttribute('aria-pressed',on?'true':'false')};
document.addEventListener('keydown',function(e){
 if(e.key==='Escape'||e.keyCode===27){closeDrawer();hideRes()}});
// نقرةٌ خارج قائمةٍ مفتوحة تغلقها — القوائم الأصلية (details) تبقى مفتوحة
// أبداً بلا هذا، فتتراكب واحدةٌ فوق أخرى.
document.addEventListener('click',function(e){
 var t=e.target;if(!t||!t.closest)return;
 if(!t.closest('.sv1-emp-q'))hideRes();
 if(!t.closest('#acctBox')&&$('acctBox').open)$('acctBox').open=false;
 if(!t.closest('#langBox')&&$('langBox').open)$('langBox').open=false},true);

// ── الرئيسية ──────────────────────────────────────────────────────────────
// شاشة الهبوط، ومصدراها هما المصدران نفسهما اللذان كانت «وظائفي» و«من تقدّم»
// تجلبهما عند فتح كلٍّ منهما: list-postings و applicants=1. فمجموع نداءات
// الجلسة كما هو — ثلاثة (validate + الاثنان) ورابعٌ عند أول فتح للحساب — ولا
// يُعاد أيٌّ منهما بعدها أبداً. الفرق أنهما يُطلبان هنا معاً وبلا انتظار
// أحدهما للآخر: الأرقام التي وصلت تُرسم فوراً، والباقية تقول «جارٍ العدّ…»
// بدل أن تحبس الشاشة كلها على أبطأ النداءين.
var jobsState='idle',appsState='idle';
function loadHome(){
 if(!loaded.jobs)loadJobs();
 if(!loaded.apps)loadApps();
 drawHome()}

// null = لم يصل بعد، '—' = وصل خطأ. وما عدا ذلك رقمٌ محسوبٌ من صفوفٍ بين
// يديّ الآن. ولا رقم ثالث: لا نسبة نموّ، ولا «+18%» مكتوبةً بلا حساب.
function figure(state,fn){return state==='ok'?fn():(state==='err'?'—':null)}
function kpiBox(val,label,note){
 return '<div>'+(val===null?'<em>'+esc(TX.numWait)+'</em>'
   :'<b>'+esc(String(val))+'</b>')+
  '<i>'+esc(label)+'</i>'+(note?'<small>'+esc(note)+'</small>':'')+'</div>'}

function drawHome(){
 if(!$('homeKpi'))return;
 var active=figure(jobsState,function(){var n=0;
  postings.forEach(function(p){if(p.status!=='مغلقة')n++});return n});
 var total=figure(appsState,function(){return flat.length});
 var cut=Date.now()-7*86400000;
 var fresh=figure(appsState,function(){var n=0;
  flat.forEach(function(a){var d=a.registered?Date.parse(a.registered):NaN;
   if(d&&!isNaN(d)&&d>=cut)n++});return n});
 $('homeKpi').innerHTML=
  kpiBox(active,TX.kActive,jobsState==='ok'?TX.kJobsN.replace('{n}',postings.length):'')+
  kpiBox(total,TX.kAll,TX.kAllN)+
  kpiBox(fresh,TX.kNew,TX.kNewN);
 // البطاقات تبقى مرسومةً على الصفر — ما يُضاف عند الصفر دعوةٌ لا إخفاء.
 show($('homeEmpty'),jobsState==='ok'&&!postings.length);
 var note=appsState==='err'?TX.numFail:(appsCut?TX.appsCut:'');
 $('homeNote').textContent=note;show($('homeNote'),!!note);
 var cnt={};STAGES.forEach(function(s){cnt[s[0]]=0});
 if(appsState==='ok')flat.forEach(function(a){
  if(cnt[a.stage]==null)cnt['new']++;else cnt[a.stage]++});
 $('homePipe').innerHTML=STAGES.map(function(s){
  var v=appsState==='ok'?String(cnt[s[0]]):(appsState==='err'?'—':'…');
  return '<a href="#/apps"><i class="sv1-dot d-'+s[0]+'" aria-hidden="true"></i>'+
   '<span>'+esc(s[1])+'</span><b>'+esc(v)+'</b></a>'}).join('');
 wireGo($('homeEmpty'))}

// ── البحث: في المتصفّح، على المحمَّل وحده ─────────────────────────────────
// لا نداء لكل حرف ولا نداء أصلاً — المصفوفتان محمّلتان في الذاكرة منذ
// الرئيسية. ولأنه لا يرى إلا ما فُتح، تقول رسالة الفراغ ذلك بنصّها بدل أن
// توهم بأن لا نتيجة في القاعدة كلها.
var QMAX=6;
function hideRes(){var r=$('empRes');if(r){show(r,false);r.innerHTML=''}}
function resGroup(head,rows,n){
 return '<h6>'+esc(head)+'</h6>'+rows+
  (n>QMAX?'<p class="sv1-emp-more">'+esc(TX.searchMr.replace('{n}',n-QMAX))+'</p>':'')}
function runSearch(){
 var q=$('empQ').value.trim().toLowerCase();
 if(q.length<2){hideRes();return}
 var hj=[],hc=[],i;
 for(i=0;i<postings.length;i++){var p=postings[i];
  if(((p.title||'')+' '+(p.city||'')+' '+(p.field||'')).toLowerCase().indexOf(q)>=0)hj.push(p)}
 for(i=0;i<flat.length;i++){var a=flat[i];
  if(((a.name||'')+' '+(a.role||'')+' '+(a.city||'')+' '+(a.skills||'')).toLowerCase().indexOf(q)>=0)hc.push(a)}
 var h='';
 if(hj.length)h+=resGroup(TX.searchJ,hj.slice(0,QMAX).map(function(p){
  return '<a href="#/jobs"><b>'+esc(p.title||'—')+'</b><small>'+
   esc([p.city,p.field].filter(Boolean).join(' · ')||'—')+'</small></a>'}).join(''),hj.length);
 if(hc.length)h+=resGroup(TX.searchC,hc.slice(0,QMAX).map(function(a){
  return '<a href="#/c/'+encodeURIComponent(a.id)+'"><b>'+esc(a.name||'—')+'</b><small>'+
   esc([a.role,a.city,a._job].filter(Boolean).join(' · ')||'—')+'</small></a>'}).join(''),hc.length);
 if(!h)h='<p>'+esc(TX.searchNo)+'</p>';
 var r=$('empRes');r.innerHTML=h;show(r,true);
 Array.prototype.forEach.call(r.querySelectorAll('a'),function(el){
  el.onclick=function(){$('empQ').value='';window.setTimeout(hideRes,0)}})}
$('empQ').oninput=runSearch;
$('empQ').onfocus=runSearch;

// ── وظائفي ────────────────────────────────────────────────────────────────
var postings=[];
function loadJobs(){
 loaded.jobs=true;jobsState='load';$('jobsStatus').textContent=TX.loading;$('jobsList').innerHTML='';
 post('/api/candidates',{action:'list-postings'}).then(function(d){
  if(!d||!d.ok){loaded.jobs=false;jobsState='err';
   $('jobsStatus').textContent=TX.eNet;drawHome();return}
  postings=d.postings||[];jobsState='ok';drawJobs();drawHome()
 }).catch(function(){loaded.jobs=false;jobsState='err';
  $('jobsStatus').textContent=TX.eNet;drawHome()})}

// كم تقدّم على هذا الإعلان: يُحسب من المجموعات العائدة في applicants=1 —
// المطابقة بمعرّف الوظيفة كما يختمه api/candidate.js في «الوظيفة المتقدم
// لها» ("العنوان (المعرّف)")، وبالعنوان وحده للصفوف القديمة التي وُسمت بلا
// معرّف. ولا يُعرض رقمٌ قبل وصول المتقدّمين: '…' حتى يصلوا، لا صفرٌ يكذب.
function jobMatch(p){
 var n=0,gid='';
 for(var i=0;i<groups.length;i++){var g=groups[i];
  if((g.jobId&&p.id&&g.jobId===p.id)||(!g.jobId&&g.jobTitle&&p.title&&g.jobTitle===p.title)){
   n+=(g.applicants||[]).length;if(!gid)gid=g.jobId||''}}
 return {n:n,id:gid}}

function drawJobs(){
 // الفراغ لوحةٌ واحدة لا رسالتان: كان السطر الرمادي فوقها يقول الشيء نفسه.
 if(!postings.length){$('jobsStatus').textContent='';
  $('jobsList').innerHTML='<div class="sv1-empty" style="margin-top:0"><h4>'+esc(TX.emptyH)+'</h4><p>'+
   esc(TX.jobsNone)+'</p><button type="button" class="sv1-btn primary" data-go="new">'+
   esc(TX.emptyGo)+'</button></div>';
  wireGo($('jobsList'));return}
 $('jobsStatus').textContent='';
 // عمود التاريخ يظهر حين يوجد تاريخ. list-postings لا يعيد «تاريخ النشر»
 // اليوم، وعمودٌ كلّه شُرَط أسوأ من غيابه — فمتى أعاده الخادم ظهر وحده.
 var hasDate=false;postings.forEach(function(p){if(p.posted||p.date)hasDate=true});
 var td=function(cls,label,html){
  return '<td'+(cls?' class="'+cls+'"':'')+' data-l="'+esc(label)+'">'+html+'</td>'};
 var head='<tr><th>'+esc(TX.thTitle)+'</th><th>'+esc(TX.thCity)+'</th><th>'+esc(TX.thField)+
  '</th><th>'+esc(TX.thType)+'</th><th>'+esc(TX.thApps)+'</th><th>'+esc(TX.thStat)+'</th>'+
  (hasDate?'<th>'+esc(TX.thDate)+'</th>':'')+'<th>'+esc(TX.thActs)+'</th></tr>';
 var rows=postings.map(function(p,i){
  var closed=p.status==='مغلقة';
  // الحقلان اختياريان في نوشن: يُعرضان حين تكون لهما قيمة، ولا يُخترع لهما بديل.
  var kind=[p.type,p.mode].filter(Boolean).join(' · ');
  var m=jobMatch(p);
  var nCell=appsState==='ok'
   ?(m.n?'<a href="#/apps" data-pick="'+esc(m.id)+'">'+m.n+'</a>':'0')
   :(appsState==='err'?'—':'…');
  // الإعلانات الثابتة في صفحة «الوظائف» لدينا ليست صفوفاً في قاعدة الإعلانات،
  // فلا تُعدَّل ولا تُغلق من هنا — تُعرض لأن عليها متقدّمين.
  var acts=p.site
   ?'<a class="sv1-btn sm" href="'+esc(p.url||'#')+'">'+esc(TX.viewJob)+'</a>'
   :'<a class="sv1-btn sm" href="'+JOB+encodeURIComponent(p.id)+'">'+esc(TX.viewJob)+'</a>'+
    '<button type="button" class="sv1-btn sm" data-edit="'+i+'">'+esc(TX.edit)+'</button>'+
    (closed?'':'<button type="button" class="sv1-btn sm" data-close="'+i+'">'+esc(TX.closeJob)+'</button>');
  return '<tr>'+
   td('t',TX.thTitle,esc(p.title||'—'))+
   td('',TX.thCity,esc(p.city||'—'))+
   td('',TX.thField,esc(p.field||'—'))+
   td('',TX.thType,esc(kind||'—'))+
   td('n',TX.thApps,nCell)+
   td('',TX.thStat,'<span class="sv1-pill '+(closed?'off':'ok')+'">'+
    esc(closed?TX.stClosed:TX.stActive)+'</span>')+
   (hasDate?td('n',TX.thDate,'<bdi dir="ltr">'+esc(String(p.posted||p.date||'').slice(0,10))+'</bdi>'):'')+
   td('',TX.thActs,'<div class="acts">'+acts+'</div>')+
  '</tr>'}).join('');
 $('jobsList').innerHTML='<table class="sv1-tb"><thead>'+head+'</thead><tbody>'+rows+'</tbody></table>';
 // رقم المتقدّمين بابٌ إلى لوحة المسار مفلترةً على هذا الإعلان وحده.
 Array.prototype.forEach.call($('jobsList').querySelectorAll('[data-pick]'),function(a){
  a.onclick=function(){pick=a.getAttribute('data-pick')||'';shown={}}});
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
 $('jTitle').value='';$('jCity').value='';$('jField').value='';
 $('jType').value='';$('jMode').value='';$('jDesc').value='';
 $('jSave').textContent=TX.publish;$('jMsg').textContent='';$('jMsg').className='sv1-emp-msg';
 show($('jCancel'),false)}
function editJob(p){editId=p.id;
 $('newH').textContent=TX.editH;$('newSub').textContent=p.title||'';
 $('jTitle').value=p.title||'';$('jCity').value=p.city||'';
 $('jField').value=p.field||'';$('jDesc').value=p.description||'';
 // القيمة المحفوظة مختارة عند التعديل. قيمةٌ لم تعد في القائمة (غُيّرت في
 // نوشن) تجعل select فارغاً، فلا يُكتب شيء ولا يُستبدل المحفوظ بقيمة أخرى.
 $('jType').value=p.type||'';$('jMode').value=p.mode||'';
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
  city:$('jCity').value.trim(),field:$('jField').value,
  type:$('jType').value,mode:$('jMode').value};
 if(editId)body.id=editId;
 post('/api/candidates',body).then(function(d){
  b.disabled=false;b.textContent=was;
  if(!d||!d.ok){m.className='sv1-emp-msg err';m.textContent=TX.eSave;return}
  loaded.jobs=false;resetJobForm();location.hash='#/jobs';
  window.setTimeout(function(){$('jobsStatus').textContent=TX.published},60)
 }).catch(function(){b.disabled=false;b.textContent=was;
  m.className='sv1-emp-msg err';m.textContent=TX.eSave})};

// ── من تقدّم ──────────────────────────────────────────────────────────────
var groups=[],pick='',flat=[],byId={},appsCut=false;
// المراحل الثمانية كما يقبلها ويعيدها api/candidates.js وحده — STAGE_MAP
// للكتابة و STAGE_KEY للقراءة. لا مرحلة من عندنا: مفتاحٌ لا يعرفه الخادم
// يعود بـ invalid_fields وتبقى البطاقة معلّقة بلا سبب ظاهر. ('screening'
// يكتب «فرز» أيضاً لكنه يُقرأ 'review'، فالمفتاح المعتمد هنا 'review'.)
var STAGES=[['new',TX.sNew],['review',TX.sReview],['shortlist',TX.sShort],['interview',TX.sInt],
 ['offer',TX.sOffer],['hired',TX.sHired],['rejected',TX.sRej],['future',TX.sFuture]];
function stageName(k){for(var i=0;i<STAGES.length;i++)if(STAGES[i][0]===k)return STAGES[i][1];return TX.sNew}
// سقف البطاقات المرسومة في العمود الواحد: القاعدة فيها آلاف الصفوف، ورسمها
// كلها دفعةً واحدة يُجمّد الجوال. الباقي خلف «أظهر المزيد» في العمود نفسه.
var PAGE=25,shown={},dragId='',msgT=0;

function loadApps(){
 loaded.apps=true;appsState='load';$('appsStatus').textContent=TX.loading;
 $('appsJobs').innerHTML='';$('appsBoard').innerHTML='';show($('appsHint'),false);
 return get('applicants=1').then(function(d){
  if(!d||!d.ok){loaded.apps=false;appsState='err';
   $('appsStatus').textContent=TX.eNet;drawHome();return}
  groups=d.jobs||[];indexApps();appsState='ok';appsCut=!!d.truncated;
  $('appsStatus').textContent=appsCut?TX.appsCut:'';
  drawApps();drawHome();
  // جدول الوظائف رُسم قبل وصول المتقدّمين بعمودٍ فيه '…' — يُعاد رسمه الآن
  // بالأرقام، لا بعد نداءٍ جديد بل من الصفوف نفسها التي وصلت للتوّ.
  if(jobsState==='ok'&&postings.length)drawJobs()
 }).catch(function(){loaded.apps=false;appsState='err';
  $('appsStatus').textContent=TX.eNet;drawHome()})}

// فهرسٌ واحد عند الجلب: قائمةٌ مسطّحة وجدولٌ بالمعرّف. كان كل رسمٍ يعيد بناء
// القائمة من المجموعات، وكل فتح ملفٍّ يمشي عليها خطّياً — وهذه بوابةٌ وُجدت
// لتكون سريعة.
function indexApps(){flat=[];byId={};
 groups.forEach(function(g){(g.applicants||[]).forEach(function(a){
  a._job=g.jobTitle;a._jobId=g.jobId;flat.push(a);byId[a.id]=a})})}

function boardRows(){return pick?flat.filter(function(a){return a._jobId===pick}):flat}

function drawApps(){
 var total=flat.length;
 if(!total){$('appsStatus').textContent=TX.appsNone;$('appsJobs').innerHTML='';
  $('appsBoard').innerHTML='';show($('appsHint'),false);return}
 $('appsJobs').innerHTML=['<button type="button" data-pick="" class="'+(pick?'':'on')+'">'+
  esc(TX.appsAll)+' ('+total+')</button>'].concat(groups.map(function(g){
  return '<button type="button" data-pick="'+esc(g.jobId)+'" class="'+(pick===g.jobId?'on':'')+'">'+
   esc(g.jobTitle)+' ('+(g.applicants||[]).length+')</button>'})).join('');
 Array.prototype.forEach.call($('appsJobs').querySelectorAll('[data-pick]'),function(b){
  b.onclick=function(){pick=b.getAttribute('data-pick');shown={};drawApps()}});
 show($('appsHint'),true);
 drawBoard()}

function initials(n){var p=String(n||'').trim().split(/\\s+/).filter(Boolean);
 if(!p.length)return '—';
 return (p[0].charAt(0)+(p.length>1?p[p.length-1].charAt(0):'')).toUpperCase()}

function cardHtml(a){
 var meta=[a.role,a.city,a.experience?a.experience+' '+TX.fYears:''].filter(Boolean).join(' · ');
 var opts=STAGES.filter(function(s){return s[0]!==a.stage}).map(function(s){
  return '<option value="'+s[0]+'">'+esc(s[1])+'</option>'}).join('');
 return '<li class="sv1-kb-card" data-id="'+esc(a.id)+'" draggable="true">'+
  '<div class="sv1-kb-top">'+
   '<i class="sv1-kb-av" aria-hidden="true">'+esc(initials(a.name))+'</i>'+
   '<div class="sv1-kb-nm"><b>'+esc(a.name||'—')+'</b>'+
    (a._job?'<small>'+esc(a._job)+'</small>':'')+'</div>'+
   (a.score!=null?'<span class="sv1-kb-score">'+esc(TX.matchS)+' '+esc(a.score)+'%</span>':'')+
  '</div>'+
  (meta?'<p class="sv1-kb-meta">'+esc(meta)+'</p>':'')+
  '<div class="sv1-kb-acts">'+
   '<select class="sv1-kb-move" draggable="false" data-move="'+esc(a.id)+'" aria-label="'+
    esc(TX.moveTo+' — '+(a.name||''))+'"><option value="">'+esc(TX.moveTo)+'</option>'+opts+'</select>'+
   '<a class="sv1-kb-open" draggable="false" href="#/c/'+encodeURIComponent(a.id)+'">'+esc(TX.open)+'</a>'+
  '</div></li>'}

function drawBoard(focus){
 var host=$('appsBoard'),sx=host.scrollLeft,tops={};
 Array.prototype.forEach.call(host.querySelectorAll('[data-body]'),function(ul){
  tops[ul.getAttribute('data-body')]=ul.scrollTop});
 var rows=boardRows(),buckets={};
 STAGES.forEach(function(s){buckets[s[0]]=[]});
 rows.forEach(function(a){(buckets[a.stage]||buckets.new).push(a)});
 host.innerHTML=STAGES.map(function(s){
  var k=s[0],list=buckets[k],n=list.length,lim=shown[k]||PAGE;
  return '<section class="sv1-kb-col" data-col="'+k+'" aria-label="'+esc(s[1])+' — '+n+'">'+
   '<header class="sv1-kb-head"><i class="d-'+k+'" aria-hidden="true"></i><b>'+esc(s[1])+
    '</b><span>'+n+'</span></header>'+
   '<ul class="sv1-kb-body" data-body="'+k+'">'+
    (n?list.slice(0,lim).map(cardHtml).join('')
      :'<li class="sv1-kb-empty">'+esc(TX.colEmpty)+'</li>')+
   '</ul>'+
   (n>lim?'<button type="button" class="sv1-kb-more" data-more="'+k+'">'+esc(TX.more)+
    ' ('+(n-lim)+')</button>':'')+
  '</section>'}).join('');
 host.scrollLeft=sx;
 Array.prototype.forEach.call(host.querySelectorAll('[data-body]'),function(ul){
  var v=tops[ul.getAttribute('data-body')];if(v)ul.scrollTop=v});
 wireBoard();
 // بعد نقلةٍ: أظهر العمود الذي وصلت إليه البطاقة، وإلا «اختفت» على الجوال
 // حيث لا يُرى إلا عمودٌ واحد.
 if(focus){var col=host.querySelector('[data-col="'+focus+'"]');
  if(col&&col.scrollIntoView){try{col.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'})}
   catch(_){col.scrollIntoView(false)}}}}

function wireBoard(){
 var host=$('appsBoard');
 Array.prototype.forEach.call(host.querySelectorAll('[data-more]'),function(b){
  b.onclick=function(){var k=b.getAttribute('data-more');shown[k]=(shown[k]||PAGE)+PAGE;drawBoard()}});
 // الطريق الأول للنقل، وهو الذي يعمل في كل مكان: قائمةٌ أصلية.
 Array.prototype.forEach.call(host.querySelectorAll('[data-move]'),function(sel){
  sel.onchange=function(){var v=sel.value;sel.value='';if(v)moveCand(sel.getAttribute('data-move'),v)}});
 // والطريق الثاني، على الفأرة وحدها: السحب.
 Array.prototype.forEach.call(host.querySelectorAll('.sv1-kb-card'),function(c){
  c.ondragstart=function(e){
   var tg=e.target;
   if(tg&&tg.closest&&tg.closest('select,a')){e.preventDefault();return}
   dragId=c.getAttribute('data-id');
   try{e.dataTransfer.setData('text/plain',dragId);e.dataTransfer.effectAllowed='move'}catch(_){}
   c.classList.add('drag')};
  c.ondragend=function(){dragId='';c.classList.remove('drag');
   Array.prototype.forEach.call(host.querySelectorAll('.sv1-kb-col'),function(k){
    k.classList.remove('over')})}});
 Array.prototype.forEach.call(host.querySelectorAll('.sv1-kb-col'),function(col){
  col.ondragover=function(e){if(!dragId)return;e.preventDefault();
   try{e.dataTransfer.dropEffect='move'}catch(_){}col.classList.add('over')};
  col.ondragleave=function(){col.classList.remove('over')};
  col.ondrop=function(e){e.preventDefault();col.classList.remove('over');
   var id=dragId;
   if(!id){try{id=e.dataTransfer.getData('text/plain')}catch(_){}}
   dragId='';
   if(id)moveCand(id,col.getAttribute('data-col'))}})}

function boardMsg(kind,text){
 var m=$('appsMsg');if(!m)return;
 m.className='sv1-emp-msg'+(kind?' '+kind:'');m.textContent=text||'';show(m,!!text);
 if(msgT)window.clearTimeout(msgT);
 // الخطأ يبقى حتى النقلة التالية؛ النجاح والانتظار يذهبان وحدهما.
 if(kind!=='err')msgT=window.setTimeout(function(){show(m,false);m.textContent=''},4000)}

// النقل متفائل: البطاقة تنتقل في النموذج المحلي وتُرسم في عمودها الجديد قبل
// أن يردّ الخادم. فإن فشل update-stage عادت إلى عمودها الأول ومعها سطرٌ يقول
// إنها لم تُنقل — لا إعادة جلبٍ للقائمة كلها بعد كل نقلة (نداء نوشن يمسح
// آلاف الصفوف)، ولا سكوتٌ يترك صاحب العمل يظنّ أنه نقل مرشّحاً وهو لم يُنقل.
function moveCand(id,to){
 var a=byId[id];if(!a||!to||a.stage===to)return;
 var from=a.stage;
 a.stage=to;drawBoard(to);
 boardMsg('',TX.moving);
 post('/api/candidates',{action:'update-stage',id:id,stage:to}).then(function(d){
  if(d&&d.ok){boardMsg('ok',(a.name?a.name+' — ':'')+TX.moveOk+' '+stageName(to));return}
  a.stage=from;drawBoard(from);boardMsg('err',TX.moveFail)
 }).catch(function(){a.stage=from;drawBoard(from);boardMsg('err',TX.moveFail)})}

// ── ملف المرشّح ───────────────────────────────────────────────────────────
function findCand(id){return byId[id]||null}

function openCand(id){
 id=decodeURIComponent(id||'');
 if(!loaded.apps){loadApps().then(function(){openCand(encodeURIComponent(id))});return}
 var c=findCand(id);
 if(!c){location.hash='#/apps';return}
 hideScreens();show($('scCand'),true);navOn('');
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

// ── الحساب: قائمةٌ في الشريط العلوي، وشاشةٌ في «الإعدادات» ─────────────────
// نداءٌ واحد يخدم الاثنتين ولا يُطلب إلا عند أول فتح لأيّهما — شاشةٌ مغلقة لا
// تُكلّف نداءً. وهو النداء الرابع في الجلسة كلها، كما كان.
var acctLoaded=false;
function setTxt(id,v){var e=$(id);if(e)e.textContent=v}
function loadAcct(){
 if(acctLoaded)return;
 acctLoaded=true;
 setTxt('acctCo',CO||'—');setTxt('setCo',CO||'—');setTxt('setPlan',PLAN||'—');
 if(AUTH&&AUTH.mode==='code'){
  // الدخول بكلمة المرور لا يفتح جلسة، و/api/employer يصادق بالجلسة وحدها —
  // فالحقل يُعرض للقراءة مع السطر الذي يقول كيف يُغيَّر، لا زرٌّ لا يعمل.
  setTxt('acctEmail',AUTH.email||'');setTxt('setEmail',AUTH.email||'');
  show($('acctPhoneWrap'),false);show($('setPhoneWrap'),false);
  $('acctMsg').className='sv1-emp-msg';$('acctMsg').textContent=TX.acctPhNo;
  $('setMsg').className='sv1-emp-msg';$('setMsg').textContent=TX.acctPhNo;
  return}
 fetch('/api/employer',{method:'POST',credentials:'same-origin',
  headers:{'content-type':'application/json'},body:JSON.stringify({action:'account'})})
 .then(j).then(function(d){
  if(!d||!d.ok){show($('acctPhoneWrap'),false);show($('setPhoneWrap'),false);return}
  setTxt('acctCo',d.company||CO||'—');setTxt('setCo',d.company||CO||'—');
  setTxt('acctEmail',d.email||'');setTxt('setEmail',d.email||'');
  $('acctPhone').value=d.phone||'';$('setPhone').value=d.phone||''
 }).catch(function(){show($('acctPhoneWrap'),false);show($('setPhoneWrap'),false)})}
$('acctBox').addEventListener('toggle',function(){if($('acctBox').open)loadAcct()});

// الرقم واحد وحقلاه اثنان — فيُكتب في كليهما عند الحفظ، وإلا عاد القديم
// ظاهراً في الشاشة الأخرى وبدا أن الحفظ لم يقع.
function savePhone(inp,btn,msg){
 var b=$(btn),m=$(msg),v=$(inp).value.trim();
 b.disabled=true;m.className='sv1-emp-msg';m.textContent=TX.saving;
 fetch('/api/employer',{method:'POST',credentials:'same-origin',
  headers:{'content-type':'application/json'},
  body:JSON.stringify({action:'update-phone',phone:v})})
 .then(j).then(function(d){b.disabled=false;
  if(d&&d.ok){m.className='sv1-emp-msg ok';m.textContent=TX.acctOk;
   $('acctPhone').value=v;$('setPhone').value=v}
  else{m.className='sv1-emp-msg err';m.textContent=TX.eSave}
 }).catch(function(){b.disabled=false;m.className='sv1-emp-msg err';m.textContent=TX.eNet})}
$('acctPhoneBtn').onclick=function(){savePhone('acctPhone','acctPhoneBtn','acctMsg')};
$('setPhoneBtn').onclick=function(){savePhone('setPhone','setPhoneBtn','setMsg')};

function signOut(){
 var done=function(){location.href=HOME};
 if(AUTH&&AUTH.mode==='code'){AUTH=null;done();return}
 fetch('/api/otp',{method:'POST',credentials:'same-origin',
  headers:{'content-type':'application/json'},body:JSON.stringify({action:'logout'})})
 .then(done).catch(done)}
$('acctOut').onclick=signOut;
$('setOut').onclick=signOut;

// ── الإقلاع: نداءٌ واحد يسأل «هل لي جلسة تفتح بوابة؟» ─────────────────────
// ولا شيء غيره: ولا بيانات مرشحين، ولا إعلانات، ولا ملف وهمي. بقية الشاشات
// تُجلب عند فتحها أول مرة فقط.
pane('fOtpStart');
get('validate=1').then(function(d){
 if(d&&d.unlocked){AUTH={mode:'session'};
  CO=d.company||'';PLAN=d.plan||'';
  $('empCo').textContent=CO||'Business Partner';
  $('empPlan').textContent=PLAN?TX.plan+': '+PLAN:'';
  warnBar(d);
  show($('empLogin'),false);show($('empApp'),true);route()}
 // جلسةٌ قائمة واشتراكٌ لم يُفعّل: يُقال السبب على شاشة الدخول بدل أن
 // تُعرض عليه شاشة «أرسل الرمز» وقد أرسله وأثبته من قبل.
 else if(d&&d.emp)err(subMsg(d));
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
