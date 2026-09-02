/**
 * تجزئة الفاتورة وسلسلة التجزئة.
 *
 * التجزئة تُحسب على XML بعد حذف ثلاثة عناصر توجب المواصفة حذفها:
 *   ـ `ext:UBLExtensions` — لأنها تحوي التوقيع، ولا يوقّع المرء على توقيعه.
 *   ـ `cac:Signature` — لسببٍ عينه.
 *   ـ `cac:AdditionalDocumentReference` التي معرّفها QR — لأنها تحوي
 *     التجزئة نفسها، فإدراجها يجعل الحساب دائرياً.
 *
 * ثم يُحوَّل الناتج إلى نص ست عشري، ويُرمَّز النصُّ Base64. وهذه خطوة
 * يخطئ فيها كثيرون فيرمّزون البايتات الخام مباشرةً: الفرق يظهر في القيمة
 * الابتدائية المنشورة للسلسلة، فهي ترميز Base64 للنص
 * «5feceb66ffc86f38d952786c6d696c79c2dbc239dd4e91b46729d73a27fb57e»
 * وهو تجزئة المحرف «0» ست عشرياً — لا لبايتاتها.
 *
 * وسلسلة التجزئة هي ما يجعل حذف فاتورة من الدفتر مستحيلاً بلا أثر: كل
 * فاتورة تحمل تجزئة سابقتها، فحذف واحدة يقطع السلسلة عند التالية.
 */
import { createHash } from 'node:crypto';
import { serialize, pruneTree, type XmlElement, type XmlNode } from './xml.ts';

/**
 * القيمة الابتدائية للسلسلة كما تنشرها الهيئة — تأخذها أول فاتورة في كل
 * جهاز، وهي ترميز Base64 لتجزئة المحرف «0».
 */
export const INITIAL_PIH =
  'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==';

/** العناصر التي تُحذف قبل التجزئة. */
function isExcluded(e: XmlElement): boolean {
  if (e.name === 'ext:UBLExtensions') return true;
  if (e.name === 'cac:Signature') return true;

  if (e.name === 'cac:AdditionalDocumentReference') {
    const idNode = (e.children ?? []).find(
      (c): c is XmlElement => typeof c !== 'string' && c.name === 'cbc:ID',
    );
    const id = idNode?.children?.[0];
    if (typeof id === 'string' && id === 'QR') return true;
  }

  return false;
}

/** يعيد XML القانوني المُهيَّأ للتجزئة — بعد الحذف وبلا ترويسة. */
export function canonicalizeForHash(root: XmlElement): string {
  const pruned = pruneTree(root, isExcluded) as XmlNode;
  return serialize(pruned);
}

/**
 * التجزئة كما تتوقّعها الهيئة: Base64 للنصّ الست عشري لا للبايتات.
 *
 * الفرق ليس تفصيلاً: من يرمّز البايتات الخام يحصل على ٤٤ محرفاً، والهيئة
 * تنتظر ٨٨. والرفض يأتي بلا تعليل.
 */
export function hashToZatcaFormat(bytes: Buffer): string {
  const hex = bytes.toString('hex');
  return Buffer.from(hex, 'utf8').toString('base64');
}

/** يحسب تجزئة الفاتورة من شجرتها. */
export function invoiceHash(root: XmlElement): { hash: string; canonical: string; raw: Buffer } {
  const canonical = canonicalizeForHash(root);
  const raw = createHash('sha256').update(canonical, 'utf8').digest();
  return { hash: hashToZatcaFormat(raw), canonical, raw };
}

/** تجزئة عامة بصيغة الهيئة — تُستعمل للخصائص الموقَّعة وللشهادة. */
export function sha256Zatca(data: string | Buffer): string {
  const raw = createHash('sha256').update(data as never).digest();
  return hashToZatcaFormat(raw);
}

/** تجزئة بترميز Base64 للبايتات الخام — صيغة XML-DSig للـDigestValue. */
export function sha256Base64(data: string | Buffer): string {
  return createHash('sha256').update(data as never).digest('base64');
}
