// خزنة العميل على Azure Blob Storage — بلا أي مكتبة خارجية.
//
// المشروع يُبنى بلا اعتماديات (`installCommand: echo "no dependencies"`)، فلا
// مجال لـ@azure/storage-blob. والتوقيع في Azure قياسي ومُوثَّق، وnode:crypto
// يكفيه: Shared Key لنداءات الخادم، وService SAS لروابط التنزيل التي تصل
// المتصفح. النتيجة أن المفتاح لا يغادر الخادم أبداً، والعميل يحصل على رابط
// موقّع قصير العمر لملفه وحده.
import crypto from "node:crypto";

const ACCOUNT = () => String(process.env.AZURE_STORAGE_ACCOUNT || "").trim();
const KEY = () => String(process.env.AZURE_STORAGE_KEY || process.env.AZURE_STORAGE_ACCOUNT_KEY || "").trim();
export const CONTAINER = () => String(process.env.AZURE_STORAGE_CONTAINER || "client-documents").trim();
const SUFFIX = () => String(process.env.AZURE_STORAGE_SUFFIX || "blob.core.windows.net").trim();
const API_VERSION = "2021-08-06";

export const azureBlobReady = () => !!(ACCOUNT() && KEY());
export const blobMissing = () => {
  const m = [];
  if (!ACCOUNT()) m.push("AZURE_STORAGE_ACCOUNT");
  if (!KEY()) m.push("AZURE_STORAGE_KEY");
  return m.join(" + ");
};

const host = () => `https://${ACCOUNT()}.${SUFFIX()}`;
const keyBytes = () => Buffer.from(KEY(), "base64");
// Blob names keep their slashes — the "folders" a client sees are name prefixes.
const encodeBlobPath = (p) => String(p).split("/").map(encodeURIComponent).join("/");

/**
 * توقيع Shared Key لنداء خادم واحد.
 * ترتيب الحقول وطريقة تطبيع الترويسات ليسا اختياريين — أي انحراف يرد بـ403،
 * فهما منسوخان حرفياً عن مواصفة Azure.
 */
function sharedKeyAuth(method, blobPath, headers, query = {}) {
  const account = ACCOUNT();
  const canonHeaders = Object.keys(headers)
    .filter((h) => h.toLowerCase().startsWith("x-ms-"))
    .map((h) => [h.toLowerCase(), String(headers[h]).trim()])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${k}:${v}\n`)
    .join("");
  const canonQuery = Object.keys(query).sort()
    .map((k) => `\n${k.toLowerCase()}:${query[k]}`)
    .join("");
  const canonResource = `/${account}/${CONTAINER()}/${blobPath}${canonQuery}`;
  const len = headers["Content-Length"];
  const stringToSign = [
    method,
    "",                                   // Content-Encoding
    "",                                   // Content-Language
    len === undefined || len === 0 || len === "0" ? "" : String(len),
    "",                                   // Content-MD5
    headers["content-type"] || "",
    "",                                   // Date — x-ms-date is used instead
    "", "", "", "", "",                   // If-* and Range
  ].join("\n") + "\n" + canonHeaders + canonResource;
  const sig = crypto.createHmac("sha256", keyBytes()).update(stringToSign, "utf8").digest("base64");
  return `SharedKey ${account}:${sig}`;
}

async function blobCall(method, path, { body, contentType, extraHeaders } = {}) {
  const blobPath = encodeBlobPath(path);
  const headers = {
    "x-ms-date": new Date().toUTCString(),
    "x-ms-version": API_VERSION,
    ...(extraHeaders || {}),
  };
  if (contentType) headers["content-type"] = contentType;
  if (body) headers["Content-Length"] = Buffer.byteLength(body);
  headers.Authorization = sharedKeyAuth(method, blobPath, headers);
  delete headers["Content-Length"]; // fetch sets it; it only had to be signed
  return fetch(`${host()}/${CONTAINER()}/${blobPath}`, {
    method, headers, body, signal: AbortSignal.timeout(60000),
  });
}

/** يرفع الملف ويعيد مساره داخل الحاوية. */
export async function blobPut(path, buffer, contentType) {
  const r = await blobCall("PUT", path, {
    body: buffer,
    contentType: contentType || "application/octet-stream",
    extraHeaders: { "x-ms-blob-type": "BlockBlob" },
  });
  if (!r.ok) {
    const detail = (await r.text()).slice(0, 200);
    console.error("azblob put", r.status, detail);
    throw new Error(`azblob_put_${r.status}`);
  }
  return path;
}

/** يُنزّل بايتات الملف — الخادم وحده، لتعبئة النماذج. */
export async function blobGet(path) {
  const r = await blobCall("GET", path);
  if (!r.ok) {
    console.error("azblob get", r.status, (await r.text()).slice(0, 200));
    throw new Error(`azblob_get_${r.status}`);
  }
  return Buffer.from(await r.arrayBuffer());
}

/** يحذف الملف. الغائب أصلاً هو المطلوب، فلا يُعدّ 404 خطأً. */
export async function blobDelete(path) {
  const r = await blobCall("DELETE", path);
  if (!r.ok && r.status !== 404) console.error("azblob delete", r.status, (await r.text()).slice(0, 200));
}

export async function blobExists(path) {
  try { const r = await blobCall("HEAD", path); return r.ok; } catch { return false; }
}

/**
 * رابط تنزيل موقّع قصير العمر (Service SAS) لملف واحد بصلاحية قراءة فقط.
 * حقول التوقيع وترتيبها من مواصفة Azure لإصدار 2021-08-06؛ الحقول التي لا
 * نستعملها تبقى فارغة لكنها تبقى في مكانها.
 */
export function blobSign(path, expiresIn) {
  const account = ACCOUNT();
  const start = new Date(Date.now() - 5 * 60 * 1000);           // نافذة انحراف الساعة
  const expiry = new Date(Date.now() + (Number(expiresIn) || 600) * 1000);
  const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
  const p = {
    sp: "r", st: iso(start), se: iso(expiry), spr: "https",
    sv: API_VERSION, sr: "b",
  };
  const stringToSign = [
    p.sp,
    p.st,
    p.se,
    `/blob/${account}/${CONTAINER()}/${path}`,
    "",           // signedIdentifier
    "",           // signedIP
    p.spr,
    p.sv,
    p.sr,
    "",           // signedSnapshotTime
    "",           // signedEncryptionScope
    "", "", "", "", "", // rscc rscd rsce rscl rsct
  ].join("\n");
  const sig = crypto.createHmac("sha256", keyBytes()).update(stringToSign, "utf8").digest("base64");
  const qs = new URLSearchParams({ ...p, sig }).toString();
  return `${host()}/${CONTAINER()}/${encodeBlobPath(path)}?${qs}`;
}
