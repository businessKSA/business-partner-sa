# قسم «الفريق والوكلاء» داخل `/ops` — ما تحتاجه لوحة AI Space

وصف للمدير التنفيذي (2026-10-29). لا كود هنا ولا تعديل على `simple-v1-ops.mjs`، ولا نشر. مصدر الكود الحالي: `ai-space/` على الفرع `claude/intelligent-agents-collaboration-y788ck`.

## ١) ما يعرضه القسم

| الجزء | المصدر | يقابله اليوم في AI Space |
|---|---|---|
| شريط النبض (يعمل الآن · مفتوحة · ينتظرك) | `pulse` | شارة النبض في الشريط العلوي |
| «يحتاجونك» بزرّي «خلصت» و«اسألي فرح» | `pulse.needs_owner` | لوحة «يحتاجونك» |
| خريطة الفريق (فرح + ١٧ إدارة، نقاط الفريق، خيوط التعاون) | `pulse` + قائمة ثابتة في `jarvis.js` | عرض «شبكة الفريق» |
| مدار الأقسام (١١ قسماً) والمهام والصفقات وجاهزية الربط | `data` | العرض المداري والأعمدة الجانبية |
| المحادثة بالصوت والكتابة وتوجيه الطلب لمدير بعينه | `chat` (+`chatresult`) · `voice` · `stt` | محادثة واحدة |
| فحص فرح | `health` | زر «فحص فرح» |

## ٢) نقاط الـAPI (عقدها)

كلها نداءات من المتصفح إلى وسيط واحد `/api/bp/<op>`، والوسيط يمرّر إلى n8n على Azure ويضيف المفتاح من الإعدادات. المتصفح لا يرى مساراً ولا مفتاحاً.

| العملية | الطريقة | الطلب | الرد |
|---|---|---|---|
| `pulse` | GET | — | `{at, totals{active,open,in_progress,needs_owner,paused}, agents{<assigned_to_agent>:{open,in_progress,latest_objective,enabled,status}}, needs_owner[{task_id,objective,next_action,priority,created_by}]}` |
| `data` | GET | — | `{generated_at, agents[], tasks[], deals[], kpis[], campaigns[], integrations[]}` |
| `chat` | POST | `{message,target_agent,source}` | `{reply}` بصيغة `VOICE: … [[DETAILS]] …`، أو `{job_id}` للرد الطويل |
| `chatresult` | GET | `?job=<id>` | `{status: pending\|done\|error, reply?, error?}` |
| `voice` | POST | `{text(≤900), voice, rate, pitch}` | `audio/mpeg` (Azure Neural) |
| `stt` | POST | `{audio_b64, mime}` | `{ok, text}` |
| `health` | GET | — | `{reply}` (اختيارية؛ لا سير فحص مستقل بعد) |

- الاعتماد الوحيد: ترويسة `X-BP-Farah-Key` على `chat` و`chatresult` و`health` فقط. `pulse` و`data` و`voice` و`stt` مسارها سرّي بلا اعتماد على n8n.
- المصدر على n8n Azure: النبض `zfKGqsftT9xIoh0v` · البيانات والتفريغ `7lS3TRRqHLu9SaS0` · الصوت `TfasSdJrcQHPCe4O` · المحادثة `g2Y2k2KbxYwmhSqu` · الرد الطويل `tMahiYKseeoxDRQu` (مفعّل).
- قيود: أي طلب يتجاوز ٤٥ ث يُقطع على Azure Static Web Apps، وعلى Vercel يحدّه `maxDuration` للدالة؛ لذلك المحادثة تعتمد نمط `job_id` + الاستعلام.

## ٣) كيف يُعرض داخل `/ops` (خياران)

**أ) تضمين لوحة Azure الحالية (الأسرع).** القسم رابط/إطار إلى موقع Azure SWA. يبقى الوسيط والأسرار على Azure كما هي. العيب: تسجيل دخول Entra منفصل عن جلسة `/ops`، وإطار من نطاق آخر يحتاج `allow="microphone"` وسياسة إطارات، وتجربة ليست «في» `/ops`.

**ب) نقله وحدةً داخل `/ops` (الأقرب لقرار «لوحة واحدة»، وهو الموصى به).**
1. **الواجهة:** `jarvis.js` و`app.js` و`jarvis.css` تُحمَّل كوحدة قسم تحت `SV1.shell()` بدل صفحة مستقلة. يلزم تحديد نطاق الـCSS (اليوم يستعمل أسماء عامة مثل `.panel` و`.map` و`.core` ستتصادم مع طبقة التصميم)، وربط الأزرار بـ`/api/bp/*`. لا يُمسّ `simple-v1-ops.mjs` قبل تأكيدك.
2. **الوسيط:** دالة Vercel واحدة `api/bp.js` تقرأ `ai-space/api/_lib/proxy.js` (نقية، بلا اعتماديات؛ تُنسخ كـ`api/_aispace.js` لأن Vercel لا يحزم خارج `api/`). عدد دوال `api/` اليوم ١٠ من ١٢، فتبقى دالتان فارغتان بعد إضافتها. التحقق من الدور: بدل `x-ms-client-principal` يُستعمل فحص جلسة المالك/مفتاح `/ops` المعتمد هناك.
3. **الأسرار:** تنتقل `BP_*` من إعدادات Azure SWA إلى متغيّرات Vercel (أسماؤها في `ai-space/UNIFIED.md`). يدخلها المالك بنفسه ولا تُكتب في المحادثة. هذا نقل أسرار إلى Vercel فاحتاج موافقة المالك الصريحة.
4. **الصوت والتفريغ:** يبقيان على n8n Azure (Azure Speech)، بلا رصيد جديد.
5. **تُحذف لاحقاً** لوحة Azure SWA بعد نجاح القسم (لا حذف الآن، بقرار المالك).

## ٤) نقاط يحسمها المدير

1. أ أم ب؟ (أوصي بـب.)
2. هل تُنقل أسرار `BP_*` إلى Vercel أم يبقى الوسيط على Azure ويُستدعى من `/ops`؟
3. الحالة الراهنة: موقع Azure منشور لكن اتصاله بـn8n لم يُشخَّص (النبض 502 والبيانات «Failed to fetch»)، وقد ينتظر نتيجة فحص من المالك. يُفضَّل حسمه قبل النقل ليُعرف أن العقد أعلاه تعمل فعلاً.
4. اسم الفرع الذي تُبنى عليه الوحدة: `claude/ops-unified-1029` وفق تعميمك، بعد تأكيدك.
