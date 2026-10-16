#!/usr/bin/env bash
# n8n على Azure Container Apps (منطقة UAE North، مجموعة الموارد bp-ai) — قرار المالك 2026-10-16:
# «أوقف Vercel وn8n تماماً، وكل شيء على Azure».
#
# يُلصَق في Azure Cloud Shell (Bash) ويُشغَّل خطوة خطوة بالأرقام. كل خطوة آمنة للإعادة
# (تتحقق مما هو موجود قبل أن تنشئ). لا يطبع أي سرّ، ولا يكتب سرّاً في ملف باقٍ.
#
#   النسخة (إلزامية، مثبّتة — لا latest): ضع رقم نسخة n8n Cloud الحالية، من n8n → Help → About n8n
#       export N8N_VERSION=1.xx.x
#   ثم:
#       bash deploy.sh check            # يطبع القيم ويتحقق من الدخول — لا ينشئ شيئاً
#       bash deploy.sh 1                # مزوّدو الخدمة + إضافة containerapp
#       bash deploy.sh 2                # هوية مُدارة + بيئة Container Apps
#       bash deploy.sh 3                # Key Vault + مفتاح تشفير n8n وكلمة مرور القاعدة (تُولَّد مرة)
#       bash deploy.sh 4                # PostgreSQL Flexible Server
#       bash deploy.sh 5                # تطبيق n8n (نسخة واحدة دائمة). مع OWNER_IP=<عنوانك> يحصر الدخول به فوراً
#       bash deploy.sh 6 BP_PANEL_KEY DOC_AGENT_HOOK_KEY   # أسرار تقرؤها السيناريوهات بـ$env (تُسأل بصمت)
#       bash deploy.sh 7                # (اختياري، موصى به) نطاق n8n.businesspartner.sa
#       bash deploy.sh 8 lock|unlock    # (اختياري) حصر الدخول بعنوانك أثناء إنشاء حساب المالك
#       bash deploy.sh 9                # حالة + فحص الصحة
#       bash deploy.sh upgrade 1.yy.y   # ترقية النسخة (تداخل ثوانٍ بين مراجعتين — اجعلها خارج الذروة)
#       bash deploy.sh logs             # آخر السجلّ
#   أو الكل بالترتيب (بدون 6/7/8): bash deploy.sh all
#
# لماذا هذه الخيارات:
#   • min=max=1: المؤقّتات والاستطلاع (Gmail/Notion/واتساب) تعمل داخل العملية نفسها؛ عند الصفر لا تعمل،
#     وعند أكثر من واحد تتكرّر الرسائل. n8n بلا وضع Queue هنا نسخة واحدة عمداً.
#   • PostgreSQL لا SQLite: الحالة (السيناريوهات، الاعتمادات، staticData، جداول البيانات) تعيش في القاعدة،
#     فلا حاجة لحجم ملفات مُركَّب (Azure Files + n8n يعطيان مشاكل أذونات). الحاوية قابلة للاستبدال.
#   • N8N_ENCRYPTION_KEY في Key Vault ويُقرأ بهوية مُدارة (secretref). فقدانه = فقدان كل الاعتمادات
#     المحفوظة؛ لذلك Key Vault بحماية من الحذف (purge protection) ولا يُبدَّل أبداً بعد أول اعتماد.
#   • N8N_BLOCK_ENV_ACCESS_IN_NODE=false: بعض السيناريوهات (Agent Gate، Follow-up Sweep، مزامنة الخزنة)
#     تقرأ $env.* في عقد Code؛ الإصدارات الحديثة تحجبها افتراضياً.
set -euo pipefail
set +x

RG="${BP_RG:-bp-ai}"
LOC="${BP_LOCATION:-uaenorth}"
PG_LOC="${BP_PG_LOCATION:-$LOC}"   # إن رفضت UAE North إنشاء خادم PostgreSQL (قيد سعة) غيّر هذه فقط
APP="${BP_N8N_APP:-bp-n8n}"
ENVN="${BP_N8N_ENV:-bp-n8n-env}"
UAMI="${BP_N8N_IDENTITY:-bp-n8n-id}"
DB="n8n"
PG_USER="n8nadmin"
N8N_VERSION="${N8N_VERSION:-}"
DOMAIN="${BP_N8N_DOMAIN:-n8n.businesspartner.sa}"
OWNER_IP="${OWNER_IP:-}"

KV_SECRET_ENC="n8n-encryption-key"
KV_SECRET_PG="n8n-db-password"
sub_id() { az account show --query id -o tsv; }

# أسماء فريدة عالمياً (PostgreSQL وKey Vault): لاحقة ثابتة من رقم الاشتراك → نفس الاسم في كل إعادة تشغيل.
init_names() {
  az account show -o none 2>/dev/null || { printf '✗ ادخل أولاً: az login\n' >&2; exit 1; }
  SUFFIX="${BP_N8N_SUFFIX:-$(sub_id | sha1sum | cut -c1-6)}"
  PG="${BP_N8N_PG:-bp-n8n-pg-$SUFFIX}"
  KV="${BP_N8N_KV:-bpn8nkv$SUFFIX}"
}

say() { printf '▸ %s\n' "$*"; }
die() { printf '✗ %s\n' "$*" >&2; exit 1; }

need_version() {
  [ -n "$N8N_VERSION" ] || die "ضع N8N_VERSION (نسخة n8n Cloud الحالية: Help → About n8n). لا نشر بـlatest."
  case "$N8N_VERSION" in latest|next|stable|beta) die "النسخة يجب أن تكون رقماً ثابتاً لا «$N8N_VERSION»." ;; esac
  case "$N8N_VERSION" in [0-9]*.[0-9]*.[0-9]*) ;; *) die "صيغة النسخة غير مفهومة: $N8N_VERSION (المتوقّع مثل 1.95.3)." ;; esac
}

image() { printf 'docker.n8n.io/n8nio/n8n:%s' "$N8N_VERSION"; }
kv_url() { az keyvault show -n "$KV" -g "$RG" --query properties.vaultUri -o tsv | sed 's#/*$##'; }
uami_id() { az identity show -g "$RG" -n "$UAMI" --query id -o tsv; }
default_domain() { az containerapp env show -n "$ENVN" -g "$RG" --query properties.defaultDomain -o tsv; }
app_fqdn() { az containerapp show -n "$APP" -g "$RG" --query properties.configuration.ingress.fqdn -o tsv; }

# يكتب سرّاً في Key Vault من الإدخال القياسي عبر ملف مؤقّت 600 يُمسح فوراً (لا قيمة في سطر الأوامر).
put_secret() {
  local name="$1" f rc=0
  f="$(mktemp)"; chmod 600 "$f"
  cat > "$f"
  az keyvault secret set --vault-name "$KV" -n "$name" --file "$f" --encoding utf-8 -o none || rc=$?
  shred -u "$f" 2>/dev/null || rm -f "$f"
  return "$rc"
}

# يمنح دوراً إن لم يكن ممنوحاً (إعادة التشغيل آمنة)، ويُبلّغ إن فشل بدل أن يصمت.
ensure_role() {
  local oid="$1" ptype="$2" role="$3" scope="$4"
  if [ -n "$(az role assignment list --assignee "$oid" --role "$role" --scope "$scope" --query '[0].id' -o tsv 2>/dev/null)" ]; then return 0; fi
  az role assignment create --assignee-object-id "$oid" --assignee-principal-type "$ptype" \
    --role "$role" --scope "$scope" -o none || say "تحذير: تعذّر منح «$role» — امنحه يدوياً من البوابة (Access control)."
}
secret_exists() { az keyvault secret show --vault-name "$KV" -n "$1" --query id -o tsv >/dev/null 2>&1; }
secret_value() { az keyvault secret show --vault-name "$KV" -n "$1" --query value -o tsv; }

# اسم سرّ Key Vault من اسم متغيّر بيئة: BP_PANEL_KEY → bp-panel-key
kv_name_for() { printf '%s' "$1" | tr 'A-Z_' 'a-z-'; }

cmd_check() {
  say "الاشتراك: $(sub_id)"
  say "المجموعة: $RG  ·  المنطقة: $LOC  ·  قاعدة البيانات في: $PG_LOC"
  say "التطبيق: $APP  ·  البيئة: $ENVN  ·  Key Vault: $KV  ·  PostgreSQL: $PG"
  if [ -n "$N8N_VERSION" ]; then need_version; say "الصورة: $(image)"; else say "N8N_VERSION غير مضبوط بعد (إلزامي للخطوة 5)"; fi
  az group show -n "$RG" --query "{name:name,location:location}" -o table
  say "المناطق التي يتوفر فيها Container Apps (تأكّد أن $LOC فيها):"
  az provider show -n Microsoft.App --query "resourceTypes[?resourceType=='managedEnvironments'].locations[]" -o tsv 2>/dev/null | tr '\n' ' ' || true
  echo
}

cmd_1() {
  say "تسجيل مزوّدي الخدمة (يلزم صلاحية على الاشتراك — Owner/Contributor)"
  for p in Microsoft.App Microsoft.OperationalInsights Microsoft.DBforPostgreSQL Microsoft.KeyVault Microsoft.ManagedIdentity; do
    az provider register -n "$p" --wait -o none && say "  $p ✓"
  done
  say "إضافة containerapp (يلزم إصدار حديث لدعم مراجع Key Vault)"
  az extension add --name containerapp --upgrade --yes -o none
}

cmd_2() {
  az group show -n "$RG" -o none 2>/dev/null || die "مجموعة الموارد $RG غير موجودة. أنشئها أو غيّر BP_RG."
  say "هوية مُدارة ($UAMI) — تقرأ بها الحاوية الأسرار من Key Vault"
  az identity show -g "$RG" -n "$UAMI" -o none 2>/dev/null || az identity create -g "$RG" -n "$UAMI" -l "$LOC" -o none
  say "بيئة Container Apps ($ENVN) في $LOC — خطة Consumption"
  az containerapp env show -n "$ENVN" -g "$RG" -o none 2>/dev/null || az containerapp env create -n "$ENVN" -g "$RG" -l "$LOC" -o none
}

cmd_3() {
  say "Key Vault ($KV) — صلاحيات RBAC، حماية من الحذف النهائي"
  if ! az keyvault show -n "$KV" -g "$RG" -o none 2>/dev/null; then
    az keyvault create -n "$KV" -g "$RG" -l "$LOC" --enable-rbac-authorization true \
      --enable-purge-protection true --retention-days 90 -o none
  fi
  local kv_id me pid
  kv_id="$(az keyvault show -n "$KV" -g "$RG" --query id -o tsv)"
  me="$(az ad signed-in-user show --query id -o tsv)"
  say "منحك صلاحية كتابة الأسرار على هذا الـVault (Owner وحده لا يكفي مع RBAC)"
  ensure_role "$me" User "Key Vault Secrets Officer" "$kv_id"
  pid="$(az identity show -g "$RG" -n "$UAMI" --query principalId -o tsv)"
  ensure_role "$pid" ServicePrincipal "Key Vault Secrets User" "$kv_id"

  say "انتظار انتشار الصلاحيات (حتى دقيقتين)…"
  local i ok=0
  for i in $(seq 1 12); do
    if az keyvault secret list --vault-name "$KV" --maxresults 1 -o none 2>/dev/null; then ok=1; break; fi
    sleep 10
  done
  [ "$ok" = 1 ] || die "الصلاحيات لم تنتشر بعد — أعد الخطوة 3 بعد دقيقة."

  if secret_exists "$KV_SECRET_ENC"; then
    say "مفتاح التشفير موجود — لم يُبدَّل (تبديله يُتلف كل اعتماد محفوظ)"
  else
    say "توليد مفتاح تشفير n8n وحفظه في Key Vault (لا يُطبع)"
    openssl rand -hex 32 | tr -d '\n' | put_secret "$KV_SECRET_ENC"
  fi
  if secret_exists "$KV_SECRET_PG"; then
    say "كلمة مرور القاعدة موجودة"
  else
    say "توليد كلمة مرور القاعدة وحفظها (لا تُطبع)"
    printf 'Bp%s9aA' "$(openssl rand -hex 16)" | put_secret "$KV_SECRET_PG"
  fi
  say "⚠ نسخة احتياطية من مفتاح التشفير خارج Azure (مدير كلمات المرور عند المالك): Key Vault → Secrets → $KV_SECRET_ENC → Show"
  say "  لا تُرسله لأحد ولا تلصقه في محادثة."
}

cmd_4() {
  secret_exists "$KV_SECRET_PG" || die "نفّذ الخطوة 3 أولاً."
  if az postgres flexible-server show -n "$PG" -g "$RG" -o none 2>/dev/null; then
    say "خادم PostgreSQL موجود"
  else
    say "إنشاء PostgreSQL Flexible Server ($PG) في $PG_LOC — Burstable B1ms، 64GB، نسخ احتياطي 14 يوماً"
    local pass; pass="$(secret_value "$KV_SECRET_PG")"
    az postgres flexible-server create -n "$PG" -g "$RG" -l "$PG_LOC" \
      --tier Burstable --sku-name Standard_B1ms --storage-size 64 --version 16 \
      --admin-user "$PG_USER" --admin-password "$pass" \
      --backup-retention 14 --high-availability Disabled \
      --public-access 0.0.0.0 --yes -o none \
      || die "تعذّر إنشاء الخادم. إن كان السبب قيد سعة/منطقة فجرّب: BP_PG_LOCATION=<منطقة أخرى> bash deploy.sh 4"
    unset pass
  fi
  az postgres flexible-server db show -g "$RG" -s "$PG" -d "$DB" -o none 2>/dev/null \
    || az postgres flexible-server db create -g "$RG" -s "$PG" -d "$DB" -o none
  say "قاعدة $DB جاهزة. (الوصول: «السماح لخدمات Azure» فقط + TLS إلزامي)"
}

cmd_5() {
  need_version
  secret_exists "$KV_SECRET_ENC" || die "نفّذ الخطوة 3 أولاً."
  az postgres flexible-server show -n "$PG" -g "$RG" -o none 2>/dev/null || die "نفّذ الخطوة 4 أولاً."
  if az containerapp show -n "$APP" -g "$RG" -o none 2>/dev/null; then
    say "التطبيق موجود. للترقية: bash deploy.sh upgrade <نسخة>. لا يُعاد إنشاؤه."
    return 0
  fi
  local kv uami dd host
  kv="$(kv_url)"; uami="$(uami_id)"; dd="$(default_domain)"
  host="$APP.$dd"
  say "إنشاء تطبيق n8n ($(image)) — نسخة واحدة دائمة، منفذ 5678"
  az containerapp create -n "$APP" -g "$RG" --environment "$ENVN" \
    --image "$(image)" \
    --user-assigned "$uami" \
    --target-port 5678 --ingress external --transport http \
    --min-replicas 1 --max-replicas 1 --cpu 1.0 --memory 2.0Gi \
    --secrets \
      "n8n-enc-key=keyvaultref:$kv/secrets/$KV_SECRET_ENC,identityref:$uami" \
      "pg-pass=keyvaultref:$kv/secrets/$KV_SECRET_PG,identityref:$uami" \
    --env-vars \
      DB_TYPE=postgresdb \
      "DB_POSTGRESDB_HOST=$PG.postgres.database.azure.com" \
      DB_POSTGRESDB_PORT=5432 \
      "DB_POSTGRESDB_DATABASE=$DB" \
      "DB_POSTGRESDB_USER=$PG_USER" \
      DB_POSTGRESDB_PASSWORD=secretref:pg-pass \
      DB_POSTGRESDB_SCHEMA=public \
      DB_POSTGRESDB_SSL_ENABLED=true \
      DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED=false \
      N8N_ENCRYPTION_KEY=secretref:n8n-enc-key \
      N8N_PORT=5678 N8N_PROTOCOL=https \
      "N8N_HOST=$host" "WEBHOOK_URL=https://$host/" "N8N_EDITOR_BASE_URL=https://$host/" \
      N8N_PROXY_HOPS=1 \
      GENERIC_TIMEZONE=Asia/Riyadh TZ=Asia/Riyadh \
      N8N_BLOCK_ENV_ACCESS_IN_NODE=false \
      N8N_RUNNERS_ENABLED=true \
      EXECUTIONS_DATA_SAVE_ON_ERROR=all EXECUTIONS_DATA_SAVE_ON_SUCCESS=all \
      EXECUTIONS_DATA_SAVE_MANUAL_EXECUTIONS=true \
      EXECUTIONS_DATA_PRUNE=true EXECUTIONS_DATA_MAX_AGE=72 EXECUTIONS_DATA_PRUNE_MAX_COUNT=20000 \
      N8N_DIAGNOSTICS_ENABLED=false N8N_VERSION_NOTIFICATIONS_ENABLED=false N8N_PERSONALIZATION_ENABLED=false \
    -o none
  say "تم: https://$host"
  if [ -n "$OWNER_IP" ]; then
    cmd_8 lock
  else
    say "⚠ أول من يفتح الصفحة يصير مالك n8n. افتحها الآن وأنشئ حساب المالك فوراً"
    say "  (أو احصر الدخول بعنوانك: OWNER_IP=<عنوانك> bash deploy.sh 8 lock — ثم unlock قبل القطع)."
  fi
  say "ثم: Settings → n8n API → Create API key (للأداة migrate-workflows.mjs)."
}

# الأسرار التي تقرؤها السيناريوهات بـ$env.NAME — الأسماء من تقرير الأداة: migrate-workflows.mjs report
cmd_6() {
  [ "$#" -ge 1 ] || die "الاستعمال: bash deploy.sh 6 NAME1 NAME2 …  (أسماء متغيّرات \$env من تقرير الأداة)"
  az containerapp show -n "$APP" -g "$RG" -o none 2>/dev/null || die "نفّذ الخطوة 5 أولاً."
  local kv uami name kvn val secrets=() envs=()
  kv="$(kv_url)"; uami="$(uami_id)"
  for name in "$@"; do
    case "$name" in *[!A-Za-z0-9_]*|'') die "اسم غير صالح: $name" ;; esac
    kvn="$(kv_name_for "$name")"
    if secret_exists "$kvn"; then say "$name: موجود في Key Vault"
    else
      printf 'قيمة %s (لا تظهر أثناء الكتابة): ' "$name" >&2
      IFS= read -rs val; echo >&2
      [ -n "$val" ] || die "قيمة فارغة لـ$name"
      printf '%s' "$val" | put_secret "$kvn"; unset val
    fi
    secrets+=("$kvn=keyvaultref:$kv/secrets/$kvn,identityref:$uami")
    envs+=("$name=secretref:$kvn")
  done
  az containerapp secret set -n "$APP" -g "$RG" --secrets "${secrets[@]}" -o none
  az containerapp update -n "$APP" -g "$RG" --set-env-vars "${envs[@]}" -o none
  say "أُضيفت: $* (مراجع Key Vault — لا قيم في الإعدادات)"
}

cmd_7() {
  [ -n "$DOMAIN" ] || die "ضع BP_N8N_DOMAIN"
  local fqdn vid host label
  fqdn="$(app_fqdn)"
  vid="$(az containerapp show -n "$APP" -g "$RG" --query properties.customDomainVerificationId -o tsv)"
  label="${DOMAIN%%.*}"
  cat <<EOF
أضف هذين السجلّين في DNS نطاق businesspartner.sa (عند مزوّد النطاق)، ثم اضغط Enter هنا:
  CNAME  $label            →  $fqdn
  TXT    asuid.$label      →  $vid
EOF
  read -r -p "تمّ الإضافة؟ (Enter للمتابعة، Ctrl+C للإلغاء) " _
  az containerapp hostname add -n "$APP" -g "$RG" --hostname "$DOMAIN" -o none 2>/dev/null || true
  az containerapp hostname bind -n "$APP" -g "$RG" --environment "$ENVN" --hostname "$DOMAIN" --validation-method CNAME -o none
  host="$DOMAIN"
  az containerapp update -n "$APP" -g "$RG" \
    --set-env-vars "N8N_HOST=$host" "WEBHOOK_URL=https://$host/" "N8N_EDITOR_BASE_URL=https://$host/" -o none
  say "n8n الآن على https://$host  — هذا هو العنوان الذي يُوضع في N8N_BASE_URL وفي Meta."
  say "تغيّر WEBHOOK_URL: أي رابط ويبهوك كنتَ نسخته من العنوان الافتراضي (azurecontainerapps.io) يُنسخ من جديد من العقدة."
}

cmd_8() {
  case "${1:-}" in
    lock)
      [ -n "$OWNER_IP" ] || die "ضع OWNER_IP=<عنوانك العام> (https://ifconfig.me)"
      az containerapp ingress access-restriction set -n "$APP" -g "$RG" --rule-name owner-setup \
        --ip-address "$OWNER_IP/32" --action Allow -o none
      say "الدخول محصور بـ$OWNER_IP. أنشئ حساب المالك، ثم: bash deploy.sh 8 unlock (قبل القطع، وإلا لن تصل الويبهوكات)." ;;
    unlock)
      az containerapp ingress access-restriction remove -n "$APP" -g "$RG" --rule-name owner-setup -o none
      say "رُفع الحصر — الدخول عام (الويبهوكات تحتاجه)." ;;
    *) die "الاستعمال: bash deploy.sh 8 lock|unlock" ;;
  esac
}

cmd_9() {
  local fqdn
  fqdn="$(app_fqdn)"
  az containerapp show -n "$APP" -g "$RG" \
    --query "{running:properties.runningStatus, image:properties.template.containers[0].image, min:properties.template.scale.minReplicas, max:properties.template.scale.maxReplicas, region:location}" -o table
  say "العنوان: https://$fqdn"
  say "فحص الصحة:"
  curl -fsS --max-time 20 "https://$fqdn/healthz" && echo || say "لم يردّ بعد (قد يحتاج دقيقة أثناء الإقلاع) — bash deploy.sh logs"
  say "تذكير: لا تُفعَّل سيناريوهات المؤقّت/الاستطلاع هنا قبل إيقافها في n8n Cloud (docs/n8n-azure-cutover-2026-10-16.md)."
}

cmd_upgrade() {
  N8N_VERSION="${1:-$N8N_VERSION}"; need_version
  say "ترقية إلى $(image) — النسخ التلقائي يومي؛ لنسخة فورية قبل الترقية:"
  say "  az postgres flexible-server backup create -g $RG -n $PG --backup-name pre-upgrade-$(date +%Y%m%d%H%M)"
  az containerapp update -n "$APP" -g "$RG" --image "$(image)" -o none
  say "تمّت. تداخل المراجعتين لثوانٍ قد يكرّر مشغّلاً واحداً — لذلك خارج الذروة."
}

cmd_logs() { az containerapp logs show -n "$APP" -g "$RG" --tail 100 --format text; }

usage() {
  cat <<'EOF'
export N8N_VERSION=1.xx.x   # نسخة n8n Cloud الحالية، إلزامي ومثبّت
bash deploy.sh check | 1 | 2 | 3 | 4 | 5 | 6 NAME… | 7 | 8 lock|unlock | 9 | all | upgrade <نسخة> | logs
(الشرح الكامل في رأس الملف وفي docs/n8n-azure-cutover-2026-10-16.md)
EOF
}

[ "${1:-help}" = help ] || [ "${1:-}" = -h ] || [ "${1:-}" = --help ] || init_names

case "${1:-help}" in
  check) cmd_check ;;
  1) cmd_1 ;; 2) cmd_2 ;; 3) cmd_3 ;; 4) cmd_4 ;; 5) cmd_5 ;;
  6) shift; cmd_6 "$@" ;;
  7) cmd_7 ;;
  8) shift; cmd_8 "$@" ;;
  9) cmd_9 ;;
  all) cmd_1; cmd_2; cmd_3; cmd_4; cmd_5; cmd_9 ;;
  upgrade) shift; cmd_upgrade "$@" ;;
  logs) cmd_logs ;;
  help|-h|--help|*) usage ;;
esac
