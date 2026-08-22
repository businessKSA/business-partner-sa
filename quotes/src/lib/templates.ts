/**
 * محمّل القوالب: كل النصوص القالبية في مجلد templates/ ويمكن تعديلها
 * دون لمس الكود. تُقرأ من القرص وتُخزَّن مؤقتاً في الإنتاج فقط.
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'templates');
const cache = new Map<string, unknown>();

export function loadTemplate<T = Record<string, unknown>>(name: string): T {
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && cache.has(name)) return cache.get(name) as T;
  const file = path.join(DIR, name);
  const raw = fs.readFileSync(file, 'utf8');
  const parsed = file.endsWith('.json') ? JSON.parse(raw) : (raw as unknown);
  if (isProd) cache.set(name, parsed);
  return parsed as T;
}

export function loadText(name: string): string {
  const isProd = process.env.NODE_ENV === 'production';
  const key = `text:${name}`;
  if (isProd && cache.has(key)) return cache.get(key) as string;
  const raw = fs.readFileSync(path.join(DIR, name), 'utf8');
  if (isProd) cache.set(key, raw);
  return raw;
}

/** استبدال {{key}} بالقيم. المفاتيح المفقودة تُترك فارغة لا كـ undefined. */
export function render(tpl: string, vars: Record<string, string | number | null | undefined>): string {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, k: string) => {
    const v = vars[k];
    return v === null || v === undefined ? '' : String(v);
  });
}

export function renderDeep<T>(value: T, vars: Record<string, string | number | null | undefined>): T {
  if (typeof value === 'string') return render(value, vars) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => renderDeep(v, vars)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = renderDeep(v, vars);
    return out as unknown as T;
  }
  return value;
}
