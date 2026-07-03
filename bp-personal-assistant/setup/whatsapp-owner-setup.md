# ⚙️ تشغيل مُعين على واتساب (owner-only)

## الفكرة
مُعين يستمع على رقم **WhatsApp Business Cloud** (نفس بنية بوت الشركة)، لكنه يرد **فقط** على رقم باهر. عقدة `Owner Only (Baher)` هي الحارس: أي رقم غير رقمك يُتجاهل.

## الخطوات

1. **افتح الـ workflow** في n8n:
   `https://businesspartnerai.app.n8n.cloud/workflow/YgRwn40v1CqsscJw`

2. **حدّد رقمك** — افتح عقدة `Owner Only (Baher)`، وفي الشرط الأول بدّل
   `REPLACE_WITH_BAHER_WHATSAPP_NUMBER`
   برقم واتساب باهر بصيغة دولية بدون `+`، مثال: `9665XXXXXXXXX`
   (نفس الصيغة التي يرسلها واتساب في `messages[0].from`).

3. **تأكد من الاعتمادات** في هذه العقد (كلها موجودة مسبقاً في مشروعك):
   | العقدة | الاعتماد |
   |---|---|
   | Baher WhatsApp In | WhatsApp Trigger (`WhatsApp OAuth account 3`) |
   | Reply to Baher | WhatsApp Business Cloud (`WhatsApp account`) |
   | Claude Sonnet | Anthropic (`Anthropic account`) |
   | Notion | Notion MCP (`Notion MCP OAuth2`) |
   | Read Gmail | Gmail OAuth2 (`Gmail OAuth2 API`) |
   | Create Calendar Event | Google Calendar OAuth2 |

4. **فعّل الـ workflow** (زر Active). هذا يسجّل الـ webhook تلقائياً على رقم واتساب.

5. **جرّب** — أرسل من جوالك لرقم البوت:
   - «ذكّرني أجدد رخصة السيارة الأربعاء الساعة ١١» → لازم يرد ويسجّل مهمة + حدث كالندر.
   - «سجّل جهة اتصال: أبو سعد 0501234567 وسيط عقاري» → جهة اتصال جديدة.
   - «شقة للإيجار حي الياسمين 45 ألف سنوي 3 غرف» → عقار جديد.

## أي رقم واتساب أستخدم؟
- **الأسهل:** استخدم رقم WhatsApp Cloud الحالي نفسه — البوت يرد عليك أنت فقط (owner-only)، ويرد على العملاء عبر workflow الشركة المنفصل. لا تعارض لأن كل workflow يوجّه حسب الرقم.
- **الأنظف (اختياري):** جهّز رقم WhatsApp Cloud API ثانٍ مخصّص لمُعين وحده، واربط اعتماداته في العقدتين (In/Reply).

## ملاحظة عن الصور (العقارات)
حالياً إذا أرسلت **صورة عقار مع كابشن فيه التفاصيل** (نوع/سعر/موقع)، مُعين ينشئ العقار من الكابشن ويشير أن الصورة مرفقة على واتساب. رفع الصورة نفسها لملف نوشن يحتاج خطوة تنزيل وسائط إضافية — مذكورة كإضافة في المرحلة الثانية.
