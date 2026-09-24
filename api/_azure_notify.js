// Business Partner — إرسال البريد عبر Azure Communication Services (ACS).
// البنية التحتية الرقمية على Microsoft Azure (قرار المالك، سبتمبر 2026).
//
// هذه الوحدة هي الموضع الوحيد الذي يعرف كيف يُوقَّع طلب ACS ويُبنى جسمه.
// نداء الإرسال كان مكرراً نصّاً في خمسة عشر موضعاً عبر ثلاثة عشر ملفاً، فكل
// تبديل مزوّد يعني خمس عشرة تعديلة متطابقة وفرصةً لأن يُنسى أحدها فيبقى بريد
// واحد خارج أزور بلا أن يظهر ذلك في أي شاشة.
//
// ACS لا يقبل مفتاحاً في ترويسة بسيطة كما تفعل أكثر الخدمات: يوقّع الطلب
// بـHMAC-SHA256 على نصٍّ يجمع الفعل والمسار والتاريخ والمضيف وبصمة الجسم.
// أي حرف يزيد أو ينقص في ذلك النص يعطي 401 لا تشرح نفسها، ولا تظهر إلا بعد
// النشر — حين تكون الرسالة التي لم تصل رمزَ دخول عميل أو عرض سعر. لذلك
// يثبّت `tests/azure-mail.test.mjs` التوقيع بحسابٍ مستقل.
//
// مهيّأ عبر متغيّرات البيئة (أضِفها في Vercel):
//   ACS_CONNECTION_STRING = "endpoint=https://<res>.<region>.communication.azure.com/;accesskey=<key>"
//   ACS_SENDER_ADDRESS    = "DoNotReply@<verified-domain>"  (أو "اسم <عنوان>")
// وتُقبل مفرّقةً لمن يفضّل Key Vault لكل قيمة: ACS_ENDPOINT و ACS_ACCESS_KEY.
//
// عند غياب الإعداد يرجع الإرسال بفشلٍ مسمّى ليقع المستدعي على Resend دون
// كسر شيء — الهجرة تدريجية، ولا يصحّ أن يسقط إشعارٌ لأن مورد أزور لم يُهيّأ بعد.
import { createHmac, createHash } from "node:crypto";

function acsConfig() {
  const cs = String(process.env.ACS_CONNECTION_STRING || process.env.AZURE_COMMUNICATION_CONNECTION_STRING || "").trim();
  let endpoint = String(process.env.ACS_ENDPOINT || "").trim();
  let key = String(process.env.ACS_ACCESS_KEY || "").trim();
  if (cs) {
    // القسمة على أول «=» وحده: مفتاح base64 قد ينتهي بحشوة «=».
    for (const part of cs.split(";")) {
      const i = part.indexOf("=");
      if (i < 0) continue;
      const k = part.slice(0, i).trim().toLowerCase();
      const v = part.slice(i + 1).trim();
      if (k === "endpoint" && !endpoint) endpoint = v;
      if (k === "accesskey" && !key) key = v;
    }
  }
  const sender = String(process.env.ACS_SENDER_ADDRESS || process.env.AZURE_ACS_SENDER || "").trim();
  if (!endpoint || !key || !sender) return null;
  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    key,
    sender,
    apiVersion: String(process.env.ACS_API_VERSION || "2023-03-31").trim(),
  };
}

export function azureEmailReady() { return !!acsConfig(); }

/** أسماء ما ينقص — للتشخيص وحده، ولا تُرجِع قيمة سرٍّ أبداً. */
export function azureMailStatus() {
  const cs = String(process.env.ACS_CONNECTION_STRING || process.env.AZURE_COMMUNICATION_CONNECTION_STRING || "").trim();
  return {
    provider: "azure-communication-services",
    endpointSet: !!(cs.match(/endpoint=/i) || String(process.env.ACS_ENDPOINT || "").trim()),
    accessKeySet: !!(cs.match(/accesskey=/i) || String(process.env.ACS_ACCESS_KEY || "").trim()),
    senderSet: !!String(process.env.ACS_SENDER_ADDRESS || process.env.AZURE_ACS_SENDER || "").trim(),
    ready: azureEmailReady(),
  };
}

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());

// «فلان <a@b.c>» يصلح عنواناً للمُرسِل في Resend، وهو الشكل المكتوب في كل
// ملف هنا (`OTP_FROM_EMAIL` وأمثاله). أما ACS فيريد `senderAddress` عنواناً
// مجرّداً، ومن مرّر الشكل الكامل حصل على 400.
//
// الاسم المعروض لا يُرسل مع الرسالة: في ACS يُضبط على النطاق نفسه في المورد
// (MailFrom display name)، ولا حقل موثّقاً له في جسم `emails:send`. وإرسال
// حقلٍ غير موثّق مخاطرةٌ غير متناظرة — إن رفضته البوابة سقط كل بريد.
function splitAddress(raw) {
  const s = String(raw || "").trim();
  const m = s.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { address: m[2].trim(), displayName: m[1].replace(/^"|"$/g, "").trim() || undefined };
  return { address: s, displayName: undefined };
}

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

// توقيع HMAC-SHA256 المطلوب لمصادقة ACS بالمفتاح (حسب توثيق Azure).
// المسار المُوقَّع يشمل الاستعلام: `/emails:send?api-version=…` بحروفه.
function signedHeaders({ endpoint, key }, method, pathWithQuery, bodyStr) {
  const host = new URL(endpoint).host;
  const date = new Date().toUTCString(); // RFC1123 بتوقيت عالمي — «GMT» علامته
  const contentHash = createHash("sha256").update(bodyStr, "utf8").digest("base64");
  const stringToSign = `${method}\n${pathWithQuery}\n${date};${host};${contentHash}`;
  const signature = createHmac("sha256", Buffer.from(key, "base64")).update(stringToSign, "utf8").digest("base64");
  return {
    "x-ms-date": date,
    "x-ms-content-sha256": contentHash,
    "Authorization": `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}`,
    "content-type": "application/json",
  };
}

/**
 * يرسل رسالة واحدة. يعيد {ok:true} أو {ok:false,error} — ولا يرمي أبداً:
 * أكثر المستدعين هنا يرسلون إشعاراً جانبياً، وسقوط الإشعار يجب ألا يسقط
 * الطلب نفسه.
 *
 * `to` عنوانٌ واحد أو مصفوفة أو سلسلة مفصولة بفواصل.
 * `attachments` بشكل Resend: [{filename, content}] والمحتوى base64.
 *
 * ملاحظة: بوابة ACS تردّ 202 لا 200 — قبولٌ للطابور لا تسليماً نهائياً.
 */
export async function azureSendMail({ to, subject, html, text, from, replyTo, attachments } = {}) {
  const cfg = acsConfig();
  const recipients = (Array.isArray(to) ? to : String(to || "").split(","))
    .map((x) => String(x || "").trim())
    .filter(isEmail)
    .map((address) => ({ address }));
  if (!recipients.length) return { ok: false, error: "no_recipient" };
  if (!cfg) return { ok: false, error: "email_not_configured" };

  const sender = splitAddress(from || cfg.sender);
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
  const files = toAcsAttachments(attachments);
  if (files) payload.attachments = files;
  const rt = replyTo ? splitAddress(replyTo) : null;
  if (rt && isEmail(rt.address)) payload.replyTo = [{ address: rt.address, ...(rt.displayName ? { displayName: rt.displayName } : {}) }];

  const pathWithQuery = `/emails:send?api-version=${encodeURIComponent(cfg.apiVersion)}`;
  const body = JSON.stringify(payload);
  try {
    const r = await fetch(`${cfg.endpoint}${pathWithQuery}`, {
      method: "POST",
      headers: signedHeaders(cfg, "POST", pathWithQuery, body),
      body,
    });
    if (r.status === 202 || r.ok) return { ok: true, id: r.headers.get("x-ms-request-id") || undefined };
    // نص الخطأ يفيد في التشخيص ولا يحمل سرّاً، لكنه قد يطول — يُقتطع.
    const detail = (await r.text().catch(() => "")).slice(0, 200);
    console.error("ACS email failed", r.status, detail);
    return { ok: false, error: `http_${r.status}`, detail };
  } catch (e) {
    console.error("ACS email exception", String(e).slice(0, 150));
    return { ok: false, error: String((e && e.message) || "email_failed").slice(0, 120) };
  }
}

/**
 * الشكل المنطقي القديم: يعيد true/false. محفوظ لأن `api/requests.js` يستدعيه
 * هكذا منذ أول ربطٍ بأزور، وتغيير شكل الإرجاع تحته يُسكت فشلاً بدل أن يظهره.
 */
export async function azureSendEmail(to, subject, html, attachments) {
  const r = await azureSendMail({ to, subject, html, attachments });
  return r.ok;
}
