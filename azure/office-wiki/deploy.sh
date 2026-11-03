#!/usr/bin/env bash
# مساحة المكتب الداخلية (بديل نوشن مستضاف ذاتياً) على Azure — Outline.
#
# لماذا Outline: دخول Microsoft Entra جاهز (OIDC) فلا حسابات منفصلة، ومحرر
# كتل وصفحات متداخلة وبحث ومشاركة بصلاحيات، وبياناته عندنا (Postgres + Azure Files).
# يستعمل البيئة وقاعدة المنحة نفسها التي يستعملها n8n (bp-ai / bp-agents-env).
#
# المدخلات (أسرار تأتي من بيئة التشغيل، لا تُطبع ولا تُكتب في git):
#   OFFICE_TENANT_ID  OFFICE_CLIENT_ID  OFFICE_CLIENT_SECRET
# الأسرار المولّدة (SECRET_KEY / UTILS_SECRET / كلمة القاعدة) تُحفظ في التطبيق
# وتُقرأ عند إعادة التشغيل ولا تُبدَّل — تبديل SECRET_KEY يُتلف الجلسات والمرفقات.
set -euo pipefail

RG="${BP_AZ_RG:-bp-ai}"
LOC="${BP_AZ_LOCATION:-swedencentral}"
ENVIRONMENT="${BP_AZ_ENV:-bp-agents-env}"
APP="${BP_OFFICE_APP:-bp-office}"
REDIS_APP="${BP_OFFICE_REDIS:-bp-office-redis}"
PG="${BP_OFFICE_PG:-bp-office-pg}"
DB="outline"
PGUSER_NAME="outlineadmin"
STORAGE_ACCT="${BP_OFFICE_STORAGE:-bpofficefiles}"
SHARE="outline-data"
IMAGE="${BP_OFFICE_IMAGE:-docker.io/outlinewiki/outline:latest}"

: "${OFFICE_TENANT_ID:?ينقص OFFICE_TENANT_ID}"
: "${OFFICE_CLIENT_ID:?ينقص OFFICE_CLIENT_ID}"
: "${OFFICE_CLIENT_SECRET:?ينقص OFFICE_CLIENT_SECRET}"
echo "::add-mask::$OFFICE_CLIENT_SECRET" 2>/dev/null || true

for p in Microsoft.App Microsoft.OperationalInsights Microsoft.DBforPostgreSQL Microsoft.Storage; do
  az provider register -n "$p" --wait -o none 2>/dev/null || echo "تنبيه: سجّل $p من Cloud Shell"
done

az group show -n "$RG" -o none 2>/dev/null || az group create -n "$RG" -l "$LOC" -o none
az containerapp env show -n "$ENVIRONMENT" -g "$RG" -o none 2>/dev/null || \
  az containerapp env create -n "$ENVIRONMENT" -g "$RG" -l "$LOC" -o none

# ── الأسرار ────────────────────────────────────────────────────────────────
SK=""; US=""; PGPASS=""
if az containerapp show -n "$APP" -g "$RG" -o none 2>/dev/null; then
  s() { az containerapp secret show -n "$APP" -g "$RG" --secret-name "$1" --query value -o tsv 2>/dev/null || true; }
  SK=$(s secret-key); US=$(s utils-secret); PGPASS=$(s pg-pass)
fi
[ -n "$SK" ] || SK=$(openssl rand -hex 32)
[ -n "$US" ] || US=$(openssl rand -hex 32)
[ -n "$PGPASS" ] || PGPASS="Bp$(openssl rand -hex 16)9aA"
for v in "$SK" "$US" "$PGPASS"; do echo "::add-mask::$v" 2>/dev/null || true; done

# ── PostgreSQL ─────────────────────────────────────────────────────────────
if ! az postgres flexible-server show -n "$PG" -g "$RG" -o none 2>/dev/null; then
  az postgres flexible-server create -n "$PG" -g "$RG" -l "$LOC" \
    --tier Burstable --sku-name Standard_B1ms --storage-size 32 --version 16 \
    --admin-user "$PGUSER_NAME" --admin-password "$PGPASS" \
    --public-access 0.0.0.0 --yes -o none
fi
az postgres flexible-server db show -g "$RG" -s "$PG" -d "$DB" -o none 2>/dev/null || \
  az postgres flexible-server db create -g "$RG" -s "$PG" -d "$DB" -o none
PGHOST="$PG.postgres.database.azure.com"
DBURL="postgres://$PGUSER_NAME:$PGPASS@$PGHOST:5432/$DB"

# ── Redis داخلي (ذاكرة مؤقتة وطوابير فقط، لا بيانات دائمة) ───────────────────
if ! az containerapp show -n "$REDIS_APP" -g "$RG" -o none 2>/dev/null; then
  az containerapp create -n "$REDIS_APP" -g "$RG" --environment "$ENVIRONMENT" \
    --image docker.io/library/redis:7-alpine --target-port 6379 --transport tcp \
    --ingress internal --min-replicas 1 --max-replicas 1 --cpu 0.25 --memory 0.5Gi -o none
fi
REDIS_FQDN=$(az containerapp show -n "$REDIS_APP" -g "$RG" --query properties.configuration.ingress.fqdn -o tsv)

# ── مرفقات الملفات على Azure Files ──────────────────────────────────────────
az storage account show -n "$STORAGE_ACCT" -g "$RG" -o none 2>/dev/null || \
  az storage account create -n "$STORAGE_ACCT" -g "$RG" -l "$LOC" --sku Standard_LRS \
    --allow-blob-public-access false --min-tls-version TLS1_2 -o none
SKEY=$(az storage account keys list -n "$STORAGE_ACCT" -g "$RG" --query '[0].value' -o tsv)
echo "::add-mask::$SKEY" 2>/dev/null || true
az storage share-rm create --storage-account "$STORAGE_ACCT" -g "$RG" -n "$SHARE" -o none 2>/dev/null || true
az containerapp env storage set -n "$ENVIRONMENT" -g "$RG" --storage-name office-data \
  --azure-file-account-name "$STORAGE_ACCT" --azure-file-account-key "$SKEY" \
  --azure-file-share-name "$SHARE" --access-mode ReadWrite -o none

# ── تطبيق Outline ──────────────────────────────────────────────────────────
AUTH="https://login.microsoftonline.com/$OFFICE_TENANT_ID/oauth2/v2.0"
ENVV=(
  "NODE_ENV=production"
  "SECRET_KEY=secretref:secret-key"
  "UTILS_SECRET=secretref:utils-secret"
  "DATABASE_URL=secretref:db-url"
  "PGSSLMODE=require"
  "REDIS_URL=redis://$REDIS_FQDN:6379"
  "FILE_STORAGE=local"
  "FILE_STORAGE_LOCAL_ROOT_DIR=/var/lib/outline/data"
  "FILE_STORAGE_UPLOAD_MAX_SIZE=52428800"
  "FORCE_HTTPS=false"
  "DEFAULT_LANGUAGE=ar_SA"
  "OIDC_CLIENT_ID=$OFFICE_CLIENT_ID"
  "OIDC_CLIENT_SECRET=secretref:oidc-secret"
  "OIDC_AUTH_URI=$AUTH/authorize"
  "OIDC_TOKEN_URI=$AUTH/token"
  "OIDC_USERINFO_URI=https://graph.microsoft.com/oidc/userinfo"
  "OIDC_DISPLAY_NAME=حساب المكتب"
  "OIDC_USERNAME_CLAIM=preferred_username"
  "OIDC_SCOPES=openid profile email"
  "WEB_CONCURRENCY=1"
)

if az containerapp show -n "$APP" -g "$RG" -o none 2>/dev/null; then
  az containerapp secret set -n "$APP" -g "$RG" --secrets "oidc-secret=$OFFICE_CLIENT_SECRET" -o none
  az containerapp update -n "$APP" -g "$RG" --image "$IMAGE" -o none
else
  az containerapp create -n "$APP" -g "$RG" --environment "$ENVIRONMENT" \
    --image "$IMAGE" --target-port 3000 --ingress external \
    --min-replicas 1 --max-replicas 1 --cpu 1.0 --memory 2.0Gi \
    --secrets "secret-key=$SK" "utils-secret=$US" "pg-pass=$PGPASS" "db-url=$DBURL" "oidc-secret=$OFFICE_CLIENT_SECRET" \
    --env-vars "${ENVV[@]}" -o none
  # تركيب Azure Files على /var/lib/outline/data (لا يدعمه create بأعلام، فعبر YAML)
  az containerapp show -n "$APP" -g "$RG" -o yaml > /tmp/office.yaml
  python3 - <<'PY'
import re
p="/tmp/office.yaml"; t=open(p).read()
t=re.sub(r"(\n    containers:\n(?:.*\n)*?      name: [^\n]+\n)", r"\1      volumeMounts:\n      - volumeName: data\n        mountPath: /var/lib/outline/data\n", t, count=1)
t=re.sub(r"(\n    scale:)", r"\n    volumes:\n    - name: data\n      storageType: AzureFile\n      storageName: office-data\1", t, count=1)
open(p,"w").write(t)
PY
  az containerapp update -n "$APP" -g "$RG" --yaml /tmp/office.yaml -o none
fi

FQDN=$(az containerapp show -n "$APP" -g "$RG" --query properties.configuration.ingress.fqdn -o tsv)
az containerapp update -n "$APP" -g "$RG" --set-env-vars "URL=https://$FQDN" "FORCE_HTTPS=true" -o none

echo "▸ تم. العنوان: https://$FQDN"
echo "⚠️ أضف في تسجيل تطبيق Entra عنوان إعادة التوجيه: https://$FQDN/auth/oidc.callback"
