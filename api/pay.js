// Vercel Serverless Function — online payments (Moyasar) for Business Partner 3.0.
// ESM module (repo package.json has "type": "module").
//
// The site works with bank transfer by default. As soon as the Moyasar keys are
// added in Vercel, the checkout page automatically shows the online-payment
// form (mada / Visa / Mastercard / Apple Pay) — no code changes needed.
//
// Env vars:
//   MOYASAR_PUBLISHABLE_KEY  pk_live_... / pk_test_...  → enables the checkout form
//   MOYASAR_SECRET_KEY       sk_live_... / sk_test_...  → server-side payment verification
//   MOYASAR_MPF_URL          optional override of the payment-form script URL
//
// GET  /api/pay            → { enabled, publishableKey, scriptUrl, cssUrl }  (never exposes the secret)
// POST /api/pay {id}       → verifies the payment with Moyasar and returns { ok, status, amount, currency }

const PK = process.env.MOYASAR_PUBLISHABLE_KEY || "";
const SK = process.env.MOYASAR_SECRET_KEY || "";
const MPF_JS = process.env.MOYASAR_MPF_URL || "https://cdn.moyasar.com/mpf/1.15.0/moyasar.js";
const MPF_CSS = MPF_JS.replace(/\.js$/, ".css");

async function readBody(req) {
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  if (body) return body;
  return await new Promise((resolve) => {
    let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
  });
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "GET") {
    res.statusCode = 200;
    return res.end(JSON.stringify({
      enabled: !!PK,
      provider: "moyasar",
      publishableKey: PK || null,
      scriptUrl: MPF_JS,
      cssUrl: MPF_CSS,
      currency: "SAR",
    }));
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: "method_not_allowed" }));
  }

  if (!SK) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "not_configured" }));
  }

  const b = await readBody(req);
  const id = String(b.id || "").trim();
  if (!/^[a-zA-Z0-9_-]{10,64}$/.test(id)) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: "invalid_payment_id" }));
  }

  try {
    const r = await fetch(`https://api.moyasar.com/v1/payments/${id}`, {
      headers: { Authorization: "Basic " + Buffer.from(SK + ":").toString("base64") },
    });
    if (!r.ok) {
      console.error("Moyasar verify error", r.status, (await r.text()).slice(0, 300));
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "verify_failed" }));
    }
    const p = await r.json();
    res.statusCode = 200;
    return res.end(JSON.stringify({
      ok: p.status === "paid",
      status: p.status,
      amount: p.amount,           // in halalas
      currency: p.currency,
      description: p.description || "",
    }));
  } catch (e) {
    console.error("pay handler error", e);
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "server_error" }));
  }
}
