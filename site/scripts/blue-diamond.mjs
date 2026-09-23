// مولّد موقع العميل: شركة الألماس الأزرق العقارية — بندر الأحمد.
//
// لماذا مولّد ولا ملفات HTML مكتوبة باليد: `site/` ناتج بناء لا مصدر.
// أول خطوة في site/scripts/generate.mjs تمسح كل ملف .html تحت site/
// (cleanHtml) ثم تعيد توليد ما تعرفه — فأي صفحة تُكتب باليد هناك تختفي مع
// أول `npm run build`. جُرّب ذلك: اختفت.
//
// ولماذا آخر خطوة في السلسلة: الخطوات بين generate.mjs ونهاية البناء تحقن
// هوية Business Partner في كل صفحة تمرّ عليها — ترويسة، ثيم، مستشار الخدمات.
// موقع عميلٍ آخر بعلامته الخاصة يجب ألا يحمل شيئاً من ذلك، وأضمن طريقة
// ليست شرطاً في كل واحدة من تلك الخطوات: أن تُولَّد الصفحات بعد أن تكون
// كلها قد انتهت. لا يوجد ملف ليُحقن فيه شيء وقت مرورها.
//
// المحتوى من الملف التعريفي الذي سلّمه العميل (١٦ صفحة): من نحن، الرؤية،
// الرسالة، لماذا نحن، القيم الخمس، الخدمات الخمس، محاور الاستشارات
// الثلاثة، رسالة الرئيس التنفيذي، فريق العمل، المنهجية، وبيانات التواصل.
// لا يُضاف إلى تلك النصوص ادعاء لم يرد فيها — ولا رقم ولا ترخيص ولا عميل.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("site");
const OUT = path.join(ROOT, "bluediamond");

// بيانات المكتب — نسخة واحدة تُستعمل في كل الصفحات. أي تغيير (رقم، بريد،
// سجل) يجري هنا مرة واحدة، لا في أربع صفحات.
const OFFICE = {
  nameAr: "شركة الألماس الأزرق العقارية",
  shortAr: "الألماس الأزرق",
  nameEn: "Blue Diamond Real Estate",
  cr: "1009029650",
  phone: "+966505556150",
  waPhone: "966505556150",
  email: "info@bluediamond.sa",
  site: "www.bluediamond.sa",
  city: "المملكة العربية السعودية — الرياض",
  ceo: "بندر الأحمد",
  ceoTitle: "مستشار ومحلل عقاري مُرخّص من الهيئة العامة للعقار",
  tagline: "قيمةٌ تُبنى، ومستقبلٌ يُصاغ",
  taglineEn: "Value Built, Future Shaped",
};

const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ------------------------------------------------------------------ الثيم --
// الأزرق العميق والألماسي. لا علاقة له بثيم Business Partner: علامة أخرى،
// وعميلٌ يعرض الموقع لعملائه هو لا لعملاء المنصّة.
const CSS = `
/* الألوان مسحوبة من الملف التعريفي للعميل نفسه لا مخترعة: النيلي
   #252159 هو لون صفحاته الداكنة، والكريمي #EEECDE خلفيته الفاتحة (أكثر
   لونين تكراراً في الوثيقة كلها)، والأزرق الملكي #3567C8 لون عناوينه.
   الأول كان أزرق بارداً على أبيض بلمسة ذهبية — لا أصل له في هويته. */
:root{
  --bd-indigo:#252159; --bd-indigo-2:#2F2A6B; --bd-blue:#3567C8; --bd-ice:#8FB0EE;
  --bd-cream:#EEECDE; --bd-cream-2:#F5F4EC;
  --bd-ink:#231F20; --bd-mute:#5E5C80; --bd-line:#DCD9C8;
  --bd-bg:#EEECDE; --bd-soft:#F5F4EC; --bd-card:#FFFDF6;
  --bd-mark:#252159;
  --bd-shadow:0 18px 50px rgba(37,33,89,.10);
  --bd-radius:16px;
}
@media (prefers-color-scheme:dark){
  /* الوضع الداكن ليس اختراعاً أيضاً: صفحات البروفايل الداكنة نيليّة
     #252159 بنصٍّ كريمي — فهو وضعه الداكن هو. */
  :root:not([data-theme="light"]){
    --bd-ink:#EEECDE; --bd-mute:#A9A6C6; --bd-line:#3A3570;
    --bd-bg:#252159; --bd-soft:#2B2765; --bd-card:#2F2A6B;
    --bd-mark:#EEECDE;
    --bd-shadow:0 18px 50px rgba(0,0,0,.40);
  }
}
:root[data-theme="dark"]{
  --bd-ink:#EEECDE; --bd-mute:#A9A6C6; --bd-line:#3A3570;
  --bd-bg:#252159; --bd-soft:#2B2765; --bd-card:#2F2A6B;
  --bd-mark:#EEECDE;
  --bd-shadow:0 18px 50px rgba(0,0,0,.40);
}
*{box-sizing:border-box}
/* [hidden] سمةٌ في HTML لكن display المعلن في قاعدة صنف يغلبها: بوابة
   المفتاح تحمل .form{display:grid} فبقيت ظاهرةً بعد الدخول. !important هنا
   في محلّه — «مخفي» ليست تنسيقاً يُناقش. */
[hidden]{display:none!important}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bd-bg);color:var(--bd-ink);
  font-family:"IBM Plex Sans Arabic","Segoe UI",Tahoma,system-ui,sans-serif;
  line-height:1.9;-webkit-font-smoothing:antialiased}
/* الخطّان من الملف التعريفي نفسه: Markazi Text للعناوين (وهو أكثر خطوطه
   استعمالاً) وIBM Plex Arabic للمتن والأرقام. */
h1,h2,h3,.brand span,.stat b{font-family:"Markazi Text","IBM Plex Sans Arabic",serif}
h1,h2{letter-spacing:0}
.wrap{width:min(1160px,100% - 32px);margin-inline:auto}
a{color:var(--bd-blue);text-decoration:none}
h1,h2,h3{line-height:1.35;margin:0 0 14px;font-weight:800;letter-spacing:-.01em}
h1{font-size:clamp(34px,5.6vw,58px);font-weight:700}
h2{font-size:clamp(27px,3.8vw,40px);font-weight:700}
h3{font-size:clamp(17px,2.2vw,21px)}
p{margin:0 0 14px;color:var(--bd-mute)}
section{padding:68px 0;border-top:1px solid var(--bd-line)}
section:first-of-type{border-top:0}
.eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:800;
  letter-spacing:.08em;color:var(--bd-blue);margin-bottom:10px;text-transform:uppercase}
.eyebrow::before{content:"";width:9px;height:9px;transform:rotate(45deg);
  background:linear-gradient(135deg,var(--bd-ice),var(--bd-blue))}
.en{font-size:13px;color:var(--bd-mute);opacity:.85;direction:ltr;text-align:left;
  border-top:1px dashed var(--bd-line);margin-top:14px;padding-top:12px}

/* الترويسة */
header.bd{position:sticky;top:0;z-index:40;background:color-mix(in srgb,var(--bd-bg) 88%,transparent);
  backdrop-filter:blur(12px);border-bottom:1px solid var(--bd-line)}
header.bd .bar{display:flex;align-items:center;gap:18px;min-height:70px}
.brand{display:flex;align-items:center;gap:11px;font-weight:900;color:var(--bd-ink);font-size:17px}
.brand .gem{width:30px;height:30px;flex:none;color:var(--bd-mark)}
nav.bd{display:flex;gap:20px;margin-inline-start:auto;flex-wrap:wrap}
nav.bd a{color:var(--bd-ink);font-size:14px;font-weight:700;opacity:.82}
nav.bd a:hover{opacity:1;color:var(--bd-blue)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;
  padding:13px 24px;border-radius:12px;font-weight:800;font-size:14px;border:1px solid transparent;cursor:pointer}
.btn-primary{background:linear-gradient(135deg,var(--bd-indigo),var(--bd-blue));color:#fff;
  box-shadow:0 10px 26px rgba(37,33,89,.26)}
.btn-ghost{border-color:var(--bd-line);color:var(--bd-ink);background:var(--bd-card)}

/* البطل */
.hero{position:relative;overflow:hidden;padding:88px 0 76px;
  background:radial-gradient(1100px 420px at 78% -10%,rgba(53,103,200,.16),transparent 60%),
             linear-gradient(180deg,var(--bd-soft),var(--bd-bg))}
.hero h1 span{background:linear-gradient(120deg,var(--bd-blue),var(--bd-indigo-2));
  -webkit-background-clip:text;background-clip:text;color:transparent}
.hero .lead{font-size:clamp(15px,2vw,19px);max-width:58ch}
.hero-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:26px}
.hero-grid{display:grid;grid-template-columns:1.25fr .75fr;gap:44px;align-items:center}
.gem-art{width:100%;max-width:290px;margin-inline:auto;color:var(--bd-mark);
  filter:drop-shadow(0 18px 36px rgba(37,33,89,.22))}

/* البطاقات */
.grid{display:grid;gap:18px}
.g2{grid-template-columns:repeat(2,1fr)}
.g3{grid-template-columns:repeat(3,1fr)}
.card{background:var(--bd-card);border:1px solid var(--bd-line);border-radius:var(--bd-radius);
  padding:24px;box-shadow:var(--bd-shadow)}
.card h3{margin-bottom:8px}
.card .n{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;
  border-radius:10px;background:linear-gradient(135deg,var(--bd-indigo),var(--bd-blue));
  color:#fff;font-weight:900;font-size:14px;margin-bottom:12px}
.stat{text-align:center}
.stat b{display:block;font-size:30px;color:var(--bd-blue)}
.stat span{font-size:13px;color:var(--bd-mute)}

/* النماذج */
.form{display:grid;gap:16px;background:var(--bd-card);border:1px solid var(--bd-line);
  border-radius:var(--bd-radius);padding:26px;box-shadow:var(--bd-shadow)}
.row{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
label{display:block;font-size:13px;font-weight:800;margin-bottom:7px}
input,select,textarea{width:100%;padding:12px 14px;border:1px solid var(--bd-line);border-radius:11px;
  background:var(--bd-bg);color:var(--bd-ink);font:inherit;font-size:14px}
input:focus,select:focus,textarea:focus{outline:2px solid var(--bd-blue);outline-offset:1px;border-color:transparent}
textarea{min-height:110px;resize:vertical}
.hint{font-size:12px;color:var(--bd-mute);margin-top:6px}
.note{background:var(--bd-soft);border-inline-start:3px solid var(--bd-blue);
  border-radius:10px;padding:12px 15px;font-size:13px;color:var(--bd-mute)}
.ok{background:#E9F8EF;border-inline-start-color:#16A34A;color:#14532D}
.err{background:#FEF0F0;border-inline-start-color:#DC2626;color:#7F1D1D}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .ok{background:#0C2C1A;color:#BBF7D0}
  :root:not([data-theme="light"]) .err{background:#331316;color:#FECACA}}

/* النقش النجدي من البروفايل — شريط مثلّثات في زاوية القسم الداكن.
   مرسومٌ بـCSS لا صورة: يتلوّن مع السياق ولا يُحمّل ملفاً. */
.lattice{position:absolute;inset-block:0;inset-inline-end:0;width:min(180px,26vw);opacity:.13;
  pointer-events:none;
  background-image:
    linear-gradient(45deg,currentColor 25%,transparent 25%,transparent 75%,currentColor 75%),
    linear-gradient(-45deg,currentColor 25%,transparent 25%,transparent 75%,currentColor 75%);
  background-size:26px 26px}

/* التذييل */
footer.bd{background:var(--bd-indigo);color:#D8D5C4;padding:52px 0 30px;margin-top:20px;
  position:relative;overflow:hidden}
footer.bd a{color:#A9C3F2}
footer.bd .gem{color:#EEECDE}
footer.bd .cols{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:28px}
footer.bd .fine{border-top:1px solid rgba(255,255,255,.12);margin-top:26px;padding-top:18px;
  font-size:12px;color:#9B98B8;display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap}

/* زر واتساب العائم */
.wa-fab{position:fixed;inset-inline-end:18px;bottom:18px;z-index:60;width:56px;height:56px;
  border-radius:50%;background:#25D366;display:grid;place-items:center;
  box-shadow:0 12px 30px rgba(37,211,102,.4)}
.wa-fab svg{width:29px;height:29px;fill:#fff}

table.bd{width:100%;border-collapse:collapse;font-size:13px}
table.bd th,table.bd td{padding:10px 12px;border-bottom:1px solid var(--bd-line);text-align:start}
table.bd th{font-weight:800;color:var(--bd-mute);font-size:12px;background:var(--bd-soft)}
.pill{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:800;
  background:var(--bd-soft);color:var(--bd-blue);border:1px solid var(--bd-line)}
.score{font-weight:900;color:var(--bd-blue)}

@media(max-width:900px){
  .hero-grid,.g3,.g2,.row,footer.bd .cols{grid-template-columns:1fr}
  .gem-art{max-width:200px}
  nav.bd{display:none}
  section{padding:48px 0}
}
`;

// الشعار الحقيقي، مستخرجٌ من الملف التعريفي متجّهاً (ستة أوجه تُكوّن
// ماسةً مضلّعة) لا رسماً تقريبياً. `currentColor` ليرث لون سياقه: كريمي
// على النيلي في الترويسة والتذييل، ونيليّ على الكريمي في المتن.
const GEM = (cls = "gem") => `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true" fill="currentColor">
  <path d="M20.9 25.6 L44.8 25.6 L46 26 L50.1 30.4 L50.7 31.6 L48.2 34.6 L40.7 42.6 L38.4 45.1 L36.1 47.7 L34.1 49.9 L33 50.8 L31.1 49.8 L27.2 45.4 L24.7 42.9 L24.4 42.5 L18.4 35.8 L17.8 35.3 L16.8 34.1 L15 32.2 L14.6 31.5 L15.9 29.7 L17.9 27.7 L19.5 25.9Z"/>
  <path d="M12 34.4 L13.3 35.3 L15.7 38.1 L18.4 40.9 L18.5 41.2 L31.6 55.2 L33.4 57.2 L34.2 58.4 L34.1 59.1 L31.4 59.4 L14 59.4 L13.4 58.9 L12 55 L11.7 53.8 L8.1 42.9 L7.4 40.5 L7.2 38.9 L10 36.1 L11.2 34.9Z"/>
  <path d="M58.3 29.9 L58.6 30.4 L57.7 34.1 L56.7 36.6 L55.5 40.8 L53.2 47.9 L50.7 55.2 L49.7 58.3 L49.1 59.2 L41.8 59.4 L39.6 59.1 L36.8 55.8 L35.3 53.9 L36.7 52.1 L39.8 48.7 L45.1 43.1 L47.7 40.1 L49.6 38.3 L53 34.4 L56.3 31.1 L57 30Z"/>
  <path d="M27.5 7.6 L33.3 13.1 L38.4 18.3 L39.8 19.7 L40.9 21.4 L39.2 22.1 L9.4 22.1 L8.7 21.7 L8.7 20.7 L9.8 19.8 L11.1 19 L12.6 17.8 L16.1 15.3 L19 13.3 L21.8 11.1 L25.1 9 L26.6 7.7Z"/>
  <path d="M31.7 4.4 L39.6 10.2 L42.8 12.5 L45.1 14.1 L49 16.9 L51.8 19 L57.2 22.9 L58 23.7 L57.7 24.8 L53.5 28.7 L51.4 26.9 L45.4 20.4 L41.8 17 L41.4 16.4 L37.5 12.7 L31.1 6.3 L30.6 5.4 L30.8 4.6Z"/>
  <path d="M4.4 25.6 L12.6 25.6 L13.7 25.9 L14 26.3 L13.3 27.7 L12 28.8 L8.1 33.2 L6.7 34.4 L6 34.7 L4.7 32.5 L4.2 30.8 L3 27.1 L2.9 26Z"/>
</svg>`;

const WA_FAB = `<a class="wa-fab" href="https://wa.me/${OFFICE.waPhone}" target="_blank" rel="noopener" aria-label="واتساب">
  <svg viewBox="0 0 24 24"><path d="M.06 24l1.69-6.16A11.87 11.87 0 010 11.93C0 5.35 5.35 0 11.93 0a11.86 11.86 0 018.43 3.49 11.82 11.82 0 013.49 8.44c0 6.57-5.35 11.92-11.93 11.92a11.9 11.9 0 01-5.7-1.45L.06 24zM6.6 20.2l.36.21a9.9 9.9 0 004.97 1.36c5.46 0 9.91-4.44 9.91-9.9a9.85 9.85 0 00-2.9-7.01 9.82 9.82 0 00-7-2.91c-5.47 0-9.91 4.44-9.91 9.9a9.87 9.87 0 001.51 5.26l.24.38-1 3.65 3.82-.94zm11.1-5.63c-.07-.12-.27-.2-.57-.35-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48a9 9 0 01-1.66-2.06c-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.61-.92-2.2-.24-.58-.48-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.42.25-.7.25-1.29.18-1.41z"/></svg>
</a>`;

// الموقع كله غير مفهرس ما دام يُعرض على العميل قبل اعتماده. صفحة تُعرض
// للمراجعة ثم تظهر في نتائج البحث باسم الشركة قبل أن يوافق صاحبها عليها
// ضررٌ لا يُستدرك — ولذلك `indexable` افتراضه false، ويُقلب صراحةً يوم
// يُطلق الموقع على نطاقه.
//
// ولم يُكتب `Disallow: /bluediamond/` في robots.txt عمداً: ذلك الملف
// عامّ يقرأه أي أحد، فيصير إعلاناً عن المسار الذي نريد إخفاءه. الإخفاء
// هنا = noindex + لا رابط وارد + غياب عن خريطة الموقع.
function page({ title, desc, body, nav = true, extraHead = "", script = "", indexable = false }) {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${indexable ? "" : '<meta name="robots" content="noindex,nofollow">\n'}<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Markazi+Text:wght@500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="#1F6FD0" d="M20 6h24l12 16-24 36L8 22z"/></svg>')}">
<style>${CSS}</style>
${extraHead}
</head>
<body>
${nav ? header() : ""}
${body}
${footer()}
${WA_FAB}
${script ? `<script>${script}</script>` : ""}
</body>
</html>`;
}

const header = () => `<header class="bd"><div class="wrap bar">
  <a class="brand" href="/bluediamond/">${GEM()}<span>${OFFICE.shortAr}</span></a>
  <nav class="bd">
    <a href="/bluediamond/#about">من نحن</a>
    <a href="/bluediamond/#services">خدماتنا</a>
    <a href="/bluediamond/#advisory">الاستشارات والتحليل</a>
    <a href="/bluediamond/#methodology">منهجيتنا</a>
    <a href="/bluediamond/#contact">تواصل</a>
  </nav>
  <a class="btn btn-primary" href="/bluediamond/request">سجّل طلبك العقاري</a>
</div></header>`;

const footer = () => `<footer class="bd"><span class="lattice" aria-hidden="true"></span><div class="wrap">
  <div class="cols">
    <div>
      <div class="brand" style="color:#fff">${GEM()}<span>${OFFICE.nameAr}</span></div>
      <p style="color:#B6B3CC;margin-top:12px">${esc(OFFICE.tagline)} — خدمات وحلول عقارية متكاملة وفق تراخيص معتمدة من الهيئة العامة للعقار.</p>
    </div>
    <div>
      <h3 style="color:#fff;font-size:15px">روابط</h3>
      <p><a href="/bluediamond/">الرئيسية</a><br>
         <a href="/bluediamond/request">تسجيل طلب عقاري</a><br>
         <a href="/bluediamond/offer">عرض عقار للبيع أو التأجير</a></p>
    </div>
    <div>
      <h3 style="color:#fff;font-size:15px">تواصل</h3>
      <p><a href="tel:${OFFICE.phone}"><bdi dir="ltr">${esc(OFFICE.phone)}</bdi></a><br>
         <a href="mailto:${OFFICE.email}">${esc(OFFICE.email)}</a><br>
         ${esc(OFFICE.city)}</p>
    </div>
  </div>
  <div class="fine">
    <span>${esc(OFFICE.nameAr)} — ذات مسؤولية محدودة · السجل التجاري ${esc(OFFICE.cr)}</span>
    <span>${esc(OFFICE.nameEn)} · ${esc(OFFICE.site)}</span>
  </div>
</div></footer>`;

// -------------------------------------------------------- الصفحة الرئيسية --
// النصوص منقولة عن الملف التعريفي بالعربية والإنجليزية كما ورد فيه.
const VALUES = [
  ["الريادة", "نضع أنفسنا دائماً في طليعة السوق من خلال تبنّي أفضل الممارسات وتقديم حلول تواكب تطلعات المستقبل."],
  ["الطموح", "نؤمن بأن التطور المستمر أساس النجاح، ونعمل دائماً على تحقيق نتائج تتجاوز التوقعات."],
  ["الابتكار", "نتبنّى مناهج وأدوات تحليلية متجددة، ونوظّف التقنية الحديثة لتقديم حلول عقارية أكثر دقةً وكفاءةً وأعمق أثراً."],
  ["المصداقية", "نبني علاقاتنا على الشفافية والموثوقية والالتزام، بما يعزز ثقة عملائنا وشركائنا."],
  ["الإتقان والجودة", "نلتزم بأعلى معايير الجودة والاحترافية في جميع أعمالنا، لتحقيق أفضل النتائج واستدامة القيمة."],
];

const SERVICES = [
  ["التسويق العقاري", "Real Estate Marketing",
   "حلول تسويقية متكاملة ترتكز على استراتيجيات مدروسة وأدوات رقمية متقدمة للوصول إلى الفئات المستهدفة بكفاءة عالية. نعتمد على تحليل البيانات والمؤشرات السوقية وسلوك العملاء لتصميم حملات ترفع معدلات البيع والتأجير، مع تقارير أداء دورية تُمكّن العميل من قياس العائد على استثماره التسويقي."],
  ["الوساطة العقارية", "Real Estate Brokerage",
   "خدمات وساطة متكاملة في البيع والشراء والتأجير، مستندة إلى خبرة سوقية متخصصة وفهم عميق للمتغيرات العقارية. نربط العملاء بالفرص الملائمة لأهدافهم الاستثمارية والتشغيلية، وندير مراحل التفاوض وإتمام الصفقات وفق أعلى معايير الاحترافية والشفافية."],
  ["إدارة الأملاك العقارية", "Property Management",
   "إدارة تهدف إلى تعظيم العائد الاستثماري والحفاظ على القيمة السوقية للأصول على المدى الطويل: التسويق والتأجير، إعداد وإدارة العقود، العلاقة مع المستأجرين، والإشراف على الصيانة الوقائية والتصحيحية — مع منظومة مالية وإدارية تشمل تحصيل الإيجارات ومتابعة الالتزامات وتقارير دورية للملّاك."],
  ["توثيق عقود الإيجار", "Lease Contract Documentation",
   "توثيق عقود الإيجار عبر منصة إيجار بصفتنا وسيطاً عقارياً معتمداً، وفق إجراءات رقمية متكاملة تجمع بين الكفاءة والامتثال والموثوقية، وبما يضمن توافق العقود مع المتطلبات النظامية المعتمدة ويحفظ حقوق الأطراف كافة."],
  ["الاستشارات والتحليل العقاري", "Real Estate Consulting & Analytics",
   "دراسات الجدوى وتحليل السوق، والهندسة المالية للمشاريع العقارية، والاستشارات الاستراتيجية المتخصصة — مبنية على مؤشرات السوق الحية وقواعد البيانات الرسمية."],
];

const ADVISORY = [
  ["دراسات الجدوى وتحليل السوق",
   "دراسات سوقية معمّقة ترصد الاتجاهات والفرص وتقيّم المخاطر، مستندة إلى مؤشرات السوق الحية وقواعد البيانات الرسمية، لتزويد عملائنا بصورة دقيقة وشاملة عن المنتجات والفرص العقارية."],
  ["الهندسة المالية للمشاريع العقارية",
   "تصميم هياكل تمويلية وحلول مالية متخصصة تحقق التوازن بين العائد المستهدف ومستوى المخاطرة المقبول، بما يناسب طبيعة كل عميل وأهدافه الاستراتيجية."],
  ["الاستشارات الاستراتيجية المتخصصة",
   "حلول نوعية مصمّمة خصيصاً لاحتياجات الجهات الحكومية والصناديق الاستثمارية والشركات العائلية والمطورين العقاريين — بعيداً عن النماذج الجاهزة والمقاربات المعيارية."],
];

function home() {
  const body = `
<div class="hero"><div class="wrap hero-grid">
  <div>
    <span class="eyebrow">${esc(OFFICE.taglineEn)}</span>
    <h1>${esc(OFFICE.tagline)}<br><span>شريكك العقاري الموثوق</span></h1>
    <p class="lead">${esc(OFFICE.nameAr)} شركة متخصصة في تقديم الخدمات والحلول العقارية المتكاملة، تعمل وفق تراخيص معتمدة من الهيئة العامة للعقار، وتستند إلى خبرة متخصصة ومعرفة عميقة بالسوق العقاري السعودي.</p>
    <div class="hero-actions">
      <a class="btn btn-primary" href="/bluediamond/request">سجّل طلبك العقاري</a>
      <a class="btn btn-ghost" href="/bluediamond/offer">لديك عقار للعرض؟</a>
    </div>
  </div>
  <div>${GEM("gem-art")}</div>
</div></div>

<section id="about"><div class="wrap">
  <span class="eyebrow">من نحن</span>
  <h2>قيمةٌ تُبنى، ومستقبلٌ يُصاغ</h2>
  <div class="grid g2">
    <div>
      <p>نقدم خدماتنا وفق منهجية احترافية تجمع بين التحليل الدقيق والخبرة العملية، لتمكين عملائنا من اتخاذ قرارات عقارية واستثمارية واثقة تحقق قيمة مستدامة.</p>
      <p>نؤمن بأن العقار ليس مجرد أصل، بل فرصة تُدار باحتراف، وقيمة تُبنى برؤية، ولذلك نلتزم بتقديم حلول عقارية موثوقة ترتقي بتطلعات عملائنا.</p>
      <div class="en">Blue Diamond Real Estate is a company specializing in comprehensive real estate services and integrated solutions, operating under licenses approved by the General Real Estate Authority (REGA). We draw on specialized expertise and an in-depth knowledge of the Saudi real estate market.</div>
    </div>
    <div class="grid" style="gap:16px">
      <div class="card"><h3>رؤيتنا</h3><p>أن نرسّخ مكانتنا كشريك عقاري موثوق ورائد في المملكة العربية السعودية، من خلال تقديم خدمات وحلول عقارية متكاملة ترتكز على المعرفة المتخصصة وأعلى المعايير المهنية، بما يدعم التنمية العمرانية والاستثمارية.</p></div>
      <div class="card"><h3>رسالتنا</h3><p>تقديم حلول وخدمات عقارية موثوقة تمكّن عملاءنا من اتخاذ قرارات مدروسة، من خلال الخبرة المتخصصة والتحليل الدقيق والالتزام بأعلى معايير المهنية، بما يحقق قيمة مستدامة ويبني شراكات طويلة الأمد قائمة على الثقة.</p></div>
    </div>
  </div>
</div></section>

<section><div class="wrap">
  <span class="eyebrow">لماذا نحن</span>
  <h2>فارقٌ حقيقي يجعلنا الخيار الأنسب</h2>
  <div class="grid g3">
    <div class="card"><span class="n">٢٠+</span><h3>خبرة ميدانية</h3><p>خبرة ميدانية ممتدة لأكثر من عشرين عاماً تمنحنا قراءة عميقة لتحوّلات السوق.</p></div>
    <div class="card"><span class="n">✓</span><h3>تراخيص نظامية</h3><p>تراخيصنا النظامية تتيح لنا تقديم خدماتنا وفق أعلى الأطر التنظيمية المعتمدة.</p></div>
    <div class="card"><span class="n">⌘</span><h3>فريق متعدد التخصصات</h3><p>استشارات وتحليلات وتسويق عقاري وإدارة أصول، معزَّز بعمق قانوني من محامين مرخصين.</p></div>
  </div>
  <p style="margin-top:18px">في الألماس الأزرق، نُقدّم خدماتنا على أساس الشراكة لا المعاملة، ونبني علاقات قائمة على الثقة والنتائج والمصداقية التي لا تُساوم.</p>
</div></section>

<section><div class="wrap">
  <span class="eyebrow">قيمنا</span>
  <h2>خمس قيم تحكم كل عمل نقوم به</h2>
  <div class="grid g3">
    ${VALUES.map(([t, d]) => `<div class="card"><h3>${esc(t)}</h3><p>${esc(d)}</p></div>`).join("")}
  </div>
</div></section>

<section id="services"><div class="wrap">
  <span class="eyebrow">خدماتنا العقارية</span>
  <h2>باقة متكاملة من الخدمات العقارية الاحترافية</h2>
  <p style="max-width:70ch">من خلال فهمنا الدقيق لاحتياجات عملائنا وتطلعاتهم، نطوّر حلولاً عقارية متكاملة تسهم في تعزيز القيمة وتحقيق الأهداف بكفاءة واستدامة.</p>
  <div class="grid g2" style="margin-top:22px">
    ${SERVICES.map(([ar, en, d], i) => `<div class="card">
      <span class="n">${i + 1}</span>
      <h3>${esc(ar)}</h3>
      <p style="font-size:12px;color:var(--bd-blue);font-weight:800;margin:-8px 0 10px">${esc(en)}</p>
      <p>${esc(d)}</p>
    </div>`).join("")}
  </div>
</div></section>

<section id="advisory"><div class="wrap">
  <span class="eyebrow">الاستشارات والتحليل العقاري</span>
  <h2>ثلاثة محاور رئيسية</h2>
  <div class="grid g3">
    ${ADVISORY.map(([t, d], i) => `<div class="card"><span class="n">${i + 1}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></div>`).join("")}
  </div>
  <div class="note" style="margin-top:20px">لطلب دراسة جدوى أو تحليل عقاري أو تقييم، سجّل طلبك من <a href="/bluediamond/request">صفحة الطلبات</a> واختر «استشارة / دراسة»، ويتواصل معك المستشار لتحديد النطاق والأتعاب.</div>
</div></section>

<section id="methodology"><div class="wrap">
  <span class="eyebrow">منهجيتنا في التنفيذ والعمل</span>
  <h2>التميّز لا يتحقق بالاجتهاد الفردي وحده</h2>
  <p style="max-width:74ch">نعتمد منهجية تنفيذ متكاملة تجمع بين التخطيط الاستراتيجي والانضباط التشغيلي والرقابة المستمرة، انطلاقاً من إيماننا بأن التميّز يتحقق من خلال منظومة عمل مؤسسية تحكمها معايير واضحة وإجراءات دقيقة. وتُبنى جميع خدماتنا ومشاريعنا على مراحل مدروسة تضمن كفاءة التنفيذ وجودة المخرجات.</p>
  <div class="grid g3" style="margin-top:20px">
    <div class="card"><span class="n">١</span><h3>الفهم والتحديد</h3><p>قراءة الاحتياج بدقة: نوع الأصل، الموقع، المساحة، طبيعة العائد المستهدف، والأفق الزمني.</p></div>
    <div class="card"><span class="n">٢</span><h3>التحليل والبحث</h3><p>مسح السوق ومطابقة الفرص المتاحة بالمواصفات المطلوبة، مع تقييم المخاطر ومؤشرات القيمة.</p></div>
    <div class="card"><span class="n">٣</span><h3>التنفيذ والمتابعة</h3><p>إدارة التفاوض وإتمام الصفقة والتوثيق النظامي، مع تقارير دورية حتى الإقفال.</p></div>
  </div>
</div></section>

<section><div class="wrap">
  <span class="eyebrow">رسالة الرئيس التنفيذي</span>
  <div class="card" style="padding:32px">
    <p>في الألماس الأزرق العقارية نلتزم بصناعة قيمة عقارية مستدامة تسهم في دعم مستهدفات التنمية وتعزيز النمو الاقتصادي في المملكة العربية السعودية. ومن خلال تقديم منظومة متكاملة من الخدمات والحلول العقارية للقطاعين العام والخاص، نحرص على بناء شراكات استراتيجية قائمة على الفهم العميق لاحتياجات عملائنا، وتحويل تطلعاتهم إلى فرص استثمارية وإنجازات ملموسة.</p>
    <p>ونستند في ذلك إلى مزيج متكامل من الخبرات المتخصصة والكفاءات الوطنية المتميزة والتقنيات الحديثة والرؤى الاستراتيجية، بما يمكّننا من تقديم حلول عقارية عالية الجودة تتسم بالكفاءة والابتكار والموثوقية.</p>
    <p style="margin-bottom:0">شكراً لثقتكم، ونتطلع إلى بناء مستقبل عقاري أكثر تميزاً وازدهاراً معاً.</p>
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--bd-line)">
      <strong style="display:block;font-size:16px">${esc(OFFICE.ceo)}</strong>
      <span style="font-size:13px;color:var(--bd-mute)">${esc(OFFICE.ceoTitle)}</span>
    </div>
  </div>
</div></section>

<section id="contact"><div class="wrap">
  <span class="eyebrow">ابدأ شراكتك معنا اليوم</span>
  <h2>نحن هنا لنكون جزءاً من نجاحكم</h2>
  <p style="max-width:70ch">سواء كنتم تبحثون عن استثمار عقاري ذكي، أو تحتاجون إلى إدارة أصول بمعايير مؤسسية، أو تسعون للحصول على استشارة متخصصة تُبنى على معرفة حقيقية — فريق الألماس الأزرق مستعد لخدمتكم.</p>
  <div class="grid g3" style="margin-top:22px">
    <div class="card stat"><b><a href="tel:${OFFICE.phone}"><bdi dir="ltr">${esc(OFFICE.phone)}</bdi></a></b><span>هاتف / واتساب</span></div>
    <div class="card stat"><b style="font-size:19px"><a href="mailto:${OFFICE.email}">${esc(OFFICE.email)}</a></b><span>البريد الإلكتروني</span></div>
    <div class="card stat"><b style="font-size:19px">${esc(OFFICE.cr)}</b><span>السجل التجاري</span></div>
  </div>
  <div class="hero-actions" style="margin-top:24px">
    <a class="btn btn-primary" href="/bluediamond/request">سجّل طلبك العقاري</a>
    <a class="btn btn-ghost" href="/bluediamond/offer">اعرض عقارك علينا</a>
  </div>
</div></section>`;
  return page({
    title: `${OFFICE.nameAr} — ${OFFICE.tagline}`,
    desc: "شركة متخصصة في الخدمات والحلول العقارية المتكاملة في المملكة العربية السعودية: التسويق العقاري، الوساطة، إدارة الأملاك، توثيق عقود الإيجار، والاستشارات والتحليل العقاري.",
    body,
  });
}

// --------------------------------------------------------- خيارات النماذج --
// مطابقة لمفاتيح api/_rematch.js حرفياً: القيمة المخزَّنة إنجليزية والمعروضة
// عربية. لو اختلفتا، تُخزَّن قيمة لا تطابق شيئاً أبداً.
const TYPE_OPTIONS = [
  ["LAND", "أرض خام"], ["RESIDENTIAL_BUILDING", "عمارة سكنية"], ["COMMERCIAL_BUILDING", "مبنى تجاري"],
  ["VILLA", "فيلا"], ["APARTMENT", "شقة"], ["SHOWROOM", "معرض / محل"], ["WAREHOUSE", "مستودع"],
  ["TOWER", "برج"], ["HOTEL", "فندق / شقق فندقية"], ["FARM", "مزرعة / استراحة"],
  ["COMPOUND", "مجمع سكني مغلق"], ["OFFICE", "مكتب"], ["MIXED", "استخدام مختلط"],
];
const CITY_OPTIONS = ["الرياض", "جدة", "مكة المكرمة", "المدينة المنورة", "الدمام", "الخبر", "الظهران",
  "الأحساء", "القصيم", "الطائف", "أبها", "تبوك", "حائل", "نجران", "جازان", "ينبع", "الجبيل", "نيوم"];
const opts = (list, ph) => `<option value="">${esc(ph)}</option>` +
  list.map((o) => Array.isArray(o) ? `<option value="${esc(o[0])}">${esc(o[1])}</option>` : `<option value="${esc(o)}">${esc(o)}</option>`).join("");

// ------------------------------------------------------------ صفحة الطلب --
function requestPage() {
  const body = `
<section><div class="wrap" style="max-width:840px">
  <span class="eyebrow">تسجيل طلب عقاري</span>
  <h2>اكتب لنا ما تبحث عنه بالضبط</h2>
  <p>كلما دقّت المواصفات، دقّت المطابقة. الحقول المطلوبة أربعة فقط، والباقي يحسّن ترتيب ما نرسله لك.</p>

  <form class="form" id="f" style="margin-top:20px">
    <div class="row">
      <div><label for="name">الاسم *</label><input id="name" name="name" required autocomplete="name"></div>
      <div><label for="phone">رقم الجوال (واتساب) *</label><input id="phone" name="phone" required inputmode="tel" placeholder="05xxxxxxxx" autocomplete="tel"></div>
    </div>
    <div class="row">
      <div><label for="property_type">نوع العقار *</label><select id="property_type" name="property_type" required>${opts(TYPE_OPTIONS, "اختر النوع")}</select></div>
      <div><label for="city">المدينة *</label><select id="city" name="city" required>${opts(CITY_OPTIONS, "اختر المدينة")}</select></div>
    </div>
    <div>
      <label for="districts">الأحياء أو الاتجاهات المفضّلة</label>
      <input id="districts" name="districts" placeholder="مثال: شمال، الملقا، النرجس">
      <div class="hint">تُرجّح ولا تُقصي — العرض الممتاز خارجها يصلك مع تنبيه بأن موقعه ليس ما طلبته.</div>
    </div>
    <div class="row">
      <div><label for="purpose">الغرض</label><select id="purpose" name="purpose">
        <option value="BUY">شراء</option><option value="INVEST">استثمار</option>
        <option value="RENT">استئجار</option><option value="DEVELOP">تطوير</option></select></div>
      <div><label for="income_producing">مدر للدخل؟</label><select id="income_producing" name="income_producing">
        <option value="">لا يفرق</option><option value="true">نعم — مؤجر بعقود قائمة</option>
        <option value="false">لا — شاغر / خام</option></select></div>
    </div>
    <div class="row">
      <div><label for="area_min">المساحة من (م²)</label><input id="area_min" name="area_min" inputmode="numeric"></div>
      <div><label for="area_max">إلى (م²)</label><input id="area_max" name="area_max" inputmode="numeric"></div>
    </div>
    <div class="row">
      <div><label for="budget_min">الميزانية من (ريال)</label><input id="budget_min" name="budget_min" inputmode="numeric"></div>
      <div><label for="budget_max">إلى (ريال)</label><input id="budget_max" name="budget_max" inputmode="numeric"></div>
    </div>
    <div class="row">
      <div><label for="target_yield">العائد السنوي المستهدف %</label><input id="target_yield" name="target_yield" inputmode="decimal" placeholder="مثال: 7"></div>
      <div><label for="timeline">الجاهزية</label><select id="timeline" name="timeline">
        <option value="">غير محدد</option><option value="IMMEDIATE">فوري</option>
        <option value="3M">خلال ٣ أشهر</option><option value="6M">خلال ٦ أشهر</option><option value="12M">خلال سنة</option></select></div>
    </div>
    <div>
      <label for="notes">تفاصيل إضافية</label>
      <textarea id="notes" name="notes" placeholder="اكتب بطريقتك: نوع الصك، الواجهة، التمويل، أو أي شرط يهمّك."></textarea>
    </div>
    <div id="msg" hidden></div>
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <button class="btn btn-primary" type="submit" id="go">أرسل الطلب</button>
      <button class="btn btn-ghost" type="button" id="wa">أرسل طلبي على واتساب</button>
    </div>
    <div class="hint">بإرسال الطلب توافق على تواصل فريق ${esc(OFFICE.shortAr)} معك عبر الجوال أو واتساب بخصوص طلبك.</div>
  </form>
</div></section>`;

  // زر الواتساب هنا استثناءٌ مقصود من قاعدة «لا أزرار واتساب داخل المحتوى»:
  // الرسالة التي يفتحها هي ملخّص النموذج نفسه بصيغة يقرأها المستشار الذكي
  // على الطرف الآخر ويحوّلها إلى طلب — وهي نفس علّة الاستثناء المعتمد في
  // «مشخّص الخدمة». ونشاط العميل نفسه يجري على واتساب.
  const script = `
const F=document.getElementById('f'),M=document.getElementById('msg');
const val=k=>((F[k]&&F[k].value)||'').trim();
function payload(){const p={action:'request'};
  ['name','phone','property_type','city','districts','purpose','notes','timeline'].forEach(k=>{if(val(k))p[k]=val(k)});
  ['area_min','area_max','budget_min','budget_max','target_yield'].forEach(k=>{if(val(k))p[k]=Number(String(val(k)).replace(/[^\\d.]/g,''))});
  if(val('income_producing'))p.income_producing=val('income_producing')==='true';
  return p}
function say(t,cls){M.hidden=false;M.className='note '+(cls||'');M.textContent=t}
const LBL={LAND:'أرض خام',RESIDENTIAL_BUILDING:'عمارة سكنية',COMMERCIAL_BUILDING:'مبنى تجاري',VILLA:'فيلا',APARTMENT:'شقة',SHOWROOM:'معرض / محل',WAREHOUSE:'مستودع',TOWER:'برج',HOTEL:'فندق',FARM:'مزرعة / استراحة',COMPOUND:'مجمع سكني',OFFICE:'مكتب',MIXED:'استخدام مختلط'};
function asText(){const p=payload();const n=x=>Number(x).toLocaleString('en-US');
  return ['مطلوب عقار:',p.property_type?'النوع: '+(LBL[p.property_type]||p.property_type):'',
    p.city?'المدينة: '+p.city+(p.districts?' ('+p.districts+')':''):'',
    (p.area_min||p.area_max)?'المساحة: '+n(p.area_min||p.area_max)+(p.area_max&&p.area_min?' – '+n(p.area_max):'')+' م²':'',
    (p.budget_min||p.budget_max)?'الميزانية: '+(p.budget_min?'من '+n(p.budget_min)+' ':'')+(p.budget_max?'حتى '+n(p.budget_max):'')+' ريال':'',
    p.income_producing===true?'الشرط: مدر للدخل':p.income_producing===false?'الشرط: غير مدر':'',
    p.target_yield?'العائد المستهدف: '+p.target_yield+'%':'',
    p.notes?'تفاصيل: '+p.notes:'', p.name?'الاسم: '+p.name:''].filter(Boolean).join('\\n')}
document.getElementById('wa').onclick=()=>{
  if(!val('property_type')||!val('city')){say('اختر نوع العقار والمدينة أولاً.','err');return}
  window.open('https://wa.me/${OFFICE.waPhone}?text='+encodeURIComponent(asText()),'_blank','noopener')};
F.onsubmit=async e=>{e.preventDefault();const b=document.getElementById('go');
  b.disabled=true;b.textContent='جارٍ الإرسال…';
  try{const r=await fetch('/api/realestate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload())});
    const d=await r.json().catch(()=>({}));
    if(r.ok&&d.ok){say('وصلنا طلبك ✅ رقمه '+d.ref+(d.matches?('، ولدينا '+(d.matches===1?'عرض واحد':d.matches===2?'عرضان':d.matches<=10?d.matches+' عروض':d.matches+' عرضاً')+' مبدئياً يطابقه — يراجعه المستشار ويتواصل معك.'):'، ويتواصل معك المستشار قريباً.'),'ok');F.reset()}
    else say('تعذّر إرسال الطلب الآن. جرّب زر واتساب بالأسفل ويصلنا طلبك مباشرة.','err')}
  catch(_){say('تعذّر الاتصال. استخدم زر واتساب ويصلنا طلبك مباشرة.','err')}
  finally{b.disabled=false;b.textContent='أرسل الطلب'}};`;
  return page({ title: `تسجيل طلب عقاري — ${OFFICE.nameAr}`, desc: "سجّل طلبك العقاري: نوع العقار، المدينة، المساحة، الميزانية، ومدى الحاجة إلى عقار مدر للدخل — ونطابقه على المعروض في السوق.", body, script });
}

// ------------------------------------------------------------- صفحة العرض --
function offerPage() {
  const body = `
<section><div class="wrap" style="max-width:840px">
  <span class="eyebrow">عرض عقار</span>
  <h2>لديك عقار للبيع أو التأجير؟</h2>
  <p>سجّل العرض هنا ليدخل مباشرة في مطابقة الطلبات القائمة لدينا. إن طابق طلباً مفتوحاً، يتواصل معك المستشار في حينه.</p>

  <form class="form" id="f" style="margin-top:20px">
    <div class="row">
      <div><label for="name">الاسم *</label><input id="name" name="name" required autocomplete="name"></div>
      <div><label for="phone">رقم الجوال (واتساب) *</label><input id="phone" name="phone" required inputmode="tel" placeholder="05xxxxxxxx" autocomplete="tel"></div>
    </div>
    <div class="row">
      <div><label for="role">صفتك</label><select id="role" name="role">
        <option value="MARKETER">مسوّق عقاري</option><option value="OWNER">مالك</option>
        <option value="DEVELOPER">مطوّر عقاري</option><option value="BROKER">وسيط</option></select></div>
      <div><label for="company">المنشأة</label><input id="company" name="company"></div>
    </div>
    <div class="row">
      <div><label for="property_type">نوع العقار *</label><select id="property_type" name="property_type" required>${opts(TYPE_OPTIONS, "اختر النوع")}</select></div>
      <div><label for="offer_kind">نوع العرض</label><select id="offer_kind" name="offer_kind">
        <option value="SALE">للبيع</option><option value="RENT">للإيجار</option><option value="INVESTMENT">فرصة استثمارية</option></select></div>
    </div>
    <div class="row">
      <div><label for="city">المدينة *</label><select id="city" name="city" required>${opts(CITY_OPTIONS, "اختر المدينة")}</select></div>
      <div><label for="district">الحي</label><input id="district" name="district"></div>
    </div>
    <div class="row">
      <div><label for="area">المساحة (م²) *</label><input id="area" name="area" required inputmode="numeric"></div>
      <div><label for="price">السعر المطلوب (ريال) *</label><input id="price" name="price" required inputmode="numeric"></div>
    </div>
    <div class="row">
      <div><label for="annual_income">الدخل السنوي (ريال)</label><input id="annual_income" name="annual_income" inputmode="numeric">
        <div class="hint">للعقار المؤجَّر — يُحسب منه العائد تلقائياً.</div></div>
      <div><label for="income_producing">حالة الإشغال</label><select id="income_producing" name="income_producing">
        <option value="">غير محدد</option><option value="true">مؤجَّر / مدر للدخل</option><option value="false">شاغر / خام</option></select></div>
    </div>
    <div class="row">
      <div><label for="deed_type">نوع الصك</label><select id="deed_type" name="deed_type">
        <option value="">غير محدد</option><option value="صك إلكتروني">صك إلكتروني</option>
        <option value="صك زراعي">صك زراعي</option><option value="منحة">منحة</option>
        <option value="حجة استحكام">حجة استحكام</option></select></div>
      <div><label for="location_url">رابط الموقع على الخريطة</label><input id="location_url" name="location_url" inputmode="url" placeholder="https://maps.app.goo.gl/…"></div>
    </div>
    <div><label for="notes">وصف العرض</label><textarea id="notes" name="notes" placeholder="الواجهة، الشوارع، عدد الوحدات، عمر المبنى، أو أي تفصيل يهم المشتري."></textarea></div>
    <div id="msg" hidden></div>
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <button class="btn btn-primary" type="submit" id="go">أرسل العرض</button>
      <button class="btn btn-ghost" type="button" id="wa">أرسل العرض على واتساب</button>
    </div>
    <div class="hint">كل عرض يصلنا يُسجَّل «غير موثّق» حتى يتحقق فريقنا من المالك والصك — ولا يُعرض على عميل قبل ذلك.</div>
  </form>
</div></section>`;

  const script = `
const F=document.getElementById('f'),M=document.getElementById('msg');
const val=k=>((F[k]&&F[k].value)||'').trim();
function payload(){const p={action:'offer'};
  ['name','phone','company','role','property_type','offer_kind','city','district','deed_type','location_url','notes'].forEach(k=>{if(val(k))p[k]=val(k)});
  ['area','price','annual_income'].forEach(k=>{if(val(k))p[k]=Number(String(val(k)).replace(/[^\\d.]/g,''))});
  if(val('income_producing'))p.income_producing=val('income_producing')==='true';
  return p}
function say(t,cls){M.hidden=false;M.className='note '+(cls||'');M.textContent=t}
const LBL={LAND:'أرض خام',RESIDENTIAL_BUILDING:'عمارة سكنية',COMMERCIAL_BUILDING:'مبنى تجاري',VILLA:'فيلا',APARTMENT:'شقة',SHOWROOM:'معرض / محل',WAREHOUSE:'مستودع',TOWER:'برج',HOTEL:'فندق',FARM:'مزرعة / استراحة',COMPOUND:'مجمع سكني',OFFICE:'مكتب',MIXED:'استخدام مختلط'};
function asText(){const p=payload();const n=x=>Number(x).toLocaleString('en-US');
  return [(p.offer_kind==='RENT'?'للإيجار:':'للبيع:'),
    p.property_type?'النوع: '+(LBL[p.property_type]||p.property_type):'',
    p.city?'المدينة: '+p.city+(p.district?' — '+p.district:''):'',
    p.area?'المساحة: '+n(p.area)+' م²':'', p.price?'السعر: '+n(p.price)+' ريال':'',
    p.annual_income?'الدخل السنوي: '+n(p.annual_income)+' ريال':'',
    p.deed_type?'الصك: '+p.deed_type:'', p.location_url?'الموقع: '+p.location_url:'',
    p.notes?p.notes:'', p.name?'المُرسِل: '+p.name+(p.company?' — '+p.company:''):''].filter(Boolean).join('\\n')}
document.getElementById('wa').onclick=()=>{
  if(!val('property_type')||!val('city')){say('اختر نوع العقار والمدينة أولاً.','err');return}
  window.open('https://wa.me/${OFFICE.waPhone}?text='+encodeURIComponent(asText()),'_blank','noopener')};
F.onsubmit=async e=>{e.preventDefault();const b=document.getElementById('go');
  b.disabled=true;b.textContent='جارٍ الإرسال…';
  try{const r=await fetch('/api/realestate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload())});
    const d=await r.json().catch(()=>({}));
    if(r.ok&&d.ok)say('وصلنا عرضك ✅ رقمه '+d.ref+(d.matchedRequests?('، ويطابق '+(d.matchedRequests===1?'طلباً واحداً':d.matchedRequests===2?'طلبين':d.matchedRequests<=10?d.matchedRequests+' طلبات':d.matchedRequests+' طلباً')+' قائماً لدينا — يتواصل معك المستشار.'):'، وهو الآن ضمن مخزوننا ونرجع لك عند أول طلب يناسبه.'),'ok')&&F.reset();
    else say('تعذّر إرسال العرض الآن. جرّب زر واتساب ويصلنا مباشرة.','err')}
  catch(_){say('تعذّر الاتصال. استخدم زر واتساب ويصلنا العرض مباشرة.','err')}
  finally{b.disabled=false;b.textContent='أرسل العرض'}};`;
  return page({ title: `اعرض عقارك — ${OFFICE.nameAr}`, desc: "سجّل عرضك العقاري (بيع أو تأجير) ليدخل مباشرة في مطابقة الطلبات القائمة لدى الألماس الأزرق العقارية.", body, script });
}

// ------------------------------------------------------------ لوحة العمل --
// لوحة داخلية لا تُفهرس. المفتاح يُحفظ في المتصفح ويُرسل مع كل نداء —
// لا جلسة ولا كوكي: اللوحة أداة مكتبٍ صغير، وتعقيد الجلسات هنا كلفةٌ بلا
// مقابل. ولذلك أيضاً noindex: صفحة بمفتاح ليست صفحة عامة.
function crmPage() {
  const body = `
<section style="padding-top:28px"><div class="wrap">
  <span class="eyebrow">لوحة العمل الداخلية</span>
  <h2>الطلبات · العروض · المطابقات · الصفقات · الدراسات</h2>

  <div class="form" style="margin:18px 0" id="gate">
    <div class="row">
      <div><label for="key">مفتاح اللوحة</label><input id="key" type="password" placeholder="BD_OPS_KEY"></div>
      <div style="display:flex;align-items:flex-end"><button class="btn btn-primary" id="enter" type="button">دخول</button></div>
    </div>
    <div class="hint">المفتاح يُحفظ في هذا المتصفح فقط ويُرسل مع كل طلب. لا يُخزَّن على الخادم.</div>
    <div id="gmsg" hidden></div>
  </div>

  <div id="app" hidden>
    <div class="grid g3" id="stats" style="margin-bottom:22px"></div>

    <div class="card" style="margin-bottom:18px">
      <h3>تجربة رسالة واتساب</h3>
      <p class="hint" style="margin-top:0">الصق رسالة كما تصلك من عميل أو مسوّق لترى كيف يقرأها المستشار — بلا حفظ.</p>
      <textarea id="ptext" placeholder="للبيع أرض خام شمال الرياض 5000م السعر 8 مليون"></textarea>
      <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap">
        <button class="btn btn-ghost" id="pgo" type="button">اقرأ</button>
        <button class="btn btn-primary" id="sgo" type="button">حاكِ رسالة واردة (تُحفظ)</button>
      </div>
      <pre id="pout" style="white-space:pre-wrap;font-size:12px;color:var(--bd-mute);margin-top:12px"></pre>
    </div>

    <div class="card" style="margin-bottom:18px">
      <h3>الوارد — كل القنوات</h3>
      <p class="hint" style="margin-top:0">كل ما يصل ينزل هنا أولاً: واتساب، نموذج الموقع، رسائل الحسابات الاجتماعية، البريد، المكالمات، ما يدوّنه الفريق، وما ينقله الوسطاء. يُقرأ ويُراجَع ثم يُحوَّل إلى طلب أو عرض — فلا يضيع ما لم يُفهم، ولا يُسجَّل ناقصاً.</p>
      <div class="row" style="margin:12px 0">
        <div><label for="ichan">القناة</label><select id="ichan"></select></div>
        <div><label for="idetail">المعرّف في القناة</label><input id="idetail" placeholder="@الحساب · البريد · رقم المتصل"></div>
      </div>
      <div class="row" style="margin-bottom:12px">
        <div><label for="iname">اسم المرسل</label><input id="iname"></div>
        <div><label for="iphone">جواله</label><input id="iphone" inputmode="tel" placeholder="05xxxxxxxx"></div>
      </div>
      <div class="row" style="margin-bottom:12px">
        <div><label for="iemail">بريده</label><input id="iemail" inputmode="email"></div>
        <div><label for="idate">تاريخ الوصول</label><input id="idate" type="date"></div>
      </div>
      <label for="itext">نص ما وصل</label>
      <textarea id="itext" placeholder="مطلوب عمارة سكنية في الرياض حي الملقا 5000 متر مؤجرة والدخل السنوي 700 ألف — الطلب عن طريق أبو سعد عن وسيط ثاني"></textarea>
      <label class="hint" style="display:flex;align-items:center;gap:8px;margin-top:10px">
        <input type="checkbox" id="iback"> طلب سابق (أرشيف) — يُسجَّل ويُطابَق بلا أي رسالة تُرسل
      </label>
      <button class="btn btn-primary" id="isave" type="button" style="margin-top:10px">سجّل في الوارد</button>
      <div id="imsg" hidden style="margin-top:12px"></div>
      <div id="idups" hidden style="margin-top:12px"></div>
      <div style="overflow-x:auto;margin-top:16px"><table class="bd" id="tintake"></table></div>
    </div>

    <div class="card" style="margin-bottom:18px">
      <h3>إدخال الطلبات السابقة — دفعة واحدة</h3>
      <p class="hint" style="margin-top:0">الصق تصدير محادثة واتساب (Export chat) أو عدة طلبات يفصلها سطر فارغ. كل رسالة تُسجَّل بتاريخها هي لا بتاريخ اليوم. الدفعة أرشيف: تُطابَق في القاعدة ولا تُرسل رسالة واحدة.</p>
      <div class="row" style="margin:12px 0">
        <div><label for="bfmt">الشكل</label><select id="bfmt">
          <option value="whatsapp">تصدير محادثة واتساب</option>
          <option value="blocks">كتل يفصلها سطر فارغ</option>
        </select></div>
        <div><label for="bfrom">فقط رسائل هذا المرسل</label><input id="bfrom" placeholder="اتركه فارغاً لكل المرسلين"></div>
      </div>
      <label class="hint" style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <input type="checkbox" id="bday" checked> التاريخ يوم/شهر (أجهزة المنطقة). أزل العلامة إن كان التصدير شهر/يوم
      </label>
      <textarea id="btext" style="min-height:160px" placeholder="[12/03/2025, 9:41:22 ص] أبو سعد: مطلوب أرض خام شمال الرياض 5000 متر"></textarea>
      <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap">
        <button class="btn btn-ghost" id="bprev" type="button">اقرأ بلا حفظ</button>
        <button class="btn btn-primary" id="bgo" type="button">أدخل الدفعة</button>
      </div>
      <div id="bmsg" hidden style="margin-top:12px"></div>
      <div id="bout" style="margin-top:12px;font-size:12px;color:var(--bd-mute)"></div>
    </div>

    <div class="card" style="margin-bottom:18px">
      <h3>الطلبات المفتوحة</h3>
      <div style="overflow-x:auto"><table class="bd" id="treq"></table></div>
    </div>

    <div class="card" id="mcard" style="margin-bottom:18px" hidden>
      <h3 id="mtitle">المطابقات</h3>
      <div id="mbody"></div>
    </div>

    <div class="card" style="margin-bottom:18px">
      <h3>العروض</h3>
      <div style="overflow-x:auto"><table class="bd" id="tlst"></table></div>
    </div>

    <div class="card" style="margin-bottom:18px">
      <h3>الصفقات</h3>
      <p class="hint" style="margin-top:0">تُفتح الصفقة من مطابقة أعلاه. تغيير المرحلة يحرّك ما حولها: الإقفال يسحب العرض من السوق ويغلق الطلب، والخسارة تعيد الطلب إلى البحث.</p>
      <div id="pipe" style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0"></div>
      <div style="overflow-x:auto"><table class="bd" id="tdeal"></table></div>
    </div>

    <div class="card" style="margin-bottom:18px">
      <h3>الدراسات والتحليل العقاري</h3>
      <div class="row" style="margin:12px 0">
        <div><label for="skind">النوع</label><select id="skind"></select></div>
        <div><label for="stitle">العنوان *</label><input id="stitle" placeholder="دراسة جدوى مشروع سكني شمال الرياض"></div>
      </div>
      <div class="row" style="margin-bottom:12px">
        <div><label for="scity">المدينة</label><input id="scity"></div>
        <div><label for="sfee">الأتعاب (ريال)</label><input id="sfee" inputmode="numeric"></div>
      </div>
      <div class="row" style="margin-bottom:12px">
        <div><label for="sname">اسم العميل</label><input id="sname"></div>
        <div><label for="sphone">جوال العميل</label><input id="sphone" inputmode="tel" placeholder="05xxxxxxxx"></div>
      </div>
      <button class="btn btn-primary" id="snew" type="button">افتح ملف دراسة</button>
      <div id="smsg" hidden style="margin-top:12px"></div>
      <div style="overflow-x:auto;margin-top:16px"><table class="bd" id="tstudy"></table></div>
    </div>

    <div class="card">
      <h3>جهات الاتصال</h3>
      <div style="overflow-x:auto"><table class="bd" id="tcon"></table></div>
    </div>
  </div>
</div></section>`;

  // اللوحة تقرأ مسمّيات المراحل والحالات من /api/realestate?action=status لا
  // من نسخة عندها: قائمتان تُكتبان مرتين تنحرفان، فتعرض اللوحة مرحلةً لا
  // تقبلها القاعدة ويسقط التحديث بلا سبب ظاهر.
  const script = `
const $=s=>document.querySelector(s);
let KEY=localStorage.getItem('bd_ops_key')||'';
let LAB={dealStages:{},studyKinds:{},studyStatuses:{},propertyTypes:{},channels:{},chainRoles:{}};
const n=x=>x==null?'—':Number(x).toLocaleString('en-US');
const t=c=>LAB.propertyTypes[c]||c||'—';
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const opts=(map,sel)=>Object.entries(map).map(([k,v])=>'<option value="'+esc(k)+'"'+(k===sel?' selected':'')+'>'+esc(v)+'</option>').join('');
const short=d=>d?String(d).slice(0,10):'—';
const DONE_REQ=new Set(['WON','LOST','CANCELLED']);

async function api(q,body){
  const qs=new URLSearchParams({...q,key:KEY}).toString();
  const r=await fetch('/api/realestate?'+qs,body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...body,key:KEY})}:{});
  return {status:r.status,data:await r.json().catch(()=>({}))}}

function table(el,cols,rows,render){
  el.innerHTML='<thead><tr>'+cols.map(c=>'<th>'+esc(c)+'</th>').join('')+'</tr></thead><tbody>'+
    (rows.length?rows.map(render).join(''):'<tr><td colspan="'+cols.length+'">لا يوجد</td></tr>')+'</tbody>'}

function say(el,text,cls){el.hidden=false;el.className='note '+(cls||'');el.textContent=text}

async function load(){
  const d=(await api({action:'dashboard'})).data;
  const c=d.counts||{},m=d.money||{};
  $('#stats').innerHTML=[['وارد ينتظر المراجعة',c.inbox],['الطلبات المفتوحة',c.openRequests],['العروض المتاحة',c.activeListings],
    ['مطابقات جديدة',c.newMatches],['جهات الاتصال',c.contacts],['صفقات جارية',c.openDeals],['دراسات مفتوحة',c.openStudies],
    ['قيمة الصفقات الجارية',n(m.openValue)],['قيمة الصفقات المُقفلة',n(m.wonValue)],['العمولة المحقّقة',n(m.wonCommission)]]
    .map(([k,v])=>'<div class="card stat"><b>'+(v===0?0:(v||0))+'</b><span>'+k+'</span></div>').join('');

  const reqs=(await api({action:'list',of:'requests',limit:'40'})).data.rows||[];
  table($('#treq'),['المرجع','النوع','المدينة','المساحة','الميزانية','مدر؟','الاكتمال','الحالة','إجراء'],reqs,r=>
    '<tr><td><b>'+esc(r.ref)+'</b></td><td>'+esc(t(r.property_type))+'</td><td>'+esc(r.city||'—')+'</td>'+
    '<td>'+n(r.area_min)+(r.area_max&&r.area_max!==r.area_min?' – '+n(r.area_max):'')+'</td>'+
    '<td>'+(r.budget_max?'حتى '+n(r.budget_max):'—')+'</td>'+
    '<td>'+(r.income_producing===true?'نعم':r.income_producing===false?'لا':'—')+'</td>'+
    '<td>'+(r.completeness||0)+'%</td><td><span class="pill">'+esc(r.status)+'</span></td>'+
    // الطلب المنتهي لا يُطابَق ولا يُطرح على السوق: طرح طلبٍ رُبحت صفقته
    // يرسل «مطلوب لعميل» إلى الشبكة كلها عن حاجةٍ انتهت.
    '<td>'+(DONE_REQ.has(r.status)?'<span class="hint">انتهى</span>':
      ('<button class="btn btn-ghost" style="padding:6px 12px;font-size:12px" data-m="'+esc(r.ref)+'">طابِق</button> '+
       '<button class="btn btn-ghost" style="padding:6px 12px;font-size:12px" data-b="'+esc(r.ref)+'">اطرح على السوق</button>'))+
    '</td></tr>');

  const lsts=(await api({action:'list',of:'listings',limit:'40'})).data.rows||[];
  table($('#tlst'),['المرجع','النوع','المدينة','المساحة','السعر','ريال/م²','العائد','الحالة'],lsts,r=>
    '<tr><td><b>'+esc(r.ref)+'</b></td><td>'+esc(t(r.property_type))+'</td>'+
    '<td>'+esc(r.city||'—')+(r.district?' — '+esc(r.district):'')+'</td><td>'+n(r.area)+'</td>'+
    '<td>'+n(r.price)+'</td><td>'+n(r.price_per_m)+'</td><td>'+(r.yield_pct?r.yield_pct+'%':'—')+'</td>'+
    '<td><span class="pill">'+esc(r.status)+'</span></td></tr>');

  // خطّ الأنابيب: المرحلة وعددها، بالترتيب الذي تمرّ به الصفقة فعلاً.
  const pipe=d.pipeline||{};
  $('#pipe').innerHTML=Object.keys(LAB.dealStages).map(k=>
    '<span class="pill" style="'+(pipe[k]?'':'opacity:.45')+'">'+esc(LAB.dealStages[k])+': '+(pipe[k]||0)+'</span>').join('');

  const deals=(d.recent&&d.recent.deals)||[];
  const byId=Object.fromEntries(lsts.map(l=>[l.id,l])),reqById=Object.fromEntries(reqs.map(r=>[r.id,r]));
  table($('#tdeal'),['المرجع','العقار','الطلب','القيمة','العمولة','المرحلة','السبب/الإقفال'],deals,r=>{
    const l=byId[r.listing_id],q=reqById[r.request_id];
    return '<tr><td><b>'+esc(r.ref)+'</b></td>'+
    '<td>'+(l?esc(l.ref)+' — '+esc(t(l.property_type))+(l.city?' · '+esc(l.city):''):'—')+'</td>'+
    '<td>'+(q?esc(q.ref):'—')+'</td><td>'+n(r.amount)+'</td>'+
    '<td>'+n(r.commission_amount)+(r.commission_pct?' <span class="hint">('+r.commission_pct+'%)</span>':'')+'</td>'+
    '<td><select data-deal="'+esc(r.ref)+'" style="padding:6px 8px;font-size:12px">'+opts(LAB.dealStages,r.stage)+'</select></td>'+
    '<td>'+(r.lost_reason?esc(r.lost_reason):short(r.closed_at))+'</td></tr>'});

  const studies=(d.recent&&d.recent.studies)||[];
  table($('#tstudy'),['المرجع','النوع','العنوان','المدينة','الأتعاب','الحالة','المخرج'],studies,r=>
    '<tr><td><b>'+esc(r.ref)+'</b></td><td>'+esc(LAB.studyKinds[r.kind]||r.kind)+'</td>'+
    '<td>'+esc(r.title)+'</td><td>'+esc(r.city||'—')+'</td><td>'+n(r.fee)+'</td>'+
    '<td><select data-study="'+esc(r.ref)+'" style="padding:6px 8px;font-size:12px">'+opts(LAB.studyStatuses,r.status)+'</select></td>'+
    '<td>'+(r.output_url?'<a href="'+esc(r.output_url)+'" target="_blank" rel="noopener">الملف</a>':'—')+'</td></tr>');

  await loadIntake();

  const cons=(await api({action:'list',of:'contacts',limit:'40'})).data.rows||[];
  table($('#tcon'),['الاسم','الجوال','الأدوار','المدينة','عروض','مطابقات','صفقات'],cons,r=>
    '<tr><td>'+esc(r.name||'—')+'</td><td>'+esc(r.wa_phone)+'</td>'+
    '<td>'+(r.roles||[]).map(x=>'<span class="pill">'+esc(x)+'</span>').join(' ')+'</td>'+
    '<td>'+esc(r.city||'—')+'</td><td>'+(r.offers_count||0)+'</td><td>'+(r.matched_count||0)+'</td>'+
    '<td>'+(r.deals_count||0)+'</td></tr>');
}

// ------------------------------------------------------------- الوارد --
// السلسلة تُكتب سطراً لكل وسيط: الاسم | الجوال | الدور | الحصة٪. صيغةٌ
// تُكتب بسرعة الواتساب، ونموذجٌ بحقول لكل وسيط لا يملؤه أحد وهو يعمل.
function parseChainLines(text){
  return String(text||'').split(/\n/).map(l=>l.trim()).filter(Boolean).map((l,i)=>{
    const p=l.split('|').map(x=>x.trim());
    return {position:i+1,name:p[0]||'',phone:p[1]||'',role:(p[2]||'BROKER').toUpperCase(),share_pct:p[3]?Number(String(p[3]).replace('%','')):null}})
    .filter(x=>x.name||x.phone)}

function dupLine(d){return '<div class="hint">⚠️ قد يكون تكراراً لـ <b>'+esc(d.ref)+'</b> — '+esc(d.reason)+' ('+Math.round(d.confidence*100)+'%)</div>'}

async function loadIntake(){
  const rows=(await api({action:'list',of:'intake',limit:'40'})).data.rows||[];
  const open=rows.filter(r=>r.status==='NEW'||r.status==='NEEDS_INFO');
  table($('#tintake'),['المرجع','القناة','وصل','المرسل','ما فُهم','النص','إجراء'],open,r=>{
    const pr=r.parsed||{};
    const hint=(pr.chain_hint&&pr.chain_hint.hinted)?' <span class="pill">وسيط</span>':'';
    const back=r.backlog?' <span class="pill">أرشيف</span>':'';
    return '<tr><td><b>'+esc(r.ref)+'</b>'+back+'</td>'+
      '<td>'+esc(LAB.channels[r.channel]||r.channel)+'</td>'+
      '<td>'+short(r.received_at)+'</td>'+
      '<td>'+esc(r.sender_name||r.sender_phone||r.sender_email||'—')+hint+'</td>'+
      '<td>'+esc(r.intent==='LISTING'?'عرض':r.intent==='REQUEST'?'طلب':r.intent==='STUDY'?'دراسة':'غير واضح')+
        '<div class="hint">'+esc(t(pr.property_type))+(pr.city?' · '+esc(pr.city):'')+'</div></td>'+
      '<td style="max-width:280px"><div class="hint" style="white-space:pre-wrap">'+esc(String(r.raw_text||'').slice(0,160))+'</div></td>'+
      '<td style="white-space:nowrap">'+
        '<button class="btn btn-primary" style="padding:6px 10px;font-size:12px" data-conv="'+esc(r.ref)+'" data-kind="REQUEST">طلب</button> '+
        '<button class="btn btn-ghost" style="padding:6px 10px;font-size:12px" data-conv="'+esc(r.ref)+'" data-kind="LISTING">عرض</button> '+
        '<button class="btn btn-ghost" style="padding:6px 10px;font-size:12px" data-drop="'+esc(r.ref)+'">تجاهل</button>'+
      '</td></tr>'});
}

$('#isave').onclick=async()=>{
  const msg=$('#imsg'),dups=$('#idups');dups.hidden=true;
  const text=$('#itext').value.trim();
  if(!text){say(msg,'اكتب نص ما وصل.','err');return}
  const d=$('#idate').value;
  const r=await api({},{action:'intake',text:text,channel:$('#ichan').value,
    channelDetail:$('#idetail').value.trim(),name:$('#iname').value.trim(),
    phone:$('#iphone').value.trim(),email:$('#iemail').value.trim(),
    receivedAt:d?new Date(d+'T12:00:00Z').toISOString():null,backlog:$('#iback').checked});
  if(r.status!==200){say(msg,'تعذّر التسجيل: '+esc((r.data&&r.data.error)||r.status),'err');return}
  say(msg,'سُجّل في الوارد: '+r.data.row.ref+' — راجعه في الجدول ثم حوّله.','ok');
  const list=(r.data.duplicates||[]);
  if(list.length){dups.hidden=false;dups.innerHTML=list.map(dupLine).join('')}
  $('#itext').value='';loadIntake()};

// التحويل يسأل عن السلسلة أولاً: بعد الحفظ يصير السؤال تصحيحاً، وقبله
// هو الوقت الوحيد الذي يكون فيه من أدخل الصفّ يذكر من نقله.
async function convert(ref,kind){
  const hint=kind==='REQUEST'?'سلسلة الوسطاء (اختياري) — سطر لكل واحد:\nالاسم | الجوال | الدور | الحصة٪\nالأدوار: BROKER وسيط · MARKETER مسوّق · CLIENT صاحب الطلب · OWNER مالك':'سلسلة من نقل العرض (اختياري) — سطر لكل واحد:\nالاسم | الجوال | الدور | الحصة٪';
  const raw=prompt(hint,'');
  if(raw===null)return;
  const chain=parseChainLines(raw);
  const r=await api({},{action:'intake-convert',ref:ref,kind:kind,chain:chain});
  const msg=$('#imsg');
  if(r.status!==200){say(msg,'تعذّر التحويل: '+esc((r.data&&r.data.error)||r.status),'err');return}
  say(msg,'تحوّل '+ref+' إلى '+r.data.ref+(r.data.matches?' — '+r.data.matches+' مطابقة':' — بلا مطابقة بعد'),'ok');
  loadIntake();load()}

// ------------------------------------------------- إدخال الأرشيف ------
$('#bprev').onclick=async()=>{
  const msg=$('#bmsg');
  const r=await api({},{action:'intake-preview',text:$('#btext').value,format:$('#bfmt').value,dayFirst:$('#bday').checked});
  if(r.status!==200){say(msg,'تعذّرت القراءة.','err');return}
  const d=r.data;
  const senders=Object.entries(d.senders||{}).sort((a,b)=>b[1]-a[1]).slice(0,8);
  say(msg,'قُرئت '+d.total+' رسالة. لا شيء حُفظ.','ok');
  $('#bout').innerHTML=(senders.length?'<div><b>المرسلون:</b> '+senders.map(([k,v])=>esc(k)+' ('+v+')').join(' · ')+'</div>':'')+
    '<div style="margin-top:8px"><b>عيّنة:</b></div>'+
    (d.sample||[]).map(x=>'<div style="border-bottom:1px solid var(--bd-line);padding:6px 0">'+
      '<span class="pill">'+esc(x.intent==='LISTING'?'عرض':x.intent==='REQUEST'?'طلب':x.intent==='STUDY'?'دراسة':'يُتجاهل')+'</span> '+
      short(x.at)+' — '+esc(x.sender||'')+': '+esc(x.text)+'</div>').join('')};

$('#bgo').onclick=async()=>{
  const msg=$('#bmsg'),text=$('#btext').value.trim();
  if(!text){say(msg,'الصق التصدير أو الطلبات أولاً.','err');return}
  if(!confirm('سيُسجَّل ما يُقرأ في الوارد كأرشيف — بلا إرسال أي رسالة. متابعة؟'))return;
  say(msg,'جارٍ الإدخال…','');
  const r=await api({},{action:'intake-bulk',text:text,format:$('#bfmt').value,
    onlyFrom:$('#bfrom').value.trim()||null,dayFirst:$('#bday').checked,backlog:true});
  if(r.status!==200){say(msg,'تعذّر الإدخال.','err');return}
  const d=r.data;
  say(msg,'قُرئت '+d.read+' · سُجّلت '+d.saved+' · تُجوهلت '+d.skipped+(d.truncated?' · بقي '+d.truncated+' لدفعة تالية':''),'ok');
  $('#bout').innerHTML=(d.skippedRows||[]).length?'<div><b>ما لم يُسجَّل:</b></div>'+
    d.skippedRows.map(x=>'<div class="hint">'+esc(x.why)+' — '+esc(x.text)+'</div>').join(''):'';
  loadIntake();load()};

// المطابقات تُعرض في اللوحة لا في نافذة تنبيه: من نافذة لا يمكن فتح صفقة
// ولا إرسال بطاقة، وكتابة مرجعين باليد لفتح صفقة عملٌ لا يقوم به أحد.
async function showMatches(ref){
  const r=await api({},{action:'match',ref:ref});
  const card=$('#mcard');card.hidden=false;
  $('#mtitle').textContent='مطابقات '+ref+' — '+(r.data.count||0);
  card.scrollIntoView({behavior:'smooth',block:'nearest'});
  if(!r.data.count){$('#mbody').innerHTML='<p class="hint">لا مطابقات في المخزون. اطرح الطلب على السوق.</p>';return}
  $('#mbody').innerHTML=r.data.matches.map(x=>{
    const l=x.listing||{};
    return '<div style="border:1px solid var(--bd-line);border-radius:12px;padding:14px;margin-bottom:10px">'+
      '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">'+
      '<b>'+esc(x.ref)+' — '+esc(t(l.property_type))+(l.city?' · '+esc(l.city):'')+'</b>'+
      '<span class="score">'+x.score+'%</span></div>'+
      '<div class="hint">'+n(l.area)+' م² · '+n(l.price)+' ريال'+(l.yield_pct?' · عائد '+l.yield_pct+'%':'')+'</div>'+
      ((x.reasons||[]).length?'<div class="hint" style="color:#16A34A">✅ '+esc(x.reasons.join(' · '))+'</div>':'')+
      ((x.gaps||[]).length?'<div class="hint" style="color:#B45309">⚠️ '+esc(x.gaps.join(' · '))+'</div>':'')+
      '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">'+
      '<button class="btn btn-ghost" style="padding:6px 12px;font-size:12px" data-send="'+esc(ref)+'" data-lid="'+esc(x.id||'')+'">أرسل للعميل</button>'+
      '<button class="btn btn-primary" style="padding:6px 12px;font-size:12px" data-open="'+esc(ref)+'" data-lref="'+esc(x.ref)+'">افتح صفقة</button>'+
      '</div></div>'}).join('');
}

document.addEventListener('click',async e=>{
  const g=k=>e.target.getAttribute&&e.target.getAttribute(k);
  const m=g('data-m'),b=g('data-b'),send=g('data-send'),open=g('data-open');
  const conv=g('data-conv'),drop=g('data-drop');
  if(conv)await convert(conv,g('data-kind')||'REQUEST');
  if(drop){
    // «مكرر» يحتاج مرجع الصفّ الأصلي، وإلا صار التجاهل نسياناً لا قراراً.
    const dup=prompt('مرجع الطلب الذي يكرّره (BD-T-…)، أو اتركه فارغاً للتجاهل:','');
    if(dup===null)return;
    const r=await api({},dup.trim()?{action:'intake-close',ref:drop,status:'DUPLICATE',dupOf:dup.trim()}
                                   :{action:'intake-close',ref:drop,status:'DISCARDED'});
    if(r.status!==200){alert('تعذّر: '+((r.data&&r.data.error)||r.status));return}
    loadIntake()}
  if(m)await showMatches(m);
  if(b){if(!confirm('يُرسل نص الطلب '+b+' إلى المسوّقين والمطوّرين في القاعدة. متابعة؟'))return;
    const r=await api({},{action:'broadcast',ref:b});
    alert(r.data.ok?('أُرسل إلى '+r.data.sent+' من '+r.data.audience+'\\n\\n'+r.data.message):'تعذّر الإرسال')}
  if(send){const r=await api({},{action:'send-matches',ref:send,listingIds:[g('data-lid')]});
    alert(r.data.ok?('أُرسلت '+r.data.sent+' بطاقة للعميل.'):('تعذّر الإرسال: '+(r.data.error||'')))}
  if(open){const r=await api({},{action:'deal',requestRef:open,listingRef:g('data-lref')});
    if(r.status===409){alert('على هذا الزوج صفقة مفتوحة أصلاً: '+r.data.ref);return}
    if(!r.data.ok){alert('تعذّر فتح الصفقة: '+(r.data.error||''));return}
    alert('فُتحت الصفقة '+r.data.ref);await load()}});

document.addEventListener('change',async e=>{
  const dealRef=e.target.getAttribute&&e.target.getAttribute('data-deal');
  const studyRef=e.target.getAttribute&&e.target.getAttribute('data-study');
  if(dealRef){
    const stage=e.target.value;const body={action:'deal-stage',ref:dealRef,stage:stage};
    // الخسارة تُسجَّل بسببها: صفقةٌ خسرت بلا سبب لا تعلّم المكتب شيئاً.
    if(stage==='LOST'){const why=prompt('سبب خسارة الصفقة '+dealRef+'؟');
      if(!why){await load();return} body.lostReason=why}
    if(stage==='CLOSED'&&!confirm('إقفال '+dealRef+' يسحب العرض من السوق ويغلق الطلب. متابعة؟')){await load();return}
    const r=await api({},body);
    if(!r.data.ok)alert('تعذّر التحديث: '+(r.data.error||''));
    await load()}
  if(studyRef){
    const status=e.target.value;const body={action:'study-status',ref:studyRef,status:status};
    if(status==='DELIVERED'){const url=prompt('رابط المخرج المُسلَّم للعميل؟');
      if(!url){await load();return} body.outputUrl=url}
    const r=await api({},body);
    if(!r.data.ok)alert('تعذّر التحديث: '+(r.data.error||''));
    await load()}});

$('#snew').onclick=async()=>{
  const v=id=>($(id).value||'').trim();
  if(!v('#stitle')){say($('#smsg'),'العنوان مطلوب.','err');return}
  const r=await api({},{action:'study',kind:v('#skind'),title:v('#stitle'),city:v('#scity')||null,
    fee:v('#sfee')?Number(v('#sfee').replace(/[^\\d.]/g,'')):null,name:v('#sname')||null,phone:v('#sphone')||null});
  if(!r.data.ok){say($('#smsg'),'تعذّر الفتح: '+(r.data.error||''),'err');return}
  say($('#smsg'),'فُتح الملف '+r.data.ref,'ok');
  ['#stitle','#scity','#sfee','#sname','#sphone'].forEach(id=>{$(id).value=''});
  await load()};

$('#pgo').onclick=async()=>{const r=await api({},{action:'parse',text:$('#ptext').value});
  $('#pout').textContent=JSON.stringify(r.data,null,1)};
$('#sgo').onclick=async()=>{const r=await api({},{action:'simulate',text:$('#ptext').value,from:'966500000000',name:'تجربة'});
  $('#pout').textContent=JSON.stringify(r.data,null,1);load()};

async function enter(){
  KEY=($('#key').value||KEY||'').trim();
  const r=await api({action:'status'});
  if(r.status!==200){$('#gmsg').hidden=false;$('#gmsg').className='note err';
    $('#gmsg').textContent=(r.data&&r.data.error==='ops_key_unset')
      ?'مفتاح اللوحة غير مضبوط على الخادم (BD_OPS_KEY). اضبطه ثم أعد التشغيل.'
      :'مفتاح غير صحيح.';return}
  LAB=r.data.labels||LAB;
  $('#skind').innerHTML=opts(LAB.studyKinds,'ANALYSIS');
  $('#ichan').innerHTML=opts(LAB.channels,'WHATSAPP');
  localStorage.setItem('bd_ops_key',KEY);
  $('#gate').hidden=true;$('#app').hidden=false;load()}
$('#enter').onclick=enter;
$('#key').addEventListener('keydown',e=>{if(e.key==='Enter')enter()});
if(KEY){$('#key').value=KEY;enter()}`;

  return page({
    title: `لوحة العمل — ${OFFICE.nameAr}`,
    desc: "لوحة داخلية.",
    body, script,
  });
}

// ------------------------------------------------------------------ الكتابة --
fs.mkdirSync(OUT, { recursive: true });
const pages = {
  "index.html": home(),
  "request.html": requestPage(),
  "offer.html": offerPage(),
  "crm.html": crmPage(),
};
for (const [name, html] of Object.entries(pages)) fs.writeFileSync(path.join(OUT, name), html);
console.log(`Blue Diamond site generated — ${Object.keys(pages).length} pages at /bluediamond/`);
