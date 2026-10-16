// طبقة الإتاحة (Accessibility) — تُحقن في كل صفحة عامة من `write()` في generate.mjs.
//
// قرار المالك 2026-10-16: «ونضيف لذوي الاحتياجات الخاصة ميزة يستعملون فيها الموقع
// والمساعد الذكي». ما يُحقن، وفي موضع واحد لا في موضعين (§2.6): كل الصفحات تمرّ على
// `write()`، فيحصل عليها الموقع الجديد (`SV1.shell()`) والقديم (`main.js`) بسطرٍ واحد
// هنا بدل نسخةٍ في كلٍّ منهما تفترق عن الأخرى.
//
//   • في <head>: سكربتٌ صغير يضبط سمات data-bpa-* من localStorage قبل أول رسم (فلا
//     ومضة بين الصفحة الافتراضية وصفحة المستخدم)، ثم bp-a11y.css، ثم bp-a11y.js (defer).
//   • بعد <body>: رابط «تخطَّ إلى المحتوى» أول عنصرٍ في الصفحة، وهدفه #bp-main.
//   • الهدف #bp-main: مرساة فارغة أول ابنٍ لأول <main> العاري (يبقى <main> حرفياً)، أو id على <main> ذي السمات.
//
// بلا أي إعداد مفعَّل لا يتغيّر مظهر أي صفحة (انظر ترويسة bp-a11y.css). لوحات المالك
// الداخلية (admin / monitor / *-admin) مستثناة: ليست للزوّار، ولوحاتها كثيفة.
//
// نص رابط التخطّي بالعربية للصفحات العربية وبالإنجليزية لغيرها (fr/zh إنجليزي كالمعتاد).

const SKIP_TEXT = { ar: "تخطَّ إلى المحتوى", en: "Skip to content" };

// صفحات لا يُحقن فيها: لوحات داخلية للمالك والفريق، وملفات ليست صفحات.
const EXCLUDE = /(^|\/)(admin|monitor|doc-agent-admin|[a-z-]+-admin)\.html$/;

// يُضبط قبل الرسم. أي قيمة غير مفهومة تُتجاهل؛ لا شيء يُنفَّذ من التخزين.
const EARLY = `<script>(function(){try{var s=JSON.parse(localStorage.getItem('bp_a11y')||'null');if(!s||typeof s!=='object')return;var e=document.documentElement,k=['zoom','spacing','font','contrast','theme','links','cursor','focus','motion','imgs','voice'];for(var i=0;i<k.length;i++){var v=s[k[i]];if(v&&(typeof v==='number'||v==='dark'))e.setAttribute('data-bpa-'+k[i],String(v))}}catch(x){}})();</script>`;

export function a11yTags({ cssV, jsV }) {
  return `${EARLY}<link rel="stylesheet" href="/assets/css/bp-a11y.css?v=${cssV}"><script defer src="/assets/js/bp-a11y.js?v=${jsV}"></script>`;
}

// html: صفحة كاملة. rel: مسارها تحت site/ (للاستثناء). v: { cssV, jsV } بصمات الملفين.
export function injectA11y(html, rel, v) {
  if (!rel.endsWith(".html") || EXCLUDE.test(rel)) return html;
  if (html.includes("bp-a11y.css") || !/<\/head>/i.test(html) || !/<body[^>]*>/i.test(html)) return html;

  const langM = /<html[^>]*\blang="([a-z]{2})/i.exec(html);
  const skipText = SKIP_TEXT[langM && langM[1].toLowerCase() === "ar" ? "ar" : "en"];

  // كل ما بعد </head> هو الجسم؛ نعمل عليه وحده حتى لا يلتقط النمطُ نصّاً داخل سكربت الرأس.
  const cut = html.search(/<\/head>/i);
  let head = html.slice(0, cut), rest = html.slice(cut);

  // أول <main>: يحمل المعرّف الذي يشير إليه رابط التخطّي (إن كان له معرّف نستعمله).
  let target = "";
  rest = rest.replace(/<main\b([^>]*)>/i, (m, attrs) => {
    // <main> العاري يبقى حرفياً كما هو (اختباراتٌ وسكربتاتٌ أخرى تبحث عنه بنصّه)؛ والهدف عندها
    // مرساةٌ فارغة قابلة للتركيز أول ابنٍ له. من له سمات يحملها هو.
    if (!attrs.trim()) { target = "bp-main"; return '<main><span id="bp-main" tabindex="-1"></span>'; }
    const id = /\bid=["']([^"']+)["']/.exec(attrs);
    target = id ? id[1] : "bp-main";
    let a = attrs;
    if (!id) a += ' id="bp-main"';
    if (!/\btabindex=/.test(a)) a += ' tabindex="-1"';
    return `<main${a}>`;
  });
  // صفحة بلا <main> (نحو عشر صفحات قديمة): لا رابط تخطٍّ ميّت يشير إلى لا شيء.
  if (target) rest = rest.replace(/<body([^>]*)>/i, (m) => `${m}<a class="bpa-skip" href="#${target}">${skipText}</a>`);

  return head + a11yTags(v) + rest;
}
