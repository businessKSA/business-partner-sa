import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { storage } from '@/lib/storage';
import { buildAndArchiveDocx } from '@/lib/docx';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** تنزيل المستند بصيغة DOCX من نفس الرابط العام. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const doc = await prisma.document.findUnique({
    where: { publicToken: token },
    select: { id: true, number: true, status: true },
  });
  if (!doc || doc.status === 'DRAFT') {
    return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  }

  try {
    const existing = await prisma.fileAsset.findUnique({ where: { id: `docx-${doc.id}` } });
    const buffer =
      existing && (await storage().exists(existing.path))
        ? await storage().get(existing.path)
        : (await buildAndArchiveDocx(doc.id)).buffer;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${doc.number}.docx"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: `تعذّر توليد الملف: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }
}
