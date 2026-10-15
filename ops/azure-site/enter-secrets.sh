#!/usr/bin/env bash
# إدخال أسرار الموقع في Azure Key Vault وربطها بحاويتَي الموقع — بلا لصق أي سرّ في محادثة.
#
#   az login            # بحساب مالك على الاشتراك (أو شغّله من Azure Cloud Shell)
#   bash ops/azure-site/enter-secrets.sh
#
# كل سؤال إدخاله مخفي (لا يظهر على الشاشة). Enter فارغ = تخطّي (يبقى القديم).
# القيم تذهب إلى الخزنة kv-bp-web-b354e2 ثم تُربط بـ bp-site و bp-site-staging كمراجع خزنة (لا نسخ).
set -euo pipefail
RG=rg-bp-web; KV=kv-bp-web-b354e2; APPS=(bp-site bp-site-staging)
URI="https://$KV.vault.azure.net/secrets"

# اسم المتغير في الكود | وصف يُعرض لك | يُولَّد تلقائياً إن تُرك فارغاً؟ (gen)
ITEMS=(
  "WHATSAPP_TOKEN|رمز واتساب Cloud API الدائم (Meta → System User)|"
  "CRON_SECRET|سرّ المهام المجدولة (تُرك فارغاً: يُولَّد عشوائياً)|gen"
  "DASHBOARD_KEY|مفتاح اللوحة DASHBOARD_KEY (يجب أن يطابق ما تستعمله n8n)|"
  "LEADS_KEY|مفتاح العملاء المحتملين LEADS_KEY|"
  "SIMPLE_OPS_KEY|مفتاح عمليات الموقع الجديد SIMPLE_OPS_KEY|"
  "OFFER_OPS_KEY|مفتاح عروض الأسعار OFFER_OPS_KEY|"
  "DOC_AGENT_HOOK_KEY|مفتاح وكيل المستندات DOC_AGENT_HOOK_KEY|"
)

kebab() { echo "$1" | tr 'A-Z_' 'a-z-'; }
for row in "${ITEMS[@]}"; do
  IFS='|' read -r NAME DESC GEN <<<"$row"
  read -r -s -p "$NAME — $DESC: " VAL; echo
  if [ -z "$VAL" ]; then
    [ "$GEN" = gen ] && VAL=$(openssl rand -hex 32) || { echo "  تخطّي $NAME"; continue; }
  fi
  SN=$(kebab "$NAME")
  printf '%s' "$VAL" | az keyvault secret set --vault-name "$KV" --name "$SN" --file /dev/stdin --encoding utf-8 -o none
  unset VAL
  for A in "${APPS[@]}"; do
    az containerapp secret set -n "$A" -g "$RG" --secrets "$SN=keyvaultref:$URI/$SN,identityref:system" -o none
    az containerapp update -n "$A" -g "$RG" --set-env-vars "$NAME=secretref:$SN" -o none
  done
  echo "  ✔ $NAME"
done
echo "تمّ. أعد تشغيل المراجعة النشطة ليقرأ الجديد:  az containerapp revision restart -n bp-site-staging -g $RG --revision <اسمها>"
