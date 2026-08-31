import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db.ts';
import { verifyPassword, createSession, currentSession } from '@/lib/auth.ts';
import { withoutTenant } from '@/lib/db.ts';
import { requestMagicLink } from '@/lib/magic-link.ts';
import { PasswordFallback } from './password-fallback.tsx';

/**
 * صفحة الدخول.
 *
 * رسالة الفشل واحدة لكل الحالات: «البريد أو كلمة المرور غير صحيحة». التمييز
 * بين «لا يوجد مستخدم» و«كلمة المرور خطأ» يمنح من يجرّب أسماءً وسيلةً
 * لمعرفة من له حسابٌ في النظام ومن لا.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const session = await currentSession();
  if (session) redirect('/dashboard');

  const { error, sent } = await searchParams;

  /**
   * طلب رابط الدخول.
   *
   * الوجهة واحدة مهما كانت النتيجة — `?sent=1` — ولا تُمرَّر أي إشارة
   * تفرّق بين بريدٍ مسجَّل وآخر ليس كذلك. وإلّا صارت شاشة الدخول أداةَ
   * استطلاعٍ تُعدّد موظّفي المنشأة لمن يجرّب الأسماء.
   */
  async function sendLink(formData: FormData) {
    'use server';

    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    const outcome = await requestMagicLink(email);

    if (!outcome.sent) {
      console.log(`↷ لم يُرسل رابط دخول إلى «${email}»: ${outcome.reason}`);
    }

    redirect('/login?sent=1');
  }

  async function signIn(formData: FormData) {
    'use server';

    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    const password = String(formData.get('password') ?? '');

    if (!email || !password) redirect('/login?error=1');

    const user = await prisma.user.findUnique({ where: { email } });

    // نتحقّق من كلمة المرور حتى حين لا يوجد المستخدم: الردّ الفوري بالرفض
    // يكشف بفارق الزمن أن البريد غير مسجَّل.
    const stored = user?.passwordHash ?? 'x:0000000000000000000000000000000000000000000000000000000000000000';
    const ok = await verifyPassword(password, stored);

    if (!user || !user.active || !ok) redirect('/login?error=1');

    const membership = await withoutTenant('تحديد المنشأة الافتراضية عند الدخول', (tx) =>
      tx.membership.findFirst({
        where: { userId: user.id, active: true },
        orderBy: { createdAt: 'asc' },
      }),
    );

    if (!membership) redirect('/login?error=2');

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await createSession(user.id, membership.tenantId);

    redirect('/dashboard');
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg)', padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 21, fontWeight: 700, color: 'var(--brand)' }}>
            بزنس بارتنر — ERP
          </div>
          <div className="muted small" style={{ marginTop: 4 }}>
            نظام تخطيط موارد المؤسسات
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            {error === '1' ? (
              <div className="alert error">البريد أو كلمة المرور غير صحيحة.</div>
            ) : null}
            {error === '2' ? (
              <div className="alert warn">
                حسابك لا ينتمي إلى أي منشأة بعد. تواصل مع مسؤول النظام.
              </div>
            ) : null}

            {sent === '1' ? (
              <div className="alert ok">
                <strong>راجِع بريدك</strong>
                إن كان البريد مسجَّلاً فقد أُرسل إليه رابط دخول. يبقى صالحاً
                ربع ساعة ويعمل مرّةً واحدة.
              </div>
            ) : null}

            <form action={sendLink}>
              <div className="field">
                <label htmlFor="email">البريد الإلكتروني</label>
                <input id="email" name="email" type="email" required autoComplete="username"
                  dir="ltr" style={{ textAlign: 'left' }} />
                <div className="help">
                  يصلك رابط دخول بالبريد — بلا كلمة مرور.
                </div>
              </div>

              <button className="btn primary" type="submit" style={{ width: '100%', justifyContent: 'center' }}>
                أرسِل رابط الدخول
              </button>
            </form>

            <PasswordFallback action={signIn} />
          </div>
        </div>

        <p className="muted small" style={{ textAlign: 'center', marginTop: 14 }}>
          نظام محاسبي متوافق مع هيئة الزكاة والضريبة والدخل
        </p>
      </div>
    </div>
  );
}
