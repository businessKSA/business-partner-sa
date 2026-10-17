// فحص التكافؤ (ops/azure/parity.mjs) يعمل: خادمان متطابقان → لا فشل، وخادم ينقصه redirect أو
// يخدم /scripts/ أو يفقد HSTS → يفشل الفحص المقابل. كله محلي؛ لا اتصال بالموقع الحيّ ولا بـAzure.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import { createAzureServer } from "../ops/azure/server.mjs";
import { runParity, buildChecks, sampleFromSource, sampleStaticPages, compare } from "../ops/azure/parity.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const realVercel = fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8");
const siteDir = path.join(ROOT, "site");
const cfg = { forceHttps: false, bpEnv: "local" };
const quiet = () => {};
const listen = (s) => new Promise((ok) => s.listen(0, "127.0.0.1", () => ok(s.address().port)));
const close = (s) => new Promise((ok) => { s.closeAllConnections?.(); s.close(ok); });

// الأصل الخارجي (bp-quotes على Vercel) يُستبدل بمنبع محلي: الاختبار لا يخرج إلى الشبكة.
const stub = http.createServer((req, res) => { res.setHeader("content-type", "text/plain"); res.end("stub"); });
let vercel;
test.before(async () => {
  const port = await listen(stub);
  vercel = JSON.parse(realVercel.replaceAll("https://bp-quotes-three.vercel.app", `http://127.0.0.1:${port}`));
});
test.after(async () => { await close(stub); });

test("sampleFromSource builds a path that matches the rule it came from", () => {
  assert.equal(sampleFromSource("/:lang(ar|fr|zh)/(business-development)"), "/ar/business-development");
  assert.equal(sampleFromSource("/hr/employer/:path*"), "/hr/employer/a/b");
  assert.equal(sampleFromSource("/services/(rev-ent|rev-growth)"), "/services/rev-ent");
  assert.equal(sampleFromSource("/quotes"), "/quotes");
});

test("the check list covers every redirect and every non-host rewrite, plus urls, pages, assets and api", () => {
  const checks = buildChecks({ vercelJson: vercel, siteDir, sample: 30 });
  const kinds = (k) => checks.filter((c) => c.kind === k);
  assert.equal(kinds("redirect").length, vercel.redirects.length);
  const nonHost = vercel.rewrites.filter((r) => !(r.has || []).some((c) => c.type === "host"));
  assert.equal(kinds("rewrite").length, nonHost.length);
  assert.ok(kinds("page").length >= 20);
  assert.ok(kinds("api").length >= 3);
  assert.equal(kinds("expected-diff").length, 1);
  assert.equal(new Set(checks.map((c) => c.id + c.path)).size, checks.length, "لا فحص مكرّر");
  assert.ok(sampleStaticPages(siteDir, 30).includes("/"), "الرئيسية دائماً في العيّنة");
  assert.deepEqual(sampleStaticPages(siteDir, 30), sampleStaticPages(siteDir, 30), "العيّنة حتمية");
});

test("two identical servers are in parity (self-test of the tool)", async () => {
  const a = createAzureServer({ vercelJson: vercel, log: quiet, config: cfg });
  const b = createAzureServer({ vercelJson: vercel, log: quiet, config: cfg });
  try {
    const [pa, pb] = [await listen(a), await listen(b)];
    const rep = await runParity({ a: `http://127.0.0.1:${pa}`, b: `http://127.0.0.1:${pb}`, vercelJson: vercel, siteDir, sample: 12, body: true, strictBody: true, concurrency: 8 });
    assert.equal(rep.fail, 0, JSON.stringify(rep.results.filter((r) => r.level === "fail").map((r) => [r.id, r.notes])));
    assert.equal(rep.warn, 0);
    assert.equal(rep.expected, 1, "الاختلاف المتوقّع الوحيد: /scripts/ مغلق في B (وهو مغلق في A هنا أيضاً فيمرّ)");
    assert.ok(rep.pass >= 60, `عدد المتطابق ${rep.pass}`);
  } finally { await close(a); await close(b); }
});

test("parity catches a missing redirect, an open /scripts/, and a missing HSTS", async () => {
  const ref = createAzureServer({ vercelJson: vercel, log: quiet, config: { ...cfg } });
  const dropped = JSON.parse(JSON.stringify(vercel));
  dropped.redirects = dropped.redirects.filter((r) => r.source !== "/client-portal");
  const bad = createAzureServer({ vercelJson: dropped, log: quiet, config: { ...cfg, blockScripts: false } });
  try {
    const [pa, pb] = [await listen(ref), await listen(bad)];
    const rep = await runParity({ a: `http://127.0.0.1:${pa}`, b: `http://127.0.0.1:${pb}`, vercelJson: vercel, siteDir, sample: 5, skipApi: true });
    const failed = rep.results.filter((r) => r.level === "fail").map((r) => r.id);
    assert.ok(failed.some((id) => id.includes("/client-portal")), `redirect المفقود لم يُكتشف: ${failed}`);
    assert.ok(failed.some((id) => id.startsWith("build scripts")), "/scripts/ المفتوح لم يُكتشف");
    assert.ok(rep.fail >= 2);
  } finally { await close(ref); await close(bad); }
});

test("compare(): HSTS and cache headers are enforced on pages, API compares JSON shape not values", () => {
  const mk = (status, headers, body = "") => ({ status, headers, body: Buffer.from(body) });
  const page = { kind: "page", base: "https://x" };
  const h = { "content-type": "text/html", "cache-control": "public, max-age=0, must-revalidate", "strict-transport-security": "max-age=1" };
  assert.equal(compare(page, mk(200, h), mk(200, h)).level, "pass");
  assert.equal(compare(page, mk(200, h), mk(200, { ...h, "strict-transport-security": undefined })).level, "fail");
  assert.equal(compare(page, mk(200, h), mk(200, { ...h, "cache-control": "no-store" })).level, "fail");
  assert.equal(compare(page, mk(200, h, "a"), mk(200, h, "b"), { body: true }).level, "warn");
  assert.equal(compare(page, mk(200, h, "a"), mk(200, h, "b"), { body: true, strictBody: true }).level, "fail");
  const api = { kind: "api", base: "https://x" };
  const j = (o) => mk(200, { ...h, "content-type": "application/json" }, JSON.stringify(o));
  assert.equal(compare(api, j({ status: "ok", dbDriver: "supabase", n: 1 }), j({ status: "ok", dbDriver: "azure", n: 2 })).level, "pass", "dbDriver والقيم تختلف عمداً");
  assert.equal(compare(api, j({ status: "ok", a: 1 }), j({ status: "ok" })).level, "fail", "مفتاح ناقص");
  assert.equal(compare(page, { error: "boom" }, mk(200, h)).level, "fail");
});
