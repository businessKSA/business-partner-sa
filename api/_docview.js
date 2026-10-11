// Business Partner — عارض عام لروابط bp-quotes القديمة (بلا تسجيل دخول).
//
// روابط العروض والعقود المُرسَلة للعملاء كانت /quotes/d/<token> يخدمها تطبيق
// bp-quotes من Document.publicToken. حين يُحذف المشروع الثاني يجب أن تبقى هذه
// الروابط حيّة من الموقع الرئيسي: يحوّل vercel.json المسار /quotes/d/:token إلى
// /api/requests?__route=docview&token=:token، فيُخدَم من هنا بلا دالة جديدة
// (السقف 12/12). الجسر هو جدول quote_tokens الذي يملؤه سكربت الهجرة.
//
// للقراءة فقط وعام بالتصميم: الرمز غير قابل للتخمين والمحتوى مستند العميل نفسه
// الذي استلمه سابقاً — لا ملاحظات داخلية، لا إسناد، لا تسجيل دخول.
import { sb, DB_ON } from "./_db.js";
import { quoteHtml } from "./_docusign.js";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const sendHtml = (res, code, body) => { res.statusCode = code; res.setHeader("content-type", "text/html; charset=utf-8"); res.end(body); };

function page(title, inner) {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width, initial-scale=1">`
    + `<title>${esc(title)}</title>`
    + `<style>body{margin:0;background:#f4f6fb;font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#0B1B5A}`
    + `.wrap{max-width:900px;margin:0 auto;padding:24px 16px}`
    + `.card{background:#fff;border:1px solid #e3e8f3;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(11,27,90,.06)}`
    + `.miss{max-width:520px;margin:64px auto;text-align:center;padding:0 16px}`
    + `.miss a{color:#0B1B5A}`
    + `@media print{body{background:#fff}.wrap{padding:0}.card{border:0;box-shadow:none}}`
    + `</style></head><body><div class="wrap">${inner}</div></body></html>`;
}

const notFound = (res) => sendHtml(res, 404, page("الرابط غير متاح",
  `<div class="miss"><h2>الرابط غير متاح</h2>`
  + `<p>انتهت صلاحية هذا الرابط أو لم يعد متوفّراً. تواصل معنا وسنعيد إرساله.</p>`
  + `<p><a href="https://www.businesspartner.sa">businesspartner.sa</a></p></div>`));

const dateAr = (iso) => new Date(iso || Date.now()).toLocaleDateString(
  "ar-SA-u-nu-latin", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Riyadh" });

export async function handleDocView(req, res) {
  if (!DB_ON) return notFound(res);
  const q = req.query || {};
  const token = String(q.token || q.t || "").trim().slice(0, 120);
  if (!token) return notFound(res);

  let map;
  try {
    const rows = await sb(`quote_tokens?token=eq.${encodeURIComponent(token)}&select=token,ref,kind,legacy_number&limit=1`);
    map = rows && rows[0];
  } catch { return notFound(res); }
  if (!map) return notFound(res);

  let row;
  try {
    const rows = await sb(`requests?ref=eq.${encodeURIComponent(map.ref)}&select=*&limit=1`);
    row = rows && rows[0];
  } catch { return notFound(res); }
  if (!row) return notFound(res);

  // العقد: يُعرض النص القانوني المحفوظ لحظة التوليد كما استلمه العميل.
  if (map.kind === "contract") {
    if (!row.contract || !row.contract.html) return notFound(res);
    const title = `عقد ${row.contract.number || map.legacy_number || ""}`.trim();
    return sendHtml(res, 200, page(title, `<div class="card">${row.contract.html}</div>`));
  }

  // الفاتورة: لا قالب HTML مخزّن لها في Simple V1، فنعرض ملخّصاً بسيطاً بدل 404.
  if (map.kind === "invoice") {
    if (!row.invoice) return notFound(res);
    const inv = row.invoice;
    const title = `فاتورة ${inv.number || map.legacy_number || ""}`.trim();
    const inner = `<div class="card" style="padding:28px">`
      + `<h2 style="margin:0 0 4px">فاتورة ${esc(inv.number || map.legacy_number || "")}</h2>`
      + `<p style="color:#5b668c;margin:0 0 20px">${esc(row.company_name || row.client_name || "")}</p>`
      + `<table style="width:100%;border-collapse:collapse">`
      + `<tr><td style="padding:8px 0">الصافي</td><td style="text-align:left">${esc(inv.net ?? "")} ر.س</td></tr>`
      + `<tr><td style="padding:8px 0">ضريبة القيمة المضافة</td><td style="text-align:left">${esc(inv.vat ?? "")} ر.س</td></tr>`
      + `<tr style="font-weight:700;border-top:1px solid #e3e8f3"><td style="padding:10px 0">الإجمالي</td><td style="text-align:left">${esc(inv.total ?? "")} ر.س</td></tr>`
      + `</table></div>`;
    return sendHtml(res, 200, page(title, inner));
  }

  // الافتراضي: عرض السعر — يُعاد بناء HTML من بيانات الطلب الحالية.
  if (!row.quote) return notFound(res);
  const inner = quoteHtml({
    ref: row.ref, number: row.quote.number,
    clientName: row.company_name || row.client_name || row.client_email,
    items: row.quote.items || [], net: row.quote.net, vat: row.quote.vat, total: row.quote.total,
    validUntil: row.quote.valid_until || "", paymentTerms: row.quote.payment_terms || "",
    notes: row.quote.notes || "", lang: row.lang || "ar",
    today: dateAr(row.quote.created_at),
  });
  const title = `عرض سعر ${row.quote.number || map.legacy_number || ""}`.trim();
  return sendHtml(res, 200, page(title, `<div class="card">${inner}</div>`));
}
