#!/usr/bin/env node
/* ═════════════ مولِّد فهارس نموذج طلب الموظفين (EOR) ═════════════
 * يولّد api/_eor-catalogs.json — بيانات فقط، بلا منطق. غير مضاف لسلسلة `npm run build`؛ يُشغَّل يدوياً:
 *     node site/scripts/build-eor-catalogs.mjs
 *
 * المحتوى: الدول (ISO 3166-1، أربع لغات) · مدن المملكة ومناطقها · القطاعات (ISIC Rev.4 + قطاعات حديثة) ·
 * مستويات الوظيفة · المهن (ISCO-08).
 *
 * المصادر والأمانة:
 *  - أسماء الدول بالعربية والإنجليزية والفرنسية والصينية من ICU عبر Intl.DisplayNames (CLDR) — لا كتابة يدوية
 *    إلا في `AR_OVERRIDES` حيث اسم CLDR ثقيل على القارئ السعودي.
 *  - أقسام ISIC Rev.4 وأرقام الشُّعب (إصدار الأمم المتحدة) وأقسام ISCO-08 (منظمة العمل الدولية): من معرفة المُنشئ
 *    بلا رجوع لمصدر حيّ؛ تُراجَع قبل أي اعتماد (انظر حقل meta.review).
 *  - مدن المملكة: من المعرفة العامة، لا من مصدر رسمي (الهيئة العامة للإحصاء / وزارة البلديات).
 *  - المهن: معرّفاتها `<بادئة>.<slug>`؛ ما طابق مهنة موجودة في api/_occupations.js حمل `existing_id` ولم يُغيَّر فيها شيء.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../../api/_eor-catalogs.json");
export const CATALOG_VERSION = "2026-10-08.1";

const fail = (m) => { throw new Error("build-eor-catalogs: " + m); };
const lines = (s) => s.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));

/* ═════════════ ١) الدول ═════════════ */
const ISO2 = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ
BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ
DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR
GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY
HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP
KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY
MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ
NA NC NE NF NG NI NL NO NP NR NU NZ OM
PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW
SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ
TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ
VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(/\s+/);
// رمز مخصص خارج ISO لكنه مستعمل في جوازات السفر والتوظيف (كوسوفو)
const EXTRA = ["XK"];

// الأكثر شيوعاً في التوظيف أولاً (يبدأ بما ذكره المالك)، ثم العرب، ثم مصادر العمالة، ثم الباقي.
const PRIORITY = `IN PK PH BD EG NP ID LK SD JO SY YE
LB PS IQ MA TN DZ LY SO MR AE KW BH QA OM
KE UG ET ER NG GH CM SN ML TZ ZA ZW AF MM TH VN MY CN KR JP TR IR
GB US CA AU NZ FR DE IT ES PT IE RU UA BR`.split(/\s+/);

// تفضيلات عربية أقصر/أألف في السوق السعودي حيث اسم CLDR طويل أو غير مألوف.
const AR_OVERRIDES = {
  AE: "الإمارات العربية المتحدة", GB: "المملكة المتحدة", US: "الولايات المتحدة الأمريكية", CZ: "التشيك",
  MM: "ميانمار (بورما)", PS: "فلسطين", HK: "هونغ كونغ", MO: "ماكاو", KR: "كوريا الجنوبية", KP: "كوريا الشمالية",
  CD: "جمهورية الكونغو الديمقراطية", CG: "جمهورية الكونغو", CI: "ساحل العاج", SZ: "إسواتيني", TR: "تركيا",
  XK: "كوسوفو", TL: "تيمور الشرقية", CV: "الرأس الأخضر", MK: "مقدونيا الشمالية", VA: "الفاتيكان",
  TW: "تايوان", EH: "الصحراء الغربية", BA: "البوسنة والهرسك", CF: "جمهورية أفريقيا الوسطى",
};

function buildCountries() {
  const dn = Object.fromEntries(["ar", "en", "fr", "zh"].map((l) => [l, new Intl.DisplayNames([l], { type: "region" })]));
  const codes = [...ISO2, ...EXTRA];
  const dup = codes.find((c, i) => codes.indexOf(c) !== i);
  if (dup) fail("رمز دولة مكرر: " + dup);
  const prio = new Map(PRIORITY.map((c, i) => [c, i + 1]));
  for (const c of PRIORITY) if (!codes.includes(c)) fail("أولوية لرمز غير موجود: " + c);
  const out = codes.map((code) => {
    const o = { code };
    for (const l of ["ar", "en", "fr", "zh"]) {
      let v = dn[l].of(code);
      if (l === "ar" && AR_OVERRIDES[code]) v = AR_OVERRIDES[code];
      if (!v || v === code) fail(`اسم ${l} مفقود لـ ${code} (ICU ناقص؟)`);
      o[l] = v;
    }
    o.priority = code === "SA" ? 0 : prio.get(code) || 999;
    if (code === "SA") o.saudi = true;
    if (EXTRA.includes(code)) o.iso = false;
    return o;
  });
  // الفرز: الأولوية ثم الاسم الإنجليزي
  out.sort((a, b) => a.priority - b.priority || a.en.localeCompare(b.en, "en"));
  return out;
}

/* ═════════════ ٢) مناطق المملكة ومدنها ═════════════
 * سطر المدينة: region|slug|English|العربي|أعلام  (c=عاصمة المنطقة، m=مدينة كبرى، i=مدينة صناعية/اقتصادية)
 * لا تخترع مدناً: ما لم أتيقّن من اسمه تُرك. */
const REGIONS = [
  ["riyadh", "منطقة الرياض", "Riyadh Region", "riyadh"],
  ["makkah", "منطقة مكة المكرمة", "Makkah Region", "makkah"],
  ["madinah", "منطقة المدينة المنورة", "Madinah Region", "madinah"],
  ["qassim", "منطقة القصيم", "Qassim Region", "buraydah"],
  ["eastern", "المنطقة الشرقية", "Eastern Province", "dammam"],
  ["asir", "منطقة عسير", "Asir Region", "abha"],
  ["tabuk", "منطقة تبوك", "Tabuk Region", "tabuk"],
  ["hail", "منطقة حائل", "Hail Region", "hail"],
  ["northern-borders", "منطقة الحدود الشمالية", "Northern Borders Region", "arar"],
  ["jazan", "منطقة جازان", "Jazan Region", "jazan"],
  ["najran", "منطقة نجران", "Najran Region", "najran"],
  ["al-bahah", "منطقة الباحة", "Al Bahah Region", "al-baha"],
  ["al-jawf", "منطقة الجوف", "Al Jawf Region", "sakaka"],
];
const CITIES = lines(`
riyadh|riyadh|Riyadh|الرياض|cm
riyadh|al-kharj|Al Kharj|الخرج|m
riyadh|diriyah|Diriyah|الدرعية|m
riyadh|al-majmaah|Al Majmaah|المجمعة|
riyadh|az-zulfi|Az Zulfi|الزلفي|
riyadh|shaqra|Shaqra|شقراء|
riyadh|wadi-ad-dawasir|Wadi ad-Dawasir|وادي الدواسر|
riyadh|al-aflaj|Al Aflaj (Layla)|الأفلاج (ليلى)|
riyadh|hotat-bani-tamim|Hotat Bani Tamim|حوطة بني تميم|
riyadh|al-hariq|Al Hariq|الحريق|
riyadh|ad-dawadmi|Ad Dawadmi|الدوادمي|
riyadh|afif|Afif|عفيف|
riyadh|al-quwayiyah|Al Quwayiyah|القويعية|
riyadh|as-sulayyil|As Sulayyil|السليل|
riyadh|thadiq|Thadiq|ثادق|
riyadh|huraymila|Huraymila|حريملاء|
riyadh|al-ghat|Al Ghat|الغاط|
riyadh|rumah|Rumah|رماح|
riyadh|dhurma|Dhurma|ضرماء|
riyadh|al-muzahimiyah|Al Muzahimiyah|المزاحمية|
riyadh|al-artawiyah|Al Artawiyah|الأرطاوية|
riyadh|marat|Marat|مرات|
riyadh|al-bijadiyah|Al Bijadiyah|البجادية|
riyadh|hotat-sudair|Hotat Sudair|حوطة سدير|
riyadh|tumair|Tumair|تمير|
riyadh|al-uyaynah|Al Uyaynah|العيينة|
riyadh|ar-rayn|Ar Rayn|الرين|
makkah|makkah|Makkah|مكة المكرمة|cm
makkah|jeddah|Jeddah|جدة|m
makkah|taif|Taif|الطائف|m
makkah|rabigh|Rabigh|رابغ|
makkah|al-qunfudhah|Al Qunfudhah|القنفذة|
makkah|al-laith|Al Laith|الليث|
makkah|khulais|Khulais|خليص|
makkah|al-jumum|Al Jumum|الجموم|
makkah|al-kamil|Al Kamil|الكامل|
makkah|turabah|Turabah|تربة|
makkah|ranyah|Ranyah|رنية|
makkah|al-khurmah|Al Khurmah|الخرمة|
makkah|al-muwayh|Al Muwayh|المويه|
makkah|adham|Adham|أضم|
makkah|maysan|Maysan|ميسان|
makkah|bahrah|Bahrah|بحرة|
makkah|thuwal|Thuwal|ثول|
makkah|al-ardiyat|Al Ardiyat|العرضيات|
makkah|asfan|Usfan|عسفان|
makkah|king-abdullah-economic-city|King Abdullah Economic City (KAEC)|مدينة الملك عبدالله الاقتصادية|i
madinah|madinah|Madinah|المدينة المنورة|cm
madinah|yanbu|Yanbu|ينبع|m
madinah|al-ula|AlUla|العلا|
madinah|badr|Badr|بدر|
madinah|khaybar|Khaybar|خيبر|
madinah|al-mahd|Al Mahd|المهد|
madinah|wadi-al-fara|Wadi al-Fara|وادي الفرع|
madinah|al-henakiyah|Al Henakiyah|الحناكية|
madinah|yanbu-industrial-city|Yanbu Industrial City|ينبع الصناعية|i
qassim|buraydah|Buraydah|بريدة|cm
qassim|unaizah|Unaizah|عنيزة|m
qassim|ar-rass|Ar Rass|الرس|
qassim|al-bukayriyah|Al Bukayriyah|البكيرية|
qassim|al-mithnab|Al Mithnab|المذنب|
qassim|riyadh-al-khabra|Riyadh Al Khabra|رياض الخبراء|
qassim|al-badai|Al Badai|البدائع|
qassim|uyun-al-jiwa|Uyun Al Jiwa|عيون الجواء|
qassim|al-asyah|Al Asyah|الأسياح|
qassim|an-nabhaniyah|An Nabhaniyah|النبهانية|
qassim|ash-shimasiyah|Ash Shimasiyah|الشماسية|
qassim|uqlat-as-suqur|Uqlat as Suqur|عقلة الصقور|
qassim|dukhnah|Dukhnah|دخنة|
eastern|dammam|Dammam|الدمام|cm
eastern|al-khobar|Al Khobar|الخبر|m
eastern|dhahran|Dhahran|الظهران|m
eastern|hofuf|Hofuf (Al Ahsa)|الهفوف (الأحساء)|m
eastern|al-mubarraz|Al Mubarraz|المبرز|
eastern|jubail|Jubail|الجبيل|m
eastern|qatif|Qatif|القطيف|m
eastern|hafr-al-batin|Hafar Al Batin|حفر الباطن|m
eastern|khafji|Khafji|الخفجي|
eastern|ras-tanura|Ras Tanura|رأس تنورة|
eastern|abqaiq|Abqaiq|بقيق|
eastern|an-nuayriyah|An Nuayriyah|النعيرية|
eastern|qaryat-al-ulya|Qaryat al-Ulya|قرية العليا|
eastern|safwa|Safwa|صفوى|
eastern|saihat|Saihat|سيهات|
eastern|anak|Anak|عنك|
eastern|tarout|Tarout|تاروت|
eastern|al-awamiyah|Al Awamiyah|العوامية|
eastern|al-uqair|Al Uqair|العقير|
eastern|al-omran|Al Omran|العمران|
eastern|al-qurayn|Al Qurayn|القرين|
eastern|al-jafr|Al Jafr|الجفر|
eastern|jubail-industrial-city|Jubail Industrial City|الجبيل الصناعية|i
eastern|ras-al-khair|Ras Al Khair|رأس الخير|i
asir|abha|Abha|أبها|cm
asir|khamis-mushait|Khamis Mushait|خميس مشيط|m
asir|bisha|Bisha|بيشة|
asir|muhayil|Muhayil Asir|محايل عسير|
asir|an-namas|An Namas|النماص|
asir|tanomah|Tanomah|تنومة|
asir|sarat-abidah|Sarat Abidah|سراة عبيدة|
asir|rijal-almaa|Rijal Almaa|رجال ألمع|
asir|ahad-rafidah|Ahad Rafidah|أحد رفيدة|
asir|balqarn|Balqarn|بلقرن|
asir|tathlith|Tathlith|تثليث|
asir|dhahran-al-janub|Dhahran Al Janub|ظهران الجنوب|
asir|al-majardah|Al Majardah|المجاردة|
asir|barq|Barq|بارق|
asir|al-birk|Al Birk|البرك|
asir|billasmar|Billasmar|بللسمر|
asir|billahmar|Billahmar|بللحمر|
asir|wadi-bin-hashbal|Wadi Bin Hashbal|وادي بن هشبل|
asir|al-harjah|Al Harjah|الحرجة|
tabuk|tabuk|Tabuk|تبوك|cm
tabuk|duba|Duba|ضباء|
tabuk|al-wajh|Al Wajh|الوجه|
tabuk|umluj|Umluj|أملج|
tabuk|tayma|Tayma|تيماء|
tabuk|haql|Haql|حقل|
tabuk|al-bad|Al Bad|البدع|
hail|hail|Hail|حائل|cm
hail|baqaa|Baqaa|بقعاء|
hail|al-ghazalah|Al Ghazalah|الغزالة|
hail|ash-shinan|Ash Shinan|الشنان|
hail|al-hait|Al Hait|الحائط|
hail|mawqaq|Mawqaq|موقق|
hail|samira|Samira|سميراء|
hail|ash-shamli|Ash Shamli|الشملي|
hail|as-sulaimi|As Sulaimi|السليمي|
northern-borders|arar|Arar|عرعر|cm
northern-borders|rafha|Rafha|رفحاء|
northern-borders|turaif|Turaif|طريف|
northern-borders|al-uwayqilah|Al Uwayqilah|العويقيلة|
jazan|jazan|Jazan|جازان|cm
jazan|sabya|Sabya|صبيا|
jazan|abu-arish|Abu Arish|أبو عريش|
jazan|samtah|Samtah|صامطة|
jazan|ahad-al-masarihah|Ahad Al Masarihah|أحد المسارحة|
jazan|baish|Baish|بيش|
jazan|damad|Damad|ضمد|
jazan|al-darb|Al Darb|الدرب|
jazan|farasan|Farasan|فرسان|
jazan|al-aridhah|Al Aridhah|العارضة|
jazan|al-harth|Al Harth|الحرث|
jazan|al-edabi|Al Edabi|العيدابي|
jazan|fifa|Fifa|فيفا|
jazan|ar-rayth|Ar Rayth|الريث|
jazan|ad-dayer|Ad Dayer|الداير|
jazan|harub|Harub|هروب|
jazan|al-tuwal|Al Tuwal|الطوال|
najran|najran|Najran|نجران|cm
najran|sharurah|Sharurah|شرورة|
najran|hubuna|Hubuna|حبونا|
najran|badr-al-janub|Badr Al Janub|بدر الجنوب|
najran|yadamah|Yadamah|يدمة|
najran|thar|Thar|ثار|
najran|khubash|Khubash|خباش|
najran|al-wadiah|Al Wadiah|الوديعة|
al-bahah|al-baha|Al Baha|الباحة|cm
al-bahah|baljurashi|Baljurashi|بلجرشي|
al-bahah|al-mandaq|Al Mandaq|المندق|
al-bahah|al-makhwah|Al Makhwah|المخواة|
al-bahah|al-aqiq|Al Aqiq|العقيق|
al-bahah|qilwah|Qilwah|قلوة|
al-bahah|al-qura|Al Qura|القرى|
al-bahah|ghamed-az-zinad|Ghamed Az Zinad|غامد الزناد|
al-bahah|bani-hassan|Bani Hassan|بني حسن|
al-jawf|sakaka|Sakaka|سكاكا|cm
al-jawf|dumat-al-jandal|Dumat Al Jandal|دومة الجندل|
al-jawf|al-qurayyat|Al Qurayyat|القريات|
al-jawf|tabarjal|Tabarjal|طبرجل|
`);

function buildCities() {
  const regionIds = new Set(REGIONS.map((r) => r[0]));
  const seen = new Set();
  return CITIES.map((l) => {
    const p = l.split("|");
    if (p.length !== 5) fail("سطر مدينة غير صالح: " + l);
    const [region, slug, en, ar, fl] = p;
    if (!regionIds.has(region)) fail("منطقة غير معروفة: " + region);
    if (seen.has(slug)) fail("مدينة مكررة: " + slug);
    seen.add(slug);
    const o = { id: slug, region, ar, en };
    if (fl.includes("c")) o.capital = true;
    if (fl.includes("m")) o.major = true;
    if (fl.includes("i")) o.kind = "industrial";
    return o;
  });
}

/* ═════════════ ٣) القطاعات (ISIC Rev.4 + قطاعات حديثة) ═════════════
 * السطر: id|العربي|English|القسم|رمز ISIC (شعبة/مجموعة، فارغ للمركّب)|eor_sector
 * eor_sector = معرّف من SECTORS الحالية في api/_eor.js (٢٦ قطاعاً) لربط الفهرس الجديد بالقديم. */
const ISIC_SECTIONS = [
  ["A", "الزراعة والحراجة وصيد الأسماك", "Agriculture, forestry and fishing"],
  ["B", "التعدين واستغلال المحاجر", "Mining and quarrying"],
  ["C", "الصناعة التحويلية", "Manufacturing"],
  ["D", "إمدادات الكهرباء والغاز والبخار وتكييف الهواء", "Electricity, gas, steam and air conditioning supply"],
  ["E", "إمدادات المياه والصرف الصحي وإدارة النفايات", "Water supply; sewerage, waste management and remediation"],
  ["F", "التشييد والبناء", "Construction"],
  ["G", "تجارة الجملة والتجزئة وإصلاح المركبات", "Wholesale and retail trade; repair of motor vehicles"],
  ["H", "النقل والتخزين", "Transportation and storage"],
  ["I", "أنشطة الإقامة والطعام", "Accommodation and food service activities"],
  ["J", "المعلومات والاتصالات", "Information and communication"],
  ["K", "الأنشطة المالية وأنشطة التأمين", "Financial and insurance activities"],
  ["L", "الأنشطة العقارية", "Real estate activities"],
  ["M", "الأنشطة المهنية والعلمية والتقنية", "Professional, scientific and technical activities"],
  ["N", "أنشطة الخدمات الإدارية وخدمات الدعم", "Administrative and support service activities"],
  ["O", "الإدارة العامة والدفاع والضمان الاجتماعي الإلزامي", "Public administration and defence; compulsory social security"],
  ["P", "التعليم", "Education"],
  ["Q", "أنشطة صحة الإنسان والعمل الاجتماعي", "Human health and social work activities"],
  ["R", "الفنون والترفيه والتسلية", "Arts, entertainment and recreation"],
  ["S", "أنشطة الخدمات الأخرى", "Other service activities"],
  ["T", "أنشطة الأسر المعيشية كأصحاب عمل", "Activities of households as employers"],
  ["U", "أنشطة المنظمات والهيئات غير الإقليمية", "Activities of extraterritorial organizations and bodies"],
];
const SECTORS = lines(`
agri-crops|زراعة المحاصيل والبساتين|Crop Farming and Horticulture|A|01|agriculture
agri-livestock|الثروة الحيوانية والدواجن والألبان|Livestock, Poultry and Dairy|A|01|agriculture
forestry|الغابات والحراجة|Forestry and Logging|A|02|agriculture
fishing-aquaculture|الصيد البحري والاستزراع السمكي|Fishing and Aquaculture|A|03|agriculture
oil-gas-upstream|استخراج النفط والغاز|Oil and Gas Extraction (Upstream)|B|06|energy
oilfield-services|خدمات حقول النفط والغاز والحفر|Oilfield and Drilling Services|B|09|energy
mining|التعدين|Mining (general)|B||other
mining-metals|تعدين المعادن والخامات|Metal Ore Mining|B|07|other
mining-quarrying|المحاجر والمعادن الصناعية|Quarrying and Industrial Minerals|B|08|other
food-manufacturing|صناعة الأغذية|Food Manufacturing|C|10|manufacturing
beverages|صناعة المشروبات|Beverage Manufacturing|C|11|manufacturing
textiles|صناعة النسيج|Textile Manufacturing|C|13|manufacturing
apparel|صناعة الملابس الجاهزة|Apparel Manufacturing|C|14|manufacturing
leather-footwear|الجلود والأحذية|Leather and Footwear|C|15|manufacturing
wood-furniture|الأخشاب والأثاث|Wood Products and Furniture|C|16|manufacturing
paper-packaging|الورق والتغليف|Paper and Packaging|C|17|manufacturing
printing|الطباعة|Printing and Reproduction|C|18|manufacturing
refining|تكرير النفط|Petroleum Refining|C|19|energy
chemicals|الصناعات الكيميائية|Chemicals Manufacturing|C|20|manufacturing
petrochemicals|البتروكيماويات|Petrochemicals|C|20|energy
pharma-manufacturing|صناعة الأدوية|Pharmaceutical Manufacturing|C|21|manufacturing
plastics-rubber|البلاستيك والمطاط|Plastics and Rubber|C|22|manufacturing
building-materials|مواد البناء (إسمنت، زجاج، سيراميك)|Building Materials, Cement, Glass and Ceramics|C|23|manufacturing
metals-manufacturing|الصناعات المعدنية الأساسية (حديد، ألمنيوم)|Basic Metals (Steel, Aluminium)|C|24|manufacturing
fabricated-metal|المنتجات المعدنية المشكّلة|Fabricated Metal Products|C|25|manufacturing
electronics-manufacturing|صناعة الإلكترونيات|Electronics Manufacturing|C|26|manufacturing
electrical-equipment|المعدات الكهربائية|Electrical Equipment|C|27|manufacturing
machinery-equipment|الآلات والمعدات|Machinery and Equipment|C|28|manufacturing
automotive-manufacturing|صناعة السيارات والمركبات|Automotive Manufacturing|C|29|manufacturing
aerospace-transport-equipment|الطيران وصناعة معدات النقل|Aerospace and Other Transport Equipment|C|30|manufacturing
medical-devices|الأجهزة والمستلزمات الطبية|Medical Devices and Supplies|C|325|health
other-manufacturing|صناعات تحويلية أخرى|Other Manufacturing|C|32|manufacturing
industrial-repair|صيانة وتركيب المعدات الصناعية|Industrial Machinery Repair and Installation|C|33|trades
manufacturing|الصناعة والتصنيع (عام)|Manufacturing (general)|C||manufacturing
power-utilities|الكهرباء والغاز والبخار|Electricity, Gas and Steam Supply|D|35|energy
renewable-energy|الطاقة المتجددة|Renewable Energy|D|35|energy
water-utilities|المياه والصرف الصحي والتحلية|Water, Sewerage and Desalination|E|36|other
waste-recycling|إدارة النفايات وإعادة التدوير|Waste Management and Recycling|E|38|agriculture
construction-buildings|إنشاء المباني|Building Construction|F|41|construction
construction-infrastructure|البنية التحتية والأعمال المدنية|Civil Engineering and Infrastructure|F|42|construction
construction-specialty|الأعمال التخصصية والتشطيبات (كهروميكانيك)|Specialised Construction and Finishing (MEP)|F|43|construction
contracting|المقاولات|Contracting (general)|F||construction
wholesale|تجارة الجملة|Wholesale Trade|G|46|retail
retail|تجارة التجزئة|Retail|G|47|retail
supermarkets|السوبرماركت والبقالة|Supermarkets and Grocery|G|4711|retail
ecommerce|التجارة الإلكترونية|E-commerce|G|4791|retail
fmcg|السلع الاستهلاكية سريعة الحركة (FMCG)|Fast-Moving Consumer Goods (FMCG)|G||retail
automotive-trade|بيع وصيانة المركبات|Motor Vehicle Sales and Repair|G|45|retail
pharmacies|الصيدليات|Pharmacies|G|4772|health
road-transport|النقل البري|Road Transport|H|49|logistics
rail-transport|النقل بالقطارات والسكك الحديدية|Rail Transport|H|491|logistics
maritime-ports|النقل البحري والموانئ|Maritime Transport and Ports|H|50|aviation-maritime
aviation|الطيران وشركات الطيران|Airlines and Air Transport|H|51|aviation-maritime
airports-ground-handling|المطارات والخدمات الأرضية|Airports and Ground Handling|H|522|aviation-maritime
logistics|اللوجستيات وسلاسل الإمداد|Logistics and Supply Chain|H|52|logistics
warehousing|التخزين والمستودعات|Warehousing and Storage|H|521|logistics
courier-postal|البريد والشحن السريع والتوصيل|Postal, Courier and Last-Mile Delivery|H|53|logistics
hotels-resorts|الفنادق والمنتجعات|Hotels and Resorts|I|551|hospitality
restaurants-cafes|المطاعم والمقاهي|Restaurants and Cafes|I|561|hospitality
catering-services|التموين والإعاشة|Catering and Food Services|I|562|hospitality
tourism-hospitality|السياحة والفنادق والضيافة|Tourism, Hotels and Hospitality|I||hospitality
travel-agencies|وكالات السفر والسياحة|Travel Agencies and Tour Operators|N|79|hospitality
publishing|النشر والمطبوعات|Publishing|J|58|media
film-tv-production|الإنتاج السينمائي والتلفزيوني والموسيقي|Film, TV and Music Production|J|59|media
broadcasting|البث الإذاعي والتلفزيوني|Broadcasting|J|60|media
telecom|الاتصالات|Telecommunications|J|61|it
software-it-services|البرمجيات وخدمات تقنية المعلومات|Software and IT Services|J|62|it
data-hosting-cloud|معالجة البيانات والاستضافة والحوسبة السحابية|Data Processing, Hosting and Cloud|J|63|it
telecom-it|الاتصالات وتقنية المعلومات|Telecom and Information Technology|J||it
ai-data|الذكاء الاصطناعي والبيانات|Artificial Intelligence and Data|J|62|it
cybersecurity|الأمن السيبراني|Cybersecurity|J|62|it
gaming-esports|الألعاب الإلكترونية والرياضات الإلكترونية|Gaming and Esports|J|582|media
media-marketing|الإعلام والتسويق|Media and Marketing|J||media
banking|البنوك|Banking|K|64|finance
financing-leasing|شركات التمويل والتأجير التمويلي|Finance and Leasing Companies|K|649|finance
insurance|التأمين والتكافل|Insurance and Takaful|K|65|finance
capital-markets|أسواق المال وإدارة الأصول|Capital Markets and Asset Management|K|66|finance
vc-private-equity|رأس المال الجريء والملكية الخاصة|Venture Capital and Private Equity|K|66|finance
fintech|التقنية المالية (فنتك)|Financial Technology (Fintech)|K||finance
real-estate-development|التطوير العقاري|Real Estate Development|L|68|real-estate
real-estate-services|الوساطة العقارية وإدارة الأملاك|Real Estate Brokerage and Property Management|L|68|real-estate
real-estate|العقارات|Real Estate (general)|L|68|real-estate
legal-services|الخدمات القانونية|Legal Services|M|691|legal
accounting-audit|المحاسبة والمراجعة والزكاة والضريبة|Accounting, Audit and Tax|M|692|finance
management-consulting|استشارات الإدارة والأعمال|Management Consulting|M|70|admin
architecture-engineering|الاستشارات الهندسية والمعمارية|Architecture and Engineering Consultancy|M|711|engineering
testing-inspection|الفحص والاختبار والتفتيش والاعتماد|Testing, Inspection and Certification|M|712|engineering
rnd-scientific|البحث والتطوير العلمي|Scientific Research and Development|M|72|science
advertising-market-research|الإعلان وأبحاث السوق|Advertising and Market Research|M|73|sales-marketing
design-creative|التصميم والتصوير والخدمات الإبداعية|Design, Photography and Creative Services|M|74|media
veterinary-services|الخدمات البيطرية|Veterinary Services|M|75|agriculture
professional-services|الخدمات المهنية والاستشارات|Professional Services and Consulting|M||admin
equipment-rental|تأجير المعدات والسيارات|Equipment and Vehicle Rental|N|77|other
staffing-recruitment|التوظيف والاستقدام والقوى العاملة|Staffing, Recruitment and Manpower|N|78|hr
security-services|خدمات الحراسة والأمن|Security and Investigation Services|N|80|security
facility-management|إدارة المرافق والنظافة|Facility Management and Cleaning|N|81|other
business-support-bpo|خدمات الأعمال المساندة ومراكز الاتصال|Business Support, BPO and Call Centres|N|82|admin
events-exhibitions|الفعاليات والمعارض والمؤتمرات|Events, Exhibitions and Conferences|N|823|hospitality
government|الحكومة والقطاع العام|Government and Public Administration|O|84|government
defense-security|الدفاع والأمن|Defence and Security|O|842|security
education|التعليم العام والحضانات|School and Early Education|P|85|education
higher-education|التعليم العالي والجامعات|Higher Education|P|854|education
training-vocational|التدريب والتعليم المهني|Training and Vocational Education|P|855|education
edtech|التقنية التعليمية|Education Technology|P||education
healthcare|الرعاية الصحية|Healthcare|Q|86|health
hospitals|المستشفيات|Hospitals|Q|861|health
clinics|العيادات والمجمعات الطبية|Clinics and Medical Centres|Q|862|health
diagnostics-labs|المختبرات والتشخيص والأشعة|Diagnostic Laboratories and Imaging|Q|869|health
healthtech|التقنية الصحية|Health Technology|Q||health
social-care|الرعاية الاجتماعية والتأهيل|Social Care and Rehabilitation|Q|87|health
arts-entertainment|الفنون والترفيه|Arts and Entertainment|R|90|media
sports-recreation|الرياضة والأنشطة الترفيهية|Sports and Recreation|R|93|other
nonprofit|المنظمات غير الربحية والجمعيات الخيرية|Non-profit Organisations and Charities|S|94|government
beauty-wellness|التجميل والعناية والعافية|Beauty and Wellness|S|9602|beauty
personal-services|الخدمات الشخصية (مغاسل وخياطة وغيرها)|Personal Services|S|96|other
repair-services|إصلاح الأجهزة والسلع المنزلية|Repair of Computers and Household Goods|S|95|trades
household-domestic|العمالة المنزلية والأسر|Households as Employers (Domestic Work)|T|97|household
international-organizations|المنظمات الدولية والسفارات|International Organisations and Embassies|U|99|government
`);

function buildSectors() {
  const secs = new Set(ISIC_SECTIONS.map((s) => s[0]));
  const ids = new Set();
  return SECTORS.map((l) => {
    const p = l.split("|");
    if (p.length !== 6) fail("سطر قطاع غير صالح: " + l);
    const [id, ar, en, section, isic, eor] = p;
    if (!secs.has(section)) fail("قسم ISIC غير معروف: " + section);
    if (ids.has(id)) fail("قطاع مكرر: " + id);
    ids.add(id);
    const o = { id, ar, en, section };
    if (isic) o.isic = isic; else o.composite = true;
    o.eor_sector = eor;
    return o;
  });
}

/* ═════════════ ٤) مستويات الوظيفة ═════════════ */
const SENIORITY = [
  ["c-level", "رئيس تنفيذي / مجلس تنفيذي", "C-level / Chief Executive", "c"],
  ["director", "مدير عام / Director", "Director", "d"],
  ["manager", "مدير", "Manager", "m"],
  ["team-lead", "رئيس قسم / قائد فريق", "Head of Section / Team Lead", "l"],
  ["executive", "تنفيذي / أخصائي", "Executive / Specialist", "x"],
  ["senior", "خبرة عالية (Senior)", "Senior", "s"],
  ["mid", "متوسط الخبرة", "Mid-level", "i"],
  ["entry", "مبتدئ (Entry / Junior)", "Entry / Junior", "j"],
  ["labor", "عمالة", "Labor / Skilled Worker", "b"],
];
const SEN_BY_KEY = Object.fromEntries(SENIORITY.map((s) => [s[3], s[0]]));

/* ═════════════ ٥) مجموعات ISCO-08 ═════════════ */
const ISCO_MAJOR = [
  ["0", "القوات المسلحة", "Armed forces occupations"],
  ["1", "المديرون", "Managers"],
  ["2", "المهنيون", "Professionals"],
  ["3", "الفنيون والمهنيون المساعدون", "Technicians and associate professionals"],
  ["4", "موظفو الدعم المكتبي", "Clerical support workers"],
  ["5", "عاملو الخدمات والمبيعات", "Service and sales workers"],
  ["6", "مزارعون وعاملو الحراجة والصيد المهرة", "Skilled agricultural, forestry and fishery workers"],
  ["7", "الحرفيون وعاملو الحرف ذات الصلة", "Craft and related trades workers"],
  ["8", "مشغّلو المصانع والآلات والمجمّعون", "Plant and machine operators and assemblers"],
  ["9", "المهن الأولية (العمالة)", "Elementary occupations"],
];
const ISCO_SUB = [
  ["01", "ضباط القوات المسلحة", "Commissioned armed forces officers"],
  ["02", "ضباط الصف", "Non-commissioned armed forces officers"],
  ["03", "أفراد القوات المسلحة الآخرون", "Armed forces occupations, other ranks"],
  ["11", "كبار المديرين والمسؤولين والمشرّعين", "Chief executives, senior officials and legislators"],
  ["12", "مديرو الإدارة والأعمال التجارية", "Administrative and commercial managers"],
  ["13", "مديرو الإنتاج والخدمات المتخصصة", "Production and specialized services managers"],
  ["14", "مديرو الضيافة والتجزئة والخدمات الأخرى", "Hospitality, retail and other services managers"],
  ["21", "مهنيو العلوم والهندسة", "Science and engineering professionals"],
  ["22", "مهنيو الصحة", "Health professionals"],
  ["23", "مهنيو التدريس", "Teaching professionals"],
  ["24", "مهنيو الأعمال والإدارة", "Business and administration professionals"],
  ["25", "مهنيو تقنية المعلومات والاتصالات", "Information and communications technology professionals"],
  ["26", "مهنيو القانون والعلوم الاجتماعية والثقافة", "Legal, social and cultural professionals"],
  ["31", "فنيو العلوم والهندسة", "Science and engineering associate professionals"],
  ["32", "فنيو الصحة", "Health associate professionals"],
  ["33", "فنيو الأعمال والإدارة", "Business and administration associate professionals"],
  ["34", "فنيو القانون والخدمات الاجتماعية والثقافية", "Legal, social, cultural and related associate professionals"],
  ["35", "فنيو تقنية المعلومات والاتصالات", "Information and communications technicians"],
  ["41", "كتبة المكاتب العامة والسكرتارية", "General and keyboard clerks"],
  ["42", "موظفو خدمة العملاء", "Customer services clerks"],
  ["43", "موظفو السجلات الرقمية والمادية", "Numerical and material recording clerks"],
  ["44", "موظفو دعم مكتبي آخرون", "Other clerical support workers"],
  ["51", "عاملو الخدمات الشخصية", "Personal services workers"],
  ["52", "عاملو المبيعات", "Sales workers"],
  ["53", "عاملو الرعاية الشخصية", "Personal care workers"],
  ["54", "عاملو خدمات الحماية", "Protective services workers"],
  ["61", "مزارعون مهرة موجّهون للسوق", "Market-oriented skilled agricultural workers"],
  ["62", "عاملو الحراجة والصيد مهرة موجّهون للسوق", "Market-oriented skilled forestry, fishery and hunting workers"],
  ["63", "مزارعون وصيادون لإعالة الأسرة", "Subsistence farmers, fishers, hunters and gatherers"],
  ["71", "عاملو البناء والحرف ذات الصلة (عدا الكهربائيين)", "Building and related trades workers, excluding electricians"],
  ["72", "عاملو المعادن والآلات والحرف ذات الصلة", "Metal, machinery and related trades workers"],
  ["73", "عاملو الحرف اليدوية والطباعة", "Handicraft and printing workers"],
  ["74", "عاملو الكهرباء والإلكترونيات", "Electrical and electronic trades workers"],
  ["75", "عاملو تصنيع الأغذية والأخشاب والملابس والحرف الأخرى", "Food processing, wood working, garment and other craft and related trades workers"],
  ["81", "مشغّلو المصانع والآلات الثابتة", "Stationary plant and machine operators"],
  ["82", "عاملو التجميع", "Assemblers"],
  ["83", "السائقون ومشغّلو المعدات المتحركة", "Drivers and mobile plant operators"],
  ["91", "عاملو النظافة والمساعدون", "Cleaners and helpers"],
  ["92", "عمال الزراعة والحراجة والصيد", "Agricultural, forestry and fishery labourers"],
  ["93", "عمال المناجم والبناء والتصنيع والنقل", "Labourers in mining, construction, manufacturing and transport"],
  ["94", "مساعدو تحضير الطعام", "Food preparation assistants"],
  ["95", "عاملو الشوارع والخدمات المرتبطة", "Street and related sales and service workers"],
  ["96", "عمال النفايات وأعمال بسيطة أخرى", "Refuse workers and other elementary workers"],
];

/* ═════════════ ٦) المهن ═════════════
 * السطر: slug|English|العربي|ISCO(4 أرقام)|مستويات|قطاعات|existing_id
 *   المستويات (حرف لكل مستوى، مفصولة بفاصلة): c=رئيس تنفيذي d=مدير عام m=مدير l=رئيس قسم x=تنفيذي/أخصائي
 *                                              s=سينيور i=متوسط j=مبتدئ b=عمالة
 *   القطاعات: معرّفات من sectors مفصولة بفاصلة، و«*» = كل القطاعات، و@اسم = مجموعة معرّفة في GROUPS.
 *   الرأس "# بادئة" يحدد بادئة المعرّف حتى الرأس التالي. */
const GROUPS = {
  fin: "banking,financing-leasing,insurance,capital-markets,vc-private-equity,fintech",
  hosp: "hotels-resorts,restaurants-cafes,catering-services,tourism-hospitality",
  health: "healthcare,hospitals,clinics,diagnostics-labs",
  ind: "manufacturing,food-manufacturing,chemicals,petrochemicals,plastics-rubber,building-materials,metals-manufacturing,fabricated-metal,machinery-equipment,automotive-manufacturing,other-manufacturing",
  con: "contracting,construction-buildings,construction-infrastructure,construction-specialty",
  energy: "oil-gas-upstream,oilfield-services,refining,petrochemicals,power-utilities,renewable-energy",
  it: "telecom-it,software-it-services,data-hosting-cloud,telecom,ai-data,cybersecurity",
  retail: "retail,supermarkets,ecommerce,fmcg,wholesale",
  log: "logistics,warehousing,road-transport,courier-postal",
  edu: "education,higher-education,training-vocational",
  media: "media-marketing,advertising-market-research,film-tv-production,broadcasting,publishing,design-creative",
  gov: "government,defense-security",
  mining: "mining,mining-metals,mining-quarrying",
  re: "real-estate,real-estate-development,real-estate-services",
  pro: "professional-services,management-consulting,legal-services,accounting-audit",
  agri: "agri-crops,agri-livestock,forestry,fishing-aquaculture",
};
const OCC_TABLE = String.raw`
@@mgmt
ceo|Chief Executive Officer (CEO)|الرئيس التنفيذي (CEO)|1120|c|*|mgmt.ceo
managing-director|Managing Director|العضو المنتدب|1120|c|*|
general-manager|General Manager|مدير عام|1120|d|*|mgmt.general-manager
country-manager|Country Manager|مدير الدولة (المملكة)|1120|d|*|
vice-president|Vice President|نائب الرئيس|1120|d|*|
assistant-general-manager|Assistant General Manager|مساعد المدير العام|1120|d,m|*|
coo|Chief Operating Officer (COO)|الرئيس التنفيذي للعمليات (COO)|1120|c|*|mgmt.coo
cmo|Chief Marketing Officer (CMO)|الرئيس التنفيذي للتسويق (CMO)|1221|c|*|
cto|Chief Technology Officer (CTO)|الرئيس التنفيذي للتقنية (CTO)|1330|c|*|
cio|Chief Information Officer (CIO)|الرئيس التنفيذي للمعلومات (CIO)|1330|c|*|
ciso|Chief Information Security Officer (CISO)|رئيس أمن المعلومات (CISO)|1330|c,d|*|
chro|Chief Human Resources Officer (CHRO)|الرئيس التنفيذي للموارد البشرية (CHRO)|1212|c|*|
chief-commercial-officer|Chief Commercial Officer (CCO)|الرئيس التنفيذي للشؤون التجارية|1221|c|*|
chief-strategy-officer|Chief Strategy Officer (CSO)|الرئيس التنفيذي للاستراتيجية|1213|c|*|
chief-product-officer|Chief Product Officer (CPO)|الرئيس التنفيذي للمنتجات|1219|c|*|
chief-data-officer|Chief Data Officer (CDO)|رئيس البيانات التنفيذي|1330|c,d|*|
chief-risk-officer|Chief Risk Officer (CRO)|رئيس المخاطر التنفيذي|1211|c,d|*|
chief-compliance-officer|Chief Compliance Officer|رئيس الالتزام التنفيذي|1219|c,d|*|
general-counsel|General Counsel / Chief Legal Officer|المستشار القانوني العام|1219|c,d|*|
chief-procurement-officer|Chief Procurement Officer|رئيس المشتريات التنفيذي|1324|c,d|*|
chief-sales-officer|Chief Sales Officer|رئيس المبيعات التنفيذي|1221|c,d|*|
chief-digital-officer|Chief Digital Officer|رئيس التحول الرقمي التنفيذي|1330|c,d|*|
chief-of-staff|Chief of Staff|رئيس مكتب الرئيس التنفيذي|1219|d,m|*|
business-owner|Business Owner / Founder|مالك / مؤسس منشأة|1120|c|*|mgmt.owner
executive-advisor|Executive Advisor|مستشار تنفيذي|2421|d,s|*|
board-secretary|Board / Company Secretary|أمين سر مجلس الإدارة|3343|x,s|*|
department-head|Head of Department|رئيس قسم|1219|l,m|*|
director-of-department|Director of Department|مدير إدارة|1219|d,m|*|
@@strat
strategy-manager|Strategy Manager|مدير الاستراتيجية|1213|m,l|*|
strategy-analyst|Strategy Analyst|محلل استراتيجي|2421|x,s,i,j|*|
corporate-development-manager|Corporate Development / M&A Manager|مدير تطوير الشركات والاندماج والاستحواذ|1213|m,l|*|
management-consultant|Management Consultant|استشاري إدارة أعمال|2421|x,s,i,j|@pro,*|
business-consultant|Business Consultant|مستشار أعمال|2421|x,s,i|*|
digital-transformation-manager|Digital Transformation Manager|مدير التحول الرقمي|1330|m,l|*|
innovation-manager|Innovation Manager|مدير الابتكار|1213|m,l|*|
change-management-specialist|Change Management Specialist|أخصائي إدارة التغيير|2421|x,s,i|*|
business-excellence-specialist|Business Excellence / Lean Six Sigma Specialist|أخصائي التميز المؤسسي (لين سيجما)|2421|x,s,i|*|
process-improvement-specialist|Process Improvement Specialist|أخصائي تحسين العمليات|2421|x,s,i,j|*|
business-process-analyst|Business Process Analyst|محلل عمليات الأعمال|2421|x,s,i,j|*|
business-continuity-manager|Business Continuity Manager|مدير استمرارية الأعمال|1219|m,l|*|
esg-manager|ESG / Sustainability Manager|مدير الاستدامة والحوكمة البيئية والاجتماعية (ESG)|1219|m,l|*|
sustainability-specialist|Sustainability Specialist|أخصائي استدامة|2133|x,s,i,j|*|
corporate-governance-officer|Corporate Governance Officer|مسؤول حوكمة الشركات|2422|x,s,i|*|
investor-relations-manager|Investor Relations Manager|مدير علاقات المستثمرين|1219|m,l|@fin,*|
corporate-affairs-manager|Corporate Affairs Manager|مدير الشؤون المؤسسية|1219|m,l|*|
@@pm
project-director|Project Director|مدير عام المشاريع|1219|d|*|
project-manager|Project Manager|مدير مشاريع|1219|m,s,i|*|project.manager
program-manager|Program Manager|مدير برامج|1219|m,d|*|
pmo-manager|PMO Manager|مدير مكتب إدارة المشاريع (PMO)|1219|m,d|*|projectctrl.manager
pmo-analyst|PMO Analyst|محلل مكتب إدارة المشاريع|2421|x,s,i,j|*|projectctrl.manager
project-coordinator|Project Coordinator|منسق مشاريع|3343|x,s,i,j|*|project.specialist
project-supervisor|Project Supervisor|مشرف مشاريع|3123|l|*|project.supervisor
project-planner|Project Planner / Scheduler|مخطط جداول مشاريع (Planner)|3112|x,s,i,j|@con,@energy,@it,*|
@@adm
government-relations-officer|Government Relations Officer (PRO)|مسؤول علاقات حكومية|3339|x,s,i,j|*|adm.government-relations
muaqqib|Government Transactions Clerk (Muaqqib)|معقّب معاملات حكومية|4419|i,j,b|*|adm.government-relations
@@fin
cfo|Chief Financial Officer (CFO)|الرئيس التنفيذي المالي (CFO)|1211|c|*|fin.cfo
finance-director|Finance Director|مدير عام الشؤون المالية|1211|d|*|
finance-manager|Finance Manager|مدير مالي|1211|m|*|fin.finance-manager
financial-controller|Financial Controller|مراقب مالي|1211|m,l|*|fin.financial-controller
accounting-manager|Accounting Manager|مدير حسابات|1211|m|*|
chief-accountant|Chief Accountant|محاسب رئيسي|2411|l,m|*|fin.chief-accountant
accounting-supervisor|Accounting Supervisor|مشرف محاسبة|2411|l|*|fin.accounting-supervisor
accountant|Accountant|محاسب|2411|x,s,i,j|*|fin.accountant
assistant-accountant|Assistant Accountant|مساعد محاسب|3313|j,i|*|
bookkeeper|Bookkeeper|ماسك دفاتر|4311|i,j|*|
general-ledger-accountant|General Ledger Accountant|محاسب أستاذ عام|2411|x,s,i|*|
accounts-payable-accountant|Accounts Payable Accountant|محاسب ذمم دائنة|2411|x,s,i,j|*|fin.accounts-receivable-payable
accounts-receivable-accountant|Accounts Receivable Accountant|محاسب ذمم مدينة|2411|x,s,i,j|*|fin.accounts-receivable-payable
cost-accountant|Cost Accountant|محاسب تكاليف|2411|x,s,i,j|@ind,@con,@energy,@hosp,@retail,@log|fin.cost-controller
cost-controller|Cost Controller|مراقب تكاليف|2411|l,m|*|fin.cost-controller
fixed-assets-accountant|Fixed Assets Accountant|محاسب أصول ثابتة|2411|x,s,i|*|
financial-reporting-specialist|Financial Reporting (IFRS) Specialist|أخصائي تقارير مالية (IFRS)|2411|x,s,i|*|
forensic-accountant|Forensic Accountant|محاسب جنائي (قضائي)|2411|x,s|@pro,@fin,government|
cash-officer|Cash Officer|مسؤول نقدية|4211|i,j|*|
financial-analyst|Financial Analyst|محلل مالي|2413|x,s,i,j|*|fin.financial-analyst
fpa-manager|FP&A Manager|مدير التخطيط والتحليل المالي|1211|m,l|*|
budget-specialist|Budgeting Specialist|أخصائي موازنات|2413|x,s,i|*|
treasury-manager|Treasury Manager|مدير خزينة|1211|m|*|
treasury-specialist|Treasury Specialist|أخصائي خزينة|2413|x,s,i|*|fin.treasury
tax-manager|Tax and Zakat Manager|مدير الضرائب والزكاة|1211|m|*|
tax-specialist|Tax / Zakat Specialist|أخصائي ضرائب وزكاة|2411|x,s,i,j|*|fin.tax-specialist
external-auditor|External Auditor|مراجع حسابات خارجي|2411|x,s,i,j|accounting-audit,@pro|fin.auditor
internal-auditor|Internal Auditor|مراجع داخلي|2411|x,s,i,j|*|fin.internal-auditor
audit-manager|Audit Manager|مدير مراجعة|1211|m,l|*|fin.audit-manager
audit-associate|Audit Associate|مساعد مراجع|3313|j|accounting-audit,@pro|
it-auditor|IT Auditor|مراجع تقنية معلومات|2411|x,s,i|*|
credit-analyst|Credit Analyst|محلل ائتمان|3312|x,s,i,j|@fin|fin.credit-analyst
credit-manager|Credit Manager|مدير ائتمان|1346|m,l|*|
collections-officer|Collections Officer|مسؤول تحصيل|4214|x,i,j|*|fin.collections
loan-officer|Loan / Financing Officer|مسؤول تمويل|3312|x,s,i,j|@fin|
mortgage-advisor|Mortgage Advisor|مستشار تمويل عقاري|3312|x,s,i|banking,financing-leasing,@re|
relationship-manager|Relationship Manager|مدير علاقات عملاء|2412|m,s,i|banking,financing-leasing,insurance,capital-markets|fin.relationship-manager
corporate-banking-manager|Corporate Banking Relationship Manager|مدير علاقات الشركات (مصرفي)|2412|m,s|banking|fin.relationship-manager
personal-banker|Personal Banker|موظف خدمات مصرفية للأفراد|3312|x,i,j|banking|
bank-teller|Bank Teller|صرّاف بنك|4211|i,j|banking|fin.bank-teller
banking-customer-service|Banking Customer Service Officer|موظف خدمة عملاء مصرفية|4222|i,j|banking,fintech|
bank-branch-manager|Bank Branch Manager|مدير فرع بنك|1346|m|banking|
investment-analyst|Investment Analyst|محلل استثمار|2413|x,s,i,j|@fin|fin.investment-analyst
investment-manager|Investment Manager|مدير استثمار|2412|m,s|@fin,@re|fin.investment-analyst
portfolio-manager|Portfolio Manager|مدير محافظ استثمارية|2412|m,s|capital-markets,banking,insurance|
wealth-manager|Wealth Manager / Private Banker|مدير ثروات|2412|m,s|banking,capital-markets|
equity-research-analyst|Equity Research Analyst|محلل أبحاث أسهم|2413|x,s,i,j|capital-markets,banking|
securities-broker|Securities Broker|وسيط أوراق مالية|3311|x,s,i,j|capital-markets,banking|
financial-trader|Financial Trader|متداول أدوات مالية|3311|x,s,i|capital-markets,banking|
investment-banking-analyst|Investment Banking Analyst|محلل خدمات مصرفية استثمارية|2413|x,s,i,j|banking,capital-markets|
fund-accountant|Fund Accountant|محاسب صناديق استثمارية|2411|x,s,i|capital-markets|
private-equity-associate|Private Equity / VC Associate|مساعد استثمار (ملكية خاصة / رأس مال جريء)|2413|s,i,j|vc-private-equity,capital-markets|
financial-advisor|Financial Advisor|مستشار مالي|2412|x,s,i|@fin,@pro|fin.financial-advisor
economist|Economist|اقتصادي|2631|x,s,i,j|@fin,government,rnd-scientific|fin.economist
insurance-agent|Insurance Agent / Advisor|مستشار / وكيل تأمين|3321|x,s,i,j|insurance|fin.insurance-agent
underwriter|Underwriter|مكتتب تأمين|3321|x,s,i,j|insurance|fin.insurance-agent
claims-adjuster|Claims Adjuster / Loss Assessor|مقدّر خسائر ومطالبات|3315|x,s,i,j|insurance|fin.insurance-claims
insurance-claims-specialist|Insurance Claims Specialist|أخصائي مطالبات تأمين|3321|x,s,i,j|insurance,@health|fin.insurance-claims
actuary|Actuary|خبير اكتواري|2120|x,s,i,j|insurance|
insurance-operations-manager|Insurance Operations Manager|مدير عمليات التأمين|1346|m|insurance|
risk-analyst|Risk Analyst|محلل مخاطر|2413|x,s,i,j|*|fin.risk-analyst
risk-manager|Risk Manager|مدير مخاطر|1211|m,l|*|fin.risk-analyst
operational-risk-officer|Operational Risk Officer|مسؤول مخاطر تشغيلية|2413|x,s,i|*|
compliance-officer|Compliance Officer|مسؤول التزام وامتثال|2422|x,s,i,j|*|fin.compliance-officer
compliance-manager|Compliance Manager|مدير الالتزام والامتثال|1219|m,l|*|fin.compliance-officer
aml-kyc-analyst|AML / KYC Analyst|محلل مكافحة غسل الأموال واعرف عميلك|2413|x,s,i,j|@fin|fin.compliance-officer
sharia-compliance-officer|Sharia Compliance Officer|مسؤول مراقبة شرعية|2422|x,s,i|@fin|
payments-operations-specialist|Payments Operations Specialist|أخصائي عمليات مدفوعات|4312|x,i,j|fintech,banking|
fintech-product-manager|Fintech Product Manager|مدير منتج مالي رقمي|1219|m,s|fintech,banking|
@@hr
hr-director|HR Director|مدير عام الموارد البشرية|1212|d|*|
hr-manager|HR Manager|مدير موارد بشرية|1212|m|*|hr.manager
hr-business-partner|HR Business Partner (HRBP)|شريك أعمال موارد بشرية (HRBP)|2423|x,s,m|*|hr.hrbp
hr-supervisor|HR Supervisor|مشرف موارد بشرية|2423|l|*|hr.supervisor
hr-specialist|HR Specialist|أخصائي موارد بشرية|2423|x,s,i,j|*|hr.specialist
hr-assistant|HR Assistant|مساعد موارد بشرية|4416|j,i|*|
employee-affairs-officer|Employee Affairs Officer|مسؤول شؤون موظفين|4416|x,i,j|*|hr.employee-affairs
recruiter|Recruiter / Talent Acquisition Specialist|أخصائي توظيف واستقطاب|2423|x,s,i,j|*|hr.recruiter
recruitment-manager|Talent Acquisition Manager|مدير التوظيف والاستقطاب|1212|m,l|*|hr.recruitment-manager
recruitment-coordinator|Recruitment Coordinator|منسق توظيف|4416|x,i,j|*|hr.recruiter
executive-search-consultant|Executive Search Consultant|مستشار استقطاب تنفيذي (باحث عن الكفاءات)|3333|x,s,i|staffing-recruitment,@pro|hr.recruiter
istiqdam-officer|Recruitment from Abroad (Istiqdam) Officer|مسؤول استقدام|3333|x,i,j|staffing-recruitment|
payroll-specialist|Payroll Specialist|أخصائي رواتب|4313|x,s,i,j|*|hr.compensation
payroll-manager|Payroll Manager|مدير رواتب|1212|m,l|*|hr.compensation-manager
compensation-benefits-specialist|Compensation and Benefits Specialist|أخصائي تعويضات ومزايا|2423|x,s,i|*|hr.compensation
compensation-benefits-manager|Compensation and Benefits Manager|مدير التعويضات والمزايا|1212|m,l|*|hr.compensation-manager
training-manager|Training and Development Manager|مدير تدريب وتطوير|1212|m,l|*|hr.training-manager
trainer|Corporate Trainer|مدرب مؤسسي|2424|x,s,i,j|*|hr.trainer
learning-development-specialist|Learning and Development Specialist|أخصائي تعلّم وتطوير|2424|x,s,i,j|*|hr.trainer
organizational-development-specialist|Organizational Development Specialist|أخصائي تطوير تنظيمي|2421|x,s,i|*|
talent-management-specialist|Talent Management Specialist|أخصائي إدارة المواهب|2423|x,s,i|*|
employee-relations-specialist|Employee Relations Specialist|أخصائي علاقات موظفين|2423|x,s,i|*|
hr-analyst|HR Analytics Specialist|محلل بيانات موارد بشرية|2423|x,s,i,j|*|
hris-specialist|HRIS Specialist|أخصائي أنظمة موارد بشرية|2423|x,s,i|*|
saudization-specialist|Saudization (Nitaqat) Specialist|أخصائي توطين ونطاقات|2423|x,s,i|*|
gosi-government-affairs-officer|GOSI and Government Affairs Officer|مسؤول تأمينات اجتماعية وشؤون حكومية|4416|x,i,j|*|
timekeeper|Timekeeper|مراقب دوام|4416|i,j|*|
@@sales
sales-director|Sales Director|مدير عام المبيعات|1221|d|*|sales.director
sales-manager|Sales Manager|مدير مبيعات|1221|m|*|sales.manager
regional-sales-manager|Regional Sales Manager|مدير مبيعات إقليمي|1221|m,d|*|sales.manager
sales-supervisor|Sales Supervisor|مشرف مبيعات|1221|l|*|sales.supervisor
key-account-manager|Key Account Manager|مدير حسابات رئيسية|1221|m,l,s|*|sales.account-manager
account-manager|Account Manager|مدير حسابات العملاء|3322|x,s,i|*|sales.account-manager
sales-executive|Sales Executive / Representative|ممثل مبيعات|3322|x,s,i,j|*|sales.sales-executive
field-sales-representative|Field Sales Representative|مندوب مبيعات ميداني|3322|x,i,j|*|sales.sales-executive
inside-sales-representative|Inside Sales Representative|مندوب مبيعات داخلي|3322|x,i,j|*|sales.sales-executive
telesales-agent|Telesales Agent|مندوب مبيعات هاتفية|5244|i,j|*|sales.telesales
sales-coordinator|Sales Coordinator|منسق مبيعات|4419|x,i,j|*|sales.sales-coordinator
sales-engineer|Sales Engineer|مهندس مبيعات|2433|x,s,i,j|@ind,@con,@energy,@it,electrical-equipment,electronics-manufacturing,medical-devices|sales.sales-engineer
presales-consultant|Pre-sales Consultant|استشاري ما قبل البيع|2434|x,s,i|@it,medical-devices|
business-development-manager|Business Development Manager|مدير تطوير الأعمال|1221|m,l,s|*|sales.business-development-manager
business-development-specialist|Business Development Specialist|أخصائي تطوير أعمال|3339|x,s,i,j|*|sales.business-development-specialist
tender-specialist|Tender / Bid Specialist|أخصائي مناقصات|3339|x,s,i,j|@con,@energy,@it,@pro,@gov|
bid-manager|Bid Manager|مدير مناقصات|1219|m,l|@con,@energy,@it,@pro|
sales-operations-analyst|Sales Operations Analyst|محلل عمليات مبيعات|3339|x,s,i,j|*|
customer-success-manager|Customer Success Manager|مدير نجاح العملاء|3339|m,x,s,i|@it,fintech,ecommerce|
medical-representative|Medical Representative|مندوب دعاية طبية|2433|x,s,i,j|pharma-manufacturing,medical-devices,pharmacies,@health|sales.medical-rep
e-commerce-manager|E-commerce Manager|مدير تجارة إلكترونية|1420|m,l|ecommerce,retail,fmcg|sales.e-commerce-manager
e-commerce-specialist|E-commerce Specialist|أخصائي تجارة إلكترونية|3339|x,s,i,j|ecommerce,retail,fmcg|sales.e-commerce-specialist
marketplace-account-manager|Marketplace Account Manager|مدير حسابات متاجر إلكترونية (ماركت بليس)|3322|x,s,i|ecommerce,fmcg,retail|
online-catalog-specialist|Online Catalogue Specialist|أخصائي كتالوج منتجات إلكتروني|4419|x,i,j|ecommerce,retail|
pricing-analyst|Pricing Analyst|محلل تسعير|2413|x,s,i|@retail,@log,@hosp,@fin|
@@mkt
marketing-director|Marketing Director|مدير عام التسويق|1221|d|*|
marketing-manager|Marketing Manager|مدير تسويق|1221|m|*|marketing.manager
marketing-supervisor|Marketing Supervisor|مشرف تسويق|1221|l|*|marketing.supervisor
marketing-specialist|Marketing Specialist|أخصائي تسويق|2431|x,s,i,j|*|marketing.specialist
marketing-coordinator|Marketing Coordinator|منسق تسويق|3339|x,i,j|*|marketing.specialist
marketing-analyst|Marketing Analyst|محلل تسويقي|2431|x,s,i,j|*|marketing.specialist
product-marketing-manager|Product Marketing Manager|مدير تسويق المنتجات|1221|m,l|*|
product-specialist|Product Specialist|أخصائي منتج|2433|x,s,i,j|*|product.specialist
digital-marketing-manager|Digital Marketing Manager|مدير تسويق رقمي|1221|m,l|*|mkt.digital-marketing-manager
digital-marketing-specialist|Digital Marketing Specialist|أخصائي تسويق رقمي|2431|x,s,i,j|*|mkt.digital-marketing-specialist
performance-marketing-specialist|Performance Marketing Specialist|أخصائي حملات إعلانية مدفوعة|2431|x,s,i|*|mkt.digital-marketing-specialist
seo-specialist|SEO Specialist|أخصائي تحسين محركات البحث (SEO)|2431|x,s,i,j|*|mkt.digital-marketing-specialist
crm-marketing-specialist|CRM Marketing Specialist|أخصائي تسويق علاقات العملاء|2431|x,s,i|*|
social-media-manager|Social Media Manager|مدير وسائل التواصل الاجتماعي|1221|m,l|*|social.manager
social-media-specialist|Social Media Specialist|أخصائي وسائل التواصل الاجتماعي|2431|x,s,i,j|*|social.specialist
community-manager|Community Manager|مدير مجتمع رقمي|2431|x,s,i|*|mkt.community-manager
influencer-marketing-specialist|Influencer Marketing Specialist|أخصائي تسويق المؤثرين|2431|x,s,i|*|
content-writer|Content Writer|كاتب محتوى|2641|x,s,i,j|*|mkt.content-writer
content-creator|Content Creator|صانع محتوى|2641|x,s,i,j|*|mkt.content-writer
copywriter|Copywriter|كاتب إعلاني|2641|x,s,i,j|*|mkt.content-writer
brand-manager|Brand Manager|مدير علامة تجارية|1221|m,l,s|*|mkt.brand-manager
market-research-specialist|Market Research Specialist|أخصائي أبحاث السوق|2431|x,s,i,j|*|mkt.market-research
survey-interviewer|Survey / Market Research Interviewer|باحث ميداني (استبيانات)|4227|i,j,b|*|
advertising-manager|Advertising Manager|مدير إعلانات|1222|m,l|*|
media-planner-buyer|Media Planner / Buyer|مخطط ومشتري وسائل إعلام|2431|x,s,i|advertising-market-research,media-marketing|
agency-account-executive|Advertising Account Executive|مسؤول حسابات إعلانية (وكالة)|2431|x,s,i,j|advertising-market-research,media-marketing|
creative-director|Creative Director|مدير إبداعي|1222|d,m|advertising-market-research,media-marketing,design-creative|
art-director|Art Director|مدير فني|2166|m,s|@media,design-creative|
pr-manager|Public Relations Manager|مدير علاقات عامة|1222|m|*|pr.manager
pr-supervisor|Public Relations Supervisor|مشرف علاقات عامة|1222|l|*|pr.supervisor
pr-specialist|Public Relations Specialist|أخصائي علاقات عامة|2432|x,s,i,j|*|pr.specialist
communications-manager|Communications Manager|مدير اتصال مؤسسي|1222|m,l|*|comm.manager
communications-specialist|Communications Specialist|أخصائي اتصال مؤسسي|2432|x,s,i,j|*|comm.specialist
promoter|Sales Promoter|مروّج مبيعات|5242|j,b|@retail,fmcg|
@@fmcg
area-sales-manager|Area Sales Manager (FMCG)|مدير مبيعات منطقة (سلع استهلاكية)|1221|m,l|fmcg,wholesale,food-manufacturing,beverages|sales.manager
trade-marketing-manager|Trade Marketing Manager|مدير تسويق تجاري|1221|m,l|fmcg,food-manufacturing,beverages,retail|
trade-marketing-specialist|Trade Marketing Specialist|أخصائي تسويق تجاري|2431|x,s,i|fmcg,food-manufacturing,beverages,retail|
category-manager|Category Manager|مدير فئة منتجات|1221|m,l|@retail|
modern-trade-executive|Modern Trade Key Account Executive|مسؤول حسابات التجزئة الحديثة|3322|x,s,i|fmcg,wholesale,supermarkets|
van-sales-representative|Van Sales Representative|مندوب مبيعات سيارة (فان سيل)|3322|i,j|fmcg,wholesale,food-manufacturing,beverages|sales.sales-executive
distribution-manager|Distribution Manager|مدير توزيع|1324|m,l|fmcg,wholesale,@log|
retail-auditor|Retail Auditor|مدقق منافذ بيع|4227|i,j|fmcg,retail|
merchandiser|Merchandiser|منسّق عرض وتسويق منتجات|5249|i,j|@retail|ret.merchandiser
@@ret
store-manager|Store / Showroom Manager|مدير متجر / معرض|1420|m|@retail,automotive-trade,pharmacies|ret.store-manager
assistant-store-manager|Assistant Store Manager|مساعد مدير متجر|5222|l|@retail,pharmacies|ret.store-supervisor
store-supervisor|Store / Showroom Supervisor|مشرف متجر / معرض|5222|l|@retail,automotive-trade,pharmacies|ret.store-supervisor
retail-operations-manager|Retail Operations Manager|مدير عمليات التجزئة|1420|m,d|@retail|
sales-associate|Retail Sales Associate|بائع|5223|i,j,b|@retail,automotive-trade|sales.retail-sales-associate
cashier|Cashier|كاشير / أمين صندوق|5230|i,j,b|@retail,@hosp,pharmacies|ret.cashier
visual-merchandiser|Visual Merchandiser|منسّق عرض مرئي|3432|x,s,i|@retail|
perfume-sales-consultant|Perfume and Oud Sales Consultant|مستشار مبيعات عطور وعود|5223|i,j|retail|
jewellery-sales-associate|Jewellery Sales Associate|بائع مجوهرات|5223|i,j|retail|
car-sales-consultant|Car Sales Consultant|مستشار مبيعات سيارات|5223|x,i,j|automotive-trade|
automotive-service-advisor|Automotive Service Advisor|مستشار خدمة (سيارات)|4222|x,i,j|automotive-trade|
spare-parts-specialist|Spare Parts Specialist|أخصائي قطع غيار|5223|x,i,j|automotive-trade,automotive-manufacturing|
@@cs
representative|Customer Service Representative|ممثل خدمة عملاء|4222|x,i,j|*|cs.representative
supervisor|Customer Service Supervisor|مشرف خدمة عملاء|4222|l|*|cs.supervisor
manager|Customer Service Manager|مدير خدمة عملاء|1439|m|*|cs.manager
call-center-agent|Call Centre Agent|موظف مركز اتصال|4222|i,j|business-support-bpo,telecom,banking,insurance,ecommerce,@health,government|cs.representative
call-center-team-leader|Call Centre Team Leader|قائد فريق مركز اتصال|4222|l|*|cs.supervisor
contact-center-quality-analyst|Contact Centre Quality Analyst|محلل جودة مركز اتصال|4222|x,s,i|business-support-bpo,telecom,banking,insurance,ecommerce|
customer-experience-manager|Customer Experience Manager|مدير تجربة العملاء|1439|m,l|*|
complaints-officer|Customer Complaints Officer|مسؤول شكاوى العملاء|4229|x,i,j|*|
@@adm
administrative-assistant|Administrative Assistant / Officer|مساعد / موظف إداري|4110|x,i,j|*|adm.administrative-assistant
admin-supervisor|Administrative Supervisor|مشرف إداري|3341|l|*|adm.admin-supervisor
admin-manager|Administration Manager|مدير إداري|1219|m|*|adm.admin-manager
office-manager|Office Manager|مدير مكتب|3341|m,l|*|adm.office-manager
secretary|Secretary|سكرتير|4120|x,i,j|*|adm.secretary
executive-assistant|Executive Assistant|مساعد تنفيذي|3343|x,s,i|*|adm.secretary
receptionist|Receptionist|موظف استقبال|4226|i,j|*|adm.receptionist
data-entry-clerk|Data Entry Clerk|مدخل بيانات|4132|i,j|*|adm.data-entry
document-controller|Document Controller|مراقب وثائق|4419|x,s,i,j|*|adm.document-controller
general-office-clerk|General Office Clerk|موظف مكتبي (كاتب)|4110|i,j|*|adm.administrative-assistant
filing-clerk|Filing and Records Clerk|موظف أرشيف وملفات|4415|i,j|*|
archivist|Archivist|أمين أرشيف ووثائق|2621|x,s,i|*|
mail-clerk|Mail and Correspondence Clerk|موظف صادر ووارد|4412|i,j|*|
office-messenger|Office Messenger|مراسل مكتب|9621|b|*|
translator|Translator / Interpreter|مترجم|2643|x,s,i,j|*|adm.translator
proofreader|Proofreader|مدقق لغوي|4413|x,i,j|@media,*|
general-services-officer|General Services Officer|مسؤول خدمات عامة|3341|x,i,j|*|
@@ops
area-manager|Area / Regional Manager|مدير منطقة / إقليمي|1219|m,d|*|ops.area-manager
branch-manager|Branch Manager|مدير فرع|1219|m|*|ops.branch-manager
branch-supervisor|Branch Supervisor|مشرف فرع|3341|l|*|ops.branch-supervisor
operations-manager|Operations Manager|مدير عمليات|1219|m,d|*|ops.manager
operations-supervisor|Operations Supervisor|مشرف عمليات|3341|l|*|ops.supervisor
operations-specialist|Operations Specialist|أخصائي عمليات|3343|x,s,i,j|*|ops.specialist
performance-analyst|Performance Analyst|محلل أداء|2421|x,s,i|*|performance.specialist
business-analyst|Business Analyst|محلل أعمال|2421|x,s,i,j|*|it.business-analyst
facilities-manager|Facilities Manager|مدير مرافق|1219|m|*|facility.manager
facilities-supervisor|Facilities Supervisor|مشرف مرافق|3341|l|*|facility.supervisor
facilities-coordinator|Facilities Coordinator|منسق مرافق|3341|x,i,j|*|facility.specialist
@@it
it-director|IT Director|مدير عام تقنية المعلومات|1330|d|*|it.manager
it-manager|IT Manager|مدير تقنية المعلومات|1330|m|*|it.manager
software-engineering-manager|Software Engineering Manager|مدير هندسة البرمجيات|1330|m,l|@it,fintech,ecommerce,healthtech,edtech,gaming-esports|it.manager
it-project-manager|IT Project Manager|مدير مشاريع تقنية|1330|m,s|*|project.manager
software-developer|Software Developer|مطوّر برمجيات|2512|s,i,j|*|it.software-developer
backend-developer|Backend Developer|مطوّر خلفي (Backend)|2512|s,i,j|*|it.software-developer
frontend-developer|Frontend Developer|مطوّر واجهات أمامية (Frontend)|2513|s,i,j|*|it.software-developer
fullstack-developer|Full-Stack Developer|مطوّر متكامل (Full-Stack)|2512|s,i,j|*|it.software-developer
web-developer|Web Developer|مطوّر مواقع|2513|s,i,j|*|it.software-developer
mobile-developer|Mobile App Developer|مطوّر تطبيقات جوال|2514|s,i,j|*|it.software-developer
software-architect|Software Architect|مهندس معماري برمجيات|2511|s,m|*|it.software-developer
solutions-architect|Solutions Architect|مهندس حلول تقنية|2511|s,m|*|it.software-developer
enterprise-architect|Enterprise Architect|مهندس معماري مؤسسي|2511|s,m|*|
devops-engineer|DevOps Engineer|مهندس DevOps|2519|s,i,j|*|it.system-admin
site-reliability-engineer|Site Reliability Engineer (SRE)|مهندس موثوقية الأنظمة (SRE)|2522|s,i|*|it.system-admin
cloud-engineer|Cloud Engineer|مهندس حوسبة سحابية|2522|s,i,j|*|it.system-admin
cloud-architect|Cloud Architect|مهندس معماري للحوسبة السحابية|2511|s,m|*|
system-administrator|System Administrator|مدير أنظمة|2522|s,i,j|*|it.system-admin
network-engineer|Network Engineer|مهندس شبكات|2523|s,i,j|*|it.network-engineer
network-technician|Network Technician|فني شبكات|3513|i,j|*|it.network-engineer
noc-engineer|NOC Engineer|مهندس مركز عمليات الشبكة (NOC)|2523|s,i,j|telecom,@it|
database-administrator|Database Administrator (DBA)|مدير قواعد بيانات|2521|s,i,j|*|
data-engineer|Data Engineer|مهندس بيانات|2521|s,i,j|*|it.data-analyst
data-analyst|Data Analyst|محلل بيانات|2120|x,s,i,j|*|it.data-analyst
bi-developer|BI Developer|مطوّر ذكاء أعمال (BI)|2519|s,i,j|*|it.data-analyst
data-scientist|Data Scientist|عالم بيانات|2120|s,i,j|*|it.data-scientist
machine-learning-engineer|Machine Learning Engineer|مهندس تعلّم آلة|2519|s,i,j|*|it.data-scientist
ai-engineer|AI Engineer|مهندس ذكاء اصطناعي|2519|s,i,j|*|it.data-scientist
business-systems-analyst|Business / Systems Analyst|محلل نظم|2511|x,s,i,j|*|it.business-analyst
product-manager|Product Manager|مدير منتج|1219|m,s,i|@it,fintech,ecommerce,healthtech,edtech,gaming-esports,telecom|it.product-manager
product-owner|Product Owner|مالك منتج (Product Owner)|2511|s,i|@it,fintech,ecommerce,healthtech,edtech|it.product-manager
scrum-master|Scrum Master / Agile Coach|سكرم ماستر / مدرب أجايل|2511|s,i|*|
qa-tester|QA Tester|مختبر جودة برمجيات|2519|s,i,j|*|it.qa-tester
test-automation-engineer|QA Automation Engineer|مهندس اختبار آلي|2519|s,i|*|it.qa-tester
ux-designer|UX Designer|مصمم تجربة مستخدم (UX)|2166|s,i,j|*|it.ux-designer
ui-designer|UI Designer|مصمم واجهات مستخدم (UI)|2166|s,i,j|*|it.ux-designer
ux-researcher|UX Researcher|باحث تجربة مستخدم|2421|s,i|*|
it-support-specialist|IT Support Specialist|أخصائي دعم تقني|3512|x,s,i,j|*|it.support
help-desk-agent|Help Desk Agent|موظف مكتب مساعدة تقني|3512|i,j|*|it.support
it-technician|IT Technician|فني حاسب آلي|3512|i,j|*|it.support
cybersecurity-specialist|Cybersecurity Specialist|أخصائي أمن سيبراني|2529|x,s,i,j|*|it.security
soc-analyst|SOC Analyst|محلل مركز عمليات أمنية (SOC)|2529|s,i,j|*|it.security
penetration-tester|Penetration Tester|مختبر اختراق|2529|s,i|*|it.security
security-architect|Security Architect|مهندس معماري أمن معلومات|2529|s,m|*|it.security
grc-specialist|IT GRC Specialist|أخصائي حوكمة ومخاطر والتزام تقني|2529|x,s,i|*|it.security
erp-consultant|ERP / SAP Consultant|استشاري أنظمة ERP|2511|s,i,j|*|it.erp-consultant
crm-administrator|CRM Administrator|مسؤول نظام إدارة علاقات العملاء (CRM)|2522|x,s,i|*|
rpa-developer|RPA / Automation Developer|مطوّر أتمتة العمليات (RPA)|2514|s,i,j|*|
embedded-systems-engineer|Embedded Systems Engineer|مهندس أنظمة مدمجة|2152|s,i,j|electronics-manufacturing,automotive-manufacturing,@it,machinery-equipment|
iot-engineer|IoT Engineer|مهندس إنترنت الأشياء|2153|s,i,j|@it,@energy,manufacturing|
game-developer|Game Developer|مطوّر ألعاب|2514|s,i,j|gaming-esports|
game-designer|Game Designer|مصمم ألعاب|2166|s,i,j|gaming-esports|
blockchain-developer|Blockchain Developer|مطوّر بلوكتشين|2514|s,i|fintech,@it|
technical-writer|Technical Writer|كاتب تقني|2641|x,s,i|@it,@ind,@energy|
it-trainer|IT Trainer|مدرب تقنية معلومات|2356|x,s,i|@it,@edu|
@@tel
telecom-engineer|Telecommunications Engineer|مهندس اتصالات|2153|s,i,j|telecom,telecom-it,@gov|
rf-engineer|RF / Radio Network Engineer|مهندس شبكات لاسلكية (RF)|2153|s,i,j|telecom,telecom-it|
telecom-field-technician|Telecom Field Technician|فني اتصالات ميداني|3522|i,j|telecom,telecom-it|
fibre-optic-technician|Fibre Optic Technician|فني ألياف ضوئية|7422|i,j,b|telecom,telecom-it,construction-specialty|
security-systems-installer|CCTV and Security Systems Installer|فني تركيب كاميرات وأنظمة أمنية|7422|i,j,b|security-services,construction-specialty,telecom-it|
data-center-technician|Data Centre Technician|فني مركز بيانات|3513|i,j|data-hosting-cloud,telecom,telecom-it|
@@eng
engineering-manager|Engineering Manager|مدير هندسة|1321|m,d|*|eng.engineering-manager
design-manager|Design Manager|مدير تصميم|1321|m|@con,architecture-engineering,@energy|eng.engineering-manager
civil-engineer|Civil Engineer|مهندس مدني|2142|s,i,j|@con,architecture-engineering,government,real-estate-development|eng.civil-engineer
site-engineer|Site Engineer|مهندس موقع|2142|s,i,j|@con,@energy,real-estate-development|eng.site-engineer
structural-engineer|Structural Engineer|مهندس إنشائي|2142|s,i,j|@con,architecture-engineering|eng.structural-engineer
geotechnical-engineer|Geotechnical Engineer|مهندس تربة وأساسات|2142|s,i,j|@con,architecture-engineering,testing-inspection|eng.civil-engineer
highway-engineer|Highway / Roads Engineer|مهندس طرق|2142|s,i,j|construction-infrastructure,architecture-engineering,government|eng.civil-engineer
water-resources-engineer|Water Resources Engineer|مهندس موارد مائية|2142|s,i,j|water-utilities,construction-infrastructure,government|eng.civil-engineer
infrastructure-engineer|Infrastructure Engineer|مهندس بنية تحتية|2142|s,i,j|construction-infrastructure,real-estate-development,government|eng.civil-engineer
bim-engineer|BIM Engineer / Coordinator|مهندس نمذجة معلومات البناء (BIM)|2142|s,i,j|@con,architecture-engineering|
architect|Architect|مهندس معماري|2161|s,i,j|@con,architecture-engineering,real-estate-development,design-creative|eng.architect
landscape-architect|Landscape Architect|مهندس تنسيق مواقع|2162|s,i,j|@con,architecture-engineering,real-estate-development|
urban-planner|Urban Planner|مخطط حضري|2164|s,i,j|architecture-engineering,government,real-estate-development|
interior-designer|Interior Designer|مصمم داخلي|3432|s,i,j|@con,architecture-engineering,real-estate-development,design-creative,wood-furniture|eng.interior-designer
draftsman|Draftsman / CAD Technician|رسّام هندسي (درافتسمان)|3118|s,i,j|@con,architecture-engineering,@ind,@energy|eng.draftsman
quantity-surveyor|Quantity Surveyor|مهندس كميات|2149|s,i,j|@con,architecture-engineering,real-estate-development|eng.quantity-surveyor
land-surveyor|Land Surveyor|مساح|2165|s,i,j|@con,architecture-engineering,@mining,real-estate-development,@energy|eng.surveyor
survey-assistant|Survey Assistant|مساعد مساح|3112|j,b|@con,architecture-engineering,@mining|eng.surveyor
contracts-engineer|Contracts Engineer|مهندس عقود|2149|s,i,j|@con,@energy,architecture-engineering|
cost-control-engineer|Cost Control Engineer|مهندس تكاليف|2149|s,i,j|@con,@energy|eng.cost-engineer
planning-engineer|Planning and Project Controls Engineer|مهندس تخطيط ومراقبة مشاريع|2149|s,i,j|@con,@energy,architecture-engineering|eng.planning-engineer
project-engineer|Project Engineer|مهندس مشاريع|2149|s,i,j|*|eng.project-engineer
design-engineer|Design Engineer|مهندس تصميم|2149|s,i,j|@con,@ind,@energy,architecture-engineering|eng.design-engineer
mep-engineer|MEP Engineer|مهندس MEP (ميكانيكا وكهرباء وسباكة)|2149|s,i,j|@con,architecture-engineering,real-estate-development|
mechanical-engineer|Mechanical Engineer|مهندس ميكانيكي|2144|s,i,j|*|eng.mechanical-engineer
hvac-engineer|HVAC Engineer|مهندس تكييف وتهوية|2144|s,i,j|@con,architecture-engineering,real-estate-development|eng.mechanical-engineer
piping-engineer|Piping Engineer|مهندس أنابيب|2144|s,i,j|@energy,@con,fabricated-metal|eng.mechanical-engineer
rotating-equipment-engineer|Rotating Equipment Engineer|مهندس معدات دوّارة|2144|s,i,j|@energy,@ind|eng.mechanical-engineer
fire-protection-engineer|Fire Protection Engineer|مهندس حماية من الحريق|2149|s,i,j|@con,architecture-engineering,@energy|
reliability-engineer|Reliability Engineer|مهندس موثوقية|2141|s,i,j|@energy,@ind,aviation|eng.maintenance-engineer
maintenance-engineer|Maintenance Engineer|مهندس صيانة|2141|s,i,j|*|eng.maintenance-engineer
maintenance-planner|Maintenance Planner|مخطط صيانة|2141|x,s,i,j|@energy,@ind,aviation,facility-management|eng.maintenance-planner
facilities-engineer|Facilities Engineer|مهندس مرافق|2149|s,i,j|facility-management,real-estate-services,@hosp,@health,@gov|eng.facilities-engineer
electrical-engineer|Electrical Engineer|مهندس كهرباء|2151|s,i,j|*|eng.electrical-engineer
power-systems-engineer|Power Systems Engineer|مهندس قوى كهربائية|2151|s,i,j|power-utilities,renewable-energy,@con,oil-gas-upstream|eng.electrical-engineer
protection-engineer|Protection and Relay Engineer|مهندس حماية كهربائية|2151|s,i,j|power-utilities,renewable-energy|eng.electrical-engineer
substation-engineer|Substation Engineer|مهندس محطات كهرباء|2151|s,i,j|power-utilities,construction-infrastructure|eng.electrical-engineer
electronics-engineer|Electronics Engineer|مهندس إلكترونيات|2152|s,i,j|electronics-manufacturing,@it,telecom,aerospace-transport-equipment,medical-devices,defense-security|
instrumentation-engineer|Instrumentation and Control Engineer|مهندس أجهزة وتحكم|2152|s,i,j|@energy,@ind,water-utilities|eng.instrumentation-engineer
automation-engineer|Automation (PLC / SCADA) Engineer|مهندس أتمتة (PLC / SCADA)|2152|s,i,j|@energy,@ind,water-utilities,logistics|eng.instrumentation-engineer
mechatronics-engineer|Mechatronics Engineer|مهندس ميكاترونيكس|2149|s,i,j|@ind,automotive-manufacturing,machinery-equipment,aerospace-transport-equipment|
industrial-engineer|Industrial Engineer|مهندس صناعي|2141|s,i,j|@ind,@log,@health,@retail,*|eng.industrial-engineer
production-engineer|Production / Manufacturing Engineer|مهندس إنتاج|2141|s,i,j|@ind,pharma-manufacturing,food-manufacturing,beverages|eng.production-engineer
quality-engineer|Quality Engineer (QA/QC)|مهندس جودة|2141|s,i,j|*|eng.qaqc-engineer
packaging-engineer|Packaging Engineer|مهندس تغليف|2149|s,i|paper-packaging,food-manufacturing,beverages,fmcg|
chemical-engineer|Chemical Engineer|مهندس كيميائي|2145|s,i,j|@energy,chemicals,petrochemicals,@ind,water-utilities|eng.chemical-engineer
process-engineer|Process Engineer|مهندس عمليات|2145|s,i,j|@energy,chemicals,petrochemicals,@ind,water-utilities|eng.chemical-engineer
petroleum-engineer|Petroleum Engineer|مهندس بترول|2146|s,i,j|oil-gas-upstream,oilfield-services,refining|eng.petroleum-engineer
reservoir-engineer|Reservoir Engineer|مهندس مكامن|2146|s,i,j|oil-gas-upstream|eng.petroleum-engineer
drilling-engineer|Drilling Engineer|مهندس حفر|2146|s,i,j|oil-gas-upstream,oilfield-services|eng.petroleum-engineer
oil-gas-production-engineer|Production Engineer (Oil and Gas)|مهندس إنتاج نفط وغاز|2146|s,i,j|oil-gas-upstream,oilfield-services|eng.petroleum-engineer
corrosion-engineer|Corrosion Engineer|مهندس تآكل|2146|s,i,j|@energy,fabricated-metal,metals-manufacturing|eng.materials-engineer
materials-engineer|Materials Engineer|مهندس مواد|2146|s,i,j|@ind,aerospace-transport-equipment,@energy|eng.materials-engineer
metallurgist|Metallurgist|متخصص معادن (ميتالورجي)|2146|s,i,j|@mining,metals-manufacturing,fabricated-metal|eng.materials-engineer
mining-engineer|Mining Engineer|مهندس تعدين|2146|s,i,j|@mining|
environmental-engineer|Environmental Engineer|مهندس بيئة|2143|s,i,j|*|eng.environmental-engineer
automotive-engineer|Automotive Engineer|مهندس سيارات|2144|s,i,j|automotive-manufacturing,automotive-trade|
aerospace-engineer|Aerospace Engineer|مهندس طيران وفضاء|2149|s,i,j|aerospace-transport-equipment,aviation,defense-security|
marine-engineer|Marine / Naval Engineer|مهندس بحري|2149|s,i,j|maritime-ports,aerospace-transport-equipment,oilfield-services,defense-security|
biomedical-engineer|Biomedical Engineer|مهندس طبي حيوي|2149|s,i,j|@health,medical-devices|
renewable-energy-engineer|Renewable Energy Engineer|مهندس طاقة متجددة|2151|s,i,j|renewable-energy,power-utilities,@con|
solar-pv-engineer|Solar PV Design Engineer|مهندس تصميم أنظمة طاقة شمسية|2151|s,i,j|renewable-energy,@con|
energy-efficiency-engineer|Energy Efficiency Engineer|مهندس كفاءة الطاقة|2149|s,i,j|renewable-energy,power-utilities,facility-management,@con|
defense-systems-engineer|Defence Systems Engineer|مهندس أنظمة دفاعية|2149|s,i,j|defense-security,aerospace-transport-equipment|
security-systems-engineer|Security Systems Engineer|مهندس أنظمة أمنية|2152|s,i,j|security-services,defense-security,@it|
qaqc-inspector|QA/QC Inspector|مفتش جودة (QA/QC)|3119|s,i,j|@con,@energy,@ind,testing-inspection|
welding-inspector|Welding Inspector|مفتش لحام|3119|s,i|@con,@energy,fabricated-metal,testing-inspection|
ndt-technician|NDT Technician|فني فحص غير إتلافي (NDT)|3119|s,i,j|@energy,fabricated-metal,testing-inspection,aviation|
coating-inspector|Coating Inspector|مفتش دهانات وطلاء|3119|s,i|@energy,@con,testing-inspection|
civil-technician|Civil Engineering Technician|فني هندسة مدنية|3112|i,j|@con,architecture-engineering,testing-inspection|
electrical-technician|Electrical Engineering Technician|فني هندسة كهربائية|3113|i,j|*|
electronics-technician|Electronics Engineering Technician|فني إلكترونيات|3114|i,j|electronics-manufacturing,@it,telecom,medical-devices|
mechanical-technician|Mechanical Engineering Technician|فني هندسة ميكانيكية|3115|i,j|*|
chemical-technician|Chemical Engineering Technician|فني هندسة كيميائية|3116|i,j|@energy,chemicals,petrochemicals,water-utilities|
@@con
construction-manager|Construction / Site Manager|مدير موقع / إنشاءات|1323|m|@con,real-estate-development|construction.manager
construction-supervisor|Construction / Site Supervisor|مشرف موقع / إنشاءات|3123|l|@con,real-estate-development|construction.supervisor
construction-coordinator|Construction Coordinator|منسق إنشاءات|3123|x,i,j|@con,real-estate-development|construction.specialist
general-foreman|General Foreman|رئيس عمال (جنرال فورمان)|3123|l|@con,@energy|construction.supervisor
foreman|Foreman|مراقب عمال (فورمان)|3123|l|@con,@energy,@ind|construction.supervisor
construction-labourer|Construction Labourer|عامل بناء|9313|b|@con|
civil-labourer|Civil Works Labourer|عامل أعمال مدنية|9312|b|construction-infrastructure,contracting|
skilled-trade-helper|Skilled Trade Helper|مساعد فني (هلبر)|9313|b|@con,@energy,@ind,facility-management|
@@trade
mason|Mason / Bricklayer|بنّاء (مبلّط طوب)|7112|s,i,j|@con|trade.mason
stonemason|Stonemason|بنّاء حجر (حجّار)|7113|s,i,j|@con,mining-quarrying|
concrete-finisher|Concrete Finisher|عامل خرسانة (مسطّح)|7114|i,j|@con|
steel-fixer|Steel Fixer / Rebar Worker|حدّاد مسلّح (تسليح)|7114|i,j|@con|
formwork-carpenter|Formwork Carpenter|نجّار مسلّح (شدّات)|7115|i,j|@con|trade.carpenter
carpenter|Carpenter|نجّار|7115|s,i,j|@con,wood-furniture,construction-specialty|trade.carpenter
roofer|Roofer|عامل أسقف|7121|i,j|@con|
tiler|Tile Setter|مبلّط (بلاط وسيراميك)|7122|s,i,j|@con|
plasterer|Plasterer|مبيّض محارة|7123|s,i,j|@con|
gypsum-installer|Gypsum and False Ceiling Installer|فني جبس وأسقف معلّقة|7123|i,j|@con|
insulation-worker|Insulation Worker|عامل عزل|7124|i,j|@con,@energy|
waterproofing-applicator|Waterproofing Applicator|عامل عزل مائي|7124|i,j|@con|
glazier|Glazier|فني زجاج|7125|i,j|@con,building-materials|
aluminium-fabricator|Aluminium and Glass Fabricator|فني ألمنيوم وزجاج|7125|s,i,j|@con,fabricated-metal|
plumber|Plumber|سبّاك|7126|s,i,j|@con,facility-management,real-estate-services,@hosp|trade.plumber
pipe-fitter|Pipe Fitter|فني تركيب أنابيب|7126|s,i,j|@con,@energy,fabricated-metal|trade.plumber
hvac-technician|HVAC / Refrigeration Technician|فني تكييف وتبريد|7127|s,i,j|@con,facility-management,@hosp,@retail,repair-services|trade.hvac-technician
painter|Painter|دهّان|7131|s,i,j|@con,facility-management|trade.painter
spray-painter|Industrial Spray Painter|دهّان رش صناعي|7132|i,j|@ind,@energy,fabricated-metal|trade.painter
sandblaster|Sandblaster / Surface Preparer|عامل سفع رملي|7133|i,j|@energy,@con,fabricated-metal|
scaffolder|Scaffolder|فني سقالات|7119|i,j|@con,@energy|
rigger|Rigger|فني ربط وتعليق (ريقر)|7215|s,i,j|@con,@energy,maritime-ports|
welder|Welder|لحّام|7212|s,i,j|@con,@energy,fabricated-metal,metals-manufacturing,automotive-manufacturing|trade.welder
metal-fabricator|Metal Fabricator / Fitter|فني تشكيل وتجميع معادن (فابريكيتر)|7214|s,i,j|fabricated-metal,@con,@energy,machinery-equipment|
sheet-metal-worker|Sheet Metal Worker|سمكري|7213|s,i,j|fabricated-metal,@con,automotive-manufacturing|
blacksmith|Blacksmith|حدّاد|7221|i,j|fabricated-metal,@con|
machinist|Machinist / Lathe Operator|مشغّل مخرطة (خرّاط)|7223|s,i,j|fabricated-metal,machinery-equipment,industrial-repair|
cnc-operator|CNC Machine Operator|مشغّل ماكينة CNC|7223|s,i,j|fabricated-metal,machinery-equipment,automotive-manufacturing,aerospace-transport-equipment|
tool-and-die-maker|Tool and Die Maker|صانع قوالب وعدد|7222|s,i|fabricated-metal,machinery-equipment,plastics-rubber|
electrician|Electrician|كهربائي|7411|s,i,j|@con,facility-management,@hosp,real-estate-services|trade.electrician
industrial-electrician|Industrial Electrician|كهربائي صناعي|7412|s,i,j|@ind,@energy,industrial-repair|trade.electrician
power-line-installer|Power Line Installer|فني خطوط كهرباء|7413|s,i,j|power-utilities,construction-infrastructure,renewable-energy|trade.electrician
generator-technician|Generator Technician|فني مولدات|7412|s,i,j|power-utilities,industrial-repair,@con,facility-management|trade.electrician
solar-pv-installer|Solar PV Installer|فني تركيب ألواح شمسية|7411|i,j|renewable-energy,construction-specialty|trade.electrician
wind-turbine-technician|Wind Turbine Technician|فني توربينات رياح|7412|s,i,j|renewable-energy|
elevator-technician|Elevator and Escalator Technician|فني مصاعد|7233|s,i,j|construction-specialty,facility-management,machinery-equipment|
maintenance-technician|Maintenance Technician|فني صيانة|7233|s,i,j|*|trade.maintenance-technician
building-maintenance-technician|Building Maintenance Technician (Multi-skilled)|فني صيانة مباني (متعدد المهارات)|7119|i,j|facility-management,real-estate-services,@hosp,@health,@edu|trade.maintenance-technician
industrial-maintenance-mechanic|Industrial Maintenance Mechanic|ميكانيكي صيانة صناعية|7233|s,i,j|@ind,@energy,industrial-repair,@mining|trade.maintenance-technician
millwright|Millwright / Mechanical Fitter|فني تركيب آلات (ميلرايت)|7233|s,i,j|@ind,@energy,industrial-repair|trade.maintenance-technician
heavy-equipment-mechanic|Heavy Equipment Mechanic|ميكانيكي معدات ثقيلة|7233|s,i,j|@con,@mining,oilfield-services,equipment-rental,road-transport|trade.mechanic
instrument-technician|Instrumentation Technician|فني أجهزة دقيقة|7311|s,i,j|@energy,@ind,water-utilities|trade.instrument-technician
auto-mechanic|Auto Mechanic|ميكانيكي سيارات|7231|s,i,j|automotive-trade,road-transport,equipment-rental,automotive-manufacturing|trade.mechanic
auto-electrician|Auto Electrician|كهربائي سيارات|7412|s,i,j|automotive-trade,road-transport|trade.mechanic
panel-beater|Panel Beater / Auto Body Repairer|سمكري سيارات|7213|s,i,j|automotive-trade|
auto-painter|Auto Painter|دهّان سيارات|7132|s,i,j|automotive-trade|
tyre-fitter|Tyre Fitter|فني إطارات (كفرجي)|7231|i,j,b|automotive-trade,road-transport|
irrigation-technician|Irrigation Technician|فني ري|7126|i,j|@agri,construction-infrastructure,water-utilities|
pest-control-technician|Pest Control Technician|فني مكافحة حشرات|7544|i,j|facility-management,@hosp,food-manufacturing,personal-services|
cabinet-maker|Cabinet Maker|نجّار مطابخ وخزائن|7522|s,i,j|wood-furniture,construction-specialty|
joiner|Joiner (Doors and Furniture)|نجّار أبواب وأثاث|7522|s,i,j|wood-furniture,construction-specialty|trade.carpenter
upholsterer|Upholsterer|منجّد|7534|s,i,j|wood-furniture,personal-services,automotive-trade|
heavy-equipment-operator|Excavator / Heavy Equipment Operator|مشغّل حفّارة ومعدات ثقيلة|8342|s,i,j|@con,@mining,@energy,equipment-rental|
wheel-loader-operator|Wheel Loader Operator|مشغّل لودر|8342|i,j|@con,@mining,equipment-rental|
asphalt-paver-operator|Asphalt Paver Operator|مشغّل فرد أسفلت|8342|i,j|construction-infrastructure|
crane-operator|Crane Operator|مشغّل رافعة (ونش)|8343|s,i,j|@con,@energy,maritime-ports,logistics,equipment-rental|
concrete-pump-operator|Concrete Pump Operator|مشغّل مضخة خرسانة|8342|i,j|@con|
batching-plant-operator|Batching Plant Operator|مشغّل خلاطة خرسانة|8114|i,j|@con,building-materials|
well-driller|Well Driller|حفّار آبار|8113|s,i,j|water-utilities,oilfield-services,@mining,construction-infrastructure|
oil-rig-driller|Driller (Oil Rig)|حفّار (برج حفر)|8113|s,i|oil-gas-upstream,oilfield-services|
roughneck|Roughneck / Drilling Floor Hand|عامل أرضية حفر (روف نك)|8113|j,b|oil-gas-upstream,oilfield-services|
@@mfg
plant-manager|Plant Manager|مدير مصنع|1321|m,d|@ind,beverages,pharma-manufacturing,textiles,apparel,electronics-manufacturing,electrical-equipment,paper-packaging,printing,wood-furniture|
production-manager|Production Manager|مدير إنتاج|1321|m|@ind,beverages,pharma-manufacturing,textiles,apparel,electronics-manufacturing,electrical-equipment,paper-packaging,printing,wood-furniture,catering-services|production.manager
production-supervisor|Production Supervisor|مشرف إنتاج|3122|l|@ind,beverages,pharma-manufacturing,textiles,apparel,electronics-manufacturing,electrical-equipment,paper-packaging,printing,wood-furniture,catering-services|production.supervisor
production-specialist|Production Specialist|أخصائي إنتاج|3122|x,s,i,j|@ind,beverages,pharma-manufacturing,electronics-manufacturing|production.specialist
production-planner|Production Planner|مخطط إنتاج|4322|x,s,i,j|@ind,beverages,pharma-manufacturing,textiles,apparel,electronics-manufacturing|
maintenance-manager|Maintenance Manager|مدير صيانة|1321|m|*|maintenance.manager
maintenance-supervisor|Maintenance Supervisor|مشرف صيانة|3122|l|*|maintenance.supervisor
machine-operator|Machine / Production Operator|مشغّل آلات إنتاج|8189|i,j,b|@ind,beverages,pharma-manufacturing,textiles,apparel,electronics-manufacturing,electrical-equipment,paper-packaging,printing,wood-furniture|trade.machine-operator
packing-machine-operator|Packing Machine Operator|مشغّل ماكينة تعبئة وتغليف|8183|i,j|@ind,beverages,paper-packaging,fmcg|trade.machine-operator
bottling-line-operator|Bottling Line Operator|مشغّل خط تعبئة|8183|i,j|beverages,food-manufacturing,pharma-manufacturing|trade.machine-operator
hand-packer|Hand Packer|عامل تعبئة وتغليف|9321|b|@ind,beverages,fmcg,warehousing|
assembly-line-worker|Assembly Line Worker|عامل خط تجميع|8219|b|@ind,electronics-manufacturing,electrical-equipment,automotive-manufacturing|
production-worker|Production Line Worker|عامل إنتاج|9329|b|@ind,beverages,textiles,apparel,paper-packaging,printing,wood-furniture|
mechanical-assembler|Mechanical Assembler|فني تجميع ميكانيكي|8211|i,j|machinery-equipment,automotive-manufacturing,aerospace-transport-equipment|
electronics-assembler|Electronics / Electrical Assembler|فني تجميع إلكتروني وكهربائي|8212|i,j|electronics-manufacturing,electrical-equipment|
quality-inspector|Quality Inspector|مفتش جودة (إنتاج)|7543|s,i,j|@ind,beverages,pharma-manufacturing,electronics-manufacturing,paper-packaging|
quality-manager|Quality Manager|مدير جودة|1219|m|*|quality.manager
quality-supervisor|Quality Supervisor|مشرف جودة|3122|l|*|quality.supervisor
quality-specialist|Quality Specialist|أخصائي جودة|2141|x,s,i,j|*|quality.specialist
food-safety-specialist|Food Safety (HACCP) Specialist|أخصائي سلامة غذاء (هاسب)|3257|x,s,i,j|food-manufacturing,beverages,@hosp,fmcg,supermarkets|
food-technologist|Food Technologist|تقني أغذية|2131|x,s,i,j|food-manufacturing,beverages,fmcg|
rd-manager|R&D Manager|مدير بحث وتطوير|1223|m|@ind,pharma-manufacturing,rnd-scientific,@it|
product-development-specialist|Product Development Specialist|أخصائي تطوير منتجات|2149|x,s,i|@ind,fmcg,food-manufacturing,pharma-manufacturing|
formulation-chemist|Formulation Chemist|كيميائي تركيبات|2113|s,i,j|chemicals,petrochemicals,pharma-manufacturing,fmcg,food-manufacturing|
microbiologist|Microbiologist|أخصائي أحياء دقيقة|2131|s,i,j|food-manufacturing,beverages,pharma-manufacturing,diagnostics-labs,rnd-scientific|
butcher|Butcher|جزّار|7511|s,i,j|food-manufacturing,@retail,catering-services|
dairy-products-maker|Dairy Products Maker|فني منتجات ألبان|7513|i,j|food-manufacturing,agri-livestock|
food-production-operator|Food Production Operator|عامل خط إنتاج غذائي|8160|i,j,b|food-manufacturing,beverages,catering-services|
sewing-machine-operator|Sewing Machine Operator|مشغّل ماكينة خياطة|8153|i,j|apparel,textiles,personal-services|
garment-pattern-cutter|Garment Pattern Maker / Cutter|قصّاص باترون ملابس|7532|s,i,j|apparel,textiles,personal-services|
embroiderer|Embroiderer|مطرّز|7533|i,j|apparel,textiles,personal-services|
tailor|Tailor / Seamstress|خيّاط|7531|s,i,j|apparel,personal-services,retail|oth.tailor
shoemaker|Shoemaker / Cobbler|إسكافي|7536|i,j|leather-footwear,personal-services|
textile-machine-operator|Textile Machine Operator|مشغّل ماكينات نسيج|8152|i,j|textiles|
laundry-machine-operator|Laundry Machine Operator|مشغّل ماكينات مغسلة|8157|i,j,b|personal-services,@hosp,@health|
press-operator|Printing Press Operator|مشغّل ماكينة طباعة|7322|s,i,j|printing,publishing,paper-packaging|
prepress-technician|Pre-press Technician|فني ما قبل الطباعة|7321|s,i,j|printing,publishing,media-marketing|
print-finisher|Print Finishing and Binding Worker|عامل تجليد وتشطيب طباعة|7323|i,j,b|printing,publishing|
plastic-injection-operator|Plastic Injection Moulding Operator|مشغّل حقن بلاستيك|8142|i,j|plastics-rubber|
glass-ceramics-operator|Glass / Ceramics Plant Operator|مشغّل مصنع زجاج وسيراميك|8181|i,j|building-materials|
cement-plant-operator|Cement Plant Operator|مشغّل مصنع إسمنت|8114|i,j|building-materials|
steel-plant-operator|Steel / Metal Plant Operator|مشغّل مصنع حديد ومعادن|8121|s,i,j|metals-manufacturing,fabricated-metal|
metal-finishing-operator|Metal Plating / Galvanizing Operator|مشغّل طلاء وجلفنة معادن|8122|i,j|metals-manufacturing,fabricated-metal|
chemical-plant-operator|Chemical Plant Operator|مشغّل مصنع كيماويات|8131|s,i,j|chemicals,petrochemicals,pharma-manufacturing|
paper-machine-operator|Paper Machine Operator|مشغّل ماكينة ورق|8143|i,j|paper-packaging|
boiler-operator|Boiler Operator|مشغّل مرجل (بويلر)|8182|s,i,j|@ind,power-utilities,@hosp,@health|
@@energy
power-plant-operator|Power Plant Operator|مشغّل محطة كهرباء|3131|s,i,j|power-utilities,renewable-energy|
grid-control-operator|Power Grid Control Operator|مشغّل شبكة كهرباء|3131|s,i|power-utilities|
control-room-operator|Control Room Operator|مشغّل غرفة تحكم|3133|s,i,j|@energy,@ind,water-utilities|
process-operator|Process Operator|مشغّل عمليات (محطة)|3133|s,i,j|@energy,@ind|
refinery-operator|Refinery / Gas Plant Operator|مشغّل مصفاة / محطة غاز|3134|s,i,j|refining,oil-gas-upstream,petrochemicals|
pipeline-operator|Pipeline Operator|مشغّل خطوط أنابيب|3134|s,i,j|oil-gas-upstream,refining,power-utilities|
petroleum-technician|Petroleum Technician|فني نفط|3134|s,i,j|oil-gas-upstream,oilfield-services,refining|
water-plant-operator|Water / Desalination Plant Operator|مشغّل محطة مياه وتحلية|3132|s,i,j|water-utilities|
meter-reader|Meter Reader|قارئ عدادات|9623|j,b|power-utilities,water-utilities|
mine-manager|Mine Manager|مدير منجم|1322|m,d|@mining|
mining-supervisor|Mining Supervisor|مشرف تعدين|3121|l|@mining|
miner|Miner|عامل منجم|8111|i,j,b|@mining|
blaster|Shotfirer / Blaster|فني تفجير|7542|s,i|@mining,construction-infrastructure|
mineral-processing-operator|Mineral Processing Operator|مشغّل معالجة خامات|8112|s,i,j|@mining|
mine-surveyor|Mine Surveyor|مساح مناجم|2165|s,i,j|@mining|
exploration-geologist|Exploration Geologist|جيولوجي استكشاف|2114|s,i,j|@mining,oil-gas-upstream|
geologist|Geologist|جيولوجي|2114|s,i,j|@mining,oil-gas-upstream,oilfield-services,rnd-scientific,construction-infrastructure,water-utilities,government|
geophysicist|Geophysicist|جيوفيزيائي|2114|s,i,j|oil-gas-upstream,oilfield-services,@mining,rnd-scientific|
wellsite-geologist|Wellsite Geologist|جيولوجي موقع حفر|2114|s,i|oil-gas-upstream,oilfield-services|
drilling-supervisor|Drilling Supervisor|مشرف حفر|3121|l|oil-gas-upstream,oilfield-services,@mining|
assay-technician|Assay Technician|فني تحليل خامات|3117|i,j|@mining|
quarry-worker|Quarry Worker|عامل محجر|9311|b|mining-quarrying,building-materials|
@@scm
supply-chain-director|Supply Chain Director|مدير عام سلسلة الإمداد|1324|d|*|
supply-chain-manager|Supply Chain Manager|مدير سلسلة الإمداد|1324|m|*|scm.manager
supply-chain-supervisor|Supply Chain Supervisor|مشرف سلسلة إمداد|3324|l|*|scm.supervisor
supply-chain-specialist|Supply Chain Specialist|أخصائي سلسلة إمداد|3324|x,s,i,j|*|scm.specialist
demand-planner|Demand Planner|مخطط طلب|3339|x,s,i,j|@retail,@ind,@log,@health|scm.planner
supply-planner|Supply Planner|مخطط إمداد|3339|x,s,i,j|@retail,@ind,@log,@health|scm.planner
inventory-controller|Inventory Controller|مراقب مخزون|4321|x,s,i,j|*|scm.inventory-controller
procurement-director|Procurement Director|مدير عام المشتريات|1324|d|*|
procurement-manager|Procurement Manager|مدير مشتريات|1324|m|*|procurement.manager
procurement-supervisor|Procurement Supervisor|مشرف مشتريات|3323|l|*|procurement.supervisor
procurement-specialist|Procurement Specialist|أخصائي مشتريات|3323|x,s,i,j|*|procurement.specialist
buyer|Buyer / Purchasing Agent|مشتري|3323|x,s,i,j|*|procurement.specialist
sourcing-specialist|Strategic Sourcing Specialist|أخصائي توريد استراتيجي|3323|x,s,i|*|procurement.specialist
purchasing-clerk|Purchasing Clerk|موظف مشتريات|4321|i,j|*|procurement.specialist
contracts-specialist|Contracts Specialist|أخصائي عقود|3339|x,s,i,j|*|scm.contracts
contracts-manager|Contracts Manager|مدير عقود|1219|m,l|*|scm.contracts
@@log
logistics-manager|Logistics Manager|مدير لوجستيات|1324|m|*|logistics.manager
logistics-supervisor|Logistics Supervisor|مشرف لوجستيات|3324|l|*|logistics.supervisor
logistics-specialist|Logistics Specialist / Coordinator|أخصائي لوجستيات|3324|x,s,i,j|*|logistics.specialist
warehouse-manager|Warehouse Manager|مدير مستودعات|1324|m|*|warehouse.manager
warehouse-supervisor|Warehouse Supervisor|مشرف مستودعات|3324|l|*|warehouse.supervisor
storekeeper|Storekeeper|أمين مستودع|4321|x,s,i,j|*|warehouse.specialist
warehouse-clerk|Warehouse Clerk|موظف مستودع|4321|i,j|*|warehouse.specialist
stock-counter|Stock Counter|جرّاد مخزون|4321|i,j|*|scm.inventory-controller
warehouse-worker|Warehouse Worker / Loader|عامل مستودع|9333|b|*|
picker-packer|Picker / Packer|عامل تجهيز طلبات|9321|b|@retail,@log|
shelf-filler|Shelf Filler|مرتّب أرفف|9334|b|@retail|
forklift-operator|Forklift Operator|مشغّل رافعة شوكية|8344|s,i,j|*|log.forklift-operator
freight-coordinator|Freight / Shipping Coordinator|منسق شحن|3331|x,s,i,j|@log,maritime-ports,aviation,wholesale|scm.freight
freight-forwarder|Freight Forwarder|مخلّص شحن (فريت فورورد)|3331|x,s,i,j|@log,maritime-ports,aviation|scm.freight
customs-clearance-officer|Customs Clearance Officer|مخلّص جمركي|3331|x,s,i,j|*|scm.customs-clearance
import-export-specialist|Import / Export Specialist|أخصائي استيراد وتصدير|3331|x,s,i|*|scm.customs-clearance
dispatcher|Dispatcher|منسق إرسال وتوزيع|4323|x,i,j|@log,road-transport,facility-management|log.dispatcher
transport-manager|Transport Manager|مدير نقل|1324|m|*|transport.manager
transport-coordinator|Transport Coordinator|منسق نقل|4323|x,s,i,j|*|transport.specialist
fleet-manager|Fleet Manager|مدير أسطول|1324|m,l|*|transport.manager
fleet-coordinator|Fleet Coordinator|منسق أسطول|4323|x,i,j|*|transport.specialist
planning-manager|Planning Manager|مدير تخطيط|1219|m|*|planning.manager
planning-supervisor|Planning Supervisor|مشرف تخطيط|3341|l|*|planning.supervisor
courier|Courier / Delivery Rider|مندوب توصيل|8321|i,j,b|courier-postal,ecommerce,@retail,restaurants-cafes,pharmacies|log.courier
postal-clerk|Postal Clerk|موظف بريد|4412|i,j|courier-postal|
@@drv
private-driver|Private Driver|سائق خاص|8322|i,j,b|*|log.driver
taxi-driver|Taxi / Ride-hailing Driver|سائق تاكسي / تطبيقات نقل|8322|i,j,b|road-transport|log.driver
delivery-driver|Delivery Driver (Van)|سائق توصيل (فان)|8322|i,j,b|@log,@retail,fmcg,catering-services,wholesale|log.driver
limousine-driver|Limousine / Chauffeur|سائق ليموزين|8322|s,i,j|road-transport,@hosp|log.driver
truck-driver|Heavy Truck Driver|سائق شاحنة ثقيلة|8332|s,i,j|@log,@con,wholesale,@mining|log.driver
trailer-driver|Trailer Driver|سائق تريلا|8332|s,i,j|@log,@con,wholesale|log.driver
tanker-driver|Tanker Driver|سائق صهريج|8332|s,i,j|@log,@energy,water-utilities|log.driver
dump-truck-driver|Dump Truck Driver|سائق قلاب|8332|i,j|@con,@mining|log.driver
bus-driver|Bus Driver|سائق حافلة|8331|s,i,j|road-transport,@edu,@hosp,tourism-hospitality|log.driver
school-bus-driver|School Bus Driver|سائق حافلة مدرسية|8331|i,j|education,higher-education,road-transport|log.driver
staff-bus-driver|Staff Transport Driver|سائق نقل موظفين|8331|i,j|road-transport,@ind,@con,@energy|log.driver
@@rail
train-driver|Train Driver|سائق قطار|8311|s,i|rail-transport|
railway-signal-operator|Railway Signal Operator|مشغّل إشارات سكك حديدية|8312|s,i|rail-transport|
train-attendant|Train Attendant|مضيف قطار|5112|i,j|rail-transport|
@@sea
ship-captain|Ship Master / Captain|ربّان سفينة|3152|s,m|maritime-ports,fishing-aquaculture,oilfield-services|
deck-officer|Deck Officer|ضابط سطح سفينة|3152|s,i,j|maritime-ports,oilfield-services|
ship-engineer|Ship Engineer|مهندس سفن (ضابط محركات)|3151|s,i,j|maritime-ports,oilfield-services|
seaman|Able Seaman / Deck Crew|بحّار|8350|b|maritime-ports,fishing-aquaculture,oilfield-services|
harbour-pilot|Harbour Pilot|مرشد بحري|3152|s|maritime-ports|
marine-surveyor|Marine Surveyor|معاين بحري|3152|s,i|maritime-ports,testing-inspection|
shipping-agent|Shipping Agent|وكيل ملاحي|3331|x,s,i|maritime-ports,logistics|
port-operations-manager|Port Operations Manager|مدير عمليات ميناء|1324|m|maritime-ports|
terminal-equipment-operator|Container Terminal Equipment Operator|مشغّل معدات محطة حاويات|8344|s,i,j|maritime-ports,logistics|
stevedore|Stevedore / Dock Worker|عامل رصيف (شحن وتفريغ)|9333|b|maritime-ports,logistics|
@@avi
airline-pilot|Airline Pilot|طيّار|3153|s,i,j|aviation,defense-security|tour.pilot
flight-instructor|Flight Instructor|مدرب طيران|3153|s,i|aviation,training-vocational|
cabin-crew|Flight Attendant / Cabin Crew|مضيف طيران|5111|i,j|aviation|tour.cabin-crew
air-traffic-controller|Air Traffic Controller|مراقب حركة جوية|3154|s,i,j|aviation,airports-ground-handling,government|
flight-dispatcher|Flight Dispatcher|مرسل رحلات|4323|s,i,j|aviation|
aircraft-technician|Aircraft Maintenance Technician|فني صيانة طائرات|7232|s,i,j|aviation,airports-ground-handling,aerospace-transport-equipment|tour.aircraft-technician
aircraft-maintenance-engineer|Aircraft Maintenance Engineer (B1/B2)|مهندس صيانة طائرات|7232|s,i|aviation,aerospace-transport-equipment|tour.aircraft-technician
avionics-technician|Avionics Technician|فني إلكترونيات طيران|7421|s,i,j|aviation,aerospace-transport-equipment,defense-security|tour.aircraft-technician
ground-services-agent|Airport / Ground Services Agent|موظف خدمات أرضية|4229|x,i,j|airports-ground-handling,aviation|tour.airport-agent
check-in-agent|Check-in Agent|موظف إنهاء إجراءات سفر|4221|i,j|airports-ground-handling,aviation|tour.airport-agent
ramp-agent|Ramp Agent / Baggage Handler|عامل ساحة وأمتعة|9333|b|airports-ground-handling,aviation|
load-controller|Load Controller|مراقب أحمال طائرات|4323|s,i|aviation,airports-ground-handling|
air-cargo-agent|Air Cargo Agent|موظف شحن جوي|3331|x,i,j|aviation,airports-ground-handling,logistics|
aviation-security-officer|Aviation Security Officer|ضابط أمن مطار|5414|i,j|airports-ground-handling,aviation,security-services|
airport-operations-manager|Airport Operations Manager|مدير عمليات مطار|1324|m|airports-ground-handling|
drone-operator|Drone Operator|مشغّل طائرات مسيّرة|3153|s,i,j|@energy,@con,agri-crops,architecture-engineering,media-marketing,defense-security|
@@hosp
executive-chef|Executive Chef|شيف تنفيذي|3434|m,d|@hosp|hosp.executive-chef
executive-sous-chef|Executive Sous Chef|نائب الشيف التنفيذي|3434|m|@hosp|hosp.executive-sous-chef
head-chef|Head Chef / Chef de Cuisine|رئيس الطهاة (شيف رئيسي)|3434|m,l|@hosp|hosp.head-chef
sous-chef|Sous Chef|سو شيف|3434|l,s|@hosp|hosp.sous-chef
chef-de-partie|Chef de Partie (CDP)|شيف قسم (CDP)|3434|s,i|@hosp|hosp.chef-de-partie
demi-chef-de-partie|Demi Chef de Partie (Demi CDP)|ديمي شيف قسم (Demi CDP)|3434|i,j|@hosp|hosp.demi-chef-de-partie
commis-chef|Commis Chef|كومي شيف|5120|j|@hosp|hosp.commis-chef
cook|Cook|طباخ|5120|i,j,b|@hosp,@health,@edu,@ind,@con|hosp.cook
arabic-cuisine-chef|Arabic Cuisine Chef|شيف مطبخ عربي|3434|s,i,j|@hosp|hosp.chef-unspecified
indian-cuisine-chef|Indian Cuisine Chef|شيف مطبخ هندي|3434|s,i,j|@hosp|hosp.chef-unspecified
asian-cuisine-chef|Asian Cuisine Chef|شيف مطبخ آسيوي|3434|s,i,j|@hosp|hosp.chef-unspecified
italian-cuisine-chef|Italian Cuisine Chef|شيف مطبخ إيطالي|3434|s,i,j|@hosp|hosp.chef-unspecified
sushi-chef|Sushi Chef|شيف سوشي|3434|s,i,j|@hosp|hosp.chef-unspecified
banquet-chef|Banquet Chef|شيف مآدب|3434|s,i|hotels-resorts,catering-services,events-exhibitions|hosp.chef-unspecified
grill-cook|Grill Cook|طباخ مشويات|5120|s,i,j|restaurants-cafes,catering-services,hotels-resorts|hosp.cook
tandoor-cook|Tandoor Cook|طباخ تنور (تندوري)|5120|s,i,j|restaurants-cafes,catering-services,hotels-resorts|hosp.cook
shawarma-cook|Shawarma Cook|طباخ شاورما|5120|i,j|restaurants-cafes|hosp.cook
pizza-maker|Pizza Maker|صانع بيتزا|5120|i,j|restaurants-cafes,catering-services|hosp.cook
cold-kitchen-cook|Cold Kitchen (Garde Manger) Cook|طباخ مطبخ بارد|5120|s,i,j|@hosp|hosp.cook
mass-catering-cook|Camp / Mass Catering Cook|طباخ إعاشة (مخيمات وتموين جماعي)|5120|i,j,b|catering-services,@con,@energy,@mining|hosp.cook
fast-food-preparer|Fast Food Preparer|عامل وجبات سريعة|9411|j,b|restaurants-cafes|hosp.crew-member
kitchen-supervisor|Kitchen Supervisor|مشرف مطبخ|3434|l|@hosp,@health|hosp.kitchen-supervisor
kitchen-manager|Kitchen Manager|مدير مطبخ|1412|m|@hosp,@health|hosp.kitchen-manager
kitchen-helper|Kitchen Helper|مساعد مطبخ|9412|b|@hosp,@health,@edu|hosp.kitchen-helper
steward|Kitchen Steward / Dishwasher|ستيوارد مطبخ (غسّال أطباق)|9412|b|@hosp,@health|hosp.steward
chief-steward|Chief Steward|رئيس ستيوارد|9412|l|@hosp|hosp.chief-steward
food-cost-controller|Food and Beverage Cost Controller|مراقب تكاليف أغذية ومشروبات|4312|x,s,i|@hosp|hosp.fb-manager
pastry-commis|Pastry Commis / Pastry Cook|كومي حلويات|7512|j|@hosp,food-manufacturing|hosp.pastry-commis
pastry-cdp|Pastry Chef de Partie|شيف قسم حلويات|7512|s,i|@hosp,food-manufacturing|hosp.pastry-cdp
pastry-chef|Pastry Chef|شيف حلويات|7512|s,m|@hosp,food-manufacturing|hosp.pastry-chef
pastry-sous-chef|Pastry Sous Chef|سو شيف حلويات|7512|l,s|@hosp|hosp.pastry-sous-chef
head-pastry-chef|Head / Executive Pastry Chef|رئيس شيف حلويات (تنفيذي)|7512|m|@hosp|hosp.head-pastry-chef
baker|Baker|خبّاز|7512|s,i,j|@hosp,food-manufacturing,supermarkets|hosp.baker
arabic-sweets-maker|Arabic Sweets Maker (Halawani)|حلواني (صانع حلويات عربية)|7512|s,i,j|restaurants-cafes,food-manufacturing,retail|hosp.pastry-cdp
coffee-roaster|Coffee Roaster|محمّص قهوة|7515|s,i|restaurants-cafes,beverages,food-manufacturing|
barista|Barista|باريستا|5132|s,i,j|restaurants-cafes,@hosp,retail|hosp.barista
head-barista|Head Barista|رئيس باريستا|5132|l|restaurants-cafes,@hosp|hosp.head-barista
arabic-coffee-server|Arabic Coffee Server (Gahwaji)|قهوجي (مقدّم قهوة عربية)|5131|i,j|@hosp,events-exhibitions,government|
tea-maker|Tea Maker|صانع شاي|5246|j,b|restaurants-cafes,@hosp|
juice-maker|Juice Maker|عامل عصائر|9411|j,b|restaurants-cafes|
bartender|Bartender / Beverage Mixologist|مُعدّ مشروبات (باتندر)|5132|s,i,j|@hosp|hosp.bartender
head-bartender|Head Bartender / Bar Supervisor|رئيس باتندر / مشرف بار|5132|l|@hosp|hosp.head-bartender
bar-manager|Bar Manager|مدير بار|1412|m|@hosp|hosp.bar-manager
food-runner|Food Runner|مساعد نادل (فود رنر)|9412|j,b|@hosp|hosp.food-runner
waiter|Waiter / Server|نادل|5131|s,i,j|@hosp,events-exhibitions|hosp.waiter
banquet-waiter|Banquet Waiter|نادل مآدب|5131|i,j|hotels-resorts,catering-services,events-exhibitions|hosp.waiter
room-service-attendant|Room Service Attendant|موظف خدمة غرف|5131|i,j|hotels-resorts,tourism-hospitality|hosp.waiter
captain-waiter|Captain Waiter|كابتن نادل|5131|l,s|@hosp|hosp.captain
head-waiter|Head Waiter / Maitre d'|رئيس نادل|5131|l|@hosp|hosp.head-waiter
host|Host / Hostess|مضيف مطعم|4226|i,j|@hosp|hosp.host
counter-attendant|Counter Attendant|موظف كاونتر|5246|i,j,b|restaurants-cafes,@retail|hosp.crew-member
crew-member|Restaurant Crew Member|عضو فريق مطعم|5246|j,b|restaurants-cafes|hosp.crew-member
restaurant-supervisor|Restaurant / Shift Supervisor|مشرف مطعم / وردية|5151|l|restaurants-cafes,@hosp|hosp.restaurant-supervisor
shift-manager|Duty / Shift Manager|مدير مناوب / مدير وردية|1412|l,m|@hosp,@retail|hosp.shift-manager
assistant-restaurant-manager|Assistant Restaurant Manager|مساعد مدير مطعم|1412|l,m|restaurants-cafes,@hosp|hosp.restaurant-manager
restaurant-manager|Restaurant Manager|مدير مطعم|1412|m|restaurants-cafes,@hosp|hosp.restaurant-manager
fb-manager|Food and Beverage Manager|مدير الأغذية والمشروبات|1412|m,d|@hosp|hosp.fb-manager
franchise-manager|Franchise Manager|مدير امتياز تجاري|1439|m|restaurants-cafes,@retail,@hosp|
catering-supervisor|Catering Supervisor|مشرف تموين|5151|l|catering-services,@hosp|hosp.catering-supervisor
catering-manager|Catering Manager|مدير تموين وتقديم الطعام|1412|m|catering-services,@hosp|hosp.catering-manager
hotel-manager|Hotel Manager|مدير فندق|1411|m,d|hotels-resorts,tourism-hospitality|hosp.hotel-manager
assistant-hotel-manager|Assistant Hotel Manager|مساعد مدير فندق|1411|m,l|hotels-resorts,tourism-hospitality|hosp.hotel-manager
rooms-division-manager|Rooms Division Manager|مدير قسم الغرف|1411|m|hotels-resorts|hosp.front-office-manager
front-office-manager|Front Office Manager|مدير مكتب أمامي|1411|m|hotels-resorts|hosp.front-office-manager
front-office-supervisor|Front Office Supervisor|مشرف مكتب أمامي|4224|l|hotels-resorts|hosp.front-office-supervisor
front-desk-agent|Front Desk Agent|موظف استقبال فندقي|4224|i,j|hotels-resorts|hosp.front-office-supervisor
night-auditor|Night Auditor|مدقق ليلي|4224|i,j|hotels-resorts|
guest-relations-officer|Guest Relations Officer|موظف علاقات ضيوف|4224|x,i,j|hotels-resorts,tourism-hospitality|hosp.guest-relations
reservations-agent|Reservations Agent|موظف حجوزات|4229|i,j|hotels-resorts,tourism-hospitality,aviation|hosp.reservations
reservations-manager|Reservations Manager|مدير حجوزات|1411|m,l|hotels-resorts,tourism-hospitality|hosp.reservations-manager
hospitality-revenue-manager|Revenue Manager (Hospitality)|مدير إيرادات (ضيافة)|1411|m,l|hotels-resorts,tourism-hospitality|
hotel-sales-manager|Hotel Sales Manager|مدير مبيعات فندقية|1221|m,l|hotels-resorts,tourism-hospitality|
housekeeping-supervisor|Housekeeping Supervisor|مشرف تدبير فندقي|5151|l|hotels-resorts,@health,facility-management|hosp.housekeeping-supervisor
housekeeping-manager|Executive Housekeeper|مدير تدبير فندقي|1411|m|hotels-resorts,facility-management|hosp.housekeeping-manager
room-attendant|Room Attendant|عامل / عاملة تنظيف غرف|9112|b|hotels-resorts,@health|hosp.housekeeping-supervisor
public-area-cleaner|Public Area Cleaner|عامل نظافة مرافق عامة|9112|b|@hosp,facility-management,@retail|
concierge|Concierge|كونسيرج|5151|s,i,j|hotels-resorts,tourism-hospitality|hosp.concierge
bellman|Bellman / Doorman|حمّال أمتعة / بوّاب فندق|9621|j,b|hotels-resorts|hosp.bellman
valet-attendant|Valet Parking Attendant|عامل صف سيارات (فاليه)|5169|j,b|@hosp,@retail,@health,events-exhibitions|
butler|Butler|خادم شخصي (بتلر)|5162|s,i|hotels-resorts,household-domestic|hosp.butler
spa-manager|Spa Manager|مدير سبا ومنتجع صحي|1439|m|hotels-resorts,beauty-wellness|
lifeguard|Lifeguard|منقذ سباحة|5419|i,j|hotels-resorts,sports-recreation,tourism-hospitality|
activity-instructor|Activity / Recreation Instructor|مدرب أنشطة وترفيه|3423|s,i,j|hotels-resorts,tourism-hospitality,sports-recreation|hosp.activity-instructor
compound-manager|Compound / Camp Manager|مدير مجمّع سكني|1439|m|real-estate-services,hotels-resorts,@energy,@con|hosp.compound-manager
@@tour
travel-consultant|Travel Consultant|مستشار سفر|4221|x,s,i,j|travel-agencies,tourism-hospitality|tour.travel-consultant
ticketing-agent|Ticketing Agent|موظف حجز تذاكر|4221|i,j|travel-agencies,aviation|tour.travel-consultant
tour-guide|Tour Guide|مرشد سياحي|5113|s,i,j|tourism-hospitality,travel-agencies,arts-entertainment|tour.tour-guide
tour-operations-specialist|Tour Operations Specialist|أخصائي برامج سياحية|3339|x,s,i|travel-agencies,tourism-hospitality|tour.travel-consultant
hajj-umrah-coordinator|Hajj and Umrah Services Coordinator|منسق خدمات حج وعمرة|3339|x,s,i|travel-agencies,tourism-hospitality|
mutawwif|Pilgrim Guide (Mutawwif)|مطوّف|5113|s,i|tourism-hospitality,travel-agencies|
visitor-services-officer|Visitor Services Officer|موظف خدمات زوار|4229|x,i,j|tourism-hospitality,arts-entertainment,government|
destination-marketing-specialist|Destination Marketing Specialist|أخصائي تسويق وجهات سياحية|2431|x,s,i|tourism-hospitality,government|
@@event
event-planner|Event Planner / Coordinator|منسق فعاليات|3332|x,s,i,j|events-exhibitions,@hosp,@pro,*|hosp.event-planner
event-manager|Event Manager|مدير فعاليات|3332|m,l|events-exhibitions,@hosp,*|hosp.event-manager
exhibition-manager|Exhibition Manager|مدير معارض|3332|m,l|events-exhibitions|hosp.event-manager
audiovisual-technician|Audio-Visual Technician|فني صوت وإضاءة|3521|s,i,j|events-exhibitions,arts-entertainment,@hosp,broadcasting|
event-usher|Event Hospitality Staff / Usher|منظّم فعاليات (استقبال وضيافة)|5169|j,b|events-exhibitions,arts-entertainment,sports-recreation|
protocol-officer|Protocol Officer|مسؤول بروتوكول|3339|x,s,i|government,international-organizations,events-exhibitions|
@@health
medical-director|Medical Director|المدير الطبي|1342|d,m|@health,medical-devices,healthtech|health.hospital-manager
hospital-manager|Hospital / Healthcare Manager|مدير مستشفى / منشأة صحية|1342|m,d|@health|health.hospital-manager
clinic-manager|Clinic Manager|مدير عيادة / مجمع طبي|1342|m|clinics,@health|health.hospital-manager
general-practitioner|General Practitioner|طبيب عام|2211|s,i,j|@health,government|health.physician
family-physician|Family Medicine Physician|طبيب أسرة|2211|s,i,j|@health,government|health.physician
internal-medicine-physician|Internal Medicine Physician|طبيب باطنة|2212|s,i,j|@health|health.physician
pediatrician|Pediatrician|طبيب أطفال|2212|s,i,j|@health|health.physician
obstetrician-gynecologist|Obstetrician and Gynaecologist|طبيب نساء وولادة|2212|s,i,j|@health|health.physician
general-surgeon|General Surgeon|جرّاح عام|2212|s,i,j|@health|health.physician
orthopedic-surgeon|Orthopaedic Surgeon|جرّاح عظام|2212|s,i,j|@health|health.physician
neurosurgeon|Neurosurgeon|جرّاح مخ وأعصاب|2212|s,i|@health|health.physician
plastic-surgeon|Plastic and Cosmetic Surgeon|جرّاح تجميل|2212|s,i|@health|health.physician
cardiologist|Cardiologist|طبيب قلب|2212|s,i,j|@health|health.physician
dermatologist|Dermatologist|طبيب جلدية|2212|s,i,j|@health|health.physician
ophthalmologist|Ophthalmologist|طبيب عيون|2212|s,i,j|@health|health.physician
ent-physician|ENT Physician|طبيب أنف وأذن وحنجرة|2212|s,i,j|@health|health.physician
neurologist|Neurologist|طبيب أعصاب|2212|s,i,j|@health|health.physician
psychiatrist|Psychiatrist|طبيب نفسي|2212|s,i,j|@health,social-care|health.physician
urologist|Urologist|طبيب مسالك بولية|2212|s,i,j|@health|health.physician
oncologist|Oncologist|طبيب أورام|2212|s,i|@health|health.physician
endocrinologist|Endocrinologist|طبيب غدد صماء وسكري|2212|s,i|@health|health.physician
gastroenterologist|Gastroenterologist|طبيب جهاز هضمي|2212|s,i|@health|health.physician
pulmonologist|Pulmonologist|طبيب صدرية|2212|s,i|@health|health.physician
nephrologist|Nephrologist|طبيب كلى|2212|s,i|@health|health.physician
rheumatologist|Rheumatologist|طبيب روماتيزم|2212|s,i|@health|health.physician
anesthesiologist|Anaesthesiologist|طبيب تخدير|2212|s,i,j|@health|health.physician
emergency-physician|Emergency Medicine Physician|طبيب طوارئ|2212|s,i,j|@health|health.physician
radiologist|Radiologist|طبيب أشعة|2212|s,i,j|@health|health.physician
pathologist|Pathologist|طبيب مختبرات وأمراض|2212|s,i|@health|health.physician
dentist|Dentist|طبيب أسنان|2261|s,i,j|clinics,@health|health.dentist
orthodontist|Orthodontist|طبيب تقويم أسنان|2261|s,i|clinics,@health|health.dentist
dental-assistant|Dental Assistant|مساعد طبيب أسنان|3251|i,j|clinics,@health|health.dentist
dental-hygienist|Dental Hygienist|أخصائي صحة الفم والأسنان|3251|s,i,j|clinics,@health|health.dentist
dental-technician|Dental Lab Technician|فني مختبر أسنان|3214|s,i,j|clinics,@health,medical-devices|health.dentist
registered-nurse|Registered Nurse|ممرض / ممرضة|2221|s,i,j|@health,education,social-care|health.nurse
head-nurse|Head Nurse / Nurse Manager|رئيس تمريض|1342|l,m|@health|health.nurse
director-of-nursing|Director of Nursing|مدير التمريض|1342|d|@health|health.nurse
nursing-assistant|Nursing Assistant|مساعد تمريض|3221|i,j|@health,social-care|health.nurse
midwife|Midwife|قابلة (مولّدة)|2222|s,i,j|@health|health.nurse
home-care-nurse|Home Care Nurse|ممرض رعاية منزلية|2221|s,i,j|@health,social-care|health.nurse
operating-room-technician|Operating Room Technician|فني عمليات|3221|s,i,j|hospitals,healthcare|health.nurse
anesthesia-technician|Anaesthesia Technician|فني تخدير|3259|s,i,j|hospitals,healthcare|health.physician
caregiver|Caregiver / Patient Companion|مرافق / مقدم رعاية|5321|b|@health,social-care,household-domestic|
healthcare-assistant|Healthcare Assistant|مساعد رعاية صحية|5321|j,b|@health,social-care|
elderly-caregiver|Elderly Caregiver|مرافق كبار سن|5322|j,b|social-care,household-domestic|
hospital-orderly|Hospital Orderly / Porter|مساعد خدمات مستشفى (ناقل مرضى)|9629|b|hospitals,healthcare|
pharmacist|Pharmacist|صيدلي|2262|s,i,j|pharmacies,@health,pharma-manufacturing|health.pharmacist
clinical-pharmacist|Clinical Pharmacist|صيدلي إكلينيكي|2262|s,i|hospitals,healthcare|health.pharmacist
pharmacy-technician|Pharmacy Technician / Assistant|مساعد صيدلي|3213|i,j|pharmacies,@health|health.pharmacist
pharmacy-manager|Pharmacy Manager|مدير صيدلية|1420|m|pharmacies,hospitals|health.pharmacist
regulatory-affairs-specialist|Regulatory Affairs Specialist (Pharma)|أخصائي شؤون تنظيمية دوائية|2262|x,s,i|pharma-manufacturing,medical-devices,pharmacies|
pharmacovigilance-officer|Pharmacovigilance Officer|مسؤول سلامة دوائية|2262|x,s,i|pharma-manufacturing,@health|
clinical-research-coordinator|Clinical Research Coordinator|منسق أبحاث سريرية|2269|x,s,i|@health,rnd-scientific,pharma-manufacturing|
medical-lab-technologist|Medical Laboratory Technologist|فني مختبر طبي|3212|s,i,j|diagnostics-labs,@health|health.lab-technician
phlebotomist|Phlebotomist|فني سحب دم|3212|i,j|diagnostics-labs,@health|health.lab-technician
radiology-technologist|Radiology Technologist|فني أشعة|3211|s,i,j|diagnostics-labs,@health|health.radiology-technician
mri-ct-technologist|MRI / CT Technologist|فني رنين مغناطيسي وأشعة مقطعية|3211|s,i,j|diagnostics-labs,@health|health.radiology-technician
sonographer|Sonographer|أخصائي موجات صوتية|3211|s,i,j|diagnostics-labs,@health|health.radiology-technician
physiotherapist|Physiotherapist|أخصائي علاج طبيعي|2264|s,i,j|@health,sports-recreation,social-care|health.therapist
occupational-therapist|Occupational Therapist|أخصائي علاج وظيفي|2269|s,i,j|@health,social-care|health.therapist
speech-therapist|Speech and Language Therapist|أخصائي نطق وتخاطب|2266|s,i,j|@health,social-care,education|health.therapist
respiratory-therapist|Respiratory Therapist|أخصائي علاج تنفسي|3255|s,i,j|hospitals,healthcare|health.therapist
audiologist|Audiologist|أخصائي سمع|2266|s,i|@health|health.therapist
optometrist|Optometrist|أخصائي بصريات|2267|s,i,j|@health,retail|health.therapist
optician|Dispensing Optician|فني نظارات|3254|i,j|retail,clinics|
paramedic|Paramedic / EMT|مسعف / فني طوارئ طبية|3258|s,i,j|@health,government|health.paramedic
ambulance-driver|Ambulance Driver|سائق إسعاف|3258|i,j|@health,government|health.paramedic
nutritionist|Dietitian / Nutritionist|أخصائي تغذية|2265|s,i,j|@health,@hosp,sports-recreation,education|health.nutritionist
psychologist|Psychologist|أخصائي نفسي|2634|s,i,j|@health,social-care,education|health.psychologist
behavior-analyst|Behaviour Analyst (ABA)|أخصائي تعديل سلوك|2634|s,i,j|social-care,@health,education|health.psychologist
counselor|Counsellor|مرشد / مستشار نفسي واجتماعي|2635|s,i,j|social-care,@health,education,nonprofit|health.psychologist
public-health-specialist|Public Health Specialist|أخصائي صحة عامة|2263|x,s,i|@health,government|health.public-health
infection-control-specialist|Infection Control Specialist|أخصائي مكافحة العدوى|2263|x,s,i|@health|health.public-health
healthcare-quality-specialist|Healthcare Quality Specialist (CBAHI)|أخصائي جودة رعاية صحية (سباهي)|2269|x,s,i|@health|health.public-health
health-informatics-specialist|Health Informatics Specialist|أخصائي معلوماتية صحية|3252|x,s,i|@health,healthtech|
medical-coder|Medical Coder|مرمّز طبي|3252|x,i,j|@health,insurance|
medical-records-officer|Medical Records Officer|موظف سجلات طبية|3252|i,j|@health|
medical-secretary|Medical Secretary|سكرتير طبي|3344|i,j|@health|
patient-services-coordinator|Patient Services Coordinator|منسق خدمات المرضى|4229|x,i,j|@health|health.patient-services
alternative-medicine-practitioner|Traditional and Alternative Medicine Practitioner|ممارس طب بديل|3230|s,i|clinics,healthcare,beauty-wellness|
biomedical-equipment-technician|Biomedical Equipment Technician|فني أجهزة طبية|7421|s,i,j|@health,medical-devices|
veterinary-technician|Veterinary Technician|فني بيطري|3240|i,j|veterinary-services,agri-livestock|
@@edu
teacher|Teacher|معلم|2330|s,i,j|@edu|edu.teacher
kindergarten-teacher|Kindergarten / Early Childhood Teacher|معلمة رياض أطفال|2342|s,i,j|education|edu.teacher
primary-teacher|Primary School Teacher|معلم مرحلة ابتدائية|2341|s,i,j|education|edu.teacher
secondary-teacher|Secondary School Teacher|معلم مرحلة ثانوية|2330|s,i,j|education|edu.teacher
math-teacher|Mathematics Teacher|معلم رياضيات|2330|s,i,j|education,training-vocational|edu.teacher
science-teacher|Science Teacher|معلم علوم|2330|s,i,j|education|edu.teacher
arabic-teacher|Arabic Language Teacher|معلم لغة عربية|2330|s,i,j|education|edu.teacher
islamic-studies-teacher|Islamic Studies Teacher|معلم تربية إسلامية|2330|s,i,j|education|edu.teacher
english-teacher|English Language Teacher|معلم لغة إنجليزية|2353|s,i,j|@edu|edu.english-teacher
foreign-language-teacher|Foreign Language Teacher (French, Chinese, …)|معلم لغات أجنبية|2353|s,i,j|@edu|edu.english-teacher
arabic-for-non-native-teacher|Arabic for Non-native Speakers Teacher|معلم عربية لغير الناطقين بها|2353|s,i,j|@edu|edu.teacher
computer-science-teacher|Computer Science Teacher|معلم حاسب آلي|2330|s,i,j|education|edu.teacher
pe-teacher|Physical Education Teacher|معلم تربية بدنية|2330|s,i,j|education|edu.teacher
art-teacher|Art Teacher|معلم تربية فنية|2355|s,i,j|education,training-vocational|edu.teacher
music-teacher|Music Teacher|معلم موسيقى|2354|s,i,j|education,training-vocational,arts-entertainment|edu.teacher
special-needs-teacher|Special Needs Teacher|معلم تربية خاصة|2352|s,i,j|education,social-care|edu.teacher
teaching-assistant|Teaching Assistant|مساعد معلم|5312|i,j|education|edu.teaching-assistant
nursery-manager|Nursery Manager|مدير حضانة|1341|m|education|edu.principal
principal|School Principal|مدير مدرسة|1345|m,d|education|edu.principal
vice-principal|Vice Principal|وكيل مدرسة|1345|l,m|education|edu.principal
academic-department-head|Academic Department Head|رئيس قسم أكاديمي|1345|l,m|higher-education,education|edu.principal
academic-supervisor|Academic / Educational Supervisor|مشرف أكاديمي / تربوي|2351|l,s|@edu|edu.academic-supervisor
curriculum-developer|Curriculum Developer|مطوّر مناهج|2351|x,s,i|@edu,edtech|edu.instructional-designer
instructional-designer|Instructional Designer|مصمم تعليمي|2351|x,s,i|@edu,edtech,@pro|edu.instructional-designer
e-learning-developer|E-learning Developer|مطوّر تعليم إلكتروني|2351|x,s,i|@edu,edtech|edu.instructional-designer
school-counselor|School Counsellor|مرشد طلابي|2635|s,i,j|education,higher-education|edu.academic-supervisor
school-lab-technician|School Lab Technician|فني مختبر مدرسي|3111|i,j|education,higher-education|
school-nurse|School Nurse|ممرض مدرسة|2221|s,i,j|education|health.nurse
lecturer|Lecturer|محاضر جامعي|2310|s,i,j|higher-education|edu.lecturer
professor|Professor|أستاذ جامعي|2310|s,l|higher-education|edu.lecturer
university-teaching-assistant|University Teaching Assistant (Muid)|معيد جامعي|2310|j|higher-education|edu.lecturer
private-tutor|Private Tutor|معلم خصوصي|2359|s,i,j|@edu,edtech,household-domestic|edu.teacher
vocational-instructor|Vocational Instructor|مدرب مهني|2320|s,i,j|training-vocational,higher-education,@ind,@con|hr.trainer
technical-trainer|Technical Trainer|مدرب فني|2320|s,i,j|training-vocational,@ind,@energy,@it|hr.trainer
hse-trainer|HSE Trainer|مدرب سلامة|2424|s,i|training-vocational,@con,@energy,@ind|hr.trainer
driving-instructor|Driving Instructor|مدرب قيادة|5165|s,i,j|training-vocational,road-transport|
academic-advisor|Academic Advisor|مرشد أكاديمي|2359|x,s,i|higher-education,training-vocational|edu.student-affairs
student-affairs-officer|Student Affairs / Admissions Officer|مسؤول شؤون الطلاب والقبول|3359|x,i,j|@edu|edu.student-affairs
registrar|Registrar|مسجّل أكاديمي|4110|x,s,i|higher-education,education,training-vocational|edu.student-affairs
quran-teacher|Quran Teacher|معلم قرآن كريم|2359|s,i,j|@edu,nonprofit|oth.religious
imam|Imam / Muezzin|إمام / مؤذن|2636|s,i,j|government,nonprofit|oth.religious
@@safety
hse-director|HSE Director|مدير عام السلامة والصحة والبيئة|1219|d|*|hse.manager
hse-manager|HSE Manager|مدير سلامة وصحة مهنية|1219|m|*|hse.manager
hse-supervisor|HSE Supervisor|مشرف سلامة|3257|l|*|hse.supervisor
hse-officer|HSE / Safety Officer|مسؤول سلامة وصحة مهنية|3257|x,s,i,j|*|hse.officer
hse-engineer|HSE Engineer|مهندس سلامة|2263|s,i,j|*|hse.officer
safety-inspector|Safety Inspector|مفتش سلامة|3257|s,i,j|*|hse.officer
fire-safety-officer|Fire Safety Officer|مسؤول سلامة من الحريق|3257|x,s,i,j|*|hse.officer
firefighter|Firefighter|رجل إطفاء|5411|s,i,j|@energy,@ind,airports-ground-handling,government,defense-security,@con|
first-aider|First Aider / Safety Medic|مسعف سلامة (إسعافات أولية)|3258|i,j|@con,@energy,@ind,@mining,events-exhibitions|
environmental-officer|Environmental Officer|مسؤول بيئة|2133|x,s,i,j|*|
industrial-hygienist|Industrial Hygienist|أخصائي صحة صناعية|2263|x,s,i|@energy,@ind,@con,@mining|
emergency-response-coordinator|Emergency Response Coordinator|منسق استجابة للطوارئ|3339|x,s,i|@energy,@ind,government,@health,airports-ground-handling|
@@sec
security-guard|Security Guard|حارس أمن|5414|i,j,b|*|svc.security-guard
security-supervisor|Security Supervisor|مشرف أمن|5414|l|*|svc.security-supervisor
security-manager|Security Manager|مدير أمن|1349|m,d|*|svc.security-manager
female-security-guard|Female Security Officer|حارسة أمن (أمن نسائي)|5414|i,j|@retail,@edu,@health,@hosp,events-exhibitions,government|svc.security-guard
gate-keeper|Gate Keeper|حارس بوابة|5414|j,b|*|svc.security-guard
cctv-operator|CCTV / Control Room Operator|مشغّل كاميرات مراقبة|5419|i,j|security-services,@retail,@hosp,government|svc.security-guard
close-protection-officer|Close Protection Officer|حارس شخصي|5419|s,i|security-services,@hosp,defense-security|svc.security-guard
loss-prevention-officer|Loss Prevention Officer|مسؤول منع الفاقد|5419|x,i,j|@retail|svc.security-guard
security-investigator|Security Investigator|محقق أمني|3355|x,s,i|security-services,@fin,@retail|
security-consultant|Security Consultant|مستشار أمن|2422|s,x|security-services,defense-security,@pro|
defense-procurement-specialist|Defence Procurement Specialist|أخصائي مشتريات دفاعية|3323|x,s,i|defense-security|
@@svc
office-cleaner|Office Cleaner|عامل نظافة مكاتب|9112|b|facility-management,*|svc.cleaner
cleaner|Cleaner / General Worker|عامل نظافة / عامل عام|9112|b|facility-management,*|svc.cleaner
street-sweeper|Street Sweeper|عامل نظافة شوارع|9613|b|waste-recycling,government,facility-management|svc.cleaner
waste-collector|Waste Collector|عامل جمع نفايات|9611|b|waste-recycling,government,facility-management|svc.cleaner
recycling-sorter|Recycling Sorter|عامل فرز نفايات|9612|b|waste-recycling|svc.cleaner
window-cleaner|Window and Facade Cleaner|عامل تنظيف زجاج وواجهات|9123|j,b|facility-management|svc.cleaner
car-washer|Car Washer|عامل غسيل سيارات|9122|b|automotive-trade,road-transport,equipment-rental,personal-services|svc.cleaner
laundry-worker|Laundry Worker|عامل مغسلة|9121|b|personal-services,@hosp,@health|svc.cleaner
presser|Presser / Ironer|كوّاء|9121|j,b|personal-services,@hosp|svc.cleaner
cleaning-supervisor|Cleaning Supervisor|مشرف نظافة|5151|l|facility-management,@hosp,@health,*|svc.cleaner
building-caretaker|Building Caretaker|حارس عمارة ومشرف مبنى|5153|j,b|real-estate-services,facility-management,household-domestic|
housemaid|Housemaid / Domestic Worker|عاملة منزلية|9111|b|household-domestic|svc.nanny
nanny|Nanny|مربية أطفال|5311|j,b|household-domestic|svc.nanny
household-cook|Private Household Cook|طباخ / طباخة منزلية|5120|i,j,b|household-domestic|hosp.cook
household-manager|Household Manager|مدير منزل|5152|s,i|household-domestic|
home-gardener|Gardener / Landscaper|بستاني / منسّق حدائق|6113|s,i,j,b|household-domestic,@agri,facility-management,@hosp|svc.gardener
shepherd|Shepherd|راعي أغنام|9212|b|agri-livestock,household-domestic|
camel-herder|Camel Herder|راعي إبل|6121|b|agri-livestock,household-domestic|
stable-hand|Stable Hand / Horse Groomer|عامل إسطبل خيول|5164|j,b|agri-livestock,sports-recreation,household-domestic|
barber|Barber|حلّاق|5141|s,i,j|beauty-wellness,personal-services,@hosp|beauty.hairdresser
hairdresser|Hairdresser / Hair Stylist|مصفّف شعر|5141|s,i,j|beauty-wellness,@hosp|beauty.hairdresser
beautician|Beautician|أخصائي تجميل|5142|s,i,j|beauty-wellness,@hosp,@health|beauty.beautician
makeup-artist|Makeup Artist|خبير مكياج|5142|s,i,j|beauty-wellness,film-tv-production,events-exhibitions|beauty.beautician
nail-technician|Nail Technician|فني أظافر|5142|i,j|beauty-wellness|beauty.beautician
skincare-specialist|Skincare Specialist / Aesthetician|أخصائي عناية بالبشرة|5142|s,i,j|beauty-wellness,clinics|beauty.beautician
laser-technician|Laser Treatment Technician|فني ليزر وتجميل|5142|s,i,j|beauty-wellness,clinics|beauty.beautician
henna-artist|Henna Artist|رسّام حناء|5142|i,j|beauty-wellness,events-exhibitions|beauty.beautician
massage-therapist|Massage / Spa Therapist|معالج تدليك وسبا|5142|s,i,j|beauty-wellness,hotels-resorts,sports-recreation|beauty.massage-therapist
salon-manager|Salon Manager|مدير صالون|1439|m|beauty-wellness,personal-services|
oud-perfume-blender|Oud and Perfume Blender|خبير عطور وعود|7549|s,i|retail,personal-services,other-manufacturing|
pet-groomer|Pet Groomer|مصفّف حيوانات أليفة|5164|i,j|personal-services,veterinary-services|
florist|Florist|منسق زهور|5211|s,i,j|retail,events-exhibitions,personal-services|
locksmith|Locksmith|فني أقفال|7549|s,i,j|repair-services,facility-management,personal-services|
mobile-phone-repair-technician|Mobile Phone Repair Technician|فني صيانة جوالات|7421|s,i,j|repair-services,retail|
appliance-repair-technician|Home Appliance Repair Technician|فني صيانة أجهزة منزلية|7421|s,i,j|repair-services,retail,facility-management|
watch-repairer|Watch Repairer|مصلح ساعات|7311|i,j|repair-services,retail|
jeweller|Jeweller|صائغ|7313|s,i,j|retail,other-manufacturing|
@@agri
agricultural-engineer|Agricultural Engineer|مهندس زراعي|2132|s,i,j|@agri,government,food-manufacturing|agri.agricultural-engineer
agronomist|Agronomist|أخصائي إنتاج نباتي (أغرونوميست)|2132|s,i,j|@agri,rnd-scientific|agri.agricultural-engineer
soil-scientist|Soil Scientist|أخصائي تربة|2132|s,i|@agri,rnd-scientific,government|agri.agricultural-engineer
plant-protection-specialist|Plant Protection Specialist|أخصائي وقاية نباتات|2132|x,s,i|@agri,government|agri.agricultural-engineer
veterinarian|Veterinarian|طبيب بيطري|2250|s,i,j|veterinary-services,agri-livestock,government|agri.veterinarian
farm-manager|Farm Manager|مدير مزرعة|1311|m|@agri|
poultry-farm-manager|Poultry Farm Manager|مدير مزرعة دواجن|1311|m|agri-livestock|
aquaculture-manager|Aquaculture / Fish Farm Manager|مدير مزرعة أسماك|1312|m|fishing-aquaculture|
greenhouse-technician|Greenhouse Technician|فني بيوت محمية|6113|i,j|agri-crops|
farm-worker|Farm Worker|عامل مزرعة|9211|b|agri-crops|
livestock-worker|Livestock Worker|عامل مواشٍ|9212|b|agri-livestock|
poultry-worker|Poultry House Worker|عامل دواجن|9212|b|agri-livestock|
dairy-farm-worker|Dairy Farm Worker|عامل مزرعة ألبان|9212|b|agri-livestock|
date-palm-worker|Date Palm Worker|عامل نخيل|6112|i,j,b|agri-crops|
beekeeper|Beekeeper|نحّال|6123|s,i,j|agri-livestock,agri-crops|
tractor-driver|Tractor Driver|سائق جرّار|8341|i,j,b|@agri|
fisherman|Fisherman|صيّاد|6222|i,j,b|fishing-aquaculture|
aquaculture-worker|Aquaculture Worker|عامل استزراع سمكي|6221|j,b|fishing-aquaculture|
forestry-technician|Forestry Technician|فني حراجة|3143|i,j|forestry,government|
park-ranger|Environmental Reserve Ranger|حارس محميات طبيعية|3143|i,j|government,forestry|
food-inspector|Food Safety Inspector|مفتش أغذية|3257|s,i,j|government,food-manufacturing,supermarkets,@hosp|
environmental-scientist|Environmental Scientist|عالم بيئة|2133|s,i,j|rnd-scientific,government,waste-recycling,@energy|
environmental-consultant|Environmental Consultant|مستشار بيئي|2133|s,i|@pro,architecture-engineering,@energy,@con|
marine-biologist|Marine Biologist|عالم أحياء بحرية|2131|s,i,j|fishing-aquaculture,rnd-scientific,government|
meteorologist|Meteorologist|أخصائي أرصاد جوية|2112|s,i,j|government,aviation,rnd-scientific|
@@sci
researcher|Researcher / Scientist|باحث / عالم|2111|s,i,j|rnd-scientific,@edu,@health,government|sci.researcher
research-assistant|Research Assistant|مساعد باحث|3111|j,i|rnd-scientific,@edu,@health|sci.researcher
physicist|Physicist|فيزيائي|2111|s,i,j|rnd-scientific,higher-education,@energy|sci.researcher
chemist|Chemist|كيميائي|2113|s,i,j|chemicals,petrochemicals,pharma-manufacturing,rnd-scientific,testing-inspection,water-utilities,food-manufacturing|sci.researcher
laboratory-analyst|Laboratory Analyst|محلل مختبر|3111|s,i,j|testing-inspection,chemicals,petrochemicals,food-manufacturing,water-utilities,@energy|sci.researcher
biologist|Biologist|عالم أحياء|2131|s,i,j|rnd-scientific,higher-education,@health|sci.researcher
mathematician-statistician|Mathematician / Statistician|رياضي / إحصائي|2120|s,i,j|government,rnd-scientific,@fin,higher-education|
@@law
lawyer|Lawyer|محامٍ|2611|s,i,j|legal-services,@pro,*|law.lawyer
corporate-lawyer|Corporate and Commercial Lawyer|محامٍ شركات وتجاري|2611|s,i,j|legal-services,@pro,*|law.lawyer
litigation-lawyer|Litigation Lawyer|محامٍ مرافعات|2611|s,i,j|legal-services,*|law.lawyer
ip-specialist|Intellectual Property Specialist|أخصائي ملكية فكرية|2611|s,i|legal-services,@pro,*|law.legal-advisor
legal-advisor|Legal Advisor|مستشار قانوني|2619|s,i,j|*|law.legal-advisor
legal-director|Legal Director|مدير الشؤون القانونية|1219|d,m|*|law.legal-advisor
legal-researcher|Legal Researcher|باحث قانوني|2619|x,s,i,j|legal-services,government,higher-education|law.paralegal
paralegal|Paralegal|مساعد قانوني|3411|x,i,j|legal-services,*|law.paralegal
legal-secretary|Legal Secretary|سكرتير قانوني|3342|i,j|legal-services,*|law.paralegal
sharia-advisor|Sharia Advisor|مستشار شرعي|2619|s,i|@fin,legal-services,nonprofit|
@@gov
policy-analyst|Policy Analyst|محلل سياسات|2422|x,s,i,j|government,@pro,nonprofit,international-organizations|
customs-officer|Customs Officer|موظف جمارك|3351|x,i,j|government|
tax-inspector|Tax and Zakat Inspector|مفتش ضرائب وزكاة|3352|x,s,i|government|
licensing-officer|Licensing Officer|موظف تراخيص|3354|x,i,j|government|
municipal-inspector|Municipal Inspector|مفتش بلدي|3359|s,i,j|government|
property-inspector|Property Inspector|مفتش عقارات|3359|s,i,j|government,@re|
social-researcher|Social Researcher|باحث اجتماعي|2632|x,s,i,j|government,nonprofit,rnd-scientific,higher-education|
social-worker|Social Worker|أخصائي اجتماعي|2635|x,s,i,j|social-care,nonprofit,@edu,@health,government|social.social-worker
community-development-officer|Community Development Officer|مسؤول تنمية مجتمعية|3412|x,s,i|nonprofit,government,@energy|social.social-worker
nonprofit-program-manager|Non-profit Programme Manager|مدير برامج (منظمة غير ربحية)|1344|m,l|nonprofit,international-organizations|
fundraising-officer|Fundraising Officer|مسؤول جمع تبرعات|3339|x,s,i|nonprofit|
volunteer-coordinator|Volunteer Coordinator|منسق تطوع|3412|x,i,j|nonprofit,sports-recreation,events-exhibitions|
humanitarian-aid-worker|Humanitarian Aid Worker|عامل إغاثة وعمل إنساني|3412|x,s,i,j|nonprofit,international-organizations|
@@media
journalist|Journalist|صحفي|2642|x,s,i,j|@media,broadcasting|media.journalist
editor|Editor|محرر|2641|x,s,i|@media,broadcasting|media.journalist
tv-presenter|TV / Radio Presenter|مذيع / مقدم برامج|2656|s,i,j|broadcasting,film-tv-production|
producer|Producer|منتج|2654|s,i,j|film-tv-production,broadcasting,@media|media.producer
film-director|Film / TV Director|مخرج|2654|s,i|film-tv-production,broadcasting|media.producer
scriptwriter|Scriptwriter|كاتب سيناريو|2641|x,s,i|film-tv-production,broadcasting,gaming-esports|
video-editor|Video Editor|مونتير|3521|s,i,j|@media,broadcasting,ecommerce|
videographer|Videographer|مصوّر فيديو|3431|s,i,j|@media,broadcasting,events-exhibitions|mkt.photographer
photographer|Photographer|مصوّر فوتوغرافي|3431|s,i,j|@media,events-exhibitions,design-creative|mkt.photographer
camera-operator|Camera Operator|مصوّر كاميرا (تلفزيوني)|3521|s,i,j|broadcasting,film-tv-production|
sound-engineer|Sound Engineer|مهندس صوت|3521|s,i,j|film-tv-production,broadcasting,arts-entertainment|
lighting-technician|Lighting Technician|فني إضاءة|3521|s,i,j|film-tv-production,broadcasting,arts-entertainment,events-exhibitions|
broadcast-engineer|Broadcast Engineer|مهندس بث|3521|s,i,j|broadcasting,telecom|
graphic-designer|Graphic Designer|مصمم جرافيك|2166|s,i,j|*|mkt.graphic-designer
motion-graphics-designer|Motion Graphics Designer|مصمم موشن جرافيك|2166|s,i,j|@media,gaming-esports,ecommerce|
animator|Animator (2D / 3D)|رسّام رسوم متحركة|2166|s,i,j|film-tv-production,gaming-esports,@media|
illustrator|Illustrator|رسّام توضيحي|2651|s,i,j|@media,publishing,gaming-esports|
voice-over-artist|Voice-over Artist|معلّق صوتي|2656|s,i,j|film-tv-production,broadcasting,advertising-market-research|
actor|Actor|ممثل|2655|s,i,j|film-tv-production,arts-entertainment|
musician|Musician|موسيقي|2652|s,i,j|arts-entertainment,film-tv-production,@hosp|
dj|Disc Jockey (DJ)|دي جي|2652|s,i,j|arts-entertainment,@hosp,events-exhibitions|oth.dj
calligrapher|Arabic Calligrapher|خطّاط عربي|7316|s,i|publishing,design-creative,arts-entertainment|
fashion-designer|Fashion Designer|مصمم أزياء|2163|s,i,j|apparel,retail,design-creative|
product-designer|Industrial / Product Designer|مصمم منتجات|2163|s,i,j|@ind,wood-furniture,fmcg,design-creative|
jewellery-designer|Jewellery Designer|مصمم مجوهرات|7313|s,i,j|retail,other-manufacturing,design-creative|
librarian|Librarian|أمين مكتبة|2622|x,s,i|@edu,government,arts-entertainment|
museum-curator|Curator|أمين متحف|2621|s,i|government,arts-entertainment,higher-education|
archaeologist|Archaeologist|عالم آثار|2633|s,i,j|government,higher-education,tourism-hospitality|
@@sport
fitness-trainer|Fitness / Personal Trainer|مدرب لياقة / شخصي|3423|s,i,j|sports-recreation,@hosp,beauty-wellness|fit.fitness-trainer
yoga-pilates-instructor|Yoga / Pilates Instructor|مدرب يوغا وبيلاتس|3423|s,i,j|sports-recreation,beauty-wellness,@hosp|fit.fitness-trainer
swimming-instructor|Swimming Instructor|مدرب سباحة|3423|s,i,j|sports-recreation,@hosp,education|fit.fitness-trainer
sports-coach|Sports Coach|مدرب رياضي|3422|s,i,j|sports-recreation,education,higher-education|fit.fitness-trainer
referee|Referee / Sports Official|حكم رياضي|3422|s,i,j|sports-recreation|
athlete|Professional Athlete|لاعب محترف|3421|s,i,j|sports-recreation,gaming-esports|
sports-facility-manager|Sports Facility Manager|مدير منشأة رياضية|1431|m|sports-recreation,education,higher-education,hotels-resorts|
entertainment-venue-manager|Entertainment Venue Manager|مدير منشأة ترفيهية|1431|m|arts-entertainment,sports-recreation|
recreation-attendant|Recreation / Theme Park Attendant|مشغّل ألعاب ترفيهية|5169|j,b|arts-entertainment,sports-recreation|
@@re
real-estate-agent|Real Estate Agent / Consultant|مستشار عقاري|3334|x,s,i,j|@re|re.real-estate-agent
licensed-real-estate-broker|Licensed Real Estate Broker|وسيط عقاري مرخّص|3334|x,s,i|@re|re.real-estate-agent
leasing-specialist|Leasing Specialist|أخصائي تأجير|3334|x,s,i,j|@re,hotels-resorts|re.real-estate-agent
property-manager|Property Manager|مدير أملاك|3334|m,l,s|@re,facility-management|re.property-manager
real-estate-valuer|Real Estate Valuer|مقيّم عقاري|3315|x,s,i,j|@re,banking,@pro|
real-estate-development-manager|Real Estate Development Manager|مدير تطوير عقاري|1219|m,d|@re,@con|
real-estate-analyst|Real Estate Analyst|محلل عقاري|2413|x,s,i,j|@re,@fin|
real-estate-asset-manager|Real Estate Asset Manager|مدير أصول عقارية|1219|m,l|@re,@fin|
@@bpo
staffing-account-manager|Staffing / Manpower Account Manager|مدير حساب توظيف وقوى عاملة|3333|m,s,i|staffing-recruitment|
eor-specialist|Employer of Record (EOR) Specialist|أخصائي موظفين على بند التعاقد (EOR)|2423|x,s,i|staffing-recruitment,business-support-bpo|
payroll-outsourcing-specialist|Payroll Outsourcing Specialist|أخصائي رواتب (خدمات خارجية)|4313|x,s,i|staffing-recruitment,business-support-bpo|hr.compensation
back-office-officer|Back-Office Processing Officer|موظف معالجة عمليات خلفية (Back Office)|4110|i,j|business-support-bpo,@fin|
virtual-assistant|Virtual Assistant|مساعد افتراضي|4120|x,i,j|business-support-bpo|
# @@OCC-END
`;

function buildOccupations(sectorIds, existingIds) {
  const out = [];
  const errs = [];
  const fail = (m) => { errs.push(m); return "?"; };
  const ids = new Set();
  const names = new Set();
  let prefix = null;
  const expand = (spec, where) => {
    const res = new Set();
    for (const t of spec.split(",").map((x) => x.trim()).filter(Boolean)) {
      if (t === "*") { res.add("*"); continue; }
      if (t.startsWith("@")) {
        const g = GROUPS[t.slice(1)];
        if (!g) fail(`مجموعة قطاعات غير معرّفة ${t} في ${where}`);
        g.split(",").forEach((x) => res.add(x));
        continue;
      }
      res.add(t);
    }
    if (res.has("*")) return ["*"];
    for (const s of res) if (!sectorIds.has(s)) fail(`قطاع غير موجود «${s}» في ${where}`);
    return [...res];
  };
  for (const l of lines(OCC_TABLE)) {
    if (l.startsWith("@@")) { prefix = l.slice(2).trim(); continue; }
    const p = l.split("|");
    if (p.length !== 7) fail("سطر مهنة غير صالح (7 حقول): " + l);
    const [slug, en, ar, isco, sen, sec, ex] = p.map((x) => x.trim());
    if (!prefix) fail("مهنة قبل أي بادئة: " + l);
    const id = `${prefix}.${slug}`;
    if (ids.has(id)) fail("معرّف مهنة مكرر: " + id);
    ids.add(id);
    const nkey = en.toLowerCase();
    if (names.has(nkey)) fail("اسم إنجليزي مكرر: " + en);
    names.add(nkey);
    if (!/^\d{4}$/.test(isco)) fail(`رمز ISCO غير صالح ${isco} في ${id}`);
    const seniority = sen.split(",").map((k) => SEN_BY_KEY[k.trim()] || fail(`مستوى غير معروف «${k}» في ${id}`));
    const o = { id, ar, en, group: isco, seniority, sectors: expand(sec, id) };
    if (ex) {
      if (!existingIds.has(ex)) fail(`existing_id غير موجود ${ex} في ${id}`);
      o.existing_id = ex;
    }
    out.push(o);
  }
  if (errs.length) throw new Error("build-eor-catalogs: " + errs.length + " خطأ في جدول المهن:\n  " + errs.join("\n  "));
  return out;
}

/* ═════════════ التجميع والكتابة ═════════════ */
export async function buildCatalogs() {
  const { OCCUPATIONS } = await import("../../api/_occupations.js");
  const existingIds = new Set(OCCUPATIONS.map((o) => o.id));
  const sectors = buildSectors();
  const sectorIds = new Set(sectors.map((s) => s.id));
  const occupations = buildOccupations(sectorIds, existingIds);
  return {
    meta: {
      version: CATALOG_VERSION,
      purpose: "فهارس نموذج طلب الموظفين (EOR) — بيانات فقط. يُولَّد بـ site/scripts/build-eor-catalogs.mjs؛ لا يُعدَّل يدوياً.",
      languages: { countries: ["ar", "en", "fr", "zh"], others: ["ar", "en"] },
      sources: {
        countries: "ISO 3166-1 alpha-2 (+XK كوسوفو غير رسمي)؛ الأسماء من CLDR/ICU عبر Intl.DisplayNames، مع تعديلات عربية في AR_OVERRIDES",
        cities: "معرفة عامة بالتقسيم الإداري للمملكة (13 منطقة) — لم تُستخرج من مصدر رسمي",
        sectors: "ISIC Rev.4 (الأمم المتحدة) أقسام A–U وشُعبها، مع قطاعات مركّبة حديثة (composite:true) وسعودية",
        occupations: "ISCO-08 (منظمة العمل الدولية): حقل group = رمز الوحدة بأربعة أرقام",
        seniority: "ترتيب المالك في docs/eor-request-form-spec.md §1 (المهنة) + مستوى «تنفيذي/أخصائي»",
      },
      conventions: {
        occupation_sectors_wildcard: "القيمة [\"*\"] في occupations[].sectors = مهنة عابرة لكل القطاعات",
        occupation_seniority: "قائمة بالمستويات التي تنطبق على المهنة؛ المستوى لا يُكرَّر كمهنة مستقلة (Senior Accountant = محاسب بمستوى senior)",
        existing_id: "معرّف مهنة مطابقة في api/_occupations.js؛ يجوز أن تشير عدة مهن هنا إلى المعرّف نفسه عندما يكون الموجود مركّباً",
        countries_priority: "0 = السعودية، 1..N = الأكثر شيوعاً في التوظيف، 999 = الباقي",
        sectors_eor_sector: "ربط اختياري بمعرّفات SECTORS القديمة في api/_eor.js",
      },
      review: "أرقام ISCO/ISIC وأسماء المدن والترجمات العربية للمهن كتبها المُنشئ من معرفته بلا مصدر حيّ؛ تحتاج مراجعة بشرية قبل الاعتماد.",
    },
    countries: buildCountries(),
    regions: REGIONS.map(([id, ar, en, capital]) => ({ id, ar, en, capital })),
    cities: buildCities(),
    isic_sections: ISIC_SECTIONS.map(([code, ar, en]) => ({ code, ar, en })),
    sectors,
    seniority: SENIORITY.map(([id, ar, en], order) => ({ id, ar, en, order: order + 1 })),
    isco_groups: {
      major: ISCO_MAJOR.map(([code, ar, en]) => ({ code, ar, en })),
      submajor: ISCO_SUB.map(([code, ar, en]) => ({ code, ar, en })),
    },
    occupations,
  };
}

// سطر لكل عنصر: يبقى الملف مقروءاً في المراجعة ولا يتضخم بالمسافات.
function serialize(cat) {
  const body = Object.entries(cat).map(([k, v]) => {
    if (Array.isArray(v)) return `  ${JSON.stringify(k)}: [\n${v.map((x) => "    " + JSON.stringify(x)).join(",\n")}\n  ]`;
    return `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`;
  });
  return `{\n${body.join(",\n")}\n}\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cat = await buildCatalogs();
  const text = serialize(cat);
  JSON.parse(text); // سلامة
  fs.writeFileSync(OUT, text);
  console.log(`wrote ${path.relative(process.cwd(), OUT)} (${(text.length / 1024).toFixed(0)} KB)`);
  console.log(`countries=${cat.countries.length} cities=${cat.cities.length} sectors=${cat.sectors.length} occupations=${cat.occupations.length}`);
}
