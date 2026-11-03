# وظيفة «حارس الموقع» (Azure Container Apps Job): رحلة العميل الكاملة بمتصفح حقيقي كل ٣٠ دقيقة، ثم إرسال التقرير إلى n8n.
# لا تُنشر تلقائياً — إنشاء المورد على Azure قرار المالك (انظر docs/site-guardian.md).
FROM mcr.microsoft.com/playwright:v1.49.1-jammy
WORKDIR /app
COPY ops/site-guardian/checks.mjs ops/site-guardian/run.mjs ops/site-guardian/
COPY site/assets/data/catalog.json site/assets/data/catalog.json
RUN mkdir -p node_modules && cd /app && npm init -y >/dev/null && npm i playwright-core@1.49.1 --silent
ENV GUARDIAN_CHROME=""
# يُمرَّر عند الإنشاء: GUARDIAN_WEBHOOK (رابط ويبهوك n8n) و GUARDIAN_KEY (سرّ Container Apps) — لا يُكتبان هنا.
CMD ["sh", "-c", "GUARDIAN_CHROME=$(node -e \"console.log(require('playwright-core').chromium.executablePath())\") node ops/site-guardian/run.mjs --base https://www.businesspartner.sa --mode full"]
