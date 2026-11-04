// قياس ارتفاع كل كتلة (.bk) فعلياً في Chromium حتى تُملأ الصفحات بدقة. الاستعمال: node measure_blocks.mjs in.html out.json
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import fs from 'fs';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(process.argv[2]).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
const hs = await page.evaluate(() => {
  const els = [...document.querySelectorAll('.bk')];
  return els.map((e, i) => {
    const top = e.getBoundingClientRect().top;
    const next = els[i + 1] ? els[i + 1].getBoundingClientRect().top : e.getBoundingClientRect().bottom;
    return Math.ceil(next - top);
  });
});
fs.writeFileSync(process.argv[3], JSON.stringify(hs));
await browser.close();
