/**
 * الدخول: لوحة التحكم ببريدي فقط عبر رابط سحري، وبوابة العميل برابط سحري
 * يصله بالبريد بلا كلمة مرور. الجلسة كوكي موقّع بـHMAC.
 */
import { cookies } from 'next/headers';
import { prisma } from './db';
import { hmac, safeEqual, shortToken } from './tokens';
import { appBase } from './base';

const ADMIN_COOKIE = 'bp_admin';
const CLIENT_COOKIE = 'bp_client';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 ساعة
export const MAGIC_LINK_TTL_MIN = 30;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error('SESSION_SECRET غير معرّف أو قصير جداً — عيّنه في ملف .env');
  }
  return s;
}

export function adminEmail(): string {
  return (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
}

function sign(payload: string): string {
  return `${payload}.${hmac(secret(), payload)}`;
}

function verify(signed: string | undefined): string | null {
  if (!signed) return null;
  const idx = signed.lastIndexOf('.');
  if (idx <= 0) return null;
  const payload = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  const expected = hmac(secret(), payload);
  if (sig.length !== expected.length || !safeEqual(sig, expected)) return null;
  const [, expStr] = payload.split('|');
  if (!expStr || Number(expStr) < Date.now()) return null;
  return payload;
}

// ------------------------------------------------------------------- الروابط
export async function createMagicLink(
  email: string,
  purpose: 'ADMIN' | 'CLIENT',
  clientId?: string,
): Promise<string> {
  const token = shortToken(32);
  await prisma.magicLink.create({
    data: {
      token,
      email: email.toLowerCase(),
      purpose,
      clientId: clientId ?? null,
      expiresAt: new Date(Date.now() + MAGIC_LINK_TTL_MIN * 60_000),
    },
  });
  const base = appBase();
  return purpose === 'ADMIN' ? `${base}/admin/login/${token}` : `${base}/portal/enter/${token}`;
}

/** يستهلك الرابط مرة واحدة فقط. */
export async function consumeMagicLink(token: string) {
  const link = await prisma.magicLink.findUnique({ where: { token } });
  if (!link) return null;
  if (link.usedAt || link.expiresAt.getTime() < Date.now()) return null;
  await prisma.magicLink.update({ where: { token }, data: { usedAt: new Date() } });
  return link;
}

// ------------------------------------------------------------------ الجلسات
export async function startAdminSession(email: string) {
  const exp = Date.now() + SESSION_TTL_MS;
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, sign(`admin:${email.toLowerCase()}|${exp}`), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function startClientSession(clientId: string) {
  const exp = Date.now() + SESSION_TTL_MS;
  const jar = await cookies();
  jar.set(CLIENT_COOKIE, sign(`client:${clientId}|${exp}`), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function endSessions() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  jar.delete(CLIENT_COOKIE);
}

export async function currentAdmin(): Promise<string | null> {
  const jar = await cookies();
  const payload = verify(jar.get(ADMIN_COOKIE)?.value);
  if (!payload) return null;
  const email = payload.split('|')[0].replace(/^admin:/, '');
  return email === adminEmail() ? email : null;
}

export async function requireAdmin(): Promise<string> {
  const email = await currentAdmin();
  if (!email) throw new Error('UNAUTHORIZED');
  return email;
}

export async function currentClientId(): Promise<string | null> {
  const jar = await cookies();
  const payload = verify(jar.get(CLIENT_COOKIE)?.value);
  if (!payload) return null;
  return payload.split('|')[0].replace(/^client:/, '') || null;
}

export async function requireClient(): Promise<string> {
  const id = await currentClientId();
  if (!id) throw new Error('UNAUTHORIZED');
  return id;
}
