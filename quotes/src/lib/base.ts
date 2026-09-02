/**
 * جذر اللوحة وعنوانها العام.
 *
 * اللوحة تُخدَم تحت نطاق الموقع على /quotes (basePath في next.config). فكل
 * رابطٍ يُبنى نصّاً — رابط مستندٍ في بريد، رابط دخول، عودة من بوابة دفع —
 * يجب أن يحمل الجذر، وإلا وصل العميل إلى «غير موجود».
 *
 * APP_URL هو المرجع حين يُضبط (https://www.businesspartner.sa/quotes). وبلا
 * ضبطٍ يُشتقّ من أصل الطلب مع الجذر — لا الأصل وحده: الأصل تحت التمرير هو
 * bp-quotes-three.vercel.app، ولو أُعيد إليه العميل لخرج من نطاق الموقع.
 */
export const BASE_PATH = '/quotes';

export function appBase(req?: { url: string }): string {
  const env = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (env) return env;
  const origin = req ? new URL(req.url).origin : 'http://localhost:3000';
  return `${origin}${BASE_PATH}`;
}
