import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentSession, signOut } from '@/lib/auth.ts';

/**
 * لوحة المنصة — منفصلة عن لوحة المنشأة بهيكلها وبلونها.
 *
 * الفصل البصري مقصود: من يدير عشرات المنشآت يجب أن يعرف من النظرة الأولى
 * أنه ليس داخل دفاتر أحدها.
 */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await currentSession();
  if (!session) redirect('/login');
  if (!session.isPlatformAdmin) redirect('/dashboard');

  async function doSignOut() {
    'use server';
    await signOut();
    redirect('/login');
  }

  return (
    <div className="shell">
      <aside className="sidebar" style={{ background: '#0f1720' }}>
        <div className="sidebar-brand" style={{ borderColor: '#1e2936' }}>
          <div className="mark" style={{ color: '#7dd3a8' }}>لوحة المنصة</div>
          <div className="tenant" style={{ color: '#8a949e' }}>إدارة اشتراكات العملاء</div>
        </div>

        <nav className="nav">
          <div className="nav-group">
            <h4 style={{ color: '#5b6570' }}>المنصة</h4>
            <Link href="/platform/tenants" style={{ color: '#e3e6ea' }}>
              <span className="ico">🏢</span><span>المنشآت المشتركة</span>
            </Link>
            <Link href="/platform/tenants/new" style={{ color: '#e3e6ea' }}>
              <span className="ico">＋</span><span>إضافة منشأة</span>
            </Link>
            <Link href="/platform/plans" style={{ color: '#e3e6ea' }}>
              <span className="ico">💳</span><span>الباقات</span>
            </Link>
          </div>
          <div className="nav-group">
            <h4 style={{ color: '#5b6570' }}>حسابي</h4>
            <Link href="/dashboard" style={{ color: '#e3e6ea' }}>
              <span className="ico">↩</span><span>العودة إلى منشأتي</span>
            </Link>
          </div>
        </nav>

        <div className="sidebar-foot" style={{ borderColor: '#1e2936', color: '#8a949e' }}>
          <div style={{ fontWeight: 600, color: '#e3e6ea' }}>{session.name}</div>
          <div className="small">مالك المنصة</div>
          <form action={doSignOut} style={{ marginTop: 8 }}>
            <button className="btn sm" type="submit">تسجيل الخروج</button>
          </form>
        </div>
      </aside>

      <div className="main">{children}</div>
    </div>
  );
}
