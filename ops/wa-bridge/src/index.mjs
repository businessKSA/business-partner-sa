// المشرف: يقرأ الإعداد، ويشغّل جلسة مستقلة لكل رقم، ويصرّف الطابور دورياً.
//
// الحدود الصلبة في هذا الملف — لا تُخفَّف:
//   1) الجسر لا يرسل إلا الصادر المأمور من فرح (`outbox.mjs`)، مغلق افتراضياً
//      ويُفتح بـWA_OUTBOX=1 + WA_OUTBOX_ACCOUNTS. WA_SEND_ENABLED=1 يمنع الإقلاع.
//   2) الرقم الشخصي 966503793356 كان قراءة فقط نهائياً. بأمر المالك (2026-10-17)
//      صار يُرسل منه فرح أيضاً، لكن بمفتاح ثانٍ صريح: WA_OUTBOX_ALLOW_PERSONAL=1.
//   3) الأسرار من البيئة وحدها. لا قيمة افتراضية لسرّ، ولا سرّ في المستودع.

import { loadEnvFile } from './dotenv.mjs';
import path from 'node:path';
import { logger } from './log.mjs';
import { Sender } from './post.mjs';
import { AccountSession } from './session.mjs';
import { readBackfillConfig } from './backfill.mjs';
import { readOutboxConfig } from './outbox.mjs';

// يُقرأ .env قبل أي استعمال لـprocess.env. البيئة الحقيقية تسبقه دائماً.
loadEnvFile();

const log = logger('bridge');

/** الرقم الشخصي: قراءة فقط ما لم يُفتح صادره بمفتاحين (حسابٌ مسمّى + ALLOW_PERSONAL). */
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
      'WA_SEND_ENABLED=1 غير مسموح ولن يُدعم. الإرسال الوحيد المسموح هو الصادر '
      + 'المأمور من فرح: WA_OUTBOX=1 مع WA_OUTBOX_ACCOUNTS (انظر src/outbox.mjs).',
    );
  }
  if (!Number.isFinite(batchWindowS) || batchWindowS < 5) throw new Error('WA_BATCH_WINDOW_S لا يقل عن 5');
  if (!Number.isFinite(ignoreOlderH) || ignoreOlderH < 0) throw new Error('WA_IGNORE_OLDER_H رقم غير صالح');

  // يُقرأ ويُتحقّق منه هنا فيسقط الإقلاع على إعدادٍ خاطئ، لا في منتصف الجرد.
  const backfill = readBackfillConfig();

  // الصادر لكل حساب: null = مغلق. الشخصي يحتاج مفتاحاً ثانياً صريحاً.
  const allowPersonal = env('WA_OUTBOX_ALLOW_PERSONAL', '0') === '1';
  const outbox = {};
  for (const a of accounts) {
    const o = readOutboxConfig(a.name, authDir);
    if (o && READ_ONLY_MSISDNS.indexOf(a.msisdn) >= 0 && !allowPersonal) {
      throw new Error(
        `WA_OUTBOX_ACCOUNTS يسمّي "${a.name}" وهو الرقم الشخصي (${a.msisdn}) المحمي. `
        + 'إن كان المالك يريد الإرسال منه فعلاً فاضبط WA_OUTBOX_ALLOW_PERSONAL=1 صراحةً.',
      );
    }
    outbox[a.name] = o;
  }

  return {
    webhookUrl, secret, authDir, queueDir, accounts, batchWindowS, ignoreOlderH, backfill, outbox,
  };
}

async function main() {
  const cfg = readConfig();

  log.info('الجسر يُقلع — قارئ، والإرسال فقط للصادر المأمور من فرح (إن فُتح)', {
    accounts: cfg.accounts.length,
    batch_window_s: cfg.batchWindowS,
    ignore_older_h: cfg.ignoreOlderH,
    backfill: cfg.backfill.enabled,
  });
  if (cfg.backfill.enabled) {
    log.warn('⚠️ وضع الجرد مطلوب — ناقصٌ بطبيعته في Baileys، انظر رأس src/backfill.mjs', {
      max_chats: cfg.backfill.maxChats,
      msgs_per_chat: cfg.backfill.msgsPerChat,
      days: cfg.backfill.days,
      delay_ms: cfg.backfill.delayMs,
      skip_groups: cfg.backfill.skipGroups,
      full_history: cfg.backfill.fullHistory,
      force: cfg.backfill.force,
    });
  }
  for (const a of cfg.accounts) {
    const ro = READ_ONLY_MSISDNS.indexOf(a.msisdn) >= 0;
    const sends = !!cfg.outbox[a.name];
    log.info(`حساب: ${a.name} (${a.msisdn})${ro && !sends ? ' — قراءة فقط' : ''}${sends ? ' — الصادر المأمور من فرح مفتوح' : ''}`);
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
      backfill: cfg.backfill,
      outbox: cfg.outbox[a.name],
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
