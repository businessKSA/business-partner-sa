#!/usr/bin/env bash
# يولّد حزمة Nyra Collective (PDF): عرض السعر · العقد · عدم الإفصاح · التفويض · المستندات الداعمة.
# ./build_all.sh <outdir> [--final]  — بلا --final: نسخة المستودع (الآيبان [IBAN]).
# --final: يحقن BP_IBAN وBP_BANK وBP_CR_ADDR (عنوان السجل، الرياض) من البيئة (من بدر فقط)؛ لا تُحفظ مخرجاته في المستودع.
set -euo pipefail
cd "$(dirname "$0")"
OUT="${1:?outdir}"; shift || true
export NODE_PATH="$(npm root -g)"
mkdir -p "$OUT"
python3 build_html.py "$OUT" "$@"
node render.cjs pdf "$OUT/01-Quotation.html" "$OUT/01-Quotation.pdf" landscape
for f in 02-Agreement 03-NDA 07-Authorization-Letter 04-Client-Documents-Checklist 05-Client-Data-Form 06-Service-Guide; do
  node render.cjs pdf "$OUT/$f.html" "$OUT/$f.pdf" portrait
done
