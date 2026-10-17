// سلوك سكربت صفحة /vendor العميل (الشريحة ٢) على DOM مصغَّر في الذاكرة — بلا متصفح ولا شبكة.
// الصفحة تُبنى بالباني الحقيقي، ويُستخرج منها السكربت العميل كما يصل المتصفح، ثم يُشغَّل مقابل fetch وهمي.
//
// ما يُثبته:
//   ١) مورّد مؤسسي بانتظار الاعتماد: لوحة «بانتظار الاعتماد» بلا تبويبات ولا طلب، ولا نداء لـvendor-demand.
//   ٢) مؤسسي معتمد: ثلاثة تبويبات، وزرّ «قدّم عرضاً» على كل بند بدل «رشّح»، ونموذج يتحقق قبل الإرسال ويرسل الحمولة الصحيحة.
//   ٣) مكتب/مستقل: تبويبان وزرّ «رشّح» كما هو، ولا نداء للعروض إطلاقاً.
//   ٤) الأربع لغات: نصوص الأزرار والحالات من القاموس لا من مكان آخر.
import test from "node:test";
import assert from "node:assert/strict";
import { simpleV1 } from "../site/scripts/simple-v1.mjs";
import { buildSimpleVendor, VENDOR_TEXT } from "../site/scripts/simple-v1-vendor.mjs";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pathInLang = (p, l) => (l === "en" ? p : "/" + l + p);
const LI = { ar: 0, en: 1, fr: 2, zh: 3 };
function render(l) {
  const head = (title) => `<!doctype html><html lang="${l}"><head><meta charset="utf-8"><title>${esc(title)}</title></head>`;
  const SV1 = simpleV1({ lang: () => l, esc, site: {}, head, pathInLang, assetV: (x) => x, knowledge: null });
  return buildSimpleVendor(SV1, { lang: () => l, esc });
}

/* ───────────── DOM مصغَّر ───────────── */
class N {
  constructor(tag, id = "", cls = "") { this.tag = tag; this.id = id; this.children = []; this._text = ""; this.attrs = {}; this.cls = new Set(String(cls).split(/\s+/).filter(Boolean)); this.handlers = {}; this.value = ""; this.disabled = false; this.files = null; }
  get className() { return [...this.cls].join(" "); }
  set className(v) { this.cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get classList() { const s = this; return { add: (c) => s.cls.add(c), remove: (c) => s.cls.delete(c), contains: (c) => s.cls.has(c) }; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(t, f) { (this.handlers[t] = this.handlers[t] || []).push(f); }
  appendChild(c) { this.children.push(c); return c; }
  set textContent(v) { this._text = String(v); this.children = []; }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(""); }
  focus() {}
  reset() {}
  fire(t) { for (const f of this.handlers[t] || []) f({ preventDefault() {} }); }
  all(pred, out = []) { for (const c of this.children) { if (pred(c)) out.push(c); c.all(pred, out); } return out; }
  hidden() { return this.cls.has("sv1-hide"); }
}
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0)); };

// html → { dom, calls, mount() }.  respond(type, body) → { s, o } أو undefined (⇒ 500).
function boot(lang, respond, session = { email: "v@x.example", code: "BP-AG-TESTCODE01", name: "Vendor Co" }) {
  const html = render(lang);
  const m = html.match(/<script>\((function vendorClient[\s\S]*?)\)\((\{[\s\S]*?\})\);<\/script>/);
  assert.ok(m, "السكربت العميل");
  const nodes = new Map();
  for (const t of html.matchAll(/<(\w+)([^>]*?)\sid="([^"]+)"([^>]*)>/g)) {
    const cls = ((t[2] + " " + t[4]).match(/class="([^"]*)"/) || [])[1] || "";
    nodes.set(t[3], new N(t[1], t[3], cls));
  }
  const document = { getElementById: (id) => nodes.get(id) || null, createElement: (tag) => new N(tag) };
  const calls = [];
  const fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    const r = respond(body.type, body) || { s: 500, o: {} };
    return { status: r.s, json: async () => r.o };
  };
  const store = new Map(session ? [["bp_vendor", JSON.stringify(session)]] : []);
  const sessionStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  const run = new Function("document", "fetch", "sessionStorage", `return (${m[1]})`)(document, fetch, sessionStorage);
  run(JSON.parse(m[2]));
  return { $: (id) => nodes.get(id), calls, cfg: JSON.parse(m[2]), store, types: () => calls.map((c) => c.type) };
}

const ITEMS = [
  { ref: "EOR-TEST-1", itemId: "EOR-TEST-1-1", occupationId: "hosp.waiter", nameAr: "نادل", nameEn: "Waiter", count: 5, nationalities: [], nationalityNames: ["India"], startDate: "2026-11-01", durationMonths: 12, sector: "hospitality", sectorName: "Hospitality", region: "السعودية" },
  { ref: "EOR-TEST-1", itemId: "EOR-TEST-1-2", occupationId: "hosp.chef-de-partie", nameAr: "طباخ قسم", nameEn: "Chef de partie", count: 2, nationalities: [], nationalityNames: [], startDate: "2026-11-01", durationMonths: 12, sector: "hospitality", sectorName: "Hospitality", region: "السعودية" },
];
const OFFER = { id: "a".repeat(32), ref: "EOR-TEST-1", itemId: "EOR-TEST-1-1", occupationId: "hosp.waiter", nameAr: "نادل", nameEn: "Waiter", count: 5, price: 2450.5, available: 12, prepDays: 21, note: "ready", status: "submitted", submitted: "2026-10-08T10:00:00.000Z", updated: "2026-10-08T10:00:00.000Z" };
const base = (kind, active, extra = {}) => (type, body) => {
  if (extra[type]) return extra[type](body);
  if (type === "vendor-me") return { s: 200, o: { ok: true, name: "Vendor Co", kind, active } };
  if (type === "vendor-demand") return { s: 200, o: { ok: true, items: ITEMS } };
  if (type === "vendor-my-offers") return { s: 200, o: { ok: true, offers: [], more: false } };
  if (type === "vendor-candidates") return { s: 200, o: { ok: true, candidates: [] } };
  return undefined;
};
const buttons = (root) => root.all((n) => n.tag === "button");
const cards = (ui) => ui.$("vDemand").children;

/* ═════════════ ١) بانتظار الاعتماد ═════════════ */
test("مؤسسي بانتظار الاعتماد: لوحة الانتظار بلا تبويبات ولا طلبات ولا نداء للطلبات", async () => {
  const ui = boot("ar", base("corporate", false));
  await flush();
  assert.deepEqual(ui.types(), ["vendor-me"]);
  assert.equal(ui.$("vPend").hidden(), false);
  assert.equal(ui.$("vPendHead").hidden(), false);
  assert.equal(ui.$("vTabs").hidden(), true);
  for (const pane of ["vPaneDemand", "vPaneCands", "vPaneOffers"]) assert.equal(ui.$(pane).hidden(), true, pane);
  assert.equal(cards(ui).length, 0);
  // «تحقّق من الحالة» يعيد السؤال؛ وحين يُعتمد تفتح اللوحة.
  let active = false;
  const ui2 = boot("ar", (t, b) => (t === "vendor-me" ? { s: 200, o: { ok: true, name: "V", kind: "corporate", active } } : base("corporate", true)(t, b)));
  await flush();
  assert.equal(ui2.$("vPend").hidden(), false);
  active = true;
  ui2.$("vPendGo").fire("click"); await flush();
  assert.equal(ui2.$("vPend").hidden(), true);
  assert.equal(ui2.$("vTabs").hidden(), false);
  assert.equal(ui2.$("vTabOffers").hidden(), false);
  assert.equal(cards(ui2).length, 2);
});

test("تعذّر vendor-me: رسالة اتصال بلا ادّعاء أنه بانتظار الاعتماد", async () => {
  const ui = boot("en", () => undefined);
  await flush();
  assert.equal(ui.$("vPend").hidden(), false);
  assert.equal(ui.$("vPendHead").hidden(), true);
  assert.equal(ui.$("vPendText").hidden(), true);
  assert.equal(ui.$("vPendMsg").textContent, VENDOR_TEXT.eNet[1]);
  assert.ok(ui.$("vPendMsg").cls.has("sv1-err"), "الخطأ بصنف SV1");
});

test("جلسة منتهية (403) أثناء vendor-me تعيد إلى الدخول", async () => {
  const ui = boot("en", (t) => (t === "vendor-me" ? { s: 403, o: { ok: false, error: "suspended" } } : undefined));
  await flush();
  assert.equal(ui.$("vDash").hidden(), true);
  assert.equal(ui.$("vAuth").hidden(), false);
  assert.equal(ui.store.has("bp_vendor"), false);
});

/* ═════════════ ٢) مؤسسي معتمد ═════════════ */
test("مؤسسي معتمد: ثلاثة تبويبات، «قدّم عرضاً» لكل بند بدل «رشّح»، وعروضه تُحمَّل", async () => {
  const ui = boot("en", base("corporate", true));
  await flush();
  assert.equal(ui.$("vPend").hidden(), true);
  assert.equal(ui.$("vTabs").hidden(), false);
  assert.equal(ui.$("vTabOffers").hidden(), false);
  assert.deepEqual([...new Set(ui.types())].sort(), ["vendor-demand", "vendor-me", "vendor-my-offers"]);
  const cs = cards(ui);
  assert.equal(cs.length, 2);
  for (const c of cs) {
    const bs = buttons(c).map((b) => b.textContent);
    assert.deepEqual(bs, [VENDOR_TEXT.oBtn[1]]);
    assert.equal(bs.includes(VENDOR_TEXT.propose[1]), false);
  }
  // تبويب «عروضي» فارغ ⇒ رسالة «لا عروض».
  ui.$("vTabOffers").fire("click"); await flush();
  assert.equal(ui.$("vPaneOffers").hidden(), false);
  assert.equal(ui.$("vOffersMsg").textContent, VENDOR_TEXT.oNone[1]);
});

test("نموذج العرض: يتحقق قبل الإرسال، يرسل الحمولة الصحيحة، ويستبدل زرّ البند بعرضه", async () => {
  let saved = null;
  const ui = boot("en", base("corporate", true, {
    "vendor-my-offers": () => ({ s: 200, o: { ok: true, offers: saved ? [saved] : [], more: false } }),
    "vendor-offer-submit": (b) => { saved = { ...OFFER, price: Number(b.price), available: Number(b.available), prepDays: Number(b.prepDays), note: b.note }; return { s: 200, o: { ok: true, offer: saved, replaced: false } }; },
  }));
  await flush();
  const card = () => cards(ui)[0];
  buttons(card())[0].fire("click");
  const form = card().all((n) => n.tag === "form")[0];
  assert.ok(form, "النموذج");
  const [price, avail, prep] = form.all((n) => n.tag === "input");
  const note = form.all((n) => n.tag === "textarea")[0];
  const msg = () => form.children[form.children.length - 1];
  const submit = async () => { form.fire("submit"); await flush(); };
  const before = ui.calls.length;

  // سعر فاسد ثم عدد فاسد ثم أيام فاسدة ثم ملاحظة طويلة: لا نداء.
  price.value = "0"; avail.value = "5"; prep.value = "3"; await submit();
  assert.equal(msg().textContent, VENDOR_TEXT.ePrice[1]); assert.equal(price.getAttribute("aria-invalid"), "true");
  price.value = "100000.01"; await submit(); assert.equal(msg().textContent, VENDOR_TEXT.ePrice[1]);
  price.value = "12.345"; await submit(); assert.equal(msg().textContent, VENDOR_TEXT.ePrice[1]);
  price.value = "2,450.50"; avail.value = "0"; await submit();
  assert.equal(msg().textContent, VENDOR_TEXT.eAvail[1]); assert.equal(price.getAttribute("aria-invalid"), undefined, "العلامة تُمسح عند إعادة المحاولة");
  avail.value = "5001"; await submit(); assert.equal(msg().textContent, VENDOR_TEXT.eAvail[1]);
  avail.value = "12"; prep.value = "366"; await submit(); assert.equal(msg().textContent, VENDOR_TEXT.ePrep[1]);
  prep.value = "-1"; await submit(); assert.equal(msg().textContent, VENDOR_TEXT.ePrep[1]);
  prep.value = "21"; note.value = "x".repeat(301); await submit(); assert.equal(msg().textContent, VENDOR_TEXT.eNote[1]);
  assert.ok(msg().cls.has("sv1-err"));
  assert.equal(ui.calls.length, before, "لا نداء قبل اجتياز التحقق");

  // أرقام عربية (وفاصلتها العشرية) مقبولة وتُرسَل لاتينية.
  price.value = "٢٤٥٠٫٥"; note.value = "  ready \n now "; await submit();
  const sent = ui.calls.slice(before).find((c) => c.type === "vendor-offer-submit");
  assert.ok(sent, "نُودي vendor-offer-submit");
  assert.deepEqual({ itemId: sent.itemId, price: sent.price, available: sent.available, prepDays: sent.prepDays, note: sent.note }, { itemId: "EOR-TEST-1-1", price: "2450.5", available: "12", prepDays: "21", note: "ready now" });
  assert.equal(sent.email, "v@x.example");
  // بعد النجاح: يُغلق النموذج، وتظهر سطر «عرضك الحالي» وزرّ «عدّل عرضك».
  await flush();
  assert.equal(card().all((n) => n.tag === "form").length, 0);
  assert.ok(card().all((n) => n.cls.has("sv1-vnd-mine"))[0], "سطر عرضك الحالي");
  assert.equal(buttons(card()).map((b) => b.textContent)[0], VENDOR_TEXT.oBtnEdit[1]);
  assert.equal(ui.$("vDemandMsg").textContent, VENDOR_TEXT.oDone[1]);
});

test("أخطاء الخادم على العرض تُعرض بلغة المورّد: البند أُغلق، العروض غير مفعّلة، مقفول", async () => {
  for (const [error, key] of [["item_not_found", "eItemGone"], ["not_configured", "eOffCfg"], ["already_awarded", "eLocked"], ["invalid_price", "ePrice"], ["weird", "eNet"]]) {
    const ui = boot("fr", base("corporate", true, { "vendor-offer-submit": () => ({ s: 400, o: { ok: false, error } }) }));
    await flush();
    buttons(cards(ui)[0])[0].fire("click");
    const form = cards(ui)[0].all((n) => n.tag === "form")[0];
    const [price, avail, prep] = form.all((n) => n.tag === "input");
    price.value = "100"; avail.value = "2"; prep.value = "3";
    form.fire("submit"); await flush();
    assert.equal(form.children[form.children.length - 1].textContent, VENDOR_TEXT[key][2], error);
  }
});

test("عروضي: يعرض حالات العرض الأربع، ويسحب المقدَّم وحده، ولا زرّ على المرسّى", async () => {
  const mk = (id, status, itemId) => ({ ...OFFER, id: id.repeat(32), status, itemId });
  let offers = [mk("a", "submitted", "EOR-TEST-1-1"), mk("b", "withdrawn", "EOR-TEST-1-2"), mk("c", "awarded", "EOR-TEST-9-1"), mk("d", "rejected", "EOR-TEST-9-2")];
  const ui2 = boot("en", (t, b) => {
    if (t === "vendor-my-offers") return { s: 200, o: { ok: true, offers, more: false } };
    if (t === "vendor-offer-withdraw") { offers = offers.map((o) => (o.id === b.offerId ? { ...o, status: "withdrawn" } : o)); return { s: 200, o: { ok: true, offer: { ...OFFER, status: "withdrawn" } } }; }
    return base("corporate", true)(t, b);
  });
  await flush();
  ui2.$("vTabOffers").fire("click"); await flush();
  const rows = ui2.$("vOffers").children;
  assert.equal(rows.length, 4);
  const chips = rows.map((r) => r.all((n) => n.cls.has("sv1-vnd-ost"))[0].textContent);
  assert.deepEqual(chips, [VENDOR_TEXT.osSubmitted[1], VENDOR_TEXT.osWithdrawn[1], VENDOR_TEXT.osAwarded[1], VENDOR_TEXT.osRejected[1]]);
  assert.deepEqual(rows.map((r) => buttons(r).length), [1, 0, 0, 0]);
  buttons(rows[0])[0].fire("click"); await flush();
  const sent = ui2.calls.find((c) => c.type === "vendor-offer-withdraw");
  assert.equal(sent.offerId, "a".repeat(32));
  assert.deepEqual(ui2.$("vOffers").children.map((r) => buttons(r).length), [0, 0, 0, 0]);
  assert.equal(ui2.$("vOffersMsg").textContent, VENDOR_TEXT.oWithdrawn[1]);
});

test("بند عليه عرض مُرسّى: لا زرّ تعديل، ويُعرض العرض والحالة", async () => {
  const awarded = { ...OFFER, status: "awarded" };
  const ui = boot("en", (t, b) => (t === "vendor-my-offers" ? { s: 200, o: { ok: true, offers: [awarded], more: false } } : base("corporate", true)(t, b)));
  await flush();
  const first = cards(ui)[0];
  assert.deepEqual(buttons(first).map((b) => b.textContent), []);
  const mine = first.all((n) => n.cls.has("sv1-vnd-mine"))[0];
  assert.ok(mine);
  assert.ok(mine.textContent.includes(VENDOR_TEXT.osAwarded[1]));
  assert.deepEqual(buttons(cards(ui)[1]).map((b) => b.textContent), [VENDOR_TEXT.oBtn[1]]);
});

/* ═════════════ ٣) المكتب والمستقل كما كانا ═════════════ */
test("مكتب ومستقل: تبويبان وزرّ «رشّح» كما هو، ولا نداء للعروض", async () => {
  for (const kind of ["office", "freelancer", "platform"]) {
    const ui = boot("en", base(kind, true));
    await flush();
    assert.equal(ui.$("vTabs").hidden(), false, kind);
    assert.equal(ui.$("vTabOffers").hidden(), true, kind);
    assert.equal(ui.types().some((t) => /offer/.test(t)), false, kind);
    for (const c of cards(ui)) assert.deepEqual(buttons(c).map((b) => b.textContent), [VENDOR_TEXT.propose[1]], kind);
  }
});

/* ═════════════ ٤) التسجيل والأربع لغات ═════════════ */
test("نوع «مورّد مؤسسي» في التسجيل بالأربع لغات، وتنبيه الاعتماد يظهر عند اختياره فقط", () => {
  for (const l of ["ar", "en", "fr", "zh"]) {
    const html = render(l);
    assert.ok(html.includes(`<option value="مورّد مؤسسي">${esc(VENDOR_TEXT.kCorp[LI[l]])}</option>`), l);
  }
  const ui = boot("en", base("office", true), null);
  const note = ui.$("vAuthNote");
  assert.equal(note.textContent, VENDOR_TEXT.authNote[1]);
  ui.$("vKind").value = "مورّد مؤسسي"; ui.$("vKind").fire("change");
  assert.equal(note.textContent, VENDOR_TEXT.authNoteCorp[1]);
  ui.$("vKind").value = "منصة"; ui.$("vKind").fire("change");
  assert.equal(note.textContent, VENDOR_TEXT.authNote[1]);
  ui.$("vTabLogin").fire("click");
  assert.equal(note.textContent, VENDOR_TEXT.authNote[1], "في الدخول لا تنبيه");
});

test("الأربع لغات: نصوص العروض والحالات والأخطاء تصل العميل من القاموس", () => {
  const keys = ["oBtn", "oBtnEdit", "oMine", "oPrice", "oAvail", "oPrep", "oNote", "oSend", "oCancel", "oDone", "oUpdated", "oWithdraw", "oWithdrawn", "ePrice", "eAvail", "ePrep", "eNote", "eItemGone", "eLocked", "eOffCfg", "oNone", "oErr", "lPrice", "lAvail", "lPrep", "lNeed", "lNote", "days", "sar", "authNote", "authNoteCorp", "pendCheck"];
  const seen = new Map();
  for (const l of ["ar", "en", "fr", "zh"]) {
    const ui = boot(l, base("corporate", true), null);
    for (const k of keys) {
      assert.equal(ui.cfg.tx[k], VENDOR_TEXT[k][LI[l]], `${l}.${k}`);
      assert.ok(ui.cfg.tx[k].trim().length > 0);
    }
    assert.deepEqual(ui.cfg.ostatus, { submitted: VENDOR_TEXT.osSubmitted[LI[l]], withdrawn: VENDOR_TEXT.osWithdrawn[LI[l]], awarded: VENDOR_TEXT.osAwarded[LI[l]], rejected: VENDOR_TEXT.osRejected[LI[l]] });
    seen.set(l, ui.cfg.tx.oBtn);
  }
  assert.equal(new Set(seen.values()).size, 4, "زرّ العرض مختلف في كل لغة");
  // الصفحة الثابتة تحمل عنوان التبويب والانتظار بكل لغة.
  for (const l of ["ar", "en", "fr", "zh"]) {
    const html = render(l);
    for (const k of ["tOffers", "pendTitle", "pendText", "pendCheck", "oP"]) assert.ok(html.includes(esc(VENDOR_TEXT[k][LI[l]])), `${l}.${k}`);
  }
});
