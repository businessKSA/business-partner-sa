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

const ROOT = path.resolve("site");
const SCRIPT_RE = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

const seen = new Map();   // بصمة المحتوى → أول صفحة ظهر فيها
const broken = [];
let pages = 0, blocks = 0;

for (const file of walk(ROOT)) {
  if (!file.endsWith(".html")) continue;
  pages++;
  const html = fs.readFileSync(file, "utf8");
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
console.log(`حارس الصفحات OK — ${pages} صفحة، ${blocks} سكربتاً فريداً.`);
