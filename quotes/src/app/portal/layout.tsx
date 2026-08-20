import { prisma } from '@/lib/db';
import { currentClientId } from '@/lib/auth';
import { PortalBar } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const id = await currentClientId();
  const client = id ? await prisma.client.findUnique({ where: { id } }) : null;
  return (
    <>
      {client ? <PortalBar name={client.companyAr || client.nameAr} /> : null}
      <div className="shell">{children}</div>
    </>
  );
}
