/**
 * بناء XML وإخراجه بصيغة قانونية (canonical).
 *
 * تجزئة الفاتورة تُحسب على بايتات XML بعد «التقنين»، وأي اختلاف في بايت
 * واحد — مسافة، ترتيب سمة، وسم فارغ مغلق على نفسه — يغيّر التجزئة فيسقط
 * التوقيع. لذلك لا نبني نصاً بالسَّلسلة، بل شجرةً ثم نُخرجها بقواعد ثابتة:
 *
 *  ـ كل عنصر بوسم فتحٍ ووسم إغلاق، ولو كان فارغاً. C14N لا تعرف `<x/>`.
 *  ـ السمات مرتَّبة ترتيباً معجمياً، وإعلانات النطاقات قبلها.
 *  ـ الهروب في النص: & و< و> فقط؛ وفي قيمة السمة تُضاف " والسطر الجديد.
 *  ـ لا تعليقات ولا تعليمات معالجة ولا مسافات بين العناصر.
 *
 * فائدة البناء شجرةً أن الحذف قبل التجزئة (المواصفة توجب حذف ثلاثة عناصر)
 * يصير حذف عقدة، لا محاولةَ اقتطاعٍ من نصٍّ بتعبير نمطي — وهي محاولةٌ
 * تنجح في الحالة السهلة وتكسر أول فاتورة فيها محتوى مشابه.
 */

export type XmlNode = XmlElement | string;

export type XmlElement = {
  name: string;
  attrs?: Record<string, string>;
  children?: XmlNode[];
};

export function el(
  name: string,
  attrs?: Record<string, string> | null,
  children?: XmlNode[] | string | null,
): XmlElement {
  const kids =
    children === null || children === undefined
      ? []
      : typeof children === 'string'
        ? [children]
        : children;
  return { name, attrs: attrs ?? undefined, children: kids };
}

/** عنصر بنصّ فقط — الشكل الأغلب في UBL. */
export function txt(name: string, value: string | number, attrs?: Record<string, string>): XmlElement {
  return el(name, attrs, String(value));
}

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
    .replace(/\r/g, '&#xD;')
    .replace(/\n/g, '&#xA;')
    .replace(/\t/g, '&#x9;');
}

/**
 * يُخرج الشجرة نصاً قانونياً.
 *
 * إعلانات النطاقات (xmlns) تُكتب أولاً ومرتَّبة، ثم بقية السمات مرتَّبة —
 * وهو ترتيب C14N.
 */
export function serialize(node: XmlNode): string {
  if (typeof node === 'string') return escapeText(node);

  const attrs = node.attrs ?? {};
  const keys = Object.keys(attrs);
  const ns = keys.filter((k) => k === 'xmlns' || k.startsWith('xmlns:')).sort();
  const rest = keys.filter((k) => k !== 'xmlns' && !k.startsWith('xmlns:')).sort();

  const attrStr = [...ns, ...rest].map((k) => ` ${k}="${escapeAttr(attrs[k])}"`).join('');
  const inner = (node.children ?? []).map(serialize).join('');

  // لا وسوم مغلقة على نفسها — C14N توجب الفتح والإغلاق دائماً.
  return `<${node.name}${attrStr}>${inner}</${node.name}>`;
}

/** يُخرج المستند كاملاً بترويسة XML — للحفظ والإرسال لا للتجزئة. */
export function serializeDocument(root: XmlElement): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${serialize(root)}`;
}

/**
 * ينسخ الشجرة حاذفاً كل عقدة يقبلها المُرشِّح.
 *
 * تُستعمل قبل التجزئة لحذف ما توجب المواصفة حذفه: امتدادات UBL (التي تحوي
 * التوقيع نفسه — ولا يمكن أن يوقّع المرء على توقيعه)، وعنصر التوقيع،
 * ومرجع رمز QR (الذي يحوي التجزئة — للسبب عينه).
 */
export function pruneTree(node: XmlNode, shouldRemove: (e: XmlElement) => boolean): XmlNode | null {
  if (typeof node === 'string') return node;
  if (shouldRemove(node)) return null;

  const children = (node.children ?? [])
    .map((c) => pruneTree(c, shouldRemove))
    .filter((c): c is XmlNode => c !== null);

  return { ...node, children };
}

/** يبحث عن أول عنصر بالاسم — لقراءة قيمة من مستند مبنيّ. */
export function findElement(node: XmlNode, name: string): XmlElement | null {
  if (typeof node === 'string') return null;
  if (node.name === name) return node;
  for (const c of node.children ?? []) {
    const found = findElement(c, name);
    if (found) return found;
  }
  return null;
}
