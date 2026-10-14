# صورة جسر قارئ واتساب — محرّك **متصفح حقيقي**.
#
# سياق البناء هو **هذا المجلد** لا جذر المستودع ولا `ops/wa-bridge`:
#
#   docker build -t bp-wa-bridge-web ops/wa-bridge-web
#
# ولماذا مجلد وصورة وحاوية مستقلة عن `ops/wa-bridge`:
# Chromium يضخّم الصورة من نحو 180MB إلى أكثر من غيغابايت، ويرفع الذاكرة
# من نصف غيغ إلى اثنين. دمج المحرّكين يُثقل الجسر الخفيف الذي **يعمل الآن**
# بلا سبب. والعزل مبدأ قائم في التصميم أصلاً: حظر رقم أو عطله لا يُسقط الآخر.
#
# ولماذا debian لا alpine: Chromium الذي يُنزّله puppeteer مبنيّ على glibc
# ولا يعمل على musl. الخيار البديل (حزمة chromium من alpine) يعني نسخةً
# تتغيّر مع كل تحديث للمستودع — وهذا ما نُريد تجنّبه.
FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production TZ=Asia/Riyadh

# مكتبات Chromium المشتركة. كلها حزم مكتبات لا برامج، فانحرافُ إصدارها
# الصغير لا يغيّر سلوكاً — والتثبيت الحقيقي للنسخة يأتي من puppeteer أسفله.
#
# ولا يُثبَّت `ffmpeg` قصداً: تبعية `fluent-ffmpeg` في whatsapp-web.js لا
# تُستعمل إلا في **إرسال** الوسائط وتحويل الملصقات، وهذا الجسر لا يرسل.
# توفيرها نحو 100MB من الصورة.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      fonts-liberation \
      libasound2 \
      libatk-bridge2.0-0 \
      libatk1.0-0 \
      libatspi2.0-0 \
      libcairo2 \
      libcups2 \
      libdbus-1-3 \
      libdrm2 \
      libexpat1 \
      libgbm1 \
      libglib2.0-0 \
      libgtk-3-0 \
      libnspr4 \
      libnss3 \
      libpango-1.0-0 \
      libpangocairo-1.0-0 \
      libx11-6 \
      libxcb1 \
      libxcomposite1 \
      libxdamage1 \
      libxext6 \
      libxfixes3 \
      libxkbcommon0 \
      libxrandr2 \
      libvulkan1 \
      xdg-utils \
 && rm -rf /var/lib/apt/lists/*

# مخبأ المتصفّح **داخل الصورة**: يُنزَّل وقت البناء لا وقت التشغيل.
# نسخة Chromium هنا مثبَّتة فعلاً لا بالاسم: whatsapp-web.js@1.34.7 تثبّت
# puppeteer@24.38.0 تثبيتاً دقيقاً، وpuppeteer تثبّت بناءً واحداً محدّداً من
# Chrome. فتغيير النسخة يحتاج تغيير رقم في package.json — لا يحدث من نفسه.
#
# (تثبيت نسخة apt دقيقة بـ`chromium=...` كان الخيار الآخر، ورُفض: دبيان
#  تحذف الإصدارات القديمة من المرايا، فالتثبيت الدقيق يكسر البناء بعد شهور.)
ENV PUPPETEER_CACHE_DIR=/opt/puppeteer

COPY package.json ./
# git حزمة بناء مؤقتة فقط: تبعيات whatsapp-web.js الحالية كلها من سجلّ npm،
# لكن غيابه هو ما أسقط بناء الجسر الأول حين سحبت Baileys تبعية من GitHub.
# يُثبَّت ويُحذف في الطبقة نفسها فلا يبقى في الصورة النهائية.
RUN apt-get update \
 && apt-get install -y --no-install-recommends git \
 && npm install --omit=dev --no-audit --no-fund \
 && ./node_modules/.bin/puppeteer browsers install chrome \
 && CHROME="$(node -e "console.log(require('puppeteer').executablePath())")" \
 && echo "chrome: $CHROME" \
 && "$CHROME" --version > /app/.chromium-version \
 && cat /app/.chromium-version \
 && apt-get purge -y git && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/* /root/.npm

COPY src/ ./src/
COPY scripts/ ./scripts/

# مستخدم غير جذر: الحاوية تحمل جلسة واتساب رقم الشركة — وهي أثمن ما فيها.
#
# `/home/bp/profile` هو ملف تعريف Chromium الحيّ على قرص الحاوية المحلي،
# و`/data` هو القرص الدائم الذي تُلقَط إليه الجلسة. الفصل بينهما مقصود
# ومشروح في `src/profile.mjs`: ملف تعريف Chromium قاعدتا LevelDB وSQLite،
# وتشغيلهما على Azure Files (SMB) يفسد الإغلاق.
RUN mkdir -p /data/auth-web /data/queue-web /home/bp/profile \
 && addgroup --system bp && adduser --system --ingroup bp --home /home/bp bp \
 && chown -R bp:bp /app /data /home/bp \
 && chmod -R a+rX /opt/puppeteer
USER bp

ENV WA_AUTH_DIR=/data/auth-web \
    WA_QUEUE_DIR=/data/queue-web \
    WA_PROFILE_LOCAL_DIR=/home/bp/profile \
    WA_SEND_ENABLED=0

# لا HEALTHCHECK: الجسر لا يفتح منفذاً. صحّته تُقرأ من السجل
# («الجلسة مفتوحة») ومن وصول الدفعات إلى n8n.
CMD ["node", "src/index.mjs"]
