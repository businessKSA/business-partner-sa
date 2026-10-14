// قوالب بريد Business Partner الصادر — ثنائية اللغة (عربي من اليمين لليسار ثم إنجليزي)، HTML بجداول وأنماط مضمّنة (Gmail/Outlook).
// أربعة أنواع بهيكل واحد: welcome (الرسالة الرئيسية الأولى) · service (خدمة الأسبوع) · news (أخبار الأسبوع) · platforms (تحديثات المنصات).
// المحتوى الثابت (الخدمات) من `site/assets/data/catalog.json` بلا أسعار؛ ما يكتبه Azure هو المقدمات والملخصات فقط.
// الدالة تُحقن نصّاً في عقد Code داخل n8n (update-campaign-email.mjs) وتُستعمل محلياً للمعاينة:
//   node ops/azure-n8n/email-template.mjs <welcome|service|news|platforms> > preview.html
// يجب أن تبقى مستقلة بذاتها (بلا استيراد ولا متغيّرات خارجها) لأنها تُنسخ كما هي إلى n8n.
//
// d = { subject, company, introAr, introEn, unsubUrl, service?:{nameAr,nameEn,whatAr[],whatEn[],forAr,forEn,url}, items?:[{tag,date,titleAr,titleEn,bodyAr,bodyEn,url}] }
export function renderEmail(kind, d) {
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const NAVY = "#0B1B5A", SITE = "https://www.businesspartner.sa";
  const C = {
    phone: "0530540231", phoneIntl: "+966530540231", agentWa: "https://wa.me/966507034157", agentNo: "0507034157",
    mail: "business@businesspartner.sa",
    social: [
      ["in", "LinkedIn", "https://www.linkedin.com/company/108785026/"],
      ["f", "Facebook", "https://www.facebook.com/BusinessPartnerKsa/"],
      ["ig", "Instagram", "https://www.instagram.com/businesspartnersa/"],
    ],
  };
  const UNSUB = d.unsubUrl || SITE;
  const L = {
    ar: {
      dir: "rtl", align: "right", font: "Tahoma,Arial,'Segoe UI',sans-serif",
      hello: `السادة / <span dir="ltr" style="unicode-bidi:isolate;">${esc(d.company)}</span> المحترمين،`,
      cta: "اطلب استشارتك", browse: "تصفّح كل خدماتنا", bye: "مع خالص التحية،", team: "فريق Business Partner",
      close: "يكفي أن تردّوا على هذه الرسالة بما يهمّكم، وسنتواصل معكم في الوقت الذي يناسبكم.",
      contact: "تواصلوا معنا", phone: "الفريق (هاتف)", agent: "المستشار الذكي (واتساب)", mail: "البريد الإلكتروني", web: "الموقع", hours: "الأحد – الخميس · 9 ص – 6 م · والمستشار الذكي على مدار الساعة", follow: "تابعونا",
      legal: "Business Partner Solutions Company — الرياض، حي السليمانية، شارع تركي بن عبدالله آل سعود، مبنى 2978، الرمز البريدي 12234",
      why: "لماذا Business Partner؟", whyItems: ["جهة واحدة لكل معاملاتكم", "فريق متخصص يتابع الإجراء حتى إتمامه", "مستشار ذكي على موقعنا يجيب عن أسئلتكم"],
      unsub: `تصلكم هذه الرسالة لأن منشأتكم ضمن قائمة الأعمال التي نتواصل معها. لإيقاف استقبال رسائلنا <a href="${esc(UNSUB)}" style="color:${NAVY};font-weight:bold;text-decoration:underline;">اضغطوا هنا لإلغاء الاشتراك</a> — أو ردّوا بكلمة «إيقاف» ولن نراسلكم بعدها.`,
      more: "اقرأ المزيد", whatTitle: "ما الذي تشمله الخدمة", forTitle: "لمن تناسب", svcTitle: "ما الذي نقدّمه لكم",
    },
    en: {
      dir: "ltr", align: "left", font: "'Segoe UI',Arial,Tahoma,sans-serif",
      hello: `Dear <span dir="auto" style="unicode-bidi:isolate;">${esc(d.company)}</span> team,`,
      cta: "Request a consultation", browse: "Browse all our services", bye: "Kind regards,", team: "The Business Partner team",
      close: "Simply reply to this email with what matters to you and we will get back to you at a time that suits you.",
      contact: "Get in touch", phone: "Team (phone)", agent: "Smart advisor (WhatsApp)", mail: "Email", web: "Website", hours: "Sun–Thu · 9 AM – 6 PM · and our smart advisor around the clock", follow: "Follow us",
      legal: "Business Partner Solutions Company — Al Sulaimaniyah District, Turki Ibn Abdullah Aal Saud St., Building 2978, Riyadh 12234, Saudi Arabia",
      why: "Why Business Partner?", whyItems: ["One partner for all your filings", "A specialist team that follows through to completion", "A smart advisor on our website to answer your questions"],
      unsub: `You are receiving this email because your business is on our business contact list. To stop receiving our emails <a href="${esc(UNSUB)}" style="color:${NAVY};font-weight:bold;text-decoration:underline;">unsubscribe here</a> — or reply &ldquo;STOP&rdquo; and we will not email you again.`,
      more: "Read more", whatTitle: "What the service covers", forTitle: "Who it is for", svcTitle: "What we offer",
    },
  };
  const H = {
    welcome: { ar: ["نمضي معكم من الفكرة إلى النجاح", "نتولى عنكم المعاملات،<br>لتتفرغوا لنموّ أعمالكم", "جهة واحدة تُنجز تأسيس شركتكم، وتوظيف فرقكم، ومعاملاتكم الحكومية في المملكة."], en: ["From idea to success, together", "We handle the paperwork,<br>so you can grow your business", "One partner for company setup, hiring and government services across the Kingdom."] },
    service: { ar: ["خدمة الأسبوع", esc(d.service?.nameAr), "تعرّفوا على خدمة جديدة من Business Partner كل أحد."], en: ["Service of the week", esc(d.service?.nameEn), "Meet a new Business Partner service every Sunday."] },
    news: { ar: ["نشرة الأسبوع", "أخبار الأسبوع لقطاع الأعمال", "أبرز ما يهم منشأتكم، ملخّصاً في دقيقة."], en: ["Weekly briefing", "This week in business news", "What matters to your business, summarised in a minute."] },
    platforms: { ar: ["تحديثات المنصات", "تحديثات المنصات الحكومية", "قوى · مقيم · أبشر أعمال · التأمينات · مُدد · بلدي · زاتكا — ما تغيّر وما عليكم فعله."], en: ["Platform updates", "Government platform updates", "Qiwa · Muqeem · Absher Business · GOSI · Mudad · Balady · ZATCA — what changed and what to do."] },
  }[kind];
  const SERVICES = {
    ar: [["تأسيس الشركات", "السجل التجاري، عقد التأسيس، عضوية الغرفة التجارية، والترخيص"], ["الاستثمار الأجنبي", "تأسيس الشركات الأجنبية والمشتركة وتراخيص المستثمرين"], ["الإقامة المميزة", "تقييم الأهلية وتحديد المسار وتقديم الإجراءات"], ["الخدمات الحكومية", "أبشر أعمال، مقيم، التأمينات الاجتماعية، حماية الأجور (مُدد)، الرخص البلدية"], ["الموارد البشرية والتوظيف", "تأشيرات العمل والاستقدام، التوظيف والتعاقد الخارجي (PEO/EOR)، الاستقطاب التنفيذي"], ["دعم الأعمال", "فتح الحساب البنكي التجاري، التسويق الرقمي، الامتياز التجاري"], ["المكاتب ومساحات العمل", "مكتب افتراضي بعنوان وطني، مساحات عمل مشتركة، مكاتب خاصة"], ["الأتمتة والذكاء الاصطناعي", "المستشار الذكي، الموظف الذكي، مستشار الامتثال"]],
    en: [["Company Formation", "Commercial registration, articles of association, Chamber of Commerce membership and licensing"], ["Foreign Investment", "Foreign-owned and joint-venture company setup, investor licences"], ["Premium Residency", "Eligibility assessment, pathway selection and application"], ["Government Services", "Absher Business, Muqeem, GOSI, Wage Protection (Mudad), municipal licences"], ["HR & Recruitment", "Work visas and recruitment, PEO/EOR, executive search"], ["Business Support", "Corporate bank account opening, digital marketing, franchise compliance"], ["Offices & Workspaces", "Virtual office with a national address, coworking, private offices"], ["AI & Automation", "Smart advisor, smart employee, compliance advisor"]],
  };
  const check = (t, dsc, F, D) => `<tr><td width="40" valign="top" style="padding:0 0 14px 0;"><span style="display:inline-block;width:24px;height:24px;line-height:24px;border-radius:12px;background:${NAVY};color:#ffffff;text-align:center;font-size:13px;font-family:Arial,sans-serif;">&#10003;</span></td><td valign="top" style="padding:0 0 14px 0;font-family:${F};${D}"><div style="font-size:15.5px;font-weight:bold;color:${NAVY};line-height:1.6;">${esc(t)}</div>${dsc ? `<div style="font-size:13.5px;color:#5a6478;line-height:1.7;">${esc(dsc)}</div>` : ""}</td></tr>`;
  const heading = (txt) => `<div style="font-size:18px;font-weight:bold;color:${NAVY};margin:0 0 6px;">${txt}</div><div style="width:46px;height:3px;background:${NAVY};margin:0 0 18px;font-size:0;line-height:0;">&nbsp;</div>`;
  const button = (href, txt) => `<a href="${href}" style="display:inline-block;background:${NAVY};color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;padding:14px 38px;border-radius:8px;">${txt}</a>`;
  const paras = (s) => String(s ?? "").trim().split(/\n\s*\n/).filter(Boolean).map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.95;color:#1f2937;">${esc(p.trim()).replace(/\n/g, "<br>")}</p>`).join("");

  const body = (k) => {
    const t = L[k], F = t.font, D = `direction:${t.dir};text-align:${t.align};`, h = H[k];
    const sec = (inner, pad = "10px 36px 8px") => `<tr><td style="padding:${pad};font-family:${F};${D}">${inner}</td></tr>`;
    const intro = k === "ar" ? d.introAr : d.introEn;
    let main = "";
    if (kind === "welcome") {
      main = sec(`${heading(t.svcTitle)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${t.dir}">${SERVICES[k].map(([a, b]) => check(a, b, F, D)).join("")}</table>`);
    } else if (kind === "service") {
      const s = d.service || {};
      const what = (k === "ar" ? s.whatAr : s.whatEn) || [];
      const forWho = k === "ar" ? s.forAr : s.forEn;
      main = sec(`${heading(t.whatTitle)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${t.dir}">${what.map((w) => check(w, "", F, D)).join("")}</table>`)
        + (forWho ? sec(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2ff;border-radius:10px;"><tr><td style="padding:16px 20px;font-family:${F};${D}"><div style="font-size:15px;font-weight:bold;color:${NAVY};margin:0 0 6px;">${t.forTitle}</div><div style="font-size:14.5px;line-height:1.9;color:#1f2937;">${esc(forWho)}</div></td></tr></table>`, "6px 36px 4px") : "");
    } else {
      main = sec((d.items || []).map((it) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e9f0;border-radius:10px;margin:0 0 14px;"><tr><td style="padding:16px 18px;font-family:${F};${D}">
${it.tag ? `<span style="display:inline-block;background:#eef2ff;color:${NAVY};font-size:12px;font-weight:bold;padding:3px 10px;border-radius:10px;margin:0 0 8px;">${esc(it.tag)}</span>${it.date ? `<span style="font-size:12px;color:#5a6478;"> &nbsp;${esc(it.date)}</span>` : ""}` : ""}
<div style="font-size:16px;font-weight:bold;color:${NAVY};line-height:1.7;margin:2px 0 4px;">${esc(k === "ar" ? it.titleAr : it.titleEn)}</div>
<div style="font-size:14px;line-height:1.85;color:#374151;">${esc(k === "ar" ? it.bodyAr : it.bodyEn)}</div>
${it.url ? `<div style="margin-top:8px;font-size:13.5px;"><a href="${esc(it.url)}" style="color:${NAVY};font-weight:bold;text-decoration:underline;">${t.more}</a></div>` : ""}
</td></tr></table>`).join(""), "10px 36px 4px");
    }
    const whyBox = kind === "welcome" ? sec(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2ff;border-radius:10px;"><tr><td style="padding:16px 20px;font-family:${F};${D}"><div style="font-size:15px;font-weight:bold;color:${NAVY};margin:0 0 6px;">${t.why}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${t.dir}">${t.whyItems.map((w) => `<tr><td style="padding:5px 0;font-family:${F};font-size:14px;color:#1f2937;${D}line-height:1.7;"><span style="color:${NAVY};font-weight:bold;">&#9679;</span>&nbsp; ${esc(w)}</td></tr>`).join("")}</table></td></tr></table>`, "6px 36px 4px") : "";
    const ctaUrl = kind === "service" && d.service?.url ? d.service.url : SITE;
    return `<tr><td style="background:${NAVY};padding:32px 36px;${D}font-family:${F};"><div style="font-size:12.5px;letter-spacing:.3px;color:#aab6e6;margin:0 0 10px;">${h[0]}</div><div style="font-size:24px;line-height:1.6;font-weight:bold;color:#ffffff;margin:0 0 10px;">${h[1]}</div><div style="font-size:14.5px;line-height:1.9;color:#dbe2fb;">${h[2]}</div></td></tr>
<tr><td style="padding:28px 36px 6px;font-family:${F};${D}"><p style="margin:0 0 14px;font-size:17px;font-weight:bold;color:${NAVY};">${t.hello}</p>${paras(intro)}</td></tr>
${main}${whyBox}
<tr><td align="center" style="padding:24px 36px 6px;font-family:${F};">${button(ctaUrl, t.cta)}<div style="margin-top:14px;font-size:13.5px;"><a href="${SITE}/catalog" style="color:${NAVY};text-decoration:underline;">${t.browse}</a></div></td></tr>
<tr><td style="padding:18px 36px 22px;font-family:${F};${D}font-size:15px;line-height:1.9;color:#1f2937;">${t.close}<br><br>${t.bye}<br><strong style="color:${NAVY};">${t.team}</strong></td></tr>`;
  };
  const badge = (txt, href, title) => `<a href="${href}" title="${title}" style="display:inline-block;width:34px;height:34px;line-height:34px;border-radius:17px;background:${NAVY};color:#ffffff;text-decoration:none;text-align:center;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;margin:0 4px;">${txt}</a>`;
  const row = (icon, label, val) => `<tr><td width="30" valign="top" style="font-size:16px;line-height:1.9;">${icon}</td><td style="font-size:14px;line-height:1.9;color:#1f2937;">${label ? `<strong>${label}:</strong> ` : ""}${val}</td></tr>`;
  const contactBlock = (k) => {
    const t = L[k], F = t.font, D = `direction:${t.dir};text-align:${t.align};`;
    return `<tr><td style="padding:6px 36px 22px;font-family:${F};${D}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e9f0;border-radius:10px;"><tr><td style="padding:16px 20px;font-family:${F};${D}">
<div style="font-size:16px;font-weight:bold;color:${NAVY};margin:0 0 8px;">${t.contact}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${t.dir}">
${row("&#9742;&#65039;", t.phone, `<a href="tel:${C.phoneIntl}" style="color:${NAVY};text-decoration:none;" dir="ltr">${C.phone}</a>`)}
${row("&#128172;", t.agent, `<a href="${C.agentWa}" style="color:${NAVY};text-decoration:none;" dir="ltr">${C.agentNo}</a>`)}
${row("&#9993;&#65039;", t.mail, `<a href="mailto:${C.mail}" style="color:${NAVY};text-decoration:none;" dir="ltr">${C.mail}</a>`)}
${row("&#127760;", t.web, `<a href="${SITE}" style="color:${NAVY};text-decoration:none;" dir="ltr">www.businesspartner.sa</a>`)}
${row("&#128339;", "", t.hours)}
</table>
<div style="margin:12px 0 6px;font-size:14px;font-weight:bold;color:${NAVY};">${t.follow}</div>
<div>${C.social.map(([a, n, u]) => badge(a, u, n)).join("")}</div>
</td></tr></table></td></tr>`;
  };
  const divider = `<tr><td style="padding:6px 36px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #d5dbea;font-size:0;line-height:0;">&nbsp;</td><td width="1" style="padding:0 14px;white-space:nowrap;font-family:Arial,sans-serif;font-size:12px;letter-spacing:1.5px;color:#5a6478;">ENGLISH</td><td style="border-top:1px solid #d5dbea;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr><tr><td style="height:18px;font-size:0;line-height:0;">&nbsp;</td></tr>`;
  const footer = `<tr><td style="padding:18px 36px 24px;background:#f8f9fc;border-top:1px solid #e5e9f0;font-family:Tahoma,Arial,'Segoe UI',sans-serif;font-size:12.5px;line-height:1.8;color:#5a6478;">
<div style="direction:rtl;text-align:right;"><strong style="color:${NAVY};">${L.ar.legal.split(" — ")[0]}</strong> — ${L.ar.legal.split(" — ")[1]}<br>${L.ar.unsub}</div>
<div style="direction:ltr;text-align:left;margin-top:10px;"><strong style="color:${NAVY};">${L.en.legal.split(" — ")[0]}</strong> — ${L.en.legal.split(" — ")[1]}<br>${L.en.unsub}</div></td></tr>`;
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(d.subject)}</title></head>
<body style="margin:0;padding:0;background:#f3f5fa;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f3f5fa;font-size:1px;line-height:1px;">${esc(d.subject)} — Business Partner</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5fa;padding:24px 10px;"><tr><td align="center">
<table role="presentation" width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e9f0;">
<tr><td align="center" style="padding:26px 32px 20px;background:#ffffff;"><a href="${SITE}" style="text-decoration:none;"><img src="${SITE}/assets/img/logo.png" width="230" alt="Business Partner" style="display:block;border:0;width:230px;max-width:100%;height:auto;"></a></td></tr>
${body("ar")}
${contactBlock("ar")}
${divider}
${body("en")}
${contactBlock("en")}
${footer}
</table>
</td></tr></table>
</body></html>`;
}

import { fileURLToPath } from "node:url";
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const kind = process.argv[2] || "welcome";
  const base = { company: "Makarem Burj Almadinah", unsubUrl: process.env.UNSUB_PREVIEW || "https://example.invalid/unsubscribe-preview" };
  const SAMPLES = {
    welcome: { ...base, subject: "نتولى معاملات منشأتكم لتتفرغوا لضيوفكم | Your admin handled, your guests first",
      introAr: "يسرّنا في Business Partner أن نتواصل معكم، فنحن نعمل مع المنشآت العاملة في قطاع الضيافة بمدينة المدينة المنورة على تخفيف الأعباء الإدارية والحكومية عنها.\n\nوندرك أن فرق التشغيل في الفنادق كبيرة ومتغيرة، ولذلك نتولى عنكم جانباً من المعاملات والإجراءات ليبقى تركيزكم على خدمة الضيوف.",
      introEn: "At Business Partner we work with hospitality businesses in Madinah to take the administrative and government workload off their hands.\n\nWe know hotel operations teams are large and constantly changing, so we take care of part of the paperwork and procedures so your focus stays on your guests." },
    service: { ...base, subject: "خدمة الأسبوع: فتح حساب بنكي تجاري | Service of the week: Corporate bank account opening",
      introAr: "هذا الأسبوع نعرّفكم بخدمة فتح الحساب البنكي التجاري للشركة، لتبدؤوا استقبال المدفوعات وإدارة أموال منشأتكم بلا تعقيد.",
      introEn: "This week we introduce corporate bank account opening, so you can start receiving payments and managing your company's funds without the hassle.",
      service: { nameAr: "فتح حساب بنكي تجاري للشركة", nameEn: "Corporate bank account opening", whatAr: ["تجهيز المستندات المطلوبة للبنك", "ترتيب موعد وتقديم الطلب", "متابعة الطلب حتى التفعيل"], whatEn: ["Preparing the documents the bank requires", "Arranging the appointment and submitting the request", "Following up until the account is active"], forAr: "الشركات الجديدة والمنشآت التي تريد حساباً تجارياً مستقلاً.", forEn: "New companies and businesses that need a dedicated business account.", url: "https://www.businesspartner.sa/catalog" } },
    news: { ...base, subject: "أخبار الأسبوع لقطاع الأعمال | This week in business news",
      introAr: "نموذج توضيحي للتصميم — المحتوى الحقيقي يُملأ تلقائياً من رادار الأخبار بعد مراجعته.", introEn: "Design sample — real content is filled automatically from the news radar after review.",
      items: [{ tag: "أنظمة | Regulations", date: "00/00/2026", titleAr: "عنوان الخبر الأول (نموذج)", titleEn: "First news headline (sample)", bodyAr: "ملخص قصير من سطرين يوضّح أثر الخبر على المنشآت، ويُكتب بالعربية الواضحة.", bodyEn: "A two-line summary explaining what the news means for businesses.", url: "https://www.businesspartner.sa" }, { tag: "اقتصاد | Economy", date: "00/00/2026", titleAr: "عنوان الخبر الثاني (نموذج)", titleEn: "Second news headline (sample)", bodyAr: "ملخص قصير من سطرين يوضّح أثر الخبر على المنشآت.", bodyEn: "A two-line summary explaining what the news means for businesses.", url: "https://www.businesspartner.sa" }] },
    platforms: { ...base, subject: "تحديثات المنصات الحكومية هذا الأسبوع | Government platform updates this week",
      introAr: "نموذج توضيحي للتصميم — التحديثات الحقيقية تأتي من مراقب التحديثات الحكومية وتُراجع قبل الإرسال.", introEn: "Design sample — real updates come from the government updates monitor and are reviewed before sending.",
      items: [{ tag: "قوى | Qiwa", date: "00/00/2026", titleAr: "عنوان التحديث الأول (نموذج)", titleEn: "First update headline (sample)", bodyAr: "ما الذي تغيّر؟ ومن يتأثر؟ وما المطلوب من المنشأة وفي أي موعد.", bodyEn: "What changed, who is affected, and what the business needs to do and by when.", url: "https://www.businesspartner.sa" }, { tag: "مُدد | Mudad", date: "00/00/2026", titleAr: "عنوان التحديث الثاني (نموذج)", titleEn: "Second update headline (sample)", bodyAr: "ما الذي تغيّر؟ ومن يتأثر؟ وما المطلوب من المنشأة.", bodyEn: "What changed, who is affected, and what the business needs to do.", url: "https://www.businesspartner.sa" }] },
  };
  process.stdout.write(renderEmail(kind, SAMPLES[kind]));
}
