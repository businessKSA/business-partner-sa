// المشرف: يقرأ الإعداد، ويشغّل جلسة متصفّح واحدة لرقم الشركة، ويصرّف الطابور.
//
// لماذا محرّك ثانٍ بجانب `ops/wa-bridge/`:
// رقم الشركة `966530540231` **يرفض الربط عبر Baileys** منذ أيام، بينما
// يربط فوراً على `web.whatsapp.com` من متصفح المالك. أربع فرضيات جُرّبت
// وسقطت بالفحص (Cloud API · حدّ الأجهزة المرتبطة · حدّ مؤقت من واتساب ·
// تداخل رمزَي QR)، وآخر محاولة بعد تغيير توقيع المتصفح «تحاول وتطول ثم
// تفشل» — أي أن المسح يُقبل والمصافحة تسقط. فالحل تشغيل **نفس العميل الذي
// نجح فعلاً**: صفحة واتساب في متصفح حقيقي، لا بروتوكولاً مُعاد تنفيذه.
//
// الحدود الصلبة — مكتوبة في `config.mjs` ومفحوصة قبل إقلاع Chromium:
//   1) لا إرسال ولا تعليم قراءة. `WA_SEND_ENABLED=1` يمنع الإقلاع.
//   2) الرقم الشخصي `966503793356` ممنوع هنا منعاً مطلقاً — يقرأ بـBaileys
//      في `ops/wa-bridge` ولا يُمسّ.
//   3) الأسرار من البيئة وحدها. لا قيمة افتراضية لسرّ، ولا سرّ في المستودع.
//   4) حساب واحد، ونسخة واحدة. نسختان تكسران جلسة واتساب الواحدة.

import { loadEnvFile } from './dotenv.mjs';
import { logger } from './log.mjs';
import { BLOCKED_MSISDNS, readConfig } from './config.mjs';
import { Sender } from './post.mjs';
import { WebAccountSession } from './session.mjs';

// يُقرأ .env قبل أي استعمال لـprocess.env. البيئة الحقيقية تسبقه دائماً.
loadEnvFile();

const log = logger('bridge-web');

async function main() {
  const cfg = readConfig();
  const account = cfg.accounts[0];

  log.info('جسر المتصفّح يُقلع — قارئ فقط، لا إرسال ولا تعليم قراءة', {
    account: account.name,
    msisdn: account.msisdn,
    batch_window_s: cfg.batchWindowS,
    ignore_older_h: cfg.ignoreOlderH,
    profile_mirrored: cfg.profileLocalDir !== '',
    hide_presence: cfg.hidePresence,
  });
  log.info(`الرقم الشخصي ${BLOCKED_MSISDNS.join(', ')} ممنوع هنا — يقرأ بـBaileys ولا يُمسّ`);

  const sender = new Sender({ url: cfg.webhookUrl, secret: cfg.secret, queueDir: cfg.queueDir });
  await sender.init();

  const session = new WebAccountSession({
    name: account.name,
    msisdn: account.msisdn,
    authDir: cfg.authDir,
    profileLocalDir: cfg.profileLocalDir,
    snapshotEverySec: cfg.snapshotEverySec,
    batchWindowS: cfg.batchWindowS,
    ignoreOlderH: cfg.ignoreOlderH,
    resolveNames: cfg.resolveNames,
    hidePresence: cfg.hidePresence,
    printRawQr: cfg.printRawQr,
    sender,
  });

  session.start().catch(function (err) {
    logger(`wa:${account.name}`).error('فشل الإقلاع', {
      error: String((err && err.message) || err),
    });
  });

  // تصريف الطابور كل دقيقة، فإن كان n8n نائماً عادت الدفعات حين يستيقظ.
  const drainTimer = setInterval(function () { sender.drain(); }, 60000);

  let closing = false;
  async function shutdown(signal) {
    if (closing) return;
    closing = true;
    log.info(`إشارة ${signal} — إغلاق مرتّب`);
    clearInterval(drainTimer);
    // الترتيب مقصود: إيقاف الجلسة يغلق Chromium ثم يلقط الجلسة إلى /data،
    // وهي أسلم لقطة في عمر العملية (قواعد LevelDB مُغلقة فعلاً). ثم تُصرَّف
    // الدفعات المتأخّرة.
    await session.stop();
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
