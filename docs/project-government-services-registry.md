# مشروع: الخدمات الحكومية — إدارة المنصات (Government Services / Platform Management)

> سجلّ المشروع + جرد الصفحات، مستخرَج من هذه المحادثة والكود الفعلي (2026-09-23).
> مرجع الهوية: https://www.businesspartner.sa/ar — توثيق فقط، بلا نشر ولا حذف.
> **تنبيه:** «الوكلاء» أدناه **هيكل مقترح** للتنظيم، وليسوا أنظمة مبنية تعمل الآن.

---

## 1. هوية هذه المحادثة (المصدر)

هذه المحادثة موضوعها الحقيقي **ليس صفحة واحدة**، بل عملان:
1. **استراتيجية وتموضع خط «إدارة المنصات الحكومية»** (تحليل AstroLabs، عرض 999 ريال، المنافسون تعامُد/تنفيذ/احترافيون، SEO، البيع) — المحتوى الغالب.
2. **تخطيط بنية Azure** (جرد + خطة نقل) — خيط منفصل يجب أن يكون محادثة مستقلة.

**القرار:** هذه المحادثة = **ARCHIVED SOURCE CHAT** لمشروع «الخدمات الحكومية». تُستخرج منها المعرفة ثم يُكمَل العمل في محادثات مشروع منظمة.

---

## 2. تعريف المشروع

- **Project Name:** الخدمات الحكومية — إدارة المنصات (Government Services / Platform Management)
- **Project Purpose:** إدارة قوى + التأمينات + مقيم/أبشر + مدد نيابة عن المنشآت باشتراك شهري (999 ريال + مدد 199)، مع تموضع «شريك إدارة منصاتك الحكومية».
- **Project Owner Agent (مقترح):** Government Services — Project Manager
- **Department:** Operations / Compliance
- **Current Status:** الخدمات موجودة كـ SKUs؛ **التموضع والصفحة البطلة (999) غير موحّدين** — يحتاج إعادة هيكلة.
- **Website Area:** Public (خدمات + باقة) + Client Portal (متابعة) + Admin (تشغيل).
- **Related Systems:** api/requests.js، Supabase، Azure OpenAI (المستشار)، n8n (واتساب).
- **Related Services:** bp-gosi-*, bp-mudad-*, bp-muqeem-*, (قوى)، compliance-agent.

---

## 3. جرد الصفحات المملوكة لهذا المشروع (من الكود)

| Page / Feature | URL (cleanUrls) | Old/New | Status | Responsible Agent (مقترح) |
|---|---|---|---|---|
| خدمات التأمينات | /services/bp-gosi-01..03 | New (Simple V1) | ✅ | Services Agent |
| خدمات مدد | /services/bp-mudad-01..03 | New | ✅ | Services Agent |
| خدمات مقيم | /services/bp-muqeem-01..04 | New | ✅ | Services Agent |
| خدمات قوى | /services/bp-qiwa-* (تحقّق من الـSKU) | New | ⚠️ يُتحقق | Services Agent |
| صفحة الباقات | /packages | New | ⚠️ لا تبرز 999 كبطل | Packages Agent |
| **صفحة «إدارة المنصات 999» البطلة** | — | — | ❌ **مفقودة** | Packages Agent |
| المستشار/الامتثال الذكي | /compliance-agent | New | ✅ | Advisor Agent |
| دليل المنصات (محتوى) | /guide/* , /government-portals (محتوى) | New | ⚠️ يُتحقق | Content Agent |
| صفحة الخدمات العامة | /services | New | ✅ | Services Agent |
| بوابة العميل (متابعة الطلب) | /portal , /dashboard | Mixed | ⚠️ | Portal Agent |
| تشغيل داخلي | /admin , /monitor | Internal | ⚠️ مخفي | Ops Agent |

> URL للحيّ لم يُفحص من المتصفح؛ الحالة مبنية على الكود. ما لا أتأكد منه أكتب «يُتحقق».

---

## 4. الصفحات القديمة والمكرّرة (أدلة فعلية)

**تصميم قديم (Old) موجود بالتوازي:**
- `classic-home.html`، `checkout-classic.html`، `consultation-classic.html`، `simple-v1.html`
- **القرار:** ARCHIVE أو Redirect إلى النسخة الجديدة (بعد التأكد أنها غير مستخدمة).

**بوابات/لوحات متعددة (خطر ازدواج):**
`admin`, `dashboard`, `portal`, `partner-dashboard`, `employer-dashboard`, `agency-portal`, `agencies-admin`, `doc-agent-admin`, `jobsearch-admin`, `suppliers-admin`, `monitor`, `employer-login`.
- كثير منها لمشاريع أخرى (توظيف/موردين)، لكن **يجب أن يملك كلٌّ مشروعًا واحدًا**. لمشروعنا: `portal`/`dashboard` (عميل) + `admin`/`monitor` (تشغيل).

**ازدواج نشر مؤكد:** `bp-quotes` مشروع Vercel منفصل عبر rewrite (موثّق سابقًا) → MERGE ثم حذف.

---

## 5. رحلة المستخدم لهذا المشروع + نقاط الانقطاع

`الرئيسية → صفحة إدارة المنصات (999) → طلب اشتراك → تسجيل دخول → بوابة العميل → دفع → متابعة`

**نقاط الانقطاع (Broken Connections):**
| Issue | Fix | Owner (مقترح) | Priority |
|---|---|---|---|
| لا صفحة بطلة لـ«إدارة المنصات 999» | إنشاؤها وربطها من الرئيسية والباقات | Packages Agent | **P0** |
| تموضع الموقع الحيّ (تأسيس) ≠ هوية 999 | توحيد الرسالة حول إدارة المنصات | Project Manager | **P0** |
| صفحات قديمة (classic-*) حيّة | Redirect/Archive | Public Website Agent | P1 |
| ازدواج bp-quotes | دمج ثم حذف | Integration Agent | P1 |
| تعدد بوابات بلا مالك واضح | تعيين مالك لكل بوابة | Portal Agent | P2 |

---

## 6. Keep / Move / Merge / Archive / Rebuild

- **KEEP:** خدمات bp-gosi/mudad/muqeem (تصميم جديد يعمل)، compliance-agent.
- **MOVE:** أي صفحة خدمة ما زالت على قالب قديم → قالب Simple V1.
- **MERGE:** bp-quotes → الموقع الرئيسي؛ البوابات المكررة → بوابة عميل واحدة.
- **ARCHIVE:** classic-home، checkout-classic، consultation-classic (بعد تأكيد عدم الاستخدام).
- **REBUILD:** صفحة «إدارة المنصات 999» (غير موجودة) تُبنى جديدة.

---

## 7. هيكل الوكلاء المقترح (أقل عدد عملي)

```
Government Services — Project Manager
├── Public Website Agent   (الصفحات العامة + القديمة)
├── Services Agent         (bp-gosi / mudad / muqeem / qiwa)
├── Packages Agent         (باقة 999 + مدد + التسعير المدرّج)
├── Portal Agent           (بوابة العميل + المتابعة)
├── Content Agent          (SEO: رسوم قوى، حل حظر مقيم...)
└── Integration Agent      (دمج bp-quotes + API)
```
كل صفحة → **مالك واحد** كما في الجدول أعلاه. لا وكيلين لنفس الصفحة.

---

## 8. Top 5 Immediate Fixes

1. **P0 — بناء صفحة «إدارة المنصات 999» البطلة** وربطها بالرئيسية والباقات.
2. **P0 — توحيد التموضع** على الموقع الحيّ حول إدارة المنصات (لا التأسيس).
3. **P1 — Redirect/Archive** صفحات `classic-*` القديمة.
4. **P1 — دمج bp-quotes** في الموقع الرئيسي ثم حذف المشروع من Vercel.
5. **P2 — تعيين مالك واحد** لكل بوابة/لوحة وإزالة المكرر.

---

## 9. تقسيم المحادثات المقترح (Restructure)

1. **Government Services — Project Manager** (إدارة الخط كاملًا)
2. **Government Services — Website & Packages** (صفحة 999 + توحيد التصميم)
3. **Government Services — Content/SEO** (المقالات المستهدفة)
4. **Infrastructure — Azure Migration** (فصل خيط Azure عن هذا المشروع)
