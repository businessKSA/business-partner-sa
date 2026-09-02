/**
 * الدخول برابطٍ يصل بالبريد، بلا كلمة مرور.
 *
 * ── ثلاثة قرارات تحكم هذا الملف ────────────────────────────────────────
 *
 * **١. الرمز لا يُخزَّن.** يُخزَّن تجزئته (SHA-256) وحدها، كما تُخزَّن
 * الجلسات. فمن قرأ الجدول — نسخةً احتياطية أو استعلاماً مسرَّباً — لا يملك
 * رمزاً صالحاً للدخول باسم أحد. والعمود `tokenHash` مفهرسٌ فريداً، فالبحث
 * بالتجزئة لا بالمقارنة، ولا مجال لهجوم توقيت.
 *
 * **٢. الطلب لا يكشف من له حساب.** الردّ واحدٌ دائماً: «إن كان البريد
 * مسجَّلاً فقد أُرسل رابط». ومن أدخل بريداً غير مسجَّل يرى ما يراه صاحب
 * الحساب حرفاً بحرف. وإلّا صارت شاشةُ الدخول أداةَ استطلاعٍ تُعدّد موظّفي
 * المنشأة لمن يجرّب الأسماء.
 *
 * **٣. الرابط لا يُستهلك بفتحه.** وهذا أدقّ ما هنا: برامج البريد وأنظمة
 * الحماية في المؤسسات **تفتح الروابط آلياً** قبل أن يراها المرسَل إليه —
 * تفحصها بحثاً عن تصيّد. فرابطٌ يُنشئ الجلسة بمجرّد `GET` يُحرَق قبل أن
 * يصل، فيجد المستخدم «رابط مستعمَل» ولم يلمسه. ولهذا الفتحُ يعرض زرّ
 * تأكيد، والاستهلاك يقع في `POST` وحده — وهو ما لا يفعله فاحصٌ آلي.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { prisma, withoutTenant } from './db.ts';
import { sendMail } from './mail.ts';

/** مدّة صلاحية الرابط. قصيرةٌ عمداً: رابطٌ في بريدٍ مفتوح ساعاتٍ خطرٌ نائم. */
export const MAGIC_TTL_MS = 15 * 60 * 1000;

/** أقصى عدد طلبات لبريدٍ واحد داخل النافذة، كي لا تُغرَق أي علبة بريد. */
export const MAX_REQUESTS_PER_WINDOW = 5;
export const RATE_WINDOW_MS = 15 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function appUrl(): string {
  return (process.env.APP_URL || 'http://localhost:3100').replace(/\/+$/, '');
}

export type RequestOutcome =
  | { sent: true }
  /** يُعاد للمتصل لا للزائر: الزائر يرى الرسالة المحايدة نفسها دائماً. */
  | { sent: false; reason: 'UNKNOWN_EMAIL' | 'INACTIVE' | 'NO_MEMBERSHIP' | 'RATE_LIMITED' };

/**
 * يُنشئ رابط دخول ويرسله.
 *
 * ويعيد سببَ عدم الإرسال للمتصل ليُسجّله، **ولا يُعرض للزائر**: الواجهة
 * تكتب الرسالة المحايدة نفسها في كل الحالات.
 */
export async function requestMagicLink(
  emailRaw: string,
  meta: { purpose?: string } = {},
): Promise<RequestOutcome> {
  const email = emailRaw.trim().toLowerCase();
  if (!email || !email.includes('@')) return { sent: false, reason: 'UNKNOWN_EMAIL' };

  const since = new Date(Date.now() - RATE_WINDOW_MS);
  const recent = await prisma.magicLink.count({
    where: { email, createdAt: { gte: since } },
  });
  if (recent >= MAX_REQUESTS_PER_WINDOW) return { sent: false, reason: 'RATE_LIMITED' };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { sent: false, reason: 'UNKNOWN_EMAIL' };
  if (!user.active) return { sent: false, reason: 'INACTIVE' };

  // مالك المنصة قد لا ينتمي إلى منشأة، وله مع ذلك لوحته. أمّا من لا منشأة
  // له ولا صفة منصة فلا وجهة له بعد الدخول.
  const membership = await withoutTenant('فحص عضوية المستخدم قبل إرسال رابط الدخول', (tx) =>
    tx.membership.findFirst({ where: { userId: user.id, active: true } }),
  );
  if (!membership && user.platformRole !== 'PLATFORM_ADMIN') {
    return { sent: false, reason: 'NO_MEMBERSHIP' };
  }

  // طلبٌ جديد يُبطل ما سبقه: من طلب رابطاً ثانياً لأن الأول تأخّر، لا يصحّ
  // أن يبقى الأول صالحاً في علبة بريده أسبوعاً.
  await prisma.magicLink.updateMany({
    where: { email, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });

  const token = randomBytes(32).toString('hex');
  await prisma.magicLink.create({
    data: {
      userId: user.id,
      email,
      tokenHash: hashToken(token),
      purpose: meta.purpose ?? 'LOGIN',
      expiresAt: new Date(Date.now() + MAGIC_TTL_MS),
    },
  });

  const url = `${appUrl()}/auth/magic?token=${token}`;
  const minutes = Math.round(MAGIC_TTL_MS / 60000);

  await sendMail({
    to: email,
    subject: 'رابط الدخول إلى نظام بزنس بارتنر',
    text:
      `مرحباً،\n\n` +
      `اضغط الرابط أدناه للدخول إلى النظام. يبقى صالحاً ${minutes} دقيقة ` +
      `ويعمل مرّةً واحدة:\n\n${url}\n\n` +
      `إن لم تطلب هذا الرابط فتجاهل الرسالة — لن يدخل أحدٌ بحسابك ما لم ` +
      `يفتح هذا الرابط من بريدك.\n`,
    html:
      `<div dir="rtl" style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.8">` +
      `<p>مرحباً،</p>` +
      `<p>اضغط الزر أدناه للدخول إلى النظام. يبقى صالحاً <strong>${minutes} دقيقة</strong> ويعمل مرّةً واحدة:</p>` +
      `<p><a href="${url}" style="display:inline-block;background:#0B1B5A;color:#fff;` +
      `padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:600">دخول</a></p>` +
      `<p style="color:#4a4f5e;font-size:14px">إن لم تطلب هذا الرابط فتجاهل الرسالة — ` +
      `لن يدخل أحدٌ بحسابك ما لم يفتح هذا الرابط من بريدك.</p></div>`,
  });

  return { sent: true };
}

export type LinkState =
  | { valid: true; email: string; userId: string }
  | { valid: false; reason: 'NOT_FOUND' | 'EXPIRED' | 'USED' };

/**
 * يفحص الرابط **دون أن يستهلكه**. تستدعيه صفحة الفتح لتعرض زرّ التأكيد.
 */
export async function inspectMagicLink(token: string): Promise<LinkState> {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return { valid: false, reason: 'NOT_FOUND' };

  const link = await prisma.magicLink.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!link || !link.userId) return { valid: false, reason: 'NOT_FOUND' };
  if (link.usedAt) return { valid: false, reason: 'USED' };
  if (link.expiresAt <= new Date()) return { valid: false, reason: 'EXPIRED' };

  return { valid: true, email: link.email, userId: link.userId };
}

export type ConsumeResult =
  | { ok: true; userId: string; tenantId: string | null }
  | { ok: false; reason: 'NOT_FOUND' | 'EXPIRED' | 'USED' | 'INACTIVE' | 'NO_MEMBERSHIP' };

/**
 * يستهلك الرابط ويعيد صاحبه ومنشأته. يُستدعى من `POST` وحده.
 *
 * والتحديث مشروطٌ بـ`usedAt: null` داخل استعلامٍ واحد: ضغطتان متزامنتان
 * على زرّ التأكيد تُحدِّث إحداهما صفراً من الصفوف، فلا تُنشأ جلستان من
 * رابطٍ واحد.
 */
export async function consumeMagicLink(token: string): Promise<ConsumeResult> {
  const state = await inspectMagicLink(token);
  if (!state.valid) return { ok: false, reason: state.reason };

  const claimed = await prisma.magicLink.updateMany({
    where: { tokenHash: hashToken(token), usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) return { ok: false, reason: 'USED' };

  const user = await prisma.user.findUnique({ where: { id: state.userId } });
  if (!user || !user.active) return { ok: false, reason: 'INACTIVE' };

  const membership = await withoutTenant('تحديد المنشأة بعد الدخول برابط', (tx) =>
    tx.membership.findFirst({
      where: { userId: user.id, active: true },
      orderBy: { createdAt: 'asc' },
    }),
  );

  if (!membership && user.platformRole !== 'PLATFORM_ADMIN') {
    return { ok: false, reason: 'NO_MEMBERSHIP' };
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return { ok: true, userId: user.id, tenantId: membership?.tenantId ?? null };
}

/**
 * يحذف الروابط المنتهية أو المستعملة. يُنادى من مهمّة دورية أو يدوياً.
 * إبقاؤها بلا داعٍ يُراكم تجزئاتٍ لا تنفع أحداً في جدولٍ يُنسخ احتياطياً.
 */
export async function purgeExpiredMagicLinks(olderThan: Date = new Date()): Promise<number> {
  const res = await prisma.magicLink.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: olderThan } }, { usedAt: { not: null } }],
    },
  });
  return res.count;
}

/** يُصدَّر للاختبار: يُثبت أن المقارنة تقع على التجزئة لا على الرمز. */
export function tokenMatchesHash(token: string, storedHash: string): boolean {
  const a = Buffer.from(hashToken(token), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
