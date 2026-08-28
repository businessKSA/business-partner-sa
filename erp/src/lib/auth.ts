/**
 * الجلسات والدخول واختيار المنشأة.
 *
 * ثلاث قواعد تحكم هذا الملف:
 *
 *  ١. المنشأة النشطة تُقرأ من الجلسة لا من الرابط ولا من مدخلات المستخدم.
 *     لو أخذناها من الرابط لكفى تغييرُ رقمٍ في شريط العنوان ليرى المستخدم
 *     دفاتر منشأة أخرى — وسياسات RLS نفسها ستُطبَّق بإخلاص على المنشأة
 *     الخطأ، لأنها تنفّذ ما يُقال لها.
 *
 *  ٢. التوكن لا يُخزَّن كما هو: تُخزَّن تجزئته. تسريب نسخة من جدول الجلسات
 *     لا يمنح المتسرّب جلسةً واحدة.
 *
 *  ٣. العضوية تُتحقَّق في كل طلب لا عند الدخول وحده. من أُخرج من منشأة
 *     يجب أن يفقد وصوله فوراً، لا بعد انتهاء جلسته.
 */
import { cookies } from 'next/headers';
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { prisma, withoutTenant } from './db.ts';
import { can, type Permission } from './rbac.ts';
import { PermissionError, DomainError } from './errors.ts';

const scrypt = promisify(scryptCb);

const COOKIE = 'erp_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ── كلمات المرور ────────────────────────────────────────────────────────

/** يُخزَّن الملح مع التجزئة في نصٍّ واحد: `salt:hash`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, 'hex');
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

// ── الجلسة ──────────────────────────────────────────────────────────────

export type SessionUser = {
  userId: string;
  email: string;
  name: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  roleCode: string;
  roleName: string;
  permissions: string[];
  isPlatformAdmin: boolean;
};

export async function createSession(
  userId: string,
  tenantId: string | null,
  meta: { ip?: string; userAgent?: string } = {},
): Promise<string> {
  const token = randomBytes(32).toString('hex');

  await prisma.session.create({
    data: {
      userId,
      tenantId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    },
  });

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });

  return token;
}

/**
 * يقرأ الجلسة الحالية ويعيد المستخدم ومنشأته وصلاحياته.
 *
 * يعيد `null` بلا رمي: الصفحات العامة تستدعيها كذلك، والرمي فيها يجعل
 * صفحة الدخول نفسها تتعطّل.
 */
export async function currentSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date() || !session.user.active) return null;
  if (!session.tenantId) return null;

  // العضوية تُقرأ في كل طلب: من أُخرج من المنشأة يفقد وصوله الآن لا بعد
  // انتهاء جلسته.
  const membership = await withoutTenant(
    'قراءة عضوية المستخدم لتحديد المنشأة النشطة وصلاحياتها',
    (tx) =>
      tx.membership.findFirst({
        where: { userId: session.userId, tenantId: session.tenantId!, active: true },
        include: { role: true, tenant: true },
      }),
  );

  if (!membership) return null;

  return {
    userId: session.userId,
    email: session.user.email,
    name: session.user.name,
    tenantId: membership.tenantId,
    tenantName: membership.tenant.nameAr,
    tenantSlug: membership.tenant.slug,
    roleCode: membership.role.code,
    roleName: membership.role.nameAr,
    permissions: (membership.role.permissions as string[]) ?? [],
    isPlatformAdmin: session.user.platformRole === 'PLATFORM_ADMIN',
  };
}

/** يوجب وجود جلسة — للصفحات المحمية. */
export async function requireSession(): Promise<SessionUser> {
  const session = await currentSession();
  if (!session) throw new DomainError('الجلسة منتهية. سجّل الدخول من جديد.', 'UNAUTHENTICATED');
  return session;
}

/** يوجب صلاحية بعينها. الرسالة تسمّي الصلاحية بالعربية. */
export async function requireAuth(permission: Permission | string): Promise<SessionUser> {
  const session = await requireSession();
  if (!can(session.permissions, permission)) throw new PermissionError(permission);
  return session;
}

export async function switchTenant(tenantId: string): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) throw new DomainError('لا جلسة نشطة.', 'UNAUTHENTICATED');

  const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!session) throw new DomainError('الجلسة غير موجودة.', 'UNAUTHENTICATED');

  // لا يُنتقل إلى منشأة بلا عضوية فيها — ولو عُرف معرّفها.
  const membership = await withoutTenant('التحقق من عضوية المستخدم قبل تبديل المنشأة', (tx) =>
    tx.membership.findFirst({ where: { userId: session.userId, tenantId, active: true } }),
  );
  if (!membership) throw new PermissionError('الوصول إلى هذه المنشأة');

  await prisma.session.update({ where: { id: session.id }, data: { tenantId } });
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  jar.delete(COOKIE);
}

/** منشآت المستخدم — لقائمة التبديل. */
export async function userTenants(userId: string) {
  return withoutTenant('عرض منشآت المستخدم في قائمة التبديل', (tx) =>
    tx.membership.findMany({
      where: { userId, active: true },
      include: { tenant: { select: { id: true, nameAr: true, slug: true, status: true } }, role: true },
      orderBy: { createdAt: 'asc' },
    }),
  );
}
