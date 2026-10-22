#!/usr/bin/env python3
# يبني index.html مستقلاً (صفحة واحدة بلا خادم) من template.html + data.json + i18n-fr-zh.json
# python3 build.py          -> index.html (نسخة المالك، فيها وضع المالك)
# python3 build.py --client -> index-client.html (نسخة العميل بلا وضع المالك ولا ملاحظات داخلية)
import json, pathlib, sys
d = pathlib.Path(__file__).parent
t = (d / "template.html").read_text(encoding="utf-8")
j = (d / "data.json").read_text(encoding="utf-8")
tr = json.dumps(json.loads((d / "i18n-fr-zh.json").read_text(encoding="utf-8")), ensure_ascii=False)
client = "--client" in sys.argv
out = d / ("index-client.html" if client else "index.html")
out.write_text(t.replace("__DATA__", j).replace("__TR__", tr).replace("__CLIENT__", "true" if client else "false"), encoding="utf-8")
print("built", out)
