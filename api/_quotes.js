// طيّ لوحة العروض (bp-quotes) داخل الموقع الرئيسي.
//
// القرار (المالك، 2026-09-16): «bp-quotes يندمج مع الرئيسي وما يستخدم مرة
// تانية». الخطة المكتوبة في docs/quotes-cutover.md أربع مراحل، وهذا الملف
// يحمل ما يمكن إنجازه في المستودع وحده — بلا سرّ ولا وصول إلى قاعدة اللوحة:
//
//   • الكتالوج الحيّ يُخدَم من الموقع نفسه بدل تمريرة إلى اللوحة (التبعية ٤).
//   • روابط `/quotes/d/<token>` القديمة تُخدَم من جدول `requests` (التبعية ٢).
//   • قائمة مستندات العميل تُقرأ من `requests` مباشرة (التبعية ٣).
//
// لماذا ملف يبدأ بـ `_`: Vercel لا ينشر ملفات api/ المسبوقة بشرطة سفلية
// كدوال، والمشروع على سقف ١٢ دالة وهو ممتلئ. فكل ما يضاف يمرّ عبر
// `api/requests.js?__route=…`.
//
// المبدأ الحاكم في كل دالة هنا: **لا ينكسر شيء بيد عميل**. ما دامت اللوحة
// حيّة، ما لا يعرفه الموقع يُحوَّل إليها؛ وحين تُطفأ (`QUOTES_PANEL_RETIRED=1`)
// يُقال للعميل قولاً صريحاً بدل 404 صامت.

import { sb, DB_ON } from "./_db.js";
import { loadCatalog } from "./_catalog.js";

const PANEL_URL = (function () {
  const raw = (process.env.QUOTES_PANEL_URL || "https://bp-quotes-three.vercel.app/quotes")
    .trim().replace(/\/+$/, "");
  return raw.endsWith("/quotes") ? raw : raw + "/quotes";
})();

// المفتاح الذي يُنهي عمر اللوحة: يُضبط في Vercel يوم يُحذف المشروع، فيتوقف
// الموقع عن التحويل إليها ويشرح بدلاً من أن يرمي العميل على عنوان ميّت.
export const PANEL_RETIRED = process.env.QUOTES_PANEL_RETIRED === "1";

const q = (s) => encodeURIComponent(String(s == null ? "" : s));

export const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/* الرمز يأتي من مسار عام؛ يُقيَّد قبل أن يدخل استعلاماً أو عنواناً. */
function safeToken(t) {
  const s = String(t || "").trim();
  return /^[A-Za-z0-9_-]{8,128}$/.test(s) ? s : null;
}

const money = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
};

// ───────────────────────── ١) الكتالوج الحيّ ─────────────────────────
//
// كان `/api/live-catalog` تمريرةً إلى `/quotes/api/catalog`، أي أن الموقع
// الرئيسي يعتمد على المشروع الذي نريد حذفه ليعرف أسعاره هو. ومصدر الحقيقة
// اليوم `site/assets/data/*` لا قاعدة اللوحة، فالتمريرة صارت التفافاً حول
// العالم للوصول إلى الجار.
//
// الشكل يحمل الاسمين معاً (`unitPrice` و`price`) لأن اللوحة وn8n يقرآن
// الأول، وبقية الموقع يقرأ الثاني — فلا يُكسَر مستهلك قائم بتغيير اسم.
export async function handleLiveCatalog(req, res) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: "method_not_allowed" }));
  }
  try {
    const cat = await loadCatalog();
    const services = (cat.services || []).map((s) => ({
      code: s.code,
      category: s.category,
      categoryAr: s.categoryAr,
      nameAr: s.nameAr,
      nameEn: s.nameEn,
      descAr: s.descAr,
      descEn: "",
      unitPrice: s.price,
      price: s.price,
      priceLabel: s.priceLabel,
      unitAr: "خدمة",
      unitEn: "service",
      minQty: 1,
      // «السعر مفتوح» = لا سعر معلن أصلاً، فيُكتب في العرض يدوياً. وهو غير
      // `requiresProposal`: خدمة بـ٣٠٠ ﷼ تحتاج عرضاً ما زالت بـ٣٠٠ ﷼، وخلطُ
      // الاثنين كان يُفرّغ سعراً معلناً من الكتالوج عند بناء العرض.
      openPrice: s.price == null,
      attachGovFees: !!s.govFeesSeparate,
      requiresProposal: !!s.requiresProposal,
      govPlatform: s.govPlatform,
      url: s.url,
    }));
    res.statusCode = 200;
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=600");
    return res.end(JSON.stringify({
      ok: true,
      updatedAt: cat.updated || new Date().toISOString(),
      currency: "SAR",
      count: services.length,
      source: "site",       // لا «panel» — التبعية انتهت
      services,
      packages: cat.packages || [],
    }));
  } catch (e) {
    // الكتالوج مقروء من الموقع؛ تعذّره عطلٌ عابر لا يُسكَت عليه بمصفوفة فارغة
    // توحي بأن الشركة بلا خدمات.
    res.statusCode = 502;
    return res.end(JSON.stringify({ ok: false, error: "catalog_unavailable", detail: String(e.message || e).slice(0, 160) }));
  }
}

// ───────────────────── ٢) روابط المستندات القديمة ─────────────────────
//
// `/quotes/d/<token>` أُرسل في بريد وواتساب عملاء منذ أشهر. هذه هي التبعية
// التي تجعل حذف اللوحة خطراً: كل عرض سعر وعقد في يد عميل يصير 404.
//
// الحلّ جدول ربط `token → ref` يكتبه سكربت النقل (ops/quotes-migrate.mjs)،
// ثم يُخدَم المستند من `requests` الذي يحمل العرض والعقد والفاتورة أصلاً.
// وما لم يُنقل بعدُ يُحوَّل إلى اللوحة ما دامت حيّة — فالنقل يصير تدريجياً
// بلا يوم انقطاع.

async function refForToken(token) {
  if (!DB_ON) return null;
  try {
    const rows = await sb(`legacy_doc_links?token=eq.${q(token)}&select=ref,kind&limit=1`);
    return rows[0] || null;
  } catch {
    return null;   // الجدول قد لا يكون مُهاجَراً بعد؛ التحويل يغطّي
  }
}

async function requestByRef(ref) {
  const rows = await sb(`requests?ref=eq.${q(ref)}&select=*&limit=1`);
  return rows[0] || null;
}

function itemsTable(items) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return "";
  const rows = list.map((it, i) => `<tr>
      <td class="n">${i + 1}</td>
      <td>${esc(it.title || it.nameAr || it.name || it.code || "بند")}
        ${it.code ? `<small>${esc(it.code)}</small>` : ""}</td>
      <td class="num">${esc(String(it.qty ?? 1))}</td>
      <td class="num">${esc(money(it.unitPrice ?? it.price ?? 0))}</td>
      <td class="num">${esc(money(it.total ?? (Number(it.qty ?? 1) * Number(it.unitPrice ?? it.price ?? 0))))}</td>
    </tr>`).join("");
  return `<table class="items">
    <thead><tr><th>#</th><th>البند</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

function totalsBlock(d) {
  const net = d.net ?? d.subtotal;
  if (net == null && d.total == null) return "";
  return `<dl class="totals">
    ${net != null ? `<div><dt>الإجمالي قبل الضريبة</dt><dd>${esc(money(net))} ﷼</dd></div>` : ""}
    ${d.vat != null ? `<div><dt>ضريبة القيمة المضافة (15%)</dt><dd>${esc(money(d.vat))} ﷼</dd></div>` : ""}
    ${d.total != null ? `<div class="grand"><dt>الإجمالي المستحق</dt><dd>${esc(money(d.total))} ﷼</dd></div>` : ""}
  </dl>`;
}

const DOC_LABEL = { QUOTE: "عرض سعر", CONTRACT: "عقد", INVOICE: "فاتورة" };

function docHtml(row, kind) {
  const d = (kind === "QUOTE" ? row.quote : kind === "CONTRACT" ? row.contract : row.invoice) || {};
  const label = DOC_LABEL[kind] || "مستند";
  const number = d.number || row.ref;

  // العقد يُخزَّن HTML جاهزاً؛ العرض والفاتورة يُبنيان من بنودهما.
  const body = kind === "CONTRACT" && d.html
    ? `<div class="contract">${d.html}</div>`
    : `${itemsTable(d.items)}${totalsBlock(d)}${d.notes ? `<p class="notes">${esc(d.notes)}</p>` : ""}`;

  const sig = (d.signature && d.signature.at)
    ? `<div class="sig">وُقّع إلكترونياً باسم ${esc(d.signature.name || "")} بتاريخ ${esc(String(d.signature.at).slice(0, 10))}</div>`
    : "";

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<meta name="referrer" content="no-referrer">
<title>Business Partner — ${esc(label)} ${esc(number)}</title>
<style>
  :root{color-scheme:light;--navy:#0b2545;--ink:#132033;--mut:#5b6b80;--line:#e3e9f0;--bg:#f6f8fb;--card:#fff}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.8 system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif}
  .wrap{max-width:860px;margin:0 auto;padding:0 16px 56px}
  header.top{background:var(--navy);color:#fff;padding:24px 0 28px;margin-bottom:22px}
  header.top .wrap{padding-bottom:0}
  .brand{font-size:13px;letter-spacing:.14em;opacity:.8}
  h1{margin:8px 0 4px;font-size:21px}
  .sub{opacity:.85;font-size:14px;margin:0}
  .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px;margin-bottom:16px}
  .meta{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin:0}
  .meta dt{font-size:12px;color:var(--mut)}.meta dd{margin:0;font-weight:600}
  table.items{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:14px}
  table.items th,table.items td{border-bottom:1px solid var(--line);padding:9px 8px;text-align:right}
  table.items th{background:#f2f5f9;color:var(--navy);font-size:13px}
  td.n{color:var(--mut);width:34px}.num{text-align:left;white-space:nowrap;font-variant-numeric:tabular-nums}
  td small{display:block;color:var(--mut);font-size:11px}
  .totals{margin:0}.totals div{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)}
  .totals dt{color:var(--mut)}.totals dd{margin:0;font-weight:600;font-variant-numeric:tabular-nums}
  .totals .grand{border-bottom:0;font-size:17px;color:var(--navy)}
  .totals .grand dt{color:var(--navy);font-weight:700}
  .contract{line-height:1.9}.contract h2{font-size:17px;color:var(--navy)}
  .notes{color:var(--mut);white-space:pre-wrap}
  .sig{margin-top:14px;padding:10px 14px;border:1px solid var(--line);border-radius:10px;background:#f2f7f2;font-size:14px}
  footer{margin-top:24px;padding-top:16px;border-top:1px solid var(--line);color:var(--mut);font-size:13px;text-align:center}
  footer a{color:var(--navy)}
  @media print{body{background:#fff}header.top{background:#fff;color:var(--navy)}.card{border:0;padding:0}}
</style>
</head>
<body>
<header class="top"><div class="wrap">
  <div class="brand">Business Partner</div>
  <h1>${esc(label)} — ${esc(number)}</h1>
  <p class="sub">${esc(row.title || "")}</p>
</div></header>
<div class="wrap">
  <div class="card"><dl class="meta">
    <div><dt>المرجع</dt><dd>${esc(row.ref)}</dd></div>
    ${row.client_name ? `<div><dt>العميل</dt><dd>${esc(row.client_name)}</dd></div>` : ""}
    ${row.company_name ? `<div><dt>المنشأة</dt><dd>${esc(row.company_name)}</dd></div>` : ""}
    ${d.issued_at || d.sent_at ? `<div><dt>التاريخ</dt><dd>${esc(String(d.issued_at || d.sent_at).slice(0, 10))}</dd></div>` : ""}
    ${d.valid_until ? `<div><dt>صالح حتى</dt><dd>${esc(String(d.valid_until).slice(0, 10))}</dd></div>` : ""}
  </dl></div>
  <div class="card">${body}${sig}</div>
  <footer>
    هذا المستند خاص ولا يظهر في محركات البحث.
    تابع طلبك في <a href="https://www.businesspartner.sa/ar/account">حسابك على businesspartner.sa</a>
  </footer>
</div>
</body>
</html>`;
}

function retiredHtml(token) {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Business Partner — المستند غير متاح</title>
<style>body{margin:0;background:#f6f8fb;color:#132033;font:15px/1.8 system-ui,Tahoma,sans-serif;
display:grid;place-items:center;min-height:100vh;padding:24px}
.b{background:#fff;border:1px solid #e3e9f0;border-radius:16px;padding:28px;max-width:520px;text-align:center}
h1{font-size:19px;color:#0b2545;margin:0 0 10px}p{color:#5b6b80;margin:0 0 14px}
a{display:inline-block;background:#0b2545;color:#fff;text-decoration:none;border-radius:10px;padding:10px 20px}
code{font-size:12px;color:#5b6b80}</style></head><body><div class="b">
<h1>هذا المستند لم يَعُد متاحاً على هذا الرابط</h1>
<p>انتقلت مستنداتك إلى حسابك على الموقع. افتح حسابك بالبريد نفسه لترى عروض الأسعار والعقود والفواتير كلها في مكان واحد.</p>
<a href="https://www.businesspartner.sa/ar/account">افتح حسابي</a>
<p style="margin-top:14px"><code>${esc(token)}</code></p>
</div></body></html>`;
}

export async function handleLegacyDoc(req, res, token) {
  const t = safeToken(token);
  const goPanel = () => {
    if (PANEL_RETIRED) {
      res.statusCode = 410;
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      return res.end(retiredHtml(t || ""));
    }
    // ما لم يُنقل بعدُ ما زال حيّاً في اللوحة — الرابط لا يموت أثناء النقل.
    res.statusCode = 302;
    res.setHeader("Location", `${PANEL_URL}/d/${encodeURIComponent(t || "")}`);
    res.setHeader("Cache-Control", "no-store");
    return res.end("");
  };

  if (!t) { res.statusCode = 400; return res.end("bad token"); }
  if (!DB_ON) return goPanel();

  let link = null, row = null;
  try {
    link = await refForToken(t);
    if (link) row = await requestByRef(link.ref);
  } catch {
    return goPanel();   // عطل قاعدة لا يُفقِد العميل مستنده
  }
  if (!link || !row) return goPanel();

  const kind = ["QUOTE", "CONTRACT", "INVOICE"].includes(link.kind) ? link.kind : "QUOTE";
  res.statusCode = 200;
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.setHeader("Referrer-Policy", "no-referrer");
  return res.end(docHtml(row, kind));
}

// ─────────────────── ٣) مستندات العميل من قاعدتنا ───────────────────
//
// كان قسم «عروضي وعقودي» في /account ينادي جسراً إلى اللوحة. وجدول
// `requests` يحمل `quote` و`contract` و`invoice` أصلاً، فالقراءة المحلية
// أسرع وأصدق ولا تموت بموت اللوحة.
//
// الهوية من الجلسة وحدها — البريد الذي تحقّق منه الموقع — لا من الطلب.
export async function clientDocuments(email) {
  const e = String(email || "").toLowerCase().trim();
  if (!e || !DB_ON) return { quotes: [], contracts: [], invoices: [] };

  const rows = await sb(
    `requests?client_email=eq.${q(e)}&select=ref,title,status,created_at,updated_at,quote,contract,invoice,payment&order=created_at.desc&limit=100`
  );

  const quotes = [], contracts = [], invoices = [];
  for (const r of rows || []) {
    const base = { ref: r.ref, title: r.title || "", status: r.status, at: r.created_at };
    if (r.quote) quotes.push({ ...base, number: r.quote.number || r.ref, total: r.quote.total ?? null, state: r.quote.status || "", validUntil: r.quote.valid_until || "", url: `/quotes/d/${encodeURIComponent(r.quote.token || "")}` });
    if (r.contract) contracts.push({ ...base, number: r.contract.number || r.ref, state: r.contract.status || "", signedAt: (r.contract.signature && r.contract.signature.at) || r.contract.signed_at || "" });
    if (r.invoice) invoices.push({ ...base, number: r.invoice.number || r.ref, total: r.invoice.total ?? null, issuedAt: r.invoice.issued_at || "", paid: !!(r.payment && r.payment.status === "PAID") });
  }
  return { quotes, contracts, invoices };
}
