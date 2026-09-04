// Business Partner — local development server (`npm run dev`).
//
// Serves the generated static site from site/ and runs the api/ functions
// in-process, so the whole Simple V1 journey — chat, request, scope, quote,
// contract, signature, cart, payment, invoice, appointments, tasks — works on
// http://localhost:3000 with no Vercel deployment and no production data.
//
// Safety rails, all on by default and printed at boot:
//   LOCAL_DB=1          → JSON file under .localdb/, never Supabase
//   APP_ENV=development → payments test, Tamara sandbox, WhatsApp mock,
//                         e-mail preview, contracts test (api/_mode.js)
// Anything in .env.local wins over these defaults.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SITE = path.join(ROOT, "site");
const PORT = Number(process.env.PORT || 3000);

// ------------------------------------------------------------ environment --
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return 0;
  let n = 0;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line.replace(/^\s*export\s+/, ""));
    if (!m || /^\s*#/.test(line)) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) { process.env[m[1]] = v; n++; }
  }
  return n;
}
const envCount = loadEnvFile(path.join(ROOT, ".env.local"));

const DEFAULTS = {
  APP_ENV: "development",
  LOCAL_DB: "1",
  SIMPLE_V1: "1",
  SIMPLE_TEST_MODE: "1",
  SIMPLE_OPS_KEY: "test-ops",
  SIMPLE_TEST_OTP: "123456",
  // Signs the local OTP challenge only. Fixed so sessions survive a restart;
  // it is a development constant, not a secret, and never used in production.
  OTP_SECRET: "local-development-only-not-a-secret",
  PAYMENTS_MODE: "test",
  MOYASAR_MODE: "test",
  TAMARA_MODE: "sandbox",
  WHATSAPP_MODE: "mock",
  EMAIL_MODE: "preview",
  CONTRACT_MODE: "test",
  CALENDAR_MODE: "test",
  MKT_SITE_BASE: `http://localhost:${PORT}`,
};
for (const [k, v] of Object.entries(DEFAULTS)) if (process.env[k] === undefined) process.env[k] = v;

// A local run must never reach the production database, whatever a stray
// .env.local says. LOCAL_DB=0 is honoured only with LOCAL_ALLOW_REMOTE_DB=1.
if (process.env.LOCAL_DB !== "1" && process.env.LOCAL_ALLOW_REMOTE_DB !== "1") {
  console.error("\n  Refusing to start: LOCAL_DB is off and LOCAL_ALLOW_REMOTE_DB is not set.");
  console.error("  That combination points localhost at the production Supabase project.\n");
  process.exit(1);
}
if (process.env.LOCAL_DB === "1") { delete process.env.SUPABASE_SERVICE_KEY; delete process.env.SUPABASE_SERVICE_ROLE_KEY; }

// -------------------------------------------------------------- rewrites ---
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
// Only the plain /api/... → /api/...?__route=... rewrites matter locally; the
// host-based and external ones belong to Vercel.
const API_REWRITES = (vercel.rewrites || [])
  .filter((r) => r.source.startsWith("/api/") && r.destination.startsWith("/api/") && !r.has)
  .map((r) => ({ source: r.source, destination: r.destination }));

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff",
  ".xml": "application/xml; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf", ".webmanifest": "application/manifest+json",
};

// ------------------------------------------------------- function running --
const modCache = new Map();
async function loadHandler(name) {
  const file = path.join(ROOT, "api", `${name}.js`);
  if (!fs.existsSync(file)) return null;
  // Cache-bust on mtime so editing an api/ file takes effect without a restart.
  const key = `${file}?v=${fs.statSync(file).mtimeMs}`;
  if (!modCache.has(key)) modCache.set(key, import(pathToFileURL(file).href + `?v=${fs.statSync(file).mtimeMs}`));
  const mod = await modCache.get(key);
  return mod.default || null;
}

// Vercel hands the function an already-parsed req.body; every handler here
// treats a missing body as "read the stream myself", so parsing up front is
// the shape they expect.
async function readRequestBody(req) {
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
  const query = {};
  for (const [k, v] of url.searchParams.entries()) query[k] = v;
  req.query = query;
  req.cookies = Object.fromEntries(
    (req.headers.cookie || "").split(";").map((c) => c.trim().split("=")).filter((p) => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join("="))]),
  );
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { if (!res.headersSent) res.setHeader("content-type", "application/json; charset=utf-8"); res.end(JSON.stringify(o)); return res; };
  res.send = (b) => { res.end(typeof b === "string" || Buffer.isBuffer(b) ? b : JSON.stringify(b)); return res; };
  res.redirect = (a, b) => { const [code, loc] = typeof a === "number" ? [a, b] : [302, a]; res.statusCode = code; res.setHeader("location", loc); res.end(); return res; };
  return { req, res };
}

// ---------------------------------------------------------------- statics --
function staticFile(pathname) {
  const clean = decodeURIComponent(pathname).replace(/\/+$/, "") || "/index";
  const rel = clean.replace(/^\/+/, "");
  const candidates = [
    path.join(SITE, rel),
    path.join(SITE, rel + ".html"),
    path.join(SITE, rel, "index.html"),
  ];
  for (const c of candidates) {
    if (!c.startsWith(SITE)) continue;
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

// ------------------------------------------------------------------ serve --
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const t0 = Date.now();
  const done = (code) => console.log(`  ${String(code).padEnd(3)} ${req.method.padEnd(4)} ${url.pathname}${url.search}  ${Date.now() - t0}ms`);

  try {
    // Local storage vault (stand-in for Supabase Storage signed URLs)
    if (url.pathname.startsWith("/__localdb/storage/")) {
      const f = path.join(ROOT, ".localdb", "storage", decodeURIComponent(url.pathname.replace("/__localdb/storage/", "")));
      if (!f.startsWith(path.join(ROOT, ".localdb")) || !fs.existsSync(f)) { res.statusCode = 404; res.end("not found"); return done(404); }
      res.setHeader("content-type", MIME[path.extname(f)] || "application/octet-stream");
      res.end(fs.readFileSync(f));
      return done(200);
    }

    if (url.pathname === "/__dev") {
      res.setHeader("content-type", "application/json; charset=utf-8");
      const { MODES } = await import(pathToFileURL(path.join(ROOT, "api", "_mode.js")).href);
      res.end(JSON.stringify({ ok: true, port: PORT, localDb: process.env.LOCAL_DB === "1", modes: MODES() }, null, 2));
      return done(200);
    }

    if (url.pathname.startsWith("/api/")) {
      let target = url.pathname + url.search;
      for (const rw of API_REWRITES) {
        if (rw.source === url.pathname) {
          const [dPath, dQuery = ""] = rw.destination.split("?");
          const merged = new URLSearchParams(dQuery);
          for (const [k, v] of url.searchParams.entries()) merged.set(k, v);
          target = `${dPath}?${merged.toString()}`;
          break;
        }
      }
      const tUrl = new URL(target, `http://localhost:${PORT}`);
      const name = tUrl.pathname.replace(/^\/api\//, "").replace(/\/+$/, "");
      const handler = await loadHandler(name);
      if (!handler) { res.statusCode = 404; res.end(JSON.stringify({ ok: false, error: "no_such_function", name })); return done(404); }
      vercelify(req, res, tUrl);
      req.body = await readRequestBody(req);
      await handler(req, res);
      if (!res.writableEnded) res.end();
      return done(res.statusCode);
    }

    const file = staticFile(url.pathname);
    if (!file) {
      const notFound = staticFile("/404");
      res.statusCode = 404;
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.end(notFound ? fs.readFileSync(notFound) : "<h1>404</h1>");
      return done(404);
    }
    res.setHeader("content-type", MIME[path.extname(file)] || "application/octet-stream");
    res.setHeader("cache-control", "no-store");
    res.end(fs.readFileSync(file));
    return done(200);
  } catch (e) {
    console.error("  500", req.method, url.pathname, e);
    if (!res.headersSent) res.statusCode = 500;
    if (!res.writableEnded) res.end(JSON.stringify({ ok: false, error: String(e && e.message || e) }));
    return done(500);
  }
});

server.listen(PORT, () => {
  console.log(`
  Business Partner — local development
  ------------------------------------------------------------
  Public site        http://localhost:${PORT}/ar
  Client portal      http://localhost:${PORT}/ar/my
  Operations         http://localhost:${PORT}/ops        (key: ${process.env.SIMPLE_OPS_KEY})
  Classic homepage   http://localhost:${PORT}/ar/classic-home
  Dev status         http://localhost:${PORT}/__dev

  Test sign-in       client@test.local  /  admin@test.local   code ${process.env.SIMPLE_TEST_OTP}
  Database           .localdb/db.json (JSON file — production Supabase untouched)
  Safe modes         payments=${process.env.PAYMENTS_MODE} tamara=${process.env.TAMARA_MODE} whatsapp=${process.env.WHATSAPP_MODE} email=${process.env.EMAIL_MODE} contract=${process.env.CONTRACT_MODE}
  ${envCount ? `.env.local         ${envCount} variable(s) loaded` : ".env.local         not found (defaults in use)"}
  ------------------------------------------------------------
`);
});
