import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'عروض الأسعار والعقود — بزنس بارتنر سلوشنز',
  description: 'نظام إدارة عروض الأسعار والعقود لشركة بزنس بارتنر سلوشنز',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        {/* خط Tajawal مستضاف محلياً — لا اعتماد على الشبكة عند توليد الـPDF */}
        <link rel="stylesheet" href="/fonts/tajawal.css" />
      </head>
      <body dir="rtl">{children}</body>
    </html>
  );
}
