// Business Partner — Simple V1: «الوظائف» (/careers).
//
// قرار المالك ٢٠٢٦/٠٩/٢٤: لقطةٌ من careers.letsshineksa.com (موقع وظائف
// مبنيّ على Teamtailor) وجملة «خلي صفحة التوظيف زي كده». المرجع شاشةٌ واحدة
// بلا تمرير: خلفية رمادية فاتحة، شعارٌ صغير في الأعلى، رسمة فرشاة كبيرة
// بلون العلامة، عنوانٌ أبيض ضخم فوقها ومتداخلٌ معها، زرّان كبيران متجاوران،
// وسهم نزول في دائرة رفيعة أسفل الشاشة.
//
// ما يتغيّر عن المرجع، عمداً:
//   • اللون كحلي العلامة (--ac = #0B1B5A) لا برتقالي شاين.
//   • الرسمة SVG مضمَّنة تُرسَم هنا بمسارات فرشاة (stroke-linecap:round)، لا
//     صورة: لا يوجد في site/assets/img إلا الشعار والغلاف وصورة شخصية،
//     وصورةٌ ثقيلة في البطل تخالف «لا شيء يُجلب قبل أن يُطلب». الرسمة
//     aria-hidden لأنها زخرفة، والعنوان نصٌّ حقيقي فوقها.
//   • زرّ القائمة (☰) لا يُرسم هنا: ترويسة SV1.shell() فوق الصفحة تحمله
//     أصلاً (sv1-burger) ومعها مبدّل اللغة وزرّ الدخول. رسم ☰ ثانٍ على حافة
//     الشاشة نسختان من شيء واحد تتباعدان بعد أول تعديل.
//   • العنوان جملةٌ قصيرة صادقة بلا رقمٍ ولا وعدٍ ولا شهادة.
//
// ⚠️ ما تحت البطل ليس زينة — هو البوابة الوحيدة التي يدخل منها مرشّح إلى
// قاعدتنا. هذا الملف **لا يكتب** أيّاً من هذه القطع؛ يستقبلها جاهزة من
// generate.mjs (مالكها platform-engineer) ويضعها كما هي حرفاً بحرف:
//
//   parts.jobCards  ← jobCardsHtml()        : يحمل #open-jobs و #client-jobs
//                                             و #client-jobs-grid و
//                                             #client-jobs-status و
//                                             .ats-apply-link
//   parts.seekerForm← seekerFormHtml(f,null): نموذج المرشّح كاملاً — #cv-form
//                                             و #c-job-id و #c-job-title
//                                             ورفع السيرة و #cv-success
//   parts.track     ← trackApplicationHtml(): «تابع طلبك» — #track-form
//                                             و #tr-phone و #tr-email
//                                             و #track-result
//
// والمعرّف #seeker-form يبقى على الحاوية نفسها التي كان عليها. كل ما سبق
// يقوده site/assets/js/main.js حيّاً (setSelectedJob و ?job= و loadPostingPage)،
// وإسقاط معرّفٍ واحد منها يقطع ربط الطلب بالإعلان — وهو عطلٌ صامت: النموذج
// يُرسِل، والطلب يصل بلا وظيفة.
//
// ولهذا لا شيء هنا يُحذف من المحتوى القائم: البطل يُضاف فوقه، والقائم ينزل
// تحته كما هو. الوحيد الذي حلّ محلّه البطل هو البطلُ القديم الصغير
// (eyebrow + h1 + lead + زرّان) — ورابطه الوحيد «أنا صاحب عمل» محفوظ تحت
// زرّي البطل الجديد، فلا يضيع مسار.
//
// لا سكربت عميل في هذا الملف: البطل ساكن، وسهم النزول وزرّاه مراسٍ
// (#open-jobs و #seeker-form) لا جافاسكربت. الحركة الوحيدة (نبضة السهم)
// تتوقّف مع prefers-reduced-motion.
//
// التنسيق تحت البطل لا يُعاد بناؤه هنا: styles.css محمَّل على صفحات SV1
// (generate.mjs: head()) وفوقه طبقة SV1_LEGACY_CSS تعيد رسم .card و .btn
// والحقول بلغة الموقع الجديد. المضاف هنا هامشُ تمرير للمراسي وحده، لأن
// ترويسة SV1 لاصقة وبدونه يختفي عنوان القسم تحتها.

const T = {
  // عنوانٌ بلا وعدٍ مخترع: سؤالٌ قصير، كما في المرجع («Ready to Shine؟»).
  head: {
    ar: "جاهز لخطوتك القادمة؟",
    en: "Ready for your next step?",
    fr: "Prêt pour votre prochaine étape ?",
    zh: "准备好迈出下一步了吗？",
  },
  // سطرٌ واحد يصف ما يفعله الزرّان تحته، لا أكثر.
  lead: {
    ar: "تصفّح الوظائف المفتوحة، أو أرسل سيرتك الذاتية مرة واحدة.",
    en: "Browse the open roles, or send your CV once.",
    fr: "Parcourez les postes ouverts, ou envoyez votre CV une seule fois.",
    zh: "浏览开放职位，或一次性提交您的简历。",
  },
  btnJobs: { ar: "الوظائف المفتوحة", en: "Job openings", fr: "Postes ouverts", zh: "开放职位" },
  btnCv: { ar: "أرسل سيرتك الذاتية", en: "Send your CV", fr: "Envoyer votre CV", zh: "提交简历" },
  employer: { ar: "أنا صاحب عمل ←", en: "I'm an employer →", fr: "Je suis employeur →", zh: "我是雇主 →" },
  down: { ar: "انزل إلى الوظائف", en: "Scroll to the jobs", fr: "Aller aux postes", zh: "向下查看职位" },

  // القيم الثلاث — النصّ نفسه الذي كان على الصفحة، مترجَماً للفرنسية والصينية.
  v1h: { ar: "سيرة واحدة، فرص كثيرة", en: "One CV, many opportunities", fr: "Un CV, de nombreuses opportunités", zh: "一份简历，多个机会" },
  v1p: {
    ar: "سجّل مرة واحدة، ونطابقك مع الفرص المناسبة فور توفّرها.",
    en: "Join the pool once; we match you whenever a fitting role opens.",
    fr: "Inscrivez-vous une fois ; nous vous proposons chaque poste qui vous correspond.",
    zh: "只需登记一次，一旦有合适职位我们就为您匹配。",
  },
  v2h: { ar: "أصحاب العمل يوصلونك", en: "Employers reach you", fr: "Les employeurs vous contactent", zh: "雇主主动联系您" },
  v2p: {
    ar: "الشركات التي توظّف عبرنا تشاهد ملفك للفرص المناسبة.",
    en: "Companies hiring through us see your profile for suitable roles.",
    fr: "Les entreprises qui recrutent via nous consultent votre profil pour les postes adaptés.",
    zh: "通过我们招聘的企业会查看您的资料以匹配合适职位。",
  },
  v3h: { ar: "بياناتك محمية", en: "Your data is protected", fr: "Vos données sont protégées", zh: "您的数据受保护" },
  v3p: {
    ar: "لا نشارك سيرتك دون موافقتك (حماية البيانات).",
    en: "We never share your CV without your consent (PDPL).",
    fr: "Nous ne partageons jamais votre CV sans votre consentement (PDPL).",
    zh: "未经您同意，我们绝不分享您的简历（个人数据保护法）。",
  },

  poolH: { ar: "انضم لقاعدة المرشحين العامة", en: "Join the general candidate pool", fr: "Rejoignez le vivier de candidats", zh: "加入通用候选人才库" },
  poolP: {
    ar: "لا تقدّم على وظيفة محددة أعلاه؟ قدّم هنا وسنطابقك عند توفّر فرصة مناسبة.",
    en: "Not applying for a specific posting above? Submit here and we'll match you when a suitable role opens.",
    fr: "Vous ne postulez pas à une offre précise ci-dessus ? Déposez votre candidature ici et nous vous contacterons dès qu'un poste correspond.",
    zh: "没有申请上面的具体职位？在此提交，一旦有合适职位我们会为您匹配。",
  },
};

// رسمة الفرشاة: أربع كنسات بفرشاة عريضة وحوافّ دائرية تتراكب فتقرأ ككتلةٍ
// واحدة حرّة الشكل، كما في المرجع. بلا صورة ولا خطّ خارجي — أقل من كيلوبايت
// داخل الصفحة نفسها، فلا طلب شبكة ثانياً في البطل.
//
// ⚠️ المسارات ليست زخرفة حرّة: العنوان الأبيض يقع فوقها، وأبيضُ على رماديٍّ
// فاتح لا يُقرأ. فالكنسات الثلاث الأولى مقيسة لتغطّي صندوق العنوان كاملاً
// (عرضه ١٠٠٪ ناقص الحشو من الجانبين، وارتفاعه سطران عند أكبر حجم خط) —
// أي المستطيل x ∈ [١١٤، ٧٦٦] و y ∈ [٧٨، ٢٥٢] في إحداثيات viewBox.
// تغييرُ مسارٍ أو عرضِ فرشاة يُخرج حرفاً إلى الرمادي: أعِد القياس بعده
// (المسافة من كل نقطة في الصندوق إلى أقرب مسار ≤ نصف عرض الفرشاة).
// الكنسة الرابعة وحدها حرّة — رشّةٌ خارج الصندوق لكسر الانتظام.
const BRUSH = `<svg class="sv1-ch-brush" viewBox="0 0 880 330" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
        <path d="M140 122C250 74 420 66 560 84c74 10 138 26 180 44" stroke-width="138"/>
        <path d="M136 168C280 140 520 140 744 172" stroke-width="146"/>
        <path d="M144 216c118 54 296 72 460 60 60-5 108-15 140-30" stroke-width="138"/>
        <path d="M604 278c68-9 122-25 148-45" stroke-width="50"/>
      </g>
    </svg>`;

/**
 * جسم صفحة /careers: البطل الجديد + المحتوى القائم كما هو.
 *
 * يُسلَّم إلى sv1LegacyApp() في generate.mjs — فهو وحده الذي يركّب قشرة SV1
 * ويُحمّل main.js وينزع عدّاد القشرة المكرّر. هذا الملف لا يبني صفحة كاملة
 * عمداً: إعادة كتابة ذلك هنا نسخةٌ ثانية من حارسٍ إن تباعدت عُدّت كل زيارة
 * مرّتين بلا عطلٍ ظاهر.
 *
 * @param {{lang:()=>string, esc:(s:string)=>string}} ctx
 * @param {{jobCards:string, seekerForm:string, track:string, employerHref:string}} parts
 *        قطعٌ جاهزة من generate.mjs — تُوضع كما هي، ولا يُعاد بناء أيٍّ منها.
 */
export function careersBody(ctx, parts) {
  const { lang: langFn, esc } = ctx;
  const lang = langFn();
  const t = (k) => { const e = T[k]; return e[lang] != null ? e[lang] : e.en; };
  const p = parts || {};
  const employerHref = p.employerHref || "/employers";

  const CSS = `<style id="sv1-careers-css">
/* البطل: شاشةٌ واحدة تحت ترويسة SV1 (شريط ٣٢px + ترويسة ٧٢px). */
.sv1-legacy .sv1-ch{background:var(--g);border-bottom:1px solid var(--line2);position:relative;
 display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;
 padding:30px 22px 92px;overflow:hidden;
 min-height:calc(100vh - 104px);min-height:calc(100svh - 104px)}
.sv1-ch-in{width:100%;max-width:940px;margin:0 auto;display:flex;flex-direction:column;align-items:center}
.sv1-ch-logo{height:34px;width:auto;display:block;margin:0 auto 16px}

/* الرسمة والعنوان في مكانٍ واحد: العنوان فوقها ومتداخلٌ معها. */
.sv1-ch-art{position:relative;width:100%;max-width:900px}
.sv1-ch-brush{display:block;width:100%;height:auto;color:var(--ac)}
.sv1 .sv1-legacy .sv1-ch-art h1{position:absolute;top:50%;inset-inline:0;transform:translateY(-50%);
 margin:0;padding:0 13%;color:#fff!important;-webkit-text-fill-color:#fff;background:none;
 font-weight:800;letter-spacing:-.03em;line-height:1.2;text-wrap:balance;
 font-size:clamp(26px,6.4vw,74px)}
.sv1-legacy .sv1-ch-lead{margin:6px auto 0;max-width:560px;color:var(--mut);font-weight:300;
 font-size:15px;line-height:1.9}

/* الزرّان: حبّتان مملوءتان متساويتان، كما في المرجع. */
.sv1-ch-acts{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-top:22px}
.sv1-legacy .sv1-ch-acts a{display:inline-flex;align-items:center;justify-content:center;
 min-width:230px;padding:17px 30px;border-radius:999px;border:1px solid var(--ac);
 background:var(--ac);color:#fff;font-size:16px;font-weight:600;line-height:1.2;
 box-shadow:0 12px 28px -14px rgba(11,27,90,.6);transition:background .15s,transform .15s}
.sv1-legacy .sv1-ch-acts a:hover{background:var(--ac2);border-color:var(--ac2);transform:translateY(-1px)}
.sv1-legacy .sv1-ch-alt{margin:18px 0 0;font-size:13px;color:var(--mut)}
.sv1-legacy .sv1-ch-alt a{color:var(--ac);font-weight:500;border-bottom:1px solid var(--acLine)}

/* سهم النزول — توسيطٌ بخصائص فيزيائية لأنه محايد الاتجاه في العربية. */
.sv1-legacy .sv1-ch-down{position:absolute;bottom:24px;left:50%;transform:translateX(-50%);
 width:44px;height:44px;border-radius:50%;border:1px solid var(--acLine);background:rgba(255,255,255,.72);
 display:grid;place-items:center;color:var(--ac);font-size:17px;line-height:1;
 animation:sv1chDown 2.4s ease-in-out infinite}
.sv1-legacy .sv1-ch-down:hover{border-color:var(--ac);background:#fff}
@keyframes sv1chDown{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(5px)}}
@media(prefers-reduced-motion:reduce){.sv1-legacy .sv1-ch-down{animation:none}}

/* الترويسة لاصقة: بلا هذا الهامش يقف القسم المقصود تحتها فيختفي عنوانه. */
.sv1-legacy #open-jobs,.sv1-legacy #client-jobs,.sv1-legacy #seeker-form{scroll-margin-top:92px}

@media(max-width:560px){
 .sv1-legacy .sv1-ch{padding:22px 18px 84px;min-height:calc(100vh - 92px);min-height:calc(100svh - 92px)}
 /* الحشو يبقى ١٣٪ على الجوال أيضاً: تضييقه يدفع طرفَي السطر خارج الحبر. */
 .sv1 .sv1-legacy .sv1-ch-art h1{font-size:clamp(23px,7.4vw,40px)}
 .sv1-ch-acts{gap:10px;width:100%}
 .sv1-legacy .sv1-ch-acts a{min-width:0;width:100%;padding:15px 22px;font-size:15px}
}
</style>`;

  const hero = `
  <section class="sv1-ch">
    <div class="sv1-ch-in">
      <img class="sv1-ch-logo" src="/assets/img/logo.png" alt="Business Partner" width="180" height="34">
      <div class="sv1-ch-art">
        ${BRUSH}
        <h1>${esc(t("head"))}</h1>
      </div>
      <p class="sv1-ch-lead">${esc(t("lead"))}</p>
      <div class="sv1-ch-acts">
        <a href="#open-jobs">${esc(t("btnJobs"))}</a>
        <a href="#seeker-form">${esc(t("btnCv"))}</a>
      </div>
      <p class="sv1-ch-alt"><a href="${esc(employerHref)}">${esc(t("employer"))}</a></p>
    </div>
    <a class="sv1-ch-down" href="#open-jobs" aria-label="${esc(t("down"))}" title="${esc(t("down"))}">↓</a>
  </section>`;

  const value = [
    ["📄", t("v1h"), t("v1p")],
    ["🤝", t("v2h"), t("v2p")],
    ["🔒", t("v3h"), t("v3p")],
  ].map((x) => `<div class="card"><div class="card-icon" style="font-size:1.5rem">${x[0]}</div><h3>${esc(x[1])}</h3><p>${esc(x[2])}</p></div>`).join("");

  // ما تحت البطل: بطاقات الوظائف كما هي، ثم القيم الثلاث، ثم النموذج داخل
  // الحاوية نفسها التي تحمل #seeker-form، ثم «تابع طلبك» كما هو.
  return `${CSS}${hero}

  ${p.jobCards || ""}

  <section class="section"><div class="container">
    <div class="grid grid-3" style="margin-bottom:36px">${value}</div>
    <div style="max-width:640px;margin:0 auto" id="seeker-form">
      <h2 class="center">${esc(t("poolH"))}</h2>
      <p class="center text-soft" style="margin-top:-8px">${esc(t("poolP"))}</p>
      ${p.seekerForm || ""}
    </div>
  </div></section>

  ${p.track || ""}`;
}
