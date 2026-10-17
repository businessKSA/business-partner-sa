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
import { BACKFILL_CHUNK, BackfillState, HistoryCollector } from './backfill.mjs';

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
    this.backfillCfg = cfg.backfill || { enabled: false };
    this.backfillStateDir = path.join(cfg.authDir, '.backfill');
    this.backfillStarted = false;
    /** @type {HistoryCollector|null} */
    this.collector = null;
    /**
     * ليبلات المالك — تصل من `labels.edit` و`labels.association` إن كان
     * الحساب بزنس. انظر رأس `backfill.mjs`: الرقم الشخصي ليس بزنس على
     * الأرجح، فتبقى هذه فارغة ويُسجَّل سطر واحد يقول ذلك.
     * @type {Map<string, string>} معرّف الليبل → اسمه
     */
    this.labelNames = new Map();
    /** @type {Map<string, Set<string>>} معرّف المحادثة → معرّفات ليبلاتها */
    this.chatLabelIds = new Map();
    this.labelsSeen = false;

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

  /** ليبلات المحادثة بأسمائها — فارغة إن لم يصل شيء من واتساب. */
  labelsFor(jid) {
    const ids = this.chatLabelIds.get(jid);
    if (!ids || !ids.size) return [];
    const out = [];
    for (const id of ids) {
      const name = this.labelNames.get(String(id));
      if (name) out.push(name);
    }
    return out;
  }

  noteLabelsArrived(what) {
    if (this.labelsSeen) return;
    this.labelsSeen = true;
    this.log.info('ليبلات المالك وصلت من واتساب — تُقرأ كسياق للتصنيف', { via: what });
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
      // `true` في الجرد وحده: بـ`false` لا يدفع واتساب إلا رسائل قليلة
      // جداً، فيخرج الجرد شبه فارغ. انظر رأس `backfill.mjs`.
      syncFullHistory: this.backfillCfg.enabled === true && this.backfillCfg.fullHistory !== false,
      markOnlineOnConnect: false, // لا نُظهر المالك «متصل»، ولا نسرق الإشعارات من هاتفه
      // توقيع المتصفح: واتساب يرفض الربط لبعض الحسابات حين يكون التوقيع
      // غير مألوف. `web.whatsapp.com` يربط لأنه يرسل توقيعاً قياسياً،
      // فنرسل مثله. يُضبط بـWA_BROWSER (مثال: "Mac OS,Safari,16.5").
      browser: (process.env.WA_BROWSER || 'Mac OS,Desktop,10.15.7')
        .split(',').map((x) => x.trim()).slice(0, 3),
      getMessage: async function () { return undefined; },
    });
    this.sock = sock;

    // الربط بكود رقمي بدل QR. ضروري على Azure: السجل نصّي ولا شاشة فيه
    // لمسح رمز. الكود يُطلب مرة واحدة فقط حين لا توجد جلسة محفوظة بعد.
    if (process.env.WA_PAIRING_CODE === '1' && !auth.state.creds.registered) {
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(this.msisdn);
          const pretty = String(code || '').match(/.{1,4}/g);
          this.log.warn(
            `كود ربط الحساب ${this.name} (${this.msisdn}): ${pretty ? pretty.join('-') : code}`
          );
          this.log.warn(
            'أدخله من: واتساب ← الأجهزة المرتبطة ← ربط جهاز ← «الربط برقم الهاتف بدلاً من ذلك». صالح دقائق معدودة.'
          );
        } catch (err) {
          this.log.error('تعذّر طلب كود الربط', { error: String((err && err.message) || err) });
        }
      }, 3000);
    }

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

    // ليبلات واتساب بزنس. مُتحقَّق من BaileysEventMap في 6.7.9:
    //   'labels.edit' → Label { id, name, color, deleted }
    //   'labels.association' → { association: { type, chatId, labelId }, type: 'add'|'remove' }
    // لا تصل لحساب غير بزنس بحال، فغيابها ليس عطلاً.
    sock.ev.on('labels.edit', (label) => {
      const id = String((label && label.id) || '');
      if (!id) return;
      if (label && label.deleted === true) {
        this.labelNames.delete(id);
        return;
      }
      const name = String((label && label.name) || '').trim();
      if (!name) return;
      if (this.labelNames.size > 500) this.labelNames.clear();
      this.labelNames.set(id, name.slice(0, 60));
      this.noteLabelsArrived('labels.edit');
    });
    sock.ev.on('labels.association', (ev) => {
      const a = (ev && ev.association) || {};
      // 'label_jid' = ليبل على محادثة. 'label_message' يوسم رسالةً بعينها
      // ولا يعنينا: تصنيف المالك الذي نريده هو تصنيفه للجهة.
      if (String(a.type || '') !== 'label_jid') return;
      const chatId = String(a.chatId || '');
      const labelId = String(a.labelId || '');
      if (!chatId || !labelId) return;
      let set = this.chatLabelIds.get(chatId);
      if (!set) {
        if (this.chatLabelIds.size > 4000) this.chatLabelIds.clear();
        set = new Set();
        this.chatLabelIds.set(chatId, set);
      }
      if (String((ev && ev.type) || 'add') === 'remove') set.delete(labelId);
      else set.add(labelId);
      this.noteLabelsArrived('labels.association');
    });

    // تاريخ المحادثات الذي يدفعه واتساب. يُستهلك في الجرد وحده؛ وبلا
    // `WA_BACKFILL=1` لا مُجمِّع فلا شيء يُقرأ منه (والتدفّق الحيّ يمرّ
    // بـ'messages.upsert' لا بهذا الحدث).
    sock.ev.on('messaging-history.set', (ev) => {
      if (!this.collector) return;
      try {
        this.collector.absorb(ev);
      } catch (err) {
        this.log.error('جرد: تعذّر استيعاب دفعة التاريخ', {
          error: String((err && err.message) || err),
        });
      }
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
      if (process.env.WA_PAIRING_CODE === '1') {
        // الكود الرقمي يُطلب أعلاه؛ رسم QR في سجل Azure بلا فائدة ويملؤه ضجيجاً.
        this.log.info(`بانتظار إدخال كود الربط — الحساب ${this.name}`);
      } else {
        this.log.warn(`امسح رمز QR من واتساب → الأجهزة المرتبطة — الحساب ${this.name} (${this.msisdn})`);
        qrcode.generate(update.qr, { small: true });
      }
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
      if (!this.labelsSeen) {
        this.log.info(
          'لا ليبلات وصلت لهذا الرقم — الحساب ليس واتساب بزنس على الأرجح، '
          + 'فتُرسل labels فارغة. هذا حدٌّ في الحساب لا عطل.',
        );
      }
      // بعد «الجلسة مفتوحة» لا قبلها.
      this.maybeBackfill().catch((err) => {
        this.log.error('الجرد سقط', { error: String((err && err.message) || err) });
      });
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
    const payload = buildPayload(this.name, this.msisdn, chatId, batch.name, batch.messages, {
      labels: this.labelsFor(chatId),
    });
    this.sender.send(payload).catch((err) => {
      this.log.error('خطأ غير متوقّع أثناء الإرسال', { error: String((err && err.message) || err) });
    });
  }

  flushAll() {
    for (const chatId of Array.from(this.batches.keys())) this.flush(chatId);
  }

  /** يبني دفعات الجرد لمحادثة واحدة ويرسلها. يعيد عدد الرسائل المقبولة. */
  async emitBackfillBatch(chatId, chatName, raws, labels) {
    const norm = [];
    for (const raw of raws) {
      // `ignoreOlderH: 0` يُلغي حارس العمر وحده ويُبقي بقية الفلاتر
      // (بثّ · قنوات · رسائل نظام · بلا متن). المدى يحكمه WA_BACKFILL_DAYS.
      if (shouldSkip(raw, { ignoreOlderH: 0 })) continue;
      const id = String(((raw && raw.key) || {}).id || '');
      if (!id) continue;
      const key = `${chatId}|${id}`;
      if (this.seen.has(key)) continue;
      if (this.seen.size > 5000) this.seen.clear();
      this.seen.add(key);
      if (raw.pushName && !((raw.key || {}).fromMe) && !String(chatId).endsWith('@g.us')) {
        this.rememberName(chatId, raw.pushName);
      }
      const one = normalizeMessage(raw, {
        accountMsisdn: this.msisdn,
        pushNameFor: (jid) => this.chatNames.get(jid) || '',
      });
      if (!one.text && !one.media_name && one.kind === 'other') continue;
      norm.push(one);
    }
    if (!norm.length) return 0;

    norm.sort(function (a, b) { return a.ts - b.ts; });
    let accepted = 0;
    for (let i = 0; i < norm.length; i += BACKFILL_CHUNK) {
      const slice = norm.slice(i, i + BACKFILL_CHUNK);
      const payload = buildPayload(this.name, this.msisdn, chatId, chatName, slice, {
        labels,
        backfill: true,
      });
      await this.sender.send(payload);
      accepted += slice.length;
    }
    return accepted;
  }

  /**
   * يجهّز مُجمِّع التاريخ مرة واحدة إن طُلب الجرد ولم يكن منجَزاً.
   * لا يطلب شيئاً من واتساب: يُصغي لما يدفعه هو (انظر `backfill.mjs`).
   */
  async maybeBackfill() {
    const cfg = this.backfillCfg || {};
    if (!cfg.enabled) return;
    if (this.backfillStarted) return;
    this.backfillStarted = true;

    const state = new BackfillState(this.backfillStateDir, this.name);
    await state.load();
    if (state.isDone()) {
      if (!cfg.force) {
        this.log.info('الجرد منجَز سابقاً — لا يُعاد تلقائياً', {
          done_at: state.data.done_at,
          chats: state.doneChats(),
          marker: state.file,
          to_repeat: 'امسح ملف التقدّم أو اضبط WA_BACKFILL_FORCE=1',
        });
        return;
      }
      this.log.warn('WA_BACKFILL_FORCE=1 — علامة الاكتمال تُلغى والجرد يُعاد');
      state.reset();
    }

    this.collector = new HistoryCollector({
      cfg,
      state,
      log: this.log,
      stopped: () => this.stopped || this.loggedOut,
      nameFor: (jid) => this.nameFor(jid),
      labelsFor: (jid) => this.labelsFor(jid),
      emit: (chatId, chatName, raws, labels) =>
        this.emitBackfillBatch(chatId, chatName, raws, labels),
    });
    this.log.info('جرد Baileys جاهز — يُصغي لما يدفعه واتساب', {
      collect_ms: cfg.collectMs,
      full_history: cfg.fullHistory !== false,
      note: 'ناقصٌ بطبيعته: واتساب يقرّر ما يدفع — انظر رأس src/backfill.mjs',
    });
    // إن لم يدفع واتساب شيئاً أصلاً فلا حدث يُسلّح المؤقّت: سلّحه هنا
    // ليُقفل الجرد بعد المهلة ويسجّل أنه خرج فارغاً، بدل أن يبقى معلّقاً.
    this.collector.arm();
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
