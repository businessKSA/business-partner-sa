// Business Partner — DocuSign eSignature, for the contract between the
// accepted quote and the invoice.
//
// Underscore-prefixed so Vercel treats it as a module, not a 13th serverless
// function — the plan caps at 12.
//
// Auth is JWT Grant: the app holds an RSA private key, signs an assertion for
// one impersonated user, and exchanges it for an access token. No user is
// present when a contract goes out, so the interactive flows do not apply.
// Signing is done with node's crypto — this repo adds no dependencies.
//
// Env:
//   DOCUSIGN_INTEGRATION_KEY  the app's Integration Key (client id)
//   DOCUSIGN_USER_ID          API Username (a GUID) of the impersonated user
//   DOCUSIGN_ACCOUNT_ID       the account the envelopes are created in
//   DOCUSIGN_PRIVATE_KEY      the RSA private key, PEM, newlines or \n escapes
//   DOCUSIGN_ENV              "demo" (default) or "production"
//
// A word on jurisdiction, because it decides whether any of this is the right
// tool: DocuSign is accepted for commercial agreements between the parties to
// them. A document that must stand before a Saudi government body needs نفاذ —
// this does not substitute for it, and nothing here should be read as saying
// it does.

import { createSign } from "crypto";

const env = (n, d = "") => (process.env[n] && String(process.env[n]).trim()) || d;
const INTEGRATION_KEY = env("DOCUSIGN_INTEGRATION_KEY");
const USER_ID = env("DOCUSIGN_USER_ID");
const ACCOUNT_ID = env("DOCUSIGN_ACCOUNT_ID");
// Vercel's UI keeps real newlines, but a key pasted through a shell often
// arrives with literal \n. Both are accepted rather than one being assumed.
const PRIVATE_KEY = env("DOCUSIGN_PRIVATE_KEY").replace(/\\n/g, "\n");
const IS_PROD = /^prod/i.test(env("DOCUSIGN_ENV", "demo"));
const OAUTH_HOST = IS_PROD ? "account.docusign.com" : "account-d.docusign.com";
// DocuSign's admin screen shows the Account Base URI without the /restapi
// suffix the API needs ("https://demo.docusign.net"), so a value copied
// straight off that screen — the obvious thing to do — would 404 every call.
// Both forms are accepted.
const API_BASE = (() => {
  const raw = env("DOCUSIGN_BASE_URI", IS_PROD ? "https://na1.docusign.net" : "https://demo.docusign.net").replace(/\/+$/, "");
  return /\/restapi$/.test(raw) ? raw : `${raw}/restapi`;
})();
const SITE = env("MKT_SITE_BASE", "https://www.businesspartner.sa");

export const docusignConfigured = () => !!(INTEGRATION_KEY && USER_ID && ACCOUNT_ID && PRIVATE_KEY);
export const docusignEnv = () => (IS_PROD ? "production" : "demo");

const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const esc = (v) => String(v == null ? "" : v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---- auth ------------------------------------------------------------------

let _token = null, _tokenExp = 0;

/**
 * A JWT Grant access token, cached for the warm instance. DocuSign issues these
 * for an hour; it is refreshed a minute early so a request never starts with a
 * token that expires mid-flight.
 */
export async function docusignToken() {
  if (!docusignConfigured()) throw new Error("docusign_not_configured");
  if (_token && Date.now() < _tokenExp - 60_000) return _token;

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: INTEGRATION_KEY,
    sub: USER_ID,
    aud: OAUTH_HOST,
    iat: now,
    exp: now + 3600,
    scope: "signature impersonation",
  }));
  let signature;
  try {
    const signer = createSign("RSA-SHA256");
    signer.update(`${header}.${claim}`);
    signer.end();
    signature = b64url(signer.sign(PRIVATE_KEY));
  } catch (e) {
    const err = new Error("docusign_bad_key");
    err.detail = `المفتاح الخاص غير مقروء: ${String(e.message || e).slice(0, 120)}`;
    throw err;
  }

  const r = await fetch(`https://${OAUTH_HOST}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claim}.${signature}`,
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.access_token) {
    // consent_required is the one failure with a specific, actionable remedy,
    // and it is the one that happens first — so it is named, not lumped in.
    if (String(data.error || "") === "consent_required") {
      const err = new Error("docusign_consent_required");
      err.detail = consentUrl();
      throw err;
    }
    const err = new Error("docusign_auth_failed");
    err.detail = `${r.status}: ${JSON.stringify(data).slice(0, 300)}`;
    throw err;
  }
  _token = data.access_token;
  _tokenExp = Date.now() + (Number(data.expires_in) || 3600) * 1000;
  return _token;
}

/**
 * The one-time consent URL. JWT impersonation does not work until the account
 * has granted it, and the grant is a human clicking this link once.
 */
export function consentUrl(redirect = `${SITE}/admin`) {
  return `https://${OAUTH_HOST}/oauth/auth?response_type=code&scope=signature%20impersonation` +
    `&client_id=${encodeURIComponent(INTEGRATION_KEY)}&redirect_uri=${encodeURIComponent(redirect)}`;
}

async function dsFetch(path, { method = "GET", body } = {}) {
  const token = await docusignToken();
  const r = await fetch(`${API_BASE}/v2.1/accounts/${ACCOUNT_ID}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!r.ok) {
    const err = new Error("docusign_failed");
    err.detail = `${r.status}: ${(data ? JSON.stringify(data) : text).slice(0, 400)}`;
    throw err;
  }
  return data;
}

// ---- the contract ----------------------------------------------------------

/**
 * The agreement itself, as HTML. DocuSign renders HTML documents directly, so
 * no PDF generator is needed and the Arabic stays right-to-left and selectable
 * rather than becoming an image of text.
 *
 * `/sig1/` and `/date1/` are anchor strings: DocuSign places the signature and
 * date fields wherever it finds them, so the tabs follow the text if the
 * template changes rather than sitting at fixed coordinates that silently drift.
 */
export function contractHtml({ ref, clientName, clientCr = "", clientVat = "", service, lines = [], net, vat, total, vatRate = 15, leadTime = "", executor = "", today = "" }) {
  const rows = (lines || []).length
    ? lines.map((l) => `<tr><td>${esc(l.name)}</td><td style="text-align:center">${Number(l.qty) || 1}</td><td style="text-align:left">${(Number(l.price) || 0) * (Number(l.qty) || 1)} ﷼</td></tr>`).join("")
    : `<tr><td colspan="3">${esc(service || "")}</td></tr>`;
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<style>
 body{font-family:Arial,"Traditional Arabic",sans-serif;direction:rtl;text-align:right;color:#1F2430;line-height:1.9;padding:36px;font-size:13.5px}
 h1{color:#0B1B5A;font-size:20px;margin:0 0 4px} h2{color:#0B1B5A;font-size:15px;margin:22px 0 6px}
 table{width:100%;border-collapse:collapse;margin:8px 0} td,th{border:1px solid #d9dee7;padding:7px 10px}
 th{background:#f1f5f9;text-align:right} .muted{color:#64748b;font-size:12px}
 .sign{margin-top:34px;border-top:1px solid #d9dee7;padding-top:18px}
 ol{padding-inline-start:18px}
</style></head><body>
<h1>عقد تقديم خدمات</h1>
<p class="muted">رقم المرجع: <b>${esc(ref)}</b> — تاريخ التحرير: ${esc(today)}</p>

<h2>أولاً: أطراف العقد</h2>
<p><b>الطرف الأول (مقدّم الخدمة):</b> شركة بيزنس بارتنر، سجل تجاري ومقر بالمملكة العربية السعودية.<br>
<b>الطرف الثاني (العميل):</b> ${esc(clientName)}${clientCr ? ` — سجل تجاري: ${esc(clientCr)}` : ""}${clientVat ? ` — الرقم الضريبي: ${esc(clientVat)}` : ""}.</p>
${executor ? `<p class="muted">يُنفّذ الطرف الأول هذه الخدمات بنفسه أو عبر شركائه المعتمدين${executor ? ` (${esc(executor)})` : ""}، ويظل مسؤولاً أمام العميل عن التنفيذ.</p>` : ""}

<h2>ثانياً: محل العقد</h2>
<p>يلتزم الطرف الأول بتقديم الخدمات الموضّحة أدناه:</p>
<table><thead><tr><th>البند</th><th style="text-align:center">الكمية</th><th style="text-align:left">القيمة</th></tr></thead><tbody>${rows}</tbody></table>

<h2>ثالثاً: المقابل المالي</h2>
<p>الإجمالي قبل الضريبة: <b>${net} ﷼</b><br>
ضريبة القيمة المضافة (${vatRate}%): <b>${vat} ﷼</b><br>
<b>الإجمالي المستحق: ${total} ﷼</b> (شامل ضريبة القيمة المضافة).</p>
<p>تُصدر فاتورة ضريبية نظامية بهذه القيمة عبر نظام الفوترة المعتمد لدى الطرف الأول، ويُسدَّد المقابل إلكترونياً أو بالتحويل البنكي.</p>

<h2>رابعاً: مدة التنفيذ</h2>
<p>${leadTime ? `يلتزم الطرف الأول بالتنفيذ خلال ${esc(leadTime)} من تاريخ سداد المقابل واستكمال العميل للمستندات المطلوبة.` : "يبدأ التنفيذ من تاريخ سداد المقابل واستكمال العميل للمستندات المطلوبة، وفق المدة المتفق عليها."}</p>

<h2>خامساً: التزامات العميل</h2>
<ol>
 <li>تزويد الطرف الأول بالمستندات والبيانات الصحيحة اللازمة للتنفيذ.</li>
 <li>سداد المقابل المالي في موعده.</li>
 <li>الرد على طلبات الاستيفاء خلال مدة معقولة؛ ولا يُحتسب على الطرف الأول أي تأخير ناشئ عن تأخر العميل.</li>
</ol>

<h2>سادساً: الرسوم الحكومية</h2>
<p>ما لم يُنص صراحةً على خلاف ذلك في جدول البنود أعلاه، لا تشمل قيمة هذا العقد الرسوم الحكومية أو رسوم الجهات الرسمية، ويتحملها العميل عند استحقاقها.</p>

<h2>سابعاً: السرية</h2>
<p>يلتزم كل طرف بالحفاظ على سرية ما يطّلع عليه من بيانات الطرف الآخر، وعدم إفشائها لغير أغراض تنفيذ هذا العقد أو ما توجبه الأنظمة.</p>

<h2>ثامناً: الإنهاء</h2>
<p>لأي طرف إنهاء العقد بإشعار كتابي عند إخلال الطرف الآخر بالتزاماته وعدم تصحيح الإخلال خلال خمسة عشر يوماً من الإشعار. ويُسوّى المستحق عن الأعمال المنفَّذة فعلياً حتى تاريخ الإنهاء.</p>

<h2>تاسعاً: النظام الواجب التطبيق</h2>
<p>يخضع هذا العقد لأنظمة المملكة العربية السعودية، وتختص الجهات القضائية المختصة بالمملكة بالفصل في أي نزاع ينشأ عنه.</p>

<div class="sign">
 <p><b>الطرف الثاني (العميل): ${esc(clientName)}</b></p>
 <p>التوقيع: /sig1/</p>
 <p>التاريخ: /date1/</p>
</div>
</body></html>`;
}

// ---- envelopes -------------------------------------------------------------

/**
 * Create and send the contract for signature.
 * @returns {{envelopeId:string, status:string, uri:string}}
 */
export async function docusignSendContract({ ref, email, clientName, subject, html }) {
  if (!docusignConfigured()) throw new Error("docusign_not_configured");
  const body = {
    emailSubject: String(subject || `عقد تقديم خدمات — ${ref}`).slice(0, 100),
    status: "sent",
    documents: [{
      documentBase64: Buffer.from(html, "utf8").toString("base64"),
      name: `عقد ${ref}`,
      fileExtension: "html",
      documentId: "1",
    }],
    recipients: {
      signers: [{
        email: String(email || "").trim(),
        name: String(clientName || "").slice(0, 100) || "العميل",
        recipientId: "1",
        routingOrder: "1",
        // Anchors, not coordinates: the fields follow the text.
        tabs: {
          signHereTabs: [{ anchorString: "/sig1/", anchorUnits: "pixels", anchorXOffset: "0", anchorYOffset: "0" }],
          dateSignedTabs: [{ anchorString: "/date1/", anchorUnits: "pixels", anchorXOffset: "0", anchorYOffset: "0" }],
        },
      }],
    },
    // Ties the envelope back to the order without a lookup table of our own.
    customFields: { textCustomFields: [{ name: "bp_ref", value: String(ref || "").slice(0, 100), show: "false" }] },
  };
  const out = await dsFetch("/envelopes", { method: "POST", body });
  return { envelopeId: out.envelopeId, status: out.status, uri: out.uri || "" };
}

/** Where an envelope has got to, and who has done what. */
export async function docusignStatus(envelopeId) {
  const e = await dsFetch(`/envelopes/${encodeURIComponent(envelopeId)}`);
  let recipients = null;
  try { recipients = await dsFetch(`/envelopes/${encodeURIComponent(envelopeId)}/recipients`); } catch { recipients = null; }
  const signers = ((recipients && recipients.signers) || []).map((s) => ({
    name: s.name, email: s.email, status: s.status, signedAt: s.signedDateTime || "",
  }));
  return {
    envelopeId,
    status: e.status,
    sentAt: e.sentDateTime || "",
    completedAt: e.completedDateTime || "",
    signers,
  };
}

/** The signed document itself, so the completed contract can be filed and sent. */
export async function docusignSignedPdf(envelopeId) {
  const token = await docusignToken();
  const r = await fetch(`${API_BASE}/v2.1/accounts/${ACCOUNT_ID}/envelopes/${encodeURIComponent(envelopeId)}/documents/combined`, {
    headers: { Authorization: `Bearer ${token}`, accept: "application/pdf" },
  });
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  // Magic bytes decide, so an error page never goes out named ".pdf".
  if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") return null;
  return { base64: buf.toString("base64"), bytes: buf.length };
}

/**
 * Read-only reachability check for the panel: does the key authenticate, and
 * which account does it land in. Reports the consent URL when that is what is
 * missing, since it is the first thing that blocks a new integration.
 */
export async function docusignPing() {
  if (!docusignConfigured()) {
    return {
      ok: false, error: "docusign_not_configured",
      missing: [
        !INTEGRATION_KEY && "DOCUSIGN_INTEGRATION_KEY",
        !USER_ID && "DOCUSIGN_USER_ID",
        !ACCOUNT_ID && "DOCUSIGN_ACCOUNT_ID",
        !PRIVATE_KEY && "DOCUSIGN_PRIVATE_KEY",
      ].filter(Boolean),
    };
  }
  try {
    await docusignToken();
    const acct = await dsFetch("");
    return { ok: true, env: docusignEnv(), accountName: acct && acct.accountName, accountId: ACCOUNT_ID, base: API_BASE };
  } catch (e) {
    return { ok: false, error: String(e.message || e), detail: String(e.detail || "").slice(0, 400), consentUrl: e.message === "docusign_consent_required" ? consentUrl() : undefined };
  }
}
