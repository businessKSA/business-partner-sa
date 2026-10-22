#!/usr/bin/env python3
# يبني index.html مستقلاً (صفحة واحدة بلا خادم) من template.html + data.json + i18n-fr-zh.json
import json, pathlib
d = pathlib.Path(__file__).parent
t = (d / "template.html").read_text(encoding="utf-8")
j = (d / "data.json").read_text(encoding="utf-8")
tr = json.dumps(json.loads((d / "i18n-fr-zh.json").read_text(encoding="utf-8")), ensure_ascii=False)
(d / "index.html").write_text(t.replace("__DATA__", j).replace("__TR__", tr), encoding="utf-8")
print("built", d / "index.html")
