// Business Partner — Simple V1: «كل الخدمات» (2026-09).
//
// The footer used to offer «الموقع الكامل» and send the visitor to
// /classic-home: a page with another layout, another voice and another brand
// spelling. People clicked it expecting more of this site and landed on what
// reads as a different company — which is exactly what the team reported.
//
// This is what that link should have led to: the whole catalogue, in this
// site's own design, searchable, grouped by field. Picking a service does not
// leave for a differently-styled detail page — it starts the conversation on
// the homepage with that service already in the scope, through the same
// sessionStorage handoff the per-service assistant already uses
// (site/scripts/service-advisor.mjs → bp_sva_request).
//
// Prices are not shown here. Owner policy: the catalogue and its prices live
// in the backend, and the figure reaches the customer in the quotation for the
// scope they approved. The page says which authority a service belongs to,
// never what it costs.
import fs from "node:fs";
import path from "node:path";

const T = {
  title:  { ar: "كل الخدمات", en: "All services", fr: "Tous les services", zh: "全部服务" },
  desc:   { ar: "كل ما ننفّذه — مرتّباً بالمجال. اختر خدمة لتبدأ بها طلبك مباشرة.",
            en: "Everything we deliver, grouped by field. Pick one to start your request with it.",
            fr: "Tout ce que nous réalisons, par domaine. Choisissez pour démarrer votre demande.",
            zh: "我们提供的全部服务，按领域分类。选择一项即可开始您的申请。" },
  lead:   { ar: "ما تحتاج تعرف اسم الخدمة — ابحث بالكلمة التي تعرفها، أو اشرح احتياجك في المحادثة ونحن نرتّبه.",
            en: "You do not need the service name — search a word you know, or just describe what you need.",
            fr: "Nul besoin du nom exact — cherchez un mot, ou décrivez simplement votre besoin.",
            zh: "无需知道服务名称——搜索您知道的词，或直接描述您的需求。" },
  search: { ar: "ابحث: إقامة، رخصة، توظيف، سجل تجاري…", en: "Search: visa, licence, hiring, registration…",
            fr: "Rechercher : visa, licence, recrutement…", zh: "搜索：签证、许可、招聘…" },
  all:    { ar: "الكل", en: "All", fr: "Tous", zh: "全部" },
  count:  { ar: "خدمة", en: "services", fr: "services", zh: "项服务" },
  none:   { ar: "لا نتيجة بهذه الكلمة. جرّب كلمة أعمّ، أو اشرح احتياجك في المحادثة.",
            en: "Nothing matched. Try a broader word, or just describe your need in the chat.",
            fr: "Aucun résultat. Essayez un terme plus large, ou décrivez votre besoin.",
            zh: "没有匹配项。请尝试更宽泛的词，或在对话中描述您的需求。" },
  start:  { ar: "ابدأ بهذه الخدمة ←", en: "Start with this →", fr: "Commencer par ce service →", zh: "以此开始 →" },
  ask:    { ar: "ما لقيت اللي تبيه؟", en: "Not finding it?", fr: "Vous ne trouvez pas ?", zh: "没找到？" },
  askCta: { ar: "اشرح احتياجك في المحادثة", en: "Describe your need in the chat", fr: "Décrivez votre besoin", zh: "在对话中描述您的需求" },
};

// Which door a field belongs to, so the chat opens in the right context.
const DOOR = {
  "تأسيس الشركات": "formation",
  "الاستثمار الأجنبي": "formation",
  "العلاقات الحكومية": "government",
  "التوظيف والاستقدام": "government",
  "الموارد البشرية": "government",
  "الإقامة المميزة": "government",
  "دعم الأعمال": "consulting",
  "الأتمتة والذكاء الاصطناعي": "consulting",
  "العقارات": "consulting",
  "المكاتب ومساحات العمل": "consulting",
};

export function buildSimpleCatalog(SV1, ctx) {
  const lang = ctx.lang();
  const t = (k) => (T[k][lang] != null ? T[k][lang] : T[k].en);
  const esc = ctx.esc;

  let services = [];
  try {
    const raw = JSON.parse(fs.readFileSync(path.resolve("site/assets/data/catalog.json"), "utf8"));
    services = Array.isArray(raw.services) ? raw.services : [];
  } catch { services = []; }

  // Only what the page needs, and no price: a smaller payload, and no figure
  // that could be read as an offer before a scope exists.
  const data = services.map((s) => ({
    code: s.code || "",
    name: (lang === "ar" ? s.nameAr : s.nameEn) || s.nameAr || s.nameEn || "",
    cat: s.categoryAr || "",
    gov: s.govPlatform || "",
    door: DOOR[s.categoryAr] || "consulting",
  })).filter((s) => s.name);

  const cats = [];
  for (const s of data) if (s.cat && cats.indexOf(s.cat) < 0) cats.push(s.cat);

  const body = `${SV1.header("/catalog")}
  <main>
  <section class="sv1-sec"><div class="wrap">
    <div class="sv1-title">
      <span class="sv1-tag">${esc(String(data.length))} ${esc(t("count"))}</span>
      <h2>${esc(t("title"))}</h2>
      <p>${esc(t("lead"))}</p>
    </div>
    <div class="sv1-cat-tools">
      <input id="svcQ" class="sv1-cat-q" type="search" placeholder="${esc(t("search"))}" aria-label="${esc(t("search"))}">
      <div class="sv1-chips" id="svcCats"></div>
    </div>
    <div id="svcList"></div>
    <div class="sv1-panel sv1-cat-ask">
      <h4>${esc(t("ask"))}</h4>
      <a class="sv1-btn primary sm" href="${lang === "en" ? "/" : "/" + lang + "/"}#advisor">${esc(t("askCta"))}</a>
    </div>
  </div></section>
  </main>
${SV1.footer()}`;

  const script = `<script>
(function(){
var SVC=${JSON.stringify(data)},CATS=${JSON.stringify(cats)},LANG=${JSON.stringify(lang)};
var TX=${JSON.stringify({ all: t("all"), none: t("none"), start: t("start") })};
var HOME=${JSON.stringify(lang === "en" ? "/" : "/" + lang + "/")};
var q=document.getElementById('svcQ'),list=document.getElementById('svcList'),bar=document.getElementById('svcCats');
var cat='';
function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}
// The same handoff the per-service assistant uses: the homepage reads this on
// load and opens the chat with the service already in the scope, so the
// visitor never lands on a page in another design.
function pick(s){
 try{sessionStorage.setItem('bp_sva_request',JSON.stringify({name:s.name,code:s.code,platform:s.gov,door:s.door,text:s.name,at:Date.now()}))}catch(e){}
 location.href=HOME+'#advisor';
}
function chips(){
 bar.innerHTML='';
 var mk=function(label,val){var b=el('button',val===cat?'on':'',label);b.type='button';b.onclick=function(){cat=val;chips();draw()};bar.appendChild(b)};
 mk(TX.all,'');CATS.forEach(function(c){mk(c,c)});
}
function draw(){
 var f=(q.value||'').trim().toLowerCase();
 var hits=SVC.filter(function(s){
  if(cat&&s.cat!==cat)return false;
  if(!f)return true;
  return (s.name+' '+s.code+' '+s.cat+' '+s.gov).toLowerCase().indexOf(f)>=0});
 list.innerHTML='';
 if(!hits.length){list.appendChild(el('p','sv1-muted',TX.none));return}
 // Grouped by field, and the group heading is dropped when one field is
 // already selected — a single heading repeated above its own list is noise.
 var groups=[];
 hits.forEach(function(s){var g=groups.filter(function(x){return x.cat===s.cat})[0];if(!g){g={cat:s.cat,items:[]};groups.push(g)}g.items.push(s)});
 groups.forEach(function(g){
  if(!cat){var hh=el('h3','sv1-cat-h',g.cat+' · '+g.items.length);list.appendChild(hh)}
  var grid=el('div','sv1-cat-grid');
  g.items.forEach(function(s){
   var card=el('button','sv1-cat-card');card.type='button';
   card.appendChild(el('b',null,s.name));
   if(s.gov)card.appendChild(el('small',null,s.gov));
   card.appendChild(el('span',null,TX.start));
   card.onclick=function(){pick(s)};
   grid.appendChild(card)});
  list.appendChild(grid)});
}
q.addEventListener('input',draw);chips();draw();
})();</script>`;

  const CSS = `<style id="sv1-cat-css">
.sv1-cat-tools{display:grid;gap:10px;margin-bottom:22px}
.sv1-cat-q{width:100%;border:1px solid var(--l);border-radius:12px;padding:13px 15px;font:inherit;font-size:15px;outline:none;background:#fff}
.sv1-cat-q:focus{border-color:var(--n)}
.sv1-cat-tools .sv1-chips button.on{background:var(--n);border-color:var(--n);color:#fff}
.sv1-cat-h{font-size:14px;margin:26px 0 10px;color:var(--n);letter-spacing:-.01em}
.sv1-cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}
.sv1-cat-card{text-align:start;background:#fff;border:1px solid var(--l);border-radius:14px;padding:15px;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;gap:5px;transition:.15s}
.sv1-cat-card:hover{border-color:#99a7d4;transform:translateY(-2px);box-shadow:var(--sh)}
.sv1-cat-card b{font-size:14px;color:var(--n);line-height:1.5}
.sv1-cat-card small{font-size:11.5px;color:#777}
.sv1-cat-card span{font-size:12px;font-weight:700;color:var(--n);margin-top:4px}
.sv1-cat-ask{margin-top:30px;text-align:center}
.sv1-cat-ask h4{margin:0 0 10px;color:var(--n);font-size:15px}
</style>`;

  return SV1.shell({
    title: `${t("title")} — Business Partner`,
    desc: t("desc"),
    path: "/catalog",
    body: CSS + body,
    script,
  });
}
