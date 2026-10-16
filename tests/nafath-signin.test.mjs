// Client sign-in: Nafath first, then Google, then e-mail + password (api/otp.js).
//
// What this file proves:
//   ١) مزوّد نفاذ: elm افتراضياً، rabet هيكلٌ يرمي not_implemented ولا يتصل بشيء، mock للتطوير
//      وحده، وقيمة مجهولة لا تسقط إلى Elm بصمت.
//   ٢) أول دخول بنفاذ ينشئ حساباً مفتاحه بصمة الهوية — والرقم الخام لا يُخزَّن ولا يُرَدّ.
//   ٣) خطوة البريد والجوال مرة واحدة: بالرمز، مقيَّدة بالجلسة وبالغرض، وتربط الحساب القائم
//      بدل أن تكرّره، ولا تنتزع هويةً من حسابٍ ببريدٍ حقيقي.
//   ٤) البريد وكلمة المرور: لا تُفعَّل كلمة المرور قبل رمز البريد؛ حدٌّ أدنى للقوة وحدٌّ للمحاولات.
import "./nafath-test-util.mjs";
import {
  otp, simple, nafath, rawCookie, sleep, dbText, dbRows, nafathSignIn, resetNafathThrottle, otpHandler,
} from "./nafath-test-util.mjs";
import { createHash } from "node:crypto";
import vm from "node:vm";

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
const auth = await import("../api/_clientauth.js");
const { clientLoginJs, NATIONAL_ID_FIRST_DIGITS } = await import("../site/scripts/client-login.mjs");

const who = async (cookie) => (await otp({ action: "me" }, { cookie })).json.session?.user;
async function emailAccount(email) {
  const s = await otp({ action: "start", email });
  const v = await otp({ action: "verify", email, code: s.json.devCode || "123456", challenge: s.json.challenge });
  assert.equal(v.status, 200, "e-mail sign-in should open a session");
  return { cookie: rawCookie(v.cookie), user: v.json.user };
}

/* ---------------------------------------------------------------- provider -- */
test("provider: development defaults to the simulator, never to a live call", () => {
  assert.equal(nafath.nafathProviderName(), "mock");
  assert.equal(nafath.nafathConfigured(), true);
  assert.equal(nafath.nafathPing().provider, "mock");
  assert.equal(nafath.nafathPing().dailyLimit, 1000);
});

test("provider: rabet is a skeleton — it refuses with not_implemented and touches no network", async () => {
  process.env.NAFATH_PROVIDER = "rabet";
  try {
    assert.equal(nafath.nafathConfigured(), false);
    await assert.rejects(() => nafath.nafathRequest({ nationalId: "1000000001" }), /not_implemented/);
    await assert.rejects(() => nafath.nafathStatus({ nationalId: "1000000001", transId: "x", random: "12" }), /not_implemented/);
    const r = await otp({ action: "nafath-start", nationalId: "1000000011", purpose: "portal" });
    assert.equal(r.status, 503);
    assert.equal(r.json.error, "not_implemented");
    const m = await otp({ action: "methods" });
    assert.equal(m.json.nafath.available, false);
    assert.equal(m.json.nafath.provider, "rabet");
  } finally { delete process.env.NAFATH_PROVIDER; }
});

test("provider: an unknown name is an error, not a silent fall-back to Elm", async () => {
  process.env.NAFATH_PROVIDER = "elmm";
  try {
    assert.equal(nafath.nafathConfigured(), false);
    await assert.rejects(() => nafath.nafathRequest({ nationalId: "1000000001" }), /nafath_provider_unknown/);
  } finally { delete process.env.NAFATH_PROVIDER; }
});

test("provider: elm stays the explicit default and still refuses without its credentials", async () => {
  process.env.NAFATH_PROVIDER = "elm";
  try {
    assert.equal(nafath.nafathConfigured(), false);       // no NAFATH_APP_ID in this run
    await assert.rejects(() => nafath.nafathRequest({ nationalId: "1000000001" }), /nafath_not_configured|nafath_service_not_configured/);
  } finally { delete process.env.NAFATH_PROVIDER; }
});

/* ------------------------------------------------------------- national id -- */
test("nationalIdState: shape rules, and Arabic-Indic digits are read as digits", () => {
  const s = nafath.nationalIdState;
  assert.deepEqual(s("1000000001"), { ok: true, value: "1000000001" });
  assert.deepEqual(s("٢٠٠٠٠٠٠٠٠١"), { ok: true, value: "2000000001" });
  assert.deepEqual(s("۱۰۰۰۰۰۰۰۰۱"), { ok: true, value: "1000000001" });
  assert.equal(s("12345").reason, "must_be_10_digits");
  assert.equal(s("").reason, "must_be_10_digits");
  assert.equal(s("0000000001").reason, "bad_prefix");
  assert.equal(s("7000000001").reason, "bad_prefix");
  assert.equal(s("9000000001").reason, "unsupported_prefix_9");
});

test("the page's national-id check agrees with api/_nafath.js on every kind of input", () => {
  assert.equal(NATIONAL_ID_FIRST_DIGITS, nafath.NATIONAL_ID_FIRST_DIGITS);
  const ctx = { window: {}, navigator: { userAgent: "" }, document: {}, fetch() {}, setTimeout() {} };
  vm.createContext(ctx);
  vm.runInContext(clientLoginJs("ar"), ctx);
  const nid = ctx.window.SV1Login.nid;
  const samples = ["1000000001", "2123456789", "3000000000", "4000000000", "5000000000", "6000000000", "7000000000", "8000000000", "9000000000", "0000000000",
    "100000000", "10000000011", "", "abc", "1000 000 001", "١٠٠٠٠٠٠٠٠١", "٢٠٠٠٠٠٠٠٠١", "9١00000001", "1000-000-001"];
  for (const s of samples) {
    const a = nafath.nationalIdState(s), b = nid(s);
    assert.equal(b.ok, a.ok, `ok differs for ${JSON.stringify(s)}`);
    if (a.ok) assert.equal(b.value, a.value);
    else assert.equal(b.reason, a.reason, `reason differs for ${JSON.stringify(s)}`);
  }
});

/* ----------------------------------------------------- first Nafath sign-in -- */
test("first Nafath sign-in creates the account, keyed by the digest — the raw number is stored nowhere", async () => {
  const id = "1000000001";
  const { start, poll, cookie } = await nafathSignIn(id);
  assert.equal(start.status, 200);
  assert.match(start.json.random, /^[0-9]{2}$/, "the two-digit number to pick in the app");
  assert.equal(poll.json.status, "COMPLETED");
  assert.equal(poll.json.created, true);
  assert.equal(poll.json.needsContact, true);
  assert.equal(poll.json.email, "", "the placeholder address is never shown to the client");
  assert.ok(cookie, "a session cookie is set");

  const hash = nafath.nafathIdHash(id);
  const rows = (await dbRows("users")).filter((u) => u.nafath_id === hash);
  assert.equal(rows.length, 1, "one account for this identity");
  assert.equal(rows[0].email_verified_at ?? null, null, "a placeholder address is not a verified mailbox");
  assert.ok(nafath.isNafathPlaceholderEmail(rows[0].email));

  // The identity number itself: not in the database, not in any answer the browser saw.
  assert.ok(!dbText().includes(id), "the raw national id must not be stored");
  for (const r of [start, poll]) assert.ok(!JSON.stringify(r.json).includes(id), "the raw national id must not come back");
});

test("a returning Nafath sign-in lands on the same account — no duplicate", async () => {
  const id = "1000000003";
  const a = await nafathSignIn(id);
  const b = await nafathSignIn(id);
  assert.equal(b.poll.json.status, "COMPLETED");
  assert.equal(b.poll.json.created, undefined, "the second time it is not created again");
  assert.equal(b.poll.json.user.id, a.poll.json.user.id);
  const hash = nafath.nafathIdHash(id);
  assert.equal((await dbRows("users")).filter((u) => u.nafath_id === hash).length, 1);
});

test("rejected and expired requests end without opening anything", async () => {
  resetNafathThrottle();
  for (const [id, want] of [["1000000007", "REJECTED"], ["1000000008", "EXPIRED"]]) {
    resetNafathThrottle();
    const s = await otp({ action: "nafath-start", nationalId: id, purpose: "portal" });
    await sleep(650);
    const p = await otp({ action: "nafath-poll", challenge: s.json.challenge });
    assert.equal(p.json.status, want);
    assert.equal(p.cookie, "", "no session on a rejected or expired request");
  }
  const hash = nafath.nafathIdHash("1000000007");
  assert.equal((await dbRows("users")).filter((u) => u.nafath_id === hash).length, 0);
});

test("a number still waiting answers WAITING and opens nothing", async () => {
  resetNafathThrottle();
  const s = await otp({ action: "nafath-start", nationalId: "1000000009", purpose: "portal" });
  const p = await otp({ action: "nafath-poll", challenge: s.json.challenge });
  assert.equal(p.json.status, "WAITING");
  assert.equal(p.cookie, "");
});

test("nafath-start refuses a malformed id before any request is made", async () => {
  for (const [id, err] of [["123", "must_be_10_digits"], ["0123456789", "bad_prefix"], ["9123456789", "unsupported_prefix_9"]]) {
    const r = await otp({ action: "nafath-start", nationalId: id });
    assert.equal(r.status, 400);
    assert.equal(r.json.error, err);
  }
});

/* ------------------------------------------- the account is read-only until it is completed -- */
test("until the contact step is done, the account can look but not act", async () => {
  const { cookie } = await nafathSignIn("1000000004");
  const me = await simple({ action: "me" }, { cookie });
  assert.equal(me.status, 200);
  assert.equal(me.json.user.contactPending, true);
  assert.equal(me.json.user.email, "");
  const act = await simple({ action: "request-create", type: "CONSULTATION", title: "x" }, { cookie });
  assert.equal(act.status, 403);
  assert.equal(act.json.error, "contact_required");
  const pw = await otp({ action: "password-set", password: "Sturdy-pass-2026" }, { cookie });
  assert.equal(pw.status, 403, "a password needs a real mailbox to fall back on");
});

test("the placeholder address cannot be signed in to by e-mail", async () => {
  const { cookie } = await nafathSignIn("1000000005");
  const me = await who(cookie);
  assert.equal(me.email, "", "the session never shows the placeholder");
  assert.equal(me.contactPending, true);
  const email = (await dbRows("users")).find((u) => u.id === me.id).email;
  assert.ok(nafath.isNafathPlaceholderEmail(email));
  for (const action of ["start", "link-start", "password-signup-start"]) {
    const r = await otp({ action, email, password: "Sturdy-pass-2026" });
    assert.equal(r.status, 400, action);
    assert.equal(r.json.error, "invalid_email", action);
  }
});

/* ------------------------------------------------------------ contact step -- */
test("contact step: a fresh e-mail + mobile, proven by a code, completes the same account", async () => {
  const { cookie, poll } = await nafathSignIn("1000000010");
  const uid = poll.json.user.id;
  const bad = await otp({ action: "nafath-contact-start", email: "new.client@example.com", phone: "12" }, { cookie });
  assert.equal(bad.json.error, "invalid_phone");
  const badMail = await otp({ action: "nafath-contact-start", email: "nope", phone: "0551234567" }, { cookie });
  assert.equal(badMail.json.error, "invalid_email");

  const st = await otp({ action: "nafath-contact-start", email: "New.Client@example.com", phone: "٠٥٥١٢٣٤٥٦٧" }, { cookie });
  assert.equal(st.status, 200);
  assert.equal(st.json.phone, "+966551234567", "Saudi mobiles are stored in one form");
  assert.equal(st.json.testLogin, true);

  const wrong = await otp({ action: "nafath-contact-verify", code: "000000", challenge: st.json.challenge }, { cookie });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.json.error, "wrong_code");
  assert.equal((await who(cookie)).contactPending, true, "nothing changes on a wrong code");

  const ok = await otp({ action: "nafath-contact-verify", code: st.json.devCode, challenge: st.json.challenge }, { cookie });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.merged, false);
  const u = await who(cookie);
  assert.equal(u.id, uid, "the same account, now with a real address");
  assert.equal(u.email, "new.client@example.com");
  const row = (await dbRows("users")).find((r) => r.id === uid);
  assert.equal(row.phone, "+966551234567");
  assert.ok(row.email_verified_at, "the mailbox was proven by the code");

  const me = await simple({ action: "me" }, { cookie });
  assert.equal(me.json.user.contactPending, undefined);
  assert.equal(me.json.user.email, "new.client@example.com");
  const act = await simple({ action: "request-create", type: "CONSULTATION", title: "after contact" }, { cookie });
  assert.equal(act.status, 200, "the account may act once completed");

  // …and a later Nafath sign-in goes straight in.
  const again = await nafathSignIn("1000000010");
  assert.equal(again.poll.json.needsContact, false);
  assert.equal(again.poll.json.email, "new.client@example.com");
});

test("contact step: an e-mail that already has an account JOINS it instead of duplicating it", async () => {
  const existing = await emailAccount("already.here@example.com");
  const { cookie: nCookie, poll } = await nafathSignIn("1000000012");
  assert.notEqual(poll.json.user.id, existing.user.id);
  const st = await otp({ action: "nafath-contact-start", email: "already.here@example.com", phone: "0559876543" }, { cookie: nCookie });
  assert.equal(st.status, 200);
  assert.equal(st.json.merged, undefined, "the answer does not reveal that the address has an account");
  const ok = await otp({ action: "nafath-contact-verify", code: st.json.devCode, challenge: st.json.challenge }, { cookie: nCookie });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.merged, true);
  assert.equal(ok.json.user.id, existing.user.id, "the person continues as the account they already had");

  const hash = nafath.nafathIdHash("1000000012");
  const holders = (await dbRows("users")).filter((u) => u.nafath_id === hash);
  assert.equal(holders.length, 1);
  assert.equal(holders[0].id, existing.user.id);
  assert.equal(holders[0].phone, "+966559876543");

  // The throw-away session no longer works; the new cookie belongs to the existing account.
  assert.equal(await who(nCookie), undefined, "the placeholder session is revoked");
  const newCookie = rawCookie(ok.cookie);
  assert.equal((await who(newCookie)).email, "already.here@example.com");

  // Next time Nafath alone opens that account.
  const back = await nafathSignIn("1000000012");
  assert.equal(back.poll.json.user.id, existing.user.id);
  assert.equal(back.poll.json.needsContact, false);
});

test("contact step: an address tied to a DIFFERENT national id is refused", async () => {
  const a = await nafathSignIn("1000000013");
  const st1 = await otp({ action: "nafath-contact-start", email: "owner.of.13@example.com", phone: "0551111111" }, { cookie: a.cookie });
  await otp({ action: "nafath-contact-verify", code: st1.json.devCode, challenge: st1.json.challenge }, { cookie: a.cookie });

  const b = await nafathSignIn("1000000014");
  const st2 = await otp({ action: "nafath-contact-start", email: "owner.of.13@example.com", phone: "0552222222" }, { cookie: b.cookie });
  const ok = await otp({ action: "nafath-contact-verify", code: st2.json.devCode, challenge: st2.json.challenge }, { cookie: b.cookie });
  assert.equal(ok.status, 409);
  assert.equal(ok.json.error, "identity_mismatch");
  const hash13 = nafath.nafathIdHash("1000000013");
  assert.equal((await dbRows("users")).find((u) => u.email === "owner.of.13@example.com").nafath_id, hash13, "the first identity keeps its account");
});

test("contact step: challenges cannot be borrowed across sessions or purposes", async () => {
  const a = await nafathSignIn("1000000015");
  const b = await nafathSignIn("1000000016");
  const st = await otp({ action: "nafath-contact-start", email: "borrow@example.com", phone: "0553333333" }, { cookie: a.cookie });
  // B tries to finish A's step.
  const steal = await otp({ action: "nafath-contact-verify", code: st.json.devCode, challenge: st.json.challenge }, { cookie: b.cookie });
  assert.equal(steal.status, 400);
  assert.equal(steal.json.error, "invalid_challenge");
  // A's contact challenge is not a plain login code…
  const asLogin = await otp({ action: "verify", email: "borrow@example.com", code: st.json.devCode, challenge: st.json.challenge });
  assert.equal(asLogin.status, 400);
  // …and a plain login challenge is not a contact step.
  const plain = await otp({ action: "start", email: "borrow@example.com" });
  const asContact = await otp({ action: "nafath-contact-verify", code: plain.json.devCode, challenge: plain.json.challenge }, { cookie: a.cookie });
  assert.equal(asContact.status, 400);
  // No session at all: nothing to complete.
  const none = await otp({ action: "nafath-contact-start", email: "x@example.com", phone: "0551234567" });
  assert.equal(none.status, 401);
  // An account that already has a real address has nothing to complete.
  const real = await emailAccount("complete.already@example.com");
  const again = await otp({ action: "nafath-contact-start", email: "other@example.com", phone: "0551234567" }, { cookie: real.cookie });
  assert.equal(again.status, 409);
});

test("contact step: wrong codes are limited", async () => {
  const a = await nafathSignIn("1000000021");
  const st = await otp({ action: "nafath-contact-start", email: "limit@example.com", phone: "0554444444" }, { cookie: a.cookie });
  let last;
  for (let i = 0; i < 7; i++) last = await otp({ action: "nafath-contact-verify", code: "111111", challenge: st.json.challenge }, { cookie: a.cookie });
  assert.equal(last.status, 429);
  const right = await otp({ action: "nafath-contact-verify", code: st.json.devCode, challenge: st.json.challenge }, { cookie: a.cookie });
  assert.equal(right.status, 429, "even the right code waits once the limit is hit");
});

test("nafath-link still binds a verified identity to the signed-in account, taking it only from an unfinished one", async () => {
  const hash = nafath.nafathIdHash("1000000022");
  const placeholderOwner = await nafathSignIn("1000000022");
  assert.ok(placeholderOwner.cookie);
  const real = await emailAccount("linker@example.com");
  const link = nafath.nafathSeal({ t: "verified", hash, exp: Date.now() + 60000 });
  const r = await otp({ action: "nafath-link", link }, { cookie: real.cookie });
  assert.equal(r.status, 200);
  assert.equal((await dbRows("users")).filter((u) => u.nafath_id === hash)[0].id, real.user.id);
  // A real account's identity is not taken by another.
  const other = await emailAccount("thief@example.com");
  const r2 = await otp({ action: "nafath-link", link }, { cookie: other.cookie });
  assert.equal(r2.status, 409);
  assert.equal(r2.json.error, "identity_already_linked");
});

/* ------------------------------------------------------- password: sign-up -- */
test("password strength: the floor is enforced with a reason code", () => {
  const p = auth.passwordProblem;
  assert.equal(p("short1"), "short");
  assert.equal(p("x".repeat(129) + "1"), "long");
  assert.equal(p("12345678901"), "no_letter");
  assert.equal(p("abcdefghijk"), "no_digit");
  assert.equal(p("aaaa1111aaaa"), "repetitive");
  assert.equal(p("Password123"), "common");
  assert.equal(p("qwerty123"), "common");
  assert.equal(p("sara.alharbi2026!", "sara.alharbi@example.com"), "has_email");
  assert.equal(p("Sturdy-pass-2026", "a@example.com"), null);
  assert.equal(p("كلمةمرور٢٠٢٦قوية"), null, "letters and digits in any script");
});

test("password sign-up: weak passwords are refused before any mail is sent", async () => {
  for (const [pw, reason] of [["abc123", "short"], ["onlyletters", "no_digit"], ["Password123", "common"]]) {
    const r = await otp({ action: "password-signup-start", email: "weak@example.com", password: pw });
    assert.equal(r.status, 400);
    assert.equal(r.json.error, "weak");
    assert.equal(r.json.reason, reason);
  }
});

test("password sign-up: the password does nothing until the mailbox is proven", async () => {
  const email = "signup.one@example.com", pw = "Sturdy-pass-2026";
  const st = await otp({ action: "password-signup-start", email, password: pw });
  assert.equal(st.status, 200);
  assert.ok(!JSON.stringify(st.json).includes(pw), "the password is never echoed");
  assert.ok(!JSON.stringify(st.json).includes("scrypt"));

  // Before the code: no account, no password, no way in.
  assert.equal((await otp({ action: "password-login", email, password: pw })).status, 401);
  assert.equal((await dbRows("users")).filter((u) => u.email === email).length, 0);

  const wrong = await otp({ action: "password-signup-verify", email, code: "000000", challenge: st.json.challenge });
  assert.equal(wrong.status, 401);
  assert.equal((await otp({ action: "password-login", email, password: pw })).status, 401);

  const ok = await otp({ action: "password-signup-verify", email, code: st.json.devCode, challenge: st.json.challenge });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.passwordSet, true);
  assert.equal((await who(rawCookie(ok.cookie))).email, email);

  // After the code the password is a second door to the same account.
  const login = await otp({ action: "password-login", email, password: pw });
  assert.equal(login.status, 200);
  assert.equal(login.json.user.id, ok.json.user.id);
  assert.equal((await otp({ action: "password-login", email, password: pw + "x" })).status, 401);
  const stored = (await dbRows("users")).find((u) => u.email === email).password_hash;
  assert.match(stored, /^[0-9a-f]{32}:[0-9a-f]{128}$/, "salted scrypt, never the password");
});

test("password sign-up: a challenge is bound to its purpose, address and code", async () => {
  const st = await otp({ action: "password-signup-start", email: "bind.a@example.com", password: "Sturdy-pass-2026" });
  // not usable as a plain login code
  const asLogin = await otp({ action: "verify", email: "bind.a@example.com", code: st.json.devCode, challenge: st.json.challenge });
  assert.equal(asLogin.status, 400);
  // not usable for another address
  const other = await otp({ action: "password-signup-verify", email: "bind.b@example.com", code: st.json.devCode, challenge: st.json.challenge });
  assert.equal(other.status, 400);
  // a plain login challenge cannot set a password
  const plain = await otp({ action: "start", email: "bind.a@example.com" });
  const forged = await otp({ action: "password-signup-verify", email: "bind.a@example.com", code: plain.json.devCode, challenge: plain.json.challenge });
  assert.equal(forged.status, 400);
});

test("password sign-up: wrong codes are limited per address", async () => {
  const email = "signup.limit@example.com";
  const st = await otp({ action: "password-signup-start", email, password: "Sturdy-pass-2026" });
  let last;
  for (let i = 0; i < 7; i++) last = await otp({ action: "password-signup-verify", email, code: "111111", challenge: st.json.challenge });
  assert.equal(last.status, 429);
});

test("password sign-up: code e-mails per address are limited", async () => {
  const email = "signup.flood@example.com";
  let last;
  for (let i = 0; i < 6; i++) last = await otp({ action: "password-signup-start", email, password: "Sturdy-pass-2026" });
  assert.equal(last.status, 429);
});

test("an existing account that forgot its password can set a new one through the same proof", async () => {
  const email = "forgot.pw@example.com";
  const a = await emailAccount(email);
  assert.ok(a.cookie);
  const st = await otp({ action: "password-signup-start", email, password: "Another-pass-77" });
  const ok = await otp({ action: "password-signup-verify", email, code: st.json.devCode, challenge: st.json.challenge });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.user.id, a.user.id, "same account, not a second one");
  assert.equal((await otp({ action: "password-login", email, password: "Another-pass-77" })).status, 200);
});

/* --------------------------------------------------- password: sign-in limits -- */
test("password-login: wrong passwords are limited per address, and per source address across addresses", async () => {
  const email = "limit.login@example.com";
  const a = await emailAccount(email);
  await otp({ action: "password-set", password: "Sturdy-pass-2026" }, { cookie: a.cookie });
  let r;
  for (let i = 0; i < 9; i++) r = await otp({ action: "password-login", email, password: "wrong-" + i }, { ip: "203.0.113.9" });
  assert.equal(r.status, 429, "the ninth wrong attempt on one address is refused");
  const good = await otp({ action: "password-login", email, password: "Sturdy-pass-2026" }, { ip: "203.0.113.10" });
  assert.equal(good.status, 429, "locked for the address even with the right password, until the window passes");

  // One source trying many different accounts.
  let spray;
  for (let i = 0; i < 32; i++) spray = await otp({ action: "password-login", email: `spray${i}@example.com`, password: "guess-" + i }, { ip: "203.0.113.77" });
  assert.equal(spray.status, 429);
});

test("password-set: the same strength floor applies to a signed-in change", async () => {
  const a = await emailAccount("setpw.floor@example.com");
  const weak = await otp({ action: "password-set", password: "abcdefgh" }, { cookie: a.cookie });
  assert.equal(weak.status, 400);
  assert.equal(weak.json.reason, "no_digit");
  assert.equal((await otp({ action: "password-set", password: "Sturdy-pass-2026" }, { cookie: a.cookie })).status, 200);
});

/* -------------------------------------------------------------- code attempts -- */
test("the plain e-mailed code is rate-limited too (it has only a million values)", async () => {
  const email = "code.brute@example.com";
  const st = await otp({ action: "start", email });
  let last;
  for (let i = 0; i < 7; i++) last = await otp({ action: "verify", email, code: "999999", challenge: st.json.challenge });
  assert.equal(last.status, 429);
});

/* ---------------------------------------------------------------- methods -- */
test("methods advertises every door, Nafath first with its availability", async () => {
  const m = await otp({ action: "methods" });
  assert.equal(m.json.ok, true);
  assert.equal(m.json.nafath.available, true);
  assert.equal(m.json.password, true);
  assert.equal(m.json.passwordSignup, true);
  assert.equal(m.json.code, true);
  assert.equal(m.json.link, true);
  assert.ok(Object.keys(m.json).indexOf("nafath") >= 0);
});

test("phone numbers normalise to one form, and nonsense is refused", () => {
  const n = auth.normalizePhone;
  for (const s of ["0551234567", "551234567", "966551234567", "+966551234567", "00966551234567", "٠٥٥١٢٣٤٥٦٧", "055 123 4567", "055-123-4567"]) {
    assert.deepEqual(n(s), { ok: true, value: "+966551234567" }, s);
  }
  assert.deepEqual(n("+447911123456"), { ok: true, value: "+447911123456" });
  for (const s of ["", "12345", "0451234567", "+96641234567", "abc", "+0123456789"]) assert.equal(n(s).ok, false, s);
});

test("no secret or key reaches the logs of these flows", async () => {
  const seen = [];
  const keep = { log: console.log, warn: console.warn, error: console.error };
  console.log = console.warn = console.error = (...a) => seen.push(a.join(" "));
  try {
    const { cookie } = await nafathSignIn("1000000019");
    const st = await otp({ action: "nafath-contact-start", email: "logs@example.com", phone: "0555555555" }, { cookie });
    await otp({ action: "nafath-contact-verify", code: st.json.devCode, challenge: st.json.challenge }, { cookie });
    await otp({ action: "password-signup-start", email: "logs2@example.com", password: "Sturdy-pass-2026" });
  } finally { Object.assign(console, keep); }
  const text = seen.join("\n");
  for (const secret of ["1000000019", process.env.OTP_SECRET, "Sturdy-pass-2026", nafath.nafathIdHash("1000000019")]) {
    assert.ok(!text.includes(secret), "a secret or identifier leaked into the logs");
  }
  void createHash; void otpHandler;
});
