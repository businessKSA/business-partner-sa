// SHR-HR: قاموس اللغات الأربع وقواعده (بلا DOM): سلامة المفاتيح والترجمات، وألا تُدخل الترجمة رقماً أو ادعاءً لم يكن في الأصل،
// وسلوك tr (قوالب، جمع، قوائم، وسم: قيمة، بيانات البذرة لا تُمسّ)، والصفحة المولَّدة (المحدد، الاتجاه، CSS منطقي).
// Run: npm test
import { DICT, shrI18nClient, I18N_CSS, SHR_LANGS, langSwitcherHtml } from "../site/scripts/simple-v1-shr-i18n.mjs";
import { SV1_TEXT } from "../site/scripts/simple-v1.mjs";
import { buildShrOps } from "../site/scripts/simple-v1-shr.mjs";

const fail = [];
const ok = (c, m) => { console.log((c ? "  ok   " : "  FAIL ") + m); if (!c) fail.push(m); };
const AR_LETTER = /[ؠ-يٮ-ۿ]/;
const AR_DIGITS = /[٠-٩]/g;
const latin = (s) => s.replace(AR_DIGITS, (d) => String(d.charCodeAt(0) - 0x660));
const digitsOf = (s) => (latin(s).replace(/\{[^}]*\}/g, "").match(/\d+/g) || []).sort().join(",");
const phOf = (s) => [...new Set((s.match(/\{(\d+)[|*}]/g) || []).map((x) => x.replace(/\D/g, "")))].sort().join(",");

console.log("dictionary shape");
const keys = Object.keys(DICT);
ok(keys.length > 700, `entries: ${keys.length}`);
const badShape = keys.filter((k) => !Array.isArray(DICT[k]) || DICT[k].length !== 3 || DICT[k].some((v) => typeof v !== "string" || !v.trim()));
ok(badShape.length === 0, "every entry has a non-empty en, fr and zh" + (badShape.length ? ": " + badShape.slice(0, 5).join(" | ") : ""));
const arabicLeft = keys.filter((k) => DICT[k].some((v) => AR_LETTER.test(v)));
ok(arabicLeft.length === 0, "no Arabic letters inside any translation" + (arabicLeft.length ? ": " + arabicLeft.slice(0, 5).join(" | ") : ""));
// المفتاح العربي (بعد حذف لاحقة السياق @ctx) يحمل عربية فعلاً، إلا رموزاً قليلة (أسهم وفاصل)
const nonAr = keys.filter((k) => !AR_LETTER.test(k) && !/^[‹ ←]+$/.test(k));
ok(nonAr.length === 0, "every key is Arabic text (or a bidi token)" + (nonAr.length ? ": " + nonAr.slice(0, 5).join(" | ") : ""));
const phBad = keys.filter((k) => DICT[k].some((v) => phOf(v) !== phOf(k)));
ok(phBad.length === 0, "{n} placeholders match between Arabic and each translation" + (phBad.length ? ": " + phBad.slice(0, 5).join(" | ") : ""));
// لا أرقام نظامية في الترجمات: الأرقام في كل ترجمة هي أرقام الأصل بعينها (الأرقام العربية الهندية تُكتب لاتينية).
const digBad = keys.filter((k) => DICT[k].some((v) => digitsOf(v) !== digitsOf(k)));
ok(digBad.length === 0, "a translation introduces or drops no number (digits equal the Arabic source)" + (digBad.length ? ": " + digBad.slice(0, 8).map((k) => k.slice(0, 50)).join(" | ") : ""));
// لا ادعاء ترخيص أو امتثال أو ضمان في الترجمة ما لم يكن في الأصل.
const CLAIM = { guarantee: [/guarant|garanti|保证|担保/i, /ضمان|نضمن|ضامن/], licence: [/licen[cs]|agréé|执照|许可|accredit|accrédit|认证/i, /ترخيص|رخصة|مرخّص|اعتماد|معتمد|اعتُمد|اعتمد|أعتمد/], compliance: [/complian|conformit|合规/i, /امتثال|التزام|الامتثال/] };
const claimBad = [];
for (const k of keys) for (const v of DICT[k]) for (const [name, [tr, src]] of Object.entries(CLAIM)) if (tr.test(v) && !src.test(k)) claimBad.push(`${name}: ${k.slice(0, 40)} -> ${v.slice(0, 50)}`);
ok(claimBad.length === 0, "no licence, compliance or guarantee wording appears in a translation unless the Arabic source has it" + (claimBad.length ? ": " + claimBad.slice(0, 6).join(" | ") : ""));
// «لا نضمن إلغاء المخالفة» تُترجَم بدقة وبلا وعد
const NG = "لا نضمن إلغاء المخالفة. المبالغ والمواعيد تقديرية، تُؤكَّد من بوابة الجهة قبل الاعتماد عليها، ومصدر كل رقم ظاهر بجانبه.";
ok(/do not guarantee/i.test(DICT[NG][0]) && /ne garantissons pas/i.test(DICT[NG][1]) && /不保证/.test(DICT[NG][2]), "the no-guarantee sentence keeps its negation in en, fr and zh");
const NG2 = "إبلاغ العميل أنه لا ضمان لإلغاء المخالفة";
ok(/no guarantee/i.test(DICT[NG2][0]) && /aucune garantie/i.test(DICT[NG2][1]) && /不保证/.test(DICT[NG2][2]), "the checklist line 'no guarantee of cancellation' keeps its negation");
// وسم «بيانات تجريبية»
ok(DICT["بيانات تجريبية"][0] === "Demo data" && DICT["بيانات تجريبية"][1] === "Données de démonstration" && DICT["بيانات تجريبية"][2] === "演示数据", "‘Demo data’ is Demo data / Données de démonstration / 演示数据");
ok(/Demo data/.test(DICT["بيانات تجريبية — لا عمال حقيقيون ولا ربط حكومي ولا رسائل"][0]) && /Données de démonstration/.test(DICT["بيانات تجريبية — لا عمال حقيقيون ولا ربط حكومي ولا رسائل"][1]) && /演示数据/.test(DICT["بيانات تجريبية — لا عمال حقيقيون ولا ربط حكومي ولا رسائل"][2]), "the fixed demo banner is translated and keeps the demo label");
// Business Partner تبقى كما هي
const bp = keys.filter((k) => /Business Partner/.test(k));
ok(bp.length >= 2 && bp.every((k) => DICT[k].every((v) => /Business Partner/.test(v))), "‘Business Partner’ is never translated (" + bp.length + " entries)");
// الشعار: لا «سحر الإمداد» في أي قيمة
ok(!keys.some((k) => /سحر الإمداد/.test(k) || DICT[k].some((v) => /سحر الإمداد|Sahar|Al-?Imdad/i.test(v))), "the SHR brand name appears in no entry");
// ترويسة القشرة من جدول الموقع نفسه
const chromeOk = ["barStatus", "navServices", "login", "logout"].every((k) => { const e = SV1_TEXT[k]; return DICT[e.ar] && DICT[e.ar][0] === e.en && DICT[e.ar][2] === e.zh; });
ok(chromeOk, "the shared header strings come straight from the site's own table (SV1_TEXT)");

console.log("tr behaviour");
const T = shrI18nClient({ dict: DICT });
ok(T.trL("اللوحة", "ar") === "اللوحة" && T.trL("نص غير معروف", "en") === "نص غير معروف", "Arabic is returned as is, and an unknown text falls back to Arabic");
ok(T.trL("العمال", "en") === "Workers" && T.trL("العمال", "fr") === "Travailleurs" && T.trL("العمال", "zh") === "工人", "exact lookup");
ok(T.trL("منذ 3 يوماً", "en") === "3 days ago" && T.trL("منذ 1 يوماً", "en") === "1 day ago" && T.trL("منذ 0 يوماً", "fr") === "il y a 0 jour", "templates with plural (en: 1 day / 3 days; fr: 0-1 singular)");
ok(T.trL("منذ 5 يوماً", "zh") === "5 天前", "template, zh");
ok(T.trL("نشط: 4 · مسودة أو بانتظار المستندات: 2", "en") === "Active: 4 · Draft or awaiting documents: 2", "composite with two numbers");
ok(T.trL("التفعيل مرفوض: ناقص الهوية، مستند الإقامة", "en") === "Activation refused: missing Identity, Iqama document", "a list of known labels is translated element by element");
ok(T.trL("ينقصه شرط إلزامي: لحام أرجون", "en") === "Missing a mandatory requirement: لحام أرجون", "a data value inside a template is left untouched");
ok(T.trL("تطابق 1 من 2: تركيب سبليت، صيانة", "zh") === "匹配 2 项中的 1 项：تركيب سبليت، صيانة", "a data list is not re-punctuated");
ok(T.trL("الوظيفة: ", "fr") === "Poste : " && T.trL("الوظيفة: ", "zh") === "职位：", "label + colon (French non-breaking space, Chinese full-width colon)");
ok(T.trL("‹", "en") === "›" && T.trL(" ← ", "zh").trim() === "→", "bidi tokens flip in the Latin and Chinese interfaces");
ok(T.trL("الإقامة", "zh") === "居留证" && T.trL("إدخال", "en") === "Entry" && T.trL("إدخال", "en", "button") === "Enter", "context-specific entries (@button)");
const seeds = ["منشأة تجريبية SHR ٣ (مقيّدة — وهمي)", "مكتب استقدام تجريبي ج — قيد الاعتماد (وهمي)", "فني تكييف — مشروع تجريبي", "طلب تجريبي: نقل", "عامل تجريبي ٦ (جاهز للتفعيل)", "مرشح تجريبي 1 (وهمي)", "مشغّل تجريبي"];
ok(["en", "fr", "zh"].every((L) => seeds.every((s) => T.trL(s, L) === s)), "demo seed names (people, establishments, jobs, agencies) are never altered by a translation");
const chrome = SV1_TEXT.barStatus;
ok(T.trL(chrome.ar, "fr") === chrome.fr, "shared header string in French");

console.log("generated page");
let cap, headerCalls = 0;
const bar = '<div class="sv1-bar"><div class="wrap">\n  <div class="sv1-bar-l"><span>x</span></div>\n  <div class="sv1-bar-r">\n    \n  </div>\n</div></div><header class="sv1-hdr"></header>';
buildShrOps({ header: () => { headerCalls++; return bar; }, shell: (o) => { cap = o; return ""; } });
ok(headerCalls === 1 && /<div class="sv1-bar-r">[\s\S]*data-shr-lang="ar"[\s\S]*data-shr-lang="en"[\s\S]*data-shr-lang="fr"[\s\S]*data-shr-lang="zh"[\s\S]*<\/div>/.test(cap.body), "the language switcher is inside the system header bar (ع / EN / FR / 中文)");
ok(/>ع<\/button>/.test(cap.body) && />EN<\/button>/.test(cap.body) && />FR<\/button>/.test(cap.body) && />中文<\/button>/.test(cap.body), "the four labels are ع, EN, FR and 中文");
ok(SHR_LANGS.length === 4 && langSwitcherHtml().includes('aria-pressed="true"'), "Arabic is the pressed one by default");
buildShrOps({ header: () => "<header></header>", shell: (o) => { cap = o; return ""; } });
ok(/class="shr-langbar"/.test(cap.body) && /data-shr-lang="zh"/.test(cap.body), "if the shared header changes shape, the switcher falls back to a bar above the content");
ok(/<div class="shr-demo" role="note">بيانات تجريبية/.test(cap.body), "the demo-data strip is still the first thing on the page");
ok(!/(^|[;{\s,])(left|right)\s*:|margin-(left|right)|padding-(left|right)|border-(left|right)|text-align:\s*(left|right)|float:\s*(left|right)/.test(cap.body.replace(/<script[\s\S]*?<\/script>/g, "")), "the page CSS uses logical properties only (no left/right)");
ok(/\.shr-side\{position:sticky/.test(cap.body) && /grid-template-columns:236px minmax\(0,1fr\)/.test(cap.body), "the sidebar is a grid column: it flips with the direction");
ok(!/#[0-9a-fA-F]{3,8}\b/.test(I18N_CSS.replace(/#fff\b/g, "")), "the language CSS adds no literal colour beyond white (SV1 tokens only)");
ok(/html\[lang="zh"\][^{]*\{[^}]*PingFang SC[^}]*Microsoft YaHei[^}]*Noto Sans/.test(I18N_CSS), "Chinese has a fallback font stack");
ok(/data-i18n-skip/.test(cap.body) && !/<\/script>[\s\S]*<\/script>/.test(cap.script.replace(/<\/script>$/, "")), "the switcher is excluded from translation and the script is one block");
ok(/localStorage/.test(cap.script) && /try\{saved=win\.localStorage|try { saved = win\.localStorage/.test(cap.script), "the choice is stored in localStorage inside try/catch");
const sizeKb = Math.round(cap.script.length / 1024);
ok(sizeKb < 400, `the page script (with the dictionary) is ${sizeKb} KB`);
ok(!/\$\{|`/.test(shrI18nClient.toString()), "the injected runtime has no backtick or template placeholder");

console.log(fail.length ? `\n${fail.length} FAILED` : "\nall passed");
process.exit(fail.length ? 1 : 0);
