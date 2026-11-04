#!/usr/bin/env bash
# يولّد حزمة ISR Trading (توفير العمالة): HTML + PDF (كروم).
# ./build_all.sh <outdir> [--final] [--keep-dots]
#   بلا --final: نسخة المراجعة (الآيبان [IBAN]).  --final: يحقن بيانات الشركة.
#   الافتراضي: كل [●] متبقٍّ يصير حقل تعبئة في PDF ليكتبه العميل مباشرة. --keep-dots يُبقي النقاط (للمراجعة الداخلية).
set -euo pipefail
cd "$(dirname "$0")"
OUT="${1:?outdir}"; shift || true
FIELDS=1; ARGS=()
for a in "$@"; do if [ "$a" = "--keep-dots" ]; then FIELDS=0; else ARGS+=("$a"); fi; done
export NODE_PATH="$(npm root -g)"
mkdir -p "$OUT"
python3 build_html.py "$OUT" "${ARGS[@]+"${ARGS[@]}"}"
if [ "$FIELDS" = 1 ]; then
  python3 fillable_pass.py "$OUT"
  render() { node render_fld.cjs "$1" "$2"; python3 -c "import sys; sys.path.insert(0,'../2026-10-28-paint-factory-gr/v2'); import fillable; print('fields', fillable.add_fields(sys.argv[1]))" "$2"; }
else
  render() { node render.cjs pdf "$1" "$2" "$3"; }
fi
render "$OUT/01-Quotation-Simple.html" "$OUT/01-Quotation-Simple.pdf" landscape
render "$OUT/01B-Quotation-Detailed.html" "$OUT/01B-Quotation-Detailed.pdf" landscape
for f in 02-Agreement 03-NDA 07-Authorization-Letter 04-Required-Documents; do render "$OUT/$f.html" "$OUT/$f.pdf" portrait; done
rm -rf __pycache__ ../2026-10-28-paint-factory-gr/v2/__pycache__
