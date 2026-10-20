// يولّد (أو يُكمل بلا مسح) site/data/service-journeys/<code>.json لكل خدمة في الكتالوج.
// لا يخترع شيئاً: القيم كلها منقولة مما هو منشور أصلاً (catalog.json و site.json/overrides)،
// ويُوسَم كل ادّعاء حكومي status=needs_verification بلا source_url ولا verified_at
// إلى أن يقرأه المالك من المصدر الرسمي عبر Claude in Chrome ويكتب لنا الرابط والتاريخ.
// الاستعمال: node docs/service-journeys/tools/seed.mjs   (آمن للتكرار: لا يكتب فوق ملف موجود)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "site/assets/data/catalog.json"), "utf8"));
const site = JSON.parse(fs.readFileSync(path.join(ROOT, "site/data/site.json"), "utf8"));
const OUT = path.join(ROOT, "site/data/service-journeys");
fs.mkdirSync(OUT, { recursive: true });

const claim = (extra) => ({ ...extra, source_url: null, verified_at: null, status: "needs_verification" });
let wrote = 0, kept = 0;
for (const s of catalog.services) {
  const slug = s.code.toLowerCase();
  const file = path.join(OUT, slug + ".json");
  if (fs.existsSync(file)) { kept++; continue; }
  const ov = site.overrides[slug] || {};
  const hasAuthority = s.govPlatform && !/بدون جهة/.test(s.govPlatform);
  const doc = {
    schema: 1,
    code: s.code,
    slug,
    // الجهة/المنصة الحكومية كما في الكتالوج (govPlatform) — لم تُتحقَّق من مصدرها.
    authority: hasAuthority ? claim({ platform_ar: s.govPlatform }) : { platform_ar: null, source_url: null, verified_at: null, status: "not_applicable" },
    // المدة كما في site.json (overrides.duration) — لا مدة تُخترع حيث لا قيمة.
    duration: claim({ value_ar: ov.duration || null, value_en: ov.durationEn || null }),
    // المستندات كما في site.json؛ generic=true تعني أن الصفحة تعرض البنود العامة الثلاثة الافتراضية.
    documents: claim({ generic: !(ov.documents || ov.documentsEn), items_ar: ov.documents || [], items_en: ov.documentsEn || [] }),
    // هل الرسوم الحكومية منفصلة عن أتعابنا؟ (علامة الكتالوج govFeesSeparate)؛ المبلغ لا يُكتب هنا أبداً.
    gov_fees: claim({ separate: !!s.govFeesSeparate }),
    // خطوات الرحلة: لا تُعرض في الصفحة إلا خطوة status=verified (أو actor=bp لعملية داخلية موثّقة).
    // الشكل: { actor: "client"|"bp"|"authority", title_ar, title_en, duration_ar?, duration_en?, status, source_url, verified_at }
    steps: [],
  };
  fs.writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
  wrote++;
}
console.log(`service-journeys: ${wrote} written, ${kept} kept`);
