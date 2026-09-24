# خريطة ملكية الصفحات — كل صفحة لوكيل واحد (2026-09-24)

مصدرها مسحٌ فعلي لكل ملف `.html` مولَّد في `site/` (١٤٩٦ ملفاً = ٣٧١ مساراً
فريداً بعد طيّ اللغات). لا صفحة هنا بلا مالك، ولا صفحة لمالكين. حين يُضاف
مسار جديد يُضاف سطره هنا **في الدفعة نفسها** وإلا فهو الفوضى القادمة.

**قاعدة الحسم** (CLAUDE.md §2.7): الصفحة التي يدخلها **عميل** بحساب → `client-portal`.
التي يدخلها **المالك أو الفريق** → `owner-ops`. مهما كان محتواها. ثم الموضوع.

**الرموز:** ✅ جديد (Simple V1) · 🟡 قديم بالترويسة الموحّدة · ❌ قديم بلا ترويسة
(لوحة لها قشرتها) · 🗄️ نسخة محفوظة `-classic` (مجمّدة، لا تطوير).

---

## 1) `public-site` — الموقع العام والتسويق (وكيل **جديد** — لم يكن لهذه الصفحات مالك)

| المسار | التصميم | ملاحظة |
|---|---|---|
| `/` | ✅ | الرئيسية — ٩ لغات |
| `/about` | 🟡 | من نحن — ٩ لغات |
| `/contact` | 🟡 | تواصل — ٩ لغات |
| `/terms` | 🟡 | الشروط والأحكام |
| `/team/*` (١٢) | 🟡 | صفحات الفريق: baher · abdulaziz · abdulrahman · ahmed · badr · farah · malak · mazen · mishari · mohammed · nasser · strategy |
| `/news` | ✅ | الرؤى والأخبار |
| `/newsletter` | ✅ | النشرة |
| `/saudi-arabia` | ✅ | السوق السعودي |
| `/opportunities` | ✅ | الفرص الاستثمارية — محتوى عام؛ إن صار خدمةً تُباع انتقلت إلى `mahfol` |
| `/classic-home` | 🗄️ | الرئيسية القديمة محفوظة |
| `/simple-v1` | ✅ | صفحة مختبر التصميم — تُحذف حين يكتمل النقل (قرار `platform-engineer`) |

## 2) `catalog-content` — الخدمات والمحتوى الذي يبيع

| المسار | التصميم | ملاحظة |
|---|---|---|
| `/catalog` | ✅ | الكتالوج — باب الشراء |
| `/services` | 🟡 | فهرس الخدمات — ٩ لغات |
| `/services/*` (٢٠٩) | 🟡 | صفحة لكل خدمة بالـSKU — **أكبر كتلة قديمة في الموقع** |
| `/guide/*` (٦) | ✅ | business-setup · company-structure · live-in-saudi · residency · run-your-business · saudi-market |
| `/knowledge-center` | ✅ | مركز المعرفة |
| `/magazine` · `/magazine/*` | ✅ / 🟡 | المجلة — الفهرس جديد ومقالها القديم |
| `/calculators/*` (٦) · `/calculator` · `/tools-and-calculators` | ✅ / 🟡 / ✅ | الحاسبات |
| `/formation-contract` | 🟡 | خدمة: عقد التأسيس بين الشركاء |
| `/estrdad` | 🟡 | خدمة: استرداد الرسوم الحكومية |
| `/workspaces` · `/workspace-request` | 🟡 | المكاتب ومساحات العمل + نموذج الطلب |
| `/tourism` | 🟡 | السياحة والفعاليات |

## 3) `client-portal` — ما يدخله العميل بحساب

| المسار | التصميم | ملاحظة |
|---|---|---|
| `/my` | ✅ | **لوحة العميل المعتمدة** |
| `/account` | ❌ | القديمة — تعمل ولا تُطوَّر، تتقاعد قسماً قسماً |
| `/consultation` | ✅ | حجز الاستشارة |
| `/consultation-classic` | 🗄️ | محفوظة |
| `/connect` | ❌ | «موظفك الذكي — رحلة العميل ومركز الربط» |
| `/portal` | ❌ | بوابة الموظفين الأذكياء — الدخول والقشرة هنا، والمحتوى لـ`smart-advisors` |
| `/partner-dashboard` | 🟡 | لوحة الشريك — يدخلها شريكٌ بحساب |
| `/compliance-dashboard` | ❌ | لوحة الامتثال — الدخول والقشرة هنا، والمحتوى لـ`compliance` |
| `/shared-services/dashboard` | 🟡 | الدخول والقشرة هنا، والمحتوى لـ`shared-services` |

## 4) `owner-ops` — ما يدخله المالك أو الفريق

| المسار | التصميم | ملاحظة |
|---|---|---|
| `/ops` | ✅ | **اللوحة المعتمدة** |
| `/admin` | ❌ | القديمة — تعمل ولا تُطوَّر، تُجرَد ثم تتقاعد |
| `/monitor` | ❌ | BP Inbox |
| `/dashboard` | ❌ | اختبار الوكلاء |
| `/chat` | ❌ | Chat OS — أداة داخلية |
| `/suppliers` · `/suppliers-admin` | 🟡 | تسجيل الشركاء وإدارتهم |
| `/agencies-admin` | 🟡 | إدارة مكاتب الاستقدام — **المالك** يدخلها (قاعدة الحسم) |
| `/jobsearch-admin` | 🟡 | إدارة خدمة البحث عن وظيفة — كذلك |
| `/doc-agent-admin` | ❌ | إدارة مستشار المستندات |

## 5) `quotes-contracts` — العرض والعقد والتوقيع

| المسار | التصميم | ملاحظة |
|---|---|---|
| `/quote` | 🟡 | عرض السعر |
| `/contract` | 🟡 | العقد |
| `/quotes/*` | خارج `site/` | rewrite إلى مشروع `bp-quotes` — **يُنقل ثم يُغلق** بالترتيب المكتوب في تعريف الوكيل |

> كانت `/quote` و`/contract` مسندتين إلى `client-portal` في `docs/projects.md`
> قبل وجود هذا الوكيل. **نُقلتا إليه.** ما يعرضه العميل داخل `/my` من العرض
> والعقد يبقى واجهةً لـ`client-portal`، ومنطق الوثيقة نفسها هنا.

## 6) `recruitment` (المدير) → أربعة متخصصين

| الوكيل | المسار | التصميم |
|---|---|---|
| `recruitment-employer` | `/employers` · `/employer-login` · `/employer-join` · `/employer-dashboard` | 🟡 |
| `recruitment-employer` | `/hr` · `/hr/*` (٢٠ لوحة) | 🟡 / ❌ |
| `recruitment-employer` | `/portal/join` · `/portal/candidates` · `/portal/dashboard` | ❌ (بوابة التوظيف — يدخلها صاحب العمل) |
| `recruitment-candidate` | `/careers` (النموذج) · `/candidate-profile` · `/job-search-service` | 🟡 |
| `recruitment-agencies` | `/recruitment-agencies` · `/agency-portal` | 🟡 |
| `recruitment-jobs` | `/jobs/*` (٣٨) · `/job` · `/hiring` · `/careers` (العرض) | 🟡 / ✅ |

## 7) `automation-agents` — المستشارون الأذكياء كمنتج

| المسار | التصميم | ملاحظة |
|---|---|---|

> جوهر هذه الصفحات هو الودجت والمستشار لا النص، فمالكها من يملك المستشار.
> نصٌّ تسويقي فيها يطلبه `catalog-content`، والودجت والسلوك هنا.

## 8) `mahfol` — محفول مكفول والرحلات

| المسار | التصميم |
|---|---|
| `/mahfol-makfol` · `/mahfol-makfol/trips` | 🟡 |
| `/trips` | ✅ |

## 9) `b10x` — المنتج

| المسار | التصميم | ملاحظة |
|---|---|---|
| `/b10x` | 🟡 | الصفحة الوحيدة — **بلا SKU ولا سعر**، موقوف عند سعر المالك |

## 10) `deals` — منصة الصفقات

| المسار | التصميم | ملاحظة |
|---|---|---|
| `/deals` | 🟡 | «اعرض صفقتك، ابحث عن شريك» — لا نموذج إدخال صفقة. (`brokers` و`referral` بلا صفحات بعد.) |

## 11) وكلاء المنتجات الخمسة (أمر المالك 2026-09-24)

| الوكيل | المسار | التصميم | ملاحظة |
|---|---|---|---|
| `business-development` | `/business-development` · `assets/data/revenue-*.html` (٣) · قسم Revenue OS داخل `/account` | 🟡 / ❌ | الباب الرابع في الرئيسية يُنسَّق مع `public-site` |
| `worker-housing` | `/worker-housing` | 🟡 | `#wh-request` قسم بلا نموذج |
| `farina` | `/farina` | 🟡 | لا نموذج ولا بند كتالوج |
| `document-ai` | `/ai-document-agent` | 🟡 | `/doc-agent-admin` تبقى لـ`owner-ops` قشرةً |
| `compliance` | `/compliance-agent` · محتوى `/compliance-dashboard` · `assets/data/compliance-dashboard.html` | 🟡 / ❌ | القشرة لـ`client-portal` |

## 12) وكلاء الدفعة الثانية (أمر المالك 2026-09-24)

| الوكيل | المسار | التصميم | ملاحظة |
|---|---|---|---|
| `packages` | `/packages` | 🟡 | ٩ لغات · سعران متضاربان بين الموقع وNotion |
| `cart-checkout` | `/cart` · `/checkout` · `/cart-classic` · `/checkout-classic` | ✅ / 🗄️ | السلة والدفع لكل ما يُباع |
| `shared-services` | `/shared-services` · محتوى `/shared-services/dashboard` | 🟡 | القشرة لـ`client-portal` |
| `smart-advisors` | `/ai-agents` · `/smart-employee` · `/task-force` · محتوى `/portal` | 🟡 / ❌ | القشرة لـ`client-portal` |
| `company-data` | `/data` | 🟡 | لا نموذج اشتراك |
| `bank-account` | `/bank-account` | 🟡 | نموذج بلا حقول ولا إرسال |
| `incubators-vc` | `/directory` · `site/data/ecosystem.json` | ✅ | كان لـ`public-site` |
| `brokers` · `referral` · `erp` · `social-media` | — | — | بلا صفحات بعد |
| `advisor` · `baher-support` · `whatsapp` · `email` | — (قنوات) | — | يملكون كوداً لا صفحات: `api/chat.js` · `baher-support.mjs` · `n8n/` |

## 13) `platform-engineer` — لا يملك صفحة، يملك القوالب

لا مسار محتوى له. يملك ما يولّد الصفحات كلها: `generate.mjs` · `simple-v1.mjs`
(القشرة والترويسة والتذييل) · `simplified-global-header.mjs` · الحُرّاس ·
`vercel.json`. صفحةٌ تُطلب فيها **ترويسة أو تذييل أو تصميم** تمرّ به.

---

## الأرقام كما قِيست

| | عدد |
|---|---|
| ملفات مولَّدة | ١٤٩٦ |
| مسارات فريدة | ٣٧١ |
| ✅ على التصميم الجديد | `/` · الكتالوج والسلة والدفع والاستشارة · `/my` · `/ops` · الأدلة الستة · الحاسبات · المعرفة · المجلة · الأخبار · النشرة · الدليل · السعودية · الفرص · الرحلات · `/hiring` |
| 🟡 قديم بالترويسة الموحّدة | الأغلبية — ٢٠٩ خدمة و٣٨ وظيفة و١٢ فريقاً وبقية الصفحات المفردة |
| ❌ لوحات بلا ترويسة | `/account` · `/admin` · `/monitor` · `/dashboard` · `/chat` · `/connect` · `/portal` و`/portal/*` · `/compliance-dashboard` · `/doc-agent-admin` · `/hr/*` |
| لغات | ar · en · fr · zh لكل شيء؛ و es · hi · ja · ko · ru لخمس صفحات فقط (`/` · `/about` · `/contact` · `/services` · `/packages`) |

## ما يحتاج قرار المالك

1. **`/deals`** — وساطة (`broker-referral`) أم سوق عام (`public-site`)؟ أُسند مبدئياً للوساطة.
2. **اللغات الخمس الزائدة** (es · hi · ja · ko · ru) على خمس صفحات فقط: تُكمَل للموقع كله، أم تُحذف؟ خمس صفحات بلغةٍ يبقى زائرها بلا موقع.
