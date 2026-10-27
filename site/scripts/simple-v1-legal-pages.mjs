// Business Partner — Simple V1: صفحات الخصوصية وحذف البيانات (/privacy · /data-deletion).
//
// وكيل footer-pages (2026-10-27) بطلب جلسة المدير: تطبيق ميتا «Farah Assistant 3»
// (واتساب) لا يُنشر قبل رابط سياسة خصوصية عام. هذا القالب والنصّ المبدئي؛ النصّ
// قانوني ويُراجَع من جلسة «القانونية › عبدالعزيز» قبل اعتماده ونشره.
//
// قواعد النص: لا أرقام ولا مدد ولا التزامات مبتكرة — ما لا نعرفه نُحيله إلى
// ما يقرّره نظام حماية البيانات الشخصية (PDPL) ولائحته. بيانات الاتصال من
// site.json فلا تُكرَّر هنا. لا أسرار في الصفحة.
// fr و zh تعرض الإنجليزية حتى تُترجم، كبقية صفحات SV1.

const UPDATED = { ar: "٢٧ أكتوبر ٢٠٢٦", en: "27 October 2026" };

const PRIVACY = {
  title: { ar: "سياسة الخصوصية", en: "Privacy Policy" },
  lead: {
    ar: "توضّح هذه السياسة كيف تجمع Business Partner بياناتك الشخصية وتستخدمها وتحميها، عند استخدامك موقعنا أو التواصل معنا عبر واتساب أو مستشارنا الذكي، وما حقوقك وفق نظام حماية البيانات الشخصية في المملكة العربية السعودية (PDPL).",
    en: "This policy explains how Business Partner collects, uses and protects your personal data when you use our website, contact us on WhatsApp or talk to our smart advisor, and what rights you have under the Saudi Personal Data Protection Law (PDPL).",
  },
  sections: [
    { h: { ar: "من نحن", en: "Who we are" }, p: {
      ar: ["Business Partner (شركة بزنس بارتنر سلوشنز) هي الجهة المسؤولة عن معالجة بياناتك الشخصية الموصوفة هنا. بيانات التواصل بنهاية الصفحة."],
      en: ["Business Partner (Business Partner Solutions Company) is the controller of the personal data described here. Contact details are at the end of this page."] } },
    { h: { ar: "البيانات التي نجمعها", en: "Data we collect" }, ul: {
      ar: ["بيانات تقدّمها لنا: الاسم ورقم الجوال والبريد الإلكتروني واسم المنشأة وبيانات الطلب الذي تقدّمه.",
        "عبر واتساب: رقم هاتفك واسم ملفك الشخصي في واتساب، ونصّ رسائلك، والرسائل الصوتية التي ترسلها، والصور والملفات والمستندات التي تشاركها معنا.",
        "المستندات التي ترفعها لإنجاز خدمة تطلبها، وما يُستخرج منها.",
        "بيانات الدفع: تُعالَج لدى بوابات الدفع ولا نحتفظ ببيانات بطاقتك الكاملة.",
        "بيانات تقنية أساسية مثل نوع المتصفح والجهاز والصفحات التي تزورها، لتشغيل الموقع وحمايته وتحسينه."],
      en: ["Data you give us: name, mobile number, email, company name and the details of the request you submit.",
        "Via WhatsApp: your phone number and WhatsApp profile name, the text of your messages, voice messages you send, and the images, files and documents you share with us.",
        "Documents you upload so we can complete a service you request, and what is extracted from them.",
        "Payment data: processed by the payment gateways; we do not keep your full card details.",
        "Basic technical data such as browser, device and the pages you visit, to run, secure and improve the site."] } },
    { h: { ar: "لماذا نستخدم بياناتك", en: "Why we use your data" }, ul: {
      ar: ["الردّ عليك وتقديم المساعدة والخدمات التي تطلبها ومتابعة طلباتك.", "إصدار عروض الأسعار والعقود والفواتير وإتمام الدفع.", "تشغيل مستشارنا الذكي ومساعد واتساب وتحسين جودة الردود.", "حماية الموقع ومنع إساءة الاستخدام والوفاء بالالتزامات النظامية."],
      en: ["To answer you, provide the help and services you ask for, and follow up on your requests.", "To issue quotes, contracts and invoices and complete payment.", "To run our smart advisor and WhatsApp assistant and improve the quality of replies.", "To protect the site, prevent misuse and meet legal obligations."] } },
    { h: { ar: "الذكاء الاصطناعي", en: "Artificial intelligence" }, p: {
      ar: ["نستخدم أنظمة ذكاء اصطناعي لفهم رسائلك النصية والصوتية والمستندات والردّ عليها. تُعالَج رسائلك لدى هذه الأنظمة لتوليد الرد المناسب. قد تحتوي الردود الآلية على أخطاء، ولا تُغني عن الاستشارة المتخصصة حين تلزم، ويمكنك طلب التحدث إلى فريقنا البشري."],
      en: ["We use artificial-intelligence systems to understand and reply to your text and voice messages and documents. Your messages are processed by these systems to produce a suitable reply. Automated replies may contain errors and do not replace specialist advice where it is needed, and you can ask to speak to our human team."] } },
    { h: { ar: "مع من نشارك بياناتك", en: "Who we share data with" }, ul: {
      ar: ["Meta (منصة واتساب للأعمال) لنقل رسائلك بيننا وبينك.", "Microsoft Azure لاستضافة الموقع وخدمات الذكاء الاصطناعي.", "بوابات الدفع (مثل مُيسّر وتمارا) عند إتمام الدفع، وخدمة الفوترة المحاسبية.", "مزوّدو خدمات تقنية آخرون نحتاجهم لتشغيل الموقع (كقواعد البيانات والبريد الإلكتروني)، ضمن التزامات تعاقدية للحفاظ على سرية البيانات.", "الجهات الحكومية عند طلبك خدمة تستلزم ذلك، أو عند إلزامنا نظاماً.", "لا نبيع بياناتك الشخصية."],
      en: ["Meta (WhatsApp Business Platform) to carry your messages between you and us.", "Microsoft Azure for hosting and AI services.", "Payment gateways (such as Moyasar and Tamara) when you pay, and our accounting/invoicing service.", "Other technical service providers we need to run the site (such as databases and email), under contractual confidentiality obligations.", "Government bodies when a service you request requires it, or when we are legally required to.", "We do not sell your personal data."] } },
    { h: { ar: "نقل البيانات خارج المملكة", en: "Transfers outside Saudi Arabia" }, p: {
      ar: ["قد تُعالَج بياناتك لدى مزوّدي خدمات في مراكز بيانات داخل المملكة أو خارجها. عند النقل خارج المملكة نلتزم بضوابط النقل المقررة في نظام حماية البيانات الشخصية ولوائحه."],
      en: ["Your data may be processed by service providers in data centres inside or outside Saudi Arabia. Where data leaves the Kingdom we comply with the transfer rules set by the PDPL and its regulations."] } },
    { h: { ar: "مدة الاحتفاظ", en: "How long we keep data" }, p: {
      ar: ["نحتفظ ببياناتك للمدة اللازمة لتحقيق الأغراض المذكورة أو التي تقتضيها الأنظمة (كمتطلبات الفوترة والسجلات)، ثم نحذفها أو نزيل ما يدلّ على هويتك."],
      en: ["We keep your data for as long as needed for the purposes above or as required by law (for example invoicing and record-keeping rules), then delete it or remove what identifies you."] } },
    { h: { ar: "حقوقك", en: "Your rights" }, ul: {
      ar: ["معرفة كيف نعالج بياناتك والاطلاع عليها والحصول على نسخة منها.", "تصحيح بياناتك أو تحديثها.", "طلب حذف بياناتك أو إتلافها، وفق ما يتيحه النظام.", "سحب موافقتك على المعالجة التي تقوم على الموافقة.", "تقديم شكوى إلى الجهة المختصة بحماية البيانات الشخصية في المملكة."],
      en: ["To know how we process your data, access it and get a copy.", "To have your data corrected or updated.", "To ask for your data to be deleted or destroyed, as the law allows.", "To withdraw consent where processing is based on consent.", "To complain to the competent personal-data authority in Saudi Arabia."] } },
    { h: { ar: "حماية البيانات", en: "Security" }, p: {
      ar: ["نطبّق إجراءات تقنية وتنظيمية معقولة لحماية بياناتك من الوصول أو الإفصاح أو الفقد غير المصرّح به. ولا توجد وسيلة نقل أو تخزين آمنة بالكامل."],
      en: ["We apply reasonable technical and organisational measures to protect your data against unauthorised access, disclosure or loss. No method of transmission or storage is completely secure."] } },
    { h: { ar: "الأطفال", en: "Children" }, p: {
      ar: ["خدماتنا موجّهة للأفراد والمنشآت ولا نقصد جمع بيانات من هم دون الثامنة عشرة."],
      en: ["Our services are for individuals and businesses; we do not knowingly collect data from anyone under 18."] } },
    { h: { ar: "تغييرات على السياسة", en: "Changes to this policy" }, p: {
      ar: ["قد نحدّث هذه السياسة، وسنعرض تاريخ آخر تحديث في أعلى الصفحة."],
      en: ["We may update this policy; the date of the latest update is shown at the top of the page."] } },
  ],
};

const DELETION = {
  title: { ar: "طلب حذف البيانات", en: "Data Deletion Request" },
  lead: {
    ar: "من حقك طلب حذف بياناتك الشخصية لدى Business Partner، بما فيها ما شاركته عبر واتساب أو الموقع. هذه الصفحة تشرح كيف تقدّم الطلب وماذا يحدث بعده.",
    en: "You have the right to ask Business Partner to delete your personal data, including what you shared on WhatsApp or the website. This page explains how to make the request and what happens next.",
  },
  sections: [
    { h: { ar: "كيف تقدّم الطلب", en: "How to make a request" }, ol: {
      ar: ["أرسل بريداً إلى {EMAIL} بعنوان «طلب حذف بيانات».", "اكتب اسمك، ورقم الجوال الذي تواصلت به معنا (ورقم واتساب إن اختلف)، والبريد المسجَّل إن وُجد.", "وضّح ما تريد حذفه: كل بياناتك، أو محادثات واتساب، أو مستندات بعينها."],
      en: ["Email {EMAIL} with the subject “Data deletion request”.", "Include your name, the mobile number you used to contact us (and your WhatsApp number if different), and your registered email if you have one.", "Say what you want deleted: all your data, your WhatsApp conversations, or specific documents."] } },
    { h: { ar: "التحقق من هويتك", en: "Verifying your identity" }, p: {
      ar: ["لحماية بياناتك قد نطلب منك ما يثبت أنك صاحب الرقم أو الحساب قبل التنفيذ."],
      en: ["To protect your data we may ask you to confirm that you own the number or account before we act."] } },
    { h: { ar: "ما الذي يحدث بعد ذلك", en: "What happens next" }, ul: {
      ar: ["نؤكد استلام طلبك ونخبرك بنتيجته.", "ننفّذ الطلب خلال المدة التي يقررها نظام حماية البيانات الشخصية ولائحته التنفيذية.", "نحذف بياناتك من أنظمتنا ومن مزوّدي الخدمة الذين يعالجونها نيابةً عنا، ما لم يمنع النظام ذلك."],
      en: ["We confirm we received your request and tell you the outcome.", "We carry it out within the period set by the PDPL and its implementing regulations.", "We delete your data from our systems and from the providers who process it on our behalf, unless the law prevents it."] } },
    { h: { ar: "ما قد نحتفظ به", en: "What we may keep" }, p: {
      ar: ["قد نحتفظ بما يُلزمنا النظام بحفظه، كالفواتير وسجلات الدفع والعقود، للمدة المطلوبة نظاماً فقط، وبأدنى قدر لازم."],
      en: ["We may keep what the law requires us to keep, such as invoices, payment records and contracts, only for the legally required period and to the minimum necessary."] } },
    { h: { ar: "أثر الحذف", en: "What deletion means for you" }, p: {
      ar: ["بعد الحذف لن نتمكن من استرجاع محادثاتك أو طلباتك أو مستنداتك، وقد يتوقف مساعد واتساب عن تذكّر سياقك السابق. والمحتوى المخزَّن لدى Meta في تطبيق واتساب على هاتفك يخضع لإعدادات واتساب وسياسة Meta، ويمكنك حذفه من هاتفك مباشرة."],
      en: ["After deletion we cannot restore your conversations, requests or documents, and the WhatsApp assistant will no longer remember your earlier context. Content held by Meta in the WhatsApp app on your phone is subject to WhatsApp settings and Meta’s policy, and you can delete it on your phone directly."] } },
  ],
  more: { ar: "للتفاصيل عن بياناتك وحقوقك اقرأ", en: "For more on your data and rights, read our" },
};

export function buildSimpleLegal(SV1, ctx, which) {
  const { lang: langFn, esc, site } = ctx;
  const lang = langFn();
  const k = lang === "ar" ? "ar" : "en";
  const pre = lang === "en" ? "" : "/" + lang;
  const u = (p) => pre + p;
  const contact = (site && site.contact) || {};
  const email = contact.email || "business@businesspartner.sa";
  const D = which === "privacy" ? PRIVACY : DELETION;
  const mail = `<a class="en" href="mailto:${esc(email)}">${esc(email)}</a>`;
  const fill = (s) => esc(s).replace("{EMAIL}", mail);

  const sections = D.sections.map((s) => {
    let inner = "";
    if (s.p) inner = s.p[k].map((t) => `<p>${fill(t)}</p>`).join("");
    if (s.ul) inner = `<ul>${s.ul[k].map((t) => `<li>${fill(t)}</li>`).join("")}</ul>`;
    if (s.ol) inner = `<ol>${s.ol[k].map((t) => `<li>${fill(t)}</li>`).join("")}</ol>`;
    return `<section class="lg-sec"><h2>${esc(s.h[k])}</h2>${inner}</section>`;
  }).join("");

  const other = which === "privacy"
    ? `<a class="sv1-btn" href="${u("/data-deletion")}">${k === "ar" ? "طلب حذف بياناتك" : "Request data deletion"}</a>`
    : `<a class="sv1-btn" href="${u("/privacy")}">${k === "ar" ? "سياسة الخصوصية" : "Privacy Policy"}</a>`;
  const addr = k === "ar" ? contact.address : (contact.addressEn || contact.address);

  const css = `<style id="sv1-lg-css">
.lg-head{max-width:760px;margin:0 0 30px}
.lg-head h1{font-size:clamp(30px,4.2vw,48px);line-height:1.15;margin:16px 0 14px;letter-spacing:-.03em;font-weight:200;color:var(--ink)}
.lg-upd{font-size:12.5px;color:var(--mut);margin:12px 0 0}
.lg-body{max-width:760px}
.lg-sec{margin:0 0 30px}
.lg-sec h2{font-size:clamp(19px,2.2vw,24px);font-weight:400;color:var(--ink);margin:0 0 10px}
.lg-sec p,.lg-sec li{font-size:15px;color:var(--t);line-height:2}
.lg-sec p{margin:0 0 10px}
.lg-sec ul,.lg-sec ol{margin:0;padding-inline-start:22px;display:flex;flex-direction:column;gap:6px}
.lg-contact{max-width:760px;background:var(--soft);border:1px solid var(--line2);border-radius:14px;padding:20px;display:grid;gap:6px;font-size:14px}
.lg-contact h2{font-size:18px;font-weight:400;color:var(--ink);margin:0 0 4px}
.lg-acts{display:flex;gap:9px;flex-wrap:wrap;margin-top:12px}
.lg-acts .sv1-btn{min-height:44px}
</style>`;

  const body = `${SV1.header("/" + which)}
  <main>
  <section class="sv1-sec"><div class="wrap">
    <div class="lg-head">
      <span class="sv1-tag">${k === "ar" ? "قانوني" : "Legal"}</span>
      <h1>${esc(D.title[k])}</h1>
      <p class="sv1-lead" style="max-width:none">${esc(D.lead[k])}</p>
      <p class="lg-upd">${k === "ar" ? "آخر تحديث" : "Last updated"}: ${esc(UPDATED[k])}</p>
    </div>
    <div class="lg-body">${sections}</div>
    <div class="lg-contact">
      <h2>${k === "ar" ? "التواصل معنا" : "Contact us"}</h2>
      <div>${k === "ar" ? "البريد الإلكتروني" : "Email"}: ${mail}</div>
      ${addr ? `<div>${k === "ar" ? "العنوان" : "Address"}: ${esc(addr)}</div>` : ""}
      <div class="lg-acts">${other}<a class="sv1-btn" href="${u("/terms")}">${k === "ar" ? "الشروط والأحكام" : "Terms & Conditions"}</a></div>
    </div>
  </div></section>
  </main>
${SV1.footer()}`;

  return SV1.shell({
    title: `${D.title[k]} — Business Partner`,
    desc: D.lead[k],
    path: "/" + which,
    body: css + body,
  });
}
