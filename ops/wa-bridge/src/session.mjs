// جلسة واتساب ويب واحدة لرقم واحد.
// معزولة تماماً: مجلد مصادقة خاص، مقبس خاص، وتراجع إعادة اتصال خاص.
// فحظر رقم أو خروجه لا يُسقط الرقم الآخر.
//
// ⚠️ قراءة فقط. لا توجد في هذا الملف أي دالة إرسال إلى واتساب، ولا تُضاف
// للرقم الشخصي بحال (قاعدة المالك: «لا تستخدم ابدا 0503793356»).

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import qrcode from 'qrcode-terminal';
import baileys from '@whiskeysockets/baileys';
import { logger } from './log.mjs';
import {
  buildPayload,
  chatIdOf,
  normalizeMessage,
  shouldSkip,
  tsOf,
} from './normalize.mjs';

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} = baileys;

const MAX_BACKOFF_MS = 5 * 60 * 1000;
const MAX_MESSAGES_PER_BATCH = 40;

export class AccountSession {
  /**
   * @param {{ name: string, msisdn: string, authDir: string, batchWindowS: number,
   *           ignoreOlderH: number, sender: import('./post.mjs').Sender }} cfg
   */
  constructor(cfg) {
    this.name = cfg.name;
    this.msisdn = cfg.msisdn;
    this.authDir = path.join(cfg.authDir, cfg.name);
    this.batchWindowMs = Math.max(5, Number(cfg.batchWindowS) || 120) * 1000;
    this.ignoreOlderH = Number(cfg.ignoreOlderH) || 24;
    this.sender = cfg.sender;
    this.log = logger(`wa:${cfg.name}`);

    this.sock = null;
    this.stopped = false;
    this.loggedOut = false;
    this.attempt = 0;
    /** @type {Map<string, {name: string, messages: object[], timer: any}>} */
    this.batches = new Map();
    /** @type {Map<string, string>} */
    this.chatNames = new Map();
    this.seen = new Set();
  }

  /** اسم المحادثة من الذاكرة المحليّة، أو الرقم إن لم يُعرف. */
  nameFor(jid) {
    const known = this.chatNames.get(jid);
    if (known) return known;
    const head = String(jid || '').split('@')[0];
    return head || jid;
  }

  rememberName(jid, name) {
    const clean = String(name || '').trim();
    if (!jid || !clean) return;
    if (this.chatNames.size > 4000) this.chatNames.clear();
    this.chatNames.set(jid, clean);
  }

  async start() {
    await mkdir(this.authDir, { recursive: true });
    await this.connect();
  }

  async connect() {
    if (this.stopped || this.loggedOut) return;

    const auth = await useMultiFileAuthState(this.authDir);
    const version = await fetchLatestBaileysVersion()
      .then(function (v) { return v.version; })
      .catch(function () { return undefined; });

    const sock = makeWASocket({
      version,
      auth: {
        creds: auth.state.creds,
        keys: makeCacheableSignalKeyStore(auth.state.keys, {
          level: 'silent',
          child() { return this; },
          trace() {}, debug() {}, info() {}, warn() {}, error() {}, fatal() {},
        }),
      },
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false, // لا نُظهر المالك «متصل»، ولا نسرق الإشعارات من هاتفه
      browser: ['BP Reader', 'Chrome', '1.0.0'],
      getMessage: async function () { return undefined; },
    });
    this.sock = sock;

    sock.ev.on('creds.update', auth.saveCreds);

    sock.ev.on('connection.update', (u) => { this.onConnection(u); });

    sock.ev.on('contacts.upsert', (list) => {
      for (const c of list || []) this.rememberName(c.id, c.name || c.notify || c.verifiedName);
    });
    sock.ev.on('contacts.update', (list) => {
      for (const c of list || []) this.rememberName(c.id, c.name || c.notify || c.verifiedName);
    });
    sock.ev.on('chats.upsert', (list) => {
      for (const c of list || []) this.rememberName(c.id, c.name);
    });
    sock.ev.on('groups.upsert', (list) => {
      for (const g of list || []) this.rememberName(g.id, g.subject);
    });
    sock.ev.on('groups.update', (list) => {
      for (const g of list || []) this.rememberName(g.id, g.subject);
    });

    sock.ev.on('messages.upsert', (ev) => {
      // 'append' يصل عند مزامنة التاريخ؛ الفلتر الزمني يتولّى القديم منه.
      if (!ev || !ev.messages) return;
      for (const raw of ev.messages) this.onMessage(raw);
    });
  }

  onConnection(update) {
    const connection = update.connection;
    const lastDisconnect = update.lastDisconnect;

    if (update.qr) {
      this.log.warn(`امسح رمز QR من واتساب → الأجهزة المرتبطة — الحساب ${this.name} (${this.msisdn})`);
      qrcode.generate(update.qr, { small: true });
    }

    if (connection === 'open') {
      this.attempt = 0;
      const me = (this.sock && this.sock.user && this.sock.user.id) || '';
      const meDigits = String(me).split(':')[0].replace(/\D/g, '');
      this.log.info('الجلسة مفتوحة', { linked_as: meDigits || 'unknown' });
      if (meDigits && this.msisdn && meDigits !== this.msisdn) {
        this.log.error(
          `الرقم المربوط (${meDigits}) لا يطابق المتوقّع (${this.msisdn}) — راجع WA_ACCOUNTS قبل أن تثق بالتصنيف`,
        );
      }
      this.sender.drain();
      return;
    }

    if (connection !== 'close') return;

    const code =
      (lastDisconnect && lastDisconnect.error && lastDisconnect.error.output &&
        lastDisconnect.error.output.statusCode) || 0;

    if (code === DisconnectReason.loggedOut) {
      // خرج من الأجهزة المرتبطة أو حُظر: لا تدور بلا نهاية.
      this.loggedOut = true;
      this.log.error(
        'الجلسة خرجت (loggedOut). امسح مجلد المصادقة لهذا الحساب وأعد التشغيل لمسح QR جديد.',
        { authDir: this.authDir },
      );
      return;
    }

    if (this.stopped) return;

    this.attempt += 1;
    const wait = Math.min(MAX_BACKOFF_MS, 2000 * Math.pow(2, Math.min(this.attempt - 1, 7)));
    this.log.warn('الاتصال أُغلق — إعادة محاولة', { code, attempt: this.attempt, in_ms: wait });
    setTimeout(() => {
      this.connect().catch((err) => {
        this.log.error('فشل إعادة الاتصال', { error: String((err && err.message) || err) });
      });
    }, wait);
  }

  onMessage(raw) {
    const reason = shouldSkip(raw, { ignoreOlderH: this.ignoreOlderH });
    if (reason) {
      this.log.debug('رسالة مُهمَلة', { reason });
      return;
    }

    const chatId = chatIdOf(raw);
    const id = String(((raw && raw.key) || {}).id || '');
    const dedupeKey = `${chatId}|${id}`;
    if (!id || this.seen.has(dedupeKey)) return;
    if (this.seen.size > 5000) this.seen.clear();
    this.seen.add(dedupeKey);

    if (raw.pushName && !((raw.key || {}).fromMe) && !String(chatId).endsWith('@g.us')) {
      this.rememberName(chatId, raw.pushName);
    }

    const msg = normalizeMessage(raw, {
      accountMsisdn: this.msisdn,
      pushNameFor: (jid) => this.chatNames.get(jid) || '',
    });
    if (!msg.text && !msg.media_name && msg.kind === 'other') return;

    this.push(chatId, msg, tsOf(raw));
  }

  /** يضيف الرسالة إلى دفعة المحادثة ويفتح نافذة التجميع. */
  push(chatId, msg, _ts) {
    let batch = this.batches.get(chatId);
    if (!batch) {
      batch = { name: this.nameFor(chatId), messages: [], timer: null };
      this.batches.set(chatId, batch);
    }
    batch.name = this.nameFor(chatId);
    batch.messages.push(msg);

    if (batch.messages.length >= MAX_MESSAGES_PER_BATCH) {
      this.flush(chatId);
      return;
    }
    if (batch.timer) return;
    batch.timer = setTimeout(() => { this.flush(chatId); }, this.batchWindowMs);
    if (batch.timer && typeof batch.timer.unref === 'function') batch.timer.unref();
  }

  /** يرسل دفعة محادثة واحدة. */
  flush(chatId) {
    const batch = this.batches.get(chatId);
    if (!batch) return;
    if (batch.timer) clearTimeout(batch.timer);
    this.batches.delete(chatId);
    if (!batch.messages.length) return;

    batch.messages.sort(function (a, b) { return a.ts - b.ts; });
    const payload = buildPayload(this.name, this.msisdn, chatId, batch.name, batch.messages);
    this.sender.send(payload).catch((err) => {
      this.log.error('خطأ غير متوقّع أثناء الإرسال', { error: String((err && err.message) || err) });
    });
  }

  flushAll() {
    for (const chatId of Array.from(this.batches.keys())) this.flush(chatId);
  }

  async stop() {
    this.stopped = true;
    this.flushAll();
    try {
      if (this.sock) this.sock.end(undefined);
    } catch {
      // الإغلاق أثناء الإيقاف لا يستحق إسقاط العملية
    }
  }
}
