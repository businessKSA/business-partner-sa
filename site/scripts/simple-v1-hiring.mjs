// Business Partner — Simple V1: «التوظيف» (/hiring).
//
// تبويب رابع بجانب الخدمات والباقات والرحلات، يجمع بوابات التوظيف الثلاث في
// مكان واحد بدل أن تكون مبعثرة بين /careers و /hr/employer و /job-search-service:
//
//   صاحب العمل      — ينشر وظيفة ويتابع المتقدمين (بوابة HR القائمة).
//   الوظائف المتاحة  — لوحة حيّة تقرأ من /api/candidates?openJobs=1، وهي نفسها
//                      مصدر بطاقات /careers، فلا مصدر ثانٍ يتفرّع عنها.
//   الباحث عن العمل  — يرسل سيرته الذاتية ويطلب وكيل البحث. النموذج نفسه
//                      (#seeker-form) يعيش في /careers ويحمل خانة jobSearch،
//                      فالبوابة توصّل إليه ولا تستنسخه: نموذجٌ واحد بعشرين حقلاً
//                      مكرَّرٌ في صفحتين يتباعد بعد أول تعديل.
//
// زرّ «تقديم» في بطاقة الوظيفة يذهب إلى /job?id=<معرّف الإعلان>#apply-form،
// لا إلى /careers#seeker-form: فصفحة /job وحدها هي التي تستدعي setSelectedJob
// بمعرّف نوشن الحقيقي بعد جلب /api/candidates?posting=<id>، فيصل الطلب مربوطاً
// بالإعلان ويصل صاحب العمل إشعاره. أما /careers فلا تلتقط المعرّف إلا لسلاغين
// قديمين مكتوبين يدوياً في main.js، وما عداهما يسقط صامتاً إلى candidate-pool.

const T = {
  title:  { ar: "التوظيف", en: "Hiring", fr: "Recrutement", zh: "招聘" },
  desc:   { ar: "ثلاث بوابات: صاحب عمل يوظّف، وظائف مفتوحة للتقديم، وباحث عن عمل يبحث له وكيلنا.",
            en: "Three doors: employers hiring, open vacancies to apply to, and job seekers whose search our agent runs.",
            fr: "Trois portes : employeurs qui recrutent, postes ouverts, et chercheurs d'emploi accompagnés par notre agent.",
            zh: "三个入口：招聘中的雇主、开放职位、由我们的智能代理协助求职者。" },
  tag:    { ar: "٣ بوابات", en: "3 doors", fr: "3 portes", zh: "3 个入口" },
  tabSvc: { ar: "الخدمات", en: "Services", fr: "Services", zh: "服务" },
  tabPkg: { ar: "الباقات", en: "Packages", fr: "Forfaits", zh: "套餐" },
  tabTrip:{ ar: "الرحلات", en: "Trips", fr: "Voyages", zh: "行程" },
  tabHire:{ ar: "التوظيف", en: "Hiring", fr: "Recrutement", zh: "招聘" },

  empT:   { ar: "بوابة صاحب العمل", en: "Employer portal", fr: "Espace employeur", zh: "雇主门户" },
  empD:   { ar: "انشر وظيفة، واستقبل المتقدمين، وتابعهم من الفرز إلى العرض الوظيفي في لوحة واحدة.",
            en: "Post a vacancy, receive applicants, and track them from screening to offer in one dashboard.",
            fr: "Publiez un poste, recevez les candidatures et suivez-les jusqu'à l'offre.",
            zh: "发布职位、接收申请，并在一个面板中跟进至录用。" },
  empGo:  { ar: "افتح لوحة التوظيف ←", en: "Open the hiring dashboard →", fr: "Ouvrir le tableau de bord →", zh: "打开招聘面板 →" },

  jobsT:  { ar: "بوابة الوظائف المتاحة", en: "Open vacancies", fr: "Postes ouverts", zh: "开放职位" },
  jobsD:  { ar: "كل الوظائف المفتوحة الآن لدى بيزنس بارتنر وعملائها — اقرأ التفاصيل وقدّم مباشرة.",
            en: "Every vacancy open right now at Business Partner and its clients — read it and apply directly.",
            fr: "Tous les postes ouverts chez Business Partner et ses clients — consultez et postulez.",
            zh: "Business Partner 及其客户当前所有开放职位——查看详情并直接申请。" },
  jobsGo: { ar: "استعرض الوظائف ↓", en: "Browse vacancies ↓", fr: "Voir les postes ↓", zh: "浏览职位 ↓" },

  seekT:  { ar: "بوابة الباحث عن العمل", en: "Job seeker portal", fr: "Espace candidat", zh: "求职者门户" },
  seekD:  { ar: "أرسل سيرتك الذاتية مرة واحدة: تدخل قاعدة المرشحين، ويبحث لك وكيلنا أسبوعياً ويرشّحك بنفسه.",
            en: "Send your CV once: you enter the talent pool, and our agent searches weekly and nominates you itself.",
            fr: "Envoyez votre CV une fois : vous rejoignez le vivier et notre agent cherche chaque semaine pour vous.",
            zh: "只需提交一次简历：进入人才库，我们的代理每周为您搜索并推荐。" },
  seekGo: { ar: "اعرف كيف يعمل ↓", en: "See how it works ↓", fr: "Voir comment ça marche ↓", zh: "了解运作方式 ↓" },

  jobsHead:{ ar: "الوظائف المفتوحة الآن", en: "Vacancies open now", fr: "Postes ouverts", zh: "当前开放职位" },
  loading:{ ar: "جارٍ التحميل…", en: "Loading…", fr: "Chargement…", zh: "加载中…" },
  empty:  { ar: "لا وظائف مفتوحة الآن — أرسل سيرتك الذاتية ونرشّحك أول ما تُفتح وظيفة تناسبك.",
            en: "No vacancies open right now — send your CV and we'll nominate you the moment one fits.",
            fr: "Aucun poste ouvert — envoyez votre CV et nous vous proposerons dès qu'un poste correspond.",
            zh: "暂无开放职位——请提交简历，一旦有合适职位我们会推荐您。" },
  failed: { ar: "تعذّر تحميل الوظائف الآن. حدّث الصفحة بعد قليل.",
            en: "Couldn't load vacancies right now. Refresh in a moment.",
            fr: "Impossible de charger les postes. Réessayez dans un instant.",
            zh: "暂时无法加载职位，请稍后刷新。" },
  view:   { ar: "عرض الوظيفة", en: "View job", fr: "Voir le poste", zh: "查看职位" },
  apply:  { ar: "تقديم", en: "Apply", fr: "Postuler", zh: "申请" },

  seekHead:{ ar: "كيف يبحث لك الوكيل", en: "How the agent searches for you", fr: "Comment l'agent cherche pour vous", zh: "代理如何为您搜索" },
  step1:  { ar: "ترسل سيرتك الذاتية وتحدّد مجالك والراتب الذي تطلبه.",
            en: "You send your CV and state your field and the salary you want.",
            fr: "Vous envoyez votre CV avec votre domaine et le salaire souhaité.",
            zh: "提交简历，并说明您的领域与期望薪资。" },
  step2:  { ar: "الوكيل يقرأ الوظائف المفتوحة أسبوعياً ويختار ما يناسب ملفك فعلاً.",
            en: "The agent reads the open vacancies weekly and picks the ones that genuinely fit you.",
            fr: "L'agent lit les postes ouverts chaque semaine et retient ceux qui vous correspondent.",
            zh: "代理每周阅读开放职位，挑选真正适合您的岗位。" },
  step3:  { ar: "نرشّحك بأنفسنا لصاحب العمل، وتصلك القائمة المختصرة على بريدك.",
            en: "We nominate you to the employer ourselves, and the shortlist reaches your inbox.",
            fr: "Nous vous proposons à l'employeur et la sélection vous parvient par e-mail.",
            zh: "我们主动向雇主推荐您，入围名单会发送到您的邮箱。" },
  seekCta:{ ar: "أرسل سيرتك الذاتية", en: "Send your CV", fr: "Envoyer votre CV", zh: "提交简历" },
  seekNote:{ ar: "الاشتراك في وكيل البحث اختياري داخل النموذج نفسه، ولا يُخصم منك شيء عند الإرسال — يُفعَّل بعد تواصلٍ بشري معك.",
            en: "Opting into the search agent is a choice inside the same form, and nothing is charged on submission — a human activates it after speaking with you.",
            fr: "L'adhésion à l'agent est optionnelle dans le formulaire ; rien n'est facturé à l'envoi.",
            zh: "是否启用搜索代理在同一表单中自选，提交时不产生任何费用。" },
};

export function buildSimpleHiring(SV1, ctx) {
  const { lang: langFn, esc } = ctx;
  const lang = langFn();

  const t = (k) => { const e = T[k]; return e[lang] != null ? e[lang] : e.en; };
  const pre = lang === "en" ? "" : "/" + lang;
  const u = (p) => pre + p;

  const doors = [
    { id: "doorEmp", ico: "🏢", h: t("empT"), p: t("empD"), go: t("empGo"), href: u("/hr/employer") },
    { id: "doorJobs", ico: "📋", h: t("jobsT"), p: t("jobsD"), go: t("jobsGo"), target: "hireJobs" },
    { id: "doorSeek", ico: "🎯", h: t("seekT"), p: t("seekD"), go: t("seekGo"), target: "hireSeek" },
  ].map((d) => d.href
    ? `<a class="sv1-door" href="${esc(d.href)}"><span class="ico">${d.ico}</span><h3>${esc(d.h)}</h3><p>${esc(d.p)}</p><span>${esc(d.go)}</span></a>`
    : `<button type="button" class="sv1-door" data-jump="${esc(d.target)}"><span class="ico">${d.ico}</span><h3>${esc(d.h)}</h3><p>${esc(d.p)}</p><span>${esc(d.go)}</span></button>`
  ).join("");

  const steps = [t("step1"), t("step2"), t("step3")]
    .map((s, i) => `<li><b class="sv1-mono">${i + 1}</b><span>${esc(s)}</span></li>`).join("");

  const CSS = `<style id="sv1-hire-css">
.sv1-hire-doors{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:22px 0 34px}
@media(max-width:860px){.sv1-hire-doors{grid-template-columns:1fr}}
.sv1-hire-sec{border-top:1px solid var(--line2);padding-top:26px;margin-top:26px}
.sv1-hire-sec>h3{font-size:19px;font-weight:500;color:var(--ink);margin:0 0 14px}
.sv1-hire-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px}
.sv1-hire-job{background:#fff;border:1px solid var(--l);border-radius:13px;padding:17px;box-shadow:var(--sh);display:flex;flex-direction:column;gap:8px}
.sv1-hire-job .mt{font-size:11.5px;color:var(--ac);font-weight:600}
.sv1-hire-job h4{font-size:15px;margin:0;font-weight:600;color:var(--ink);line-height:1.5}
.sv1-hire-job p{font-size:12.5px;color:var(--s);margin:0;line-height:1.65}
.sv1-hire-job .acts{display:flex;gap:7px;margin-top:auto;padding-top:6px}
.sv1-hire-steps{list-style:none;padding:0;margin:0 0 16px;display:grid;gap:11px;max-width:680px}
.sv1-hire-steps li{display:flex;gap:11px;align-items:flex-start;font-size:13.5px;color:var(--t);line-height:1.7}
.sv1-hire-steps b{flex:0 0 26px;height:26px;border-radius:50%;background:var(--acSoft);color:var(--ac);display:grid;place-items:center;font-size:12px;font-weight:600}
</style>`;

  const body = `${SV1.header("/hiring")}
  <main>
  <section class="sv1-sec"><div class="wrap">
    <div class="sv1-title">
      <span class="sv1-tag">${esc(t("tag"))}</span>
      <h2>${esc(t("title"))}</h2>
      <p>${esc(t("desc"))}</p>
    </div>

    <div class="sv1-tabs">
      <a class="sv1-tab" href="${esc(u("/catalog"))}">${esc(t("tabSvc"))}</a>
      <a class="sv1-tab" href="${esc(u("/catalog"))}?tab=packages">${esc(t("tabPkg"))}</a>
      <a class="sv1-tab" href="${esc(u("/trips"))}">${esc(t("tabTrip"))}</a>
      <button type="button" class="sv1-tab on">${esc(t("tabHire"))}</button>
    </div>

    <div class="sv1-hire-doors">${doors}</div>

    <div class="sv1-hire-sec" id="hireJobs">
      <h3>${esc(t("jobsHead"))}</h3>
      <p class="sv1-muted" id="hireJobsStatus">${esc(t("loading"))}</p>
      <div class="sv1-hire-grid" id="hireJobsGrid"></div>
    </div>

    <div class="sv1-hire-sec" id="hireSeek">
      <h3>${esc(t("seekHead"))}</h3>
      <ol class="sv1-hire-steps">${steps}</ol>
      <a class="sv1-btn" href="${esc(u("/careers"))}#seeker-form">${esc(t("seekCta"))}</a>
      <p class="sv1-muted" style="margin-top:12px;max-width:680px;font-size:12px">${esc(t("seekNote"))}</p>
    </div>
  </div></section>
  </main>`;

  const script = `<script>(function(){
var $=function(i){return document.getElementById(i)};
var TX=${JSON.stringify({ empty: t("empty"), failed: t("failed"), view: t("view"), apply: t("apply") })};
var JOB=${JSON.stringify(u("/job") + "?id=")};
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){
 return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
document.querySelectorAll('[data-jump]').forEach(function(b){b.onclick=function(){
 var el=$(b.getAttribute('data-jump'));if(el)el.scrollIntoView({behavior:'smooth',block:'start'})}});
var grid=$('hireJobsGrid'),st=$('hireJobsStatus');
fetch('/api/candidates?openJobs=1').then(function(r){return r.json()}).then(function(d){
 var jobs=(d&&d.ok&&d.jobs)||[];
 if(!jobs.length){st.textContent=TX.empty;return}
 st.hidden=true;
 grid.innerHTML=jobs.map(function(j){
  var meta=[j.company,j.city].filter(Boolean).join(' · ')||(j.field||'');
  var teaser=String(j.description||'').replace(/\\s+/g,' ').trim().slice(0,140);
  return '<article class="sv1-hire-job">'+(meta?'<span class="mt">'+esc(meta)+'</span>':'')+
   '<h4>'+esc(j.title)+'</h4>'+(teaser?'<p>'+esc(teaser)+'…</p>':'')+
   '<div class="acts"><a class="sv1-btn sm" href="'+JOB+encodeURIComponent(j.id)+'">'+esc(TX.view)+'</a>'+
   '<a class="sv1-btn sm ghost" href="'+JOB+encodeURIComponent(j.id)+'#apply-form">'+esc(TX.apply)+'</a></div></article>'}).join('')
}).catch(function(){st.textContent=TX.failed});
})();</script>`;

  return SV1.shell({
    title: `${t("title")} — Business Partner`,
    desc: t("desc"),
    path: "/hiring",
    body: CSS + body,
    script,
  });
}
