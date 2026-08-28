/**
 * تشفير الأسرار المخزَّنة.
 *
 * المفتاح الخاص لتوقيع الفواتير والرمز السري للشهادة يجلسان في قاعدة
 * البيانات. تسريب نسخة احتياطية بلا تشفير يعني أن الغير يستطيع إصدار
 * فواتير باسم المنشأة — لا قراءة بياناتها فحسب. لذلك يُخزَّنان مشفَّرَين
 * بمفتاح يعيش في متغيّرات البيئة لا في القاعدة، فسرقة القاعدة وحدها
 * لا تكفي.
 *
 * AES-256-GCM: يشفّر ويصادق معاً، فالتلاعب بالنص المشفَّر يُكتشف عند فكّه
 * بدل أن يُفكّ إلى قمامة تُستعمل كأنها مفتاح.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const SALT_LEN = 16;
const TAG_LEN = 16;

function masterKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.length < 32) {
    throw new Error(
      'ENCRYPTION_KEY غير معرّف أو أقصر من ٣٢ محرفاً. ' +
        'وُلّد مفتاحاً بـ: openssl rand -base64 32',
    );
  }
  return Buffer.from(raw, 'utf8');
}

/**
 * يشفّر نصاً ويعيده Base64.
 *
 * الملح عشوائي لكل قيمة: قيمتان متطابقتان تُنتجان نصّين مشفَّرَين مختلفَين،
 * فلا يستدلّ ناظرٌ إلى القاعدة على تساويهما.
 */
export function encryptSecret(plain: string): string {
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = scryptSync(masterKey(), salt, 32);

  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, tag, enc]).toString('base64');
}

export function decryptSecret(encoded: string): string {
  const buf = Buffer.from(encoded, 'base64');
  if (buf.length < SALT_LEN + IV_LEN + TAG_LEN) {
    throw new Error('القيمة المشفَّرة قصيرة أو تالفة');
  }

  const salt = buf.subarray(0, SALT_LEN);
  const iv = buf.subarray(SALT_LEN, SALT_LEN + IV_LEN);
  const tag = buf.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN);
  const enc = buf.subarray(SALT_LEN + IV_LEN + TAG_LEN);

  const key = scryptSync(masterKey(), salt, 32);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  try {
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    throw new Error(
      'فشل فكّ التشفير: إما أن ENCRYPTION_KEY تغيّر، أو أن القيمة عُبث بها.',
    );
  }
}

/** مقارنة زمنها ثابت — للتوكنات والرموز السرية. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
