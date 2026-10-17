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
