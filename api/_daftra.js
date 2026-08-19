// Daftra (الدفترة) — accounting + ZATCA e-invoicing.
//
// Until now "issuing an invoice" anywhere in this codebase meant writing a
// reference string into Notion and emailing the client. Nothing landed in the
// books and nothing was a tax invoice. This module puts real invoices into the
// owner's Daftra account, which is what actually files with ZATCA.
//
// Credentials are ENV-ONLY and deliberately have no fallback: this repository
// is public, so a hardcoded key would be a published key to the company's
// accounting system.
//   DAFTRA_SUBDOMAIN   the <sub> in https://<sub>.daftra.com   (default: businesspartner)
//   DAFTRA_API_KEY     Settings -> API Keys -> the «المعرف» column
//   DAFTRA_VAT_RATE    percent applied per line, default 15
//   DAFTRA_CURRENCY    default SAR
//
// Daftra's v2 API is CakePHP-shaped: paths end in .json and bodies wrap the
// row in its model name ({"Invoice": {...}, "InvoiceItem": [...]}). Responses
// vary between {id}, {data:{id}} and {data:{Invoice:{id}}} depending on the
// endpoint and account version, so every read goes through pick() rather than
// assuming one shape.

const SUBDOMAIN = (process.env.DAFTRA_SUBDOMAIN || "businesspartner").trim().replace(/^https?:\/\//, "").split(".")[0];
const API_KEY = (process.env.DAFTRA_API_KEY || "").trim();
const VAT_RATE = Number(process.env.DAFTRA_VAT_RATE || 15);
const CURRENCY = (process.env.DAFTRA_CURRENCY || "SAR").trim();
const BASE = `https://${SUBDOMAIN}.daftra.com/api2`;

export const daftraConfigured = () => !!API_KEY;
export const daftraBase = () => BASE;
export const daftraVatRate = () => VAT_RATE;

// Deep-search a response for the first value under any of `keys`. Daftra nests
// differently per endpoint and per account version; this is cheaper and far
// more robust than branching on every observed shape.
function pick(obj, keys, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 6) return undefined;
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  for (const v of Array.isArray(obj) ? obj : Object.values(obj)) {
    const hit = pick(v, keys, depth + 1);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

// Rows come back as either [{Client:{...}}, …] or [{...}, …].
function unwrap(rows, model) {
  return (Array.isArray(rows) ? rows : []).map((r) => (r && r[model]) || r).filter(Boolean);
}

// Flatten Daftra's nested validation payload into one readable line:
// {errors:{Invoice:{client_id:["مطلوب"]}}} -> "client_id: مطلوب".
function describeErrors(data) {
  if (!data) return "";
  const bag = data.errors || (data.data && data.data.errors) || null;
  const out = [];
  const walk = (node, key) => {
    if (out.length >= 12 || node == null) return;
    if (typeof node === "string" || typeof node === "number") { out.push(key ? `${key}: ${node}` : String(node)); return; }
    if (Array.isArray(node)) { for (const v of node) walk(v, key); return; }
    for (const [k, v] of Object.entries(node)) walk(v, k);
  };
  walk(bag);
  const msg = String(data.message || "").trim();
  const fields = out.join(" · ");
  if (fields) return fields;
  // No structured `errors` bag: the generic message alone names no field, so
  // the raw body goes through too — it is the only thing left to diagnose from.
  const raw = JSON.stringify(data).slice(0, 500);
  return [msg, raw && raw !== "{}" ? `[raw] ${raw}` : ""].filter(Boolean).join(" — ");
}

// Read one existing invoice back in full. The account already contains
// invoices that Daftra itself accepted, so their exact field names and value
// shapes are the specification — far better than guessing at a payload the
// API keeps rejecting without saying why.
export async function daftraInspectInvoice() {
  const list = await dq("/invoices.json?limit=1");
  const rows = unwrap(Array.isArray(pick(list, ["data"]) || list) ? (pick(list, ["data"]) || list) : [], "Invoice");
  const id = rows.length ? rows[0].id : null;
  if (!id) return { ok: false, error: "no_invoices_to_inspect" };
  const full = await dq(`/invoices/${id}.json`);
  return { ok: true, id, raw: JSON.stringify(full).slice(0, 6000) };
}

async function dq(path, { method = "GET", body } = {}) {
  if (!API_KEY) throw new Error("daftra_not_configured");
  let r;
  try {
    r = await fetch(BASE + path, {
      method,
      headers: { APIKEY: API_KEY, "content-type": "application/json", accept: "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    console.error("daftra network", path, String(e).slice(0, 200));
    throw new Error("daftra_unreachable");
  }
  const text = await r.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* Daftra returns HTML on auth failure */ }
  // Daftra answers a rejected write with 200 + result:"fail", not a 4xx, and
  // puts the per-field reasons in `errors` while `message` stays generic
  // ("فشل في حفظ الفاتورة، الرجاء إصلاح الأخطاء بالأسفل"). Both are treated as
  // failures here and the field errors are flattened into the message the
  // panel shows — the generic line alone is undiagnosable.
  const failed = !r.ok || !data || String((data && data.result) || "").toLowerCase() === "fail";
  if (failed) {
    console.error("daftra error", method, path, r.status, text.slice(0, 800));
    const err = new Error(r.status === 401 || r.status === 403 ? "daftra_unauthorized" : "daftra_failed");
    err.status = r.status;
    err.detail = describeErrors(data) || text.slice(0, 400);
    throw err;
  }
  return data;
}

// ---- clients -------------------------------------------------------------

function clientRows(data) {
  const list = pick(data, ["data", "Clients", "clients"]) || data;
  return unwrap(Array.isArray(list) ? list : [], "Client");
}

// Find by email first, then by the digits of the phone number. The email
// filter is applied server-side when the account supports it and re-checked
// locally either way, so a filter that is silently ignored cannot return the
// wrong client.
export async function daftraFindClient({ email, phone }) {
  const wantEmail = String(email || "").trim().toLowerCase();
  const wantPhone = String(phone || "").replace(/\D/g, "").slice(-9);
  if (!wantEmail && !wantPhone) return null;
  const match = (c) => {
    const e = String(c.email || "").trim().toLowerCase();
    const p = String(c.phone1 || c.phone2 || c.mobile || "").replace(/\D/g, "").slice(-9);
    return (wantEmail && e === wantEmail) || (wantPhone && p && p === wantPhone);
  };
  if (wantEmail) {
    try {
      const hit = clientRows(await dq(`/clients.json?filter[email]=${encodeURIComponent(wantEmail)}&limit=20`)).find(match);
      if (hit) return hit;
    } catch { /* fall through to the scan */ }
  }
  for (let page = 1; page <= 5; page++) {
    const rows = clientRows(await dq(`/clients.json?limit=100&page=${page}`));
    const hit = rows.find(match);
    if (hit) return hit;
    if (rows.length < 100) break;
  }
  return null;
}

// A ZATCA standard tax invoice carries the buyer's VAT number and national
// address; a simplified invoice to an individual does not. Both are optional
// here so individuals stay invoiceable, and both are written onto the client
// record so Daftra prints them on this and every future invoice.
export function nationalAddressLine(a) {
  if (!a) return "";
  const parts = [
    a.buildingNo && `مبنى ${a.buildingNo}`,
    a.street, a.district, a.city,
    a.postalCode && `الرمز البريدي ${a.postalCode}`,
    a.additionalNo && `الرقم الإضافي ${a.additionalNo}`,
  ].filter(Boolean);
  return parts.join("، ");
}

function clientBody({ name, email, phone, city, notes, taxNumber, address }) {
  const full = String(name || "").trim() || String(email || "").split("@")[0] || "عميل";
  const parts = full.split(/\s+/);
  const a = address || {};
  const street = [a.buildingNo, a.street].filter(Boolean).join(" ");
  const body = {
    business_name: full,
    first_name: parts[0] || full,
    last_name: parts.slice(1).join(" ") || "",
    email: String(email || "").trim(),
    phone1: String(phone || "").trim(),
    city: String(a.city || city || "").trim(),
    notes: String(notes || "").slice(0, 500),
  };
  const tax = String(taxNumber || "").replace(/\D/g, "");
  // The same value under both names: accounts differ on which one the tax
  // field is called, and Daftra ignores keys it does not recognise.
  if (tax) { body.business_id = tax; body.tax_number = tax; }
  if (street) body.address1 = street.slice(0, 120);
  if (a.district) body.address2 = String(a.district).slice(0, 120);
  if (a.postalCode) body.postal_code = String(a.postalCode).replace(/\D/g, "");
  if (a.additionalNo) body.building_number = String(a.additionalNo).replace(/\D/g, "");
  if (street || a.district) body.country_code = "SA";
  return { full, body };
}

export async function daftraCreateClient(who) {
  const { full, body } = clientBody(who);
  const out = await dq("/clients.json", { method: "POST", body: { Client: body } });
  const id = pick(out, ["id", "client_id"]);
  if (!id) throw new Error("daftra_client_create_failed");
  return { id, business_name: full, email: who.email, phone1: who.phone };
}

// Backfill VAT number / national address onto a client that already exists,
// so the second invoice to a returning customer is compliant even though the
// first one was created before we asked for those details. Best-effort: a
// failed update must not block the invoice.
export async function daftraUpdateClient(id, who) {
  const { body } = clientBody(who);
  for (const k of ["business_name", "first_name", "last_name", "notes"]) delete body[k];
  if (!Object.keys(body).some((k) => body[k])) return false;
  try { await dq(`/clients/${id}.json`, { method: "PUT", body: { Client: body } }); return true; }
  catch (e) { console.error("daftra client update skipped", String(e.message || e).slice(0, 120)); return false; }
}

export async function daftraFindOrCreateClient(who) {
  const found = await daftraFindClient(who);
  if (found && found.id) {
    if (who.taxNumber || nationalAddressLine(who.address)) await daftraUpdateClient(found.id, who);
    return { client: found, created: false };
  }
  const made = await daftraCreateClient(who);
  return { client: made, created: true };
}

// ---- invoices ------------------------------------------------------------

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n) => new Date(Date.now() + Number(n || 0) * 86400000).toISOString().slice(0, 10);

/**
 * items: [{ name, description?, quantity?, unitPrice, taxable? }]
 * Amounts are per-unit and excluding VAT; VAT is applied per line so Daftra
 * computes the ZATCA-visible tax total itself rather than us sending a total
 * it would have to reverse-engineer.
 */
export async function daftraCreateInvoice({ clientId, items, notes, ref, dueDays = 0, vatRate = VAT_RATE, draft = false }) {
  const lines = (items || [])
    .map((it) => ({
      item: String(it.name || "").slice(0, 200) || "خدمة",
      description: String(it.description || "").slice(0, 500),
      unit_price: Number(it.unitPrice) || 0,
      quantity: Number(it.quantity) || 1,
      tax1: it.taxable === false ? 0 : Number(vatRate) || 0,
    }))
    .filter((l) => l.unit_price > 0 || l.quantity > 0);
  if (!lines.length) throw new Error("daftra_no_items");

  // Two payloads, tried in order. The full one carries everything Daftra
  // documents; the minimal one drops every optional field, because an account
  // that rejects an optional field it does not recognise says only "فشل في حفظ
  // الفاتورة" without naming it. A rejection creates nothing (result:"fail"),
  // so the retry cannot duplicate an invoice.
  const full = {
    Invoice: {
      client_id: clientId,
      date: today(),
      due_date: plusDays(dueDays),
      currency_code: CURRENCY,
      draft: draft ? 1 : 0,
      notes: String(notes || "").slice(0, 1000),
      client_reference: String(ref || "").slice(0, 60),
    },
    InvoiceItem: lines,
  };
  const minimal = {
    Invoice: { client_id: clientId, date: today(), notes: String(notes || "").slice(0, 1000) },
    InvoiceItem: lines.map((l) => ({ item: l.item, unit_price: l.unit_price, quantity: l.quantity, tax1: l.tax1 })),
  };
  let out = null, usedFallback = false, firstError = "";
  try {
    out = await dq("/invoices.json", { method: "POST", body: full });
  } catch (e) {
    if (e.message === "daftra_unauthorized" || e.message === "daftra_unreachable") throw e;
    firstError = String(e.detail || e.message || "");
    try {
      out = await dq("/invoices.json", { method: "POST", body: minimal });
      usedFallback = true;
    } catch (e2) {
      const err = new Error(e2.message);
      err.detail = `${String(e2.detail || e2.message || "")}${firstError && firstError !== String(e2.detail || "") ? ` | الكامل: ${firstError}` : ""}`;
      throw err;
    }
  }
  const id = pick(out, ["id", "invoice_id"]);
  if (!id) throw new Error("daftra_invoice_create_failed");
  const net = lines.reduce((s, l) => s + l.unit_price * l.quantity, 0);
  const tax = lines.reduce((s, l) => s + (l.unit_price * l.quantity * l.tax1) / 100, 0);
  // The create response carries the id and little else. Read the invoice back
  // for the number Daftra actually assigned and for any link it publishes —
  // the ZATCA QR code and the printed layout are rendered by Daftra, so the
  // document to hand the client is Daftra's, never one composed here.
  let fetched = null;
  try { fetched = await dq(`/invoices/${id}.json`); } catch { /* the invoice exists regardless */ }
  const number = pick(fetched, ["no", "invoice_number", "number"]) || pick(out, ["no", "invoice_number", "number"]) || String(id);
  return {
    id,
    number: String(number),
    net: Math.round(net * 100) / 100,
    vat: Math.round(tax * 100) / 100,
    total: Math.round((net + tax) * 100) / 100,
    currency: CURRENCY,
    reducedPayload: usedFallback,
    ...invoiceLinks(id, fetched),
  };
}

// Any absolute URL Daftra itself published for this invoice wins over a path
// composed here, since the owner-area routes differ between account versions.
function firstHttp(obj, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 5) return "";
  for (const v of Array.isArray(obj) ? obj : Object.values(obj)) {
    if (typeof v === "string" && /^https?:\/\//i.test(v) && /invoice|pdf|share|public/i.test(v)) return v;
    const hit = firstHttp(v, depth + 1);
    if (hit) return hit;
  }
  return "";
}
function invoiceLinks(id, fetched) {
  const root = `https://${SUBDOMAIN}.daftra.com`;
  const published = firstHttp(fetched);
  const uuid = pick(fetched, ["uuid", "hash", "public_hash", "share_hash"]);
  return {
    url: published || `${root}/invoices/view/${id}`,
    printUrl: `${root}/invoices/print/${id}`,
    pdfUrl: `${root}/invoices/pdf/${id}`,
    publicUrl: uuid ? `${root}/invoice/${uuid}` : "",
  };
}

export async function daftraListInvoices(limit = 10) {
  const data = await dq(`/invoices.json?limit=${Math.min(Math.max(Number(limit) || 10, 1), 50)}`);
  const list = pick(data, ["data", "Invoices", "invoices"]) || data;
  return unwrap(Array.isArray(list) ? list : [], "Invoice").map((i) => ({
    id: i.id,
    number: i.no || i.invoice_number || String(i.id || ""),
    client: i.client_business_name || i.client_name || "",
    date: i.date || "",
    total: i.summary_total ?? i.total ?? null,
    status: i.payment_status || i.status || "",
  }));
}

// Connection check for /admin. Deliberately reports the field names it saw so
// a Daftra account whose payload differs from the documented shape is
// diagnosable from the panel instead of by reading server logs.
export async function daftraPing() {
  if (!API_KEY) return { ok: false, error: "daftra_not_configured", base: BASE };
  const out = { ok: true, base: BASE, subdomain: SUBDOMAIN, vatRate: VAT_RATE, currency: CURRENCY };
  try {
    const rows = clientRows(await dq("/clients.json?limit=1"));
    out.clientsReachable = true;
    out.sampleClientFields = rows.length ? Object.keys(rows[0]).slice(0, 25) : [];
  } catch (e) {
    return { ok: false, error: e.message, detail: e.detail || "", base: BASE };
  }
  try {
    const inv = await daftraListInvoices(3);
    out.invoicesReachable = true;
    out.recentInvoices = inv;
    // Read one invoice in full: its field names tell us which link Daftra
    // publishes and whether the seller's VAT number is set — without that
    // number Daftra cannot render the ZATCA QR code on the printed invoice.
    if (inv.length) {
      try {
        const one = await dq(`/invoices/${inv[0].id}.json`);
        const row = (pick(one, ["Invoice"]) && pick(one, ["Invoice"])) || pick(one, ["data"]) || one;
        out.sampleInvoiceFields = row && typeof row === "object" ? Object.keys(row).slice(0, 40) : [];
        out.sampleInvoiceLink = firstHttp(one) || "";
      } catch { /* optional */ }
    }
  } catch (e) {
    out.invoicesReachable = false;
    out.invoicesError = e.message;
  }
  return out;
}
