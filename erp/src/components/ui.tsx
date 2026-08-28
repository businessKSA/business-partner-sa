/**
 * لبنات العرض المشتركة.
 *
 * صياغة الأرقام تمرّ كلها من هنا لسببين: أن تظهر بالصيغة نفسها في كل شاشة،
 * وأن يبقى الاتجاه محكوماً — الرقم داخل نصٍّ عربي يحتاج عزلاً صريحاً وإلا
 * تراقصت علامته وفاصلته حول النص المجاور.
 */
import { d, money, Decimal, type Num } from '@/lib/money.ts';

/** رقم نقدي: لاتيني، جدولي، بمنزلتين، ومعزول اتجاهياً. */
export function Money({ value, currency, colored }: { value: Num; currency?: string; colored?: boolean }) {
  const v = money(value);
  const cls = colored ? (v.isNegative() ? 'num neg' : v.isZero() ? 'num muted' : 'num') : 'num';
  const text = v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (
    <span className={cls}>
      {text}
      {currency ? <span className="muted small"> {currency}</span> : null}
    </span>
  );
}

export function Qty({ value, dp = 2 }: { value: Num; dp?: number }) {
  return <span className="num">{d(value).toDecimalPlaces(dp).toString()}</span>;
}

export function Pct({ value }: { value: Decimal | null | undefined }) {
  if (value === null || value === undefined) return <span className="muted">—</span>;
  return <span className="num">{value.toFixed(1)}٪</span>;
}

/** تاريخ ميلادي بصيغة موحّدة — لا يعتمد على لغة المتصفح. */
export function DateText({ value }: { value: Date | string | null | undefined }) {
  if (!value) return <span className="muted">—</span>;
  const dt = typeof value === 'string' ? new Date(value) : value;
  return <span className="num">{dt.toISOString().slice(0, 10)}</span>;
}

const STATUS: Record<string, { ar: string; cls: string }> = {
  DRAFT: { ar: 'مسودة', cls: 'mute' },
  POSTED: { ar: 'مرحَّل', cls: 'info' },
  APPROVED: { ar: 'معتمد', cls: 'info' },
  PAID: { ar: 'مسدَّدة', cls: 'ok' },
  PARTIALLY_PAID: { ar: 'مسدَّدة جزئياً', cls: 'warn' },
  CANCELLED: { ar: 'ملغاة', cls: 'bad' },
  REVERSED: { ar: 'معكوس', cls: 'warn' },
  ACTIVE: { ar: 'نشط', cls: 'ok' },
  PLANNED: { ar: 'مخطَّط', cls: 'mute' },
  ON_HOLD: { ar: 'متوقّف', cls: 'warn' },
  COMPLETED: { ar: 'مكتمل', cls: 'ok' },
  OPEN: { ar: 'مفتوحة', cls: 'ok' },
  CLOSED: { ar: 'مقفلة', cls: 'mute' },
  LOCKED: { ar: 'مقفلة نهائياً', cls: 'bad' },
  PENDING: { ar: 'بانتظار', cls: 'warn' },
  REJECTED: { ar: 'مرفوض', cls: 'bad' },
  TODO: { ar: 'لم تبدأ', cls: 'mute' },
  IN_PROGRESS: { ar: 'قيد التنفيذ', cls: 'info' },
  REVIEW: { ar: 'قيد المراجعة', cls: 'warn' },
  DONE: { ar: 'منجزة', cls: 'ok' },
  NOT_SENT: { ar: 'لم تُرسل', cls: 'mute' },
  CLEARED: { ar: 'مُجازة', cls: 'ok' },
  REPORTED: { ar: 'مُبلَّغة', cls: 'ok' },
  WARNING: { ar: 'مقبولة بملاحظات', cls: 'warn' },
  FAILED: { ar: 'مرفوضة', cls: 'bad' },
  TRIAL: { ar: 'تجريبي', cls: 'warn' },
  SUSPENDED: { ar: 'موقوف', cls: 'bad' },
  TERMINATED: { ar: 'منتهية خدمته', cls: 'mute' },
  ON_LEAVE: { ar: 'في إجازة', cls: 'warn' },
};

export function Status({ value }: { value: string }) {
  const s = STATUS[value] ?? { ar: value, cls: 'mute' };
  return <span className={`badge ${s.cls}`}>{s.ar}</span>;
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <div className="big">◌</div>
      <p><strong>{title}</strong></p>
      {hint ? <p className="small">{hint}</p> : null}
      {action ? <div style={{ marginTop: 14 }}>{action}</div> : null}
    </div>
  );
}

export function Alert({
  kind = 'info', title, children,
}: { kind?: 'error' | 'warn' | 'ok' | 'info'; title?: string; children: React.ReactNode }) {
  return (
    <div className={`alert ${kind}`}>
      {title ? <strong>{title}</strong> : null}
      {children}
    </div>
  );
}

export function Card({
  title, hint, actions, flush, children,
}: {
  title?: string; hint?: string; actions?: React.ReactNode; flush?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="card">
      {title || actions ? (
        <div className="card-head">
          <div>
            <h2>{title}</h2>
            {hint ? <div className="hint">{hint}</div> : null}
          </div>
          {actions ? <div className="actions">{actions}</div> : null}
        </div>
      ) : null}
      <div className={flush ? 'card-body flush' : 'card-body'}>{children}</div>
    </div>
  );
}

export function Kpi({
  label, value, note, tone,
}: { label: string; value: React.ReactNode; note?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className={`kpi${tone ? ` ${tone}` : ''}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {note ? <div className="note">{note}</div> : null}
    </div>
  );
}
