// Unit tests for the AI Document Agent's in-place fill engines:
//   * api/_xlsx.js    — Excel cells written as blue inline strings
//   * api/_pdfform.js — AcroForm /V values via incremental update
// Pure node:test, no dependencies — `npm test` runs them anywhere.
import test from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { zip, unzip } from "../api/_zip.js";
import { xlsxCells, xlsxApply, parseRef } from "../api/_xlsx.js";
import { pdfFields, pdfFill } from "../api/_pdfform.js";

/* ------------------------------------------------------------------ XLSX -- */
const XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`;
function makeXlsx() {
  const sheet1 = `${XML}
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="2"><c r="B2" t="inlineStr"><is><t>Registered Legal Name:</t></is></c></row>
<row r="3"><c r="B3" t="inlineStr"><is><t>CR Number:</t></is></c></row>
<row r="6"><c r="B6" t="inlineStr"><is><t>City:</t></is></c><c r="C6" t="inlineStr"><is><t>Riyadh</t></is></c></row>
</sheetData></worksheet>`;
  const sheet2 = `${XML}
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c></row>
</sheetData></worksheet>`;
  const shared = `${XML}
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="1" uniqueCount="1"><si><t>Bank Name:</t></si></sst>`;
  const styles = `${XML}
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>`;
  const workbook = `${XML}
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Vendor Form" sheetId="1" r:id="rId1"/><sheet name="Bank Details" sheetId="2" r:id="rId2"/></sheets></workbook>`;
  const wbRels = `${XML}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`;
  const rootRels = `${XML}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const types = `${XML}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`;
  return zip(new Map([
    ["[Content_Types].xml", Buffer.from(types)],
    ["_rels/.rels", Buffer.from(rootRels)],
    ["xl/workbook.xml", Buffer.from(workbook)],
    ["xl/_rels/workbook.xml.rels", Buffer.from(wbRels)],
    ["xl/styles.xml", Buffer.from(styles)],
    ["xl/sharedStrings.xml", Buffer.from(shared)],
    ["xl/worksheets/sheet1.xml", Buffer.from(sheet1)],
    ["xl/worksheets/sheet2.xml", Buffer.from(sheet2)],
  ]));
}

test("parseRef parses and rejects", () => {
  assert.deepEqual(parseRef("B7"), { col: "B", colNo: 2, row: 7 });
  assert.equal(parseRef("7B"), null);
  assert.equal(parseRef(""), null);
});

test("xlsxCells lists labels from inline, shared and multi-sheet cells", () => {
  const cells = xlsxCells(makeXlsx());
  assert.deepEqual(cells.map((c) => `${c.sheet}!${c.ref}=${c.text}`), [
    "Vendor Form!B2=Registered Legal Name:",
    "Vendor Form!B3=CR Number:",
    "Vendor Form!B6=City:",
    "Vendor Form!C6=Riyadh",
    "Bank Details!A1=Bank Name:",
  ]);
});

test("xlsxApply writes new cells, replaces stale ones, keeps labels, adds blue ink", () => {
  const { buf, applied } = xlsxApply(makeXlsx(), [
    { sheet: "Vendor Form", ref: "C2", text: "شركة قوة العمل للتجارة" },
    { sheet: "Vendor Form", ref: "C3", text: "1010757593" },
    { sheet: "Vendor Form", ref: "C6", text: "Al Olaya, Riyadh" },   // overwrite
    { sheet: "Vendor Form", ref: "D9", text: "new row too" },        // new row
    { sheet: "Bank Details", ref: "B1", text: "Saudi National Bank" },
    { sheet: "Nope", ref: "A1", text: "must skip" },
    { sheet: "Vendor Form", ref: "NOT_A_REF", text: "must skip" },
  ], "1F4ED8");
  assert.equal(applied.length, 5);
  const after = new Map(xlsxCells(buf).map((c) => [`${c.sheet}!${c.ref}`, c.text]));
  assert.equal(after.get("Vendor Form!C2"), "شركة قوة العمل للتجارة");
  assert.equal(after.get("Vendor Form!C3"), "1010757593");
  assert.equal(after.get("Vendor Form!C6"), "Al Olaya, Riyadh");
  assert.equal(after.get("Vendor Form!D9"), "new row too");
  assert.equal(after.get("Bank Details!B1"), "Saudi National Bank");
  assert.equal(after.get("Vendor Form!B2"), "Registered Legal Name:"); // untouched
  const styles = unzip(buf).get("xl/styles.xml").toString("utf8");
  assert.match(styles, /rgb="FF1F4ED8"/);
  assert.match(styles, /<fonts count="2"/);
  const sheet = unzip(buf).get("xl/worksheets/sheet1.xml").toString("utf8");
  assert.match(sheet, /<c r="C2" s="1" t="inlineStr">/);
});

/* ------------------------------------------------------------------- PDF -- */
function buildPdf(kind) {
  const bodies = new Map([
    [1, "<< /Type /Catalog /Pages 2 0 R /AcroForm << /Fields [5 0 R 6 0 R] /DA (/Helv 0 Tf 0 g) >> >>"],
    [2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>"],
    [3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Annots [5 0 R 6 0 R] >>"],
    [5, "<< /Type /Annot /Subtype /Widget /FT /Tx /T (company_name) /Rect [100 700 400 720] /P 3 0 R >>"],
    [6, "<< /Type /Annot /Subtype /Widget /FT /Btn /T (agree) /Rect [100 650 115 665] /P 3 0 R /V /Off /AS /Off /AP << /N << /Yes 8 0 R /Off 9 0 R >> >> >>"],
    [8, "<< /Type /XObject /Subtype /Form /BBox [0 0 15 15] /Length 0 >>\nstream\n\nendstream"],
    [9, "<< /Type /XObject /Subtype /Form /BBox [0 0 15 15] /Length 0 >>\nstream\n\nendstream"],
  ]);
  let out = "%PDF-1.6\n";
  const offsets = new Map();
  const emit = (id, body) => { offsets.set(id, out.length); out += `${id} 0 obj\n${body}\nendobj\n`; };
  if (kind === "objstm") {
    // objects 1,3,5,6 hidden inside a compressed object stream (id 4)
    const inStm = [1, 3, 5, 6];
    let header = "", payload = "";
    for (const id of inStm) { header += `${id} ${payload.length} `; payload += bodies.get(id) + " "; }
    const data = Buffer.from(header + payload, "latin1");
    const first = header.length;
    const flate = zlib.deflateSync(data);
    emit(4, `<< /Type /ObjStm /N ${inStm.length} /First ${first} /Length ${flate.length} /Filter /FlateDecode >>\nstream\n${flate.toString("latin1")}\nendstream`);
    for (const id of [2, 8, 9]) emit(id, bodies.get(id));
  } else {
    for (const [id, body] of bodies) emit(id, body);
  }
  if (kind === "classic") {
    const xrefAt = out.length;
    out += "xref\n0 10\n0000000000 65535 f \n";
    for (let id = 1; id <= 9; id++) out += offsets.has(id) ? `${String(offsets.get(id)).padStart(10, "0")} 00000 n \n` : "0000000000 65535 f \n";
    out += `trailer\n<< /Size 10 /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
    return Buffer.from(out, "latin1");
  }
  // xref stream ending (used by the "stream" and "objstm" variants)
  const xrefAt = out.length;
  const row = (type, off, gen) => { const b = Buffer.alloc(7); b[0] = type; b.writeUInt32BE(off, 1); b.writeUInt16BE(gen, 5); return b; };
  const rows = [row(0, 0, 65535)];
  for (let id = 1; id <= 9; id++) rows.push(offsets.has(id) ? row(1, offsets.get(id), 0) : row(0, 0, 65535));
  rows.push(row(1, xrefAt, 0));
  const stream = zlib.deflateSync(Buffer.concat(rows));
  return Buffer.concat([
    Buffer.from(out, "latin1"),
    Buffer.from(`10 0 obj\n<< /Type /XRef /Filter /FlateDecode /Length ${stream.length} /W [1 4 2] /Index [0 11] /Size 11 /Root 1 0 R >>\nstream\n`, "latin1"),
    stream,
    Buffer.from(`\nendstream\nendobj\nstartxref\n${xrefAt}\n%%EOF\n`, "latin1"),
  ]);
}
const utf16Hex = (s) => "<FEFF" + Buffer.from(s, "utf16le").swap16().toString("hex").toUpperCase() + ">";

for (const kind of ["classic", "stream", "objstm"]) {
  test(`pdf ${kind}: fields detected, filled incrementally, original bytes intact`, () => {
    const orig = buildPdf(kind);
    const fields = pdfFields(orig);
    assert.deepEqual(fields.map((f) => `${f.name}/${f.type}/${f.onState}`).sort(),
      ["agree/checkbox/Yes", "company_name/text/null"]);
    const arabic = "شركة قوة العمل للتجارة";
    const { buf, applied } = pdfFill(orig, { company_name: { text: arabic }, agree: { check: true } }, "1F4ED8");
    assert.deepEqual(applied.sort(), ["agree", "company_name"]);
    // incremental: the original file is an untouched prefix of the output
    assert.deepEqual(buf.slice(0, orig.length), orig);
    const tail = buf.slice(orig.length).toString("latin1");
    assert.ok(tail.includes(utf16Hex(arabic)), "UTF-16BE value written");
    assert.match(tail, /\/V \/Yes \/AS \/Yes/);
    assert.match(tail, /\/NeedAppearances true/);
    assert.match(tail, /\/Prev \d+/);
    assert.match(tail, kind === "classic" ? /trailer/ : /\/Type \/XRef/);
    // the update itself re-scans cleanly: latest definitions carry the values
    const again = pdfFields(buf);
    assert.equal(again.length, 2);
  });
}

test("pdf without any fields reports none (fill-sheet fallback)", () => {
  const flat = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\ntrailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n9\n%%EOF\n", "latin1");
  assert.deepEqual(pdfFields(flat), []);
});

/* ------------------------------------------- classification structure -- */
// The defect these cover: empty cells and empty runs do not exist in the file,
// so a blank form reaching the model looked like a list of labels and came
// back classified "source" — leaving the request at "0 forms to fill".
import { xlsxBlanks } from "../api/_xlsx.js";
import { formSignals } from "../api/_docagent.js";
import { parseJson } from "../api/_docread.js";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

test("xlsxBlanks finds a form's unanswered labels and skips answered ones", () => {
  const blanks = xlsxBlanks(makeXlsx());
  const byRef = new Map(blanks.map((b) => [`${b.sheet}!${b.ref}`, b]));
  assert.ok(byRef.has("Vendor Form!B2"), "legal-name label is a blank");
  assert.equal(byRef.get("Vendor Form!B2").next, "C2");
  assert.ok(byRef.has("Vendor Form!B3"), "CR label is a blank");
  assert.equal(byRef.get("Vendor Form!B6").next, null, "City already answered in C6 — not offered to the right");
});

test("formSignals flags a blank workbook as a form, and plain data as not", () => {
  const form = formSignals(makeXlsx(), XLSX_MIME);
  assert.equal(form.kind, "xlsx");
  assert.ok(form.score >= 3, `blank form must score >= 3, got ${form.score}`);
  assert.ok(form.lines[0].includes("اكتب في"), "each blank names the cell to write into");

  const valuesOnly = Buffer.from(`${XML}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Work Force Trading</t></is></c><c r="B1" t="inlineStr"><is><t>1010757593</t></is></c></row></sheetData></worksheet>`);
  const dataOnly = zip(new Map([...unzip(makeXlsx())].map(([k, v]) => [k, k.startsWith("xl/worksheets/") ? valuesOnly : v])));
  assert.equal(formSignals(dataOnly, XLSX_MIME).score, 0, "a sheet of values is not a form");
});

test("formSignals reads a fillable PDF as definitive", () => {
  const sig = formSignals(buildPdf("classic"), "application/pdf");
  assert.equal(sig.fields, 2);
  assert.ok(sig.score > 3, "AcroForm fields settle the classification");
});

test("parseJson salvages a plan the model cut short", () => {
  assert.equal(parseJson('{"ops":[{"node":1,"op":"append","text":"a"},{"node":2,"op":"append","text":"b"}]}').ops.length, 2);
  // truncated mid-value: the completed operations must survive
  const cut = parseJson('{"ops":[{"node":1,"op":"append","text":"a"},{"node":2,"op":"append","text":"شركة قوة الع');
  assert.ok(cut, "a cut-off plan still parses");
  assert.equal(cut.ops[0].text, "a", "the completed operation survives intact");
  assert.equal(cut.ops.filter((o) => o.text != null).length, 1, "the operation whose value was cut carries no text — the engine drops it");
  assert.equal(parseJson("not json at all"), null);
});

test("the blanks a form reports are exactly the cells the filler writes into", () => {
  // The contract between detection and filling: whatever xlsxBlanks names as
  // the place to write, xlsxApply must accept and land the value there —
  // otherwise the model is left guessing cell refs, which is how forms came
  // back empty.
  const book = makeXlsx();
  const blanks = xlsxBlanks(book).filter((b) => b.next);
  const answers = { "Registered Legal Name:": "شركة قوة العمل", "CR Number:": "1010757593" };
  const ops = blanks
    .filter((b) => answers[b.label])
    .map((b) => ({ sheet: b.sheet, ref: b.next, text: answers[b.label] }));
  assert.equal(ops.length, 2, "both answerable blanks produced an operation");

  const { buf, applied } = xlsxApply(book, ops, "1F4ED8");
  assert.equal(applied.length, 2);
  const after = new Map(xlsxCells(buf).map((c) => [`${c.sheet}!${c.ref}`, c.text]));
  for (const op of ops) assert.equal(after.get(`${op.sheet}!${op.ref}`), op.text);
  assert.equal(after.get("Vendor Form!B2"), "Registered Legal Name:", "labels untouched");
});
