# قالب البريد المعتمد (تعميم مازن بتوجيه باهر، 2026-10-31)

شكلٌ فقط: إرسال أي بريد لعميل يبقى بتأكيد باهر الخطي (Safe Send). ثنائي اللغة: الإنجليزي يسار والعربي يمين بنفس المحتوى.

1. **التحية:** `Dear <Name>,` ثم `Greetings.` — والعربي: `السيد <الاسم>،` ثم `تحية طيبة،`
2. **تقديم الخدمة** (2–3 أسطر بلا مبالغة): At Business Partner we offer Business Development as a Service: we bring you qualified sales leads and referrals and help you register as a vendor with companies, with a monthly performance report. — «نقدم لكم في Business Partner خدمة «تطوير الأعمال كخدمة»…»
3. **المستندات:** You will find the Quotation, the Service Agreement and the Non-Disclosure Agreement (NDA) in this folder: <اسم العميل> (رابط) — «تجدون عرض السعر وعقد الخدمة واتفاقية عدم الإفصاح في هذا المجلد: <الرابط>»
4. **الخطوة التالية:** حجز استشارة قصيرة — Please let us know a time that works for you. / يُرجى إفادتنا بالوقت المناسب لكم.
5. **الختام:** Kind regards, / مع التقدير،
6. **التوقيع:** الشعار (Business Partner · Partnering for your success) ثم Baher Magnas ثم BUSINESS PARTNER | Business Development Manager ثم 00966530540231

قواعد: نبرة مهنية قصيرة · لا أرقام ولا أسعار في المتن (الأسعار في المرفقات فقط) · العربي RTL والإنجليزي LTR.
الربط: `buildComposePrompt` (قناة البريد) في `ops/azure-n8n/farah-draft.mjs` وكتلة السياق في `farah-context.mjs`.
مسودات Gmail القائمة غير المرسلة لم تُعَد صياغتها هنا (ليست في نطاق هذه الجلسة).
