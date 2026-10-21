// The production DocuSign path used to die as a bare "fetch failed": with no
// DOCUSIGN_BASE_URI the base defaulted to na1.docusign.net, a host that does not
// resolve. The base now comes from /oauth/userinfo, and every transport
// failure names its stage, host and kind without printing an identifier.
import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const ACCT = "11111111-2222-4333-8444-555555555555";
const USER = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const IKEY = "99999999-8888-4777-8666-555555555555";

let n = 0;
async function load(env) {
  for (const k of ["DOCUSIGN_ENV", "DOCUSIGN_BASE_URI"]) delete process.env[k];
  Object.assign(process.env, {
    DOCUSIGN_ACCOUNT_ID: ACCT, DOCUSIGN_USER_ID: USER, DOCUSIGN_INTEGRATION_KEY: IKEY, DOCUSIGN_PRIVATE_KEY: privateKey, ...env,
  });
  return import(`../api/_docusign.js?case=${++n}`);   // module reads env at import
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const netErr = (code) => Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error(`getaddrinfo ${code} host`), { code }) });

function mockFetch(routes) {
  const calls = [];
  globalThis.fetch = async (url) => {
    const u = new URL(String(url));
    calls.push(u.host + u.pathname);
    for (const [pat, h] of routes) if (pat.test(u.host + u.pathname)) return typeof h === "function" ? h(u) : h;
    throw netErr("ENOTFOUND");
  };
  return calls;
}
const realFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = realFetch; });

test("production: API base is discovered from /oauth/userinfo, not guessed", async () => {
  const m = await load({ DOCUSIGN_ENV: "production" });
  const calls = mockFetch([
    [/^account\.docusign\.com\/oauth\/token/, json({ access_token: "t", expires_in: 3600 })],
    [/^account\.docusign\.com\/oauth\/userinfo/, json({ accounts: [
      { account_id: "ffffffff-0000-4000-8000-000000000000", base_uri: "https://na2.docusign.net" },
      { account_id: ACCT, base_uri: "https://na4.docusign.net" }] })],
    [/^na4\.docusign\.net\/restapi\/v2\.1\/accounts\//, json({ accountName: "Business Partner" })],
  ]);
  const out = await m.docusignPing();
  assert.equal(out.ok, true);
  assert.equal(out.env, "production");
  assert.equal(out.baseHost, "na4.docusign.net");
  assert.equal(out.baseSource, "userinfo");
  assert.ok(calls.every((c) => !c.startsWith("na1.") && !c.startsWith("demo.")), calls.join());
  assert.ok(!JSON.stringify(out).includes(ACCT), "account id must be masked");
  assert.equal(out.accountId, "…5555");
});

test("production: an explicit DOCUSIGN_BASE_URI wins and skips userinfo", async () => {
  const m = await load({ DOCUSIGN_ENV: " Production ", DOCUSIGN_BASE_URI: "na4.docusign.net/" });
  const calls = mockFetch([
    [/^account\.docusign\.com\/oauth\/token/, json({ access_token: "t" })],
    [/^na4\.docusign\.net\/restapi\//, json({ accountName: "BP" })],
  ]);
  const out = await m.docusignPing();
  assert.equal(out.ok, true);
  assert.equal(out.baseSource, "env");
  assert.ok(!calls.some((c) => c.includes("userinfo")));
});

test("demo path still talks to account-d and demo.docusign.net", async () => {
  const m = await load({});
  const calls = mockFetch([
    [/^account-d\.docusign\.com\/oauth\/token/, json({ access_token: "t" })],
    [/^account-d\.docusign\.com\/oauth\/userinfo/, json({ accounts: [{ account_id: ACCT, base_uri: "https://demo.docusign.net" }] })],
    [/^demo\.docusign\.net\/restapi\//, json({ accountName: "Demo" })],
  ]);
  const out = await m.docusignPing();
  assert.equal(out.ok, true);
  assert.equal(out.env, "demo");
  assert.equal(out.baseHost, "demo.docusign.net");
  assert.ok(calls[0].startsWith("account-d.docusign.com"));
});

test("an unresolvable host is reported as stage + host + dns, with no identifiers", async () => {
  const m = await load({ DOCUSIGN_ENV: "production", DOCUSIGN_BASE_URI: "https://na1.docusign.net" });
  mockFetch([[/^account\.docusign\.com\/oauth\/token/, json({ access_token: "t" })]]);
  const out = await m.docusignPing();
  assert.equal(out.ok, false);
  assert.equal(out.error, "docusign_network");
  assert.equal(out.stage, "api");
  assert.equal(out.host, "na1.docusign.net");
  assert.equal(out.netKind, "dns");
  assert.match(out.detail, /ENOTFOUND/);
  assert.ok(!out.detail.includes(ACCT));
});

test("OAuth failures surface DocuSign's error and description, GUIDs masked", async () => {
  const m = await load({ DOCUSIGN_ENV: "production" });
  mockFetch([[/^account\.docusign\.com\/oauth\/token/, json({ error: "invalid_grant", error_description: `no_valid_keys_or_signatures for ${IKEY}` }, 400)]]);
  const out = await m.docusignPing();
  assert.equal(out.error, "docusign_auth_failed");
  assert.equal(out.stage, "oauth_token");
  assert.equal(out.host, "account.docusign.com");
  assert.match(out.detail, /invalid_grant/);
  assert.ok(!out.detail.includes(IKEY));
});

test("consent_required still returns the consent link", async () => {
  const m = await load({ DOCUSIGN_ENV: "production" });
  mockFetch([[/^account\.docusign\.com\/oauth\/token/, json({ error: "consent_required" }, 400)]]);
  const out = await m.docusignPing();
  assert.equal(out.error, "docusign_consent_required");
  assert.match(out.consentUrl, /^https:\/\/account\.docusign\.com\/oauth\/auth\?/);
});

test("production refuses to guess a host when userinfo is unreachable", async () => {
  const m = await load({ DOCUSIGN_ENV: "production" });
  mockFetch([[/^account\.docusign\.com\/oauth\/token/, json({ access_token: "t" })]]);
  const out = await m.docusignPing();
  assert.equal(out.ok, false);
  assert.equal(out.stage, "userinfo");
  assert.equal(out.host, "account.docusign.com");
});

test("a user who does not own the configured account is told so, ids masked", async () => {
  const m = await load({ DOCUSIGN_ENV: "production" });
  mockFetch([
    [/^account\.docusign\.com\/oauth\/token/, json({ access_token: "t" })],
    [/userinfo/, json({ accounts: [{ account_id: "ffffffff-0000-4000-8000-000000000000", base_uri: "https://na2.docusign.net" }] })],
  ]);
  const out = await m.docusignPing();
  assert.equal(out.error, "docusign_account_not_found");
  assert.ok(!out.detail.includes("ffffffff-0000"));
});
