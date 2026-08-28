// Minimal XLSX reader/patcher for the AI Document Agent — no npm dependencies,
// built on the same _zip.js the DOCX path uses. An .xlsx is a ZIP of XML parts;
// we list every cell so the model can address blanks by A1 reference, then
// write the agent's values back as inline strings in a blue font, leaving the
// rest of the workbook byte-identical. Formulas, merged cells, layout, styles
// of untouched cells: all preserved because we never re-serialize the sheet —
// we splice the one <c> element we change.
import { zip, unzip } from "./_zip.js";

const unescXml = (s) => String(s == null ? "" : s)
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&amp;/g, "&");
const escXml = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// "B7" → { col: "B", colNo: 2, row: 7 }
export function parseRef(ref) {
  const m = /^([A-Z]{1,3})(\d{1,7})$/.exec(String(ref || "").toUpperCase().trim());
  if (!m) return null;
  let n = 0;
  for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return { col: m[1], colNo: n, row: Number(m[2]) };
}

function sheetList(entries) {
  const wb = entries.get("xl/workbook.xml");
  const rels = entries.get("xl/_rels/workbook.xml.rels");
  if (!wb || !rels) throw new Error("not_xlsx");
  const relMap = new Map();
  for (const m of rels.toString("utf8").matchAll(/<Relationship\b[^>]*>/g)) {
    const id = / Id="([^"]+)"/.exec(m[0]);
    const target = / Target="([^"]+)"/.exec(m[0]);
    if (id && target) relMap.set(id[1], target[1].replace(/^\//, "").replace(/^(?!xl\/)/, "xl/"));
  }
  const sheets = [];
  for (const m of wb.toString("utf8").matchAll(/<sheet [^>]*\/>/g)) {
    const name = / name="([^"]*)"/.exec(m[0]);
    const rid = / r:id="([^"]*)"/.exec(m[0]);
    const path = rid && relMap.get(rid[1]);
    if (name && path && entries.has(path)) sheets.push({ name: unescXml(name[1]), path });
  }
  if (!sheets.length) throw new Error("no_sheets");
  return sheets;
}

function sharedStrings(entries) {
  const part = entries.get("xl/sharedStrings.xml");
  if (!part) return [];
  const out = [];
  for (const m of part.toString("utf8").matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    let text = "";
    for (const t of m[1].matchAll(/<t(?: [^>]*)?>([\s\S]*?)<\/t>/g)) text += unescXml(t[1]);
    out.push(text);
  }
  return out;
}

function cellText(cell, inner, shared) {
  const t = / t="([^"]*)"/.exec(cell);
  const kind = t ? t[1] : "";
  if (kind === "inlineStr") {
    let text = "";
    for (const m of inner.matchAll(/<t(?: [^>]*)?>([\s\S]*?)<\/t>/g)) text += unescXml(m[1]);
    return text;
  }
  const v = /<v(?: [^>]*)?>([\s\S]*?)<\/v>/.exec(inner);
  if (!v) return "";
  if (kind === "s") return shared[Number(v[1])] ?? "";
  return unescXml(v[1]);
}

/** Every non-empty cell of every sheet: [{sheet, ref, text}] in sheet order. */
export function xlsxCells(buf) {
  const entries = unzip(buf);
  const shared = sharedStrings(entries);
  const cells = [];
  for (const s of sheetList(entries)) {
    const xml = entries.get(s.path).toString("utf8");
    for (const m of xml.matchAll(/<c ([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /(?:^|\s)r="([^"]+)"/.exec(m[1]);
      if (!ref) continue;
      const text = m[2] ? cellText(m[1], m[2], shared) : "";
      if (text.trim()) cells.push({ sheet: s.name, ref: ref[1], text });
    }
  }
  return cells;
}

const colName = (n) => { let s = ""; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };
const LABELISH = /[:：؟?]\s*$|^\s*(اسم|رقم|تاريخ|عنوان|جوال|هاتف|بريد|نوع|قيمة|نسبة|الرقم|الاسم)\b|^\s*(name|number|no\.?|date|address|email|phone|type|amount|value|iban|vat|cr)\b/i;

/**
 * Every label cell that has an empty neighbour — i.e. every blank this form is
 * asking someone to fill. Empty cells do not exist in the XLSX XML at all, so
 * a blank form is invisible to a reader that only lists non-empty cells: it
 * looks like a short list of labels, which is exactly why such forms were
 * being classified as "source documents" instead of forms to fill.
 * Returns [{sheet, label, ref, next, prev, below}] with the empty candidates.
 */
export function xlsxBlanks(buf, max = 300) {
  const cells = xlsxCells(buf);
  const bySheet = new Map();
  for (const c of cells) {
    if (!bySheet.has(c.sheet)) bySheet.set(c.sheet, new Set());
    bySheet.get(c.sheet).add(c.ref.toUpperCase());
  }
  const out = [];
  for (const c of cells) {
    if (out.length >= max) break;
    const p = parseRef(c.ref);
    if (!p) continue;
    const text = c.text.trim();
    if (!text || text.length > 120 || !LABELISH.test(text)) continue;
    const taken = bySheet.get(c.sheet);
    const at = (colNo, row) => (colNo < 1 ? null : `${colName(colNo)}${row}`);
    const free = (ref) => ref && !taken.has(ref);
    const next = at(p.colNo + 1, p.row), prev = at(p.colNo - 1, p.row), below = at(p.colNo, p.row + 1);
    if (!free(next) && !free(prev) && !free(below)) continue;
    out.push({
      sheet: c.sheet, label: text, ref: c.ref.toUpperCase(),
      next: free(next) ? next : null, prev: free(prev) ? prev : null, below: free(below) ? below : null,
    });
  }
  return out;
}

// Add (once) a font+cellXf for the agent's ink and return the xf index, or ""
// when the workbook should keep its original styling.
function ensureFillStyle(entries, colorHex) {
  if (!colorHex) return "";
  const path = "xl/styles.xml";
  let xml = entries.get(path) && entries.get(path).toString("utf8");
  if (!xml) return "";
  const fonts = /<fonts count="(\d+)"([^>]*)>/.exec(xml);
  const xfs = /<cellXfs count="(\d+)"([^>]*)>/.exec(xml);
  if (!fonts || !xfs) return "";
  const fontId = Number(fonts[1]);
  const xfId = Number(xfs[1]);
  xml = xml.replace(fonts[0], `<fonts count="${fontId + 1}"${fonts[2]}>`);
  xml = xml.replace(/<\/fonts>/, `<font><sz val="11"/><color rgb="FF${colorHex}"/><name val="Calibri"/></font></fonts>`);
  // re-locate cellXfs after the fonts edit shifted nothing structural
  xml = xml.replace(/<cellXfs count="(\d+)"([^>]*)>/, (_, c, rest) => `<cellXfs count="${Number(c) + 1}"${rest}>`);
  xml = xml.replace(/<\/cellXfs>/, `<xf numFmtId="0" fontId="${fontId}" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>`);
  entries.set(path, Buffer.from(xml, "utf8"));
  return String(xfId);
}

const cellXml = (ref, text, styleId) =>
  `<c r="${ref}"${styleId !== "" ? ` s="${styleId}"` : ""} t="inlineStr"><is><t xml:space="preserve">${escXml(String(text).slice(0, 500))}</t></is></c>`;

// Write one value into one sheet's XML, creating the row/cell when absent and
// keeping row and column order valid (Excel requires ascending refs).
function applyToSheet(xml, ref, text, styleId) {
  const target = parseRef(ref);
  if (!target) return null;
  const fresh = cellXml(target.col + target.row, text, styleId);
  // Existing cell → splice-replace the whole element (self-closing or paired).
  const cellRe = new RegExp(`<c [^>]*r="${target.col}${target.row}"[^>]*(?:/>|>[\\s\\S]*?</c>)`);
  if (cellRe.test(xml)) return xml.replace(cellRe, fresh);
  // Existing row → insert the cell at its column position.
  const rowRe = new RegExp(`<row [^>]*r="${target.row}"[^>]*(/>|>)`);
  const rowM = rowRe.exec(xml);
  if (rowM) {
    if (rowM[1] === "/>") {
      return xml.replace(rowM[0], `${rowM[0].slice(0, -2)}>${fresh}</row>`);
    }
    const rowStart = rowM.index + rowM[0].length;
    const rowEnd = xml.indexOf("</row>", rowStart);
    if (rowEnd === -1) return null;
    let insertAt = rowEnd;
    for (const c of xml.slice(rowStart, rowEnd).matchAll(/<c [^>]*r="([A-Z]+)(\d+)"[^>]*(?:\/>|>[\s\S]*?<\/c>)/g)) {
      const p = parseRef(c[1] + c[2]);
      if (p && p.colNo > target.colNo) { insertAt = rowStart + c.index; break; }
    }
    return xml.slice(0, insertAt) + fresh + xml.slice(insertAt);
  }
  // No row → insert a new row in ascending order inside <sheetData>.
  const dataM = /<sheetData(?:\s[^>]*)?>/.exec(xml);
  if (!dataM) {
    if (/<sheetData\s*\/>/.test(xml)) return xml.replace(/<sheetData\s*\/>/, `<sheetData><row r="${target.row}">${fresh}</row></sheetData>`);
    return null;
  }
  const dataStart = dataM.index + dataM[0].length;
  const dataEnd = xml.indexOf("</sheetData>", dataStart);
  let insertAt = dataEnd;
  for (const r of xml.slice(dataStart, dataEnd).matchAll(/<row [^>]*r="(\d+)"[^>]*(?:\/>|>)/g)) {
    if (Number(r[1]) > target.row) { insertAt = dataStart + r.index; break; }
  }
  return xml.slice(0, insertAt) + `<row r="${target.row}">${fresh}</row>` + xml.slice(insertAt);
}

/**
 * Fill cells in place. ops: [{sheet, ref, text}]; colorHex e.g. "1F4ED8" or ""
 * to keep original styling. Returns { buf, applied } — ops that addressed a
 * missing sheet or an unparsable ref are skipped, never guessed.
 */
export function xlsxApply(buf, ops, colorHex) {
  const entries = unzip(buf);
  const sheets = sheetList(entries);
  const byName = new Map(sheets.map((s) => [s.name, s.path]));
  const styleId = ensureFillStyle(entries, colorHex);
  const applied = [];
  for (const o of ops) {
    const path = byName.get(String(o.sheet || sheets[0].name)) || (sheets.length === 1 ? sheets[0].path : null);
    if (!path || o.text == null) continue;
    const xml = entries.get(path).toString("utf8");
    const next = applyToSheet(xml, String(o.ref || ""), String(o.text), styleId);
    if (next) { entries.set(path, Buffer.from(next, "utf8")); applied.push(o); }
  }
  return { buf: zip(entries), applied };
}
