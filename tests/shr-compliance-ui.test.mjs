// SHR-HR: شاشات الامتثال. يشغّل سكربت صفحة /SHR-HR الفعلي (من بنّاء الصفحة) فوق api/shr.js الحقيقي
// عبر مُحاكي DOM صغير، فيمسك أخطاء التنفيذ في شاشات ES5 المحقونة بـtoString() التي لا يمسكها فحص الصياغة.
// بلا متصفح. Run: npm test
import vm from "node:vm";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shr-ui-"));
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
const page = () => textOf(app);

console.log("compliance officer");
await loginAs("compliance@shr.invalid");
let t = page();
ok(/لوحة الامتثال/.test(t) && /لا نضمن إلغاء المخالفة/.test(t), "lands on the compliance dashboard with the fixed disclaimer");
ok(!/العمال|الوظائف|المكاتب/.test(find(app, (n) => n.tag === "div" && n.className === "shr-tabs").map(textOf).join(" ")), "no operator tabs for the compliance officer");
ok(/مقيّدة/.test(t) && /اشتباه/.test(t) && /غير معروفة/.test(t) && /نظيفة/.test(t), "four restriction states shown");
ok(/تقدير/.test(t) && /تقديري/.test(t), "band estimate and deadline carry the «تقدير/تقديري» pill");
ok(/وهمي/.test(t), "demo names");
ok(/إعدادات الامتثال/.test(t) && /طلبات نقل/.test(t), "settings and transfers cards");
await goto("المخالفات"); t = page();
ok(/سجل المخالفات|تسجيل مخالفة/.test(t) && /A-33/.test(t) && /تقديري/.test(t) && /لا نضمن إلغاء المخالفة/.test(t), "violations screen: rows, estimates, disclaimer");
ok(/لم يُدخل/.test(t) && /يلزم تاريخ التبليغ/.test(t), "a violation with no notification date shows «needs notification date», no invented deadline");
ok(/مصدر|المصدر/.test(t) && /قرار وزاري|112377/.test(t), "every number shows its source");
ok(/مهمة بشرية/.test(t), "submission flagged as a human task");
ok(!/ملغاة|مرفوعة بنجاح/.test(t), "no forbidden statuses on screen");
await goto("قوائم التحقق"); t = page();
ok(/جاهزية المنشأة/.test(t) && /غير مؤكد من المصدر/.test(t) && /CH-1/.test(t), "checklists: the CH-1 item is labelled «غير مؤكد من المصدر»");
await goto("التنبيهات"); t = page();
ok(/موعد اعتراض تقديري/.test(t) && /تاريخ التبليغ غير مُدخل/.test(t) && /منشأة محجوبة/.test(t), "alerts: estimated deadlines, missing notification date, blocked establishment");
await goto("استيراد الملفات"); t = page();
ok(/مرفوع/.test(t) && /مُبصَّمة|بصمات/.test(t), "imports screen: seeded batch + fingerprints notice");
await goto("أسماء A33"); t = page();
ok(/اسم تجريبي 1 \(وهمي\)/.test(t) && /عامل فعلي/.test(t) && /غير مصنَّف/.test(t) && /م33/.test(t), "A33 screen: demo aliases, classes");
// drive an action: classify + approve through the UI
const sel = find(app, (n) => n.tag === "select" && n.children.some((o) => o._value === "actual_worker"))[0];
sel.children.forEach((o) => { o.selected = o._value === "not_a_worker"; });
const saveBtn = byText(app, "button", "حفظ")[0];
await click(saveBtn);
ok(/صُنّف الاسم/.test(page()), "classifying from the screen works");
// establishment detail
await goto("لوحة الامتثال");
await click(byText(app, "button", "التفاصيل")[0]); t = page();
ok(/اللقطات التاريخية/.test(t) && /لقطة جديدة/.test(t) && /الفحوص/.test(t), "establishment detail opens");
await click(byText(app, "button", "تشغيل الفحوص")[0]);
ok(/شُغّلت الفحوص|restriction_state/.test(page()), "run checks from the screen");

console.log("operator");
await loginAs("ops@shr.invalid");
const nav = find(app, (n) => n.tag === "div" && n.className === "shr-tabs").map(textOf).join(" ");
ok(/اللوحة/.test(nav) && /العمال/.test(nav) && /الامتثال/.test(nav) && /أسماء A33/.test(nav), "operator sees operator + compliance tabs");
ok(/التشغيل/.test(nav) && /التوظيف/.test(nav) && /مكاتب الاستقدام/.test(nav), "operator nav is grouped into sections");
ok(/التشغيل ‹ اللوحة|التشغيل\s*‹\s*العمال|الامتثال\s*‹/.test(page()) || /‹/.test(page()), "breadcrumb is shown");
await goto("المخالفات");
// create a violation from the screen
const selects = find(app, (n) => n.tag === "select");
const inputs = find(app, (n) => n.tag === "input");
inputs.find((i) => i.attrs.placeholder === "الجهة المصدِرة").value = "جهة تجريبية (وهمي)";
await click(byText(app, "button", "تسجيل")[0]);
ok(/سُجّلت المخالفة/.test(page()), "creating a violation from the screen works (a rule + tier are preselected from the reference)");
// settings are owner-only
await goto("لوحة الامتثال");
const cb = find(app, (n) => n.tag === "input" && n.attrs.type === "checkbox")[0];
cb.checked = true; for (const f of cb.listeners.change || []) await f({}); await tick();
ok(/تغيير الإعدادات لمالك المستأجر وحده/.test(page()), "an operator toggling a setting gets the owner-only message");

console.log("gate options");
jar.shr_session = undefined; delete jar.shr_session;
vm.runInContext(script, sandbox); await tick();
ok(find(app, (n) => n.tag === "option" && n._value === "compliance@shr.invalid").length === 1 && find(app, (n) => n.tag === "option" && n._value === "compliance@other.invalid").length === 1, "login gate lists the compliance users");

ok(errs.length === 0, "no unhandled errors in the page script" + (errs.length ? ": " + errs[0].slice(0, 300) : ""));
await tick();
fs.rmSync(dir, { recursive: true, force: true });
console.log(fail.length ? `\n${fail.length} FAILED` : "\nall passed");
process.exit(fail.length ? 1 : 0);
