// خطوة بناء: تبديل عنوان n8n في صفحات الموقع المُولَّدة — بلا متغيّر بيئة لا تفعل شيئاً.
//   BP_N8N_PUBLIC_BASE=https://bp-n8n.… npm run build
// سبب وجودها: 15 صفحة تنادي ويبهوكات n8n من المتصفح بعنوان Cloud مكتوب نصّاً
// (dashboard, portal, monitor, admin, الخدمات المشتركة…). عند تحويل مرحلة الويبهوك إلى
// Azure (docs/azure-n8n-handoff-2026-10-12.md §9) يُضبط المتغيّر في بيئة النشر فتتبدّل كلها
// في البناء نفسه، ويبقى المستودع على Cloud حتى يُحذف Cloud نهائياً.
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
const CLOUD = "https://businesspartnerai.app.n8n.cloud";
const target = String(process.env.BP_N8N_PUBLIC_BASE || "").replace(/\/+$/, "");
if (!target || target === CLOUD) { console.log("n8n-base: BP_N8N_PUBLIC_BASE غير مضبوط — الصفحات تبقى على Cloud"); process.exit(0); }
if (!/^https:\/\/[a-z0-9.-]+$/i.test(target)) { console.error("n8n-base: قيمة BP_N8N_PUBLIC_BASE ليست أصل https سليماً"); process.exit(1); }
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); if (f === "node_modules" || f.startsWith(".")) return []; return statSync(p).isDirectory() ? walk(p) : p.endsWith(".html") ? [p] : []; });
let files = 0, hits = 0;
for (const p of walk("site")) { const s = readFileSync(p, "utf8"); if (!s.includes(CLOUD)) continue; const n = s.split(CLOUD).length - 1; writeFileSync(p, s.split(CLOUD).join(target)); files++; hits += n; }
console.log(`n8n-base: بُدِّل عنوان n8n في ${files} صفحة (${hits} موضعاً) إلى ${target}`);
