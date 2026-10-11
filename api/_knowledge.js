// ‏اختيار ما يلزم من قاعدة المعرفة بدل إرسالها كاملة.
//
// كانت `knowledge.json` تُحقن كاملةً في تعليمات كل رسالة: ١٩٧ كيلوبايت،
// نحو ٤٥ ألف رمز عربي في كل دور من كل محادثة. هذا:
//   • أسقط Groq بـ413 «Request too large … TPM Limit 8000, Requested 45796»،
//   • واستهلك رصيد Gemini وAnthropic أضعافَ ما يلزم — سؤالٌ من سطرٍ واحد
//     كان يُفوتر كأنه كتاب.
// القاعدة مقسّمة أصلاً إلى ١٠٨ أقسام بعنوان `## جهة: …`، ومتوسط القسم ٧٢٣
// حرفاً. فبدل الكتاب كله تُرسل الأقسام التي تخصّ سؤال العميل فقط.
//
// الاختيار نصيٌّ بسيط بلا نموذج ولا تضمين: تقاطع كلمات السؤال مع كلمات
// القسم، والعنوان يزن أكثر من المتن. بسيطٌ ومفهومٌ ويُصلَّح بالعين — وهو ما
// يناسب قاعدةً يحرّرها بشر.
//
// ── الأقسام المقيَّدة (gated) ──────────────────────────────────────────────
// قسمٌ وُسم في سطره الثاني بـ `<!--gate:اسم-->` لا يدخل هذا الاختيار النصيّ
// أبداً. سببه: قسم «تطوير الأعمال» أكثر كلماته عامّة («أعمال»، «عملاء»،
// «شركات»، «خدمة»)، فلو نافس بالدرجات لأزاح أقساماً صحيحة في أسئلة الأبواب
// القديمة (قِيس: ٧ من ٢٠ رسالة). فالقسم المقيَّد يُضمّ فقط حين:
//   • الباب نفسه هو بابه (`opts.door` من الخادم)، أو
//   • دلّ نصّ السؤال على نيّته بعبارةٍ خاصّة به (GATES أدناه) — لا بكلمةٍ عامة.
// وحين لا يُفتح، فالناتج حرفاً هو ما كان قبل إضافة القسم: القسم المقيَّد
// يُنزع من النص قبل التقسيم (بما قبله من أسطر فارغة) فلا تتغيّر أعداد
// الأقسام ولا فهارسها ولا أحجامها ولا الفهرس.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW = JSON.parse(readFileSync(join(__dirname, "knowledge.json"), "utf8"));

// ‏بوّابات الأقسام المقيَّدة. المفتاح هو اسم الوسم `<!--gate:…-->` في القاعدة.
//  • door:   قيمة `opts.door` التي تفتح القسم دائماً (الباب يخصّه).
//  • intent: عباراتٌ خاصّة بالقسم على نصٍّ مُوحَّد الحروف (انظر `norm`). **لا
//            كلمة عامة وحدها** — «أعمال»/«عملاء»/«شركات»/«مبيعات»/CRM/«سعر
//            الباقة» لا تفتح شيئاً؛ العبارة هي التي تفتح («عملاء جدد»،
//            «مبيعاتنا ضعيفة»، «باقة النمو»، «Revenue OS»…).
const P = "\\p{L}*";
const END = "(?![\\p{L}])";
const GATES = {
  bizdev: {
    door: "bizdev",
    intent: [
      // ‏الخدمة باسمها
      /revenue\s*-?\s*os(?![a-z])/,
      /(?:^|[^a-z])rev-[a-z]{3,}/,
      /bizdev|biz\s+dev|business[\s-]+development|developpement\s+commercial/,
      new RegExp(`نظام\\s+تشغيل\\s+(?:ال)?ايرادات`, "u"),
      new RegExp(`تطوير\\s+(?:ال)?اعمال${END}`, "u"),
      /业务拓展|业务开发/,
      // ‏باقاتها: اسم الباقة ملاصقاً لكلمة «باقة»، أو الباقتان متجاورتين
      new RegExp(`باقه\\s+(?:ال)?(?:نمو|انطلاق|بدايه|احترافيه|منشات\\s+(?:ال)?كبري|فريق\\s+(?:ال)?مخصص)${END}`, "u"),
      new RegExp(`(?:انطلاق|نمو|احترافيه)\\s+(?:و|او|ام)\\s*(?:ال)?(?:انطلاق|نمو|احترافيه|بدايه)${END}`, "u"),
      /(?:growth|launch|starter)\s+(?:package|plan|tier)|dedicated\s+team/,
      // ‏وجع المبيعات وطلب العملاء
      new RegExp(`مبيعات${P}\\s+(?:${P}\\s+)?(?:ضعيف|قليل|متراجع|منخفض|نازل|متدني|واقف|ضعف)`, "u"),
      new RegExp(`(?:ضعف|قله|تراجع|انخفاض|ركود)\\s+(?:ال)?مبيعات`, "u"),
      new RegExp(`(?:زياده|ازيد|نزيد|ازود|نزود|اضاعف|نضاعف|تنميه|انمي|نمي)\\s+(?:ال)?مبيعات`, "u"),
      new RegExp(`(?:عملاء|زبائن)\\s+(?:جدد|محتملين|مستهدفين)|عميل\\s+جديد`, "u"),
      new RegExp(`(?:ابغي|ابي|نبغي|نبي|ابحث\\s+عن|نبحث\\s+عن|ادور\\s+(?:علي|عن)|ندور\\s+(?:علي|عن)|احتاج|نحتاج|اريد|نريد)\\s+(?:ال)?(?:عملاء|زبائن|موردين|موزعين|موزع)${END}`, "u"),
      new RegExp(`شريك\\s+او\\s+موزع|موزع(?:ين)?${END}`, "u"),
      /pipeline|بايب\s*لاين/,
      new RegExp(`(?:قمع|خط|مسار)\\s+(?:ال)?مبيعات`, "u"),
      new RegExp(`قاعده\\s+(?:ال)?(?:عملاء|موردين)|(?:قائمه\\s+)?شركات\\s+مستهدفه`, "u"),
      new RegExp(`حجز\\s+(?:ال)?(?:اجتماعات|مواعيد\\s+مع)`, "u"),
      new RegExp(`عموله\\s+(?:ال)?نجاح|مساحه\\s+(?:ال)?عمل\\s+(?:ال)?تجريبيه`, "u"),
      new RegExp(`(?:فريق|فريقنا)\\s+(?:ال)?مبيعات|(?:يغلق|اغلاق|نغلق)\\s+(?:ال)?صفقات`, "u"),
      /(?:new|more|find|get|attract|acquire)\s+(?:customers|clients|leads)|lead\s*gen(?:eration)?|sales\s+(?:pipeline|funnel|team|leads)|outbound\s+sales|(?:grow|increase)\s+(?:my\s+|our\s+)?sales/,
      /nouveaux\s+clients|prospection/,
      /新客户|获客|销售线索|增加销量/,
    ],
  },
};

// ‏توحيد الحروف لمطابقة النيّة فقط (لا للاختيار الأصلي): نزع التشكيل
// والتطويل وهمزات الألف، ة→ه، ى→ي، وإزالة لهجات الحروف اللاتينية.
function norm(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ًͯ-ٰٟـ]/g, "")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");
}

/** هل يدلّ نصّ السؤال أو بابُه على نيّة القسم المقيَّد؟ */
function gateOpen(name, query, door) {
  const g = GATES[name];
  if (!g) return false;
  if (door && door === g.door) return true;
  const q = norm(query);
  return g.intent.some((re) => re.test(q));
}

// ‏القسم المقيَّد: سطر العنوان ثم سطر الوسم. يُنزع هو وما يسبقه من أسطر فارغة
// حتى فاصل القسم التالي (أو نهاية النص)، فيبقى ما عداه كما هو بالحرف.
const GATED_BLOCK = /\n*^(## [^\n]*)\n<!--gate:([\w-]+)-->\n([\s\S]*?)(?=\n\n## |(?![\s\S]))/gm;

function parse(raw) {
  const gated = [];
  const plain = String(raw).replace(GATED_BLOCK, (_m, heading, gate, rest) => {
    gated.push({ gate, text: `${heading}\n${rest}`.replace(/\s+$/, "") });
    return "";
  });
  // ‏القسم يبدأ بسطر `## `. أول جزء قبل أول `##` مقدّمةٌ تُلحق بما بعدها.
  const sections = plain
    .split(/(?=^## )/m)
    .map((body) => ({ title: (body.split("\n")[0] || "").trim(), body }))
    .filter((s) => s.body.trim().length > 40);
  return { sections, gated };
}

// ‏تفكيك عربيٌّ فقير ومقصود: نزع أل التعريف والحروف المفردة، وإبقاء ما طوله
// ثلاثة أحرف فأكثر. لا جذوعَ ولا معجم — الأسماء الحكومية تتكرر حرفياً
// (قوى، أجير، مدد، زاتكا، الإقامة المميزة) فيكفي التطابق النصي.
const STOP = new Set(["على", "عن", "من", "إلى", "الى", "في", "هل", "ما", "هذا", "هذه", "التي", "الذي", "كيف", "أين", "متى", "مع", "أو", "او", "and", "the", "for", "with", "you", "how", "what"]);
function tokens(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((w) => (w.length > 3 && w.startsWith("ال") ? w.slice(2) : w))
    .filter((w) => w.length >= 3 && !STOP.has(w));
}

function score(section, qs) {
  const title = section.title.toLowerCase();
  const body = section.body.toLowerCase();
  let n = 0;
  for (const q of qs) {
    if (title.includes(q)) n += 8;      // ‏العنوان يحسم: «جهة: قوى» لسؤالٍ عن قوى
    else if (body.includes(q)) n += 1;
  }
  return n;
}

/**
 * ‏يبني أداة اختيار فوق نصّ قاعدة معرفة. تُصدَّر ليختبر `tests/` الأداة على نصٍّ
 * مع القسم المقيَّد ونصٍّ بدونه ويقارن الناتجين؛ الإنتاج يستعمل `MAIN` أدناه.
 */
export function makePicker(raw) {
  const { sections: SECTIONS, gated: GATED } = parse(raw);

  // ‏الاختيار الأصلي بلا أي تغيير في خوارزميته ولا ميزانيته. `fallback=false`
  // يُستعمل فقط حين يُضمّ قسمٌ مقيَّد، فلا تُملأ البقية بالملخص العام.
  function pickPlain(query, budget, fallback) {
    const qs = [...new Set(tokens(query))];
    const ranked = SECTIONS
      .map((s, i) => ({ s, i, n: qs.length ? score(s, qs) : 0 }))
      .filter((r) => r.n > 0)
      .sort((a, b) => b.n - a.n || a.i - b.i);

    const chosen = [];
    let used = 0;
    for (const r of ranked) {
      const len = r.s.body.length;
      // ‏قسمٌ أكبر من الميزانية كلها يُقصّ لا يُسقَط: قسم الملخص وحده ١٤ ألف حرف.
      const take = len <= budget - used ? r.s.body : r.s.body.slice(0, Math.max(0, budget - used));
      if (take.length < 200) break;
      chosen.push({ i: r.i, text: take });
      used += take.length;
      if (used >= budget) break;
    }
    if (!chosen.length && fallback) {
      for (const [i, s] of SECTIONS.entries()) {
        const take = s.body.slice(0, Math.max(0, budget - used));
        if (take.length < 200) break;
        chosen.push({ i, text: take });
        used += take.length;
        if (used >= budget) break;
      }
    }
    // ‏تُعاد بترتيبها الأصلي في المستند لا بترتيب الدرجة، فيبقى السياق مقروءاً.
    return chosen.sort((a, b) => a.i - b.i).map((c) => c.text).join("\n\n");
  }

  /**
   * ‏أقسام قاعدة المعرفة التي تخصّ نص العميل، في حدود ميزانية حروف.
   * حين لا يطابق شيء تُعاد الأقسام الأولى — وهي الملخص العام — كي لا يجيب
   * المساعد من فراغ.
   * @param {string} query  آخر ما كتبه العميل (أو دوراه الأخيران)
   * @param {number} budget أقصى عدد حروف
   * @param {{door?: string}} [opts] باب المحادثة إن كان يخصّ قسماً مقيَّداً
   */
  function pick(query, budget = 9000, opts = {}) {
    const open = GATED.filter((g) => gateOpen(g.gate, query, opts && opts.door));
    // ‏لا قسم مقيَّداً مفتوحاً: المسار الأصلي حرفاً بحرف.
    if (!open.length) return pickPlain(query, budget, true);

    // ‏قسمٌ مفتوح: يُحجَز له من الميزانية ما يلزمه أولاً (مقصوصاً إن زاد على
    // الميزانية كلها)، ثم يُترك للمطابقة العادية ما بقي — فالمجموع لا يتجاوز
    // `budget` أبداً. ولا ملخص عاماً يُحشى إن لم يطابق شيء: لا أسعار حكومية
    // في سياق قسمٍ لا يتعلق بجهة حكومية.
    const head = open.map((g) => g.text).join("\n\n").slice(0, budget);
    const left = budget - head.length - 2;
    const rest = left >= 200 ? pickPlain(query, left, false) : "";
    return rest ? `${rest}\n\n${head}` : head;
  }

  const index = SECTIONS
    .map((s) => s.title.replace(/^#+\s*/, ""))
    .filter((t) => t && t.length < 70)
    .join(" · ")
    .slice(0, 1800);

  return { pick, index, sections: SECTIONS.length, gated: GATED.map((g) => g.gate) };
}

const MAIN = makePicker(RAW);

/**
 * @param {string} query
 * @param {number} [budget]
 * @param {{door?: string}} [opts] مثلاً `{ door: "bizdev" }` من الخادم لباب تطوير الأعمال
 */
export function pickKnowledge(query, budget = 9000, opts = {}) {
  return MAIN.pick(query, budget, opts);
}

/** فهرس أسماء الجهات — سطرٌ واحد يخبر المساعد بما تغطّيه القاعدة كلها. */
export const KNOWLEDGE_INDEX = MAIN.index;

export const KNOWLEDGE_FULL_CHARS = String(RAW).length;
