// PNG/JPEG decoding for embedding a client's signature or company stamp into
// their documents. No npm dependencies — Node's zlib is the only machinery.
//
// Two consumers with different needs:
//   * OOXML (docx/xlsx) embeds the ORIGINAL bytes and only needs the pixel
//     dimensions, so PNG alpha survives untouched.
//   * PDF has no PNG support, so an image must be re-expressed as a PDF stream:
//     JPEG passes through as /DCTDecode; PNG is inflated, un-filtered and
//     re-deflated as raw samples, with its alpha channel split off into an
//     /SMask so a signature stays transparent over the form's own ink.
import zlib from "node:zlib";

export const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const isPng = (buf) => buf.length > 8 && buf.slice(0, 8).equals(PNG_SIG);
export const isJpeg = (buf) => buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;

function pngChunks(buf) {
  const out = [];
  let p = 8;
  while (p + 8 <= buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString("latin1", p + 4, p + 8);
    if (p + 12 + len > buf.length) break;
    out.push({ type, data: buf.slice(p + 8, p + 8 + len) });
    p += 12 + len;
    if (type === "IEND") break;
  }
  return out;
}

/** Pixel dimensions only — enough for OOXML, which embeds the original bytes. */
export function imageSize(buf) {
  if (isPng(buf)) {
    const ihdr = pngChunks(buf).find((c) => c.type === "IHDR");
    if (!ihdr) throw new Error("png_no_ihdr");
    return { kind: "png", w: ihdr.data.readUInt32BE(0), h: ihdr.data.readUInt32BE(4) };
  }
  if (isJpeg(buf)) {
    // Walk the marker segments to the frame header; SOF0..SOF15 carry the size
    // (SOF4/SOF8/SOF12 are not frame headers and are skipped like any other).
    let p = 2;
    while (p + 4 < buf.length) {
      if (buf[p] !== 0xff) { p++; continue; }
      const marker = buf[p + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { p += 2; continue; }
      const len = buf.readUInt16BE(p + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { kind: "jpeg", h: buf.readUInt16BE(p + 5), w: buf.readUInt16BE(p + 7), comps: buf[p + 9] };
      }
      p += 2 + len;
    }
    throw new Error("jpeg_no_sof");
  }
  throw new Error("unsupported_image");
}

// Reverse the five PNG scanline filters in place, one row at a time.
function unfilter(raw, h, bpp, rowBytes) {
  const out = Buffer.alloc(h * rowBytes);
  let ip = 0;
  for (let y = 0; y < h; y++) {
    if (ip >= raw.length) break;
    const ft = raw[ip++];
    const cur = out.subarray(y * rowBytes, (y + 1) * rowBytes);
    raw.copy(cur, 0, ip, Math.min(ip + rowBytes, raw.length));
    ip += rowBytes;
    const prev = y ? out.subarray((y - 1) * rowBytes, y * rowBytes) : null;
    if (ft === 0) continue;
    for (let x = 0; x < rowBytes; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      let v = cur[x];
      if (ft === 1) v = (v + a) & 255;
      else if (ft === 2) v = (v + b) & 255;
      else if (ft === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (ft === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      } else throw new Error("png_filter_" + ft);
      cur[x] = v;
    }
  }
  return out;
}

// Expand a sub-byte palette row into one index per pixel.
function expandBits(row, w, depth) {
  const out = Buffer.alloc(w);
  const per = 8 / depth, mask = (1 << depth) - 1;
  for (let x = 0; x < w; x++) {
    const shift = 8 - depth * ((x % per) + 1);
    out[x] = (row[Math.floor(x / per)] >> shift) & mask;
  }
  return out;
}

/**
 * A PDF-embeddable form of the image.
 * Returns { w, h, filter, colorSpace, bits, data, smask } where `smask` is the
 * 8-bit alpha channel (already deflated) or null when the image is opaque.
 */
export function pdfImage(buf) {
  if (isJpeg(buf)) {
    const { w, h, comps } = imageSize(buf);
    if (comps !== 1 && comps !== 3) throw new Error("jpeg_components_" + comps);
    return {
      w, h, filter: "/DCTDecode", bits: 8,
      colorSpace: comps === 1 ? "/DeviceGray" : "/DeviceRGB",
      data: buf, smask: null,
    };
  }
  if (!isPng(buf)) throw new Error("unsupported_image");

  const chunks = pngChunks(buf);
  const ihdr = chunks.find((c) => c.type === "IHDR");
  if (!ihdr) throw new Error("png_no_ihdr");
  const w = ihdr.data.readUInt32BE(0), h = ihdr.data.readUInt32BE(4);
  const depth = ihdr.data[8], colorType = ihdr.data[9], interlace = ihdr.data[12];
  if (interlace) throw new Error("png_interlaced");
  if (![1, 2, 4, 8, 16].includes(depth)) throw new Error("png_depth_" + depth);

  const samplesPer = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!samplesPer) throw new Error("png_colortype_" + colorType);
  if (colorType !== 3 && depth < 8) throw new Error("png_depth_" + depth);

  const idat = Buffer.concat(chunks.filter((c) => c.type === "IDAT").map((c) => c.data));
  if (!idat.length) throw new Error("png_no_idat");
  const raw = zlib.inflateSync(idat);

  const bitsPerPixel = samplesPer * depth;
  const rowBytes = Math.ceil((w * bitsPerPixel) / 8);
  const bpp = Math.max(1, Math.ceil(bitsPerPixel / 8));
  const flat = unfilter(raw, h, bpp, rowBytes);

  // Normalise every variant to 8-bit RGB (+ alpha when the image carries any).
  const rgb = Buffer.alloc(w * h * 3);
  let alpha = null;
  const step = depth === 16 ? 2 : 1;          // 16-bit: keep the high byte only
  const plte = chunks.find((c) => c.type === "PLTE");
  const trns = chunks.find((c) => c.type === "tRNS");

  for (let y = 0; y < h; y++) {
    const row = flat.subarray(y * rowBytes, (y + 1) * rowBytes);
    const idx = colorType === 3 && depth < 8 ? expandBits(row, w, depth) : null;
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 3;
      let r, g, b, a = 255;
      if (colorType === 3) {
        const pi = idx ? idx[x] : row[x];
        if (!plte) throw new Error("png_no_plte");
        r = plte.data[pi * 3]; g = plte.data[pi * 3 + 1]; b = plte.data[pi * 3 + 2];
        if (trns && pi < trns.data.length) a = trns.data[pi];
      } else {
        const base = x * samplesPer * step;
        if (colorType === 0 || colorType === 4) {
          r = g = b = row[base];
          if (colorType === 4) a = row[base + step];
        } else {
          r = row[base]; g = row[base + step]; b = row[base + 2 * step];
          if (colorType === 6) a = row[base + 3 * step];
        }
      }
      rgb[o] = r; rgb[o + 1] = g; rgb[o + 2] = b;
      if (a !== 255 || alpha) {
        if (!alpha) alpha = Buffer.alloc(w * h, 255);
        alpha[y * w + x] = a;
      }
    }
  }

  return {
    w, h, filter: "/FlateDecode", bits: 8, colorSpace: "/DeviceRGB",
    data: zlib.deflateSync(rgb),
    smask: alpha ? zlib.deflateSync(alpha) : null,
  };
}
