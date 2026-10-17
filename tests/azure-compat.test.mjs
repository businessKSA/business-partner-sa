// غلاف توافق Vercel (vercel-compat.mjs) والمهام المجدولة (cron.mjs): وحدات بلا شبكة.
import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { parseBody, parseCookies, clientIp, toVercelRequest, collectBody, HttpError, MAX_BODY_BYTES } from "../ops/azure/vercel-compat.mjs";
import { cronJobs, runCron, slugOf } from "../ops/azure/cron.mjs";

test("parseBody follows the content-type rules the api/ handlers were written against", () => {
  const b = (s) => Buffer.from(s);
  assert.deepEqual(parseBody(b('{"a":1}'), "application/json; charset=utf-8"), { a: 1 });
  assert.deepEqual(parseBody(b('{"a":1}'), "application/vnd.api+json"), { a: 1 });
  assert.equal(parseBody(b("{nope"), "application/json"), "{nope");
  assert.deepEqual(parseBody(b("a=1&a=2&b=%D8%B3"), "application/x-www-form-urlencoded"), { a: ["1", "2"], b: "س" });
  assert.equal(parseBody(b("hi"), "text/plain"), "hi");
  assert.ok(Buffer.isBuffer(parseBody(b("hi"), "application/pdf")));
  assert.equal(parseBody(Buffer.alloc(0), "application/json"), undefined);
  assert.equal(parseBody(undefined, "application/json"), undefined);
});

test("parseCookies tolerates quotes, bad percent-encoding and duplicates (first wins)", () => {
  assert.deepEqual(parseCookies('a=1; b="two"; c=%E0%A4%A; a=9; =x; d'), { a: "1", b: "two", c: "%E0%A4%A" });
  assert.deepEqual(parseCookies(undefined), {});
});

test("clientIp: rightmost-N of X-Forwarded-For, never the client-supplied first entry", () => {
  assert.equal(clientIp({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }, "9.9.9.9", 1), "2.2.2.2");
  assert.equal(clientIp({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3" }, "9.9.9.9", 2), "2.2.2.2");
  assert.equal(clientIp({ "x-forwarded-for": "1.1.1.1" }, "9.9.9.9", 3), "1.1.1.1", "hops أكبر من الطول لا ينهار");
  assert.equal(clientIp({}, "::ffff:10.1.2.3", 1), "10.1.2.3");
  assert.equal(clientIp({}, undefined, 1), "");
});

test("toVercelRequest: query arrays, cookies, rewritten url, replayable stream, forged x-vercel-* dropped", async () => {
  const raw = Object.assign(Readable.from([]), {
    method: "POST", url: "/orig", headers: { cookie: "s=1", "content-type": "application/json", "x-vercel-id": "f", "x-vercel-forwarded-for": "9.9.9.9", "x-forwarded-for": "7.7.7.7, 8.8.8.8" },
    rawHeaders: [], httpVersion: "1.1", socket: { remoteAddress: "10.0.0.1" },
  });
  const req = toVercelRequest(raw, { rewritten: "/api/requests?__route=simple&t=1&t=2", body: Buffer.from('{"q":1}'), hops: 1 });
  assert.equal(req.method, "POST");
  assert.equal(req.url, "/api/requests?__route=simple&t=1&t=2");
  assert.deepEqual(req.query, { __route: "simple", t: ["1", "2"] });
  assert.deepEqual(req.cookies, { s: "1" });
  assert.deepEqual(req.body, { q: 1 });
  assert.equal(req.headers["x-forwarded-for"], "8.8.8.8");
  assert.equal(req.headers["x-vercel-id"], undefined);
  assert.equal(req.headers["x-vercel-forwarded-for"], undefined);
  let data = "";
  await new Promise((ok) => { req.on("data", (c) => (data += c)); req.on("end", ok); });
  assert.equal(data, '{"q":1}');
  assert.equal(req.socket.remoteAddress, "10.0.0.1");
});

test("collectBody rejects over the Vercel 4.5MB limit, by header and by streaming", async () => {
  assert.equal(MAX_BODY_BYTES, 4.5 * 1024 * 1024);
  const byHeader = Object.assign(Readable.from([]), { headers: { "content-length": String(MAX_BODY_BYTES + 1) } });
  await assert.rejects(() => collectBody(byHeader), (e) => e instanceof HttpError && e.status === 413);
  const streamed = Object.assign(Readable.from([Buffer.alloc(600), Buffer.alloc(600)]), { headers: {} });
  await assert.rejects(() => collectBody(streamed, 1000), (e) => e instanceof HttpError && e.status === 413);
  const ok = Object.assign(Readable.from([Buffer.from("ab"), Buffer.from("cd")]), { headers: {} });
  assert.equal((await collectBody(ok, 1000)).toString(), "abcd");
});

// ---- cron ------------------------------------------------------------------
test("cron: names are derived from the path and route, deterministic and unique", () => {
  assert.equal(slugOf("/api/newsletter"), "newsletter");
  assert.equal(slugOf("/api/requests?__route=jobhunt&action=run&limit=15"), "requests-jobhunt");
  assert.equal(slugOf("/api/candidate?action=backfill&limit=25"), "candidate-backfill");
  const jobs = cronJobs({ crons: [{ path: "/api/a", schedule: "0 1 * * *" }, { path: "/api/a", schedule: "0 2 * * *" }] });
  assert.deepEqual(jobs.map((j) => j.name), ["bp-cron-0-a", "bp-cron-1-a"]);
});

test("cron: runCron sends the bearer secret to the same path, never follows redirects, and reports non-2xx", async () => {
  const calls = [];
  const fake = async (url, opts) => { calls.push({ url, opts }); return { status: 200 }; };
  const job = { path: "/api/requests?__route=jobhunt&action=run&limit=15" };
  const ok = await runCron(job, { base: "https://www.businesspartner.sa", secret: "s3cr3t", fetchImpl: fake });
  assert.deepEqual(ok, { ok: true, status: 200 });
  assert.equal(calls[0].url, "https://www.businesspartner.sa/api/requests?__route=jobhunt&action=run&limit=15");
  assert.equal(calls[0].opts.headers.authorization, "Bearer s3cr3t");
  assert.equal(calls[0].opts.redirect, "manual");
  const bad = await runCron(job, { base: "https://x.test", secret: "s", fetchImpl: async () => ({ status: 403 }) });
  assert.equal(bad.ok, false);
  const redirected = await runCron(job, { base: "https://x.test", secret: "s", fetchImpl: async () => ({ status: 308 }) });
  assert.equal(redirected.ok, false, "308 apex→www لا يُعدّ نجاحاً: الترويسة لا تعبر التحويل");
});
