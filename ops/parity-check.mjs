#!/usr/bin/env node
// Business Partner — اختبار تكافؤ كامل بين الموقع الحيّ (Vercel) ونسخة التجريب (Azure).
//
// يقارن مسارات الموقع كلها (من sitemap.xml) ونقاط GET الآمنة من الـAPI على عنوانين:
//   A = المرجع  (https://www.businesspartner.sa)
//   B = المرشّح (https://azure.businesspartner.sa)
// قراءة فقط: GET حصراً، بلا جسم ولا ترويسة Authorization ولا كوكيز، ولا يُستدعى أي مسار
// له أثر جانبي (المهام المجدولة، mock-form، backfill…) — القائمة البيضاء في API_GET_PROBES
// ومرشّح FORBIDDEN يمنعان ذلك حتى مع --extra-api.
//
//   node ops/parity-check.mjs                                  كل شيء بالافتراضيات
//   node ops/parity-check.mjs --sample 150                     عيّنة 150 صفحة + كل فحوص الـAPI
//   node ops/parity-check.mjs --only api,rules                 مجموعات محددة (pages,rules,api,misc)
//   node ops/parity-check.mjs --list                           يطبع المسارات المخطّطة بلا شبكة
//   node ops/parity-check.mjs --a https://… --b https://…      عنوانان آخران (مثلاً معاينة)
//
// خيارات:  --sitemap union|local|a|b   مصدر المسارات (union: ملف المستودع + sitemap الحيّ + sitemap أزور)
//          --sample N                  عيّنة حتمية (خطوة ثابتة) من الصفحات، والرئيسية دائماً
//          --concurrency N (4, ≤6)     طلبات متزامنة لكل نطاق
//          --delay-ms N (50)           مهلة قصيرة بين مهمتين في العامل الواحد
//          --timeout S (20)  --retries N (2)  --warmup-timeout S (60)
//          --ignore-regex RE           نمط إضافي يُحذف من الجسم قبل البصمة (يتكرر)
//          --extra-api /api/x?y=z      نقطة GET إضافية (تمرّ بمرشّح الأمان)
//          --out FILE                  مسار تقرير JSON (افتراضياً في المجلد المؤقت)
//          --no-sitemap-diff           لا تقارن مجموعتي المسارات في sitemap النطاقين
//          --a-ref REF                 فرع الإنتاج الحيّ لنسب فروق المحتوى (origin/claude/bpic-marketing-site-jvrnga)
//          --no-attribute              لا تنسب فروق المحتوى إلى الشيفرة/الاستضافة (git show للقراءة فقط)
//          --json                      اطبع التقرير JSON كاملاً بدل الملخص العربي
//
// ما يُقارَن لكل مسار:
//   ١. حالة HTTP
//   ٢. التحويلات 3xx ووجهتها (Location بعد توحيد المضيف: وجهة على النطاقين تُقرأ مساراً نسبياً)
//   ٣. الترويسات الأساسية: cache-control · content-type · x-robots-tag  (فرقها = عدم تكافؤ)
//      والثانوية: HSTS · CORS · CSP · X-Frame-Options · nosniff · Referrer-Policy …  (تنبيه فقط)
//   ٤. بصمة المحتوى: الخام ثم المطبَّعة (مفتاح كاش ?v=… · الأختام الزمنية · nonce · المسافات
//      · مفاتيح JSON المتغيّرة بطبيعتها). لا يُحفظ أي جسم؛ البصمة وبضعة مقاطع قصيرة فقط.
//
// التصنيف (verdict) لكل مسار:
//   identical      كل شيء متطابق حتى البايت
//   equivalent     متطابق بعد حذف المتغيّرات المتوقعة
//   body-differs   الحالة والتحويل والترويسات الأساسية متطابقة والمحتوى يختلف
//   mismatch       فرق في الحالة أو الوجهة أو ترويسة أساسية
//   expected       فرق معلَن ومقصود (مثلاً /scripts/ مغلق على أزور)
//   error          تعذّر الطلب على أحد الطرفين بعد المحاولات
//
// ملاحظة جوهرية لقراءة النتيجة: إن كان A وB مبنيّين من فرعين مختلفين (فرع الإنتاج على فيرسل
// وazure-migration على أزور — انظر docs/dual-run-ledger.md) فـ«body-differs» يقيس فرق الشيفرة
// لا فرق البنية التحتية. لذا يُحسب تكافؤان: بنيوي (حالة+تحويل+ترويسات) وكامل (+المحتوى).
//
// الخروج: 0 لا عدم تكافؤ بنيوي · 1 وُجد · 2 خطأ استعمال · 3 تعذّر الوصول لأحد النطاقين (لا قياس).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { sampleFromSource } from "./azure/parity.mjs";
import { loadRouting } from "./azure/routing.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_A = "https://www.businesspartner.sa";
export const DEFAULT_B = "https://azure.businesspartner.sa";
const UA = "bp-parity-check/1.0 (read-only GET)";
const MAX_CONCURRENCY = 6;
const MAX_BODY = 6 * 1024 * 1024;

// ------------------------------------------------------------ الأمان -----
// نقاط GET القراءة فقط التي لا تستهلك سراً ولا تكتب شيئاً. الأعلام:
//   ignoreKeys  مفاتيح JSON تختلف بطبيعتها بين البيئتين (سائق القاعدة، حالة الاتصال…)
export const API_GET_PROBES = [
  { path: "/api/otp", note: "صحة المصادقة والقاعدة", ignoreKeys: ["dbDriver", "dbReachable", "dbError", "usersCount"] },
  { path: "/api/chat", note: "صحة المستشار الذكي ومزوّداته" },
  { path: "/api/workspace", note: "صحة مساحات العمل", ignoreKeys: ["seenKeyNames"] },
  { path: "/api/employer", note: "صحة بوابة صاحب العمل" },
  { path: "/api/hire", note: "صحة التوظيف" },
  { path: "/api/newsletter", note: "صحة النشرة (بلا ترويسة تفويض: لا إرسال)" },
  { path: "/api/newsletter?feed=news&limit=3", note: "أخبار النشرة (Notion)" },
  { path: "/api/pay", note: "إعداد الدفع العام (مفاتيح عامة وأعلام فقط)" },
  { path: "/api/pay?action=emp-offer&sku=PARITY-NO-SUCH-SKU", note: "سعر خطة صاحب العمل: يجب رد 4xx متطابق" },
  { path: "/api/book?action=slots&days=3", note: "مواعيد الاتصال المرئي المتاحة", ignoreKeys: ["days", "slots", "generatedAt", "now"] },
  { path: "/api/simple?action=config", note: "إعداد الطلبات والسلة (rewrite → requests)" },
  { path: "/api/requests?__route=ai&action=plans&lang=ar", note: "باقات Business Partner AI" },
  { path: "/api/requests?__route=eor&action=search&q=engineer", note: "بحث مهن EOR" },
  { path: "/api/candidates?openJobs=1", note: "الوظائف المفتوحة العامة" },
  { path: "/api/candidate", note: "صحة السيرة الذاتية (بلا action)" },
  { path: "/jobs-feed.xml", note: "خلاصة الوظائف XML (rewrite → candidates)" },
  { path: "/indeed.xml", note: "خلاصة Indeed XML (rewrite → candidates)" },
  { path: "/api/live-catalog", note: "كتالوج العروض الحيّ (rewrite خارجي إلى bp-quotes)" },
  { path: "/quotes", note: "لوحة العروض (rewrite خارجي إلى bp-quotes)" },
  { path: "/api/no-such-function-parity", note: "دالة غير موجودة: 404 متطابق" },
];

// أي مسار فيه أثر جانبي أو بيانات حساسة لا يُسمح به حتى لو طُلب صراحةً.
export const FORBIDDEN = new RegExp(
  [
    "action=(run|backfill|extract-cvs|fix-compliance|occupation-backfill|saudization|boost-cvs|mock-form|reconcile|send|admin|approve|cancel|reschedule|manage|delete|logout)",
    "__route=jobhunt",
    "[?&](key|pw|password|token|secret|t)=",
    "/cron",
    "/api/(candidate|requests)\\?(?!.*__route=(ai|eor)).*action=(?!plans|search)",
  ].join("|"),
  "i",
);

export function isSafeExtraApi(p) {
  if (!/^\/api\/[a-z0-9_-]+(\?[A-Za-z0-9_=&%.,-]*)?$/i.test(p)) return false;
  return !FORBIDDEN.test(p);
}

// ---------------------------------------------------------- المسارات -----
export function parseSitemap(xml) {
  const out = [];
  const re = /<loc>\s*([^<]+?)\s*<\/loc>/g;
  let m;
  while ((m = re.exec(String(xml || "")))) {
    const raw = m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
    try {
      const u = new URL(raw, "https://x.invalid");
      out.push(u.pathname + u.search);
    } catch { /* سطر معطوب يُتجاهل */ }
  }
  return out;
}

// الصفحة تُختبر كما كُتبت في sitemap، وبصيغتها بلا شرطة أخيرة (وهي ما يحوّل إليه trailingSlash:false).
export function expandPages(paths) {
  const set = new Set();
  for (const p of paths) {
    set.add(p);
    if (p.length > 1 && p.endsWith("/")) set.add(p.replace(/\/+$/, ""));
  }
  return [...set].sort();
}

// عيّنة حتمية بخطوة ثابتة، والرئيسية دائماً فيها.
export function sampleEvenly(list, n) {
  if (!n || n >= list.length) return list.slice();
  const step = list.length / n;
  const out = new Set();
  if (list.includes("/")) out.add("/");
  for (let i = 0; out.size < n && i < n * 2; i++) out.add(list[Math.min(list.length - 1, Math.floor(i * step))]);
  return [...out].sort();
}

export function ruleItems(vercelJson) {
  const routing = loadRouting(vercelJson);
  const items = [];
  routing.redirects.forEach((r, i) => {
    if ((r.has || []).some((c) => c.type === "host")) return;
    items.push({ path: sampleFromSource(r.source) + "?pq=1", group: "rules", note: `redirect[${i}] ${r.source}` });
  });
  routing.rewrites.forEach((r, i) => {
    if ((r.has || []).some((c) => c.type === "host")) return;
    items.push({ path: sampleFromSource(r.source), group: "rules", note: `rewrite[${i}] ${r.source}` });
  });
  for (const p of ["/about/", "/about.html", "/index.html", "/ar/", "/does-not-exist-parity-check", "/Revenue-OS"]) {
    items.push({ path: p, group: "rules", note: "cleanUrls / الشرطة الأخيرة / 404 / حسّاسية الحالة" });
  }
  return items;
}

const MISC = [
  { path: "/robots.txt", note: "robots" },
  { path: "/sitemap.xml", note: "خريطة الموقع" },
  { path: "/.well-known/apple-developer-merchantid-domain-association", note: "تفعيل Apple Pay" },
  { path: "/assets/css/b10x-theme.css", note: "ترويسة /assets/ الثابتة" },
  { path: "/assets/js/main.js", note: "ترويسة /assets/ الثابتة" },
  { path: "/favicon.ico", note: "أيقونة" },
  { path: "/scripts/verify-api.mjs", note: "سكربتات البناء: مغلقة على أزور عمداً", expect: "closed-on-b" },
];

export function buildPlan({ sitemapPaths, vercelJson, only, sample, extraApi = [] }) {
  const groups = new Set(only && only.length ? only : ["pages", "rules", "api", "misc"]);
  const items = [];
  if (groups.has("pages")) {
    const pages = expandPages(sitemapPaths);
    for (const p of sampleEvenly(pages, sample)) items.push({ path: p, group: "pages" });
  }
  if (groups.has("rules") && vercelJson) items.push(...ruleItems(vercelJson));
  if (groups.has("api")) {
    for (const pr of API_GET_PROBES) items.push({ ...pr, group: "api" });
    for (const p of extraApi) {
      if (!isSafeExtraApi(p)) throw new Error(`مسار --extra-api مرفوض (أثر جانبي أو شكل غير آمن): ${p}`);
      items.push({ path: p, group: "api", note: "إضافي" });
    }
  }
  if (groups.has("misc")) for (const m of MISC) items.push({ ...m, group: "misc" });
  // لا تكرار، ولا مسار يخالف مرشّح الأمان يصل الشبكة أبداً.
  const seen = new Set();
  return items.filter((it) => {
    if (seen.has(it.path)) return false;
    seen.add(it.path);
    if (FORBIDDEN.test(it.path)) throw new Error(`مسار محظور في القائمة (أثر جانبي أو بيانات حساسة): ${it.path}`);
    return true;
  });
}

// -------------------------------------------------------------- شبكة -----
function describeError(e) {
  const c = e && e.cause;
  const code = (c && (c.code || c.name)) || (e && (e.code || e.name)) || "error";
  const msg = String((c && c.message) || (e && e.message) || e).slice(0, 120);
  return `${code}: ${msg}`;
}

export async function fetchOnce(base, p, { timeoutS = 20, ua = UA, fetchImpl = fetch } = {}) {
  const url = new URL(p, base).href;
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error("timeout")), timeoutS * 1000);
  try {
    // GET حصراً. لا body ولا Authorization ولا cookie.
    const res = await fetchImpl(url, {
      method: "GET", redirect: "manual", signal: ctrl.signal,
      headers: { "user-agent": ua, accept: "*/*", "accept-encoding": "gzip, br" },
    });
    const chunks = [];
    let size = 0, truncated = false;
    if (res.body) {
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_BODY) { truncated = true; try { await reader.cancel(); } catch { /* */ } break; }
        chunks.push(Buffer.from(value));
      }
    }
    const headers = {};
    for (const [k, v] of res.headers) headers[k.toLowerCase()] = v;
    return { status: res.status, headers, body: Buffer.concat(chunks), truncated, ms: Date.now() - t0 };
  } catch (e) {
    return { error: describeError(e), ms: Date.now() - t0 };
  } finally { clearTimeout(timer); }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TRANSIENT = new Set([429, 502, 503, 504]);

export async function fetchRetry(base, p, { retries = 2, timeoutS = 20, fetchImpl = fetch, backoffMs = [1000, 3000, 6000] } = {}) {
  let last;
  for (let attempt = 0; attempt <= retries; attempt++) {
    last = await fetchOnce(base, p, { timeoutS, fetchImpl });
    last.attempts = attempt + 1;
    if (!last.error && !TRANSIENT.has(last.status)) return last;
    if (attempt === retries) return last;
    let wait = backoffMs[Math.min(attempt, backoffMs.length - 1)];
    const ra = last.headers && Number(last.headers["retry-after"]);
    if (ra > 0) wait = Math.min(10000, ra * 1000);
    await sleep(wait);
  }
  return last;
}

// ------------------------------------------------------ التطبيع والبصمة ---
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex").slice(0, 16);
const VOLATILE_KEYS = /^(ts|time|timestamp|now|date|generatedAt|generated_at|updatedAt|updated_at|uptime\w*|elapsed\w*|ms|latency\w*|requestId|request_id|rid|etag|nonce)$/i;
const SENSITIVE_KEY = /key|token|secret|pass|pw|iban|email|phone|mobile|otp|code|auth|cookie/i;

export function normalizeText(s, extra = []) {
  let t = String(s)
    .replace(/\r\n/g, "\n")
    // مفتاح كاش b10x وأشباهه: ?v=79201fe7e6
    .replace(/([?&](?:v|ver|version|cb|_|rev|h))=[0-9a-f]{6,40}\b/gi, "$1=KEY")
    .replace(/\b20\d\d-\d\d-\d\d[T ]\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:?\d\d)?/g, "TS")
    .replace(/\bnonce="[^"]*"/gi, 'nonce=""')
    // معرّف الطلب الذي يلحقه Vercel بصفحات الخطأ:  iad1::fjsd2-1793668804058-1b1dbedd5500
    .replace(/^[a-z0-9]{3,6}::(?:[a-z0-9]+::)?[a-z0-9]+-\d{10,}-[a-f0-9]{8,}\s*$/gim, "")
    .replace(/<(lastmod|lastBuildDate|pubDate|updated)>[^<]*<\/\1>/gi, "<$1>TS</$1>");
  for (const re of extra) t = t.replace(re, "");
  return t.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

function canonJson(v, ignore) {
  if (Array.isArray(v)) return v.map((x) => canonJson(x, ignore));
  if (v && typeof v === "object") {
    const o = {};
    for (const k of Object.keys(v).sort()) {
      if (VOLATILE_KEYS.test(k) || ignore.has(k)) continue;
      o[k] = canonJson(v[k], ignore);
    }
    return o;
  }
  return v;
}

export function jsonShape(v, depth = 0, prefix = "") {
  const out = [];
  if (v && typeof v === "object" && !Array.isArray(v) && depth < 3) {
    for (const k of Object.keys(v).sort()) {
      out.push(`${prefix}${k}:${v[k] === null ? "null" : Array.isArray(v[k]) ? "array" : typeof v[k]}`);
      out.push(...jsonShape(v[k], depth + 1, `${prefix}${k}.`));
    }
  }
  return out;
}

function jsonValueDiffs(a, b, ignore, prefix = "", out = []) {
  if (out.length >= 12) return out;
  const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
  if (isObj(a) && isObj(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (VOLATILE_KEYS.test(k) || ignore.has(k)) continue;
      if (!(k in a)) out.push(`${prefix}${k}: غائب في A`);
      else if (!(k in b)) out.push(`${prefix}${k}: غائب في B`);
      else jsonValueDiffs(a[k], b[k], ignore, `${prefix}${k}.`, out);
    }
    return out;
  }
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  const key = prefix.replace(/\.$/, "");
  const leaf = key.split(".").pop() || "";
  // لا قيمة نصية تُطبع أبداً؛ المنطقية والأرقام الصغيرة فقط، لغير المفاتيح الحسّاسة.
  // وكلمة قصيرة من حروف فقط (live / test / sandbox) تحت مفتاح غير حسّاس: قيمة وضعٍ لا سرّ.
  const show = (x) => (typeof x === "boolean" || x === null ? String(x)
    : typeof x === "number" && !SENSITIVE_KEY.test(leaf) ? String(x)
      : typeof x === "string" && !SENSITIVE_KEY.test(leaf) && /^[A-Za-z_-]{1,16}$/.test(x) ? `«${x}»`
        : Array.isArray(x) ? `مصفوفة(${x.length})` : typeof x === "string" ? `نص(${x.length})` : typeof x);
  out.push(`${key}: A=${show(a)} B=${show(b)}`);
  return out;
}

const snip = (s, n = 110) => String(s).replace(/\s+/g, " ").slice(0, n);

// مقارنة جسمين → { equalRaw, equalNorm, hint }
export function bodyCompare(aBuf, bBuf, ctype, { ignoreKeys = [], extraRegex = [] } = {}) {
  const equalRaw = aBuf.equals(bBuf);
  if (equalRaw) return { equalRaw: true, equalNorm: true, hint: null, rawA: sha(aBuf), rawB: sha(bBuf) };
  const isJson = /json/.test(ctype);
  const isText = /text|json|xml|javascript|svg|html/.test(ctype);
  if (!isText) return { equalRaw: false, equalNorm: false, hint: { kind: "binary", sizeA: aBuf.length, sizeB: bBuf.length }, rawA: sha(aBuf), rawB: sha(bBuf) };
  const ignore = new Set(ignoreKeys);
  if (isJson) {
    let ja, jb;
    try { ja = JSON.parse(aBuf.toString("utf8")); jb = JSON.parse(bBuf.toString("utf8")); } catch { ja = jb = undefined; }
    if (ja !== undefined && jb !== undefined) {
      const ca = JSON.stringify(canonJson(ja, ignore)), cb = JSON.stringify(canonJson(jb, ignore));
      if (ca === cb) return { equalRaw: false, equalNorm: true, hint: null, rawA: sha(aBuf), rawB: sha(bBuf) };
      const sa = jsonShape(canonJson(ja, ignore)).join(","), sb = jsonShape(canonJson(jb, ignore)).join(",");
      return {
        equalRaw: false, equalNorm: false, rawA: sha(aBuf), rawB: sha(bBuf),
        hint: { kind: "json", shapeEqual: sa === sb, diffs: jsonValueDiffs(ja, jb, ignore) },
      };
    }
  }
  const na = normalizeText(aBuf.toString("utf8"), extraRegex), nb = normalizeText(bBuf.toString("utf8"), extraRegex);
  if (na === nb) return { equalRaw: false, equalNorm: true, hint: null, rawA: sha(aBuf), rawB: sha(bBuf) };
  // فرق عناصر: نقسم عند كل وسم ونعدّ ما انفرد به كل طرف (مجموعة متعدّدة).
  const ta = na.split(/(?=<)/), tb = nb.split(/(?=<)/);
  const count = (arr) => { const m = new Map(); for (const t of arr) m.set(t, (m.get(t) || 0) + 1); return m; };
  const ma = count(ta), mb = count(tb);
  const onlyA = [], onlyB = [];
  for (const [t, n] of ma) { const d = n - (mb.get(t) || 0); if (d > 0) for (let i = 0; i < d; i++) onlyA.push(t); }
  for (const [t, n] of mb) { const d = n - (ma.get(t) || 0); if (d > 0) for (let i = 0; i < d; i++) onlyB.push(t); }
  return {
    equalRaw: false, equalNorm: false, rawA: sha(aBuf), rawB: sha(bBuf),
    hint: {
      kind: "text", sizeA: aBuf.length, sizeB: bBuf.length,
      onlyA: onlyA.length, onlyB: onlyB.length,
      samplesA: onlyA.slice(0, 4).map((t) => snip(t)), samplesB: onlyB.slice(0, 4).map((t) => snip(t)),
    },
  };
}

// ---------------------------------------------------------- المقارنة -----
const PRIMARY_HEADERS = ["cache-control", "content-type", "x-robots-tag"];
const SECONDARY_HEADERS = ["strict-transport-security", "access-control-allow-origin", "content-security-policy", "x-frame-options", "x-content-type-options", "referrer-policy", "permissions-policy", "link", "content-language"];

const normCT = (v) => String(v || "").toLowerCase().replace(/\s*;\s*/g, "; ").replace("charset=utf8", "charset=utf-8").trim();
// Vercel يستهلك s-maxage وstale-while-revalidate عند حافته ولا يُظهرهما للمتصفح (تحقّقنا: دالة تضبط
// «public, max-age=300, s-maxage=300, stale-while-revalidate=600» فيرى العميل «public, max-age=300»).
// وAzure يمرّر ما تكتبه الدالة كما هو. فنُسقط هذين التوجيهين من الطرفين قبل المقارنة؛ ويبقى
// الفرق الحقيقي (max-age وno-store وprivate) ظاهراً. وإن لم يبقَ توجيه فالقيمة الافتراضية عند Vercel.
const normCC = (v) => {
  let t = String(v || "").toLowerCase().split(",").map((x) => x.trim()).filter(Boolean)
    .filter((x) => !/^(s-maxage|stale-while-revalidate|stale-if-error)=/.test(x));
  if (v && /s-maxage/i.test(String(v)) && !t.some((x) => /^(max-age|no-store|no-cache|private)/.test(x))) t = ["public", "max-age=0", "must-revalidate"];
  return t.join(", ");
};
const normH = (name, v) => (name === "content-type" ? normCT(v) : name === "cache-control" ? normCC(v) : String(v || "").trim().toLowerCase());

export function normLocation(loc, base, siteHosts) {
  if (!loc) return "";
  try {
    const u = new URL(loc, base);
    if (siteHosts.has(u.host.toLowerCase())) return u.pathname + u.search + u.hash;
    return u.href;
  } catch { return String(loc); }
}

const sideInfo = (r, base, siteHosts) => (r.error
  ? { error: r.error, ms: r.ms, attempts: r.attempts }
  : {
    status: r.status, location: normLocation(r.headers.location, base, siteHosts) || undefined,
    ct: r.headers["content-type"], cc: r.headers["cache-control"], xrobots: r.headers["x-robots-tag"],
    bytes: r.body.length, truncated: r.truncated || undefined, ms: r.ms, attempts: r.attempts,
  });

// يقارن استجابتين لعنصر واحد. A وB ناتج fetchRetry. ينتج سجلّاً صغيراً بلا أجسام.
export function compareItem(item, a, b, { aBase, bBase, extraRegex = [] } = {}) {
  const siteHosts = new Set([new URL(aBase).host, new URL(bBase).host, "www.businesspartner.sa", "businesspartner.sa"].map((h) => h.toLowerCase()));
  const rec = { path: item.path, group: item.group, note: item.note, a: sideInfo(a, aBase, siteHosts), b: sideInfo(b, bBase, siteHosts), diffs: [], warns: [] };
  if (a.error || b.error) { rec.verdict = "error"; return rec; }

  const diffs = rec.diffs;
  const push = (cls, sig, detail) => diffs.push({ cls, sig, detail });

  if (item.expect === "closed-on-b") {
    rec.verdict = b.status === 404 ? "expected" : "mismatch";
    if (rec.verdict === "mismatch") push("status", `الحالة ${a.status}→${b.status}`, "B يخدم مجلداً يجب أن يكون مغلقاً");
    return rec;
  }

  if (a.status !== b.status) push("status", `الحالة ${a.status}→${b.status}`, `A=${a.status} B=${b.status}`);
  const redirecting = (a.status >= 300 && a.status < 400) || (b.status >= 300 && b.status < 400);
  if (redirecting) {
    const la = rec.a.location || "", lb = rec.b.location || "";
    if (la !== lb) push("redirect", "وجهة التحويل", `A→${la || "—"} B→${lb || "—"}`);
  }
  for (const h of PRIMARY_HEADERS) {
    const va = normH(h, a.headers[h]), vb = normH(h, b.headers[h]);
    // ‎content-type الخاص بتحويل بلا جسم لا قيمة له في المقارنة
    if (redirecting && h === "content-type") continue;
    if (va !== vb) push(`header:${h}`, `${h}: «${va || "—"}» → «${vb || "—"}»`, `A=${va || "—"} B=${vb || "—"}`);
  }
  for (const h of SECONDARY_HEADERS) {
    const va = normH(h, a.headers[h]), vb = normH(h, b.headers[h]);
    if (va !== vb) rec.warns.push({ cls: `header2:${h}`, sig: `${h}: «${snip(va || "—", 60)}» → «${snip(vb || "—", 60)}»` });
  }

  let bodyOk = true;
  if (a.status === b.status && a.status >= 200 && a.status < 300 && !a.truncated && !b.truncated) {
    const ctype = normCT(a.headers["content-type"]);
    const bc = bodyCompare(a.body, b.body, ctype, { ignoreKeys: item.ignoreKeys || [], extraRegex });
    rec.a.hash = bc.rawA; rec.b.hash = bc.rawB;
    rec.bodyEqualRaw = bc.equalRaw;
    if (!bc.equalNorm) { bodyOk = false; rec.bodyHint = bc.hint; }
  } else if (a.truncated || b.truncated) {
    if (a.body.length !== b.body.length) { bodyOk = false; rec.bodyHint = { kind: "truncated" }; }
  } else if (a.status === b.status && a.body.length !== b.body.length && !redirecting && a.status >= 400) {
    // صفحات الخطأ: نص الخطأ نفسه يهمّ (404 عند فيرسل غير 404 عند Azure).
    const bc = bodyCompare(a.body, b.body, normCT(a.headers["content-type"]), { extraRegex });
    if (!bc.equalNorm) { rec.errorBodyDiffers = true; rec.bodyHint = bc.hint; }
  }

  // ما لم يُقارَن جسمه (تحويل، أو حالة غير 2xx) يُعدّ «حرفياً» إن تطابق البايت أو كان تحويلاً (جسمه لا قيمة له).
  if (rec.bodyEqualRaw === undefined) rec.bodyEqualRaw = redirecting || a.body.equals(b.body);

  const criticals = diffs.length;
  if (criticals) rec.verdict = "mismatch";
  else if (!bodyOk) rec.verdict = "body-differs";
  else rec.verdict = rec.bodyEqualRaw ? "identical" : "equivalent";
  if (!criticals && rec.errorBodyDiffers) rec.warns.push({ cls: "error-body", sig: "نص صفحة الخطأ يختلف" });
  return rec;
}

// ------------------------------------------------------------ النسب ------
// لماذا يختلف محتوى صفحة بين A وB؟ إن كان A يطابق حرفياً ملف site/ في فرع الإنتاج الحيّ، وB يطابق حرفياً
// ملف site/ في هذا المستودع، فالفرق في الشيفرة (فرعان مختلفان) لا في الاستضافة. أما إن كان أحدهما لا
// يطابق ملف فرعه فالمشكوك فيه هو الاستضافة أو البناء. قراءة فقط: `git show` وقراءة ملفات.
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

export function fileCandidates(p) {
  let clean;
  try { clean = decodeURIComponent(String(p).split("?")[0]); } catch { return []; }
  clean = clean.replace(/^\/+/, "").replace(/\/+$/, "");
  if (clean.includes("\0") || clean.split("/").some((s) => s === ".." || s === ".")) return [];
  if (!clean) return ["index.html"];
  return [`${clean}.html`, `${clean}/index.html`, clean];
}

export function attributeBodies(results, { root, aRef, gitShow = null, readLocal = null }) {
  const show = gitShow || ((rel) => {
    try { return execFileSync("git", ["-C", root, "show", `${aRef}:site/${rel}`], { maxBuffer: 30 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }); } catch { return null; }
  });
  const siteDir = path.join(root, "site");
  const local = readLocal || ((rel) => {
    const f = path.resolve(siteDir, rel);
    if (!f.startsWith(siteDir + path.sep)) return null;
    try { return fs.statSync(f).isFile() ? fs.readFileSync(f) : null; } catch { return null; }
  });
  const firstHit = (cands, get) => { for (const c of cands) { const b = get(c); if (b) return b; } return null; };
  const counts = { checked: 0, "code-divergence": 0, "b-differs-from-its-commit": 0, "a-differs-from-ref": 0, unknown: 0 };
  for (const r of results) {
    if (r.verdict !== "body-differs" || (r.group !== "pages" && r.group !== "misc") || !r.a.hash || !r.b.hash) continue;
    const cands = fileCandidates(r.path);
    if (!cands.length) continue;
    const aBuf = firstHit(cands, show), bBuf = firstHit(cands, local);
    const aMatch = !!aBuf && sha(aBuf) === r.a.hash;
    const bMatch = !!bBuf && sha(bBuf) === r.b.hash;
    r.attribution = aMatch && bMatch ? "code-divergence" : aMatch ? "b-differs-from-its-commit" : bMatch ? "a-differs-from-ref" : "unknown";
    counts.checked++; counts[r.attribution]++;
  }
  return counts;
}

// ------------------------------------------------------------ التجميع ----
const pct =(n, d) => (d ? Math.round((n / d) * 1000) / 10 : null);

export function prefixOf(p) {
  const seg = p.split("?")[0].split("/").filter(Boolean)[0] || "";
  if (!seg) return "/";
  if (/^(ar|fr|zh|es|hi|ja|ko|ru|en)$/.test(seg)) return `/${seg}/*`;
  if (seg === "api") return "/api";
  if (seg === "services") return "/services/*";
  return "/other";
}

export function summarize(results) {
  const by = (list) => {
    const c = { identical: 0, equivalent: 0, "body-differs": 0, mismatch: 0, expected: 0, error: 0 };
    for (const r of list) c[r.verdict] = (c[r.verdict] || 0) + 1;
    const measured = list.length - c.error - c.expected;
    const full = c.identical + c.equivalent;
    const structural = full + c["body-differs"];
    return { total: list.length, ...c, measured, fullParityPct: pct(full, measured), structuralParityPct: pct(structural, measured) };
  };
  const groups = {}, prefixes = {};
  for (const r of results) { (groups[r.group] ||= []).push(r); (prefixes[prefixOf(r.path)] ||= []).push(r); }
  const sigMap = new Map();
  for (const r of results) {
    if (r.verdict !== "mismatch") continue;
    const sig = r.diffs.map((d) => d.sig).join(" · ");
    const e = sigMap.get(sig) || { sig, count: 0, examples: [] };
    e.count++; if (e.examples.length < 6) e.examples.push(r.path);
    sigMap.set(sig, e);
  }
  const warnMap = new Map();
  for (const r of results) for (const w of r.warns || []) {
    const e = warnMap.get(w.sig) || { sig: w.sig, count: 0, examples: [] };
    e.count++; if (e.examples.length < 3) e.examples.push(r.path);
    warnMap.set(w.sig, e);
  }
  const tokA = new Map(), tokB = new Map();
  let bodyDiffPages = 0;
  for (const r of results) {
    if (r.verdict !== "body-differs" || !r.bodyHint || r.bodyHint.kind !== "text") continue;
    bodyDiffPages++;
    for (const t of new Set(r.bodyHint.samplesA)) tokA.set(t, (tokA.get(t) || 0) + 1);
    for (const t of new Set(r.bodyHint.samplesB)) tokB.set(t, (tokB.get(t) || 0) + 1);
  }
  const top = (m, n = 8) => [...m].sort((x, y) => y[1] - x[1]).slice(0, n).map(([token, count]) => ({ token, count }));
  return {
    overall: by(results),
    byGroup: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, by(v)])),
    byPrefix: Object.fromEntries(Object.entries(prefixes).map(([k, v]) => [k, by(v)])),
    mismatchSignatures: [...sigMap.values()].sort((x, y) => y.count - x.count),
    secondaryHeaderDiffs: [...warnMap.values()].sort((x, y) => y.count - x.count).slice(0, 12),
    bodyTokens: { pages: bodyDiffPages, onlyInA: top(tokA), onlyInB: top(tokB) },
  };
}

// ------------------------------------------------------- الملخص العربي ---
export function renderSummaryAr(rep) {
  const L = [];
  const s = rep.summary;
  const o = s && s.overall;
  L.push("══ تقرير تكافؤ Vercel ↔ Azure ══");
  L.push(`المرجع A:  ${rep.meta.a}`);
  L.push(`المرشّح B: ${rep.meta.b}${rep.meta.bSha ? `   (بناء B: ${rep.meta.bSha})` : ""}`);
  L.push(`بدأ: ${rep.meta.startedAt}   انتهى: ${rep.meta.finishedAt || "—"}`);
  if (rep.reachability && !(rep.reachability.a.ok && rep.reachability.b.ok)) {
    L.push("");
    L.push("تعذّر القياس — لا نتائج مُقارَنة (لم تُخترع أرقام):");
    for (const k of ["a", "b"]) {
      const r = rep.reachability[k];
      if (!r.ok) L.push(`  • ${k.toUpperCase()} (${rep.meta[k]}): ${r.error || `HTTP ${r.status}`}`);
    }
    L.push("  شغّل الأداة من جهاز يصل إلى النطاقين (أو افتح لها الخروج إليهما) ثم أعد التشغيل.");
    return L.join("\n");
  }
  L.push(`المسارات: ${o.total}  (صفحات ${rep.meta.counts.pages} · قواعد vercel.json ${rep.meta.counts.rules} · API ${rep.meta.counts.api} · أخرى ${rep.meta.counts.misc})`);
  if (rep.meta.sample) L.push(`⚠ قياس على عيّنة (${rep.meta.sample} صفحة) لا على الكل.`);
  L.push(`مصدر المسارات: ${rep.meta.sitemap.source} — ملف المستودع ${rep.meta.sitemap.local ?? "—"} · حيّ ${rep.meta.sitemap.a ?? "—"} · أزور ${rep.meta.sitemap.b ?? "—"}`);
  L.push("");
  L.push("— النتيجة الإجمالية —");
  L.push(`  متطابق تماماً (حتى البايت):        ${o.identical}`);
  L.push(`  متطابق بعد حذف المتغيّرات المتوقعة: ${o.equivalent}`);
  L.push(`  بنية متطابقة والمحتوى يختلف:        ${o["body-differs"]}`);
  L.push(`  عدم تكافؤ (حالة/تحويل/ترويسة):      ${o.mismatch}`);
  L.push(`  اختلاف متوقّع ومقصود:               ${o.expected}`);
  L.push(`  تعذّر الطلب (شبكة/مهلة):            ${o.error}`);
  L.push(`  ▸ التكافؤ الكامل (محتوى + بنية):   ${o.fullParityPct}%   من ${o.measured} مسارًا مقيسًا`);
  L.push(`  ▸ التكافؤ البنيوي (حالة+تحويل+ترويسات): ${o.structuralParityPct}%`);
  L.push("");
  L.push("— حسب المجموعة —");
  const gname = { pages: "الصفحات", rules: "قواعد vercel.json", api: "نقاط API (GET)", misc: "أخرى" };
  for (const [g, v] of Object.entries(s.byGroup)) {
    L.push(`  ${gname[g] || g}: ${v.total} · كامل ${v.fullParityPct ?? "—"}% · بنيوي ${v.structuralParityPct ?? "—"}% · عدم تكافؤ ${v.mismatch} · أخطاء ${v.error}`);
  }
  L.push("");
  L.push("— حسب البادئة —");
  for (const [g, v] of Object.entries(s.byPrefix).sort((x, y) => y[1].total - x[1].total)) {
    L.push(`  ${g.padEnd(12)} ${String(v.total).padStart(5)} مسار · كامل ${v.fullParityPct ?? "—"}% · بنيوي ${v.structuralParityPct ?? "—"}%`);
  }
  if (s.mismatchSignatures.length) {
    L.push("");
    L.push("— عدم التكافؤ البنيوي (الأهم) —");
    for (const m of s.mismatchSignatures.slice(0, 15)) {
      L.push(`  [${m.count}] ${m.sig}`);
      L.push(`        مثال: ${m.examples.slice(0, 4).join("  ")}`);
    }
  }
  if (s.secondaryHeaderDiffs.length) {
    L.push("");
    L.push("— فروق ترويسات ثانوية (تنبيه) —");
    for (const m of s.secondaryHeaderDiffs.slice(0, 8)) L.push(`  [${m.count}] ${m.sig}   مثال: ${m.examples[0]}`);
  }
  if (o["body-differs"]) {
    L.push("");
    L.push(`— المحتوى يختلف في ${o["body-differs"]} مسارًا (البنية سليمة) —`);
    L.push("  تذكير: إن كان A وB من فرعين مختلفين فهذا فرق شيفرة لا فرق استضافة (docs/dual-run-ledger.md).");
    if (rep.attribution) {
      const t = rep.attribution;
      L.push(`  نسب الفرق إلى مصدره (git: A=${t.aRef} · B=هذا المستودع ${t.localHead}) على ${t.checked} صفحة قابلة للفحص:`);
      L.push(`    شيفرة مختلفة (A يطابق ملف فرعه حرفياً وB يطابق ملف فرعه حرفياً): ${t["code-divergence"]}`);
      L.push(`    B لا يطابق ملف فرعه (يُشتبه في الاستضافة/البناء):                 ${t["b-differs-from-its-commit"]}`);
      L.push(`    A لا يطابق ملف فرعه (فرع الإنتاج ليس ما نُشر فعلاً):               ${t["a-differs-from-ref"]}`);
      L.push(`    غير محسوم:                                                      ${t.unknown}`);
    }
    if (s.bodyTokens.onlyInA.length) {
      L.push("  أكثر العناصر التي في A ولا توجد في B:");
      for (const t of s.bodyTokens.onlyInA.slice(0, 5)) L.push(`    [${t.count} صفحة] ${t.token}`);
    }
    if (s.bodyTokens.onlyInB.length) {
      L.push("  أكثر العناصر التي في B ولا توجد في A:");
      for (const t of s.bodyTokens.onlyInB.slice(0, 5)) L.push(`    [${t.count} صفحة] ${t.token}`);
    }
    const ex = rep.results.filter((r) => r.verdict === "body-differs").slice(0, 6);
    L.push("  أمثلة:");
    for (const r of ex) {
      const h = r.bodyHint || {};
      const d = h.kind === "json" ? `JSON: ${(h.diffs || []).slice(0, 3).join(" ; ") || "اختلاف شكل"}`
        : h.kind === "text" ? `A ${h.sizeA}B · B ${h.sizeB}B · عناصر منفردة A:${h.onlyA} B:${h.onlyB}`
          : h.kind || "";
      L.push(`    ${r.path}  —  ${d}`);
    }
  }
  const api = rep.results.filter((r) => r.group === "api" && r.verdict !== "identical" && r.verdict !== "equivalent");
  if (api.length) {
    L.push("");
    L.push("— نقاط API التي لا تتطابق تماماً —");
    for (const r of api) {
      const why = r.verdict === "error" ? `خطأ: A=${r.a.error || "ok"} B=${r.b.error || "ok"}`
        : r.diffs.length ? r.diffs.map((d) => d.detail).join(" ; ")
          : (r.bodyHint && r.bodyHint.diffs ? `قيم: ${r.bodyHint.diffs.slice(0, 4).join(" ; ")}` : "المحتوى يختلف");
      L.push(`  ${r.verdict.padEnd(12)} ${r.path}  ${why}`);
    }
  }
  const errs = rep.results.filter((r) => r.verdict === "error");
  if (errs.length) {
    L.push("");
    L.push(`— تعذّر الطلب في ${errs.length} مسارًا (أول 8) —`);
    for (const r of errs.slice(0, 8)) L.push(`  ${r.path}  A=${r.a.error || r.a.status} B=${r.b.error || r.b.status}`);
  }
  if (rep.sitemapDiff) {
    const d = rep.sitemapDiff;
    L.push("");
    L.push("— مقارنة sitemap.xml بين النطاقين —");
    L.push(`  مشترك ${d.both} · في الحيّ فقط ${d.onlyA.length} · في أزور فقط ${d.onlyB.length}`);
    if (d.onlyA.length) L.push(`  في الحيّ فقط (أمثلة): ${d.onlyA.slice(0, 6).join("  ")}`);
    if (d.onlyB.length) L.push(`  في أزور فقط (أمثلة): ${d.onlyB.slice(0, 6).join("  ")}`);
  }
  if (rep.meta.notes && rep.meta.notes.length) {
    L.push("");
    L.push("— ملاحظات —");
    for (const n of rep.meta.notes) L.push(`  • ${n}`);
  }
  return L.join("\n");
}

// ----------------------------------------------------------- التشغيل -----
async function pool(items, n, delayMs, fn, onProgress) {
  let i = 0, done = 0;
  const out = new Array(items.length);
  const worker = async () => {
    for (;;) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx], idx);
      done++;
      if (onProgress) onProgress(done, items.length);
      if (delayMs) await sleep(delayMs);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

async function getSitemap(base, o) {
  const r = await fetchRetry(base, "/sitemap.xml", { retries: o.retries, timeoutS: o.timeout, fetchImpl: o.fetchImpl });
  if (r.error || r.status !== 200) return null;
  return parseSitemap(r.body.toString("utf8"));
}

export async function runParityCheck(o) {
  const startedAt = new Date().toISOString();
  const conc = Math.max(1, Math.min(MAX_CONCURRENCY, o.concurrency || 4));
  const meta = {
    tool: "ops/parity-check.mjs", startedAt, a: o.a, b: o.b, node: process.version,
    concurrency: conc, timeoutS: o.timeout, retries: o.retries, sample: o.sample || null,
    notes: [], counts: {}, sitemap: { source: o.sitemap },
  };
  if (o.concurrency > MAX_CONCURRENCY) meta.notes.push(`التزامن خُفِّض إلى ${MAX_CONCURRENCY} (الحد الأقصى).`);
  const log = o.log || (() => {});

  // ١) الوصول: طلب تدفئة للنطاقين (أزور قد يكون نائماً عند الصفر).
  const warm = async (base) => {
    const r = await fetchRetry(base, "/", { retries: o.retries, timeoutS: o.warmupTimeout, fetchImpl: o.fetchImpl });
    return r.error ? { ok: false, error: r.error } : { ok: r.status < 500, status: r.status, ms: r.ms };
  };
  // --list: بلا أي شبكة، والمسارات من ملف المستودع وحده.
  if (o.list) { o = { ...o, sitemap: "local", sitemapDiff: false }; }
  let reachability = { a: { ok: true, skipped: true }, b: { ok: true, skipped: true } };
  if (!o.list) {
    log(`تدفئة/فحص وصول: ${o.a} و${o.b} …`);
    const [ra, rb] = await Promise.all([warm(o.a), warm(o.b)]);
    reachability = { a: ra, b: rb };
  }
  const { a: ra, b: rb } = reachability;
  if (!ra.ok || !rb.ok) {
    meta.finishedAt = new Date().toISOString();
    const rep = { meta, reachability, summary: null, results: [] };
    rep.summaryAr = renderSummaryAr(rep);
    return rep;
  }
  // رقم بناء B إن كان /__health متاحاً (خادم أزور فقط).
  const h = o.list ? { error: "list" } : await fetchOnce(o.b, "/__health", { timeoutS: o.timeout, fetchImpl: o.fetchImpl });
  if (!h.error && h.status === 200) { try { meta.bSha = JSON.parse(h.body.toString("utf8")).sha || null; } catch { /* */ } }

  // ٢) المسارات.
  let local = [];
  try { local = parseSitemap(fs.readFileSync(path.join(o.root, "site", "sitemap.xml"), "utf8")); } catch { meta.notes.push("تعذّرت قراءة site/sitemap.xml من المستودع."); }
  let sa = null, sb = null;
  if (o.sitemap === "union" || o.sitemap === "a" || o.sitemapDiff) sa = await getSitemap(o.a, o);
  if (o.sitemap === "union" || o.sitemap === "b" || o.sitemapDiff) sb = await getSitemap(o.b, o);
  meta.sitemap.local = local.length; meta.sitemap.a = sa ? sa.length : null; meta.sitemap.b = sb ? sb.length : null;
  let pages = local;
  if (o.sitemap === "a") pages = sa || local;
  else if (o.sitemap === "b") pages = sb || local;
  else if (o.sitemap === "union") pages = [...new Set([...local, ...(sa || []), ...(sb || [])])];
  if (o.sitemap !== "local" && ((o.sitemap !== "b" && !sa) || (o.sitemap !== "a" && !sb))) meta.notes.push("تعذّر جلب sitemap أحد النطاقين؛ استُعمل ما توفّر.");

  let vercelJson = null;
  try { vercelJson = JSON.parse(fs.readFileSync(path.join(o.root, "vercel.json"), "utf8")); } catch { meta.notes.push("تعذّرت قراءة vercel.json؛ حُذفت فحوص القواعد."); }
  const plan = buildPlan({ sitemapPaths: pages, vercelJson, only: o.only, sample: o.sample, extraApi: o.extraApi });
  for (const g of ["pages", "rules", "api", "misc"]) meta.counts[g] = plan.filter((x) => x.group === g).length;

  if (o.list) { return { meta, reachability, plan, summary: null, results: [] }; }

  // ٣) المقارنة.
  const extraRegex = (o.ignoreRegex || []).map((s) => new RegExp(s, "g"));
  const results = await pool(plan, conc, o.delayMs, async (item) => {
    const [a, b] = await Promise.all([
      fetchRetry(o.a, item.path, { retries: o.retries, timeoutS: o.timeout, fetchImpl: o.fetchImpl }),
      fetchRetry(o.b, item.path, { retries: o.retries, timeoutS: o.timeout, fetchImpl: o.fetchImpl }),
    ]);
    return compareItem(item, a, b, { aBase: o.a, bBase: o.b, extraRegex });
  }, o.onProgress);

  const rep = { meta, reachability, results };
  if (o.sitemapDiff && sa && sb) {
    const A = new Set(sa), B = new Set(sb);
    rep.sitemapDiff = { both: [...A].filter((x) => B.has(x)).length, onlyA: [...A].filter((x) => !B.has(x)), onlyB: [...B].filter((x) => !A.has(x)) };
  }
  if (o.attribute !== false && results.some((r) => r.verdict === "body-differs")) {
    if (!SAFE_REF.test(o.aRef || "")) meta.notes.push("--a-ref غير صالح؛ تخطّيتُ نسب فروق المحتوى.");
    else {
      let refOk = true, head = null;
      try {
        execFileSync("git", ["-C", o.root, "rev-parse", "--verify", "--quiet", o.aRef], { stdio: "ignore" });
        head = execFileSync("git", ["-C", o.root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
      } catch { refOk = false; }
      if (!refOk) meta.notes.push(`تعذّر نسب فروق المحتوى: المرجع ${o.aRef} غير موجود محلياً (git fetch ثم أعد التشغيل).`);
      else {
        if (meta.bSha && !head.startsWith(meta.bSha)) meta.notes.push(`ملفات المستودع الحالي (${head.slice(0, 12)}) ليست بناء B (${meta.bSha}): نسب فروق B غير موثوق.`);
        rep.attribution = { aRef: o.aRef, localHead: head.slice(0, 12), ...attributeBodies(results, { root: o.root, aRef: o.aRef }) };
      }
    }
  }
  rep.summary = summarize(results);
  // نسبة عدم التكافؤ في الشبكة على طرف واحد تعني أن القياس نفسه مشكوك فيه.
  const errA = results.filter((r) => r.a && r.a.error).length, errB = results.filter((r) => r.b && r.b.error).length;
  if (errA > results.length * 0.05 || errB > results.length * 0.05) meta.notes.push(`أخطاء شبكة كثيرة (A=${errA} B=${errB}): خفّض --concurrency أو زد --timeout ثم أعد التشغيل.`);
  meta.finishedAt = new Date().toISOString();
  rep.summaryAr = renderSummaryAr(rep);
  return rep;
}

// -------------------------------------------------------------- CLI ------
export function parseArgs(argv) {
  const o = {
    a: DEFAULT_A, b: DEFAULT_B, sitemap: "union", concurrency: 4, delayMs: 50, timeout: 20, retries: 2,
    warmupTimeout: 60, sitemapDiff: true, ignoreRegex: [], extraApi: [], root: ROOT, only: null,
    aRef: "origin/claude/bpic-marketing-site-jvrnga",
  };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    const val = () => { if (i + 1 >= argv.length) throw new Error(`الخيار ${k} يحتاج قيمة`); return argv[++i]; };
    const num = () => { const n = Number(val()); if (!Number.isFinite(n) || n < 0) throw new Error(`قيمة رقمية غير صالحة لـ ${k}`); return n; };
    if (k === "--a") o.a = val().replace(/\/+$/, "");
    else if (k === "--b") o.b = val().replace(/\/+$/, "");
    else if (k === "--sitemap") { o.sitemap = val(); if (!["union", "local", "a", "b"].includes(o.sitemap)) throw new Error("--sitemap: union|local|a|b"); }
    else if (k === "--sample") o.sample = num();
    else if (k === "--only") { o.only = val().split(",").map((s) => s.trim()).filter(Boolean); for (const g of o.only) if (!["pages", "rules", "api", "misc"].includes(g)) throw new Error(`--only: مجموعة مجهولة «${g}»`); }
    else if (k === "--concurrency") o.concurrency = num();
    else if (k === "--delay-ms") o.delayMs = num();
    else if (k === "--timeout") o.timeout = num();
    else if (k === "--retries") o.retries = Math.min(5, num());
    else if (k === "--warmup-timeout") o.warmupTimeout = num();
    else if (k === "--ignore-regex") o.ignoreRegex.push(val());
    else if (k === "--extra-api") o.extraApi.push(val());
    else if (k === "--out") o.out = val();
    else if (k === "--no-sitemap-diff") o.sitemapDiff = false;
    else if (k === "--no-attribute") o.attribute = false;
    else if (k === "--a-ref") o.aRef = val();
    else if (k === "--json") o.json = true;
    else if (k === "--list") o.list = true;
    else if (k === "--help" || k === "-h") o.help = true;
    else throw new Error(`خيار غير معروف: ${k}`);
  }
  for (const u of [o.a, o.b]) if (!/^https?:\/\//.test(u)) throw new Error(`عنوان غير صالح: ${u}`);
  if (o.a === o.b) throw new Error("A وB عنوان واحد — لا معنى للمقارنة");
  return o;
}

async function main(argv) {
  let o;
  try { o = parseArgs(argv); } catch (e) { console.error(String(e.message || e)); return 2; }
  if (o.help) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//")).slice(0, 60).map((l) => l.replace(/^\/\/ ?/, "")).join("\n")); return 0; }
  o.log = (m) => console.error(m);
  let last = 0;
  o.onProgress = (d, t) => { if (d === t || d - last >= 100) { last = d; console.error(`  … ${d}/${t}`); } };
  let rep;
  try { rep = await runParityCheck(o); } catch (e) { console.error(String(e.message || e)); return 2; }
  if (o.list) { for (const it of rep.plan) console.log(`${it.group.padEnd(6)} ${it.path}${it.note ? `   # ${it.note}` : ""}`); console.log(`\n${rep.plan.length} مسارًا (بلا شبكة للمقارنة).`); return 0; }
  const out = o.out || path.join(os.tmpdir(), `bp-parity-${startStamp()}.json`);
  try { fs.writeFileSync(out, JSON.stringify(rep, null, 2)); } catch (e) { console.error(`تعذّرت كتابة التقرير: ${e.message}`); }
  if (o.json) console.log(JSON.stringify(rep, null, 2)); else console.log(rep.summaryAr);
  console.error(`\nتقرير JSON: ${out}`);
  if (!rep.summary) return 3;
  return rep.summary.overall.mismatch ? 1 : 0;
}
const startStamp = () => new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv).then((c) => process.exit(c), (e) => { console.error(String((e && e.stack) || e)); process.exit(1); });
}
