#!/usr/bin/env bash
# يبني حزمة عرض توفير العمالة لعميل جديد من ملف إعداد: ./new_quote.sh <config.json> <outdir> [--final]
# أنشئ ملف العميل بنسخ quote-config/template.json ثم غيّر فقط: المهن والمستويات والأعداد، الجنسيات، ساعات العمل، أيام العمل، اسم العميل والتاريخ.
set -euo pipefail
cd "$(dirname "$0")"
CFG="$(realpath "${1:?config.json}")"; OUT="${2:?outdir}"; shift 2
QUOTE_CFG="$CFG" ./build_all.sh "$OUT" "$@"
