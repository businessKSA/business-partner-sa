// The daily Nafath meter (api/_nafath.js): a ceiling per Riyadh day, a warning at
// 80%, the owner's own panel never locked out, the count shared through the
// database rather than lost with the process, and no secrets in what it logs.
import "./nafath-test-util.mjs";
import { otp, nafath, dbRows, resetNafathThrottle } from "./nafath-test-util.mjs";

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");

process.env.NAFATH_DAILY_LIMIT = "5";
const start = async (id, purpose = "portal") => { resetNafathThrottle(); return otp({ action: "nafath-start", nationalId: id, purpose }); };
const count = async (action) => (await dbRows("audit_logs")).filter((r) => r.action === action).length;

test("the limit comes from NAFATH_DAILY_LIMIT, defaulting to 1000", () => {
  assert.equal(nafath.nafathDailyLimit(), 5);
  process.env.NAFATH_DAILY_LIMIT = "abc";
  assert.equal(nafath.nafathDailyLimit(), 1000);
  process.env.NAFATH_DAILY_LIMIT = "0";
  assert.equal(nafath.nafathDailyLimit(), 1000);
  delete process.env.NAFATH_DAILY_LIMIT;
  assert.equal(nafath.nafathDailyLimit(), 1000);
  process.env.NAFATH_DAILY_LIMIT = "5";
});

test("a request that Nafath never accepted is not counted", async () => {
  process.env.NAFATH_PROVIDER = "rabet";
  try {
    const before = (await nafath.nafathUsage()).used;
    const r = await start("1000000031");
    assert.equal(r.status, 503);
    assert.equal((await nafath.nafathUsage()).used, before);
  } finally { delete process.env.NAFATH_PROVIDER; }
});

test("counts requests, warns once at 80%, refuses past the ceiling with a clear message", async () => {
  const warns = [];
  const keep = console.warn;
  console.warn = (...a) => warns.push(a.join(" "));
  try {
    for (const id of ["1000000031", "1000000032", "1000000033"]) assert.equal((await start(id)).status, 200);
    assert.equal(warns.filter((w) => w.includes("[nafath] daily usage")).length, 0, "no warning below 80%");
    assert.equal((await start("1000000034")).status, 200);                      // 4 of 5 = 80%
    const alert = warns.filter((w) => w.includes("[nafath] daily usage"));
    assert.equal(alert.length, 1, "exactly one warning when 80% is crossed");
    assert.match(alert[0], /80%.*4\/5/);
    assert.equal(await count("nafath.alert"), 1, "and one row for the owner's dashboard");
    assert.equal((await start("1000000035")).status, 200);                      // 5 of 5
    assert.equal(warns.filter((w) => w.includes("[nafath] daily usage")).length, 1, "the warning is not repeated");

    const over = await start("1000000036");
    assert.equal(over.status, 429);
    assert.equal(over.json.error, "daily_limit");
    assert.match(over.json.message, /الحدّ اليومي|حدّه اليومي/);
    assert.match(over.json.message, /Google|جوجل|البريد/, "points the visitor at the other doors");
  } finally { console.warn = keep; }
  assert.equal(await count("nafath.request"), 5);
  const usage = await nafath.nafathUsage();
  assert.equal(usage.used, 5);
  assert.equal(usage.remaining, 0);
});

test("the owner's panel sign-in is counted but never refused", async () => {
  const r = await start("1000000002", "panel");
  assert.equal(r.status, 200, "the owner can still open his panel at the ceiling");
  assert.equal((await nafath.nafathUsage()).used, 6);
  // …while everyone else is still refused.
  assert.equal((await start("1000000037")).status, 429);
});

test("the count lives in the database: a fresh function instance still refuses", async () => {
  const m = globalThis.__bpNafathMeter;
  m.n = 0; m.readAt = 0;              // what a cold start looks like
  const r = await start("1000000038");
  assert.equal(r.status, 429);
});

test("a new Riyadh day starts again from zero", async () => {
  const tomorrow = Date.now() + 26 * 3600 * 1000;
  const q = await nafath.nafathQuota({ purpose: "portal", now: tomorrow });
  assert.equal(q.ok, true);
  assert.equal(q.used, 0);
  const day = nafath.riyadhDayStart(Date.UTC(2026, 9, 16, 20, 59, 59));       // 23:59:59 in Riyadh on the 16th
  const next = nafath.riyadhDayStart(Date.UTC(2026, 9, 16, 21, 0, 0));        // 00:00:00 on the 17th
  assert.equal(next.getTime() - day.getTime(), 86400000);
  assert.equal(day.toISOString(), "2026-10-15T21:00:00.000Z");
});

test("the audit rows hold no identity — only the purpose", async () => {
  const rows = (await dbRows("audit_logs")).filter((r) => r.action === "nafath.request");
  assert.ok(rows.length >= 5);
  const text = JSON.stringify(rows);
  assert.ok(!/100000003|100000000/.test(text), "no national id in the audit trail");
  assert.ok(!text.includes(nafath.nafathIdHash("1000000031")), "not even the digest");
});
