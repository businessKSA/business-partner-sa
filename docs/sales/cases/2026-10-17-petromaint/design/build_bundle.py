#!/usr/bin/env python3
"""يجمع عرض السعر والعقد وعدم الإفصاح في صفحة واحدة بثلاثة تبويبات (نموذج EIC): عنوان «عقد واتفاقية <العميل>»،
عرض السعر Quotation · العقد Agreement · عدم الإفصاح NDA. ثنائي اللغة فقط. يشغَّل بعد build_quote.py وbuild_contract.py."""
import os, re
D = os.path.dirname(os.path.abspath(__file__))
HEAD = open(os.path.join(D, '_standard-head.html'), encoding='utf-8').read().replace('LOGOB64', open(os.path.join(D, '_logo.b64')).read().strip())
CLIENT = 'شركة اسكندرية للصيانة البترولية (بترومنت)'
TABS = [('quote', 'عرض السعر', 'Quotation', 'BP_Quotation_Petromaint_v2.html'), ('contract', 'العقد', 'Agreement', 'BP_Contract_Petromaint_v2.html'), ('nda', 'عدم الإفصاح', 'NDA', 'BP_NDA_Petromaint_v1.html')]
body = lambda f: re.search(r'<body>(.*)</body>', open(os.path.join(D, f), encoding='utf-8').read(), re.S).group(1)
tabs = ''.join(f'<button role="tab" id="t-{k}" data-tab="{k}" aria-controls="p-{k}"><span>{ar}</span><small>{en}</small></button>' for k, ar, en, _ in TABS)
panels = ''.join(f'<div role="tabpanel" id="p-{k}" aria-labelledby="t-{k}" hidden><div class="scroller">{body(f)}</div></div>' for k, _, _, f in TABS)
js = '''<script>(function(){var keys=["quote","contract","nda"];
document.querySelectorAll(".sheet").forEach(function(s){var b=document.createElement("div");b.className="fit";b.style.direction="ltr";s.parentNode.insertBefore(b,s);b.appendChild(s);s.style.margin="0";s.style.boxShadow="none"});
function fit(){document.querySelectorAll(".fit").forEach(function(b){var s=b.firstElementChild,land=s.classList.contains("land"),w=land?1123:794,h=land?794:1123,a=b.parentNode.clientWidth;if(!a)return;var k=Math.min(1.5,a/w);s.style.transform="scale("+k+")";s.style.transformOrigin="top left";b.style.width=Math.round(w*k)+"px";b.style.height=Math.round(h*k)+"px"})}
function show(k){if(keys.indexOf(k)<0)k="quote";keys.forEach(function(x){document.getElementById("p-"+x).hidden=x!==k;document.getElementById("t-"+x).setAttribute("aria-selected",x===k)});fit()}
document.querySelectorAll("[role=tab]").forEach(function(b){b.addEventListener("click",function(){location.hash=b.dataset.tab})});
window.addEventListener("hashchange",function(){show(location.hash.slice(1))});window.addEventListener("resize",fit);show(location.hash.slice(1))})();</script>'''
doc = (f'<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>عقد واتفاقية {CLIENT}</title>{HEAD}'
       '<style>.sheet{margin:0!important}@page{size:A4;margin:0}</style></head><body><div class="wrap"><div class="bar">'
       f'<h1>عقد واتفاقية {CLIENT}</h1><div role="tablist" aria-label="المستندات">{tabs}</div></div>{panels}</div>{js}</body></html>')
out = os.path.join(D, 'BP_Petromaint_Quote_Agreement_NDA.html')
open(out, 'w', encoding='utf-8').write(doc); print('wrote', out)
