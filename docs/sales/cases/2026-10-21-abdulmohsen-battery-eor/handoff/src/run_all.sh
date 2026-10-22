#!/bin/bash
# بناء حزمة عبدالمحسن كاملة: bash run_all.sh  → pdfout/*.pdf
set -e
cd "$(dirname "$0")"
export REPO="$(git rev-parse --show-toplevel)"
bash setup_fonts.sh
bash build_all.sh
