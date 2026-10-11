// Business Partner — بوابة تعبئة ملف «الإقامة المميزة — رائد أعمال» (ESM).
//
// تركب على api/requests.js عبر __route=pr-intake ولا تُنشر كدالة مستقلة:
// خطة Vercel تحدّ النشرة بـ12 دالة والمستودع على الحد (انظر التعليق في
// api/requests.js). كل المنطق هنا، والتوجيه سطر واحد هناك.
//
// لماذا التصميم هكذا:
//   • المسوّدة ملف JSON واحد في Supabase Storage لا جدول جديد — لا هجرة
//     على db/schema.sql ولا صفّ نصف فارغ لكل عميل يفتح الرابط ولا يكمل.
//   • المرفقات تُخزَّن في Supabase (مصدر الحقيقة، مسارات مهيكلة لكل تبويب)
//     وتُرفع كذلك إلى صفحة نوشن ليراها الفريق دون تسجيل دخول للمخزن.
//   • الدخول بجلسة OTP بالبريد (api/otp.js) — لا رابط سرّي واحد للجميع:
//     الرابط المسرَّب يفتح الباب لكل من يملكه ولا يقول من عبّأ ماذا.
//
// متغيّرات البيئة: NOTION_TOKEN (موجود)، NOTION_PR_INTAKE_DB (قاعدة
// «التقديم على الإقامة المميزة — رائد أعمال»)، SUPABASE_URL/SERVICE_KEY.
import { DB_ON, getSession, storagePut, storageGet, storageSign } from "./_db.js";
import { uploadToNotion } from "./_suppliers.js";

const envFrom = (names) => { for (const n of names) { if (process.env[n] && String(process.env[n]).trim()) return String(process.env[n]).trim(); } return ""; };
const NOTION_TOKEN = envFrom(["NOTION_TOKEN", "BusinessPartnerSiteNotion", "NOTION_SECRET", "NOTION_API_KEY", "NOTION_KEY", "NOTION_INTEGRATION_TOKEN", "NOTION"]);
const PR_DB = (process.env.NOTION_PR_INTAKE_DB || "").trim();
const NOTION_VERSION = "2022-06-28";

// 8 ميغابايت لكل مرفق: سقف الخزنة نفسه المستعمل في بقية الموقع، وأقل من
// حدود نوشن وSupabase معاً فلا يفشل الرفع بعد أن يكون العميل انتظر.
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_DRAFT_BYTES = 512 * 1024;

// التبويبات الستة كما تظهر في بوابة مركز الإقامة المميزة. الترتيب هو ترتيب
// النموذج الرسمي حتى يعبّئ العميل عندنا بنفس تسلسل ما سيراه هناك.
export const PR_TABS = ["applicant", "family", "parents", "academic", "entrepreneur", "declaration"];
const TAB_SET = new Set(PR_TABS);

const clip = (s, n) => String(s == null ? "" : s).slice(0, n);
const slug = (s) => clip(s, 60).replace(/[^\w؀-ۿ.-]+/g, "-").replace(/^-+|-+$/g, "") || "file";
const draftPath = (uid) => `pr-intake/${uid}/draft.json`;
const filePath = (uid, tab, name) => `pr-intake/${uid}/${tab}/${Date.now()}-${slug(name)}`;

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  let total = 0;
  for await (const c of req) {
    total += c.length;
    // المرفق يصل base64 فينتفخ الثلث — 16MB سقف الطلب كله.
    if (total > 16 * 1024 * 1024) throw new Error("payload_too_large");
    chunks.push(c);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return {}; }
}

async function loadDraft(uid) {
  try {
    const buf = await storageGet(draftPath(uid));
    const d = JSON.parse(buf.toString("utf8"));
    return d && typeof d === "object" ? d : null;
  } catch { return null; }
}

async function saveDraft(uid, draft) {
  const body = Buffer.from(JSON.stringify(draft), "utf8");
  if (body.length > MAX_DRAFT_BYTES) throw new Error("draft_too_large");
  await storagePut(draftPath(uid), body, "application/json");
  return body.length;
}

// مسوّدة فارغة: التبويبات موجودة دائماً حتى لا تتفرّع الواجهة على غيابها.
function emptyDraft(session) {
  const now = new Date().toISOString();
  return {
    v: 1,
    startedAt: now,
    updatedAt: now,
    submittedAt: null,
    notionPageId: null,
    email: (session.user && session.user.email) || "",
    tabs: Object.fromEntries(PR_TABS.map((t) => [t, {}])),
    files: [],
  };
}

// الدمج على مستوى التبويب لا الملف كله: الحفظ التلقائي يرسل التبويب المفتوح
// وحده، فدمج الجذر كان يمسح التبويبات الأخرى عند أول حفظ.
function mergeTabs(draft, incoming) {
  if (!incoming || typeof incoming !== "object") return draft;
  for (const [tab, values] of Object.entries(incoming)) {
    if (!TAB_SET.has(tab) || !values || typeof values !== "object") continue;
    draft.tabs[tab] = { ...(draft.tabs[tab] || {}), ...values };
  }
  return draft;
}

// ---- نوشن ---------------------------------------------------------------
async function notion(path, method, body) {
  const r = await fetch(`https://api.notion.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": NOTION_VERSION,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) { console.error("notion", path, r.status, (await r.text()).slice(0, 300)); throw new Error("notion_failed"); }
  return r.json();
}

const txt = (v) => ({ rich_text: [{ text: { content: clip(v, 1900) } }] });
const num = (v) => { const n = Number(String(v).replace(/[^\d.-]/g, "")); return Number.isFinite(n) ? { number: n } : { number: null }; };

// نسبة الاكتمال تُحتسب على الخادم لا على المتصفح: هي ما يراه الفريق في نوشن
// ويقرّر عليه، فلا تُترك لقيمة يرسلها العميل.
// البيانات متداخلة: بطاقة لكل تابع ومجموعة لكل والد. عدّ سطحي يحسب مصفوفة
// التابعين كقيمة واحدة مهما كبرت، فتقفز النسبة أو تجمد بلا معنى.
function countLeaves(node, acc) {
  if (Array.isArray(node)) { for (const v of node) countLeaves(v, acc); return acc; }
  if (node && typeof node === "object") { for (const v of Object.values(node)) countLeaves(v, acc); return acc; }
  acc.total += 1;
  if (node !== "" && node !== null && node !== undefined && node !== false) acc.filled += 1;
  return acc;
}

function completeness(draft) {
  const acc = { filled: 0, total: 0 };
  for (const tab of PR_TABS) countLeaves(draft.tabs[tab] || {}, acc);
  let { filled, total } = acc;
  total += 10; // المرفقات الحرجة: بلا وزن ثابت تقفز النسبة لـ100% بلا مستند واحد
  filled += Math.min(10, (draft.files || []).length);
  return total ? Math.round((filled / total) * 100) / 100 : 0;
}

function notionProps(draft) {
  const a = draft.tabs.applicant || {};
  const e = draft.tabs.entrepreneur || {};
  const fam = draft.tabs.family || {};
  const par = draft.tabs.parents || {};
  const name = [a.firstNameEn, a.fatherNameEn, a.grandNameEn, a.familyNameEn].filter(Boolean).join(" ").trim();
  // الاختيار يُخزَّن نصّاً ("yes"/"no")، و"no" نصٌّ صادق — فالفحص بالصدق
  // وحده كان يرسل الوالد إلى نوشن رغم اختيار «لا».
  const parents = [];
  if (par.includeFather === "yes") parents.push({ name: "الأب" });
  if (par.includeMother === "yes") parents.push({ name: "الأم" });
  const tier = e.tier === "second" ? "الفئة الثانية" : e.tier === "first" ? "الفئة الأولى" : "لم تُحدد";
  const props = {
    "اسم العميل": { title: [{ text: { content: clip(name || draft.email || "ملف بلا اسم", 190) } }] },
    "البريد الإلكتروني": { email: clip(draft.email, 190) || null },
    "الحالة": { select: { name: draft.submittedAt ? "مكتمل" : "قيد التعبئة" } },
    "نسبة الاكتمال": { number: completeness(draft) },
    "الفئة": { select: { name: tier } },
    "اسم الشركة الناشئة": txt(e.startupName),
    "رقم الرخصة الريادية": txt(e.licenceNo),
    "رقم السجل التجاري": txt(e.crNo),
    "الرقم الوطني الموحد": txt(e.unifiedNo),
    "الجهة الاستثمارية": txt(e.investorLicensedName),
    "اسم الصندوق الفرعي": txt(e.subFund),
    "قيمة الجولة": num(e.roundAmount),
    "الجنسية": txt(a.nationality),
    "مقيم في المملكة": { checkbox: a.residency === "resident" },
    // العدد يُشتق من عدد البطاقات المعبّأة فعلاً، فلا يتناقض رقمٌ كتبه العميل
    // بيده مع ما رفعه من بيانات.
    "عدد التابعين": num(Array.isArray(fam.dependents) ? fam.dependents.length : 0),
    "الوالدان": { multi_select: parents },
    "تاريخ بدء التعبئة": { date: draft.startedAt ? { start: draft.startedAt.slice(0, 10) } : null },
  };
  if (a.phone) props["الجوال"] = { phone_number: clip(a.phone, 40) };
  // الحصة بعد التحويل: النموذج الرسمي يطلبها «بافتراض تحويل جميع الديون إلى
  // حصص»، فتُخزَّن ككسر لا كرقم مئوي حتى يعرضها نوشن نسبةً صحيحة.
  if (e.stakeDiluted !== "" && e.stakeDiluted != null) {
    const p = Number(String(e.stakeDiluted).replace(/[^\d.]/g, ""));
    if (Number.isFinite(p)) props["حصة المتقدم بعد التحويل"] = { number: p > 1 ? p / 100 : p };
  }
  if (draft.submittedAt) props["تاريخ الإرسال للمركز"] = { date: { start: draft.submittedAt.slice(0, 10) } };
  return props;
}

// صفّ واحد لكل عميل: يُنشأ عند أول إرسال ويُحدَّث بعدها. إنشاء صفّ جديد مع كل
// حفظ كان يملأ القاعدة بنسخ من نفس الملف.
async function syncNotion(draft) {
  if (!NOTION_TOKEN || !PR_DB) return null;
  const props = notionProps(draft);
  if (draft.notionPageId) {
    await notion(`pages/${draft.notionPageId}`, "PATCH", { properties: props });
    return draft.notionPageId;
  }
  const page = await notion("pages", "POST", { parent: { database_id: PR_DB }, properties: props });
  return page.id || null;
}

// ---- الطلب --------------------------------------------------------------
export async function handlePrIntake(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const send = (code, obj) => { res.statusCode = code; return res.end(JSON.stringify(obj)); };

  if (req.method !== "POST") return send(405, { ok: false, error: "method_not_allowed" });
  if (!DB_ON) return send(503, { ok: false, error: "db_off", message: "قاعدة البيانات غير مهيأة." });

  const session = await getSession(req);
  if (!session || !session.user) return send(401, { ok: false, error: "unauthorized", message: "سجّل الدخول ببريدك أولاً." });
  const uid = session.user.id;

  let body;
  try { body = await readBody(req); }
  catch { return send(413, { ok: false, error: "payload_too_large", message: "الملف أكبر من المسموح." }); }
  const action = clip(body.action, 20);

  let draft = (await loadDraft(uid)) || emptyDraft(session);
  draft.email = (session.user.email || draft.email || "").toLowerCase();

  if (action === "me") {
    return send(200, { ok: true, draft, tabs: PR_TABS, email: draft.email });
  }

  if (action === "save") {
    mergeTabs(draft, body.tabs);
    draft.updatedAt = new Date().toISOString();
    try { await saveDraft(uid, draft); }
    catch (e) { return send(400, { ok: false, error: String(e.message || e) }); }
    // نوشن يُحدَّث فقط بعد أول إرسال: قبله الملف مسوّدة عند العميل وحده.
    if (draft.notionPageId) { try { await syncNotion(draft); } catch {} }
    return send(200, { ok: true, updatedAt: draft.updatedAt, completeness: completeness(draft) });
  }

  if (action === "upload") {
    const tab = TAB_SET.has(clip(body.tab, 20)) ? clip(body.tab, 20) : "applicant";
    const label = clip(body.label || body.name, 120);
    const base64 = String(body.base64 || "").replace(/^data:[^;]+;base64,/, "");
    if (!base64) return send(400, { ok: false, error: "no_file" });
    const buf = Buffer.from(base64, "base64");
    if (!buf.length) return send(400, { ok: false, error: "no_file" });
    if (buf.length > MAX_FILE_BYTES) return send(413, { ok: false, error: "too_large", message: "الحد 8 ميغابايت لكل مرفق." });

    const p = filePath(uid, tab, body.name || label || "file");
    try { await storagePut(p, buf, clip(body.type, 120) || "application/octet-stream"); }
    catch { return send(502, { ok: false, error: "storage_failed" }); }

    const entry = { path: p, tab, label, name: clip(body.name, 200), type: clip(body.type, 120), size: buf.length, at: new Date().toISOString() };
    draft.files = (draft.files || []).filter((f) => !(f.tab === tab && f.label === label));
    draft.files.push(entry);
    draft.updatedAt = entry.at;
    try { await saveDraft(uid, draft); } catch {}
    return send(200, { ok: true, file: { path: p, tab, label, name: entry.name, size: entry.size } });
  }

  if (action === "submit") {
    mergeTabs(draft, body.tabs);
    draft.submittedAt = new Date().toISOString();
    draft.updatedAt = draft.submittedAt;
    let pageId = null;
    try { pageId = await syncNotion(draft); }
    catch { return send(502, { ok: false, error: "notion_failed", message: "تعذّر تسجيل الملف. حاول مرة أخرى." }); }
    if (pageId) {
      draft.notionPageId = pageId;
      // المرفقات تُرفع لصفحة نوشن مرة واحدة عند الإرسال: رفعها مع كل حفظ
      // تلقائي يكرّرها ويستهلك حصة نوشن بلا داعٍ.
      const files = [];
      for (const f of (draft.files || []).slice(0, 25)) {
        try {
          const bytes = await storageGet(f.path);
          const id = await uploadToNotion(bytes.toString("base64"), f.name || `${f.label}.bin`, f.type || "application/octet-stream");
          if (id) files.push({ type: "file_upload", file_upload: { id }, name: clip(f.label || f.name, 100) });
        } catch {}
      }
      if (files.length) { try { await notion(`pages/${pageId}`, "PATCH", { properties: { "المرفقات": { files } } }); } catch {} }
    }
    try { await saveDraft(uid, draft); } catch {}
    return send(200, { ok: true, submittedAt: draft.submittedAt, completeness: completeness(draft), notion: !!pageId });
  }

  if (action === "link") {
    // رابط موقّع قصير العمر لمرفق واحد — للفريق داخل اللوحة لا للعميل.
    const p = clip(body.path, 300);
    if (!p.startsWith(`pr-intake/${uid}/`)) return send(403, { ok: false, error: "forbidden" });
    try { return send(200, { ok: true, url: await storageSign(p, 300) }); }
    catch { return send(502, { ok: false, error: "storage_failed" }); }
  }

  return send(400, { ok: false, error: "unknown_action" });
}
