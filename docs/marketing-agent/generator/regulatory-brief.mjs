// The weekly regulatory brief — one email, several rulings, each with a date.
//
//   node regulatory-brief.mjs 2026-w37        # → docs/marketing-agent/briefs/2026-w37.html
//
// This is the one piece of marketing the audience actually wants to receive: it
// tells an employer something that costs money if they miss it. Which is also why
// every item carries a source link and why nothing is published from memory —
// a wrong date in a compliance newsletter is worse than no newsletter.
import fs from "node:fs";
import path from "node:path";
import { BRAND } from "./playbooks.mjs";
import { serviceTitle, trackedUrl, priceShort } from "./copy.mjs";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const BRIEFS = path.join(ROOT, "docs/marketing-agent/briefs");
const services = JSON.parse(fs.readFileSync(path.join(ROOT, "site/data/services.json"), "utf8"));
const byCode = Object.fromEntries(services.map((s) => [s.code, s]));

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ar = (n) => String(n).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);

// Days left is the whole point of the format, so it is computed from the issue
// date rather than written into the copy — an issue re-rendered later cannot then
// claim a countdown that has already run out.
function daysLeft(issueDate, deadline) {
  return Math.round((Date.parse(deadline + "T00:00:00Z") - Date.parse(issueDate + "T00:00:00Z")) / 86400000);
}

function countdown(n) {
  if (n < 0) return { text: "انقضى الموعد", bg: "#f4e6e6", fg: "#a3232a" };
  if (n === 0) return { text: "اليوم", bg: "#fbeaea", fg: "#a3232a" };
  if (n <= 30) return { text: `باقٍ ${ar(n)} يوماً`, bg: "#fdf1e3", fg: "#9a5f10" };
  return { text: `باقٍ ${ar(n)} يوماً`, bg: "#eef1f6", fg: "#4a5170" };
}

function renderItem(item, issueDate) {
  const n = daysLeft(issueDate, item.deadline);
  const cd = countdown(n);
  const svc = item.serviceCode ? byCode[item.serviceCode] : null;

  const cta = svc
    ? `
        <div style="padding:16px 0 0 0;">
          <a href="${esc(trackedUrl(svc, "email", "regulatory-brief"))}"
             style="display:inline-block; background:${BRAND.navy}; color:#ffffff; font-size:14px; font-weight:700;
                    text-decoration:none; border-radius:8px; padding:11px 20px;">${esc(item.ctaLabel || serviceTitle(svc))}</a>
          <span style="font-size:13px; color:#7b839f; padding-right:10px;">${esc(priceShort(svc))}</span>
        </div>`
    : "";

  return `
  <tr><td style="padding:0 34px;" dir="rtl">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #e3e7f1; border-radius:12px; padding:0;">
      <tr><td style="padding:20px 22px 22px 22px;">

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:12px; font-weight:700; color:${esc(item.tagColor)}; letter-spacing:.5px;">${esc(item.tag)}</td>
          <td align="left">
            <span style="display:inline-block; background:${cd.bg}; color:${cd.fg}; font-size:12px; font-weight:700;
                         border-radius:999px; padding:5px 12px;">${esc(cd.text)}</span>
          </td>
        </tr></table>

        <div style="font-size:19px; line-height:1.55; font-weight:700; color:${BRAND.ink}; padding:12px 0 0 0;">${esc(item.headline)}</div>
        <div style="font-size:13px; color:#7b839f; padding:8px 0 0 0;">الموعد النظامي: ${esc(item.deadlineLabel)}</div>

        <div style="font-size:15px; line-height:1.95; color:#3d445e; padding:14px 0 0 0;">${esc(item.body)}</div>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 0 0;">
          <tr>
            <td width="4" style="background:${BRAND.gold}; border-radius:2px;"></td>
            <td style="background:#faf7f1; padding:14px 16px;">
              <div style="font-size:12.5px; font-weight:700; color:${BRAND.gold}; padding:0 0 6px 0;">ماذا يعني لك</div>
              <div style="font-size:14.5px; line-height:1.9; color:#3d445e;">${esc(item.meaning)}</div>
            </td>
          </tr>
        </table>
        ${cta}

        <div style="font-size:12px; color:#9aa1bb; padding:14px 0 0 0;">
          المصدر: <a href="${esc(item.sourceUrl)}" style="color:#7b839f;">${esc(item.source)}</a>
        </div>

      </td></tr>
    </table>
  </td></tr>
  <tr><td style="height:16px; line-height:16px; font-size:0;">&nbsp;</td></tr>`;
}

// Arabic has a dual form, so "2 minutes" is one word and not a number plus a noun.
function readTime(n) {
  if (n === 1) return "دقيقة";
  if (n === 2) return "دقيقتين";
  return `${ar(n)} دقائق`;
}

export function renderBrief(brief) {
  const items = brief.items.map((i) => renderItem(i, brief.date)).join("");
  const soonest = brief.items
    .map((i) => daysLeft(brief.date, i.deadline))
    .filter((n) => n >= 0)
    .sort((a, b) => a - b)[0];
  const preheader = `${ar(brief.items.length)} تحديثات نظامية${soonest === undefined ? "" : ` — أقربها بعد ${ar(soonest)} يوماً`}.`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>نشرة الامتثال الأسبوعية — ${esc(brief.weekLabel)}</title>
</head>
<body style="margin:0; padding:0; background-color:#eef1f6; font-family:'Segoe UI', Tahoma, Arial, sans-serif;">
<div style="display:none; max-height:0; overflow:hidden; opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef1f6; padding:28px 12px;">
<tr><td align="center">

<table role="presentation" width="640" cellpadding="0" cellspacing="0"
       style="width:640px; max-width:640px; background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 2px 10px rgba(11,27,90,.10);">

  <tr><td style="background:${BRAND.navy}; padding:24px 34px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td dir="ltr" style="font-size:13px; font-weight:700; letter-spacing:2.5px; color:${BRAND.goldSoft};">BUSINESS&nbsp;PARTNER</td>
      <td dir="rtl" align="left" style="font-size:12px; color:#aab4d8;">نشرة الامتثال الأسبوعية</td>
    </tr></table>
  </td></tr>
  <tr><td style="height:4px; background:${BRAND.gold}; line-height:4px; font-size:0;">&nbsp;</td></tr>

  <tr><td style="padding:30px 34px 6px 34px;" dir="rtl">
    <div style="font-size:24px; line-height:1.5; font-weight:700; color:${BRAND.ink};">ما الذي تغيّر هذا الأسبوع في أنظمة المملكة</div>
    <div style="font-size:13px; color:#7b839f; padding:10px 0 0 0;">
      العدد ${ar(brief.issue)} · ${esc(brief.weekLabel)} · ${ar(brief.items.length)} تحديثات · قراءة ${esc(readTime(brief.readMinutes))}
    </div>
  </td></tr>
  <tr><td style="height:22px; line-height:22px; font-size:0;">&nbsp;</td></tr>

  ${items}

  <tr><td style="padding:6px 34px 0 34px;" dir="rtl">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.navy}; border-radius:12px;">
      <tr><td style="padding:24px 24px;">
        <div style="font-size:17px; font-weight:700; color:#ffffff; line-height:1.6;">غير متأكد كيف ينطبق أيٌّ من هذا على منشأتك؟</div>
        <div style="font-size:14px; color:#c3cbe6; line-height:1.9; padding:8px 0 16px 0;">
          ردّ على هذا البريد بسؤالك — يصلنا مباشرةً ونعود إليك بإجابة محدّدة، لا بعرض بيع.
        </div>
        <a href="${esc(BRAND.whatsapp)}?text=${encodeURIComponent(`مرحباً، لدي سؤال عن نشرة الامتثال — العدد ${brief.issue}\n[BRIEF-${brief.date}/email]`)}"
           style="display:inline-block; background:${BRAND.green}; color:#ffffff; font-size:14px; font-weight:700;
                  text-decoration:none; border-radius:8px; padding:12px 22px;">تواصل عبر واتساب ${esc(BRAND.phone)}</a>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:26px 34px 30px 34px;" dir="rtl">
    <div style="height:1px; background:#e3e7f1; font-size:0; line-height:1px;">&nbsp;</div>
    <div style="font-size:12.5px; line-height:1.95; color:#9aa1bb; padding:16px 0 0 0;">
      ${esc(BRAND.nameAr)} — خدمات التأسيس والعلاقات الحكومية والموارد البشرية في المملكة العربية السعودية.<br>
      هذه النشرة ملخّص إخباري وليست استشارة نظامية؛ كل بند مرفق بمصدره الرسمي للرجوع إليه.<br>
      وصلتك هذه الرسالة لأنك ضمن قائمة عملاء ${esc(BRAND.nameAr)}. ردّ بكلمة «إيقاف» ولن نراسلك مرة أخرى.
    </div>
  </td></tr>

</table>

</td></tr>
</table>
</body>
</html>`;
}

const slug = process.argv[2];
if (slug) {
  const brief = JSON.parse(fs.readFileSync(path.join(BRIEFS, `${slug}.json`), "utf8"));
  const out = path.join(BRIEFS, `${slug}.html`);
  fs.writeFileSync(out, renderBrief(brief));
  console.log(`brief ${brief.issue} · ${brief.items.length} items → ${path.relative(ROOT, out)}`);
}
