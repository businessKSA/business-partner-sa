/**
 * فلو الموردين — بزنس بارتنر شريك منسّق يضبط العمل والفلوس والمستندات.
 * 1) تسجيل المورد  2) طلب توريد وعروض ومقارنة واختيار
 * 3) اتفاقية توريد ثلاثية (العميل × المورد × بزنس بارتنر) توقَّع عبر DocuSign
 * 4) الصرف من محفظة العميل على مراحل إنجاز باعتمادي  5) الأرشفة التلقائية
 */
import { prisma } from './db';
import { VAT_RATE } from '../../config/company';
import { round2, fmtMoney } from './money';
import { nextSupplyRequestNumber, nextDocumentNumber } from './numbering';
import { publicToken } from './tokens';
import { logEvent, audit } from './timeline';
import { DOC_STATUS, DOC_TYPE } from './enums';
import { walletSpend, createInvoice } from './billing';

export async function createSupplier(input: {
  nameAr: string;
  nameEn?: string | null;
  crNumber?: string | null;
  activityAr?: string | null;
  activityEn?: string | null;
  iban?: string | null;
  bankName?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  /** أكواد التصنيف مفصولة بفواصل — بها يُوجَّه طلب العرض. */
  categories?: string | null;
  city?: string | null;
}) {
  const supplier = await prisma.supplier.create({ data: { ...input } });
  await logEvent({
    entityType: 'supplier',
    entityId: supplier.id,
    code: 'SUPPLIER_CREATED',
    titleAr: `سُجّل المورد ${supplier.nameAr}`,
    titleEn: `Supplier ${supplier.nameEn || supplier.nameAr} registered`,
    actor: 'admin',
    actorKind: 'admin',
    clientVisible: false,
  });
  return supplier;
}

export async function createSupplyRequest(input: {
  clientId: string;
  titleAr: string;
  titleEn: string;
  scopeAr?: string | null;
  scopeEn?: string | null;
  coordinationFee?: number;
}) {
  const req = await prisma.supplyRequest.create({
    data: {
      number: await nextSupplyRequestNumber(),
      clientId: input.clientId,
      titleAr: input.titleAr,
      titleEn: input.titleEn,
      scopeAr: input.scopeAr ?? null,
      scopeEn: input.scopeEn ?? null,
      coordinationFee: round2(input.coordinationFee ?? 0),
      status: 'QUOTING',
    },
  });
  await logEvent({
    entityType: 'supply_request',
    entityId: req.id,
    clientId: input.clientId,
    code: 'SUPPLY_REQUEST_CREATED',
    titleAr: `أُنشئ طلب التوريد ${req.number} — ${req.titleAr}، وفُتح باب استقبال عروض الموردين`,
    titleEn: `Supply request ${req.number} created — ${req.titleEn}; supplier bids are now open`,
    actor: 'admin',
    actorKind: 'admin',
  });
  return req;
}

export async function addSupplierBid(input: {
  supplyRequestId: string;
  supplierId: string;
  amount: number;
  deliveryAr?: string | null;
  deliveryEn?: string | null;
  notesAr?: string | null;
  notesEn?: string | null;
  filePath?: string | null;
}) {
  const [req, supplier] = await Promise.all([
    prisma.supplyRequest.findUniqueOrThrow({ where: { id: input.supplyRequestId } }),
    prisma.supplier.findUniqueOrThrow({ where: { id: input.supplierId } }),
  ]);
  const bid = await prisma.supplierBid.create({
    data: {
      supplyRequestId: input.supplyRequestId,
      supplierId: input.supplierId,
      amount: round2(input.amount),
      deliveryAr: input.deliveryAr ?? null,
      deliveryEn: input.deliveryEn ?? null,
      notesAr: input.notesAr ?? null,
      notesEn: input.notesEn ?? null,
      filePath: input.filePath ?? null,
    },
  });
  await logEvent({
    entityType: 'supply_request',
    entityId: req.id,
    clientId: req.clientId,
    code: 'BID_RECEIVED',
    titleAr: `استُلم عرض من المورد ${supplier.nameAr} بمبلغ ${fmtMoney(bid.amount)} ريال`,
    titleEn: `Bid received from supplier ${supplier.nameEn || supplier.nameAr} for SAR ${fmtMoney(bid.amount)}`,
    actor: 'admin',
    actorKind: 'admin',
  });
  return bid;
}

export async function selectBid(supplyRequestId: string, bidId: string, actor = 'admin') {
  const [req, bid] = await Promise.all([
    prisma.supplyRequest.findUniqueOrThrow({ where: { id: supplyRequestId } }),
    prisma.supplierBid.findUniqueOrThrow({ where: { id: bidId }, include: { supplier: true } }),
  ]);
  if (bid.supplyRequestId !== supplyRequestId) throw new Error('العرض لا يخص طلب التوريد هذا');

  await prisma.$transaction([
    prisma.supplierBid.updateMany({
      where: { supplyRequestId, id: { not: bidId } },
      data: { status: 'REJECTED' },
    }),
    prisma.supplierBid.update({ where: { id: bidId }, data: { status: 'SELECTED' } }),
    prisma.supplyRequest.update({
      where: { id: supplyRequestId },
      data: { selectedBidId: bidId, status: 'SELECTED' },
    }),
  ]);

  // في الوضع الثلاثي اسمُ المورد ومبلغُه حقٌّ للعميل يراه — تلك شفافية الاتفاقية.
  // وفي إعادة البيع هما تكلفتنا واسم من نشتري منه، ولا يخرجان. والحدثُ يُكتب
  // هنا بحسب الوضع لا في الصفحة التي تستدعيه: من نسي الوضع في نداءٍ آخر لا
  // يُسرّب ما لا يجوز.
  const resale = req.mode === 'RESALE';
  await logEvent({
    entityType: 'supply_request',
    entityId: supplyRequestId,
    clientId: req.clientId,
    code: 'BID_SELECTED',
    titleAr: resale
      ? `اختير مورد التنفيذ لطلب ${req.number} بتكلفة ${fmtMoney(bid.amount)} ريال — ${bid.supplier.nameAr}`
      : `اختير المورد ${bid.supplier.nameAr} بمبلغ ${fmtMoney(bid.amount)} ريال بعد مقارنة العروض`,
    titleEn: resale
      ? `Execution supplier selected for ${req.number} at cost SAR ${fmtMoney(bid.amount)} — ${bid.supplier.nameEn || bid.supplier.nameAr}`
      : `Supplier ${bid.supplier.nameEn || bid.supplier.nameAr} selected at SAR ${fmtMoney(bid.amount)} after bid comparison`,
    actor,
    actorKind: 'admin',
    clientVisible: !resale,
  });
  await audit({
    action: 'SUPPLY_BID_SELECTED',
    entityType: 'supply_request',
    entityId: supplyRequestId,
    actor,
    amount: bid.amount,
    payload: { bidId, supplierId: bid.supplierId },
  });

  return bid;
}

/**
 * اتفاقية التوريد الثلاثية: العميل × المورد × بزنس بارتنر كمنسّق.
 * تُنشأ كمستند من نوع SUPPLY_AGREEMENT ومسودة، وتوقَّع عبر DocuSign كباقي العقود.
 */
export async function createSupplyAgreement(supplyRequestId: string, actor = 'admin') {
  const req = await prisma.supplyRequest.findUniqueOrThrow({
    where: { id: supplyRequestId },
    include: { selectedBid: { include: { supplier: true } }, client: true, documents: true },
  });
  if (!req.selectedBid) throw new Error('اختر مورداً أولاً قبل إنشاء الاتفاقية');
  const already = req.documents.find((d) => d.type === DOC_TYPE.SUPPLY_AGREEMENT);
  if (already) return already;

  const bid = req.selectedBid;
  const supplier = bid.supplier;
  const coordination = round2(req.coordinationFee);
  const subtotal = round2(bid.amount + coordination);
  const vatAmount = round2(subtotal * VAT_RATE);

  const doc = await prisma.document.create({
    data: {
      type: DOC_TYPE.SUPPLY_AGREEMENT,
      number: await nextDocumentNumber('SUP'),
      status: DOC_STATUS.DRAFT,
      clientId: req.clientId,
      supplyRequestId: req.id,
      publicToken: publicToken(),
      titleAr: `اتفاقية توريد ثلاثية — ${req.titleAr}`,
      titleEn: `Tripartite Supply Agreement — ${req.titleEn}`,
      introAr: `اتفاقية توريد بين ${req.client.companyAr || req.client.nameAr} (العميل) و${supplier.nameAr} (المورد) وشركة بزنس بارتنر سلوشنز بصفتها المنسّق الذي يضبط نطاق العمل والمدفوعات والمستندات.`,
      introEn: `Supply agreement between ${req.client.companyEn || req.client.nameEn || req.client.nameAr} (the Client), ${supplier.nameEn || supplier.nameAr} (the Supplier), and Business Partner Solutions Company acting as the Coordinator governing scope, payments and documentation.`,
      notesAr: [
        req.scopeAr || '',
        '',
        `يودع العميل قيمة التوريد في محفظته لدى بزنس بارتنر، وتُصرف للمورد على دفعات مرتبطة بمراحل إنجاز يعتمدها المنسّق. كل حركة مالية تُسجَّل بإيصالها في سجل غير قابل للتعديل.`,
        `بيانات المورد: ${supplier.nameAr}${supplier.crNumber ? ` — السجل التجاري ${supplier.crNumber}` : ''}${supplier.iban ? ` — الآيبان ${supplier.iban}` : ''}.`,
      ]
        .filter(Boolean)
        .join('\n'),
      notesEn: [
        req.scopeEn || '',
        '',
        `The Client deposits the supply value into its wallet held with Business Partner, and disbursements are made to the Supplier in instalments linked to delivery milestones approved by the Coordinator. Every financial movement is recorded with its receipt in a tamper-evident log.`,
        `Supplier details: ${supplier.nameEn || supplier.nameAr}${supplier.crNumber ? ` — commercial registration ${supplier.crNumber}` : ''}${supplier.iban ? ` — IBAN ${supplier.iban}` : ''}.`,
      ]
        .filter(Boolean)
        .join('\n'),
      vatRate: VAT_RATE,
      subtotal,
      vatAmount,
      total: round2(subtotal + vatAmount),
      items: {
        create: [
          {
            code: 'SUP-GOODS',
            nameAr: `توريد وتنفيذ — ${req.titleAr}`,
            nameEn: `Supply and execution — ${req.titleEn}`,
            descAr: `المورد المختار: ${supplier.nameAr}. ${bid.notesAr || ''}`.trim(),
            descEn: `Selected supplier: ${supplier.nameEn || supplier.nameAr}. ${bid.notesEn || ''}`.trim(),
            qty: 1,
            unitPrice: bid.amount,
            lineTotal: bid.amount,
            unitAr: 'توريد',
            unitEn: 'supply',
            paymentTermsAr: 'إيداع كامل القيمة في محفظة العميل، ويُصرف للمورد على دفعات مرتبطة بمراحل إنجاز معتمدة',
            paymentTermsEn:
              'Full value deposited into the client wallet; disbursed to the supplier in instalments linked to approved delivery milestones',
            deliveryAr: bid.deliveryAr || 'حسب جدول المراحل المعتمد',
            deliveryEn: bid.deliveryEn || 'As per the approved milestone schedule',
            sortOrder: 0,
          },
          ...(coordination > 0
            ? [
                {
                  code: 'SUP-COORD',
                  nameAr: 'أتعاب تنسيق وإشراف — بزنس بارتنر',
                  nameEn: 'Coordination and supervision fee — Business Partner',
                  descAr:
                    'ضبط نطاق العمل، مقارنة عروض الموردين، إدارة المدفوعات المرحلية، وأرشفة المستندات ومحاضر التسليم.',
                  descEn:
                    'Scope control, supplier bid comparison, management of milestone payments, and archiving of documents and handover minutes.',
                  qty: 1,
                  unitPrice: coordination,
                  lineTotal: coordination,
                  unitAr: 'خدمة',
                  unitEn: 'service',
                  paymentTermsAr: 'كامل المبلغ مقدماً',
                  paymentTermsEn: 'Full amount in advance',
                  deliveryAr: 'طوال مدة التوريد',
                  deliveryEn: 'Throughout the supply period',
                  sortOrder: 1,
                },
              ]
            : []),
        ],
      },
    },
  });

  await prisma.supplyRequest.update({ where: { id: req.id }, data: { status: 'AGREEMENT' } });
  await logEvent({
    entityType: 'supply_request',
    entityId: req.id,
    clientId: req.clientId,
    code: 'SUPPLY_AGREEMENT_CREATED',
    titleAr: `أُنشئت اتفاقية التوريد الثلاثية ${doc.number} كمسودة بانتظار الاعتماد ثم التوقيع`,
    titleEn: `Tripartite supply agreement ${doc.number} created as a draft awaiting approval and signature`,
    actor,
    actorKind: 'admin',
  });

  return doc;
}

/** فاتورة إيداع قيمة التوريد في محفظة العميل. */
export async function createFundingInvoice(supplyRequestId: string, actor = 'admin') {
  const req = await prisma.supplyRequest.findUniqueOrThrow({
    where: { id: supplyRequestId },
    include: { selectedBid: true },
  });
  if (!req.selectedBid) throw new Error('اختر مورداً أولاً');
  const invoice = await createInvoice(
    {
      clientId: req.clientId,
      titleAr: `إيداع قيمة التوريد في المحفظة — ${req.titleAr} (${req.number})`,
      titleEn: `Supply value deposit into wallet — ${req.titleEn} (${req.number})`,
      amountExclVat: req.selectedBid.amount,
      isGovFeeDeposit: true, // إيداع لا إيراد — لا تُحتسب عليه ضريبة القيمة المضافة
      depositKind: 'SUPPLY',
    },
    actor,
  );
  await prisma.supplyRequest.update({ where: { id: req.id }, data: { status: 'FUNDED' } });
  return invoice;
}

export async function addMilestones(
  supplyRequestId: string,
  milestones: { titleAr: string; titleEn: string; amount: number }[],
) {
  const req = await prisma.supplyRequest.findUniqueOrThrow({ where: { id: supplyRequestId } });
  const created = await prisma.$transaction(
    milestones.map((m, i) =>
      prisma.milestone.create({
        data: {
          supplyRequestId,
          titleAr: m.titleAr,
          titleEn: m.titleEn,
          amount: round2(m.amount),
          sortOrder: i,
        },
      }),
    ),
  );
  await logEvent({
    entityType: 'supply_request',
    entityId: supplyRequestId,
    clientId: req.clientId,
    code: 'MILESTONES_SET',
    titleAr: `حُدّدت ${created.length} مرحلة إنجاز لطلب التوريد ${req.number}`,
    titleEn: `${created.length} delivery milestones set for supply request ${req.number}`,
    actor: 'admin',
    actorKind: 'admin',
  });
  return created;
}

/** اعتماد مرحلة إنجاز — خطوة إلزامية قبل أي صرف. */
export async function approveMilestone(milestoneId: string, actor: string) {
  const m = await prisma.milestone.findUniqueOrThrow({
    where: { id: milestoneId },
    include: { supplyRequest: true },
  });
  if (m.status !== 'PENDING') throw new Error(`المرحلة حالتها ${m.status} ولا يمكن اعتمادها`);
  const updated = await prisma.milestone.update({
    where: { id: milestoneId },
    data: { status: 'APPROVED', approvedAt: new Date(), approvedBy: actor },
  });
  await logEvent({
    entityType: 'supply_request',
    entityId: m.supplyRequestId,
    clientId: m.supplyRequest.clientId,
    code: 'MILESTONE_APPROVED',
    titleAr: `اعتُمدت مرحلة الإنجاز: ${m.titleAr} — ${fmtMoney(m.amount)} ريال`,
    titleEn: `Milestone approved: ${m.titleEn} — SAR ${fmtMoney(m.amount)}`,
    actor,
    actorKind: 'admin',
  });
  return updated;
}

/** الصرف للمورد من محفظة العميل — لا يتم إلا بعد اعتماد المرحلة. */
export async function payMilestone(milestoneId: string, actor: string, receiptPath?: string | null) {
  const m = await prisma.milestone.findUniqueOrThrow({
    where: { id: milestoneId },
    include: { supplyRequest: { include: { selectedBid: { include: { supplier: true } } } } },
  });
  if (m.status !== 'APPROVED') throw new Error('لا يُصرف إلا بعد اعتماد المرحلة');

  const supplier = m.supplyRequest.selectedBid?.supplier;
  const entry = await walletSpend({
    clientId: m.supplyRequest.clientId,
    kind: 'SUPPLIER_PAYOUT',
    amount: m.amount,
    descAr: `صرف للمورد ${supplier?.nameAr ?? ''} — مرحلة: ${m.titleAr} (${m.supplyRequest.number})`,
    descEn: `Payout to supplier ${supplier?.nameEn || supplier?.nameAr || ''} — milestone: ${m.titleEn} (${m.supplyRequest.number})`,
    milestoneId,
    receiptPath: receiptPath ?? null,
    actor,
  });

  const updated = await prisma.milestone.update({
    where: { id: milestoneId },
    data: { status: 'PAID', paidAt: new Date() },
  });

  const remaining = await prisma.milestone.count({
    where: { supplyRequestId: m.supplyRequestId, status: { not: 'PAID' } },
  });
  await prisma.supplyRequest.update({
    where: { id: m.supplyRequestId },
    data: { status: remaining === 0 ? 'COMPLETED' : 'IN_PROGRESS' },
  });

  return { milestone: updated, entry };
}
