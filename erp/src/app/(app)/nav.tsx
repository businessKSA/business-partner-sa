'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * القائمة الجانبية.
 *
 * البنود تُرشَّح بصلاحيات المستخدم: من لا يملك صلاحية الرواتب لا يرى بندها
 * أصلاً. إخفاءُ ما لا يُتاح ليس أماناً بذاته (الأمان في `requireAuth` على
 * الخادم) لكنه صدقٌ في الواجهة — قائمةٌ نصفُ بنودها تعطي «لا تملك صلاحية»
 * قائمةٌ تُتعب مستخدمها بلا فائدة.
 */
type Item = { href: string; label: string; icon: string; perm?: string };
type Group = { title: string; items: Item[] };

const GROUPS: Group[] = [
  {
    title: 'نظرة عامة',
    items: [{ href: '/dashboard', label: 'اللوحة الرئيسية', icon: '⌂' }],
  },
  {
    title: 'المحاسبة',
    items: [
      { href: '/accounting/accounts', label: 'شجرة الحسابات', icon: '⊞', perm: 'accounting.account.read' },
      { href: '/accounting/journal', label: 'قيود اليومية', icon: '≡', perm: 'accounting.journal.read' },
      { href: '/accounting/trial-balance', label: 'ميزان المراجعة', icon: '⚖', perm: 'accounting.report.read' },
      { href: '/accounting/pnl', label: 'قائمة الدخل', icon: '📈', perm: 'accounting.report.read' },
      { href: '/accounting/balance-sheet', label: 'المركز المالي', icon: '▣', perm: 'accounting.report.read' },
      { href: '/accounting/vat', label: 'إقرار ضريبة القيمة المضافة', icon: '٪', perm: 'accounting.vat.read' },
      { href: '/accounting/periods', label: 'الفترات المالية', icon: '⧗', perm: 'accounting.report.read' },
      { href: '/accounting/closing', label: 'الإقفال السنوي', icon: '🔒', perm: 'accounting.report.read' },
      { href: '/accounting/fx', label: 'العملات وفروق التقييم', icon: '💱', perm: 'accounting.report.read' },
    ],
  },
  {
    title: 'المبيعات',
    items: [
      { href: '/sales/invoices', label: 'فواتير المبيعات', icon: '🧾', perm: 'sales.invoice.read' },
      { href: '/sales/customers', label: 'العملاء', icon: '👤', perm: 'sales.partner.read' },
      { href: '/sales/aging', label: 'أعمار الذمم المدينة', icon: '⏱', perm: 'accounting.report.read' },
      { href: '/sales/zatca', label: 'الفوترة الإلكترونية', icon: '🔐', perm: 'sales.zatca.submit' },
    ],
  },
  {
    title: 'المشتريات والخزينة',
    items: [
      { href: '/purchasing/bills', label: 'فواتير الموردين', icon: '📄', perm: 'purchase.bill.read' },
      { href: '/purchasing/vendors', label: 'الموردون', icon: '🏢', perm: 'purchase.partner.read' },
      { href: '/treasury/payments', label: 'سندات القبض والصرف', icon: '💳', perm: 'treasury.payment.read' },
      { href: '/treasury/banks', label: 'الحسابات البنكية', icon: '🏦', perm: 'treasury.payment.read' },
      { href: '/treasury/reconciliation', label: 'التسوية البنكية', icon: '⇋', perm: 'treasury.statement.read' },
    ],
  },
  {
    title: 'المخزون',
    items: [
      { href: '/inventory/items', label: 'الأصناف', icon: '📦', perm: 'inventory.item.read' },
      { href: '/inventory/valuation', label: 'قيمة المخزون', icon: '💰', perm: 'inventory.item.read' },
      { href: '/inventory/moves', label: 'حركات المخزون', icon: '⇄', perm: 'inventory.move.read' },
    ],
  },
  {
    title: 'الأصول الثابتة',
    items: [
      { href: '/assets', label: 'سجل الأصول', icon: '🏗', perm: 'assets.asset.read' },
      { href: '/assets/depreciation', label: 'مسيّرات الاستهلاك', icon: '📉', perm: 'assets.asset.read' },
    ],
  },
  {
    title: 'الموارد البشرية',
    items: [
      { href: '/hr/employees', label: 'الموظفون', icon: '👥', perm: 'hr.employee.read' },
      { href: '/hr/payroll', label: 'مسيّر الرواتب', icon: '💵', perm: 'hr.payroll.read' },
      { href: '/hr/leaves', label: 'الإجازات', icon: '🌴', perm: 'hr.leave.read' },
      { href: '/hr/eosb', label: 'حاسبة نهاية الخدمة', icon: '🧮', perm: 'hr.employee.read' },
    ],
  },
  {
    title: 'المشاريع',
    items: [
      { href: '/projects', label: 'المشاريع وربحيتها', icon: '📁', perm: 'projects.project.read' },
      { href: '/projects/timesheets', label: 'ساعات العمل', icon: '🕐', perm: 'projects.timesheet.write' },
    ],
  },
  {
    title: 'الإدارة',
    items: [
      { href: '/admin/users', label: 'المستخدمون والأدوار', icon: '🔑', perm: 'admin.user.read' },
      { href: '/admin/settings', label: 'إعدادات المنشأة', icon: '⚙', perm: 'admin.settings.write' },
      { href: '/admin/audit', label: 'سجل التدقيق', icon: '🛡', perm: 'admin.audit.read' },
    ],
  },
];

function allowed(permissions: string[], perm?: string): boolean {
  if (!perm) return true;
  if (permissions.includes('*')) return true;
  if (permissions.includes(perm)) return true;
  return permissions.includes(`${perm.split('.')[0]}.*`);
}

const ALL_HREFS = GROUPS.flatMap((g) => g.items.map((i) => i.href));

/**
 * البند المضاء هو **أطول** بادئةٍ تطابق المسار.
 *
 * والطولُ هو المهم: `/assets` و`/assets/depreciation` كلاهما بادئةٌ للثاني،
 * فمطابقةُ البادئة وحدها تُضيء البندين معاً. ولهذا لا يحتاج أيُّ بندٍ إلى
 * استثناءٍ مكتوبٍ باسمه — تُضاف صفحةٌ فرعية فيعمل الأمر من تلقائه.
 */
function activeHref(pathname: string): string | undefined {
  return ALL_HREFS
    .filter((h) => pathname === h || pathname.startsWith(`${h}/`))
    .sort((a, b) => b.length - a.length)[0];
}

export function Nav({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
  const current = activeHref(pathname);

  return (
    <nav className="nav">
      {GROUPS.map((group) => {
        const items = group.items.filter((i) => allowed(permissions, i.perm));
        if (!items.length) return null;

        return (
          <div className="nav-group" key={group.title}>
            <h4>{group.title}</h4>
            {items.map((item) => {
              const active = item.href === current;
              return (
                <Link key={item.href} href={item.href} className={active ? 'active' : ''}>
                  <span className="ico">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
