// Business Partner — غلاف توافق واجهة Vercel لدوال api/*.js على Azure.
//
// دوال api/ مكتوبة على واجهة Vercel Node: `export default (req, res)` مع
// `req.query` و`req.cookies` و`req.body` المحلَّل مسبقاً، و`res.status().json()`.
// هذا الملف يعيد تلك الواجهة فوق خادم Node عادي (server.mjs)، فلا يُلمس سطرٌ
// في api/ — وهي ملك وكلاء آخرين. وهو الغلاف الذي يُغني عن «محوّل Azure
// Functions»: الحاوية تُشغّل الدوال كما هي، لا بنموذج برمجة مختلف.
//
// قواعد الجسم (مأخوذة من سلوك Vercel وما تعتمد عليه الدوال فعلاً):
//   application/json                  → كائن (وإن فسد: النص الخام، لتبقى الدالة هي التي ترفض)
//   application/x-www-form-urlencoded → كائن
//   text/*                            → نص
//   غير ذلك                           → Buffer
//   فارغ                              → undefined
// وتبقى القراءة من الـstream ممكنة بعد التحليل (الدوال تفعل `req.on("end")`
// كاحتياط)، فيُعاد تقديم الجسم نفسه في Readable جديد — بدونه تتعلّق أي دالة
// تقرأ الـstream بعد أن استُهلك.

import { Readable } from "node:stream";

export const MAX_BODY_BYTES = 4.5 * 1024 * 1024; // سقف Vercel لجسم الدالة

export class HttpError extends Error {
  constructor(status, code, message) { super(message || code); this.status = status; this.code = code; }
}

export async function collectBody(req, limit = MAX_BODY_BYTES) {
  const declared = Number(req.headers["content-length"] || 0);
  if (declared > limit) throw new HttpError(413, "FUNCTION_PAYLOAD_TOO_LARGE");
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new HttpError(413, "FUNCTION_PAYLOAD_TOO_LARGE");
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

export function parseBody(buf, contentType) {
  if (!buf || !buf.length) return undefined;
  const type = String(contentType || "").split(";")[0].trim().toLowerCase();
  const text = () => buf.toString("utf8");
  if (type === "application/json" || type.endsWith("+json")) {
    try { return JSON.parse(text()); } catch { return text(); }
  }
  if (type === "application/x-www-form-urlencoded") {
    const o = {};
    for (const [k, v] of new URLSearchParams(text())) {
      if (k in o) o[k] = [].concat(o[k], v); else o[k] = v;
    }
    return o;
  }
  if (type.startsWith("text/")) return text();
  return buf;
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || "").split(";")) {
    const i = part.indexOf("=");
    if (i < 1) continue;
    const k = part.slice(0, i).trim();
    if (!k) continue;
    let v = part.slice(i + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    try { v = decodeURIComponent(v); } catch { /* قيمة معطوبة تبقى كما وصلت */ }
    if (!(k in out)) out[k] = v;
  }
  return out;
}

// عنوان العميل. خلف مدخل Container Apps يُلحق المدخل عنوان المتصل في **نهاية**
// X-Forwarded-For، وما قبله يكتبه العميل نفسه. الدوال تقرأ أول عنصر (مثل ما
// يفعل Vercel الذي يستبدل الترويسة كلها)، فبدون هذا التطبيع يستطيع أي زائر
// انتحال عنوانه بترويسة واحدة والتهرّب من حدود المعدّل وسجلات التوقيع.
// hops = عدد الوكلاء الموثوقين أمام الخادم: 1 مدخل Container Apps وحده،
// 2 إن وُضع Front Door أمامه.
export function clientIp(headers, remoteAddress, hops = 1) {
  const list = String(headers["x-forwarded-for"] || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (list.length) return list[Math.max(0, list.length - Math.max(1, hops))];
  return String(remoteAddress || "").replace(/^::ffff:/, "");
}

// يبني طلباً بصيغة Vercel من الطلب الخام. `rewritten` = المسار+الاستعلام بعد الـrewrite.
export function toVercelRequest(raw, { rewritten, body, hops = 1, parse = true }) {
  const u = new URL(rewritten, "http://x");
  const query = {};
  for (const [k, v] of u.searchParams) {
    if (k in query) query[k] = [].concat(query[k], v); else query[k] = v;
  }
  const headers = { ...raw.headers };
  const ip = clientIp(headers, raw.socket && raw.socket.remoteAddress, hops);
  if (ip) { headers["x-forwarded-for"] = ip; headers["x-real-ip"] = ip; }
  // لا تُقبل ترويسات منصّة Vercel من الخارج: لا شيء هنا يُصدرها، فوجودها انتحال.
  for (const k of Object.keys(headers)) if (k.startsWith("x-vercel-")) delete headers[k];

  const stream = Readable.from(body && body.length ? [body] : []);
  const req = stream;
  req.method = raw.method;
  req.url = u.pathname + u.search;
  req.headers = headers;
  req.rawHeaders = raw.rawHeaders;
  req.httpVersion = raw.httpVersion;
  req.socket = raw.socket;
  req.connection = raw.socket;
  req.query = query;
  req.cookies = parseCookies(headers.cookie);
  req.body = parse ? parseBody(body, headers["content-type"]) : undefined;
  return req;
}

export function decorateResponse(res) {
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => {
    if (!res.hasHeader("content-type")) res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify(o));
    return res;
  };
  res.send = (b) => {
    if (b !== null && typeof b === "object" && !Buffer.isBuffer(b)) return res.json(b);
    res.end(b === undefined ? undefined : b);
    return res;
  };
  res.redirect = (a, b) => {
    const [code, loc] = typeof a === "number" ? [a, b] : [307, a];
    res.statusCode = code;
    res.setHeader("location", loc);
    res.end();
    return res;
  };
  return res;
}
