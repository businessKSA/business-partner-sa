'use client';
import { useState } from 'react';
import { COUNTRIES, splitDial, joinDial } from '@/lib/countries';

/**
 * حقل جوال بمفتاح الدولة.
 *
 * يرسل حقلاً واحداً مخفياً بالصيغة الدولية بأرقام فقط، وهي الصيغة الوحيدة
 * التي يقبلها واتساب. الصفر المحلي يسقط عند التركيب، فلا يخرج 96605x.
 */
export default function PhoneField({
  name = 'phone',
  defaultValue = '',
  required = false,
  label = 'جوال واتساب',
  id,
}: {
  name?: string;
  defaultValue?: string;
  required?: boolean;
  label?: string;
  id?: string;
}) {
  const initial = splitDial(defaultValue);
  const [dial, setDial] = useState(initial.dial);
  const [local, setLocal] = useState(initial.local);
  const combined = joinDial(dial, local);
  const inputId = id || name;

  return (
    <div>
      <label htmlFor={inputId}>{label}{required ? ' *' : ''}</label>
      <div className="row" style={{ gap: 8, alignItems: 'stretch' }}>
        <select
          aria-label="مفتاح الدولة"
          value={dial}
          onChange={(e) => setDial(e.target.value)}
          style={{ maxWidth: 220 }}
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.dial}>
              {c.ar} +{c.dial}
            </option>
          ))}
        </select>
        <input
          id={inputId}
          dir="ltr"
          inputMode="tel"
          required={required}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          placeholder="5xxxxxxxx"
          style={{ flex: 1 }}
        />
      </div>
      <input type="hidden" name={name} value={combined} />
      <p className="muted" style={{ marginTop: 6, fontSize: 12.5 }} dir="ltr">
        {combined ? `+${combined}` : '—'}
      </p>
    </div>
  );
}
