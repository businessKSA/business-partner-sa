#!/bin/bash
# usage: new-client.sh <slug>   — copies the EOR package source into a new case folder
set -e
SLUG="$1"; [ -n "$SLUG" ] || { echo "usage: $0 <slug>"; exit 1; }
ROOT="$(git rev-parse --show-toplevel)/docs/sales"
SRC="$ROOT/cases/2026-10-21-abdulmohsen-battery-eor/handoff/src"
DST="$ROOT/cases/$(date +%F)-$SLUG/handoff/src"
[ ! -e "$DST" ] || { echo "exists: $DST"; exit 1; }
mkdir -p "$DST"
(cd "$SRC" && tar cf - --exclude=out --exclude=outp --exclude=outm --exclude=outn --exclude=pdfout --exclude=pdfwork --exclude='pairs_eor_m*.json' --exclude=boards_prop.json .) | (cd "$DST" && tar xf -)
echo "created $DST"
