// Tamara (buy-now-pay-later) — env-gated exactly like Moyasar: the checkout
// shows the installment button as «قريباً» until the key lands in Vercel, then
// it goes live with no code change. Underscore-prefixed so Vercel treats this
// as a module, not a 13th serverless function.
//
// Env vars:
//   TAMARA_API_TOKEN      the long-lived API token from Tamara partners portal
//   TAMARA_API_BASE       optional, default https://api.tamara.co
//                         (sandbox: https://api-sandbox.tamara.co)
//   TAMARA_OFF            kill switch: any truthy value hides the installment
//                         button without touching the token
//
// The kill switch exists because the failure that actually happened is not a
// missing key: Tamara's own API answered 500 on three real checkouts in one
// evening while the token was perfectly valid. Deleting the token to stop
// offering a broken method loses it, and re-adding it later means hunting it
// down again — so the way to take the button down in thirty seconds is a
// variable that says «off», not the absence of a credential.

const TAMARA_TOKEN = (process.env.TAMARA_API_TOKEN || "").trim();
const TAMARA_BASE = (process.env.TAMARA_API_BASE || "https://api.tamara.co").trim().replace(/\/$/, "");
const TAMARA_OFF = /^(1|true|yes|on|off)$/i.test((process.env.TAMARA_OFF || "").trim());

export const tamaraConfigured = () => !!TAMARA_TOKEN && !TAMARA_OFF;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const two = (n) => round2(n).toFixed(2);
const money = (n) => ({ amount: two(n), currency: "SAR" });

function normalizeSaudiPhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (/^9665\d{8}$/.test(digits)) return `+${digits}`;
  if (/^05\d{8}$/.test(digits)) return `+966${digits.slice(1)}`;
  if (/^5\d{8}$/.test(digits)) return `+966${digits}`;
  return String(raw || "").trim().slice(0, 30);
}

async function call(url, token, body, method = "POST") {
  const r = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let j = null; try { j = text ? JSON.parse(text) : null; } catch {}
  if (!r.ok) {
    const e = new Error(`bnpl_http_${r.status}`);
    e.detail = text.slice(0, 800);
    throw e;
  }
  return j || {};
}

// ---- Tamara -----------------------------------------------------------------
// Create a hosted checkout session and redirect the buyer to checkout_url.
// Current Tamara Checkout requires order shipping_amount + tax_amount and
// complete item totals. Business Partner sells digital services, so shipping
// is zero and VAT is represented explicitly instead of being hidden inside the
// order total. This keeps Tamara's order math identical to our tax invoice.
export async function createTamaraSession({ order, totalSar, items, urls }) {
  const name = String(order.name || "عميل بيزنس بارتنر").trim();
  const first = name.split(/\s+/)[0] || "عميل";
  const last = name.split(/\s+/).slice(1).join(" ") || "بيزنس بارتنر";
  const phone = normalizeSaudiPhone(order.phone);
  const addr = {
    first_name: first,
    last_name: last,
    line1: "Prince Mohammed bin Saad Street",
    line2: "Al Malqa",
    city: "Riyadh",
    region: "Riyadh",
    country_code: "SA",
    phone_number: phone,
  };

  const src = (items || []).slice(0, 20).map((it, i) => ({
    id: String(it.id || `item-${i + 1}`).slice(0, 60),
    name: String(it.name || it.id || "خدمة").slice(0, 120),
    qty: Math.max(1, Number(it.qty) || 1),
    unit: round2(it.unit),
  })).filter((it) => it.unit > 0);

  if (!src.length) return { ok: false, error: "no_items" };

  const itemNet = round2(src.reduce((s, it) => s + round2(it.unit * it.qty), 0));
  const orderTotal = round2(totalSar);
  const totalTax = round2(Math.max(0, orderTotal - itemNet));
  let taxAllocated = 0;

  const tamaraItems = src.map((it, i) => {
    const lineNet = round2(it.unit * it.qty);
    const lineTax = i === src.length - 1
      ? round2(totalTax - taxAllocated)
      : round2(Math.min(totalTax - taxAllocated, lineNet * 0.15));
    taxAllocated = round2(taxAllocated + lineTax);
    return {
      reference_id: it.id,
      type: "Digital",
      name: it.name,
      sku: it.id,
      quantity: it.qty,
      unit_price: money(it.unit),
      tax_amount: money(lineTax),
      discount_amount: money(0),
      total_amount: money(lineNet + lineTax),
    };
  });

  const ref = String(order.ref || "").slice(0, 40) || `BP-${Date.now().toString().slice(-10)}`;
  const payload = {
    total_amount: money(orderTotal),
    shipping_amount: money(0),
    tax_amount: money(totalTax),
    order_reference_id: ref,
    order_number: ref,
    description: `Business Partner order ${ref}`.slice(0, 256),
    country_code: "SA",
    payment_type: "PAY_BY_INSTALMENTS",
    locale: "ar_SA",
    platform: "Business Partner Web",
    is_mobile: false,
    items: tamaraItems,
    consumer: {
      first_name: first,
      last_name: last,
      phone_number: phone,
      email: String(order.email || "").trim().slice(0, 120),
    },
    billing_address: addr,
    shipping_address: addr,
    merchant_url: {
      success: urls.success,
      failure: urls.failure,
      cancel: urls.cancel,
    },
  };

  const j = await call(`${TAMARA_BASE}/checkout`, TAMARA_TOKEN, payload);
  if (!j.checkout_url) {
    return { ok: false, error: "no_checkout_url", detail: JSON.stringify(j).slice(0, 400) };
  }
  return {
    ok: true,
    url: j.checkout_url,
    orderId: j.order_id || "",
    checkoutId: j.checkout_id || "",
    status: j.status || "",
  };
}

export async function verifyTamaraOrder(orderId) {
  const id = String(orderId || "").trim();
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(id)) return { paid: false, error: "bad_id" };
  const o = await call(`${TAMARA_BASE}/orders/${id}`, TAMARA_TOKEN, undefined, "GET");
  const status = String(o.status || "").toLowerCase().replace(/\s+/g, "_");
  const amountSar = Number((o.total_amount || {}).amount) || 0;
  if (status === "fully_captured" || status === "captured") {
    return { paid: true, amountSar, id, captured: true };
  }
  if (status === "approved") {
    try { await call(`${TAMARA_BASE}/orders/${id}/authorise`, TAMARA_TOKEN, {}); }
    catch (e) { /* auto-authorisation or already authorised */ }
  } else if (status !== "authorised") {
    return { paid: false, status, id };
  }
  try {
    await call(`${TAMARA_BASE}/payments/capture`, TAMARA_TOKEN, {
      order_id: id,
      total_amount: money(amountSar),
      shipping_amount: money(Number((o.shipping_amount || {}).amount) || 0),
      tax_amount: money(Number((o.tax_amount || {}).amount) || 0),
      discount_amount: money(Number((o.discount_amount || {}).amount) || 0),
      ...(Array.isArray(o.items) && o.items.length ? { items: o.items } : {}),
    });
    return { paid: true, amountSar, id, captured: true };
  } catch (e) {
    return { paid: true, amountSar, id, captured: false, captureError: String(e.detail || e.message || "").slice(0, 300) };
  }
}
