import crypto from 'node:crypto';

/** توكن طويل غير قابل للتخمين للروابط العامة (256 بت). */
export function publicToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function shortToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** مقارنة ثابتة الزمن لمنع هجمات التوقيت. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function sha256(input: string | Buffer): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function hmac(key: string, payload: string | Buffer, enc: 'hex' | 'base64' = 'base64'): string {
  return crypto.createHmac('sha256', key).update(payload).digest(enc);
}
