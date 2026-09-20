// Placing a client's signature or company stamp into Word and Excel files.
//
// Both formats are ZIP containers of XML parts, so an image is never "drawn":
// it is added as a part, wired to the document through a relationship, declared
// in [Content_Types].xml, and referenced by a drawing element. Everything else
// in the file — the client's own layout, fonts and content — is left untouched.
import { imageSize } from "./_img.js";

const EMU_PER_PT = 12700; // 914400 EMU per inch ÷ 72 pt per inch
const A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
const R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const IMG_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";

const escXml = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const extOf = (mime, name = "") => {
  const m = String(mime || "").toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpeg";
  const e = (name.split(".").pop() || "").toLowerCase();
  return e === "jpg" || e === "jpeg" ? "jpeg" : "png";
};
const mimeOf = (ext) => (ext === "jpeg" ? "image/jpeg" : "image/png");

/** Scale an image to `widthPt` points wide, keeping its proportions. */
function emuBox(image, widthPt) {
  const { w, h } = imageSize(image);
  const cx = Math.round(widthPt * EMU_PER_PT);
  return { cx, cy: Math.max(1, Math.round((cx * h) / Math.max(1, w))) };
}

// A fresh rIdN for a relationships part, avoiding every id already in it.
function nextRelId(xml) {
  let max = 0;
  for (const m of xml.matchAll(/Id="rId(\d+)"/g)) max = Math.max(max, Number(m[1]));
  return `rId${max + 1}`;
}

function addRel(entries, relPath, target) {
  const cur = entries.has(relPath)
    ? entries.get(relPath).toString("utf8")
    : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${R_NS}"/>`;
  const id = nextRelId(cur);
  const rel = `<Relationship Id="${id}" Type="${IMG_REL}" Target="${escXml(target)}"/>`;
  const next = cur.includes("</Relationships>")
    ? cur.replace("</Relationships>", rel + "</Relationships>")
    : cur.replace(/<Relationships([^>]*)\/>/, `<Relationships$1>${rel}</Relationships>`);
  entries.set(relPath, Buffer.from(next, "utf8"));
  return id;
}

// [Content_Types].xml must know the extension, or Word/Excel calls the file corrupt.
function ensureDefault(entries, ext) {
  const path = "[Content_Types].xml";
  let xml = entries.get(path)?.toString("utf8");
  if (!xml) return;
  if (new RegExp(`Extension="${ext}"`, "i").test(xml)) return;
  entries.set(path, Buffer.from(
    xml.replace("<Types", "<Types").replace(/(<Types[^>]*>)/, `$1<Default Extension="${ext}" ContentType="${mimeOf(ext)}"/>`),
    "utf8"));
}
function ensureOverride(entries, partName, contentType) {
  const path = "[Content_Types].xml";
  let xml = entries.get(path)?.toString("utf8");
  if (!xml || xml.includes(`PartName="${partName}"`)) return;
  entries.set(path, Buffer.from(
    xml.replace("</Types>", `<Override PartName="${partName}" ContentType="${contentType}"/></Types>`), "utf8"));
}

const freeName = (entries, dir, base, ext) => {
  let n = 1;
  while (entries.has(`${dir}/${base}${n}.${ext}`)) n++;
  return `${base}${n}.${ext}`;
};

/* --------------------------------------------------------------- Word ---- */

/**
 * Insert images into a .docx.
 * placements: [{ image, mime, fileName, widthPt, afterText }] — `afterText` is
 * matched against the document's own text runs so the signature lands next to
 * the line that asks for it; without a match it is appended at the end.
 * Returns { entries, applied:[label] } — `entries` is mutated in place.
 */
export function docxPlaceImages(entries, xml, placements) {
  const applied = [];
  let out = xml;
  let picId = 1000;

  for (const pl of placements) {
    let box;
    try { box = emuBox(pl.image, pl.widthPt || 110); } catch { continue; }
    const ext = extOf(pl.mime, pl.fileName);
    const name = freeName(entries, "word/media", "bp_sig", ext);
    entries.set(`word/media/${name}`, pl.image);
    ensureDefault(entries, ext);
    const rId = addRel(entries, "word/_rels/document.xml.rels", `media/${name}`);

    const id = ++picId;
    const label = escXml(pl.label || "Signature");
    // Namespaces are declared on the elements themselves so the run is valid
    // whatever the host document happens to declare on <w:document>.
    const run =
      `<w:r><w:drawing>` +
      `<wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0">` +
      `<wp:extent cx="${box.cx}" cy="${box.cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>` +
      `<wp:docPr id="${id}" name="${label} ${id}"/>` +
      `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="${A_NS}" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
      `<a:graphic xmlns:a="${A_NS}"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
      `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
      `<pic:nvPicPr><pic:cNvPr id="${id}" name="${label} ${id}"/><pic:cNvPicPr/></pic:nvPicPr>` +
      `<pic:blipFill><a:blip xmlns:r="${R_NS}" r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
      `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${box.cx}" cy="${box.cy}"/></a:xfrm>` +
      `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
      `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;

    // Land it in the paragraph that carries the anchor text; otherwise at the end.
    let at = -1;
    if (pl.afterText) {
      const needle = String(pl.afterText).trim().toLowerCase();
      const re = /<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g;
      let m;
      while ((m = re.exec(out))) {
        if (!m[1].trim().toLowerCase().includes(needle)) continue;
        const close = out.indexOf("</w:p>", m.index);
        if (close !== -1) { at = close; break; }
      }
    }
    if (at !== -1) out = out.slice(0, at) + run + out.slice(at);
    else {
      const body = out.lastIndexOf("</w:body>");
      const para = `<w:p>${run}</w:p>`;
      out = body === -1 ? out + para : out.slice(0, body) + para + out.slice(body);
    }
    applied.push(pl.label || name);
  }
  return { xml: out, applied };
}

/* -------------------------------------------------------------- Excel ---- */

const colNo = (ref) => {
  const m = /^([A-Z]+)(\d+)$/.exec(String(ref || "").toUpperCase());
  if (!m) return null;
  let c = 0;
  for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64);
  return { col: c - 1, row: Number(m[2]) - 1 }; // xdr anchors are 0-based
};

/**
 * Insert images into a .xlsx, anchored to a cell.
 * placements: [{ image, mime, fileName, sheetPath, ref, widthPt }]
 * Returns { applied:[label] }; `entries` is mutated in place.
 */
export function xlsxPlaceImages(entries, placements) {
  const applied = [];
  const bySheet = new Map();

  for (const pl of placements) {
    let box;
    try { box = emuBox(pl.image, pl.widthPt || 100); } catch { continue; }
    const anchor = colNo(pl.ref) || { col: 0, row: 0 };
    const sheetPath = pl.sheetPath && entries.has(pl.sheetPath)
      ? pl.sheetPath
      : [...entries.keys()].find((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k));
    if (!sheetPath) continue;

    const ext = extOf(pl.mime, pl.fileName);
    const name = freeName(entries, "xl/media", "bp_sig", ext);
    entries.set(`xl/media/${name}`, pl.image);
    ensureDefault(entries, ext);

    const list = bySheet.get(sheetPath) || [];
    list.push({ ...pl, box, anchor, media: name });
    bySheet.set(sheetPath, list);
    applied.push(pl.label || name);
  }

  for (const [sheetPath, list] of bySheet) {
    const sheetRels = sheetPath.replace(/worksheets\/([^/]+)$/, "worksheets/_rels/$1.rels");
    let sheet = entries.get(sheetPath).toString("utf8");

    // Reuse the sheet's drawing part when it already has one, so an existing
    // logo or chart in the client's workbook is never dropped.
    const has = /<drawing[^>]*r:id="(rId\d+)"/.exec(sheet);
    let drawingPath = null;
    if (has) {
      const relXml = entries.get(sheetRels)?.toString("utf8") || "";
      const t = new RegExp(`Id="${has[1]}"[^>]*Target="([^"]+)"`).exec(relXml);
      if (t) drawingPath = "xl/" + t[1].replace(/^\.\.\//, "");
    }
    if (!drawingPath || !entries.has(drawingPath)) {
      drawingPath = "xl/drawings/" + freeName(entries, "xl/drawings", "drawing", "xml");
      entries.set(drawingPath, Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
        `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="${A_NS}"></xdr:wsDr>`,
        "utf8"));
      ensureOverride(entries, "/" + drawingPath,
        "application/vnd.openxmlformats-officedocument.drawing+xml");
      const rid = addRel(entries, sheetRels, "../drawings/" + drawingPath.split("/").pop());
      // The relationship type for a drawing is not the image type addRel writes.
      entries.set(sheetRels, Buffer.from(
        entries.get(sheetRels).toString("utf8").replace(
          new RegExp(`(Id="${rid}" Type=")[^"]+(")`),
          "$1http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing$2"),
        "utf8"));
      // <drawing> sits near the end of the sheet, before tableParts/extLst.
      const tag = `<drawing r:id="${rid}"/>`;
      const before = ["<tableParts", "<extLst", "</worksheet>"].find((t) => sheet.includes(t));
      sheet = sheet.replace(before, tag + before);
      if (!/xmlns:r=/.test(sheet)) sheet = sheet.replace(/<worksheet\b/, `<worksheet xmlns:r="${R_NS}"`);
      entries.set(sheetPath, Buffer.from(sheet, "utf8"));
    }

    const drawingRels = drawingPath.replace(/drawings\/([^/]+)$/, "drawings/_rels/$1.rels");
    let dxml = entries.get(drawingPath).toString("utf8");
    let n = (dxml.match(/<xdr:(oneCellAnchor|twoCellAnchor|absoluteAnchor)\b/g) || []).length;

    for (const pl of list) {
      const rId = addRel(entries, drawingRels, "../media/" + pl.media);
      const id = ++n + 100;
      const label = escXml(pl.label || "Signature");
      const anchorXml =
        `<xdr:oneCellAnchor>` +
        `<xdr:from><xdr:col>${pl.anchor.col}</xdr:col><xdr:colOff>0</xdr:colOff>` +
        `<xdr:row>${pl.anchor.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
        `<xdr:ext cx="${pl.box.cx}" cy="${pl.box.cy}"/>` +
        `<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${id}" name="${label} ${id}"/><xdr:cNvPicPr/></xdr:nvPicPr>` +
        `<xdr:blipFill><a:blip xmlns:r="${R_NS}" r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>` +
        `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${pl.box.cx}" cy="${pl.box.cy}"/></a:xfrm>` +
        `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic>` +
        `<xdr:clientData/></xdr:oneCellAnchor>`;
      dxml = dxml.includes("</xdr:wsDr>")
        ? dxml.replace("</xdr:wsDr>", anchorXml + "</xdr:wsDr>")
        : dxml.replace(/<xdr:wsDr([^>]*)\/>/, `<xdr:wsDr$1>${anchorXml}</xdr:wsDr>`);
    }
    entries.set(drawingPath, Buffer.from(dxml, "utf8"));
  }

  return { applied };
}
