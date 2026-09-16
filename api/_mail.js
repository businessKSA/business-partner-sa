// إرسال البريد عبر Azure Communication Services — المزود الوحيد.
//
// كان نداء Resend مكرراً نصّاً في عشرة ملفات، فكل تبديل مزوّد يعني عشر
// تعديلات متطابقة وفرصةً لأن يُنسى أحدها فيبقى بريد واحد خارج أزور بلا أن
// يظهر ذلك في أي شاشة. الإرسال صار هنا وحده.
//
// ACS لا يقبل مفتاحاً في ترويسة بسيطة كما تفعل أكثر الخدمات: يوقّع الطلب
// بـHMAC-SHA256 على نصٍّ يجمع الفعل والمسار والتاريخ والمضيف وبصمة الجسم.
// أي حرف يزيد أو ينقص في ذلك النص يعطي 401 لا تشرح نفسها، فالبناء أدناه
// حرفيٌّ بالترتيب الذي توثّقه مايكروسوفت.
import crypto from "node:crypto";

// سلسلة الاتصال كما تعطيها لوحة أزور:
//   endpoint=https://<name>.<region>.communication.azure.com/;accesskey=<base64>
// وتُقبل كذلك المتغيّرات مفرّقة لمن يفضّل Key Vault لكل قيمة على حدة.
function config() {
  const cs = (process.env.ACS_CONNECTION_STRING || "").trim();
  let endpoint = (process.env.ACS_ENDPOINT || "").trim();
  let accessKey = (process.env.ACS_ACCESS_KEY || "").trim();
  if (cs) {
    for (const part of cs.split(";")) {
      const i = part.indexOf("=");
      if (i < 0) continue;
      const k = part.slice(0, i).trim().toLowerCase();
      const v = part.slice(i + 1).trim();
      if (k === "endpoint" && !endpoint) endpoint = v;
      if (k === "accesskey" && !accessKey) accessKey = v;
    }
  }
  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    accessKey,
    sender: (process.env.ACS_SENDER_ADDRESS || process.env.MAIL_FROM || "").trim(),
    apiVersion: (process.env.ACS_API_VERSION || "2023-03-31").trim(),
  };
}

export function mailConfigured() {
  const c = config();
  return Boolean(c.endpoint && c.accessKey && c.sender);
}

/** أسماء ما ينقص — للتشخيص وحده، ولا تُرجِع قيمة سرٍّ أبداً. */
export function mailStatus() {
  const c = config();
  return {
    provider: "azure-communication-services",
    endpointSet: Boolean(c.endpoint),
    accessKeySet: Boolean(c.accessKey),
    senderSet: Boolean(c.sender),
    apiVersion: c.apiVersion,
  };
}

// «فلان <a@b.c>» يصلح عنواناً للمُرسِل في Resend، أما ACS فيريد العنوان
// وحده في senderAddress والاسم في حقل منفصل. من نسي ذلك حصل على 400.
function splitAddress(raw) {
  const s = String(raw || "").trim();
  const m = s.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { address: m[2].trim(), displayName: m[1].replace(/^"|"$/g, "").trim() || undefined };
  return { address: s, displayName: undefined };
}

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());

// المرفقات تُكتب في المستدعين بشكل Resend: {filename, content} والمحتوى base64.
// ACS يريد {name, contentType, contentInBase64}، ويرفض المرفق بلا نوع. فبدل
// تعديل كل مستدعٍ يُترجَم الشكل هنا، ويُشتقّ النوع من الامتداد.
const MIME = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  csv: "text/csv",
  txt: "text/plain",
  html: "text/html",
  json: "application/json",
  zip: "application/zip",
  xml: "application/xml",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function toAcsAttachments(list) {
  if (!Array.isArray(list) || !list.length) return undefined;
  const out = [];
  for (const a of list) {
    const name = String((a && (a.filename || a.name)) || "").trim();
    const content = (a && (a.content || a.contentInBase64)) || "";
    if (!name || !content) continue;
    const ext = (name.split(".").pop() || "").toLowerCase();
    out.push({
      name,
      contentType: (a && a.contentType) || MIME[ext] || "application/octet-stream",
      contentInBase64: typeof content === "string" ? content : Buffer.from(content).toString("base64"),
    });
  }
  return out.length ? out : undefined;
}

function sign(method, url, body, accessKey) {
  const u = new URL(url);
  const contentHash = crypto.createHash("sha256").update(body, "utf8").digest("base64");
  // RFC1123 بتوقيت عالمي — وهذا بالضبط ما يعطيه toUTCString.
  const date = new Date().toUTCString();
  const stringToSign = `${method}\n${u.pathname}${u.search}\n${date};${u.host};${contentHash}`;
  const signature = crypto
    .createHmac("sha256", Buffer.from(accessKey, "base64"))
    .update(stringToSign, "utf8")
    .digest("base64");
  return {
    "x-ms-date": date,
    "x-ms-content-sha256": contentHash,
    Authorization: `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}`,
  };
}

/**
 * يرسل رسالة واحدة. يعيد {ok:true} أو {ok:false,error} — ولا يرمي أبداً:
 * كل مستدعٍ هنا يرسل إشعاراً جانبياً، وسقوط الإشعار يجب ألا يسقط الطلب نفسه.
 *
 * ملاحظة: بوابة ACS تردّ 202 لا 200 — القبول للطابور لا تسليماً نهائياً.
 */
export async function sendMail({ to, subject, html, text, from, replyTo, attachments } = {}) {
  const c = config();
  const recipients = String(to || "")
    .split(",")
    .map((x) => x.trim())
    .filter(isEmail)
    .map((address) => ({ address }));
  if (!recipients.length) return { ok: false, error: "no_recipient" };
  if (!c.endpoint || !c.accessKey) return { ok: false, error: "email_not_configured" };

  const sender = splitAddress(from || c.sender);
  if (!isEmail(sender.address)) return { ok: false, error: "sender_not_configured" };

  const payload = {
    senderAddress: sender.address,
    content: {
      subject: String(subject || "").slice(0, 900),
      // ACS يرفض رسالة بلا أي محتوى؛ ونصٌّ مجرّد إلى جانب الHTML يحسّن
      // التسليم ويخدم قارئات البريد التي لا تعرض HTML.
      html: html || undefined,
      plainText: text || (html ? String(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : undefined),
    },
    recipients: { to: recipients },
  };
  if (sender.displayName) payload.senderUsername = sender.displayName;
  const files = toAcsAttachments(attachments);
  if (files) payload.attachments = files;
  const rt = replyTo ? splitAddress(replyTo) : null;
  if (rt && isEmail(rt.address)) payload.replyTo = [rt];

  const url = `${c.endpoint}/emails:send?api-version=${encodeURIComponent(c.apiVersion)}`;
  const body = JSON.stringify(payload);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...sign("POST", url, body, c.accessKey) },
      body,
    });
    if (r.ok) return { ok: true, id: r.headers.get("x-ms-request-id") || undefined };
    // نص الخطأ يفيد في التشخيص ولا يحمل سرّاً، لكنه قد يطول — يُقتطع.
    const detail = (await r.text().catch(() => "")).slice(0, 200);
    return { ok: false, error: `http_${r.status}`, detail };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || "email_failed").slice(0, 120) };
  }
}

export default sendMail;
