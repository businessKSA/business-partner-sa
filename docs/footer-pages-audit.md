# تدقيق صفحات التذييل — footer-pages (2026-10-16)

الفحص على بناء كامل (`VERCEL=1 npm run build`) للعربية والإنجليزية. «SV1 كامل» = `body.sv1-page` بلا `main.js` ولا `bp-public-brand-v5`.

| الصفحة | التصميم | وجهة أزرار الرحلة | ما يلزم | المالك |
|---|---|---|---|---|
| `/catalog` كل الخدمات | **SV1 كامل** | `/cart` · `/consultation` · المحادثة | لا شيء | catalog-content |
| `/packages` الباقات | ~~نصف جديد~~ ← **SV1 كامل (هذه الدفعة)** | كان `/account` (مرّتان) ← `/cart` · `/consultation` · `/my` | يُربط في `generate.mjs` (انظر الأسفل) | شكل: footer-pages · بنود: packages |
| `/ai-agents` المستشارون الأذكياء | ~~مختلف~~ ← **SV1 كامل (هذه الدفعة)** | كان `/account?view=docagent` ومرساة `/#bp-consultant` (غير موجودة في الرئيسية الجديدة) ← `/cart` · `/consultation` · `/#advisor` | قسم المستشار في `/my` (انظر الاعتماديات) | شكل: footer-pages · محتوى: smart-advisors |
| `/knowledge-center` | **SV1 كامل** | `/consultation` · `/catalog` · الأدلة | لا شيء | public-site |
| `/about` | نصف جديد (`bp-public-brand-v5` + `main.js`) | `/consultation` · `/services` | نقل إلى SV1 | public-site |
| `/contact` | نصف جديد | لا أزرار رحلة (نموذج) | نقل إلى SV1 مع مركز «تواصل» | public-site |
| `/careers` | SV1 لكن يحمّل `main.js` (هجين) | `/jobs/*` · `/employers` · `/job-search-service` | فحص `/employers` (لوحة صاحب العمل القديمة) | recruitment-jobs |
| `/suppliers` | قديم كامل (`<body>` عارٍ + `main.js`) | `/partner-dashboard#login` · `#signup` (صفحة قديمة) | نقل الهبوط إلى SV1 وتحديد وجهة التسجيل | suppliers-partners |
| `/terms` | نصف جديد | لا أزرار | نقل إلى SV1 | public-site |
| `/privacy` · `/accessibility` | **غير موجودتين** في البناء | — | تقرير: الفوتر لا يربطهما اليوم | public-site |

## ما أُنجز
`site/scripts/simple-v1-footer-pages.mjs` (`buildSimpleAiAgents` · `buildSimplePackages`) + `tests/footer-pages-sv1.test.mjs`. السلة بعقد `bp_cart` حرفاً (نفس `simple-v1-catalog.mjs`)، والأسعار من الكتالوج/`site.packages` للمسجّلين فقط، والمفتاح شهري/سنوي يبدّل الـid والمبلغ كما كان.

## ربط البناء — لـplatform-engineer (لم ألمس `generate.mjs`)
الرقعة الجاهزة في `docs/footer-pages-generate.patch`: سطر استيراد بعد استيراد `buildSimpleKnowledge` (~344)، واستبدال `buildAiAgents()` (~11970) و`buildPackages()` (~11979) بنداءي `SIMPLE_V1 ? buildSimple…(SV1, {…}) : القديم`. جُرّبت محلياً وبُني الموقع كاملاً.

## اعتماديات وملاحظات
1. **قسم المستشار في `/my`** (client-portal يملك القشرة، smart-advisors المحتوى): لا يوجد اليوم؛ `NAV` في `simple-v1-my.mjs` بلا «المستشارون». الزرّ ينتهي في السلة ثم الدفع ثم `/my`، والقسم نفسه لم يُبنَ.
2. **مستشار المستندات** كان زرّه `/account?view=docagent` ولا مقابل له في `/my`؛ جعلته «احجز استشارة» + التفاصيل. smart-advisors/document-ai يقرّران مدخل المشترك.
3. صفحات التفاصيل التي تصل إليها بطاقات المستشارين (`/b10x` · `/compliance-agent` · `/smart-employee` · `/connect` · `/shared-services` · `/ai-document-agent`) كلها «نصف جديدة» — لأصحابها.
4. **ترويسة SV1 تفيض ٩px أفقياً على جوال ٣٩٠ بالإنجليزية** (زرّ «Start your request») في كل صفحات SV1 بما فيها `/catalog`؛ قبل دفعتي. القشرة لـplatform-engineer.
5. ضجيج البناء (site/jobs · magazine/print · n8n/wa-menu-data.js) أُرجع قبل الكوميت.
