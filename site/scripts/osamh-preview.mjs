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

// Only the public page ships. The interactive prototype in this folder carries
// the client's own commercial figures — commission rate, monthly revenue,
// settlement totals — and was kept at an unlinked path while the project's SSO
// protection was on, which made it genuinely private. That protection was
// switched off so the public page could be reached without a login, and an
// unlinked path is NOT private: the prototype became publicly fetchable by
// anyone holding or guessing the URL. It is not deployed at all any more; it
// lives in ops/ for the repository, and is shown to the client directly.
const PUBLISHED = new Set(['index.html']);

let copied = 0;
for (const entry of fs.readdirSync(SRC, { withFileTypes: true })) {
  if (!entry.isFile() || !PUBLISHED.has(entry.name)) continue;
  fs.copyFileSync(path.join(SRC, entry.name), path.join(OUT, entry.name));
  copied++;
}

// Build output is committed in this repository, so a page dropped from
// PUBLISHED would otherwise survive in the checkout and keep being served.
for (const entry of fs.readdirSync(OUT)) {
  if (!PUBLISHED.has(entry)) {
    fs.rmSync(path.join(OUT, entry), { force: true });
    console.log(`Osamh preview: removed stale ${entry} from the build output`);
  }
}

// Every page here is preview-only, so every page must carry noindex — not just
// the entry point. A page added later without it would otherwise ship indexable.
for (const entry of fs.readdirSync(OUT)) {
  if (!entry.endsWith('.html')) continue;
  const html = fs.readFileSync(path.join(OUT, entry), 'utf8');
  if (!/noindex/i.test(html)) {
    console.error(`Osamh preview: ${entry} is missing its noindex meta — refusing to publish`);
    process.exit(1);
  }
}

// The domain osamh.businesspartner.sa is bound to this branch and must serve
// the client's page at its ROOT, not at /preview/osamh. A host-scoped rewrite
// in vercel.json handles /platform, but it cannot handle "/" — Vercel checks
// the filesystem BEFORE rewrites, so site/index.html always wins and the
// visitor gets Business Partner's homepage instead. Verified live: /platform
// served the prototype while / served the BP homepage.
//
// So the root index is replaced here instead — and ONLY on this branch.
// VERCEL_GIT_COMMIT_REF is set by Vercel per deployment, so:
//   - the production branch never matches, even if this file reaches its build
//   - `npm run dev` has no such variable, so local builds keep the real homepage
const BRANCH = 'claude/osamh-demo';
if (process.env.VERCEL_GIT_COMMIT_REF === BRANCH) {
  const root = path.resolve('site/index.html');
  fs.copyFileSync(path.join(OUT, 'index.html'), root);
  console.log(`Osamh preview: root index replaced (branch ${BRANCH})`);
} else {
  console.log(`Osamh preview: root index untouched (ref ${process.env.VERCEL_GIT_COMMIT_REF || 'unset'})`);
}

console.log(`Osamh preview copied to site/preview/osamh (${copied} file${copied === 1 ? '' : 's'})`);
