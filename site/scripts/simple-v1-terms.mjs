// Business Partner — Simple V1: الشروط والأحكام (/terms).
//
// أمر المالك (2026-11-02، البند 8): الصفحة كانت تشرح باقات الاشتراك وحدها، ومعظم
// الخدمات والباقات بلا شروط. الآن: شروط عامة + شروط لكل فئة خدمة، وفهرس بحثٍ
// يوصل صاحب أي خدمة أو باقة إلى شروطها بالاسم أو الرمز، ومرساة #cat-… لكل فئة
// يستعملها رابط «اقرأ الشروط» في السلة والدفع (انظر terms-gate.mjs).
//
// المحتوى كله من site/assets/data/terms.json — لا نصّ قانونياً في هذا الملف، فقط
// عناوين الواجهة. ar/en/fr/zh كلها مكتوبة في البيانات (لا رجوع إلى الإنجليزية).
//
// ربط الخدمات: يأتي من terms.json (skus) مقابل صفوف الكتالوج المرئية في هذا
// البناء (rows)؛ الخدمات المخفية لا تُعرض في الفهرس ولا في قوائم الفئات.

const T = {
  tag: { ar: "قانوني", en: "Legal", fr: "Juridique", zh: "法律" },
  h1: { ar: "الشروط والأحكام", en: "Terms & Conditions", fr: "Conditions générales", zh: "条款与条件" },
  updated: { ar: "آخر تحديث", en: "Last updated", fr: "Dernière mise à jour", zh: "最近更新" },
  version: { ar: "الإصدار", en: "Version", fr: "Version", zh: "版本" },
  arabicRef: { ar: "النسخة العربية هي المرجع عند الاختلاف.", en: "The Arabic version prevails if the versions differ.", fr: "La version arabe prévaut en cas de divergence.", zh: "如各语言版本有差异，以阿拉伯语版本为准。" },
  searchLabel: { ar: "ابحث عن خدمتك", en: "Find your service", fr: "Trouvez votre service", zh: "查找您的服务" },
  searchPh: { ar: "اسم الخدمة أو رمزها، مثل BP-SBC-01", en: "Service name or code, e.g. BP-SBC-01", fr: "Nom ou code du service, ex. BP-SBC-01", zh: "服务名称或代码，如 BP-SBC-01" },
  noResult: { ar: "لا نتيجة. اكتب جزءاً آخر من الاسم، أو تصفّح الفئات أدناه — وكل خدمة تسري عليها الشروط العامة على أي حال.", en: "No match. Try another part of the name, or browse the categories below — the General Terms apply to every service anyway.", fr: "Aucun résultat. Essayez une autre partie du nom ou parcourez les catégories ci-dessous — les Conditions générales s'appliquent de toute façon à chaque service.", zh: "没有匹配项。请换一部分名称，或浏览下方类别——通用条款适用于所有服务。" },
  resultsOf: { ar: "نتيجة", en: "results", fr: "résultats", zh: "条结果" },
  openTerms: { ar: "شروط هذه الفئة", en: "Terms for this category", fr: "Conditions de cette catégorie", zh: "该类别条款" },
  tocH: { ar: "فهرس الفئات", en: "Categories", fr: "Catégories", zh: "类别索引" },
  general: { ar: "الشروط العامة", en: "General Terms", fr: "Conditions générales", zh: "通用条款" },
  generalNote: { ar: "تسري على كل خدمة بلا استثناء.", en: "Apply to every service without exception.", fr: "S'appliquent à chaque service sans exception.", zh: "适用于所有服务，无一例外。" },
  catTerms: { ar: "شروط الفئة", en: "Category Terms", fr: "Conditions de catégorie", zh: "类别条款" },
  covers: { ar: "الخدمات المشمولة", en: "Services covered", fr: "Services couverts", zh: "涵盖的服务" },
  coversPages: { ar: "تُطلب من صفحتها مباشرة، لا من الكتالوج", en: "Requested from its own page, not from the catalogue", fr: "Demandé depuis sa propre page, pas depuis le catalogue", zh: "通过其专属页面申请，而非目录" },
  alsoGeneral: { ar: "وتسري كذلك الشروط العامة أعلاه.", en: "The General Terms above also apply.", fr: "Les Conditions générales ci-dessus s'appliquent également.", zh: "上述通用条款同样适用。" },
  toTop: { ar: "العودة إلى الفهرس", en: "Back to index", fr: "Retour à l'index", zh: "返回索引" },
  svcWord: { ar: "خدمة", en: "services", fr: "services", zh: "项服务" },
  contactH: { ar: "سؤال عن الشروط؟", en: "A question about the terms?", fr: "Une question sur les conditions ?", zh: "对条款有疑问？" },
  contactP: { ar: "اسأل مستشاراً قبل أن تطلب — وتوضيح الشروط لا يكلّفك شيئاً.", en: "Ask an advisor before you order — clarifying the terms costs nothing.", fr: "Demandez à un conseiller avant de commander — clarifier les conditions ne coûte rien.", zh: "下单前先咨询顾问——解释条款不收费。" },
  contactBtn: { ar: "تواصل معنا", en: "Contact us", fr: "Nous contacter", zh: "联系我们" },
  privacyBtn: { ar: "سياسة الخصوصية", en: "Privacy policy", fr: "Politique de confidentialité", zh: "隐私政策" },
};

// ملفات تعريف الأمان لإدراج JSON داخل <script>.
const safeJson = (o) => JSON.stringify(o).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

export function buildSimpleTerms(SV1, ctx, data, rows) {
  const { lang: langFn, esc, nameOf } = ctx;
  const lang = langFn();
  const L = (o) => (o && (o[lang] != null && o[lang] !== "" ? o[lang] : o.en)) || "";
  const t = (k) => L(T[k]);
  const pre = lang === "en" ? "" : "/" + lang;
  const u = (p) => pre + p;
  const arrow = lang === "ar" ? "←" : "→";

  // الصفوف المرئية مرتبطةً بفئاتها. صفٌّ بلا ربط يُعدّ فجوة تكشفها tests/terms-coverage.test.mjs.
  const catOf = (code) => data.skus[code] || data.skus[String(code).toUpperCase()] || null;
  const byCat = {};
  for (const r of rows) {
    const c = catOf(r.code);
    if (!c) continue;
    (byCat[c] = byCat[c] || []).push({ code: r.code, name: nameOf ? nameOf(r) : r.nameEn });
  }

  const ol = (items) => `<ol class="tm-ol">${items.map((i) => `<li>${esc(L(i))}</li>`).join("")}</ol>`;

  const generalHtml = data.general.sections.map((s, i) => `
    <div class="tm-gs" id="${esc(s.id)}">
      <h3><span class="tm-n sv1-mono">${String(i + 1).padStart(2, "0")}</span>${esc(L(s.title))}</h3>
      ${ol(s.items)}
    </div>`).join("");

  const pagesFor = (id) => Object.entries(data.pages || {}).filter(([, c]) => c === id).map(([p]) => p);

  const catHtml = data.categories.map((c) => {
    const items = [...c.items, ...(c.uses || []).map((id) => data.clauses[id]).filter(Boolean)];
    const list = byCat[c.id] || [];
    const covers = list.length
      ? `<details class="tm-cov"><summary>${esc(t("covers"))} (${list.length})</summary>
          <ul>${list.map((r) => `<li><span class="sv1-mono">${esc(r.code)}</span> ${esc(r.name)}</li>`).join("")}</ul></details>`
      : (pagesFor(c.id).length ? `<p class="tm-covp">${esc(t("covers"))}: ${pagesFor(c.id).map((p) => `<a href="${esc(u(p))}">${esc(p)}</a>`).join(" · ")} — ${esc(t("coversPages"))}</p>` : "");
    return `
    <details class="tm-cat" id="cat-${esc(c.id)}" open>
      <summary><h2><span class="tm-n sv1-mono">${String(c.order).padStart(2, "0")}</span>${esc(L(c.title))}</h2></summary>
      <div class="tm-body">
        <p class="tm-sum">${esc(L(c.summary))}</p>
        ${covers}
        ${ol(items)}
        <p class="tm-also"><a href="#general">${esc(t("alsoGeneral"))}</a> <a class="tm-top" href="#tm-index">${arrow} ${esc(t("toTop"))}</a></p>
      </div>
    </details>`;
  }).join("");

  const tocHtml = data.categories.map((c) => {
    const n = (byCat[c.id] || []).length;
    return `<a href="#cat-${esc(c.id)}" data-cat="${esc(c.id)}">${esc(L(c.title))}${n ? ` <small>${n}</small>` : ""}</a>`;
  }).join("");

  // فهرس البحث: خدمات مرئية + عناوين الفئات (بحث بالفئة نفسها).
  const idx = {
    s: rows.map((r) => [r.code, nameOf ? nameOf(r) : r.nameEn, r.nameAr, catOf(r.code)]).filter((x) => x[3]),
    c: Object.fromEntries(data.categories.map((c) => [c.id, L(c.title)])),
  };
  const TXT = { noResult: t("noResult"), open: t("openTerms"), of: t("resultsOf") };

  const CSS = `<style id="sv1-terms-css">
html{scroll-behavior:auto}
.tm-head{max-width:860px;margin:0 0 26px}
.tm-head h1{font-size:clamp(30px,4.4vw,50px);line-height:1.12;margin:16px 0 12px;letter-spacing:-.035em;font-weight:200;color:var(--ink)}
.tm-meta{display:flex;gap:6px 16px;flex-wrap:wrap;margin:12px 0 0;font-size:12.5px;color:var(--mut)}
.tm-find{margin:0 0 20px;padding:18px;border:1px solid var(--l);border-radius:14px;background:#fff;box-shadow:var(--sh)}
.tm-find label{display:block;font-size:13px;font-weight:500;color:var(--ink);margin:0 0 8px}
.tm-find input{width:100%;box-sizing:border-box;font:inherit;font-size:15px;padding:12px 14px;border:1px solid var(--l);border-radius:10px;background:#fff;color:var(--ink)}
.tm-find input:focus{outline:2px solid var(--ac);outline-offset:1px;border-color:var(--ac)}
.tm-res{list-style:none;margin:12px 0 0;padding:0;display:grid;gap:6px}
.tm-res li a{display:flex;gap:6px 12px;flex-wrap:wrap;align-items:baseline;padding:10px 12px;border:1px solid var(--line2);border-radius:10px;color:var(--ink);text-decoration:none}
.tm-res li a:hover,.tm-res li a:focus{border-color:var(--ac);background:#f7f9ff}
.tm-res b{font-weight:500}
.tm-res .c{font-size:12px;color:var(--ac);margin-inline-start:auto}
.tm-res .sv1-mono,.tm-cov .sv1-mono{font-size:11px;color:var(--faint)}
.tm-empty{font-size:13.5px;color:var(--mut);margin:12px 0 0}
.tm-toc{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 30px;padding:14px 0;border-top:1px solid var(--line2);border-bottom:1px solid var(--line2)}
.tm-toc h2{flex:0 0 100%;font-size:13px;font-weight:500;color:var(--mut);margin:0 0 2px}
.tm-toc a{font-size:12.5px;padding:6px 12px;border:1px solid var(--l);border-radius:999px;color:var(--ink);background:#fff;text-decoration:none}
.tm-toc a:hover{border-color:var(--ink)}
.tm-toc a.hit,.tm-toc a:target{border-color:var(--ac);background:#f2f6ff}
.tm-toc small{color:var(--faint);margin-inline-start:4px}
.tm-gen,.tm-cat{margin:0 0 18px;border:1px solid var(--l);border-radius:14px;background:#fff;scroll-margin-top:96px;box-shadow:var(--sh)}
.tm-gen{padding:0}
.tm-cat>summary,.tm-gen>summary{list-style:none;cursor:pointer;padding:18px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.tm-cat>summary::-webkit-details-marker,.tm-gen>summary::-webkit-details-marker{display:none}
.tm-cat>summary h2,.tm-gen>summary h2{display:flex;gap:12px;align-items:baseline;margin:0;font-size:clamp(18px,2.2vw,24px);font-weight:300;letter-spacing:-.02em;color:var(--ink)}
.tm-cat>summary::after,.tm-gen>summary::after{content:"+";flex:none;font-size:22px;line-height:1;color:var(--mut)}
.tm-cat[open]>summary::after,.tm-gen[open]>summary::after{content:"\\2212"}
.tm-cat:target,.tm-gen:target{border-color:var(--ac);box-shadow:0 0 0 3px rgba(40,70,190,.12)}
.tm-n{font-size:12px;color:var(--faint);font-weight:400}
.tm-body{padding:0 20px 18px}
.tm-sum{color:var(--mut);font-size:14px;line-height:1.8;margin:0 0 12px}
.tm-gnote{color:var(--mut);font-size:13.5px;margin:0 0 6px}
.tm-gs{margin:0 0 20px;scroll-margin-top:96px}
.tm-gs h3{display:flex;gap:10px;align-items:baseline;font-size:16px;font-weight:500;color:var(--ink);margin:0 0 8px}
.tm-ol{margin:0;padding-inline-start:22px;display:grid;gap:10px;color:var(--ink);font-size:14.5px;line-height:1.95}
.tm-ol li::marker{color:var(--ac);font-weight:600}
.tm-cov{margin:0 0 14px;border:1px dashed var(--l);border-radius:10px;padding:8px 12px;background:#fafbfd}
.tm-cov summary{cursor:pointer;font-size:13px;color:var(--ac);font-weight:500}
.tm-cov ul{list-style:none;margin:10px 0 2px;padding:0;display:grid;grid-template-columns:repeat(2,1fr);gap:4px 18px;font-size:12.5px;color:var(--mut);max-height:260px;overflow:auto}
.tm-covp{margin:0 0 14px;font-size:13px;color:var(--mut)}
.tm-also{display:flex;gap:8px 18px;flex-wrap:wrap;justify-content:space-between;margin:14px 0 0;padding-top:12px;border-top:1px solid var(--line2);font-size:12.5px}
.tm-also a{color:var(--ac)}
.tm-end{text-align:center;border-top:1px solid var(--line2);padding-top:30px;margin-top:30px}
.tm-end h2{font-size:21px;font-weight:300;color:var(--ink);margin:0 0 6px}
.tm-end p{color:var(--mut);margin:0 0 16px}
.tm-end .sv1-btn{margin:0 4px 6px}
mark.tm-m{background:#fff3c4;color:inherit;padding:0 1px;border-radius:2px}
@media(max-width:640px){.tm-cov ul{grid-template-columns:1fr}.tm-cat>summary,.tm-gen>summary{padding:16px}.tm-body{padding:0 16px 16px}.tm-find{padding:14px}.tm-res .c{margin-inline-start:0;flex-basis:100%}}
@media print{.tm-find,.tm-toc,.tm-top,.tm-end{display:none}.tm-cat,.tm-gen{box-shadow:none;break-inside:auto}}
</style>`;

  const body = `${SV1.header("/terms")}
  <main>
  <section class="sv1-sec"><div class="wrap">
    <div class="tm-head" id="tm-index">
      <span class="sv1-tag">${esc(t("tag"))}</span>
      <h1>${esc(t("h1"))}</h1>
      <p class="sv1-lead" style="max-width:none">${esc(L(data.intro))}</p>
      <div class="tm-meta"><span>${esc(t("updated"))}: ${esc(L(data.updated))}</span><span>${esc(t("version"))}: <span class="sv1-mono" dir="ltr">${esc(data.version)}</span></span><span>${esc(t("arabicRef"))}</span></div>
    </div>

    <div class="tm-find" role="search">
      <label for="tmQ">${esc(t("searchLabel"))}</label>
      <input id="tmQ" type="search" autocomplete="off" inputmode="search" placeholder="${esc(t("searchPh"))}" aria-controls="tmRes">
      <ul class="tm-res" id="tmRes" aria-live="polite"></ul>
      <p class="tm-empty" id="tmEmpty" hidden>${esc(t("noResult"))}</p>
    </div>

    <nav class="tm-toc" aria-label="${esc(t("tocH"))}">
      <h2>${esc(t("tocH"))}</h2>
      <a href="#general"><b>${esc(t("general"))}</b></a>
      ${tocHtml}
    </nav>

    <details class="tm-gen" id="general" open>
      <summary><h2><span class="tm-n sv1-mono">00</span>${esc(t("general"))}</h2></summary>
      <div class="tm-body">
        <p class="tm-gnote">${esc(t("generalNote"))}</p>
        ${generalHtml}
        <p class="tm-also"><span></span><a class="tm-top" href="#tm-index">${arrow} ${esc(t("toTop"))}</a></p>
      </div>
    </details>

    ${catHtml}

    <div class="tm-end">
      <h2>${esc(t("contactH"))}</h2>
      <p>${esc(t("contactP"))}</p>
      <a class="sv1-btn primary" href="${esc(u("/contact"))}">${esc(t("contactBtn"))}</a>
      <a class="sv1-btn" href="${esc(u("/privacy"))}">${esc(t("privacyBtn"))}</a>
    </div>
  </div></section>
  </main>
${SV1.footer()}`;

  const script = `<script>(function(){
var IDX=${safeJson(idx)},TX=${safeJson(TXT)};
var q=document.getElementById('tmQ'),res=document.getElementById('tmRes'),empty=document.getElementById('tmEmpty');
function norm(s){return String(s||'').toLowerCase().replace(/[\\u064B-\\u0652\\u0640]/g,'').replace(/[\\u0623\\u0625\\u0622]/g,'\\u0627').replace(/\\u0649/g,'\\u064A').replace(/\\u0629/g,'\\u0647').replace(/[^\\w\\u0600-\\u06FF\\u3400-\\u9FFF\\u00C0-\\u024F ]+/g,' ').replace(/\\s+/g,' ').trim()}
var N=IDX.s.map(function(r){return norm(r[0]+' '+r[1]+' '+r[2]+' '+IDX.c[r[3]])});
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function openFor(id){var d=document.getElementById(id);if(d&&d.tagName==='DETAILS')d.open=true}
function openHash(){var h=location.hash.slice(1);if(h){openFor(h);var el=document.getElementById(h);if(el&&el.closest){var p=el.closest('details');if(p)p.open=true}}}
addEventListener('hashchange',openHash);openHash();
// بعد تحميل الخطوط يتغيّر ارتفاع الصفحة الطويلة فيفلت الهدف: أعد المحاذاة مرة واحدة ما لم يتحرك المستخدم.
(function(){var moved=false;['wheel','touchstart','keydown','mousedown'].forEach(function(ev){addEventListener(ev,function(){moved=true},{once:true,passive:true})});
function realign(){if(moved||!location.hash)return;var el=document.getElementById(location.hash.slice(1));if(el)el.scrollIntoView({block:'start'})}
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(realign);addEventListener('load',function(){setTimeout(realign,150)})})();
function run(){
  var v=norm(q.value);res.innerHTML='';empty.hidden=true;
  if(v.length<2)return;
  var parts=v.split(' '),out=[],i,j,ok;
  for(i=0;i<N.length&&out.length<30;i++){ok=true;for(j=0;j<parts.length;j++){if(N[i].indexOf(parts[j])<0){ok=false;break}}if(ok)out.push(IDX.s[i])}
  if(!out.length){
    // لا خدمة بهذا الاسم: جرّب عناوين الفئات نفسها.
    Object.keys(IDX.c).forEach(function(id){var n=norm(IDX.c[id]);var all=parts.every(function(p){return n.indexOf(p)>=0});if(all)out.push([ '',IDX.c[id],'',id])});
  }
  if(!out.length){empty.hidden=false;return}
  res.innerHTML=out.slice(0,15).map(function(r){
    return '<li><a href="#cat-'+esc(r[3])+'" data-cat="'+esc(r[3])+'">'+(r[0]?'<span class="sv1-mono">'+esc(r[0])+'</span>':'')+'<b>'+esc(r[1])+'</b><span class="c">'+esc(IDX.c[r[3]])+'</span></a></li>'
  }).join('');
}
q.addEventListener('input',run);
q.addEventListener('keydown',function(e){if(e.key==='Enter'){var a=res.querySelector('a');if(a){location.hash=a.getAttribute('href');openHash()}}});
res.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a');if(a){openFor(a.getAttribute('href').slice(1))}});
// رابط عميق: ?q=BP-SBC-01 يملأ البحث.
try{var m=/[?&]q=([^&]+)/.exec(location.search);if(m){q.value=decodeURIComponent(m[1].replace(/\\+/g,' '));run()}}catch(e){}
})();</script>`;

  return SV1.shell({
    title: `${t("h1")} — Business Partner`,
    desc: L(data.intro),
    path: "/terms",
    body: CSS + body,
    script,
  });
}
