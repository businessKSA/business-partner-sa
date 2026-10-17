// ops/wa-bridge/src/dotenv.mjs
// محمّل .env بسيط بلا تبعيات. Node لا يقرأ .env تلقائياً، و`--env-file`
// يحتاج Node 20.6+ و`--env-file-if-exists` يحتاج 22 — فنقرؤه هنا ليعمل
// على أي إصدار ≥20، ولئلا يسقط التشغيل حين لا يوجد الملف أصلاً.
// لا يدهس متغيّراً موجوداً في البيئة: أسرار Azure تسبق الملف المحلي.
import { readFileSync, existsSync } from 'node:fs';

export function loadEnvFile(path = new URL('../.env', import.meta.url)) {
  if (!existsSync(path)) return 0;
  let n = 0;
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Z_][A-Z0-9_]*$/i.test(key)) continue;
    if (process.env[key] !== undefined) continue;
    let val = line.slice(eq + 1).trim();
    if (val.length > 1 && ((val[0] === '"' && val.at(-1) === '"') || (val[0] === "'" && val.at(-1) === "'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
    n++;
  }
  return n;
}
