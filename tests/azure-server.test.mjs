// خادم Azure (ops/azure/server.mjs): الملفات الثابتة، التحويلات، الترويسات، تشغيل دوال
// بواجهة Vercel، المهلة، الوكيل إلى الأصل الخارجي، وحماية المسارات. يعمل على منفذ
// عشوائي محلي بلا أي اتصال خارجي، وبدوال تجريبية في مجلد مؤقت لا بدوال المستودع
// (عدا اختبارين يمرّان على دوال المستودع الحقيقية لإثبات أنها تُحمَّل عبر الغلاف).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { createAzureServer } from "../ops/azure/server.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const realVercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));

const listen = (server) => new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server.address().port)));
const close = (server) => new Promise((ok) => { server.closeAllConnections?.(); server.close(ok); });

function call(port, p, { method = "GET", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port, path: p, method, headers }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, buf: Buffer.concat(chunks), text: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

const baseCfg = { forceHttps: false, bpEnv: "local" };
const quiet = () => {};

// ---- مجلد دوال تجريبي ----------------------------------------------------
const apiDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-azapi-"));
const w = (name, src) => fs.writeFileSync(path.join(apiDir, name), src);
w("echo.js", `export default async function handler(req, res) {
  let streamed = "";
  await new Promise((ok) => { req.on("data", (c) => (streamed += c)); req.on("end", ok); });
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.statusCode = 200;
  res.end(JSON.stringify({ method: req.method, url: req.url, query: req.query, cookies: req.cookies, body: req.body === undefined ? null : (Buffer.isBuffer(req.body) ? { buffer: req.body.toString("hex") } : req.body), streamed, xff: req.headers["x-forwarded-for"], real: req.headers["x-real-ip"], vercelHdr: req.headers["x-vercel-id"] || null }));
}
`);
w("json.js", `export default (req, res) => res.status(201).json({ ok: true, via: "helpers" });\n`);
w("_private.js", `export default (req, res) => res.end("secret");\n`);
w("boom.js", `export default async function handler() { throw new Error("kaboom"); }\n`);
w("slow.js", `export const config = { maxDuration: 0.25 };\nexport default async function handler(req, res) { await new Promise((r) => setTimeout(r, 1500)); res.end("late"); }\n`);
w("nodefault.js", `export const x = 1;\n`);
w("headers.js", `export default (req, res) => { res.setHeader("cache-control", "no-store"); res.end("h"); }\n`);
w("raw.js", `export const config = { api: { bodyParser: false } };\nexport default async function handler(req, res) { let d = ""; for await (const c of req) d += c; res.end(JSON.stringify({ body: req.body ?? null, raw: d })); }\n`);

const customVercel = {
  cleanUrls: true,
  trailingSlash: false,
  redirects: [
    { source: "/old/:rest*", destination: "/new/:rest*", permanent: true },
    { source: "/tmp", destination: "/about", permanent: false },
  ],
  rewrites: [
    { source: "/api/alias", destination: "/api/echo?__route=aliased" },
    { source: "/hostonly", has: [{ type: "host", value: "hr.example.test" }], destination: "/about" },
    { source: "/up/:path*", destination: "http://127.0.0.1:__UP__/base/:path*" },
  ],
  headers: [
    { source: "/assets/(.*)", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    { source: "/api/echo", headers: [{ key: "x-from-config", value: "yes" }] },
  ],
  functions: { "api/echo.js": { maxDuration: 5 } },
};

// ---- خادم المنبع للوكيل ---------------------------------------------------
const seen = [];
const upstream = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    seen.push({ url: req.url, host: req.headers.host, fwdHost: req.headers["x-forwarded-host"], method: req.method, body: Buffer.concat(chunks).toString() });
    if (req.url.startsWith("/base/redir")) { res.statusCode = 302; res.setHeader("location", "/quotes/admin"); return res.end(); }
    res.setHeader("content-type", "text/plain");
    res.end("upstream:" + req.url);
  });
});

let up, srv, port, real, realPort;
const extras = [];
const mk = (o) => { const s = createAzureServer(o); extras.push(s); return s; };
test.before(async () => {
  const upPort = await listen(upstream);
  const cv = JSON.parse(JSON.stringify(customVercel).replace("__UP__", String(upPort)));
  srv = createAzureServer({ vercelJson: cv, apiDir, log: quiet, config: { ...baseCfg, fnTimeoutS: 2, maxBody: 2048, trustedHops: 1 } });
  port = await listen(srv);
  real = createAzureServer({ vercelJson: realVercel, log: quiet, config: { ...baseCfg } });
  realPort = await listen(real);
  up = upstream;
});
test.after(async () => { for (const s of extras) await close(s); await close(srv); await close(real); await close(up); fs.rmSync(apiDir, { recursive: true, force: true }); });

// ---- ثابت -----------------------------------------------------------------
test("static: clean URL, ETag + 304, nested index, HEAD", async () => {
  const r = await call(realPort, "/about");
  assert.equal(r.status, 200);
  assert.match(r.headers["content-type"], /^text\/html; charset=utf-8/);
  assert.equal(r.headers["cache-control"], "public, max-age=0, must-revalidate");
  assert.equal(r.headers["access-control-allow-origin"], "*");
  assert.equal(r.headers["strict-transport-security"], "max-age=63072000");
  assert.ok(r.headers.etag);
  const again = await call(realPort, "/about", { headers: { "if-none-match": r.headers.etag } });
  assert.equal(again.status, 304);
  assert.equal(again.buf.length, 0);
  assert.equal((await call(realPort, "/")).status, 200);
  assert.equal((await call(realPort, "/ar")).status, 200, "site/ar/index.html");
  const head = await call(realPort, "/about", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(head.buf.length, 0);
  assert.equal(Number(head.headers["content-length"]), r.buf.length);
});

test("static: gzip/brotli only for text and only when asked", async () => {
  const plain = await call(realPort, "/about");
  const gz = await call(realPort, "/about", { headers: { "accept-encoding": "gzip" } });
  assert.equal(gz.headers["content-encoding"], "gzip");
  assert.equal(zlib.gunzipSync(gz.buf).toString("utf8"), plain.text);
  const br = await call(realPort, "/about", { headers: { "accept-encoding": "gzip, br" } });
  assert.equal(br.headers["content-encoding"], "br");
  assert.equal(zlib.brotliDecompressSync(br.buf).toString("utf8"), plain.text);
  assert.match(gz.headers.vary, /Accept-Encoding/);
  assert.equal(plain.headers["content-encoding"], undefined);
});

test("cleanUrls + trailingSlash:false → 308 to the canonical path, query kept", async () => {
  for (const [from, to] of [["/about/", "/about"], ["/about.html", "/about"], ["/index.html", "/"], ["/ar/", "/ar"], ["/ar/index.html", "/ar"], ["/about/?a=1", "/about?a=1"]]) {
    const r = await call(realPort, from);
    assert.equal(r.status, 308, from);
    assert.equal(r.headers.location, to, from);
  }
});

test("redirects from vercel.json run before files; query appended; status per permanent flag", async () => {
  const r = await call(realPort, "/revenue-os?x=1");
  assert.equal(r.status, 308);
  assert.equal(r.headers.location, "/business-development?x=1");
  const t = await call(realPort, "/client-portal");
  assert.equal(t.status, 307);
  const c = await call(port, "/old/a/b?z=9");
  assert.equal(c.status, 308);
  assert.equal(c.headers.location, "/new/a/b?z=9");
});

test("404 is Vercel's plain text; unknown /api/ is 404 too", async () => {
  for (const p of ["/no-such-page-xyz", "/api/no-such-fn"]) {
    const r = await call(realPort, p);
    assert.equal(r.status, 404, p);
    assert.match(r.headers["content-type"], /^text\/plain/);
    assert.match(r.text, /NOT_FOUND/);
  }
});

test("path safety: traversal, dotfiles, backslashes, NUL and build scripts are never served", async () => {
  for (const p of ["/..%2f..%2fpackage.json", "/%2e%2e/%2e%2e/package.json", "/.git/config", "/.env", "/a%5c..%5cb", "/x%00.html", "/scripts/verify-api.mjs", "/scripts/generate.mjs", "/%2e%2e%5c"]) {
    const r = await call(realPort, p);
    assert.ok(r.status === 404 || r.status === 400 || r.status === 308, `${p} → ${r.status}`);
    assert.doesNotMatch(r.text, /"name": "business-partner/, p);
  }
  assert.equal((await call(realPort, "/.well-known/apple-developer-merchantid-domain-association")).status, 200, ".well-known يبقى");
  const open = mk({ vercelJson: realVercel, log: quiet, config: { ...baseCfg, blockScripts: false } });
  const p2 = await listen(open);
  assert.equal((await call(p2, "/scripts/verify-api.mjs")).status, 200, "BP_SERVE_BUILD_SCRIPTS=1 يعيد سلوك Vercel");
  await close(open);
});

test("headers rules: static override defaults; non-/assets keep default; hsts everywhere", async () => {
  const a = await call(realPort, "/assets/css/b10x-theme.css");
  assert.equal(a.status, 200);
  assert.equal(a.headers["cache-control"], "public, max-age=31536000, immutable");
  assert.match(a.headers["content-type"], /^text\/css/);
  const r404 = await call(realPort, "/assets/css/nope.css");
  assert.equal(r404.status, 404);
  assert.equal(r404.headers["cache-control"], "public, max-age=0, must-revalidate", "لا immutable على 404 (يخالف Vercel عمداً: 404 لا يُخزَّن سنة)");
  assert.ok(a.headers["strict-transport-security"]);
});

// ---- دوال -----------------------------------------------------------------
test("function: Vercel-style req.query/cookies/url, rewrite destination wins, config header applied", async () => {
  const r = await call(port, "/api/alias?__route=evil&k=v", { headers: { cookie: "a=1; b=%E0%A4%A; c=%D8%B3" } });
  assert.equal(r.status, 200);
  const j = JSON.parse(r.text);
  assert.equal(j.query.__route, "aliased", "الوجهة تغلب الاستعلام الأصلي");
  assert.equal(j.query.k, "v");
  assert.match(j.url, /^\/api\/echo\?/);
  assert.deepEqual(j.cookies, { a: "1", b: "%E0%A4%A", c: "س" }, "كوكي معطوب لا يُسقط الطلب");
  assert.equal(r.headers["x-from-config"], undefined, "قواعد headers تُطابَق على المسار المطلوب لا على وجهة الـrewrite");
  assert.equal(r.headers["cache-control"], "public, max-age=0, must-revalidate", "افتراضي Vercel للدوال");
  const direct = await call(port, "/api/echo");
  assert.equal(direct.headers["x-from-config"], "yes", "قاعدة headers على /api/echo تُطبَّق على الدالة");
});

test("function: body parsing by content type, and the stream still ends for handlers that wait on it", async () => {
  const json = JSON.parse((await call(port, "/api/echo", { method: "POST", headers: { "content-type": "application/json" }, body: '{"a":1}' })).text);
  assert.deepEqual(json.body, { a: 1 });
  assert.equal(json.streamed, '{"a":1}', "الـstream يُقدَّم مرة ثانية بعد التحليل");
  const form = JSON.parse((await call(port, "/api/echo", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "a=1&b=2&b=3" })).text);
  assert.deepEqual(form.body, { a: "1", b: ["2", "3"] });
  const text = JSON.parse((await call(port, "/api/echo", { method: "POST", headers: { "content-type": "text/plain" }, body: '{"x":1}' })).text);
  assert.equal(text.body, '{"x":1}', "text/plain يبقى نصاً كما عند Vercel");
  const bad = JSON.parse((await call(port, "/api/echo", { method: "POST", headers: { "content-type": "application/json" }, body: "{oops" })).text);
  assert.equal(bad.body, "{oops", "JSON فاسد: النص الخام، فتتولى الدالة الرفض");
  const empty = JSON.parse((await call(port, "/api/echo", { method: "POST", headers: { "content-type": "application/json" }, body: "" })).text);
  assert.equal(empty.body, null);
  const bin = JSON.parse((await call(port, "/api/echo", { method: "POST", headers: { "content-type": "application/octet-stream" }, body: Buffer.from([1, 2, 255]) })).text);
  assert.deepEqual(bin.body, { buffer: "0102ff" });
});

test("function: bodyParser:false functions get the raw stream and no req.body", async () => {
  const r = JSON.parse((await call(port, "/api/raw", { method: "POST", headers: { "content-type": "application/json" }, body: '{"k":1}' })).text);
  assert.equal(r.body, null);
  assert.equal(r.raw, '{"k":1}');
});

test("function: body above the limit → 413 before the handler runs", async () => {
  const r = await call(port, "/api/echo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pad: "x".repeat(5000) }) });
  assert.equal(r.status, 413);
});

test("function: client IP is normalised so a spoofed X-Forwarded-For cannot choose the identity", async () => {
  const r = JSON.parse((await call(port, "/api/echo", { headers: { "x-forwarded-for": "6.6.6.6, 203.0.113.9", "x-vercel-id": "forged" } })).text);
  assert.equal(r.xff, "203.0.113.9", "المدخل يُلحق عنوان المتصل في النهاية");
  assert.equal(r.real, "203.0.113.9");
  assert.equal(r.vercelHdr, null, "ترويسات x-vercel-* القادمة من الخارج تُحذف");
  const behindFd = mk({ vercelJson: customVercel, apiDir, log: quiet, config: { ...baseCfg, trustedHops: 2 } });
  const p = await listen(behindFd);
  const r2 = JSON.parse((await call(p, "/api/echo", { headers: { "x-forwarded-for": "6.6.6.6, 198.51.100.7, 10.0.0.4" } })).text);
  assert.equal(r2.xff, "198.51.100.7", "خلف Front Door: العميل هو ما قبل الأخير");
  await close(behindFd);
});

test("function: res.status().json() helpers exist; underscore and non-function files are not routable", async () => {
  const j = await call(port, "/api/json");
  assert.equal(j.status, 201);
  assert.deepEqual(JSON.parse(j.text), { ok: true, via: "helpers" });
  for (const p of ["/api/_private", "/api/nodefault", "/api/echo/extra", "/api/..%2fserver"]) {
    assert.equal((await call(port, p)).status, 404, p);
  }
  assert.equal((await call(port, "/api/headers")).headers["cache-control"], "no-store", "ما ضبطته الدالة يغلب الافتراضي");
});

test("function: a throwing handler → 500 and the server keeps serving; a slow one → 504 at its maxDuration", async () => {
  const b = await call(port, "/api/boom");
  assert.equal(b.status, 500);
  assert.match(b.text, /FUNCTION_INVOCATION_FAILED/);
  assert.equal((await call(port, "/api/json")).status, 201);
  const t0 = Date.now();
  const s = await call(port, "/api/slow");
  assert.equal(s.status, 504);
  assert.match(s.text, /FUNCTION_INVOCATION_TIMEOUT/);
  assert.ok(Date.now() - t0 < 1400, "قُطع عند مهلة الملف (0.25ث) لا عند اكتمال الدالة");
});

test("real repo functions load through the shim (otp health, simple via rewrite)", async () => {
  const otp = await call(realPort, "/api/otp");
  assert.equal(otp.status, 200);
  assert.equal(JSON.parse(otp.text).status, "ok");
  const simple = await call(realPort, "/api/simple");
  assert.ok([200, 401, 503].includes(simple.status), `simple → ${simple.status}`);
  assert.match(simple.headers["content-type"], /json/);
  const q = new URL("http://x/api/simple");
  assert.ok(q);
});

// ---- وكيل ------------------------------------------------------------------
test("proxy: external rewrite forwards path+query+body, sets Host, never follows redirects", async () => {
  seen.length = 0;
  const r = await call(port, "/up/a/b?x=1", { headers: { host: "www.businesspartner.sa", "x-forwarded-proto": "https" } });
  assert.equal(r.status, 200);
  assert.equal(r.text, "upstream:/base/a/b?x=1");
  assert.match(seen[0].host, /^127\.0\.0\.1:/, "Host = المنبع لا الموقع");
  assert.equal(seen[0].fwdHost, "www.businesspartner.sa");
  const post = await call(port, "/up/form", { method: "POST", headers: { "content-type": "text/plain" }, body: "hello" });
  assert.equal(post.status, 200);
  assert.equal(seen[seen.length - 1].body, "hello");
  assert.equal(seen[seen.length - 1].method, "POST");
  const redir = await call(port, "/up/redir");
  assert.equal(redir.status, 302);
  assert.equal(redir.headers.location, "/quotes/admin", "التحويل يمرّ للمتصفح كما هو");
  assert.ok(redir.headers["strict-transport-security"]);
});

test("proxy: dead upstream → 502, not a hung request", async () => {
  const cv = { rewrites: [{ source: "/dead/:p*", destination: "http://127.0.0.1:1/x/:p*" }] };
  const s = mk({ vercelJson: cv, apiDir, log: quiet, config: { ...baseCfg } });
  const p = await listen(s);
  const r = await call(p, "/dead/y");
  assert.equal(r.status, 502);
  await close(s);
});

// ---- مضيف وبروتوكول ---------------------------------------------------------
test("apex host → 308 to www with path and query; www is untouched", async () => {
  const r = await call(realPort, "/ar/about?x=1", { headers: { host: "businesspartner.sa" } });
  assert.equal(r.status, 308);
  assert.equal(r.headers.location, "https://www.businesspartner.sa/ar/about?x=1");
  const viaFd = await call(realPort, "/", { headers: { host: "bp.azurecontainerapps.example", "x-forwarded-host": "businesspartner.sa" } });
  assert.equal(viaFd.status, 308, "X-Forwarded-Host من Front Door هو المضيف الحقيقي");
  assert.equal((await call(realPort, "/", { headers: { host: "www.businesspartner.sa" } })).status, 200);
});

test("http → https redirect (behind ingress), health check is exempt", async () => {
  const s = mk({ vercelJson: realVercel, log: quiet, config: { forceHttps: true, bpEnv: "production" } });
  const p = await listen(s);
  const r = await call(p, "/about?a=1", { headers: { host: "www.businesspartner.sa", "x-forwarded-proto": "http" } });
  assert.equal(r.status, 308);
  assert.equal(r.headers.location, "https://www.businesspartner.sa/about?a=1");
  assert.equal((await call(p, "/about", { headers: { "x-forwarded-proto": "https" } })).status, 200);
  assert.equal((await call(p, "/__health")).status, 200, "فحص الصحة من المنصة يأتي بلا x-forwarded-proto");
  await close(s);
});

test("host-conditioned rewrite wins over a static file for that host only", async () => {
  const www = await call(port, "/hostonly", { headers: { host: "www.businesspartner.sa" } });
  assert.equal(www.status, 404);
  const hr = await call(port, "/hostonly", { headers: { host: "hr.example.test" } });
  assert.equal(hr.status, 200);
});

test("Front Door lock: when BP_FRONT_DOOR_ID is set only matching requests pass (health and apex exempt)", async () => {
  const s = mk({ vercelJson: realVercel, log: quiet, config: { ...baseCfg, frontDoorId: "abc-123" } });
  const p = await listen(s);
  assert.equal((await call(p, "/about")).status, 403);
  assert.equal((await call(p, "/about", { headers: { "x-azure-fdid": "ABC-123" } })).status, 200);
  assert.equal((await call(p, "/about", { headers: { "x-azure-fdid": "other" } })).status, 403);
  assert.equal((await call(p, "/__health")).status, 200);
  assert.equal((await call(p, "/", { headers: { host: "businesspartner.sa" } })).status, 308);
  await close(s);
});

test("health: ok, then 503 once draining; no secrets in the body", async () => {
  const s = mk({ vercelJson: realVercel, log: quiet, config: { ...baseCfg } });
  const p = await listen(s);
  const ok = await call(p, "/__health");
  assert.equal(ok.status, 200);
  const j = JSON.parse(ok.text);
  assert.equal(j.ok, true);
  assert.deepEqual(Object.keys(j).sort(), ["env", "errors", "ok", "requests", "sha", "uptimeS"]);
  s.bpStats.draining = true;
  assert.equal((await call(p, "/__health")).status, 503);
  await close(s);
});

test("request log never carries the query string or client address", async () => {
  const lines = [];
  const s = mk({ vercelJson: realVercel, log: (o) => lines.push(o), config: { ...baseCfg } });
  const p = await listen(s);
  await call(p, "/about?token=SECRET123&email=a@b.c", { headers: { "x-forwarded-for": "198.51.100.7" } });
  await new Promise((r) => setTimeout(r, 30));
  const text = JSON.stringify(lines);
  assert.ok(lines.length >= 1);
  assert.doesNotMatch(text, /SECRET123|a@b\.c|198\.51\.100\.7/);
  await close(s);
});
