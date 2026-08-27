/**
 * التوريد بإعادة البيع — بزنس بارتنر هي المتعاقد، لا وسيط بين طرفين.
 *
 *   نموذج العميل  ──▶  طلب توريد (RESALE)
 *        │
 *        ▼  تُختار فئات الموردين من رمز الخدمة
 *   طلبات عروض (RFP) تُرسل لكل مورد برمزه الخاص
 *        │
 *        ▼  المورد يفتح صفحته ويرفع عرضه ويكتب سعره
 *   استخراج نص عرض المورد  ──▶  تنقية  ──▶  عرض سعر باسم بزنس بارتنر
 *
 * لماذا وضعان لا واحد:
 *
 * الوضع الثلاثي في suppliers.ts يعرض المورد للعميل باسمه وسجله وآيبانه،
 * ويجعل المال أمانةً في محفظة تُصرف على مراحل. فلا ربح لنا في قيمة التوريد،
 * وأتعابنا سطر مستقل. هذا صحيح لمشروع كبير يريد العميل فيه أن يرى مورده.
 *
 * وهذا الملف عكسه: نشتري من المورد ونبيع للعميل بسعر واحد يشمل الهامش، ولا
 * يظهر المورد في مستند العميل. فالمبلغ كله إيراد لنا وتكلفة المورد مصروف —
 * وهذا ما يجب أن تقوله الدفاتر والفاتورة الضريبية. خلط الوضعين يجعل الفاتورة
 * تصف صفقةً لم تقع.
 *
 * وما يُستخرج من عرض المورد لا يُنسخ كما هو: عرضه يحمل التزاماته هو — مدة
 * ضمانه، واستثناءاته، وأرقام تراخيصه، واسمه. ووضعها تحت اسمنا يجعلنا مُلزَمين
 * أمام عميل لا عقد بينه وبين المورد، بشروط لم نقرأها ولم نقبلها. فالتنقية
 * هنا ليست تجميلاً: هي الفرق بين إعادة بيع وبين وعدٍ بما لا نملك.
 */
import { prisma } from './db';
import { VAT_RATE } from '../../config/company';
import { round2 } from './money';
import { nextSupplyRequestNumber, nextDocumentNumber } from './numbering';
import { publicToken, shortToken } from './tokens';
import { logEvent } from './timeline';
import { DOC_STATUS, DOC_TYPE } from './enums';
import { sendMail } from './mailer';
import { renderMailHtml, renderMailText, sanitizeMailDoc } from './mail-layout';

/** مدة صلاحية رابط المورد. بعدها لا يُفتح ولا يُقبل ردّ. */
export const RFP_TTL_DAYS = 14;

/** أسماء الفئات كما تُكتب في نوشن وفي حقل categories. */
export const SUPPLIER_CATEGORIES: Record<string, string> = {
  workspace: 'مساحات العمل والمكاتب',
  housing: 'سكن العمال والإسكان',
  realestate: 'العقارات',
  fitout: 'التشطيب والمقاولات',
  logistics: 'النقل والخدمات اللوجستية',
  it: 'تقنية المعلومات والتجهيزات',
  marketing: 'التسويق والإنتاج',
  other: 'أخرى',
};

export function categoryLabel(code: string): string {
  return SUPPLIER_CATEGORIES[code] || code;
}

function parseCategories(raw: string | null | undefined): string[] {
  return String(raw || '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * موردو فئة بعينها.
 *
 * المطابقة على الفئة لا على النشاط الحرّ: النشاط نصّ يوصف للبشر، فمن ذكر
 * «العقار» عرضاً في وصفه يُطابَق كمن يعمل بها، ويصل طلبٌ إلى من لا يقدّمه.
 */
export async function suppliersForCategory(category: string) {
  const cat = category.trim().toLowerCase();
  if (!cat) return [];
  const all = await prisma.supplier.findMany({
    where: { active: true, email: { not: null } },
    orderBy: { nameAr: 'asc' },
  });
  return all.filter((s) => parseCategories(s.categories).includes(cat));
}

/**
 * يفتح طلب توريد بوضع إعادة البيع من نموذج العميل.
 *
 * ما يكتبه العميل يُحفظ كما كتبه في intakeAr: نصّه هو ما يُرسل للموردين، وأي
 * إعادة صياغة له تُغيّر ما يُسعَّر عليه.
 */
export async function createSourcingRequest(input: {
  clientId: string;
  titleAr: string;
  titleEn: string;
  intakeAr: string;
  serviceCode?: string | null;
  markupPct?: number;
  actor?: string;
}) {
  const markup = input.markupPct ?? 0.1;
  if (!(markup >= 0 && markup < 1)) throw new Error('الهامش خارج المدى المقبول');

  const req = await prisma.supplyRequest.create({
    data: {
      number: await nextSupplyRequestNumber(),
      clientId: input.clientId,
      titleAr: input.titleAr,
      titleEn: input.titleEn,
      scopeAr: input.intakeAr,
      intakeAr: input.intakeAr,
      serviceCode: input.serviceCode ?? null,
      mode: 'RESALE',
      markupPct: markup,
      status: 'QUOTING',
    },
  });

  await logEvent({
    entityType: 'supply_request',
    entityId: req.id,
    clientId: input.clientId,
    code: 'SOURCING_REQUEST_CREATED',
    titleAr: `وصل طلب ${req.number} — ${req.titleAr}، ونبحث لك عن أفضل عرض`,
    titleEn: `Request ${req.number} received — ${req.titleEn}; we are sourcing the best offer`,
    actor: input.actor || 'client',
    actorKind: input.actor ? 'admin' : 'client',
  });
  return req;
}

/**
 * يجهّز طلبات العروض لموردي فئة، ولا يرسلها.
 *
 * الإنشاء منفصل عن الإرسال عمداً: الصفوف تُنشأ مرة، ثم يُرسل البريد ويُختم
 * sentAt. فلو فشل الإرسال لمورد لم يُفقد صفّه ولم يُعَد إنشاؤه برمز جديد —
 * ورمزٌ جديد لكل محاولة يعني روابط ميتة في بريد مورد فتحه متأخراً.
 */
export async function prepareRfps(supplyRequestId: string, supplierIds: string[]) {
  const expiresAt = new Date(Date.now() + RFP_TTL_DAYS * 24 * 60 * 60 * 1000);
  const out = [];
  for (const supplierId of supplierIds) {
    const existing = await prisma.supplierRfp.findUnique({
      where: { supplyRequestId_supplierId: { supplyRequestId, supplierId } },
    });
    if (existing) {
      out.push(existing);
      continue;
    }
    out.push(
      await prisma.supplierRfp.create({
        data: { supplyRequestId, supplierId, token: shortToken(24), expiresAt },
      }),
    );
  }
  return out;
}

/** يفتح رمز المورد صفحته — ما لم يكن منتهياً أو مردوداً عليه. */
export async function openRfp(token: string) {
  const rfp = await prisma.supplierRfp.findUnique({
    where: { token },
    include: { supplier: true, supplyRequest: true, bid: true },
  });
  if (!rfp) return null;
  if (rfp.expiresAt && rfp.expiresAt.getTime() < Date.now()) return { ...rfp, expired: true as const };
  if (!rfp.openedAt) {
    await prisma.supplierRfp.update({ where: { id: rfp.id }, data: { openedAt: new Date() } });
  }
  return { ...rfp, expired: false as const };
}

export interface ExtractedLine {
  nameAr: string;
  descAr?: string;
  qty: number;
  unitAr?: string;
  unitPrice: number;
}

/**
 * ما يُسمح بعبوره من مستند المورد إلى مستند العميل.
 *
 * البنود والكميات والأسعار تعبر — هي موضوع الصفقة. ولا يعبر: اسم المورد،
 * سجله، أرقام تراخيصه، بياناته البنكية، ولا شروط ضمانٍ أو استثناءٍ كتبها عن
 * نفسه. تلك التزاماته هو، ونحن نبيع للعميل بشروطنا نحن.
 */
// أل التعريف تسبق كل كلمة من هذه في الكتابة الطبيعية: «السجل التجاري» لا
// «سجل تجاري»، و«الرقم الضريبي» لا «رقم ضريبي». وأول اختبار على نصّ حقيقي
// أظهر أن الأنماط بلا (?:ال) تمرّ فوق السجل والرقم الضريبي وتتركهما يعبران.
const AL = '(?:ال)?';
const BLOCKED_PATTERNS: RegExp[] = [
  /\biban\b|آيبان|الايبان|الآيبان/i,
  new RegExp(`${AL}سجل\\s*${AL}تجاري|commercial\\s*registration|\\bC\\.?R\\.?\\s*No`, 'i'),
  new RegExp(`${AL}رقم\\s*${AL}ضريبي|vat\\s*(no|number|reg)`, 'i'),
  new RegExp(`${AL}ترخيص\\s*${AL}رقم|licen[cs]e\\s*(no|number)`, 'i'),
  new RegExp(`${AL}ضمان|warrant(y|ies)`, 'i'),
];

/** يحذف من نصّ ما لا يجوز أن يظهر تحت اسمنا. */
export function scrubSupplierText(text: string, supplierNames: string[]): string {
  let out = String(text || '');
  for (const name of supplierNames.filter(Boolean)) {
    // اسم المورد نفسه — أوضح ما يجب ألا يبقى.
    out = out.split(name).join('المورد');
  }
  return out
    .split('\n')
    .filter((line) => !BLOCKED_PATTERNS.some((re) => re.test(line)))
    .join('\n')
    .trim();
}

/** سعر البيع للعميل من تكلفة المورد. */
export function resalePrice(cost: number, markupPct: number): number {
  return round2(cost * (1 + markupPct));
}

/**
 * يبني عرض سعر باسم بزنس بارتنر من عرض المورد المختار.
 *
 * السعر واحد يشمل الهامش، ولا سطر باسم «رسوم إدارية»: الهامش ليس خدمة
 * منفصلة يشتريها العميل، بل فرق بيعٍ في سعر ما اشتراه. وفصله سطراً يُظهر
 * وجود طرف ثالث ويثير سؤالاً لا يجيب عنه المستند.
 */
export async function buildResaleQuote(supplyRequestId: string, actor = 'admin') {
  const req = await prisma.supplyRequest.findUniqueOrThrow({
    where: { id: supplyRequestId },
    include: { selectedBid: { include: { supplier: true } }, client: true, documents: true },
  });
  if (req.mode !== 'RESALE') throw new Error('هذا الطلب ليس بوضع إعادة البيع');
  if (!req.selectedBid) throw new Error('اختر عرض مورد أولاً');

  const existing = req.documents.find((d) => d.type === DOC_TYPE.QUOTE);
  if (existing) return existing;

  const bid = req.selectedBid;
  const supplierNames = [bid.supplier.nameAr, bid.supplier.nameEn || ''].filter(Boolean);

  let lines: ExtractedLine[] = [];
  if (bid.extractedJson) {
    try {
      const parsed = JSON.parse(bid.extractedJson) as ExtractedLine[];
      if (Array.isArray(parsed)) lines = parsed;
    } catch {
      lines = [];
    }
  }

  // بلا بنود مستخرجة يبقى بند واحد بالقيمة الكاملة — عرضٌ ببند واحد صحيح،
  // وعرضٌ ببنود مخترعة ليس كذلك.
  if (!lines.length) {
    lines = [{ nameAr: req.titleAr, qty: 1, unitPrice: bid.amount }];
  }

  const items = lines.map((l, i) => {
    const qty = Math.max(1, Number(l.qty) || 1);
    const unit = resalePrice(Number(l.unitPrice) || 0, req.markupPct);
    return {
      code: `SRC-${String(i + 1).padStart(2, '0')}`,
      nameAr: scrubSupplierText(l.nameAr, supplierNames) || req.titleAr,
      nameEn: '',
      descAr: l.descAr ? scrubSupplierText(l.descAr, supplierNames) : null,
      descEn: null,
      qty,
      unitPrice: unit,
      lineTotal: round2(unit * qty),
      unitAr: l.unitAr || 'خدمة',
      unitEn: 'service',
      sortOrder: i,
    };
  });

  const subtotal = round2(items.reduce((s, it) => s + it.lineTotal, 0));
  const vatAmount = round2(subtotal * VAT_RATE);

  const doc = await prisma.document.create({
    data: {
      type: DOC_TYPE.QUOTE,
      number: await nextDocumentNumber('SRC'),
      status: DOC_STATUS.DRAFT,
      clientId: req.clientId,
      supplyRequestId: req.id,
      publicToken: publicToken(),
      titleAr: req.titleAr,
      titleEn: req.titleEn,
      introAr: `عرض سعر من شركة بزنس بارتنر سلوشنز بناءً على طلبكم ${req.number}.`,
      introEn: `Quotation from Business Partner Solutions Company for your request ${req.number}.`,
      notesAr: [
        'الأسعار غير شاملة ضريبة القيمة المضافة 15%.',
        'الرسوم الحكومية مستثناة وتُسدَّد للجهات المختصة مباشرة بالتكلفة الفعلية.',
        'التنفيذ والضمان بمسؤولية شركة بزنس بارتنر سلوشنز وفق شروطها.',
      ].join('\n'),
      vatRate: VAT_RATE,
      subtotal,
      vatAmount,
      total: round2(subtotal + vatAmount),
      items: { create: items },
    },
  });

  await prisma.supplyRequest.update({ where: { id: req.id }, data: { status: 'SELECTED' } });

  // التكلفة والهامش يُسجَّلان في الخط الزمني لا في المستند: نحتاج أن نعرفهما
  // نحن، ولا يخرجان إلى العميل.
  const cost = round2(bid.amount);
  await logEvent({
    entityType: 'supply_request',
    entityId: req.id,
    clientId: req.clientId,
    code: 'RESALE_QUOTE_BUILT',
    titleAr: `بُني عرض ${doc.number} — التكلفة ${cost} والبيع ${subtotal} بهامش ${Math.round(req.markupPct * 100)}%`,
    titleEn: `Quote ${doc.number} built — cost ${cost}, sale ${subtotal}, margin ${Math.round(req.markupPct * 100)}%`,
    actor,
    actorKind: 'admin',
    // clientVisible يفترض true — ولو تُرك لظهر للعميل سطرٌ يقول له تكلفتنا
    // وهامشنا في خطّه الزمني. الافتراض هنا خطأ صامت، فيُنقض صراحةً.
    clientVisible: false,
  });
  return doc;
}

/** رابط صفحة المورد. */
export function rfpUrl(token: string): string {
  const base = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
  return `${base}/rfp/${token}`;
}

/**
 * يرسل طلب العرض للموردين ويختم sentAt لمن وصله.
 *
 * ما يصل المورد هو نصّ العميل كما كتبه — بلا اسم العميل ولا بريده ولا هاتفه.
 * المورد يسعّر نطاق عمل، ولا يحتاج أن يعرف لمن؛ ومعرفته تعني أنه يستطيع أن
 * يتجاوزنا إليه، وأن بيانات عميلنا صارت عند طرف لم يوقّع علينا شيئاً.
 *
 * الإرسال لكل مورد على حدة: البريد الجامع يُظهر لكل مورد من يزاحمه.
 */
export async function dispatchRfps(
  supplyRequestId: string,
  supplierIds: string[],
  actor = 'admin',
): Promise<{ sent: number; failed: { supplierId: string; error: string }[] }> {
  const req = await prisma.supplyRequest.findUniqueOrThrow({ where: { id: supplyRequestId } });
  const rfps = await prepareRfps(supplyRequestId, supplierIds);
  const failed: { supplierId: string; error: string }[] = [];
  let sent = 0;

  for (const rfp of rfps) {
    const supplier = await prisma.supplier.findUniqueOrThrow({ where: { id: rfp.supplierId } });
    if (!supplier.email) {
      failed.push({ supplierId: supplier.id, error: 'لا بريد للمورد' });
      continue;
    }

    const doc = sanitizeMailDoc({
      title: `طلب عرض سعر — ${req.titleAr}`,
      greeting: `السادة ${supplier.nameAr}`,
      intro:
        'نطلب عرض سعركم لنطاق العمل الموضّح أدناه. يرجى تقديم العرض عبر الرابط، ورفع عرضكم الرسمي مرفقاً.',
      refsHeading: 'نطاق العمل المطلوب',
      refs: [
        { label: 'رقم الطلب', value: req.number },
        { label: 'الوصف', value: req.intakeAr || req.scopeAr || req.titleAr },
      ],
      cta: { label: 'قدّم عرضك', url: rfpUrl(rfp.token) },
      notes: [
        `الرابط صالح ${RFP_TTL_DAYS} يوماً من تاريخ هذه الرسالة.`,
        'الأسعار المطلوبة غير شاملة ضريبة القيمة المضافة.',
        'هذا طلب عرض سعر ولا يُعدّ ارتباطاً تعاقدياً حتى صدور أمر شراء منّا.',
      ],
    });

    const res = await sendMail({
      to: supplier.email,
      subject: `طلب عرض سعر ${req.number} — ${req.titleAr}`,
      text: renderMailText(doc),
      html: renderMailHtml(doc),
    });

    if (res.ok) {
      await prisma.supplierRfp.update({ where: { id: rfp.id }, data: { sentAt: new Date() } });
      sent += 1;
    } else {
      failed.push({ supplierId: supplier.id, error: res.error || 'تعذّر الإرسال' });
    }
  }

  await logEvent({
    entityType: 'supply_request',
    entityId: req.id,
    clientId: req.clientId,
    code: 'RFP_DISPATCHED',
    titleAr: `أُرسل طلب العرض إلى ${sent} مورد${failed.length ? ` وتعذّر إلى ${failed.length}` : ''}`,
    titleEn: `RFP sent to ${sent} supplier(s)${failed.length ? `, ${failed.length} failed` : ''}`,
    actor,
    actorKind: 'admin',
    // من سُئل وكم مورداً زوحم — شأننا لا شأن العميل.
    clientVisible: false,
  });

  return { sent, failed };
}

/**
 * يسجّل ردّ المورد من صفحته.
 *
 * الردّ يُقبل مرة واحدة: مورد يعدّل سعره بعد أن رآه غيره ليس مناقصة. ولو
 * أراد التعديل فبريدٌ منّا يفتح له طلباً جديداً — بأثرٍ يُقرأ.
 */
export async function submitRfpBid(input: {
  token: string;
  amount: number;
  deliveryAr?: string | null;
  notesAr?: string | null;
  filePath?: string | null;
}) {
  const rfp = await prisma.supplierRfp.findUnique({
    where: { token: input.token },
    include: { supplier: true, supplyRequest: true },
  });
  if (!rfp) throw new Error('رابط غير معروف');
  if (rfp.expiresAt && rfp.expiresAt.getTime() < Date.now()) throw new Error('انتهت صلاحية الرابط');
  if (rfp.bidId) throw new Error('سبق استلام عرضكم لهذا الطلب');

  const amount = round2(Number(input.amount));
  if (!(amount > 0)) throw new Error('أدخل مبلغاً صحيحاً');

  const bid = await prisma.supplierBid.create({
    data: {
      supplyRequestId: rfp.supplyRequestId,
      supplierId: rfp.supplierId,
      amount,
      deliveryAr: input.deliveryAr ?? null,
      notesAr: input.notesAr ?? null,
      filePath: input.filePath ?? null,
    },
  });
  await prisma.supplierRfp.update({
    where: { id: rfp.id },
    data: { bidId: bid.id, respondedAt: new Date() },
  });

  await logEvent({
    entityType: 'supply_request',
    entityId: rfp.supplyRequestId,
    clientId: rfp.supplyRequest.clientId,
    code: 'RFP_BID_RECEIVED',
    titleAr: `وصل عرض من ${rfp.supplier.nameAr} بمبلغ ${amount}`,
    titleEn: `Bid received from ${rfp.supplier.nameEn || rfp.supplier.nameAr} for ${amount}`,
    actor: rfp.supplier.nameAr,
    actorKind: 'system',
    clientVisible: false,
  });
  return bid;
}

/** يسجّل اعتذار المورد — فالصامت والمعتذر لا يُتابَعان سواءً. */
export async function declineRfp(token: string) {
  const rfp = await prisma.supplierRfp.findUnique({ where: { token } });
  if (!rfp) throw new Error('رابط غير معروف');
  await prisma.supplierRfp.update({ where: { id: rfp.id }, data: { declinedAt: new Date() } });
}

/**
 * يقرأ ملف عرض المورد ويستخرج بنوده.
 *
 * القراءة تُفوَّض لنقطة الموقع كما تُفوَّض الفاتورة الضريبية: مفاتيح نماذج
 * الرؤية معرَّفة هناك منذ شهور، ونسخها إلى مشروع ثانٍ يعني مفتاحين لكل مزوّد
 * ونسختين تتفارقان.
 *
 * والمستخرج يُحفظ خاماً ومُنقّى معاً: الخام ليُراجَع حين يشكّ أحد في رقم،
 * والمنقّى هو ما يُبنى منه عرض العميل.
 */
export async function extractBidDocument(
  bidId: string,
): Promise<{ ok: true; lines: ExtractedLine[] } | { ok: false; error: string }> {
  const base = (process.env.SITE_API_URL || '').replace(/\/+$/, '');
  const token = process.env.PANEL_BRIDGE_TOKEN;
  if (!base || !token) return { ok: false, error: 'الجسر مع الموقع غير مضبوط' };

  const bid = await prisma.supplierBid.findUniqueOrThrow({ where: { id: bidId } });
  if (!bid.filePath) return { ok: false, error: 'لا ملف مرفق بهذا العرض' };

  const { storage } = await import('./storage');
  let bytes: Buffer;
  try {
    bytes = await storage().get(bid.filePath);
  } catch {
    return { ok: false, error: 'تعذّر قراءة الملف من التخزين' };
  }

  const mime = bid.filePath.toLowerCase().endsWith('.pdf')
    ? 'application/pdf'
    : bid.filePath.toLowerCase().endsWith('.png')
      ? 'image/png'
      : 'image/jpeg';

  let data: { ok?: boolean; raw?: string; parsed?: { lines?: ExtractedLine[] } | null; error?: string };
  try {
    const res = await fetch(`${base}/api/supplier-quote-read`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ base64: bytes.toString('base64'), mime }),
      signal: AbortSignal.timeout(60000),
    });
    data = (await res.json().catch(() => ({}))) as typeof data;
    if (!res.ok || data.ok !== true) return { ok: false, error: data.error || `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const lines = Array.isArray(data.parsed?.lines) ? data.parsed.lines : [];
  await prisma.supplierBid.update({
    where: { id: bidId },
    data: {
      extractedRaw: data.raw ?? null,
      extractedJson: lines.length ? JSON.stringify(lines) : null,
    },
  });
  return { ok: true, lines };
}
