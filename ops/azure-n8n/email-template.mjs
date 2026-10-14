// قالب بريد Business Partner الصادر للحملات — ثنائي اللغة (عربي من اليمين لليسار ثم إنجليزي)، HTML بجداول وأنماط مضمّنة ليعمل في Gmail/Outlook.
// المحتوى الثابت (الخدمات والمزايا) مأخوذ من `site/assets/data/catalog.json` بلا أسعار؛ المقدمتان (عربية وإنجليزية) يكتبهما Azure مخصّصتين للعميل.
// الدالة نفسها تُحقن نصّاً في عقدة Code داخل السير (update-campaign-email.mjs) وتُستعمل محلياً لتوليد المعاينة:
//   node ops/azure-n8n/email-template.mjs > preview.html
// يجب أن تبقى الدالة مستقلة بذاتها (بلا استيراد ولا متغيّرات خارجها) لأنها تُنسخ كما هي إلى n8n.
export function renderEmail(subject, introAr, company, introEn) {
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const NAVY = "#0B1B5A", SITE = "https://www.businesspartner.sa";
  const T = {
    ar: {
      dir: "rtl", align: "right", font: "Tahoma,Arial,'Segoe UI',sans-serif",
      tag: "نمضي معكم من الفكرة إلى النجاح",
      hero: "نتولى عنكم المعاملات،<br>لتتفرغوا لنموّ أعمالكم",
      sub: "جهة واحدة تُنجز تأسيس شركتكم، وتوظيف فرقكم، ومعاملاتكم الحكومية في المملكة.",
      hello: `السادة / <span dir="ltr" style="unicode-bidi:isolate;">${esc(company)}</span> المحترمين،`,
      svcTitle: "ما الذي نقدّمه لكم",
      services: [
        ["تأسيس الشركات", "السجل التجاري، عقد التأسيس، عضوية الغرفة التجارية، والترخيص"],
        ["الاستثمار الأجنبي", "تأسيس الشركات الأجنبية والمشتركة وتراخيص المستثمرين"],
        ["الإقامة المميزة", "تقييم الأهلية وتحديد المسار وتقديم الإجراءات"],
        ["الخدمات الحكومية", "أبشر أعمال، مقيم، التأمينات الاجتماعية، حماية الأجور (مُدد)، الرخص البلدية"],
        ["الموارد البشرية والتوظيف", "تأشيرات العمل والاستقدام، التوظيف والتعاقد الخارجي (PEO/EOR)، الاستقطاب التنفيذي"],
        ["دعم الأعمال", "فتح الحساب البنكي التجاري، التسويق الرقمي، الامتياز التجاري"],
        ["المكاتب ومساحات العمل", "مكتب افتراضي بعنوان وطني، مساحات عمل مشتركة، مكاتب خاصة"],
        ["الأتمتة والذكاء الاصطناعي", "المستشار الذكي، الموظف الذكي، مستشار الامتثال"],
      ],
      whyTitle: "لماذا Business Partner؟",
      why: ["جهة واحدة لكل معاملاتكم", "فريق متخصص يتابع الإجراء حتى إتمامه", "مستشار ذكي على موقعنا يجيب عن أسئلتكم"],
      cta: "اطلب استشارتك", browse: "تصفّح كل خدماتنا",
      close: "يكفي أن تردّوا على هذه الرسالة بما يهمّكم، وسنتواصل معكم في الوقت الذي يناسبكم.",
      bye: "مع خالص التحية،", team: "فريق Business Partner",
    },
    en: {
      dir: "ltr", align: "left", font: "'Segoe UI',Arial,Tahoma,sans-serif",
      tag: "From idea to success, together",
      hero: "We handle the paperwork,<br>so you can grow your business",
      sub: "One partner for company setup, hiring and government services across the Kingdom.",
      hello: `Dear <span dir="auto" style="unicode-bidi:isolate;">${esc(company)}</span> team,`,
      svcTitle: "What we offer",
      services: [
        ["Company Formation", "Commercial registration, articles of association, Chamber of Commerce membership and licensing"],
        ["Foreign Investment", "Foreign-owned and joint-venture company setup, investor licences"],
        ["Premium Residency", "Eligibility assessment, pathway selection and application"],
        ["Government Services", "Absher Business, Muqeem, GOSI, Wage Protection (Mudad), municipal licences"],
        ["HR & Recruitment", "Work visas and recruitment, PEO/EOR, executive search"],
        ["Business Support", "Corporate bank account opening, digital marketing, franchise compliance"],
        ["Offices & Workspaces", "Virtual office with a national address, coworking, private offices"],
        ["AI & Automation", "Smart advisor, smart employee, compliance advisor"],
      ],
      whyTitle: "Why Business Partner?",
      why: ["One partner for all your filings", "A specialist team that follows through to completion", "A smart advisor on our website to answer your questions"],
      cta: "Request a consultation", browse: "Browse all our services",
      close: "Simply reply to this email with what matters to you and we will get back to you at a time that suits you.",
      bye: "Kind regards,", team: "The Business Partner team",
    },
  };
  const intros = { ar: introAr, en: introEn };
  const block = (k) => {
    const t = T[k], F = t.font, D = `direction:${t.dir};text-align:${t.align};`;
    const rows = t.services.map(([a, b]) => `<tr>
<td width="40" valign="top" style="padding:0 0 14px 0;"><span style="display:inline-block;width:24px;height:24px;line-height:24px;border-radius:12px;background:${NAVY};color:#ffffff;text-align:center;font-size:13px;font-family:Arial,sans-serif;">&#10003;</span></td>
<td valign="top" style="padding:0 0 14px 0;font-family:${F};${D}"><div style="font-size:15.5px;font-weight:bold;color:${NAVY};line-height:1.6;">${esc(a)}</div><div style="font-size:13.5px;color:#5a6478;line-height:1.7;">${esc(b)}</div></td></tr>`).join("");
    const paras = String(intros[k] ?? "").trim().split(/\n\s*\n/).map((p) =>
      `<p style="margin:0 0 14px;font-size:16px;line-height:1.95;color:#1f2937;">${esc(p.trim()).replace(/\n/g, "<br>")}</p>`).join("");
    const why = t.why.map((w) => `<tr><td style="padding:5px 0;font-family:${F};font-size:14px;color:#1f2937;${D}line-height:1.7;"><span style="color:${NAVY};font-weight:bold;">&#9679;</span>&nbsp; ${esc(w)}</td></tr>`).join("");
    return `<tr><td style="background:${NAVY};padding:32px 36px;${D}font-family:${F};">
<div style="font-size:12.5px;letter-spacing:.3px;color:#aab6e6;margin:0 0 10px;">${t.tag}</div>
<div style="font-size:24px;line-height:1.6;font-weight:bold;color:#ffffff;margin:0 0 10px;">${t.hero}</div>
<div style="font-size:14.5px;line-height:1.9;color:#dbe2fb;">${t.sub}</div>
</td></tr>
<tr><td style="padding:28px 36px 6px;font-family:${F};${D}">
<p style="margin:0 0 14px;font-size:17px;font-weight:bold;color:${NAVY};">${t.hello}</p>${paras}
</td></tr>
<tr><td style="padding:10px 36px 8px;font-family:${F};${D}">
<div style="font-size:18px;font-weight:bold;color:${NAVY};margin:0 0 6px;">${t.svcTitle}</div>
<div style="width:46px;height:3px;background:${NAVY};margin:0 0 18px;font-size:0;line-height:0;">&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${t.dir}">${rows}</table>
</td></tr>
<tr><td style="padding:6px 36px 4px;font-family:${F};${D}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2ff;border-radius:10px;"><tr><td style="padding:16px 20px;font-family:${F};${D}">
<div style="font-size:15px;font-weight:bold;color:${NAVY};margin:0 0 6px;">${t.whyTitle}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${t.dir}">${why}</table>
</td></tr></table></td></tr>
<tr><td align="center" style="padding:24px 36px 6px;font-family:${F};">
<a href="${SITE}" style="display:inline-block;background:${NAVY};color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;padding:14px 38px;border-radius:8px;">${t.cta}</a>
<div style="margin-top:14px;font-size:13.5px;"><a href="${SITE}/catalog" style="color:${NAVY};text-decoration:underline;">${t.browse}</a></div>
</td></tr>
<tr><td style="padding:18px 36px 26px;font-family:${F};${D}font-size:15px;line-height:1.9;color:#1f2937;">
${t.close}<br><br>${t.bye}<br><strong style="color:${NAVY};">${t.team}</strong>
</td></tr>`;
  };
  const divider = `<tr><td style="padding:0 36px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="border-top:1px solid #d5dbea;font-size:0;line-height:0;">&nbsp;</td>
<td width="1" style="padding:0 14px;white-space:nowrap;font-family:Arial,sans-serif;font-size:12px;letter-spacing:1.5px;color:#5a6478;">ENGLISH</td>
<td style="border-top:1px solid #d5dbea;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>`;
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f3f5fa;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f3f5fa;font-size:1px;line-height:1px;">${esc(subject)} — Business Partner</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5fa;padding:24px 10px;"><tr><td align="center">
<table role="presentation" width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e9f0;">
<tr><td align="center" style="padding:26px 32px 20px;background:#ffffff;"><a href="${SITE}" style="text-decoration:none;"><img src="${SITE}/assets/img/logo.png" width="230" alt="Business Partner" style="display:block;border:0;width:230px;max-width:100%;height:auto;"></a></td></tr>
${block("ar")}
${divider}
<tr><td style="height:18px;font-size:0;line-height:0;">&nbsp;</td></tr>
${block("en")}
<tr><td style="padding:18px 36px 24px;background:#f8f9fc;border-top:1px solid #e5e9f0;font-family:Tahoma,Arial,'Segoe UI',sans-serif;font-size:12.5px;line-height:1.8;color:#5a6478;">
<div style="direction:rtl;text-align:right;"><strong style="color:${NAVY};">Business Partner</strong> — Partnering for your success · <a href="${SITE}" style="color:${NAVY};">www.businesspartner.sa</a><br>إن لم ترغبوا باستقبال رسائلنا فيكفي أن تردّوا بكلمة «إيقاف» وسنوقف المراسلة فوراً.</div>
<div style="direction:ltr;text-align:left;margin-top:8px;">If you would rather not receive our emails, simply reply &ldquo;STOP&rdquo; and we will stop immediately.</div>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

import { fileURLToPath } from "node:url";
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(renderEmail(
    "نتولى معاملات منشأتكم لتتفرغوا لضيوفكم | Your admin handled, your guests first",
    "يسرّنا في Business Partner أن نتواصل معكم، فنحن نعمل مع المنشآت العاملة في قطاع الضيافة بمدينة المدينة المنورة على تخفيف الأعباء الإدارية والحكومية عنها.\n\nوندرك أن فرق التشغيل في الفنادق كبيرة ومتغيرة، ولذلك نتولى عنكم جانباً من المعاملات والإجراءات ليبقى تركيزكم على خدمة الضيوف.",
    "Makarem Burj Almadinah",
    "At Business Partner we work with hospitality businesses in Madinah to take the administrative and government workload off their hands.\n\nWe know hotel operations teams are large and constantly changing, so we take care of part of the paperwork and procedures so your focus stays on your guests.",
  ));
}
