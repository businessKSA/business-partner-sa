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
import { pdfImage } from "./_img.js";

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
    const rect = /\/Rect\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/.exec(o.body);
    fields.push({
      name, objId: o.id,
      type: ft[1] === "Tx" ? "text" : ft[1] === "Ch" ? "choice" : "checkbox",
      onState: ft[1] === "Btn" ? onStateOf(o.body) : null,
      rect: rect ? rect.slice(1, 5).map(Number) : null,
      pageRef: (/\/P\s+(\d+)\s+\d+\s+R/.exec(o.body) || [])[1] || null,
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

  return serializeUpdate(buf, src, updates, rootM, startxrefM, applied);
}

/**
 * Append `updates` (id → {gen, body}) to `buf` as a PDF incremental update,
 * matching whichever cross-reference style the original file ends with.
 * The original bytes are never rewritten — that is the guarantee the agent
 * gives about a client's own form.
 */
export function serializeUpdate(buf, src, updates, rootM, startxrefM, applied) {
  const prevStart = Number(startxrefM[1]);
  const sizeM = lastMatch(/\/Size\s+(\d+)/, src);
  const prevSize = sizeM ? Number(sizeM[1]) : Math.max(...updates.keys()) + 1;
  const ids = [...updates.keys()].sort((a, b) => a - b);

  // One growing byte list, so an object carrying a binary stream (an embedded
  // signature image) never has to survive a latin1 round-trip.
  const parts = [];
  let at = buf.length;
  const put = (b) => { const x = Buffer.isBuffer(b) ? b : Buffer.from(b, "latin1"); parts.push(x); at += x.length; };
  if (!src.endsWith("\n")) put("\n");

  const offsets = new Map();
  for (const id of ids) {
    const u = updates.get(id);
    offsets.set(id, at);
    put(`${id} ${u.gen} obj\n${u.body.trim()}\n`);
    if (u.stream) { put("stream\n"); put(u.stream); put("\nendstream\n"); }
    put("endobj\n");
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
  const xrefAt = at;

  if (usesClassicXref) {
    let tail = "xref\n";
    for (const [start, count] of runsOf(ids)) {
      tail += `${start} ${count}\n`;
      for (let i = 0; i < count; i++) {
        const id = start + i;
        tail += `${String(offsets.get(id)).padStart(10, "0")} ${String(updates.get(id).gen).padStart(5, "0")} n \n`;
      }
    }
    tail += `trailer\n<< /Size ${Math.max(prevSize, ids[ids.length - 1] + 1)} /Root ${rootRef} /Prev ${prevStart} >>\nstartxref\n${xrefAt}\n%%EOF\n`;
    put(tail);
    return { buf: Buffer.concat([buf, ...parts]), applied };
  }

  // The original ends in a cross-reference stream: the update must too.
  const xrefId = Math.max(prevSize, ids[ids.length - 1] + 1);
  const allIds = [...ids, xrefId];
  const rows = allIds.map((id) => {
    const row = Buffer.alloc(7);
    row[0] = 1; row.writeUInt32BE(id === xrefId ? xrefAt : offsets.get(id), 1); row.writeUInt16BE(0, 5);
    return row;
  });
  const stream = zlib.deflateSync(Buffer.concat(rows));
  const index = runsOf(allIds).map(([s2, c]) => `${s2} ${c}`).join(" ");
  put(`${xrefId} 0 obj\n<< /Type /XRef /Filter /FlateDecode /Length ${stream.length} /W [1 4 2] /Index [${index}] /Size ${xrefId + 1} /Root ${rootRef} /Prev ${prevStart} >>\nstream\n`);
  put(stream);
  put(`\nendstream\nendobj\nstartxref\n${xrefAt}\n%%EOF\n`);
  return { buf: Buffer.concat([buf, ...parts]), applied };
}

// ---------------------------------------------------------------------------
// Signature and stamp images
// ---------------------------------------------------------------------------

/** Page object ids in document order, walked from the catalog's /Pages tree. */
function pageIds(objs, rootId) {
  const root = objs.get(rootId);
  const pagesRef = root && /\/Pages\s+(\d+)\s+\d+\s+R/.exec(root.body);
  const out = [];
  const seen = new Set();
  const walk = (id) => {
    if (seen.has(id) || out.length > 500) return;
    seen.add(id);
    const o = objs.get(id);
    if (!o) return;
    if (/\/Type\s*\/Page\b/.test(o.body) && !/\/Type\s*\/Pages\b/.test(o.body)) { out.push(id); return; }
    const kids = /\/Kids\s*\[([\s\S]*?)\]/.exec(o.body);
    if (!kids) return;
    for (const k of kids[1].matchAll(/(\d+)\s+\d+\s+R/g)) walk(Number(k[1]));
  };
  if (pagesRef) walk(Number(pagesRef[1]));
  // Fall back to file order when the tree is unreadable (linearised oddities).
  if (!out.length) {
    for (const o of objs.values()) {
      if (/\/Type\s*\/Page\b/.test(o.body) && !/\/Type\s*\/Pages\b/.test(o.body)) out.push(o.id);
    }
    out.sort((a, b) => a - b);
  }
  return out;
}

const pageMediaBox = (objs, id) => {
  let cur = id, hops = 0;
  while (cur && hops++ < 8) {
    const o = objs.get(cur);
    if (!o) break;
    const mb = /\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/.exec(o.body);
    if (mb) return mb.slice(1, 5).map(Number);
    const parent = /\/Parent\s+(\d+)\s+\d+\s+R/.exec(o.body);
    cur = parent ? Number(parent[1]) : null;
  }
  return [0, 0, 595.28, 841.89]; // A4
};

/**
 * Draw images onto a PDF as an incremental update.
 *
 * placements: [{ image: Buffer, page?: number (1-based), field?: string,
 *                x?, y?, width?, height? }]
 * A `field` places the image inside that AcroForm widget's rectangle; otherwise
 * x/y are PDF user-space points from the bottom-left of the page. Aspect ratio
 * is always preserved — a stretched signature reads as a forgery.
 *
 * Returns { buf, applied:[label] }.
 */
export function pdfStamp(buf, placements) {
  const src = latin(buf);
  const objs = scanObjects(src);
  const rootM = lastMatch(/\/Root\s+(\d+)\s+\d+\s+R/, src);
  const startxrefM = lastMatch(/startxref\s+(\d+)/, src);
  if (!rootM || !startxrefM) throw new Error("pdf_no_trailer");

  const pages = pageIds(objs, Number(rootM[1]));
  if (!pages.length) throw new Error("pdf_no_pages");
  const fields = pdfFields(buf);
  const sizeM = lastMatch(/\/Size\s+(\d+)/, src);
  let nextId = Math.max(sizeM ? Number(sizeM[1]) : 0, ...objs.keys()) + 1;

  const updates = new Map();
  const applied = [];
  const perPage = new Map(); // pageId → { ops:[], xobjects:[[name,id]] }

  for (const pl of placements) {
    let img;
    try { img = pdfImage(pl.image); } catch { continue; }

    // Where does it go?
    let pageId = null, box = null;
    const f = pl.field && fields.find((x) => x.name === pl.field && x.rect);
    if (f) {
      if (f.pageRef && objs.has(Number(f.pageRef))) pageId = Number(f.pageRef);
      const [x0, y0, x1, y1] = f.rect;
      box = { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
      // A widget with no /P: find the page whose /Annots names this widget.
      if (!pageId) {
        for (const id of pages) {
          const o = objs.get(id);
          if (o && new RegExp(`\\b${f.objId}\\s+\\d+\\s+R`).test(o.body)) { pageId = id; break; }
        }
      }
    }
    if (!pageId) {
      const n = Math.min(Math.max(1, Number(pl.page) || 1), pages.length);
      pageId = pages[n - 1];
    }
    const [mx0, my0, mx1, my1] = pageMediaBox(objs, pageId);
    const pw = Math.abs(mx1 - mx0), ph = Math.abs(my1 - my0);
    if (!box) {
      const w = Number(pl.width) || 120;
      box = { x: Number(pl.x) || 0, y: Number(pl.y) || 0, w, h: Number(pl.height) || w };
    }

    // Fit inside the box, keeping the image's own proportions.
    const scale = Math.min(box.w / img.w, box.h / img.h);
    const dw = img.w * scale, dh = img.h * scale;
    const dx = mx0 + box.x + (box.w - dw) / 2;
    const dy = my0 + box.y + (box.h - dh) / 2;
    if (dw <= 0 || dh <= 0 || dx > mx0 + pw || dy > my0 + ph) continue;

    // Image XObject (+ its soft mask, when the PNG carried alpha).
    let smaskId = null;
    if (img.smask) {
      smaskId = nextId++;
      updates.set(smaskId, {
        gen: 0,
        body: `<< /Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} ` +
              `/ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${img.smask.length} >>`,
        stream: img.smask,
      });
    }
    const imgId = nextId++;
    updates.set(imgId, {
      gen: 0,
      body: `<< /Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} ` +
            `/ColorSpace ${img.colorSpace} /BitsPerComponent ${img.bits} /Filter ${img.filter} ` +
            (smaskId ? `/SMask ${smaskId} 0 R ` : "") + `/Length ${img.data.length} >>`,
      stream: img.data,
    });

    const slot = perPage.get(pageId) || { ops: [], xobjects: [] };
    const name = `BPSig${imgId}`;
    slot.xobjects.push([name, imgId]);
    slot.ops.push(`q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${dx.toFixed(2)} ${dy.toFixed(2)} cm /${name} Do Q`);
    perPage.set(pageId, slot);
    applied.push(pl.field || pl.label || `page${pages.indexOf(pageId) + 1}`);
  }

  if (!applied.length) return { buf, applied };

  for (const [pageId, slot] of perPage) {
    const page = objs.get(pageId);
    if (!page) continue;
    let body = updates.get(pageId) ? updates.get(pageId).body : page.body;

    // 1. The drawing operators, as a new content stream appended to the page.
    const content = Buffer.from("\n" + slot.ops.join("\n") + "\n", "latin1");
    const contentId = nextId++;
    updates.set(contentId, { gen: 0, body: `<< /Length ${content.length} >>`, stream: content });

    const cm = /\/Contents\s+(\d+)\s+\d+\s+R/.exec(body);
    const cArr = /\/Contents\s*\[([\s\S]*?)\]/.exec(body);
    if (cArr) {
      body = body.slice(0, cArr.index) + `/Contents [${cArr[1].trim()} ${contentId} 0 R]` +
             body.slice(cArr.index + cArr[0].length);
    } else if (cm) {
      body = body.slice(0, cm.index) + `/Contents [${cm[1]} 0 R ${contentId} 0 R]` +
             body.slice(cm.index + cm[0].length);
    } else {
      body = insertAfterDictOpen(body, `/Contents [${contentId} 0 R]`);
    }

    // 2. Name the XObjects in the page's resource dictionary. An inherited or
    //    indirect /Resources is replaced by a page-local one that re-states it,
    //    so a shared dict is never mutated under the other pages.
    const entries = slot.xobjects.map(([n, id]) => `/${n} ${id} 0 R`).join(" ");
    const resInline = /\/Resources\s*<</.exec(body);
    const resRef = /\/Resources\s+(\d+)\s+\d+\s+R/.exec(body);
    if (resInline) {
      const xoInline = /\/XObject\s*<</.exec(body);
      const xoRef = /\/XObject\s+(\d+)\s+\d+\s+R/.exec(body);
      if (xoInline) {
        body = body.slice(0, xoInline.index + xoInline[0].length) + " " + entries +
               body.slice(xoInline.index + xoInline[0].length);
      } else if (xoRef && objs.has(Number(xoRef[1]))) {
        const xo = objs.get(Number(xoRef[1]));
        const xb = updates.get(xo.id) ? updates.get(xo.id).body : xo.body;
        updates.set(xo.id, { gen: xo.gen, body: insertAfterDictOpen(xb, entries) });
      } else {
        body = body.slice(0, resInline.index + resInline[0].length) + ` /XObject << ${entries} >>` +
               body.slice(resInline.index + resInline[0].length);
      }
    } else if (resRef && objs.has(Number(resRef[1]))) {
      const shared = objs.get(Number(resRef[1])).body.trim().replace(/^<<|>>$/g, "");
      body = body.slice(0, resRef.index) + `/Resources << ${shared} /XObject << ${entries} >> >>` +
             body.slice(resRef.index + resRef[0].length);
    } else {
      body = insertAfterDictOpen(body, `/Resources << /XObject << ${entries} >> >>`);
    }

    updates.set(pageId, { gen: page.gen, body });
  }

  return serializeUpdate(buf, src, updates, rootM, startxrefM, applied);
}
