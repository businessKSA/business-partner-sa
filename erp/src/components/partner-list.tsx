import Link from 'next/link';
import { Card, Money, Empty } from '@/components/ui.tsx';
import { Decimal } from '@/lib/money.ts';

export type PartnerRow = {
  id: string; code: string; nameAr: string;
  vatNumber: string | null; city: string | null;
  phone: string | null; email: string | null;
  paymentTermDays: number; active: boolean;
  balance: Decimal;
  invoiceCount: number;
};

/**
 * قائمة الأطراف — مشتركة بين العملاء والموردين.
 *
 * الرصيد يُعرض هنا لأنه أول ما يُسأل عنه: من يفتح ملف عميل يريد أن يعرف
 * كم عليه قبل أن يقرأ عنوانه.
 */
export function PartnerList({
  rows, kind, newHref,
}: { rows: PartnerRow[]; kind: 'CUSTOMER' | 'VENDOR'; newHref?: string }) {
  const isCustomer = kind === 'CUSTOMER';

  return (
    <Card flush>
      {rows.length === 0 ? (
        <Empty
          title={isCustomer ? 'لا عملاء بعد' : 'لا موردين بعد'}
          hint={isCustomer ? 'أضِف أول عميل لتصدر له فاتورة.' : 'أضِف مورّداً لتسجّل فواتيره.'}
          action={newHref ? <Link className="btn primary" href={newHref}>إضافة</Link> : undefined}
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 90 }}>الرمز</th>
                <th>الاسم</th>
                <th style={{ width: 150 }}>الرقم الضريبي</th>
                <th style={{ width: 110 }}>المدينة</th>
                <th style={{ width: 130 }}>التواصل</th>
                <th className="num" style={{ width: 80 }}>المهلة</th>
                <th className="num" style={{ width: 70 }}>فواتير</th>
                <th className="num" style={{ width: 140 }}>
                  {isCustomer ? 'المستحقّ عليه' : 'المستحقّ له'}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.code}</td>
                  <td>
                    {p.nameAr}
                    {!p.active ? <span className="badge mute" style={{ marginInlineStart: 6 }}>مقفل</span> : null}
                  </td>
                  <td className="mono small">
                    {p.vatNumber ?? <span className="muted">بلا رقم ضريبي</span>}
                  </td>
                  <td>{p.city ?? <span className="muted">—</span>}</td>
                  <td className="small">
                    {p.phone ? <div className="mono">{p.phone}</div> : null}
                    {p.email ? <div className="muted">{p.email}</div> : null}
                    {!p.phone && !p.email ? <span className="muted">—</span> : null}
                  </td>
                  <td className="num">{p.paymentTermDays ? `${p.paymentTermDays} يوماً` : 'فوري'}</td>
                  <td className="num">{p.invoiceCount}</td>
                  <td className="num"><Money value={p.balance} colored /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
