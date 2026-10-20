// One-click unsubscribe for the outbound company campaign.
//
// Why this exists: Gmail's bulk-sender rules require a List-Unsubscribe header
// with a URL that honours a **POST** (RFC 8058) — the mail client sends it
// without the reader ever leaving the inbox. "رد بكلمة إيقاف" in the body does
// not satisfy that, and a campaign without it carries a spam-rate penalty no
// amount of clean copy offsets.
//
// Why it is a helper and not api/unsubscribe.js: Vercel turns every
// non-underscore file in api/ into a function and the plan caps a deployment at
// 12. The build currently reports 11/12, so a new function would spend the last
// slot on this. It is reached through the existing `__route` dispatch in
// requests.js instead, with /unsubscribe rewritten to it in vercel.json —
// the same pattern /api/suppliers and /api/agencies already use.
import crypto from "node:crypto";

const NOTION_VERSION = "2022-06-28";
const envFrom = (names) => { for (const n of names) if (process.env[n]) return process.env[n]; return ""; };
const NOTION_TOKEN = envFrom(["NOTION_TOKEN", "BusinessPartnerSiteNotion", "NOTION_SECRET", "NOTION_API_KEY", "NOTION_KEY"]);
// BP — Companies Sales DB (قاعدة الشركات)
const COMPANIES_DB = process.env.NOTION_COMPANIES_DB || "26faca27-6188-4b6a-b584-924c374f2d22";

// The token is signed, not encrypted: the address is readable, but it cannot be
// forged, so nobody can unsubscribe an address they were not sent. Falls back to
// another server-side secret rather than failing closed — an unsubscribe link
// that errors is worse for the sending domain than one signed with a reused key.
const SECRET = envFrom(["UNSUB_SECRET", "LEADS_KEY", "PANEL_KEY", "NOTION_TOKEN"]);

const b64u = (b) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");

export function unsubToken(email) {
  if (!SECRET || !email) return "";
  const e = String(email).trim().toLowerCase();
  const sig = crypto.createHmac("sha256", SECRET).update(e).digest();
  return `${b64u(e)}.${b64u(sig)}`;
}

export function unsubUrl(email, site = "https://businesspartner.sa") {
  const t = unsubToken(email);
  return t ? `${site}/unsubscribe?t=${encodeURIComponent(t)}` : `${site}/unsubscribe`;
}

function verify(token) {
  if (!SECRET || !token || typeof token !== "string") return "";
  const dot = token.indexOf(".");
  if (dot < 1) return "";
  let email;
  try { email = unb64u(token.slice(0, dot)).trim().toLowerCase(); } catch { return ""; }
  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) return "";
  let given;
  try { given = Buffer.from(token.slice(dot + 1).replace(/-/g, "+").replace(/_/g, "/"), "base64"); } catch { return ""; }
  const want = crypto.createHmac("sha256", SECRET).update(email).digest();
  // Lengths must match before timingSafeEqual, which throws on a mismatch.
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) return "";
  return email;
}

async function notion(path, method = "GET", body) {
  if (!NOTION_TOKEN) return { ok: false, json: null };
  try {
    const r = await fetch("https://api.notion.com/v1/" + path, {
      method,
      headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await r.json().catch(() => null);
    if (!r.ok) console.error("unsub notion", path, r.status, JSON.stringify(json).slice(0, 200));
    return { ok: r.ok, json };
  } catch (e) { console.error("unsub notion exception", String(e).slice(0, 160)); return { ok: false, json: null }; }
}

// Marks every row carrying this address. The address repeats across records in
// this database (the scrape produced duplicates), and unsubscribing one copy
// while the others stay mailable is the same as not unsubscribing at all.
async function suppress(email) {
  const q = await notion(`databases/${COMPANIES_DB}/query`, "POST", {
    filter: { property: "Email", email: { equals: email } },
    page_size: 50,
  });
  const rows = (q.json && q.json.results) || [];
  let done = 0;
  for (const row of rows) {
    const r = await notion(`pages/${row.id}`, "PATCH", {
      properties: {
        Suppressed: { checkbox: true },
        "Suppress Reason": { select: { name: "Unsubscribed" } },
      },
    });
    if (r.ok) done++;
  }
  return { found: rows.length, done };
}

const page = (title, body, tone) => `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Business Partner</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap">
</head>
<body style="margin:0;background:#F5F7FB;font-family:'IBM Plex Sans Arabic','Segoe UI',Tahoma,Arial,sans-serif;color:#232A3D;">
<div style="max-width:560px;margin:0 auto;padding:56px 20px;">
  <div style="background:#0B1B5A;border-radius:14px 14px 0 0;padding:18px 26px;">
    <span dir="ltr" style="font-size:13px;font-weight:600;letter-spacing:2.6px;color:#fff;">BUSINESS&nbsp;PARTNER</span>
  </div>
  <div style="background:#fff;border:1px solid #E5E9F0;border-top:0;border-radius:0 0 14px 14px;padding:34px 26px;">
    <div style="width:46px;height:3px;border-radius:2px;background:${tone};margin-bottom:18px;"></div>
    <h1 style="margin:0 0 12px;font-size:23px;line-height:1.55;font-weight:600;color:#0B1B5A;">${title}</h1>
    <p style="margin:0;font-size:15px;line-height:1.95;color:#5A6478;">${body}</p>
    <p style="margin:26px 0 0;"><a href="https://businesspartner.sa/ar" style="display:inline-block;background:#0B1B5A;color:#fff;font-size:14.5px;font-weight:600;text-decoration:none;padding:12px 26px;border-radius:9px;">الذهاب إلى الموقع</a></p>
  </div>
</div></body></html>`;

export async function handleUnsubscribe(req, res) {
  const url = new URL(req.url, "https://businesspartner.sa");
  const token = url.searchParams.get("t") || "";
  const email = verify(token);
  const oneClick = String(req.method || "GET").toUpperCase() === "POST";

  if (!email) {
    // A one-click POST gets a bare status: the mail client shows no page, and an
    // error body would only be discarded.
    if (oneClick) { res.statusCode = 400; return res.end(); }
    res.statusCode = 400;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.end(page("الرابط غير صالح", "رابط إلغاء الاشتراك غير صحيح أو منتهٍ. راسلنا على business@businesspartnerksa.com ونوقف الرسائل يدوياً.", "#B3261E"));
  }

  const r = await suppress(email);
  console.log("unsubscribe", email, JSON.stringify(r));

  if (oneClick) { res.statusCode = 200; return res.end(); }
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.end(page(
    "تم إلغاء الاشتراك",
    `لن تصلك رسائل تسويقية من Business Partner على <b dir="ltr">${email.replace(/[<>&]/g, "")}</b> بعد الآن. ورسائل الخدمة المتعلقة بطلب قائم تبقى كما هي.`,
    "#047857",
  ));
}
