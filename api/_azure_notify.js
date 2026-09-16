// Business Partner — إشعارات باهر عبر Azure Communication Services (ACS).
// البنية التحتية الرقمية على Microsoft Azure (قرار المالك، سبتمبر 2026):
// إيميلات باهر (تأكيد الحجز/التذكرة/عرض السعر وتنبيه الفريق) تُرسل من Azure.
//
// مهيّأ عبر متغيّرات البيئة (أضِفها في Vercel):
//   ACS_CONNECTION_STRING = "endpoint=https://<res>.<region>.communication.azure.com/;accesskey=<key>"
//   ACS_SENDER_ADDRESS    = "DoNotReply@<verified-domain>"  (أو عنوان النطاق المُدار من Azure)
// عند غيابهما ترجع الدالة false ليقع الاتصال على المزوّد الحالي (Resend) دون كسر شيء.
import { createHmac, createHash } from "node:crypto";

function acsConfig() {
  const cs = String(process.env.ACS_CONNECTION_STRING || process.env.AZURE_COMMUNICATION_CONNECTION_STRING || "").trim();
  const sender = String(process.env.ACS_SENDER_ADDRESS || process.env.AZURE_ACS_SENDER || "").trim();
  if (!cs || !sender) return null;
  const ep = (cs.match(/endpoint=([^;]+)/i) || [])[1];
  const key = (cs.match(/accesskey=([^;]+)/i) || [])[1];
  if (!ep || !key) return null;
  return { endpoint: ep.replace(/\/+$/, ""), key, sender };
}

export function azureEmailReady() { return !!acsConfig(); }

// توقيع HMAC-SHA256 المطلوب لمصادقة ACS بالمفتاح (حسب توثيق Azure).
function signedHeaders({ endpoint, key }, method, pathWithQuery, bodyStr) {
  const host = new URL(endpoint).host;
  const date = new Date().toUTCString();
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

// يرسل إيميل HTML عبر Azure. يرجع true عند النجاح، false ليُستخدم البديل.
export async function azureSendEmail(to, subject, html) {
  const cfg = acsConfig();
  if (!cfg || !to || !subject) return false;
  const apiVersion = "2023-03-31";
  const pathWithQuery = `/emails:send?api-version=${apiVersion}`;
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean).map((address) => ({ address }));
  const body = JSON.stringify({
    senderAddress: cfg.sender,
    content: { subject: String(subject).slice(0, 240), html: String(html || "") },
    recipients: { to: recipients },
  });
  try {
    const r = await fetch(`${cfg.endpoint}${pathWithQuery}`, {
      method: "POST",
      headers: signedHeaders(cfg, "POST", pathWithQuery, body),
      body,
    });
    if (r.status === 202 || r.ok) return true;
    console.error("ACS email failed", r.status, (await r.text()).slice(0, 200));
    return false;
  } catch (e) {
    console.error("ACS email exception", String(e).slice(0, 150));
    return false;
  }
}
