// تحويل رسالة Baileys إلى شكل الحمولة الثابت (عقد v1).
// قاعدة: لا تُنزَّل وسائط ولا تُرسل — الاسم والنوع فقط (خصوصية وحجم).

/** معرّفات لا تُقرأ أبداً: القصص/الحالات، والرسائل الرسمية من واتساب. */
const SKIP_JIDS = new Set(['status@broadcast', '0@s.whatsapp.net']);

/** أنواع عقد Baileys التي لا تمثّل رسالة بشرية. */
const SYSTEM_KEYS = new Set([
  'protocolMessage',
  'senderKeyDistributionMessage',
  'reactionMessage',
  'pollUpdateMessage',
  'editedMessage',
  'messageContextInfo',
  'ephemeralMessage',
  'keepInChatMessage',
  'pinInChatMessage',
]);

/** يفكّ أغلفة الرسائل المؤقتة/المرئية-مرة-واحدة حتى يصل إلى المتن الحقيقي. */
function unwrap(message) {
  let m = message || {};
  for (let i = 0; i < 4; i += 1) {
    if (m.ephemeralMessage && m.ephemeralMessage.message) { m = m.ephemeralMessage.message; continue; }
    if (m.viewOnceMessage && m.viewOnceMessage.message) { m = m.viewOnceMessage.message; continue; }
    if (m.viewOnceMessageV2 && m.viewOnceMessageV2.message) { m = m.viewOnceMessageV2.message; continue; }
    if (m.viewOnceMessageV2Extension && m.viewOnceMessageV2Extension.message) { m = m.viewOnceMessageV2Extension.message; continue; }
    if (m.documentWithCaptionMessage && m.documentWithCaptionMessage.message) { m = m.documentWithCaptionMessage.message; continue; }
    break;
  }
  return m;
}

function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

/** رقم من JID: 9665xxxxxxx@s.whatsapp.net → 9665xxxxxxx */
function msisdnFromJid(jid) {
  const head = String(jid || '').split('@')[0] || '';
  return digits(head.split(':')[0]);
}

function isGroupJid(jid) {
  return String(jid || '').endsWith('@g.us');
}

/** النص المقتبس (ردّ على رسالة) إن وُجد. */
function quotedText(body) {
  const ctx =
    (body.extendedTextMessage && body.extendedTextMessage.contextInfo) ||
    (body.imageMessage && body.imageMessage.contextInfo) ||
    (body.videoMessage && body.videoMessage.contextInfo) ||
    (body.documentMessage && body.documentMessage.contextInfo) ||
    (body.audioMessage && body.audioMessage.contextInfo) ||
    null;
  const q = ctx && ctx.quotedMessage ? unwrap(ctx.quotedMessage) : null;
  if (!q) return '';
  const t =
    q.conversation ||
    (q.extendedTextMessage && q.extendedTextMessage.text) ||
    (q.imageMessage && q.imageMessage.caption) ||
    (q.videoMessage && q.videoMessage.caption) ||
    (q.documentMessage && (q.documentMessage.caption || q.documentMessage.fileName)) ||
    '';
  return String(t || '').slice(0, 400);
}

/**
 * يستخرج النوع والنص واسم الملف من متن الرسالة.
 * kind ∈ text | image | document | audio | video | other
 */
function classify(body) {
  if (body.conversation) {
    return { kind: 'text', text: String(body.conversation), media_name: '' };
  }
  if (body.extendedTextMessage) {
    return { kind: 'text', text: String(body.extendedTextMessage.text || ''), media_name: '' };
  }
  if (body.imageMessage) {
    return { kind: 'image', text: String(body.imageMessage.caption || ''), media_name: '' };
  }
  if (body.videoMessage) {
    const gif = body.videoMessage.gifPlayback === true;
    return { kind: 'video', text: String(body.videoMessage.caption || ''), media_name: gif ? 'gif' : '' };
  }
  if (body.documentMessage) {
    return {
      kind: 'document',
      text: String(body.documentMessage.caption || ''),
      media_name: String(body.documentMessage.fileName || ''),
    };
  }
  if (body.audioMessage) {
    const voice = body.audioMessage.ptt === true;
    const secs = Number(body.audioMessage.seconds || 0);
    return { kind: 'audio', text: '', media_name: `${voice ? 'voice' : 'audio'}${secs ? ` ${secs}s` : ''}` };
  }
  if (body.stickerMessage) return { kind: 'other', text: '', media_name: 'sticker' };
  if (body.locationMessage || body.liveLocationMessage) return { kind: 'other', text: '', media_name: 'location' };
  if (body.contactMessage || body.contactsArrayMessage) return { kind: 'other', text: '', media_name: 'contact' };
  if (body.ptvMessage) return { kind: 'video', text: '', media_name: 'video-note' };
  return { kind: 'other', text: '', media_name: '' };
}

/**
 * هل هذه الرسالة جديرة بالقراءة؟
 * يرفض: البثّ والحالات، رسائل النظام، الرسائل بلا متن، والأقدم من ignoreOlderH.
 */
export function shouldSkip(raw, opts) {
  const key = (raw && raw.key) || {};
  const jid = key.remoteJid || '';
  if (!jid || SKIP_JIDS.has(jid)) return 'broadcast';
  if (jid.endsWith('@broadcast')) return 'broadcast';
  if (jid.endsWith('@newsletter')) return 'newsletter';
  if (raw.messageStubType) return 'stub';

  const body = unwrap(raw.message);
  if (!body || Object.keys(body).length === 0) return 'empty';
  const only = Object.keys(body).filter((k) => k !== 'messageContextInfo');
  if (only.length === 0) return 'empty';
  if (only.every((k) => SYSTEM_KEYS.has(k))) return 'system';

  const ts = tsOf(raw);
  const olderH = Number(opts && opts.ignoreOlderH);
  if (Number.isFinite(olderH) && olderH > 0 && ts > 0) {
    const ageH = (Date.now() / 1000 - ts) / 3600;
    if (ageH > olderH) return 'too-old';
  }
  return null;
}

/** طابع الوقت بالثواني. Baileys يعيده عدداً أو Long. */
export function tsOf(raw) {
  const t = raw && raw.messageTimestamp;
  if (t == null) return 0;
  if (typeof t === 'number') return Math.floor(t);
  if (typeof t === 'object' && typeof t.toNumber === 'function') return Math.floor(t.toNumber());
  const n = Number(t);
  return Number.isFinite(n) ? Math.floor(n) : 0;
}

/** معرّف المحادثة الذي تُجمَّع عليه الدفعة. */
export function chatIdOf(raw) {
  return String(((raw && raw.key) || {}).remoteJid || '');
}

/**
 * رسالة Baileys واحدة → عنصر messages[] في الحمولة.
 * meta: { accountMsisdn, pushNameFor } — pushNameFor اختياري لجلب اسم جهة الاتصال.
 */
export function normalizeMessage(raw, meta) {
  const key = (raw && raw.key) || {};
  const jid = String(key.remoteJid || '');
  const group = isGroupJid(jid);
  const fromMe = key.fromMe === true;
  const body = unwrap(raw.message);
  const c = classify(body);

  // المرسِل: في المجموعة participant، وفي الفردية الطرف الآخر، وإن كانت منّي فرقم المالك.
  const senderJid = fromMe
    ? `${(meta && meta.accountMsisdn) || ''}@s.whatsapp.net`
    : (group ? String(key.participant || '') : jid);

  const name = fromMe
    ? 'أنا'
    : String(raw.pushName || (meta && meta.pushNameFor ? meta.pushNameFor(senderJid) : '') || '');

  return {
    message_id: String(key.id || ''),
    ts: tsOf(raw),
    from_me: fromMe,
    sender_name: name,
    sender_msisdn: msisdnFromJid(senderJid),
    kind: c.kind,
    text: String(c.text || '').slice(0, 4000),
    quoted_text: quotedText(body),
    media_name: String(c.media_name || '').slice(0, 200),
  };
}

/**
 * يبني الحمولة الكاملة لدفعة محادثة واحدة (عقد v1 — لا يُغيَّر).
 *
 * `opts` إضافةٌ لا تكسر العقد — حقول جديدة فقط، ولا يُمسّ حقل قائم:
 *   `backfill: true` يُكتب **في أعلى الحمولة** لدفعات الجرد الشامل وحدها،
 *       فيعرف السير أنها تاريخ لا تدفّقٌ حيّ (ويكتم التنبيه).
 *       لا يُكتب أصلاً في الدفعات الحيّة، فتبقى بايتاً ببايت كما كانت.
 *   `labels: []` ليبلات واتساب بزنس التي وسم بها **المالك نفسه** المحادثة.
 *       تُرسل دائماً (وهي فارغة في هذا الجسر غالباً — انظر `backfill.mjs`).
 */
export function buildPayload(account, accountMsisdn, chatId, chatName, messages, opts) {
  const o = opts || {};
  const labels = [];
  for (const raw of Array.isArray(o.labels) ? o.labels : []) {
    const name = String(raw || '').trim();
    if (name) labels.push(name.slice(0, 60));
  }
  const payload = { v: 1 };
  if (o.backfill === true) payload.backfill = true;
  payload.account = account;
  payload.account_msisdn = digits(accountMsisdn);
  payload.chat_id = String(chatId);
  payload.chat_name = String(chatName || '').slice(0, 200);
  payload.is_group = isGroupJid(chatId);
  payload.labels = labels;
  payload.messages = messages;
  return payload;
}

export { isGroupJid, msisdnFromJid };
