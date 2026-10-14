// Business Partner — production web server for Azure Container Apps.
//
// Replaces Vercel's runtime: serves the generated site/ and runs the api/
// functions in-process, applying the redirects, rewrites and headers that
// vercel.json already declares — so there is one source of truth for routing.
// Unlike site/scripts/devserver.mjs this never forces LOCAL_DB or test modes:
// configuration comes only from the container's environment.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SITE = path.join(ROOT, "site");
const PORT = Number(process.env.PORT || 8080);
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));

// "/:lang(ar|fr)/x/:rest*" -> { re, names }, the subset of path-to-regexp vercel.json uses.
function compile(source) {
  const names = [];
  let re = "";
  for (let i = 0; i < source.length;) {
    const m = /^:([A-Za-z0-9_]+)(\([^)]*\))?(\*|\+)?/.exec(source.slice(i));
    if (m) {
      names.push(m[1]);
      re += m[3] ? "(.*)" : m[2] ? m[2] : "([^/]+)";
      i += m[0].length;
    } else {
      re += source[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      i++;
    }
  }
  return { re: new RegExp("^" + re + "/?$"), names };
}
const fill = (dest, names, m) => names.reduce((d, n, i) => d.split(`:${n}`).join(m[i + 1] ?? ""), dest);

const hostOk = (r, host) => !r.has || r.has.every((h) => h.type !== "host" || h.value === host);
const REDIRECTS = (vercel.redirects || []).map((r) => ({ ...r, ...compile(r.source) }));
const REWRITES = (vercel.rewrites || []).map((r) => ({ ...r, ...compile(r.source) }));
const HEADERS = (vercel.headers || []).map((h) => ({ ...h, ...compile(h.source.replace(/\(\.\*\)/g, ":rest*")) }));

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".gif": "image/gif", ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff",
  ".xml": "application/xml; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf", ".webmanifest": "application/manifest+json",
};

const handlers = new Map();
async function loadHandler(name) {
  if (!/^[A-Za-z0-9_-]+$/.test(name) || name.startsWith("_")) return null;
  const file = path.join(ROOT, "api", `${name}.js`);
  if (!fs.existsSync(file)) return null;
  if (!handlers.has(file)) handlers.set(file, import(pathToFileURL(file).href).then((m) => m.default || null));
  return handlers.get(file);
}

async function readBody(req) {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const buf = Buffer.concat(chunks);
  if (!buf.length) return undefined;
  const type = String(req.headers["content-type"] || "");
  const text = buf.toString("utf8");
  if (/json/i.test(type) || /^\s*[[{]/.test(text)) { try { return JSON.parse(text); } catch { return text; } }
  if (/x-www-form-urlencoded/i.test(type)) return Object.fromEntries(new URLSearchParams(text));
  return text;
}

function vercelify(req, res, url) {
  req.query = Object.fromEntries(url.searchParams.entries());
  req.cookies = Object.fromEntries(
    (req.headers.cookie || "").split(";").map((c) => c.trim().split("=")).filter((p) => p[0])
      .map(([k, ...v]) => [k, decodeURIComponent(v.join("="))]),
  );
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { if (!res.headersSent) res.setHeader("content-type", "application/json; charset=utf-8"); res.end(JSON.stringify(o)); return res; };
  res.send = (b) => { res.end(typeof b === "string" || Buffer.isBuffer(b) ? b : JSON.stringify(b)); return res; };
  res.redirect = (a, b) => { const [code, loc] = typeof a === "number" ? [a, b] : [302, a]; res.statusCode = code; res.setHeader("location", loc); res.end(); return res; };
}

function staticFile(pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname).replace(/\/+$/, "").replace(/^\/+/, "") || "index"; } catch { return null; }
  for (const c of [path.join(SITE, rel), path.join(SITE, rel + ".html"), path.join(SITE, rel, "index.html")]) {
    if (c.startsWith(SITE + path.sep) && fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

async function runFunction(req, res, target) {
  const name = target.pathname.replace(/^\/api\//, "").replace(/\/+$/, "");
  const handler = await loadHandler(name);
  if (!handler) { res.statusCode = 404; res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ ok: false, error: "no_such_function" })); return; }
  vercelify(req, res, target);
  req.body = await readBody(req);
  await handler(req, res);
  if (!res.writableEnded) res.end();
}

function mergeQuery(dest, base) {
  const t = new URL(dest, "http://x");
  for (const [k, v] of base.searchParams.entries()) if (!t.searchParams.has(k)) t.searchParams.set(k, v);
  return t;
}

const server = http.createServer(async (req, res) => {
  const host = String(req.headers.host || "").split(":")[0];
  const url = new URL(req.url, `http://${host || "localhost"}`);
  try {
    if (url.pathname === "/healthz") { res.end("ok"); return; }

    for (const h of HEADERS) {
      if (h.re.test(url.pathname)) for (const { key, value } of h.headers) res.setHeader(key, value);
    }

    for (const r of REDIRECTS) {
      const m = url.pathname.match(r.re);
      if (m && hostOk(r, host)) {
        res.statusCode = r.permanent ? 308 : 307;
        res.setHeader("location", fill(r.destination, r.names, m) + url.search);
        res.end();
        return;
      }
    }

    for (const r of REWRITES) {
      const m = url.pathname.match(r.re);
      if (!m || !hostOk(r, host)) continue;
      const dest = fill(r.destination, r.names, m);
      if (/^https?:\/\//.test(dest)) { res.statusCode = 307; res.setHeader("location", dest + url.search); res.end(); return; }
      if (dest.startsWith("/api/")) return runFunction(req, res, mergeQuery(dest, url));
      url.pathname = dest;
      break;
    }

    if (url.pathname.startsWith("/api/")) return runFunction(req, res, url);

    const file = staticFile(url.pathname);
    if (!file) {
      const nf = staticFile("/404");
      res.statusCode = 404;
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.end(nf ? fs.readFileSync(nf) : "<h1>404</h1>");
      return;
    }
    res.setHeader("content-type", MIME[path.extname(file)] || "application/octet-stream");
    if (!res.getHeader("cache-control")) res.setHeader("cache-control", file.endsWith(".html") ? "public, max-age=0, must-revalidate" : "public, max-age=3600");
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    console.error("500", req.method, url.pathname, e);
    if (!res.headersSent) res.statusCode = 500;
    if (!res.writableEnded) res.end(JSON.stringify({ ok: false, error: "server_error" }));
  }
});

// عطلٌ في مسار واحد (وحدة ناقصة، وعدٌ مرفوض) لا يُسقط الموقع كله: يُسجَّل ويستمر الخادم.
process.on("uncaughtException", (e) => console.error("uncaughtException", e));
process.on("unhandledRejection", (e) => console.error("unhandledRejection", e));

server.listen(PORT, () => console.log(`bp-site listening on :${PORT}`));
