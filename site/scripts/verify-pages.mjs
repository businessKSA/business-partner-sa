// حارس الصفحات: كل سكربت داخل صفحة مبنيّة يجب أن يُحلَّل نحوياً.
//
// وُجد هذا الحارس بعد عطل وصل الإنتاج: سطرٌ في بوابة العميل كُتب داخل قالب
// نصّي وفيه `\/`، والقالب يلتهم الشرطة المائلة العكسية عند البناء، فخرج إلى
// الصفحة `/^/[^/]/` — خطأ نحوي. الخطأ النحوي لا يُسقط سطره وحده: يُسقط
// السكربت كله، فتُفتح بوابة العميل على ترويسة وتذييل بلا شيء بينهما. البناء
// كان ينجح، والصفحة تُنشر، ولا شيء يقول إن اللوحة ماتت.
//
// الحارس رخيص: يُلغم الصفحات، ويجمع السكربتات المتكرّرة ببصمة محتواها (ألف
// صفحة تشترك في السكربت نفسه = تحليلٌ واحد)، ويُسقط البناء عند أول كسر —
// فتبقى النشرة السابقة السليمة حيّة. عطلٌ في البناء بدل عطلٍ في الإنتاج.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import vm from "node:vm";
import { hasHidden, hiddenPageNames, isHiddenHref } from "./hidden.mjs";

const ROOT = path.resolve("site");
const SCRIPT_RE = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

// الإخفاء المركزي (site/data/hidden.json): لا ملف لصفحةٍ مخفية/منقولة، ولا <a>
// واحد إليها — وإلا صار رابطاً ميتاً أو يقود إلى صفحةٍ أُوقفت (مثل /account).
const LANG_DIRS = ["", "ar", "en", "es", "fr", "hi", "ja", "ko", "ru", "zh"];
const A_HREF = /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const BLOCKS = /<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi;
const SKIP_LEAK = new Set(["assets", "scripts", "data", "_astro"]);
const hiddenLeaks = [];   // رابط يقود إلى صفحةٍ مخفية
const hiddenFiles = [];   // ملف صفحةٍ مخفية نجا من الحذف
if (hasHidden()) {
  for (const name of hiddenPageNames()) for (const d of LANG_DIRS) {
    const f = path.join(ROOT, d, name + ".html");
    if (fs.existsSync(f)) hiddenFiles.push(path.relative(ROOT, f));
  }
}

const seen = new Map();   // بصمة المحتوى → أول صفحة ظهر فيها
const broken = [];
let pages = 0, blocks = 0;

for (const file of walk(ROOT)) {
  if (!file.endsWith(".html")) continue;
  pages++;
  const html = fs.readFileSync(file, "utf8");
  // اللوحات المكتوبة يدوياً (assets/data) وسكربتات البناء خارج نطاق الروابط: روابطها
  // القديمة (/account…) يغطّيها تحويل vercel.json بمعاملاتها.
  if (hasHidden() && !SKIP_LEAK.has(path.relative(ROOT, file).split(path.sep)[0])) {
    const bare = html.replace(BLOCKS, "");
    A_HREF.lastIndex = 0;
    for (let a; (a = A_HREF.exec(bare));) {
      const h = a[1] != null ? a[1] : a[2];
      if (isHiddenHref(h)) hiddenLeaks.push(path.relative(ROOT, file) + " → " + h);
    }
  }
  let m;
  SCRIPT_RE.lastIndex = 0;
  while ((m = SCRIPT_RE.exec(html))) {
    const attrs = m[1] || "";
    const src = m[2];
    // نوع غير جافاسكربت (application/ld+json مثلاً) ليس شأن هذا الحارس.
    if (/\btype\s*=\s*["']?(?!text\/javascript|module|application\/javascript)/i.test(attrs)) continue;
    if (!src.trim()) continue;
    const key = crypto.createHash("sha1").update(src).digest("hex");
    if (seen.has(key)) continue;
    seen.set(key, file);
    blocks++;
    try {
      new vm.Script(src, { filename: path.relative(ROOT, file) });
    } catch (e) {
      broken.push({ file: path.relative(ROOT, file), message: String(e.message).slice(0, 160) });
    }
  }
}

if (broken.length) {
  console.error(`حارس الصفحات: ${broken.length} سكربت لا يُحلَّل — النشر متوقّف.`);
  for (const b of broken.slice(0, 10)) console.error(`  ${b.file}: ${b.message}`);
  process.exit(1);
}
if (hiddenFiles.length || hiddenLeaks.length) {
  console.error(`حارس الإخفاء: ${hiddenFiles.length} ملف صفحةٍ مخفية باقٍ، و${hiddenLeaks.length} رابطٌ إلى صفحةٍ مخفية — النشر متوقّف.`);
  for (const x of hiddenFiles.slice(0, 5)) console.error("  ملف: " + x);
  for (const x of hiddenLeaks.slice(0, 10)) console.error("  رابط: " + x);
  process.exit(1);
}
console.log(`حارس الصفحات OK — ${pages} صفحة، ${blocks} سكربتاً فريداً.`);
