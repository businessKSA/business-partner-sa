// Business Partner 3.0 — employer candidate browser (read the ATS from Notion, ESM).
// Returns a SANITIZED list of candidates from the "🧑‍💼 BP Candidates — ATS" database
// for the /employers page. Contact details (name, phone, email, CV) are hidden by
// default and only revealed when a valid subscription code is supplied — so the pool
// stays a paid product while employers can still browse the anonymized talent.
//
// Env vars:
//   NOTION_TOKEN            Notion integration secret (share the ATS DB with it)
//   NOTION_ATS_DB           optional override of the ATS database id
//   EMPLOYER_CODES          comma-separated subscription codes that unlock contacts
//
// GET /api/candidates?field=&city=&nat=&q=&code=   -> { ok, unlocked, total, candidates:[...] }

// Accept the token under any of these env-var names (be forgiving about naming).
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
const DB_ID = process.env.NOTION_ATS_DB || "71792742873e4de398135c7855542b95";
const CODES = (process.env.EMPLOYER_CODES || "").split(",").map((s) => s.trim()).filter(Boolean);
const NOTION_VERSION = "2022-06-28";
// Employers subscriptions DB — a paid, ACTIVE row unlocks access dynamically (no redeploy).
const EMP_DB = process.env.NOTION_EMPLOYERS_DB || "f1104f8bcc3d4beb84accdbda0aa8322";
// Job postings DB — an employer can open more than one, each screened by AI against this pool.
const JOBS_DB = process.env.NOTION_JOBS_DB || "260d76959d464631943f79f313fbf3c9";
const FIELD_OPTIONS = ["هندسة", "تقنية معلومات", "مبيعات وتسويق", "محاسبة ومالية", "إداري وسكرتارية", "موارد بشرية", "ضيافة ومطاعم", "مقاولات وإنشاءات", "صحة وطب", "تعليم", "لوجستيات ونقل", "أخرى"];

async function readBody(req) {
  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  if (b && typeof b === "object") return b;
  return await new Promise((resolve) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } }); });
}
async function notionFetch(path, method, payload) {
  return fetch(`https://api.notion.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });
}

// Paging through the ~14k-row ATS needs more than the default serverless
// budget — an unfiltered browse can be ~120 sequential Notion API calls.
export const config = { maxDuration: 300 };

const txt = (p) => {
  if (!p) return "";
  if (p.type === "title") return (p.title || []).map((t) => t.plain_text).join("");
  if (p.type === "rich_text") return (p.rich_text || []).map((t) => t.plain_text).join("");
  if (p.type === "select") return p.select ? p.select.name : "";
  if (p.type === "multi_select") return (p.multi_select || []).map((s) => s.name).join("، ");
  if (p.type === "number") return p.number != null ? String(p.number) : "";
  if (p.type === "email") return p.email || "";
  if (p.type === "phone_number") return p.phone_number || "";
  if (p.type === "url") return p.url || "";
  return "";
};

// Mask a name to initials-ish preview (e.g. "محمد العتيبي" -> "م. ا.")
const maskName = (n) => {
  const parts = String(n || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  return parts.slice(0, 2).map((w) => w[0] + ".").join(" ");
};

// Owner testing override — always unlocks the top-tier plan, no Notion lookup.
const OWNER_CODE = process.env.OWNER_DEMO_CODE || "demo123";

// Resolve a subscription code → { unlocked, plan }. Checks the owner override,
// then the static EMPLOYER_CODES env (legacy), then the Employers Notion DB
// for an ACTIVE row by access code.
async function resolvePlan(code) {
  if (!code) return { unlocked: false, plan: "" };
  // Access codes are treated case-insensitively — "Demo123"/"DEMO123"/"demo123"
  // all resolve the same way, matching how the front-end already normalizes
  // its own client-only demo trigger codes.
  if (code.toLowerCase() === OWNER_CODE.toLowerCase()) return { unlocked: true, plan: "مؤسسية" };
  if (CODES.some((c) => c.toLowerCase() === code.toLowerCase())) return { unlocked: true, plan: "" };
  try {
    const r = await fetch(`https://api.notion.com/v1/databases/${EMP_DB}/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
      body: JSON.stringify({
        page_size: 1,
        filter: { and: [
          { property: "رمز الوصول", rich_text: { equals: code } },
          { property: "الحالة", select: { equals: "مفعّل" } },
        ] },
      }),
    });
    if (r.ok) {
      const d = await r.json();
      const row = (d.results || [])[0];
      if (row) {
        const p = row.properties && row.properties["الباقة"] && row.properties["الباقة"].select;
        return { unlocked: true, plan: (p && p.name) || "" };
      }
    } else {
      console.error("employer lookup error", r.status, (await r.text()).slice(0, 200));
    }
  } catch (e) { console.error("resolvePlan error", String(e).slice(0, 200)); }
  return { unlocked: false, plan: "" };
}

// Job postings: an employer can open more than one, each with its own title/
// city/description, and pull an AI-screened shortlist against the pool from
// that description via /api/hire (task:"match") on the client side.
async function handlePostings(req, res) {
  const b = await readBody(req);
  const code = String(b.code || "").trim();
  const { unlocked } = await resolvePlan(code);
  if (!unlocked) { res.statusCode = 403; return res.end(JSON.stringify({ ok: false, error: "locked" })); }

  if (b.action === "create-posting") {
    const title = String(b.title || "").trim().slice(0, 200);
    const city = String(b.city || "").trim().slice(0, 120);
    const description = String(b.description || "").trim().slice(0, 4000);
    const field = String(b.field || "").trim();
    if (!title || !description) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
    const props = {
      "العنوان الوظيفي": { title: [{ text: { content: title } }] },
      "رمز صاحب العمل": { rich_text: [{ text: { content: code } }] },
      "الشركة": { rich_text: [{ text: { content: String(b.company || "").trim().slice(0, 200) } }] },
      "المدينة": { rich_text: [{ text: { content: city } }] },
      "الوصف والمتطلبات": { rich_text: [{ text: { content: description } }] },
      "الحالة": { select: { name: "نشطة" } },
    };
    if (FIELD_OPTIONS.includes(field)) props["المجال"] = { select: { name: field } };
    const r = await notionFetch("pages", "POST", { parent: { database_id: JOBS_DB }, properties: props });
    if (!r.ok) { console.error("posting create error", r.status, (await r.text()).slice(0, 300)); res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_failed" })); }
    const page = await r.json();
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, id: page.id, title, city, field, description }));
  }

  if (b.action === "close-posting") {
    const id = String(b.id || "").trim();
    if (!id) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_fields" })); }
    const page = await notionFetch(`pages/${id}`, "GET");
    const pdata = page.ok ? await page.json() : null;
    const owner = pdata && txt(pdata.properties && pdata.properties["رمز صاحب العمل"]);
    if (!pdata || owner !== code) { res.statusCode = 403; return res.end(JSON.stringify({ ok: false, error: "forbidden" })); }
    await notionFetch(`pages/${id}`, "PATCH", { properties: { "الحالة": { select: { name: "مغلقة" } } } });
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true }));
  }

  if (b.action === "list-postings") {
    const r = await notionFetch(`databases/${JOBS_DB}/query`, "POST", {
      page_size: 50,
      filter: { property: "رمز صاحب العمل", rich_text: { equals: code } },
      sorts: [{ property: "تاريخ النشر", direction: "descending" }],
    });
    if (!r.ok) { console.error("postings list error", r.status, (await r.text()).slice(0, 300)); res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_failed" })); }
    const data = await r.json();
    const postings = (data.results || []).map((pg) => {
      const p = pg.properties || {};
      return {
        id: pg.id,
        title: txt(p["العنوان الوظيفي"]),
        city: txt(p["المدينة"]),
        field: txt(p["المجال"]),
        description: txt(p["الوصف والمتطلبات"]),
        status: txt(p["الحالة"]),
      };
    });
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, postings }));
  }

  res.statusCode = 400;
  return res.end(JSON.stringify({ ok: false, error: "bad_action" }));
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "POST") {
    if (!NOTION_TOKEN) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "not_configured" })); }
    try { return await handlePostings(req, res); } catch (e) { console.error("postings handler error", e); res.statusCode = 500; return res.end(JSON.stringify({ ok: false, error: "server_error" })); }
  }
  if (req.method !== "GET") { res.statusCode = 405; return res.end(JSON.stringify({ error: "method_not_allowed" })); }
  if (!NOTION_TOKEN) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: "not_configured" })); }

  const url0 = new URL(req.url, "http://x");
  // Public job board: every ACTIVE posting from every employer, for the /careers
  // "Jobs from our employer clients" section — no code/auth needed (unlike the
  // employer-only browse/create/list-postings actions above).
  if (url0.searchParams.get("openJobs") === "1") {
    try {
      const r = await notionFetch(`databases/${JOBS_DB}/query`, "POST", {
        page_size: 50,
        filter: { property: "الحالة", select: { equals: "نشطة" } },
        sorts: [{ property: "تاريخ النشر", direction: "descending" }],
      });
      if (!r.ok) { console.error("open jobs query error", r.status, (await r.text()).slice(0, 300)); res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: "notion_failed" })); }
      const data = await r.json();
      const jobs = (data.results || []).map((pg) => {
        const p = pg.properties || {};
        return {
          id: pg.id,
          title: txt(p["العنوان الوظيفي"]),
          company: txt(p["الشركة"]),
          city: txt(p["المدينة"]),
          field: txt(p["المجال"]),
          description: txt(p["الوصف والمتطلبات"]).slice(0, 400),
        };
      }).filter((j) => j.title);
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, jobs }));
    } catch (e) {
      console.error("open jobs handler error", e);
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false, error: "server_error" }));
    }
  }

  const url = new URL(req.url, "http://x");
  const qField = (url.searchParams.get("field") || "").trim();
  const qCity = (url.searchParams.get("city") || "").trim().toLowerCase();
  const qNat = (url.searchParams.get("nat") || "").trim();
  const qText = (url.searchParams.get("q") || "").trim().toLowerCase();
  const code = (url.searchParams.get("code") || "").trim();
  const { unlocked, plan } = await resolvePlan(code);

  // Server-side Notion filter: only the website-sourced / active candidates.
  // "مخفي عن الموقع" = true means the CV failed to parse / is unreadable — the
  // ingestion pipeline flags it for review and it must never reach employers.
  // City/nationality are pushed into the query too (not just filtered from the
  // fetched page client-side) so a filtered search doesn't have to page through
  // the whole ~14k-row database to find a few hundred matches.
  const notHidden = { property: "مخفي عن الموقع", checkbox: { equals: false } };
  const andFilters = [notHidden];
  if (qField) andFilters.push({ property: "Field", select: { equals: qField } });
  if (qCity) andFilters.push({ property: "City", rich_text: { contains: qCity } });
  if (qNat) andFilters.push({ property: "Nationality Type", select: { equals: qNat } });
  const base = {
    page_size: 100,
    sorts: [{ property: "Candidate ID", direction: "descending" }],
    filter: andFilters.length > 1 ? { and: andFilters } : notHidden,
  };

  try {
    // Page through the whole (filtered) result set so employers see ALL
    // matching candidates, not just the first page (Notion caps a page at
    // 100) or an arbitrary early cutoff. The pool is ~14k rows and growing —
    // guarded at 300 pages (30,000 rows) as a sane upper bound, not a
    // realistic ceiling.
    let results = [];
    let cursor = null;
    for (let guard = 0; guard < 300; guard++) {
      const body = cursor ? { ...base, start_cursor: cursor } : base;
      const r = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
        method: "POST",
        headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        console.error("Notion query error", r.status, (await r.text()).slice(0, 400));
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, error: "notion_failed" }));
      }
      const data = await r.json();
      results = results.concat(data.results || []);
      if (!data.has_more || !data.next_cursor) break;
      cursor = data.next_cursor;
    }
    let rows = results.map((pg) => {
      const p = pg.properties || {};
      // "Candidate Name" is often an auto-transliterated guess (esp. for
      // LinkedIn-sourced, non-Arab candidates — e.g. "غيردار سينغ" for
      // "Girdhar Singh"). "Name (EN)" is the clean, source-accurate name, so
      // it takes priority; we keep the other one alongside when it differs
      // so employers see both scripts instead of a garbled single name.
      const nameAr = txt(p["Candidate Name"]);
      const nameEn = txt(p["Name (EN)"]);
      const primary = nameEn || nameAr;
      const secondary = nameEn && nameAr && nameAr !== nameEn ? nameAr : "";
      const cvAts = txt(p["ATS CV (Drive)"]);
      const cvRaw = txt(p["CV Link"]);
      const rec = {
        id: txt(p["Candidate ID"]),
        field: txt(p["Field"]),
        role: txt(p["Target Role"]) || txt(p["Original Position"]),
        city: txt(p["City"]),
        country: txt(p["Country"]),
        residenceStatus: txt(p["حالة الإقامة"]),
        experience: txt(p["Experience Years"]),
        education: txt(p["Education"]),
        nationalityType: txt(p["Nationality Type"]),
        availability: txt(p["Availability"]),
        languages: txt(p["Languages"]),
        skills: txt(p["Skills"]).slice(0, 160),
        saudization: txt(p["التوطين Saudization"]),
      };
      if (unlocked) {
        rec.name = primary;
        rec.nameAlt = secondary;
        rec.phone = txt(p["Phone"]);
        rec.email = txt(p["Email"]);
        // Show the ATS-formatted CV to the client, never the raw original —
        // only fall back to the raw file when no ATS version exists yet.
        rec.cv = cvAts || cvRaw;
        rec.cvKind = cvAts ? "ats" : (cvRaw ? "raw" : "");
        // The actual CV text (not just a link to it), so the profile can be
        // rendered as formatted content on the site itself.
        rec.cvText = txt(p["ATS CV Text"]);
      } else {
        rec.name = maskName(primary);
      }
      return rec;
    });

    // Free-text search across role/skills/field — no clean single Notion
    // filter for an OR-across-properties "contains", so it's applied here
    // against the already city/nationality/field-filtered rows from Notion.
    if (qText) rows = rows.filter((x) => (x.role + " " + x.skills + " " + x.field).toLowerCase().includes(qText));

    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, unlocked, plan, total: rows.length, candidates: rows }));
  } catch (e) {
    console.error("candidates handler error", e);
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "server_error" }));
  }
}
