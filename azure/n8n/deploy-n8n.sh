#!/usr/bin/env bash
# نشر n8n المستضاف ذاتياً على Azure Container Apps — تجهيز فقط، لا يشغّله Claude.
# فيه إنشاء موارد وأسرار وتكلفة (من رصيد المنحة)، وهو قرار مالك.
#
# لماذا App دائمة لا Job: n8n يستقبل ويبهوكات واتساب ويشغّل الموزّع كل خمس
# دقائق، فلا يجوز أن ينام. minReplicas=1 إلزامي.
# لماذا PostgreSQL: SQLite على قرص حاوية يضيع مع أول إعادة نشر.
set -euo pipefail

RG="${BP_AZ_RG:-bp-n8n-rg}"
LOC="${BP_AZ_LOCATION:-swedencentral}"
ENVIRONMENT="${BP_AZ_N8N_ENV:-bp-n8n-env}"
APP="${BP_AZ_N8N_APP:-bp-n8n}"
PG="${BP_AZ_PG:-bp-n8n-pg}"
PG_ADMIN="${BP_AZ_PG_ADMIN:-bpn8n}"
N8N_IMAGE="${N8N_IMAGE:-docker.io/n8nio/n8n:latest}"   # ثبّت رقم إصدار قبل الإنتاج

req() { [ -n "${!1:-}" ] || { echo "ينقص المتغيّر $1" >&2; exit 1; }; }
# N8N_ENCRYPTION_KEY: ولّده مرة واحدة واحفظه خارج هذا المستودع — فقدانه يعني
# فقدان كل الاعتمادات المخزّنة. PG_PASSWORD: كلمة مرور قاعدة n8n.
for v in N8N_ENCRYPTION_KEY PG_PASSWORD N8N_HOST; do req "$v"; done   # N8N_HOST مثل n8n.businesspartner.sa

echo "▸ المجموعة والبيئة"
az group create -n "$RG" -l "$LOC" -o none
az containerapp env create -n "$ENVIRONMENT" -g "$RG" -l "$LOC" -o none 2>/dev/null || true

echo "▸ PostgreSQL (Burstable B1ms، أرخص خطة تكفي n8n)"
az postgres flexible-server create -n "$PG" -g "$RG" -l "$LOC" \
  --admin-user "$PG_ADMIN" --admin-password "$PG_PASSWORD" \
  --tier Burstable --sku-name Standard_B1ms --storage-size 32 \
  --public-access 0.0.0.0 --yes -o none 2>/dev/null || true
az postgres flexible-server db create -g "$RG" -s "$PG" -d n8n -o none 2>/dev/null || true

echo "▸ تطبيق n8n"
az containerapp create -n "$APP" -g "$RG" --environment "$ENVIRONMENT" \
  --image "$N8N_IMAGE" --target-port 5678 --ingress external \
  --min-replicas 1 --max-replicas 1 --cpu 1.0 --memory 2Gi \
  --secrets "enc-key=$N8N_ENCRYPTION_KEY" "pg-pass=$PG_PASSWORD" \
  --env-vars \
    "DB_TYPE=postgresdb" \
    "DB_POSTGRESDB_HOST=$PG.postgres.database.azure.com" \
    "DB_POSTGRESDB_DATABASE=n8n" \
    "DB_POSTGRESDB_USER=$PG_ADMIN" \
    "DB_POSTGRESDB_PASSWORD=secretref:pg-pass" \
    "DB_POSTGRESDB_SSL_ENABLED=true" \
    "N8N_ENCRYPTION_KEY=secretref:enc-key" \
    "N8N_HOST=$N8N_HOST" "N8N_PROTOCOL=https" \
    "WEBHOOK_URL=https://$N8N_HOST/" \
    "N8N_PROXY_HOPS=1" \
    "GENERIC_TIMEZONE=Asia/Riyadh" "TZ=Asia/Riyadh" \
    "EXECUTIONS_DATA_PRUNE=true" "EXECUTIONS_DATA_MAX_AGE=336" \
    "N8N_PUBLIC_API_DISABLED=false" \
  -o none

FQDN=$(az containerapp show -n "$APP" -g "$RG" --query properties.configuration.ingress.fqdn -o tsv)
echo "✓ n8n يعمل على https://$FQDN"
echo "  اربط النطاق $N8N_HOST بهذا العنوان (CNAME) ثم أنشئ حساب المالك من المتصفح."
echo "  لم يُفعَّل أي سير عمل بعد — الاستيراد في migrate.mjs يترك الكل غير نشط."
