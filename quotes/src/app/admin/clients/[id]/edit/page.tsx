import { notFound } from 'next/navigation';
import { guardAdmin } from '@/lib/guard';
import { prisma } from '@/lib/db';
import EditClientForm from './EditClientForm';

export const dynamic = 'force-dynamic';

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  await guardAdmin();
  const { id } = await params;
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) notFound();

  return (
    <>
      <h1>تعديل بيانات العميل</h1>
      <p className="sub">
        هذه البيانات تُطبع في عروض الأسعار والعقود والفواتير. تعديلها لا يغيّر المستندات
        الصادرة سابقاً، ولا يُغيّر مجلد العميل ولا رابط بوابته.
      </p>
      <EditClientForm client={client} />
    </>
  );
}
