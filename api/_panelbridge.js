// Business Partner — قراءة محلية تحلّ محلّ جسر bp-quotes (المرحلة 3 من الدمج).
//
// كانت صفحة الحساب ولوحة المالك تقرآن عروض الأسعار والعقود من تطبيق bp-quotes
// عبر /api/bridge/* بسرٍّ مشترك. بعد هجرة التاريخ إلى جدول requests (المرحلة 1)
// صار المصدر محليًا: هذه الوحدة تبني شكلَي الردّ نفسيهما من requests +
// quote_tokens، فتُقرأ الواجهة بلا تغيير ويسقط النداء الخارجي.
//
// النطاق = الصفوف المهاجَرة فقط (التي لها رمز في quote_tokens)، كي لا تتكرّر
// طلبات Simple V1 الأصلية التي تعرضها الصفحة في أقسامها الأخرى. وإن لم تُوجد
// صفوف مهاجَرة بعدُ تُعاد null، فيرجع المنادي إلى الجسر القديم أثناء الانتقال.
import { sb } from "./_db.js";

const SELF_BASE = (process.env.MKT_SITE_BASE || "https://www.businesspartner.sa").replace(/\/+$/, "");
const q = (s) => encodeURIComponent(String(s));
const money = (n) => Math.round((Number(n) || 0) * 100) / 100;
// الرمز نفسه الذي أُرسل للعميل: /quotes/d/<token> يعمل على bp-quotes الآن وعلى
// الموقع الرئيسي بعد تحويل vercel.json في المرحلة 4 — بلا تغيّر في الرابط.
const docUrl = (token) => `/quotes/d/${token}`;

function tokensByRefKind(rows) {
  const m = {};
  for (const r of rows || []) m[`${r.ref}:${r.kind}`] = r.token;
  return m;
}

// صفحة الحساب: عروض/عقود/فواتير العميل بالبريد وحده (تحقّق منه الموقع برمز).
export async function localClientDocs(email) {
  const e = String(email || "").toLowerCase().trim();
  if (!e) return null;
  const reqs = await sb(`requests?client_email=eq.${q(e)}&select=ref,title,quote,contract,invoice,payment,status,client_name,company_name&order=created_at.desc&limit=50`);
  if (!reqs || !reqs.length) return null;

  const refs = reqs.map((r) => r.ref);
  const toks = await sb(`quote_tokens?ref=in.(${refs.map(q).join(",")})&select=ref,token,kind&limit=200`);
  if (!toks || !toks.length) return null;      // لا صفوف مهاجَرة → ليرجع المنادي للجسر
  const tk = tokensByRefKind(toks);

  const quotes = [], contracts = [], invoices = [];
  for (const r of reqs) {
    const qTok = tk[`${r.ref}:quote`], cTok = tk[`${r.ref}:contract`], iTok = tk[`${r.ref}:invoice`];
    if (r.quote && qTok && r.quote.status !== "DRAFT") {
      quotes.push({
        number: r.quote.number, status: r.quote.status,
        titleAr: r.title, titleEn: r.title,
        total: money(r.quote.total), currency: r.quote.currency || "SAR",
        vatExcluded: true, govFeesExcluded: true,
        issuedAt: r.quote.created_at || null, validUntil: r.quote.valid_until || null,
        decidedAt: r.quote.decided_at || null, url: docUrl(qTok),
      });
    }
    if (r.contract && cTok) {
      contracts.push({
        number: r.contract.number, status: r.contract.status,
        titleAr: r.title, titleEn: r.title,
        total: money(r.quote && r.quote.total), currency: (r.quote && r.quote.currency) || "SAR",
        vatExcluded: true, govFeesExcluded: true,
        issuedAt: r.contract.created_at || null, validUntil: null,
        decidedAt: r.contract.signed_at || null, url: docUrl(cTok),
      });
    }
    if (r.invoice && iTok) {
      const paid = !!(r.payment && r.payment.status === "PAID");
      invoices.push({
        number: r.invoice.number, status: paid ? "PAID" : "DUE",
        titleAr: r.title, titleEn: r.title,
        total: money(r.invoice.total), currency: "SAR",
        dueDate: null, paidAt: (r.payment && r.payment.at) || null,
        url: paid ? null : docUrl(iTok),
      });
    }
  }
  const first = reqs[0];
  return {
    found: true,
    client: { nameAr: first.company_name || first.client_name || e, email: e },
    quotes, contracts, invoices,
  };
}

// لوحة المالك: نظرة عامة على المستندات والفواتير المهاجَرة.
export async function localOwnerOverview() {
  const reqs = await sb(`requests?select=ref,title,quote,contract,invoice,payment,status,client_name,company_name,client_email&order=created_at.desc&limit=80`);
  if (!reqs || !reqs.length) return null;
  const refs = reqs.map((r) => r.ref);
  const toks = await sb(`quote_tokens?ref=in.(${refs.map(q).join(",")})&select=ref,token,kind&limit=300`);
  if (!toks || !toks.length) return null;
  const tk = tokensByRefKind(toks);

  const documents = [], invoices = [];
  const emails = new Set();
  let unpaid = 0;
  for (const r of reqs) {
    const who = r.company_name || r.client_name || "—";
    if (r.client_email) emails.add(String(r.client_email).toLowerCase());
    const qTok = tk[`${r.ref}:quote`], cTok = tk[`${r.ref}:contract`], iTok = tk[`${r.ref}:invoice`];
    if (r.quote && qTok) {
      documents.push({
        id: r.ref, type: "QUOTE", number: r.quote.number, status: r.quote.status,
        titleAr: r.title, total: money(r.quote.total), client: who, email: r.client_email || "",
        issuedAt: r.quote.created_at || null, adminUrl: `${SELF_BASE}/ops?ref=${q(r.ref)}`, publicUrl: docUrl(qTok),
      });
    }
    if (r.contract && cTok) {
      documents.push({
        id: r.ref, type: "CONTRACT", number: r.contract.number, status: r.contract.status,
        titleAr: r.title, total: money(r.quote && r.quote.total), client: who, email: r.client_email || "",
        issuedAt: r.contract.created_at || null, adminUrl: `${SELF_BASE}/ops?ref=${q(r.ref)}`, publicUrl: docUrl(cTok),
      });
    }
    if (r.invoice && iTok) {
      const paid = !!(r.payment && r.payment.status === "PAID");
      if (!paid) unpaid += Number(r.invoice.total) || 0;
      invoices.push({
        id: r.ref, number: r.invoice.number, status: paid ? "PAID" : "DUE",
        titleAr: r.title, total: money(r.invoice.total), client: who,
        dueDate: null, paidAt: (r.payment && r.payment.at) || null, adminUrl: `${SELF_BASE}/ops?ref=${q(r.ref)}`,
      });
    }
  }
  return {
    panelUrl: SELF_BASE,
    "عدّادات": {
      "العملاء": emails.size, "المستندات": documents.length,
      "الفواتير": invoices.length, "غيرالمسددة": money(unpaid),
    },
    documents, invoices, supply: [],   // طلبات التوريد تبقى في جداولها، خارج هذه الهجرة
  };
}
