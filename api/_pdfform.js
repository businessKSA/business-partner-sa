// Minimal AcroForm PDF filler for the AI Document Agent — no npm dependencies.
//
// Scope, chosen deliberately:
//   * Fillable PDFs (AcroForm text fields, checkboxes, combo boxes) are filled
//     natively: /V is written as UTF-16BE (Arabic-safe), NeedAppearances is
//     raised so viewers regenerate the field appearance, and everything is
//     appended as an INCREMENTAL UPDATE — the original bytes are never touched,
//     which is exactly the guarantee the agent gives about client forms.
//   * PDFs whose field objects live inside compressed object streams (ObjStm)
//     are invisible to this scanner; pdfFields() then returns [] and the
//     caller falls back to the fill-sheet path. Same for scanned/flat PDFs.
//
// Both classic xref tables and cross-reference streams are supported on the
// appended update, matching whichever style the original file ends with.
import zlib from "node:zlib";

const latin = (buf) => buf.toString("latin1");

// PDF string decoders for the /T field name.
function decodePdfString(tok) {
  if (tok.startsWith("<")) {
    const hex = tok.slice(1, -1).replace(/\s+/g, "");
    const bytes = Buffer.from(hex.length % 2 ? hex + "0" : hex, "hex");
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return bytes.slice(2).swap16().toString("utf16le");
    return bytes.toString("latin1");
  }
  let out = "";
  const s = tok.slice(1, -1);
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c !== "\\") { out += c; continue; }
    const n = s[++i];
    if (n === "n") out += "\n"; else if (n === "r") out += "\r"; else if (n === "t") out += "\t";
    else if (/[0-7]/.test(n)) { let oct = n; while (oct.length < 3 && /[0-7]/.test(s[i + 1] || "")) oct += s[++i]; out += String.fromCharCode(parseInt(oct, 8)); }
    else out += n;
  }
  if (out.charCodeAt(0) === 0xfeff) {
    const b = Buffer.from(out, "latin1");
    return b.slice(2).swap16().toString("utf16le");
  }
  return out;
}
const PDF_STR = /\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]*>/;
const utf16Hex = (s) => "<FEFF" + Buffer.from(String(s), "utf16le").swap16().toString("hex").toUpperCase() + ">";

// Scan every uncompressed "N G obj … endobj" in the file, keeping the LAST
// definition of each id (later incremental updates win), then unpack objects
// hidden inside /ObjStm compressed streams (Acrobat's default since PDF 1.5)
// so their fields are visible too. A plain-object definition always wins over
// an embedded one — appended updates are written as plain objects.
function scanObjects(src) {
  const objs = new Map();
  const re = /(\d+)\s+(\d+)\s+obj\b/g;
  let m;
  while ((m = re.exec(src))) {
    const bodyStart = m.index + m[0].length;
    const end = src.indexOf("endobj", bodyStart);
    if (end === -1) continue;
    objs.set(Number(m[1]), { id: Number(m[1]), gen: Number(m[2]), body: src.slice(bodyStart, end) });
    re.lastIndex = end + 6;
  }
  for (const o of [...objs.values()]) {
    if (!/\/Type\s*\/ObjStm\b/.test(o.body)) continue;
    const sm = /stream\r?\n/.exec(o.body);
    const first = /\/First\s+(\d+)/.exec(o.body);
    const count = /\/N\s+(\d+)/.exec(o.body);
    const lenM = /\/Length\s+(\d+)/.exec(o.body);
    if (!sm || !first || !count) continue;
    const rawStart = sm.index + sm[0].length;
    const rawEnd = lenM ? rawStart + Number(lenM[1]) : o.body.lastIndexOf("endstream");
    let data = Buffer.from(o.body.slice(rawStart, rawEnd).replace(/[\r\n]+$/, ""), "latin1");
    if (/\/Filter/.test(o.body)) {
      try { data = zlib.inflateSync(data); }
      catch { try { data = zlib.inflateRawSync(data); } catch { continue; } }
    }
    const firstAt = Number(first[1]);
    const header = data.slice(0, firstAt).toString("latin1").trim().split(/\s+/).map(Number);
    const text = data.toString("latin1");
    const n = Number(count[1]);
    for (let i = 0; i < n; i++) {
      const id = header[2 * i], off = header[2 * i + 1];
      if (!Number.isInteger(id) || !Number.isInteger(off) || objs.has(id)) continue;
      const nextOff = i + 1 < n ? header[2 * i + 3] : data.length - firstAt;
      objs.set(id, { id, gen: 0, body: text.slice(firstAt + off, firstAt + nextOff) });
    }
  }
  return objs;
}

const nameOf = (body) => {
  const t = new RegExp("/T\\s*(" + PDF_STR.source + ")").exec(body);
  return t ? decodePdfString(t[1]) : "";
};

// The checkbox "on" state: the /AP /N key that is not /Off.
function onStateOf(body) {
  const n = /\/N\s*<<([\s\S]{0,300}?)>>/.exec(body);
  if (!n) return null;
  for (const k of n[1].matchAll(/\/([^\s/<>[\]()]+)\s+\d+\s+\d+\s+R/g)) {
    if (k[1] !== "Off") return k[1];
  }
  return null;
}

/** All fillable fields visible in the file: [{name, type:"text"|"checkbox"|"choice", onState}] */
export function pdfFields(buf) {
  const src = latin(buf);
  // /AcroForm may itself live inside a compressed object stream — only bail
  // early when neither it nor any ObjStm is present at all.
  if (!src.includes("/AcroForm") && !src.includes("/ObjStm")) return [];
  const objs = scanObjects(src);
  const fields = [];
  for (const o of objs.values()) {
    const ft = /\/FT\s*\/(Tx|Btn|Ch)\b/.exec(o.body);
    if (!ft) continue;
    let name = nameOf(o.body);
    // one level of parent-qualified names (Parent carries /T, kid the widget)
    const parent = /\/Parent\s+(\d+)\s+\d+\s+R/.exec(o.body);
    if (parent && objs.has(Number(parent[1]))) {
      const pName = nameOf(objs.get(Number(parent[1])).body);
      if (pName) name = name ? `${pName}.${name}` : pName;
    }
    if (!name) continue;
    const flags = /\/Ff\s+(\d+)/.exec(o.body);
    const ff = flags ? Number(flags[1]) : 0;
    if (ft[1] === "Btn" && (ff & 0x10000)) continue; // pushbutton: nothing to fill
    fields.push({
      name, objId: o.id,
      type: ft[1] === "Tx" ? "text" : ft[1] === "Ch" ? "choice" : "checkbox",
      onState: ft[1] === "Btn" ? onStateOf(o.body) : null,
    });
  }
  return fields;
}

// Remove a dict entry whose value is a balanced << >> dict, a string, a name,
// an array, or an indirect reference. Used for /V, /AS, /AP, /DA rewrites.
function stripEntry(body, key) {
  const at = new RegExp("/" + key + "(?=[\\s/<([])").exec(body);
  if (!at) return body;
  let i = at.index + key.length + 1;
  while (/\s/.test(body[i])) i++;
  let end = i;
  if (body.startsWith("<<", i)) {
    let depth = 0;
    for (let p = i; p < body.length - 1; p++) {
      if (body.startsWith("<<", p)) { depth++; p++; }
      else if (body.startsWith(">>", p)) { depth--; p++; if (!depth) { end = p + 1; break; } }
    }
  } else if (body[i] === "(") {
    const m = PDF_STR.exec(body.slice(i)); end = i + (m ? m[0].length : 1);
  } else if (body[i] === "<") {
    end = body.indexOf(">", i) + 1;
  } else if (body[i] === "[") {
    let depth = 0;
    for (let p = i; p < body.length; p++) { if (body[p] === "[") depth++; else if (body[p] === "]") { depth--; if (!depth) { end = p + 1; break; } } }
  } else {
    const ref = /^(\d+)\s+(\d+)\s+R\b/.exec(body.slice(i));
    if (ref) end = i + ref[0].length;
    else { const m = /^\/?[^\s/<>[\]()]+/.exec(body.slice(i)); end = i + (m ? m[0].length : 1); }
  }
  return body.slice(0, at.index) + body.slice(end);
}
const insertAfterDictOpen = (body, entry) => {
  const at = body.indexOf("<<");
  return at === -1 ? body : body.slice(0, at + 2) + " " + entry + " " + body.slice(at + 2);
};

// hex "1F4ED8" → "0.122 0.306 0.847 rg"
const rgOf = (hex) => !hex ? "" : ["", "", ""].map((_, i) => (parseInt(hex.slice(i * 2, i * 2 + 2), 16) / 255).toFixed(3)).join(" ") + " rg";

function lastMatch(re, s) {
  let m, last = null;
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  while ((m = g.exec(s))) last = m;
  return last;
}

/**
 * Fill fields as an incremental update.
 * values: { fieldName: {text:"…"} | {check:true} | {check:false} }
 * colorHex: "1F4ED8" for the agent's blue ink, "" to keep each field's style.
 * Returns { buf, applied:[names] }; throws only on a structurally unusable PDF.
 */
export function pdfFill(buf, values, colorHex) {
  const src = latin(buf);
  const objs = scanObjects(src);
  const fields = pdfFields(buf);
  const rootM = lastMatch(/\/Root\s+(\d+)\s+\d+\s+R/, src);
  const startxrefM = lastMatch(/startxref\s+(\d+)/, src);
  if (!rootM || !startxrefM) throw new Error("pdf_no_trailer");
  const updates = new Map(); // id → new body
  const applied = [];

  for (const f of fields) {
    const want = values[f.name];
    if (!want) continue;
    const obj = objs.get(f.objId);
    if (!obj) continue;
    let body = obj.body;
    if (f.type === "checkbox") {
      if (want.check === undefined || !f.onState) continue;
      const state = want.check ? "/" + f.onState : "/Off";
      body = stripEntry(stripEntry(body, "V"), "AS");
      body = insertAfterDictOpen(body, `/V ${state} /AS ${state}`);
    } else {
      if (want.text == null) continue;
      body = stripEntry(stripEntry(body, "V"), "AP"); // stale appearance goes; NeedAppearances redraws
      if (colorHex) {
        body = stripEntry(body, "DA");
        body = insertAfterDictOpen(body, `/DA (/Helv 0 Tf ${rgOf(colorHex)})`);
      }
      body = insertAfterDictOpen(body, `/V ${utf16Hex(String(want.text).slice(0, 500))}`);
    }
    updates.set(f.objId, { gen: obj.gen, body });
    applied.push(f.name);
  }
  if (!applied.length) return { buf, applied };

  // NeedAppearances on the AcroForm dict (its own object, or inline in Root).
  const rootId = Number(rootM[1]);
  const rootObj = objs.get(rootId);
  const acroRef = rootObj && /\/AcroForm\s+(\d+)\s+\d+\s+R/.exec(rootObj.body);
  const naTarget = acroRef ? Number(acroRef[1]) : rootId;
  const naObj = objs.get(naTarget);
  if (naObj) {
    let body = updates.get(naTarget) ? updates.get(naTarget).body : naObj.body;
    if (/\/NeedAppearances\s+(true|false)/.test(body)) body = body.replace(/\/NeedAppearances\s+(true|false)/, "/NeedAppearances true");
    else if (acroRef) body = insertAfterDictOpen(body, "/NeedAppearances true");
    else body = body.replace(/\/AcroForm\s*<</, "/AcroForm << /NeedAppearances true ");
    updates.set(naTarget, { gen: naObj.gen, body });
  }

  // ---- serialize the incremental update -----------------------------------
  const prevStart = Number(startxrefM[1]);
  const sizeM = lastMatch(/\/Size\s+(\d+)/, src);
  const prevSize = sizeM ? Number(sizeM[1]) : Math.max(...updates.keys()) + 1;
  const ids = [...updates.keys()].sort((a, b) => a - b);
  let tail = src.endsWith("\n") ? "" : "\n";
  const offsets = new Map();
  for (const id of ids) {
    const u = updates.get(id);
    offsets.set(id, buf.length + tail.length);
    tail += `${id} ${u.gen} obj\n${u.body.trim()}\nendobj\n`;
  }
  const runsOf = (list) => {
    const runs = [];
    for (const id of list) {
      const r = runs[runs.length - 1];
      if (r && id === r[0] + r[1]) r[1]++;
      else runs.push([id, 1]);
    }
    return runs;
  };
  const rootRef = rootM[0].replace(/^\/Root\s+/, "");
  const usesClassicXref = /(^|[\r\n])\s*trailer\b/.test(src.slice(Math.max(0, prevStart - 2)));

  if (usesClassicXref) {
    const xrefAt = buf.length + tail.length;
    tail += "xref\n";
    for (const [start, count] of runsOf(ids)) {
      tail += `${start} ${count}\n`;
      for (let i = 0; i < count; i++) {
        const id = start + i;
        tail += `${String(offsets.get(id)).padStart(10, "0")} ${String(updates.get(id).gen).padStart(5, "0")} n \n`;
      }
    }
    tail += `trailer\n<< /Size ${Math.max(prevSize, ids[ids.length - 1] + 1)} /Root ${rootRef} /Prev ${prevStart} >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  } else {
    // The original ends in a cross-reference stream: the update must too.
    const xrefId = Math.max(prevSize, ids[ids.length - 1] + 1);
    const xrefAt = buf.length + tail.length;
    const allIds = [...ids, xrefId];
    const rows = [];
    for (const id of allIds) {
      const off = id === xrefId ? xrefAt : offsets.get(id);
      const row = Buffer.alloc(7);
      row[0] = 1; row.writeUInt32BE(off, 1); row.writeUInt16BE(0, 5);
      rows.push(row);
    }
    const stream = zlib.deflateSync(Buffer.concat(rows));
    const index = runsOf(allIds).map(([s, c]) => `${s} ${c}`).join(" ");
    tail += `${xrefId} 0 obj\n<< /Type /XRef /Filter /FlateDecode /Length ${stream.length} /W [1 4 2] /Index [${index}] /Size ${xrefId + 1} /Root ${rootRef} /Prev ${prevStart} >>\nstream\n`;
    const head = Buffer.from(tail, "latin1");
    const foot = Buffer.from(`\nendstream\nendobj\nstartxref\n${xrefAt}\n%%EOF\n`, "latin1");
    return { buf: Buffer.concat([buf, head, stream, foot]), applied };
  }
  return { buf: Buffer.concat([buf, Buffer.from(tail, "latin1")]), applied };
}
