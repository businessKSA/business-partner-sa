# -*- coding: utf-8 -*-
"""عارض حزمة العميل — قالب معتمد دائماً (قرار المالك 5 نوفمبر 2026).
كل مستند خطوة؛ انتقال متحرك بين المستندات، وفي آخر كل مستند بطاقة «الخطوة التالية» (عرض السعر ← العقد ← عدم الإفصاح ← المستندات ← الملف التعريفي).
الاستعمال: python3 build_viewer.py <مجلد الصور> <config.json> <index.html>
config.json: {"title": "...", "steps": [{"key":"a","ar":"العرض المبسط","en":"Simple quotation","pages":5}, ...,
              {"key":"p","ar":"الملف التعريفي","en":"Company profile","link":"https://drive.google.com/..."}]}
الصور باسم <key>-<n>.jpg (الرقم بصفرين للمفصل فقط إن وُجد في الملف)."""
import json, os, sys, html

CSS = """
:root{--bg:#f6f5f2;--fg:#1c1c1c;--card:#fff;--ac:#0b3d6b;--mut:#5b6385}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#141414;--fg:#eee;--card:#1e1e1e;--ac:#7fb2e5;--mut:#a3aad0}}
:root[data-theme="dark"]{--bg:#141414;--fg:#eee;--card:#1e1e1e;--ac:#7fb2e5;--mut:#a3aad0}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,sans-serif;overflow-x:hidden}
header{position:sticky;top:0;background:var(--bg);padding:8px 12px 10px;z-index:5;box-shadow:0 1px 4px #0003}
h1{font-size:16px;margin:0 0 8px}
.steps{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px}
.steps button{flex:none;border:0;background:var(--card);color:var(--ac);padding:7px 12px;border-radius:999px;font:inherit;font-size:14px;cursor:pointer;min-height:38px;display:flex;align-items:center;gap:6px;transition:background .25s,color .25s,transform .25s}
.steps button b{display:inline-flex;width:22px;height:22px;border-radius:50%;background:var(--ac);color:#fff;font-size:12px;align-items:center;justify-content:center}
.steps button.on{background:var(--ac);color:#fff;transform:translateY(-1px)}.steps button.on b{background:#fff;color:var(--ac)}
.steps button.done b{background:#2e8b57}
.bar{height:3px;background:#0002;margin-top:8px;border-radius:2px;overflow:hidden}.bar i{display:block;height:100%;background:var(--ac);width:0;transition:width .5s ease}
.z{display:flex;gap:6px;align-items:center;margin-top:8px}.z button{flex:none;border:0;background:var(--card);color:var(--ac);padding:6px 12px;border-radius:8px;font:inherit;cursor:pointer}.z span{min-width:52px;text-align:center}
main{padding:8px;position:relative}
section{display:none}section.on{display:block;animation:in .45s cubic-bezier(.2,.8,.2,1)}
section.on.back{animation:inb .45s cubic-bezier(.2,.8,.2,1)}
@keyframes in{from{opacity:0;transform:translateX(-40px)}to{opacity:1;transform:none}}
@keyframes inb{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:none}}
.pg{overflow:auto;margin:0 0 14px;background:#fff;border-radius:4px;box-shadow:0 1px 6px #0004}
.pg img{display:block;height:auto;width:var(--w,100%);max-width:none;cursor:zoom-in}
.c{text-align:center;font-size:13px;opacity:.7;margin:0 0 4px}
.next{margin:22px auto 40px;max-width:560px;background:var(--card);border:2px solid var(--ac);border-radius:14px;padding:18px;text-align:center}
.next small{display:block;color:var(--mut);margin-bottom:4px}
.next a,.next button{display:inline-block;margin-top:10px;background:var(--ac);color:#fff;border:0;border-radius:10px;padding:12px 22px;font:inherit;font-size:17px;cursor:pointer;text-decoration:none;transition:transform .2s}
.next a:hover,.next button:hover{transform:translateX(-4px)}
.next .pv{background:transparent;color:var(--ac);border:1px solid var(--ac);font-size:14px;padding:8px 16px;margin-inline-start:8px}
.prof{max-width:560px;margin:40px auto;background:var(--card);border-radius:14px;padding:26px;text-align:center;box-shadow:0 2px 12px #0002}
"""

def build(img_dir, cfg, out):
    steps = cfg["steps"]; n = len(steps)
    chips = "".join('<button data-i="%d"><b>%d</b>%s</button>' % (i, i + 1, html.escape(s["ar"])) for i, s in enumerate(steps))
    secs = []
    for i, s in enumerate(steps):
        body = ""
        if s.get("link"):
            body = '<div class="prof"><h2>%s · %s</h2><p>الملف التعريفي المعتمد من سارة، ثنائي اللغة.</p><a class="go" href="%s" target="_blank" rel="noopener" style="display:inline-block;background:var(--ac);color:#fff;border-radius:10px;padding:12px 22px;text-decoration:none">فتح الملف · Open</a></div>' % (html.escape(s["ar"]), html.escape(s["en"]), html.escape(s["link"]))
        else:
            fs = sorted(f for f in os.listdir(img_dir) if f.startswith(s["key"] + "-"))
            for j, fn in enumerate(fs, 1):
                body += '<p class="c">%s · %d / %d</p><div class="pg"><img src="%s" alt="%s %d"></div>' % (html.escape(s["ar"]), j, len(fs), fn, html.escape(s["ar"]), j)
        nxt = ""
        if i < n - 1:
            nxt = '<div class="next"><small>الخطوة التالية · Next step</small><b>%d · %s</b><br><button data-go="%d">%s ←</button></div>' % (i + 2, html.escape(steps[i + 1]["ar"]), i + 1, html.escape(steps[i + 1]["ar"]))
        else:
            nxt = '<div class="next"><small>انتهت الحزمة · End of package</small><b>شكراً لثقتكم</b></div>'
        secs.append('<section id="s%d">%s%s</section>' % (i, body, nxt))
    js = """
var cur=0,N=%d,z=100,secs=document.querySelectorAll('section'),chips=document.querySelectorAll('.steps button');
function go(i){var back=i<cur;secs.forEach(function(s,k){s.classList.remove('on','back');if(k===i){s.classList.add('on');if(back)s.classList.add('back')}});
chips.forEach(function(c,k){c.classList.toggle('on',k===i);c.classList.toggle('done',k<i)});document.getElementById('bar').style.width=((i+1)/N*100)+'%%';cur=i;scrollTo({top:0,behavior:'smooth'});try{location.hash='s'+(i+1)}catch(e){}}
chips.forEach(function(c){c.onclick=function(){go(+c.dataset.i)}});
document.querySelectorAll('[data-go]').forEach(function(b){b.onclick=function(){go(+b.dataset.go)}});
function ap(){document.documentElement.style.setProperty('--w',z+'%%');document.getElementById('zv').textContent=z+'%%'}
document.getElementById('zi').onclick=function(){z=Math.min(400,z+25);ap()};document.getElementById('zo').onclick=function(){z=Math.max(50,z-25);ap()};document.getElementById('zf').onclick=function(){z=100;ap()};
document.addEventListener('click',function(e){if(e.target.tagName==='IMG'){z=z>=200?100:200;ap()}});
var h=parseInt((location.hash||'').replace('#s',''),10);go(h>=1&&h<=N?h-1:0);
""" % n
    page = ('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>%s</title><style>%s</style></head><body>'
            '<header><h1>%s</h1><div class="steps">%s</div><div class="bar"><i id="bar"></i></div><div class="z"><button id="zo" aria-label="تصغير">−</button><span id="zv">100%%</span><button id="zi" aria-label="تكبير">+</button><button id="zf">ملء العرض</button></div></header>'
            '<main>%s</main><script>%s</script></body></html>') % (html.escape(cfg["title"]), CSS, html.escape(cfg["title"]), chips, "".join(secs), js)
    open(out, "w", encoding="utf-8").write(page)

if __name__ == "__main__":
    build(sys.argv[1], json.load(open(sys.argv[2], encoding="utf-8")), sys.argv[3])
