// Temporary package-order endpoint for new.businesspartner.sa.
// It accepts package checkout intent now and can forward it to CRM/Notion/n8n
// when PACKAGE_ORDER_WEBHOOK_URL or LEAD_WEBHOOK_URL is configured.

const WEBHOOK = process.env.PACKAGE_ORDER_WEBHOOK_URL || process.env.LEAD_WEBHOOK_URL || "";

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

function cleanString(v, max = 500) {
  return String(v == null ? "" : v).trim().slice(0, max);
}

export default async function handler(req, res) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  if (req.method === "GET") {
    return res.end(JSON.stringify({ ok: true, endpoint: "package-order", configured: !!WEBHOOK }));
  }
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: "method_not_allowed" }));
  }

  const body = await readBody(req);
  const pkg = body.package || {};
  const payload = {
    source: cleanString(body.source || "new.businesspartner.sa/packages", 200),
    ref: cleanString(body.ref, 80),
    name: cleanString(body.name, 160),
    phone: cleanString(body.phone, 60),
    email: cleanString(body.email, 160),
    status: cleanString(body.status || "package_order", 80),
    package: {
      id: cleanString(pkg.id, 100),
      nameEn: cleanString(pkg.nameEn, 160),
      nameAr: cleanString(pkg.nameAr, 160),
      price: cleanString(pkg.price || pkg.priceLabel, 160),
      amount: Number.isFinite(Number(pkg.amount || pkg.price)) ? Number(pkg.amount || pkg.price) : null,
      details: pkg.packageDetails || {},
    },
    items: Array.isArray(body.items) ? body.items.slice(0, 30) : [],
    total: Number.isFinite(Number(body.total)) ? Number(body.total) : null,
    createdAt: new Date().toISOString(),
    site: "https://new.businesspartner.sa",
  };

  if (WEBHOOK) {
    try {
      await fetch(WEBHOOK, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error("package-order webhook failed", error);
    }
  }

  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true, ref: payload.ref || null, forwarded: !!WEBHOOK }));
}
