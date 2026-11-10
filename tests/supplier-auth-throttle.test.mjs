import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { authBlocked, authRecord, throttleKeys, MAX_FAILS, WINDOW_MS, LOCK_MS, _resetForTests } from "../api/_auththrottle.js";

const E = "supplier@example.com";
const IP = "203.0.113.7";

test("blocks after MAX_FAILS failures and reports retryAfter", async () => {
  _resetForTests();
  const t0 = 1_700_000_000_000;
  for (let i = 0; i < MAX_FAILS - 1; i++) {
    await authRecord("login", E, IP, false, t0 + i);
    assert.equal((await authBlocked("login", E, IP, t0 + i)).blocked, false);
  }
  await authRecord("login", E, IP, false, t0 + 10);
  const g = await authBlocked("login", E, IP, t0 + 11);
  assert.equal(g.blocked, true);
  assert.ok(g.retryAfter > 0 && g.retryAfter <= LOCK_MS / 1000);
});

test("lock expires and a success clears the e-mail counter", async () => {
  _resetForTests();
  const t0 = 1_700_000_000_000;
  for (let i = 0; i < MAX_FAILS; i++) await authRecord("login", E, IP, false, t0 + i);
  assert.equal((await authBlocked("login", E, IP, t0 + 100)).blocked, true);
  assert.equal((await authBlocked("login", E, IP, t0 + LOCK_MS + 1000)).blocked, false);
  _resetForTests();
  for (let i = 0; i < MAX_FAILS - 1; i++) await authRecord("login", E, IP, false, t0 + i);
  await authRecord("login", E, IP, true, t0 + 50);
  await authRecord("login", E, IP, false, t0 + 60);
  assert.equal((await authBlocked("login", E, IP, t0 + 61)).blocked, false);
});

test("window resets stale failures", async () => {
  _resetForTests();
  const t0 = 1_700_000_000_000;
  for (let i = 0; i < MAX_FAILS - 1; i++) await authRecord("login", E, IP, false, t0 + i);
  await authRecord("login", E, IP, false, t0 + WINDOW_MS + 5000);
  assert.equal((await authBlocked("login", E, IP, t0 + WINDOW_MS + 5001)).blocked, false);
});

test("kinds and e-mails are independent; keys never contain the raw e-mail or IP", async () => {
  _resetForTests();
  const t0 = 1_700_000_000_000;
  for (let i = 0; i < MAX_FAILS; i++) await authRecord("verify", E, IP, false, t0 + i);
  assert.equal((await authBlocked("verify", E, IP, t0 + 100)).blocked, true);
  assert.equal((await authBlocked("login", "other@example.com", "198.51.100.9", t0 + 100)).blocked, false);
  for (const { key } of throttleKeys("login", E, IP)) {
    assert.ok(!key.includes("example.com") && !key.includes(IP));
  }
});

test("every authSupplier call outside the guard goes through guarded()", () => {
  const src = readFileSync(new URL("../api/_suppliers.js", import.meta.url), "utf8");
  const calls = src.split("\n").filter((l) => /await authSupplier\(/.test(l));
  assert.equal(calls.length, 1, "only the guard itself may call authSupplier directly");
  assert.match(src, /authBlocked\("verify"/);
  assert.match(src, /authBlocked\("resend"/);
});
