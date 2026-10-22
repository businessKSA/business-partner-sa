#!/usr/bin/env python3
# يبني index.html مستقلاً (صفحة واحدة بلا خادم) من template.html + data.json
import pathlib
d = pathlib.Path(__file__).parent
t = (d / "template.html").read_text(encoding="utf-8")
j = (d / "data.json").read_text(encoding="utf-8")
(d / "index.html").write_text(t.replace("__DATA__", j), encoding="utf-8")
print("built", d / "index.html")
