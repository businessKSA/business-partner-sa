// Business Partner — حوالة بنكية من السلة: بيانات الحساب، ومقارنة الإيصال، وسلّم القرار.
//
// أمر المالك 2026-10-23 أعاد التحويل البنكي مع رفع الإيصال إلى /checkout بعد أن
// أُزيل بقرار 2026-09-24. هذه الوحدة **لا تمسّ المال**: تقرأ بيانات الحساب، وتقارن
// ما قرأه المستشار من الإيصال بما يجب أن يكون، وتقول «مطابق» أو «يراجعه إنسان»
// وسبب المراجعة. من يعتمد الدفع ويُصدر الفاتورة هو api/pay.js بعد قولها.
//
// بيانات الحساب لا تُكتب هنا ولا في الاختبارات: مصدرها الوحيد `BANK` في
// api/_identity.js (ملف site/data/site.json، وتعلوه متغيّرات البيئة
// BP_BANK_BENEFICIARY · BP_BANK_NAME · BP_BANK_IBAN). بلا مستفيد وآيبان لا يُفعَّل
// الخيار، ولا يُرسم حسابٌ من خيال.
//
// نقطة التوصيل مع وكيل المستندات (document-ai): ملف `api/_receipt-check.js`
// بتصدير `checkReceipt(input)` — إن وُجد يُستدعى أولاً (انظر verifyTransfer). وإن لم
// يوجد، أو رمى، أو أعاد شكلاً غير مفهوم، تُستعمل القراءة المشتركة في api/_simple.js
// (`readTransferReceipt`) والمقارنة الصارمة هنا. الوحدة تحمل `_` فلا تُحسب دالة.
import crypto from "node:crypto";
import { BANK } from "./_identity.js";
import { DEV } from "./_mode.js";

export const SAR = "SAR";

// ---------------------------------------------------------------- الحساب --
const normIbanStr = (s) => String(s || "").replace(/[\s‎‏‪-‮-]/g, "").toUpperCase();
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export function latinDigits(s) {
  return String(s == null ? "" : s).replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/٫/g, ".").replace(/٬/g, ",");
}

// ما يُعرض للدافع (عام بطبيعته: هذا حساب الشركة الذي يُحوَّل إليه) — أو null/disabled.
export function bankDetails(src = BANK) {
  const iban = normIbanStr(src.iban);
  const beneficiary = String(src.beneficiary || "").trim();
  const ok = !!beneficiary && /^[A-Z]{2}[0-9A-Z]{13,32}$/.test(iban);
  return {
    enabled: ok,
    beneficiary, beneficiaryEn: String(src.beneficiaryEn || "").trim(),
    bank: String(src.bank || "").trim(), bankEn: String(src.bankEn || "").trim(),
    iban: ok ? iban : "",
    currency: SAR,
  };
}
// الأسماء المقبولة للمستفيد في الإيصال: بالعربية والإنجليزية ومرادفات البيئة.
export function acceptedNames(src = BANK, env = process.env) {
  const extra = String(env.BP_BANK_BENEFICIARY_ALIASES || "").split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
  return [src.beneficiary, src.beneficiaryEn, ...extra].map((s) => String(s || "").trim()).filter(Boolean);
}

// ------------------------------------------------------------- مقارنة --
const GENERIC = new Set(["شركة", "مؤسسة", "شركه", "company", "co", "ltd", "limited", "llc", "est", "establishment", "the", "for", "of", "and", "w", "و"]);
export function normName(s) {
  return latinDigits(String(s || "")).toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")               // تشكيل وتطويل
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
    .replace(/[^a-z0-9؀-ۿ\s]/g, " ").replace(/\s+/g, " ").trim();
}
const toks = (s) => normName(s).split(" ").filter((t) => t && !GENERIC.has(t));
// المسافة بين كلمتين مع عدّ تبديل حرفين متجاورين خطأً واحداً («سولشنز» ↔ «سلوشنز»).
function lev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[m][n];
}
const tokSim = (a, b) => (a === b ? 1 : 1 - lev(a, b) / Math.max(a.length, b.length));
// كلمات الاسم المقبول كلها (إلا العامّة) يجب أن تظهر في ما قرأه المستشار بتسامح إملائي
// لكلمةٍ كتبها المصرف بصيغةٍ أخرى («بزنس/بيزنس»، «سلوشنز/سولشنز»).
export function nameMatches(readName, accepted) {
  const got = toks(readName);
  if (!got.length) return { ok: false, score: 0, matched: "" };
  let best = { ok: false, score: 0, matched: "" };
  for (const acc of accepted || []) {
    const want = toks(acc);
    if (!want.length) continue;
    let hit = 0;
    for (const w of want) if (got.some((g) => tokSim(g, w) >= 0.78)) hit++;
    const score = hit / want.length;
    if (score > best.score) best = { ok: score >= 0.99 || (want.length >= 4 && score >= 0.75), score, matched: acc };
  }
  return best;
}

// مبلغٌ بصيغة رقم صرفة فقط: «115» «1,234.50» «690.00 ريال». كل ما سواها يُرفض (null) بدل أن يُقرأ
// بعد حذف ما ليس رقماً: «115/5» كانت 1155 و«1e2» كانت 12 و«1 15» كانت 115.
export function toAmount(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null;
  let t = latinDigits(String(v)).trim();
  t = t.replace(/^(?:sar|sr|ر\.?\s?س|ريال(?:\s*سعودي)?|﷼)\s*/i, "").replace(/\s*(?:sar|sr|ر\.?\s?س|ريال(?:\s*سعودي)?|﷼)$/i, "").trim();
  if (!/^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t.replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}
// تاريخ العملية: ميلادي صريح فقط (2026-10-23 · 23/10/2026) مع وقت اختياري. لا تخمين: هجري أو غامض = null.
// يعيد {date} أو {hijri:true} أو null.
export function parseTransferDate(v) {
  if (v == null || String(v).trim() === "") return null;
  const t = latinDigits(String(v)).trim();
  let y, mo, d, m;
  if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?![\d])/.exec(t))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?![\d])/.exec(t))) { d = +m[1]; mo = +m[2]; y = +m[3]; }
  else return null;
  if (y >= 1300 && y < 1600) return { hijri: true };
  if (y < 2000 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d, 12));
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return { date: dt };
}

// أسباب الإحالة إلى مراجعة بشرية — كل سبب بنصٍّ يفهمه العميل والفريق.
export const REASONS = {
  unreadable:           { ar: "تعذّرت قراءة الإيصال آلياً", en: "The receipt could not be read automatically" },
  not_receipt:          { ar: "الملف لا يبدو إيصال حوالة بنكية", en: "The file does not look like a bank-transfer receipt" },
  amount_missing:       { ar: "لم يظهر مبلغ الحوالة في الإيصال", en: "The transferred amount is not visible on the receipt" },
  amount_short:         { ar: "المبلغ في الإيصال أقل من إجمالي الطلب", en: "The receipt amount is lower than the order total" },
  amount_over:          { ar: "المبلغ في الإيصال أعلى من إجمالي الطلب", en: "The receipt amount is higher than the order total" },
  currency_mismatch:    { ar: "عملة الحوالة ليست الريال السعودي", en: "The transfer currency is not Saudi riyal" },
  iban_missing:         { ar: "الآيبان غير ظاهر في الإيصال", en: "The IBAN is not visible on the receipt" },
  iban_mismatch:        { ar: "الآيبان في الإيصال لا يطابق حساب الشركة", en: "The IBAN on the receipt does not match the company account" },
  beneficiary_missing:  { ar: "اسم المستفيد غير ظاهر في الإيصال", en: "The beneficiary name is not visible on the receipt" },
  beneficiary_mismatch: { ar: "اسم المستفيد في الإيصال لا يطابق اسم الشركة", en: "The beneficiary on the receipt does not match the company name" },
  date_old:             { ar: "تاريخ الحوالة قديم (أكثر من ١٤ يوماً)", en: "The transfer date is older than 14 days" },
  date_future:          { ar: "تاريخ الحوالة في المستقبل", en: "The transfer date is in the future" },
  duplicate_receipt:    { ar: "هذا الإيصال سبق رفعه على طلبٍ آخر", en: "This receipt was already uploaded for another order" },
  basket_unpriced:      { ar: "بنود الطلب لا تطابق أسعار الكتالوج آلياً", en: "The order lines do not match catalogue prices automatically" },
  checker_review:       { ar: "المدقق الآلي طلب مراجعة بشرية للإيصال", en: "The automatic checker asked for a human review of the receipt" },
  checker_unavailable:  { ar: "خدمة قراءة الإيصالات غير متاحة الآن", en: "The receipt reading service is unavailable right now" },
  settle_failed:        { ar: "تطابق الإيصال لكن تعذّر تسجيل الدفع آلياً", en: "The receipt matched but recording the payment failed" },
  date_missing:         { ar: "تاريخ الحوالة غير ظاهر في الإيصال", en: "The transfer date is not visible on the receipt" },
  date_unclear:         { ar: "تعذّر فهم تاريخ الحوالة في الإيصال (أو هو هجري)", en: "The transfer date on the receipt could not be understood (or is Hijri)" },
  not_executed:         { ar: "الإيصال لا يثبت أن الحوالة نُفِّذت (قد تكون معلّقة أو فاشلة)", en: "The receipt does not show that the transfer was executed" },
  reference_missing:    { ar: "رقم مرجع المصرف غير ظاهر في الإيصال", en: "The bank reference number is not visible on the receipt" },
  no_independent_read:  { ar: "لم تتوفر قراءة نصٍّ مستقلة للإيصال للتأكد منه", en: "No independent text reading of the receipt was available" },
  above_auto_limit:     { ar: "المبلغ يتجاوز حدّ الاعتماد الآلي ({limit} ريال)، فيؤكد فريقنا وصوله من كشف الحساب البنكي قبل الاعتماد", en: "The amount is above the automatic-approval limit ({limit} SAR), so our team confirms it in the bank statement before approving" },
  duplicate_check_unavailable: { ar: "تعذّر التأكد أن الإيصال لم يُستعمل من قبل", en: "We could not confirm this receipt has not been used before" },
};
export const reasonText = (code, lang = "ar", ctx = {}) =>
  String(REASONS[code] ? REASONS[code][lang] || REASONS[code].ar : code).replace(/\{limit\}/g, String(ctx.limit != null ? ctx.limit : autoApproveMaxSar()));

// سقف الاعتماد الآلي بالريال (شاملاً الضريبة): ما فوقه يبقى بانتظار تأكيد إنسان من كشف الحساب مهما تطابق الإيصال.
export function autoApproveMaxSar(env = process.env) {
  const n = Number(String(env.BANK_AUTO_APPROVE_MAX_SAR == null ? "" : env.BANK_AUTO_APPROVE_MAX_SAR).trim());
  return Number.isFinite(n) && n > 0 ? n : 3000;
}

// read   = ما قرأه المستشار {amount,currency,date,sender,beneficiary,bank,reference,iban,is_receipt}
// expect = {amount (ريال شامل الضريبة), iban, names[], orderRef}
// يعيد {verdict:"match"|"review", reasons:[رموز], checks:{…}}. «match» لا تصدر إلا
// إن تحقق المبلغ والآيبان والمستفيد كلها — كل ما سواها يذهب إلى إنسان بسببه.
export function compareReceipt(read, expect, { now = Date.now(), executedByText = false } = {}) {
  const reasons = [];
  if (!read || typeof read !== "object") return { verdict: "review", reasons: ["unreadable"], checks: {} };
  const checks = {};
  if (read.is_receipt === false) reasons.push("not_receipt");

  const amount = toAmount(read.amount);
  const want = Math.round(Number(expect.amount) * 100) / 100;
  if (amount == null) { reasons.push("amount_missing"); checks.amount = { ok: false, read: null, expected: want }; }
  else {
    const diff = Math.round((amount - want) * 100) / 100;
    const ok = Math.abs(diff) < 0.01;
    checks.amount = { ok, read: amount, expected: want, diff };
    if (!ok) reasons.push(diff < 0 ? "amount_short" : "amount_over");
  }
  const cur = String(read.currency || "").trim().toUpperCase();
  checks.currency = { ok: !cur || /^(SAR|SR|RS|ر\.?س|ريال)/i.test(cur), read: cur || null };
  if (!checks.currency.ok) reasons.push("currency_mismatch");

  const wantIban = normIbanStr(expect.iban);
  const gotIban = normIbanStr(read.iban);
  if (!gotIban) { reasons.push("iban_missing"); checks.iban = { ok: false, read: null }; }
  else {
    const ok = !!wantIban && gotIban === wantIban;
    checks.iban = { ok, read: gotIban.length > 8 ? gotIban.slice(0, 4) + "…" + gotIban.slice(-4) : gotIban };
    if (!ok) reasons.push("iban_mismatch");
  }
  const bn = String(read.beneficiary || "").trim();
  if (!bn) { reasons.push("beneficiary_missing"); checks.beneficiary = { ok: false, read: null }; }
  else {
    const m = nameMatches(bn, expect.names || []);
    checks.beneficiary = { ok: m.ok, read: bn.slice(0, 80), score: Math.round(m.score * 100) / 100 };
    if (!m.ok) reasons.push("beneficiary_mismatch");
  }
  // التاريخ إلزامي وصريح: إيصالٌ بلا تاريخ أو بتاريخ غير مفهوم (أو هجري) لا يُعتمد آلياً.
  const dd = parseTransferDate(read.date);
  if (read.date == null || String(read.date).trim() === "") { reasons.push("date_missing"); checks.date = { ok: false, read: null }; }
  else if (!dd || dd.hijri) { reasons.push("date_unclear"); checks.date = { ok: false, read: String(read.date).slice(0, 20) }; }
  else {
    const age = (now - dd.date.getTime()) / 864e5;
    checks.date = { ok: age <= 14 && age >= -1.5, read: String(read.date).slice(0, 20) };
    if (age > 14) reasons.push("date_old"); else if (age < -1.5) reasons.push("date_future");
  }
  // حالة التنفيذ: «executed» صراحةً، أو أن النص المستقل أثبت نجاح العملية ولم يقل القارئ العكس.
  const st = String(read.status == null ? "" : read.status).trim().toLowerCase();
  const executed = st === "executed" || (executedByText && !["pending", "failed", "cancelled", "canceled", "scheduled", "rejected"].includes(st));
  checks.status = { ok: executed, read: st || null };
  if (!executed) reasons.push("not_executed");
  // رقم مرجع المصرف إلزامي للاعتماد الآلي: هو مفتاح منع تكرار الإيصال على طلبٍ آخر مهما تغيّرت الصورة.
  const bref = refKey(read.reference);
  checks.bankReference = { ok: !!bref };
  if (!bref) reasons.push("reference_missing");
  const refTxt = latinDigits(`${read.reference || ""} ${read.notes || ""}`).toUpperCase();
  checks.reference = { matched: !!expect.orderRef && refTxt.includes(String(expect.orderRef).toUpperCase()) };
  return { verdict: reasons.length ? "review" : "match", reasons: [...new Set(reasons)], checks };
}

// --------------------------------------------------------- وضع التطوير --
// محلياً (DEV) لا مفتاح ذكاء اصطناعي، فلا قراءة حقيقية. اسم الملف يختار النتيجة،
// لأرى كل حالة في المتصفح: demo-match · demo-short · demo-over · demo-iban ·
// demo-name · demo-unreadable · demo-notreceipt. لا أثر له خارج DEV.
export function demoRead(fileName, expect) {
  if (!DEV) return null;
  const m = /demo-(match|short|over|iban|name|unreadable|notreceipt)/i.exec(String(fileName || ""));
  if (!m) return null;
  const kind = m[1].toLowerCase();
  if (kind === "unreadable") return { ok: false, read: null, provider: "demo" };
  const today = new Date().toISOString().slice(0, 10);
  const base = {
    amount: expect.amount, currency: "SAR", date: today, sender: "DEMO PAYER",
    beneficiary: (expect.names && expect.names[0]) || "", bank: "DEMO BANK", reference: expect.orderRef || null,
    iban: expect.iban, status: "executed", is_receipt: true,
  };
  if (kind === "short") base.amount = Math.max(1, Math.round((expect.amount - 50) * 100) / 100);
  if (kind === "over") base.amount = Math.round((expect.amount + 50) * 100) / 100;
  if (kind === "iban") base.iban = "SA0000000000000000DEMO00";
  if (kind === "name") base.beneficiary = "DEMO OTHER COMPANY";
  if (kind === "notreceipt") base.is_receipt = false;
  return { ok: true, read: base, provider: "demo" };
}

// ------------------------------------------------------ التحقق (نقطة التوصيل) --
// input: {base64, mime, name, expected:{amount, iban, names[], bank, orderRef}}
// reader: القراءة المشتركة (readTransferReceipt من api/_simple.js) تُمرَّر من المنسّق.
// يعيد {verdict, reasons, checks, read, provider, source:"checker"|"reader"|"demo", fingerprints:{text}}.
//
// يفشل مغلقاً: «match» لا تصدر إلا إذا قرأ المدقق **نص الإيصال قراءةً مستقلة** (Document Intelligence)
// — الحقول وحدها يكتبها نموذج قرأ ملفاً من مُدخَل العميل (قد يحمل نصاً موجَّهاً إليه) فلا تكفي. وكذلك
// لا match بلا تاريخ مفهوم وحالة تنفيذ ثابتة ورقم مرجع مصرفي (انظر compareReceipt). والقراءة المشتركة
// وحدها (حين يتعذّر المدقق) تنتهي دائماً بمراجعة بشرية، إلا في وضع التطوير التجريبي (demo-*).
let checkerOverride = null;
export function __setCheckerForTest(fn) { checkerOverride = fn || null; }
export async function verifyTransfer(input, reader, { importer } = {}) {
  const expected = input.expected;
  // 1) وكيل المستندات: نقطة التوصيل `api/_receipt-check.js` → checkReceipt.
  // حرفيٌّ عمداً: تتبّع ملفات الدوال (nft) لا يرى استيراداً مبنياً بنص، فيسقط الملف من الحزمة.
  const load = importer || (checkerOverride ? async () => ({ checkReceipt: checkerOverride }) : () => import("./_receipt-check.js"));
  let mod = null;
  try { mod = await load(); } catch { mod = null; }
  const fn = mod && (mod.checkReceipt || (mod.default && mod.default.checkReceipt) || (typeof mod.default === "function" ? mod.default : null));
  if (typeof fn === "function") {
    try {
      const r = await fn({ base64: input.base64, mime: input.mime, name: input.name, expected });
      if (r && typeof r === "object" && (r.verdict || r.read)) {
        const read = r.read && typeof r.read === "object" ? r.read : null;
        const independent = r.independentText === true;
        const executedByText = independent && Array.isArray(r.checks) && r.checks.some((c) => c && c.name === "تنفيذ الحوالة" && c.ok === true);
        const mine = read ? compareReceipt(read, expected, { executedByText }) : null;
        // موافقة الوكيل وموافقتنا معاً: لا يُعتمد مبلغ بكلمة طرفٍ واحد.
        const theirsOk = r.verdict === "match" || r.verdict === "ok" || r.ok === true;
        const reasons = new Set([...(mine ? mine.reasons : []), ...(Array.isArray(r.reasons) ? r.reasons.map((x) => String(x && x.code ? x.code : x)) : [])]);
        if (!independent) reasons.add("no_independent_read");
        const known = [...reasons].filter((c) => REASONS[c]);
        if (!mine && !theirsOk && !known.length) known.push("unreadable");
        const match = theirsOk && !!mine && mine.verdict === "match" && independent && !known.length;
        return {
          verdict: match ? "match" : "review", reasons: known, checks: mine ? mine.checks : {}, read,
          provider: String(r.provider || "receipt-check").slice(0, 40), source: "checker",
          fingerprints: { text: independent ? textFingerprint(r.text) : "" },
        };
      }
    } catch (e) { console.error("receipt-check failed", String((e && e.message) || e).slice(0, 120)); }
  }
  // 2) القراءة المشتركة (نفس آلة «إيصال تحويل مرفوع» في api/_simple.js).
  let got = demoRead(input.name, expected);
  const demo = !!got;
  if (!got) {
    try { got = await reader(input.base64, input.mime); } catch (e) { console.error("receipt read", String((e && e.message) || e).slice(0, 120)); got = null; }
  }
  if (!got || !got.ok || !got.read) {
    return { verdict: "review", reasons: [got && got.error === "unavailable" ? "checker_unavailable" : "unreadable"], checks: {}, read: null, provider: (got && got.provider) || "", source: demo ? "demo" : "reader", fingerprints: { text: "" } };
  }
  const c = compareReceipt(got.read, expected, { executedByText: false });
  if (demo) return { ...c, read: got.read, provider: got.provider || "", source: "demo", fingerprints: { text: "" } };
  // قراءة مشتركة بلا نصٍّ مستقل: لا اعتماد آلي أبداً.
  const reasons = [...new Set([...c.reasons, "no_independent_read"])];
  return { verdict: "review", reasons, checks: c.checks, read: got.read, provider: got.provider || "", source: "reader", fingerprints: { text: "" } };
}

// --------------------------------------------------------- ملف الإيصال --
export const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

// بصمة المحتوى لا بصمة البايتات: إضافة بايت أو تعليق أو بيانات وصفية لا تغيّرها. تُحسب على ما يرسم
// الصورة فعلاً (قطع PNG الحرجة · مقاطع JPEG بلا APPn/COM وما بعد EOI · قطع WebP الصورية) وعلى جسم PDF
// حتى أول %%EOF. وما لا يُفهم يُبصَم بايتاً بايتاً (يبقى رقم المرجع والنص مفتاحَي التكرار).
function pngCore(buf) {
  if (buf.length < 20 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  const h = crypto.createHash("sha256"); h.update("png:");
  let o = 8, idat = false;
  while (o + 12 <= buf.length) {
    const len = buf.readUInt32BE(o), type = buf.toString("latin1", o + 4, o + 8), end = o + 12 + len;
    if (end > buf.length) return null;
    if (type === "IHDR" || type === "PLTE" || type === "IDAT" || type === "tRNS") { h.update(type); h.update(buf.subarray(o + 8, o + 8 + len)); if (type === "IDAT") idat = true; }
    if (type === "IEND") return idat ? h.digest("hex") : null;
    o = end;
  }
  return null;
}
function jpegCore(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  const h = crypto.createHash("sha256"); h.update("jpg:");
  let o = 2, scans = 0;
  while (o + 1 < buf.length) {
    if (buf[o] !== 0xff) return null;
    let m = buf[o + 1];
    while (m === 0xff && o + 2 < buf.length) { o++; m = buf[o + 1]; }
    if (m === 0xd9) return scans ? h.digest("hex") : null;
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { o += 2; continue; }
    if (o + 4 > buf.length) return null;
    const len = buf.readUInt16BE(o + 2);
    if (len < 2 || o + 2 + len > buf.length) return null;
    if (!((m >= 0xe0 && m <= 0xef) || m === 0xfe)) h.update(buf.subarray(o, o + 2 + len));
    o += 2 + len;
    if (m === 0xda) {
      const start = o;
      while (o < buf.length) {
        if (buf[o] === 0xff) { const n = buf[o + 1]; if (n === 0x00 || (n >= 0xd0 && n <= 0xd7)) { o += 2; continue; } if (n === 0xff) { o++; continue; } break; }
        o++;
      }
      h.update(buf.subarray(start, o)); scans++;
    }
  }
  return null;
}
function webpCore(buf) {
  if (buf.length < 16 || buf.toString("latin1", 0, 4) !== "RIFF" || buf.toString("latin1", 8, 12) !== "WEBP") return null;
  const h = crypto.createHash("sha256"); h.update("webp:");
  let o = 12, img = false;
  while (o + 8 <= buf.length) {
    const type = buf.toString("latin1", o, o + 4), len = buf.readUInt32LE(o + 4), end = o + 8 + len + (len & 1);
    if (o + 8 + len > buf.length) return null;
    if (["VP8 ", "VP8L", "VP8X", "ALPH", "ANIM", "ANMF"].includes(type)) { h.update(type); h.update(buf.subarray(o + 8, o + 8 + len)); if (type !== "VP8X" && type !== "ANIM") img = true; }
    o = end;
  }
  return img ? h.digest("hex") : null;
}
function pdfCore(buf) {
  const s = buf.toString("latin1"), i = s.indexOf("%PDF");
  if (i < 0) return null;
  const j = s.indexOf("%%EOF", i);
  const h = crypto.createHash("sha256"); h.update("pdf:");
  h.update(buf.subarray(i, j < 0 ? buf.length : j + 5));
  return h.digest("hex");
}
export function normalizedFileHash(buf, mime) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf || "");
  const m = String(mime || "").toLowerCase();
  let core = null;
  try {
    if (/png/.test(m) || (b[0] === 0x89 && b[1] === 0x50)) core = pngCore(b);
    if (!core && (/jpe?g/.test(m) || (b[0] === 0xff && b[1] === 0xd8))) core = jpegCore(b);
    if (!core && (/webp/.test(m) || b.toString("latin1", 8, 12) === "WEBP")) core = webpCore(b);
    if (!core && (/pdf/.test(m) || b.subarray(0, 1024).includes("%PDF"))) core = pdfCore(b);
  } catch { core = null; }
  return core || sha256(b);
}
// بصمة النص المستقل (Document Intelligence): تتجاوز إعادة تصوير الإيصال أو ضغطه. أقل من ٤٠ حرفاً لا تُعتدّ.
export function textFingerprint(text) {
  const t = latinDigits(String(text || "")).toLowerCase().replace(/[^a-z0-9؀-ۿ]/g, "");
  return t.length >= 40 ? sha256(Buffer.from(t, "utf8")) : "";
}
// رقم مرجع المصرف بصيغة مقارنة: أحرف وأرقام كبيرة فقط، ٦ خانات فأكثر وإلا فلا مرجع.
export function refKey(ref) {
  const v = latinDigits(String(ref == null ? "" : ref)).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return v.length >= 6 ? v : "";
}
// مفاتيح التكرار الثلاثة بصيغة مفاتيح الجدول bank_receipt_keys (انظر db/migrations/2026-10-bank-receipt-keys.sql).
export function receiptKeys({ fileHash, textHash, reference }) {
  const out = [];
  if (fileHash) out.push("f:" + fileHash);
  if (textHash) out.push("t:" + textHash);
  const r = refKey(reference);
  if (r) out.push("r:" + r);
  return out;
}

// عنوان IP الموثوق: آخر قيمة في x-forwarded-for هي ما أضافه وكيلنا الأقرب (لا يكتبها العميل)؛ أولاها يكتبها العميل
// كما يشاء. بلا الترويسة: عنوان المقبس.
export function trustedIp(req) {
  const xf = String((req && req.headers && req.headers["x-forwarded-for"]) || "").split(",").map((x) => x.trim()).filter(Boolean);
  return xf.length ? xf[xf.length - 1] : String((req && req.socket && req.socket.remoteAddress) || "local");
}

// ------------------------------------------------------ رمز اعتماد الفريق --
// اعتماد حوالةٍ يدوياً يمرّ من وظيفة /api/requests (لوحة العمليات) إلى /api/pay
// حيث تعيش التسوية والفاتورة. الرمز يثبت أن المنادي هو الخادم نفسه بعد أن تحقق من
// مفتاح اللوحة، لا متصفحٌ يدّعي.
const secret = () => String(process.env.OTP_SECRET || "").trim();
const b64u = (b) => Buffer.from(b).toString("base64url");
export function signBankToken(payload) {
  const s = secret();
  if (!s) return "";
  const body = b64u(JSON.stringify({ ...payload, at: Date.now() }));
  return body + "." + crypto.createHmac("sha256", s).update("bank-approve|" + body).digest("base64url");
}
export function readBankToken(token, maxAgeMs = 10 * 60 * 1000) {
  const s = secret();
  const [body, sig] = String(token || "").split(".");
  if (!s || !body || !sig) return null;
  const want = crypto.createHmac("sha256", s).update("bank-approve|" + body).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(want);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return Date.now() - Number(p.at || 0) < maxAgeMs ? p : null;
  } catch { return null; }
}

// ---------------------------------------------------------------- فرملة --
// سرعةٌ تردع سكربتاً على نسخةٍ واحدة، لا حصة (انظر نظيرتها في api/_simple.js).
const hits = new Map();
export function throttle(key, max, windowMs, now = Date.now()) {
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { hits.set(key, arr); return false; }
  arr.push(now); hits.set(key, arr);
  if (hits.size > 4000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > windowMs) hits.delete(k);
  return true;
}
