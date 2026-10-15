# الرايات الثلاث — مشروع Unreal Engine 5 وخط الإنتاج (Pipeline)

هذا المجلد هو **جسر الربط** بين النموذج الأولي في المتصفح (`game/`) وأدوات الإنتاج الكامل. لا شيء هنا يحتاج تعديلاً في الموقع.

## ما الموجود

| الملف | الدور |
|---|---|
| `RayatAlThalath.uproject` | مشروع UE 5.5 مع الإضافات المطلوبة مفعّلة: Motion Matching (PoseSearch, MotionTrajectory, Chooser)، PCG، Python، Bridge/Fab، MetaHuman |
| `Source/RayatAlThalath/RayatClimbComponent` | التسلّق الحر: يكشف الجدار بثلاثة مسارات تتبّع، يجد الحافة، يصعد ويعتلي. يعمل على أي `ACharacter` |
| `Source/RayatAlThalath/RayatGuardSenseComponent` | حاسّة الحارس: مخروط رؤية + خط نظر + مقياس شُبهة + حدث إنذار، بنفس أرقام النموذج |
| `Source/RayatAlThalath/RayatLevelData` | بنى البيانات ودالة `LoadLevels` التي تقرأ `Content/Data/levels.json` من Blueprint |
| `Content/Data/levels.json` | **المراحل الست مُصدَّرة من اللعبة الحالية** (مدن، حرّاس، أهداف، مخطوطات، مشاهد) بوحدات Unreal |
| `Content/Python/import_rayat_levels.py` | يبني المرحلة داخل المحرّر بضغطة: مكعّبات المدينة، مسارات الحرّاس، علامات الأهداف، نقطة البداية |
| `tools/elevenlabs-audio.mjs` | يولّد السرد والموسيقى الناقصة من واجهة ElevenLabs عند توفّر مفتاح ورصيد |
| `../game/tools/export-levels.mjs` | يعيد تصدير `levels.json` بعد أي تعديل في مراحل النموذج |

## الخطوات على جهازك (بالترتيب)

### 0. المتطلبات
Windows 10/11 أو macOS، بطاقة رسوميات RTX 3060 أو أعلى (Lumen وNanite)، ذاكرة ٣٢ غ.ب، ١٥٠ غ.ب فارغة. حساب Epic Games مجاني.

### 1. Unreal Engine 5.5 + Game Animation Sample
1. Epic Games Launcher → Unreal Engine → Library → ثبّت 5.5.
2. Fab / Samples → **Game Animation Sample Project (GASP)** → Create Project. هذا يعطيك شخصية بمشي وركض وقفز وتسلّق حواف بـ Motion Matching جاهزة، بجودة تجارية.
3. انسخ مجلد `Source/` و`Config/` و`Content/Data` و`Content/Python` من هنا إلى مشروع GASP، وأعد تسمية الـ uproject أو ادمج قائمة الإضافات من `RayatAlThalath.uproject` فيه.
4. اضغط يميناً على الـ uproject → Generate Visual Studio project files → افتح المشروع → Build. (الشيفرة هنا لم تُترجَم على هذا الخادم لغياب المحرّك؛ أي خطأ ترجمة يكون صغيراً وأصلحه لك من رسالة الخطأ.)
5. افتح شخصية GASP (`CBP_SandboxCharacter`) وأضف المكوّنين `RayatClimb` و… للحارس `RayatGuardSense`. اربط زر القفز بـ `TryStartClimb` ثم القفز العادي إن أعاد false.

### 2. استيراد مراحل اللعبة
في المحرّر: **Tools → Execute Python Script** → `Content/Python/import_rayat_levels.py`. المرحلة الافتراضية «فجر المصمك»؛ لتغييرها مرّر المعرّف: `py import_rayat_levels.py riyadh1902night`. ستظهر المدينة كمكعّبات رمادية (Blockout) بمسارات الحرّاس وعلامات الأهداف. هذا هو **مستوى الاختبار** الذي يبدأ منه فنان البيئة.

### 3. العمارة: مسح ضوئي + Megascans + PCG
- **المسح:** زيارة الدرعية (الطريف) والمصمك وأشيقر؛ التقط بـ **RealityScan** (مجاني من Epic) أو **Polycam**: ٦٠–١٠٠ صورة لكل جدار/باب/برج، إضاءة غائمة أو الصباح الباكر. صدّر FBX + Textures 4K → اسحبها إلى `Content/Scans/`.
- **Megascans:** داخل Unreal → Window → Fab: ابحث عن `mud wall`, `adobe`, `date palm`, `desert sand`, `sadu` → Add to project. الأصول مجانية لمشاريع Unreal.
- **PCG:** أنشئ `PCG Graph` اسمه `PCG_NajdiBlock`: مدخل Spline لحدود الحي → Subdivide → Spawn Static Mesh من مجموعة (بيت ٣ أحجام، برج، شرفات مثلثة على الحواف بـ Copy Points على Edges) → Random Rotation ±٤°. أسقطه على كل مكعّب «building» من المستورد.

### 4. الشخصيات: MetaHuman + Marvelous Designer
- **MetaHuman Creator** (متصفح، مجاني): أنشئ الكشّاف (ثلاثينيّ، لحية، بشرة نجدية) → Quixel Bridge داخل Unreal → Download → Add. ثم Retarget من هيكل GASP إلى MetaHuman عبر IK Retargeter (جاهز في GASP).
- **Marvelous Designer:** الثوب والبِشت والغترة والعقال كأنماط قماش، Simulate → Export FBX + Alembic. في Unreal: Chaos Cloth أو USD Cloth؛ الشماغ نسيج مرقّط ٤K من `game/index.html` (يُعاد رسمه في Substance).

### 5. الحركة: Rokoko أو Move.ai
- **Move.ai** (بدون بدلة، من فيديو هاتف): سجّل التسلّق والتسلّل والمشي بالبِشت → صدّر FBX → استورد إلى `Content/Anim/Mocap/` → أضف الحركات إلى **PoseSearch Database** الخاصة بـ GASP فتدخل في Motion Matching تلقائياً.
- **Rokoko Smartsuit** (بدلة): فعّل إضافة Rokoko Studio Live في الـ uproject (معطّلة الآن) وسجّل مباشرة داخل Unreal.

### 6. الفيديو والتسويق: Higgsfield / Kling / Veo
لا تُستخدم داخل اللعبة. صوّر لقطات من Unreal (Sequencer → Movie Render Queue) وأعطها لـ Higgsfield كـ Image-to-Video لحركات الكاميرا. البرومبتات السبعة في `../game/README.md`.

### 7. الصوت: ElevenLabs
`ELEVENLABS_API_KEY=... node unreal/tools/elevenlabs-audio.mjs` يولّد `narr-3/5/6` وحلقتي `stealth` و`chase` في `game/audio/`، وتعمل فوراً في النموذج. للعبة Unreal استوردها كـ Sound Waves وضعها في `Content/Audio/`.

## خريطة العمل للفريق (٣ إلى ٤ أشهر، الشريحة العمودية: فجر المصمك)
| الأسبوع | مطوّر Unreal | فنان البيئة | فنان الشخصيات | الكاتب والمؤرّخ | الصوت |
|---|---|---|---|---|---|
| ١–٢ | GASP + استيراد المستوى + التسلّق | مسح المصمك | MetaHuman الكشّاف | مراجعة `game/SCENARIO.md` | جمع مراجع أصوات نجدية |
| ٣–٦ | حرّاس + أهداف + واجهة | المصمك بـ Nanite + الأزقة بـ PCG | البِشت والغترة في Marvelous | حوارات المرحلة | موسيقى الفجر |
| ٧–١٠ | مشاهد Sequencer + حفظ | إضاءة Lumen فجر + غبار Niagara | حرّاس وسكّان | نصوص المخطوطات | سرد ومؤثرات |
| ١١–١٤ | تحسين أداء + بناء Windows | تلميع | تلميع | تسويق | مكس نهائي |

## المراجع الرسمية
- Game Animation Sample: docs.unrealengine.com → "Game Animation Sample Project"
- Motion Matching: docs.unrealengine.com → "Motion Matching in Unreal Engine"
- PCG: docs.unrealengine.com → "Procedural Content Generation Framework"
- MetaHuman: metahuman.unrealengine.com
- RealityScan: realityscan.com · Move.ai: move.ai · Rokoko: rokoko.com
- ElevenLabs API: elevenlabs.io/docs
