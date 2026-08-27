/**
 * تجهيز منشأة جديدة.
 *
 * هذه هي الدالة التي تُشغَّل حين يشترك عميل. ما تُنشئه ليس صفّاً في جدول
 * المنشآت، بل منشأةً جاهزة للعمل من أول دقيقة: شجرة حسابات كاملة، سنة
 * مالية بفتراتها، رموز ضريبية، أدوار، مستودع، وحدات قياس، وحساب صندوق.
 * منشأةٌ تُسلَّم بلا هذا تعني عميلاً يفتح النظام فلا يجد ما يفعله.
 */
import { withoutTenant, type Tx } from './db.ts';
import { SAUDI_COA, flattenCoa } from './accounting/coa.ts';
import { SYSTEM_ROLES } from './rbac.ts';
import { createFiscalYear } from './accounting/periods.ts';

export type TenantInput = {
  slug: string;
  nameAr: string;
  nameEn?: string;
  crNumber?: string;
  vatNumber?: string;
  city?: string;
  street?: string;
  buildingNo?: string;
  district?: string;
  postalCode?: string;
  email?: string;
  phone?: string;
  fiscalYearStartMonth?: number;
};

/** وحدات القياس بمعيار UN/ECE Rec 20 — زاتكا تطلب رموزه في UBL. */
const UOMS = [
  ['PCE', 'قطعة', 'Piece'],
  ['EA', 'وحدة', 'Each'],
  ['HUR', 'ساعة', 'Hour'],
  ['DAY', 'يوم', 'Day'],
  ['MON', 'شهر', 'Month'],
  ['ANN', 'سنة', 'Year'],
  ['KGM', 'كيلوجرام', 'Kilogram'],
  ['MTR', 'متر', 'Metre'],
  ['MTK', 'متر مربع', 'Square metre'],
  ['LTR', 'لتر', 'Litre'],
  ['BX', 'صندوق', 'Box'],
  ['SET', 'طقم', 'Set'],
];

export async function provisionTenant(input: TenantInput, ownerUserId?: string) {
  // لا سياق منشأة بعد — نحن ننشئها الآن. هذا أحد ثلاثة مواضع مبرَّرة للتجاوز.
  return withoutTenant(`تجهيز منشأة جديدة: ${input.slug}`, async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        slug: input.slug,
        nameAr: input.nameAr,
        nameEn: input.nameEn ?? null,
        crNumber: input.crNumber ?? null,
        vatNumber: input.vatNumber ?? null,
        city: input.city ?? null,
        street: input.street ?? null,
        buildingNo: input.buildingNo ?? null,
        district: input.district ?? null,
        postalCode: input.postalCode ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        fiscalYearStartMonth: input.fiscalYearStartMonth ?? 1,
      },
    });

    await seedChartOfAccounts(tx, tenant.id);
    await seedTaxCodes(tx, tenant.id);
    await seedRoles(tx, tenant.id);
    await seedBaseData(tx, tenant.id);

    const year = new Date().getUTCFullYear();
    await createFiscalYear(tx, tenant.id, year, tenant.fiscalYearStartMonth);

    if (ownerUserId) {
      const owner = await tx.role.findFirstOrThrow({
        where: { tenantId: tenant.id, code: 'OWNER' },
      });
      await tx.membership.create({
        data: { userId: ownerUserId, tenantId: tenant.id, roleId: owner.id },
      });
    }

    return tenant;
  }, { timeout: 60_000 });
}

/** ينسخ الشجرة القياسية. الأب يُنشأ قبل ابنه لأن الترتيب في القائمة المسطّحة يضمنه. */
export async function seedChartOfAccounts(tx: Tx, tenantId: string) {
  const flat = flattenCoa(SAUDI_COA);
  const idByCode = new Map<string, string>();

  for (const node of flat) {
    const parentId = node.parentCode ? idByCode.get(node.parentCode) ?? null : null;
    const acc = await tx.account.create({
      data: {
        tenantId,
        code: node.code,
        nameAr: node.nameAr,
        nameEn: node.nameEn,
        type: node.type,
        subtype: node.subtype ?? null,
        parentId,
        isGroup: node.group ?? false,
        isSystem: node.system ?? false,
        allowManual: !(node.noManual ?? false),
      },
    });
    idByCode.set(node.code, acc.id);
  }

  return idByCode;
}

async function seedTaxCodes(tx: Tx, tenantId: string) {
  const out = await tx.account.findFirst({ where: { tenantId, subtype: 'VAT_OUTPUT' } });
  const inp = await tx.account.findFirst({ where: { tenantId, subtype: 'VAT_INPUT' } });

  const codes = [
    {
      code: 'S15', nameAr: 'ضريبة القيمة المضافة ١٥٪', nameEn: 'VAT 15%',
      rate: '0.15', kind: 'STANDARD', zatcaCategory: 'S', isDefault: true,
    },
    {
      code: 'Z0', nameAr: 'خاضع لنسبة الصفر', nameEn: 'Zero rated',
      rate: '0', kind: 'ZERO', zatcaCategory: 'Z',
      exemptionReasonCode: 'VATEX-SA-32',
      exemptionReasonAr: 'تصدير السلع من المملكة',
      exemptionReasonEn: 'Export of goods',
    },
    {
      code: 'E0', nameAr: 'معفى من الضريبة', nameEn: 'Exempt',
      rate: '0', kind: 'EXEMPT', zatcaCategory: 'E',
      exemptionReasonCode: 'VATEX-SA-29',
      exemptionReasonAr: 'الخدمات المالية',
      exemptionReasonEn: 'Financial services',
    },
    {
      code: 'O0', nameAr: 'خارج نطاق الضريبة', nameEn: 'Out of scope',
      rate: '0', kind: 'OUT_OF_SCOPE', zatcaCategory: 'O',
      exemptionReasonCode: 'VATEX-SA-OOS',
      exemptionReasonAr: 'خارج نطاق ضريبة القيمة المضافة',
      exemptionReasonEn: 'Out of scope of VAT',
    },
    {
      code: 'RC15', nameAr: 'احتساب عكسي ١٥٪', nameEn: 'Reverse charge 15%',
      rate: '0.15', kind: 'REVERSE_CHARGE', zatcaCategory: 'S',
    },
  ];

  for (const c of codes) {
    await tx.taxCode.create({
      data: {
        tenantId,
        ...c,
        outputAccountId: out?.id ?? null,
        inputAccountId: inp?.id ?? null,
      },
    });
  }
}

async function seedRoles(tx: Tx, tenantId: string) {
  for (const r of SYSTEM_ROLES) {
    await tx.role.create({
      data: {
        tenantId,
        code: r.code,
        nameAr: r.nameAr,
        nameEn: r.nameEn,
        isSystem: true,
        permissions: r.permissions,
      },
    });
  }
}

async function seedBaseData(tx: Tx, tenantId: string) {
  for (const [code, nameAr, nameEn] of UOMS) {
    await tx.uom.create({ data: { tenantId, code, nameAr, nameEn } });
  }

  await tx.warehouse.create({
    data: { tenantId, code: 'MAIN', nameAr: 'المستودع الرئيسي', nameEn: 'Main Warehouse' },
  });

  // حساب صندوق نقدي جاهز — بلا حساب خزينة لا يمكن تسجيل أول قبض.
  const cash = await tx.account.findFirst({ where: { tenantId, subtype: 'CASH' } });
  if (cash) {
    await tx.bankAccount.create({
      data: {
        tenantId, nameAr: 'الصندوق النقدي', nameEn: 'Petty Cash',
        accountId: cash.id, kind: 'CASH',
      },
    });
  }

  const leaveTypes = [
    ['ANNUAL', 'إجازة سنوية', 'Annual Leave', true, 21, true],
    ['SICK', 'إجازة مرضية', 'Sick Leave', true, 30, false],
    ['UNPAID', 'إجازة بدون راتب', 'Unpaid Leave', false, 0, false],
    ['MATERNITY', 'إجازة وضع', 'Maternity Leave', true, 70, false],
    ['MARRIAGE', 'إجازة زواج', 'Marriage Leave', true, 5, false],
    ['BEREAVEMENT', 'إجازة وفاة', 'Bereavement Leave', true, 5, false],
  ] as const;

  for (const [code, nameAr, nameEn, paid, annualDays, deductsAnnual] of leaveTypes) {
    await tx.leaveType.create({
      data: { tenantId, code, nameAr, nameEn, paid, annualDays, deductsAnnual },
    });
  }
}

/**
 * حذف منشأة وكل بياناتها.
 *
 * عمليةٌ حقيقية في منتج يُباع: عميل ينهي اشتراكه، أو يطلب محو بياناته
 * استناداً إلى نظام حماية البيانات الشخصية. لكنها لا تُترك لتتالي الحذف
 * التلقائي (cascade) لسببين:
 *
 *  ١. سطور الدفتر تمنع حذف حساباتها بقيدٍ مقصود — وهو ما يحمي الأستاذ من
 *     أن يتبخّر لأن أحدهم حذف حساباً. إضعاف القيد ليرتاح الحذف يفتح باباً
 *     أخطر بكثير مما يغلق.
 *  ٢. الترتيب هنا موثَّق ومقروء، فمن يضيف جدولاً جديداً يرى أين يضعه بدل
 *     أن يكتشف الخلل في أول محاولة حذف بعد سنة.
 *
 * الترتيب من الورقة إلى الجذر: الأبناء قبل آبائهم دائماً.
 */
export async function purgeTenant(tenantId: string) {
  return withoutTenant(`حذف منشأة نهائياً: ${tenantId}`, async (tx) => {
    const w = { tenantId };

    // المدفوعات وتخصيصاتها
    await tx.paymentAllocation.deleteMany({ where: w });
    await tx.payment.deleteMany({ where: w });

    // حركات المخزون تشير إلى الفواتير والاستلامات، فتُحذف قبلهما
    await tx.stockMove.deleteMany({ where: w });
    await tx.stockLevel.deleteMany({ where: w });

    // المبيعات
    await tx.zatcaDocument.deleteMany({ where: w });
    await tx.salesInvoiceLine.deleteMany({ where: w });
    await tx.salesInvoice.deleteMany({ where: w });

    // المشتريات
    await tx.goodsReceiptLine.deleteMany({ where: w });
    await tx.goodsReceipt.deleteMany({ where: w });
    await tx.vendorBillLine.deleteMany({ where: w });
    await tx.vendorBill.deleteMany({ where: w });
    await tx.purchaseOrderLine.deleteMany({ where: w });
    await tx.purchaseOrder.deleteMany({ where: w });

    // المشاريع والوقت
    await tx.timesheet.deleteMany({ where: w });
    // شجرة المهام: نفكّ الارتباط بالأب قبل الحذف
    await tx.projectTask.updateMany({ where: w, data: { parentId: null } });
    await tx.projectTask.deleteMany({ where: w });

    // الرواتب والموارد البشرية
    await tx.payslip.deleteMany({ where: w });
    await tx.payrollRun.deleteMany({ where: w });
    await tx.leaveRequest.deleteMany({ where: w });
    await tx.attendance.deleteMany({ where: w });

    // الدفتر — قبل الحسابات التي تشير إليها سطوره
    await tx.journalLine.deleteMany({ where: w });
    await tx.journalEntry.updateMany({ where: w, data: { reversalOfId: null } });
    await tx.journalEntry.deleteMany({ where: w });

    await tx.fiscalPeriod.deleteMany({ where: w });
    await tx.fiscalYear.deleteMany({ where: w });

    // الأصناف وما يشير إليها
    await tx.item.deleteMany({ where: w });
    await tx.itemCategory.updateMany({ where: w, data: { parentId: null } });
    await tx.itemCategory.deleteMany({ where: w });
    await tx.warehouse.deleteMany({ where: w });
    await tx.uom.deleteMany({ where: w });

    // الموظفون بعد كل ما يشير إليهم
    await tx.project.deleteMany({ where: w });
    await tx.employee.deleteMany({ where: w });
    await tx.department.updateMany({ where: w, data: { parentId: null } });
    await tx.department.deleteMany({ where: w });
    await tx.position.deleteMany({ where: w });
    await tx.leaveType.deleteMany({ where: w });

    await tx.partner.deleteMany({ where: w });
    await tx.bankAccount.deleteMany({ where: w });
    await tx.taxCode.deleteMany({ where: w });
    await tx.costCenter.updateMany({ where: w, data: { parentId: null } });
    await tx.costCenter.deleteMany({ where: w });

    // شجرة الحسابات: نفكّ الأبوّة ثم نحذف الكل دفعة واحدة
    await tx.account.updateMany({ where: w, data: { parentId: null } });
    await tx.account.deleteMany({ where: w });

    // الهوية والمنصة
    await tx.membership.deleteMany({ where: w });
    await tx.role.deleteMany({ where: w });
    await tx.subscription.deleteMany({ where: w });
    await tx.zatcaConfig.deleteMany({ where: w });
    await tx.auditLog.deleteMany({ where: w });
    await tx.numberSeries.deleteMany({ where: w });
    await tx.exchangeRate.deleteMany({ where: w });
    await tx.session.deleteMany({ where: { tenantId } });

    await tx.tenant.delete({ where: { id: tenantId } });
  }, { timeout: 120_000 });
}

/** يحذف منشأة بالمعرّف المختصر إن وُجدت — للاختبارات والبذور. */
export async function purgeTenantBySlug(slug: string) {
  const t = await withoutTenant(`بحث عن منشأة للحذف: ${slug}`, (tx) =>
    tx.tenant.findUnique({ where: { slug }, select: { id: true } }),
  );
  if (t) await purgeTenant(t.id);
}
