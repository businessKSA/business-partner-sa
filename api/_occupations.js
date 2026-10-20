/* ═════════════════════ المهنة الموحَّدة — تصنيف المسمّيات الوظيفية ═════════════════════
 * api/_occupations.js — يملكه `recruitment-candidate`. وحدةٌ صِرفة: لا شبكة ولا قاعدة
 * بيانات ولا ملفات، فيستوردها كلُّ من يحتاجها (الاستيراد في candidate.js، والبحث في
 * candidates.js لصاحب بوابة صاحب العمل، والباك فيل) ويحصل على الجواب نفسه.
 *
 * لماذا: جدول المرشّحين في Notion فيه ٧٤٦٢ مسمّىً مختلفاً في «Original Position» لنحو ١٧ ألف
 * سيرة، والمسمّى الواحد يُكتب بعشر صيغ (CDP، Chef de Partie، شيف دي بارتي، شيف قسم، Demi CDP...)
 * فلا بحثٌ ولا مطابقةٌ تعمل عليه. المطلوب مهنةٌ واحدة لكل مرشّح، بعرضٍ عربي وإنجليزي، تُعتمد
 * في البحث والمطابقة بدل النصّ الحرّ.
 *
 * ما هي «المهنة» هنا (القواعد التي حُسمت، وتبريرها):
 *  • الجمع/المفرد والإملاء والترجمة والمختصرات والمؤنّث والمذكّر ⇒ مهنةٌ واحدة.
 *  • Senior / Junior / Assistant / Lead ⇒ **مستوى** (`level`) لا مهنة مستقلة، إلا إن كانت
 *    مرتبةً مهنيةً قياسية بذاتها في القطاع:
 *      - سلّم المطبخ: Commis ← Demi CDP ← CDP ← Sous Chef ← Executive Sous ← Head Chef ←
 *        Executive Chef. كلٌّ مهنةٌ مستقلة (Demi CDP مرتبةٌ قائمة بذاتها، و«Junior Sous»
 *        و«Senior CDP» مستويان لا مرتبتان).
 *      - سلّم الصالة: Runner ← Waiter ← Captain ← Head Waiter ← Supervisor ← Manager.
 *      - سلّم الحلويات: Pastry Commis ← Pastry CDP ← Pastry Chef ← Pastry Sous ← Head/Executive.
 *      - خارج الضيافة: لكل مجال «أخصائي/مسؤول/منسّق/منفّذ» = مهنةٌ واحدة، و«مشرف» مهنةٌ،
 *        و«مدير/رئيس قسم/مدير إدارة» مهنةٌ. أما Director/VP فتُدمج في المدير (ويُغني
 *        `level` و`searchOccupations` عن مهنةٍ ثانية)، ما عدا التنفيذيين (CEO وCOO وCFO) فمهنٌ مستقلة.
 *  • الاسم الذي يخصّ مرتبةً قياسية: «محاسب رئيسي / Chief Accountant» مرتبةٌ بذاتها بين
 *    المحاسب والمدير المالي، فتبقى مستقلة.
 *  • لا تخمين: المسمّى العامّ (manager، مشرف، specialist، موظف) وما لا يُعرف و«متدرّب/طالب/
 *    خريج» ⇒ `unclassified` بسببٍ في `via`. من آخر خبرته «تدريب» تُؤخذ مهنته من نصّ السيرة
 *    لا من العنوان (انظر خطة الباك فيل).
 *
 * التعامل مع المدخل: يُشتقّ الدور من أول مقطعٍ قبل جهة العمل (« - »، « — »، « at »، «@»، «في»)،
 * وتُهمَل الأقواس إلا لتوضيحٍ عند الحاجة، ويُؤخذ أول بديلٍ في «/» و«،». «مهنته = آخر منصب»:
 * هذا مسؤولية المُدخِل (Original Position)، لا هذه الوحدة؛ هي تُوحّد التسمية فقط.
 *
 * الواجهة: `canonicalOccupation(title, {field})` ← {id, nameAr, nameEn, sector, level, confidence, via}؛
 * `occupationOptionName(id)` اسم الخيار في عمود «المهنة الموحّدة»؛ `OCCUPATIONS` القائمة المرجعية؛
 * `searchOccupations(نصّ)` مهنٌ تطابق ما يكتبه صاحب العمل في خانة البحث؛ `occupationLadder(id)` المرتبة
 * المجاورة في السلّم المهني؛ `titleKey` مفتاح المسمّى كما في Notion. `via` يقول كيف وصلنا: alias (مطابقة تامة) · contain (عبارة داخل
 * مسمّىً أطول) · family (مجالٌ × مرتبة) · order (ترتيب كلماتٍ مختلف) · domain (مجالٌ بلا مرتبة) · alt (بديلٌ
 * ثانٍ في «/») · trainee/nojob/generic/none/empty (غير مصنّف، وسببه).
 *
 * ⚠️ أي إضافة هنا تُغيّر `OCC_VERSION`، وتُعاد معها خريطة api/_occupation-map.json (يفحص
 * tests/occupations.test.mjs أنهما متطابقتان). الخريطة في api/ لا في site/ عمداً: مفاتيحها مسمّياتٌ حقيقية
 * من سير مرشّحين فيها أسماء جهات عملهم، و`site/` يُنشر علناً.
 */

export const OCC_VERSION = "2026-10-01.2";

const H = "ضيافة ومطاعم", HT = "ضيافة وسياحة", AD = "إداري وسكرتارية", FI = "محاسبة ومالية";
const SM = "مبيعات وتسويق", HR = "موارد بشرية", LG = "لوجستيات ونقل", EN = "هندسة";
const IT = "تقنية معلومات", CN = "مقاولات وإنشاءات", ED = "تعليم", HL = "صحة وطب";
const GV = "حكومي وقطاع عام", AG = "زراعة وبيئة", TR = "حرف مهنية وصيانة", LW = "قانون";
const BT = "تجميل وعناية", OT = "أخرى";
export const SECTORS = [H, HT, AD, FI, SM, HR, LG, EN, IT, CN, ED, HL, GV, AG, TR, LW, BT, OT];

const OCC = [];
// d(id, الإنجليزي، العربي، القطاع، "alias|alias|...") — الأسماء الأولى تدخل aliases تلقائياً.
const d = (id, en, ar, sector, aliases) => OCC.push({ id, en, ar, sector, aliases: String(aliases || "").split("|").filter(Boolean) });

/* ═════════════ جدول المهن (مرتّب حسب المجال) ═════════════
 * d(id, English, العربي, القطاع, "عباراتٌ مرادفة مفصولة بـ|") — الاسمان يدخلان العبارات تلقائياً.
 * العبارات مكتوبة بصيغتها الطبيعية؛ يُطبَّع الكل بالدالة نفسها عند التحميل.
 */
// ── الضيافة والمطاعم ──
d("hosp.executive-chef", "Executive Chef", "شيف تنفيذي", H, "executive chef|exec chef|executive chief|group executive chef|corporate chef|culinary director|director of culinary|master chef|chef executive|culinary manager|شيف تنفيذي|الشيف التنفيذي|شيف عام|مدير مطابخ|مدير الطهاة|chef executif|executive chef consultant|مدير الطهي|مدير طهي|مدير طهى|ex chef");
d("hosp.executive-sous-chef", "Executive Sous Chef", "نائب الشيف التنفيذي", H, "executive sous chef|exec sous chef|sous chef executive|executive sous|نائب شيف تنفيذي|سو شيف تنفيذي");
d("hosp.head-chef", "Head Chef / Chef de Cuisine", "رئيس الطهاة (شيف رئيسي)", H, "head chef|chef de cuisine|kitchen head|head of kitchen|head cook|chief chef|head kitchen chef|رئيس طهاه|رئيس الطهاه|رئيس شيف|شيف رئيسي|رئيس المطبخ|رئيس مطبخ|رئيس الطباخين|رئيس قسم المطبخ|chef chief|chef head|head chef kitchen|resident chef");
d("hosp.sous-chef", "Sous Chef", "سو شيف", H, "sous chef|sous|sou chef|second chef|sous chef de cuisine|سو شيف|سوس شيف|سوشيف|شيف مساعد رئيسي|نائب رئيس الطهاه|assistant head chef|deputy head chef|chef sous");
d("hosp.chef-de-partie", "Chef de Partie (CDP)", "شيف قسم (CDP)", H, "chef de partie|chef de party|chef de parti|chef departie|chef de partie cdp|chefs de partie|cdp|c d p|chef de paty|shef de party|شيف دي بارتي|شيف دي بارتيه|شيف قسم|رئيس قسم الطهاه|section chef|station chef|first chef de partie|chef de partie senior");
d("hosp.demi-chef-de-partie", "Demi Chef de Partie (Demi CDP)", "ديمي شيف قسم (Demi CDP)", H, "demi chef de partie|demi cdp|dcdp|d c d p|demi chef|demi chef de party|demi chef partie|demi|junior chef de partie|jr cdp|junior cdp|assistant chef de partie|assistant cdp|second cdp|ديمي شيف|ديمي cdp|ديمي شيف دي بارتي|ديمي");
d("hosp.commis-chef", "Commis Chef", "كومي شيف", H, "commis chef|commis|commi|commi chef|comis|commis cook|kitchen commis|chef commis|commis kitchen|first commis|demi commis|كومي شيف|كومي|كوميه شيف|كوميه|كومي طباخ|commis chef cook|commie|commie chef");
d("hosp.cook", "Cook", "طباخ", H, "cook|line cook|kitchen cook|general cook|all rounder chef|all rounder|cook general|prep cook|grill cook|hot kitchen cook|cold kitchen cook|short order cook|food preparer|food preparation|كوك|طباخ|طاهي|طباخه|طاهيه|طاهي عمومي|طباخ عمومي|عامل طبخ|معد طعام|kitchen staff|chef cook|home cook|cooking|cooks|culinarian|culinarian associate|burger maker|pizza maker|pizzaiolo|shawarma maker|sandwich maker|grill man|طاه|salad maker");
d("hosp.chef-unspecified", "Chef (rank unspecified)", "شيف (بلا رتبة محددة)", H, "chef|chefs|شيف|الشيف|private chef|private italian chef|italian chef|asian chef|arabic chef|indian chef|sushi chef|grill chef|fish chef|butcher chef|continental chef|chef de rang assistant|chef associate|culinary professional|culinary|شيف خاص|طاه خاص");
d("hosp.kitchen-supervisor", "Kitchen Supervisor", "مشرف مطبخ", H, "kitchen supervisor|kitchen team leader|kitchen leader|kitchen in charge|مشرف مطبخ|مشرف المطبخ|مشرف طهاه");
d("hosp.kitchen-manager", "Kitchen Manager", "مدير مطبخ", H, "kitchen manager|manager kitchen|مدير مطبخ|مدير المطبخ|مدير مطابخ مركزيه|central kitchen manager|مساعد مدير مطبخ|production kitchen manager");
d("hosp.kitchen-helper", "Kitchen Helper", "مساعد مطبخ", H, "kitchen helper|kitchen assistant|kitchen hand|helper kitchen|kitchen worker|kitchen attendant|kitchen aid|مساعد طباخ|مساعد مطبخ|عامل مطبخ|مساعد طاهي|عامل في المطبخ|food runner kitchen");
d("hosp.steward", "Kitchen Steward / Dishwasher", "ستيوارد مطبخ (غسّال أطباق)", H, "kitchen steward|steward|stewards|stewarding|dishwasher|dish washer|pot washer|plate washer|stewarding staff|ستيوارد|ستيوارد مطبخ|غسال صحون|غسالة اطباق|عامل غسيل اطباق");
d("hosp.chief-steward", "Chief Steward / Stewarding Manager", "رئيس ستيوارد", H, "chief steward|head steward|stewarding manager|stewarding supervisor|رئيس ستيوارد|مشرف ستيوارد");
d("hosp.pastry-commis", "Pastry Commis / Pastry Cook", "كومي حلويات", H, "pastry commis|commis pastry|pastry commi|pastry cook|pastry helper|pastry assistant|pastry kitchen assistant|pastry demi|commis patissier|كومي حلويات|مساعد حلويات|مساعد شيف حلويات");
d("hosp.pastry-cdp", "Pastry Chef de Partie", "شيف قسم حلويات", H, "pastry chef de partie|pastry cdp|pastry demi chef de partie|demi chef de partie pastry|cdp pastry|de party pastry chef|pastry chef de party|pastry demi cdp|pastry demi chef|شيف قسم حلويات|cdp حلويات|pastry chef de parte|pastry section chef");
d("hosp.pastry-chef", "Pastry Chef", "شيف حلويات", H, "pastry chef|patissier|pâtissier|patisserie chef|pastry|dessert chef|sweets chef|chef patissier|pastry and bakery chef|pastry baker|pastry chef baker|شيف حلويات|شيف معجنات|حلواني|صانع حلويات|شيف الحلويات|شيف معجنات وحلويات|chocolatier|شيف شوكولاته|cake decorator|cake maker|cake designer");
d("hosp.pastry-sous-chef", "Pastry Sous Chef", "سو شيف حلويات", H, "pastry sous chef|sous chef pastry|pastry sous|assistant pastry chef|pastry assistant chef|pastry second chef|سو شيف حلويات|شيف حلويات مساعد|pastry sous chef de cuisine");
d("hosp.head-pastry-chef", "Head / Executive Pastry Chef", "رئيس شيف حلويات (تنفيذي)", H, "head pastry chef|executive pastry chef|pastry head|chief pastry chef|pastry chef head|group pastry chef|cluster head pastry chef|executive patissier|head patissier|pastry chef executive|pastry executive chef|شيف حلويات تنفيذي|رئيس شيف حلويات|رئيس قسم الحلويات|رئيس الحلويات|head of pastry|pastry manager|pastry chef manager");
d("hosp.baker", "Baker", "خباز", H, "baker|bakery chef|baking chef|baker chef|bakery cook|bread baker|bakery worker|bakery|baking|baker manager|head baker|خباز|مخبوزات|خباز مخبوزات|baking consultant|bakery supervisor|bakery manager|مشرف مخبز|مدير مخبز");
d("hosp.barista", "Barista", "باريستا", H, "barista|baristas|barrista|باريستا|بارستا|بريستا|coffee maker|coffee specialist|coffee shop attendant|coffee barista|كوفي ميكر|محضر قهوه|coffee brewer|specialty coffee|coffee shop|cafe attendant");
d("hosp.head-barista", "Head Barista", "رئيس باريستا", H, "head barista|barista supervisor|barista team leader|lead barista|chief barista|barista head|رئيس باريستا|رئيس بارستا|مشرف باريستا|barista trainer");
d("hosp.bartender", "Bartender", "ساقي / باتندر", H, "bartender|bar tender|barman|bar man|barmaid|bar attendant|mixologist|cocktail bartender|باتندر|بارمان|بارتندر|ساقي|ساقيه|mixology|bar waiter|bar staff|bar server|bar trainer|bar assistant");
d("hosp.head-bartender", "Head Bartender / Bar Supervisor", "رئيس بارتندر / مشرف بار", H, "head bartender|bar supervisor|bartender supervisor|head barman|bar head|bar team leader|bar captain|chief bartender|رئيس بارتندر|مشرف بار|مشرف بارتندر|رئيس بار|head bartender barista");
d("hosp.bar-manager", "Bar Manager", "مدير بار", H, "bar manager|bars manager|مدير بار|مدير البار|beverage manager|مدير مشروبات|bar operations manager");
d("hosp.food-runner", "Food Runner / Commis Waiter", "مساعد نادل (فود رنر)", H, "runner|food runner|commis waiter|commis de rang|busser|bus boy|busboy|bus person|waiter assistant|waiter helper|service assistant|dining assistant|restaurant assistant|food runner trainee|مساعد نادل|رنر|فود رنر|عامل صاله|مساعد صاله|waiter runner");
d("hosp.waiter", "Waiter / Server", "نادل", H, "waiter|waitress|waitre|waitor|waiters|waitresses|server|servers|food server|f b server|restaurant server|restaurant waiter|waiting staff|wait staff|table server|banquet server|banquet waiter|room service waiter|dining server|ويتر|ويترس|واتر|نادل|نادله|ندل|مقدم طعام|مقدم خدمه|نادل مطعم|نادل اول|نادل مناسبات|service waiter|f b waiter|f b service|waiter service|fnb server|steward waiter|hall waiter|vip waiter|waiter vip|waiter bar|lounge waiter|garcon|serveur|خدمه مطاعم|service staff");
d("hosp.captain", "Captain Waiter", "كابتن نادل", H, "captain waiter|restaurant captain|f b captain|captain|chef de rang|captain service|captain restaurant|section captain|waiter captain|كابتن نادل|كابتن|كابتن مطعم|كابتن صاله|كابتن خدمه|captain waiter cashier|captain f b|senior waiter captain|كابتن ويتر|كابتن النوادل");
d("hosp.head-waiter", "Head Waiter / Maitre d", "رئيس نادل", H, "head waiter|headwaiter|head waitress|head waiter supervisor|maitre d|maitre d hotel|restaurant maitre d|chief waiter|restaurant head|head of service|head of restaurant|رئيس نادل|نادل رئيسي|رئيس ويتر|رئيس الندل|رئيس النوادل|ميتر دوتيل|maitre|maître|head server|restaurant head waiter");
d("hosp.host", "Host / Hostess", "مضيف مطعم", H, "host|hostess|hosts|restaurant host|restaurant hostess|greeter|guest greeter|مضيف|مضيفه|مضيف مطعم|مضيفه مطعم|استقبال مطعم|welcome host|restaurant greeter|hostess host|lounge agent|lounge attendant|lounge host|vip lounge attendant|executive lounge agent|lounge supervisor");
d("hosp.crew-member", "Restaurant Crew Member", "عضو فريق مطعم", H, "crew member|service crew|food service crew|fast food crew|restaurant crew|طاقم مطعم|kfc team member|mcdonalds crew|counter crew|counter staff|food service worker|food service staff|food service associate|عامل مطعم|عامل في مطعم|عامل وجبات سريعه|restaurant staff|restaurant employee|restaurant worker|check out coworker|checkout coworker|crew member trainee|عضو فريق مطعم");
d("hosp.restaurant-supervisor", "Restaurant / Shift Supervisor", "مشرف مطعم / وردية", H, "restaurant supervisor|f b supervisor|food beverage supervisor|floor supervisor|dining supervisor|service supervisor|outlet supervisor|restaurant team leader|food service supervisor|shift supervisor|shift leader|shift in charge|team leader restaurant|restaurant shift leader|مشرف مطعم|مشرف مطاعم|مشرف صاله|مشرف صاله العائلات|مشرف طعام وشراب|مشرف اغذيه ومشروبات|مشرف خدمه|مشرف وردية|قائد وردية|مشرف منفذ|مشرفه مطعم|supervisor restaurant|supervisor food beverage|hall supervisor|section supervisor|banquet supervisor|room service supervisor|مشرف وشاشه|مشرف وكاشير|مشرف مطعم وكاشير|مشرف مطعم او كاشير|سوبرفايزر|سوبر فايزر|سوبرفايزر f b|supervisor f b|foh section leader|section leader|foh supervisor|foh team leader|foh|crew supervisor|crew leader");
d("hosp.shift-manager", "Duty / Shift Manager", "مدير مناوب / مدير وردية", H, "shift manager|duty manager|manager on duty|floor manager|night manager|duty officer|duty manager restaurant|مدير مناوب|مدير وردية|مدير الطابق|مدير صاله|مدير الصاله|مناوب|assistant duty manager|operations duty manager|مدير الطابق والحجز|customer experience duty manager|f b duty manager|manager duty|dining room manager|مدير مناوب front office|مدير نوبه|مدير واجب|مدير واجبات|مدير ليلي|مدير ليلي بالنيابه");
d("hosp.restaurant-manager", "Restaurant Manager", "مدير مطعم", H, "restaurant manager|outlet manager|restaurant general manager|general manager restaurant|restaurant gm|restaurant director|restaurants manager|cafe manager|coffee shop manager|food outlet manager|restaurant operations manager director|مدير مطعم|مدير عام مطعم|مدير مطاعم|مدير منفذ|مدير مقهي|مدير كافيه|مدير مطعم اول|مدير مطعم مساعد|مدير مطعم وكافيه|مدير عام للمطعم|restaurant owner manager|restaurant head manager|مدير فرع مطعم|مدير مقهى|branch manager restaurant|restaurant branch manager|assistant outlet manager|مساعد مدير منفذ|مدير افتتاح|opening manager|restaurant opening manager|general manager concept creator|concept manager|restaurant manager catering manager|restaurant manager bar manager|resturant manager|restuarant manager|restaurant mgr|lounge manager|club and lounge manager|airport lounge manager|vip lounge manager");
d("hosp.fb-manager", "Food & Beverage Manager", "مدير الأغذية والمشروبات", H, "f b manager|f b director|f b operations manager|f b operation manager|f b operations director|food beverage manager|food beverage director|food beverage operations manager|food beverage operation manager|director of food and beverage|f b assistant manager|f b head|head of f b|restaurant operations manager|restaurants operations manager|restaurant operation manager|restaurant operations director|restaurants operation manager|operations manager restaurant|مدير الاغذيه والمشروبات|مدير اغذيه ومشروبات|مدير عمليات الاغذيه والمشروبات|مدير عمليات الطعام والشراب|مدير الطعام والشراب|مدير طعام وشراب|مدير عمليات مطعم|مدير عمليات المطاعم|مدير عمليات المطعم|مدير عمليات مطاعم|director f b|f b outlets manager|fnb manager|fnb director|f b operations|مدير خدمات الاغذيه|food service manager|food and beverage operations|f b general manager");
d("hosp.catering-supervisor", "Catering Supervisor", "مشرف تموين", H, "catering supervisor|catering team leader|مشرف تموين|مشرف عمليات تقديم الطعام|مشرف تقديم الطعام|مشرف ضيافه|hospitality supervisor|مشرف الضيافه|مشرف عمليات الطعام");
d("hosp.catering-manager", "Catering Manager", "مدير تموين وتقديم الطعام", H, "catering manager|catering director|catering operations manager|catering and weddings manager|catering weddings manager|events catering manager|مدير تموين|مدير تقديم الطعام|مدير خدمات الطعام|مدير ضيافه|مدير الضيافه|hospitality manager|مدير عمليات تقديم الطعام|banquet manager|banquets manager|banquet operations manager|مدير تقديم طعام|مدير تموين وضيافه|banqueting manager");
d("hosp.hotel-manager", "Hotel Manager", "مدير فندق", H, "hotel manager|general manager hotel|hotel general manager|hotel gm|resort manager|hotel director|مدير فندق|مدير منتجع|hotel operations manager|مدير عمليات فندق|مدير عام فندق|مدير عام الفندق|مدير الفندق|hotel owner|hostel manager|guest house manager|مدير دار ضيافه|مدير نزل|مدير شقق فندقيه|serviced apartments manager|apartment hotel manager|accommodation manager|rooms division manager|room division manager|مدير قسم الغرف|resident manager|residence manager|مدير مقيم|مدير الاقامه|accommodation director");
d("hosp.front-office-supervisor", "Front Office Supervisor", "مشرف مكتب أمامي / استقبال", H, "front office supervisor|front desk supervisor|reception supervisor|guest relations supervisor|guest services supervisor|front office team leader|front desk team leader|مشرف استقبال|مشرف علاقات الضيوف|مشرف مكتب امامي|مشرف الاستقبال|مشرف مكتب الاستقبال|reception team leader|lobby supervisor|guest experience supervisor|guest service supervisor|assistant front office manager|front office assistant manager");
d("hosp.front-office-manager", "Front Office Manager", "مدير مكتب أمامي", H, "front office manager|front desk manager|reception manager|guest relations manager|guest services manager|guest experience manager|مدير مكتب امامي|مدير مكتب الاستقبال|مدير قسم الاستقبال|مدير الاستقبال|مدير علاقات الضيوف|مدير استقبال|front of house manager|foh manager|مدير الواجهه|مدير الاستقبال والحجوزات|guest service manager|مدير تجربه الضيوف|front disk manager");
d("hosp.guest-relations", "Guest Relations Officer", "موظف علاقات ضيوف", H, "guest relations officer|guest relation officer|guest relations|guest relation|guest relations agent|guest relations executive|guest experience officer|guest experience specialist|guest services officer|gro|guest relations associate|موظف علاقات ضيوف|موظف علاقات الضيوف|مسؤول علاقات الضيوف|اخصائي علاقات الضيوف|علاقات الضيوف|guest service agent|guest services agent|guest service|guest services|guest service associate|guest experience|guest experience agent|guest care|guest contact|vip guest relations|vip relations officer|مسؤول خدمه الضيوف|موظف خدمه الضيوف|مضيف علاقات|guest assistant|علاقات نزلاء|مسؤول علاقات نزلاء|gust relation|gust relations");
d("hosp.reservations", "Reservations Agent", "موظف حجوزات", H, "reservation agent|reservations agent|reservation officer|reservations officer|reservation specialist|reservations specialist|reservation executive|reservations executive|reservation|reservations|reservations clerk|booking agent|booking officer|booking specialist|booking coordinator|booking clerk|موظف حجوزات|مسؤول حجوزات|اخصائي حجوزات|حجوزات|منسق حجوزات|reservation coordinator|reservation assistant|ticketing and reservations");
d("hosp.reservations-manager", "Reservations Manager", "مدير حجوزات", H, "reservations manager|reservation manager|reservations supervisor|reservation supervisor|مشرف حجوزات|مدير حجوزات|مدير الحجوزات|مشرف الحجوزات|booking manager|مدير حجز|مشرف حجز|reservations team leader|reservation team leader|head of reservations");
d("hosp.housekeeping-supervisor", "Housekeeping Supervisor", "مشرف تدبير فندقي", H, "housekeeping supervisor|floor supervisor housekeeping|room supervisor|laundry supervisor|public area supervisor|housekeeping team leader|مشرف تدبير|مشرف تدبير فندقي|مشرف نظافه|مشرف خدمات منزليه|مشرف غرف|assistant housekeeper|assistant executive housekeeper|مشرف تدبير منزلي|mini bar supervisor|supervisor housekeeping|مشرفه تدبير");
d("hosp.housekeeping-manager", "Executive Housekeeper / Housekeeping Manager", "مدير تدبير فندقي", H, "executive housekeeper|housekeeping manager|head housekeeper|chief housekeeper|housekeeping director|laundry manager|مدير تدبير|مدير تدبير فندقي|مدير تدبير منزلي|مدير خدمات فندقيه|مدير نظافه|مدير النظافه|مديره تدبير|مدير الخدمات المنزليه|housekeeping head|head of housekeeping|رئيس قسم التدبير|رئيس تدبير|مدير تدبير الفندق|مدير الغرف");
d("hosp.concierge", "Concierge", "كونسيرج", H, "concierge|concierge agent|hotel concierge|guest concierge|chief concierge|كونسيرج|كونسيارج|lobby ambassador|lobby host|guest ambassador|lobby attendant");
d("hosp.bellman", "Bellman / Doorman", "حمّال أمتعة / بوّاب فندق", H, "bellman|bell man|bell boy|bellboy|bell captain|doorman|door man|valet|valet parking|porter|luggage porter|hotel porter|حمال امتعه|بواب فندق|بوابه|بيل مان|بيل بوي|bellman waiter|bellman or waiter|bell desk|bell attendant|bellhop|door attendant");
d("hosp.activity-instructor", "Activity / Recreation Instructor", "مدرب أنشطة وترفيه", H, "activity instructor|activities instructor|junior activity instructor|recreation instructor|recreation specialist|recreation officer|recreation manager|compound recreation manager|compound and recreation manager|animator|entertainment host|entertainment officer|entertainer|kids club instructor|kids club leader|activities coordinator|activity coordinator|مدرب نشاطات|مدربه انشطه|مدرب انشطه|مدرب نشاط|منسق انشطه|مسؤول ترفيه|ترفيه|منسق ترفيه|مشرف انشطه|recreation");
d("hosp.compound-manager", "Compound / Camp Manager", "مدير مجمّع سكني", H, "compound manager|camp manager|camp boss|camp supervisor|residential compound manager|مدير مجمع|مدير مجمع سكني|مدير مجمع بيئي|مدير سكن|مدير مخيم|مدير معسكر|مشرف سكن|مشرف مجمع|مشرف مخيم|accommodation supervisor|housing manager|مدير تطوير الاسكان|مدير الاسكان|lodging manager|مدير معسكرات|camp management officer");
d("hosp.event-planner", "Event Planner / Coordinator", "منسق فعاليات", H, "event planner|events planner|event coordinator|events coordinator|event specialist|events specialist|event executive|events executive|event officer|events officer|wedding planner|wedding coordinator|conference coordinator|exhibition coordinator|exhibitions coordinator|event organizer|events organizer|event assistant|منسق فعاليات|منظم فعاليات|منظم مناسبات|منسق مناسبات|منسق معارض|اخصائي فعاليات|مسؤول فعاليات|منظم حفلات|منظم مؤتمرات|منظم معارض|events|event|organizer");
d("hosp.event-manager", "Event Manager", "مدير فعاليات", H, "event manager|events manager|event director|events director|head of events|events head|marketing events manager|marketing and events manager|مدير فعاليات|مدير مناسبات|مدير الفعاليات|مدير معارض|مدير مؤتمرات|مدير تسويق وفعاليات|exhibition manager|exhibitions manager|conference manager|venue manager|مدير قاعات|مدير قاعه|wedding hall manager|مدير قاعه افراح|مدير صاله افراح|مدير حفلات|مساعد مدير حفل");
d("hosp.butler", "Butler", "خادم شخصي (بتلر)", H, "butler|butler service|private butler|personal butler|بتلر|خادم شخصي");

// ── السياحة والطيران ──
d("tour.travel-consultant", "Travel Consultant / Agent", "مستشار سفر", HT, "travel consultant|travel agent|travel advisor|travel specialist|travel officer|travel executive|travel counselor|travel sales consultant|tourism consultant|tourism specialist|tourism officer|ticketing agent|ticketing officer|ticketing specialist|ticketing|tour operator|tour operations|tour consultant|holiday consultant|vacation consultant|visa officer|visa specialist|travel and tourism|travel desk|travel coordinator|tour coordinator|tours coordinator|tour planner|tour manager|travel manager|tourism manager|tour operations manager|مستشار سفر|وكيل سفر|موظف سفريات|موظف حجز تذاكر|موظف تذاكر|منسق رحلات|منسق سياحي|مسؤول سياحه|اخصائي سياحه|موظف سياحه|مدير سياحه|مدير رحلات|مدير سفريات|مدير مكتب سفريات|سياحه|سفريات");
d("tour.tour-guide", "Tour Guide", "مرشد سياحي", HT, "tour guide|tourist guide|local guide|city guide|pilgrim guide|pilgrims guide|pilgrim s guide|pilgrim s guider|pilgrims guider|hajj guide|umrah guide|guide|مرشد سياحي|مرشد|دليل سياحي|مرشد حجاج|مرشد معتمرين|مرشده سياحيه|مرشد سياحي مرخص|tour leader");
d("tour.cabin-crew", "Flight Attendant / Cabin Crew", "مضيف طيران", HT, "flight attendant|cabin crew|air hostess|airhostess|cabin attendant|air steward|air stewardess|stewardess|flight steward|inflight crew|in flight crew|cabin service|cabin staff|crew cabin|مضيف طيران|مضيفه طيران|مضيف جوي|مضيفه جويه|طاقم ضيافه جويه|مضيف طائره|مضيفه طائره|طاقم طيران");
d("tour.airport-agent", "Airport / Ground Services Agent", "موظف خدمات أرضية", HT, "ground handling|ground staff|ground services agent|ground service agent|ground handling agent|ramp agent|airport agent|airport officer|airport customer service|airport representative|check in agent|checkin agent|check in staff|passenger service agent|passenger services agent|passenger service|passenger services|station agent|duty agent|sr duty agent|airline agent|airline ticketing|load controller|departure control|airport ground staff|aviation ground|aviation customer service|موظف خدمات ارضيه|خدمات ارضيه|موظف مطار|وكيل مطار|موظف تسجيل مسافرين|موظف حركه|موظف حركه جويه|السعوديه للخدمات الارضيه|الشركه السعوديه للخدمات الارضيه|موظف في الشركه السعوديه للخدمات الارضيه");
d("tour.pilot", "Pilot", "طيّار", HT, "pilot|airline pilot|captain pilot|first officer|co pilot|copilot|flight captain|helicopter pilot|commercial pilot|private pilot|طيار|كابتن طيار|مساعد طيار|flight instructor|aircraft pilot|drone pilot");
d("tour.aircraft-technician", "Aircraft Maintenance Technician", "فني صيانة طائرات", HT, "aircraft maintenance|aircraft technician|aircraft mechanic|aircraft maintenance technician|aircraft maintenance engineer|avionics technician|avionics engineer|aviation maintenance|aircraft engineer|aviation engineer|aviation engineering|aviation technician|b1 engineer|b2 engineer|licensed aircraft engineer|aircraft inspector|aircraft structure technician|فني صيانه طائرات|مهندس طيران|مهندس صيانه طائرات|فني طيران|فني طائرات|هندسه طيران|aircraft line maintenance|airframe powerplant|a p mechanic|ap mechanic");

// ── المحاسبة والمالية ──
d("fin.accountant", "Accountant / Finance Officer", "محاسب / مسؤول مالي", FI, "accountant|general accountant|financial accountant|accounting specialist|accounting officer|accounting clerk|accounting executive|accounting assistant|accounting|accountancy|bookkeeper|finance officer|finance executive|finance specialist|financial specialist|finance assistant|financial assistant|finance clerk|gl accountant|fixed asset accountant|project accountant|sales accountant|revenue accountant|purchase accountant|branch accountant|accounts officer|accounts executive|accounts assistant|accounts clerk|accounts|محاسب|محاسب عام|محاسب مالي|مسك الدفاتر|مسؤول مالي|موظف مالي|اخصائي مالي|مساعد محاسب|محاسب مساعد|محاسب ايرادات|محاسب مشاريع|محاسب فرع|مساعد مالي|مسؤول حسابات|موظف حسابات|حسابات|اخصائي محاسبه|اخصائي حسابات|محاسب تنفيذي");
d("fin.accounting-supervisor", "Accounting Supervisor", "مشرف محاسبة", FI, "accounting supervisor|accounts supervisor|finance supervisor|financial supervisor|accounting team leader|accounting lead|مشرف محاسبه|مشرف حسابات|مشرف مالي");
d("fin.chief-accountant", "Chief Accountant", "محاسب رئيسي", FI, "chief accountant|head accountant|head of accounts|head of accounting|chief of accounts|accounts head|accounting head|principal accountant|رئيس حسابات|رئيس قسم الحسابات|رئيس قسم المحاسبه|محاسب رئيسي|كبير المحاسبين|رئيس المحاسبين");
d("fin.finance-manager", "Finance Manager", "مدير مالي", FI, "finance manager|financial manager|accounting manager|accounts manager|financial reporting manager|finance and admin manager|head of finance|finance head|group finance manager|group financial manager|regional finance manager|finance business partner|finance lead|financial planning manager|budget manager|مدير مالي|مدير ماليه|مدير محاسبه|مدير حسابات|مدير تقارير ماليه|مدير تخطيط وتحليل مالي|مدير مالي واداري|مدير مالي ومحاسبه|مدير مالي مجموعه|مدير تنميه الموارد الماليه|مدير الشؤون الماليه|رئيس القسم المالي|رئيس قسم المالي|رئيس الماليه|مدير مراقبه ماليه|مدير ميزانيه|مدير تقارير|مدير دوره الايرادات");
d("fin.financial-controller", "Financial Controller", "مراقب مالي", FI, "financial controller|finance controller|group financial controller|group controller|corporate controller|مراقب مالي|مراقب عام|مراقب حسابات|المراقب المالي");
d("fin.cfo", "CFO / Finance Director", "رئيس القطاع المالي (CFO)", FI, "cfo|chief financial officer|finance director|financial director|vp finance|vice president finance|group cfo|chief finance officer|المدير المالي التنفيذي|رئيس القطاع المالي|مدير عام الماليه|مدير عام الشؤون الماليه|رئيس تنفيذي مالي|نائب الرئيس للشؤون الماليه|group head of finance|chief of finance|head of group finance");
d("fin.financial-analyst", "Financial Analyst", "محلل مالي", FI, "financial analyst|finance analyst|fp a analyst|fp a|fpa|financial planning analyst|financial planning and analysis|budget analyst|budgeting analyst|budgeting and planning analyst|accounting analyst|محلل مالي|محلل ماليه|محلل تقارير ماليه|محلل ميزانيه|محلل تخطيط وتقارير ماليه|اخصائي تحليل مالي|financial analysis|business finance analyst|corporate finance|corporate finance analyst|investment analyst assistant");
d("fin.cost-controller", "Cost Controller / Cost Accountant", "مراقب تكاليف / محاسب تكاليف", FI, "cost controller|cost control|cost accountant|cost analyst|cost accounting|cost specialist|cost officer|costing|food cost controller|f b cost controller|inventory and cost control specialist|cost control specialist|cost control analyst|cost control accountant|مراقب تكاليف|محاسب تكاليف|محلل تكاليف|اخصائي تكاليف|مسؤول تكاليف|stock and cost controller|food controller|beverage controller|f b controller|income auditor|night auditor|night audit|revenue auditor|revenue controller|revenue assurance|revenue analyst|revenue manager|revenue specialist|مدقق ايرادات|مدير ايرادات|محلل ايرادات");
d("fin.auditor", "Auditor", "مدقق / مراجع حسابات", FI, "auditor|external auditor|audit associate|audit assistant|audit executive|audit officer|audit specialist|audit senior|financial auditor|statutory auditor|auditing|audit|audit analyst|مدقق|مدقق حسابات|مراجع حسابات|مراجع|مدقق مالي|مساعد مدقق|مدقق خارجي|اخصائي تدقيق|محاسب قانوني|certified public accountant|cpa|chartered accountant|تدقيق|تدقيق حسابات|مراجعه حسابات|مسؤول تدقيق|موظف تدقيق|مدقق ضريبي|tax auditor|quality auditor|lead auditor|iso auditor|external quality auditor|فاحص حسابات");
d("fin.internal-auditor", "Internal Auditor", "مدقق داخلي", FI, "internal auditor|internal audit|internal audit officer|internal audit specialist|internal audit analyst|internal controller|internal control|internal control officer|operational auditor|operations auditor|مدقق داخلي|تدقيق داخلي|مراجع داخلي|اخصائي تدقيق داخلي|مراجعه داخليه|مراقب داخلي|internal auditor internal controller");
d("fin.audit-manager", "Audit Manager", "مدير تدقيق", FI, "audit manager|audit director|head of audit|head of internal audit|internal audit manager|internal audit director|chief audit executive|auditing manager|audit head|audit supervisor|internal audit supervisor|assistant audit manager|مدير تدقيق|مدير مراجعه|مدير تدقيق داخلي|مدير مساعد تدقيق|رئيس قسم التدقيق|رئيس التدقيق|رئيس المراجعه|مشرف تدقيق|مشرف مراجعه|مدير الرقابه الداخليه|internal controls manager");
d("fin.accounts-receivable-payable", "Accounts Payable / Receivable Specialist", "محاسب ذمم (دائنة / مدينة)", FI, "accounts payable|account payable|accounts receivable|account receivable|accounts payable specialist|accounts receivable specialist|account receivable specialist|accounts payable accountant|accounts receivable accountant|accounts payable clerk|accounts receivable clerk|accounts payable officer|accounts receivable officer|ap specialist|ar specialist|ap clerk|ar clerk|ap accountant|ar accountant|ap officer|ar officer|payable accountant|receivable accountant|billing specialist|billing officer|billing accountant|billing clerk|invoicing officer|invoicing specialist|ذمم|ذمم دائنه|ذمم مدينه|محاسب ذمم|محاسب ذمم دائنه|محاسب ذمم مدينه|حسابات دائنه|حسابات مدينه|محاسبه زبائن|محاسب زبائن|محاسبه عملاء|محاسب عملاء|محاسب موردين|اخصائي ذمم|مسؤول ذمم|مسؤول فوتره|موظف فوتره|payments officer|payments specialist|payment officer|payment specialist");
d("fin.collections", "Collections Officer", "محصّل ديون", FI, "collections officer|collection officer|collections specialist|collection specialist|collections agent|collector|debt collector|credit collector|collections executive|collections coordinator|collections analyst|collections manager|collection supervisor|collections supervisor|collections|collection|debt recovery|recovery officer|recovery specialist|محصل ديون|محصل|محصل مبالغ|مسؤول تحصيل|موظف تحصيل|اخصائي تحصيل|مشرف تحصيل|مشرف تحصيل ديون|مدير تحصيل|تحصيل ديون|تحصيل");
d("fin.credit-analyst", "Credit Analyst / Officer", "محلل / مسؤول ائتمان", FI, "credit analyst|credit officer|credit controller|credit control|credit specialist|credit manager|credit executive|credit coordinator|credit risk officer|credit approval officer|loan officer|loans officer|loan specialist|loan analyst|lending officer|mortgage officer|mortgage specialist|mortgage advisor|financing officer|financing specialist|financing analyst|financing manager|محلل ائتمان|مسؤول ائتمان|اخصائي ائتمان|مدير ائتمان|مراقب ائتمان|موظف ائتمان|ائتمان|مسؤول قروض|موظف قروض|اخصائي قروض|مسؤول تمويل|موظف تمويل|اخصائي تمويل|محلل تمويل|مدير تمويل|مستشار تمويل|مستشار تمويلي|auto finance consultant|auto finance officer|car finance consultant|مسؤول رهن عقاري|مسؤول الرهن العقاري");
d("fin.treasury", "Treasury Specialist", "أخصائي خزينة", FI, "treasury|treasury analyst|treasury officer|treasury specialist|treasurer|treasury manager|treasury accountant|treasury assistant|treasury executive|corporate finance and treasury manager|cash manager|cash management|cash officer|cash controller|cash analyst|petty cash|petty cashier|خزينه|اخصائي خزينه|مسؤول خزينه|مدير خزينه|امين خزينه|محاسب خزينه|موظف خزينه|رئيس الخزينه|liquidity analyst|liquidity manager|funding officer|funding specialist");
d("fin.tax-specialist", "Tax / Zakat Specialist", "أخصائي ضرائب وزكاة", FI, "tax specialist|tax analyst|tax officer|tax accountant|tax manager|tax consultant|tax advisor|tax associate|tax executive|tax assistant|tax senior|tax supervisor|tax|taxation|vat specialist|vat officer|vat analyst|vat accountant|vat manager|vat|zakat specialist|zakat officer|zakat analyst|zakat accountant|zakat manager|zakat|zakat and tax|tax and zakat|اخصائي ضرائب|محلل ضرائب|محلل ضريبه|محلل ضريبه وتقرير|محاسب ضرائب|محاسب ضريبي|مدير ضرائب|مدير ضريبه|مستشار ضريبي|مسؤول ضرائب|ضرائب|ضريبه|اخصائي زكاه|اخصائي زكاه وضريبه|محاسب زكاه|مدير زكاه|مسؤول زكاه|زكاه");
d("fin.relationship-manager", "Relationship Manager (Banking)", "مدير علاقات عملاء (مصرفي)", FI, "relationship manager|relationship officer|relationship executive|relationship specialist|relationship banker|corporate relationship manager|corporate relationship officer|business relationship manager|private banker|private banking|private banking support manager|private banking manager|personal banker|personal banking|retail banker|retail banking|branch banker|banker|banking officer|banking specialist|banking advisor|banking consultant|banking executive|banking official|bank official|bank officer|bank specialist|bank advisor|bank consultant|bank executive|bank employee|banking employee|operations banker|operation banker|bank operations officer|bank operations specialist|banking operations officer|مصرفي|مصرفي فروع|مصرفي افراد|مصرفي شركات|مصرفي خاص|موظف بنك|موظف مصرفي|اخصائي مصرفي|مستشار مصرفي|مسؤول مصرفي|مدير علاقات مصرفيه|مدير علاقات بنكيه|نائب مدير وحده بطاقات الائتمان|وحده بطاقات الائتمان|credit card officer|credit card specialist|credit cards officer|credit cards specialist|credit cards manager|credit card manager|مدير علاقه|مدير علاقات شركات|مدير علاقات الشركات|relation manager|relations manager|مدير علاقات بنك");
d("fin.bank-teller", "Bank Teller", "صرّاف بنك", FI, "bank teller|teller|tellers|teller officer|bank cashier|bank clerk|banking clerk|bank assistant|banking assistant|كاتب مصرفي|صراف|صراف بنك|كاشير بنك|موظف صرافه|كاتب بنك|كاتب مصرفي ومسؤول خدمه عملاء|مساعد مصرفي|مساعد بنكي|موظف خدمات مصرفيه|موظف خدمه مصرفيه");
d("fin.investment-analyst", "Investment Analyst / Manager", "محلل / مدير استثمار", FI, "investment analyst|investment associate|investment officer|investment manager|investment specialist|investment advisor|investment consultant|investment executive|investment banker|investment banking|investment banking analyst|investment banking associate|investor relations|investor relations officer|investor relations manager|investor relations specialist|portfolio manager|portfolio analyst|portfolio officer|portfolio specialist|asset manager|asset management|asset management analyst|wealth manager|wealth management|wealth advisor|wealth consultant|fund manager|fund analyst|fund accountant|fund administrator|alternative investment|alternative investment associate|alternative investments|private equity|private equity analyst|private equity associate|venture capital|venture capital analyst|venture capital associate|مدير استثمار|مدير استثمارات|محلل استثمار|محلل استثماري|اخصائي استثمار|مسؤول استثمار|مستشار استثمار|مستشار استثماري|مدير محافظ|مدير صناديق|مدير صندوق|مدير ثروات|مدير الثروات|مدير علاقات المستثمرين|مسؤول علاقات المستثمرين|علاقات المستثمرين|مدير الاصول|مدير اصول");
d("fin.insurance-agent", "Insurance Agent / Advisor / Underwriter", "مستشار / وكيل تأمين", FI, "insurance agent|insurance advisor|insurance consultant|insurance broker|insurance sales|insurance sales agent|insurance sales executive|insurance specialist|insurance officer|insurance executive|insurance producer|insurance representative|insurance account manager|insurance underwriter|underwriter|underwriting|underwriting officer|underwriting specialist|underwriting analyst|underwriting manager|actuary|actuarial|actuarial analyst|actuarial specialist|actuarial service|actuarial services|cais actuarial service|مسوق تامين|مستشار تامين|وسيط تامين|وكيل تامين|اخصائي تامين|موظف تامين|مسؤول تامين|مدير تامين|مكتتب|اكتواري|خبير اكتواري|محلل اكتواري|اخصائي اكتتاب|مسؤول اكتتاب|محلل اكتتاب");
d("fin.insurance-claims", "Insurance Claims Specialist", "أخصائي مطالبات تأمين", FI, "claims officer|claims specialist|claims coordinator|claims adjuster|claims adjustor|claims analyst|claims assistant|claims executive|claims handler|claims processor|claims examiner|claims manager|claims supervisor|claims|claim officer|claim specialist|insurance claims|insurance claims officer|insurance claims specialist|insurance claims coordinator|insurance claims analyst|medical claims|medical claims officer|medical claims specialist|medical claims coordinator|tpa|tpa officer|tpa specialist|tpa coordinator|reconciliation tpa officer|reconciliation and tpa officer|مطالبات|مطالبات تامين|اخصائي مطالبات|موظف مطالبات|مسؤول مطالبات|منسق مطالبات|محلل مطالبات|مدير مطالبات|مشرف مطالبات|مسؤول مطالبات تامين|معالج مطالبات|مقدر خسائر|مقدر اضرار|خبير مطالبات");
d("fin.compliance-officer", "Compliance Officer", "مسؤول امتثال والتزام", FI, "compliance officer|compliance analyst|compliance manager|compliance specialist|compliance|compliance executive|compliance coordinator|compliance supervisor|compliance associate|regulatory compliance|regulatory affairs|regulatory affairs specialist|regulatory affairs officer|regulatory affairs manager|aml officer|aml analyst|aml|kyc analyst|kyc officer|kyc|اخصائي امتثال|مسؤول امتثال|مدير امتثال|ضابط امتثال|مسؤول الالتزام|الالتزام|امتثال|منسق امتثال|محلل امتثال|مدير الالتزام|اخصائي الالتزام|ضابط الالتزام|مكافحه غسل الاموال|مسؤول مكافحه غسل الاموال|اخصائي مكافحه غسل الاموال");
d("fin.risk-analyst", "Risk Analyst / Manager", "محلل / مدير مخاطر", FI, "risk analyst|risk officer|risk manager|risk specialist|risk management|risk executive|risk coordinator|risk assistant|risk supervisor|risk advisor|risk consultant|credit risk analyst|credit risk manager|credit risk specialist|operational risk|operational risk analyst|operational risk manager|operational risk officer|enterprise risk|enterprise risk manager|enterprise risk analyst|مدير مخاطر|محلل مخاطر|مسؤول مخاطر|اخصائي مخاطر|ادارة المخاطر|مدير ادارة المخاطر|مدير المخاطر|مستشار مخاطر|fraud analyst|fraud officer|fraud investigator|fraud specialist");
d("fin.financial-advisor", "Financial Advisor / Consultant", "مستشار مالي", FI, "financial advisor|financial adviser|financial consultant|financial planner|finance advisor|finance adviser|finance consultant|finance planner|financial advisory|financial advisory consultant|financial services consultant|financial services advisor|financial services officer|financial services specialist|financial services representative|مستشار مالي|مستشار ماليه|استشاري مالي|مخطط مالي|مستشار تخطيط مالي|مستشار الماليه|مستشار خدمات ماليه|اخصائي خدمات ماليه|ممثل خدمات ماليه|مسؤول خدمات ماليه|مدير خدمات ماليه");
d("fin.economist", "Economist / Market Analyst", "اقتصادي / محلل أسواق", FI, "economist|economic analyst|economic researcher|market analyst|market research analyst|market researcher|market research|research analyst|equity analyst|equity research|equity research analyst|اقتصادي|اخصائي اقتصادي|محلل اقتصادي|باحث اقتصادي|محلل اسواق|باحث اسواق|باحث تسويق|محلل بحوث|باحث بحوث تسويقيه");

// ── الموارد البشرية ──
d("hr.hrbp", "HR Business Partner", "شريك أعمال موارد بشرية (HRBP)", HR, "hr business partner|hrbp|jr hrbp|hr bp|human resources business partner|شريك اعمال الموارد البشريه|شريك موارد بشريه");
d("hr.compensation", "Payroll / Compensation & Benefits Specialist", "أخصائي رواتب وتعويضات", HR, "payroll|payroll specialist|payroll officer|payroll accountant|payroll analyst|payroll administrator|payroll coordinator|payroll clerk|payroll executive|compensation and benefits|compensation benefits|compensation and benefits specialist|compensation specialist|compensation analyst|benefits specialist|benefits analyst|benefits officer|benefits administrator|c b specialist|total rewards|total rewards specialist|رواتب|اخصائي رواتب|محاسب رواتب|مسؤول رواتب|موظف رواتب|رواتب واجور|اخصائي تعويضات|تعويضات ومزايا|اخصائي تعويضات ومزايا|مسؤول مزايا|اخصائي مزايا");
d("hr.compensation-manager", "Compensation & Benefits / Payroll Manager", "مدير رواتب وتعويضات", HR, "payroll manager|payroll supervisor|compensation and benefits manager|compensation manager|benefits manager|c b manager|head of compensation and benefits|head of payroll|total rewards manager|مدير رواتب|مدير تعويضات ومزايا|مشرف رواتب");
d("hr.recruiter", "Recruiter / Talent Acquisition Specialist", "أخصائي توظيف واستقطاب", HR, "recruiter|recruitment specialist|recruitment officer|recruitment coordinator|recruitment consultant|recruitment executive|recruitment assistant|recruitment|talent acquisition|talent acquisition specialist|talent acquisition partner|talent acquisition officer|talent acquisition coordinator|talent acquisition executive|ta specialist|hr recruiter|hr recruitment specialist|hr and recruitment specialist|headhunter|head hunter|executive search|executive search consultant|sourcing specialist|talent sourcer|sourcer|talent specialist|talent partner|اخصائي توظيف|مسؤول توظيف|منسق توظيف|مستشار توظيف|موظف توظيف|توظيف|استقطاب|اخصائي استقطاب|مسؤول استقطاب|اخصائي استقطاب وتوظيف|اخصائي استقطاب المواهب|مستقطب|employment consultant|employment coordinator|career consultant|careers advisor");
d("hr.recruitment-manager", "Talent Acquisition Manager", "مدير التوظيف والاستقطاب", HR, "recruitment manager|talent acquisition manager|head of talent acquisition|head of recruitment|recruitment head|recruitment director|talent acquisition director|recruitment supervisor|talent acquisition supervisor|recruitment team leader|مدير توظيف|مدير استقطاب|مدير استقطاب المواهب|رئيس قسم التوظيف|مشرف توظيف|مشرف استقطاب");
d("hr.trainer", "Trainer / Learning & Development Specialist", "مدرب / أخصائي تدريب وتطوير", HR, "trainer|corporate trainer|training specialist|training officer|training coordinator|training assistant|training executive|training consultant|learning and development specialist|learning and development officer|learning and development coordinator|learning and development trainer|learning development specialist|l d specialist|training and development specialist|training and development officer|training and development coordinator|training development specialist|regional learning and development trainer|hospitality trainer|hospitality trainer academic supervisor|sales trainer|soft skills trainer|technical trainer|safety trainer|crew trainer|staff trainer|مدرب|مدرب شركات|مدرب تطوير ذاتي|مدرب مهارات|اخصائي تدريب|مسؤول تدريب|منسق تدريب|موظف تدريب|اخصائي تدريب وتطوير|مسؤول تدريب وتطوير|اخصائي تعلم وتطوير|اخصائي تطوير|talent management specialist|talent development specialist|talent development|talent management|مدرب طاقم|مدرب موظفين|training and development|learning and development|learning development|training instructor");
d("hr.training-manager", "Training Manager", "مدير تدريب وتطوير", HR, "training manager|l d manager|learning and development manager|learning development manager|training and development manager|training development manager|head of training|head of learning and development|head of l d|training head|training director|learning and development director|training supervisor|learning and development supervisor|training team leader|مدير تدريب|مدير تدريب وتطوير|مدير تطوير التعلم والمواهب|مدير تعلم وتطوير|رئيس قسم التدريب|رئيس التدريب|مشرف تدريب|مدير تطوير الموارد البشريه|مدير تطوير المواهب|talent development manager|talent management manager");
d("hr.employee-affairs", "Employee Affairs Officer", "مسؤول شؤون موظفين", HR, "personnel officer|personnel specialist|personnel administrator|personnel assistant|personnel coordinator|employee affairs|employee affairs officer|employee affairs specialist|employee affairs coordinator|employee services|employee services officer|شؤون موظفين|شوون موظفين|شؤون الموظفين|مسؤول شؤون موظفين|اخصائي شؤون موظفين|موظف شؤون موظفين|اداري شؤون الموظفين|اداري شؤون موظفين|شؤون العاملين|مسؤول شؤون العاملين|موظف شؤون العاملين|اداري شؤون العاملين|مشرف شؤون موظفين");

// ── المبيعات ──
d("sales.sales-executive", "Sales Executive / Representative", "مندوب / ممثل مبيعات", SM, "sales executive|sales representative|sales rep|sales officer|sales specialist|sales consultant|sales agent|sales professional|sales advisor|sales adviser|sales person|sales employee|sales staff|sales team member|sales|sales executive representative|sales department representative|sales and customer service|service and sales operation|field sales|field sales representative|field sales executive|outside sales|inside sales|inside sales executive|inside sales representative|territory sales representative|territory sales executive|territory executive|retail sales executive|key account sales executive|sales account executive|counter sales|b2b sales|b2c sales|مندوب مبيعات|ممثل مبيعات|مسؤول مبيعات|اخصائي مبيعات|موظف مبيعات|مندوب|مبيعات|مسوق ميداني|مندوب تسويق|مندوب تسويق ميداني|مستشار مبيعات|مندوب بيع|ممثل بيع|تنفيذي مبيعات|تنفيذي مبيعات التجزئه|مبيعات ممثل|مندوب توزيع مبيعات|مندوب مبيعات ميداني|مدير حساب مبيعات|مندوب مبيعات وتوزيع");
d("sales.retail-sales-associate", "Retail Sales Associate", "بائع", SM, "sales associate|retail sales associate|salesman|sales man|salesperson|sales assistant|sales clerk|shop assistant|shop attendant|store associate|store assistant|retail associate|retail assistant|retail sales assistant|sales attendant|retail consultant|retail advisor|beauty advisor|fashion advisor|style advisor|brand ambassador|promoter|sales girl|salesgirl|salesgirls|saleswoman|sales woman|بائع|بائعه|بائع محل|مساعد مبيعات|مساعد بائع|موظف مبيعات محل|بائع مجوهرات|بائع عطور|بائع هواتف|بائع ملابس|بائع تجزئه|مروج مبيعات|مروج|مروجه|بائع حلويات|مندوب بيع محل|موظف بيع|موظف محل|seller|part time seller|seller part time|seller of electrical and electronic devices|wholesale representative");
d("sales.telesales", "Telesales Agent", "مندوب مبيعات هاتفية", SM, "telesales|tele sales|telesales agent|telesales executive|telesales representative|telemarketer|telemarketing|telemarketing agent|telemarketing executive|phone sales|phone sales agent|outbound sales|outbound agent|outbound caller|مبيعات هاتفيه|مندوب مبيعات هاتفي|مسوق هاتفي|تسويق هاتفي|مندوب تسويق هاتفي");
d("sales.sales-coordinator", "Sales Coordinator / Support", "منسق مبيعات", SM, "sales coordinator|sales support|sales support officer|sales support executive|sales support specialist|sales admin|sales administrator|sales administration|sales assistant coordinator|sales operations|sales operations specialist|sales operations coordinator|sales operations analyst|sales operations officer|sales analyst|sales executive assistant|order processing|order processing officer|order processing specialist|order processor|order desk|order desk coordinator|order management|order management specialist|order management officer|منسق مبيعات|دعم مبيعات|اداري مبيعات|مسؤول عمليات مبيعات|محلل مبيعات|مسؤول طلبات|منسق طلبات|معالج طلبات|مدخل طلبات");
d("sales.sales-engineer", "Sales Engineer", "مهندس مبيعات", SM, "sales engineer|technical sales|technical sales engineer|technical sales representative|technical sales specialist|technical sales executive|pre sales|presales|presales engineer|pre sales engineer|presales consultant|pre sales consultant|solution sales|solutions sales|مهندس مبيعات|مبيعات فنيه|مندوب مبيعات فني|مهندس ما قبل البيع");
d("sales.account-manager", "Account Manager", "مدير حسابات العملاء", SM, "account manager|key account manager|key accounts manager|kam|account executive|sales account manager|client manager|client service manager|client relationship manager|client partner|account director|account supervisor|account coordinator|account specialist|service account manager|digital account manager|national account manager|major account manager|strategic account manager|corporate account manager|corporate sales manager|channels and relationship manager|channel manager|channel partner manager|partner manager|partnership manager|partnerships manager|مدير حسابات رئيسيه|مدير حسابات العملاء|مدير حساب|مدير حسابات كبار العملاء|مدير حسابات رئيسية|مدير شراكات|مدير حساب رئيسي|مسؤول حسابات رئيسيه|مسؤول حسابات عملاء|مدير ادارة حسابات العملاء|حسابات رئيسيه|مدير مبيعات حسابات رئيسيه|client services manager");
d("sales.director", "Sales Director", "مدير عام المبيعات", SM, "sales director|director of sales|head of sales|chief sales officer|chief commercial officer|vp sales|vice president sales|vice president of sales|commercial director|director of commercial|head of commercial|commercial head|national sales manager|national sales head|country sales manager|general manager sales|sales general manager|مدير عام المبيعات|مدير عام مبيعات|رئيس المبيعات|رئيس قسم المبيعات|نائب رئيس المبيعات|نائب رئيس المبيعات والتسويق|مدير تجاري|مدير عام تجاري|المدير التجاري|مدير تجاري عام");
d("sales.business-development-manager", "Business Development Manager", "مدير تطوير الأعمال", SM, "business development manager|business development director|head of business development|business development head|business development lead|business development team leader|bd manager|bd director|bdm|senior business development manager|business development and investment manager|business development investment manager|business development and supply chain head|business development consultant|business development and marketing|business development and project manager|sr business development manager|مدير تطوير الاعمال|مدير تطوير اعمال|رئيس تطوير الاعمال|مدير ادارة تطوير الاعمال|مدير تطوير الاعمال والاستثمار|مدير تطوير|مدير تطوير الاعمال والمبيعات|chief partnership officer");
d("sales.business-development-specialist", "Business Development Specialist", "أخصائي تطوير أعمال", SM, "business development specialist|business development executive|business development officer|business development associate|business development coordinator|business development representative|business development analyst|business development assistant|business developer|business development|business development and public relations officer|business development and pr officer|business development and pr|bd specialist|bd executive|bd officer|اخصائي تطوير الاعمال|اخصائي تطوير اعمال|مسؤول تطوير الاعمال|مسؤول تطوير اعمال|موظف تطوير اعمال|منسق تطوير الاعمال|ممثل تطوير الاعمال|مطور اعمال|تطوير الاعمال|تطوير اعمال|مسؤول تطوير اعمال وعلاقات عامه");
d("sales.e-commerce-specialist", "E-commerce Specialist", "أخصائي تجارة إلكترونية", SM, "ecommerce specialist|ecommerce officer|ecommerce executive|ecommerce coordinator|ecommerce assistant|ecommerce analyst|ecommerce associate|ecommerce|ecommerce operations|ecommerce operations specialist|ecommerce operations coordinator|ecommerce operations supervisor|ecommerce operations officer|ecommerce operations executive|online store manager specialist|online seller|online sales|online sales specialist|online sales executive|online sales officer|online sales coordinator|marketplace specialist|marketplace manager|marketplace executive|marketplace coordinator|marketplace analyst|amazon seller|amazon specialist|amazon manager|noon specialist|noon manager|اخصائي تجاره الكترونيه|مسؤول تجاره الكترونيه|موظف تجاره الكترونيه|منسق تجاره الكترونيه|محلل تجاره الكترونيه|تجاره الكترونيه|متجر الكتروني|مسؤول متجر الكتروني|اخصائي متجر الكتروني|بائع الكتروني|بائع اونلاين");
d("sales.e-commerce-manager", "E-commerce Manager", "مدير تجارة إلكترونية", SM, "ecommerce manager|ecommerce director|head of ecommerce|ecommerce head|ecommerce lead|ecommerce team leader|ecommerce supervisor|ecommerce general manager|ecommerce business manager|ecommerce operations manager|ecommerce operation manager|online store manager|online business manager|online sales manager|online operations manager|digital commerce manager|digital commerce director|digital commerce head|digital commerce lead|مدير تجاره الكترونيه|مدير التجاره الالكترونيه|رئيس التجاره الالكترونيه|مدير متجر الكتروني|مدير مبيعات الكترونيه|مدير مبيعات اونلاين|مدير عمليات التجاره الالكترونيه");
d("sales.medical-rep", "Medical Representative", "مندوب دعاية طبية", SM, "medical representative|medical rep|medical science liaison|msl|medical sales representative|medical science representative|hematology msl|pharma sales|pharmaceutical sales representative|مندوب دعايه طبيه|مندوب طبي|مندوب ادويه|مندوب شركه ادويه");

// ── التسويق والإعلام ──
d("mkt.digital-marketing-specialist", "Digital Marketing Specialist", "أخصائي تسويق رقمي", SM, "digital marketing specialist|digital marketing executive|digital marketing officer|digital marketer|digital marketing|digital marketing coordinator|digital marketing associate|digital marketing analyst|digital marketing consultant|digital marketing assistant|e marketing|e marketing specialist|email marketing|email marketing specialist|performance marketing|performance marketing specialist|performance marketer|performance marketing manager|growth marketer|growth marketing|growth marketing specialist|growth marketing manager|seo specialist|seo|sem specialist|sem|ppc specialist|ppc|media buyer|media buying|media planner|media planning|paid media specialist|paid media|paid media manager|online marketing|online marketing specialist|online marketing manager|internet marketing|internet marketing specialist|internet marketing manager|web marketing|web marketing specialist|web marketing manager|digital sales specialist|digital channels|lead digital channels|lead digital channels travelerpass|lead digital channels travelerpass uae|اخصائي تسويق رقمي|مسوق رقمي|تسويق رقمي|اخصائي تسويق الكتروني|مسوق الكتروني|تسويق الكتروني|اخصائي تسويق الكتروني ووسائل التواصل الاجتماعي|مسؤول تسويق رقمي|مسؤول تسويق الكتروني|موظف تسويق رقمي|منسق تسويق رقمي|مسؤول تسويق رقمي ومندوب مشتريات");
d("mkt.digital-marketing-manager", "Digital Marketing Manager", "مدير تسويق رقمي", SM, "digital marketing manager|digital marketing director|head of digital marketing|head of digital|digital director|digital manager|digital marketing head|digital marketing supervisor|digital marketing team leader|e commerce marketing manager|performance marketing head|growth manager|growth director|head of growth|مدير تسويق رقمي|مدير التسويق الرقمي|مدير تسويق الكتروني|رئيس التسويق الرقمي|مشرف تسويق رقمي|مدير نمو|مدير القنوات الرقميه|مدير ادارة التسويق الرقمي");
d("mkt.content-writer", "Content Writer / Creator", "كاتب / صانع محتوى", SM, "content writer|content writer copy writer|content creator|content specialist|content strategist|content executive|content officer|content coordinator|content producer|content developer|content editor|copywriter|copy writer|copy editor|creative writer|blogger|technical writer|article writer|digital content creator|digital content specialist|digital content manager media consultant|كاتب محتوى|صانع محتوى|محرر محتوى|اخصائي محتوى|كاتب اعلانات|كاتب ابداعي|مدون|كاتب مقالات|كاتب تقني|مسؤول محتوى|منسق محتوى|مدير محتوى|مدير المحتوى|content manager|head of content|content director|content lead|chief of media content and editing|رئيس تحرير المحتوى|رئيس المحتوى");
d("mkt.brand-manager", "Brand Manager / Strategist", "مدير علامة تجارية", SM, "brand manager|brand strategist|brand specialist|brand executive|brand officer|brand coordinator|brand director|head of brand|brand lead|brand marketing manager|brand marketing specialist|brand marketing|brand development manager|brand development specialist|brand development|brand communications|brand communication|brand communications manager|brand communications specialist|brand identity designer|brand identity|product marketing manager|product marketing specialist|product marketing|product marketer|category manager|category specialist|category executive|category analyst|category buyer|trade marketing manager|trade marketing specialist|trade marketing executive|trade marketing|shopper marketing|مدير علامه تجاريه|مدير علامات تجاريه|اخصائي علامه تجاريه|استراتيجي علامه تجاريه|مدير العلامه التجاريه|مدير ادارة العلامه التجاريه|اخصائي علامات تجاريه|مسؤول علامه تجاريه|مدير تسويق منتج|مدير تسويق المنتجات|اخصائي تسويق منتج|مدير فئه|مدير فئات|مدير تسويق تجاري|اخصائي تسويق تجاري");
d("mkt.graphic-designer", "Graphic Designer", "مصمم جرافيك", SM, "graphic designer|graphics designer|graphic design|graphics design|graphic artist|graphics artist|designer|visual designer|creative designer|digital designer|multimedia designer|motion designer|motion graphics designer|motion graphic designer|motion graphics|motion graphic|video editor|video editing|video editor motion designer|animator motion|illustrator|layout designer|print designer|packaging designer|art director|creative director|creative lead|design lead|design manager|head of design|مصمم جرافيك|مصمم|مصمم جرافيكي|مصمم فيديو|مصمم موشن جرافيك|مصمم رسوم|مصمم اعلانات|مصمم مطبوعات|مصمم عبوات|مدير ابداعي|مدير تصميم|رئيس قسم التصميم|مونتير|مونتاج|محرر فيديو|رسام|رسام تصميم|مصمم مواقع|مصمم صفحات|graphics web designer|graphics designer web|graphic designer web designer|graphic designer digital marketer|graphics web designer digital marketer|web designer");
d("mkt.photographer", "Photographer / Videographer", "مصوّر", SM, "photographer|videographer|cinematographer|camera operator|camera man|cameraman|photo editor|photojournalist|photography|videography|video producer|video production|video production specialist|photographer videographer|photography and videography|مصور|مصور فوتوغرافي|مصور فيديو|مصور فوتوغرافي ومصور فيديو|مصور صحفي|مصور تلفزيوني|مصور سينمائي|مصور منتجات|مصور مناسبات|مصور اعراس|مصوره|مصوره فوتوغرافيه|تصوير|تصوير فوتوغرافي|تصوير فيديو|تصوير مناسبات");
d("mkt.community-manager", "Community Manager", "مدير مجتمع رقمي", SM, "community manager|community managers|online community manager|community specialist|community coordinator|community officer|community executive|community lead|community head|community director|community engagement|community engagement specialist|community engagement manager|community engagement officer|community engagement coordinator|community engagement executive|community management|مدير مجتمع|مدير مجتمع رقمي|مدير مجتمع اونلاين|اخصائي مجتمع|منسق مجتمع");
d("mkt.market-research", "Market Research Specialist", "أخصائي أبحاث السوق", SM, "market research specialist|market research officer|market research coordinator|market research executive|market research manager|market research assistant|marketing research|marketing researcher|marketing research specialist|marketing research officer|marketing research manager|marketing analyst|marketing data analyst|marketing intelligence|marketing intelligence analyst|marketing insights|marketing insights analyst|marketing insights manager|consumer insights|consumer insights analyst|consumer insights manager|consumer research|consumer researcher|survey specialist|survey officer|survey coordinator|survey enumerator|surveyor market|field researcher|field research|field research specialist|field research officer|field researcher survey|باحث تسويقي|باحث سوق|اخصائي بحوث سوق|اخصائي ابحاث السوق|محلل تسويقي|مدير بحوث السوق|مدير ابحاث السوق|باحث ميداني|باحث استطلاعات|اخصائي استطلاعات|مسؤول استطلاعات");

// ── الإعلام ──
d("media.journalist", "Journalist / Editor", "صحفي / محرر", OT, "journalist|reporter|news reporter|editor|chief editor|managing editor|news editor|sub editor|copy editor news|news anchor|anchor|presenter|tv presenter|radio presenter|broadcaster|correspondent|columnist|proofreader|صحفي|صحفيه|مراسل|محرر|رئيس تحرير|مذيع|مذيعه|مقدم برامج|مقدم برنامج|كاتب صحفي|كاتب في صحيفه|كاتب في صحيفه الجزيره|مدقق لغوي|مدققه لغويه|مصحح لغوي|مصحح|محرر لغوي|محرر نصوص|صحافي");
d("media.producer", "Producer / Director (Media)", "منتج / مخرج إعلامي", OT, "producer|executive producer|line producer|casting director|film director|filmmaker|film maker|video director|talent manager line producer|مخرج|مخرجه|مخرج فني|منتج تلفزيوني|منتج افلام");

// ── الإدارة المكتبية ──
d("adm.translator", "Translator / Interpreter", "مترجم", OT, "translator|translators|interpreter|translation|translation specialist|translation officer|translation coordinator|translation manager|professional translator|freelance translator|legal translator|medical translator|technical translator|simultaneous interpreter|consecutive interpreter|translator interpreter|translator and interpreter|translator and proofreader|translator proofreader|professional translator text proofreader|مترجم|مترجمه|مترجم فوري|مترجم تحريري|مترجم قانوني|مترجم طبي|مترجم معتمد|مترجم محلف|ترجمه|اخصائي ترجمه|مسؤول ترجمه|موظف ترجمه|مدير ترجمه|مدير مكتب ترجمه|مكتب ترجمه");
d("adm.administrative-assistant", "Administrative Assistant / Officer", "مساعد / موظف إداري", AD, "administrative assistant|admin assistant|office assistant|administrative officer|admin officer|administrative specialist|administrative executive|administrative coordinator|admin coordinator|administrator|office administrator|admin|administration|administrative|administration officer|administrative clerk|office clerk|clerk|office support|office admin assistant|support staff|admin executive|admin specialist|administrative support|اداري|موظف اداري|مساعد اداري|اداري مساعد|كاتب اداري|مسؤول اداري|منسق اداري|اخصائي اداري|موظف مكتبي|اعمال مكتبيه|اعمال اداريه|مساعد ادارة");
d("adm.admin-supervisor", "Administrative Supervisor", "مشرف إداري", AD, "administrative supervisor|admin supervisor|office supervisor|administration supervisor|مشرف اداري|مشرف مكتب|مشرف الشؤون الاداريه");
d("adm.admin-manager", "Administration Manager", "مدير إداري", AD, "administrative manager|admin manager|administration manager|head of administration|head of admin|administration director|administrative director|support services manager|general services manager|general service manager|business support manager|business support services manager|مدير اداري|مدير الشؤون الاداريه|مدير عام الشؤون الاداريه|مدير الخدمات المساندة|مدير الخدمات العامه|رئيس قسم الشؤون الاداريه|رئيس قسم العمليات الاداريه|مدير دعم الاعمال");
d("adm.office-manager", "Office Manager", "مدير مكتب", AD, "office manager|head of office|مدير مكتب|مدير مكاتب|مدير المكتب|مسؤول مكتب|منسق مكتب");
d("adm.secretary", "Secretary / Executive Assistant", "سكرتير / مساعد تنفيذي", AD, "secretary|executive secretary|personal secretary|private secretary|administrative secretary|office secretary|medical secretary|executive assistant|personal assistant|assistant to ceo|assistant executive|secretary under operation department|سكرتير|سكرتارية|سكرتير تنفيذي|سكرتير شخصي|سكرتير خاص|سكرتير مدير|سكرتير طبي|مساعد تنفيذي|مساعد شخصي|مساعد المدير العام|سكرتير مكتب|سكرتير ومنسق مكتب");
d("adm.receptionist", "Receptionist / Front Desk Agent", "موظف استقبال", AD, "receptionist|reception|front desk|front desk agent|front desk receptionist|front desk officer|front desk associate|front desk clerk|front office|front office agent|front office receptionist|front office officer|front office associate|front office executive|reception agent|reception officer|reception executive|reception staff|office receptionist|medical receptionist|hotel receptionist|موظف استقبال|مسؤول استقبال|اخصائي استقبال|استقبال|موظف مكتب امامي|موظف مكتب الاستقبال|مكتب امامي|front liner|frontliner");
d("adm.data-entry", "Data Entry Clerk", "مدخل بيانات", AD, "data entry|data entry clerk|data entry operator|data entry specialist|data entry officer|data entry assistant|data entry executive|data input|data input clerk|data processor|data encoder|encoder|typist|computer operator|data operator|data clerk|مدخل بيانات|ادخال بيانات|مدخل معلومات|موظف ادخال بيانات|مسؤول ادخال بيانات|طابع|موظف طباعه");
d("adm.document-controller", "Document Controller", "مراقب وثائق", AD, "document controller|documents controller|documentation controller|document control|document control specialist|document control officer|document control coordinator|document control engineer|document control assistant|documentation specialist|documentation officer|documentation coordinator|documentation engineer|doc controller|archivist|archive officer|archive clerk|archive specialist|records clerk|records officer|records manager|librarian|library assistant|مراقب وثائق|مراقب مستندات|اخصائي وثائق|مسؤول وثائق|موظف وثائق|امين ارشيف|ارشيف|موظف ارشيف|امين مكتبه");
d("adm.government-relations", "Government Relations Officer", "مسؤول علاقات حكومية", AD, "government relations officer|government relations|government affairs|government affairs officer|government affairs specialist|government affairs manager|government relations specialist|government relations manager|government liaison|government representative|government services officer|governmental relations|mandoub|muaqib|pro officer|liaison officer|مسؤول علاقات حكوميه|موظف علاقات حكوميه|اخصائي علاقات حكوميه|مدير علاقات حكوميه|ممثل شؤون حكوميه|علاقات حكوميه|شؤون حكوميه|مسؤول شؤون حكوميه|مندوب حكومي|معقب|معقب معاملات|مسؤول معاملات حكوميه|مسؤول تعقيب|موظف تعقيب");

// ── خدمة العملاء ──
d("cs.representative", "Customer Service Representative", "ممثل خدمة عملاء", AD, "customer service representative|customer services representative|customer service rep|csr|customer service agent|customer service officer|customer services officer|customer service specialist|customer service executive|customer service associate|customer service employee|customer service assistant|customer service|customer services|customer care representative|customer care agent|customer care officer|customer care specialist|customer care executive|customer care associate|customer care|customer support representative|customer support agent|customer support officer|customer support specialist|customer support executive|customer support associate|customer support|customer experience representative|customer experience agent|customer experience officer|customer experience specialist|customer experience executive|customer experience associate|customer relations officer|customer relations specialist|customer relations representative|customer relations executive|customer relations|client service representative|client services representative|client service officer|client service specialist|client services|client service|call center agent|call centre agent|call center representative|call centre representative|call center employee|call center operator|call center|call centre|contact center agent|contact centre agent|contact center representative|contact center|contact centre|telecaller|tele caller|telephone operator|telephone agent|telephone representative|helpdesk agent|help desk agent|service desk agent|inbound agent|inbound caller|inbound sales|customer resolution coworker|customer resolution|customer resolution specialist|customer resolution officer|customer resolution agent|customer happiness|customer happiness officer|customer happiness specialist|customer happiness agent|customer success|customer success specialist|customer success officer|customer success representative|customer success agent|customer success executive|customer success associate|csr barista|csr agent|خدمه عملاء|خدمه العملاء|ممثل خدمه عملاء|ممثل خدمه العملاء|ممثله خدمه عملاء|موظف خدمه عملاء|موظفه خدمه عملاء|موظف خدمه العملاء|اخصائي خدمه عملاء|اخصائي خدمه العملاء|مسؤول خدمه عملاء|مسؤول خدمه العملاء|منفذ خدمه عملاء|منفذه خدمه عملاء|مامور خدمه عملاء|عميل خدمه|مركز اتصال|موظف مركز اتصال|موظف مركز اتصالات|موظف كول سنتر|كول سنتر|موظف اتصال|موظف رعايه عملاء|رعايه العملاء|رعايه عملاء|دعم العملاء|دعم عملاء|موظف دعم عملاء|اخصائي دعم عملاء|ممثل دعم عملاء|ممثل خدمه كبار العملاء|ممثل خدمه العملاء vip|vip customer service|vip customer service representative|vip customer care|vip customer care representative|vip client service|vip client service representative|مسؤول تجربه عملاء|اخصائي تجربه عملاء|موظف تجربه عملاء|ممثل تجربه عملاء|ممثل علاقات عملاء|اخصائي علاقات عملاء|مسؤول علاقات عملاء|موظف علاقات عملاء|منسق علاقات عملاء|منسق خدمه عملاء|منسق خدمه العملاء|سنترال|مسؤول سنترال|مأمور سنترال|operator pbx|pbx operator|switchboard operator|اخصائي تواصل داخلي|outbound support officer|outbound coworker|outbound co worker");
d("cs.supervisor", "Customer Service Supervisor", "مشرف خدمة عملاء", AD, "customer service supervisor|customer services supervisor|customer care supervisor|customer support supervisor|customer experience supervisor|customer relations supervisor|client service supervisor|client services supervisor|call center supervisor|call centre supervisor|contact center supervisor|contact centre supervisor|call center team leader|call centre team leader|contact center team leader|contact centre team leader|customer service team leader|customer services team leader|customer care team leader|customer support team leader|customer experience team leader|customer service lead|customer care lead|customer support lead|مشرف خدمه عملاء|مشرف خدمه العملاء|مشرف مركز اتصال|مشرف كول سنتر|مشرف رعايه العملاء|مشرف دعم العملاء|مشرف تجربه العملاء|قائد فريق خدمه العملاء|قائد فريق خدمه عملاء|رئيس فريق خدمه العملاء|رئيس فريق خدمه عملاء|قائد فريق مركز الاتصال|قائد فريق كول سنتر|قائد فريق رعايه العملاء|قائد فريق دعم العملاء|قائد فريق تجربه العملاء");
d("cs.manager", "Customer Service Manager", "مدير خدمة عملاء", AD, "customer service manager|customer services manager|customer care manager|customer support manager|customer experience manager|customer relations manager|call center manager|call centre manager|contact center manager|contact centre manager|head of customer service|head of customer care|head of customer support|head of customer experience|head of customer relations|head of client services|customer service director|customer care director|customer support director|customer experience director|customer relations director|director of customer service|director of customer care|director of customer support|director of customer experience|director of customer relations|customer service assistant manager|chief customer officer|customer success manager|customer success director|head of customer success|مدير خدمه عملاء|مدير خدمه العملاء|مدير رعايه العملاء|مدير دعم العملاء|مدير تجربه العملاء|مدير تجربه عملاء|مدير علاقات العملاء|مدير مركز اتصال|مدير مركز الاتصال|مدير كول سنتر|رئيس خدمه العملاء|رئيس قسم خدمه العملاء|رئيس مركز الاتصال|رئيس مركز الاستفسارات والاتصال|رئيس مركز الاستفسارات والتواصل|head of inquiries and communication center|head of inquiries and communication center saso|head of inquiries communication center|head of inquiries communication center saso|head of inquiries and communication centre|inquiries and communication center|inquiries center|inquiries centre|inquiry center|inquiry centre|مركز الاستفسارات والاتصال|مركز الاستفسارات");

// ── الإدارة العليا ──
d("mgmt.ceo", "CEO / Executive Director", "الرئيس التنفيذي / المدير التنفيذي", AD, "ceo|chief executive officer|chief executive|executive director|executive manager|deputy ceo|president|vice president|vp|chairman|chairperson|board member|managing partner|الرئيس التنفيذي|رئيس تنفيذي|المدير التنفيذي|مدير تنفيذي|نائب الرئيس التنفيذي|نائب الرئيس|رئيس مجلس الاداره|عضو مجلس ادارة|نائب المدير التنفيذي|رئيس الشركه");
d("mgmt.coo", "COO / Operations Director", "الرئيس التنفيذي للعمليات (COO)", AD, "coo|chief operating officer|chief operations officer|operations director|operation director|director of operations|vp operations|vice president operations|head of operations|head of operation|operations head|group operations director|group operations manager|national operations manager|country operations manager|الرئيس التنفيذي للعمليات|رئيس العمليات|رئيس قسم العمليات|مدير عام العمليات|مدير العمليات العام|مدير عمليات عام|نائب رئيس العمليات|مدير عمليات تنفيذي|مدير عمليات المجموعه");
d("mgmt.general-manager", "General Manager / Managing Director", "مدير عام", AD, "general manager|gm|managing director|md|deputy general manager|assistant general manager|country manager|general director|director general|branch general manager|group general manager|business unit head|business unit manager|business unit director|division manager|divisional manager|division head|head of division|head of business unit|company manager|company director|مدير عام|المدير العام|مدير عام مساعد|نائب المدير العام|نائب مدير عام|مدير عام تنفيذي|مدير الشركه|مدير شركه|مدير اعمال|مدير قطاع|رئيس قطاع|مدير اول|مدير عام الشركه|مدير عام الفرع|مدير عام المجموعه");
d("mgmt.owner", "Business Owner / Founder", "مالك / مؤسس منشأة", AD, "owner|business owner|company owner|store owner|shop owner|restaurant owner|cafe owner|founder|co founder|cofounder|entrepreneur|self employed|proprietor|sole proprietor|startup founder|founder and ceo|owner manager|businessman|businesswoman|مالك|صاحب عمل|صاحب مشروع|صاحب منشاه|صاحب شركه|صاحب محل|صاحب مطعم|رائد اعمال|رائده اعمال|عمل حر|اعمال حره|رجل اعمال|سيده اعمال|تاجر|مالك منشاه|مالك مشروع|مالك شركه|مالك ومدير|مؤسس ومالك");

// ── العمليات والفروع ──
d("ops.area-manager", "Area / Regional Manager", "مدير منطقة / إقليمي", AD, "area manager|regional manager|district manager|multi unit manager|multiunit manager|multi site manager|multi branch manager|multi store manager|multi outlet manager|multi restaurant manager|cluster manager|cluster head|cluster director|cluster general manager|cluster operations manager|territory manager|zone manager|zonal manager|region manager|regional head|regional director|area director|area head|area operations manager|regional operations manager|regional operation manager|regional operations head|regional operations director|area operation manager|area general manager|field operations manager|مدير منطقه|مدير المنطقه|مدير اقليمي|مدير اقليم|مدير مناطق|مدير متعدد الوحدات|مدير عمليات اقليمي|مدير عمليات منطقه|مدير عمليات المنطقه|مدير مجموعه فروع|مدير مجموعه مطاعم");
d("ops.branch-manager", "Branch Manager", "مدير فرع", AD, "branch manager|branch head|branch director|branch in charge|branch incharge|branch operations manager|branches manager|مدير فرع|مدير الفرع|مدير فروع|مسؤول فرع|مسؤول الفرع|رئيس فرع|نائب مدير فرع|مساعد مدير فرع|مدير فرع بنك|مدير عمليات فرع|مدير بنك|bank manager");
d("ops.branch-supervisor", "Branch Supervisor", "مشرف فرع", AD, "branch supervisor|branch team leader|branch lead|branch coordinator|branch senior officer|branch operations supervisor|مشرف فرع|مشرف الفرع|مشرف فروع|مشرف الفروع");

// ── التجزئة ──
d("ret.store-manager", "Store / Showroom Manager", "مدير متجر / معرض", SM, "store manager|shop manager|showroom manager|retail manager|retail store manager|retail operations manager|retail director|retail head|head of retail|store director|store head|store general manager|shop director|showroom director|mall manager|store leader|assistant store manager|مدير متجر|مدير المتجر|مدير معرض|مدير المعرض|مدير محل|مدير المحل|مدير تجزئه|مدير مبيعات تجزئه|مدير صاله عرض|مدير مركز تجاري|مدير سوبر ماركت|مدير بقاله|مدير هايبر ماركت|مساعد مدير متجر|مساعد مدير معرض|نائب مدير متجر|boutique manager|boutique supervisor|مدير مول");
d("ret.store-supervisor", "Store / Showroom Supervisor", "مشرف متجر / معرض", SM, "store supervisor|shop supervisor|showroom supervisor|retail supervisor|retail store supervisor|store in charge|store incharge|shop in charge|showroom in charge|store team leader|shop team leader|showroom team leader|retail team leader|مشرف متجر|مشرف المتجر|مشرف معرض|مشرف المعرض|مشرف محل|مشرف تجزئه|مشرف صاله بيع|مشرف صاله عرض|مشرف سوبر ماركت|مسؤول متجر|مسؤول معرض|مسؤول محل");
d("ret.cashier", "Cashier", "كاشير / أمين صندوق", SM, "cashier|store cashier|shop cashier|supermarket cashier|retail cashier|restaurant cashier|cafe cashier|head cashier|senior cashier|cashier supervisor|cash handler|checkout operator|checkout assistant|pos operator|pos cashier|كاشير|كاشيره|امين صندوق|امينه صندوق|محاسب صندوق|موظف صندوق|موظف كاشير|امين صيدوق");
d("ret.merchandiser", "Merchandiser", "منسّق عرض وتسويق منتجات", SM, "merchandiser|visual merchandiser|visual merchandising|merchandising|merchandising specialist|merchandising officer|merchandising assistant|merchandising executive|merchandising coordinator|field merchandiser|shelf stacker|shelf filler|stock clerk|stock associate|مرتب بضائع|مرتب رفوف|منسق عرض|ميرشندايزر|موظف ترتيب رفوف|عامل ترتيب رفوف");

// ── سلاسل الإمداد ──
d("scm.planner", "Supply / Demand Planner", "مخطط طلب وإمداد", LG, "planner|supply planner|demand planner|supply chain planner|material planner|materials planner|production planner|demand and supply planner|inventory planner|replenishment planner|master scheduler|production scheduler|مخطط|مخطط الطلب|مخطط الامداد|مخطط سلسله الامداد|مخطط مواد|مخطط انتاج|مخطط طلب وعرض|كبير مخططين الطلب");
d("scm.inventory-controller", "Inventory / Stock Controller", "مراقب مخزون", LG, "inventory controller|stock controller|inventory control|stock control|inventory specialist|inventory officer|inventory coordinator|inventory analyst|inventory clerk|material controller|materials controller|inventory manager|stock manager|مراقب مخزون|مراقب مخازن|مراقب مستودع|اخصائي مخزون|مسؤول مخزون|موظف مخزون|منسق مخزون|مدير مخزون|جرد|مسؤول جرد");
d("scm.customs-clearance", "Customs Clearance Officer", "مخلّص جمركي", LG, "customs clearance|customs clearance officer|customs clearance specialist|customs clearance agent|customs clearance coordinator|customs broker|customs agent|customs officer|customs specialist|customs coordinator|customs|clearing agent|clearance officer|import export officer|import export specialist|import export coordinator|مخلص جمركي|مخلص جمارك|تخليص جمركي|التخليص الجمركي|مسؤول تخليص جمركي|موظف تخليص جمركي|منسق تخليص جمركي|مخلص|موظف جمارك|مسؤول جمارك|استيراد وتصدير|مسؤول استيراد وتصدير");
d("scm.freight", "Freight / Shipping Coordinator", "منسق شحن", LG, "freight forwarder|freight forwarding|freight coordinator|freight specialist|freight officer|shipping coordinator|shipping specialist|shipping officer|shipping executive|shipping agent|shipping clerk|sea freight|air freight|sea logistics|inbound sea logistics champion|منسق شحن|مسؤول شحن|موظف شحن|اخصائي شحن|شحن|مسؤول شحن وتفريغ");
d("scm.contracts", "Contracts Specialist", "أخصائي عقود", LG, "contract specialist|contracts specialist|contract administrator|contracts administrator|contract officer|contracts officer|contracting officer|contracting specialist|contract manager|contracts manager|contract coordinator|contract analyst|contract engineer|contracts engineer|contract|contracts|contracting|contract management|مسؤول عقود|موظف عقود|اخصائي عقود|منسق عقود|مدير عقود|رئيس قسم العقود|رئيس قسم التعاقد|رئيس قسم التعاقد واوامر الشراء|مسؤول تعاقدات|اخصائي تعاقدات|تعاقد|عقود");

// ── اللوجستيات والنقل ──
d("log.driver", "Driver", "سائق", LG, "driver|company driver|private driver|personal driver|family driver|truck driver|lorry driver|trailer driver|bus driver|taxi driver|limousine driver|chauffeur|delivery driver|van driver|school bus driver|public driver|سائق|سائق خاص|سائق شركه|سائق عمومي|سائق شاحنه|سائق نقل|سائق حافله|سائق باص|سائق تاكسي|سائق ليموزين|سائق توصيل|سائق ثقيل|سائق خفيف|سائق وايت|سائق تريلا");
d("log.courier", "Courier / Delivery Rider", "مندوب توصيل", LG, "courier|delivery man|delivery boy|delivery rider|delivery agent|delivery person|delivery staff|delivery|rider|motorcycle rider|dispatch rider|messenger|office boy|مندوب توصيل|مندوب توزيع|مندوب تسليم|موصل طلبات|موزع|عامل توصيل|توصيل|توصيل طلبات|دليفري|موظف توصيل|مراسل مكتب|فراش|ساعي|اوفيس بوي");
d("log.forklift-operator", "Forklift / Equipment Operator", "مشغّل رافعة / معدات", LG, "forklift operator|forklift driver|forklift|reach truck operator|pallet jack operator|crane operator|heavy equipment operator|heavy machinery operator|equipment operator|excavator operator|loader operator|مشغل رافعه شوكيه|مشغل رافعه|مشغل رافعات|مشغل معدات|مشغل معدات ثقيله|مشغل حفار|مشغل لودر|سائق رافعه|مشغل ونش");
d("log.dispatcher", "Dispatcher", "منسق إرسال وتوزيع", LG, "dispatcher|dispatch|dispatch officer|dispatch coordinator|dispatch specialist|dispatch clerk|dispatch controller|fleet dispatcher|transport dispatcher|logistics dispatcher|truck dispatcher|مرسل|منسق ارسال|مسؤول ارسال|موظف ارسال|ديسباتشر|منسق توزيع|مسؤول توزيع|موظف توزيع|مشرف توزيع|distribution officer|distribution coordinator|distribution specialist");

// ── الهندسة ──
d("eng.civil-engineer", "Civil Engineer", "مهندس مدني", CN, "civil engineer|civil engineering|civil project engineer|civil design engineer|civil works engineer|مهندس مدني|مهندس مدني مشاريع|مهندسه مدنيه|هندسه مدنيه");
d("eng.site-engineer", "Site / Construction Engineer", "مهندس موقع", CN, "site engineer|civil site engineer|site civil engineer|construction engineer|resident engineer|field engineer|execution engineer|site supervisor engineer|مهندس موقع|مهندس تنفيذ|مهندس اشراف|مهندس مشرف موقع|مهندس ميداني|مهندس انشاءات");
d("eng.structural-engineer", "Structural Engineer", "مهندس إنشائي", CN, "structural engineer|structural design engineer|structural engineering|مهندس انشائي|مهندس هياكل");
d("eng.architect", "Architect", "مهندس معماري", CN, "architect|architectural engineer|architectural designer|architectural technician|مهندس معماري|معماري|مهندسه معماريه|مصمم معماري");
d("eng.interior-designer", "Interior Designer", "مصمم داخلي", CN, "interior designer|interior design|interior architect|decor designer|مصمم داخلي|مصمم ديكور|تصميم داخلي|مهندس ديكور");
d("eng.draftsman", "Draftsman / CAD Technician", "رسّام هندسي", CN, "draftsman|draughtsman|autocad draftsman|cad draftsman|cad technician|cad operator|drafter|bim technician|bim modeler|رسام هندسي|رسام اوتوكاد|فني رسم");
d("eng.quantity-surveyor", "Quantity Surveyor / Estimator", "مهندس كميات وتقدير", CN, "quantity surveyor|qs|estimator|cost estimator|estimation engineer|estimating engineer|quantity engineer|مهندس كميات|مساح كميات|مهندس تقدير تكاليف|مقدر تكاليف|مهندس مناقصات|tender engineer|tendering engineer");
d("eng.surveyor", "Land Surveyor", "مساح", CN, "surveyor|land surveyor|survey engineer|surveying engineer|survey technician|مساح|مهندس مساحه|مساح اراضي");
d("eng.mechanical-engineer", "Mechanical Engineer", "مهندس ميكانيكي", EN, "mechanical engineer|mechanical design engineer|mechanical engineering|hvac engineer|hvac design engineer|mechanical hvac engineer|mechanical hvac|مهندس ميكانيكي|مهندس ميكانيكا|مهندس تكييف|مهندسه ميكانيكيه|هندسه ميكانيكيه|مهندس ميكانيكي hvac");
d("eng.electrical-engineer", "Electrical Engineer", "مهندس كهرباء", EN, "electrical engineer|electrical design engineer|electrical engineering|electrical project engineer|power engineer|electrical work unit manager engineer|مهندس كهرباء|مهندس كهربائي|مهندسه كهرباء|هندسه كهربائيه|مهندس طاقه");
d("eng.industrial-engineer", "Industrial Engineer", "مهندس صناعي", EN, "industrial engineer|industrial engineering|process improvement engineer|lean engineer|continuous improvement engineer|operations excellence engineer|مهندس صناعي|هندسه صناعيه");
d("eng.chemical-engineer", "Chemical Engineer", "مهندس كيميائي", EN, "chemical engineer|chemical engineering|process engineer|petrochemical engineer|مهندس كيميائي|مهندس كيمياء|مهندس عمليات");
d("eng.production-engineer", "Production / Manufacturing Engineer", "مهندس إنتاج", EN, "production engineer|manufacturing engineer|production process engineer|plant engineer|مهندس انتاج|مهندس تصنيع|مهندس مصنع");
d("eng.project-engineer", "Project Engineer", "مهندس مشاريع", EN, "project engineer|projects engineer|project operation engineer|operations project engineer|مهندس مشروع|مهندس مشاريع");
d("eng.planning-engineer", "Planning & Project Controls Engineer", "مهندس تخطيط ومراقبة مشاريع", CN, "planning engineer|project planner|project planning engineer|project controls engineer|project control engineer|planning and control engineer|planning control engineer|scheduler|scheduling engineer|project scheduler|primavera planner|planning and scheduling engineer|مهندس تخطيط|مهندس تخطيط ومراقبه مشاريع|مهندس مراقبه مشاريع|مخطط مشاريع|مهندس جدوله");
d("eng.qaqc-engineer", "QA/QC Engineer", "مهندس جودة", EN, "qa qc engineer|qc engineer|qa engineer quality|quality engineer|quality control engineer|quality assurance engineer|quality inspector|qc inspector|qa qc inspector|qa qc|quality control inspector|quality control|quality assurance|مهندس جوده|مهندس ضبط جوده|مفتش جوده|فاحص جوده|مراقب جوده");
d("eng.maintenance-engineer", "Maintenance Engineer", "مهندس صيانة", EN, "maintenance engineer|reliability engineer|operation and maintenance engineer|o m engineer|maintenance and operation engineer|facility maintenance engineer|مهندس صيانه|مهندس موثوقيه|مهندس تشغيل وصيانه");
d("eng.maintenance-planner", "Maintenance Planner", "مخطط صيانة", EN, "maintenance planner|maintenance scheduler|maintenance planning|maintenance planning engineer|turnaround planner|turnaround and major maintenance planning and control engineer|مخطط صيانه|منسق صيانه");
d("eng.facilities-engineer", "Facilities Engineer", "مهندس مرافق", EN, "facilities engineer|facility engineer|facility management engineer|facilities management engineer|building services engineer|mep engineer|mep team leader|مهندس مرافق|مهندس خدمات مباني|مهندس ميكانيكا وكهرباء");
d("eng.cost-engineer", "Cost Control Engineer", "مهندس تكاليف", EN, "cost control engineer|cost engineer|cost control engineer projects|engineer control cost|cost control projects|مهندس تكاليف|مهندس مراقبه تكاليف|مهندس ضبط تكاليف");
d("eng.petroleum-engineer", "Petroleum / Oil & Gas Engineer", "مهندس نفط وغاز", EN, "petroleum engineer|drilling engineer|reservoir engineer|oil and gas engineer|production operations engineer|geologist|geophysicist|mud engineer|wellsite geologist|مهندس بترول|مهندس نفط|مهندس غاز|مهندس حفر|جيولوجي|مهندس خزانات");
d("eng.environmental-engineer", "Environmental Engineer", "مهندس بيئة", AG, "environmental engineer|sustainability engineer|environmental and sustainability engineer|environmental specialist|environmental officer|sustainability specialist|sustainability officer|esg specialist|مهندس بيئه|اخصائي بيئه|اخصائي استدامه|مسؤول بيئه");
d("eng.design-engineer", "Design Engineer", "مهندس تصميم", EN, "design engineer|product design engineer|design and development engineer|r d engineer|research and development engineer|مهندس تصميم|مهندس تطوير منتجات");
d("eng.instrumentation-engineer", "Instrumentation / Control Engineer", "مهندس أجهزة وتحكم", EN, "instrumentation engineer|instrument engineer|automation engineer|control systems engineer|scada engineer|plc engineer|مهندس اجهزه|مهندس تحكم|مهندس اتمته|مهندس تحكم الي");
d("eng.materials-engineer", "Textile / Materials Engineer", "مهندس مواد", EN, "materials engineer|metallurgical engineer|textile engineer|corrosion engineer|welding engineer|مهندس مواد|مهندس معادن|مهندس لحام");
d("eng.engineering-manager", "Engineering Manager", "مدير هندسة", EN, "engineering manager|engineering director|head of engineering|chief engineer|technical manager|technical director|head of technical|مدير هندسه|مدير ادارة الهندسه|مدير فني|مدير هندسي|المدير الفني|كبير المهندسين|رئيس المهندسين|رئيس قسم الهندسه");
d("eng.general-engineer", "Engineer (field unspecified)", "مهندس (تخصص غير محدد)", EN, "engineer|engineers|مهندس|مهندسه|consulting engineer|engineering consultant|مهندس استشاري|استشاري هندسي|مهندس مبتدئ|junior engineer|lead engineer|principal engineer|staff engineer|engineering specialist|اخصائي هندسه|engineering");

// ── الحرف والصيانة ──
d("trade.maintenance-technician", "Maintenance Technician", "فني صيانة", TR, "maintenance technician|mechanical technician|technician|maintenance worker|maintenance|maintenance staff|maintenance specialist|maintenance officer|maintenance assistant|maintenance operator|building maintenance technician|facility technician|facilities technician|service technician|field technician|power services technician|فني|فني صيانه|فني ميكانيك|فني ميكانيكي|عامل صيانه|صيانه|موظف صيانه|مسؤول صيانه|فني مباني|فني خدمات");
d("trade.electrician", "Electrician", "كهربائي", TR, "electrician|electrical technician|electrical foreman|electrical supervisor tech|wireman|كهربائي|فني كهرباء|فني كهربائي|كهربجي|كهربائي مباني");
d("trade.hvac-technician", "HVAC / Refrigeration Technician", "فني تكييف وتبريد", TR, "hvac technician|ac technician|air conditioning technician|refrigeration technician|chiller technician|hvac mechanic|hvac installer|فني تكييف|فني تكييف وتبريد|فني تبريد|فني مكيفات|فني تكييف مركزي");
d("trade.plumber", "Plumber", "سبّاك", TR, "plumber|plumbing technician|pipe fitter|pipefitter|plumbing|سباك|فني سباكه|فني تمديدات|عامل سباكه");
d("trade.carpenter", "Carpenter", "نجّار", TR, "carpenter|woodworker|joiner|cabinet maker|furniture maker|نجار|نجار مسلح|نجار اثاث|فني نجاره");
d("trade.welder", "Welder", "لحّام", TR, "welder|welding technician|fabricator|steel fabricator|metal fabricator|لحام|فني لحام|حداد|حداد مسلح|حداد انشائي");
d("trade.painter", "Painter", "دهّان", TR, "painter|house painter|building painter|spray painter|paint technician|دهان|صباغ|فني دهان|دهان مباني");
d("trade.mason", "Mason / Builder", "بنّاء", TR, "mason|bricklayer|builder|tiler|plasterer|steel fixer|bar bender|بناء|مبلط|مبيض|عامل بناء|عامل بلاط");
d("trade.mechanic", "Auto Mechanic", "ميكانيكي سيارات", TR, "mechanic|auto mechanic|car mechanic|vehicle mechanic|automotive technician|auto technician|car technician|automotive mechanic|diesel mechanic|heavy vehicle mechanic|auto electrician|ميكانيكي|فني سيارات|ميكانيكي سيارات|فني ميكانيكا سيارات|كهربائي سيارات");
d("trade.instrument-technician", "Instrumentation Technician", "فني أجهزة دقيقة", TR, "instrument technician|instrumentation technician|control technician|calibration technician|electronics technician|electronic technician|biomedical technician|biomedical engineer technician|فني اجهزه|فني الكترونيات|فني اجهزه دقيقه|فني معايره|فني اجهزه طبيه");
d("trade.machine-operator", "Machine / Production Operator", "مشغّل آلات إنتاج", TR, "machine operator|production operator|plant operator|process operator|cnc operator|press operator|packing machine operator|operator|production worker|factory worker|assembly worker|assembler|packer|production staff|production assistant|production helper|production labor|مشغل الات|مشغل ماكينه|مشغل الات دقيقه|مشغل الات دقيقه ومراقبه|مشغل انتاج|عامل انتاج|عامل مصنع|عامل تعبئه|عامل تغليف|مغلف|معبئ");

// ── خدمات عامة ──
d("svc.cleaner", "Cleaner / General Worker", "عامل نظافة / عامل عام", OT, "cleaner|cleaners|house cleaner|office cleaner|building cleaner|janitor|cleaning staff|cleaning worker|cleaning attendant|room attendant|housekeeper|housekeeping|housekeeping attendant|housekeeping staff|housemaid|عامل نظافه|عامله نظافه|عامل نظافه عام|منظف|منظفه|عاملات نظافه|عامل غرف|عامله غرف|مدبره منزل|مدبره");
d("svc.nanny", "Nanny / Domestic Worker", "مربّية / عاملة منزلية", OT, "nanny|babysitter|baby sitter|childcare worker|child care worker|governess|domestic worker|domestic helper|maid|housemaid domestic|home helper|caregiver|elderly caregiver|home caregiver|private nurse|مربيه|جليسه اطفال|عامله منزليه|خادمه|مرافق كبار سن|مقدم رعايه|جليسه كبار سن|جليسه مسنين|مربيه اطفال");
d("svc.gardener", "Gardener / Landscaper", "بستاني", AG, "gardener|landscaper|landscape worker|landscape technician|farm worker|farmer|farm hand|agricultural worker|greenhouse worker|بستاني|مزارع|عامل زراعي|عامل مزرعه|منسق حدائق|فني حدائق");
d("svc.security-guard", "Security Guard / Officer", "حارس أمن", OT, "security guard|security officer|security|guard|security staff|security man|security personnel|security attendant|gate guard|cctv operator|cctv|surveillance operator|control room operator security|حارس امن|حارس|رجل امن|امن|موظف امن|مراقب كاميرات|مشغل كاميرات مراقبه|حارس بوابه|حارس مبنى");
d("svc.security-supervisor", "Security Supervisor", "مشرف أمن", OT, "security supervisor|security team leader|head of security guards|security shift supervisor|chief security officer guards|مشرف امن|مشرف حراسه|مشرف الامن|مشرف عام على قطاع الامن والسلامه|مشرف حراس");
d("svc.security-manager", "Security Manager", "مدير أمن", OT, "security manager|head of security|security director|chief security officer|cso security|physical security manager|loss prevention manager|loss prevention officer|loss prevention|مدير امن|مدير الامن|رئيس الامن|رئيس قسم الامن|مدير الحراسه|مدير حراسه|ضابط امن|ضابط الامن");

// ── الزراعة ──
d("agri.agricultural-engineer", "Agricultural Engineer / Agronomist", "مهندس زراعي", AG, "agricultural engineer|agronomist|agriculture engineer|agricultural specialist|agricultural consultant|plant protection specialist|horticulturist|مهندس زراعي|اخصائي زراعي|مرشد زراعي|مهندس بساتين|وقايه نبات");
d("agri.veterinarian", "Veterinarian", "طبيب بيطري", AG, "veterinarian|vet|veterinary doctor|veterinary technician|veterinary assistant|vet technician|طبيب بيطري|بيطري|فني بيطري|مساعد بيطري");

// ── السلامة ──
d("hse.officer", "HSE / Safety Officer", "مسؤول سلامة وصحة مهنية", EN, "safety officer|hse officer|hse specialist|ehs specialist|ehs officer|hse engineer|ehse officer|safety engineer|safety specialist|safety inspector|safety coordinator|safety advisor|health and safety officer|health safety environment officer|whs manager|safety environmental officer|fire safety officer|fire safety|fire fighter|firefighter|safety|hse|ehs|مسؤول سلامه|مسؤول السلامه|مسؤول سلامه وصحه مهنيه|اخصائي سلامه|اخصائي السلامه والصحه المهنيه|اخصائي سلامه وصحه مهنيه|مهندس سلامه|مفتش سلامه|ضابط سلامه|منسق سلامه|خبير تنفيذي في ادارة السلامه والصحه المهنيه|سلامه|سلامه مهنيه|اخصائي سلامه وصحه");

// ── تقنية المعلومات ──
d("it.software-developer", "Software Developer / Engineer", "مطوّر برمجيات", IT, "software developer|software engineer|developer|programmer|web developer|front end developer|frontend developer|back end developer|backend developer|full stack developer|fullstack developer|mobile developer|mobile app developer|application developer|java developer|net developer|php developer|python developer|junior web developer|senior web developer|web developer designer|application development and technical service manager|مطور|مطور برمجيات|مطور مواقع|مطور تطبيقات|مبرمج|مهندس برمجيات|مهندس برمجه|مطور ويب|software development|web development");
d("it.data-analyst", "Data Analyst / BI Analyst", "محلل بيانات", IT, "data analyst|bi analyst|business intelligence analyst|bi developer|reporting specialist|data reporting analyst|insights analyst|analytics specialist|data analytics specialist|محلل بيانات|محلل ذكاء اعمال|اخصائي تحليل بيانات|محلل تقارير|reporting analyst|mis analyst|mis officer|mis specialist|mis|mis senior officer");
d("it.data-scientist", "Data Scientist / ML Engineer", "عالم بيانات", IT, "data scientist|machine learning engineer|ml engineer|ai engineer|ai specialist|data engineer|junior data scientist|عالم بيانات|مهندس ذكاء اصطناعي|مهندس بيانات|مهندس تعلم الي");
d("it.business-analyst", "Business / Systems Analyst", "محلل أعمال / نظم", IT, "business analyst|business system analyst|business systems analyst|system analyst|systems analyst|functional analyst|it business analyst|business and data analyst|business system analyst data scientist|senior business analyst|محلل اعمال|محلل نظم|محلل انظمه|محلل اعمال ونظم|business analysis|business analysis specialist|business analytics|business intelligence");
d("it.support", "IT Support Specialist", "أخصائي دعم تقني", IT, "it support|technical support|helpdesk|help desk|it technician|it specialist|it officer|it engineer|it support engineer|it support specialist|it support officer|it support technician|desktop support|it administrator|it analyst|it executive|it coordinator|it assistant|it support analyst|technical support engineer|technical support specialist|technical support officer|technical support agent|computer technician|hardware technician|pc technician|it|information technology|ncr pos support it analyst engineer|ncr aloha pos support|pos support|technical service|product support engineer|فني حاسب الي|فني كمبيوتر|دعم فني|اخصائي دعم فني|اخصائي تقنيه المعلومات|موظف تقنيه المعلومات|مسؤول تقنيه المعلومات|تقنيه المعلومات|مهندس دعم فني|فني دعم فني");
d("it.network-engineer", "Network Engineer", "مهندس شبكات", IT, "network engineer|network administrator|network specialist|network technician|network officer|network analyst|network support|network support engineer|noc engineer|noc technician|مهندس شبكات|مدير شبكات|اخصائي شبكات|فني شبكات");
d("it.system-admin", "System / Cloud Administrator", "مدير أنظمة", IT, "system administrator|systems administrator|sysadmin|sys admin|system engineer|systems engineer|cloud engineer|devops engineer|devops|server administrator|infrastructure engineer|it infrastructure|it infrastructure engineer|database administrator|dba|sap basis|senior systems engineering specialist|مدير انظمه|مسؤول انظمه|مهندس انظمه|اخصائي انظمه|مدير قواعد بيانات|مشرف انظمه");
d("it.security", "Cybersecurity Specialist", "أخصائي أمن سيبراني", IT, "cyber security|cybersecurity|cyber security specialist|cyber security analyst|cyber security engineer|information security|information security specialist|information security analyst|infosec|security analyst|soc analyst|penetration tester|pen tester|اخصائي امن سيبراني|الامن السيبراني|امن سيبراني|امن المعلومات|اخصائي امن معلومات|محلل امن معلومات");
d("it.erp-consultant", "ERP / SAP Consultant", "استشاري أنظمة ERP", IT, "sap consultant|sap mm consultant|sap fico consultant|sap mm junior consultant|sap fico|sap mm|sap sd|sap hr|sap|erp consultant|erp specialist|erp analyst|oracle consultant|oracle erp|dynamics consultant|functional consultant|odoo consultant|odoo developer|استشاري ساب|مستشار ساب|استشاري erp|استشاري انظمه");
d("it.qa-tester", "QA Tester", "مختبر جودة برمجيات", IT, "qa tester|software tester|test engineer|qa analyst|qa specialist|qa automation engineer|software qa|tester|software quality engineer|مختبر برمجيات|اختبار برمجيات|مهندس اختبار");
d("it.ux-designer", "UX / UI Designer", "مصمم تجربة مستخدم", IT, "ux designer|ui designer|ui ux designer|ux ui designer|ux researcher|product designer|ux specialist|ui specialist|web ui designer|مصمم تجربه مستخدم|مصمم واجهات|مصمم واجهه مستخدم");
d("it.product-manager", "Product Manager / Owner", "مدير منتج", IT, "product manager|product owner|product lead|product director|head of product|technical product manager|digital product manager|scrum master|agile coach|مدير منتج|مدير المنتج|مالك المنتج|سكرم ماستر");
d("it.manager", "IT Manager", "مدير تقنية المعلومات", IT, "it manager|it director|head of it|it head|cto|cio|chief technology officer|chief information officer|vp technology|vp it|director of it|director of technology|technology manager|information technology manager|it operations manager|it infrastructure manager|it project manager|it team leader|it supervisor|it lead|it service manager|مدير تقنيه المعلومات|مدير تقنيه|مدير تقنيه معلومات|مدير ادارة تقنيه المعلومات|رئيس تقنيه المعلومات|رئيس قسم تقنيه المعلومات|مدير نظم المعلومات|مدير انظمه المعلومات|مشرف تقنيه المعلومات");

// ── الصحة ──
d("health.physician", "Physician / Doctor", "طبيب", HL, "physician|doctor|general practitioner|gp|medical doctor|specialist physician|consultant physician|resident doctor|medical officer|surgeon|pediatrician|paediatrician|gynecologist|cardiologist|dermatologist|psychiatrist|orthopedic|radiologist|anesthesiologist|طبيب|طبيب عام|طبيب اخصائي|طبيب استشاري|جراح|طبيب اطفال|طبيبه|دكتور طبيب|طبيب مقيم|طبيب امتياز");
d("health.dentist", "Dentist", "طبيب أسنان", HL, "dentist|dental surgeon|dental doctor|orthodontist|dental assistant|dental hygienist|dental technician|dental nurse|طبيب اسنان|طبيبه اسنان|مساعد طبيب اسنان|فني اسنان|مساعده اسنان|اخصائي تقويم|اخصائي اسنان");
d("health.nurse", "Nurse", "ممرض", HL, "nurse|staff nurse|registered nurse|rn|charge nurse|nursing|nursing officer|nursing assistant|nurse assistant|clinical nurse|head nurse|nurse manager|nursing supervisor|nursing director|ممرض|ممرضه|مساعد ممرض|ممرض قانوني|رئيس تمريض|مشرف تمريض|تمريض|مدير تمريض");
d("health.pharmacist", "Pharmacist", "صيدلي", HL, "pharmacist|clinical pharmacist|pharmacy|pharmacy manager|pharmacy supervisor|pharmacy technician|pharmacy assistant|pharmacy internship|assistant pharmacist|صيدلي|صيدليه|صيدلانيه|صيدلاني|مساعد صيدلي|فني صيدليه|مدير صيدليه|مشرف صيدليه|اخصائي صيدله");
d("health.lab-technician", "Lab Technician / Technologist", "فني مختبر", HL, "lab technician|laboratory technician|lab technologist|medical technologist|laboratory technologist|lab specialist|laboratory specialist|lab assistant|laboratory assistant|phlebotomist|medical laboratory|medical lab technician|laboratory analyst|lab analyst|فني مختبر|اخصائي مختبر|فني تحاليل|مساعد مختبر|اخصائي تحاليل|فني مختبرات");
d("health.radiology-technician", "Radiology Technician", "فني أشعة", HL, "radiographer|radiology technician|x ray technician|xray technician|radiology technologist|mri technician|ct technician|ultrasound technician|sonographer|فني اشعه|اخصائي اشعه|اخصائي اشعة|فني اشعة|فني رنين|فني سونار");
d("health.therapist", "Physiotherapist / Therapist", "أخصائي علاج طبيعي", HL, "physiotherapist|physical therapist|physiotherapy|occupational therapist|speech therapist|speech language pathologist|rehabilitation specialist|اخصائي علاج طبيعي|علاج طبيعي|اخصائي علاج وظيفي|اخصائي نطق وتخاطب|اخصائي تخاطب|اخصائي تاهيل");
d("health.paramedic", "Paramedic / EMT", "مسعف", HL, "paramedic|emt|emergency medical technician|ambulance technician|ambulance driver|emergency medical services|first aider|مسعف|فني اسعاف|سائق اسعاف|اسعاف|اخصائي اسعاف");
d("health.patient-services", "Patient Services Coordinator", "منسق خدمات المرضى", HL, "patient relations coordinator|patient services coordinator|patient service coordinator|patient coordinator|patient care coordinator|patient experience coordinator|patient services supervisor|patient service decorator|patient relations officer|patient services officer|patient service officer|patient relations|patient services|patient service|medical coordinator|clinic coordinator|medical office assistant|medical assistant|منسق خدمات مرضى|منسق علاقات مرضى|منسق مرضى|اخصائي خدمات مرضى|مشرف خدمات مرضى|موظف خدمات مرضى|علاقات مرضى|خدمات مرضى|مساعد طبي|مساعد عيادة|منسق عيادة|hospital assistant|clinic assistant|patient educator|patient assistant|ward assistant");
d("health.nutritionist", "Nutritionist / Dietitian", "أخصائي تغذية", HL, "nutritionist|dietitian|dietician|clinical dietitian|clinical nutritionist|nutrition specialist|prepared meals nutritionist|اخصائي تغذيه|اخصائيه تغذيه|اخصائي تغذيه علاجيه|تغذيه علاجيه|خبير تغذيه");
d("health.psychologist", "Psychologist / Counselor", "أخصائي نفسي", HL, "psychologist|clinical psychologist|psychotherapist|counselor|counsellor|psychological counselor|mental health specialist|اخصائي نفسي|اخصائيه نفسيه|مرشد نفسي|معالج نفسي|مرشد طلابي|مرشد اسري");
d("health.public-health", "Public Health Specialist", "أخصائي صحة عامة", HL, "public health specialist|public health officer|public health|health education specialist|health educator|infection control|infection control nurse|infection control specialist|epidemiologist|health inspector|health informatics|health information|medical coder|medical coding|medical records|medical records officer|اخصائي صحه عامه|مثقف صحي|اخصائي مكافحه عدوى|مراقب صحي|ترميز طبي|سجلات طبيه|موظف سجلات طبيه");
d("health.hospital-manager", "Hospital / Healthcare Manager", "مدير مستشفى / منشأة صحية", HL, "hospital manager|hospital administrator|healthcare manager|health care manager|clinic manager|medical director|hospital director|healthcare administrator|medical center manager|health center manager|مدير مستشفى|مدير عيادات|مدير مركز طبي|مدير منشاه صحيه|مدير مجمع طبي|مدير عيادة|مدير مركز صحي|مدير طبي");

// ── الخدمة الاجتماعية ──
d("social.social-worker", "Social Worker", "أخصائي اجتماعي", OT, "social worker|social specialist|social services|social service officer|social work|case worker|caseworker|community worker|اخصائي اجتماعي|اخصائيه اجتماعيه|خدمه اجتماعيه|خدمه اجتماعية|باحث اجتماعي|مرشد اجتماعي|مشرف اجتماعي|خدمه المجتمع");

// ── التعليم ──
d("edu.english-teacher", "English Language Teacher", "معلم لغة إنجليزية", ED, "english teacher|english language teacher|english instructor|english language instructor|esl teacher|efl teacher|ielts instructor|ielts teacher|english lecturer|english tutor|معلم لغه انجليزيه|مدرس لغه انجليزيه|مدرس انجليزي|معلم انجليزي|معلمه لغه انجليزيه|مدرسه لغه انجليزيه|معلم اللغه الانجليزيه|مدرس اللغه الانجليزيه");
d("edu.teacher", "Teacher", "معلم", ED, "teacher|school teacher|primary teacher|secondary teacher|elementary teacher|math teacher|science teacher|arabic teacher|islamic teacher|teaching|teaching staff|teaching staff member|associate teaching staff member|class teacher|homeroom teacher|kindergarten teacher|nursery teacher|preschool teacher|early childhood teacher|special education teacher|instructor|vocational instructor|technical instructor|معلم|معلمه|مدرس|مدرسه|معلم رياض اطفال|معلمه رياض اطفال|معلم تربيه خاصه|معلم صف|مدرس بقسم التقنيه الميكانيكيه|نائب المعلم|مدرس مواد|معلم رياضيات|معلم علوم|معلم لغه عربيه|معلم تربيه اسلاميه|معلم حاسب|tutor|private tutor|personal tutor|home tutor|private home tutor|مدرس خصوصي");
d("edu.lecturer", "Lecturer / Professor", "محاضر / أستاذ جامعي", ED, "lecturer|university lecturer|professor|assistant professor|associate professor|faculty member|college lecturer|college instructor|university instructor|business and sales lecturer|teaching assistant university|محاضر|اشتاذ جامعي|استاذ جامعي|استاذ مساعد|استاذ مشارك|دكتور جامعي|عضو هيئه تدريس جامعي|عضو هيئه تدريس|معيد|مساعد تدريس|محاضر جامعي|محاضر بقسم");
d("edu.principal", "School Principal", "مدير مدرسة", ED, "principal|school principal|head teacher|headmaster|headmistress|school director|school head|school manager|assistant principal|vice principal|deputy principal|nursery manager|kindergarten manager|nursery director|مدير مدرسه|مديره مدرسه|وكيل مدرسه|وكيل المدرسه|مدير حضانه|مديره حضانه|مدير روضه|مديره روضه|رئيس مدرسه|dean|assistant dean|associate dean|dean assistant|academy director|academic director|head of school|عميد|وكيل عميد");
d("edu.teaching-assistant", "Teaching Assistant", "مساعد معلم", ED, "teaching assistant|teacher assistant|teacher aide|classroom assistant|school assistant|nursery assistant|kindergarten assistant|مساعد معلم|مساعده معلمه|مساعد مدرس|مساعد تعليمي|مساعده تعليميه|مربيه حضانه|مربيه روضه");
d("edu.academic-supervisor", "Academic / Educational Supervisor", "مشرف أكاديمي / تربوي", ED, "academic supervisor|educational supervisor|academic coordinator|academic advisor|academic adviser|academic counselor|education supervisor|education coordinator|education specialist|education officer|education consultant|curriculum specialist|curriculum coordinator|curriculum developer|مشرف تربوي|مشرف اكاديمي|مشرف تعليمي|مدير اشراف تعليمي|مرشد اكاديمي|منسق اكاديمي|منسق تعليمي|اخصائي تعليمي|اخصائي مناهج|منسق مناهج|math supervisor|science supervisor|math and science supervisor|subject supervisor|مشرف رياضيات|مشرف علوم");
d("edu.instructional-designer", "Instructional Designer", "مصمم تعليمي", ED, "instructional designer|learning designer|e learning developer|elearning developer|e learning designer|elearning designer|content developer education|course designer|course developer|training designer|مصمم تعليمي|مصممه تعليميه|مصمم مناهج|مطور مناهج|مطور محتوى تعليمي|مصمم دورات|مطور دورات");
d("edu.student-affairs", "Student Affairs / Admissions Officer", "مسؤول شؤون الطلاب والقبول", ED, "student affairs officer|student affairs supervisor|student affair|students affairs officer|students affairs supervisor|students affair|admission officer|registration officer|enrollment specialist|enrollment officer|admission and registration officer|registrar|scholarship coordinator|scholarship specialist|students careers and placement officer|student services|مسؤول شؤون طلاب|مسؤول القبول والتسجيل|مسؤول قبول وتسجيل|موظف شؤون طلاب");

// ── اللياقة والرياضة ──
d("fit.fitness-trainer", "Fitness / Sports Trainer", "مدرب لياقة / رياضة", OT, "fitness trainer|personal trainer|gym trainer|gym instructor|fitness instructor|fitness coach|sports coach|coach|swimming coach|swimming instructor|football coach|yoga instructor|yoga teacher|pilates instructor|crossfit coach|lifeguard|sports trainer|athletic trainer|physical education teacher|pe teacher|gym manager|fitness manager|مدرب لياقه بدنيه|مدرب لياقه|مدرب رياضي|مدرب سباحه|مدرب كره قدم|مدرب شخصي|مدرب يوغا|مدرب جيم|منقذ سباحه|مدرب تربيه بدنيه|معلم تربيه بدنيه|مدرب فريق رياضي|مدير نادي رياضي|مدير جيم");

// ── القانون ──
d("law.lawyer", "Lawyer / Attorney", "محامي", LW, "lawyer|attorney|advocate|trial lawyer|litigation lawyer|corporate lawyer|barrister|solicitor|litigator|litigation specialist|trial attorney|محامي|محاميه|محامي مرافعات|محامي شركات|محامي متدرب|مرافع|وكيل شرعي|محامي ومستشار قانوني");
d("law.legal-advisor", "Legal Advisor / Counsel", "مستشار قانوني", LW, "legal advisor|legal adviser|legal counsel|legal consultant|legal officer|legal specialist|legal manager|legal director|head of legal|general counsel|in house counsel|legal affairs|legal affairs specialist|legal affairs manager|legal affairs officer|legal|legal analyst|legal executive|legal coordinator|corporate counsel|مستشار قانوني|مستشاره قانونيه|اخصائي قانوني|مدير ادارة قانونيه|مدير الشؤون القانونيه|رئيس الشؤون القانونيه|مسؤول قانوني|مسؤول الشؤون القانونيه|شؤون قانونيه|اداره قانونيه|قانوني|مستشار قضائي|رئيس الادارة القانونيه");
d("law.paralegal", "Paralegal / Legal Assistant", "مساعد قانوني", LW, "paralegal|legal assistant|legal secretary|legal researcher|legal clerk|legal intern|law clerk|notary|notary public|legal assistant paralegal|مساعد قانوني|باحث قانوني|كاتب عدل|سكرتير قانوني|موثق|موثق عقود|اخصائي توثيق|مساعد محامي|كاتب محامي");

// ── العقارات ──
d("re.real-estate-agent", "Real Estate Agent / Consultant", "مستشار عقاري", SM, "real estate agent|real estate consultant|real estate broker|real estate advisor|real estate sales|real estate specialist|real estate officer|real estate executive|real estate representative|real estate marketer|property consultant|property advisor|property agent|property sales|property specialist|property executive|leasing consultant|leasing officer|leasing agent|leasing specialist|leasing executive|leasing coordinator|realtor|real estate|مستشار عقاري|وسيط عقاري|وكيل عقاري|مسوق عقاري|اخصائي عقار|اخصائي عقاري|موظف عقار|مسؤول عقار|بيع وشراء في العقار|بيع وشراء عقار|مندوب عقاري|مندوب عقارات|عقار|عقارات|مسؤول تاجير|موظف تاجير|مستشار تاجير");
d("re.property-manager", "Property Manager", "مدير أملاك", AD, "property manager|property management|property management officer|property management specialist|property management coordinator|property administrator|real estate manager|real estate property manager|real estate director|asset manager real estate|estate manager|building manager|tower manager|مدير املاك|مدير عقارات|مدير ممتلكات|مدير املاك عقاريه|مدير مبنى|مدير برج|مسؤول املاك|اخصائي ادارة املاك|مدير ادارة املاك|ادارة املاك");

// ── مهن أخرى ──
d("oth.religious", "Imam / Muezzin", "إمام / مؤذن", OT, "imam|muezzin|mosque imam|imam of mosque|religious scholar|religious preacher|preacher|islamic preacher|إمام|امام|مؤذن|امام مسجد|امام وخطيب|خطيب|داعيه|مرشد ديني|واعظ");
d("oth.tailor", "Tailor / Seamstress", "خيّاط", BT, "tailor|seamstress|dressmaker|garment worker|sewing machine operator|sewing operator|alteration tailor|fashion designer|garment technician|pattern maker|fashion stylist|stylist fashion|خياط|خياطه|مصمم ازياء|مصممه ازياء|مصمم ملابس|مصممه ملابس|خياط رجالي|خياط نسائي");
d("oth.dj", "Disc Jockey (DJ)", "دي جي", OT, "dj|disc jockey|disk jockey|دي جي");

// ── التجميل والعناية ──
d("beauty.hairdresser", "Barber / Hairdresser", "حلّاق / مصفّف شعر", BT, "barber|hairdresser|hair stylist|hairstylist|hair dresser|coiffeur|hair colorist|colorist|salon manager|salon owner|hair salon|barbershop|حلاق|مصفف شعر|مصففه شعر|كوافير|كوافيره|مدير صالون|صالون حلاقه|صالون تجميل|مصفف");
d("beauty.beautician", "Beautician / Makeup Artist", "أخصائي تجميل", BT, "beautician|makeup artist|make up artist|beauty therapist|skin care specialist|skincare specialist|esthetician|aesthetician|nail technician|nail artist|manicurist|pedicurist|beauty specialist|beauty consultant|beauty expert|lash technician|brow artist|henna artist|اخصائي تجميل|اخصائيه تجميل|خبير تجميل|خبيره تجميل|مكياج|ميك اب ارتست|خبيره مكياج|فنيه اظافر|فنيه تجميل|خبيره عنايه بالبشره|اخصائيه بشره");
d("beauty.massage-therapist", "Massage / Spa Therapist", "معالج تدليك وسبا", BT, "massage therapist|spa therapist|massage|masseur|masseuse|spa attendant|spa manager|spa supervisor|spa receptionist|spa specialist|wellness therapist|wellness specialist|reflexologist|مدلك|مدلكه|معالج تدليك|اخصائي سبا|اخصائيه سبا|مدير سبا|مشرف سبا|اخصائي مساج|مساج|معالجه سبا");

// ── العلوم والأبحاث ──
d("sci.researcher", "Researcher / Scientist", "باحث / عالم", OT, "researcher|research assistant|research associate|research specialist|research officer|research and development officer|r d officer|research scientist|scientist|chemist|biochemist|laboratory scientist|researcher assistant|research technical assistant|dairy technologist|food technologist|باحث|باحثه|كيميائي|عالم|اخصائي ابحاث|مساعد باحث");

/* ═════════════ الأُسَر: مجالٌ × مرتبة ═════════════
 * لكل مجال وظيفي عامّ ثلاث مراتب: أخصائي (staff) / مشرف (sup) / مدير (mgr). تُولَّد منها المهن التي لا نكتب لها
 * عباراتٍ صريحة (مثل «مشرف موارد بشرية») فلا نكتب مئات العبارات بالأيدي. ترتيب الاستعمال في المصنِّف:
 *  ١) عبارةٌ صريحة بطول ≥٢ (أو تغطّي المسمّى كله) ← ٢) أسرةٌ + كلمة مرتبة ← ٣) العبارة بترتيب كلماتٍ مختلف
 *  ٤) عبارةٌ صريحة مفردة داخل كلامٍ أطول (ثقة منخفضة) ← ٥) أسرةٌ بلا كلمة مرتبة (منخفضة، وإلا noBare).
 * مرتبةٌ ناقصة في أسرة: المشرف يرجع إلى المدير، والمدير إلى المشرف ثم الأخصائي بمستوى head/lead.
 * نهاية الدومين بـ«~» تعني مجالاً ضعيفاً لا يُعتدّ به إن وُجد مجالٌ آخر.
 */
const FAMILIES = [];
const fam = (key, sector, domains, tiers, opts) => {
  const f = { key, sector, domains: domains.split("|"), tiers: {}, extra: (opts && opts.extra) || {}, noBare: !!(opts && opts.noBare), generic: !!(opts && opts.generic) };
  const NAME = { staff: "specialist", sup: "supervisor", mgr: "manager" };
  for (const t of ["staff", "sup", "mgr"]) {
    const v = tiers[t];
    if (!v) continue;
    if (typeof v === "string") f.tiers[t] = v;
    else { const id = `${key}.${NAME[t]}`; d(id, v[0], v[1], sector, ""); OCC[OCC.length - 1].gen = true; f.tiers[t] = id; }
  }
  FAMILIES.push(f);
};
fam("recruit", HR, "recruitment|talent acquisition|توظيف|استقطاب", { staff: "hr.recruiter", mgr: "hr.recruitment-manager" });
fam("payroll", HR, "payroll|compensation|benefits|c b|رواتب|تعويضات", { staff: "hr.compensation", mgr: "hr.compensation-manager" });
fam("training", HR, "training|learning and development|l d|تدريب|تعلم وتطوير", { staff: "hr.trainer", mgr: "hr.training-manager" }, { noBare: true });
fam("hr", HR, "hr|human resource|human recourse|موارد بشريه|شؤون موظفين|talent management|onboarding|employee relation|people operation|personnel|organizational development|organization development|performance management|professional development|career development|career management|workforce|od", { staff: ["HR Specialist / Officer", "أخصائي موارد بشرية"], sup: ["HR Supervisor", "مشرف موارد بشرية"], mgr: ["HR Manager", "مدير موارد بشرية"] });
fam("audit", FI, "audit|auditing|تدقيق|مراجعه", { staff: "fin.auditor", mgr: "fin.audit-manager" });
fam("fin", FI, "finance|financial|accounting|accounts|general ledger|ledger|budget|budgeting|reconciliation|مالي|ماليه|محاسبه|حسابات|ميزانيه", { staff: "fin.accountant", sup: "fin.accounting-supervisor", mgr: "fin.finance-manager" });
fam("bd", SM, "business development|business developer|تطوير الاعمال|تطوير اعمال", { staff: "sales.business-development-specialist", mgr: "sales.business-development-manager" });
fam("ecom", SM, "ecommerce|تجاره الكترونيه", { staff: "sales.e-commerce-specialist", mgr: "sales.e-commerce-manager" });
fam("sales", SM, "sales|commercial|مبيعات|تجاري|تجاريه", { staff: "sales.sales-executive", sup: ["Sales Supervisor", "مشرف مبيعات"], mgr: ["Sales Manager", "مدير مبيعات"] });
fam("digital", SM, "digital marketing|تسويق رقمي|تسويق الكتروني|e marketing|digital media|digital channels", { staff: "mkt.digital-marketing-specialist", mgr: "mkt.digital-marketing-manager" });
fam("social", SM, "social media|سوشيال ميديا|وسائل التواصل الاجتماعي|التواصل الاجتماعي", { staff: ["Social Media Specialist", "أخصائي وسائل التواصل الاجتماعي"], mgr: ["Social Media Manager", "مدير وسائل التواصل الاجتماعي"] });
fam("pr", SM, "public relation|pr|علاقات عامه", { staff: ["Public Relations Officer / Specialist", "أخصائي علاقات عامة"], sup: ["Public Relations Supervisor", "مشرف علاقات عامة"], mgr: ["Public Relations Manager", "مدير علاقات عامة"] });
fam("comm", SM, "communication|corporate communication|media|اتصالات|اتصال|تواصل مؤسسي|اعلام|اعلامي", { staff: ["Communications Specialist", "أخصائي اتصال"], mgr: ["Communications Manager", "مدير اتصال"] });
fam("marketing", SM, "marketing|marketer|تسويق|مسوق|ماركتر|ماركتنج", { staff: ["Marketing Specialist", "أخصائي تسويق"], sup: ["Marketing Supervisor", "مشرف تسويق"], mgr: ["Marketing Manager", "مدير تسويق"] });
fam("events", H, "event|فعاليات|مناسبات", { staff: "hosp.event-planner", mgr: "hosp.event-manager" }, { noBare: true });
fam("cs", AD, "customer service|customer care|customer support|customer experience|customer relation|customer success|customer satisfaction|customer|client service|client relation|client care|client|crm|callcenter|call center|call centre|contact center|contact centre|enquiry|inquiry|خدمه عملاء|خدمه العملاء|خدمات عملاء|خدمات العملاء|تجربه العملاء|تجارب عملاء|رعايه العملاء|عنايه بالعملاء|رعايه بالعملاء|دعم العملاء|مركز اتصال|علاقات العملاء", { staff: "cs.representative", sup: "cs.supervisor", mgr: "cs.manager" });
fam("admin", AD, "administrative|administration|admin|اداري|اداريه|شؤون اداريه", { staff: "adm.administrative-assistant", sup: "adm.admin-supervisor", mgr: "adm.admin-manager" }, { generic: true });
fam("ops", AD, "operation|operational|عمليات|تشغيل", { staff: ["Operations Specialist / Officer", "أخصائي عمليات"], sup: ["Operations Supervisor", "مشرف عمليات"], mgr: ["Operations Manager", "مدير عمليات"] }, { generic: true });
fam("branch", AD, "branch|فرع|فروع", { sup: "ops.branch-supervisor", mgr: "ops.branch-manager" }, { noBare: true });
fam("store", SM, "store|shop|showroom|retail|متجر|معرض|محل|تجزئه", { staff: "sales.retail-sales-associate", sup: "ret.store-supervisor", mgr: "ret.store-manager" }, { noBare: true });
fam("facility", AD, "facility|facility management|soft service|hard service|fm|مرافق", { staff: ["Facilities Specialist / Coordinator", "أخصائي مرافق"], sup: ["Facilities Supervisor", "مشرف مرافق"], mgr: ["Facilities Manager", "مدير مرافق"] });
fam("quality", EN, "quality|accreditation|validation|assurance|inspector|inspection|جوده|اعتماد", { staff: ["Quality Specialist / Officer", "أخصائي جودة"], sup: ["Quality Supervisor", "مشرف جودة"], mgr: ["Quality Manager", "مدير جودة"] }, { generic: true });
fam("hse", EN, "hse|ehs|qhse|safety|health and safety|سلامه", { staff: "hse.officer", sup: ["HSE Supervisor", "مشرف سلامة"], mgr: ["HSE Manager", "مدير سلامة وصحة مهنية"] });
fam("security", OT, "security|امن|حراسه", { staff: "svc.security-guard", sup: "svc.security-supervisor", mgr: "svc.security-manager" }, { noBare: true });
fam("legal", LW, "legal|قانوني|قانونيه|شؤون قانونيه", { staff: "law.legal-advisor", mgr: "law.legal-advisor" });
fam("realestate", SM, "real estate|property|عقار|عقارات|املاك", { staff: "re.real-estate-agent", mgr: "re.property-manager" }, { noBare: true });
fam("it", IT, "it|information technology|service desk|تقنيه المعلومات|تقنيه|technology", { staff: "it.support", mgr: "it.manager" }, { noBare: true });
fam("scm", LG, "supply chain|supply|سلسله الامداد|سلسله التوريد|سلاسل الامداد|سلاسل التوريد|امداد", { staff: ["Supply Chain Specialist", "أخصائي سلسلة إمداد"], sup: ["Supply Chain Supervisor", "مشرف سلسلة إمداد"], mgr: ["Supply Chain Manager", "مدير سلسلة الإمداد"] });
fam("logistics", LG, "logistic|control tower|لوجستيك|لوجيستيك|لوجستيات|لوجستي|الخدمات اللوجستيه", { staff: ["Logistics Specialist / Coordinator", "أخصائي لوجستيات"], sup: ["Logistics Supervisor", "مشرف لوجستيات"], mgr: ["Logistics Manager", "مدير لوجستيات"] });
fam("procurement", LG, "procurement|purchasing|purchase|sourcing|buyer|مشتريات|توريدات|شراء", { staff: ["Procurement Specialist / Officer", "أخصائي مشتريات"], sup: ["Procurement Supervisor", "مشرف مشتريات"], mgr: ["Procurement Manager", "مدير مشتريات"] });
fam("warehouse", LG, "warehouse|warehousing|wms|storekeeper|store keeper|مستودع|مستودعات|مخزن|مخازن|امين مستودع", { staff: ["Storekeeper / Warehouse Specialist", "أمين مستودع"], sup: ["Warehouse Supervisor", "مشرف مستودعات"], mgr: ["Warehouse Manager", "مدير مستودعات"] });
fam("inventory", LG, "inventory|stock|material|materials|مخزون|جرد|مواد", { staff: "scm.inventory-controller" });
fam("transport", LG, "transport|transportation|fleet|نقل|اسطول", { staff: ["Transport Coordinator", "منسق نقل"], mgr: ["Transport Manager", "مدير نقل"] });
fam("planning", LG, "planning|planner|mrp|s op|تخطيط", { staff: "scm.planner", sup: ["Planning Supervisor", "مشرف تخطيط"], mgr: ["Planning Manager", "مدير تخطيط"] }, { generic: true });
fam("customs", LG, "customs|جمارك|تخليص جمركي", { staff: "scm.customs-clearance" });
fam("dispatch", LG, "dispatch|distribution|توزيع", { staff: "log.dispatcher" }, { noBare: true });
fam("contracts", LG, "contract|contracting|عقود|تعاقد", { staff: "scm.contracts" });
fam("construction", CN, "construction|site|civil|انشاءات|موقع", { staff: ["Construction Coordinator", "منسق إنشاءات"], sup: ["Construction / Site Supervisor", "مشرف موقع / إنشاءات"], mgr: ["Construction / Site Manager", "مدير موقع / إنشاءات"] }, { noBare: true });
fam("projectctrl", CN, "project control|pmo|مراقبه المشاريع|planning and control", { staff: "eng.planning-engineer", mgr: ["Project Controls / PMO Manager", "مدير مراقبة المشاريع / PMO"] });
fam("project", CN, "project|program|programme|implementation|مشروع|مشاريع|برنامج", { staff: ["Project Coordinator", "منسق مشاريع"], sup: ["Project Supervisor", "مشرف مشاريع"], mgr: ["Project Manager", "مدير مشاريع"] }, { extra: { mgr: "project management|project management professional|pmp|project lead|ادارة المشاريع|ادارة مشاريع|مدير تطوير المشاريع" } });
fam("maintenance", TR, "maintenance|صيانه", { staff: "trade.maintenance-technician", sup: ["Maintenance Supervisor", "مشرف صيانة"], mgr: ["Maintenance Manager", "مدير صيانة"] });
fam("production", TR, "production|manufacturing|plant|factory|انتاج|تصنيع|مصنع", { staff: ["Production Specialist / Officer", "أخصائي إنتاج"], sup: ["Production Supervisor", "مشرف إنتاج"], mgr: ["Production Manager", "مدير إنتاج"] }, { noBare: true });
fam("engineering", EN, "engineering|هندسه", { staff: "eng.general-engineer", mgr: "eng.engineering-manager" }, { noBare: true, generic: true });
fam("frontoffice", H, "front office|front desk|reception|استقبال|مكتب امامي", { staff: "adm.receptionist", sup: "hosp.front-office-supervisor", mgr: "hosp.front-office-manager" });
fam("guest", H, "guest relation|guest service|guest experience|علاقات الضيوف", { staff: "hosp.guest-relations", sup: "hosp.front-office-supervisor", mgr: "hosp.front-office-manager" });
fam("reservations", H, "reservation|حجوزات", { staff: "hosp.reservations", sup: "hosp.reservations-manager", mgr: "hosp.reservations-manager" });
fam("housekeeping", H, "housekeeping|تدبير|تدبير فندقي", { staff: "svc.cleaner", sup: "hosp.housekeeping-supervisor", mgr: "hosp.housekeeping-manager" });
fam("kitchen", H, "kitchen|مطبخ", { staff: "hosp.kitchen-helper", sup: "hosp.kitchen-supervisor", mgr: "hosp.kitchen-manager" }, { noBare: true });
fam("fb", H, "f b|fnb|food beverage|طعام وشراب|اغذيه ومشروبات|اغذيه والمشروبات", { staff: "hosp.waiter", sup: "hosp.restaurant-supervisor", mgr: "hosp.fb-manager" }, { noBare: true });
fam("restaurant", H, "restaurant|مطعم|مطاعم|cafe|كافيه|مقهي", { sup: "hosp.restaurant-supervisor", mgr: "hosp.restaurant-manager" }, { noBare: true });
fam("catering", H, "catering|تموين|تقديم الطعام|ضيافه", { sup: "hosp.catering-supervisor", mgr: "hosp.catering-manager" }, { noBare: true });
fam("bar", H, "bar|بار", { staff: "hosp.bartender", sup: "hosp.head-bartender", mgr: "hosp.bar-manager" }, { noBare: true });
fam("hotel", H, "hotel|فندق|فنادق|resort", { mgr: "hosp.hotel-manager" }, { noBare: true });
fam("product", SM, "product|منتج|منتجات", { staff: ["Product Specialist", "أخصائي منتج"], mgr: "it.product-manager" }, { noBare: true });
fam("performance", AD, "performance|اداء", { staff: ["Performance Analyst / Specialist", "محلل أداء"] }, { noBare: true });
fam("invest", FI, "investment|investments|استثمار", { staff: "fin.investment-analyst", mgr: "fin.investment-analyst" }, { noBare: true });
fam("revenue", FI, "revenue|ايرادات", { staff: "fin.cost-controller", mgr: "fin.cost-controller" }, { noBare: true });
fam("airport", HT, "ground services|ground handling|baggage|passenger handling|terminal|gateway|cargo|ramp|airport|مطار|خدمات ارضيه", { staff: "tour.airport-agent", sup: "tour.airport-agent", mgr: "tour.airport-agent" });
// عباراتٌ إضافية على مهنٍ وُلِّدت من الأُسَر
const xa = (id, list) => OCC.find((o) => o.id === id).aliases.push(...String(list).split("|").filter(Boolean));
xa("procurement.specialist", "procurement engineer|purchaser|purchaser engineer");

/* ═════════════ التطبيع ═════════════ */
const AR_CH = /[\u0600-\u06FF]/;
const isArTok = (t) => AR_CH.test(t);

// عيبُ استخراج PDF: «لا» تنقلب «ال» (عمالء، عالقات، إعالم). تُصحَّح الكلمات الشائعة منها.
const AR_ARTIFACTS = [[/عمالء/g, "عملاء"], [/عالقات/g, "علاقات"], [/إعالم|اعالم/g, "اعلام"], [/ا\u0644عمالء/g, "العملاء"]];
function foldChars(s) {
  let x = String(s == null ? "" : s);
  for (const [re, to] of AR_ARTIFACTS) x = x.replace(re, to);
  return x.normalize("NFKC").toLowerCase()
    .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06F0))
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[ؤئء]/g, "")
    .replace(/ک/g, "ك").replace(/[یې]/g, "ي").replace(/ڤ/g, "ف").replace(/پ/g, "ب").replace(/چ/g, "ج").replace(/گ/g, "ك")
    .replace(/['’‘`´]/g, "");
}

const ABBR = {
  mgr: "manager", mngr: "manager", mgrs: "manager", dir: "director", asst: "assistant", snr: "senior", sr: "senior", jr: "junior",
  exec: "executive", rep: "representative", reps: "representative", engr: "engineer", coord: "coordinator", ops: "operations",
  mkt: "marketing", supv: "supervisor", supt: "supervisor", dept: "department", sec: "secretary", acct: "accountant",
};
const EN_STOP = new Set(["and", "the", "of", "for", "in", "to", "a", "an", "at", "with", "on", "by", "as", "from", "department", "also", "cum"]);
const AR_STOP = new Set(["و", "في", "من", "على", "الي", "عن", "ب", "ل"]);
// ما يُهمَل من الكلام: الحالة المؤقتة وما ليس من المهنة.
const NOISE = new Set(["acting", "temporary", "interim", "former", "previous", "current", "currently", "سابقا", "حاليا", "بالنيابه", "بالانابه", "موقت", "بالنياب", "بالاناب"]);
const ORDINAL = /^(?:\d+(?:st|nd|rd|th)?|i|ii|iii|iv)$/;
// أخطاء إملائية شائعة في السير (من القاعدة نفسها): تُصحَّح قبل التصريف.
const TYPOS = {
  costumer: "customer", custumer: "customer", costomer: "customer", customar: "customer", manger: "manager", mangaer: "manager", managar: "manager", mnager: "manager",
  manageer: "manager", relatshioship: "relationship", relationshp: "relationship", chashier: "cashier", casher: "cashier", cacher: "cashier", cashir: "cashier", capitan: "captain",
  chif: "chef", gust: "guest", bussiness: "business", buisness: "business", businness: "business", marketting: "marketing", marketng: "marketing", acountant: "accountant",
  accoutant: "accountant", accountat: "accountant", resturant: "restaurant", restuarant: "restaurant", restaraunt: "restaurant", resturent: "restaurant", waitor: "waiter",
  waitre: "waiter", waiterr: "waiter", sceretary: "secretary", secetary: "secretary", reciptionist: "receptionist", receptionnist: "receptionist", recepcionist: "receptionist",
  enginer: "engineer", enginner: "engineer", engeneer: "engineer", suppervisor: "supervisor", supervisior: "supervisor", superviser: "supervisor", supervisr: "supervisor",
  logistcs: "logistics", logisitcs: "logistics", logestics: "logistics", proccurement: "procurement", procurment: "procurement", purchsing: "purchasing", prchasing: "purchasing",
  adminstrator: "administrator", adminstration: "administration", administation: "administration", adminitstation: "administration", coordinater: "coordinator", cordinator: "coordinator",
  coordinatior: "coordinator", speciallist: "specialist", specalist: "specialist", sepcialist: "specialist", officier: "officer", offcer: "officer", assitant: "assistant",
  assisstant: "assistant", assistent: "assistant", asistant: "assistant", ofiicer: "officer", sales: "sales", sale: "sales", saleman: "salesman", saleswoman: "saleswoman",
  hostes: "hostess", baristas: "barista", barrista: "barista", bartneder: "bartender", bertender: "bartender", cheff: "chef", chiff: "chef", pasrty: "pastry", pastery: "pastry",
  accounting: "accounting", acounting: "accounting", accouting: "accounting", finanical: "financial", finacial: "financial", fiancial: "financial", anlayst: "analyst", analyts: "analyst",
  devloper: "developer", waiteress: "waitress", waitres: "waitress", restauran: "restaurant", wearhouse: "warehouse", markerng: "marketing", markitng: "marketing", oppration: "operation", opreation: "operation", saftey: "safety", interprter: "interpreter", translater: "translator", servise: "service", exucitive: "executive", salles: "sales",  developper: "developer", programer: "programmer", technican: "technician", techician: "technician", techinician: "technician",
};
const EN_NOSTEM = new Set(["accounts", "news", "series", "plus", "gas", "bus", "tennis", "chassis"]);

function stemEn(t) {
  if (t.length <= 3 || EN_NOSTEM.has(t)) return t;
  if (t.endsWith("ies") && t.length > 4) return t.slice(0, -3) + "y";
  if (/(?:sses|shes|ches|xes|zes)$/.test(t)) return t.slice(0, -2);
  if (t.endsWith("s") && !/(?:ss|us|is)$/.test(t)) return t.slice(0, -1);
  return t;
}
function stemAr(t) {
  if (t.length > 5 && /^[بكف]ال/.test(t)) t = t.slice(1); // بالعملاء ← العملاء
  if (t.startsWith("ال") && t.length > 4) t = t.slice(2);
  if (t.endsWith("ه") && t.length > 3) t = t.slice(0, -1);
  else if ((t.endsWith("ين") || t.endsWith("ون")) && t.length > 5) t = t.slice(0, -2);
  return t;
}
function stemTok(t) {
  if (isArTok(t)) return stemAr(t);
  if (ABBR[t]) t = ABBR[t];
  return stemEn(t);
}

// كلمات تبدأ بواوٍ أصلية (ليست حرف عطف) فلا تُفكّ: وكيل، وسيط، وزير، وظيفه...
const WAW_WORDS = new Set("وكيل وكيله وسيط وسيطه وزير وزاره وظيفه وظائف وجبه وجبات وحده وحدات وسائل وسيله وقود وثائق وثيقه وصف ورشه وطن وطني وصي وكاله واجهه وردي ورديه وفد وسط ولي وقت وضع وارد واردات واحد وصول وعي ورد وافد وافده وصيف وزن ويتر ويترس واتر".split(" "));
function tokenize(raw) {
  let s = foldChars(raw);
  s = s.replace(/\bco[\s-]?op\b/g, "coop").replace(/\bco[\s-]?ordinat/g, "coordinat").replace(/\be[\s-]commerce/g, "ecommerce").replace(/&/g, " and ");
  const out = [];
  out.fixed = false;
  for (let t of s.split(/[^a-z0-9\u0600-\u06FF]+/)) {
    if (!t) continue;
    if (isArTok(t)) {
      if (AR_STOP.has(t)) continue;
      if (t.length > 3 && t.startsWith("و") && !WAW_WORDS.has(t) && !WAW_WORDS.has(stemAr(t))) t = t.slice(1);
      if (AR_STOP.has(t)) continue;
      t = stemAr(t);
    } else {
      if (TYPOS[t]) { t = TYPOS[t]; out.fixed = true; }
      if (ABBR[t]) t = ABBR[t];
      if (EN_STOP.has(t) || NOISE.has(t)) continue;
      t = stemEn(t);
      if (EN_STOP.has(t)) continue;
      { const f = fuzzy(t); if (f !== t) { t = f; out.fixed = true; } }
    }
    if (NOISE.has(t)) continue;
    out.push(t);
  }
  // «head of X» / «manager of X» ← «X head» / «X manager» (الرأس الإنجليزي في الآخر)
  const HEADS = new Set(["head", "manager", "director", "supervisor", "lead", "chief"]);
  // الرأس يسبقه معدِّلاتُ رتبةٍ فقط («group head of finance»)، لا اسمٌ («outlet manager of saudi arabia» تبقى كما هي).
  const PRE = new Set(["senior", "junior", "assistant", "deputy", "group", "regional", "area", "associate", "executive", "chief", "general", "global", "national", "country"]);
  const hi = out.findIndex((w, i) => HEADS.has(w) && i < out.length - 1 && !isArTok(w) && out.slice(0, i).every((x) => PRE.has(x)));
  // لا نُعيد الترتيب إلا إذا كان «of» قد حُذف فعلاً بين الرأس وما بعده في النص الأصلي
  if (hi >= 0 && new RegExp("\\b" + out[hi] + "s?\\s+of\\s+", "").test(s)) {
    const r = [...out.slice(0, hi), ...out.slice(hi + 1), out[hi]]; r.fixed = out.fixed; return r;
  }
  return out;
}
// تخلّص من الأرقام الترتيبية الجانبية («commis 1»، «commi ii»)
function dropOrdinals(toks) {
  if (toks.length < 2) return toks;
  const r = toks.filter((t) => !ORDINAL.test(t));
  if (!r.length) return toks;
  r.fixed = toks.fixed;
  return r;
}

/* ═════════════ كلمات المراتب والمستوى ═════════════ */
const wset = (s) => new Set(String(s).split("|").map((w) => stemTok(foldChars(w))).filter(Boolean));
const MGR_STRONG = wset("manager|director|vp|president|gm|مدير|مديره|مدراء|مديرين");
const SUP_WORDS = wset("supervisor|leader|lead|incharge|charge|foreman|مشرف|مشرفه|قائد|فريق");
const MGR_WEAK = wset("head|chief|رئيس|نائب");
const STAFF_WORDS = wset("specialist|officer|executive|coordinator|assistant|clerk|representative|agent|associate|administrator|advisor|adviser|consultant|expert|professional|employee|staff|member|analyst|اخصائي|مسؤول|مسئول|موظف|منسق|ضابط|خبير|مختص|مساعد|استشاري|محلل|كاتب|ممثل|مندوب");
const PURE_TIER = new Set([...MGR_STRONG, ...SUP_WORDS, ...MGR_WEAK]);
const GENERIC = new Set([...MGR_STRONG, ...SUP_WORDS, ...MGR_WEAK, ...STAFF_WORDS,
  ...wset("team|senior|junior|general|deputy|assistant|worker|operator|labor|laborer|technician|freelance|freelancer|consulting|consultant|مستقل|عامل|فني|عام|اول|كبير|مبتدي|جديد|اداره|قسم|شعبه|وحده|قطاع|مدير|رئيس")]);
const LEVEL_OF = (() => {
  const m = new Map();
  for (const w of wset("senior|كبير|اول")) m.set(w, "senior");
  for (const w of wset("junior|مبتدي")) m.set(w, "junior");
  for (const w of wset("assistant|deputy|مساعد|نائب|مساعده")) m.set(w, "assistant");
  m.set("lead", "lead");
  return m;
})();
const TRAINEE = wset("trainee|intern|internship|coop|cooperative|apprentice|متدرب|متدربه|تدريب صيفي");
const NOJOB = wset("student|graduate|fresh|graduated|newly|volunteer|متطوع|خريج|خريجه|طالب|طالبه|تخرج|حديث|seeker|job|باحث|عمل|جديد|عن|مذكور|محدد|يوجد|لا|غير|none|unknown|n|a|na|بدون|مسمي|سابق");
const STUDENT = wset("student|students|طالب|طالبه");
const TRAINING_FIRST = new Set([stemTok("training"), stemTok("تدريب")]);

/* ═════════════ الفهرس ═════════════ */
const BY_ID = new Map();
const ALIAS = new Map();    // "tok tok" ← { id }
const CONFLICTS = [];
let MAX_LEN = 1;
function addAlias(phrase, id) {
  const toks = dropOrdinals(tokenizeRaw(phrase));
  if (!toks.length) return;
  // «manager» وحدها (أو ما صار كذلك بعد حذف الكلمات الجانبية) ليست مهنة — تُترك للمسمّى العامّ.
  if (toks.every((t) => PURE_TIER.has(t))) return;
  const key = toks.join(" ");
  const prev = ALIAS.get(key);
  if (prev && prev !== id) { CONFLICTS.push({ alias: key, kept: prev, dropped: id }); return; }
  ALIAS.set(key, id);
  if (toks.length > MAX_LEN) MAX_LEN = toks.length;
  if (toks.length >= 2 && toks.length <= 4) {
    const sk = [...toks].sort().join(" ");
    const sp = SORTED.get(sk);
    SORTED.set(sk, sp === undefined || sp === id ? id : null);
  }
}
// الفهرسة تتمّ قبل بناء VOCAB، فلا تُفكّ «و» داخل العبارات المُعرَّفة (تُكتب منفصلة أصلاً)
const tokenizeRaw = tokenize;
// تصحيح الخطأ الإملائي بمسافة تحرير واحدة (حرفٌ زائد/ناقص/مبدَّل/مقلوب) على المفردات الإنجليزية المعروفة فقط،
// وللكلمات الطويلة (≥٦) كي لا تُصحَّح أسماءُ الجهات إلى مسمّيات. لا يصحّح إن تعدّد المرشّح.
let EN_VOCAB = null;
const BY_FIRST = new Map();
function dl1(a, b) {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0; while (i < la && i < lb && a[i] === b[i]) i++;
  if (la === lb) {
    if (i === la) return true;
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    return i + 1 < la && a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  return la > lb ? a.slice(i + 1) === b.slice(i) : b.slice(i + 1) === a.slice(i);
}
function fuzzy(t) {
  if (!EN_VOCAB || t.length < 6 || EN_VOCAB.has(t) || !/^[a-z]+$/.test(t)) return t;
  let hit = null;
  for (const c of EN_VOCAB) {
    if (c.length < 5 || Math.abs(c.length - t.length) > 1 || c[0] !== t[0]) continue; // الحرف الأول ثابت (preservation ≠ reservation)
    if (dl1(t, c)) { if (hit && hit !== c) return t; hit = c; }
  }
  return hit || t;
}

const SORTED = new Map();   // «ترتيب الكلمات»: مفتاحٌ مرتَّب ← id (أو null إن التبس)
const FAM_INDEX = []; // { toks:[...], fam, weak }
function buildIndex() {
  for (const o of OCC) BY_ID.set(o.id, o);
  for (const o of OCC) {
    if (!o.gen) { addAlias(o.en, o.id); addAlias(o.ar, o.id); }
    for (const a of o.aliases) addAlias(a, o.id);
  }
  for (const f of FAMILIES) {
    for (const dm of f.domains) {
      const weak = dm.endsWith("~");
      const toks = tokenizeRaw(weak ? dm.slice(0, -1) : dm);
      if (toks.length) FAM_INDEX.push({ toks, fam: f, weak });
    }
    for (const t of ["staff", "sup", "mgr"]) for (const a of String(f.extra[t] || "").split("|").filter(Boolean)) addAlias(a, f.tiers[t] || f.tiers.mgr || f.tiers.staff);
  }
}
buildIndex();
EN_VOCAB = new Set();
for (const k of ALIAS.keys()) for (const t of k.split(" ")) if (/^[a-z]+$/.test(t) && t.length >= 5) EN_VOCAB.add(t);
for (const x of FAM_INDEX) for (const t of x.toks) if (/^[a-z]+$/.test(t) && t.length >= 5) EN_VOCAB.add(t);
for (const set of [MGR_STRONG, SUP_WORDS, MGR_WEAK, STAFF_WORDS]) for (const t of set) if (/^[a-z]+$/.test(t) && t.length >= 5) EN_VOCAB.add(t);
export const OCC_CONFLICTS = CONFLICTS;
export const OCCUPATIONS = OCC.map((o) => ({ id: o.id, nameEn: o.en, nameAr: o.ar, sector: o.sector }));
export const UNCLASSIFIED = { id: "unclassified", nameEn: "Unclassified", nameAr: "غير مصنّف", sector: "" };
// ما كان مبهم التخصص بطبيعته: ثقته لا تتجاوز «منخفضة» ولو طابق حرفياً.
const VAGUE = new Set(["eng.general-engineer", "hosp.chef-unspecified", "trade.maintenance-technician", "trade.machine-operator", "log.courier"]);

/* ═════════════ المطابقة ═════════════ */
function findAlias(toks) {
  // الأطول أولاً؛ وعند التساوي: العربية الرأسُ أولها، والإنجليزية الرأسُ آخرها.
  const ar = toks.some(isArTok) && !toks.some((t) => /[a-z]/.test(t));
  for (let L = Math.min(MAX_LEN, toks.length); L >= 1; L--) {
    const starts = [];
    for (let i = 0; i + L <= toks.length; i++) starts.push(i);
    if (!ar) starts.reverse();
    for (const i of starts) {
      const id = ALIAS.get(toks.slice(i, i + L).join(" "));
      if (id) return { id, start: i, len: L };
    }
  }
  return null;
}
// نفس العبارات بترتيبٍ مختلف («manager restaurant»، «chef executive»، «waiter head»)
function findSorted(toks) {
  const body = toks.filter((t) => !LEVEL_OF.has(t));
  for (let L = Math.min(4, body.length); L >= 2; L--) {
    for (let i = 0; i + L <= body.length; i++) {
      const id = SORTED.get([...body.slice(i, i + L)].sort().join(" "));
      if (id) return { id, start: i, len: L };
    }
  }
  return null;
}
function tierOf(toks) {
  if (toks.some((t) => MGR_STRONG.has(t))) return "mgr";
  if (toks.some((t) => SUP_WORDS.has(t))) return "sup";
  if (toks.some((t) => MGR_WEAK.has(t))) return "mgr";
  if (toks.some((t) => STAFF_WORDS.has(t))) return "staff";
  return "";
}
function tierPos(toks, tier) {
  const set = tier === "mgr" ? new Set([...MGR_STRONG, ...MGR_WEAK]) : tier === "sup" ? SUP_WORDS : STAFF_WORDS;
  const i = toks.findIndex((t) => set.has(t));
  return i < 0 ? 0 : i;
}
function findFamily(toks) {
  const hits = [];
  for (const x of FAM_INDEX) {
    const L = x.toks.length;
    for (let i = 0; i + L <= toks.length; i++) {
      let ok = true;
      for (let j = 0; j < L; j++) if (toks[i + j] !== x.toks[j]) { ok = false; break; }
      if (ok) hits.push({ fam: x.fam, start: i, len: L, weak: x.weak });
    }
  }
  if (!hits.length) return null;
  const strong = hits.filter((h) => !h.weak);
  if (strong.length) { hits.length = 0; hits.push(...strong); }
  const specific = hits.filter((h) => !h.fam.generic);
  if (specific.length) { hits.length = 0; hits.push(...specific); }
  const tier = tierOf(toks);
  if (!tier) { hits.sort((a, b) => b.len - a.len || a.start - b.start); return { ...hits[0], tier }; }
  const tp = tier ? tierPos(toks, tier) : 0;
  const ar = toks.some(isArTok) && !toks.some((t) => /[a-z]/.test(t));
  // المجال الأقرب إلى كلمة المرتبة: في الإنجليزية ما قبلها، وفي العربية ما بعدها.
  const dist = (h) => (ar ? h.start - tp : tp - (h.start + h.len - 1));
  hits.sort((a, b) => {
    const da = dist(a), db = dist(b);
    const va = da >= 0 ? 0 : 1, vb = db >= 0 ? 0 : 1;
    if (va !== vb) return va - vb;
    if (Math.abs(da) !== Math.abs(db)) return Math.abs(da) - Math.abs(db);
    return b.len - a.len;
  });
  return { ...hits[0], tier };
}
function pickTier(f, tier) {
  const t = f.tiers;
  if (tier === "mgr") return t.mgr ? [t.mgr, ""] : t.sup ? [t.sup, "lead"] : t.staff ? [t.staff, "head"] : null;
  if (tier === "sup") return t.sup ? [t.sup, ""] : t.mgr ? [t.mgr, "lead"] : t.staff ? [t.staff, "lead"] : null;
  return t.staff ? [t.staff, ""] : null;
}
function levelOf(toks, used) {
  const seen = [];
  toks.forEach((t, i) => { if (!used.has(i) && LEVEL_OF.has(t)) seen.push(LEVEL_OF.get(t)); });
  for (const l of ["senior", "junior", "assistant", "lead"]) if (seen.includes(l)) return l;
  return "";
}
const rank = { high: 3, medium: 2, low: 1 };
const lower = (c, n = 1) => (n <= 0 ? c : ({ high: "medium", medium: "low", low: "low" }[lower(c, n - 1)] || "low"));

// يصنّف قائمة رموزٍ واحدة. يعيد null إن لم يجد، أو {unclassified:true, via} للتدريب/العامّ.
function classifyTokens(toksIn) {
  const toks = dropOrdinals(toksIn);
  if (!toks.length) return null;
  const tier = tierOf(toks);
  // ١) التدريب: لا يُعدّ مهنة (تُؤخذ مهنة المتدرّب من نصّ سيرته). «training specialist» مهنةٌ لا تدريب.
  const traineeHit = toks.some((t) => TRAINEE.has(t)) || (TRAINING_FIRST.has(toks[0]) && !tier);
  if (traineeHit) {
    const rest = toks.filter((t) => !TRAINEE.has(t) && !TRAINING_FIRST.has(t));
    const h = rest.length ? findAlias(rest) : null;
    return { unclassified: true, via: "trainee", level: "trainee", hintId: h ? h.id : "" };
  }
  // ٢) عبارة صريحة بطول ≥٢ أو تُغطّي الكلّ
  const a = findAlias(toks);
  const strongAlias = a && (a.len >= 2 || toks.filter((t) => !LEVEL_OF.has(t)).length <= 1);
  // طالب/student ليست مهنة («senior accounting student»)، إلا إن كانت جزءاً من عبارةٍ صريحة («student affairs officer»).
  if (!strongAlias && toks.some((t) => STUDENT.has(t))) return { unclassified: true, via: "nojob" };
  const mk = (id, used, via, conf, extraLevel) => {
    const usedSet = new Set(used);
    const lvl = levelOf(toks, usedSet) || extraLevel || "";
    return { id, level: lvl, via, conf };
  };
  if (strongAlias) {
    const used = []; for (let i = a.start; i < a.start + a.len; i++) used.push(i);
    const leftToks = toks.filter((t, i) => !used.includes(i) && !LEVEL_OF.has(t));
    // العبارة الصريحة خلّفت كلمة مرتبةٍ (manager/supervisor/officer) فالمجال أدقّ منها: الأسرة أولى.
    if (leftToks.length && tierOf(leftToks)) {
      const f0 = findFamily(toks);
      if (f0 && f0.tier && f0.start < a.start + a.len && f0.start + f0.len > a.start) {
        const pt0 = pickTier(f0.fam, f0.tier);
        if (pt0) {
          const u0 = []; for (let i = f0.start; i < f0.start + f0.len; i++) u0.push(i);
          toks.forEach((t, i) => { if (MGR_STRONG.has(t) || SUP_WORDS.has(t) || MGR_WEAK.has(t) || STAFF_WORDS.has(t)) u0.push(i); });
          const l0 = toks.filter((t, i) => !u0.includes(i) && !LEVEL_OF.has(t)).length;
          return mk(pt0[0], u0.filter((i) => !LEVEL_OF.has(toks[i])), "family", l0 === 0 ? "high" : "medium", pt0[1]);
        }
      }
    }
    return mk(a.id, used, leftToks.length === 0 ? "alias" : "contain", leftToks.length === 0 ? "high" : "medium");
  }
  // ٣) أسرة بكلمة مرتبة
  const f = findFamily(toks);
  if (f && f.tier) {
    const pt = pickTier(f.fam, f.tier);
    if (pt) {
      const used = []; for (let i = f.start; i < f.start + f.len; i++) used.push(i);
      toks.forEach((t, i) => { if (MGR_STRONG.has(t) || SUP_WORDS.has(t) || MGR_WEAK.has(t) || STAFF_WORDS.has(t)) used.push(i); });
      const left = toks.filter((t, i) => !used.includes(i) && !LEVEL_OF.has(t)).length;
      return mk(pt[0], used.filter((i) => !LEVEL_OF.has(toks[i])), "family", left === 0 ? "high" : "medium", pt[1]);
    }
  }
  // ٣ب) العبارة نفسها بترتيب كلماتٍ مختلف
  const so = findSorted(toks);
  if (so && (!a || a.len < so.len)) {
    const body = toks.filter((t) => !LEVEL_OF.has(t));
    return mk(so.id, [], "order", so.len === body.length ? "medium" : "low");
  }
  // ٤) عبارة صريحة مفردة داخل كلام أطول
  if (a) {
    const used = [a.start];
    return mk(a.id, used, "contain", "low");
  }
  // ٥) أسرة بلا كلمة مرتبة
  if (f && !f.tier && !f.fam.noBare) {
    const pt = pickTier(f.fam, "staff");
    if (pt) return mk(pt[0], [], "domain", "low");
  }
  // ٦) غير مهنة: خريج/طالب/باحث عن عمل، أو مسمّى عامّ بلا مجال
  if (toks.every((t) => NOJOB.has(t) || GENERIC.has(t) && false)) return { unclassified: true, via: "nojob" };
  if (toks.every((t) => GENERIC.has(t) || NOJOB.has(t))) return { unclassified: true, via: "generic" };
  return null;
}

/* ═════════════ التقسيم إلى مقاطع ═════════════ */
const EMPLOYER_SPLIT = /\s[-–—−]+\s|\s*[–—]\s*|\s@\s|\s(?:at)\s|\s(?:في|لدى|لدي|بشركه|بشركة)\s|\s:\s/i;
const ALT_SPLIT = /\s*[\/\\|]\s*|\s*[،,;]\s*|\s+or\s+|\s+او\s+|\s+أو\s+/i;
function segments(raw) {
  let s = String(raw == null ? "" : raw).normalize("NFKC");
  s = s.replace(/\bqa\s*\/\s*qc\b/gi, "qa qc").replace(/\bui\s*\/\s*ux\b/gi, "ui ux").replace(/\br\s*&\s*d\b/gi, "r d").replace(/\bo\s*&\s*m\b/gi, "o m");
  const parens = [];
  s = s.replace(/[(\[（]([^)\]）]*)[)\]）]/g, (m, t) => { parens.push(t); return " "; });
  const parts = s.split(EMPLOYER_SPLIT).map((x) => x.trim()).filter(Boolean);
  return { parts: parts.map((p) => p.split(ALT_SPLIT).map((x) => x.trim()).filter(Boolean)), parens };
}

/* ═════════════ الواجهة ═════════════ */
const confOut = (c) => c;
function result(id, level, confidence, via, field) {
  const o = BY_ID.get(id);
  return { id, nameAr: o.ar, nameEn: o.en, sector: o.sector, level: level || "", confidence, via };
}
function unclassified(via, field, extra) {
  return { id: UNCLASSIFIED.id, nameAr: UNCLASSIFIED.nameAr, nameEn: UNCLASSIFIED.nameEn, sector: String(field || ""), level: (extra && extra.level) || "", confidence: "low", via, ...(extra && extra.hintId ? { hintId: extra.hintId } : {}) };
}

export function canonicalOccupation(title, opts) {
  const field = opts && opts.field ? String(opts.field).trim() : "";
  const raw = String(title == null ? "" : title).trim();
  if (!raw) return unclassified("empty", field);
  const { parts, parens } = segments(raw);
  let generic = null;
  const tryAlts = (alts, penalty0) => {
    for (let ai = 0; ai < alts.length; ai++) {
      const toks = tokenize(alts[ai]);
      const c = classifyTokens(toks);
      if (!c) continue;
      if (c.unclassified) { if (!generic) generic = c; continue; }
      return { c, penalty: penalty0 + (ai > 0 ? 1 : 0), toks, fixed: !!toks.fixed };
    }
    return null;
  };
  let hit = null;
  for (let pi = 0; pi < parts.length && !hit; pi++) {
    hit = tryAlts(parts[pi], pi > 0 ? 1 : 0);
    // «manager, logistic»: بديلان في المقطع نفسه، الأول مرتبةٌ فقط والثاني مجالٌ ← اجمعهما
    // (لا يُجمَع مع مقطع جهة العمل بعد « - »: «supervisor - napco» لا مجال فيه).
    if (!hit && parts[pi].length > 1) {
      const t0 = tokenize(parts[pi][0]), t1 = tokenize(parts[pi][1]);
      if (t0.length && t0.every((t) => GENERIC.has(t))) {
        const c = classifyTokens(tokenize(parts[pi][1] + " " + parts[pi][0]));
        if (c && !c.unclassified) hit = { c, penalty: pi + 1, toks: t0 };
      } else if (t0.length && t1.length && !tierOf(t0) && tierOf(t1) && !t1.some((t) => ALIAS.has(t))) {
        // «production / hot mill supervisor»: مجالٌ ثم مرتبة ← اجمعهما
        const c = classifyTokens(tokenize(parts[pi][0] + " " + parts[pi][1]));
        if (c && !c.unclassified && c.via === "family") hit = { c, penalty: pi + 1, toks: t0 };
      }
    }
  }
  // «production - hot mill supervisor - X»: المقطع الأول مجال والثاني مرتبة ← اجمعهما (لا إن كان الأول مرتبةً فقط، فالثاني حينئذٍ جهة عمل)
  if (!hit && parts.length > 1) {
    const t0 = tokenize(parts[0][0] || ""), t1 = tokenize(parts[1][0] || "");
    if (t0.length && t1.length && !t0.every((t) => GENERIC.has(t)) && tierOf(t1) && !tierOf(t0)) {
      const c = classifyTokens(tokenize(parts[0][0] + " " + parts[1][0]));
      if (c && !c.unclassified && c.via === "family") hit = { c, penalty: 1, toks: t0 };
    }
  }
  if (!hit && parens.length) {
    for (const p of parens) {
      const mainToks = tokenize(parts[0] ? parts[0][0] || "" : "");
      const c = classifyTokens(tokenize(p + " " + (mainToks.length && mainToks.every((t) => GENERIC.has(t)) ? parts[0][0] : "")));
      if (c && !c.unclassified) { hit = { c, penalty: 1, toks: [] }; break; }
      if (c && c.unclassified && !generic) generic = c;
    }
  }
  if (hit) {
    let { c, penalty } = hit;
    if (hit.fixed && c.conf === "high") c = { ...c, conf: "medium" }; // صُحِّح خطأٌ إملائي في المسمّى
    let id = c.id;
    // مدير حسابات: محاسبة أم حسابات عملاء؟ المجال يحسم.
    if (id === "fin.finance-manager" && field === SM && /(^|\s)مدير حساب/.test(foldChars(raw)) && !/مالي|محاسب/.test(foldChars(raw))) id = "sales.account-manager";
    let conf = lower(c.conf, penalty);
    if (VAGUE.has(id) && rank[conf] > 1) conf = "low";
    return result(id, c.level, conf, penalty ? "alt" : c.via, field);
  }
  if (generic) return unclassified(generic.via, field, generic);
  return unclassified("none", field);
}


/* ═════════════ للبحث والمطابقة (يستعملها من يبني الشاشات) ═════════════ */
let SEARCH_INDEX = null;
// مهنٌ تطابق نصّاً حرّاً يكتبه صاحب العمل في خانة البحث: «chef» ← كل مهن الطهي، «cdp» ← شيف القسم وحده.
// المطابقة الحتمية أولاً (canonicalOccupation)، ثم كل مهنةٍ فيها عبارةٌ تحوي كلمات البحث كلها؛
// وكلما قصرت العبارة قرُبت من البحث فسبقت. لا قيمةَ عشوائية ولا نموذج.
export function searchOccupations(query, opts) {
  const limit = Math.max(1, Math.min(50, Number(opts && opts.limit) || 10));
  const qt = tokenize(query);
  if (!qt.length || qt.every((t) => PURE_TIER.has(t))) return [];   // «supervisor» وحدها ليست مهنة
  if (!SEARCH_INDEX) {
    SEARCH_INDEX = [];
    for (const [key, id] of ALIAS) SEARCH_INDEX.push({ toks: key.split(" "), id });
  }
  const out = new Map();
  const c = canonicalOccupation(query);
  if (c.id !== UNCLASSIFIED.id && c.confidence !== "low") out.set(c.id, 1000);
  for (const e of SEARCH_INDEX) {
    if (!qt.every((t) => e.toks.includes(t))) continue;
    const sc = 100 * qt.length / e.toks.length;
    if (!out.has(e.id) || out.get(e.id) < sc) out.set(e.id, sc);
  }
  return [...out].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, limit)
    .map(([id, score]) => ({ ...occupationById(id), score: Math.round(score) }));
}

// السلالم المهنية القياسية (من الأدنى): «ما يماثله» لمطابقةٍ تتسع لمرتبةٍ مجاورة عند الحاجة.
const LADDERS = {
  kitchen: ["hosp.kitchen-helper", "hosp.cook", "hosp.commis-chef", "hosp.demi-chef-de-partie", "hosp.chef-de-partie", "hosp.sous-chef", "hosp.executive-sous-chef", "hosp.head-chef", "hosp.executive-chef"],
  pastry: ["hosp.pastry-commis", "hosp.pastry-cdp", "hosp.pastry-chef", "hosp.pastry-sous-chef", "hosp.head-pastry-chef"],
  floor: ["hosp.food-runner", "hosp.waiter", "hosp.captain", "hosp.head-waiter", "hosp.restaurant-supervisor", "hosp.restaurant-manager", "hosp.fb-manager"],
  coffee: ["hosp.barista", "hosp.head-barista"],
  bar: ["hosp.bartender", "hosp.head-bartender", "hosp.bar-manager"],
  finance: ["fin.accountant", "fin.accounting-supervisor", "fin.chief-accountant", "fin.finance-manager", "fin.financial-controller", "fin.cfo"],
};
export function occupationLadder(id) {
  for (const [name, list] of Object.entries(LADDERS)) {
    const i = list.indexOf(id);
    if (i >= 0) return { ladder: name, rank: i, below: i > 0 ? list[i - 1] : null, above: i < list.length - 1 ? list[i + 1] : null, steps: list.slice() };
  }
  return null;
}

export const occupationById = (id) => { const o = BY_ID.get(id); return o ? { id: o.id, nameAr: o.ar, nameEn: o.en, sector: o.sector } : null; };
// آلة مساعدة للمحاسبة الدورية: خريطة {مسمّى مُطبَّع ← id} لمجموعة مسمّيات.
export function classifyTitles(titles, opts) {
  const out = {};
  for (const t of titles) out[t] = canonicalOccupation(t, opts);
  return out;
}
// مفتاح المسمّى كما في Notion: lower(trim)
// (SQLite lower() يخفّض الحروف اللاتينية ASCII وحدها، وtrim() يقصّ المسافات وحدها — فنفعل مثله حرفياً.)
export const titleKey = (t) => String(t == null ? "" : t).replace(/^ +| +$/g, "").replace(/[A-Z]/g, (c) => c.toLowerCase());
// اسم الخيار في عمود «المهنة الموحّدة»: «العربي | English». لا فواصل (Notion يرفضها في الخيارات).
export function occupationOptionName(id) {
  const o = BY_ID.get(id);
  return (o ? `${o.ar} | ${o.en}` : `${UNCLASSIFIED.nameAr} | ${UNCLASSIFIED.nameEn}`).replace(/,/g, "،");
}
export const CONFIDENCE_AR = { high: "عالية", medium: "متوسطة", low: "منخفضة" };
