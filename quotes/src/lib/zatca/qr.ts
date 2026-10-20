/**
 * حمولة رمز الاستجابة السريعة لفاتورة زاتكا — بنية TLV مشفّرة base64.
 *
 * المرحلة الأولى (فاتورة/توليد): خمسة حقول بترتيب ثابت.
 * المرحلة الثانية (الربط والتكامل): تُضاف للفاتورة المبسطة أربعة حقول —
 * تجزئة الفاتورة، التوقيع الرقمي، المفتاح العام، وتوقيع الهيئة على الشهادة.
 *
 * الطول في TLV هو طول القيمة بالبايت لا بعدد الحروف — الأسماء العربية
 * تجعل هذا الفرق جوهرياً: «شركة» أربعة حروف وثمانية بايتات.
 */

function tlv(tag: number, value: string | Buffer): Buffer {
  const v = Buffer.isBuffer(value) ? value : Buffer.from(String(value ?? ''), 'utf8');
  if (v.length > 255) throw new Error(`tlv_value_too_long_tag_${tag}`);
  return Buffer.concat([Buffer.from([tag, v.length]), v]);
}

const money = (n: number | string) => {
  const x = Number(n);
  return Number.isFinite(x) ? x.toFixed(2) : String(n);
};

export interface QrPhase1Fields {
  sellerName: string;
  /** الرقم الضريبي للبائع — 15 خانة */
  vatNumber: string;
  /** وقت الإصدار ISO 8601 */
  timestamp: string;
  /** الإجمالي شاملاً الضريبة */
  total: number | string;
  /** مبلغ الضريبة وحده */
  vat: number | string;
}

/** حمولة المرحلة الأولى: الحقول الخمسة الإلزامية بترتيبها. */
export function qrPayloadPhase1(f: QrPhase1Fields): string {
  return Buffer.concat([
    tlv(1, f.sellerName),
    tlv(2, f.vatNumber),
    tlv(3, f.timestamp),
    tlv(4, money(f.total)),
    tlv(5, money(f.vat)),
  ]).toString('base64');
}

export interface QrPhase2Fields extends QrPhase1Fields {
  /** تجزئة الفاتورة base64 (كما تُرسل للهيئة) */
  invoiceHash: string;
  /** التوقيع الرقمي ECDSA بصيغة base64 */
  signature: string;
  /** المفتاح العام للبائع بصيغة DER */
  publicKeyDer: Buffer;
  /** توقيع الهيئة على شهادة الختم — للفاتورة المبسطة فقط */
  certSignature?: Buffer | null;
}

/** حمولة المرحلة الثانية للفاتورة المبسطة: 1–8 دائماً و9 عند توفر توقيع الشهادة. */
export function qrPayloadPhase2(f: QrPhase2Fields): string {
  const parts = [
    tlv(1, f.sellerName),
    tlv(2, f.vatNumber),
    tlv(3, f.timestamp),
    tlv(4, money(f.total)),
    tlv(5, money(f.vat)),
    tlv(6, f.invoiceHash),
    tlv(7, f.signature),
    tlv(8, f.publicKeyDer),
  ];
  if (f.certSignature && f.certSignature.length) parts.push(tlv(9, f.certSignature));
  return Buffer.concat(parts).toString('base64');
}

/** الرقم الضريبي السعودي: 15 خانة يبدأ وينتهي بـ3. */
export function vatNumberLooksValid(v: string | null | undefined): boolean {
  const d = String(v || '').replace(/\D/g, '');
  return d.length === 15 && d.startsWith('3') && d.endsWith('3');
}

/** فك حمولة TLV للفحص الذاتي — يعيد {tag: value} والقيم نصوص UTF-8. */
export function decodeTlv(b64: string): Record<number, string> {
  const buf = Buffer.from(b64, 'base64');
  const out: Record<number, string> = {};
  let i = 0;
  while (i + 2 <= buf.length) {
    const tag = buf[i];
    const len = buf[i + 1];
    out[tag] = buf.subarray(i + 2, i + 2 + len).toString('utf8');
    i += 2 + len;
  }
  return out;
}
