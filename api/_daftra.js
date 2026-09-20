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
// {validation_errors:{Invoice:{client_id:["مطلوب"]}}} -> "client_id: مطلوب".
// The key is `validation_errors`, not `errors` — the generic `message` says
// "الرجاء إصلاح الأخطاء بالأسفل" and the fields it refers to live there.
function describeErrors(data) {
  if (!data) return "";
  const d = data || {};
  const bag = d.validation_errors || d.errors ||
    (d.data && (d.data.validation_errors || d.data.errors)) ||
    (d.extra_data && Object.keys(d.extra_data).length ? d.extra_data : null) || null;
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
  const raw = JSON.stringify(data).slice(0, 1500);
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
  const failed = !r.ok || !data || /^fail/i.test(String((data && data.result) || ""));
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

// The account's client list, for the panel's picker. Issuing against an
// existing client id is what stops a second record being created for someone
// already in the books every time their email is typed slightly differently.
export async function daftraListClients(max = 500) {
  const out = [];
  for (let page = 1; page <= Math.ceil(max / 100); page++) {
    const rows = clientRows(await dq(`/clients.json?limit=100&page=${page}`));
    for (const c of rows) {
      out.push({
        id: c.id,
        name: String(c.business_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "").trim(),
        email: String(c.email || "").trim(),
        phone: String(c.phone1 || c.phone2 || c.mobile || "").trim(),
        taxNumber: String(c.business_id || c.tax_number || "").trim(),
        city: String(c.city || "").trim(),
      });
    }
    if (rows.length < 100) break;
  }
  return out.filter((c) => c.id && (c.name || c.email));
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
// rename: also correct the record's business name. Off by default — an
// invoice issued to a person should never rewrite the name of a company
// record that happens to share their email. It is turned on only for a
// company invoice, where the buyer supplied the registered name themselves
// and that name is precisely what belongs on the record.
export async function daftraUpdateClient(id, who, { rename = false } = {}) {
  const { body } = clientBody(who);
  for (const k of ["first_name", "last_name", "notes"]) delete body[k];
  if (!rename || !body.business_name) delete body.business_name;
  if (!Object.keys(body).some((k) => body[k])) return false;
  try { await dq(`/clients/${id}.json`, { method: "PUT", body: { Client: body } }); return true; }
  catch (e) { console.error("daftra client update skipped", String(e.message || e).slice(0, 120)); return false; }
}

export async function daftraFindOrCreateClient(who) {
  const found = await daftraFindClient(who);
  if (found && found.id) {
    if (who.taxNumber || nationalAddressLine(who.address)) {
      await daftraUpdateClient(found.id, who, { rename: !!(who.taxNumber && who.name) });
    }
    return { client: found, created: false };
  }
  const made = await daftraCreateClient(who);
  return { client: made, created: true };
}

// ---- taxes ---------------------------------------------------------------

// `tax1` on an invoice line is the id of a tax row in the account, not a
// percentage — sending 15 makes Daftra look for tax #15 and answer
// "Invalid tax: tax not found or inactive". The account's own tax table is
// read once per warm instance and the active row matching the configured rate
// is used.
let _taxCache = null, _taxAt = 0;
export async function daftraTaxId(rate = VAT_RATE) {
  if (_taxCache !== null && Date.now() - _taxAt < 10 * 60 * 1000) return _taxCache;
  let rows = [];
  try {
    const data = await dq("/taxes.json?limit=100");
    const list = pick(data, ["data", "Taxes", "taxes"]) || data;
    rows = unwrap(Array.isArray(list) ? list : [], "Tax");
  } catch (e) {
    console.error("daftra taxes read failed", String(e.message || e).slice(0, 120));
    return null;
  }
  const num = (t) => Number(t.value ?? t.rate ?? t.percentage ?? t.amount ?? NaN);
  const active = (t) => t.is_active === undefined || !!Number(t.is_active);
  const want = Number(rate);
  const hit =
    rows.find((t) => active(t) && Math.abs(num(t) - want) < 0.01) ||
    rows.find((t) => Math.abs(num(t) - want) < 0.01) ||
    null;
  _taxCache = hit ? (hit.id ?? null) : null;
  _taxAt = Date.now();
  if (_taxCache === null) console.error("daftra: no tax row matching", want, "in", rows.map((t) => `${t.id}:${num(t)}`).join(","));
  return _taxCache;
}
export function daftraResetTaxCache() { _taxCache = null; _taxAt = 0; }

// ---- suppliers -----------------------------------------------------------

// Purchase orders are raised against a supplier record. Daftra accounts differ
// on whether suppliers live at /suppliers.json or as clients flagged as such,
// so the dedicated endpoint is tried first and the client list is the fallback
// — a purchase order against the wrong kind of record is worse than a slower
// lookup.
let _supEndpoint = null;
async function supplierPath() {
  if (_supEndpoint) return _supEndpoint;
  try {
    await dq("/suppliers.json?limit=1");
    _supEndpoint = "/suppliers.json";
  } catch {
    _supEndpoint = "/clients.json";
  }
  return _supEndpoint;
}

export async function daftraFindOrCreateSupplier({ name, email, phone, taxNumber, city, notes }) {
  const path = await supplierPath();
  const model = path === "/suppliers.json" ? "Supplier" : "Client";
  const wantEmail = String(email || "").trim().toLowerCase();
  const wantPhone = String(phone || "").replace(/\D/g, "").slice(-9);
  const wantName = String(name || "").trim();

  for (let page = 1; page <= 5; page++) {
    const data = await dq(`${path}?limit=100&page=${page}`);
    const list = pick(data, ["data"]) || data;
    const rows = unwrap(Array.isArray(list) ? list : [], model);
    const hit = rows.find((c) => {
      const e = String(c.email || "").trim().toLowerCase();
      const ph = String(c.phone1 || c.phone2 || c.mobile || "").replace(/\D/g, "").slice(-9);
      const nm = String(c.business_name || "").trim();
      return (wantEmail && e === wantEmail) || (wantPhone && ph && ph === wantPhone) || (wantName && nm && nm === wantName);
    });
    if (hit && hit.id) return { id: hit.id, created: false };
    if (rows.length < 100) break;
  }

  const body = {
    business_name: wantName || wantEmail || "مورّد",
    first_name: (wantName || "مورّد").split(/\s+/)[0],
    email: wantEmail,
    phone1: String(phone || "").trim(),
    city: String(city || "").trim(),
    notes: String(notes || "").slice(0, 500),
  };
  const tax = String(taxNumber || "").replace(/\D/g, "");
  if (tax) { body.business_id = tax; body.tax_number = tax; }
  // On the shared client table a supplier must be marked as one, or the
  // purchase order would be raised against a customer record.
  if (model === "Client") body.type = 2;
  const out = await dq(path, { method: "POST", body: { [model]: body } });
  const id = pick(out, ["id"]);
  if (!id) throw new Error("daftra_supplier_create_failed");
  return { id, created: true };
}

// ---- products (the service catalogue, mirrored into Daftra) ---------------

// Invoice lines reference a product by id, and the owner wants each line to
// carry its service code, so the 116 published services are mirrored into the
// account's product list keyed by that code. Catalogue amounts are the
// pre-VAT subtotal — the site's cart adds 15% on top of them — so they are
// synced verbatim as the unit price.
const prodCode = (p) => String(p.product_code || p.code || p.sku || p.item_code || "").trim().toUpperCase();
let _prodCache = null, _prodAt = 0;

export async function daftraProducts(force = false) {
  if (!force && _prodCache && Date.now() - _prodAt < 10 * 60 * 1000) return _prodCache;
  const byCode = new Map();
  for (let page = 1; page <= 15; page++) {
    const data = await dq(`/products.json?limit=100&page=${page}`);
    const list = pick(data, ["data", "Products", "products"]) || data;
    const rows = unwrap(Array.isArray(list) ? list : [], "Product");
    for (const r of rows) { const c = prodCode(r); if (c) byCode.set(c, r); }
    if (rows.length < 100) break;
  }
  _prodCache = byCode; _prodAt = Date.now();
  return byCode;
}
export function daftraResetProductCache() { _prodCache = null; _prodAt = 0; }

function productBody({ code, name, price, description, unit }) {
  return {
    name: String(name || code).slice(0, 200),
    product_code: String(code || "").slice(0, 60),
    // Same value under the alternate key: accounts differ on which one the
    // code column is called, and unknown keys are ignored.
    code: String(code || "").slice(0, 60),
    unit_price: Number(price) || 0,
    description: String(description || "").slice(0, 500),
    unit: String(unit || "").slice(0, 40),
    track_stock: 0,
  };
}

// Create or update one catalogue service. Mirrors the invoice path: the full
// body first, then a minimal one, because a rejected optional field is not
// named in the response.
async function upsertProduct(existing, fields) {
  const body = productBody(fields);
  const minimal = { name: body.name, product_code: body.product_code, unit_price: body.unit_price };
  const path = existing ? `/products/${existing.id}.json` : "/products.json";
  const method = existing ? "PUT" : "POST";
  try {
    const out = await dq(path, { method, body: { Product: body } });
    return { ok: true, id: pick(out, ["id"]) || (existing && existing.id) || null };
  } catch (e) {
    if (e.message === "daftra_unauthorized" || e.message === "daftra_unreachable") throw e;
    try {
      const out = await dq(path, { method, body: { Product: minimal } });
      return { ok: true, id: pick(out, ["id"]) || (existing && existing.id) || null, reduced: true };
    } catch (e2) {
      return { ok: false, error: String(e2.detail || e2.message || "failed").slice(0, 160) };
    }
  }
}

/**
 * Push one slice of the catalogue into Daftra. Sliced because 116 services is
 * far more than one serverless invocation can do inside its time limit; the
 * panel walks the offsets and shows progress.
 */
export async function daftraSyncCatalog(services, offset = 0, limit = 15) {
  const all = Array.isArray(services) ? services : [];
  const slice = all.slice(offset, offset + limit);
  const existing = await daftraProducts(offset === 0);
  const out = { total: all.length, processed: 0, created: 0, updated: 0, skipped: 0, failed: [] };
  for (const sv of slice) {
    out.processed++;
    const code = String(sv.code || "").trim().toUpperCase();
    const name = sv.nameAr || sv.nameEn || code;
    const price = Number(sv.amount);
    if (!code || !name) { out.skipped++; continue; }
    // Proposal-priced services carry no amount; they are still worth having in
    // the product list so a line can reference them, priced at issue time.
    const hit = existing.get(code) || null;
    const r = await upsertProduct(hit, {
      code, name,
      price: Number.isFinite(price) ? price : 0,
      description: [sv.nameEn && sv.nameEn !== name ? sv.nameEn : "", sv.categoryAr || sv.category || ""].filter(Boolean).join(" · "),
      unit: sv.pricingModel === "Monthly" ? "شهرياً" : "",
    });
    if (!r.ok) { out.failed.push({ code, error: r.error }); continue; }
    if (hit) out.updated++; else { out.created++; existing.set(code, { id: r.id, product_code: code }); }
  }
  const next = offset + slice.length;
  out.nextOffset = next < all.length ? next : null;
  out.done = out.nextOffset === null;
  return out;
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
// The three sales/purchase documents share one shape: a header row plus item
// rows, the same two-payload retry, and the same read-back for the number and
// links Daftra assigns. Only the model names and the path differ.
const DOC_KINDS = {
  invoice:  { path: "/invoices.json",        head: "Invoice",       item: "InvoiceItem",       party: "client_id",   view: "invoices" },
  estimate: { path: "/estimates.json",       head: "Estimate",      item: "EstimateItem",      party: "client_id",   view: "estimates" },
  po:       { path: "/purchase_orders.json", head: "PurchaseOrder", item: "PurchaseOrderItem", party: "supplier_id", view: "purchase_orders" },
};

async function buildLines(items, taxId) {
  // Each line names its service code. The code is written into the line text
  // so it prints on the document, and the matching synced product is linked
  // by id so the line ties back to the catalogue in the books.
  let products = null;
  if ((items || []).some((it) => it.code)) {
    try { products = await daftraProducts(); } catch { products = null; }
  }
  return (items || [])
    .map((it) => {
      const code = String(it.code || "").trim().toUpperCase();
      const name = String(it.name || "").slice(0, 180) || "خدمة";
      const hit = code && products ? products.get(code) : null;
      // The name goes in twice, on purpose. `item` is the field Daftra's API
      // documents, but this account's printed template renders البند from the
      // linked product and الوصف from `description` — so an unlinked line came
      // out with both columns blank while price and quantity printed fine.
      // A tax invoice whose line does not name what was bought is not one a
      // buyer can check, so the description carries the code and the name
      // whenever the caller has not written its own.
      const label = code ? `${code} — ${name}` : name;
      return {
        item: label.slice(0, 200),
        description: (String(it.description || "").trim() || label).slice(0, 500),
        unit_price: Number(it.unitPrice) || 0,
        quantity: Number(it.quantity) || 1,
        ...(hit && hit.id ? { product_id: hit.id } : {}),
        ...(it.taxable === false ? {} : { tax1: taxId }),
      };
    })
    .filter((l) => l.unit_price > 0 || l.quantity > 0);
}

// Any absolute URL Daftra itself published for this document wins over a path
// composed here, since the owner-area routes differ between account versions.
function firstHttp(obj, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 5) return "";
  for (const v of Array.isArray(obj) ? obj : Object.values(obj)) {
    if (typeof v === "string" && /^https?:\/\//i.test(v) && /invoice|estimate|order|pdf|share|public/i.test(v)) return v;
    const hit = firstHttp(v, depth + 1);
    if (hit) return hit;
  }
  return "";
}
function docLinks(view, id, fetched) {
  const root = `https://${SUBDOMAIN}.daftra.com`;
  const published = firstHttp(fetched);
  const uuid = pick(fetched, ["uuid", "hash", "public_hash", "share_hash"]);
  return {
    url: published || `${root}/${view}/view/${id}`,
    printUrl: `${root}/${view}/print/${id}`,
    pdfUrl: `${root}/${view}/pdf/${id}`,
    publicUrl: uuid ? `${root}/${view.replace(/s$/, "")}/${uuid}` : "",
  };
}

// The client-facing page for an invoice. With a gateway enabled in the account
// (PayTabs / PayFort here), that page is where the "pay now" button lives — so
// this is the payment link, and it is Daftra's own: the payment lands against
// the invoice in the books with no reconciliation step invented here.
//
// Daftra publishes the link on the invoice record when it has one. A path is
// only composed as a fallback, because the owner-area routes differ between
// account versions.
export async function daftraPayLink(id) {
  const root = `https://${SUBDOMAIN}.daftra.com`;
  let fetched = null;
  try { fetched = await dq(`/invoices/${id}.json`); } catch { fetched = null; }
  const published = firstHttp(fetched);
  const uuid = pick(fetched, ["uuid", "hash", "public_hash", "share_hash", "client_invoice_hash"]);
  return {
    url: published || (uuid ? `${root}/invoice/${uuid}` : `${root}/invoices/view/${id}`),
    published: !!published,
    hasHash: !!uuid,
  };
}

// Which client-facing route this account answers, with each candidate's status
// and content type. Read-only — it reports evidence rather than assuming a
// route, the same way the PDF probe does.
// The invoice's own page on Daftra, but only if a client can actually open it.
// A link that lands on a login wall is worse than no link: the client is sent
// somewhere they cannot go, for a document they already paid for. So it is
// fetched here with no credentials — the way the client's browser would — and
// returned only when it renders something other than a sign-in page.
export async function daftraPublicInvoiceLink(id, publicUrl = "") {
  const root = `https://${SUBDOMAIN}.daftra.com`;
  const cands = [
    // Whatever Daftra itself published on the record comes first: a link the
    // account advertises beats one this code composed from a path pattern.
    ...(publicUrl ? [String(publicUrl)] : []),
    `${root}/invoices/view/${id}`,
  ];
  for (const url of cands) {
    try {
      const r = await fetch(url, { redirect: "manual" });
      if (r.status !== 200) continue;
      const body = (await r.text()).slice(0, 6000);
      const login = /login|تسجيل الدخول|password|كلمة المرور/i.test(body);
      const invoiceish = /invoice|فاتورة|الرقم الضريبي|VAT/i.test(body);
      if (!login && invoiceish) return { url, checked: true };
    } catch { /* try the next candidate */ }
  }
  return null;
}

export async function daftraPayLinkProbe(id, hash = "") {
  const root = `https://${SUBDOMAIN}.daftra.com`;
  const cands = [
    `${root}/invoices/view/${id}`,
    `${root}/invoice/view/${id}`,
    `${root}/client/invoices/view/${id}`,
    ...(hash ? [`${root}/invoice/${hash}`, `${root}/i/${hash}`, `${root}/public/invoice/${hash}`] : []),
  ];
  const results = [];
  for (const url of cands) {
    try {
      const r = await fetch(url, { redirect: "manual" });
      const body = r.status === 200 ? (await r.text()).slice(0, 4000) : "";
      results.push({
        url: url.replace(root, ""),
        status: r.status,
        type: String(r.headers.get("content-type") || "").split(";")[0],
        redirect: r.headers.get("location") || "",
        // A page that offers payment says so; a login wall does not.
        looksPayable: /pay|ادفع|سداد|paytabs|payfort/i.test(body),
        looksLogin: /login|تسجيل الدخول|password/i.test(body),
      });
    } catch (e) {
      results.push({ url: url.replace(root, ""), status: 0, error: String(e.message || e).slice(0, 80) });
    }
  }
  return { ok: true, id, results };
}

async function createDoc(kind, { partyId, items, notes, ref, dueDays = 0, vatRate = VAT_RATE, draft = false }) {
  const K = DOC_KINDS[kind];
  const taxId = await daftraTaxId(vatRate);
  if (taxId === null) {
    const err = new Error("daftra_tax_missing");
    err.detail = `لا توجد ضريبة بنسبة ${vatRate}% مفعّلة في حساب الدفترة — أنشئها من الإعدادات ← إعدادات الضرائب ثم أعد المحاولة.`;
    throw err;
  }
  const lines = await buildLines(items, taxId);
  if (!lines.length) throw new Error("daftra_no_items");

  // Two payloads, tried in order. The full one carries everything Daftra
  // documents; the minimal one drops every optional field, because an account
  // that rejects an optional field it does not recognise says only "فشل في
  // الحفظ" without naming it. A rejection creates nothing (result:"failed"),
  // so the retry cannot produce a duplicate document.
  const full = {
    [K.head]: {
      [K.party]: partyId,
      date: today(),
      due_date: plusDays(dueDays),
      currency_code: CURRENCY,
      draft: draft ? 1 : 0,
      notes: String(notes || "").slice(0, 1000),
      client_reference: String(ref || "").slice(0, 60),
    },
    [K.item]: lines,
  };
  const minimal = {
    [K.head]: { [K.party]: partyId, date: today(), notes: String(notes || "").slice(0, 1000) },
    // product_id is dropped in the reduced retry: it is the likeliest optional
    // field to be refused, and the code stays visible in the line text anyway.
    [K.item]: lines.map((l) => ({ item: l.item, unit_price: l.unit_price, quantity: l.quantity, ...(l.tax1 === undefined ? {} : { tax1: l.tax1 }) })),
  };

  let out = null, usedFallback = false, firstError = "";
  try {
    out = await dq(K.path, { method: "POST", body: full });
  } catch (e) {
    if (e.message === "daftra_unauthorized" || e.message === "daftra_unreachable") throw e;
    firstError = String(e.detail || e.message || "");
    try {
      out = await dq(K.path, { method: "POST", body: minimal });
      usedFallback = true;
    } catch (e2) {
      const err = new Error(e2.message);
      err.detail = `${String(e2.detail || e2.message || "")}${firstError && firstError !== String(e2.detail || "") ? ` | الكامل: ${firstError}` : ""}`;
      throw err;
    }
  }
  const id = pick(out, ["id", `${kind}_id`]);
  if (!id) throw new Error("daftra_create_failed");

  const net = lines.reduce((s, l) => s + l.unit_price * l.quantity, 0);
  const tax = lines.reduce((s, l) => s + (l.tax1 === undefined ? 0 : (l.unit_price * l.quantity * Number(vatRate)) / 100), 0);
  // The create response carries the id and little else. Read the document back
  // for the number Daftra assigned and for any link it publishes — the printed
  // layout and its ZATCA QR code are rendered by Daftra, so the file to hand
  // the client is Daftra's, never one composed here.
  let fetched = null;
  const single = K.path.replace(/s\.json$/, "");
  try { fetched = await dq(`${single}/${id}.json`); } catch { /* the document exists regardless */ }
  const number = pick(fetched, ["no", "invoice_number", "number"]) || pick(out, ["no", "invoice_number", "number"]) || String(id);
  return {
    kind,
    id,
    number: String(number),
    net: Math.round(net * 100) / 100,
    vat: Math.round(tax * 100) / 100,
    total: Math.round((net + tax) * 100) / 100,
    currency: CURRENCY,
    reducedPayload: usedFallback,
    ...docLinks(K.view, id, fetched),
  };
}

export const daftraCreateInvoice = ({ clientId, ...rest }) => createDoc("invoice", { partyId: clientId, ...rest });

// A gateway charge that issued an invoice must also settle it in the books:
// without a payment row the invoice sits «مستحقة» in Daftra and the owner
// re-records by hand what Moyasar already confirmed. Same two-payload rule as
// createDoc — the full row carries the transaction id, the minimal retry drops
// every optional field an account might refuse without naming it.
export async function daftraRecordPayment({ invoiceId, amount, transactionId = "", method = "Moyasar", date = "" } = {}) {
  const amt = Math.round(Number(amount) * 100) / 100;
  if (!invoiceId || !(amt > 0)) throw new Error("daftra_payment_invalid");
  const when = (date || new Date().toISOString().slice(0, 19).replace("T", " ")).slice(0, 19);
  const full = { InvoicePayment: {
    invoice_id: invoiceId,
    amount: amt,
    date: when,
    payment_method: String(method).slice(0, 60),
    transaction_id: String(transactionId).slice(0, 80),
    currency_code: CURRENCY,
    status: 1,
  } };
  const minimal = { InvoicePayment: { invoice_id: invoiceId, amount: amt, date: when } };
  let out = null;
  try {
    out = await dq("/invoice_payments.json", { method: "POST", body: full });
  } catch (e) {
    if (e.message === "daftra_unauthorized" || e.message === "daftra_unreachable") throw e;
    out = await dq("/invoice_payments.json", { method: "POST", body: minimal });
  }
  const id = pick(out, ["id", "invoice_payment_id"]);
  if (!id) throw new Error("daftra_payment_failed");
  return { id };
}
export const daftraCreateEstimate = ({ clientId, ...rest }) => createDoc("estimate", { partyId: clientId, ...rest });
export const daftraCreatePurchaseOrder = ({ supplierId, ...rest }) => createDoc("po", { partyId: supplierId, ...rest });

/**
 * Fetch the printed document as PDF bytes so it can be attached to the email.
 * Daftra's v2 API documents no PDF endpoint, and the owner-area print routes
 * differ between account versions, so several candidates are tried with the
 * API key and only a response that really is a PDF is accepted. Returns null
 * when none answers — the caller then sends the link alone rather than
 * attaching an HTML error page named ".pdf".
 */
function pdfCandidates(view, id) {
  const root = `https://${SUBDOMAIN}.daftra.com`;
  const one = view.replace(/s$/, "");
  return [
    `${BASE}/${view}/${id}.pdf`,
    `${BASE}/${view}/${id}.json?format=pdf`,
    `${BASE}/${view}/pdf/${id}`,
    `${root}/${view}/pdf/${id}`,
    `${root}/${view}/download_pdf/${id}`,
    `${root}/${view}/print/${id}?pdf=1`,
    `${root}/${view}/download/${id}`,
    `${root}/${view}/view/${id}?print=1&pdf=1`,
    `${root}/${one}/pdf/${id}`,
    `${root}/${one}/print/${id}?pdf=1`,
    `${root}/owner/${view}/pdf/${id}`,
    `${root}/owner/${view}/print/${id}?pdf=1`,
  ];
}

export async function daftraDocPdf(kind, id) {
  const K = DOC_KINDS[kind] || DOC_KINDS.invoice;
  for (const url of pdfCandidates(K.view, id)) {
    try {
      const r = await fetch(url, { headers: { APIKEY: API_KEY, accept: "application/pdf" }, redirect: "follow" });
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      // The magic bytes decide, not the declared content type: a login page
      // served as application/pdf would otherwise be attached as the invoice,
      // and a real PDF served as octet-stream would be rejected.
      if (buf.length > 1000 && buf.subarray(0, 5).toString("latin1") === "%PDF-") {
        return { base64: buf.toString("base64"), bytes: buf.length, source: url };
      }
    } catch { /* try the next candidate */ }
  }
  console.error("daftra: no PDF endpoint answered for", kind, id);
  return null;
}

// Which of the candidate PDF routes this account answers, with the status and
// content type of each. The API documents no PDF endpoint, so this reports the
// evidence instead of leaving the choice to guesswork.
export async function daftraPdfProbe(kind = "invoice", id = null) {
  let target = id;
  if (!target) {
    const list = await daftraListInvoices(1);
    if (!list.length) return { ok: false, error: "no_invoices_to_probe" };
    target = list[0].id;
  }
  const K = DOC_KINDS[kind] || DOC_KINDS.invoice;
  const root = `https://${SUBDOMAIN}.daftra.com`;
  const urls = pdfCandidates(K.view, target);
  const results = [];
  for (const url of urls) {
    try {
      const r = await fetch(url, { headers: { APIKEY: API_KEY, accept: "application/pdf" }, redirect: "follow" });
      const buf = Buffer.from(await r.arrayBuffer());
      results.push({
        url: url.replace(root, "").replace(BASE, "api2"),
        status: r.status,
        type: String(r.headers.get("content-type") || "").split(";")[0],
        bytes: buf.length,
        isPdf: buf.subarray(0, 5).toString("latin1") === "%PDF-",
      });
    } catch (e) {
      results.push({ url: url.replace(root, "").replace(BASE, "api2"), status: 0, error: String(e.message || e).slice(0, 80) });
    }
  }
  return { ok: true, id: target, results };
}

// ---- asking Daftra to deliver its own invoice -------------------------------

// The PDF cannot be fetched from this account — twelve routes were tried and
// none answered. But the document does not have to travel through us at all:
// Daftra can e-mail its own invoice, with its own numbering and its own PDF,
// which is the only arrangement that keeps one numbering series and one set of
// books. The API documents no such endpoint, so the account is asked which of
// the plausible ones it answers, exactly as the PDF probe does.
//
// SENDING IS NOT A DRY RUN: a route that works will really deliver. Probe
// against an invoice raised for yourself, never a client's.
export async function daftraSendProbe(invoiceId) {
  const id = String(invoiceId || "").trim();
  if (!id) return { ok: false, error: "no_invoice_id" };
  const root = `https://${SUBDOMAIN}.daftra.com`;
  const attempts = [
    { m: "POST", url: `${BASE}/invoices/${id}/send.json` },
    { m: "POST", url: `${BASE}/invoices/send/${id}.json` },
    { m: "POST", url: `${BASE}/invoice_send/${id}.json` },
    { m: "POST", url: `${BASE}/invoices/${id}/email.json` },
    { m: "POST", url: `${BASE}/invoices/${id}/send_email.json` },
    { m: "POST", url: `${root}/invoices/send/${id}` },
    { m: "POST", url: `${root}/owner/invoices/send/${id}` },
    { m: "PUT",  url: `${BASE}/invoices/${id}.json`, body: { Invoice: { send_email: 1 } } },
  ];
  const results = [];
  for (const a of attempts) {
    try {
      const r = await fetch(a.url, {
        method: a.m,
        headers: { APIKEY: API_KEY, "content-type": "application/json", accept: "application/json" },
        body: a.body ? JSON.stringify(a.body) : undefined,
      });
      const text = (await r.text()).slice(0, 200);
      let verdict = "no";
      // Daftra answers a rejected write with HTTP 200 and result:"failed", so
      // the status code alone decides nothing here.
      if (r.ok && !/"result"\s*:\s*"failed"/.test(text) && !/Invalid Endpoint/i.test(text)) verdict = "maybe";
      results.push({ route: `${a.m} ${a.url.replace(root, "").replace(BASE, "")}`, status: r.status, verdict, body: text });
    } catch (e) {
      results.push({ route: `${a.m} ${a.url}`, status: 0, verdict: "error", body: String(e.message || "").slice(0, 90) });
    }
  }
  const winner = results.find((x) => x.verdict === "maybe") || null;
  return { ok: true, invoiceId: id, winner: winner ? winner.route : null, results };
}

// ---- correcting what is already in the books --------------------------------

// Find an invoice by the number printed on it, or by id. The number is what
// the owner has in front of them; the id is internal and they never see it.
// The email an invoice should be sent to lives on the client record, not on
// the invoice, so it is fetched here — retyping it by hand is how a corrected
// invoice ends up in the wrong inbox.
async function invoiceContext(id, row, raw) {
  const links = docLinks("invoices", id, raw || row);
  let email = String(row.client_email || row.email || "").trim();
  const clientId = row.client_id || "";
  if (!email && clientId) {
    try {
      const one = await dq(`/clients/${clientId}.json`);
      const c = pick(one, ["Client"]) || pick(one, ["data"]) || one || {};
      email = String(c.email || c.email1 || c.business_email || "").trim();
    } catch { /* no email on file — the owner types one */ }
  }
  return { links, email };
}

export async function daftraFindInvoice(numberOrId) {
  const q = String(numberOrId || "").trim();
  if (!q) return null;
  const bare = q.replace(/^#/, "");
  // A pure number could be either, so the id is tried first and the number
  // scan is the fallback — a wrong hit here would edit someone else's invoice.
  if (/^\d+$/.test(bare)) {
    try {
      const one = await dq(`/invoices/${bare}.json`);
      const row = pick(one, ["Invoice"]) || pick(one, ["data"]) || one;
      if (row && row.id) return { id: row.id, row, raw: one, ...(await invoiceContext(row.id, row, one)) };
    } catch { /* not an id — fall through to the number scan */ }
  }
  const want = bare.toLowerCase();
  for (let page = 1; page <= 10; page++) {
    const data = await dq(`/invoices.json?limit=100&page=${page}`);
    const list = pick(data, ["data", "Invoices", "invoices"]) || data;
    const rows = unwrap(Array.isArray(list) ? list : [], "Invoice");
    const hit = rows.find((i) => String(i.no || i.invoice_number || i.number || "").trim().toLowerCase() === want);
    if (hit) {
      const one = await dq(`/invoices/${hit.id}.json`).catch(() => null);
      const row = (one && (pick(one, ["Invoice"]) || pick(one, ["data"]))) || hit;
      return { id: hit.id, row, raw: one, ...(await invoiceContext(hit.id, row, one)) };
    }
    if (rows.length < 100) break;
  }
  return null;
}

// Point an invoice at a different client, or at the same client whose record
// has just been corrected. Daftra refuses this once an invoice is submitted —
// its reason is surfaced rather than swallowed, because the remedy then is a
// credit note, which is a decision the owner makes, not one to make for them.
export async function daftraSetInvoiceClient(invoiceId, clientId) {
  await dq(`/invoices/${invoiceId}.json`, { method: "PUT", body: { Invoice: { client_id: clientId } } });
  return true;
}

// ---- credit notes (إشعار دائن / مرتجع) --------------------------------------

// Daftra names this document differently between account versions and the v2
// API documents none of them, so the account is asked which it has rather
// than one being assumed. Probing is read-only and the answer is cached for
// the warm instance.
const CREDIT_PATHS = ["/credit_notes.json", "/refund_receipts.json", "/invoice_refunds.json", "/returns.json"];
let _creditPath = null;

export async function daftraProbeEndpoints() {
  const out = [];
  for (const path of CREDIT_PATHS) {
    try {
      const data = await dq(`${path.replace(".json", "")}.json?limit=1`);
      const list = pick(data, ["data"]) || data;
      const rows = Array.isArray(list) ? list : [];
      out.push({ path, ok: true, rows: rows.length, sample: rows.length ? Object.keys(unwrap(rows, "")[0] || {}).slice(0, 25) : [] });
    } catch (e) {
      out.push({ path, ok: false, error: String(e.message || e).slice(0, 80), detail: String(e.detail || "").slice(0, 120) });
    }
  }
  return { ok: true, endpoints: out };
}

async function creditPath() {
  if (_creditPath) return _creditPath;
  for (const path of CREDIT_PATHS) {
    try { await dq(`${path.replace(".json", "")}.json?limit=1`); _creditPath = path; return path; }
    catch { /* try the next name */ }
  }
  const err = new Error("daftra_no_credit_endpoint");
  err.detail = "لا توجد نقطة إشعار دائن مفعّلة في هذا الحساب — أصدره من واجهة الدفترة، أو فعّل «إشعارات دائنة» في إعدادات الحساب.";
  throw err;
}

/**
 * Reverse an invoice in full. The lines are copied from the invoice itself
 * rather than recomputed, so the credit matches to the halala what was
 * charged — a credit note that disagrees with its invoice leaves a residue
 * that has to be reconciled by hand later.
 */
export async function daftraCreateCreditNote(invoiceId, { reason = "" } = {}) {
  const path = await creditPath();
  const one = await dq(`/invoices/${invoiceId}.json`);
  const inv = pick(one, ["Invoice"]) || pick(one, ["data"]) || one;
  const clientId = inv.client_id;
  if (!clientId) throw new Error("daftra_invoice_has_no_client");

  const rawItems = pick(one, ["InvoiceItem", "InvoiceItems", "items"]) || [];
  const lines = unwrap(Array.isArray(rawItems) ? rawItems : [], "InvoiceItem")
    .map((it) => ({
      item: String(it.item || it.name || "بند").slice(0, 200),
      unit_price: Number(it.unit_price) || 0,
      quantity: Number(it.quantity) || 1,
      ...(it.tax1 == null || it.tax1 === "" ? {} : { tax1: it.tax1 }),
    }))
    .filter((l) => l.unit_price > 0);

  const head = {
    client_id: clientId,
    date: today(),
    currency_code: CURRENCY,
    notes: [`مرتجع/إشعار دائن على الفاتورة ${inv.no || inv.invoice_number || invoiceId}`, String(reason || "").slice(0, 400)].filter(Boolean).join(" — "),
    invoice_id: invoiceId,
  };
  const model = path.includes("credit") ? "CreditNote" : path.includes("refund") ? "RefundReceipt" : "Return";
  const itemModel = `${model}Item`;

  const full = { [model]: head, [itemModel]: lines };
  const minimal = { [model]: { client_id: clientId, date: today(), notes: head.notes }, [itemModel]: lines.map((l) => ({ item: l.item, unit_price: l.unit_price, quantity: l.quantity })) };

  let out = null, firstError = "";
  try {
    out = await dq(path, { method: "POST", body: full });
  } catch (e) {
    if (e.message === "daftra_unauthorized" || e.message === "daftra_unreachable") throw e;
    firstError = String(e.detail || e.message || "");
    try {
      out = await dq(path, { method: "POST", body: minimal });
    } catch (e2) {
      const err = new Error(e2.message);
      err.detail = `${String(e2.detail || e2.message || "")}${firstError && firstError !== String(e2.detail || "") ? ` | الكامل: ${firstError}` : ""} [${path}]`;
      throw err;
    }
  }
  const id = pick(out, ["id"]);
  const number = pick(out, ["no", "number"]) || String(id || "");
  const net = lines.reduce((s, l) => s + l.unit_price * l.quantity, 0);
  return {
    id, number: String(number), path,
    lines: lines.length,
    net: Math.round(net * 100) / 100,
    url: `https://${SUBDOMAIN}.daftra.com${path.replace(".json", "")}/view/${id}`,
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
  daftraResetTaxCache();
  try { out.taxId = await daftraTaxId(); } catch { out.taxId = null; }
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
