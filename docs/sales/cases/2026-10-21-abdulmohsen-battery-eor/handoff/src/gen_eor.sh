cd "$(dirname "$0")"
# two separate agreements: CT1 = Model 1 (Transparent Cost), CT2 = Model 2 (Full Employee Cost)
python3 make_variants.py >/dev/null
mkdir -p out/project
for v in 1 2; do
  if [ $v = 1 ]; then export VT_EN="Model 1 · Transparent Cost"; export VT_AR="النموذج (1): التكلفة بشفافية"; else export VT_EN="Model 2 · Full Employee Cost"; export VT_AR="النموذج (2): تكلفة الموظف الكاملة"; fi
  export PAIRS=pairs_eor_m$v.json
  find outm/project -name 'CTAR-*' -delete; find outm/project -name 'CTEN-*' -delete
  python3 gen_ct.py
  MODE=ar python3 m_ct.py; MODE=en python3 m_ct.py
  for f in out/project/CT-*.dc.html; do mv "$f" "out/project/CT${v}-${f##*/CT-}"; done
  for f in outm/project/CTAR-*.dc.html; do mv "$f" "out/project/CT${v}AR-${f##*/CTAR-}"; done
  for f in outm/project/CTEN-*.dc.html; do mv "$f" "out/project/CT${v}EN-${f##*/CTEN-}"; done
done
