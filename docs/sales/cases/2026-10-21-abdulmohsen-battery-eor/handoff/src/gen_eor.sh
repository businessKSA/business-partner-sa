cd "$(dirname "$0")"
# two separate agreements: CT1 = Model 1 (Transparent Cost), CT2 = Model 2 (Full Employee Cost)
python3 make_variants.py >/dev/null
mkdir -p out/project
for v in 1 2; do
  if [ $v = 1 ]; then export VT_EN="Model 1 · Transparent Cost"; export VT_AR="النموذج (1): التكلفة بشفافية"; else export VT_EN="Model 2 · Full Employee Cost"; export VT_AR="النموذج (2): تكلفة الموظف الكاملة"; fi
  export PAIRS=pairs_eor_m$v.json MODEL=$v PFX=CT$v
  for m in bi ar en; do MODE=$m python3 ctgen.py || exit 1; done
done
