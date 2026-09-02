import { redirect } from 'next/navigation';
import { inspectMagicLink, consumeMagicLink } from '@/lib/magic-link.ts';
import { createSession, currentSession } from '@/lib/auth.ts';
import { isDatabaseUnavailable } from '@/lib/errors.ts';

/**
 * فتح رابط الدخول.
 *
 * الفتح لا يُدخِل: يعرض زرّ تأكيد، والدخول يقع بالضغط عليه (`POST`).
 *
 * والسبب أن برامج البريد وأنظمة الحماية في المؤسسات تفتح الروابط آلياً
 * قبل أن يراها المرسَل إليه — تفحصها بحثاً عن تصيّد. فرابطٌ يُنشئ الجلسة
 * بمجرّد فتحه يُحرَق قبل أن يصل، فيجد صاحبه «رابطاً مستعمَلاً» ولم يلمسه.
 * والفاحص الآلي لا يضغط أزراراً ولا يرسل `POST`.
 *
 * وكل ما يمسّ القاعدة هنا محروسٌ بـ`isDatabaseUnavailable`: هذه الصفحة
 * هي التي **يهبط عليها الرابط القادم بالبريد**، فانهيارها بصفحة 500 يعني
 * أن من ضغط رابطه لا يرى إلا شاشةً بيضاء لا تقول شيئاً. وهي أولى بهذا
 * الحرس من شاشة الدخول نفسها.
 */
export default async function MagicPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token = '', error } = await searchParams;

  // التوجيه خارج `try` عمداً: `redirect` يعمل برمي استثناءٍ خاص، فلو وقع
  // داخل الكتلة لالتقطه `catch` وحُسب عطلَ قاعدةٍ وهو نجاح.
  let unavailable = false;
  let existing: Awaited<ReturnType<typeof currentSession>> = null;

  try {
    existing = await currentSession();
  } catch (e) {
    if (!isDatabaseUnavailable(e)) throw e;
    unavailable = true;
  }

  if (existing) redirect('/dashboard');

  let state: Awaited<ReturnType<typeof inspectMagicLink>> | null = null;
  if (!unavailable) {
    try {
      state = await inspectMagicLink(token);
    } catch (e) {
      if (!isDatabaseUnavailable(e)) throw e;
      unavailable = true;
    }
  }

  async function confirm(formData: FormData) {
    'use server';

    const t = String(formData.get('token') ?? '');

    let result: Awaited<ReturnType<typeof consumeMagicLink>> | null = null;
    let misconfigured = false;

    try {
      result = await consumeMagicLink(t);
    } catch (e) {
      if (!isDatabaseUnavailable(e)) throw e;
      console.error('✗ تأكيد رابط دخول وقاعدة البيانات غير متاحة:', e);
      misconfigured = true;
    }

    const back = `/auth/magic?token=${encodeURIComponent(t)}`;
    if (misconfigured) redirect(`${back}&error=config`);
    if (!result!.ok) redirect(`${back}&error=${result!.reason}`);

    await createSession(result!.userId, result!.tenantId);
    redirect('/dashboard');
  }

  const REASONS: Record<string, string> = {
    NOT_FOUND: 'هذا الرابط غير معروف. اطلب رابطاً جديداً.',
    EXPIRED: 'انتهت صلاحية الرابط. اطلب رابطاً جديداً — الروابط تُعمَّر ربع ساعة.',
    USED: 'استُعمل هذا الرابط من قبل. كل رابطٍ يعمل مرّةً واحدة.',
    INACTIVE: 'الحساب موقوف. تواصل مع مسؤول النظام.',
    NO_MEMBERSHIP: 'حسابك لا ينتمي إلى أي منشأة بعد. تواصل مع مسؤول النظام.',
  };

  const misconfigured = unavailable || error === 'config';
  const problem = misconfigured
    ? null
    : error
      ? REASONS[error]
      : state && !state.valid
        ? REASONS[state.reason]
        : null;

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
        </div>

        <div className="card">
          <div className="card-body">
            {misconfigured ? (
              <div className="alert error">
                <strong>النظام غير موصول بقاعدة بيانات</strong>
                رابطك سليمٌ على الأرجح، والخلل خلل إعداد لا فيك ولا فيه. على من
                ينشر النظام أن يضبط
                <span className="mono"> DATABASE_URL </span>
                في متغيّرات البيئة ثم يُعيد النشر. راجع
                <span className="mono"> docs/deploy.md</span>.
              </div>
            ) : problem ? (
              <>
                <div className="alert error">{problem}</div>
                <a className="btn primary" href="/login" style={{ width: '100%', justifyContent: 'center' }}>
                  طلب رابط جديد
                </a>
              </>
            ) : (
              <>
                <p style={{ marginTop: 0, marginBottom: 4 }}>
                  تأكيد الدخول باسم <strong dir="ltr">{state?.valid ? state.email : ''}</strong>
                </p>
                <p className="muted small" style={{ marginTop: 0 }}>
                  اضغط للمتابعة. الرابط يعمل مرّةً واحدة.
                </p>
                <form action={confirm}>
                  <input type="hidden" name="token" value={token} />
                  <button className="btn primary" type="submit" style={{ width: '100%', justifyContent: 'center' }}>
                    دخول
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
