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
  if (!r.ok || !data) {
    console.error("daftra error", method, path, r.status, text.slice(0, 300));
    const err = new Error(r.status === 401 || r.status === 403 ? "daftra_unauthorized" : "daftra_failed");
    err.status = r.status;
    err.detail = (data && (data.message || data.errors)) || text.slice(0, 200);
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

export async function daftraCreateClient({ name, email, phone, city, notes }) {
  const full = String(name || "").trim() || String(email || "").split("@")[0] || "عميل";
  const parts = full.split(/\s+/);
  const out = await dq("/clients.json", {
    method: "POST",
    body: {
      Client: {
        business_name: full,
        first_name: parts[0] || full,
        last_name: parts.slice(1).join(" ") || "",
        email: String(email || "").trim(),
        phone1: String(phone || "").trim(),
        city: String(city || "").trim(),
        notes: String(notes || "").slice(0, 500),
        type: 1, // business
      },
    },
  });
  const id = pick(out, ["id", "client_id"]);
  if (!id) throw new Error("daftra_client_create_failed");
  return { id, business_name: full, email, phone1: phone };
}

export async function daftraFindOrCreateClient(who) {
  const found = await daftraFindClient(who);
  if (found && pick(found, ["id"])) return { client: found, created: false };
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

  const out = await dq("/invoices.json", {
    method: "POST",
    body: {
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
    },
  });
  const id = pick(out, ["id", "invoice_id"]);
  if (!id) throw new Error("daftra_invoice_create_failed");
  const number = pick(out, ["no", "invoice_number", "number"]);
  const net = lines.reduce((s, l) => s + l.unit_price * l.quantity, 0);
  const tax = lines.reduce((s, l) => s + (l.unit_price * l.quantity * l.tax1) / 100, 0);
  return {
    id,
    number: number || String(id),
    net: Math.round(net * 100) / 100,
    vat: Math.round(tax * 100) / 100,
    total: Math.round((net + tax) * 100) / 100,
    currency: CURRENCY,
    url: `https://${SUBDOMAIN}.daftra.com/invoice/view/${id}`,
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
  } catch (e) {
    out.invoicesReachable = false;
    out.invoicesError = e.message;
  }
  return out;
}
