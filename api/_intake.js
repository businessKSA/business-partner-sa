const ALLOWED_TYPES = new Set([
  "customer",
  "supplier",
  "partner",
  "investor",
  "matching",
  "contact",
]);

const clean = (value, max = 500) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";

export async function handleIntake(body = {}, req) {
  const requestType = clean(body.request_type || body.requestType, 50).toLowerCase();
  const email = clean(body.email, 254).toLowerCase();
  const phone = clean(body.phone, 50);

  if (!ALLOWED_TYPES.has(requestType)) {
    return { status: 422, body: { ok: false, error: "invalid_request_type", allowed: [...ALLOWED_TYPES] } };
  }
  if (!email && !phone) {
    return { status: 422, body: { ok: false, error: "contact_required" } };
  }

  const intake = {
    schema_version: "bp-os-v2.1",
    environment: process.env.VERCEL_ENV || "development",
    source: clean(body.source, 80) || "website",
    workspace: clean(body.workspace, 80) || "Business Partner",
    request_type: requestType,
    company: {
      name: clean(body.company_name || body.companyName, 200),
      sector: clean(body.sector, 100),
      city: clean(body.city, 100),
      website: clean(body.website, 300),
    },
    contact: {
      name: clean(body.contact_name || body.contactName, 150),
      email,
      phone,
    },
    requirements: {
      message: clean(body.message || body.requirement, 3000),
      target_role: clean(body.target_role || body.targetRole, 100),
      mandate_ref: clean(body.mandate_ref || body.mandateRef, 100),
    },
    consent: { contact: body.consent === true || body.consent === "true" },
    tracking: {
      received_at: new Date().toISOString(),
      page: clean(body.page, 300),
      referrer: clean(body.referrer, 500),
      utm_source: clean(body.utm_source, 100),
      utm_campaign: clean(body.utm_campaign, 150),
      ip: clean(String(req?.headers?.["x-forwarded-for"] || "").split(",")[0], 80),
    },
  };

  const webhookUrl = process.env.N8N_BP_OS_V2_INTAKE_WEBHOOK;
  if (!webhookUrl) {
    return { status: 202, body: { ok: true, mode: "dev_validation_only", intake } };
  }

  try {
    const upstream = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-BP-Environment": intake.environment,
        ...(process.env.N8N_BP_OS_V2_SECRET
          ? { "X-BP-Webhook-Secret": process.env.N8N_BP_OS_V2_SECRET }
          : {}),
      },
      body: JSON.stringify(intake),
      signal: AbortSignal.timeout(10000),
    });
    if (!upstream.ok) {
      return { status: 502, body: { ok: false, error: "n8n_upstream_error", upstream_status: upstream.status } };
    }
    return {
      status: 202,
      body: { ok: true, mode: "n8n_dev_forwarded", received_at: intake.tracking.received_at },
    };
  } catch (error) {
    console.error("BP OS intake forwarding failed", error);
    return { status: 502, body: { ok: false, error: "n8n_unavailable" } };
  }
}
