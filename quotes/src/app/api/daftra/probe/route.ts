import { NextResponse } from 'next/server';
import { currentAdmin } from '@/lib/auth';
import { daftraStatus } from '@/lib/daftra';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * حالة جسر الفاتورة الضريبية — قراءة فقط، محمية بجلسة المدير.
 *
 * لم يعد فحصاً لاتصال الدفترة: اللوحة لا تنادي الدفترة أصلاً، بل تفوّض
 * الموقع التعريفي. فما يُقال هنا: هل الجسر مُهيّأ، وهل هو مفتوح، وإلى أين.
 * ولا يُظهر المفتاح.
 */
export async function GET() {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: 'يتطلب تسجيل دخول المدير.' }, { status: 401 });
  const s = daftraStatus();
  return NextResponse.json(s, { status: s.configured ? 200 : 428 });
}
