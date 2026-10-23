// SHR-HR: تبديل اللغة (ع / EN / FR / 中文). يشغّل سكربت /SHR-HR الفعلي فوق api/shr.js الحقيقي عبر مُحاكي DOM صغير:
//  1) كل شاشة في كل منظور (مشغّل · امتثال · عميل · مكتب · بوابات الدخول) تُفتح بالعربية ثم تُبدَّل اللغة في مكانها:
//     لا نداء شبكة جديد، ولا فقدان للصفحة الحالية، ويُمسح DOM بحثاً عن أي حرف عربي متبقٍّ (باستثناء بيانات البذرة الوهمية
//     ومحتوى المستخدم الخام في معاينة الإعلان).
//  2) الشاشات نفسها تُرسَم والواجهة بلغة غير العربية (لا ترجمة لاحقة)، ويُمسح DOM كذلك.
//  3) lang/dir على الجذر، وحفظ الاختيار.
// بلا متصفح. Run: npm test.   SHR_I18N_REPORT=1 يطبع المتبقي بدل أن يفشل (للمراجعة).
import vm from "node:vm";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shr-i18n-ui-"));
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = dir;
const { default: handler } = await import("../api/shr.js");
const { buildShrOps } = await import("../site/scripts/simple-v1-shr.mjs");
const { DICT } = await import("../site/scripts/simple-v1-shr-i18n.mjs");

let captured;
buildShrOps({ header: () => "", shell: (o) => { captured = o; return ""; } });
const script = captured.script.replace(/^<script>/, "").replace(/<\/script>$/, "");

class TextNode { constructor(t) { this.text = String(t); } }
class El {
  constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.listeners = {}; this.style = {}; this.className = ""; this._value = ""; this.checked = false; this.selected = false; this.disabled = false; this.files = null; }
  appendChild(c) { this.children.push(c); return c; }
  setAttribute(k, v) { this.attrs[k] = v; if (k === "value") this._value = v; }
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
  set innerHTML(v) { this.children = []; }
  get innerHTML() { return ""; }
  set value(v) { this._value = v; }
  get value() {
    if (this.tag === "select") { const o = this.children.find((c) => c.selected) || this.children[0]; return o ? o._value : ""; }
    return this._value;
  }
}
// نصوص متجاورة داخل عنصر واحد تُلصق كما في textContent الحقيقي (الشاشات تبني السطر من قطع تُترجَم كل على حدة)؛
// وتُفصل العناصر بمسافة كما كان.
const textOf = (n) => (n instanceof TextNode ? n.text : n.children.reduce((acc, c, i) => acc + (i && !(c instanceof TextNode && n.children[i - 1] instanceof TextNode) ? " " : "") + textOf(c), ""));
const walk = (n, f) => { f(n); if (n.children) n.children.forEach((c) => walk(c, f)); };
const find = (root, pred) => { const out = []; walk(root, (n) => { if (n instanceof El && pred(n)) out.push(n); }); return out; };
const byText = (root, tag, t) => find(root, (n) => n.tag === tag && textOf(n).trim() === t);
const tick = () => new Promise((r) => setTimeout(r, 120));
const click = async (el) => { for (const f of el.listeners.click || []) await f({}); await tick(); };

const app = new El("div");
const root = new El("html");
const jar = {};
let fetches = 0;
const sandbox = {
  document: { getElementById: () => app, createElement: (t) => new El(t), createTextNode: (t) => new TextNode(t), documentElement: root },
  location: { search: "" }, URLSearchParams, setTimeout, console, Promise, JSON, Date, Number, String, Object, Array, Math, isNaN, Error,
  FileReader: class { readAsText() {} },
  fetch: async (url, opts = {}) => {
    fetches++;
    const u = new URL(url, "http://x");
    const method = (opts.method || "GET").toUpperCase();
    const req = { method, query: method === "GET" ? Object.fromEntries(u.searchParams) : {}, body: method === "POST" ? JSON.parse(opts.body) : undefined, cookies: { ...jar } };
    let status = 200, body = null;
    const res = { setHeader: (k, v) => { if (k.toLowerCase() === "set-cookie") { const m = /shr_session=([^;]*)/.exec(v); if (m) { if (m[1]) jar.shr_session = m[1]; else delete jar.shr_session; } } }, status: (c) => { status = c; return res; }, json: (o) => { body = o; return res; } };
    await handler(req, res);
    return { json: async () => body, status };
  },
};
sandbox.window = sandbox;
vm.createContext(sandbox);

const fail = [];
const ok = (c, m) => { console.log((c ? "  ok   " : "  FAIL ") + m); if (!c) fail.push(m); };
const errs = [];
process.on("unhandledRejection", (e) => { errs.push(String(e && e.stack || e)); });

// ------------------------------------------------------------------ بيانات البذرة المسموح بقاؤها عربية --
const ARABIC = /[\u0620-\u064A\u0660-\u0669\u066E-\u06FF]/;   // حروف وأرقام عربية؛ علامات الترقيم (، ؛ ؟) لا تُعدّ نصاً متبقياً
async function seedStrings() {
  await tick(); await tick();
  const db = JSON.parse(fs.readFileSync(path.join(dir, "db.json"), "utf8"));
  const out = new Set();
  const take = (v) => { if (typeof v === "string") { if (ARABIC.test(v)) out.add(v); } else if (Array.isArray(v)) v.forEach(take); else if (v && typeof v === "object") Object.values(v).forEach(take); };
  // نصوص المرجع وقوائم التحقق وتسمية المستأجر تُترجَم (ليست بيانات بذرة): تُستثنى من الإعفاء.
  const SKIP = { shr_checklist_templates: 1, shr_checklist_items: 1, shr_tenants: 1 };
  const SKIPCOL = { shr_violations: ["kind_ar", "severity", "fine_source", "objection_basis"], shr_establishment_compliance: ["computed_basis"] };
  for (const [t, rows] of Object.entries(db)) {
    if (!t.startsWith("shr_") || !Array.isArray(rows) || SKIP[t]) continue;
    for (const r of rows) for (const [k, v] of Object.entries(r)) { if ((SKIPCOL[t] || []).includes(k)) continue; take(v); }
  }
  return [...out].sort((a, b) => b.length - a.length);
}
let SEED = [];

// ما يظهر للمستخدم في الشجرة: نصوص h() (الموسومة _t) + خصائص الترجمة + العناصر التي كُتب نصّها بـput.
// النص الخام (data-raw: معاينة الإعلان بلغة كاتبه) غير موسوم فلا يُفحص.
const TRA = ["placeholder", "title", "aria-label", "data-label"];
function visible(n, acc = []) {
  if (n instanceof TextNode) { if (n._t) acc.push(n.text); return acc; }
  for (const a of TRA) if (n.attrs && typeof n.attrs[a] === "string") acc.push(n.attrs[a]);
  if (n._arC !== undefined) { acc.push(String(n.textContent || "")); return acc; }
  (n.children || []).forEach((c) => visible(c, acc));
  return acc;
}
const leftovers = [];
function scan(lang, where) {
  for (let s of visible(app)) {
    for (const seed of SEED) if (s.includes(seed)) s = s.split(seed).join("");
    if (ARABIC.test(s)) leftovers.push(`${lang} | ${where} | ${s.trim().slice(0, 160)}`);
  }
}
const I = () => sandbox.window.SHR_I18N;
const h1 = () => find(app, (n) => n.tag === "h1").map(textOf).join(" ").trim();
const navLabels = () => find(app, (n) => n.tag === "button" && n.className.startsWith("shr-nav") && !n.className.includes("toggle")).map((b) => textOf(b).trim());

async function boot(mode) {
  jar.shr_session = undefined; delete jar.shr_session;
  I() && I().setLang("ar");
  sandbox.location.search = mode ? "?as=" + mode : "";
  vm.runInContext(script, sandbox);
  await tick();
}
async function login(email, mode, slug = "SHR") {
  await boot(mode);
  const sels = find(app, (n) => n.tag === "select");
  sels[1].children.forEach((o) => { o.selected = o._value === email; });
  sels[0].children.forEach((o) => { o.selected = o._value === slug; });
  await click(byText(app, "button", "دخول")[0]);
  sandbox.location.search = "";
}
const goto = async (label) => { const b = find(app, (n) => n.tag === "button" && n.className.startsWith("shr-nav") && textOf(n).trim() === label)[0]; if (!b) throw new Error("no tab " + label); await click(b); };
const gotoIdx = async (i) => { const b = find(app, (n) => n.tag === "button" && n.className.startsWith("shr-nav") && !n.className.includes("toggle"))[i]; await click(b); };

// يمسح الشاشة الحالية بكل اللغات في مكانها، ويتحقق أن التبديل لم يجلب شيئاً ولم يُغيّر الصفحة.
const LANGS = ["en", "fr", "zh"];
const titles = {};
async function sweep(where) {
  const f0 = fetches, arH1 = h1(), arRows = find(app, (n) => n.tag === "tr").length;
  for (const L of LANGS) {
    I().setLang(L);
    scan(L, where);
    // العنوان بيانات بذرة (اسم عامل مثلاً) فلا يُشترط تغيّره.
    const strip = (x) => SEED.reduce((acc, sd) => (acc.includes(sd) ? acc.split(sd).join("") : acc), x);
    if (arH1 && ARABIC.test(strip(arH1)) && !(h1() !== arH1 && !ARABIC.test(strip(h1())))) leftovers.push(`${L} | ${where} | h1 not translated: ${h1()}`);
    if (find(app, (n) => n.tag === "tr").length !== arRows) leftovers.push(`${L} | ${where} | row count changed after switching`);
    titles[L + "|" + where] = h1();
  }
  I().setLang("ar");
  if (fetches !== f0) leftovers.push(`ar | ${where} | switching language fetched data (${fetches - f0} calls)`);
  if (h1() !== arH1) leftovers.push(`ar | ${where} | switching back changed the page title`);
}

console.log("dictionary");
ok(Object.keys(DICT).length > 700, "the dictionary is loaded (" + Object.keys(DICT).length + " entries)");

console.log("gates");
for (const mode of ["", "agency", "client"]) {
  await boot(mode);
  await sweep("gate:" + (mode || "staff"));
}
ok(true, "the three sign-in screens swept");

console.log("operator");
await login("ops@shr.invalid"); SEED = await seedStrings();
ok(I() && I().lang() === "ar", "Arabic is the default language");
const opsTabs = navLabels();
for (const label of opsTabs) { await goto(label); await sweep("ops:" + label); }
// صفحات فرعية: ملف المرشح وتفاصيل المنشأة وما يراه صاحب العمل ونتائج المطابقة
await goto("المرشحون");
{ const link = find(app, (n) => n.tag === "a")[0]; if (link) { await click(link); await sweep("ops:candidate"); } }
await goto("الوظائف");
{ const m = byText(app, "button", "طابق")[0]; if (m) { await click(m); await sweep("ops:match-results"); } }
await goto("لوحة الامتثال");
{ const d = byText(app, "button", "التفاصيل")[0]; if (d) { await click(d); await sweep("ops:establishment"); } }
await goto("أوامر الاستقدام");
{ const d = byText(app, "button", "ما يراه صاحب العمل")[0]; if (d) { await click(d); await sweep("ops:order-view"); } }
await goto("استيراد الملفات");
{ const d = byText(app, "button", "الصفوف")[0]; if (d) { await click(d); await sweep("ops:import-rows"); } }
await goto("إعلانات الوظائف");
{ const d = byText(app, "button", "إضافة مقدّم طلب")[0]; if (d) { await click(d); await sweep("ops:post-add-applicant"); } }
{ const d = byText(app, "button", "تعديل")[0]; if (d) { await click(d); await sweep("ops:post-edit"); } }

console.log("compliance officer");
await login("compliance@shr.invalid");
for (const label of navLabels()) { await goto(label); await sweep("cmp:" + label); }

console.log("client");
await login("a-admin@client.invalid", "client");
for (const label of navLabels()) { await goto(label); await sweep("client:" + label); }
await goto("عمالي");
{ const d = byText(app, "button", "التفاصيل")[0]; if (d) { await click(d); await sweep("client:worker"); } }
await login("a-viewer@client.invalid", "client");
await goto("طلباتي"); await sweep("client:viewer-requests");

console.log("agency");
await login("agency-a@shr.invalid", "agency");
for (const label of navLabels()) { await goto(label); await sweep("agency:" + label); }

// ---- الرسم بلغة غير العربية من البداية (لا ترجمة لاحقة): كل تبويب بالترتيب ----------------------------------------
console.log("rendered in each language");
for (const L of LANGS) {
  await login("ops@shr.invalid"); I().setLang(L);
  const n = navLabels().length;
  for (let i = 0; i < n; i++) { await gotoIdx(i); scan(L, "fresh-ops#" + i); }
  await login("compliance@shr.invalid"); I().setLang(L);
  for (let i = 0; i < navLabels().length; i++) { await gotoIdx(i); scan(L, "fresh-cmp#" + i); }
  await login("a-admin@client.invalid", "client"); I().setLang(L);
  for (let i = 0; i < navLabels().length; i++) { await gotoIdx(i); scan(L, "fresh-client#" + i); }
  await login("agency-a@shr.invalid", "agency"); I().setLang(L);
  for (let i = 0; i < navLabels().length; i++) { await gotoIdx(i); scan(L, "fresh-agency#" + i); }
}
I().setLang("ar");

// ---- lang/dir ---------------------------------------------------------------------------------------------
console.log("direction and language attributes");
const expect = { ar: "rtl", en: "ltr", fr: "ltr", zh: "ltr" };
for (const [L, d] of Object.entries(expect)) { I().setLang(L); ok(root.attrs.lang === L && root.attrs.dir === d, `${L}: lang="${root.attrs.lang}" dir="${root.attrs.dir}"`); }
I().setLang("ar");
ok(!I().setLang("de") && root.attrs.lang === "ar", "an unknown language is ignored");

// ---- شاشة واحدة بالتفصيل: النصوص المتوقعة ---------------------------------------------------------------------
console.log("sample translations");
await login("ops@shr.invalid");
await goto("العمال");
I().setLang("en"); ok(h1() === "Workers" && find(app, (n) => n.tag === "th").map(textOf).join("|").includes("Profession"), "workers table in English");
I().setLang("fr"); ok(h1() === "Travailleurs" && /Profession/.test(find(app, (n) => n.tag === "th").map(textOf).join("|")), "workers table in French");
I().setLang("zh"); ok(h1() === "工人" && /职业/.test(find(app, (n) => n.tag === "th").map(textOf).join("|")), "workers table in Chinese");
ok(find(app, (n) => n.tag === "input" && /虚构/.test(n.attrs.placeholder || "")).length >= 1, "placeholders are translated too");
I().setLang("ar");
await goto("المخالفات");
I().setLang("en");
ok(/We do not guarantee that a violation will be cancelled/.test(textOf(app)), "the no-guarantee sentence is translated precisely (en)");
I().setLang("fr"); ok(/Nous ne garantissons pas l'annulation d'une infraction/.test(textOf(app)), "the no-guarantee sentence is translated precisely (fr)");
I().setLang("zh"); ok(/我们不保证违规记录能够被撤销/.test(textOf(app)), "the no-guarantee sentence is translated precisely (zh)");
I().setLang("ar");

ok(errs.length === 0, "no unhandled errors in the page script" + (errs.length ? ": " + errs[0].slice(0, 300) : ""));

if (process.env.SHR_I18N_REPORT) {
  const uniq = [...new Set(leftovers)];
  console.log("\nLEFTOVERS (" + uniq.length + ")");
  for (const l of uniq) console.log(l);
} else {
  const uniq = [...new Set(leftovers)];
  ok(uniq.length === 0, "no Arabic text left in the en/fr/zh interfaces, language switching is in place (no refetch, page kept)" + (uniq.length ? ":\n    " + uniq.slice(0, 40).join("\n    ") + (uniq.length > 40 ? `\n    … ${uniq.length - 40} more` : "") : ""));
}
await tick();
fs.rmSync(dir, { recursive: true, force: true });
console.log(fail.length ? `\n${fail.length} FAILED` : "\nall passed");
process.exit(fail.length ? 1 : 0);
