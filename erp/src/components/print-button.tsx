'use client';

/** زرّ الطباعة. عميلٌ لأنه يحتاج `window` — والتقارير المالية تُطبع وتُقدَّم. */
export function PrintButton({ label = 'طباعة' }: { label?: string }) {
  return (
    <button className="btn sm no-print" type="button" onClick={() => window.print()}>
      {label}
    </button>
  );
}
