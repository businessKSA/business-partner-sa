import { NextResponse } from 'next/server';
import { embeddedSigningUrl } from '@/lib/docusign/service';
import { currentAdmin, currentClientId } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** يفتح رابط التوقيع المدمج مباشرة من صفحة العقد. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const envelope = url.searchParams.get('envelope') || '';
  const who = (url.searchParams.get('who') || 'client') as 'client' | 'bp';

  const env = await prisma.envelope.findUnique({ where: { id: envelope }, include: { document: true } });
  if (!env) return NextResponse.json({ error: 'ظرف غير موجود' }, { status: 404 });

  const admin = await currentAdmin();
  if (!admin) {
    const clientId = await currentClientId();
    if (who === 'bp' || !clientId || clientId !== env.document.clientId) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }
  }

  const base = process.env.APP_URL || url.origin;
  const returnUrl = `${base}/d/${env.document.publicToken}?signed=1`;
  try {
    const signUrl = await embeddedSigningUrl(envelope, who, returnUrl);
    return NextResponse.redirect(signUrl.startsWith('http') ? signUrl : `${base}${signUrl}`, 303);
  } catch (e) {
    return NextResponse.json(
      { error: `تعذّر فتح جلسة التوقيع: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }
}
