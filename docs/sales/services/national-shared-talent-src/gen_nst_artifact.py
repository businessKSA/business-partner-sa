# -*- coding: utf-8 -*-
"""Private review Artifact in the approved presentation (owner decision 2026-10-29): title "عقد واتفاقية <service>" and three tabs
عرض السعر Quotation · العقد Agreement · عدم الإفصاح NDA, Arabic and English labels, bilingual documents only.
Writes the Artifact page to WORKDIR/artifact.html (publish it with the Artifact tool).  Usage: python3 gen_nst_artifact.py [WORKDIR]
Bank details and mobile stay [●] here too: they are added only to the final private copy by the owner's decision."""
import os, re
import gen_nst as G
import gen_nst_a4 as A
import gen_nst_docs as D
import nst_tpl as T

HERE, WORK = G.HERE, G.WORK
TITLE = 'عقد واتفاقية الكوادر الوطنية المشتركة'


def tail_css():
    return ("body{background:var(--bg);color:var(--fg)}.sheet{break-after:auto;page-break-after:auto}"
            "mark.ph{background:var(--hl);color:var(--hlfg);border-bottom:1.5px solid var(--hlbd);padding:0 2px;border-radius:2px;font-family:'IBM Plex Mono','IBM Plex Sans Arabic',monospace}"
            ".cv mark.ph{background:rgba(255,255,255,.14);color:#fff;border-bottom-color:#9DB4FF}.sb3{margin:7px 0 3px;color:#0B1B5A;font-weight:700;font-size:12px}"
            ".dnote{direction:ltr}.dnote div{font-size:10.4px;line-height:1.55}.dnote .ar{direction:rtl;text-align:right;margin-top:3px}")


def page():
    pr = G.prices()
    quote = A.build_pages(pr)
    contract = D.sections(D.contract_items(pr), 'عقد إسناد الكوادر الوطنية المشتركة', 'Shared National Talent Service Assignment Agreement',
                          D.contract_cover(), A.fonts(), D.css())
    nda = T.sheets(T.NDA)
    shell = open(os.path.join(HERE, 'artifact_shell.css'), encoding='utf8').read()
    js = open(os.path.join(HERE, 'artifact_shell.js'), encoding='utf8').read()
    css = shell + T.css(T.QUOTE) + tail_css()
    tabs = [('quote', 'عرض السعر', 'Quotation', quote), ('contract', 'العقد', 'Agreement', contract), ('nda', 'عدم الإفصاح', 'NDA', nda)]
    bar = ''.join(f'<button role="tab" id="t-{k}" data-tab="{k}" aria-controls="p-{k}"><span>{ar}</span><small>{en}</small></button>' for k, ar, en, _ in tabs)
    panels = ''.join(f'<div role="tabpanel" id="p-{k}" aria-labelledby="t-{k}"{"" if i == 0 else " hidden"}><div class="scroller">{"".join(secs)}</div></div>' for i, (k, _, _, secs) in enumerate(tabs))
    return (f'<title>{TITLE}</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n'
            '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono&family=IBM+Plex+Sans+Arabic:wght@400;700&family=Playfair+Display:wght@700&display=swap">\n'
            f'<style>\n{css}\n</style>\n<div class="wrap"><div class="bar"><h1>{TITLE}</h1><div role="tablist" aria-label="المستندات">{bar}</div></div>{panels}</div>\n<script>\n{js}\n</script>\n')


if __name__ == '__main__':
    out = os.path.join(WORK, 'artifact.html')
    html = page()
    open(out, 'w', encoding='utf8').write(html)
    print('wrote', out, round(len(html) / 1e6, 2), 'MB')
