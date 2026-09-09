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
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW = JSON.parse(readFileSync(join(__dirname, "knowledge.json"), "utf8"));

// ‏القسم يبدأ بسطر `## `. أول جزء قبل أول `##` مقدّمةٌ تُلحق بما بعدها.
const SECTIONS = String(RAW)
  .split(/(?=^## )/m)
  .map((body) => ({ title: (body.split("\n")[0] || "").trim(), body }))
  .filter((s) => s.body.trim().length > 40);

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
 * ‏أقسام قاعدة المعرفة التي تخصّ نص العميل، في حدود ميزانية حروف.
 * حين لا يطابق شيء تُعاد الأقسام الأولى — وهي الملخص العام — كي لا يجيب
 * المساعد من فراغ.
 * @param {string} query  آخر ما كتبه العميل (أو دوراه الأخيران)
 * @param {number} budget أقصى عدد حروف
 */
export function pickKnowledge(query, budget = 9000) {
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
  if (!chosen.length) {
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

/** فهرس أسماء الجهات — سطرٌ واحد يخبر المساعد بما تغطّيه القاعدة كلها. */
export const KNOWLEDGE_INDEX = SECTIONS
  .map((s) => s.title.replace(/^#+\s*/, ""))
  .filter((t) => t && t.length < 70)
  .join(" · ")
  .slice(0, 1800);

export const KNOWLEDGE_FULL_CHARS = String(RAW).length;
