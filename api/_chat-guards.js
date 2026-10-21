// ‏حراس ردّ المستشار (api/chat.js) — دوالّ نقيّة بلا شبكة ولا قاعدة بيانات ولا نموذج.
//
// لماذا ملفٌّ مستقل؟ كل دالة هنا وُلدت من خللٍ قِيس على محادثات حقيقية (٤٠ محادثة،
// ١٤٠ استدعاءً على التجريبي، 2026-10-21)، وتعليمات النموذج وحدها لا تكفي لأنها طلبٌ لا
// ضمان. فالتعليمات خطٌّ أول، وهذه الدوالّ خطٌّ ثانٍ حتميّ يعمل أياً كان ما كتبه النموذج.
// وهي نقيّةٌ ليُختبر كلٌّ منها بردٍّ مُحاكى مأخوذ من الفشل نفسه (tests/chat-guards.test.mjs)
// وليقيس بها tests/chat-eval/ ما يصل إلى العميل فعلاً.
//
// الأبواب (ما يُعالَج هنا):
//   ١) شكوى/طلب مسؤول:  escalationIntent · stripFalsePromises · ensureHumanContact
//   ٢) النطاق لا يتأخر:   hasValidScope · shouldForceScope · FORCE_SCOPE_NOTE
//   ٣) مدد مخترعة:        durationsIn · allowedDurations · guardDurations
//   ٤) سؤال واحد:         oneQuestion
//   ٥) أكواد وأنواع:      sanitizeScope · codeFits · normalizeScopeType
//   ٦) كلمات المرور:      guardCredentials
// حارس الأسعار (guardReply) باقٍ في chat.js، وقد أُصلح فيه تشويه العناوين اليتيمة.

export const HUMAN_PHONE = "0530540231";
export const HUMAN_WA_URL = "https://wa.me/966530540231";

// ───────────────────────── أدوات نصّ ─────────────────────────

// ‏تطبيع يحفظ الطول حرفاً بحرف (لتبقى المواضع صالحة على النص الأصلي): أرقام هندية/فارسية
// → لاتينية، همزات الألف → ا، ى → ي، ة → ه، ؤ → و، ئ → ي، ومصغّر لاتيني.
const MAP = new Map();
for (let i = 0; i < 10; i++) { MAP.set(String.fromCharCode(0x660 + i), String(i)); MAP.set(String.fromCharCode(0x6f0 + i), String(i)); }
for (const c of "أإآٱ") MAP.set(c, "ا");
MAP.set("ى", "ي"); MAP.set("ة", "ه"); MAP.set("ؤ", "و"); MAP.set("ئ", "ي");
export function lp(s) {
  let out = "";
  for (const ch of String(s == null ? "" : s)) out += MAP.get(ch) || ch.toLowerCase();
  return out;
}
// ‏تطبيع للمطابقة فقط (يحذف التشكيل والتطويل فلا يحفظ الطول).
export const fold = (s) => lp(s).replace(/[ً-ٰٟـ]/g, "");

export const scriptOf = (t) => {
  const s = String(t || "");
  const ar = (s.match(/[؀-ۿ]/g) || []).length, la = (s.match(/[A-Za-z]/g) || []).length, cj = (s.match(/[一-鿿]/g) || []).length;
  const tot = ar + la + cj;
  if (!tot) return "none";
  if (cj / tot > 0.3) return "zh";
  if (ar / tot > 0.4) return "ar";
  return "latin";
};
// ‏لغة النص: ar · en · fr · zh (الفرنسية بقرائن حروف الجر والضمائر).
export function detectLang(t) {
  const sc = scriptOf(t);
  if (sc === "ar" || sc === "zh") return sc;
  return /\b(?:je|nous|vous|est-ce|je\s+veux|bonjour|pour|une?|des|les|quelles?|combien|soci[ée]t[ée])\b/i.test(String(t)) ? "fr" : "en";
}

// ‏يفصل الرد إلى نثرٍ للعميل وذيل كتل الواجهة (<<OPTS>> و<<SCOPE>>) — الحراس النصيّة تعمل
// على النثر وحده، فلا تمسّ كتلةً هي بياناتٌ لا كلام.
export function splitBlocks(reply) {
  const s = String(reply == null ? "" : reply);
  const m = /<<\s*(?:OPTS|SCOPE)/i.exec(s);
  return m ? { head: s.slice(0, m.index), tail: s.slice(m.index) } : { head: s, tail: "" };
}
export const join = (head, tail) => (tail ? (head.trim() ? head.replace(/\s+$/, "") + "\n" + tail : tail) : head);

/** ‏يطبّق fn على نثر الرد وحده (دون كتل <<OPTS>>/<<SCOPE>>) ويعيد الرد كاملاً. */
export function mapHead(reply, fn) {
  const { head, tail } = splitBlocks(reply);
  return join(fn(head), tail);
}

// ‏تقطيع النثر جُملاً (نقطة/علامة تعجب/استفهام/فاصلة منقوطة، أو سطر جديد) مع حفظ الفواصل.
function sentences(text) {
  return String(text).split(/(?<=[.!?؟؛。！？])\s+(?=\S)|(?<=\n)/u);
}

// ───────────────────────── ١) شكوى / طلب مسؤول ─────────────────────────

// ‏طلب صريح للتحدث مع إنسان/مسؤول (SPEAK) أو لرقم تواصل (NUMBER) ← يُضمن الرد بالرقم الرسمي.
// ‏NUMBER لا يُفعَّل إن كان العميل نفسه يكتب رقم جوال (يعطينا رقمه ولا يطلب رقمنا).
const SPEAK = [
  /(?:^|[^\p{L}])(?:اكلم|اتكلم|اتواصل|اتصل|اتحدث|كلموني|كلمني|تكلموني|كلمو|ابغي\s+اكلم|ابي\s+اكلم|ابغا\s+اكلم|اريد\s+(?:ان\s+)?(?:اتحدث|اتكلم|اكلم))(?![\p{L}]).{0,30}?(?:مس[وي]ول|مدير|موظف|شخص|انسان|بشري|احد|الاداره|المختص|باهر|صاحب|خدمه\s+العملاء|الدعم|ممثل)/u,
  /(?:مس[وي]ول|مدير)\s+(?:ال)?(?:خدمه|عملاء|شكاوي|الدعم)/u,
  /(?:موظف|شخص|انسان|احد)\s+(?:ال)?(?:بشري|حقيقي)|خدمه\s+العملاء|(?:ابغي|ابي|اريد)\s+(?:انسان|بشري)/u,
  /(?:speak|talk|chat|connect)\s+(?:to|with)\s+(?:a\s+|an\s+|the\s+|your\s+|some\s*(?:one|body)\s*)?(?:real\s+)?(?:human|person|manager|supervisor|agent|someone|somebody|representative|owner|director|staff)/i,
  /real\s+person|human\s+(?:agent|being|representative|support)|(?:your|the)\s+(?:manager|supervisor|director)\b|call\s+(?:me|us|you)\b|escalat/i,
  /parler\s+(?:à|a|avec)\s+(?:un|une|le|la|votre|quelqu)\S*\s*(?:humain|personne|responsable|directeur|directrice|conseiller|conseill[eè]re|quelqu)?/i,
  /人工|真人|找.{0,6}(?:经理|负责人|主管)|(?:经理|负责人|主管)|打电话/u,
];
const NUMBER = [
  /رقم\s+(?:ال)?(?:جوال|هاتف|تلفون|اتصال|تواصل|واتس(?:اب)?|مباشر|مس[وي]ول|مدير|موظف|خدمه\s+العملاء|دعم|الدعم)(?![\p{L}])/u,
  /رقمكم|رقم\s+شركتكم/u,
  // ‏«أعطوني رقم» وحدها أو متبوعةً بجهة التواصل — لا «رقم الوزارة» ولا «رقم الطلب» ولا «رقم السجل».
  /(?:اعطني|اعطوني|عطوني|عطني|ابغي|ابي|ابغا|ارسل(?:و)?|زودني|هات|ودي\s+ب|محتاج)\s+(?:لي\s+)?(?:ال)?رقم(?=\s*(?:$|[.,،؟?!؛\n]|(?:ال)?(?:جوال|هاتف|تلفون|اتصال|تواصل|واتس|مباشر|مس[وي]ول|مدير|موظف|شركه|شركتكم|دعم|باهر|مستشار|خدمه\s+العملاء)))/u,
  /(?:your|business\s*partner'?s?|company'?s?|team'?s?|manager'?s?|support|customer\s+service)\s+(?:(?:direct|contact|phone|mobile|whats\s*app)\s+)*(?:number|phone|line)\b|give\s+me\s+(?:a\s+)?(?:phone\s+)?number|(?:direct|human)\s+(?:number|line)/i,
  /votre\s+num[ée]ro|num[ée]ro\s+(?:direct|de\s+votre\s+(?:service|[ée]quipe))|(?:vous|nous)\s+(?:appeler|joindre)/i,
  /客服电话|你们的(?:电话|号码)|贵公司(?:电话|号码)|给我.{0,4}电话/u,
];
const GIVES_PHONE = /(?:\+?9665|05)\d[\d\s-]{7,}/;
// ‏شكوى (WEAK) ← يُضمن وجود الرقم في الرد دون استبداله (قد تكون شكوى على جهة حكومية لا علينا).
const WEAK = [
  /شكو[يى]|شكوي|اشتكي|اشتك|تظلم|زعلان|غير\s+راض|مو\s+راض|مستاء|سوء\s+(?:ال)?خدمه|(?:ما|محد|ماحد|مافي\s+احد)\s+(?:احد\s+)?(?:يرد|يردون|رد(?:يتو|وا)?)|تذمر/u,
  /complain|complaint|unhappy|dissatisfied|not\s+happy|nobody\s+(?:answers|replies|responds)|no\s+one\s+(?:answers|replies|responds)|terrible\s+service|bad\s+service/i,
  /plainte|r[ée]clamation|m[ée]content|insatisfait/i,
  /投诉|不满意|没人(?:回复|回应|理)/u,
];

/** @returns {"strong"|"weak"|""} */
export function escalationIntent(text) {
  const t = fold(text);
  if (!t.trim()) return "";
  if (SPEAK.some((re) => re.test(t))) return "strong";
  if (!GIVES_PHONE.test(t) && NUMBER.some((re) => re.test(t))) return "strong";
  if (WEAK.some((re) => re.test(t))) return "weak";
  return "";
}

// ‏عبارات تَعِد بما لا يملكه المستشار: لا سجلّ رقمٍ للعميل، ولا آلية تصعيد، ولا مسؤول يتصل.
const FALSE_PROMISE = [
  /تم\s+(?:ال)?(?:تسجيل|رفع|تصعيد|ارسال|احاله)\s+(?:ال)?(?:طلبك|شكواك|ملاحظتك|بلاغك|الشكوي|الطلب|الملاحظه)/u,
  /(?:سيتم|سوف\s+يتم|ساتم|سنقوم\s+ب|سوف\s+(?:ا|ن)قوم\s+ب)\s*(?:ال)?تصعيد/u,
  /(?:سوف\s+|سـ|س)(?:ا|ن)رفع\s+(?:ال)?(?:ملاحظتك|شكواك|طلبك|بلاغك|الشكوي|الامر)/u,
  /(?:سوف\s+|سـ|س)?(?:ي|ت)تواصل\s+معك\s+(?:ال)?(?:مس[وي]ول|مدير|ممثل|الاداره|المختص)/u,
  /رقمك\s+المسجل|الرقم\s+المسجل|(?:المسجل|المسجله)\s+(?:لدينا|عندنا)|هل\s+رقمك\s+هو/u,
  /(?:will|shall)\s+be\s+escalated|(?:a|an|the|our)\s+(?:manager|supervisor|officer|representative|agent|specialist)\s+will\s+(?:call|contact|reach|get\s+back)|your\s+registered\s+(?:number|phone|mobile)|number\s+(?:we\s+have|on\s+file|registered)|(?:request|complaint|ticket)\s+(?:has\s+been|was)\s+(?:logged|registered|escalated|recorded)|we(?:'ve|\s+have)\s+(?:logged|registered|escalated)/i,
  /(?:sera|va\s+[êe]tre)\s+(?:transmis|escalad|signal)|votre\s+num[ée]ro\s+enregistr[ée]|un\s+responsable\s+(?:vous\s+)?(?:contactera|appellera)/i,
  /已(?:为您)?(?:登记|记录|升级)|将(?:会)?(?:升级|转交)|主管将(?:会)?(?:联系|致电)|您(?:的)?(?:登记|预留|留存)(?:电话|号码)/u,
];
/** ‏يحذف الجُمل التي تَعِد بتصعيد/اتصال/رقم مسجّل. */
export function stripFalsePromises(text) {
  const src = String(text || "");
  let hit = false;
  const out = sentences(src).map((s) => {
    if (FALSE_PROMISE.some((re) => re.test(fold(s)))) { hit = true; return ""; }
    return s;
  }).join(" ").replace(/[ \t]{2,}/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { text: hit ? out : src, hit };
}

const HUMAN_CANNED = {
  ar: `أعتذر منك على ما واجهته. للتواصل المباشر مع مستشارك باهر وفريقنا: اتصال أو واتساب على ${HUMAN_PHONE} — ${HUMAN_WA_URL}\nوإن رغبت أكمل لك ترتيب طلبك هنا.`,
  en: `I'm sorry for the trouble. To reach your advisor Baher and our team directly, call or message us on WhatsApp at ${HUMAN_PHONE} — ${HUMAN_WA_URL}\nI can also keep arranging your request here if you wish.`,
  fr: `Je suis désolé pour ce désagrément. Pour joindre directement votre conseiller Baher et notre équipe, appelez ou écrivez-nous sur WhatsApp au ${HUMAN_PHONE} — ${HUMAN_WA_URL}\nJe peux aussi continuer à préparer votre demande ici si vous le souhaitez.`,
  zh: `很抱歉给您带来不便。如需直接联系您的顾问 Baher 和我们的团队，请拨打电话或通过 WhatsApp 联系 ${HUMAN_PHONE} — ${HUMAN_WA_URL}\n如果您愿意，我也可以在这里继续为您整理申请。`,
};
const HUMAN_LINE = {
  ar: `وللتواصل المباشر مع فريقنا: اتصال أو واتساب على ${HUMAN_PHONE} — ${HUMAN_WA_URL}`,
  en: `To reach our team directly: call or WhatsApp ${HUMAN_PHONE} — ${HUMAN_WA_URL}`,
  fr: `Pour joindre directement notre équipe : appel ou WhatsApp au ${HUMAN_PHONE} — ${HUMAN_WA_URL}`,
  zh: `如需直接联系我们的团队：电话或 WhatsApp ${HUMAN_PHONE} — ${HUMAN_WA_URL}`,
};
const LINK_LINE = { ar: `واتساب: ${HUMAN_WA_URL}`, en: `WhatsApp: ${HUMAN_WA_URL}`, fr: `WhatsApp : ${HUMAN_WA_URL}`, zh: `WhatsApp：${HUMAN_WA_URL}` };
const hasHumanContact = (t) => String(t).includes(HUMAN_PHONE) || String(t).includes("wa.me/966530540231");

/**
 * ‏يضمن أن عميلاً طلب إنساناً أو اشتكى يخرج برقم باهر الرسمي ورابط واتساب، ولا يخرج بوعدٍ كاذب.
 * @param {string} reply  ردّ النموذج (بكتله)
 * @param {{userText: string, lang?: string, intake?: boolean}} o  userText = آخر رسالة للعميل
 * @returns {{text: string, intent: string, replaced: boolean, hit: boolean}}
 */
export function ensureHumanContact(reply, { userText, lang, intake = true } = {}) {
  const intent = escalationIntent(userText);
  const L = HUMAN_CANNED[lang] ? lang : detectLang(userText || reply);
  const { head, tail } = splitBlocks(reply);
  // ‏الوعود الكاذبة تُحذف في الاستقبال دائماً، وفي العامة حين يكون العميل في شكوى (فتلك المحادثة
  // تلتقط العملاء بقاعدتها: «باهر بيتواصل معك»).
  const sp = intake || intent ? stripFalsePromises(head) : { text: head, hit: false };
  if (intent === "strong") {
    // ‏طلب صريح: الرقم الرسمي والرابط معاً. رد النموذج يبقى إن أعطى الاثنين ولم يَعِد بما لا يملك؛
    // وإن أعطى الرقم وحده (قِيس على نموذج حقيقي، C26) يُضاف الرابط بدل استبدال الرد.
    const hasPhone = sp.text.includes(HUMAN_PHONE), hasLink = sp.text.includes("wa.me/966530540231");
    if (hasPhone && hasLink && !sp.hit) return { text: reply, intent, replaced: false, hit: false };
    if (hasPhone && !sp.hit) {
      const fixed = head.replace(/\s+$/, "") + `\n${LINK_LINE[L]}`;
      return { text: join(fixed, tail), intent, replaced: false, hit: true };
    }
    const scope = /<<\s*SCOPE/i.test(tail) ? tail.slice(tail.search(/<<\s*SCOPE/i)) : "";
    return { text: join(HUMAN_CANNED[L], scope), intent, replaced: true, hit: true };
  }
  let text = sp.text;
  if (intent === "weak" && !hasHumanContact(text)) text = (text.trim() ? text.replace(/\s+$/, "") + "\n\n" : "") + HUMAN_LINE[L];
  else if (intent === "weak" && !text.includes("wa.me/966530540231")) text = text.replace(/\s+$/, "") + `\n${LINK_LINE[L]}`;
  const changed = sp.hit || text !== head;
  return { text: changed ? join(text, tail) : reply, intent, replaced: false, hit: changed };
}

// ───────────────────────── ٢) النطاق لا يتأخر ─────────────────────────

// ‏تحليل كتلة النطاق بالتساهل نفسه الذي في واجهة الرئيسية (simple-v1.mjs): قد يُهمل النموذج
// الأقواس أو يترك <<END>>؛ المهم هل تُقرأ كتلةً صالحة بـready:true.
export function parseScopeBlock(text) {
  const s = String(text || "");
  const m = /<*\s*SCOPE\s*>>/i.exec(s);
  if (!m) return null;
  const after = m.index + m[0].length;
  const e = /<*\s*END\s*>>/i.exec(s.slice(after));
  const raw = e ? s.slice(after, after + e.index) : s.slice(after);
  let o = null;
  try { o = JSON.parse(raw); } catch {
    const b = raw.indexOf("{"), d = raw.lastIndexOf("}");
    if (b >= 0 && d > b) { try { o = JSON.parse(raw.slice(b, d + 1)); } catch { /* غير صالحة */ } }
  }
  return o && typeof o === "object" ? o : null;
}
export const hasValidScope = (text) => { const o = parseScopeBlock(text); return !!(o && o.ready); };

/** ‏عدد رسائل العميل التي بلغت النموذج. */
export const userTurnsOf = (messages) => (messages || []).filter((m) => m && m.role === "user").length;

export const SCOPE_DEADLINE_TURNS = 3;

/**
 * ‏هل يجب فرض النطاق الآن؟ العميل في رسالته الثالثة (أو بعدها) ولا نطاق في أي دورٍ سابق ولا في هذا الرد.
 * إن كان في التاريخ نطاقٌ صالح فالعميل يعدّله بيده ولا نُلحّ عليه.
 */
export function shouldForceScope(messages, reply) {
  if (userTurnsOf(messages) < SCOPE_DEADLINE_TURNS) return false;
  if ((messages || []).some((m) => m && m.role === "assistant" && hasValidScope(m.content))) return false;
  return !hasValidScope(reply);
}
export const FORCE_SCOPE_NOTE = "\n\n⚠️ إلزامي في هذا الدور: بلغ العميل رسالته الثالثة. لا تطرح أي سؤال الآن. اكتب رسالة قصيرة (سطر أو سطران) تقول فيها إنك رتّبت له نطاق الخدمات والمستندات المطلوبة ليراجعها، ثم أخرج كتلة <<SCOPE>>{...}<<END>> كاملة بـ\"ready\":true في سطر مستقل في آخر الرد، وأكمل ما بقي غامضاً في needs لا في سؤال.";

// ───────────────────────── ٣) مدد مخترعة ─────────────────────────

const NUM = "\\d{1,3}(?:[.,٫]\\d{1,2})?(?![\\d])";
const SEP = "[-–—~]|الي|الى|to|à|و|and|et|至|到";
const UNIT_AR = "يومين|يوم|ايام|اسبوعين|اسبوع|اسابيع|شهرين|شهر|اشهر|شهور|ساعتين|ساعه|ساعات|سنتين|سنه|سنوات|سنين";
const UNIT_EN = "(?:business|working|calendar)\\s+days?|days?|weeks?|months?|hours?|hrs?|years?|yrs?";
const UNIT_FR = "jours?(?:\\s+ouvr(?:e|é)s?|\\s+ouvrables)?|semaines?|mois|heures?|ans|an|ann[ée]es?";
const UNIT_ZH = "个?工作日|个月|个?星期|周|天|小时|年";
const DUR_RE = new RegExp(
  `(?<![A-Za-z\\p{N}.])(${NUM})(?:\\s*(?:${SEP})\\s*(${NUM}))?\\s*((?:${UNIT_AR}|${UNIT_EN}|${UNIT_FR})(?![\\p{L}])|${UNIT_ZH})`,
  "giu");
const WORD_NUM = { ثلاثه: 3, اربعه: 4, خمسه: 5, سته: 6, سبعه: 7, ثمانيه: 8, تسعه: 9, عشره: 10, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const WORD_DUR_RE = new RegExp(
  `(?<![\\p{L}\\p{N}])(ثلاثه|اربعه|خمسه|سته|سبعه|ثمانيه|تسعه|عشره|two|three|four|five|six|seven|eight|nine|ten)\\s+((?:${UNIT_AR}|${UNIT_EN})(?![\\p{L}]))`, "giu");
const DUAL_RE = /(?<![\p{L}\p{N}])(يومين|اسبوعين|شهرين|ساعتين|سنتين)(?![\p{L}])/giu;
const DUAL = { يومين: ["day", 2], اسبوعين: ["week", 2], شهرين: ["month", 2], ساعتين: ["hour", 2], سنتين: ["year", 2] };

function unitFamily(u) {
  const x = String(u).toLowerCase();
  if (/يوم|ايام|day|jour|天|工作日/.test(x)) return "day";
  if (/اسبوع|اسابيع|week|semaine|星期|周/.test(x)) return "week";
  if (/شهر|اشهر|شهور|month|mois|个月/.test(x)) return "month";
  if (/ساع|hour|hrs?\b|heure|小时/.test(x)) return "hour";
  return "year";   // ‏سنه/سنوات/سنين/year/yrs/an/année/年
}
const unitLang = (u) => (/[一-鿿]/.test(u) ? "zh" : /[؀-ۿ]/.test(u) || /يوم|ايام|اسبوع|شهر|ساع|سن/.test(u) ? "ar" : /jour|semaine|mois|heure|\bans?\b|ann/i.test(u) ? "fr" : "en");
const keyOf = (lo, hi, fam) => (lo === hi ? `${lo}|${fam}` : `${lo}-${hi}|${fam}`);
const num = (s) => { const n = parseFloat(String(s).replace(/[,٫]/, ".")); return Number.isFinite(n) ? n : NaN; };

/**
 * ‏كل تعبير مدة (رقم/نطاق + وحدة) في نصٍّ: [{start,end,key,lo,hi,fam,lang}] على النص الأصلي.
 * 2015年 ونحوها (سنة تقويمية) لا تُعدّ مدة.
 */
export function durationsIn(text) {
  const src = String(text == null ? "" : text);
  const n = lp(src);
  const out = [];
  for (const m of n.matchAll(DUR_RE)) {
    let lo = num(m[1]), hi = m[2] != null ? num(m[2]) : lo;
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) continue;
    if (lo > hi) [lo, hi] = [hi, lo];
    const fam = unitFamily(m[3]);
    if (fam === "year" && lo >= 1900 && lo <= 2100 && hi === lo) continue;
    out.push({ start: m.index, end: m.index + m[0].length, key: keyOf(lo, hi, fam), lo, hi, fam, lang: unitLang(m[3]), range: m[2] != null });
  }
  for (const m of n.matchAll(WORD_DUR_RE)) {
    const v = WORD_NUM[m[1]]; if (!v) continue;
    const fam = unitFamily(m[2]);
    out.push({ start: m.index, end: m.index + m[0].length, key: keyOf(v, v, fam), lo: v, hi: v, fam, lang: unitLang(m[2]), range: false });
  }
  for (const m of n.matchAll(DUAL_RE)) {
    const [fam, v] = DUAL[m[1]];
    out.push({ start: m.index, end: m.index + m[0].length, key: keyOf(v, v, fam), lo: v, hi: v, fam, lang: "ar", range: false });
  }
  return out.sort((a, b) => a.start - b.start);
}

/**
 * ‏المدد «الواردة حرفياً»: كل مدة (بعد توحيد الأرقام الهندية وفواصل النطاق «–/-/إلى/to»)
 * وردت في المقاطع المرفقة بالنموذج لهذا الدور أو كتبها العميل نفسه. ويُقبل رقمٌ مفرد يساوي
 * طرف نطاقٍ وارد بالوحدة نفسها («10 أيام» من «3–10 أيام»)، ولا يُقبل نطاقٌ غير وارد.
 * @returns {{keys: Set<string>, ends: Map<string, Set<number>>}}
 */
export function allowedDurations(...texts) {
  const keys = new Set(), ends = new Map();
  for (const t of texts) for (const d of durationsIn(t)) {
    keys.add(d.key);
    if (!ends.has(d.fam)) ends.set(d.fam, new Set());
    ends.get(d.fam).add(d.lo); ends.get(d.fam).add(d.hi);
  }
  return { keys, ends };
}
const durationAllowed = (d, allow) => allow.keys.has(d.key) || (!d.range && !!(allow.ends.get(d.fam) && allow.ends.get(d.fam).has(d.lo)));

const NEUTRAL_DURATION = {
  ar: "مدة تحددها الجهة المختصة",
  en: "a period set by the competent authority",
  fr: "un délai fixé par l’autorité compétente",
  zh: "主管部门规定的期限",
};
const LEAD_APPROX = /(?:\\?~|≈|نحو|حوالي|حوالى|تقريبا|تقريباً|تقريبًا|بحدود|nearly|around|about|approximately|approx\.?|roughly|circa|d['’]environ|environ|约|大约|大概)\s*$/iu;
const LEAD_RANGE = /(?:(?:ما\s+)?بين|من|between|from|entre|de|从|由)\s*$/iu;
const TRAIL = /^\s*(?:عمل|رسميه|رسمية|تقريبا|تقريباً|تقريبًا|business|working|ouvrables|ouvr[ée]s?|工作|左右|or\s+so|approximately|roughly)/iu;

/**
 * ‏يستبدل بكل مدة غير واردة حرفياً عبارةً محايدة («مدة تحددها الجهة المختصة») بدل أن يحذف الجملة،
 * فتبقى الجملة سليمة ولا يخرج رقمٌ مخترَع. لا يمسّ ما ورد في المقاطع أو في كلام العميل.
 * @param {string} text
 * @param {{knowledge?: string, userText?: string, lang?: string}} o
 * @returns {{text: string, hit: boolean, found: string[]}}
 */
export function guardDurations(text, { knowledge = "", userText = "" } = {}) {
  const src = String(text == null ? "" : text);
  const all = durationsIn(src);
  if (!all.length) return { text: src, hit: false, found: [] };
  const allow = allowedDurations(knowledge, userText);
  const bad = all.filter((d) => !durationAllowed(d, allow));
  if (!bad.length) return { text: src, hit: false, found: [] };
  let out = src;
  for (const d of bad.slice().reverse()) {
    let s = d.start, e = d.end;
    for (let i = 0; i < 2; i++) { const m = LEAD_APPROX.exec(out.slice(Math.max(0, s - 24), s)); if (!m) break; s -= m[0].length; }
    if (d.range) { const m = LEAD_RANGE.exec(out.slice(Math.max(0, s - 12), s)); if (m) s -= m[0].length; }
    for (let i = 0; i < 2; i++) { const m = TRAIL.exec(out.slice(e, e + 24)); if (!m) break; e += m[0].length; }
    const phrase = NEUTRAL_DURATION[d.lang] || NEUTRAL_DURATION.ar;
    out = out.slice(0, s) + phrase + out.slice(e);
  }
  return { text: out, hit: true, found: bad.map((d) => d.key) };
}

// ───────────────────────── ٤) سؤال واحد فقط ─────────────────────────

const Q_PLAIN = "(?:هل|كم|متي|اين|كيف|ماذا|لماذا|ليش|وش|ايش|شنو)(?![\\p{L}])";
const Q_PHRASE = "(?:اي\\s|ما\\s+(?:هو|هي|هم|نوع|اسم|عدد|سنه|الذي|الجهه|المنصه|النشاط|المدينه|حاله|طبيعه|الغرض|رايك)(?![\\p{L}]))";
const Q_EN = "(?:(?:is|are|do|does|did|can|could|will|would|have|has|what|which|how|when|where|who|why|should)\\s)";
const Q_FR = "(?:(?:est-ce|quel|quelle|quels|quelles|combien|comment|quand|pourquoi|avez-vous|disposez-vous|souhaitez-vous)(?![\\p{L}]))";
const Q_START = new RegExp(`(و?)(${Q_PLAIN}|${Q_PHRASE}|${Q_EN}|${Q_FR})`, "giu");

// ‏بدايات الأسئلة في جملةٍ واحدة: عند أولها، أو بعد فاصلة/نقطتين، أو مسبوقةً بواو العطف («وهل»، «وكم»).
function questionStarts(segN) {
  const starts = [];
  for (const m of segN.matchAll(Q_START)) {
    const before = segN.slice(0, m.index);
    const okPos = before.trim() === "" || /[،,;؛:]\s*$/.test(before) || (m[1] === "و" && /(?:^|\s)$/.test(before)) || /[،,;؛:]\s*(?:and|et)\s+$/.test(before);
    if (okPos) starts.push(m.index + m[1].length);
  }
  return starts;
}

/**
 * ‏يختصر رداً فيه سؤالان إلى سؤال واحد — الأخير (فهو ما تجيب عنه الخيارات <<OPTS>> عادةً).
 * حالتان: (أ) جملتا استفهام منفصلتان ← تُحذف السابقة؛ (ب) سؤالان في جملة واحدة يفصل بينهما
 * «، وهل/وكم/ومتى…» ← يُحذف الأول مع رابطه فتبقى الجملة سليمة. «أم» (خياران لسؤال واحد) لا تُمسّ.
 */
export function oneQuestion(reply) {
  const { head, tail } = splitBlocks(reply);
  if (!head.trim() || /<<\s*SCOPE/i.test(tail)) return { text: String(reply), hit: false };
  let h = head;
  let hit = false;
  // (أ) جُمل الاستفهام المنفصلة.
  const qs = [...h.matchAll(/[^.!؟?？\n]*[؟?？]/g)];
  if (qs.length >= 2) {
    for (const m of qs.slice(0, -1).reverse()) h = h.slice(0, m.index) + h.slice(m.index + m[0].length);
    h = h.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n");
    hit = true;
  }
  // (ب) سؤالان في جملة واحدة.
  const last = [...h.matchAll(/[^.!؟?？\n]*[؟?？]/g)].pop();
  if (last) {
    let seg = last[0];
    // ‏بعد حذف السؤال السابق قد يبقى عطفٌ في أول ما تبقّى: «وكم عدد…؟» ← «كم عدد…؟».
    const lead = /^(\s*)و(?=(?:هل|كم|متي|اين|كيف|ماذا|لماذا|ليش|وش|ايش|شنو)(?![\p{L}]))/u.exec(lp(seg));
    if (lead) { h = h.slice(0, last.index) + seg.slice(0, lead[1].length) + seg.slice(lead[1].length + 1) + h.slice(last.index + seg.length); hit = true; seg = seg.slice(0, lead[1].length) + seg.slice(lead[1].length + 1); }
    const starts = questionStarts(lp(seg));
    if (starts.length >= 2) {
      const s1 = starts[0], sn = starts[starts.length - 1];
      if (sn - s1 >= 8) {
        let kept = seg.slice(sn);
        // ‏الباقي سؤالٌ لاتيني في أول جملة: يبدأ بحرف كبير.
        if (/^[a-zà-ÿ]/.test(kept) && /(?:^|[.!?]\s*)$/.test(h.slice(0, last.index) + seg.slice(0, s1))) kept = kept[0].toUpperCase() + kept.slice(1);
        h = h.slice(0, last.index) + seg.slice(0, s1) + kept + h.slice(last.index + seg.length);
        hit = true;
      }
    }
  }
  return hit ? { text: join(h.replace(/\s+$/, ""), tail), hit } : { text: String(reply), hit: false };
}

// ───────────────────────── ٥) كتلة النطاق: النوع والأكواد ─────────────────────────

export const SCOPE_TYPES = ["CONSULTATION", "GOVERNMENT_SERVICE", "COMPANY_FORMATION", "BUSINESS_DEVELOPMENT"];
const DOOR_TYPE = { consulting: "CONSULTATION", government: "GOVERNMENT_SERVICE", formation: "COMPANY_FORMATION", bizdev: "BUSINESS_DEVELOPMENT" };

/**
 * ‏النوع قيمةٌ واحدة صالحة. «COMPANY_FORMATION|GOVERNMENT_SERVICE» (نسخ الصيغة من التعليمات حرفاً)
 * ← القيمة المطابقة لباب المحادثة إن كانت بينها، وإلا الأولى الصالحة. غير الصالح ← نوع الباب.
 */
export function normalizeScopeType(type, context, { allowBizdev = false } = {}) {
  const valid = (t) => SCOPE_TYPES.includes(t) && (allowBizdev || t !== "BUSINESS_DEVELOPMENT");
  const parts = String(type == null ? "" : type).toUpperCase().split(/[^A-Z_]+/).filter(Boolean).filter(valid);
  const door = DOOR_TYPE[context] && valid(DOOR_TYPE[context]) ? DOOR_TYPE[context] : "CONSULTATION";
  if (!parts.length) return door;
  return parts.includes(door) ? door : parts[0];
}

// ‏كلمات عامة لا تُثبت وحدها أن الكود يخصّ البند (أفعال خدمة وأسماء شائعة).
const GENERIC_AR = new Set(["شركه", "شركات", "خدمه", "خدمات", "طلب", "منشاه", "منشات", "اصدار", "تقديم", "متابعه", "مراجعه", "تجهيز", "استخراج", "تسجيل", "فتح", "تفعيل", "تنفيذ", "اجراءات", "اجراء", "الحصول", "علي", "في", "من", "الي", "عن", "مع", "او", "لدي", "بعد", "قبل", "لدي", "مستندات", "وثائق", "بيانات", "عميل", "جهه", "جهات", "المطلوبه", "المطلوب", "للشركه", "لشركه", "دعم", "كامل", "جديد", "جديده", "عبر", "هذه", "هذا", "التي", "الذي", "ذلك", "مع", "ثم", "اذا", "لزم", "اخري", "الاخري", "وتقديم", "وتجهيز", "ومتابعه", "ومراجعه", "نظام", "فحص", "تحديد", "دراسه", "تعديل", "تغيير", "تحديث", "تصحيح", "تجديد", "الغاء", "شطب", "نقل", "تحويل", "تصفيه", "انهاء"]);
const GENERIC_LAT = new Set(["service", "services", "company", "saudi", "arabia", "request", "issuance", "registration", "support", "with", "from", "that", "this", "your", "preparation", "review", "follow", "filing", "new", "for", "and", "the", "amendment", "renewal", "cancellation", "demande", "service", "entreprise", "pour", "dans", "avec", "des", "les", "une"]);
function arTokens(s) {
  return fold(s).split(/[^\p{L}\p{N}]+/u).filter((w) => /[؀-ۿ]/.test(w))
    .map((w) => w.replace(/^(?:وال|بال|لل|فال|كال|ال)/, "").replace(/^و(?=.{4,})/, ""))
    .filter((w) => w.length >= 3 && !GENERIC_AR.has(w));
}
const latTokens = (s) => fold(s).split(/[^a-z0-9àâçéèêëîïôûùüÿœ]+/).filter((w) => w.length >= 4 && !GENERIC_LAT.has(w));
const sameAr = (a, b) => a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)) && Math.abs(a.length - b.length) <= 2);
const sameLat = (a, b) => a === b || (a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5));

// ‏أفعال التعديل/التجديد/الإلغاء/النقل: خدمةٌ اسمها يبدأ بها لا تصلح لبندٍ لا يذكر الفعل نفسه
// (BP-FI-11 «تعديل ترخيص الاستثمار» لتأسيسٍ جديد).
const ACTIONS = {
  modify: ["تعديل", "تغيير", "تحديث", "تصحيح", "تحويل", "amend", "chang", "modif", "updat", "correct", "convert", "transform", "chang", "修改", "变更", "更新", "转换"],
  renew: ["تجديد", "renew", "renouvel", "续期", "续签", "更新"],
  cancel: ["الغاء", "شطب", "تصفيه", "انهاء", "اغلاق", "cancel", "liquidat", "clos", "dissol", "annul", "radi", "resili", "注销", "清算", "关闭"],
  transfer: ["نقل", "تحويل", "transfer", "转让", "转移"],
};
function leadFamilies(nameAr) {
  const lead = fold(nameAr).split(/[^\p{L}]+/u).filter(Boolean).slice(0, 2).map((w) => w.replace(/^ال/, ""));
  return Object.entries(ACTIONS).filter(([, stems]) => lead.some((w) => stems.some((st) => /[؀-ۿ]/.test(st) && w.startsWith(st)))).map(([f]) => f);
}
function mentionsAction(text, fams) {
  const t = fold(text);
  return fams.some((f) => ACTIONS[f].some((st) => (/[一-鿿]/.test(st) ? t.includes(st) : new RegExp(`(?<![\\p{L}])(?:ال)?${st}`, "u").test(t))));
}

// ‏الجهات: بندٌ يذكر جهةً والخدمة تخصّ جهةً أخرى كلياً (BP-HRSD-04 «نظام العمل» لمخالفة بلدية).
const ENTITIES = [
  ["balady", /بلدي|بلديه|امانه|balady|municipal|بلدية/u],
  ["hrsd", /نظام\s+العمل|الموارد\s+البشريه|(?<![\p{L}])(?:قوي|مدد|مساند|اجير)(?![\p{L}])|qiwa|mudad|musaned|ajeer|hrsd|labou?r/u],
  ["gosi", /التامينات|gosi/u],
  ["muqeem", /مقيم|الجوازات|اقامه|iqama|muqeem|jawazat/u],
  ["absher", /ابشر|absher/u],
  ["sbc", /المركز\s+السعودي\s+للاعمال|سجل\s+تجاري|السجل\s+التجاري|وزاره\s+التجاره|الغرفه\s+التجاريه|commercial\s+regist|business\s+center|chamber/u],
  ["misa", /الاستثمار|ميسا|misa|investment/u],
  ["zatca", /الزكاه|الضريبه|زاتكا|zatca|vat\b/u],
];
const entitiesOf = (text) => { const t = fold(text); return new Set(ENTITIES.filter(([, re]) => re.test(t)).map(([k]) => k)); };

/**
 * ‏هل يصلح كود الكتالوج لهذا البند؟ يحتاج: (١) كلمة جوهرية مشتركة بين اسم الخدمة والبند،
 * (٢) إن بدأ اسم الخدمة بفعل تعديل/تجديد/إلغاء/نقل فالبند يذكر الفعل، (٣) ألا تتعارض الجهة.
 * @param {{title?: string, why?: string}} item
 * @param {{nameAr?: string, nameEn?: string, govPlatform?: string}} svc
 * @param {{scopeTitle?: string}} [ctx]
 */
export function codeFits(item, svc, ctx = {}) {
  const text = `${(item && item.title) || ""} ${(item && item.why) || ""}`;
  const sc = scriptOf(text);
  if (sc === "zh" || sc === "none") return false;
  const nameAr = (svc && svc.nameAr) || "", nameEn = (svc && svc.nameEn) || "";
  const arShared = arTokens(text).some((a) => arTokens(nameAr).some((b) => sameAr(a, b)));
  const latShared = latTokens(text).some((a) => latTokens(nameEn).some((b) => sameLat(a, b)));
  if (!arShared && !latShared) return false;
  const fams = leadFamilies(nameAr);
  if (fams.length && !mentionsAction(text, fams)) return false;
  // ‏البند يحمل اسم الخدمة كلّه (كلماتها الجوهرية جميعاً): هو الخدمة نفسها، فلا يُنقض بجهة عنوان الطلب
  // (طلب تجديد إقامة قد يضمّ بنداً «إصدار أو تجديد رخصة عمل» بكود قوى وهو صحيح).
  const nameTok = arTokens(nameAr), itemTok = arTokens(text);
  if (nameTok.length >= 2 && nameTok.every((a) => itemTok.some((b) => sameAr(a, b)))) return true;
  const eSvc = entitiesOf(`${nameAr} ${nameEn} ${(svc && svc.govPlatform) || ""}`);
  let eItem = entitiesOf(text);
  if (!eItem.size && ctx.scopeTitle) { const t = entitiesOf(ctx.scopeTitle); if (t.size === 1) eItem = t; }
  if (eSvc.size && eItem.size && ![...eItem].some((e) => eSvc.has(e))) return false;
  return true;
}

// ───────────────────────── ٦) كلمات المرور وبيانات الدخول ─────────────────────────

const CRED = [
  /كلمه\s+(?:ال)?(?:مرور|سر)|(?:ال)?رقم\s+(?:ال)?سري|(?:ال)?رمز\s+(?:ال)?سري|بيانات\s+(?:ال)?(?:دخول|اعتماد)|بيانات\s+تسجيل\s+(?:ال)?دخول|اسم\s+(?:ال)?مستخدم|يوزر|باسورد|رمز\s+(?:ال)?تحقق|(?:ال)?دخول\s+(?:الي|الى|علي|ل)\s+(?:حساب|منصه)/u,
  /password|passcode|passwd|log-?in\s+(?:credentials|details|info)|sign-?in\s+(?:credentials|details)|credentials|user\s*name|\botp\b|verification\s+code/i,
  /mot\s+de\s+passe|identifiants|code\s+de\s+v[ée]rification|nom\s+d['’]utilisateur/i,
  /密码|登录信息|登录凭|用户名|验证码|账号密码/u,
];
const NEGATION = /(?<![\p{L}])(?:لا|لن|ممنوع|دون|بدون|بلا|عدم|ليس|never|not|don't|do\s+not|without|jamais|sans|ne)(?![\p{L}])|n't|不要|无需|不用|切勿|勿/iu;
export const asksCredentials = (t) => { const f = fold(t); return CRED.some((re) => re.test(f)); };

const AUTH_NEED = {
  ar: "تفويض أو وكالة نظامية لنا بالتعامل مع المنصة نيابةً عنك",
  en: "Authorization or power of attorney for us to act on the platform on your behalf",
  fr: "Autorisation ou procuration nous permettant d’agir sur la plateforme en votre nom",
  zh: "授权书或委托书（授权我们代您在平台办理）",
};
const AUTH_SENTENCE = {
  ar: "لا نطلب منك كلمة مرور ولا بيانات دخول؛ يكفي تفويض أو وكالة نظامية لننفّذ المعاملة نيابةً عنك.",
  en: "We never ask for passwords or login details; an authorization or power of attorney is enough for us to act on your behalf.",
  fr: "Nous ne demandons jamais de mot de passe ni d’identifiants ; une autorisation ou procuration suffit.",
  zh: "我们不会索取密码或登录信息；只需授权书或委托书即可代您办理。",
};

/** ‏جملٌ في النثر تطلب كلمة مرور/بيانات دخول (دون نفيٍ) تُستبدل بجملة التفويض مرة واحدة. */
export function guardCredentials(text, { lang } = {}) {
  const { head, tail } = splitBlocks(text);
  const L = AUTH_SENTENCE[lang] ? lang : detectLang(head);
  let hit = false, said = false;
  const out = sentences(head).map((s) => {
    if (!asksCredentials(s) || NEGATION.test(fold(s))) return s;
    hit = true;
    if (said) return "";
    said = true;
    return (/\n$/.test(s) ? AUTH_SENTENCE[L] + "\n" : AUTH_SENTENCE[L]);
  }).join(" ").replace(/[ \t]{2,}/g, " ").replace(/ ?\n ?/g, "\n").trim();
  return hit ? { text: join(out, tail), hit } : { text: String(text), hit: false };
}

/**
 * ‏ينقّي كتلة <<SCOPE>> ويعيد الرد كاملاً:
 *  • type قيمة واحدة صالحة.
 *  • كل code: موجود في الكتالوج، ويصلح لمعنى البند (codeFits)، وإلا يُسقط الكود ويبقى البند.
 *    الخدمة التي اختارها العميل بنفسه من الموقع (picked) محفوظة بكودها دائماً.
 *  • بند في needs أو items يطلب كلمة مرور/بيانات دخول ← يُستبدل ببند تفويض/وكالة (مرة واحدة).
 *  • أي مدة غير واردة حرفياً في المقاطع تُحايَد (guardDurations) في نصوص الكتلة.
 * @param {string} reply
 * @param {{context?: string, services?: Array, picked?: Set<string>|string[], lang?: string, knowledge?: string, userText?: string, allowBizdev?: boolean}} o
 */
export function sanitizeScope(reply, { context = "consulting", services = [], picked = [], lang = "ar", knowledge = "", userText = "", allowBizdev = false } = {}) {
  const s = String(reply || "");
  const m = /<<\s*SCOPE\s*>>([\s\S]*?)<<\s*END\s*>>/.exec(s);
  if (!m) return { text: s, changes: [] };
  let o;
  try { o = JSON.parse(m[1]); } catch { return { text: s, changes: [] }; }
  if (!o || typeof o !== "object") return { text: s, changes: [] };
  const changes = [];
  const L = AUTH_NEED[lang] ? lang : "ar";
  const pickedSet = new Set([...picked].map((c) => String(c).toUpperCase()));
  const byCode = new Map((services || []).map((sv) => [String(sv.code).toUpperCase(), sv]));

  const t = normalizeScopeType(o.type, context, { allowBizdev });
  if (t !== o.type) { changes.push(`type:${o.type}→${t}`); o.type = t; }

  const dur = (str) => {
    if (typeof str !== "string") return str;
    const g = guardDurations(str, { knowledge, userText, lang });
    if (g.hit) changes.push(`duration:${g.found.join(",")}`);
    return g.text;
  };
  let authAdded = false;
  const auth = () => { if (authAdded) return null; authAdded = true; return AUTH_NEED[L]; };

  if (Array.isArray(o.items)) {
    const kept = [];
    for (const it of o.items) {
      if (!it || typeof it !== "object") continue;
      if (asksCredentials(`${it.title || ""} ${it.why || ""}`) && !NEGATION.test(fold(`${it.title || ""} ${it.why || ""}`))) {
        changes.push("credentials:item");
        const a = auth(); if (a) kept.push({ code: "", title: a, why: "" });
        continue;
      }
      const item = { ...it };
      if (item.code) {
        const key = String(item.code).trim().toUpperCase();
        const svc = byCode.get(key);
        if (!svc) { changes.push(`code-unknown:${item.code}`); item.code = ""; }
        else if (!pickedSet.has(key) && !codeFits(item, svc, { scopeTitle: o.title })) { changes.push(`code-mismatch:${svc.code}`); item.code = ""; }
        else { if (item.code !== svc.code) changes.push(`code-case:${item.code}`); item.code = svc.code; }
      }
      if (typeof item.title === "string") item.title = dur(item.title);
      if (typeof item.why === "string") item.why = dur(item.why);
      kept.push(item);
    }
    o.items = kept;
  }
  if (Array.isArray(o.needs)) {
    const needs = [];
    for (const n of o.needs) {
      const txt = typeof n === "string" ? n : (n && n.title) || "";
      if (asksCredentials(txt) && !NEGATION.test(fold(txt))) {
        changes.push("credentials:need");
        const a = auth(); if (a) needs.push(typeof n === "string" ? a : { ...n, title: a, note: "" });
        continue;
      }
      needs.push(typeof n === "string" ? dur(n) : n && typeof n === "object" ? { ...n, title: dur(n.title), note: dur(n.note) } : n);
    }
    o.needs = needs;
  }
  if (typeof o.summary === "string") o.summary = dur(o.summary);
  if (typeof o.title === "string") o.title = dur(o.title);
  if (!changes.length) return { text: s, changes };
  return { text: s.slice(0, m.index) + `<<SCOPE>>${JSON.stringify(o)}<<END>>` + s.slice(m.index + m[0].length), changes };
}

// ───────────────────────── ٧) الباب الرابع المخفي: جواب موحّد مهذّب ─────────────────────────

// ‏«تطوير الأعمال» (Revenue OS) مخفي بقرار المالك. من سأل عنها باسمها يسمع جملةً واحدة موحّدة في كل
// الأبواب بدل أن يقول النموذج مرة «نقدّمها» ومرة «لا نقدمها» (C14) أو يُجيب عن باقاتها (X03).
const BIZDEV_NO = {
  ar: { say: "خدمة تطوير الأعمال غير متاحة حالياً، ويسعدنا خدمتك في الاستشارات والخدمات الحكومية وتأسيس الشركات.", ask: "ما الذي تحتاجه من هذه الخدمات؟", opts: ["استشارة أعمال", "خدمة حكومية", "تأسيس شركة"] },
  en: { say: "Our business development service is not available at the moment, but we would be glad to help with consultations, government services and company formation.", ask: "Which of these do you need?", opts: ["Business consultation", "Government service", "Company formation"] },
  fr: { say: "Notre service de développement commercial n’est pas disponible pour le moment, mais nous serons ravis de vous aider en conseil, services gouvernementaux et création d’entreprise.", ask: "De quoi avez-vous besoin ?", opts: ["Conseil aux entreprises", "Service gouvernemental", "Création d’entreprise"] },
  zh: { say: "业务拓展服务目前暂未开放，我们很乐意为您提供企业咨询、政府服务和公司设立方面的协助。", ask: "您需要哪一项？", opts: ["企业咨询", "政府服务", "公司设立"] },
};
const SAYS_UNAVAILABLE = /غير\s+متاح|not\s+(?:currently\s+)?available|isn['’]t\s+available|n['’]est\s+pas\s+disponible|暂未开放|暂不|不可用/i;
/** ‏يستبدل ردّاً عن الخدمة المخفية بالصيغة الموحّدة (ما لم يقلها النموذج أصلاً). */
export function bizdevUnavailable(reply, { lang, intake = true } = {}) {
  const { head } = splitBlocks(reply);
  if (SAYS_UNAVAILABLE.test(head)) return { text: String(reply), hit: false };
  const L = BIZDEV_NO[lang] ? lang : detectLang(head);
  const b = BIZDEV_NO[L];
  const text = intake ? `${b.say}\n${b.ask}\n<<OPTS>>${JSON.stringify(b.opts)}<<END>>` : b.say;
  return { text, hit: true };
}

// ───────────────────────── مساعدات مشتركة ─────────────────────────

/** ‏ما يُقرأ منه اختيار المعرفة: آخر رسالتين (يطابق ما في handler حرفاً، ويعيده الـeval لحسابه محلياً). */
export function focusOf(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter((m) => m && typeof m.content === "string")
    .slice(-2).map((m) => m.content).join(" ").slice(0, 1200);
}
export const userTextOf = (messages) => (Array.isArray(messages) ? messages : []).filter((m) => m && m.role === "user" && typeof m.content === "string").map((m) => m.content).join("\n");
export const lastUserText = (messages) => { const u = (Array.isArray(messages) ? messages : []).filter((m) => m && m.role === "user" && typeof m.content === "string"); return u.length ? u[u.length - 1].content : ""; };
