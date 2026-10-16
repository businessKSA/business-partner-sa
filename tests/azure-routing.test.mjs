// تكافؤ إعداد الاستضافة على Azure مع vercel.json: كل redirect وrewrite وheader ودالة
// ومهمة مجدولة له مقابل في محرّك ops/azure/routing.mjs، والمحرّك يعطي ما يعطيه Vercel
// على الموقع الحيّ (الحالات المثبَّتة أدناه أُخذت بـGET من الموقع الحيّ 2026-10-11).
//
// المحرّك يقرأ vercel.json نفسه لا نسخة منه، فلا يتقادم شيء — لكن إن أضاف أحدهم صيغة
// مصدر لا يفهمها المحرّك (مثل {a,b} أو * عارية) سقط هذا الاختبار باسم القاعدة، لا
// الإنتاج على Azure بعد النقل.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parsePattern, compileSource, matchSource, fillTemplate, mergeQuery, loadRouting,
  findRedirect, findRewrite, findHeaders, maxDurationFor, statusOf, isExternal,
} from "../ops/azure/routing.mjs";
import { sampleFromSource } from "../ops/azure/parity.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
const routing = loadRouting(vercel);
const at = (pathname, search = "", host = "www.businesspartner.sa") => ({ pathname, search, host });

test("vercel.json: every source compiles in the Azure routing engine", () => {
  assert.doesNotThrow(() => loadRouting(vercel));
  assert.equal(routing.redirects.length, (vercel.redirects || []).length);
  assert.equal(routing.rewrites.length, (vercel.rewrites || []).length);
  assert.equal(routing.headers.length, (vercel.headers || []).length);
});

test("every redirect has a counterpart: a path built from its source reaches a redirect with a resolved destination", () => {
  for (const [i, r] of vercel.redirects.entries()) {
    const sample = sampleFromSource(r.source);
    const hit = findRedirect(routing, at(sample));
    assert.ok(hit, `redirects[${i}] ${r.source}: لا يطابق مسار العيّنة ${sample}`);
    assert.ok([301, 302, 307, 308].includes(hit.status), `redirects[${i}] status ${hit.status}`);
    assert.ok(!/:[A-Za-z_]/.test(hit.location.replace(/^https?:\/\//, "")), `redirects[${i}] ${r.source}: معامل لم يُملأ في ${hit.location}`);
    // لا تظلّل قاعدةٌ سابقة هذه القاعدة بوجهة مختلفة (وإلا صارت ميتة)
    if (hit.rule !== routing.redirects[i]) {
      const mine = fillTemplate(r.destination, matchSource(routing.redirects[i]._c, sample));
      assert.equal(hit.location, mergeQuery(mine, ""), `redirects[${i}] ${r.source} مظلَّلة بقاعدة سابقة وجهتها مختلفة`);
    }
  }
});

test("every rewrite has a counterpart (host-conditioned ones need their host)", () => {
  for (const [i, r] of vercel.rewrites.entries()) {
    const sample = sampleFromSource(r.source);
    const hostCond = (r.has || []).find((c) => c.type === "host");
    const hit = findRewrite(routing, at(sample, "", hostCond ? hostCond.value : "www.businesspartner.sa"));
    assert.ok(hit, `rewrites[${i}] ${r.source}: لا يطابق ${sample}`);
    assert.equal(hit.external, isExternal(r.destination), `rewrites[${i}] external`);
    assert.ok(!/:[A-Za-z_]\w*\*?/.test(hit.destination.replace(/^https?:\/\/[^/]+/, "").replace(/\?.*/, "")), `rewrites[${i}] معامل لم يُملأ في ${hit.destination}`);
  }
});

test("host-conditioned rewrites only fire for their host", () => {
  const rule = vercel.rewrites.find((r) => (r.has || []).some((c) => c.type === "host"));
  assert.ok(rule, "vercel.json فيه قاعدة بشرط host");
  assert.equal(findRewrite(routing, at(rule.source, "", "www.businesspartner.sa"))?.rule, undefined,
    "على www لا تنطبق قاعدة hr (ولا قاعدة أخرى لهذا المسار)");
  assert.ok(findRewrite(routing, at(rule.source, "", "hr.businesspartner.sa")));
});

test("every headers rule applies to a path built from its source", () => {
  for (const [i, h] of vercel.headers.entries()) {
    const sample = sampleFromSource(h.source.replace(/\(\.\*\)/, "x"));
    const got = findHeaders(routing, sample);
    for (const kv of h.headers) assert.equal(got[kv.key.toLowerCase()], kv.value, `headers[${i}] ${h.source} → ${kv.key}`);
  }
  assert.match(findHeaders(routing, "/assets/js/main.js")["cache-control"], /immutable/);
  assert.equal(findHeaders(routing, "/about")["cache-control"], undefined, "غير /assets/ لا تأخذ immutable");
});

test("every function entry in vercel.json maps to a real, non-underscore api file with its duration", () => {
  for (const [k, v] of Object.entries(vercel.functions || {})) {
    const m = /^api\/([A-Za-z0-9-]+)\.js$/.exec(k);
    assert.ok(m, `functions["${k}"] مفتاح غير مدعوم`);
    assert.ok(fs.existsSync(path.join(ROOT, k)), `${k} غير موجود`);
    assert.equal(maxDurationFor(routing, `${m[1]}.js`, null, 99), v.maxDuration);
  }
  assert.equal(maxDurationFor(routing, "chat.js", null, 30), 60, "chat/requests/candidate 60 ثانية");
  assert.equal(maxDurationFor(routing, "requests.js", null, 30), 60);
  assert.equal(maxDurationFor(routing, "candidate.js", null, 30), 60);
  // candidates.js يطلب 300 داخل الملف لكن vercel.json (60) يغلب كما عند Vercel
  assert.equal(maxDurationFor(routing, "candidates.js", { maxDuration: 300 }, 30), 60);
  assert.equal(maxDurationFor(routing, "hire.js", { maxDuration: 60 }, 30), 60, "إعلان الملف يُحترم إن لم يذكره vercel.json");
  assert.equal(maxDurationFor(routing, "otp.js", undefined, 30), 30, "الافتراضي");
});

test("every cron targets a real api function and is a valid 5-field UTC schedule", async () => {
  const { cronJobs } = await import("../ops/azure/cron.mjs");
  const jobs = cronJobs(vercel);
  assert.equal(jobs.length, vercel.crons.length);
  for (const j of jobs) {
    const name = new URL(j.path, "http://x").pathname.replace(/^\/api\//, "");
    assert.ok(fs.existsSync(path.join(ROOT, "api", `${name}.js`)) && !name.startsWith("_"), `${j.path} ليس دالة`);
    assert.equal(j.schedule.trim().split(/\s+/).length, 5, `${j.schedule} ليس cron بخمسة حقول`);
    assert.match(j.name, /^bp-cron-\d+-[a-z0-9-]+$/);
  }
  assert.equal(new Set(jobs.map((j) => j.name)).size, jobs.length, "أسماء المهام فريدة (اسم مورد Azure)");
});

test("external rewrite targets are https and listed (a new proxy origin should be a conscious decision)", () => {
  const origins = new Set(vercel.rewrites.filter((r) => isExternal(r.destination)).map((r) => new URL(r.destination.replace(/:[A-Za-z_]\w*\*?.*$/, "")).origin));
  for (const o of origins) assert.match(o, /^https:\/\//, `${o} ليس https`);
  assert.deepEqual([...origins].sort(), ["https://bp-quotes-three.vercel.app"],
    "أصل خارجي جديد في rewrites: راجع docs/azure-migration-2026-10-11.md §4 (bp-quotes يبقى على Vercel حتى ينتقل)");
});

// ---- دلالات تحقّقنا منها على الموقع الحيّ بـGET ----------------------------
test("semantics verified live: permanent→308, temporary→307, query appended, case-sensitive", () => {
  assert.deepEqual(pick(findRedirect(routing, at("/revenue-os"))), { status: 308, location: "/business-development" });
  assert.deepEqual(pick(findRedirect(routing, at("/ar/revenue-os", "?x=1"))), { status: 308, location: "/ar/business-development?x=1" });
  assert.deepEqual(pick(findRedirect(routing, at("/client-portal"))), { status: 307, location: "/account" });
  assert.deepEqual(pick(findRedirect(routing, at("/hr/employer/a/b", "?x=1"))), { status: 307, location: "/employer?x=1" });
  assert.equal(findRedirect(routing, at("/Revenue-OS")), null, "المطابقة حسّاسة لحالة الأحرف");
});

test("hidden-service redirects (managed by hidden.mjs) keep their language split", () => {
  assert.deepEqual(pick(findRedirect(routing, at("/business-development"))), { status: 302, location: "/catalog" });
  assert.deepEqual(pick(findRedirect(routing, at("/fr/business-development"))), { status: 302, location: "/fr/catalog" });
  assert.deepEqual(pick(findRedirect(routing, at("/es/business-development"))), { status: 302, location: "/catalog" });
  assert.deepEqual(pick(findRedirect(routing, at("/ar/services/rev-pro"))), { status: 302, location: "/ar/catalog" });
});

test("rewrites: query merge — destination wins, original extras are kept", () => {
  const hit = findRewrite(routing, at("/api/simple", "?__route=evil&a=1"));
  assert.equal(hit.destination, "/api/requests?__route=simple&a=1");
  const q = findRewrite(routing, at("/quotes/d/abc", "?t=1"));
  assert.equal(q.destination, "https://bp-quotes-three.vercel.app/quotes/d/abc?t=1");
  assert.equal(q.external, true);
  assert.equal(findRewrite(routing, at("/quotes")).destination, "https://bp-quotes-three.vercel.app/quotes");
});

test("path-to-regexp subset: named, alternation, repeated, unsupported syntax throws", () => {
  const m = (src, p) => matchSource(compileSource(src), p);
  assert.deepEqual(m("/:lang(ar|fr)/x", "/ar/x"), { lang: "ar" });
  assert.equal(m("/:lang(ar|fr)/x", "/de/x"), null);
  assert.deepEqual(m("/a/:rest*", "/a"), {});
  assert.deepEqual(m("/a/:rest*", "/a/b/c"), { rest: "b/c" });
  assert.equal(m("/a/:rest+", "/a"), null);
  assert.deepEqual(m("/a/:id", "/a/7/"), { id: "7" }, "شرطة أخيرة اختيارية");
  assert.equal(fillTemplate("/x/:rest*", { rest: "" }), "/x");
  assert.equal(fillTemplate("/x/:rest*", { rest: "b/c" }), "/x/b/c");
  for (const bad of ["/a/{b,c}", "/a/*", "/a/b+", "/:/x"]) assert.throws(() => parsePattern(bad), /routing/, bad);
});

test("statusOf: explicit statusCode wins over permanent", () => {
  assert.equal(statusOf({ statusCode: 302, permanent: true }), 302);
  assert.equal(statusOf({ permanent: true }), 308);
  assert.equal(statusOf({}), 307);
});

function pick(h) { return h && { status: h.status, location: h.location }; }
