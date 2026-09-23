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
.brand span{white-space:nowrap}
.brand .gem{width:30px;height:30px;flex:none;color:var(--bd-mark)}
nav.bd{display:flex;gap:18px;margin-inline-start:auto;flex-wrap:nowrap}
nav.bd a{color:var(--bd-ink);font-size:14px;font-weight:700;opacity:.82}
nav.bd a:hover{opacity:1;color:var(--bd-blue)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;
  padding:13px 24px;border-radius:12px;font-weight:800;font-size:14px;border:1px solid transparent;
  cursor:pointer;white-space:nowrap}
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
  /* النڤ يختفي، ومبدّل اللغة لا يختفي — فيرث دفعه إلى الطرف. ودخوله
     الشريط يُفيض الزرّ خارج الشاشة عند ٣٩٠ بكسل، فيلفّ الشريط سطرين:
     العلامة واللغة فوق، والزرّ بعرض الشاشة تحت. ضغطُهم في سطر واحد كان
     سيعطي زرّاً بحجمٍ لا يُنقر. */
  nav.bd{display:none}
  header.bd .bar{flex-wrap:wrap;row-gap:10px;padding-block:10px}
  .langs{margin-inline-start:auto}
  header.bd .bar>.btn{flex-basis:100%}
  section{padding:48px 0}
}
/* مبدّل اللغة. ثلاث لغات في شريط واحد — لا قائمة منسدلة: ثلاثة خيارات
   لا تستحق نقرتين. */
.langs{display:flex;gap:2px;border:1px solid var(--bd-line);border-radius:10px;
  padding:2px;background:var(--bd-card);flex:none}
.langs a{font-size:12px;font-weight:800;padding:5px 10px;border-radius:8px;
  color:var(--bd-ink);opacity:.66;line-height:1.5;white-space:nowrap}
.langs a:hover{opacity:1}
.langs a[aria-current]{background:linear-gradient(135deg,var(--bd-indigo),var(--bd-blue));
  color:#fff;opacity:1}

/* الصينية تحتاج محرفاً صينياً — Markazi وIBM Plex لا يحملان الهانتسي،
   فبدونهما يسقط المتصفح إلى خطٍّ افتراضي لا علاقة له بالهوية. */
html[lang="zh-Hans"] body{font-family:"Noto Sans SC","IBM Plex Sans Arabic",system-ui,sans-serif;
  line-height:1.85}
html[lang="zh-Hans"] h1,html[lang="zh-Hans"] h2,html[lang="zh-Hans"] h3,
html[lang="zh-Hans"] .brand span,html[lang="zh-Hans"] .stat b{
  font-family:"Noto Serif SC","Markazi Text",serif;letter-spacing:0;font-weight:700}
html[lang="zh-Hans"] h1{font-size:clamp(30px,4.8vw,48px)}
html[lang="zh-Hans"] h2{font-size:clamp(24px,3.4vw,34px)}
/* Markazi رحبٌ في العربية وضيّقٌ في اللاتينية — معايرةٌ طفيفة تعيد التوازن. */
html[lang="en"] h1,html[lang="en"] h2{letter-spacing:-.02em}
html[lang="en"] .eyebrow,html[lang="zh-Hans"] .eyebrow{letter-spacing:.1em}
`;

// الشعار الحقيقي، مستخرجٌ من الملف التعريفي متجّهاً (ستة أوجه تُكوّن
// ماسةً مضلّعة) لا رسماً تقريبياً. `currentColor` ليرث لون سياقه: كريمي
// على النيلي في الترويسة والتذييل، ونيليّ على الكريمي في المتن.
// مسارات العلامة — مصدر واحد تشترك فيه العلامة في الصفحة وأيقونة
// التبويب. كانت الأيقونة نسخةً ثانيةً باللون القديم، فنجت من تبديل
// الهوية لأن قيمتها مُرمّزة URL فلا يمسكها بحثٌ عن اللون.
const MARK_PATHS = [
  "M20.9 25.6 L44.8 25.6 L46 26 L50.1 30.4 L50.7 31.6 L48.2 34.6 L40.7 42.6 L38.4 45.1 L36.1 47.7 L34.1 49.9 L33 50.8 L31.1 49.8 L27.2 45.4 L24.7 42.9 L24.4 42.5 L18.4 35.8 L17.8 35.3 L16.8 34.1 L15 32.2 L14.6 31.5 L15.9 29.7 L17.9 27.7 L19.5 25.9Z",
  "M12 34.4 L13.3 35.3 L15.7 38.1 L18.4 40.9 L18.5 41.2 L31.6 55.2 L33.4 57.2 L34.2 58.4 L34.1 59.1 L31.4 59.4 L14 59.4 L13.4 58.9 L12 55 L11.7 53.8 L8.1 42.9 L7.4 40.5 L7.2 38.9 L10 36.1 L11.2 34.9Z",
  "M58.3 29.9 L58.6 30.4 L57.7 34.1 L56.7 36.6 L55.5 40.8 L53.2 47.9 L50.7 55.2 L49.7 58.3 L49.1 59.2 L41.8 59.4 L39.6 59.1 L36.8 55.8 L35.3 53.9 L36.7 52.1 L39.8 48.7 L45.1 43.1 L47.7 40.1 L49.6 38.3 L53 34.4 L56.3 31.1 L57 30Z",
  "M27.5 7.6 L33.3 13.1 L38.4 18.3 L39.8 19.7 L40.9 21.4 L39.2 22.1 L9.4 22.1 L8.7 21.7 L8.7 20.7 L9.8 19.8 L11.1 19 L12.6 17.8 L16.1 15.3 L19 13.3 L21.8 11.1 L25.1 9 L26.6 7.7Z",
  "M31.7 4.4 L39.6 10.2 L42.8 12.5 L45.1 14.1 L49 16.9 L51.8 19 L57.2 22.9 L58 23.7 L57.7 24.8 L53.5 28.7 L51.4 26.9 L45.4 20.4 L41.8 17 L41.4 16.4 L37.5 12.7 L31.1 6.3 L30.6 5.4 L30.8 4.6Z",
  "M4.4 25.6 L12.6 25.6 L13.7 25.9 L14 26.3 L13.3 27.7 L12 28.8 L8.1 33.2 L6.7 34.4 L6 34.7 L4.7 32.5 L4.2 30.8 L3 27.1 L2.9 26Z",
];
const GEM = (cls = "gem") => `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true" fill="currentColor"><path d="M20.9 25.6 L44.8 25.6 L46 26 L50.1 30.4 L50.7 31.6 L48.2 34.6 L40.7 42.6 L38.4 45.1 L36.1 47.7 L34.1 49.9 L33 50.8 L31.1 49.8 L27.2 45.4 L24.7 42.9 L24.4 42.5 L18.4 35.8 L17.8 35.3 L16.8 34.1 L15 32.2 L14.6 31.5 L15.9 29.7 L17.9 27.7 L19.5 25.9Z"/><path d="M12 34.4 L13.3 35.3 L15.7 38.1 L18.4 40.9 L18.5 41.2 L31.6 55.2 L33.4 57.2 L34.2 58.4 L34.1 59.1 L31.4 59.4 L14 59.4 L13.4 58.9 L12 55 L11.7 53.8 L8.1 42.9 L7.4 40.5 L7.2 38.9 L10 36.1 L11.2 34.9Z"/><path d="M58.3 29.9 L58.6 30.4 L57.7 34.1 L56.7 36.6 L55.5 40.8 L53.2 47.9 L50.7 55.2 L49.7 58.3 L49.1 59.2 L41.8 59.4 L39.6 59.1 L36.8 55.8 L35.3 53.9 L36.7 52.1 L39.8 48.7 L45.1 43.1 L47.7 40.1 L49.6 38.3 L53 34.4 L56.3 31.1 L57 30Z"/><path d="M27.5 7.6 L33.3 13.1 L38.4 18.3 L39.8 19.7 L40.9 21.4 L39.2 22.1 L9.4 22.1 L8.7 21.7 L8.7 20.7 L9.8 19.8 L11.1 19 L12.6 17.8 L16.1 15.3 L19 13.3 L21.8 11.1 L25.1 9 L26.6 7.7Z"/><path d="M31.7 4.4 L39.6 10.2 L42.8 12.5 L45.1 14.1 L49 16.9 L51.8 19 L57.2 22.9 L58 23.7 L57.7 24.8 L53.5 28.7 L51.4 26.9 L45.4 20.4 L41.8 17 L41.4 16.4 L37.5 12.7 L31.1 6.3 L30.6 5.4 L30.8 4.6Z"/><path d="M4.4 25.6 L12.6 25.6 L13.7 25.9 L14 26.3 L13.3 27.7 L12 28.8 L8.1 33.2 L6.7 34.4 L6 34.7 L4.7 32.5 L4.2 30.8 L3 27.1 L2.9 26Z"/></svg>`;

const WA_LABEL = { ar: "واتساب", en: "WhatsApp", zh: "WhatsApp" };
const waFab = (lang = "ar") => `<a class="wa-fab" href="https://wa.me/${OFFICE.waPhone}" target="_blank" rel="noopener" aria-label="${esc(WA_LABEL[lang])}">
  <svg viewBox="0 0 24 24"><path d="M.06 24l1.69-6.16A11.87 11.87 0 010 11.93C0 5.35 5.35 0 11.93 0a11.86 11.86 0 018.43 3.49 11.82 11.82 0 013.49 8.44c0 6.57-5.35 11.92-11.93 11.92a11.9 11.9 0 01-5.7-1.45L.06 24zM6.6 20.2l.36.21a9.9 9.9 0 004.97 1.36c5.46 0 9.91-4.44 9.91-9.9a9.85 9.85 0 00-2.9-7.01 9.82 9.82 0 00-7-2.91c-5.47 0-9.91 4.44-9.91 9.9a9.87 9.87 0 001.51 5.26l.24.38-1 3.65 3.82-.94zm11.1-5.63c-.07-.12-.27-.2-.57-.35-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48a9 9 0 01-1.66-2.06c-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.61-.92-2.2-.24-.58-.48-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.42.25-.7.25-1.29.18-1.41z"/></svg>
</a>`;

// --------------------------------------------------------------- اللغات --
// ثلاث لغات: العربية (الأصل، rtl)، والإنجليزية، والصينية المبسّطة. العربية
// على جذر المسار، والأخريان في مجلدين — فلا يتغيّر رابطٌ قائم ولا يُكسر
// شيء أُرسل للعميل.
//
// ما لا يُترجَم، عمداً:
//   • قيم النماذج المخزَّنة. `property_type` يبقى LAND وما شابه، و`city`
//     يبقى نصاً عربياً («الرياض») — لأن api/_rematch.js يطابق على العربية
//     المُطبَّعة. لو خُزّنت "Riyadh" لما طابقت طلباً واحداً. المعروض يُترجم،
//     والمخزَّن لا.
//   • رسالة واتساب التي يبنيها زرّ النموذج: عربية دائماً مهما كانت لغة
//     الصفحة. قارئها هو مكتب العميل والمستشار الذكي، لا زائر الصفحة.
//   • لوحة العمل الداخلية: عربية وحدها. أداة مكتبٍ لا واجهة زائر.
const LOCALES = ["ar", "en", "zh"];
const DIR = { ar: "rtl", en: "ltr", zh: "ltr" };
const HTML_LANG = { ar: "ar", en: "en", zh: "zh-Hans" };
const LANG_LABEL = { ar: "العربية", en: "English", zh: "中文" };

// مجلد اللغة في المسار: العربية بلا مجلد.
const seg = (lang) => (lang === "ar" ? "" : `${lang}/`);
const PATHS = { home: "", request: "request", offer: "offer" };
const url = (lang, key) => `/bluediamond/${seg(lang)}${PATHS[key]}`;

// خطوط جوجل: العربية والإنجليزية تتقاسمان الخطّين المأخوذين من الملف
// التعريفي. الصينية تحتاج محرفاً صينياً — Noto SC — ولا يغني عنها Markazi.
const FONTS = {
  ar: "family=Markazi+Text:wght@500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700",
  en: "family=Markazi+Text:wght@500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700",
  zh: "family=Noto+Serif+SC:wght@600;700&family=Noto+Sans+SC:wght@400;500;700&family=IBM+Plex+Sans+Arabic:wght@400;600",
};

// النصوص. مفاتيحها واحدة في اللغات الثلاث — أي مفتاح ناقص يظهر فوراً
// كـ undefined في الصفحة لا كنصٍّ عربيٍّ في صفحة إنجليزية.
const C = {
  ar: {
    name: "شركة الألماس الأزرق العقارية",
    short: "الألماس الأزرق",
    city: "المملكة العربية السعودية — الرياض",
    ceo: "بندر الأحمد",
    ceoTitle: "مستشار ومحلل عقاري مُرخّص من الهيئة العامة للعقار",
    tagline: "قيمةٌ تُبنى، ومستقبلٌ يُصاغ",
    taglineAlt: "Value Built, Future Shaped",
    heroSub: "شريكك العقاري الموثوق",
    heroLead: "شركة متخصصة في تقديم الخدمات والحلول العقارية المتكاملة، تعمل وفق تراخيص معتمدة من الهيئة العامة للعقار، وتستند إلى خبرة متخصصة ومعرفة عميقة بالسوق العقاري السعودي.",
    nav: { about: "من نحن", services: "خدماتنا", advisory: "الاستشارات", methodology: "منهجيتنا", contact: "تواصل" },
    ctaRequest: "سجّل طلبك العقاري",
    ctaHeader: "سجّل طلبك",
    ctaOffer: "لديك عقار للعرض؟",
    ctaOffer2: "اعرض عقارك علينا",
    footerLinks: "روابط",
    footerContact: "تواصل",
    footerHome: "الرئيسية",
    footerRequest: "تسجيل طلب عقاري",
    footerOffer: "عرض عقار للبيع أو التأجير",
    footerBlurb: "خدمات وحلول عقارية متكاملة وفق تراخيص معتمدة من الهيئة العامة للعقار.",
    legal: "ذات مسؤولية محدودة · السجل التجاري",
    langsLabel: "اللغة",

    about: {
      eyebrow: "من نحن",
      h: "قيمةٌ تُبنى، ومستقبلٌ يُصاغ",
      p1: "نقدم خدماتنا وفق منهجية احترافية تجمع بين التحليل الدقيق والخبرة العملية، لتمكين عملائنا من اتخاذ قرارات عقارية واستثمارية واثقة تحقق قيمة مستدامة.",
      p2: "نؤمن بأن العقار ليس مجرد أصل، بل فرصة تُدار باحتراف، وقيمة تُبنى برؤية، ولذلك نلتزم بتقديم حلول عقارية موثوقة ترتقي بتطلعات عملائنا.",
      altDir: "ltr",
      alt: "Blue Diamond Real Estate is a company specializing in comprehensive real estate services and integrated solutions, operating under licenses approved by the General Real Estate Authority (REGA). We draw on specialized expertise and an in-depth knowledge of the Saudi real estate market.",
      visionH: "رؤيتنا",
      vision: "أن نرسّخ مكانتنا كشريك عقاري موثوق ورائد في المملكة العربية السعودية، من خلال تقديم خدمات وحلول عقارية متكاملة ترتكز على المعرفة المتخصصة وأعلى المعايير المهنية، بما يدعم التنمية العمرانية والاستثمارية.",
      missionH: "رسالتنا",
      mission: "تقديم حلول وخدمات عقارية موثوقة تمكّن عملاءنا من اتخاذ قرارات مدروسة، من خلال الخبرة المتخصصة والتحليل الدقيق والالتزام بأعلى معايير المهنية، بما يحقق قيمة مستدامة ويبني شراكات طويلة الأمد قائمة على الثقة.",
    },
    why: {
      eyebrow: "لماذا نحن",
      h: "فارقٌ حقيقي يجعلنا الخيار الأنسب",
      n1: "٢٠+", t1: "خبرة ميدانية", d1: "خبرة ميدانية ممتدة لأكثر من عشرين عاماً تمنحنا قراءة عميقة لتحوّلات السوق.",
      t2: "تراخيص نظامية", d2: "تراخيصنا النظامية تتيح لنا تقديم خدماتنا وفق أعلى الأطر التنظيمية المعتمدة.",
      t3: "فريق متعدد التخصصات", d3: "استشارات وتحليلات وتسويق عقاري وإدارة أصول، معزَّز بعمق قانوني من محامين مرخصين.",
      close: "في الألماس الأزرق، نُقدّم خدماتنا على أساس الشراكة لا المعاملة، ونبني علاقات قائمة على الثقة والنتائج والمصداقية التي لا تُساوم.",
    },
    valuesH: { eyebrow: "قيمنا", h: "خمس قيم تحكم كل عمل نقوم به" },
    values: [
      ["الريادة", "نضع أنفسنا دائماً في طليعة السوق من خلال تبنّي أفضل الممارسات وتقديم حلول تواكب تطلعات المستقبل."],
      ["الطموح", "نؤمن بأن التطور المستمر أساس النجاح، ونعمل دائماً على تحقيق نتائج تتجاوز التوقعات."],
      ["الابتكار", "نتبنّى مناهج وأدوات تحليلية متجددة، ونوظّف التقنية الحديثة لتقديم حلول عقارية أكثر دقةً وكفاءةً وأعمق أثراً."],
      ["المصداقية", "نبني علاقاتنا على الشفافية والموثوقية والالتزام، بما يعزز ثقة عملائنا وشركائنا."],
      ["الإتقان والجودة", "نلتزم بأعلى معايير الجودة والاحترافية في جميع أعمالنا، لتحقيق أفضل النتائج واستدامة القيمة."],
    ],
    servicesH: {
      eyebrow: "خدماتنا العقارية",
      h: "باقة متكاملة من الخدمات العقارية الاحترافية",
      p: "من خلال فهمنا الدقيق لاحتياجات عملائنا وتطلعاتهم، نطوّر حلولاً عقارية متكاملة تسهم في تعزيز القيمة وتحقيق الأهداف بكفاءة واستدامة.",
    },
    services: [
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
    ],
    advisoryH: { eyebrow: "الاستشارات والتحليل العقاري", h: "ثلاثة محاور رئيسية" },
    advisory: [
      ["دراسات الجدوى وتحليل السوق",
       "دراسات سوقية معمّقة ترصد الاتجاهات والفرص وتقيّم المخاطر، مستندة إلى مؤشرات السوق الحية وقواعد البيانات الرسمية، لتزويد عملائنا بصورة دقيقة وشاملة عن المنتجات والفرص العقارية."],
      ["الهندسة المالية للمشاريع العقارية",
       "تصميم هياكل تمويلية وحلول مالية متخصصة تحقق التوازن بين العائد المستهدف ومستوى المخاطرة المقبول، بما يناسب طبيعة كل عميل وأهدافه الاستراتيجية."],
      ["الاستشارات الاستراتيجية المتخصصة",
       "حلول نوعية مصمّمة خصيصاً لاحتياجات الجهات الحكومية والصناديق الاستثمارية والشركات العائلية والمطورين العقاريين — بعيداً عن النماذج الجاهزة والمقاربات المعيارية."],
    ],
    advisoryNote: ["لطلب دراسة جدوى أو تحليل عقاري أو تقييم، سجّل طلبك من ", "صفحة الطلبات", " واختر «استشارة / دراسة»، ويتواصل معك المستشار لتحديد النطاق والأتعاب."],
    method: {
      eyebrow: "منهجيتنا في التنفيذ والعمل",
      h: "التميّز لا يتحقق بالاجتهاد الفردي وحده",
      p: "نعتمد منهجية تنفيذ متكاملة تجمع بين التخطيط الاستراتيجي والانضباط التشغيلي والرقابة المستمرة، انطلاقاً من إيماننا بأن التميّز يتحقق من خلال منظومة عمل مؤسسية تحكمها معايير واضحة وإجراءات دقيقة. وتُبنى جميع خدماتنا ومشاريعنا على مراحل مدروسة تضمن كفاءة التنفيذ وجودة المخرجات.",
      n: ["١", "٢", "٣"],
      steps: [
        ["الفهم والتحديد", "قراءة الاحتياج بدقة: نوع الأصل، الموقع، المساحة، طبيعة العائد المستهدف، والأفق الزمني."],
        ["التحليل والبحث", "مسح السوق ومطابقة الفرص المتاحة بالمواصفات المطلوبة، مع تقييم المخاطر ومؤشرات القيمة."],
        ["التنفيذ والمتابعة", "إدارة التفاوض وإتمام الصفقة والتوثيق النظامي، مع تقارير دورية حتى الإقفال."],
      ],
    },
    ceoMsg: {
      eyebrow: "رسالة الرئيس التنفيذي",
      p: ["في الألماس الأزرق العقارية نلتزم بصناعة قيمة عقارية مستدامة تسهم في دعم مستهدفات التنمية وتعزيز النمو الاقتصادي في المملكة العربية السعودية. ومن خلال تقديم منظومة متكاملة من الخدمات والحلول العقارية للقطاعين العام والخاص، نحرص على بناء شراكات استراتيجية قائمة على الفهم العميق لاحتياجات عملائنا، وتحويل تطلعاتهم إلى فرص استثمارية وإنجازات ملموسة.",
            "ونستند في ذلك إلى مزيج متكامل من الخبرات المتخصصة والكفاءات الوطنية المتميزة والتقنيات الحديثة والرؤى الاستراتيجية، بما يمكّننا من تقديم حلول عقارية عالية الجودة تتسم بالكفاءة والابتكار والموثوقية.",
            "شكراً لثقتكم، ونتطلع إلى بناء مستقبل عقاري أكثر تميزاً وازدهاراً معاً."],
    },
    contact: {
      eyebrow: "ابدأ شراكتك معنا اليوم",
      h: "نحن هنا لنكون جزءاً من نجاحكم",
      p: "سواء كنتم تبحثون عن استثمار عقاري ذكي، أو تحتاجون إلى إدارة أصول بمعايير مؤسسية، أو تسعون للحصول على استشارة متخصصة تُبنى على معرفة حقيقية — فريق الألماس الأزرق مستعد لخدمتكم.",
      phone: "هاتف / واتساب", email: "البريد الإلكتروني", cr: "السجل التجاري",
    },
    homeMeta: { desc: "شركة متخصصة في الخدمات والحلول العقارية المتكاملة في المملكة العربية السعودية: التسويق العقاري، الوساطة، إدارة الأملاك، توثيق عقود الإيجار، والاستشارات والتحليل العقاري." },
  },

  en: {
    name: "Blue Diamond Real Estate",
    short: "Blue Diamond",
    city: "Riyadh, Kingdom of Saudi Arabia",
    ceo: "Bandar Al-Ahmad",
    ceoTitle: "Licensed Real Estate Advisor & Analyst — General Real Estate Authority (REGA)",
    tagline: "Value Built, Future Shaped",
    taglineAlt: "قيمةٌ تُبنى، ومستقبلٌ يُصاغ",
    heroSub: "Your trusted real estate partner",
    heroLead: "A company specializing in comprehensive real estate services and integrated solutions, operating under licenses approved by the General Real Estate Authority (REGA), and drawing on specialized expertise and an in-depth knowledge of the Saudi real estate market.",
    nav: { about: "About", services: "Services", advisory: "Advisory", methodology: "Methodology", contact: "Contact" },
    ctaRequest: "Submit a property request",
    ctaHeader: "Submit a request",
    ctaOffer: "Have a property to list?",
    ctaOffer2: "List your property with us",
    footerLinks: "Links",
    footerContact: "Contact",
    footerHome: "Home",
    footerRequest: "Submit a property request",
    footerOffer: "List a property for sale or lease",
    footerBlurb: "Comprehensive real estate services and solutions under licenses approved by the General Real Estate Authority.",
    legal: "Limited Liability Company · CR",
    langsLabel: "Language",

    about: {
      eyebrow: "About us",
      h: "Value built, future shaped",
      p1: "We deliver our services through a professional methodology that combines rigorous analysis with practical experience, enabling our clients to make confident real estate and investment decisions that create sustainable value.",
      p2: "We believe property is not merely an asset but an opportunity to be managed professionally and a value to be built with vision — which is why we commit to dependable real estate solutions that rise to our clients' ambitions.",
      altDir: "rtl",
      alt: "شركة الألماس الأزرق العقارية شركة متخصصة في تقديم الخدمات والحلول العقارية المتكاملة، تعمل وفق تراخيص معتمدة من الهيئة العامة للعقار، وتستند إلى خبرة متخصصة ومعرفة عميقة بالسوق العقاري السعودي.",
      visionH: "Our vision",
      vision: "To establish ourselves as a trusted and leading real estate partner in the Kingdom of Saudi Arabia by delivering integrated real estate services and solutions grounded in specialized knowledge and the highest professional standards, in support of urban and investment development.",
      missionH: "Our mission",
      mission: "To provide dependable real estate solutions and services that enable our clients to make well-considered decisions — through specialized expertise, rigorous analysis and a commitment to the highest professional standards — creating sustainable value and building long-term partnerships founded on trust.",
    },
    why: {
      eyebrow: "Why us",
      h: "A real difference that makes us the right choice",
      n1: "20+", t1: "Field experience", d1: "More than twenty years of field experience, giving us a deep reading of how the market shifts.",
      t2: "Regulatory licensing", d2: "Our licences allow us to deliver our services within the highest approved regulatory frameworks.",
      t3: "Multidisciplinary team", d3: "Advisory, analytics, real estate marketing and asset management, reinforced by legal depth from licensed attorneys.",
      close: "At Blue Diamond we serve on the basis of partnership rather than transaction, building relationships on trust, results and credibility that is never compromised.",
    },
    valuesH: { eyebrow: "Our values", h: "Five values that govern everything we do" },
    values: [
      ["Leadership", "We place ourselves at the forefront of the market by adopting best practice and offering solutions that keep pace with what the future demands."],
      ["Ambition", "We believe continuous development is the basis of success, and we work consistently to deliver results that exceed expectations."],
      ["Innovation", "We adopt renewed analytical methods and tools and employ modern technology to deliver real estate solutions that are more precise, more efficient and deeper in impact."],
      ["Credibility", "We build our relationships on transparency, reliability and commitment, strengthening the confidence of our clients and partners."],
      ["Excellence & quality", "We hold to the highest standards of quality and professionalism across all our work, to achieve the best outcomes and sustain value."],
    ],
    servicesH: {
      eyebrow: "Our real estate services",
      h: "An integrated suite of professional real estate services",
      p: "Through a precise understanding of our clients' needs and ambitions, we develop integrated real estate solutions that enhance value and achieve objectives efficiently and sustainably.",
    },
    services: [
      ["Real Estate Marketing", "التسويق العقاري",
       "Integrated marketing solutions built on considered strategy and advanced digital tools to reach target segments with high efficiency. We rely on data analysis, market indicators and client behaviour to design campaigns that raise sale and lease rates, with periodic performance reports that let the client measure the return on their marketing investment."],
      ["Real Estate Brokerage", "الوساطة العقارية",
       "Comprehensive brokerage services in sale, purchase and lease, grounded in specialized market experience and a deep understanding of real estate variables. We connect clients with opportunities suited to their investment and operational goals, and manage negotiation and closing to the highest standards of professionalism and transparency."],
      ["Property Management", "إدارة الأملاك العقارية",
       "Management aimed at maximizing investment return and preserving the long-term market value of assets: marketing and leasing, contract preparation and administration, tenant relations, and oversight of preventive and corrective maintenance — alongside a financial and administrative framework covering rent collection, obligation tracking and periodic owner reporting."],
      ["Lease Contract Documentation", "توثيق عقود الإيجار",
       "Documentation of lease contracts through the Ejar platform as an accredited real estate broker, following integrated digital procedures that combine efficiency, compliance and reliability, ensuring contracts meet approved regulatory requirements and preserve the rights of all parties."],
      ["Real Estate Consulting & Analytics", "الاستشارات والتحليل العقاري",
       "Feasibility studies and market analysis, financial structuring for real estate projects, and specialized strategic advisory — built on live market indicators and official databases."],
    ],
    advisoryH: { eyebrow: "Real estate advisory & analytics", h: "Three principal tracks" },
    advisory: [
      ["Feasibility studies & market analysis",
       "In-depth market studies that track trends and opportunities and assess risk, drawing on live market indicators and official databases, to give our clients a precise and complete picture of real estate products and opportunities."],
      ["Financial structuring for real estate projects",
       "Design of financing structures and specialized financial solutions that balance target return against an acceptable level of risk, suited to the nature and strategic goals of each client."],
      ["Specialized strategic advisory",
       "Bespoke solutions designed for the needs of government entities, investment funds, family businesses and real estate developers — away from off-the-shelf models and standard approaches."],
    ],
    advisoryNote: ["To request a feasibility study, a real estate analysis or a valuation, submit your request from the ", "request page", " and select “Advisory / study”. An advisor will contact you to agree scope and fees."],
    method: {
      eyebrow: "Our delivery methodology",
      h: "Excellence is not achieved by individual effort alone",
      p: "We follow an integrated delivery methodology that combines strategic planning, operational discipline and continuous oversight, in the conviction that excellence is achieved through an institutional system governed by clear standards and precise procedures. All our services and projects are built on considered stages that ensure delivery efficiency and output quality.",
      n: ["1", "2", "3"],
      steps: [
        ["Understand & define", "Reading the requirement precisely: asset type, location, area, the nature of the target return, and the time horizon."],
        ["Analyze & research", "Scanning the market and matching available opportunities to the required specification, with risk assessment and value indicators."],
        ["Execute & follow through", "Managing negotiation, closing and statutory documentation, with periodic reporting until completion."],
      ],
    },
    ceoMsg: {
      eyebrow: "Message from the CEO",
      p: ["At Blue Diamond Real Estate we are committed to creating sustainable real estate value that supports development targets and strengthens economic growth in the Kingdom of Saudi Arabia. By offering an integrated system of real estate services and solutions to the public and private sectors, we work to build strategic partnerships founded on a deep understanding of our clients' needs, turning their ambitions into investment opportunities and tangible achievements.",
            "In this we draw on an integrated blend of specialized expertise, distinguished national talent, modern technology and strategic insight, enabling us to deliver high-quality real estate solutions marked by efficiency, innovation and reliability.",
            "Thank you for your trust. We look forward to building a more distinguished and prosperous real estate future together."],
    },
    contact: {
      eyebrow: "Begin your partnership with us today",
      h: "We are here to be part of your success",
      p: "Whether you are looking for a smart real estate investment, need asset management to institutional standards, or are seeking specialized advice built on genuine knowledge — the Blue Diamond team is ready to serve you.",
      phone: "Phone / WhatsApp", email: "Email", cr: "Commercial registration",
    },
    homeMeta: { desc: "A company specializing in integrated real estate services and solutions in Saudi Arabia: real estate marketing, brokerage, property management, lease documentation, and real estate advisory and analytics." },
  },

  zh: {
    name: "蓝钻房地产有限公司",
    short: "蓝钻房地产",
    city: "沙特阿拉伯王国 · 利雅得",
    ceo: "班达尔·艾哈迈德",
    ceoTitle: "沙特房地产总局（REGA）持牌房地产顾问与分析师",
    tagline: "筑就价值，塑造未来",
    taglineAlt: "Value Built, Future Shaped",
    heroSub: "您值得信赖的房地产伙伴",
    heroLead: "我们是一家专注于综合房地产服务与整体解决方案的公司，持有沙特房地产总局（REGA）核准的牌照，依托专业经验与对沙特房地产市场的深入了解开展业务。",
    nav: { about: "关于我们", services: "服务", advisory: "咨询与分析", methodology: "工作方法", contact: "联系我们" },
    ctaRequest: "提交房产需求",
    ctaHeader: "提交需求",
    ctaOffer: "有房产要挂牌？",
    ctaOffer2: "向我们挂牌房产",
    footerLinks: "链接",
    footerContact: "联系方式",
    footerHome: "首页",
    footerRequest: "提交房产需求",
    footerOffer: "挂牌出售或出租房产",
    footerBlurb: "在沙特房地产总局核准的牌照下提供综合房地产服务与解决方案。",
    legal: "有限责任公司 · 商业登记号",
    langsLabel: "语言",

    about: {
      eyebrow: "关于我们",
      h: "筑就价值，塑造未来",
      p1: "我们以严谨分析与实务经验相结合的专业方法提供服务，帮助客户做出稳健的房地产与投资决策，创造可持续的价值。",
      p2: "我们相信，房地产不只是一项资产，而是需要专业运营的机会、需要远见构筑的价值。因此，我们坚持提供与客户期望相称的可靠房地产解决方案。",
      altDir: "ltr",
      alt: "Blue Diamond Real Estate is a company specializing in comprehensive real estate services and integrated solutions, operating under licenses approved by the General Real Estate Authority (REGA). We draw on specialized expertise and an in-depth knowledge of the Saudi real estate market.",
      visionH: "我们的愿景",
      vision: "通过提供以专业知识和最高职业标准为基础的综合房地产服务与解决方案，确立我们在沙特阿拉伯王国值得信赖的领先房地产伙伴地位，助力城市建设与投资发展。",
      missionH: "我们的使命",
      mission: "以专业经验、严谨分析和对最高职业标准的坚守，提供可靠的房地产解决方案与服务，使客户能够做出深思熟虑的决策，创造可持续价值，并建立以信任为基础的长期合作关系。",
    },
    why: {
      eyebrow: "为什么选择我们",
      h: "让我们成为合适之选的真正差别",
      n1: "20+", t1: "实地经验", d1: "逾二十年的实地经验，使我们能够深入解读市场的变化。",
      t2: "合规牌照", d2: "我们持有的法定牌照，使各项服务均在最高等级的监管框架内开展。",
      t3: "跨专业团队", d3: "涵盖咨询、分析、房地产营销与资产管理，并由持牌律师提供法律层面的支持。",
      close: "在蓝钻，我们以合作而非交易的方式提供服务，以信任、成果和绝不妥协的诚信建立关系。",
    },
    valuesH: { eyebrow: "我们的价值观", h: "支配我们全部工作的五项价值观" },
    values: [
      ["引领", "我们始终以最佳实践立于市场前沿，提供顺应未来需求的解决方案。"],
      ["进取", "我们相信持续进步是成功的基础，并始终致力于实现超出预期的成果。"],
      ["创新", "我们不断更新分析方法与工具，并运用现代技术提供更精准、更高效、影响更深远的房地产解决方案。"],
      ["诚信", "我们以透明、可靠与守诺构建关系，增强客户与伙伴的信任。"],
      ["精工与品质", "我们在全部工作中恪守最高的质量与专业标准，以取得最佳成果并使价值得以持续。"],
    ],
    servicesH: {
      eyebrow: "我们的房地产服务",
      h: "一套完整的专业房地产服务",
      p: "基于对客户需求与期望的准确理解，我们开发整体房地产解决方案，高效而可持续地提升价值、实现目标。",
    },
    services: [
      ["房地产营销", "Real Estate Marketing",
       "以周密策略与先进数字工具为基础的整合营销方案，高效触达目标客群。我们依据数据分析、市场指标与客户行为设计营销活动，提高销售与租赁转化，并提供定期绩效报告，使客户能够衡量营销投入的回报。"],
      ["房地产经纪", "Real Estate Brokerage",
       "涵盖买卖与租赁的全流程经纪服务，依托专业市场经验与对房地产变量的深入理解。我们为客户对接契合其投资与运营目标的机会，并以最高的专业与透明标准推进谈判与成交。"],
      ["物业与资产管理", "Property Management",
       "以实现投资回报最大化、长期保有资产市场价值为目标的管理服务：营销与租赁、合同的编制与管理、租户关系，以及预防性与纠正性维护的监督；并配套财务与行政体系，涵盖租金收取、义务跟踪与向业主定期报告。"],
      ["租赁合同备案（Ejar）", "Lease Contract Documentation",
       "作为认证房地产经纪机构，通过 Ejar 平台完成租赁合同备案。流程完全数字化，兼顾效率、合规与可靠性，确保合同符合核准的法定要求并保障各方权益。"],
      ["房地产咨询与分析", "Real Estate Consulting & Analytics",
       "可行性研究与市场分析、房地产项目财务架构设计，以及定制化战略咨询——均建立在实时市场指标与官方数据库之上。"],
    ],
    advisoryH: { eyebrow: "房地产咨询与分析", h: "三条主线" },
    advisory: [
      ["可行性研究与市场分析",
       "深入的市场研究，追踪趋势与机会并评估风险，依托实时市场指标与官方数据库，为客户呈现关于房地产产品与机会的精确而完整的图景。"],
      ["房地产项目财务架构设计",
       "设计融资结构与专项财务方案，在目标回报与可接受风险水平之间取得平衡，契合每位客户的具体情况与战略目标。"],
      ["定制化战略咨询",
       "为政府机构、投资基金、家族企业与房地产开发商量身设计的解决方案——摒弃现成模板与标准化做法。"],
    ],
    advisoryNote: ["如需可行性研究、房地产分析或估值，请在", "需求登记页", "提交需求并选择「咨询 / 研究」，顾问将与您联系以确定范围与费用。"],
    method: {
      eyebrow: "我们的执行方法",
      h: "卓越并非仅凭个人努力即可达成",
      p: "我们采用整合式执行方法，将战略规划、运营纪律与持续监督结合起来。我们相信，卓越来自一套由明确标准与严密流程所支配的机构化工作体系。我们的全部服务与项目均按经过设计的阶段推进，以确保执行效率与交付质量。",
      n: ["1", "2", "3"],
      steps: [
        ["理解与界定", "准确读取需求：资产类型、位置、面积、目标回报的性质，以及时间跨度。"],
        ["分析与调研", "扫描市场，将可得机会与所需规格逐一匹配，并评估风险与价值指标。"],
        ["执行与跟进", "管理谈判、成交与法定备案，并定期汇报直至结案。"],
      ],
    },
    ceoMsg: {
      eyebrow: "首席执行官致辞",
      p: ["在蓝钻房地产，我们致力于创造可持续的房地产价值，支持沙特阿拉伯王国的发展目标并促进经济增长。通过向公共与私营部门提供整合的房地产服务与解决方案体系，我们努力建立以深入理解客户需求为基础的战略合作关系，将客户的期望转化为投资机会与切实成果。",
            "为此，我们依托专业经验、优秀的本国人才、现代技术与战略洞察的有机结合，从而提供高效、创新、可靠的高质量房地产解决方案。",
            "感谢您的信任。我们期待与您共同构建更加卓越、更加繁荣的房地产未来。"],
    },
    contact: {
      eyebrow: "今天就开始与我们合作",
      h: "我们愿成为您成功的一部分",
      p: "无论您是在寻找明智的房地产投资、需要符合机构标准的资产管理，还是希望获得建立在真实认知之上的专业咨询——蓝钻团队随时为您服务。",
      phone: "电话 / WhatsApp", email: "电子邮箱", cr: "商业登记号",
    },
    homeMeta: { desc: "在沙特阿拉伯提供综合房地产服务与解决方案的专业公司：房地产营销、经纪、物业管理、租赁合同备案，以及房地产咨询与分析。" },
  },
};

// نصوص النموذجين. القيم المخزَّنة (المفتاح الأول في كل زوج) لا تُترجَم أبداً
// — انظر التعليق أعلى `C`.
const TYPE_OPTIONS = [
  ["LAND", { ar: "أرض خام", en: "Raw land", zh: "生地" }],
  ["RESIDENTIAL_BUILDING", { ar: "عمارة سكنية", en: "Residential building", zh: "住宅楼" }],
  ["COMMERCIAL_BUILDING", { ar: "مبنى تجاري", en: "Commercial building", zh: "商业楼" }],
  ["VILLA", { ar: "فيلا", en: "Villa", zh: "别墅" }],
  ["APARTMENT", { ar: "شقة", en: "Apartment", zh: "公寓" }],
  ["SHOWROOM", { ar: "معرض / محل", en: "Showroom / retail unit", zh: "展厅 / 商铺" }],
  ["WAREHOUSE", { ar: "مستودع", en: "Warehouse", zh: "仓库" }],
  ["TOWER", { ar: "برج", en: "Tower", zh: "塔楼" }],
  ["HOTEL", { ar: "فندق / شقق فندقية", en: "Hotel / serviced apartments", zh: "酒店 / 服务式公寓" }],
  ["FARM", { ar: "مزرعة / استراحة", en: "Farm / rest house", zh: "农场 / 休闲庄园" }],
  ["COMPOUND", { ar: "مجمع سكني مغلق", en: "Gated compound", zh: "封闭式住宅小区" }],
  ["OFFICE", { ar: "مكتب", en: "Office", zh: "办公室" }],
  ["MIXED", { ar: "استخدام مختلط", en: "Mixed use", zh: "综合用途" }],
];

// القيمة المخزَّنة عربية عمداً: `api/_rematch.js` يطابق المدينة على العربية
// المُطبَّعة، فلو خُزّنت "Riyadh" لما طابقت طلباً واحداً.
const CITY_OPTIONS = [
  ["الرياض", { ar: "الرياض", en: "Riyadh", zh: "利雅得" }],
  ["جدة", { ar: "جدة", en: "Jeddah", zh: "吉达" }],
  ["مكة المكرمة", { ar: "مكة المكرمة", en: "Makkah", zh: "麦加" }],
  ["المدينة المنورة", { ar: "المدينة المنورة", en: "Madinah", zh: "麦地那" }],
  ["الدمام", { ar: "الدمام", en: "Dammam", zh: "达曼" }],
  ["الخبر", { ar: "الخبر", en: "Khobar", zh: "胡拜尔" }],
  ["الظهران", { ar: "الظهران", en: "Dhahran", zh: "宰赫兰" }],
  ["الأحساء", { ar: "الأحساء", en: "Al-Ahsa", zh: "艾赫萨" }],
  ["القصيم", { ar: "القصيم", en: "Qassim", zh: "卡西姆" }],
  ["الطائف", { ar: "الطائف", en: "Taif", zh: "塔伊夫" }],
  ["أبها", { ar: "أبها", en: "Abha", zh: "艾卜哈" }],
  ["تبوك", { ar: "تبوك", en: "Tabuk", zh: "塔布克" }],
  ["حائل", { ar: "حائل", en: "Hail", zh: "哈伊勒" }],
  ["نجران", { ar: "نجران", en: "Najran", zh: "奈季兰" }],
  ["جازان", { ar: "جازان", en: "Jazan", zh: "吉赞" }],
  ["ينبع", { ar: "ينبع", en: "Yanbu", zh: "延布" }],
  ["الجبيل", { ar: "الجبيل", en: "Jubail", zh: "朱拜勒" }],
  ["نيوم", { ar: "نيوم", en: "NEOM", zh: "NEOM 新未来城" }],
];

const DEED_OPTIONS = [
  ["صك إلكتروني", { ar: "صك إلكتروني", en: "Electronic title deed", zh: "电子产权证" }],
  ["صك زراعي", { ar: "صك زراعي", en: "Agricultural deed", zh: "农业用地产权证" }],
  ["منحة", { ar: "منحة", en: "Grant land", zh: "政府授地" }],
  ["حجة استحكام", { ar: "حجة استحكام", en: "Possession instrument", zh: "占有权证明" }],
];

const F = {
  ar: {
    req: {
      eyebrow: "تسجيل طلب عقاري",
      h: "اكتب لنا ما تبحث عنه بالضبط",
      p: "كلما دقّت المواصفات، دقّت المطابقة. الحقول المطلوبة أربعة فقط، والباقي يحسّن ترتيب ما نرسله لك.",
      submit: "أرسل الطلب", wa: "أرسل طلبي على واتساب",
      consent: (s) => `بإرسال الطلب توافق على تواصل فريق ${s} معك عبر الجوال أو واتساب بخصوص طلبك.`,
      title: "تسجيل طلب عقاري",
      desc: "سجّل طلبك العقاري: نوع العقار، المدينة، المساحة، الميزانية، ومدى الحاجة إلى عقار مدر للدخل — ونطابقه على المعروض في السوق.",
    },
    off: {
      eyebrow: "عرض عقار",
      h: "لديك عقار للبيع أو التأجير؟",
      p: "سجّل العرض هنا ليدخل مباشرة في مطابقة الطلبات القائمة لدينا. إن طابق طلباً مفتوحاً، يتواصل معك المستشار في حينه.",
      submit: "أرسل العرض", wa: "أرسل العرض على واتساب",
      consent: "كل عرض يصلنا يُسجَّل «غير موثّق» حتى يتحقق فريقنا من المالك والصك — ولا يُعرض على عميل قبل ذلك.",
      title: "اعرض عقارك",
      desc: "سجّل عرضك العقاري (بيع أو تأجير) ليدخل مباشرة في مطابقة الطلبات القائمة لدى الألماس الأزرق العقارية.",
    },
    name: "الاسم", phone: "رقم الجوال (واتساب)", phonePh: "05xxxxxxxx",
    ptype: "نوع العقار", pickType: "اختر النوع",
    city: "المدينة", pickCity: "اختر المدينة",
    districts: "الأحياء أو الاتجاهات المفضّلة", districtsPh: "مثال: شمال، الملقا، النرجس",
    districtsHint: "تُرجّح ولا تُقصي — العرض الممتاز خارجها يصلك مع تنبيه بأن موقعه ليس ما طلبته.",
    purpose: "الغرض",
    purposeOpts: [["BUY", "شراء"], ["INVEST", "استثمار"], ["RENT", "استئجار"], ["DEVELOP", "تطوير"]],
    incomeQ: "مدر للدخل؟",
    incomeQOpts: [["", "لا يفرق"], ["true", "نعم — مؤجر بعقود قائمة"], ["false", "لا — شاغر / خام"]],
    areaFrom: "المساحة من (م²)", areaTo: "إلى (م²)",
    budgetFrom: "الميزانية من (ريال)", budgetTo: "إلى (ريال)",
    yield: "العائد السنوي المستهدف %", yieldPh: "مثال: 7",
    timeline: "الجاهزية",
    timelineOpts: [["", "غير محدد"], ["IMMEDIATE", "فوري"], ["3M", "خلال ٣ أشهر"], ["6M", "خلال ٦ أشهر"], ["12M", "خلال سنة"]],
    notes: "تفاصيل إضافية", notesPh: "اكتب بطريقتك: نوع الصك، الواجهة، التمويل، أو أي شرط يهمّك.",
    role: "صفتك",
    roleOpts: [["MARKETER", "مسوّق عقاري"], ["OWNER", "مالك"], ["DEVELOPER", "مطوّر عقاري"], ["BROKER", "وسيط"]],
    company: "المنشأة",
    offerKind: "نوع العرض",
    offerKindOpts: [["SALE", "للبيع"], ["RENT", "للإيجار"], ["INVESTMENT", "فرصة استثمارية"]],
    district: "الحي",
    area: "المساحة (م²)", price: "السعر المطلوب (ريال)",
    income: "الدخل السنوي (ريال)", incomeHint: "للعقار المؤجَّر — يُحسب منه العائد تلقائياً.",
    occupancy: "حالة الإشغال",
    occupancyOpts: [["", "غير محدد"], ["true", "مؤجَّر / مدر للدخل"], ["false", "شاغر / خام"]],
    deed: "نوع الصك", deedNone: "غير محدد",
    mapUrl: "رابط الموقع على الخريطة",
    offerDesc: "وصف العرض", offerDescPh: "الواجهة، الشوارع، عدد الوحدات، عمر المبنى، أو أي تفصيل يهم المشتري.",
  },

  en: {
    req: {
      eyebrow: "Submit a property request",
      h: "Tell us exactly what you are looking for",
      p: "The more precise the specification, the more precise the match. Only four fields are required; the rest improve the ranking of what we send you.",
      submit: "Send request", wa: "Send my request on WhatsApp",
      consent: (s) => `By sending this request you agree that the ${s} team may contact you by phone or WhatsApp about it.`,
      title: "Submit a property request",
      desc: "Register your property requirement — type, city, area, budget, and whether it must be income-producing — and we will match it against what the market is offering.",
    },
    off: {
      eyebrow: "List a property",
      h: "Have a property for sale or lease?",
      p: "Register it here and it enters the matching pool against our open requests straight away. If it matches an open request, an advisor will contact you at that point.",
      submit: "Send listing", wa: "Send listing on WhatsApp",
      consent: "Every listing we receive is recorded as “unverified” until our team confirms the owner and the title deed — and it is not shown to any client before that.",
      title: "List your property",
      desc: "Register your property listing (sale or lease) so it enters matching against the open requests held by Blue Diamond Real Estate.",
    },
    name: "Name", phone: "Mobile number (WhatsApp)", phonePh: "05xxxxxxxx",
    ptype: "Property type", pickType: "Select a type",
    city: "City", pickCity: "Select a city",
    districts: "Preferred districts or directions", districtsPh: "e.g. north, Al-Malqa, Al-Narjis",
    districtsHint: "These weight the ranking, they do not exclude — an outstanding listing elsewhere still reaches you, flagged as outside the location you asked for.",
    purpose: "Purpose",
    purposeOpts: [["BUY", "Purchase"], ["INVEST", "Investment"], ["RENT", "Lease"], ["DEVELOP", "Development"]],
    incomeQ: "Income-producing?",
    incomeQOpts: [["", "No preference"], ["true", "Yes — leased under active contracts"], ["false", "No — vacant / raw"]],
    areaFrom: "Area from (m²)", areaTo: "to (m²)",
    budgetFrom: "Budget from (SAR)", budgetTo: "to (SAR)",
    yield: "Target annual yield %", yieldPh: "e.g. 7",
    timeline: "Readiness",
    timelineOpts: [["", "Unspecified"], ["IMMEDIATE", "Immediate"], ["3M", "Within 3 months"], ["6M", "Within 6 months"], ["12M", "Within a year"]],
    notes: "Additional detail", notesPh: "In your own words: deed type, frontage, financing, or any condition that matters to you.",
    role: "Your capacity",
    roleOpts: [["MARKETER", "Property marketer"], ["OWNER", "Owner"], ["DEVELOPER", "Developer"], ["BROKER", "Broker"]],
    company: "Company",
    offerKind: "Listing type",
    offerKindOpts: [["SALE", "For sale"], ["RENT", "For lease"], ["INVESTMENT", "Investment opportunity"]],
    district: "District",
    area: "Area (m²)", price: "Asking price (SAR)",
    income: "Annual income (SAR)", incomeHint: "For a leased property — the yield is calculated from it automatically.",
    occupancy: "Occupancy",
    occupancyOpts: [["", "Unspecified"], ["true", "Leased / income-producing"], ["false", "Vacant / raw"]],
    deed: "Deed type", deedNone: "Unspecified",
    mapUrl: "Map location link",
    offerDesc: "Listing description", offerDescPh: "Frontage, streets, number of units, building age, or any detail that matters to a buyer.",
  },

  zh: {
    req: {
      eyebrow: "提交房产需求",
      h: "请准确告诉我们您在寻找什么",
      p: "条件越明确，匹配越精准。必填项仅四个，其余信息用于优化我们推送给您的排序。",
      submit: "提交需求", wa: "通过 WhatsApp 发送需求",
      consent: (s) => `提交即表示您同意${s}团队通过电话或 WhatsApp 就此需求与您联系。`,
      title: "提交房产需求",
      desc: "登记您的房产需求——类型、城市、面积、预算，以及是否需要产生租金收益——我们将与市场在售房源进行匹配。",
    },
    off: {
      eyebrow: "挂牌房产",
      h: "有房产要出售或出租？",
      p: "在此登记，房源将立即进入与我们现有需求的匹配池。一旦与某项未成交需求匹配，顾问会在当时与您联系。",
      submit: "提交房源", wa: "通过 WhatsApp 发送房源",
      consent: "我们收到的每一条房源在团队核实业主与产权证之前，均记录为「未核实」，在此之前不会向任何客户展示。",
      title: "挂牌您的房产",
      desc: "登记您的房源（出售或出租），使其进入与蓝钻房地产现有需求的匹配流程。",
    },
    name: "姓名", phone: "手机号（WhatsApp）", phonePh: "05xxxxxxxx",
    ptype: "房产类型", pickType: "请选择类型",
    city: "城市", pickCity: "请选择城市",
    districts: "意向区域或方位", districtsPh: "例如：北区、Al-Malqa、Al-Narjis",
    districtsHint: "这些条件用于加权排序，而非排除——区域之外的优质房源仍会推送给您，并注明其位置与您所指定的不符。",
    purpose: "用途",
    purposeOpts: [["BUY", "购买"], ["INVEST", "投资"], ["RENT", "承租"], ["DEVELOP", "开发"]],
    incomeQ: "是否需产生租金收益？",
    incomeQOpts: [["", "均可"], ["true", "是——已签约出租"], ["false", "否——空置 / 生地"]],
    areaFrom: "面积下限（平方米）", areaTo: "上限（平方米）",
    budgetFrom: "预算下限（沙特里亚尔）", budgetTo: "上限（沙特里亚尔）",
    yield: "目标年化收益率 %", yieldPh: "例如：7",
    timeline: "时间安排",
    timelineOpts: [["", "未确定"], ["IMMEDIATE", "立即"], ["3M", "3 个月内"], ["6M", "6 个月内"], ["12M", "一年内"]],
    notes: "补充说明", notesPh: "请按您的习惯填写：产权证类型、临街面、融资安排，或任何您在意的条件。",
    role: "您的身份",
    roleOpts: [["MARKETER", "房产营销方"], ["OWNER", "业主"], ["DEVELOPER", "开发商"], ["BROKER", "经纪人"]],
    company: "所属机构",
    offerKind: "挂牌类型",
    offerKindOpts: [["SALE", "出售"], ["RENT", "出租"], ["INVESTMENT", "投资机会"]],
    district: "所在区域",
    area: "面积（平方米）", price: "要价（沙特里亚尔）",
    income: "年收入（沙特里亚尔）", incomeHint: "适用于已出租房产——收益率将据此自动计算。",
    occupancy: "使用状态",
    occupancyOpts: [["", "未确定"], ["true", "已出租 / 产生收益"], ["false", "空置 / 生地"]],
    deed: "产权证类型", deedNone: "未确定",
    mapUrl: "地图位置链接",
    offerDesc: "房源描述", offerDescPh: "临街面、道路、单元数量、楼龄，或任何买家关心的细节。",
  },
};

// رسائل السكربت. تُحقن في الصفحة كـ JS، ولذلك تُكتب كنصٍّ مصدري لا ككائن
// — فيها دوال تبني جملة العدد، والعربية فيها مثنّى وجمعان.
const JSMSG = {
  ar: `const T={sending:'جارٍ الإرسال…',
  pickFirst:'اختر نوع العقار والمدينة أولاً.',
  failReq:'تعذّر إرسال الطلب الآن. جرّب زر واتساب بالأسفل ويصلنا طلبك مباشرة.',
  failOff:'تعذّر إرسال العرض الآن. جرّب زر واتساب ويصلنا مباشرة.',
  netReq:'تعذّر الاتصال. استخدم زر واتساب ويصلنا طلبك مباشرة.',
  netOff:'تعذّر الاتصال. استخدم زر واتساب ويصلنا العرض مباشرة.',
  okReq:(r,m)=>'وصلنا طلبك ✅ رقمه '+r+(m?('، ولدينا '+(m===1?'عرض واحد':m===2?'عرضان':m<=10?m+' عروض':m+' عرضاً')+' مبدئياً يطابقه — يراجعه المستشار ويتواصل معك.'):'، ويتواصل معك المستشار قريباً.'),
  okOff:(r,m)=>'وصلنا عرضك ✅ رقمه '+r+(m?('، ويطابق '+(m===1?'طلباً واحداً':m===2?'طلبين':m<=10?m+' طلبات':m+' طلباً')+' قائماً لدينا — يتواصل معك المستشار.'):'، وهو الآن ضمن مخزوننا ونرجع لك عند أول طلب يناسبه.')};`,
  en: `const T={sending:'Sending…',
  pickFirst:'Select a property type and a city first.',
  failReq:'The request could not be sent right now. Use the WhatsApp button below and it reaches us directly.',
  failOff:'The listing could not be sent right now. Use the WhatsApp button and it reaches us directly.',
  netReq:'Connection failed. Use the WhatsApp button and your request reaches us directly.',
  netOff:'Connection failed. Use the WhatsApp button and your listing reaches us directly.',
  okReq:(r,m)=>'We have your request ✅ Reference '+r+(m?('. We already hold '+(m===1?'one listing':m+' listings')+' that provisionally match it — an advisor will review and contact you.'):'. An advisor will be in touch shortly.'),
  okOff:(r,m)=>'We have your listing ✅ Reference '+r+(m?('. It matches '+(m===1?'one open request':m+' open requests')+' on our books — an advisor will contact you.'):'. It is now in our inventory and we will come back to you with the first suitable request.')};`,
  zh: `const T={sending:'提交中…',
  pickFirst:'请先选择房产类型和城市。',
  failReq:'暂时无法提交需求。请使用下方的 WhatsApp 按钮，需求会直接送达我们。',
  failOff:'暂时无法提交房源。请使用 WhatsApp 按钮，房源会直接送达我们。',
  netReq:'连接失败。请使用 WhatsApp 按钮，需求会直接送达我们。',
  netOff:'连接失败。请使用 WhatsApp 按钮，房源会直接送达我们。',
  okReq:(r,m)=>'已收到您的需求 ✅ 编号 '+r+(m?('。我们现有 '+m+' 条房源与之初步匹配——顾问将复核后与您联系。'):'。顾问将尽快与您联系。'),
  okOff:(r,m)=>'已收到您的房源 ✅ 编号 '+r+(m?('。它与我们现有的 '+m+' 条需求匹配——顾问将与您联系。'):'。房源已进入我们的库存，一旦出现合适的需求我们会与您联系。')};`,
};
// الموقع كله غير مفهرس ما دام يُعرض على العميل قبل اعتماده. صفحة تُعرض
// للمراجعة ثم تظهر في نتائج البحث باسم الشركة قبل أن يوافق صاحبها عليها
// ضررٌ لا يُستدرك — ولذلك `indexable` افتراضه false، ويُقلب صراحةً يوم
// يُطلق الموقع على نطاقه.
//
// ولم يُكتب `Disallow: /bluediamond/` في robots.txt عمداً: ذلك الملف
// عامّ يقرأه أي أحد، فيصير إعلاناً عن المسار الذي نريد إخفاءه. الإخفاء
// هنا = noindex + لا رابط وارد + غياب عن خريطة الموقع.
// ------------------------------------------------------------- الصفحة --
// `indexable` افتراضه false — انظر تعليق ما قبله. و`key` يحدّد الصفحة
// المناظرة في اللغتين الأخريين؛ لوحة العمل لا تمرّره فلا يظهر لها مبدّل.
function page({ lang = "ar", key = "", title, desc, body, nav = true, extraHead = "", script = "", indexable = false }) {
  const alts = key
    ? LOCALES.map((l) => `<link rel="alternate" hreflang="${HTML_LANG[l]}" href="${url(l, key)}">`).join("\n")
      + `\n<link rel="alternate" hreflang="x-default" href="${url("ar", key)}">`
    : "";
  return `<!doctype html>
<html lang="${HTML_LANG[lang]}" dir="${DIR[lang]}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${indexable ? "" : '<meta name="robots" content="noindex,nofollow">\n'}<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="${HTML_LANG[lang]}">
${alts}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${FONTS[lang]}&display=swap">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="#252159">'
  + MARK_PATHS.map((d) => `<path d="${d}"/>`).join("") + "</svg>")}">
<style>${CSS}</style>
${extraHead}
</head>
<body>
${nav ? header(lang, key) : ""}
${body}
${footer(lang)}
${waFab(lang)}
${script ? `<script>${script}</script>` : ""}
</body>
</html>`;
}

// مبدّل اللغة. خارج <nav> عمداً: النڤ يختفي تحت ٩٠٠ بكسل، واللغة لا تختفي.
const langs = (lang, key) => `<div class="langs" role="group" aria-label="${esc(C[lang].langsLabel)}">`
  + LOCALES.map((l) => `<a href="${url(l, key)}" lang="${HTML_LANG[l]}" hreflang="${HTML_LANG[l]}"`
      + `${l === lang ? ' aria-current="page"' : ""}>${esc(LANG_LABEL[l])}</a>`).join("")
  + `</div>`;

const header = (lang = "ar", key = "") => {
  const L = C[lang];
  return `<header class="bd"><div class="wrap bar">
  <a class="brand" href="${url(lang, "home")}">${GEM()}<span>${esc(L.short)}</span></a>
  <nav class="bd">
    <a href="${url(lang, "home")}#about">${esc(L.nav.about)}</a>
    <a href="${url(lang, "home")}#services">${esc(L.nav.services)}</a>
    <a href="${url(lang, "home")}#advisory">${esc(L.nav.advisory)}</a>
    <a href="${url(lang, "home")}#methodology">${esc(L.nav.methodology)}</a>
    <a href="${url(lang, "home")}#contact">${esc(L.nav.contact)}</a>
  </nav>
  ${key ? langs(lang, key) : ""}
  <a class="btn btn-primary" href="${url(lang, "request")}">${esc(L.ctaHeader)}</a>
</div></header>`;
};

const footer = (lang = "ar") => {
  const L = C[lang];
  return `<footer class="bd"><span class="lattice" aria-hidden="true"></span><div class="wrap">
  <div class="cols">
    <div>
      <div class="brand" style="color:#fff">${GEM()}<span>${esc(L.name)}</span></div>
      <p style="color:#B6B3CC;margin-top:12px">${esc(L.tagline)} — ${esc(L.footerBlurb)}</p>
    </div>
    <div>
      <h3 style="color:#fff;font-size:15px">${esc(L.footerLinks)}</h3>
      <p><a href="${url(lang, "home")}">${esc(L.footerHome)}</a><br>
         <a href="${url(lang, "request")}">${esc(L.footerRequest)}</a><br>
         <a href="${url(lang, "offer")}">${esc(L.footerOffer)}</a></p>
    </div>
    <div>
      <h3 style="color:#fff;font-size:15px">${esc(L.footerContact)}</h3>
      <p><a href="tel:${OFFICE.phone}"><bdi dir="ltr">${esc(OFFICE.phone)}</bdi></a><br>
         <a href="mailto:${OFFICE.email}">${esc(OFFICE.email)}</a><br>
         ${esc(L.city)}</p>
    </div>
  </div>
  <div class="fine">
    <span>${esc(L.name)} — ${esc(L.legal)} ${esc(OFFICE.cr)}</span>
    <span>${esc(OFFICE.nameEn)} · ${esc(OFFICE.site)}</span>
  </div>
</div></footer>`;
};

// -------------------------------------------------------- الصفحة الرئيسية --
function home(lang = "ar") {
  const L = C[lang];
  const body = `
<div class="hero"><div class="wrap hero-grid">
  <div>
    <span class="eyebrow">${esc(L.taglineAlt)}</span>
    <h1>${esc(L.tagline)}<br><span>${esc(L.heroSub)}</span></h1>
    <p class="lead">${esc(L.heroLead)}</p>
    <div class="hero-actions">
      <a class="btn btn-primary" href="${url(lang, "request")}">${esc(L.ctaRequest)}</a>
      <a class="btn btn-ghost" href="${url(lang, "offer")}">${esc(L.ctaOffer)}</a>
    </div>
  </div>
  <div>${GEM("gem-art")}</div>
</div></div>

<section id="about"><div class="wrap">
  <span class="eyebrow">${esc(L.about.eyebrow)}</span>
  <h2>${esc(L.about.h)}</h2>
  <div class="grid g2">
    <div>
      <p>${esc(L.about.p1)}</p>
      <p>${esc(L.about.p2)}</p>
      <div class="en" dir="${L.about.altDir}" style="text-align:${L.about.altDir === "rtl" ? "right" : "left"}">${esc(L.about.alt)}</div>
    </div>
    <div class="grid" style="gap:16px">
      <div class="card"><h3>${esc(L.about.visionH)}</h3><p>${esc(L.about.vision)}</p></div>
      <div class="card"><h3>${esc(L.about.missionH)}</h3><p>${esc(L.about.mission)}</p></div>
    </div>
  </div>
</div></section>

<section><div class="wrap">
  <span class="eyebrow">${esc(L.why.eyebrow)}</span>
  <h2>${esc(L.why.h)}</h2>
  <div class="grid g3">
    <div class="card"><span class="n">${esc(L.why.n1)}</span><h3>${esc(L.why.t1)}</h3><p>${esc(L.why.d1)}</p></div>
    <div class="card"><span class="n">✓</span><h3>${esc(L.why.t2)}</h3><p>${esc(L.why.d2)}</p></div>
    <div class="card"><span class="n">⌘</span><h3>${esc(L.why.t3)}</h3><p>${esc(L.why.d3)}</p></div>
  </div>
  <p style="margin-top:18px">${esc(L.why.close)}</p>
</div></section>

<section><div class="wrap">
  <span class="eyebrow">${esc(L.valuesH.eyebrow)}</span>
  <h2>${esc(L.valuesH.h)}</h2>
  <div class="grid g3">
    ${L.values.map(([t, d]) => `<div class="card"><h3>${esc(t)}</h3><p>${esc(d)}</p></div>`).join("")}
  </div>
</div></section>

<section id="services"><div class="wrap">
  <span class="eyebrow">${esc(L.servicesH.eyebrow)}</span>
  <h2>${esc(L.servicesH.h)}</h2>
  <p style="max-width:70ch">${esc(L.servicesH.p)}</p>
  <div class="grid g2" style="margin-top:22px">
    ${L.services.map(([t, alt, d], i) => `<div class="card">
      <span class="n">${i + 1}</span>
      <h3>${esc(t)}</h3>
      <p style="font-size:12px;color:var(--bd-blue);font-weight:800;margin:-8px 0 10px">${esc(alt)}</p>
      <p>${esc(d)}</p>
    </div>`).join("")}
  </div>
</div></section>

<section id="advisory"><div class="wrap">
  <span class="eyebrow">${esc(L.advisoryH.eyebrow)}</span>
  <h2>${esc(L.advisoryH.h)}</h2>
  <div class="grid g3">
    ${L.advisory.map(([t, d], i) => `<div class="card"><span class="n">${i + 1}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></div>`).join("")}
  </div>
  <div class="note" style="margin-top:20px">${esc(L.advisoryNote[0])}<a href="${url(lang, "request")}">${esc(L.advisoryNote[1])}</a>${esc(L.advisoryNote[2])}</div>
</div></section>

<section id="methodology"><div class="wrap">
  <span class="eyebrow">${esc(L.method.eyebrow)}</span>
  <h2>${esc(L.method.h)}</h2>
  <p style="max-width:74ch">${esc(L.method.p)}</p>
  <div class="grid g3" style="margin-top:20px">
    ${L.method.steps.map(([t, d], i) => `<div class="card"><span class="n">${esc(L.method.n[i])}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></div>`).join("")}
  </div>
</div></section>

<section><div class="wrap">
  <span class="eyebrow">${esc(L.ceoMsg.eyebrow)}</span>
  <div class="card" style="padding:32px">
    ${L.ceoMsg.p.map((t, i) => `<p${i === L.ceoMsg.p.length - 1 ? ' style="margin-bottom:0"' : ""}>${esc(t)}</p>`).join("\n    ")}
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--bd-line)">
      <strong style="display:block;font-size:16px">${esc(L.ceo)}</strong>
      <span style="font-size:13px;color:var(--bd-mute)">${esc(L.ceoTitle)}</span>
    </div>
  </div>
</div></section>

<section id="contact"><div class="wrap">
  <span class="eyebrow">${esc(L.contact.eyebrow)}</span>
  <h2>${esc(L.contact.h)}</h2>
  <p style="max-width:70ch">${esc(L.contact.p)}</p>
  <div class="grid g3" style="margin-top:22px">
    <div class="card stat"><b><a href="tel:${OFFICE.phone}"><bdi dir="ltr">${esc(OFFICE.phone)}</bdi></a></b><span>${esc(L.contact.phone)}</span></div>
    <div class="card stat"><b style="font-size:19px"><a href="mailto:${OFFICE.email}">${esc(OFFICE.email)}</a></b><span>${esc(L.contact.email)}</span></div>
    <div class="card stat"><b style="font-size:19px">${esc(OFFICE.cr)}</b><span>${esc(L.contact.cr)}</span></div>
  </div>
  <div class="hero-actions" style="margin-top:24px">
    <a class="btn btn-primary" href="${url(lang, "request")}">${esc(L.ctaRequest)}</a>
    <a class="btn btn-ghost" href="${url(lang, "offer")}">${esc(L.ctaOffer2)}</a>
  </div>
</div></section>`;
  return page({
    lang, key: "home",
    title: `${L.name} — ${L.tagline}`,
    desc: L.homeMeta.desc,
    body,
  });
}

// --------------------------------------------------------- خيارات النماذج --
// القيمة المخزَّنة هي العنصر الأول دائماً، والمعروض يتبع اللغة.
const opts = (list, lang, ph) => `<option value="">${esc(ph)}</option>` +
  list.map(([v, lbl]) => `<option value="${esc(v)}">${esc(lbl[lang])}</option>`).join("");
const sel = (pairs) => pairs.map(([v, lbl]) => `<option value="${esc(v)}">${esc(lbl)}</option>`).join("");

// ------------------------------------------------------------ صفحة الطلب --
function requestPage(lang = "ar") {
  const L = C[lang], f = F[lang], r = f.req;
  const body = `
<section><div class="wrap" style="max-width:840px">
  <span class="eyebrow">${esc(r.eyebrow)}</span>
  <h2>${esc(r.h)}</h2>
  <p>${esc(r.p)}</p>

  <form class="form" id="f" style="margin-top:20px">
    <div class="row">
      <div><label for="name">${esc(f.name)} *</label><input id="name" name="name" required autocomplete="name"></div>
      <div><label for="phone">${esc(f.phone)} *</label><input id="phone" name="phone" required inputmode="tel" placeholder="${esc(f.phonePh)}" autocomplete="tel"></div>
    </div>
    <div class="row">
      <div><label for="property_type">${esc(f.ptype)} *</label><select id="property_type" name="property_type" required>${opts(TYPE_OPTIONS, lang, f.pickType)}</select></div>
      <div><label for="city">${esc(f.city)} *</label><select id="city" name="city" required>${opts(CITY_OPTIONS, lang, f.pickCity)}</select></div>
    </div>
    <div>
      <label for="districts">${esc(f.districts)}</label>
      <input id="districts" name="districts" placeholder="${esc(f.districtsPh)}">
      <div class="hint">${esc(f.districtsHint)}</div>
    </div>
    <div class="row">
      <div><label for="purpose">${esc(f.purpose)}</label><select id="purpose" name="purpose">${sel(f.purposeOpts)}</select></div>
      <div><label for="income_producing">${esc(f.incomeQ)}</label><select id="income_producing" name="income_producing">${sel(f.incomeQOpts)}</select></div>
    </div>
    <div class="row">
      <div><label for="area_min">${esc(f.areaFrom)}</label><input id="area_min" name="area_min" inputmode="numeric"></div>
      <div><label for="area_max">${esc(f.areaTo)}</label><input id="area_max" name="area_max" inputmode="numeric"></div>
    </div>
    <div class="row">
      <div><label for="budget_min">${esc(f.budgetFrom)}</label><input id="budget_min" name="budget_min" inputmode="numeric"></div>
      <div><label for="budget_max">${esc(f.budgetTo)}</label><input id="budget_max" name="budget_max" inputmode="numeric"></div>
    </div>
    <div class="row">
      <div><label for="target_yield">${esc(f.yield)}</label><input id="target_yield" name="target_yield" inputmode="decimal" placeholder="${esc(f.yieldPh)}"></div>
      <div><label for="timeline">${esc(f.timeline)}</label><select id="timeline" name="timeline">${sel(f.timelineOpts)}</select></div>
    </div>
    <div>
      <label for="notes">${esc(f.notes)}</label>
      <textarea id="notes" name="notes" placeholder="${esc(f.notesPh)}"></textarea>
    </div>
    <div id="msg" hidden></div>
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <button class="btn btn-primary" type="submit" id="go">${esc(r.submit)}</button>
      <button class="btn btn-ghost" type="button" id="wa">${esc(r.wa)}</button>
    </div>
    <div class="hint">${esc(r.consent(L.short))}</div>
  </form>
</div></section>`;

  // زر الواتساب هنا استثناءٌ مقصود من قاعدة «لا أزرار واتساب داخل المحتوى»:
  // الرسالة التي يفتحها هي ملخّص النموذج نفسه بصيغة يقرأها المستشار الذكي
  // على الطرف الآخر ويحوّلها إلى طلب — وهي نفس علّة الاستثناء المعتمد في
  // «مشخّص الخدمة». ونشاط العميل نفسه يجري على واتساب.
  //
  // ونصّ تلك الرسالة عربيٌّ دائماً مهما كانت لغة الصفحة: قارئها مكتب العميل
  // ومحرّك المطابقة، لا زائر الصفحة. زائرٌ صيني يملأ النموذج بالصينية فتصل
  // رسالته عربية — وهذا هو المطلوب.
  const script = `${JSMSG[lang]}
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
  if(!val('property_type')||!val('city')){say(T.pickFirst,'err');return}
  window.open('https://wa.me/${OFFICE.waPhone}?text='+encodeURIComponent(asText()),'_blank','noopener')};
F.onsubmit=async e=>{e.preventDefault();const b=document.getElementById('go');
  b.disabled=true;b.textContent=T.sending;
  try{const r=await fetch('/api/realestate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload())});
    const d=await r.json().catch(()=>({}));
    if(r.ok&&d.ok){say(T.okReq(d.ref,d.matches),'ok');F.reset()}
    else say(T.failReq,'err')}
  catch(_){say(T.netReq,'err')}
  finally{b.disabled=false;b.textContent=${JSON.stringify(r.submit)}}};`;
  return page({ lang, key: "request", title: `${r.title} — ${L.name}`, desc: r.desc, body, script });
}

// ------------------------------------------------------------- صفحة العرض --
function offerPage(lang = "ar") {
  const L = C[lang], f = F[lang], o = f.off;
  const body = `
<section><div class="wrap" style="max-width:840px">
  <span class="eyebrow">${esc(o.eyebrow)}</span>
  <h2>${esc(o.h)}</h2>
  <p>${esc(o.p)}</p>

  <form class="form" id="f" style="margin-top:20px">
    <div class="row">
      <div><label for="name">${esc(f.name)} *</label><input id="name" name="name" required autocomplete="name"></div>
      <div><label for="phone">${esc(f.phone)} *</label><input id="phone" name="phone" required inputmode="tel" placeholder="${esc(f.phonePh)}" autocomplete="tel"></div>
    </div>
    <div class="row">
      <div><label for="role">${esc(f.role)}</label><select id="role" name="role">${sel(f.roleOpts)}</select></div>
      <div><label for="company">${esc(f.company)}</label><input id="company" name="company"></div>
    </div>
    <div class="row">
      <div><label for="property_type">${esc(f.ptype)} *</label><select id="property_type" name="property_type" required>${opts(TYPE_OPTIONS, lang, f.pickType)}</select></div>
      <div><label for="offer_kind">${esc(f.offerKind)}</label><select id="offer_kind" name="offer_kind">${sel(f.offerKindOpts)}</select></div>
    </div>
    <div class="row">
      <div><label for="city">${esc(f.city)} *</label><select id="city" name="city" required>${opts(CITY_OPTIONS, lang, f.pickCity)}</select></div>
      <div><label for="district">${esc(f.district)}</label><input id="district" name="district"></div>
    </div>
    <div class="row">
      <div><label for="area">${esc(f.area)} *</label><input id="area" name="area" required inputmode="numeric"></div>
      <div><label for="price">${esc(f.price)} *</label><input id="price" name="price" required inputmode="numeric"></div>
    </div>
    <div class="row">
      <div><label for="annual_income">${esc(f.income)}</label><input id="annual_income" name="annual_income" inputmode="numeric">
        <div class="hint">${esc(f.incomeHint)}</div></div>
      <div><label for="income_producing">${esc(f.occupancy)}</label><select id="income_producing" name="income_producing">${sel(f.occupancyOpts)}</select></div>
    </div>
    <div class="row">
      <div><label for="deed_type">${esc(f.deed)}</label><select id="deed_type" name="deed_type">${opts(DEED_OPTIONS, lang, f.deedNone)}</select></div>
      <div><label for="location_url">${esc(f.mapUrl)}</label><input id="location_url" name="location_url" inputmode="url" placeholder="https://maps.app.goo.gl/…"></div>
    </div>
    <div><label for="notes">${esc(f.offerDesc)}</label><textarea id="notes" name="notes" placeholder="${esc(f.offerDescPh)}"></textarea></div>
    <div id="msg" hidden></div>
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <button class="btn btn-primary" type="submit" id="go">${esc(o.submit)}</button>
      <button class="btn btn-ghost" type="button" id="wa">${esc(o.wa)}</button>
    </div>
    <div class="hint">${esc(o.consent)}</div>
  </form>
</div></section>`;

  const script = `${JSMSG[lang]}
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
  if(!val('property_type')||!val('city')){say(T.pickFirst,'err');return}
  window.open('https://wa.me/${OFFICE.waPhone}?text='+encodeURIComponent(asText()),'_blank','noopener')};
F.onsubmit=async e=>{e.preventDefault();const b=document.getElementById('go');
  b.disabled=true;b.textContent=T.sending;
  try{const r=await fetch('/api/realestate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload())});
    const d=await r.json().catch(()=>({}));
    if(r.ok&&d.ok){say(T.okOff(d.ref,d.matchedRequests),'ok');F.reset()}
    else say(T.failOff,'err')}
  catch(_){say(T.netOff,'err')}
  finally{b.disabled=false;b.textContent=${JSON.stringify(o.submit)}}};`;
  return page({ lang, key: "offer", title: `${o.title} — ${L.name}`, desc: o.desc, body, script });
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
// العربية في جذر `/bluediamond/`، والإنجليزية والصينية في مجلدين — فلا
// ينكسر رابطٌ أُرسل لأحد من قبل. ولوحة العمل عربية وحدها في الجذر.
fs.mkdirSync(OUT, { recursive: true });
let n = 0;
for (const lang of LOCALES) {
  const dir = path.join(OUT, lang === "ar" ? "" : lang);
  fs.mkdirSync(dir, { recursive: true });
  const pages = {
    "index.html": home(lang),
    "request.html": requestPage(lang),
    "offer.html": offerPage(lang),
  };
  for (const [name, html] of Object.entries(pages)) { fs.writeFileSync(path.join(dir, name), html); n++; }
}
fs.writeFileSync(path.join(OUT, "crm.html"), crmPage()); n++;
console.log(`Blue Diamond site generated — ${n} pages in ${LOCALES.length} languages at /bluediamond/`);
