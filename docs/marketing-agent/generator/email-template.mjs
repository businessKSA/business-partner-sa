import { BRAND } from "./playbooks.mjs";

const esc = (s) => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

// One service per email. Table-based and fully inline-styled so it survives Outlook,
// and deliberately image-free in the body: most clients block images by default, and
// a blocked hero would leave the reader with a blank rectangle instead of the offer.
export function renderEmail(c) {
  const chip = (text, bg, fg) => text
    ? `<span style="display:inline-block; background:${bg}; color:${fg}; font-size:12.5px; font-weight:700; border-radius:999px; padding:6px 14px; margin:0 0 0 6px;">${esc(text)}</span>`
    : "";

  const steps = c.steps.map((s) => `
        <tr>
          <td width="26" valign="top" style="padding:7px 0 0 0; font-size:15px; color:${BRAND.gold};">✓</td>
          <td style="padding:6px 0; font-size:15px; line-height:1.85; color:#3d445e;">${esc(s)}</td>
        </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(c.title)}</title>
</head>
<body style="margin:0; padding:0; background-color:#eef1f6; font-family:'Segoe UI', Tahoma, Arial, sans-serif;">
<div style="display:none; max-height:0; overflow:hidden; opacity:0;">${esc(c.email.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef1f6; padding:28px 12px;">
<tr><td align="center">

<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:600px; background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 2px 10px rgba(11,27,90,.10);">

  <tr><td style="background:${BRAND.navy}; padding:22px 34px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td dir="ltr" style="font-size:13px; font-weight:700; letter-spacing:2.5px; color:${BRAND.goldSoft};">BUSINESS&nbsp;PARTNER</td>
      <td dir="rtl" align="left" style="font-size:12px; color:#aab4d8;">${esc(c.category)}</td>
    </tr></table>
  </td></tr>

  <tr><td style="padding:34px 34px 0 34px;" dir="rtl">
    <div style="width:56px; height:3px; background:${BRAND.gold}; border-radius:2px; margin-bottom:20px;"></div>
    <h1 style="margin:0 0 16px 0; font-size:29px; line-height:1.55; color:${BRAND.navy}; font-weight:700; text-align:right;">${esc(c.headline)}</h1>
    <p style="margin:0 0 24px 0; font-size:15.5px; line-height:1.95; color:#4a5170; text-align:right;">${esc(c.pain)}</p>
  </td></tr>

  <tr><td style="padding:0 34px;" dir="rtl">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fc; border:1px solid #e4e9f4; border-radius:12px;">
      <tr><td style="padding:22px 24px;" dir="rtl">
        <div style="font-size:19px; font-weight:700; color:${BRAND.navy}; line-height:1.6; margin-bottom:10px;">${esc(c.title)}</div>
        <div style="margin-bottom:16px;">${chip(c.govPlatform, "#e8edf9", BRAND.navy)}${chip(c.price, "#fbf3e3", "#8a6414")}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${steps}</table>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:24px 34px 0 34px;" dir="rtl">
    <p style="margin:0; font-size:15px; line-height:1.9; color:#3d445e; text-align:right;">${esc(c.proof)}</p>
  </td></tr>

  <tr><td style="padding:26px 34px 32px 34px;" dir="rtl">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="padding-left:10px;">
        <a href="${esc(c.whatsappLink)}" style="display:inline-block; background:${BRAND.green}; color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; padding:14px 30px; border-radius:9px;">تواصل عبر واتساب</a>
      </td>
      <td>
        <a href="${esc(c.url)}" style="display:inline-block; background:#ffffff; color:${BRAND.navy}; font-size:15px; font-weight:700; text-decoration:none; padding:13px 26px; border-radius:9px; border:1px solid #d8dfee;">تفاصيل الخدمة</a>
      </td>
    </tr></table>
    <p style="margin:14px 0 0 0; font-size:12.5px; color:#98a0ae; text-align:right;">${esc(c.audience)} · رد بكلمة «إيقاف» ولن نراسلك مرة أخرى.</p>
  </td></tr>

  <tr><td style="background:${BRAND.navyDeep}; padding:20px 34px;" dir="rtl">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td dir="ltr" style="font-size:11px; font-weight:700; letter-spacing:2px; color:${BRAND.goldSoft};">BUSINESS&nbsp;PARTNER</td>
      <td dir="ltr" align="left" style="font-size:11.5px; color:#8b96c2;">${BRAND.phone} · ${BRAND.email}</td>
    </tr></table>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
