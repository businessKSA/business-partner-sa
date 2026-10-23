// SHR-HR: شاشة إعلانات الوظائف. يشغّل سكربت صفحة /SHR-HR الفعلي (من بنّاء الصفحة) فوق api/shr.js الحقيقي
// عبر مُحاكي DOM صغير، فيمسك أخطاء التنفيذ في شاشات ES5 المحقونة بـtoString() التي لا يمسكها فحص الصياغة.
// بلا متصفح. Run: npm test
import vm from "node:vm";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shr-posts-ui-"));
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
const textOf = (n) => (n instanceof TextNode ? n.text : n.children.map(textOf).join(" "));
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
// الحقول التي تُضبط بـtextContent (رسائل النموذج المحلية) لا يراها مُحاكي DOM في الأبناء: نقرؤها صراحة.
const local = () => { const o = []; walk(app, (n) => { if (n instanceof El && typeof n.textContent === "string") o.push(n.textContent); }); return o.join(" "); };
const page = () => textOf(app) + " " + local();
const input = (ph) => find(app, (n) => (n.tag === "input" || n.tag === "textarea") && n.attrs.placeholder === ph)[0];
const type = async (el, v) => { el.value = v; for (const f of el.listeners.input || []) await f({}); await tick(); };
const cardOf = (title) => find(app, (n) => n.className && /(^| )pcard( |$)/.test(n.className) && textOf(n).includes(title))[0];
const btnIn = (root, label) => find(root, (n) => n.tag === "button" && textOf(n).trim() === label)[0];

console.log("operator opens the job-posts page");
await loginAs("ops@shr.invalid");
const nav = find(app, (n) => n.tag === "div" && n.className === "shr-tabs").map(textOf).join(" ");
ok(/إعلانات الوظائف/.test(nav), "«إعلانات الوظائف» is in the التوظيف group");
await goto("إعلانات الوظائف");
let t = page();
ok(/النشر العام/.test(t) && /قرار المالك ولم يُفعَّل/.test(t) && /داخل صفحة SHR الخاصة فقط/.test(t), "the fixed note: public publication is the owner's decision, not enabled");
ok(/كيف يبدو الإعلان/.test(t) && /بيانات تجريبية/.test(t), "preview panel and the demo mark are on screen");
ok(/مسودة/.test(t) && /بانتظار الاعتماد/.test(t) && /معتمد/.test(t) && /منشور داخلياً/.test(t), "the four seeded states are listed");
ok(/محجوب: منشأة مقيّدة/.test(t) && /لا يُنشر ولا تُضاف له طلبات/.test(t), "the post on a restricted establishment is shown blocked");
ok(/صفحة وظائف BP العامة \(معطّلة\)/.test(t) && /منصات خارجية \(معطّلة\)/.test(t) && /صفحة SHR الخاصة \(مفعّلة\)/.test(t), "channels line: only the private page is enabled");
ok(!/whatsapp|واتساب|@/.test(t.replace(/@/g, "") ) && !/عميل تجريبي/.test(t), "no contact data and no client names on the page");

console.log("suggest, edit, preview, save");
await click(btnIn(app, "اقترح صياغة"));
const title = input("عنوان الإعلان"), desc = input("وصف قصير للوظيفة"), req = input("المتطلبات: سطر لكل شرط");
ok(/مطلوب/.test(title.value) && /عدد المطلوبين/.test(desc.value) && /محلي/.test(page()), "«اقترح صياغة» fills title and paragraphs from a local template");
ok(!/\d{4}|ريال/.test(title.value + desc.value + req.value), "the suggestion has no salary");
await type(title, "مطلوب فني تكييف — واجهة الاختبار");
const pv = find(app, (n) => n.className === "pv")[0];
ok(/مطلوب فني تكييف — واجهة الاختبار/.test(textOf(pv)) && /يظهر داخل صفحة SHR الخاصة فقط/.test(textOf(pv)), "the live preview follows the form");
ok(!/نطاق الراتب/.test(textOf(pv)), "no salary line unless a person types one");
await type(input("الحد الأدنى (اختياري)"), "3000"); await type(input("الحد الأعلى (اختياري)"), "4000");
ok(/نطاق الراتب: 3000 – 4000 ريال/.test(textOf(pv)), "a typed salary range appears in the preview");
// المنشأة المعلِنة: النظيفة.
const estSel = find(app, (n) => n.tag === "select" && n.children.some((o) => /منشأة تجريبية SHR ٢/.test(textOf(o))))[0];
estSel.children.forEach((o) => { o.selected = /منشأة تجريبية SHR ٢ — نظيفة/.test(textOf(o)); });
// الحرس يظهر السبب على الشاشة.
await type(desc, "نضمن لك الإقامة وشركة مرخصة");
await click(btnIn(app, "حفظ كمسودة"));
t = page();
ok(/نص الإعلان مرفوض/.test(t) && /الوصف/.test(t) && /ضمان أو وعد بنتيجة/.test(t) && /ادعاء ترخيص/.test(t), "a rejected text shows the field, the matched words and the reason");
await type(desc, "نبحث عن فني تكييف للعمل في الرياض.");
await click(btnIn(app, "حفظ كمسودة"));
t = page();
ok(/أُنشئت المسودة/.test(t), "saved as a draft");
const mine = cardOf("واجهة الاختبار");
ok(!!mine && /مسودة/.test(textOf(mine)) && /3000 – 4000/.test(textOf(mine)), "the new draft is listed with its human-entered salary range");

console.log("the cycle by buttons");
await click(btnIn(mine, "إرسال للاعتماد"));
let c2 = cardOf("واجهة الاختبار");
ok(/بانتظار الاعتماد/.test(textOf(c2)), "submitted for approval");
ok(btnIn(c2, "اعتماد").disabled === true, "the approve button is disabled for the writer");
await loginAs("owner@shr.invalid");
await goto("إعلانات الوظائف");
c2 = cardOf("واجهة الاختبار");
ok(btnIn(c2, "اعتماد").disabled !== true, "another staff user can approve");
await click(btnIn(c2, "اعتماد"));
c2 = cardOf("واجهة الاختبار");
ok(/معتمد/.test(textOf(c2)) && !!btnIn(c2, "نشر داخل SHR"), "approved: the internal-publish button appears");
await click(btnIn(c2, "نشر داخل SHR"));
c2 = cardOf("واجهة الاختبار");
ok(/منشور داخلياً/.test(textOf(c2)) && /نُشر داخل صفحة SHR الخاصة فقط/.test(page()), "published (private page only)");
ok(/سجل الحالات/.test(textOf(c2)) && /إنشاء: مسودة/.test(textOf(c2)), "the state history is on the card");
// المحجوب لا يُنشر.
const blocked = cardOf("منشأة مقيّدة");
await click(btnIn(blocked, "نشر داخل SHR"));
t = page();
ok(/المنشأة محجوبة/.test(t) && /مقيّدة/.test(t), "publishing the blocked post shows the blocked message");

console.log("applicants");
const pubCard = cardOf("مشروع تجريبي (إعلان تجريبي منشور داخلياً)") || cardOf("منشور داخلياً");
await click(btnIn(pubCard, "إضافة مقدّم طلب"));
const padd = find(app, (n) => n.className === "padd")[0];
const csel = find(padd, (n) => n.tag === "select")[0];
const pickBy = (re) => csel.children.forEach((o) => { o.selected = re.test(textOf(o)); });
pickBy(/بلا موافقة/); await click(btnIn(padd, "إضافة"));
ok(/لا موافقة سارية/.test(page()), "a candidate without consent is refused on screen");
const padd2 = find(app, (n) => n.className === "padd")[0];
const csel2 = find(padd2, (n) => n.tag === "select")[0];
csel2.children.forEach((o) => { o.selected = /حارس أمن/.test(textOf(o)); });
await click(btnIn(padd2, "إضافة"));
ok(/أُضيف طلب التقديم/.test(page()), "a candidate with consent is added (manual entry, no public page)");

console.log("filter and close");
const flt = find(app, (n) => n.tag === "select" && n.children.some((o) => o._value === "pending_approval" && textOf(o) === "بانتظار الاعتماد"))[0];
flt.children.forEach((o) => { o.selected = o._value === "pending_approval"; });
for (const f of flt.listeners.change || []) await f({}); await tick();
ok(find(app, (n) => /(^| )pcard( |$)/.test(n.className || "")).length === 1, "the status filter narrows the list");
await click(btnIn(find(app, (n) => /(^| )pcard( |$)/.test(n.className || ""))[0], "إغلاق"));
ok(/أُغلق الإعلان/.test(page()), "close works from the screen");

console.log("roles");
await loginAs("compliance@shr.invalid");
ok(!/إعلانات الوظائف/.test(find(app, (n) => n.tag === "div" && n.className === "shr-tabs").map(textOf).join(" ")), "the compliance officer has no job-posts tab");

ok(errs.length === 0, "no unhandled errors in the page script" + (errs.length ? ": " + errs[0].slice(0, 300) : ""));
await tick();
fs.rmSync(dir, { recursive: true, force: true });
console.log(fail.length ? `\n${fail.length} FAILED` : "\nall passed");
process.exit(fail.length ? 1 : 0);
