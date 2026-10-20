// Business Partner — فحص التكافؤ بين الموقعين (Vercel ↔ Azure) بعد النقل.
//
// يقارن الاستجابات نفسها على عنوانين: A هو المرجع (الموقع الحيّ على Vercel) و B هو
// المرشّح (Azure). قراءة فقط: كل الطلبات GET/HEAD، ولا يُرسل جسماً ولا يغيّر شيئاً.
//
//   node ops/azure/parity.mjs --a https://www.businesspartner.sa --b https://<نقطة-أزور>
//   node ops/azure/parity.mjs --a … --b https://www.businesspartner.sa --resolve-b 20.1.2.3
//                       (اختبار Azure بالاسم الحقيقي قبل تحويل DNS: يتّصل بالعنوان
//                        المعطى ويبقى الاسم والشهادة كما هما — انظر الخطة §8)
//   node ops/azure/parity.mjs --list                 يطبع الفحوص بلا شبكة
//   خيارات: --sample N (صفحات ثابتة، 60)  --body (قارن أجسام الصفحات بالبصمة)
//           --strict-body (اختلاف الجسم = فشل)  --apex (افحص الأبكس → www)
//           --skip-api (staging: وضع المعاينة يغيّر ردود الدفع عمداً فلا تُقارن)
//           --json  --timeout S (20)  --concurrency N (6)
//
// ما يفحصه:
//   ١. كل redirect في vercel.json: عيّنة تُولَّد من المصدر نفسه → الحالة والوجهة متطابقتان
//   ٢. كل rewrite: الحالة ونوع المحتوى (والوجهة إن كان تحويلاً من الأصل الخارجي)
//   ٣. cleanUrls والشرطة الأخيرة و404
//   ٤. عيّنة ثابتة من الصفحات المبنيّة: الحالة ونوع المحتوى وCache-Control (وبصمة الجسم)
//   ٥. دوال api/ (GET فقط): الحالة وشكل JSON (مفاتيح المستوى الأول، لا القيم)
//   ٦. ترويسات الأمان (HSTS)
// اختلافات مقصودة تُعلَّم «متوقّع» ولا تُسقط الفحص: /scripts/* (مغلق على Azure)،
// وdbDriver في /api/otp (supabase ↔ azure).
//
// الخروج: 0 كل شيء متطابق · 1 فشل واحد على الأقل · 2 خطأ استعمال.

import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import crypto from "node:crypto";
import dns from "node:dns";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parsePattern, loadRouting } from "./routing.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// ------------------------------------------------------------- عيّنات -----
// يولّد مساراً يطابق مصدر قاعدة: أول بديل في كل مجموعة، "x" للمعامل العادي، "a/b" للمتكرّر.
export function sampleFromSource(source) {
  let out = "";
  for (const t of parsePattern(source)) {
    if (typeof t === "string") { out += t; continue; }
    let v;
    const alt = /^[A-Za-z0-9_-]+(\|[A-Za-z0-9_-]+)*$/.test(t.pattern) ? t.pattern.split("|")[0] : "x";
    if (t.modifier === "*" || t.modifier === "+") v = `${alt}/b`.replace(/^x\/b$/, "a/b");
    else v = alt;
    out += t.prefix + v;
  }
  return out || "/";
}

function listPages(siteDir) {
  const out = [];
  (function walk(d, rel) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) { if (!["scripts", "node_modules"].includes(e.name) || rel) walk(path.join(d, e.name), `${rel}/${e.name}`); }
      else if (e.name.endsWith(".html")) out.push(`${rel}/${e.name}`);
    }
  })(siteDir, "");
  return out.sort();
}

const pageUrl = (rel) => rel.replace(/\/index\.html$/, "").replace(/\.html$/, "") || "/";

// عيّنة حتمية: كل الصفحات في الجذر ثم موزَّعة بالتساوي على الباقي.
export function sampleStaticPages(siteDir, n) {
  const all = listPages(siteDir).map(pageUrl);
  const top = all.filter((u) => u.split("/").length <= 2);
  const rest = all.filter((u) => u.split("/").length > 2);
  const picked = new Set(["/", ...top.slice(0, Math.floor(n / 2))]);
  const step = Math.max(1, Math.floor(rest.length / Math.max(1, n - picked.size)));
  for (let i = 0; i < rest.length && picked.size < n; i += step) picked.add(rest[i]);
  return [...picked];
}

export function buildChecks({ vercelJson, siteDir, sample = 60, apex = false, skipApi = false }) {
  const routing = loadRouting(vercelJson);
  const checks = [];
  const add = (c) => checks.push(c);

  routing.redirects.forEach((r, i) => {
    const p = sampleFromSource(r.source);
    const host = (r.has || []).find((c) => c.type === "host");
    add({ id: `redirect[${i}] ${r.source}`, kind: "redirect", path: p + "?pq=1", host: host && host.value });
  });
  routing.rewrites.forEach((r, i) => {
    const host = (r.has || []).find((c) => c.type === "host");
    if (host) return; // يحتاج مضيفاً حقيقياً (hr.businesspartner.sa لا يُحلّ اليوم)
    const p = sampleFromSource(r.source);
    add({ id: `rewrite[${i}] ${r.source}`, kind: "rewrite", path: p });
  });
  for (const p of ["/about/", "/about.html", "/index.html", "/ar/", "/does-not-exist-parity-check", "/Revenue-OS"]) {
    add({ id: `urls ${p}`, kind: "urls", path: p });
  }
  for (const p of sampleStaticPages(siteDir, sample)) add({ id: `page ${p}`, kind: "page", path: p });
  add({ id: "asset immutable header", kind: "asset", path: "/assets/css/b10x-theme.css" });
  add({ id: "apple-pay association", kind: "page", path: "/.well-known/apple-developer-merchantid-domain-association" });
  add({ id: "robots", kind: "page", path: "/robots.txt" });
  if (!skipApi) for (const p of ["/api/otp", "/api/pay", "/api/simple", "/api/no-such-function-parity"]) add({ id: `api ${p}`, kind: "api", path: p });
  add({ id: "build scripts closed (expected diff)", kind: "expected-diff", path: "/scripts/verify-api.mjs" });
  if (apex) add({ id: "apex → www", kind: "apex", path: "/" });
  return checks;
}

// -------------------------------------------------------------- شبكة -----
export function request(baseUrl, p, { method = "GET", host, resolveIp, timeoutS = 20, maxBytes = 3 * 1024 * 1024 } = {}) {
  const u = new URL(p, baseUrl);
  const mod = u.protocol === "http:" ? http : https;
  const headers = { "user-agent": "bp-azure-parity/1.0", accept: "*/*", "accept-encoding": "identity" };
  if (host) headers.host = host;
  const opts = { method, hostname: u.hostname, port: u.port || undefined, path: u.pathname + u.search, headers, timeout: timeoutS * 1000 };
  if (resolveIp) opts.lookup = (_h, _o, cb) => cb(null, resolveIp, resolveIp.includes(":") ? 6 : 4);
  if (host && u.protocol === "https:") opts.servername = host.replace(/:\d+$/, "");
  return new Promise((resolve) => {
    const req = mod.request(opts, (res) => {
      const chunks = []; let size = 0;
      res.on("data", (c) => { size += c.length; if (size <= maxBytes) chunks.push(c); });
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks), truncated: size > maxBytes }));
      res.on("error", (e) => resolve({ error: String(e.message || e) }));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (e) => resolve({ error: String(e.message || e) }));
    req.end();
  });
}

const sha = (b) => crypto.createHash("sha256").update(b).digest("hex").slice(0, 16);
const ctype = (r) => String((r.headers && r.headers["content-type"]) || "").toLowerCase();

function jsonKeys(buf) {
  try { const j = JSON.parse(buf.toString("utf8")); return j && typeof j === "object" ? Object.keys(j).sort().join(",") : typeof j; }
  catch { return null; }
}

// يقارن استجابتين لفحصٍ واحد → { level: pass|fail|warn|expected, notes: [] }
export function compare(check, a, b, { body = false, strictBody = false } = {}) {
  const notes = [];
  if (a.error || b.error) return { level: "fail", notes: [`شبكة: A=${a.error || "ok"} B=${b.error || "ok"}`] };
  let fail = false, warn = false;
  const need = (cond, msg) => { if (!cond) { fail = true; notes.push(msg); } };

  if (check.kind === "expected-diff") {
    notes.push(`A=${a.status} B=${b.status}`);
    return { level: b.status === 404 ? "expected" : "fail", notes: b.status === 404 ? notes : [...notes, "B يخدم /scripts/ — يجب أن يكون مغلقاً"] };
  }
  if (check.kind === "apex") {
    need(b.status === 308 && /^https:\/\/www\.businesspartner\.sa\/?$/.test(b.headers.location || ""), `B apex → ${b.status} ${b.headers.location || ""} (المتوقّع 308 → https://www.businesspartner.sa/)`);
    return { level: fail ? "fail" : "pass", notes };
  }

  need(a.status === b.status, `الحالة A=${a.status} B=${b.status}`);
  if (check.kind === "redirect" || (a.status >= 300 && a.status < 400)) {
    need((a.headers.location || "") === (b.headers.location || ""), `Location A=${a.headers.location} B=${b.headers.location}`);
  } else {
    need(ctype(a).split(";")[0] === ctype(b).split(";")[0], `Content-Type A=${ctype(a)} B=${ctype(b)}`);
  }
  if (check.kind === "rewrite" && a.headers.location !== undefined) {
    need((a.headers.location || "") === (b.headers.location || ""), `Location A=${a.headers.location} B=${b.headers.location}`);
  }
  if (check.kind === "page" || check.kind === "asset") {
    need((a.headers["cache-control"] || "") === (b.headers["cache-control"] || ""), `Cache-Control A=${a.headers["cache-control"]} B=${b.headers["cache-control"]}`);
    if (check.kind === "asset") need(/immutable/.test(String(b.headers["cache-control"])), "B بلا immutable على /assets/");
    if (body && a.status === 200 && !a.truncated && !b.truncated && sha(a.body) !== sha(b.body)) {
      if (strictBody) { fail = true; } else { warn = true; }
      notes.push(`الجسم يختلف (A ${a.body.length}B/${sha(a.body)} ← B ${b.body.length}B/${sha(b.body)}) — راجع متغيّرات بيئة البناء`);
    }
  }
  if (check.kind === "api") {
    const ka = jsonKeys(a.body), kb = jsonKeys(b.body);
    if (ka !== null || kb !== null) {
      const strip = (s) => (s === null ? null : s.split(",").filter((k) => k !== "dbDriver").join(","));
      need(strip(ka) === strip(kb), `مفاتيح JSON A=[${ka}] B=[${kb}]`);
    }
  }
  // HSTS مطلوب على كل عنوان https (يضيفه Vercel لكل استجابة، والمتصفحات حفظته منذ سنتين).
  need(!!b.headers["strict-transport-security"] || /^http:/.test(String(check.base || "")), "B بلا Strict-Transport-Security");
  return { level: fail ? "fail" : warn ? "warn" : "pass", notes };
}

async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

export async function runParity({ a, b, resolveB, resolveA, vercelJson, siteDir, sample = 60, apex = false, skipApi = false, body = false, strictBody = false, timeoutS = 20, concurrency = 6, log = () => {} }) {
  const checks = buildChecks({ vercelJson, siteDir, sample, apex, skipApi });
  const results = await pool(checks, concurrency, async (c) => {
    const hostA = c.host, hostB = c.host;
    const baseA = c.kind === "apex" ? a.replace("://www.", "://") : a;
    const baseB = c.kind === "apex" ? b.replace("://www.", "://") : b;
    const [ra, rb] = await Promise.all([
      request(baseA, c.path, { host: hostA, resolveIp: resolveA, timeoutS }),
      request(baseB, c.path, { host: hostB, resolveIp: resolveB, timeoutS }),
    ]);
    const r = compare({ ...c, base: b }, ra, rb, { body, strictBody });
    log(c, r);
    return { ...c, ...r, a: ra.status, b: rb.status };
  });
  const count = (l) => results.filter((r) => r.level === l).length;
  return { results, pass: count("pass"), fail: count("fail"), warn: count("warn"), expected: count("expected") };
}

// ------------------------------------------------------------ واجهة ------
function parseArgs(argv) {
  const o = { sample: 60, timeout: 20, concurrency: 6 };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    const val = () => argv[++i];
    if (k === "--a") o.a = val(); else if (k === "--b") o.b = val();
    else if (k === "--resolve-a") o.resolveA = val(); else if (k === "--resolve-b") o.resolveB = val();
    else if (k === "--sample") o.sample = Number(val()); else if (k === "--timeout") o.timeout = Number(val());
    else if (k === "--concurrency") o.concurrency = Number(val());
    else if (k === "--body") o.body = true; else if (k === "--strict-body") { o.body = true; o.strictBody = true; }
    else if (k === "--skip-api") o.skipApi = true; else if (k === "--apex") o.apex = true; else if (k === "--json") o.json = true; else if (k === "--list") o.list = true;
    else { console.error(`خيار غير معروف: ${k}`); process.exit(2); }
  }
  return o;
}

async function main() {
  const o = parseArgs(process.argv);
  const vercelJson = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  const siteDir = path.join(ROOT, "site");
  if (o.list) {
    for (const c of buildChecks({ vercelJson, siteDir, sample: o.sample, apex: o.apex, skipApi: o.skipApi })) console.log(`${c.kind.padEnd(13)} ${c.id}   ${c.path}`);
    return 0;
  }
  if (!o.a || !o.b) { console.error("استعمال: --a <المرجع> --b <المرشّح>  (أو --list)"); return 2; }
  for (const u of [o.a, o.b]) if (!/^https?:\/\//.test(u)) { console.error(`عنوان غير صالح: ${u}`); return 2; }
  dns.setDefaultResultOrder("ipv4first");
  const rep = await runParity({
    a: o.a, b: o.b, resolveA: o.resolveA, resolveB: o.resolveB, vercelJson, siteDir,
    sample: o.sample, apex: o.apex, skipApi: o.skipApi, body: o.body, strictBody: o.strictBody, timeoutS: o.timeout, concurrency: o.concurrency,
  });
  if (o.json) console.log(JSON.stringify(rep, null, 2));
  else {
    for (const r of rep.results) {
      if (r.level === "pass") continue;
      console.log(`${r.level.toUpperCase().padEnd(8)} ${r.id}  (${r.path})\n           ${r.notes.join("\n           ")}`);
    }
    console.log(`\nتكافؤ: ${rep.pass} متطابق · ${rep.fail} فشل · ${rep.warn} تنبيه · ${rep.expected} اختلاف متوقّع · من ${rep.results.length} فحصاً`);
  }
  return rep.fail ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((c) => process.exit(c), (e) => { console.error(String(e && e.stack || e)); process.exit(1); });
}
