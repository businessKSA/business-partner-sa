// تحويل HTML إلى PDF بـ Chromium (Playwright) مع فحص اتساع كل صفحة. الاستعمال: node render_pdf.mjs "in.html=>out.pdf|in2=>out2"
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const jobs = process.argv[2].split('|').map(j => j.split('=>'));
const browser = await chromium.launch();
let bad = 0;
for (const [inp, out] of jobs) {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(inp).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const rep = await page.evaluate(() => {
    const res = [];
    document.querySelectorAll('.sheet').forEach((sh, i) => {
      const top = sh.getBoundingClientRect().top;
      const inner = sh.firstElementChild;
      const ft = sh.querySelector('.ft');
      const isCover = !!sh.querySelector('.cv');
      let maxB = 0;
      inner.querySelectorAll('*').forEach(e => { const r = e.getBoundingClientRect(); if (r.height > 0 && r.bottom - top > maxB) maxB = r.bottom - top; });
      const limit = ft ? ft.getBoundingClientRect().top - top : sh.clientHeight;
      res.push({ i: i + 1, bottom: Math.round(maxB), limit: Math.round(limit), cover: isCover, hscroll: sh.scrollWidth > sh.clientWidth + 1 });
    });
    return res;
  });
  const fonts = await page.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.weight));
  await page.pdf({ path: out, preferCSSPageSize: true, printBackground: true });
  const name = inp.split('/').pop();
  let line = `${name}: ${rep.length} sheets; fonts loaded: ${[...new Set(fonts)].length}`;
  console.log(line);
  for (const r of rep) {
    const over = !r.cover && r.bottom > r.limit - 4;
    if (over || r.hscroll) { bad++; console.log(`   OVERFLOW sheet ${r.i}: content bottom ${r.bottom} > limit ${r.limit}${r.hscroll ? ' (h-scroll)' : ''}`); }
    else if (!r.cover) console.log(`   ok sheet ${r.i}: bottom ${r.bottom} / limit ${r.limit}`);
  }
  await page.close();
}
await browser.close();
if (bad) console.log(`TOTAL OVERFLOWS: ${bad}`);
