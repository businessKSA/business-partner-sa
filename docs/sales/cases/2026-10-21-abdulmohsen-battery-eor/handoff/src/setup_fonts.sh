#!/bin/bash
# يجلب خطوط fontsource (مرة واحدة) إلى المجلد الحالي كما يتوقعها gen_deck.py
set -e
cd "$(dirname "$0")"
for p in ibm-plex-mono ibm-plex-sans-arabic playfair-display; do
  d=x_fontsource-$p-5.3.0
  [ -d "$d/package/files" ] && continue
  mkdir -p "$d"; npm pack @fontsource/$p@5.3.0 --silent >/dev/null
  tar -xzf fontsource-$p-5.3.0.tgz -C "$d"; rm -f fontsource-$p-5.3.0.tgz
done
