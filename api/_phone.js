// One spelling for a customer's mobile in the Sales Pipeline "Phone" column.
// Saudi forms 05…, 5…, 9665…, +966…, 00966… all become +9665XXXXXXXX so the
// owner can click-to-call / filter on it and the same customer is not three
// different strings. A number that is not recognisably Saudi is kept as the
// customer typed it (trimmed) — we never invent or drop digits.
//
// Pure functions only (no env, no network) so the CRM writers and the
// ops/crm-phone-backfill.mjs dry-run share exactly the same rules.

export function normalizeCrmPhone(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  let d = s.replace(/[^0-9]/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("966")) d = d.slice(3).replace(/^0/, "");
  else if (d.startsWith("0")) d = d.slice(1);
  if (d.length === 9 && d.startsWith("5")) return "+966" + d;
  // Not a Saudi mobile: keep the original spelling, capped to Notion's field.
  return s.slice(0, 40);
}

// Find the first mobile written inside free text such as
// "… · الجوال: 0507224712 · البريد: …" (how older rows buried it in Notes).
// Returns "" when no digits follow the label — «الجوال: » with nothing after it
// is common and must not match.
export function phoneFromNotes(notes) {
  const m = String(notes || "").match(/الجوال\s*[:：]\s*(\+?[0-9][0-9\s-]{7,})/);
  if (!m) return "";
  const out = normalizeCrmPhone(m[1]);
  return /^\+9665\d{8}$/.test(out) ? out : "";
}
