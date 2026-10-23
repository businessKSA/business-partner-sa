// SHR-HR — تبديل اللغة داخل الصفحة نفسها: العربية (الافتراضية، RTL) · English · Français · 中文 (LTR).
//
// كيف يعمل:
//   • مفاتيح القاموس هي النصوص العربية الحالية حرفاً بحرف: ar → [en, fr, zh]. لا مفاتيح مستعارة،
//     فما غابت ترجمته يبقى عربياً (tr تُرجع العربية) ويظهر في اختبار مسح DOM بدل أن يختفي.
//   • مفتاح فيه {0} {1} … قالبٌ للنص المركّب: يُطابَق بالكامل ويُستبدَل. {0} مُحكَم: لا يقبل التقاطاً
//     عربياً لم يُترجَم (فلا يلتقط قالبٌ بياناتٍ عربية بالخطأ). {0*} متساهل: للبيانات (مهنة، جنسية، اسم).
//     الجمع: {0|day|days} يختار بقيمة الالتقاط. الأرقام تأتي من النص الأصلي لا من القاموس.
//   • ما لا مفتاح له ولا قالب يُجزَّأ عند الفواصل ( · — ، : ← / ( ) « » ) وتُترجَم الأجزاء المعروفة
//     وتُترك الأجزاء الأخرى (بيانات البذرة) كما هي.
//   • الاتجاه والخط: lang/dir على الجذر، والـCSS كله بخصائص منطقية، وخط احتياطي للصينية.
//
// shrI18nClient تعمل في المتصفح: تُحقن في الصفحة بـ toString()، فلا تلمس شيئاً خارج جسمها
// (لا استيراد ولا متغيرات وحدة، ولا backtick ولا ‎$‎{ داخلها). ES5 عمداً ليطابق بقية الصفحة.
// وتعمل في Node بلا DOM لاختبار tr وحده.
//
// الترجمات الإنجليزية والفرنسية والصينية ترجمة عمل بيانها «مسودة لمراجعة ناطق أصلي»؛ وعبارات
// المرجع النظامي (أسماء المخالفات والمُدد والأنشطة) تحديداً تحتاج مراجعة لغوية/قانونية قبل أي استعمال
// حقيقي، وتُعرض في الواجهة بملاحظة «ترجمة عمل غير رسمية؛ النص العربي هو المرجع».

import { SV1_TEXT } from "./simple-v1.mjs";

export const SHR_LANGS = [["ar", "ع", "العربية"], ["en", "EN", "English"], ["fr", "FR", "Français"], ["zh", "中文", "中文"]];

// ============================================================ القاموس ==
// [العربية، English، Français، 中文]
const UI = [
  // ---- القشرة والشريط ------------------------------------------------------
  ["بيانات تجريبية — لا عمال حقيقيون ولا ربط حكومي ولا رسائل", "Demo data — no real workers, no government integration, no messages", "Données de démonstration — aucun travailleur réel, aucune intégration gouvernementale, aucun message", "演示数据——无真实工人，不对接政府系统，不发送任何消息"],
  ["بيانات تجريبية", "Demo data", "Données de démonstration", "演示数据"],
  ["بيانات وهمية", "Fictitious data", "Données fictives", "虚构数据"],
  ["جارٍ التحميل…", "Loading…", "Chargement…", "加载中…"],
  ["لوحة التشغيل التجريبية", "Demo operations dashboard", "Tableau de bord d'exploitation (démo)", "运营演示面板"],
  ["اللغة", "Language", "Langue", "语言"],
  [" ← ", " \u2192 ", " \u2192 ", " \u2192 "],
  ["تنبيهات", "Alerts", "Alertes", "提醒"],
  ["سجل المخالفات", "Violations log", "Registre des infractions", "违规记录"],
  ["تصنيف أسماء A33", "Classify A33 names", "Classement des noms A33", "A33 姓名分类"],
  ["القوائم", "Lists", "Listes", "名单"],
  ["متحقَّق", "Verified", "Vérifié", "已核实"],
  [" (غير مؤكد)", " (not confirmed)", " (non confirmé)", "（未确认）"],
  ["موعد تقديري — يُؤكَّد من بوابة الخدمة قبل الاعتماد عليه", "Estimated deadline — to be confirmed on the service portal before relying on it", "Échéance estimative — à confirmer sur le portail du service avant de s'y fier", "预估期限——使用前须在服务门户核实"],
  ["☰ القائمة", "☰ Menu", "☰ Menu", "☰ 菜单"],
  ["التنقل بين الصفحات", "Page navigation", "Navigation entre les pages", "页面导航"],
  ["‹", "›", "›", "›"],
  ["خروج", "Sign out", "Déconnexion", "退出"],
  ["دخول", "Sign in", "Connexion", "登录"],
  ["إعادة المحاولة", "Try again", "Réessayer", "重试"],
  ["تعذّر تحميل هذه الصفحة. تحقق من الاتصال ثم أعد المحاولة.", "This page could not be loaded. Check your connection and try again.", "Cette page n'a pas pu être chargée. Vérifiez la connexion puis réessayez.", "无法加载此页面。请检查网络连接后重试。"],
  ["تعذّر الاتصال بالخادم.", "Could not reach the server.", "Impossible de joindre le serveur.", "无法连接到服务器。"],
  ["تعذّر الاتصال", "Could not connect", "Connexion impossible", "无法连接"],
  ["انتهت الجلسة. سجّل الدخول من جديد.", "Your session has ended. Sign in again.", "Votre session a expiré. Reconnectez-vous.", "会话已结束，请重新登录。"],

  // ---- المجموعات والتبويبات --------------------------------------------------
  ["التشغيل", "Operations", "Exploitation", "运营"],
  ["التوظيف", "Recruitment", "Recrutement", "招聘"],
  ["مكاتب الاستقدام", "Recruitment agencies", "Agences de recrutement", "招聘机构"],
  ["الامتثال", "Compliance", "Conformité", "合规"],
  ["اللوحة", "Dashboard", "Tableau de bord", "总览"],
  ["العمال", "Workers", "Travailleurs", "工人"],
  ["الطلبات", "Requests", "Demandes", "请求"],
  ["الانتهاءات", "Expiries", "Échéances", "到期事项"],
  ["الوظائف", "Jobs", "Postes", "职位"],
  ["إعلانات الوظائف", "Job posts", "Annonces d'emploi", "招聘公告"],
  ["المرشحون", "Candidates", "Candidats", "候选人"],
  ["المطابقة", "Matching", "Correspondance", "匹配"],
  ["المكاتب", "Agencies", "Agences", "代理机构"],
  ["أوامر الاستقدام", "Recruitment orders", "Ordres de recrutement", "招聘订单"],
  ["المرشحون المقدَّمون", "Submitted candidates", "Candidats présentés", "已推荐候选人"],
  ["لوحة الامتثال", "Compliance dashboard", "Tableau de conformité", "合规总览"],
  ["المخالفات", "Violations", "Infractions", "违规记录"],
  ["قوائم التحقق", "Checklists", "Listes de contrôle", "核查清单"],
  ["التنبيهات", "Alerts", "Alertes", "提醒"],
  ["استيراد الملفات", "File imports", "Imports de fichiers", "文件导入"],
  ["أسماء A33", "A33 names", "Noms A33", "A33 名单"],

  // ---- أسطر الشرح -------------------------------------------------------------
  ["أرقام سريعة عن العمال والطلبات والمستندات القريبة من الانتهاء.", "Quick figures on workers, requests and documents nearing expiry.", "Chiffres clés sur les travailleurs, les demandes et les documents proches de l'échéance.", "工人、请求及临近到期文件的概览数据。"],
  ["أنشئ مسودة عامل وفعّلها بعد اكتمال الهوية والإقامة والعقد والمنشأة. الحذف أرشفة فقط.", "Create a worker draft and activate it once identity, residence permit, contract and establishment are complete. Deletion is archiving only.", "Créez un brouillon de travailleur et activez-le une fois l'identité, l'Iqama, le contrat et l'établissement complétés. La suppression se fait par archivage uniquement.", "创建工人草稿，待身份、居留证、合同和所属企业齐备后再启用。删除仅为归档。"],
  ["طلبات العملاء الواردة. غيّر حالة الطلب مع تقدّم العمل عليه.", "Incoming client requests. Change a request's status as work progresses.", "Demandes entrantes des clients. Modifiez le statut d'une demande au fil de son traitement.", "收到的客户请求。随处理进度更新请求状态。"],
  ["الإقامات والتأمينات التي تنتهي خلال ٩٠ يوماً أو انتهت فعلاً.", "Residence permits and insurance policies expiring within 90 days or already expired.", "Iqama et assurances qui expirent dans les 90 jours ou ont déjà expiré.", "90 天内到期或已到期的居留证和保险。"],
  ["أنشئ وظيفة وحدّد شروطها الإلزامية، ثم شغّل المطابقة لها.", "Create a job and set its mandatory requirements, then run matching for it.", "Créez un poste et définissez ses exigences obligatoires, puis lancez la correspondance.", "创建职位并设置必备条件，然后运行匹配。"],
  ["اكتب إعلان وظيفة وعاينه، ثم أرسله للاعتماد (يعتمده غيرك) فالنشر داخل صفحة SHR الخاصة. النشر العام قرار المالك ولم يُفعَّل.", "Write a job post and preview it, then submit it for approval (someone else approves it), then publish it inside the private SHR page. Public posting is the owner's decision and has not been enabled.", "Rédigez une annonce et prévisualisez-la, puis soumettez-la pour approbation (approuvée par une autre personne) avant publication dans la page privée SHR. La diffusion publique relève du propriétaire et n'est pas activée.", "撰写职位公告并预览，然后提交审批（由他人批准），再在 SHR 私有页面内发布。对外公开发布须由所有者决定，目前未启用。"],
  ["تابع المرشحين مرحلة بمرحلة، من «جديد» حتى «تعيين».", "Follow candidates stage by stage, from “New” to “Hired”.", "Suivez les candidats étape par étape, de « Nouveau » à « Recruté ».", "按阶段跟进候选人，从“新建”到“已录用”。"],
  ["بيانات المرشح وسجل موافقته وطلبات تقديمه ومقابلاته.", "The candidate's details, consent log, applications and interviews.", "Données du candidat, historique de consentement, candidatures et entretiens.", "候选人资料、同意记录、申请及面试。"],
  ["اختر وظيفة لترى المرشحين مرتّبين بدرجة مشروحة لكل شرط.", "Pick a job to see candidates ranked with a score explained for each requirement.", "Choisissez un poste pour voir les candidats classés avec une note expliquée pour chaque critère.", "选择职位，查看按得分排序、并逐项说明的候选人。"],
  ["سجّل مكاتب الاستقدام واعتمدها. لا يدخل المكتب قبل الاعتماد.", "Register recruitment agencies and approve them. An agency cannot sign in before approval.", "Enregistrez les agences de recrutement et approuvez-les. Une agence ne peut pas se connecter avant approbation.", "登记招聘机构并批准。机构获批前无法登录。"],
  ["أوامر استقدام لمكتب محدد أو مفتوحة لكل المكاتب المعتمدة.", "Recruitment orders for a specific agency or open to all approved agencies.", "Ordres de recrutement pour une agence précise ou ouverts à toutes les agences approuvées.", "面向指定机构或所有已批准机构开放的招聘订单。"],
  ["هذا ما يراه صاحب العمل عن الأمر. اسم المكتب لا يظهر له.", "This is what the employer sees about the order. The agency's name is not shown to them.", "Voici ce que l'employeur voit de l'ordre. Le nom de l'agence ne lui est pas montré.", "这是雇主看到的订单内容，不会显示机构名称。"],
  ["مرشحو المكاتب بالمواصفات فقط. راجعهم وحدّد مقابلاتهم.", "Agency candidates by profile only. Review them and set their interviews.", "Candidats des agences, profils uniquement. Examinez-les et planifiez leurs entretiens.", "仅含条件资料的机构候选人。请审核并安排面试。"],
  ["حالة قيد المنشآت والتنبيهات الأهم في مكان واحد.", "Establishments' restriction status and the most important alerts in one place.", "Statut de restriction des établissements et alertes principales au même endroit.", "企业限制状态和最重要的提醒集中一处。"],
  ["حالة القيد واللقطات التاريخية والفحوص لهذه المنشأة.", "Restriction status, historical snapshots and checks for this establishment.", "Statut de restriction, instantanés historiques et contrôles pour cet établissement.", "该企业的限制状态、历史快照和检查。"],
  ["سجّل المخالفات وتابع مواعيد الاعتراض التقديرية.", "Record violations and follow the estimated objection deadlines.", "Enregistrez les infractions et suivez les échéances d'opposition estimatives.", "登记违规并跟踪预估的异议期限。"],
  ["قوائم الجاهزية بنداً بنداً، مع بيان ما لم يُؤكَّد من مصدره.", "Readiness checklists item by item, showing what is not confirmed from its source.", "Listes de préparation point par point, en indiquant ce qui n'est pas confirmé par la source.", "逐项的就绪清单，并标明来源未确认的内容。"],
  ["مواعيد تقديرية وبيانات ناقصة ومنشآت محجوبة تحتاج انتباهك.", "Estimated deadlines, missing data and blocked establishments that need your attention.", "Échéances estimatives, données manquantes et établissements bloqués qui demandent votre attention.", "需要您关注的预估期限、缺失数据和被限制的企业。"],
  ["ارفع دفعات التأمينات أو حماية الأجور؛ تُبصَّم الهوية وتُراجَع قبل التطبيق.", "Upload social-insurance or wage-protection batches; identities are hashed and reviewed before applying.", "Téléversez des lots d'assurances sociales ou de protection des salaires ; les identités sont hachées et révisées avant application.", "上传社保或工资保护批次；身份信息会做哈希处理，并在应用前复核。"],
  ["صنّف الأسماء الواردة في قوائم A33 ثم يعتمدها مستخدم آخر.", "Classify the names in A33 lists, then another user approves them.", "Classez les noms des listes A33, puis un autre utilisateur les approuve.", "对 A33 名单中的姓名进行分类，再由另一位用户批准。"],

  // ---- الدخول -------------------------------------------------------------------
  ["دخول المشغّل", "Operator sign-in", "Connexion opérateur", "运营人员登录"],
  ["دخول مكتب استقدام", "Recruitment agency sign-in", "Connexion agence de recrutement", "招聘机构登录"],
  ["دخول عميل", "Client sign-in", "Connexion client", "客户登录"],
  ["لوحة التشغيل — دخول تجريبي", "Operations dashboard — demo sign-in", "Tableau de bord d'exploitation — connexion démo", "运营面板——演示登录"],
  ["بوابة العميل — دخول تجريبي", "Client portal — demo sign-in", "Espace client — connexion démo", "客户门户——演示登录"],
  ["بوابة المكاتب — دخول تجريبي", "Agency portal — demo sign-in", "Espace agences — connexion démo", "机构门户——演示登录"],
  ["دخول محلي ببيانات وهمية. اختر مستأجراً ومستخدماً من نفس المستأجر.", "Local sign-in with fictitious data. Pick a tenant and a user from the same tenant.", "Connexion locale avec des données fictives. Choisissez un tenant et un utilisateur du même tenant.", "使用虚构数据的本地登录。请选择租户及同一租户下的用户。"],
  ["دخول محلي ببيانات وهمية بدور عميل. العميل يرى عماله وعقوده وطلباته فقط.", "Local sign-in with fictitious data in the client role. A client sees only their own workers, contracts and requests.", "Connexion locale avec des données fictives, rôle client. Le client ne voit que ses travailleurs, contrats et demandes.", "使用虚构数据、以客户角色本地登录。客户只能看到自己的工人、合同和请求。"],
  ["دخول محلي ببيانات وهمية بدور مكتب. المكتب لا يدخل قبل اعتماده.", "Local sign-in with fictitious data in the agency role. An agency cannot sign in before it is approved.", "Connexion locale avec des données fictives, rôle agence. Une agence ne peut pas se connecter avant son approbation.", "使用虚构数据、以机构角色本地登录。机构获批前无法登录。"],
  ["مستأجر SHR التجريبي", "SHR demo tenant", "Tenant démo SHR", "SHR 演示租户"],
  ["مستأجر وهمي آخر", "Another fictitious tenant", "Autre tenant fictif", "另一个虚构租户"],
  ["مستأجر SHR التجريبي (بيانات وهمية)", "SHR demo tenant (fictitious data)", "Tenant démo SHR (données fictives)", "SHR 演示租户（虚构数据）"],
  ["مستأجر وهمي آخر (بيانات وهمية)", "Another fictitious tenant (fictitious data)", "Autre tenant fictif (données fictives)", "另一个虚构租户（虚构数据）"],
  ["العميل أ — مدير (يقدّم طلبات)", "Client A — admin (submits requests)", "Client A — administrateur (soumet des demandes)", "客户 A——管理员（可提交请求）"],
  ["العميل أ — مطّلع (قراءة فقط)", "Client A — viewer (read only)", "Client A — lecteur (lecture seule)", "客户 A——查看者（只读）"],
  ["العميل ب — مدير", "Client B — admin", "Client B — administrateur", "客户 B——管理员"],
  ["عميل المستأجر الآخر — مدير (اختر المستأجر الآخر)", "Other tenant's client — admin (choose the other tenant)", "Client de l'autre tenant — administrateur (choisissez l'autre tenant)", "另一租户的客户——管理员（请选择另一租户）"],
  ["مكتب أ (معتمد)", "Agency A (approved)", "Agence A (approuvée)", "机构 A（已批准）"],
  ["مكتب ب (معتمد)", "Agency B (approved)", "Agence B (approuvée)", "机构 B（已批准）"],
  ["مكتب ج (قيد الاعتماد — يُرفض)", "Agency C (pending approval — rejected)", "Agence C (en attente d'approbation — refusée)", "机构 C（待批准——将被拒绝）"],
  ["مكتب المستأجر الآخر (معتمد)", "Other tenant's agency (approved)", "Agence de l'autre tenant (approuvée)", "另一租户的机构（已批准）"],
  ["مالك تجريبي (SHR)", "Demo owner (SHR)", "Propriétaire démo (SHR)", "演示所有者（SHR）"],
  ["مشغّل تجريبي (SHR)", "Demo operator (SHR)", "Opérateur démo (SHR)", "演示运营人员（SHR）"],
  ["مسؤول امتثال تجريبي (SHR)", "Demo compliance officer (SHR)", "Responsable conformité démo (SHR)", "演示合规专员（SHR）"],
  ["مالك وهمي (آخر)", "Fictitious owner (other)", "Propriétaire fictif (autre)", "虚构所有者（其他）"],
  ["مشغّل وهمي (آخر)", "Fictitious operator (other)", "Opérateur fictif (autre)", "虚构运营人员（其他）"],
  ["مسؤول امتثال وهمي (آخر)", "Fictitious compliance officer (other)", "Responsable conformité fictif (autre)", "虚构合规专员（其他）"],
  ["منظور العميل", "Client view", "Vue client", "客户视角"],
  ["منظور العميل — قراءة فقط", "Client view — read only", "Vue client — lecture seule", "客户视角——只读"],
  ["منظور المكتب", "Agency view", "Vue agence", "机构视角"],
  ["بوابة العميل", "Client portal", "Espace client", "客户门户"],
  ["بوابة المكتب", "Agency portal", "Espace agence", "机构门户"],

  // ---- حالات مشتركة -----------------------------------------------------------------
  ["مسودة", "Draft", "Brouillon", "草稿"],
  ["بانتظار المستندات", "Awaiting documents", "En attente des documents", "待补充文件"],
  ["نشط", "Active", "Actif", "在职"],
  ["مؤرشف", "Archived", "Archivé", "已归档"],
  ["جديد", "New", "Nouveau", "新建"],
  ["قيد المراجعة", "In review", "En cours d'examen", "审核中"],
  ["بانتظار العميل", "Waiting for client", "En attente du client", "等待客户"],
  ["بانتظار ردّك", "Waiting for your reply", "En attente de votre réponse", "等待您回复"],
  ["قيد التنفيذ", "In progress", "En cours", "进行中"],
  ["مكتمل", "Completed", "Terminé", "已完成"],
  ["مرفوض", "Rejected", "Refusé", "已拒绝"],
  ["توظيف جديد", "New hire", "Nouvelle embauche", "新员工入职"],
  ["إنهاء", "Termination", "Fin de contrat", "终止"],
  ["نقل", "Transfer", "Transfert", "转移"],
  ["مستند", "Document", "Document", "文件"],
  ["أخرى", "Other", "Autre", "其他"],
  ["الإقامة", "Iqama", "Iqama", "居留证"],
  ["التأمين الطبي", "Medical insurance", "Assurance maladie", "医疗保险"],
  ["عقد العمل", "Work contract", "Contrat de travail", "劳动合同"],
  ["الجواز", "Passport", "Passeport", "护照"],
  ["جواز السفر", "Passport", "Passeport", "护照"],
  ["التأمينات", "Social insurance (GOSI)", "Assurances sociales (GOSI)", "社会保险（GOSI）"],
  ["الهوية", "Identity", "Identité", "身份"],
  ["مستند الإقامة", "Iqama document", "Document d'Iqama", "居留证文件"],
  ["إقامة سارية", "Valid Iqama", "Iqama valide", "有效居留证"],
  ["المنشأة والعميل", "Establishment and client", "Établissement et client", "企业与客户"],
  ["العميل", "Client", "Client", "客户"],
  ["النوع", "Type", "Type", "类型"],
  ["الملاحظة", "Note", "Note", "备注"],
  ["الحالة", "Status", "Statut", "状态"],
  ["الاسم", "Name", "Nom", "姓名"],
  ["المهنة", "Profession", "Profession", "职业"],
  ["الجنسية", "Nationality", "Nationalité", "国籍"],
  ["المدينة", "City", "Ville", "城市"],
  ["البلد", "Country", "Pays", "国家"],
  ["السبب", "Reason", "Motif", "原因"],
  ["التاريخ", "Date", "Date", "日期"],
  ["المصدر", "Source", "Source", "来源"],
  ["التفاصيل", "Details", "Détails", "详情"],
  ["رجوع", "Back", "Retour", "返回"],
  ["إضافة", "Add", "Ajouter", "添加"],
  ["حفظ", "Save", "Enregistrer", "保存"],
  ["تسجيل", "Register", "Enregistrer", "登记"],
  ["إنشاء", "Create", "Créer", "创建"],
  ["اعتماد", "Approve", "Approuver", "批准"],
  ["إغلاق", "Close", "Clôturer", "关闭"],
  ["تعديل", "Edit", "Modifier", "编辑"],
  ["رفع", "Upload", "Téléverser", "上传"],
  ["تنفيذ", "Run", "Exécuter", "执行"],
  ["تطبيق", "Apply", "Appliquer", "应用"],
  ["مراجعة", "Review", "Examen", "审核"],
  ["الصفوف", "Rows", "Lignes", "行"],
  ["السطر", "Line", "Ligne", "行号"],
  ["نعم", "Yes", "Oui", "是"],

  // ---- الأخطاء (أكواد الخادم تُترجَم في الواجهة) ------------------------------------------
  ["غير مصرّح", "Not authorized", "Non autorisé", "未授权"],
  ["الدور غير مسموح في هذه المرحلة", "This role is not allowed at this stage", "Ce rôle n'est pas autorisé à ce stade", "此阶段不允许该角色"],
  ["من أدخل أو اقترح لا يعتمد — يعتمده مستخدم آخر", "Whoever entered or proposed it cannot approve it — another user approves", "Celui qui a saisi ou proposé n'approuve pas — un autre utilisateur approuve", "录入或提议者不能批准——须由另一位用户批准"],
  ["التفعيل مرفوض: ناقص", "Activation refused: missing", "Activation refusée : il manque", "拒绝启用：缺少"],
  ["التفعيل مرفوض: ناقص {0}", "Activation refused: missing {0}", "Activation refusée : il manque {0}", "拒绝启用：缺少 {0}"],
  ["العامل مؤرشف", "The worker is archived", "Le travailleur est archivé", "该工人已归档"],
  ["العامل نشط أصلاً", "The worker is already active", "Le travailleur est déjà actif", "该工人已处于在职状态"],
  ["الطلب مغلق ولا يُعاد فتحه", "The request is closed and cannot be reopened", "La demande est clôturée et ne peut pas être rouverte", "请求已关闭，无法重新打开"],
  ["النظام محلي فقط (LOCAL_DB=1)", "The system is local only (LOCAL_DB=1)", "Le système est local uniquement (LOCAL_DB=1)", "系统仅限本地运行（LOCAL_DB=1）"],
  ["غير موجود", "Not found", "Introuvable", "未找到"],
  ["الحذف غير متاح — الأرشفة فقط", "Deletion is not available — archiving only", "La suppression n'est pas disponible — archivage uniquement", "不可删除——仅可归档"],
  ["الاسم مطلوب", "Name is required", "Le nom est obligatoire", "姓名为必填项"],
  ["حالة غير صالحة", "Invalid state", "État non valide", "状态无效"],
  ["نوع الهوية غير صالح", "Invalid ID type", "Type de pièce d'identité non valide", "证件类型无效"],
  ["لا موافقة سارية من المرشح", "No valid consent from the candidate", "Aucun consentement valide du candidat", "候选人没有有效同意"],
  ["الوظيفة مغلقة", "The job is closed", "Le poste est clôturé", "该职位已关闭"],
  ["المرشح مؤرشف", "The candidate is archived", "Le candidat est archivé", "该候选人已归档"],
  ["للمرشح طلب على هذه الوظيفة أصلاً", "The candidate already has an application for this job", "Le candidat a déjà une candidature pour ce poste", "该候选人已申请此职位"],
  ["الطلب في هذه المرحلة أصلاً", "The application is already at this stage", "La candidature est déjà à cette étape", "申请已处于此阶段"],
  ["الطلب في مرحلة نهائية", "The application is at a final stage", "La candidature est à une étape finale", "申请已处于最终阶段"],
  ["التعيين يمرّ بمرحلة العرض أولاً", "Hiring goes through the offer stage first", "Le recrutement passe d'abord par l'étape d'offre", "录用须先经过录用意向阶段"],
  ["الطلب مغلق", "The application is closed", "La candidature est clôturée", "申请已关闭"],
  ["مرحلة غير معروفة", "Unknown stage", "Étape inconnue", "未知阶段"],
  ["موعد غير صالح", "Invalid time", "Horaire non valide", "时间无效"],
  ["نوع المقابلة غير صالح", "Invalid interview type", "Type d'entretien non valide", "面试类型无效"],
  ["العنوان مطلوب", "Title is required", "Le titre est obligatoire", "标题为必填项"],
  ["أوزان غير صالحة", "Invalid weights", "Pondérations non valides", "权重无效"],
  ["المقابلة منتهية", "The interview has ended", "L'entretien est terminé", "面试已结束"],
  ["شرط الإقامة غير صالح", "Invalid residency requirement", "Exigence de résidence non valide", "居留条件无效"],
  ["القائمة غير صالحة", "Invalid list", "Liste non valide", "列表无效"],
  // مكاتب
  ["المكتب غير معتمد (قيد الاعتماد أو موقوف) — لا دخول", "The agency is not approved (pending or suspended) — no access", "L'agence n'est pas approuvée (en attente ou suspendue) — accès refusé", "机构未获批准（待批准或已暂停）——不可登录"],
  ["المكتب معتمد أصلاً", "The agency is already approved", "L'agence est déjà approuvée", "该机构已获批准"],
  ["المكتب غير معتمد", "The agency is not approved", "L'agence n'est pas approuvée", "该机构未获批准"],
  ["بريد تجريبي فقط بنطاق .invalid في هذه المرحلة", "Only demo emails on the .invalid domain at this stage", "Uniquement des e-mails de démonstration du domaine .invalid à ce stade", "此阶段仅接受 .invalid 域名的演示邮箱"],
  ["هذا البريد مستخدم", "This email is already in use", "Cet e-mail est déjà utilisé", "该邮箱已被使用"],
  ["المهنة مطلوبة", "Profession is required", "La profession est obligatoire", "职业为必填项"],
  ["الكمية بين 1 و500", "Quantity must be between 1 and 500", "La quantité doit être comprise entre 1 et 500", "数量须在 1 到 500 之间"],
  ["حدّد مكتباً أو «مفتوح»", "Choose an agency or “Open”", "Choisissez une agence ou « Ouvert »", "请选择机构或“开放”"],
  ["تاريخ غير صالح", "Invalid date", "Date non valide", "日期无效"],
  ["الأمر مغلق", "The order is closed", "L'ordre est clôturé", "订单已关闭"],
  ["مرشح مكرر على هذا الأمر", "Duplicate candidate on this order", "Candidat en double sur cet ordre", "此订单上的候选人重复"],
  ["مكرر داخل الملف", "Duplicate within the file", "Doublon dans le fichier", "文件内重复"],
  ["لا هاتف ولا بريد ولا هوية خام في هذه المرحلة", "No phone, email or raw ID at this stage", "Ni téléphone, ni e-mail, ni identité brute à ce stade", "此阶段不接受电话、邮箱或原始证件号"],
  ["سنوات الخبرة غير صالحة", "Invalid years of experience", "Années d'expérience non valides", "工作年限无效"],
  ["الأمر غير موجود لهذا المكتب", "The order does not exist for this agency", "Cet ordre n'existe pas pour cette agence", "此机构下不存在该订单"],
  ["لا صفوف", "No rows", "Aucune ligne", "没有数据行"],
  ["الحد الأقصى 60 صفاً في الدفعة", "Maximum 60 rows per batch", "Maximum 60 lignes par lot", "每批最多 60 行"],
  ["انتقال غير مسموح بين هاتين الحالتين", "This transition between the two states is not allowed", "Cette transition entre les deux états n'est pas autorisée", "不允许在这两个状态之间转换"],
  ["المرشح في هذه الحالة أصلاً", "The candidate is already in this state", "Le candidat est déjà dans cet état", "候选人已处于此状态"],
  // عميل
  ["المستخدم غير مربوط بشركة عميل — لا دخول", "The user is not linked to a client company — no access", "L'utilisateur n'est pas rattaché à une société cliente — accès refusé", "该用户未关联客户公司——不可登录"],
  ["حساب الشركة غير نشط — لا دخول", "The company account is not active — no access", "Le compte de la société n'est pas actif — accès refusé", "公司账户未启用——不可登录"],
  ["هذا الحساب للقراءة فقط — لا يقدّم طلبات", "This account is read-only — it cannot submit requests", "Ce compte est en lecture seule — il ne peut pas soumettre de demandes", "此账户为只读——无法提交请求"],
  ["لا يُقبل تحديد الشركة من الطلب", "The company cannot be set from the request", "La société ne peut pas être définie depuis la demande", "不接受在请求中指定公司"],
  ["نوع الطلب غير صالح", "Invalid request type", "Type de demande non valide", "请求类型无效"],
  ["اكتب وصف الطلب (٣ أحرف على الأقل)", "Write the request description (at least 3 characters)", "Rédigez la description de la demande (3 caractères minimum)", "请填写请求描述（至少 3 个字符）"],
  ["العدد بين 1 و200", "The number must be between 1 and 200", "Le nombre doit être compris entre 1 et 200", "数量须在 1 到 200 之间"],
  ["اختر العامل المعنيّ بهذا الطلب", "Choose the worker concerned by this request", "Choisissez le travailleur concerné par cette demande", "请选择此请求涉及的工人"],
  ["بلغت الحد الأقصى للطلبات المفتوحة — انتظر معالجة بعضها", "You have reached the maximum of open requests — wait for some to be processed", "Vous avez atteint le maximum de demandes ouvertes — attendez le traitement de certaines", "已达到未结请求上限——请等待部分请求处理完毕"],
  ["طلبات كثيرة في وقت قصير — حاول لاحقاً", "Too many requests in a short time — try again later", "Trop de requêtes en peu de temps — réessayez plus tard", "短时间内请求过多——请稍后再试"],
  // امتثال
  ["المنشأة محجوبة: حالة القيد تمنع هذا الإجراء", "The establishment is blocked: its restriction status prevents this action", "L'établissement est bloqué : son statut de restriction empêche cette action", "该企业被限制：其限制状态不允许此操作"],
  ["العامل مرتبط بقائمة A33 غير مكتملة التصنيف والاعتماد", "The worker is linked to an A33 list whose classification and approval are incomplete", "Le travailleur est lié à une liste A33 dont le classement et l'approbation sont incomplets", "该工人关联的 A33 名单尚未完成分类和批准"],
  ["حالة «تقديم» لا يغيّرها إلا مسؤول الامتثال", "Only the compliance officer can change the “Submission” status", "Seul le responsable conformité peut modifier le statut « Dépôt »", "只有合规专员可以变更“提交”状态"],
  ["لا تقدّم بلا مراجعة ثانية من مستخدم آخر", "No submission without a second review by another user", "Pas de dépôt sans seconde révision par un autre utilisateur", "未经另一位用户二次复核，不得提交"],
  ["روجعت أصلاً", "Already reviewed", "Déjà révisée", "已复核"],
  ["تُحقِّق منها أصلاً", "Already verified", "Déjà vérifié", "已核实"],
  ["اعتُمد أصلاً", "Already approved", "Déjà approuvé", "已批准"],
  ["قُرّر في الطلب أصلاً", "The request has already been decided", "La demande a déjà fait l'objet d'une décision", "该请求已有决定"],
  ["يلزم التصنيف أولاً", "Classification is required first", "Le classement est requis d'abord", "须先完成分类"],
  ["تغيير الإعدادات لمالك المستأجر وحده", "Only the tenant owner can change the settings", "Seul le propriétaire du tenant peut modifier les paramètres", "只有租户所有者可以更改设置"],
  ["بند غير موجود في المرجع", "Item not found in the reference", "Élément absent du référentiel", "参考资料中没有该条目"],
  ["البند غير مؤكد من المصدر — لا يُفعَّل", "The item is not confirmed from its source — it is not activated", "L'élément n'est pas confirmé par la source — il n'est pas activé", "该条目来源未确认——不予启用"],
  ["شريحة غير موجودة في المرجع", "Tier not found in the reference", "Tranche absente du référentiel", "参考资料中没有该档位"],
  ["الجهة مطلوبة", "The authority is required", "L'autorité est obligatoire", "须填写主管机构"],
  ["عدد الأشخاص أو الحالات غير صالح", "Invalid number of persons or cases", "Nombre de personnes ou de cas non valide", "人数或案件数无效"],
  ["تاريخ التبليغ غير صالح", "Invalid notification date", "Date de notification non valide", "送达日期无效"],
  ["تاريخ التبليغ لا يكون في المستقبل", "The notification date cannot be in the future", "La date de notification ne peut pas être dans le futur", "送达日期不能晚于今天"],
  ["أدخل تاريخ التبليغ من الإشعار الرسمي", "Enter the notification date from the official notice", "Saisissez la date de notification figurant sur l'avis officiel", "请按官方通知填写送达日期"],
  ["لا يُشتق الموعد من تاريخ المخالفة أو القرار — تاريخ التبليغ وحده", "The deadline is not derived from the violation or decision date — only the notification date", "L'échéance n'est pas déduite de la date de l'infraction ou de la décision — uniquement de la date de notification", "期限不得依据违规日期或决定日期推算——仅依据送达日期"],
  ["الأرقام النظامية تأتي من المرجع وحده", "Regulatory figures come from the reference only", "Les chiffres réglementaires proviennent uniquement du référentiel", "法规数字仅来自参考资料"],
  ["رقم المخالفة مسجّل أصلاً لهذه الجهة", "This violation number is already recorded for this authority", "Ce numéro d'infraction est déjà enregistré pour cette autorité", "该主管机构下已登记此违规编号"],
  ["حالة غير معروفة", "Unknown status", "Statut inconnu", "状态未知"],
  ["انتقال غير مسموح: خطوة واحدة فقط", "Transition not allowed: one step only", "Transition non autorisée : une seule étape à la fois", "不允许此转换：每次只能移动一步"],
  ["الحالة نفسها", "Same status", "Même statut", "状态相同"],
  ["حالة قيد غير صالحة", "Invalid restriction status", "Statut de restriction non valide", "限制状态无效"],
  ["السبب مطلوب", "A reason is required", "Le motif est obligatoire", "须填写原因"],
  ["نطاق غير صالح", "Invalid band", "Bande non valide", "档位无效"],
  ["نشاط غير موجود في المرجع", "Activity not found in the reference", "Activité absente du référentiel", "参考资料中没有该活动"],
  ["نسبة معلنة غير صالحة", "Invalid declared percentage", "Pourcentage déclaré non valide", "申报比例无效"],
  ["عدد غير صالح", "Invalid number", "Nombre non valide", "数量无效"],
  ["الاسم يحمل وسم «(وهمي)» في هذه المرحلة", "The name must carry the “(fictitious)” tag at this stage", "Le nom doit porter la mention « (fictif) » à ce stade", "此阶段姓名须带“（虚构）”标记"],
  ["حقل غير مسموح (لا أسماء حقيقية ولا هوية خام)", "Field not allowed (no real names or raw IDs)", "Champ non autorisé (ni noms réels, ni identité brute)", "不允许的字段（不接受真实姓名或原始证件号）"],
  ["الاسم مكرر في القائمة", "The name is duplicated in the list", "Le nom est en double dans la liste", "名单中姓名重复"],
  ["مرجع القائمة مطلوب", "The list reference is required", "La référence de la liste est obligatoire", "须填写名单编号"],
  ["الاسم الوهمي مطلوب", "A fictitious name is required", "Un nom fictif est obligatoire", "须填写虚构姓名"],
  ["رقم هوية وهمي مطلوب (يُحفظ بصمةً فقط)", "A fictitious ID number is required (stored as a hash only)", "Un numéro d'identité fictif est obligatoire (conservé uniquement sous forme d'empreinte)", "须填写虚构证件号（仅以哈希值保存）"],
  ["تصنيف غير صالح", "Invalid classification", "Classement non valide", "分类无效"],
  ["للعامل لا إسناد حالي", "The worker has no current assignment", "Le travailleur n'a pas d'affectation en cours", "该工人当前没有派驻安排"],
  ["المنشأة نفسها", "Same establishment", "Même établissement", "同一企业"],
  ["لدى العامل طلب نقل معلّق", "The worker has a pending transfer request", "Le travailleur a une demande de transfert en attente", "该工人有待处理的转移申请"],
  ["قرار غير صالح", "Invalid decision", "Décision non valide", "决定无效"],
  ["نوع دفعة غير صالح", "Invalid batch type", "Type de lot non valide", "批次类型无效"],
  ["الحد الأقصى للدفعة تجاوزه الملف", "The file exceeds the batch maximum", "Le fichier dépasse le maximum du lot", "文件超过批次上限"],
  ["لا صف صالح في الملف", "No valid row in the file", "Aucune ligne valide dans le fichier", "文件中没有有效行"],
  ["القائمة لا تخص هذا النوع", "The list does not belong to this type", "La liste ne concerne pas ce type", "该清单不适用于此类型"],
  ["نوع غير صالح", "Invalid type", "Type non valide", "类型无效"],
  ["الحالة مطلوبة", "The status is required", "Le statut est obligatoire", "须填写状态"],
  ["أسماء الحالات غير مؤكدة في المرجع", "The status names are not confirmed in the reference", "Les noms de statut ne sont pas confirmés dans le référentiel", "参考资料中状态名称未确认"],
  ["إعداد غير معروف", "Unknown setting", "Paramètre inconnu", "未知设置"],
  ["قيمة إعداد غير صالحة", "Invalid setting value", "Valeur de paramètre non valide", "设置值无效"],
  // إعلانات
  ["نص الإعلان مرفوض", "The post text is rejected", "Le texte de l'annonce est refusé", "公告文本被拒绝"],
  ["قناة النشر هذه معطّلة: النشر العام قرار المالك ولم يُفعَّل", "This publishing channel is disabled: public posting is the owner's decision and has not been enabled", "Ce canal de diffusion est désactivé : la diffusion publique relève du propriétaire et n'est pas activée", "此发布渠道已停用：对外公开发布须由所有者决定，目前未启用"],
  ["قناة النشر الخارجية غير مُنفَّذة في هذه المرحلة", "The external publishing channel is not implemented at this stage", "Le canal de diffusion externe n'est pas mis en œuvre à ce stade", "此阶段尚未实现外部发布渠道"],
  ["قناة نشر غير معروفة", "Unknown publishing channel", "Canal de diffusion inconnu", "未知的发布渠道"],
  ["انتقال غير مسموح: الدورة خطوة بخطوة (مسودة، اعتماد، نشر، إغلاق)", "Transition not allowed: the cycle goes step by step (draft, approval, publish, close)", "Transition non autorisée : le cycle se fait étape par étape (brouillon, approbation, publication, clôture)", "不允许此转换：流程须逐步进行（草稿、批准、发布、关闭）"],
  ["لا تعديل إلا للمسودة", "Only a draft can be edited", "Seul un brouillon peut être modifié", "只有草稿可以编辑"],
  ["لا يُضاف مقدّم طلب إلا لإعلان منشور داخلياً", "An applicant can only be added to a post published internally", "Un candidat ne peut être ajouté qu'à une annonce publiée en interne", "只能向已内部发布的公告添加申请人"],
  ["اختر المنشأة المعلِنة قبل الإرسال للاعتماد", "Choose the advertising establishment before submitting for approval", "Choisissez l'établissement annonceur avant de soumettre pour approbation", "提交审批前请选择发布公告的企业"],
  ["قيمة الراتب غير صالحة", "Invalid salary value", "Valeur de salaire non valide", "薪资数值无效"],
  ["الحد الأدنى للراتب أكبر من الأعلى", "The minimum salary is higher than the maximum", "Le salaire minimum est supérieur au maximum", "最低薪资高于最高薪资"],
  ["لغة غير صالحة", "Invalid language", "Langue non valide", "语言无效"],
  ["لا تغيير لحفظه", "Nothing to save", "Aucune modification à enregistrer", "没有可保存的更改"],
  ["لا يُنقل الإعلان إلى وظيفة أخرى", "A post cannot be moved to another job", "Une annonce ne peut pas être déplacée vers un autre poste", "公告不能转移到其他职位"],
  ["ادعاء ترخيص", "Licence claim", "Mention de licence", "涉及执照的表述"],
  ["ادعاء امتثال أو اعتماد", "Compliance or accreditation claim", "Mention de conformité ou d'agrément", "涉及合规或认证的表述"],
  ["ضمان أو وعد بنتيجة", "Guarantee or promise of an outcome", "Garantie ou promesse de résultat", "涉及保证或承诺结果的表述"],
  ["وعد بنتيجة حكومية", "Promise of a government outcome", "Promesse d'un résultat administratif", "承诺政府办理结果的表述"],
  ["رقم راتب غير موجود في حقل النطاق المُدخَل", "A salary figure not in the entered range fields", "Un chiffre de salaire absent des champs de fourchette saisis", "薪资数字不在已录入的区间字段中"],
  ["بيانات تواصل", "Contact details", "Coordonnées", "联系方式"],
  ["اسم عميل", "Client name", "Nom du client", "客户名称"],

  // ---- اللوحة · العمال · الطلبات · الانتهاءات -----------------------------------------------
  ["عمال (غير مؤرشفين)", "Workers (not archived)", "Travailleurs (non archivés)", "工人（未归档）"],
  ["عملاء نشطون", "Active clients", "Clients actifs", "活跃客户"],
  ["طلبات مفتوحة", "Open requests", "Demandes ouvertes", "未结请求"],
  ["مستندات تنتهي خلال 60 يوماً", "Documents expiring within 60 days", "Documents expirant sous 60 jours", "60 天内到期的文件"],
  ["مستندات منتهية", "Expired documents", "Documents expirés", "已过期文件"],
  ["نشط: {0} · مسودة أو بانتظار المستندات: {1}", "Active: {0} · Draft or awaiting documents: {1}", "Actifs : {0} · Brouillon ou en attente de documents : {1}", "在职：{0} · 草稿或待补文件：{1}"],
  ["اسم العامل (وهمي)", "Worker name (fictitious)", "Nom du travailleur (fictif)", "工人姓名（虚构）"],
  ["مسودة عامل جديد", "New worker draft", "Nouveau brouillon de travailleur", "新建工人草稿"],
  ["إنشاء مسودة", "Create draft", "Créer le brouillon", "创建草稿"],
  ["أُنشئت مسودة — لا تفعيل بلا مستندات", "Draft created — no activation without documents", "Brouillon créé — pas d'activation sans documents", "已创建草稿——缺少文件无法启用"],
  ["المسودة لا تُفعَّل إلا بعد اكتمال الهوية والإقامة والعقد والمنشأة، ويعتمدها مستخدم غير من أدخلها.", "A draft is activated only once identity, residence permit, contract and establishment are complete, and a user other than the one who entered it approves it.", "Un brouillon n'est activé qu'une fois l'identité, l'Iqama, le contrat et l'établissement complétés, et approuvé par un autre utilisateur que celui qui l'a saisi.", "草稿须待身份、居留证、合同和所属企业齐备，并由录入者以外的用户批准后方可启用。"],
  ["تفعيل", "Activate", "Activer", "启用"],
  ["فُعّل العامل", "Worker activated", "Travailleur activé", "工人已启用"],
  ["أرشفة", "Archive", "Archiver", "归档"],
  ["أُرشف", "Archived", "Archivé", "已归档"],
  ["لا عمال بعد", "No workers yet", "Aucun travailleur pour l'instant", "暂无工人"],
  ["أنشئ مسودة من النموذج أعلاه.", "Create a draft using the form above.", "Créez un brouillon avec le formulaire ci-dessus.", "请使用上方表单创建草稿。"],
  ["تغيّرت الحالة", "Status changed", "Statut modifié", "状态已更改"],
  ["لا طلبات من العملاء بعد", "No client requests yet", "Aucune demande client pour l'instant", "暂无客户请求"],
  ["تظهر هنا طلبات العملاء فور إرسالها.", "Client requests appear here as soon as they are sent.", "Les demandes des clients apparaissent ici dès leur envoi.", "客户请求一经发送即显示于此。"],
  ["العامل", "Worker", "Travailleur", "工人"],
  ["المستند", "Document", "Document", "文件"],
  ["ينتهي", "Expires", "Expire le", "到期日"],
  ["المتبقي", "Remaining", "Restant", "剩余"],
  ["منتهٍ", "Expired", "Expiré", "已过期"],
  ["{0} يوماً", "{0} {0|day|days}", "{0} {0|jour|jours}", "{0} 天"],
  ["منذ {0} يوماً", "{0} {0|day|days} ago", "il y a {0} {0|jour|jours}", "{0} 天前"],
  ["مضى {0} يوماً", "{0} {0|day|days} ago", "il y a {0} {0|jour|jours}", "已过 {0} 天"],
  ["انتهاء الإقامة والتأمين (٩٠ يوماً)", "Iqama and insurance expiry (90 days)", "Échéance des Iqama et assurances (90 jours)", "居留证与保险到期（90 天）"],
  ["لا شيء ينتهي في هذه المدة", "Nothing expires in this period", "Rien n'expire sur cette période", "此期间没有到期事项"],

  // ---- الوظائف والمرشحون (ATS) ---------------------------------------------------------------
  ["مراجعة", "Review", "Examen", "审核"],
  ["قائمة قصيرة", "Shortlist", "Liste restreinte", "候选名单"],
  ["مقابلة", "Interview", "Entretien", "面试"],
  ["عرض", "Offer", "Offre", "录用意向"],
  ["تعيين", "Hired", "Recruté", "已录用"],
  ["للمستقبل", "For later", "Pour plus tard", "留待后用"],
  ["موافقة سارية", "Valid consent", "Consentement valide", "同意有效"],
  ["موافقة مسحوبة", "Consent withdrawn", "Consentement retiré", "同意已撤回"],
  ["بلا موافقة", "No consent", "Sans consentement", "无同意"],
  ["قابلة للنقل", "Transferable", "Transférable", "可转移"],
  ["غير قابلة للنقل", "Not transferable", "Non transférable", "不可转移"],
  ["غير معروف", "Unknown", "Inconnu", "未知"],
  ["مطابق", "Match", "Conforme", "匹配"],
  ["جزئي", "Partial", "Partiel", "部分匹配"],
  ["غير مطابق", "No match", "Non conforme", "不匹配"],
  ["غير مطلوب", "Not required", "Non requis", "无需求"],
  ["مطابقة قوية", "Strong match", "Correspondance forte", "高度匹配"],
  ["مطابقة جيدة", "Good match", "Bonne correspondance", "良好匹配"],
  ["تحتاج مراجعة", "Needs review", "À examiner", "需复核"],
  ["ضعيفة", "Weak", "Faible", "较弱"],
  ["بلا درجة (بيانات ناقصة)", "Unscored (incomplete data)", "Sans note (données incomplètes)", "未评分（数据不完整）"],
  ["حضوري", "On-site", "Sur place", "现场"],
  ["مرئي", "Video", "Visio", "视频"],
  ["هاتفي", "Phone", "Téléphone", "电话"],
  ["مطلوبة", "Requested", "Demandé", "已申请"],
  ["مجدولة", "Scheduled", "Planifié", "已安排"],
  ["تمت", "Done", "Effectué", "已完成"],
  ["ملغاة", "Cancelled", "Annulé", "已取消"],
  ["مقابلة {0}", "Interview {0}", "Entretien {0}", "面试 {0}"],
  ["عنوان الوظيفة (وهمي)", "Job title (fictitious)", "Intitulé du poste (fictif)", "职位名称（虚构）"],
  ["سنوات الخبرة", "Years of experience", "Années d'expérience", "工作年限"],
  ["الإقامة: لا شرط", "Residency: no requirement", "Résidence : aucune exigence", "居留：无要求"],
  ["الإقامة: قابلة للنقل", "Residency: transferable", "Résidence : transférable", "居留：可转移"],
  ["شروط إلزامية (مفتاح أو مهارة، بفاصلة)", "Mandatory requirements (key or skill, comma-separated)", "Exigences obligatoires (clé ou compétence, séparées par des virgules)", "必备条件（关键项或技能，逗号分隔）"],
  ["وظيفة جديدة", "New job", "Nouveau poste", "新建职位"],
  ["أُنشئت الوظيفة", "Job created", "Poste créé", "职位已创建"],
  ["أُغلقت الوظيفة", "Job closed", "Poste clôturé", "职位已关闭"],
  ["الشروط الإلزامية: profession · residency · experience · nationality · location · availability · skills أو اسم مهارة. من يفشل فيها يظهر في فئة منفصلة ولا يُحذف.", "Mandatory requirements: profession · residency · experience · nationality · location · availability · skills, or a skill name. Anyone who fails them appears in a separate category and is not removed.", "Exigences obligatoires : profession · residency · experience · nationality · location · availability · skills, ou un nom de compétence. Celui qui ne les remplit pas apparaît dans une catégorie séparée et n'est pas supprimé.", "必备条件：profession · residency · experience · nationality · location · availability · skills，或某项技能名称。未满足者会单独归类显示，不会被删除。"],
  ["الوظيفة", "Job", "Poste", "职位"],
  ["الخبرة", "Experience", "Expérience", "经验"],
  ["الإقامة", "Iqama", "Iqama", "居留证"],
  ["لا شرط", "No requirement", "Aucune exigence", "无要求"],
  ["طابق", "Match", "Faire correspondre", "匹配"],
  ["مفتوحة", "Open", "Ouvert", "开放"],
  ["مغلقة", "Closed", "Clôturé", "已关闭"],
  ["(تعيين {0})", "({0} hired)", "({0} recruté(s))", "（已录用 {0}）"],
  ["لا وظائف بعد", "No jobs yet", "Aucun poste pour l'instant", "暂无职位"],
  ["أنشئ أول وظيفة من النموذج أعلاه.", "Create the first job using the form above.", "Créez le premier poste avec le formulaire ci-dessus.", "请使用上方表单创建第一个职位。"],
  ["مراحل المرشحين", "Candidate stages", "Étapes des candidats", "候选人阶段"],
  ["انقل إلى…", "Move to…", "Déplacer vers…", "移动至…"],
  ["الوظيفة: {0*}", "Job: {0}", "Poste : {0}", "职位：{0}"],
  ["تعذّر النقل وأُعيدت البطاقة: {0}", "The move failed and the card was put back: {0}", "Le déplacement a échoué et la carte a été remise : {0}", "移动失败，卡片已退回：{0}"],
  ["تعذّر الاتصال — أُعيدت البطاقة", "Could not connect — the card was put back", "Connexion impossible — la carte a été remise", "无法连接——卡片已退回"],
  ["كل الوظائف", "All jobs", "Tous les postes", "全部职位"],
  ["إضافة طلب تقديم", "Add an application", "Ajouter une candidature", "添加申请"],
  ["أُضيف الطلب في «جديد»", "The application was added to “New”", "La candidature a été ajoutée à « Nouveau »", "申请已添加至“新建”"],
  ["لا يُقبل طلب لمرشح بلا موافقة سارية. التعيين = اعتماد العرض، ولا يعتمده من أدخل الطلب أو اقترح العرض.", "No application is accepted for a candidate without valid consent. Hiring = approving the offer, and it is not approved by whoever entered the application or proposed the offer.", "Aucune candidature n'est acceptée pour un candidat sans consentement valide. Recrutement = approbation de l'offre, qui n'est pas approuvée par celui qui a saisi la candidature ou proposé l'offre.", "没有有效同意的候选人不接受申请。录用即批准录用意向，且不得由录入申请或提出意向的人批准。"],
  ["رجوع إلى اللوحة", "Back to the board", "Retour au tableau", "返回看板"],
  ["نقل الإقامة", "Residency transfer", "Transfert d'Iqama", "居留转移"],
  ["الانتقال", "Relocation", "Mobilité", "迁移意愿"],
  ["مدة الإشعار", "Notice period", "Préavis", "通知期"],
  ["المهارات", "Skills", "Compétences", "技能"],
  ["مستعد", "Willing", "Disposé", "愿意"],
  ["غير مستعد", "Not willing", "Non disposé", "不愿意"],
  ["{0} سنة", "{0} {0|year|years}", "{0} {0|an|ans}", "{0} 年"],
  ["سجل الموافقة", "Consent log", "Historique de consentement", "同意记录"],
  ["الصيغة", "Version", "Version", "版本"],
  ["السحب", "Withdrawal", "Retrait", "撤回"],
  ["سُحبت {0}", "Withdrawn {0}", "Retiré {0}", "已撤回 {0}"],
  ["سارية", "Valid", "En vigueur", "有效"],
  ["لا سجل موافقة", "No consent record", "Aucun historique de consentement", "无同意记录"],
  ["لا يدخل المطابقة ولا يُقبل له طلب تقديم.", "It does not enter matching and no application is accepted for it.", "Il n'entre pas dans la correspondance et aucune candidature n'est acceptée pour lui.", "不参与匹配，也不接受其申请。"],
  ["اختر الموعد", "Choose a time", "Choisissez un horaire", "请选择时间"],
  ["سُجّل الموعد (سجل داخلي، لم تُرسل رسالة)", "Time recorded (internal record, no message sent)", "Horaire enregistré (enregistrement interne, aucun message envoyé)", "已记录时间（内部记录，未发送消息）"],
  ["غيّر الموعد", "Change the time", "Modifier l'horaire", "更改时间"],
  ["حدّد الموعد", "Set the time", "Fixer l'horaire", "设定时间"],
  ["طلب مقابلة", "Request an interview", "Demander un entretien", "申请面试"],
  ["سُجّل طلب المقابلة (داخلي — لا رسالة)", "Interview request recorded (internal — no message)", "Demande d'entretien enregistrée (interne — aucun message)", "已记录面试申请（内部——不发送消息）"],
  ["وظيفة", "Job", "Poste", "职位"],
  ["إدخال", "Entry", "Saisie", "录入"],
  ["ملف المرشح", "Candidate profile", "Profil du candidat", "候选人档案"],
  ["طلبات التقديم", "Applications", "Candidatures", "申请记录"],
  ["لا طلبات تقديم بعد", "No applications yet", "Aucune candidature pour l'instant", "暂无申请"],
  ["أضف طلباً من لوحة المرشحين.", "Add one from the candidate board.", "Ajoutez-en une depuis le tableau des candidats.", "请在候选人看板中添加。"],
  ["المكوّن", "Component", "Critère", "评分项"],
  ["الوزن", "Weight", "Pondération", "权重"],
  ["الدرجة", "Score", "Note", "得分"],
  ["المساهمة", "Contribution", "Contribution", "贡献"],
  ["الشرح", "Explanation", "Explication", "说明"],
  ["شرح الدرجة", "Score explanation", "Explication de la note", "得分说明"],
  ["جارٍ المطابقة…", "Matching…", "Correspondance en cours…", "匹配中…"],
  ["طُوبق {0} مرشحاً بموافقة سارية. استُبعد من العملية: {1} بلا سجل موافقة و{2} سحبوا موافقتهم. الإصدار {3} — المجهول لا يستبعد أحداً.", "{0} candidates with valid consent were matched. Left out of the process: {1} with no consent record and {2} who withdrew their consent. Version {3} — unknown data never excludes anyone.", "{0} candidats avec consentement valide ont été comparés. Exclus du processus : {1} sans historique de consentement et {2} ayant retiré leur consentement. Version {3} — une donnée inconnue n'exclut personne.", "已匹配 {0} 位有有效同意的候选人。已排除：{1} 位无同意记录，{2} 位已撤回同意。版本 {3}——未知信息不会排除任何人。"],
  ["ينقصهم شرط إلزامي ({0}) — مفصولون عن النتائج ومعروضون للمراجعة", "Missing a mandatory requirement ({0}) — separated from the results and shown for review", "Il leur manque une exigence obligatoire ({0}) — séparés des résultats et présentés pour examen", "缺少必备条件（{0}）——与结果分开，供复核"],
  ["شغّل المطابقة", "Run matching", "Lancer la correspondance", "运行匹配"],
  ["مرشحون وهميون فقط. الدرجة موزونة ومشروحة مكوّناً مكوّناً؛ لا رقم غامض.", "Fictitious candidates only. The score is weighted and explained component by component; no opaque number.", "Candidats fictifs uniquement. La note est pondérée et expliquée critère par critère ; aucun chiffre opaque.", "仅限虚构候选人。得分按权重计算并逐项说明，没有来源不明的数字。"],
  // أعمدة تعرضها المطابقة من الخادم (أسماء المكوّنات)
  ["قابلية نقل الإقامة", "Iqama transferability", "Transférabilité de l'Iqama", "居留证可转移性"],
  ["الموقع", "Location", "Localisation", "地点"],
  ["التوفر", "Availability", "Disponibilité", "可到岗时间"],
  // ملاحظات المطابقة (الخادم)
  ["الوظيفة بلا مهنة محددة", "The job has no specified profession", "Le poste n'a pas de profession précisée", "职位未指定职业"],
  ["مهنة المرشح غير مسجّلة", "The candidate's profession is not recorded", "La profession du candidat n'est pas enregistrée", "未记录候选人的职业"],
  ["نفس المهنة: {0*}", "Same profession: {0}", "Même profession : {0}", "职业相同：{0}"],
  ["مهنة قريبة: {0*} (المطلوب {1*})", "Similar profession: {0} (required: {1})", "Profession proche : {0} (requise : {1})", "职业相近：{0}（要求：{1}）"],
  ["مهنة مختلفة: {0*} (المطلوب {1*})", "Different profession: {0} (required: {1})", "Profession différente : {0} (requise : {1})", "职业不同：{0}（要求：{1}）"],
  ["الوظيفة لا تشترط نقل إقامة", "The job does not require an Iqama transfer", "Le poste n'exige pas de transfert d'Iqama", "职位不要求转移居留证"],
  ["إقامة قابلة للنقل", "Transferable Iqama", "Iqama transférable", "居留证可转移"],
  ["إقامة غير قابلة للنقل", "Non-transferable Iqama", "Iqama non transférable", "居留证不可转移"],
  ["قابلية نقل الإقامة غير معروفة — اطلب التحقق", "Iqama transferability is unknown — ask for verification", "La transférabilité de l'Iqama est inconnue — demandez une vérification", "居留证可转移性未知——请要求核实"],
  ["الوظيفة لا تحدد خبرة دنيا", "The job does not set a minimum experience", "Le poste ne fixe pas d'expérience minimale", "职位未设最低经验要求"],
  ["سنوات الخبرة غير مسجّلة", "Years of experience are not recorded", "Les années d'expérience ne sont pas enregistrées", "未记录工作年限"],
  ["{0} سنة (المطلوب {1})", "{0} {0|year|years} (required: {1})", "{0} {0|an|ans} (requis : {1})", "{0} 年（要求：{1}）"],
  ["{0} سنة والمطلوب {1}", "{0} {0|year|years}, required {1}", "{0} {0|an|ans}, requis {1}", "{0} 年，要求 {1}"],
  ["لا تفضيل للجنسية", "No nationality preference", "Aucune préférence de nationalité", "无国籍偏好"],
  ["جنسية المرشح غير مسجّلة", "The candidate's nationality is not recorded", "La nationalité du candidat n'est pas enregistrée", "未记录候选人的国籍"],
  ["ضمن المفضّل: {0*}", "Within the preferred: {0}", "Parmi les préférées : {0}", "在偏好范围内：{0}"],
  ["{0*} خارج المفضّل ({1*})", "{0} is outside the preferred ({1})", "{0} hors des préférences ({1})", "{0} 不在偏好范围内（{1}）"],
  ["الوظيفة بلا مدينة محددة", "The job has no specified city", "Le poste n'a pas de ville précisée", "职位未指定城市"],
  ["مدينة المرشح غير مسجّلة", "The candidate's city is not recorded", "La ville du candidat n'est pas enregistrée", "未记录候选人的城市"],
  ["نفس المدينة ({0*})", "Same city ({0})", "Même ville ({0})", "城市相同（{0}）"],
  ["{0*} — مستعد للانتقال إلى {1*}", "{0} — willing to relocate to {1}", "{0} — disposé à déménager à {1}", "{0}——愿意迁往 {1}"],
  ["{0*} — غير مستعد للانتقال إلى {1*}", "{0} — not willing to relocate to {1}", "{0} — non disposé à déménager à {1}", "{0}——不愿迁往 {1}"],
  ["{0*} — الانتقال إلى {1*} يحتاج تأكيداً", "{0} — relocating to {1} needs confirmation", "{0} — le déménagement à {1} doit être confirmé", "{0}——迁往 {1} 需确认"],
  ["مدة الإشعار غير معروفة", "The notice period is unknown", "Le préavis est inconnu", "通知期未知"],
  ["متاح خلال {0} يوماً (المطلوب خلال {1})", "Available within {0} {0|day|days} (required within {1})", "Disponible sous {0} {0|jour|jours} (requis sous {1})", "{0} 天内可到岗（要求 {1} 天内）"],
  ["متاح خلال {0} يوماً والمطلوب خلال {1}", "Available within {0} {0|day|days}, required within {1}", "Disponible sous {0} {0|jour|jours}, requis sous {1}", "{0} 天内可到岗，要求 {1} 天内"],
  ["إشعار {0} يوماً", "Notice: {0} {0|day|days}", "Préavis : {0} {0|jour|jours}", "通知期 {0} 天"],
  ["الوظيفة بلا مهارات مطلوبة", "The job has no required skills", "Le poste n'exige aucune compétence", "职位未要求技能"],
  ["مهارات المرشح غير مسجّلة", "The candidate's skills are not recorded", "Les compétences du candidat ne sont pas enregistrées", "未记录候选人的技能"],
  ["تطابق {0} من {1}: {2*}", "Matched {0} of {1}: {2}", "{0} sur {1} correspondent : {2}", "匹配 {1} 项中的 {0} 项：{2}"],
  ["تطابق {0} من {1}", "Matched {0} of {1}", "{0} sur {1} correspondent", "匹配 {1} 项中的 {0} 项"],
  ["لا درجة: كل المكوّنات ناقصة أو غير مطلوبة", "No score: all components are missing or not required", "Pas de note : tous les critères sont manquants ou non requis", "无得分：所有评分项均缺失或无需求"],
  ["الدرجة {0} من 100 مبنية على {1}% من الأوزان", "Score {0} out of 100, based on {1}% of the weights", "Note {0} sur 100, fondée sur {1} % des pondérations", "得分 {0}/100，基于 {1}% 的权重"],
  ["غير معروف (لم يُحسب ولم يُستبعد به): {0}", "Unknown (not counted and not used to exclude): {0}", "Inconnu (non compté et non utilisé pour exclure) : {0}", "未知（未计入，也未据此排除）：{0}"],
  ["ينقصه شرط إلزامي: {0*}", "Missing a mandatory requirement: {0}", "Il lui manque une exigence obligatoire : {0}", "缺少必备条件：{0}"],
  ["شرط إلزامي بيانه ناقص: {0*}", "Mandatory requirement with incomplete data: {0}", "Exigence obligatoire dont les données sont incomplètes : {0}", "必备条件的数据不完整：{0}"],

  // ---- مكاتب الاستقدام (المشغّل) ---------------------------------------------------------------------
  ["قيد الاعتماد", "Pending approval", "En attente d'approbation", "待批准"],
  ["معتمد", "Approved", "Approuvé", "已批准"],
  ["موقوف", "Suspended", "Suspendu", "已暂停"],
  ["مقدَّم", "Submitted", "Présenté", "已提交"],
  ["مقبول", "Accepted", "Accepté", "已接受"],
  ["نهائي", "Final", "Final", "终态"],
  ["اسم المكتب (وهمي)", "Agency name (fictitious)", "Nom de l'agence (fictif)", "机构名称（虚构）"],
  ["بريد دخول تجريبي: x@shr.invalid", "Demo sign-in email: x@shr.invalid", "E-mail de connexion démo : x@shr.invalid", "演示登录邮箱：x@shr.invalid"],
  ["تسجيل مكتب جديد", "Register a new agency", "Enregistrer une nouvelle agence", "登记新机构"],
  ["سُجّل المكتب «قيد الاعتماد» — لا دخول قبل اعتماد مستخدم آخر", "The agency was registered as “Pending approval” — no access until another user approves it", "L'agence est enregistrée « En attente d'approbation » — pas d'accès avant l'approbation d'un autre utilisateur", "机构已登记为“待批准”——须由另一位用户批准后才能登录"],
  ["من سجّل المكتب لا يعتمده. المكتب لا يدخل ولا يستلم أوامر قبل الاعتماد. بريد حقيقي غير مقبول في هذه المرحلة.", "Whoever registered the agency does not approve it. An agency cannot sign in or receive orders before approval. Real emails are not accepted at this stage.", "Celui qui enregistre l'agence ne l'approuve pas. Une agence ne peut ni se connecter ni recevoir d'ordres avant approbation. Les e-mails réels ne sont pas acceptés à ce stade.", "登记机构的人不能批准该机构。机构获批前不能登录，也不能接收订单。此阶段不接受真实邮箱。"],
  ["المرجع", "Reference", "Référence", "编号"],
  ["المكتب", "Agency", "Agence", "机构"],
  ["أوامر", "Orders", "Ordres", "订单"],
  ["مرشحون", "Candidates", "Candidats", "候选人"],
  ["اعتُمد المكتب", "Agency approved", "Agence approuvée", "机构已批准"],
  ["أُوقف المكتب", "Agency suspended", "Agence suspendue", "机构已暂停"],
  ["إيقاف", "Suspend", "Suspendre", "暂停"],
  ["لا مكاتب بعد", "No agencies yet", "Aucune agence pour l'instant", "暂无机构"],
  ["سجّل أول مكتب من النموذج أعلاه.", "Register the first agency using the form above.", "Enregistrez la première agence avec le formulaire ci-dessus.", "请使用上方表单登记第一个机构。"],
  ["الوجهة…", "Destination…", "Destination…", "目标…"],
  ["مفتوح لكل المكاتب المعتمدة", "Open to all approved agencies", "Ouvert à toutes les agences approuvées", "向所有已批准机构开放"],
  ["توجيه للمكتب (يراه المكتب)", "Brief for the agency (the agency sees it)", "Consigne pour l'agence (visible par l'agence)", "给机构的说明（机构可见）"],
  ["أمر استقدام جديد", "New recruitment order", "Nouvel ordre de recrutement", "新建招聘订单"],
  ["أُنشئ الأمر", "Order created", "Ordre créé", "订单已创建"],
  ["أُنشئ الأمر — تنبيه: فحص قيود التأشيرات معلَّق بقرار المالك", "Order created — Notice: the visa-restriction check is on hold by the owner's decision", "Ordre créé — Avertissement : le contrôle des restrictions de visa est suspendu sur décision du propriétaire", "订单已创建——提示：签证限制检查已按所有者决定暂缓"],
  ["الأمر الموجَّه يراه مكتبه وحده؛ المفتوح يراه كل مكتب معتمد. المكتب يرى المهنة والكمية والتوجيه فقط: لا عميل ولا سعر.", "A directed order is seen only by its agency; an open one is seen by every approved agency. The agency sees only the profession, quantity and brief: no client, no price.", "Un ordre dirigé n'est vu que par son agence ; un ordre ouvert est vu par toutes les agences approuvées. L'agence ne voit que la profession, la quantité et la consigne : ni client, ni prix.", "定向订单仅对应机构可见；开放订单所有已批准机构均可见。机构只能看到职业、数量和说明：看不到客户，也看不到价格。"],
  ["الكمية", "Quantity", "Quantité", "数量"],
  ["الوجهة", "Destination", "Destination", "目标"],
  ["العميل (داخلي)", "Client (internal)", "Client (interne)", "客户（内部）"],
  ["مقدَّم / مقبول", "Submitted / accepted", "Présentés / acceptés", "已推荐 / 已接受"],
  ["مفتوح", "Open", "Ouvert", "开放"],
  ["ما يراه صاحب العمل", "What the employer sees", "Ce que voit l'employeur", "雇主所见内容"],
  ["الخبرة", "Experience", "Expérience", "经验"],
  ["لا أوامر بعد", "No orders yet", "Aucun ordre pour l'instant", "暂无订单"],
  ["أنشئ أول أمر من النموذج أعلاه.", "Create the first order using the form above.", "Créez le premier ordre avec le formulaire ci-dessus.", "请使用上方表单创建第一个订单。"],
  ["المصدر: {0*}. اسم المكتب وبلده ومعرّفه لا تظهر لصاحب العمل أبداً.", "Source: {0}. The agency's name, country and identifier are never shown to the employer.", "Source : {0}. Le nom, le pays et l'identifiant de l'agence ne sont jamais montrés à l'employeur.", "来源：{0}。机构的名称、国家和标识绝不会向雇主显示。"],
  ["عبر شريك", "Via a partner", "Via un partenaire", "经合作伙伴"],
  ["لا مرشحين مقدَّمين بعد", "No submitted candidates yet", "Aucun candidat présenté pour l'instant", "暂无已推荐候选人"],
  ["يظهر هنا من يقدّمه المكتب على هذا الأمر.", "Candidates the agency submits for this order appear here.", "Les candidats présentés par l'agence pour cet ordre apparaissent ici.", "机构就此订单推荐的候选人将显示在这里。"],
  ["كل الحالات", "All statuses", "Tous les statuts", "全部状态"],
  ["نوع المقابلة", "Interview type", "Type d'entretien", "面试类型"],
  ["ملاحظة داخلية", "Internal note", "Note interne", "内部备注"],
  ["نص للمكتب (اختياري)", "Text for the agency (optional)", "Texte pour l'agence (facultatif)", "给机构的文字（可选）"],
  ["تكرار بين مكاتب: {0*}", "Duplicate across agencies: {0}", "Doublon entre agences : {0}", "跨机构重复：{0}"],
  ["المرشح", "Candidate", "Candidat", "候选人"],
  ["الأمر", "Order", "Ordre", "订单"],
  ["المرشحون المقدَّمون من المكاتب", "Candidates submitted by agencies", "Candidats présentés par les agences", "机构推荐的候选人"],
  ["مواصفات فقط: لا هوية ولا هاتف ولا بريد. مراحل المراجعة داخلية ولا يراها المكتب (يرى «مستلم / مقابلة / مقبول / غير مختار»).", "Profiles only: no ID, phone or email. Review stages are internal and the agency does not see them (it sees “Received / Interview / Accepted / Not selected”).", "Profils uniquement : ni identité, ni téléphone, ni e-mail. Les étapes d'examen sont internes et l'agence ne les voit pas (elle voit « Reçu / Entretien / Accepté / Non retenu »).", "仅含条件资料：无证件、电话或邮箱。审核阶段为内部使用，机构看不到（机构只看到“已接收 / 面试 / 已接受 / 未入选”）。"],
  ["لا مرشحين", "No candidates", "Aucun candidat", "暂无候选人"],
  ["تظهر هنا مرشحات المكاتب عند تقديمها.", "Agency candidates appear here once they are submitted.", "Les candidats des agences apparaissent ici une fois présentés.", "机构候选人提交后将显示在这里。"],

  // ---- منظور المكتب --------------------------------------------------------------------------------
  ["مستلم", "Received", "Reçu", "已接收"],
  ["غير مختار", "Not selected", "Non retenu", "未入选"],
  ["طلباتي", "My requests", "Mes demandes", "我的请求"],
  ["تقديم مرشح", "Submit a candidate", "Présenter un candidat", "推荐候选人"],
  ["استيراد جماعي", "Bulk import", "Import groupé", "批量导入"],
  ["مقابلاتي", "My interviews", "Mes entretiens", "我的面试"],
  ["الأوامر الموجّهة إليكم والمفتوحة، ومرشحوكم عليها.", "The orders directed to you and the open ones, and your candidates on them.", "Les ordres qui vous sont adressés et les ordres ouverts, ainsi que vos candidats.", "指派给您的订单和开放订单，以及您在其上推荐的候选人。"],
  ["قدّم مرشحاً على أمر مفتوح بمواصفاته فقط.", "Submit a candidate on an open order by profile only.", "Présentez un candidat sur un ordre ouvert, profil uniquement.", "仅凭条件资料，为开放订单推荐候选人。"],
  ["ارفع قائمة مرشحين دفعة واحدة؛ يُبلَّغ كل صف فاسد برقم سطره.", "Upload a list of candidates in one go; each invalid row is reported with its line number.", "Téléversez une liste de candidats en une fois ; chaque ligne invalide est signalée avec son numéro.", "一次上传候选人名单；无效行会按行号提示。"],
  ["مقابلات مرشحيكم ومواعيدها.", "Your candidates' interviews and their times.", "Les entretiens de vos candidats et leurs horaires.", "您的候选人的面试及时间。"],
  ["اختر الأمر…", "Choose the order…", "Choisissez l'ordre…", "请选择订单…"],
  ["المرشح", "Candidate", "Candidat", "候选人"],
  ["المقابلة", "Interview", "Entretien", "面试"],
  ["الجنسية المفضلة", "Preferred nationality", "Nationalité préférée", "偏好国籍"],
  ["التوجيه", "Brief", "Consigne", "说明"],
  ["الموعد", "Date", "Date", "日期"],
  ["مرشحوني", "My candidates", "Mes candidats", "我的候选人"],
  ["موجّه إليكم", "Directed to you", "Qui vous est adressé", "指派给您"],
  ["قدّم مرشحاً", "Submit a candidate", "Présenter un candidat", "推荐候选人"],
  ["مغلق", "Closed", "Clôturé", "已关闭"],
  ["الأوامر الموجّهة إليكم والمفتوحة", "Orders directed to you and open orders", "Ordres qui vous sont adressés et ordres ouverts", "指派给您的订单和开放订单"],
  ["لا أوامر حالياً", "No orders at the moment", "Aucun ordre pour le moment", "目前没有订单"],
  ["تظهر هنا الأوامر الموجّهة إليكم والمفتوحة.", "Orders directed to you and open orders appear here.", "Les ordres qui vous sont adressés et les ordres ouverts apparaissent ici.", "指派给您的订单和开放订单将显示在这里。"],
  ["مرشحوكم", "Your candidates", "Vos candidats", "您的候选人"],
  ["لم تقدّموا مرشحين بعد.", "You have not submitted any candidates yet.", "Vous n'avez encore présenté aucun candidat.", "您尚未推荐任何候选人。"],
  ["الاسم (وهمي)", "Name (fictitious)", "Nom (fictif)", "姓名（虚构）"],
  ["مهارات بفاصلة", "Skills, comma-separated", "Compétences, séparées par des virgules", "技能（逗号分隔）"],
  ["رقم هوية وهمي (اختياري — يُحفظ بصمةً فقط)", "Fictitious ID number (optional — stored as a hash only)", "Numéro d'identité fictif (facultatif — conservé uniquement sous forme d'empreinte)", "虚构证件号（可选——仅以哈希值保存）"],
  ["قُدّم المرشح ({0})", "Candidate submitted ({0})", "Candidat présenté ({0})", "已推荐候选人（{0}）"],
  ["تقديم@button", "Submit", "Présenter", "提交"],
  ["مواصفات المرشح", "Candidate profile details", "Caractéristiques du candidat", "候选人条件"],
  ["مواصفات فقط في هذه المرحلة: لا هاتف ولا بريد ولا رقم هوية حقيقي. التكرار على الأمر نفسه يُرفض.", "Profile details only at this stage: no phone, email or real ID number. A duplicate on the same order is rejected.", "Caractéristiques uniquement à ce stade : ni téléphone, ni e-mail, ni numéro d'identité réel. Un doublon sur le même ordre est refusé.", "此阶段仅填写条件资料：不填电话、邮箱或真实证件号。同一订单上的重复推荐会被拒绝。"],
  ["الاسم,المهنة,الجنسية,سنوات الخبرة,رقم وهمي\nمرشح تجريبي (وهمي),سائق,الفلبين,4,DEMO-1", "Name,Profession,Nationality,Years of experience,Fictitious number\nDemo candidate (fictitious),Driver,Philippines,4,DEMO-1", "Nom,Profession,Nationalité,Années d'expérience,Numéro fictif\nCandidat démo (fictif),Chauffeur,Philippines,4,DEMO-1", "姓名,职业,国籍,工作年限,虚构编号\n演示候选人（虚构）,司机,菲律宾,4,DEMO-1"],
  ["أُنشئ {0} · متجاوَز {1}", "Created {0} · Skipped {1}", "Créés {0} · Ignorés {1}", "已创建 {0} · 已跳过 {1}"],
  ["لا أخطاء.", "No errors.", "Aucune erreur.", "无错误。"],
  ["استيراد", "Import", "Importer", "导入"],
  ["قائمة مرشحين (حتى 60 صفاً)", "List of candidates (up to 60 rows)", "Liste de candidats (jusqu'à 60 lignes)", "候选人名单（最多 60 行）"],
  ["الأعمدة: الاسم، المهنة، الجنسية، سنوات الخبرة، رقم هوية وهمي (اختياري). الصف الفاسد يُبلَّغ برقم سطره ولا يوقف الباقي. أعمدة الهاتف والبريد مرفوضة.", "Columns: name, profession, nationality, years of experience, fictitious ID number (optional). An invalid row is reported with its line number and does not stop the rest. Phone and email columns are rejected.", "Colonnes : nom, profession, nationalité, années d'expérience, numéro d'identité fictif (facultatif). Une ligne invalide est signalée avec son numéro et n'arrête pas les autres. Les colonnes téléphone et e-mail sont refusées.", "列：姓名、职业、国籍、工作年限、虚构证件号（可选）。无效行会按行号提示，不影响其余行。电话和邮箱列会被拒绝。"],
  ["المكان", "Place", "Lieu", "地点"],
  ["ملاحظة", "Note", "Note", "备注"],
  ["لا مقابلات بعد", "No interviews yet", "Aucun entretien pour l'instant", "暂无面试"],
  ["تظهر المقابلات هنا حين تُطلب.", "Interviews appear here when they are requested.", "Les entretiens apparaissent ici lorsqu'ils sont demandés.", "面试申请后将显示在这里。"],

  // ---- بوابة العميل ---------------------------------------------------------------------------------------
  ["عمالي", "My workers", "Mes travailleurs", "我的工人"],
  ["عقودي", "My contracts", "Mes contrats", "我的合同"],
  ["الفواتير", "Invoices", "Factures", "发票"],
  ["سارية", "Valid", "En vigueur", "有效"],
  ["قريبة الانتهاء", "Expiring soon", "Bientôt expirée", "即将到期"],
  ["منتهية", "Expired", "Expirée", "已过期"],
  ["سارٍ — بلا تاريخ انتهاء", "Valid — no expiry date", "Valide — sans date d'expiration", "有效——无到期日"],
  ["غير مرفوعة", "Not uploaded", "Non téléversé", "未上传"],
  ["المستندات سليمة", "Documents in order", "Documents en règle", "文件正常"],
  ["مستند قريب الانتهاء", "A document expires soon", "Un document expire bientôt", "有文件即将到期"],
  ["مستند منتهٍ", "A document has expired", "Un document a expiré", "有文件已过期"],
  ["مستند غير مرفوع", "A document is not uploaded", "Un document n'est pas téléversé", "有文件未上传"],
  ["ملخص سريع لعمالكم وعقودكم وطلباتكم ومستنداتكم.", "A quick summary of your workers, contracts, requests and documents.", "Un résumé rapide de vos travailleurs, contrats, demandes et documents.", "您的工人、合同、请求和文件的简要概览。"],
  ["العمال المُسندون إليكم وحالة مستندات كل منهم.", "The workers assigned to you and the document status of each.", "Les travailleurs qui vous sont affectés et l'état des documents de chacun.", "派驻给您的工人及其各自的文件状态。"],
  ["بيانات العامل ومستنداته وقوائمه، للاطلاع فقط.", "The worker's details, documents and checklists, view only.", "Les données du travailleur, ses documents et ses listes, en consultation seule.", "工人的资料、文件和清单，仅供查看。"],
  ["عقودكم السارية: الفترة والنسخة وعدد العمال.", "Your active contracts: period, version and number of workers.", "Vos contrats en vigueur : période, version et nombre de travailleurs.", "您当前有效的合同：期限、版本和工人数量。"],
  ["أرسل طلباً جديداً وتابع حالة طلباتكم السابقة.", "Send a new request and follow the status of your previous ones.", "Envoyez une nouvelle demande et suivez l'état de vos demandes précédentes.", "提交新请求，并跟踪您以往请求的状态。"],
  ["فواتيركم تظهر هنا عند إصدارها.", "Your invoices appear here once issued.", "Vos factures apparaissent ici dès leur émission.", "发票开具后将显示在这里。"],
  ["عمال مُسندون إليكم", "Workers assigned to you", "Travailleurs qui vous sont affectés", "派驻给您的工人"],
  ["عقود سارية", "Active contracts", "Contrats en vigueur", "有效合同"],
  ["مستندات قريبة الانتهاء ({0} يوماً)", "Documents expiring soon ({0} {0|day|days})", "Documents bientôt expirés ({0} {0|jour|jours})", "即将到期的文件（{0} 天）"],
  ["تُعرض هنا بياناتكم أنتم فقط. لا أرقام تُعرض إلا من بيانات مسجّلة فعلاً.", "Only your own data is shown here. No figure is shown unless it comes from data actually recorded.", "Seules vos propres données sont affichées ici. Aucun chiffre n'est affiché s'il ne provient pas de données réellement enregistrées.", "此处仅显示您自己的数据。只有来自已实际记录数据的数字才会显示。"],
  ["المستندات", "Documents", "Documents", "文件"],
  ["لا عمال مُسندون إليكم حالياً", "No workers are assigned to you at the moment", "Aucun travailleur ne vous est affecté pour le moment", "目前没有派驻给您的工人"],
  ["ستظهر هنا أسماء العمال بعد إسنادهم وتفعيلهم.", "Workers' names appear here once they are assigned and activated.", "Les noms des travailleurs apparaîtront ici une fois affectés et activés.", "工人被派驻并启用后，姓名将显示在这里。"],
  ["البيانات", "Details", "Données", "资料"],
  ["الإسناد: {0}", "Assignment: {0}", "Affectation : {0}", "派驻：{0}"],
  ["من {0} إلى {1}", "From {0} to {1}", "Du {0} au {1}", "自 {0} 至 {1}"],
  ["من {0}", "From {0}", "Du {0}", "自 {0}"],
  ["اكتملت البنود المطلوبة.", "The required items are complete.", "Les points obligatoires sont complétés.", "必填项已全部完成。"],
  ["بنود مطلوبة لم تكتمل بعد.", "Some required items are not yet complete.", "Certains points obligatoires ne sont pas encore complétés.", "仍有必填项未完成。"],
  ["النسخة", "Version", "Version", "版本"],
  ["من", "From", "De", "自"],
  ["إلى", "To", "À", "至"],
  ["العمال", "Workers", "Travailleurs", "工人"],
  ["ساري", "Valid", "En vigueur", "有效"],
  ["منتهي المدة", "Term ended", "Échu", "已到期"],
  ["لا عقود سارية", "No active contracts", "Aucun contrat en vigueur", "没有有效合同"],
  ["تظهر هنا العقود المعتمدة السارية فقط.", "Only approved, active contracts appear here.", "Seuls les contrats approuvés et en vigueur apparaissent ici.", "这里只显示已批准且有效的合同。"],
  ["ملخص العقد: الفترة والنسخة. المسودات وما قيد الاعتماد لا تظهر.", "Contract summary: period and version. Drafts and contracts pending approval are not shown.", "Résumé du contrat : période et version. Les brouillons et les contrats en attente d'approbation ne sont pas affichés.", "合同摘要：期限和版本。草稿及待批准的合同不会显示。"],
  ["وصف الطلب (حتى 500 حرف)", "Request description (up to 500 characters)", "Description de la demande (jusqu'à 500 caractères)", "请求描述（最多 500 字）"],
  ["المهنة (لطلب توظيف)", "Profession (for a hiring request)", "Profession (pour une demande d'embauche)", "职业（用于招聘请求）"],
  ["العدد", "Number", "Nombre", "数量"],
  ["العامل المعنيّ…", "Worker concerned…", "Travailleur concerné…", "涉及的工人…"],
  ["طلب جديد", "New request", "Nouvelle demande", "新请求"],
  ["سُجّل الطلب — يراجعه فريق Business Partner", "Request recorded — the Business Partner team will review it", "Demande enregistrée — l'équipe Business Partner l'examinera", "请求已记录——Business Partner 团队将进行审核"],
  ["إرسال الطلب", "Send the request", "Envoyer la demande", "发送请求"],
  ["حالة الطلب يغيّرها فريق التشغيل وحده. هذا نموذج تجريبي: لا يُرسل شيء إلى أحد خارج النظام.", "Only the operations team changes a request's status. This is a demo form: nothing is sent to anyone outside the system.", "Seule l'équipe d'exploitation modifie le statut d'une demande. Ceci est un formulaire de démonstration : rien n'est envoyé à quiconque hors du système.", "请求状态仅由运营团队更改。这是演示表单：不会向系统外的任何人发送内容。"],
  ["هذا الحساب للقراءة فقط: لا يقدّم طلبات.", "This account is read-only: it cannot submit requests.", "Ce compte est en lecture seule : il ne peut pas soumettre de demandes.", "此账户为只读：无法提交请求。"],
  ["الوصف", "Description", "Description", "描述"],
  ["· العدد {0}", "· Quantity {0}", "· Quantité {0}", "· 数量 {0}"],
  ["لا طلبات بعد", "No requests yet", "Aucune demande pour l'instant", "暂无请求"],
  ["تظهر هنا طلبات شركتكم عند إرسالها.", "Your company's requests appear here once sent.", "Les demandes de votre société apparaissent ici une fois envoyées.", "贵公司的请求发送后将显示在这里。"],
  ["لا فواتير للعرض", "No invoices to show", "Aucune facture à afficher", "没有可显示的发票"],
  ["تصدرها فرق Business Partner بعد الاعتماد", "Issued by the Business Partner teams after approval", "Émises par les équipes Business Partner après approbation", "由 Business Partner 团队在批准后开具"],
  ["جاهزية مستندات العامل (للعميل — تجريبية)", "Worker document readiness (for the client — demo)", "Préparation des documents du travailleur (pour le client — démo)", "工人文件就绪情况（客户用——演示）"],
  ["الإقامة سارية", "Iqama is valid", "L'Iqama est valide", "居留证有效"],
  ["عقد العمل موقّع", "Work contract is signed", "Le contrat de travail est signé", "劳动合同已签署"],
  ["التأمين الطبي ساري", "Medical insurance is valid", "L'assurance maladie est valide", "医疗保险有效"],

  // ---- بوابة العامل -------------------------------------------------------------------------------------
  ["دخول عامل", "Worker sign-in", "Connexion travailleur", "工人登录"],
  ["بوابة العامل — دخول تجريبي", "Worker portal — demo sign-in", "Espace travailleur — connexion démo", "工人门户——演示登录"],
  ["دخول محلي ببيانات وهمية بدور عامل. العامل يرى بياناته هو فقط.", "Local sign-in with fictitious data in the worker role. A worker sees only their own data.", "Connexion locale avec des données fictives dans le rôle travailleur. Le travailleur ne voit que ses propres données.", "以工人角色使用虚构数据进行本地登录。工人只能看到自己的数据。"],
  ["عامل لدى العميل أ (إقامته قريبة الانتهاء)", "Worker at client A (residence permit expiring soon)", "Travailleur chez le client A (Iqama bientôt expirée)", "客户 A 的工人（居留证即将到期）"],
  ["عامل لدى العميل ب (تأمينه منتهٍ)", "Worker at client B (insurance expired)", "Travailleur chez le client B (assurance expirée)", "客户 B 的工人（保险已过期）"],
  ["عامل المستأجر الآخر (اختر المستأجر الآخر)", "Other tenant's worker (choose the other tenant)", "Travailleur de l'autre tenant (choisissez l'autre tenant)", "另一租户的工人（请选择另一租户）"],
  ["منظور العامل", "Worker view", "Vue travailleur", "工人视角"],
  ["بوابة العامل", "Worker portal", "Espace travailleur", "工人门户"],
  ["بياناتي", "My details", "Mes données", "我的资料"],
  ["عقدي", "My contract", "Mon contrat", "我的合同"],
  ["مستنداتي", "My documents", "Mes documents", "我的文件"],
  ["راتبي", "My pay", "Ma rémunération", "我的薪资"],
  ["بياناتك الأساسية والعميل المسند إليه، للاطلاع فقط.", "Your basic details and the client you are assigned to, view only.", "Vos données de base et le client auquel vous êtes affecté, en consultation seule.", "您的基本资料和您被派驻的客户，仅供查看。"],
  ["ملخص عقد عملك: النوع وتاريخ البدء.", "A summary of your work contract: type and start date.", "Résumé de votre contrat de travail : type et date de début.", "您的劳动合同概要：类型和开始日期。"],
  ["إقامتك وتأمينك الطبي وعقد عملك: الحالة وتاريخ الانتهاء.", "Your residence permit, medical insurance and work contract: status and expiry date.", "Votre Iqama, votre assurance maladie et votre contrat de travail : statut et date d'expiration.", "您的居留证、医疗保险和劳动合同：状态和到期日。"],
  ["كشف راتبك يظهر هنا عند إصداره.", "Your pay statement appears here once issued.", "Votre fiche de paie apparaîtra ici dès son émission.", "您的工资单开具后将显示在这里。"],
  ["أرسل طلباً محدداً وتابع حالة طلباتك السابقة.", "Send a specific request and follow the status of your previous ones.", "Envoyez une demande précise et suivez l'état de vos demandes précédentes.", "提交具体请求，并跟踪您以往请求的状态。"],
  ["راجع صفحة «مستنداتي» لمعرفة التفاصيل.", "See the “My documents” page for details.", "Consultez la page « Mes documents » pour les détails.", "详情请查看“我的文件”页面。"],
  ["نوع الهوية", "ID type", "Type de pièce d'identité", "证件类型"],
  ["إقامة", "Iqama", "Iqama", "居留证"],
  ["هوية وطنية", "National ID", "Carte d'identité nationale", "国民身份证"],
  ["رقم حدود", "Border number", "Numéro de frontière", "边境号"],
  ["العميل المستفيد", "Beneficiary client", "Client bénéficiaire", "受益客户"],
  ["تاريخ البدء", "Start date", "Date de début", "开始日期"],
  ["لا إسناد حالي", "No current assignment", "Aucune affectation en cours", "目前没有派驻"],
  ["يظهر هنا العميل المسند إليه بعد الإسناد.", "The client you are assigned to appears here once assigned.", "Le client auquel vous êtes affecté apparaîtra ici après l'affectation.", "派驻后，您被派驻的客户将显示在这里。"],
  ["تُعرض هنا بياناتك أنت فقط. لا تُعرض أرقام الهوية ولا الجوال ولا الآيبان في هذه النسخة التجريبية.", "Only your own data is shown here. ID numbers, mobile numbers and IBANs are not shown in this demo version.", "Seules vos propres données sont affichées ici. Les numéros d'identité, de téléphone et les IBAN ne sont pas affichés dans cette version de démonstration.", "这里只显示您本人的数据。此演示版本不显示证件号码、手机号码和 IBAN。"],
  ["عقد عمل", "Work contract", "Contrat de travail", "劳动合同"],
  ["لا عقد عمل ساري للعرض", "No active work contract to show", "Aucun contrat de travail en vigueur à afficher", "没有可显示的有效劳动合同"],
  ["يظهر هنا ملخص عقد عملك بعد توثيقه واعتماده.", "A summary of your work contract appears here once it is documented and approved.", "Le résumé de votre contrat de travail apparaîtra ici une fois documenté et approuvé.", "劳动合同经存档和批准后，概要将显示在这里。"],
  ["ملخص العقد: النوع وتاريخ البدء. المسودات وما قيد الاعتماد لا تظهر.", "Contract summary: type and start date. Drafts and contracts pending approval are not shown.", "Résumé du contrat : type et date de début. Les brouillons et les contrats en attente d'approbation ne sont pas affichés.", "合同概要：类型和开始日期。草稿和待批准的合同不会显示。"],
  ["«قريبة الانتهاء» تعني أن المستند ينتهي خلال {0} يوماً.", "“Expiring soon” means the document expires within {0} {0|day|days}.", "« Bientôt expirée » signifie que le document expire dans les {0} {0|jour|jours}.", "“即将到期”表示文件将在 {0} 天内到期。"],
  ["لا كشف راتب للعرض", "No pay statement to show", "Aucune fiche de paie à afficher", "没有可显示的工资单"],
  ["يصدر كشف الراتب من فرق Business Partner بعد الاعتماد", "The pay statement is issued by the Business Partner teams after approval", "La fiche de paie est émise par les équipes Business Partner après approbation", "工资单由 Business Partner 团队在批准后开具"],
  ["الموضوع…", "Topic…", "Sujet…", "主题…"],
  ["طلب مستند", "Document request", "Demande de document", "文件请求"],
  ["تحديث بيان", "Update of details", "Mise à jour des données", "更新资料"],
  ["استفسار", "Inquiry", "Demande de renseignements", "咨询"],
  ["طلب مستند (من عامل)", "Document request (from a worker)", "Demande de document (d'un travailleur)", "文件请求（来自工人）"],
  ["تحديث بيان (من عامل)", "Update of details (from a worker)", "Mise à jour des données (d'un travailleur)", "更新资料（来自工人）"],
  ["استفسار (من عامل)", "Inquiry (from a worker)", "Demande de renseignements (d'un travailleur)", "咨询（来自工人）"],
  ["البيانات الشخصية", "Personal data", "Données personnelles", "个人资料"],
  ["بيانات التواصل", "Contact details", "Coordonnées", "联系方式"],
  ["خطاب تعريف بالعمل", "Employment letter", "Attestation de travail", "在职证明"],
  ["العقد", "Contract", "Contrat", "合同"],
  ["كشف الراتب", "Pay statement", "Fiche de paie", "工资单"],

  // ---- الامتثال ---------------------------------------------------------------------------------------------------
  ["غير معروفة", "Unknown", "Inconnue", "未知"],
  ["نظيفة", "Clear", "Sans restriction", "无限制"],
  ["مقيّدة", "Restricted", "Restreint", "受限"],
  ["اشتباه", "Suspected", "Suspicion", "疑似"],
  ["عامل فعلي", "Actual worker", "Travailleur effectif", "实际工人"],
  ["ليس عاملاً", "Not a worker", "N'est pas un travailleur", "非工人"],
  ["يعمل لدى جهة أخرى", "Works for another party", "Travaille pour une autre partie", "受雇于其他单位"],
  ["غير مسدّدة", "Unpaid", "Impayée", "未缴付"],
  ["مسدّدة", "Paid", "Payée", "已缴付"],
  ["بانتظار الموافقة", "Awaiting approval", "En attente d'approbation", "待批准"],
  ["موافَق", "Approved", "Approuvé", "已批准"],
  ["مرفوع", "Uploaded", "Téléversé", "已上传"],
  ["مطابَق", "Matched", "Rapproché", "已匹配"],
  ["روجع", "Reviewed", "Révisé", "已复核"],
  ["مطبَّق", "Applied", "Appliqué", "已应用"],
  ["مطابقة", "Match", "Rapprochement", "匹配"],
  ["حماية أجور", "Wage protection", "Protection des salaires", "工资保护"],
  ["تأمينات", "Social insurance (GOSI)", "Assurances sociales (GOSI)", "社会保险（GOSI）"],
  ["مستند ينتهي قريباً", "Document expiring soon", "Document bientôt expiré", "文件即将到期"],
  ["موعد اعتراض تقديري قريب", "Estimated objection deadline approaching", "Échéance d'opposition estimative proche", "预估异议期限临近"],
  ["موعد اعتراض تقديري مضى", "Estimated objection deadline passed", "Échéance d'opposition estimative dépassée", "预估异议期限已过"],
  ["تاريخ التبليغ غير مُدخل", "Notification date not entered", "Date de notification non saisie", "未录入送达日期"],
  ["منشأة محجوبة", "Blocked establishment", "Établissement bloqué", "被限制的企业"],
  ["حالة القيد غير معروفة", "Restriction status unknown", "Statut de restriction inconnu", "限制状态未知"],
  ["لقطة غير متحقَّق منها", "Unverified snapshot", "Instantané non vérifié", "未核实的快照"],
  ["قائمة A33 غير مكتملة", "Incomplete A33 list", "Liste A33 incomplète", "A33 名单未完成"],
  ["عالية", "High", "Élevée", "高"],
  ["متوسطة", "Medium", "Moyenne", "中"],
  ["منخفضة", "Low", "Faible", "低"],
  ["لا نضمن إلغاء المخالفة. المبالغ والمواعيد تقديرية، تُؤكَّد من بوابة الجهة قبل الاعتماد عليها، ومصدر كل رقم ظاهر بجانبه.", "We do not guarantee that a violation will be cancelled. Amounts and dates are estimates, to be confirmed on the authority's portal before relying on them, and the source of each figure is shown beside it.", "Nous ne garantissons pas l'annulation d'une infraction. Les montants et les dates sont des estimations, à confirmer sur le portail de l'autorité avant de s'y fier, et la source de chaque chiffre est indiquée à côté.", "我们不保证违规记录能够被撤销。金额和期限均为预估，使用前须在主管机构门户核实，每个数字的来源均显示在旁边。"],
  ["عبارات المرجع النظامي المعروضة بلغة غير العربية ترجمة عمل غير رسمية؛ النص العربي هو المرجع.", "Regulatory reference wording shown in a language other than Arabic is an unofficial working translation; the Arabic text is the reference.", "Les formulations du référentiel réglementaire affichées dans une autre langue que l'arabe sont une traduction de travail non officielle ; le texte arabe fait foi.", "以非阿拉伯语显示的法规参考措辞为非正式的工作译文；以阿拉伯语原文为准。"],
  ["تقدير: {0*}", "Estimate: {0}", "Estimation : {0}", "预估：{0}"],
  ["تقديري", "Estimate", "Estimation", "预估"],
  ["غير مؤكد من المصدر", "Not confirmed from the source", "Non confirmé par la source", "来源未确认"],
  ["المصدر: {0*}", "Source: {0}", "Source : {0}", "来源：{0}"],
  ["منشآت", "Establishments", "Établissements", "企业"],
  ["محجوبة (مقيّدة/اشتباه)", "Blocked (restricted/suspected)", "Bloquées (restreintes/suspectées)", "被限制（受限/疑似）"],
  ["حالتها غير معروفة", "Status unknown", "Statut inconnu", "状态未知"],
  ["مخالفات مفتوحة", "Open violations", "Infractions ouvertes", "未结违规"],
  ["مستندات تنتهي قريباً", "Documents expiring soon", "Documents bientôt expirés", "即将到期的文件"],
  ["المنشأة", "Establishment", "Établissement", "企业"],
  ["حالة القيد", "Restriction status", "Statut de restriction", "限制状态"],
  ["النطاق المعلن / التقدير", "Declared band / estimate", "Bande déclarée / estimation", "申报档位 / 预估"],
  ["مخالفات", "Violations", "Infractions", "违规"],
  ["أقرب موعد تقديري", "Nearest estimated deadline", "Échéance estimative la plus proche", "最近的预估期限"],
  ["غير متحقَّق", "Unverified", "Non vérifié", "未核实"],
  ["رفع القيد بانتظار تحقق", "Restriction lift awaiting verification", "Levée de restriction en attente de vérification", "解除限制待核实"],
  ["{0} بلا اعتماد", "{0} unapproved", "{0} sans approbation", "{0} 个未批准"],
  ["موافقة", "Approve", "Approuver", "批准"],
  ["رفض", "Reject", "Refuser", "拒绝"],
  ["وُوفق على النقل — سُجّل", "Transfer approved — recorded", "Transfert approuvé — enregistré", "转移已批准——已记录"],
  ["رُفض النقل", "Transfer rejected", "Transfert refusé", "转移已拒绝"],
  ["حُفظ الإعداد", "Setting saved", "Paramètre enregistré", "设置已保存"],
  ["حالة القيد «غير معروفة» تمنع (الافتراضي: تحذير فقط)", "A restriction status of “Unknown” blocks (default: warning only)", "Un statut de restriction « Inconnu » bloque (par défaut : simple avertissement)", "限制状态为“未知”时予以阻止（默认：仅警告）"],
  ["حجب تفعيل العامل المرتبط بقائمة A33 غير المعتمدة", "Block activating a worker linked to an unapproved A33 list", "Bloquer l'activation d'un travailleur lié à une liste A33 non approuvée", "阻止启用关联未批准 A33 名单的工人"],
  ["السماح للعميل برؤية المخالفات المؤكدة والمراجَعة (الافتراضي: لا)", "Allow the client to see confirmed and reviewed violations (default: no)", "Autoriser le client à voir les infractions confirmées et révisées (par défaut : non)", "允许客户查看已确认并已复核的违规（默认：否）"],
  ["عتبة تنبيه انتهاء المستندات (أيام): ", "Document expiry alert threshold (days): ", "Seuil d'alerte d'expiration des documents (jours) : ", "文件到期提醒阈值（天）："],
  ["عتبة تنبيه المواعيد التقديرية (أيام): ", "Estimated deadline alert threshold (days): ", "Seuil d'alerte des échéances estimatives (jours) : ", "预估期限提醒阈值（天）："],
  ["افتراضات تشغيلية قابلة للتغيير لا أرقام نظامية. يغيّرها tenant_owner وحده.", "Changeable operational defaults, not regulatory figures. Only tenant_owner changes them.", "Valeurs d'exploitation modifiables, pas des chiffres réglementaires. Seul tenant_owner peut les modifier.", "可调整的运营默认值，并非法规数字。仅 tenant_owner 可更改。"],
  ["إعدادات الامتثال (للمستأجر)", "Compliance settings (per tenant)", "Paramètres de conformité (par tenant)", "合规设置（按租户）"],
  ["المنشآت", "Establishments", "Établissements", "企业"],
  ["طلبات نقل العمال بين المنشآت", "Worker transfer requests between establishments", "Demandes de transfert de travailleurs entre établissements", "工人在企业之间的转移申请"],
  ["لا طلبات", "No requests", "Aucune demande", "暂无申请"],
  ["النقل بطلب وموافقة من غير الطالب وسجل. شروط النقل الرسمية لم تُوجد في المرجع فلا يُفحص شيء منها هنا.", "A transfer needs a request, approval by someone other than the requester, and a log. The official transfer conditions were not found in the reference, so none of them is checked here.", "Un transfert exige une demande, l'approbation d'une personne autre que le demandeur, et un journal. Les conditions officielles de transfert n'ont pas été trouvées dans le référentiel : aucune n'est donc vérifiée ici.", "转移须经申请、由申请人以外的人批准并留有记录。参考资料中未找到官方的转移条件，因此此处不检查任何条件。"],
  ["من", "From", "De", "自"],
  ["منشأة — الامتثال", "Establishment — compliance", "Établissement — conformité", "企业——合规"],
  ["الحالة الفعلية: {0}", "Effective status: {0}", "Statut effectif : {0}", "实际状态：{0}"],
  ["متحقَّق منها", "Verified", "Vérifiée", "已核实"],
  ["السبب: {0*}", "Reason: {0}", "Motif : {0}", "原因：{0}"],
  ["الحجب: مقيّدة أو اشتباه تحجب أوامر الاستقدام وخطوات التأشيرة. لقطة «نظيفة» غير متحقَّق منها لا تُصدَّق ولا ترفع قيداً. غير المعروفة تحذير فقط ما لم يفعّل المستأجر المنع.", "Blocking: “Restricted” or “Suspected” blocks recruitment orders and visa steps. An unverified “Clear” snapshot is not trusted and does not lift a restriction. “Unknown” is a warning only unless the tenant enables blocking.", "Blocage : « Restreint » ou « Suspicion » bloque les ordres de recrutement et les étapes de visa. Un instantané « Sans restriction » non vérifié n'est pas retenu et ne lève aucune restriction. « Inconnu » n'est qu'un avertissement, sauf si le tenant active le blocage.", "限制规则：“受限”或“疑似”会阻止招聘订单和签证步骤。未核实的“无限制”快照不被采信，也不能解除限制。“未知”仅作警告，除非租户启用阻止。"],
  ["نطاق معلن", "Declared band", "Bande déclarée", "申报档位"],
  ["تقدير النطاق", "Band estimate", "Estimation de la bande", "档位预估"],
  ["المُدخِل", "Entered by", "Saisi par", "录入人"],
  ["غير متاح: {0*}", "Unavailable: {0}", "Indisponible : {0}", "不可用：{0}"],
  ["تقدير: {0*} · {1}%", "Estimate: {0} · {1}%", "Estimation : {0} · {1} %", "预估：{0} · {1}%"],
  ["لا تصنيف", "No classification", "Aucun classement", "无分类"],
  ["عدّ بالرؤوس؛ أوزان الأجور معطّلة لعدم تأكيدها", "Counted by headcount; wage weights are disabled because they are not confirmed", "Comptage par tête ; les pondérations salariales sont désactivées faute de confirmation", "按人数计算；工资权重因未经确认而停用"],
  ["متحقَّق {0}", "Verified {0}", "Vérifié {0}", "已核实 {0}"],
  ["تُحقِّق من اللقطة", "Snapshot verified", "Instantané vérifié", "快照已核实"],
  ["تحقق (مستخدم آخر)", "Verify (another user)", "Vérifier (un autre utilisateur)", "核实（另一位用户）"],
  ["السبب (يلزم للمقيّدة والاشتباه)", "Reason (required for Restricted and Suspected)", "Motif (obligatoire pour Restreint et Suspicion)", "原因（“受限”和“疑似”必填）"],
  ["نشاط نطاقات (اختياري)", "Nitaqat activity (optional)", "Activité Nitaqat (facultatif)", "Nitaqat 活动（可选）"],
  ["سعوديون", "Saudis", "Saoudiens", "沙特籍人数"],
  ["غير سعوديين", "Non-Saudis", "Non-Saoudiens", "非沙特籍人数"],
  ["النطاق المعلن", "Declared band", "Bande déclarée", "申报档位"],
  ["نسبة معلنة %", "Declared percentage %", "Pourcentage déclaré %", "申报比例 %"],
  ["من أين أُخذت الحالة (إدخال بشري)", "Where the status was taken from (human entry)", "D'où provient le statut (saisie humaine)", "状态来源（人工录入）"],
  ["سُجّلت اللقطة — تحتاج تحققاً من مستخدم آخر", "Snapshot recorded — it needs verification by another user", "Instantané enregistré — il doit être vérifié par un autre utilisateur", "快照已记录——须由另一位用户核实"],
  ["لقطة جديدة (إدخال بشري من منصة الجهة)", "New snapshot (human entry from the authority's platform)", "Nouvel instantané (saisie humaine depuis la plateforme de l'autorité)", "新快照（从主管机构平台人工录入）"],
  ["التقدير يُحسب في الخادم من المرجع، ولا يُدخَل يدوياً. من أدخل اللقطة لا يتحقق منها.", "The estimate is computed on the server from the reference and is not entered by hand. Whoever entered the snapshot does not verify it.", "L'estimation est calculée sur le serveur à partir du référentiel et n'est pas saisie à la main. Celui qui a saisi l'instantané ne le vérifie pas.", "预估值由服务器依据参考资料计算，不可手工录入。录入快照的人不能核实该快照。"],
  ["الفحوص", "Checks", "Contrôles", "检查"],
  ["شُغّلت الفحوص", "Checks were run", "Les contrôles ont été exécutés", "检查已运行"],
  ["تشغيل الفحوص", "Run checks", "Lancer les contrôles", "运行检查"],
  ["الفحص", "Check", "Contrôle", "检查项"],
  ["النتيجة", "Result", "Résultat", "结果"],
  ["تفصيل", "Detail", "Détail", "明细"],
  ["لم تُشغَّل فحوص بعد.", "No checks have been run yet.", "Aucun contrôle n'a encore été exécuté.", "尚未运行检查。"],
  ["اللقطات التاريخية", "Historical snapshots", "Instantanés historiques", "历史快照"],
  ["كل الحالات", "All statuses", "Tous les statuts", "全部状态"],
  ["الشريحة (يحددها الإنسان)", "Tier (set by a person)", "Tranche (fixée par une personne)", "档位（由人工确定）"],
  ["الجهة المصدِرة", "Issuing authority", "Autorité émettrice", "出具机构"],
  ["رقم المخالفة", "Violation number", "Numéro de l'infraction", "违规编号"],
  ["عدد الأشخاص/الحالات", "Number of persons/cases", "Nombre de personnes/cas", "人数/案件数"],
  ["تاريخ التبليغ من الإشعار الرسمي", "Notification date from the official notice", "Date de notification figurant sur l'avis officiel", "官方通知上的送达日期"],
  ["سُجّلت المخالفة — تحتاج مراجعة من مستخدم آخر", "Violation recorded — it needs review by another user", "Infraction enregistrée — elle doit être révisée par un autre utilisateur", "违规已登记——须由另一位用户复核"],
  ["تسجيل مخالفة", "Record a violation", "Enregistrer une infraction", "登记违规"],
  ["المبلغ والمواعيد تُحسب في الخادم من بنود المرجع. لا موعد اعتراض بلا تاريخ تبليغ يُدخله إنسان من الإشعار الرسمي. الاعتراض والسداد مساران متوازيان: الاعتراض لا يوقف الغرامة، وقرار السداد للعميل.", "The amount and deadlines are computed on the server from the reference items. There is no objection deadline without a notification date entered by a person from the official notice. Objection and payment are parallel tracks: an objection does not stop the fine, and the decision to pay belongs to the client.", "Le montant et les échéances sont calculés sur le serveur à partir des éléments du référentiel. Pas d'échéance d'opposition sans date de notification saisie par une personne d'après l'avis officiel. L'opposition et le paiement sont deux voies parallèles : l'opposition ne suspend pas l'amende, et la décision de payer revient au client.", "金额和期限由服务器依据参考资料条目计算。没有人工依据官方通知录入的送达日期，就没有异议期限。异议与缴款是并行的两条路径：异议不会中止罚款，是否缴款由客户决定。"],
  ["البند / المنشأة", "Item / establishment", "Élément / établissement", "条款 / 企业"],
  ["غرامة تقديرية", "Estimated fine", "Amende estimative", "预估罚款"],
  ["تاريخ التبليغ", "Notification date", "Date de notification", "送达日期"],
  ["مواعيد تقديرية (اعتراض · تسوية · سداد)", "Estimated deadlines (objection · settlement · payment)", "Échéances estimatives (opposition · règlement · paiement)", "预估期限（异议 · 和解 · 缴款）"],
  ["السداد", "Payment", "Paiement", "缴款"],
  ["مراجعة", "Review", "Examen", "审核"],
  ["{0} ر.س", "{0} SAR", "{0} SAR", "{0} SAR"],
  ["لم يُدخل", "Not entered", "Non saisie", "未录入"],
  ["أدخل تاريخ التبليغ أولاً", "Enter the notification date first", "Saisissez d'abord la date de notification", "请先录入送达日期"],
  ["سُجّل تاريخ التبليغ", "Notification date recorded", "Date de notification enregistrée", "已记录送达日期"],
  ["تصحيح", "Correct", "Corriger", "更正"],
  ["إدخال@button", "Enter", "Saisir", "录入"],
  ["اعتراض", "Objection", "Opposition", "异议"],
  ["تسوية", "Settlement", "Règlement", "和解"],
  ["سداد", "Payment", "Paiement", "缴款"],
  ["يلزم تاريخ التبليغ", "The notification date is required", "La date de notification est requise", "须有送达日期"],
  ["غير متاح", "Unavailable", "Indisponible", "不可用"],
  ["(مهمة بشرية)", "(human task)", "(tâche humaine)", "（人工任务）"],
  [" (مهمة بشرية)", " (human task)", " (tâche humaine)", "（人工任务）"],
  ["روجعت", "Reviewed", "Révisée", "已复核"],
  ["بانتظار مراجعة", "Awaiting review", "En attente de révision", "待复核"],
  ["غير مراجَعة", "Not reviewed", "Non révisée", "未复核"],
  ["التقديم عبر بوابة الجهة بهوية العميل: مهمة بشرية لا آلية.", "Submission through the authority's portal with the client's identity: a human task, not an automated one.", "Le dépôt via le portail de l'autorité avec l'identité du client : une tâche humaine, non automatisée.", "须以客户身份通过主管机构门户提交：属人工任务，而非自动完成。"],
  ["نقل@button", "Move", "Déplacer", "移动"],
  ["حُدّث السداد", "Payment status updated", "Statut de paiement mis à jour", "缴款状态已更新"],
  ["راجعتَ المخالفة", "You reviewed the violation", "Vous avez révisé l'infraction", "您已复核该违规"],
  ["مراجعة (مستخدم آخر)", "Review (another user)", "Examen (un autre utilisateur)", "复核（另一位用户）"],
  ["مدة التسوية تختلف عن مدة الاعتراض ولا يُوحَّدان. لا يُعرض تخفيض كحق: التسوية بشروط وتخضع لدراسة الجهة.", "The settlement period differs from the objection period and the two are not merged. No reduction is presented as a right: settlement is conditional and subject to the authority's review.", "Le délai de règlement diffère du délai d'opposition et les deux ne sont pas fusionnés. Aucune réduction n'est présentée comme un droit : le règlement est conditionnel et soumis à l'examen de l'autorité.", "和解期限与异议期限不同，二者不合并。不会把减免当作权利呈现：和解有条件，并须经主管机构审议。"],
  ["لا مخالفات", "No violations", "Aucune infraction", "暂无违规"],
  ["سجّل أول مخالفة من النموذج أعلاه.", "Record the first violation using the form above.", "Enregistrez la première infraction avec le formulaire ci-dessus.", "请使用上方表单登记第一条违规。"],
  ["منشأة", "Establishment", "Établissement", "企业"],
  ["عامل", "Worker", "Travailleur", "工人"],
  ["مخالفة", "Violation", "Infraction", "违规"],
  ["الجمهور: {0*}", "Audience: {0}", "Public : {0}", "适用对象：{0}"],
  ["مكتملة", "Complete", "Complète", "已完成"],
  ["متبقٍ {0}", "{0} remaining", "{0} restant(s)", "剩余 {0}"],
  ["معطَّل: لا يُحتسب ولا يُنقر حتى يُؤكَّد المصدر", "Disabled: not counted and not tickable until the source is confirmed", "Désactivé : non compté et non cochable tant que la source n'est pas confirmée", "已停用：来源确认前不计入，也不可勾选"],
  ["سُجّل البند", "Item recorded", "Point enregistré", "条目已记录"],
  ["لا قوائم لهذا النوع", "No checklists for this type", "Aucune liste pour ce type", "此类型没有清单"],
  ["الخطورة", "Severity", "Gravité", "严重程度"],
  ["التنبيه", "Alert", "Alerte", "提醒"],
  ["الموضوع", "Subject", "Objet", "对象"],
  ["لا تنبيهات", "No alerts", "Aucune alerte", "暂无提醒"],
  ["{0} اسماً بلا اعتماد", "{0} {0|name|names} without approval", "{0} {0|nom|noms} sans approbation", "{0} 个姓名未获批准"],
  ["عتبة المستندات {0} يوماً، وعتبة المواعيد التقديرية {1} يوماً (إعدادات تشغيلية للمستأجر). التنبيهات داخلية للمشغّل: لا رسالة تُرسل لأحد، ولا تنبيه بموعد دون تاريخ تبليغ مُدخَل.", "Documents threshold {0} {0|day|days}, estimated-deadline threshold {1} {1|day|days} (tenant operational settings). Alerts are internal to the operator: no message is sent to anyone, and there is no deadline alert without an entered notification date.", "Seuil des documents : {0} {0|jour|jours}, seuil des échéances estimatives : {1} {1|jour|jours} (paramètres d'exploitation du tenant). Les alertes sont internes à l'opérateur : aucun message n'est envoyé, et aucune alerte d'échéance sans date de notification saisie.", "文件阈值 {0} 天，预估期限阈值 {1} 天（租户的运营设置）。提醒仅供运营人员内部使用：不会向任何人发送消息，未录入送达日期则不会有期限提醒。"],
  ["رقم هوية وهمي,YYYY-MM,الحالة\nDEMO-SHR-1,2026-10,registered\n(تأمينات: registered | not_registered ؛ حماية أجور: paid | not_paid)", "Fictitious ID number,YYYY-MM,status\nDEMO-SHR-1,2026-10,registered\n(social insurance: registered | not_registered ; wage protection: paid | not_paid)", "Numéro d'identité fictif,YYYY-MM,statut\nDEMO-SHR-1,2026-10,registered\n(assurances sociales : registered | not_registered ; protection des salaires : paid | not_paid)", "虚构证件号,YYYY-MM,状态\nDEMO-SHR-1,2026-10,registered\n（社保：registered | not_registered；工资保护：paid | not_paid）"],
  ["اسم الدفعة (وهمي)", "Batch name (fictitious)", "Nom du lot (fictif)", "批次名称（虚构）"],
  ["رُفعت الدفعة: {0} صفاً — بصمات فقط", "Batch uploaded: {0} {0|row|rows} — hashes only", "Lot téléversé : {0} {0|ligne|lignes} — empreintes uniquement", "批次已上传：{0} 行——仅哈希值"],
  ["صفوف مرفوضة (لا توقف الباقي):", "Rejected rows (they do not stop the rest):", "Lignes refusées (elles n'arrêtent pas les autres) :", "被拒绝的行（不影响其余行）："],
  ["رفع دفعة (تأمينات أو حماية أجور)", "Upload a batch (social insurance or wage protection)", "Téléverser un lot (assurances sociales ou protection des salaires)", "上传批次（社保或工资保护）"],
  ["الصفوف مُبصَّمة: رقم الهوية يُحوَّل إلى بصمة في الخادم ولا يُخزَّن ولا يُعاد، ولا أعمدة للاسم أو الهاتف أو البريد (تُرفض). المسار: مرفوع ← مطابَق ← روجع ← مطبَّق، ومن رفع لا يراجع ولا يطبّق. الحد الأقصى {0} صفاً.", "Rows are hashed: the ID number is converted into a hash on the server and is never stored or returned, and name, phone or email columns are rejected. The flow: uploaded → matched → reviewed → applied, and whoever uploaded does not review or apply. Maximum {0} rows.", "Les lignes sont hachées : le numéro d'identité est converti en empreinte sur le serveur, jamais conservé ni renvoyé, et les colonnes nom, téléphone ou e-mail sont refusées. Parcours : téléversé → rapproché → révisé → appliqué, et celui qui a téléversé ne révise ni n'applique. Maximum {0} lignes.", "各行均做哈希处理：证件号在服务器上转换为哈希值，不保存也不返回；姓名、电话、邮箱列会被拒绝。流程：已上传 → 已匹配 → 已复核 → 已应用，上传者不能复核或应用。最多 {0} 行。"],
  ["الدفعة", "Batch", "Lot", "批次"],
  ["صفوف", "Rows", "Lignes", "行数"],
  ["تمّ: {0}", "Done: {0}", "Fait : {0}", "已完成：{0}"],
  ["صفوف الدفعة (بلا بصمات)", "Batch rows (without hashes)", "Lignes du lot (sans empreintes)", "批次行（不含哈希值）"],
  ["الفترة", "Period", "Période", "期间"],
  ["العامل", "Worker", "Travailleur", "工人"],
  ["مطبَّق", "Applied", "Appliqué", "已应用"],
  ["الدفعات", "Batches", "Lots", "批次列表"],
  ["لا دفعات", "No batches", "Aucun lot", "暂无批次"],
  ["ارفع دفعة من النموذج أعلاه.", "Upload a batch using the form above.", "Téléversez un lot avec le formulaire ci-dessus.", "请使用上方表单上传批次。"],
  ["لا أسماء", "No names", "Aucun nom", "暂无姓名"],
  ["القائمة", "List", "Liste", "名单"],
  ["الأسماء", "Names", "Noms", "姓名"],
  ["مصنَّفة", "Classified", "Classés", "已分类"],
  ["معتمدة", "Approved", "Approuvés", "已批准"],
  ["الاكتمال", "Completeness", "Complétude", "完整度"],
  ["مكتملة", "Complete", "Complète", "已完成"],
  ["غير مكتملة", "Incomplete", "Incomplète", "未完成"],
  ["الاسم (وهمي)", "Name (fictitious)", "Nom (fictif)", "姓名（虚构）"],
  ["عامل مرتبط", "Linked worker", "Travailleur lié", "关联工人"],
  ["التصنيف", "Classification", "Classement", "分类"],
  ["صنّف…", "Classify…", "Classer…", "分类…"],
  ["اختر تصنيفاً", "Choose a classification", "Choisissez un classement", "请选择分类"],
  ["صُنّف الاسم", "Name classified", "Nom classé", "姓名已分类"],
  ["اعتماد (مراجع ثانٍ)", "Approve (second reviewer)", "Approuver (second réviseur)", "批准（第二复核人）"],
  ["اعتُمد التصنيف", "Classification approved", "Classement approuvé", "分类已批准"],
  ["معتمد", "Approved", "Approuvé", "已批准"],
  ["مرتبط", "Linked", "Lié", "已关联"],
  ["غير مصنَّف", "Unclassified", "Non classé", "未分类"],
  ["لا قوائم", "No lists", "Aucune liste", "暂无名单"],
  ["مرجع القائمة", "List reference", "Référence de la liste", "名单编号"],
  ["اسم وهمي ينتهي بـ(وهمي)", "Fictitious name ending with (fictitious)", "Nom fictif se terminant par (fictif)", "以“（虚构）”结尾的虚构姓名"],
  ["رقم هوية وهمي (بصمة فقط)", "Fictitious ID number (hash only)", "Numéro d'identité fictif (empreinte uniquement)", "虚构证件号（仅哈希值）"],
  ["أُضيف الاسم", "Name added", "Nom ajouté", "姓名已添加"],
  ["إضافة اسم إلى قائمة", "Add a name to a list", "Ajouter un nom à une liste", "向名单添加姓名"],
  ["م33: تسجيل عامل سعودي ضمن عمال المنشأة دون علاقة عمل فعلية (لا وافد). لا أسماء حقيقية في هذه المرحلة، والهوية بصمة فقط. المصنِّف لا يعتمد، ويُحجب تفعيل العامل المرتبط بالقائمة حتى يُصنَّف كل اسم ويعتمد مراجع ثانٍ.", "A33: registering a Saudi worker among the establishment's workers with no actual employment relationship (not an expatriate). No real names at this stage, and identity is a hash only. Whoever classifies does not approve, and activating a worker linked to the list is blocked until every name is classified and a second reviewer approves.", "A33 : inscription d'un travailleur saoudien parmi les travailleurs de l'établissement sans relation de travail effective (pas un expatrié). Aucun nom réel à ce stade, et l'identité n'est qu'une empreinte. Celui qui classe n'approuve pas, et l'activation d'un travailleur lié à la liste est bloquée tant que chaque nom n'est pas classé et approuvé par un second réviseur.", "A33：将沙特籍工人登记在企业工人名单中，但并无实际劳动关系（并非外籍人员）。此阶段不使用真实姓名，身份仅以哈希值保存。分类者不能批准；在每个姓名都完成分类并经第二复核人批准之前，关联该名单的工人无法启用。"],

  // ---- إعلانات الوظائف -----------------------------------------------------------------------------------------------
  ["بانتظار الاعتماد", "Awaiting approval", "En attente d'approbation", "待批准"],
  ["منشور داخلياً", "Published internally", "Publié en interne", "已内部发布"],
  ["صفحة SHR الخاصة", "Private SHR page", "Page privée SHR", "SHR 私有页面"],
  ["صفحة وظائف BP العامة", "Public BP jobs page", "Page publique des postes BP", "BP 公开职位页面"],
  ["منصات خارجية", "External platforms", "Plateformes externes", "外部平台"],
  ["العنوان", "Title", "Titre", "标题"],
  ["المتطلبات", "Requirements", "Exigences", "要求"],
  ["موافقة سارية", "Valid consent", "Consentement valide", "同意有效"],
  ["{0} مطلوب", "{0} needed", "{0} demandé(s)", "需要 {0} 人"],
  ["اختر المنشأة المعلِنة…", "Choose the advertising establishment…", "Choisissez l'établissement annonceur…", "请选择发布公告的企业…"],
  ["العربية", "Arabic", "Arabe", "阿拉伯语"],
  ["عنوان الإعلان", "Post title", "Titre de l'annonce", "公告标题"],
  ["وصف قصير للوظيفة", "Short job description", "Brève description du poste", "职位简要描述"],
  ["المتطلبات: سطر لكل شرط", "Requirements: one line per condition", "Exigences : une ligne par condition", "要求：每条一行"],
  ["الحد الأدنى (اختياري)", "Minimum (optional)", "Minimum (facultatif)", "下限（可选）"],
  ["الحد الأعلى (اختياري)", "Maximum (optional)", "Maximum (facultatif)", "上限（可选）"],
  ["كيف يبدو الإعلان — معاينة", "How the post looks — preview", "Aperçu de l'annonce", "公告效果——预览"],
  ["عنوان الإعلان يظهر هنا", "The post title appears here", "Le titre de l'annonce apparaît ici", "公告标题显示在这里"],
  ["الوصف يظهر هنا.", "The description appears here.", "La description apparaît ici.", "描述显示在这里。"],
  ["يظهر داخل صفحة SHR الخاصة فقط. لا اسم عميل ولا بيانات تواصل. لا نشر عام ولا خارجي.", "Shown only inside the private SHR page. No client name and no contact details. No public or external posting.", "Affichée uniquement dans la page privée SHR. Ni nom de client, ni coordonnées. Aucune diffusion publique ni externe.", "仅显示在 SHR 私有页面内。不含客户名称和联系方式。不对外公开或发布到外部。"],
  ["اختر وظيفة مفتوحة أولاً", "Choose an open job first", "Choisissez d'abord un poste ouvert", "请先选择一个开放职位"],
  ["صياغة من قالب محلي (بلا ذكاء اصطناعي، بلا راتب). عدّلها كما تشاء قبل الحفظ.", "Drafted from a local template (no AI, no salary). Edit it as you like before saving.", "Rédigé à partir d'un modèle local (sans IA, sans salaire). Modifiez-le comme vous le souhaitez avant d'enregistrer.", "由本地模板生成（不使用 AI，不含薪资）。保存前可随意修改。"],
  [" حُذف {0} سطر لا يمرّ الحرس.", " {0} {0|line|lines} that fail the guard {0|was|were} removed.", " {0} {0|ligne|lignes} ne passant pas le contrôle {0|a été supprimée|ont été supprimées}.", " 已删除 {0} 行未通过校验的内容。"],
  ["اقترح صياغة", "Suggest wording", "Proposer une rédaction", "建议措辞"],
  ["حُفظ التعديل", "Changes saved", "Modifications enregistrées", "修改已保存"],
  ["أُنشئت المسودة — أرسلها للاعتماد من بطاقتها", "Draft created — submit it for approval from its card", "Brouillon créé — soumettez-le pour approbation depuis sa carte", "草稿已创建——请在其卡片上提交审批"],
  ["حفظ التعديل", "Save changes", "Enregistrer les modifications", "保存修改"],
  ["حفظ كمسودة", "Save as draft", "Enregistrer comme brouillon", "保存为草稿"],
  ["إلغاء التعديل", "Cancel editing", "Annuler la modification", "取消编辑"],
  ["تعديل مسودة", "Edit draft", "Modifier le brouillon", "编辑草稿"],
  ["إعلان جديد", "New post", "Nouvelle annonce", "新建公告"],
  ["المنشأة المعلِنة (تُفحص حالة قيدها قبل الإرسال)", "Advertising establishment (its restriction status is checked before submission)", "Établissement annonceur (son statut de restriction est vérifié avant l'envoi)", "发布公告的企业（提交前会检查其限制状态）"],
  ["لغة الإعلان", "Post language", "Langue de l'annonce", "公告语言"],
  ["الوصف", "Description", "Description", "描述"],
  ["أدنى راتب بالريال (يدخله موظف فقط)", "Minimum salary in SAR (entered by staff only)", "Salaire minimum en SAR (saisi uniquement par un employé)", "最低薪资（SAR，仅限员工录入）"],
  ["أعلى راتب بالريال (يدخله موظف فقط)", "Maximum salary in SAR (entered by staff only)", "Salaire maximum en SAR (saisi uniquement par un employé)", "最高薪资（SAR，仅限员工录入）"],
  ["عدد المطلوبين يؤخذ من الوظيفة. النص لا يقبل ادعاء ترخيص أو امتثال أو ضمان أو وعداً بنتيجة حكومية، ولا رقم راتب خارج الحقلين، ولا بيانات تواصل أو اسم عميل. من يكتب الإعلان لا يعتمده.", "The number of positions is taken from the job. The text does not accept a licence or compliance claim, a guarantee or a promise of a government outcome, nor a salary figure outside the two fields, nor contact details or a client name. Whoever writes the post does not approve it.", "Le nombre de postes est repris du poste. Le texte n'accepte ni mention de licence ou de conformité, ni garantie, ni promesse de résultat administratif, ni chiffre de salaire en dehors des deux champs, ni coordonnées ou nom de client. Celui qui rédige l'annonce ne l'approuve pas.", "招聘人数取自职位。文本不接受涉及执照或合规的表述、保证或承诺政府办理结果，也不接受两个字段之外的薪资数字，不接受联系方式或客户名称。撰写公告的人不能批准该公告。"],
  ["محجوب: منشأة {0}", "Blocked: establishment {0}", "Bloquée : établissement {0}", "已被限制：企业{0}"],
  ["المطلوبون", "Positions", "Postes à pourvoir", "招聘人数"],
  ["لم تُحدَّد", "Not set", "Non définie", "未设定"],
  ["القناة", "Channel", "Canal", "渠道"],
  ["الطلبات@th", "Applications", "Candidatures", "申请"],
  ["الطلبات@b", "Applications", "Candidatures", "申请"],
  ["الراتب (مُدخَل بشرياً)", "Salary (entered by a person)", "Salaire (saisi par une personne)", "薪资（人工录入）"],
  ["كتبه", "Written by", "Rédigé par", "撰写人"],
  ["اعتمده", "Approved by", "Approuvé par", "批准人"],
  ["أُرسل للاعتماد", "Submitted for approval", "Soumis pour approbation", "已提交审批"],
  ["إرسال للاعتماد", "Submit for approval", "Soumettre pour approbation", "提交审批"],
  ["اعتُمد الإعلان", "Post approved", "Annonce approuvée", "公告已批准"],
  ["كاتب الإعلان لا يعتمده — يعتمده مستخدم آخر", "The post's author does not approve it — another user approves it", "L'auteur de l'annonce ne l'approuve pas — un autre utilisateur l'approuve", "公告撰写人不能批准——须由另一位用户批准"],
  ["نُشر داخل صفحة SHR الخاصة فقط", "Published inside the private SHR page only", "Publiée uniquement dans la page privée SHR", "仅已在 SHR 私有页面内发布"],
  ["نشر داخل SHR", "Publish inside SHR", "Publier dans SHR", "在 SHR 内发布"],
  ["إضافة مقدّم طلب", "Add an applicant", "Ajouter un candidat", "添加申请人"],
  ["أُغلق الإعلان", "Post closed", "Annonce clôturée", "公告已关闭"],
  ["لا يُنشر ولا تُضاف له طلبات ما دامت المنشأة {0}.", "It is not published and no applications are added to it while the establishment is {0}.", "Elle n'est pas publiée et aucune candidature ne lui est ajoutée tant que l'établissement est {0}.", "只要企业处于“{0}”状态，就不能发布，也不能添加申请。"],
  ["الوظيفة مغلقة: لا يُنشر هذا الإعلان.", "The job is closed: this post is not published.", "Le poste est clôturé : cette annonce n'est pas publiée.", "职位已关闭：此公告不会发布。"],
  ["أُضيف طلب التقديم في «جديد» (إدخال يدوي، لا صفحة تقديم عامة)", "The application was added to “New” (manual entry, no public application page)", "La candidature a été ajoutée à « Nouveau » (saisie manuelle, pas de page de candidature publique)", "申请已添加至“新建”（手工录入，没有公开申请页面）"],
  ["لا يُقبل إلا مرشح موافقته سارية. لا صفحة تقديم عامة: المشغّل يدخل الطلب يدوياً.", "Only a candidate with valid consent is accepted. There is no public application page: the operator enters the application by hand.", "Seul un candidat dont le consentement est valide est accepté. Pas de page de candidature publique : l'opérateur saisit la candidature à la main.", "只接受有有效同意的候选人。没有公开申请页面：由运营人员手工录入申请。"],
  ["سجل الحالات", "Status history", "Historique des statuts", "状态记录"],
  ["إنشاء@li", "Creation", "Création", "创建"],
  ["النشر العام (صفحة وظائف BP العامة أو منصات خارجية) قرار المالك ولم يُفعَّل. «منشور» هنا يعني ظاهراً داخل صفحة SHR الخاصة فقط، ولا يُرسل شيء لأحد.", "Public posting (the public BP jobs page or external platforms) is the owner's decision and has not been enabled. “Published” here means visible only inside the private SHR page; nothing is sent to anyone.", "La diffusion publique (page publique des postes BP ou plateformes externes) relève du propriétaire et n'est pas activée. « Publié » signifie ici visible uniquement dans la page privée SHR ; rien n'est envoyé à personne.", "对外公开发布（BP 公开职位页面或外部平台）须由所有者决定，目前未启用。此处的“已发布”仅表示在 SHR 私有页面内可见，不会向任何人发送内容。"],
  ["الإعلانات ({0})", "Posts ({0})", "Annonces ({0})", "公告（{0}）"],
  ["القنوات", "Channels", "Canaux", "渠道"],
  ["الإسناد", "Assignment", "Affectation", "派驻"],
  [" (مفعّلة)", " (enabled)", " (activé)", "（已启用）"],
  [" (معطّلة)", " (disabled)", " (désactivé)", "（已停用）"],
  ["لا إعلانات في هذه الحالة", "No posts in this status", "Aucune annonce dans ce statut", "此状态下没有公告"],
  ["اكتب إعلاناً من النموذج أعلاه.", "Write a post using the form above.", "Rédigez une annonce avec le formulaire ci-dessus.", "请使用上方表单撰写公告。"],
  ["لا نشر ولا إضافة", "No posting or adding", "Ni publication ni ajout", "不发布也不添加"],

  // ---- قوائم تحقق الخبرة (بيانات البذرة المرجعية) ------------------------------------------------------------------------
  ["جاهزية المنشأة للاستقدام (تجريبية)", "Establishment readiness for recruitment (demo)", "Préparation de l'établissement au recrutement (démo)", "企业招聘就绪情况（演示）"],
  ["تحقق من حالة القيد في منصة الجهة وسجّلها بلقطة يتحقق منها مستخدم آخر", "Check the restriction status on the authority's platform and record it as a snapshot verified by another user", "Vérifier le statut de restriction sur la plateforme de l'autorité et l'enregistrer sous forme d'instantané vérifié par un autre utilisateur", "在主管机构平台核对限制状态，并记录为由另一位用户核实的快照"],
  ["فتح ملف المنشأة وتحديث مواقعها وبياناتها", "Open the establishment file and update its locations and data", "Ouvrir le dossier de l'établissement et mettre à jour ses sites et ses données", "开设企业档案并更新其地点和资料"],
  ["رفع ملف حماية الأجور للفترة الأخيرة", "Upload the wage-protection file for the latest period", "Téléverser le fichier de protection des salaires de la dernière période", "上传最近一期的工资保护文件"],
  ["توثيق عقود العاملين إلكترونياً", "Document workers' contracts electronically", "Documenter électroniquement les contrats des travailleurs", "以电子方式登记工人合同"],
  ["التحقق من قناة تقديم الاعتراض الحالية في واجهة الخدمة", "Verify the current objection submission channel in the service interface", "Vérifier le canal actuel de dépôt d'opposition dans l'interface du service", "在服务界面核实当前提交异议的渠道"],
  ["جاهزية العامل للتفعيل (تجريبية)", "Worker readiness for activation (demo)", "Préparation du travailleur à l'activation (démo)", "工人启用就绪情况（演示）"],
  ["هوية وإقامة سارية ومستند مرفوع", "Valid identity and Iqama, and an uploaded document", "Identité et Iqama valides, et un document téléversé", "身份和居留证有效，且已上传文件"],
  ["عقد عمل موثّق إلكترونياً", "Work contract documented electronically", "Contrat de travail documenté électroniquement", "劳动合同已电子登记"],
  ["عدم احتجاز جواز العامل أو إقامته", "The worker's passport or Iqama is not withheld", "Le passeport ou l'Iqama du travailleur n'est pas retenu", "不扣留工人的护照或居留证"],
  ["تحمّل الرسوم والتكاليف الملزمة على صاحب العمل", "Mandatory fees and costs are borne by the employer", "Les frais et coûts obligatoires sont supportés par l'employeur", "法定应由雇主承担的费用和成本由雇主承担"],
  ["مراجعة مخالفة قبل التقديم (تجريبية)", "Violation review before submission (demo)", "Examen d'une infraction avant dépôt (démo)", "提交前的违规复核（演示）"],
  ["إدخال تاريخ التبليغ من الإشعار الرسمي", "Enter the notification date from the official notice", "Saisir la date de notification figurant sur l'avis officiel", "按官方通知录入送达日期"],
  ["مراجعة ثانية من مستخدم غير من أدخل المخالفة", "Second review by a user other than the one who entered the violation", "Seconde révision par un utilisateur autre que celui qui a saisi l'infraction", "由录入违规者以外的用户进行二次复核"],
  ["تجهيز المبررات والمرفقات", "Prepare the justifications and attachments", "Préparer les justifications et les pièces jointes", "准备理由和附件"],
  ["التقديم عبر بوابة الجهة مهمة بشرية بهوية العميل", "Submission through the authority's portal is a human task, using the client's identity", "Le dépôt via le portail de l'autorité est une tâche humaine, avec l'identité du client", "通过主管机构门户提交属人工任务，须使用客户身份"],
  ["إبلاغ العميل أنه لا ضمان لإلغاء المخالفة", "Tell the client that there is no guarantee the violation will be cancelled", "Informer le client qu'il n'y a aucune garantie d'annulation de l'infraction", "告知客户不保证违规记录能够被撤销"],
  ["مستنداتي (قائمة العامل — تجريبية)", "My documents (worker list — demo)", "Mes documents (liste du travailleur — démo)", "我的文件（工人清单——演示）"],
  ["عقد العمل موقّع", "Work contract is signed", "Le contrat de travail est signé", "劳动合同已签署"],

  // ---- المرجع النظامي: حالات المخالفة والنطاقات والمُدد (ترجمة عمل تحتاج مراجعة قانونية) ----------------------------------
  ["دراسة أهلية الاعتراض", "Objection eligibility study", "Étude de la recevabilité de l'opposition", "异议资格研究"],
  ["تجهيز", "Preparation", "Préparation", "准备"],
  ["تقديم", "Submission", "Dépôt", "提交"],
  ["متابعة", "Follow-up", "Suivi", "跟进"],
  ["أحمر", "Red", "Rouge", "红色"],
  ["أخضر منخفض", "Low green", "Vert bas", "低绿"],
  ["أخضر متوسط", "Medium green", "Vert moyen", "中绿"],
  ["أخضر مرتفع", "High green", "Vert élevé", "高绿"],
  ["بلاتيني", "Platinum", "Platine", "铂金"],
  ["مدة الاعتراض على القرار الإداري بإيقاع العقوبة", "Objection period for the administrative decision imposing the penalty", "Délai d'opposition à la décision administrative infligeant la sanction", "对处罚行政决定提出异议的期限"],
  ["من تاريخ التبليغ بالقرار", "From the date of notification of the decision", "À compter de la date de notification de la décision", "自决定送达之日起"],
  ["مدة سداد الغرامة", "Fine payment period", "Délai de paiement de l'amende", "罚款缴纳期限"],
  ["من تاريخ التبليغ بالقرار الإداري", "From the date of notification of the administrative decision", "À compter de la date de notification de la décision administrative", "自行政决定送达之日起"],
  ["شروط طلب تسوية المخالفة", "Conditions for requesting settlement of the violation", "Conditions de la demande de règlement de l'infraction", "申请违规和解的条件"],
  ["مدة التسوية ({0}) أطول من الاعتراض ({1}) — الاختلاف مقصود في النصوص؛ لا يُوحَّدان.", "The settlement period ({0}) is longer than the objection period ({1}) — the difference is intended in the texts; they are not merged.", "Le délai de règlement ({0}) est plus long que celui d'opposition ({1}) — la différence est voulue dans les textes ; ils ne sont pas fusionnés.", "和解期限（{0}）长于异议期限（{1}）——相关文本有意作出区别；二者不合并。"],
  ["تشغيل العاملين السعوديين في الأنشطة المقصورة على العاملات السعوديات", "Employing Saudi male workers in activities restricted to Saudi women", "Emploi de travailleurs saoudiens dans des activités réservées aux travailleuses saoudiennes", "在仅限沙特籍女性从事的活动中雇用沙特籍男性工人"],
  ["تشغيل عامل غير سعودي دون رخصة عمل", "Employing a non-Saudi worker without a work permit", "Emploi d'un travailleur non saoudien sans permis de travail", "雇用无工作许可的非沙特籍工人"],
  ["تمكين العامل غير السعودي من العمل في مهنة مغايرة للمدونة في رخصة العمل", "Allowing a non-Saudi worker to work in a profession different from the one recorded on the work permit", "Permettre à un travailleur non saoudien d'exercer une profession différente de celle inscrite sur son permis de travail", "允许非沙特籍工人从事与工作许可所载职业不同的职业"],
  ["توظيف عامل دون رخصة عمل مهنية في الأنشطة المقصورة على السعوديين وفق متطلبات الوزارة", "Employing a worker without a professional work permit in activities restricted to Saudis, per the Ministry's requirements", "Emploi d'un travailleur sans permis de travail professionnel dans des activités réservées aux Saoudiens, selon les exigences du Ministère", "按部门要求，在仅限沙特籍人员从事的活动中雇用无职业工作许可的工人"],
  ["تقديم معلومات غير صحيحة إلى الوزارة يترتب عليها الحصول على مزايا وخدمات", "Providing incorrect information to the Ministry that results in obtaining benefits and services", "Fourniture au Ministère d'informations inexactes permettant d'obtenir des avantages et des services", "向部门提供不实信息，从而获得福利和服务"],
  ["عدم فتح ملف للمنشأة أو عدم تحديث مواقع وبيانات المنشأة وفروعها وفق الآلية التي تحددها الوزارة", "Not opening a file for the establishment, or not updating the locations and data of the establishment and its branches according to the mechanism set by the Ministry", "Ne pas ouvrir de dossier pour l'établissement, ou ne pas mettre à jour les sites et données de l'établissement et de ses succursales selon le mécanisme fixé par le Ministère", "未为企业开设档案，或未按部门规定的方式更新企业及其分支机构的地点和资料"],
  ["توظيف عمالة غير سعودية في مهن أو أنشطة مقصورة على السعوديين", "Employing non-Saudi labour in professions or activities restricted to Saudis", "Emploi de main-d'œuvre non saoudienne dans des professions ou activités réservées aux Saoudiens", "在仅限沙特籍人员从事的职业或活动中雇用非沙特籍劳动力"],
  ["عدم الالتزام بنسب التوطين للمهن والأنشطة الصادر لها قرارات وزارية", "Not complying with the localization ratios for professions and activities covered by ministerial decisions", "Non-respect des taux de localisation pour les professions et activités faisant l'objet de décisions ministérielles", "未遵守已有部门决定的职业和活动的本地化比例"],
  ["احتفاظ صاحب العمل بجواز سفر العامل أو إقامته", "An employer keeping the worker's passport or residence permit", "Un employeur conservant le passeport ou le titre de séjour du travailleur", "雇主扣留工人的护照或居留证"],
  ["عدم التزام صاحب العمل بتحمل الرسوم والتكاليف الملزم بها أو تحميلها على العاملين", "An employer not bearing the fees and costs it is bound to bear, or passing them on to workers", "Un employeur ne supportant pas les frais et coûts qui lui incombent, ou les faisant supporter aux travailleurs", "雇主未承担其应承担的费用和成本，或将其转嫁给工人"],
  ["تسجيل عامل سعودي ضمن عمال المنشأة دون وجود علاقة عمالية فعلية (التوطين الوهمي)", "Registering a Saudi worker among the establishment's workers with no actual employment relationship (fictitious localization)", "Inscription d'un travailleur saoudien parmi les travailleurs de l'établissement sans relation de travail effective (localisation fictive)", "将沙特籍工人登记在企业工人名单中，但并无实际劳动关系（虚假本地化）"],
  ["عدم توثيق عقود العاملين إلكترونياً", "Not documenting workers' contracts electronically", "Ne pas documenter électroniquement les contrats des travailleurs", "未以电子方式登记工人合同"],
  ["عدم دفع أجر العامل وتصفية حقوقه خلال أسبوع من انتهاء العلاقة العقدية (أو أسبوعين إذا كان الإنهاء بإرادة العامل)", "Not paying the worker's wages and settling their entitlements within a week of the end of the contractual relationship (or two weeks if the termination is at the worker's initiative)", "Ne pas payer le salaire du travailleur et régler ses droits dans la semaine suivant la fin de la relation contractuelle (ou deux semaines si la rupture est à l'initiative du travailleur)", "未在合同关系结束后一周内（若因工人本人意愿终止则为两周内）支付工人工资并结清其权益"],
  ["عدم دفع أجور العاملين ومستحقاتهم بالعملة الرسمية في مواعيد استحقاقها في حساباتهم البنكية المعتمدة، أو احتجاز الأجر أو جزء منه دون سند قضائي", "Not paying workers' wages and entitlements in the official currency on their due dates into their approved bank accounts, or withholding wages or part of them without a judicial basis", "Ne pas verser les salaires et droits des travailleurs en monnaie officielle à leurs échéances sur leurs comptes bancaires agréés, ou retenir tout ou partie du salaire sans fondement judiciaire", "未按期以官方货币将工人工资和应得款项支付至其认可的银行账户，或无司法依据而扣留全部或部分工资"],
  ["عدم رفع ملف حماية الأجور شهرياً أو عدم الالتزام بنسبة الامتثال المحددة من الوزارة لبرنامج حماية الأجور", "Not uploading the wage-protection file monthly, or not meeting the compliance ratio set by the Ministry for the wage-protection programme", "Ne pas téléverser mensuellement le fichier de protection des salaires, ou ne pas respecter le taux de conformité fixé par le Ministère pour le programme de protection des salaires", "未按月上传工资保护文件，或未达到部门为工资保护计划设定的合规比例"],
  ["عدم تسجيل العاملين حسب أنماط العمل الحديثة بالمنصة المعتمدة للوزارة", "Not registering workers by modern work patterns on the Ministry's approved platform", "Ne pas enregistrer les travailleurs selon les modes de travail modernes sur la plateforme agréée du Ministère", "未在部门认可的平台上按新型工作模式登记工人"],
  ["ممارسة نشاط الاستقدام أو الإسناد أو تقديم الخدمات العمالية دون ترخيص من الوزارة", "Carrying out recruitment, assignment or labour-service activity without the Ministry's licence", "Exercer une activité de recrutement, de mise à disposition ou de services de main-d'œuvre sans licence du Ministère", "未经部门许可从事招聘、派遣或劳务服务活动"],
  ["ممارسة نشاط توظيف السعوديين دون ترخيص من الوزارة", "Carrying out Saudi-recruitment activity without the Ministry's licence", "Exercer une activité de recrutement de Saoudiens sans licence du Ministère", "未经部门许可从事沙特籍人员招聘活动"],
  ["ترك صاحب العمل عامله يعمل لدى الغير أو يعمل لحسابه الخاص", "An employer letting their worker work for others or on their own account", "Un employeur laissant son travailleur travailler pour autrui ou pour son propre compte", "雇主让其工人为他人工作或自营"],
  ["توظيف عامل غيره دون الحصول على إشعار أجير", "Employing another employer's worker without obtaining an Ajeer notice", "Employer le travailleur d'un autre sans avoir obtenu d'avis Ajeer", "未取得 Ajeer 通知而雇用他人的工人"],
  ["استخدام التأشيرات الصادرة من الوزارة لغير الغرض الذي أصدرت من أجله", "Using visas issued by the Ministry for a purpose other than the one they were issued for", "Utiliser des visas délivrés par le Ministère à une fin autre que celle pour laquelle ils ont été délivrés", "将部门签发的签证用于非签发目的"],
  ["عدم إفصاح المنشأة عن بيانات عقود التشغيل والصيانة مع الجهات الحكومية/المنشآت التي تساهم فيها الدولة بنسبة لا تقل عن 51% بعد 6 أشهر من الترسية، أو الإفصاح بمعلومات غير صحيحة أو غير مكتملة", "The establishment not disclosing the data of operation and maintenance contracts with government entities/establishments in which the State holds no less than 51% after 6 months from award, or disclosing incorrect or incomplete information", "L'établissement ne divulguant pas les données des contrats d'exploitation et de maintenance avec les entités gouvernementales/établissements dans lesquels l'État détient au moins 51 % après 6 mois depuis l'attribution, ou divulguant des informations inexactes ou incomplètes", "企业在中标 6 个月后，未向政府机构/国家持股不低于 51% 的企业披露运营和维护合同数据，或披露不实或不完整的信息"],
  ["عدم تحديث بيانات عقود التشغيل والصيانة مع الجهات العامة وبيانات العاملين (نصف سنوي)", "Not updating the data of operation and maintenance contracts with public entities and workers' data (half-yearly)", "Ne pas mettre à jour les données des contrats d'exploitation et de maintenance avec les entités publiques et les données des travailleurs (semestriel)", "未更新与公共机构的运营和维护合同数据及工人数据（每半年）"],
  ["ممارسة الأفراد نشاط توظيف السعوديين أو استقدام العمال أو الإسناد دون ترخيص (مباشرة أو غير مباشرة)", "Individuals carrying out Saudi-recruitment, worker-recruitment or assignment activity without a licence (directly or indirectly)", "Des particuliers exerçant une activité de recrutement de Saoudiens, de recrutement de travailleurs ou de mise à disposition sans licence (directement ou indirectement)", "个人未经许可（直接或间接）从事沙特籍人员招聘、劳工招募或派遣活动"],
  ["غير مؤكد من المصدر", "Not confirmed from the source", "Non confirmé par la source", "来源未确认"],
  [" (غير مؤكد من المصدر)", " (not confirmed from the source)", " (non confirmé par la source)", "（来源未确认）"],

  // ---- مصادر المراجع (اقتباسات الوثائق: الأرقام تأتي من النص الأصلي) -----------------------------------------------------------
  ["قرار وزاري {0}، ص{1}، الفئة (أ) م {2}", "Ministerial decision {0}, p. {1}, category (A), art. {2}", "Décision ministérielle {0}, p. {1}, catégorie (A), art. {2}", "部长决定 {0}，第 {1} 页，类别（A），第 {2} 条"],
  ["قرار وزاري {0}، ص{1}، الفئة (د) م {2}", "Ministerial decision {0}, p. {1}, category (D), art. {2}", "Décision ministérielle {0}, p. {1}, catégorie (D), art. {2}", "部长决定 {0}，第 {1} 页，类别（D），第 {2} 条"],
  ["قرار وزاري {0}، ص{1}، الفئة (ط) م {2}", "Ministerial decision {0}, p. {1}, category (I), art. {2}", "Décision ministérielle {0}, p. {1}, catégorie (I), art. {2}", "部长决定 {0}，第 {1} 页，类别（I），第 {2} 条"],
  ["قرار {0}، ص{1} البند {2}", "Decision {0}, p. {1}, item {2}", "Décision {0}, p. {1}, point {2}", "决定 {0}，第 {1} 页，第 {2} 项"],
  ["قرار {0} ص{1} البند {2}", "Decision {0}, p. {1}, item {2}", "Décision {0}, p. {1}, point {2}", "决定 {0}，第 {1} 页，第 {2} 项"],
  ["قرار وزاري {0}، البند {1} ({2}–{3})، الصفحة الوحيدة", "Ministerial decision {0}, item {1} ({2}–{3}), the single page", "Décision ministérielle {0}, point {1} ({2}–{3}), page unique", "部长决定 {0}，第 {1} 项（{2}–{3}），仅一页"],
  ["أولاً", "first", "premier", "第一"],
  ["ثانياً", "second", "deuxième", "第二"],
  ["ثالثاً", "third", "troisième", "第三"],
  ["رابعاً", "fourth", "quatrième", "第四"],
  ["سادساً", "sixth", "sixième", "第六"],
  ["الدليل الإجرائي لنطاقات المطور {0} (نسخة مارس {1})، المرفق رقم {2}، النشاط رقم {3}", "Procedural guide for Nitaqat Al-Mutawwar (Developed Nitaqat) {0} (March {1} edition), annex no. {2}, activity no. {3}", "Guide procédural de Nitaqat Al-Mutawwar (Nitaqat développé) {0} (édition de mars {1}), annexe n° {2}, activité n° {3}", "Nitaqat Al-Mutawwar（升级版 Nitaqat）{0} 程序指南（{1} 年三月版），附件 {2}，活动 {3}"],

  // ---- أنشطة نطاقات المطور (المرجع: الأسماء كما وردت، ترجمة عمل) -------------------------------------------------------------
  ["الإنتاج الزراعي والحيواني وخدماتها واندية الفروسية", "Agricultural and animal production, related services and equestrian clubs", "Production agricole et animale, services connexes et clubs équestres", "农业和畜牧生产、相关服务及马术俱乐部"],
  ["أنشطة الهيدروكربونات وعملياتها", "Hydrocarbon activities and operations", "Activités et opérations d'hydrocarbures", "碳氢化合物活动及作业"],
  ["تعدين المعادن الفلزية والأحجار الكريمة", "Mining of metallic minerals and precious stones", "Extraction de minerais métalliques et de pierres précieuses", "金属矿物和宝石开采"],
  ["تعدين المعادن غير الفلزية والصناعية", "Mining of non-metallic and industrial minerals", "Extraction de minerais non métalliques et industriels", "非金属和工业矿物开采"],
  ["تعدين مواد البناء", "Mining of building materials", "Extraction de matériaux de construction", "建筑材料开采"],
  ["الطاقة والمياه وخدماتها", "Energy, water and related services", "Énergie, eau et services connexes", "能源、水务及相关服务"],
  ["الصناعات", "Industries", "Industries", "工业"],
  ["مقاولات التشييد والبناء", "Construction contracting", "Entreprises de construction", "建筑施工承包"],
  ["التشغيل والصيانة", "Operation and maintenance", "Exploitation et maintenance", "运营和维护"],
  ["مقاولات النظافة والمغاسل", "Cleaning and laundry contracting", "Entreprises de nettoyage et blanchisseries", "清洁和洗衣承包"],
  ["البيع بالتجزئة للعطور والساعات", "Retail of perfumes and watches", "Vente au détail de parfums et de montres", "香水和钟表零售"],
  ["البيع بالتجزئة للأزياء والكماليات والسلع المتنوعة", "Retail of fashion, accessories and miscellaneous goods", "Vente au détail de mode, d'accessoires et de marchandises diverses", "时装、配饰和杂货零售"],
  ["السلع النسائية ،بيع الهواتف المحمولة وصيانتها", "Women's goods, sale and maintenance of mobile phones", "Articles pour femmes, vente et maintenance de téléphones mobiles", "女性用品、手机销售和维修"],
  ["حلول الاتصالات", "Telecommunications solutions", "Solutions de télécommunications", "电信解决方案"],
  ["أنشطة البريد", "Postal activities", "Activités postales", "邮政活动"],
  ["البنية التحتية لتقنية المعلومات", "Information technology infrastructure", "Infrastructure des technologies de l'information", "信息技术基础设施"],
  ["البنية التحتية لالتصاالت", "Telecommunications infrastructure", "Infrastructure de télécommunications", "电信基础设施"],
  ["التشغيل والصيانة لالتصاالت", "Telecommunications operation and maintenance", "Exploitation et maintenance des télécommunications", "电信运营和维护"],
  ["التشغيل والصيانة لتقنية المعلومات", "Information technology operation and maintenance", "Exploitation et maintenance des technologies de l'information", "信息技术运营和维护"],
  ["حلول تقنية المعلومات", "Information technology solutions", "Solutions des technologies de l'information", "信息技术解决方案"],
  ["النقل البري والتخزين", "Land transport and storage", "Transport terrestre et entreposage", "陆运和仓储"],
  ["النقل البحري والجوي", "Sea and air transport", "Transport maritime et aérien", "海运和空运"],
  ["مطاعم مع الخدمة لا تشمل مطاعم الوجبات السريعة", "Table-service restaurants, excluding fast-food restaurants", "Restaurants avec service, hors restauration rapide", "提供餐桌服务的餐厅（不含快餐店）"],
  ["مطاعم خدمة سريعة ومحالت الآيسكريم", "Fast-service restaurants and ice-cream shops", "Restaurants à service rapide et glaciers", "快餐店和冰淇淋店"],
  ["المقاهي ومحالت تقديم المشروبات", "Cafés and beverage outlets", "Cafés et points de vente de boissons", "咖啡馆和饮品店"],
  ["التموين والإعاشة", "Catering and food supply", "Restauration collective et approvisionnement", "餐饮供应和伙食"],
  ["حراسات أمنية ومكاتب التوظيف الأهلية", "Security guarding and private employment offices", "Gardiennage et bureaux de placement privés", "安保守卫和民营职业介绍机构"],
  ["المؤسسات المالية", "Financial institutions", "Établissements financiers", "金融机构"],
  ["خدمات الأعمال", "Business services", "Services aux entreprises", "商务服务"],
  ["الخدمات الاجتماعية", "Social services", "Services sociaux", "社会服务"],
  ["الخدمات الشخصية", "Personal services", "Services à la personne", "个人服务"],
  ["التعليم العالي", "Higher education", "Enseignement supérieur", "高等教育"],
  ["التعليم العالي للتخصصات الصحية", "Higher education in health specialties", "Enseignement supérieur en spécialités de santé", "健康专业高等教育"],
  ["مدارس البنات ورياض الأطفال والحضانات", "Girls' schools, kindergartens and nurseries", "Écoles de filles, jardins d'enfants et crèches", "女子学校、幼儿园和托儿所"],
  ["المدارس الأجنبية", "Foreign schools", "Écoles étrangères", "外国学校"],
  ["المختبرات والخدمات الصحية", "Laboratories and health services", "Laboratoires et services de santé", "实验室和医疗服务"],
  ["الإيواء والترفيه والسياحة", "Accommodation, entertainment and tourism", "Hébergement, divertissement et tourisme", "住宿、娱乐和旅游"],
  ["السلع الأساسية والمحروقات", "Essential goods and fuels", "Biens essentiels et carburants", "基本商品和燃料"],
  ["مدارس البنين ومجمعات البنين والبنات", "Boys' schools and boys' and girls' school complexes", "Écoles de garçons et complexes scolaires de garçons et de filles", "男子学校及男女学校园区"],
  ["الكيانات المجمعة", "Consolidated entities", "Entités consolidées", "合并实体"],
];

// ---- ترويسة القشرة المشتركة: تأتي من جدول الموقع نفسه (SV1_TEXT) لا من ترجمتي ------------------------------------------
const HDR_KEYS = ["testMode", "barStatus", "barCity", "navServices", "navBook", "navHow", "navAccount", "navCart", "login", "navSite", "logout"];
const CHROME = [];
for (const k of HDR_KEYS) {
  const e = SV1_TEXT && SV1_TEXT[k];
  if (e && e.ar && e.en && e.fr && e.zh) CHROME.push([e.ar, e.en, e.fr, e.zh]);
}

// فرنسية: المسافة الدقيقة قبل : ; ? ! » وبعد «
const frTypo = (s) => s.replace(/ ([:;?!»])/g, "\u00a0$1").replace(/(«) /g, "$1\u00a0");

// القاموس النهائي: ar → [en, fr, zh]. التكرار بنفس المفتاح: الأول يفوز (ما في CHROME لا يطغى على ما عندي).
export const DICT = {};
for (const [ar, en, fr, zh] of [...UI, ...CHROME]) {
  if (Object.prototype.hasOwnProperty.call(DICT, ar)) continue;
  DICT[ar] = [en, frTypo(fr), zh];
}
export const DICT_ENTRIES = UI.length + CHROME.length;
export const ARABIC_RE = /[\u0600-\u06FF]/;

// ========================================================== المشغّل (المتصفح) ==
// تُحقن بـ toString(). env: { dict, doc, win, app }
export function shrI18nClient(env) {
  var DICT = env.dict, IDX = { en: 0, fr: 1, zh: 2 };
  var AR = /[\u0600-\u06FF]/;
  var lang = 'ar', TPL = [], titleAr = null;
  var DM = { en: { ': ': ':' }, fr: { ': ': '\u00a0:' }, zh: { ': ': '\uff1a' } };

  var TRA = ['placeholder', 'title', 'aria-label', 'alt', 'data-label'];
  var ESC = /[.*+?^$(){}|[\]\\\/]/g;

  Object.keys(DICT).forEach(function (k) {
    if (!/\{\d+\*?\}/.test(k)) return;
    var parts = k.split(/(\{\d+\*?\})/), re = '^', slots = [], lit = 0;
    parts.forEach(function (p) {
      var m = /^\{(\d+)(\*?)\}$/.exec(p);
      if (m) { re += '([\\s\\S]+?)'; slots.push({ n: +m[1], lenient: !!m[2] }); }
      else { re += p.replace(ESC, '\\$&'); lit += p.length; }
    });
    TPL.push({ key: k, re: new RegExp(re + '$'), slots: slots, lit: lit });
  });
  TPL.sort(function (a, b) { return b.lit - a.lit; });

  function plural(L, n, a, b) { var v = Number(n); return (L === 'fr' ? v < 2 : v === 1) ? a : b; }

  // يُرجع النص المترجَم أو null إن تعذّر (فيه عربية لم نعرفها).
  function one(s, L, ctx) {
    if (!AR.test(s)) return s;
    var i = IDX[L], e = (ctx && DICT[s + '@' + ctx]) || DICT[s];
    if (e && e[i]) return e[i];
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
    if (m[1] || m[3]) { if (!m[2]) return s; var r0 = one(m[2], L, ctx); return r0 === null ? null : m[1] + r0 + (L === 'zh' && /\uff1a$/.test(r0) ? '' : m[3]); }
    for (var t = 0; t < TPL.length; t++) {
      var x = TPL[t].re.exec(s);
      if (!x) continue;
      var caps = [], ok = true;
      for (var j = 0; j < TPL[t].slots.length; j++) {
        var sl = TPL[t].slots[j], c = x[j + 1], tc = AR.test(c) ? one(c, L, ctx) : c;
        if (tc === null) { if (sl.lenient) tc = (c.indexOf('، ') > 0 ? listTr(c, L, ctx, true) : null) || c; else { ok = false; break; } }
        else if (!sl.lenient && AR.test(tc)) { ok = false; break; }
        caps[sl.n] = tc;
      }
      if (!ok) continue;
      var out = DICT[TPL[t].key][i];
      if (!out) continue;
      out = out.replace(/\{(\d+)\|([^|}]*)\|([^}]*)\}/g, function (_, n, a, b) { return plural(L, caps[+n], a, b); });
      return out.replace(/\{(\d+)\}/g, function (_, n) { return caps[+n] === undefined ? '' : caps[+n]; });
    }
    // قائمة مفصولة بـ«، »: تُترجَم إن كانت كل عناصرها معروفة (أسماء مكوّنات مثلاً)، وإلا تبقى كما هي (بيانات).
    if (s.indexOf('، ') > 0) { var li = listTr(s, L, ctx, false); if (li !== null) return li; }
    // «وسم: قيمة» — الوسم المعروف يُترجَم ويُترك ما بعده (بيانات) كما هو؛ يُمرَّر الوسم والقيمة عُقدتين منفصلتين.
    var cm = /^([\s\S]+?):(\s*)$/.exec(s);
    if (cm && AR.test(cm[1])) { var rl = one(cm[1], L, ctx); if (rl !== null) return rl + DM[L][': ']; }
    return null;
  }
  function listTr(s, L, ctx, partial) {
    var items = s.split('، '), out = [], all = true, any = false;
    for (var q = 0; q < items.length; q++) {
      var it = items[q], r = AR.test(it) ? one(it, L, ctx) : it;
      if (r === null) { all = false; out.push(it); } else { if (AR.test(it)) any = true; out.push(r); }
    }
    return (any && (all || partial)) ? out.join(L === 'zh' ? '\u3001' : ', ') : null;
  }
  function trL(s, L, ctx) {
    if (s == null || L === 'ar' || IDX[L] === undefined) return s;
    s = String(s);
    // رموز بلا عربية لها اتجاه (‹ و ←): تُقلَب في اللغات اللاتينية.
    if (!AR.test(s)) { var tk = DICT[s]; return tk && tk[IDX[L]] ? tk[IDX[L]] : s; }
    var r = one(s, L, ctx);
    return r === null ? s : r;
  }
  function tr(s, ctx) { return trL(s, lang, ctx); }

  var doc = env.doc, win = env.win;
  function qsa(sel) { try { return doc.querySelectorAll(sel); } catch (e) { return []; } }
  function mkText(c, ctx) { var n = doc.createTextNode(tr(c, ctx)); n._t = 1; n._ar = c; n._c = ctx; return n; }
  function setAttr(e, k, v) {
    if (TRA.indexOf(k) >= 0 && typeof v === 'string' && AR.test(v)) { (e._arA = e._arA || {})[k] = v; e.setAttribute(k, tr(v)); }
    else e.setAttribute(k, v);
  }
  function trAny(a) { if (a && a.join) { var o = ''; for (var i = 0; i < a.length; i++) o += tr(a[i]); return o; } return tr(a); }
  function put(el, ar) { el._arC = ar; el.textContent = trAny(ar); }
  function setText(n, v) { if ('nodeValue' in n) n.nodeValue = v; else n.text = v; }
  function walk(n) {
    if (!n) return;
    if (n._t) { setText(n, tr(n._ar, n._c)); return; }
    if (n._arA) for (var k in n._arA) n.setAttribute(k, tr(n._arA[k]));
    if (n._arC !== undefined) { n.textContent = trAny(n._arC); return; }
    var ch = n.childNodes || n.children;
    if (ch) for (var i = 0; i < ch.length; i++) walk(ch[i]);
  }
  // يتبنّى النصوص الثابتة في HTML المولَّد (الترويسة وشريط التحميل) فتُترجَم وتعود إلى العربية.
  function adopt(root) {
    try {
      if (!doc || !doc.createTreeWalker || !root) return;
      var w = doc.createTreeWalker(root, 4, null), n, list = [];
      while ((n = w.nextNode())) list.push(n);
      list.forEach(function (t) {
        if (t._t) return;
        var p = t.parentNode;
        if (p && p.closest && p.closest('[data-i18n-skip],script,style')) return;
        if (AR.test(t.nodeValue)) { t._ar = t.nodeValue; t._t = 1; t._c = p && p.tagName ? p.tagName.toLowerCase() : ''; }
      });
      var els = root.querySelectorAll('[placeholder],[title],[aria-label],[alt]');
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el.closest && el.closest('[data-i18n-skip]')) continue;
        TRA.forEach(function (a) { var v = el.getAttribute(a); if (v && AR.test(v) && !(el._arA && el._arA[a])) { (el._arA = el._arA || {})[a] = v; } });
      }
    } catch (e) {}
  }
  function mark() {
    var bs = qsa('[data-shr-lang]');
    for (var i = 0; i < bs.length; i++) {
      var on = bs[i].getAttribute('data-shr-lang') === lang;
      bs[i].setAttribute('aria-pressed', on ? 'true' : 'false');
      if (bs[i].classList) { if (on) bs[i].classList.add('on'); else bs[i].classList.remove('on'); }
    }
  }
  function setLang(l, silent) {
    if (l !== 'ar' && IDX[l] === undefined) return false;
    lang = l;
    try { var de = doc.documentElement; de.setAttribute('lang', l); de.setAttribute('dir', l === 'ar' ? 'rtl' : 'ltr'); } catch (e) {}
    if (!silent) { try { win.localStorage.setItem('shr_lang', l); } catch (e) {} }
    try { if (doc.body) adopt(doc.body); } catch (e) {}
    try { walk(doc.body || env.app); } catch (e) { try { walk(env.app); } catch (e2) {} }
    try { if (titleAr !== null) doc.title = tr(titleAr); } catch (e) {}
    mark();
    return true;
  }
  function init() {
    try { titleAr = doc.title; } catch (e) {}
    try { if (doc.body) adopt(doc.body); } catch (e) {}
    try {
      doc.addEventListener('click', function (ev) {
        var t = ev.target, b = t && t.closest ? t.closest('[data-shr-lang]') : null;
        if (b) setLang(b.getAttribute('data-shr-lang'));
      });
    } catch (e) {}
    // عناصر تُحقن بعد التحميل خارج #app (شريط «وضع الاختبار» من القشرة المشتركة): تُتبنّى وتُترجَم عند ظهورها.
    try {
      if (win.MutationObserver && doc.body) {
        new win.MutationObserver(function (muts) {
          if (lang === 'ar') return;
          for (var i = 0; i < muts.length; i++) {
            var ad = muts[i].addedNodes;
            for (var j = 0; j < ad.length; j++) {
              var n = ad[j];
              if (n.nodeType !== 1 || (n.closest && n.closest('#app'))) continue;
              adopt(n); walk(n);
            }
          }
        }).observe(doc.body, { childList: true, subtree: true });
      }
    } catch (e) {}
    var saved = null;
    try { saved = win.localStorage.getItem('shr_lang'); } catch (e) {}
    if (saved && IDX[saved] !== undefined) setLang(saved, true); else mark();
  }
  return { tr: tr, trL: trL, text: mkText, attr: setAttr, put: put, lang: function () { return lang; }, setLang: setLang, init: init, adopt: adopt, walk: walk };
}

// ============================================================ المحدد و CSS ==
export const I18N_CSS = `
/* المحدد داخل شريط الحالة (خلفيته var(--ac)): ألوان من الرموز فقط، والتظليل color-mix على لون النص نفسه. */
.shr-langs{display:inline-flex;gap:2px;align-items:center;font-family:var(--fm);font-size:11px;letter-spacing:.04em}
.shr-langs button{appearance:none;border:0;background:transparent;color:inherit;font:inherit;letter-spacing:inherit;cursor:pointer;padding:0 9px;min-height:28px;min-width:30px;border-radius:7px;opacity:.65}
.shr-langs button:hover{opacity:.95;background:color-mix(in srgb,currentColor 12%,transparent)}
.shr-langs button.on,.shr-langs button[aria-pressed="true"]{opacity:1;color:#fff;background:color-mix(in srgb,currentColor 18%,transparent)}
.shr-langs button[data-shr-lang="ar"]{font-family:"IBM Plex Sans Arabic",system-ui,sans-serif;font-size:14px;letter-spacing:0}
.shr-langs button:focus-visible{outline:2px solid currentColor;outline-offset:1px}
.shr-langbar{display:flex;justify-content:flex-end;margin:0 0 10px;color:var(--ink)}
.shr-langbar .shr-langs button.on,.shr-langbar .shr-langs button[aria-pressed="true"]{color:#fff;background:var(--ac)}
html[lang="ar"] .shr-trnote{display:none}
.shr-trnote{margin:0 0 12px;font-size:12px;color:var(--mut)}
html[lang="zh"] .sv1,html[lang="zh"] .shr{font-family:"IBM Plex Sans","PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Noto Sans SC","WenQuanYi Zen Hei",system-ui,sans-serif;line-height:1.75}
html[lang="en"] .sv1,html[lang="fr"] .sv1{font-family:"IBM Plex Sans","IBM Plex Sans Arabic",system-ui,-apple-system,"Segoe UI",sans-serif}
`;

// يُحقن داخل ترويسة القشرة (شريط الحالة العلوي)؛ وإن لم تُوجد الحاوية يسقط إلى سطر فوق المحتوى.
export function langSwitcherHtml() {
  const btn = ([c, label, name]) => `<button type="button" data-shr-lang="${c}" lang="${c}" aria-label="${name}" aria-pressed="${c === "ar" ? "true" : "false"}"${c === "ar" ? ' class="on"' : ""}>${label}</button>`;
  return `<span class="shr-langs" role="group" aria-label="Language" data-i18n-skip>${SHR_LANGS.map(btn).join("")}</span>`;
}
