# قائمة قطع n8n من Cloud إلى Azure — بالترتيب، مع التراجع (2026-10-21)

> قرار المالك: n8n كله على Azure ولا شيء على n8n Cloud، وإيقاف الاشتراكات لاحقاً.
> هذه القائمة **تخطيط وأدوات فقط**: لم يُنفَّذ منها شيء، ولم يُلمس Azure ولا n8n Cloud ولا الموقع الحيّ.
> كل خطوة تلمس الإنتاج تُنفَّذ بأمر المالك وبيده، والنشر من الجلسة الرئيسية وحدها (`CLAUDE.md` §0.1).
> الأسباب والتفاصيل الطويلة في [`n8n-azure-cutover-2026-10-16.md`](n8n-azure-cutover-2026-10-16.md)؛ هذه القائمة هي المرجع للترتيب.

## ما الذي تغيّر منذ 2026-10-16

| | قبل | الآن |
|---|---|---|
| عدد السيناريوهات | ١١٩ (نحو ٦٠ نشطاً) | **١٢٤ شغّالاً** بقول المالك — الجرد الحيّ `export --dry-run` هو الحاكم |
| n8n على Azure | «غير مؤكَّد» | **موجود:** التطبيق `bp-n8n` في المجموعة `bp-ai` (swedencentral) مع القاعدة `bp-n8n-pg` |
| الأداة | تصدير/استيراد/تفعيل/إيقاف/تراجع | + `webhooks` (جرد الويبهوكات) + `verify` (يفحص المرحلة ويرفض المجدول المكرّر) + `probe-webhooks` + خريطة الاعتمادات + تقرير محفوظ |
| `deploy.sh` | إنشاء جديد في UAE North | + `adopt-check` · `adopt-pin` · `adopt-harden` لتبنّي القائم |

## المبدأ الحاكم (لا يُكسر)

**لا مجدول في الموضعين.** كل ما هو مؤقّت أو استطلاع أو ردّ نداء (Schedule، Gmail، Notion، WhatsApp Trigger) يعمل في Cloud **أو** في Azure في كل لحظة، لا في الاثنين. الأداة تفرضه: `activate` يرفض ما بقي فعّالاً في المصدر، و`verify` يخرج برمز ٢ إن رأى مجدولاً فعّالاً في الجهتين.
الويبهوكات (مسارها مختلف في الموقعين) آمنة في الاثنين معاً، وتبقى فعّالة في Cloud صمّام تراجع.

## شروط مسبقة (قبل أي خطوة)

| # | الشرط | لماذا | من |
|---|---|---|---|
| ش١ | كوميتات `api/_n8n.js` وتوليد الصفحات بـ`N8N_BASE_URL` **على الفرع الذي يخدم العملاء وقت القطع** | فرع الإنتاج على فيرسل ما زال يكتب العنوان القديم حرفياً في سبعة ملفات `api/` (`book` · `requests` · `_stage` · `_eor` · `candidate` · `chat` · `_aiws`) وفي المولّد. بدونها لا يُغيّر المتغيّر شيئاً. يعني: إما أن يدمجها المدير في فرع الإنتاج بقول «انشر»، وإما أن يقع قطع n8n مع قطع الموقع إلى Azure (فرع `azure-migration` فيه الكود) | المدير |
| ش٢ | `ops/azure/Dockerfile` و`.github/workflows/azure-deploy.yml` يمرّران `N8N_BASE_URL` وقت البناء | صفحات المتصفح (المراقب، لوحات الفريق، الامتثال، التسكين، الخدمات المشتركة) تحمل العنوان داخل HTML؛ بدون هذا تُبنى صورة Azure بعنوان Cloud | `platform-engineer` |
| ش٣ | حارس n8n `site/scripts/n8n-guard.mjs` يطابق مضيف `N8N_BASE_URL` لا `n8n.cloud` فقط | اليوم يمنع `localhost` والمعاينات من إطلاق ويبهوك إنتاجي. بعد التبديل يصير بلا أثر فتُرسل تجارب المطوّرين رسائل حقيقية | `platform-engineer` |
| ش٤ | الموقع لا يُبنى ولا يُنشر بالمتغيّر الجديد إلا بقول المالك «انشر» | `CLAUDE.md` §0 | المالك |

---

## ٠) قرار قبل البدء: تبنّي `bp-n8n` القائم أم إعادة بنائه

من Cloud Shell (قراءة فقط، لا يغيّر شيئاً):
```bash
export BP_RG=bp-ai
bash ops/n8n/azure/deploy.sh adopt-check
```
يطبع: المنطقة، الصورة (مثبّتة أم `latest`)، النسخ الدنيا والقصوى، هل `N8N_ENCRYPTION_KEY` مرجع سرّ، النسخة الجارية، صحة `/healthz`، النطاقات المربوطة، وحالة القاعدة (الحجم، أيام النسخ الاحتياطي). لا يطبع قيمة سرّ.

| ما يظهر | القرار |
|---|---|
| مفتاح التشفير سرٌّ مرجعي، والقاعدة تردّ، والنسخة الجارية **≥ نسخة Cloud** (Help → About n8n) | **تبنٍّ (موصى به)**: لا قاعدة ثانية ولا إعادة اعتمادات. المنطقة swedencentral جوار Azure OpenAI، وهي غير UAE North — قرار المالك إن كانت المنطقة تهمّه |
| مفتاح التشفير غير مضبوط أو قيمة صريحة، أو النسخة **أقدم** من Cloud، أو القاعدة لا تردّ | **إعادة بناء** بالخطوات 1–5 في UAE North باسم جديد (`BP_N8N_APP=bp-n8n-uae`)؛ التطبيق القائم يُترك أو يُحذف بقرار المالك. لا تنقل شيئاً من القائم |
| التطبيق فارغ (لا حساب مالك، لا اعتمادات) | الاثنان سواء؛ التبنّي أسرع |

> ⚠ لا تُنفَّذ الخطوات 2–5 من `deploy.sh` على تطبيق متبنّى: تُنشئ بيئة وKey Vault ومفتاح تشفير جديدين لا يفتحان اعتمادات القاعدة القائمة.

---

## أ) التحضير — لا أثر على العملاء (أيام قبل القطع)

**أ١. ثبّت وقوِّ التطبيق (تبنٍّ فقط)**
```bash
bash ops/n8n/azure/deploy.sh adopt-pin          # يثبّت الصورة على النسخة الجارية (يسأل yes)
bash ops/n8n/azure/deploy.sh adopt-harden       # يضيف الناقص فقط: المنطقة الزمنية، قصّ التنفيذات، $env، نسخة واحدة دائمة (يسأل yes)
bash ops/n8n/azure/deploy.sh adopt-check        # يجب ألا يبقى ✗ إلا ما قررتَه
```
هدفها: نسخة واحدة دائمة (`min=max=1`) لأن المؤقّتات تعمل داخل العملية، وصورة مثبّتة لا تترقّى وحدها.

**أ٢. حساب المالك ومفتاح الواجهة.** افتح عنوان التطبيق وأنشئ حساب المالك فوراً (أول زائر يصير المالك؛ للحصر: `OWNER_IP=<عنوانك> bash deploy.sh 8 lock` ثم `8 unlock` قبل القطع). ثم Settings → n8n API → Create API key، وكذلك في Cloud.

**أ٣. النطاق (موصى به قبل أي ربط خارجي).** `bash deploy.sh 7` يطبع سجلّين لمزوّد النطاق: `CNAME n8n → <fqdn>` و`TXT asuid.n8n → <المعرّف>`. يربط النطاق بالبيئة التي فيها التطبيق فعلاً ويضبط `WEBHOOK_URL`. **اختر النطاق الآن**: تغييره لاحقاً يغيّر كل رابط ويبهوك. الاسم الموصى به: `https://n8n.businesspartner.sa`.

**أ٤. أسرار `$env`.** `bash deploy.sh 6 BP_PANEL_KEY DOC_AGENT_HOOK_KEY` (+ ما يظهر في التقرير). تُسأل بصمت. للتطبيق المتبنّى (بلا هوية مُدارة) تُحفظ أسراراً داخل التطبيق؛ لا قيمة في متغيّرات البيئة.

**أ٥. الجرد والتصدير** (على جهازك؛ المفاتيح في بيئتك فقط ولا تُكتب في ملف):
```bash
export N8N_SRC_URL=https://businesspartnerai.app.n8n.cloud  N8N_SRC_API_KEY=...
export N8N_DST_URL=https://n8n.businesspartner.sa           N8N_DST_API_KEY=...
node ops/n8n/migrate-workflows.mjs export ./n8n-export --dry-run     # العدد الحقيقي والتصنيف — لا يكتب شيئاً
node ops/n8n/migrate-workflows.mjs export ./n8n-export
node ops/n8n/migrate-workflows.mjs webhooks ./n8n-export             # كل ويبهوك وارد: من يناديه وما يُحدَّث عند المزوّد
```
يحفظ في `n8n-export/` (لا يُدفع إلى git): `_report.txt` (ما لا يُنقل تلقائياً — أسماء فقط) و`_webhooks.json` و`_credential-map.template.json`.

**أ٦. أصلح ما في التقرير**
- ⛔ `$vars` (غير موجودة في n8n المجتمعية) ← `$env.NAME` ثم أ٤.
- النداءات إلى `*.vercel.app` (لوحة العروض `bp-quotes-three.vercel.app` في الكتالوج) ← نطاق الموقع على Azure قبل إيقاف Vercel.
- **جداول البيانات (٩):** أنشئها بالأسماء نفسها في Azure، انسخ صفوفها (CSV من الواجهة)، واكتب `map.json` = `{القديم: الجديد}`.
- أي ويبهوك فعّال في `webhooks` بلا «يناديه» (قسم ⚠): اعرف من يناديه قبل القطع.

**أ٧. الاعتمادات (يدوي دائماً — أسرارها لا تُصدَّر).**
1. أضف Redirect URI `https://<مضيف n8n>/rest/oauth2-credential/callback` عند: Google Cloud (Gmail/Calendar/Drive) · تكامل Notion · LinkedIn · Microsoft · تطبيق Meta. **قبل** إنشاء الاعتماد.
2. أنشئ كل اعتماد في Azure **بالاسم والنوع نفسيهما** (القائمة في `_report.txt`). ElevenLabs ومفاتيح Gemini/Groq/OpenAI لا تُنشأ (قاعدة Azure فقط).
3. انسخ `_credential-map.template.json` إلى `n8n-export/credential-map.json` واملأ المعرّف الجديد لكل سطر (يظهر في رابط الاعتماد داخل واجهة Azure). المعرّفات ليست أسراراً. السطور الفارغة تُهمَل.

**أ٨. الاستيراد** (ينشئ كل شيء **غير مفعّل**):
```bash
node ops/n8n/migrate-workflows.mjs import ./n8n-export --dry-run    # بروفة: لا كتابة
node ops/n8n/migrate-workflows.mjs import ./n8n-export --data-table-map=map.json
# بعد إنشاء/تصحيح الاعتمادات: يعيد الربط دون تكرار السيناريوهات
node ops/n8n/migrate-workflows.mjs import ./n8n-export --on-exists=update --data-table-map=map.json
node ops/n8n/migrate-workflows.mjs verify ./n8n-export --phase=prep   # يجب أن يعود ✓ (رمز 0)
```
يلتقط `credential-map.json` من مجلد التصدير تلقائياً ويُبلغ بالاعتمادات التي بلا معرّف.

**أ٩. تجربة الويبهوكات في Azure (المسار آمن لأنه مختلف عن Cloud):**
```bash
node ops/n8n/migrate-workflows.mjs activate ./n8n-export --only=webhook --apply
node ops/n8n/migrate-workflows.mjs probe-webhooks ./n8n-export       # يتأكد أنها مسجَّلة بلا تشغيلها (GET على POST فقط)
node ops/n8n/migrate-workflows.mjs verify ./n8n-export --phase=prep
```
ثم نداء تجريبي لكل مجموعة **برقم المالك لا بعميل** (بعض الويبهوكات مثل `website-lead-notify` ترسل واتساب فعلاً). أول فحص من المتصفح: CORS (الويبهوكات تسمح بكل الأصول اليوم وتنتقل مع السيناريو).
> `probe-webhooks` يعتمد على رسائل 404 في n8n (تتغيّر بين الإصدارات): تحقّق من أول مسار يدوياً قبل الاعتماد على نتيجته.

**علامة اكتمال التحضير:** `verify --phase=prep` أخضر، `probe-webhooks` بلا «غير مسجَّل»، والاختبار اليدوي نجح، ولا ✗ في `adopt-check`.

---

## ب) يوم القطع — نافذة هادئة (خارج الذروة، ويفضّل ليلاً)

كل أمر يمسّ الإنتاج يحتاج `--apply`. نفّذ ب٢ وب٣ **متتاليين** (الفجوة بينهما هي المدة التي لا يعمل فيها أي مجدول).

| # | الخطوة | الأمر / الفعل | علامة النجاح |
|---|---|---|---|
| ب١ | أعلن النافذة، واطلب ألا يُعدَّل شيء في Cloud | أعد التصدير والاستيراد ليلحق ما عُدِّل: `export` ثم `import --on-exists=update --data-table-map=map.json` ثم `verify --phase=prep` | ✓ |
| ب٢ | **أوقف مجدولات Cloud** | `pause-source ./n8n-export --only=stateful --apply` | «أُوقف N · فشل 0» |
| ب٣ | **فعّل مجدولات Azure** | `activate ./n8n-export --only=stateful --apply` — يتحقق من المصدر ويرفض ما بقي فعّالاً هناك. الفاشل = اعتماد ناقص: أنشئه وأعد الأمر نفسه | «فُعِّل N · فشل 0» |
| ب٤ | **تحقّق** | `activate --only=webhook --apply` (إن لم يكتمل أ٩) ثم `verify ./n8n-export --phase=cutover` | ✓ ورمز 0. **أي ⛔ = توقف فوراً ← §ج** |
| ب٥ | **واتساب** (راجع §و) | تحقّق في Meta أن Callback URL صار مضيف Azure، وأرسل رسالة اختبار من هاتف المالك إلى الرقم الرسمي `0530540231` (لا رسالة إلى عميل) | ردّ البوت + تنفيذ جديد في Azure Executions |
| ب٦ | **حوّل من يناديه** (هنا — وبعد ب٤ و ب٥ فقط — يتغيّر `N8N_BASE_URL`) | انظر الجدول أدناه | كل اختبار في ب٨ |
| ب٧ | **الكتالوج** | احذف عقدة Vercel من `vomoBu7MxIY8hTIP`، أنشئ اعتماد GitHub (fine-grained، `Actions: write` على المستودع)، وأكّد اسم ملف سير النشر وفرعه أعلى `catalog-sync.workflow.js`. تبقى `promote: 'false'` | تشغيل يدوي ينشئ مراجعة بلا حركة |
| ب٨ | **الفحص بعد القطع** (بلا نداء حقيقي للعميل) | حجز استشارة اختباري برقم المالك (`website-lead-notify` + التقويم) · تقديم ATS تجريبي (`bp-ats-application`) · محادثة باهر من الموقع · لوحة `/monitor` · نبض الفريق (آخر تنفيذ للموزّع في Azure خلال ٥ دقائق) · غياب أي تنفيذ جديد في Cloud (Executions) | الكل يعمل |

### ب٦ — متى وكيف يتغيّر `N8N_BASE_URL` (والمتغيّرات التابعة)

**التوقيت:** بعد ب٤ (التحقق أخضر) وب٥ (واتساب يردّ من Azure) — لا قبلهما. الويبهوكات في Cloud تبقى فعّالة، فمن لم يتحوّل بعد (صفحة قديمة مفتوحة عند عميل، أو نشرة لم تُبنَ) يظل يصل ولا شيء ينقطع.

| أين | المتغيّر | القيمة | يسري متى |
|---|---|---|---|
| الخادم (Vercel أو Container App للموقع) — وقت التشغيل | `N8N_BASE_URL` | `https://n8n.businesspartner.sa` | بعد إعادة النشر/مراجعة جديدة. المتغيّرات الأخصّ تغلبه إن كانت مضبوطة بالعنوان القديم: `OWNER_WA_WEBHOOK` · `N8N_ATS_WEBHOOK` · `N8N_CANDIDATE_WEBHOOK` · `BP_ATS_WEBHOOK` · `BP_REVENUE_INTAKE_URL` · `LEAD_WEBHOOK_URL` · `DOC_AGENT_SYNC_URL` · `CATALOG_WEBHOOK_URL` — **اعرض قيمها الحالية (أسماء لا أسرار) قبل التبديل** وغيّر ما يحمل `n8n.cloud` |
| بناء الموقع — وقت البناء | `N8N_BASE_URL` (نفسه) | نفسه | **بعد بناء الموقع ونشره** (بأمر المالك). المتصفح يحمل العنوان داخل HTML |
| فريق الوكلاء | `BP_N8N_BASE` (سرّ GitHub `BP_N8N_BASE`) | نفسه | عند إعادة نشر `azure-agents.yml` (+ `BP_N8N_HOOK_KEY` يبقى) |
| ai-space | `AI_SPACE_CONFIG` (سرّ GitHub) | المسارات السرّية على المضيف الجديد | عند إعادة نشر `azure-ai-space.yml` — المسارات لا تُكتب في المستودع |
| جارفس (Artifact المالك + `jarvis-local.html`) | مسارات الويبهوك | تُعاد توليدها | يدوي |

بعد التبديل يجب ألا يبقى `n8n.cloud` في صفحات `site/` المبنيّة: `grep -rl "n8n.cloud" site | wc -l` (يبقى فقط الملف الخام `site/assets/data/compliance-dashboard.html` الذي تستبدله عملية البناء في الصفحة المولَّدة).

---

## ج) التراجع

**نافذة القرار: أول ٢٤ ساعة** (بعدها تتراكم بيانات في جداول Azure لا تنسخ للخلف تلقائياً). **الترتيب ممنوع عكسه** (Azure أولاً ثم Cloud) وإلا تكرّرت الرسائل.

| # | الفعل |
|---|---|
| ج١ | `pause-target ./n8n-export --only=stateful --apply` — أوقف مجدولات Azure |
| ج٢ | `resume-source ./n8n-export --only=stateful --apply` — أعد مجدولات Cloud. **تفعيل WhatsApp Trigger في Cloud يعيد تسجيل Callback عند Meta على Cloud تلقائياً** |
| ج٣ | `verify ./n8n-export --phase=rollback` يجب أن يعود ✓ (وإلا ⛔ تكرار) ثم تحقق في Meta أن المضيف عاد إلى Cloud وأرسل رسالة اختبار |
| ج٤ | أعد `N8N_BASE_URL` (احذفه) و`BP_N8N_BASE` و`AI_SPACE_CONFIG` ثم أعد بناء الموقع ونشره |
| ج٥ | ما كُتب في جداول Azure خلال النافذة يُصدَّر CSV ويُدمج في جداول Cloud يدوياً، أو يُقبل ضياعه إن كانت النافذة قصيرة |

**متى نتراجع:** `verify --phase=cutover` يفشل ولا يُصلَح خلال ١٥ دقيقة · واتساب لا يردّ من Azure · تكرار رسائل لعميل · اعتماد OAuth رئيسي لا يُنشأ. لا نتراجع بسبب فشل سيناريو ثانوي واحد: أنشئ اعتماده وأعد `activate`.

---

## د) بعد القطع: متى يُوقف n8n Cloud

**ليس يوم القطع.** يبقى مُوقَف المجدولات (لا محذوفاً، وويبهوكاته فعّالة) **١٤ يوماً**. ثم يُوقف عند تحقق كل ما يلي:
1. ١٤ يوماً بلا تراجع، وكل المجموعات عملت في Azure دورة كاملة (الأسبوعية: Newsletter، والشهرية إن وُجدت).
2. نسخة احتياطية أخيرة: `export` جديد + صفوف جداول البيانات (CSV)، محفوظان في Azure Blob **خاص** (لا git). ونسخة من `N8N_ENCRYPTION_KEY` الجديد خارج Azure (مدير كلمات المرور عند المالك) — فقدانه = فقدان كل الاعتمادات.
3. لا مرجع باقٍ للعنوان القديم: `grep -rn "n8n.cloud"` في المستودع، وقيم Vercel/Container App/GitHub Secrets، وMeta، والمزوّدون، ونوشن، وResend.
4. `node ops/n8n/migrate-workflows.mjs probe-webhooks` و`webhooks` لا يُظهران ويبهوكاً بلا مستهلك.

ثم: `pause-source ./n8n-export --only=all --apply`، وبعد أسبوع هدوء **يُلغي المالك الاشتراك** عند تاريخ التجديد من لوحة n8n Cloud (قرار مالي — لا يفعله Claude).

**تنظيف الكود بعد الإيقاف** (بعد التأكد، وبأمر المالك): `N8N_LEGACY_BASE` في `api/_n8n.js` يبقى الافتراضي القديم عمداً (لا ينكسر شيء إن غاب المتغيّر). بعد إيقاف Cloud يُغيَّر الافتراضي إلى عنوان Azure وتُستبدل العناوين الحرفية في `site/scripts/assets/monitor.page.html` و`admin.page.html` و`site/assets/data/compliance-dashboard.html` بعلامة تستبدلها `generate.mjs`، ويُحذف الحارس أو يُحوَّل. (`platform-engineer`.)

---

## هـ) الويبهوكات الواردة من الجهة الأخرى — ما يتغيّر وما لا يتغيّر

الأداة تعطيك القائمة الحيّة: `node ops/n8n/migrate-workflows.mjs webhooks ./n8n-export --base=https://n8n.businesspartner.sa`. ما يلي ما يقوله **الكود**؛ الحاكم لوحة كل مزوّد.

| المزوّد | أين يُرسل اليوم | هل يتغيّر بقطع n8n؟ | الفعل |
|---|---|---|---|
| **واتساب (Meta)** — الرقمان `0530540231` (الرسمي) و`0507034157` (الوكيل) | WhatsApp Trigger في n8n (الاستقبال مباشرة عند n8n) | **نعم — الوحيد المرتبط بـn8n** | العقدة تسجّل Callback **بنفسها عند التفعيل**، فتفعيل `stateful` في Azure (ب٣) هو الذي يحوّل الحركة. بعده تحقق في لوحة Meta أن Callback URL = مضيف Azure (الـProduction URL من العقدة هو الحاكم)، ورمز التحقق كما كان. التراجع: تفعيل Cloud (ج٢) يعيدها. **لا يُفعَّل قبل ب٣ أبداً** |
| **مُيسّر** | الموقع مباشرة: `/api/pay` (السرّ `MOYASAR_WEBHOOK_SECRET`) ولوحة العروض `/quotes/api/payments/webhook` (webhook المزوّد) | **لا** — لا يمرّ عبر n8n | يتغيّر فقط عند قطع الموقع من Vercel (إن تغيّر النطاق). لا يُلمس هنا. تأكد في لوحة مُيسّر أن الرابط ليس `*.vercel.app` (دليل القطع ٦) |
| **تمارا** | الموقع/اللوحة: رابط الإشعار `<الموقع>/api/payments/tamara` يُشتقّ من مضيف الطلب عند تسجيله بـ`POST /quotes/api/payments/tamara/probe` (مدير) | **لا** | يُعاد تسجيله **بعد قطع الموقع** من المضيف الجديد (إجراء المدير). لا علاقة بـn8n |
| **DocuSign Connect** | اللوحة: `/api/docusign/webhook` (و`/api/docusign/consent-callback`) | **لا** | يتبدّل مع قطع الموقع فقط؛ المفتاح `DOCUSIGN_CONNECT_HMAC_KEY` يبقى |
| **Resend** (Webhook الارتداد → سير Bounce Handler إن كان موجَّهاً إلى n8n) | غير مؤكَّد من الكود | **ربما** | افحص لوحة Resend؛ إن كان العنوان `n8n.cloud` غيّره بعد ب٤ |
| **Notion** (أتمتة/أزرار تُرسل Webhook) | غير مؤكَّد من الكود | **ربما** | افحص قواعد Tasks · Sales Pipeline · Content Calendar |
| **GitHub** | عقدة الكتالوج تنادي GitHub (صادر)، لا العكس | لا | ب٧ |
| **مزوّدو OAuth** (Google · Notion · LinkedIn · Microsoft · Meta) | Redirect URI لـn8n | **نعم** | أ٧.١ قبل إنشاء الاعتماد. مشروع Google `Gmail N8N` معرّض للإيقاف لعدم وجود وسيلة دفع — راجعه قبل القطع |

> إن أظهر `webhooks` ويبهوكاً فعّالاً اسمه أو مساره يوحي بـDocuSign أو تمارا أو مُيسّر (يعلّمه تحت «عند المزوّد»)، فهذا الثلاثة تبيّن أنها تمرّ بـn8n فعلاً في Cloud (لا يظهر ذلك في الكود)، وتُعامل كواتساب: لا تُحوَّل حتى يكون سيناريوها فعّالاً في Azure، ثم يُحدَّث الرابط عند المزوّد ويُجرَّب برقم/مبلغ اختباري.

---

## و) ما ينقص من المالك (بالأسماء فقط — لا أسرار هنا ولا في المحادثة)

١. **القرار:** تبنّي `bp-n8n` القائم أم إعادة بنائه (بعد `adopt-check`)، وهل تهمّك المنطقة (swedencentral أم UAE North).
٢. **مفتاح n8n API** لـCloud ولـAzure (Settings → n8n API) — يُوضَعان في بيئة جهازك فقط.
٣. **نسخة n8n Cloud** (Help → About n8n) لمقارنتها بالجارية في Azure.
٤. **حساب المالك** على `bp-n8n` إن لم يُنشأ.
٥. **النطاق:** `n8n.businesspartner.sa` (سجلّا DNS: `CNAME n8n` و`TXT asuid.n8n` عند مزوّد النطاق).
٦. **الاعتمادات يدوياً** (القائمة في `_report.txt`) + Redirect URIs عند Google / Notion / LinkedIn / Microsoft / Meta، ثم ملء `credential-map.json`.
٧. **قيم `$env`:** `BP_PANEL_KEY` · `DOC_AGENT_HOOK_KEY` (+ أي اسم يظهر في التقرير).
٨. **صفوف ٩ جداول بيانات** (BP_AI_Deals · BP_AI_Tasks · BP_Agent_Registry · BP_News_Feed · BP_News_Sources …) — موافقتك على نسخها.
٩. **رمز GitHub** (fine-grained، `Actions: write` على هذا المستودع فقط) لعقدة نشر الكتالوج، وبقاء `promote: false`.
١٠. **نافذة القطع** (يوم وساعة) وموافقتك على تحويل Callback واتساب في Meta.
١١. **نسخة احتياطية من `N8N_ENCRYPTION_KEY`** خارج Azure.
١٢. **فحص لوحات:** Resend (Webhook الارتداد) وNotion (أتمتة تُرسل إلى n8n) ومشروع Google «Gmail N8N» (وسيلة الدفع).
١٣. **مدة الإبقاء** قبل إيقاف Cloud (١٤ يوماً مقترحة) وتاريخ تجديد الاشتراك لإلغائه.
١٤. **المدير:** ش١ (إيصال كوميتات `_n8n.js` إلى الفرع الحيّ أو ربط القطع بقطع الموقع)، وش٢ وش٣ عند `platform-engineer`.

---

## ملحق: الجرد (من الكود والوثائق، 2026-10-21)

### ١) كل ما يشير إلى n8n Cloud

**كود تنفيذي ومولّدات (يتغيّر أو يُراجَع عند القطع):**

| الملف:السطر | ما فيه | يُعالَج بـ |
|---|---|---|
| `api/_n8n.js:19` | `N8N_LEGACY_BASE` — الافتراضي الوحيد المقصود في الكود | يبقى (احتياط) حتى إيقاف Cloud |
| `site/scripts/assets/monitor.page.html:297-300` | أربعة ويبهوكات `bp-chat-{monitor,send,suggest,media}-x7k2m9` | `withN8nBase` وقت البناء (`generate.mjs:8929`) |
| `site/scripts/assets/admin.page.html:1092,1100` | رابطان إلى لوحة n8n نفسها | `withN8nBase` (`generate.mjs:8934`) |
| `site/assets/data/compliance-dashboard.html:503,1318` | `bp3-portal-9kq4z` · `client-intake-web` · `05804653-…/chat` | `withN8nBase` (`generate.mjs:12325`) |
| `site/scripts/n8n-guard.mjs:4,19,26` | الحارس يطابق `n8n.cloud` | **ش٣** |
| `ops/n8n/migrate-workflows.mjs:9` · `ops/n8n/README.md:69` · `ops/n8n-migrate.mjs:4` | توثيق/مثال | لا أثر |
| `ai-space/config.example.js:10` | مثال `YOUR-INSTANCE.app.n8n.cloud` | لا أثر (الحقيقي في `AI_SPACE_CONFIG`) |

**صفحات مبنيّة ومتتبَّعة في git** (ناتج `generate.mjs`، تُعاد بالبناء ولا تُحرَّر يدوياً): `site/dashboard.html` · `site/portal.html` · `site/monitor.html` · `site/admin.html` · `site/worker-housing.html` · `site/shared-services/dashboard.html` · `site/ar|fr|zh/…` نظائرها · `site/ar/compliance-dashboard.html` — ١٨ ملفاً. ستتغيّر في فرق الكوميت عند أول بناء بالمتغيّر.

**اختبارات:** `tests/n8n-guard.test.mjs:19,116` · `tests/advisor-prices.test.mjs:41` · `tests/advisor-intake.test.mjs:18` · `tests/vendor-portal.test.mjs:89` · `tests/vendor-offers.test.mjs:87` · `tests/employer-checkout-real.test.mjs:104` (كلها تحاكي الاستدعاء بالعنوان الافتراضي وتبقى صحيحة بلا المتغيّر) · `tests/n8n-migrate.test.mjs`.

**وثائق:** `docs/platform-directory-2026-09-15.md:122,144` · `docs/sales-agent-outreach-architecture.md:54` · `docs/org-chart-2026-09-24.md:12` · `docs/azure-only-2026-10-16.md:20` · `docs/azure-migration-2026-10-11.md:173` · `docs/shared-services-team-architecture.md:36` · `docs/hr-ats-mvp.md:27` · `docs/service-journey-after-order-2026-10-10.md:75` · `docs/service-journey-buy-pay-2026-10-10.md:21` · `docs/n8n-azure-cutover-2026-10-16.md`. (تُحدَّث بعد القطع.)

**لا عنوان حرفي بعد الآن في** `api/*.js` (كلها عبر `api/_n8n.js`) ولا في `site/scripts/generate.mjs` (يقرأ `N8N_BASE_URL`) — على فرع `azure-migration` فقط. على فرع الإنتاج (فيرسل) الحرفي باقٍ في سبعة ملفات (ش١).

### ٢) أين يُقرأ `N8N_BASE_URL`

| الموضع | الملفات | ملاحظة |
|---|---|---|
| وقت التشغيل (الخادم) | `api/book.js:588` · `api/requests.js:124` · `api/_stage.js:41` · `api/_eor.js:48` (`website-lead-notify`) · `api/candidate.js:45` (`bp-ats-application`) · `api/_aiws.js:21` (`bp-ai/revenue-intake`) · `api/chat.js:276` (`f08bf4a4-…/chat` احتياط أخير) | كلها تُقدِّم متغيّرها الأخصّ على الأساس |
| وقت البناء (HTML) | `site/scripts/generate.mjs:17` ثم `:7008` (`client-intake-web`) · `:9020-9022` (٣ نماذج `/form/`) · `:9033` و`:9756` و`:11288` (قاعدة `/webhook`) · `:10073` و`:10635` (`f08bf4a4-…/chat`) | **يلزم إعادة بناء ونشر**؛ وفي Azure يلزم تمريره في بناء الصورة (ش٢) |
| فريق الوكلاء | `agents/azure/tools.mjs:11` (`BP_N8N_BASE` + `BP_N8N_HOOK_KEY`، المسار `bp-agent-send`) · `agents/azure/deploy.sh:58` · `.github/workflows/azure-agents.yml:86` | سرّ GitHub `BP_N8N_BASE` |
| ai-space | `ai-space/config.example.js` ← `AI_SPACE_CONFIG` في `.github/workflows/azure-ai-space.yml` | مسارات سرّية |
| لوحة العروض | `quotes/src/lib/catalog-sync.ts:164` (`CATALOG_WEBHOOK_URL` + `CATALOG_WEBHOOK_TOKEN`) | لا يمرّ بـ`N8N_BASE_URL` |
| مفاتيح أخصّ بلا `N8N_BASE_URL` | `OWNER_WA_WEBHOOK` · `N8N_ATS_WEBHOOK` · `N8N_CANDIDATE_WEBHOOK` · `BP_ATS_WEBHOOK` · `LEAD_WEBHOOK_URL` (book/requests/workspace) · `DOC_AGENT_SYNC_URL` (`api/_docagent.js:322`) · `BP_REVENUE_INTAKE_URL` | إن كانت مضبوطة فهي التي تحكم — اعرض قيمها قبل القطع |

### ٣) الويبهوكات: الجهتان

**من الموقع/الأدوات إلى n8n** (مسارات تنتقل كما هي؛ يتبدّل المضيف فقط): `website-lead-notify` · `bp-ats-application` · `bp-ai/revenue-intake` · `f08bf4a4-62e9-4aa6-9a44-bf3080682fb3/chat` · `05804653-e4bf-465c-aa1f-69773ea1f86d/chat` · `client-intake-web` · `bp3-portal-9kq4z` · `<slug>-intake` ×١٢ · `ss-{login,stats,chat,knowledge,names}` · `bp-chat-{monitor,send,suggest,media}-x7k2m9` · `/form/{5b3298ae-…,97fdba3a-…,32932655-…}` · `bp-agent-send` · `doc-agent-vault-sync` · `bp-catalog-changed` · مسارات ai-space السرّية.

**من n8n إلى الموقع** (لا تتأثر بقطع n8n؛ تتأثر بقطع الموقع فقط): `POST /api/simple` بمفتاح `BP_PANEL_KEY` (`n8n/followup-sweep.js:23` · `n8n/wa-agent-gate.js:38`) · `POST /api/doc-agent` بترويسة `X-Doc-Agent-Key` (`ops/n8n/doc-agent-whatsapp.workflow.js:122`) · لوحة العروض `…/quotes/api/catalog/{sync,full}` بمفتاح `CATALOG_SYNC_TOKEN` (`ops/n8n/catalog-sync.workflow.js:128,196`، وعنوانها اليوم `bp-quotes-three.vercel.app` — **يتغيّر قبل إيقاف Vercel**) · GitHub `workflow_dispatch` (عقدة نشر الموقع على Azure).
النطاق المستعمل في الاثنين الأولين `businesspartner.sa` فلا يتغيّر بقطع n8n.

**واردة من مزوّدين مباشرة إلى n8n:** واتساب (WhatsApp Trigger) وحده بحسب الكود. **إلى الموقع لا n8n:** مُيسّر · تمارا · DocuSign.
