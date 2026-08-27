import { guardAdmin } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { fmtMoney, fmtDateTime } from '@/lib/money';
import { ZATCA_STATUS_LABEL } from '@/lib/finance-enums';
import { sellerProfile, zatcaPhase2Ready, zatcaEnv } from '@/lib/zatca/config';
import { RetryButton } from './RetryButton';

export const dynamic = 'force-dynamic';

export default async function ZatcaPage() {
  await guardAdmin();
  const seller = sellerProfile();
  const phase2 = zatcaPhase2Ready();
  const [records, icv] = await Promise.all([
    prisma.zatcaRecord.findMany({ orderBy: { icv: 'desc' }, take: 100 }),
    prisma.counter.findUnique({ where: { id: 'ZATCA:ICV' } }),
  ]);
  const failed = records.filter((r) => r.status === 'FAILED' || r.status === 'REJECTED');

  return (
    <>
      <h1>الفوترة الإلكترونية — زاتكا</h1>
      <p className="sub">
        الفواتير الضريبية تصدر من هذا النظام مباشرة بتسلسل واحد وسلسلة تجزئة متصلة.
        {phase2
          ? ` وضع الربط مفعّل على بيئة ${zatcaEnv()}: توقيع رقمي وإبلاغ فوري.`
          : ' الوضع الحالي: المرحلة الأولى — فاتورة كاملة الحقول برمز QR معتمد، دون ربط API (وهو الوضع النظامي حتى تشملك موجة الربط).'}
      </p>

      <div className="grid c3" style={{ margin: '14px 0' }}>
        <div className="card">
          <div className="sub">فواتير صادرة (عدّاد ICV)</div>
          <div className="num" style={{ fontSize: 22 }}>{icv?.value || 0}</div>
        </div>
        <div className="card">
          <div className="sub">الرقم الضريبي</div>
          <div className="num" dir="ltr" style={{ fontSize: 18 }}>{seller.vatNumber || '—'}</div>
          <div className="sub">{seller.ready ? 'البيانات مكتملة' : `ناقص: ${seller.missing.join('، ')}`}</div>
        </div>
        <div className="card">
          <div className="sub">تحتاج إعادة إبلاغ</div>
          <div className="num" style={{ fontSize: 22, color: failed.length ? '#b42318' : undefined }}>
            {failed.length}
          </div>
        </div>
      </div>

      {!phase2 ? (
        <div className="notice" style={{ marginBottom: 14 }}>
          لتفعيل المرحلة الثانية عند وصول موجتك: شغّل سكربت التأهيل
          <code dir="ltr" style={{ margin: '0 6px' }}>npx tsx scripts/zatca-onboard.ts</code>
          برمز تحقق من بوابة فاتورة، ثم ضع المتغيرات الناتجة
          (ZATCA_PRIVATE_KEY, ZATCA_CERTIFICATE, ZATCA_SECRET) في البيئة.
          التفاصيل في docs/FINANCE.md.
        </div>
      ) : null}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th className="num">ICV</th>
              <th>الرقم</th>
              <th>النوع</th>
              <th>المشتري</th>
              <th className="num">الإجمالي</th>
              <th>الحالة</th>
              <th className="num">الإصدار</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr><td colSpan={8} className="sub">
                لا فواتير ضريبية صادرة بعد — تصدر من صفحة الفاتورة بعد سدادها.
              </td></tr>
            ) : (
              records.map((r) => (
                <tr key={r.id}>
                  <td className="num">{r.icv}</td>
                  <td>
                    <b>{r.number}</b>
                    {r.invoiceId ? (
                      <div className="sub"><a href={`/admin/invoices/${r.invoiceId}/tax`}>عرض / طباعة</a></div>
                    ) : null}
                  </td>
                  <td>
                    {r.docType === 'STANDARD' ? 'معيارية' : 'مبسطة'}
                    {r.typeCode === '381' ? ' — إشعار دائن' : r.typeCode === '383' ? ' — إشعار مدين' : ''}
                  </td>
                  <td>{r.buyerName || '—'}</td>
                  <td className="num">{fmtMoney(r.total)}</td>
                  <td>
                    {ZATCA_STATUS_LABEL[r.status] || r.status}
                    {r.zatcaError ? <div className="sub" style={{ color: '#b42318' }}>{r.zatcaError}</div> : null}
                    {r.zatcaWarnings ? <div className="sub">{r.zatcaWarnings}</div> : null}
                  </td>
                  <td className="num">{fmtDateTime(r.issueAt, 'ar')}</td>
                  <td>
                    {(r.status === 'FAILED' || r.status === 'REJECTED') && phase2 ? (
                      <RetryButton recordId={r.id} />
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
