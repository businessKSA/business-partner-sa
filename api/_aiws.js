import crypto from "node:crypto";
// Business Partner AI — خلفية صفحة /ai على الموقع. يملكها وكيل `ai-workspace`.
//
// المنصة نفسها (مساحة Open WebUI مستقلة لكل شركة) تعيش على ai.businesspartner.sa
// على خادم Azure، لا في هذا المستودع. هذه الوحدة جسرٌ رفيع بين الصفحة والمنصة:
//
//   GET  /api/requests?__route=ai&action=plans  ← باقات المنصة من مصدرها
//        (`/signup/plans`)، مخزّنة عشر دقائق. المنصة لا ترسل ترويسات CORS،
//        فلا تستطيع الصفحة قراءتها مباشرة من المتصفح.
//   POST /api/requests?__route=ai {action:"trial", …} ← طلب تجربة لشركة.
//        يُرسَل إلى Unified Revenue Intake في n8n فيصير صفقةً ومهمةً لفريق
//        المبيعات، ثم يتولاه فريق نايف. **لا يُنشئ مساحة**: الإنشاء خلف خدمة
//        محمية برمز على الخادم، ورمزها لا يدخل هذا الموقع حتى يُضاف تأكيد
//        البريد وحدّ الإساءة (تقرير تسليم الخادم 2026-10-16، البند 9.5).
//
// الأسعار لا تخرج من هنا: الموقع يعرض الأسعار للمسجّلين وحدهم (SHOW_PRICES=false
// في CLAUDE.md §4)، فتُحذف حقول السعر من ردّ المنصة قبل أن يصل المتصفح.

const AIWS_BASE = String(process.env.AIWS_BASE || "https://ai.businesspartner.sa").replace(/\/+$/, "");
const INTAKE_URL = process.env.BP_REVENUE_INTAKE_URL || "https://businesspartnerai.app.n8n.cloud/webhook/bp-ai/revenue-intake";
const PLANS_TTL_MS = 10 * 60e3;
const PLAN_FIELDS = ["code", "name", "seats", "days", "credit_usd", "features"];
// ميزة تعلنها المنصة ولا وجود لها بعد (لا SSO على الخادم — تقرير التسليم البند 4) لا تُعرض.
const HIDDEN_FEATURES = new Set(["sso"]);
// باقة التجربة (Starter) لا تُعرض: قرار المالك 2026-10-16 «التجربة ستارتر تُحذف». البيع بالشراء.
const HIDDEN_PLANS = new Set(["trial"]);

const cache = new Map(); // lang → { at, plans }

export function sanitizePlans(raw) {
  const list = raw && Array.isArray(raw.plans) ? raw.plans : [];
  return list
    .filter((p) => p && typeof p.code === "string" && !HIDDEN_PLANS.has(p.code))
    .map((p) => {
      const o = {};
      for (const k of PLAN_FIELDS) if (p[k] != null) o[k] = p[k];
      o.features = (Array.isArray(p.features) ? p.features : []).filter((f) => typeof f === "string" && !HIDDEN_FEATURES.has(f));
      return o;
    });
}

async function getPlans(lang, doFetch, now) {
  const key = lang === "ar" ? "ar" : "en";
  const hit = cache.get(key);
  if (hit && now - hit.at < PLANS_TTL_MS) return hit.plans;
  const r = await doFetch(`${AIWS_BASE}/signup/plans?lang=${key}`, { signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error("plans_upstream_" + r.status);
  const plans = sanitizePlans(await r.json());
  cache.set(key, { at: now, plans });
  return plans;
}

/* ───────────── طلب التجربة ───────────── */
const HITS = new Map();
const RL = { windowMs: 10 * 60e3, max: 4 };
function rateLimited(ip, nowMs) {
  if (!ip) return false;
  const arr = (HITS.get(ip) || []).filter((t) => nowMs - t < RL.windowMs);
  if (arr.length >= RL.max) { HITS.set(ip, arr); return true; }
  arr.push(nowMs); HITS.set(ip, arr);
  if (HITS.size > 5000) for (const [k, v] of HITS) if (!v.some((t) => nowMs - t < RL.windowMs)) HITS.delete(k);
  return false;
}
export const _resetAiwsState = () => { HITS.clear(); cache.clear(); };

const clean = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// بريد مجاني لا يصلح لمساحة شركة: التسجيل في المنصة مقيّد بنطاق بريد الشركة.
const FREE_MAIL = new Set(["gmail.com", "hotmail.com", "outlook.com", "live.com", "yahoo.com", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "msn.com", "ymail.com"]);
const TEAM_SIZES = new Set(["1", "2-5", "6-20", "21-100", "100+"]);

export function validateTrial(b) {
  const f = {
    company: clean(b.company, 120),
    name: clean(b.name, 120),
    email: clean(b.email, 160).toLowerCase(),
    phone: clean(b.phone, 30),
    website: clean(b.website, 200),
    team: clean(b.team, 10),
    useCase: clean(b.useCase, 1000),
  };
  const errors = [];
  if (f.company.length < 2) errors.push("company");
  if (f.name.length < 2) errors.push("name");
  if (!EMAIL_RE.test(f.email)) errors.push("email");
  else if (FREE_MAIL.has(f.email.split("@")[1])) errors.push("email_free");
  const digits = f.phone.replace(/[^\d+]/g, "");
  if (digits.replace(/\D/g, "").length < 8) errors.push("phone");
  if (f.team && !TEAM_SIZES.has(f.team)) errors.push("team");
  return { fields: f, errors };
}

export function intakePayload(f, ref, lang) {
  const lines = [
    `طلب تجربة Business Partner AI من صفحة /ai (${ref})`,
    `الشركة: ${f.company}`,
    `المسؤول: ${f.name}`,
    f.website ? `الموقع: ${f.website}` : "",
    f.team ? `حجم الفريق: ${f.team}` : "",
    `نطاق البريد للتسجيل: ${f.email.split("@")[1]}`,
    f.useCase ? `الاستخدام المطلوب: ${f.useCase}` : "",
    `اللغة: ${lang}`,
  ].filter(Boolean);
  return {
    client_name: f.company,
    company: f.company,
    phone: f.phone,
    email: f.email,
    service: "Business Partner AI — مساحة شركة",
    source_channel: "website-ai",
    message: lines.join("\n"),
    event_id: ref,
  };
}

/**
 * @param {object} body  حمولة الطلب (للـGET: {action:"plans", lang})
 * @param {object} ctx   { ip, now, fetch, dev, outbox }
 * @returns {Promise<{status:number, body:object}>}
 */
export async function handleAiws(body, ctx = {}) {
  const now = ctx.now || Date.now();
  const doFetch = ctx.fetch || fetch;
  const action = String((body && body.action) || "");

  if (action === "plans") {
    try {
      const plans = await getPlans(String(body.lang || ""), doFetch, now);
      return { status: 200, body: { ok: true, plans } };
    } catch {
      return { status: 502, body: { ok: false, error: "plans_unavailable" } };
    }
  }

  if (action === "trial") {
    // حقل مصيدة: يملؤه الروبوت وحده. يُقبل بصمت ولا يُرسل شيء.
    if (clean(body.hp, 50)) return { status: 200, body: { ok: true, ref: "AI-0" } };
    if (rateLimited(ctx.ip, now)) return { status: 429, body: { ok: false, error: "rate_limited" } };
    const { fields, errors } = validateTrial(body);
    if (errors.length) return { status: 400, body: { ok: false, error: "invalid_fields", fields: errors } };
    const ref = "AI-" + new Date(now).toISOString().slice(2, 10).replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 7).toUpperCase();
    const payload = intakePayload(fields, ref, body.lang === "ar" ? "ar" : "en");
    // محلياً لا يصل شيءٌ إلى n8n الحيّ (api/_mode.js): يُكتب في الصندوق المحلي.
    if (ctx.dev) {
      if (ctx.outbox) await ctx.outbox({ kind: "n8n", to: "bp-ai/revenue-intake", subject: ref, payload }).catch(() => {});
      return { status: 200, body: { ok: true, ref } };
    }
    try {
      const r = await doFetch(INTAKE_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) throw new Error("intake_" + r.status);
    } catch {
      return { status: 502, body: { ok: false, error: "intake_failed" } };
    }
    return { status: 200, body: { ok: true, ref } };
  }

  return { status: 400, body: { ok: false, error: "unknown_action" } };
}

/* ───────────── مفعّل الخدمات: بعد الدفع ───────────── */
// الدفع تحقّق منه api/pay.js مع ميسر مباشرة (verified) قبل أن يصل هنا. هذه الدالة
// تسلّم حدث الشراء إلى «مفعّل الخدمات» في n8n (Azure) بمفتاح ترويسة، وهو يجهّز
// المساحة ويُبلغ العميل. لا تُنشئ مساحة بنفسها ولا تحمل رمز خادم المنصة.
const ACTIVATOR_URL = process.env.AIWS_ACTIVATOR_URL || "";
const ACTIVATOR_KEY = process.env.AIWS_ACTIVATOR_KEY || "";
export const AIWS_SKU_PLAN = { "bp-aiws-ind": "individual", "bp-aiws-bus": "business", "bp-aiws-bplus": "business_plus", "bp-aiws-ent": "enterprise" };

/** معرّف سطر السلة (svc-bp-aiws-bus) ← رمز باقة المنصة، أو "" لغير باقات Business Partner AI. */
export function aiwsPlanOf(id) {
  const k = String(id || "").toLowerCase().replace(/^svc-/, "").replace(/-monthly$/, "");
  return AIWS_SKU_PLAN[k] || "";
}

/**
 * @param {object} o { ref, payId, plans:[{sku,plan,qty}], company, name, email, phone, total, lang }
 * @param {object} ctx { fetch, dev, outbox }
 * @returns {Promise<{ok:boolean, queued?:boolean, error?:string}>}
 */
export async function activateAiws(o, ctx = {}) {
  const payload = {
    event: "aiws.paid",
    ref: String(o.ref || "").slice(0, 40),
    pay_id: String(o.payId || "").slice(0, 64),
    plans: (o.plans || []).slice(0, 4).map((p) => ({ sku: String(p.sku || "").toUpperCase().slice(0, 30), plan: String(p.plan || ""), qty: Math.max(1, Math.min(9, Number(p.qty) || 1)) })),
    company: clean(o.company, 200),
    name: clean(o.name, 160),
    email: clean(o.email, 160).toLowerCase(),
    phone: clean(o.phone, 40),
    total: Number(o.total) || 0,
    lang: o.lang === "en" ? "en" : "ar",
  };
  if (!payload.pay_id || !payload.plans.length || !EMAIL_RE.test(payload.email)) return { ok: false, error: "invalid" };
  if (ctx.dev) {
    if (ctx.outbox) await ctx.outbox({ kind: "n8n", to: "bp-service-activator", subject: payload.ref, payload }).catch(() => {});
    return { ok: true, queued: true };
  }
  if (!ACTIVATOR_URL || !ACTIVATOR_KEY) return { ok: false, error: "not_configured" };
  try {
    const r = await (ctx.fetch || fetch)(ACTIVATOR_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "X-BP-Activator-Key": ACTIVATOR_KEY },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return { ok: false, error: "activator_" + r.status };
    return { ok: true, queued: true };
  } catch {
    return { ok: false, error: "activator_unreachable" };
  }
}

/* ───────────── قسم Business Partner AI في لوحة العميل /my ───────────── */
// ما يراه العميل عن اشتراكه ومساحته، وما يرسله لتجهيزها (اسم المنشأة، رابطها، شعارها،
// لونها، مديروها). لا جدول جديد: الاشتراك هو طلب الشراء نفسه (requests.payment.items)،
// وبيانات المساحة وحالتها أحداثٌ على ذلك الطلب (request_events): aiws.setup من العميل،
// وaiws.ready من فريق نايف حين تجهز المساحة. آخر حدث من كل نوع هو الحالة الحالية.
//
// العزل: كل قراءة وكتابة بمنشأة الجلسة وحدها، ولا يُقبل معرّف منشأة من المتصفح.
// والمالك لا يرى من هنا شيئاً: لوحته تقرأ الأرقام (اشتراك، مستخدمون، استخدام) لا المحتوى.

const DAY = 86400e3;
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;
// أسماء لا تُعطى لعميل: نطاقات فرعية قائمة أو محجوزة للمنصة والموقع.
const RESERVED_SLUGS = new Set(["www", "ai", "api", "app", "admin", "my", "ops", "mail", "email", "smtp", "n8n", "cdn", "static", "assets", "quotes", "portal", "login", "auth", "signup", "billing", "status", "help", "support", "docs", "blog", "dev", "test", "staging", "preview", "businesspartner", "business-partner", "bp", "root", "owner"]);
const COLOR_RE = /^#[0-9a-f]{6}$/i;
const LOGO_MAX = 300 * 1024;
const LOGO_MIME = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }; // لا SVG: قد يحمل سكربتاً.

/** الاشتراكات من طلبات الشراء: كل بند svc-bp-aiws-* في طلب مدفوع من السلة. */
export function aiwsSubscriptions(rows, now = Date.now()) {
  const out = [];
  for (const r of rows || []) {
    const p = (r && r.payment) || {};
    if (p.status !== "PAID" && r.status !== "PAID" && r.status !== "IN_PROGRESS" && r.status !== "COMPLETED") continue;
    for (const it of Array.isArray(p.items) ? p.items : []) {
      const plan = aiwsPlanOf(it && it.id);
      if (!plan) continue;
      const paidAt = p.at || r.created_at || null;
      const t = paidAt ? Date.parse(paidAt) : NaN;
      const renews = isFinite(t) ? new Date(t + 30 * DAY).toISOString().slice(0, 10) : null;
      out.push({
        request_id: r.id, ref: r.ref, plan, sku: String(it.code || it.id || "").toUpperCase().replace(/^SVC-/, ""),
        qty: Math.max(1, Number(it.qty) || 1), amount: it.amount == null ? null : Number(it.amount),
        paid_at: paidAt, renews_at: renews,
        state: isFinite(t) && now > t + 30 * DAY ? "renewal_due" : "active",
        test: !!p.test,
      });
    }
  }
  return out.sort((a, b) => String(b.paid_at || "").localeCompare(String(a.paid_at || "")));
}

/** يتحقق من نموذج تجهيز المساحة. logo اختياري: {mime, b64}. */
export function validateSetup(b) {
  const errors = [];
  const company = clean(b && b.company, 120);
  const slug = String((b && b.slug) || "").trim().toLowerCase();
  const color = String((b && b.color) || "").trim();
  const admins = [...new Set((Array.isArray(b && b.admins) ? b.admins : String((b && b.admins) || "").split(/[\s,;،]+/))
    .map((e) => clean(e, 160).toLowerCase()).filter(Boolean))].slice(0, 10);
  if (company.length < 2) errors.push("company");
  if (!SLUG_RE.test(slug) || slug.includes("--") || RESERVED_SLUGS.has(slug)) errors.push("slug");
  if (color && !COLOR_RE.test(color)) errors.push("color");
  if (!admins.length || admins.some((e) => !EMAIL_RE.test(e))) errors.push("admins");
  let logo = null;
  if (b && b.logo && b.logo.b64) {
    const ext = LOGO_MIME[String(b.logo.mime || "").toLowerCase()];
    let buf = null;
    try { buf = Buffer.from(String(b.logo.b64), "base64"); } catch {}
    if (!ext || !buf || !buf.length) errors.push("logo_type");
    else if (buf.length > LOGO_MAX) errors.push("logo_size");
    else logo = { ext, mime: String(b.logo.mime).toLowerCase(), buf };
  }
  return { fields: { company, slug, color: color.toLowerCase(), admins }, logo, errors };
}

function workspaceFrom(events) {
  const setup = (events || []).find((e) => e.event === "aiws.setup") || null;
  const ready = (events || []).find((e) => e.event === "aiws.ready") || null;
  const d = (setup && setup.details) || {};
  return {
    status: ready ? "ready" : setup ? "provisioning" : "needs_setup",
    company: d.company || "", slug: d.slug || "", color: d.color || "", admins: d.admins || [],
    logo_key: d.logo_key || "", submitted_at: setup ? setup.created_at : null,
    url: ready && ready.details ? ready.details.url || "" : "", ready_at: ready ? ready.created_at : null,
  };
}

/**
 * قسم العميل. ctx = { sess, sb, storagePut, storageSign, notify, activate, fetch, now, lang }
 *   action "my"     ← { ok, subscriptions, workspace, plan:{seats,credit_sar} }
 *   action "setup"  ← يحفظ بيانات المساحة ويرسلها إلى «مفعّل الخدمات»
 */
export async function handleAiwsMy(action, body, ctx) {
  const sess = ctx.sess;
  if (!sess || !sess.user) return { status: 401, body: { ok: false, error: "unauthorized" } };
  const orgId = sess.organization && sess.organization.id;
  if (!orgId) return { status: 200, body: { ok: true, subscriptions: [], workspace: workspaceFrom([]) } };
  const rows = await ctx.sb(`requests?organization_id=eq.${orgId}&select=id,ref,status,payment,created_at&order=created_at.desc&limit=200`);
  const subs = aiwsSubscriptions(rows, ctx.now || Date.now());
  const ids = [...new Set(subs.map((s) => s.request_id))];
  const events = ids.length
    ? await ctx.sb(`request_events?request_id=in.(${ids.join(",")})&event=in.(aiws.setup,aiws.ready)&select=request_id,event,details,created_at&order=created_at.desc&limit=50`)
    : [];
  const ws = workspaceFrom(events);

  if (action === "my") {
    let plan = null;
    if (subs.length) {
      try {
        const plans = await getPlans(ctx.lang === "ar" ? "ar" : "en", ctx.fetch || fetch, ctx.now || Date.now());
        const p = plans.find((x) => x.code === subs[0].plan);
        if (p) plan = { seats: p.seats == null ? null : p.seats, credit_sar: p.credit_usd == null ? null : Math.round(p.credit_usd * 3.75) };
      } catch {}
    }
    let logo_url = "";
    if (ws.logo_key && ctx.storageSign) { try { logo_url = await ctx.storageSign(ws.logo_key, 600); } catch {} }
    const { logo_key, ...pub } = ws;
    return { status: 200, body: { ok: true, subscriptions: subs.map(({ request_id, ...s }) => s), workspace: { ...pub, logo_url }, plan } };
  }

  if (action === "setup") {
    if (!subs.length) return { status: 403, body: { ok: false, error: "no_subscription" } };
    const { fields, logo, errors } = validateSetup(body);
    if (errors.length) return { status: 400, body: { ok: false, error: "invalid_fields", fields: errors } };
    // الرابط لا يتغيّر بعد أن تجهز المساحة: صار عنوانها عند مستخدميها.
    if (ws.status === "ready" && ws.slug && fields.slug !== ws.slug) return { status: 409, body: { ok: false, error: "slug_locked" } };
    // الرابط لمنشأة واحدة. أفضل جهد هنا، والخادم يرفض المكرّر عند الإنشاء على كل حال.
    try {
      const taken = await ctx.sb(`request_events?event=eq.aiws.setup&select=request_id,details&order=created_at.desc&limit=1000`);
      if ((taken || []).some((e) => e.details && e.details.slug === fields.slug && !ids.includes(e.request_id))) {
        return { status: 409, body: { ok: false, error: "slug_taken" } };
      }
    } catch {}
    let logo_key = ws.logo_key || "";
    if (logo) {
      logo_key = `aiws/${orgId}/logo-${(ctx.now || Date.now()).toString(36)}.${logo.ext}`;
      await ctx.storagePut(logo_key, logo.buf, logo.mime);
    }
    const sub = subs[0];
    const details = { ...fields, logo_key };
    await ctx.sb("request_events", { method: "POST", body: { request_id: sub.request_id, actor_kind: "customer", actor: sess.user.email || "", event: "aiws.setup", details }, prefer: "return=minimal" });
    let logo_url = "";
    if (logo_key && ctx.storageSign) { try { logo_url = await ctx.storageSign(logo_key, 7 * 86400); } catch {} }
    let queued = false;
    if (ctx.activate) {
      const r = await ctx.activate({
        event: "aiws.setup", ref: sub.ref, plan: sub.plan, sku: sub.sku,
        company: fields.company, slug: fields.slug, color: fields.color, admins: fields.admins,
        logo_url, email: sess.user.email || "", lang: ctx.lang === "en" ? "en" : "ar",
      }).catch(() => ({ ok: false }));
      queued = !!(r && r.ok);
    }
    return { status: 200, body: { ok: true, status: ws.status === "ready" ? "ready" : "provisioning", queued } };
  }

  return { status: 400, body: { ok: false, error: "unknown_action" } };
}

/** يرسل حدث تجهيز المساحة إلى «مفعّل الخدمات» بالمفتاح نفسه. */
export async function sendAiwsSetup(payload, ctx = {}) {
  if (ctx.dev) {
    if (ctx.outbox) await ctx.outbox({ kind: "n8n", to: "bp-service-activator", subject: payload.ref, payload }).catch(() => {});
    return { ok: true, queued: true };
  }
  if (!ACTIVATOR_URL || !ACTIVATOR_KEY) return { ok: false, error: "not_configured" };
  try {
    const r = await (ctx.fetch || fetch)(ACTIVATOR_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "X-BP-Activator-Key": ACTIVATOR_KEY },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });
    return r.ok ? { ok: true, queued: true } : { ok: false, error: "activator_" + r.status };
  } catch {
    return { ok: false, error: "activator_unreachable" };
  }
}

/**
 * فريق نايف يُبلغ الموقع أن المساحة جهزت: POST {action:"ready", ref, url} بترويسة
 * X-BP-Activator-Key نفسها. يكتب حدث aiws.ready فيظهر الرابط للعميل في /my.
 */
export async function handleAiwsReady(body, ctx) {
  const key = String(ctx.key || "");
  if (!ACTIVATOR_KEY && !ctx.dev) return { status: 503, body: { ok: false, error: "not_configured" } };
  const want = ACTIVATOR_KEY || (ctx.dev ? "dev-activator" : "");
  const a = Buffer.from(key), b = Buffer.from(want);
  if (!want || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { status: 403, body: { ok: false, error: "forbidden" } };
  return markAiwsReady(body, ctx, "nayef_ai_workspace");
}

/** يكتب حدث aiws.ready على طلب الشراء (الرابط على نطاق الموقع وحده) ويُعلم العميل داخل لوحته. */
async function markAiwsReady(body, ctx, actor) {
  const ref = clean(body && body.ref, 40);
  let url = "";
  try {
    const u = new URL(String((body && body.url) || ""));
    if (u.protocol === "https:" && (u.hostname === "businesspartner.sa" || u.hostname.endsWith(".businesspartner.sa"))) url = u.origin + u.pathname.replace(/\/+$/, "");
  } catch {}
  if (!/^BP-R-[A-Z0-9]{4,12}$/.test(ref) || !url) return { status: 400, body: { ok: false, error: "invalid_fields" } };
  const rows = await ctx.sb(`requests?ref=eq.${ref}&select=id,organization_id&limit=1`);
  const r = rows && rows[0];
  if (!r) return { status: 404, body: { ok: false, error: "not_found" } };
  await ctx.sb("request_events", { method: "POST", body: { request_id: r.id, actor_kind: "internal", actor, event: "aiws.ready", details: { url } }, prefer: "return=minimal" });
  if (ctx.notify && r.organization_id) {
    await ctx.notify({ organization_id: r.organization_id, channel: "inapp", event: "aiws.ready", title: "مساحتك في Business Partner AI جاهزة", body: url, idempotency_key: `aiws.ready:${ref}:${url}` }).catch(() => {});
  }
  return { status: 200, body: { ok: true } };
}

/* ───────────── لوحة المالك /ops ───────────── */
// ما يراه المالك عن مشتركي Business Partner AI: من اشترك وبأي باقة، والتجديد، وحالة
// المساحة ورابطها، وعدد المستخدمين والاستخدام. **لا محتوى:** لا محادثات ولا ملفات ولا
// شعار ولا قائمة مديرين — قرار المالك 2026-10-16: «ما يكون عندي أي صلاحية على صفحته أو
// معلوماته». المستخدمون والاستخدام يأتيان من خادم المنصة حين يُبنى مسار الأرقام عليه
// (AIWS_USAGE_URL)، وحتى ذلك تُعرض فارغة بسبب واضح لا بأصفار مخترعة.
const USAGE_URL = process.env.AIWS_USAGE_URL || "";
const USAGE_KEY = process.env.AIWS_USAGE_KEY || "";

async function usageBySlug(doFetch) {
  if (!USAGE_URL || !USAGE_KEY) return null;
  try {
    const r = await doFetch(USAGE_URL, { headers: { Authorization: `Bearer ${USAGE_KEY}` }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const j = await r.json();
    const out = new Map();
    // أرقام فقط: عدد المستخدمين، والمستهلك من الرصيد بالدولار، وآخر نشاط.
    for (const t of (j && Array.isArray(j.tenants) ? j.tenants : [])) {
      if (!t || !t.slug) continue;
      out.set(String(t.slug), {
        users: Number.isFinite(Number(t.users)) ? Number(t.users) : null,
        spent_sar: Number.isFinite(Number(t.spent_usd)) ? Math.round(Number(t.spent_usd) * 3.75 * 100) / 100 : null,
        last_active: t.last_active ? String(t.last_active).slice(0, 40) : null,
      });
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * ctx = { sb, fetch, now, notify }
 *   action "ops"        ← { ok, rows:[…], totals, usage_source }
 *   action "ops-ready"  ← المالك يسجّل أن المساحة جهزت برابطها (حين يجهّزها الفريق يدوياً)
 */
export async function handleAiwsOps(action, body, ctx) {
  if (action === "ops-ready") return markAiwsReady(body, ctx, "owner");
  if (action !== "ops") return { status: 400, body: { ok: false, error: "unknown_action" } };
  const now = ctx.now || Date.now();
  const doFetch = ctx.fetch || fetch;
  const reqs = await ctx.sb(`requests?select=id,ref,organization_id,status,payment,client_name,client_email,company_name,created_at&order=created_at.desc&limit=1000`);
  const subs = aiwsSubscriptions(reqs, now);
  const byId = new Map((reqs || []).map((r) => [r.id, r]));
  const ids = [...new Set(subs.map((s) => s.request_id))];
  const events = ids.length
    ? await ctx.sb(`request_events?request_id=in.(${ids.join(",")})&event=in.(aiws.setup,aiws.ready)&select=request_id,event,details,created_at&order=created_at.desc&limit=2000`)
    : [];
  let plans = [];
  try { plans = await getPlans("en", doFetch, now); } catch {}
  const usage = await usageBySlug(doFetch);
  // منشأة واحدة = صف واحد ومساحة واحدة: آخر اشتراك لها، وحالة المساحة من أحداث كل طلباتها
  // (كما يراها العميل في /my). التجديد أو الشراء الثاني لا يفتح صفاً ثانياً.
  const orgOf = (s) => (byId.get(s.request_id) || {}).organization_id || "req:" + s.request_id;
  const groups = new Map();
  for (const s of subs) { const k = orgOf(s); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); }
  const rows = [...groups.values()].map((list) => {
    const s = list[0];
    const r = byId.get(s.request_id) || {};
    const reqIds = new Set(list.map((x) => x.request_id));
    const ws = workspaceFrom((events || []).filter((e) => reqIds.has(e.request_id)));
    const p = plans.find((x) => x.code === s.plan);
    const u = usage && ws.slug ? usage.get(ws.slug) : null;
    return {
      ref: s.ref, plan: s.plan, sku: s.sku, amount: s.amount, paid_at: s.paid_at, renews_at: s.renews_at, state: s.state, test: s.test, payments: list.length,
      company: ws.company || r.company_name || r.client_name || "", email: r.client_email || "",
      ws_status: ws.status, slug: ws.slug, url: ws.url, submitted_at: ws.submitted_at, ready_at: ws.ready_at,
      seats: p && p.seats != null ? p.seats : null,
      users: u ? u.users : null, spent_sar: u ? u.spent_sar : null, last_active: u ? u.last_active : null,
    };
  });
  const live = rows.filter((x) => !x.test);
  const totals = {
    active: live.filter((x) => x.state === "active").length,
    renewal_due: live.filter((x) => x.state === "renewal_due").length,
    mrr: Math.round(live.filter((x) => x.state === "active").reduce((a, x) => a + (Number(x.amount) || 0), 0) * 100) / 100,
    needs_setup: rows.filter((x) => x.ws_status === "needs_setup").length,
    provisioning: rows.filter((x) => x.ws_status === "provisioning").length,
    ready: rows.filter((x) => x.ws_status === "ready").length,
    test: rows.length - live.length,
  };
  return { status: 200, body: { ok: true, rows, totals, usage_source: usage ? "platform" : "pending" } };
}
