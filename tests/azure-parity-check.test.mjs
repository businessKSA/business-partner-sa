// أداة التكافؤ الكاملة (ops/parity-check.mjs): كلها محلية — خادمان http على 127.0.0.1، لا اتصال بالموقع
// الحيّ ولا بأزور. تتحقق من: GET حصراً، مرشّح الأمان، التطبيع (مفتاح الكاش/الأختام/معرّف الطلب/s-maxage)،
// التصنيف، نسب فروق المحتوى، وأن تعذّر الوصول لا يخترع أرقاماً.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import {
  parseSitemap, expandPages, sampleEvenly, normalizeText, bodyCompare, compareItem, normLocation,
  isSafeExtraApi, FORBIDDEN, API_GET_PROBES, buildPlan, attributeBodies, fileCandidates,
  runParityCheck, parseArgs, summarize, renderSummaryAr,
} from "../ops/parity-check.mjs";

const mk = (status, headers = {}, body = "") => ({ status, headers: { ...headers }, body: Buffer.from(body), ms: 1, attempts: 1 });
const A = "https://www.businesspartner.sa", B = "https://azure.businesspartner.sa";
const cmp = (item, a, b) => compareItem({ group: "pages", ...item }, a, b, { aBase: A, bBase: B });

test("parseSitemap يقرأ المسارات ويفكّ كيانات XML ويتجاهل المضيف", () => {
  const xml = `<urlset><url><loc>https://businesspartner.sa/</loc></url><url><loc> https://businesspartner.sa/a?x=1&amp;y=2 </loc></url></urlset>`;
  assert.deepEqual(parseSitemap(xml), ["/", "/a?x=1&y=2"]);
});

test("expandPages يضيف صيغة بلا شرطة أخيرة، وsampleEvenly حتمية وتحتفظ بالرئيسية", () => {
  assert.deepEqual(expandPages(["/", "/ar/", "/about"]), ["/", "/about", "/ar", "/ar/"]);
  const list = Array.from({ length: 200 }, (_, i) => `/p${i}`).concat("/");
  const s1 = sampleEvenly(list, 20), s2 = sampleEvenly(list, 20);
  assert.deepEqual(s1, s2);
  assert.ok(s1.includes("/"));
  assert.ok(s1.length <= 21 && s1.length >= 19);
});

test("normalizeText يحذف مفتاح الكاش والأختام الزمنية والـnonce ومعرّف طلب Vercel فقط", () => {
  const a = `<link href="/assets/css/b10x-theme.css?v=79201fe7e6"><i nonce="abc"></i> 2026-11-03T01:00:00Z`;
  const b = `<link href="/assets/css/b10x-theme.css?v=0123456789"><i nonce="xyz"></i> 2026-11-04T09:30:00.123Z`;
  assert.equal(normalizeText(a), normalizeText(b));
  assert.equal(normalizeText("not found\n\niad1::fjsd2-1793668804058-1b1dbedd5500\n"), normalizeText("not found\n"));
  assert.notEqual(normalizeText(`<a href="/x?v=2">`), normalizeText(`<a href="/y?v=2">`));
});

test("مرشّح الأمان يمنع كل ما له أثر جانبي أو يحمل أسراراً، وقائمة API الداخلية نظيفة", () => {
  for (const p of API_GET_PROBES) assert.ok(!FORBIDDEN.test(p.path), `محظور داخل القائمة: ${p.path}`);
  for (const bad of [
    "/api/requests?__route=jobhunt&action=run&limit=15", "/api/candidate?action=backfill&limit=25", "/api/pay?action=mock-form",
    "/api/newsletter?key=abc", "/api/book?action=cancel", "/api/otp?token=1", "/api/x/y", "https://evil.example/api/otp", "/page",
  ]) assert.equal(isSafeExtraApi(bad), false, bad);
  assert.equal(isSafeExtraApi("/api/hire"), true);
  assert.throws(() => buildPlan({ sitemapPaths: [], extraApi: ["/api/pay?action=mock-form"] }), /مرفوض/);
});

test("buildPlan: لا تكرار، ولا مسارات POST، والمجموعات تُنتقى", () => {
  const plan = buildPlan({ sitemapPaths: ["/", "/ar/", "/a"], only: ["pages"] });
  assert.deepEqual(plan.map((x) => x.path), ["/", "/a", "/ar", "/ar/"]);
  const all = buildPlan({ sitemapPaths: ["/robots.txt"], vercelJson: { redirects: [{ source: "/old", destination: "/new" }], rewrites: [{ source: "/api/simple", destination: "/api/requests?__route=simple" }] } });
  assert.equal(new Set(all.map((x) => x.path)).size, all.length);
  assert.ok(all.some((x) => x.group === "rules" && x.path === "/old?pq=1"));
});

test("compareItem: التصنيفات الأساسية", () => {
  const html = (v) => `<html><link href="/c.css?v=${v}"></html>`;
  const hdr = { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=0, must-revalidate" };
  assert.equal(cmp({ path: "/" }, mk(200, hdr, html("aaaaaaaaaa")), mk(200, hdr, html("aaaaaaaaaa"))).verdict, "identical");
  assert.equal(cmp({ path: "/" }, mk(200, hdr, html("aaaaaaaaaa")), mk(200, hdr, html("bbbbbbbbbb"))).verdict, "equivalent");
  const diffBody = cmp({ path: "/" }, mk(200, hdr, "<p>a</p>"), mk(200, hdr, "<p>b</p><i></i>"));
  assert.equal(diffBody.verdict, "body-differs");
  assert.equal(diffBody.bodyHint.kind, "text");
  const st = cmp({ path: "/x" }, mk(200, hdr, "x"), mk(404, hdr, "x"));
  assert.equal(st.verdict, "mismatch");
  assert.match(st.diffs[0].sig, /200→404/);
  const hd = cmp({ path: "/" }, mk(200, hdr, "x"), mk(200, { ...hdr, "cache-control": "no-store" }, "x"));
  assert.equal(hd.verdict, "mismatch");
  assert.equal(cmp({ path: "/" }, { error: "x" }, mk(200, hdr, "")).verdict, "error");
});

test("s-maxage وstale-while-revalidate يُسقطان (Vercel لا يُظهرهما) لكن max-age وno-store فرق حقيقي", () => {
  const j = { "content-type": "application/json; charset=utf-8" };
  const a = mk(200, { ...j, "cache-control": "public, max-age=300" }, "{}");
  assert.equal(cmp({ path: "/api/x" }, a, mk(200, { ...j, "cache-control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600" }, "{}")).verdict, "identical");
  assert.equal(cmp({ path: "/api/x" }, mk(200, { ...j, "cache-control": "public, max-age=0, must-revalidate" }, "{}"), mk(200, { ...j, "cache-control": "public, s-maxage=60" }, "{}")).verdict, "identical");
  assert.equal(cmp({ path: "/api/x" }, a, mk(200, { ...j, "cache-control": "no-store" }, "{}")).verdict, "mismatch");
});

test("التحويلات: Location على النطاقين يُقارَن مساراً، ووجهة مختلفة فرق", () => {
  const sites = new Set(["www.businesspartner.sa", "azure.businesspartner.sa", "businesspartner.sa"]);
  assert.equal(normLocation("https://www.businesspartner.sa/x?y=1", A, sites), "/x?y=1");
  assert.equal(normLocation("/x?y=1", B, sites), "/x?y=1");
  assert.equal(normLocation("https://other.example/x", B, sites), "https://other.example/x");
  const r1 = cmp({ path: "/o" }, mk(308, { location: "/new" }), mk(308, { location: "https://azure.businesspartner.sa/new" }));
  assert.equal(r1.verdict, "identical");
  const r2 = cmp({ path: "/o" }, mk(308, { location: "/new" }), mk(308, { location: "/other" }));
  assert.equal(r2.verdict, "mismatch");
  assert.equal(r2.diffs[0].cls, "redirect");
  const r3 = cmp({ path: "/o" }, mk(302, { location: "/c" }), mk(200, { "content-type": "text/html" }, "x"));
  assert.equal(r3.verdict, "mismatch");
});

test("المجلد المغلق على أزور: 404 عند B متوقّع، و200 فشل", () => {
  const js = { "content-type": "application/javascript" };
  assert.equal(cmp({ path: "/scripts/x.mjs", expect: "closed-on-b" }, mk(200, js, "x"), mk(404, {}, "")).verdict, "expected");
  assert.equal(cmp({ path: "/scripts/x.mjs", expect: "closed-on-b" }, mk(200, js, "x"), mk(200, js, "x")).verdict, "mismatch");
});

test("bodyCompare JSON: يتجاهل المفاتيح المتغيّرة، ولا يطبع قيمة نصية أو سرّية أبداً", () => {
  const a = Buffer.from(JSON.stringify({ ok: true, ts: 1, dbDriver: "supabase", apiKey: "SECRET-AAA", n: 3 }));
  const b = Buffer.from(JSON.stringify({ ok: true, ts: 2, dbDriver: "azure", apiKey: "SECRET-AAA", n: 3 }));
  assert.equal(bodyCompare(a, b, "application/json", { ignoreKeys: ["dbDriver"] }).equalNorm, true);
  const c = Buffer.from(JSON.stringify({ ok: false, apiKey: "SECRET-BBB", token: 7 }));
  const d = Buffer.from(JSON.stringify({ ok: true, apiKey: "SECRET-CCC", token: 8 }));
  const r = bodyCompare(c, d, "application/json");
  const txt = JSON.stringify(r);
  assert.ok(!/SECRET/.test(txt), "قيمة سرّية ظهرت في الناتج");
  assert.match(txt, /ok: A=false B=true/);
  assert.ok(!/token: A=7/.test(txt), "رقم تحت مفتاح حسّاس ظهر");
});

test("نسب فروق المحتوى: شيفرة مختلفة / B لا يطابق ملفه / A لا يطابق مرجعه", () => {
  const sha = (s) => bodyHash(Buffer.from(s));
  const mkRec = (p, a, b) => ({ path: p, group: "pages", verdict: "body-differs", a: { hash: sha(a) }, b: { hash: sha(b) } });
  const ref = { "p.html": Buffer.from("A-live"), "q.html": Buffer.from("A-live"), "r.html": Buffer.from("zzz") };
  const loc = { "p.html": Buffer.from("B-az"), "q.html": Buffer.from("different"), "r.html": Buffer.from("B-az") };
  const recs = [mkRec("/p", "A-live", "B-az"), mkRec("/q", "A-live", "B-az"), mkRec("/r", "A-live", "B-az"), mkRec("/s", "A-live", "B-az")];
  const c = attributeBodies(recs, { root: "/x", aRef: "ref", gitShow: (rel) => ref[rel] || null, readLocal: (rel) => loc[rel] || null });
  assert.deepEqual(recs.map((r) => r.attribution), ["code-divergence", "b-differs-from-its-commit", "a-differs-from-ref", "unknown"]);
  assert.equal(c.checked, 4);
  assert.deepEqual(fileCandidates("/ar/about"), ["ar/about.html", "ar/about/index.html", "ar/about"]);
  assert.deepEqual(fileCandidates("/"), ["index.html"]);
  assert.deepEqual(fileCandidates("/../etc/passwd"), []);
});
const bodyHash = (b) => crypto.createHash("sha256").update(b).digest("hex").slice(0, 16);

test("parseArgs: التزامن يُقيَّد، وA=B مرفوض، وخيار مجهول مرفوض", () => {
  const o = parseArgs(["node", "x", "--concurrency", "50", "--sample", "10", "--only", "pages,api"]);
  assert.equal(o.concurrency, 50); // التقييد عند التشغيل لا عند التحليل
  assert.deepEqual(o.only, ["pages", "api"]);
  assert.throws(() => parseArgs(["node", "x", "--a", "https://x.test", "--b", "https://x.test"]), /عنوان واحد/);
  assert.throws(() => parseArgs(["node", "x", "--post"]), /غير معروف/);
  assert.throws(() => parseArgs(["node", "x", "--only", "nope"]), /مجموعة/);
});

// ------------------------------------------------------------- شبكة محلية -
const listen = (s) => new Promise((ok) => s.listen(0, "127.0.0.1", () => ok(s.address().port)));
const close = (s) => new Promise((ok) => { s.closeAllConnections?.(); s.close(ok); });

function tmpRoot(paths) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bp-parity-"));
  fs.mkdirSync(path.join(root, "site"), { recursive: true });
  fs.writeFileSync(path.join(root, "site", "sitemap.xml"), `<urlset>${paths.map((p) => `<url><loc>https://businesspartner.sa${p}</loc></url>`).join("")}</urlset>`);
  fs.writeFileSync(path.join(root, "vercel.json"), JSON.stringify({ redirects: [{ source: "/old", destination: "/new", permanent: true }], rewrites: [] }));
  return root;
}

test("تشغيل كامل على خادمين محليين: GET فقط، يُصنَّف الفرق، ويُكتب ملخص عربي", async () => {
  const seen = [];
  const pageHtml = (v, extra = "") => `<html><link href="/c.css?v=${v}">${extra}</html>`;
  const mkServer = (variant) => http.createServer((req, res) => {
    seen.push(`${req.method} ${req.url}`);
    const u = new URL(req.url, "http://x");
    const h = { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=0, must-revalidate" };
    if (u.pathname === "/old") { res.writeHead(308, { location: "/new" }); return res.end(); }
    if (u.pathname === "/") { res.writeHead(200, h); return res.end(pageHtml(variant === "a" ? "aaaaaaaaaa" : "bbbbbbbbbb")); }
    if (u.pathname === "/about") { res.writeHead(200, h); return res.end(pageHtml("cccccccccc", variant === "b" ? "<b>new</b>" : "")); }
    if (u.pathname === "/gone") { res.writeHead(variant === "a" ? 200 : 404, h); return res.end("x"); }
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }); res.end("nf");
  });
  const sa = mkServer("a"), sb = mkServer("b");
  const pa = await listen(sa), pb = await listen(sb);
  const root = tmpRoot(["/", "/about", "/gone"]);
  try {
    const rep = await runParityCheck({
      a: `http://127.0.0.1:${pa}`, b: `http://127.0.0.1:${pb}`, root, sitemap: "local", sitemapDiff: false,
      only: ["pages", "rules"], concurrency: 99, delayMs: 0, timeout: 5, retries: 0, warmupTimeout: 5, attribute: false,
      ignoreRegex: [], extraApi: [],
    });
    assert.equal(rep.meta.concurrency, 6);
    const by = Object.fromEntries(rep.results.map((r) => [r.path, r.verdict]));
    assert.equal(by["/"], "equivalent");
    assert.equal(by["/about"], "body-differs");
    assert.equal(by["/gone"], "mismatch");
    assert.equal(by["/old?pq=1"], "identical");
    assert.equal(rep.summary.overall.mismatch, 1);
    assert.match(rep.summaryAr, /تقرير تكافؤ/);
    assert.match(rep.summaryAr, /الحالة 200→404/);
    assert.ok(seen.length > 0 && seen.every((l) => l.startsWith("GET ")), `طلب غير GET: ${seen.filter((l) => !l.startsWith("GET ")).join(",")}`);
    assert.ok(seen.every((l) => !/action=(run|backfill)/.test(l)));
  } finally { await close(sa); await close(sb); fs.rmSync(root, { recursive: true, force: true }); }
});

test("نطاق لا يُوصَل: لا نتائج مخترعة، وملخص «تعذّر القياس»", async () => {
  const sa = http.createServer((req, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end("ok"); });
  const pa = await listen(sa);
  const dead = http.createServer(); const pd = await listen(dead); await close(dead); // منفذ أُغلق للتوّ
  const root = tmpRoot(["/"]);
  try {
    const rep = await runParityCheck({
      a: `http://127.0.0.1:${pa}`, b: `http://127.0.0.1:${pd}`, root, sitemap: "local", sitemapDiff: false, only: ["pages"],
      concurrency: 2, delayMs: 0, timeout: 2, retries: 0, warmupTimeout: 2, ignoreRegex: [], extraApi: [],
    });
    assert.equal(rep.summary, null);
    assert.deepEqual(rep.results, []);
    assert.equal(rep.reachability.b.ok, false);
    assert.match(rep.summaryAr, /تعذّر القياس/);
    assert.ok(!/التكافؤ الكامل/.test(rep.summaryAr));
  } finally { await close(sa); fs.rmSync(root, { recursive: true, force: true }); }
});

test("خادم أزور يخدم .xml و.ico بنوع المحتوى نفسه الذي يخدمه Vercel (قيس 2026-11-03)", async () => {
  const { createAzureServer } = await import("../ops/azure/server.mjs");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bp-mime-"));
  fs.mkdirSync(path.join(root, "site"), { recursive: true });
  fs.writeFileSync(path.join(root, "site", "sitemap.xml"), "<urlset/>");
  fs.writeFileSync(path.join(root, "site", "favicon.ico"), Buffer.from([0, 0, 1, 0]));
  fs.writeFileSync(path.join(root, "vercel.json"), "{}");
  const srv = createAzureServer({ root, config: { forceHttps: false, bpEnv: "local" }, log: () => {} });
  const port = await listen(srv);
  try {
    const get = async (p) => (await fetch(`http://127.0.0.1:${port}${p}`)).headers.get("content-type");
    assert.equal(await get("/sitemap.xml"), "application/xml");
    assert.equal(await get("/favicon.ico"), "image/vnd.microsoft.icon");
  } finally { await close(srv); fs.rmSync(root, { recursive: true, force: true }); }
});

test("summarize يحسب التكافؤ البنيوي والكامل ويستثني المتوقّع والأخطاء", () => {
  const r = (verdict, p = "/x", extra = {}) => ({ path: p, group: "pages", verdict, diffs: [], warns: [], a: {}, b: {}, ...extra });
  const s = summarize([r("identical"), r("equivalent"), r("body-differs"), r("mismatch", "/m", { diffs: [{ sig: "الحالة 200→404" }] }), r("expected"), r("error")]);
  assert.equal(s.overall.measured, 4);
  assert.equal(s.overall.fullParityPct, 50);
  assert.equal(s.overall.structuralParityPct, 75);
  assert.equal(s.mismatchSignatures[0].count, 1);
  assert.ok(renderSummaryAr({ meta: { a: A, b: B, startedAt: "t", counts: { pages: 6, rules: 0, api: 0, misc: 0 }, sitemap: { source: "local" } }, summary: s, results: [], reachability: { a: { ok: true }, b: { ok: true } } }).includes("50%"));
});
