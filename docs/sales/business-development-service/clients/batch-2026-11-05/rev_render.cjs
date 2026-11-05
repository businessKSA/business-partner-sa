// node rev_render.cjs <html> <out.pdf>  → PDF + مستطيلات .fld (نص) و.cbx (خانة اختيار) في out.fields.json
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
      sh.querySelectorAll('.fld').forEach(f => { const r = f.getBoundingClientRect(); res.push({ name: f.dataset.f, cb: f.classList.contains('cbx'), page: i, x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height, pw: sr.width, ph: sr.height }); });
    });
    return res;
  });
  // قياس الفائض: أي محتوى يتجاوز تذييل الصفحة
  const over = await pg.evaluate(() => {
    const res = [];
    document.querySelectorAll('.sheet').forEach((sh, i) => {
      const sr = sh.getBoundingClientRect(); const ft = sh.querySelector('.ft'); const lim = ft ? ft.getBoundingClientRect().top - 4 : sr.bottom;
      let mx = 0; sh.querySelectorAll('.bp > *, .bp table, .sg, .cl, .pty2').forEach(e => { mx = Math.max(mx, e.getBoundingClientRect().bottom); });
      if (mx > lim) res.push({ page: i + 1, over: Math.round(mx - lim) });
    });
    return res;
  });
  await pg.pdf({ path: out, preferCSSPageSize: true, printBackground: true });
  require('fs').writeFileSync(out.replace(/\.pdf$/, '.fields.json'), JSON.stringify(flds));
  console.log(require('path').basename(file), 'fields', flds.length, 'overflow', JSON.stringify(over));
  await br.close();
})();
