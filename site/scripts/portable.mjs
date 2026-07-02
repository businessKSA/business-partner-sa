// Build a portable copy of the site (relative paths + .html links) that opens
// by double-click, no server needed. Output: dist-portable/.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(__dirname, "..");
const OUT = path.resolve(SITE, "..", "dist-portable");

const ROUTES = ["about", "ai-agents", "packages", "calculator", "saudi-arabia", "news", "careers", "contact"];

function rmrf(p) { if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true }); }
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

function rewrite(html, prefix) {
  return html
    // assets (css/js/img) referenced by href or src
    .replace(/(href|src)="\/assets\//g, `$1="${prefix}assets/`)
    .replace(/content="\/assets\//g, `content="${prefix}assets/`)
    // individual service pages: /services/<slug> -> services/<slug>.html
    .replace(/href="\/services\/([a-z0-9-]+)"/g, `href="${prefix}services/$1.html"`)
    // services index with optional #hash
    .replace(/href="\/services(#[^"]*)?"/g, (_, h) => `href="${prefix}services.html${h || ""}"`)
    // other top-level routes with optional query/hash
    .replace(new RegExp(`href="/(${ROUTES.join("|")})((?:\\?|#)[^"]*)?"`, "g"),
      (_, r, q) => `href="${prefix}${r}.html${q || ""}"`)
    // home
    .replace(/href="\/"/g, `href="${prefix}index.html"`);
}

rmrf(OUT);
fs.mkdirSync(OUT, { recursive: true });
// copy static assets folder
copyDir(path.join(SITE, "assets"), path.join(OUT, "assets"));

// root html pages
for (const f of fs.readdirSync(SITE)) {
  if (f.endsWith(".html")) {
    fs.writeFileSync(path.join(OUT, f), rewrite(fs.readFileSync(path.join(SITE, f), "utf8"), ""));
  }
}
// service pages (one level deep -> prefix ../)
const svcOut = path.join(OUT, "services");
fs.mkdirSync(svcOut, { recursive: true });
for (const f of fs.readdirSync(path.join(SITE, "services"))) {
  if (f.endsWith(".html")) {
    fs.writeFileSync(path.join(svcOut, f), rewrite(fs.readFileSync(path.join(SITE, "services", f), "utf8"), "../"));
  }
}
const n = fs.readdirSync(OUT).filter((f) => f.endsWith(".html")).length + fs.readdirSync(svcOut).length;
console.log(`Portable build ready at dist-portable/ (${n} pages). Open index.html directly.`);
