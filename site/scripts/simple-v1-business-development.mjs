// Business Partner — Simple V1: «تطوير الأعمال كخدمة» (/business-development).
//
// أصل الصفحة: عمود من الأعمدة الخمسة التي يخاطب بها البريد السنوي الشركات
// السعودية القائمة (الخدمات الحكومية · التحوّل الرقمي بالذكاء الاصطناعي · EOR ·
// Business Partner AI · تطوير الأعمال)، كتبتها جلسة التسويق على الفرع
// claude/multi-platform-marketing-agents-9i0wpl (الكوميت a71f319f6) ولم تصل
// فرع الإنتاج. هذه نسخة مبنيّة عليها بإضافة الشراء المباشر (انظر أدناه).
//
// بُنيت على SV1.shell() تطبيقاً لـCLAUDE.md §2.6 — الصفحة القديمة (buildBdaas في
// generate.mjs) كانت على الطبقة القديمة، وفيها ما لم يعد سياسة: «ابدأ 30 يوماً
// مجاناً» وأرقام الباقات والعمولة مكتوبة يدوياً في المولّد (لا من الكتالوج)،
// وبكودين مختلفين (revos-* ≠ REV-*) وأسعار عمولة متضاربة. لا شيء من ذلك هنا.
//
// السياسات المطبّقة هنا:
//   • SHOW_PRICES=false — لا سعر ولا نسبة عمولة للزائر. رقم الباقة يُقرأ من
//     الكتالوج بالـSKU (services.json: price.amount) ويُرسم بصنف price-amt فلا
//     يظهر إلا للمسجَّل. أوصاف services.json للباقات REV-* تذكر الرسوم والعمولة
//     نصّاً، فلا تُطبع في الصفحة العامة بحال. اسم الباقة من service-i18n.json.
//   • الأسماء والأكواد والأسعار من الكتالوج بالـSKU وحده — لا باقة ولا رقم
//     مكتوبان هنا.
//   • لا زرّ واتساب داخل المحتوى (الزرّ العائم في القشرة وحده).
//   • «المستشار الذكي» لا «الوكيل»، و«Business Partner» في كل اللغات.
//   • الشراء = عرض سعر مباشر بنطاق العمل (طلب المالك 2026-10-29). زرّ «اطلب
//     عرض السعر» على كل باقة لا يضعها في السلة: السلة تدفع أولاً ثم تفتح طلباً
//     بلا عرض ولا نطاق، والاشتراك الذي يُدار شهرياً يحتاج نطاقاً مكتوباً قبل
//     الدفع. الزرّ يفتح طلباً من النوع BUSINESS_DEVELOPMENT في حساب العميل
//     (`request-create`) ببند واحد هو كود الباقة ووصفه «ما سنعمل عليه»، ثم
//     يعتمد النطاق (`scope-confirm`) فيصدر عرض السعر آلياً من سعر الكتالوج
//     بالـSKU، ويقع العميل في /my على عرضٍ مكتوب فيه ما سنشتغل عليه، ثم العقد
//     فالتوقيع فالدفع. الباقة التي بلا سعر في الكتالوج (START/TEAM/ENT) تذهب
//     إلى التسعير البشري وتُخبر العميل بذلك — لا سعر يُخترع.
//   • لا دالة api/ جديدة ولا تغيير في _simple.js: كله بإجراءات قائمة.
//   • قيد requests_type_check في قاعدة الإنتاج قد لا يقبل BUSINESS_DEVELOPMENT بعد
//     (db/schema.sql آخر الملف — migration ينفّذه المالك). إن رُفض النوع يُعاد
//     الإنشاء بالنوع CONSULTATION والعنوان نفسه فلا يضيع طلب عميل.
//
// fr و zh تعرض الإنجليزية حتى تُترجم، كبقية صفحات SV1.
//
// ترتيب الباقات ثابت هنا (الست المعتمدة) ويُقرأ كلٌّ منها من الكتالوج؛ باقة غير
// موجودة في services.json لا تُعرض، فإن أُخفيت REV-* مركزياً سقطت بطاقاتها وحدها.

const ORDER = ["REV-START", "REV-LAUNCH", "REV-GROWTH", "REV-PRO", "REV-TEAM", "REV-ENT"];

const T = {
  title: {
    ar: "تطوير الأعمال كخدمة — عملاء وفرص وإيراد",
    en: "Business Development as a Service — customers, pipeline, revenue",
  },
  desc: {
    ar: "فريق تطوير أعمال ومنصة واحدة: بحث وتأهيل وتواصل واجتماعات وعروض وعقود ومتابعة تحصيل — بلا أن توظّف فريقاً كاملاً.",
    en: "One business-development team and platform: research, qualification, outreach, meetings, proposals, contracts and collection follow-up — without hiring a full team.",
  },
  tag: { ar: "تطوير الأعمال كخدمة", en: "Business Development as a Service" },
  h1: {
    ar: "فريق تطوير أعمال يعمل عندك — بلا توظيف",
    en: "A business-development team working for you — without hiring one",
  },
  lead: {
    ar: "منشأتك قائمة ومنتجها جاهز، والناقص هو من يملأ مسار المبيعات ويحرّكه. نتولّى عنك تحديد العميل المثالي وبناء قائمة الحسابات المستهدفة والتواصل وحجز الاجتماعات وتجهيز العروض ومتابعة العقد والتحصيل — في مسار واحد مكتوب وقابل للقياس.",
    en: "Your business exists and your offer is ready; what is missing is someone to fill the sales pipeline and keep it moving. We define your ideal customer, build the target-account list, run the outreach, book the meetings, prepare the proposals and follow the contract and collection through — in one documented, measurable pipeline.",
  },
  ctaPackages: { ar: "اختر باقتك", en: "Choose your package" },
  ctaConsult: { ar: "احجز استشارة", en: "Book a consultation" },
  tr1: { ar: "مسار مبيعات موثّق لا مجهود متفرّق", en: "A documented pipeline, not scattered effort" },
  tr2: { ar: "نطاق عمل مكتوب في عرض السعر قبل الدفع", en: "A written scope of work in the quotation, before you pay" },
  tr3: { ar: "تقارير ومتابعة داخل حسابك", en: "Reporting and follow-up inside your account" },

  whoH: { ar: "من تناسبه الخدمة", en: "Who it suits" },
  whoP: {
    ar: "منشآت قائمة تبيع لمنشآت أو لجهات حكومية، ويعنيها أن يصل المنتج إلى من يقرّر الشراء.",
    en: "Established businesses selling to companies or government entities, that need their offer to reach the person who decides.",
  },
  w1: { ar: "منشأة بلا فريق مبيعات", en: "A business with no sales team" },
  w1p: {
    ar: "المالك أو المدير يبيع بنفسه بين المهام، فيتوقّف النمو عند وقته المتاح.",
    en: "The owner or manager sells between other duties, so growth stops at the hours they have left.",
  },
  w2: { ar: "فريق مبيعات بلا مسار", en: "A sales team with no pipeline" },
  w2p: {
    ar: "يوجد من يبيع لكن لا توجد قائمة حسابات ولا تواصل منظّم ولا مصدر فرصٍ ثابت.",
    en: "There are people selling, but no account list, no organized outreach and no steady source of opportunities.",
  },
  w3: { ar: "منتج جديد أو سوق جديد", en: "A new product or a new market" },
  w3p: {
    ar: "خدمة أو منتج جاهز يحتاج أول خمسين عميلاً محتملاً وأول عشرة اجتماعات.",
    en: "A ready service or product that needs its first fifty prospects and first ten meetings.",
  },
  w4: { ar: "شركة أجنبية تدخل السوق السعودي", en: "A foreign company entering the Saudi market" },
  w4p: {
    ar: "تحتاج من يفتح الأبواب ويتكلّم لغة السوق قبل أن تبني فريقاً محلياً.",
    en: "Needs someone to open doors and speak the market's language before building a local team.",
  },

  doH: { ar: "ماذا نفعل بالتحديد", en: "What we actually do" },
  doP: {
    ar: "ستّ وظائف متصلة. ما نقوم به ونسلّمه مكتوبٌ في نطاق العمل قبل البدء، فلا شيء متروكاً للفهم.",
    en: "Six connected functions. What we do and hand over is written into the scope of work before we start — nothing is left to interpretation.",
  },
  d1: { ar: "تحديد العميل المثالي والحسابات المستهدفة", en: "Ideal customer profile and target accounts" },
  d1p: {
    ar: "نحدّد القطاع والحجم والمنطقة وصاحب القرار، ونبني قائمة حسابات مسمّاة بجهات تواصلها، بدل التسويق للجميع.",
    en: "We define sector, size, region and decision-maker, and build a named account list with its contacts — instead of marketing to everyone.",
  },
  d2: { ar: "التواصل وحجز الاجتماعات", en: "Outreach and booking meetings" },
  d2p: {
    ar: "رسائل ومكالمات ومتابعات بتتابعٍ مكتوب، وهدف الخدمة اجتماعٌ مؤكّد في تقويمك لا رسالةٌ مُرسلة.",
    en: "Messages, calls and follow-ups on a written sequence. The output is a confirmed meeting on your calendar, not a message sent.",
  },
  d3: { ar: "تأهيل الفرص وبناء المسار", en: "Qualifying opportunities and building the pipeline" },
  d3p: {
    ar: "كل فرصة تُقيَّم: الحاجة والميزانية وصاحب القرار والتوقيت، وتدخل مرحلةً معروفة بقيمة واحتمال إغلاق.",
    en: "Every opportunity is assessed — need, budget, decision-maker and timing — then enters a known stage with a value and a close probability.",
  },
  d4: { ar: "العروض والتفاوض والعقود", en: "Proposals, negotiation and contracts" },
  d4p: {
    ar: "نجهّز العرض الفني والمالي ونساند التفاوض حتى التوقيع، ويبقى القرار المالي قرارك وحدك.",
    en: "We prepare the technical and commercial proposal and support the negotiation up to signature; the commercial decision stays yours alone.",
  },
  d5: { ar: "الشركاء والموردون والقنوات", en: "Partners, suppliers and channels" },
  d5p: {
    ar: "ليس كل نمو بيعاً مباشراً: نبحث لك عن موزّع أو شريك تنفيذ أو مورّد أرخص أو قناة بيع جاهزة.",
    en: "Not all growth is direct selling: we look for a distributor, an implementation partner, a cheaper supplier or a ready sales channel.",
  },
  d6: { ar: "القياس والتقارير والتحصيل", en: "Measurement, reporting and collection" },
  d6p: {
    ar: "عدد الحسابات والاجتماعات والعروض والصفقات والإيراد المحصّل — رقمٌ واحد لكل مرحلة، ومتابعة للتحصيل بعد العقد.",
    en: "Accounts, meetings, proposals, deals and collected revenue — one number per stage, with collection followed up after the contract.",
  },

  howH: { ar: "من الشراء إلى بدء العمل", en: "From buying to the first day of work" },
  s1: { ar: "تختار باقتك وتضغط «اطلب عرض السعر»، فنفتح لك طلباً في حسابك.", en: "You choose a package and press “Get the quotation”; we open a request in your account." },
  s2: { ar: "يصدر عرض السعر مباشرةً ومكتوباً فيه ما سنعمل عليه شهرياً وما نسلّمه.", en: "The quotation is issued straight away, with what we will work on each month and what we hand over." },
  s3: { ar: "تراجع العرض وتعتمده من حسابك، فيصلك العقد للتوقيع الإلكتروني ثم الدفع.", en: "You review and approve it in your account; the contract follows for e-signature, then payment." },
  s4: { ar: "جلسة تعريف وبناء الأساس: العميل المثالي، قائمة الحسابات، الرسائل، أدوات المتابعة.", en: "A discovery session and the base: ideal customer, account list, messaging, follow-up tooling." },
  s5: { ar: "التشغيل بتقرير دوري، ومراجعة ربعية: ما نجح يُوسَّع، وما لم ينجح يُغيَّر أو يُوقف.", en: "Operating with periodic reporting and a quarterly review: what worked is scaled, what did not is changed or stopped." },

  pkH: { ar: "الباقات", en: "Packages" },
  pkP: {
    ar: "ستّ باقات معتمدة في الكتالوج. اختر باقتك وسنكتب لك عرض السعر مباشرةً بما سنعمل عليه، وتراجعه وتعتمده من حسابك ثم يصلك العقد للتوقيع والدفع. السعر يراه المسجَّل في حسابه وفي عرض السعر.",
    en: "Six approved catalogue packages. Choose yours and we write the quotation straight away with what we will work on; you review and approve it from your account, then receive the contract to sign and pay. Pricing is visible to signed-in clients and in the quotation.",
  },
  pkMonthly: { ar: "اشتراك شهري", en: "Monthly subscription" },
  pkOnCase: { ar: "سعر حسب حالتك", en: "Priced to your case" },
  pkPerMonth: { ar: "ريال / شهرياً", en: "SAR / month" },
  pkVat: { ar: "قبل ضريبة القيمة المضافة", en: "Before VAT" },
  pkBuy: { ar: "اطلب عرض السعر", en: "Get the quotation" },
  pkScopeH: { ar: "ما سنعمل عليه", en: "What we will work on" },
  pkNote: {
    ar: "لم تعرف الباقة المناسبة؟ احجز استشارة واشرح حالتك، ونقترح عليك باقةً واحدة بسببها.",
    en: "Not sure which package fits? Book a consultation, describe your case, and we will recommend one package and say why.",
  },
  // ما يُكتب في عرض السعر تحت اسم الباقة («ما سنعمل عليه»). نصٌّ واحد لكل الباقات
  // — الفروق بينها (حجم الفريق ومن يُغلق) تُكتب في العرض بعد التسعير — وهو أقل
  // من 400 حرفٍ لأن الخادم يقصّ وصف البند عندها (normScope: why ≤ 400).
  scopeLine: {
    ar: "نطاق العمل الشهري: ١) تحديد العميل المثالي والحسابات المستهدفة ٢) التواصل وحجز الاجتماعات ٣) تأهيل الفرص وبناء المسار ٤) تجهيز العروض ومساندة التفاوض ٥) البحث عن الشركاء والموردين والقنوات ٦) تقارير القياس ومتابعة التحصيل. لا ضمان لعدد صفقات.",
    en: "Monthly scope of work: 1) ideal customer and target accounts 2) outreach and booking meetings 3) qualifying opportunities and building the pipeline 4) preparing proposals and supporting negotiation 5) finding partners, suppliers and channels 6) measurement reports and collection follow-up. No number of deals is guaranteed.",
  },
  docs: {
    ar: ["وصف المنشأة ومنتجاتها وخدماتها", "العميل المستهدف والقطاعات والمدن المطلوبة", "الشعار وملف تعريفي بالمنشأة (إن وُجد)"],
    en: ["Description of the business, its products and services", "Target customers, sectors and cities", "Logo and company profile (if any)"],
  },
  buyBusy: { ar: "نُجهّز عرض السعر…", en: "Preparing your quotation…" },
  buyLogin: { ar: "سنحوّلك لتسجيل الدخول ثم نُكمل عرض السعر تلقائياً.", en: "We will take you to sign in, then continue the quotation automatically." },
  buyErr: { ar: "تعذّر إنشاء الطلب الآن. حاول مرة أخرى، أو احجز استشارة.", en: "We could not create the request right now. Please try again, or book a consultation." },
  buyDone: { ar: "جاهز — نفتح لك العرض…", en: "Ready — opening your quotation…" },
  buyPricing: { ar: "استلمنا طلبك. هذه الباقة تُسعَّر حسب حالتك، وفريقنا يجهّز عرض السعر وسنُبلغك داخل حسابك.", en: "Request received. This package is priced to your case; our team is preparing the quotation and will update you inside your account." },
  reqTitle: { ar: "طلب باقة تطوير الأعمال", en: "Business development package request" },
  reqSummary: { ar: "طلب عرض سعر مباشر لباقة من صفحة تطوير الأعمال كخدمة.", en: "Direct quotation request for a package from the Business Development as a Service page." },

  faqH: { ar: "أسئلة شائعة", en: "Frequently asked questions" },
  q1: { ar: "هل تضمنون عدداً من الصفقات؟", en: "Do you guarantee a number of deals?" },
  a1: {
    ar: "لا. نلتزم بما نسيطر عليه: عدد الحسابات المستهدفة والتواصل والاجتماعات المؤكّدة والعروض المجهّزة، وكلها مكتوبة في نطاق العمل. الإغلاق يعتمد على منتجك وسعرك وقدرتك على التنفيذ، ولا يصحّ أن يوعد به أحد.",
    en: "No. We commit to what we control: target accounts, outreach, confirmed meetings and prepared proposals, all written into the scope of work. Closing depends on your offer, your price and your delivery capacity, and nobody can honestly promise it.",
  },
  q2: { ar: "كم السعر؟", en: "What does it cost?" },
  a2: {
    ar: "يختلف بالباقة وبحجم الفريق المخصّص لك. الأسعار تظهر للمسجّلين وفي عرض السعر؛ بعض الباقات اشتراك شهري ثابت، وبعضها يُسعَّر حسب حالتك فيجهّزه فريقنا بعد مراجعة طلبك.",
    en: "It depends on the package and the size of the team dedicated to you. Prices are shown to signed-in clients and in the quotation; some packages are a fixed monthly subscription, others are priced to your case and prepared by our team after reviewing your request.",
  },
  q3: { ar: "هل تعملون باسم منشأتي أم باسمكم؟", en: "Do you work under my name or yours?" },
  a3: {
    ar: "باسم منشأتك. التواصل والعروض والاجتماعات تحمل اسمك وهويتك، ونحن فريق تطوير الأعمال خلفها. ما نكتبه ونرسله يُعتمد منك قبل الإرسال في بداية التشغيل.",
    en: "Under your name. Outreach, proposals and meetings carry your brand, and we are the business-development team behind them. At the start of the engagement, what we write and send is approved by you before it goes out.",
  },
  q4: { ar: "ما الذي تحتاجونه منّي؟", en: "What do you need from me?" },
  a4: {
    ar: "وصفٌ صادق للمنتج وأسعاره، وجهة اتصال واحدة عندك تردّ، وقدرة تنفيذٍ تستقبل العملاء الجدد. أسوأ نتيجة هي مسارٌ ممتلئ ومنشأةٌ لا تستطيع التسليم.",
    en: "An honest description of the offer and its pricing, one responsive point of contact on your side, and the delivery capacity to absorb new customers. The worst outcome is a full pipeline and a business that cannot deliver.",
  },
  q5: { ar: "كيف أتابع العمل؟", en: "How do I follow the work?" },
  a5: {
    ar: "بتقرير دوري ولوحة متابعة داخل حسابك: الحسابات والاجتماعات والعروض والصفقات والإيراد المحصّل، مرحلةً مرحلة. ولك مراجعة ربعية تُعاد فيها الخطة.",
    en: "Through periodic reporting and a tracking dashboard inside your account: accounts, meetings, proposals, deals and collected revenue, stage by stage. Plus a quarterly review where the plan is reset.",
  },
  q6: { ar: "ما الفرق بينكم وبين وكالة تسويق؟", en: "How are you different from a marketing agency?" },
  a6: {
    ar: "وكالة التسويق تشتري انتباهاً وتوصّل زيارات. نحن نعمل بعدها: حساباتٌ مسمّاة، وتواصلٌ فردي، واجتماعاتٌ مع صاحب القرار، وعروض وعقود. الوظيفتان تتكاملان ولا تتبادلان.",
    en: "A marketing agency buys attention and delivers traffic. We work after that: named accounts, one-to-one outreach, meetings with the decision-maker, proposals and contracts. The two complement each other; they do not substitute.",
  },

  endH: { ar: "ابدأ بعرض سعر", en: "Start with a quotation" },
  endP: {
    ar: "اختر باقتك من الأعلى فيصلك عرض السعر بنطاق العمل مباشرةً. لا يُلزمك العرض بشيء قبل أن تعتمده وتوقّع.",
    en: "Choose your package above and the quotation with the scope of work reaches you straight away. It commits you to nothing until you approve and sign.",
  },
  endCat: { ar: "كل الخدمات", en: "All services" },
};

export function buildSimpleBizDev(SV1, ctx) {
  const { lang: langFn, esc, services = [], svcI18n = {} } = ctx;
  const lang = langFn();
  const ar = lang === "ar";
  const t = (k) => {
    const e = T[k];
    return e && e[lang] != null ? e[lang] : e ? e.en : "";
  };
  const tl = (k) => {
    const e = T[k];
    return e && Array.isArray(e[lang]) ? e[lang] : e ? e.en : [];
  };
  const pre = lang === "en" ? "" : "/" + lang;
  const u = (p) => pre + p;
  const arrow = ar ? "←" : "→";
  const consultHref = u("/consultation") + "?about=" + encodeURIComponent(t("tag"));
  const fmt = (n) => Number(n).toLocaleString("en-US");

  // الباقات من الكتالوج وحده: الكود والاسم والسعر ونموذج التسعير. لا رقم هنا.
  // ما لا سعر له (price.amount = null) يُعرض «سعر حسب حالتك» ويمرّ بالتسعير البشري.
  const byCode = new Map(services.map((s) => [String(s.code || "").toUpperCase(), s]));
  const packList = ORDER.map((code) => byCode.get(code)).filter(Boolean).map((s) => {
    const i18n = svcI18n[String(s.code).toUpperCase()] || {};
    const name = (ar && i18n.ar) || i18n[lang] || i18n.en || s.name || "";
    const amount = s.price && s.price.amount != null && Number(s.price.amount) > 0 ? Number(s.price.amount) : null;
    return { code: String(s.code).toUpperCase(), slug: s.slug, name, amount };
  });

  const packs = packList.map((p) => `<div class="sv1-bd-pack" id="pkg-${esc(p.code.toLowerCase())}" data-code="${esc(p.code)}">
      <span class="sv1-bd-code sv1-mono en">${esc(p.code)}</span>
      <strong>${esc(p.name)}</strong>
      ${p.amount != null
        ? `<div class="sv1-bd-price price-amt"><b>${esc(fmt(p.amount))}</b> <span>${esc(t("pkPerMonth"))}</span><small>${esc(t("pkVat"))}</small></div>
      <em class="price-amt">${esc(t("pkMonthly"))}</em>`
        : `<em>${esc(t("pkOnCase"))}</em>`}
      <button type="button" class="sv1-btn primary sv1-bd-buy" data-bd-buy="${esc(p.code)}" data-name="${esc(p.name)}" data-track="${esc("باقة تطوير الأعمال: " + p.code)}">${esc(t("pkBuy"))}</button>
      <a class="sv1-bd-more" href="${esc(u("/services/" + p.slug))}">${esc(ar ? "تفاصيل الباقة" : "Package details")} ${arrow}</a>
    </div>`).join("");

  const cards = (items) => items.map(([h, p]) =>
    `<div class="sv1-bd-card"><h3>${esc(t(h))}</h3><p>${esc(t(p))}</p></div>`).join("");

  const CSS = `<style id="sv1-bd-css">
.sv1-bd-hero{padding:48px 0 34px;border-bottom:1px solid var(--l)}
.sv1-bd-hero h1{font-size:clamp(29px,4.3vw,50px);line-height:1.12;letter-spacing:-.032em;font-weight:200;color:var(--ink);margin:14px 0 14px;max-width:16em}
.sv1-bd-hero .sv1-lead{max-width:44em}
.sv1-bd-acts{display:flex;gap:10px;flex-wrap:wrap;margin:22px 0 0}
.sv1-bd-trust{list-style:none;display:flex;gap:8px 22px;flex-wrap:wrap;padding:0;margin:22px 0 0}
.sv1-bd-trust li{font-size:12.5px;color:var(--mut);position:relative;padding-inline-start:16px}
.sv1-bd-trust li::before{content:"";position:absolute;inset-inline-start:0;top:8px;width:6px;height:6px;border-radius:50%;background:var(--ac)}
.sv1-bd-grid{display:grid;gap:12px;grid-template-columns:repeat(3,minmax(0,1fr))}
.sv1-bd-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}
.sv1-bd-card{background:#fff;border:1px solid var(--l);border-radius:14px;padding:18px 19px;box-shadow:var(--sh)}
.sv1-bd-card h3{font-size:15.5px;font-weight:500;color:var(--ink);margin:0 0 7px;line-height:1.5}
.sv1-bd-card p{font-size:13.5px;color:var(--mut);margin:0;line-height:1.85}
.sv1-bd-steps{counter-reset:bd;display:grid;gap:10px;max-width:880px;padding:0;margin:0}
.sv1-bd-steps li{counter-increment:bd;list-style:none;display:flex;gap:14px;align-items:flex-start;background:#fff;border:1px solid var(--l);border-radius:13px;padding:14px 16px;font-size:14px;color:var(--t);line-height:1.8}
.sv1-bd-steps li::before{content:counter(bd);flex:0 0 28px;height:28px;border-radius:9px;background:var(--acSoft);color:var(--ac);border:1px solid var(--acLine);display:flex;align-items:center;justify-content:center;font-size:12.5px;font-family:var(--fm)}
.sv1-bd-packs{display:grid;gap:12px;grid-template-columns:repeat(3,minmax(0,1fr))}
.sv1-bd-pack{display:flex;flex-direction:column;gap:9px;background:#fff;border:1px solid var(--l);border-radius:14px;padding:18px;box-shadow:var(--sh);transition:border-color .2s ease,box-shadow .2s ease}
.sv1-bd-pack:hover,.sv1-bd-pack.pick{border-color:var(--acLine);box-shadow:var(--sh2)}
.sv1-bd-code{font-size:10.5px;letter-spacing:.08em;color:var(--faint)}
.sv1-bd-pack strong{font-size:14.5px;font-weight:500;color:var(--ink);line-height:1.6}
.sv1-bd-price{display:flex;align-items:baseline;flex-wrap:wrap;gap:6px;color:var(--ink)}
.sv1-bd-price b{font-size:24px;font-weight:500;font-family:var(--fm)}
.sv1-bd-price span{font-size:12.5px;color:var(--mut)}
.sv1-bd-price small{flex-basis:100%;font-size:11px;color:var(--faint)}
.sv1-bd-pack em{font-style:normal;font-size:12px;color:var(--ac);background:var(--acSoft);border:1px solid var(--acLine);border-radius:999px;padding:3px 10px;align-self:flex-start}
.sv1-bd-pack .sv1-btn{margin-top:auto;justify-content:center}
.sv1-bd-more{font-size:12.5px;color:var(--mut);padding-top:2px}
.sv1-bd-more:hover{color:var(--ac)}
.sv1-bd-scope{background:#fff;border:1px solid var(--l);border-radius:14px;padding:16px 18px;margin:0 0 14px;max-width:880px;font-size:13.5px;color:var(--s);line-height:1.9}
.sv1-bd-scope b{color:var(--ink);font-weight:500}
.sv1-bd-msg{display:none;margin:14px 0 0;max-width:880px;padding:12px 15px;border-radius:12px;font-size:13.5px;line-height:1.8;background:var(--acSoft);border:1px solid var(--acLine);color:var(--ink)}
.sv1-bd-msg.on{display:block}
.sv1-bd-msg.err{background:#fdf1f1;border-color:#e9b9b9;color:#8a1c1c}
.sv1-bd-note{font-size:13px;color:var(--mut);margin:16px 0 0;max-width:46em}
.sv1-bd-note a{color:var(--ac);text-decoration:underline}
.sv1-bd-faq{display:grid;gap:9px;max-width:900px}
.sv1-bd-faq details{background:#fff;border:1px solid var(--l);border-radius:13px;padding:13px 16px}
.sv1-bd-faq summary{cursor:pointer;font-size:14.5px;color:var(--ink);font-weight:500;line-height:1.6}
.sv1-bd-faq p{font-size:13.5px;color:var(--mut);margin:10px 0 0;line-height:1.85}
.sv1-bd-end{background:var(--acSoft);border:1px solid var(--acLine);border-radius:16px;padding:28px}
.sv1-bd-end h2{margin:0 0 8px}
.sv1-bd-end p{font-size:14px;color:var(--s);max-width:44em;margin:0 0 18px}
@media(max-width:900px){.sv1-bd-grid,.sv1-bd-grid.two,.sv1-bd-packs{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:640px){
  .sv1-bd-hero{padding:28px 0 22px}
  .sv1-bd-grid,.sv1-bd-grid.two,.sv1-bd-packs{grid-template-columns:1fr}
  .sv1-bd-acts .sv1-btn{flex:1 1 100%;justify-content:center}
  .sv1-bd-end{padding:18px}
  .sv1-bd-card{padding:15px 16px}
}
</style>`;

  const body = `${SV1.header("/business-development")}
  <main>
  <section class="sv1-sec sv1-bd-hero"><div class="wrap">
    <span class="sv1-tag">${esc(t("tag"))}</span>
    <h1>${esc(t("h1"))}</h1>
    <p class="sv1-lead">${esc(t("lead"))}</p>
    <div class="sv1-bd-acts">
      <a class="sv1-btn primary" href="#packages" data-track="تطوير الأعمال: اختر باقتك">${esc(t("ctaPackages"))}</a>
      <a class="sv1-btn" href="${esc(consultHref)}" data-track="تطوير الأعمال: احجز استشارة">${esc(t("ctaConsult"))}</a>
    </div>
    <ul class="sv1-bd-trust"><li>${esc(t("tr1"))}</li><li>${esc(t("tr2"))}</li><li>${esc(t("tr3"))}</li></ul>
  </div></section>

  <section class="sv1-sec"><div class="wrap">
    <div class="sv1-title"><h2>${esc(t("whoH"))}</h2><p>${esc(t("whoP"))}</p></div>
    <div class="sv1-bd-grid two">${cards([["w1", "w1p"], ["w2", "w2p"], ["w3", "w3p"], ["w4", "w4p"]])}</div>
  </div></section>

  <section class="sv1-sec sv1-gray"><div class="wrap">
    <div class="sv1-title"><h2>${esc(t("doH"))}</h2><p>${esc(t("doP"))}</p></div>
    <div class="sv1-bd-grid">${cards([["d1", "d1p"], ["d2", "d2p"], ["d3", "d3p"], ["d4", "d4p"], ["d5", "d5p"], ["d6", "d6p"]])}</div>
  </div></section>

  <section class="sv1-sec"><div class="wrap">
    <div class="sv1-title"><h2>${esc(t("howH"))}</h2></div>
    <ol class="sv1-bd-steps">${["s1", "s2", "s3", "s4", "s5"].map((k) => `<li>${esc(t(k))}</li>`).join("")}</ol>
  </div></section>

  ${packs ? `<section class="sv1-sec sv1-gray" id="packages"><div class="wrap">
    <div class="sv1-title"><h2>${esc(t("pkH"))}</h2><p>${esc(t("pkP"))}</p></div>
    <div class="sv1-bd-scope"><b>${esc(t("pkScopeH"))}:</b> ${esc(t("scopeLine"))}</div>
    <div class="sv1-bd-packs">${packs}</div>
    <div class="sv1-bd-msg" id="bdMsg" role="status" aria-live="polite"></div>
    <p class="sv1-bd-note">${esc(t("pkNote"))} <a href="${esc(consultHref)}">${esc(t("ctaConsult"))}</a></p>
  </div></section>` : ""}

  <section class="sv1-sec${packs ? "" : " sv1-gray"}"><div class="wrap">
    <div class="sv1-title"><h2>${esc(t("faqH"))}</h2></div>
    <div class="sv1-bd-faq">
      ${[["q1", "a1"], ["q2", "a2"], ["q3", "a3"], ["q4", "a4"], ["q5", "a5"], ["q6", "a6"]]
        .map(([q, a]) => `<details><summary>${esc(t(q))}</summary><p>${esc(t(a))}</p></details>`).join("")}
    </div>
  </div></section>

  <section class="sv1-sec sv1-gray"><div class="wrap">
    <div class="sv1-bd-end">
      <h2>${esc(t("endH"))}</h2>
      <p>${esc(t("endP"))}</p>
      <div class="sv1-bd-acts">
        <a class="sv1-btn primary" href="#packages" data-track="تطوير الأعمال: اختر باقتك (الأسفل)">${esc(t("ctaPackages"))}</a>
        <a class="sv1-btn" href="${esc(u("/catalog"))}">${esc(t("endCat"))}</a>
      </div>
    </div>
  </div></section>
  </main>
${SV1.footer()}`;

  // ---- الشراء المباشر: طلب ← نطاق ← عرض سعر (كله بإجراءات /api/simple القائمة).
  const TX = {
    busy: t("buyBusy"), login: t("buyLogin"), err: t("buyErr"), done: t("buyDone"), pricing: t("buyPricing"),
    title: t("reqTitle"), summary: t("reqSummary"), scope: t("scopeLine"), docs: tl("docs"),
  };
  const script = `<script>
(function(){
var TX=${JSON.stringify(TX)},LANG=${JSON.stringify(lang)},PORTAL=${JSON.stringify(u("/my"))},PAGE=${JSON.stringify(u("/business-development"))};
var $=function(id){return document.getElementById(id)};
var msg=$('bdMsg'),busy=false;
function say(m,err){if(!msg)return;msg.textContent=m;msg.className='sv1-bd-msg on'+(err?' err':'')}
function post(body){return fetch('/api/simple',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(function(r){return r.json().catch(function(){return{ok:false}})})}
function session(){return fetch('/api/otp',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:'{"action":"me"}'}).then(function(r){return r.json().catch(function(){return{}})}).then(function(o){return o&&o.session&&o.session.user?o.session.user:null}).catch(function(){return null})}
function create(code,name,type){
 // بند واحد هو كود الباقة: السعر يأتي من الكتالوج بالرمز لا من هذه الصفحة.
 var scope=[{code:code,title:name,why:TX.scope,qty:1}];
 return post({action:'request-create',type:type,source:'WEBSITE',lang:LANG,title:TX.title+' — '+name,summary:TX.summary,scope:scope,documents:TX.docs,conversation:[{role:'bp',content:TX.summary+' '+name+'.'}]}).then(function(o){return{o:o,scope:scope}});
}
function buy(code,name,btn){
 if(busy)return;busy=true;if(btn)btn.disabled=true;say(TX.busy,false);
 session().then(function(u){
  if(!u){
   try{sessionStorage.setItem('bd_pending',JSON.stringify({code:code,name:name}))}catch(e){}
   say(TX.login,false);
   setTimeout(function(){location.href=PORTAL+'?next='+encodeURIComponent(PAGE+'?resume='+encodeURIComponent(code)+'#packages')},900);
   return;
  }
  return create(code,name,'BUSINESS_DEVELOPMENT').then(function(r){
   // قيد النوع في قاعدة الإنتاج قد لا يقبل BUSINESS_DEVELOPMENT بعد: لا يضيع طلب عميل.
   if(!r.o||!r.o.ok)return create(code,name,'CONSULTATION');return r;
  }).then(function(r){
   if(!r.o||!r.o.ok||!r.o.ref)throw new Error('create');
   var ref=r.o.ref;
   return post({action:'scope-confirm',ref:ref,scope:r.scope}).then(function(c){
    if(!c||!c.ok)throw new Error('scope');
    say(c.stage==='QUOTE'?TX.done:TX.pricing,false);
    try{sessionStorage.removeItem('bd_pending')}catch(e){}
    setTimeout(function(){location.href=PORTAL+'?ref='+encodeURIComponent(ref)},c.stage==='QUOTE'?600:2400);
   });
  });
 }).catch(function(){say(TX.err,true)}).then(function(){busy=false;if(btn)btn.disabled=false});
}
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-bd-buy]');if(!b)return;e.preventDefault();buy(b.getAttribute('data-bd-buy'),b.getAttribute('data-name')||'',b)});
// العودة من تسجيل الدخول: نكمل الباقة التي اختارها العميل قبل أن يخرج.
(function(){var q=new URL(location.href).searchParams.get('resume');if(!q)return;var p=null;try{p=JSON.parse(sessionStorage.getItem('bd_pending')||'null')}catch(e){}
 var card=document.getElementById('pkg-'+q.toLowerCase());if(card)card.classList.add('pick');
 if(p&&p.code===q){var btn=card&&card.querySelector('[data-bd-buy]');buy(p.code,p.name,btn)}})();
})();
</script>`;

  return SV1.shell({
    title: `${t("title")} — Business Partner`,
    desc: t("desc"),
    path: "/business-development",
    body: CSS + body,
    script,
  });
}
