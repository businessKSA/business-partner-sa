import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { tamaraStatus, tamaraEligible, tamaraFee } from '@/lib/payments/tamara';

export const dynamic = 'force-dynamic';

/**
 * فحص إعداد تمارا دون تحريك مال.
 *
 * يجيب: هل المفاتيح معرّفة؟ وأي بيئة؟ وما تكلفة القبول على مبالغ نموذجية؟
 * وهل تمرّ عهدة من الحارس؟ — الأخيرة هي التي يجب أن ترجع «لا» دائماً.
 */
export async function GET() {
  await requireAdmin();

  const st = tamaraStatus();
  const sample = [1000, 5000, 10000, 28175];

  return NextResponse.json({
    الإعداد: st,
    'تكلفة القبول': sample.map((total) => ({
      المبلغ: total,
      'خصم تمارا': tamaraFee(total),
      'النسبة الفعلية': `${((tamaraFee(total) / total) * 100).toFixed(2)}%`,
      'الصافي لنا': Number((total - tamaraFee(total)).toFixed(2)),
    })),
    الحارس: {
      'فاتورة أتعاب عادية': tamaraEligible({
        total: 5000, isGovFeeDeposit: false, depositKind: null, status: 'DUE',
      }),
      'عهدة رسوم حكومية': tamaraEligible({
        total: 5000, isGovFeeDeposit: true, depositKind: 'GOV_FEE', status: 'DUE',
      }),
      'عهدة توريد': tamaraEligible({
        total: 5000, isGovFeeDeposit: false, depositKind: 'SUPPLY', status: 'DUE',
      }),
      'أعلى من الحد': tamaraEligible({
        total: st.maxAmount + 1, isGovFeeDeposit: false, depositKind: null, status: 'DUE',
      }),
      'أقل من الحد': tamaraEligible({
        total: 1, isGovFeeDeposit: false, depositKind: null, status: 'DUE',
      }),
      'فاتورة مسددة': tamaraEligible({
        total: 5000, isGovFeeDeposit: false, depositKind: null, status: 'PAID',
      }),
    },
    'الخطوات المتبقية': [
      'سجّل رابط الإشعار لدى تمارا: {APP_URL}/api/payments/tamara — وفعّل حدث order_approved على الأقل',
      'ضع TAMARA_API_TOKEN و TAMARA_NOTIFICATION_TOKEN',
      'ابدأ بـ TAMARA_MODE=sandbox وأتمم عملية واحدة كاملة قبل live',
    ],
  });
}
