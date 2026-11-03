// اختبار دخان لنسخة الموقع على Azure — قراءة فقط، لا يرسل شيئاً ولا يدفع.
// الاستعمال: node azure/site/smoke.mjs https://<fqdn-of-bp-site-staging>
const base = (process.argv[2] || "").replace(/\/$/, "");
if (!base) { console.error("usage: node azure/site/smoke.mjs <base-url>"); process.exit(2); }

const pages = ["/", "/catalog", "/cart", "/checkout", "/my", "/ops", "/account", "/packages",
  "/services", "/contact", "/careers", "/deals", "/quote", "/robots.txt", "/sitemap.xml"];
const apis = [ // GET آمنة فقط
  ["/healthz", [200]],
  ["/api/live-catalog", [200]],
  ["/api/chat", [200, 204, 400, 401, 405]],      // لا نرسل رسالة؛ يكفي أن الدالة تُحمَّل
  ["/api/requests", [200, 204, 400, 401, 405]],
  ["/api/simple", [200, 204, 400, 401, 405]],
];
let fail = 0;
const row = (ok, name, info) => { if (!ok) fail++; console.log(`${ok ? "OK  " : "FAIL"} ${name} ${info}`); };

// الحاوية تنام عند انعدام الطلبات؛ أول طلب قد يتجاوز المهلة (بدء بارد) فنعيده مرة.
const get = async (u, opt) => {
  try { return await fetch(u, { ...opt, signal: AbortSignal.timeout(30000) }); }
  catch { return await fetch(u, { ...opt, signal: AbortSignal.timeout(30000) }); }
};
for (const p of pages) {
  try {
    const r = await get(base + p, { redirect: "manual" });
    row([200, 301, 302, 308].includes(r.status), p, r.status);
  } catch (e) { row(false, p, e.message); }
}
for (const [p, okc] of apis) {
  try {
    const r = await fetch(base + p, { signal: AbortSignal.timeout(15000) });
    const t = await r.text();
    const crashed = r.status >= 500 || /FUNCTION_INVOCATION_FAILED|SyntaxError|Cannot find/.test(t);
    row(okc.includes(r.status) && !crashed, p, r.status);
  } catch (e) { row(false, p, e.message); }
}
// الأمان: لوحة المالك لا تُفتح بلا مفتاح
try {
  const r = await fetch(base + "/api/simple?action=ops-inbox-feed", { signal: AbortSignal.timeout(15000) });
  row([401, 403, 405].includes(r.status), "ops-inbox-feed بلا مفتاح مرفوض", r.status);
} catch (e) { row(false, "ops-inbox-feed", e.message); }

console.log(fail ? `\n${fail} فشل` : "\nكل الفحوص نجحت");
process.exit(fail ? 1 : 0);
