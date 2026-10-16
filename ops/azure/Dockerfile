# syntax=docker/dockerfile:1
# Business Partner — صورة الموقع + API لـ Azure Container Apps.
#
# الصورة الواحدة تخدم ثلاثة أدوار بأمر مختلف:
#   • الموقع والـAPI (افتراضياً):   node ops/azure/server.mjs
#   • المهام المجدولة:               node ops/azure/cron.mjs <رقم>     (Container Apps Job)
#   • فحص التكافؤ من داخل الشبكة:    node ops/azure/parity.mjs ...
#
# البناء من جذر المستودع (السياق = .):
#   docker build -f ops/azure/Dockerfile -t bp-site:local \
#     --build-arg BP_BUILD_SHA=$(git rev-parse --short HEAD) .
# أو بلا Docker محلي (يبني في ACR):  az acr build -r <سجل> -t bp-site:<sha> -f ops/azure/Dockerfile .
#
# لماذا يُبنى الموقع داخل الصورة: Vercel كان يبني الصفحات عند كل نشرة بمتغيّرات
# بيئة المشروع (GOOGLE_CLIENT_ID وPORTAL_URL… تُكتب في الصفحات وقت البناء).
# القيم هنا وسيطات بناء عامة (ليست أسراراً) — انظر docs/azure-migration-2026-10-11.md §5.
# الأسرار (مفاتيح الدفع، قاعدة البيانات…) لا تدخل الصورة أبداً: تُحقن عند التشغيل.

ARG NODE_VERSION=22

# ---------------------------------------------------------------- build ----
FROM node:${NODE_VERSION}-slim AS build
WORKDIR /app

# اعتمادية الإنتاج الوحيدة (pg). أمر البناء نفسه بلا اعتماديات خارجية.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# فقط ما يحتاجه البناء والتشغيل؛ docs/ وtests/ وquotes/ خارج الصورة (انظر Dockerfile.dockerignore).
COPY api ./api
COPY lib ./lib
COPY n8n ./n8n
COPY site ./site
COPY vercel.json ./
COPY ops/azure ./ops/azure

# قيم تُكتب في الصفحات وقت البناء. انسخها من Vercel → Settings → Environment Variables
# (الإنتاج) إلى GitHub → Settings → Variables؛ الفارغ يعني «غير مضبوط» كما هو على Vercel.
ARG GOOGLE_CLIENT_ID=""
ARG PORTAL_URL=""
ARG SIMPLE_V1=""
ARG COMPANY_LEGAL_NAME=""
ARG COMPANY_CR_NUMBER=""
ARG COMPANY_UNIFIED_NUMBER=""
ARG COMPANY_VAT_NUMBER=""
ARG CATALOG_FROM_PANEL=""

# VERCEL=1: site/scripts/hidden.mjs لا يعيد كتابة vercel.json أثناء البناء (يُلتزَم ناتجه محلياً).
# الاسم قديم، والأثر الوحيد لهذا المتغيّر في المستودع هو ذلك الفحص.
ENV VERCEL=1
# وسيطات ARG تظهر لأمر RUN كمتغيّرات بيئة؛ الفارغ منها يُقرأ «غير مضبوط» في سكربتات البناء.
RUN npm run build

# -------------------------------------------------------------- runtime ----
FROM node:${NODE_VERSION}-slim AS runtime
ARG BP_BUILD_SHA=dev
ENV NODE_ENV=production \
    BP_BUILD_SHA=${BP_BUILD_SHA} \
    PORT=8080
WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/api ./api
COPY --from=build --chown=node:node /app/lib ./lib
COPY --from=build --chown=node:node /app/site ./site
COPY --from=build --chown=node:node /app/vercel.json ./vercel.json
COPY --from=build --chown=node:node /app/ops/azure ./ops/azure

# لا جذر داخل الحاوية.
USER node
EXPOSE 8080

# Container Apps يفحص الصحة بنفسه (انظر الخطة)، وهذا للتشغيل خارجها.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/__health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

CMD ["node", "ops/azure/server.mjs"]
