// Business Partner — «دفعة مؤكدة ← فاتورة ضريبية في الدفترة ← تصل بريد العميل».
//
// ملف مشترك (يبدأ بشرطة سفلية فلا يستهلك دالة من الاثنتي عشرة). يملكه وكيل
// `daftra`؛ يستدعيه مساران لا ثالث لهما:
//   • api/pay.js      — سلة المتجر: بطاقة / مدى / Apple Pay / Samsung Pay / تمارا،
//                       من رجوع المتصفح ومن خطّاف مُيسّر ومن المطابقة.
//   • api/_simple.js  — دفع عرضٍ قائم (sv1:) ومحرّك الطلبات.
//
// لماذا وُجد: قبله كان كل مسار يكرّر «أنشئ ← سجّل السداد ← أرسل» بيده، ولم يكن
// لأيٍّ منها ذاكرة:
//   1. الفاتورة لا تُربط بصف الطلب، فلا تظهر في «الفواتير» داخل /my.
//   2. «أُرسلت للعميل» كانت تُقرأ من وجود PDF لا من نجاح الإرسال؛ والـPDF لا
//      يردّه حساب الدفترة بمفتاح API، فكان العميل لا يستلم شيئاً والمالك يُطلب
//      منه إرفاقه يدوياً. والمرسل الافتراضي onboarding@resend.dev لا يوصل إلا
//      لصاحب حساب Resend — أي المالك وحده.
//   3. فشل الدفترة يُقال مرة في ردّ HTTP ثم يضيع، ولا شيء يعيد المحاولة.
//   4. الخطّاف ورجوع المتصفح يصلان معاً؛ كل منهما يظن أنه الأول.
//
// الحل: سجلّ الفاتورة يعيش في `requests.invoice` (عمود موجود، بلا هجرة)، ويُنقل
// به كل شيء: من يملك الإصدار، ما تمّ، ما بقي، متى المحاولة التالية.
//   • الحجز ذرّي: `PATCH … &invoice=is.null` — الرابح واحد دائماً (جدول requests
//     نفسه هو الحَكَم، لا ذاكرة العملية). الخاسر يعود بـ«سبقك غيرك».
//   • الاستئناف بعد فشل أو موت العملية يُحجز بمقارنة `updated_at` (CAS).
//   • الإرسال للعميل يحدث مرة: من يملك الحجز يرسل، ويُكتب `delivery.sent_at`.
//   • الفشل يُسجَّل في السجلّ ويفتح مهمة بشرية ويُنبَّه المالك مرة، وتُعاد
//     المحاولة بتأخير متصاعد (إعادة الدفع لا تضيع: المال وصل، والفاتورة حق).
//
// الأمان: لا يُنشأ شيء في الدفترة الحقيقية إلا والدفع حقيقي (PAYMENTS_MODE=live،
// وهو افتراضي الإنتاج ويصير test محلياً وفي المعاينات). للتجربة بمفتاح اختبار:
// DAFTRA_ALLOW_NONLIVE=1. والبريد يمرّ بـEMAIL_MODE: خارج الإنتاج يذهب إلى
// الصندوق الملفّي ولا يصل أحداً.
import crypto from "node:crypto";
import { LEGAL_NAME } from "./_identity.js";
import { sb } from "./_db.js";
import { EMAIL_LIVE, MODES, PAYMENTS_LIVE, outbox } from "./_mode.js";
import { azureSendEmail } from "./_azure_notify.js";
import {
  daftraConfigured, daftraFindOrCreateClient, daftraCreateInvoice, daftraRecordPayment,
  daftraDocPdf, daftraPublicInvoiceLink, daftraFindInvoiceByRef, daftraVatRate,
} from "./_daftra.js";

// الإصدار الفعلي في الدفترة مسموح حين يكون المال حقيقياً (PAYMENTS_MODE=live —
// افتراضي الإنتاج) أو حين يُسمح صراحةً للتجربة بمفتاح اختبار.
export const invoicingEnabled = () => PAYMENTS_LIVE || process.env.DAFTRA_ALLOW_NONLIVE === "1";

export const MAX_ATTEMPTS = 5;
// بعد المحاولة n تنتظر BACKOFF_MIN[n-1] دقيقة.
const BACKOFF_MIN = [2, 10, 30, 120, 360];
// حجزٌ لم يُكمل خلال هذه المدة صاحبه ميّت (مهلة الدالة أقصر منها بكثير).
const STUCK_MS = 4 * 60 * 1000;
export const tuning = { transientPauseMs: 700, pdfBudgetMs: 4000 };

const nowIso = () => new Date().toISOString();
const isEmail = (e) => typeof e === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const esc = (v) => String(v == null ? "" : v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const round2 = (n) => Math.round(Number(n) * 100) / 100;
const selfBase = () => (process.env.MKT_SITE_BASE || "https://www.businesspartner.sa").replace(/\/+$/, "");
const ownerEmails = () => String(process.env.BP_OWNER_EMAIL || "business@businesspartner.sa");

// ------------------------------------------------------------------ mail --
// بوابة واحدة لكل بريد فاتورة. تردّ بالحقيقة: `ok` لا تعني «لم يرمِ استثناءً»
// بل «قبله المزوّد». و`skipped` تعني «وضع لا يُرسل»، وهذه ليست عطلاً.
export async function sendInvoiceMail(to, subject, html, attachments) {
  const list = String(to || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (list.length > 1) {
    const out = await Promise.all(list.map((one) => sendInvoiceMail(one, subject, html, attachments)));
    return out.find((r) => r.ok) || out[0];
  }
  to = list[0] || "";
  if (!isEmail(to)) return { ok: false, error: "bad_email" };
  if (!EMAIL_LIVE) {
    await outbox({ kind: "email", to, subject, body: html, attachments: attachments && attachments.length ? attachments.map((a) => a && a.filename) : undefined });
    return { ok: false, skipped: "email_mode_" + MODES().email };
  }
  // Azure أولاً (قرار المالك) لكنه لا يحمل مرفقات هنا.
  if (!attachments || !attachments.length) {
    try { if (await azureSendEmail(to, subject, html)) return { ok: true, via: "azure" }; } catch { /* Resend */ }
  }
  const key = String(process.env.RESEND_API_KEY || process.env.RESEND_KEY || process.env.RESEND || "").trim();
  if (!key) return { ok: false, error: "email_not_configured" };
  const from = process.env.OTP_FROM_EMAIL || "Business Partner <onboarding@resend.dev>";
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html, ...(attachments && attachments.length ? { attachments } : {}) }),
    });
    if (r.ok) return { ok: true, via: "resend" };
    const text = (await r.text().catch(() => "")).slice(0, 200);
    console.error("invoice mail: resend refused", r.status, text);
    // المرسل التجريبي يقبل صاحب الحساب وحده: يرفض كل عميل بـ403.
    return { ok: false, error: r.status === 403 && /resend\.dev/i.test(from) ? "resend_sandbox_sender" : `http_${r.status}` };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || "mail_failed").slice(0, 60) };
  }
}

// ------------------------------------------------------------ the record --
// اكتمال السجلّ: صدرت وسُلّمت (أو وُضعت في صندوق المعاينة)، أو فاتورة اختبار،
// أو فاتورة قديمة صدرت من الدفترة قبل أن يُضاف إليها `status`.
export function invoiceIsComplete(inv) {
  if (!inv || typeof inv !== "object") return false;
  if (inv.mode === "test") return true;
  if (inv.status === "issued") return true;
  return !!(inv.daftra_id && !inv.status);
}
export function invoiceRetryDue(inv, now = Date.now(), force = false) {
  if (!inv || invoiceIsComplete(inv)) return false;
  if (!force && inv.status === "blocked") return false;
  if (inv.status === "issuing") return now - (Date.parse(inv.claimed_at || "") || 0) >= STUCK_MS;
  if (force) return true;
  if ((inv.attempts || 0) >= MAX_ATTEMPTS) return false;
  return !inv.next_retry_at || Date.parse(inv.next_retry_at) <= now;
}
// ما يراه العميل من السجلّ: لا مسودة ولا أسباب فشل ولا معرّفات حجز، وسجلٌّ بلا
// رقم (قيد الإصدار / فشل) لا يظهر له أصلاً — «الفاتورة undefined» أسوأ من الغياب.
export function publicInvoice(inv) {
  if (!inv || typeof inv !== "object" || !inv.number) return null;
  const { draft, claim_id, claimed_at, attempts, last_error, last_detail, next_retry_at, alerts, status, delivery, payment_error, payment_ambiguous, ...pub } = inv;
  if (delivery && (delivery.sent_at || delivery.skipped)) pub.delivery = { to: delivery.to, mode: delivery.mode, sent_at: delivery.sent_at || null };
  return pub;
}

const sumDraft = (items) => {
  const rate = Number(daftraVatRate()) || 15;
  const net = round2((items || []).reduce((s, it) => s + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 1), 0));
  const vat = round2(net * rate / 100);
  return { net, vat, total: round2(net + vat), rate };
};

function claimRecord(draft, why = "") {
  const t = sumDraft(draft.items);
  return {
    number: "", mode: "pending-daftra", status: "issuing",
    net: t.net, vat: t.vat, total: t.total, currency: "SAR", vat_rate: t.rate,
    issued_at: nowIso(), claim_id: crypto.randomBytes(6).toString("hex"), claimed_at: nowIso(), attempts: 1,
    items: (draft.items || []).map((i) => ({ title: i.name, qty: i.quantity, price: i.unitPrice })),
    bill_to: { name: draft.buyer && draft.buyer.name, company: draft.buyer && draft.buyer.isCompany ? draft.buyer.name : "", email: draft.buyer && draft.buyer.email },
    draft, ...(why ? { last_error: why } : {}),
  };
}

// الحجز. يردّ { mode } أحد: won · done · busy · wait · exhausted · none.
async function begin(rowId, claim, { force }) {
  const rows = await sb(`requests?id=eq.${rowId}&select=id,ref,invoice,updated_at&limit=1`);
  const row = rows && rows[0];
  if (!row) return { mode: "none" };
  const inv = row.invoice;
  if (!inv) {
    const won = await sb(`requests?id=eq.${rowId}&invoice=is.null`, { method: "PATCH", body: { invoice: claim, updated_at: nowIso() } });
    return won && won.length ? { mode: "won", rec: claim } : { mode: "busy" };
  }
  if (invoiceIsComplete(inv)) return { mode: "done", rec: inv };
  if (inv.status === "issuing" && Date.now() - (Date.parse(inv.claimed_at || "") || 0) < STUCK_MS) return { mode: "busy", rec: inv };
  if (!force) {
    if (inv.status === "blocked") return { mode: "wait", rec: inv };
    if (inv.next_retry_at && Date.parse(inv.next_retry_at) > Date.now()) return { mode: "wait", rec: inv };
    if ((inv.attempts || 0) >= MAX_ATTEMPTS) return { mode: "exhausted", rec: inv };
  }
  // استئناف: سجلّ بلا status هو القديم (رقمٌ داخلي INV- بلا فاتورة) — يبدأ من جديد.
  const base = inv.status ? inv : {};
  const next = {
    ...claim, ...base, status: "issuing", claim_id: claim.claim_id, claimed_at: claim.claimed_at,
    attempts: (inv.attempts || 0) + 1, next_retry_at: null, draft: inv.draft || claim.draft,
  };
  if (!inv.daftra_id) { next.number = ""; next.mode = "pending-daftra"; }
  const cond = row.updated_at ? `updated_at=eq.${encodeURIComponent(row.updated_at)}` : "updated_at=is.null";
  const won = await sb(`requests?id=eq.${rowId}&${cond}`, { method: "PATCH", body: { invoice: next, updated_at: nowIso() } });
  return won && won.length ? { mode: "won", rec: next, resumed: true } : { mode: "busy" };
}

async function persist(target, rec) {
  if (!target || !target.rowId) return;
  try { await sb(`requests?id=eq.${target.rowId}`, { method: "PATCH", prefer: "return=minimal", body: { invoice: rec, updated_at: nowIso() } }); }
  catch (e) { console.error("invoicing: could not save the invoice record", String((e && e.message) || e).slice(0, 120)); }
}

// ----------------------------------------------------------------- alerts --
const alertedHere = (globalThis.__bpInvoiceAlerted ||= new Set());
async function alertOwner(rec, key, stage, title, bodyHtml, target, why) {
  const mark = `${key}|${stage}`;
  rec.alerts = Array.isArray(rec.alerts) ? rec.alerts : [];
  if (rec.alerts.includes(stage) || alertedHere.has(mark)) return false;
  rec.alerts.push(stage); alertedHere.add(mark);
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;text-align:right;max-width:560px">
    <h2 style="color:#b91c1c">${esc(title)}</h2>${bodyHtml}
    <p style="color:#64748b;font-size:12px">المال وصل والدفع محفوظ — لا يُطلب من العميل شيء. الفاتورة حقٌّ له، ولهذا تُعاد المحاولة تلقائياً وتظهر مهمة بشرية في لوحة العمليات.</p></div>`;
  try { await sendInvoiceMail(ownerEmails(), `⚠️ ${title}`, html); } catch { /* the task below still stands */ }
  if (target && target.hooks && target.hooks.failed) { try { await target.hooks.failed(rec, why || stage); } catch { /* best effort */ } }
  return true;
}
const kv = (k, v) => `<tr><td style="padding:4px 10px;color:#666">${esc(k)}</td><td style="padding:4px 10px"><b>${esc(v == null || v === "" ? "—" : v)}</b></td></tr>`;
const failReason = (e) => {
  const code = String((e && e.message) || e || "invoice_failed").slice(0, 80);
  return { code, detail: String((e && e.detail) || "").slice(0, 300) };
};
const isTransient = (e) => !!e && (e.message === "daftra_unreachable" || Number(e.status) >= 500);

// ------------------------------------------------------------------- email --
function invoiceMail(rec, { pdf, link, myUrl, ref }) {
  const d = rec.draft || {};
  const rate = rec.vat_rate || Number(daftraVatRate()) || 15;
  const to = d.buyer && d.buyer.email;
  const refLine = ref ? ` · مرجع الطلب: <b style="direction:ltr;display:inline-block">${esc(ref)}</b>` : "";
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px;margin:auto;text-align:right">
    <h2 style="color:#0B1B5A">فاتورتك الضريبية من ${esc(LEGAL_NAME)}</h2>
    <p>شكراً لك — تم استلام دفعتك بنجاح.</p>
    <p>رقم الفاتورة: <b>${esc(rec.number)}</b>${refLine}</p>
    <p style="line-height:2">الإجمالي قبل الضريبة: <b>${rec.net} ﷼</b><br>ضريبة القيمة المضافة (${rate}%): <b>${rec.vat} ﷼</b><br>الإجمالي المدفوع: <b style="color:#0B1B5A;font-size:18px">${rec.total} ﷼</b></p>
    ${pdf ? '<p style="color:#0B1B5A">الفاتورة الضريبية بصيغة PDF مرفقة مع هذه الرسالة.</p>' : ""}
    ${link ? `<p style="margin:18px 0"><a href="${esc(link)}" style="background:#0B1B5A;color:#fff;padding:12px 26px;border-radius:10px;text-decoration:none;font-weight:bold;display:inline-block">افتح فاتورتك الضريبية</a></p>` : ""}
    ${myUrl ? `<p>تجد الفاتورة أيضاً في «الفواتير» داخل حسابك: <a href="${esc(myUrl)}" style="color:#0B1B5A">${esc(myUrl)}</a></p>` : ""}
    <p style="color:#94a3b8;font-size:12px">فاتورة ضريبية صادرة عبر نظام الدفترة ومتوافقة مع متطلبات هيئة الزكاة والضريبة والجمارك.</p></div>`;
  return { to, subject: `فاتورة ${rec.number} — Business Partner`, html,
    attachments: pdf ? [{ filename: `TAX_Invoice-${String(rec.number).replace(/[^\w-]/g, "")}.pdf`, content: pdf.base64 }] : undefined };
}

async function deliver(rec, { target, key, t0 }) {
  const d = rec.draft || {};
  const attempts = ((rec.delivery && rec.delivery.attempts) || 0) + 1;
  let pdf = null;
  try { pdf = await daftraDocPdf("invoice", rec.daftra_id, { budgetMs: tuning.pdfBudgetMs, cache: true }); } catch { pdf = null; }
  // صفحة الدفترة العامة للفاتورة تُحفظ على الطلب (يفتحها العميل من /my) وتُرسل
  // عند غياب الـPDF؛ لا تُرسل أبداً إن كانت تقود إلى صفحة دخول.
  let link = rec.pdf_url || "";
  if (!link && Date.now() - t0 < 7000) {
    try { const pub = await daftraPublicInvoiceLink(rec.daftra_id, rec.public_url || ""); link = (pub && pub.url) || ""; } catch { link = ""; }
  }
  if (link) rec.pdf_url = link;
  const mode = pdf ? "pdf" : link ? "link" : "summary";
  const mail = invoiceMail(rec, { pdf, link: pdf ? "" : link, myUrl: target && target.myUrl, ref: d.ref });
  const r = await sendInvoiceMail(mail.to, mail.subject, mail.html, mail.attachments);
  if (r.ok) {
    rec.delivery = { to: mail.to, mode, via: r.via, sent_at: nowIso(), attempts };
    rec.status = "issued"; rec.next_retry_at = null; rec.last_error = null;
  } else if (r.skipped) {
    // وضعٌ لا يرسل (محلي/معاينة): ليس عطلاً ولا يُعاد.
    rec.delivery = { to: mail.to, mode, skipped: r.skipped, attempts };
    rec.status = "issued"; rec.next_retry_at = null;
  } else {
    rec.delivery = { to: mail.to, mode, last_error: r.error || "mail_failed", attempts };
    rec.status = "created"; rec.last_error = "email:" + (r.error || "mail_failed");
    rec.next_retry_at = new Date(Date.now() + BACKOFF_MIN[Math.min((rec.attempts || 1) - 1, BACKOFF_MIN.length - 1)] * 6e4).toISOString();
    const why = r.error === "resend_sandbox_sender"
      ? "المرسل المضبوط onboarding@resend.dev تجريبي: لا يوصل إلا لبريد صاحب حساب Resend. اضبط OTP_FROM_EMAIL على عنوان من نطاق موثَّق في Resend."
      : r.error === "email_not_configured" ? "لا مزوّد بريد مضبوط (RESEND_API_KEY أو ACS_*)." : `رفض مزوّد البريد الإرسال (${r.error}).`;
    await alertOwner(rec, key, "email", `فاتورة ${rec.number} صدرت ولم تصل العميل`,
      `<p>صدرت الفاتورة <b>${esc(rec.number)}</b> في الدفترة (${rec.total} ﷼) لكن بريدها إلى العميل <b>${esc(mail.to)}</b> لم يخرج.</p><p><b>السبب:</b> ${esc(why)}</p>` +
      `<table>${kv("مرجع الطلب", d.ref)}${kv("رقم الدفعة", d.payId || key)}${kv("رابط الفاتورة", link)}</table>` +
      `<p><b>المطلوب:</b> أرسلها للعميل من لوحة التحكم ← «تصحيح فاتورة صادرة» ← ابحث عن ${esc(rec.number)} ← أرسل. وستحاول المنصة الإرسال بنفسها مجدداً.</p>`, target, "email");
  }
  return r;
}

// ----------------------------------------------------------------- engine --
// `record` (السجلّ بمسودته وبريد العميل) غير قابل للتعداد: ردّ /api/pay يذهب
// إلى المتصفح كما هو، ولا يجوز أن يحمل المسودة معه.
const withRecord = (out, rec) => Object.defineProperty(out, "record", { value: rec, enumerable: false });
function resultOf(rec, extra = {}) {
  const sent = !!(rec.delivery && rec.delivery.sent_at);
  return withRecord({
    invoiced: true, id: rec.daftra_id, number: rec.number, total: rec.total, net: rec.net, vat: rec.vat,
    paymentRecorded: !!rec.payment_recorded,
    pdfAttached: sent && rec.delivery.mode === "pdf",
    clientEmailed: sent,
    deliveredBy: rec.delivery ? (rec.delivery.mode === "pdf" ? "daftra_pdf" : rec.delivery.mode === "link" ? "daftra_link" : "summary") : undefined,
    payUrl: rec.pdf_url || "",
    ...extra,
  }, rec);
}

// الواجهة الوحيدة لإصدار فاتورة دفعة. لا ترمي: تردّ دائماً كائناً.
//   draft  : { ref, payId, method, buyer, items:[{code?,name,quantity,unitPrice}], notes }
//   target : { rowId, myUrl, hooks } أو null (طلب بلا صف: عرضٌ قديم/قاعدة غائبة)
export function issuePaidInvoice({ key, draft, target = null, force = false }) {
  const base = String(key || (draft && (draft.payId || draft.ref)) || "");
  if (!base) return Promise.resolve({ invoiced: false, reason: "no_key" });
  // الفاتورة لـ(دفعة، طلب): دفعة واحدة قد تسوّي طلبين (سلة مختلطة بعرضٍ قائم).
  const k = target && target.rowId ? `${base}@${target.rowId}` : base;
  const inflight = (globalThis.__bpInvoiceInflight ||= new Map());
  if (inflight.has(k)) return inflight.get(k);
  const run = runIssue({ key: k, draft, target, force })
    .catch((e) => { console.error("invoicing: unexpected", String((e && e.message) || e).slice(0, 160)); return { invoiced: false, reason: String((e && e.message) || "invoice_failed").slice(0, 80) }; })
    .finally(() => inflight.delete(k));
  inflight.set(k, run);
  return run;
}

async function runIssue({ key, draft, target, force }) {
  if (!invoicingEnabled()) return { invoiced: false, reason: daftraConfigured() ? "daftra_skipped_nonlive" : "daftra_not_configured" };
  // (دفعة حقيقية ومفتاح الدفترة غائب: لا نعود صامتين — يمضي الحجز ثم يفشل بسبب
  // daftra_not_configured فيُسجَّل ويُنبَّه المالك وتُعاد المحاولة حين يُضبط المفتاح.)
  const t0 = Date.now();
  let rec;
  if (target && target.rowId) {
    const g = await begin(target.rowId, claimRecord(draft), { force });
    if (g.mode === "done") return resultOf(g.rec, { already: true });
    // سبقك غيرك (جارٍ الآن) أو ينتظر موعد محاولته: ليست «فاتورة ضائعة» ولا تُنبَّه عليها مرة ثانية.
    if (["busy", "wait", "exhausted"].includes(g.mode)) return { invoiced: false, reason: "already_settled", pending: true, state: g.mode };
    if (g.mode === "won") rec = g.rec;
  }
  if (!rec) rec = claimRecord(draft);
  const d = rec.draft || draft;
  d.ref = d.ref || draft.ref;

  // 1) الفاتورة في الدفترة
  if (!rec.daftra_id) {
    try {
      let made = null;
      // محاولة سابقة قد تكون وصلت الدفترة وضاع ردّها: لا تُنشأ ثانية قبل البحث عنها.
      if ((rec.attempts || 1) > 1 && d.ref) {
        const hit = await daftraFindInvoiceByRef(d.ref).catch(() => null);
        if (hit) { const t = sumDraft(d.items); made = { id: hit.id, number: hit.number, net: t.net, vat: t.vat, total: t.total, adopted: true }; }
      }
      if (!made) {
        const { client } = await daftraFindOrCreateClient(d.buyer);
        if (!client || !client.id) throw Object.assign(new Error("client_failed"), { detail: "الدفترة لم تُرجع سجل عميل" });
        for (let i = 0; i < 2 && !made; i++) {
          try { made = await daftraCreateInvoice({ clientId: client.id, items: d.items, notes: d.notes, ref: d.ref || "" }); }
          catch (e) {
            if (!isTransient(e) || i === 1) throw e;
            // الطلب الأول قد يكون وصل: انتظر ثم ابحث قبل أن تعيد.
            await new Promise((r) => setTimeout(r, tuning.transientPauseMs));
            const hit = d.ref ? await daftraFindInvoiceByRef(d.ref).catch(() => null) : null;
            if (hit) { const t = sumDraft(d.items); made = { id: hit.id, number: hit.number, net: t.net, vat: t.vat, total: t.total, adopted: true }; }
          }
        }
      }
      Object.assign(rec, {
        number: String(made.number), mode: "daftra", daftra_id: made.id, net: made.net, vat: made.vat, total: made.total,
        currency: made.currency || "SAR", vat_rate: Number(daftraVatRate()) || 15,
        issued_at: nowIso(), public_url: made.publicUrl || made.url || "", status: "created", last_error: null, next_retry_at: null,
      });
      await persist(target, rec);
      if (target && target.hooks && target.hooks.event) await target.hooks.event("invoice.issued", { number: rec.number, total: rec.total }).catch(() => {});
    } catch (e) {
      const { code, detail } = failReason(e);
      rec.status = "failed"; rec.last_error = code; rec.last_detail = detail;
      rec.next_retry_at = new Date(Date.now() + BACKOFF_MIN[Math.min((rec.attempts || 1) - 1, BACKOFF_MIN.length - 1)] * 6e4).toISOString();
      console.error("invoicing: Daftra did not issue the invoice", key, code, detail.slice(0, 160));
      await alertOwner(rec, key, "create", `فاتورة دفعة لم تصدر من الدفترة — ${d.ref || key}`,
        `<p>دفع العميل <b>${esc(d.buyer && d.buyer.name)}</b> (${esc(d.buyer && d.buyer.email)}) مبلغ <b>${rec.total} ﷼</b>، لكن الدفترة لم تُصدر الفاتورة.</p>` +
        `<table>${kv("السبب", code)}${kv("التفصيل", detail)}${kv("مرجع الطلب", d.ref)}${kv("رقم الدفعة", d.payId || key)}${kv("المحاولة", rec.attempts + " من " + MAX_ATTEMPTS)}</table>` +
        (code === "daftra_unauthorized" ? "<p><b>الأرجح:</b> DAFTRA_API_KEY غير صحيح أو منتهٍ — افحصه من لوحة التحكم ← «افحص اتصال الدفترة».</p>" : "") +
        (code === "daftra_tax_missing" ? "<p><b>الأرجح:</b> لا ضريبة 15% مفعّلة في إعدادات الدفترة.</p>" : ""), target, "create");
      await persist(target, rec);
      if (target && target.hooks && target.hooks.event) await target.hooks.event("invoice.failed", { reason: code, attempts: rec.attempts }).catch(() => {});
      return withRecord({ invoiced: false, reason: code, retry: rec.next_retry_at, alerted: true }, rec);
    }
  }

  // 2) تسجيل السداد على الفاتورة
  if (!rec.payment_recorded && !rec.payment_ambiguous) {
    try {
      await daftraRecordPayment({ invoiceId: rec.daftra_id, amount: rec.total, transactionId: d.payId || key, method: d.method || "Moyasar" });
      rec.payment_recorded = true; rec.payment_error = null;
    } catch (e) {
      const { code, detail } = failReason(e);
      rec.payment_recorded = false; rec.payment_error = code;
      // انقطاع بعد الإرسال لا يُعرف أوصل أم لا: لا يُكرَّر حتى لا يُسجَّل السداد مرتين.
      rec.payment_ambiguous = e && e.message === "daftra_unreachable";
      console.error("invoicing: payment not recorded on the Daftra invoice", key, code, detail.slice(0, 120));
      await alertOwner(rec, key, "payment", `فاتورة ${rec.number} صدرت والدفعة لم تُسجَّل في الدفترة`,
        `<p>الفاتورة <b>${esc(rec.number)}</b> صدرت بإجمالي <b>${rec.total} ﷼</b> بعد دفعة مؤكدة (رقم العملية <b style="direction:ltr;display:inline-block">${esc(d.payId || key)}</b>)، لكن تسجيل السداد عليها تعذّر آلياً.</p>` +
        `<p><b>المطلوب:</b> افتح الفاتورة في الدفترة وسجّل عليها دفعة بقيمة ${rec.total} ﷼ بطريقة «${esc(d.method || "Moyasar")}».</p>`, null, "payment");
    }
    await persist(target, rec);
  }

  // 3) الإرسال إلى بريد العميل
  if (!(rec.delivery && (rec.delivery.sent_at || rec.delivery.skipped))) {
    await deliver(rec, { target, key, t0 });
    await persist(target, rec);
    if (target && target.hooks && target.hooks.event && rec.delivery && rec.delivery.sent_at) {
      await target.hooks.event("invoice.emailed", { number: rec.number, to: rec.delivery.to, mode: rec.delivery.mode }).catch(() => {});
    }
  }
  return resultOf(rec, rec.status === "created" ? { alerted: true } : {});
}

// دفعة لا تُصدر لها فاتورة أصلاً (مبلغ لا يطابق، مشترٍ بلا بريد، بند خارج الكتالوج):
// ليس لها ما يُعاد، لكن لها من يُنبَّه — وإلا مرّت صامتة في خطّاف مُيسّر وتمارا.
export async function reportInvoiceBlocked({ key, draft, target = null, reason, detail = "", total = 0 }) {
  if (!invoicingEnabled()) return { invoiced: false, reason, alerted: false };
  const k = String(key || (draft && draft.ref) || "");
  const rec = { number: "", mode: "pending-daftra", status: "blocked", total: round2(total), net: 0, vat: 0, currency: "SAR",
    issued_at: nowIso(), attempts: MAX_ATTEMPTS, last_error: reason, last_detail: String(detail).slice(0, 300),
    bill_to: { name: draft && draft.buyer && draft.buyer.name, email: draft && draft.buyer && draft.buyer.email }, alerts: [] };
  if (target && target.rowId) {
    try {
      const won = await sb(`requests?id=eq.${target.rowId}&invoice=is.null`, { method: "PATCH", body: { invoice: rec, updated_at: nowIso() } });
      if (!(won && won.length)) return { invoiced: false, reason, alerted: true };   // سجلٌّ قائم: له صاحب أُبلغ
    } catch { /* alert anyway */ }
  }
  const alerted = await alertOwner(rec, k, "blocked", `فاتورة دفعة لا يمكن إصدارها آلياً — ${(draft && draft.ref) || k}`,
    `<p>دفعة مؤكدة لم تُصدر لها فاتورة، ولا تُعاد المحاولة لأن السبب يحتاج قراراً بشرياً.</p>` +
    `<table>${kv("السبب", reason)}${kv("التفصيل", detail)}${kv("مرجع الطلب", draft && draft.ref)}${kv("رقم الدفعة", (draft && draft.payId) || k)}${kv("العميل", draft && draft.buyer && (draft.buyer.name + " · " + draft.buyer.email))}</table>` +
    `<p><b>المطلوب:</b> أصدر الفاتورة يدوياً من لوحة التحكم (فاتورة B2B / تصحيح فاتورة) وأرسلها للعميل.</p>`, target, reason);
  if (target && target.rowId) await persist(target, rec);
  return { invoiced: false, reason, alerted };
}
