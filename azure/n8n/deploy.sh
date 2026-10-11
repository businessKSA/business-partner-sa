#!/usr/bin/env bash
# تشغيل n8n نفسه على Azure Container Apps + PostgreSQL (قرار المالك 2026-10-11).
#
# لماذا هكذا: السير الـ90 كلها تنتقل دفعة واحدة بلا إعادة كتابة، والتنفيذ
# يُحتسب من رصيد Microsoft for Startups بدل رسوم n8n Cloud. بعدها يُنقل الثقيل
# (الموزّع والنبض والرادار والمراجع) إلى agents/azure فتخفّ حمولة n8n.
#
# تعمل نسخة واحدة دائمة (min=max=1): المؤقّتات والويبهوك تحتاج عملية حيّة.
# الأسرار (مفتاح التشفير وكلمة مرور القاعدة) تُولَّد مرة وتُخزَّن أسراراً في
# التطبيق نفسه، ولا تُطبع أبداً. إعادة التشغيل تقرأها ولا تُبدّلها — تبديل
# مفتاح التشفير يُتلف كل اعتماد محفوظ.
set -euo pipefail

RG="${BP_AZ_RG:-bp-ai}"
LOC="${BP_AZ_LOCATION:-swedencentral}"
ENVIRONMENT="${BP_AZ_ENV:-bp-agents-env}"
APP="${BP_N8N_APP:-bp-n8n}"
PG="${BP_N8N_PG:-bp-n8n-pg}"
DB="n8n"
PGUSER_NAME="n8nadmin"
IMAGE="${BP_N8N_IMAGE:-docker.io/n8nio/n8n:latest}"

echo "▸ تسجيل مزوّدي الخدمة (آمن إن كانوا مسجّلين)"
for p in Microsoft.App Microsoft.OperationalInsights Microsoft.DBforPostgreSQL; do
  az provider register -n "$p" --wait -o none 2>/dev/null || \
    echo "تنبيه: تعذّر تسجيل $p — سجّله مرة من Cloud Shell: az provider register -n $p"
done

az group show -n "$RG" -o none 2>/dev/null || az group create -n "$RG" -l "$LOC" -o none
az containerapp env show -n "$ENVIRONMENT" -g "$RG" -o none 2>/dev/null || \
  az containerapp env create -n "$ENVIRONMENT" -g "$RG" -l "$LOC" -o none

# ── الأسرار: اقرأها إن وُجد التطبيق، وإلا ولّدها ────────────────────────────
ENC=""; PGPASS=""
if az containerapp show -n "$APP" -g "$RG" -o none 2>/dev/null; then
  ENC=$(az containerapp secret show -n "$APP" -g "$RG" --secret-name n8n-enc-key --query value -o tsv 2>/dev/null || true)
  PGPASS=$(az containerapp secret show -n "$APP" -g "$RG" --secret-name pg-pass --query value -o tsv 2>/dev/null || true)
fi
[ -n "$ENC" ] || ENC=$(openssl rand -hex 32)
[ -n "$PGPASS" ] || PGPASS="Bp$(openssl rand -hex 16)9aA"
echo "::add-mask::$ENC" 2>/dev/null || true
echo "::add-mask::$PGPASS" 2>/dev/null || true

echo "▸ قاعدة PostgreSQL"
if ! az postgres flexible-server show -n "$PG" -g "$RG" -o none 2>/dev/null; then
  az postgres flexible-server create -n "$PG" -g "$RG" -l "$LOC" \
    --tier Burstable --sku-name Standard_B1ms --storage-size 32 --version 16 \
    --admin-user "$PGUSER_NAME" --admin-password "$PGPASS" \
    --public-access 0.0.0.0 --yes -o none
  az postgres flexible-server db create -g "$RG" -s "$PG" -d "$DB" -o none
else
  az postgres flexible-server db show -g "$RG" -s "$PG" -d "$DB" -o none 2>/dev/null || \
    az postgres flexible-server db create -g "$RG" -s "$PG" -d "$DB" -o none
fi
PGHOST="$PG.postgres.database.azure.com"

echo "▸ تطبيق n8n"
COMMON_ENV=(
  "DB_TYPE=postgresdb"
  "DB_POSTGRESDB_HOST=$PGHOST"
  "DB_POSTGRESDB_PORT=5432"
  "DB_POSTGRESDB_DATABASE=$DB"
  "DB_POSTGRESDB_USER=$PGUSER_NAME"
  "DB_POSTGRESDB_PASSWORD=secretref:pg-pass"
  "DB_POSTGRESDB_SSL_ENABLED=true"
  "DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED=false"
  "N8N_ENCRYPTION_KEY=secretref:n8n-enc-key"
  "N8N_PORT=5678"
  "N8N_PROTOCOL=https"
  "GENERIC_TIMEZONE=Asia/Riyadh"
  "TZ=Asia/Riyadh"
  "N8N_RUNNERS_ENABLED=true"
  "N8N_PROXY_HOPS=1"
  # قصّ السجلّ: التنفيذات الناجحة لا تُحفظ، والباقي أسبوع. هذا ما يمنع انتفاخ القاعدة.
  "EXECUTIONS_DATA_SAVE_ON_SUCCESS=none"
  "EXECUTIONS_DATA_PRUNE=true"
  "EXECUTIONS_DATA_MAX_AGE=168"
  "N8N_DIAGNOSTICS_ENABLED=false"
)

if az containerapp show -n "$APP" -g "$RG" -o none 2>/dev/null; then
  az containerapp update -n "$APP" -g "$RG" --image "$IMAGE" -o none
else
  az containerapp create -n "$APP" -g "$RG" --environment "$ENVIRONMENT" \
    --image "$IMAGE" --target-port 5678 --ingress external \
    --min-replicas 1 --max-replicas 1 --cpu 1.0 --memory 2.0Gi \
    --secrets "n8n-enc-key=$ENC" "pg-pass=$PGPASS" \
    --env-vars "${COMMON_ENV[@]}" -o none
fi

FQDN=$(az containerapp show -n "$APP" -g "$RG" --query properties.configuration.ingress.fqdn -o tsv)
# WEBHOOK_URL يحتاج العنوان الذي لا يُعرف قبل الإنشاء، فيُضبط بعده.
az containerapp update -n "$APP" -g "$RG" \
  --set-env-vars "N8N_HOST=$FQDN" "WEBHOOK_URL=https://$FQDN/" -o none

echo "▸ تم. العنوان: https://$FQDN"
echo "⚠️ افتحه الآن وأنشئ حساب المالك فوراً: أول زائر يصير المالك."
