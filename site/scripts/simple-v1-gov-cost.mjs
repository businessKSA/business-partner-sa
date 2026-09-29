// Business Partner — Simple V1: حاسبة التكاليف الحكومية (/calculators/government-cost).
//
// نُقلت من buildGovernmentCostCalculator في generate.mjs (طبقة الموقع القديم)
// تطبيقاً لـ CLAUDE.md §2.6. الأسس السعرية والنصوص كما كانت؛ تغيّر الحساب في
// نقطة واحدة كانت خطأً:
//
//   كانت غرامة تأخير الإقامة تُضاف إلى الإجمالي الربعي ولا تُضاف إلى السنوي،
//   فيظهر السنوي أقل من المنطق. الآن: الربعي = المتكرّر فقط، والسنوي = المتكرّر
//   + ما يقع مرة واحدة (الغرامة، والفحص الطبي للعامل الجديد).
//
// fr و zh تعرض الإنجليزية حتى تُترجم، كبقية صفحات SV1.

const T = {
  title: { ar: "حاسبة التكاليف الحكومية", en: "Government cost calculator" },
  desc: {
    ar: "قدّر تكاليف العمالة الحكومية لكل عامل (رخصة العمل، الإقامة، التأمين الطبي، الغرامات) خلال ثوانٍ.",
    en: "Estimate per-worker government costs (work permit, iqama, medical insurance, fines) in seconds.",
  },
  tag: { ar: "أداة امتثال مجانية", en: "Free compliance tool" },
  sub: {
    ar: "رخصة العمل (قوى) + الإقامة (مقيم) + التأمين الطبي + الغرامات — لكل عامل، ربعياً وسنوياً.",
    en: "Work permit (Qiwa) + iqama (Muqeem) + medical insurance + fines — per worker, quarterly and annually.",
  },
  add: { ar: "+ إضافة مهنة أخرى", en: "+ Add another profession" },
  newNote: { ar: "العامل الجديد: 3 أشهر مجانية عند أول دخول + فحص طبي لمرة واحدة.", en: "New worker: 3 free months on first entry + a one-time medical exam." },
  rates: { ar: "الأسس السعرية المستخدمة (قابلة للتعديل)", en: "Rate basis used (editable)" },
  permit: { ar: "رخصة العمل — سنوياً", en: "Work permit — annual" },
  iqama: { ar: "الإقامة — سنوياً", en: "Iqama — annual" },
  medical: { ar: "التأمين الطبي — سنوياً", en: "Medical insurance — annual" },
  exam: { ar: "الفحص الطبي (للجديد)", en: "Medical exam (new)" },
  calc: { ar: "احسب", en: "Calculate" },
  workers: { ar: "عدد العمّال", en: "Workers" },
  quarter: { ar: "الإجمالي الربعي", en: "Quarterly total" },
  annual: { ar: "الإجمالي السنوي", en: "Annual total" },
  oneTime: { ar: "السنوي يشمل ما يقع مرة واحدة: الغرامة والفحص الطبي للعامل الجديد.", en: "The annual total includes one-time items: fines and the new worker's medical exam." },
  profession: { ar: "المهنة", en: "Profession" },
  status: { ar: "الحالة", en: "Status" },
  count: { ar: "العدد", en: "Count" },
  qPer: { ar: "ربعي / عامل", en: "Quarterly / worker" },
  aPer: { ar: "سنوي / عامل", en: "Annual / worker" },
  disclaimer: {
    ar: "الأرقام تقديرية للتوضيح فقط. الرسوم الرسمية تُعتمد من قوى / مقيم / الجوازات. تواصل معنا لحساب دقيق ومعتمد.",
    en: "Estimates are for illustration only. Official fees are confirmed via Qiwa / Muqeem / Passports. Contact us for a verified calculation.",
  },
  consult: { ar: "احجز استشارة", en: "Book a consultation" },
  guide: { ar: "دليل الهيكلة والرواتب", en: "Structure & salaries guide" },
  back: { ar: "كل الأدوات والحاسبات", en: "All tools & calculators" },
};

const JS_T = {
  ar: { prof: "المهنة", profPh: "مثال: عامل، فني، مهندس…", status: "الحالة", sExisting: "قائم (على رأس العمل)", sNew: "جديد (أول دخول)", count: "العدد", late: "تأخير تجديد الإقامة", lNone: "لا يوجد", lFirst: "المرة الأولى (+500)", lSecond: "المرة الثانية (+1,000)", remove: "حذف", sar: "﷼" },
  en: { prof: "Profession", profPh: "e.g. laborer, technician…", status: "Status", sExisting: "Existing (on the job)", sNew: "New (first entry)", count: "Count", late: "Iqama renewal delay", lNone: "None", lFirst: "First time (+500)", lSecond: "Second time (+1,000)", remove: "Remove", sar: "SAR" },
};

export function buildSimpleGovCost(SV1, ctx) {
  const { lang: langFn, esc } = ctx;
  const lang = langFn();
  const t = (k) => { const e = T[k]; return e[lang] != null ? e[lang] : e.en; };
  const pre = lang === "en" ? "" : "/" + lang;
  const u = (p) => pre + p;
  const arrow = lang === "ar" ? "→" : "←";

  const CSS = `<style id="sv1-cc-css">
.sv1-cc-head{max-width:820px;margin:0 0 24px}
.sv1-cc-head h1{font-size:clamp(28px,4vw,46px);line-height:1.15;margin:16px 0 12px;letter-spacing:-.03em;font-weight:200;color:var(--ink)}
.sv1-cc-back{display:inline-block;font-size:12.5px;color:var(--mut);margin-bottom:14px}
.sv1-cc-back:hover{color:var(--ink)}
.sv1-cc-card{background:#fff;border:1px solid var(--l);border-radius:14px;padding:24px;box-shadow:var(--sh);max-width:960px}
.sv1-cc-card h2{font-size:20px;font-weight:400;color:var(--ink);margin:0 0 6px}
.sv1-cc-card>p{color:var(--mut);font-size:13.5px;margin:0 0 18px}
.sv1-cc-row{display:grid;grid-template-columns:1.6fr 1.3fr .7fr 1.3fr auto;gap:10px;align-items:end;border:1px dashed var(--l);border-radius:11px;padding:12px;margin-bottom:10px}
.sv1-cc label{display:block;font-size:11.5px;color:var(--mut);margin-bottom:5px}
.sv1-cc input,.sv1-cc select{width:100%;border:1px solid var(--l);border-radius:10px;padding:10px 12px;font:inherit;font-size:13.5px;background:#fff;color:var(--t);outline:none}
.sv1-cc input:focus,.sv1-cc select:focus{border-color:var(--ac)}
.sv1-cc-rm{width:40px;height:40px;border-radius:10px;border:1px solid #F3D5D5;background:#FDF3F3;color:#B42318;cursor:pointer;font-size:14px}
.sv1-cc-add{width:100%;margin:2px 0 12px}
.sv1-cc-note{font-size:12.5px;color:var(--mut);margin:0 0 14px}
.sv1-cc-rates{border:1px solid var(--line2);border-radius:11px;padding:10px 14px;margin:0 0 16px;background:var(--g)}
.sv1-cc-rates summary{cursor:pointer;font-size:13px;color:var(--ink)}
.sv1-cc-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px}
.sv1-cc-res{margin-top:20px}
.sv1-cc-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px}
.sv1-cc-tile{border:1px solid var(--acLine);background:var(--acSoft);border-radius:12px;padding:14px}
.sv1-cc-tile span{display:block;font-size:12px;color:var(--mut)}
.sv1-cc-tile strong{display:block;font-size:22px;font-weight:500;color:var(--ink);margin-top:4px}
.sv1-cc-tbl{overflow-x:auto;border:1px solid var(--l);border-radius:10px}
.sv1-cc-tbl table{width:100%;border-collapse:collapse;min-width:560px;font-size:13px}
.sv1-cc-tbl th,.sv1-cc-tbl td{padding:9px 12px;text-align:start;border-bottom:1px solid var(--line2)}
.sv1-cc-tbl th{background:var(--g);color:var(--ink);font-weight:500;font-size:12px}
.sv1-cc-tbl tr:last-child td{border-bottom:0}
.sv1-cc-fine{font-size:11px;color:#B42318;background:#FDF3F3;border-radius:6px;padding:1px 6px;margin-inline-start:6px}
.sv1-cc-disc{margin-top:16px;background:var(--acSoft);border:1px solid var(--acLine);border-radius:10px;padding:12px 14px;font-size:12.5px;line-height:1.8;color:var(--t);max-width:960px}
.sv1-cc-acts{display:flex;gap:9px;flex-wrap:wrap;margin-top:22px}
@media(max-width:860px){.sv1-cc-row{grid-template-columns:1fr 1fr}.sv1-cc-row .sv1-cc-prof-f{grid-column:1/-1}.sv1-cc-grid{grid-template-columns:1fr 1fr}.sv1-cc-tiles{grid-template-columns:1fr}.sv1-cc-card{padding:16px}}
</style>`;

  const body = `${SV1.header("/calculators/government-cost")}
  <main>
  <section class="sv1-sec"><div class="wrap">
    <div class="sv1-cc-head">
      <a class="sv1-cc-back" href="${esc(u("/tools-and-calculators"))}">${arrow} ${esc(t("back"))}</a><br>
      <span class="sv1-tag">${esc(t("tag"))}</span>
      <h1>${esc(t("title"))}</h1>
      <p class="sv1-lead" style="max-width:none">${esc(t("desc"))}</p>
    </div>
    <div class="sv1-cc-card sv1-cc">
      <h2>${esc(t("title"))}</h2>
      <p>${esc(t("sub"))}</p>
      <div id="ccRows"></div>
      <button type="button" class="sv1-btn sv1-cc-add" id="ccAdd">${esc(t("add"))}</button>
      <p class="sv1-cc-note">💡 ${esc(t("newNote"))}</p>
      <details class="sv1-cc-rates"><summary>⚙️ ${esc(t("rates"))}</summary>
        <div class="sv1-cc-grid">
          <div><label for="ccPermit">${esc(t("permit"))}</label><input type="number" id="ccPermit" value="9700" inputmode="numeric"></div>
          <div><label for="ccIqama">${esc(t("iqama"))}</label><input type="number" id="ccIqama" value="650" inputmode="numeric"></div>
          <div><label for="ccMedical">${esc(t("medical"))}</label><input type="number" id="ccMedical" value="1000" inputmode="numeric"></div>
          <div><label for="ccExam">${esc(t("exam"))}</label><input type="number" id="ccExam" value="300" inputmode="numeric"></div>
        </div>
      </details>
      <button type="button" class="sv1-btn primary" id="ccCalc">${esc(t("calc"))}</button>
      <div class="sv1-cc-res" id="ccRes" hidden>
        <div class="sv1-cc-tiles">
          <div class="sv1-cc-tile"><span>${esc(t("workers"))}</span><strong class="sv1-mono en" id="ccWorkers">—</strong></div>
          <div class="sv1-cc-tile"><span>${esc(t("quarter"))}</span><strong class="sv1-mono en" id="ccQuarter">—</strong></div>
          <div class="sv1-cc-tile"><span>${esc(t("annual"))}</span><strong class="sv1-mono en" id="ccAnnual">—</strong></div>
        </div>
        <p class="sv1-cc-note">${esc(t("oneTime"))}</p>
        <div class="sv1-cc-tbl"><table><thead><tr>
          <th>${esc(t("profession"))}</th><th>${esc(t("status"))}</th><th>${esc(t("count"))}</th><th>${esc(t("qPer"))}</th><th>${esc(t("aPer"))}</th>
        </tr></thead><tbody id="ccBody"></tbody></table></div>
      </div>
    </div>
    <div class="sv1-cc-disc">⚖️ ${esc(t("disclaimer"))}</div>
    <div class="sv1-cc-acts">
      <a class="sv1-btn primary" href="${esc(u("/consultation"))}">${esc(t("consult"))}</a>
      <a class="sv1-btn" href="${esc(u("/guide/company-structure"))}">${esc(t("guide"))}</a>
    </div>
  </div></section>
  </main>
${SV1.footer()}`;

  const script = `<script>(function(){
var T=${JSON.stringify(JS_T[lang] || JS_T.en)},AR=${JSON.stringify(lang === "ar")};
var $=function(i){return document.getElementById(i)};
var fmt=function(n){return Math.round(n).toLocaleString(AR?"ar-SA":"en-US")};
var FINES={none:0,first:500,second:1000};
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function addRow(count){
 var d=document.createElement("div");d.className="sv1-cc-row";
 d.innerHTML='<div class="sv1-cc-prof-f"><label>'+T.prof+'</label><input type="text" class="ccProf" placeholder="'+T.profPh+'"></div>'+
  '<div><label>'+T.status+'</label><select class="ccStatus"><option value="existing">'+T.sExisting+'</option><option value="new">'+T.sNew+'</option></select></div>'+
  '<div><label>'+T.count+'</label><input type="number" class="ccCount" min="1" inputmode="numeric" value="'+(count||1)+'"></div>'+
  '<div><label>'+T.late+'</label><select class="ccLate"><option value="none">'+T.lNone+'</option><option value="first">'+T.lFirst+'</option><option value="second">'+T.lSecond+'</option></select></div>'+
  '<button type="button" class="sv1-cc-rm" title="'+T.remove+'" aria-label="'+T.remove+'">✕</button>';
 d.querySelector(".sv1-cc-rm").onclick=function(){if(document.querySelectorAll(".sv1-cc-row").length>1)d.remove()};
 $("ccRows").appendChild(d)}
addRow(5);
$("ccAdd").onclick=function(){addRow()};
$("ccCalc").onclick=function(){
 var pA=Number($("ccPermit").value)||0,iA=Number($("ccIqama").value)||0,mA=Number($("ccMedical").value)||0,ex=Number($("ccExam").value)||0;
 var qRec=(pA+iA+mA)/4,workers=0,tQ=0,tA=0,rows=[];
 document.querySelectorAll(".sv1-cc-row").forEach(function(r){
  var prof=r.querySelector(".ccProf").value.trim()||"—",isNew=r.querySelector(".ccStatus").value==="new";
  var count=Math.max(1,Math.floor(Number(r.querySelector(".ccCount").value))||1);
  var fine=FINES[r.querySelector(".ccLate").value]||0;
  var aPer=pA+iA+mA+(isNew?ex:0)+fine;
  workers+=count;tQ+=qRec*count;tA+=aPer*count;
  rows.push("<tr><td>"+esc(prof)+(fine?'<span class="sv1-cc-fine">+'+fmt(fine)+"</span>":"")+"</td><td>"+(isNew?T.sNew:T.sExisting)+'</td><td class="sv1-mono">'+count+'</td><td class="sv1-mono">'+fmt(qRec)+'</td><td class="sv1-mono">'+fmt(aPer)+"</td></tr>")});
 $("ccBody").innerHTML=rows.join("");
 $("ccWorkers").textContent=fmt(workers);
 $("ccQuarter").textContent=fmt(tQ)+" "+T.sar;
 $("ccAnnual").textContent=fmt(tA)+" "+T.sar;
 $("ccRes").hidden=false;
 $("ccRes").scrollIntoView({behavior:"smooth",block:"nearest"})};
})();</script>`;

  return SV1.shell({
    title: `${t("title")} — Business Partner`,
    desc: t("desc"),
    path: "/calculators/government-cost",
    body: CSS + body,
    script,
  });
}
