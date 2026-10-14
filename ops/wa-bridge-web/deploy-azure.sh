#!/usr/bin/env bash
# نشر جسر قارئ واتساب بمحرّك المتصفّح على Azure Container Apps.
#
# حاوية **ثانية** مستقلة: `bp-wa-bridge-web` بجانب `bp-wa-bridge` القائمة،
# في نفس المجموعة والبيئة والسجلّ وحساب التخزين — ومجلدات مستقلة على القرص
# (`/data/auth-web` و`/data/queue-web`) فلا تصطدم بجلسة Baileys في
# `/data/auth` و`/data/queue`.
#
# ولماذا App لا Job: جلسة واتساب ويب تُقطع إن مات العميل، ويُطلب رمز جديد.
# فحاوية تعيش. ونسختان تكسران الجلسة الواحدة، فـmin=max=1 شرطٌ لا اختيار.
#
# الموارد: `--cpu 1.0 --memory 2.0Gi` — والتبرير:
#   Chromium بلا رأس على `web.whatsapp.com` ثلاث عمليات (المتصفّح والعارض
#   وشبكة/GPU)، وقياسات هذا النمط المعروفة 400–900MB في الاستقرار، وNode
#   فوقها نحو 80MB. فـ1Gi (كما الجسر الأول) يقع في حدّ الانهيار بعد ساعات
#   بـ"Target closed". و1.0 vCPU لذروة تحليل جافاسكربت أول تحميل للصفحة؛
#   الاستقرار بعدها منخفض. وهذا زوج صالح في Container Apps (نسبة 1:2).
#
# لا يُشغّله Claude: فيه إنشاء موارد وربط أسرار ومسح رمز — قرار مالك.
set -euo pipefail
umask 077

RG="${BP_WA_RG:-bp-wa-rg}"
LOC="${BP_WA_LOCATION:-swedencentral}"
ENVIRONMENT="${BP_WA_ENV:-bp-wa-env}"
ACR="${BP_WA_ACR:-bpwabridgeacr}"
APP="${BP_WA_WEB_APP:-bp-wa-bridge-web}"
IMAGE_NAME="${BP_WA_WEB_IMAGE:-bp-wa-bridge-web}"
STORAGE="${BP_WA_STORAGE:-bpwabridgestate}"
SHARE="${BP_WA_SHARE:-wa-state}"
ENV_STORAGE="${BP_WA_ENV_STORAGE:-wa-state}"
TAG="$(git rev-parse --short HEAD)"

req() { [ -n "${!1:-}" ] || { echo "ينقص المتغيّر $1" >&2; exit 1; }; }
for v in WA_WEBHOOK_URL WA_BRIDGE_SECRET WA_ACCOUNTS; do req "$v"; done

# حرسٌ قبل أي إنشاء: الرقم الشخصي لا يُنقل إلى هذا المحرّك بحال. هو يقرأ
# الآن بـBaileys في `bp-wa-bridge` — ونقله يعني مسح رمز جديد وخسارة جلسة
# تعمل. الكود يرفض الإقلاع كذلك، وهذا الحرس يوفّر بناءً كاملاً بلا فائدة.
case "$WA_ACCOUNTS" in
  *503793356*)
    echo "WA_ACCOUNTS فيه الرقم الشخصي — ممنوع في جسر المتصفّح. هذا الجسر لرقم الشركة وحده." >&2
    exit 1;;
esac
case "$WA_ACCOUNTS" in
  *,*) echo "WA_ACCOUNTS فيه أكثر من حساب — جسر المتصفّح يشغّل حساباً واحداً." >&2; exit 1;;
esac
if [ "${WA_SEND_ENABLED:-0}" != "0" ]; then
  echo "WA_SEND_ENABLED يجب أن يبقى 0 — قارئ فقط." >&2
  exit 1
fi

echo "▸ المجموعة والبيئة والسجلّ (قائمة أصلاً من الجسر الأول — إنشاءٌ لا يضرّ)"
az group create -n "$RG" -l "$LOC" -o none
if ! az acr show -n "$ACR" -g "$RG" -o none 2>/dev/null; then
  az acr create -n "$ACR" -g "$RG" --sku Basic --admin-enabled true -o none
fi
if ! az containerapp env show -n "$ENVIRONMENT" -g "$RG" -o none 2>/dev/null; then
  az containerapp env create -n "$ENVIRONMENT" -g "$RG" -l "$LOC" -o none
fi

echo "▸ القرص الدائم — نفس حصّة الجسر الأول، ومجلدات مستقلة داخلها"
if ! az containerapp env storage show -n "$ENVIRONMENT" -g "$RG" --storage-name "$ENV_STORAGE" -o none 2>/dev/null; then
  STORAGE_KEY="$(az storage account keys list -n "$STORAGE" -g "$RG" --query '[0].value' -o tsv)"
  az storage share-rm create --storage-account "$STORAGE" -g "$RG" -n "$SHARE" --quota 5 -o none
  az containerapp env storage set \
    -n "$ENVIRONMENT" -g "$RG" --storage-name "$ENV_STORAGE" \
    --azure-file-account-name "$STORAGE" --azure-file-account-key "$STORAGE_KEY" \
    --azure-file-share-name "$SHARE" --access-mode ReadWrite -o none
fi

echo "▸ بناء الصورة من ops/wa-bridge-web (تنزيل Chromium يجري هنا، لا وقت التشغيل)"
az acr build -r "$ACR" -t "$IMAGE_NAME:$TAG" -f Dockerfile . -o none

ACR_USER="$(az acr credential show -n "$ACR" --query username -o tsv)"
ACR_PASS="$(az acr credential show -n "$ACR" --query "passwords[0].value" -o tsv)"
ENV_ID="$(az containerapp env show -n "$ENVIRONMENT" -g "$RG" --query id -o tsv)"

if az containerapp show -n "$APP" -g "$RG" -o none 2>/dev/null; then
  echo "▸ التطبيق قائم — تحديث الصورة وحدها (القرص والأسرار كما هي)"
  az containerapp registry set -n "$APP" -g "$RG" \
    --server "$ACR.azurecr.io" --username "$ACR_USER" --password "$ACR_PASS" -o none
  az containerapp update -n "$APP" -g "$RG" \
    --image "$ACR.azurecr.io/$IMAGE_NAME:$TAG" -o none
  echo "✓ حُدِّث إلى $TAG"
else
  echo "▸ إنشاء التطبيق من YAML كامل — بالقرص والأسرار في خطوة واحدة"
  # YAML كامل لا جزئي، ومن `create` لا `update`: الجسر الأول أُنشئ بلا قرص
  # ثم رُكّب القرص بـ`update --yaml` جزئي — وهذا يدهس القالب. وهنا خطوة
  # واحدة: أول نسخة تُقلع والقرص مركّب، فلا رمز QR يُطبع ويُهدر.
  #
  # ولا مفتاح `ingress` إطلاقاً. ملاحظة من الجسر الأول: `--ingress disabled`
  # قيمة غير صالحة (تقبل external/internal فقط)، فحذفُها هو الصواب.
  YAML="$(mktemp -t bp-wa-web-XXXXXX.yaml)"
  trap 'rm -f "$YAML"' EXIT
  cat > "$YAML" <<YAMLDOC
location: $LOC
type: Microsoft.App/containerApps
properties:
  environmentId: $ENV_ID
  configuration:
    activeRevisionsMode: Single
    registries:
      - server: $ACR.azurecr.io
        username: $ACR_USER
        passwordSecretRef: acr-password
    secrets:
      - name: acr-password
        value: "$ACR_PASS"
      - name: wa-bridge-secret
        value: "$WA_BRIDGE_SECRET"
  template:
    containers:
      - name: $APP
        image: $ACR.azurecr.io/$IMAGE_NAME:$TAG
        resources:
          cpu: 1.0
          memory: 2.0Gi
        env:
          - name: WA_WEBHOOK_URL
            value: "$WA_WEBHOOK_URL"
          - name: WA_BRIDGE_SECRET
            secretRef: wa-bridge-secret
          - name: WA_ACCOUNTS
            value: "$WA_ACCOUNTS"
          - name: WA_AUTH_DIR
            value: "/data/auth-web"
          - name: WA_QUEUE_DIR
            value: "/data/queue-web"
          - name: WA_PROFILE_LOCAL_DIR
            value: "/home/bp/profile"
          - name: WA_PROFILE_SNAPSHOT_S
            value: "${WA_PROFILE_SNAPSHOT_S:-300}"
          - name: WA_BATCH_WINDOW_S
            value: "${WA_BATCH_WINDOW_S:-120}"
          - name: WA_IGNORE_OLDER_H
            value: "${WA_IGNORE_OLDER_H:-24}"
          - name: WA_SEND_ENABLED
            value: "0"
          - name: WA_HIDE_PRESENCE
            value: "1"
          - name: WA_QR_RAW
            value: "1"
          - name: WA_LOG_LEVEL
            value: "${WA_LOG_LEVEL:-info}"
        volumeMounts:
          - volumeName: wa-state
            mountPath: /data
    volumes:
      - name: wa-state
        storageType: AzureFile
        storageName: $ENV_STORAGE
    scale:
      minReplicas: 1
      maxReplicas: 1
YAMLDOC
  # لا `2>/dev/null || true` على هذه الخطوة بحال: ابتلاعُ خطأ الإنشاء هو
  # ما كلّف الجسر الأول ساعات — ظهر «نجح» والتطبيق لم يُنشأ قط.
  az containerapp create -n "$APP" -g "$RG" --yaml "$YAML" -o none
  rm -f "$YAML"
  trap - EXIT
  echo "✓ أُنشئ $APP على $TAG"
fi

echo
echo "▸ أول تشغيل: رمز QR يُطبع في السجل — بالرسم وبالنصّ الخام معاً."
echo "   النصّ الخام يُلصق في أي مولِّد QR محلي إن تشوّه الرسم في السجل."
echo "   يتجدّد تلقائياً كل نحو ٦٠ ثانية، فلا عجلة — لكن لا يُشارَك السجل."
echo "   az containerapp logs show -n $APP -g $RG --follow --tail 200"
echo
echo "▸ المسح من: واتساب ← الأجهزة المرتبطة ← ربط جهاز (رمز QR، لا الربط بالرقم)."
echo "   وهذا هو **كل** سبب وجود هذا الجسر: رقم الشركة يربط بالرمز على"
echo "   web.whatsapp.com ويرفض كود الاقتران عبر Baileys."
echo
echo "▸ بعد «الجلسة مفتوحة» تُلقَط الجلسة إلى /data/auth-web/company/snapshot"
echo "   (ومعها snapshot.prev للرجوع خطوة إن فسدت). فلا يُطلب رمز بعدها."
echo
echo "▸ للتحقق بلا تخمين:"
echo "   az containerapp replica list -n $APP -g $RG -o table"
echo "   az containerapp logs show -n $APP -g $RG --tail 100 | grep -E 'الجلسة مفتوحة|لقطة'"
