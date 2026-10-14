// جلسة واتساب واحدة بمحرّك **متصفح حقيقي**: صفحة `web.whatsapp.com` داخل
// Chromium بلا رأس، تُقادُ بـwhatsapp-web.js.
//
// ⚠️⚠️ قارئ فقط — وهذا الملف هو موضع الخطر الحقيقي.
//
// في الجسر الأول (Baileys) كان «لا إرسال» سهلاً: لا دالة إرسال في الملف.
// هنا الأمر أخطر: كائن `Client` **يملك** `sendMessage` و`sendSeen` جاهزتين،
// وسطرٌ واحد يكفي لكسر قاعدتين من قواعد المالك. فُحص مصدر المكتبة
// (الإصدار 1.34.7) والنتيجة الحاسمة:
//
//   • `window.WWebJS.sendSeen` هو **الطريق الوحيد** لتعليم محادثة مقروءة،
//     ولا يُستدعى إلا من `Client.sendSeen()` ومن `Client.sendMessage()`
//     (الخيار `sendSeen` افتراضه `true` — فالإرسال يعلّم القراءة ضمناً).
//   • لا `initialize()` ولا `inject()` ولا أي معالج أحداث يستدعيه.
//   • `getChat()` و`getContact()` و`getQuotedMessage()` **لا** تعلّم قراءة.
//   • `sendSeen` يستدعي داخلياً `Stream.markAvailable()` — أي يُظهر «متصل».
//     فهو ممنوع مرتين: للقراءة وللحضور.
//
// ولهذا: لا استدعاء لأيٍّ منها في هذا الملف، و`scripts/guard.mjs` يفحص ذلك
// نصّياً في كل `npm run check`.
//
// وما يُفعل عكسَ ذلك: `sendPresenceUnavailable()` مرةً عند الجهوز — يُخفي
// «متصل» ولا يمسّ حالة القراءة. هو الاستدعاء الوحيد الذي يغيّر حضوراً،
// واتجاهه نحو الإخفاء لا الإظهار.
//
// ملاحظة لا تُخفّف: **إيصال التسليم (علامتا الصحّ) يُرسل من البروتوكول نفسه**
// لأي جهاز مرتبط، وهذا يصدق على Baileys وعلى جوال المالك سواء. لا تُطفأ.
// المُطفأ هو **إيصال القراءة** (الأزرق) وحالة «غير مقروء» على جوال المالك.

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import qrcode from 'qrcode-terminal';
import wweb from 'whatsapp-web.js';
import { logger } from './log.mjs';
import {
  buildPayload,
  canonicalJid,
  chatIdOf,
  isGroupJid,
  messageIdOf,
  normalizeMessage,
  senderJidOf,
  shouldSkip,
  tsOf,
} from './normalize.mjs';
import { ProfileSnapshotter, restoreProfile, resolveProfileDirs } from './profile.mjs';

const { Client, LocalAuth } = wweb;

const MAX_BACKOFF_MS = 5 * 60 * 1000;
const MAX_MESSAGES_PER_BATCH = 40;

/**
 * وسائط Chromium داخل حاوية. كلٌّ منها لسبب، ولا يُضاف غيرها بلا سبب:
 *   --no-sandbox / --disable-setuid-sandbox  الحاوية تعمل بمستخدم غير جذر
 *       بلا صلاحيات namespaces، فصندوق Chromium لا يُقلع أصلاً.
 *   --disable-dev-shm-usage  حجم /dev/shm في الحاويات 64MB، وChromium
 *       يملؤه فينهار بـ"Target closed" بعد دقائق.
 *   --disable-gpu / --disable-accelerated-2d-canvas  لا GPU في الحاوية.
 *   --no-first-run / --no-default-browser-check / --disable-extensions
 *       تقليل أول تشغيل وما يكتبه على القرص.
 *   --mute-audio  واتساب ويب يشغّل نغمة الإشعار؛ لا صوت في الحاوية.
 * وما لا يوضع هنا بحال: `--single-process` و`--no-zygote` — يُسقطان
 * whatsapp-web.js (يحتاج عمليات عرض مستقلة).
 */
export const CHROMIUM_ARGS = Object.freeze([
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-accelerated-2d-canvas',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--disable-crash-reporter',
  '--mute-audio',
  '--window-size=1280,900',
]);

export class WebAccountSession {
  /**
   * @param {{ name: string, msisdn: string, authDir: string, profileLocalDir: string,
   *           snapshotEverySec: number, batchWindowS: number, ignoreOlderH: number,
   *           resolveNames: boolean, hidePresence: boolean, printRawQr: boolean,
   *           sender: import('./post.mjs').Sender }} cfg
   */
  constructor(cfg) {
    this.name = cfg.name;
    this.msisdn = cfg.msisdn;
    this.dirs = resolveProfileDirs({
      persistDir: path.join(cfg.authDir, cfg.name),
      localDir: cfg.profileLocalDir ? path.join(cfg.profileLocalDir, cfg.name) : '',
    });
    this.snapshotEveryMs = Math.max(60, Number(cfg.snapshotEverySec) || 300) * 1000;
    this.batchWindowMs = Math.max(5, Number(cfg.batchWindowS) || 120) * 1000;
    this.ignoreOlderH = Number(cfg.ignoreOlderH) || 24;
    this.resolveNames = cfg.resolveNames !== false;
    this.hidePresence = cfg.hidePresence !== false;
    this.printRawQr = cfg.printRawQr !== false;
    this.sender = cfg.sender;
    this.log = logger(`wa:${cfg.name}`);
    this.snapshotter = new ProfileSnapshotter(this.dirs);

    this.client = null;
    this.stopped = false;
    this.loggedOut = false;
    this.attempt = 0;
    this.snapshotTimer = null;
    /** @type {Map<string, {name: string, messages: object[], timer: any}>} */
    this.batches = new Map();
    /** @type {Map<string, string>} */
    this.chatNames = new Map();
    /** @type {Map<string, string>} */
    this.contactNames = new Map();
    this.seen = new Set();
  }

  /** اسم المحادثة من الذاكرة المحليّة، أو الرقم إن لم يُعرف. */
  nameFor(jid) {
    const known = this.chatNames.get(jid);
    if (known) return known;
    const head = String(jid || '').split('@')[0];
    return head || jid;
  }

  rememberName(map, jid, name) {
    const clean = String(name || '').trim();
    if (!jid || !clean) return;
    if (map.size > 4000) map.clear();
    map.set(jid, clean);
  }

  async start() {
    await mkdir(this.dirs.persistDir, { recursive: true });
    const from = await restoreProfile(this.dirs);
    this.log.info('ملف التعريف جاهز', {
      mirrored: this.dirs.mirrored,
      data_path: this.dirs.dataPath,
      restored_from: from,
    });
    this.snapshotTimer = setInterval(() => {
      this.snapshotter.take('دوري');
    }, this.snapshotEveryMs);
    if (this.snapshotTimer && typeof this.snapshotTimer.unref === 'function') {
      this.snapshotTimer.unref();
    }
    await this.connect();
  }

  async connect() {
    if (this.stopped || this.loggedOut) return;

    const client = new Client({
      authStrategy: new LocalAuth({ dataPath: this.dirs.dataPath }),
      // مخبأ نسخة واتساب ويب يُكتب داخل مجلد العمل المحلي لا على /data:
      // ملف صغير يُنزَّل من واتساب، وكتابته على SMB كل إقلاع بلا داعٍ.
      webVersionCache: {
        type: 'local',
        path: path.join(this.dirs.dataPath, 'web-cache'),
      },
      qrMaxRetries: 0,
      // لا نسرق الجلسة من متصفح المالك إن فتح web.whatsapp.com بنفسه.
      takeoverOnConflict: false,
      puppeteer: {
        headless: true,
        args: Array.from(CHROMIUM_ARGS),
        // يُضبط في Dockerfile إلى Chromium المثبَّت في الصورة. وإن غاب،
        // استعمل Chromium المرفق مع puppeteer (الوضع المحلي على ماك المالك).
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      },
    });
    this.client = client;

    client.on('qr', (qr) => {
      this.log.warn(`امسح رمز QR من واتساب ← الأجهزة المرتبطة — الحساب ${this.name} (${this.msisdn})`);
      // الرمز يُطبع بشكلين لأن سجل Azure نصّي: الرسم النقطي قد يتشوّه
      // في `az containerapp logs show`، فيبقى النصّ الخام مخرجاً مضموناً
      // (يُلصق في أي مولِّد QR محلي). صالح نحو دقيقة ثم يتجدّد تلقائياً.
      qrcode.generate(qr, { small: true });
      if (this.printRawQr) {
        this.log.warn('نصّ الرمز الخام (صالح ~٦٠ ثانية — لا يُشارَك السجل)', { qr });
      }
    });

    client.on('loading_screen', (percent, message) => {
      this.log.info('تحميل واتساب ويب', { percent, message });
    });

    client.on('authenticated', () => {
      this.log.info('المصادقة نجحت — الجلسة تُحفظ في ملف التعريف');
      // أول لحظة يصبح فيها الاعتماد على القرص: ألقطه فوراً، فانهيارٌ بعدها
      // لا يُعيدنا إلى مسح رمز جديد.
      this.snapshotter.take('بعد المصادقة');
    });

    client.on('auth_failure', (msg) => {
      this.log.error('فشل المصادقة', { message: String(msg || '').slice(0, 300) });
    });

    client.on('ready', async () => {
      this.attempt = 0;
      const wid = (client.info && client.info.wid) || {};
      const linked = String(wid.user || '').replace(/\D/g, '');
      this.log.info('الجلسة مفتوحة', { linked_as: linked || 'unknown' });
      if (linked && this.msisdn && linked !== this.msisdn) {
        this.log.error(
          `الرقم المربوط (${linked}) لا يطابق المتوقّع (${this.msisdn}) — راجع WA_ACCOUNTS قبل أن تثق بالتصنيف`,
        );
      }
      if (this.hidePresence) {
        try {
          // الاستدعاء الوحيد الذي يمسّ الحضور، واتجاهه إخفاء: يُظهر
          // المالك «غير متصل» للطرف الآخر. لا يمسّ حالة القراءة بحال.
          await client.sendPresenceUnavailable();
          this.log.info('الحضور مُخفى — لا يظهر «متصل»');
        } catch (err) {
          this.log.warn('تعذّر إخفاء الحضور', { error: String((err && err.message) || err) });
        }
      }
      this.snapshotter.take('عند الجهوز');
      this.sender.drain();
    });

    client.on('change_state', (state) => {
      this.log.info('حالة الاتصال', { state: String(state || '') });
    });

    // كل الرسائل الجديدة — الواردة والصادرة من جوال المالك — بخلاف 'message'
    // الذي لا يُطلق إلا على الواردة. العقد يحمل `from_me`، فنحتاج الاثنين.
    client.on('message_create', (msg) => {
      this.onMessage(msg).catch((err) => {
        this.log.error('خطأ في معالجة رسالة', { error: String((err && err.message) || err) });
      });
    });

    client.on('disconnected', (reason) => {
      this.onDisconnected(String(reason || ''));
    });

    this.log.info('إقلاع Chromium', {
      exec: process.env.PUPPETEER_EXECUTABLE_PATH || 'puppeteer-bundled',
    });
    await client.initialize();
  }

  onDisconnected(reason) {
    this.log.warn('الاتصال انقطع', { reason });
    // ألقط قبل أي شيء: ربما كان الاعتماد قد تجدّد قبل القطع.
    this.snapshotter.take('عند القطع');

    const destroying = this.client;
    this.client = null;
    if (destroying) {
      // `destroy()` يُغلق Chromium. بلا إغلاقه تتراكم عمليات متصفّح حتى
      // تنفد ذاكرة الحاوية — وهذا أكثر ما يُسقط هذا النمط على المدى.
      Promise.resolve()
        .then(() => destroying.destroy())
        .catch(() => {});
    }

    if (reason === 'LOGOUT') {
      this.loggedOut = true;
      this.log.error(
        'الجلسة خرجت (LOGOUT). امسح لقطات هذا الحساب على القرص الدائم وأعد التشغيل لمسح رمز جديد.',
        { persistDir: this.dirs.persistDir },
      );
      return;
    }
    if (this.stopped) return;

    this.attempt += 1;
    const wait = Math.min(MAX_BACKOFF_MS, 2000 * Math.pow(2, Math.min(this.attempt - 1, 7)));
    this.log.warn('إعادة محاولة الاتصال', { attempt: this.attempt, in_ms: wait });
    const t = setTimeout(() => {
      this.connect().catch((err) => {
        this.log.error('فشل إعادة الاتصال', { error: String((err && err.message) || err) });
      });
    }, wait);
    if (t && typeof t.unref === 'function') t.unref();
  }

  /**
   * اسم المحادثة. استدعاء واحد إلى الصفحة لكل محادثة، ثم ذاكرة.
   * فحص المصدر أثبت أن `getChat()` لا يعلّم قراءة ولا يفتح محادثة في
   * الواجهة — إنما يقرأ النموذج من مخزن الصفحة.
   */
  async resolveChatName(msg, chatId) {
    if (this.chatNames.has(chatId)) return this.chatNames.get(chatId);
    const raw = (msg && (msg.rawData || msg._data)) || {};
    const pushed = !msg.fromMe && !isGroupJid(chatId) ? raw.notifyName : '';
    if (pushed) this.rememberName(this.chatNames, chatId, pushed);
    if (!this.resolveNames) return this.nameFor(chatId);
    try {
      const chat = await msg.getChat();
      const name = chat && (chat.name || (chat.formattedTitle));
      if (name) this.rememberName(this.chatNames, chatId, name);
    } catch (err) {
      this.log.debug('تعذّر حلّ اسم المحادثة', { error: String((err && err.message) || err) });
    }
    return this.nameFor(chatId);
  }

  /** اسم المرسِل داخل مجموعة — استدعاء واحد لكل جهة اتصال ثم ذاكرة. */
  async resolveSenderName(msg, senderJid) {
    const raw = (msg && (msg.rawData || msg._data)) || {};
    if (this.contactNames.has(senderJid)) return this.contactNames.get(senderJid);
    if (raw.notifyName) {
      this.rememberName(this.contactNames, senderJid, raw.notifyName);
      return this.contactNames.get(senderJid) || '';
    }
    if (!this.resolveNames) return '';
    try {
      const contact = await msg.getContact();
      const name = contact && (contact.pushname || contact.name || contact.verifiedName);
      if (name) this.rememberName(this.contactNames, senderJid, name);
    } catch (err) {
      this.log.debug('تعذّر حلّ اسم المرسِل', { error: String((err && err.message) || err) });
    }
    return this.contactNames.get(senderJid) || '';
  }

  async onMessage(msg) {
    const reason = shouldSkip(msg, { ignoreOlderH: this.ignoreOlderH });
    if (reason) {
      this.log.debug('رسالة مُهمَلة', { reason });
      return;
    }

    const chatId = chatIdOf(msg);
    const id = messageIdOf(msg);
    const dedupeKey = `${chatId}|${id}`;
    if (!id || this.seen.has(dedupeKey)) return;
    if (this.seen.size > 5000) this.seen.clear();
    this.seen.add(dedupeKey);

    const chatName = await this.resolveChatName(msg, chatId);
    const senderJid = senderJidOf(msg, this.msisdn);
    const senderName = msg.fromMe ? '' : await this.resolveSenderName(msg, canonicalJid(senderJid));

    const norm = normalizeMessage(msg, { accountMsisdn: this.msisdn, senderName });
    if (!norm.text && !norm.media_name && norm.kind === 'other') return;

    this.push(chatId, chatName, norm, tsOf(msg));
  }

  /** يضيف الرسالة إلى دفعة المحادثة ويفتح نافذة التجميع. */
  push(chatId, chatName, msg, _ts) {
    let batch = this.batches.get(chatId);
    if (!batch) {
      batch = { name: chatName || this.nameFor(chatId), messages: [], timer: null };
      this.batches.set(chatId, batch);
    }
    batch.name = chatName || this.nameFor(chatId);
    batch.messages.push(msg);

    if (batch.messages.length >= MAX_MESSAGES_PER_BATCH) {
      this.flush(chatId);
      return;
    }
    if (batch.timer) return;
    batch.timer = setTimeout(() => { this.flush(chatId); }, this.batchWindowMs);
    if (batch.timer && typeof batch.timer.unref === 'function') batch.timer.unref();
  }

  /** يرسل دفعة محادثة واحدة إلى n8n (لا إلى واتساب). */
  flush(chatId) {
    const batch = this.batches.get(chatId);
    if (!batch) return;
    if (batch.timer) clearTimeout(batch.timer);
    this.batches.delete(chatId);
    if (!batch.messages.length) return;

    batch.messages.sort(function (a, b) { return a.ts - b.ts; });
    const payload = buildPayload(this.name, this.msisdn, chatId, batch.name, batch.messages);
    this.sender.send(payload).catch((err) => {
      this.log.error('خطأ غير متوقّع أثناء الإرسال إلى n8n', {
        error: String((err && err.message) || err),
      });
    });
  }

  flushAll() {
    for (const chatId of Array.from(this.batches.keys())) this.flush(chatId);
  }

  async stop() {
    this.stopped = true;
    if (this.snapshotTimer) clearInterval(this.snapshotTimer);
    this.flushAll();
    const client = this.client;
    this.client = null;
    try {
      if (client) await client.destroy();
    } catch {
      // الإغلاق أثناء الإيقاف لا يستحق إسقاط العملية
    }
    // آخر لقطة بعد إغلاق Chromium: هنا وحدها تكون قواعد LevelDB مُغلقة
    // فعلاً، فهذه أسلم لقطة في عمر العملية.
    await this.snapshotter.take('عند الإيقاف');
  }
}
