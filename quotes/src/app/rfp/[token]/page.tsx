import { notFound } from 'next/navigation';
import { openRfp, scopeForSupplier } from '@/lib/sourcing';
import { COMPANY } from '@config/company';
import BidForm from './BidForm';

export const dynamic = 'force-dynamic';

/**
 * صفحة المورد لتقديم عرضه — برمزٍ في رابط، بلا حساب ولا كلمة مرور.
 *
 * المورد ليس مستخدماً في النظام ولن يسجّل فيه ليقدّم سعراً، ولو طُلب منه ذلك
 * لما قدّم. والرمز يكفي: طويل، لطلب واحد ومورد واحد، ينتهي بمدة، ويُستهلك
 * بردٍّ واحد.
 *
 * ولا يظهر في هذه الصفحة اسم العميل ولا بريده ولا هاتفه: المورد يسعّر نطاق
 * عمل. ومعرفته بالعميل تعني أنه يستطيع أن يتجاوزنا إليه، وأن بيانات عميلنا
 * صارت عند طرف لم يوقّع علينا شيئاً.
 */
export default async function RfpPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const rfp = await openRfp(token);
  if (!rfp) notFound();

  const req = rfp.supplyRequest;

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px' }}>
      <header style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 700, color: '#0B1B5A' }}>{COMPANY.legalName.ar}</div>
        <h1 style={{ margin: '10px 0 4px', fontSize: 22 }}>طلب عرض سعر</h1>
        <p className="sub">
          السادة {rfp.supplier.nameAr} — طلب رقم <span dir="ltr">{req.number}</span>
        </p>
      </header>

      <section className="card">
        <h2 style={{ fontSize: 16, marginTop: 0 }}>نطاق العمل المطلوب</h2>
        <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.9 }}>
          {scopeForSupplier(req)}
        </p>
      </section>

      {rfp.expired ? (
        <div className="notice bad" style={{ marginTop: 16 }}>
          انتهت صلاحية هذا الرابط. تواصل معنا إن كنت ما زلت ترغب في التقديم.
        </div>
      ) : rfp.bidId ? (
        <div className="notice ok" style={{ marginTop: 16 }}>
          استلمنا عرضكم لهذا الطلب، وسنوافيكم بالنتيجة. شكراً لكم.
        </div>
      ) : (
        <BidForm token={token} />
      )}

      <p className="muted" style={{ marginTop: 22, lineHeight: 1.9 }}>
        الأسعار المطلوبة غير شاملة ضريبة القيمة المضافة. وهذا طلب عرض سعر ولا يُعدّ ارتباطاً
        تعاقدياً حتى صدور أمر شراء منّا.
      </p>
    </main>
  );
}
