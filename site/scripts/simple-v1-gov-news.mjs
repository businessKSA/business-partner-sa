// Business Partner — Simple V1: أخبار الجهات الحكومية (/gov-news).
//
// تبويب «الأخبار» في تطبيق الجوال. بطاقات من بيانات حقيقية فقط: كل بطاقة
// جهتها وعنوانها وملخصها وتاريخها ورابط مصدرها من site/assets/data/gov-news.json.
// لا شعارات جهات (حقوق الاستخدام غير مؤكدة) — اسم الجهة نصاً.
//
// القاعدة: لا يُعرض عنصر ينقصه حقل إلزامي أو رابطه غير https، ولا يُخترع شيء.
// ملف البيانات فارغاً (الحال الآن) ⇒ حالة فارغة مصممة «لا أخبار بعد».
// أزرار التصفية تُبنى من الفئات الموجودة فعلاً في العناصر لا من قائمة ثابتة.
//
// مخطط الملف وشرح الحقول داخل الملف نفسه. من يغذّيه: automation-agents (n8n).
//
// fr و zh تعرض الإنجليزية، كبقية صفحات SV1. نصوص الأخبار عربية المصدر وتُعرض
// كما هي (dir=rtl) حتى في الصفحة الإنجليزية.

const T = {
  title: { ar: "أخبار الجهات", en: "Government news" },
  h1: { ar: "أخبار الجهات الحكومية", en: "Government news" },
  desc: {
    ar: "ما تعلنه الجهات الحكومية وتغيّرات خدماتها التي تهم منشأتك — بمصدر كل خبر وتاريخه.",
    en: "What government authorities announce and how their services change — each item with its source and date.",
  },
  all: { ar: "الكل", en: "All" },
  filters: { ar: "تصفية الأخبار حسب الفئة", en: "Filter news by category" },
  more: { ar: "اقرأ المزيد", en: "Read more" },
  source: { ar: "المصدر", en: "Source" },
  note: {
    ar: "الملخصات مُعدّة آلياً من الخبر المنشور. راجع المصدر الرسمي قبل أي إجراء.",
    en: "Summaries are machine-written from the published item. Check the official source before acting.",
  },
  emptyH: { ar: "لا أخبار بعد", en: "No news yet" },
  emptyP: {
    ar: "لن نعرض هنا إلا خبراً راجعناه ومعه مصدره. حين يتوفر شيء ستجده في هذه الصفحة.",
    en: "We only show items we have reviewed, with their source. When there is something, it will appear on this page.",
  },
  emptyGuides: { ar: "أدلة وتحديثات المنصات", en: "Guides & platform updates" },
  emptyAsk: { ar: "اسأل المستشار الذكي", en: "Ask the AI advisor" },
};

const MAX_ITEMS = 60;

// عنصر صالح للعرض = كل الحقول الإلزامية موجودة والرابط https والتاريخ صحيح.
export function validGovNewsItems(data) {
  const raw = data && Array.isArray(data.items) ? data.items : [];
  const seen = new Set();
  const out = [];
  for (const it of raw) {
    if (!it || typeof it !== "object") continue;
    const s = (k) => (typeof it[k] === "string" ? it[k].trim() : "");
    const id = s("id"), authority = s("authority"), title = s("title"), summary = s("summary");
    const url = s("url"), category = s("category");
    const ts = Date.parse(s("published_at"));
    if (!id || !authority || !title || !summary || !url || !category || Number.isNaN(ts)) continue;
    if (!/^https:\/\//i.test(url)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id, authority, authority_en: s("authority_en"), title, summary, url, category,
      category_ar: s("category_ar"), category_en: s("category_en"), ts,
    });
  }
  out.sort((a, b) => b.ts - a.ts);
  return out.slice(0, MAX_ITEMS);
}

export function buildSimpleGovNews(SV1, ctx, data) {
  const { lang: langFn, esc } = ctx;
  const lang = langFn();
  const pick = (e) => (e && (e[lang] != null ? e[lang] : e.en)) || "";
  const t = (k) => pick(T[k]);
  const pre = lang === "en" ? "" : "/" + lang;
  const u = (p) => pre + p;
  const arrow = lang === "ar" ? "←" : "→";
  const isAr = lang === "ar";

  const items = validGovNewsItems(data);

  const fmtDate = (ts) => {
    try {
      return new Intl.DateTimeFormat(isAr ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { dateStyle: "medium", timeZone: "Asia/Riyadh" }).format(new Date(ts));
    } catch { return new Date(ts).toISOString().slice(0, 10); }
  };

  // فئات الأزرار من العناصر الموجودة فعلاً، بترتيب أول ظهور (الأحدث أولاً).
  const cats = [];
  for (const it of items) {
    if (!cats.some((c) => c.id === it.category)) {
      cats.push({ id: it.category, label: isAr ? (it.category_ar || it.category) : (it.category_en || it.category) });
    }
  }

  const chips = cats.length > 1
    ? `<div class="sv1-gn-chips" role="group" aria-label="${esc(t("filters"))}">
        <button type="button" class="on" data-f="*" aria-pressed="true">${esc(t("all"))}</button>
        ${cats.map((c, i) => `<button type="button" data-f="${i}" aria-pressed="false">${esc(c.label)}</button>`).join("")}
      </div>` : "";

  const cards = items.map((it) => {
    const ci = cats.findIndex((c) => c.id === it.category);
    const authority = !isAr && it.authority_en ? it.authority_en : it.authority;
    const authLang = !isAr && it.authority_en ? "en" : "ar";
    return `<article class="sv1-gn-card" data-c="${ci}">
      <div class="sv1-gn-top">
        <span class="sv1-gn-auth" lang="${authLang}">${esc(authority)}</span>
        <time datetime="${esc(new Date(it.ts).toISOString())}">${esc(fmtDate(it.ts))}</time>
      </div>
      <h2 lang="ar" dir="rtl">${esc(it.title)}</h2>
      <p lang="ar" dir="rtl">${esc(it.summary)}</p>
      <a class="sv1-gn-more" href="${esc(it.url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(t("more"))} ${arrow}<span class="sv1-gn-sr"> — ${esc(t("source"))}: ${esc(authority)}</span></a>
    </article>`;
  }).join("");

  const empty = `<div class="sv1-gn-empty">
      <div class="sv1-gn-eico" aria-hidden="true">📰</div>
      <h2>${esc(t("emptyH"))}</h2>
      <p>${esc(t("emptyP"))}</p>
      <div class="sv1-gn-eacts">
        <a class="sv1-btn" href="${esc(u("/news"))}">${esc(t("emptyGuides"))}</a>
      </div>
    </div>`;

  const CSS = `<style id="sv1-gn-css">
.sv1-gn{max-width:760px;margin:0 auto;padding:0 0 40px}
.sv1-gn-head{margin:0 0 18px}
.sv1-gn-head h1{font-size:clamp(26px,6vw,40px);line-height:1.2;margin:12px 0 10px;letter-spacing:-.03em;font-weight:300;color:var(--ink)}
.sv1-gn-head p{margin:0;color:var(--mut);font-size:14.5px;line-height:1.9}
.sv1-gn-chips{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 18px}
.sv1-gn-chips button{font:inherit;font-size:13px;min-height:40px;padding:8px 15px;border:1px solid var(--l);border-radius:999px;background:#fff;color:var(--ink);cursor:pointer}
.sv1-gn-chips button.on{background:var(--ac);border-color:var(--ac);color:#fff}
.sv1-gn-list{display:grid;gap:12px}
.sv1-gn-card{background:#fff;border:1px solid var(--l);border-radius:14px;padding:16px 16px 14px;box-shadow:var(--sh);min-width:0}
.sv1-gn-card[hidden]{display:none}
.sv1-gn-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:0 0 8px;font-size:12px;color:var(--mut)}
.sv1-gn-auth{font-weight:600;color:var(--ac);font-size:12.5px}
.sv1-gn-card h2{font-size:16px;font-weight:500;line-height:1.7;margin:0 0 6px;color:var(--ink);overflow-wrap:anywhere}
.sv1-gn-card p{font-size:13.5px;line-height:1.85;color:var(--mut);margin:0 0 10px;overflow-wrap:anywhere}
.sv1-gn-more{display:inline-flex;align-items:center;min-height:40px;font-size:13px;font-weight:500;color:var(--ac)}
.sv1-gn-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.sv1-gn-note{margin:18px 0 0;font-size:12px;color:var(--faint);line-height:1.8}
.sv1-gn-empty{text-align:center;background:#fff;border:1px dashed var(--acLine);border-radius:16px;padding:38px 20px}
.sv1-gn-eico{font-size:34px;margin:0 0 8px}
.sv1-gn-empty h2{font-size:20px;font-weight:400;margin:0 0 8px;color:var(--ink)}
.sv1-gn-empty p{margin:0 auto 16px;max-width:420px;color:var(--mut);font-size:14px;line-height:1.9}
.sv1-gn-eacts{display:flex;gap:9px;justify-content:center;flex-wrap:wrap}
html.bp-native .sv1-gn{padding-top:8px}
</style>`;

  const script = items.length && cats.length > 1 ? `<script>(function(){
var box=document.querySelector('.sv1-gn-chips');if(!box)return;
var cards=document.querySelectorAll('.sv1-gn-card');
box.addEventListener('click',function(e){
 var b=e.target.closest('button[data-f]');if(!b)return;
 var f=b.getAttribute('data-f');
 Array.prototype.forEach.call(box.querySelectorAll('button'),function(x){var on=x===b;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on?'true':'false')});
 Array.prototype.forEach.call(cards,function(c){c.hidden=!(f==='*'||c.getAttribute('data-c')===f)});
});
})();</script>` : "";

  const body = `${SV1.header("/gov-news")}
  <main>
  <section class="sv1-sec"><div class="wrap">
    <div class="sv1-gn">
      <div class="sv1-gn-head">
        <span class="sv1-tag">${esc(t("title"))}</span>
        <h1>${esc(t("h1"))}</h1>
        <p>${esc(t("desc"))}</p>
      </div>
      ${items.length ? `${chips}<div class="sv1-gn-list">${cards}</div><p class="sv1-gn-note">${esc(t("note"))}</p>` : empty}
    </div>
  </div></section>
  </main>
${SV1.footer()}`;

  return SV1.shell({
    title: `${t("title")} — Business Partner`,
    desc: t("desc"),
    path: "/gov-news",
    body: CSS + body,
    script,
  });
}
