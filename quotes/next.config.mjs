/** @type {import('next').NextConfig} */
const nextConfig = {
  // playwright-core و@prisma/client يجب أن يبقيا خارج حزمة الـbundler
  serverExternalPackages: ['playwright-core', '@prisma/client', 'nodemailer'],
  outputFileTracingIncludes: {
    '/**': ['./templates/**/*', './config/**/*'],
  },
};
export default nextConfig;
