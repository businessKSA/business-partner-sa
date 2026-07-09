// Business Partner 3.0 — newsletter signup → Notion (ESM).
// Captures an email (optionally a name) for the weekly newsletter. Stores a row
// in NOTION_NEWSLETTER_DB if set, otherwise a child page under
// NOTION_NEWSLETTER_PARENT (defaults to the "Business Partner 2.0" page which is
// already shared with the site integration) so it works with zero setup.
//
// Also runs the weekly newsletter SEND (merged here — not its own endpoint —
// because Vercel Hobby caps a deployment at 12 serverless functions). Every
// Sunday 09:00 Riyadh time, Vercel Cron (see vercel.json) calls this same GET
// route with an Authorization header matching CRON_SECRET. That branch pulls
// the last 7 days from the daily government/compliance news digest that the
// "BP-Daily-Gov-News" n8n workflow already writes into a Notion page, plus any
// ad-hoc items the team added to the manual "نشرة الأسبوع" draft page, and
// emails the compiled digest to the Resend newsletter audience. It never
// invents or edits the news content — it only relays what's already in Notion.
//
// Env vars:
//   NOTION_TOKEN / BusinessPartnerSiteNotion / …  Notion integration secret
//   NOTION_NEWSLETTER_DB       optional database id to store subscriber rows in
//   NOTION_NEWSLETTER_PARENT   optional parent page id (default: Business Partner 2.0)
//   RESEND_AUDIENCE_ID         audience the weekly digest is sent to
//   CRON_SECRET                required for the weekly-send branch — Vercel Cron
//                               sends this as "Authorization: Bearer <secret>"
//   WHATSAPP_CHANNEL_URL       optional override of the WhatsApp channel link
//
// GET  /api/newsletter                        -> { status, configured }
// GET  /api/newsletter  (with CRON_SECRET)     -> runs the weekly send, returns { ok, sent, ... }
// POST /api/newsletter                         -> { ok } | { ok:false, error }

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
const DB_ID = process.env.NOTION_NEWSLETTER_DB || "";
const PARENT_PAGE = process.env.NOTION_NEWSLETTER_PARENT || "23cd108dee5c821bb7e781285c4b4323";
const NOTION_VERSION = "2022-06-28";

const clip = (s, n = 200) => String(s || "").trim().slice(0, n);
const isEmail = (e) => typeof e === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Confirmation email (Resend) — activates once RESEND_API_KEY is set.
const RESEND_API_KEY = envFrom(["RESEND_API_KEY", "RESEND_KEY", "RESEND"]);
const FROM = process.env.OTP_FROM_EMAIL || "Business Partner <onboarding@resend.dev>";
const TEAM_EMAIL = process.env.BOOKING_EMAIL || "business@businesspartner.sa";
async function sendMail(to, subject, html) {
  if (!RESEND_API_KEY || !isEmail(to)) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
  } catch {}
}

// Add the subscriber to a Resend Audience so newsletters can be sent as
// Broadcasts from the Resend dashboard. Activates once RESEND_AUDIENCE_ID is set.
const RESEND_AUDIENCE = process.env.RESEND_AUDIENCE_ID || "";
async function addToAudience(email, name) {
  if (!RESEND_API_KEY || !RESEND_AUDIENCE || !isEmail(email)) return;
  try {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    await fetch(`https://api.resend.com/audiences/${RESEND_AUDIENCE}/contacts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ email, first_name: parts[0] || undefined, last_name: parts.slice(1).join(" ") || undefined, unsubscribed: false }),
    });
  } catch {}
}

async function readBody(req) {
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  if (body && typeof body === "object") return body;
  return await new Promise((resolve) => {
    let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
  });
}

async function notion(payload) {
  return fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": NOTION_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

/* ---------------- Weekly send (cron-only branch) ---------------- */
const CRON_SECRET = process.env.CRON_SECRET || "";
const DAILY_DIGEST_PAGE = process.env.NOTION_DAILY_NEWS_PAGE || "396d108dee5c813cbac6c269c47d0b4f";
const DRAFT_PAGE = process.env.NOTION_NEWSLETTER_DRAFT_PAGE || "398d108dee5c815189ddd26523be6631";
const WA_CHANNEL = process.env.WHATSAPP_CHANNEL_URL || "https://whatsapp.com/channel/0029Vb811YtIXnlvXnnDo90X";
const nl2br = (s = "") => esc(String(s || "")).replace(/\n+/g, "<br>");

async function notionGetBlocks(path) {
  return fetch(`https://api.notion.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION },
  });
}
async function notionPatchBlock(path, body) {
  return fetch(`https://api.notion.com/v1/${path}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
async function listChildren(blockId) {
  let blocks = [];
  let cursor;
  for (let i = 0; i < 10; i++) {
    const qs = cursor ? `?start_cursor=${cursor}&page_size=100` : `?page_size=100`;
    const r = await notionGetBlocks(`blocks/${blockId}/children${qs}`);
    if (!r.ok) throw new Error("notion_blocks_failed:" + r.status);
    const d = await r.json();
    blocks = blocks.concat(d.results || []);
    if (!d.has_more) break;
    cursor = d.next_cursor;
  }
  return blocks;
}
function blockText(b) {
  const t = b && b[b.type];
  if (!t || !Array.isArray(t.rich_text)) return "";
  return t.rich_text.map((x) => x.plain_text).join("");
}

// Source 1: the daily government/compliance digest (n8n-fed page).
async function weeklyFromDailyDigest() {
  const blocks = await listChildren(DAILY_DIGEST_PAGE);
  const sections = [];
  let current = null;
  for (const b of blocks) {
    if (b.type === "heading_2") {
      const t = blockText(b);
      const m = t.match(/(\d{4}-\d{2}-\d{2})/);
      if (m) { current = { date: m[1], parts: [] }; sections.push(current); continue; }
      current = null;
      continue;
    }
    if (current && (b.type === "paragraph" || b.type === "bulleted_list_item" || b.type === "numbered_list_item")) {
      const t = blockText(b).trim();
      if (t) current.parts.push(t);
    }
  }
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 6);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const byDate = new Map();
  for (const s of sections) {
    if (s.date < cutoffStr) continue;
    byDate.set(s.date, s.parts.join("\n\n")); // later runs for the same date win
  }
  const items = [];
  for (const [date, text] of [...byDate.entries()].sort()) {
    if (!text || text.length < 60 || /لا توجد تحديثات جوهرية/.test(text)) continue;
    items.push({ date, text });
  }
  return items;
}

// Source 2: ad-hoc items the team added to the manual "نشرة الأسبوع" draft page.
async function weeklyFromDraftPage() {
  const blocks = await listChildren(DRAFT_PAGE);
  let newsStart = -1, archiveStart = -1;
  blocks.forEach((b, i) => {
    if (b.type === "heading_2") {
      const t = blockText(b);
      if (newsStart === -1 && t.includes("أخبار هذا الأسبوع")) newsStart = i;
      if (archiveStart === -1 && t.includes("الأرشيف")) archiveStart = i;
    }
  });
  if (newsStart === -1) return { items: [], archiveHeadingId: null };
  const end = archiveStart !== -1 ? archiveStart : blocks.length;
  const items = [];
  for (let i = newsStart + 1; i < end; i++) {
    const b = blocks[i];
    if (b.type === "bulleted_list_item") {
      const text = blockText(b).trim();
      if (text && !text.startsWith("(أضف")) items.push({ id: b.id, text });
    }
  }
  return { items, archiveHeadingId: archiveStart !== -1 ? blocks[archiveStart].id : null };
}
async function archiveDraftItems(items, archiveHeadingId, issueDate) {
  if (!items.length) return;
  await Promise.all(items.map((it) => notionPatchBlock(`blocks/${it.id}`, { archived: true })));
  if (!archiveHeadingId) return;
  const children = items.map((it) => ({
    object: "block", type: "bulleted_list_item",
    bulleted_list_item: { rich_text: [{ type: "text", text: { content: `[${issueDate}] ${it.text}`.slice(0, 1900) } }] },
  }));
  await fetch(`https://api.notion.com/v1/blocks/${DRAFT_PAGE}/children`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
    body: JSON.stringify({ children, after: archiveHeadingId }),
  });
}
async function audienceEmails() {
  if (!RESEND_API_KEY || !RESEND_AUDIENCE) return [];
  const r = await fetch(`https://api.resend.com/audiences/${RESEND_AUDIENCE}/contacts`, {
    headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
  });
  if (!r.ok) return [];
  const d = await r.json();
  return (d.data || []).filter((c) => !c.unsubscribed).map((c) => c.email);
}
async function sendPlain(to, subject, html) {
  if (!RESEND_API_KEY || !isEmail(to)) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
    return r.ok;
  } catch { return false; }
}
async function sendToAudience(emails, subject, html) {
  let sent = 0;
  const size = 10;
  for (let i = 0; i < emails.length; i += size) {
    const results = await Promise.all(emails.slice(i, i + size).map((to) => sendPlain(to, subject, html)));
    sent += results.filter(Boolean).length;
  }
  return sent;
}
function digestHtml({ dailyItems, draftItems, issueDate }) {
  const dailyHtml = dailyItems.map((it) => `
    <div style="margin-bottom:18px;padding-bottom:16px;border-bottom:1px solid #eee">
      <div style="font-size:12px;color:#8a90a6;margin-bottom:6px">📅 ${it.date}</div>
      <div style="line-height:1.8;font-size:14px">${nl2br(it.text)}</div>
    </div>`).join("");
  const draftHtml = draftItems.length
    ? `<div style="margin-top:10px">${draftItems.map((it) => `<div style="line-height:1.8;font-size:14px;margin-bottom:10px">• ${nl2br(it.text)}</div>`).join("")}</div>`
    : "";
  return `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#111">
    <div style="background:#0B1B5A;padding:24px;border-radius:10px 10px 0 0;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:20px">📰 نشرة Business Partner الأسبوعية</h1>
      <p style="color:#cbd3f0;margin:6px 0 0;font-size:13px">أهم قرارات وأخبار الامتثال وكل ما يهم الشركات في السعودية — ${issueDate}</p>
    </div>
    <div style="padding:22px;border:1px solid #eee;border-top:0">
      ${dailyHtml || "<p>لا توجد تحديثات جوهرية هذا الأسبوع.</p>"}
      ${draftHtml}
      <div style="margin-top:22px;padding:16px;background:#f5f6fa;border-radius:8px;text-align:center">
        <p style="margin:0 0 10px">تابعنا للتحديثات اللحظية:</p>
        <a href="${WA_CHANNEL}" style="display:inline-block;background:#16a34a;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:600">تابع قناتنا على واتساب</a>
      </div>
    </div>
    <p style="color:#999;font-size:11px;text-align:center;margin-top:14px">Business Partner · Riyadh — وصلتك هذه الرسالة لأنك مشترك في نشرتنا. المصادر: تجميع آلي من الأخبار العامة — يُرجى التحقق من المصدر الرسمي قبل أي إجراء.</p>
  </div>`;
}
async function runWeeklySend() {
  const issueDate = new Date().toISOString().slice(0, 10);
  const [dailyItems, draft] = await Promise.all([weeklyFromDailyDigest(), weeklyFromDraftPage()]);
  const totalItems = dailyItems.length + draft.items.length;

  if (!totalItems) {
    await sendPlain(TEAM_EMAIL, `لا يوجد محتوى للنشرة الأسبوعية — ${issueDate}`,
      `<div style="font-family:Arial,sans-serif">لم يجد النظام أي أخبار في آخر 7 أيام (لا من نشرة الأخبار اليومية ولا من صفحة النشرة اليدوية)، فما أُرسلت نشرة هذا الأسبوع لأي مشترك.</div>`);
    return { ok: true, sent: 0, reason: "no_items" };
  }

  const subject = `📰 نشرة Business Partner الأسبوعية — ${issueDate}`;
  const html = digestHtml({ dailyItems, draftItems: draft.items, issueDate });
  const emails = await audienceEmails();
  const sentCount = emails.length ? await sendToAudience(emails, subject, html) : 0;

  await archiveDraftItems(draft.items, draft.archiveHeadingId, issueDate);
  await sendPlain(TEAM_EMAIL, `تم إرسال نشرة الأسبوع — ${issueDate} (${sentCount} مشترك)`,
    `<div style="font-family:Arial,sans-serif">أُرسلت نشرة هذا الأسبوع إلى ${sentCount} مشترك، وتضمّنت ${dailyItems.length} تحديثاً من نشرة الأخبار اليومية و${draft.items.length} عنصراً يدوياً.</div>`);

  return { ok: true, sent: sentCount, dailyItems: dailyItems.length, draftItems: draft.items.length };
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "GET") {
    const auth = req.headers.authorization || "";
    if (CRON_SECRET && auth === `Bearer ${CRON_SECRET}`) {
      try {
        const result = await runWeeklySend();
        return res.end(JSON.stringify(result));
      } catch (e) {
        console.error("newsletter weekly send error", String(e).slice(0, 300));
        res.statusCode = 500;
        return res.end(JSON.stringify({ ok: false, error: "server_error" }));
      }
    }
    return res.end(JSON.stringify({ status: "ok", configured: !!NOTION_TOKEN, store: DB_ID ? "database" : "page" }));
  }
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: "method_not_allowed" }));
  }

  const b = await readBody(req);
  const email = clip(b.email, 160).toLowerCase();
  const name = clip(b.name, 120);
  const source = clip(b.source, 60) || "website";

  if (!isEmail(email)) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: "invalid_email" }));
  }

  // Not connected yet — accept gracefully so the visitor still gets a success.
  if (!NOTION_TOKEN) return res.end(JSON.stringify({ ok: true, stored: false }));

  try {
    let r;
    if (DB_ID) {
      const props = {
        "البريد": { title: [{ text: { content: email } }] },
        "المصدر": { rich_text: [{ text: { content: source } }] },
        "الحالة": { select: { name: "مشترك" } },
      };
      if (name) props["الاسم"] = { rich_text: [{ text: { content: name } }] };
      r = await notion({ parent: { database_id: DB_ID }, properties: props });
    } else {
      r = await notion({
        parent: { page_id: PARENT_PAGE },
        icon: { type: "emoji", emoji: "📧" },
        properties: { title: [{ text: { content: `اشتراك نشرة — ${email}` } }] },
        children: [{
          object: "block", type: "bulleted_list_item",
          bulleted_list_item: { rich_text: [{ type: "text", text: { content: `${email}${name ? " — " + name : ""} · ${source}` } }] },
        }],
      });
    }
    if (!r.ok) {
      console.error("Notion newsletter error", r.status, (await r.text()).slice(0, 300));
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, error: "notion_error" }));
    }
    await sendMail(email, "تم اشتراكك في نشرة Business Partner ✅", `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#111">
      <h2 style="color:#0B1B5A">تم اشتراكك بنجاح 🎉</h2>
      <p>${name ? "مرحباً " + name + "،<br>" : ""}شكراً لاشتراكك في نشرة <strong>Business Partner</strong>. راح توصلك آخر الأخبار والأدلة وتحديثات المنصات الحكومية في السعودية.</p>
      <p style="color:#666">إذا ما طلبت هذا الاشتراك، تجاهل الرسالة.</p>
    </div>`);
    await addToAudience(email, name);
    return res.end(JSON.stringify({ ok: true, stored: true }));
  } catch (e) {
    console.error("newsletter handler error", String(e).slice(0, 200));
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "server_error" }));
  }
}
