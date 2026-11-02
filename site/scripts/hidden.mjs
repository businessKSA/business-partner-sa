// Business Partner — الإخفاء المركزي (قرار المالك 2026-10-06).
//
// مصدر الحقيقة ملفٌّ واحد: site/data/hidden.json
//   { "services": ["REV-START", "revos-launch", ...],   // أكواد خدمات أو باقات
//     "pages":    ["business-development"] }           // صفحات عامة بلا «/»
// إضافة كودٍ أو اسمٍ إليه ثم `npm run build` تكفي — لا تعديل في مكانٍ آخر.
// حذفه من الملف ثم البناء يُعيد كل شيء.
//
// ما يفعله (الصفحات العامة فقط):
//   • generate.mjs يُسقط الخدمات المخفية من `services` قبل أي استعمال، فتغيب
//     صفحاتها (/services/<slug>) وعدّادات التصنيفات و/services وsitemap وبحث
//     الرئيسية، ويُبنى catalog.json بلا الخدمات والباقات المخفية.
//   • الصفحات المخفية لا تُكتب (cleanHtml يمسح الشجرة كلها ثم تُكتب الباقي).
//   • nav.json وfooter.json يُقلَّمان من أي رابطٍ مخفي قبل الرسم.
//   • البطاقات المكتوبة يدوياً في المولّدات تُشرَط بـ`pageVisible()`/`isHiddenHref()`.
//   • `hide-scrub.mjs` شبكة أمانٍ أخيرة في آخر البناء: يحذف أي رابطٍ إلى
//     صفحةٍ مخفية نجا في أي صفحةٍ مبنيّة.
//   • vercel.json: يُولَّد سطر 302 لكل صفحةٍ مخفية ولكل خدمةٍ مخفية
//     (statusCode:302 محجوزٌ لهذا الملف — لا تكتب به يدوياً) إلى /catalog،
//     فلا يرى أحدٌ 404. اخترنا «لا تُنتَج الصفحة + تحويل» لا «تُنتَج وتحوّل»
//     لأن الصفحة المنتَجة تبقى تُفهرَس وتُخدَم لمن يملك الرابط إن عُطّل
//     التحويل. الـ302 مؤقت عمداً: الإخفاء قرارٌ قابل للرجوع.
//
// ثلاثة أصناف في hidden.json:
//   • services — أكواد خدمات/باقات (تسقط من الكتالوج وصفحاتها).
//   • pages    — صفحات عامة تُخفى: لا تُنشر، تُحذف روابطها، وتُحوَّل حيث يقول
//                `redirects` (الافتراضي /catalog بـ302).
//   • moved    — صفحات «أُوقفت واستُبدلت»: كالمخفية تماماً، لكن روابطها لا تُحذف
//                بل تُعاد كتابتها إلى البديل (مثل /account → /my) وتحويلها دائم.
//   • redirects — وجهة وحالة تحويل كل صفحة مخفية: { "privacy": { "to": "/", "status": 308 } }.
//                 308 = permanent عند Vercel (cache-control: max-age=0, must-revalidate:
//                 المتصفح يعيد التحقق فلا يعلق عند إعادة الصفحة).
// الصفحة المخفية/المنقولة تُولَّد أثناء البناء (سكربتات لاحقة تقرأها، كـ
// b10x-package-page الذي يشتق b10x من ai-agents) ثم يحذف `hide-scrub.mjs`
// ملفاتها في آخر السلسلة — فلا يخرج منها شيء إلى site/ ولا إلى النشر.
// ملف المصدر (الدالة في generate.mjs) باقٍ: حذف الاسم من hidden.json ثم
// `npm run build` يعيد الصفحة.
//
// ما لا يمسّه (عمداً):
//   • site/data/services.json — بيانات المصدر كما هي. الإخفاء يُطبَّق عند
//     القراءة في المولّد، لا بحذف الصفوف.
//   • /my وRevenue OS (/business-development-dashboard و/account) و/ops
//     وكل api/ — العملاء القائمون واشتراكاتهم لا تتأثر.
//   • الروابط القديمة /revenue-os و/bdaas: تبقى كما هي، تذهب إلى
//     /business-development فتُحوَّل بدورها إلى /catalog (301 ثم 302).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(__dirname, "..", "data");
export const HIDDEN_FILE = path.join(DATA, "hidden.json");

const LANGS = ["ar", "en", "es", "fr", "hi", "ja", "ko", "ru", "zh"];
const lc = (s) => String(s == null ? "" : s).trim().toLowerCase();

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}

// الإعداد المقروء الآن. `HIDDEN_FILE` متغيّر بيئة اختياري للاختبارات.
function load(file) {
  const raw = readJson(file || process.env.BP_HIDDEN_FILE || HIDDEN_FILE, {});
  const services = new Set((Array.isArray(raw.services) ? raw.services : []).map(lc).filter(Boolean));
  const pages = new Set((Array.isArray(raw.pages) ? raw.pages : []).map((p) => lc(p).replace(/^\/+|\/+$/g, "")).filter(Boolean));
  const norm = (p) => lc(p).replace(/^\/+|\/+$/g, "");
  const moved = new Map();
  for (const [k, v] of Object.entries(raw.moved && typeof raw.moved === "object" ? raw.moved : {})) {
    const to = "/" + String(v == null ? "" : v).trim().replace(/^\/+/, "");
    if (norm(k) && to !== "/") moved.set(norm(k), to);
  }
  const redirects = new Map();
  for (const [k, v] of Object.entries(raw.redirects && typeof raw.redirects === "object" ? raw.redirects : {})) {
    const to = "/" + String(v && v.to != null ? v.to : "").trim().replace(/^\/+/, "");
    const status = [301, 302, 307, 308].includes(Number(v && v.status)) ? Number(v.status) : 302;
    redirects.set(norm(k), { to, status });
  }
  // slug ← code للخدمات المخفية، من services.json المصدري (لا يُعدَّل).
  const list = readJson(path.join(DATA, "services.json"), []);
  const slugs = new Set();
  for (const s of Array.isArray(list) ? list : (list.services || [])) {
    if (s && services.has(lc(s.code))) slugs.add(lc(s.slug || s.code));
  }
  return { services, pages, slugs, moved, redirects };
}

const H = load();

export const hiddenServiceCodes = () => [...H.services];
export const hiddenPageNames = () => [...H.pages, ...H.moved.keys()];
export const hasHidden = () => H.services.size > 0 || H.pages.size > 0 || H.moved.size > 0;

export const isHiddenService = (code) => H.services.has(lc(code));
export const isHiddenPage = (name) => { const n = lc(name).replace(/^\/+|\/+$/g, ""); return H.pages.has(n) || H.moved.has(n); };
export const pageVisible = (name) => !isHiddenPage(name);

// يصفّي مصفوفة خدمات services.json.
export const visibleServices = (list) => list.filter((s) => !isHiddenService(s && s.code));
// يصفّي صفوف الكتالوج/الباقات بحقل code أو key.
export const visibleCatalogRows = (rows) => rows.filter((r) => !isHiddenService(r && (r.code || r.key)));

// المسار العام لرابطٍ ما: بلا أصل ولا لغة ولا استعلام ولا وسم ولا .html.
export function publicPath(href) {
  let h = String(href == null ? "" : href).trim();
  if (!h) return "";
  h = h.replace(/^https?:\/\/(?:www\.)?businesspartner\.sa/i, "");
  if (/^[a-z][a-z0-9+.-]*:/i.test(h) || h.startsWith("//")) return ""; // خارجي
  h = h.split("#")[0].split("?")[0].replace(/\.html$/i, "");
  const m = h.match(/^\/([a-z]{2})(\/.*)?$/i);
  if (m && LANGS.includes(m[1].toLowerCase())) h = m[2] || "/";
  h = h.replace(/\/+$/g, "") || "/";
  return h;
}

// صفحةٌ/خدمةٌ مخفية يجب حذف رابطها (لا إعادة كتابته).
function isDropHref(href) {
  const p = publicPath(href);
  if (!p || p === "/") return false;
  const parts = p.split("/").filter(Boolean);
  if (parts.length === 1) return H.pages.has(lc(parts[0]));
  if (parts[0] === "services" && parts.length === 2) return H.slugs.has(lc(parts[1]));
  return false;
}

// المخفي = ما تُحذف روابطه + المنقول (لا يُبنى ولا يدخل sitemap ولا بطاقة).
export function isHiddenHref(href) {
  if (isDropHref(href)) return true;
  const parts = publicPath(href).split("/").filter(Boolean);
  return parts.length === 1 && H.moved.has(lc(parts[0]));
}

// رابطٌ إلى صفحةٍ منقولة (/account) → رابط البديل (/my)، بلغته واستعلامه ووسمه.
// اللغات غير المبنيّة كاملةً (es/hi/…) تسقط إلى البديل الإنجليزي. يُرجع null إن لم
// يكن الرابط لصفحةٍ منقولة.
const FULL_LANGS = ["ar", "fr", "zh"];
const ORIGIN_RE = /^https?:\/\/(?:www\.)?businesspartner\.sa/i;
export function movedHref(href) {
  if (!H.moved.size) return null;
  const raw = String(href == null ? "" : href).trim();
  const parts = publicPath(raw).split("/").filter(Boolean);
  if (parts.length !== 1 || !H.moved.has(lc(parts[0]))) return null;
  const to = H.moved.get(lc(parts[0]));
  const origin = (raw.match(ORIGIN_RE) || [""])[0];
  const m = raw.slice(origin.length).match(/^\/([a-z]{2})(?=\/|$|\?|#)/i);
  const lang = m && FULL_LANGS.includes(m[1].toLowerCase()) ? "/" + m[1].toLowerCase() : "";
  const tail = raw.match(/[?#].*$/);
  return origin + lang + to + (tail ? tail[0] : "");
}

// يقلّم شجرة JSON للقوائم (nav.json/footer.json): يُسقط كل عنصرٍ له href
// مخفي مع ما تحته، ثم كل مجموعةٍ كانت ذات أبناء وأصبحت فارغة. الروابط
// المنقولة تُعاد كتابتها لا تُسقَط.
export function pruneLinks(node) {
  if (Array.isArray(node)) {
    return node
      .filter((x) => !(x && typeof x === "object" && typeof x.href === "string" && isDropHref(x.href)))
      .map(pruneLinks)
      .filter((x) => !x || typeof x !== "object" || !x.__empty);
  }
  if (node && typeof node === "object") {
    const out = {};
    let hadKids = false, hasKids = false;
    for (const [k, v] of Object.entries(node)) {
      if (Array.isArray(v) && ["items", "sub", "links", "columns", "groups"].includes(k)) {
        hadKids = hadKids || v.length > 0;
        out[k] = pruneLinks(v);
        hasKids = hasKids || out[k].length > 0;
      } else if (k === "href" && typeof v === "string") out[k] = movedHref(v) || v;
      else out[k] = pruneLinks(v);
    }
    if (hadKids && !hasKids && !out.href) Object.defineProperty(out, "__empty", { value: true, enumerable: false });
    return out;
  }
  return node;
}

// شبكة الأمان: يحذف أي <a> يشير إلى صفحةٍ أو خدمةٍ مخفية (ثم الأغلفة التي
// صارت فارغة <li></li>)، ويعيد كتابة href الصفحات المنقولة إلى بديلها.
// يُرجع {html, removed, rewritten}.
const A_RE = /<a\b[^>]*?\bhref\s*=\s*("([^"]*)"|'([^']*)')[^>]*>[\s\S]*?<\/a>/gi;
export function stripHiddenLinks(html) {
  if (!hasHidden()) return { html, removed: 0, rewritten: 0 };
  let removed = 0, rewritten = 0;
  let out = String(html).replace(A_RE, (m, q, d, s) => {
    const h = d != null ? d : s;
    if (isDropHref(h)) { removed++; return ""; }
    const mv = movedHref(h);
    if (mv) { rewritten++; return m.replace(q, q[0] + mv + q[0]); }
    return m;
  });
  if (removed) out = out.replace(/<li\b[^>]*>\s*<\/li>/gi, "");
  return { html: out, removed, rewritten };
}

// ---------------------------------------------------------------- vercel.json
// كل صفحةٍ مخفية: /<page> و/<lang>/<page> → وجهتها في `redirects` (الافتراضي
// /catalog بـ302). اللغات المبنيّة كاملةً (ar/fr/zh) تذهب إلى وجهتها بلغتها،
// والباقي إلى الوجهة الإنجليزية لأنه لا شجرة لها. الصفحات المنقولة (moved) تذهب
// إلى بديلها بـ308. كل خدمةٍ مخفية: /services/<slug> → /catalog بـ302.
// الاستعلام (?ref=…&view=…) يمرّ كما هو: Vercel يمرّر query الأصل إلى الوجهة.
const FULL = ["ar", "fr", "zh"];
const OTHER = ["es", "hi", "ja", "ko", "ru"];
const langDest = (to) => (to === "/" ? "/:lang" : `/:lang${to}`);

// [{ names, to, status, src }] مجمّعةً بالوجهة والحالة فيبقى عدد الأسطر ثابتاً
// تقريباً مهما كبرت القائمة.
function groups() {
  const byKey = new Map();
  const add = (name, to, status) => {
    const k = `${status} ${to}`;
    if (!byKey.has(k)) byKey.set(k, { names: [], to, status });
    byKey.get(k).names.push(name);
  };
  for (const n of H.pages) { const r = H.redirects.get(n); add(n, r ? r.to : "/catalog", r ? r.status : 302); }
  for (const [n, to] of H.moved) add(n, to, (H.redirects.get(n) || {}).status || 308);
  const out = [...byKey.values()].map((g) => { const names = g.names.sort(); return { ...g, names, src: `/(${names.join("|")})` }; });
  if (H.slugs.size) out.push({ names: [...H.slugs].sort(), to: "/catalog", status: 302, src: `/services/(${[...H.slugs].sort().join("|")})` });
  return out.sort((a, b) => a.src.localeCompare(b.src));
}

export function redirectRules({ fullLangs = FULL, otherLangs = OTHER } = {}) {
  const rules = [];
  for (const g of groups()) {
    rules.push({ source: g.src, destination: g.to, statusCode: g.status });
    if (fullLangs.length) rules.push({ source: `/:lang(${fullLangs.join("|")})${g.src}`, destination: langDest(g.to), statusCode: g.status });
    if (otherLangs.length) rules.push({ source: `/:lang(${otherLangs.join("|")})${g.src}`, destination: g.to, statusCode: g.status });
  }
  return rules;
}

// noindex لكل مصدرٍ مخفي: لو أُلغي التحويل يوماً أو خُدمت الصفحة من نسخةٍ
// قديمة فلن تُفهرَس. (التحويل نفسه يُخرجها من الفهرس مع الوقت.)
export function headerRules({ langs = [...FULL, ...OTHER] } = {}) {
  const headers = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
  const rules = [];
  for (const g of groups()) {
    rules.push({ source: g.src, headers });
    rules.push({ source: `/:lang(${langs.join("|")})${g.src}`, headers });
  }
  return rules;
}

const MANAGED_REDIRECT = /"statusCode"\s*:\s*30[0-9]/;
const MANAGED_HEADER = /"X-Robots-Tag"/;
const R_RE = /^\s*"redirects"\s*:\s*\[\s*$/;
const H_RE = /^\s*"headers"\s*:\s*\[\s*$/;
// يعيد كتابة الأسطر المُدارة (redirects بـ statusCode، وheaders بـ X-Robots-Tag) داخل
// vercel.json بلا لمس بقية الملف حرفاً. يُرجع true إن تغيّر الملف.
export function syncVercelRedirects(file, opts) {
  // على Vercel يُقرأ vercel.json قبل أمر البناء، فتعديله أثناء البناء بلا أثر؛ وقد
  // أسقط هذا الفحص نشرة 2026-10-10 لأن النسخة هناك لا تطابق الصيغة المحلية.
  // المزامنة خطوةٌ محلية يُلتزَم ناتجها، وفحص تطابقها في tests/hidden.test.mjs.
  if (process.env.VERCEL) return false;
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split("\n");
  const rStart = lines.findIndex((l) => R_RE.test(l));
  if (rStart < 0) throw new Error("vercel.json: لا توجد مصفوفة redirects بصيغتها المعتادة");
  const hStart = lines.findIndex((l) => H_RE.test(l));
  if (hStart < 0) throw new Error("vercel.json: لا توجد مصفوفة headers بصيغتها المعتادة");
  const isManaged = (i, l) => /"source"/.test(l) && ((i > rStart && i < hStart && MANAGED_REDIRECT.test(l)) || (i > hStart && MANAGED_HEADER.test(l)));
  const kept = lines.filter((l, i) => !isManaged(i, l));
  const rK = kept.findIndex((l) => R_RE.test(l));
  const hK = kept.findIndex((l) => H_RE.test(l));
  const rr = redirectRules(opts).map((r) => `    ${JSON.stringify(r)},`);
  const hr = headerRules().map((r) => `    ${JSON.stringify(r)},`);
  // أسطر مُدارة في أول كل مصفوفة: أول مطابقةٍ تربح.
  const out = [
    ...kept.slice(0, rK + 1), ...rr,
    ...kept.slice(rK + 1, hK + 1), ...hr,
    ...kept.slice(hK + 1),
  ].join("\n");
  JSON.parse(out); // لا يُكتب JSON مكسور
  if (out === text) return false;
  fs.writeFileSync(file, out);
  return true;
}

// وجهة صفحةٍ مخفية/منقولة (للاختبارات والتوثيق): { to, status } أو null.
export function redirectFor(name) {
  const n = lc(name).replace(/^\/+|\/+$/g, "");
  if (H.moved.has(n)) return { to: H.moved.get(n), status: (H.redirects.get(n) || {}).status || 308 };
  if (H.pages.has(n)) return H.redirects.get(n) || { to: "/catalog", status: 302 };
  return null;
}
