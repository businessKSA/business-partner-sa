#!/usr/bin/env bash
# نقل لوحة bp-quotes (المجلد quotes/) إلى Azure Container Apps + PostgreSQL
# (قرار المالك 2026-10-16). تطبيق مستقل: basePath '/quotes' على المنفذ 3000.
#
# الاستعمال:
#   bash azure/quotes/deploy.sh            # dry-run: يطبع الخطة فقط، لا يلمس Azure
#   bash azure/quotes/deploy.sh --apply    # تنفيذ حقيقي (ينشئ موارد تُحتسب من المنحة)
#
# يقلّد azure/n8n/deploy.sh: إعادة التشغيل آمنة (idempotent)، الأسرار المولَّدة
# تُقرأ من التطبيق إن وُجد ولا تُبدَّل، ولا يُطبع أي سرّ أبداً.
# هذا السكربت لا ينقل بيانات القاعدة القديمة: النقل يتم بإشراف المالك (README).
#
# متغيرات اختيارية: BP_AZ_RG · BP_AZ_LOCATION · BP_AZ_ENV · BP_QUOTES_APP ·
#   BP_QUOTES_PG · BP_QUOTES_ACR · BP_QUOTES_TAG · BP_QUOTES_MIN · BP_QUOTES_PUBLIC_URL
#
# min-replicas (المفاضلة):
#   1 (الافتراضي) = نسخة دائمة. تكلفتها أعلى، لكن لا بداية باردة: ويبهوكات
#     مُيسّر وDocuSign تنتظر ردّاً سريعاً، والطابور داخل العملية، وتوليد PDF
#     بالمتصفح ثقيل الإقلاع.
#   0 = ينام بلا طلبات فيوفّر معظم التكلفة، لكن أول طلب يتأخر ثوانٍ وقد تنتهي
#     مهلة ويبهوك فيُعاد إرساله. اختره فقط إن ثبت أن الحمولة قليلة.
#   max=1 دائماً: الطابور والجلسات في الذاكرة، ولا نريد نسختين تعملان معاً.
set -euo pipefail

APPLY=0
for a in "$@"; do
  case "$a" in
    --apply) APPLY=1 ;;
    -h|--help) sed -n '2,22p' "$0"; exit 0 ;;
    *) echo "علم غير معروف: $a (المتاح: --apply)" >&2; exit 2 ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RG="${BP_AZ_RG:-bp-ai}"
LOC="${BP_AZ_LOCATION:-swedencentral}"
ENVIRONMENT="${BP_AZ_ENV:-bp-agents-env}"
APP="${BP_QUOTES_APP:-bp-quotes}"
PG="${BP_QUOTES_PG:-bp-quotes-pg}"
DB="quotes"
PGUSER_NAME="quotesadmin"
MIN="${BP_QUOTES_MIN:-1}"
TAG="${BP_QUOTES_TAG:-$(date +%Y%m%d%H%M%S)}"
PUBLIC_URL="${BP_QUOTES_PUBLIC_URL:-https://businesspartner.sa}"
ACR="${BP_QUOTES_ACR:-}"   # اسم عالمي فريد، أحرف وأرقام فقط؛ يُشتق من رقم الاشتراك إن تُرك فارغاً

# أسرار تُمرَّر من بيئة المشغّل (تُخزَّن أسراراً في التطبيق). ما لم يُضبط يُتخطّى.
PASS_SECRETS=(
  PANEL_BRIDGE_TOKEN
  MOYASAR_SECRET_KEY MOYASAR_PUBLISHABLE_KEY MOYASAR_WEBHOOK_SECRET
  TAMARA_API_TOKEN
  RESEND_API_KEY SMTP_PASS
  DOCUSIGN_INTEGRATION_KEY DOCUSIGN_USER_ID DOCUSIGN_ACCOUNT_ID
  DOCUSIGN_PRIVATE_KEY DOCUSIGN_CONNECT_HMAC_KEY
  CATALOG_SYNC_TOKEN CATALOG_WEBHOOK_TOKEN
  INNGEST_EVENT_KEY INNGEST_SIGNING_KEY
)
# إعدادات غير سرّية تُمرَّر كما هي إن ضُبطت.
PASS_PLAIN=(
  MAIL_PROVIDER MAIL_FROM NOTIFY_EMAIL ADMIN_EMAIL SMTP_HOST SMTP_PORT SMTP_USER SMTP_SECURE
  PAYMENT_PROVIDER PAY_TAMARA DAFTRA_MODE DOCUSIGN_MODE DOCUSIGN_API_BASE DOCUSIGN_AUTH_BASE
  SITE_URL SITE_API_URL
)

secret_name() { echo "$1" | tr 'A-Z_' 'a-z-'; }

step() { echo "▸ $*"; }

if [ "$APPLY" = 1 ]; then
  command -v az >/dev/null || { echo "az غير مثبّت." >&2; exit 1; }
  az account show -o none 2>/dev/null || { echo "سجّل الدخول أولاً: az login" >&2; exit 1; }
  [ -f "$ROOT/quotes/Dockerfile" ] || { echo "ينقص quotes/Dockerfile (يكتبه وكيل quotes-contracts)." >&2; exit 1; }
  SUB="$(az account show --query id -o tsv)"
  [ -n "$ACR" ] || ACR="bpquotes$(printf '%s' "$SUB" | md5sum | cut -c1-8)"
else
  echo "═══ وضع التجربة (dry-run): لا شيء يُنشأ. أضف --apply للتنفيذ ═══"
  [ -n "$ACR" ] || ACR="bpquotes<8 خانات من رقم الاشتراك>"
fi

IMAGE_REF="$ACR.azurecr.io/bp-quotes:$TAG"
PGHOST="$PG.postgres.database.azure.com"

step "الخطة: مجموعة=$RG · بيئة=$ENVIRONMENT · تطبيق=$APP · قاعدة=$PG/$DB · سجل=$ACR · صورة=$IMAGE_REF · min=$MIN max=1"

# ── المزوّدون والمجموعة والبيئة ──────────────────────────────────────────────
step "تسجيل مزوّدي الخدمة (آمن إن كانوا مسجّلين) + إضافة ContainerRegistry"
for p in Microsoft.App Microsoft.OperationalInsights Microsoft.DBforPostgreSQL Microsoft.ContainerRegistry; do
  if [ "$APPLY" = 1 ]; then
    az provider register -n "$p" --wait -o none 2>/dev/null || \
      echo "تنبيه: تعذّر تسجيل $p — سجّله مرة من Cloud Shell: az provider register -n $p"
  else echo "  [dry-run] az provider register -n $p --wait"; fi
done

step "مجموعة الموارد والبيئة (تُستعمل الموجودتان)"
if [ "$APPLY" = 1 ]; then
  az group show -n "$RG" -o none 2>/dev/null || az group create -n "$RG" -l "$LOC" -o none
  az containerapp env show -n "$ENVIRONMENT" -g "$RG" -o none 2>/dev/null || \
    az containerapp env create -n "$ENVIRONMENT" -g "$RG" -l "$LOC" -o none
else
  echo "  [dry-run] تُنشأ $RG و$ENVIRONMENT فقط إن لم توجدا"
fi

# ── الأسرار المولَّدة: اقرأها إن وُجد التطبيق وإلا ولّدها ───────────────────
SESSION=""; PGPASS=""
if [ "$APPLY" = 1 ]; then
  if az containerapp show -n "$APP" -g "$RG" -o none 2>/dev/null; then
    SESSION=$(az containerapp secret show -n "$APP" -g "$RG" --secret-name session-secret --query value -o tsv 2>/dev/null || true)
    PGPASS=$(az containerapp secret show -n "$APP" -g "$RG" --secret-name pg-pass --query value -o tsv 2>/dev/null || true)
  fi
  [ -n "$SESSION" ] || SESSION=$(openssl rand -hex 32)
  [ -n "$PGPASS" ] || PGPASS="Bp$(openssl rand -hex 16)9aA"
  echo "::add-mask::$SESSION" 2>/dev/null || true
  echo "::add-mask::$PGPASS" 2>/dev/null || true
else
  step "أسرار تُولَّد أو تُقرأ من التطبيق: session-secret · pg-pass (لا تُطبع)"
fi

# ── Azure Container Registry + بناء الصورة ──────────────────────────────────
step "سجل الحاويات $ACR (Basic) — يُنشأ إن لم يوجد"
if [ "$APPLY" = 1 ]; then
  az acr show -n "$ACR" -g "$RG" -o none 2>/dev/null || \
    az acr create -n "$ACR" -g "$RG" -l "$LOC" --sku Basic --admin-enabled true -o none
else echo "  [dry-run] az acr create -n $ACR -g $RG --sku Basic (إن غاب)"; fi

step "بناء الصورة في السحابة من quotes/Dockerfile (لا docker محلي)"
if [ "$APPLY" = 1 ]; then
  az acr build -r "$ACR" -t "bp-quotes:$TAG" -f "$ROOT/quotes/Dockerfile" "$ROOT/quotes" -o none
else echo "  [dry-run] az acr build -r $ACR -t bp-quotes:$TAG -f quotes/Dockerfile quotes/"; fi

# ── PostgreSQL ──────────────────────────────────────────────────────────────
step "خادم PostgreSQL $PG (Burstable B1ms، 32GB، v16) وقاعدة $DB"
if [ "$APPLY" = 1 ]; then
  if ! az postgres flexible-server show -n "$PG" -g "$RG" -o none 2>/dev/null; then
    az postgres flexible-server create -n "$PG" -g "$RG" -l "$LOC" \
      --tier Burstable --sku-name Standard_B1ms --storage-size 32 --version 16 \
      --admin-user "$PGUSER_NAME" --admin-password "$PGPASS" \
      --public-access 0.0.0.0 --yes -o none
  fi
  az postgres flexible-server db show -g "$RG" -s "$PG" -d "$DB" -o none 2>/dev/null || \
    az postgres flexible-server db create -g "$RG" -s "$PG" -d "$DB" -o none
else
  echo "  [dry-run] az postgres flexible-server create ... --sku-name Standard_B1ms (إن غاب) ثم db create $DB"
fi

# ── الأسرار الممرَّرة: ما ضُبط في بيئة المشغّل فقط ──────────────────────────
SECRET_ARGS=(); ENV_ARGS=(); SKIPPED=()
for k in "${PASS_SECRETS[@]}"; do
  v="${!k:-}"
  if [ -n "$v" ]; then
    n="$(secret_name "$k")"
    SECRET_ARGS+=("$n=$v"); ENV_ARGS+=("$k=secretref:$n")
    echo "::add-mask::$v" 2>/dev/null || true
  else SKIPPED+=("$k"); fi
done
for k in "${PASS_PLAIN[@]}"; do
  v="${!k:-}"; [ -z "$v" ] || ENV_ARGS+=("$k=$v")
done
if [ "${#SKIPPED[@]}" -gt 0 ]; then
  echo "⚠️ أسرار لم تُضبط في بيئة المشغّل فتُخطّيت (الميزة المرتبطة بها لن تعمل حتى تضيفها):"
  printf '   - %s\n' "${SKIPPED[@]}"
fi

# DATABASE_URL و DIRECT_DATABASE_URL يُبنيان من خادم Azure (كلمة المرور hex فلا ترميز).
DBURL="postgresql://$PGUSER_NAME:$PGPASS@$PGHOST:5432/$DB?sslmode=require"

BASE_ENV=(
  "NODE_ENV=production" "PORT=3000" "HOSTNAME=0.0.0.0"
  "DATABASE_URL=secretref:database-url"
  "DIRECT_DATABASE_URL=secretref:direct-database-url"
  "SESSION_SECRET=secretref:session-secret"
  "APP_URL=$PUBLIC_URL"
  "TZ=Asia/Riyadh"
)

# ── تطبيق الحاوية ───────────────────────────────────────────────────────────
step "تطبيق $APP: ingress خارجي على 3000، min=$MIN max=1، 1 vCPU / 2Gi (توليد PDF بالمتصفح يحتاج ذاكرة)"
if [ "$APPLY" = 1 ]; then
  ACR_USER=$(az acr credential show -n "$ACR" --query username -o tsv)
  ACR_PASS=$(az acr credential show -n "$ACR" --query 'passwords[0].value' -o tsv)
  echo "::add-mask::$ACR_PASS" 2>/dev/null || true
  CORE_SECRETS=("session-secret=$SESSION" "pg-pass=$PGPASS" "database-url=$DBURL" "direct-database-url=$DBURL")

  if az containerapp show -n "$APP" -g "$RG" -o none 2>/dev/null; then
    az containerapp registry set -n "$APP" -g "$RG" --server "$ACR.azurecr.io" \
      --username "$ACR_USER" --password "$ACR_PASS" -o none
    az containerapp secret set -n "$APP" -g "$RG" --secrets "${CORE_SECRETS[@]}" ${SECRET_ARGS[@]+"${SECRET_ARGS[@]}"} -o none
    az containerapp update -n "$APP" -g "$RG" --image "$IMAGE_REF" \
      --min-replicas "$MIN" --max-replicas 1 \
      --set-env-vars "${BASE_ENV[@]}" ${ENV_ARGS[@]+"${ENV_ARGS[@]}"} -o none
  else
    az containerapp create -n "$APP" -g "$RG" --environment "$ENVIRONMENT" \
      --image "$IMAGE_REF" --registry-server "$ACR.azurecr.io" \
      --registry-username "$ACR_USER" --registry-password "$ACR_PASS" \
      --target-port 3000 --ingress external \
      --min-replicas "$MIN" --max-replicas 1 --cpu 1.0 --memory 2.0Gi \
      --secrets "${CORE_SECRETS[@]}" ${SECRET_ARGS[@]+"${SECRET_ARGS[@]}"} \
      --env-vars "${BASE_ENV[@]}" ${ENV_ARGS[@]+"${ENV_ARGS[@]}"} -o none
  fi
  FQDN=$(az containerapp show -n "$APP" -g "$RG" --query properties.configuration.ingress.fqdn -o tsv)
  echo "▸ تم. العنوان: https://$FQDN/quotes"
  echo "الخطوات التالية في azure/quotes/README.md: نقل القاعدة بإشراف المالك، الفحص، ثم تحويل رسالتي /quotes."
else
  echo "  [dry-run] az containerapp create|update $APP --image $IMAGE_REF --target-port 3000 --ingress external"
  echo "  [dry-run] أسرار التطبيق: session-secret pg-pass database-url direct-database-url + ${#SECRET_ARGS[@]} ممرَّرة"
  echo "═══ انتهت التجربة. لم يُنشأ شيء. ═══"
fi
