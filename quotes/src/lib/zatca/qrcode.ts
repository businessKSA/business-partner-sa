/**
 * مولّد رمز الاستجابة السريعة — منقول عن `api/_qr.js` في الموقع التعريفي
 * (نفس الخوارزمية حرفياً، مع أنواع TypeScript). Byte mode، تصحيح أخطاء M،
 * إصدارات 1–20: يغطي حمولة زاتكا TLV للمرحلتين الأولى (~150 بايت)
 * والثانية (~700 بايت) بهامش.
 */

// ---- GF(256) with the QR primitive polynomial 0x11D ----
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function rsGenerator(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= mul(poly[j], EXP[i]);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}
function rsEncode(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = rsGenerator(ecLen);
  const res = new Uint8Array(ecLen);
  for (const b of data) {
    const factor = b ^ res[0];
    res.copyWithin(0, 1); res[ecLen - 1] = 0;
    for (let i = 0; i < ecLen; i++) res[i] ^= mul(gen[i + 1], factor);
  }
  return res;
}

// ---- per-version data for error-correction level M ----
// [ total codewords, ec codewords per block, group1 blocks, group2 blocks ]
const M: Record<number, [number, number, number, number]> = {
  1:[26,10,1,0], 2:[44,16,1,0], 3:[70,26,1,0], 4:[100,18,2,0], 5:[134,24,2,0],
  6:[172,16,4,0], 7:[196,18,4,0], 8:[242,22,2,2], 9:[292,22,3,2], 10:[346,26,4,1],
  11:[404,30,1,4], 12:[466,22,6,2], 13:[532,22,8,1], 14:[581,24,4,5], 15:[655,24,5,5],
  16:[733,28,7,3], 17:[815,28,10,1], 18:[901,26,9,4], 19:[991,26,3,11], 20:[1085,26,3,13],
};
const ALIGN: Record<number, number[]> = {
  1:[], 2:[6,18], 3:[6,22], 4:[6,26], 5:[6,30], 6:[6,34], 7:[6,22,38], 8:[6,24,42],
  9:[6,26,46], 10:[6,28,50], 11:[6,30,54], 12:[6,32,58], 13:[6,34,62], 14:[6,26,46,66],
  15:[6,26,48,70], 16:[6,26,50,74], 17:[6,30,54,78], 18:[6,30,56,82], 19:[6,30,58,86], 20:[6,34,62,90],
};
const size = (v: number) => 17 + v * 4;
function capacityBytes(v: number): number {
  const [total, ecPer, g1, g2] = M[v];
  const blocks = g1 + g2;
  const dataCw = total - ecPer * blocks;
  const header = 4 + (v <= 9 ? 8 : 16);
  return dataCw - Math.ceil(header / 8);
}

// ---- bit stream ----
class Bits {
  bytes: number[] = [];
  len = 0;
  push(value: number, n: number) {
    for (let i = n - 1; i >= 0; i--) {
      const bit = (value >> i) & 1;
      if (this.len % 8 === 0) this.bytes.push(0);
      if (bit) this.bytes[this.bytes.length - 1] |= 0x80 >> (this.len % 8);
      this.len++;
    }
  }
}

function buildCodewords(data: number[], v: number): number[] {
  const [total, ecPer, g1, g2] = M[v];
  const blocks = g1 + g2;
  const dataCw = total - ecPer * blocks;
  const bs = new Bits();
  bs.push(0b0100, 4);                       // byte mode
  bs.push(data.length, v <= 9 ? 8 : 16);    // character count
  for (const b of data) bs.push(b, 8);
  const remainder = dataCw * 8 - bs.len;
  bs.push(0, Math.min(4, remainder));       // terminator
  while (bs.len % 8 !== 0) bs.push(0, 1);
  const pad = [0xec, 0x11];
  for (let i = 0; bs.bytes.length < dataCw; i++) bs.bytes.push(pad[i % 2]);

  // Split into blocks. Group 2 blocks each hold one more data codeword.
  const short = Math.floor(dataCw / blocks);
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let at = 0;
  for (let i = 0; i < blocks; i++) {
    const n = short + (i >= g1 ? 1 : 0);
    const blk = Uint8Array.from(bs.bytes.slice(at, at + n));
    at += n;
    dataBlocks.push(blk);
    ecBlocks.push(rsEncode(blk, ecPer));
  }
  // Interleave, longest block last
  const out: number[] = [];
  const maxData = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxData; i++) for (const b of dataBlocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < ecPer; i++) for (const b of ecBlocks) out.push(b[i]);
  return out;
}

// ---- matrix ----
type Matrix = Int8Array[];
function newMatrix(v: number): Matrix {
  const n = size(v);
  const m: Matrix = Array.from({ length: n }, () => new Int8Array(n).fill(-1)); // -1 = free
  const put = (r: number, c: number, val: number) => { if (r >= 0 && c >= 0 && r < n && c < n) m[r][c] = val; };
  const finder = (r0: number, c0: number) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const inRing = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      const dark = inRing && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      put(r0 + r, c0 + c, dark ? 1 : 0);
    }
  };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
  for (let i = 8; i < n - 8; i++) { m[6][i] = i % 2 === 0 ? 1 : 0; m[i][6] = i % 2 === 0 ? 1 : 0; }
  const centres = ALIGN[v];
  for (const r of centres) for (const c of centres) {
    if ((r === 6 && c === 6) || (r === 6 && c === n - 7) || (r === n - 7 && c === 6)) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++)
      m[r + dr][c + dc] = (Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0)) ? 1 : 0;
  }
  m[n - 8][8] = 1;                                   // dark module
  for (let i = 0; i < 9; i++) { if (m[8][i] === -1) m[8][i] = 0; if (m[i][8] === -1) m[i][8] = 0; }
  for (let i = 0; i < 8; i++) { if (m[8][n - 1 - i] === -1) m[8][n - 1 - i] = 0; if (m[n - 1 - i][8] === -1) m[n - 1 - i][8] = 0; }
  if (v >= 7) for (let i = 0; i < 18; i++) {
    const r = Math.floor(i / 3), c = i % 3;
    m[n - 11 + c][r] = 0; m[r][n - 11 + c] = 0;
  }
  return m;
}
const RESERVED = (v: number) => { const r = newMatrix(v); return r.map((row) => Array.from(row, (x) => x !== -1)); };

function placeData(m: Matrix, reserved: boolean[][], codewords: number[]) {
  const n = m.length;
  let bit = 0;
  const total = codewords.length * 8;
  for (let right = n - 1; right > 0; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < n; vert++) {
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        const upward = ((right + 1) & 2) === 0;
        const r = upward ? n - 1 - vert : vert;
        if (reserved[r][c]) continue;
        let v = 0;
        if (bit < total) v = (codewords[bit >> 3] >> (7 - (bit & 7))) & 1;
        m[r][c] = v; bit++;
      }
    }
  }
}
const MASKS: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];
const FORMAT_M = [0x5412,0x5125,0x5E7C,0x5B4B,0x45F9,0x40CE,0x4F97,0x4AA0];
function applyFormat(m: Matrix, maskIdx: number) {
  const n = m.length, bits = FORMAT_M[maskIdx];
  for (let i = 0; i < 15; i++) {
    const b = (bits >> i) & 1;
    if (i < 6) m[8][i] = b;
    else if (i < 8) m[8][i + 1] = b;
    else if (i === 8) m[7][8] = b;
    else m[14 - i][8] = b;
    if (i < 8) m[n - 1 - i][8] = b;
    else m[8][n - 15 + i] = b;
  }
}
const VERSION_BITS: Record<number, number> = {7:0x07C94,8:0x085BC,9:0x09A99,10:0x0A4D3,11:0x0BBF6,12:0x0C762,13:0x0D847,14:0x0E60D,15:0x0F928,16:0x10B78,17:0x1145D,18:0x12A17,19:0x13532,20:0x149A6};
function applyVersion(m: Matrix, v: number) {
  if (v < 7) return;
  const n = m.length, bits = VERSION_BITS[v];
  for (let i = 0; i < 18; i++) {
    const b = (bits >> i) & 1, r = Math.floor(i / 3), c = i % 3;
    m[n - 11 + c][r] = b; m[r][n - 11 + c] = b;
  }
}
function penalty(m: Matrix): number {
  const n = m.length; let score = 0;
  const runScore = (line: ArrayLike<number>) => {
    let s = 0, run = 1;
    for (let i = 1; i < n; i++) {
      if (line[i] === line[i - 1]) run++;
      else { if (run >= 5) s += 3 + (run - 5); run = 1; }
    }
    if (run >= 5) s += 3 + (run - 5);
    return s;
  };
  for (let r = 0; r < n; r++) score += runScore(m[r]);
  for (let c = 0; c < n; c++) score += runScore(m.map((row) => row[c]));
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++)
    if (m[r][c] === m[r][c + 1] && m[r][c] === m[r + 1][c] && m[r][c] === m[r + 1][c + 1]) score += 3;
  const pat = [1,0,1,1,1,0,1,0,0,0,0];
  const hasPat = (line: ArrayLike<number>, i: number) => pat.every((p, k) => line[i + k] === p);
  const rev = [0,0,0,0,1,0,1,1,1,0,1];
  const hasRev = (line: ArrayLike<number>, i: number) => rev.every((p, k) => line[i + k] === p);
  for (let r = 0; r < n; r++) for (let c = 0; c + 11 <= n; c++)
    if (hasPat(m[r], c) || hasRev(m[r], c)) score += 40;
  for (let c = 0; c < n; c++) {
    const col = m.map((row) => row[c]);
    for (let r = 0; r + 11 <= n; r++) if (hasPat(col, r) || hasRev(col, r)) score += 40;
  }
  let dark = 0;
  for (const row of m) for (const x of row) dark += x;
  score += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10;
  return score;
}

/** ترميز نص كمصفوفة QR من 0/1. */
export function qrMatrix(text: string): { matrix: Matrix; version: number; mask: number } {
  const data = Array.from(Buffer.from(String(text), 'utf8'));
  let v = 0;
  for (let i = 1; i <= 20; i++) if (capacityBytes(i) >= data.length) { v = i; break; }
  if (!v) throw new Error('qr_payload_too_large');
  const codewords = buildCodewords(data, v);
  const reserved = RESERVED(v);
  let best: { p: number; m: Matrix; maskIdx: number } | null = null;
  for (let maskIdx = 0; maskIdx < 8; maskIdx++) {
    const m = newMatrix(v);
    placeData(m, reserved, codewords);
    for (let r = 0; r < m.length; r++) for (let c = 0; c < m.length; c++)
      if (!reserved[r][c] && MASKS[maskIdx](r, c)) m[r][c] ^= 1;
    applyVersion(m, v); applyFormat(m, maskIdx);
    const p = penalty(m);
    if (!best || p < best.p) best = { p, m, maskIdx };
  }
  const b = best!;
  return { matrix: b.m, version: v, mask: b.maskIdx };
}

/** نفس المصفوفة كسلسلة SVG بمقاس CSS pixels. */
export function qrSvg(text: string, px = 160): string {
  const { matrix } = qrMatrix(text);
  const n = matrix.length, quiet = 4, dim = n + quiet * 2;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
    if (matrix[r][c]) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${px}" height="${px}" shape-rendering="crispEdges" role="img" aria-label="QR"><rect width="${dim}" height="${dim}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
