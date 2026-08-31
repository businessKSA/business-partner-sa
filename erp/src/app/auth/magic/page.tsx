import { redirect } from 'next/navigation';
import { inspectMagicLink, consumeMagicLink } from '@/lib/magic-link.ts';
import { createSession, currentSession } from '@/lib/auth.ts';

/**
 * فتح رابط الدخول.
 *
 * الفتح لا يُدخِل: يعرض زرّ تأكيد، والدخول يقع بالضغط عليه (`POST`).
 *
 * والسبب أن برامج البريد وأنظمة الحماية في المؤسسات تفتح الروابط آلياً
 * قبل أن يراها المرسَل إليه — تفحصها بحثاً عن تصيّد. فرابطٌ يُنشئ الجلسة
 * بمجرّد فتحه يُحرَق قبل أن يصل، فيجد صاحبه «رابطاً مستعمَلاً» ولم يلمسه.
 * والفاحص الآلي لا يضغط أزراراً ولا يرسل `POST`.
 */
export default async function MagicPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const existing = await currentSession();
  if (existing) redirect('/dashboard');

  const { token = '', error } = await searchParams;
  const state = await inspectMagicLink(token);

  async function confirm(formData: FormData) {
    'use server';

    const t = String(formData.get('token') ?? '');
    const result = await consumeMagicLink(t);

    if (!result.ok) {
      redirect(`/auth/magic?token=${encodeURIComponent(t)}&error=${result.reason}`);
    }

    await createSession(result.userId, result.tenantId);
    redirect('/dashboard');
  }

  const REASONS: Record<string, string> = {
    NOT_FOUND: 'هذا الرابط غير معروف. اطلب رابطاً جديداً.',
    EXPIRED: 'انتهت صلاحية الرابط. اطلب رابطاً جديداً — الروابط تُعمَّر ربع ساعة.',
    USED: 'استُعمل هذا الرابط من قبل. كل رابطٍ يعمل مرّةً واحدة.',
    INACTIVE: 'الحساب موقوف. تواصل مع مسؤول النظام.',
    NO_MEMBERSHIP: 'حسابك لا ينتمي إلى أي منشأة بعد. تواصل مع مسؤول النظام.',
  };

  const problem = error ? REASONS[error] : !state.valid ? REASONS[state.reason] : null;

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
            {problem ? (
              <>
                <div className="alert error">{problem}</div>
                <a className="btn primary" href="/login" style={{ width: '100%', justifyContent: 'center' }}>
                  طلب رابط جديد
                </a>
              </>
            ) : (
              <>
                <p style={{ marginTop: 0, marginBottom: 4 }}>
                  تأكيد الدخول باسم <strong dir="ltr">{state.valid ? state.email : ''}</strong>
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
