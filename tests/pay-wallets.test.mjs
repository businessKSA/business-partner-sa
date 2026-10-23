// Which wallets /api/pay?action=config offers — and, as important, which it
// does not. A wallet button that fails when tapped is worse than none, so a
// wallet named in MOYASAR_METHODS without its identifier must stay hidden.
//
// Each case runs in a child process because api/pay.js reads its environment
// once, at import.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PROBE = `
const { default: handler } = await import(${JSON.stringify(path.join(ROOT, "api", "pay.js"))});
const out = {};
const res = { setHeader() {}, end(b) { out.body = JSON.parse(b); }, statusCode: 200 };
await handler({ method: "GET", headers: {}, query: { action: "config" }, url: "/api/pay?action=config" }, res);
console.log(JSON.stringify(out.body));
const m = await import(${JSON.stringify(path.join(ROOT, "api", "_moyasar.js"))});
console.log(JSON.stringify(m.moyasarVars()));
`;

function run(env) {
  const clean = { PATH: process.env.PATH, APP_ENV: "production", VERCEL_ENV: "production",
    MOYASAR_PUBLISHABLE_KEY: "pk_test_unit00000000000000000000000000000000", ...env };
  const lines = execFileSync(process.execPath, ["--input-type=module", "-e", PROBE], { env: clean, encoding: "utf8" })
    .trim().split("\n");
  return { cfg: JSON.parse(lines[lines.length - 2]), vars: JSON.parse(lines[lines.length - 1]) };
}

test("default: card only, no wallet objects", () => {
  const { cfg } = run({});
  assert.deepEqual(cfg.methods, ["creditcard"]);
  assert.equal(cfg.applePay, null);
  assert.equal(cfg.samsungPay, null);
  assert.equal(cfg.googlePay, null);
});

test("samsungpay / googlepay listed without their identifiers are dropped", () => {
  const { cfg, vars } = run({ MOYASAR_METHODS: "creditcard,applepay,samsungpay,googlepay" });
  assert.deepEqual(cfg.methods, ["creditcard", "applepay"]);
  assert.equal(cfg.samsungPay, null);
  assert.equal(cfg.googlePay, null);
  assert.equal(vars.samsungPayOn, false);
  assert.equal(vars.googlePayOn, false);
});

test("googlepay with a merchant ID is offered, PRODUCTION unless told otherwise", () => {
  const { cfg, vars } = run({ MOYASAR_METHODS: "creditcard,googlepay", MOYASAR_GOOGLE_MERCHANT_ID: "BCR2DN_unit" });
  assert.ok(cfg.methods.includes("googlepay"));
  assert.deepEqual(cfg.googlePay, { merchant_id: "BCR2DN_unit", country: "SA", label: "Business Partner", environment: "PRODUCTION" });
  assert.equal(vars.googlePayOn, true);
  assert.equal(cfg.samsungPay, null);
});

test("MOYASAR_GOOGLE_ENV=test selects Google's TEST environment", () => {
  const { cfg } = run({ MOYASAR_METHODS: "googlepay", MOYASAR_GOOGLE_MERCHANT_ID: "BCR2DN_unit", MOYASAR_GOOGLE_ENV: "test" });
  assert.equal(cfg.googlePay.environment, "TEST");
});

test("samsungpay with a service ID is offered", () => {
  const { cfg, vars } = run({ MOYASAR_METHODS: "creditcard,samsungpay", MOYASAR_SAMSUNG_SERVICE_ID: "svc_unit" });
  assert.equal(cfg.samsungPay.service_id, "svc_unit");
  assert.equal(vars.samsungPayOn, true);
  assert.equal(cfg.googlePay, null);
});

// ---------- 2026-10-23: المحفظة مع معرّفها تُعرَض، وسبب غيابها يُقرأ من الإعداد (رموز لا قيم)

test("a Samsung Service ID or Google merchant ID set WITHOUT listing the method now offers the wallet (the identifier implies its method)", () => {
  const sp = run({ MOYASAR_SAMSUNG_SERVICE_ID: "svc_unit" });
  assert.ok(sp.cfg.methods.includes("samsungpay"));
  assert.equal(sp.cfg.samsungPay.service_id, "svc_unit");
  assert.equal(sp.vars.samsungPayOn, true, "the admin panel agrees with the checkout");
  const gp = run({ MOYASAR_GOOGLE_MERCHANT_ID: "BCR2DN_unit" });
  assert.ok(gp.cfg.methods.includes("googlepay"));
  assert.equal(gp.vars.googlePayOn, true);
  assert.equal(run({}).cfg.samsungPay, null, "nothing set → nothing offered");
});

test("/api/pay says why each wallet is off — a code, never a value — so a settings gap is visible from outside", () => {
  const none = run({}).cfg.wallets;
  for (const k of ["apple", "samsung", "google"]) assert.deepEqual(none[k], { on: false, why: "not_in_methods" }, k);
  const listedNoId = run({ MOYASAR_METHODS: "creditcard,applepay,samsungpay,googlepay" }).cfg.wallets;
  assert.deepEqual(listedNoId.apple, { on: true, why: null });
  assert.deepEqual(listedNoId.samsung, { on: false, why: "identifier_missing" });
  assert.deepEqual(listedNoId.google, { on: false, why: "identifier_missing" });
  const all = run({ MOYASAR_METHODS: "creditcard,applepay", MOYASAR_SAMSUNG_SERVICE_ID: "svc_unit" }).cfg.wallets;
  assert.equal(all.apple.on, true);
  assert.equal(all.samsung.on, true);
  const text = JSON.stringify(run({ MOYASAR_SAMSUNG_SERVICE_ID: "svc_secret_value" }).cfg.wallets);
  assert.doesNotMatch(text, /svc_secret_value/, "the wallet state carries no identifier");
});
