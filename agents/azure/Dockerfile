# صورة فريق Business Partner على Azure Container Apps.
#
# سياق البناء هو **جذر المستودع** لا هذا المجلد: الوكلاء يستوردون
# `api/_catalog.js` و`api/_db.js` — مصدر الأسعار وطبقة القاعدة نفسها التي
# يستعملها الموقع. نسخُهما هنا كان سيعني نسختين تتفارقان، وقد رأينا ذلك.
#
#   docker build -f agents/azure/Dockerfile -t bp-agents .
#
# بلا `npm install`: المستودع بلا تبعيات، والوكلاء كذلك — فالصورة صغيرة
# وتقلع في ثوانٍ، وهو ما يجعل مهمةً مجدولة رخيصة بدل حاوية تعيش بلا عمل.
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production TZ=Asia/Riyadh

COPY api/ ./api/
COPY agents/prompts/ ./agents/prompts/
COPY agents/azure/ ./agents/azure/

# مستخدم غير جذر: الحاوية تحمل مفاتيح إنتاج وتنادي قاعدة عملاء.
RUN addgroup -S bp && adduser -S bp -G bp && chown -R bp:bp /app
USER bp

ENTRYPOINT ["node", "agents/azure/job.mjs"]
CMD ["morning"]
