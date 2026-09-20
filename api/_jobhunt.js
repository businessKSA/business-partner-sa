// Business Partner — the job-search service and the agent behind it (ESM).
//
// A candidate in the pool can ask us to look for work on their behalf. Two
// ways to pay for it:
//   اشتراك شهري          — a flat 100 SAR a month while the search is running.
//   راتب شهر على 3 دفعات — nothing until they accept an offer, then one
//                          month's salary spread over three instalments (a
//                          deposit on signing, then monthly, three at most).
// Opting in only records the intent and the chosen plan; a human activates the
// service, which is when billing starts. Nothing here charges anyone.
//
// The agent runs over the active subscribers, reads the open postings, asks the
// site's own AI which ones actually fit each person, and writes the shortlist
// back onto their row plus an e-mail to them. It is deliberately owner-run
// (or cron-run) rather than per-request: matching is the expensive part and
// the answer is the same for a whole day.
//
// Routes (under /api/jobhunt, rewritten to /api/requests?__route=jobhunt)
//   POST {type:"opt-in", name, email, phone, plan, role}   public — sign up
//   GET  ?action=status&email=&phone=                      public — own state
//   GET  ?action=run&key=&limit=                           owner  — run agent
//   GET  ?action=subscribers&key=                          owner  — the book
//   POST {type:"activate", key, id, plan}                  owner  — start it
//   POST {type:"payment", key, id, stage, amount, salary}  owner  — record one
//
// Env: NOTION_TOKEN, NOTION_ATS_DB, NOTION_JOBS_DB, RESEND_API_KEY,
//      OTP_FROM_EMAIL, BP_NOTIFY_EMAIL, PANEL_KEY/LEADS_KEY, SITE_ORIGIN.
//
// Underscore-prefixed so Vercel treats it as a module, not a 13th serverless
// function — the plan caps at 12 and this repo is at the cap.

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
const NOTION_VERSION = "2022-06-28";
const ATS_DB = process.env.NOTION_ATS_DB || "71792742873e4de398135c7855542b95";
const JOBS_DB = process.env.NOTION_JOBS_DB || "260d76959d464631943f79f313fbf3c9";
const RESEND_API_KEY = envFrom(["RESEND_API_KEY", "RESEND_KEY", "RESEND"]);
const FROM = process.env.OTP_FROM_EMAIL || "Business Partner <onboarding@resend.dev>";
const NOTIFY = process.env.BP_NOTIFY_EMAIL || "business@businesspartner.sa";
const OWNER_KEY = envFrom(["PANEL_KEY", "LEADS_KEY"]);
const ORIGIN = process.env.SITE_ORIGIN || "https://businesspartner.sa";

// The two plans, and the money each one implies. MONTHLY_FEE is charged while
// we search; the salary plan charges nothing until an offer is accepted and
// then never more than one month's salary, in at most three instalments.
export const PLANS = {
  "اشتراك شهري 100 ريال": { key: "monthly", fee: 100, instalments: 0 },
  "راتب شهر على 3 دفعات": { key: "salary", fee: 0, instalments: 3 },
};
const SERVICE_STATES = ["لم يُسأل", "غير مهتم", "مهتم — بانتظار الاختيار", "مفعّلة", "موقوفة", "منتهية"];
const PAY_STAGES = ["لم يبدأ", "دفعة مقدمة", "القسط الأول", "القسط الثاني", "القسط الثالث", "مكتمل", "متعثر"];

const clip = (s, n = 300) => String(s == null ? "" : s).trim().slice(0, n);
const isEmail = (e) => typeof e === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const rt = (v) => (v ? [{ text: { content: clip(v, 1900) } }] : []);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ownerOk = (key) => !!OWNER_KEY && String(key || "").trim() === OWNER_KEY;
// Vercel's scheduler can't carry a query secret safely (the repo is public), so
// a cron run authenticates with the Bearer token the platform sends instead.
const CRON_SECRET = (process.env.CRON_SECRET || "").trim();
const cronOk = (req) => !!CRON_SECRET && String((req.headers && req.headers.authorization) || "") === `Bearer ${CRON_SECRET}`;

function txt(p) {
  if (!p) return "";
  if (p.type === "title") return (p.title || []).map((t) => t.plain_text).join("");
  if (p.type === "rich_text") return (p.rich_text || []).map((t) => t.plain_text).join("");
  if (p.type === "select") return p.select ? p.select.name : "";
  if (p.type === "multi_select") return (p.multi_select || []).map((o) => o.name).join("، ");
  if (p.type === "number") return p.number != null ? String(p.number) : "";
  if (p.type === "email") return p.email || "";
  if (p.type === "phone_number") return p.phone_number || "";
  if (p.type === "url") return p.url || "";
  if (p.type === "date") return p.date ? p.date.start : "";
  return "";
}

async function notion(path, method = "GET", body) {
  if (!NOTION_TOKEN) return { ok: false, status: 503, json: null };
  try {
    const r = await fetch("https://api.notion.com/v1/" + path, {
      method,
      headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await r.json().catch(() => null);
    if (!r.ok) console.error("jobhunt notion", path, r.status, JSON.stringify(json).slice(0, 300));
    return { ok: r.ok, status: r.status, json };
  } catch (e) {
    console.error("jobhunt notion exception", String(e).slice(0, 200));
    return { ok: false, status: 500, json: null };
  }
}

async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY || !isEmail(to)) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
    return r.ok;
  } catch (e) {
    console.error("jobhunt sendEmail", String(e).slice(0, 160));
    return false;
  }
}

async function readBody(req) {
  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  if (b && typeof b === "object") return b;
  return await new Promise((resolve) => {
    let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
  });
}

// Find an existing pool row by e-mail, then by phone — the same order the
// application form de-duplicates in, so opting in never creates a second copy
// of someone who has already applied to us.
async function findCandidate(email, phone) {
  const mail = clip(email, 160).toLowerCase();
  const tel = clip(phone, 40);
  if (isEmail(mail)) {
    const q = await notion(`databases/${ATS_DB}/query`, "POST", {
      page_size: 1, filter: { property: "Email", email: { equals: mail } },
    });
    const hit = ((q.json && q.json.results) || [])[0];
    if (hit) return hit;
  }
  if (tel) {
    const q = await notion(`databases/${ATS_DB}/query`, "POST", {
      page_size: 1, filter: { property: "Phone", phone_number: { equals: tel } },
    });
    const hit = ((q.json && q.json.results) || [])[0];
    if (hit) return hit;
  }
  return null;
}

function mapSubscriber(pg) {
  const p = pg.properties || {};
  return {
    id: pg.id,
    name: txt(p["Candidate Name"]) || txt(p["Name (EN)"]),
    role: txt(p["Target Role"]) || txt(p["مهنة الترشيح"]),
    field: txt(p["Field"]),
    city: txt(p["City"]),
    country: txt(p["Country"]),
    experience: txt(p["Experience Years"]),
    education: txt(p["Education"]),
    skills: txt(p["Skills"]),
    email: txt(p["Email"]),
    phone: txt(p["Phone"]),
    residence: txt(p["حالة الإقامة"]),
    region: txt(p["الخبرة الإقليمية"]),
    service: txt(p["خدمة البحث عن وظيفة"]),
    plan: txt(p["باقة الخدمة"]),
    payStage: txt(p["حالة الدفع"]),
    salary: Number(txt(p["الراتب المتفق عليه"]) || 0) || 0,
    commission: Number(txt(p["إجمالي العمولة"]) || 0) || 0,
    collected: Number(txt(p["المحصّل"]) || 0) || 0,
    suggestions: txt(p["وظائف مقترحة من الوكيل"]),
    lastRun: txt(p["آخر بحث للوكيل"]),
    since: txt(p["تاريخ تفعيل الخدمة"]),
  };
}

// Every posting currently open, trimmed to what the matcher actually needs —
// a full job body per posting would blow the model's input budget long before
// it improved the answer.
async function openJobs() {
  const q = await notion(`databases/${JOBS_DB}/query`, "POST", {
    page_size: 60,
    filter: { property: "الحالة", select: { equals: "نشطة" } },
    sorts: [{ timestamp: "created_time", direction: "descending" }],
  });
  if (!q.ok) return [];
  return (((q.json || {}).results) || []).map((pg) => {
    const p = pg.properties || {};
    return {
      id: pg.id,
      title: txt(p["العنوان الوظيفي"]),
      company: txt(p["الشركة"]),
      city: txt(p["المدينة"]),
      field: txt(p["المجال"]),
      description: clip(txt(p["الوصف والمتطلبات"]), 400),
    };
  }).filter((j) => j.title);
}

// The site's matcher already ranks a list against a requirement and returns
// strict JSON, with provider failover behind it. Here it is used the other way
// round: the candidate's profile is the "requirement" and the open postings are
// the list, so one endpoint serves both directions and the agent inherits the
// same key rotation and output contract.
async function rankJobs(candidate, jobs) {
  const profile = [
    `ابحث عن الوظائف المناسبة لهذا الشخص:`,
    `المهنة المستهدفة: ${candidate.role || "غير محددة"}`,
    candidate.experience ? `سنوات الخبرة: ${candidate.experience}` : "",
    candidate.education ? `المؤهل: ${candidate.education}` : "",
    candidate.skills ? `المهارات: ${clip(candidate.skills, 500)}` : "",
    [candidate.city, candidate.country].filter(Boolean).join("، ") ? `الموقع: ${[candidate.city, candidate.country].filter(Boolean).join("، ")}` : "",
    candidate.residence ? `حالة الإقامة: ${candidate.residence}` : "",
    candidate.region ? `الخبرة الإقليمية: ${candidate.region}` : "",
  ].filter(Boolean).join("\n");

  // Each posting is presented in the shape the matcher expects of a candidate.
  const asList = jobs.slice(0, 60).map((j) => ({
    id: j.id, role: j.title, field: j.field, city: j.city,
    skills: [j.company, j.description].filter(Boolean).join(" — "),
  }));

  try {
    const r = await fetch(`${ORIGIN}/api/hire`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task: "match", role: profile, candidates: asList }),
    });
    const d = await r.json().catch(() => null);
    const ranked = d && d.ok && Array.isArray(d.ranked) ? d.ranked : [];
    const byId = {};
    jobs.forEach((j) => { byId[j.id] = j; });
    return ranked
      .map((x) => (byId[x.id] ? { job: byId[x.id], score: Math.min(100, Number(x.score) || 0), reason: clip(x.reason, 200) } : null))
      .filter(Boolean)
      // Below a coin-flip it isn't a match, it's noise — and a candidate who
      // gets sent noise stops opening the e-mail.
      .filter((m) => m.score >= 55)
      .slice(0, 5);
  } catch (e) {
    console.error("jobhunt rank", String(e).slice(0, 160));
    return [];
  }
}

function matchesEmail(name, matches) {
  const rows = matches.map((m) => `<li style="margin-bottom:8px"><b>${esc(m.job.title)}</b>${m.job.company ? ` — ${esc(m.job.company)}` : ""}${m.job.city ? ` · ${esc(m.job.city)}` : ""}<br><span style="color:#666">${esc(m.reason)}</span></li>`).join("");
  return `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px">
    <h2 style="color:#0B1B5A">وجدنا لك وظائف هذا الأسبوع</h2>
    <p>مرحباً ${esc(name)}، بحثنا نيابةً عنك ووجدنا ما يلي:</p>
    <ol style="line-height:1.7">${rows}</ol>
    <p>سنرشّحك عليها ونتابع معك. لو أي وظيفة لا تناسبك ردّ على هذه الرسالة وسنستبعدها من بحثنا.</p>
    <p style="color:#666">خدمة البحث عن وظيفة — Business Partner</p></div>`;
}

export async function handleJobhunt(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const send = (status, obj) => { res.statusCode = status; return res.end(JSON.stringify(obj)); };
  const url = new URL(req.url, "http://x");
  const q = url.searchParams;

  if (req.method === "GET") {
    const action = clip(q.get("action"), 40);

    // What a candidate can see about their own enrolment.
    if (action === "status") {
      const hit = await findCandidate(q.get("email"), q.get("phone"));
      if (!hit) return send(200, { ok: true, found: false });
      const c = mapSubscriber(hit);
      return send(200, {
        ok: true, found: true, name: c.name, service: c.service, plan: c.plan,
        payStage: c.payStage, since: c.since,
        suggestions: c.suggestions, lastRun: c.lastRun,
      });
    }

    if (action === "subscribers") {
      if (!ownerOk(q.get("key"))) return send(403, { ok: false, error: "forbidden" });
      const r = await notion(`databases/${ATS_DB}/query`, "POST", {
        page_size: 100,
        filter: { or: SERVICE_STATES.filter((s) => s !== "لم يُسأل" && s !== "غير مهتم").map((s) => ({ property: "خدمة البحث عن وظيفة", select: { equals: s } })) },
        sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
      });
      if (!r.ok) return send(502, { ok: false, error: "notion_failed" });
      const subs = (((r.json || {}).results) || []).map(mapSubscriber);
      const active = subs.filter((s) => s.service === "مفعّلة");
      return send(200, {
        ok: true,
        subscribers: subs,
        totals: {
          all: subs.length,
          active: active.length,
          waiting: subs.filter((s) => s.service === "مهتم — بانتظار الاختيار").length,
          committed: active.reduce((n, s) => n + (s.commission || 0), 0),
          collected: active.reduce((n, s) => n + (s.collected || 0), 0),
        },
      });
    }

    // The agent. Owner- or cron-triggered, a bounded number per run so one
    // invocation always finishes inside the function's time budget.
    if (action === "run") {
      if (!ownerOk(q.get("key")) && !cronOk(req)) return send(403, { ok: false, error: "forbidden" });
      const limit = Math.min(20, Math.max(1, Number(q.get("limit")) || 8));
      const jobs = await openJobs();
      if (!jobs.length) return send(200, { ok: true, ran: 0, note: "no_open_jobs" });

      const r = await notion(`databases/${ATS_DB}/query`, "POST", {
        page_size: limit,
        filter: { and: [{ property: "خدمة البحث عن وظيفة", select: { equals: "مفعّلة" } }] },
        // Oldest search first, so every subscriber comes round in turn instead
        // of the same few being re-matched every run.
        sorts: [{ property: "آخر بحث للوكيل", direction: "ascending" }],
      });
      if (!r.ok) return send(502, { ok: false, error: "notion_failed" });
      const subs = (((r.json || {}).results) || []).map(mapSubscriber);

      const today = new Date().toISOString().slice(0, 10);
      const report = [];
      for (const c of subs) {
        const matches = await rankJobs(c, jobs);
        const summary = matches.length
          ? matches.map((m) => `${m.job.title}${m.job.company ? ` — ${m.job.company}` : ""} (${m.score}%) — ${m.reason}`).join("\n")
          : "لا توجد وظيفة مناسبة في هذه الجولة.";
        await notion(`pages/${c.id}`, "PATCH", {
          properties: {
            "وظائف مقترحة من الوكيل": { rich_text: rt(summary) },
            "آخر بحث للوكيل": { date: { start: today } },
          },
        });
        if (matches.length && isEmail(c.email)) await sendEmail(c.email, `وجدنا لك ${matches.length} وظيفة مناسبة`, matchesEmail(c.name, matches));
        report.push({ id: c.id, name: c.name, matches: matches.length });
      }

      if (report.length) {
        const lines = report.map((x) => `<li>${esc(x.name)} — ${x.matches} وظيفة</li>`).join("");
        await sendEmail(NOTIFY, `🤖 وكيل البحث عن وظائف — ${report.length} مشترك`, `<div dir="rtl" style="font-family:Arial,sans-serif">
          <h2 style="color:#0B1B5A">جولة بحث مكتملة</h2><ul>${lines}</ul></div>`);
      }
      return send(200, { ok: true, ran: report.length, jobs: jobs.length, report });
    }

    return send(200, { ok: true, status: "ok", configured: !!NOTION_TOKEN, plans: Object.keys(PLANS) });
  }

  if (req.method !== "POST") return send(405, { ok: false, error: "method_not_allowed" });
  const b = await readBody(req);
  const type = clip(b.type, 40);

  // A candidate asks us to search on their behalf. This records the intent and
  // the plan only — activation, and therefore billing, is a human decision.
  if (type === "opt-in") {
    const name = clip(b.name, 200);
    const email = isEmail(clip(b.email, 160)) ? clip(b.email, 160).toLowerCase() : "";
    const phone = clip(b.phone, 40);
    const plan = PLANS[b.plan] ? b.plan : "";
    if (!name || (!email && !phone)) return send(400, { ok: false, error: "invalid_fields" });
    if (!NOTION_TOKEN) return send(503, { ok: false, error: "not_configured" });

    const props = {
      "خدمة البحث عن وظيفة": { select: { name: "مهتم — بانتظار الاختيار" } },
      "حالة الدفع": { select: { name: "لم يبدأ" } },
    };
    if (plan) props["باقة الخدمة"] = { select: { name: plan } };

    const hit = await findCandidate(email, phone);
    let id = hit ? hit.id : "";
    if (hit) {
      const r = await notion(`pages/${id}`, "PATCH", { properties: props });
      if (!r.ok) return send(502, { ok: false, error: "notion_failed" });
    } else {
      // Someone who has never applied to us: open a pool row for them so the
      // agent has something to search against.
      props["Candidate Name"] = { title: [{ text: { content: name } }] };
      props["Source"] = { select: { name: "الموقع" } };
      props["Pipeline Stage"] = { select: { name: "جديد" } };
      props["مخفي عن الموقع"] = { checkbox: false };
      if (email) props["Email"] = { email };
      if (phone) props["Phone"] = { phone_number: phone };
      if (clip(b.role, 160)) props["Target Role"] = { rich_text: rt(b.role) };
      if (clip(b.city, 80)) props["City"] = { rich_text: rt(b.city) };
      const r = await notion("pages", "POST", { parent: { database_id: ATS_DB }, properties: props });
      if (!r.ok) return send(502, { ok: false, error: "notion_failed" });
      id = r.json && r.json.id;
    }

    const planText = plan === "اشتراك شهري 100 ريال"
      ? "اشتراك شهري بقيمة 100 ريال طوال فترة البحث."
      : plan
        ? "لا تدفع شيئاً حتى تقبل عرضاً وظيفياً، ثم راتب شهر واحد مقسّم على ثلاث دفعات كحد أقصى."
        : "سنتواصل معك لاختيار الباقة المناسبة.";
    if (email) {
      await sendEmail(email, "استلمنا طلبك — خدمة البحث عن وظيفة", `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:520px">
        <h2 style="color:#0B1B5A">سنبحث عن وظيفة نيابةً عنك</h2>
        <p>مرحباً ${esc(name)}، سجّلنا طلبك في خدمة البحث عن وظيفة.</p>
        <p><b>الباقة المختارة:</b> ${esc(plan || "لم تُحدد بعد")}<br>${esc(planText)}</p>
        <p>سيراجع فريقنا ملفك ويفعّل الخدمة، وبعدها يبدأ وكيلنا بمطابقتك مع الوظائف المفتوحة أسبوعياً ويصلك بها بريد.</p>
        <p style="color:#666">لن يُخصم منك أي مبلغ قبل تفعيل الخدمة والاتفاق معك.</p></div>`);
    }
    await sendEmail(NOTIFY, `🔎 طلب خدمة بحث عن وظيفة — ${name}`, `<div dir="rtl" style="font-family:Arial,sans-serif">
      <p><b>${esc(name)}</b>${email ? ` · ${esc(email)}` : ""}${phone ? ` · ${esc(phone)}` : ""}</p>
      <p>الباقة: <b>${esc(plan || "لم تُحدد")}</b>${hit ? "" : " · مرشّح جديد لم يكن في القاعدة"}</p>
      <p style="color:#666">فعّل الخدمة من لوحة خدمة البحث ليبدأ الوكيل بالمطابقة.</p></div>`);

    return send(200, { ok: true, id, existing: !!hit, plan });
  }

  if (type === "activate") {
    if (!ownerOk(b.key)) return send(403, { ok: false, error: "forbidden" });
    const id = clip(b.id, 60);
    const plan = PLANS[b.plan] ? b.plan : "";
    const state = SERVICE_STATES.includes(b.state) ? b.state : "مفعّلة";
    if (!id) return send(400, { ok: false, error: "invalid_fields" });
    const props = { "خدمة البحث عن وظيفة": { select: { name: state } } };
    if (plan) props["باقة الخدمة"] = { select: { name: plan } };
    if (state === "مفعّلة") props["تاريخ تفعيل الخدمة"] = { date: { start: new Date().toISOString().slice(0, 10) } };
    const r = await notion(`pages/${id}`, "PATCH", { properties: props });
    if (!r.ok) return send(502, { ok: false, error: "notion_failed" });

    const c = mapSubscriber(r.json);
    if (state === "مفعّلة" && isEmail(c.email)) {
      await sendEmail(c.email, "تم تفعيل خدمة البحث عن وظيفة", `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:520px">
        <h2 style="color:#0B1B5A">الخدمة مفعّلة ✅</h2>
        <p>بدأنا البحث عن وظيفة نيابةً عنك${c.plan ? ` ضمن باقة «${esc(c.plan)}»` : ""}.</p>
        <p>سيصلك بريد بالوظائف المناسبة كلما وجدنا فرصاً جديدة، ونرشّحك عليها مباشرة.</p></div>`);
    }
    return send(200, { ok: true, service: c.service, plan: c.plan });
  }

  // Record one instalment. The salary plan's ceiling is one month's salary in
  // three payments, so the commission total is derived from the agreed salary
  // rather than typed in — nobody can accidentally bill a fourth instalment.
  if (type === "payment") {
    if (!ownerOk(b.key)) return send(403, { ok: false, error: "forbidden" });
    const id = clip(b.id, 60);
    const stage = PAY_STAGES.includes(b.stage) ? b.stage : "";
    if (!id || !stage) return send(400, { ok: false, error: "invalid_fields" });
    const page = await notion(`pages/${id}`, "GET");
    if (!page.ok) return send(404, { ok: false, error: "not_found" });
    const c = mapSubscriber(page.json);

    const salary = Number(b.salary) > 0 ? Math.round(Number(b.salary)) : c.salary;
    const plan = PLANS[c.plan] || PLANS[b.plan] || null;
    const commission = plan && plan.key === "salary" ? salary : (plan ? plan.fee : 0);
    const amount = Number(b.amount) > 0 ? Math.round(Number(b.amount)) : 0;
    const collected = Math.min(commission || Infinity, (c.collected || 0) + amount) || (c.collected || 0);

    const props = { "حالة الدفع": { select: { name: stage } } };
    if (salary > 0) props["الراتب المتفق عليه"] = { number: salary };
    if (commission > 0) props["إجمالي العمولة"] = { number: commission };
    if (amount > 0) props["المحصّل"] = { number: collected };
    if (commission > 0 && collected >= commission) props["حالة الدفع"] = { select: { name: "مكتمل" } };
    const r = await notion(`pages/${id}`, "PATCH", { properties: props });
    if (!r.ok) return send(502, { ok: false, error: "notion_failed" });
    return send(200, {
      ok: true, collected, commission,
      remaining: commission > 0 ? Math.max(0, commission - collected) : 0,
      instalments: plan ? plan.instalments : 0,
    });
  }

  return send(400, { ok: false, error: "unknown_type" });
}
