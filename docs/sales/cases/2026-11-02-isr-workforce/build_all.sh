#!/usr/bin/env bash
# يولّد حزمة ISR Trading (توفير العمالة): HTML + PDF (كروم).
# ./build_all.sh <outdir> [--final] — بلا --final: نسخة المستودع (الآيبان [IBAN]، المجهولات [●]).
set -euo pipefail
cd "$(dirname "$0")"
OUT="${1:?outdir}"; shift || true
export NODE_PATH="$(npm root -g)"
mkdir -p "$OUT"
python3 build_html.py "$OUT" "$@"
node render.cjs pdf "$OUT/01-Quotation.html" "$OUT/01-Quotation.pdf" landscape
for f in 02-Agreement 03-NDA 07-Authorization-Letter 04-Required-Documents; do node render.cjs pdf "$OUT/$f.html" "$OUT/$f.pdf" portrait; done
