// صفحة العرض الخاصة بالعميل — فرع مخفيّ من الموقع الرسمي لكل طلب.
//
// المشكلة التي تحلّها: الوساطة تعني أن كل عميل يصله عرض مفصّل خاص بطلبه هو،
// لا نشرة عامة. إرسال الصور والمساحات في رسالة واتساب يضيع بعد يومين، والمرفقات
// لا تُقرأ على الجوال. الصفحة رابط واحد يفتحه العميل فيرى طلبه وما يطابقه.
//
// لماذا مفتاح في التخزين لا صفّ في قاعدة البيانات: حزمة العرض بنية متغيّرة
// (عدد عروض مختلف، حقول تختلف بين عقار ورخصة وعمالة)، وأي جدول سيصير أعمدةً
// فارغة. والتخزين يعمل محلياً وفي الإنتاج بنفس الواجهة بلا هجرة مخطّط.
//
// الأمان: الرمز هو الإذن. ٣٢ بايت عشوائية = لا يُخمّن، ولا فهرسة، ولا قائمة
// تُعدّد الرموز. ومع ذلك الصفحة تُعامل كـ«سرّية بالرابط» لا كـ«مصادَق عليها»:
// لا تُوضع فيها أسعار داخلية ولا هوامش ولا بيانات عميل آخر.

import crypto from "node:crypto";
import { storagePut, storageGet } from "./_db.js";

const PREFIX = "offers";

export function newToken() {
  // base64url: قصير، وآمن في المسار، وبلا محارف تحتاج ترميزاً
  return crypto.randomBytes(24).toString("base64url");
}

/* الرمز يأتي من المسار، فلا بد أن يُقيَّد قبل أن يبني اسم ملف —
   وإلا صار `../` في الرمز قراءةً لأي ملف في المخزن. */
function safeToken(t) {
  const s = String(t || "");
  return /^[A-Za-z0-9_-]{16,64}$/.test(s) ? s : null;
}

export async function putOffer(pkg) {
  const token = pkg.token && safeToken(pkg.token) ? pkg.token : newToken();
  const body = { ...pkg, token, saved_at: new Date().toISOString() };
  await storagePut(`${PREFIX}/${token}.json`, Buffer.from(JSON.stringify(body), "utf8"), "application/json");
  return token;
}

export async function getOffer(token) {
  const t = safeToken(token);
  if (!t) return null;
  try {
    const buf = await storageGet(`${PREFIX}/${t}.json`);
    return JSON.parse(buf.toString("utf8"));
  } catch {
    return null;   // مفقود أو تالف — الصفحة تقول «غير موجود» لا تنهار
  }
}

// ————————————————————————— العرض —————————————————————————

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/* الصور والخرائط تأتي من n8n، وقد تأتي من مصدر لا نتحكّم به.
   السماح بـ http: و javascript: في src يفتح الصفحة لحقن حقيقي. */
function safeUrl(u) {
  const s = String(u || "").trim();
  return /^https:\/\/[^\s"'<>]+$/i.test(s) ? s : "";
}

function money(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n.toLocaleString("en-US") : "";
}

function fact(label, value) {
  const v = esc(value);
  if (!v) return "";
  return `<div class="f"><dt>${esc(label)}</dt><dd>${v}</dd></div>`;
}

function gallery(images) {
  const safe = (Array.isArray(images) ? images : []).map(safeUrl).filter(Boolean);
  if (!safe.length) return "";
  return `<div class="gal">${safe.map((u, i) =>
    `<a href="${u}" target="_blank" rel="noopener noreferrer">
       <img src="${u}" alt="صورة ${i + 1}" loading="lazy" decoding="async">
     </a>`).join("")}</div>`;
}

function mapBlock(o) {
  const url = safeUrl(o.map_url);
  const lat = Number(o.lat), lng = Number(o.lng);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const href = url || (hasCoords ? `https://www.google.com/maps?q=${lat},${lng}` : "");
  if (!href) return "";
  return `<a class="map" href="${href}" target="_blank" rel="noopener noreferrer">
    <span>📍</span> افتح الموقع على الخريطة</a>`;
}

function offerCard(o, i) {
  const price = money(o.price);
  return `<article class="card">
    <header>
      <span class="num">${i + 1}</span>
      <h2>${esc(o.title || "عرض")}</h2>
      ${price ? `<span class="price">${esc(price)} <small>${esc(o.currency || "ريال")}</small></span>` : ""}
    </header>
    ${gallery(o.images)}
    <dl class="facts">
      ${fact("المساحة", o.area ? `${o.area} م²` : "")}
      ${fact("المدينة", o.city)}
      ${fact("الحي", o.district)}
      ${fact("النوع", o.category)}
      ${fact("عمر العقار", o.age)}
      ${fact("الواجهة", o.facade)}
      ${fact("عدد الوحدات", o.units)}
      ${fact("الحالة", o.status)}
    </dl>
    ${o.notes ? `<p class="notes">${esc(o.notes)}</p>` : ""}
    ${mapBlock(o)}
  </article>`;
}

export function offerHtml(pkg) {
  const p = pkg || {};
  const offers = Array.isArray(p.offers) ? p.offers : [];
  const client = esc(p.client_name || "عميلنا الكريم");
  const reqTitle = esc(p.request_title || p.request_summary || "");
  const brand = "Business Partner";

  // بلا عروض: صفحة صادقة بدل هيكل فارغ يوحي بعطل
  const body = offers.length
    ? offers.map(offerCard).join("")
    : `<div class="empty">لا توجد عروض في هذا الرابط بعد. سنوافيك فور توفّرها.</div>`;

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow,noarchive">
<meta name="referrer" content="no-referrer">
<title>${brand} — عرض خاص بطلبك</title>
<style>
  :root{color-scheme:light;--navy:#0b2545;--ink:#132033;--mut:#5b6b80;
    --line:#e3e9f0;--bg:#f6f8fb;--gold:#b8894a;--card:#fff}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
    font:15px/1.75 system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif}
  .wrap{max-width:900px;margin:0 auto;padding:0 16px 64px}
  header.top{background:var(--navy);color:#fff;padding:26px 0 30px;margin-bottom:22px}
  header.top .wrap{padding-bottom:0}
  .brand{font-size:13px;letter-spacing:.14em;opacity:.8}
  h1{margin:8px 0 6px;font-size:22px;font-weight:700}
  .sub{opacity:.85;font-size:14px;margin:0}
  .req{background:var(--card);border:1px solid var(--line);border-radius:14px;
    padding:16px 18px;margin-bottom:22px}
  .req b{color:var(--navy)}
  .card{background:var(--card);border:1px solid var(--line);border-radius:16px;
    padding:18px;margin-bottom:18px}
  .card header{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;
    background:none;padding:0;color:inherit}
  .num{width:26px;height:26px;border-radius:50%;background:var(--navy);color:#fff;
    display:grid;place-items:center;font-size:12px;flex:none}
  .card h2{margin:0;font-size:17px;flex:1 1 200px}
  .price{color:var(--gold);font-weight:700;font-size:17px;white-space:nowrap}
  .price small{font-weight:400;font-size:12px;color:var(--mut)}
  .gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));
    gap:8px;margin-bottom:14px}
  .gal img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:10px;
    border:1px solid var(--line);display:block}
  .facts{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));
    gap:10px;margin:0 0 12px}
  .f dt{font-size:12px;color:var(--mut);margin-bottom:2px}
  .f dd{margin:0;font-weight:600}
  .notes{color:var(--mut);margin:0 0 12px;white-space:pre-wrap}
  .map{display:inline-flex;align-items:center;gap:6px;text-decoration:none;
    color:var(--navy);border:1px solid var(--line);border-radius:10px;
    padding:8px 14px;font-size:14px;font-weight:600}
  .empty{background:var(--card);border:1px dashed var(--line);border-radius:14px;
    padding:36px 18px;text-align:center;color:var(--mut)}
  footer{margin-top:30px;padding-top:18px;border-top:1px solid var(--line);
    color:var(--mut);font-size:13px;text-align:center}
  footer a{color:var(--navy)}
  @media(max-width:480px){.gal{grid-template-columns:repeat(auto-fill,minmax(120px,1fr))}}
</style>
</head>
<body>
<header class="top"><div class="wrap">
  <div class="brand">${brand}</div>
  <h1>عرض خاص بطلبك</h1>
  <p class="sub">مرحباً ${client} — هذه الصفحة خاصة بك وحدك.</p>
</div></header>

<div class="wrap">
  ${reqTitle ? `<div class="req"><b>طلبك:</b> ${reqTitle}</div>` : ""}
  ${body}
  <footer>
    هذه الصفحة خاصة ولا تظهر في محركات البحث.
    لأي استفسار تواصل معنا عبر <a href="https://www.businesspartner.sa">businesspartner.sa</a>
  </footer>
</div>
</body>
</html>`;
}
