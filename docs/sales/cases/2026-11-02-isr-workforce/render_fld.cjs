// node render_fld.cjs <html> <out.pdf> <landscape|portrait>  → PDF + مستطيلات .fld في out.fields.json
const { chromium } = require('playwright');
(async () => {
  const [file, out] = process.argv.slice(2);
  const br = await chromium.launch({ args: ['--no-sandbox'] });
  const pg = await br.newPage({ viewport: { width: 1200, height: 900 } });
  await pg.goto('file://' + require('path').resolve(file), { waitUntil: 'networkidle' });
  await pg.evaluate(() => document.fonts.ready);
  const flds = await pg.evaluate(() => {
    const res = [];
    document.querySelectorAll('.sheet').forEach((sh, i) => {
      const sr = sh.getBoundingClientRect();
      sh.querySelectorAll('.fld').forEach(f => { const r = f.getBoundingClientRect(); res.push({ name: f.dataset.f, page: i, x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height, pw: sr.width, ph: sr.height }); });
    });
    return res;
  });
  await pg.pdf({ path: out, preferCSSPageSize: true, printBackground: true });
  require('fs').writeFileSync(out.replace(/\.pdf$/, '.fields.json'), JSON.stringify(flds));
  await br.close();
})();
