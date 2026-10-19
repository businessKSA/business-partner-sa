// وضع الجرد الشامل — جسر Baileys (الرقم الشخصي).
//
// ⚠️⚠️ اقرأ هذا قبل أن تتوقّع من هذا الملف ما يفعله نظيره في جسر المتصفّح.
//
// **الجرد هنا ناقص بطبيعته، ولا حيلة في ذلك.** والسبب ليس إهمالاً:
//
//   • جسر المتصفّح يملك صفحة واتساب كاملة، فيستطيع `client.getChats()` ثم
//     `chat.fetchMessages({limit})` — أي **سؤال على الطلب** عن أي محادثة.
//   • Baileys بروتوكولٌ لا صفحة: **لا توجد فيه دالة «أعطني رسائل المحادثة
//     س»**. ولا يملك هذا الجسر مخزناً محلياً أصلاً — `makeInMemoryStore`
//     أُزيلت من Baileys 6.x، و`session.mjs` يستعمل الأحداث ولا يخزّن.
//
// فالمتاح فعلاً شيء واحد: حدث `messaging-history.set` الذي يدفعه واتساب
// نفسه عند الاتصال (مُتحقَّق من `lib/Types/Events.d.ts` في 6.7.9 —
// `{ chats, contacts, messages, isLatest, progress, syncType }`). وهذا:
//   ✓ يصل بلا أي طلب منّا، فلا يُشتمّ منه آلي.
//   ✗ **واتساب يقرّر ما فيه، لا نحن.** وبـ`syncFullHistory: false` هو
//     الرسائل الأخيرة لمحادثات قليلة؛ ولهذا يرفعه هذا الملف إلى `true`
//     حين يُطلب الجرد (وهذا هو الفرق العملي الوحيد الذي نملكه).
//   ✗ لا يضمن عدداً ولا مدى. محادثة لم يدفعها واتساب لا نراها، وليس في
//     يدنا ما يجبره.
//
// وهناك `sock.fetchMessageHistory(count, oldestMsgKey, oldestMsgTimestamp)`
// في 6.7.9 (مُتحقَّق من `lib/Socket/messages-recv.d.ts`): يطلب من الهاتف
// تاريخاً أعمق، ويعود الناتج في `messaging-history.set` أخرى.
// **لم يُستعمل هنا عن قصد**: طلبٌ صريح متكرّر على البروتوكول للرقم الشخصي
// بلا إمكان تجربته في هذه الجلسة مخاطرةٌ بجلسةٍ ربطها نجح مرة واحدة فقط
// في تاريخ المشروع كله (انظر `docs/wa-reader-handover.md`). هو الخطوة
// التالية إن أراد المالك جرداً أعمق للرقم الشخصي، وتُجرّب وحدها.
//
// وأمّا الليبلات: **ليست متاحة لهذا الرقم على الأرجح.** Baileys 6.7.9 يُطلق
// `labels.edit` و`labels.association` (مُتحقَّق من `Events.d.ts`)، لكنهما
// يصلان عبر مزامنة حالة التطبيق **لحسابات واتساب بزنس وحدها**. والرقم
// الشخصي `966503793356` ليس بزنس. فالمُجمِّع أدناه مكتوبٌ وجاهز، وإن لم
// يصل شيء بقيت `labels` فارغة ويُسجَّل سطرٌ واحد يقول ذلك صراحةً.

import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

export const BACKFILL_CHUNK = 40;

export const BACKFILL_DEFAULTS = Object.freeze({
  maxChats: 200,
  msgsPerChat: 30,
  days: 90,
  delayMs: 4000,
  skipGroups: false,
});

function intEnv(name, fallback, min, max) {
  const raw = process.env[name];
  if (raw == null || String(raw).trim() === '') return fallback;
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n)) throw new Error(`${name} رقم غير صالح`);
  const v = Math.floor(n);
  if (v < min || v > max) throw new Error(`${name} خارج المدى المسموح (${min}..${max})`);
  return v;
}

function boolEnv(name, fallback) {
  const raw = process.env[name];
  if (raw == null || String(raw).trim() === '') return fallback;
  const v = String(raw).trim().toLowerCase();
  return v === '1' || v === 'true';
}

export function readBackfillConfig() {
  const enabled = boolEnv('WA_BACKFILL', false);
  return {
    enabled,
    force: boolEnv('WA_BACKFILL_FORCE', false),
    maxChats: intEnv('WA_BACKFILL_MAX_CHATS', BACKFILL_DEFAULTS.maxChats, 1, 5000),
    msgsPerChat: intEnv('WA_BACKFILL_MSGS_PER_CHAT', BACKFILL_DEFAULTS.msgsPerChat, 1, 500),
    days: intEnv('WA_BACKFILL_DAYS', BACKFILL_DEFAULTS.days, 1, 3650),
    delayMs: intEnv('WA_BACKFILL_DELAY_MS', BACKFILL_DEFAULTS.delayMs, 0, 600000),
    skipGroups: boolEnv('WA_BACKFILL_SKIP_GROUPS', BACKFILL_DEFAULTS.skipGroups),
    // المزامنة الكاملة لا تُطلب إلا في الجرد: التدفّق الحيّ لا يحتاجها،
    // وتشغيلها دائماً يعني إغراق الجسر بالتاريخ عند كل إعادة اتصال.
    fullHistory: boolEnv('WA_BACKFILL_FULL_HISTORY', enabled),
    // مهلة انتظار ما يدفعه واتساب قبل أن نعتبر ما وصل هو كل ما سيصل.
    collectMs: intEnv('WA_BACKFILL_COLLECT_MS', 90000, 5000, 1800000),
  };
}

/** نفس حالة جسر المتصفّح حرفياً — ملف تقدّم وعلامة اكتمال على القرص الدائم. */
export class BackfillState {
  constructor(stateDir, account) {
    this.dir = stateDir;
    this.file = path.join(stateDir, `${String(account).replace(/[^a-zA-Z0-9_-]/g, '-')}.json`);
    this.data = {
      v: 1, account, started_at: '', done_at: '', sent: 0, skipped: 0, total: 0, chats: {},
    };
    this.dirty = false;
  }

  async load() {
    try {
      const parsed = JSON.parse(await readFile(this.file, 'utf8'));
      if (parsed && typeof parsed === 'object' && parsed.v === 1) {
        this.data = Object.assign(this.data, parsed);
        if (!this.data.chats || typeof this.data.chats !== 'object') this.data.chats = {};
      }
    } catch {
      // لا ملف أو ملف معطوب — نبدأ من جديد.
    }
    return this.data;
  }

  isDone() { return String(this.data.done_at || '') !== ''; }

  doneChats() { return Object.keys(this.data.chats || {}).length; }

  has(chatId) {
    return Object.prototype.hasOwnProperty.call(this.data.chats || {}, chatId);
  }

  reset() {
    this.data.chats = {};
    this.data.done_at = '';
    this.data.sent = 0;
    this.data.skipped = 0;
    this.data.total = 0;
    this.data.started_at = new Date().toISOString();
    this.dirty = true;
  }

  begin(total) {
    if (!this.data.started_at) this.data.started_at = new Date().toISOString();
    this.data.total = Number(total) || 0;
    this.dirty = true;
  }

  mark(chatId, status) {
    this.data.chats[chatId] = String(status);
    if (status === 'sent') this.data.sent += 1;
    else this.data.skipped += 1;
    this.dirty = true;
  }

  finish() {
    this.data.done_at = new Date().toISOString();
    this.dirty = true;
  }

  async save(force) {
    if (!this.dirty && !force) return false;
    await mkdir(this.dir, { recursive: true });
    const tmp = `${this.file}.tmp`;
    await writeFile(tmp, JSON.stringify(this.data), 'utf8');
    await rename(tmp, this.file);
    this.dirty = false;
    return true;
  }
}

function sleep(ms) {
  if (!(ms > 0)) return Promise.resolve();
  return new Promise(function (resolve) {
    const t = setTimeout(resolve, ms);
    if (t && typeof t.unref === 'function') t.unref();
  });
}

/**
 * يجمع ما يدفعه واتساب من `messaging-history.set`، ثم — بعد أن يهدأ الدفع —
 * يصرّفه محادثةً محادثةً بالتباطؤ نفسه.
 *
 * لماذا مُجمِّعٌ لا حلقةُ طلب: لأن المدخل حدثٌ يصل بإرادة واتساب، لا دالةٌ
 * تُنادى. فنُصغي، ونؤجّل التصريف حتى يسكن الدفع (`collectMs`)، ثم نرسل.
 */
export class HistoryCollector {
  /**
   * @param {object} args
   * @param {object} args.cfg
   * @param {BackfillState} args.state
   * @param {object} args.log
   * @param {() => boolean} args.stopped
   * @param {(chatId: string) => string} args.nameFor
   * @param {(chatId: string) => string[]} args.labelsFor
   * @param {(chatId: string, chatName: string, raws: object[], labels: string[]) => Promise<number>} args.emit
   */
  constructor(args) {
    this.cfg = args.cfg;
    this.state = args.state;
    this.log = args.log;
    this.stopped = args.stopped;
    this.nameFor = args.nameFor;
    this.labelsFor = args.labelsFor;
    this.emit = args.emit;
    /** @type {Map<string, object[]>} */
    this.byChat = new Map();
    this.sets = 0;
    this.seenIds = new Set();
    this.timer = null;
    this.flushing = false;
    this.finished = false;
  }

  /** @param {{messages?: object[], chats?: object[], isLatest?: boolean, progress?: number}} ev */
  absorb(ev) {
    if (this.finished || this.stopped()) return;
    const msgs = (ev && ev.messages) || [];
    const cutoff = Math.floor(Date.now() / 1000) - this.cfg.days * 86400;
    let added = 0;
    for (const raw of msgs) {
      const key = (raw && raw.key) || {};
      const chatId = String(key.remoteJid || '');
      const id = String(key.id || '');
      if (!chatId || !id) continue;
      if (this.seenIds.has(`${chatId}|${id}`)) continue;
      const ts = Number(
        (raw && raw.messageTimestamp && (raw.messageTimestamp.low || raw.messageTimestamp)) || 0,
      );
      if (ts > 0 && ts < cutoff) continue;
      this.seenIds.add(`${chatId}|${id}`);
      let bucket = this.byChat.get(chatId);
      if (!bucket) {
        if (this.byChat.size >= this.cfg.maxChats) continue;
        bucket = [];
        this.byChat.set(chatId, bucket);
      }
      if (bucket.length >= this.cfg.msgsPerChat) continue;
      bucket.push(raw);
      added += 1;
    }
    this.sets += 1;
    this.log.info('جرد: وصلت دفعة تاريخ من واتساب', {
      set: this.sets,
      messages_in_set: msgs.length,
      kept: added,
      chats_so_far: this.byChat.size,
      is_latest: (ev && ev.isLatest) === true,
      progress: (ev && ev.progress) != null ? ev.progress : undefined,
    });
    this.arm();
  }

  /** يؤجّل التصريف حتى يسكن الدفع — كل دفعة جديدة تُعيد ضبط المؤقّت. */
  arm() {
    if (this.finished) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.flush().catch((err) => {
        this.log.error('جرد: تعذّر تصريف التاريخ', {
          error: String((err && err.message) || err),
        });
      });
    }, this.cfg.collectMs);
    if (this.timer && typeof this.timer.unref === 'function') this.timer.unref();
  }

  async flush() {
    if (this.flushing || this.finished) return;
    this.flushing = true;
    try {
      const ids = Array.from(this.byChat.keys());
      if (!ids.length) {
        this.log.warn(
          '⚠️ الجرد انتهى بلا شيء: واتساب لم يدفع أي تاريخ لهذا الرقم. '
          + 'هذا حدٌّ في Baileys لا عطلٌ فينا — انظر رأس src/backfill.mjs.',
        );
        this.finished = true;
        this.state.finish();
        await this.state.save(true);
        return;
      }

      this.state.begin(ids.length);
      await this.state.save(true);
      this.log.info('جرد: الدفع هدأ — يبدأ التصريف', {
        chats: ids.length,
        est_minutes: Math.ceil((ids.length * (this.cfg.delayMs + 500)) / 60000),
      });

      let i = 0;
      let aborted = false;
      for (const chatId of ids) {
        i += 1;
        if (this.stopped()) {
          aborted = true;
          this.log.warn('جرد: توقّف بإشارة إيقاف — التقدّم محفوظ', { at: i, of: ids.length });
          break;
        }
        const label = String(this.nameFor(chatId) || chatId.split('@')[0] || '؟').slice(0, 60);
        if (this.state.has(chatId)) {
          this.log.debug('جرد: متخطّاة (أُنجزت سابقاً)', { n: i, chat: label });
          continue;
        }
        if (chatId === 'status@broadcast' || chatId.endsWith('@broadcast')) {
          this.state.mark(chatId, 'skipped:broadcast');
          await this.state.save();
          continue;
        }
        if (chatId.endsWith('@newsletter')) {
          this.state.mark(chatId, 'skipped:newsletter');
          await this.state.save();
          continue;
        }
        if (this.cfg.skipGroups && chatId.endsWith('@g.us')) {
          this.state.mark(chatId, 'skipped:groups');
          this.log.info(`جرد ${i}/${ids.length}: تُخطّت — groups`, { chat: label });
          await this.state.save();
          continue;
        }

        const raws = this.byChat.get(chatId) || [];
        const labels = this.labelsFor(chatId);
        let accepted = 0;
        try {
          accepted = await this.emit(chatId, label, raws, labels);
        } catch (err) {
          this.log.error(`جرد ${i}/${ids.length}: تعذّر بناء الدفعة`, {
            chat: label,
            error: String((err && err.message) || err),
          });
          await sleep(this.cfg.delayMs);
          continue;
        }
        this.state.mark(chatId, accepted > 0 ? 'sent' : 'skipped:filtered');
        this.log.info(`جرد ${i}/${ids.length}: ${accepted > 0 ? 'أُرسلت' : 'لا شيء مقبول'}`, {
          chat: label,
          messages: accepted,
          available: raws.length,
          labels: labels.length,
        });
        await this.state.save();
        await sleep(this.cfg.delayMs);
      }

      if (!aborted) {
        this.finished = true;
        this.state.finish();
        this.log.info('✓ الجرد اكتمل (بحدود ما دفعه واتساب) — لا يُعاد تلقائياً', {
          chats: ids.length,
          sent: this.state.data.sent,
          skipped: this.state.data.skipped,
          marker: this.state.file,
          how_to_repeat: 'امسح ملف التقدّم أو اضبط WA_BACKFILL_FORCE=1',
        });
      }
      await this.state.save(true);
    } finally {
      this.flushing = false;
    }
  }
}
