import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { PageHead } from '@/components/page-head.tsx';
import { EntryForm } from './entry-form.tsx';

export default async function NewEntryPage() {
  const session = await requireAuth('accounting.journal.post');

  const { accounts, costCenters } = await withTenant(session.tenantId, async (tx) => {
    const accounts = await tx.account.findMany({
      // الحساب التجميعي لا يظهر أصلاً: منعُه في المحرّك وحده يعني رسالة خطأ
      // بعد رحلة كاملة، وإخفاؤه هنا يمنع الرحلة.
      where: { tenantId: session.tenantId, isGroup: false, active: true, allowManual: true },
      select: { id: true, code: true, nameAr: true },
      orderBy: { code: 'asc' },
    });
    const costCenters = await tx.costCenter.findMany({
      where: { tenantId: session.tenantId, active: true },
      select: { id: true, code: true, nameAr: true },
      orderBy: { code: 'asc' },
    });
    return { accounts, costCenters };
  });

  return (
    <>
      <PageHead title="قيد يومية جديد" sub="القيد يُرحَّل مباشرةً — ولا يُعدَّل بعدها إلا بقيد عاكس." />
      <div className="content">
        <EntryForm accounts={accounts} costCenters={costCenters} />
      </div>
    </>
  );
}
