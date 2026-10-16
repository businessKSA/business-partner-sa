// ‏«الاتصال المرئي — استشارة مجانية»: صفحة الحجز على تصميم Simple V1 مربوطة
// بتقويم الشركة (Google Calendar + Google Meet).
//
// الفترات والساعات تُقرأ من /api/book?action=slots ولا يُكتب في الصفحة رقمُ
// ساعةٍ ولا يومٍ: أوقات العمل بتوقيت الرياض، بلا يوم العطلة، بلا ما مضى، بلا ما
// هو دون مهلة الحجز، وبلا ما هو مشغولٌ في تقويم جوجل. وحين لا يكون التقويم
// مربوطاً يُقال للعميل صراحةً إن الموعد «طلبٌ بانتظار التأكيد» — لا وعدَ
// تأكيدٍ ولا رابطَ اجتماعٍ لا نملكه.
//
// ‏?manage=<مرجع>&t=<توقيع> — الرابط الذي في بريد التأكيد: تغيير الموعد أو إلغاؤه.

const D = {
  title:  { ar: "الاتصال المرئي — استشارة مجانية", en: "Video call — free consultation",
            fr: "Appel vidéo — consultation gratuite", zh: "视频通话 — 免费咨询" },
  desc:   { ar: "جلسة بالفيديو مع مختص: تشرح حالتك وتخرج بخطوات واضحة. مجانية، وتحجزها بنفسك في أقل من دقيقة.",
            en: "A video session with a specialist: explain your case and leave with clear steps. Free, and you book it yourself in under a minute.",
            fr: "Une séance vidéo avec un spécialiste : exposez votre cas et repartez avec des étapes claires. Gratuite, réservée en moins d'une minute.",
            zh: "与专家进行视频会谈：说明您的情况并获得明确步骤。免费，一分钟内自助预约。" },
  tag:    { ar: "مجانية", en: "Free", fr: "Gratuite", zh: "免费" },
  fFree:  { ar: "مجانية بالكامل — بلا التزام", en: "Completely free — no commitment", fr: "Entièrement gratuite — sans engagement", zh: "完全免费 — 无任何义务" },
  fMeet:  { ar: "اجتماع بالفيديو عبر Google Meet", en: "Video meeting on Google Meet", fr: "Réunion vidéo sur Google Meet", zh: "通过 Google Meet 进行视频会议" },
  fLink:  { ar: "الرابط يصلك على بريدك وبدعوة في تقويمك", en: "The link reaches you by e-mail and as a calendar invitation", fr: "Le lien vous parvient par e-mail et en invitation d'agenda", zh: "会议链接将通过邮件和日历邀请发送给您" },
  fHours: { ar: "من {a} إلى {b} بتوقيت الرياض (GMT+3)", en: "{a} – {b} Riyadh time (GMT+3)", fr: "de {a} à {b}, heure de Riyad (GMT+3)", zh: "{a}–{b}（利雅得时间 GMT+3）" },
  fDays:  { ar: "كل الأيام عدا {d}", en: "Every day except {d}", fr: "Tous les jours sauf {d}", zh: "除{d}外每天" },
  fDaysAll:{ ar: "كل أيام الأسبوع", en: "Every day of the week", fr: "Tous les jours de la semaine", zh: "每周每天" },
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
  hoursNote:{ ar: "الأوقات كلها بتوقيت الرياض (GMT+3).", en: "All times are Riyadh time (GMT+3).", fr: "Toutes les heures sont à l'heure de Riyad (GMT+3).", zh: "所有时间均为利雅得时间（GMT+3）。" },
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
  doneT:  { ar: "تم تأكيد موعدك", en: "Your session is confirmed", fr: "Votre séance est confirmée", zh: "您的预约已确认" },
  pendT:  { ar: "استلمنا طلب موعدك", en: "We received your request", fr: "Nous avons reçu votre demande", zh: "我们已收到您的预约申请" },
  pendMsg:{ ar: "لم يُؤكَّد الموعد بعد. يثبّته الفريق ثم يصلك رابط الاجتماع ودعوة التقويم على بريدك.",
            en: "The time is not confirmed yet. The team will confirm it, then the meeting link and calendar invitation reach your e-mail.",
            fr: "Le créneau n'est pas encore confirmé. L'équipe le confirme, puis le lien et l'invitation d'agenda arrivent par e-mail.",
            zh: "时间尚未确认。团队确认后，会议链接和日历邀请将发送到您的邮箱。" },
  invMsg: { ar: "وصلتك دعوة تقويم من Google ورابط الاجتماع على بريدك.", en: "A Google Calendar invitation and the meeting link are on their way to your e-mail.",
            fr: "Une invitation Google Agenda et le lien de la réunion arrivent par e-mail.", zh: "Google 日历邀请和会议链接已发送至您的邮箱。" },
  linkKeep:{ ar: "احتفظ برابط الاجتماع أدناه — لم نستطع إرسال البريد الآن.", en: "Keep the meeting link below — we could not send the e-mail right now.",
             fr: "Gardez le lien ci-dessous — l'e-mail n'a pas pu partir.", zh: "请保存下方会议链接 — 邮件暂时无法发送。" },
  joinNote:{ ar: "ينفتح الانضمام قبل الموعد بخمس دقائق.", en: "You can join five minutes before the start.", fr: "Vous pouvez rejoindre cinq minutes avant le début.", zh: "开始前五分钟即可加入。" },
  mgChange:{ ar: "تغيير الموعد", en: "Change time", fr: "Changer l'horaire", zh: "更改时间" },
  mgCancel:{ ar: "إلغاء الموعد", en: "Cancel session", fr: "Annuler la séance", zh: "取消预约" },
  mgAsk:  { ar: "تأكيد إلغاء الموعد؟", en: "Cancel this session?", fr: "Annuler cette séance ?", zh: "确认取消此预约？" },
  mgTitle:{ ar: "إدارة موعدك", en: "Manage your session", fr: "Gérer votre séance", zh: "管理您的预约" },
  mgCancelled:{ ar: "أُلغي الموعد", en: "Session cancelled", fr: "Séance annulée", zh: "预约已取消" },
  mgMoved:{ ar: "تم تغيير موعدك", en: "Your session was rescheduled", fr: "Votre séance a été reprogrammée", zh: "您的预约已改期" },
  mgSave: { ar: "أكّد الوقت الجديد", en: "Confirm the new time", fr: "Confirmer le nouvel horaire", zh: "确认新时间" },
  mgBad:  { ar: "رابط الإدارة غير صالح أو منتهٍ. اكتب لنا على واتساب ونرتّب لك.", en: "This management link is invalid. Message us on WhatsApp and we will help.",
            fr: "Ce lien est invalide. Écrivez-nous sur WhatsApp.", zh: "此管理链接无效。请通过 WhatsApp 联系我们。" },
  mgGone: { ar: "هذا الموعد ملغى أو مضى.", en: "This session is cancelled or has passed.", fr: "Cette séance est annulée ou passée.", zh: "此预约已取消或已过。" },
  signin: { ar: "سجّل دخولك", en: "Sign in", fr: "Se connecter", zh: "登录" },
  doneOn: { ar: "موعدك", en: "Your appointment", fr: "Votre rendez-vous", zh: "您的预约" },
  meet:   { ar: "رابط الاجتماع", en: "Meeting link", fr: "Lien de réunion", zh: "会议链接" },
  addCal: { ar: "أضِف إلى تقويمك", en: "Add to your calendar", fr: "Ajouter à votre agenda", zh: "添加到日历" },
  mailed: { ar: "أرسلنا التفاصيل إلى بريدك.", en: "We emailed you the details.",
            fr: "Nous vous avons envoyé les détails par e-mail.", zh: "详情已发送至您的邮箱。" },
  confirm:{ ar: "التقويم غير مربوط الآن: طلبك يُسجَّل والفريق يؤكّد الموعد ويرسل لك الرابط على بريدك.",
            en: "The calendar is not linked right now: your request is recorded and the team confirms the time and e-mails you the link.",
            fr: "L'agenda n'est pas relié pour le moment : votre demande est enregistrée et l'équipe confirme et vous envoie le lien par e-mail.",
            zh: "日历暂未连接：您的申请已记录，团队确认时间后会通过邮件发送链接。" },
  tz:     { ar: "بتوقيت الرياض", en: "Riyadh time", fr: "Heure de Riyad", zh: "利雅得时间" },
  mins:   { ar: "دقيقة", en: "minutes", fr: "minutes", zh: "分钟" },
  another:{ ar: "احجز موعداً آخر", en: "Book another", fr: "Réserver un autre", zh: "再预约一次" },
  refLbl: { ar: "رقم الحجز", en: "Booking no.", fr: "N° de réservation", zh: "预约编号" },
  refKeep:{ ar: "احتفظ بهذا الرقم — اذكره إن راسلتنا بخصوص الموعد.", en: "Keep this number — quote it if you write to us about the appointment.",
            fr: "Gardez ce numéro — indiquez-le si vous nous écrivez au sujet du rendez-vous.", zh: "请保存此编号——就该预约联系我们时请提供。" },
  // تعبئة موضوع الاستشارة مسبقاً من ?topic= — يرسلها زرّ /hiring.
  tpRecGen:{ ar: "توظيف بالجملة / منصب قيادي — خدمة التوظيف والاستقدام",
             en: "Bulk hiring / leadership role — Recruitment service",
             fr: "Recrutement en volume / poste de direction — Service de recrutement",
             zh: "批量招聘 / 高管职位 — 招聘与引进服务" },
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
.sv1-bk-facts{list-style:none;margin:16px auto 0;padding:0;display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:820px}
.sv1-bk-facts li{font-size:12.5px;color:var(--ink);background:var(--acSoft);border:1px solid var(--acLine);border-radius:99px;padding:6px 13px;line-height:1.6}
.sv1-bk-done .ic.wait{background:var(--acSoft);color:var(--ac)}
.sv1-bk-done .meetrow{margin:14px 0 0;font-size:12.5px;color:var(--mut);word-break:break-all}
.sv1-bk-done .meetrow bdi{direction:ltr;display:inline-block}
.sv1-bk-done a.lnk{font-size:12.5px;color:var(--ac);cursor:pointer;text-decoration:underline}
@media(max-width:900px){.sv1-bk{grid-template-columns:1fr}}
</style>`;

  const body = `${sv1.header("/consultation", { cta: false })}
<main>
  <section class="sv1-sec"><div class="wrap">
    <div class="sv1-title">
      <span class="sv1-tag">${esc(t("tag"))}</span>
      <h2>${esc(t("title"))}</h2>
      <p>${esc(t("desc"))}</p>
      <ul class="sv1-bk-facts" id="bkFacts">
        <li>${esc(t("fFree"))}</li>
        <li>${esc(t("fMeet"))}</li>
        <li id="bkFactMin" class="sv1-hide"></li>
        <li id="bkFactHours" class="sv1-hide"></li>
        <li id="bkFactDays" class="sv1-hide"></li>
        <li>${esc(t("fLink"))}</li>
      </ul>
    </div>

    <div id="bkManage" class="sv1-bk-done sv1-hide"></div>

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
        <div id="bkInfo">
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
        </div>
        <div id="bkMove" class="sv1-hide">
          <h4>${esc(t("mgChange"))}</h4>
          <div class="sv1-bk-when sv1-hide" id="bkWhen2"></div>
          <button type="button" class="sv1-btn primary" id="bkMoveGo" style="width:100%;margin-top:13px">${esc(t("mgSave"))}</button>
        </div>
        <div class="sv1-bk-msg" id="bkMsg"></div>
        <p class="sv1-bk-note">${esc(t("hoursNote"))}</p>
      </div>
    </div>

    <div id="bkDone" class="sv1-bk-done sv1-hide"></div>
  </div></section>
</main>
${sv1.footer()}`;

  const T = {};
  for (const k of ["loading","noSlots","need","busy","taken","failed","doneT","pendT","pendMsg","invMsg","linkKeep","joinNote","doneOn","meet","addCal","mailed","confirm","tz","mins","another","pickTime","tpRecGen","refLbl","refKeep",
                   "fHours","fDays","fDaysAll","mgChange","mgCancel","mgAsk","mgTitle","mgCancelled","mgMoved","mgSave","mgBad","mgGone","signin"]) T[k] = t(k);
  const LOCALE = { ar: "ar-SA", en: "en", fr: "fr", zh: "zh-CN" }[lang()] || "en";

  const script = `<script>
(function(){
var TX=${JSON.stringify(T)},HOME=${JSON.stringify(pre + "/")},AR=${lang() === "ar" ? "true" : "false"},LOC=${JSON.stringify(LOCALE)},LANGC=${JSON.stringify(lang())};
var $=function(id){return document.getElementById(id)};
var DAYS=[],pick={date:'',time:''},slotMin=30,calState='off',META={};
var MG={ref:'',t:'',data:null,moving:false};
var DOW=AR?['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت']
          :['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
var MON=AR?['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
          :['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function dparts(d){var x=new Date(d+'T12:00:00+03:00');return {dow:DOW[x.getUTCDay()],day:x.getUTCDate(),mon:MON[x.getUTCMonth()]}}
// الساعة بالنظام ١٢ إلى جانب ٢٤: الأرقام وحدها تُقرأ خطأً عند من اعتاد ص/م.
function c12(hm){var p=String(hm).split(':'),h=+p[0],h12=((h+11)%12)+1;return h12+':'+p[1]+' '+(AR?(h<12?'ص':'م'):(h<12?'AM':'PM'))}
function fill(s,o){return String(s).replace(/\\{(\\w)\\}/g,function(_,k){return o[k]==null?'':o[k]})}
function dayName(i){try{return new Intl.DateTimeFormat(LOC,{weekday:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2024,0,7+i)))}catch(e){return DOW[i]}}

// الساعات والأيام والمدة من الخادم لا من نصٍّ ثابت: ما تعرضه الصفحة هو ما يقبله الخادم.
function drawFacts(){
 if(!META.hours)return;
 var m=$('bkFactMin'),h=$('bkFactHours'),d=$('bkFactDays');
 m.textContent=slotMin+' '+TX.mins;m.classList.remove('sv1-hide');
 h.textContent=fill(TX.fHours,{a:c12(META.hours.from),b:c12(META.hours.to)});h.classList.remove('sv1-hide');
 var off=(META.offDays||[]);
 d.textContent=off.length?fill(TX.fDays,{d:off.map(dayName).join(AR?' و':' & ')}):TX.fDaysAll;d.classList.remove('sv1-hide')}

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
  b.className='sv1-bk-t'+(pick.time===tm?' on':'');b.textContent=tm;b.title=c12(tm);
  b.onclick=function(){pick.time=tm;drawTimes();drawWhen()};
  host.appendChild(b)})}

function drawWhen(){
 ['bkWhen','bkWhen2'].forEach(function(id){
  var el=$(id);
  if(!pick.date||!pick.time){el.classList.add('sv1-hide');return}
  var p=dparts(pick.date);
  el.classList.remove('sv1-hide');el.textContent='';
  var a=document.createElement('span');a.textContent=p.dow+' '+p.day+' '+p.mon;
  var b=document.createElement('b');
  var bt=document.createElement('span');bt.className='sv1-mono';bt.textContent=pick.time;
  b.appendChild(bt);b.appendChild(document.createTextNode(' ('+c12(pick.time)+') · '+slotMin+' '+TX.mins+' · '+TX.tz));
  el.appendChild(a);el.appendChild(b)})}

function load(){
 fetch('/api/book?action=slots').then(function(r){return r.json()}).then(function(o){
  if(!o||!o.ok){$('bkDays').innerHTML='';drawDays();return}
  DAYS=o.days||[];slotMin=o.slotMinutes||30;calState=o.calendar||'off';META=o;
  // تقويمٌ غير مربوط (أو متعذّر) يعني أن الفترة قد تكون مشغولة عندنا ولا رابط
  // اجتماعٍ يُنشأ فوراً: يُقال ذلك بدل إيهام العميل بتأكيدٍ لا يملكه أحد.
  $('bkCalNote').textContent=(calState==='linked'||calState==='test')?'':TX.confirm;
  drawFacts();
  if(DAYS.length&&!pick.date){pick.date=DAYS[0].date}
  drawDays();drawTimes();drawWhen()})
 .catch(function(){DAYS=[];drawDays()})}

function ready(){return $('bkName').value.trim()&&$('bkPhone').value.trim()&&
 $('bkEmail').value.trim().indexOf('@')>0&&pick.date&&pick.time}

function fail(msg,o){
 var m=$('bkMsg');m.className='sv1-bk-msg err';m.textContent='';
 m.appendChild(document.createTextNode(msg));
 if(o&&o.error==='signin_required'){
  var a=document.createElement('a');a.href=(o.signin||HOME+'my');a.textContent=' '+TX.signin;a.style.textDecoration='underline';m.appendChild(a)}}
function errText(o){
 if(!o)return TX.failed;
 if(o.error==='slot_taken')return TX.taken;
 return o.message||TX.failed}

$('bkGo').onclick=function(){
 var msg=$('bkMsg');msg.className='sv1-bk-msg';
 if(!ready()){msg.className='sv1-bk-msg err';msg.textContent=TX.need;return}
 var self=this;self.disabled=true;msg.textContent=TX.busy;
 fetch('/api/book',{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({name:$('bkName').value.trim(),phone:$('bkPhone').value.trim(),
   email:$('bkEmail').value.trim().toLowerCase(),topic:$('bkTopic').value.trim(),
   notes:$('bkNotes').value.trim(),date:pick.date,time:pick.time,lang:LANGC})})
 .then(function(r){return r.json()}).then(function(o){
  self.disabled=false;
  if(!o||!o.ok){fail(errText(o),o);if(o&&o.error==='slot_taken')load();return}
  done(o)})
 .catch(function(){self.disabled=false;fail(TX.failed)})};

function line(box,text,css){var p=document.createElement('p');if(css)p.style.cssText=css;p.textContent=text;box.appendChild(p);return p}
function whenRow(box,date,time){
 var p=dparts(date);
 var w=document.createElement('div');w.className='when';
 var wd=document.createElement('span');wd.textContent=p.dow+' '+p.day+' '+p.mon+' · ';
 var wt=document.createElement('span');wt.className='sv1-mono';wt.textContent=time;
 var wz=document.createElement('span');wz.textContent=' ('+c12(time)+' · '+TX.tz+' GMT+3)';
 w.appendChild(wd);w.appendChild(wt);w.appendChild(wz);box.appendChild(w)}
function meetRow(box,meet){
 if(!meet)return;
 var r=document.createElement('p');r.className='meetrow';
 var b=document.createElement('bdi');b.textContent=meet;r.appendChild(b);box.appendChild(r)}
function icon(box,wait){var ic=document.createElement('div');ic.className='ic'+(wait?' wait':'');ic.textContent=wait?'⏳':'✓';box.appendChild(ic)}

function done(o){
 $('bkForm').classList.add('sv1-hide');
 var box=$('bkDone');box.classList.remove('sv1-hide');box.textContent='';
 var ok=!!o.confirmed;
 icon(box,!ok);
 var h=document.createElement('h3');h.textContent=ok?TX.doneT:TX.pendT;box.appendChild(h);
 var w=o.when||{date:pick.date,time:pick.time};
 whenRow(box,w.date,w.time);
 // رقم الحجز يقوله الخادم (BC-…) — هو ما يُذكر عند أي مراسلة عن الموعد.
 if(o.ref){var rf=document.createElement('p');rf.style.cssText='margin:0 0 10px;color:var(--ink)';
  rf.appendChild(document.createTextNode(TX.refLbl+': '));
  var rb=document.createElement('b');rb.className='sv1-mono';rb.style.direction='ltr';rb.style.display='inline-block';rb.textContent=String(o.ref);
  rf.appendChild(rb);box.appendChild(rf);
  line(box,TX.refKeep,'margin:0 0 10px;font-size:12px')}
 // لا «تم التأكيد» إلا لحدثٍ وُضع فعلاً في التقويم.
 if(ok){line(box,o.emailSent?(o.invited?TX.invMsg:TX.mailed):TX.linkKeep);line(box,TX.joinNote,'font-size:12px;margin-top:6px')}
 else line(box,TX.pendMsg);
 meetRow(box,o.meet);
 var acts=document.createElement('div');acts.className='acts';
 if(o.meet){var m=document.createElement('a');m.className='sv1-btn primary sm';m.href=o.meet;m.target='_blank';m.rel='noopener';m.textContent=TX.meet;acts.appendChild(m)}
 if(o.gcalUrl){var g=document.createElement('a');g.className='sv1-btn sm';g.href=o.gcalUrl;g.target='_blank';g.rel='noopener';g.textContent=TX.addCal;acts.appendChild(g)}
 var again=document.createElement('button');again.type='button';again.className='sv1-btn sm';
 again.textContent=TX.another;again.onclick=function(){location.reload()};acts.appendChild(again);
 box.appendChild(acts);
 if(o.manageUrl){var mg=document.createElement('p');mg.style.cssText='margin-top:14px;font-size:12.5px';
  var a1=document.createElement('a');a1.className='lnk';a1.href=o.manageUrl;a1.textContent=TX.mgChange;
  var a2=document.createElement('a');a2.className='lnk';a2.href=o.manageUrl+'&do=cancel';a2.textContent=TX.mgCancel;
  mg.appendChild(a1);mg.appendChild(document.createTextNode(' · '));mg.appendChild(a2);box.appendChild(mg)}
 try{window.scrollTo({top:0,behavior:'smooth'})}catch(e){}}

// ---- إدارة الموعد: الرابط الذي في بريد التأكيد --------------------------------
function manageMsg(text,err){var m=$('bkMsg');m.className='sv1-bk-msg'+(err?' err':'');m.textContent=text}
function drawManage(){
 var d=MG.data,box=$('bkManage');box.textContent='';box.classList.remove('sv1-hide');
 $('bkForm').classList.add('sv1-hide');
 var h=document.createElement('h3');h.textContent=TX.mgTitle;box.appendChild(h);
 if(!d||!d.ok){icon(box,true);line(box,TX.mgBad);return}
 whenRow(box,d.when.date,d.when.time);
 if(d.topic)line(box,d.topic);
 line(box,TX.refLbl+': '+d.ref,'margin-top:6px;font-size:12px');
 if(!d.canChange){line(box,TX.mgGone);return}
 meetRow(box,d.meet);
 var acts=document.createElement('div');acts.className='acts';
 var ch=document.createElement('button');ch.type='button';ch.className='sv1-btn primary sm';ch.textContent=TX.mgChange;
 ch.onclick=function(){startMove()};acts.appendChild(ch);
 var cn=document.createElement('button');cn.type='button';cn.className='sv1-btn sm';cn.id='bkCancel';cn.textContent=TX.mgCancel;
 cn.onclick=function(){doCancel(cn)};acts.appendChild(cn);
 box.appendChild(acts)}
function startMove(){
 MG.moving=true;$('bkManage').classList.add('sv1-hide');
 $('bkForm').classList.remove('sv1-hide');$('bkInfo').classList.add('sv1-hide');$('bkMove').classList.remove('sv1-hide');
 pick.time='';drawTimes();drawWhen();manageMsg('')}
function doCancel(btn){
 if(!window.confirm(TX.mgAsk))return;
 btn.disabled=true;
 fetch('/api/book',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'cancel',ref:MG.ref,t:MG.t,lang:LANGC})})
 .then(function(r){return r.json()}).then(function(o){
  var box=$('bkManage');
  if(!o||!o.ok){btn.disabled=false;var e=document.createElement('p');e.style.color='#b42318';e.textContent=errText(o);box.appendChild(e);return}
  box.textContent='';icon(box,false);var h=document.createElement('h3');h.textContent=TX.mgCancelled;box.appendChild(h);
  var acts=document.createElement('div');acts.className='acts';var a=document.createElement('a');a.className='sv1-btn primary sm';a.href=HOME+'consultation';a.textContent=TX.another;acts.appendChild(a);box.appendChild(acts)})
 .catch(function(){btn.disabled=false})}
$('bkMoveGo').onclick=function(){
 if(!pick.date||!pick.time){manageMsg(TX.need,true);return}
 var self=this;self.disabled=true;manageMsg(TX.busy);
 fetch('/api/book',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'reschedule',ref:MG.ref,t:MG.t,date:pick.date,time:pick.time,lang:LANGC})})
 .then(function(r){return r.json()}).then(function(o){
  self.disabled=false;
  if(!o||!o.ok){fail(errText(o),o);if(o&&o.error==='slot_taken')load();return}
  $('bkForm').classList.add('sv1-hide');
  var box=$('bkDone');box.classList.remove('sv1-hide');box.textContent='';
  icon(box,!o.confirmed);var h=document.createElement('h3');h.textContent=TX.mgMoved;box.appendChild(h);
  whenRow(box,o.when.date,o.when.time);meetRow(box,o.meet);
  var acts=document.createElement('div');acts.className='acts';
  if(o.meet){var m=document.createElement('a');m.className='sv1-btn primary sm';m.href=o.meet;m.target='_blank';m.rel='noopener';m.textContent=TX.meet;acts.appendChild(m)}
  if(o.gcalUrl){var g=document.createElement('a');g.className='sv1-btn sm';g.href=o.gcalUrl;g.target='_blank';g.rel='noopener';g.textContent=TX.addCal;acts.appendChild(g)}
  box.appendChild(acts)})
 .catch(function(){self.disabled=false;fail(TX.failed)})};

// «موضوع الاستشارة» يُملأ مرةً واحدة، فقط إن كان الحقل فارغاً:
//   ?about=<اسم الخدمة>  — يرسله زرّ «احجز استشارة» في صفحة الخدمة (وبعض البطاقات مع ?topic=)
//   ?topic=rec-gen       — يرسله زرّ /hiring
// الاسم نصٌّ يضعه الزائر في الرابط: يدخل الحقل قيمةً (لا HTML) ويُقصّ طوله.
var qs=new URLSearchParams(location.search);
try{var ti=$('bkTopic'),ab=(qs.get('about')||'').replace(/\\s+/g,' ').trim().slice(0,120);
 if(ti&&!ti.value.trim()){
  if(ab)ti.value=ab;
  else if(qs.get('topic')==='rec-gen')ti.value=TX.tpRecGen}}catch(e){}

MG.ref=(qs.get('manage')||'').trim();MG.t=(qs.get('t')||'').trim();
if(MG.ref){
 // وضع الإدارة: تُقرأ بيانات الحجز بالتوقيع ثم يُعرض الإلغاء/التغيير.
 $('bkForm').classList.add('sv1-hide');
 fetch('/api/book?action=manage&ref='+encodeURIComponent(MG.ref)+'&t='+encodeURIComponent(MG.t)).then(function(r){return r.json()})
  .then(function(o){MG.data=o;drawManage();if(o&&o.ok&&o.canChange){load();if(qs.get('do')==='cancel'){var cb=$('bkCancel');if(cb)doCancel(cb)}}})
  .catch(function(){MG.data=null;drawManage()})
}else load();
})();</script>`;

  return sv1.shell({ title: `${t("title")} — Business Partner`, desc: t("desc"), path: "/consultation", body: CSS + body, script });
}
