// يشغّل اللعبة بلا واجهة، يبني كل مرحلة، ويُصدّر مدينتها (الصناديق) ومسارات
// الحرّاس والأهداف والمخطوطات إلى unreal/Content/Data/levels.json
// الاستعمال: node game/tools/export-levels.mjs   (يحتاج playwright وvendor/three.min.js)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.resolve(here, '..');
const out = path.resolve(here, '../../unreal/Content/Data/levels.json');
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 800, height: 600 } });
await page.route('**/three.min.js', r => r.fulfill({ path: path.join(gameDir, 'vendor/three.min.js'), contentType: 'application/javascript' }));
await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
await page.goto('file://' + path.join(gameDir, 'index.html'));
await page.waitForTimeout(1500);
const data = await page.evaluate(() => {
  const M = 100; // متر في اللعبة = ١٠٠ وحدة Unreal (سم)
  const levels = [];
  for (let i = 0; i < LEVELS.length; i++) {
    const lv = LEVELS[i];
    loadWorld(lv); spawnPlayer(lv.start[0], lv.start[1]); spawnGuards(lv); spawnManuscripts(lv);
    const solids = world.solids.map(s => ({
      kind: s.kind, climbable: !!s.climbable,
      center: { x: (s.minX + s.maxX) / 2 * M, y: (s.minZ + s.maxZ) / 2 * M, z: (s.minY + s.maxY) / 2 * M },
      extent: { x: (s.maxX - s.minX) / 2 * M, y: (s.maxZ - s.minZ) / 2 * M, z: (s.maxY - s.minY) / 2 * M }
    }));
    const guardsOut = guards.map(g => ({ range: g.range * M, fovDeg: g.fov * 180 / Math.PI, waypoints: g.wps.map(w => ({ x: w[0] * M, y: w[1] * M, z: 0 })) }));
    const objectives = lv.objectives.map(o => {
      const roof = o.roof || o.type === 'roof';
      const pos = o.type === 'collect' ? null : resolvePos(o.pos, roof);
      return { type: o.type, text: o.text, label: o.label || null, seconds: o.seconds || null, alarm: !!o.alarm, effect: o.effect || null,
        position: pos ? { x: pos[0] * M, y: pos[2] * M, z: pos[1] * M } : null,
        items: o.type === 'collect' ? o.items.map(p => { const r = resolvePos(p, false); return { x: r[0] * M, y: r[2] * M, z: r[1] * M }; }) : null };
    });
    const manuscripts = game.manus.map(m => ({ id: m.data.id, title: m.data.title, fact: m.data.fact, position: { x: m.pos[0] * M, y: m.pos[2] * M, z: m.pos[1] * M } }));
    levels.push({ id: lv.id, title: lv.title, era: lv.era, year: lv.year, hijri: lv.hijri, time: lv.time, landmark: lv.landmark, hero: lv.hero,
      start: { x: lv.start[0] * M, y: lv.start[1] * M, z: 0 },
      intro: lv.intro.map(s => ({ cam: s.cam, cam2: s.cam2 || s.cam, look: s.look, dur: s.dur, text: s.text, year: s.year || null })),
      solids, guards: guardsOut, objectives, manuscripts, outro: lv.outro });
  }
  return { units: 'centimeters (game metre × 100); Unreal axes: X=east, Y=south(game z), Z=up', wallHalfWidth: 48 * M, levels };
});
await b.close();
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(data, null, 1));
console.log('exported', data.levels.length, 'levels →', path.relative(process.cwd(), out), data.levels.map(l => `${l.id}: ${l.solids.length} solids, ${l.guards.length} guards`).join(' | '));
