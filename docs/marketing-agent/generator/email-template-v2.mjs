// The campaign email, rebuilt on the live site's identity (Simple V1) instead of
// the older marketing palette.
//
// What changed and why:
//   • No gold. SV1 has no gold token — the site is navy, greys and one green.
//     The previous template's gold chip belonged to a palette the site dropped.
//   • The email is the first turn of the site's own conversation. The homepage
//     opens "قل لنا وش تحتاج، ونبدأ معك من هنا" and offers three doors; this
//     arrives as the advisor's opening line and the same three doors, in the
//     site's exact words, so the inbox and the landing page are one motion.
//   • The "AI" reading comes from the product's real mechanic — a monitored
//     platform list and a reference line set in the site's mono face — not from
//     sci-fi ornament.
//
// Email constraints that drive every choice below: tables not flex/grid, literal
// hex not CSS variables (Outlook drops them), everything inline, and no images in
// the body because most clients block them and a blocked hero is a blank box.

const esc = (s) => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

// Simple V1 tokens, read from site/scripts/simple-v1.mjs
const C = {
  navy:"#0B1B5A", deep:"#081345", mid:"#16307F", soft:"#EEF2FB",
  page:"#F5F7FB", line:"#E5E9F0", ink:"#232A3D", mut:"#5A6478",
  faint:"#8D97AE", wa:"#25D366", ok:"#047857",
};
const FONT = "'IBM Plex Sans Arabic','IBM Plex Sans','Segoe UI',Tahoma,Arial,sans-serif";
const MONO = "'IBM Plex Mono',ui-monospace,SFMono-Regular,Consolas,monospace";

// The platforms the service actually watches. Shown as a strip because it is the
// most concrete thing we do — and it reads as a system, which is the point.
const PLATFORMS = ["قوى","مقيم","التأمينات","بلدي","مدد","أبشر أعمال","ZATCA"];

const SECTOR_AR = {
  "Contracting & Construction":"المقاولات","Retail & Restaurants":"التجزئة والمطاعم",
  "Manufacturing & Industry":"الصناعة","Healthcare":"الرعاية الصحية",
  "IT & Services":"التقنية","Logistics & Transport":"النقل والخدمات اللوجستية",
  "Finance & Insurance":"التمويل والتأمين","Real Estate":"العقار",
  "Hospitality & Tourism":"الضيافة والسياحة","Education":"التعليم",
  "Defense & Security":"الدفاع والأمن",
};

const DOORS = [
  { k:"consulting", t:"الاستشارات",       s:"سؤال، تحدٍّ، قرار أو موضوع يخص شركتك.",        cta:"ابدأ الاستشارة" },
  { k:"government", t:"الخدمات الحكومية", s:"معاملة، مشكلة في منصة، أو إدارة منصاتك الحكومية.", cta:"ابدأ الطلب" },
  { k:"formation",  t:"تأسيس الشركات",    s:"فرع لشركة أجنبية أو شركة عبر مسار ريادة الأعمال.", cta:"ابدأ التأسيس" },
];

const utm = (base, door) =>
  `${base}${base.includes("?") ? "&" : "?"}utm_source=email&utm_medium=campaign&utm_campaign=advisor-intro&utm_content=${door}`;

/**
 * @param {object} o
 * @param {string} o.company   recipient company name (from the Sales DB)
 * @param {string} o.sector    English sector from the Sales DB, mapped to Arabic
 * @param {string} o.site      https://businesspartner.sa
 * @param {string} o.whatsapp  wa.me link
 * @param {string} o.ref       short reference shown in the mono line
 * @param {string} o.unsubUrl  one-click unsubscribe target
 */
export function renderEmailV2(o) {
  const sector = SECTOR_AR[o.sector] || "";
  // Personalisation only where the data is real. With no sector the line still
  // reads correctly rather than printing an empty slot.
  const opener = sector
    ? `لدينا متابعة يومية لمنصات الجهات الحكومية، ومعظم ما يوقف شركات ${esc(sector)} ليس قراراً صعباً — بل تاريخ انتهاء لم ينتبه له أحد.`
    : `لدينا متابعة يومية لمنصات الجهات الحكومية، ومعظم ما يوقف الشركات ليس قراراً صعباً — بل تاريخ انتهاء لم ينتبه له أحد.`;

  const chips = PLATFORMS.map((p) =>
    `<span style="display:inline-block;font-family:${MONO};font-size:11.5px;color:${C.mid};background:${C.soft};border:1px solid ${C.line};border-radius:6px;padding:4px 9px;margin:0 0 6px 6px;">${esc(p)}</span>`
  ).join("");

  const doors = DOORS.map((d) => `
      <tr><td style="padding:0 0 10px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid ${C.line};border-radius:10px;">
          <tr>
            <td style="padding:16px 18px;" dir="rtl">
              <div style="font-size:16px;font-weight:600;color:${C.navy};line-height:1.6;">${esc(d.t)}</div>
              <div style="font-size:13.5px;color:${C.mut};line-height:1.8;padding-top:3px;">${esc(d.s)}</div>
              <a href="${esc(utm(o.site + "/ar", d.k))}" style="display:inline-block;font-size:13.5px;font-weight:600;color:${C.navy};text-decoration:none;padding-top:9px;">${esc(d.cta)} &#8592;</a>
            </td>
          </tr>
        </table>
      </td></tr>`).join("");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="color-scheme" content="light">
<title>${esc(o.company || "Business Partner")}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
</head>
<body style="margin:0;padding:0;background:${C.page};font-family:${FONT};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">الغرامة لا تأتي فجأة — تأتي لأن أحداً لم ينتبه لتاريخ انتهاء في منصة حكومية.</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};padding:26px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border:1px solid ${C.line};border-radius:14px;overflow:hidden;">

  <!-- Header: wordmark + a mono reference, the site's own data face -->
  <tr><td style="background:${C.navy};padding:18px 26px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td dir="ltr" style="font-size:13px;font-weight:600;letter-spacing:2.6px;color:#ffffff;">BUSINESS&nbsp;PARTNER</td>
      <td dir="ltr" align="left" style="font-family:${MONO};font-size:11px;color:${C.faint};">${esc(o.ref)}</td>
    </tr></table>
  </td></tr>

  <!-- The site's own opening line -->
  <tr><td style="padding:30px 26px 0 26px;" dir="rtl">
    <h1 style="margin:0;font-size:27px;line-height:1.55;color:${C.navy};font-weight:600;text-align:right;">قل لنا وش تحتاج،<br>ونبدأ معك من هنا.</h1>
  </td></tr>

  <!-- The advisor's first turn, as a bubble -->
  <tr><td style="padding:20px 26px 0 26px;" dir="rtl">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="38" valign="top" style="padding:0 0 0 10px;">
          <div style="width:34px;height:34px;border-radius:50%;background:${C.navy};color:#ffffff;font-size:13px;font-weight:600;text-align:center;line-height:34px;">BP</div>
        </td>
        <td valign="top">
          <div style="background:${C.soft};border:1px solid ${C.line};border-radius:12px 12px 12px 4px;padding:14px 16px;">
            <div style="font-size:11.5px;color:${C.mut};font-weight:600;padding-bottom:5px;">المستشار الذكي</div>
            <div style="font-size:14.5px;line-height:1.95;color:${C.ink};">${opener}</div>
          </div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- What we actually watch -->
  <tr><td style="padding:18px 26px 0 26px;" dir="rtl">
    <div style="font-size:11.5px;color:${C.faint};font-weight:600;padding-bottom:9px;">منصات نتابعها لك يومياً</div>
    ${chips}
  </td></tr>

  <!-- The same three doors as the homepage -->
  <tr><td style="padding:20px 26px 0 26px;" dir="rtl">
    <div style="font-size:11.5px;color:${C.faint};font-weight:600;padding-bottom:10px;">من أين تبدأ</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${doors}</table>
  </td></tr>

  <tr><td style="padding:8px 26px 0 26px;" dir="rtl">
    <p style="margin:0;font-size:13.5px;line-height:1.9;color:${C.mut};text-align:right;">ننبّهك قبل الموعد لا بعده. والأسعار تظهر كاملة داخل حسابك على الموقع.</p>
  </td></tr>

  <tr><td style="padding:22px 26px 28px 26px;" dir="rtl">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="padding-left:9px;">
        <a href="${esc(utm(o.site + "/ar", "chat"))}" style="display:inline-block;background:${C.navy};color:#ffffff;font-size:14.5px;font-weight:600;text-decoration:none;padding:13px 28px;border-radius:9px;">ابدأ محادثة</a>
      </td>
      <td>
        <a href="${esc(o.whatsapp)}" style="display:inline-block;background:#ffffff;color:${C.ok};font-size:14.5px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:9px;border:1px solid ${C.line};">واتساب</a>
      </td>
    </tr></table>
  </td></tr>

  <tr><td style="background:${C.deep};padding:18px 26px;" dir="rtl">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td dir="ltr" style="font-size:10.5px;font-weight:600;letter-spacing:2px;color:#B7C0DC;">BUSINESS&nbsp;PARTNER</td>
      <td dir="ltr" align="left" style="font-family:${MONO};font-size:10.5px;color:#8D97AE;">businesspartner.sa</td>
    </tr></table>
    <p style="margin:10px 0 0 0;font-size:11px;line-height:1.8;color:#8D97AE;text-align:right;">
      وصلتك هذه الرسالة لأن شركتك مدرجة في سجلّ منشآت الأعمال لدينا.
      <a href="${esc(o.unsubUrl)}" style="color:#B7C0DC;text-decoration:underline;">إلغاء الاشتراك بنقرة واحدة</a>
    </p>
  </td></tr>

</table>
</td></tr></table>
</body>
</html>`;
}
