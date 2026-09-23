// مجلدات العملاء على Microsoft 365 — SharePoint عبر Microsoft Graph.
//
// بديل Notion وGoogle Drive: مجلد لكل منشأة داخل مكتبة مستندات واحدة، ترتفع
// إليه ملفات العميل ومخرجاته. بلا مكتبات: رمز التطبيق من Entra ID بمسار
// client_credentials، ثم رفع إلى Graph مباشرة.
//
// صلاحيات التطبيق المطلوبة (Application، بموافقة المسؤول):
//   Files.ReadWrite.All   — إنشاء المجلدات ورفع الملفات
//   Sites.ReadWrite.All   — الوصول إلى مكتبة الموقع
const TENANT = () => String(process.env.AZURE_TENANT_ID || "").trim();
const CLIENT_ID = () => String(process.env.AZURE_CLIENT_ID || "").trim();
const CLIENT_SECRET = () => String(process.env.AZURE_CLIENT_SECRET || "").trim();
const DRIVE_ID = () => String(process.env.AZURE_GRAPH_DRIVE_ID || "").trim();
const ROOT = () => String(process.env.AZURE_GRAPH_ROOT_FOLDER || "Client Documents").trim().replace(/^\/+|\/+$/g, "");

export const graphReady = () => !!(TENANT() && CLIENT_ID() && CLIENT_SECRET() && DRIVE_ID());
export const graphMissing = () => ["AZURE_TENANT_ID", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET", "AZURE_GRAPH_DRIVE_ID"]
  .filter((n) => !String(process.env[n] || "").trim()).join(" + ");

// الرمز صالح نحو ساعة؛ يُحتفظ به في ذاكرة النسخة العاملة ويُجدَّد قبل انتهائه
// بدقيقة، فلا يُطلب رمزٌ جديد مع كل ملف.
let cached = { token: "", exp: 0 };
async function graphToken() {
  if (cached.token && Date.now() < cached.exp - 60000) return cached.token;
  const body = new URLSearchParams({
    client_id: CLIENT_ID(),
    client_secret: CLIENT_SECRET(),
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const r = await fetch(`https://login.microsoftonline.com/${TENANT()}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`graph_token_${r.status}: ${(await r.text()).slice(0, 160)}`);
  const d = await r.json();
  cached = { token: d.access_token, exp: Date.now() + (Number(d.expires_in) || 3600) * 1000 };
  return cached.token;
}

// ما يصلح اسماً لمجلد في SharePoint: المحارف " * : < > ? / \ | ممنوعة،
// والاسم لا يبدأ أو ينتهي بمسافة أو نقطة. العربية مسموحة كما هي.
const safeName = (s, fallback) => {
  const clean = String(s || "").replace(/["*:<>?/\\|]+/g, " ").replace(/\s+/g, " ").trim().replace(/^\.+|\.+$/g, "").slice(0, 100).trim();
  return clean || fallback;
};
/** مجلد المنشأة: اسمها التجاري ومعرّفها، فلا يلتبس اسمان متشابهان. */
export const orgFolderName = (orgName, orgId) =>
  safeName(orgName ? `${orgName} (${String(orgId || "").slice(0, 8)})` : orgId, "unknown-client");

const enc = (p) => p.split("/").filter(Boolean).map(encodeURIComponent).join("/");

/** ينشئ المجلد إن لم يكن موجوداً. الموجود مسبقاً ليس خطأً. */
async function ensureFolder(token, parentPath, name) {
  const base = `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID()}/root`;
  const target = parentPath ? `${base}:/${enc(parentPath)}:/children` : `${base}/children`;
  const r = await fetch(target, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    // fail يُبقي المجلد القائم كما هو بدل أن يُنشئ نسخة ثانية باسم مختلف.
    body: JSON.stringify({ name, folder: {}, "@microsoft.graph.conflictBehavior": "fail" }),
    signal: AbortSignal.timeout(15000),
  });
  if (r.ok || r.status === 409) return `${parentPath ? parentPath + "/" : ""}${name}`;
  throw new Error(`graph_folder_${r.status}: ${(await r.text()).slice(0, 160)}`);
}

/**
 * يرفع ملفاً إلى مجلد المنشأة داخل SharePoint ويعيد رابطه.
 * الرفع البسيط يكفي حتى ٤ ميجابايت، وحدّ رفع العميل ٣، فلا حاجة لجلسة رفع.
 */
export async function graphUpload({ orgName, orgId, subFolder, fileName, mime, bytes }) {
  if (!graphReady()) throw new Error(`graph: ${graphMissing()} غير مضبوط`);
  const token = await graphToken();
  let path = ROOT();
  if (path) await ensureFolder(token, path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "", path.split("/").pop()).catch(() => {});
  path = await ensureFolder(token, path, orgFolderName(orgName, orgId));
  if (subFolder) path = await ensureFolder(token, path, safeName(subFolder, "files"));

  const name = safeName(fileName, "document");
  const r = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID()}/root:/${enc(`${path}/${name}`)}:/content?@microsoft.graph.conflictBehavior=rename`,
    {
      method: "PUT",
      headers: { authorization: `Bearer ${token}`, "content-type": mime || "application/octet-stream" },
      body: bytes,
      signal: AbortSignal.timeout(45000),
    },
  );
  if (!r.ok) throw new Error(`graph_upload_${r.status}: ${(await r.text()).slice(0, 160)}`);
  const d = await r.json();
  return { id: d.id, name: d.name, webUrl: d.webUrl, path };
}
