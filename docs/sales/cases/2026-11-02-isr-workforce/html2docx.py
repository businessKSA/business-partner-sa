# -*- coding: utf-8 -*-
"""يحوّل مستندات HTML الطولية (عقد، NDA، تفويض، مستندات مطلوبة، مهن) إلى DOCX قابل للتعديل.
الاستعمال: python3 html2docx.py <in.html> <out.docx> [العنوان]
الجداول والصفوف المتقابلة (إنجليزي يسار / عربي يمين) تُحفظ كجداول؛ الفقرات العربية RTL.
النسخة الرسمية تبقى PDF؛ هذا الملف للتعديل."""
import re, sys
from bs4 import BeautifulSoup, NavigableString, Tag
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

NAVY = RGBColor(0x0B, 0x1B, 0x5A)
AR_RE = re.compile(r"[؀-ۿ]")
SKIP = {"script", "style", "head"}
SKIP_CLS = {"ft", "logo", "lgc", "gp"}


def is_ar(text):
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return False
    return sum(1 for c in letters if AR_RE.match(c)) / len(letters) > 0.5


def set_rtl(par, rtl=True):
    pPr = par._p.get_or_add_pPr()
    if rtl:
        b = OxmlElement("w:bidi"); pPr.append(b)
        par.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    for r in par.runs:
        rPr = r._r.get_or_add_rPr()
        if rtl:
            rt = OxmlElement("w:rtl"); rPr.append(rt)
        rf = rPr.find(qn("w:rFonts"))
        if rf is None:
            rf = OxmlElement("w:rFonts"); rPr.append(rf)
        rf.set(qn("w:cs"), "Arial")


def runs_from(node, par, bold=False, size=None, color=None):
    for ch in node.children:
        if isinstance(ch, NavigableString):
            t = re.sub(r"\s+", " ", str(ch))
            if t.strip() or t == " ":
                r = par.add_run(t); r.bold = bold
                if size: r.font.size = Pt(size)
                if color: r.font.color.rgb = color
        elif isinstance(ch, Tag):
            if ch.name == "br":
                par.add_run().add_break(); continue
            cls = set(ch.get("class", []))
            if "fld" in cls:
                par.add_run("____________"); continue
            if cls & SKIP_CLS or ch.name in SKIP or ch.name == "table":
                continue
            b = bold or ch.name in ("b", "strong", "h1", "h2", "h3", "th")
            runs_from(ch, par, bold=b, size=size, color=color)


def plain(node):
    p = Document().add_paragraph()
    runs_from(node, p)
    return "".join(r.text for r in p.runs).strip()


def add_par(container, node, size=10, bold=False, color=None, rtl=None):
    par = container.add_paragraph()
    runs_from(node, par, bold=bold, size=size, color=color)
    txt = "".join(r.text for r in par.runs).strip()
    if not txt:
        par._p.getparent().remove(par._p); return None
    par.paragraph_format.space_after = Pt(3)
    set_rtl(par, is_ar(txt) if rtl is None else rtl)
    return par


def shade(cell, hexcolor):
    tcPr = cell._tc.get_or_add_tcPr()
    sh = OxmlElement("w:shd"); sh.set(qn("w:val"), "clear"); sh.set(qn("w:color"), "auto"); sh.set(qn("w:fill"), hexcolor); tcPr.append(sh)


def borders(table):
    tbl = table._tbl; tblPr = tbl.tblPr
    b = OxmlElement("w:tblBorders")
    for e in ("top", "left", "bottom", "right", "insideH", "insideV"):
        x = OxmlElement("w:" + e); x.set(qn("w:val"), "single"); x.set(qn("w:sz"), "4"); x.set(qn("w:color"), "C9CEE3"); b.append(x)
    tblPr.append(b)


def fill_cell(cell, node, header=False):
    first = True
    blocks = [c for c in node.children if isinstance(c, Tag) and c.name in ("div", "p", "h1", "h2", "h3") and not (set(c.get("class", [])) & SKIP_CLS)]
    items = blocks if blocks else [node]
    for it in items:
        par = cell.paragraphs[0] if first else cell.add_paragraph()
        first = False
        runs_from(it, par, bold=header, size=9, color=RGBColor(255, 255, 255) if header else None)
        txt = "".join(r.text for r in par.runs).strip()
        set_rtl(par, is_ar(txt) if txt else False)
        par.paragraph_format.space_after = Pt(1)


def add_table(doc, tnode):
    rows = []
    for tr in tnode.find_all("tr", recursive=False) or [r for r in tnode.find_all("tr") if r.find_parent("table") is tnode]:
        cells = [c for c in tr.find_all(["td", "th"], recursive=False)]
        if cells: rows.append(cells)
    if not rows:
        return
    ncols = max(sum(int(c.get("colspan", 1)) for c in r) for r in rows)
    table = doc.add_table(rows=len(rows), cols=ncols)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    borders(table)
    widths = []
    cg = tnode.find("colgroup")
    if cg:
        for c in cg.find_all("col"):
            m = re.search(r"width:\s*([\d.]+)%", c.get("style", ""))
            widths.append(float(m.group(1)) if m else 0)
    for ri, cells in enumerate(rows):
        ci = 0
        for c in cells:
            span = int(c.get("colspan", 1))
            cell = table.cell(ri, ci)
            if span > 1:
                cell = cell.merge(table.cell(ri, ci + span - 1))
            hdr = c.name == "th"
            fill_cell(cell, c, header=hdr)
            if hdr:
                shade(cell, "0B1B5A")
            elif "tot" in (tr_cls := set(c.find_parent("tr").get("class", []))):
                shade(cell, "E8ECF8")
            ci += span
    if widths and len(widths) == ncols and sum(widths) > 0:
        total = 17.0
        for row in table.rows:
            for i, w in enumerate(widths):
                if i < len(row.cells) and w:
                    row.cells[i].width = Cm(total * w / sum(widths))
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def add_pairs(doc, grid):
    """div.cg: أبناء متتالون en/ar → جدول عمودين (إنجليزي يسار، عربي يمين)."""
    kids = [c for c in grid.children if isinstance(c, Tag)]
    rows, i = [], 0
    while i < len(kids):
        a = kids[i]
        if "en" in a.get("class", []) and i + 1 < len(kids) and "ar" in kids[i + 1].get("class", []):
            rows.append((a, kids[i + 1])); i += 2
        else:
            rows.append((a, None)); i += 1
    table = doc.add_table(rows=len(rows), cols=2)
    borders(table)
    for r, (en, ar) in enumerate(rows):
        for c, node in ((0, en), (1, ar)):
            if node is None: continue
            cell = table.cell(r, c)
            par = cell.paragraphs[0]
            runs_from(node, par, size=9.5)
            txt = "".join(x.text for x in par.runs).strip()
            set_rtl(par, c == 1 or is_ar(txt))
    for row in table.rows:
        for c in row.cells:
            c.width = Cm(8.5)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    seen = set()
    for t in grid.find_all("table"):
        key = id(t)
        if key not in seen:
            seen.add(key); add_table(doc, t)


def walk(doc, node):
    for ch in node.children:
        if isinstance(ch, NavigableString):
            continue
        if not isinstance(ch, Tag) or ch.name in SKIP:
            continue
        cls = set(ch.get("class", []))
        if cls & SKIP_CLS:
            continue
        if ch.name == "table":
            if ch.find("div", class_="cg"):
                for td in ch.find_all("td"):
                    walk(doc, td)
                continue
            add_table(doc, ch); continue
        if "cg" in cls:
            add_pairs(doc, ch); continue
        if ch.name in ("h1", "h2", "h3"):
            add_par(doc, ch, size={"h1": 16, "h2": 12, "h3": 11}[ch.name], bold=True, color=NAVY); continue
        if "rw" in cls:
            cols = [c for c in ch.find_all(recursive=False) if isinstance(c, Tag)]
            if len(cols) == 2:
                t = doc.add_table(rows=1, cols=2)
                for i, c in enumerate(cols):
                    par = t.cell(0, i).paragraphs[0]; runs_from(c, par, bold=True, size=11, color=NAVY)
                    set_rtl(par, i == 1)
                doc.add_paragraph().paragraph_format.space_after = Pt(2)
                continue
        inline_only = all(isinstance(x, NavigableString) or x.name in ("b", "i", "span", "br", "strong", "em", "a", "sup") for x in ch.children)
        if inline_only and plain(ch):
            add_par(doc, ch); continue
        walk(doc, ch)


def convert(src, dst, title=None):
    soup = BeautifulSoup(open(src, encoding="utf-8").read(), "html.parser")
    doc = Document()
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Cm(21), Cm(29.7)
    sec.left_margin = sec.right_margin = Cm(2); sec.top_margin = Cm(2); sec.bottom_margin = Cm(2)
    st = doc.styles["Normal"]; st.font.name = "Arial"; st.font.size = Pt(10)
    hp = sec.header.paragraphs[0]
    r = hp.add_run("BUSINESS PARTNER  ·  بزنس بارتنر" + ("   |   " + title if title else "")); r.bold = True; r.font.size = Pt(9); r.font.color.rgb = NAVY
    fp = sec.footer.paragraphs[0]
    r = fp.add_run("National Address: RDAA9214 · 9214 King Khaled Branch Rd, Al Asemah, Ad Diriyah 13714 · business@businesspartner.sa · www.businesspartner.sa"); r.font.size = Pt(7.5)
    sheets = soup.find_all("section", class_="sheet")
    for i, s in enumerate(sheets):
        walk(doc, s)
        if i < len(sheets) - 1:
            doc.add_page_break()
    doc.save(dst)


if __name__ == "__main__":
    convert(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
