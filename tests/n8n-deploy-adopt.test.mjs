// اختبار أوامر تبنّي bp-n8n القائم في ops/n8n/azure/deploy.sh بلا Azure حقيقي:
// `az` و`curl` وهميّان في PATH يسجّلان كل نداء ويردّان بقيم جاهزة.
// الغاية: adopt-check قراءة فقط فعلاً (لا فعل يغيّر شيئاً)، ولا يطبع قيمة سرّ، والتثبيت/التقوية لا يجريان بلا «yes»،
// وأسرار $env على تطبيق بلا هوية مُدارة تُحفظ داخل التطبيق ولا قيمة في متغيّرات البيئة، والنطاق يُربط ببيئة التطبيق الفعلية.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const DEPLOY = path.resolve("ops/n8n/azure/deploy.sh");
const PLAIN_SECRET = "SuperSecretPlain-DB-pass-123";
const OWNER_SECRET = "owner-typed-s3cr3t-value";

function sandbox({ identity = "", envNames = "DB_TYPE\nN8N_ENCRYPTION_KEY\nGENERIC_TIMEZONE", image = "docker.io/n8nio/n8n:latest", minReplicas = "1" } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "n8n-adopt-"));
  const log = path.join(dir, "az.log");
  fs.writeFileSync(log, "");
  const stub = `#!/usr/bin/env bash
echo "$*" >> "${log}"
a="$*"
case "$a" in
  "account show --query id -o tsv") echo 00000000-1111-2222-3333-444444444444 ;;
  "account show -o none") ;;
  *"containerapp show"*"-o none"*) ;;
  *"containers[0].env[].[name, secretRef, value]"*)
    printf 'DB_TYPE\\t\\tpostgresdb\\nDB_POSTGRESDB_HOST\\t\\tbp-n8n-pg.postgres.database.azure.com\\nDB_POSTGRESDB_PASSWORD\\t\\t${PLAIN_SECRET}\\nN8N_ENCRYPTION_KEY\\tn8n-enc-key\\tNone\\nWEBHOOK_URL\\t\\thttps://bp-n8n.example.azurecontainerapps.io/\\n' ;;
  *"containers[0].env[].name"*) printf '${envNames.replace(/\n/g, "\\n")}\\n' ;;
  *"containers[0].image"*) echo ${image} ;;
  *"scale.minReplicas"*) echo ${minReplicas} ;;
  *"scale.maxReplicas"*) echo 1 ;;
  *"identity.userAssignedIdentities"*) printf '%s' "${identity}" ;;
  *"properties.environmentId"*) echo /subscriptions/x/resourceGroups/bp-ai/providers/Microsoft.App/managedEnvironments/bp-agents-env ;;
  *"ingress.fqdn"*) echo bp-n8n.example.azurecontainerapps.io ;;
  *"customDomainVerificationId"*) echo VERIFYID123 ;;
  *"secret list"*) printf 'n8n-enc-key\\npg-pass\\n' ;;
  *"--query {region"*) echo "(table)" ;;
  *) ;;
esac
exit 0
`;
  fs.writeFileSync(path.join(dir, "az"), stub, { mode: 0o755 });
  fs.writeFileSync(path.join(dir, "curl"), `#!/usr/bin/env bash
case "$*" in
  *rest/settings*) echo '{"data":{"versionCli":"1.99.1"}}' ;;
  *healthz*) echo '{"status":"ok"}' ;;
esac
exit 0
`, { mode: 0o755 });
  const run = (args, input = "") => {
    const r = spawnSync("bash", [DEPLOY, ...args], {
      input, encoding: "utf8",
      env: { PATH: `${dir}:${process.env.PATH}`, HOME: dir, BP_RG: "bp-ai" },
    });
    return { code: r.status, out: `${r.stdout}\n${r.stderr}`, calls: fs.readFileSync(log, "utf8").split("\n").filter(Boolean) };
  };
  return { run };
}

const MUTATING = /\b(create|update|set|delete|bind|add|assign|remove|register|upgrade|apply)\b/;

test("adopt-check: قراءة فقط فعلاً — لا نداء az يغيّر شيئاً، ولا قيمة سرّ في الطباعة", () => {
  const { run } = sandbox();
  const r = run(["adopt-check"]);
  assert.equal(r.code, 0, r.out);
  const azCalls = r.calls.filter((c) => !c.startsWith("account show"));
  assert.ok(azCalls.length >= 4, "فحص حقيقي لا فارغ");
  for (const c of azCalls) {
    assert.match(c, /^(containerapp show|containerapp secret list|postgres flexible-server show)/, `نداء غير متوقَّع: ${c}`);
    assert.ok(!MUTATING.test(c.replace(/--query\s+("[^"]*"|\S+)/g, "")), `نداء يغيّر: ${c}`);
  }
  assert.ok(!r.calls.some((c) => c.includes("--show-values")), "لا نقرأ قيم الأسرار");
  assert.ok(!r.out.includes(PLAIN_SECRET), "قيمة سرّ طُبعت");
});

test("adopt-check: يعلّم الصورة latest ونقص الإعدادات، ويؤكد مفتاح التشفير كمرجع سرّ، ويقرأ النسخة والقاعدة", () => {
  const { run } = sandbox();
  const r = run(["adopt-check"]);
  assert.match(r.out, /✗ الصورة غير مثبّتة/);
  assert.match(r.out, /✓ N8N_ENCRYPTION_KEY مرجع سرّ/);
  assert.match(r.out, /✗ N8N_PROXY_HOPS غير مضبوط/);
  assert.match(r.out, /✓ DB_TYPE=postgresdb/);
  assert.match(r.out, /✓ WEBHOOK_URL=https:\/\/bp-n8n\.example\.azurecontainerapps\.io\//);
  assert.match(r.out, /النسخة التي تعمل: 1\.99\.1/);
  assert.match(r.out, /قاعدة البيانات: bp-n8n-pg/);
  assert.ok(r.calls.some((c) => c.startsWith("postgres flexible-server show -n bp-n8n-pg")), "اسم الخادم يُستخرج من DB_POSTGRESDB_HOST");
  assert.match(r.out, /n8n-enc-key/);
});

test("adopt-check: صورة مثبّتة تُقبل", () => {
  const { run } = sandbox({ image: "docker.n8n.io/n8nio/n8n:1.99.1" });
  assert.match(run(["adopt-check"]).out, /✓ الصورة مثبّتة: 1\.99\.1/);
});

test("adopt-pin: بلا «yes» لا يغيّر شيئاً؛ وبـyes يثبّت على النسخة الجارية لا latest", () => {
  const { run } = sandbox();
  const no = run(["adopt-pin"], "no\n");
  assert.notEqual(no.code, 0);
  assert.ok(!no.calls.some((c) => c.startsWith("containerapp update")), "تغيّر شيء بلا تأكيد");
  const yes = run(["adopt-pin"], "yes\n");
  assert.equal(yes.code, 0, yes.out);
  const upd = yes.calls.filter((c) => c.startsWith("containerapp update"));
  assert.equal(upd.length, 1);
  assert.match(upd[0], /--image docker\.n8n\.io\/n8nio\/n8n:1\.99\.1/);
});

test("adopt-pin: يرفض latest ونسخة معطوبة", () => {
  const { run } = sandbox();
  for (const v of ["latest", "next", "1.2"]) {
    const r = run(["adopt-pin", v], "yes\n");
    assert.notEqual(r.code, 0, v);
    assert.ok(!r.calls.some((c) => c.startsWith("containerapp update")), v);
  }
});

test("adopt-harden: يضيف الناقص فقط ولا يلمس الموجود، وبلا «yes» لا يكتب", () => {
  const { run } = sandbox();
  const no = run(["adopt-harden"], "\n");
  assert.notEqual(no.code, 0);
  assert.ok(!no.calls.some((c) => c.startsWith("containerapp update")));
  const r = run(["adopt-harden"], "yes\n");
  assert.equal(r.code, 0, r.out);
  const upd = r.calls.filter((c) => c.startsWith("containerapp update"));
  assert.equal(upd.length, 1, "نداء واحد لا تعديلات متفرقة");
  assert.match(upd[0], /--set-env-vars/);
  assert.match(upd[0], /N8N_PROXY_HOPS=1/);
  assert.match(upd[0], /EXECUTIONS_DATA_MAX_AGE=72/);
  // الموجودة أصلاً لا تُمسّ، ولا النطاق ولا قاعدة البيانات
  assert.ok(!/GENERIC_TIMEZONE=|DB_TYPE=|WEBHOOK_URL=|N8N_ENCRYPTION_KEY=/.test(upd[0]), upd[0]);
});

test("adopt-harden: نسخ min=0 تُضبط على 1/1 بعد التأكيد", () => {
  const { run } = sandbox({ minReplicas: "0", envNames: [
    "GENERIC_TIMEZONE", "TZ", "N8N_BLOCK_ENV_ACCESS_IN_NODE", "N8N_PROXY_HOPS", "N8N_RUNNERS_ENABLED", "EXECUTIONS_DATA_SAVE_ON_ERROR",
    "EXECUTIONS_DATA_SAVE_ON_SUCCESS", "EXECUTIONS_DATA_SAVE_MANUAL_EXECUTIONS", "EXECUTIONS_DATA_PRUNE", "EXECUTIONS_DATA_MAX_AGE",
    "EXECUTIONS_DATA_PRUNE_MAX_COUNT", "N8N_DIAGNOSTICS_ENABLED", "N8N_VERSION_NOTIFICATIONS_ENABLED", "N8N_PERSONALIZATION_ENABLED"].join("\n") });
  const r = run(["adopt-harden"], "yes\n");
  assert.equal(r.code, 0, r.out);
  const upd = r.calls.filter((c) => c.startsWith("containerapp update"));
  assert.equal(upd.length, 1);
  assert.match(upd[0], /--min-replicas 1 --max-replicas 1/);
});

test("الخطوة 6 على تطبيق بلا هوية مُدارة: سرّ داخل التطبيق، ومتغيّر البيئة مرجع لا قيمة", () => {
  const { run } = sandbox({ identity: "" });
  const r = run(["6", "BP_PANEL_KEY"], `${OWNER_SECRET}\n`);
  assert.equal(r.code, 0, r.out);
  assert.ok(!r.out.includes(OWNER_SECRET), "القيمة ظهرت في الطباعة");
  assert.ok(!r.calls.some((c) => c.startsWith("keyvault")), "لا Key Vault لتطبيق بلا هوية");
  const setSecret = r.calls.find((c) => c.startsWith("containerapp secret set"));
  assert.ok(setSecret && setSecret.includes(`bp-panel-key=${OWNER_SECRET}`));
  const upd = r.calls.find((c) => c.startsWith("containerapp update"));
  assert.match(upd, /BP_PANEL_KEY=secretref:bp-panel-key/);
  assert.ok(!upd.includes(OWNER_SECRET), "القيمة في متغيّرات البيئة");
});

test("الخطوة 7: ربط النطاق بالبيئة التي فيها التطبيق فعلاً (لا bp-n8n-env الافتراضية)", () => {
  const { run } = sandbox();
  const r = run(["7"], "\n");
  assert.equal(r.code, 0, r.out);
  const bind = r.calls.find((c) => c.startsWith("containerapp hostname bind"));
  assert.ok(bind, r.out);
  assert.match(bind, /--environment bp-agents-env/);
  assert.match(bind, /--hostname n8n\.businesspartner\.sa/);
  assert.match(r.out, /CNAME\s+n8n\s+→\s+bp-n8n\.example\.azurecontainerapps\.io/);
});

test("deploy.sh: صياغة bash سليمة، والمساعدة تذكر أوامر التبنّي", () => {
  const syn = spawnSync("bash", ["-n", DEPLOY], { encoding: "utf8" });
  assert.equal(syn.status, 0, syn.stderr);
  const help = spawnSync("bash", [DEPLOY, "help"], { encoding: "utf8" });
  assert.match(help.stdout, /adopt-check/);
});
