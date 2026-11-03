#!/usr/bin/env bash
# يولّد الحزمة كاملة: HTML + PDF (كروم) + DOCX + PPTX.
# ./build_all.sh <outdir> [--final]   — بلا --final: نسخة المستودع (جوال [●]، آيبان [IBAN]).
# --final: يحقن الجوال (BP_PHONE) والآيبان (BP_IBAN) والبنك (BP_BANK) من البيئة؛ لا تُحفظ مخرجاته في المستودع.
set -euo pipefail
cd "$(dirname "$0")"
OUT="${1:?outdir}"; shift || true
export NODE_PATH="$(npm root -g)"
mkdir -p "$OUT"
python3 build_html.py "$OUT" "$@"
python3 build_office.py "$OUT" "$@"
node render.cjs pdf "$OUT/01-Quotation.html" "$OUT/01-Quotation.pdf" landscape
node render.cjs pdf "$OUT/02-Agreement.html" "$OUT/02-Agreement.pdf" portrait
node render.cjs pdf "$OUT/03-NDA.html" "$OUT/03-NDA.pdf" portrait
node render.cjs pdf "$OUT/07-Authorization-Letter.html" "$OUT/07-Authorization-Letter.pdf" portrait
python3 profile.py "$OUT"
python3 franchise_docs.py "$OUT"
for f in 08-Company-Profile 09-Client-Requirements-List 10-Disclosure-Document-Outline 11-Franchise-Agreement-Localisation-Outline 12-Operations-and-Brand-Manual-Brief 13-Registration-Letter 14-Trademark-Review-Checklist; do node render.cjs pdf "$OUT/$f.html" "$OUT/$f.pdf" portrait; done
