// Business Partner — Simple V1: «التوظيف» (/hiring).
//
// طبقتان، بقرار المالك ٢٠٢٦/٠٩/٢٤ («وابغى دمج ما بين الفكرتين»، ثم لقطة
// واجهةٍ قال عنها «ابغى كده الواجهه»):
//
//   الطبقة الأولى (فوق الطيّة) — صندوقٌ واحد بتبويبين. الباب يسأل الزائر
//   «من أنت؟» ثم يرميه إلى صفحةٍ أخرى؛ الصندوق يسأله «ماذا تريد؟» ويجيبه في
//   مكانه. من يعرف مطلبه ينتهي هنا في ثانية.
//
//   الطبقة الثانية (تحته) — لمن لا يعرف: لماذا نحن، ثم الوظائف المفتوحة
//   بالفلاتر نفسها، ثم باب قاعدة المواهب. لا تُجلب حتى يصل إليها الزائر.
//
// ماذا خلف كل تبويب — وهذا ما تسمح به نقاط الـAPI القائمة، لا أكثر:
//
//   صاحب عمل    → GET /api/candidates?field=&city=  (عامّة، بأسماء مُقنَّعة
//                  وبلا هاتف أو بريد أو سيرة: mapCandidate تُخفيها ما لم يكن
//                  هناك اشتراك — ولذلك لا تُعرض الأسماء هنا أصلاً). الترتيب
//                  الأوّلي بتقاطع الكلمات في المتصفّح، ثم زرٌّ اختياري يستدعي
//                  POST /api/hire {task:"match"} فيعيد [{id,score,reason}] —
//                  وهو النداء نفسه الذي تستعمله لوحة صاحب العمل. اختياري
//                  عمداً: كل ضغطة استدعاءُ نموذجٍ مدفوع، فلا تُصرف على زائرٍ
//                  لم يطلبها.
//   باحث عن عمل → GET /api/candidates?openJobs=1 (الإعلانات النشطة كلها)
//                  والتصفية في المتصفّح — طلبٌ واحد يخدم التبويب واللوحة معاً.
//   سطر الإحصاء → GET /api/candidates?count=1، ولا يظهر السطر إلا إذا عاد
//                  done:true برقمٍ حقيقي. لا ومضة ولا صفر ولا رقم مخترع.
//
// ⚠️ الطلب بلا مجال ولا مدينة يعني مسحاً كاملاً لقاعدة المرشّحين (~١٧ ألف صف،
// حتى ٤٥ ثانية في الدالة). لذلك يرفض تبويب صاحب العمل البحث حتى يُختار
// أحدهما — ليست مضايقةً للزائر بل حمايةٌ لزمن الدالة من كل زائرٍ يمرّ.
//
// رقائق التصفية أربع كما في اللقطة، وحالُها ليس واحداً:
//   المدينة والمجال — خادميّتان للمرشّحين، وتصفيةٌ في المتصفّح للوظائف.
//   الخبرة          — على Experience Years للمرشّحين فقط؛ إعلانات JOBS_DB لا
//                     تحمل سنوات خبرة، فتُعطَّل في تبويب الباحث.
//   الراتب          — معطّلة في التبويبين: لا حقل راتب في JOBS_DB إطلاقاً،
//                     و«Expected Salary» في قاعدة المرشّحين لا تُعيده
//                     mapCandidate في api/candidates.js. الرقاقة معروضة
//                     ومعطّلة بتلميح «قريباً» لأن حذفها يخالف اللقطة،
//                     وتفعيلها يَعِد بتصفيةٍ لا بيانات خلفها.
// ولا رقاقة جنس ولا جنسية (قرار المدير قائم).
//
// الميكروفون مبنيٌّ لأن النقطة موجودة فعلاً — POST /api/chat {mode:"voice"}
// تُفرّغ الصوت عبر Azure (api/_docread.js: transcribeAudio) وهي عامّة بلا
// حساب. يُرسم الزرّ دائماً (اللقطة فيها ثلاثة أزرار) لكنه يبدأ معطّلاً
// بتلميح «قريباً»، ولا يُفعَّل إلا بعد أن يقول GET /api/chat إن المفرِّغ
// مُهيَّأ — فلا يرى الزائر زرّاً يَعِد بما لا يعمل حين تغيب مفاتيح أزور.
//
// زرّ «تقديم» في بطاقة الوظيفة يذهب إلى /job?id=<معرّف الإعلان>#apply-form،
// لا إلى /careers#seeker-form: فصفحة /job وحدها هي التي تستدعي setSelectedJob
// بمعرّف نوشن الحقيقي بعد جلب /api/candidates?posting=<id>، فيصل الطلب مربوطاً
// بالإعلان ويصل صاحب العمل إشعاره. أما /careers فلا تلتقط المعرّف إلا لسلاغين
// قديمين مكتوبين يدوياً في main.js، وما عداهما يسقط صامتاً إلى candidate-pool.
//
// رفع السيرة الذاتية يوصّل إلى /careers#seeker-form ولا يستنسخه: لا نقطة
// عامّة تقرأ ملفاً وتعيد نصّه (كل مسارات readDocument في api/requests.js خلف
// جلسة أو مفتاح)، والنموذج هناك يرفع الملف فعلاً ويُدخل صاحبه قاعدة المرشّحين.
// وفي تبويب صاحب العمل يُعطَّل الزرّ: رفع وصفٍ وظيفي ليس مبنيّاً عندنا.
//
// لا شريط جانبي: مبدّل اللغة وزرّ الدخول موجودان في ترويسة SV1.shell()،
// وتكرارهما على حافة الشاشة نسختان من شيء واحد تتباعدان بعد أول تعديل.

// المجالات — نسخة FIELD_TAXONOMY الرسمية (site/scripts/generate.mjs و
// api/candidates.js: FIELD_OPTIONS). القيمة المرسَلة عربيةٌ دائماً لأن نوشن
// يخزّنها كذلك؛ المعروض فقط هو المترجَم.
const FIELDS = [
  ["هندسة", "Engineering", "Ingénierie", "工程"],
  ["تقنية معلومات", "IT & Software", "Informatique", "信息技术"],
  ["مبيعات وتسويق", "Sales & Marketing", "Ventes & Marketing", "销售与市场"],
  ["محاسبة ومالية", "Accounting & Finance", "Comptabilité & Finance", "会计与财务"],
  ["إداري وسكرتارية", "Admin & Secretarial", "Administration & Secrétariat", "行政与文秘"],
  ["موارد بشرية", "Human Resources", "Ressources humaines", "人力资源"],
  ["ضيافة وسياحة", "Hospitality & Tourism", "Hôtellerie & Tourisme", "酒店与旅游"],
  ["مقاولات وإنشاءات", "Construction", "Construction", "建筑施工"],
  ["عقارات", "Real Estate", "Immobilier", "房地产"],
  ["صحة وطب", "Health & Medical", "Santé & Médical", "医疗健康"],
  ["تعليم", "Education", "Éducation", "教育"],
  ["لوجستيات ونقل", "Logistics & Transportation", "Logistique & Transport", "物流运输"],
  ["قانون", "Legal", "Juridique", "法律"],
  ["تصنيع وصناعة", "Manufacturing & Industrial", "Industrie & Fabrication", "制造与工业"],
  ["طاقة ونفط وغاز", "Energy, Oil & Gas", "Énergie, Pétrole & Gaz", "能源与油气"],
  ["إعلام وإبداع", "Media & Creative", "Médias & Création", "媒体与创意"],
  ["حكومي وقطاع عام", "Government & Public Sector", "Secteur public", "政府与公共部门"],
  ["زراعة وبيئة", "Agriculture & Environment", "Agriculture & Environnement", "农业与环境"],
  ["تجزئة وتجارة إلكترونية", "Retail & E-commerce", "Commerce & E-commerce", "零售与电商"],
  ["أمن وسلامة", "Security & Safety", "Sécurité", "安全"],
  ["حرف مهنية وصيانة", "Skilled Trades & Maintenance", "Métiers & Maintenance", "技术工种与维修"],
  ["علوم وأبحاث", "Science & Research", "Sciences & Recherche", "科学与研究"],
  ["طيران وبحري", "Aviation & Maritime", "Aviation & Maritime", "航空与海事"],
  ["تجميل وعناية", "Beauty & Wellness", "Beauté & Bien-être", "美容与健康"],
  ["خدمات منزلية", "Domestic & Household Services", "Services domestiques", "家政服务"],
  ["أخرى", "Other", "Autre", "其他"],
];

// المدن بصيغتها القصيرة عمداً: تصفية المدينة في api/candidates.js هي
// rich_text.contains على حقل City كما كتبه صاحبه — و«مكة المكرمة» لا تطابق
// صفّاً مكتوباً فيه «مكة»، بينما «مكة» تطابق الاثنين.
const CITIES = [
  ["الرياض", "Riyadh"], ["جدة", "Jeddah"], ["مكة", "Makkah"], ["المدينة", "Madinah"],
  ["الدمام", "Dammam"], ["الخبر", "Khobar"], ["الظهران", "Dhahran"], ["الجبيل", "Jubail"],
  ["الأحساء", "Al Ahsa"], ["القطيف", "Qatif"], ["الطائف", "Taif"], ["بريدة", "Buraidah"],
  ["حائل", "Hail"], ["تبوك", "Tabuk"], ["أبها", "Abha"], ["خميس مشيط", "Khamis Mushait"],
  ["جازان", "Jazan"], ["نجران", "Najran"], ["ينبع", "Yanbu"], ["نيوم", "NEOM"],
];

// «طاهٍ متخصص في المأكولات العربية بالرياض» لا يحمل كلمة «ضيافة وسياحة»،
// فالمسمّى الوظيفي هو ما يكتبه الناس لا اسم المجال. هذه الخريطة تترجم
// المسمّى إلى مجالٍ من التصنيف الرسمي قبل أن يُرسَل إلى نوشن.
const KW = {
  "هندسة": ["مهندس", "هندس", "engineer", "engineering"],
  "تقنية معلومات": ["مبرمج", "مطور", "برمج", "تقنية", "حاسب", "شبكات", "بيانات", "developer", "programmer", "software", "devops", "data", "frontend", "backend"],
  "مبيعات وتسويق": ["مبيعات", "بائع", "تسويق", "ماركتنج", "sales", "marketing"],
  "محاسبة ومالية": ["محاسب", "محاسبة", "مالية", "accountant", "accounting", "finance"],
  "إداري وسكرتارية": ["سكرتير", "إداري", "اداري", "admin", "secretary", "receptionist"],
  "موارد بشرية": ["موارد بشرية", "recruiter", "human resources"],
  "ضيافة وسياحة": ["طاه", "طباخ", "شيف", "مطعم", "فندق", "ضيافة", "نادل", "باريستا", "سياحة", "chef", "cook", "hotel", "restaurant", "barista", "waiter", "hospitality"],
  "مقاولات وإنشاءات": ["مقاول", "إنشاء", "انشاء", "بناء", "construction", "civil"],
  "عقارات": ["عقار", "real estate", "property"],
  "صحة وطب": ["طبيب", "ممرض", "صيدل", "مختبر", "أشعة", "doctor", "nurse", "pharmac", "medical", "health"],
  "تعليم": ["معلم", "مدرس", "تعليم", "teacher", "tutor", "education"],
  "لوجستيات ونقل": ["سائق", "نقل", "شحن", "لوجست", "مستودع", "توصيل", "driver", "logistics", "warehouse", "delivery"],
  "قانون": ["محام", "قانون", "lawyer", "legal", "attorney"],
  "تصنيع وصناعة": ["مصنع", "إنتاج", "تصنيع", "صناع", "factory", "production", "manufactur"],
  "طاقة ونفط وغاز": ["نفط", "غاز", "بترول", "طاقة", "oil", "gas", "energy", "petro"],
  "إعلام وإبداع": ["مصمم", "تصميم", "جرافيك", "مونتاج", "تصوير", "محتوى", "إعلام", "designer", "graphic", "video", "content", "media"],
  "حكومي وقطاع عام": ["حكومي", "قطاع عام", "government", "public sector"],
  "زراعة وبيئة": ["زراع", "مزرعة", "بيئة", "agricult", "farm", "environment"],
  "تجزئة وتجارة إلكترونية": ["كاشير", "تجزئة", "متجر", "cashier", "retail", "ecommerce", "e-commerce"],
  "أمن وسلامة": ["حارس", "أمن ", "سلامة", "security", "guard", "safety"],
  "حرف مهنية وصيانة": ["كهربائي", "سباك", "نجار", "حداد", "فني", "صيانة", "ميكانيك", "لحام", "electrician", "plumber", "carpenter", "technician", "maintenance", "mechanic", "welder"],
  "علوم وأبحاث": ["باحث", "أبحاث", "research", "scientist"],
  "طيران وبحري": ["طيران", "طيار", "مضيف", "بحري", "ميناء", "aviation", "pilot", "cabin crew", "maritime"],
  "تجميل وعناية": ["حلاق", "كوافير", "تجميل", "مساج", "salon", "beauty", "barber", "spa"],
  "خدمات منزلية": ["عاملة منزلية", "خادمة", "منزلية", "مربية", "housemaid", "nanny", "domestic"],
};

const T = {
  title:  { ar: "التوظيف", en: "Hiring", fr: "Recrutement", zh: "招聘" },
  // عنوانٌ بلا وعدٍ مخترع: لا رقم ولا نسبة ولا «الأسرع» ولا «الأفضل».
  head:   { ar: "الكفاءة تجد عملها، والعمل يجد كفاءته",
            en: "Talent finds its work. Work finds its talent.",
            fr: "Le talent trouve son poste, le poste trouve son talent",
            zh: "人才找到工作，工作找到人才" },
  desc:   { ar: "اكتبها بكلامك العادي، ونعرض لك ما يطابقها من قاعدتنا ومن الوظائف المفتوحة الآن.",
            en: "Say it in your own words, and we show you what matches from our pool and from the vacancies open right now.",
            fr: "Dites-le avec vos mots : nous affichons ce qui correspond dans notre vivier et parmi les postes ouverts.",
            zh: "用您自己的话描述，我们会从人才库和当前开放职位中为您匹配。" },
  statW:  { ar: "مرشّح في قاعدتنا", en: "candidates in our pool", fr: "candidats dans notre vivier", zh: "位候选人在我们的人才库" },

  tabSvc: { ar: "الخدمات", en: "Services", fr: "Services", zh: "服务" },
  tabPkg: { ar: "الباقات", en: "Packages", fr: "Forfaits", zh: "套餐" },
  tabTrip:{ ar: "الرحلات", en: "Trips", fr: "Voyages", zh: "行程" },
  tabHire:{ ar: "التوظيف", en: "Hiring", fr: "Recrutement", zh: "招聘" },

  roleEmp:{ ar: "صاحب عمل", en: "Employer", fr: "Employeur", zh: "雇主" },
  roleSeek:{ ar: "باحث عن عمل", en: "Job seeker", fr: "Candidat", zh: "求职者" },

  phEmp:  { ar: "اكتب من تحتاج. مثال: طاهٍ متخصص في المأكولات العربية بالرياض",
            en: "Describe who you need. e.g. An Arabic-cuisine chef in Riyadh",
            fr: "Décrivez qui vous cherchez. Ex. : chef de cuisine arabe à Riyad",
            zh: "描述您需要的人才。例如：利雅得的阿拉伯菜厨师" },
  phSeek: { ar: "اكتب ما تبحث عنه. مثال: محاسب خبرة ٣ سنوات في جدة",
            en: "Describe what you're looking for. e.g. Accountant, 3 years, in Jeddah",
            fr: "Décrivez ce que vous cherchez. Ex. : comptable, 3 ans, à Djeddah",
            zh: "描述您想找的工作。例如：吉达的会计，3 年经验" },

  send:   { ar: "بحث", en: "Search", fr: "Rechercher", zh: "搜索" },
  soon:   { ar: "قريباً", en: "Coming soon", fr: "Bientôt", zh: "即将推出" },
  upEmp:  { ar: "رفع وصف وظيفي — قريباً", en: "Upload a job description — coming soon", fr: "Importer une fiche de poste — bientôt", zh: "上传职位描述——即将推出" },
  upSeek: { ar: "أرسل سيرتك الذاتية", en: "Send your CV", fr: "Envoyer votre CV", zh: "提交简历" },
  micOff: { ar: "الإدخال الصوتي — قريباً", en: "Voice input — coming soon", fr: "Saisie vocale — bientôt", zh: "语音输入——即将推出" },
  micStart:{ ar: "تحدّث بدل الكتابة", en: "Speak instead of typing", fr: "Parler au lieu d'écrire", zh: "语音输入" },
  micStop:{ ar: "إيقاف التسجيل", en: "Stop recording", fr: "Arrêter l'enregistrement", zh: "停止录音" },
  micRec: { ar: "نسمعك… اضغط لإيقاف التسجيل", en: "Listening… tap to stop", fr: "Écoute… appuyez pour arrêter", zh: "正在录音…点击停止" },
  micWork:{ ar: "نكتب ما قلته…", en: "Writing down what you said…", fr: "Transcription en cours…", zh: "正在转写…" },
  micQuiet:{ ar: "لم نسمع كلاماً واضحاً. حاول مرة أخرى.", en: "We didn't hear clear speech. Try again.", fr: "Aucune parole claire. Réessayez.", zh: "未听清，请重试。" },
  micLong:{ ar: "التسجيل طويل. اختصره وأعد المحاولة.", en: "Recording too long. Shorten it and retry.", fr: "Enregistrement trop long.", zh: "录音过长，请缩短。" },
  micFail:{ ar: "تعذّر تفريغ الصوت. اكتب طلبك بدلاً من ذلك.", en: "Couldn't transcribe. Type your request instead.", fr: "Transcription impossible. Écrivez votre demande.", zh: "转写失败，请改用文字。" },
  micDenied:{ ar: "لم يُسمح باستخدام الميكروفون في المتصفّح.", en: "Microphone permission was denied.", fr: "Micro refusé par le navigateur.", zh: "浏览器拒绝了麦克风权限。" },

  fAny:   { ar: "كل المجالات", en: "All fields", fr: "Tous les domaines", zh: "所有领域" },
  cAny:   { ar: "كل المدن", en: "All cities", fr: "Toutes les villes", zh: "所有城市" },
  xAny:   { ar: "أي خبرة", en: "Any experience", fr: "Toute expérience", zh: "不限经验" },
  xN:     { ar: "{n}+ سنوات", en: "{n}+ years", fr: "{n}+ ans", zh: "{n} 年以上" },
  lblCity:{ ar: "المدينة", en: "Location", fr: "Ville", zh: "城市" },
  lblField:{ ar: "المجال", en: "Field", fr: "Domaine", zh: "领域" },
  lblExp: { ar: "الخبرة", en: "Experience", fr: "Expérience", zh: "经验" },
  lblPay: { ar: "الراتب", en: "Salary", fr: "Salaire", zh: "薪资" },
  paySoon:{ ar: "الراتب غير متاح في الإعلانات بعد — قريباً",
            en: "Salary isn't published on adverts yet — coming soon",
            fr: "Le salaire n'est pas encore publié — bientôt",
            zh: "职位尚未公布薪资——即将推出" },
  expSoon:{ ar: "سنوات الخبرة غير مذكورة في الإعلانات",
            en: "Adverts don't carry years of experience",
            fr: "Les annonces n'indiquent pas l'expérience",
            zh: "职位公告未标注工作年限" },

  needNarrow:{ ar: "اختر المجال أو المدينة أولاً — قاعدة المرشّحين كبيرة، والبحث فيها كلها بطيء.",
            en: "Pick a field or a city first — the talent pool is large, and searching all of it is slow.",
            fr: "Choisissez d'abord un domaine ou une ville — le vivier est vaste.",
            zh: "请先选择领域或城市——人才库很大，全量搜索较慢。" },
  needText:{ ar: "اكتب ما تبحث عنه أولاً.", en: "Write what you're looking for first.", fr: "Écrivez d'abord ce que vous cherchez.", zh: "请先输入您要找的内容。" },
  searching:{ ar: "نبحث…", en: "Searching…", fr: "Recherche…", zh: "搜索中…" },
  failed: { ar: "تعذّر البحث الآن. حاول بعد قليل.", en: "Search failed. Try again shortly.", fr: "Échec de la recherche. Réessayez.", zh: "搜索失败，请稍后重试。" },
  noneC:  { ar: "لا مرشّح يطابق هذا الوصف الآن. وسّع المجال أو المدينة.",
            en: "No candidate matches that yet. Widen the field or the city.",
            fr: "Aucun candidat ne correspond. Élargissez le domaine ou la ville.",
            zh: "暂无匹配的候选人，请放宽领域或城市。" },
  noneJ:  { ar: "لا وظيفة مفتوحة تطابق هذا الوصف الآن — أرسل سيرتك ونرشّحك أول ما تُفتح واحدة.",
            en: "No open vacancy matches that yet — send your CV and we'll nominate you the moment one fits.",
            fr: "Aucun poste ouvert ne correspond — envoyez votre CV et nous vous proposerons dès qu'un poste s'ouvre.",
            zh: "暂无匹配的开放职位——请提交简历，一旦有合适职位我们会推荐您。" },
  foundC: { ar: "{n} مرشّحاً في قاعدتنا", en: "{n} candidates in our pool", fr: "{n} candidats dans notre vivier", zh: "人才库中 {n} 位候选人" },
  foundJ: { ar: "{n} وظيفة مفتوحة", en: "{n} open vacancies", fr: "{n} postes ouverts", zh: "{n} 个开放职位" },
  more:   { ar: "النتائج أكثر مما يُعرض — ضيّق بالمجال أو المدينة لتراها كلها.",
            en: "There are more results than shown — narrow by field or city to see them all.",
            fr: "Il y a plus de résultats — affinez par domaine ou ville.",
            zh: "结果多于显示数量——请按领域或城市缩小范围。" },

  aiBtn:  { ar: "رتّبهم بالمطابقة الذكية", en: "Rank them with AI matching", fr: "Classer par correspondance IA", zh: "用智能匹配排序" },
  aiWork: { ar: "نقرأ الملفات ونرتّبها…", en: "Reading the profiles and ranking…", fr: "Lecture et classement…", zh: "正在阅读并排序…" },
  aiFail: { ar: "المطابقة الذكية غير متاحة الآن — القائمة أعلاه مرتّبة بتقاطع الكلمات.",
            en: "AI matching isn't available right now — the list above is ranked by keyword overlap.",
            fr: "La correspondance IA est indisponible — la liste est classée par mots-clés.",
            zh: "智能匹配暂不可用——以上列表按关键词匹配排序。" },
  aiDone: { ar: "مرتَّبة بالمطابقة الذكية", en: "Ranked by AI matching", fr: "Classé par correspondance IA", zh: "已按智能匹配排序" },

  seekNoteTop:{ ar: "التقديم على أي وظيفة هنا مجاني، ولا يُطلب منك دفع شيء في أي خطوة.",
            en: "Applying to any vacancy here is free — you are never asked to pay at any step.",
            fr: "Postuler à un poste ici est gratuit — aucun paiement ne vous est jamais demandé.",
            zh: "在此申请任何职位均免费——任何环节都不会向您收费。" },
  maskNote:{ ar: "الأسماء وبيانات التواصل والسير الذاتية تظهر داخل لوحة التوظيف لأصحاب العمل المشتركين.",
            en: "Names, contact details and CVs appear inside the hiring dashboard for subscribed employers.",
            fr: "Noms, coordonnées et CV apparaissent dans le tableau de bord pour les employeurs abonnés.",
            zh: "姓名、联系方式与简历在订阅雇主的招聘面板中显示。" },

  // السطر الثانوي — يقود إلى خدمةٍ قائمة فعلاً في الكتالوج / الموقع.
  secQEmp:{ ar: "توظيف بالجملة أو منصب قيادي؟", en: "Hiring in bulk, or a leadership role?", fr: "Recrutement en volume ou poste de direction ?", zh: "批量招聘或高管职位？" },
  secBEmp:{ ar: "خدمة التوظيف والاستقدام ←", en: "Recruitment service →", fr: "Service de recrutement →", zh: "招聘与引进服务 →" },
  secQSeek:{ ar: "لم تجد وظيفتك اليوم؟", en: "Didn't find your job today?", fr: "Pas trouvé votre poste aujourd'hui ?", zh: "今天没找到合适的工作？" },
  secBSeek:{ ar: "نبحث لك بالنيابة عنك ←", en: "We search on your behalf →", fr: "Nous cherchons pour vous →", zh: "我们代您搜索 →" },
  learn:  { ar: "اعرف المزيد ↓", en: "Learn more ↓", fr: "En savoir plus ↓", zh: "了解更多 ↓" },

  ctaEmp: { ar: "افتح لوحة التوظيف ←", en: "Open the hiring dashboard →", fr: "Ouvrir le tableau de bord →", zh: "打开招聘面板 →" },
  ctaSeek:{ ar: "أرسل سيرتك الذاتية ←", en: "Send your CV →", fr: "Envoyer votre CV →", zh: "提交简历 →" },

  expY:   { ar: "خبرة", en: "Experience", fr: "Expérience", zh: "经验" },
  yrs:    { ar: "سنة", en: "yrs", fr: "ans", zh: "年" },

  // ---- الطبقة الثانية
  jobsHead:{ ar: "الوظائف المفتوحة الآن", en: "Vacancies open now", fr: "Postes ouverts", zh: "当前开放职位" },
  jobsSub:{ ar: "تتبع رقائق المدينة والمجال أعلاه — غيّرها لتتغيّر القائمة.",
            en: "Follows the city and field chips above — change them and the list follows.",
            fr: "Suit les filtres ville et domaine ci-dessus.",
            zh: "跟随上方的城市与领域筛选——更改即可更新列表。" },
  loading:{ ar: "جارٍ التحميل…", en: "Loading…", fr: "Chargement…", zh: "加载中…" },
  empty:  { ar: "لا وظائف مفتوحة الآن — أرسل سيرتك الذاتية ونرشّحك أول ما تُفتح وظيفة تناسبك.",
            en: "No vacancies open right now — send your CV and we'll nominate you the moment one fits.",
            fr: "Aucun poste ouvert — envoyez votre CV et nous vous proposerons dès qu'un poste correspond.",
            zh: "暂无开放职位——请提交简历，一旦有合适职位我们会推荐您。" },
  emptyF: { ar: "لا وظيفة تطابق هذه الفلاتر. وسّع المدينة أو المجال.",
            en: "No vacancy matches these filters. Widen the city or the field.",
            fr: "Aucun poste ne correspond à ces filtres.",
            zh: "没有符合当前筛选的职位，请放宽条件。" },
  jobsFail:{ ar: "تعذّر تحميل الوظائف الآن. حدّث الصفحة بعد قليل.",
            en: "Couldn't load vacancies right now. Refresh in a moment.",
            fr: "Impossible de charger les postes. Réessayez dans un instant.",
            zh: "暂时无法加载职位，请稍后刷新。" },
  view:   { ar: "عرض الوظيفة", en: "View job", fr: "Voir le poste", zh: "查看职位" },
  apply:  { ar: "تقديم", en: "Apply", fr: "Postuler", zh: "申请" },

};

export function buildSimpleHiring(SV1, ctx) {
  const { lang: langFn, esc } = ctx;
  const lang = langFn();

  const t = (k) => { const e = T[k]; return e[lang] != null ? e[lang] : e.en; };
  const pre = lang === "en" ? "" : "/" + lang;
  const u = (p) => pre + p;

  // ترتيب أعمدة FIELDS: ar · en · fr · zh.
  const COL = { ar: 0, en: 1, fr: 2, zh: 3 };
  const fi = COL[lang] != null ? COL[lang] : 1;
  const fieldOpts = FIELDS.map((r) => `<option value="${esc(r[0])}">${esc(r[fi] || r[1])}</option>`).join("");
  const cityOpts = CITIES.map((r) => `<option value="${esc(r[0])}">${esc(lang === "ar" ? r[0] : r[1])}</option>`).join("");
  const expOpts = [1, 3, 5, 10].map((n) => `<option value="${n}">${esc(t("xN").replace("{n}", String(n)))}</option>`).join("");

  const CSS = `<style id="sv1-hire-css">
.sv1-hh{text-align:center;max-width:840px;margin:0 auto}
.sv1-hh img{height:40px;width:auto;margin:0 auto 26px;display:block}
.sv1-hh h1{font-size:clamp(29px,5.6vw,58px);font-weight:800;letter-spacing:-.03em;line-height:1.24;margin:0;color:var(--ink);text-wrap:balance}
.sv1-hh .lead{color:var(--mut);font-weight:300;line-height:1.9;margin:14px auto 0;max-width:620px;font-size:14.5px}
.sv1-hstat{margin:16px 0 0;font-size:14px;color:var(--t);min-height:0}
.sv1-hstat b{color:var(--ac);font-family:var(--fm);font-weight:600;font-size:17px}

.sv1-hb{max-width:660px;margin:30px auto 0}
.sv1-hb-box{background:#fff;border:1px solid var(--l);border-radius:22px;box-shadow:none;overflow:hidden}
.sv1-hb-box:focus-within{border-color:var(--acLine)}
.sv1-hb-roles{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid var(--line2)}
.sv1-hb-roles button{border:0;background:transparent;padding:14px 10px;font-family:inherit;font-size:13.5px;font-weight:500;color:var(--faint);cursor:pointer;position:relative;transition:color .15s}
.sv1-hb-roles button::after{content:"";position:absolute;inset-inline:22%;bottom:-1px;height:2px;background:transparent;border-radius:2px}
.sv1-hb-roles button.on{color:var(--ac);font-weight:600}
.sv1-hb-roles button.on::after{background:var(--ac)}
.sv1-hb-pad{padding:14px}
.sv1-hb-pad textarea{width:100%;box-sizing:border-box;border:1px solid transparent;background:var(--soft);border-radius:14px;outline:0;resize:none;font:inherit;font-size:14.5px;line-height:1.75;color:var(--t);padding:14px 15px;height:96px;max-height:200px;display:block}
.sv1-hb-pad textarea:focus{border-color:var(--acLine)}
.sv1-hb-pad textarea::placeholder{color:var(--faint)}
.sv1-hb-acts{display:flex;justify-content:flex-end;gap:8px;margin-top:11px}
.sv1-hb-acts .rb{width:42px;height:42px;border-radius:50%;flex:none;display:grid;place-items:center;font-size:15px;cursor:pointer;font-family:inherit;text-decoration:none;border:1px solid var(--l);background:#fff;color:var(--ink);transition:.15s}
.sv1-hb-acts .rb:hover{border-color:var(--ac);color:var(--ac)}
.sv1-hb-acts .rb.off,.sv1-hb-acts .rb[disabled]{opacity:.42;cursor:not-allowed;border-color:var(--l);color:var(--faint)}
.sv1-hb-acts .rb.go{border:0;background:var(--ac);color:#fff;font-size:17px;box-shadow:0 6px 18px -7px rgba(11,27,90,.5)}
.sv1-hb-acts .rb.go:hover{background:var(--ac2);color:#fff}
.sv1-hb-acts .rb.rec{background:#b42318;border-color:#b42318;color:#fff;animation:sv1mic 1.4s ease-in-out infinite}

.sv1-hchips{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;max-width:470px;margin:16px auto 0}
.sv1-hchip{display:flex;align-items:center;gap:7px;border:1px solid var(--l);border-radius:999px;padding-block:7px;padding-inline:14px 8px;background:#fff;font-size:11.5px;color:var(--mut);transition:.15s}
.sv1-hchip.set{border-color:var(--acLine);background:var(--acSoft);color:var(--ac)}
.sv1-hchip.off{opacity:.5}
.sv1-hchip .ic{font-size:12.5px;flex:none}
.sv1-hchip select{flex:1;min-width:0;border:0;outline:0;background:transparent;font:inherit;font-size:12px;color:var(--ink);font-family:inherit;cursor:pointer}
.sv1-hchip select:disabled{cursor:not-allowed;color:var(--faint)}

.sv1-hportal{text-align:center;margin:20px auto 0}
.sv1-hsec2{display:flex;flex-wrap:wrap;gap:11px;align-items:center;justify-content:center;margin:20px auto 0;padding-top:18px;border-top:1px solid var(--line2);max-width:560px;font-size:13px;color:var(--mut)}
.sv1-hmore{display:block;text-align:center;margin:26px auto 0;font-size:12.5px;color:var(--ac);background:0;border:0;font-family:inherit;cursor:pointer;text-decoration:none}
.sv1-hnote{margin:14px auto 0;max-width:600px;font-size:12px;color:var(--ac);background:var(--acSoft);border:1px solid var(--acLine);border-radius:10px;padding:9px 13px;line-height:1.7;text-align:center}
.sv1-hhint{margin:12px auto 0;max-width:620px;font-size:11.5px;color:var(--faint);line-height:1.7;text-align:center}

.sv1-hb-out{margin:34px auto 0;max-width:1000px}
/* شريط تبويبات الكتالوج صار تحت الصندوق: هو الفاصل بين الصندوق وقسم
   الوظائف، فلا يحتاج القسم بعده خطّاً ولا فجوةً ثانية. */
.sv1 .sv1-tabs{margin-top:56px}
#hireJobs{margin-top:18px;border-top:0;padding-top:0}
.sv1-hb-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin:0 0 13px;font-size:12.5px;color:var(--mut)}
.sv1-hire-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px}
.sv1-hire-job{background:#fff;border:1px solid var(--l);border-radius:14px;padding:17px;box-shadow:var(--sh);display:flex;flex-direction:column;gap:8px}
.sv1-hire-job .tp{display:flex;align-items:center;gap:8px}
.sv1-hire-job .mt{font-size:11.5px;color:var(--ac);font-weight:600}
.sv1-hire-job .sc{margin-inline-start:auto;font-family:var(--fm);font-size:11px;color:var(--ac);background:var(--acSoft);border-radius:999px;padding:2px 9px}
.sv1-hire-job h4{font-size:15px;margin:0;font-weight:600;color:var(--ink);line-height:1.5}
.sv1-hire-job p{font-size:12.5px;color:var(--s);margin:0;line-height:1.65}
.sv1-hire-job .why{font-size:12px;color:var(--ac);background:var(--acSoft);border-radius:8px;padding:7px 10px;line-height:1.6;margin:0}
.sv1-hire-job .acts{display:flex;gap:7px;margin-top:auto;padding-top:6px}

.sv1-hire-sec{border-top:1px solid var(--line2);padding-top:34px;margin-top:56px}
.sv1-hire-sec>h3{font-size:21px;font-weight:500;color:var(--ink);margin:0 0 8px}
.sv1-hire-sec>.sub{font-size:13px;color:var(--mut);margin:0 0 18px;line-height:1.8;max-width:680px}
@media(max-width:520px){.sv1-hchips{grid-template-columns:1fr}}
</style>`;

  const chip = (id, icon, label, opts, any, extra) => `<label class="sv1-hchip" id="${id}Chip"${extra || ""}>
        <span class="ic" aria-hidden="true">${icon}</span><span>${esc(label)}</span>
        <select id="${id}" aria-label="${esc(label)}"><option value="">${esc(any)}</option>${opts}</select>
      </label>`;

  const body = `${SV1.header("/hiring")}
  <main>
  <section class="sv1-sec"><div class="wrap">

    <div class="sv1-hh">
      <img src="/assets/img/logo.png" alt="Business Partner" width="180" height="34">
      <h1>${esc(t("head"))}</h1>
      <p class="sv1-hstat sv1-hide" id="hireStat"></p>
      <p class="lead">${esc(t("desc"))}</p>
    </div>

    <div class="sv1-hb">
      <form class="sv1-hb-box" id="hireForm">
        <div class="sv1-hb-roles" role="tablist">
          <button type="button" id="hireRoleEmp" class="on" role="tab" aria-selected="true">${esc(t("roleEmp"))}</button>
          <button type="button" id="hireRoleSeek" role="tab" aria-selected="false">${esc(t("roleSeek"))}</button>
        </div>
        <div class="sv1-hb-pad">
          <div class="sv1-voice" id="hireVoice" style="margin:0 0 9px"></div>
          <textarea id="hireQ" rows="3" placeholder="${esc(t("phEmp"))}" aria-label="${esc(t("phEmp"))}"></textarea>
          <div class="sv1-hb-acts">
            <a class="rb off" id="hireUp" href="${esc(u("/careers"))}#seeker-form" aria-label="${esc(t("upEmp"))}" title="${esc(t("upEmp"))}" aria-disabled="true">📎</a>
            <button type="button" class="rb off" id="hireMic" disabled aria-label="${esc(t("micOff"))}" title="${esc(t("micOff"))}">🎙</button>
            <button type="submit" class="rb go" id="hireGo" aria-label="${esc(t("send"))}" title="${esc(t("send"))}">↑</button>
          </div>
        </div>
      </form>

      <div class="sv1-hchips">
        ${chip("hireCity", "📍", t("lblCity"), cityOpts, t("cAny"))}
        ${chip("hireField", "🗂", t("lblField"), fieldOpts, t("fAny"))}
        ${chip("hireExp", "⏳", t("lblExp"), expOpts, t("xAny"))}
        ${chip("hirePay", "💰", t("lblPay"), "", t("soon"), ` title="${esc(t("paySoon"))}"`)}
      </div>

      <p class="sv1-hnote sv1-hide" id="hireNote"></p>

      <div class="sv1-hportal">
        <a class="sv1-btn sm" id="hirePortal" href="${esc(u("/hr/employer"))}">${esc(t("ctaEmp"))}</a>
      </div>

      <div class="sv1-hsec2">
        <span id="hireSecQ">${esc(t("secQEmp"))}</span>
        <a class="sv1-btn sm" id="hireSecB" href="${esc(u("/services/rec-gen"))}">${esc(t("secBEmp"))}</a>
      </div>

      <p class="sv1-hhint" id="hireHint">${esc(t("maskNote"))}</p>
      <a class="sv1-hmore" id="hireMore" href="#hireJobs">${esc(t("learn"))}</a>
    </div>

    <div class="sv1-hb-out">
      <div class="sv1-hb-bar sv1-hide" id="hireBar">
        <span id="hireCount"></span>
        <button type="button" class="sv1-btn sm sv1-hide" id="hireAi">${esc(t("aiBtn"))}</button>
      </div>
      <p class="sv1-muted sv1-hide" id="hireStatus"></p>
      <div class="sv1-hire-grid" id="hireResults"></div>
    </div>

    <div class="sv1-tabs">
      <a class="sv1-tab" href="${esc(u("/catalog"))}">${esc(t("tabSvc"))}</a>
      <a class="sv1-tab" href="${esc(u("/catalog"))}?tab=packages">${esc(t("tabPkg"))}</a>
      <a class="sv1-tab" href="${esc(u("/trips"))}">${esc(t("tabTrip"))}</a>
      <button type="button" class="sv1-tab on">${esc(t("tabHire"))}</button>
    </div>

    <div class="sv1-hire-sec" id="hireJobs">
      <h3>${esc(t("jobsHead"))}</h3>
      <p class="sub">${esc(t("jobsSub"))}</p>
      <p class="sv1-muted" id="hireJobsStatus">${esc(t("loading"))}</p>
      <div class="sv1-hire-grid" id="hireJobsGrid"></div>
    </div>

  </div></section>
  </main>`;

  const TX = {
    phEmp: t("phEmp"), phSeek: t("phSeek"),
    secQEmp: t("secQEmp"), secBEmp: t("secBEmp"), secQSeek: t("secQSeek"), secBSeek: t("secBSeek"),
    maskNote: t("maskNote"), seekNoteTop: t("seekNoteTop"), upEmp: t("upEmp"), upSeek: t("upSeek"),
    statW: t("statW"), expSoon: t("expSoon"), xAny: t("xAny"),
    ctaEmp: t("ctaEmp"), ctaSeek: t("ctaSeek"),
    needNarrow: t("needNarrow"), needText: t("needText"),
    searching: t("searching"), failed: t("failed"),
    noneC: t("noneC"), noneJ: t("noneJ"), foundC: t("foundC"), foundJ: t("foundJ"),
    more: t("more"),
    aiWork: t("aiWork"), aiFail: t("aiFail"), aiDone: t("aiDone"),
    empty: t("empty"), emptyF: t("emptyF"), jobsFail: t("jobsFail"), loading: t("loading"),
    view: t("view"), apply: t("apply"), expY: t("expY"), yrs: t("yrs"),
    micStart: t("micStart"), micStop: t("micStop"), micRec: t("micRec"), micWork: t("micWork"),
    micQuiet: t("micQuiet"), micLong: t("micLong"), micFail: t("micFail"), micDenied: t("micDenied"),
  };

  const script = `<script>(function(){
var $=function(i){return document.getElementById(i)};
var LANG=${JSON.stringify(lang)};
var TX=${JSON.stringify(TX)};
var KW=${JSON.stringify(KW)};
var CITIES=${JSON.stringify(CITIES)};
var JOB=${JSON.stringify(u("/job") + "?id=")};
var EMP=${JSON.stringify(u("/hr/employer"))};
var SEEKCV=${JSON.stringify(u("/careers") + "#seeker-form")};
var SVC_EMP=${JSON.stringify(u("/services/rec-gen"))};
var SVC_SEEK=${JSON.stringify(u("/job-search-service"))};
var MAXSHOW=24;

function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){
 return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function show(el,on){if(el)el.classList.toggle('sv1-hide',!on)}
function nfmt(s,n){return String(s).replace('{n}',String(n))}

var role='emp';
var q=$('hireQ'),fSel=$('hireField'),cSel=$('hireCity'),xSel=$('hireExp'),paySel=$('hirePay');
var xChip=$('hireExpChip'),payChip=$('hirePayChip');
var bar=$('hireBar'),cnt=$('hireCount'),aiBtn=$('hireAi'),st=$('hireStatus'),out=$('hireResults');
var note=$('hireNote'),hint=$('hireHint'),up=$('hireUp'),mic=$('hireMic');
var secQ=$('hireSecQ'),secB=$('hireSecB'),portal=$('hirePortal');
var lastRows=[],lastQuery='',busy=false;

// الراتب معروضٌ ومعطّل: لا حقل راتب في إعلانات نوشن ولا في ردّ المرشّحين.
paySel.disabled=true;payChip.classList.add('off');

// ---- تفسير الكلام العادي: المسمّى الوظيفي والمدينة وعدد السنوات.
function norm(s){return String(s||'').toLowerCase().replace(/[\\u064B-\\u0652\\u0640]/g,'').replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')}
function derive(text){
 var n=norm(text),o={field:'',city:'',exp:''};
 for(var f in KW){var ws=KW[f];for(var i=0;i<ws.length;i++){if(n.indexOf(norm(ws[i]))>=0){o.field=f;break}}if(o.field)break}
 for(var j=0;j<CITIES.length;j++){
  if(n.indexOf(norm(CITIES[j][0]))>=0||n.indexOf(norm(CITIES[j][1]))>=0){o.city=CITIES[j][0];break}}
 var m=n.match(/(\\d+)\\s*\\+?\\s*(سنه|سنوات|سنين|year|yrs|ans|年)/);
 if(m){var y=parseInt(m[1],10)||0;o.exp=y>=10?'10':y>=5?'5':y>=3?'3':y>=1?'1':''}
 return o}

function tokens(text){
 return norm(text).split(/[^\\p{L}\\p{N}]+/u).filter(function(w){return w.length>2}).slice(0,14)}
function score(text,hay){
 var ws=tokens(text),h=norm(hay),s=0;
 for(var i=0;i<ws.length;i++)if(h.indexOf(ws[i])>=0)s++;
 return s}
function years(v){var m=String(v==null?'':v).match(/\\d+/);return m?parseInt(m[0],10):null}
function markChip(sel){var c=sel.closest('label');if(c)c.classList.toggle('set',!!sel.value&&!sel.disabled)}

function setRole(r){
 role=r;
 $('hireRoleEmp').classList.toggle('on',r==='emp');
 $('hireRoleSeek').classList.toggle('on',r==='seek');
 $('hireRoleEmp').setAttribute('aria-selected',r==='emp'?'true':'false');
 $('hireRoleSeek').setAttribute('aria-selected',r==='seek'?'true':'false');
 q.placeholder=r==='emp'?TX.phEmp:TX.phSeek;
 q.setAttribute('aria-label',q.placeholder);
 // إعلانات الوظائف لا تحمل سنوات خبرة، فالرقاقة تُعطَّل في تبويب الباحث
 // بدل أن تصفّي على حقلٍ لا وجود له فتُخفي وظائف بلا سبب.
 var offX=(r==='seek');
 xSel.disabled=offX;xChip.classList.toggle('off',offX);
 xChip.title=offX?TX.expSoon:'';
 if(offX){xSel.value='';markChip(xSel)}
 // رفع الملف: نموذج السيرة الذاتية قائم فعلاً في /careers؛ رفع وصفٍ وظيفي
 // لصاحب العمل غير مبنيّ، فيُعطَّل الزرّ بدل أن يقود إلى لا شيء.
 var seek=(r==='seek');
 up.classList.toggle('off',!seek);
 up.setAttribute('aria-disabled',seek?'false':'true');
 up.setAttribute('title',seek?TX.upSeek:TX.upEmp);
 up.setAttribute('aria-label',seek?TX.upSeek:TX.upEmp);
 up.setAttribute('href',seek?SEEKCV:'#');
 // طريق أصحاب العمل الحاليين إلى لوحتهم لا ينقطع: البطاقات الثلاث اختُصرت
 // إلى صندوق، ورابط /hr/employer انتقل داخل تبويب صاحب العمل ولم يُحذف.
 portal.textContent=seek?TX.ctaSeek:TX.ctaEmp;
 portal.href=seek?SEEKCV:EMP;
 secQ.textContent=seek?TX.secQSeek:TX.secQEmp;
 secB.textContent=seek?TX.secBSeek:TX.secBEmp;
 secB.href=seek?SVC_SEEK:SVC_EMP;
 hint.textContent=seek?TX.seekNoteTop:TX.maskNote;
 out.innerHTML='';show(bar,false);show(st,false);show(note,false);lastRows=[]}

up.addEventListener('click',function(e){if(up.classList.contains('off'))e.preventDefault()});
$('hireRoleEmp').onclick=function(){setRole('emp')};
$('hireRoleSeek').onclick=function(){setRole('seek')};
[fSel,cSel,xSel].forEach(function(s){s.addEventListener('change',function(){markChip(s);if(jobsCache)paintBoard()})});

q.addEventListener('input',function(){q.style.height='auto';q.style.height=Math.min(200,q.scrollHeight)+'px'});
q.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();
 if($('hireForm').requestSubmit)$('hireForm').requestSubmit();else $('hireGo').click()}});

function say(msg){note.textContent=msg||'';show(note,!!msg)}

// ---- سطر الإحصاء: رقمٌ حيّ أو لا شيء. ?count=1 مخزَّن على الحافة ساعةً،
// ويعيد done:false حين ينفد وقته دون أن يُكمل العدّ — ورقمٌ ناقص معروضٌ
// كأنه الحجم الكامل كذبةٌ صغيرة تتكرّر مع كل زائر.
fetch('/api/candidates?count=1').then(function(r){return r.json()}).then(function(d){
 if(!d||!d.ok||!d.done||!(d.total>0))return;
 var el=$('hireStat');
 // أرقام لاتينية في اللغات الأربع: الكتالوج والأسعار والفواتير كلها كذلك،
 // ورقمٌ هنديٌّ وحيد في صفحةٍ أرقامُها لاتينية يبدو خطأً لا خياراً.
 el.innerHTML='<b>'+esc(Number(d.total).toLocaleString('en-US'))+'</b> '+esc(TX.statW);
 show(el,true)}).catch(function(){});

// ---- بطاقات
function candCard(c){
 var meta=[c.field,c.city].filter(Boolean).join(' · ');
 var yr=years(c.experience);
 var line=[yr!=null?TX.expY+' '+yr+' '+TX.yrs:'',c.education||''].filter(Boolean).join(' · ');
 return '<article class="sv1-hire-job"><div class="tp">'+
  (meta?'<span class="mt">'+esc(meta)+'</span>':'')+
  (c._score!=null?'<span class="sc">'+esc(String(c._score))+'%</span>':'')+'</div>'+
  '<h4>'+esc(c.role||c.field||'—')+'</h4>'+
  (line?'<p>'+esc(line)+'</p>':'')+
  (c.skills?'<p>'+esc(String(c.skills).slice(0,120))+'</p>':'')+
  (c._why?'<p class="why">'+esc(c._why)+'</p>':'')+
  '</article>'}

function jobCard(j){
 var meta=[j.company,j.city].filter(Boolean).join(' · ')||(j.field||'');
 var teaser=String(j.description||'').replace(/\\s+/g,' ').trim().slice(0,140);
 return '<article class="sv1-hire-job">'+(meta?'<span class="mt">'+esc(meta)+'</span>':'')+
  '<h4>'+esc(j.title)+'</h4>'+(teaser?'<p>'+esc(teaser)+'…</p>':'')+
  '<div class="acts"><a class="sv1-btn sm" href="'+JOB+encodeURIComponent(j.id)+'">'+esc(TX.view)+'</a>'+
  '<a class="sv1-btn sm primary" href="'+JOB+encodeURIComponent(j.id)+'#apply-form">'+esc(TX.apply)+'</a></div></article>'}

// ---- الوظائف المفتوحة: طلبٌ واحد يخدم تبويب الباحث ولوحة الطبقة الثانية.
var jobsCache=null,jobsWait=null;
function loadJobs(){
 if(jobsCache)return Promise.resolve(jobsCache);
 if(jobsWait)return jobsWait;
 jobsWait=fetch('/api/candidates?openJobs=1').then(function(r){return r.json()}).then(function(d){
  jobsCache=(d&&d.ok&&d.jobs)||[];return jobsCache});
 return jobsWait}

function filterJobs(jobs,f,c){
 return jobs.filter(function(j){
  if(f&&j.field&&j.field!==f)return false;
  if(c&&String(j.city||'').indexOf(c)<0)return false;
  return true})}

function paintBoard(){
 var g=$('hireJobsGrid'),s=$('hireJobsStatus');
 s.textContent=TX.loading;s.hidden=false;
 loadJobs().then(function(jobs){
  if(!jobs.length){g.innerHTML='';s.textContent=TX.empty;return}
  var rows=filterJobs(jobs,fSel.value,cSel.value);
  if(!rows.length){g.innerHTML='';s.textContent=TX.emptyF;return}
  s.hidden=true;g.innerHTML=rows.map(jobCard).join('')
 }).catch(function(){g.innerHTML='';s.textContent=TX.jobsFail})}

// الطبقة الثانية أسفل الصفحة، فلا تُجلب حتى يصل إليها الزائر.
(function(){
 var sec=$('hireJobs'),done=false;
 function go(){if(done)return;done=true;paintBoard()}
 if(!('IntersectionObserver' in window)){go();return}
 var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){io.disconnect();go()}})},{rootMargin:'320px'});
 io.observe(sec)})();

// ---- البحث
function searchJobs(text,f,c){
 st.textContent=TX.searching;show(st,true);out.innerHTML='';show(bar,false);
 loadJobs().then(function(jobs){
  var rows=filterJobs(jobs,f,c);
  if(text)rows=rows.map(function(j){return {j:j,s:score(text,(j.title||'')+' '+(j.field||'')+' '+(j.description||''))}})
   .sort(function(a,b){return b.s-a.s}).map(function(x){return x.j});
  show(st,false);
  if(!rows.length){st.textContent=TX.noneJ;show(st,true);return}
  show(bar,true);show(aiBtn,false);
  cnt.textContent=nfmt(TX.foundJ,rows.length);
  out.innerHTML=rows.slice(0,MAXSHOW).map(jobCard).join('');
  say(rows.length>MAXSHOW?TX.more:'')
 }).catch(function(){st.textContent=TX.failed;show(st,true)})}

function searchCands(text,f,c,x){
 st.textContent=TX.searching;show(st,true);out.innerHTML='';show(bar,false);
 var p='/api/candidates?'+(f?'field='+encodeURIComponent(f):'')+(c?(f?'&':'')+'city='+encodeURIComponent(c):'');
 fetch(p).then(function(r){return r.json()}).then(function(d){
  if(!d||!d.ok)throw new Error('bad');
  var rows=d.candidates||[];
  if(x){var n=parseInt(x,10);rows=rows.filter(function(r2){var y=years(r2.experience);return y!=null&&y>=n})}
  if(text)rows=rows.map(function(r2){return {r:r2,s:score(text,(r2.role||'')+' '+(r2.field||'')+' '+(r2.skills||''))}})
   .sort(function(a,b){return b.s-a.s}).map(function(z){return z.r});
  show(st,false);
  if(!rows.length){st.textContent=TX.noneC;show(st,true);return}
  lastRows=rows;lastQuery=text;
  show(bar,true);show(aiBtn,true);aiBtn.disabled=false;
  cnt.textContent=nfmt(TX.foundC,rows.length);
  out.innerHTML=rows.slice(0,MAXSHOW).map(candCard).join('');
  say((rows.length>MAXSHOW||d.done===false)?TX.more:'')
 }).catch(function(){st.textContent=TX.failed;show(st,true)})}

$('hireForm').addEventListener('submit',function(e){
 e.preventDefault();
 if(busy)return;
 var text=q.value.trim();
 var d=derive(text);
 // الرقاقة التي اختارها الزائر بنفسه أقوى من استنتاجنا من كلامه.
 if(!fSel.value&&d.field){fSel.value=d.field;markChip(fSel)}
 if(!cSel.value&&d.city){cSel.value=d.city;markChip(cSel)}
 if(role==='emp'&&!xSel.value&&d.exp){xSel.value=d.exp;markChip(xSel)}
 var f=fSel.value,c=cSel.value,x=(role==='emp'?xSel.value:'');
 if(!text&&!f&&!c){say(TX.needText);q.focus();return}
 if(role==='emp'&&!f&&!c){say(TX.needNarrow);fSel.focus();return}
 say('');
 if(jobsCache)paintBoard();
 if(role==='emp')searchCands(text,f,c,x);else searchJobs(text,f,c)});

// ---- المطابقة الذكية: نداءٌ مدفوع، فلا يُطلق إلا بضغطة من الزائر.
aiBtn.onclick=function(){
 if(busy||!lastRows.length)return;
 busy=true;aiBtn.disabled=true;
 var prev=aiBtn.textContent;aiBtn.textContent=TX.aiWork;
 var sent=lastRows.slice(0,120);
 fetch('/api/hire',{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({task:'match',lang:LANG,role:lastQuery||[fSel.value,cSel.value].filter(Boolean).join(' '),candidates:sent})})
 .then(function(r){return r.json()}).then(function(o){
  var ranked=(o&&o.ok&&o.ranked)||[];
  if(!ranked.length)throw new Error('empty');
  var by={};sent.forEach(function(c){by[c.id]=c});
  var rows=[];
  ranked.forEach(function(m){var c=by[m.id];if(!c)return;
   c._score=Math.max(0,Math.min(100,Math.round(Number(m.score)||0)));
   c._why=String(m.reason||'').slice(0,220);rows.push(c)});
  if(!rows.length)throw new Error('nomatch');
  cnt.textContent=TX.aiDone+' · '+nfmt(TX.foundC,rows.length);
  out.innerHTML=rows.map(candCard).join('');
  show(aiBtn,false);say('')
 }).catch(function(){aiBtn.textContent=prev;say(TX.aiFail)})
 .then(function(){busy=false;aiBtn.disabled=false})};

// ---- الميكروفون: الزرّ مرسومٌ دائماً (اللقطة فيها ثلاثة أزرار) لكنه يبدأ
// معطّلاً، ولا يُفعَّل إلا بعد أن يؤكّد الخادم أن المفرِّغ مُهيَّأ — ولا
// يُسأل الخادم إلا حين يلمس الزائر الصندوق.
(function(){
 var CAN=!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia&&window.MediaRecorder);
 if(!CAN)return;
 var asked=false,ready=false;
 function enable(){ready=true;mic.disabled=false;mic.classList.remove('off');
  mic.setAttribute('aria-label',TX.micStart);mic.setAttribute('title',TX.micStart)}
 function disable(){ready=false;mic.disabled=true;mic.classList.add('off')}
 q.addEventListener('focus',function(){
  if(asked)return;asked=true;
  fetch('/api/chat').then(function(r){return r.json()}).then(function(o){
   var v=(o&&o.voice)||[];
   if(v.some(function(p){return p&&p.configured}))enable()}).catch(function(){})});

 var strip=$('hireVoice'),rec=null,chunks=[],tick=null,t0=0,stream=null;
 function say2(cls,txt,timer){strip.className='sv1-voice on'+(cls?' '+cls:'');strip.textContent='';
  if(cls!=='err'){var dd=document.createElement('span');dd.className='dot';strip.appendChild(dd)}
  var s=document.createElement('span');s.textContent=txt;strip.appendChild(s);
  if(timer){var e=document.createElement('span');e.className='t';e.id='hireVoiceT';e.textContent='0:00';strip.appendChild(e)}}
 function hide2(){strip.className='sv1-voice';strip.textContent=''}
 function stopTracks(){if(stream){try{stream.getTracks().forEach(function(t2){t2.stop()})}catch(e){}stream=null}}
 function pickType(){var c=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'];
  for(var i=0;i<c.length;i++){try{if(window.MediaRecorder.isTypeSupported(c[i]))return c[i]}catch(e){}}return ''}
 function reset(){mic.classList.remove('rec');mic.disabled=!ready;
  mic.setAttribute('aria-label',TX.micStart);
  if(tick){clearInterval(tick);tick=null}stopTracks();rec=null}
 function upload(blob,type){
  if(blob.size<1200){reset();say2('err',TX.micQuiet);return}
  if(blob.size>12*1024*1024){reset();say2('err',TX.micLong);return}
  mic.classList.remove('rec');mic.disabled=true;say2('',TX.micWork);
  var fr=new FileReader();
  fr.onerror=function(){reset();say2('err',TX.micFail)};
  fr.onload=function(){
   var b64=String(fr.result||'').split(',')[1]||'';
   fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({mode:'voice',mime:type||'audio/webm',lang:LANG,audio:b64})})
   .then(function(r){return r.json()}).then(function(o){
    if(!o||!o.ok){var e2=o&&o.error;
     if(e2==='not_configured')disable();
     reset();
     say2('err',e2==='no_speech'?TX.micQuiet:e2==='too_large'?TX.micLong:TX.micFail);return}
    reset();hide2();
    q.value=(q.value?q.value.replace(/\\s*$/,' '):'')+o.text;
    q.focus();q.style.height='auto';q.style.height=Math.min(200,q.scrollHeight)+'px'})
   .catch(function(){reset();say2('err',TX.micFail)})};
  fr.readAsDataURL(blob)}
 function start(){
  navigator.mediaDevices.getUserMedia({audio:true}).then(function(s){
   stream=s;var type=pickType();chunks=[];
   try{rec=type?new MediaRecorder(s,{mimeType:type}):new MediaRecorder(s)}catch(e){rec=new MediaRecorder(s)}
   var used=rec.mimeType||type||'audio/webm';
   rec.ondataavailable=function(e){if(e.data&&e.data.size)chunks.push(e.data)};
   rec.onstop=function(){upload(new Blob(chunks,{type:used}),used)};
   rec.start();
   mic.classList.add('rec');mic.setAttribute('aria-label',TX.micStop);
   t0=Date.now();say2('',TX.micRec,true);
   tick=setInterval(function(){
    var sec=Math.floor((Date.now()-t0)/1000),el=document.getElementById('hireVoiceT');
    if(el)el.textContent=Math.floor(sec/60)+':'+('0'+(sec%60)).slice(-2);
    if(sec>=120&&rec&&rec.state==='recording')rec.stop()
   },500)}).catch(function(){say2('err',TX.micDenied)})}
 mic.onclick=function(){
  if(!ready)return;
  if(rec&&rec.state==='recording'){if(tick){clearInterval(tick);tick=null}rec.stop();return}
  hide2();start()}})();

$('hireMore').onclick=function(e){e.preventDefault();
 var el=$('hireJobs');if(el)el.scrollIntoView({behavior:'smooth',block:'start'})};

setRole('emp');
})();</script>`;

  return SV1.shell({
    title: `${t("title")} — Business Partner`,
    desc: t("desc"),
    path: "/hiring",
    body: CSS + body,
    script,
  });
}
