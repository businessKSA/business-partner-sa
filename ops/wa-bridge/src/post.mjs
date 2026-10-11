// الإرسال إلى n8n: توقيع HMAC-SHA256 على الجسم الخام، وطابور على القرص
// حتى لا تُفقد دفعة إن كان n8n نائماً أو الشبكة مقطوعة.

import { createHmac } from 'node:crypto';
import { mkdir, writeFile, readFile, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { logger } from './log.mjs';

const log = logger('post');

/** توقيع الجسم الخام بنفس الصيغة التي يتحقّق منها السير: sha256=<hex> */
export function sign(rawBody, secret) {
  return 'sha256=' + createHmac('sha256', String(secret)).update(rawBody, 'utf8').digest('hex');
}

/**
 * يرسل الحمولة مرة واحدة. يعيد { ok, status, error }.
 * لا يرمي: المتصل يقرّر الطابور.
 */
async function postOnce(url, rawBody, secret, timeoutMs) {
  const ctl = new AbortController();
  const timer = setTimeout(function abort() { ctl.abort(); }, timeoutMs || 20000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-bp-signature': sign(rawBody, secret),
      },
      body: rawBody,
      signal: ctl.signal,
    });
    const text = await res.text().catch(function () { return ''; });
    if (!res.ok) return { ok: false, status: res.status, error: text.slice(0, 300) };
    return { ok: true, status: res.status };
  } catch (err) {
    return { ok: false, status: 0, error: String((err && err.message) || err).slice(0, 300) };
  } finally {
    clearTimeout(timer);
  }
}

export class Sender {
  /**
   * @param {{ url: string, secret: string, queueDir: string }} cfg
   */
  constructor(cfg) {
    this.url = cfg.url;
    this.secret = cfg.secret;
    this.queueDir = cfg.queueDir;
    this.draining = false;
    this.seq = 0;
  }

  async init() {
    await mkdir(this.queueDir, { recursive: true });
    const pending = await this.pendingCount();
    if (pending) log.info('طابور على القرص عند الإقلاع', { pending });
  }

  async pendingCount() {
    try {
      const names = await readdir(this.queueDir);
      let n = 0;
      for (const name of names) if (name.endsWith('.json')) n += 1;
      return n;
    } catch {
      return 0;
    }
  }

  /** يحفظ الجسم الخام في الطابور باسم مرتّب زمنياً. */
  async enqueue(rawBody, tag) {
    this.seq += 1;
    const safeTag = String(tag || 'batch').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40);
    const name = `${Date.now()}-${String(this.seq).padStart(5, '0')}-${safeTag}.json`;
    const file = path.join(this.queueDir, name);
    await writeFile(file, rawBody, 'utf8');
    log.warn('الدفعة حُفظت في الطابور', { file: name });
    return file;
  }

  /**
   * يرسل الحمولة؛ عند الفشل يضعها في الطابور ويعيد false.
   * @param {object} payload
   */
  async send(payload) {
    const rawBody = JSON.stringify(payload);
    const tag = `${payload.account || 'acct'}-${String(payload.chat_id || '').split('@')[0]}`;
    if (!this.url || !this.secret) {
      log.error('WA_WEBHOOK_URL أو WA_BRIDGE_SECRET غير مضبوط — الدفعة إلى الطابور');
      await this.enqueue(rawBody, tag);
      return false;
    }
    const r = await postOnce(this.url, rawBody, this.secret);
    if (r.ok) {
      log.info('دفعة أُرسلت', { account: payload.account, chat: tag, messages: payload.messages.length });
      // نجاح يعني أن n8n حيّ: جرّب تصريف ما تأخّر.
      this.drain();
      return true;
    }
    log.warn('فشل إرسال الدفعة', { status: r.status, error: r.error });
    await this.enqueue(rawBody, tag);
    return false;
  }

  /**
   * يصرّف الطابور بتراجع بسيط: أقدم ملف أولاً، ويتوقّف عند أول فشل
   * حتى لا يُستهلك n8n بمحاولات متتالية.
   */
  async drain() {
    if (this.draining) return;
    if (!this.url || !this.secret) return;
    this.draining = true;
    try {
      const names = (await readdir(this.queueDir).catch(function () { return []; }))
        .filter(function (n) { return n.endsWith('.json'); })
        .sort();
      for (const name of names) {
        const file = path.join(this.queueDir, name);
        const rawBody = await readFile(file, 'utf8').catch(function () { return null; });
        if (rawBody == null) continue;
        const r = await postOnce(this.url, rawBody, this.secret);
        if (!r.ok) {
          log.warn('تصريف الطابور توقّف', { file: name, status: r.status });
          break;
        }
        await unlink(file).catch(function () {});
        log.info('دفعة من الطابور أُرسلت', { file: name });
      }
    } finally {
      this.draining = false;
    }
  }
}
