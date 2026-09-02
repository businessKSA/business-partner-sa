/**
 * مُرمِّز DER مصغَّر (ASN.1 Distinguished Encoding Rules).
 *
 * لماذا نكتبه بدل استيراد مكتبة؟ لأن ما نحتاجه منه صغير ومحدَّد — بضعة
 * أنواع لبناء طلب توقيع الشهادة (CSR) الذي تشترطه هيئة الزكاة والضريبة —
 * والمكتبات العامة تجرّ معها تبعيات تشفير كبيرة في مسارٍ يجب أن يبقى
 * مقروءاً ومدقَّقاً. الأداة الرسمية للهيئة مكتوبة بلغة جافا، وربطُ نظام
 * TypeScript بها يعني تشغيل جهاز جافا افتراضي بجانب كل نشر — ثمنٌ باهظ
 * لثلاثمئة سطر.
 *
 * DER صيغة «وسم-طول-قيمة»: بايت للنوع، ثم الطول (بايت واحد إن قلّ عن ١٢٨،
 * وإلا بايت يقول كم بايتاً يليه للطول)، ثم المحتوى.
 */

export const TAG = {
  BOOLEAN: 0x01,
  INTEGER: 0x02,
  BIT_STRING: 0x03,
  OCTET_STRING: 0x04,
  NULL: 0x05,
  OID: 0x06,
  UTF8_STRING: 0x0c,
  PRINTABLE_STRING: 0x13,
  IA5_STRING: 0x16,
  SEQUENCE: 0x30,
  SET: 0x31,
} as const;

/** يرمّز الطول بصيغة DER: قصير حتى ١٢٧، ثم طويل بعدد بايتاته. */
export function encodeLength(len: number): Buffer {
  if (len < 0) throw new Error('طول سالب');
  if (len < 0x80) return Buffer.from([len]);

  const bytes: number[] = [];
  let n = len;
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n >>= 8;
  }
  if (bytes.length > 126) throw new Error('طول أكبر مما تدعمه هذه الصيغة');
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

/** يغلّف محتوى بوسمٍ وطول. اللبنة التي يُبنى بها كل ما تحته. */
export function tlv(tag: number, content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), encodeLength(content.length), content]);
}

export function sequence(...items: Buffer[]): Buffer {
  return tlv(TAG.SEQUENCE, Buffer.concat(items));
}

export function set(...items: Buffer[]): Buffer {
  return tlv(TAG.SET, Buffer.concat(items));
}

/**
 * عدد صحيح. DER يوجب أن يكون العدد الموجب الذي بايته الأعلى ≥ ٠x٨٠
 * مسبوقاً بصفر، وإلا قُرئ سالباً بالمتمّم الثنائي.
 */
export function integer(value: number | Buffer): Buffer {
  if (typeof value === 'number') {
    if (value === 0) return tlv(TAG.INTEGER, Buffer.from([0]));
    const bytes: number[] = [];
    let n = value;
    while (n > 0) {
      bytes.unshift(n & 0xff);
      n >>= 8;
    }
    if (bytes[0] & 0x80) bytes.unshift(0);
    return tlv(TAG.INTEGER, Buffer.from(bytes));
  }
  const buf = value[0] & 0x80 ? Buffer.concat([Buffer.from([0]), value]) : value;
  return tlv(TAG.INTEGER, buf);
}

/** سلسلة بتات. البايت الأول يقول كم بتّاً غير مستعمل في آخر بايت — صفر عندنا. */
export function bitString(content: Buffer, unusedBits = 0): Buffer {
  return tlv(TAG.BIT_STRING, Buffer.concat([Buffer.from([unusedBits]), content]));
}

export function octetString(content: Buffer): Buffer {
  return tlv(TAG.OCTET_STRING, content);
}

export function utf8String(s: string): Buffer {
  return tlv(TAG.UTF8_STRING, Buffer.from(s, 'utf8'));
}

export function printableString(s: string): Buffer {
  return tlv(TAG.PRINTABLE_STRING, Buffer.from(s, 'ascii'));
}

export function ia5String(s: string): Buffer {
  return tlv(TAG.IA5_STRING, Buffer.from(s, 'ascii'));
}

export function nullValue(): Buffer {
  return Buffer.from([TAG.NULL, 0x00]);
}

/**
 * معرّف الكائن (OID) من صيغته النقطية.
 *
 * القوسان الأولان يُدمجان في بايت واحد (٤٠×الأول + الثاني)، وما بعدهما
 * يُرمَّز بأساس ١٢٨ مع رفع البت الأعلى في كل بايت عدا الأخير.
 */
export function oid(dotted: string): Buffer {
  const parts = dotted.split('.').map(Number);
  if (parts.length < 2 || parts.some((p) => !Number.isInteger(p) || p < 0)) {
    throw new Error(`معرّف كائن غير صالح: ${dotted}`);
  }

  const bytes: number[] = [40 * parts[0] + parts[1]];

  for (const part of parts.slice(2)) {
    if (part < 0x80) {
      bytes.push(part);
      continue;
    }
    const chunk: number[] = [];
    let n = part;
    while (n > 0) {
      chunk.unshift(n & 0x7f);
      n >>= 7;
    }
    for (let i = 0; i < chunk.length - 1; i++) chunk[i] |= 0x80;
    bytes.push(...chunk);
  }

  return tlv(TAG.OID, Buffer.from(bytes));
}

/** وسم سياقي: [n] — للحقول الاختيارية والضمنية في البنى المعقّدة. */
export function contextTag(n: number, content: Buffer, constructed = true): Buffer {
  const tag = (constructed ? 0xa0 : 0x80) | n;
  return tlv(tag, content);
}

/** يحوّل DER إلى PEM بترويسةٍ وسطورٍ من ٦٤ محرفاً. */
export function toPem(der: Buffer, label: string): string {
  const b64 = der.toString('base64');
  const lines = b64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`;
}

/** يستخرج DER من PEM. */
export function fromPem(pem: string): Buffer {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  return Buffer.from(body, 'base64');
}
