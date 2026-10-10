// تسوية الدفع لعناصر الباقات: api/pay.js settlePaidOrder · catalogKey
//
// شغّله: npm test
//
// الباقة تُضاف إلى السلة بمعرّف تبنيه الصفحة لا الكتالوج:
//   pkg-starter-4-monthly  (الشهري)   pkg-starter-4-yearly  (السنوي)  BP-PKG-SVC-STARTER (الرمز)
// وكان التحقق لا يطابق أياً منها، فيدخل الدفع مراجعة المالك والعميل يرى «تمّ».
// المقاس هنا:
//   ① الشهري والرمز وأسماء اللوحة (PKG-S) تُطابَق ويُصادَق على المبلغ.
//   ② السنوي لا يُسعَّر من الخادم (رقمه ليس في الكتالوج) فيبقى في مراجعة المالك — لا يمرّ
//      بسعر شهري دُفع عن سنة، ولا بمبلغٍ ناقص.
//   ③ ما سوى ذلك لم يتغيّر: خدمة مفردة تُصادَق، ومبلغ لا يطابق يقع في المراجعة.
//   ④ تمارا لا تُفتح لبند باقة شهرية (كما كان) رغم أنه صار يُسعَّر للبطاقة.
//
// نداء الدفع يمرّ على handler الحقيقي ببوابة الاختبار المحلية، والشبكة مُحاكاة بالكامل:
// الكتالوج من القرص، و/api/requests يردّ ok — فلا شيء يغادر الجهاز.
//
// كل حالة في عملية فرعية لأن api/pay.js يقرأ بيئته مرة واحدة عند الاستيراد.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PROBE = `
import fs from "node:fs";
const catalog = JSON.parse(fs.readFileSync(${JSON.stringify(path.join(ROOT, "site/assets/data/catalog.json"))}, "utf8"));
const sealed = [];
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.startsWith("http://catalog.test/")) return new Response(JSON.stringify(catalog), { status: 200 });
  if (u.endsWith("/api/requests")) {
    const body = JSON.parse(opts.body);
    sealed.push(body.action);
    return new Response(JSON.stringify({ ok: true, already: false, activated: {} }), { status: 200 });
  }
  return new Response("{}", { status: 404 });
};
const { default: handler } = await import(${JSON.stringify(path.join(ROOT, "api", "pay.js"))});
const jobs = JSON.parse(process.env.JOBS);
const out = [];
let n = 0;
for (const job of jobs) {
  let body = "";
  const res = { statusCode: 200, setHeader() {}, end(b) { body = b; } };
  const req = {
    method: "POST", headers: {}, query: {}, url: "/api/pay",
    body: { id: "mock_" + (++n) + "abcdefghij", amount: job.amount, order: {
      ref: "BP-T" + n, name: "Test", email: "buyer@example.com", phone: "0500000000", items: job.items } },
  };
  await handler(req, res);
  out.push(JSON.parse(body));
}
console.log("RESULT " + JSON.stringify(out));
`;

function run(jobs) {
  const env = {
    PATH: process.env.PATH, APP_ENV: "development", LOCAL_DB: "1",
    OTP_SECRET: "unit-test-secret-never-used-elsewhere",
    CATALOG_URL: "http://catalog.test/catalog.json",
    MKT_SITE_BASE: "http://localhost.test",
    JOBS: JSON.stringify(jobs),
  };
  const outp = execFileSync(process.execPath, ["--input-type=module", "-e", PROBE], { env, encoding: "utf8", cwd: ROOT });
  const line = outp.split("\n").filter((l) => l.startsWith("RESULT ")).pop();
  assert.ok(line, "no RESULT line in: " + outp.slice(-400));
  return JSON.parse(line.slice(7));
}

// المبلغ المدفوع بالريال شاملاً ضريبة ١٥٪ لصافٍ معيّن.
const gross = (net) => Math.round(net * 1.15 * 100) / 100;

test("monthly package id (pkg-<key>-monthly) is matched and the amount verified", () => {
  const [r] = run([{ amount: gross(2500), items: [{ id: "pkg-starter-4-monthly", qty: 1 }] }]);
  assert.equal(r.ok, true);
  assert.equal(r.settle.ok, true);
  assert.equal(r.settle.verified, true, "the monthly package must price from the catalogue");
  assert.match(r.settle.ref, /^BP-T/);
});

test("package code (BP-PKG-*) and the live-price panel's alias (PKG-S) are matched", () => {
  const rs = run([
    { amount: gross(2500), items: [{ id: "BP-PKG-SVC-STARTER", qty: 1 }] },
    { amount: gross(2500), items: [{ id: "PKG-S", qty: 1 }] },
    { amount: gross(6000), items: [{ id: "pkg-silver", qty: 1 }] },
    { amount: gross(6000), items: [{ id: "PKG-SILVER", qty: 1 }] },
    { amount: gross(6000), items: [{ id: "BP-PKG-LAUNCH-monthly", qty: 1 }] },
    { amount: gross(30000), items: [{ id: "pkg-foreign-formation", qty: 1 }] },
  ]);
  rs.forEach((r, i) => assert.equal(r.settle.verified, true, "case " + i));
});

test("monthly package with a quantity and a plain service in the same basket", () => {
  const [r] = run([{ amount: gross(2500 * 2 + 1000), items: [{ id: "pkg-starter-4-monthly", qty: 2 }, { id: "svc-bp-ai-03", qty: 1 }] }]);
  assert.equal(r.settle.verified, true);
});

test("yearly package id is NOT priced by the server: it falls to owner review", () => {
  const rs = run([
    // the page's yearly figure (2500 x 12 less 30%) — not in the catalogue
    { amount: gross(21000), items: [{ id: "pkg-starter-4-yearly", qty: 1 }] },
    // a monthly price paid for a yearly line must never verify
    { amount: gross(2500), items: [{ id: "pkg-starter-4-yearly", qty: 1 }] },
  ]);
  for (const r of rs) {
    assert.equal(r.ok, true, "the payment itself still succeeds");
    assert.equal(r.settle.ok, true, "and is recorded");
    assert.equal(r.settle.verified, false, "but is held for review");
  }
});

test("an amount that does not match the package price is held for review", () => {
  const [under, over] = run([
    { amount: gross(100), items: [{ id: "pkg-starter-4-monthly", qty: 1 }] },
    { amount: gross(2500) + 50, items: [{ id: "pkg-starter-4-monthly", qty: 1 }] },
  ]);
  assert.equal(under.settle.verified, false);
  assert.equal(over.settle.verified, false);
});

test("unknown package and unknown service still fall to review (rule unchanged)", () => {
  const rs = run([
    { amount: gross(2500), items: [{ id: "pkg-nonexistent-monthly", qty: 1 }] },
    { amount: gross(1000), items: [{ id: "pkg-starter-4-monthly", qty: 1 }, { id: "svc-does-not-exist", qty: 1 }] },
  ]);
  for (const r of rs) assert.equal(r.settle.verified, false);
});

test("a plain priced service is still verified", () => {
  const [r] = run([{ amount: gross(1000), items: [{ id: "svc-bp-ai-03", qty: 1 }] }]);
  assert.equal(r.settle.verified, true);
});

test("the -monthly suffix is only stripped from packages, never from a service code", async () => {
  const src = (await import("node:fs")).readFileSync(path.join(ROOT, "api/pay.js"), "utf8");
  assert.match(src, /PKG_MONTHLY_RE = \/\^\(\?:bp-\)\?pkg-\.\+-monthly\$\//);
  // a service-shaped id ending in -monthly does not match the package pattern
  const re = /^(?:bp-)?pkg-.+-monthly$/;
  assert.equal(re.test("svc-bp-ai-03-monthly"), false);
  assert.equal(re.test("employer-plan-pro-monthly"), false);
  assert.equal(re.test("pkg-starter-4-monthly"), true);
  assert.equal(re.test("pkg-starter-4-yearly"), false);
});

test("PKG_ALIAS in pay.js mirrors live-prices.js (a drifted table prices the wrong package)", async () => {
  const fs = await import("node:fs");
  const live = fs.readFileSync(path.join(ROOT, "site/assets/js/live-prices.js"), "utf8");
  const pay = fs.readFileSync(path.join(ROOT, "api/pay.js"), "utf8");
  const pairs = (txt, from) => {
    const block = txt.slice(txt.indexOf(from));
    const body = block.slice(block.indexOf("{"), block.indexOf("}"));
    return [...body.matchAll(/"(BP-PKG-[A-Z-]+)"\s*:\s*"(PKG-[A-Z-]+)"/g)].map((m) => m[1] + "=" + m[2]).sort();
  };
  const a = pairs(live, "var PKG_ALIAS");
  const b = pairs(pay, "const PKG_ALIAS");
  assert.ok(a.length >= 11);
  assert.deepEqual(b, a);
});

test("Tamara is not opened to a monthly package line (status quo kept)", async () => {
  // bnpl-checkout answers 503 not_configured before it reaches the basket when Tamara has no
  // token, so the guard is asserted at the source: the monthly-package line is marked unknown
  // exactly where the other unpriceable lines are.
  const fs = await import("node:fs");
  const code = fs.readFileSync(path.join(ROOT, "api/pay.js"), "utf8");
  const seg = code.slice(code.indexOf('b.action === "bnpl-checkout"'), code.indexOf('b.action === "bnpl-verify"'));
  assert.match(seg, /if \(isMonthlyPkgId\(x\.id\)\) \{ unknown = true; continue; \}/);
});
