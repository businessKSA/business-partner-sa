#!/usr/bin/env bash
# نشر جسر قارئ واتساب ويب على Azure Container Apps.
#
# لماذا App لا Job (بخلاف agents/azure/deploy.sh): هذه جلسة مقبس دائمة —
# واتساب ويب يُقطع الاتصال إن مات العميل، ويُطلب QR جديد. فحاوية تعيش.
#
# نسختان تكسران جلسة واتساب الواحدة، فـ min=max=1 شرطٌ لا اختيار.
# وبلا قرص دائم على WA_AUTH_DIR تضيع الجلسة مع كل نشرة ويُطلب QR من جديد.
#
# لا يُشغّله Claude: فيه إنشاء موارد وربط أسرار ومسح QR — قرار مالك.
set -euo pipefail

RG="${BP_WA_RG:-bp-wa-rg}"
LOC="${BP_WA_LOCATION:-swedencentral}"
ENVIRONMENT="${BP_WA_ENV:-bp-wa-env}"
ACR="${BP_WA_ACR:-bpwabridgeacr}"
APP="${BP_WA_APP:-bp-wa-bridge}"
STORAGE="${BP_WA_STORAGE:-bpwabridgestate}"
SHARE="${BP_WA_SHARE:-wa-state}"
TAG="$(git rev-parse --short HEAD)"

req() { [ -n "${!1:-}" ] || { echo "ينقص المتغيّر $1" >&2; exit 1; }; }
for v in WA_WEBHOOK_URL WA_BRIDGE_SECRET WA_ACCOUNTS; do req "$v"; done

echo "▸ المجموعة والبيئة"
az group create -n "$RG" -l "$LOC" -o none
az acr create -n "$ACR" -g "$RG" --sku Basic --admin-enabled true -o none 2>/dev/null || true
az containerapp env create -n "$ENVIRONMENT" -g "$RG" -l "$LOC" -o none 2>/dev/null || true

echo "▸ القرص الدائم لجلسة واتساب (Azure Files)"
az storage account create -n "$STORAGE" -g "$RG" -l "$LOC" --sku Standard_LRS -o none 2>/dev/null || true
STORAGE_KEY="$(az storage account keys list -n "$STORAGE" -g "$RG" --query '[0].value' -o tsv)"
az storage share-rm create --storage-account "$STORAGE" -g "$RG" -n "$SHARE" --quota 5 -o none 2>/dev/null || true
az containerapp env storage set \
  -n "$ENVIRONMENT" -g "$RG" --storage-name wa-state \
  --azure-file-account-name "$STORAGE" --azure-file-account-key "$STORAGE_KEY" \
  --azure-file-share-name "$SHARE" --access-mode ReadWrite -o none

echo "▸ بناء الصورة من ops/wa-bridge"
az acr build -r "$ACR" -t "bp-wa-bridge:$TAG" -f Dockerfile . -o none

echo "▸ التطبيق (نسخة واحدة، بلا منفذ خارجي)"
ACR_USER="$(az acr credential show -n "$ACR" --query username -o tsv)"
ACR_PASS="$(az acr credential show -n "$ACR" --query "passwords[0].value" -o tsv)"
az containerapp create \
  -n "$APP" -g "$RG" --environment "$ENVIRONMENT" \
  --image "$ACR.azurecr.io/bp-wa-bridge:$TAG" \
  --registry-server "$ACR.azurecr.io" \
  --registry-username "$ACR_USER" \
  --registry-password "$ACR_PASS" \
  --cpu 0.5 --memory 1Gi \
  --min-replicas 1 --max-replicas 1 \
  --secrets "wa-bridge-secret=$WA_BRIDGE_SECRET" \
  --env-vars \
    "WA_WEBHOOK_URL=$WA_WEBHOOK_URL" \
    "WA_BRIDGE_SECRET=secretref:wa-bridge-secret" \
    "WA_ACCOUNTS=$WA_ACCOUNTS" \
    "WA_AUTH_DIR=/data/auth" \
    "WA_QUEUE_DIR=/data/queue" \
    "WA_BATCH_WINDOW_S=${WA_BATCH_WINDOW_S:-120}" \
    "WA_IGNORE_OLDER_H=${WA_IGNORE_OLDER_H:-24}" \
    "WA_SEND_ENABLED=0" \
    "WA_PAIRING_CODE=1" \
  -o none

echo "▸ ربط القرص الدائم على /data — لا بديل عنه"
cat > /tmp/bp-wa-volume.yaml <<'YAML'
properties:
  template:
    volumes:
      - name: wa-state
        storageType: AzureFile
        storageName: wa-state
    containers:
      - name: bp-wa-bridge
        volumeMounts:
          - volumeName: wa-state
            mountPath: /data
YAML
echo "   راجع /tmp/bp-wa-volume.yaml ثم:"
echo "   az containerapp update -n $APP -g $RG --yaml /tmp/bp-wa-volume.yaml"
echo
echo "▸ أول تشغيل: كود ربط من ٨ خانات يُطبع في السجل لكل حساب."
echo "   أدخله من: واتساب ← الأجهزة المرتبطة ← ربط جهاز ← الربط برقم الهاتف:"
echo "   az containerapp logs show -n $APP -g $RG --follow"
echo "▸ بعد الربط تبقى الجلسة في القرص الدائم، فلا يُطلب الكود مرة أخرى."
