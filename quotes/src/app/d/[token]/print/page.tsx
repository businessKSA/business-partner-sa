/**
 * نسخة الطباعة من صفحة المستند — بلا أي عناصر تحكم.
 * هذه الصفحة هي مصدر الـPDF، فيخرج الـPDF مطابقاً للصفحة العامة.
 */
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { buildDocModel } from '@/lib/doc-model';
import DocumentView from '@/components/DocumentView';

export const dynamic = 'force-dynamic';

export default async function PrintPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const doc = await prisma.document.findUnique({ where: { publicToken: token }, select: { id: true } });
  if (!doc) notFound();
  const model = await buildDocModel(doc.id);
  if (!model) notFound();
  return (
    <div className="shell" style={{ padding: 0, background: '#fff' }}>
      <DocumentView d={model} />
    </div>
  );
}
