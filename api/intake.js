const ALLOWED_TYPES = new Set([
  'customer',
  'supplier',
  'partner',
  'investor',
  'matching',
  'contact',
]);

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function clean(value, max = 500) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, max);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const requestType = clean(body.request_type || body.requestType, 50).toLowerCase();
  const email = clean(body.email, 254).toLowerCase();
  const phone = clean(body.phone, 50);
  const companyName = clean(body.company_name || body.companyName, 200);
  const contactName = clean(body.contact_name || body.contactName, 150);
  const message = clean(body.message || body.requirement, 3000);

  if (!ALLOWED_TYPES.has(requestType)) {
    return json(res, 422, {
      ok: false,
      error: 'invalid_request_type',
      allowed: [...ALLOWED_TYPES],
    });
  }

  if (!email && !phone) {
    return json(res, 422, {
      ok: false,
      error: 'contact_required',
      message: 'Email or phone is required.',
    });
  }

  const intake = {
    schema_version: 'bp-os-v2.1',
    environment: process.env.VERCEL_ENV || 'development',
    source: clean(body.source, 80) || 'website',
    workspace: clean(body.workspace, 80) || 'Business Partner',
    request_type: requestType,
    company: {
      name: companyName,
      sector: clean(body.sector, 100),
      city: clean(body.city, 100),
      website: clean(body.website, 300),
    },
    contact: {
      name: contactName,
      email,
      phone,
    },
    requirements: {
      message,
      target_role: clean(body.target_role || body.targetRole, 100),
      mandate_ref: clean(body.mandate_ref || body.mandateRef, 100),
    },
    consent: {
      contact: body.consent === true || body.consent === 'true',
    },
    tracking: {
      received_at: new Date().toISOString(),
      page: clean(body.page, 300),
      referrer: clean(body.referrer, 500),
      utm_source: clean(body.utm_source, 100),
      utm_campaign: clean(body.utm_campaign, 150),
    },
  };

  const webhookUrl = process.env.N8N_BP_OS_V2_INTAKE_WEBHOOK;
  if (!webhookUrl) {
    return json(res, 202, {
      ok: true,
      mode: 'dev_validation_only',
      message: 'Payload validated. n8n DEV webhook is not configured yet.',
      intake,
    });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BP-Environment': intake.environment,
        ...(process.env.N8N_BP_OS_V2_SECRET
          ? { 'X-BP-Webhook-Secret': process.env.N8N_BP_OS_V2_SECRET }
          : {}),
      },
      body: JSON.stringify(intake),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return json(res, 502, {
        ok: false,
        error: 'n8n_upstream_error',
        upstream_status: response.status,
      });
    }

    return json(res, 202, {
      ok: true,
      mode: 'n8n_dev_forwarded',
      received_at: intake.tracking.received_at,
    });
  } catch (error) {
    console.error('BP OS v2 intake forwarding failed', error);
    return json(res, 502, { ok: false, error: 'n8n_unavailable' });
  }
}
