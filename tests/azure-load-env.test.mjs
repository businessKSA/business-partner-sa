// load-env.mjs يضع أسرار الموقع في Container App بلا أن يطبع قيمة. يُختبر هنا بالتشغيل التجريبي (dry-run) فقط: لا az ولا شبكة.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const SCRIPT = path.resolve("ops/azure/load-env.mjs");
function run(envText, extra = []) {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bp-env-")), "v.env");
  fs.writeFileSync(f, envText);
  const r = spawnSync(process.execPath, [SCRIPT, "--file", f, "--app", "x", "--rg", "y", "--dry-run", ...extra], { encoding: "utf8" });
  fs.rmSync(path.dirname(f), { recursive: true, force: true });
  return r;
}

test("load-env: يصنّف الأسرار والعادي ويتجاهل Vercel والفارغ ولا يطبع القيم", () => {
  const r = run([
    '# comment',
    'MOYASAR_SECRET_KEY="sk_live_SUPERSECRETVALUE"',
    'MOYASAR_PUBLISHABLE_KEY=pk_live_publicvalue',
    'GOOGLE_CLIENT_ID=abc.apps.googleusercontent.com',
    'DAFTRA_API_KEY=""',
    'VERCEL_ENV="production"',
    'NODE_ENV=production',
    'PRIVATE_KEY="-----BEGIN\\nXYZ\\n-----END"',
  ].join("\n"));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /أسرار 2/);
  assert.match(r.stdout, /MOYASAR_SECRET_KEY/);
  assert.match(r.stdout, /ناقصة[^\n]*DAFTRA_API_KEY/);
  assert.ok(!r.stdout.includes("SUPERSECRETVALUE"), "قيمة سرّ طُبعت");
  assert.ok(!r.stdout.includes("pk_live_publicvalue"), "قيمة متغيّر طُبعت");
  assert.ok(!/VERCEL_ENV/.test(r.stdout.split("عادية:")[1] || ""), "متغيّر Vercel لم يُتجاهَل");
});

test("load-env --staging-safe: يفرض أوضاع الاختبار ولو جاءت live في الملف", () => {
  const r = run("PAYMENTS_MODE=live\nEMAIL_MODE=live\nWHATSAPP_MODE=live\n", ["--staging-safe"]);
  assert.equal(r.status, 0, r.stderr);
  for (const k of ["PAYMENTS_MODE", "MOYASAR_MODE", "TAMARA_MODE", "WHATSAPP_MODE", "EMAIL_MODE", "CONTRACT_MODE", "CALENDAR_MODE"]) assert.match(r.stdout, new RegExp(k));
});

test("load-env: يرفض التشغيل بلا وسائط", () => {
  const r = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" });
  assert.equal(r.status, 2);
});
