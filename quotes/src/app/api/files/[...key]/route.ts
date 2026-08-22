import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { storage } from '@/lib/storage';
import { currentAdmin, currentClientId } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** تنزيل ملف من التخزين — لوحة التحكم لكل الملفات، والعميل لملفاته فقط. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await params;
  const key = decodeURIComponent(parts.join('/'));

  const asset = await prisma.fileAsset.findFirst({ where: { path: key } });
  if (!asset) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  const admin = await currentAdmin();
  if (!admin) {
    const clientId = await currentClientId();
    if (!clientId || clientId !== asset.clientId) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }
  }

  try {
    const buf = await storage().get(key);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': asset.mime,
        'Content-Disposition': `inline; filename="${encodeURIComponent(asset.name)}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'تعذّر قراءة الملف' }, { status: 404 });
  }
}
