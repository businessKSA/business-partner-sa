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

const envFrom = (names) => { for (const n of names) { if (process.env[n] && String(process.env[n]).trim()) return String(process.env[n]).trim(); } return ""; };
const GEMINI_KEYS = ["GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GEMINI_API_KEY", "GEMINI_KEY", "GEMINI_APIKEY", "GEMINI", "BusinessPartnerGimini", "BusinessPartnerGemini"];
const ANTHROPIC_KEYS = ["ANTHROPIC_API_KEY", "ANTHROPIC_KEY", "CLAUDE_API_KEY"];
const OPENAI_KEYS = ["OPENAI_API_KEY", "OPENAI_KEY", "OPENAI"];

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

function parseJson(text) {
  const raw = String(text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
}

async function readWithGemini(base64, mime) {
  const key = envFrom(GEMINI_KEYS);
  if (!key) throw new Error("no_key");
  const model = process.env.GEMINI_VISION_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ inline_data: { mime_type: mime, data: base64 } }, { text: PROMPT }] }],
      generationConfig: { maxOutputTokens: 900, temperature: 0, responseMimeType: "application/json" },
    }),
  });
  if (!r.ok) throw new Error(`gemini ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  const parts = (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
  return parseJson(parts.map((p) => p.text || "").join(""));
}

async function readWithAnthropic(base64, mime) {
  const key = envFrom(ANTHROPIC_KEYS);
  if (!key) throw new Error("no_key");
  const isPdf = /pdf/i.test(mime);
  const block = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : { type: "image", source: { type: "base64", media_type: mime, data: base64 } };
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-4-8",
      max_tokens: 900,
      messages: [{ role: "user", content: [block, { type: "text", text: PROMPT }] }],
    }),
  });
  if (!r.ok) throw new Error(`anthropic ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  return parseJson((data.content || []).map((c) => c.text || "").join(""));
}

async function readWithOpenAI(base64, mime) {
  const key = envFrom(OPENAI_KEYS);
  if (!key) throw new Error("no_key");
  if (/pdf/i.test(mime)) throw new Error("pdf_unsupported");
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
      max_tokens: 900,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: [{ type: "text", text: PROMPT }, { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } }] }],
    }),
  });
  if (!r.ok) throw new Error(`openai ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  return parseJson(data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content);
}

const digits = (v, len) => {
  const d = String(v == null ? "" : v).replace(/\D/g, "");
  return len ? (d.length === len ? d : "") : d;
};
const txt = (v, max = 160) => String(v == null ? "" : v).trim().slice(0, max);

// The model is told to leave unseen fields blank, but a wrong VAT number on an
// issued tax invoice cannot be edited — only voided and reissued. So anything
// that is not the right shape is dropped here rather than offered as a value.
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

/**
 * @param {string} base64  the file, base64 with no data: prefix
 * @param {string} mime    image/* or application/pdf
 * @returns {{ok:true, fields:object, provider:string} | {ok:false, error:string}}
 */
export async function readDocument(base64, mime) {
  if (!base64) return { ok: false, error: "no_file" };
  if (!DOC_MIME_OK.test(String(mime || ""))) return { ok: false, error: "bad_type" };
  if (Buffer.byteLength(base64, "base64") > MAX_DOC_BYTES) return { ok: false, error: "too_large" };

  const providers = [
    ["gemini", readWithGemini],
    ["anthropic", readWithAnthropic],
    ["openai", readWithOpenAI],
  ];
  const tried = [];
  for (const [name, call] of providers) {
    try {
      const raw = await call(base64, mime);
      if (raw) return { ok: true, fields: clean(raw), provider: name };
      tried.push(`${name}: unparsable`);
    } catch (e) {
      const msg = String(e.message || e);
      if (msg !== "no_key" && msg !== "pdf_unsupported") console.error("docread", name, msg.slice(0, 160));
      tried.push(`${name}: ${msg.slice(0, 60)}`);
    }
  }
  const anyKey = envFrom(GEMINI_KEYS) || envFrom(ANTHROPIC_KEYS) || envFrom(OPENAI_KEYS);
  return { ok: false, error: anyKey ? "read_failed" : "not_configured", detail: tried.join(" · ").slice(0, 300) };
}
