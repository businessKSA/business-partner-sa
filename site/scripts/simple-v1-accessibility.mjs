// Business Partner — Simple V1: بيان الإتاحة (/accessibility).
//
// صفحة قصيرة على SV1.shell() تقول بصدق: ما نوفّره لذوي الاحتياجات الخاصة، وما لم
// نُنجزه بعد، وكيف يبلّغ المستخدم عن عائق (الهاتف والبريد من site/data/site.json، لا
// رقم مكتوب هنا). قرار المالك 2026-10-16.
//
// ⚠️ لا تدّعِ هنا مطابقةً أو شهادةً لا نملكها. الصياغة «نسعى للالتزام بـWCAG 2.1 AA» —
// هدفٌ لا حكم. وإن أُجري تدقيقٌ خارجي لاحقاً فيُذكر تاريخه وجهته هنا، لا قبل ذلك.
//
// اللغات: العربية (RTL) والإنجليزية. الفرنسية والصينية تعرضان النص الإنجليزي داخل
// عنصرٍ بـlang="en" كما في بقية صفحات الموقع غير المترجمة.

const TX = {
  ar: {
    title: "بيان الإتاحة",
    desc: "ما نوفّره في Business Partner لذوي الاحتياجات الخاصة، وكيف تبلّغنا عن أي عائق في الموقع أو المستشار الذكي.",
    tag: "الإتاحة",
    lead: "نريد أن يستعمل كل شخصٍ الموقع والمستشار الذكي بنفسه، أياً كانت قدرته على الرؤية أو السمع أو الحركة أو القراءة. هذه الصفحة تقول بصراحة ما صار جاهزاً وما لم يكتمل بعد.",
    openBtn: "افتح قائمة الإتاحة",
    hStd: "معيارنا",
    pStd: "نسعى للالتزام بإرشادات إتاحة محتوى الويب WCAG 2.1 بالمستوى AA. هذا هدفٌ نعمل عليه وليس شهادة امتثال: لم يُجرِ جهةٌ خارجية تدقيقاً مستقلاً للموقع بعد.",
    hHave: "ما نوفّره الآن",
    have: [
      ["زرّ «إتاحة» ثابت في كل صفحة", "يفتح لوحةً تحفظ اختياراتك على جهازك وحده، ولا يُرسل منها شيء إلى أي خادم."],
      ["النص", "ثلاثة مستويات لحجم النص، وتباعدٌ أكبر بين الأسطر والكلمات، وخطٌّ سهل القراءة يساعد مع عسر القراءة."],
      ["الألوان", "تباينٌ عالٍ، ووضعٌ داكن، وتمييزٌ للروابط والحالات بالتسطير والحدود لا باللون وحده، ومؤشرٌ كبير، وإطارُ تركيزٍ واضح."],
      ["الحركة والصور", "إيقاف الحركة والتمرير السلس (ونحترم إعداد «تقليل الحركة» في جهازك تلقائياً)، وإخفاء الصور الزخرفية."],
      ["القراءة بصوتٍ عالٍ", "قراءة الصفحة كاملة أو النص الذي تحدّده، بالعربية والإنجليزية، مع إبراز الفقرة المقروءة وإيقافٍ مؤقت وتحكّم بالسرعة. تعمل بأصوات جهازك."],
      ["الصوت أولاً مع المستشار الذكي", "تتحدث إلى المستشار الذكي بالميكروفون فيُرسَل كلامك تلقائياً بعد تفريغه، ويقرأ لك ردّه بصوتٍ عالٍ."],
      ["التنقّل بالكيبورد", "رابط «تخطَّ إلى المحتوى» أول الصفحة، ومعالم صفحة واضحة (ترويسة وتنقّل ومحتوى وتذييل)، وترتيب Tab منطقي، ولا فخّ تركيز في النوافذ، ومفتاح Esc يغلق القوائم واللوحة."],
      ["لغتان بأصلهما", "العربية بواجهةٍ أصلية من اليمين إلى اليسار، والإنجليزية. وسائر اللغات تعرض النص الإنجليزي."],
    ],
    hKeys: "اختصارات الكيبورد",
    keys: [["Alt + Shift + A", "فتح قائمة الإتاحة أو إغلاقها"], ["Alt + Shift + R", "بدء قراءة الصفحة أو إيقافها"], ["Alt + Shift + V", "التحدث مع المستشار الذكي"], ["Esc", "إغلاق اللوحة أو إيقاف القراءة"]],
    hLimits: "ما لم يكتمل بعد",
    limits: [
      "بعض الصفحات الأقدم (مثل لوحة العميل القديمة ولوحات الإدارة) لم تنل بعد كل التحسينات، وتصلها الأدوات أعلاه لكن بنيتها أقل إتاحة.",
      "صفحات الدفع التي تستضيفها بوابات الدفع (مثل مُيسّر وتمارا) خارج سيطرتنا، ونتائج الإتاحة فيها عائدة لتلك الجهات.",
      "القراءة بصوتٍ عالٍ تعتمد على الأصوات المثبّتة في جهازك؛ إن لم يتوفّر صوتٌ عربي فثبّته من إعدادات النظام. والتحدث إلى المستشار يحتاج إذن الميكروفون واتصالاً بالإنترنت لتفريغ الصوت.",
      "اختبرنا بأدوات آلية وبالكيبورد، ولم نختبر الموقع بعد مع مستخدمين من ذوي الاحتياجات الخاصة ولا بقارئات الشاشة على أجهزة مختلفة. لذلك نرحّب بملاحظاتك.",
      "المستندات المرفقة (ملفات PDF والعقود) قد لا تكون كلها مهيّأة لقارئات الشاشة.",
    ],
    hReport: "أبلغنا عن عائق",
    pReport: "إن واجهتك مشكلة، أو أردت ميزةً تسهّل عليك الاستعمال، فراسلنا أو اتصل بنا. اذكر الصفحة، وما حدث، والجهاز والمتصفح أو الأداة المساعدة التي تستعملها. ونراجع كل بلاغ، وإن تعذّر عليك إتمام طلبك بالموقع فاتصل بنا ونساعدك على إتمامه بطريقة أخرى.",
    phone: "الهاتف",
    email: "البريد الإلكتروني",
    hours: "أوقات العمل",
    review: "آخر مراجعة لهذا البيان: ١٦ أكتوبر ٢٠٢٦.",
  },
  en: {
    title: "Accessibility statement",
    desc: "What Business Partner provides for people with disabilities, and how to tell us about a barrier on the site or in the smart advisor.",
    tag: "Accessibility",
    lead: "We want everyone to use the site and the smart advisor on their own, whatever their ability to see, hear, move or read. This page says plainly what is ready and what is not finished yet.",
    openBtn: "Open the accessibility menu",
    hStd: "Our standard",
    pStd: "We aim to follow the Web Content Accessibility Guidelines (WCAG) 2.1 at level AA. This is a goal we are working towards, not a certificate of compliance: no outside body has audited the site independently yet.",
    hHave: "What is available now",
    have: [
      ["A fixed “Accessibility” button on every page", "It opens a panel whose choices are saved on your device only; nothing from it is sent to any server."],
      ["Text", "Three text sizes, more space between lines and words, and an easy-to-read font that helps with dyslexia."],
      ["Colour", "High contrast, a dark mode, links and states marked by underlines and borders rather than colour alone, a large cursor, and a clear focus outline."],
      ["Motion and images", "Stop animations and smooth scrolling (we also respect your device's “reduce motion” setting automatically), and hide decorative images."],
      ["Read aloud", "Read the whole page or the text you select, in Arabic and English, with the current paragraph highlighted, pause, and speed control. It uses the voices on your device."],
      ["Voice first with the smart advisor", "Speak to the smart advisor with the microphone; what you say is sent automatically once transcribed, and the reply is read aloud to you."],
      ["Keyboard navigation", "A “Skip to content” link first on the page, clear page landmarks (header, navigation, main content, footer), a logical Tab order, no focus traps in dialogs, and Esc closes menus and the panel."],
      ["Two native languages", "Arabic with a true right-to-left interface, and English. Other languages show the English text."],
    ],
    hKeys: "Keyboard shortcuts",
    keys: [["Alt + Shift + A", "Open or close the accessibility menu"], ["Alt + Shift + R", "Start or stop reading the page"], ["Alt + Shift + V", "Talk to the smart advisor"], ["Esc", "Close the panel or stop reading"]],
    hLimits: "What is not finished yet",
    limits: [
      "Some older pages (such as the old client account and the admin dashboards) have not received every improvement yet; the tools above reach them, but their structure is less accessible.",
      "Payment pages hosted by the payment gateways (such as Moyasar and Tamara) are outside our control, and their accessibility rests with those providers.",
      "Reading aloud depends on the voices installed on your device; if no Arabic voice is available, install one in your system settings. Talking to the advisor needs microphone permission and an internet connection to transcribe your speech.",
      "We have tested with automated tools and the keyboard. We have not yet tested with users who have disabilities, nor with screen readers across devices, so your feedback is welcome.",
      "Attached documents (PDFs and contracts) may not all be prepared for screen readers.",
    ],
    hReport: "Report a barrier",
    pReport: "If you hit a problem, or want a feature that would make the site easier for you, write to us or call. Tell us the page, what happened, and the device, browser or assistive tool you use. We review every report, and if you cannot complete a request on the site, call us and we will help you complete it another way.",
    phone: "Phone",
    email: "Email",
    hours: "Working hours",
    review: "This statement was last reviewed on 16 October 2026.",
  },
};

export function buildSimpleAccessibility(sv1, ctx) {
  const { lang, esc, site } = ctx;
  const l = lang();
  const ar = l === "ar";
  const x = TX[ar ? "ar" : "en"];
  const contact = (site && site.contact) || {};
  const hours = ar ? contact.hours : contact.hoursEn || contact.hours;
  // fr/zh: النص إنجليزي، فيُعلَّم ليقرأه قارئ الشاشة بنطقٍ صحيح (WCAG 3.1.2).
  const langAttr = !ar && l !== "en" ? ' lang="en" dir="ltr"' : "";

  const CSS = `<style id="sv1-a11y-css">
.sv1-ax-hero{padding:48px 0 18px;text-align:center}
.sv1-ax-hero h1{font-size:clamp(28px,4.4vw,44px);margin:14px 0 10px}
.sv1-ax-hero p{max-width:680px;margin:0 auto;color:var(--mut);line-height:1.95}
.sv1-ax-hero .sv1-btn{margin-top:18px}
.sv1-ax{max-width:820px;margin:0 auto;padding:8px 0 56px}
.sv1-ax h2{font-size:clamp(20px,2.6vw,26px);margin:34px 0 10px}
.sv1-ax p,.sv1-ax li{line-height:1.95;color:var(--t)}
.sv1-ax dl{margin:0;display:grid;gap:10px}
.sv1-ax dl>div{background:var(--soft);border:1px solid var(--line2);border-radius:11px;padding:12px 16px}
.sv1-ax dt{font-weight:600;color:var(--ink);margin-bottom:2px}
.sv1-ax dd{margin:0;color:var(--t)}
.sv1-ax ul{padding-inline-start:22px;margin:0}
.sv1-ax li{margin-bottom:6px}
.sv1-ax table{border-collapse:collapse;width:100%;font-size:14px}
.sv1-ax th,.sv1-ax td{border:1px solid var(--line);padding:9px 12px;text-align:start}
.sv1-ax th{background:var(--soft);color:var(--ink);font-weight:600}
.sv1-ax kbd{font-family:var(--fm);font-size:12.5px;direction:ltr;unicode-bidi:isolate;display:inline-block;padding:2px 7px;border:1px solid var(--line);border-radius:6px;background:#fff}
.sv1-ax .ct{display:grid;gap:8px;margin-top:12px}
.sv1-ax .ct div{display:flex;gap:10px;flex-wrap:wrap;align-items:baseline;border:1px solid var(--line);border-radius:11px;padding:10px 14px}
.sv1-ax .ct span:first-child{color:var(--mut);min-width:110px;font-size:13px}
.sv1-ax .rv{margin-top:28px;font-size:13px;color:var(--mut)}
</style>`;

  const have = x.have.map(([h, p]) => `<div><dt>${esc(h)}</dt><dd>${esc(p)}</dd></div>`).join("");
  const keys = x.keys.map(([k, d]) => `<tr><th scope="row"><kbd>${esc(k)}</kbd></th><td>${esc(d)}</td></tr>`).join("");
  const limits = x.limits.map((s) => `<li>${esc(s)}</li>`).join("");
  const num = (v) => `<bdi dir="ltr">${esc(v)}</bdi>`;

  const body = `${sv1.header("/accessibility", { cta: false })}
<main>
  <section class="sv1-ax-hero"><div class="wrap"${langAttr}>
    <span class="sv1-tag">${esc(x.tag)}</span>
    <h1>${esc(x.title)}</h1>
    <p>${esc(x.lead)}</p>
    <button type="button" class="sv1-btn primary" id="axOpen" aria-haspopup="dialog">${esc(x.openBtn)}</button>
  </div></section>
  <div class="wrap"><div class="sv1-ax"${langAttr}>
    <h2>${esc(x.hStd)}</h2>
    <p>${esc(x.pStd)}</p>
    <h2>${esc(x.hHave)}</h2>
    <dl>${have}</dl>
    <h2>${esc(x.hKeys)}</h2>
    <table><tbody>${keys}</tbody></table>
    <h2>${esc(x.hLimits)}</h2>
    <ul>${limits}</ul>
    <h2>${esc(x.hReport)}</h2>
    <p>${esc(x.pReport)}</p>
    <div class="ct">
      ${contact.phone ? `<div><span>${esc(x.phone)}</span><a href="tel:${esc(contact.phoneIntl || contact.phone)}">${num(contact.phone)}</a></div>` : ""}
      ${contact.email ? `<div><span>${esc(x.email)}</span><a href="mailto:${esc(contact.email)}">${num(contact.email)}</a></div>` : ""}
      ${hours ? `<div><span>${esc(x.hours)}</span><span>${esc(hours)}</span></div>` : ""}
    </div>
    <p class="rv">${esc(x.review)}</p>
  </div></div>
</main>
${sv1.footer()}`;

  // الزرّ يفتح لوحة الإتاحة نفسها (bp-a11y.js)؛ إن لم تُحمَّل بعد ينتظر لحظة.
  const script = `<script>(function(){var b=document.getElementById('axOpen');if(!b)return;b.addEventListener('click',function(){var f=document.getElementById('bpaFab');if(f&&f.getAttribute('aria-expanded')!=='true')f.click();else if(f)f.focus()})})();</script>`;

  return sv1.shell({ title: `${x.title} — Business Partner`, desc: x.desc, path: "/accessibility", body: CSS + body, script });
}
