// Business Partner — Simple V1 (2026-09).
//
// The simplified customer-facing layer: one homepage that sells three things
// (consulting, government services, company formation) through ONE chat, a
// client portal (/my) and an operations dashboard (/ops). Built by
// generate.mjs alongside the classic site; nothing here removes a classic
// route. The homepage replaces "/" only when the SIMPLE_V1=1 build flag is
// set — otherwise it is previewed at /simple-v1 and the classic home stays.
//
// Four languages (ar/en/fr/zh) from the dictionary below — the pages are
// authored once and rendered per language by generate.mjs' language loop.

export const SIMPLE_V1 = process.env.SIMPLE_V1 === "1";
export const SIMPLE_LANGS = ["ar", "en", "fr", "zh"];

const D = {
  brand: { ar: "شريك الأعمال", en: "Business Partner", fr: "Business Partner", zh: "Business Partner" },
  navHome: { ar: "الرئيسية", en: "Home", fr: "Accueil", zh: "首页" },
  navServices: { ar: "الخدمات", en: "Services", fr: "Services", zh: "服务" },
  navAccount: { ar: "حسابي", en: "My account", fr: "Mon compte", zh: "我的账户" },
  navStart: { ar: "ابدأ طلبك", en: "Start your request", fr: "Démarrer une demande", zh: "开始申请" },
  heroTitle: { ar: "قل لنا وش تحتاج،<br>ونرتب لك الطلب.", en: "Tell us what you need,<br>and we'll organise the request.", fr: "Dites-nous ce qu'il vous faut,<br>nous organisons la demande.", zh: "告诉我们您的需求，<br>我们为您安排申请。" },
  heroText: { ar: "ابدأ محادثة بسيطة. نفهم طلبك، نرتب الخدمات المطلوبة، وبعد موافقتك يطلع عرض السعر والعقد والدفع والفاتورة من مكان واحد.", en: "Start a simple conversation. We understand your request, organise the services needed, and after your approval the quotation, contract, payment and invoice all come from one place.", fr: "Commencez par une simple conversation. Nous comprenons votre demande, organisons les services nécessaires, et après votre accord, le devis, le contrat, le paiement et la facture sortent du même endroit.", zh: "从一次简单的对话开始。我们了解您的需求，安排所需服务，经您确认后，报价、合同、付款和发票都在同一处完成。" },
  chatTitle: { ar: "كيف نقدر نخدمك؟", en: "How can we help you?", fr: "Comment pouvons-nous vous aider ?", zh: "我们能为您做什么？" },
  chatHint: { ar: "اكتب طلبك بكلماتك، أو اختر نوع الخدمة أولاً.", en: "Write your request in your own words, or pick a service type first.", fr: "Écrivez votre demande avec vos mots, ou choisissez d'abord un type de service.", zh: "用您自己的话写下需求，或先选择服务类型。" },
  chatPlaceholder: { ar: "مثال: عندي مشكلة في قوى وما أقدر أغير مهن الموظفين…", en: "Example: I can't change my employees' professions in Qiwa…", fr: "Exemple : je n'arrive pas à changer les professions de mes employés sur Qiwa…", zh: "例如：我在 Qiwa 平台无法更改员工职业…" },
  send: { ar: "إرسال", en: "Send", fr: "Envoyer", zh: "发送" },
  thinking: { ar: "نرتّب طلبك…", en: "Working on it…", fr: "Un instant…", zh: "正在处理…" },
  chatError: { ar: "تعذّر الرد الآن. جرّب مرة أخرى أو تواصل معنا عبر واتساب.", en: "We couldn't reply right now. Try again or reach us on WhatsApp.", fr: "Impossible de répondre pour le moment. Réessayez ou contactez-nous sur WhatsApp.", zh: "暂时无法回复，请重试或通过 WhatsApp 联系我们。" },
  welcome: { ar: "أهلاً بك. أنا مساعد شريك الأعمال. صف لي ما تحتاجه وسأرتّب لك الطلب في دقائق.", en: "Welcome. I'm the Business Partner assistant. Describe what you need and I'll organise your request in minutes.", fr: "Bienvenue. Je suis l'assistant Business Partner. Décrivez-moi votre besoin et j'organise votre demande en quelques minutes.", zh: "欢迎。我是 Business Partner 助手。请描述您的需求，我将在几分钟内为您安排申请。" },
  ctxConsulting: { ar: "الاستشارات", en: "Consulting", fr: "Conseil", zh: "咨询" },
  ctxGovernment: { ar: "الخدمات الحكومية", en: "Government services", fr: "Services gouvernementaux", zh: "政府服务" },
  ctxFormation: { ar: "تأسيس الشركات", en: "Company formation", fr: "Création d'entreprise", zh: "公司注册" },
  cardConsultingText: { ar: "سؤال، تحدٍّ تشغيلي، هيكلة الشركة، امتثال، ترخيص، أو قرار تحتاج فيه رأياً واضحاً.", en: "A question, an operational challenge, company structure, compliance, licensing, or a decision you need clear advice on.", fr: "Une question, un défi opérationnel, la structure de l'entreprise, la conformité, une licence ou une décision à éclairer.", zh: "任何问题、运营挑战、公司架构、合规、许可，或需要明确建议的决策。" },
  cardGovernmentText: { ar: "معاملاتك في قوى والتأمينات ومدد ومقيم وأبشر أعمال وبلدي والمركز السعودي للأعمال وغيرها. اشرح المشكلة ونحدد المطلوب.", en: "Your transactions on Qiwa, GOSI, Mudad, Muqeem, Absher Business, Balady, the Saudi Business Center and more. Explain the problem and we define what's needed.", fr: "Vos démarches sur Qiwa, GOSI, Mudad, Muqeem, Absher Business, Balady, le Saudi Business Center et plus. Expliquez le problème, nous définissons le nécessaire.", zh: "您在 Qiwa、GOSI、Mudad、Muqeem、Absher Business、Balady、沙特商务中心等平台的事务。说明问题，我们确定所需服务。" },
  cardFormationText: { ar: "فرع لشركة أجنبية، أو تأسيس عبر مسار ريادة الأعمال. نفهم شركتك المخطط لها ونرتب النطاق المناسب.", en: "A branch of a foreign company, or a company through the entrepreneurship route. We understand your planned company and organise the right scope.", fr: "Une succursale d'une société étrangère ou une création via le parcours entrepreneur. Nous comprenons votre projet et organisons le bon périmètre.", zh: "外国公司分支机构，或通过创业路径设立公司。我们了解您的规划并安排合适的范围。" },
  ctaConsulting: { ar: "ابدأ استشارة", en: "Start a consultation", fr: "Démarrer une consultation", zh: "开始咨询" },
  ctaGovernment: { ar: "ابدأ طلب حكومي", en: "Start a government request", fr: "Démarrer une demande gouvernementale", zh: "开始政府服务申请" },
  ctaFormation: { ar: "ابدأ التأسيس", en: "Start formation", fr: "Démarrer la création", zh: "开始注册" },
  servicesTitle: { ar: "ماذا يقدّم شريك الأعمال؟", en: "What does Business Partner offer?", fr: "Que propose Business Partner ?", zh: "Business Partner 提供什么？" },
  servicesSub: { ar: "ثلاث خدمات، ومحادثة واحدة. كل ما هو معقّد يبقى خلف الكواليس.", en: "Three services, one conversation. Everything complicated stays behind the scenes.", fr: "Trois services, une conversation. Tout ce qui est compliqué reste en coulisses.", zh: "三项服务，一次对话。所有复杂的事务都在幕后完成。" },
  howTitle: { ar: "كيف يمشي طلبك؟", en: "How your request moves", fr: "Le parcours de votre demande", zh: "申请流程" },
  step1: { ar: "محادثة", en: "Conversation", fr: "Conversation", zh: "对话" },
  step1t: { ar: "تشرح طلبك ونرتّب النطاق معك.", en: "You explain, we organise the scope with you.", fr: "Vous expliquez, nous organisons le périmètre avec vous.", zh: "您说明需求，我们与您一起确定范围。" },
  step2: { ar: "عرض السعر", en: "Quotation", fr: "Devis", zh: "报价" },
  step2t: { ar: "يصلك عرض واضح تعتمده من حسابك.", en: "A clear quote you approve from your account.", fr: "Un devis clair que vous approuvez depuis votre compte.", zh: "清晰的报价，您在账户中确认。" },
  step3: { ar: "العقد والتوقيع", en: "Contract & signature", fr: "Contrat et signature", zh: "合同与签署" },
  step3t: { ar: "عقد يرث بيانات العرض وتوقّعه إلكترونياً.", en: "A contract that inherits the quote, signed electronically.", fr: "Un contrat qui reprend le devis, signé électroniquement.", zh: "合同自动继承报价内容，电子签署。" },
  step4: { ar: "الدفع والفاتورة", en: "Payment & invoice", fr: "Paiement et facture", zh: "付款与发票" },
  step4t: { ar: "تدفع بأمان وتصلك الفاتورة، ثم يبدأ التنفيذ.", en: "Pay securely, get your invoice, and execution starts.", fr: "Payez en toute sécurité, recevez la facture, l'exécution démarre.", zh: "安全付款，收到发票，随后开始执行。" },
  scopeTitle: { ar: "هذا اللي فهمناه من طلبك", en: "Here's what we understood", fr: "Voici ce que nous avons compris", zh: "我们的理解如下" },
  scopeHint: { ar: "عدّل البنود، أو احذف، أو أضف ما ينقص. الأسعار تأتي في عرض السعر بعد المراجعة.", en: "Edit, remove or add items. Prices come in the quotation after review.", fr: "Modifiez, supprimez ou ajoutez des éléments. Les prix arrivent dans le devis après examen.", zh: "可编辑、删除或添加条目。价格将在审核后的报价中提供。" },
  scopeAdd: { ar: "إضافة بند", en: "Add item", fr: "Ajouter un élément", zh: "添加条目" },
  scopeAddPh: { ar: "بند جديد…", en: "New item…", fr: "Nouvel élément…", zh: "新条目…" },
  scopeCreate: { ar: "إنشاء الطلب", en: "Create request", fr: "Créer la demande", zh: "创建申请" },
  scopeContinue: { ar: "أكمل المحادثة", en: "Continue chatting", fr: "Continuer la conversation", zh: "继续对话" },
  del: { ar: "حذف", en: "Remove", fr: "Supprimer", zh: "删除" },
  needs: { ar: "سنطلب منك لاحقاً:", en: "We'll ask you later for:", fr: "Nous vous demanderons plus tard :", zh: "稍后我们会向您索取：" },
  loginTitle: { ar: "آخر خطوة: بريدك الإلكتروني", en: "Last step: your email", fr: "Dernière étape : votre e-mail", zh: "最后一步：您的邮箱" },
  loginText: { ar: "نرسل لك رمز دخول لنحفظ الطلب في حسابك وتتابعه من مكان واحد.", en: "We'll send a sign-in code so the request is saved to your account.", fr: "Nous vous envoyons un code de connexion pour enregistrer la demande dans votre compte.", zh: "我们将发送登录验证码，将申请保存到您的账户。" },
  loginName: { ar: "الاسم", en: "Name", fr: "Nom", zh: "姓名" },
  loginPhone: { ar: "رقم الجوال", en: "Mobile number", fr: "Numéro de mobile", zh: "手机号码" },
  loginEmail: { ar: "البريد الإلكتروني", en: "Email", fr: "E-mail", zh: "邮箱" },
  loginSend: { ar: "أرسل الرمز", en: "Send code", fr: "Envoyer le code", zh: "发送验证码" },
  loginCode: { ar: "رمز الدخول (6 أرقام)", en: "Sign-in code (6 digits)", fr: "Code de connexion (6 chiffres)", zh: "登录验证码（6位）" },
  loginVerify: { ar: "تأكيد وإنشاء الطلب", en: "Confirm & create request", fr: "Confirmer et créer la demande", zh: "确认并创建申请" },
  loginErr: { ar: "تعذّر إرسال الرمز. تأكد من البريد أو جرّب لاحقاً.", en: "Couldn't send the code. Check the email or try later.", fr: "Impossible d'envoyer le code. Vérifiez l'e-mail ou réessayez.", zh: "无法发送验证码，请检查邮箱或稍后重试。" },
  codeErr: { ar: "الرمز غير صحيح.", en: "Wrong code.", fr: "Code incorrect.", zh: "验证码错误。" },
  creating: { ar: "ننشئ طلبك…", en: "Creating your request…", fr: "Création de votre demande…", zh: "正在创建申请…" },
  created: { ar: "تم إنشاء طلبك. رقم الطلب:", en: "Your request is created. Reference:", fr: "Votre demande est créée. Référence :", zh: "申请已创建。编号：" },
  openPortal: { ar: "افتح حسابي", en: "Open my account", fr: "Ouvrir mon compte", zh: "打开我的账户" },
  testMode: { ar: "وضع الاختبار — لا مدفوعات حقيقية ولا رسائل للعملاء", en: "TEST MODE — no real payments, no customer messages", fr: "MODE TEST — aucun paiement réel, aucun message client", zh: "测试模式 — 无真实付款，不向客户发送消息" },
  footContact: { ar: "تواصل", en: "Contact", fr: "Contact", zh: "联系我们" },
  footClassic: { ar: "الموقع الكامل", en: "Full website", fr: "Site complet", zh: "完整网站" },
  footTerms: { ar: "الشروط والأحكام", en: "Terms", fr: "Conditions", zh: "条款" },
  footRights: { ar: "جميع الحقوق محفوظة", en: "All rights reserved", fr: "Tous droits réservés", zh: "版权所有" },
  sugConsulting: { ar: ["أحتاج رأياً في هيكلة شركتي", "عندي سؤال عن الامتثال والتراخيص", "أريد جلسة استشارية"], en: ["I need advice on my company structure", "A compliance or licensing question", "I'd like a consultation session"], fr: ["Un avis sur la structure de ma société", "Une question de conformité ou de licence", "Je souhaite une session de conseil"], zh: ["我需要公司架构方面的建议", "合规或许可方面的问题", "我想预约咨询"] },
  sugGovernment: { ar: ["مشكلة في قوى", "تسجيل موظفين في التأمينات", "تجديد رخصة بلدي"], en: ["A problem on Qiwa", "Register employees with GOSI", "Renew a Balady licence"], fr: ["Un problème sur Qiwa", "Inscrire des employés à GOSI", "Renouveler une licence Balady"], zh: ["Qiwa 平台问题", "在 GOSI 登记员工", "续办 Balady 许可"] },
  sugFormation: { ar: ["فرع لشركة أجنبية في الرياض", "تأسيس عبر رخصة ريادة الأعمال", "شركة جديدة مع إقامة المالك"], en: ["A branch of a foreign company in Riyadh", "Formation via the entrepreneurship licence", "A new company with owner residency"], fr: ["Une succursale d'une société étrangère à Riyad", "Création via la licence entrepreneur", "Une nouvelle société avec résidence du propriétaire"], zh: ["在利雅得设立外国公司分支", "通过创业许可注册", "新公司及所有者居留"] },
};

export function simpleV1(ctx) {
  const { lang, esc, site, head, pathInLang, assetV } = ctx;
  const t = (k) => { const e = D[k]; if (!e) return k; const l = lang(); return e[l] != null ? e[l] : e.en; };
  const arr = (k) => { const e = D[k]; const l = lang(); return Array.isArray(e[l]) ? e[l] : e.en; };
  const pre = () => (lang() === "en" ? "" : "/" + lang());
  const href = (p) => (p === "/" ? (lang() === "en" ? "/" : "/" + lang() + "/") : pre() + p);
  const rtl = () => lang() === "ar";
  const LANG_NAMES = { ar: "العربية", en: "English", fr: "Français", zh: "中文" };
  const contact = site.contact || {};
  const WA_HUMAN = "https://wa.me/966" + String(contact.whatsappSupport || contact.phone || "0530540231").replace(/^0/, "");

  const CSS = `<style id="sv1-css">
.sv1{--n:#0B1B5A;--n2:#13246e;--g:#F5F6FA;--ink:#1F2430;--mut:#5f6880;--line:#e4e8f1;--ok:#118657;font-family:"IBM Plex Sans Arabic",system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);background:#fff;min-height:100vh;display:flex;flex-direction:column}
.sv1 *{box-sizing:border-box}
.sv1 a{color:inherit;text-decoration:none}
.sv1 .wrap{width:min(1120px,calc(100% - 32px));margin:0 auto}
.sv1-ribbon{background:#b45309;color:#fff;text-align:center;font-size:.78rem;font-weight:700;padding:6px 10px}
.sv1-hdr{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.96);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.sv1-hdr .wrap{display:flex;align-items:center;gap:18px;height:68px}
.sv1-hdr .logo img{height:32px;width:auto;display:block}
.sv1-nav{display:flex;gap:4px;margin-inline-start:auto}
.sv1-nav a,.sv1-lang summary{padding:8px 12px;border-radius:10px;font-weight:600;font-size:.92rem;color:#2c3550}
.sv1-nav a:hover{background:var(--g)}
.sv1-lang{position:relative}
.sv1-lang summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:6px}
.sv1-lang summary::-webkit-details-marker{display:none}
.sv1-lang .menu{position:absolute;inset-inline-end:0;top:calc(100% + 6px);background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:0 14px 40px rgba(11,27,90,.12);min-width:150px;padding:6px;display:grid}
.sv1-lang .menu a{padding:8px 10px;border-radius:8px;font-size:.9rem}
.sv1-lang .menu a.on{background:var(--g);font-weight:700}
.sv1 .sv1-btn,.sv1 a.sv1-btn,.sv1-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 18px;border-radius:12px;font-weight:700;font-size:.95rem;border:1px solid var(--n);background:var(--n);color:#fff;cursor:pointer;transition:.15s;line-height:1.2}
.sv1-btn:hover{background:var(--n2)}
.sv1 .sv1-btn.ghost,.sv1 a.sv1-btn.ghost,.sv1-btn.ghost{background:#fff;color:var(--n)}
.sv1-btn.ghost:hover{background:var(--g)}
.sv1-btn.sm{padding:8px 12px;font-size:.85rem;border-radius:10px}
.sv1-btn[disabled]{opacity:.55;cursor:default}
.sv1-burger{display:none;margin-inline-start:auto;border:1px solid var(--line);background:#fff;border-radius:10px;width:40px;height:40px;align-items:center;justify-content:center;cursor:pointer}
.sv1-hero{padding:56px 0 24px;text-align:center}
.sv1-hero h1{font-size:clamp(1.9rem,4.6vw,3.2rem);line-height:1.2;color:var(--n);margin:0 auto 14px;max-width:820px;font-weight:800;letter-spacing:-.02em}
.sv1-hero p{max-width:720px;margin:0 auto;color:var(--mut);font-size:1.02rem;line-height:1.85}
.sv1-chatwrap{padding:18px 0 40px}
.sv1-chat{max-width:860px;margin:0 auto;background:#fff;border:1px solid var(--line);border-radius:22px;box-shadow:0 22px 60px rgba(11,27,90,.10);overflow:hidden}
.sv1-chat .top{padding:16px 18px;border-bottom:1px solid var(--line);display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.sv1-chat .top h2{margin:0;font-size:1.05rem;color:var(--n)}
.sv1-chat .top p{margin:0;color:var(--mut);font-size:.82rem;flex-basis:100%}
.sv1-ctx{display:flex;gap:8px;flex-wrap:wrap;padding:12px 18px 0}
.sv1-ctx button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:7px 14px;font-weight:700;font-size:.85rem;color:#2c3550;cursor:pointer}
.sv1-ctx button.on{background:var(--n);border-color:var(--n);color:#fff}
.sv1-msgs{padding:14px 18px;min-height:220px;max-height:420px;overflow:auto;display:flex;flex-direction:column;gap:10px;background:#fafbfe}
.sv1-msg{max-width:82%;padding:11px 14px;border-radius:16px;font-size:.95rem;line-height:1.75;white-space:pre-wrap;word-break:break-word}
.sv1-msg.a{background:#fff;border:1px solid var(--line);align-self:flex-start;border-start-start-radius:6px}
.sv1-msg.u{background:var(--n);color:#fff;align-self:flex-end;border-start-end-radius:6px}
.sv1-msg.s{background:#fff3e6;color:#8a4b00;font-size:.85rem;align-self:center;text-align:center}
.sv1-sug{display:flex;gap:8px;flex-wrap:wrap;padding:0 18px 10px;background:#fafbfe}
.sv1-sug button{border:1px dashed #c7cfe2;background:#fff;border-radius:999px;padding:6px 12px;font-size:.82rem;color:#2c3550;cursor:pointer}
.sv1-form{display:flex;gap:8px;padding:12px 14px;border-top:1px solid var(--line);background:#fff}
.sv1-form input{flex:1;border:1px solid var(--line);border-radius:12px;padding:12px 14px;font:inherit;font-size:.95rem;outline:none}
.sv1-form input:focus{border-color:var(--n)}
.sv1-scope{border-top:1px solid var(--line);padding:16px 18px;background:#fff}
.sv1-scope h3{margin:0 0 4px;color:var(--n);font-size:1.05rem}
.sv1-scope .hint{margin:0 0 10px;color:var(--mut);font-size:.82rem}
.sv1-scope .sum{background:var(--g);border-radius:12px;padding:10px 12px;font-size:.9rem;line-height:1.7;margin-bottom:10px;white-space:pre-wrap}
.sv1-items{display:grid;gap:8px;margin:0;padding:0;list-style:none}
.sv1-items li{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--line);border-radius:12px;padding:10px 12px}
.sv1-items li .ic{width:26px;height:26px;border-radius:8px;background:#eaf7ef;color:var(--ok);display:grid;place-items:center;font-weight:900;flex:none}
.sv1-items li .tx{flex:1;min-width:0}
.sv1-items li .tx b{display:block;outline:none;font-size:.94rem;padding:2px 4px;border-radius:6px}
.sv1-items li .tx b:focus{background:#fffbe6}
.sv1-items li .tx small{display:block;color:var(--mut);font-size:.78rem;margin-top:2px;line-height:1.6}
.sv1-items li .rm{border:0;background:transparent;color:#b91c1c;font-size:.78rem;cursor:pointer;font-weight:700;padding:4px}
.sv1-addrow{display:flex;gap:8px;margin-top:10px}
.sv1-addrow input{flex:1;border:1px solid var(--line);border-radius:10px;padding:9px 12px;font:inherit}
.sv1-needs{margin:10px 0 0;color:var(--mut);font-size:.82rem}
.sv1-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
.sv1-login{border-top:1px solid var(--line);padding:16px 18px;background:#fff}
.sv1-login h3{margin:0 0 4px;color:var(--n);font-size:1.05rem}
.sv1-login p{margin:0 0 10px;color:var(--mut);font-size:.85rem}
.sv1-login .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.sv1-login input{border:1px solid var(--line);border-radius:10px;padding:10px 12px;font:inherit;width:100%}
.sv1-login .full{grid-column:1/-1}
.sv1-login .err{color:#b91c1c;font-size:.82rem;margin-top:6px}
.sv1-login .ok{color:var(--ok);font-weight:700;margin-top:8px}
.sv1-services{background:var(--g);padding:56px 0}
.sv1-services h2,.sv1-how h2{text-align:center;color:var(--n);font-size:clamp(1.5rem,3vw,2.1rem);margin:0 0 8px}
.sv1-services .sub{text-align:center;color:var(--mut);margin:0 0 26px}
.sv1-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.sv1-card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:22px;display:flex;flex-direction:column;gap:10px;transition:.15s}
.sv1-card:hover{box-shadow:0 16px 40px rgba(11,27,90,.10);transform:translateY(-2px)}
.sv1-card .ic{width:46px;height:46px;border-radius:14px;background:#eef2ff;display:grid;place-items:center;font-size:1.4rem}
.sv1-card h3{margin:0;color:var(--n);font-size:1.15rem}
.sv1-card p{margin:0;color:var(--mut);font-size:.9rem;line-height:1.75;flex:1}
.sv1-how{padding:56px 0}
.sv1-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-top:22px}
.sv1-step{border:1px solid var(--line);border-radius:16px;padding:18px;background:#fff}
.sv1-step i{display:grid;place-items:center;width:32px;height:32px;border-radius:10px;background:var(--n);color:#fff;font-style:normal;font-weight:800;margin-bottom:10px;font-size:.85rem}
.sv1-step b{display:block;color:var(--n);margin-bottom:4px}
.sv1-step p{margin:0;color:var(--mut);font-size:.85rem;line-height:1.7}
.sv1-foot{margin-top:auto;background:var(--n);color:rgba(255,255,255,.8);padding:26px 0;font-size:.85rem}
.sv1-foot .wrap{display:flex;flex-wrap:wrap;gap:14px 26px;align-items:center}
.sv1-foot a{color:#fff}
.sv1-foot .end{margin-inline-start:auto;color:rgba(255,255,255,.6)}
.sv1-wa{position:fixed;left:18px;bottom:18px;z-index:60;width:52px;height:52px;border-radius:50%;background:#25D366;color:#fff;display:grid;place-items:center;box-shadow:0 10px 26px rgba(37,211,102,.4)}
@media(max-width:900px){.sv1-cards,.sv1-steps{grid-template-columns:1fr 1fr}}
@media(max-width:720px){.sv1-burger{display:flex}.sv1-nav{display:none;position:absolute;inset-inline:0;top:68px;background:#fff;border-bottom:1px solid var(--line);flex-direction:column;padding:8px 12px 12px}.sv1-nav.open{display:flex}.sv1-hdr .cta{display:none}.sv1-cards,.sv1-steps{grid-template-columns:1fr}.sv1-hero{padding:34px 0 12px}.sv1-msg{max-width:92%}.sv1-login .grid{grid-template-columns:1fr}.sv1-foot .end{margin-inline-start:0}}
</style>`;

  function langSwitch(path) {
    const items = SIMPLE_LANGS.map((l) => `<a href="${pathInLang(path, l)}" data-lang="${l}"${l === lang() ? ' class="on"' : ""}>${LANG_NAMES[l]}</a>`).join("");
    return `<details class="sv1-lang"><summary>🌐 ${LANG_NAMES[lang()]}</summary><div class="menu">${items}</div></details>`;
  }
  function header(path, { cta = true } = {}) {
    return `<header class="sv1-hdr"><div class="wrap">
  <a class="logo" href="${href("/")}" aria-label="Business Partner"><img src="/assets/img/logo.png" alt="Business Partner" width="180" height="34"></a>
  <button class="sv1-burger" id="sv1Burger" aria-label="Menu" aria-expanded="false">☰</button>
  <nav class="sv1-nav" id="sv1Nav">
    <a href="${href("/")}">${t("navHome")}</a>
    <a href="${href("/")}#services">${t("navServices")}</a>
    <a href="${href("/my")}" id="sv1AccountLink">${t("navAccount")}</a>
    ${langSwitch(path)}
  </nav>
  ${cta ? `<a class="sv1-btn cta" href="${href("/")}#chat">${t("navStart")}</a>` : ""}
</div></header>`;
  }
  function footer() {
    const year = new Date().getFullYear();
    return `<footer class="sv1-foot"><div class="wrap">
  <span><b>${t("brand")}</b> · ${t("footContact")}: ${esc(contact.phone || "")} · ${esc(contact.email || "")}</span>
  <a href="${href("/terms")}">${t("footTerms")}</a>
  ${SIMPLE_V1 ? `<a href="${href("/classic-home")}">${t("footClassic")}</a>` : ""}
  <span class="end">© ${year} Business Partner · ${t("footRights")}</span>
</div></footer>
<a class="sv1-wa" href="${WA_HUMAN}" target="_blank" rel="noopener" aria-label="WhatsApp"><svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 0 1 8.413 3.488 11.82 11.82 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.477-.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.767.967-.94 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg></a>`;
  }
  const CHROME_JS = `<script>(function(){var b=document.getElementById('sv1Burger'),n=document.getElementById('sv1Nav');if(b&&n)b.onclick=function(){var o=n.classList.toggle('open');b.setAttribute('aria-expanded',o?'true':'false')};
fetch('/api/simple?action=config').then(function(r){return r.json()}).then(function(c){if(c&&c.testMode){var r=document.createElement('div');r.className='sv1-ribbon';r.textContent=${JSON.stringify("")}+document.documentElement.getAttribute('data-sv1-test');document.body.insertBefore(r,document.body.firstChild);document.documentElement.setAttribute('data-sv1-testmode','1')}}).catch(function(){});
fetch('/api/otp',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:'{"action":"me"}'}).then(function(r){return r.json()}).then(function(o){var a=document.getElementById('sv1AccountLink');if(a&&o&&o.session&&o.session.user){a.textContent=(o.session.user.full_name||o.session.user.email||'').split(' ')[0]||a.textContent;window.SV1_SESSION=o.session}}).catch(function(){});})();</script>`;

  function shell({ title, desc, path, body, script = "", noindex = false }) {
    const h = head(title, desc, path)
      .replace("</head>", CSS + "</head>")
      .replace("</head>", noindex ? '<meta name="robots" content="noindex, nofollow"></head>' : "</head>")
      .replace("<html ", `<html data-sv1-test="${esc(t("testMode"))}" `)
      .replace("<body>", '<body class="sv1-page">');
    return h + `<div class="sv1">${body}</div>` + CHROME_JS + script + "</body></html>";
  }

  // ------------------------------------------------------------ homepage --
  function buildHome(path = "/") {
    const l = lang();
    const cards = [
      ["consulting", "💬", t("ctxConsulting"), t("cardConsultingText"), t("ctaConsulting")],
      ["government", "🏛️", t("ctxGovernment"), t("cardGovernmentText"), t("ctaGovernment")],
      ["formation", "🏢", t("ctxFormation"), t("cardFormationText"), t("ctaFormation")],
    ].map(([k, ic, h, p, cta]) => `<div class="sv1-card" id="svc-${k}"><div class="ic">${ic}</div><h3>${h}</h3><p>${p}</p><a class="sv1-btn" href="#chat" data-ctx="${k}">${cta}</a></div>`).join("");
    const steps = [1, 2, 3, 4].map((n) => `<div class="sv1-step"><i>${n}</i><b>${t("step" + n)}</b><p>${t("step" + n + "t")}</p></div>`).join("");
    const SUG = { consulting: arr("sugConsulting"), government: arr("sugGovernment"), formation: arr("sugFormation") };
    const TX = {
      welcome: t("welcome"), thinking: t("thinking"), chatError: t("chatError"), scopeAddPh: t("scopeAddPh"), del: t("del"), needs: t("needs"),
      loginErr: t("loginErr"), codeErr: t("codeErr"), creating: t("creating"), created: t("created"), openPortal: t("openPortal"),
      ctx: { consulting: t("ctxConsulting"), government: t("ctxGovernment"), formation: t("ctxFormation") },
    };
    const body = `
${header(path)}
<main>
  <section class="sv1-hero"><div class="wrap">
    <h1>${t("heroTitle")}</h1>
    <p>${t("heroText")}</p>
  </div></section>

  <section class="sv1-chatwrap" id="chat"><div class="wrap">
    <div class="sv1-chat" id="sv1Chat">
      <div class="top"><h2>${t("chatTitle")}</h2><p>${t("chatHint")}</p></div>
      <div class="sv1-ctx" id="sv1Ctx">
        <button type="button" data-ctx="consulting">💬 ${t("ctxConsulting")}</button>
        <button type="button" data-ctx="government">🏛️ ${t("ctxGovernment")}</button>
        <button type="button" data-ctx="formation">🏢 ${t("ctxFormation")}</button>
      </div>
      <div class="sv1-msgs" id="sv1Msgs" aria-live="polite"></div>
      <div class="sv1-sug" id="sv1Sug"></div>
      <form class="sv1-form" id="sv1Form"><input id="sv1In" autocomplete="off" placeholder="${esc(t("chatPlaceholder"))}"><button class="sv1-btn" type="submit" id="sv1Send">${t("send")}</button></form>
      <div class="sv1-scope" id="sv1Scope" hidden>
        <h3>${t("scopeTitle")}</h3><p class="hint">${t("scopeHint")}</p>
        <div class="sum" id="sv1Sum"></div>
        <ul class="sv1-items" id="sv1Items"></ul>
        <div class="sv1-addrow"><input id="sv1AddIn" placeholder="${esc(t("scopeAddPh"))}"><button type="button" class="sv1-btn ghost sm" id="sv1Add">${t("scopeAdd")}</button></div>
        <p class="sv1-needs" id="sv1Needs" hidden></p>
        <div class="sv1-actions"><button type="button" class="sv1-btn" id="sv1Create">${t("scopeCreate")}</button><button type="button" class="sv1-btn ghost" id="sv1More">${t("scopeContinue")}</button></div>
      </div>
      <div class="sv1-login" id="sv1Login" hidden>
        <h3>${t("loginTitle")}</h3><p>${t("loginText")}</p>
        <div class="grid" id="sv1LoginStep1">
          <input id="sv1Name" placeholder="${esc(t("loginName"))}" autocomplete="name">
          <input id="sv1Phone" placeholder="${esc(t("loginPhone"))}" inputmode="tel" autocomplete="tel">
          <input id="sv1Email" class="full" type="email" placeholder="${esc(t("loginEmail"))}" autocomplete="email">
          <button type="button" class="sv1-btn full" id="sv1SendCode">${t("loginSend")}</button>
        </div>
        <div class="grid" id="sv1LoginStep2" hidden>
          <input id="sv1Code" class="full" inputmode="numeric" maxlength="6" placeholder="${esc(t("loginCode"))}">
          <button type="button" class="sv1-btn full" id="sv1Verify">${t("loginVerify")}</button>
        </div>
        <div class="err" id="sv1LoginErr"></div>
        <div class="ok" id="sv1LoginOk" hidden></div>
      </div>
    </div>
  </div></section>

  <section class="sv1-services" id="services"><div class="wrap">
    <h2>${t("servicesTitle")}</h2><p class="sub">${t("servicesSub")}</p>
    <div class="sv1-cards">${cards}</div>
  </div></section>

  <section class="sv1-how"><div class="wrap">
    <h2>${t("howTitle")}</h2>
    <div class="sv1-steps">${steps}</div>
  </div></section>
</main>
${footer()}`;
    const script = `<script>
(function(){
var LANG=${JSON.stringify(l)},TX=${JSON.stringify(TX)},SUG=${JSON.stringify(SUG)},PORTAL=${JSON.stringify(href("/my"))};
var TYPE={consulting:'CONSULTATION',government:'GOVERNMENT_SERVICE',formation:'COMPANY_FORMATION'};
var $=function(id){return document.getElementById(id)};
var msgs=$('sv1Msgs'),form=$('sv1Form'),input=$('sv1In'),send=$('sv1Send'),sug=$('sv1Sug'),ctxBar=$('sv1Ctx');
var state={ctx:'',history:[],scope:null,busy:false};
try{var saved=JSON.parse(sessionStorage.getItem('sv1_chat')||'null');if(saved&&saved.lang===LANG){state.ctx=saved.ctx||'';state.history=saved.history||[];state.scope=saved.scope||null}}catch(e){}
function save(){try{sessionStorage.setItem('sv1_chat',JSON.stringify({lang:LANG,ctx:state.ctx,history:state.history,scope:state.scope}))}catch(e){}}
function add(text,role){var d=document.createElement('div');d.className='sv1-msg '+role;d.textContent=text;msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;return d}
function renderSug(){sug.innerHTML='';var list=state.ctx?SUG[state.ctx]:[];if(state.history.length>1)list=[];list.forEach(function(s){var b=document.createElement('button');b.type='button';b.textContent=s;b.onclick=function(){input.value=s;form.dispatchEvent(new Event('submit'))};sug.appendChild(b)})}
function setCtx(k,silent){state.ctx=k;Array.prototype.forEach.call(ctxBar.querySelectorAll('button'),function(b){b.classList.toggle('on',b.getAttribute('data-ctx')===k)});renderSug();save();if(!silent){input.focus()}}
ctxBar.addEventListener('click',function(e){var b=e.target.closest('button[data-ctx]');if(b)setCtx(b.getAttribute('data-ctx'))});
document.addEventListener('click',function(e){var a=e.target.closest('a[data-ctx]');if(a){setCtx(a.getAttribute('data-ctx'),true);setTimeout(function(){input.focus()},400)}});
function parseScope(text){var m=text.match(/<<SCOPE>>([\\s\\S]*?)<<END>>/);if(!m)return{text:text.trim(),scope:null};var sc=null;try{sc=JSON.parse(m[1])}catch(e){}return{text:text.replace(m[0],'').trim(),scope:sc&&sc.ready?sc:null}}
function showScope(sc){state.scope=sc;save();var box=$('sv1Scope');box.hidden=false;$('sv1Sum').textContent=sc.summary||'';var ul=$('sv1Items');ul.innerHTML='';(sc.items||[]).forEach(function(it,i){ul.appendChild(item(it,i))});var nd=$('sv1Needs');if(sc.needs&&sc.needs.length){nd.hidden=false;nd.textContent=TX.needs+' '+sc.needs.join(' · ')}else nd.hidden=true;box.scrollIntoView({behavior:'smooth',block:'nearest'})}
function item(it,i){var li=document.createElement('li');li.innerHTML='<span class="ic">✓</span><div class="tx"><b contenteditable="true" spellcheck="false"></b><small></small></div><button type="button" class="rm">'+TX.del+'</button>';li.querySelector('b').textContent=it.title||'';li.querySelector('small').textContent=it.why||'';li.querySelector('b').addEventListener('input',function(){state.scope.items[i].title=this.textContent.trim();save()});li.querySelector('.rm').onclick=function(){state.scope.items.splice(i,1);showScope(state.scope)};return li}
$('sv1Add').onclick=function(){var v=$('sv1AddIn').value.trim();if(!v||!state.scope)return;state.scope.items.push({code:'',title:v,why:''});$('sv1AddIn').value='';showScope(state.scope)};
$('sv1AddIn').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();$('sv1Add').click()}});
$('sv1More').onclick=function(){$('sv1Scope').hidden=true;input.focus()};
function ask(){if(state.busy)return;state.busy=true;send.disabled=true;var th=add(TX.thinking,'a');th.style.opacity='.6';
fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'intake',context:state.ctx||'consulting',lang:LANG,messages:state.history.slice(-12)})})
.then(function(r){return r.json()}).then(function(j){var reply=(j&&(j.reply||j.message))||'';if(!reply)throw new Error('empty');var p=parseScope(reply);th.remove();if(p.text)add(p.text,'a');state.history.push({role:'assistant',content:reply});save();if(p.scope){if(!p.scope.type)p.scope.type=TYPE[state.ctx]||'CONSULTATION';showScope(p.scope)}})
.catch(function(){th.remove();add(TX.chatError,'s')}).then(function(){state.busy=false;send.disabled=false;renderSug()})}
form.addEventListener('submit',function(e){e.preventDefault();var v=input.value.trim();if(!v||state.busy)return;if(!state.ctx){var g=/قوى|التأمينات|مدد|مقيم|أبشر|بلدي|رخصة|تأشير|qiwa|gosi|mudad|muqeem|absher|balady|visa|licen/i.test(v)?'government':/تأسيس|فرع|شركة جديدة|formation|branch|incorporat|company/i.test(v)?'formation':'consulting';setCtx(g,true)}add(v,'u');state.history.push({role:'user',content:v});input.value='';save();ask()});
// login + create
var challenge='',email='';
$('sv1Create').onclick=function(){if(!state.scope)return;if(window.SV1_SESSION){createRequest();return}$('sv1Login').hidden=false;$('sv1Login').scrollIntoView({behavior:'smooth',block:'nearest'});$('sv1Email').focus()};
$('sv1SendCode').onclick=function(){email=$('sv1Email').value.trim().toLowerCase();var err=$('sv1LoginErr');err.textContent='';if(!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)){err.textContent=TX.loginErr;return}this.disabled=true;var self=this;
fetch('/api/otp',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({action:'start',email:email})}).then(function(r){return r.json()}).then(function(o){self.disabled=false;if(!o||!o.ok){err.textContent=(o&&o.message)||TX.loginErr;return}challenge=o.challenge;$('sv1LoginStep1').hidden=true;$('sv1LoginStep2').hidden=false;if(o.testLogin){$('sv1Code').placeholder='TEST: 123456'}$('sv1Code').focus()}).catch(function(){self.disabled=false;err.textContent=TX.loginErr})};
$('sv1Verify').onclick=function(){var code=$('sv1Code').value.trim();var err=$('sv1LoginErr');err.textContent='';this.disabled=true;var self=this;
fetch('/api/otp',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({action:'verify',email:email,code:code,challenge:challenge,name:$('sv1Name').value.trim()})}).then(function(r){return r.json()}).then(function(o){self.disabled=false;if(!o||!o.ok){err.textContent=TX.codeErr;return}window.SV1_SESSION={user:{email:email}};try{localStorage.setItem('bp_session','1')}catch(e){}createRequest()}).catch(function(){self.disabled=false;err.textContent=TX.codeErr})};
function createRequest(){var ok=$('sv1LoginOk');$('sv1Login').hidden=false;$('sv1LoginStep1').hidden=true;$('sv1LoginStep2').hidden=true;ok.hidden=false;ok.textContent=TX.creating;var sc=state.scope;
fetch('/api/simple',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({action:'request-create',type:sc.type||TYPE[state.ctx]||'CONSULTATION',source:'WEBSITE',lang:LANG,title:sc.title||'',summary:sc.summary||'',scope:sc.items||[],conversation:state.history,name:$('sv1Name').value.trim(),phone:$('sv1Phone').value.trim()})})
.then(function(r){return r.json()}).then(function(o){if(!o||!o.ok){ok.hidden=true;$('sv1LoginErr').textContent=(o&&o.message)||TX.chatError;$('sv1LoginStep1').hidden=false;return}ok.innerHTML='';ok.appendChild(document.createTextNode(TX.created+' '+o.ref+' '));var a=document.createElement('a');a.className='sv1-btn sm';a.href=PORTAL+'?ref='+encodeURIComponent(o.ref);a.textContent=TX.openPortal;ok.appendChild(a);try{sessionStorage.removeItem('sv1_chat')}catch(e){}setTimeout(function(){location.href=a.href},1200)})
.catch(function(){ok.hidden=true;$('sv1LoginErr').textContent=TX.chatError;$('sv1LoginStep1').hidden=false})}
// boot
if(state.history.length){state.history.forEach(function(m){var p=m.role==='assistant'?parseScope(m.content):{text:m.content};if(p.text)add(p.text,m.role==='assistant'?'a':'u')});if(state.scope)showScope(state.scope)}else add(TX.welcome,'a');
if(state.ctx)setCtx(state.ctx,true);else renderSug();
var h=location.hash.replace('#','');if(h==='chat'||/^ctx-/.test(h)){if(/^ctx-/.test(h))setCtx(h.slice(4),true)}
})();</script>`;
    return shell({
      title: { ar: "شريك الأعمال — استشارات، خدمات حكومية، تأسيس شركات", en: "Business Partner — Consulting, government services, company formation", fr: "Business Partner — Conseil, services gouvernementaux, création d'entreprise", zh: "Business Partner — 咨询、政府服务、公司注册" }[l],
      desc: t("heroText").replace(/<[^>]+>/g, ""),
      path, body, script,
    });
  }

  return { buildHome, shell, header, footer, t, arr, href, CSS };
}
