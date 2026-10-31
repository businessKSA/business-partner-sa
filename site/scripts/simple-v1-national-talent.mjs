// الكوادر الوطنية المشتركة — صفحة على تصميم Simple V1 (/national-shared-talent).
//
// خدمة: سعوديون حقيقيون بدوام جزئي ومرن، تسندهم Business Partner وتديرهم
// وتطوّرهم. القواعد التي تحكم النص هنا (من قيود القانونية في
// docs/sales/services/national-shared-talent-HANDOFF.md):
//   • لا أسعار في الصفحة — الأسعار للمسجّلين وفي عرض السعر.
//   • لا وعد بنتيجة في نطاقات، ولا بأن سعودياً واحداً يُحتسب لأكثر من منشأة.
//   • الهيكل القانوني النهائي يُؤكَّد كتابةً قبل توقيع العقد.
// النموذج يرسل إلى client-intake-web نفسه الذي تستعمله الصفحات العامة، بـ
// service=national-shared-talent. لم يُختبر مع n8n بعد.

const D = {
  tag:   { ar: "الكوادر الوطنية المشتركة", en: "Shared National Talent" },
  h1:    { ar: "متخصص سعودي حقيقي، للساعات التي تحتاجها فعلاً", en: "A real Saudi professional, for the hours you actually need" },
  lead:  { ar: "تُسند Business Partner إلى شركتك موظفين سعوديين مؤهلين بدوام جزئي أو مرن أو عن بُعد أو بالمشروع، وتديرهم وتدرّبهم وتطوّرهم. دور محدد دون تكلفة التوظيف بدوام كامل.",
           en: "Business Partner assigns qualified Saudi employees to your company part-time, flexibly, remotely or by project, and manages, trains and develops them. A defined role without the cost of a full-time hire." },
  cta:   { ar: "اطلب عرض سعر", en: "Request a quote" },
  rolesT:{ ar: "الوظائف المتاحة", en: "Roles available" },
  rolesP:{ ar: "اختر الوظيفة والساعات الشهرية. الأسعار تظهر للعملاء المسجّلين وفي عرض السعر.", en: "Choose the role and monthly hours. Prices are shown to registered clients and in your quote." },
  roles: [
    [{ ar: "المحاسبة", en: "Accounting" }, { ar: "مسك الدفاتر والإقفال الشهري والتقارير بمحاسب سعودي للساعات التي تحتاجها.", en: "Bookkeeping, monthly closing and reporting by a Saudi accountant for the hours you need." }],
    [{ ar: "الموارد البشرية", en: "Human resources" }, { ar: "العقود وملفات الرواتب والتهيئة ومتابعة الامتثال للفرق الصغيرة والنامية.", en: "Contracts, payroll files, onboarding and compliance follow-up for small and growing teams." }],
    [{ ar: "التسويق", en: "Marketing" }, { ar: "حملات ومحتوى ومتابعة العملاء المحتملين، عن بُعد أو في موقعك.", en: "Campaigns, content and lead follow-up, remotely or on site." }],
    [{ ar: "المبيعات", en: "Sales" }, { ar: "متخصص مبيعات بأجر مرتبط بالأداء فوق أساس مضمون.", en: "A sales professional with performance-linked pay on top of a guaranteed base." }],
    [{ ar: "المشتريات", en: "Purchasing" }, { ar: "الحصول على الموردين والتفاوض وضبط تكلفة المشتريات.", en: "Supplier sourcing, negotiation and purchase-cost control." }],
    [{ ar: "الدعم الإداري", en: "Administrative support" }, { ar: "التنسيق والسجلات ومهام المكتب اليومية.", en: "Coordination, records and day-to-day office tasks." }],
    [{ ar: "إدارة المشاريع", en: "Project management" }, { ar: "الخطط والمعالم ومتابعة التسليم لمشروع محدد.", en: "Plans, milestones and delivery follow-up for a defined project." }],
    [{ ar: "الهندسة", en: "Engineering" }, { ar: "دعم هندسي للمشاريع بمهندسين سعوديين مؤهلين للمهنة.", en: "Engineering support for projects, by profession-qualified Saudi engineers." }],
  ],
  formsT:{ ar: "صيغ التعاقد", en: "Forms of engagement" },
  forms: [
    [{ ar: "دوام جزئي", en: "Part-time" }, { ar: "ساعات أسبوعية ثابتة لدى شركتك.", en: "Fixed weekly hours with your company." }],
    [{ ar: "عمل مرن", en: "Flexible" }, { ar: "ساعات بحسب الحاجة بين حد أدنى وأقصى متفق عليهما، ويُوثَّق عبر منصة «مرن» حيثما انطبق.", en: "Hours as needed between an agreed minimum and maximum, documented through the Marn platform where it applies." }],
    [{ ar: "عن بُعد", en: "Remote" }, { ar: "مهام تُسلَّم دون حضور.", en: "Tasks delivered without attendance." }],
    [{ ar: "بالمشروع", en: "By project" }, { ar: "نطاق ومخرجات ومدة محددة ودفعات حسب المعالم.", en: "Defined scope, deliverables, duration and milestone payments." }],
  ],
  howT:  { ar: "من الطلب إلى أول يوم عمل", en: "From request to first day" },
  how: [
    [{ ar: "تخبرنا بالدور والساعات", en: "Tell us the role and hours" }, { ar: "الدور والساعات الشهرية وتاريخ البدء.", en: "The role, monthly hours and start date." }],
    [{ ar: "نرشّح ونعرّفك", en: "We match and introduce" }, { ar: "متخصص سعودي مناسب لدورك، نعرّفك به قبل تاريخ البدء.", en: "A Saudi professional matched to your role, introduced before the start date." }],
    [{ ar: "نطاق موقّع وإشراف أسبوعي", en: "Signed scope, weekly supervision" }, { ar: "سجل ساعات ونطاق موقّع، ومراجعة أسبوعية من مدير أول في Business Partner.", en: "A timesheet and a signed scope, reviewed weekly by a senior Business Partner manager." }],
    [{ ar: "تقرير شهري وتطوير", en: "Monthly report and development" }, { ar: "الساعات والمخرجات والتدريب، وتغطية الاستبدال مشمولة.", en: "Hours, deliverables and training; replacement cover is included." }],
  ],
  intT:  { ar: "توطين حقيقي لا أوراق", en: "Genuine localisation, not paperwork" },
  intP:  { ar: "يتبع احتساب الإسناد في برنامج نطاقات الهيكل المسجَّل لكل موظف. لا نلتزم بأي نتيجة في نطاقات، ويُؤكَّد الهيكل النهائي كتابةً قبل توقيع العقد.",
           en: "How an assignment is counted in the Nitaqat programme depends on the employment structure registered for each employee. We make no commitment to any Nitaqat result, and the final structure is confirmed in writing before the contract is signed." },
  int: [
    [{ ar: "عمل حقيقي", en: "Real work" }, { ar: "كل إسناد له مخرج للعميل وسجل ساعات ونطاق موقّع.", en: "Every assignment has a client deliverable, a timesheet and a signed scope." }],
    [{ ar: "عقد حقيقي", en: "Real contract" }, { ar: "عقود عمل حقيقية، وتأمينات اجتماعية وطبية مسجّلة.", en: "Genuine employment contracts, with social and medical insurance registered." }],
    [{ ar: "تدريب وتطوير", en: "Trained and developed" }, { ar: "تدريب وتطوير مهني إلزاميان لكل موظف، مشمولان بالخدمة.", en: "Mandatory training and professional development for every employee, included in the service." }],
    [{ ar: "سجلات تُعرض", en: "Records you can show" }, { ar: "سجلات العمل والتدريب لكل موظف محفوظة ويمكن عرضها على الجهات المختصة.", en: "Work and training records kept per employee and available to the competent authorities." }],
  ],
  reqT:  { ar: "أرسل طلبك، نرد خلال يوم عمل", en: "Send your request, we reply within one working day" },
  company:{ ar: "اسم المنشأة", en: "Company name" }, phone: { ar: "الجوال / واتساب", en: "Mobile / WhatsApp" },
  role:  { ar: "الوظيفة المطلوبة", en: "Role needed" }, rolePh: { ar: "مثال: محاسب", en: "e.g. Accountant" },
  hours: { ar: "الساعات شهرياً", en: "Hours per month" }, hoursPh: { ar: "مثال: 40", en: "e.g. 40" },
  type:  { ar: "صيغة التعاقد", en: "Form of engagement" },
  types: [{ ar: "دوام جزئي", en: "Part-time" }, { ar: "عمل مرن (مرن)", en: "Flexible (Marn)" }, { ar: "عن بُعد", en: "Remote" }, { ar: "بالمشروع", en: "By project" }, { ar: "استشارة / غير محدد", en: "Consultation / not sure" }],
  email: { ar: "البريد الإلكتروني (اختياري)", en: "Email (optional)" },
  notes: { ar: "ملاحظات (المدينة، تاريخ البدء، المهام)", en: "Notes (city, start date, tasks)" },
  send:  { ar: "أرسل الطلب", en: "Send request" },
  priv:  { ar: "بياناتك تُستخدم لتجهيز عرضك فقط. لا نطلب كلمات مرور أو رموز OTP.", en: "Your data is used only to prepare your quote. We never ask for passwords or OTP codes." },
  need:  { ar: "أكمل اسم المنشأة والجوال والوظيفة والساعات.", en: "Fill in company, mobile, role and monthly hours." },
  busy:  { ar: "نرسل طلبك…", en: "Sending…" },
  ok:    { ar: "استلمنا طلبك. نرجع لك بالخيارات وعرض السعر خلال يوم عمل.", en: "Request received. We reply with options and a quote within one working day." },
  fail:  { ar: "تعذّر الإرسال. حاول مرة أخرى أو راسلنا على واتساب.", en: "Sending failed. Try again or message us on WhatsApp." },
};

export function buildSimpleNationalTalent(sv1, ctx) {
  const { lang, esc } = ctx;
  const t = (k) => { const e = D[k]; const l = lang(); return e[l] != null ? e[l] : e.en; };
  const pick = (e) => { const l = lang(); return e[l] != null ? e[l] : e.en; };
  const panels = (rows, cls) => `<div class="sv1-nt-grid ${cls}">${rows.map(([h, p]) => `<div class="sv1-panel"><h4>${esc(pick(h))}</h4><p>${esc(pick(p))}</p></div>`).join("")}</div>`;
  const head = (tag, title, sub) => `<div class="sv1-title"><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ""}</div>`;

  const CSS = `<style id="sv1-nt-css">
.sv1-nt-hero{background:#fff;border-bottom:1px solid var(--l);padding:64px 0}
.sv1-nt-hero h1{font-size:clamp(30px,4.4vw,52px);line-height:1.15;margin:16px 0;letter-spacing:-.03em;font-weight:300;max-width:860px}
.sv1-nt-hero p{max-width:720px;font-size:15px;line-height:1.9;color:var(--mut);margin:0 0 22px}
.sv1-nt-grid{display:grid;gap:12px}
.sv1-nt-grid>*{min-width:0}
.sv1-nt-grid.c4{grid-template-columns:repeat(4,1fr)}
.sv1-nt-grid .sv1-panel{padding:18px}
.sv1-nt-grid h4{font-size:15px;margin:0 0 6px}
.sv1-nt-grid p{margin:0;font-size:13px;line-height:1.75;color:var(--mut)}
.sv1-nt-alt{background:var(--g)}
.sv1-nt-f{display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:760px;margin:0 auto}
.sv1-nt-f .full{grid-column:1/-1}
.sv1-nt-f label{display:block;font-size:11.5px;color:var(--mut);margin-bottom:5px}
.sv1-nt-in{width:100%;border:1px solid var(--l);border-radius:10px;padding:11px 13px;font:inherit;font-size:13.5px;outline:none;background:#fff}
.sv1-nt-in:focus{border-color:var(--ac)}
textarea.sv1-nt-in{min-height:80px;resize:vertical}
.sv1-nt-act{max-width:760px;margin:14px auto 0}
.sv1-nt-msg{font-size:12.5px;line-height:1.8;margin-top:10px;min-height:1em}
.sv1-nt-msg.err{color:#b42318}.sv1-nt-msg.ok{color:var(--ok)}
.sv1-nt-note{font-size:11.5px;color:var(--faint);line-height:1.8;margin-top:8px}
@media(max-width:900px){.sv1-nt-grid.c4{grid-template-columns:1fr 1fr}}
@media(max-width:560px){.sv1-nt-grid.c4,.sv1-nt-f{grid-template-columns:1fr}}
</style>`;

  const opts = D.types.map((o) => `<option value="${esc(o.ar)}">${esc(pick(o))}</option>`).join("");
  const body = `${sv1.header("/national-shared-talent", { cta: false })}
<main>
  <section class="sv1-nt-hero"><div class="wrap">
    <span class="sv1-tag">${esc(t("tag"))}</span>
    <h1>${esc(t("h1"))}</h1>
    <p>${esc(t("lead"))}</p>
    <a class="sv1-btn primary" href="#nt-request">${esc(t("cta"))}</a>
  </div></section>
  <section class="sv1-sec"><div class="wrap">${head(t("tag"), t("rolesT"), t("rolesP"))}${panels(D.roles, "c4")}</div></section>
  <section class="sv1-sec sv1-nt-alt"><div class="wrap">${head(t("tag"), t("formsT"))}${panels(D.forms, "c4")}</div></section>
  <section class="sv1-sec"><div class="wrap">${head(t("tag"), t("howT"))}${panels(D.how, "c4")}</div></section>
  <section class="sv1-sec sv1-nt-alt"><div class="wrap">${head(t("tag"), t("intT"), t("intP"))}${panels(D.int, "c4")}</div></section>
  <section class="sv1-sec" id="nt-request"><div class="wrap">
    ${head(t("tag"), t("reqT"))}
    <form id="ntForm" novalidate>
      <div class="sv1-nt-f">
        <div><label for="ntCompany">${esc(t("company"))} *</label><input id="ntCompany" class="sv1-nt-in" autocomplete="organization"></div>
        <div><label for="ntPhone">${esc(t("phone"))} *</label><input id="ntPhone" class="sv1-nt-in" inputmode="tel" autocomplete="tel" placeholder="05XXXXXXXX"></div>
        <div><label for="ntRole">${esc(t("role"))} *</label><input id="ntRole" class="sv1-nt-in" placeholder="${esc(t("rolePh"))}"></div>
        <div><label for="ntHours">${esc(t("hours"))} *</label><input id="ntHours" class="sv1-nt-in" type="number" min="1" inputmode="numeric" placeholder="${esc(t("hoursPh"))}"></div>
        <div><label for="ntType">${esc(t("type"))}</label><select id="ntType" class="sv1-nt-in">${opts}</select></div>
        <div><label for="ntEmail">${esc(t("email"))}</label><input id="ntEmail" class="sv1-nt-in" type="email" autocomplete="email"></div>
        <div class="full"><label for="ntNotes">${esc(t("notes"))}</label><textarea id="ntNotes" class="sv1-nt-in"></textarea></div>
      </div>
      <div class="sv1-nt-act">
        <button type="submit" class="sv1-btn primary" id="ntGo" style="width:100%">${esc(t("send"))}</button>
        <div class="sv1-nt-msg" id="ntMsg" role="status"></div>
        <p class="sv1-nt-note">${esc(t("priv"))}</p>
      </div>
    </form>
  </div></section>
</main>`;

  const T = { need: t("need"), busy: t("busy"), ok: t("ok"), fail: t("fail") };
  const script = `<script>
(function(){
var TX=${JSON.stringify(T)};
var $=function(id){return document.getElementById(id)};
$('ntForm').addEventListener('submit',function(e){
 e.preventDefault();
 var msg=$('ntMsg'),g=function(id){return $(id).value.trim()};
 var c=g('ntCompany'),p=g('ntPhone'),r=g('ntRole'),h=g('ntHours');
 if(!c||!p||!r||!h){msg.className='sv1-nt-msg err';msg.textContent=TX.need;return}
 var fd=new FormData();
 fd.append('company',c);fd.append('whatsapp',p);fd.append('role',r);fd.append('hours_per_month',h);
 fd.append('request_type',$('ntType').value);fd.append('email',g('ntEmail'));fd.append('notes',g('ntNotes'));
 fd.append('source','website-national-shared-talent');fd.append('service','national-shared-talent');
 var b=$('ntGo');b.disabled=true;msg.className='sv1-nt-msg';msg.textContent=TX.busy;
 fetch('https://businesspartnerai.app.n8n.cloud/webhook/client-intake-web',{method:'POST',body:fd})
  .then(function(x){if(!x.ok)throw 0;msg.className='sv1-nt-msg ok';msg.textContent=TX.ok;$('ntForm').reset()})
  .catch(function(){msg.className='sv1-nt-msg err';msg.textContent=TX.fail})
  .finally(function(){b.disabled=false})});
})();</script>`;

  return sv1.shell({ title: `${t("tag")} — Business Partner`, desc: t("lead"), path: "/national-shared-talent", body: CSS + body, script });
}
