# صورة جسر قارئ واتساب ويب.
#
# سياق البناء هو **هذا المجلد** لا جذر المستودع: الجسر خدمة مستقلة لا تستورد
# شيئاً من `api/`، وتبعيتها (Baileys) في `ops/wa-bridge/package.json` وحده —
# إضافتها إلى package.json الجذر تكسر بناء Vercel.
#
#   docker build -t bp-wa-bridge ops/wa-bridge
#
# Baileys مقبس لا متصفّح: لا Chromium ولا Puppeteer، فالصورة تحت 200MB
# وتعمل بنصف نواة. هذا سبب اختيارها على whatsapp-web.js.
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production TZ=Asia/Riyadh

# التبعيات أولاً حتى تُستفاد ذاكرة الطبقات بين النشرات.
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src/ ./src/

# مستخدم غير جذر: الحاوية تحمل جلسة واتساب المالك — وهي أثمن ما فيها.
# مجلدا الحالة يُنشآن ويُملكان له؛ على Azure يُركَّب القرص الدائم على
# /data/auth فيبقى مالكه كما هو.
RUN mkdir -p /data/auth /data/queue \
 && addgroup -S bp && adduser -S bp -G bp \
 && chown -R bp:bp /app /data
USER bp

ENV WA_AUTH_DIR=/data/auth \
    WA_QUEUE_DIR=/data/queue \
    WA_SEND_ENABLED=0

# لا HEALTHCHECK: الجسر لا يفتح منفذاً. صحّته تُقرأ من السجل
# («الجلسة مفتوحة») ومن وصول الدفعات إلى n8n.
CMD ["node", "src/index.mjs"]
