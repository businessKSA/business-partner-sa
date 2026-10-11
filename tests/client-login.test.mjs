// بابُ دخول العميل: «المتابعة بجوجل» و«رابط الدخول بالبريد» (api/otp.js) — على قاعدة محلية
// وبلا شبكة، وبمفتاح Google وهمي يُوقَّع به رمز الهوية فيمرّ عبر مسار التحقق الحقيقي كلّه.
//
// ما يُثبته هذا الملف:
//   ١) Google: رمزٌ صحيح يفتح جلسة؛ ورمزٌ لعميل OAuth آخر، أو منتهٍ، أو بتوقيع مزوَّر، أو
//      بريده غير موثَّق، لا يفتح شيئاً.
//   ٢) الرابط: يُرسَل بالبريد (صندوق الصادر محلياً)، لا يُدخِل بمجرد فتحه، يُستهلك مرة واحدة،
//      ينتهي بعد خمس عشرة دقيقة، ولا يُقبل رمز OTP مكانه ولا هو مكان رمز OTP.
//   ٣) الأمان: الرابط يُبنى من نطاقنا لا من ترويسة المُرسِل، و`next` مسارٌ محلي فقط، وتُخنق
//      الطلبات المتكررة على بريدٍ واحد.
//   ٤) الصفحات المبنية: /my تحمل الباب الجديد بأربع لغات، وزرّ «دخول» في قائمة الجوال.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

process.env.APP_ENV = "development";
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "client-login-"));
process.env.OTP_SECRET = "test-otp-secret-for-client-login-0123456789";
process.env.GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com";
for (const k of ["RESEND_API_KEY", "RESEND_KEY"]) delete process.env[k];

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");

// ---- Google's JWKS, answered locally ----------------------------------------
const kp = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const other = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const KID = "k1";
const jwk = { ...kp.publicKey.export({ format: "jwk" }), kid: KID, alg: "RS256", use: "sig" };
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith("https://www.googleapis.com/oauth2/v3/certs")) {
    return new Response(JSON.stringify({ keys: [jwk] }), { status: 200, headers: { "content-type": "application/json" } });
  }
  throw new Error("a local run must not reach the network: " + url);
};
void realFetch;

function idToken({ email = "g@example.com", aud = process.env.GOOGLE_CLIENT_ID, exp = Math.floor(Date.now() / 1000) + 600, verified = true, key = kp.privateKey, iss = "accounts.google.com" } = {}) {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const h = b({ alg: "RS256", kid: KID, typ: "JWT" });
  const p = b({ iss, aud, email, email_verified: verified, name: "G Tester", exp });
  const sig = crypto.createSign("RSA-SHA256").update(h + "." + p).sign(key).toString("base64url");
  return h + "." + p + "." + sig;
}

const { default: handler } = await import("../api/otp.js");
const { outboxList } = await import("../api/_mode.js");

function call(body, { headers = {} } = {}) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200, headers: {},
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      end(s) { let json = null; try { json = JSON.parse(s); } catch {} resolve({ status: this.statusCode, json, cookie: this.headers["set-cookie"] || "" }); },
    };
    // each call comes from its own address, so the per-IP throttle only trips where a test asks it to
    handler({ method: "POST", headers: { host: "localhost:3000", "x-forwarded-for": `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`, ...headers }, body }, res);
  });
}
const rawCookie = (c) => (/bp_sid=([^;]+)/.exec(c) || [])[1] || "";
async function who(cookie) {
  const r = await call({ action: "me" }, { headers: { cookie: "bp_sid=" + cookie } });
  return r.json && r.json.session && r.json.session.user;
}
function fragmentToken(link) { return decodeURIComponent((/#ml=([^&]+)/.exec(link) || [])[1] || ""); }

// ---- methods ----------------------------------------------------------------
test("methods offers Google, the e-mail link and the code together", async () => {
  const r = await call({ action: "methods" });
  assert.equal(r.status, 200);
  assert.equal(r.json.google, true);
  assert.equal(r.json.googleClientId, process.env.GOOGLE_CLIENT_ID);
  assert.equal(r.json.link, true);
  assert.equal(r.json.code, true);
});

// ---- Google ------------------------------------------------------------------
test("google: a valid ID token opens a real session for that e-mail", async () => {
  const r = await call({ action: "google", credential: idToken({ email: "Valid.User@Example.com" }) });
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  assert.equal(r.json.db, true);
  assert.equal(r.json.email, "valid.user@example.com");
  assert.ok(/HttpOnly/.test(r.cookie) && /Secure/.test(r.cookie));
  const u = await who(rawCookie(r.cookie));
  assert.equal(u && u.email, "valid.user@example.com");
});

for (const [name, opts] of [
  ["another OAuth client id (token minted for someone else's app)", { aud: "someone-else.apps.googleusercontent.com" }],
  ["an expired token", { exp: Math.floor(Date.now() / 1000) - 5 }],
  ["an address Google has not verified", { verified: false }],
  ["a signature made with a different key", { key: other.privateKey }],
  ["a wrong issuer", { iss: "https://evil.example" }],
]) {
  test(`google: refuses ${name}`, async () => {
    const r = await call({ action: "google", credential: idToken(opts) });
    assert.equal(r.status, 401);
    assert.equal(r.json.ok, false);
    assert.equal(r.cookie, "");
  });
}
test("google: refuses an empty or malformed credential", async () => {
  for (const credential of ["", "abc", "a.b.c", undefined]) {
    const r = await call({ action: "google", credential });
    assert.equal(r.status, 401);
    assert.equal(r.cookie, "");
  }
});

// ---- link-start ----------------------------------------------------------------
test("link-start: needs a real address", async () => {
  const r = await call({ action: "link-start", email: "nope" });
  assert.equal(r.status, 400);
});

test("link-start: parks the mail in the outbox, returns the link and a code challenge, sends nothing", async () => {
  const r = await call({ action: "link-start", email: "sendcheck@example.com", lang: "en" });
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  assert.ok(r.json.challenge);
  assert.ok(r.json.devLink.startsWith("http://localhost:3000/my#ml="), r.json.devLink);
  const box = await outboxList(20);
  const m = box.find((x) => x.to === "sendcheck@example.com");
  assert.ok(m, "the mail must be recorded in the outbox");
  assert.ok(m.body.includes("#ml="));
});

test("link-start: the link per language lands on that language's /my", async () => {
  for (const [lang, prefix] of [["ar", "/ar/my"], ["en", "/my"], ["fr", "/fr/my"], ["zh", "/zh/my"], ["xx", "/ar/my"]]) {
    const r = await call({ action: "link-start", email: `lang-${lang}@example.com`, lang });
    assert.ok(r.json.devLink.includes("localhost:3000" + prefix + "#ml=") || r.json.devLink.includes("localhost:3000" + prefix + "?"), `${lang}: ${r.json.devLink}`);
  }
});

test("link-start: next is a local path only — absolute and protocol-relative URLs are dropped", async () => {
  const good = await call({ action: "link-start", email: "next1@example.com", lang: "ar", next: "/ar/checkout" });
  assert.ok(good.json.devLink.includes("?next=%2Far%2Fcheckout#ml="), good.json.devLink);
  for (const evil of ["//evil.example/x", "https://evil.example", "/\\evil.example", "/ar/../x", "javascript:alert(1)", "/a b", "x".repeat(400)]) {
    const r = await call({ action: "link-start", email: `evil-${crypto.randomUUID()}@example.com`, lang: "ar", next: evil });
    assert.ok(!/next=/.test(r.json.devLink), `${evil} must be dropped: ${r.json.devLink}`);
  }
});

test("link-start: the link is built from our origin, never from a caller-controlled Host", async () => {
  const r = await call({ action: "link-start", email: "hostpoison@example.com", lang: "ar" }, { headers: { host: "evil.example", "x-forwarded-host": "evil.example" } });
  assert.ok(r.json.devLink.startsWith("https://www.businesspartner.sa/ar/my#ml="), r.json.devLink);
  const real = await call({ action: "link-start", email: "hostreal@example.com", lang: "ar" }, { headers: { host: "businesspartner.sa" } });
  assert.ok(real.json.devLink.startsWith("https://www.businesspartner.sa/ar/my#ml="), real.json.devLink);
});

test("link-start: one address cannot be flooded with mail", async () => {
  const statuses = [];
  for (let i = 0; i < 6; i++) statuses.push((await call({ action: "link-start", email: "flood@example.com", lang: "ar" })).status);
  assert.deepEqual(statuses.slice(0, 4), [200, 200, 200, 200]);
  assert.equal(statuses[4], 429);
  assert.equal(statuses[5], 429);
});

test("link-start (production path): exactly one mail through Resend, link + code inside, nothing leaked in the answer", async () => {
  const sent = [];
  const prevFetch = globalThis.fetch, prevEnv = { a: process.env.APP_ENV, r: process.env.RESEND_API_KEY, t: process.env.SIMPLE_TEST_MODE };
  process.env.APP_ENV = "production"; process.env.RESEND_API_KEY = "re_test"; delete process.env.SIMPLE_TEST_MODE;
  globalThis.fetch = async (url, init) => {
    if (String(url) === "https://api.resend.com/emails") { sent.push(JSON.parse(init.body)); return new Response("{}", { status: 200 }); }
    return prevFetch(url, init);
  };
  try {
    const { default: prod } = await import("../api/otp.js?production");
    const out = await new Promise((resolve) => {
      const res = { statusCode: 200, headers: {}, setHeader() {}, end(s) { resolve({ status: this.statusCode, json: JSON.parse(s) }); } };
      prod({ method: "POST", headers: { host: "www.businesspartner.sa", "x-forwarded-for": "10.9.9.9" }, body: { action: "link-start", email: "Real.Client@Example.com", lang: "ar", next: "/ar/checkout" } }, res);
    });
    assert.equal(out.status, 200);
    assert.equal(out.json.linkSent, true);
    assert.equal(out.json.devLink, undefined, "the link must reach the mailbox only");
    assert.equal(out.json.devCode, undefined, "the code must reach the mailbox only");
    assert.equal(out.json.to, "r***t@example.com", "the address is echoed masked");
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].to, ["real.client@example.com"]);
    assert.ok(sent[0].html.includes("https://www.businesspartner.sa/ar/my?next=%2Far%2Fcheckout#ml="), "the mail carries the link");
    assert.ok(/letter-spacing:8px[^>]*>\d{6}</.test(sent[0].html), "and the six-digit fallback code");
    assert.ok(/[\u0600-\u06FF]/.test(sent[0].subject), "Arabic subject for ar");
  } finally {
    globalThis.fetch = prevFetch;
    process.env.APP_ENV = prevEnv.a; if (prevEnv.r === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = prevEnv.r;
    if (prevEnv.t !== undefined) process.env.SIMPLE_TEST_MODE = prevEnv.t;
  }
});

test("link-start (production path): a mail failure says so and leaks no link", async () => {
  const prevFetch = globalThis.fetch, prevEnv = { a: process.env.APP_ENV, r: process.env.RESEND_API_KEY };
  process.env.APP_ENV = "production"; process.env.RESEND_API_KEY = "re_test";
  globalThis.fetch = async (url, init) => (String(url) === "https://api.resend.com/emails" ? new Response("nope", { status: 500 }) : prevFetch(url, init));
  try {
    const { default: prod } = await import("../api/otp.js?production");
    const out = await new Promise((resolve) => {
      const res = { statusCode: 200, headers: {}, setHeader() {}, end(s) { resolve({ status: this.statusCode, json: JSON.parse(s) }); } };
      prod({ method: "POST", headers: { host: "www.businesspartner.sa", "x-forwarded-for": "10.9.9.8" }, body: { action: "link-start", email: "fail@example.com", lang: "en" } }, res);
    });
    assert.equal(out.status, 503);
    assert.equal(out.json.ok, false);
    assert.equal(out.json.devLink, undefined);
    assert.equal(out.json.challenge, undefined, "no challenge for a mail that never left");
  } finally {
    globalThis.fetch = prevFetch;
    process.env.APP_ENV = prevEnv.a; if (prevEnv.r === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = prevEnv.r;
  }
});

// ---- link-verify -----------------------------------------------------------------
test("link-verify: the token opens a session for the address it was sent to, once", async () => {
  const start = await call({ action: "link-start", email: "once@example.com", lang: "ar" });
  const token = fragmentToken(start.json.devLink);
  const first = await call({ action: "link-verify", token });
  assert.equal(first.status, 200);
  assert.equal(first.json.ok, true);
  assert.equal(first.json.email, "once@example.com");
  assert.equal((await who(rawCookie(first.cookie))).email, "once@example.com");
  const replay = await call({ action: "link-verify", token });
  assert.equal(replay.status, 409);
  assert.equal(replay.json.error, "link_used");
  assert.equal(replay.cookie, "");
});

test("link-verify: the pre-revoked marker row can never act as a session", async () => {
  const start = await call({ action: "link-start", email: "marker@example.com", lang: "ar" });
  const token = fragmentToken(start.json.devLink);
  await call({ action: "link-verify", token });
  const { sb, sha256 } = await import("../api/_db.js");
  // the burn marker is hashed from the token id, so it is not any cookie value a browser could send
  const rows = await sb("user_sessions?select=token_hash,revoked_at");
  const markers = rows.filter((r) => r.revoked_at);
  assert.ok(markers.length >= 1, "a used link leaves a revoked marker");
  for (const m of markers) {
    const u = await call({ action: "me" }, { headers: { cookie: "bp_sid=" + m.token_hash } });
    assert.ok(!(u.json && u.json.session), "a marker hash must not authenticate");
  }
  void sha256;
});

test("link-verify: refuses garbage, an OTP challenge, and a token past its lifetime", async () => {
  for (const token of ["", "abc", "x".repeat(80), undefined]) {
    const r = await call({ action: "link-verify", token });
    assert.equal(r.status, 400);
    assert.equal(r.cookie, "");
  }
  // an OTP challenge is sealed under another key: it must not pass for a link
  const s = await call({ action: "start", email: "swap@example.com" });
  const asLink = await call({ action: "link-verify", token: s.json.challenge });
  assert.equal(asLink.status, 400);
  // …and a link must not pass for a challenge
  const l = await call({ action: "link-start", email: "swap2@example.com", lang: "ar" });
  const asChallenge = await call({ action: "verify", email: "swap2@example.com", code: "undefined", challenge: fragmentToken(l.json.devLink) });
  assert.notEqual(asChallenge.status, 200);
  assert.equal(asChallenge.cookie, "");
  // lifetime: sixteen minutes later the same token is dead
  const fresh = await call({ action: "link-start", email: "late@example.com", lang: "ar" });
  const realNow = Date.now;
  Date.now = () => realNow() + 16 * 60 * 1000;
  try {
    const late = await call({ action: "link-verify", token: fragmentToken(fresh.json.devLink) });
    assert.equal(late.status, 400);
    assert.equal(late.json.error, "expired");
  } finally { Date.now = realNow; }
});

test("link-start: the code that travels with the link still signs in through `verify`", async () => {
  const r = await call({ action: "link-start", email: "codepath@example.com", lang: "ar" });
  const ok = await call({ action: "verify", email: "codepath@example.com", code: r.json.devCode, challenge: r.json.challenge });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.ok, true);
  const bad = await call({ action: "verify", email: "codepath@example.com", code: "000000", challenge: r.json.challenge });
  assert.equal(bad.status, 401);
});

// ---- the built pages -----------------------------------------------------------------
const SITE = new URL("../site/", import.meta.url).pathname;
for (const [file, lang] of [["ar/my.html", "ar"], ["my.html", "en"], ["fr/my.html", "fr"], ["zh/my.html", "zh"]]) {
  test(`/my (${lang}): Google first, e-mail link, link landing — and the patched success path survives`, { skip: !fs.existsSync(SITE + file) }, () => {
    const html = fs.readFileSync(SITE + file, "utf8");
    assert.ok(html.includes("window.SV1Login") && html.includes("accounts.google.com/gsi/client"));
    assert.ok(html.includes("action:'link-start'") && html.includes("action:'link-verify'"));
    // Google is mounted before the e-mail field is appended
    assert.ok(html.indexOf("box.appendChild(gslot)") < html.indexOf("box.appendChild(s1)"));
    // the quote-flow patcher still found its sequence: success reloads instead of calling boot() in the same turn
    assert.ok(html.includes("location.replace(location.href)"));
    assert.ok(!html.includes("var gwrap=h('div',{class:'gbtn'"), "the old bottom-of-card Google wrapper is gone");
  });
}
test("header: the mobile menu carries «دخول» and the desktop button stays", { skip: !fs.existsSync(SITE + "ar/index.html") }, () => {
  const html = fs.readFileSync(SITE + "ar/index.html", "utf8");
  assert.ok(html.includes('id="sv1NavLogin"'));
  assert.ok(html.includes('id="sv1LoginBtn"'));
  assert.ok(html.includes("g('sv1NavLogin')"));
});
test("/checkout: a guest gets Google inline", { skip: !fs.existsSync(SITE + "ar/checkout.html") }, () => {
  const html = fs.readFileSync(SITE + "ar/checkout.html", "utf8");
  assert.ok(html.includes("function guestGoogle()") && html.includes("window.SV1Login"));
});
