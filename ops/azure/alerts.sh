#!/usr/bin/env bash
# Business Partner — تنبيهات Azure Monitor للقطع والأسابيع التي بعده.
#
#   bash ops/azure/alerts.sh create     ينشئ مجموعة الإجراء (بريد المالك) وكل التنبيهات
#   bash ops/azure/alerts.sh list       يعرض ما أُنشئ
#   bash ops/azure/alerts.sh delete     يحذف تنبيهات bp-* وحدها
#
# البيئة (إلزامية):  RG  APP (bp-site)  OWNER_EMAIL (بريد التنبيه)  FD_PROFILE (afd-bp)  LAW (اسم Log Analytics workspace)
# اختيارية:          QAPP (bp-quotes)  عند ضبطه تُنشأ تنبيهات اللوحة أيضاً
#
# كل الأسماء والمقاييس من توثيق Azure Monitor يوم 2026-10-16:
#   Container Apps: Requests (بُعد statusCodeCategory) · Replicas · RestartCount · MemoryPercentage (معاينة)
#   Front Door Std/Premium: Percentage5XX · OriginHealthPercentage
# لم يُنفَّذ شيء منها على اشتراك حقيقي هنا؛ إن رفض الأمر اسماً فاعرضه في بوابة Monitor → Alerts بالاسم نفسه.
set -euo pipefail

cmd="${1:-}"
need() { for v in "$@"; do [ -n "${!v:-}" ] || { echo "المتغيّر $v غير مضبوط" >&2; exit 2; }; done; }

case "$cmd" in
  create)
    need RG APP OWNER_EMAIL FD_PROFILE LAW
    AG="$(az monitor action-group create -g "$RG" -n bp-ag --short-name bp --action email owner "$OWNER_EMAIL" --query id -o tsv)"
    APP_ID="$(az containerapp show -g "$RG" -n "$APP" --query id -o tsv)"
    FD_ID="$(az afd profile show -g "$RG" --profile-name "$FD_PROFILE" --query id -o tsv)"
    LAW_ID="$(az monitor log-analytics workspace show -g "$RG" -n "$LAW" --query id -o tsv)"

    metric() { # الاسم النطاق الشرط النافذة الخطورة الوصف
      az monitor metrics alert create -g "$RG" -n "$1" --scopes "$2" --condition "$3" \
        --window-size "$4" --evaluation-frequency 1m --severity "$5" --action "$AG" --description "$6" -o none
      echo "✓ $1"
    }
    metric bp-fd-5xx        "$FD_ID"  "avg Percentage5XX > 5"                    5m 1 "أكثر من ٥٪ من الطلبات ٥xx عند Front Door"
    metric bp-fd-origin     "$FD_ID"  "avg OriginHealthPercentage < 90"          5m 1 "فحوص الصحة من Front Door إلى التطبيق تفشل"
    metric bp-app-5xx       "$APP_ID" "total Requests > 20 where statusCodeCategory includes 5xx" 5m 2 "أكثر من ٢٠ ردّاً ٥xx في ٥ دقائق من التطبيق"
    metric bp-app-replicas  "$APP_ID" "min Replicas < 2"                         5m 1 "أقل من نسختين تعملان (الحدّ الأدنى ٢)"
    metric bp-app-memory    "$APP_ID" "avg MemoryPercentage > 85"                10m 2 "الذاكرة فوق ٨٥٪ — راجع تسرّباً أو ارفع الحدّ"
    metric bp-app-restarts  "$APP_ID" "max RestartCount > 3"                    15m 2 "إعادات تشغيل متكرّرة للحاوية"
    if [ -n "${QAPP:-}" ]; then
      Q_ID="$(az containerapp show -g "$RG" -n "$QAPP" --query id -o tsv)"
      metric bp-quotes-5xx      "$Q_ID" "total Requests > 10 where statusCodeCategory includes 5xx" 5m 2 "لوحة العروض تردّ ٥xx"
      metric bp-quotes-replicas "$Q_ID" "min Replicas < 1"                     5m 1 "لوحة العروض متوقّفة"
      metric bp-quotes-memory   "$Q_ID" "avg MemoryPercentage > 85"            10m 2 "ذاكرة لوحة العروض (Chromium للـPDF)"
    fi

    # تنبيهات السجلات (تتطلّب امتداد scheduled-query: az extension add --name scheduled-query)
    logalert() { # الاسم الاستعلام العتبة الوصف
      az monitor scheduled-query create -g "$RG" -n "$1" --scopes "$LAW_ID" \
        --condition "count 'Q1' > $3" --condition-query Q1="$2" \
        --window-duration 5m --evaluation-frequency 5m --severity 2 --action-groups "$AG" --description "$4" -o none
      echo "✓ $1"
    }
    logalert bp-log-errors \
      "ContainerAppConsoleLogs_CL | where ContainerAppName_s == '$APP' | where Log_s has '\"level\":\"error\"'" \
      10 "أكثر من ١٠ أخطاء مسجَّلة من الخادم في ٥ دقائق"
    logalert bp-log-egress \
      "ContainerAppConsoleLogs_CL | where ContainerAppName_s == '$APP' | where Log_s has 'egress_blocked'" \
      0 "خرج نداء إلى *.vercel.app وحُجب — اعتمادٌ باقٍ على Vercel"
    logalert bp-cron-failed \
      "ContainerAppConsoleLogs_CL | where ContainerGroupName_s startswith 'bp-cron' | where Log_s matches regex @'HTTP (4|5)[0-9][0-9]'" \
      0 "مهمة مجدولة انتهت بخطأ HTTP"
    az monitor scheduled-query create -g "$RG" -n bp-log-daily-cap --scopes "$LAW_ID" \
      --condition "count 'Q1' > 0" --condition-query Q1="_LogOperation | where Category =~ 'Ingestion' | where Detail contains 'OverQuota'" \
      --window-duration 5m --evaluation-frequency 5m --severity 3 --action-groups "$AG" --description "بلغ السجلّ سقفه اليومي" -o none
    echo "✓ bp-log-daily-cap"
    ;;
  list)
    need RG
    az monitor metrics alert list -g "$RG" --query "[?starts_with(name,'bp-')].{name:name,enabled:enabled,severity:severity}" -o table
    az monitor scheduled-query list -g "$RG" --query "[?starts_with(name,'bp-')].{name:name,enabled:enabled}" -o table
    ;;
  delete)
    need RG
    for n in $(az monitor metrics alert list -g "$RG" --query "[?starts_with(name,'bp-')].name" -o tsv); do az monitor metrics alert delete -g "$RG" -n "$n"; echo "✗ $n"; done
    for n in $(az monitor scheduled-query list -g "$RG" --query "[?starts_with(name,'bp-')].name" -o tsv); do az monitor scheduled-query delete -g "$RG" -n "$n" --yes; echo "✗ $n"; done
    ;;
  *)
    echo "استعمال: bash ops/azure/alerts.sh create|list|delete" >&2
    exit 2
    ;;
esac
