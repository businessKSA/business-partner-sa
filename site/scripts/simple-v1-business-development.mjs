// Business Partner — Simple V1: «تطوير الأعمال كخدمة» (/business-development).
//
// عمود من الأعمدة الخمسة التي يخاطب بها البريد السنوي الشركات السعودية القائمة
// (الخدمات الحكومية · التحوّل الرقمي بالذكاء الاصطناعي · EOR · Business Partner AI ·
// تطوير الأعمال). كان العمود الوحيد بلا صفحة تعمل: المسار يصل /catalog.
//
// بُنيت على SV1.shell() تطبيقاً لـCLAUDE.md §2.6 — الصفحة القديمة كانت تُولَّد من
// buildBdaas() في generate.mjs على الطبقة القديمة، وفيها ما لم يعد سياسة:
// «ابدأ 30 يوماً مجاناً»، وأرقام العمولة والرسوم الشهرية ظاهرة للزائر، واسم
// العلامة «بيزنس بارتنر» في عنوان الصفحة. هذه الصفحة بلا شيء من ذلك.
//
// السياسات المطبّقة هنا:
//   • SHOW_PRICES=false — لا رقم سعر ولا نسبة عمولة في الصفحة. الباقة تعرض
//     اسمها من الكتالوج (service-i18n.json بالعربية، services.json بالإنجليزية)
//     ونموذج تسعيرها فقط («اشتراك شهري» أو «سعر حسب حالتك»)، والرقم يأتي في عرض
//     السعر أو داخل حساب العميل. أوصاف services.json للباقات REV-* تذكر الأرقام
//     نصّاً، فلا تُطبع هنا بحال.
//   • الأسماء والأكواد من الكتالوج بالـSKU وحده — لا باقة مكتوبة يدوياً.
//   • لا زرّ واتساب داخل المحتوى (الزرّ العائم في القشرة وحده).
//   • «المستشار الذكي» لا «الوكيل»، و«Business Partner» في كل اللغات.
//   • لا دالة api/ جديدة: طلب عرض السعر يمرّ بـ/consultation?about=… وبطاقة كل
//     باقة تذهب إلى صفحة الـSKU التي فيها «أضف إلى السلة» أصلاً.
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
  ctaQuote: { ar: "اطلب عرض سعر", en: "Request a quote" },
  ctaAdvisor: { ar: "اسأل المستشار الذكي", en: "Ask the intelligent advisor" },
  tr1: { ar: "مسار مبيعات موثّق لا مجهود متفرّق", en: "A documented pipeline, not scattered effort" },
  tr2: { ar: "فريق سعودي يعرف السوق وقنواته", en: "A Saudi team that knows the market and its channels" },
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

  howH: { ar: "كيف تعمل الخدمة", en: "How the service works" },
  s1: { ar: "جلسة تعريف: منتجك وعميلك وأسعارك وقدرتك على التنفيذ.", en: "A discovery session: your offer, your customer, your pricing and your delivery capacity." },
  s2: { ar: "نطاق عمل وعرض سعر مكتوبان: ما نفعله شهرياً وما نسلّمه وما نقيسه.", en: "A written scope of work and quote: what we do monthly, what we hand over and what we measure." },
  s3: { ar: "بناء الأساس: العميل المثالي، قائمة الحسابات، الرسائل، أدوات المتابعة.", en: "Building the base: ideal customer, account list, messaging, follow-up tooling." },
  s4: { ar: "التشغيل: تواصل واجتماعات وعروض أسبوعياً، بتقرير دوري.", en: "Operating: weekly outreach, meetings and proposals, with periodic reporting." },
  s5: { ar: "المراجعة الربعية: ما نجح يُوسَّع، وما لم ينجح يُغيَّر أو يُوقف.", en: "A quarterly review: what worked is scaled, what did not is changed or stopped." },

  pkH: { ar: "الباقات", en: "Packages" },
  pkP: {
    ar: "ستّ باقات معتمدة في الكتالوج تختلف في حجم الفريق المخصّص وعدد الحسابات والاجتماعات المستهدفة شهرياً. السعر يظهر في عرض السعر وداخل حساب العميل، لا على الصفحة العامة.",
    en: "Six approved catalogue packages, differing in dedicated-team size and in the monthly target for accounts and meetings. Pricing appears in the quote and inside the client account, not on the public page.",
  },
  pkMonthly: { ar: "اشتراك شهري", en: "Monthly subscription" },
  pkOnCase: { ar: "سعر حسب حالتك", en: "Priced to your case" },
  pkDetails: { ar: "تفاصيل الباقة", en: "Package details" },
  pkNote: {
    ar: "لم تعرف الباقة المناسبة؟ اطلب عرض سعر واشرح حالتك، ونقترح عليك باقةً واحدة بسببها.",
    en: "Not sure which package fits? Request a quote, describe your case, and we will recommend one package and say why.",
  },

  adH: { ar: "مستشار تطوير الأعمال الذكي", en: "The intelligent business-development advisor" },
  adP: {
    ar: "قبل أن تشترك، اسأل. المستشار الذكي في Business Partner يقرأ وصف منشأتك ومنتجك ويقترح العميل المثالي والقنوات وشكل المسار المناسب، ويجهّز طلبك لفريق تطوير الأعمال. متاح من الصفحة الرئيسية بلا تسجيل.",
    en: "Before you subscribe, ask. The intelligent advisor at Business Partner reads your business and offer, suggests the ideal customer, the channels and the pipeline shape that fit, and prepares your request for the business-development team. Available from the homepage without signing in.",
  },
  adCta: { ar: "ابدأ المحادثة", en: "Start the conversation" },

  faqH: { ar: "أسئلة شائعة", en: "Frequently asked questions" },
  q1: { ar: "هل تضمنون عدداً من الصفقات؟", en: "Do you guarantee a number of deals?" },
  a1: {
    ar: "لا. نلتزم بما نسيطر عليه: عدد الحسابات المستهدفة والتواصل والاجتماعات المؤكّدة والعروض المجهّزة، وكلها مكتوبة في نطاق العمل. الإغلاق يعتمد على منتجك وسعرك وقدرتك على التنفيذ، ولا يصحّ أن يوعد به أحد.",
    en: "No. We commit to what we control: target accounts, outreach, confirmed meetings and prepared proposals, all written into the scope of work. Closing depends on your offer, your price and your delivery capacity, and nobody can honestly promise it.",
  },
  q2: { ar: "كم السعر؟", en: "What does it cost?" },
  a2: {
    ar: "يختلف بالباقة وبحجم الفريق المخصّص لك. الأسعار تظهر للمسجّلين وفي عرض السعر بعد مراجعة حالتك؛ بعض الباقات اشتراك شهري ثابت، وبعضها يُسعَّر حسب حالتك.",
    en: "It depends on the package and the size of the team dedicated to you. Prices are shown to signed-in clients and in the quote after we review your case; some packages are a fixed monthly subscription, others are priced to your case.",
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

  endH: { ar: "ابدأ بعرض سعر", en: "Start with a quote" },
  endP: {
    ar: "اشرح منشأتك وما تبيعه ومن تريد الوصول إليه، ويعود إليك فريق تطوير الأعمال بنطاق عمل وباقة مقترحة. الطلب لا يُلزمك بشيء.",
    en: "Describe your business, what you sell and who you want to reach; the business-development team comes back with a scope of work and a suggested package. The request commits you to nothing.",
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
  const pre = lang === "en" ? "" : "/" + lang;
  const u = (p) => pre + p;
  const arrow = ar ? "←" : "→";
  const about = t("tag");
  const quoteHref = u("/consultation") + "?about=" + encodeURIComponent(about);

  // الباقات من الكتالوج وحده: الكود والاسم ونموذج التسعير. لا رقم ولا وصف من
  // services.json (أوصاف REV-* تذكر الرسوم والعمولة نصّاً، والأسعار مخفيّة).
  const byCode = new Map(services.map((s) => [String(s.code || "").toUpperCase(), s]));
  const packs = ORDER.map((code) => byCode.get(code)).filter(Boolean).map((s) => {
    const i18n = svcI18n[String(s.code).toUpperCase()] || {};
    const name = (ar && i18n.ar) || i18n[lang] || s.name || "";
    const onCase = !s.price || s.price.amount == null;
    return `<a class="sv1-bd-pack" href="${esc(u("/services/" + s.slug))}" data-track="${esc("باقة تطوير الأعمال: " + s.code)}">
      <span class="sv1-bd-code sv1-mono en">${esc(s.code)}</span>
      <strong>${esc(name)}</strong>
      <em>${esc(onCase ? t("pkOnCase") : t("pkMonthly"))}</em>
      <span class="sv1-bd-more">${esc(t("pkDetails"))} ${arrow}</span>
    </a>`;
  }).join("");

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
.sv1-bd-steps{counter-reset:bd;display:grid;gap:10px;max-width:880px}
.sv1-bd-steps li{counter-increment:bd;list-style:none;display:flex;gap:14px;align-items:flex-start;background:#fff;border:1px solid var(--l);border-radius:13px;padding:14px 16px;font-size:14px;color:var(--t);line-height:1.8}
.sv1-bd-steps li::before{content:counter(bd);flex:0 0 28px;height:28px;border-radius:9px;background:var(--acSoft);color:var(--ac);border:1px solid var(--acLine);display:flex;align-items:center;justify-content:center;font-size:12.5px;font-family:var(--fm)}
.sv1-bd-packs{display:grid;gap:12px;grid-template-columns:repeat(3,minmax(0,1fr))}
.sv1-bd-pack{display:flex;flex-direction:column;gap:7px;background:#fff;border:1px solid var(--l);border-radius:14px;padding:17px 18px;box-shadow:var(--sh);transition:transform .14s ease,border-color .2s ease,box-shadow .2s ease}
.sv1-bd-pack:hover{transform:translateY(-2px);border-color:var(--acLine);box-shadow:var(--sh2)}
.sv1-bd-code{font-size:10.5px;letter-spacing:.08em;color:var(--faint)}
.sv1-bd-pack strong{font-size:14.5px;font-weight:500;color:var(--ink);line-height:1.6}
.sv1-bd-pack em{font-style:normal;font-size:12px;color:var(--ac);background:var(--acSoft);border:1px solid var(--acLine);border-radius:999px;padding:3px 10px;align-self:flex-start}
.sv1-bd-more{font-size:12.5px;color:var(--mut);margin-top:auto;padding-top:6px}
.sv1-bd-note{font-size:13px;color:var(--mut);margin:16px 0 0;max-width:46em}
.sv1-bd-ad{background:linear-gradient(180deg,#fff,var(--soft));border:1px solid var(--acLine);border-radius:16px;padding:24px;box-shadow:var(--sh2);max-width:900px}
.sv1-bd-ad h2{margin-top:10px}
.sv1-bd-ad p{font-size:14px;color:var(--s);max-width:48em}
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
  .sv1-bd-ad,.sv1-bd-end{padding:18px}
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
      <a class="sv1-btn primary" href="${esc(quoteHref)}" data-track="تطوير الأعمال: اطلب عرض سعر">${esc(t("ctaQuote"))}</a>
      <a class="sv1-btn" href="${esc(u("/") === "/" ? "/#advisor" : u("/") + "#advisor")}" data-track="تطوير الأعمال: المستشار الذكي">${esc(t("ctaAdvisor"))}</a>
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
    <div class="sv1-bd-packs">${packs}</div>
    <p class="sv1-bd-note">${esc(t("pkNote"))}</p>
  </div></section>` : ""}

  <section class="sv1-sec"><div class="wrap">
    <div class="sv1-bd-ad">
      <span class="sv1-tag">AI</span>
      <h2>${esc(t("adH"))}</h2>
      <p>${esc(t("adP"))}</p>
      <div class="sv1-bd-acts">
        <a class="sv1-btn primary" href="${esc(u("/") === "/" ? "/#advisor" : u("/") + "#advisor")}" data-track="تطوير الأعمال: ابدأ المحادثة">${esc(t("adCta"))}</a>
      </div>
    </div>
  </div></section>

  <section class="sv1-sec sv1-gray"><div class="wrap">
    <div class="sv1-title"><h2>${esc(t("faqH"))}</h2></div>
    <div class="sv1-bd-faq">
      ${[["q1", "a1"], ["q2", "a2"], ["q3", "a3"], ["q4", "a4"], ["q5", "a5"], ["q6", "a6"]]
        .map(([q, a]) => `<details><summary>${esc(t(q))}</summary><p>${esc(t(a))}</p></details>`).join("")}
    </div>
  </div></section>

  <section class="sv1-sec"><div class="wrap">
    <div class="sv1-bd-end">
      <h2>${esc(t("endH"))}</h2>
      <p>${esc(t("endP"))}</p>
      <div class="sv1-bd-acts">
        <a class="sv1-btn primary" href="${esc(quoteHref)}" data-track="تطوير الأعمال: اطلب عرض سعر (الأسفل)">${esc(t("ctaQuote"))}</a>
        <a class="sv1-btn" href="${esc(u("/catalog"))}">${esc(t("endCat"))}</a>
      </div>
    </div>
  </div></section>
  </main>
${SV1.footer()}`;

  return SV1.shell({
    title: `${t("title")} — Business Partner`,
    desc: t("desc"),
    path: "/business-development",
    body: CSS + body,
  });
}
