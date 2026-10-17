// قراءة الإعداد والحدود الصلبة — **بلا أي تبعية على whatsapp-web.js**.
//
// فُصل عن `index.mjs` لسببين:
//   1) إعدادٌ خاطئ يجب أن يُسقط العملية **قبل** إقلاع Chromium، لا بعده.
//   2) هذه الحدود هي قواعد المالك نفسها (لا إرسال · الشخصي ممنوع · حساب
//      واحد)، ووجودها في ملف بلا تبعيات يجعلها قابلة للفحص بـnode وحده
//      على أي جهاز، بلا `npm install` وبلا متصفّح.

import path from 'node:path';
import { readBackfillConfig } from './backfill.mjs';

/** رقم الشركة — هو وحده ما بُني هذا الجسر له. */
export const COMPANY_MSISDN = '966530540231';

/**
 * أرقام ممنوعة في هذا الجسر منعاً مطلقاً، بلا مفتاح تجاوز.
 * الشخصي يقرأ الآن بـBaileys في `ops/wa-bridge` ويعمل؛ نقله إلى محرّك
 * ثانٍ يعني مسح رمزٍ جديد وخسارة جلسة قائمة — خسارةٌ بلا مقابل.
 */
export const BLOCKED_MSISDNS = Object.freeze(['966503793356']);

export function env(name, fallback) {
  const v = process.env[name];
  if (v == null || String(v).trim() === '') return fallback;
  return String(v).trim();
}

export function flag(name, fallback) {
  const v = env(name, fallback ? '1' : '0');
  return v === '1' || v.toLowerCase() === 'true';
}

/**
 * "company:966530540231" → [{name, msisdn}]
 * نفس صيغة الجسر الأول حرفياً، لكن هنا **حساب واحد فقط** مسموح: جلسة
 * متصفح واحدة لكل حاوية، وثانيةٌ تعني Chromium ثانياً وذاكرةً مضاعفة.
 */
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
  if (out.length > 1) {
    throw new Error(
      'WA_ACCOUNTS فيه أكثر من حساب: جسر المتصفّح يشغّل رقم الشركة وحده. '
      + 'الرقم الشخصي يُقرأ بـBaileys في ops/wa-bridge ولا يُنقل.',
    );
  }
  return out;
}

/** يرفض الأرقام الممنوعة. يُنادى قبل أي اتصال، ويرمي فيُسقط الإقلاع. */
export function assertAllowed(account, allowAny) {
  if (BLOCKED_MSISDNS.indexOf(account.msisdn) >= 0) {
    throw new Error(
      `الرقم ${account.msisdn} ممنوع في جسر المتصفّح منعاً مطلقاً. `
      + 'هو يعمل على Baileys في ops/wa-bridge — لا يُنقل ولا يُمسّ.',
    );
  }
  if (!allowAny && account.msisdn !== COMPANY_MSISDN) {
    throw new Error(
      `الرقم ${account.msisdn} ليس رقم الشركة (${COMPANY_MSISDN}). `
      + 'إن كان مقصوداً فاضبط WA_ALLOW_ANY_MSISDN=1 صراحةً.',
    );
  }
  return true;
}

export function readConfig() {
  const webhookUrl = env('WA_WEBHOOK_URL', '');
  const secret = env('WA_BRIDGE_SECRET', '');
  const authDir = env('WA_AUTH_DIR', path.join(process.cwd(), '.wa-auth-web'));
  const queueDir = env('WA_QUEUE_DIR', path.join(process.cwd(), '.wa-queue-web'));
  const accounts = parseAccounts(env('WA_ACCOUNTS', ''));
  const batchWindowS = Number(env('WA_BATCH_WINDOW_S', '120'));
  const ignoreOlderH = Number(env('WA_IGNORE_OLDER_H', '24'));
  const sendEnabled = env('WA_SEND_ENABLED', '0') === '1';
  // مرآة ملف تعريف Chromium: انظر `profile.mjs` — LevelDB على SMB تفسد.
  // `0` يعني «لا مرآة»، ويُستعمل محلياً حيث القرص محلي أصلاً.
  const profileLocalRaw = env('WA_PROFILE_LOCAL_DIR', '/home/bp/profile');
  const profileLocalDir = profileLocalRaw === '0' ? '' : profileLocalRaw;
  const snapshotEverySec = Number(env('WA_PROFILE_SNAPSHOT_S', '300'));
  const resolveNames = flag('WA_RESOLVE_CHAT_NAMES', true);
  const hidePresence = flag('WA_HIDE_PRESENCE', true);
  const printRawQr = flag('WA_QR_RAW', true);
  const allowAny = flag('WA_ALLOW_ANY_MSISDN', false);
  const readLabels = flag('WA_READ_LABELS', true);
  // يُقرأ هنا لا في `session.mjs`: إعدادٌ خاطئ للجرد يجب أن يُسقط العملية
  // **قبل** إقلاع Chromium، كبقية ما في هذا الملف.
  const backfill = readBackfillConfig();

  if (!webhookUrl) throw new Error('WA_WEBHOOK_URL مطلوب');
  if (!secret) throw new Error('WA_BRIDGE_SECRET مطلوب — بلا توقيع يرفض السير الحمولة');
  if (secret.length < 24) throw new Error('WA_BRIDGE_SECRET قصير جداً — 24 محرفاً على الأقل');
  if (sendEnabled) {
    throw new Error(
      'WA_SEND_ENABLED=1 غير مسموح: هذا الجسر قارئ فقط. '
      + 'الردود تُصاغ وتُعرض على المالك ولا تُرسَل.',
    );
  }
  if (!Number.isFinite(batchWindowS) || batchWindowS < 5) throw new Error('WA_BATCH_WINDOW_S لا يقل عن 5');
  if (!Number.isFinite(ignoreOlderH) || ignoreOlderH < 0) throw new Error('WA_IGNORE_OLDER_H رقم غير صالح');
  if (!Number.isFinite(snapshotEverySec) || snapshotEverySec < 60) {
    throw new Error('WA_PROFILE_SNAPSHOT_S لا يقل عن 60 — اللقط أسرع من ذلك يُثقل القرص الشبكي');
  }
  for (const a of accounts) assertAllowed(a, allowAny);

  return {
    webhookUrl, secret, authDir, queueDir, accounts, batchWindowS, ignoreOlderH,
    profileLocalDir, snapshotEverySec, resolveNames, hidePresence, printRawQr,
    readLabels, backfill,
  };
}
