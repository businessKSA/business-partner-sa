#!/usr/bin/env bash
# يبني حزمة عميل: ./build.sh <مجلد-العميل>   (يقرأ <مجلد-العميل>/spec.py ويكتب out/*.html و out/*.pdf)
# يحتاج Node مع playwright عالمياً (npm root -g) وpython3. لا يلمس الشبكة سوى خطوط Google Fonts.
set -euo pipefail
E="$(cd "$(dirname "$0")" && pwd)"
C="$(cd "$1" && pwd)"
export NODE_PATH="$(npm root -g)"
mkdir -p "$C/out"
python3 "$E/pack.py" "$C/spec.py" "$C/out"
for h in "$C"/out/*.html; do
  b="$(basename "$h" .html)"
  o=portrait; case "$b" in 01-Quotation) o=landscape;; esac
  node "$E/render.cjs" pdf "$h" "$C/out/$b.pdf" "$o"
done
ls -1 "$C/out"
