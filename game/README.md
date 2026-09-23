# الرايات الثلاث — نموذج أولي قابل للعب

لعبة مغامرة وتسلّل من منظور الشخص الثالث (على طريقة Assassin's Creed) عن الدول السعودية الثلاث،
ومحورها القصة الحقيقية للملك عبدالعزيز: ليلة استرداد الرياض، فجر المصمك، ليلة الهفوف، ويوم التوحيد.
البطل كشّاف نجدي خيالي من ثلاثة أجيال. **لا قتال ولا اغتيالات لشخصيات حقيقية**: تسلّل، تسلّق،
مراقبة، إيصال رسائل، رفع رايات.

## التشغيل

- افتح `index.html` مباشرة في المتصفح (يحتاج اتصالاً لتحميل Three.js من jsDelivr وخطوط Google)،
  أو شغّل خادماً محلياً: `npx http-server game -p 8080` ثم `http://localhost:8080`.
- الجوال مدعوم: عصا افتراضية يساراً، سحب يميناً لتدوير الكاميرا، أزرار للقفز والتفاعل والبصيرة.
- التقدّم والمخطوطات تُحفظ في المتصفح (`localStorage`).

## المراحل

| # | المرحلة | السنة | النوع | ما تفعله |
|---|---|---|---|---|
| ١ | ميثاق الدرعية | ١٧٤٤م | تعليمية (نهار) | عبور الوادي، تسلّق سطح، جمع ثلاث رسائل، إيصالها إلى قصر سلوى |
| ٢ | عودة الرياض | ١٨٢٤م | تسلّل (غروب) | تسلّق السور، استطلاع القصر، إشعال إشارة، فتح البوابة للإمام تركي |
| ٣ | ليلة الاسترداد | ٤ شوال ١٣١٩هـ | تسلّل (ليل) | تسلّق سور الرياض، التسلّل إلى البيت الملاصق للمصمك، الكمون حتى الفجر |
| ٤ | فجر المصمك | ٥ شوال ١٣١٩هـ | مطاردة (فجر) | الوصول إلى باب المصمك، الدخول، تسلّق البرج تحت الإنذار، رفع الراية |
| ٥ | ليلة الهفوف | ١٩١٣م | تسلّل (ليل) | نصب سلالم جذوع النخل، تسلّق السور، فتح الكوت، رفع الراية |
| ٦ | يوم التوحيد | ١٩٣٢م | سينمائية | خاتمة |

كل مرحلة عبارة عن **بيانات** في أعلى `index.html` (المصفوفة `LEVELS`): المدينة والوقت والمعلم، مشاهد
المقدّمة (كاميرا + نص)، الأهداف (`goto`, `roof`, `stealth`, `collect`, `hold`)، والمخطوطات
(معلومة تاريخية). إضافة مرحلة = إضافة عنصر واحد للمصفوفة.

## الأنظمة الموجودة في النموذج

- الطبقة البصرية (٢٠٢٦-٠٩-٢٣): قوام طيني ولِبن مولّد إجرائياً (Canvas) بإسقاط صندوقي من إحداثيات العالم، خريطة نتوء، أرض رملية، أبواب مقوّسة، سجاد سدو، مرازيم، جرار، رايات على حبال، معالجة لاحقة (تظليل حواف، حبيبات فيلم، انحراف لوني، تدرّج لكل حقبة)، بصيرة الكشّاف عبر الجدران بالشيدر، نجوم وغيوم وقرص شمس، غبار متطاير، طيور، جِمال، سكّان يتجوّلون، بطل بشماغ مرقّط وبِشت بحاشية ذهبية ومِعطف يتمايل.

- مولّد مدينة نجدية إجرائي: سور وبوابة وأبراج، أحياء بشرفات مثلثة ونوافذ، سوق، نخيل، مشاعل ليلاً،
  ومعالم: قصر سلوى، قصر الإمام، المصمك (أبراج مستديرة)، الكوت.
- لاعب: مشي/ركض/قفز/تسلّق أي جدار (Space عند الاصطدام)، وقوف على الأسطح، اختباء في عربات القش.
- حرّاس بدوريات ومخروط رؤية وخط نظر، مقياس شُبهة، إنذار ومطاردة، ونقاط حفظ.
- «بصيرة الكشّاف» (V): تُظهر الحرّاس والأهداف والمخطوطات، على الشاشة والخريطة المصغّرة.
- مشاهد سينمائية بكاميرا متحركة ونص متدرّج وشرائط سينمائية، قابلة للتخطي.
- **تسجيل فيديو** من داخل المحرّك (`MediaRecorder`): زر «شاهد المقدّمة وسجّلها فيديو» يخرج ملف webm.
- صوت تركيبي بلا ملفات: رياح، خطوات، نبض عند الإنذار، تنبيهات. (M لكتم الصوت.)

## الفيديو الخارجي (Higgsfield أو غيره)

ضع الفيديو المولّد في `game/media/intro.mp4` وسيظهر زر «شاهد الفيديو السينمائي» في القائمة تلقائياً.
لا يوجد اتصال بـ Higgsfield من داخل هذا المشروع؛ الاستخدام يدوي عبر موقعه. برومبتات جاهزة أدناه.

### حزمة برومبتات Higgsfield (انسخها كما هي، مقطع واحد لكل لقطة، ٥–٨ ثوانٍ)

1. **Diriyah 1744 — establishing**: `Golden hour aerial push-in over At-Turaif, Diriyah, 1744. Najdi mud-brick towers with triangular crenellations, palm groves of Wadi Hanifa, warm dust haze, camels on a market street. Slow cinematic drone move, painterly realism, no text.`
2. **Hero rooftop run**: `A Najdi scout in a dark bisht and red-white shemagh sprints across mud-brick rooftops and leaps an alley, dust trailing, camera tracking from behind at shoulder height, golden hour, cinematic 35mm, no text.`
3. **Riyadh 1902 — night wall climb**: `Blue-hour night, old Riyadh walls. Forty cloaked men move silently along the base of a clay wall; one climbs a palm-trunk ladder. Single lantern light, deep shadows, slow dolly, cinematic, no text.`
4. **Masmak dawn**: `Pre-dawn at Al-Masmak fortress, Riyadh, 1902: massive clay walls, round corner towers, small studded wooden gate opening as first light hits the towers. Low camera crane-up, atmospheric mist, cinematic, no text.`
5. **Banner over Masmak**: `A green banner with a white sword is raised on a Masmak tower at sunrise, wind unfurling the cloth, slow-motion, backlit dust, heroic orchestral mood, no text.`
6. **Hofuf 1913**: `Night in Al-Ahsa oasis: dense palm groves, the clay citadel of Al-Kut in Hofuf, men raising palm-trunk ladders against the wall under moonlight, slow lateral tracking shot, cinematic, no text.`
7. **Unification 1932**: `Sunrise over a unified Arabian landscape: dunes, palm oases, walled towns, a single green banner on a tower in the foreground. Wide epic crane shot, warm light, no text.`

نصيحة: ولّد كل لقطة من صورة مرجعية (Image-to-Video) لثبات الأسلوب. صور المرجع الثلاث في `concept/`.

## الأدوات الصحيحة لإنتاج اللعبة الكاملة

| الغرض | الأداة | ملاحظة |
|---|---|---|
| المحرّك (لعبة 3D حقيقية) | **Unreal Engine 5** (Nanite/Lumen، نظام تسلّق جاهز عبر Motion Matching) أو **Unity 6** | النموذج الحالي Three.js للمتصفح فقط |
| النمذجة والعمارة النجدية | **Blender** + Quixel Megascans (مواد الطين واللبن) | صدّر إلى UE5 بصيغة FBX/USD |
| الشخصيات | **MetaHuman** (UE5) أو Character Creator 4 | الثياب: Marvelous Designer للبِشت والغترة |
| الحركة (Animation) | **Mixamo** مجاناً للنموذج، ثم Motion Capture (Rokoko / Move.ai) للإنتاج | حركات التسلّق والتسلّل |
| الفيديو السينمائي بالذكاء الاصطناعي | **Higgsfield** (حركة كاميرا) / Kling 3 / Veo 3.1 / Runway Gen-4 | للمقدّمات والإعلان، لا للّعب |
| الصور المرجعية (Concept Art) | ElevenLabs Creative (gpt-image-2) — الصور الثلاث في `concept/` | أو Midjourney |
| التعليق الصوتي العربي | **ElevenLabs** (Text to Speech, أصوات عربية فصحى) | حساب مدفوع للفيديو |
| الموسيقى | Suno / Udio للنماذج، ثم مؤلّف حقيقي | عود، طبول نجدية، آلات وترية |
| المراجع التاريخية | دارة الملك عبدالعزيز، هيئة تطوير بوابة الدرعية، متحف المصمك | راجع كل مخطوطة قبل الإصدار |
| النشر | Steam (PC)، أو Web عبر Vercel للنموذج | النموذج الحالي ملف واحد |

## خارطة الطريق المقترحة

1. **الآن**: نموذج المتصفح هذا لتجربة الحركة والمراحل والقصة.
2. **الشهر ١–٢**: نقل التصميم إلى UE5: مستوى واحد (المصمك) بجودة كاملة، شخصية واحدة، تسلّق وتسلّل.
3. **الشهر ٣–٤**: بقية المراحل، تعليق صوتي، مقدّمات Higgsfield/Veo، مراجعة تاريخية.
4. **الشهر ٥**: عرض تجريبي (Demo) على Steam Next Fest.

## ملاحظات على الدقة التاريخية

الحقائق في المخطوطات موجزة ومن المصادر العامة المعروفة (تأسيس ١٧٢٧م، اتفاق ١٧٤٤م، سقوط الدرعية ١٨١٨م،
عودة الرياض ١٨٢٤م، المليداء ١٨٩١م، استرداد الرياض ٥ شوال ١٣١٩هـ / ١٥ يناير ١٩٠٢م، الأحساء ١٩١٣م،
التوحيد ٢٣ سبتمبر ١٩٣٢م). الشخصيات القابلة للّعب خيالية عمداً، والشخصيات التاريخية تُذكر ولا تُجسَّد.
تجب مراجعة كل نص مع مؤرّخ قبل أي إصدار عام.
