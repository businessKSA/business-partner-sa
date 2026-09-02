import { NextResponse } from 'next/server';
import { appBase } from '@/lib/base';
import { currentAdmin } from '@/lib/auth';
import {
  tamaraStatus,
  tamaraEligible,
  tamaraFee,
  pingTamara,
  tamaraTokenShape,
  listTamaraWebhooks,
  registerTamaraWebhook,
  TAMARA_EVENTS,
} from '@/lib/payments/tamara';

export const dynamic = 'force-dynamic';

function notificationUrl(req: Request): string {
  const base = appBase(req);
  return `${base.replace(/\/$/, '')}/api/payments/tamara`;
}

/**
 * فحص إعداد تمارا.
 *
 * GET  — لا يحرّك مالاً ولا يغيّر إعداداً: يعرض المفاتيح المعرّفة، ويتحقّق
 *        من المفتاح بنداء لطلبية لا وجود لها، ويسرد روابط الإشعار المسجّلة،
 *        ويبيّن أن العهدة ترجع «غير مؤهّلة».
 * POST — يسجّل رابط الإشعار لدى تمارا. خطوة صريحة بطلب لا تقع تلقائياً.
 */
export async function GET(req: Request) {
  // 401 صريح لا استثناء غير ملتقَط: طلب بلا جلسة يردّ «غير مصرّح» لا 500،
  // فالخمسمائة تقول «الخادم معطوب» وترسل من يقرأها يبحث عن عطل غير موجود.
  if (!(await currentAdmin())) {
    return NextResponse.json({ error: 'يتطلب تسجيل دخول المدير.' }, { status: 401 });
  }

  const st = tamaraStatus();
  const sample = [1000, 5000, 10000, 28175, st.maxAmount];
  const live = st.configured ? await pingTamara() : null;
  const hooks = live?.authorised ? await listTamaraWebhooks() : null;

  return NextResponse.json({
    الإعداد: st,
    'رابط الإشعار المتوقّع': notificationUrl(req),
    'الفحص الحيّ': live ?? 'المفتاح غير معرّف',
    // «مرفوض» لا يقول أي رفض: منتهٍ، أم من النوع الخطأ، أم من حساب آخر.
    // هذه الأسطر تفرّق بينها بلا كشف حرف من المفتاح.
    'شكل المفتاح': tamaraTokenShape(),
    'روابط الإشعار المسجّلة': hooks ?? 'لم تُقرأ — المفتاح غير مقبول أو غير معرّف',
    'الأحداث التي نعالجها': TAMARA_EVENTS,
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
  });
}

export async function POST(req: Request) {
  if (!(await currentAdmin())) {
    return NextResponse.json({ error: 'يتطلب تسجيل دخول المدير.' }, { status: 401 });
  }

  const url = notificationUrl(req);
  const res = await registerTamaraWebhook(url);
  if (!res.ok) {
    return NextResponse.json({ ok: false, الرابط: url, الخطأ: res.error }, { status: 502 });
  }
  return NextResponse.json({
    ok: true,
    'سُجّل رابط الإشعار': url,
    المعرّف: res.id ?? null,
    الأحداث: TAMARA_EVENTS,
  });
}
