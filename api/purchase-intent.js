// Creates a payment-ready purchase intent. It never charges a customer and
// never receives card data. If configured, it forwards the intent to the
// Business Partner automation webhook for the WhatsApp agent to continue.
const readBody = async (req) => {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  return await new Promise((resolve) => {
    let raw = "";
    req.on("data", (part) => (raw += part));
    req.on("end", () => { try { resolve(JSON.parse(raw || "{}")); } catch { resolve({}); } });
  });
};

const reference = () => `BP-${Date.now().toString(36).toUpperCase()}`;

export default async function handler(req, res) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  if (req.method !== "POST") return res.status(405).end(JSON.stringify({ ok: false, error: "method_not_allowed" }));
  const body = await readBody(req);
  const description = String(body.description || "").trim().slice(0, 1200);
  const budget = String(body.budget || "").trim().slice(0, 40);
  if (description.length < 3) return res.status(400).end(JSON.stringify({ ok: false, error: "description_required" }));

  const intent = { reference: reference(), description, budget, source: String(body.source || "website").slice(0, 80), createdAt: new Date().toISOString(), requiresPaymentApproval: true };
  const webhook = process.env.OPENCLAW_PURCHASE_WEBHOOK_URL || "";
  let forwarded = false;
  if (webhook) {
    try {
      const response = await fetch(webhook, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(process.env.OPENCLAW_PURCHASE_WEBHOOK_SECRET ? { "x-bp-intent-secret": process.env.OPENCLAW_PURCHASE_WEBHOOK_SECRET } : {})
        },
        body: JSON.stringify(intent)
      });
      forwarded = response.ok;
    } catch { forwarded = false; }
  }
  return res.status(200).end(JSON.stringify({ ok: true, reference: intent.reference, forwarded, payment: "approval_required" }));
}
