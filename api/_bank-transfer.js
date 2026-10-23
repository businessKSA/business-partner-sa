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
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
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

export function toAmount(v) {
  if (v == null || v === "") return null;
  const s = latinDigits(String(v)).replace(/[,،\s]/g, "").replace(/[^\d.\-]/g, "");
  if (!/\d/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}
function toDate(v) {
  if (!v) return null;
  const s = latinDigits(String(v)).trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(s);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
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
};
export const reasonText = (code, lang = "ar") => (REASONS[code] ? REASONS[code][lang] || REASONS[code].ar : code);

// read   = ما قرأه المستشار {amount,currency,date,sender,beneficiary,bank,reference,iban,is_receipt}
// expect = {amount (ريال شامل الضريبة), iban, names[], orderRef}
// يعيد {verdict:"match"|"review", reasons:[رموز], checks:{…}}. «match» لا تصدر إلا
// إن تحقق المبلغ والآيبان والمستفيد كلها — كل ما سواها يذهب إلى إنسان بسببه.
export function compareReceipt(read, expect, { now = Date.now() } = {}) {
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
  const d = toDate(read.date);
  if (d) {
    const age = (now - d.getTime()) / 864e5;
    checks.date = { ok: age <= 14 && age >= -1.5, read: String(read.date).slice(0, 20) };
    if (age > 14) reasons.push("date_old"); else if (age < -1.5) reasons.push("date_future");
  }
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
    iban: expect.iban, is_receipt: true,
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
// يعيد {verdict, reasons, checks, read, provider, source:"checker"|"reader"|"demo"}.
export async function verifyTransfer(input, reader, { importer } = {}) {
  const expected = input.expected;
  // 1) وكيل المستندات إن بُني: نقطة التوصيل `api/_receipt-check.js` → checkReceipt.
  // حرفيٌّ عمداً: تتبّع ملفات الدوال (nft) لا يرى استيراداً مبنياً بنص، فيسقط الملف من الحزمة.
  const load = importer || (() => import("./_receipt-check.js"));
  let mod = null;
  try { mod = await load(); } catch { mod = null; }
  const fn = mod && (mod.checkReceipt || (mod.default && mod.default.checkReceipt) || (typeof mod.default === "function" ? mod.default : null));
  if (typeof fn === "function") {
    try {
      const r = await fn({ base64: input.base64, mime: input.mime, name: input.name, expected });
      if (r && typeof r === "object" && (r.verdict || r.read)) {
        const read = r.read && typeof r.read === "object" ? r.read : null;
        const mine = read ? compareReceipt(read, expected) : null;
        // موافقة الوكيل وموافقتنا معاً: لا يُعتمد مبلغ بكلمة طرفٍ واحد.
        const theirsOk = r.verdict === "match" || r.verdict === "ok" || r.ok === true;
        const reasons = new Set([...(mine ? mine.reasons : []), ...(Array.isArray(r.reasons) ? r.reasons.map((x) => String(x && x.code ? x.code : x)) : [])]);
        const known = [...reasons].filter((c) => REASONS[c]);
        if (!mine && !theirsOk && !known.length) known.push("unreadable");
        const match = theirsOk && (!mine || mine.verdict === "match") && !known.length;
        return { verdict: match ? "match" : "review", reasons: known, checks: mine ? mine.checks : (r.checks || {}), read, provider: String(r.provider || "receipt-check").slice(0, 40), source: "checker" };
      }
    } catch (e) { console.error("receipt-check failed", String((e && e.message) || e).slice(0, 120)); }
  }
  // 2) القراءة المشتركة (نفس آلة «إيصال تحويل مرفوع» في api/_simple.js).
  let got = demoRead(input.name, expected);
  if (!got) {
    try { got = await reader(input.base64, input.mime); } catch (e) { console.error("receipt read", String((e && e.message) || e).slice(0, 120)); got = null; }
  }
  if (!got || !got.ok || !got.read) {
    return { verdict: "review", reasons: [got && got.error === "unavailable" ? "checker_unavailable" : "unreadable"], checks: {}, read: null, provider: (got && got.provider) || "", source: got && got.provider === "demo" ? "demo" : "reader" };
  }
  const c = compareReceipt(got.read, expected);
  return { ...c, read: got.read, provider: got.provider || "", source: got.provider === "demo" ? "demo" : "reader" };
}

// --------------------------------------------------------- ملف الإيصال --
export const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

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
