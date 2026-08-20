import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getOrBuildPdf } from '@/lib/send';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
    const { buffer } = await getOrBuildPdf(doc.id);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${doc.number}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: `تعذّر توليد الـPDF: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }
}
