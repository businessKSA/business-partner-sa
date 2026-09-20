import { NextResponse } from 'next/server';
import { endSessions } from '@/lib/auth';
import { appBase } from '@/lib/base';

export async function POST(req: Request) {
  await endSessions();
  // new URL('/admin/login', req.url) كانت تُسقط جذر اللوحة فتعيد الخارج إلى
  // /admin/login على أصل الطلب — خارج /quotes وخارج نطاق الموقع.
  return NextResponse.redirect(`${appBase(req)}/admin/login`, { status: 303 });
}
