#!/usr/bin/env bash
# المهام المجدولة للموقع على Azure — بديل `crons` في vercel.json (Container Apps Jobs).
#
#   bash ops/azure-site/crons.sh create     # ينشئ/يحدّث الثلاث «موقوفة» (جدولها لا يحلّ أبداً)
#   bash ops/azure-site/crons.sh activate   # يفعّل الجداول الحقيقية — لحظة تحويل النطاق فقط
#   bash ops/azure-site/crons.sh pause      # يعيدها موقوفة
#   bash ops/azure-site/crons.sh status     # الجدول وآخر تشغيل لكل مهمة
#   bash ops/azure-site/crons.sh run backfill   # تشغيل واحد الآن (newsletter يرسل بريداً حقيقياً — احذر)
#
# لماذا «موقوفة» ثم «تفعيل»: Vercel ما زال يشغّل crons نفسها على نشرته. تشغيل الاثنين معاً يرسل النشرة
# الأسبوعية مرتين (لا يوجد منع تكرار في api/newsletter.js). فتُفعَّل هنا عند تحويل النطاق، وتُحذف
# `crons` من vercel.json في الدفعة نفسها.
#
# الأمان: السرّ CRON_SECRET يُقرأ من الخزنة ويُحفظ سرّاً في المهمة (لا يظهر في الأوامر ولا السجلّ).
# الهدف: عنوان bp-site الداخلي على Azure، لا النطاق العام — فلا تتأثر بتحويل DNS.
set -euo pipefail
RG=rg-bp-web; KV=kv-bp-web-b354e2; APP=bp-site
IMG="docker.io/curlimages/curl:8.10.1"
NEVER="0 0 31 2 *"                     # 31 فبراير — لا يحلّ أبداً
# الاسم | الجدول (UTC، مطابق لـ vercel.json) | المسار
JOBS=(
  "newsletter|0 6 * * 0|/api/newsletter"
  "jobhunt|0 5 * * 1|/api/requests?__route=jobhunt&action=run&limit=15"
  "backfill|0 3 * * *|/api/candidate?action=backfill&limit=25"
)
cmd=${1:-status}

fqdn() { az containerapp show -n "$APP" -g "$RG" --query properties.configuration.ingress.fqdn -o tsv; }
envid() { az containerapp show -n "$APP" -g "$RG" --query properties.environmentId -o tsv; }
exists() { az containerapp job show -n "bp-cron-$1" -g "$RG" >/dev/null 2>&1; }

create() {
  local base env loc secret y; base="https://$(fqdn)"; env=$(envid)
  loc=$(az containerapp show -n "$APP" -g "$RG" --query location -o tsv)
  secret=$(az keyvault secret show --vault-name "$KV" --name cron-secret --query value -o tsv)
  [ -n "$secret" ] || { echo "cron-secret غير موجود في الخزنة"; exit 1; }
  umask 077; y=$(mktemp)
  for row in "${JOBS[@]}"; do
    IFS='|' read -r NAME _ PATH_ <<<"$row"
    # YAML لأن az يفسّر "-c" في --args خياراً له. الملف مؤقت بصلاحية 600 ويُحذف فوراً (فيه السرّ).
    TARGET="$base$PATH_" ENVID="$env" LOC="$loc" SECRET="$secret" NEVER="$NEVER" IMG="$IMG" python3 - >"$y" <<'PY'
import os, json
print(json.dumps({
  "location": os.environ["LOC"],
  "properties": {
    "environmentId": os.environ["ENVID"],
    "configuration": {
      "triggerType": "Schedule", "replicaTimeout": 900, "replicaRetryLimit": 0,
      "scheduleTriggerConfig": {"cronExpression": os.environ["NEVER"], "parallelism": 1, "replicaCompletionCount": 1},
      "secrets": [{"name": "cron-secret", "value": os.environ["SECRET"]}],
    },
    "template": {"containers": [{
      "name": "curl", "image": os.environ["IMG"],
      "command": ["/bin/sh"],
      "args": ["-c", 'curl -fsS --max-time 840 -H "Authorization: Bearer $CRON_SECRET" "$TARGET"'],
      "env": [{"name": "CRON_SECRET", "secretRef": "cron-secret"}, {"name": "TARGET", "value": os.environ["TARGET"]}],
      "resources": {"cpu": 0.25, "memory": "0.5Gi"},
    }]},
  },
}))
PY
    if exists "$NAME"; then
      az containerapp job update -n "bp-cron-$NAME" -g "$RG" --yaml "$y" -o none && echo "حُدِّثت bp-cron-$NAME (موقوفة)"
    else
      az containerapp job create -n "bp-cron-$NAME" -g "$RG" --yaml "$y" -o none && echo "أُنشئت bp-cron-$NAME (موقوفة)"
    fi
  done
  rm -f "$y"; unset secret
}

setcron() { # $1 = real|never
  for row in "${JOBS[@]}"; do
    IFS='|' read -r NAME CRON _ <<<"$row"
    exists "$NAME" || { echo "bp-cron-$NAME غير موجودة — شغّل create أولاً"; exit 1; }
    az containerapp job update -n "bp-cron-$NAME" -g "$RG" --cron-expression "$([ "$1" = real ] && echo "$CRON" || echo "$NEVER")" -o none
    echo "bp-cron-$NAME ← $([ "$1" = real ] && echo "$CRON" || echo "موقوفة")"
  done
}

case "$cmd" in
  create) create ;;
  activate) setcron real ;;
  pause) setcron never ;;
  status)
    for row in "${JOBS[@]}"; do IFS='|' read -r NAME _ _ <<<"$row"
      exists "$NAME" || { echo "bp-cron-$NAME: غير موجودة"; continue; }
      az containerapp job show -n "bp-cron-$NAME" -g "$RG" --query "{job:name,cron:properties.configuration.scheduleTriggerConfig.cronExpression}" -o tsv
      az containerapp job execution list -n "bp-cron-$NAME" -g "$RG" --query "[0].{status:properties.status,start:properties.startTime}" -o tsv 2>/dev/null || true
    done ;;
  run) az containerapp job start -n "bp-cron-${2:?الاسم: newsletter|jobhunt|backfill}" -g "$RG" -o none && echo "بدأ التشغيل" ;;
  *) echo "استعمل: create|activate|pause|status|run <name>"; exit 1 ;;
esac
