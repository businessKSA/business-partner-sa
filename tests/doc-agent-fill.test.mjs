// Unit tests for the AI Document Agent's in-place fill engines:
//   * api/_xlsx.js    — Excel cells written as blue inline strings
//   * api/_pdfform.js — AcroForm /V values via incremental update
//   * api/_img.js     — PNG/JPEG decoded for signature & stamp embedding
// Pure node:test, no dependencies — `npm test` runs them anywhere.
import test from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { zip, unzip } from "../api/_zip.js";
import { xlsxCells, xlsxApply, parseRef } from "../api/_xlsx.js";
import { pdfFields, pdfFill, pdfStamp } from "../api/_pdfform.js";
import { pdfImage, imageSize } from "../api/_img.js";
import { docxPlaceImages, xlsxPlaceImages } from "../api/_ooxmlimg.js";

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

/* --------------------------------------------- legal declaration guard -- */
import { declarationUnlocked } from "../api/_docagent.js";

test("a confirmation unlocks its own declaration and no other", () => {
  const confirmed = [{ fact_key: "declarations.pep_status", value: "Not a PEP" }];
  assert.equal(declarationUnlocked("Are you a PEP?", "No", confirmed, true), true, "the confirmed subject is fillable");
  assert.equal(declarationUnlocked("Anti-Bribery (ABAC) declaration", "No", confirmed, true), false,
    "confirming PEP must not sign the bribery declaration");
  assert.equal(declarationUnlocked("Any sanctions against you?", "No", confirmed, true), false);
  assert.equal(declarationUnlocked("Are you a PEP?", "No", [], true), false, "nothing is signed without a confirmation");
  assert.equal(declarationUnlocked("Company name", "Work Force Trading", [], false), true, "ordinary fields are unaffected");
  assert.equal(declarationUnlocked("Declaration", "I confirm", confirmed, true), false,
    "a sensitive field with no identifiable subject is refused, not guessed");
});

/* ------------------------------------------------- signature & stamp images -- */

// A minimal PNG encoder, so the decoder is tested against bytes this file
// produced rather than a checked-in blob nobody can read.
function makePng(w, h, px, colorType = 6) {
  const samples = colorType === 6 ? 4 : 3;
  const rowBytes = w * samples;
  const raw = Buffer.alloc(h * (1 + rowBytes));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + rowBytes)] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const o = y * (1 + rowBytes) + 1 + x * samples;
      const [r, g, b, a] = px(x, y);
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
      if (colorType === 6) raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = colorType;
  const tbl = [...Array(256)].map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xFFFFFFFF; for (const v of b) c = tbl[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const chunk = (t, d) => {
    const l = Buffer.alloc(4); l.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(t, "latin1"), d]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([l, td, c]);
  };
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
  ]);
}

test("png with alpha decodes to exact RGB plus a separate soft mask", () => {
  // x drives red, y drives green, column 0 is fully transparent.
  const src = makePng(4, 3, (x, y) => [x * 60, y * 80, 10, x === 0 ? 0 : 255]);
  assert.deepEqual(imageSize(src), { kind: "png", w: 4, h: 3 });

  const img = pdfImage(src);
  assert.equal(img.filter, "/FlateDecode");
  assert.equal(img.colorSpace, "/DeviceRGB");
  assert.ok(img.smask, "alpha channel split into an /SMask");

  const rgb = zlib.inflateSync(img.data);
  const alpha = zlib.inflateSync(img.smask);
  assert.equal(rgb.length, 4 * 3 * 3);
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 4; x++) {
      const o = (y * 4 + x) * 3;
      assert.deepEqual([rgb[o], rgb[o + 1], rgb[o + 2]], [x * 60, y * 80, 10], `pixel ${x},${y}`);
      assert.equal(alpha[y * 4 + x], x === 0 ? 0 : 255, `alpha ${x},${y}`);
    }
  }
});

test("opaque png carries no soft mask", () => {
  const img = pdfImage(makePng(2, 2, () => [1, 2, 3], 2));
  assert.equal(img.smask, null);
});

test("jpeg passes through as DCTDecode at its own dimensions", () => {
  // SOI, APP0, SOF0 (3 components, 7x11), EOI — enough for the size probe.
  const jpg = Buffer.from([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x0b, 0x00, 0x07, 0x03,
    0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    0xff, 0xd9,
  ]);
  const img = pdfImage(jpg);
  assert.equal(img.filter, "/DCTDecode");
  assert.equal(img.colorSpace, "/DeviceRGB");
  assert.deepEqual([img.w, img.h], [7, 11]);
  assert.deepEqual(img.data, jpg, "original JPEG bytes embedded untouched");
});

for (const kind of ["classic", "stream", "objstm"]) {
  test(`pdf ${kind}: signature lands in its field, original bytes intact`, () => {
    const orig = buildPdf(kind);
    const sig = makePng(20, 10, (x) => [0, 0, 0, x < 10 ? 255 : 0]);
    const { buf, applied } = pdfStamp(orig, [{ image: sig, field: "company_name" }]);

    assert.deepEqual(applied, ["company_name"]);
    assert.deepEqual(buf.slice(0, orig.length), orig, "incremental: original is an untouched prefix");

    const tail = buf.slice(orig.length).toString("latin1");
    assert.match(tail, /\/Subtype \/Image/);
    assert.match(tail, /\/SMask \d+ 0 R/, "transparency preserved");
    assert.match(tail, /\/XObject << \/BPSig\d+ \d+ 0 R/);
    assert.match(tail, /\/BPSig\d+ Do/, "drawn by the appended content stream");
    assert.match(tail, /\/Contents \[/, "appended to the page's content array");
    assert.match(tail, kind === "classic" ? /trailer/ : /\/Type \/XRef/);

    // Placed inside the widget rect [100 700 400 720] and never stretched:
    // 20x10 fitted into 300x20 is 40x20, centred.
    const cm = /q ([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm/.exec(tail);
    assert.ok(cm, "a placement matrix was written");
    const [w, h, x, y] = cm.slice(1, 5).map(Number);
    assert.equal((w / h).toFixed(2), "2.00", "aspect ratio preserved");
    assert.ok(x >= 100 && x + w <= 400, `x ${x} w ${w} inside the field`);
    assert.ok(y >= 700 && y + h <= 720, `y ${y} h ${h} inside the field`);

    // The stamped file still re-scans as a valid form.
    assert.equal(pdfFields(buf).length, 2);
  });
}

test("stamp falls back to explicit page coordinates when no field is named", () => {
  const orig = buildPdf("classic");
  const stamp = makePng(30, 30, () => [10, 20, 30, 255]);
  const { buf, applied } = pdfStamp(orig, [{ image: stamp, page: 1, x: 40, y: 60, width: 90, height: 90, label: "stamp" }]);
  assert.deepEqual(applied, ["stamp"]);
  const tail = buf.slice(orig.length).toString("latin1");
  const cm = /q ([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm/.exec(tail);
  assert.deepEqual(cm.slice(1, 5).map(Number), [90, 90, 40, 60]);
});

test("stamping is a no-op on an unreadable image rather than a corrupt file", () => {
  const orig = buildPdf("classic");
  const { buf, applied } = pdfStamp(orig, [{ image: Buffer.from("not an image"), field: "company_name" }]);
  assert.deepEqual(applied, []);
  assert.deepEqual(buf, orig, "the client's file comes back byte-identical");
});

/* ------------------------------------------------ signature in docx / xlsx -- */

const CT_BASE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/></Types>`;

test("docx: signature lands in the paragraph that asks for it, wired end to end", () => {
  const doc = `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:body><w:p><w:r><w:t>Company Name: Qowa Trading</w:t></w:r></w:p>` +
    `<w:p><w:r><w:t>Authorised Signature:</w:t></w:r></w:p>` +
    `<w:p><w:r><w:t>Date</w:t></w:r></w:p></w:body></w:document>`;
  const entries = new Map([
    ["[Content_Types].xml", Buffer.from(CT_BASE, "utf8")],
    ["word/document.xml", Buffer.from(doc, "utf8")],
    ["word/_rels/document.xml.rels", Buffer.from(
      `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="x" Target="styles.xml"/></Relationships>`, "utf8")],
  ]);
  const sig = makePng(200, 80, () => [0, 0, 0, 255]);
  const { xml, applied } = docxPlaceImages(entries, doc, [
    { image: sig, mime: "image/png", widthPt: 120, afterText: "Authorised Signature", label: "signature" },
  ]);
  assert.deepEqual(applied, ["signature"]);

  // The media part, the relationship and the content type all exist.
  assert.ok(entries.has("word/media/bp_sig1.png"), "image part added");
  assert.deepEqual(entries.get("word/media/bp_sig1.png"), sig, "original image bytes");
  const rels = entries.get("word/_rels/document.xml.rels").toString("utf8");
  const rid = /Id="(rId\d+)"[^>]*Target="media\/bp_sig1\.png"/.exec(rels);
  assert.ok(rid, "relationship written");
  assert.notEqual(rid[1], "rId1", "a fresh id, not one already in use");
  assert.match(entries.get("[Content_Types].xml").toString("utf8"), /Extension="png"/);

  // The drawing references that same relationship, at the right size and place.
  assert.ok(xml.includes(`r:embed="${rid[1]}"`), "drawing points at the new image");
  assert.match(xml, /cx="1524000" cy="609600"/); // 120pt wide, 200x80 → 48pt tall
  const sigPara = xml.indexOf("Authorised Signature");
  const drawAt = xml.indexOf("<w:drawing>");
  assert.ok(drawAt > sigPara, "placed after the signature label");
  assert.ok(drawAt < xml.indexOf("<w:t>Date</w:t>"), "and before the next paragraph");
});

test("docx: with no anchor text the image is appended inside the body", () => {
  const doc = `<w:document xmlns:w="w"><w:body><w:p><w:r><w:t>x</w:t></w:r></w:p></w:body></w:document>`;
  const entries = new Map([["[Content_Types].xml", Buffer.from(CT_BASE, "utf8")]]);
  const { xml } = docxPlaceImages(entries, doc, [{ image: makePng(10, 10, () => [0, 0, 0, 255]), mime: "image/png" }]);
  assert.ok(xml.indexOf("<w:drawing>") < xml.indexOf("</w:body>"), "still inside the body");
  assert.match(xml, /<\/w:drawing><\/w:r><\/w:p><\/w:body>/);
});

test("xlsx: signature anchors to its cell and builds the whole drawing chain", () => {
  const entries = new Map([
    ["[Content_Types].xml", Buffer.from(CT_BASE, "utf8")],
    ["xl/worksheets/sheet1.xml", Buffer.from(
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/></worksheet>`, "utf8")],
  ]);
  const sig = makePng(300, 100, () => [0, 0, 0, 255]);
  const { applied } = xlsxPlaceImages(entries, [
    { image: sig, mime: "image/png", ref: "C12", widthPt: 100, label: "signature" },
  ]);
  assert.deepEqual(applied, ["signature"]);

  const sheet = entries.get("xl/worksheets/sheet1.xml").toString("utf8");
  const drawRid = /<drawing r:id="(rId\d+)"\/>/.exec(sheet);
  assert.ok(drawRid, "sheet references a drawing");
  assert.ok(sheet.indexOf("<drawing") < sheet.indexOf("</worksheet>"));
  assert.match(sheet, /xmlns:r=/, "the r: prefix the drawing element needs is declared");

  const sheetRels = entries.get("xl/worksheets/_rels/sheet1.xml.rels").toString("utf8");
  assert.match(sheetRels, new RegExp(`Id="${drawRid[1]}"[^>]*relationships/drawing"`), "typed as a drawing, not an image");

  const drawing = entries.get("xl/drawings/drawing1.xml").toString("utf8");
  assert.match(drawing, /<xdr:col>2<\/xdr:col>/); // C → 0-based 2
  assert.match(drawing, /<xdr:row>11<\/xdr:row>/); // 12 → 0-based 11
  assert.match(drawing, /cx="1270000" cy="423333"/); // 100pt wide, 3:1
  const imgRid = /r:embed="(rId\d+)"/.exec(drawing);
  const drawRels = entries.get("xl/drawings/_rels/drawing1.xml.rels").toString("utf8");
  assert.match(drawRels, new RegExp(`Id="${imgRid[1]}"[^>]*Target="\\.\\./media/bp_sig1\\.png"`));
  assert.deepEqual(entries.get("xl/media/bp_sig1.png"), sig);
  assert.match(entries.get("[Content_Types].xml").toString("utf8"), /PartName="\/xl\/drawings\/drawing1\.xml"/);
});

test("xlsx: a second image reuses the sheet's existing drawing part", () => {
  const entries = new Map([
    ["[Content_Types].xml", Buffer.from(CT_BASE, "utf8")],
    ["xl/worksheets/sheet1.xml", Buffer.from(`<worksheet xmlns:r="r"><sheetData/></worksheet>`, "utf8")],
  ]);
  const img = makePng(10, 10, () => [0, 0, 0, 255]);
  xlsxPlaceImages(entries, [{ image: img, mime: "image/png", ref: "A1", label: "sig" }]);
  xlsxPlaceImages(entries, [{ image: img, mime: "image/png", ref: "B2", label: "stamp" }]);
  assert.ok(!entries.has("xl/drawings/drawing2.xml"), "no second drawing part");
  const drawing = entries.get("xl/drawings/drawing1.xml").toString("utf8");
  assert.equal((drawing.match(/<xdr:oneCellAnchor>/g) || []).length, 2, "both anchors in one part");
  const sheet = entries.get("xl/worksheets/sheet1.xml").toString("utf8");
  assert.equal((sheet.match(/<drawing /g) || []).length, 1, "sheet still names one drawing");
});
