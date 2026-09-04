// Every /assets/js and /assets/css URL in the built site must carry its file's
// content hash as the cache-buster.
//
// Why this is worth a test: /assets/* is served "max-age=31536000, immutable".
// A buster that does not change when the file changes means every browser and
// the CDN keep the first copy forever. That is exactly what happened to the
// business-development workspace: the page said "?v=4", the file was rewritten
// many times, and the owner opened the live page and read a product name the
// JavaScript had not contained for weeks.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve("site");
const hash = (rel) => crypto.createHash("md5").update(fs.readFileSync(path.join(ROOT, rel))).digest("hex").slice(0, 10);
const fail = [];
const ok = (c, m) => { console.log((c ? "  ok   " : "  FAIL ") + m); if (!c) fail.push(m); };

function* htmlFiles(dir) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) yield* htmlFiles(full);
    else if (f.endsWith(".html")) yield full;
  }
}

console.log("\n1. The hand-written dashboard pages carry content hashes, not literals");
let checked = 0, bad = [];
for (const file of htmlFiles(path.join(ROOT, "assets", "data"))) {
  const html = fs.readFileSync(file, "utf8");
  for (const m of html.matchAll(/\/assets\/(js|css)\/([\w.-]+\.(?:js|css))\?v=([^"']*)/g)) {
    const rel = `assets/${m[1]}/${m[2]}`;
    if (!fs.existsSync(path.join(ROOT, rel))) continue;
    checked++;
    if (m[3] !== hash(rel)) bad.push(`${path.relative(ROOT, file)} → ${rel}?v=${m[3]} (expected ${hash(rel)})`);
  }
}
ok(checked > 0, "found asset URLs to check: " + checked);
ok(bad.length === 0, "every buster is the file's hash" + (bad.length ? "\n         " + bad.join("\n         ") : ""));

console.log("\n2. The workspace page in particular points at the current dashboard script");
const page = fs.readFileSync(path.join(ROOT, "assets", "data", "revenue-command-center.html"), "utf8");
const js = page.match(/revenue-dashboard-v2\.js\?v=([^"']*)/);
ok(!!js && js[1] === hash("assets/js/revenue-dashboard-v2.js"), "revenue-dashboard-v2.js?v= is its hash: " + (js && js[1]));
ok(!/\?v=\d+"/.test(page), "no numeric literal busters remain on the page");

console.log(fail.length ? "\nFAILED: " + fail.length : "\nALL PASS");
process.exit(fail.length ? 1 : 0);
