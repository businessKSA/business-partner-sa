// حارس الـAPI — يُشغَّل أول خطوة في npm run build.
//
// في يومين سقط /api كله ثلاث مرات لنفس السبب البنيوي: جلسات متوازية تدمج
// في فرع إنتاج واحد، فيُبقي الدمج نسختين من دالة أو يُسقط صادراً، ولا يظهر
// شيء حتى ينهار تحميل الوحدة على Vercel — بعد النشر، على موقع حيّ، وبـ500
// على كل طلب لا على المسار المعطوب وحده.
//
// الفحوص هنا ساكنة تماماً: لا تستورد وحدة ولا تُنفّذ سطراً منها، فلا أثر
// جانبي في البناء. وفشلها يُسقط البناء، فتبقى النشرة السابقة السليمة حيّة —
// وهذا هو المكسب: عطلٌ في البناء بدل عطلٍ في الإنتاج.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const API = "api";
const files = fs.readdirSync(API).filter((f) => f.endsWith(".js")).sort();
const problems = [];

// (1) كل ملف يجب أن يُحلَّل نحوياً. هذا ما يمسك التعريف المكرّر: تكرار
// تعريف دالة في وحدة ES خطأ نحوي، لا تحذير.
for (const f of files) {
  try {
    execFileSync(process.execPath, ["--check", path.join(API, f)], { stdio: "pipe" });
  } catch (e) {
    const msg = String(e.stderr || e.message).split("\n").find((l) => /Error/.test(l)) || "خطأ نحوي";
    problems.push(`${API}/${f}: ${msg.trim()}`);
  }
}

// (2) كل اسم مستورد يجب أن يكون مُصدَّراً فعلاً من وحدته. فقدان صادر واحد
// يُسقط كل ما يستورده، وهو صنف العطل الذي تحذّر منه CLAUDE.md.
const exportsOf = new Map();
for (const f of files) {
  const src = fs.readFileSync(path.join(API, f), "utf8");
  const names = new Set();
  for (const m of src.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/gm)) names.add(m[1]);
  for (const m of src.matchAll(/^export\s+(?:const|let|var|class)\s+([A-Za-z0-9_$]+)/gm)) names.add(m[1]);
  for (const m of src.matchAll(/^export\s*\{([^}]+)\}/gm))
    for (const p of m[1].split(",")) { const n = p.trim().split(/\s+as\s+/).pop().trim(); if (n) names.add(n); }
  exportsOf.set("./" + f, names);
}
let importCount = 0;
for (const f of files) {
  const src = fs.readFileSync(path.join(API, f), "utf8");
  for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*["'](\.\/[^"']+)["']/g)) {
    const target = m[2];
    if (!exportsOf.has(target)) { problems.push(`${API}/${f}: يستورد من وحدة غير موجودة ${target}`); continue; }
    for (const raw of m[1].split(",")) {
      const want = raw.trim().split(/\s+as\s+/)[0].trim();
      if (!want) continue;
      importCount++;
      if (!exportsOf.get(target).has(want)) problems.push(`${API}/${f}: «${want}» غير مُصدَّر من ${target}`);
    }
  }
}

// (3) سقف Vercel: اثنتا عشرة دالة. الملفات المساعدة تبدأ بـ_ فلا تُحتسب.
const fns = files.filter((f) => !f.startsWith("_"));
if (fns.length > 12) problems.push(`api/ فيه ${fns.length} دالة والسقف ١٢ — ابدأ اسم المساعد بـ_`);

// (4) علامات تعارض ناجية من دمج — تمرّ صامتة في HTML وتكسر أي ملف كود.
for (const dir of ["api", "db", "site/scripts"]) {
  if (!fs.existsSync(dir)) continue;
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    return e.isDirectory() ? walk(p) : (/\.(js|mjs|sql|json)$/.test(e.name) ? [p] : []);
  });
  for (const p of walk(dir)) {
    if (/^<<<<<<< /m.test(fs.readFileSync(p, "utf8"))) problems.push(`${p}: علامات تعارض دمج لم تُحَل`);
  }
}

if (problems.length) {
  console.error("\n❌ حارس الـAPI أوقف البناء — هذا كان سيُسقط /api كله بـ500 بعد النشر:\n");
  for (const p of problems) console.error("   • " + p);
  console.error(`\n   ${problems.length} مشكلة. أصلحها قبل الدفع.\n`);
  process.exit(1);
}
console.log(`API guard OK — ${files.length} ملفاً، ${importCount} استيراداً مسمّى، ${fns.length}/12 دالة.`);
