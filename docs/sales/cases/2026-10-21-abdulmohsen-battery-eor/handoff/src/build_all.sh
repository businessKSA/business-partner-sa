set -e
cd "$(dirname "$0")"
python3 gen_nda.py >/dev/null; MODE=ar python3 m_nda.py >/dev/null; MODE=en python3 m_nda.py >/dev/null
rm -rf out; mkdir -p out/project; cp outn/project/* outm/project/* out/project/
python3 gen_prop.py >/dev/null
[ -f pairs_eor.json ] && [ -f gen_eor.sh ] && bash gen_eor.sh || true
python3 pdfbuild.py >/dev/null
CH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
mkdir -p pdfout
for f in pdfwork/*.html; do n=$(basename $f .html); timeout 120 $CH --headless --no-sandbox --disable-gpu --no-pdf-header-footer --print-to-pdf=pdfout/$n.pdf file://$PWD/$f >/dev/null 2>&1; done
ls -l pdfout
