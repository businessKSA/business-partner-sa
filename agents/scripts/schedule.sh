#!/usr/bin/env bash
# ينشئ الجدولات (deployments) من agents/deployments/*.yaml. الوكلاء يعملون بعدها بدون تدخل.
# الاستخدام: bash agents/scripts/schedule.sh          (كل الجدولات)
#            bash agents/scripts/schedule.sh site-daily-check
source "$(dirname "$0")/_lib.sh"
cd "$AGENTS_DIR"
: "${AGENT_BAHER:?شغّل apply.sh أولًا}" "${ENV_ID:?شغّل apply.sh أولًا}" "${MEMORY_STORE_ID:?شغّل apply.sh أولًا}"
: "${VAULT_ID:?ضع VAULT_ID في agents/.env (vault.sh)}"
: "${OWNER_WHATSAPP:?ضع OWNER_WHATSAPP في agents/.env}"

# الموارد المشتركة لكل جدولة: الذاكرة + الخزنة (+ المستودع لفحص الموقع)
resources_block() {
  cat <<YAML
vault_ids: [$VAULT_ID]
resources:
  - type: memory_store
    memory_store_id: $MEMORY_STORE_ID
    access: read_write
    instructions: "ذاكرة الفريق. اقرأ README.md أولًا؛ سجّل القرارات والدروس المهمة فقط."
YAML
  if [ "$1" = "site-daily-check" ]; then
    : "${GITHUB_TOKEN:?فحص الموقع يحتاج GITHUB_TOKEN في agents/.env}"
    cat <<YAML
  - type: github_repository
    url: https://github.com/businessKSA/business-partner-sa
    mount_path: /workspace/business-partner-sa
    authorization_token: "$GITHUB_TOKEN"
    checkout: { type: branch, name: main }
YAML
  fi
}

for f in deployments/${1:-*}.yaml; do
  stem="$(basename "$f" .yaml)"
  key="DEPL_$(echo "$stem" | tr 'a-z-' 'A-Z_')"
  body="$( { render "$f"; resources_block "$stem"; } )"
  if [ -z "${!key:-}" ]; then
    id="$(printf '%s\n' "$body" | ant beta:deployments create --transform id -r)"
    save_id "$key" "$id"
    echo "أُنشئت الجدولة $stem: $id"
  else
    printf '%s\n' "$body" | ant beta:deployments update --deployment-id "${!key}" >/dev/null
    echo "حُدّثت الجدولة $stem: ${!key}"
  fi
  ant beta:deployments retrieve --deployment-id "${!key}" --transform 'schedule.upcoming_runs_at' 2>/dev/null || true
done
echo "تم. لإيقاف جدولة مؤقتًا: ant beta:deployments pause --deployment-id <id>"
