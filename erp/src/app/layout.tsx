import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'نظام تخطيط موارد المؤسسات — بزنس بارتنر',
  description: 'نظام محاسبي وإداري متكامل، عربي أولاً، متوافق مع هيئة الزكاة والضريبة والدخل',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // الاتجاه في الجذر لا في صفحةٍ صفحة: العربية أصل هذا النظام لا ترجمةٌ
  // تُضاف عليه.
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
