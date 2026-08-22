import { currentAdmin } from '@/lib/auth';
import { AdminBar } from '@/components/ui';

export const dynamic = 'force-dynamic';

/** الحراسة تتم في كل صفحة عبر guardAdmin() — هنا نعرض الشريط فقط. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const email = await currentAdmin();
  return (
    <>
      {email ? <AdminBar email={email} /> : null}
      <div className="shell">{children}</div>
    </>
  );
}
