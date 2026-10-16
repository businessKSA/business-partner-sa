// ops/azure/cron-switch.sh: مجدولٌ واحد فعّال فقط. بلا Azure: `az` مُحاكى في PATH يسجّل ما استُدعي.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, "ops", "azure", "cron-switch.sh");
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-cronsw-"));
const log = path.join(dir, "az.log");
fs.writeFileSync(path.join(dir, "az"), `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> "${log}"\n`, { mode: 0o755 });
const run = (args, env = {}, input) => {
  fs.rmSync(log, { force: true });
  const r = spawnSync("bash", [SCRIPT, ...args], { env: { PATH: `${dir}:${process.env.PATH}`, HOME: process.env.HOME, ...env }, encoding: "utf8", input });
  return { ...r, calls: fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n").filter(Boolean) : [] };
};
const ENV = { RG: "rg-bp-web", CAE: "cae-bp-web", IMAGE: "bpwebacr.azurecr.io/bp-site:abc123", CRON_SECRET: "S3CRET-VALUE-XYZ" };
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

test("script is valid bash", () => {
  assert.equal(spawnSync("bash", ["-n", SCRIPT]).status, 0);
});

test("on without the owner's confirmation creates NOTHING (Vercel Cron must be disabled first)", () => {
  const no = run(["on"], ENV, "لا\n");
  assert.notEqual(no.status, 0);
  assert.deepEqual(no.calls, []);
  assert.match(no.stdout, /Vercel Cron/);
  const empty = run(["on"], ENV, "\n");
  assert.deepEqual(empty.calls, []);
});

test("on after confirmation creates exactly the cron jobs of vercel.json: schedule, command, no retries, secret by reference", () => {
  const r = run(["on"], ENV, "نعم\n");
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.calls.length, vercel.crons.length, "مهمة لكل cron");
  vercel.crons.forEach((c, i) => {
    const line = r.calls[i];
    assert.match(line, /^containerapp job create -g rg-bp-web -n bp-cron-\d-/);
    assert.ok(line.includes(`--cron-expression ${c.schedule}`), c.schedule);
    assert.ok(line.includes(`--args ops/azure/cron.mjs ${i}`));
    assert.ok(line.includes("--trigger-type Schedule"));
    assert.ok(line.includes("--replica-retry-limit 0"), "لا إعادة محاولة تلقائية: لا نشرة ثانية");
    assert.ok(line.includes("--parallelism 1") && line.includes("--replica-completion-count 1"));
    assert.ok(line.includes("CRON_SECRET=secretref:cron-secret"));
    assert.ok(line.includes("BP_CRON_BASE=https://www.businesspartner.sa"));
    assert.ok(line.includes("--registry-server bpwebacr.azurecr.io --registry-identity system"));
  });
  assert.doesNotMatch(r.stdout + r.stderr, /S3CRET-VALUE-XYZ/, "السرّ لا يُطبع");
  assert.match(r.stdout, /Azure وحده/);
});

test("the confirmation can be given by the test switch only explicitly", () => {
  const r = run(["on"], { ...ENV, CONFIRM_VERCEL_CRON_DISABLED: "yes" });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.calls.length, vercel.crons.length);
});

test("missing variables stop before any az call", () => {
  for (const drop of ["RG", "CAE", "IMAGE"]) {
    const env = { ...ENV, CONFIRM_VERCEL_CRON_DISABLED: "yes" }; delete env[drop];
    const r = run(["on"], env);
    assert.equal(r.status, 2, drop);
    assert.deepEqual(r.calls, []);
  }
});

test("off deletes all the Azure jobs FIRST and only then tells you to enable Vercel Cron (old off before new on, both directions)", () => {
  const r = run(["off"], { RG: "rg-bp-web" });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.calls.length, vercel.crons.length);
  for (const c of r.calls) assert.match(c, /^containerapp job delete -g rg-bp-web -n bp-cron-\d-.* --yes/);
  assert.match(r.stdout, /لا مجدول فعّال/);
  assert.ok(r.stdout.indexOf("حذف") < r.stdout.indexOf("Enable"), "الحذف قبل تفعيل Vercel");
});

test("unknown command → usage, exit 2", () => {
  const r = run(["wat"]);
  assert.equal(r.status, 2);
});
