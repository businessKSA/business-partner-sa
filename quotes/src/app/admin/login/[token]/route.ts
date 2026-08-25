import { NextResponse } from 'next/server';
import { consumeAdminLink } from '@/app/actions';

export const dynamic = 'force-dynamic';

/** استهلاك رابط الدخول السحري — معالج مسار لأن الكوكيز لا تُضبط من صفحة. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const base = process.env.APP_URL || new URL(req.url).origin;
  const ok = await consumeAdminLink(token);
  return NextResponse.redirect(ok ? `${base}/admin` : `${base}/admin/login?invalid=1`, 303);
}
