// Copies the Dr. Osamh Almulla site prototype into the build output.
//
// It runs LAST in `npm run build`, on purpose. Every other build step walks
// site/ and rewrites any .html it finds — b10x theme, global header, brand
// layer. Those belong to Business Partner's own site; this page is a client
// prototype with its own identity, so it must land after they have all run.
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
