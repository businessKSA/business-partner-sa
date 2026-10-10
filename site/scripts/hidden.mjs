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
  // slug ← code للخدمات المخفية، من services.json المصدري (لا يُعدَّل).
  const list = readJson(path.join(DATA, "services.json"), []);
  const slugs = new Set();
  for (const s of Array.isArray(list) ? list : (list.services || [])) {
    if (s && services.has(lc(s.code))) slugs.add(lc(s.slug || s.code));
  }
  return { services, pages, slugs };
}

const H = load();

export const hiddenServiceCodes = () => [...H.services];
export const hiddenPageNames = () => [...H.pages];
export const hasHidden = () => H.services.size > 0 || H.pages.size > 0;

export const isHiddenService = (code) => H.services.has(lc(code));
export const isHiddenPage = (name) => H.pages.has(lc(name).replace(/^\/+|\/+$/g, ""));
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

export function isHiddenHref(href) {
  const p = publicPath(href);
  if (!p || p === "/") return false;
  const parts = p.split("/").filter(Boolean);
  if (parts.length === 1) return H.pages.has(lc(parts[0]));
  if (parts[0] === "services" && parts.length === 2) return H.slugs.has(lc(parts[1]));
  return false;
}

// يقلّم شجرة JSON للقوائم (nav.json/footer.json): يُسقط كل عنصرٍ له href
// مخفي مع ما تحته، ثم كل مجموعةٍ كانت ذات أبناء وأصبحت فارغة.
export function pruneLinks(node) {
  if (Array.isArray(node)) {
    return node
      .filter((x) => !(x && typeof x === "object" && typeof x.href === "string" && isHiddenHref(x.href)))
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
      } else out[k] = pruneLinks(v);
    }
    if (hadKids && !hasKids && !out.href) Object.defineProperty(out, "__empty", { value: true, enumerable: false });
    return out;
  }
  return node;
}

// شبكة الأمان: يحذف أي <a> يشير إلى صفحةٍ أو خدمةٍ مخفية، ثم الأغلفة التي
// صارت فارغة (<li></li>). يُرجع {html, removed}.
const A_RE = /<a\b[^>]*?\bhref\s*=\s*("([^"]*)"|'([^']*)')[^>]*>[\s\S]*?<\/a>/gi;
export function stripHiddenLinks(html) {
  if (!hasHidden()) return { html, removed: 0 };
  let removed = 0;
  let out = String(html).replace(A_RE, (m, _q, d, s) => {
    if (isHiddenHref(d != null ? d : s)) { removed++; return ""; }
    return m;
  });
  if (removed) out = out.replace(/<li\b[^>]*>\s*<\/li>/gi, "");
  return { html: out, removed };
}

// ---------------------------------------------------------------- vercel.json
// كل صفحةٍ مخفية: /<page> و/<lang>/<page> → /catalog (اللغات المبنيّة كاملةً
// تذهب إلى كتالوجها، والباقي إلى /catalog الإنجليزي لأنه لا كتالوج لها).
// كل خدمةٍ مخفية: /services/<slug> بالطريقة نفسها.
export function redirectRules({ fullLangs = ["ar", "fr", "zh"], otherLangs = ["es", "hi", "ja", "ko", "ru"] } = {}) {
  // مجموعة بدائل واحدة لكل صنف (صفحات / خدمات) فيبقى عدد الأسطر ثابتاً مهما
  // كبرت القائمة: ثلاثة أسطر لكل صنف (إنجليزي، لغات مبنيّة كاملةً، لغات بلا كتالوج).
  const sources = [];
  if (H.pages.size) sources.push(`/(${[...H.pages].sort().join("|")})`);
  if (H.slugs.size) sources.push(`/services/(${[...H.slugs].sort().join("|")})`);
  const rules = [];
  for (const src of sources) {
    rules.push({ source: src, destination: "/catalog", statusCode: 302 });
    if (fullLangs.length) rules.push({ source: `/:lang(${fullLangs.join("|")})${src}`, destination: "/:lang/catalog", statusCode: 302 });
    if (otherLangs.length) rules.push({ source: `/:lang(${otherLangs.join("|")})${src}`, destination: "/catalog", statusCode: 302 });
  }
  return rules;
}

const MANAGED = /"statusCode"\s*:\s*302/;
// يعيد كتابة أسطر الـ302 المُدارة داخل مصفوفة redirects في vercel.json بلا
// لمس بقية الملف حرفاً. يُرجع true إن تغيّر الملف.
export function syncVercelRedirects(file, opts) {
  // على Vercel يُقرأ vercel.json قبل أمر البناء، فتعديله أثناء البناء بلا أثر؛ وقد
  // أسقط هذا الفحص نشرة 2026-10-10 لأن النسخة هناك لا تطابق الصيغة المحلية.
  // المزامنة خطوةٌ محلية يُلتزَم ناتجها، وفحص تطابقها في tests/hidden.test.mjs.
  if (process.env.VERCEL) return false;
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split("\n");
  const start = lines.findIndex((l) => /^\s*"redirects"\s*:\s*\[\s*$/.test(l));
  if (start < 0) throw new Error("vercel.json: لا توجد مصفوفة redirects بصيغتها المعتادة");
  const kept = [];
  for (let i = 0; i < lines.length; i++) if (!(i > start && MANAGED.test(lines[i]) && /"source"/.test(lines[i]))) kept.push(lines[i]);
  const rules = redirectRules(opts).map((r) => `    ${JSON.stringify(r)},`);
  // أسطر مُدارة في أول المصفوفة: أول مطابقةٍ تربح.
  const out = [...kept.slice(0, start + 1), ...rules, ...kept.slice(start + 1)].join("\n");
  JSON.parse(out); // لا يُكتب JSON مكسور
  if (out === text) return false;
  fs.writeFileSync(file, out);
  return true;
}
