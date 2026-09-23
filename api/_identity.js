// Business Partner — من نحن رسمياً، في مكان واحد.
//
// الاسم في السجل التجاري والرقم الموحد والرقم الضريبي واسم الحساب البنكي
// وآيبانه: كلها في `site/data/site.json` (`legal` و`bank`)، وهي نفسها التي
// يطبعها تذييل الموقع.
//
// وُجد هذا الملف لأن الاسم كان مكتوباً بيد في ثلاثة مواضع على الأقل، وافترقت:
// التذييل يقول اسماً، والبريد الذي يطلب من العميل التحويل يقول اسماً آخر
// («شركة بيزنس بارتنر» بدل «شركة بزنس بارتنر سلوشنز»). واسم مستفيد لا يطابق
// سجل البنك تحويلٌ يُرفض — يكتشفه العميل عند الصرّاف لا عندنا.
//
// متغيّرات البيئة تعلو على الملف حيث تُضبط، فالنشرة تستطيع التصحيح بلا كوميت.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

function siteData() {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    return JSON.parse(readFileSync(join(here, "..", "site", "data", "site.json"), "utf8"));
  } catch { return {}; }
}
const S = siteData();
const L = S.legal || {};
const B = S.bank || {};
const env = (k) => String(process.env[k] || "").trim();

// الاسم القانوني كما في السجل التجاري.
export const LEGAL_NAME = env("COMPANY_LEGAL_NAME") || L.name || "";
export const LEGAL_NAME_EN = L.nameEn || "";
export const UNIFIED_NUMBER = (env("COMPANY_UNIFIED_NUMBER") || L.unified || "").replace(/\D/g, "");
export const VAT_NUMBER = (env("COMPANY_VAT_NUMBER") || L.vat || "").replace(/\D/g, "");

// الحساب البنكي كما في خطاب الآيبان. اسم المستفيد بالعربية عمداً: هو ما يطابق
// سجل المصرف، والحوالة تُطابَق بالاسم لا بترجمته.
export const BANK = {
  beneficiary: env("BP_BANK_BENEFICIARY") || B.beneficiary || LEGAL_NAME,
  beneficiaryEn: B.beneficiaryEn || LEGAL_NAME_EN,
  bank: env("BP_BANK_NAME") || B.bankName || "",
  bankEn: B.bankNameEn || "",
  iban: (env("BP_BANK_IBAN") || B.iban || "").replace(/\s/g, "").toUpperCase(),
  account: (B.account || "").replace(/\s/g, ""),
};
