import { guardClient } from '@/lib/guard';
import { prisma } from '@/lib/db';
import ServicePicker from './ServicePicker';

export const dynamic = 'force-dynamic';

/**
 * كتالوج الخدمات داخل بوابة العميل.
 *
 * الخدمة ذات السعر المنشور تصدر عرضها فوراً بلا تدخّل — الرقم الذي يراه
 * العميل هنا هو نفسه في العرض، فلا شيء يُراجَع. والخدمة مفتوحة السعر تصل
 * كطلب تسعير لأنه لا يوجد رقم بعد.
 */
export default async function PortalServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  await guardClient();
  const { code } = await searchParams;
  const services = await prisma.service.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
    select: {
      id: true, code: true, category: true, nameAr: true, nameEn: true,
      descAr: true, unitPrice: true, unitAr: true, minQty: true,
      openPrice: true, attachGovFees: true, deliveryAr: true,
    },
  });

  return (
    <>
      <h1>الخدمات</h1>
      <p className="sub">
        اختر الخدمة ويصدر عرض السعر فوراً ويصلك على بريدك. كل الأسعار غير شاملة ضريبة
        القيمة المضافة، والرسوم الحكومية مستثناة وتُحصَّل بقيمتها الفعلية.
      </p>
      <ServicePicker services={services} preselectCode={(code || '').toUpperCase()} />
    </>
  );
}
