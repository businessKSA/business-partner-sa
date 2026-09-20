'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/portal', label: 'الرئيسية' },
  { href: '/portal/services', label: 'الخدمات' },
  { href: '/portal/quotes', label: 'عروض الأسعار' },
  { href: '/portal/contracts', label: 'العقود' },
  { href: '/portal/invoices', label: 'الفواتير' },
  { href: '/portal/profile', label: 'بيانات منشأتي' },
];

/** شريط جانبي للبوابة — يتحول إلى شريط أفقي على الشاشات الضيقة. */
export default function PortalNav() {
  const path = usePathname();
  return (
    <nav className="portal-nav no-print" aria-label="أقسام البوابة">
      {LINKS.map((l) => {
        const active = l.href === '/portal' ? path === '/portal' : path.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} aria-current={active ? 'page' : undefined}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
