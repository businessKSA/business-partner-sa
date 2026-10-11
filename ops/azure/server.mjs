// Business Partner — خادم الإنتاج على Azure (Container Apps).
//
// يخدم من حاوية واحدة ما كانت Vercel تخدمه من ثلاثة أماكن: الصفحات المبنيّة
// (site/)، ودوال api/ (بواجهة Vercel عبر vercel-compat.mjs)، وقواعد vercel.json
// (redirects/rewrites/headers/cleanUrls/trailingSlash) عبر routing.mjs. لا يمسّ
// شيئاً من الموقع نفسه: الصفحات والـAPI هي نفسها حرفاً، والذي يتغيّر هو من يقدّمها.
//
// ترتيب المعالجة يطابق Vercel (تحقّقنا من كل خطوة على الموقع الحيّ بـGET):
//   ١. الصحة  ٢. الأبكس → www (308)  ٣. http → https  ٤. cleanUrls + الشرطة الأخيرة (308)
//   ٥. redirects  ٦. rewrites ذات شرط المضيف  ٧. الملفات الثابتة ودوال api/
//   ٨. rewrites الأخرى (داخلية أو وكيل إلى أصل خارجي)  ٩. 404
//
// تشغيله:  node ops/azure/server.mjs        (PORT=8080 افتراضياً)
// متغيّرات التشغيل (كلها اختيارية) في ops/azure/README.md وdocs/azure-migration-2026-10-11.md.

import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  loadRouting, findRedirect, findRewrite, findHeaders, maxDurationFor, isExternal,
} from "./routing.mjs";
import {
  collectBody, toVercelRequest, decorateResponse, HttpError, MAX_BODY_BYTES,
} from "./vercel-compat.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..");

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8", ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".webp": "image/webp", ".avif": "image/avif", ".ico": "image/x-icon",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf",
  ".xml": "application/xml; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8", ".csv": "text/csv; charset=utf-8",
  ".pdf": "application/pdf", ".webmanifest": "application/manifest+json; charset=utf-8",
  ".map": "application/json; charset=utf-8", ".mp4": "video/mp4", ".webm": "video/webm",
  ".zip": "application/zip", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
const COMPRESSIBLE = /^(text\/|application\/(javascript|json|xml|manifest\+json)|image\/svg)/;

const HOP_BY_HOP = new Set([
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer",
  "transfer-encoding", "upgrade",
]);

const NOT_FOUND_BODY = "The page could not be found\n\nNOT_FOUND\n";
const HSTS = "max-age=63072000";
const DEFAULT_CACHE = "public, max-age=0, must-revalidate";

function firstOf(v) { return String(v || "").split(",")[0].trim(); }

export function readConfig(env = process.env) {
  const num = (k, d) => (Number(env[k]) > 0 ? Number(env[k]) : d);
  const list = (k, d) => String(env[k] === undefined ? d : env[k]).split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return {
    bpEnv: String(env.BP_ENV || "production").toLowerCase(),
    port: num("PORT", 8080),
    canonicalHost: String(env.BP_CANONICAL_HOST || "www.businesspartner.sa").toLowerCase(),
    apexHosts: new Set(list("BP_APEX_HOSTS", "businesspartner.sa")),
    forceHttps: env.BP_FORCE_HTTPS !== "0",
    trustedHops: num("BP_TRUSTED_PROXY_HOPS", 1),
    fnTimeoutS: num("BP_FN_DEFAULT_TIMEOUT_S", 30),
    maxBody: num("BP_MAX_BODY_BYTES", MAX_BODY_BYTES),
    proxyTimeoutS: num("BP_PROXY_TIMEOUT_S", 100),
    // /scripts/ هو مجلد سكربتات البناء داخل site/؛ Vercel يخدمه علناً اليوم (تحقّقنا:
    // GET /scripts/verify-api.mjs → 200) ولا صفحة تحمّل منه شيئاً. على Azure يُغلق.
    blockScripts: env.BP_SERVE_BUILD_SCRIPTS !== "1",
    shutdownGraceS: num("BP_SHUTDOWN_GRACE_S", 25),
    // معرّف Front Door (X-Azure-FDID). إن ضُبط، لا يُقبل إلا الطلب الذي مرّ منه، فلا يُتجاوز
    // جدار الحماية بالذهاب إلى عنوان Container Apps مباشرة. لا يمسّ /__health ولا الأبكس.
    frontDoorId: String(env.BP_FRONT_DOOR_ID || "").trim().toLowerCase(),
  };
}

export function createAzureServer(opts = {}) {
  const root = opts.root || REPO_ROOT;
  const siteDir = path.resolve(opts.siteDir || path.join(root, "site"));
  const apiDir = path.resolve(opts.apiDir || path.join(root, "api"));
  const vercelJson = opts.vercelJson || JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  const cfg = { ...readConfig(opts.env || process.env), ...(opts.config || {}) };
  const routing = loadRouting(vercelJson);
  const isHostRule = (x) => !!(x.has && x.has.some((c) => c.type === "host"));
  const hostRouting = { ...routing, rewrites: routing.rewrites.filter(isHostRule) };
  const plainRouting = { ...routing, rewrites: routing.rewrites.filter((x) => !isHostRule(x)) };
  const log = opts.log || ((o) => console.log(JSON.stringify(o)));
  const stats = { requests: 0, errors: 0, startedAt: Date.now(), draining: false };

  // ------------------------------------------------------------ static ----
  const etagCache = new Map();    // file → { mtimeMs, size, etag }
  const zipCache = new Map();     // `${etag}|${enc}` → Buffer
  let zipBytes = 0;
  const ZIP_CAP = 128 * 1024 * 1024;

  function resolveStatic(pathname) {
    let decoded;
    try { decoded = decodeURIComponent(pathname); } catch { return null; }
    if (decoded.includes("\0") || decoded.includes("\\")) return null;
    const parts = decoded.split("/").filter((p) => p !== "");
    if (parts.some((p) => p === ".." || p === "." || (p.startsWith(".") && p !== ".well-known"))) return null;
    if (cfg.blockScripts && parts[0] === "scripts") return null;
    const rel = parts.join("/");
    const candidates = rel === "" ? ["index.html"] : [rel, `${rel}.html`, `${rel}/index.html`];
    for (const c of candidates) {
      const file = path.join(siteDir, c);
      if (file !== siteDir && !file.startsWith(siteDir + path.sep)) continue;
      let st;
      try { st = fs.statSync(file); } catch { continue; }
      if (st.isFile()) return { file, st };
    }
    return null;
  }

  function etagFor(file, st, buf) {
    const hit = etagCache.get(file);
    if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) return hit.etag;
    const etag = `"${crypto.createHash("md5").update(buf).digest("hex")}"`;
    etagCache.set(file, { mtimeMs: st.mtimeMs, size: st.size, etag });
    return etag;
  }

  function applyHeaders(res, headers, { override }) {
    for (const [k, v] of Object.entries(headers)) {
      if (override || !res.hasHeader(k)) res.setHeader(k, v);
    }
  }

  async function serveStatic(req, res, found, customHeaders) {
    const { file, st } = found;
    const buf = await fs.promises.readFile(file);
    const ext = path.extname(file).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    const etag = etagFor(file, st, buf);
    res.setHeader("content-type", type);
    res.setHeader("cache-control", DEFAULT_CACHE);
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("etag", etag);
    applyHeaders(res, customHeaders, { override: true });
    const inm = String(req.headers["if-none-match"] || "");
    if (inm && (inm === "*" || inm.split(",").some((t) => t.trim().replace(/^W\//, "") === etag))) {
      res.statusCode = 304;
      return res.end();
    }
    let body = buf;
    if (COMPRESSIBLE.test(type) && buf.length >= 1024) {
      res.setHeader("vary", "Accept-Encoding");
      const ae = String(req.headers["accept-encoding"] || "");
      const enc = /\bbr\b/.test(ae) ? "br" : /\bgzip\b/.test(ae) ? "gzip" : "";
      if (enc) {
        const key = `${etag}|${enc}`;
        let z = zipCache.get(key);
        if (!z) {
          z = await new Promise((ok, no) => {
            const cb = (e, out) => (e ? no(e) : ok(out));
            if (enc === "br") zlib.brotliCompress(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }, cb);
            else zlib.gzip(buf, { level: 6 }, cb);
          });
          if (zipBytes + z.length <= ZIP_CAP) { zipCache.set(key, z); zipBytes += z.length; }
        }
        body = z;
        res.setHeader("content-encoding", enc);
      }
    }
    res.statusCode = 200;
    res.setHeader("content-length", body.length);
    if (req.method === "HEAD") return res.end();
    return res.end(body);
  }

  // ------------------------------------------------------- functions ------
  const handlerCache = new Map();
  async function loadFunction(name) {
    if (!/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(name)) return null;
    const file = path.join(apiDir, `${name}.js`);
    if (!fs.existsSync(file)) return null;
    if (!handlerCache.has(file)) handlerCache.set(file, import(pathToFileURL(file).href));
    let mod;
    try { mod = await handlerCache.get(file); }
    catch (e) { handlerCache.delete(file); throw e; }
    return typeof mod.default === "function" ? { handler: mod.default, config: mod.config || {}, name } : null;
  }

  async function runFunction(fn, req, res, rewritten, customHeaders) {
    const timeoutS = maxDurationFor(routing, `${fn.name}.js`, fn.config, cfg.fnTimeoutS);
    decorateResponse(res);
    res.setHeader("cache-control", DEFAULT_CACHE);
    const origWriteHead = res.writeHead;
    res.writeHead = function (status, ...rest) {
      if (!this.headersSent && status < 400) applyHeaders(this, customHeaders, { override: false });
      return origWriteHead.call(this, status, ...rest);
    };
    // دالة تعلن `config.api.bodyParser = false` تقرأ الجسم الخام من الـstream بنفسها.
    const parse = !(fn.config && fn.config.api && fn.config.api.bodyParser === false);
    let body;
    if (req.method !== "GET" && req.method !== "HEAD") body = await collectBody(req, cfg.maxBody);
    const vreq = toVercelRequest(req, { rewritten, body, hops: cfg.trustedHops, parse });

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (!res.headersSent) {
        res.statusCode = 504;
        res.setHeader("content-type", "text/plain; charset=utf-8");
        res.end("An error occurred with this application.\n\nFUNCTION_INVOCATION_TIMEOUT\n");
      } else res.destroy();
    }, timeoutS * 1000);
    timer.unref?.();
    res.on("close", () => clearTimeout(timer));
    try {
      await fn.handler(vreq, res);
    } catch (e) {
      stats.errors++;
      log({ level: "error", fn: fn.name, msg: String((e && e.stack) || e).slice(0, 600) });
      if (!timedOut && !res.headersSent) {
        res.statusCode = 500;
        res.setHeader("content-type", "text/plain; charset=utf-8");
        res.end("A server error has occurred\n\nFUNCTION_INVOCATION_FAILED\n");
      } else if (!res.writableEnded) res.destroy();
    }
  }

  // ----------------------------------------------------------- proxy ------
  function proxy(req, res, destination, customHeaders) {
    const target = new URL(destination);
    const mod = target.protocol === "http:" ? http : https;
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) if (!HOP_BY_HOP.has(k) && k !== "host") headers[k] = v;
    headers.host = target.host;
    headers["x-forwarded-host"] = firstOf(req.headers["x-forwarded-host"] || req.headers.host);
    headers["x-forwarded-proto"] = firstOf(req.headers["x-forwarded-proto"]) || "https";
    const up = mod.request({
      protocol: target.protocol, hostname: target.hostname, port: target.port || undefined,
      path: target.pathname + target.search, method: req.method, headers,
      timeout: cfg.proxyTimeoutS * 1000,
    }, (ur) => {
      const out = {};
      for (const [k, v] of Object.entries(ur.headers)) if (!HOP_BY_HOP.has(k)) out[k] = v;
      if (!out["strict-transport-security"]) out["strict-transport-security"] = HSTS;
      res.writeHead(ur.statusCode || 502, out);
      ur.pipe(res);
    });
    up.on("timeout", () => up.destroy(new Error("upstream_timeout")));
    up.on("error", (e) => {
      stats.errors++;
      log({ level: "error", proxy: target.host, msg: String(e.message || e).slice(0, 200) });
      if (!res.headersSent) {
        res.statusCode = e.message === "upstream_timeout" ? 504 : 502;
        res.setHeader("content-type", "text/plain; charset=utf-8");
        res.end("Upstream unavailable\n");
      } else res.destroy();
    });
    req.pipe(up);
  }

  // --------------------------------------------------------- pipeline -----
  const send = (res, status, headers, body = "") => {
    res.statusCode = status;
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    res.end(body);
  };

  async function handle(req, res) {
    const rawUrl = req.url || "/";
    const u = new URL(rawUrl, "http://x");
    const pathname = u.pathname;
    const search = u.search;
    const host = firstOf(req.headers["x-forwarded-host"] || req.headers.host).toLowerCase().replace(/:\d+$/, "");
    const proto = firstOf(req.headers["x-forwarded-proto"]) || "http";
    const ctx = { pathname, search, host, headers: req.headers };
    res.setHeader("strict-transport-security", HSTS);

    if (pathname === "/__health") {
      res.setHeader("cache-control", "no-store");
      const ok = !stats.draining;
      return send(res, ok ? 200 : 503, { "content-type": "application/json; charset=utf-8" },
        JSON.stringify({ ok, env: cfg.bpEnv, uptimeS: Math.round((Date.now() - stats.startedAt) / 1000), requests: stats.requests, errors: stats.errors, sha: process.env.BP_BUILD_SHA || null }));
    }

    if (cfg.frontDoorId && !cfg.apexHosts.has(host) && String(req.headers["x-azure-fdid"] || "").toLowerCase() !== cfg.frontDoorId) {
      return send(res, 403, { "content-type": "text/plain; charset=utf-8" }, "Forbidden\n");
    }

    if (cfg.apexHosts.has(host)) {
      return send(res, 308, { location: `https://${cfg.canonicalHost}${pathname}${search}`, "cache-control": DEFAULT_CACHE }, "Redirecting...\n");
    }
    if (cfg.forceHttps && proto === "http" && cfg.bpEnv !== "local") {
      return send(res, 308, { location: `https://${host}${pathname}${search}`, "cache-control": DEFAULT_CACHE }, "Redirecting...\n");
    }

    // cleanUrls + trailingSlash:false  (الشرطة الأخيرة تُفحص قبل redirects كما عند Vercel)
    if (routing.trailingSlash === false && pathname.length > 1 && pathname.endsWith("/")) {
      return send(res, 308, { location: pathname.replace(/\/+$/, "") + search, "cache-control": DEFAULT_CACHE }, "Redirecting...\n");
    }
    if (routing.cleanUrls && /\.html$/.test(pathname) && !pathname.startsWith("/api/")) {
      const clean = pathname.replace(/\/index\.html$/, "").replace(/\.html$/, "") || "/";
      return send(res, 308, { location: clean + search, "cache-control": DEFAULT_CACHE }, "Redirecting...\n");
    }

    const r = findRedirect(routing, ctx);
    if (r) return send(res, r.status, { location: r.location, "cache-control": DEFAULT_CACHE }, "Redirecting...\n");

    const customHeaders = findHeaders(routing, pathname);
    const hostRewrite = hostRouting.rewrites.length ? findRewrite(hostRouting, ctx) : null;
    if (hostRewrite) return dispatch(req, res, hostRewrite, customHeaders);

    const apiMatch = /^\/api\/([^/]+)$/.exec(pathname);
    if (apiMatch && !apiMatch[1].startsWith("_")) {
      const fn = await loadFunction(apiMatch[1]);
      if (fn) return runFunction(fn, req, res, pathname + search, customHeaders);
    }
    const found = resolveStatic(pathname);
    if (found) {
      if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS") {
        return send(res, 405, { allow: "GET, HEAD, OPTIONS", "content-type": "text/plain; charset=utf-8" }, "Method Not Allowed\n");
      }
      if (req.method === "OPTIONS") return send(res, 204, { allow: "GET, HEAD, OPTIONS", "access-control-allow-origin": "*" });
      return serveStatic(req, res, found, customHeaders);
    }

    const rw = findRewrite(plainRouting, ctx);
    if (rw) return dispatch(req, res, rw, customHeaders);

    return send(res, 404, { "content-type": "text/plain; charset=utf-8", "cache-control": DEFAULT_CACHE }, NOT_FOUND_BODY);
  }

  async function dispatch(req, res, rw, customHeaders) {
    if (rw.external) {
      // الأصل الخارجي يأتي من قالب في vercel.json؛ ما يُملأ به من الطلب مسارٌ فقط.
      const want = new URL(rw.rule.destination.replace(/:[A-Za-z_]\w*\*?.*$/, "")).origin;
      const got = new URL(rw.destination);
      if (got.origin !== want) return send(res, 400, { "content-type": "text/plain; charset=utf-8" }, "Bad Request\n");
      return proxy(req, res, rw.destination, customHeaders);
    }
    const dest = new URL(rw.destination, "http://x");
    const m = /^\/api\/([^/]+)$/.exec(dest.pathname);
    if (m && !m[1].startsWith("_")) {
      const fn = await loadFunction(m[1]);
      if (fn) return runFunction(fn, req, res, dest.pathname + dest.search, customHeaders);
    }
    const found = resolveStatic(dest.pathname);
    if (found) return serveStatic(req, res, found, customHeaders);
    return send(res, 404, { "content-type": "text/plain; charset=utf-8", "cache-control": DEFAULT_CACHE }, NOT_FOUND_BODY);
  }

  const server = http.createServer(async (req, res) => {
    const t0 = Date.now();
    stats.requests++;
    res.on("finish", () => {
      // المسار فقط في السجل: الاستعلام قد يحمل رموزاً أو بريداً، ولا يُسجَّل عنوان العميل.
      log({ t: new Date().toISOString(), m: req.method, p: (req.url || "").split("?")[0].slice(0, 200), s: res.statusCode, ms: Date.now() - t0 });
    });
    try {
      await handle(req, res);
    } catch (e) {
      stats.errors++;
      if (e instanceof HttpError) {
        if (!res.headersSent) return send(res, e.status, { "content-type": "text/plain; charset=utf-8" }, `${e.code}\n`);
        return res.destroy();
      }
      log({ level: "error", msg: String((e && e.stack) || e).slice(0, 600) });
      if (!res.headersSent) send(res, 500, { "content-type": "text/plain; charset=utf-8" }, "A server error has occurred\n\nINTERNAL_SERVER_ERROR\n");
      else res.destroy();
    }
  });
  server.keepAliveTimeout = 65_000;   // أطول من مهلة مدخل Container Apps فلا يُغلَق اتصال قيد الاستعمال
  server.headersTimeout = 70_000;
  server.requestTimeout = 120_000;    // استلام الطلب كاملاً؛ مهلة تنفيذ الدالة تُدار فوق
  server.bpStats = stats;
  server.bpConfig = cfg;
  return server;
}

// -------------------------------------------------------------- main ------
function start() {
  const cfg = readConfig();
  // سلامة الإنتاج: لا قاعدة محلية ولا بيئة تطوير في خادم الإنتاج.
  if (cfg.bpEnv === "production") {
    const bad = [];
    if (process.env.LOCAL_DB === "1") bad.push("LOCAL_DB=1");
    if (/^(development|local)$/i.test(process.env.APP_ENV || "")) bad.push(`APP_ENV=${process.env.APP_ENV}`);
    if (bad.length) {
      console.error(`رفض الإقلاع: ${bad.join(" + ")} في BP_ENV=production. هذه إعدادات تطوير محلي.`);
      process.exit(1);
    }
  }
  // المعاينة (staging) = وضع Vercel preview الذي تعرفه الدوال: دفع اختباري، تمارا رمليّة،
  // واتساب محاكى، بريد معاينة، دخول بالرمز التجريبي. لا يُضبط VERCEL_ENV في الإنتاج.
  if (cfg.bpEnv === "preview" && !process.env.VERCEL_ENV) process.env.VERCEL_ENV = "preview";

  const server = createAzureServer();
  // عملية طويلة العمر مشتركة: رفضٌ غير معالَج في مهمة «أطلق وانسَ» لا يجوز أن يُسقط كل الطلبات
  // (في Vercel كان يقتل استدعاءً واحداً). يُسجَّل ويُعدّ في /__health.errors ويستمر الخادم.
  const swallow = (kind) => (e) => {
    server.bpStats.errors++;
    console.error(JSON.stringify({ level: "error", [kind]: String((e && e.stack) || e).slice(0, 600) }));
  };
  process.on("unhandledRejection", swallow("unhandledRejection"));
  process.on("uncaughtException", swallow("uncaughtException"));

  server.listen(cfg.port, () => {
    console.log(JSON.stringify({ level: "info", msg: "listening", port: cfg.port, env: cfg.bpEnv, node: process.version, sha: process.env.BP_BUILD_SHA || null }));
  });
  const stop = () => {
    server.bpStats.draining = true;
    console.log(JSON.stringify({ level: "info", msg: "draining" }));
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), cfg.shutdownGraceS * 1000).unref();
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) start();
