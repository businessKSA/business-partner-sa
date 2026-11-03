#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""مولّد مكتبة مستندات المبيعات (Business Partner) — بايثون قياسي فقط.

مصدر الحقيقة للخدمات: site/assets/data/catalog.json (مفتاح services، 200 خدمة في 9 فئات).
مجموعة قوالب واحدة لكل فئة (categories/<slug>/) + قالب عدم إفصاح مشترك (shared/) ثم تُملأ
بيانات كل خدمة بالرمز (SKU). لا يُكتب أي اسم عميل ولا آيبان ولا هاتف ولا هوية.

الأوامر:
  python3 generate.py templates              # يعيد بناء القوالب (HTML) وملفات README للفئات
  python3 generate.py index                  # services-index.csv و services-index.md لكل الـ200
  python3 generate.py build --sku BP-X-01    # مستندات خدمة واحدة  (--out DIR  --discount 10|20|30  --pdf)
  python3 generate.py build --category "HR Services" | --all
  python3 generate.py samples                # out-samples/: 3 خدمات لكل فئة
  python3 generate.py verify                 # فحوص التغطية والمحظورات
  python3 generate.py check-fit              # اتساع الصفحات (يتطلب weasyprint)
  python3 generate.py all                    # templates + index + samples + verify

المخرجات HTML (نسخة مفتوحة داخلية). PDF فقط للعميل: --pdf يستعمل WeasyPrint أو Chrome إن وُجدا.
"""
import argparse
import csv
import html
import json
import math
import re
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import clauses as K  # noqa: E402

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
CATALOG = REPO / "site/assets/data/catalog.json"
LEGAL_DIR = HERE.parent / "templates/categories"
LEGAL_CORE = LEGAL_DIR / "contract-core-and-category-clauses-FOR-LEGAL-REVIEW.md"
LEGAL_AUTH = LEGAL_DIR / "authorization-letter-template-DRAFT.md"
LEDGER = HERE.parent / "pricing-ledger.md"

RLM = "‏"
VAT_RATE = 0.15
LADDER = (0, 10, 20, 30)

# ---------------------------------------------------------------- هوية الأطراف (من brand-and-presentation-standard §3 و§6)
CO_EN, CO_AR = "Business Partner Solutions", "شركة بزنس بارتنر سلوشنز"
CO_UNIFIED, CO_VAT = "7038825860", "312079341500003"
CEO_EN, CEO_AR = "Baher Bakr Ali Magnas", "باهر بكر علي مقنص"
CEO_TITLE_EN, CEO_TITLE_AR = "Chief Executive Officer", "المدير التنفيذي"
BADR_EN, BADR_AR = "Badr", "بدر"
BADR_TITLE_EN, BADR_TITLE_AR = "Sales & Business Development Manager", "مدير المبيعات وتطوير الأعمال"

# خدمات منتجات تقنية خارج فئة الأتمتة والذكاء الاصطناعي تأخذ POC. فارغة عمداً (انظر README: قرار المالك في REV-*).
TECH_EXTRA = set()
# خدمات يُراجَع فيها ما إن كانت منتجاً تقنياً (لا POC افتراضياً):
TECH_REVIEW = {"REV-LAUNCH", "REV-START", "REV-GROWTH", "REV-PRO", "REV-TEAM", "REV-ENT"}
# تفويض: استثناءات يدوية للتحقق (الكتالوج لا يسجّل منصة لها)
_BESPOKE = "خدمة مخصصة حكومية بطبيعتها: تُسمّى الجهة في عرض السعر"
AUTH_OVERRIDE = {
    "GOV-GEN": (True, _BESPOKE), "GR-GEN": (True, _BESPOKE), "CF-GEN": (True, _BESPOKE), "PR-GEN": (True, _BESPOKE),
    "QW-EST": (True, "منصة «قوى» حكومية والكتالوج لا يسجّلها في حقل الجهة"),
    "FI-100": (True, "ترخيص استثمار أجنبي: الجهة غير مسجّلة في الكتالوج؛ تحقق"),
    "BP-PL-0035": (True, "منصة «مقيم» حكومية والكتالوج لا يسجّلها: تحقق"),
    "BP-PL-0050": (True, "معاملات حكومية بلا منصة مسجّلة في الكتالوج: تحقق"),
    "BP-PL-0054": (False, "التمثيل القانوني بوكالة مصدّقة مستقلة (قانونية)، لا بخطاب تفويض"),
    "BP-PL-0051": (False, "بنك لا جهة حكومية؛ فتح/تغيير الحساب مستثنى من خطاب التفويض"),
}
VIOLATION_RE = re.compile(r"violation|objection|grievance|\bfines?\b|penalt|مخالف|اعتراض|غرام|تظلم", re.I)

DOCS = ("quote", "contract", "nda", "terms", "poc", "authorization")
DOC_FILE = {"quote": "quote.html", "contract": "contract.html", "nda": "nda.html",
            "terms": "terms.html", "poc": "poc.html", "authorization": "authorization.html"}


# ================================================================ الكتالوج والخدمة
def load_services():
    data = json.loads(CATALOG.read_text(encoding="utf8"))
    return data["services"]


def has_price(s):
    return bool(s.get("amount"))


def gov_involved(s):
    """يطبّق خطاب التفويض فقط حيث توجد منصة أو إجراء جهة حكومية."""
    if s["code"] in AUTH_OVERRIDE:
        return AUTH_OVERRIDE[s["code"]][0]
    return (s.get("govPlatform") or "") not in K.NO_PLATFORM or bool(s.get("govFeesSeparate"))


def is_violation(s):
    return bool(VIOLATION_RE.search(s["nameEn"] + " " + s["nameAr"]))


def is_tech(s):
    return s["category"] == "AI Automation" or s["code"] in TECH_EXTRA


def dedicated(s):
    """باقات تطوير الأعمال REV-* لها قالب عرض وعقد مخصص في docs/sales/templates/REV-*؛ لا يُولَّد لها العام."""
    return s["code"].startswith("REV-")


def applicable(s):
    d = {"quote": not dedicated(s), "contract": not dedicated(s), "nda": True, "terms": True,
         "poc": is_tech(s), "authorization": gov_involved(s) and s["category"] != "AI Automation"}
    return d


def money(v):
    s = f"{v:,.2f}"
    return s[:-3] if s.endswith(".00") else s


def esc(t):
    return html.escape(str(t), quote=False)


def num(t):
    return f'<span class="num">{esc(t)}</span>'


def svc_vars(s, discount=0):
    if discount not in LADDER:
        raise SystemExit(f"الخصم خارج السلّم المعتمد 10/20/30: {discount}")
    amt = s.get("amount") or 0
    model = s.get("pricingModel") or "One Time"
    m_en, m_ar = K.MODEL.get(model, K.MODEL["One Time"])
    if amt:
        net = amt * (100 - discount) / 100
        vat = round(net * VAT_RATE, 2)
        v_net, v_vat, v_tot = num(money(net)), num(money(vat)), num(money(net + vat))
    else:
        v_net = v_vat = v_tot = num("[●]")
    disc = ""
    if discount and amt:
        disc = ('<tr><td colspan="5" class="en">Catalogue price SAR %s; discount %d%% applied (approved ladder).</td>'
                '<td class="gp"></td><td colspan="5" class="ar">سعر الكتالوج %s ريال؛ طُبّق خصم %d%% (ضمن السلّم المعتمد).%s</td></tr>'
                % (money(amt), discount, money(amt), discount, RLM))
    plat = s.get("govPlatform") or ""
    if plat in K.NO_PLATFORM:
        p_en = p_ar = "—"
    else:
        p_en, p_ar = K.PLATFORM_EN.get(plat, plat), plat
    if s.get("govFeesSeparate"):
        g_en = "Not included in the price; paid separately by the Client at actual cost."
        g_ar = "غير مشمولة في السعر؛ يسددها العميل على حدة بالتكلفة الفعلية."
    else:
        g_en = "None is stated in this quotation; any fee an entity charges is separate and paid by the Client."
        g_ar = "لا رسم حكومي مذكور في هذا العرض؛ وأي رسم تفرضه جهة منفصل ويسدده العميل."
    if s.get("requiresProposal"):
        pr_en = "Required: the scope is confirmed in a detailed proposal before execution."
        pr_ar = "مطلوب: يُؤكَّد النطاق في عرض مفصّل قبل التنفيذ."
    else:
        pr_en, pr_ar = "Not required.", "غير مطلوب."
    pay_en, pay_ar = K.PAYMENT.get(model, K.PAYMENT["One Time"])
    return {
        "sku": esc(s["code"]), "name_en": esc(s["nameEn"]), "name_ar": esc(s["nameAr"]),
        "model_en": esc(m_en), "model_ar": esc(m_ar),
        "price_net": v_net, "price_vat": v_vat, "price_total": v_tot, "disc_rows_html": disc,
        "gov_fee_en": esc(g_en), "gov_fee_ar": esc(g_ar) + RLM,
        "platform_en": esc(p_en), "platform_ar": esc(p_ar),
        "proposal_en": esc(pr_en), "proposal_ar": esc(pr_ar) + RLM,
        "pay_en": esc(pay_en), "pay_ar": esc(pay_ar) + RLM,
    }


# ================================================================ قراءة النصوص القانونية
def clean(t):
    t = t.replace("[recommended maximum 12]", "(maximum 12)").replace("[الحد الأقصى المقترح 12]", "(بحد أقصى 12)")
    t = t.replace("[names and job titles only]", "[●] (names and job titles only)")
    t = t.replace("[الأسماء والمسميات الوظيفية فقط]", "[●] (الأسماء والمسميات الوظيفية فقط)")
    t = re.sub(r"\s*\[تحقق[^\]]*\]", "", t)
    t = t.replace("IBAN [●]", "IBAN [IBAN]").replace("آيبان [●]", "آيبان [IBAN]")
    return t.strip()


def parse_clauses(block):
    """### [N.] English title / عنوان عربي  +  - EN: ... - AR: ..."""
    out = []
    for m in re.finditer(r"^###\s+(?:(\d+)\.\s*)?(.*?)\s*/\s*(.*?)\s*\n(.*?)(?=^###|^##|\Z)", block, re.S | re.M):
        body = m.group(4)
        en = re.search(r"^- EN:\s*(.*)$", body, re.M)
        ar = re.search(r"^- AR:\s*(.*)$", body, re.M)
        if not (en and ar):
            continue
        out.append({"n": int(m.group(1)) if m.group(1) else None, "t_en": m.group(2).strip(),
                    "t_ar": m.group(3).strip(), "en": clean(en.group(1)), "ar": clean(ar.group(1))})
    return out


_LEGAL = {}


def legal_core():
    if _LEGAL.get("core"):
        return _LEGAL["core"]
    text = LEGAL_CORE.read_text(encoding="utf8")
    parts = re.split(r"^## ", text, flags=re.M)
    nda, core, cats = None, None, {}
    keymap = {"Company Formation": "Company Formation", "Foreign Investment": "Foreign Investment",
              "Premium Residency": "Premium Residency", "Government Relations": "Government Relations",
              "HR Services": "HR Services", "Recruitment": "Recruitment", "Offices": "Real Estate",
              "AI &": "AI Automation"}
    for p in parts[1:]:
        title = p.split("\n", 1)[0]
        cl = parse_clauses(p)
        if "عدم الإفصاح" in title:
            nda = cl
        elif "نواة العقد" in title:
            core = cl
        elif "بنود خاصة بفئة" in title:
            en_name = title.split("/")[-1].strip()
            for frag, key in keymap.items():
                if frag in en_name:
                    cats[key] = cl
    assert nda and core and len(core) == 17, "تعذّر تحليل نواة العقد"
    _LEGAL["core"] = (nda, core, cats)
    return _LEGAL["core"]


def legal_auth():
    if _LEGAL.get("auth"):
        return _LEGAL["auth"]
    text = LEGAL_AUTH.read_text(encoding="utf8")
    part1 = text.split("## الجزء الأول")[1].split("## الجزء الثاني")[0]
    cl = [c for c in parse_clauses(part1) if c["n"] and 2 <= c["n"] <= 12]
    assert len(cl) == 11, "تعذّر تحليل خطاب التفويض"
    _LEGAL["auth"] = cl
    return cl


# ================================================================ مكونات HTML
def arx(t):
    t = esc(t)
    return t + RLM if t.rstrip().endswith(".") else t


def en_t(t):
    return esc(t)


def row(n, t_en, x_en, t_ar, x_ar, alt=False):
    """بند: إنجليزي يسار وعربي يمين، بالرقم نفسه."""
    nn = f"{n}. " if n else ""
    return (f'<table class="cl{" alt" if alt else ""}"><tr><td class="en"><b>{nn}{en_t(t_en)}</b><br>{x_en}</td>'
            f'<td class="ar"><b>{nn}{esc(t_ar)}</b><br>{x_ar}</td></tr></table>')


def bullet(n, en, ar, alt=False):
    return (f'<table class="cl{" alt" if alt else ""}"><tr><td class="en"><span class="nb">{n}</span>{esc(en)}</td>'
            f'<td class="ar"><span class="nb">{n}</span>{arx(ar)}</td></tr></table>')


def kv(label_en, label_ar, v_en, v_ar, alt=False):
    return (f'<table class="cl{" alt" if alt else ""}"><tr><td class="en"><b>{esc(label_en)}:</b> {v_en}</td>'
            f'<td class="ar"><b>{esc(label_ar)}:</b> {v_ar}</td></tr></table>')


def plain_len(t):
    return len(re.sub(r"<[^>]+>|\{\{\w+\}\}", "", t)) + (28 if "{{" in t else 0)


def est_row(x_en, x_ar, cpl, lh, title=True, pad=12):
    lines = max(math.ceil(max(plain_len(x_en), 1) / cpl), math.ceil(max(plain_len(x_ar), 1) / cpl))
    return (lines + (1 if title else 0)) * lh + pad


def blk(html_, h, keep=False):
    return {"html": html_, "h": h, "keep": keep}


def paginate(blocks, budget):
    pages, cur, used, i = [], [], 0, 0
    units = []
    while i < len(blocks):
        unit = [blocks[i]]
        while unit[-1]["keep"] and i + 1 < len(blocks):
            i += 1
            unit.append(blocks[i])
        units.append(unit)
        i += 1
    for u in units:
        h = sum(b["h"] for b in u)
        if cur and used + h > budget:
            pages.append(cur)
            cur, used = [], 0
        cur.extend(u)
        used += h
    if cur:
        pages.append(cur)
    return pages


def footer(n, total):
    return ('<div class="ft"><div class="a">National Address / العنوان الوطني: [●]</div>'
            '<div class="c">[●]<br>business@businesspartner.sa<br>www.businesspartner.sa<br>'
            f'<span class="m">{n} / {total}</span></div>'
            '<div class="w"><span class="logo" role="img" aria-label="Business Partner"></span></div></div>')


def logo():
    return '<span class="logo" role="img" aria-label="Business Partner"></span>'


def hd_port(t_ar, t_en):
    return (f'<div class="hd" dir="ltr">{logo()}<div dir="rtl" style="flex:1;text-align:right"><h1 class="sm">{t_ar}</h1>'
            f'<div class="sub" dir="ltr" style="font-family:\'Playfair Display\',serif;font-size:13px;text-align:right">{t_en}</div></div></div>')


def hd_land(t_ar, t_en):
    return (f'<div class="hd2">{logo()}<div class="t e"><h1>{t_en}</h1></div><div class="t a"><h1>{t_ar}</h1></div></div>')


def sheet(kind, inner, n, total, head):
    return (f'<section class="sheet {kind}" lang="ar"><div dir="rtl">{head}{inner}</div>{footer(n, total)}</section>')


def pre_h(n, en, ar):
    return f'<div class="pre"><b>{n}. {esc(en)} / {esc(ar)}</b></div>'


def party_table(role_en, role_ar, rows):
    h = f'<table class="pty2"><tr><th colspan="3"><span>{role_en}</span><span dir="rtl">{role_ar}</span></th></tr>'
    for en, val, ar in rows:
        h += f'<tr><td>{en}</td><td class="v">{val}</td><td>{ar}</td></tr>'
    return h + "</table>"


def co_party(role_en, role_ar, signatory=True):
    rows = [("Name", f"{CO_EN}<br><span dir=\"rtl\">{CO_AR}</span>", "الاسم"),
            ("Unified / CR No.", num(CO_UNIFIED), "الرقم الموحد / السجل التجاري"),
            ("VAT No.", num(CO_VAT), "الرقم الضريبي"),
            ("National Address", num("[●]"), "العنوان الوطني")]
    if signatory:
        rows += [("Represented by", f"{CEO_EN}<br><span dir=\"rtl\">{CEO_AR}</span>", "يمثلها"),
                 ("Title", f"{CEO_TITLE_EN}<br><span dir=\"rtl\">{CEO_TITLE_AR}</span>", "الصفة")]
    return party_table(role_en, role_ar, rows)


def client_party(role_en, role_ar):
    rows = [("Name", num("[●]"), "الاسم"), ("Unified / CR No.", num("[●]"), "الرقم الموحد / السجل التجاري"),
            ("VAT No.", num("[●]"), "الرقم الضريبي"), ("National Address", num("[●]"), "العنوان الوطني"),
            ("Represented by", num("[●]"), "يمثلها"), ("Title", num("[●]"), "الصفة")]
    return party_table(role_en, role_ar, rows)


def sig_box(t_en, t_ar, name_val, title_val, h=92):
    def f2(a, v, b):
        return f'<div class="f2"><span>{a}</span><span class="v">{v}</span><span dir="rtl">{b}</span></div>'
    return (f'<div><h3><span>{t_en}</span><span dir="rtl">{t_ar}</span></h3>{f2("Name", name_val, "الاسم")}'
            f'{f2("Title", title_val, "الصفة")}{f2("Date", "[●]", "التاريخ")}'
            f'<div class="bx2"><div style="text-align:center;height:{h}px">Signature &amp; Stamp · التوقيع والختم</div></div></div>')


def sig_pair(left, right, one=False):
    return f'<div class="sg{" one" if one else ""}" style="direction:ltr">{left}{right}</div>'


CEO_NAME = f"{CEO_EN}<br><span dir=\"rtl\">{CEO_AR}</span>"
CEO_TITLE = f"{CEO_TITLE_EN}<br><span dir=\"rtl\">{CEO_TITLE_AR}</span>"
BADR_NAME = f"{BADR_EN} · <span dir=\"rtl\">{BADR_AR}</span>"
BADR_TITLE = f"{BADR_TITLE_EN}<br><span dir=\"rtl\">{BADR_TITLE_AR}</span>"
CLIENT_BLANK = "[●]"


def sig_h(inner_h=None):
    return 250


def cover_port(eb_en, eb_ar, h_en, h_ar, sub_en, sub_ar, strip):
    ch = "".join(f"<div><span>{a}</span>{b}</div>" for a, b in strip)
    return (f'<div dir="ltr"><div class="cv"><div class="lgc">{logo()}</div><div class="cvb"><div dir="ltr">'
            f'<div class="eb">{eb_en}</div><h1 class="pf">{h_en}</h1><div class="sb">{sub_en}</div></div>'
            f'<div dir="rtl"><div class="eb" style="letter-spacing:0;font-family:inherit;font-size:13px">{eb_ar}</div>'
            f'<h1>{h_ar}</h1><div class="sb">{sub_ar}</div></div></div><div class="ch">{ch}</div></div></div>')


def closing_port():
    def kvl(a, v, b):
        return f'<div class="kv"><span>{a}</span><span class="kvv">{v}</span><span dir="rtl">{b}</span></div>'
    return ('<div dir="ltr"><div class="cv"><div class="lgc">' + logo() + '</div><div class="eb">PARTNERING FOR YOUR SUCCESS</div>'
            f'<h1 class="pf" style="font-size:34px">{CO_EN}</h1><div class="sb" style="direction:rtl;text-align:right;margin-top:6px">بزنس بارتنر سلوشنز</div>'
            '<div class="bx" style="flex-direction:column;gap:22px"><div><b>Company · المنشأة</b>'
            + kvl("Unified No.", num(CO_UNIFIED), "الرقم الموحد") + kvl("VAT No.", num(CO_VAT), "الرقم الضريبي")
            + kvl("National Address", num("[●]"), "العنوان الوطني")
            + '</div><div><b>Contact · التواصل</b>'
            + kvl("Mobile", num("[●]"), "الجوال") + kvl("Email", num("business@businesspartner.sa"), "الإيميل")
            + kvl("Website", num("www.businesspartner.sa"), "الموقع") + '</div></div></div></div>')


# ================================================================ CSS
EXTRA_CSS = """
.cl{margin:0}.cl.alt td{background:#F7F8FD}.cl td{border:1px solid #DDE1EE;padding:5px 9px}
.cl .nb{color:#1E3A9E;font-family:'IBM Plex Mono',monospace;margin-inline-end:6px;font-weight:700}
.bp .cl{font-size:10.4px}.bp{margin-top:8px}
.sg.one>div{flex:0 0 calc(50% - 9px)}
.pt .ar,.pt td.ar{direction:rtl;text-align:right}
.hdr2{margin:8px 0 2px;color:#0B1B5A;font-size:13px}
"""


def css(kind):
    base = (HERE / "assets/base.css").read_text(encoding="utf8")
    base = re.sub(r"@page\{[^}]*\}", "", base)
    page = "A4 landscape" if kind == "land" else "A4 portrait"
    return base + EXTRA_CSS + f"@page{{size:{page};margin:0}}\n"


def document(title, kind, sections):
    return ('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>{title}</title>'
            '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono&family=IBM+Plex+Sans+Arabic:wght@400;700&family=Playfair+Display:wght@700&display=swap">'
            f'<style>{css(kind)}</style></head><body>' + "".join(sections) + "</body></html>")


# ================================================================ الفئة: مصدر البيانات
def cat_texts(cat):
    c = K.CATS[cat]
    excl = list(c["excl"]) + K.COMMON_EXCL
    return c, excl


def subject_clause(cat):
    nda, core, cats = legal_core()
    if cat in cats:
        for c in cats[cat]:
            if c["t_en"].startswith("Subject"):
                return c
    return core[0]  # Subject / موضوع العقد من نواة العقد (دعم الأعمال)


def special_clauses(cat):
    nda, core, cats = legal_core()
    return [c for c in cats.get(cat, []) if not c["t_en"].startswith("Subject")]


# ================================================================ عرض السعر (A4 أفقي)
LAND_BUDGET = 500
LAND_CPL = 84
LAND_LH = 16


def build_quote(cat):
    c, excl = cat_texts(cat)
    tl = K.TIMELINE_AI if cat == "AI Automation" else K.TIMELINE
    blocks = []

    def sec(n, en, ar):
        blocks.append(blk(f'<div class="rw"><div class="col" dir="ltr"><h2><span class="n">{n}</span>{esc(en)}</h2></div>'
                          f'<div class="col" dir="rtl"><h2><span class="n">{n}</span>{esc(ar)}</h2></div></div>', 34, keep=True))

    def items(lst, tag=None):
        for i, (en, ar) in enumerate(lst, 1):
            h_ = bullet(i, en, ar, alt=i % 2 == 0)
            if tag:
                h_ = f"<!--{tag}{i}-->{h_}<!--/{tag}{i}-->"
            blocks.append(blk(h_, est_row(en, ar, LAND_CPL, LAND_LH, title=False), keep=(i == 1)))

    # 1 السعر
    pt = ('<table class="pt"><colgroup><col style="width:21%"><col style="width:9%"><col style="width:9%"><col style="width:8%">'
          '<col style="width:7%"><col style="width:2%"><col style="width:7%"><col style="width:8%"><col style="width:9%"><col style="width:9%"><col style="width:21%"></colgroup>'
          '<tr><th class="en">Service</th><th class="c en">Pricing</th><th class="c en">Price excl. VAT (SAR)</th><th class="c en">VAT 15%</th><th class="c en">Total (SAR)</th>'
          '<td class="gp"></td>'
          '<th class="c ar">الإجمالي (ريال)</th><th class="c ar">ضريبة 15%</th><th class="c ar">السعر قبل الضريبة (ريال)</th><th class="c ar">التسعير</th><th class="ar">الخدمة</th></tr>'
          '<tr><td class="en"><span class="num">{{sku}}</span><br>{{name_en}}</td><td class="c en">{{model_en}}</td><td class="c en">{{price_net}}</td><td class="c en">{{price_vat}}</td><td class="c en">{{price_total}}</td>'
          '<td class="gp"></td>'
          '<td class="c ar">{{price_total}}</td><td class="c ar">{{price_vat}}</td><td class="c ar">{{price_net}}</td><td class="c ar">{{model_ar}}</td><td class="ar"><span class="num">{{sku}}</span><br>{{name_ar}}</td></tr>'
          '{{disc_rows_html}}'
          '<tr><td class="en" colspan="5">Prices come from the service catalogue by service code. Where the price shows [●], it is confirmed by the First Party before issue.</td><td class="gp"></td>'
          '<td class="ar" colspan="5">الأسعار من كتالوج الخدمات برمز الخدمة. وحيث يظهر [●] فيُؤكَّد السعر من الطرف الأول قبل الإصدار.' + RLM + '</td></tr></table>')
    blocks.append(blk('<div class="rw mt"><div class="col" dir="ltr"><div class="meta1"><b>To:</b> <span class="num">[●]</span></div>'
                      '<div class="meta1"><b>Date:</b> <span class="num">[●]</span></div><div class="meta1"><b>Validity:</b> 14 days</div></div>'
                      '<div class="col" dir="rtl"><div class="meta1"><b>إلى السادة:</b> <span class="num">[●]</span></div>'
                      '<div class="meta1"><b>التاريخ:</b> <span class="num">[●]</span></div><div class="meta1"><b>الصلاحية:</b> 14 يوماً</div></div></div>', 34))
    sec(1, "Price", "السعر")
    blocks.append(blk(pt, 150))
    kvs = [("Government fees", "الرسوم الحكومية", "{{gov_fee_en}}", "{{gov_fee_ar}}"),
           ("Government entity / platform", "الجهة / المنصة الحكومية", "{{platform_en}}", "{{platform_ar}}"),
           ("Detailed proposal", "العرض المفصّل", "{{proposal_en}}", "{{proposal_ar}}"),
           ("Data hosting & processing location (transfer outside the Kingdom)", "موقع استضافة البيانات ومعالجتها (والنقل خارج المملكة)", "[●]", "[●]")]
    for i, (a, b, ve, va) in enumerate(kvs):
        blocks.append(blk(kv(a, b, ve, va, alt=i % 2 == 1), 40 if i != 3 else 40))
    sec(2, "Scope of work", "نطاق العمل")
    items(c["scope"], tag="S")  # كل بند نطاق قابل للاستبدال لخدمات المخالفات
    sec(3, "Required from the Client", "المطلوب من العميل")
    items(c["needs"])
    sec(4, "Not included in the price", "ما لا يشمله السعر")
    items(excl)
    sec(5, "Duration", "المدة")
    items([tl])
    sec(6, "Payment", "طريقة الدفع")
    items([("{{pay_en}}", "{{pay_ar}}")])
    sec(7, "Terms", "الشروط")
    items([("The Terms & Conditions for this category apply; a signed service agreement prevails over them.",
            "تسري الشروط والأحكام لهذه الفئة، وعقد الخدمة الموقّع يسبقها."),
           ("Cancellation and refund are as stated in the service agreement: [●].",
            "الإلغاء والاسترداد كما في عقد الخدمة: [●]."),
           ("No guarantee of outcome where the result depends on the decision of a third party or an entity.",
            "لا ضمان لنتيجة معيّنة حيث تعتمد النتيجة على قرار طرف ثالث أو جهة."),
           ("Confidentiality is under the Non-Disclosure Agreement; governed by the laws of the Kingdom of Saudi Arabia.",
            "السرية وفق اتفاقية عدم الإفصاح؛ ويخضع العرض لأنظمة المملكة العربية السعودية.")])
    sec(8, "Acceptance", "القبول")
    blocks.append(blk(sig_pair(sig_box("Business Partner Solutions", "بزنس بارتنر سلوشنز", BADR_NAME, BADR_TITLE, 60),
                               sig_box("Client", "العميل", CLIENT_BLANK, CLIENT_BLANK, 60)), 210))
    pages = paginate(blocks, LAND_BUDGET)
    total = len(pages) + 2
    head = hd_land("عرض سعر · {{sku}}", "Quotation · {{sku}}")
    secs = [sheet("land", cover_land(c), 1, total, "")]
    for i, p in enumerate(pages, 2):
        secs.append(sheet("land", '<div class="bp">' + "".join(b["html"] for b in p) + "</div>", i, total, head))
    secs.append(sheet("land", closing_land(), total, total, ""))
    return document("عرض سعر · Quotation · {{sku}}", "land", secs)


def cover_land(c):
    strip = [("To / إلى السادة", num("[●]")), ("Date / التاريخ", num("[●]")),
             ("Validity / صلاحية العرض", "14 days<br>14 يوماً"),
             ("Issued by / صادر عن", f"{BADR_EN} · {BADR_AR}")]
    ch = "".join(f"<div><span>{a}</span>{b}</div>" for a, b in strip)
    return ('<div class="cv lt"><div class="lgband">' + '<span class="logo big" role="img" aria-label="Business Partner"></span></div>'
            '<div class="cvb"><div dir="ltr"><div class="eb">QUOTATION</div><h1 class="pf">{{name_en}}</h1>'
            f'<div class="sb">{esc(c["en"])} · <span class="num" style="color:#EEF1FB">{{{{sku}}}}</span></div></div>'
            '<div dir="rtl"><div class="eb" style="letter-spacing:0;font-family:inherit;font-size:13px">عرض سعر</div><h1>{{name_ar}}</h1>'
            f'<div class="sb">{esc(c["ar"])} · <span class="num" style="color:#EEF1FB">{{{{sku}}}}</span></div></div></div>'
            f'<div class="ch">{ch}</div></div>')


def closing_land():
    return ('<div class="cv"><div class="lgc">' + logo() + '</div><div class="eb">CONTACT &amp; BANK TRANSFER · التواصل والتحويل البنكي</div>'
            '<h1 class="pf">Thank you for your trust · <span style="font-family:\'IBM Plex Sans Arabic\'">شكراً لثقتكم</span></h1>'
            '<div class="bx"><div><b>Contact · التواصل</b>National address / العنوان الوطني: <span class="num">[●]</span><br>'
            'Mobile / الجوال: <span class="num">[●]</span><br>Email / الإيميل: <span class="num">business@businesspartner.sa</span><br>'
            'Website / الموقع: <span class="num">www.businesspartner.sa</span></div>'
            '<div><b>Bank transfer · التحويل البنكي</b>Beneficiary / المستفيد: ' + CO_EN + ' / بزنس بارتنر سلوشنز<br>'
            'Bank / البنك: [●]<br>IBAN: <span class="num">[IBAN]</span></div></div></div>')


# ================================================================ مستندات عمودية: محرّك مشترك
PORT_BUDGET = 820
PORT_CPL = 54
PORT_LH = 16.5


def clause_blocks(items, start=1):
    """items: [(t_en, t_ar, x_en_html, x_ar_html)] → كتل مرقّمة تلقائياً."""
    out = []
    for i, (t_en, t_ar, x_en, x_ar) in enumerate(items, start):
        out.append(blk(row(i, t_en, x_en, t_ar, x_ar, alt=i % 2 == 0), est_row(x_en, x_ar, PORT_CPL, PORT_LH)))
    return out


def lc(c):
    """بند قانوني محلَّل → (t_en,t_ar,x_en,x_ar) مع الهروب."""
    return (c["t_en"], c["t_ar"], esc(c["en"]), arx(c["ar"]))


def port_doc(title_ar, title_en, blocks_pages_first, cover=None, closing=None, doc_title=""):
    pages = paginate(blocks_pages_first, PORT_BUDGET)
    extra = (1 if cover else 0) + (1 if closing else 0)
    total = len(pages) + extra
    head = hd_port(title_ar, title_en)
    secs, n = [], 1
    if cover:
        secs.append(sheet("port", cover, n, total, ""))
        n += 1
    for p in pages:
        secs.append(sheet("port", "".join(b["html"] for b in p), n, total, head))
        n += 1
    if closing:
        secs.append(sheet("port", closing, n, total, ""))
    return document(doc_title or title_ar, "port", secs)


def build_contract(cat):
    c = K.CATS[cat]
    nda, core, cats = legal_core()
    byn = {x["n"]: x for x in core}
    sub = subject_clause(cat)
    svc = ('<br>Service: <span class="num">{{sku}}</span> — {{name_en}}', '<br>الخدمة: <span class="num">{{sku}}</span> — {{name_ar}}')
    seq = [(sub["t_en"], sub["t_ar"], esc(sub["en"]) + svc[0], arx(sub["ar"]) + svc[1])]
    seq += [lc(byn[n]) for n in range(3, 11)]
    seq += [lc(x) for x in special_clauses(cat)]
    seq += [lc(byn[n]) for n in range(11, 19)]
    blocks = [blk(pre_h(1, "Parties", "الأطراف"), 30, keep=True),
              blk(co_party("First Party (Service Provider)", "الطرف الأول (مزوّد الخدمة)"), 215, keep=True),
              blk(client_party("Second Party (Client)", "الطرف الثاني (العميل)"), 215)]
    blocks += clause_blocks(seq, start=2)
    blocks.append(blk(sig_pair(sig_box("First Party", "الطرف الأول", CEO_NAME, CEO_TITLE),
                               sig_box("Second Party", "الطرف الثاني", CLIENT_BLANK, CLIENT_BLANK)), sig_h()))
    cover = cover_port("SERVICE AGREEMENT", "عقد خدمة", esc(c["en"]), esc(c["ar"]),
                       "{{sku}} · {{name_en}}", "{{sku}} · {{name_ar}}",
                       [("Parties / الأطراف", f"{CO_EN} · [●]"), ("Date / التاريخ", num("[●]")), ("Ref / المرجع", num("[●]"))])
    return port_doc("عقد خدمة: " + esc(c["ar"]), "Service Agreement: " + esc(c["en"]), blocks, cover, closing_port(),
                    "عقد خدمة · Service Agreement · " + esc(c["en"]))


def build_nda():
    nda, core, cats = legal_core()
    blocks = [blk(pre_h(1, "Parties", "الأطراف"), 30, keep=True),
              blk(co_party("First Party", "الطرف الأول"), 215, keep=True),
              blk(client_party("Second Party", "الطرف الثاني"), 215)]
    blocks += clause_blocks([lc(x) for x in nda], start=2)
    blocks.append(blk(sig_pair(sig_box("First Party", "الطرف الأول", CEO_NAME, CEO_TITLE),
                               sig_box("Second Party", "الطرف الثاني", CLIENT_BLANK, CLIENT_BLANK)), sig_h()))
    cover = cover_port("MUTUAL NON-DISCLOSURE AGREEMENT", "اتفاقية عدم إفصاح متبادلة", "Mutual Non-Disclosure Agreement",
                       "اتفاقية عدم إفصاح متبادلة", "Applies to all Business Partner services", "تسري على كل خدمات Business Partner",
                       [("Parties / الأطراف", f"{CO_EN} · [●]"), ("Date / التاريخ", num("[●]")), ("Ref / المرجع", num("[●]"))])
    return port_doc("اتفاقية عدم إفصاح متبادلة", "Mutual Non-Disclosure Agreement", blocks, cover, closing_port(),
                    "اتفاقية عدم إفصاح · Mutual NDA")


def build_terms(cat):
    c = K.CATS[cat]
    nda, core, cats = legal_core()
    byn = {x["n"]: x for x in core}
    seq = []
    for t_en, t_ar, x_en, x_ar in K.TC_INTRO:
        seq.append((t_en, t_ar, esc(x_en.format(cat_en=c["en"], cat_ar=c["ar"])), arx(x_ar.format(cat_en=c["en"], cat_ar=c["ar"]))))
    for n in K.TC_CORE_KEYS:
        seq.append(lc(byn[n]))
        if n == 10:
            seq += [lc(x) for x in special_clauses(cat)]
    for t_en, t_ar, x_en, x_ar in K.TC_OUTRO:
        seq.append((t_en, t_ar, esc(x_en), arx(x_ar)))
    blocks = clause_blocks(seq)
    ack = ('<div class="sg one" style="direction:ltr">' + sig_box("Client acknowledgement", "إقرار العميل", CLIENT_BLANK, CLIENT_BLANK, 60) + "</div>")
    blocks.append(blk(ack, 190))
    return port_doc("الشروط والأحكام: " + esc(c["ar"]), "Terms & Conditions: " + esc(c["en"]), blocks,
                    doc_title="الشروط والأحكام · Terms & Conditions · " + esc(c["en"]))


def fill_name(t):
    return (esc(t).replace("{sku}", '<span class="num">{{sku}}</span>').replace("{name_en}", "{{name_en}}")
            .replace("{name_ar}", "{{name_ar}}"))


def build_poc():
    c = K.CATS["AI Automation"]
    seq = []
    for t_en, t_ar, x_en, x_ar in K.POC:
        ar = fill_name(x_ar)
        seq.append((t_en, t_ar, fill_name(x_en), ar + RLM if ar.rstrip().endswith(".") else ar))
    blocks = [blk(pre_h(1, "Parties", "الأطراف"), 30, keep=True),
              blk(co_party("First Party", "الطرف الأول"), 215, keep=True),
              blk(client_party("Second Party (Client)", "الطرف الثاني (العميل)"), 215)]
    blocks += clause_blocks(seq, start=2)
    blocks.append(blk(sig_pair(sig_box("First Party", "الطرف الأول", CEO_NAME, CEO_TITLE),
                               sig_box("Second Party", "الطرف الثاني", CLIENT_BLANK, CLIENT_BLANK)), sig_h()))
    return port_doc("اتفاقية إثبات المفهوم (POC) · {{sku}}", "Proof of Concept (POC) Agreement · {{sku}}", blocks,
                    doc_title="إثبات المفهوم · POC · {{sku}}")


def annex_rows(cat, violation=False):
    a = K.CATS[cat]["annex"]
    exc = K.VIOLATION_ANNEX_EXCLUDED if violation else a["excluded"]
    rows = [("Entity / platform", "الجهة / المنصة",
             esc(a["entities"][0]) + " Catalogue entry: {{platform_en}}.", arx(a["entities"][1]) + " المسجّل في الكتالوج: {{platform_ar}}."),
            ("Permitted acts", "الأعمال المسموحة", esc(a["allowed"][0]), arx(a["allowed"][1])),
            ("Expressly excluded", "المستثنى صراحةً", esc(exc[0]), arx(exc[1]))]
    return rows


def build_auth(cat):
    c = K.CATS[cat]
    if not c["annex"]:
        return None
    cl = legal_auth()
    parties = [blk(pre_h(1, "Parties", "الأطراف"), 30, keep=True),
               blk(client_party("The Principal (the Client)", "المفوِّض (العميل)"), 215, keep=True),
               blk(co_party("The Authorised Party", "المفوَّض"), 215)]
    seq = []
    for x in cl:
        t = lc(x)
        if x["n"] == 2:
            t = (t[0], t[1], t[2] + '<br>Service: <span class="num">{{sku}}</span> — {{name_en}}',
                 t[3] + '<br>الخدمة: <span class="num">{{sku}}</span> — {{name_ar}}')
        seq.append(t)
    blocks = parties + clause_blocks(seq, start=2)
    blocks.append(blk(f'<div class="hdr2">Annex A — Category Annex: {esc(c["en"])} / الملحق أ — ملحق الفئة: {esc(c["ar"])}</div>', 28, keep=True))
    for i, (t_en, t_ar, x_en, x_ar) in enumerate(annex_rows(cat), 1):
        blocks.append(blk(f"<!--A{i}-->" + row("", t_en, x_en, t_ar, x_ar, alt=i % 2 == 0) + f"<!--/A{i}-->",
                          est_row(x_en, x_ar, PORT_CPL, PORT_LH)))
    blocks.append(blk(sig_pair(sig_box("Principal (Client)", "المفوِّض (العميل)", CLIENT_BLANK, CLIENT_BLANK),
                               sig_box("Authorised Party", "المفوَّض", CEO_NAME, CEO_TITLE)), sig_h()))
    head_en = "Annex to Service Agreement No. [●] — Date [●]"
    blocks.insert(0, blk(f'<div class="hdr2" dir="ltr">{head_en} <span dir="rtl" style="float:right">ملحق بعقد الخدمة رقم [●] — التاريخ [●]</span></div>', 28))
    return port_doc("خطاب تفويض: " + esc(c["ar"]), "Authorization Letter: " + esc(c["en"]), blocks,
                    doc_title="خطاب تفويض · Authorization Letter · " + esc(c["en"]))


# ================================================================ القوالب والتعبئة
def slug_dir(cat):
    return HERE / "categories" / K.CATS[cat]["slug"]


def write_templates():
    (HERE / "shared").mkdir(exist_ok=True)
    (HERE / "shared/nda.html").write_text(build_nda().replace("{{ASSETS}}", "../assets"), encoding="utf8")
    for cat, c in K.CATS.items():
        d = slug_dir(cat)
        d.mkdir(parents=True, exist_ok=True)
        (d / "quote.html").write_text(build_quote(cat).replace("{{ASSETS}}", "../../assets"), encoding="utf8")
        (d / "contract.html").write_text(build_contract(cat).replace("{{ASSETS}}", "../../assets"), encoding="utf8")
        (d / "terms.html").write_text(build_terms(cat).replace("{{ASSETS}}", "../../assets"), encoding="utf8")
        a = build_auth(cat)
        if a:
            (d / "authorization.html").write_text(a.replace("{{ASSETS}}", "../../assets"), encoding="utf8")
        elif (d / "authorization.html").exists():
            (d / "authorization.html").unlink()
        if cat == "AI Automation":
            (d / "poc.html").write_text(build_poc().replace("{{ASSETS}}", "../../assets"), encoding="utf8")
    write_category_readmes()
    print("templates: ok")


def write_category_readmes():
    svcs = load_services()
    for cat, c in K.CATS.items():
        d = slug_dir(cat)
        mine = [s for s in svcs if s["category"] == cat]
        files = [("quote.html", "عرض سعر (A4 أفقي)", "موافقة المالك على الصياغة التجارية"),
                 ("contract.html", "عقد خدمة (A4 عمودي)", "للمراجعة القانونية"),
                 ("terms.html", "الشروط والأحكام (A4 عمودي)", "للمراجعة القانونية"),
                 ("../../shared/nda.html", "عدم إفصاح متبادل (مشترك لكل الفئات)", "للمراجعة القانونية")]
        if (d / "authorization.html").exists():
            files.append(("authorization.html", "خطاب تفويض (A4 عمودي) — للخدمات ذات الجهة الحكومية فقط", "للمراجعة القانونية"))
        if (d / "poc.html").exists():
            files.append(("poc.html", "اتفاقية إثبات المفهوم POC (A4 عمودي) — للمنتجات التقنية فقط", "للمراجعة القانونية"))
        t = f"# {c['ar']} — {c['en']}\n\nتولّده `generate.py templates`؛ لا يُعدَّل يدوياً إلا بعد تحديث المصدر. الخدمات في الفئة: {len(mine)}.\n\n"
        t += "| الملف | المستند | الحالة |\n|---|---|---|\n" + "".join(f"| `{a}` | {b} | {s} |\n" for a, b, s in files)
        t += "\nالرموز: " + "، ".join(f"`{s['code']}`" for s in mine) + "\n"
        (d / "README.md").write_text(t, encoding="utf8")


def fill(template, vars_):
    def rep(m):
        k = m.group(1)
        if k not in vars_:
            raise KeyError(k)
        return vars_[k]
    return re.sub(r"\{\{(\w+)\}\}", rep, template)


def swap_region(t, marker, new_html):
    return re.sub(rf"<!--{marker}-->.*?<!--/{marker}-->", lambda m: new_html, t, flags=re.S)


def render(s, doc, out_dir, discount=0):
    cat = s["category"]
    src = (HERE / "shared/nda.html") if doc == "nda" else slug_dir(cat) / DOC_FILE[doc]
    if not src.exists():
        return None
    t = src.read_text(encoding="utf8")
    if doc == "quote" and is_violation(s):
        for i, (en, ar) in enumerate(K.VIOLATION_SCOPE, 1):
            t = swap_region(t, f"S{i}", bullet(i, en, ar, alt=i % 2 == 0))
    if doc == "authorization" and is_violation(s):
        for i, (t_en, t_ar, x_en, x_ar) in enumerate(annex_rows(cat, violation=True), 1):
            if i == 3:
                t = swap_region(t, f"A{i}", row("", t_en, x_en, t_ar, x_ar, alt=i % 2 == 0))
    v = svc_vars(s, discount)
    rel = Path(out_dir).resolve().relative_to(HERE).parts
    new_assets = "/".join([".."] * len(rel)) + "/assets"
    old_assets = "../assets" if doc == "nda" else "../../assets"
    t = t.replace(f"url({old_assets}/", f"url({new_assets}/")
    out = fill(t, v)
    return re.sub(r"<!--/?[SA]\d-->", "", out)


def build_service(s, out_root, discount=0, pdf=False):
    ap = applicable(s)
    d = Path(out_root) / K.CATS[s["category"]]["slug"] / s["code"]
    d.mkdir(parents=True, exist_ok=True)
    written = []
    for doc in DOCS:
        if not ap[doc]:
            continue
        h = render(s, doc, d, discount)
        if h is None:
            continue
        f = d / f"{doc}.html"
        f.write_text(h, encoding="utf8")
        written.append(f)
        if pdf:
            to_pdf(f)
    return written


def to_pdf(f):
    out = f.with_suffix(".pdf")
    try:
        import weasyprint  # type: ignore
        weasyprint.HTML(filename=str(f)).write_pdf(str(out))
        return out
    except ImportError:
        pass
    for exe in ("chromium", "chromium-browser", "google-chrome", "chrome"):
        if shutil.which(exe):
            subprocess.run([exe, "--headless", "--disable-gpu", "--no-pdf-header-footer", f"--print-to-pdf={out}", f.as_uri()],
                           check=True, capture_output=True)
            return out
    print("لا أداة PDF متاحة (WeasyPrint أو Chrome): بقي HTML فقط", file=sys.stderr)
    return None


# ================================================================ الفهرس
def index_rows(svcs):
    rows = []
    for s in svcs:
        ap = applicable(s)
        note = AUTH_OVERRIDE.get(s["code"], (None, ""))[1]
        if not ap["authorization"] and not note:
            note = "لا جهة حكومية في الكتالوج" if not gov_involved(s) else "لا ينطبق على الفئة"
        if dedicated(s):
            note = (note + "؛ " if note else "") + "العرض والعقد: docs/sales/templates/REV-quote|contract-*.html"
        if s["code"] in TECH_REVIEW:
            note = (note + "؛ " if note else "") + "قرار المالك: هل هي منتج تقني يحتاج POC؟"
        price = "سعر الكتالوج" if has_price(s) else "[●]"
        rows.append({
            "sku": s["code"], "category_en": s["category"], "category_ar": s["categoryAr"],
            "name_en": s["nameEn"], "name_ar": s["nameAr"], "pricing_model": s["pricingModel"],
            "catalog_amount": s["amount"] if has_price(s) else "", "price_status": price,
            "gov_fees_separate": "نعم" if s.get("govFeesSeparate") else "لا",
            "requires_proposal": "نعم" if s.get("requiresProposal") else "لا",
            "gov_platform": s.get("govPlatform") or "",
            "quote": "نعم" if ap["quote"] else "قالب REV مخصص", "contract": "نعم" if ap["contract"] else "قالب REV مخصص",
            "nda": "نعم (مشترك)", "terms": "نعم",
            "poc": "نعم" if ap["poc"] else "لا",
            "authorization": "نعم" if ap["authorization"] else "لا",
            "violation_scope": "نعم" if is_violation(s) else "لا",
            "note": note, "template_folder": f"categories/{K.CATS[s['category']]['slug']}",
        })
    return rows


def write_index():
    svcs = load_services()
    rows = index_rows(svcs)
    with open(HERE / "services-index.csv", "w", encoding="utf-8-sig", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    md = ["# فهرس الخدمات والمستندات المنطبقة — 200 خدمة", "",
          "مولّد من `catalog.json` بـ `generate.py index`. السعر: «سعر الكتالوج» (+15% ضريبة) أو `[●]`. التفويض فقط حيث منصة أو إجراء جهة حكومية.", "",
          "| SKU | الفئة | الخدمة | النموذج | السعر | رسوم حكومية منفصلة | عرض مفصّل | POC | تفويض | ملاحظة |", "|---|---|---|---|---|---|---|---|---|---|"]
    for r in rows:
        price = f"{r['catalog_amount']:,}" if r["catalog_amount"] != "" else "[●]"
        md.append(f"| `{r['sku']}` | {r['category_ar']} | {r['name_ar']} | {r['pricing_model']} | {price} | {r['gov_fees_separate']} | "
                  f"{r['requires_proposal']} | {r['poc']} | {r['authorization']} | {r['note']} |")
    (HERE / "services-index.md").write_text("\n".join(md) + "\n", encoding="utf8")
    print(f"index: {len(rows)} خدمة")


# ================================================================ العينات
def pick_samples(svcs):
    out = []

    def add(x):
        if x and x not in out and len(out) < 3:
            out.append(x)

    def first(pred):
        return next((x for x in svcs if pred(x)), None)

    add(first(lambda x: has_price(x) and not gov_involved(x)))
    add(first(lambda x: has_price(x) and gov_involved(x) and not is_violation(x)))
    add(first(is_violation))
    add(first(lambda x: not has_price(x)))
    for x in svcs:
        add(x)
    return out


def write_samples():
    root = HERE / "out-samples"
    if root.exists():
        shutil.rmtree(root)
    svcs = load_services()
    picked, n = [], 0
    for cat in K.CATS:
        mine = [s for s in svcs if s["category"] == cat]
        for s in pick_samples(mine):
            n += len(build_service(s, root))
            picked.append(s["code"])
    (root / "SAMPLES.md").write_text("# عينات المخرجات (3 خدمات لكل فئة)\n\nنُسخ HTML مفتوحة داخلية. لا تُرسل للعميل؛ يُرسل PDF فقط وبقرار المالك.\n\n"
                                     + "\n".join(f"- `{c}`" for c in picked) + "\n", encoding="utf8")
    print(f"samples: {len(picked)} خدمة، {n} ملفاً")


# ================================================================ الفحص
FORBID = [r"مسودة", r"الوكيل", r"\bSA\d{2}[0-9A-Z]{18,22}\b", r"\b05\d{8}\b", r"\+?9665\d{8}\b"]


def client_terms():
    names = {"EIC", "ATYX", "Nyra", "ISR", "Aknan", "Petromaint", "Qmove", "Runyi", "Mahfooz", "أكنان", "الألماس", "بترومنت", "اليمني",
             "عبدالمحسن", "موهبتك", "أسامة الملا", "عبيد", "مداور", "نيرا", "سحر", "فواز", "الخطوط الذهبية"}
    if LEDGER.exists():
        for line in LEDGER.read_text(encoding="utf8").splitlines():
            cells = [c.strip() for c in line.split("|")]
            if len(cells) > 4 and re.match(r"^\d+$", cells[1]):
                n = re.sub(r"[()]|\(.*?\)", "", cells[3]).strip()
                if n and n not in ("فارغ",) and "فارغ" not in n and len(n) > 3:
                    names.add(n.split("—")[0].strip())
    return names


def verify():
    svcs = load_services()
    ok = True
    codes = {s["code"] for s in svcs}
    csv_codes = {r["sku"] for r in csv.DictReader(open(HERE / "services-index.csv", encoding="utf-8-sig"))}
    print(f"خدمات الكتالوج: {len(svcs)} | في الفهرس: {len(csv_codes)} | تغطية كاملة: {codes == csv_codes}")
    ok &= codes == csv_codes and len(codes) == 200
    # كل فئة لها قالب
    missing = [c for c in {s['category'] for s in svcs} if c not in K.CATS]
    print("فئات بلا قالب:", missing or "لا شيء")
    ok &= not missing
    for cat, c in K.CATS.items():
        d = slug_dir(cat)
        for need in ("quote.html", "contract.html", "terms.html"):
            if not (d / need).exists():
                print("ناقص:", d / need)
                ok = False
        if c["annex"] and not (d / "authorization.html").exists():
            print("ناقص تفويض:", cat)
            ok = False
    # كل خدمة يمكن توليدها
    import tempfile
    tmp = Path(tempfile.mkdtemp(prefix="lib-verify-", dir=HERE))
    try:
        built = 0
        for s in svcs:
            for f in build_service(s, tmp):
                built += 1
        print(f"توليد كامل لـ200 خدمة: {built} مستنداً بلا أخطاء")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    # فحص المحظورات في القوالب والعينات
    files = list((HERE / "categories").rglob("*.html")) + list((HERE / "shared").rglob("*.html")) + list((HERE / "out-samples").rglob("*.html"))
    names = client_terms()
    bad = 0
    for f in files:
        t = f.read_text(encoding="utf8")
        body = re.sub(r"<style>.*?</style>", "", t, flags=re.S)
        text = re.sub(r"<[^>]+>", " ", body)
        for pat in FORBID:
            m = re.search(pat, text)
            if m:
                print("محظور", pat, "في", f.relative_to(HERE), "→", m.group(0))
                bad += 1
        for n in names:
            if n in text:
                print("اسم عميل محتمل", n, "في", f.relative_to(HERE))
                bad += 1
        for tok in ("{{", "}}"):
            if tok in text and "out-samples" in str(f):
                print("متغير غير مملوء في", f.relative_to(HERE))
                bad += 1
                break
    # هوية: أي رقم من 10 خانات غير رقم المنشأة
    for f in files:
        text = re.sub(r"<[^>]+>|<style>.*?</style>", " ", f.read_text(encoding="utf8"))
        for m in re.finditer(r"\b[12]\d{9}\b", text):
            if m.group(0) != CO_UNIFIED:
                print("رقم يشبه الهوية في", f.relative_to(HERE), m.group(0))
                bad += 1
    print(f"ملفات مفحوصة: {len(files)} | مخالفات: {bad}")
    ok &= bad == 0
    print("النتيجة:", "ناجح" if ok else "فشل")
    return 0 if ok else 1


# ================================================================ فحص الاتساع (يتطلب WeasyPrint)
LIMIT = {"land": 650, "port": 979}  # أسفل منطقة المحتوى بالبكسل (هامش التذييل 144)


def _walk(b, out):
    el = getattr(b, "element", None)
    if el is not None and el.tag == "section" and "sheet" in (el.get("class") or ""):
        for c in getattr(b, "children", []):
            ce = getattr(c, "element", None)
            if ce is not None and ce.tag == "div":
                kinds = " ".join((x.element.get("class") or "") for x in c.children if getattr(x, "element", None) is not None)
                out.append((c.position_y + c.margin_height(), "cv" in kinds.split() or " cv" in " " + kinds, "land" in el.get("class")))
                break
        return
    for c in getattr(b, "children", []) or []:
        _walk(c, out)


def check_fit(paths):
    try:
        import weasyprint  # type: ignore
    except ImportError:
        print("check-fit يتطلب: pip install weasyprint", file=sys.stderr)
        return 2
    worst, over = 0, 0
    for f in paths:
        doc = weasyprint.HTML(filename=str(f)).render()
        for i, pg in enumerate(doc.pages, 1):
            o = []
            _walk(pg._page_box, o)
            if not o or o[0][1]:
                continue  # غلاف: ارتفاعه ثابت
            y, _, land = o[0]
            lim = LIMIT["land" if land else "port"]
            worst = max(worst, y - lim)
            if y > lim:
                over += 1
                print("فائض", Path(f).relative_to(HERE), "صفحة", i, round(y - lim), "px")
    print(f"check-fit: {len(paths)} ملفاً | صفحات تتجاوز حد المحتوى: {over} | أقرب هامش: {round(-worst)} px")
    return 0 if not over else 1


def fit_worst_case():
    """أطول خدمة اسماً في كل فئة + عينات: تُبنى في مجلد مؤقت وتُفحص."""
    import tempfile
    svcs = load_services()
    tmp = Path(tempfile.mkdtemp(prefix="lib-fit-", dir=HERE))
    try:
        for cat in K.CATS:
            mine = [s for s in svcs if s["category"] == cat]
            for s in sorted(mine, key=lambda x: -len(x["nameEn"] + x["nameAr"]))[:2] + [x for x in mine if is_violation(x)][:1]:
                build_service(s, tmp)
        files = sorted(tmp.rglob("*.html")) + sorted((HERE / "out-samples").rglob("*.html"))
        return check_fit(files)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# ================================================================ CLI
def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)
    sp.add_parser("templates")
    sp.add_parser("index")
    sp.add_parser("samples")
    sp.add_parser("verify")
    sp.add_parser("check-fit")
    sp.add_parser("all")
    b = sp.add_parser("build")
    b.add_argument("--sku", action="append")
    b.add_argument("--category")
    b.add_argument("--all", action="store_true")
    b.add_argument("--out", default=str(HERE / "out"))
    b.add_argument("--discount", type=int, default=0, help="10 أو 20 أو 30 فقط (السلّم المعتمد)")
    b.add_argument("--pdf", action="store_true")
    a = ap.parse_args(argv)
    if a.cmd == "templates":
        write_templates()
    elif a.cmd == "index":
        write_index()
    elif a.cmd == "samples":
        write_samples()
    elif a.cmd == "verify":
        return verify()
    elif a.cmd == "check-fit":
        return fit_worst_case()
    elif a.cmd == "all":
        write_templates()
        write_index()
        write_samples()
        return verify()
    elif a.cmd == "build":
        svcs = load_services()
        if a.sku:
            sel = [s for s in svcs if s["code"] in a.sku]
            if len(sel) != len(a.sku):
                raise SystemExit("SKU غير موجود في الكتالوج")
        elif a.category:
            sel = [s for s in svcs if s["category"] == a.category]
        elif a.all:
            sel = svcs
        else:
            raise SystemExit("حدّد --sku أو --category أو --all")
        out = Path(a.out).resolve()
        try:
            out.relative_to(HERE)
        except ValueError:
            raise SystemExit("مجلد المخرجات يجب أن يقع تحت docs/sales/library/")
        n = sum(len(build_service(s, out, a.discount, a.pdf)) for s in sel)
        print(f"{len(sel)} خدمة، {n} ملفاً في {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
