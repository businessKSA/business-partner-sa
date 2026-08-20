import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { buildDocModel } from '@/lib/doc-model';
import DocumentView from '@/components/DocumentView';
import { markViewed } from '@/lib/documents';
import { COMPANY } from '@config/company';
import AcceptBox from './AcceptBox';

export const dynamic = 'force-dynamic';

export default async function PublicDocPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const doc = await prisma.document.findUnique({
    where: { publicToken: token },
    select: { id: true, type: true, status: true, number: true, validUntil: true },
  });
  if (!doc) notFound();

  // المسودات لا تُعرض للعميل إطلاقاً — لا يُرسل ولا يُعرض شيء قبل الاعتماد
  if (doc.status === 'DRAFT') notFound();

  await markViewed(token);
  const model = await buildDocModel(doc.id);
  if (!model) notFound();

  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const expired = Boolean(doc.validUntil && doc.validUntil.getTime() < Date.now() && doc.status !== 'ACCEPTED');
  const canAccept = doc.type === 'QUOTE' && ['APPROVED', 'SENT'].includes(doc.status) && !expired;

  return (
    <div className="shell">
      <div className="no-print row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <span className="row" style={{ gap: 8 }}>
          <a className="btn ghost sm" href={`/d/${token}/pdf`}>تنزيل PDF / Download PDF</a>
          <a className="btn ghost sm" href={`/d/${token}/docx`}>تنزيل DOCX / Download DOCX</a>
        </span>
        <span className="muted">{doc.number}</span>
      </div>

      <DocumentView d={model} />

      {expired ? (
        <div className="card no-print notice bad" style={{ maxWidth: 900, margin: '18px auto' }}>
          انتهت صلاحية هذا العرض. تواصل معنا لإعادة التسعير.
          <div dir="ltr" style={{ textAlign: 'left' }}>
            This quotation has expired. Please contact us for re-pricing.
          </div>
        </div>
      ) : null}

      {canAccept ? <AcceptBox token={token} ip={ip} /> : null}

      {model.acceptedAt && doc.type === 'QUOTE' ? (
        <div className="card no-print" style={{ maxWidth: 900, margin: '18px auto' }}>
          <div className="notice ok">
            سُجّل قبولك لهذا العرض بتاريخ {model.acceptedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC باسم {model.acceptedByName}.
            <div dir="ltr" style={{ textAlign: 'left' }}>
              Your acceptance was recorded on {model.acceptedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC by {model.acceptedByName}.
            </div>
          </div>
        </div>
      ) : null}

      <p className="muted no-print" style={{ textAlign: 'center', marginTop: 24 }}>
        {COMPANY.legalName.ar} — {COMPANY.phoneDisplay} — {COMPANY.email}
      </p>
    </div>
  );
}
