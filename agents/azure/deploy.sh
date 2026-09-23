#!/usr/bin/env bash
# نشر فريق الوكلاء على Azure Container Apps Jobs.
#
# لماذا Jobs لا App: الجولات دورية لا خدمة دائمة. الحاوية تقلع، تعمل دقائق،
# وتنتهي — فلا يُدفع مقابل انتظار. وهذا ما يجعل «لا ينامون» رخيصاً: الجدولة
# في السحابة لا في جهاز يُغلق غطاؤه.
#
# يحتاج: az CLI مسجّل الدخول، والمتغيّرات أدناه. لا يُشغّله Claude — فيه
# إنشاء موارد وربط أسرار، وهو قرار مالك.
set -euo pipefail

RG="${BP_AZ_RG:-bp-agents-rg}"
# اضبطها على منطقة مورد Azure OpenAI الذي ستستعمله: زمن الجولة يحكمه نداء
# المحرّك لا موقع المستخدم، فالمجاورة تختصره.
#   bp-ai-ksa-2026 → swedencentral   |   drbahermagnas-6763-resource → eastus2
LOC="${BP_AZ_LOCATION:-swedencentral}"
ENVIRONMENT="${BP_AZ_ENV:-bp-agents-env}"
ACR="${BP_AZ_ACR:-bpagentsacr}"
IMAGE="$ACR.azurecr.io/bp-agents:$(git rev-parse --short HEAD)"

req() { [ -n "${!1:-}" ] || { echo "ينقص المتغيّر $1" >&2; exit 1; }; }
for v in AZURE_OPENAI_API_KEY AZURE_OPENAI_DEPLOYMENT AZURE_OPENAI_RESOURCE SUPABASE_URL SUPABASE_SERVICE_KEY; do req "$v"; done

echo "▸ المجموعة والبيئة"
az group create -n "$RG" -l "$LOC" -o none
az acr create -n "$ACR" -g "$RG" --sku Basic --admin-enabled true -o none 2>/dev/null || true
az containerapp env create -n "$ENVIRONMENT" -g "$RG" -l "$LOC" -o none 2>/dev/null || true

echo "▸ بناء الصورة من جذر المستودع"
az acr build -r "$ACR" -t "bp-agents:$(git rev-parse --short HEAD)" -f agents/azure/Dockerfile . -o none

# الأسرار في Azure لا في متغيّرات ظاهرة: `containerapp job show` يطبع البيئة.
SECRETS=(
  "azure-openai-key=$AZURE_OPENAI_API_KEY"
  "supabase-key=$SUPABASE_SERVICE_KEY"
)
[ -n "${BP_N8N_HOOK_KEY:-}" ] && SECRETS+=("n8n-hook-key=$BP_N8N_HOOK_KEY")

# كل مهمة وجدولها — نفس الأسماء في agents/azure/job.mjs.
create_job() {
  local name="$1" cron="$2" arg="$3"
  echo "▸ $name ($cron)"
  az containerapp job create \
    -n "bp-$name" -g "$RG" --environment "$ENVIRONMENT" \
    --trigger-type Schedule --cron-expression "$cron" \
    --replica-timeout 1800 --replica-retry-limit 1 --parallelism 1 \
    --image "$IMAGE" --cpu 0.5 --memory 1Gi \
    --registry-server "$ACR.azurecr.io" \
    --secrets "${SECRETS[@]}" \
    --env-vars \
      "AZURE_OPENAI_API_KEY=secretref:azure-openai-key" \
      "SUPABASE_SERVICE_KEY=secretref:supabase-key" \
      ${BP_N8N_HOOK_KEY:+"BP_N8N_HOOK_KEY=secretref:n8n-hook-key"} \
      "AZURE_OPENAI_DEPLOYMENT=$AZURE_OPENAI_DEPLOYMENT" \
      "AZURE_OPENAI_RESOURCE=$AZURE_OPENAI_RESOURCE" \
      "AZURE_OPENAI_API_VERSION=${AZURE_OPENAI_API_VERSION:-2025-03-01-preview}" \
      "SUPABASE_URL=$SUPABASE_URL" \
      "BP_N8N_BASE=${BP_N8N_BASE:-}" \
      "OWNER_WHATSAPP=${OWNER_WHATSAPP:-}" \
    --args "$arg" -o none
}

# التوقيت UTC — الرياض +3.
create_job morning       "0 3 * * *" morning
create_job site-check    "0 5 * * *" site-check
create_job weekly-content "0 6 * * 0" weekly-content

echo "▸ تم. للتشغيل الفوري مرة واحدة:"
echo "   az containerapp job start -n bp-morning -g $RG"
echo "▸ للسجلّ:"
echo "   az containerapp job execution list -n bp-morning -g $RG -o table"
