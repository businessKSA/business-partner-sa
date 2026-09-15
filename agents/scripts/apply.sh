#!/usr/bin/env bash
# ينشئ (أول مرة) أو يحدّث (بعدها) البيئة وذاكرة الفريق والوكلاء الخمسة من ملفات YAML.
# الاستخدام: bash agents/scripts/apply.sh
source "$(dirname "$0")/_lib.sh"
cd "$AGENTS_DIR"

echo "== البيئة"
if [ -z "${ENV_ID:-}" ]; then
  save_id ENV_ID "$(ant beta:environments create < environment.yaml --transform id -r)"
  echo "أُنشئت البيئة: $ENV_ID"
else
  ant beta:environments update --environment-id "$ENV_ID" < environment.yaml >/dev/null
  echo "حُدّثت البيئة: $ENV_ID"
fi

echo "== ذاكرة الفريق"
if [ -z "${MEMORY_STORE_ID:-}" ]; then
  save_id MEMORY_STORE_ID "$(ant beta:memory-stores create \
    --name "bp-team" \
    --description "ذاكرة فريق Business Partner الذكي: قرارات المالك، دروس من العملاء، المشاكل المعروفة في الموقع (site/)، وتفضيلات الفريق. اقرأ README.md أولًا." \
    --transform id -r)"
  echo "أُنشئت الذاكرة: $MEMORY_STORE_ID"
else
  echo "الذاكرة موجودة: $MEMORY_STORE_ID"
fi

# apply_agent KEY file-stem
apply_agent() {
  local key="$1" stem="$2" id="${!1:-}"
  if [ -z "$id" ]; then
    id="$(render "$stem.agent.yaml" | ant beta:agents create --system "@prompts/$stem.md" --transform id -r)"
    save_id "$key" "$id"
    echo "أُنشئ $stem: $id"
  else
    render "$stem.agent.yaml" | ant beta:agents update --agent-id "$id" --system "@prompts/$stem.md" >/dev/null
    echo "حُدّث $stem: $id"
  fi
}

echo "== المتخصصون"
apply_agent AGENT_MAZEN mazen
apply_agent AGENT_BADR badr
apply_agent AGENT_FARAH farah
apply_agent AGENT_MOHAMMED mohammed-site

echo "== المنسّق باهر"
apply_agent AGENT_BAHER baher

echo
echo "تم. المعرّفات محفوظة في agents/ids.env (ارفعها إلى git)."
echo "التالي: bash agents/scripts/vault.sh ثم npm run run -- \"رسالة تجريبية\" ثم bash agents/scripts/schedule.sh"
