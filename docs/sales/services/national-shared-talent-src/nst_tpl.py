# -*- coding: utf-8 -*-
"""Reads the approved Business Partner document templates (docs/sales/templates/) so that CSS, letterhead and the standard
pages come from one source. Nothing here is copied into this folder."""
import os, re, base64

HERE = os.path.dirname(os.path.abspath(__file__))
TPL = os.path.normpath(os.path.join(HERE, '..', '..', 'templates'))
QUOTE = 'REV-quote-template-bilingual.html'
CONTRACT = 'REV-contract-bilingual.html'
NDA = 'REV-nda-mutual-bilingual.html'


def read(name):
    return open(os.path.join(TPL, name), encoding='utf8').read()


def logo_uri():
    f = os.path.join(TPL, 'assets', 'business-partner-logo-clean.png')
    return 'data:image/png;base64,' + base64.b64encode(open(f, 'rb').read()).decode()


def css(name):
    c = re.search(r'<style>(.*?)</style>', read(name), re.S).group(1)
    c = re.sub(r'@page\{[^}]*\}', '', c)
    return c.replace('url(assets/business-partner-logo-clean.png)', 'url(%s)' % logo_uri())


def sheets(name):
    body = read(name)
    body = body[body.index('</style>'):]
    return re.findall(r'<section class="sheet.*?</section>', body, re.S)


def inner(sheet):
    """Section content without the section tag and without the footer."""
    i = sheet.index('>') + 1
    j = sheet.index('<div class="ft">')
    return sheet[i:j]


def clause_rows(name):
    """{english title without number: (english html, arabic html)} from the template's clause table rows."""
    rows = {}
    for e, a in re.findall(r'<tr><td class="en">(.*?)</td><td class="ar">(.*?)</td></tr>', read(name), re.S):
        m = re.match(r'<b>\d+\.\s*(.*?)</b><br>(.*)$', e, re.S)
        n = re.match(r'<b>\d+\.\s*(.*?)</b><br>(.*)$', a, re.S)
        if m and n:
            rows[m.group(1).strip()] = ((m.group(1).strip(), m.group(2)), (n.group(1).strip(), n.group(2)))
    return rows
