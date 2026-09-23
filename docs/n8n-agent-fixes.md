# إصلاحات وكيل الواتساب في n8n — جاهزة للتطبيق

> لتطبيقها من جلسة Claude: اربط n8n عبر `/mcp` ثم اكتب: «طبّق docs/n8n-agent-fixes.md».
> كل بند مستقل؛ بعد كل تعديل: `publish_workflow`.

الأرقام (قاعدة المالك): **0530540231** واتساب بيزنس بارتنر — كل تواصل بشري ومكالمة وطلب.
**0507034157** الوكيل الذكي 24/7 فقط. **0503793356** شخصي — لا يظهر لأي عميل ولا في أي إشعار.

---

## 1) BP-WhatsApp-Main (`tIb4wNOSYVTZQuox`) — عقدة `SS Prep`

المشكلة: أي نص على شكل `BP-xxxxxx` يُعامل كرمز دخول للخدمات المشتركة، فرقم الطلب القادم من بوابة
العميل (`BP-086612`) يرد عليه الوكيل «الرمز غير صحيح».

استبدل `jsCode` بالكامل:

```js
const j=$input.first().json;
const phone=((j.phone||'')+'').trim();
const msg=((j.message_text||'')+'').trim();
const m=msg.match(/\bBP-[A-Z0-9]{6}\b/i);
// رمز دخول فقط إذا كانت الرسالة هي الرمز (أو الرمز مع كلمة/كلمتين). رقم طلب داخل جملة،
// أو رسالة قادمة من بوابة العميل، ليس رمز دخول.
const rest=m?msg.replace(m[0],'').replace(/\s+/g,' ').trim():'';
const fromPortal=/مركز عمليات العميل|Client Operations Center|طلبي|الطلب|order/i.test(msg);
const codeFound=(m&&!fromPortal&&rest.length<=25)?m[0].toUpperCase():'';
return [{json:Object.assign({},j,{ss_phone:phone,ss_code:codeFound,
  qPhone:JSON.stringify({filter:{property:'WhatsAppPhone',rich_text:{equals:phone||'NONE'}}}),
  qCode:JSON.stringify({filter:{property:'الرمز',rich_text:{equals:codeFound||'NONE'}}})})}];
```

## 2) BP-WhatsApp-Main — المستلمون → 0530540231

في كل عقدة واتساب تُرسل للمالك اضبط `recipientPhoneNumber` = `966530540231`:
`WA Owner - New Conversation`، `Mirror to My WhatsApp`، `Notify Baher - Service`، وأي عقدة إشعار أخرى.
وفي BP-Error-Handler (`DEEBmcadEhrncGo4`) عقدة `WA Owner - Error Alert` كذلك.

## 3) BP-Sub-AI-Conversation (`ETxqAM5VooDiDJDN`) — أداة الكتالوج

أضف عقدة **HTTP Request Tool** موصولة بمدخل `ai_tool` في `AI Agent`:

- الاسم: `site_catalog`
- الوصف (Description):
  `ابحث في كتالوج موقع بيزنس بارتنر: 140 خدمة و11 باقة و31 صفحة/خاصية (سكن العمالة، المساحات، التموين، الحاسبة، الاستشارة، الامتثال، المستندات، البوابة…). استخدمه لأي سؤال عن خدمة أو سعر أو رابط. أعد للعميل url (عربي) أو urlEn حسب لغته.`
- Method: GET — URL: `https://www.businesspartner.sa/api/requests`
- Query parameters: `action`=`catalog`، `limit`=`6`، `q` = `{{ $fromAI('q','كلمات البحث بلغة العميل أو بالعربية','string') }}`

## 4) BP-Sub-AI-Conversation — إضافات على `systemMessage`

أضف في أول التعليمات:

```
# 📌 قواعد الرد (لا تُخالف)
1) كل رد يحتوي حلاً واضحاً ومحدداً + رابط الصفحة المناسبة من أداة site_catalog. ممنوع الإجابة المبهمة
   («تواصل معنا لمعرفة التفاصيل» وحدها ليست إجابة). اشرح للعميل ماذا سنفعل له وكيف والخطوة التالية.
2) استعمل أداة site_catalog قبل أي إجابة عن خدمة أو سعر أو خاصية في الموقع. أسعار الباقات تُذكر كما هي؛
   أسعار الخدمات الفردية من الأداة إرشادية وتُحسم بعرض سعر.
3) إذا ذكر العميل رقم طلب (BP-xxxxxx) فهو رقم طلب في مركز عمليات العميل: أخبره أن تذاكر الطلب تُفتح من
   بوابته https://www.businesspartner.sa/ar/account (قسم التذاكر والدعم)، وسجّل استفساره لفريقنا.
4) الأرقام: أي تواصل بشري أو مكالمة أو متابعة ← واتساب بيزنس بارتنر 0530540231 (وضّحها في كل محادثة).
   0507034157 هو هذا الوكيل الآلي فقط. ممنوع ذكر أي رقم آخر إطلاقاً.
5) رد دائماً بلغة العميل (أي لغة في العالم).
```

## 5) BP-Sub-AI-Conversation — أسعار الباقات في `systemMessage` (استبدل القديمة)

- باقات الخدمات: المنشآت الصغيرة 2,500 ﷼/شهرياً (1–4 موظفين) · الانطلاق 6,000 (5–49) · النمو 10,000 (50–200) ·
  التوسّع 20,000 (201–500) · الشراكة المؤسسية حسب الطلب (+500).
- تأسيس الشركات: الأجنبية تبدأ من 30,000 ﷼/سنوياً · السعودية والخليجية تبدأ من 15,000 ﷼/سنوياً.
- القانونية (شهرياً): الأساسية 8,000 · المتقدمة 15,000 · الشاملة 30,000 · الاستراتيجية 50,000.
- الرابط: https://www.businesspartner.sa/ar/packages

## 6) BP-Chat-Monitor-API (`eABgXmMQZcCTzatn`) — مفتاح BP Inbox

تأكد أن الورك فلو Active وأن المفتاح في `Feed Key Valid?` و`Send Key Valid?` و`Parse Send Request` يطابق
مفتاح الموقع (PANEL_KEY في Vercel). صفحة /monitor صارت تدخل عبر الموقع حتى لو n8n واقفة، لكن رسائل
الواتساب لا تظهر إلا إذا كان هذا الورك فلو يعمل بنفس المفتاح.

## 7) OfesoKDnsVO1IdEk — نوشن 401

الـ credential «Header Auth account 2» منتهية؛ يجدد المالك التوكن.
