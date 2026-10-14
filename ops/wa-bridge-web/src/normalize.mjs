// تحويل رسالة whatsapp-web.js إلى شكل الحمولة الثابت (عقد v1).
//
// هذا الملف هو نظير `ops/wa-bridge/src/normalize.mjs` بالضبط: **نفس الصادرات،
// ونفس أسماء الحقول، ونفس الفلاتر** — والمختلف وحده هو شكل المدخل، لأن
// whatsapp-web.js يعطي كائن `Message` مُسلسلاً من صفحة واتساب، لا عقدة
// بروتوكول كما يعطي Baileys.
//
// قاعدتان منقولتان كما هما:
//   1) لا تُنزَّل وسائط ولا تُرسل — الاسم والنوع فقط (خصوصية وحجم).
//   2) لا يُطبع متن رسالة في السجل.
//
// ⚠️ قرار مقصود: **توحيد صيغة `chat_id` مع الجسر الأول.**
// whatsapp-web.js يسمّي المحادثة الفردية `966xxxxxxxxx@c.us`، وBaileys
// يسمّيها `966xxxxxxxxx@s.whatsapp.net`. العقد لا يفرض الصيغة، لكن سير n8n
// يستعمل `chat_id` مفتاحَ منع تكرار وربطٍ بصفحة نوشن — فلو أرسل الجسران
// صيغتين مختلفتين للمحادثة نفسها لرآهما السير محادثتين. لذلك تُترجَم
// `@c.us` إلى `@s.whatsapp.net` هنا قبل بناء الحمولة. المجموعات `@g.us`
// متطابقة في المحركين فلا تُمسّ.

/** معرّفات لا تُقرأ أبداً: القصص/الحالات، والرسائل الرسمية من واتساب. */
const SKIP_JIDS = new Set([
  'status@broadcast',
  '0@s.whatsapp.net',
  '0@c.us',
]);

/**
 * أنواع `Message.type` التي لا تمثّل رسالة بشرية.
 * مقابل `SYSTEM_KEYS` في الجسر الأول.
 */
const SYSTEM_TYPES = new Set([
  'e2e_notification',
  'notification',
  'notification_template',
  'gp2',
  'protocol',
  'ciphertext',
  'revoked',
  'call_log',
  'groups_v4_invite',
  'broadcast_notification',
  'oversized',
  'poll_creation',
  'native_flow',
  'keep_in_chat',
  'interactive_response',
]);

function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

/**
 * يوحّد لاحقة الـJID مع الجسر الأول (انظر الملاحظة أعلى الملف).
 * `@c.us` → `@s.whatsapp.net`. ما سواها يبقى كما هو — ومنها `@lid`
 * (المعرّف المخفي الجديد) و`@g.us` و`@newsletter`.
 */
export function canonicalJid(jid) {
  const raw = String(jid || '');
  if (!raw) return '';
  const at = raw.indexOf('@');
  if (at < 0) return raw;
  const head = raw.slice(0, at).split(':')[0];
  const domain = raw.slice(at + 1);
  if (domain === 'c.us') return `${head}@s.whatsapp.net`;
  return `${head}@${domain}`;
}

/** رقم من JID: 9665xxxxxxx@c.us → 9665xxxxxxx */
function msisdnFromJid(jid) {
  const head = String(jid || '').split('@')[0] || '';
  return digits(head.split(':')[0]);
}

function isGroupJid(jid) {
  return String(jid || '').endsWith('@g.us');
}

/** `msg._data` عبر الحاصل العام `rawData` — وإن غاب فكائن فارغ. */
function rawOf(msg) {
  const d = msg && (msg.rawData || msg._data);
  return d && typeof d === 'object' ? d : {};
}

/**
 * النص المقتبس (ردّ على رسالة) إن وُجد.
 *
 * يُقرأ من `rawData.quotedMsg` لا بـ`getQuotedMessage()` — وهذا مقصود:
 * كل استدعاء إلى صفحة واتساب خطرٌ إضافي وتأخير، والحمولة الخام تحمل
 * المقتبس أصلاً حين `hasQuotedMsg`.
 */
function quotedText(msg) {
  const q = rawOf(msg).quotedMsg;
  if (!q || typeof q !== 'object') return '';
  const t = q.body || q.caption || q.filename || '';
  return String(t || '').slice(0, 400);
}

/**
 * يستخرج النوع والنص واسم الملف من الرسالة.
 * kind ∈ text | image | document | audio | video | other — كما في الجسر الأول.
 */
function classify(msg) {
  const type = String((msg && msg.type) || '');
  const raw = rawOf(msg);
  const body = String((msg && msg.body) || '');

  if (type === 'chat') return { kind: 'text', text: body, media_name: '' };
  if (type === 'image') return { kind: 'image', text: body, media_name: '' };
  if (type === 'video') {
    const gif = msg && msg.isGif === true;
    return { kind: 'video', text: body, media_name: gif ? 'gif' : '' };
  }
  if (type === 'ptv') return { kind: 'video', text: '', media_name: 'video-note' };
  if (type === 'document') {
    return {
      kind: 'document',
      // في المستندات `body` هو التعليق إن وُجد، وإلا بيانات الوسيط — فيُستبعد.
      text: raw.caption ? String(raw.caption) : '',
      media_name: String(raw.filename || ''),
    };
  }
  if (type === 'ptt' || type === 'audio') {
    const voice = type === 'ptt';
    const secs = Number((msg && msg.duration) || raw.duration || 0);
    return {
      kind: 'audio',
      text: '',
      media_name: `${voice ? 'voice' : 'audio'}${Number.isFinite(secs) && secs ? ` ${secs}s` : ''}`,
    };
  }
  if (type === 'sticker') return { kind: 'other', text: '', media_name: 'sticker' };
  if (type === 'location' || type === 'live_location') {
    return { kind: 'other', text: '', media_name: 'location' };
  }
  if (type === 'vcard' || type === 'multi_vcard') {
    return { kind: 'other', text: '', media_name: 'contact' };
  }
  return { kind: 'other', text: body, media_name: '' };
}

/** طابع الوقت بالثواني. whatsapp-web.js يعطيه عدداً. */
export function tsOf(msg) {
  const t = msg && msg.timestamp;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * معرّف المحادثة الذي تُجمَّع عليه الدفعة — بصيغة الجسر الأول.
 * `id.remote` هو جهة المحادثة دائماً، صادرةً كانت أو واردة.
 */
export function chatIdOf(msg) {
  const id = (msg && msg.id) || {};
  const remote = id.remote && typeof id.remote === 'object'
    ? id.remote._serialized
    : id.remote;
  const fallback = msg && (msg.fromMe ? msg.to : msg.from);
  return canonicalJid(remote || fallback || '');
}

/** معرّف الرسالة المفرد. */
export function messageIdOf(msg) {
  const id = (msg && msg.id) || {};
  return String(id.id || id._serialized || '');
}

/**
 * JID المرسِل: في المجموعة `author`، وفي الفردية جهة المحادثة،
 * وإن كانت منّي فرقم الحساب.
 */
export function senderJidOf(msg, accountMsisdn) {
  if (msg && msg.fromMe) return `${digits(accountMsisdn)}@s.whatsapp.net`;
  const chatId = chatIdOf(msg);
  if (isGroupJid(chatId)) return canonicalJid((msg && msg.author) || '');
  return chatId;
}

/**
 * هل هذه الرسالة جديرة بالقراءة؟
 * يرفض: البثّ والحالات، رسائل النظام، الرسائل بلا متن، والأقدم من ignoreOlderH.
 * نفس أسباب الرفض النصّية التي يسجّلها الجسر الأول.
 */
export function shouldSkip(msg, opts) {
  if (!msg) return 'empty';
  const jid = chatIdOf(msg);
  if (!jid) return 'empty';
  if (SKIP_JIDS.has(jid)) return 'broadcast';
  if (jid.endsWith('@broadcast')) return 'broadcast';
  if (jid.endsWith('@newsletter')) return 'newsletter';
  if (msg.isStatus === true) return 'broadcast';
  if (msg.broadcast === true) return 'broadcast';

  const type = String(msg.type || '');
  if (!type) return 'empty';
  if (SYSTEM_TYPES.has(type)) return 'system';
  if (rawOf(msg).isNotification === true) return 'stub';

  const ts = tsOf(msg);
  const olderH = Number(opts && opts.ignoreOlderH);
  if (Number.isFinite(olderH) && olderH > 0 && ts > 0) {
    const ageH = (Date.now() / 1000 - ts) / 3600;
    if (ageH > olderH) return 'too-old';
  }
  return null;
}

/**
 * رسالة whatsapp-web.js واحدة → عنصر messages[] في الحمولة.
 * meta: { accountMsisdn, senderName } — الاسم يُحلّ في session.mjs لأن حلّه
 * يحتاج استدعاءً غير متزامن إلى الصفحة، وهذه الدالة تبقى نقية ومتزامنة.
 */
export function normalizeMessage(msg, meta) {
  const fromMe = (msg && msg.fromMe) === true;
  const c = classify(msg);
  const senderJid = senderJidOf(msg, meta && meta.accountMsisdn);

  const name = fromMe
    ? 'أنا'
    : String((meta && meta.senderName) || rawOf(msg).notifyName || '');

  return {
    message_id: messageIdOf(msg),
    ts: tsOf(msg),
    from_me: fromMe,
    sender_name: name,
    sender_msisdn: msisdnFromJid(senderJid),
    kind: c.kind,
    text: String(c.text || '').slice(0, 4000),
    quoted_text: quotedText(msg),
    media_name: String(c.media_name || '').slice(0, 200),
  };
}

/**
 * يبني الحمولة الكاملة لدفعة محادثة واحدة (عقد v1 — لا يُغيَّر).
 * مطابقة حرفياً لـ`buildPayload` في الجسر الأول.
 *
 * `opts` إضافةٌ لا تكسر العقد — حقول جديدة فقط، ولا يُمسّ حقل قائم:
 *   `backfill: true` يُكتب **في أعلى الحمولة** لدفعات الجرد الشامل وحدها،
 *       فيعرف السير أنها تاريخ لا تدفّقٌ حيّ (ويكتم التنبيه).
 *       لا يُكتب أصلاً في الدفعات الحيّة، فتبقى بايتاً ببايت كما كانت.
 *   `labels: []` ليبلات واتساب بزنس التي وسم بها **المالك نفسه** المحادثة.
 *       تُرسل دائماً (فارغةً حين لا توجد أو حين لا يدعمها الحساب) لأنها
 *       سياقٌ ثابت للمحادثة لا حالةٌ عارضة.
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
