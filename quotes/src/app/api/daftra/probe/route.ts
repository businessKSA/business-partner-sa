import { NextResponse } from 'next/server';
import { currentAdmin } from '@/lib/auth';
import { probeDaftra } from '@/lib/daftra';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * فحص اتصال دفترة — قراءة فقط، محمي بجلسة المدير.
 * يُجرّب تركيبات جذر الواجهة وترويسة المفتاح ويُبلّغ أيّها قُبل،
 * حتى نضبط التكامل على العقد الحقيقي دون تخمين. لا يُظهر المفتاح.
 */
export async function GET() {
  const admin = await currentAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'يتطلب تسجيل دخول المدير.' }, { status: 401 });
  }
  const report = await probeDaftra();
  return NextResponse.json(report, { status: report.configured ? 200 : 428 });
}
