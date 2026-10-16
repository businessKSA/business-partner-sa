# نقل ويبهوكات AI Space/جارفس من n8n Cloud إلى n8n على Azure

الغرض: اللوحة الموحّدة (`ai-space/UNIFIED.md`) تقرأ كل شيء عبر وسيط Azure، وما زال بعض ما تحتاجه على n8n Cloud. هذا الجرد بالأسماء لا بالقيم السرّية. **لم يُعدَّل ولم يُفعَّل أي سير في Cloud أو Azure.**

## ١) ما يعمل أين (قراءة 2026-10-16)

| الوظيفة | السير (المعرّف) | الموضع | الإعداد في Azure SWA |
|---|---|---|---|
| محادثة فرح | Command Space | ويبهوك على Azure موجود بترويسة `X-BP-Farah-Key` (غير مفعّل حتى التحويل)، ونظيره على Cloud | `BP_PATH_CHAT` |
| فحص فرح | مسار الفحص | Azure موجود | `BP_PATH_HEALTH` |
| المحضر | مسار المحضر | Azure موجود | `BP_PATH_MINUTES` |
| النبض | 🛰️ Jarvis — Pulse (`a8mMc7Vz6YjyHeu7`) | **Cloud فقط** | `BP_PATH_PULSE` |
| النطق | 🔊 Jarvis — Voice (`lsi2W7g238uIGyAC`، عقدتا Build SSML وAzure Speech TTS) | **Cloud فقط** | `BP_PATH_VOICE` |
| بيانات اللوحة والتفريغ | 🛰️ BP AI Space — Data API (`3B9PXV0YhcLOgMqi`، فيه أيضاً Azure Speech TTS وAzure Whisper STT) | **Cloud فقط** | `BP_PATH_DATA` · `BP_PATH_VOICE` · `BP_PATH_STT` |
| صفحة خارطة جارفس | نفس سير الصوت، عقدة `Serve Jarvis Map` | **Cloud** — تُستبدل باللوحة الموحّدة ولا تُنقل | — |
| أوامر التحكم | سير أوامر اللوحة | يُتحقَّق منه عند التنفيذ | `BP_PATH_ACTION` |

مصدر صفحة جارفس لم يكن في المستودع؛ وظائفها الآن في `ai-space/jarvis.js`. مسارات Pulse/Voice/Health السرّية كانت مكتوبة داخل كود الصفحة القديمة، فيُنصح بتدويرها بعد النقل.

## ٢) خطة النقل (مقترحة، تنفيذها بقرارك)

1. **النبض**: استنساخ Jarvis — Pulse إلى n8n Azure (يقرأ جدولَي `BP_AI_Tasks` و`BP_Agent_Registry`)، غير مفعّل حتى تأكيدك.
2. **الصوت**: استنساخ مسار Voice مع اعتماد «Azure Speech — Jarvis» (المنطقة `eastus2`)، وكذلك Azure Whisper STT (نشر `bp-voice`) للإملاء.
3. **بيانات AI Space**: استنساخ Data API (ستة جداول ← JSON واحد؛ مع قصّ الحقول فقد بلغت الحمولة سابقاً ٢٫٥MB).
4. أثناء الانتقال تُوجَّه عملية واحدة إلى Cloud بـ`BP_BASE_PULSE` وأمثالها بلا تغيير كود؛ مفتاح فرح لا يُرسل إلى Cloud.
5. بعد نجاح كل مسار بتنفيذ حقيقي (لا بقراءة إعداد): إيقاف نسخة Cloud وتدوير المسار.

## ٣) سيران غير متزامنان للرد الطويل (لم يُبنيا)

لتجاوز سقف ٤٥ ث في Static Web Apps:

- **Command Space — Async In**: ويبهوك POST بترويسة المفتاح، يولّد `job_id` ويسجّل المهمة `pending` في Supabase، يردّ فوراً `202 {job_id}` ثم يُكمل مناداة فرح ويكتب `reply`.
- **Command Space — Result**: ويبهوك GET `?job=` يعيد `{status, reply|error}`.
- مساراهما في `BP_PATH_CHAT` و`BP_PATH_CHAT_RESULT`. الواجهة والوسيط جاهزان لهذا الشكل بلا تعديل.

## ٤) قرارات المالك المطلوبة

1. هل أبني السيرين غير المتزامنين وأنسخ Pulse/Voice/Data إلى n8n Azure (غير مفعّلة، موثّقة)؟
2. أم تفضّل خطة Standard مع Container App بدل الدوال المُدارة؟
3. إدخال إعدادات `BP_*` في Azure Portal (بنفسك).
