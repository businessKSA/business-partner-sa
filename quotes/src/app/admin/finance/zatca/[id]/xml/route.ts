import { NextResponse } from 'next/server';
import { currentAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * تنزيل الفاتورة بصيغتها الصادرة — اللائحة تشترط أرشفة الفاتورة الإلكترونية
 * بصيغتها لا بصورة منها، وهذا هو الملف الذي يُسلَّم للمحاسب أو للهيئة عند الطلب.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await currentAdmin())) {
    return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });
  }
  const { id } = await params;
  const rec = await prisma.zatcaRecord.findUnique({
    where: { id },
    select: { number: true, xml: true },
  });
  if (!rec) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  return new NextResponse(rec.xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${rec.number}.xml"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
