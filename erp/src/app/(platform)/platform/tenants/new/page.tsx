import { requirePlatformAdmin } from '@/lib/platform.ts';
import { PageHead } from '@/components/page-head.tsx';
import { NewTenantForm } from './form.tsx';

export default async function NewTenantPage() {
  await requirePlatformAdmin();
  return (
    <>
      <PageHead
        title="إضافة منشأة"
        sub="تُسلَّم جاهزة للعمل من أول دقيقة — بشجرة حسابات وسنة مالية وأدوار"
      />
      <div className="content"><NewTenantForm /></div>
    </>
  );
}
