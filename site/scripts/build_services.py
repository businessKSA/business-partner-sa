#!/usr/bin/env python3
"""Parse the Notion catalog export into clean services.json + categories.json.
Source: BP Services Catalog - OFFICIAL (Notion). Prices/codes come straight from Notion."""
import json, re, sys, os

SRC = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('BP_CATALOG_JSON', '')
rows = json.load(open(SRC))['results']

CAT_AR = {
 "Company Formation":"تأسيس الشركات",
 "Government Relations":"العلاقات الحكومية",
 "Business Support":"دعم الأعمال",
 "HR Services":"الموارد البشرية",
 "Foreign Investment":"الاستثمار الأجنبي",
 "Recruitment":"التوظيف والاستقدام",
 "Real Estate":"العقارات",
 "Shared Services":"خدمات مشتركة",
 "Premium Residency":"الإقامة المميزة",
 "AI Automation":"الأتمتة والذكاء الاصطناعي",
 "Tourism":"السياحة",
 "GRO Services":"خدمات المعقّبين",
 "Uncategorized":"خدمات أخرى",
}
CAT_ORDER = ["Company Formation","Foreign Investment","Premium Residency","Government Relations",
 "HR Services","Recruitment","Business Support","Real Estate","Shared Services",
 "AI Automation","Tourism","GRO Services","Uncategorized"]

def num(x):
    try:
        f = float(x)
        return int(f) if f == int(f) else f
    except: return None

def fmt2(n):
    if n is None: return None
    return f"{int(n):,}" if float(n) == int(n) else f"{n:,}"

def price_display(s):
    pm = s.get('Pricing Model')
    mn = num(s.get('Minimum Price')); mo = num(s.get('Monthly Fee')); ot = num(s.get('One-Time Fee'))
    if pm == 'Custom Pricing':
        return {"label":"بعرض سعر مخصّص","amount":None}
    if pm == 'Percent':
        return {"label":"نسبة من قيمة الصفقة","amount":None}
    if pm == 'Monthly':
        base = mo or mn
        return {"label": f"{fmt2(base)} ﷼ / شهرياً" if base else "اشتراك شهري","amount":base}
    if pm == 'Starting From':
        base = mn or ot or mo
        return {"label": f"يبدأ من {fmt2(base)} ﷼" if base else "بعرض سعر مخصّص","amount":base}
    if pm == 'Per Candidate':
        base = ot or mn
        return {"label": f"{fmt2(base)} ﷼ / لكل مرشّح" if base else "لكل مرشّح","amount":base}
    base = ot or mn
    return {"label": f"{fmt2(base)} ﷼" if base else "بعرض سعر مخصّص","amount":base}

# Some Notion Description fields hold internal import notes (English meta), not
# customer-facing copy. Detect those + English-only + empty, and replace with a
# clean, on-brand Arabic fallback that states the BP service model (no invented facts).
JUNK = re.compile(r'Source category|Imported from|Price Ex VAT|Price shown as|source table|'
                  r'Main Service:|Sub Service:|Price List Master|Legacy|VAT was blank|CSV Import', re.I)
HAS_AR = re.compile('[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]')

def clean_desc(desc, name, cat_ar):
    d = (desc or '').strip()
    if not d or JUNK.search(d) or not HAS_AR.search(d):
        return (f'نتولّى في Business Partner تنفيذ «{name}» نيابةً عنك ضمن خدمات {cat_ar} — '
                f'من تجهيز المستندات والرفع على الجهة المختصة حتى الإصدار، بأتعاب واضحة ومتابعة كاملة.')
    return d

# Package tiers (shown on /packages) and internal placeholders are not individual
# catalog service pages.
EXCLUDE = {"BP-PRICE-LIST-MASTER", "BP-PKG-01", "BP-PKG-02", "BP-PKG-03", "BP-PKG-04"}

out = []
for s in rows:
    code = s['Service Code'].strip()
    if code in EXCLUDE:
        continue
    cat = s.get('Service Category') or 'Uncategorized'
    cat_ar = CAT_AR.get(cat, cat)
    name = (s.get('Service Name') or '').strip()
    deliv = (s.get('Deliverables') or '').strip()
    deliv_list = [d.strip(" .·") for d in re.split(r'[;\n]|•|·', deliv) if d.strip(" .·")]
    out.append({
      "code": code, "slug": code.lower(),
      "name": name,
      "category": cat, "categoryAr": cat_ar,
      "govPlatform": (s.get('Gov Platform') or '').strip(),
      "description": clean_desc(s.get('Description'), name, cat_ar),
      "deliverables": deliv_list,
      "targetClient": (s.get('Target Client') or '').strip(),
      "pricingModel": s.get('Pricing Model'),
      "govFeesSeparate": s.get('Gov Fees Separate') == '__YES__',
      "requiresProposal": s.get('Requires Proposal') == '__YES__',
      "price": price_display(s),
    })

out.sort(key=lambda x: (CAT_ORDER.index(x['category']) if x['category'] in CAT_ORDER else 99, x['code']))
base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
json.dump(out, open(os.path.join(base, 'data/services.json'), 'w'), ensure_ascii=False, indent=1)
seen = {}
for x in out: seen[x['category']] = seen.get(x['category'], 0) + 1
cats = [{"key": c, "ar": CAT_AR[c], "count": seen[c]} for c in CAT_ORDER if c in seen]
json.dump(cats, open(os.path.join(base, 'data/categories.json'), 'w'), ensure_ascii=False, indent=1)
print(f'wrote {len(out)} services; {len(cats)} categories')
