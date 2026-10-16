# لوحة العروض والعقود (bp-quotes) — صورة Azure Container Apps.
# السياق (build context) هو مجلد quotes/ نفسه:  docker build -t bp-quotes quotes/
# لا سرّ في هذه الصورة: كل الأسرار تأتي من بيئة التشغيل (Container Apps secrets).
# ملاحظة: prisma/catalog-import.ts يقرأ ../site/assets/data/catalog.json وهو خارج
# هذا السياق، لذلك لا يعمل داخل الصورة — ولا يُشغَّل عند الإقلاع أصلاً (انظر
# docs/azure-migration.md).

# ---------------------------------------------------------------- التبعيات
FROM node:22-bookworm-slim AS deps
WORKDIR /app
# openssl: محرك Prisma يحتاجه. ca-certificates: الاتصال بـ PostgreSQL على Azure عبر TLS.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# ------------------------------------------------------------------ البناء
FROM deps AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
# prisma generate لا يتصل بالقاعدة. أما next build فقد يستورد وحدات تقرأ
# DATABASE_URL عند التحميل، فيُمرَّر عنوان وهمي لهذه المرحلة وحدها؛
# لا يبقى في الصورة النهائية (ENV هنا في مرحلة build فقط، والتشغيل من مرحلة runtime).
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    DIRECT_DATABASE_URL="postgresql://build:build@localhost:5432/build"
# "build" = prisma generate && next build  (وليس vercel-build الذي يلمس القاعدة)
RUN npm run build

# ------------------------------------------------------------------ التشغيل
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

# Chromium لتوليد الـPDF: pdf.ts يطبع صفحة المستند عبر playwright-core.
# نستعمل Chromium من النظام (PDF_DRIVER=local + CHROMIUM_PATH) بدل
# @sparticuz/chromium لأنه مصمَّم لبيئة Lambda/Vercel. الحزمة تبقى في
# node_modules ولا تُستعمل. fonts-noto-core احتياط؛ خط Tajawal محلي في public/fonts.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      chromium openssl ca-certificates tini fonts-noto-core fonts-liberation \
 && rm -rf /var/lib/apt/lists/*

# إعدادات غير سرّية فقط. ما سواها (DATABASE_URL, SESSION_SECRET, …) من بيئة التشغيل.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    PDF_DRIVER=local \
    CHROMIUM_PATH=/usr/bin/chromium \
    INTERNAL_URL=http://localhost:3000/quotes \
    STORAGE_DRIVER=local \
    STORAGE_ROOT=/data/storage \
    QUEUE_DRIVER=inline

# مجلد التخزين: يُركَّب عليه Azure Files (uid/gid 1000 = المستخدم node).
RUN mkdir -p /data/storage && chown -R node:node /data
COPY --from=build --chown=node:node /app /app

USER node
EXPOSE 3000

# المسار تحت basePath. /quotes/api/health بلا تسجيل دخول وبلا أسرار.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/quotes/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# لا prisma db push ولا seed عند الإقلاع — عمداً (راجع docs/azure-migration.md).
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node_modules/.bin/next", "start", "-p", "3000", "-H", "0.0.0.0"]
