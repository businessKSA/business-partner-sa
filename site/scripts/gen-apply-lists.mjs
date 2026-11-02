// يولّد قوائم نموذج التقديم (الدول · الجنسيات · المهن · مدن كل دولة) إلى
// site/assets/data/apply-lists/ — تُحمَّل كسولاً من site/assets/js/apply-lists.js.
//
// لا يدخل في `npm run build` عمداً: المخرجات تُكوَّمت في git فيعمل الموقع بلا
// شبكة خارجية، ويُعاد التوليد يدوياً عند الحاجة فقط:
//
//   node site/scripts/gen-apply-lists.mjs <مجلد-فيه cities5000.txt و countryInfo.txt>
//
// المصدر الخارجي الوحيد: GeoNames (CC-BY 4.0) — https://download.geonames.org/export/dump/
//   cities5000.zip  (كل مدينة سكانها ≥ ٥٠٠٠، وفيها الأسماء البديلة ومنها العربية)
//   countryInfo.txt (قائمة رموز ISO)
// أسماء الدول: site/assets/data/countries.json (عربي/إنجليزي) مع تفضيل الاسم المختصر
// المستعمل أصلاً في main.js (COUNTRIES) كي لا تتفرّق قيمة «السعودية» في Notion.
// المهن: اتحاد ثلاثة مصادر موجودة أصلاً — api/_eor-catalogs.json (١٠٠٦) و
// api/_occupations.js (٢٩٧) وقوائم main.js (JOB_TITLES و PROFESSIONS) — بلا تكرار.
// الجنسيات: جدول الصفات الإثنية أدناه (عربي/إنجليزي لكل دولة ذات سيادة).

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = process.argv[2];
if (!SRC) { console.error("usage: node site/scripts/gen-apply-lists.mjs <geonames-dir>"); process.exit(1); }
const OUT = path.join(ROOT, "site/assets/data/apply-lists");
const MAXCITIES = 1500;

/* ─────────────── الجنسيات: ISO → [English, عربي] ─────────────── */
const NAT = {
  AD: ["Andorran", "أندوري"], AE: ["Emirati", "إماراتي"], AF: ["Afghan", "أفغاني"], AG: ["Antiguan and Barbudan", "أنتيغوي وبربودي"],
  AL: ["Albanian", "ألباني"], AM: ["Armenian", "أرميني"], AO: ["Angolan", "أنغولي"], AR: ["Argentine", "أرجنتيني"],
  AT: ["Austrian", "نمساوي"], AU: ["Australian", "أسترالي"], AZ: ["Azerbaijani", "أذربيجاني"], BA: ["Bosnian", "بوسني"],
  BB: ["Barbadian", "بربادوسي"], BD: ["Bangladeshi", "بنغلاديشي"], BE: ["Belgian", "بلجيكي"], BF: ["Burkinabe", "بوركينابي"],
  BG: ["Bulgarian", "بلغاري"], BH: ["Bahraini", "بحريني"], BI: ["Burundian", "بوروندي"], BJ: ["Beninese", "بنيني"],
  BM: ["Bermudian", "برمودي"], BN: ["Bruneian", "بروناوي"], BO: ["Bolivian", "بوليفي"], BR: ["Brazilian", "برازيلي"],
  BS: ["Bahamian", "باهامي"], BT: ["Bhutanese", "بوتاني"], BW: ["Botswanan", "بتسواني"], BY: ["Belarusian", "بيلاروسي"],
  BZ: ["Belizean", "بليزي"], CA: ["Canadian", "كندي"], CD: ["Congolese (DRC)", "كونغولي (الديمقراطية)"],
  CF: ["Central African", "أفريقي وسطي"], CG: ["Congolese (Republic)", "كونغولي (برازافيل)"], CH: ["Swiss", "سويسري"],
  CI: ["Ivorian", "إيفواري"], CK: ["Cook Islander", "من جزر كوك"], CL: ["Chilean", "تشيلي"], CM: ["Cameroonian", "كاميروني"],
  CN: ["Chinese", "صيني"], CO: ["Colombian", "كولومبي"], CR: ["Costa Rican", "كوستاريكي"], CU: ["Cuban", "كوبي"],
  CV: ["Cape Verdean", "رأس أخضري"], CW: ["Curaçaoan", "كوراساوي"], CY: ["Cypriot", "قبرصي"], CZ: ["Czech", "تشيكي"],
  DE: ["German", "ألماني"], DJ: ["Djiboutian", "جيبوتي"], DK: ["Danish", "دنماركي"], DM: ["Dominican (Dominica)", "دومينيكي"],
  DO: ["Dominican (Republic)", "دومينيكاني"], DZ: ["Algerian", "جزائري"], EC: ["Ecuadorian", "إكوادوري"], EE: ["Estonian", "إستوني"],
  EG: ["Egyptian", "مصري"], EH: ["Sahrawi", "صحراوي"], ER: ["Eritrean", "إريتري"], ES: ["Spanish", "إسباني"],
  ET: ["Ethiopian", "إثيوبي"], FI: ["Finnish", "فنلندي"], FJ: ["Fijian", "فيجي"], FM: ["Micronesian", "ميكرونيزي"],
  FO: ["Faroese", "فاروي"], FR: ["French", "فرنسي"], GA: ["Gabonese", "غابوني"], GB: ["British", "بريطاني"],
  GD: ["Grenadian", "غرينادي"], GE: ["Georgian", "جورجي"], GH: ["Ghanaian", "غاني"], GI: ["Gibraltarian", "جبل طارقي"],
  GL: ["Greenlandic", "غرينلاندي"], GM: ["Gambian", "غامبي"], GN: ["Guinean", "غيني"], GQ: ["Equatorial Guinean", "غيني استوائي"],
  GR: ["Greek", "يوناني"], GT: ["Guatemalan", "غواتيمالي"], GU: ["Guamanian", "غوامي"], GW: ["Guinea-Bissauan", "غيني بيساوي"],
  GY: ["Guyanese", "غياني"], HK: ["Hong Konger", "هونغ كونغي"], HN: ["Honduran", "هندوراسي"], HR: ["Croatian", "كرواتي"],
  HT: ["Haitian", "هايتي"], HU: ["Hungarian", "مجري"], ID: ["Indonesian", "إندونيسي"], IE: ["Irish", "أيرلندي"],
  IN: ["Indian", "هندي"], IQ: ["Iraqi", "عراقي"], IR: ["Iranian", "إيراني"], IS: ["Icelandic", "آيسلندي"],
  IT: ["Italian", "إيطالي"], JM: ["Jamaican", "جامايكي"], JO: ["Jordanian", "أردني"], JP: ["Japanese", "ياباني"],
  KE: ["Kenyan", "كيني"], KG: ["Kyrgyz", "قرغيزي"], KH: ["Cambodian", "كمبودي"], KI: ["I-Kiribati", "كيريباتي"],
  KM: ["Comorian", "قمري"], KN: ["Kittitian and Nevisian", "من سانت كيتس ونيفيس"], KP: ["North Korean", "كوري شمالي"],
  KR: ["South Korean", "كوري جنوبي"], XK: ["Kosovar", "كوسوفي"], KW: ["Kuwaiti", "كويتي"], KY: ["Caymanian", "كايماني"],
  KZ: ["Kazakh", "كازاخي"], LA: ["Lao", "لاوسي"], LB: ["Lebanese", "لبناني"], LC: ["Saint Lucian", "سانت لوسي"],
  LI: ["Liechtensteiner", "ليختنشتايني"], LK: ["Sri Lankan", "سريلانكي"], LR: ["Liberian", "ليبيري"], LS: ["Basotho", "ليسوتي"],
  LT: ["Lithuanian", "ليتواني"], LU: ["Luxembourger", "لوكسمبورغي"], LV: ["Latvian", "لاتفي"], LY: ["Libyan", "ليبي"],
  MA: ["Moroccan", "مغربي"], MC: ["Monégasque", "موناكي"], MD: ["Moldovan", "مولدوفي"], ME: ["Montenegrin", "مونتينيغري"],
  MG: ["Malagasy", "مدغشقري"], MH: ["Marshallese", "من جزر مارشال"], MK: ["North Macedonian", "مقدوني شمالي"], ML: ["Malian", "مالي"],
  MM: ["Myanmar", "ميانماري"], MN: ["Mongolian", "منغولي"], MO: ["Macanese", "ماكاوي"], MR: ["Mauritanian", "موريتاني"],
  MT: ["Maltese", "مالطي"], MU: ["Mauritian", "موريشيوسي"], MV: ["Maldivian", "مالديفي"], MW: ["Malawian", "مالاوي"],
  MX: ["Mexican", "مكسيكي"], MY: ["Malaysian", "ماليزي"], MZ: ["Mozambican", "موزمبيقي"], NA: ["Namibian", "ناميبي"],
  NE: ["Nigerien", "نيجري"], NG: ["Nigerian", "نيجيري"], NI: ["Nicaraguan", "نيكاراغوي"], NL: ["Dutch", "هولندي"],
  NO: ["Norwegian", "نرويجي"], NP: ["Nepali", "نيبالي"], NR: ["Nauruan", "ناوروي"], NZ: ["New Zealander", "نيوزيلندي"],
  OM: ["Omani", "عماني"], PA: ["Panamanian", "بنمي"], PE: ["Peruvian", "بيروفي"], PG: ["Papua New Guinean", "بابوا غيني"],
  PH: ["Filipino", "فلبيني"], PK: ["Pakistani", "باكستاني"], PL: ["Polish", "بولندي"], PR: ["Puerto Rican", "بورتوريكي"],
  PS: ["Palestinian", "فلسطيني"], PT: ["Portuguese", "برتغالي"], PW: ["Palauan", "بالاوي"], PY: ["Paraguayan", "باراغوياني"],
  QA: ["Qatari", "قطري"], RO: ["Romanian", "روماني"], RS: ["Serbian", "صربي"], RU: ["Russian", "روسي"],
  RW: ["Rwandan", "رواندي"], SA: ["Saudi", "سعودي"], SB: ["Solomon Islander", "من جزر سليمان"], SC: ["Seychellois", "سيشيلي"],
  SD: ["Sudanese", "سوداني"], SS: ["South Sudanese", "جنوب سوداني"], SE: ["Swedish", "سويدي"], SG: ["Singaporean", "سنغافوري"],
  SI: ["Slovenian", "سلوفيني"], SK: ["Slovak", "سلوفاكي"], SL: ["Sierra Leonean", "سيراليوني"], SM: ["Sammarinese", "سان مارينوي"],
  SN: ["Senegalese", "سنغالي"], SO: ["Somali", "صومالي"], SR: ["Surinamese", "سورينامي"], ST: ["São Toméan", "ساو تومي"],
  SV: ["Salvadoran", "سلفادوري"], SY: ["Syrian", "سوري"], SZ: ["Swazi", "إسواتيني"], TD: ["Chadian", "تشادي"],
  TG: ["Togolese", "توغولي"], TH: ["Thai", "تايلندي"], TJ: ["Tajik", "طاجيكي"], TL: ["Timorese", "تيموري"],
  TM: ["Turkmen", "تركماني"], TN: ["Tunisian", "تونسي"], TO: ["Tongan", "تونغي"], TR: ["Turkish", "تركي"],
  TT: ["Trinidadian and Tobagonian", "ترينيدادي"], TV: ["Tuvaluan", "توفالي"], TW: ["Taiwanese", "تايواني"], TZ: ["Tanzanian", "تنزاني"],
  UA: ["Ukrainian", "أوكراني"], UG: ["Ugandan", "أوغندي"], US: ["American", "أمريكي"], UY: ["Uruguayan", "أوروغوياني"],
  UZ: ["Uzbek", "أوزبكي"], VA: ["Vatican", "فاتيكاني"], VC: ["Vincentian", "من سانت فنسنت والغرينادين"], VE: ["Venezuelan", "فنزويلي"],
  VN: ["Vietnamese", "فيتنامي"], VU: ["Ni-Vanuatu", "فانواتي"], WS: ["Samoan", "ساموي"], YE: ["Yemeni", "يمني"],
  ZA: ["South African", "جنوب أفريقي"], ZM: ["Zambian", "زامبي"], ZW: ["Zimbabwean", "زيمبابوي"],
};
// دول لا تظهر في القائمتين: غير مأهولة/منتهية، وإسرائيل (غير مدرجة أصلاً في قوائم الموقع).
const SKIP = new Set(["AQ", "BV", "HM", "GS", "TF", "UM", "CS", "AN", "AC", "IL", "BQ", "SJ", "CX", "CC", "NF", "PN", "TK", "NU", "IO"]);
// الأسبقية في أعلى القائمة: السعودية فدول الخليج فالأكثر ورداً في الاستقدام.
const PIN = ["SA", "AE", "KW", "QA", "BH", "OM", "EG", "JO", "SY", "LB", "YE", "SD", "IN", "PK", "BD", "PH", "ID", "LK", "NP", "KE", "ET", "UG"];

/* ─────────────── أدوات ─────────────── */
const read = (f) => fs.readFileSync(f, "utf8");
const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[ً-ٰٟـ]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[^a-z0-9؀-ۿ]+/g, " ").trim();
function arrayAfter(src, name) {
  const i = src.indexOf("var " + name + " = [");
  if (i < 0) throw new Error("main.js: " + name + " not found");
  let j = src.indexOf("[", i), d = 0, q = null;
  for (let k = j; k < src.length; k++) {
    const c = src[k];
    if (q) { if (c === "\\") k++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === "/" && src[k + 1] === "/") { k = src.indexOf("\n", k); if (k < 0) break; continue; }
    if (c === "[") d++;
    else if (c === "]") { d--; if (d === 0) return vm.runInNewContext("(" + src.slice(j, k + 1) + ")"); }
  }
  throw new Error("unterminated " + name);
}
const main = read(path.join(ROOT, "site/assets/js/main.js"));

/* ─────────────── الدول ─────────────── */
const cj = JSON.parse(read(path.join(ROOT, "site/assets/data/countries.json")));
const legacy = new Map(arrayAfter(main, "COUNTRIES").map((c) => [norm(c[0]), c[1]]));
const isoList = read(path.join(SRC, "countryInfo.txt")).split("\n").filter((l) => l && l[0] !== "#").map((l) => l.split("\t")[0]);
const countries = [];
for (const iso of isoList) {
  if (SKIP.has(iso) || !cj.en[iso]) continue;
  let en = cj.en[iso], ar = cj.ar[iso] || en;
  const lg = legacy.get(norm(en)); if (lg) ar = lg;
  en = en.replace(/ SAR China$/, "").replace("Côte d’Ivoire", "Côte d'Ivoire").replace("Türkiye", "Türkiye");
  ar = ar.replace(/ الصينية \(منطقة إدارية خاصة\)$/, "").replace(/ الصينية \(منطقة.*\)$/, "");
  const n = NAT[iso];
  countries.push([iso, en, ar, n ? n[0] : "", n ? n[1] : ""]);
}
const pinned = PIN.filter((c) => countries.some((x) => x[0] === c));
const nationalities = countries.filter((c) => c[3]).length;

/* ─────────────── المهن ─────────────── */
const { OCCUPATIONS } = await import(pathToFileURL(path.join(ROOT, "api/_occupations.js")).href);
const catalog = JSON.parse(read(path.join(ROOT, "api/_eor-catalogs.json"))).occupations;
const prof = new Map(); // مفتاح التكرار → [en, ar]
const add = (en, ar) => {
  en = String(en || "").trim(); ar = String(ar || "").trim();
  if (!en && !ar) return;
  const ke = norm(en), ka = norm(ar);
  if ((ke && prof.has("e:" + ke)) || (ka && prof.has("a:" + ka))) return;
  const row = [en || ar, ar || en];
  if (ke) prof.set("e:" + ke, row);
  if (ka) prof.set("a:" + ka, row);
};
catalog.forEach((o) => add(o.en, o.ar));
OCCUPATIONS.forEach((o) => add(o.nameEn, o.nameAr));
arrayAfter(main, "JOB_TITLES").forEach((t) => add(t[0], t[1]));
arrayAfter(main, "PROFESSIONS").forEach((t) => { if (!/^Other/.test(t[0])) add(t[0], t[1]); });
const professions = [...new Set(prof.values())];

/* ─────────────── المدن ─────────────── */
// الاسم العربي: من alternatenames/<CC>.zip (إن وُجد المجلد SRC/alt) — المفضَّل ثم المختصر ثم
// الأول، بحروفٍ عربية فقط (تُرفض حروف الفارسية/الكردية/الأردية: ی ک گ پ چ ژ ە…). وإلا من
// الحقل الاحتياطي في cities5000.txt بالقاعدة نفسها.
const AR_OK = /^[ء-غف-ي\s\-']+$/;
const cleanAr = (a) => { const s = String(a || "").replace(/[ً-ْٰـ]/g, "").replace(/\s+/g, " ").trim(); return s && s.length <= 40 && AR_OK.test(s) ? s : ""; };
const fallbackAr = (alts) => { for (const a of alts.split(",")) { const s = cleanAr(a); if (s) return s; } return ""; };
const byCountry = {};
for (const line of read(path.join(SRC, "cities5000.txt")).split("\n")) {
  if (!line) continue;
  const f = line.split("\t");
  const cc = f[8]; if (SKIP.has(cc)) continue;
  (byCountry[cc] ||= []).push({ id: f[0], en: f[1], ar: "", fb: fallbackAr(f[3]), pop: +f[14] || 0 });
}
const altDir = path.join(SRC, "alt");
for (const [cc, rows] of Object.entries(byCountry)) {
  const zip = path.join(altDir, cc + ".zip");
  const best = new Map(); // geonameid → { name, rank }
  if (fs.existsSync(zip)) {
    const want = new Set(rows.map((r) => r.id));
    const txt = execFileSync("unzip", ["-p", zip, cc + ".txt"], { maxBuffer: 1 << 30 }).toString("utf8");
    for (const line of txt.split("\n")) {
      const f = line.split("\t");
      if (f[2] !== "ar" || !want.has(f[1])) continue;
      if (f[7] === "1" || f[6] === "1") continue; // تاريخي أو عامّي
      const name = cleanAr(f[3]); if (!name) continue;
      const rank = (f[4] === "1" ? 2 : 0) + (f[5] === "1" ? 1 : 0);
      const cur = best.get(f[1]);
      if (!cur || rank > cur.rank) best.set(f[1], { name, rank });
    }
  }
  rows.forEach((r) => { r.ar = (best.get(r.id) || {}).name || r.fb; });
}
// السعودية: قائمة main.js المنسَّقة (الاسمان متوازيان بالفهرس) أولاً بترتيبها، ثم ما تزيده GeoNames
// ممّا لا يطابقها. المفتاح يُسقط «ال» ولاحقتَي «المكرمة/المنورة» كي لا تتكرّر مكة والمدينة.
const saEn = arrayAfter(main, "SA_CITIES"), saAr = arrayAfter(main, "SA_CITIES_AR");
const saKey = (s) => norm(s).replace(/ (المكرمه|المنوره)$/, "").replace(/^ال/, "");
const cur = saEn.map((en, i) => ({ id: "m" + i, en, ar: saAr[i] || "", pop: 1e9 - i }));
const curKeys = new Set(cur.map((c) => saKey(c.ar)));
const curEn = new Set(cur.map((c) => norm(c.en)));
byCountry.SA = cur.concat((byCountry.SA || []).filter((r) => !(r.ar && curKeys.has(saKey(r.ar))) && !curEn.has(norm(r.en))));

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "cities"), { recursive: true });
let files = 0, total = 0;
for (const [cc, rows] of Object.entries(byCountry)) {
  if (!countries.some((c) => c[0] === cc)) continue;
  rows.sort((a, b) => b.pop - a.pop || (a.en < b.en ? -1 : 1));
  const seenK = new Set(), out = [];
  for (const r of rows) {
    const k = norm(r.en) + "|" + norm(r.ar);
    if (seenK.has(k)) continue; seenK.add(k);
    out.push(r.ar && r.ar !== r.en ? [r.en, r.ar] : r.en);
    if (out.length >= MAXCITIES) break;
  }
  fs.writeFileSync(path.join(OUT, "cities", cc + ".json"), JSON.stringify(out));
  files++; total += out.length;
}
fs.writeFileSync(path.join(OUT, "countries.json"), JSON.stringify({ v: 1, pin: pinned, c: countries }));
fs.writeFileSync(path.join(OUT, "professions.json"), JSON.stringify({ v: 1, p: professions }));
// /assets/* يُخدَم immutable سنةً: بصمة البيانات تُكتب في apply-lists.js (VER) فيتغيّر رابط الوحدة
// ثم روابط بياناتها معاً كلما أُعيد التوليد بمحتوى مختلف.
const h = crypto.createHash("md5");
for (const f of ["countries.json", "professions.json", ...fs.readdirSync(path.join(OUT, "cities")).sort().map((x) => "cities/" + x)]) h.update(fs.readFileSync(path.join(OUT, f)));
const jsPath = path.join(ROOT, "site/assets/js/apply-lists.js");
fs.writeFileSync(jsPath, fs.readFileSync(jsPath, "utf8").replace(/VER = "[^"]*"/, 'VER = "' + h.digest("hex").slice(0, 10) + '"'));
console.log(`countries ${countries.length} · nationalities ${nationalities} · professions ${professions.length} · city files ${files} (${total} cities)`);
