// اختبار منطق الصادر بلا واتساب ولا شبكة خارجية: n8n مُحاكى بخادم محلي
// يتحقق من توقيع HMAC كما يفعل السير. `node scripts/outbox-test.mjs`
import http from 'node:http';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  Outbox, resolveDestination, cleanText, sign, readOutboxConfig,
  HARD_HOURLY_MAX, HARD_DAILY_MAX, DEFAULT_BLOCK,
} from '../src/outbox.mjs';

let n = 0;
function ok(name, fn) { return Promise.resolve().then(fn).then(() => { n += 1; console.log('✓', name); }); }

const SECRET = 'x'.repeat(32);
const opts = { userSuffix: 'c.us', block: DEFAULT_BLOCK.slice() };

await ok('الوجهات: صيغ الأرقام', () => {
  for (const [raw, want] of [
    ['0501234567', '966501234567@c.us'], ['501234567', '966501234567@c.us'],
    ['+966 50 123 4567', '966501234567@c.us'], ['00966501234567', '966501234567@c.us'],
    ['966501234567@s.whatsapp.net', '966501234567@c.us'], ['966501234567:12@c.us', '966501234567@c.us'],
    ['123456789012345@lid', '123456789012345@lid'], ['201001234567', '201001234567@c.us'],
  ]) {
    const r = resolveDestination(raw, opts);
    assert.equal(r.ok, true, raw); assert.equal(r.jid, want, raw);
  }
});
await ok('الوجهات: مرفوضات', () => {
  for (const raw of ['', '   ', 'abc', '123', '12345@g.us', '120363@g.us', 'status@broadcast',
    '1203@newsletter', '966501234567@foo.net', '966530540231', '0503793356', '966503793356@c.us',
    '183413122289688@lid', '+', '9'.repeat(20)]) {
    assert.equal(resolveDestination(raw, opts).ok, false, raw);
  }
});
await ok('النص: فارغ/طويل', () => {
  assert.equal(cleanText('  ').ok, false);
  assert.equal(cleanText('x'.repeat(4001)).ok, false);
  assert.equal(cleanText(' مرحبا \r\nيا فلان ').text, 'مرحبا \nيا فلان');
});
await ok('الإعداد: مغلق افتراضياً ولا يفتح إلا بالاسم', () => {
  const keep = { ...process.env };
  try {
    for (const k of Object.keys(process.env)) if (k.startsWith('WA_')) delete process.env[k];
    assert.equal(readOutboxConfig('company', '/x'), null);
    process.env.WA_OUTBOX = '1';
    assert.equal(readOutboxConfig('company', '/x'), null); // لا حسابات مسمّاة
    process.env.WA_OUTBOX_ACCOUNTS = 'personal';
    assert.equal(readOutboxConfig('company', '/x'), null);
    process.env.WA_OUTBOX_ACCOUNTS = 'company';
    assert.throws(() => readOutboxConfig('company', '/x'), /WA_OUTBOX_URL/);
    process.env.WA_OUTBOX_URL = 'http://x'; process.env.WA_BRIDGE_SECRET = SECRET;
    process.env.WA_OUTBOX_HOURLY = '99999'; process.env.WA_OUTBOX_DAILY = '99999';
    const c = readOutboxConfig('company', '/x');
    assert.equal(c.hourlyMax, HARD_HOURLY_MAX); assert.equal(c.dailyMax, HARD_DAILY_MAX);
    process.env.WA_OUTBOX_GAP_MIN_S = '1';
    assert.equal(readOutboxConfig('company', '/x').gapMinMs, 5000); // أدنى فاصل ٥ ثوانٍ
  } finally {
    for (const k of Object.keys(process.env)) if (k.startsWith('WA_')) delete process.env[k];
    Object.assign(process.env, keep);
  }
});

// ---- n8n مُحاكى ----
function fakeN8n(queue) {
  const acks = [];
  const bad = { sig: 0 };
  const srv = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      if (req.headers['x-bp-signature'] !== sign(raw, SECRET)) { bad.sig += 1; res.writeHead(401); return res.end('{}'); }
      const b = JSON.parse(raw);
      res.setHeader('content-type', 'application/json');
      if (b.action === 'pull') {
        const items = queue.splice(0, b.limit);
        return res.end(JSON.stringify({ ok: true, items }));
      }
      acks.push(b);
      res.end(JSON.stringify({ ok: true }));
    });
  });
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve({ srv, acks, bad, url: `http://127.0.0.1:${srv.address().port}/` })));
}

async function mk(queue, over = {}) {
  const n8n = await fakeN8n(queue);
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ob-'));
  const sent = [];
  const cfg = {
    url: n8n.url, secret: SECRET, stateDir: dir, pollS: 60, batch: 5,
    gapMinMs: 0, gapMaxMs: 0, hourlyMax: 60, dailyMax: 200, block: DEFAULT_BLOCK.slice(), ...over.cfg,
  };
  const ob = new Outbox({
    account: 'company', cfg, userSuffix: 'c.us', isReady: over.isReady || (() => true),
    transport: over.transport || (async (jid, text) => { sent.push([jid, text]); return 'MSG' + sent.length; }),
  });
  await ob.init();
  return { ob, n8n, sent };
}

await ok('سحب وإرسال وإقرار + التوقيع صحيح', async () => {
  const q = [{ id: 'a1', to: '0501234567', text: 'مرحبا' }, { id: 'a2', to: '0507654321', text: 'أهلاً' }];
  const { ob, n8n, sent } = await mk(q);
  await ob.tick();
  assert.deepEqual(sent.map((s) => s[0]), ['966501234567@c.us', '966507654321@c.us']);
  assert.deepEqual(n8n.acks.map((a) => [a.id, a.status]), [['a1', 'sent'], ['a2', 'sent']]);
  assert.equal(n8n.bad.sig, 0);
  assert.equal(ob.isMine('966501234567@s.whatsapp.net', 'مرحبا'), true);
  assert.equal(ob.isMine('966501234567@s.whatsapp.net', 'غير ذلك'), false);
  n8n.srv.close();
});
await ok('محظور/مجموعة/نص فارغ: لا إرسال ويُقرّ blocked', async () => {
  const q = [{ id: 'b1', to: '120363@g.us', text: 'x' }, { id: 'b2', to: '0503793356', text: 'x' },
    { id: 'b3', to: '0501234567', text: '  ' }, { id: 'b4', to: '183413122289688@lid', text: 'x' }];
  const { ob, n8n, sent } = await mk(q);
  await ob.tick();
  assert.equal(sent.length, 0);
  assert.deepEqual(n8n.acks.map((a) => a.status), ['blocked', 'blocked', 'blocked', 'blocked']);
  n8n.srv.close();
});
await ok('فشل الإرسال: يُقرّ failed ولا إعادة محاولة', async () => {
  let calls = 0;
  const { ob, n8n } = await mk([{ id: 'c1', to: '0501234567', text: 'x' }], {
    transport: async () => { calls += 1; throw new Error('boom'); },
  });
  await ob.tick(); await ob.tick();
  assert.equal(calls, 1);
  assert.equal(n8n.acks[0].status, 'failed');
  assert.equal(ob.sentAt.length, 0);
  n8n.srv.close();
});
await ok('سقف الساعة: لا يسحب أكثر من المسموح', async () => {
  const q = Array.from({ length: 10 }, (_, i) => ({ id: 'd' + i, to: '05012345' + String(10 + i), text: 't' + i }));
  const { ob, n8n, sent } = await mk(q, { cfg: { hourlyMax: 3, batch: 5 } });
  await ob.tick();
  assert.equal(sent.length, 3);
  const again = await ob.tick(); // لا سعة → لا سحب
  assert.equal(again, false);
  assert.equal(sent.length, 3);
  assert.equal(q.length, 7); // الباقي بقي في الطابور
  n8n.srv.close();
});
await ok('الحالة تبقى على القرص بعد إعادة التشغيل', async () => {
  const { ob, n8n } = await mk([{ id: 'e1', to: '0501234567', text: 'x' }]);
  await ob.tick();
  const ob2 = new Outbox({ account: 'company', cfg: ob.cfg, userSuffix: 'c.us', isReady: () => true, transport: async () => '' });
  await ob2.init();
  assert.equal(ob2.sentAt.length, 1);
  n8n.srv.close();
});
await ok('الجلسة غير جاهزة: لا سحب', async () => {
  const q = [{ id: 'f1', to: '0501234567', text: 'x' }];
  const { ob, n8n, sent } = await mk(q, { isReady: () => false });
  await ob.tick();
  assert.equal(sent.length, 0); assert.equal(q.length, 1);
  n8n.srv.close();
});
await ok('إقرار فاشل يُعاد لاحقاً ولا يُرسَل مرتين', async () => {
  const q = [{ id: 'g1', to: '0501234567', text: 'x' }];
  const { ob, n8n, sent } = await mk(q);
  const realUrl = ob.cfg.url;
  let first = true;
  const origCall = ob.call.bind(ob);
  ob.call = async (b) => { if (b.action === 'ack' && first) { first = false; return { ok: false }; } return origCall(b); };
  await ob.tick();
  assert.equal(ob.pendingAcks.length, 1);
  await ob.tick();
  assert.equal(sent.length, 1);
  assert.equal(ob.pendingAcks.length, 0);
  assert.equal(n8n.acks.filter((a) => a.id === 'g1').length, 1);
  void realUrl;
  n8n.srv.close();
});
await ok('توقيع خاطئ: n8n يرفض ولا إرسال', async () => {
  const q = [{ id: 'h1', to: '0501234567', text: 'x' }];
  const { ob, n8n, sent } = await mk(q);
  ob.cfg.secret = 'y'.repeat(32);
  await ob.tick();
  assert.equal(sent.length, 0); assert.equal(n8n.bad.sig > 0, true);
  n8n.srv.close();
});

console.log(`\n✓ ${n} اختبارات الصادر نجحت.`);
