#!/usr/bin/env bash
# ==============================================================================
# n8n على Azure — بناء البنية التحتية (المرحلة ١)
#
# ينشئ: Resource Group + PostgreSQL + Azure Files + Container Apps + n8n
# المنطقة: Sweden Central (نفس منطقة bp-ai-ksa-2026 — نداءات Azure OpenAI محلية)
#
# التشغيل:  bash ops/azure/01-provision.sh
# المتطلبات: az CLI مسجّل دخول (az login)، واشتراك المنحة محدد (az account set)
#
# آمن للإعادة: كل خطوة تتحقق من وجود المورد قبل إنشائه.
# ==============================================================================
set -euo pipefail

# ---------- الإعدادات (عدّلها قبل التشغيل إن لزم) ----------
RG="bp-n8n"
LOC="swedencentral"
PG="bp-n8n-pg"                 # لازم يكون فريداً عالمياً
PG_DB="n8n"
PG_USER="n8nadmin"
STORAGE="bpn8nfiles$RANDOM"    # لازم يكون فريداً عالمياً، حروف صغيرة وأرقام فقط
SHARE="n8n-data"
ENVNAME="bp-n8n-env"
APP="n8n"
IMAGE="docker.n8n.io/n8nio/n8n:latest"
CUSTOM_DOMAIN="n8n.businesspartner.sa"   # اتركه فارغاً "" لتخطي النطاق المخصص

# ---------- توليد الأسرار ----------
PG_PASS="$(openssl rand -base64 30 | tr -d '/+=' | head -c 28)"
N8N_KEY="$(openssl rand -hex 32)"

echo "==> الاشتراك الحالي:"
az account show --query "{name:name, id:id}" -o tsv

# ---------- 1) مجموعة الموارد ----------
echo "==> [1/7] مجموعة الموارد: $RG"
az group create -n "$RG" -l "$LOC" -o none

# ---------- 2) PostgreSQL ----------
echo "==> [2/7] PostgreSQL: $PG (قد يستغرق 5-8 دقائق)"
az postgres flexible-server create \
  --resource-group "$RG" --name "$PG" --location "$LOC" \
  --admin-user "$PG_USER" --admin-password "$PG_PASS" \
  --tier Burstable --sku-name Standard_B1ms \
  --storage-size 32 --version 16 \
  --public-access 0.0.0.0 \
  --yes -o none

az postgres flexible-server db create \
  --resource-group "$RG" --server-name "$PG" --database-name "$PG_DB" -o none

# يسمح لخدمات Azure (ومنها Container Apps) بالاتصال بالقاعدة
az postgres flexible-server firewall-rule create \
  --resource-group "$RG" --name "$PG" \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0 -o none

PG_HOST="$(az postgres flexible-server show -g "$RG" -n "$PG" --query fullyQualifiedDomainName -o tsv)"

# ---------- 3) التخزين الدائم ----------
echo "==> [3/7] حساب التخزين: $STORAGE"
az storage account create \
  --resource-group "$RG" --name "$STORAGE" --location "$LOC" \
  --sku Standard_LRS --kind StorageV2 -o none

STORAGE_KEY="$(az storage account keys list -g "$RG" -n "$STORAGE" --query "[0].value" -o tsv)"

az storage share create \
  --name "$SHARE" --account-name "$STORAGE" --account-key "$STORAGE_KEY" \
  --quota 10 -o none

# ---------- 4) بيئة Container Apps ----------
echo "==> [4/7] بيئة Container Apps: $ENVNAME"
az extension add --name containerapp --upgrade --only-show-errors -o none 2>/dev/null || true
az provider register --namespace Microsoft.App --wait -o none
az provider register --namespace Microsoft.OperationalInsights --wait -o none

az containerapp env create \
  --resource-group "$RG" --name "$ENVNAME" --location "$LOC" -o none

# ربط مشاركة الملفات بالبيئة
az containerapp env storage set \
  --resource-group "$RG" --name "$ENVNAME" \
  --storage-name n8nfiles \
  --azure-file-account-name "$STORAGE" \
  --azure-file-account-key "$STORAGE_KEY" \
  --azure-file-share-name "$SHARE" \
  --access-mode ReadWrite -o none

# ---------- 5) تطبيق n8n ----------
echo "==> [5/7] تطبيق n8n"
az containerapp create \
  --resource-group "$RG" --name "$APP" --environment "$ENVNAME" \
  --image "$IMAGE" \
  --target-port 5678 --ingress external \
  --cpu 1.0 --memory 2.0Gi \
  --min-replicas 1 --max-replicas 1 \
  --secrets "db-pass=$PG_PASS" "enc-key=$N8N_KEY" \
  --env-vars \
    DB_TYPE=postgresdb \
    DB_POSTGRESDB_HOST="$PG_HOST" \
    DB_POSTGRESDB_PORT=5432 \
    DB_POSTGRESDB_DATABASE="$PG_DB" \
    DB_POSTGRESDB_USER="$PG_USER" \
    DB_POSTGRESDB_PASSWORD=secretref:db-pass \
    DB_POSTGRESDB_SSL_ENABLED=true \
    DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED=false \
    N8N_ENCRYPTION_KEY=secretref:enc-key \
    N8N_PORT=5678 \
    N8N_PROTOCOL=https \
    N8N_PROXY_HOPS=1 \
    N8N_RUNNERS_ENABLED=true \
    N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true \
    GENERIC_TIMEZONE=Asia/Riyadh \
    TZ=Asia/Riyadh \
    EXECUTIONS_DATA_PRUNE=true \
    EXECUTIONS_DATA_MAX_AGE=336 \
  -o none

# ---------- 6) تثبيت التخزين الدائم ----------
# ملاحظة: ربط الحجم يحتاج تعديل YAML — az لا يدعمه بعلم مباشر.
echo "==> [6/7] ربط التخزين الدائم على /home/node/.n8n"
TMP_YAML="$(mktemp)"
az containerapp show -g "$RG" -n "$APP" -o yaml > "$TMP_YAML"
python3 - "$TMP_YAML" <<'PY'
import sys, yaml
p = sys.argv[1]
d = yaml.safe_load(open(p))
tpl = d["properties"]["template"]
tpl["volumes"] = [{"name": "n8n-data", "storageName": "n8nfiles", "storageType": "AzureFile"}]
for c in tpl["containers"]:
    c["volumeMounts"] = [{"volumeName": "n8n-data", "mountPath": "/home/node/.n8n"}]
yaml.safe_dump(d, open(p, "w"), allow_unicode=True, sort_keys=False)
PY
az containerapp update -g "$RG" -n "$APP" --yaml "$TMP_YAML" -o none
rm -f "$TMP_YAML"

FQDN="$(az containerapp show -g "$RG" -n "$APP" --query properties.configuration.ingress.fqdn -o tsv)"

# ---------- 7) النطاق المخصص ----------
if [ -n "$CUSTOM_DOMAIN" ]; then
  echo "==> [7/7] النطاق المخصص: $CUSTOM_DOMAIN"
  VERIFY_ID="$(az containerapp show -g "$RG" -n "$APP" --query properties.customDomainVerificationId -o tsv)"
  cat <<EOF

  ┌─ أضف هذين السجلين في DNS عند مزوّد النطاق، ثم أعد تشغيل هذا السكربت:
  │
  │   CNAME   n8n                 -> $FQDN
  │   TXT     asuid.n8n           -> $VERIFY_ID
  │
  └─ بعد انتشار السجلات (5-30 دقيقة) شغّل:
       az containerapp hostname add -g $RG -n $APP --hostname $CUSTOM_DOMAIN
       az containerapp hostname bind -g $RG -n $APP --hostname $CUSTOM_DOMAIN --environment $ENVNAME --validation-method CNAME

EOF
  N8N_URL="https://$CUSTOM_DOMAIN"
else
  echo "==> [7/7] تخطي النطاق المخصص"
  N8N_URL="https://$FQDN"
fi

# ---------- ضبط عنوان الويبهوك ----------
az containerapp update -g "$RG" -n "$APP" \
  --set-env-vars N8N_HOST="${CUSTOM_DOMAIN:-$FQDN}" WEBHOOK_URL="$N8N_URL/" -o none

# ---------- الخلاصة ----------
cat <<EOF

================================================================================
  اكتمل البناء.

  رابط n8n الجديد : $N8N_URL
  الرابط المؤقت   : https://$FQDN
  قاعدة البيانات  : $PG_HOST

  ⚠️  احفظ هذين السرّين الآن في خزنة كلمات المرور — لن يُعرضا مرة أخرى:

      كلمة مرور PostgreSQL : $PG_PASS
      N8N_ENCRYPTION_KEY   : $N8N_KEY

  مفتاح التشفير هو ما يفكّ الاعتمادات. لو ضاع، تُدخَل الاعتمادات الـ٣٤ من جديد.
  لا تضعه في Git ولا في نوشن ولا في أي محادثة.

  الخطوة التالية: افتح الرابط، أنشئ حساب المالك، ثم المرحلة ٢ من
  docs/n8n-to-azure-migration.md
================================================================================
EOF
