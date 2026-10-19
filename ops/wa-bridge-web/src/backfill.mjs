// وضع الجرد الشامل — يقرأ كل المحادثات مرة واحدة ثم يتوقّف من نفسه.
//
// لماذا مسار منفصل ولا يُرفع `WA_IGNORE_OLDER_H`:
// حارس العمر (٢٤ ساعة افتراضاً) يحمي نوشن من الغرق بالتاريخ، وهو يعمل على
// **التدفّق الحيّ**. لو رُفع إلى ٢١٦٠ ساعة لصار كل شيء «جديداً»: تختلط
// دفعات الجرد بالرسائل الحيّة، فلا تعرف أيّها أرشيف وأيّها يستحق تنبيهاً،
// ولا تملك سقفاً ولا تباطؤاً ولا تقدّماً محفوظاً. فالجرد طريقٌ ثانٍ:
// يُطلب صراحةً، ويحمل `backfill: true`، ويُكتم في السير، ويسجّل تقدّمه.
//
// ⚠️ قارئ فقط كبقية الملف: لا إرسال ولا تعليم قراءة. والدالتان المستعملتان
// هنا فُحص مصدرهما في whatsapp-web.js 1.34.7:
//   • `Client.getChats()` → `window.WWebJS.getChats()` → قراءة نموذج
//     المحادثات من مخزن الصفحة. لا شيء غيرها.
//   • `Chat.fetchMessages({limit})` → `window.WWebJS.getChat(id,{getAsModel:false})`
//     ثم `chat.msgs.getModelsArray()`، وإن لم تكفِ فـ
//     `WAWebChatLoadMessages.loadEarlierMsgs({chat})` في حلقة حتى الحدّ.
//     **لا تستدعي أي شيء يعلّم قراءة**، وتُسقط `m.isNotification` بنفسها.
//   • `Chat.getLabels()` → `Client.getChatLabels(id)` → `chat.labels` مُعرّفةً
//     بأسمائها. لحسابات واتساب بزنس وحدها، وتعيد فارغاً لغيرها.

import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

/** الحدّ الذي يقسّم عليه الجرد دفعاته — نفس حدّ الدفعة الحيّة. */
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

/**
 * يقرأ إعداد الجرد ويتحقّق منه. يُنادى من `readConfig()` فيسقط الإقلاع قبل
 * Chromium إن كان الإعداد خاطئاً.
 */
export function readBackfillConfig() {
  const enabled = boolEnv('WA_BACKFILL', false);
  const force = boolEnv('WA_BACKFILL_FORCE', false);
  const maxChats = intEnv('WA_BACKFILL_MAX_CHATS', BACKFILL_DEFAULTS.maxChats, 1, 5000);
  const msgsPerChat = intEnv('WA_BACKFILL_MSGS_PER_CHAT', BACKFILL_DEFAULTS.msgsPerChat, 1, 500);
  const days = intEnv('WA_BACKFILL_DAYS', BACKFILL_DEFAULTS.days, 1, 3650);
  // التباطؤ مقصود: القراءة الجماعية السريعة أظهر ما يُشتمّ منه الآلي.
  const delayMs = intEnv('WA_BACKFILL_DELAY_MS', BACKFILL_DEFAULTS.delayMs, 0, 600000);
  const skipGroups = boolEnv('WA_BACKFILL_SKIP_GROUPS', BACKFILL_DEFAULTS.skipGroups);
  return { enabled, force, maxChats, msgsPerChat, days, delayMs, skipGroups };
}

/** تقدير مدّة الجرد بالدقائق — يُطبع في السجل قبل أن يبدأ. */
export function estimateMinutes(chats, delayMs) {
  // لكل محادثة: التباطؤ + نحو ثانيتين لجلب الرسائل والليبلات.
  // Math.max لأن `chats` قد يخرج سالباً إن خُفّض السقف بين تشغيلين.
  return Math.ceil((Math.max(0, chats) * (delayMs + 2000)) / 60000);
}

/**
 * تقدّم الجرد على القرص الدائم.
 *
 * ضروري لا كماليّ: الجرد قد يستغرق ساعة، وحاوية Container Apps تُعاد
 * تشغيلها بلا إذن. بلا هذا الملف يبدأ الجرد من الصفر عند كل سقوط فيُعيد
 * إرسال ما أُرسل.
 *
 * ويحمل كذلك **علامة الاكتمال** (`done_at`): وجودها يمنع إعادة الجرد عند
 * كل إقلاع. تُلغى بمسح الملف أو بـ`WA_BACKFILL_FORCE=1`.
 */
export class BackfillState {
  /** @param {string} stateDir @param {string} account */
  constructor(stateDir, account) {
    this.dir = stateDir;
    this.file = path.join(stateDir, `${String(account).replace(/[^a-zA-Z0-9_-]/g, '-')}.json`);
    this.data = { v: 1, account, started_at: '', done_at: '', sent: 0, skipped: 0, total: 0, chats: {} };
    this.dirty = false;
  }

  async load() {
    try {
      const raw = await readFile(this.file, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.v === 1) {
        this.data = Object.assign(this.data, parsed);
        if (!this.data.chats || typeof this.data.chats !== 'object') this.data.chats = {};
      }
    } catch {
      // لا ملف، أو ملف معطوب: نبدأ من جديد. لا يستحق إسقاط الإقلاع.
    }
    return this.data;
  }

  isDone() {
    return String(this.data.done_at || '') !== '';
  }

  doneChats() {
    return Object.keys(this.data.chats || {}).length;
  }

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

  /** @param {string} chatId @param {'sent'|string} status */
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

  /** كتابة ذرّية: ملف مؤقّت ثم إعادة تسمية — فلا يبقى ملف نصف مكتوب. */
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

/** معرّفات لا تُجرد أبداً — نفس فلاتر `normalize.mjs`، على مستوى المحادثة. */
function skipChatReason(chat, opts) {
  const id = (chat && chat.id && (chat.id._serialized || chat.id)) || '';
  const sid = String(id);
  if (!sid) return 'empty';
  if (sid === 'status@broadcast') return 'broadcast';
  if (sid.endsWith('@broadcast')) return 'broadcast';
  if (sid.endsWith('@newsletter')) return 'newsletter';
  if (chat && chat.isChannel === true) return 'newsletter';
  if (opts.skipGroups && (chat && chat.isGroup === true)) return 'groups';
  return null;
}

/**
 * يشغّل الجرد مرة واحدة. لا يرمي: كل عطل يُسجَّل والتقدّم يُحفظ.
 *
 * @param {object} args
 * @param {object} args.client عميل whatsapp-web.js بعد `ready`
 * @param {object} args.cfg إعداد الجرد من `readBackfillConfig()`
 * @param {BackfillState} args.state
 * @param {object} args.log
 * @param {() => boolean} args.stopped
 * @param {(chat: object) => Promise<string[]>} args.labelsFor ليبلات المالك
 * @param {(msgs: object[], chat: object, labels: string[]) => Promise<number>} args.emit
 *        يبني الحمولة ويرسلها؛ يعيد عدد الرسائل التي قُبلت
 */
export async function runBackfill(args) {
  const { client, cfg, state, log, stopped, labelsFor, emit } = args;

  log.info('الجرد الشامل يبدأ — مسار منفصل عن التدفّق الحيّ', {
    max_chats: cfg.maxChats,
    msgs_per_chat: cfg.msgsPerChat,
    days: cfg.days,
    delay_ms: cfg.delayMs,
    skip_groups: cfg.skipGroups,
    resumed_chats: state.doneChats(),
  });

  let all = [];
  try {
    all = (await client.getChats()) || [];
  } catch (err) {
    log.error('تعذّر قراءة قائمة المحادثات — الجرد لم يبدأ', {
      error: String((err && err.message) || err),
    });
    return false;
  }

  // الأحدث نشاطاً أولاً: إن قُطع الجرد فما وصل أهمّ ما كان.
  const ordered = all.slice().sort(function (a, b) {
    return (Number((b && b.timestamp) || 0) - Number((a && a.timestamp) || 0));
  });
  const picked = ordered.slice(0, cfg.maxChats);

  state.begin(picked.length);
  await state.save(true);

  log.info('قائمة المحادثات جاهزة', {
    total_on_account: all.length,
    will_scan: picked.length,
    est_minutes: estimateMinutes(picked.length - state.doneChats(), cfg.delayMs),
  });

  const cutoff = Math.floor(Date.now() / 1000) - cfg.days * 86400;
  let i = 0;
  let sent = 0;
  let skipped = 0;
  let aborted = false;

  for (const chat of picked) {
    i += 1;
    if (stopped()) {
      aborted = true;
      log.warn('الجرد توقّف بإشارة إيقاف — التقدّم محفوظ ويُستأنف', { at: i, of: picked.length });
      break;
    }

    const chatId = String((chat && chat.id && (chat.id._serialized || chat.id)) || '');
    const label = String((chat && chat.name) || chatId.split('@')[0] || '؟').slice(0, 60);

    if (state.has(chatId)) {
      log.debug('جرد: متخطّاة (أُنجزت سابقاً)', { n: i, chat: label });
      continue;
    }

    const reason = skipChatReason(chat, cfg);
    if (reason) {
      state.mark(chatId, `skipped:${reason}`);
      skipped += 1;
      log.info(`جرد ${i}/${picked.length}: تُخطّت — ${reason}`, { chat: label });
      await state.save();
      continue;
    }

    let msgs = [];
    try {
      msgs = (await chat.fetchMessages({ limit: cfg.msgsPerChat })) || [];
    } catch (err) {
      // لا تُعلّم محادثةً مُنجزة إن فشل جلبها: تُعاد في التشغيل التالي.
      skipped += 1;
      log.warn(`جرد ${i}/${picked.length}: تعذّر جلب الرسائل`, {
        chat: label,
        error: String((err && err.message) || err),
      });
      await sleep(cfg.delayMs);
      continue;
    }

    const fresh = [];
    for (const m of msgs) {
      const ts = Number((m && m.timestamp) || 0);
      if (ts > 0 && ts < cutoff) continue;
      fresh.push(m);
    }

    if (!fresh.length) {
      state.mark(chatId, 'skipped:empty');
      skipped += 1;
      log.info(`جرد ${i}/${picked.length}: لا رسائل في المدى`, {
        chat: label,
        fetched: msgs.length,
        days: cfg.days,
      });
      await state.save();
      await sleep(cfg.delayMs);
      continue;
    }

    let labels = [];
    try {
      labels = (await labelsFor(chat)) || [];
    } catch {
      labels = [];
    }

    let accepted = 0;
    try {
      accepted = await emit(fresh, chat, labels);
    } catch (err) {
      log.error(`جرد ${i}/${picked.length}: تعذّر بناء الدفعة`, {
        chat: label,
        error: String((err && err.message) || err),
      });
      await sleep(cfg.delayMs);
      continue;
    }

    if (accepted > 0) {
      state.mark(chatId, 'sent');
      sent += 1;
    } else {
      state.mark(chatId, 'skipped:filtered');
      skipped += 1;
    }
    log.info(`جرد ${i}/${picked.length}: ${accepted > 0 ? 'أُرسلت' : 'لا شيء مقبول'}`, {
      chat: label,
      messages: accepted,
      in_range: fresh.length,
      labels: labels.length,
    });
    await state.save();
    await sleep(cfg.delayMs);
  }

  if (!aborted) {
    state.finish();
    log.info('✓ الجرد الشامل اكتمل — لا يُعاد تلقائياً', {
      scanned: picked.length,
      chats_sent: sent,
      chats_skipped: skipped,
      marker: state.file,
      how_to_repeat: 'امسح ملف التقدّم أو اضبط WA_BACKFILL_FORCE=1',
    });
  }
  await state.save(true);
  return !aborted;
}
