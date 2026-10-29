// The owner's panel (/ops) and PANEL_REQUIRE_NAFATH — owner decision 2026-10-16:
// the owner's panel opens with Nafath ONLY, and only for an identity on
// OWNER_NATIONAL_IDS (checked by isOwnerId, as digests). With the switch on, a
// key, a test key, a session by e-mail — every other door — is shut.
//
// api/_simple.js is checked end to end here. api/requests.js (owner-ops) is
// checked for its ticket gate and, separately, for one door that stays open
// (see the `todo` test at the bottom) — reported to its owner, not edited.
import "./nafath-test-util.mjs";
import { otp, simple, nafath, rawCookie, sleep, nafathSignIn, resetNafathThrottle, dbRows } from "./nafath-test-util.mjs";

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");

const OWNER = "1000000002";          // on OWNER_NATIONAL_IDS (set by the util)
const STRANGER = "1000000041";       // a perfectly valid id that is not the owner's
const KEY = process.env.PANEL_KEY;

async function panelTicket(id) {
  resetNafathThrottle();
  const s = await otp({ action: "nafath-start", nationalId: id, purpose: "panel" });
  if (!s.json.ok) return { start: s };
  await sleep(650);
  const p = await otp({ action: "nafath-poll", challenge: s.json.challenge });
  return { start: s, poll: p, ticket: p.json && p.json.ticket };
}

test("isOwnerId / mintOwnerTicket: only an identity on the list gets a ticket", () => {
  assert.equal(nafath.isOwnerId(OWNER), true);
  assert.equal(nafath.isOwnerId("٠٠٠"), false);
  assert.equal(nafath.isOwnerId(STRANGER), false);
  assert.equal(nafath.isOwnerId(""), false);
  assert.ok(nafath.mintOwnerTicket(OWNER));
  assert.equal(nafath.mintOwnerTicket(STRANGER), null);
});

test("a ticket is only as good as the list today", () => {
  const t = nafath.mintOwnerTicket(OWNER);
  assert.equal(nafath.ownerTicketOk(t), true);
  const keep = process.env.OWNER_NATIONAL_IDS;
  try {
    process.env.OWNER_NATIONAL_IDS = "1000000099";           // the owner is removed from the list
    assert.equal(nafath.ownerTicketOk(t), false, "removing an id shuts its outstanding tickets at once");
  } finally { process.env.OWNER_NATIONAL_IDS = keep; }
  assert.equal(nafath.ownerTicketOk(t), true);
});

test("a ticket cannot be forged, borrowed from another kind of sealed note, or reused after it expires", () => {
  const strangerHash = nafath.nafathIdHash(STRANGER);
  // sealed with the right key but naming a stranger: the list still refuses it
  assert.equal(nafath.ownerTicketOk(nafath.nafathSeal({ t: "panel", nid: strangerHash, exp: Date.now() + 60000 })), false);
  // the other sealed notes this system issues are not tickets
  assert.equal(nafath.ownerTicketOk(nafath.nafathSeal({ t: "verified", hash: nafath.nafathIdHash(OWNER), exp: Date.now() + 60000 })), false);
  assert.equal(nafath.ownerTicketOk(nafath.nafathSeal({ t: "pending", nid: OWNER, exp: Date.now() + 60000 })), false);
  // expired
  assert.equal(nafath.ownerTicketOk(nafath.nafathSeal({ t: "panel", nid: nafath.nafathIdHash(OWNER), exp: Date.now() - 1 })), false);
  // garbage
  for (const g of ["", "x", "a.b.c", null, undefined, "A".repeat(80)]) assert.equal(nafath.ownerTicketOk(g), false);
});

test("panel sign-in: a stranger's id never reaches Nafath; the owner's does, and yields a ticket", async () => {
  const before = (await nafath.nafathUsage()).used;
  const s = await panelTicket(STRANGER);
  assert.equal(s.start.status, 403);
  assert.equal(s.start.json.error, "not_owner");
  assert.equal((await nafath.nafathUsage()).used, before, "no request was made, so no phone rang");

  const o = await panelTicket(OWNER);
  assert.equal(o.start.status, 200);
  assert.equal(o.poll.json.status, "COMPLETED");
  assert.ok(o.ticket, "the owner gets a ticket");
  assert.equal(nafath.ownerTicketOk(o.ticket), true);
  assert.equal(o.poll.cookie, "", "a ticket is a door, not a login: no session cookie");
  assert.ok(!JSON.stringify(o.poll.json).includes(OWNER), "the id does not travel back");
});

test("a portal sign-in by the owner's national id does not yield a panel ticket", async () => {
  const r = await nafathSignIn(OWNER, { purpose: "portal" });
  assert.equal(r.poll.json.status, "COMPLETED");
  assert.equal(r.poll.json.ticket, undefined);
});

test("PANEL_REQUIRE_NAFATH=1 on /api/simple: the ticket opens ops; the key, the test key and the owner's e-mail session do not", async () => {
  const ticket = (await panelTicket(OWNER)).ticket;
  assert.ok(ticket);
  // an owner session by e-mail, the way the owner signs in today
  const ownerMail = await (async () => {
    const s = await otp({ action: "start", email: "owner.mail@example.com" });
    const v = await otp({ action: "verify", email: "owner.mail@example.com", code: s.json.devCode, challenge: s.json.challenge });
    return rawCookie(v.cookie);
  })();

  // ---- switch OFF: every existing door still works (nothing was taken away by default)
  delete process.env.PANEL_REQUIRE_NAFATH;
  assert.equal((await simple({ action: "ops-summary", key: KEY })).status, 200, "key");
  assert.equal((await simple({ action: "ops-summary", key: "test-ops" })).status, 200, "test key (development)");
  assert.equal((await simple({ action: "ops-summary", ticket })).status, 200, "ticket");

  // ---- switch ON: Nafath only
  process.env.PANEL_REQUIRE_NAFATH = "1";
  try {
    assert.equal((await simple({ action: "ops-summary", ticket })).status, 200, "the ticket opens it");
    const key = await simple({ action: "ops-summary", key: KEY });
    assert.equal(key.status, 401, "the panel key is shut");
    const testKey = await simple({ action: "ops-summary", key: "test-ops" });
    assert.equal(testKey.status, 401, "the throw-away test key is shut too");
    const mail = await simple({ action: "ops-summary" }, { cookie: ownerMail });
    assert.equal(mail.status, 401, "the owner's e-mail session is shut");
    assert.equal(mail.json.nafath, true, "and the answer says Nafath is the way in");
    const stranger = nafath.nafathSeal({ t: "panel", nid: nafath.nafathIdHash(STRANGER), exp: Date.now() + 60000 });
    assert.equal((await simple({ action: "ops-summary", ticket: stranger })).status, 401, "a stranger's ticket");
    assert.equal((await simple({ action: "ops-summary", ticket: "garbage" })).status, 401);
    // the same through the query string, as the dashboard sends it
    assert.equal((await simple({ action: "ops-summary" }, { query: { ticket } })).status, 200);
    assert.equal((await simple({ action: "ops-summary" }, { query: { key: KEY } })).status, 401);
  } finally { delete process.env.PANEL_REQUIRE_NAFATH; }
});

test("the status endpoint reports whether the panel demands Nafath, never a secret", async () => {
  const { default: handler } = await import("../api/otp.js");
  const get = (env) => new Promise((resolve) => {
    if (env) process.env.PANEL_REQUIRE_NAFATH = env; else delete process.env.PANEL_REQUIRE_NAFATH;
    handler({ method: "GET", headers: { host: "localhost:3000" } }, {
      statusCode: 200, setHeader() {}, end(s) { resolve(JSON.parse(s)); },
    });
  });
  try {
    const off = await get("");
    assert.equal(off.panelRequiresNafath, false);
    const on = await get("1");
    assert.equal(on.panelRequiresNafath, true);
    assert.equal(on.nafath.owners, 1, "the count of owner identities, never the ids");
    const text = JSON.stringify(on);
    assert.ok(!text.includes(OWNER) && !text.includes(KEY) && !text.includes(process.env.OTP_SECRET));
  } finally { delete process.env.PANEL_REQUIRE_NAFATH; }
  void dbRows;
});

// ---------------------------------------------------------------------------
// api/requests.js is owner-ops' file. Its `panelOk` gate is right (ticket, or key
// only while the switch is off) and is checked below. But `opsGate` — used by
// `ops-analytics` — ends with «or the owner's session by e-mail», and that
// fallback does not look at PANEL_REQUIRE_NAFATH. So with the switch on, the
// analytics endpoint still opens for a signed-in owner without Nafath.
// Marked `todo` so the run stays green and the gap stays visible: when owner-ops
// closes it, this test starts passing and the todo flag can be removed.
test("api/requests.js panelOk: with the switch on, the key is shut and the ticket opens", async () => {
  const { default: requests } = await import("../api/requests.js");
  const call = (query, cookie = "") => new Promise((resolve) => requests(
    { method: "GET", query, headers: { host: "localhost:3000", "x-forwarded-for": "10.9.9.9", ...(cookie ? { cookie: "bp_sid=" + cookie } : {}) }, url: "/api/requests" },
    { statusCode: 200, headers: {}, setHeader() {}, end(s) { let j = null; try { j = JSON.parse(s); } catch {} resolve({ status: this.statusCode, json: j }); } },
  ));
  const ticket = (await panelTicket(OWNER)).ticket;
  process.env.PANEL_REQUIRE_NAFATH = "1";
  try {
    const withKey = await call({ action: "panel-analytics", key: KEY });
    assert.equal(withKey.status, 401, "the key is shut");
    const withTicket = await call({ action: "panel-analytics", ticket });
    assert.notEqual(withTicket.status, 401, "the ticket passes the gate");
  } finally { delete process.env.PANEL_REQUIRE_NAFATH; }
});

test("api/requests.js opsGate: the owner's e-mail session must be shut when Nafath is required", async () => {
  const { default: requests } = await import("../api/requests.js");
  const s = await otp({ action: "start", email: "owner.mail2@example.com" });
  const v = await otp({ action: "verify", email: "owner.mail2@example.com", code: s.json.devCode, challenge: s.json.challenge });
  const cookie = rawCookie(v.cookie);
  process.env.PANEL_REQUIRE_NAFATH = "1";
  try {
    const r = await new Promise((resolve) => requests(
      { method: "GET", query: { action: "ops-analytics" }, headers: { host: "localhost:3000", "x-forwarded-for": "10.9.9.8", cookie: "bp_sid=" + cookie }, url: "/api/requests" },
      { statusCode: 200, headers: {}, setHeader() {}, end(body) { resolve({ status: this.statusCode, body }); } },
    ));
    assert.equal(r.status, 401);
  } finally { delete process.env.PANEL_REQUIRE_NAFATH; }
});
