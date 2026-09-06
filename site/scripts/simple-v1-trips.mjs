// ‏محفول مكفول — الرحلات السياحية · صفحة تفاعلية على تصميم Simple V1.
//
// المصدر: site/data/trips.json، لقطةٌ من قاعدة نوشن «Trip Packages Catalog».
// كل رحلة منتجٌ برمزه وسعره — لا استمارة «أخبرنا عن رحلتك» — فتدخل السلة
// بنفس شكل بند الكتالوج، وتمرّ بالمسار نفسه: نطاق ← عرض ← عقد ← دفع ← فاتورة.
//
// الأسعار في نوشن شاملةٌ الضريبة (Price After VAT)، والسلة تحمل الصافي
// (amount) لأن صفحة الدفع تضيف الضريبة ١٥٪ بنفسها — لو حُملت القيمة الشاملة
// لحُسبت الضريبة مرتين.

const D = {
  hTitle:  { ar: "محفول مكفول", en: "Mahmool Makfol", fr: "Mahmool Makfol", zh: "Mahmool Makfol" },
  hLead:   { ar: "ثلاثة خطوط: زيارة المستثمر إلى المملكة، والرحلات السياحية الداخلية بباقاتها، وفعاليات الشركات ورحلاتها.",
             en: "Three lines: the investor visit to Saudi Arabia, domestic tourism with its packages, and corporate events and offsites.",
             fr: "Trois lignes : la visite investisseur, le tourisme intérieur et ses forfaits, et les événements d'entreprise.",
             zh: "三条产品线：投资者考察、境内旅游套餐、企业活动与团建。" },
  lineInv: { ar: "زيارة المستثمر", en: "Investor visit", fr: "Visite investisseur", zh: "投资者考察" },
  lineTour:{ ar: "الرحلات السياحية", en: "Tourism trips", fr: "Voyages touristiques", zh: "旅游行程" },
  lineCorp:{ ar: "فعاليات الشركات", en: "Corporate events", fr: "Événements d'entreprise", zh: "企业活动" },
  invLead: { ar: "زيارة مُرتَّبة للمستثمر: لقاءات مع أصحاب المصلحة والجهات المشرِّعة، وجولات على القطاعات الصناعية والتجارية والخدمية، وقراءة الفرص على الأرض. تُبنى على حالتك، فتُسعَّر بعرضٍ مخصّص.",
             en: "An arranged investor visit: meetings with stakeholders and regulators, tours of the industrial, commercial and service sectors, and reading the opportunities on the ground. Built around your case, so it is quoted bespoke.",
             fr: "Une visite investisseur organisée : rencontres avec les parties prenantes et les régulateurs, visites des secteurs, lecture des opportunités sur le terrain. Sur mesure, donc devisée.",
             zh: "为投资者安排的考察：与利益相关方及监管机构会面、走访工业商业与服务业、实地了解机会。按您的情况定制报价。" },
  corpLead:{ ar: "فعالية داخل المنشأة أو رحلة خارجها: يوم وطني أو يوم تأسيس أو يوم العلم، إفطار أو سحور للموظفين، بناء فريق، احتفال داخلي، افتتاح فرع، أو تكريم أداء. اختر ما يناسبك وتصلك التفاصيل والسعر.",
             en: "An event inside the company or a trip outside it: National Day, Founding Day or Flag Day, staff iftar or suhoor, team building, an internal celebration, a branch opening, or a performance award. Pick what fits and the details and price follow.",
             fr: "Un événement dans l'entreprise ou une sortie : fête nationale, journée de la fondation, iftar du personnel, team building, célébration interne, ouverture d'agence, remise de prix.",
             zh: "公司内部活动或外出行程：国庆日、建国日、升旗日、员工开斋饭或封斋饭、团队建设、内部庆典、分公司开业、绩效表彰。" },
  pickMore:{ ar: "اختر ما يناسبك — ويُبنى نطاق العمل مما اخترت.",
             en: "Pick what fits — the scope of work is built from your picks.",
             fr: "Choisissez ce qui convient — le périmètre est construit à partir de vos choix.",
             zh: "选择合适的项目 — 工作范围将据此生成。" },
  bespoke: { ar: "يُسعَّر بعرضٍ مخصّص", en: "Quoted bespoke", fr: "Devis sur mesure", zh: "定制报价" },
  sendReq: { ar: "أرسل طلبي", en: "Send my request", fr: "Envoyer ma demande", zh: "发送请求" },
  pickedN: { ar: "مختار", en: "selected", fr: "sélectionné", zh: "已选" },
  needPick:{ ar: "اختر بنداً واحداً على الأقل.", en: "Pick at least one item.",
             fr: "Choisissez au moins un élément.", zh: "请至少选择一项。" },
  title:   { ar: "الرحلات السياحية", en: "Tourism trips", fr: "Voyages touristiques", zh: "旅游行程" },
  desc:    { ar: "رحلات وتجارب في كل مناطق المملكة — اختر وجهتك ومدتك وأضفها إلى طلبك مباشرة.",
             en: "Trips and experiences across Saudi Arabia — pick a destination, a length, and add it straight to your request.",
             fr: "Voyages et expériences partout en Arabie saoudite — choisissez une destination et ajoutez-la à votre demande.",
             zh: "覆盖沙特各地的行程与体验 — 选择目的地与天数，直接加入您的请求。" },
  tag:     { ar: "محفول مكفول", en: "Mahmool Makfol", fr: "Mahmool Makfol", zh: "Mahmool Makfol" },
  allDest: { ar: "كل الوجهات", en: "All destinations", fr: "Toutes destinations", zh: "全部目的地" },
  allType: { ar: "كل الأنواع", en: "All types", fr: "Tous les types", zh: "全部类型" },
  allLen:  { ar: "أي مدة", en: "Any length", fr: "Toute durée", zh: "任意天数" },
  short:   { ar: "بضع ساعات", en: "A few hours", fr: "Quelques heures", zh: "数小时" },
  oneDay:  { ar: "يوم واحد", en: "One day", fr: "Une journée", zh: "一日" },
  multi:   { ar: "٣ أيام فأكثر", en: "3 days or more", fr: "3 jours ou plus", zh: "3天及以上" },
  search:  { ar: "ابحث: العلا، سفاري، بحر، عائلة…", en: "Search: AlUla, safari, sea, family…",
             fr: "Rechercher : AlUla, safari, mer, famille…", zh: "搜索：欧拉、狩猎、海、家庭…" },
  found:   { ar: "رحلة", en: "trips", fr: "voyages", zh: "个行程" },
  none:    { ar: "لا رحلة تطابق اختيارك — وسّع البحث أو اطلب رحلة مخصّصة.",
             en: "No trip matches. Widen the search, or ask for a custom trip.",
             fr: "Aucun voyage ne correspond. Élargissez la recherche ou demandez sur mesure.",
             zh: "没有匹配的行程。请放宽条件，或申请定制行程。" },
  add:     { ar: "أضف إلى طلبي", en: "Add to my request", fr: "Ajouter à ma demande", zh: "加入我的请求" },
  added:   { ar: "أُضيفت ✓", en: "Added ✓", fr: "Ajouté ✓", zh: "已添加 ✓" },
  seats:   { ar: "المسافرون", en: "Travellers", fr: "Voyageurs", zh: "出行人数" },
  perTrip: { ar: "سعر الرحلة", en: "Trip price", fr: "Prix du voyage", zh: "行程价格" },
  inclVat: { ar: "شامل الضريبة", en: "VAT included", fr: "TVA incluse", zh: "含增值税" },
  details: { ar: "تفاصيل الرحلة", en: "Trip details", fr: "Détails du voyage", zh: "行程详情" },
  tray:    { ar: "في طلبك", en: "In your request", fr: "Dans votre demande", zh: "已选" },
  go:      { ar: "أكمل الطلب", en: "Continue", fr: "Continuer", zh: "继续" },
  clear:   { ar: "أفرغ", en: "Clear", fr: "Vider", zh: "清空" },
  custom:  { ar: "لم تجد ما تريد؟", en: "Not what you wanted?", fr: "Pas ce que vous cherchiez ?", zh: "没找到合适的？" },
  customB: { ar: "اطلب رحلة مخصّصة", en: "Ask for a custom trip", fr: "Demander sur mesure", zh: "申请定制行程" },
  note:    { ar: "الأسعار شاملة ضريبة القيمة المضافة ١٥٪. التأشيرة والطيران الدولي غير مشمولَين ما لم يُنص عليهما في تفاصيل الرحلة.",
             en: "Prices include 15% VAT. Visas and international flights are excluded unless the trip details say otherwise.",
             fr: "Prix TTC (TVA 15 %). Visas et vols internationaux non inclus sauf mention contraire.",
             zh: "价格含 15% 增值税。除行程详情另有说明外，不含签证与国际机票。" },
};

// خطّا المستثمر والشركات بلا أسعار في أي مصدر، فلا سعر يُخترع لهما: كل بند
// يدخل نطاق العمل ويُسعَّر بعرضٍ مخصّص عبر نفس المسار — لا سلة ولا دفع مباشر.
const INVESTOR = [
  ["لقاءات مع الجهات المشرِّعة", "وزارة الاستثمار والهيئات القطاعية والجهات التنظيمية ذات العلاقة بنشاطك."],
  ["لقاءات مع أصحاب المصلحة", "شركاء محتملون، موزّعون، موردون، وجهات تمويل — مُرتَّبة قبل وصولك."],
  ["جولة على القطاع الصناعي", "المدن الصناعية والمصانع القائمة في نشاطك، ومقابلة مشغّليها."],
  ["جولة على القطاع التجاري", "الأسواق والمراكز والموزّعون وقنوات البيع في مدنٍ تختارها."],
  ["جولة على قطاع الخدمات", "اللوجستيات والتقنية والخدمات المساندة التي سيعتمد عليها نشاطك."],
  ["قراءة الفرص على الأرض", "زيارة المواقع المرشّحة وتقدير الكلف والمتطلبات قبل القرار."],
  ["ترتيب الإقامة والتنقّل", "الفندق والتنقّل الداخلي والمرافق الميداني طوال الزيارة."],
  ["الدعم بعد الزيارة", "تلخيص ما رأيته، وخطوات التأسيس والترخيص إن قرّرت المضي."],
];
const CORPORATE = [
  ["اليوم الوطني", "احتفال داخل المنشأة أو خارجها بهوية اليوم الوطني وبرنامجه."],
  ["يوم التأسيس", "برنامج ومحتوى تراثي يناسب مناسبة يوم التأسيس."],
  ["يوم العلم", "فعالية قصيرة داخل المقر بمناسبة يوم العلم."],
  ["إفطار رمضان للموظفين", "إفطار جماعي داخل المنشأة أو في موقع خارجي."],
  ["سحور الموظفين", "سحور جماعي ببرنامجه وتنظيمه."],
  ["ألعاب بناء الفريق", "برنامج بناء فريق داخل المقر أو في موقع خارجي."],
  ["رحلة خارج المبنى", "يوم خارجي للفريق — بر، بحر، أو وجهة قريبة."],
  ["احتفال داخلي", "مناسبة داخلية بغير ارتباط بتاريخ محدّد."],
  ["افتتاح فرع", "تنظيم الافتتاح والإعلان عنه وتغطيته."],
  ["تكريم أداء الموظفين", "حفل تكريم ببرنامجه وجوائزه وتنظيمه."],
  ["فعالية داخل مقر الشركة", "تنظيم كامل داخل المقر: تجهيز، ضيافة، محتوى، تغطية."],
];

export function buildSimpleTrips(sv1, ctx, data) {
  const { lang, esc } = ctx;
  const t = (k) => { const e = D[k]; if (!e) return k; const l = lang(); return e[l] != null ? e[l] : e.ar; };
  const ar = lang() === "ar";
  const pre = lang() === "en" ? "" : "/" + lang();
  const trips = (data && data.trips) || [];

  const CSS = `<style id="sv1-tr-css">
.sv1-tr-bar{position:sticky;top:72px;z-index:12;background:rgba(255,255,255,.94);backdrop-filter:blur(12px);
 border-bottom:1px solid var(--l);padding:13px 0;margin-bottom:22px}
.sv1-tr-bar .wrap{display:flex;flex-direction:column;gap:10px}
.sv1-tr-q{width:100%;border:1px solid var(--l);border-radius:11px;padding:12px 14px;font:inherit;font-size:14px;outline:none}
.sv1-tr-q:focus{border-color:var(--ac)}
.sv1-tr-rows{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.sv1-tr-chips{display:flex;gap:6px;flex-wrap:wrap;overflow-x:auto;padding-bottom:2px}
.sv1-tr-chip{border:1px solid var(--l);background:#fff;border-radius:999px;padding:6px 13px;font-size:12px;
 cursor:pointer;font-family:inherit;color:var(--mut);white-space:nowrap}
.sv1-tr-chip:hover{border-color:var(--ac);color:var(--ac)}
.sv1-tr-chip.on{background:var(--ac);border-color:var(--ac);color:#fff;font-weight:500}
.sv1-tr-count{font-family:var(--fm);font-size:11.5px;color:var(--faint);margin-inline-start:auto;white-space:nowrap}
.sv1-tr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(276px,1fr));gap:11px}
.sv1-tr-card{border:1px solid var(--l);border-radius:13px;background:#fff;padding:17px;display:flex;
 flex-direction:column;gap:9px;box-shadow:var(--sh);transition:.15s}
.sv1-tr-card:hover{border-color:var(--ac);box-shadow:var(--sh2);transform:translateY(-2px)}
.sv1-tr-top{display:flex;align-items:flex-start;justify-content:space-between;gap:9px}
.sv1-tr-card h3{font-size:14.5px;font-weight:500;line-height:1.55;margin:0}
.sv1-tr-meta{display:flex;gap:6px;flex-wrap:wrap}
.sv1-tr-pill{font-size:10.5px;border-radius:999px;padding:3px 9px;background:var(--soft);color:var(--mut);white-space:nowrap}
.sv1-tr-pill.dest{background:var(--acSoft);color:var(--ac)}
.sv1-tr-card p{font-size:12.5px;line-height:1.8;color:var(--mut);margin:0;flex:1}
.sv1-tr-price{display:flex;align-items:baseline;gap:7px;padding-top:10px;border-top:1px solid var(--line2)}
.sv1-tr-price b{font-family:var(--fm);font-size:19px;font-weight:500;color:var(--ink)}
.sv1-tr-price span{font-size:10.5px;color:var(--faint)}
.sv1-tr-acts{display:flex;gap:7px;align-items:center}
.sv1-tr-seats{display:flex;align-items:center;gap:0;border:1px solid var(--l);border-radius:9px;overflow:hidden;flex:none}
.sv1-tr-seats button{border:0;background:#fff;width:30px;height:34px;cursor:pointer;font:inherit;font-size:15px;color:var(--ink)}
.sv1-tr-seats button:hover{background:var(--soft)}
.sv1-tr-seats span{width:30px;text-align:center;font-family:var(--fm);font-size:13px}
.sv1-tr-add{flex:1}
.sv1-tr-more{font-size:11.5px;color:var(--ac);text-decoration:none}
.sv1-tr-tray{position:fixed;inset-inline:0;bottom:0;z-index:30;background:var(--n2);color:#fff;
 padding:12px 0;box-shadow:0 -8px 30px rgba(11,27,90,.24);transform:translateY(110%);transition:transform .22s ease}
.sv1-tr-tray.on{transform:none}
.sv1-tr-tray .wrap{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.sv1-tr-tray b{font-size:14px}
.sv1-tr-tray .n{font-family:var(--fm);font-size:12px;color:#B7C0DC}
.sv1-tr-tray .sum{font-family:var(--fm);font-size:17px;margin-inline-start:auto}
.sv1-tr-tray .sv1-btn{background:#fff;border-color:#fff;color:var(--ink)}
.sv1-tr-tray .sv1-btn.ghost{background:transparent;color:#C6CEE6;border-color:rgba(255,255,255,.3)}
.sv1-tr-empty{text-align:center;padding:44px 0;color:var(--mut);font-size:13.5px}
.sv1-tr-custom{margin-top:26px;border:1px dashed var(--acLine);border-radius:13px;background:var(--acSoft);
 padding:20px;text-align:center}
.sv1-tr-custom p{margin:0 0 11px;font-size:13.5px;color:var(--ink)}
.sv1-tr-note{margin-top:20px;font-size:11.5px;color:var(--faint);line-height:1.85;text-align:center}
.sv1-tr-picks{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:9px}
.sv1-tr-pick{display:flex;gap:11px;align-items:flex-start;border:1px solid var(--l);border-radius:12px;
 padding:15px;background:#fff;cursor:pointer;transition:.15s}
.sv1-tr-pick:hover{border-color:var(--ac)}
.sv1-tr-pick.on{border-color:var(--ac);background:var(--acSoft)}
.sv1-tr-pick input{margin:3px 0 0;width:17px;height:17px;accent-color:var(--ac);flex:none}
.sv1-tr-pick b{display:block;font-size:13.5px;font-weight:500;color:var(--ink);line-height:1.55}
.sv1-tr-pick small{display:block;font-size:12px;color:var(--mut);line-height:1.8;margin-top:3px}
.sv1-tr-send{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:22px;flex-wrap:wrap}
.sv1-tr-sendn{font-size:12.5px;color:var(--mut)}
@media(max-width:600px){.sv1-tr-bar{top:72px}.sv1-tr-grid{grid-template-columns:1fr}.sv1-tr-picks{grid-template-columns:1fr}}
</style>`;

  const body = `${sv1.header("/trips", { cta: false })}
<main>
  <section class="sv1-sec" style="padding-bottom:0">
    <div class="wrap"><div class="sv1-title">
      <span class="sv1-tag">${esc(t("hTitle"))}</span>
      <h2>${esc(t("hTitle"))}</h2>
      <p>${esc(t("hLead"))}</p>
    </div>
    <div class="sv1-tabs" id="trLines">
      <button type="button" class="sv1-tab" data-line="inv">${esc(t("lineInv"))}</button>
      <button type="button" class="sv1-tab on" data-line="tour">${esc(t("lineTour"))}</button>
      <button type="button" class="sv1-tab" data-line="corp">${esc(t("lineCorp"))}</button>
    </div></div>
  </section>

  <section class="sv1-sec sv1-hide" id="trPanelInv" style="padding-top:0"><div class="wrap">
    <p class="sv1-lead" style="max-width:70ch;margin:0 auto 22px;text-align:center">${esc(t("invLead"))}</p>
    <div class="sv1-tr-picks" id="trInvList"></div>
    <div class="sv1-tr-send"><span id="trInvN" class="sv1-tr-sendn"></span>
      <button type="button" class="sv1-btn primary" id="trInvGo">${esc(t("sendReq"))}</button></div>
  </div></section>

  <section class="sv1-sec sv1-hide" id="trPanelCorp" style="padding-top:0"><div class="wrap">
    <p class="sv1-lead" style="max-width:70ch;margin:0 auto 22px;text-align:center">${esc(t("corpLead"))}</p>
    <div class="sv1-tr-picks" id="trCorpList"></div>
    <div class="sv1-tr-send"><span id="trCorpN" class="sv1-tr-sendn"></span>
      <button type="button" class="sv1-btn primary" id="trCorpGo">${esc(t("sendReq"))}</button></div>
  </div></section>

  <div id="trPanelTour">
  <div class="sv1-tr-bar"><div class="wrap">
    <input class="sv1-tr-q" id="trQ" placeholder="${esc(t("search"))}" aria-label="${esc(t("search"))}">
    <div class="sv1-tr-rows">
      <div class="sv1-tr-chips" id="trDest"></div>
      <span class="sv1-tr-count" id="trCount"></span>
    </div>
    <div class="sv1-tr-rows">
      <div class="sv1-tr-chips" id="trType"></div>
      <div class="sv1-tr-chips" id="trLen"></div>
    </div>
  </div></div>

  <section class="sv1-sec" style="padding-top:0"><div class="wrap">
    <div class="sv1-tr-grid" id="trGrid"></div>
    <div class="sv1-tr-empty sv1-hide" id="trEmpty">${esc(t("none"))}</div>
    <div class="sv1-tr-custom">
      <p>${esc(t("custom"))}</p>
      <a class="sv1-btn primary" href="${pre}/#advisor">${esc(t("customB"))}</a>
    </div>
    <p class="sv1-tr-note">${esc(t("note"))}</p>
  </div></section>
  </div>
</main>

<div class="sv1-tr-tray" id="trTray"><div class="wrap">
  <div><b id="trTrayN">0</b> <span class="n">${esc(t("tray"))}</span></div>
  <span class="sum" id="trTraySum">0.00 ﷼</span>
  <button type="button" class="sv1-btn ghost sm" id="trClear">${esc(t("clear"))}</button>
  <a class="sv1-btn sm" href="${pre}/checkout" id="trGo">${esc(t("go"))}</a>
</div></div>`;

  const T = {
    allDest: t("allDest"), allType: t("allType"), allLen: t("allLen"),
    short: t("short"), oneDay: t("oneDay"), multi: t("multi"),
    found: t("found"), add: t("add"), added: t("added"), seats: t("seats"),
    inclVat: t("inclVat"), details: t("details"),
    lineInv: t("lineInv"), lineCorp: t("lineCorp"), pickMore: t("pickMore"),
    pickedN: t("pickedN"), needPick: t("needPick"),
  };

  const script = `<script>
(function(){
var DATA=${JSON.stringify({ trips, destinations: data.destinations || [], types: data.types || [] })};
var TX=${JSON.stringify(T)},AR=${ar ? "true" : "false"},CART="bp_cart",HOME=${JSON.stringify(pre + "/")};
var $=function(id){return document.getElementById(id)};
var state={q:"",dest:"",type:"",len:""};
function money(n){return (Math.round(Number(n||0)*100)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' \\u066A'.replace('\\u066A','\\uFDFC')}
function name(t){return AR?t.nameAr:(t.nameEn||t.nameAr)}
function readCart(){try{return JSON.parse(localStorage.getItem(CART))||[]}catch(e){return []}}
function writeCart(c){try{localStorage.setItem(CART,JSON.stringify(c))}catch(e){}drawTray()}

// طول الرحلة يُصنَّف في ثلاث سلال لا برقمٍ حر: الزائر يفكّر «ساعات أم يوم
// أم إجازة»، لا «كم يوماً بالضبط».
function bucket(t){var d=t.duration||{};if(d.days===0)return 'short';if(d.days===1)return 'day';if(d.days&&d.days>=3)return 'multi';return ''}

function chips(el,items,key,allLabel){
 el.innerHTML='';
 var mk=function(val,label){
  var b=document.createElement('button');b.type='button';
  b.className='sv1-tr-chip'+(state[key]===val?' on':'');b.textContent=label;
  b.onclick=function(){state[key]=(state[key]===val?'':val);draw()};
  el.appendChild(b)};
 mk('',allLabel);
 items.forEach(function(i){mk(i.v,i.l)});
}

function matches(t){
 if(state.dest&&t.destAr!==state.dest)return false;
 if(state.type&&t.typeAr!==state.type)return false;
 if(state.len&&bucket(t)!==state.len)return false;
 if(state.q){
  var q=state.q.toLowerCase();
  var hay=[t.nameAr,t.nameEn,t.destAr,t.typeAr,t.summary,(t.audienceAr||[]).join(' ')].join(' ').toLowerCase();
  if(hay.indexOf(q)<0)return false}
 return true}

function card(t){
 var c=document.createElement('article');c.className='sv1-tr-card';
 var top=document.createElement('div');top.className='sv1-tr-top';
 var h=document.createElement('h3');h.textContent=name(t);top.appendChild(h);
 c.appendChild(top);
 var meta=document.createElement('div');meta.className='sv1-tr-meta';
 if(t.destAr){var d=document.createElement('span');d.className='sv1-tr-pill dest';d.textContent=t.destAr;meta.appendChild(d)}
 if(t.typeAr){var y=document.createElement('span');y.className='sv1-tr-pill';y.textContent=t.typeAr;meta.appendChild(y)}
 if(t.duration&&t.duration.label){var u=document.createElement('span');u.className='sv1-tr-pill';u.textContent=t.duration.label;meta.appendChild(u)}
 c.appendChild(meta);
 if(t.summary){var p=document.createElement('p');p.textContent=t.summary;c.appendChild(p)}
 var pr=document.createElement('div');pr.className='sv1-tr-price';
 var b=document.createElement('b');b.className='price-amt';b.textContent=money(t.total);
 var s=document.createElement('span');s.className='price-amt';s.textContent=TX.inclVat;
 pr.appendChild(b);pr.appendChild(s);
 if(t.url){var a=document.createElement('a');a.className='sv1-tr-more';a.href=t.url;a.target='_blank';a.rel='noopener';
  a.textContent=TX.details+' \\u2197';a.style.marginInlineStart='auto';pr.appendChild(a)}
 c.appendChild(pr);
 var acts=document.createElement('div');acts.className='sv1-tr-acts';
 var qty=1;
 var box=document.createElement('div');box.className='sv1-tr-seats';box.title=TX.seats;
 var minus=document.createElement('button');minus.type='button';minus.textContent='\\u2212';
 var num=document.createElement('span');num.textContent='1';
 var plus=document.createElement('button');plus.type='button';plus.textContent='+';
 minus.onclick=function(){if(qty>1){qty--;num.textContent=String(qty)}};
 plus.onclick=function(){if(qty<40){qty++;num.textContent=String(qty)}};
 box.appendChild(minus);box.appendChild(num);box.appendChild(plus);
 var add=document.createElement('button');add.type='button';add.className='sv1-btn primary sm sv1-tr-add';add.textContent=TX.add;
 add.onclick=function(){
  var cart=readCart().filter(function(i){return i.id!==t.code});
  cart.push({id:t.code,kind:'trip',qty:qty,
   // amount = الصافي قبل الضريبة؛ صفحة الدفع تضيف ١٥٪ بنفسها.
   amount:t.net,price:t.total+' \\uFDFC',pricePublic:1,
   nameAr:t.nameAr,nameEn:t.nameEn||t.nameAr});
  writeCart(cart);
  add.textContent=TX.added;add.disabled=true;
  setTimeout(function(){add.textContent=TX.add;add.disabled=false},1600)};
 acts.appendChild(box);acts.appendChild(add);
 c.appendChild(acts);
 return c}

function drawTray(){
 var cart=readCart().filter(function(i){return i.kind==='trip'});
 var n=cart.reduce(function(a,i){return a+(Number(i.qty)||1)},0);
 var net=cart.reduce(function(a,i){return a+(Number(i.amount)||0)*(Number(i.qty)||1)},0);
 var tot=Math.round(net*1.15*100)/100;
 $('trTrayN').textContent=String(n);
 $('trTraySum').textContent=money(tot);
 $('trTray').classList.toggle('on',n>0)}

function draw(){
 var list=DATA.trips.filter(matches);
 var g=$('trGrid');g.innerHTML='';
 list.forEach(function(t){g.appendChild(card(t))});
 $('trEmpty').classList.toggle('sv1-hide',list.length>0);
 $('trCount').textContent=list.length+' '+TX.found;
 chips($('trDest'),DATA.destinations.map(function(d){return {v:d,l:d}}),'dest',TX.allDest);
 chips($('trType'),DATA.types.map(function(d){return {v:d,l:d}}),'type',TX.allType);
 chips($('trLen'),[{v:'short',l:TX.short},{v:'day',l:TX.oneDay},{v:'multi',l:TX.multi}],'len',TX.allLen);
}

// ---- الخطوط الثلاثة
var LISTS={inv:${JSON.stringify(INVESTOR)},corp:${JSON.stringify(CORPORATE)}};
var picked={inv:[],corp:[]};
function pickList(host,key,countEl){
 var el=$(host);el.innerHTML='';
 LISTS[key].forEach(function(row,i){
  var lab=document.createElement('label');lab.className='sv1-tr-pick';
  var cb=document.createElement('input');cb.type='checkbox';
  var tx=document.createElement('span');
  var b=document.createElement('b');b.textContent=row[0];
  var sm=document.createElement('small');sm.textContent=row[1];
  tx.appendChild(b);tx.appendChild(sm);
  cb.onchange=function(){
   lab.classList.toggle('on',cb.checked);
   picked[key]=cb.checked?picked[key].concat([row[0]]):picked[key].filter(function(x){return x!==row[0]});
   $(countEl).textContent=picked[key].length?picked[key].length+' '+TX.pickedN:TX.pickMore};
  lab.appendChild(cb);lab.appendChild(tx);el.appendChild(lab)});
 $(countEl).textContent=TX.pickMore}

// البنود بلا أسعار، فلا تدخل السلة: تُسلَّم للمستشار نطاقاً مبدئياً فيبني
// عليه الطلب ويصدر عرضاً مخصّصاً — نفس المسار، بلا سعرٍ مخترع.
function sendPicks(key,countEl,label){
 if(!picked[key].length){$(countEl).textContent=TX.needPick;return}
 try{sessionStorage.setItem('sv1_handoff',JSON.stringify({
   ctx:'consulting',name:label,platform:'محفول مكفول',
   items:picked[key].map(function(x){return {title:x,why:label}})}))}catch(e){}
 location.href=HOME+'#advisor'}

var lines={inv:$('trPanelInv'),tour:$('trPanelTour'),corp:$('trPanelCorp')};
Array.prototype.forEach.call(document.querySelectorAll('#trLines .sv1-tab'),function(b){
 b.onclick=function(){
  var k=b.getAttribute('data-line');
  Array.prototype.forEach.call(document.querySelectorAll('#trLines .sv1-tab'),function(x){x.classList.toggle('on',x===b)});
  for(var n in lines)lines[n].classList.toggle('sv1-hide',n!==k);
  try{history.replaceState(null,'','?line='+k)}catch(e){}}});
pickList('trInvList','inv','trInvN');
pickList('trCorpList','corp','trCorpN');
$('trInvGo').onclick=function(){sendPicks('inv','trInvN',TX.lineInv)};
$('trCorpGo').onclick=function(){sendPicks('corp','trCorpN',TX.lineCorp)};
(function(){try{var k=new URL(location.href).searchParams.get('line');
 if(k&&lines[k]){var b=document.querySelector('#trLines [data-line="'+k+'"]');if(b)b.click()}}catch(e){}})();

$('trQ').addEventListener('input',function(){state.q=this.value.trim();draw()});
$('trClear').onclick=function(){writeCart(readCart().filter(function(i){return i.kind!=='trip'}))};
draw();drawTray();
})();</script>`;

  return sv1.shell({
    title: `${t("title")} — Business Partner`,
    desc: t("desc"),
    path: "/trips",
    body: CSS + body,
    script,
  });
}
