// المشرف: يقرأ الإعداد، ويشغّل جلسة مستقلة لكل رقم، ويصرّف الطابور دورياً.
//
// الحدود الصلبة في هذا الملف — لا تُخفَّف:
//   1) الجسر لا يرسل أي رسالة واتساب. WA_SEND_ENABLED موجود للمستقبل فقط،
//      وإن كان 1 فالعملية ترفض الإقلاع في الإصدار الأول.
//   2) الرقم الشخصي 966503793356 قراءة فقط نهائياً (قاعدة مالك صريحة).
//   3) الأسرار من البيئة وحدها. لا قيمة افتراضية لسرّ، ولا سرّ في المستودع.

import { loadEnvFile } from './dotenv.mjs';
import path from 'node:path';
import { logger } from './log.mjs';
import { Sender } from './post.mjs';
import { AccountSession } from './session.mjs';

// يُقرأ .env قبل أي استعمال لـprocess.env. البيئة الحقيقية تسبقه دائماً.
loadEnvFile();

const log = logger('bridge');

/** الرقم الشخصي: قراءة فقط نهائياً. لا إرسال منه بأي حال. */
export const READ_ONLY_MSISDNS = Object.freeze(['966503793356']);

function env(name, fallback) {
  const v = process.env[name];
  if (v == null || String(v).trim() === '') return fallback;
  return String(v).trim();
}

/** "company:966530540231,personal:966503793356" → [{name, msisdn}] */
export function parseAccounts(spec) {
  const out = [];
  const seen = new Set();
  for (const part of String(spec || '').split(',')) {
    const chunk = part.trim();
    if (!chunk) continue;
    const i = chunk.indexOf(':');
    if (i < 1) throw new Error(`WA_ACCOUNTS: صيغة خاطئة في "${chunk}" — المتوقّع name:msisdn`);
    const name = chunk.slice(0, i).trim();
    const msisdn = chunk.slice(i + 1).replace(/\D/g, '');
    if (!/^[a-z0-9_-]+$/i.test(name)) throw new Error(`WA_ACCOUNTS: اسم حساب غير صالح "${name}"`);
    if (!msisdn) throw new Error(`WA_ACCOUNTS: رقم غير صالح للحساب "${name}"`);
    if (seen.has(name)) throw new Error(`WA_ACCOUNTS: اسم الحساب "${name}" مكرّر`);
    seen.add(name);
    out.push({ name, msisdn });
  }
  if (!out.length) throw new Error('WA_ACCOUNTS فارغ — لا حساب لتشغيله');
  return out;
}

function readConfig() {
  const webhookUrl = env('WA_WEBHOOK_URL', '');
  const secret = env('WA_BRIDGE_SECRET', '');
  const authDir = env('WA_AUTH_DIR', path.join(process.cwd(), '.wa-auth'));
  const queueDir = env('WA_QUEUE_DIR', path.join(process.cwd(), '.wa-queue'));
  const accounts = parseAccounts(env('WA_ACCOUNTS', ''));
  const batchWindowS = Number(env('WA_BATCH_WINDOW_S', '120'));
  const ignoreOlderH = Number(env('WA_IGNORE_OLDER_H', '24'));
  const sendEnabled = env('WA_SEND_ENABLED', '0') === '1';

  if (!webhookUrl) throw new Error('WA_WEBHOOK_URL مطلوب');
  if (!secret) throw new Error('WA_BRIDGE_SECRET مطلوب — بلا توقيع يرفض السير الحمولة');
  if (secret.length < 24) throw new Error('WA_BRIDGE_SECRET قصير جداً — 24 محرفاً على الأقل');
  if (sendEnabled) {
    throw new Error(
      'WA_SEND_ENABLED=1 غير مسموح: الإصدار الأول قارئ فقط. الردود تُصاغ وتُعرض على المالك ولا تُرسَل.',
    );
  }
  if (!Number.isFinite(batchWindowS) || batchWindowS < 5) throw new Error('WA_BATCH_WINDOW_S لا يقل عن 5');
  if (!Number.isFinite(ignoreOlderH) || ignoreOlderH < 0) throw new Error('WA_IGNORE_OLDER_H رقم غير صالح');

  return { webhookUrl, secret, authDir, queueDir, accounts, batchWindowS, ignoreOlderH };
}

async function main() {
  const cfg = readConfig();

  log.info('الجسر يُقلع — قارئ فقط، لا إرسال', {
    accounts: cfg.accounts.length,
    batch_window_s: cfg.batchWindowS,
    ignore_older_h: cfg.ignoreOlderH,
  });
  for (const a of cfg.accounts) {
    const ro = READ_ONLY_MSISDNS.indexOf(a.msisdn) >= 0;
    log.info(`حساب: ${a.name} (${a.msisdn})${ro ? ' — قراءة فقط نهائياً' : ''}`);
  }

  const sender = new Sender({ url: cfg.webhookUrl, secret: cfg.secret, queueDir: cfg.queueDir });
  await sender.init();

  const sessions = [];
  for (const a of cfg.accounts) {
    const s = new AccountSession({
      name: a.name,
      msisdn: a.msisdn,
      authDir: cfg.authDir,
      batchWindowS: cfg.batchWindowS,
      ignoreOlderH: cfg.ignoreOlderH,
      sender,
    });
    sessions.push(s);
    // كل جلسة تُقلع مستقلة: فشل واحدة لا يمنع الأخرى.
    s.start().catch(function (err) {
      logger(`wa:${a.name}`).error('فشل الإقلاع', { error: String((err && err.message) || err) });
    });
  }

  // تصريف الطابور كل دقيقة، فإن كان n8n نائماً عادت الدفعات حين يستيقظ.
  const drainTimer = setInterval(function () { sender.drain(); }, 60000);

  let closing = false;
  async function shutdown(signal) {
    if (closing) return;
    closing = true;
    log.info(`إشارة ${signal} — إغلاق مرتّب`);
    clearInterval(drainTimer);
    for (const s of sessions) await s.stop();
    await sender.drain();
    process.exit(0);
  }
  process.on('SIGINT', function () { shutdown('SIGINT'); });
  process.on('SIGTERM', function () { shutdown('SIGTERM'); });
  process.on('unhandledRejection', function (err) {
    log.error('رفض غير معالَج', { error: String((err && err.message) || err) });
  });
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('index.mjs');
if (invokedDirectly) {
  main().catch(function (err) {
    log.error('الجسر لم يُقلع', { error: String((err && err.message) || err) });
    process.exit(1);
  });
}
