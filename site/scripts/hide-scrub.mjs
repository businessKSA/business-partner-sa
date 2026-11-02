// Business Partner — شبكة الأمان الأخيرة للإخفاء المركزي (site/data/hidden.json).
//
// يمرّ على كل صفحةٍ مبنيّة بعد آخر سكربتٍ يحقن HTML، ويحذف أي <a> يشير إلى
// صفحةٍ أو خدمةٍ مخفية. المصدر الأول للإخفاء هو المولّدات نفسها (nav.json
// وfooter.json والبطاقات المشروطة بـ`pageVisible`)؛ هذا يمسك ما كُتب حرفياً في
// سكربتات ما بعد التوليد (b10x-services-catalog-v2 وغيره) وما سيُكتب لاحقاً —
// فإضافة اسمٍ إلى hidden.json تكفي حتى لو نسي مولّدٌ أن يشرط رابطه.
//
// لا يلمس <script> ولا <style> ولا assets/ (اللوحات المكتوبة يدوياً:
// Revenue OS وغيره). وبلا hidden.json (فارغ) لا يفعل شيئاً.
import fs from "node:fs";
import path from "node:path";
import { stripHiddenLinks, hasHidden, hiddenPageNames } from "./hidden.mjs";

const ROOT = path.resolve("site");
const SKIP_DIRS = new Set(["assets", "scripts", "data", "_astro"]);

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) yield* walk(path.join(dir, e.name)); }
    else if (e.name.endsWith(".html")) yield path.join(dir, e.name);
  }
}

const BLOCK_RE = /(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>)/gi;

let files = 0, links = 0, moved = 0;
if (hasHidden()) {
  for (const file of walk(ROOT)) {
    const html = fs.readFileSync(file, "utf8");
    let removed = 0;
    const out = html.split(BLOCK_RE).map((seg, i) => {
      if (i % 2 === 1) return seg; // script/style كما هو
      const r = stripHiddenLinks(seg);
      removed += r.removed + r.rewritten;
      moved += r.rewritten;
      return r.html;
    }).join("");
    if (removed) { fs.writeFileSync(file, out); files++; links += removed; }
  }
}

// الصفحات المخفية والمنقولة (hidden.json: pages + moved) تُولَّد أثناء البناء لأن
// سكربتات لاحقة تقرأها (b10x-package-page يشتق b10x.html من ai-agents.html،
// وclient-portal-v6 وdoc-agent-portal-v7 يرقّعان account.html)، ثم تُحذف هنا في
// آخر السلسلة فلا يبقى منها ملف في site/ ولا يصل نشرةً. دالة بنائها في
// generate.mjs باقية: حذف الاسم من hidden.json ثم البناء يعيدها.
const LANG_DIRS = ["ar", "en", "es", "fr", "hi", "ja", "ko", "ru", "zh"];
let pruned = 0;
for (const name of hiddenPageNames()) {
  for (const dir of ["", ...LANG_DIRS]) {
    const file = path.join(ROOT, dir, name + ".html");
    if (fs.existsSync(file)) { fs.unlinkSync(file); pruned++; }
  }
}
console.log(`hide-scrub: ${links} رابطاً مخفياً حُذف أو أُعيدت كتابته (${moved} منها إلى بديلها) في ${files} صفحة؛ ${pruned} ملف صفحة مخفية حُذف (الباقي أُسقط عند التوليد).`);
