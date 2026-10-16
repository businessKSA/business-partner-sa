// Business Partner — Simple V1: «Business Partner AI» (/ai).
//
// صفحة المنتج على SV1.shell() بأربع لغات (ar/en/fr/zh)، بنمط simple-v1-eor.mjs. يملكها وكيل `ai-workspace`.
// المنصة نفسها لا تعيش هنا: لكل شركة مساحة Open WebUI مستقلة على ai.businesspartner.sa (خادم Azure)،
// وهذه الصفحة تشرحها وتعرض باقاتها وتستقبل طلب المساحة.
//
// ما خلفها: api/_aiws.js عبر /api/requests?__route=ai
//   GET  action=plans  ← الباقات من المنصة نفسها (لا تُكتب هنا يدوياً)، بلا أسعار: الأسعار للمسجّلين وحدهم.
//   POST action=trial  ← طلب تجربة ← Unified Revenue Intake في n8n (صفقة + مهمة للمبيعات، ثم فريق نايف).
// الطلب لا يُنشئ مساحة: الإنشاء على الخادم بيد الفريق. لهذا لا تَعِد الصفحة بتفعيل فوري.
//
// بلا main.js (قشرة SV1 وحدها) ولا localStorage. كل نصٍّ من الخادم يدخل الصفحة بـtextContent.
// السكربت العميل دالةٌ عاديّة (aiClient) تُسلسَل بـtoString، فلا يُضاعَف فيها الـbackslash.

// ar, en, fr, zh
const D = {
  title: ["Business Partner AI", "Business Partner AI", "Business Partner AI", "Business Partner AI"],
  tag: ["مساحة ذكاء اصطناعي للشركات", "AI workspace for companies", "Espace IA pour entreprises", "企业 AI 工作空间"],
  sub: ["مساحة خاصة لشركتك، يعمل فيها فريقك مع الذكاء الاصطناعي", "A private workspace where your team works with AI", "Un espace privé où votre équipe travaille avec l'IA", "专属于贵公司的空间，团队在此与 AI 协作"],
  lead: [
    "لكل شركة مساحتها المستقلة: محادثات فريقك مع الذكاء الاصطناعي، وملفات الشركة ومعرفتها، في مكان واحد لا يراه غيركم. يدخلها فريقك ببريد الشركة.",
    "Each company gets its own isolated workspace: your team's AI conversations, company files and knowledge, in one place nobody else can see. Your team signs in with the company email.",
    "Chaque entreprise dispose de son propre espace isolé : les conversations IA de votre équipe, vos fichiers et votre savoir, au même endroit, invisibles pour les autres. Votre équipe se connecte avec l'e-mail de l'entreprise.",
    "每家公司拥有独立空间：团队与 AI 的对话、公司文件与知识集中一处，他人不可见。团队使用公司邮箱登录。",
  ],
  desc: [
    "Business Partner AI: مساحة ذكاء اصطناعي خاصة لكل شركة — محادثات الفريق وملفات الشركة ومعرفتها في مكان واحد، ودخول ببريد الشركة. اطلب مساحة لشركتك.",
    "Business Partner AI: a private AI workspace for each company — team conversations, company files and knowledge in one place, with company-email sign-in. Request your workspace.",
    "Business Partner AI : un espace IA privé pour chaque entreprise — conversations d'équipe, fichiers et savoir au même endroit, connexion par e-mail d'entreprise. Demandez votre espace.",
    "Business Partner AI：为每家公司提供专属 AI 工作空间——团队对话、公司文件与知识集中一处，使用公司邮箱登录。申请空间。",
  ],
  cta: ["اطلب مساحة لشركتك", "Request your company workspace", "Demandez l'espace de votre entreprise", "为贵公司申请空间"],
  loginNote: ["لديك مساحة؟ ادخل من رابط شركتك الذي وصلك منّا.", "Already have a workspace? Sign in from your company link we sent you.", "Vous avez déjà un espace ? Connectez-vous via le lien de votre entreprise.", "已有空间？请通过我们发送给您的公司链接登录。"],
  whatH: ["ماذا تحصل عليه", "What you get", "Ce que vous obtenez", "您将获得"],
  f1: ["مساحة مستقلة لشركتك", "An isolated workspace", "Un espace isolé", "独立空间"],
  f1p: ["مساحة خاصة بشركتك وحدها، منفصلة عن غيرها، باسم شركتك وشعارها.", "A workspace for your company alone, separate from any other, with your name and logo.", "Un espace réservé à votre entreprise, séparé des autres, à votre nom et avec votre logo.", "仅属于贵公司的空间，与他人隔离，带有贵公司名称与标识。"],
  f2: ["فريقك ببريد الشركة", "Your team, by company email", "Votre équipe, par e-mail d'entreprise", "团队使用公司邮箱"],
  f2p: ["يسجّل الدخول من يحمل بريداً من نطاق شركتك فقط، ويضيف المدير زملاءه من لوحة الإدارة.", "Only people with an email on your company domain can sign in, and the admin adds colleagues from the admin panel.", "Seules les adresses du domaine de votre entreprise peuvent se connecter ; l'administrateur ajoute ses collègues.", "仅限公司域名邮箱登录，管理员可在管理面板添加同事。"],
  f3: ["ملفات الشركة ومعرفتها", "Company files and knowledge", "Fichiers et savoir de l'entreprise", "公司文件与知识"],
  f3p: ["ارفع مستنداتك واسأل عنها، واحفظ ملاحظات الفريق في مكان واحد.", "Upload your documents and ask about them, and keep team notes in one place.", "Téléversez vos documents et interrogez-les, et gardez les notes de l'équipe au même endroit.", "上传文档并就其提问，团队笔记集中保存。"],
  f4: ["على Azure في السويد", "On Azure in Sweden", "Sur Azure en Suède", "部署于瑞典 Azure"],
  f4p: ["المنصة ونماذجها تعمل على Microsoft Azure في منطقة السويد، وحدود الاستخدام مضبوطة لكل شركة.", "The platform and its models run on Microsoft Azure in the Sweden region, with usage limits set per company.", "La plateforme et ses modèles tournent sur Microsoft Azure en Suède, avec des limites d'usage par entreprise.", "平台及其模型运行于 Microsoft Azure 瑞典区域，并为每家公司设定用量上限。"],
  plansH: ["الباقات", "Plans", "Formules", "套餐"],
  plansP: ["تُقرأ مباشرة من المنصة. تصلك الأسعار مع ردّنا على طلبك.", "Read live from the platform. Prices come with our reply to your request.", "Lues en direct depuis la plateforme. Les prix vous parviennent avec notre réponse.", "直接读取自平台。价格随我们的回复一并发送。"],
  plansLoad: ["جارٍ تحميل الباقات…", "Loading plans…", "Chargement des formules…", "正在加载套餐…"],
  plansErr: ["تعذّر تحميل الباقات الآن. اطلب مساحتك وسنرسلها لك.", "Plans could not be loaded right now. Request your workspace and we will send them to you.", "Impossible de charger les formules. Demandez votre espace et nous vous les enverrons.", "暂时无法加载套餐。申请空间后我们会发送给您。"],
  seats: ["مستخدمون", "users", "utilisateurs", "位用户"],
  days: ["يوماً", "days", "jours", "天"],
  seat1: ["مستخدم واحد", "1 user", "1 utilisateur", "1 位用户"],
  credit: ["رصيد استخدام", "usage credit", "crédit d'usage", "用量额度"],
  pn_individual: ["فرد", "Individual", "Individuel", "个人"],
  pn_business: ["أعمال", "Business", "Entreprise", "商务"],
  pn_business_plus: ["أعمال بلس", "Business Plus", "Entreprise Plus", "商务增强版"],
  pn_enterprise: ["مؤسسات", "Enterprise", "Grands comptes", "企业版"],
  ft_chat: ["محادثات مع الذكاء الاصطناعي", "AI conversations", "Conversations IA", "AI 对话"],
  ft_files: ["رفع الملفات والسؤال عنها", "File upload and Q&A", "Fichiers et questions", "文件上传与问答"],
  ft_notes: ["ملاحظات الفريق", "Team notes", "Notes d'équipe", "团队笔记"],
  ft_knowledge: ["قاعدة معرفة الشركة", "Company knowledge base", "Base de connaissances", "公司知识库"],
  ft_connectors: ["الربط مع أنظمتك", "Connectors to your systems", "Connecteurs", "系统连接"],
  ft_custom_agents: ["مستشارون مخصّصون لشركتك", "Custom advisors for your company", "Conseillers personnalisés", "定制顾问"],
  ft_priority: ["أولوية في الدعم", "Priority support", "Support prioritaire", "优先支持"],
  ft_audit: ["سجل تدقيق", "Audit log", "Journal d'audit", "审计日志"],
  ft_dedicated_support: ["دعم مخصّص", "Dedicated support", "Support dédié", "专属支持"],
  howH: ["كيف تبدأ", "How to start", "Comment commencer", "如何开始"],
  s1: ["تطلب مساحة باسم شركتك وبريدها", "You request a workspace with your company name and email", "Vous demandez un espace avec le nom et l'e-mail de l'entreprise", "以公司名称和邮箱申请空间"],
  s2: ["يتواصل معك فريقنا ويجهّز مساحة شركتك باسمها وشعارها", "Our team contacts you and prepares your workspace with your name and logo", "Notre équipe vous contacte et prépare votre espace à votre nom", "我们的团队联系您，并以贵公司名称与标识准备空间"],
  s3: ["يصلك رابط مساحتك، فتدخل أنت وفريقك ببريد الشركة", "You receive your workspace link; you and your team sign in with the company email", "Vous recevez le lien ; vous et votre équipe vous connectez avec l'e-mail de l'entreprise", "您收到空间链接，您与团队用公司邮箱登录"],
  s4: ["تختار باقتك حين تكون جاهزاً", "You pick your plan when you are ready", "Vous choisissez votre formule quand vous êtes prêt", "准备好后选择套餐"],
  formH: ["اطلب مساحة لشركتك", "Request a workspace for your company", "Demandez un espace pour votre entreprise", "为贵公司申请空间"],
  formP: ["لا يُلزمك الطلب بشيء. يراجعه فريقنا ويعود إليك.", "The request commits you to nothing. Our team reviews it and gets back to you.", "La demande ne vous engage à rien. Notre équipe l'examine et revient vers vous.", "申请不构成任何约束。我们的团队审核后与您联系。"],
  fCompany: ["اسم الشركة", "Company name", "Nom de l'entreprise", "公司名称"],
  fWebsite: ["موقع الشركة (اختياري)", "Company website (optional)", "Site web (facultatif)", "公司网站（选填）"],
  fName: ["اسمك", "Your name", "Votre nom", "您的姓名"],
  fEmail: ["بريد الشركة", "Company email", "E-mail professionnel", "公司邮箱"],
  fEmailHint: ["بنطاق شركتك، فهو ما يدخل به فريقك.", "On your company domain — it is what your team signs in with.", "Sur le domaine de l'entreprise — c'est l'identifiant de votre équipe.", "需为公司域名邮箱，团队将以此登录。"],
  fPhone: ["الجوال", "Mobile", "Mobile", "手机"],
  fTeam: ["عدد من سيستخدمها", "How many will use it", "Nombre d'utilisateurs", "使用人数"],
  fTeamPick: ["اختر", "Choose", "Choisir", "请选择"],
  fUse: ["ماذا تريد أن يفعل فريقك بها؟ (اختياري)", "What do you want your team to do with it? (optional)", "Que souhaitez-vous en faire ? (facultatif)", "您希望团队用它做什么？（选填）"],
  send: ["أرسل الطلب", "Send request", "Envoyer", "提交申请"],
  sending: ["جارٍ الإرسال…", "Sending…", "Envoi…", "正在提交…"],
  done: ["استلمنا طلبك. رقم المرجع:", "We received your request. Reference:", "Demande reçue. Référence :", "已收到您的申请。参考编号："],
  doneNext: ["سيتواصل معك فريقنا قريباً.", "Our team will contact you soon.", "Notre équipe vous contactera bientôt.", "我们的团队将尽快与您联系。"],
  eCompany: ["اكتب اسم الشركة.", "Enter the company name.", "Indiquez le nom de l'entreprise.", "请填写公司名称。"],
  eName: ["اكتب اسمك.", "Enter your name.", "Indiquez votre nom.", "请填写您的姓名。"],
  eEmail: ["اكتب بريداً صحيحاً.", "Enter a valid email.", "Saisissez un e-mail valide.", "请填写有效邮箱。"],
  eEmailFree: ["نحتاج بريد الشركة لا بريداً شخصياً، فبه يدخل فريقك.", "We need the company email, not a personal one — your team signs in with it.", "Il nous faut l'e-mail de l'entreprise, pas un e-mail personnel.", "需要公司邮箱而非个人邮箱，团队将以此登录。"],
  ePhone: ["اكتب رقم جوال صحيحاً.", "Enter a valid mobile number.", "Saisissez un numéro valide.", "请填写有效手机号。"],
  eRate: ["أرسلت طلبات كثيرة. حاول بعد قليل.", "Too many requests. Please try again shortly.", "Trop de demandes. Réessayez plus tard.", "请求过多，请稍后再试。"],
  eNet: ["تعذّر الإرسال. حاول مرة أخرى.", "Could not send. Please try again.", "Envoi impossible. Réessayez.", "提交失败，请重试。"],
  faqH: ["أسئلة شائعة", "Frequently asked questions", "Questions fréquentes", "常见问题"],
  q1: ["هل يرى أحد بيانات شركتي؟", "Can anyone else see my company's data?", "Quelqu'un d'autre voit-il nos données ?", "他人能看到我公司的数据吗？"],
  a1: ["لا. لكل شركة مساحة مستقلة بقاعدة بياناتها، ولا يدخلها إلا من يحمل بريداً من نطاقها.", "No. Each company has its own workspace with its own database, and only people with an email on its domain can enter.", "Non. Chaque entreprise a son espace et sa base de données ; seules les adresses de son domaine y accèdent.", "不会。每家公司拥有独立空间与数据库，仅该域名邮箱可进入。"],
  q2: ["كيف أضيف زملائي؟", "How do I add colleagues?", "Comment ajouter des collègues ?", "如何添加同事？"],
  a2: ["مدير المساحة يضيفهم من لوحة الإدارة داخلها، أو نفتح التسجيل لمساحتك فيسجّلون بأنفسهم ببريد الشركة.", "The workspace admin adds them from the admin panel, or we open sign-up for your workspace and they register themselves with the company email.", "L'administrateur les ajoute depuis le panneau d'administration, ou nous ouvrons l'inscription pour votre espace.", "空间管理员可在管理面板添加，或我们为您的空间开放注册，同事用公司邮箱自行注册。"],
  q3: ["هل تُفعَّل المساحة فور إرسال الطلب؟", "Is the workspace activated as soon as I send the request?", "L'espace est-il activé dès l'envoi ?", "提交后空间会立即开通吗？"],
  a3: ["لا. يراجع فريقنا الطلب ويجهّز المساحة باسم شركتك، ثم يرسل لك رابطها.", "No. Our team reviews the request and prepares the workspace under your company name, then sends you its link.", "Non. Notre équipe examine la demande, prépare l'espace puis vous envoie le lien.", "不会。我们的团队审核申请并以贵公司名称准备空间，随后发送链接。"],
  q4: ["أين تُحفظ البيانات؟", "Where is the data stored?", "Où sont stockées les données ?", "数据存储在哪里？"],
  a4: ["على خوادم Microsoft Azure في منطقة السويد.", "On Microsoft Azure servers in the Sweden region.", "Sur les serveurs Microsoft Azure en Suède.", "存储于 Microsoft Azure 瑞典区域的服务器。"],
};

const TEAM_OPTS = ["1", "2-5", "6-20", "21-100", "100+"];
const FEATURE_KEYS = ["chat", "files", "notes", "knowledge", "connectors", "custom_agents", "priority", "audit", "dedicated_support"];

export function buildSimpleAi(sv1, ctx) {
  const { lang, esc } = ctx;
  const LI = { ar: 0, en: 1, fr: 2, zh: 3 };
  const l = lang();
  const idx = LI[l] != null ? LI[l] : 1;
  const t = (k) => { const e = D[k]; return e ? e[idx] : k; };

  const FT = {};
  for (const k of FEATURE_KEYS) FT[k] = t("ft_" + k);
  const TX = {};
  for (const k of ["plansErr", "seats", "seat1", "days", "credit", "sending", "send", "done", "doneNext", "eCompany", "eName", "eEmail", "eEmailFree", "ePhone", "eRate", "eNet"]) TX[k] = t(k);
  const PN = {};
  for (const k of ["individual", "business", "business_plus", "enterprise"]) PN[k] = t("pn_" + k);
  const CFG = { lang: l, tx: TX, ft: FT, pn: PN };

  const card = (h, p) => `<div class="sv1-ai-card"><h3>${esc(t(h))}</h3><p>${esc(t(p))}</p></div>`;
  const li = (k) => `<li>${esc(t(k))}</li>`;
  const faq = [1, 2, 3, 4].map((n) => `<details><summary>${esc(t("q" + n))}</summary><p>${esc(t("a" + n))}</p></details>`).join("");
  const teamOpts = TEAM_OPTS.map((v) => `<option value="${v}">${v}</option>`).join("");

  const CSS = `<style id="sv1-ai-css">
.sv1-ai-hero{padding:56px 0 40px;text-align:center}
.sv1-ai-hero h1{font-size:clamp(28px,4.4vw,46px);margin:14px 0 10px}
.sv1-ai-hero .sub{font-size:clamp(17px,2.2vw,22px);color:var(--ac);font-weight:400;margin:0 0 14px}
.sv1-ai-hero .lead{max-width:720px;margin:0 auto 22px;color:var(--mut);line-height:1.95}
.sv1-ai-acts{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.sv1-ai-note{margin:14px 0 0;color:var(--mut);font-size:12.5px}
.sv1-ai-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;max-width:1100px;margin:0 auto}
.sv1-ai-grid>*,.sv1-ai-plans>*{min-width:0}
.sv1-ai-card{background:Canvas;border:1px solid var(--l);border-radius:13px;padding:20px;box-shadow:var(--sh)}
.sv1-ai-card h3{font-size:15px;font-weight:500;margin:0 0 8px}
.sv1-ai-card p{margin:0;color:var(--mut);font-size:13px;line-height:1.85}
.sv1-ai-plans{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;max-width:1100px;margin:0 auto}
.sv1-ai-plan{background:Canvas;border:1px solid var(--l);border-radius:13px;padding:18px;box-shadow:var(--sh);display:flex;flex-direction:column;gap:8px}
.sv1-ai-plan h3{font-size:16px;font-weight:500;margin:0;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.sv1-ai-plan .badge{font-size:11px;font-weight:400;border:1px solid var(--ac);color:var(--ac);border-radius:20px;padding:1px 9px}
.sv1-ai-plan .facts{color:var(--ink);font-size:13px;margin:0}
.sv1-ai-plan ul{margin:4px 0 0;padding:0 18px;color:var(--mut);font-size:12.5px;line-height:1.9}
.sv1-ai-msg{text-align:center;color:var(--mut);font-size:13px}
.sv1-ai-steps{max-width:760px;margin:0 auto;display:grid;gap:10px;padding:0;list-style:none;counter-reset:s}
.sv1-ai-steps li{display:flex;gap:14px;align-items:flex-start;background:Canvas;border:1px solid var(--l);border-radius:11px;padding:13px 16px;font-size:13.5px}
.sv1-ai-steps li::before{counter-increment:s;content:counter(s);flex:none;width:28px;height:28px;border-radius:50%;background:var(--ac);color:Canvas;display:grid;place-items:center;font-family:var(--fm);font-size:13px}
.sv1-ai-faq{max-width:760px;margin:0 auto;display:grid;gap:9px}
.sv1-ai-faq details{background:Canvas;border:1px solid var(--l);border-radius:11px;padding:0 16px}
.sv1-ai-faq summary{cursor:pointer;padding:14px 0;font-weight:500;font-size:14px;color:var(--ink)}
.sv1-ai-faq p{margin:0 0 14px;color:var(--mut);font-size:13px;line-height:1.9}
.sv1-ai-form{max-width:760px;margin:0 auto;background:Canvas;border:1px solid var(--l);border-radius:15px;padding:26px;box-shadow:var(--sh2)}
.sv1-ai-cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.sv1-ai-cols>*{min-width:0}
.sv1-ai-f{margin-bottom:13px}
.sv1-ai-form label{display:block;font-size:11.5px;color:var(--mut);margin-bottom:5px}
.sv1-ai-in{width:100%;border:1px solid var(--l);border-radius:10px;padding:11px 13px;font:inherit;font-size:13.5px;outline:none;background:Canvas;color:var(--t)}
.sv1-ai-in:focus{border-color:var(--ac)}
.sv1-ai-in[aria-invalid=true]{border-color:var(--warn)}
textarea.sv1-ai-in{min-height:84px;resize:vertical}
.sv1-ai-hint{font-size:11.5px;color:var(--mut);margin:5px 0 0}
.sv1-ai-hp{position:absolute!important;inset-inline-start:-9999px;width:1px;height:1px;overflow:hidden}
.sv1-ai-out{margin-top:12px;font-size:13.5px;min-height:1em}
.sv1-ai-out b{direction:ltr;display:inline-block}
@media(max-width:900px){.sv1-ai-grid{grid-template-columns:1fr 1fr}}
@media(max-width:600px){.sv1-ai-grid,.sv1-ai-cols{grid-template-columns:1fr}.sv1-ai-form{padding:18px}}
</style>`;

  const body = `${sv1.header("/ai", { cta: false })}
<main>
  <section class="sv1-ai-hero"><div class="wrap">
    <span class="sv1-tag">${esc(t("tag"))}</span>
    <h1>${esc(t("title"))}</h1>
    <p class="sub">${esc(t("sub"))}</p>
    <p class="lead">${esc(t("lead"))}</p>
    <div class="sv1-ai-acts">
      <a class="sv1-btn primary" href="#ai-trial" data-track="AI: اطلب مساحة">${esc(t("cta"))}</a>
    </div>
    <p class="sv1-ai-note">${esc(t("loginNote"))}</p>
  </div></section>

  <section class="sv1-sec" style="padding-top:20px"><div class="wrap">
    <div class="sv1-title"><h2>${esc(t("whatH"))}</h2></div>
    <div class="sv1-ai-grid">${card("f1", "f1p")}${card("f2", "f2p")}${card("f3", "f3p")}${card("f4", "f4p")}</div>
  </div></section>

  <section class="sv1-sec" id="ai-plans" style="background:var(--soft)"><div class="wrap">
    <div class="sv1-title"><h2>${esc(t("plansH"))}</h2><p>${esc(t("plansP"))}</p></div>
    <div class="sv1-ai-plans" id="aiPlans"><p class="sv1-ai-msg">${esc(t("plansLoad"))}</p></div>
  </div></section>

  <section class="sv1-sec"><div class="wrap">
    <div class="sv1-title"><h2>${esc(t("howH"))}</h2></div>
    <ol class="sv1-ai-steps">${li("s1")}${li("s2")}${li("s3")}${li("s4")}</ol>
  </div></section>

  <section class="sv1-sec" id="ai-trial" style="background:var(--soft)"><div class="wrap">
    <div class="sv1-title"><h2>${esc(t("formH"))}</h2><p>${esc(t("formP"))}</p></div>
    <form class="sv1-ai-form" id="aiForm" novalidate autocomplete="off">
      <div class="sv1-ai-hp" aria-hidden="true"><label>Fax<input type="text" id="aiHp" tabindex="-1" autocomplete="off"></label></div>
      <div class="sv1-ai-cols sv1-ai-f">
        <div><label for="aiCompany">${esc(t("fCompany"))}</label><input class="sv1-ai-in" id="aiCompany" maxlength="120" autocomplete="organization"></div>
        <div><label for="aiWebsite">${esc(t("fWebsite"))}</label><input class="sv1-ai-in" id="aiWebsite" maxlength="200" dir="ltr" inputmode="url" autocomplete="url"></div>
      </div>
      <div class="sv1-ai-cols sv1-ai-f">
        <div><label for="aiName">${esc(t("fName"))}</label><input class="sv1-ai-in" id="aiName" maxlength="120" autocomplete="name"></div>
        <div><label for="aiPhone">${esc(t("fPhone"))}</label><input class="sv1-ai-in" id="aiPhone" maxlength="30" dir="ltr" inputmode="tel" autocomplete="tel"></div>
      </div>
      <div class="sv1-ai-cols sv1-ai-f">
        <div><label for="aiEmail">${esc(t("fEmail"))}</label><input class="sv1-ai-in" id="aiEmail" type="email" maxlength="160" dir="ltr" autocomplete="email"><p class="sv1-ai-hint">${esc(t("fEmailHint"))}</p></div>
        <div><label for="aiTeam">${esc(t("fTeam"))}</label><select class="sv1-ai-in" id="aiTeam"><option value="">${esc(t("fTeamPick"))}</option>${teamOpts}</select></div>
      </div>
      <div class="sv1-ai-f"><label for="aiUse">${esc(t("fUse"))}</label><textarea class="sv1-ai-in" id="aiUse" maxlength="1000"></textarea></div>
      <button type="submit" class="sv1-btn primary" id="aiGo">${esc(t("send"))}</button>
      <div class="sv1-ai-out" id="aiOut" role="status" aria-live="polite"></div>
    </form>
  </div></section>

  <section class="sv1-sec"><div class="wrap">
    <div class="sv1-title"><h2>${esc(t("faqH"))}</h2></div>
    <div class="sv1-ai-faq">${faq}</div>
  </div></section>
</main>
${sv1.footer()}`;

  function aiClient(C) {
    var TX = C.tx, FT = C.ft, PN = C.pn, LANG = C.lang, API = "/api/requests?__route=ai";
    var $ = function (id) { return document.getElementById(id); };
    var el = function (tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    var num = function (n) { try { return Number(n).toLocaleString(LANG === "ar" ? "ar-SA" : LANG); } catch (e) { return String(n); } };

    function renderPlans(plans) {
      var box = $("aiPlans");
      box.textContent = "";
      if (!plans || !plans.length) { box.appendChild(el("p", "sv1-ai-msg", TX.plansErr)); return; }
      plans.forEach(function (p) {
        var c = el("div", "sv1-ai-plan");
        c.appendChild(el("h3", null, PN[p.code] || p.name || p.code));
        var facts = [];
        if (p.seats != null) facts.push(Number(p.seats) === 1 ? TX.seat1 : num(p.seats) + " " + TX.seats);
        if (p.days != null) facts.push(num(p.days) + " " + TX.days);
        if (p.credit_usd != null) facts.push(TX.credit + " $" + num(p.credit_usd));
        c.appendChild(el("p", "facts", facts.join(" · ")));
        var ul = el("ul");
        (p.features || []).forEach(function (f) { if (FT[f]) ul.appendChild(el("li", null, FT[f])); });
        if (ul.childNodes.length) c.appendChild(ul);
        box.appendChild(c);
      });
    }
    fetch(API + "&action=plans&lang=" + (LANG === "ar" ? "ar" : "en"), { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (o) { renderPlans(o && o.ok ? o.plans : null); })
      .catch(function () { renderPlans(null); });

    var FIELD = { company: ["aiCompany", "eCompany"], name: ["aiName", "eName"], email: ["aiEmail", "eEmail"], email_free: ["aiEmail", "eEmailFree"], phone: ["aiPhone", "ePhone"] };
    function say(cls, text, ref) {
      var o = $("aiOut"); o.textContent = ""; o.className = "sv1-ai-out" + (cls === "err" ? " sv1-err" : "");
      o.appendChild(document.createTextNode(text));
      if (ref) { o.appendChild(document.createTextNode(" ")); o.appendChild(el("b", null, ref)); o.appendChild(document.createTextNode(" — " + TX.doneNext)); }
    }
    function clearInvalid() { ["aiCompany", "aiName", "aiEmail", "aiPhone"].forEach(function (id) { $(id).removeAttribute("aria-invalid"); }); }

    $("aiForm").addEventListener("submit", function (ev) {
      ev.preventDefault();
      clearInvalid();
      var btn = $("aiGo");
      btn.disabled = true; btn.textContent = TX.sending; say("", "");
      var body = { action: "trial", lang: LANG, hp: $("aiHp").value, company: $("aiCompany").value, website: $("aiWebsite").value,
        name: $("aiName").value, phone: $("aiPhone").value, email: $("aiEmail").value, team: $("aiTeam").value, useCase: $("aiUse").value };
      fetch(API, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (o) { return { s: r.status, o: o || {} }; }); })
        .then(function (x) {
          btn.disabled = false; btn.textContent = TX.send;
          if (x.o.ok) { $("aiForm").reset(); say("ok", TX.done, x.o.ref); return; }
          if (x.s === 429) return say("err", TX.eRate);
          var bad = x.o.fields || [];
          if (bad.length) {
            var first = null;
            bad.forEach(function (f) { var m = FIELD[f]; if (m) { $(m[0]).setAttribute("aria-invalid", "true"); if (!first) first = m; } });
            if (first) { $(first[0]).focus(); return say("err", TX[first[1]]); }
          }
          say("err", TX.eNet);
        })
        .catch(function () { btn.disabled = false; btn.textContent = TX.send; say("err", TX.eNet); });
    });
  }

  const safe = (s) => s.replace(/</g, "\\u003c");
  const script = `<script>(${aiClient.toString()})(${safe(JSON.stringify(CFG))});</script>`;
  return sv1.shell({ title: `${t("title")} — ${t("tag")}`, desc: t("desc"), path: "/ai", body: CSS + body, script });
}

// للاختبارات: كل نصّ في الصفحة بأربع لغات.
export const AI_TEXT = D;
