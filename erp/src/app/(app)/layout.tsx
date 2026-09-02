import { redirect } from 'next/navigation';
import Link from 'next/link';
import { currentSession, signOut } from '@/lib/auth.ts';
import { Nav } from './nav.tsx';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await currentSession();
  if (!session) redirect('/login');

  async function doSignOut() {
    'use server';
    await signOut();
    redirect('/login');
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="mark">بزنس بارتنر — ERP</div>
          <div className="tenant" title={session.tenantName}>{session.tenantName}</div>
        </div>

        <Nav permissions={session.permissions} />

        <div className="sidebar-foot">
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{session.name}</div>
          <div className="small">{session.roleName}</div>
          {session.isPlatformAdmin ? (
            <Link href="/platform/tenants" className="small" style={{ display: 'block', marginTop: 4 }}>
              ← لوحة المنصة
            </Link>
          ) : null}
          <form action={doSignOut} style={{ marginTop: 8 }}>
            <button className="btn sm" type="submit">تسجيل الخروج</button>
          </form>
        </div>
      </aside>

      <div className="main">{children}</div>
    </div>
  );
}
