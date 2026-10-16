// دليل القطع (docs/azure-cutover-runbook-2026-10-16.md) لا يجوز أن ينحرف عن الأدوات التي يستدعيها:
// كل ملف مذكور موجود، كل علم/متغيّر مذكور يقرؤه الكود فعلاً، لا أسرار في النص، وفحوص الصحة داخل حدود Container Apps.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const runbook = read("docs/azure-cutover-runbook-2026-10-16.md");
const azureSources = fs.readdirSync(path.join(ROOT, "ops/azure")).filter((f) => /\.(mjs|sh|yaml)$/.test(f)).map((f) => read(`ops/azure/${f}`)).join("\n");

test("the seven parts (أ–ز) and the one-page cutover sequence are all there", () => {
  for (const h of ["## (أ)", "## (ب)", "## (ج)", "## (د)", "## (هـ)", "## (و)", "## (ز)", "## (ح)"]) assert.ok(runbook.includes(h), h);
});

test("every ops/azure/… and db/… file the runbook names exists", () => {
  const files = new Set([...runbook.matchAll(/\b((?:ops\/azure|db|docs|quotes)\/[A-Za-z0-9._\/-]+\.(?:mjs|sh|yaml|sql|md))/g)].map((m) => m[1]));
  assert.ok(files.size >= 8);
  for (const f of files) assert.ok(fs.existsSync(path.join(ROOT, f)), `الدليل يذكر ${f} وهو غير موجود`);
});

test("every BP_* / NODE_OPTIONS setting the runbook tells you to set is read by the server, the tools or the jobs", () => {
  const names = new Set([...runbook.matchAll(/\b(BP_[A-Z_]+)\b/g)].map((m) => m[1]));
  const known = new Set([...azureSources.matchAll(/\b(BP_[A-Z_]+)\b/g)].map((m) => m[1]));
  for (const n of names) assert.ok(known.has(n), `${n} مذكور في الدليل ولا يقرؤه أي كود في ops/azure`);
  for (const must of ["BP_ORIGIN_MAP", "BP_BLOCK_VERCEL_ORIGINS", "BP_FRONT_DOOR_ID", "BP_TRUSTED_PROXY_HOPS", "BP_READ_ONLY", "BP_MAIL_BRIDGE", "BP_CANONICAL_HOST", "BP_APEX_HOSTS"]) assert.ok(names.has(must), must);
});

test("migrate-db flags used in the runbook exist in the tool, and the tool's own usage lists them", () => {
  const tool = read("ops/azure/migrate-db.mjs");
  const used = new Set([...runbook.matchAll(/migrate-db\.mjs[^\n]*?(--[a-z-]+)/g)].map((m) => m[1]));
  for (const f of ["--dry-run", "--verify", "--clean", "--skip-missing", "--replace-nopk"]) assert.ok(tool.includes(`"${f}"`), `${f} غير مدعوم في الأداة`);
  for (const f of used) assert.ok(tool.includes(`"${f}"`), `${f} مذكور في الدليل وغير مدعوم`);
});

test("the cron job names the runbook mentions are the ones cron.mjs derives from vercel.json", async () => {
  const { cronJobs } = await import("../ops/azure/cron.mjs");
  const names = cronJobs(JSON.parse(read("vercel.json"))).map((j) => j.name);
  assert.equal(names.length, 3);
  for (const n of names) assert.ok(runbook.includes(n), `${n} غائب عن الدليل`);
  assert.ok(names.every((n) => n.length < 32), "حدّ Container Apps: أقل من ٣٢ حرفاً");
});

test("no secret-looking material in the runbook, the scripts or the probe files", () => {
  const text = runbook + "\n" + azureSources;
  for (const re of [/AccountKey=/i, /accesskey=[A-Za-z0-9+\/=]{20,}/i, /sig=[A-Za-z0-9%]{20,}/, /postgres:\/\/[^\s:@<$"]+:[^\s@<$"]{6,}@/, /eyJ[A-Za-z0-9_-]{20,}\./, /sk_(live|test)_/, /-----BEGIN/]) {
    assert.doesNotMatch(text, re, String(re));
  }
});

test("health probes: paths match the real endpoints, thresholds are within Container Apps' 1–10 / 1–60 limits", () => {
  for (const [file, probePath, name] of [["ops/azure/probes.site.yaml", "/__health", "bp-site"], ["ops/azure/probes.quotes.yaml", "/quotes/api/health", "bp-quotes"]]) {
    const y = read(file);
    assert.match(y, new RegExp(`- name: ${name}\\b`));
    assert.equal([...y.matchAll(/path: (\S+)/g)].length, 3);
    for (const m of y.matchAll(/path: (\S+)/g)) assert.equal(m[1], probePath);
    for (const m of y.matchAll(/port: (\d+)/g)) assert.equal(m[1], "8080");
    for (const m of y.matchAll(/failureThreshold: (\d+)/g)) assert.ok(Number(m[1]) >= 1 && Number(m[1]) <= 10);
    for (const m of y.matchAll(/initialDelaySeconds: (\d+)/g)) assert.ok(Number(m[1]) >= 1 && Number(m[1]) <= 60);
    for (const t of ["Startup", "Liveness", "Readiness"]) assert.ok(y.includes(`type: ${t}`), t);
  }
  assert.ok(fs.existsSync(path.join(ROOT, "quotes/src/app/api/health/route.ts")), "نقطة صحة اللوحة موجودة");
});

test("Dockerfile.quotes: copies only quotes/, runs next on 8080, no secrets baked in, and its dockerignore sits next to it", () => {
  const d = read("ops/azure/Dockerfile.quotes");
  assert.match(d, /COPY quotes\/package\.json quotes\/package-lock\.json/);
  assert.match(d, /PORT=8080/);
  assert.match(d, /CMD \["node_modules\/\.bin\/next", "start", "-p", "8080"/);
  assert.match(d, /INTERNAL_URL=http:\/\/127\.0\.0\.1:8080\/quotes/);
  assert.match(d, /USER node/);
  assert.doesNotMatch(d, /DATABASE_URL\s*=\s*\S+/, "لا قيمة قاعدة بيانات داخل الصورة");
  assert.ok(fs.existsSync(path.join(ROOT, "ops/azure/Dockerfile.quotes.dockerignore")));
});

test("alerts.sh names real metrics and is valid bash", async () => {
  const { spawnSync } = await import("node:child_process");
  assert.equal(spawnSync("bash", ["-n", path.join(ROOT, "ops/azure/alerts.sh")]).status, 0);
  const a = read("ops/azure/alerts.sh");
  for (const metric of ["Percentage5XX", "OriginHealthPercentage", "Requests", "Replicas", "MemoryPercentage", "RestartCount"]) assert.ok(a.includes(metric), metric);
  assert.match(a, /statusCodeCategory includes 5xx/);
});
