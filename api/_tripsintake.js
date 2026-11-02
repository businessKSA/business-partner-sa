// Business Partner — طلبات «محفول مكفول» من صفحة /trips (ESM).
//
// تركب على api/requests.js عبر __route=trips-intake ولا تُنشر كدالة مستقلة:
// الخطة تحدّ النشرة بـ12 دالة والمستودع على الحد. التوجيه سطر واحد هناك.
//
// ما تفعله لكل طلب (خطوط corp / tour / inv):
//   ١) تتحقق من الحقول تحققاً صارماً (الواجهة تكرر القواعد نفسها للراحة فقط).
//   ٢) تسجّل الطلب في جدول requests (REVIEWING، المصدر WEBSITE) فيراه الفريق
//      في /ops ويلتقطه العميل في /my عند تسجيل دخوله بالبريد نفسه.
//   ٣) ترسل رسالة إلى فريق الاستقبال/التصنيف ليصنّفها ويوزّعها، ورسالة تأكيد
//      للعميل. الإرسال يمرّ بدالة sendEmail المشتركة فيحكمه EMAIL_MODE:
//      محلياً معاينة في .localdb/outbox.json ولا يصل شيء فعلاً.
//
// عنوان فريق الاستقبال: TRIPS_INTAKE_EMAIL، وإن غاب فعنوان الفريق المشترك
// (BOOKING_EMAIL ثم business@businesspartner.sa) — وهو العنوان الوحيد المعروف
// في المستودع لاستقبال الطلبات؛ لا عنوان مخترع.
//
// لا سعر هنا ولا يُخترع: الخطوط الثلاثة تُسعَّر بعرضٍ مخصّص من الفريق.
import crypto from "node:crypto";
import { DB_ON, sb } from "./_db.js";
import { EMAIL_LIVE, MODES } from "./_mode.js";

export const LINES = {
  corp: { ar: "فعاليات الشركات", en: "Corporate events" },
  tour: { ar: "الرحلات السياحية", en: "Tourism trips" },
  inv:  { ar: "زيارة المستثمر", en: "Investor visit" },
};

const LIM = { name: 120, company: 160, country: 80, city: 80, notes: 1500, sel: 40, selLen: 140 };
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// أرقام عربية/فارسية إلى لاتينية — الجوال يُكتب بلوحة مفاتيح عربية كثيراً.
const latin = (s) => String(s == null ? "" : s)
  .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
  .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
// أحرف التحكم والاتجاه الخفية تُحذف: تُستعمل لإخفاء نصٍّ في البريد.
const clean = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const isEmail = (e) => /^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$/.test(e) && e.length <= 160;
const isoDay = (d) => d.toISOString().slice(0, 10);

// ── التحقق: يعيد { ok, v } أو { ok:false, errors:{حقل: رمز} } ─────────────────
export function validate(b, now = new Date()) {
  const e = {};
  const line = String(b && b.line || "");
  if (!LINES[line]) return { ok: false, errors: { line: "invalid" } };

  const name = clean(b.name, LIM.name);
  if (name.length < 2 || /^[\d\s+\-().]+$/.test(name)) e.name = "invalid";

  const phoneRaw = latin(clean(b.phone, 30));
  const digits = phoneRaw.replace(/\D/g, "");
  if (!/^\+?[0-9\s\-().]+$/.test(phoneRaw) || digits.length < 8 || digits.length > 15) e.phone = "invalid";

  const email = clean(b.email, 160).toLowerCase();
  if (!isEmail(email)) e.email = "invalid";

  const country = clean(b.country, LIM.country);
  if (country.length < 2) e.country = "invalid";
  const city = clean(b.city, LIM.city);

  const company = clean(b.company, LIM.company);
  if (line === "corp" && company.length < 2) e.company = "invalid";

  const people = Number(latin(b.people));
  if (!Number.isInteger(people) || people < 1 || people > 5000) e.people = "invalid";

  const date = latin(clean(b.date, 12));
  const min = isoDay(new Date(now.getTime() - 864e5));
  const max = isoDay(new Date(now.getTime() + 3 * 366 * 864e5));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || date < min || date > max) e.date = "invalid";

  let budget = null;
  if (b.budget !== "" && b.budget != null) {
    const n = Number(latin(b.budget).replace(/[,\s]/g, ""));
    if (!Number.isFinite(n) || n < 0 || n > 1e9) e.budget = "invalid"; else budget = Math.round(n);
  }

  const notes = clean(b.notes, LIM.notes);

  // ما اختاره العميل: قوائم قصيرة نصّها كما عُرض بلغته. السقف يمنع الإغراق.
  const sel = (Array.isArray(b.selections) ? b.selections : []).slice(0, LIM.sel)
    .map((x) => clean(x, LIM.selLen)).filter(Boolean);
  if (line === "corp" && !sel.length) e.selections = "invalid";
  // inv: أزواج (عنوان: قيمة) — تُسلَّم كما هي نصّاً.
  const details = (Array.isArray(b.details) ? b.details : []).slice(0, 24)
    .map((p) => (Array.isArray(p) ? [clean(p[0], 80), clean(p[1], 400)] : null))
    .filter((p) => p && p[0] && p[1]);
  if (line === "inv" && !details.length) e.details = "invalid";

  if (b.consent !== true) e.consent = "required";
  // حقل فخّ: يملؤه الآليّون ولا يراه الإنسان.
  if (clean(b.website, 20)) e.website = "bot";
  const lang = ["ar", "en", "fr", "zh"].includes(b.lang) ? b.lang : "ar";

  if (Object.keys(e).length) return { ok: false, errors: e };
  return { ok: true, v: { line, name, phone: (phoneRaw.startsWith("+") ? "+" : "") + digits, email, country, city, company, people, date, budget, notes, selections: sel, details, lang } };
}

// ── تحديد المعدّل: ٥ طلبات كل ١٠ دقائق للعنوان (ذاكرة الدالة، كافٍ ضد الفيضان) ──
const HITS = new Map();
export function rateLimited(ip, nowMs = Date.now(), max = 5, windowMs = 600000) {
  if (!ip) return false;
  const arr = (HITS.get(ip) || []).filter((t) => nowMs - t < windowMs);
  if (arr.length >= max) { HITS.set(ip, arr); return true; }
  arr.push(nowMs); HITS.set(ip, arr);
  if (HITS.size > 2000) HITS.clear();
  return false;
}

const row = (k, v) => `<tr><td style="padding:5px 12px;color:#667;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:5px 12px"><b>${esc(v || "—")}</b></td></tr>`;

export function teamEmail(ref, v) {
  const L = LINES[v.line];
  const rows = row("المسار", `${L.ar} (${v.line})`) + row("الاسم", v.name) + row("الجوال", v.phone) + row("البريد", v.email) +
    (v.company ? row("الجهة", v.company) : "") + row("الدولة", v.country) + row("المدينة", v.city) +
    row("عدد الأفراد", String(v.people)) + row("التاريخ التقريبي", v.date) +
    row("الميزانية التقريبية (ريال)", v.budget == null ? "لم تُذكر" : String(v.budget)) +
    (v.selections.length ? row("ما اختاره", v.selections.join("، ")) : "") +
    v.details.map((p) => row(p[0], p[1])).join("") + row("ملاحظات", v.notes);
  // كتلة آلية في آخر الرسالة: وكيل البريد يقرؤها ليصنّف ويوزّع بلا تخمين.
  const machine = JSON.stringify({ source: "trips-intake", ref, line: v.line, team: "mahfol", lang: v.lang, people: v.people, date: v.date, country: v.country, hasBudget: v.budget != null });
  return {
    subject: `[محفول مكفول · ${v.line}] ${L.ar} — ${v.name} — ${ref}`,
    html: `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1F2430"><h2 style="color:#0B1B5A">طلب جديد من صفحة الرحلات — ${esc(L.ar)} — ${esc(ref)}</h2><table>${rows}</table>` +
      `<p style="color:#667;font-size:12px">للتصنيف والتوزيع: فريق محفول مكفول · المسار «${esc(v.line)}» · لا سعر معروض للعميل — يُسعَّر بعرضٍ مخصّص. العميل وافق على سياسة الخصوصية. الطلب مسجّل في «الطلبات» تحت ${esc(ref)}.</p>` +
      `<pre dir="ltr" style="background:#F4F6FB;padding:10px;border-radius:8px;font-size:11px;color:#445;white-space:pre-wrap;word-break:break-all">${esc(machine)}</pre></div>`,
  };
}

export function clientEmail(ref, v) {
  const L = LINES[v.line];
  return {
    subject: `استلمنا طلبك ${ref} — محفول مكفول`,
    html: `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:540px;margin:auto;color:#1F2430"><h2 style="color:#0B1B5A">استلمنا طلبك — ${esc(ref)}</h2>` +
      `<p>مرحباً ${esc(v.name)}،</p><p>وصلنا طلبك في «${esc(L.ar)}» (${esc(v.people)} أفراد · ${esc(v.date)}). يراجعه فريق محفول مكفول ويعود إليك بعرضٍ مخصّص على بريدك أو جوالك خلال يوم عمل.</p>` +
      `<p style="color:#667;font-size:12.5px">احتفظ برقم المرجع ${esc(ref)}. إن سجّلت دخولك لاحقاً بهذا البريد ظهر طلبك في صفحة «طلباتي».</p><p style="color:#0B1B5A">Business Partner</p></div>`,
  };
}

const newRef = () => "BP-R-" + crypto.randomBytes(3).toString("hex").toUpperCase();

// تسجيل الطلب في requests. يعيد { ref, stored }. لو تعذّر التسجيل لا يسقط
// الطلب: يصل الفريق بالبريد برقم مرجع مؤقت ونقول ذلك صراحةً (stored:false).
async function record(v) {
  const L = LINES[v.line];
  const title = `محفول مكفول — ${L.ar} — ${v.company || v.name}`.slice(0, 200);
  const scope = [...v.selections.map((s) => ({ title: s, why: L.ar })), ...v.details.map((p) => ({ title: `${p[0]}: ${p[1]}`, why: L.ar }))].slice(0, 40);
  const summary = [
    `طلب من صفحة الرحلات (${L.ar}). ${v.people} أفراد · تاريخ تقريبي ${v.date} · ${v.country}${v.city ? " / " + v.city : ""}.`,
    v.budget != null ? `ميزانية تقريبية ${v.budget} ريال.` : "",
    v.notes ? `ملاحظات: ${v.notes}` : "",
  ].filter(Boolean).join(" ").slice(0, 2000);
  if (!DB_ON) return { ref: "TRP-" + crypto.randomBytes(3).toString("hex").toUpperCase(), stored: false };
  for (let i = 0; i < 3; i++) {
    const ref = newRef();
    try {
      const rows = await sb("requests", { method: "POST", body: [{
        ref, type: "CONSULTATION", source: "WEBSITE", status: "REVIEWING", lang: v.lang, title, summary, scope,
        conversation: [{ role: "bp", content: "استلمنا طلبك ويراجعه فريق محفول مكفول؛ يصلك عرضٌ مخصّص خلال يوم عمل.", at: new Date().toISOString() }],
        client_name: v.name, client_email: v.email, client_phone: v.phone, company_name: v.company || null,
        internal_notes: `trips-intake · ${v.line} · ${v.country}${v.city ? "/" + v.city : ""} · ${v.people} · ${v.date} · ميزانية ${v.budget == null ? "—" : v.budget}`,
      }] });
      const created = rows && rows[0];
      if (created && created.id) {
        try { await sb("request_events", { method: "POST", prefer: "return=minimal", body: [{ request_id: created.id, actor_kind: "customer", actor: v.name, event: "request.created.trips-intake", details: { line: v.line, people: v.people, date: v.date } }] }); } catch {}
      }
      return { ref, stored: true };
    } catch (e) {
      if (i === 2) { console.error("trips-intake: record failed", String((e && e.message) || e).slice(0, 120)); }
    }
  }
  return { ref: "TRP-" + crypto.randomBytes(3).toString("hex").toUpperCase(), stored: false };
}

async function readJson(req) {
  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = null; } }
  if (b && typeof b === "object") return b;
  return await new Promise((resolve) => {
    let d = "";
    req.on("data", (c) => { d += c; if (d.length > 64 * 1024) { req.destroy(); resolve(null); } });
    req.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    req.on("error", () => resolve(null));
  });
}

// deps: { sendEmail(to, subject, html) → {ok,skipped?}, teamEmail }
export async function handleTripsIntake(req, res, deps) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  const out = (status, obj) => { res.statusCode = status; return res.end(JSON.stringify(obj)); };
  if (req.method !== "POST") return out(405, { ok: false, error: "method_not_allowed" });
  const body = await readJson(req);
  if (!body || typeof body !== "object" || Array.isArray(body)) return out(400, { ok: false, error: "invalid_body" });

  const ip = String((req.headers && (req.headers["x-forwarded-for"] || req.headers["x-real-ip"])) || "").split(",")[0].trim().slice(0, 64);
  const r = validate(body);
  if (!r.ok) {
    // الفخّ: ردّ نجاحٍ شكلي حتى لا يتعلّم الآلي شيئاً، ولا يُسجَّل ولا يُرسَل.
    if (r.errors.website) return out(200, { ok: true, ref: "TRP-000000", stored: false });
    return out(400, { ok: false, error: "invalid_fields", fields: r.errors });
  }
  if (rateLimited(ip)) return out(429, { ok: false, error: "rate_limited" });

  const v = r.v;
  const { ref, stored } = await record(v);
  const to = String(process.env.TRIPS_INTAKE_EMAIL || "").trim() || deps.teamEmail;
  const t = teamEmail(ref, v), c = clientEmail(ref, v);
  const [team, client] = await Promise.all([deps.sendEmail(to, t.subject, t.html), deps.sendEmail(v.email, c.subject, c.html)]);
  // في الإنتاج: الطلب ضاع تماماً لو لم يُسجَّل ولم يصل الفريق — نقول فشلاً لا نجاحاً كاذباً.
  const teamOk = !!(team && team.ok) || (!EMAIL_LIVE && team && team.skipped);
  if (!stored && !teamOk) return out(502, { ok: false, error: "unavailable" });
  return out(200, { ok: true, ref, stored, emailed: teamOk, mode: EMAIL_LIVE ? "live" : MODES().email, clientEmailed: !!(client && client.ok) });
}
