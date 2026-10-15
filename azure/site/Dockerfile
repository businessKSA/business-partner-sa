# صورة الموقع على Azure Container Apps (تحلّ محل Vercel).
# سياق البناء جذر المستودع:  docker build -f azure/site/Dockerfile -t bp-site .
# الصفحات تُولَّد وقت البناء (npm run build) ثم يقدّمها azure/site/server.mjs مع api/.
FROM node:22-alpine AS build
WORKDIR /app
COPY . .
RUN npm install --omit=dev --no-audit --no-fund && npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production TZ=Asia/Riyadh PORT=8080
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/vercel.json ./
COPY --from=build /app/site ./site
COPY --from=build /app/api ./api
COPY --from=build /app/lib ./lib
COPY --from=build /app/azure/site ./azure/site
RUN addgroup -S bp && adduser -S bp -G bp && chown -R bp:bp /app
USER bp
EXPOSE 8080
CMD ["node", "azure/site/server.mjs"]
