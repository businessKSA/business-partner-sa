/**
 * جذر اللوحة وعنوانها العام.
 *
 * اللوحة تُخدَم تحت نطاق الموقع على /quotes (basePath في next.config). فكل
 * رابطٍ يُبنى نصّاً — رابط مستندٍ في بريد، رابط دخول، عودة من بوابة دفع —
 * يجب أن يحمل الجذر، وإلا وصل العميل إلى «غير موجود».
 *
 * ولا يكفي أن يُضبط APP_URL صحيحاً: مضيف مشروع اللوحة على Vercel
 * (bp-quotes-three.vercel.app) هو ما يصل إليه الطلب فعلاً تحت التمرير، وهو
 * ما كان مضبوطاً في المتغيّر قبل توحيد النطاق. فلو أُخذ كما هو خرج العميل
 * من نطاق الموقع في كل رابطٍ يصله. لذلك يُقوَّم العنوان هنا لا في لوحة
 * Vercel: أي مضيف vercel.app يُردّ إلى النطاق الرسمي، وأي عنوانٍ بلا الجذر
 * يُلحق به الجذر. فيبقى ضبط المتغيّر تفضيلاً لا شرطاً لصحّة الروابط.
 */
export const BASE_PATH = '/quotes';

/** النطاق الرسمي الذي يراه العميل — وحده يظهر في رسالة أو مستند. */
export const CANONICAL_BASE = `https://www.businesspartner.sa${BASE_PATH}`;

function withBasePath(origin: string, pathname: string): string {
  const path = pathname.replace(/\/+$/, '');
  return path.endsWith(BASE_PATH) ? `${origin}${path}` : `${origin}${path}${BASE_PATH}`;
}

/** يُقوّم عنواناً مكتوباً؛ ويعيد null إن لم يكن عنواناً صالحاً أصلاً. */
function normalize(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (/(^|\.)vercel\.app$/i.test(u.hostname)) return CANONICAL_BASE;
  return withBasePath(u.origin, u.pathname);
}

export function appBase(req?: { url: string }): string {
  const env = (process.env.APP_URL || '').trim();
  if (env) {
    const fromEnv = normalize(env);
    if (fromEnv) return fromEnv;
  }
  if (req) {
    const fromReq = normalize(new URL(req.url).origin);
    if (fromReq) return fromReq;
  }
  return `http://localhost:3000${BASE_PATH}`;
}
