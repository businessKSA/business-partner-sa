/**
 * مدى التاريخ للتقارير.
 *
 * نموذج GET لا حالة عميل: الرابط يحمل المدى، فيُنسخ ويُرسل ويُحفظ في
 * المفضّلة ويعود إليه المستخدم غداً فيجد الأرقام نفسها.
 */
export function DateRange({
  from, to, basePath, extra,
}: { from: Date; to: Date; basePath: string; extra?: React.ReactNode }) {
  return (
    <form method="get" action={basePath} className="card no-print" style={{ marginBottom: 16 }}>
      <div className="card-body" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="from">من تاريخ</label>
          <input id="from" name="from" type="date" defaultValue={from.toISOString().slice(0, 10)} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="to">إلى تاريخ</label>
          <input id="to" name="to" type="date" defaultValue={to.toISOString().slice(0, 10)} />
        </div>
        {extra}
        <button className="btn primary" type="submit">عرض</button>
      </div>
    </form>
  );
}
