import test from "node:test";
import assert from "node:assert/strict";
import { contentFindings, configFindings, catalogFindings, designFindings, journeyFindings, summarize, alertDecision, ownerMessage, ownerOfFinding, contrastRatio } from "./checks.mjs";

const good = '<!DOCTYPE html><html lang="ar" dir="rtl" data-prices="off"><head><title>الخدمات — Business Partner</title><meta name="description" content="وصف كافٍ للصفحة يزيد عن عشرين حرفاً"></head><body><h1>الخدمات</h1><a class="sv1-wa-fab" href="https://wa.me/966500000000">wa</a><img src="a.png" alt="x"></body></html>';
const codes = (f) => f.map((x) => x.code).sort();

test("a healthy page has no findings", () => assert.deepEqual(codes(contentFindings("/ar/catalog", good)), []));
test("brand name, template leaks, noindex, rtl, prices flag are caught", () => {
  const bad = good.replace("الخدمات — Business", "شريك الأعمال — Business").replace('<h1>الخدمات</h1>', "<h1>undefined</h1><h1>NaN ريال</h1>").replace('dir="rtl"', 'dir="ltr"').replace(' data-prices="off"', "").replace("</head>", '<meta name="robots" content="noindex"></head>');
  const c = codes(contentFindings("/ar/x", bad));
  for (const k of ["brand-name", "template-leak", "noindex", "rtl", "prices-flag", "multi-h1"]) assert.ok(c.includes(k), k);
});
test("WhatsApp: floating/support links allowed, an inline one is flagged, /services/* exempt", () => {
  const inline = good.replace("</body>", '<a href="https://wa.me/966500000000" class="btn">راسلنا على واتساب</a></body>');
  assert.ok(codes(contentFindings("/ar/about", inline)).includes("inline-whatsapp"));
  assert.ok(!codes(contentFindings("/ar/services/x", inline)).includes("inline-whatsapp"));
  assert.ok(!codes(contentFindings("/ar/about", good.replace("</body>", '<a class="bps-wa" href="https://wa.me/1">w</a></body>'))).includes("inline-whatsapp"));
});
test("config: test mode / non-live integrations on production are critical; staging is exempt", () => {
  const live = { ok: true, testMode: false, modes: { dev: false, payments: "live", moyasar: "live", tamara: "live", whatsapp: "live", email: "live" } };
  assert.deepEqual(configFindings(live, "production"), []);
  assert.deepEqual(codes(configFindings({ ...live, testMode: true }, "production")), ["test-mode-on-prod"]);
  assert.deepEqual(codes(configFindings({ ...live, modes: { ...live.modes, payments: "test", tamara: "sandbox" } }, "production")), ["non-live-integration"]);
  assert.deepEqual(configFindings({ ...live, testMode: true, modes: { payments: "test" } }, "staging"), []);
  assert.deepEqual(codes(configFindings(null, "production")), ["config-unreadable"]);
});
test("catalog: empty, duplicates, nameless, bad price, price drift vs repo", () => {
  assert.deepEqual(codes(catalogFindings({ services: [] })), ["catalog-empty"]);
  const live = { services: [{ code: "A", nameAr: "أ", unitPrice: 100 }, { code: "A", nameAr: "أ", unitPrice: 100 }, { code: "B", unitPrice: 5 }, { code: "C", nameAr: "ج", unitPrice: 0 }, { code: "D", nameAr: "د", unitPrice: 0, openPrice: true }, { code: "E", nameAr: "هـ", unitPrice: 50 }] };
  const c = codes(catalogFindings(live, { services: [{ code: "E", unitPrice: 60 }, { code: "Z", unitPrice: 1 }] }));
  for (const k of ["catalog-duplicate", "catalog-no-name", "catalog-bad-price", "catalog-price-drift", "catalog-drift-missing"]) assert.ok(c.includes(k), k);
  assert.ok(!catalogFindings(live).some((x) => /D\b/.test(x.msg) && x.code === "catalog-bad-price" && /D,|,D$|: D/.test(x.msg)), "openPrice items are not bad prices");
});
test("design: 5xx critical, JS exception on purchase pages critical, overflow on mobile major, analytics failures ignored", () => {
  const base = { path: "/ar/checkout", viewport: "mobile", status: 200, overflowX: 0, brokenImages: [], consoleErrors: [], pageErrors: [], failedRequests: [], lowContrast: [], tinyTargets: 0, logo: true };
  assert.deepEqual(designFindings(base), []);
  assert.equal(designFindings({ ...base, status: 503 })[0].severity, "critical");
  assert.equal(designFindings({ ...base, pageErrors: ["x is not defined"] })[0].severity, "critical");
  assert.equal(designFindings({ ...base, path: "/ar/about", pageErrors: ["x"] })[0].severity, "major");
  assert.equal(designFindings({ ...base, overflowX: 40 })[0].severity, "major");
  assert.deepEqual(designFindings({ ...base, failedRequests: ["https://www.google-analytics.com/collect"] }), []);
  assert.equal(designFindings({ ...base, failedRequests: ["https://x.example/api/pay"] })[0].code, "failed-requests");
  assert.ok(Math.abs(contrastRatio([0, 0, 0], [255, 255, 255]) - 21) < 0.01);
});
test("journey: each failed step becomes a finding with its own severity (critical by default)", () => {
  const f = journeyFindings([{ id: "add", name: "أضف للسلة", ok: true }, { id: "checkout", name: "صفحة الدفع", ok: false, detail: "حقل coPhone مفقود" }, { name: "زيادة الكمية", ok: false, detail: "qty", severity: "major" }], "جوال");
  assert.equal(f.length, 2); assert.equal(f[0].code, "journey-checkout"); assert.equal(ownerOfFinding(f[0]), "cart-checkout"); assert.equal(f[0].severity, "critical"); assert.equal(f[1].severity, "major");
});
test("summary status and alert decision: need 2 consecutive runs, cooldown, recovery, minor never alerts", () => {
  const f1 = summarize([{ severity: "critical", code: "journey-x", path: "رحلة", msg: "m1" }, { severity: "minor", code: "h1", path: "/a", msg: "m2" }]);
  assert.equal(f1.status, "down"); assert.equal(summarize([{ severity: "major", code: "a", path: "p" }]).status, "degraded"); assert.equal(summarize([]).status, "ok");
  let r = alertDecision(f1.findings, null, 1e9); assert.equal(r.alerts.length, 0, "first sighting is held");
  r = alertDecision(f1.findings, r.state, 1e9 + 60000); assert.equal(r.alerts.length, 1); assert.equal(r.alerts[0].code, "journey-x");
  r = alertDecision(f1.findings, r.state, 1e9 + 120000); assert.equal(r.alerts.length, 0, "cooldown");
  // major findings cool down for 24h, critical for 6h
  let m = alertDecision([{ severity: "major", code: "a", path: "p" }], null, 1e9); m = alertDecision([{ severity: "major", code: "a", path: "p" }], m.state, 1e9 + 60000); assert.equal(m.alerts.length, 1);
  assert.equal(alertDecision([{ severity: "major", code: "a", path: "p" }], m.state, 1e9 + 8 * 3600e3).alerts.length, 0, "major: no repeat after 8h");
  r = alertDecision([], r.state, 1e9 + 180000); assert.equal(r.recovered.length, 1);
  r = alertDecision([], r.state, 1e9 + 240000); assert.equal(r.recovered.length, 0);
});
test("owner message is short, names the owning agent, and routes by file ownership", () => {
  const a = [{ severity: "critical", code: "journey-صفحة-الدفع", path: "رحلة العميل — جوال", msg: "تعطّلت الخطوة «صفحة الدفع»: حقل مفقود", fp: "x" }];
  const m = ownerMessage(a, ["x|/ar/cart"], ownerOfFinding);
  assert.match(m, /🔴 عطل يمسّ العملاء/); assert.match(m, /✅ عاد سليماً: \/ar\/cart/);
  assert.equal(ownerOfFinding({ path: "/ar/checkout", code: "x" }), "cart-checkout"); assert.equal(ownerOfFinding({ path: "/ar/my", code: "x" }), "client-portal");
  assert.equal(ownerOfFinding({ path: "/ar/packages", code: "x" }), "packages"); assert.equal(ownerOfFinding({ path: "/ar/catalog (mobile)", code: "contrast" }), "platform-engineer");
  assert.equal(ownerOfFinding({ path: "/api/live-catalog", code: "catalog-bad-price" }), "catalog-content"); assert.equal(ownerOfFinding({ path: "/ar/about", code: "x" }), "public-site"); assert.equal(ownerOfFinding({ path: "/ar (mobile)", code: "x" }), "public-site");
  assert.equal(ownerOfFinding({ path: "/api/simple?action=config", code: "test-mode-on-prod" }), "platform-engineer");
});
