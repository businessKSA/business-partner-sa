// Copies the Dr. Osamh Almulla site prototype into the build output.
//
// Its position in `npm run build` is deliberate: after every step that
// rewrites HTML (b10x theme, global header, brand layer, baher-support), and
// before verify-pages.mjs. Those rewriting steps walk site/ and stamp Business
// Partner's own identity onto any .html they find; this page carries the
// client's identity instead, so it must land after them. verify-pages.mjs only
// parses inline scripts, so running last of all would skip this page's script
// — better to sit just before it and be checked like every other page.
//
// The source lives outside site/ (ops/osamh-demo/) so no walker ever sees it.
// Preview-only: the page carries a noindex meta and a visible prototype
// banner, and Vercel serves preview deployments with X-Robots-Tag: noindex.

import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve('ops/osamh-demo');
const OUT = path.resolve('site/preview/osamh');

if (!fs.existsSync(SRC)) {
  console.log('Osamh preview: source folder missing, nothing to copy');
  process.exit(0);
}

fs.mkdirSync(OUT, { recursive: true });

let copied = 0;
for (const entry of fs.readdirSync(SRC, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  fs.copyFileSync(path.join(SRC, entry.name), path.join(OUT, entry.name));
  copied++;
}

const index = path.join(OUT, 'index.html');
if (fs.existsSync(index)) {
  const html = fs.readFileSync(index, 'utf8');
  if (!/noindex/i.test(html)) {
    console.error('Osamh preview: index.html is missing its noindex meta — refusing to publish');
    process.exit(1);
  }
}

console.log(`Osamh preview copied to site/preview/osamh (${copied} file${copied === 1 ? '' : 's'})`);
