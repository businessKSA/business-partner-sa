#!/usr/bin/env node
// نقطة دخول المهام المجدولة على Azure Container Apps Jobs.
//
// كل مهمة تكليفٌ ثابت لباهر، معرّفةٌ هنا لا في لوحة — فتُراجَع في git وتُشغَّل
// محلياً بحرف واحد قبل أن تُجدوَل. هذا ما كان مفقوداً حين كانت الجولات في n8n.
//
//   node agents/azure/job.mjs morning
//   AGENTS_DRY_RUN=1 LOCAL_DB=1 node agents/azure/job.mjs morning   ← بروفة

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const envFile = join(here, "..", ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const OWNER = process.env.OWNER_WHATSAPP || "";

export const JOBS = {
  morning: {
    label: "الجولة الصباحية لمتابعة العملاء",
    cron: "0 3 * * *",           // ٠٦:٠٠ الرياض = ٠٣:٠٠ UTC
    prompt: `جولة الصباح.
كلّف مازن بمتابعة كل طلب لم يُحدَّث خلال ٤٨ ساعة (استعمل requests_list بـstale_hours=48)، ويسجّل كل متابعة بـrequest_note.
وكلّف بدر بمراجعة الطلبات في حالة REVIEWING التي اكتملت معلوماتها، وتجهيز مسودات عروض من الكتالوج الرسمي وحده — وكل سعر نهائي يُسجَّل بـpending_approval لا يُرسل.
ثم سلّم خلاصة واحدة: من تُوبع، ما العروض المقترحة، وما ينتظر قرار المالك اليوم.${OWNER ? `\nوأرسل الخلاصة للمالك على واتساب ${OWNER}.` : ""}`,
  },
  "site-check": {
    label: "فحص الموقع اليومي",
    cron: "0 5 * * *",           // ٠٨:٠٠ الرياض
    prompt: `كلّف محمد بفحص www.businesspartner.sa: الصفحات الرئيسية، النماذج، ومسارات api/ الحيّة.
أي عطل يُبلَّغ بوصف قابل للتنفيذ (الصفحة، ما حدث، ما كان متوقعاً). لا تعديل مباشر — أي إصلاح يكون Pull Request.
سلّم خلاصة قصيرة: ما فُحص، ما وُجد، وما يحتاج قراراً.`,
  },
  "weekly-content": {
    label: "محتوى الأسبوع",
    cron: "0 6 * * 0",           // الأحد ٠٩:٠٠ الرياض
    prompt: `كلّف فرح بخطة محتوى الأسبوع: ثلاثة موضوعات من خدمات الكتالوج الأكثر طلباً هذا الشهر (استعمل requests_list لمعرفتها)، لكل موضوع عنوان ونقاط ومنصّة مقترحة.
لا أسعار في المحتوى العام. سلّم الخطة في خلاصة واحدة.`,
  },
};

const name = (process.argv[2] || process.env.BP_JOB || "").trim();
const job = JOBS[name];
if (!job) {
  console.error(`مهمة غير معروفة: «${name}». المتاح: ${Object.keys(JOBS).join("، ")}`);
  process.exit(1);
}

const { ENGINE_READY, engineWhyNot } = await import("./engine.mjs");
if (!ENGINE_READY) { console.error(`المحرّك غير مهيّأ — ${engineWhyNot()}`); process.exit(2); }

const { runCoordinator } = await import("./team.mjs");
const t0 = Date.now();
console.log(`▸ ${job.label} — ${new Date().toISOString()}`);

try {
  const out = await runCoordinator(job.prompt, { onStep: (k, a) => console.log(`  · ${k}: ${a}`) });
  console.log("\n" + out.text.trim());
  console.log(`\n▸ ${((Date.now() - t0) / 1000).toFixed(1)}s — ${out.trace.length} خطوة${out.truncated ? " — بلغ الحدّ" : ""}`);
  // فشل المهمة يجب أن يظهر في سجلّ Azure لا أن يمرّ صامتاً بصفر.
  process.exitCode = out.truncated ? 1 : 0;
} catch (e) {
  console.error(`✗ ${String(e.message || e)}`);
  process.exitCode = 3;
}
