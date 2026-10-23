// SHR-HR: شاشات بوابة العامل. يشغّل سكربت صفحة /SHR-HR الفعلي (من بنّاء الصفحة) فوق api/shr.js الحقيقي
// عبر مُحاكي DOM صغير، فيمسك أخطاء التنفيذ في شاشات ES5 المحقونة بـtoString() التي لا يمسكها فحص الصياغة.
// بلا متصفح. Run: npm test
import vm from "node:vm";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shr-worker-ui-"));
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


async function loginWorker(email, slug = "SHR") {
  sandbox.location.search = "?as=worker";
  await loginAs(email, slug);
  sandbox.location.search = "";
}
const tabs = () => find(app, (n) => n.tag === "div" && n.className === "shr-tabs").map(textOf).join(" ");

console.log("gate");
jar.shr_session = undefined; delete jar.shr_session;
sandbox.location.search = "?as=worker";
vm.runInContext(script, sandbox); await tick();
ok(/دخول عامل/.test(page()) && /بوابة العامل — دخول تجريبي/.test(page()), "?as=worker opens the worker gate");
ok(find(app, (n) => n.tag === "option" && /@worker\.invalid$/.test(n._value)).length === 3, "gate lists the three demo worker users");
ok(find(app, (n) => n.tag === "button" && textOf(n).trim() === "دخول عامل").length === 1 && find(app, (n) => n.tag === "div" && n.className === "modes")[0].children.length === 4, "the worker mode sits beside the other three modes");
sandbox.location.search = "";

console.log("worker A (client A: iqama expiring)");
await loginWorker("a-worker@worker.invalid");
let t = page();
ok(/منظور العامل/.test(t) && /عامل تجريبي ١/.test(t), "lands on 'بياناتي', perspective badge, the worker's name");
ok(/عميل تجريبي SHR أ/.test(t) && /فني تكييف/.test(t) && /الهند/.test(t) && /تاريخ البدء/.test(t), "profile: beneficiary client, profession, nationality, start date");
ok(/مستند قريب الانتهاء/.test(t) && /راجع صفحة «مستنداتي»/.test(t), "attention pill points to the documents page");
ok(/إقامة/.test(t) && !/\d{6,}/.test(t), "the id type shows, and no long number anywhere (no id, phone or IBAN number)");
ok(!/تقديري|مخالف|القيد|المنشأة|المكتب|امتثال|سحر الإمداد/.test(t + tabs()), "no compliance, violation, establishment, agency wording on the page or tabs");
ok(/بياناتي/.test(tabs()) && /عقدي/.test(tabs()) && /مستنداتي/.test(tabs()) && /راتبي/.test(tabs()) && /طلباتي/.test(tabs()) && !/المكاتب|المرشحون|الوظائف|العمال|عمالي|الفواتير/.test(tabs()), "worker tabs only: five of them, no operator or client tabs");
await goto("عقدي"); t = page();
ok(/عقد عمل/.test(t) && /ساري/.test(t) && /تاريخ البدء/.test(t) && /\d{4}-\d{2}-\d{2}/.test(t), "contract: type, active, start date");
await goto("مستنداتي"); t = page();
ok(/الإقامة/.test(t) && /التأمين الطبي/.test(t) && /عقد العمل/.test(t) && /قريبة الانتهاء/.test(t) && /سارية/.test(t) && /بلا تاريخ انتهاء/.test(t), "documents: iqama expiring, insurance valid, contract without an expiry");
ok(/20 يوماً/.test(t) && /ينتهي خلال 60 يوماً/.test(t), "days left and the alert window");
ok(/مستنداتي \(قائمة العامل/.test(t) && /☐ الإقامة سارية/.test(t), "the worker checklist is shown");
await goto("راتبي"); t = page();
ok(/لا كشف راتب للعرض/.test(t) && /يصدر كشف الراتب من فرق Business Partner بعد الاعتماد/.test(t), "salary: explicit empty state with the agreed sentence");
ok(!/\d+(\.\d+)?\s*(ر\.س|ريال|SAR)|سعر|هامش/.test(t), "no figure, price or margin on the salary screen");
await goto("طلباتي"); t = page();
ok(/طلب جديد/.test(t) && /طلب تجريبي: خطاب تعريف بالعمل/.test(t) && /استفسار عن موعد تجديد الإقامة/.test(t), "requests: the worker's own two seeded requests + the form");
const kindSel = find(app, (n) => n.tag === "select" && n.children.some((o) => o._value === "worker_update"))[0];
ok(kindSel && kindSel.children.map((o) => o._value).join() === "worker_document,worker_update,worker_inquiry", "the kind list has the three worker kinds");
const topicOpts = () => find(app, (n) => n.tag === "option" && /^(personal_data|contact|employment_letter|work_contract|pay_statement)$/.test(n._value)).map((o) => o._value).join();
ok(topicOpts() === "work_contract,employment_letter" || /employment_letter/.test(topicOpts()), "the topic list follows the kind (document kind)");
kindSel.children.forEach((o) => { o.selected = o._value === "worker_update"; });
for (const f of kindSel.listeners.change || []) await f({});
ok(/personal_data,contact/.test(topicOpts()) && !/employment_letter/.test(topicOpts()), "changing the kind rebuilds the topic list");
// submit from the screen
find(app, (n) => n.tag === "textarea")[0].value = "أريد تحديث بيانات التواصل (طلب من الشاشة)";
const topicSel = find(app, (n) => n.tag === "select" && n.children.some((o) => o._value === "contact"))[0];
topicSel.children.forEach((o) => { o.selected = o._value === "contact"; });
await click(byText(app, "button", "إرسال الطلب")[0]); t = page();
ok(/سُجّل الطلب/.test(t) && /طلب من الشاشة/.test(t) && /تحديث بيان/.test(t) && /بيانات التواصل/.test(t), "creating a request from the screen works and lists it with its kind and topic");
find(app, (n) => n.tag === "textarea")[0].value = "ab";
await click(byText(app, "button", "إرسال الطلب")[0]);
ok(/٣ أحرف على الأقل/.test(page()), "a short note shows the Arabic validation message");

console.log("worker B (client B: insurance expired)");
await loginWorker("b-worker@worker.invalid");
t = page();
ok(/عميل تجريبي SHR ب/.test(t) && !/عميل تجريبي SHR أ/.test(t) && /عامل تجريبي ٣/.test(t) && /مستند منتهٍ/.test(t), "B sees their own client and the expired flag");
await goto("مستنداتي"); t = page();
ok(/منتهية/.test(t) && /منذ 5 يوماً/.test(t), "B's expired insurance shows how long ago");
await goto("طلباتي");
ok(!/طلب تجريبي: خطاب تعريف بالعمل/.test(page()) && !/استفسار عن موعد تجديد/.test(page()) && /لا طلبات بعد/.test(page()), "B sees none of A's requests");

console.log("the other tenant's worker");
await loginWorker("x-worker@worker.invalid", "OTHER");
ok(/عامل وهمي آخر/.test(page()) && !/عامل تجريبي/.test(page()), "OTHER tenant's worker sees only their own record");

console.log("a worker no longer active is refused at the gate");
{
  const dbm = await import("../api/_shr.js");
  const tt = await dbm.tenantBySlug("SHR");
  const s = dbm.scoped(dbm.ctxFrom({ tenant_id: tt.id, role: "tenant_owner" }));
  const w = (await s.get("shr_workers?select=id,full_name")).find((x) => /١$/.test(x.full_name));
  await s.patch(`shr_workers?id=eq.${w.id}`, { status: "archived" });
  await loginWorker("a-worker@worker.invalid");
  const gateErr = find(app, (n) => n.tag === "p" && n.className === "err").map((n) => n._arC || "").join(" ");
  ok(/سجل العامل غير نشط/.test(gateErr) && /دخول عامل/.test(page()) && !jar.shr_session, "an archived worker stays on the gate with the Arabic reason, and no session cookie");
  await s.patch(`shr_workers?id=eq.${w.id}`, { status: "active" });
}

console.log("staff screens untouched");
await loginAs("ops@shr.invalid");
ok(/العمال/.test(tabs()) && !/عمالي|بياناتي/.test(tabs()), "operator still gets the operator tabs");
await goto("الطلبات");
ok(/طلب مستند \(من عامل\)|تحديث بيان \(من عامل\)|استفسار \(من عامل\)/.test(page()) && /عامل تجريبي ١/.test(page()), "the operator's requests screen shows worker requests with the kind label and the worker's name");
ok(/بيانات تجريبية/.test(captured.body), "the demo banner is in every page");
ok(!/سحر الإمداد/.test(captured.body + script.replace(/سحر الإمداد للموارد البشرية/g, "")), "no SHR logo or brand claim in the page");

ok(errs.length === 0, "no unhandled errors in the page script" + (errs.length ? ": " + errs[0].slice(0, 300) : ""));
await tick();
fs.rmSync(dir, { recursive: true, force: true });
console.log(fail.length ? `\n${fail.length} FAILED` : "\nall passed");
process.exit(fail.length ? 1 : 0);
