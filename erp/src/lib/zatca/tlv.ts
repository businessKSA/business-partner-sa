/**
 * ترميز TLV لرمز الاستجابة السريعة في الفاتورة الإلكترونية.
 *
 * الصيغة التي تشترطها هيئة الزكاة والضريبة والدخل: سلسلة من الحقول، كلٌّ
 * منها ثلاثة أجزاء — رقم الوسم (بايت)، وطول القيمة (بايت)، والقيمة نفسها
 * بترميز UTF-8. ثم تُرمَّز السلسلة كلها Base64 وتوضع في الرمز.
 *
 * الوسوم من ١ إلى ٥ إلزامية في كل فاتورة (المرحلة الأولى فصاعداً):
 *   ١ اسم البائع  ٢ الرقم الضريبي للبائع  ٣ الطابع الزمني للفاتورة
 *   ٤ الإجمالي شامل الضريبة  ٥ مبلغ ضريبة القيمة المضافة
 * والوسوم من ٦ إلى ٩ تُضاف في المرحلة الثانية:
 *   ٦ تجزئة الفاتورة  ٧ التوقيع الرقمي  ٨ المفتاح العام
 *   ٩ توقيع الهيئة على المفتاح العام (للفواتير المبسطة)
 *
 * مزلقان يقع فيهما كثيرون:
 *  ـ الطول بالبايتات لا بالمحارف. «الرياض» ستة محارف واثنا عشر بايتاً،
 *    ومن يعدّ المحارف يُنتج رمزاً لا يُقرأ.
 *  ـ قيمة أطول من ٢٥٥ بايتاً لا يسعها بايتُ الطول. نرفضها صراحةً بدل أن
 *    نقتطعها فينتج رمزٌ سليم الشكل كاذب المضمون.
 */

export type TlvField = { tag: number; value: string | Buffer };

export function encodeTlv(fields: TlvField[]): Buffer {
  const parts: Buffer[] = [];

  for (const { tag, value } of fields) {
    if (tag < 0 || tag > 255) throw new Error(`وسم TLV خارج المدى: ${tag}`);

    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
    if (bytes.length > 255) {
      throw new Error(
        `قيمة الوسم ${tag} طولها ${bytes.length} بايتاً، وبايت الطول لا يسع أكثر من ٢٥٥.`,
      );
    }

    parts.push(Buffer.from([tag, bytes.length]), bytes);
  }

  return Buffer.concat(parts);
}

/** يفكّ ترميز TLV — للتحقق وللاختبارات ولقراءة رمز فاتورة واردة. */
export function decodeTlv(buf: Buffer): TlvField[] {
  const out: TlvField[] = [];
  let i = 0;
  while (i < buf.length) {
    if (i + 2 > buf.length) throw new Error('سلسلة TLV مبتورة عند الوسم');
    const tag = buf[i];
    const len = buf[i + 1];
    const start = i + 2;
    if (start + len > buf.length) throw new Error(`قيمة الوسم ${tag} مبتورة`);
    out.push({ tag, value: buf.subarray(start, start + len) });
    i = start + len;
  }
  return out;
}

export type QrInput = {
  sellerName: string;
  vatNumber: string;
  /** الطابع الزمني بصيغة ISO 8601 بتوقيت زولو: 2026-08-27T10:15:30Z */
  timestamp: string;
  /** الإجمالي شامل ضريبة القيمة المضافة، بمنزلتين */
  totalWithVat: string;
  /** مبلغ الضريبة، بمنزلتين */
  vatTotal: string;

  // ── المرحلة الثانية
  /** تجزئة الفاتورة (Base64 لناتج SHA-256) */
  invoiceHash?: string;
  /** التوقيع الرقمي (Base64) */
  signature?: string;
  /** المفتاح العام بترميز DER خاماً */
  publicKey?: Buffer;
  /** توقيع الهيئة على شهادة البائع — للفواتير المبسطة فقط */
  certSignature?: Buffer;
};

/** يبني رمز QR ويعيده Base64 كما يوضع في الفاتورة. */
export function buildQr(input: QrInput): string {
  const fields: TlvField[] = [
    { tag: 1, value: input.sellerName },
    { tag: 2, value: input.vatNumber },
    { tag: 3, value: input.timestamp },
    { tag: 4, value: input.totalWithVat },
    { tag: 5, value: input.vatTotal },
  ];

  if (input.invoiceHash) fields.push({ tag: 6, value: input.invoiceHash });
  if (input.signature) fields.push({ tag: 7, value: input.signature });
  if (input.publicKey) fields.push({ tag: 8, value: input.publicKey });
  if (input.certSignature) fields.push({ tag: 9, value: input.certSignature });

  return encodeTlv(fields).toString('base64');
}

/** يقرأ رمزاً Base64 ويعيد حقوله نصوصاً — للتحقق البصري وللاختبارات. */
export function readQr(base64: string): Record<number, string> {
  const fields = decodeTlv(Buffer.from(base64, 'base64'));
  const out: Record<number, string> = {};
  for (const f of fields) {
    const b = f.value as Buffer;
    // الوسوم ٨ و٩ ثنائية بطبيعتها فتُعرض Base64، وما عداها نصّ
    out[f.tag] = f.tag >= 8 ? b.toString('base64') : b.toString('utf8');
  }
  return out;
}
