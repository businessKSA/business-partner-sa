// الصادر: الجسر يسحب أوامر الإرسال من n8n (فرح) ويُرسلها واحدةً واحدة بهدوء.
//
// هذا الملف **الوحيد** المسموح له بالإرسال في الجسر (الحارس `scripts/guard.mjs`
// يفحص ذلك). والمبدأ: الجسر لا يقرّر شيئاً — ينفّذ أمراً كتبه المالك لفرح،
// ويرفض ما يخالف الحدود الصلبة أدناه مهما قال الطابور.
//
// الحدود الصلبة (في الكود لا في البرومبت):
//   1) مغلق افتراضياً: `WA_OUTBOX=1` و`WA_OUTBOX_ACCOUNTS` يسمّي الحساب صراحةً.
//   2) مجموعات وقنوات وبثّ وحالات: مرفوضة دائماً. أفراد فقط.
//   3) أرقام المالك وخطّ فرح: مرفوضة (تمنع الحلقات).
//   4) فاصل ٨–١٥ ثانية عشوائي بين رسالتين، وسقف ٦٠ في الساعة و٢٠٠ في اليوم
//      (والسقف الأعلى الممكن بالإعداد ١٢٠ و٥٠٠) يُحفظان على القرص فلا
//      يصفّرهما إعادة تشغيل.
//   5) لا إعادة محاولة تلقائية أبداً: رسالة فشلت تُبلَّغ فشلاً ولا تُرسل
//      مرة ثانية (إعادة الإرسال قد تُرسل مرتين لشخص حقيقي).
//   6) لا تعليم قراءة: `sendSeen:false`، فتبقى محادثات المالك غير مقروءة.
//
// النقل (n8n): نسحب نحن، لا ينفذ إلينا أحد — الجسر بلا منفذ مفتوح.
//   POST {action:'pull', account, limit}  → {ok, items:[{id,to,text,label}]}
//   POST {action:'ack',  account, id, status:'sent'|'failed'|'blocked'|'released', ...}
// موقّعان بـHMAC كبقية الحمولات.

import { createHmac, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { logger } from './log.mjs';

export function sign(rawBody, secret) {
  return 'sha256=' + createHmac('sha256', String(secret)).update(rawBody, 'utf8').digest('hex');
}

/** سقوف لا يتجاوزها الإعداد مهما كُتب. */
export const HARD_HOURLY_MAX = 120;
export const HARD_DAILY_MAX = 500;
export const MAX_TEXT_CHARS = 4000;

/** أرقام لا يُرسَل إليها أبداً: المالك وخطّ فرح. تُوسَّع بـ`WA_OUTBOX_BLOCK`. */
export const DEFAULT_BLOCK = Object.freeze(['966530540231', '966503793356', '183413122289688']);

function envStr(name, fallback) {
  const v = process.env[name];
  if (v == null || String(v).trim() === '') return fallback;
  return String(v).trim();
}

function clampInt(v, lo, hi, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

/**
 * يقرأ إعداد الصادر لحساب واحد. يعيد null إن كان مغلقاً لهذا الحساب،
 * ويرمي إن كان مفتوحاً بإعداد ناقص — فيسقط الإقلاع لا الإرسال.
 */
export function readOutboxConfig(accountName, authDir) {
  if (envStr('WA_OUTBOX', '0') !== '1') return null;
  const names = envStr('WA_OUTBOX_ACCOUNTS', '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (names.indexOf(String(accountName).toLowerCase()) < 0) return null;
  const url = envStr('WA_OUTBOX_URL', '');
  const secret = envStr('WA_BRIDGE_SECRET', '');
  if (!url) throw new Error('WA_OUTBOX=1 لكن WA_OUTBOX_URL غير مضبوط');
  if (secret.length < 24) throw new Error('WA_OUTBOX=1 يحتاج WA_BRIDGE_SECRET (24 محرفاً على الأقل)');
  const gapMin = clampInt(envStr('WA_OUTBOX_GAP_MIN_S', '8'), 5, 120, 8);
  const gapMax = clampInt(envStr('WA_OUTBOX_GAP_MAX_S', '15'), gapMin, 300, Math.max(gapMin, 15));
  const extraBlock = envStr('WA_OUTBOX_BLOCK', '').split(',').map((s) => s.replace(/\D/g, '')).filter(Boolean);
  return {
    url,
    secret,
    stateDir: path.join(authDir, '.outbox'),
    pollS: clampInt(envStr('WA_OUTBOX_POLL_S', '60'), 10, 600, 60),
    batch: clampInt(envStr('WA_OUTBOX_BATCH', '5'), 1, 10, 5),
    gapMinMs: gapMin * 1000,
    gapMaxMs: gapMax * 1000,
    hourlyMax: clampInt(envStr('WA_OUTBOX_HOURLY', '60'), 1, HARD_HOURLY_MAX, 60),
    dailyMax: clampInt(envStr('WA_OUTBOX_DAILY', '200'), 1, HARD_DAILY_MAX, 200),
    block: DEFAULT_BLOCK.concat(extraBlock),
  };
}

/**
 * يحوّل الوجهة إلى معرّف إرسال، أو يرفضها بسبب.
 * يقبل: رقماً (٠٥… / ٥… / ٩٦٦… / +٩٦٦…) أو معرّف محادثة فردية
 * (`…@c.us` · `…@s.whatsapp.net` · `…@lid`). لا يقبل مجموعة ولا قناة ولا بثاً.
 * @param {string} raw
 * @param {{ userSuffix: string, block: string[] }} opts  userSuffix: 'c.us' | 's.whatsapp.net'
 * @returns {{ ok: true, jid: string, key: string } | { ok: false, reason: string }}
 */
export function resolveDestination(raw, opts) {
  const s = String(raw == null ? '' : raw).trim().toLowerCase();
  if (!s) return { ok: false, reason: 'وجهة فارغة' };
  let user = '';
  let domain = '';
  const at = s.indexOf('@');
  if (at >= 0) {
    user = s.slice(0, at).split(':')[0];
    domain = s.slice(at + 1);
    if (domain === 'g.us') return { ok: false, reason: 'مجموعة — ممنوع' };
    if (domain === 'broadcast' || domain === 'newsletter') return { ok: false, reason: 'بثّ/قناة — ممنوع' };
    if (['c.us', 's.whatsapp.net', 'lid'].indexOf(domain) < 0) return { ok: false, reason: `نطاق غير مدعوم: ${domain}` };
    if (!/^\d{6,20}$/.test(user)) return { ok: false, reason: 'معرّف غير رقمي' };
    if (domain !== 'lid') domain = opts.userSuffix;
  } else {
    let d = s.replace(/[\s\-().+]/g, '');
    if (!/^\d+$/.test(d)) return { ok: false, reason: 'رقم غير صالح' };
    if (d.startsWith('00')) d = d.slice(2);
    if (/^05\d{8}$/.test(d)) d = '966' + d.slice(1);
    else if (/^5\d{8}$/.test(d)) d = '966' + d;
    if (d.length < 10 || d.length > 15) return { ok: false, reason: 'طول الرقم غير معقول' };
    user = d;
    domain = opts.userSuffix;
  }
  if (opts.block.indexOf(user) >= 0) return { ok: false, reason: 'رقم محظور (المالك أو خطّ فرح)' };
  return { ok: true, jid: `${user}@${domain}`, key: user };
}

/** يرفض نصاً فارغاً أو أطول من اللازم. يعيد النص منظّفاً أو null. */
export function cleanText(raw) {
  const t = String(raw == null ? '' : raw).replace(/\r\n/g, '\n').trim();
  if (!t) return { ok: false, reason: 'نص فارغ' };
  if (t.length > MAX_TEXT_CHARS) return { ok: false, reason: `النص أطول من ${MAX_TEXT_CHARS} محرفاً` };
  return { ok: true, text: t };
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

export class Outbox {
  /**
   * @param {{ account: string, cfg: object, userSuffix: string,
   *           isReady: () => boolean,
   *           transport: (jid: string, text: string) => Promise<string> }} o
   * transport: يرسل نصاً بلا تعليم قراءة ويعيد معرّف الرسالة.
   */
  constructor(o) {
    this.account = o.account;
    this.cfg = o.cfg;
    this.userSuffix = o.userSuffix;
    this.isReady = o.isReady;
    this.transport = o.transport;
    this.log = logger(`outbox:${o.account}`);
    this.stateFile = path.join(o.cfg.stateDir, `${o.account}.json`);
    this.sentAt = [];
    this.timer = null;
    this.busy = false;
    this.stopped = false;
    this.pendingAcks = [];
    /** بصمات ما نرسله الآن — ليعرف الأرشيف أن الصادر من فرح لا من أسلوب باهر. */
    this.mine = new Map();
  }

  async init() {
    await mkdir(this.cfg.stateDir, { recursive: true });
    try {
      const st = JSON.parse(await readFile(this.stateFile, 'utf8'));
      if (Array.isArray(st.sentAt)) this.sentAt = st.sentAt.filter((n) => Number.isFinite(n));
    } catch { /* أول تشغيل */ }
    this.prune();
  }

  prune(now = Date.now()) {
    const cut = now - 24 * 3600 * 1000;
    this.sentAt = this.sentAt.filter((t) => t > cut);
  }

  async persist() {
    const tmp = this.stateFile + '.tmp';
    await writeFile(tmp, JSON.stringify({ sentAt: this.sentAt }), 'utf8');
    await rename(tmp, this.stateFile);
  }

  /** كم رسالة يسمح السقفان بإرسالها الآن. */
  capacity(now = Date.now()) {
    this.prune(now);
    const hour = this.sentAt.filter((t) => t > now - 3600 * 1000).length;
    return Math.max(0, Math.min(this.cfg.hourlyMax - hour, this.cfg.dailyMax - this.sentAt.length));
  }

  /** بصمة (محادثة + نص) لإرسالٍ جارٍ أو حديث — يستعملها الأرشيف. */
  static fingerprint(user, text) {
    return createHash('sha1').update(`${user}|${String(text).trim()}`).digest('hex');
  }

  /** هل هذه الرسالة الصادرة من إرسالنا؟ (تُنادى من الجلسة عند الأرشفة) */
  isMine(chatId, text) {
    const user = String(chatId || '').split('@')[0].split(':')[0];
    // الرقم قد يتحوّل إلى معرّف @lid عند الأرشفة، فنطابق بالنص وحده أيضاً.
    for (const fp of [Outbox.fingerprint(user, text), Outbox.fingerprint('*', text)]) {
      const exp = this.mine.get(fp);
      if (!exp) continue;
      if (exp < Date.now()) { this.mine.delete(fp); continue; }
      return true;
    }
    return false;
  }

  start() {
    this.stopped = false;
    const loop = async () => {
      if (this.stopped) return;
      let again = false;
      try { again = await this.tick(); } catch (err) {
        this.log.error('دورة الصادر سقطت', { error: String((err && err.message) || err) });
      }
      if (this.stopped) return;
      this.timer = setTimeout(loop, again ? 2000 : this.cfg.pollS * 1000);
      if (this.timer && typeof this.timer.unref === 'function') this.timer.unref();
    };
    this.timer = setTimeout(loop, 5000);
    this.log.info('الصادر مفتوح لهذا الحساب', {
      poll_s: this.cfg.pollS, batch: this.cfg.batch,
      gap_s: [this.cfg.gapMinMs / 1000, this.cfg.gapMaxMs / 1000],
      hourly: this.cfg.hourlyMax, daily: this.cfg.dailyMax,
    });
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  async call(body) {
    const raw = JSON.stringify(body);
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 20000);
    try {
      const res = await fetch(this.cfg.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-bp-signature': sign(raw, this.cfg.secret) },
        body: raw,
        signal: ctl.signal,
      });
      const text = await res.text().catch(() => '');
      if (!res.ok) return { ok: false, status: res.status, error: text.slice(0, 200) };
      try { return JSON.parse(text); } catch { return { ok: false, error: 'رد غير JSON' }; }
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err).slice(0, 200) };
    } finally {
      clearTimeout(t);
    }
  }

  async ack(id, status, extra) {
    const body = Object.assign({ action: 'ack', account: this.account, id, status }, extra || {});
    const r = await this.call(body);
    if (!r || r.ok !== true) {
      // لا نُسقط الإقرار: يعاد في الدورة التالية. بلا إقرار يبقى الأمر «قيد الإرسال»
      // ولا يُسحب ثانية، فلا خطر إرسال مزدوج — فقط حالة قديمة في الجدول.
      this.pendingAcks.push(body);
      if (this.pendingAcks.length > 500) this.pendingAcks.shift();
      this.log.warn('تعذّر إقرار أمر — سيعاد', { id, status });
    }
  }

  async flushAcks() {
    const list = this.pendingAcks;
    this.pendingAcks = [];
    for (const body of list) {
      const r = await this.call(body);
      if (!r || r.ok !== true) this.pendingAcks.push(body);
    }
  }

  /** دورة واحدة. تعيد true إن وجب سحب ثانٍ فوراً (الدفعة كانت ممتلئة). */
  async tick() {
    if (this.busy) return false;
    this.busy = true;
    try {
      if (this.pendingAcks.length) await this.flushAcks();
      if (!this.isReady()) return false;
      const cap = this.capacity();
      if (cap <= 0) {
        this.log.warn('سقف الإرسال (ساعة/يوم) بلغ حدّه — لا سحب الآن', {
          sent_24h: this.sentAt.length, hourly: this.cfg.hourlyMax, daily: this.cfg.dailyMax,
        });
        return false;
      }
      const limit = Math.min(this.cfg.batch, cap);
      const res = await this.call({ action: 'pull', account: this.account, limit });
      if (!res || res.ok !== true) {
        this.log.warn('تعذّر سحب الصادر', { error: (res && res.error) || 'unknown' });
        return false;
      }
      const items = Array.isArray(res.items) ? res.items.slice(0, limit) : [];
      for (let i = 0; i < items.length; i += 1) {
        if (this.stopped) {
          for (const rest of items.slice(i)) await this.ack(rest.id, 'released', { error: 'الجسر يُغلق' });
          break;
        }
        const sent = await this.handle(items[i]);
        if (sent && i < items.length - 1) {
          const gap = this.cfg.gapMinMs + Math.random() * (this.cfg.gapMaxMs - this.cfg.gapMinMs);
          await sleep(gap);
        }
      }
      return items.length >= limit && limit === this.cfg.batch;
    } finally {
      this.busy = false;
    }
  }

  /** ينفّذ أمراً واحداً. يعيد true إن أُرسلت رسالة فعلاً (ليُحسب الفاصل). */
  async handle(item) {
    const id = String((item && item.id) == null ? '' : item.id);
    if (!id) return false;
    const dest = resolveDestination(item.to, { userSuffix: this.userSuffix, block: this.cfg.block });
    if (!dest.ok) {
      this.log.warn('أمر مرفوض', { id, reason: dest.reason });
      await this.ack(id, 'blocked', { error: dest.reason });
      return false;
    }
    const txt = cleanText(item.text);
    if (!txt.ok) {
      await this.ack(id, 'blocked', { error: txt.reason });
      return false;
    }
    if (!this.isReady()) {
      await this.ack(id, 'released', { error: 'الجلسة غير جاهزة' });
      return false;
    }
    if (this.capacity() <= 0) {
      await this.ack(id, 'released', { error: 'سقف الإرسال' });
      return false;
    }
    const fps = [Outbox.fingerprint(dest.key, txt.text), Outbox.fingerprint('*', txt.text)];
    for (const fp of fps) this.mine.set(fp, Date.now() + 5 * 60 * 1000);
    try {
      const msgId = await this.transport(dest.jid, txt.text);
      this.sentAt.push(Date.now());
      await this.persist().catch(() => {});
      this.log.info('أُرسلت رسالة', { id, to: dest.key.slice(0, 5) + '…', chars: txt.text.length });
      await this.ack(id, 'sent', { wa_message_id: String(msgId || '') });
      return true;
    } catch (err) {
      for (const fp of fps) this.mine.delete(fp);
      const msg = String((err && err.message) || err).slice(0, 200);
      this.log.error('فشل الإرسال — لا إعادة محاولة', { id, error: msg });
      await this.ack(id, 'failed', { error: msg });
      return false;
    }
  }
}

/**
 * وسيط Baileys: السطر الوحيد في الجسر الذي يُرسل. `sendMessage` في Baileys
 * لا يعلّم المحادثة مقروءة (التعليم دالة منفصلة `readMessages` ممنوعة هنا).
 */
export function makeTransport(getSock) {
  return async function send(jid, text) {
    const sock = getSock();
    if (!sock) throw new Error('المقبس غير جاهز');
    const m = await sock.sendMessage(jid, { text });
    return (m && m.key && m.key.id) || '';
  };
}
