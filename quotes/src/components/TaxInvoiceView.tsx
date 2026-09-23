import { COMPANY } from '@config/company';
import { BASE_PATH } from '@/lib/base';
import { fmtMoney, fmtDateTime } from '@/lib/money';
import { qrSvg } from '@/lib/zatca/qrcode';

export interface TaxInvoiceModel {
  number: string;
  docType: string;
  typeCode: string;
  billingRef: string | null;
  issueAt: Date;
  sellerName: string;
  sellerVat: string;
  buyerName: string | null;
  buyerVat: string | null;
  netAmount: number;
  vatAmount: number;
  total: number;
  qr: string;
  uuid: string;
  icv: number;
  /** بيان البند كما ظهر في الفاتورة */
  lineTitle: string;
}

/**
 * الفاتورة الضريبية كما يراها العميل ويطبعها — نفس المكوّن في اللوحة وفي
 * بوابة العميل، فنسخته لا تختلف عن نسختنا.
 *
 * الحقول الإلزامية كلها هنا: اسم البائع ورقمه الضريبي وسجله التجاري وعنوانه،
 * التاريخ والوقت، البند، الوعاء الخاضع والضريبة سطراً مستقلاً، الإجمالي
 * شاملاً، ورمز QR بحمولة TLV المعتمدة.
 */
export function TaxInvoiceView({ d }: { d: TaxInvoiceModel }) {
  const isStandard = d.docType === 'STANDARD';
  const kind =
    d.typeCode === '381' ? 'إشعار دائن' :
    d.typeCode === '383' ? 'إشعار مدين' :
    isStandard ? 'فاتورة ضريبية' : 'فاتورة ضريبية مبسطة';

  return (
    <div className="card" style={{ maxWidth: 760, margin: '0 auto', background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 16 }}>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${BASE_PATH}${COMPANY.brand.logo}`} alt="" style={{ height: 48, marginBottom: 8 }} />
          <h2 style={{ margin: '0 0 4px' }}>{kind}</h2>
          <div className="sub">{d.number}</div>
          {d.billingRef ? <div className="sub">عن الفاتورة {d.billingRef}</div> : null}
        </div>
        <div style={{ width: 132, height: 132 }} dangerouslySetInnerHTML={{ __html: qrSvg(d.qr, 132) }} />
      </div>

      <table style={{ marginTop: 16 }}>
        <tbody>
          <tr>
            <td style={{ width: '50%' }}>
              <b>البائع</b>
              <div>{d.sellerName}</div>
              <div className="sub">{COMPANY.address.ar}</div>
              <div className="sub" dir="ltr">س.ت {COMPANY.crNumber}</div>
              <div className="sub" dir="ltr">الرقم الضريبي {d.sellerVat}</div>
            </td>
            <td>
              <b>المشتري</b>
              <div>{d.buyerName || 'عميل نقدي'}</div>
              {d.buyerVat ? <div className="sub" dir="ltr">الرقم الضريبي {d.buyerVat}</div> : null}
              <div className="sub">تاريخ الإصدار: {fmtDateTime(d.issueAt, 'ar')}</div>
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ marginTop: 16 }}>
        <thead>
          <tr>
            <th>البيان</th>
            <th className="num">غير شامل الضريبة</th>
            <th className="num">الضريبة</th>
            <th className="num">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{d.lineTitle}</td>
            <td className="num">{fmtMoney(d.netAmount)}</td>
            <td className="num">{fmtMoney(d.vatAmount)}</td>
            <td className="num">{fmtMoney(d.total)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: 700 }}>
            <td>
              {d.typeCode === '381'
                ? 'إجمالي المبلغ المردود شاملاً ضريبة القيمة المضافة'
                : 'الإجمالي المستحق شاملاً ضريبة القيمة المضافة'}
            </td>
            <td className="num" colSpan={3}>{fmtMoney(d.total)} ريال</td>
          </tr>
        </tfoot>
      </table>

      <div className="sub" style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
        <span dir="ltr">UUID: {d.uuid}</span>
        <span dir="ltr">ICV: {d.icv}</span>
      </div>
    </div>
  );
}
