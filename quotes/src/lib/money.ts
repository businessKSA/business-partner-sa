import { VAT_RATE } from '../../config/company';

export type Line = { qty: number; unitPrice: number };

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function lineTotal(qty: number, unitPrice: number): number {
  return round2(qty * unitPrice);
}

export interface Totals {
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
}

/** المجموع ثم الضريبة سطراً مستقلاً ثم الإجمالي شامل الضريبة. */
export function computeTotals(lines: Line[], vatRate: number = VAT_RATE): Totals {
  const subtotal = round2(
    lines.reduce((sum, l) => sum + lineTotal(l.qty, l.unitPrice), 0),
  );
  const vatAmount = round2(subtotal * vatRate);
  return { subtotal, vatRate, vatAmount, total: round2(subtotal + vatAmount) };
}

/** تنسيق موحّد للمبالغ في العربي والإنجليزي — أرقام لاتينية بفاصل آلاف. */
export function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '0.00';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function fmtQty(n: number): string {
  return Number.isInteger(n) ? String(n) : String(round2(n));
}

export function currencyLabel(lang: 'ar' | 'en'): string {
  return lang === 'ar' ? 'ريال سعودي' : 'SAR';
}

export function fmtDate(d: Date | string | null | undefined, lang: 'ar' | 'en'): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  // صيغة موحّدة تُقرأ صحيحة في الاتجاهين ولا تعتمد على لغة النظام
  return lang === 'ar' ? `${day}/${m}/${y}` : `${y}-${m}-${day}`;
}

export function fmtDateTime(d: Date | string | null | undefined, lang: 'ar' | 'en'): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  return `${fmtDate(date, lang)} ${hh}:${mm} UTC`;
}
