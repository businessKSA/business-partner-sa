/** عينة PDF للتحقق من ظهور العربية بشكل صحيح. */
import fs from 'node:fs/promises';
import { renderPdf, closeBrowser, printUrl } from '../src/lib/pdf';

const token = process.argv[2];
const out = process.argv[3] || './sample.pdf';
if (!token) { console.error('usage: tsx scripts/pdf-sample.ts <publicToken> [out.pdf]'); process.exit(1); }

async function main() {
  const url = printUrl(token);
  console.log('printing:', url);
  const buf = await renderPdf({ url });
  await fs.writeFile(out, buf);
  console.log(`wrote ${out} — ${buf.length} bytes`);
  await closeBrowser();
}

main().catch((e) => { console.error(e); process.exit(1); });
