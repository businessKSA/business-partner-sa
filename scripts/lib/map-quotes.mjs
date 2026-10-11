// Business Partner — منطق تحويل bp-quotes (Prisma) إلى طلبات Simple V1.
//
// دالة نقية بلا شبكة ولا قاعدة: تأخذ "حزمة عميل" (عميل + مستنداته وفواتيره
// وأحداثه كما تخرج من Prisma) وتعيد صفوف requests + request_events +
// quote_tokens المكافئة. فصلها هنا يجعل الخريطة قابلة للاختبار بلا أي DB
// (انظر tests/migrate-quotes.test.mjs) قبل أي كتابة حقيقية.
//
// الخريطة مطابقة لجدول docs/quotes-cutover.md.
import crypto from "node:crypto";

const VAT_RATE = 15;

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const round2 = (n) => Math.round((num(n) + Number.EPSILON) * 100) / 100;
const iso = (v) => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d.toISOString(); };
const dateOnly = (v) => { const s = iso(v); return s ? s.slice(0, 10) : null; };

// ref ثابت مشتقّ من رمز العرض/رقمه، فإعادة تشغيل السكربت تنتج نفس المرجع ولا
// تضاعف الصفوف (مع حارس التفرّد على quote_tokens.token).
export function refFromSeed(seed) {
  const h = crypto.createHash("sha256").update(String(seed || "")).digest("hex");
  return "BP-R-" + BigInt("0x" + h.slice(0, 12)).toString(36).toUpperCase().slice(0, 6).padStart(6, "0");
}

// حالة مستند bp-quotes تُحفظ حرفيًا (ضمن المجموعة المعروفة) لأن جسر القراءة في
// صفحة الحساب ولوحة المالك يعرضها بمفرداتها نفسها (SENT/ACCEPTED/SIGNED/…).
const DOC_STATES = new Set(["DRAFT", "APPROVED", "SENT", "ACCEPTED", "SIGNING", "SIGNED", "IN_PROGRESS", "REJECTED", "EXPIRED", "CANCELLED"]);
const docStatus = (s, fallback) => (DOC_STATES.has(String(s)) ? String(s) : fallback);
// TimelineEvent.actorKind → request_events.actor_kind
const ACTOR_KIND = { admin: "human", client: "customer", system: "system", docusign: "system", payment: "system" };

function mapItems(items) {
  return (Array.isArray(items) ? items : []).map((it) => {
    const qty = Math.max(1, num(it.qty) || 1);
    const price = round2(it.unitPrice);
    return {
      code: String(it.code || "CUSTOM").slice(0, 40),
      title: String(it.nameAr || it.nameEn || "").slice(0, 200),
      titleEn: String(it.nameEn || "").slice(0, 200),
      description: String(it.descAr || it.descEn || "").slice(0, 600),
      qty, price, line: round2(num(it.lineTotal) || qty * price),
    };
  }).filter((l) => l.title);
}

function mapQuote(doc) {
  const items = mapItems(doc.items);
  const net = round2(doc.subtotal != null ? doc.subtotal : items.reduce((s, l) => s + l.line, 0));
  const vat = round2(doc.vatAmount != null ? doc.vatAmount : net * (VAT_RATE / 100));
  return {
    number: String(doc.number || ""),           // الرقم الأصلي كما استلمه العميل
    status: docStatus(doc.status, "DRAFT"),      // حرفيًا بمفردات bp-quotes
    items, net, vat, total: round2(doc.total != null ? doc.total : net + vat),
    vat_rate: VAT_RATE, currency: String(doc.currency || "SAR"),
    valid_until: dateOnly(doc.validUntil) || "",
    payment_terms: "", notes: String(doc.notesAr || "").slice(0, 1500),
    created_at: iso(doc.issuedAt) || iso(doc.createdAt) || null,
    sent_at: iso(doc.sentAt), decided_at: iso(doc.acceptedAt) || iso(doc.rejectedAt),
    legacy: true,
  };
}

function mapContract(doc, quoteNumber, signatures) {
  if (!doc) return null;
  const sig = (signatures || []).find((s) => s.role === "client") || null;
  return {
    number: String(doc.number || ""),
    status: docStatus(doc.status, "SENT"),       // حرفيًا: SENT / SIGNING / SIGNED …
    html: String(doc.bodyAr || doc.bodyEn || "") || null,   // النص القانوني وقت التوليد
    created_at: iso(doc.issuedAt) || iso(doc.createdAt) || null,
    sent_at: iso(doc.sentAt), signed_at: iso(doc.signedAt),
    quote_number: quoteNumber || null,
    signature: doc.signedAt ? {
      name: sig ? sig.name : (doc.acceptedByName || ""),
      email: sig ? sig.email : "",
      at: iso(doc.signedAt),
      ip: (sig && sig.ipAddress) || doc.acceptedByIp || null,
      mode: "legacy-import",
    } : null,
    mode: "legacy-import", legacy: true,
  };
}

function mapInvoice(inv) {
  if (!inv) return null;
  const net = round2(inv.amountExclVat);
  const vat = round2(inv.vatAmount != null ? inv.vatAmount : net * (VAT_RATE / 100));
  return {
    number: String(inv.number || ""),
    mode: "legacy-import",
    net, vat, total: round2(inv.total != null ? inv.total : net + vat),
    issued_at: iso(inv.createdAt) || null, items: [], bill_to: null, legacy: true,
  };
}

function mapPayment(inv) {
  if (!inv || String(inv.status) !== "PAID") return null;
  return {
    status: "PAID", provider: inv.provider || null, ref: inv.providerRef || null,
    amount: round2(inv.total), currency: "SAR", at: iso(inv.paidAt), method: inv.method || null,
    test: false, legacy: true,
  };
}

// الحالة الكلية للطلب = أبعد مرحلة بلغها (من حالات bp-quotes الحرفية).
function overallStatus({ quote, contract, payment }) {
  if (payment && payment.status === "PAID") return "PAID";
  if (contract && contract.status === "SIGNED") return "SIGNED";
  if (contract) return "CONTRACT_SENT";
  if (quote && ["ACCEPTED", "APPROVED"].includes(quote.status)) return "QUOTE_APPROVED";
  if (quote && quote.status === "SENT") return "QUOTE_SENT";
  return "REVIEWING";
}

// حزمة عميل → { request, events[], tokens[] } لكل عرض سعر.
// bundle = { client, documents[], invoices[], signaturesByDoc{}, events[] }
export function mapBundle(bundle) {
  const client = bundle.client || {};
  const docs = Array.isArray(bundle.documents) ? bundle.documents : [];
  const invoices = Array.isArray(bundle.invoices) ? bundle.invoices : [];
  const quotes = docs.filter((d) => String(d.type) === "QUOTE");
  const contractsBySource = new Map();
  for (const d of docs) if (String(d.type) === "CONTRACT" && d.sourceQuoteId) contractsBySource.set(String(d.sourceQuoteId), d);

  const out = [];
  for (const qdoc of quotes) {
    const cdoc = contractsBySource.get(String(qdoc.id)) || null;
    const docIds = new Set([String(qdoc.id), cdoc ? String(cdoc.id) : null].filter(Boolean));
    const inv = invoices.find((i) => docIds.has(String(i.documentId))) || null;

    const seed = qdoc.publicToken || qdoc.number || qdoc.id;
    const ref = refFromSeed(seed);

    const quote = mapQuote(qdoc);
    const contract = mapContract(cdoc, quote.number, bundle.signaturesByDoc && bundle.signaturesByDoc[String(cdoc && cdoc.id)]);
    const invoice = mapInvoice(inv);
    const payment = mapPayment(inv);

    const request = {
      ref,
      type: "GOVERNMENT_SERVICE",
      source: "MANUAL",
      status: overallStatus({ quote, contract, payment }),
      lang: "ar",
      title: String(qdoc.titleAr || qdoc.titleEn || quote.number || "عرض سعر").slice(0, 200),
      summary: String(qdoc.introAr || "").slice(0, 2000) || null,
      scope: quote.items.map((l) => ({ code: l.code, title: l.title, why: l.description, qty: l.qty })),
      quote, contract, payment, invoice,
      client_name: String(client.nameAr || client.nameEn || "").slice(0, 200) || null,
      client_email: String(client.email || "").toLowerCase().slice(0, 200) || null,
      client_phone: String(client.phone || "").slice(0, 40) || null,
      company_name: String(client.companyAr || client.companyEn || "").slice(0, 200) || null,
      internal_notes: "legacy:bp-quotes " + (qdoc.number || ""),
      created_at: iso(qdoc.issuedAt) || iso(qdoc.createdAt) || null,
    };

    const events = (Array.isArray(bundle.events) ? bundle.events : [])
      .filter((e) => String(e.entityId) === String(qdoc.id) || (cdoc && String(e.entityId) === String(cdoc.id)))
      .map((e) => ({
        actor_kind: ACTOR_KIND[String(e.actorKind || "system")] || "system",
        actor: String(e.actor || "legacy").slice(0, 120),
        event: "legacy." + String(e.code || "event").toLowerCase(),
        details: { title: e.titleAr || e.titleEn || null },
        created_at: iso(e.createdAt) || null,
      }));

    const tokens = [];
    if (qdoc.publicToken) tokens.push({ token: String(qdoc.publicToken), ref, kind: "quote", legacy_number: quote.number });
    if (cdoc && cdoc.publicToken) tokens.push({ token: String(cdoc.publicToken), ref, kind: "contract", legacy_number: contract ? contract.number : "" });
    if (inv && inv.payToken) tokens.push({ token: String(inv.payToken), ref, kind: "invoice", legacy_number: invoice ? invoice.number : "" });

    out.push({ request, events, tokens });
  }
  return out;
}
