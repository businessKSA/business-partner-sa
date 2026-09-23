// ‏حجز استشارة — صفحة على تصميم Simple V1 مربوطة بتقويم الشركة.
//
// الفترات تُقرأ من /api/book?action=slots: أوقات العمل بتوقيت الرياض، بلا
// الجمعة، بلا ما مضى، بلا ما هو دون مهلة الحجز، وبلا ما هو مشغولٌ في تقويم
// جوجل حين يكون مربوطاً. وحين لا يكون مربوطاً تظهر الفترات كلها ويُقال
// للعميل إن الفريق يؤكّد الموعد — لا وعدَ تأكيدٍ فوريٍّ لا نملكه.

const D = {
  title:  { ar: "احجز استشارة", en: "Book a consultation", fr: "Réserver une consultation", zh: "预约咨询" },
  desc:   { ar: "ثلاثون دقيقة مع مختص — تشرح فيها حالتك وتخرج بخطوات واضحة.",
            en: "Thirty minutes with a specialist — explain your case and leave with clear steps.",
            fr: "Trente minutes avec un spécialiste — exposez votre cas et repartez avec des étapes claires.",
            zh: "与专家进行三十分钟沟通 — 说明您的情况并获得明确步骤。" },
  tag:    { ar: "استشارة", en: "Consultation", fr: "Consultation", zh: "咨询" },
  pickDay:{ ar: "اختر اليوم", en: "Pick a day", fr: "Choisissez un jour", zh: "选择日期" },
  pickTime:{ar: "اختر الوقت", en: "Pick a time", fr: "Choisissez l'heure", zh: "选择时间" },
  yourInfo:{ ar: "بياناتك", en: "Your details", fr: "Vos coordonnées", zh: "您的信息" },
  name:   { ar: "الاسم الكامل", en: "Full name", fr: "Nom complet", zh: "姓名" },
  phone:  { ar: "رقم الجوال", en: "Mobile", fr: "Mobile", zh: "手机号" },
  email:  { ar: "البريد الإلكتروني", en: "Email", fr: "E-mail", zh: "电子邮箱" },
  topic:  { ar: "موضوع الاستشارة", en: "What is it about", fr: "Sujet", zh: "咨询主题" },
  notes:  { ar: "تفاصيل تساعدنا (اختياري)", en: "Anything that helps us (optional)",
            fr: "Détails utiles (facultatif)", zh: "补充信息（可选）" },
  book:   { ar: "أكّد الحجز", en: "Confirm booking", fr: "Confirmer", zh: "确认预约" },
  loading:{ ar: "نقرأ المواعيد المتاحة…", en: "Loading available times…",
            fr: "Chargement des créneaux…", zh: "正在加载可预约时间…" },
  noSlots:{ ar: "لا مواعيد متاحة في المدى القريب. راسلنا على واتساب ونرتّب لك موعداً.",
            en: "No times available soon. Message us on WhatsApp and we will arrange one.",
            fr: "Aucun créneau proche. Écrivez-nous sur WhatsApp et nous organiserons.",
            zh: "近期没有可用时间。请通过 WhatsApp 联系我们安排。" },
  need:   { ar: "أكمل الاسم والجوال والبريد واختر موعداً.",
            en: "Fill in name, mobile and e-mail, and pick a time.",
            fr: "Renseignez nom, mobile et e-mail, et choisissez un créneau.",
            zh: "请填写姓名、手机号和邮箱，并选择时间。" },
  busy:   { ar: "نؤكّد حجزك…", en: "Confirming…", fr: "Confirmation…", zh: "正在确认…" },
  taken:  { ar: "حُجزت هذه الفترة قبل قليل. اختر فترة أخرى.",
            en: "That slot was just taken. Please pick another.",
            fr: "Ce créneau vient d'être pris. Choisissez-en un autre.",
            zh: "该时段刚被预订，请另选。" },
  failed: { ar: "تعذّر تأكيد الحجز. حاول مرة أخرى أو راسلنا على واتساب.",
            en: "Could not confirm. Try again or message us on WhatsApp.",
            fr: "Confirmation impossible. Réessayez ou écrivez-nous sur WhatsApp.",
            zh: "无法确认。请重试或通过 WhatsApp 联系我们。" },
  doneT:  { ar: "تم الحجز", en: "Booked", fr: "Réservé", zh: "预约成功" },
  doneOn: { ar: "موعدك", en: "Your appointment", fr: "Votre rendez-vous", zh: "您的预约" },
  meet:   { ar: "رابط الاجتماع", en: "Meeting link", fr: "Lien de réunion", zh: "会议链接" },
  addCal: { ar: "أضِف إلى تقويمك", en: "Add to your calendar", fr: "Ajouter à votre agenda", zh: "添加到日历" },
  mailed: { ar: "أرسلنا التفاصيل إلى بريدك.", en: "We emailed you the details.",
            fr: "Nous vous avons envoyé les détails par e-mail.", zh: "详情已发送至您的邮箱。" },
  confirm:{ ar: "الفريق يؤكّد الموعد ويصلك التأكيد على بريدك.",
            en: "The team confirms the time and you get the confirmation by e-mail.",
            fr: "L'équipe confirme le créneau et vous recevez la confirmation par e-mail.",
            zh: "团队确认时间后会通过邮件通知您。" },
  tz:     { ar: "بتوقيت الرياض", en: "Riyadh time", fr: "Heure de Riyad", zh: "利雅得时间" },
  mins:   { ar: "دقيقة", en: "minutes", fr: "minutes", zh: "分钟" },
  another:{ ar: "احجز موعداً آخر", en: "Book another", fr: "Réserver un autre", zh: "再预约一次" },
};

export function buildSimpleBook(sv1, ctx) {
  const { lang, esc } = ctx;
  const t = (k) => { const e = D[k]; if (!e) return k; const l = lang(); return e[l] != null ? e[l] : e.ar; };
  const pre = lang() === "en" ? "" : "/" + lang();

  const CSS = `<style id="sv1-bk-css">
.sv1-bk{display:grid;grid-template-columns:1.15fr .85fr;gap:18px;align-items:start;max-width:960px;margin:0 auto}
.sv1-bk>*{min-width:0}
.sv1-bk h4{margin:0 0 12px;font-size:14px;font-weight:500;color:var(--ink)}
.sv1-bk-days{display:flex;gap:7px;overflow-x:auto;padding-bottom:4px}
.sv1-bk-day{flex:none;border:1px solid var(--l);background:#fff;border-radius:11px;padding:10px 13px;
 cursor:pointer;font-family:inherit;text-align:center;min-width:76px;transition:.12s}
.sv1-bk-day:hover{border-color:var(--ac)}
.sv1-bk-day.on{background:var(--ac);border-color:var(--ac);color:#fff}
.sv1-bk-day b{display:block;font-size:17px;font-family:var(--fm);font-weight:500;line-height:1.3}
.sv1-bk-day span{display:block;font-size:10.5px;opacity:.75}
.sv1-bk-times{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:7px;margin-top:16px}
.sv1-bk-t{border:1px solid var(--l);background:#fff;border-radius:9px;padding:10px 6px;cursor:pointer;
 font-family:var(--fm);font-size:13px;color:var(--ink);transition:.12s}
.sv1-bk-t:hover{border-color:var(--ac);color:var(--ac)}
.sv1-bk-t.on{background:var(--ac);border-color:var(--ac);color:#fff}
.sv1-bk-f{display:grid;gap:11px}
.sv1-bk-f label{display:block;font-size:11.5px;color:var(--mut);margin-bottom:5px}
.sv1-bk-in{width:100%;border:1px solid var(--l);border-radius:10px;padding:11px 13px;font:inherit;font-size:13.5px;outline:none;background:#fff}
.sv1-bk-in:focus{border-color:var(--ac)}
textarea.sv1-bk-in{min-height:74px;resize:vertical}
.sv1-bk-when{background:var(--acSoft);border:1px solid var(--acLine);border-radius:10px;padding:11px 13px;
 font-size:12.5px;color:var(--ink);display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}
.sv1-bk-when b{font-weight:500}
.sv1-bk-msg{font-size:12px;line-height:1.75;margin-top:9px}
.sv1-bk-msg.err{color:#b42318}
.sv1-bk-note{font-size:11.5px;color:var(--faint);line-height:1.8;margin-top:10px}
.sv1-bk-wait{font-size:12.5px;color:var(--mut);padding:18px 0}
.sv1-bk-done{max-width:560px;margin:0 auto;text-align:center;border:1px solid var(--l);border-radius:15px;
 background:#fff;padding:34px 26px;box-shadow:var(--sh2)}
.sv1-bk-done .ic{width:52px;height:52px;border-radius:50%;background:var(--okSoft);color:var(--ok);
 display:grid;place-items:center;font-size:24px;margin:0 auto 14px}
.sv1-bk-done h3{font-size:21px;font-weight:400;margin:0 0 6px}
.sv1-bk-done .when{font-size:17px;color:var(--ac);margin:14px 0 6px}
.sv1-bk-done p{font-size:13px;color:var(--mut);line-height:1.85;margin:0}
.sv1-bk-done .acts{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:18px}
@media(max-width:900px){.sv1-bk{grid-template-columns:1fr}}
</style>`;

  const body = `${sv1.header("/consultation", { cta: false })}
<main>
  <section class="sv1-sec"><div class="wrap">
    <div class="sv1-title">
      <span class="sv1-tag">${esc(t("tag"))}</span>
      <h2>${esc(t("title"))}</h2>
      <p>${esc(t("desc"))}</p>
    </div>

    <div id="bkForm" class="sv1-bk">
      <div class="sv1-panel">
        <h4>${esc(t("pickDay"))}</h4>
        <div class="sv1-bk-days" id="bkDays"><span class="sv1-bk-wait">${esc(t("loading"))}</span></div>
        <div id="bkTimesWrap" class="sv1-hide">
          <h4 style="margin-top:18px">${esc(t("pickTime"))} <span class="sv1-bk-note" style="margin:0">· ${esc(t("tz"))}</span></h4>
          <div class="sv1-bk-times" id="bkTimes"></div>
        </div>
        <p class="sv1-bk-note" id="bkCalNote"></p>
      </div>

      <div class="sv1-panel">
        <h4>${esc(t("yourInfo"))}</h4>
        <div class="sv1-bk-when sv1-hide" id="bkWhen"></div>
        <div class="sv1-bk-f" style="margin-top:11px">
          <div><label for="bkName">${esc(t("name"))}</label><input id="bkName" class="sv1-bk-in" autocomplete="name"></div>
          <div><label for="bkPhone">${esc(t("phone"))}</label><input id="bkPhone" class="sv1-bk-in" inputmode="tel" autocomplete="tel"></div>
          <div><label for="bkEmail">${esc(t("email"))}</label><input id="bkEmail" class="sv1-bk-in" type="email" autocomplete="email"></div>
          <div><label for="bkTopic">${esc(t("topic"))}</label><input id="bkTopic" class="sv1-bk-in"></div>
          <div><label for="bkNotes">${esc(t("notes"))}</label><textarea id="bkNotes" class="sv1-bk-in"></textarea></div>
        </div>
        <button type="button" class="sv1-btn primary" id="bkGo" style="width:100%;margin-top:13px">${esc(t("book"))}</button>
        <div class="sv1-bk-msg" id="bkMsg"></div>
      </div>
    </div>

    <div id="bkDone" class="sv1-bk-done sv1-hide"></div>
  </div></section>
</main>`;

  const T = {};
  for (const k of ["loading","noSlots","need","busy","taken","failed","doneT","doneOn","meet","addCal","mailed","confirm","tz","mins","another","pickTime"]) T[k] = t(k);

  const script = `<script>
(function(){
var TX=${JSON.stringify(T)},HOME=${JSON.stringify(pre + "/")},AR=${lang() === "ar" ? "true" : "false"};
var $=function(id){return document.getElementById(id)};
var DAYS=[],pick={date:'',time:''},slotMin=30,calState='off';
var DOW=AR?['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت']
          :['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
var MON=AR?['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
          :['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function dparts(d){var x=new Date(d+'T12:00:00+03:00');return {dow:DOW[x.getUTCDay()],day:x.getUTCDate(),mon:MON[x.getUTCMonth()]}}

function drawDays(){
 var host=$('bkDays');host.innerHTML='';
 if(!DAYS.length){var e=document.createElement('span');e.className='sv1-bk-wait';e.textContent=TX.noSlots;host.appendChild(e);return}
 DAYS.forEach(function(d){
  var p=dparts(d.date);
  var b=document.createElement('button');b.type='button';
  b.className='sv1-bk-day'+(pick.date===d.date?' on':'');
  var n=document.createElement('b');n.textContent=String(p.day);
  var s=document.createElement('span');s.textContent=p.dow;
  var m=document.createElement('span');m.textContent=p.mon;
  b.appendChild(s);b.appendChild(n);b.appendChild(m);
  b.onclick=function(){pick.date=d.date;pick.time='';drawDays();drawTimes();drawWhen()};
  host.appendChild(b)})}

function drawTimes(){
 var wrap=$('bkTimesWrap'),host=$('bkTimes');host.innerHTML='';
 var d=DAYS.filter(function(x){return x.date===pick.date})[0];
 wrap.classList.toggle('sv1-hide',!d);
 if(!d)return;
 d.slots.forEach(function(tm){
  var b=document.createElement('button');b.type='button';
  b.className='sv1-bk-t'+(pick.time===tm?' on':'');b.textContent=tm;
  b.onclick=function(){pick.time=tm;drawTimes();drawWhen()};
  host.appendChild(b)})}

function drawWhen(){
 var el=$('bkWhen');
 if(!pick.date||!pick.time){el.classList.add('sv1-hide');return}
 var p=dparts(pick.date);
 el.classList.remove('sv1-hide');el.textContent='';
 var a=document.createElement('span');a.textContent=p.dow+' '+p.day+' '+p.mon;
 var b=document.createElement('b');
 var bt=document.createElement('span');bt.className='sv1-mono';bt.textContent=pick.time;
 b.appendChild(bt);b.appendChild(document.createTextNode(' \u00b7 '+slotMin+' '+TX.mins));
 el.appendChild(a);el.appendChild(b)}

function load(){
 fetch('/api/book?action=slots').then(function(r){return r.json()}).then(function(o){
  if(!o||!o.ok){$('bkDays').innerHTML='';drawDays();return}
  DAYS=o.days||[];slotMin=o.slotMinutes||30;calState=o.calendar||'off';
  // تقويمٌ غير مربوط يعني أن الفترة قد تكون مشغولة عندنا: يُقال ذلك بدل
  // إيهام العميل بتأكيدٍ فوريٍّ لا يملكه أحد.
  $('bkCalNote').textContent=(calState==='linked')?'':TX.confirm;
  if(DAYS.length){pick.date=DAYS[0].date}
  drawDays();drawTimes();drawWhen()})
 .catch(function(){DAYS=[];drawDays()})}

function ready(){return $('bkName').value.trim()&&$('bkPhone').value.trim()&&
 $('bkEmail').value.trim().indexOf('@')>0&&pick.date&&pick.time}

$('bkGo').onclick=function(){
 var msg=$('bkMsg');msg.className='sv1-bk-msg';
 if(!ready()){msg.className='sv1-bk-msg err';msg.textContent=TX.need;return}
 var self=this;self.disabled=true;msg.textContent=TX.busy;
 fetch('/api/book',{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({name:$('bkName').value.trim(),phone:$('bkPhone').value.trim(),
   email:$('bkEmail').value.trim().toLowerCase(),topic:$('bkTopic').value.trim(),
   notes:$('bkNotes').value.trim(),date:pick.date,time:pick.time})})
 .then(function(r){return r.json()}).then(function(o){
  self.disabled=false;
  if(!o||!o.ok){
   msg.className='sv1-bk-msg err';
   msg.textContent=(o&&o.error==='slot_taken')?TX.taken:TX.failed;
   if(o&&o.error==='slot_taken')load();
   return}
  done(o)})
 .catch(function(){self.disabled=false;msg.className='sv1-bk-msg err';msg.textContent=TX.failed})};

function done(o){
 $('bkForm').classList.add('sv1-hide');
 var box=$('bkDone');box.classList.remove('sv1-hide');box.textContent='';
 var ic=document.createElement('div');ic.className='ic';ic.textContent='\\u2713';box.appendChild(ic);
 var h=document.createElement('h3');h.textContent=TX.doneT;box.appendChild(h);
 var p=dparts(pick.date);
 var w=document.createElement('div');w.className='when';
 var wd=document.createElement('span');wd.textContent=p.dow+' '+p.day+' '+p.mon+' \u00b7 ';
 var wt=document.createElement('span');wt.className='sv1-mono';wt.textContent=pick.time;
 var wz=document.createElement('span');wz.textContent=' ('+TX.tz+')';
 w.appendChild(wd);w.appendChild(wt);w.appendChild(wz);box.appendChild(w);
 var t1=document.createElement('p');t1.textContent=o.emailSent?TX.mailed:TX.confirm;box.appendChild(t1);
 var acts=document.createElement('div');acts.className='acts';
 if(o.meet){var m=document.createElement('a');m.className='sv1-btn primary sm';m.href=o.meet;m.target='_blank';m.rel='noopener';m.textContent=TX.meet;acts.appendChild(m)}
 if(o.gcalUrl){var g=document.createElement('a');g.className='sv1-btn sm';g.href=o.gcalUrl;g.target='_blank';g.rel='noopener';g.textContent=TX.addCal;acts.appendChild(g)}
 var again=document.createElement('button');again.type='button';again.className='sv1-btn sm';
 again.textContent=TX.another;again.onclick=function(){location.reload()};acts.appendChild(again);
 box.appendChild(acts);
 try{window.scrollTo({top:0,behavior:'smooth'})}catch(e){}}

load();
})();</script>`;

  return sv1.shell({ title: `${t("title")} — Business Partner`, desc: t("desc"), path: "/consultation", body: CSS + body, script });
}
