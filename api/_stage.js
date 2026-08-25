// Business Partner — the one place that tells the client where their order
// stands, on every channel they have.
//
// The complaint this answers: a partner submitted a quote and the client was
// never told. Acceptance, signature, payment and delivery had the same hole —
// each step happened in Notion and nowhere the client could see it.
//
// A stage transition is announced once, to four places:
//   1. the portal   — a notification, plus a task/approval when the client
//                     must actually DO something (approve, sign, pay);
//   2. e-mail       — an Arabic message with the one button that matters;
//   3. WhatsApp     — direct to the client via the WhatsApp Cloud API, when
//                     a token is configured;
//   4. the owner    — a ping on the existing website-lead-notify webhook so
//                     Bahir sees the same movement on his phone.
//
// Nothing here throws and nothing here blocks: an order must not fail to
// advance because a notification channel was down. Every call returns a report
// of what actually went out, so the panel can show the truth rather than a
// hopeful "sent".
//
// NOTE ON n8n: this module never edits an n8n workflow. It POSTs to the
// existing website-lead-notify webhook exactly as api/requests.js already
// does, and sends client WhatsApp straight to Meta's Cloud API — no workflow
// is read, changed or depended on.
//
// Underscore-prefixed: a shared module, not a 13th serverless function.

import { sb, DB_ON, notify } from "./_db.js";

const envFrom = (names) => { for (const n of names) { if (process.env[n] && String(process.env[n]).trim()) return String(process.env[n]).trim(); } return ""; };

const NOTION_TOKEN = envFrom(["NOTION_TOKEN", "BusinessPartnerSiteNotion", "NOTION_SECRET", "NOTION_API_KEY", "NOTION_KEY", "NOTION_INTEGRATION_TOKEN", "NOTION"]);
const NOTION_VERSION = "2022-06-28";
const CRM_DB = process.env.NOTION_CRM_DB || "d9a342be24774be3b4095d439d21fc90";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM = process.env.OTP_FROM_EMAIL || "Business Partner <onboarding@resend.dev>";
const SITE = process.env.MKT_SITE_BASE || "https://www.businesspartner.sa";
const OWNER_WA_WEBHOOK = process.env.OWNER_WA_WEBHOOK || "https://businesspartnerai.app.n8n.cloud/webhook/website-lead-notify";

// WhatsApp Cloud API — the client's leg. Optional: without a token every
// other channel still fires and the report says plainly that WhatsApp is off.
const WA_TOKEN = envFrom(["WHATSAPP_TOKEN", "WHATSAPP_ACCESS_TOKEN", "META_WHATSAPP_TOKEN", "WA_TOKEN"]);
const WA_PHONE_ID = envFrom(["WHATSAPP_PHONE_ID", "WHATSAPP_PHONE_NUMBER_ID", "WA_PHONE_ID"]);
const WA_TEMPLATE = envFrom(["WHATSAPP_TEMPLATE_NAME"]);
const WA_TEMPLATE_LANG = envFrom(["WHATSAPP_TEMPLATE_LANG"]) || "ar";
const WA_GRAPH = "https://graph.facebook.com/v21.0";

const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const isEmail = (e) => typeof e === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const money = (n) => (n == null || !Number.isFinite(Number(n)) ? "" : `${Number(n).toLocaleString("en-US")} ﷼`);

// ---------------------------------------------------------------------------
// The stage table. One row per thing that can happen to an order, in the words
// the client should read — including the sentence Bahir asked for by name:
// «استلمنا المبلغ وجاري العمل على الخدمة».
// ---------------------------------------------------------------------------
export const STAGE = {
  quote_sent: {
    title: "عرض سعر بانتظار موافقتك",
    line: "جهّزنا لك عرض السعر — راجعه ووافق عليه لنبدأ التنفيذ.",
    cta: "افتح عرض السعر ووافق",
    // The client must act, so this becomes a task AND a recorded approval.
    task: "راجع عرض السعر ووافق عليه",
    approval: true,
    urgency: "high",
    ownerNote: "عرض سعر أُرسل للعميل",
  },
  quote_accepted: {
    title: "تم قبول عرض السعر ✅ — الخطوة التالية التوقيع",
    line: "شكراً لك. العقد جاهز للتوقيع الإلكتروني من نفس الصفحة، وبعد التوقيع مباشرة يظهر لك العقد للتحميل ورابط السداد.",
    cta: "وقّع العقد الآن",
    task: "وقّع العقد إلكترونياً",
    urgency: "high",
    ownerNote: "العميل قَبِل عرض السعر",
  },
  quote_declined: {
    title: "سجّلنا اعتذارك عن عرض السعر",
    line: "سجّلنا قرارك. لو حاب نعدّل النطاق أو السعر، رد على هذه الرسالة ونجهّز لك عرضاً جديداً.",
    cta: "تواصل معنا",
    ownerNote: "العميل رفض عرض السعر",
  },
  contract_sent: {
    title: "عقدك جاهز للتوقيع الإلكتروني ✍️",
    line: "أرسلنا لك العقد عبر DocuSign على بريدك. وقّعه إلكترونياً وتصلك بعدها الفاتورة الضريبية مباشرة.",
    cta: "افتح لوحة العميل",
    task: "وقّع العقد إلكترونياً عبر DocuSign",
    urgency: "high",
    ownerNote: "أُرسل العقد للتوقيع",
  },
  contract_signed: {
    title: "تم إكمال مستندك ✓",
    line: "اكتمل توقيع العقد. تقدر تعرض المستند المكتمل وتحفظه بصيغة PDF من الزر أدناه، ونسخته محفوظة لك دائماً. الخطوة الأخيرة هي السداد، وبعدها يبدأ التنفيذ فوراً.",
    // The button has to say where it goes. It used to read «ادفع الآن» while
    // pointing at the contract — a label that lies about its destination is
    // worse than no button.
    cta: "عرض المستند المكتمل",
    note: "لا تشارك هذه الرسالة — تحتوي على رابط آمن لمستندك. لا تشارك الرابط ولا رمز التحقق مع أحد.",
    task: "سدّد قيمة الخدمة",
    urgency: "high",
    ownerNote: "العميل وقّع العقد",
  },
  invoice_issued: {
    title: "فاتورتك جاهزة للسداد 💳",
    line: "تقدر تسدد إلكترونياً من الرابط، أو تحوّل بنكياً وترفع الإيصال من لوحة العميل.",
    cta: "ادفع الآن",
    task: "سدّد الفاتورة",
    urgency: "high",
    ownerNote: "أُرسلت الفاتورة للعميل",
  },
  payment_received: {
    title: "استلمنا المبلغ وجاري العمل على الخدمة",
    line: "وصلنا سدادك وسجّلناه على طلبك. فريق التنفيذ بدأ العمل، وبيوصلك تحديث مع كل خطوة.",
    cta: "تابع تنفيذ طلبك",
    ownerNote: "وصل سداد العميل",
  },
  work_update: {
    title: "تحديث على تنفيذ طلبك",
    line: "",
    cta: "تابع تنفيذ طلبك",
    ownerNote: "تحديث تنفيذ",
  },
  delivered: {
    title: "تم تسليم خدمتك ✅",
    line: "اكتمل تنفيذ طلبك. تقدر تراجع المخرجات من لوحة العميل، وأي ملاحظة افتح لها تذكرة ونعالجها.",
    cta: "افتح لوحة العميل",
    ownerNote: "تم التسليم",
  },
};

// ---------------------------------------------------------------------------
// Who to reach. The work order carries the client's reference, not their
// contact details — those live once, on the CRM lead, and are read from there
// so there is a single source of truth for a client's e-mail and mobile.
// ---------------------------------------------------------------------------
export async function contactForRef(clientRef) {
  const ref = String(clientRef || "").trim();
  if (!ref || !NOTION_TOKEN) return { email: "", phone: "", name: "" };
  try {
    const r = await fetch(`https://api.notion.com/v1/databases/${CRM_DB}/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" },
      body: JSON.stringify({ page_size: 1, filter: { property: "رقم المرجع", rich_text: { equals: ref } } }),
    });
    if (!r.ok) return { email: "", phone: "", name: "" };
    const d = await r.json();
    const pg = (d.results || [])[0];
    if (!pg) return { email: "", phone: "", name: "" };
    const p = pg.properties || {};
    const flat = (a) => (a || []).map((t) => t.plain_text).join("");
    const notes = flat(p["Notes"] && p["Notes"].rich_text);
    const name = flat(p["Opportunity Name"] && p["Opportunity Name"].title);
    const em = notes.match(/البريد:\s*([^\s·]+@[^\s·]+)/);
    const ph = notes.match(/الجوال:\s*([+\d][\d\s()-]{5,})/);
    const direct = (p["البريد"] && p["البريد"].email) || "";
    return {
      email: String(direct || (em ? em[1] : "")).trim().toLowerCase(),
      phone: ph ? ph[1].trim() : "",
      name: (name.split("—")[0] || "").trim(),
    };
  } catch { return { email: "", phone: "", name: "" }; }
}

// The portal's rows are keyed by organization, and a person is the way in.
async function orgIdForEmail(email) {
  if (!DB_ON || !isEmail(email)) return null;
  try {
    const users = await sb(`users?email=eq.${encodeURIComponent(String(email).toLowerCase())}&select=id&limit=1`);
    if (!users.length) return null;
    const mem = await sb(`organization_members?user_id=eq.${users[0].id}&status=eq.active&select=organization_id&limit=1`);
    return mem.length ? mem[0].organization_id : null;
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------
async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY || !isEmail(to)) return { ok: false, error: RESEND_API_KEY ? "bad_email" : "email_not_configured" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
    if (!r.ok) { const t = (await r.text()).slice(0, 200); console.error("stage email", r.status, t); return { ok: false, error: `http_${r.status}` }; }
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e.message || "email_failed").slice(0, 80) }; }
}

// Saudi mobiles get typed half a dozen ways; WhatsApp wants one.
export function waNumber(raw) {
  let d = String(raw || "").replace(/[^\d]/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "966" + d.slice(1);
  else if (d.length === 9 && d.startsWith("5")) d = "966" + d;
  return d.length >= 11 && d.length <= 15 ? d : "";
}

// A business-initiated WhatsApp message only delivers as free text inside the
// 24-hour customer-service window; outside it Meta requires an approved
// template. We try text, and fall back to a template when one is configured —
// and when neither lands we say which of the two it was, because "sent" that
// silently wasn't is worse than a visible gap.
export async function waSend(phone, text) {
  const to = waNumber(phone);
  if (!WA_TOKEN || !WA_PHONE_ID) return { ok: false, error: "wa_not_configured" };
  if (!to) return { ok: false, error: "no_phone" };
  const post = (payload) => fetch(`${WA_GRAPH}/${WA_PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${WA_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, ...payload }),
  });
  try {
    const r = await post({ type: "text", text: { preview_url: true, body: String(text).slice(0, 3500) } });
    if (r.ok) return { ok: true, mode: "text" };
    const body = await r.text();
    let code = 0;
    try { code = ((JSON.parse(body).error || {}).code) || 0; } catch {}
    // 131047 / 131026: outside the 24h window — only a template gets through.
    if (WA_TEMPLATE && (code === 131047 || code === 131026 || code === 131051)) {
      const t = await post({
        type: "template",
        template: {
          name: WA_TEMPLATE, language: { code: WA_TEMPLATE_LANG },
          components: [{ type: "body", parameters: [{ type: "text", text: String(text).replace(/\s+/g, " ").slice(0, 900) }] }],
        },
      });
      if (t.ok) return { ok: true, mode: "template" };
      return { ok: false, error: `template_http_${t.status}`, detail: (await t.text()).slice(0, 200) };
    }
    return { ok: false, error: code ? `wa_${code}` : `http_${r.status}`, detail: body.slice(0, 200) };
  } catch (e) { return { ok: false, error: String(e.message || "wa_failed").slice(0, 80) }; }
}

// The owner's phone, through the webhook the site already uses. Read-only from
// our side: we POST the same shape requests.js posts, and change nothing.
async function ownerPing(payload) {
  try {
    const r = await fetch(OWNER_WA_WEBHOOK, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { ok: r.ok };
  } catch { return { ok: false }; }
}

// ---------------------------------------------------------------------------
// The announcement itself
// ---------------------------------------------------------------------------
function emailHtml({ title, line, cta, url, ref, service, total, extra, note }) {
  return `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430;max-width:560px;margin:auto;text-align:right">
    <h2 style="color:#0B1B5A;margin:0 0 6px">${esc(title)}</h2>
    ${line ? `<p style="line-height:1.9;color:#334155">${esc(line)}</p>` : ""}
    ${extra ? `<p style="line-height:1.9;background:#f8fafc;border-right:3px solid #0B1B5A;padding:10px 14px;border-radius:6px">${esc(extra)}</p>` : ""}
    <table style="margin:14px 0;border-collapse:collapse">
      ${ref ? `<tr><td style="padding:4px 10px;color:#64748b">رقم الطلب</td><td style="padding:4px 10px"><b>${esc(ref)}</b></td></tr>` : ""}
      ${service ? `<tr><td style="padding:4px 10px;color:#64748b">الخدمة</td><td style="padding:4px 10px"><b>${esc(service)}</b></td></tr>` : ""}
      ${total ? `<tr><td style="padding:4px 10px;color:#64748b">الإجمالي شامل الضريبة</td><td style="padding:4px 10px"><b>${esc(total)}</b></td></tr>` : ""}
    </table>
    ${url ? `<p style="margin:20px 0"><a href="${esc(url)}" style="background:#0B1B5A;color:#fff;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:bold;display:inline-block">${esc(cta || "افتح لوحة العميل")}</a></p>` : ""}
    ${note ? `<p style="color:#64748b;font-size:12px;line-height:1.9;border-top:1px solid #e2e8f0;padding-top:12px;margin-top:18px"><b style="color:#334155">تنبيه أمني</b><br>${esc(note)}</p>` : ""}
    <p style="color:#94a3b8;font-size:12px;margin-top:24px">بيزنس بارتنر · الرياض · <a href="${esc(SITE)}" style="color:#94a3b8">businesspartner.sa</a></p>
  </div>`;
}

/**
 * Announce one stage of one order to the client and the owner.
 *
 * @param {object} ev
 * @param {string} ev.stage      key of STAGE
 * @param {string} ev.clientRef  the client's own order reference (RFQ-…)
 * @param {string} [ev.orderId]  Notion work-order page id (for idempotency)
 * @param {string} [ev.email]    override the CRM e-mail
 * @param {string} [ev.phone]    override the CRM mobile
 * @param {string} [ev.name]     client name
 * @param {string} [ev.service]  what was ordered
 * @param {number} [ev.total]    amount including VAT
 * @param {string} [ev.url]      where the button goes
 * @param {string} [ev.extra]    one extra sentence (a progress note, a reason)
 * @returns {Promise<object>}    what actually went out, per channel
 */
export async function announce(ev) {
  const meta = STAGE[ev && ev.stage];
  const report = { stage: (ev && ev.stage) || "", inapp: false, task: false, approval: false, email: false, wa: false, owner: false };
  if (!meta) return { ...report, error: "unknown_stage" };

  const clientRef = String(ev.clientRef || "").trim();
  let email = String(ev.email || "").trim().toLowerCase();
  let phone = String(ev.phone || "").trim();
  let name = String(ev.name || "").trim();
  if ((!email || !phone) && clientRef) {
    const c = await contactForRef(clientRef);
    email = email || c.email;
    phone = phone || c.phone;
    name = name || c.name;
  }
  report.to = { email: email || "", phone: phone ? waNumber(phone) : "" };

  const url = ev.url || `${SITE}/ar/account`;
  const total = ev.total != null ? money(ev.total) : "";
  const title = meta.title;
  const line = ev.extra && ev.stage === "work_update" ? "" : meta.line;
  // One key per (order, stage) so a retry re-sends nothing twice.
  const key = `stage:${ev.stage}:${ev.orderId || clientRef || "x"}`;

  // 1) the portal
  const orgId = await orgIdForEmail(email);
  if (orgId) {
    try {
      await notify({
        organization_id: orgId, event: `order_${ev.stage}`, channel: "inapp",
        title: clientRef ? `${title} — ${clientRef}` : title,
        body: [line, ev.extra].filter(Boolean).join(" ") || null,
        idempotency_key: key,
      });
      report.inapp = true;
    } catch {}
    if (meta.task) {
      try {
        const dup = await sb(`tasks?organization_id=eq.${orgId}&status=neq.done&title=eq.${encodeURIComponent(`${meta.task} — ${clientRef}`)}&select=id&limit=1`);
        if (!dup.length) {
          await sb("tasks", { method: "POST", prefer: "return=minimal", body: [{
            organization_id: orgId, title: `${meta.task} — ${clientRef}`,
            details: [ev.service, total].filter(Boolean).join(" · ") || null,
            assignee: "client", status: "open", urgency: meta.urgency || "normal",
          }] });
          report.task = true;
        }
      } catch {}
    }
    if (meta.approval && ev.orderId) {
      try {
        // target_entity carries what approving actually decides, so the
        // portal's «الموافقات» is the real gate and not a second inbox.
        const target = `quote:${ev.orderId}${ev.token ? `:${ev.token}` : ""}`;
        const dup = await sb(`approvals?organization_id=eq.${orgId}&status=eq.pending&target_entity=eq.${encodeURIComponent(target)}&select=id&limit=1`);
        if (!dup.length) {
          await sb("approvals", { method: "POST", prefer: "return=minimal", body: [{
            organization_id: orgId, action_type: "quote_approval",
            title: `عرض سعر ${clientRef}${ev.service ? ` — ${ev.service}` : ""}`,
            amount: ev.total != null && Number.isFinite(Number(ev.total)) ? Number(ev.total) : null,
            target_entity: target,
            risk_note: "بالموافقة تُعتمد قيمة العرض ويُرسل لك العقد للتوقيع ثم رابط السداد.",
            status: "pending",
          }] });
          report.approval = true;
        }
      } catch {}
    }
  }

  // 2) e-mail
  if (email) {
    const sent = await sendEmail(
      email,
      `${title}${clientRef ? ` — ${clientRef}` : ""}`,
      emailHtml({ title, line, cta: meta.cta, url, ref: clientRef, service: ev.service, total, extra: ev.extra, note: meta.note }),
    );
    report.email = !!sent.ok;
    if (!sent.ok) report.emailError = sent.error;
  }

  // 3) WhatsApp — the client
  if (phone) {
    const text = [
      `*${title}*`,
      clientRef ? `رقم الطلب: ${clientRef}` : "",
      ev.service ? `الخدمة: ${ev.service}` : "",
      total ? `الإجمالي: ${total}` : "",
      ev.extra || line,
      url,
    ].filter(Boolean).join("\n");
    const w = await waSend(phone, text);
    report.wa = !!w.ok;
    if (!w.ok) report.waError = w.error;
  }

  // 4) the owner
  const o = await ownerPing({
    source: "order-stage",
    ref: clientRef, name: name || "", phone: phone || "", email: email || "",
    transcript: `📌 ${meta.ownerNote} — ${clientRef}${ev.service ? " · " + ev.service : ""}${total ? " · " + total : ""}${ev.extra ? "\n" + ev.extra : ""}`,
    url,
  });
  report.owner = !!o.ok;

  return report;
}

// What the panel shows when Bahir asks "are the client's notifications on?".
// Reports configuration only — never a token, never a phone number.
export function stageChannels() {
  return {
    portal: DB_ON,
    email: !!RESEND_API_KEY,
    whatsapp: !!(WA_TOKEN && WA_PHONE_ID),
    whatsappTemplate: !!WA_TEMPLATE,
    ownerWebhook: !!OWNER_WA_WEBHOOK,
    crm: !!NOTION_TOKEN,
    missing: [
      DB_ON ? null : "SUPABASE_SERVICE_KEY",
      RESEND_API_KEY ? null : "RESEND_API_KEY",
      WA_TOKEN ? null : "WHATSAPP_TOKEN",
      WA_PHONE_ID ? null : "WHATSAPP_PHONE_ID",
    ].filter(Boolean),
  };
}
