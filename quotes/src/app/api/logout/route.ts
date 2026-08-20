import { NextResponse } from 'next/server';
import { endSessions } from '@/lib/auth';

export async function POST(req: Request) {
  await endSessions();
  return NextResponse.redirect(new URL('/admin/login', req.url), { status: 303 });
}
