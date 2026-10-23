// مدقّق إيصال الحوالة البنكية — دالة نقية بلا شبكة ولا قاعدة بيانات.
//
// السؤال الذي يجيب عنه: «هل هذا إيصال حوالة بنكية فعلاً، ودخل حساب الشركة
// نفسه، بالمبلغ المطلوب، وحديث، ولم يُستعمل لطلب آخر؟». قراءة الصورة وحدها
// (api/_simple.js: receipt-upload) لا تجيب إلا عن «كم المبلغ»؛ هذا الملف يضيف
// بقية الأسئلة.
//
// القاعدة الحاكمة: لا قبول تلقائي إلا إذا نجحت كل الفحوص. أي شك = review مع
// سبب بعربية بسيطة. reject لا يُستعمل إلا حين يقوم دليل واضح على أن الإيصال
// لا يصلح (ليس إيصالاً، تحويل فاشل، آيبان آخر، قديم، مكرر على طلب آخر).
// «match» لا يعني أن المال وصل — يعني أن الإيصال سليم ومطابق. وصول المال يُؤكَّد
// من كشف الحساب البنكي، وتبقى مهمة التأكيد البشري على لوحة العمليات.
//
// لا يتصل بأي خدمة. القراءة نفسها (Azure Document Intelligence + نموذج Azure)
// تجري في api/_docread.js عبر readDocumentRaw، وتُمرَّر نتيجتها هنا كـfields أو
// text. لا مفاتيح جديدة ولا مزوّد جديد.
//
// بيانات الشركة تأتي من البيئة فقط (لا آيبان مكتوب في الكود):
//   COMPANY_IBAN              آيبان الشركة (SA + 22)
//   COMPANY_BENEFICIARY_NAME  اسم المستفيد؛ عدة أسماء (عربي|إنجليزي) تُفصل بـ |
// وللتوافق مع ما هو مضبوط اليوم يُقبل BP_BANK_IBAN وBP_BANK_BENEFICIARY عند غياب الأولين.

import crypto from "node:crypto";
import { readDocumentRaw, readDocumentText, parseJson } from "./_docread.js";

// ---- ثوابت الحكم (مكتوبة عمداً هنا لا في الأرقام السحرية) -------------------

/** تسامح المبلغ بالريال: |المقروء − المطلوب| ≤ 1.00 يُعدّ مطابقاً (كما في الوضع القائم). */
export const AMOUNT_TOLERANCE_SAR = 1;
/** أقدم عمر مقبول لتاريخ العملية بالأيام قبل لحظة الفحص. */
export const MAX_RECEIPT_AGE_DAYS = 7;
/** أقصى تقدّم مقبول لتاريخ الإيصال عن لحظة الفحص (فروق التوقيت) بالأيام. */
export const MAX_FUTURE_SKEW_DAYS = 1;
/** عدد مجموعات الدلائل التي يلزم ظهورها لنقول «هذا إيصال حوالة». */
export const MIN_RECEIPT_SIGNALS = 4;
/** أقل نسبة كلمات من اسم المستفيد المتوقع يجب أن تظهر في الإيصال. */
export const NAME_MATCH_RATIO = 0.8;

const DAY_MS = 86400000;

// ---- أدوات النص -------------------------------------------------------------

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** يحوّل الأرقام العربية/الفارسية إلى لاتينية ويوحّد المسافات. */
export function latinDigits(s) {
  return String(s == null ? "" : s)
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٫]/g, ".")
    .replace(/[٬]/g, ",");
}

/** تطبيع الاسم للمقارنة: تشكيل/تطويل/همزات/تاء مربوطة/ياء/علامات. */
export function normName(s) {
  return latinDigits(s)
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// كلمات شكلية لا تُحسب عند مقارنة اسم الشركة (تختلف كتابتها بين البنوك).
const NAME_STOP = new Set([
  "شركه", "مؤسسه", "مجموعه", "المحدوده", "محدوده", "ذ", "م", "ش", "ذم", "ذمم", "السعوديه", "للتجاره", "ال",
  "company", "co", "ltd", "limited", "llc", "est", "establishment", "corp", "corporation", "the", "of", "and", "w", "l",
  "المساهمه", "المقفله", "شخص", "واحد", "ساهمه", "مساهمه",
]);
const nameTokens = (s) => normName(s).split(" ").filter((t) => t && !NAME_STOP.has(t));

// ---- الآيبان ---------------------------------------------------------------

/** يزيل المسافات والشرطات ويكبّر الأحرف ويحوّل الأرقام العربية. */
export function normalizeIban(s) {
  return latinDigits(s).replace(/[\s\-_.‎‏‪-‮]/g, "").toUpperCase();
}

/** مجموع التحقق ISO 7064 (mod 97-10) لأي آيبان. */
export function ibanChecksumOk(iban) {
  const v = normalizeIban(iban);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(v)) return false;
  const rearr = v.slice(4) + v.slice(0, 4);
  let rem = 0;
  for (const ch of rearr) {
    const part = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of part) rem = (rem * 10 + Number(d)) % 97;
  }
  return rem === 1;
}

/** صيغة آيبان سعودي: SA + رقما تحقق + 20 خانة (رمز مصرف 2 + حساب 18) = 24 خانة، ومجموع تحقق صحيح. */
export function isSaudiIban(s) {
  const v = normalizeIban(s);
  return /^SA\d{2}[0-9A-Z]{20}$/.test(v) && ibanChecksumOk(v);
}

/** شكل الصيغة فقط (طول وحروف) بلا مجموع التحقق — لتمييز «خطأ قراءة» من «آيبان آخر». */
const saudiIbanShape = (s) => /^SA\d{2}[0-9A-Z]{20}$/.test(normalizeIban(s));

/** يحجب الوسط: SA03…4321 — للسجلّات والتقارير. */
export function maskIban(s) {
  const v = normalizeIban(s);
  if (!v) return "—";
  return v.length <= 8 ? "****" : `${v.slice(0, 4)}…${v.slice(-4)}`;
}

const isMaskedIban = (s) => /[*•xX●·]/.test(String(s || "")) && /SA/i.test(String(s || ""));

/** يستخرج كل ما يشبه آيبان من نص (مع المسافات بين المجموعات). */
export function findIbans(text) {
  const t = latinDigits(text).toUpperCase();
  const out = [];
  const re = /\bSA\s*\d{2}(?:[\s\-]*[0-9A-Z]){20}/g;
  let m;
  while ((m = re.exec(t))) {
    const v = normalizeIban(m[0]).slice(0, 24);
    if (v.length === 24 && !out.includes(v)) out.push(v);
  }
  return out;
}

const ROLE_BEN = /(المستفيد|beneficiary|payee|إلى حساب|الى حساب|to account|credit(?:ed)? to)/gi;
const ROLE_SEND = /(من حساب|المرسل|المحول|المُحوِّل|sender|debit(?:ed)?(?: account)?|from account|الحساب المدين|from\b)/gi;
const lastIndexOf = (re, s) => { let at = -1, m; re.lastIndex = 0; while ((m = re.exec(s))) at = m.index; return at; };

/**
 * لكل آيبان في النص: دوره بحسب أقرب عنوان يسبقه خلال 45 حرفاً (مستفيد / مرسل / غير معروف).
 * @returns {Array<{iban:string, role:"beneficiary"|"sender"|"unknown"}>}
 */
export function ibanRoles(text) {
  const t = latinDigits(text).toUpperCase();
  const out = [];
  const re = /\bSA\s*\d{2}(?:[\s\-]*[0-9A-Z]){20}/g;
  let m;
  while ((m = re.exec(t))) {
    const iban = normalizeIban(m[0]).slice(0, 24);
    if (iban.length !== 24) continue;
    const before = t.slice(Math.max(0, m.index - 45), m.index).toLowerCase();
    const b = lastIndexOf(ROLE_BEN, before), s = lastIndexOf(ROLE_SEND, before);
    out.push({ iban, role: b < 0 && s < 0 ? "unknown" : b > s ? "beneficiary" : "sender" });
  }
  return out;
}

// ---- بصمة الإيصال ---------------------------------------------------------

/** SHA-256 للملف (Buffer أو base64 بلا data:) — للكشف عن إيصال استُعمل لطلب آخر. */
export function receiptFileHash(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input || "").replace(/^data:[^;]+;base64,/, ""), "base64");
  return crypto.createHash("sha256").update(buf).digest("hex");
}

/** رقم المرجع بصيغة مقارنة: أحرف وأرقام كبيرة فقط. أقل من 6 خانات لا يُعتدّ به. */
export function normReference(s) {
  const v = latinDigits(s).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return v.length >= 6 ? v : "";
}

// ---- التاريخ ---------------------------------------------------------------

/**
 * يحلّل تاريخاً ميلادياً من نص: 2026-10-23 · 23/10/2026 · 23-10-2026 · 2026/10/23
 * مع وقت اختياري. هجري (سنة 13xx/14xx) يُرجع {hijri:true} بلا تحويل — لا نخمّن.
 * @returns {{date:Date}|{hijri:true}|null}
 */
export function parseReceiptDate(s) {
  const t = latinDigits(s);
  let y, mo, d;
  let m = t.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = t.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/))) { d = +m[1]; mo = +m[2]; y = +m[3]; }
  else return null;
  if (y >= 1300 && y < 1600) return { hijri: true };
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  const tm = t.match(/\b(\d{1,2}):(\d{2})/);
  const hh = tm ? Math.min(+tm[1], 23) : 12;
  const mm = tm ? Math.min(+tm[2], 59) : 0;
  const dt = new Date(Date.UTC(y, mo - 1, d, hh, mm));
  // تاريخ مستحيل (31 فبراير) يتدحرج إلى شهر آخر — نرفضه.
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  // أوقات الإيصالات بتوقيت الرياض (UTC+3).
  return { date: new Date(dt.getTime() - 3 * 3600000) };
}

// ---- استخراج الحقول من نص خام ---------------------------------------------

const KW = {
  transfer: /(تحويل|حواله|حوالة|حوالات|remittance|transfer|sarie|swift|instant\s*payment|سريع|اي\s*بان\s*تحويل)/i,
  iban: /(iban|ايبان|آيبان|رقم الحساب الدولي)/i,
  beneficiary: /(المستفيد|اسم المستفيد|beneficiary|payee|credit(?:ed)?\s*(?:to|account)|الى حساب|إلى حساب)/i,
  reference: /(رقم المرجع|المرجع|رقم العمليه|رقم العملية|reference|ref\.?\s*(?:no|number|#)|transaction\s*(?:id|no|number)|trx)/i,
  bank: /(بنك|مصرف|المصرف|bank|الراجحي|الاهلي|الأهلي|الرياض|البلاد|الانماء|الإنماء|ساب|الجزيره|الجزيرة|الفرنسي|العربي الوطني|stc\s*bank|alrajhi|snb|riyad|albilad|alinma|sab\b|anb\b)/i,
  date: /(تاريخ|date|وقت العمليه|وقت العملية)/i,
  amount: /(المبلغ|مبلغ|amount|sar|ر\.?\s?س|ريال|riyal)/i,
};
// إيصال لم تكتمل حوالته أو لا يثبت نقلاً: لا يُقبل تلقائياً.
const KW_FAILED = /(فشل|فشلت|مرفوض|مرفوضه|مرفوضة|ملغي|ملغاة|ملغيه|مرتجع|معكوس|reject(?:ed)?|fail(?:ed|ure)?|declin(?:ed)?|cancel(?:l?ed)?|revers(?:ed|al)|returned|unsuccessful)/i;
const KW_PENDING = /(قيد المعالجه|قيد المعالجة|قيد التنفيذ|قيد الانتظار|بانتظار|معلق|معلقه|معلّقة|مجدول|مجدوله|مجدولة|مستقبلي|سيتم التنفيذ|pending|scheduled|processing|in progress|future[- ]dated|awaiting|on hold)/i;
const KW_SUCCESS = /(نجاح|ناجح|ناجحه|ناجحة|تم التحويل|تم تنفيذ|تمت العمليه|تمت العملية|نفذت|نُفذت|منفذه|منفذة|مكتمل|مكتمله|مكتملة|successful(?:ly)?|completed|executed|processed|success|accepted)/i;
// دلائل أن الوثيقة ليست حوالة (فاتورة/عرض سعر/إيصال بطاقة/إيداع نقدي).
const KW_NOT_TRANSFER = /(فاتوره|فاتورة|invoice|عرض سعر|quotation|quote\b|سند قبض|receipt voucher|pos\b|نقاط البيع|مدى\b|mada\b|visa|mastercard|ماستر|ايداع نقدي|إيداع نقدي|cash deposit|كشف حساب|account statement)/i;

const CURRENCY_SAR = /^(sar|s\.?a\.?r\.?|ر\.?\s?س\.?|ريال(?:\s*سعودي)?|﷼|saudi riyal|sr)$/i;

function amountFromText(text, expectedAmount) {
  const t = latinDigits(text);
  const num = "(\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d+(?:\\.\\d{1,2})?)";
  const labeled = [];
  const reLabel = new RegExp("(?:المبلغ(?:\\s*المحول)?|مبلغ(?:\\s*التحويل)?|amount(?:\\s*transferred)?|transfer\\s*amount|debit\\s*amount)\\s*[:：\\-]?\\s*(?:sar|ر\\.?\\s?س|ريال|﷼)?\\s*" + num, "gi");
  let m;
  while ((m = reLabel.exec(t))) labeled.push(parseFloat(m[1].replace(/,/g, "")));
  const withCur = [];
  const reCur = new RegExp(num + "\\s*(?:sar|sr|ر\\.?\\s?س|ريال|﷼)", "gi");
  while ((m = reCur.exec(t))) withCur.push(parseFloat(m[1].replace(/,/g, "")));
  const reCurPre = new RegExp("(?:sar|sr|ر\\.?\\s?س|ريال|﷼)\\s*" + num, "gi");
  while ((m = reCurPre.exec(t))) withCur.push(parseFloat(m[1].replace(/,/g, "")));
  const candidates = [...new Set([...labeled, ...withCur].filter((n) => Number.isFinite(n) && n > 0))];
  // الأولوية للمبلغ المعنون صراحة؛ ثم لأقرب مرشّح إلى المتوقع (ليس تخميناً حراً:
  // الفحص اللاحق يقارن بالتسامح نفسه).
  let value = labeled.find((n) => n > 0) ?? null;
  if (value == null && candidates.length) value = candidates.length === 1 ? candidates[0] : null;
  return { value, candidates, labeled: labeled.length > 0 };
}

function dateFromText(text) {
  const t = latinDigits(text);
  const lab = t.match(/(?:تاريخ(?:\s*(?:العمليه|العملية|التحويل|التنفيذ))?|date|transaction\s*date|value\s*date)\s*[:：\-]?\s*([^\n]{0,40})/i);
  if (lab && parseReceiptDate(lab[1])) return lab[1].trim();
  const any = t.match(/\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}(?:\s+\d{1,2}:\d{2})?|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}(?:\s+\d{1,2}:\d{2})?/);
  return any ? any[0] : "";
}

function referenceFromText(text) {
  const t = latinDigits(text);
  const m = t.match(/(?:رقم\s*المرجع|المرجع|رقم\s*العمليه|رقم\s*العملية|reference(?:\s*(?:no\.?|number|#))?|ref(?:erence)?\.?\s*(?:no\.?|number|#)|transaction\s*(?:id|no\.?|number)|trx\s*(?:id|no\.?)?)\s*[:：#.\-]?\s*([A-Za-z0-9][A-Za-z0-9\-\/]{5,39})/i);
  return m ? m[1] : "";
}

function currencyFromText(text) {
  const t = latinDigits(text);
  if (/(?:\bsar\b|\bsr\b|ر\.?\s?س|ريال\s*سعودي|ريال|﷼)/i.test(t)) return "SAR";
  const m = t.match(/\b(usd|eur|gbp|aed|kwd|bhd|omr|egp|qar|inr|pkr)\b/i);
  return m ? m[1].toUpperCase() : "";
}

// ---- تهيئة الإعدادات من البيئة ---------------------------------------------

/**
 * بيانات حساب الشركة من البيئة. الاستدعاء من الراوتر يمرّرها صراحة في expected
 * إن أراد؛ وإلا تُقرأ هنا. لا قيم افتراضية مكتوبة.
 */
export function companyBankFromEnv(env = process.env) {
  const e = (k) => String(env[k] || "").trim();
  const iban = normalizeIban(e("COMPANY_IBAN") || e("BP_BANK_IBAN"));
  const nameRaw = e("COMPANY_BENEFICIARY_NAME") || e("BP_BANK_BENEFICIARY");
  const names = nameRaw.split("|").map((s) => s.trim()).filter(Boolean);
  return { iban, names };
}

// ---- الحكم -----------------------------------------------------------------

const chk = (name, ok, detail, severity = "review") => ({ name, ok: !!ok, detail, severity: ok ? "info" : severity });

/**
 * @param {object} input
 * @param {string} [input.text]      النص الخام المستخرج من الإيصال (Document Intelligence أو نموذج الرؤية)
 * @param {object} [input.fields]    حقول مقروءة: {amount,currency,date,sender,beneficiary,bank,reference,iban,account,status,is_receipt,note}
 * @param {string} [input.fileHash]  receiptFileHash() للملف المرفوع
 * @param {Array<{hash?:string,reference?:string,requestRef?:string}>} [input.seen]  إيصالات سبق قبولها/رفعها على طلبات
 * @param {object} input.expected    {amount, beneficiaryName?, iban?, currency?, referenceHint?, requestRef?, notBefore?}
 * @param {Date|number|string} [input.now]
 * @returns {{verdict:"match"|"review"|"reject", checks:Array, reasons:string[], customerMessage:string, teamNote:string, extracted:object, fingerprint:{hash:string,reference:string}}}
 */
export function verifyTransferReceipt(input = {}) {
  const { text = "", fields = null, fileHash = "", seen = [], expected = {} } = input;
  const now = input.now != null ? new Date(input.now) : new Date();
  const checks = [];

  const f = fields && typeof fields === "object" ? fields : {};
  const raw = latinDigits(String(text || ""));
  const hasText = raw.trim().length > 0;
  const hasFields = !!(fields && typeof fields === "object" && Object.keys(fields).length);

  // ----- ما استُخرج: الحقول المقروءة أولاً، والنص يملأ الناقص ويُراجع عليه.
  const textAmount = hasText ? amountFromText(raw) : { value: null, candidates: [], labeled: false };
  const fAmount = f.amount != null && f.amount !== "" ? Number(String(latinDigits(f.amount)).replace(/,/g, "")) : NaN;
  const amount = Number.isFinite(fAmount) ? fAmount : textAmount.value;
  const currencyRaw = String(f.currency || "").trim() || (hasText ? currencyFromText(raw) : "");
  const currency = currencyRaw ? (CURRENCY_SAR.test(currencyRaw) ? "SAR" : currencyRaw.toUpperCase()) : "";
  const dateStr = String(f.date || "").trim() || (hasText ? dateFromText(raw) : "");
  const reference = String(f.reference || "").trim() || (hasText ? referenceFromText(raw) : "");
  const beneficiary = String(f.beneficiary || "").trim();
  const bank = String(f.bank || "").trim();
  const ibanField = String(f.iban || f.account || "").trim();
  const ibansInText = hasText ? findIbans(raw) : [];
  const maskedInText = hasText ? (raw.toUpperCase().match(/SA\s*\d{2}[\s\-0-9A-Z*•●Xx]{6,30}/g) || []).filter(isMaskedIban) : [];
  const status = String(f.status || "").toLowerCase();

  const extracted = {
    amount: Number.isFinite(amount) ? amount : null,
    currency: currency || null,
    date: dateStr || null,
    reference: reference || null,
    beneficiary: beneficiary || null,
    bank: bank || null,
    iban: ibanField ? maskIban(ibanField) : ibansInText.length ? ibansInText.map(maskIban) : null,
  };

  // ----- (أ) هل هو إيصال حوالة بنكية؟
  {
    const sig = {};
    if (hasText) {
      sig.transfer = KW.transfer.test(raw);
      sig.iban = KW.iban.test(raw) || ibansInText.length > 0 || maskedInText.length > 0;
      sig.beneficiary = KW.beneficiary.test(raw);
      sig.reference = KW.reference.test(raw) && !!reference;
      sig.bank = KW.bank.test(raw);
      sig.date = !!dateFromText(raw);
      sig.amount = textAmount.candidates.length > 0;
    }
    // الحقول المقروءة تُضيف دلائلها (مفتاح مشترك لا يُحسب مرتين).
    if (hasFields) {
      if (Number.isFinite(fAmount)) sig.amount = true;
      if (beneficiary) sig.beneficiary = true;
      if (ibanField) sig.iban = true;
      if (String(f.reference || "").trim()) sig.reference = true;
      if (bank) sig.bank = true;
      if (String(f.date || "").trim()) sig.date = true;
      if (/transfer|تحويل|حوال/i.test(String(f.kind || f.type || ""))) sig.transfer = true;
    }
    const SIG_AR = { transfer: "كلمة تحويل", iban: "آيبان", beneficiary: "المستفيد", reference: "رقم المرجع", bank: "البنك", date: "التاريخ", amount: "المبلغ" };
    const names = Object.keys(sig).filter((k) => sig[k]).map((k) => SIG_AR[k] || k);
    const count = names.length;
    const notTransferDoc = hasText && KW_NOT_TRANSFER.test(raw) && !KW.transfer.test(raw);
    const flaggedNo = f.is_receipt === false;
    const strong = sig.amount && (sig.beneficiary || sig.iban);
    const enough = count >= MIN_RECEIPT_SIGNALS && strong && (hasText ? sig.transfer || sig.iban : true) && !notTransferDoc && !flaggedNo;
    let detail;
    if (!hasText && !hasFields) detail = "لم يصل أي نص أو حقول مقروءة من الملف.";
    else if (flaggedNo) detail = "القارئ الآلي صنّف الملف على أنه ليس إيصال تحويل.";
    else if (notTransferDoc) detail = "الملف يبدو فاتورة أو إيصال بطاقة أو عرض سعر لا حوالة بنكية.";
    else if (!enough) detail = `وجدنا ${count} من دلائل الحوالة (المطلوب ${MIN_RECEIPT_SIGNALS} على الأقل مع المبلغ والمستفيد أو الآيبان): ${names.join("، ") || "لا شيء"}.`;
    else detail = `دلائل الحوالة ظاهرة (${count}): ${names.join("، ")}.`;
    checks.push(chk("إيصال حوالة بنكية", enough, detail, "reject"));
  }

  // ----- حالة التنفيذ: الحوالة المجدولة/المعلّقة/الفاشلة لم تدخل الحساب.
  {
    const failed = (hasText && KW_FAILED.test(raw)) || /fail|reject|cancel|revers/.test(status);
    const pending = (hasText && KW_PENDING.test(raw)) || /pend|schedul|process/.test(status);
    const success = (hasText && KW_SUCCESS.test(raw)) || /^(executed|success|completed|ok)/.test(status);
    if (failed) checks.push(chk("تنفيذ الحوالة", false, "الإيصال يذكر أن العملية فشلت أو أُلغيت أو أُرجعت.", "reject"));
    else if (pending) checks.push(chk("تنفيذ الحوالة", false, "الإيصال يذكر أن الحوالة معلّقة أو مجدولة أو قيد المعالجة، أي لم تدخل الحساب بعد."));
    else if (!success) checks.push(chk("تنفيذ الحوالة", false, "لا يوجد في الإيصال ما يثبت أن الحوالة نُفِّذت (مثل «تمت العملية بنجاح»)."));
    else checks.push(chk("تنفيذ الحوالة", true, "الإيصال يذكر نجاح تنفيذ العملية."));
  }

  // ----- (ب) المبلغ
  {
    const want = Number(expected.amount);
    const wantCur = String(expected.currency || "SAR").toUpperCase();
    if (!Number.isFinite(want) || want <= 0) {
      checks.push(chk("المبلغ", false, "لا يوجد مبلغ مطلوب للمقارنة (إجمالي الطلب غير محدد)."));
    } else if (!Number.isFinite(amount)) {
      checks.push(chk("المبلغ", false, "تعذّرت قراءة مبلغ الحوالة من الإيصال."));
    } else {
      const diff = Math.round((amount - want) * 100) / 100;
      if (Math.abs(diff) <= AMOUNT_TOLERANCE_SAR + 1e-9) checks.push(chk("المبلغ", true, `المبلغ ${amount} ريال يطابق المطلوب ${want} (التسامح ± ${AMOUNT_TOLERANCE_SAR} ريال).`));
      else if (diff < 0) checks.push(chk("المبلغ", false, `المبلغ المحوَّل ${amount} ريال أقل من المطلوب ${want} بمقدار ${Math.abs(diff)} ريال.`));
      else checks.push(chk("المبلغ", false, `المبلغ المحوَّل ${amount} ريال أعلى من المطلوب ${want} بمقدار ${diff} ريال.`));
    }
    if (!currency) checks.push(chk("العملة", false, "لم تُذكر عملة الحوالة في الإيصال."));
    else if (currency !== wantCur) checks.push(chk("العملة", false, `عملة الإيصال ${currency} لا ريال سعودي، فلا تصحّ المقارنة بالمبلغ.`, "reject"));
    else checks.push(chk("العملة", true, "العملة ريال سعودي."));
  }

  // ----- (ج) حساب الشركة: الآيبان واسم المستفيد
  const env = companyBankFromEnv();
  const wantIban = normalizeIban(expected.iban || env.iban);
  const wantNames = (Array.isArray(expected.beneficiaryName) ? expected.beneficiaryName : [expected.beneficiaryName || ""])
    .flatMap((n) => String(n || "").split("|")).map((s) => s.trim()).filter(Boolean);
  const names = wantNames.length ? wantNames : env.names;

  // الآيبان
  {
    if (!wantIban) {
      checks.push(chk("آيبان الشركة", false, "آيبان الشركة غير مضبوط في الإعدادات (COMPANY_IBAN)، فلا يمكن مطابقته."));
    } else if (!isSaudiIban(wantIban)) {
      checks.push(chk("آيبان الشركة", false, "آيبان الشركة المضبوط في الإعدادات ليس بصيغة آيبان سعودي صحيحة (SA + 22 خانة ومجموع تحقق)؛ يلزم تصحيحه."));
    } else {
      const maskOk = (v) => {
        const n = normalizeIban(v);
        const pre = n.match(/^[A-Z0-9]*/)[0];
        const suf = n.match(/[A-Z0-9]*$/)[0];
        return wantIban.startsWith(pre) && wantIban.endsWith(suf);
      };
      const maskedCheck = (v) => maskOk(v)
        ? chk("آيبان المستفيد", false, "الآيبان في الإيصال مخفي جزئياً؛ الظاهر منه لا يخالف آيبان الشركة لكنه لا يكفي للتأكيد.")
        : chk("آيبان المستفيد", false, "الآيبان المخفي جزئياً في الإيصال تختلف خاناته الظاهرة عن آيبان الشركة.", "reject");
      const classify = (v) => {
        const n = normalizeIban(v);
        if (n === wantIban) return chk("آيبان المستفيد", true, `آيبان المستفيد (${maskIban(wantIban)}) يطابق آيبان الشركة.`);
        if (isSaudiIban(n)) return chk("آيبان المستفيد", false, `آيبان المستفيد في الإيصال (${maskIban(n)}) ليس آيبان الشركة (${maskIban(wantIban)}): الحوالة لحساب آخر.`, "reject");
        if (saudiIbanShape(n)) return chk("آيبان المستفيد", false, `الآيبان المقروء (${maskIban(n)}) مجموع تحققه خاطئ؛ غالباً خطأ قراءة أو كتابة. يلزم تدقيق بشري.`);
        return chk("آيبان المستفيد", false, "الآيبان المقروء من الإيصال ليس بصيغة آيبان سعودي (SA + 22 خانة).");
      };
      if (ibanField) {
        // الحقل المقروء هو آيبان المستفيد بنص الطلب إلى القارئ؛ هو المرجع إن وُجد.
        checks.push(isMaskedIban(ibanField) ? maskedCheck(ibanField) : classify(ibanField));
      } else if (ibansInText.length) {
        // من النص وحده نحدّد دور كل آيبان (مستفيد/مرسل/غير معروف) من أقرب عنوان يسبقه.
        // الرفض لا يقع إلا حين يُنسب إلى «المستفيد» صراحةً آيبان صحيح غير آيبان الشركة؛ أما
        // آيبان لا نعرف دوره (قد يكون المرسل) فلا يكفي للرفض.
        const roles = ibanRoles(raw);
        const co = roles.filter((r) => r.iban === wantIban);
        const otherBen = roles.filter((r) => r.iban !== wantIban && r.role === "beneficiary" && isSaudiIban(r.iban));
        const broken = roles.filter((r) => r.iban !== wantIban && !isSaudiIban(r.iban));
        if (co.some((r) => r.role === "beneficiary") && !otherBen.length) checks.push(classify(wantIban));
        else if (co.length && co.every((r) => r.role === "sender")) checks.push(chk("آيبان المستفيد", false, "آيبان الشركة ظاهر في الإيصال بصفة المرسِل لا المستفيد؛ يلزم تدقيق بشري."));
        else if (co.length && otherBen.length) checks.push(chk("آيبان المستفيد", false, "الإيصال يذكر آيبان الشركة وآيباناً آخر للمستفيد معاً؛ يلزم تدقيق بشري."));
        else if (co.length) checks.push(chk("آيبان المستفيد", false, "آيبان الشركة ظاهر في الإيصال لكن دوره (مستفيد أم مرسل) غير واضح؛ يلزم تدقيق بشري."));
        else if (otherBen.length) checks.push(chk("آيبان المستفيد", false, `آيبان المستفيد في الإيصال (${otherBen.map((r) => maskIban(r.iban)).join("، ")}) ليس آيبان الشركة (${maskIban(wantIban)}): الحوالة لحساب آخر.`, "reject"));
        else if (broken.length) checks.push(chk("آيبان المستفيد", false, `وُجد في الإيصال ما يشبه الآيبان (${broken.map((r) => maskIban(r.iban)).join("، ")}) لكن مجموع تحققه غير صحيح؛ غالباً خطأ قراءة. يلزم تدقيق بشري.`));
        else checks.push(chk("آيبان المستفيد", false, `الإيصال يحمل آيبانات (${roles.map((r) => maskIban(r.iban)).join("، ")}) دون أن يتبيّن أيها للمستفيد وليس بينها آيبان الشركة؛ يلزم تدقيق بشري.`));
      } else if (maskedInText.length) {
        checks.push(maskedCheck(maskedInText[0]));
      } else {
        checks.push(chk("آيبان المستفيد", false, "لم نجد آيبان المستفيد في الإيصال، فلا يمكن التأكد أن الحوالة لحساب الشركة."));
      }
    }
  }

  // اسم المستفيد
  {
    if (!names.length) {
      checks.push(chk("اسم المستفيد", false, "اسم مستفيد الشركة غير مضبوط في الإعدادات (COMPANY_BENEFICIARY_NAME)، فلا يمكن مطابقته."));
    } else {
      // نبحث في حقل المستفيد المقروء أولاً، ثم في النص كله إن لم يوجد الحقل.
      const hay = new Set(normName(beneficiary ? beneficiary : raw).split(" ").filter(Boolean));
      let best = 0, bestName = "";
      for (const n of names) {
        const tk = nameTokens(n);
        if (!tk.length) continue;
        const hit = tk.filter((t) => hay.has(t)).length;
        const ratio = hit / tk.length;
        if (ratio > best) { best = ratio; bestName = n; }
      }
      if (!beneficiary && !hasText) checks.push(chk("اسم المستفيد", false, "لم يُقرأ اسم المستفيد من الإيصال."));
      else if (best >= NAME_MATCH_RATIO) checks.push(chk("اسم المستفيد", true, `اسم المستفيد يطابق اسم الشركة (${Math.round(best * 100)}%).`));
      else if (!beneficiary) checks.push(chk("اسم المستفيد", false, "لم نجد اسم الشركة ضمن نص الإيصال."));
      else checks.push(chk("اسم المستفيد", false, `اسم المستفيد في الإيصال («${beneficiary.slice(0, 60)}») لا يطابق اسم الشركة (تطابق ${Math.round(best * 100)}% والمطلوب ${Math.round(NAME_MATCH_RATIO * 100)}%).`));
    }
  }

  // ----- (د) الحداثة
  {
    const parsed = dateStr ? parseReceiptDate(dateStr) : null;
    if (!dateStr) checks.push(chk("تاريخ العملية", false, "لم يُقرأ تاريخ العملية من الإيصال."));
    else if (!parsed) checks.push(chk("تاريخ العملية", false, `تعذّر فهم تاريخ الإيصال («${String(dateStr).slice(0, 30)}»).`));
    else if (parsed.hijri) checks.push(chk("تاريخ العملية", false, "تاريخ الإيصال هجري؛ لا نحوّله آلياً، يلزم تدقيق بشري."));
    else {
      const age = (now.getTime() - parsed.date.getTime()) / DAY_MS;
      const nb = expected.notBefore ? new Date(expected.notBefore) : null;
      if (age > MAX_RECEIPT_AGE_DAYS) checks.push(chk("تاريخ العملية", false, `الإيصال قديم: مضى على العملية ${Math.floor(age)} يوماً والحد ${MAX_RECEIPT_AGE_DAYS} أيام.`, "reject"));
      else if (age < -MAX_FUTURE_SKEW_DAYS) checks.push(chk("تاريخ العملية", false, "تاريخ الإيصال في المستقبل؛ إما حوالة مجدولة لم تُنفَّذ أو إيصال غير صحيح."));
      else if (nb && !isNaN(nb) && parsed.date.getTime() < nb.getTime() - DAY_MS) checks.push(chk("تاريخ العملية", false, "تاريخ الإيصال أسبق من تاريخ الطلب، فلا يمكن أن يكون دفعاً له.", "reject"));
      else checks.push(chk("تاريخ العملية", true, `تاريخ العملية حديث (قبل ${Math.max(0, Math.floor(age))} يوماً).`));
    }
  }

  // ----- (هـ) عدم التكرار
  const fp = { hash: String(fileHash || ""), reference: normReference(reference) };
  {
    const me = String(expected.requestRef || "");
    const others = (Array.isArray(seen) ? seen : []).filter((s) => s && String(s.requestRef || "") !== me);
    const byHash = fp.hash && others.find((s) => s.hash && s.hash === fp.hash);
    const byRef = fp.reference && others.find((s) => normReference(s.reference) === fp.reference);
    if (byHash) checks.push(chk("عدم تكرار الإيصال", false, `هذا الملف نفسه سبق رفعه على طلب آخر (${byHash.requestRef || "غير معروف"}).`, "reject"));
    else if (byRef) checks.push(chk("عدم تكرار الإيصال", false, `رقم المرجع نفسه سبق ظهوره على طلب آخر (${byRef.requestRef || "غير معروف"}).`, "reject"));
    else if (!fp.hash && !fp.reference) checks.push(chk("عدم تكرار الإيصال", false, "لا بصمة للملف ولا رقم مرجع، فلا يمكن التأكد أن الإيصال لم يُستعمل من قبل."));
    else checks.push(chk("عدم تكرار الإيصال", true, "لم يُستعمل هذا الإيصال على طلب آخر."));
  }

  // ----- اتساق القراءة: حين يتوفر النص الخام والحقول معاً يجب ألا يتناقضا. الحقول يُنتجها
  // نموذج يقرأ ملفاً هو مُدخَل العميل (قد يحمل نصاً موجَّهاً للنموذج)؛ النص الخام من
  // Document Intelligence مصدر مستقل نقارن به.
  if (hasText && hasFields) {
    const problems = [];
    if (Number.isFinite(fAmount) && textAmount.labeled && textAmount.value != null && Math.abs(fAmount - textAmount.value) > AMOUNT_TOLERANCE_SAR) {
      problems.push(`المبلغ المقروء ${fAmount} يخالف المبلغ المكتوب في النص ${textAmount.value}`);
    }
    if (ibanField && isSaudiIban(ibanField) && ibansInText.length && !ibansInText.includes(normalizeIban(ibanField))) {
      problems.push("آيبان المستفيد المقروء غير موجود في نص الإيصال");
    }
    checks.push(problems.length
      ? chk("اتساق القراءة", false, `قراءة الإيصال متناقضة: ${problems.join("، ")}. يلزم تدقيق بشري.`)
      : chk("اتساق القراءة", true, "الحقول المقروءة تتسق مع نص الإيصال."));
  }

  // ----- المرجع المقترح (معلومة لا حاجز): ذكر رقم الطلب في ملاحظة الحوالة يسهّل الربط.
  if (expected.referenceHint) {
    const hint = normReference(expected.referenceHint) || String(expected.referenceHint).toUpperCase().replace(/[^A-Z0-9]/g, "");
    const hayRef = (latinDigits(raw + " " + (f.note || "") + " " + reference)).toUpperCase().replace(/[^A-Z0-9]/g, "");
    const found = hint && hayRef.includes(hint);
    checks.push({ name: "رقم الطلب في الحوالة", ok: !!found, severity: "info", detail: found ? "رقم الطلب مذكور في بيانات الحوالة." : "رقم الطلب غير مذكور في بيانات الحوالة (لا يمنع القبول)." });
  }

  // ----- الحكم
  const failed = checks.filter((c) => !c.ok && c.severity !== "info");
  const verdict = failed.some((c) => c.severity === "reject") ? "reject" : failed.length ? "review" : "match";
  const reasons = failed.map((c) => c.detail);

  const customerMessage =
    verdict === "match"
      ? "استلمنا إيصال الحوالة وبياناته مطابقة لحساب الشركة والمبلغ المطلوب. نؤكّد لك وصول المبلغ بعد مطابقته مع كشف الحساب البنكي."
      : verdict === "reject"
        ? `لم نستطع قبول هذا الإيصال: ${reasons[0] || "بياناته لا تصلح"}. يُرجى رفع إيصال الحوالة الصحيح، أو التواصل معنا إن كنت تظن أن في الأمر خطأ.`
        : "استلمنا إيصالك ويراجعه فريقنا الآن للتأكد من بياناته. لا يلزمك فعل شيء، وسنبلغك فور تأكيد وصول المبلغ.";
  const teamNote =
    verdict === "match"
      ? "الفحوص كلها نجحت (إيصال حوالة، المبلغ، آيبان واسم المستفيد، التاريخ، عدم التكرار). ما زال لازماً تأكيد وصول المال من كشف الحساب."
      : `${verdict === "reject" ? "مرفوض آلياً" : "يحتاج مراجعة بشرية"}: ${reasons.join(" · ")}`;

  return { verdict, checks, reasons, customerMessage, teamNote, extracted, fingerprint: fp };
}

/**
 * طلب القراءة المقترح لـreadDocumentRaw: يُضيف الآيبان والحالة إلى ما يطلبه المسار
 * القائم (amount,currency,date,sender,beneficiary,bank,reference,is_receipt).
 */
export const RECEIPT_READ_PROMPT = [
  "هذا إيصال/إشعار تحويل بنكي. أعِد JSON فقط بلا أي نص آخر بالمفاتيح:",
  '{"amount":number|null,"currency":string|null,"date":string|null,"sender":string|null,',
  '"beneficiary":string|null,"iban":string|null,"bank":string|null,"reference":string|null,',
  '"status":"executed"|"pending"|"failed"|"unknown","is_receipt":boolean}',
  "amount هو المبلغ المحوَّل بالأرقام بلا فواصل. beneficiary اسم المستفيد المحوَّل إليه كما هو مكتوب حرفياً.",
  "iban هو آيبان المستفيد (المحوَّل إليه) لا المرسل، كما هو مكتوب. date تاريخ العملية كما هو مكتوب.",
  "status executed إن ذُكر نجاح التنفيذ، pending إن كانت معلّقة/مجدولة، failed إن فشلت.",
  "is_receipt=false إن لم يكن المستند إيصال حوالة بنكية. إن لم تجد قيمة ضعها null. لا تخمّن أي رقم.",
].join(" ");

/**
 * الوصلة مع مسار الحوالة في السلة (api/_bank-transfer.js ← verifyTransfer):
 * تقرأ الإيصال بالمطالبة المشتركة وبقراءة نصٍّ مستقلة (Azure Document Intelligence)،
 * ثم تمرّرهما إلى verifyTransferReceipt. تُرجع null حين تتعذّر القراءة (لا مفاتيح،
 * أو ردٌّ غير مفهوم)، فيعود المنادي إلى القراءة المشتركة ومقارنته الصارمة بدل أن
 * يموت المسار. «match» هنا لا تعني أن المال وصل؛ هي إيصال سليم ومطابق فقط.
 */
export function makeCheckReceipt({ readRaw = readDocumentRaw, readText = readDocumentText } = {}) {
  return async function checkReceipt({ base64, mime, expected = {}, seen = [] } = {}) {
    let raw = null;
    try { raw = await readRaw(base64, mime, RECEIPT_READ_PROMPT, 600); } catch { raw = null; }
    if (!raw || !raw.ok) return null;
    const fields = parseJson(String(raw.data || ""));
    if (!fields || typeof fields !== "object") return null;
    let txt = null;
    try { txt = await readText(base64, mime); } catch { txt = null; }
    const out = verifyTransferReceipt({
      text: txt && txt.ok ? txt.text : "",
      fields,
      fileHash: receiptFileHash(base64),
      seen,
      expected: {
        amount: expected.amount, currency: "SAR", iban: expected.iban,
        beneficiaryName: expected.names, requestRef: expected.orderRef, referenceHint: expected.orderRef,
      },
    });
    const match = out.verdict === "match";
    // هل قرأ Document Intelligence نص الإيصال فعلاً؟ (2026-10-23، فحص الأمان) بدونه ما عندنا هو حقول كتبها
    // نموذج قرأ ملف العميل نفسه؛ فيُصرَّح هنا بوجود القراءة المستقلة ولا يُعتمد المنادي «match» دونها.
    const text = txt && txt.ok ? String(txt.text || "") : "";
    return {
      verdict: match ? "match" : "review",
      read: fields,
      reasons: match ? [] : ["checker_review"],
      checks: out.checks,
      provider: raw.provider || "receipt-check",
      teamNote: out.teamNote,
      independentText: text.trim().length >= 40,
      text,
    };
  };
}
export const checkReceipt = makeCheckReceipt();
