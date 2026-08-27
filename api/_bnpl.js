// Tamara (buy-now-pay-later) — env-gated exactly like Moyasar: the checkout
// shows the installment button as «قريباً» until the key lands in Vercel, then
// it goes live with no code change. Underscore-prefixed so Vercel treats this
// as a module, not a 13th serverless function.
//
// كانت هنا تابي أيضاً، مكتوبة كاملة وخلف مفاتيح لم تُضبط قط — لا اتفاقية
// موقّعة معها. وشيفرة مسار دفع لا تعمل أسوأ من غيابها: تُقرأ كأنها خيار قائم،
// وتُصان كأنها حيّة، ولا يكتشف أحد أنها معطّلة إلا عند أول عميل يضغطها.
//
// Env vars:
//   TAMARA_API_TOKEN      the long-lived API token from Tamara partners portal
//   TAMARA_API_BASE       optional, default https://api.tamara.co
//                         (sandbox: https://api-sandbox.tamara.co)

const TAMARA_TOKEN = (process.env.TAMARA_API_TOKEN || "").trim();
const TAMARA_BASE = (process.env.TAMARA_API_BASE || "https://api.tamara.co").trim().replace(/\/$/, "");

export const tamaraConfigured = () => !!TAMARA_TOKEN;

const two = (n) => (Math.round(Number(n) * 100) / 100).toFixed(2);

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
    e.detail = text.slice(0, 400);
    throw e;
  }
  return j || {};
}

// ---- Tamara -----------------------------------------------------------------
// Same hosted model: create a checkout session, redirect to checkout_url;
// Tamara returns to `urls.success` with ?orderId=... appended. An approved
// order must be authorised, then captured.
export async function createTamaraSession({ order, totalSar, items, urls }) {
  const name = String(order.name || "عميل بيزنس بارتنر").trim();
  const first = name.split(/\s+/)[0] || "عميل";
  const last = name.split(/\s+/).slice(1).join(" ") || "بيزنس بارتنر";
  const addr = {
    first_name: first, last_name: last,
    line1: "الرياض", city: "Riyadh", country_code: "SA",
    phone_number: String(order.phone || "").slice(0, 30),
  };
  const j = await call(`${TAMARA_BASE}/checkout`, TAMARA_TOKEN, {
    order_reference_id: String(order.ref || "").slice(0, 40),
    total_amount: { amount: two(totalSar), currency: "SAR" },
    description: `Business Partner order ${order.ref || ""}`.trim(),
    country_code: "SA",
    locale: "ar_SA",
    payment_type: "PAY_BY_INSTALMENTS",
    items: (items || []).slice(0, 20).map((it, i) => ({
      reference_id: String(it.id || `item-${i + 1}`).slice(0, 60),
      type: "Digital",
      name: String(it.name || it.id || "خدمة").slice(0, 120),
      sku: String(it.id || `item-${i + 1}`).slice(0, 60),
      quantity: Math.max(1, Number(it.qty) || 1),
      total_amount: { amount: two(it.unit * (Number(it.qty) || 1)), currency: "SAR" },
    })),
    consumer: {
      first_name: first, last_name: last,
      phone_number: String(order.phone || "").slice(0, 30),
      email: String(order.email || "").slice(0, 120),
    },
    billing_address: addr,
    shipping_address: addr,
    merchant_url: {
      success: urls.success, failure: urls.failure, cancel: urls.cancel,
      notification: urls.notification || urls.success,
    },
  });
  if (!j.checkout_url) return { ok: false, error: "no_checkout_url", detail: JSON.stringify(j).slice(0, 200) };
  return { ok: true, url: j.checkout_url, orderId: j.order_id || "" };
}

export async function verifyTamaraOrder(orderId) {
  const id = String(orderId || "").trim();
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(id)) return { paid: false, error: "bad_id" };
  const o = await call(`${TAMARA_BASE}/orders/${id}`, TAMARA_TOKEN, undefined, "GET");
  const status = String(o.status || "").toLowerCase();
  const amountSar = Number((o.total_amount || {}).amount) || 0;
  if (status === "fully_captured" || status === "captured") return { paid: true, amountSar, id, captured: true };
  if (status === "approved") {
    try { await call(`${TAMARA_BASE}/orders/${id}/authorise`, TAMARA_TOKEN, {}); }
    catch (e) { /* may already be authorised — the capture below is the test */ }
  } else if (status !== "authorised") {
    return { paid: false, status, id };
  }
  try {
    await call(`${TAMARA_BASE}/payments/capture`, TAMARA_TOKEN, {
      order_id: id,
      total_amount: { amount: two(amountSar), currency: "SAR" },
    });
    return { paid: true, amountSar, id, captured: true };
  } catch (e) {
    return { paid: true, amountSar, id, captured: false, captureError: String(e.detail || e.message || "").slice(0, 200) };
  }
}
