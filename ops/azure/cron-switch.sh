#!/usr/bin/env bash
# Business Partner — تبديل المجدول: Vercel Cron ↔ Container Apps Jobs، مجدولٌ واحد فعّال فقط في كل وقت.
#
# قرار المالك 2026-10-16: لا تشغيل مزدوج ولو يوماً (النشرة الأسبوعية بريدٌ لكل المشتركين: مرتان = ضرر لا يُسحب).
# لذلك الترتيب واحد ثابت ومفروض هنا لا متروك للذاكرة:
#
#   on   (القطع)   ١) أوقف Vercel Cron من اللوحة (يدوياً: Project → Settings → Cron Jobs → Disable) ثم أكّد هنا
#                  ٢) تُنشأ المهام الثلاث من جدول vercel.json نفسه (مصدر واحد: node ops/azure/cron.mjs --list)
#   off  (التراجع) ١) تُحذف مهام Azure الثلاث أولاً  ٢) بعدها فقط فعّل Vercel Cron من اللوحة
#                  القديم يُطفأ قبل أن يُشغَّل الجديد دائماً؛ فنافذة بلا مجدول (تأخير) أهون من نافذة بمجدولين (تكرار).
#   status         يعرض المهام وآخر تنفيذاتها
#
# البيئة (إلزامية لـon):  RG  CAE (اسم بيئة Container Apps)  IMAGE (مثل bpwebacr.azurecr.io/bp-site:abc123)
#                         CRON_SECRET (يساوي سرّ الموقع؛ إن غاب يُسأل بلا صدى)  BASE (افتراضياً https://www.businesspartner.sa)
#   CONFIRM_VERCEL_CRON_DISABLED=yes   يتخطّى السؤال التفاعلي (للاختبار فقط)
# لا تُطبع قيمة السرّ أبداً. المهام بلا إعادة محاولة (replica-retry-limit 0): فشلُ مهمةٍ لا يُكرَّر تلقائياً فيرسل نشرةً ثانية.
set -euo pipefail

cmd="${1:-}"
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
BASE="${BASE:-https://www.businesspartner.sa}"

jobs_list() {
  # index<TAB>name<TAB>cron — من vercel.json عبر cron.mjs (لا نسخة ثانية للجدول)
  node "$here/cron.mjs" --list --json | node -e '
    let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{ for (const j of JSON.parse(s)) console.log([j.index,j.name,j.schedule].join("\t")); });'
}

need() { for v in "$@"; do [ -n "${!v:-}" ] || { echo "المتغيّر $v غير مضبوط" >&2; exit 2; }; done; }

case "$cmd" in
  on)
    need RG CAE IMAGE
    if [ "${CONFIRM_VERCEL_CRON_DISABLED:-}" != "yes" ]; then
      echo "⚠ لا تُنشأ مهام Azure قبل إيقاف Vercel Cron."
      echo "  Vercel → المشروع → Settings → Cron Jobs → Disable (ثلاث مهام)، وتأكّد أن الحالة Disabled."
      read -r -p "هل أوقفتَ Vercel Cron فعلاً؟ اكتب نعم للمتابعة: " ans
      [ "$ans" = "نعم" ] || { echo "توقّف: لم يُنشأ شيء." >&2; exit 1; }
    fi
    if [ -z "${CRON_SECRET:-}" ]; then read -r -s -p "CRON_SECRET: " CRON_SECRET; echo; fi
    [ -n "$CRON_SECRET" ] || { echo "CRON_SECRET فارغ" >&2; exit 2; }
    jobs_list | while IFS=$'\t' read -r idx name cron; do
      echo "→ $name  ($cron UTC)"
      az containerapp job create -g "$RG" -n "$name" --environment "$CAE" \
        --trigger-type Schedule --cron-expression "$cron" \
        --image "$IMAGE" --command node --args "ops/azure/cron.mjs" "$idx" \
        --cpu 0.25 --memory 0.5Gi \
        --replica-timeout 300 --replica-retry-limit 0 --replica-completion-count 1 --parallelism 1 \
        --mi-system-assigned --registry-server "${IMAGE%%/*}" --registry-identity system \
        --secrets "cron-secret=$CRON_SECRET" \
        --env-vars "CRON_SECRET=secretref:cron-secret" "BP_CRON_BASE=$BASE" \
        -o none
    done
    echo "✓ المجدول الفعّال الآن: Azure وحده. التراجع: bash ops/azure/cron-switch.sh off  ثم فعّل Vercel Cron."
    ;;
  off)
    need RG
    jobs_list | while IFS=$'\t' read -r _idx name _cron; do
      echo "✗ حذف $name"
      az containerapp job delete -g "$RG" -n "$name" --yes -o none || echo "  (غير موجودة)" >&2
    done
    echo "✓ لا مجدول فعّال الآن. الخطوة الأخيرة (يدوية): Vercel → Settings → Cron Jobs → Enable."
    ;;
  status)
    need RG
    jobs_list | while IFS=$'\t' read -r _idx name _cron; do
      echo "== $name"
      az containerapp job execution list -g "$RG" -n "$name" -o table \
        --query "[].{Status: properties.status, Name: name, Start: properties.startTime}" || true
    done
    ;;
  *)
    echo "استعمال: bash ops/azure/cron-switch.sh on|off|status" >&2
    exit 2
    ;;
esac
