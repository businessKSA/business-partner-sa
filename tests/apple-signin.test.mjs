// Sign in with Apple: التحقق من رمز الهوية (RS256) دون شبكة — مفتاح مولَّد محلياً وfetch مُستبدَل.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifyAppleIdToken } from "../api/_suppliers.js";

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "test-kid", alg: "RS256", use: "sig" };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const AUD = "sa.businesspartner.app";

function token(claims = {}, { kid = "test-kid", key = privateKey, alg = "RS256" } = {}) {
  const h = b64({ alg, kid });
  const p = b64({ iss: "https://appleid.apple.com", aud: AUD, sub: "001.abc", email: "Person@Example.com", email_verified: "true", exp: Math.floor(Date.now() / 1000) + 600, ...claims });
  const sig = crypto.createSign("RSA-SHA256").update(h + "." + p).sign(key).toString("base64url");
  return `${h}.${p}.${sig}`;
}
const realFetch = globalThis.fetch;
test.before(() => { globalThis.fetch = async () => ({ ok: true, json: async () => ({ keys: [jwk] }) }); });
test.after(() => { globalThis.fetch = realFetch; });
const v = (t, aud = [AUD]) => verifyAppleIdToken(t, { audiences: aud });

test("apple: رمز صحيح يُقبل والبريد يُصغَّر", async () => {
  const r = await v(token());
  assert.equal(r.email, "person@example.com");
  assert.equal(r.sub, "001.abc");
});
test("apple: بلا audience مضبوط لا يُقبل شيء", async () => { assert.equal(await v(token(), []), null); });
test("apple: audience آخر مرفوض", async () => { assert.equal(await v(token({ aud: "other.app" })), null); });
test("apple: issuer خاطئ مرفوض", async () => { assert.equal(await v(token({ iss: "https://evil.example" })), null); });
test("apple: رمز منتهٍ مرفوض", async () => { assert.equal(await v(token({ exp: 1 })), null); });
test("apple: بلا بريد مرفوض", async () => { assert.equal(await v(token({ email: undefined })), null); });
test("apple: email_verified=false مرفوض", async () => { assert.equal(await v(token({ email_verified: "false" })), null); });
test("apple: توقيع بمفتاح آخر مرفوض", async () => {
  const other = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
  assert.equal(await v(token({}, { key: other })), null);
});
test("apple: kid غير موجود في مفاتيح آبل مرفوض", async () => { assert.equal(await v(token({}, { kid: "nope" })), null); });
test("apple: خوارزمية غير RS256 (alg=none) مرفوضة", async () => {
  const h = b64({ alg: "none", kid: "test-kid" }), p = b64({ iss: "https://appleid.apple.com", aud: AUD, email: "a@b.co", exp: 9999999999 });
  assert.equal(await v(`${h}.${p}.`), null);
});
test("apple: رمز مشوَّه مرفوض", async () => { assert.equal(await v("not.a.jwt"), null); assert.equal(await v(""), null); });
