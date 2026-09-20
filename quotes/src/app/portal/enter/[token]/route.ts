import { NextResponse } from 'next/server';
import { appBase } from '@/lib/base';
import { consumeClientLink } from '@/app/actions';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const base = appBase(req);
  const ok = await consumeClientLink(token);
  return NextResponse.redirect(ok ? `${base}/portal` : `${base}/portal/login?invalid=1`, 303);
}
