// Business Partner — يحمّل متغيّرات البيئة من ملف .env إلى Azure Container App.
//
// الأسرار تذهب إلى «secrets» التطبيق وتُربط بمتغيّر بيئة (secretref)، وما سواها يصير متغيّر بيئة عادياً.
// القيم لا تُطبع ولا تُسجَّل: يُطبع الاسم فقط. شغّله من Azure Cloud Shell بعد رفع الملف، ثم احذف الملف.
//
//   node load-env.mjs --file ~/vercel.env [--file ~/missing.env] --app bp-site-staging --rg rg-bp-web [--staging-safe] [--dry-run] [--write-missing ~/missing.env]
//
// --file          يتكرر: الملف الأخير يغلب (للقيم التي يخرجها Vercel كـ[SENSITIVE] فتُكتب في ملف ثانٍ).
// --write-missing يكتب قالباً بأسماء ما ينقص (NAME=) لتملأه يدوياً ثم تمرّره كـ--file ثانٍ.

// --staging-safe  يضبط أوضاع التشغيل على الاختبار (دفع تجريبي، تمارا رمليّة، واتساب مُحاكى، بريد معاينة، عقد اختبار)
//                 فلا يخرج من بيئة الاختبار دفعٌ حقيقي ولا رسالة لعميل. بيانات Notion وقاعدة البيانات تبقى الحقيقية.
// --dry-run       يعرض الأسماء وتصنيفها ولا يغيّر شيئاً.
//
// يتجاهل: متغيّرات Vercel (VERCEL_*) وNX_* وTURBO_* وNODE_ENV وPORT وAPP_ENV وLOCAL_* والقيم الفارغة.
// ملاحظة: متغيّرات Vercel المعلَّمة Sensitive لا يصدّرها `vercel env pull` (تأتي فارغة)؛ يُطبع اسمها ضمن «ناقصة».

import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { isSecret } from "./env-scan.mjs";

const args = process.argv.slice(2);
const opt = (n, d = "") => { const i = args.indexOf(n); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : d; };
const flag = (n) => args.includes(n);
const home = (p) => p.replace(/^~(?=\/)/, process.env.HOME || "~");
const FILES = args.flatMap((a, i) => (a === "--file" && args[i + 1] ? [home(args[i + 1])] : []));
const FILE = FILES[0] || "";
const MISSING_OUT = opt("--write-missing") ? home(opt("--write-missing")) : "";
const APP = opt("--app");
const RG = opt("--rg");
const DRY = flag("--dry-run");
const STAGING_SAFE = flag("--staging-safe");

if (!FILE || !APP || !RG) {
  console.error("الاستعمال: node load-env.mjs --file <env> --app <containerapp> --rg <resource-group> [--staging-safe] [--dry-run]");
  process.exit(2);
}

const SKIP = /^(VERCEL|NX_|TURBO_|NODE_ENV$|PORT$|APP_ENV$|LOCAL_|__)/;

export function parseEnv(text) {
  const out = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) v = v.slice(1, -1).replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    else if (v.startsWith("'") && v.endsWith("'") && v.length >= 2) v = v.slice(1, -1);
    out.set(m[1], v);
  }
  return out;
}

// اسم السرّ في Container Apps: أحرف صغيرة وأرقام وشرطات فقط.
export const secretName = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 250) || "s";

const SAFE_MODES = {
  PAYMENTS_MODE: "test", MOYASAR_MODE: "test", TAMARA_MODE: "sandbox",
  WHATSAPP_MODE: "mock", EMAIL_MODE: "preview", CONTRACT_MODE: "test", CALENDAR_MODE: "test",
};

function az(argv) {
  return execFileSync("az", argv, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", maxBuffer: 1 << 26 });
}
function chunks(a, n) { const r = []; for (let i = 0; i < a.length; i += n) r.push(a.slice(i, i + n)); return r; }

// Vercel يكتب [SENSITIVE] بدل قيمة المتغيّرات المعلَّمة Sensitive؛ لا تُعدّ قيمة أبداً.
const PLACEHOLDER = /^\[SENSITIVE\]$/i;
const env = new Map();
for (const f of FILES) for (const [k, v] of parseEnv(fs.readFileSync(f, "utf8"))) {
  if (v === "" || PLACEHOLDER.test(v)) { if (!env.has(k)) env.set(k, ""); continue; }
  env.set(k, v);
}
const secrets = [], plain = [], skipped = [], empty = [];
for (const [k, v] of env) {
  if (SKIP.test(k)) { skipped.push(k); continue; }
  if (v === "") { empty.push(k); continue; }
  (isSecret(k) ? secrets : plain).push([k, v]);
}
if (STAGING_SAFE) for (const [k, v] of Object.entries(SAFE_MODES)) {
  const i = plain.findIndex(([n]) => n === k);
  if (i >= 0) plain[i] = [k, v]; else plain.push([k, v]);
}
const seenNames = new Set();
for (const [k] of secrets) {
  const s = secretName(k);
  if (seenNames.has(s)) { console.error(`تعارض في اسم السرّ: ${k} → ${s}`); process.exit(1); }
  seenNames.add(s);
}

console.log(`الملف: ${env.size} متغيّراً · أسرار ${secrets.length} · عادية ${plain.length} · متجاهَلة ${skipped.length} · فارغة ${empty.length}`);
console.log("أسرار:", secrets.map(([k]) => k).join(", ") || "-");
console.log("عادية:", plain.map(([k]) => k).join(", ") || "-");
if (empty.length) console.log(`ناقصة (${empty.length}) — فارغة أو [SENSITIVE] في الملف؛ أضفها يدوياً:`, empty.join(", "));
if (MISSING_OUT && empty.length) { fs.writeFileSync(MISSING_OUT, empty.map((k) => `${k}=`).join("\n") + "\n", { mode: 0o600 }); console.log(`كُتب قالب بأسماء الناقص في ${MISSING_OUT} (أسماء فقط، املأ القيم ثم مرّره كـ--file ثانٍ)`); }
if (DRY) { console.log("\n(dry-run) لم يتغيّر شيء."); process.exit(0); }

try { az(["containerapp", "show", "-g", RG, "-n", APP, "--query", "name", "-o", "tsv"]); }
catch (e) { console.error("لا أجد التطبيق أو لا صلاحية:", String(e.stderr || e.message).split("\n")[0]); process.exit(1); }

for (const part of chunks(secrets, 15)) {
  az(["containerapp", "secret", "set", "-g", RG, "-n", APP, "--secrets", ...part.map(([k, v]) => `${secretName(k)}=${v}`), "-o", "none"]);
  console.log(`سرّ ✓ ${part.map(([k]) => k).join(", ")}`);
}
const vars = [...secrets.map(([k]) => `${k}=secretref:${secretName(k)}`), ...plain.map(([k, v]) => `${k}=${v}`)];
for (const part of chunks(vars, 60)) {
  az(["containerapp", "update", "-g", RG, "-n", APP, "--set-env-vars", ...part, "-o", "none"]);
  console.log(`متغيّرات ✓ (${part.length})`);
}
console.log("\nانتهى. تذكّر حذف ملف .env من Cloud Shell: rm -f " + FILE);
