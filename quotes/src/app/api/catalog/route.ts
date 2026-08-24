import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * كتالوج الخدمات للقراءة العامة.
 *
 * لوحة التحكم هي مصدر الحقيقة للسعر؛ الموقع التعريفي يقرأ منها عند البناء
 * فيُعدَّل السعر في مكان واحد ويسري على العرض والعقد والفاتورة والموقع.
 *
 * لا سرّ هنا: هذه بالضبط الأسعار المنشورة على الموقع للعموم. ولا يخرج من هذه
 * النقطة شيء عن العملاء ولا المستندات ولا المبالغ المحصّلة.
 */
export async function GET() {
  const services = await prisma.service.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    select: {
      code: true,
      category: true,
      nameAr: true,
      nameEn: true,
      descAr: true,
      descEn: true,
      unitPrice: true,
      unitAr: true,
      unitEn: true,
      minQty: true,
      openPrice: true,
      attachGovFees: true,
      paymentTermsAr: true,
      deliveryAr: true,
    },
  });

  return NextResponse.json(
    { updatedAt: new Date().toISOString(), currency: 'SAR', count: services.length, services },
    { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=600' } },
  );
}
