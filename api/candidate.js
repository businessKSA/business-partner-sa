// Business Partner 3.0 — job-seeker (candidate) intake → Notion (ESM).
// Writes a submission from the /careers "Submit your CV" form into the Notion
// candidate database "👤 المرشحون (الباحثون عن عمل)". Works without a token too
// (the front-end then offers the WhatsApp fallback).
//
// Env vars:
//   NOTION_TOKEN            Notion internal integration secret (share the DB with it)
//   NOTION_CANDIDATES_DB    optional override of the candidates database id
//
// GET  /api/candidate  -> { status, configured }
// POST /api/candidate  -> { ok, ref } | { ok:false, error }

// Accept the token under any of these env-var names (people name it differently
// in Vercel — be forgiving so a mis-named key never silently disables intake).
const envFrom = (names) => {
  for (const n of names) {
    const v = process.env[n];
    if (v && String(v).trim()) return String(v).trim();
  }
  return "";
};
const NOTION_TOKEN = envFrom([
  "NOTION_TOKEN", "NOTION_SECRET", "NOTION_API_KEY", "NOTION_KEY",
  "NOTION_INTEGRATION_TOKEN", "BusinessPartnerSiteNotion",
  "BUSINESS_PARTNER_SITE_NOTION", "NOTION",
]);
const DB_ID = process.env.NOTION_CANDIDATES_DB || "d3168d6642a942d59e0b21c849a8f46d";
const NOTION_VERSION = "2022-06-28";

const isEmail = (e) => typeof e === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const clip = (s, n = 300) => String(s || "").trim().slice(0, n);

// Map a free-text years-of-experience to the DB's المستوى select options.
function levelFrom(exp) {
  const m = String(exp || "").match(/\d+/);
  if (!m) return null;
  const y = Number(m[0]);
  if (y <= 2) return "مبتدئ";
  if (y <= 6) return "متوسط";
  return "خبير";
}

async function readBody(req) {
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  if (body) return body;
  return await new Promise((resolve) => {
    let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
  });
}

const rt = (v) => (v ? [{ text: { content: clip(v, 1800) } }] : []);

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "GET") {
    res.statusCode = 200;
    // seenKeyNames helps diagnose a mis-named / wrong-project token without leaking it.
    const seenKeyNames = Object.keys(process.env).filter((k) => /notion/i.test(k));
    return res.end(JSON.stringify({ status: "ok", configured: !!NOTION_TOKEN, seenKeyNames }));
  }
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: "method_not_allowed" }));
  }
  if (!NOTION_TOKEN) {
    res.statusCode = 503;
    return res.end(JSON.stringify({ ok: false, error: "not_configured" }));
  }

  const b = await readBody(req);
  const name = clip(b.name, 160);
  const phone = clip(b.phone, 40);
  const email = clip(b.email, 160).toLowerCase();
  const field = clip(b.field, 200);
  const exp = clip(b.experience, 80);
  const city = clip(b.city, 120);
  const salary = clip(b.salary, 80);
  const linkedin = clip(b.linkedin, 400);
  const cvUrl = clip(b.cvUrl, 600);
  const consent = b.consent === true || b.consent === "true";

  if (!name || !phone) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: "invalid_fields" }));
  }

  const level = levelFrom(exp);
  const props = {
    "الاسم": { title: [{ text: { content: name } }] },
    "الجوال": { phone_number: phone },
    "المسميات المستهدفة": { rich_text: rt(field) },
    "الكلمات المفتاحية": { rich_text: rt([field, exp].filter(Boolean).join(" · ")) },
    "المدن": { rich_text: rt(city) },
    "نطاق الراتب": { rich_text: rt(salary) },
    "الحالة": { select: { name: "نشط" } },
    "موافقة على التقديم نيابةً": { checkbox: consent },
  };
  if (isEmail(email)) props["البريد"] = { email };
  if (level) props["المستوى"] = { select: { name: level } };
  if (/^https?:\/\//i.test(linkedin)) props["لينكدإن"] = { url: linkedin };
  if (/^https?:\/\//i.test(cvUrl)) props["رابط السيرة الأساسية"] = { url: cvUrl };

  try {
    const r = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": NOTION_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({ parent: { database_id: DB_ID }, properties: props }),
    });
    if (!r.ok) {
      console.error("Notion create error", r.status, (await r.text()).slice(0, 400));
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "notion_failed" }));
    }
    const ref = "CV-" + Date.now().toString().slice(-6);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ref }));
  } catch (e) {
    console.error("candidate handler error", e);
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "server_error" }));
  }
}
