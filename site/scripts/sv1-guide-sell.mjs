// Business Partner — البيع بين السطور في أدلة «مركز المعرفة» (Simple V1).
//
// قرار المالك (2026-09-24) على نمط AstroLabs: الدليل لا يبيع بلافتات، بل يربط
// المصطلح داخل الجملة بخدمته — «السجل التجاري» في نصّ الدليل رابطٌ إلى خدمة إصدار
// السجل — وصندوق «خلّ التنفيذ علينا» في منتصف الصفحة لا في آخرها فقط.
//
// كل رابط هنا يشير إلى صفحة خدمة موجودة (site/ar/services/<sku>.html)؛ رمزٌ حُذف
// من site/data/services.json يُسقَط عند البناء بدل أن يصير رابطاً مكسوراً.
//
// قواعد الربط:
// - المصطلح يُربط مرة واحدة في الصفحة كلها (أول ظهور)، وسطرٌ واحد لا يحمل أكثر من
//   رابطين — ما يزيد يحوّل الدليل إلى قائمة روابط فيفقد ثقة القارئ.
// - المطابقة العربية على حدود الكلمة، مع السوابق و/ب/ل/ف/ك: «قوى» لا تُطابق
//   داخل «أقوى». والإنجليزية بـ \b.
// - النص يصل مهرَّباً (esc) فلا وسوم فيه؛ الرابط يُبنى حول المصطلح المطابق فقط.

import fs from "node:fs";
import path from "node:path";

// رموز الخدمات التي تُبنى لها صفحة فعلاً — من مصدرها site/data/services.json.
const SERVICE_CODES = new Set(
  JSON.parse(fs.readFileSync(path.resolve("site/data/services.json"), "utf8"))
    .map((x) => String(x.code || "").toLowerCase()),
);

// «مدد» و«مقيم» وحدهما كلمتان عاديتان أيضاً (جمع مدّة، ومقيم ضريبياً) فلا
// تُطابقان عاريتين؛ «منصة مقيم» و«حماية الأجور» لا لبس فيهما.
const TERMS = [
  { sku: "bp-sbc-02", ar: ["السجل التجاري"], en: ["Commercial Registration", "commercial registration"] },
  { sku: "bp-fi-02", ar: ["ترخيص الاستثمار", "ترخيص استثمار", "رخصة استثمار", "رخصة الاستثمار"], en: ["MISA license", "MISA licence", "investment license"] },
  { sku: "bp-fi-08", ar: ["المقر الإقليمي"], en: ["Regional Headquarters", "RHQ"] },
  { sku: "bp-pr-01", ar: ["الإقامة المميزة"], en: ["Premium Residency"] },
  { sku: "bp-muqeem-03", ar: ["تجديد الإقامة"], en: ["Iqama renewal"] },
  { sku: "bp-qiwa-02", ar: ["نقل الكفالة", "نقل كفالة"], en: ["sponsorship transfer", "sponsorship-transfer"] },
  { sku: "bp-rec-02", ar: ["تأشيرة عمل", "تأشيرات العمل"], en: ["work visa", "work visas"] },
  { sku: "bp-muqeem-01", ar: ["تأشيرة خروج وعودة"], en: ["exit/re-entry visa", "exit re-entry visa"] },
  { sku: "bp-qiwa-01", ar: ["قوى"], en: ["Qiwa"] },
  { sku: "bp-pl-0035", ar: ["منصة مقيم"], en: ["Muqeem"] },
  { sku: "bp-gosi-01", ar: ["التأمينات الاجتماعية"], en: ["GOSI"] },
  { sku: "bp-mudad-01", ar: ["حماية الأجور"], en: ["Wage Protection System", "Mudad"] },
  { sku: "bp-subl-01", ar: ["العنوان الوطني"], en: ["National Address", "national address"] },
  { sku: "bp-zatca-04", ar: ["ضريبة القيمة المضافة"], en: ["VAT"] },
  { sku: "bp-zatca-03", ar: ["إقرار الزكاة"], en: ["Zakat return"] },
  { sku: "bp-balady-01", ar: ["بلدي", "الرخصة البلدية"], en: ["Balady", "municipal license"] },
  { sku: "bp-pl-0051", ar: ["حساب بنكي", "الحساب البنكي"], en: ["bank account"] },
  { sku: "bp-rec-01", ar: ["الاستقدام"], en: ["recruitment"] },
  { sku: "bp-qiwa-08", ar: ["شهادة السعودة", "شهادة التوطين"], en: ["Saudization certificate"] },
];

const MID = {
  h: { ar: "تبي نتولّى هذا عنك؟", en: "Want us to handle this for you?" },
  p: {
    ar: "كل خطوة في هذا الدليل خدمةٌ ننجزها لك من البداية للنهاية — وتتابعها من حسابك. قل لنا وش تحتاج، ونرسل لك النطاق وعرض السعر.",
    en: "Every step in this guide is a service we complete for you end to end — tracked from your account. Tell us what you need and we'll send the scope and a quote.",
  },
  start: { ar: "ابدأ طلبك", en: "Start your request" },
  consult: { ar: "احجز استشارة مجانية", en: "Book a free consultation" },
};

const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
// قبل المصطلح: بداية، أو فاصل، أو سابقة عربية ملتصقة بعد فاصل. بعده: نهاية أو فاصل.
const AR_BEFORE = `(^|[\\s(«"'،,.:؛—–/]|(?:^|[\\s(«])[وبلفك])`;
const AR_AFTER = `(?=$|[\\s)»"'،,.:؛—–/])`;

export function sellKit({ lang, u, esc, exists = (sku) => SERVICE_CODES.has(sku) }) {
  const isAr = lang === "ar";
  const pick = (e) => (e[lang] != null ? e[lang] : e.en);
  const used = new Set();
  const rules = [];
  for (const term of TERMS) {
    if (!exists(term.sku)) continue;
    const words = isAr ? term.ar : term.en;
    for (const w of words) {
      const re = isAr
        ? new RegExp(AR_BEFORE + "(" + reEsc(w) + ")" + AR_AFTER)
        : new RegExp("(^|\\b|\\W)(" + reEsc(w) + ")(?=\\b|$)");
      rules.push({ sku: term.sku, re });
    }
  }

  function link(text) {
    let out = text, n = 0;
    for (const r of rules) {
      if (n >= 2) break;
      if (used.has(r.sku)) continue;
      const m = r.re.exec(out);
      if (!m) continue;
      // لا نربط داخل رابطٍ أُدرج للتوّ في السطر نفسه.
      const at = m.index + m[1].length;
      const before = out.slice(0, at);
      if ((before.match(/<a /g) || []).length > (before.match(/<\/a>/g) || []).length) continue;
      out = before + `<a class="sv1-in" href="${esc(u("/services/" + r.sku))}">${m[2]}</a>` + out.slice(at + m[2].length);
      used.add(r.sku);
      n++;
    }
    return out;
  }

  const css = `<style id="sv1-sell-css">
.sv1-gd-sec a.sv1-in{color:var(--ac);text-decoration:underline;text-decoration-color:var(--acLine);text-underline-offset:3px;text-decoration-thickness:1.5px}
.sv1-gd-sec a.sv1-in:hover{text-decoration-color:var(--ac)}
.sv1-gd-cta{display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;background:var(--n);border-radius:14px;padding:22px 24px;margin:0 0 14px}
.sv1-gd-cta h2{color:#fff;font-size:19px;font-weight:300;margin:0 0 4px}
.sv1-gd-cta p{color:rgba(255,255,255,.75);font-size:13.5px;line-height:1.8;margin:0;max-width:600px}
.sv1-gd-cta .acts{display:flex;gap:8px;flex-wrap:wrap}
.sv1-gd-cta .sv1-btn{background:#fff;color:var(--n);border-color:#fff}
.sv1-gd-cta .sv1-btn.ghost{background:transparent;color:#fff;border-color:rgba(255,255,255,.45)}
</style>`;

  const mid = `<div class="sv1-gd-cta"><div><h2>${esc(pick(MID.h))}</h2><p>${esc(pick(MID.p))}</p></div>
    <div class="acts"><a class="sv1-btn" href="${esc(u("/"))}">${esc(pick(MID.start))}</a><a class="sv1-btn ghost" href="${esc(u("/consultation"))}">${esc(pick(MID.consult))}</a></div></div>`;

  // صندوق «خلّ التنفيذ علينا» بعد القسم الثاني (أو الأول إن لم يكن غيره).
  function withMid(sectionHtmlList) {
    const list = sectionHtmlList.slice();
    list.splice(Math.min(2, list.length), 0, mid);
    return list.join("");
  }

  return { link, css, withMid };
}
