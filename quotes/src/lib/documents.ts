/**
 * إنشاء العروض والعقود، الاعتماد، القبول، والأرشفة التلقائية.
 * قاعدة صارمة: لا يُرسَل أي مستند قبل الاعتماد البشري (approveDocument).
 */
import { prisma } from './db';
import { COMPANY, VAT_RATE, QUOTE_VALIDITY_DAYS } from '../../config/company';
import { computeTotals, lineTotal, round2 } from './money';
import { nextDocumentNumber, codeFamily } from './numbering';
import { publicToken } from './tokens';
import { logEvent, audit } from './timeline';
import { DOC_STATUS, DOC_TYPE, isSendable } from './enums';
import { storage, fileKey, clientFolderPath } from './storage';
import { sanitizeDeep } from './content-guard';

export interface ItemInput {
  serviceId?: string | null;
  code?: string;
  nameAr: string;
  nameEn: string;
  descAr?: string | null;
  descEn?: string | null;
  qty: number;
  unitPrice: number;
  unitAr?: string;
  unitEn?: string;
  paymentTermsAr?: string;
  paymentTermsEn?: string;
  deliveryAr?: string;
  deliveryEn?: string;
}

export interface QuoteInput {
  clientId: string;
  titleAr?: string;
  titleEn?: string;
  introAr?: string | null;
  introEn?: string | null;
  notesAr?: string | null;
  notesEn?: string | null;
  items: ItemInput[];
  validityDays?: number;
  aiGenerated?: boolean;
  aiSourceNote?: string | null;
}

/** يبني بنود العرض من الكتالوج (بسعرها) أو بنداً مخصصاً بسعر يدوي. */
export async function resolveItems(items: ItemInput[]): Promise<Required<ItemInput>[]> {
  const ids = items.map((i) => i.serviceId).filter(Boolean) as string[];
  const services = ids.length
    ? await prisma.service.findMany({ where: { id: { in: ids } } })
    : [];
  const byId = new Map(services.map((s) => [s.id, s]));

  return items.map((i) => {
    const s = i.serviceId ? byId.get(i.serviceId) : undefined;
    const qty = Math.max(0, Number(i.qty) || 0);
    // سعر الكتالوج ما لم يُدخل سعر يدوي صراحةً (الخدمات مفتوحة السعر دائماً يدوية)
    const unitPrice =
      i.unitPrice !== undefined && i.unitPrice !== null && !Number.isNaN(Number(i.unitPrice))
        ? round2(Number(i.unitPrice))
        : round2(s?.unitPrice ?? 0);
    return {
      serviceId: s?.id ?? null,
      code: i.code || s?.code || 'CUSTOM',
      nameAr: i.nameAr || s?.nameAr || '',
      nameEn: i.nameEn || s?.nameEn || '',
      descAr: i.descAr ?? s?.descAr ?? null,
      descEn: i.descEn ?? s?.descEn ?? null,
      qty,
      unitPrice,
      unitAr: i.unitAr || s?.unitAr || 'خدمة',
      unitEn: i.unitEn || s?.unitEn || 'service',
      paymentTermsAr: i.paymentTermsAr ?? s?.paymentTermsAr ?? '',
      paymentTermsEn: i.paymentTermsEn ?? s?.paymentTermsEn ?? '',
      deliveryAr: i.deliveryAr ?? s?.deliveryAr ?? '',
      deliveryEn: i.deliveryEn ?? s?.deliveryEn ?? '',
    } as Required<ItemInput>;
  });
}

/** هل أحد البنود يستوجب إرفاق جدول الرسوم الحكومية، وأقصر صلاحية مطلوبة. */
async function catalogFlags(items: Required<ItemInput>[]) {
  const codes = items.map((i) => i.code);
  const services = await prisma.service.findMany({ where: { code: { in: codes } } });
  const gov = services.find((s) => s.attachGovFees);
  const validity = services
    .map((s) => s.validityDays)
    .filter((v): v is number => typeof v === 'number');
  return {
    includeGovFees: Boolean(gov),
    govFeeGroup: gov?.govFeeGroup ?? null,
    validityDays: validity.length ? Math.min(...validity) : null,
  };
}

export async function createQuote(input: QuoteInput, actor = 'admin') {
  const client = await prisma.client.findUniqueOrThrow({ where: { id: input.clientId } });
  const items = await resolveItems(input.items);
  if (!items.length) throw new Error('لا يمكن إنشاء عرض بدون بنود');

  const totals = computeTotals(items.map((i) => ({ qty: i.qty, unitPrice: i.unitPrice })), VAT_RATE);
  const flags = await catalogFlags(items);
  const number = await nextDocumentNumber(codeFamily(items[0].code));

  const days = input.validityDays ?? flags.validityDays ?? QUOTE_VALIDITY_DAYS;
  const validUntil = new Date(Date.now() + days * 86_400_000);

  const clean = sanitizeDeep(
    {
      titleAr: input.titleAr?.trim() || 'عرض سعر',
      titleEn: input.titleEn?.trim() || 'Quotation',
      introAr: input.introAr?.trim() || null,
      introEn: input.introEn?.trim() || null,
      notesAr: input.notesAr?.trim() || null,
      notesEn: input.notesEn?.trim() || null,
      items,
    },
    'ar',
  );

  const doc = await prisma.document.create({
    data: {
      type: DOC_TYPE.QUOTE,
      number,
      status: DOC_STATUS.DRAFT,
      clientId: client.id,
      publicToken: publicToken(),
      titleAr: clean.titleAr,
      titleEn: clean.titleEn,
      introAr: clean.introAr,
      introEn: clean.introEn,
      notesAr: clean.notesAr,
      notesEn: clean.notesEn,
      vatRate: VAT_RATE,
      subtotal: totals.subtotal,
      vatAmount: totals.vatAmount,
      total: totals.total,
      includeGovFees: flags.includeGovFees,
      govFeeGroup: flags.govFeeGroup,
      validUntil,
      aiGenerated: input.aiGenerated ?? false,
      aiSourceNote: input.aiSourceNote ?? null,
      items: {
        create: clean.items.map((i, idx) => ({
          serviceId: i.serviceId,
          code: i.code,
          nameAr: i.nameAr,
          nameEn: i.nameEn,
          descAr: i.descAr,
          descEn: i.descEn,
          qty: i.qty,
          unitPrice: i.unitPrice,
          lineTotal: lineTotal(i.qty, i.unitPrice),
          unitAr: i.unitAr,
          unitEn: i.unitEn,
          paymentTermsAr: i.paymentTermsAr,
          paymentTermsEn: i.paymentTermsEn,
          deliveryAr: i.deliveryAr,
          deliveryEn: i.deliveryEn,
          sortOrder: idx,
        })),
      },
    },
  });

  await logEvent({
    entityType: 'document',
    entityId: doc.id,
    clientId: client.id,
    code: 'QUOTE_CREATED',
    titleAr: `أُنشئ عرض السعر ${doc.number} كمسودة${input.aiGenerated ? ' بواسطة الوكيل الذكي' : ''}`,
    titleEn: `Quotation ${doc.number} created as a draft${input.aiGenerated ? ' by the AI agent' : ''}`,
    actor,
    actorKind: input.aiGenerated ? 'system' : 'admin',
    clientVisible: false,
  });

  return doc;
}

/**
 * توليد العقد من العرض: نفس البنود ونفس الأسعار حرفياً بدون إعادة إدخال.
 */
export async function generateContractFromQuote(quoteId: string, actor = 'admin') {
  const quote = await prisma.document.findUniqueOrThrow({
    where: { id: quoteId },
    include: { items: { orderBy: { sortOrder: 'asc' } }, client: true, contract: true },
  });
  if (quote.type !== DOC_TYPE.QUOTE) throw new Error('هذا المستند ليس عرض سعر');
  if (quote.contract) return quote.contract;

  const number = await nextDocumentNumber(codeFamily(quote.items[0]?.code));

  const contract = await prisma.document.create({
    data: {
      type: DOC_TYPE.CONTRACT,
      number,
      status: DOC_STATUS.DRAFT,
      clientId: quote.clientId,
      sourceQuoteId: quote.id,
      publicToken: publicToken(),
      titleAr: 'عقد تقديم خدمات',
      titleEn: 'Services Agreement',
      introAr: quote.introAr,
      introEn: quote.introEn,
      notesAr: quote.notesAr,
      notesEn: quote.notesEn,
      // الأسعار والإجماليات منسوخة كما هي من العرض
      vatRate: quote.vatRate,
      subtotal: quote.subtotal,
      vatAmount: quote.vatAmount,
      total: quote.total,
      includeGovFees: quote.includeGovFees,
      govFeeGroup: quote.govFeeGroup,
      items: {
        create: quote.items.map((i, idx) => ({
          serviceId: i.serviceId,
          code: i.code,
          nameAr: i.nameAr,
          nameEn: i.nameEn,
          descAr: i.descAr,
          descEn: i.descEn,
          qty: i.qty,
          unitPrice: i.unitPrice,
          lineTotal: i.lineTotal,
          unitAr: i.unitAr,
          unitEn: i.unitEn,
          paymentTermsAr: i.paymentTermsAr,
          paymentTermsEn: i.paymentTermsEn,
          deliveryAr: i.deliveryAr,
          deliveryEn: i.deliveryEn,
          sortOrder: idx,
        })),
      },
    },
  });

  await logEvent({
    entityType: 'document',
    entityId: contract.id,
    clientId: quote.clientId,
    code: 'CONTRACT_GENERATED',
    titleAr: `تولّد العقد ${contract.number} من العرض ${quote.number} بنفس البنود والأسعار`,
    titleEn: `Agreement ${contract.number} generated from quotation ${quote.number} with identical items and prices`,
    actor,
    actorKind: 'admin',
    clientVisible: false,
  });

  return contract;
}

/** الاعتماد البشري — الشرط الوحيد الذي يفتح باب الإرسال. */
export async function approveDocument(id: string, actor: string) {
  const doc = await prisma.document.findUniqueOrThrow({ where: { id } });
  if (doc.status !== DOC_STATUS.DRAFT) {
    throw new Error(`لا يمكن اعتماد مستند حالته ${doc.status}`);
  }
  const updated = await prisma.document.update({
    where: { id },
    data: { status: DOC_STATUS.APPROVED, approvedAt: new Date(), approvedBy: actor },
  });

  await logEvent({
    entityType: 'document',
    entityId: id,
    clientId: doc.clientId,
    code: 'APPROVED',
    titleAr: `اعتُمد المستند ${doc.number} — أصبح الإرسال متاحاً`,
    titleEn: `Document ${doc.number} approved — sending is now permitted`,
    actor,
    actorKind: 'admin',
    clientVisible: false,
  });
  await audit({ action: 'DOCUMENT_APPROVED', entityType: 'document', entityId: id, actor, amount: doc.total });

  return updated;
}

/** حارس الإرسال — يُستدعى قبل أي قناة إرسال دون استثناء. */
export function assertSendable(doc: { status: string; number: string }) {
  if (!isSendable(doc.status)) {
    throw new Error(
      `المستند ${doc.number} غير معتمد (${doc.status}). لا يُرسَل أي مستند قبل الضغط على زر الاعتماد.`,
    );
  }
}

/** قبول العميل للعرض من الصفحة العامة. */
export async function acceptDocument(token: string, name: string, ip: string | null) {
  const doc = await prisma.document.findUniqueOrThrow({ where: { publicToken: token } });
  if (doc.type !== DOC_TYPE.QUOTE) throw new Error('القبول الإلكتروني متاح لعروض الأسعار فقط');
  if (doc.status === DOC_STATUS.ACCEPTED) return doc;
  if (![DOC_STATUS.SENT, DOC_STATUS.APPROVED].includes(doc.status as 'SENT' | 'APPROVED')) {
    throw new Error(`لا يمكن قبول مستند حالته ${doc.status}`);
  }
  if (doc.validUntil && doc.validUntil.getTime() < Date.now()) {
    await prisma.document.update({ where: { id: doc.id }, data: { status: DOC_STATUS.EXPIRED } });
    throw new Error('انتهت صلاحية هذا العرض');
  }

  const updated = await prisma.document.update({
    where: { id: doc.id },
    data: {
      status: DOC_STATUS.ACCEPTED,
      acceptedAt: new Date(),
      acceptedByName: name.trim().slice(0, 120),
      acceptedByIp: ip,
    },
  });

  await logEvent({
    entityType: 'document',
    entityId: doc.id,
    clientId: doc.clientId,
    code: 'ACCEPTED',
    titleAr: `قَبِل العميل العرض ${doc.number} إلكترونياً باسم ${updated.acceptedByName}`,
    titleEn: `Client accepted quotation ${doc.number} electronically as ${updated.acceptedByName}`,
    actor: updated.acceptedByName || 'client',
    actorKind: 'client',
    meta: { ip },
  });
  await audit({
    action: 'QUOTE_ACCEPTED',
    entityType: 'document',
    entityId: doc.id,
    actor: updated.acceptedByName || 'client',
    amount: doc.total,
    payload: { ip, at: updated.acceptedAt },
  });

  return updated;
}

export async function markViewed(token: string) {
  const doc = await prisma.document.findUnique({ where: { publicToken: token } });
  if (!doc || doc.firstViewedAt) return;
  await prisma.document.update({ where: { id: doc.id }, data: { firstViewedAt: new Date() } });
  await logEvent({
    entityType: 'document',
    entityId: doc.id,
    clientId: doc.clientId,
    code: 'VIEWED',
    titleAr: `فتح العميل المستند ${doc.number} لأول مرة`,
    titleEn: `Client opened document ${doc.number} for the first time`,
    actor: 'client',
    actorKind: 'client',
  });
}

/** أرشفة الـPDF تلقائياً في المجلد الصحيح داخل مجلد العميل. */
export async function archiveDocumentPdf(documentId: string, pdf: Buffer): Promise<string> {
  const doc = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
    include: { client: true },
  });
  const base =
    doc.client.folderPath || clientFolderPath(doc.client.id, doc.client.companyAr || doc.client.nameAr);
  const folder = doc.type === DOC_TYPE.QUOTE ? 'quotes' : 'contracts';
  const key = fileKey(base, folder, `${doc.number}.pdf`);
  await storage().put(key, pdf, 'application/pdf');

  await prisma.document.update({ where: { id: documentId }, data: { pdfPath: key } });
  await prisma.fileAsset.upsert({
    where: { id: `pdf-${documentId}` },
    create: {
      id: `pdf-${documentId}`,
      clientId: doc.clientId,
      documentId,
      folder,
      name: `${doc.number}.pdf`,
      path: key,
      mime: 'application/pdf',
      size: pdf.length,
      source: 'system',
    },
    update: { path: key, size: pdf.length },
  });
  return key;
}

export const COMPANY_REF = COMPANY;
