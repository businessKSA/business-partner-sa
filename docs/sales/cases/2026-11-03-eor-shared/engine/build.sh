#!/usr/bin/env bash
# يولّد حزمة عميل: HTML ثم PDF (كروم).  ./build.sh <cfg.py> <outdir> [--only quote,agreement,nda,authz]
set -euo pipefail
export PYTHONDONTWRITEBYTECODE=1
HERE="$(cd "$(dirname "$0")" && pwd)"
CFG="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"; OUT="$2"; shift 2
export NODE_PATH="$(npm root -g)"
mkdir -p "$OUT"
python3 "$HERE/eorpack.py" "$CFG" "$OUT" "$@"
for f in 01-Quotation 02-Agreement 03-NDA 04-Authorization-Letter; do
  [ -f "$OUT/$f.html" ] || continue
  if [ "$f" = "01-Quotation" ]; then M=landscape; else M=portrait; fi
  node "$HERE/render.cjs" pdf "$OUT/$f.html" "$OUT/$f.pdf" $M
done
echo "pdf ok: $OUT"
