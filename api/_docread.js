// Read a client's VAT certificate, commercial registration or national address
// document and return the fields an invoice needs, so nobody types them.
//
// Every provider here is already configured for the site's advisor (api/chat.js)
// — this module adds the vision/document calls that file does not make. Gemini
// goes first: it is on a free tier, reads Arabic scans well, and accepts PDFs
// directly. Anthropic is the fallback for PDFs and images, OpenAI for images.
//
// Nothing is stored: the upload is read, the fields come back, the bytes are
// dropped. The extracted values are a starting point for a human to confirm —
// a wrong VAT number on an issued tax invoice cannot be edited, only voided.

import { chat as aiChat, vision as aiVision, aiConfigured } from "./_ai.js";

export const MAX_DOC_BYTES = 6 * 1024 * 1024;
export const DOC_MIME_OK = /^(image\/(jpeg|jpg|png|webp|heic|heif)|application\/pdf)$/i;

const PROMPT = `أنت مساعد يقرأ مستندات سعودية رسمية ويستخرج منها بيانات المنشأة وبيانات الفوترة الضريبية وتواريخ الصلاحية.
المستند قد يكون: شهادة تسجيل في ضريبة القيمة المضافة، أو سجلاً تجارياً، أو وثيقة العنوان الوطني، أو رخصة بلدية أو مهنية، أو شهادة التأمينات (GOSI)، أو شهادة الزكاة، أو هوية/إقامة، أو عقداً، أو صورة من أي منها.

استخرج ما يظهر فعلاً في المستند فقط. لا تخمّن ولا تُكمل ناقصاً — أي حقل غير ظاهر اتركه نصاً فارغاً "".

أعِد JSON فقط، بلا أي شرح وبلا علامات تنسيق، بهذا الشكل بالضبط:
{
  "docType": "vat_certificate" أو "cr" أو "national_address" أو "license" أو "gosi" أو "zakat" أو "id" أو "contract" أو "other",
  "docTitle": "اسم المستند كما يظهر في عنوانه (مثال: شهادة تسجيل في ضريبة القيمة المضافة)",
  "issueDate": "تاريخ إصدار المستند بالميلادي بصيغة YYYY-MM-DD إن ظهر",
  "expiryDate": "تاريخ انتهاء/نهاية صلاحية المستند بالميلادي بصيغة YYYY-MM-DD إن ظهر",
  "issueDateHijri": "تاريخ الإصدار الهجري نصاً كما هو مكتوب إن ظهر هجرياً فقط",
  "expiryDateHijri": "تاريخ الانتهاء الهجري نصاً كما هو مكتوب إن ظهر هجرياً فقط",
  "companyNameAr": "اسم المنشأة بالعربي كما هو مكتوب",
  "companyNameEn": "الاسم بالإنجليزي إن وُجد",
  "vatNumber": "الرقم الضريبي — 15 رقماً بالضبط، أرقام فقط",
  "crNumber": "رقم السجل التجاري — أرقام فقط",
  "address": {
    "buildingNo": "رقم المبنى",
    "street": "اسم الشارع",
    "district": "الحي",
    "city": "المدينة",
    "postalCode": "الرمز البريدي",
    "additionalNo": "الرقم الإضافي"
  },
  "contactName": "اسم المالك أو الشخص المسؤول إن ظهر",
  "contactPhone": "رقم الجوال إن ظهر",
  "confidence": "high" أو "medium" أو "low"
}

انتبه: الرقم الضريبي في السعودية 15 خانة ويبدأ وينتهي بالرقم 3. رقم السجل التجاري عادة 10 خانات. لا تخلط بينهما.
التواريخ: إن ظهر التاريخ ميلادياً وهجرياً معاً فأعد الميلادي في issueDate/expiryDate. وإن ظهر هجرياً فقط فلا تحوّله بنفسك — ضعه نصاً في الحقل الهجري واترك الميلادي فارغاً.`;

// Close a JSON document that was cut off mid-flight (the model hit its output
// cap). A fill plan of 60 operations truncated at 55 is worth 55 filled fields;
// throwing it away is what made the agent look dead. Trailing partial tokens
// are dropped, then every open string/array/object is closed.
function repairJson(raw) {
  let inStr = false, esc = false, lastSafe = -1;
  const stack = [];
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') { inStr = false; if (stack.length) lastSafe = i; }
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{" || c === "[") stack.push(c === "{" ? "}" : "]");
    else if (c === "}" || c === "]") { stack.pop(); lastSafe = i; }
    else if (c === "," || /\d/.test(c) || c === "e" || c === "l") lastSafe = i; // number/true/false/null tails
  }
  if (!stack.length) return null;
  let out = raw.slice(0, lastSafe + 1).replace(/,\s*$/, "");
  // a key whose value never arrived ("foo": or a value cut mid-string) cannot
  // be closed — drop the dangling pair, keeping every complete one before it
  out = out.replace(/,\s*"[^"]*"\s*:?\s*$/, "").replace(/\{\s*"[^"]*"\s*:?\s*$/, "{");
  for (let i = stack.length - 1; i >= 0; i--) out += stack[i];
  try { return JSON.parse(out); } catch { return null; }
}

export function parseJson(text) {
  const raw = String(text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = raw.indexOf("{");
  if (start === -1) return null;
  const end = raw.lastIndexOf("}");
  if (end > start) {
    try { return JSON.parse(raw.slice(start, end + 1)); } catch {}
  }
  return repairJson(raw.slice(start));
}

// Gemini 2.5 models think by default and charge that thinking to the SAME
// output budget as the answer — a 4k cap can be spent entirely on thoughts,
// returning an empty candidate. Every call here is structured extraction, so
// thinking is switched off explicitly; models that reject the field are
// retried once without it.
// قراءة الصور عبر Azure OpenAI. وواجهة الرؤية على أزور تقبل الصور في
// image_url ولا تقبل PDF — بخلاف جيميني الذي كان يبتلعه مباشرة. فالـPDF يُردّ
// هنا بخطأ يسمّي سببه بدل أن يفشل فشلاً غامضاً: قراءته تحتاج
// Azure AI Document Intelligence، وهي خدمة أخرى لم تُهيّأ بعد.
const PDF_RE = /pdf/i;

async function readWithAzure(base64, mime, prompt, maxTokens) {
  if (!aiConfigured()) throw new Error("no_key");
  if (PDF_RE.test(String(mime || ""))) throw new Error("pdf_needs_document_intelligence");
  return parseJson(await aiVision(base64, mime, prompt || PROMPT, { maxTokens: maxTokens || 900 }));
}

function clean(raw) {
  const a = (raw && raw.address) || {};
  const vat = digits(raw && raw.vatNumber);
  const isoDate = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "").trim()) ? String(v).trim() : "");
  return {
    docType: ["vat_certificate", "cr", "national_address", "license", "gosi", "zakat", "id", "contract", "other"].includes(raw && raw.docType) ? raw.docType : "other",
    docTitle: txt(raw && raw.docTitle, 160),
    issueDate: isoDate(raw && raw.issueDate),
    expiryDate: isoDate(raw && raw.expiryDate),
    issueDateHijri: txt(raw && raw.issueDateHijri, 40),
    expiryDateHijri: txt(raw && raw.expiryDateHijri, 40),
    companyNameAr: txt(raw && raw.companyNameAr, 200),
    companyNameEn: txt(raw && raw.companyNameEn, 200),
    vatNumber: vat.length === 15 ? vat : "",
    vatSuspect: vat.length > 0 && vat.length !== 15 ? vat : "",
    crNumber: digits(raw && raw.crNumber).slice(0, 15),
    address: {
      buildingNo: digits(a.buildingNo).slice(0, 4),
      street: txt(a.street, 120),
      district: txt(a.district, 120),
      city: txt(a.city, 60),
      postalCode: digits(a.postalCode, 5),
      additionalNo: digits(a.additionalNo).slice(0, 4),
    },
    contactName: txt(raw && raw.contactName, 120),
    contactPhone: txt(raw && raw.contactPhone, 40).replace(/[^\d+]/g, ""),
    confidence: ["high", "medium", "low"].includes(raw && raw.confidence) ? raw.confidence : "medium",
  };
}

// Same provider chain, caller-supplied prompt, no invoice-specific clean().
// The AI Document Agent (api/_docagent.js) uses this for classification,
// arbitrary-form field mapping and fill planning — tasks whose schema is not
// the fixed invoice schema above.
export async function readDocumentRaw(base64, mime, prompt, maxTokens) {
  if (!base64) return { ok: false, error: "no_file" };
  if (!DOC_MIME_OK.test(String(mime || ""))) return { ok: false, error: "bad_type" };
  if (Buffer.byteLength(base64, "base64") > MAX_DOC_BYTES) return { ok: false, error: "too_large" };
  try {
    const raw = await readWithAzure(base64, mime, prompt, maxTokens);
    if (raw) return { ok: true, data: raw, provider: "azure-openai" };
    return { ok: false, error: "read_failed" };
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (msg === "no_key") return { ok: false, error: "not_configured" };
    if (msg === "pdf_needs_document_intelligence") return { ok: false, error: msg };
    console.error("docread raw azure-openai", msg.slice(0, 160));
    return { ok: false, error: "read_failed" };
  }
}

// Text-only model call over the same provider chain (no attachment) — used by
// the doc agent for reconciliation, gap analysis and fill planning where the
// inputs are already extracted text, not bytes.
export async function askModel(prompt, maxTokens) {
  if (!aiConfigured()) return { ok: false, error: "not_configured" };
  try {
    const text = await aiChat([{ role: "user", content: prompt }], null, { maxTokens: maxTokens || 2048 });
    const parsed = parseJson(text);
    if (parsed) return { ok: true, data: parsed, provider: "azure-openai" };
    return { ok: false, error: "read_failed", detail: "azure-openai: unparsable" };
  } catch (e) {
    const msg = String((e && e.message) || e).slice(0, 300);
    console.error("askModel azure-openai", msg.slice(0, 160));
    return { ok: false, error: "read_failed", detail: `azure-openai: ${msg}` };
  }
}

/**
 * @param {string} base64  the file, base64 with no data: prefix
 * @param {string} mime    image/* or application/pdf
 * @returns {{ok:true, fields:object, provider:string} | {ok:false, error:string}}
 */
export async function readDocument(base64, mime) {
  if (!base64) return { ok: false, error: "no_file" };
  if (!DOC_MIME_OK.test(String(mime || ""))) return { ok: false, error: "bad_type" };
  if (Buffer.byteLength(base64, "base64") > MAX_DOC_BYTES) return { ok: false, error: "too_large" };

  try {
    const raw = await readWithAzure(base64, mime, PROMPT, 900);
    if (raw) return { ok: true, fields: clean(raw), provider: "azure-openai" };
    return { ok: false, error: "read_failed", detail: "azure-openai: unparsable" };
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (msg === "no_key") return { ok: false, error: "not_configured" };
    if (msg === "pdf_needs_document_intelligence") return { ok: false, error: msg, detail: "PDF يحتاج Azure AI Document Intelligence" };
    console.error("docread azure-openai", msg.slice(0, 160));
    return { ok: false, error: "read_failed", detail: `azure-openai: ${msg.slice(0, 200)}` };
  }
}
