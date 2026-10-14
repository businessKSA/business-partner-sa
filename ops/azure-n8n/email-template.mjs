// قالب بريد Business Partner الصادر (HTML، من اليمين لليسار، جداول + أنماط مضمّنة ليعمل في Gmail/Outlook).
// الدالة نفسها تُحقن نصّاً في عقدة Code داخل السير (build-email-marketing.mjs) وتُستعمل محلياً لتوليد المعاينة:
//   node ops/azure-n8n/email-template.mjs > preview.html
// يجب أن تبقى الدالة مستقلة بذاتها (بلا استيراد ولا متغيّرات خارجها) لأنها تُنسخ كما هي إلى n8n.
export function renderEmail(subject, body) {
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const paragraphs = String(body ?? "").trim().split(/\n\s*\n/).map((p) =>
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.9;color:#1f2937;">${esc(p.trim()).replace(/\n/g, "<br>")}</p>`).join("");
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f3f5fa;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5fa;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e5e9f0;">
<tr><td style="height:5px;background:#0B1B5A;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td align="center" style="padding:28px 32px 18px;">
<a href="https://www.businesspartner.sa" style="text-decoration:none;"><img src="https://www.businesspartner.sa/assets/img/logo.png" width="230" alt="Business Partner" style="display:block;border:0;width:230px;max-width:100%;height:auto;"></a>
</td></tr>
<tr><td style="padding:6px 36px 8px;font-family:Tahoma,Arial,'Segoe UI',sans-serif;direction:rtl;text-align:right;">
<h1 style="margin:0 0 20px;font-size:20px;line-height:1.6;color:#0B1B5A;">${esc(subject)}</h1>
${paragraphs}
</td></tr>
<tr><td style="padding:8px 36px 30px;font-family:Tahoma,Arial,'Segoe UI',sans-serif;direction:rtl;text-align:right;">
<a href="https://www.businesspartner.sa" style="display:inline-block;background:#0B1B5A;color:#ffffff;text-decoration:none;font-size:15px;padding:12px 26px;border-radius:6px;">تعرّف على خدماتنا</a>
</td></tr>
<tr><td style="padding:18px 36px 24px;background:#f8f9fc;border-top:1px solid #e5e9f0;font-family:Tahoma,Arial,'Segoe UI',sans-serif;direction:rtl;text-align:right;font-size:12.5px;line-height:1.8;color:#5a6478;">
<strong style="color:#0B1B5A;">Business Partner</strong> — Partnering for your success<br>
<a href="https://www.businesspartner.sa" style="color:#0B1B5A;">www.businesspartner.sa</a><br>
إن لم ترغبوا باستقبال رسائلنا فيكفي أن تردّوا بكلمة «إيقاف» وسنوقف المراسلة فوراً.
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

import { fileURLToPath } from "node:url";
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(renderEmail(
    "دعم إداري وتشغيلي لمنشأتكم الفندقية في المدينة المنورة",
    "السادة / مكارم برج المدينة المحترمين،\n\nتحية طيبة،\n\nنتواصل معكم من Business Partner، ونعمل مع الشركات في المملكة على تخفيف الأعباء الإدارية والحكومية عنها، وأبرزها: تأسيس الشركات وتجديد السجلات والرخص، والاستقدام والتوظيف، ومتابعة متطلبات الامتثال، والمحاسبة.\n\nنعلم أن قطاع الضيافة يعتمد على فرق تشغيل كبيرة ومتغيرة، وربما يفيدكم أن نتولى عنكم جانباً من هذه المعاملات لتتفرغوا لخدمة ضيوفكم.\n\nإذا رغبتم في معرفة المزيد، يكفي أن تردوا على هذه الرسالة وسنتواصل معكم في الوقت الذي يناسبكم.\n\nمع خالص التحية،\nفريق Business Partner",
  ));
}
