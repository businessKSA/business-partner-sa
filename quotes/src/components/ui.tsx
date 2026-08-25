import React from 'react';
import Link from 'next/link';
import { COMPANY } from '../../config/company';
import { STATUS_LABEL } from '../lib/enums';

export function AdminBar({ email }: { email: string }) {
  return (
    <nav className="bar no-print">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={COMPANY.brand.logo} alt="Business Partner" />
      <Link href="/admin">لوحة التحكم</Link>
      <Link href="/admin/documents/new">عرض سعر جديد</Link>
      <Link href="/admin/clients">العملاء</Link>
      <Link href="/admin/invoices">الفواتير</Link>
      <Link href="/admin/catalog">الكتالوج</Link>
      <Link href="/admin/agent">الوكيل الذكي</Link>
      <Link href="/admin/suppliers">الموردون</Link>
      <Link href="/admin/audit">سجل التدقيق</Link>
      <span className="spacer" />
      <span style={{ fontSize: 13, opacity: 0.85 }}>{email}</span>
      <form action="/api/logout" method="post" style={{ display: 'inline' }}>
        <button className="btn ghost sm" type="submit">خروج</button>
      </form>
    </nav>
  );
}

export function PortalBar({ name }: { name: string }) {
  return (
    <nav className="bar no-print">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={COMPANY.brand.logo} alt="Business Partner" />
      <Link href="/portal">بوابة العميل</Link>
      <span className="spacer" />
      <span style={{ fontSize: 13, opacity: 0.85 }}>{name}</span>
      <form action="/api/logout" method="post" style={{ display: 'inline' }}>
        <button className="btn ghost sm" type="submit">خروج</button>
      </form>
    </nav>
  );
}

export function StatusPill({ status }: { status: string }) {
  const l = STATUS_LABEL[status] ?? { ar: status, en: status };
  return (
    <span className={`pill st-${status}`} title={l.en}>
      {l.ar}
    </span>
  );
}

export function Notice({
  kind = 'info',
  children,
}: {
  kind?: 'info' | 'ok' | 'bad' | 'warn';
  children: React.ReactNode;
}) {
  const cls = kind === 'info' ? 'notice' : `notice ${kind}`;
  return <div className={cls}>{children}</div>;
}

export function Kpi({ label, value, unit, negative }: { label: string; value: string; unit?: string; negative?: boolean }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className={negative ? 'value neg' : 'value'}>
        {value}
        {unit ? <span style={{ fontSize: 13, marginInlineStart: 6 }}>{unit}</span> : null}
      </div>
    </div>
  );
}

export function Timeline({
  events,
}: {
  events: { id: string; titleAr: string; titleEn: string; createdAt: Date; actor: string; actorKind: string }[];
}) {
  if (!events.length) return <p className="muted">لا توجد أحداث بعد.</p>;
  return (
    <ul className="timeline">
      {events.map((e) => (
        <li key={e.id}>
          <div className="t-title">{e.titleAr}</div>
          <div className="t-en">{e.titleEn}</div>
          <div className="t-meta">
            {new Date(e.createdAt).toISOString().replace('T', ' ').slice(0, 16)} UTC — {e.actor} ({e.actorKind})
          </div>
        </li>
      ))}
    </ul>
  );
}

export function SubmitButton({
  children,
  className = 'btn',
  confirm,
  name,
  value,
}: {
  children: React.ReactNode;
  className?: string;
  confirm?: string;
  name?: string;
  value?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      name={name}
      value={value}
      {...(confirm ? { formNoValidate: false } : {})}
    >
      {children}
    </button>
  );
}
