// Business Partner — Simple V1: «الخدمات والباقات» (/catalog).
//
// كانت الصفحة قائمة مسطّحة من ١٤٠ بطاقة: من يفتحها على جواله يمرّر دقيقة
// كاملة قبل أن يصل إلى قسمه. صارت مجموعات مطويّة — كل مجال بطاقة واحدة تُفتح
// على خدماته — وتبويباً ثانياً للباقات.
//
// والأهم: الاختيار متعدد. من يؤسّس شركة يحتاج السجل والعنوان الوطني وقوى
// والتأمينات معاً، فيؤشّر عليها كلها ويبدأ طلباً واحداً بنطاقٍ فيه البنود
// الأربعة — بدل أن يبدأ أربعة طلبات أو يشرحها بالكلام. الاختيار يُسلَّم إلى
// المحادثة في الصفحة الرئيسية عبر `bp_sva_request`، ومنها تكمل الرحلة نفسها:
// نطاق → عرض سعر → عقد → دفع → فاتورة.
//
// الأسعار لا تظهر للزائر: سياسة المالك أن الكتالوج وأسعاره في الخلفية. سعر
// الباقة يحمل صنف `price-amt` الذي تخفيه قاعدة `html[data-prices="off"]`
// العامة، فيراه العميل المسجَّل ولا يراه الزائر — قاعدة واحدة لا استثناء لها.
import fs from "node:fs";
import path from "node:path";

const T = {
  title:  { ar: "الخدمات والباقات", en: "Services & packages", fr: "Services et forfaits", zh: "服务与套餐" },
  desc:   { ar: "كل ما ننفّذه — مرتّباً بالمجال. أشّر على ما تحتاجه وابدأ طلبك بها كلها.",
            en: "Everything we deliver, grouped by field. Tick what you need and start one request with all of it.",
            fr: "Tout ce que nous réalisons, par domaine. Cochez vos besoins et lancez une seule demande.",
            zh: "我们提供的全部服务，按领域分类。勾选所需项目，一次性发起申请。" },
  tabSvc: { ar: "الخدمات", en: "Services", fr: "Services", zh: "服务" },
  tabPkg: { ar: "الباقات", en: "Packages", fr: "Forfaits", zh: "套餐" },
  search: { ar: "ابحث: إقامة، رخصة، توظيف، سجل تجاري…", en: "Search: visa, licence, hiring, registration…",
            fr: "Rechercher : visa, licence, recrutement…", zh: "搜索：签证、许可、招聘…" },
  none:   { ar: "لا نتيجة بهذه الكلمة. جرّب كلمة أعمّ، أو اشرح احتياجك في المحادثة.",
            en: "Nothing matched. Try a broader word, or describe your need in the chat.",
            fr: "Aucun résultat. Essayez un terme plus large, ou décrivez votre besoin.",
            zh: "没有匹配项。请尝试更宽泛的词，或在对话中描述您的需求。" },
  picked: { ar: "اخترت", en: "Selected", fr: "Sélectionné", zh: "已选" },
  svcWord:{ ar: "خدمة", en: "services", fr: "services", zh: "项服务" },
  start:  { ar: "ابدأ طلبك بها", en: "Start a request", fr: "Lancer la demande", zh: "开始申请" },
  clear:  { ar: "مسح", en: "Clear", fr: "Effacer", zh: "清除" },
  openAll:{ ar: "افتح الكل", en: "Expand all", fr: "Tout ouvrir", zh: "全部展开" },
  closeAll:{ar: "اطوِ الكل", en: "Collapse all", fr: "Tout fermer", zh: "全部收起" },
  pkgAsk: { ar: "اطلب هذه الباقة", en: "Request this package", fr: "Demander ce forfait", zh: "申请此套餐" },
  pkgNote:{ ar: "الباقة اشتراك شهري يُدار من حسابك — تبدأ بطلب، ثم عرض سعر وعقد وفاتورة كبقية الخدمات.",
            en: "A package is a monthly subscription managed from your account — it starts as a request, then quotation, contract and invoice like any service.",
            fr: "Un forfait est un abonnement mensuel géré depuis votre compte — demande, devis, contrat et facture comme tout service.",
            zh: "套餐为按月订阅，在您的账户中管理——与其他服务一样，从申请到报价、合同与发票。" },
  monthly:{ ar: "شهرياً", en: "monthly", fr: "par mois", zh: "每月" },
  journey:{ ar: "من هنا تبدأ الرحلة نفسها لكل خدمة", en: "Every service starts the same journey",
            fr: "Chaque service suit le même parcours", zh: "每项服务都走同一流程" },
  ask:    { ar: "ما لقيت اللي تبيه؟", en: "Not finding it?", fr: "Vous ne trouvez pas ?", zh: "没找到？" },
  askCta: { ar: "اشرح احتياجك في المحادثة", en: "Describe your need in the chat", fr: "Décrivez votre besoin", zh: "在对话中描述您的需求" },
};

// أي باب يفتح لهذا المجال، ليبدأ المستشار في السياق الصحيح.
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
  const ar = lang === "ar";

  let raw = { services: [], packages: [] };
  try { raw = JSON.parse(fs.readFileSync(path.resolve("site/assets/data/catalog.json"), "utf8")); } catch {}

  const services = (raw.services || []).map((s) => ({
    code: s.code || "",
    name: (ar ? s.nameAr : s.nameEn) || s.nameAr || s.nameEn || "",
    cat: s.categoryAr || "",
    gov: s.govPlatform && s.govPlatform !== "بدون جهة حكومية" ? s.govPlatform : "",
    door: DOOR[s.categoryAr] || "consulting",
  })).filter((s) => s.name);

  const groups = [];
  for (const s of services) {
    let g = groups.find((x) => x.cat === s.cat);
    if (!g) { g = { cat: s.cat || "—", items: [] }; groups.push(g); }
    g.items.push(s);
  }

  const packages = (raw.packages || []).map((p) => ({
    code: p.code || "",
    name: (ar ? p.nameAr : p.nameEn) || p.nameAr || p.nameEn || "",
    group: (ar ? p.groupNameAr : p.groupNameEn) || p.groupNameAr || "",
    price: p.amount != null ? Number(p.amount) : null,
    period: p.billingPeriod === "monthly" ? t("monthly") : "",
    features: ((ar ? p.featuresAr : p.featuresEn) || p.featuresAr || []).slice(0, 8),
  })).filter((p) => p.name);

  const steps = ar
    ? ["محادثة", "نطاق الخدمات", "عرض السعر", "العقد", "الدفع", "الفاتورة"]
    : lang === "fr" ? ["Discussion", "Périmètre", "Devis", "Contrat", "Paiement", "Facture"]
    : lang === "zh" ? ["对话", "服务范围", "报价", "合同", "支付", "发票"]
    : ["Chat", "Scope", "Quotation", "Contract", "Payment", "Invoice"];

  const body = `${SV1.header("/catalog")}
  <main>
  <section class="sv1-sec"><div class="wrap">
    <div class="sv1-title">
      <span class="sv1-tag">${esc(String(services.length))} ${esc(t("svcWord"))} · ${esc(String(packages.length))} ${esc(t("tabPkg"))}</span>
      <h2>${esc(t("title"))}</h2>
      <p>${esc(t("desc"))}</p>
    </div>

    <div class="sv1-cat-journey" aria-label="${esc(t("journey"))}">
      <span class="lbl">${esc(t("journey"))}</span>
      <ol>${steps.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>
    </div>

    <div class="sv1-tabs">
      <button type="button" class="sv1-tab on" id="tabSvc">${esc(t("tabSvc"))}</button>
      <button type="button" class="sv1-tab" id="tabPkg">${esc(t("tabPkg"))}</button>
    </div>

    <div id="paneSvc">
      <div class="sv1-cat-tools">
        <input id="svcQ" class="sv1-cat-q" type="search" placeholder="${esc(t("search"))}" aria-label="${esc(t("search"))}">
        <button type="button" class="sv1-btn sm ghost" id="svcToggleAll">${esc(t("openAll"))}</button>
      </div>
      <div id="svcList"></div>
    </div>

    <div id="panePkg" class="sv1-hide">
      <p class="sv1-muted" style="text-align:center;max-width:640px;margin:0 auto 18px">${esc(t("pkgNote"))}</p>
      <div id="pkgList"></div>
    </div>

    <div class="sv1-panel sv1-cat-ask">
      <h4>${esc(t("ask"))}</h4>
      <a class="sv1-btn primary sm" href="${ar || lang !== "en" ? "/" + lang + "/" : "/"}#advisor">${esc(t("askCta"))}</a>
    </div>
  </div></section>
  </main>
  <div class="sv1-tray sv1-hide" id="svcTray"><div class="wrap">
    <span id="trayCount"></span>
    <div class="acts">
      <button type="button" class="sv1-btn sm" id="trayClear">${esc(t("clear"))}</button>
      <button type="button" class="sv1-btn primary sm" id="trayGo">${esc(t("start"))}</button>
    </div>
  </div></div>
${SV1.footer()}`;

  const CSS = `<style id="sv1-cat-css">
.sv1-cat-journey{display:flex;align-items:center;gap:14px;flex-wrap:wrap;justify-content:center;background:var(--soft);border:1px solid var(--l);border-radius:14px;padding:12px 16px;margin-bottom:22px}
.sv1-cat-journey .lbl{font-size:12px;color:var(--mut);font-weight:700}
.sv1-cat-journey ol{list-style:none;display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0;counter-reset:j}
.sv1-cat-journey li{counter-increment:j;font-size:11.5px;color:var(--n);background:#fff;border:1px solid var(--l);border-radius:999px;padding:5px 11px;font-weight:600}
.sv1-cat-journey li::before{content:counter(j) " · ";color:var(--mut);font-weight:700}
.sv1-cat-tools{display:flex;gap:8px;align-items:center;margin-bottom:16px}
.sv1-cat-q{flex:1;border:1px solid var(--l);border-radius:12px;padding:13px 15px;font:inherit;font-size:15px;outline:none;background:#fff}
.sv1-cat-q:focus{border-color:var(--n)}
.sv1-grp{border:1px solid var(--l);border-radius:14px;background:#fff;margin-bottom:9px;overflow:hidden}
.sv1-grp>button{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;background:none;border:0;padding:15px 17px;cursor:pointer;font-family:inherit;text-align:start}
.sv1-grp>button b{font-size:14.5px;color:var(--n)}
.sv1-grp>button .meta{display:flex;align-items:center;gap:10px;color:var(--mut);font-size:12px}
.sv1-grp>button .chev{transition:.2s;display:inline-block}
.sv1-grp.open>button .chev{transform:rotate(180deg)}
.sv1-grp .body{display:none;border-top:1px solid var(--l);padding:8px}
.sv1-grp.open .body{display:block}
.sv1-pick{display:flex;gap:10px;align-items:flex-start;padding:10px 11px;border-radius:10px;cursor:pointer}
.sv1-pick:hover{background:var(--soft)}
.sv1-pick input{margin:2px 0 0;width:17px;height:17px;accent-color:var(--n);flex:none}
.sv1-pick .tx b{display:block;font-size:13.5px;color:var(--ink);font-weight:600;line-height:1.55}
.sv1-pick .tx small{font-size:11.5px;color:var(--mut)}
.sv1-pick.on{background:#eef1f9}
.sv1-grp .badge{background:#edf0f8;color:var(--n);border-radius:999px;padding:2px 9px;font-size:11px;font-weight:700}
.sv1-tray{position:sticky;bottom:0;z-index:25;background:var(--n);color:#fff;box-shadow:0 -8px 24px rgba(11,27,90,.22)}
.sv1-tray .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 22px}
.sv1-tray #trayCount{font-weight:700;font-size:13.5px}
.sv1-tray .acts{display:flex;gap:8px}
.sv1-tray .sv1-btn{border-color:rgba(255,255,255,.35);background:transparent;color:#fff}
.sv1-tray .sv1-btn.primary{background:#fff;color:var(--n);border-color:#fff}
/* شريط الاختيار يجلس فوق زر واتساب العائم؛ يُرفع الزر ما دام الشريط ظاهراً. */
body.sv1-tray-on .sv1-wa-fab{bottom:78px}
.sv1-pkg{border:1px solid var(--l);border-radius:16px;background:#fff;padding:20px;display:flex;flex-direction:column;gap:10px}
.sv1-pkg h3{font-size:17px;margin:0}
.sv1-pkg .grp{font-size:11px;color:var(--mut);font-weight:700}
.sv1-pkg .amt{font-size:20px;font-weight:700;color:var(--n)}
.sv1-pkg ul{margin:0;padding-inline-start:18px;display:grid;gap:5px}
.sv1-pkg li{font-size:12.5px;color:var(--s);line-height:1.65}
.sv1-pkg .sv1-btn{margin-top:auto}
.sv1-pkg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
.sv1-pkg-h{font-size:14px;margin:22px 0 10px;color:var(--n)}
.sv1-cat-ask{margin-top:30px;text-align:center}
.sv1-cat-ask h4{margin:0 0 10px;color:var(--n);font-size:15px}
@media(max-width:600px){.sv1-cat-journey{display:none}.sv1-tray .wrap{padding:10px 14px}.sv1-tray #trayCount{font-size:12.5px}}
</style>`;

  const script = `<script>
(function(){
var GROUPS=${JSON.stringify(groups)},PKGS=${JSON.stringify(packages)},LANG=${JSON.stringify(lang)};
var TX=${JSON.stringify({ none: t("none"), picked: t("picked"), svcWord: t("svcWord"), openAll: t("openAll"), closeAll: t("closeAll"), pkgAsk: t("pkgAsk"), monthly: t("monthly") })};
var HOME=${JSON.stringify(lang === "en" ? "/" : "/" + lang + "/")};
var $=function(id){return document.getElementById(id)};
var list=$('svcList'),q=$('svcQ'),tray=$('svcTray'),cnt=$('trayCount');
var picked=[];   // [{code,title,why,door}]
function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}
function isPicked(code,name){return picked.some(function(p){return p.code===code&&p.title===name})}
function drawTray(){
 if(!picked.length){tray.classList.add('sv1-hide');document.body.classList.remove('sv1-tray-on');return}
 tray.classList.remove('sv1-hide');document.body.classList.add('sv1-tray-on');
 cnt.textContent=TX.picked+' '+picked.length+' '+TX.svcWord;
}
function toggle(s,on){
 if(on){if(!isPicked(s.code,s.name))picked.push({code:s.code,title:s.name,why:s.gov||'',door:s.door})}
 else picked=picked.filter(function(p){return !(p.code===s.code&&p.title===s.name)});
 drawTray();
}
// التسليم إلى محادثة الصفحة الرئيسية: البنود المختارة تصير نطاق الطلب، والباب
// يُختار بالأغلبية حتى يفتح المستشار في السياق الذي يخدم أكثر ما اختير.
function handoff(items,door,text){
 try{sessionStorage.setItem('bp_sva_request',JSON.stringify({items:items,door:door,text:text,name:items[0]&&items[0].title,code:items[0]&&items[0].code,at:Date.now()}))}catch(e){}
 location.href=HOME+'#advisor';
}
function go(){
 if(!picked.length)return;
 var tally={};picked.forEach(function(p){tally[p.door]=(tally[p.door]||0)+1});
 var door=Object.keys(tally).sort(function(a,b){return tally[b]-tally[a]})[0]||'consulting';
 handoff(picked.map(function(p){return {code:p.code,title:p.title,why:p.why}}),door,picked.map(function(p){return p.title}).join('، '));
}
function draw(){
 var f=(q.value||'').trim().toLowerCase();
 list.innerHTML='';
 var any=false;
 GROUPS.forEach(function(g){
  var hits=g.items.filter(function(s){return !f||(s.name+' '+s.code+' '+s.cat+' '+s.gov).toLowerCase().indexOf(f)>=0});
  if(!hits.length)return;
  any=true;
  var box=el('div','sv1-grp');
  // البحث يفتح ما طابق: نتيجةٌ مخبّأة خلف عنوان مطويّ ليست نتيجة.
  if(f)box.classList.add('open');
  var head=el('button');head.type='button';
  var left=el('span');left.appendChild(el('b',null,g.cat));
  var meta=el('span','meta');
  meta.appendChild(el('span','badge',String(hits.length)));
  meta.appendChild(el('span','chev','⌄'));
  head.appendChild(left);head.appendChild(meta);
  head.onclick=function(){box.classList.toggle('open')};
  var body=el('div','body');
  hits.forEach(function(s){
   var row=el('label','sv1-pick');
   var cb=document.createElement('input');cb.type='checkbox';cb.checked=isPicked(s.code,s.name);
   if(cb.checked)row.classList.add('on');
   cb.onchange=function(){row.classList.toggle('on',cb.checked);toggle(s,cb.checked)};
   var tx=el('span','tx');tx.appendChild(el('b',null,s.name));
   if(s.gov)tx.appendChild(el('small',null,s.gov));
   row.appendChild(cb);row.appendChild(tx);
   body.appendChild(row)});
  box.appendChild(head);box.appendChild(body);
  list.appendChild(box)});
 if(!any)list.appendChild(el('p','sv1-muted',TX.none));
}
q.addEventListener('input',draw);
$('svcToggleAll').onclick=function(){
 var boxes=list.querySelectorAll('.sv1-grp');
 var open=list.querySelectorAll('.sv1-grp.open').length>=boxes.length/2;
 Array.prototype.forEach.call(boxes,function(b){b.classList.toggle('open',!open)});
 this.textContent=open?TX.openAll:TX.closeAll;
};
$('trayClear').onclick=function(){picked=[];drawTray();draw()};
$('trayGo').onclick=go;

// ---- الباقات
var pkgBox=$('pkgList');
function drawPkgs(){
 pkgBox.innerHTML='';
 var seen=[];
 PKGS.forEach(function(p){if(seen.indexOf(p.group)<0)seen.push(p.group)});
 seen.forEach(function(gname){
  if(gname)pkgBox.appendChild(el('h3','sv1-pkg-h',gname));
  var grid=el('div','sv1-pkg-grid');
  PKGS.filter(function(p){return p.group===gname}).forEach(function(p){
   var c=el('div','sv1-pkg');
   c.appendChild(el('h3',null,p.name));
   if(p.price!=null){
    // صنف price-amt: القاعدة العامة تخفيه عن الزائر وتظهره للعميل المسجَّل.
    var amt=el('div','amt price-amt',Number(p.price).toLocaleString('en-US')+' ﷼'+(p.period?' / '+p.period:''));
    c.appendChild(amt)}
   if(p.features.length){var ul=el('ul');p.features.forEach(function(x){ul.appendChild(el('li',null,x))});c.appendChild(ul)}
   var b=el('button','sv1-btn primary sm',TX.pkgAsk);b.type='button';
   b.onclick=function(){handoff([{code:p.code,title:p.name,why:p.group||''}],'consulting',p.name)};
   c.appendChild(b);
   grid.appendChild(c)});
  pkgBox.appendChild(grid)});
}
$('tabSvc').onclick=function(){this.classList.add('on');$('tabPkg').classList.remove('on');$('paneSvc').classList.remove('sv1-hide');$('panePkg').classList.add('sv1-hide')};
$('tabPkg').onclick=function(){this.classList.add('on');$('tabSvc').classList.remove('on');$('panePkg').classList.remove('sv1-hide');$('paneSvc').classList.add('sv1-hide')};
draw();drawPkgs();drawTray();
if(/[?&]tab=packages/.test(location.search))$('tabPkg').click();
})();</script>`;

  return SV1.shell({
    title: `${t("title")} — Business Partner`,
    desc: t("desc"),
    path: "/catalog",
    body: CSS + body,
    script,
  });
}
