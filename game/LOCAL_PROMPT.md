# برومبت جاهز لجلسة Claude Code المحلية (انسخه كاملاً)

> افتح Claude Code على جهازك داخل مجلد فارغ، والصق ما يلي.

```
أنت تعمل على جهازي المحلي لتحويل لعبة «الرايات الثلاث» من نموذج متصفح إلى مشروع Unreal Engine 5 كامل.

**قبل أي شيء، أجبني بوضوح: هل تستطيع تنفيذ هذه المهمة على هذا الجهاز؟** افحص الجهاز (النظام، بطاقة الرسوميات، الذاكرة، المساحة، وجود Unreal أو Epic Launcher) ثم أجب «نعم أستطيع» أو «لا أستطيع» مع الأسباب وما ينقص، ثم انتظر موافقتي قبل البدء بالخطوات.

ملاحظة مهمة: لا تضع مشروع Unreal أو المستودع داخل iCloud Drive (مجلد com~apple~CloudDocs) لأن المزامنة تُفسد ملفات المشروع الضخمة؛ استعمل `~/Unreal/` للمشروع و`~/Dev/business-partner-sa` للمستودع.

نفّذ ما يلي بالترتيب، وتوقف واسألني فقط عند خطوة تحتاج تسجيل دخول أو تنزيلاً كبيراً أو قراراً مني. لا تسألني أسئلة يمكنك الإجابة عنها بفحص الجهاز أو الملفات.

## 0) القواعد
- المستودع: https://github.com/businessKSA/business-partner-sa — اعمل على الفرع `claude/admiring-goldberg-4o0vb6` فقط. لا تدفع أبداً إلى `claude/bpic-marketing-site-jvrnga` أو `master` (الأول هو إنتاج الموقع الحيّ).
- لا تنشئ مشروع Vercel جديداً، ولا تلمس مجلدات `site/` و`api/` و`db/`، ولا تعدّل `vercel.json`. كل عملك داخل `game/` و`unreal/`.
- لا تكتب أي مفتاح أو سر في ملف يُدفع إلى git؛ المفاتيح في متغيّرات البيئة فقط.
- اكتب لي ملخصاً قصيراً بالعربية بعد كل مرحلة، مع ما نجح وما فشل ولماذا.

## 1) فحص الجهاز
اكشف نظام التشغيل والمعالج وبطاقة الرسوميات والذاكرة والمساحة الفارغة. إن كانت المساحة أقل من ١٥٠ غ.ب أو الذاكرة أقل من ١٦ غ.ب، أخبرني قبل المتابعة. تأكد من وجود git وNode.js 22+ وPython 3.11+، وثبّت الناقص (winget على Windows، brew على macOS).

## 2) استنساخ المشروع وتشغيل النموذج الأولي محلياً
- `git clone` المستودع ثم `git checkout claude/admiring-goldberg-4o0vb6`.
- اقرأ `game/README.md` و`game/SCENARIO.md` و`unreal/README.md` كاملة قبل أي تعديل.
- شغّل اللعبة: `npx http-server game -p 8080` وافتح `http://localhost:8080` وتأكد أنها تعمل، ثم أرسل لي لقطة شاشة أو وصفاً.
- ثبّت Playwright (`npm i -D playwright` ثم `npx playwright install chromium`) وشغّل `node game/tools/export-levels.mjs` للتأكد أن التصدير يعمل ويُنتج `unreal/Content/Data/levels.json`.

## 3) Unreal Engine 5.5
- تحقق من وجود Epic Games Launcher وUnreal Engine 5.5. إن لم يوجدا، أعطني رابط التنزيل وانتظرني (لا يمكنك تثبيتهما بنفسك).
- على Windows: تأكد من Visual Studio 2022 مع "Game development with C++" و.NET SDK وWindows 10 SDK. على macOS: Xcode 15+.
- من Launcher → Fab/Samples، ثبّت **Game Animation Sample Project** في `~/Unreal/RayatAlThalath` (اسم المشروع RayatAlThalath). إن احتاج نقرة يدوية أخبرني بالضبط ماذا أنقر.
- انسخ من المستودع: `unreal/Source/`، `unreal/Config/DefaultEngine.ini` (ادمج المفاتيح، لا تستبدل ملف GASP كاملاً)، `unreal/Content/Data/`، `unreal/Content/Python/` إلى المشروع. ادمج قائمة الإضافات من `unreal/RayatAlThalath.uproject` في ملف uproject الخاص بالمشروع.
- ولّد ملفات المشروع (Generate Visual Studio project files / Xcode) وابنِ Development Editor من سطر الأوامر (`Build.bat` أو `Build.sh`). عند أي خطأ ترجمة في `Source/RayatAlThalath/*`، أصلحه بأقل تعديل وأعد البناء حتى ينجح، ثم أخبرني بما غيّرته.
- افتح المحرّر (`UnrealEditor` مع مسار uproject) وتأكد أنه يعمل.

## 4) استيراد المراحل
- من المحرّر أو عبر `UnrealEditor-Cmd -run=pythonscript -script=...`، شغّل `Content/Python/import_rayat_levels.py masmak1902dawn` ثم كرّرها لـ `riyadh1902night` و`diriyah1744` في مستويات منفصلة `L_Masmak`، `L_RiyadhNight`، `L_Diriyah` داخل `Content/Maps/`.
- في `CBP_SandboxCharacter` (شخصية GASP) أضف مكوّن `RayatClimb`، واربط زر القفز: نادِ `TryStartClimb` أولاً، وإن أعاد false نفّذ القفز العادي. اختبر التسلّق على أي مكعّب «building» وسجّل فيديو قصيراً أو لقطة.
- أنشئ Blueprint حارس `BP_Guard` من شخصية GASP بمكوّن `RayatGuardSense`، وBehavior Tree بسيط: دورية بين TargetPoints التي وسمها المستورد `guardN`، ومطاردة `LastKnown` عند حدث `OnAlarm`.
- أنشئ `BP_Objective` يقرأ `URayatLevelLibrary::LoadLevels` ويعرض نص الهدف الحالي على الشاشة (UMG بخط Cairo أو Amiri).

## 5) المواد والبيئة
- افتح Window → Fab داخل المحرّر (يحتاج تسجيل دخول Epic؛ أخبرني عندها). أضف إلى المشروع: `adobe wall`, `mud brick`, `desert sand`, `date palm`, `clay pot`, `woven rug`.
- أنشئ مادة `M_NajdiClay` في `Content/Materials/` من نسيج الطوب اللبن مع Nanite tessellation خفيف؛ المستورد يطبّقها تلقائياً على المباني إن وجدت.
- أنشئ `PCG_NajdiBlock` كما هو موصوف في `unreal/README.md` وطبّقه على مكعّبات المباني في `L_Masmak`.
- إضاءة: Directional Light فجر (زاوية ٨°، لون ٣٥٠٠K)، Sky Atmosphere، Exponential Height Fog كثيف قليلاً، Lumen مفعّل. أرسل لي لقطة.

## 6) الشخصيات والحركة
- MetaHuman: افتح metahuman.unrealengine.com وأخبرني لأنشئ الكشّاف بنفسي، ثم استورده عبر Bridge وأعد الاستهداف من هيكل GASP بـ IK Retargeter الجاهز.
- إن وُجد مجلد `~/Mocap/` فيه FBX من Move.ai أو Rokoko، استورده إلى `Content/Anim/Mocap/` وأضفه إلى PoseSearch Database الخاصة بـ GASP.
- الشماغ: أنشئ نسيج ٤K مرقّط أحمر وأبيض بمنطق `TEX.shemagh` الموجود في `game/index.html`.

## 7) الصوت
- إن كان `ELEVENLABS_API_KEY` موجوداً في البيئة، شغّل `node unreal/tools/elevenlabs-audio.mjs` لتوليد السرد والموسيقى الناقصة في `game/audio/`، ثم استورد كل `game/audio/*.mp3` إلى `Content/Audio/` كـ Sound Waves. إن لم يوجد المفتاح، تجاوز هذه الخطوة وأخبرني.

## 8) مشاهد ووحدة اختبار
- أنشئ Level Sequence `SEQ_MasmakIntro` بلقطتي كاميرا من `levels.json` (حقل intro لمرحلة masmak1902dawn) بالنصوص نفسها كـ Text Render أو UMG.
- أضف Functional Test يتأكد أن `LoadLevels` تعيد ٦ مراحل وأن مرحلة المصمك فيها ٤ أهداف.

## 9) الختام
- ابنِ نسخة Windows/Mac قابلة للتشغيل (Package Project → Development) في `~/Unreal/Builds/RayatAlThalath/`.
- اكتب تقريراً `unreal/STATUS.md` بما تم، ولقطات الشاشة، والأخطاء التي أصلحتها، والخطوات التي تحتاج مني نقرة يدوية. ادفعه مع أي تعديل في `unreal/` أو `game/` إلى الفرع `claude/admiring-goldberg-4o0vb6` بكوميت واضح بالعربية.
```
