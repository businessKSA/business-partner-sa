// Business Partner — Simple V1: بوابة الدخول إلى Business Partner HR (/hr-portal).
//
// يملكها وكيل `eor`. صفحة «من أنت؟» بست بطاقات توجّه كل دورٍ إلى بابه، على SV1.shell() بأربع لغات (ar/en/fr/zh)، بنمط
// simple-v1-eor.mjs و simple-v1-vendor.mjs: بلا main.js ولا localStorage ولا ألوان حرفية (متغيرات SV1 وأصناف sv1-* وحدها).
//
// الوجهات (لا بوابة جديدة تُبنى هنا):
//   صاحب عمل ← /employer · مرشح ← /careers · مكتب استقدام / ريكروتر مستقل / منصة ← /vendor
//   موظف على بند التعاقد ← لا بوابة بعد: يظهر نص «الدخول بدعوة» (الرابط يصل في الدعوة).
//
// **غير مربوطة** في أي قائمة أو فوتر أو sitemap، و`noindex`: يصلها من يعرف الرابط أو من زرّ «ادخل بوابة Business Partner HR» في /eor.
// سطر التسعير نصّ المالك: أصحاب العمل يسجّلون مجاناً والبيانات بالاشتراك، والمكاتب لا تدفع بل تُدفع لها (نموذج صرف المستحقات قرار المالك).

// ar, en, fr, zh
export const HR_TEXT = {
  title: ["بوابة Business Partner HR", "Business Partner HR portal", "Portail Business Partner HR", "Business Partner HR 门户"],
  tag: ["Business Partner HR", "Business Partner HR", "Business Partner HR", "Business Partner HR"],
  h1: ["من أنت؟", "Who are you?", "Qui êtes-vous ?", "您是哪类用户？"],
  lead: [
    "اختر دورك لندخلك البوابة المناسبة. كل دور يرى ما يخصّه فقط.",
    "Pick your role and we take you to the right door. Each role sees only what concerns it.",
    "Choisissez votre rôle pour accéder à la bonne porte. Chaque rôle ne voit que ce qui le concerne.",
    "请选择您的身份，我们会带您进入对应的入口。每种身份只能看到与自己相关的内容。",
  ],
  desc: [
    "بوابة الدخول إلى Business Partner HR: صاحب عمل، مرشح، موظف على بند التعاقد، مكتب استقدام، ريكروتر مستقل أو منصة.",
    "Entrance to Business Partner HR: employer, candidate, contracted employee, recruitment office, freelance recruiter or platform.",
    "Entrée de Business Partner HR : employeur, candidat, employé sous contrat, bureau de recrutement, recruteur indépendant ou plateforme.",
    "Business Partner HR 入口：雇主、候选人、合同员工、招聘机构、自由招聘人或平台。",
  ],
  employer: ["صاحب عمل", "Employer", "Employeur", "雇主"],
  employerP: ["أبحث عن موظفين أو أريد موظفين على بند التعاقد", "I am looking for staff, or want staff on a contracted basis", "Je cherche du personnel ou je veux du personnel sous contrat", "我在招人，或需要合同制员工"],
  employerTag: ["التسجيل مجاني، والبيانات بالاشتراك", "Free to register; data by subscription", "Inscription gratuite ; données sur abonnement", "注册免费，数据需订阅"],
  candidate: ["مرشح", "Candidate", "Candidat", "候选人"],
  candidateP: ["أبحث عن وظيفة وأريد رفع سيرتي", "I am looking for a job and want to upload my CV", "Je cherche un emploi et je veux déposer mon CV", "我在找工作，想上传简历"],
  candidateTag: ["ارفع سيرتك", "Upload your CV", "Déposez votre CV", "上传简历"],
  employee: ["موظف على بند التعاقد", "Contracted employee", "Employé sous contrat", "合同制员工"],
  employeeP: ["أعمل لدى عميل عبر Business Partner", "I work for a client through Business Partner", "Je travaille chez un client via Business Partner", "我通过 Business Partner 为客户工作"],
  employeeTag: ["الدخول بدعوة", "By invitation", "Sur invitation", "凭邀请进入"],
  office: ["مكتب استقدام", "Recruitment office", "Bureau de recrutement", "招聘机构"],
  officeP: ["أمثّل مكتباً وأريد استقبال الطلبات وإضافة مرشحيني", "I represent an office and want to receive requests and add my candidates", "Je représente un bureau et je veux recevoir des demandes et ajouter mes candidats", "我代表一家机构，想接收需求并添加我的候选人"],
  freelancer: ["ريكروتر مستقل", "Freelance recruiter", "Recruteur indépendant", "自由招聘人"],
  freelancerP: ["أعمل بنفسي وعندي مرشحون", "I work on my own and have candidates", "Je travaille seul et j'ai des candidats", "我独立工作，手上有候选人"],
  platform: ["منصة توظيف", "Hiring platform", "Plateforme de recrutement", "招聘平台"],
  platformP: ["منصة أو موقع يرسل مرشحين", "A platform or site that sends candidates", "Une plateforme ou un site qui envoie des candidats", "向我们输送候选人的平台或网站"],
  vendorTag: ["لا تدفع شيئاً", "You pay nothing", "Vous ne payez rien", "您无需付费"],
  go: ["ادخل", "Enter", "Entrer", "进入"],
  price: [
    "أصحاب العمل يسجّلون مجاناً، والبيانات بالاشتراك. المكاتب لا تدفع بل تُدفع لها.",
    "Employers register for free; data comes with a subscription. Offices do not pay: they get paid.",
    "Les employeurs s'inscrivent gratuitement ; les données sont sur abonnement. Les bureaux ne paient pas : ils sont rémunérés.",
    "雇主免费注册，数据需订阅。机构无需付费，反而会获得报酬。",
  ],
  inviteMsg: [
    "هذه البوابة تُفتح بدعوة من صاحب العمل أو من Business Partner. إن وصلتك دعوة فافتح الرابط الذي فيها.",
    "This portal opens by invitation from your employer or from Business Partner. If you received an invitation, open the link in it.",
    "Ce portail s'ouvre sur invitation de votre employeur ou de Business Partner. Si vous avez reçu une invitation, ouvrez le lien qu'elle contient.",
    "此门户需凭雇主或 Business Partner 的邀请进入。如已收到邀请，请打开邀请中的链接。",
  ],
  back: ["العودة إلى خدمة EOR", "Back to the EOR service", "Retour au service EOR", "返回 EOR 服务"],
};

export function buildSimpleHr(sv1, ctx) {
  const { lang, esc } = ctx;
  const LI = { ar: 0, en: 1, fr: 2, zh: 3 };
  const idx = LI[lang()] != null ? LI[lang()] : 1;
  const t = (k) => HR_TEXT[k][idx];

  const CSS = `<style id="sv1-hr-css">
.sv1-hr-hero{padding:48px 0 22px;text-align:center}
.sv1-hr-hero h1{font-size:clamp(28px,4.4vw,44px);margin:14px 0 8px}
.sv1-hr-hero p{max-width:620px;margin:0 auto;color:var(--mut);line-height:1.95}
.sv1-hr-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;max-width:1000px;margin:0 auto}
.sv1-hr-grid>*{min-width:0}
.sv1-hr-grid .sv1-door{display:flex;flex-direction:column;align-items:flex-start;gap:0;height:100%}
.sv1-hr-grid .sv1-door h3{font-size:17px}
.sv1-hr-grid .sv1-door p{flex:1}
.sv1-hr-grid .sv1-door .tg{font-size:11.5px;color:var(--ac);font-weight:500;margin-bottom:8px}
.sv1-hr-grid .sv1-door .go{font-size:12.5px;color:var(--ac);font-weight:500}
.sv1-hr-price{max-width:760px;margin:22px auto 0;text-align:center;font-size:13px;color:var(--mut);line-height:1.9;background:var(--soft);border:1px solid var(--line2);border-radius:11px;padding:12px 16px}
.sv1-hr-invite{max-width:760px;margin:14px auto 0;border:1px solid var(--acLine);background:var(--acSoft);color:var(--ink);border-radius:11px;padding:13px 16px;font-size:13.5px;line-height:1.9}
.sv1-hr-back{text-align:center;margin-top:22px}
@media(max-width:860px){.sv1-hr-grid{grid-template-columns:1fr 1fr}}
@media(max-width:560px){.sv1-hr-grid{grid-template-columns:1fr}}
</style>`;

  const door = (id, ico, nameK, descK, tagK, href) => {
    const inner = `<div class="ico" aria-hidden="true">${ico}</div><h3>${esc(t(nameK))}</h3><p>${esc(t(descK))}</p><span class="tg">${esc(t(tagK))}</span><span class="go">${esc(t("go"))}</span>`;
    return href
      ? `<a class="sv1-door" id="hr-${id}" data-hr-door="${id}" href="${href}" data-track="HR: ${id}">${inner}</a>`
      : `<button type="button" class="sv1-door" id="hr-${id}" data-hr-door="${id}" aria-controls="hrInvite" aria-expanded="false">${inner}</button>`;
  };
  const vendor = sv1.href("/vendor");

  const body = `${sv1.header("/hr-portal", { cta: false })}
<main>
  <section class="sv1-hr-hero"><div class="wrap">
    <span class="sv1-tag">${esc(t("tag"))}</span>
    <h1>${esc(t("h1"))}</h1>
    <p>${esc(t("lead"))}</p>
  </div></section>

  <section class="sv1-sec" style="padding-top:8px"><div class="wrap">
    <div class="sv1-hr-grid" id="hrDoors">
      ${door("employer", "🏢", "employer", "employerP", "employerTag", sv1.href("/employer"))}
      ${door("candidate", "👤", "candidate", "candidateP", "candidateTag", sv1.href("/careers"))}
      ${door("employee", "🪪", "employee", "employeeP", "employeeTag", null)}
      ${door("office", "🏛️", "office", "officeP", "vendorTag", vendor)}
      ${door("freelancer", "🤝", "freelancer", "freelancerP", "vendorTag", vendor)}
      ${door("platform", "🔗", "platform", "platformP", "vendorTag", vendor)}
    </div>
    <p class="sv1-hr-price" id="hrPrice">${esc(t("price"))}</p>
    <div class="sv1-hr-invite sv1-hide" id="hrInvite" role="status" aria-live="polite">${esc(t("inviteMsg"))}</div>
    <p class="sv1-hr-back"><a class="sv1-btn" href="${sv1.href("/eor")}">${esc(t("back"))}</a></p>
  </div></section>
</main>
${sv1.footer()}`;

  const script = `<script>(function(){var b=document.getElementById('hr-employee'),m=document.getElementById('hrInvite');if(!b||!m)return;b.addEventListener('click',function(){var open=m.classList.contains('sv1-hide');m.classList.toggle('sv1-hide',!open);b.setAttribute('aria-expanded',open?'true':'false');});})();</script>`;

  return sv1.shell({ title: `${t("title")} — Business Partner`, desc: t("desc"), path: "/hr-portal", body: CSS + body, script, noindex: true });
}
