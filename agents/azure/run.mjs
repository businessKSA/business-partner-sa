#!/usr/bin/env node
// تشغيل باهر برسالة واحدة وطباعة رده.
//
//   node agents/azure/run.mjs "تابع العميل فلان، رقمه 9665xxxxxxx، يبغى تأسيس شركة"
//   node agents/azure/run.mjs --agent mazen "راجع طلبات اليوم"
//   AGENTS_DRY_RUN=1 LOCAL_DB=1 node agents/azure/run.mjs "..."   ← بلا مساس بعميل
//
// يقرأ agents/.env إن وُجد، فالتشغيل المحلي لا يحتاج تصدير متغيّرات يدوياً.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
for (const f of [".env", "ids.env"]) {
  const p = join(here, "..", f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const { ENGINE_READY, engineWhyNot, ENGINE_INFO } = await import("./engine.mjs");
const { runCoordinator, runSpecialist, SPECIALISTS } = await import("./team.mjs");

const argv = process.argv.slice(2);
let agent = "baher";
const i = argv.indexOf("--agent");
if (i >= 0) { agent = argv[i + 1] || "baher"; argv.splice(i, 2); }
const message = argv.join(" ").trim();

if (!message) {
  console.error(`اكتب الرسالة:\n  node agents/azure/run.mjs "..."\n  node agents/azure/run.mjs --agent <${Object.keys(SPECIALISTS).join("|")}> "..."`);
  process.exit(1);
}
if (!ENGINE_READY) {
  console.error(engineWhyNot());
  process.exit(2);
}
const engineLabel = [
  ENGINE_INFO.azure ? `Azure:${ENGINE_INFO.azure.deployment}` : null,
  ENGINE_INFO.ollama ? `Ollama:${ENGINE_INFO.ollama.model}` : null,
].filter(Boolean).join(" ← ");

const t0 = Date.now();
console.error(`▸ ${agent} — ${engineLabel}`);

try {
  const out = agent === "baher"
    ? await runCoordinator(message, { onStep: (kind, a, b) => console.error(`  · ${kind}: ${a}${kind === "delegate" ? ` — ${String(b).slice(0, 80)}…` : ""}`) })
    : await runSpecialist(agent, message, { onStep: (n) => console.error(`  · ${n}`) });

  console.log("\n" + out.text.trim() + "\n");
  console.error(`▸ ${((Date.now() - t0) / 1000).toFixed(1)}s${out.truncated ? " — بلغ حدّ الخطوات" : ""}`);
  process.exitCode = out.truncated ? 1 : 0;
} catch (e) {
  console.error(`✗ ${String(e.message || e)}`);
  process.exitCode = 3;
}
