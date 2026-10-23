#!/usr/bin/env python3
# يبني صفحات الحاسبة المستقلة (HTML واحد بلا خادم) من template.html + data.json + i18n-fr-zh.json
#   python3 build.py            -> index.html         (نسخة المالك: وضع المالك + أزرار المعاينة)
#   python3 build.py --client   -> index-client.html  (نسخة العميل: بلا تفاصيل المالك)
#   python3 build.py --demo     -> index-demo.html    (ديمو للعرض على العميل: بيانات شركة مثال)
# بيانات عميل حقيقي (مثل ديمو سليمان الفواز) لا تُرفع إلى git؛ تُبنى محلياً من ملف json خاص عبر --fawaz <ملف>.
import json, base64, pathlib, sys
d = pathlib.Path(__file__).parent
t = (d / "template.html").read_text(encoding="utf-8")
j = (d / "data.json").read_text(encoding="utf-8")
tr = json.dumps(json.loads((d / "i18n-fr-zh.json").read_text(encoding="utf-8")), ensure_ascii=False)
logo_path = d.parents[4] / "site" / "assets" / "img" / "logo.png"
logo = "data:image/png;base64," + base64.b64encode(logo_path.read_bytes()).decode()
client = "--client" in sys.argv or "--demo" in sys.argv
demo = "--demo" in sys.argv
fz = "null"
if "--fawaz" in sys.argv:
    fz = pathlib.Path(sys.argv[sys.argv.index("--fawaz") + 1]).read_text(encoding="utf-8"); client = demo = True
name = "index-fawaz.html" if fz != "null" else "index-demo.html" if demo else "index-client.html" if client else "index.html"
out = d / name
out.write_text(t.replace("__DATA__", j).replace("__TR__", tr).replace("__CLIENT__", "true" if client else "false").replace("__DEMO__", "true" if demo else "false").replace("__FAWAZ__", fz).replace("__LOGO__", logo), encoding="utf-8")
print("built", out)
