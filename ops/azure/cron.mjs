// Business Partner — المهام المجدولة على Azure (بديل `crons` في vercel.json).
//
// Vercel Cron كان يستدعي مساراً في الموقع بترويسة `Authorization: Bearer $CRON_SECRET`.
// على Azure تُنشأ «Container Apps Job» لكل مهمة بالصورة نفسها (لا صورة ثانية)، وأمرها:
//
//     node ops/azure/cron.mjs <رقم المهمة>
//
// فيقرأ جدول vercel.json نفسه (مصدر واحد) ويستدعي المسار نفسه بالترويسة نفسها،
// فلا يتغيّر سطرٌ في api/. الجدولة (UTC) تؤخذ من vercel.json أيضاً.
//
//     node ops/azure/cron.mjs --list            جدول المهام كما سيُنشأ في Azure
//     node ops/azure/cron.mjs --list --json     للقراءة الآلية
//     node ops/azure/cron.mjs 1 --dry-run       يطبع ما سيستدعيه ولا يستدعي
//
// متغيّرات البيئة:  CRON_SECRET (سرّ، إلزامي عند التشغيل الفعلي)
//                   BP_CRON_BASE  (افتراضياً https://www.businesspartner.sa)
//                   BP_CRON_TIMEOUT_S (افتراضياً 120)
//
// تنبيه تشغيلي: مجدوِلٌ واحد فقط يجب أن يعمل. إن بقي Vercel Cron يعمل مع مهام Azure
// أُرسلت النشرة الأسبوعية مرتين. ترتيب القطع في docs/azure-migration-2026-10-11.md §8.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export function slugOf(cronPath) {
  const u = new URL(cronPath, "http://x");
  const base = u.pathname.replace(/^\/api\//, "").replace(/[^a-z0-9]+/gi, "-");
  const route = u.searchParams.get("__route") || u.searchParams.get("action") || "";
  return (route && !base.includes(route) ? `${base}-${route}` : base).replace(/^-|-$/g, "").toLowerCase();
}

export function cronJobs(vercelJson) {
  return (vercelJson.crons || []).map((c, index) => ({
    index, name: `bp-cron-${index}-${slugOf(c.path)}`, schedule: c.schedule, path: c.path,
  }));
}

export async function runCron(job, { base, secret, timeoutS = 120, fetchImpl = fetch }) {
  const url = new URL(job.path, base).href;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutS * 1000);
  try {
    const r = await fetchImpl(url, {
      method: "GET",
      headers: { authorization: `Bearer ${secret}`, "user-agent": "bp-azure-cron/1.0" },
      signal: ctrl.signal,
      redirect: "manual",
    });
    return { ok: r.status >= 200 && r.status < 300, status: r.status };
  } finally { clearTimeout(t); }
}

async function main(argv) {
  const vercelJson = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  const jobs = cronJobs(vercelJson);
  const args = argv.slice(2);
  if (args.includes("--list")) {
    if (args.includes("--json")) console.log(JSON.stringify(jobs, null, 2));
    else for (const j of jobs) console.log(`${j.index}  ${j.schedule.padEnd(12)} ${j.name.padEnd(36)} ${j.path}`);
    return 0;
  }
  const which = args.find((a) => /^\d+$/.test(a));
  const job = jobs[Number(which)];
  if (which === undefined || !job) {
    console.error(`استعمال: node ops/azure/cron.mjs <0..${jobs.length - 1}> | --list`);
    return 2;
  }
  const base = process.env.BP_CRON_BASE || "https://www.businesspartner.sa";
  if (args.includes("--dry-run")) { console.log(`GET ${new URL(job.path, base).href}  (UTC ${job.schedule})`); return 0; }
  const secret = process.env.CRON_SECRET || "";
  if (!secret) { console.error("CRON_SECRET غير مضبوط — لا يُستدعى شيء."); return 2; }
  const r = await runCron(job, { base, secret, timeoutS: Number(process.env.BP_CRON_TIMEOUT_S) || 120 });
  console.log(`${job.name} → HTTP ${r.status}`);
  return r.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv).then((c) => process.exit(c), (e) => { console.error(String(e && e.message || e)); process.exit(1); });
}
