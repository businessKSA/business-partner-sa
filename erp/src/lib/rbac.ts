/**
 * الصلاحيات.
 *
 * الرمز على صيغة `module.entity.action` ليُقرأ ويُرشَّح ويُمنح بالنجمة:
 * `sales.*` تعني كل صلاحيات المبيعات. النجمة تُوسَّع عند الفحص لا عند
 * التخزين، فإضافة صلاحية جديدة إلى موديول تصل تلقائياً لمن يملك نجمته.
 *
 * الفصل المقصود بين الإنشاء والترحيل والاعتماد ليس تعقيداً إدارياً: هو
 * ما يمنع أن يُنشئ شخصٌ واحدٌ فاتورةً ويرحّلها ويقبض قيمتها بلا عينٍ ثانية.
 */

import { PermissionError } from './errors.ts';

export const PERMISSIONS = {
  // ── المحاسبة
  'accounting.account.read': { ar: 'عرض شجرة الحسابات', en: 'View chart of accounts' },
  'accounting.account.write': { ar: 'تعديل شجرة الحسابات', en: 'Edit chart of accounts' },
  'accounting.journal.read': { ar: 'عرض القيود', en: 'View journal entries' },
  'accounting.journal.create': { ar: 'إنشاء قيد', en: 'Create journal entry' },
  'accounting.journal.post': { ar: 'ترحيل قيد', en: 'Post journal entry' },
  'accounting.journal.reverse': { ar: 'عكس قيد', en: 'Reverse journal entry' },
  'accounting.period.close': { ar: 'قفل وفتح الفترات', en: 'Close/reopen periods' },
  'accounting.report.read': { ar: 'عرض التقارير المالية', en: 'View financial reports' },
  'accounting.vat.read': { ar: 'عرض إقرار ضريبة القيمة المضافة', en: 'View VAT return' },

  // ── المبيعات
  'sales.partner.read': { ar: 'عرض العملاء', en: 'View customers' },
  'sales.partner.write': { ar: 'إضافة وتعديل العملاء', en: 'Manage customers' },
  'sales.invoice.read': { ar: 'عرض فواتير المبيعات', en: 'View sales invoices' },
  'sales.invoice.create': { ar: 'إنشاء فاتورة مبيعات', en: 'Create sales invoice' },
  'sales.invoice.post': { ar: 'ترحيل فاتورة مبيعات', en: 'Post sales invoice' },
  'sales.invoice.cancel': { ar: 'إلغاء فاتورة مبيعات', en: 'Cancel sales invoice' },
  'sales.zatca.submit': { ar: 'إرسال الفواتير لهيئة الزكاة والضريبة', en: 'Submit invoices to ZATCA' },

  // ── المشتريات
  'purchase.partner.read': { ar: 'عرض الموردين', en: 'View vendors' },
  'purchase.partner.write': { ar: 'إضافة وتعديل الموردين', en: 'Manage vendors' },
  'purchase.order.read': { ar: 'عرض أوامر الشراء', en: 'View purchase orders' },
  'purchase.order.write': { ar: 'إنشاء وتعديل أوامر الشراء', en: 'Manage purchase orders' },
  'purchase.order.approve': { ar: 'اعتماد أمر شراء', en: 'Approve purchase order' },
  'purchase.bill.read': { ar: 'عرض فواتير الموردين', en: 'View vendor bills' },
  'purchase.bill.write': { ar: 'إدخال فاتورة مورّد', en: 'Enter vendor bill' },
  'purchase.bill.post': { ar: 'ترحيل فاتورة مورّد', en: 'Post vendor bill' },
  'purchase.receipt.write': { ar: 'استلام بضاعة', en: 'Record goods receipt' },

  // ── الخزينة
  'treasury.payment.read': { ar: 'عرض السندات', en: 'View payments' },
  'treasury.payment.create': { ar: 'إنشاء سند قبض أو صرف', en: 'Create payment' },
  'treasury.payment.post': { ar: 'ترحيل سند', en: 'Post payment' },
  'treasury.bank.write': { ar: 'إدارة الحسابات البنكية', en: 'Manage bank accounts' },

  // ── المخزون
  'inventory.item.read': { ar: 'عرض الأصناف', en: 'View items' },
  'inventory.item.write': { ar: 'إضافة وتعديل الأصناف', en: 'Manage items' },
  'inventory.move.read': { ar: 'عرض حركات المخزون', en: 'View stock moves' },
  'inventory.move.write': { ar: 'تسوية وتحويل المخزون', en: 'Adjust/transfer stock' },
  'inventory.warehouse.write': { ar: 'إدارة المستودعات', en: 'Manage warehouses' },

  // ── الموارد البشرية
  'hr.employee.read': { ar: 'عرض الموظفين', en: 'View employees' },
  'hr.employee.write': { ar: 'إضافة وتعديل الموظفين', en: 'Manage employees' },
  'hr.leave.read': { ar: 'عرض الإجازات', en: 'View leave requests' },
  'hr.leave.approve': { ar: 'اعتماد الإجازات', en: 'Approve leave' },
  'hr.attendance.write': { ar: 'تسجيل الحضور', en: 'Record attendance' },
  'hr.payroll.read': { ar: 'عرض الرواتب', en: 'View payroll' },
  'hr.payroll.run': { ar: 'تشغيل مسيّر الرواتب', en: 'Run payroll' },
  'hr.payroll.post': { ar: 'ترحيل مسيّر الرواتب', en: 'Post payroll' },

  // ── المشاريع
  'projects.project.read': { ar: 'عرض المشاريع', en: 'View projects' },
  'projects.project.write': { ar: 'إدارة المشاريع', en: 'Manage projects' },
  'projects.task.write': { ar: 'إدارة المهام', en: 'Manage tasks' },
  'projects.timesheet.write': { ar: 'تسجيل ساعات العمل', en: 'Log time' },
  'projects.timesheet.approve': { ar: 'اعتماد ساعات العمل', en: 'Approve timesheets' },

  // ── الإدارة
  'admin.user.read': { ar: 'عرض المستخدمين', en: 'View users' },
  'admin.user.write': { ar: 'دعوة وتعطيل المستخدمين', en: 'Manage users' },
  'admin.role.write': { ar: 'إدارة الأدوار والصلاحيات', en: 'Manage roles' },
  'admin.settings.write': { ar: 'تعديل إعدادات المنشأة', en: 'Manage settings' },
  'admin.audit.read': { ar: 'عرض سجل التدقيق', en: 'View audit log' },
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/**
 * هل يملك صاحبُ هذه الصلاحيات الصلاحيةَ المطلوبة؟
 * يدعم `*` (كل شيء) و`sales.*` (كل موديول المبيعات).
 */
export function can(granted: string[], required: Permission | string): boolean {
  if (granted.includes('*')) return true;
  if (granted.includes(required)) return true;
  const module = required.split('.')[0];
  return granted.includes(`${module}.*`);
}

export function requirePermission(granted: string[], required: Permission | string): void {
  if (!can(granted, required)) {
    const label = (PERMISSIONS as Record<string, { ar: string }>)[required]?.ar ?? required;
    throw new PermissionError(label);
  }
}

/** الأدوار الجاهزة لكل منشأة جديدة. تُنسخ ثم تملكها المنشأة وتعدّلها. */
export const SYSTEM_ROLES: {
  code: string; nameAr: string; nameEn: string; permissions: string[];
}[] = [
  {
    code: 'OWNER', nameAr: 'مالك المنشأة', nameEn: 'Owner',
    permissions: ['*'],
  },
  {
    code: 'ACCOUNTANT', nameAr: 'محاسب', nameEn: 'Accountant',
    permissions: ['accounting.*', 'sales.*', 'purchase.*', 'treasury.*', 'inventory.item.read', 'inventory.move.read', 'hr.payroll.read', 'projects.project.read', 'admin.audit.read'],
  },
  {
    code: 'SALES', nameAr: 'موظف مبيعات', nameEn: 'Sales',
    permissions: ['sales.partner.read', 'sales.partner.write', 'sales.invoice.read', 'sales.invoice.create', 'inventory.item.read', 'projects.project.read', 'accounting.report.read'],
  },
  {
    code: 'HR', nameAr: 'موارد بشرية', nameEn: 'HR',
    permissions: ['hr.*', 'projects.project.read', 'projects.timesheet.approve'],
  },
  {
    code: 'WAREHOUSE', nameAr: 'أمين مستودع', nameEn: 'Warehouse Keeper',
    permissions: ['inventory.*', 'purchase.receipt.write', 'purchase.order.read'],
  },
  {
    code: 'VIEWER', nameAr: 'مطّلع', nameEn: 'Viewer',
    permissions: ALL_PERMISSIONS.filter((p) => p.endsWith('.read')),
  },
];
