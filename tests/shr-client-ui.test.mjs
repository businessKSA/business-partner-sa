// SHR-HR: شاشات بوابة العميل. يشغّل سكربت صفحة /SHR-HR الفعلي (من بنّاء الصفحة) فوق api/shr.js الحقيقي
// عبر مُحاكي DOM صغير، فيمسك أخطاء التنفيذ في شاشات ES5 المحقونة بـtoString() التي لا يمسكها فحص الصياغة.
// بلا متصفح. Run: npm test
import vm from "node:vm";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shr-client-ui-"));
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = dir;
const { default: handler } = await import("../api/shr.js");
const { buildShrOps } = await import("../site/scripts/simple-v1-shr.mjs");

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
const click = async (el) => { for (const f of el.listeners.click || []) await f({}); await tick(); };
const tick = () => new Promise((r) => setTimeout(r, 120));

const app = new El("div");
const jar = {};
const sandbox = {
  document: { getElementById: () => app, createElement: (t) => new El(t), createTextNode: (t) => new TextNode(t) },
  location: { search: "" }, URLSearchParams, setTimeout, console, Promise, JSON, Date, Number, String, Object, Array, Math, isNaN, Error,
  FileReader: class { readAsText() {} },
  fetch: async (url, opts = {}) => {
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

async function loginAs(email, slug = "SHR") {
  jar.shr_session = undefined; delete jar.shr_session;
  vm.runInContext(script, sandbox);
  await tick();
  const sels = find(app, (n) => n.tag === "select");
  const emailSel = sels[1];
  const opt = emailSel.children.find((o) => o._value === email);
  emailSel.children.forEach((o) => { o.selected = false; }); opt.selected = true;
  const slugSel = sels[0]; slugSel.children.forEach((o) => { o.selected = o._value === slug; });
  await click(byText(app, "button", "دخول")[0]);
}
const goto = async (label) => { const b = find(app, (n) => n.tag === "button" && textOf(n).trim() === label)[0]; if (!b) throw new Error("no tab " + label); await click(b); };
const page = () => textOf(app);


async function loginClient(email, slug = "SHR") {
  sandbox.location.search = "?as=client";
  await loginAs(email, slug);
  sandbox.location.search = "";
}
const tabs = () => find(app, (n) => n.tag === "div" && n.className === "shr-tabs").map(textOf).join(" ");

console.log("gate");
jar.shr_session = undefined; delete jar.shr_session;
sandbox.location.search = "?as=client";
vm.runInContext(script, sandbox); await tick();
ok(/دخول عميل/.test(page()) && /بوابة العميل/.test(page()), "?as=client opens the client gate");
ok(find(app, (n) => n.tag === "option" && /@client\.invalid$/.test(n._value)).length === 4, "gate lists the four demo client users");
sandbox.location.search = "";

console.log("client admin (A)");
await loginClient("a-admin@client.invalid");
let t = page();
ok(/منظور العميل/.test(t) && /عميل تجريبي SHR أ/.test(t), "lands on the client home, perspective badge names the company");
ok(/عمال مُسندون إليكم/.test(t) && /عقود سارية/.test(t) && /طلبات مفتوحة/.test(t), "home KPIs");
ok(!/تقديري|مخالف|القيد|المنشأة|المكتب|امتثال/.test(t + tabs()), "no compliance, violation, establishment or agency wording on the home or tabs");
ok(/اللوحة/.test(tabs()) && /عمالي/.test(tabs()) && /عقودي/.test(tabs()) && /طلباتي/.test(tabs()) && /الفواتير/.test(tabs()) && !/المكاتب|المرشحون|الوظائف/.test(tabs()), "client tabs only; no operator tabs");
await goto("عمالي"); t = page();
ok(/عامل تجريبي ١/.test(t) && /عامل تجريبي ٢/.test(t) && !/عامل تجريبي ٣|عامل تجريبي ٤/.test(t), "workers: A's two, not B's");
ok(/مستند قريب الانتهاء/.test(t), "document attention pill");
await click(byText(app, "button", "التفاصيل")[0]); t = page();
ok(/الإقامة/.test(t) && /التأمين الطبي/.test(t) && /عقد العمل/.test(t) && /قريبة الانتهاء/.test(t) && /بلا تاريخ انتهاء/.test(t), "worker detail: documents and their states");
ok(/جاهزية مستندات العامل/.test(t) && /✔ الإقامة سارية/.test(t) && /☐ التأمين الطبي ساري/.test(t), "client checklist with ticks");
await goto("عقودي"); t = page();
ok(/v1/.test(t) && /ساري/.test(t) && !/v2/.test(t), "contracts: active v1 only, no draft v2");
await goto("الفواتير"); t = page();
ok(/لا فواتير للعرض/.test(t) && /تصدرها فرق Business Partner بعد الاعتماد/.test(t), "invoices: explicit empty state");
ok(!/\d+(\.\d+)?\s*(ر\.س|ريال|SAR)|سعر|هامش/.test(t), "no price or margin on the invoices screen");
await goto("طلباتي"); t = page();
ok(/طلب جديد/.test(t) && /طلب تجريبي: ٣ فنيين/.test(t) && !/طلب تجريبي: نقل/.test(t), "requests: A's own list + the new-request form");
// submit a new request from the screen
const noteBox = find(app, (n) => n.tag === "textarea")[0];
noteBox.value = "نحتاج سائقين (طلب من الشاشة)";
const kindSel = find(app, (n) => n.tag === "select" && n.children.some((o) => o._value === "new_hire"))[0];
kindSel.children.forEach((o) => { o.selected = o._value === "new_hire"; });
find(app, (n) => n.tag === "input" && n.attrs.placeholder === "العدد")[0].value = "2";
await click(byText(app, "button", "إرسال الطلب")[0]); t = page();
ok(/سُجّل الطلب/.test(t) && /نحتاج سائقين \(طلب من الشاشة\)/.test(t), "creating a request from the screen works and lists it");
// a rejected submit shows the Arabic reason
find(app, (n) => n.tag === "textarea")[0].value = "ab";
await click(byText(app, "button", "إرسال الطلب")[0]);
ok(/٣ أحرف على الأقل/.test(page()), "a short note shows the Arabic validation message");

console.log("client viewer (A)");
await loginClient("a-viewer@client.invalid");
ok(/قراءة فقط/.test(page()), "viewer perspective is marked read-only");
await goto("طلباتي"); t = page();
ok(!/إرسال الطلب/.test(t) && /للقراءة فقط/.test(t), "viewer has no new-request form");

console.log("client B and the other tenant");
await loginClient("b-admin@client.invalid");
await goto("عمالي"); t = page();
ok(/عامل تجريبي ٣/.test(t) && /عامل تجريبي ٤/.test(t) && !/عامل تجريبي ١/.test(t), "B sees its own two workers");
ok(/مستند منتهٍ/.test(t), "B's expired insurance is flagged");
await loginClient("x-admin@client.invalid", "OTHER");
await goto("عمالي"); t = page();
ok(/عامل وهمي آخر/.test(t) && !/عامل تجريبي/.test(t), "OTHER tenant's client sees only OTHER's workers");

console.log("staff screens untouched");
await loginAs("ops@shr.invalid");
ok(/العمال/.test(tabs()) && !/عمالي/.test(tabs()), "operator still gets the operator tabs");
ok(/بيانات تجريبية/.test(captured.body), "the demo banner is in every page");
ok(!/سحر الإمداد/.test(captured.body + script.replace(/سحر الإمداد للموارد البشرية/g, "")), "no SHR logo or brand claim in the client portal page");

ok(errs.length === 0, "no unhandled errors in the page script" + (errs.length ? ": " + errs[0].slice(0, 300) : ""));
await tick();
fs.rmSync(dir, { recursive: true, force: true });
console.log(fail.length ? `\n${fail.length} FAILED` : "\nall passed");
process.exit(fail.length ? 1 : 0);
