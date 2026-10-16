// يكتب docs/service-journeys/audit.md وneeds-verification.md من المبني ومن بيانات الرحلة.
// الاستعمال: node docs/service-journeys/tools/report.mjs   (بعد npm run build)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const A = JSON.parse(execFileSync("node", [path.join(ROOT, "docs/service-journeys/tools/audit.mjs")], { encoding: "utf8", maxBuffer: 1 << 26 }));
const cat = JSON.parse(fs.readFileSync(path.join(ROOT, "site/assets/data/catalog.json"), "utf8"));
const DIR = path.join(ROOT, "site/data/service-journeys");
const J = cat.services.map((s) => JSON.parse(fs.readFileSync(path.join(DIR, s.code.toLowerCase() + ".json"), "utf8")));
const n = (x) => String(x).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
const row = (k, c, label) => { const v = A.summary[k][c]; return v === "n/a" ? "— (لا ينطبق)" : `${v.pass} نجح · ${v.fail} فشل`; };
const reasons = (k, c) => Object.entries(A.failing[k][c] || {}).map(([w, v]) => `  - ${w}: ${v.count} صفحة (مثال: ${v.sample.slice(0, 4).join("، ")})`).join("\n") || "  - لا شيء";

const md = `# تدقيق رحلة الخدمات والباقات — ${A.generatedAt}

مولَّد بـ\`node docs/service-journeys/tools/report.mjs\` من الصفحات المبنية في \`site/\` (بعد \`npm run build\`) وليس من الذاكرة.
قراءة فقط: لم يُنشر شيء ولم تتغيّر صفحة ظاهرة للزائر في هذه الدفعة.
ما لم يُتحقَّق منه من مصدر رسمي موسوم «بحاجة تحقق» ولا يُدّعى صحته (المواقع الحكومية تحجب الاتصال من السحابة).

## النطاق
${A.services} خدمة × ٤ لغات (ar · en · fr · zh) = ${A.summary.service.pages} صفحة · ٩ تصنيفات × ٤ = ${A.summary.category.pages} صفحة · صفحة الباقات (${A.packagesInCatalog} باقة في الكتالوج) × ٤ لغات.
لُغات ru ko ja hi es لا صفحات خدمات لها أصلاً (انظر \`docs/service-journey-matrix-2026-10-10.md\` البند ١٣).

## المعايير الخمسة — الأرقام

| المعيار | صفحات الخدمات (${A.summary.service.pages}) | صفحات التصنيف (${A.summary.category.pages}) | الباقات (٤ لغات) |
|---|---|---|---|
| ١ التصميم SV1 كاملاً | ${row("service", "c1")} | ${row("category", "c1")} | ${row("packages", "c1")} |
| ٢ الربط بالسلة والتفاصيل | ${row("service", "c2")} | ${row("category", "c2")} | ${row("packages", "c2")} |
| ٣ اكتمال الرحلة (خطوات: من ينفّذ + مدة + حالة) | ${row("service", "c3")} | ${row("category", "c3")} | ${row("packages", "c3")} |
| ٤ المستندات + الجهة + المدة + الرسوم الحكومية منفصلة | ${row("service", "c4")} | ${row("category", "c4")} | ${row("packages", "c4")} |
| ٥ المصدر (رابط رسمي + تاريخ تحقق) | ${row("service", "c5")} | ${row("category", "c5")} | ${row("packages", "c5")} |

### أسباب الفشل
**المعيار ١ — الباقات:**
${reasons("packages", "c1")}

**المعيار ٣ — الخدمات:**
${reasons("service", "c3")}

**المعيار ٤ — الخدمات** (الأعداد بالصفحات؛ اقسمها على ٤ للخدمات):
${reasons("service", "c4")}

**المعيار ٥ — الخدمات:** ${reasons("service", "c5").trim()}
(الآن: ملف رحلة لكل خدمة موجود في \`site/data/service-journeys/\` لكن كل ادّعاء فيه «بحاجة تحقق»، فلا صفحة تنجح — وهذا الصحيح إلى أن يُقرأ المصدر.)

## أرقام تجارية من الكتالوج
- مسعّرة بسلة مباشرة فقط: ${A.commercial.pricedOnly} · مسعّرة **و** \`requiresProposal\`: ${A.commercial.pricedAndRequiresProposal} (تُباع بسلة مباشرة وتتجاوز النطاق — قرار المالك، البند ٤ في تدقيق 2026-10-10) · بلا سعر: ${A.commercial.unpriced}.
- بجهة حكومية في الكتالوج: ${A.commercial.withGovAuthority} · علامة «الرسوم الحكومية منفصلة»: ${A.commercial.govFeesSeparateFlag}.
- بمستندات مخصّصة في \`site.json\`: ${A.commercial.withCuratedDocuments} من ${A.services} · بمدة: ${A.commercial.withDuration} من ${A.services}.

## التحقق بالمتصفح (Chromium على devserver محلي، LOCAL_DB=1)
٤٠ خدمة عيّنة طبقية (٤ من كل تصنيف + كل نمط: سلة فقط، سلة+عرض، بلا سعر، عقار، سياحة، شهرية) × ar/en × سطح مكتب ١٢٨٠ وجوال ٣٩٠ = ١٦٠ زيارة، + ٩ تصنيفات + الباقات = ٢٠٠ زيارة:
- ٢٠٠ استجابة 200، **صفر** أخطاء JavaScript/console، **صفر** تمرير أفقي، والخدمات والتصنيفات كلها \`body.sv1-page\`.
- زرّ «أضف إلى السلة» في ١٣٢ زيارة: كل ضغطة كتبت \`bp_cart\` بالمعرّف \`svc-<slug>\` والمبلغ الصحيح.
- الباقات (٤ زيارات) تعمل بلا أخطاء لكنها **ليست SV1**.
- اللقطات: \`docs/service-journeys/shots/\` (خدمة · تصنيف · باقات × ar/en × desktop/mobile).

## ما وُجد (مرتّباً بالأثر)
1. **صفحة الباقات على التصميم القديم** (\`body.bp-public-brand-v5\` + \`main.js\`، وعنوان إنجليزي «PACKAGES» وسط صفحة عربية): تفشل المعيار ١ في ٤ لغات. باني الصفحة \`buildPackages\` في \`site/scripts/generate.mjs\` — ليس ضمن نطاقي (مالكه \`packages\` وقشرته \`platform-engineer\`).
2. **لا رحلة في أي صفحة** (المعيار ٣): ليس في الصفحة خطوات ولا من ينفّذ كل خطوة ولا حالة ما بعد الشراء. القالب جاهز الآن لعرضها، لكنها لا تُعرض إلا بعد توثيق المصدر (البند ٥).
3. **لا مصدر لأي معلومة حكومية** (المعيار ٥): أُنشئت البنية \`site/data/service-journeys/<code>.json\` ووُسمت كل المعلومات «بحاجة تحقق». قائمة ما يلزم قراءته: \`docs/service-journeys/needs-verification.md\`.
4. **${A.commercial.withDuration < A.services ? A.services - A.commercial.withDuration : 0} خدمة بلا مدة و${n(J.filter((j) => j.documents.generic).length)} خدمة بمستندات عامة**: تُصحَّح في \`site/data/site.json\` (overrides) — مالكه \`catalog-content\`.
5. **مسار السلة ينقطع بعد الدفع** (من تدقيق 2026-10-10 البند ٣، لم أعد فحصه هنا): لا طلب في \`/my\` لمن يشتري بسلة. لذلك **لا أكتب في الصفحة أن الطلب «يظهر في /my» لخدمات السلة** حتى يُصلَح (\`api/pay.js\` · \`api/requests.js\` — \`client-portal\`/\`owner-ops\`/\`cart-checkout\`).
6. **قرار تجاري للمالك:** ${A.commercial.pricedAndRequiresProposal} خدمة تُباع بسلة مباشرة وهي \`requiresProposal\`.
7. **سليم:** \`?about=\` في «احجز استشارة» صار يُقرأ في \`/consultation\` (البند ٨ القديم)، وكل روابط الصفحات تُحَل.

## ما تغيّر في هذه الدفعة (بلا أثر ظاهر للزائر)
- \`site/scripts/simple-v1-service-detail.mjs\`: قراءة ملف الرحلة وعرض «خطوات الطلب» ومصدرها وتاريخ التحقق **لخطوة موثّقة فقط** (status=verified + https + تاريخ). لا شيء يظهر الآن لأن كل الخطوات فارغة.
- \`site/data/service-journeys/\` (${A.services} ملفاً) + \`docs/service-journeys/schema.md\`.
- أدوات: \`docs/service-journeys/tools/{audit,seed,report}.mjs\` · اختبارات: \`tests/service-journey-*.test.mjs\`.
`;
fs.writeFileSync(path.join(ROOT, "docs/service-journeys/audit.md"), md);

// ---- قائمة التحقق للمالك (Claude in Chrome)، مجمّعة بالجهة
const byAuth = new Map();
for (const j of J) {
  const k = j.authority.platform_ar || "بدون جهة حكومية (عملية داخلية)";
  (byAuth.get(k) || byAuth.set(k, []).get(k)).push(j);
}
let nv = `# ما يحتاج تحققاً حكومياً — لقراءته عبر Claude in Chrome عند المالك

كل معلومة هنا **غير موثّقة** (status=needs_verification). لكل خدمة تحتاج من المصدر الرسمي:
الجهة والمنصة الصحيحة، المستندات المطلوبة، المدة، وهل الرسوم الحكومية منفصلة (ومبلغها لا نكتبه هنا).
أرسل لنا: الرابط الرسمي + تاريخ القراءة، فتُسجَّل في \`site/data/service-journeys/<code>.json\` ثم تُعرض الخطوات.
المرتّب: الجهات الأكثر خدمات أولاً (قراءة صفحة واحدة تغطّي عدة خدمات).

| الجهة (كما في الكتالوج) | عدد الخدمات | الخدمات | بلا مدة | مستندات عامة |
|---|---|---|---|---|
`;
for (const [k, list] of [...byAuth].sort((a, b) => b[1].length - a[1].length))
  nv += `| ${k} | ${n(list.length)} | ${list.map((j) => j.code).join("، ")} | ${n(list.filter((j) => !j.duration.value_ar).length)} | ${n(list.filter((j) => j.documents.generic).length)} |\n`;
fs.writeFileSync(path.join(ROOT, "docs/service-journeys/needs-verification.md"), nv);
console.log("written audit.md + needs-verification.md");
