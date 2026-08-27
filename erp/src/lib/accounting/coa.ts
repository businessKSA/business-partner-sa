/**
 * شجرة الحسابات الافتراضية للمنشأة السعودية.
 *
 * تُنسخ لكل منشأة عند إنشائها، ثم تملكها المنشأة وتعدّلها كما تشاء. لماذا
 * نسخة لا مرجع مشترك؟ لأن شركة مقاولات تحتاج حسابات مشاريع لا يحتاجها
 * مكتب استشارات، وأي شجرة مشتركة إمّا أن تتضخّم لترضي الجميع أو تُقيّد
 * الجميع.
 *
 * الحسابات ذات `system: true` يعتمد عليها الترحيل التلقائي (الذمم، ضريبة
 * المخرجات، تكلفة البضاعة...) فلا تُحذف؛ ويُتعرَّف عليها بـ `subtype` لا
 * بالرمز، حتى تستطيع المنشأة إعادة ترقيم شجرتها دون كسر المحرّك.
 */
import type { AccountType } from '@prisma/client';

export type CoaNode = {
  code: string;
  nameAr: string;
  nameEn: string;
  type: AccountType;
  /** يجمع أبناءه ولا يقبل قيداً */
  group?: boolean;
  /** الدور الوظيفي — به يعثر محرّك الترحيل على الحساب */
  subtype?: string;
  /** لا يُحذف ولا يُقفل: يعتمد عليه الترحيل التلقائي */
  system?: boolean;
  /** لا يقبل قيداً يدوياً من المستخدم (يُرحَّل عليه آلياً فقط) */
  noManual?: boolean;
  children?: CoaNode[];
};

export const SAUDI_COA: CoaNode[] = [
  {
    code: '1', nameAr: 'الأصول', nameEn: 'Assets', type: 'ASSET', group: true,
    children: [
      {
        code: '11', nameAr: 'الأصول المتداولة', nameEn: 'Current Assets', type: 'ASSET', group: true,
        children: [
          { code: '1101', nameAr: 'النقد في الصندوق', nameEn: 'Cash on Hand', type: 'ASSET', subtype: 'CASH', system: true },
          { code: '1102', nameAr: 'النقد لدى البنوك', nameEn: 'Cash at Banks', type: 'ASSET', subtype: 'BANK', system: true },
          { code: '1110', nameAr: 'الذمم المدينة — العملاء', nameEn: 'Accounts Receivable', type: 'ASSET', subtype: 'RECEIVABLE', system: true, noManual: true },
          { code: '1115', nameAr: 'مخصص الديون المشكوك في تحصيلها', nameEn: 'Allowance for Doubtful Debts', type: 'ASSET', subtype: 'ALLOWANCE' },
          { code: '1120', nameAr: 'أوراق القبض', nameEn: 'Notes Receivable', type: 'ASSET' },
          { code: '1130', nameAr: 'المخزون', nameEn: 'Inventory', type: 'ASSET', subtype: 'INVENTORY', system: true, noManual: true },
          { code: '1140', nameAr: 'مصروفات مدفوعة مقدماً', nameEn: 'Prepaid Expenses', type: 'ASSET', subtype: 'PREPAID' },
          { code: '1150', nameAr: 'ضريبة القيمة المضافة — المدخلات', nameEn: 'VAT Input', type: 'ASSET', subtype: 'VAT_INPUT', system: true, noManual: true },
          { code: '1160', nameAr: 'عهد وسلف الموظفين', nameEn: 'Employee Advances', type: 'ASSET', subtype: 'EMPLOYEE_ADVANCE' },
          { code: '1170', nameAr: 'أرصدة مدينة أخرى', nameEn: 'Other Receivables', type: 'ASSET' },
        ],
      },
      {
        code: '12', nameAr: 'الأصول غير المتداولة', nameEn: 'Non-Current Assets', type: 'ASSET', group: true,
        children: [
          { code: '1201', nameAr: 'الأراضي', nameEn: 'Land', type: 'ASSET', subtype: 'FIXED_ASSET' },
          { code: '1202', nameAr: 'المباني', nameEn: 'Buildings', type: 'ASSET', subtype: 'FIXED_ASSET' },
          { code: '1203', nameAr: 'الآلات والمعدات', nameEn: 'Machinery & Equipment', type: 'ASSET', subtype: 'FIXED_ASSET' },
          { code: '1204', nameAr: 'الأثاث والتجهيزات', nameEn: 'Furniture & Fixtures', type: 'ASSET', subtype: 'FIXED_ASSET' },
          { code: '1205', nameAr: 'السيارات', nameEn: 'Vehicles', type: 'ASSET', subtype: 'FIXED_ASSET' },
          { code: '1206', nameAr: 'أجهزة الحاسب والبرمجيات', nameEn: 'Computers & Software', type: 'ASSET', subtype: 'FIXED_ASSET' },
          { code: '1210', nameAr: 'مجمَّع الإهلاك', nameEn: 'Accumulated Depreciation', type: 'ASSET', subtype: 'ACCUM_DEPRECIATION' },
          { code: '1220', nameAr: 'أصول غير ملموسة', nameEn: 'Intangible Assets', type: 'ASSET' },
        ],
      },
    ],
  },
  {
    code: '2', nameAr: 'الخصوم', nameEn: 'Liabilities', type: 'LIABILITY', group: true,
    children: [
      {
        code: '21', nameAr: 'الخصوم المتداولة', nameEn: 'Current Liabilities', type: 'LIABILITY', group: true,
        children: [
          { code: '2101', nameAr: 'الذمم الدائنة — الموردون', nameEn: 'Accounts Payable', type: 'LIABILITY', subtype: 'PAYABLE', system: true, noManual: true },
          { code: '2110', nameAr: 'أوراق الدفع', nameEn: 'Notes Payable', type: 'LIABILITY' },
          { code: '2120', nameAr: 'مصروفات مستحقة', nameEn: 'Accrued Expenses', type: 'LIABILITY', subtype: 'ACCRUAL' },
          { code: '2125', nameAr: 'رواتب مستحقة', nameEn: 'Salaries Payable', type: 'LIABILITY', subtype: 'SALARY_PAYABLE', system: true },
          { code: '2130', nameAr: 'التأمينات الاجتماعية المستحقة', nameEn: 'GOSI Payable', type: 'LIABILITY', subtype: 'GOSI_PAYABLE', system: true },
          { code: '2140', nameAr: 'ضريبة القيمة المضافة — المخرجات', nameEn: 'VAT Output', type: 'LIABILITY', subtype: 'VAT_OUTPUT', system: true, noManual: true },
          { code: '2145', nameAr: 'ضريبة القيمة المضافة المستحقة للهيئة', nameEn: 'VAT Payable to ZATCA', type: 'LIABILITY', subtype: 'VAT_PAYABLE', system: true },
          { code: '2150', nameAr: 'مخصص الزكاة', nameEn: 'Zakat Provision', type: 'LIABILITY', subtype: 'ZAKAT' },
          { code: '2160', nameAr: 'دفعات مقدمة من العملاء', nameEn: 'Customer Advances', type: 'LIABILITY', subtype: 'CUSTOMER_ADVANCE', system: true },
          { code: '2170', nameAr: 'بضاعة مستلمة لم تُفوتر', nameEn: 'Goods Received Not Invoiced', type: 'LIABILITY', subtype: 'GRNI', system: true, noManual: true },
        ],
      },
      {
        code: '22', nameAr: 'الخصوم غير المتداولة', nameEn: 'Non-Current Liabilities', type: 'LIABILITY', group: true,
        children: [
          { code: '2201', nameAr: 'قروض طويلة الأجل', nameEn: 'Long-term Loans', type: 'LIABILITY' },
          { code: '2210', nameAr: 'مخصص مكافأة نهاية الخدمة', nameEn: 'End-of-Service Benefits Provision', type: 'LIABILITY', subtype: 'EOSB_PROVISION', system: true },
        ],
      },
    ],
  },
  {
    code: '3', nameAr: 'حقوق الملكية', nameEn: 'Equity', type: 'EQUITY', group: true,
    children: [
      { code: '3101', nameAr: 'رأس المال', nameEn: 'Share Capital', type: 'EQUITY', subtype: 'CAPITAL' },
      { code: '3110', nameAr: 'الاحتياطي النظامي', nameEn: 'Statutory Reserve', type: 'EQUITY' },
      { code: '3120', nameAr: 'الأرباح المُبقاة', nameEn: 'Retained Earnings', type: 'EQUITY', subtype: 'RETAINED_EARNINGS', system: true },
      { code: '3140', nameAr: 'مسحوبات الشركاء', nameEn: 'Owner Drawings', type: 'EQUITY', subtype: 'DRAWINGS' },
    ],
  },
  {
    code: '4', nameAr: 'الإيرادات', nameEn: 'Revenue', type: 'REVENUE', group: true,
    children: [
      { code: '4101', nameAr: 'إيرادات المبيعات', nameEn: 'Sales Revenue', type: 'REVENUE', subtype: 'SALES', system: true },
      { code: '4110', nameAr: 'إيرادات الخدمات', nameEn: 'Service Revenue', type: 'REVENUE', subtype: 'SERVICE_REVENUE', system: true },
      { code: '4120', nameAr: 'مردودات ومسموحات المبيعات', nameEn: 'Sales Returns & Allowances', type: 'REVENUE', subtype: 'SALES_RETURNS' },
      { code: '4130', nameAr: 'خصم مكتسب', nameEn: 'Purchase Discounts', type: 'REVENUE' },
      { code: '4190', nameAr: 'إيرادات أخرى', nameEn: 'Other Income', type: 'REVENUE', subtype: 'OTHER_INCOME' },
    ],
  },
  {
    code: '5', nameAr: 'المصروفات', nameEn: 'Expenses', type: 'EXPENSE', group: true,
    children: [
      {
        code: '51', nameAr: 'تكلفة الإيرادات', nameEn: 'Cost of Revenue', type: 'EXPENSE', group: true,
        children: [
          { code: '5101', nameAr: 'تكلفة البضاعة المباعة', nameEn: 'Cost of Goods Sold', type: 'EXPENSE', subtype: 'COGS', system: true, noManual: true },
          { code: '5110', nameAr: 'تكلفة الخدمات المقدَّمة', nameEn: 'Cost of Services', type: 'EXPENSE', subtype: 'COST_OF_SERVICE', system: true },
          { code: '5120', nameAr: 'رسوم حكومية مباشرة', nameEn: 'Direct Government Fees', type: 'EXPENSE', subtype: 'GOV_FEES' },
        ],
      },
      {
        code: '52', nameAr: 'المصروفات التشغيلية والإدارية', nameEn: 'Operating & Admin Expenses', type: 'EXPENSE', group: true,
        children: [
          { code: '5201', nameAr: 'الرواتب والأجور', nameEn: 'Salaries & Wages', type: 'EXPENSE', subtype: 'PAYROLL_BASIC', system: true },
          { code: '5202', nameAr: 'البدلات والمزايا', nameEn: 'Allowances & Benefits', type: 'EXPENSE', subtype: 'PAYROLL_ALLOWANCE', system: true },
          { code: '5203', nameAr: 'حصة صاحب العمل في التأمينات', nameEn: 'Employer GOSI Contribution', type: 'EXPENSE', subtype: 'GOSI_EXPENSE', system: true },
          { code: '5204', nameAr: 'مكافأة نهاية الخدمة', nameEn: 'End-of-Service Benefits', type: 'EXPENSE', subtype: 'EOSB_EXPENSE', system: true },
          { code: '5210', nameAr: 'الإيجارات', nameEn: 'Rent', type: 'EXPENSE', subtype: 'OPERATING' },
          { code: '5215', nameAr: 'الكهرباء والمياه', nameEn: 'Utilities', type: 'EXPENSE', subtype: 'OPERATING' },
          { code: '5220', nameAr: 'الاتصالات والإنترنت', nameEn: 'Telecom & Internet', type: 'EXPENSE', subtype: 'OPERATING' },
          { code: '5225', nameAr: 'رسوم ومصروفات حكومية', nameEn: 'Government Fees', type: 'EXPENSE', subtype: 'OPERATING' },
          { code: '5230', nameAr: 'الصيانة والإصلاح', nameEn: 'Repairs & Maintenance', type: 'EXPENSE', subtype: 'OPERATING' },
          { code: '5235', nameAr: 'القرطاسية والمطبوعات', nameEn: 'Office Supplies', type: 'EXPENSE', subtype: 'OPERATING' },
          { code: '5240', nameAr: 'الدعاية والتسويق', nameEn: 'Marketing & Advertising', type: 'EXPENSE', subtype: 'OPERATING' },
          { code: '5245', nameAr: 'الأتعاب المهنية والاستشارات', nameEn: 'Professional Fees', type: 'EXPENSE', subtype: 'OPERATING' },
          { code: '5250', nameAr: 'السفر والانتقالات', nameEn: 'Travel & Transportation', type: 'EXPENSE', subtype: 'OPERATING' },
          { code: '5260', nameAr: 'الاشتراكات والبرمجيات', nameEn: 'Subscriptions & Software', type: 'EXPENSE', subtype: 'OPERATING' },
          { code: '5270', nameAr: 'الإهلاك', nameEn: 'Depreciation', type: 'EXPENSE', subtype: 'DEPRECIATION' },
          { code: '5280', nameAr: 'المصروفات البنكية', nameEn: 'Bank Charges', type: 'EXPENSE', subtype: 'BANK_CHARGES', system: true },
          { code: '5285', nameAr: 'فروق العملة', nameEn: 'Foreign Exchange Differences', type: 'EXPENSE', subtype: 'FX_DIFFERENCE', system: true },
          { code: '5290', nameAr: 'مصروفات أخرى', nameEn: 'Other Expenses', type: 'EXPENSE', subtype: 'OPERATING' },
        ],
      },
    ],
  },
];

/** يفرد الشجرة إلى قائمة مسطّحة مع مرجع الأب — للإدراج في القاعدة. */
export function flattenCoa(
  nodes: CoaNode[] = SAUDI_COA,
  parentCode: string | null = null,
  out: (CoaNode & { parentCode: string | null })[] = [],
) {
  for (const n of nodes) {
    out.push({ ...n, parentCode });
    if (n.children) flattenCoa(n.children, n.code, out);
  }
  return out;
}
