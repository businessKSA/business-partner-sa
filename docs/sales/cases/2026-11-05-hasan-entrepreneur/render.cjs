// مساعد التصيير: node render.cjs pdf <html> <out.pdf> <landscape|portrait>
//                node render.cjs measure <html>   → JSON بارتفاعات العناصر ذات data-m
//                node render.cjs shots <html> <outdir> <prefix>  → صورة لكل .sheet
const { chromium } = require('playwright');
(async () => {
  const [mode, file, a, b] = process.argv.slice(2);
  const br = await chromium.launch({ args: ['--no-sandbox'] });
  const pg = await br.newPage({ viewport: { width: 1200, height: 900 } });
  await pg.goto('file://' + require('path').resolve(file), { waitUntil: 'networkidle' });
  await pg.evaluate(() => document.fonts.ready);
  if (mode === 'pdf') {
    await pg.pdf({ path: a, preferCSSPageSize: true, printBackground: true });
  } else if (mode === 'measure') {
    const r = await pg.evaluate(() => {
      const o = {};
      document.querySelectorAll('[data-m]').forEach(e => { const cs = getComputedStyle(e); o[e.dataset.m] = e.getBoundingClientRect().height + (parseFloat(cs.marginTop)||0) + (parseFloat(cs.marginBottom)||0); });
      const hd = document.querySelector('.hd'); o.__hdBottom = hd ? hd.getBoundingClientRect().bottom - hd.closest('.sheet').getBoundingClientRect().top : 0;
      return o;
    });
    console.log(JSON.stringify(r));
  } else if (mode === 'shots') {
    const sheets = await pg.$$('.sheet');
    let i = 0;
    for (const s of sheets) { i++; await s.screenshot({ path: `${a}/${b}-${String(i).padStart(2,'0')}.png` }); }
    // تجاوز المحتوى: عناصر تنزل عن حد الصفحة
    const over = await pg.evaluate(() => {
      const res = [];
      document.querySelectorAll('.sheet').forEach((sh, i) => {
        const sr = sh.getBoundingClientRect(); const land = sh.classList.contains('land');
        const limit = land ? 650 : 979;
        sh.querySelectorAll('table, .card, .sg, h2, p, .pre, .meta1').forEach(e => {
          if (e.closest('.ft') || e.closest('.cv')) return;
          const bt = e.getBoundingClientRect().bottom - sr.top; if (bt > limit + 1) res.push({ sheet: i + 1, tag: e.tagName, cls: e.className, bottom: Math.round(bt), limit });
        });
      });
      return res;
    });
    console.log(JSON.stringify(over));
  }
  await br.close();
})();
