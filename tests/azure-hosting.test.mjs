// ملفات الاستضافة على Azure لا تحمل أسراراً ولا تُشغِّل شيئاً من تلقاء نفسها:
// الـworkflow يدوي ومعطَّل بالافتراض بثلاث طبقات، والـDockerfile بلا جذر وبلا أسرار،
// وجرد المتغيّرات يرى المتغيّرات الأساسية، وmain build لم يُغيَّر.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanEnv, classify, isSecret } from "../ops/azure/env-scan.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

test("azure-deploy.yml is manual-only and inert until AZURE_DEPLOY_ENABLED=true", () => {
  const y = read(".github/workflows/azure-deploy.yml");
  const onBlock = /^on:\n((?:[ \t]+.*\n|\n)+)/m.exec(y)[1];
  assert.match(onBlock, /^\s{2}workflow_dispatch:/m);
  // استثناء مؤقت وموثَّق: push على فرع الاختبار azure-migration وحده (يُحذف بعد دمج الملف في master)
  if (onBlock.includes("push:")) assert.match(onBlock, /push:\n\s+branches: \[azure-migration\]\n/, "push مسموح على azure-migration وحده");
  for (const trigger of ["pull_request", "schedule:", "workflow_run", "release:", "repository_dispatch"]) {
    assert.ok(!onBlock.includes(trigger), `الـworkflow يحمل trigger تلقائياً: ${trigger}`);
  }
  const jobs = y.split(/^jobs:\n/m)[1].split(/^  (?=[a-z]+:\n)/m).filter(Boolean);
  assert.ok(jobs.length >= 4);
  for (const j of jobs) assert.match(j, /AZURE_DEPLOY_ENABLED == 'true'/, `مهمة بلا بوابة التفعيل:\n${j.slice(0, 60)}`);
  assert.match(y, /environment: \$\{\{ inputs\.target == 'production' && 'azure-production' \|\| 'staging' \}\}/, "النشر يمرّ ببيئة GitHub (موافقة المالك على azure-production)");
  assert.match(y, /id-token: write/);
});

test("azure-deploy.yml holds no secrets: OIDC only, every ${{ }} source is vars/inputs/needs/github", () => {
  const y = read(".github/workflows/azure-deploy.yml");
  assert.ok(!/secrets\./.test(y), "لا secrets.* — الدخول بـOIDC والقيم Variables عامة");
  for (const m of y.matchAll(/\$\{\{\s*([^}]+?)\s*\}\}/g)) {
    assert.match(m[1], /^(vars|inputs|needs|github|steps)\b/, `تعبير غير متوقّع: ${m[1]}`);
  }
  assert.ok(!/(AccountKey|SharedAccessSignature|client-secret|password\s*[:=]|sk_live|pk_live)/i.test(y));
  // `VERCEL: "1"` في خطوة البناء مقصود (يمنع hidden.mjs من إعادة كتابة vercel.json)؛ المحظور أي نداء إلى Vercel.
  assert.ok(!/(vercel\s+(deploy|pull|env|alias|promote|rollback|--prod)|api\.vercel\.com|VERCEL_TOKEN|VERCEL_ORG|VERCEL_PROJECT|amondnet\/vercel-action)/i.test(y.replace(/#.*$/gm, "")), "الـworkflow لا يلمس Vercel");
});

test("Dockerfile: non-root, no secrets as ARG/ENV, boots the Azure server, secrets/dev data excluded", () => {
  const d = read("ops/azure/Dockerfile");
  assert.match(d, /^USER node$/m);
  assert.match(d, /CMD \["node", "ops\/azure\/server\.mjs"\]/);
  for (const m of d.matchAll(/^\s*(?:ARG|ENV)\s+([A-Za-z0-9_]+)/gm)) {
    assert.ok(!/(KEY|SECRET|TOKEN|PASSWORD|PRIVATE|CONNECTION|_URL$)/i.test(m[1]) || m[1] === "PORTAL_URL", `سرّ محتمل في الصورة: ${m[1]}`);
  }
  assert.ok(!/COPY\s+(\.env|\.localdb)/.test(d));
  const ign = read("ops/azure/Dockerfile.dockerignore");
  for (const must of [".git", ".env", ".localdb", "node_modules", "docs", "tests", "quotes"]) assert.match(ign, new RegExp(`^${must.replace(".", "\\.")}$`, "m"), `${must} غير مستثنى`);
  assert.match(d, /ENV VERCEL=1/, "يمنع hidden.mjs من إعادة كتابة vercel.json داخل الصورة");
});

test("no live-looking credentials are committed under ops/azure or the workflow", () => {
  const files = ["ops/azure/server.mjs", "ops/azure/routing.mjs", "ops/azure/vercel-compat.mjs", "ops/azure/cron.mjs", "ops/azure/parity.mjs", "ops/azure/env-scan.mjs", "ops/azure/Dockerfile", ".github/workflows/azure-deploy.yml"];
  for (const f of files) {
    const t = read(f);
    assert.ok(!/(sk_live_|pk_live_|AccountKey=|-----BEGIN [A-Z ]*PRIVATE KEY|accesskey=[A-Za-z0-9+/=]{20,})/.test(t), `${f} يبدو أنه يحمل سراً`);
  }
});

test("the production server refuses development settings and never forces VERCEL_ENV in production", () => {
  const s = read("ops/azure/server.mjs");
  assert.match(s, /LOCAL_DB === "1"/);
  assert.match(s, /bpEnv === "production"/);
  assert.match(s, /cfg\.bpEnv === "preview" && !process\.env\.VERCEL_ENV/);
  assert.ok(!/process\.env\.VERCEL_ENV\s*=\s*["']production/.test(s));
});

test("package.json: Azure scripts added, the Vercel build chain untouched (API guard first, page guard last)", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts["azure:serve"], "node ops/azure/server.mjs");
  assert.ok(pkg.scripts["azure:parity"] && pkg.scripts["azure:cron"]);
  assert.match(pkg.scripts.build, /^node site\/scripts\/verify-api\.mjs && /);
  assert.match(pkg.scripts.build, / && node site\/scripts\/verify-pages\.mjs$/);
  assert.ok(!/azure/.test(pkg.scripts.build), "خطوات Azure ليست في سلسلة بناء الإنتاج على Vercel");
  assert.deepEqual(Object.keys(pkg.dependencies), ["pg"], "اعتماد الإنتاج الوحيد pg");
});

test("env inventory sees the variables the migration depends on, classified and flagged secret correctly", () => {
  const rows = scanEnv(ROOT);
  const by = Object.fromEntries(rows.map((r) => [r.name, r]));
  for (const must of ["MOYASAR_SECRET_KEY", "AZURE_PG_URL", "DB_DRIVER", "AZURE_OPENAI_KEY", "AZURE_STORAGE_KEY", "CRON_SECRET", "NOTION_TOKEN", "RESEND_API_KEY", "OTP_SECRET", "MKT_SITE_BASE", "VERCEL_ENV", "DAFTRA_API_KEY", "TAMARA_API_TOKEN", "DOCUSIGN_PRIVATE_KEY", "GOOGLE_CLIENT_ID", "SUPABASE_SERVICE_KEY"]) {
    assert.ok(by[must], `${must} لم يُلتقط في الجرد`);
  }
  assert.ok(rows.length > 150, `عدد المتغيّرات ${rows.length}`);
  for (const s of ["MOYASAR_SECRET_KEY", "AZURE_PG_URL", "CRON_SECRET", "OTP_SECRET", "DOCUSIGN_PRIVATE_KEY", "NOTION_TOKEN"]) assert.equal(by[s].secret, true, s);
  for (const n of ["GOOGLE_CLIENT_ID", "MOYASAR_PUBLISHABLE_KEY", "AZURE_PG_POOL_MAX", "DB_DRIVER", "MKT_SITE_BASE"]) assert.equal(by[n].secret, false, n);
  assert.equal(classify("MOYASAR_METHODS"), "Moyasar (الدفع)");
  assert.equal(classify("AZURE_PG_URL"), "Azure Database for PostgreSQL");
  assert.equal(classify("VERCEL_ENV"), "Vercel (يزول بالنقل)");
  assert.equal(isSecret("DOC_AGENT_SERVICE_CODES"), false);
  assert.ok(!rows.some((r) => /^(faq|how|popular|search|NODE_ENV)$/.test(r.name)), "ضجيج المسح استُبعد");
  assert.ok(rows.every((r) => !("value" in r)), "الجرد أسماء فقط");
});

// ---- الإقلاع الحقيقي كعملية منفصلة ------------------------------------------
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";

const freePort = () => new Promise((ok) => { const s = net.createServer().listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => ok(p)); }); });
const SERVER = path.join(ROOT, "ops/azure/server.mjs");

test("boot: production refuses LOCAL_DB=1 / APP_ENV=development and exits non-zero before listening", () => {
  for (const env of [{ LOCAL_DB: "1" }, { APP_ENV: "development" }]) {
    const r = spawnSync(process.execPath, [SERVER], { env: { PATH: process.env.PATH, BP_ENV: "production", PORT: "0", ...env }, encoding: "utf8", timeout: 15000 });
    assert.equal(r.status, 1, JSON.stringify(env));
    assert.match(r.stderr, /رفض الإقلاع/);
  }
});

test("boot: starts, answers /__health, and drains cleanly on SIGTERM", async () => {
  const port = await freePort();
  const child = spawn(process.execPath, [SERVER], { env: { PATH: process.env.PATH, BP_ENV: "local", PORT: String(port), BP_FORCE_HTTPS: "0", BP_BUILD_SHA: "testsha" }, stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  child.stdout.on("data", (d) => (out += d));
  try {
    let body = null;
    for (let i = 0; i < 50 && !body; i++) {
      await new Promise((r) => setTimeout(r, 100));
      try { const r = await fetch(`http://127.0.0.1:${port}/__health`); if (r.ok) body = await r.json(); } catch { /* لم يقلع بعد */ }
    }
    assert.ok(body, `لم يقلع: ${out}`);
    assert.equal(body.ok, true);
    assert.equal(body.sha, "testsha");
    assert.equal(body.env, "local");
    const code = await new Promise((ok) => { child.once("exit", (c) => ok(c)); child.kill("SIGTERM"); });
    assert.equal(code, 0, "SIGTERM = إغلاق لطيف بخروج 0");
    assert.match(out, /draining/);
  } finally { child.kill("SIGKILL"); }
});

test("preview mode: VERCEL_ENV=preview gives the safe test modes the api/ functions already understand; unset = live", () => {
  const probe = (env) => JSON.parse(spawnSync(process.execPath, ["--input-type=module", "-e",
    `const m = await import(${JSON.stringify(path.join(ROOT, "api/_mode.js"))}); console.log(JSON.stringify({ PREVIEW: m.PREVIEW, PAYMENTS_MODE: m.PAYMENTS_MODE, WHATSAPP_MODE: m.WHATSAPP_MODE, EMAIL_MODE: m.EMAIL_MODE }));`],
  { env: { PATH: process.env.PATH, ...env }, encoding: "utf8" }).stdout);
  assert.deepEqual(probe({ VERCEL_ENV: "preview" }), { PREVIEW: true, PAYMENTS_MODE: "test", WHATSAPP_MODE: "mock", EMAIL_MODE: "preview" });
  assert.deepEqual(probe({}), { PREVIEW: false, PAYMENTS_MODE: "live", WHATSAPP_MODE: "live", EMAIL_MODE: "live" }, "بلا VERCEL_ENV: إنتاج حيّ");
});
