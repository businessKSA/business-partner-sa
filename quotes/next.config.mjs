/** @type {import('next').NextConfig} */
const nextConfig = {
  // اللوحة تعيش تحت نطاق الموقع: businesspartner.sa/quotes/… — لا نطاق ثانٍ
  // يراه العميل ولا يحفظه. الموقع يمرّر /quotes/* إلى هذا التطبيق، وهذا
  // التطبيق يعرف أن جذره /quotes فيسبق به روابطه وأصوله كلها.
  basePath: '/quotes',

  // playwright-core و@prisma/client يجب أن يبقيا خارج حزمة الـbundler
  serverExternalPackages: ['playwright-core', '@sparticuz/chromium', '@prisma/client', 'nodemailer', 'docx'],
  outputFileTracingIncludes: {
    '/**': ['./templates/**/*', './config/**/*'],
  },

  // الروابط القديمة تبقى حيّة. بريدٌ أُرسل قبل النقل يحمل
  // bp-quotes-three.vercel.app/d/… بلا /quotes، وعميلٌ يفتحه بعد شهر يجب أن
  // يصل إلى مستنده لا إلى «غير موجود». basePath: false يجعل المصدر يُطابَق
  // خارج الجذر الجديد، والوجهة تُسبق به.
  //
  // و/api ضمنها احتياطاً لمن ينادي المسار القديم من خادم — بـ308 التي تحفظ
  // الفعل والجسم — لكن كل المنادين المعروفين حُوِّلوا إلى المسار الجديد
  // صراحةً؛ التحويل شبكة أمان لا اعتماد.
  async redirects() {
    const legacy = ['/admin', '/portal', '/d', '/rfp', '/api'];
    return [
      { source: '/', destination: '/quotes', basePath: false, permanent: false },
      ...legacy.flatMap((p) => [
        { source: p, destination: `/quotes${p}`, basePath: false, permanent: true },
        { source: `${p}/:path*`, destination: `/quotes${p}/:path*`, basePath: false, permanent: true },
      ]),
    ];
  },
};
export default nextConfig;
