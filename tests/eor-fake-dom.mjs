// DOM مصغَّر لاختبار سكربت صفحة /eor (eorClient) في Node بلا متصفح: عناصر بخصائصها وأحداثها، ومؤقّتات يدوية، وfetch يوجَّه إلى handleEor الحقيقي.
// ليس ملف اختبار (لا ينتهي بـ.test.mjs). حدوده معلنة: لا تخطيط ولا CSS ولا تركيز حقيقي ولا لوحة مفاتيح حقيقية — هذا يمسك أخطاء المنطق
// والمراجع المفقودة والتدفّق (إكمال تلقائي ← شريحة ← سعر ← إرسال)، ولا يُغني عن فحص متصفح حقيقي.
import vm from "node:vm";

const ENT = { "&quot;": '"', "&amp;": "&", "&lt;": "<", "&gt;": ">", "&#39;": "'" };
const decode = (s) => String(s).replace(/&(quot|amp|lt|gt|#39);/g, (m) => ENT[m]);

export function makeDom(html, { server }) {
  const all = [];
  const byId = new Map();
  const timers = new Map();
  let tid = 0;
  const calls = [];                  // كل طلبات fetch: { url, body }
  class El {
    constructor(tag) {
      this.tagName = String(tag).toUpperCase(); this._attrs = {}; this.children = []; this.parentNode = null; this._l = {}; this._cls = [];
      this._text = ""; this._value = ""; this._checked = false; this.disabled = false; this.type = ""; this.name = ""; this.style = {};
      all.push(this);
    }
    get className() { return this._cls.join(" "); }
    set className(v) { this._cls = String(v).split(/\s+/).filter(Boolean); }
    get classList() {
      const s = this;
      return {
        add: (...c) => { c.forEach((x) => { if (!s._cls.includes(x)) s._cls.push(x); }); },
        remove: (...c) => { s._cls = s._cls.filter((x) => !c.includes(x)); },
        contains: (c) => s._cls.includes(c),
        toggle: (c, f) => { const has = s._cls.includes(c), on = f === undefined ? !has : !!f; if (on && !has) s._cls.push(c); if (!on && has) s._cls = s._cls.filter((x) => x !== c); return on; },
      };
    }
    get textContent() { return this.tagName === "#TEXT" ? this._text : this.children.map((c) => c.textContent).join(""); }
    set textContent(v) {
      this.children.forEach((c) => { c.parentNode = null; }); this.children = []; this._text = "";
      if (this.tagName === "#TEXT") { this._text = String(v); return; }
      if (String(v) !== "") { const t = new El("#text"); t._text = String(v); t.parentNode = this; this.children.push(t); }
    }
    get value() {
      if (this.tagName === "SELECT") {
        const opts = this.children.filter((c) => c.tagName === "OPTION");
        if (this._sv !== undefined && opts.some((o) => o._value === this._sv)) return this._sv;
        return opts.length ? opts[0]._value : "";
      }
      return this._value;
    }
    set value(v) { if (this.tagName === "SELECT") this._sv = String(v); else this._value = String(v); }
    get checked() { return this._checked; }
    set checked(v) {
      if (this.type === "radio" && v) all.filter((r) => r !== this && r.type === "radio" && r.name === this.name).forEach((r) => { r._checked = false; });
      this._checked = !!v;
    }
    appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; }
    removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parentNode = null; return c; }
    setAttribute(k, v) { this._attrs[k] = String(v); if (k === "id") { byId.set(String(v), this); } }
    getAttribute(k) { return k in this._attrs ? this._attrs[k] : null; }
    removeAttribute(k) { delete this._attrs[k]; }
    addEventListener(t, fn) { (this._l[t] = this._l[t] || []).push(fn); }
    fire(t, ev = {}) {
      const e = Object.assign({ type: t, target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } }, ev);
      (this._l[t] || []).slice().forEach((fn) => fn(e));
      return e;
    }
    focus() { doc.activeElement = this; }
    scrollIntoView() {}
  }
  const doc = {
    activeElement: null,
    getElementById: (id) => byId.get(id) || null,
    createElement: (t) => new El(t),
    createTextNode: (t) => { const e = new El("#text"); e._text = String(t); return e; },
  };
  // العناصر الساكنة من HTML الصفحة (نموذج الطلب وصندوق الإتمام): وسوم لها id أو name، بسماتها.
  const a = html.indexOf('<form class="sv1-eor-form"'), b = html.indexOf("</main>");
  const region = html.slice(a, b);
  for (const m of region.matchAll(/<(input|select|textarea|button|ul|li|div|span|label|details|summary|form|b|small|p|h3|h4)\b([^>]*)>/g)) {
    const attrs = {};
    for (const am of m[2].matchAll(/([a-zA-Z_:][\w:.-]*)(?:="([^"]*)")?/g)) attrs[am[1]] = am[2] === undefined ? "" : decode(am[2]);
    if (!attrs.id && !(attrs.name && m[1] === "input")) continue;
    const e = new El(m[1]);
    for (const [k, v] of Object.entries(attrs)) { e._attrs[k] = v; if (k === "id") byId.set(v, e); }
    e.type = attrs.type || ""; e.name = attrs.name || "";
    if (attrs.value !== undefined && m[1] === "input") e._value = attrs.value;
    if ("checked" in attrs) e._checked = true;
    if (attrs.class) e.className = attrs.class;
  }
  const settle = () => new Promise((r) => setImmediate(r));
  const sandbox = {
    document: doc, window: {}, console, JSON, Date, Math, Promise, Number, String, Array, Object, RegExp, parseInt, parseFloat, isFinite, encodeURIComponent,
    location: { reload() {} },
    setTimeout: (fn) => { const id = ++tid; timers.set(id, fn); return id; },
    clearTimeout: (id) => { timers.delete(id); },
    fetch: async (url, init = {}) => {
      let body = {};
      if (init.body) body = JSON.parse(init.body);
      else if (/[?&]action=search/.test(url)) body = { action: "search", q: decodeURIComponent((url.match(/[?&]q=([^&]*)/) || [])[1] || "") };
      calls.push({ url, body });
      const r = await server(body);
      return { ok: r.ok === true, status: r.ok ? 200 : r.status || 400, json: async () => JSON.parse(JSON.stringify(r)) };
    },
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  const flush = async () => {
    for (let i = 0; i < 4; i++) {
      for (const [id, fn] of [...timers]) { timers.delete(id); fn(); }
      for (let j = 0; j < 6; j++) await settle();
    }
  };
  const find = (root, pred, out = []) => { if (pred(root)) out.push(root); root.children.forEach((c) => find(c, pred, out)); return out; };
  return {
    El, doc, calls, flush, find,
    $: (id) => doc.getElementById(id),
    run(code) { vm.runInContext(code, ctx); },
    type(el, text) { el.value = text; el.fire("input"); },
    key(el, k) { return el.fire("keydown", { key: k }); },
    click(el) { el.fire("click"); },
    pick(el) { el.checked = true; el.fire("change"); },
    byClass: (root, c) => find(root, (e) => e._cls.includes(c)),
  };
}

// يستخرج سكربتَي الصفحة (EORCORE ثم eorClient) من HTML ويشغّلهما في DOM المصغَّر.
export function bootPage(html, opts) {
  const dom = makeDom(html, opts);
  const core = html.match(/<script>(window\.EORCORE=[\s\S]*?)<\/script>/);
  const s0 = html.indexOf("<script>(function eorClient");
  if (!core || s0 < 0) throw new Error("scripts not found");
  const client = html.slice(s0 + 8, html.indexOf("</script>", s0));
  dom.run(core[1]);
  dom.run(client);
  return dom;
}
