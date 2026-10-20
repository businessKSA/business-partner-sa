// زرّ «شهري / سنوي» في /packages: site/assets/js/main.js (قسم Employer plan cards) + أزرار الباقات في generate.mjs
//
// شغّله: npm test
//
// ما قيس بمتصفح حقيقي على /ar/packages (2026-10-11) وصار اختباراً:
//   ① في تبويب «الباقات القانونية» كان زرّ «سنوي» ميتاً: السكربت يربط أول زرّ تبديل في الصفحة فقط.
//   ② الضغط على «سنوي» في تبويب الخدمات يبدّل أسعار وأزرار سلّة التبويب القانوني معاً من وراء زرّه الذي يعرض «شهري».
//   ③ بند سنوي يدخل السلة باسم «… — اشتراك شهري» لأن الاسم لا يتبدّل مع الدورة.
// السكربت الفعلي يُشغَّل هنا فوق DOM مصغَّر (لا تخطيط ولا CSS) — يمسك المنطق لا الشكل.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const main = fs.readFileSync(path.join(ROOT, "site/assets/js/main.js"), "utf8");
const a = main.indexOf("/* ---------- Employer plan cards — monthly/yearly billing toggle");
const b = main.indexOf("/* ---------- Standalone employer registration");
assert.ok(a > 0 && b > a, "قسم زرّ التبديل غير موجود في main.js");
const SNIPPET = main.slice(a, b);

function el(attrs = {}, cls = []) {
  const e = {
    _a: { ...attrs }, _c: new Set(cls), _l: {}, hidden: false,
    getAttribute(k) { return k in this._a ? this._a[k] : null; },
    setAttribute(k, v) { this._a[k] = String(v); },
    addEventListener(t, f) { (this._l[t] ||= []).push(f); },
    click() { (this._l.click || []).forEach((f) => f({ target: this })); },
    classList: null, kids: [],
    querySelectorAll(sel) { return sel === ".emp-bill-btn" ? this.kids : []; },
  };
  e.classList = { toggle: (c, on) => { on ? e._c.add(c) : e._c.delete(c); }, contains: (c) => e._c.has(c) };
  return e;
}

function boot() {
  // تبويبان، لكلٍّ منهما زرّ تبديل وبطاقتان: الخدمات (starter) والقانونية (basic)
  const mk = (key, nameAr, m, y) => el({
    "data-id": `pkg-${key}-monthly`, "data-name-ar": `${nameAr} — اشتراك شهري`, "data-name-en": `${key} — Monthly subscription`,
    "data-name-ar-monthly": `${nameAr} — اشتراك شهري`, "data-name-en-monthly": `${key} — Monthly subscription`,
    "data-name-ar-yearly": `${nameAr} — اشتراك سنوي`, "data-name-en-yearly": `${key} — Yearly subscription`,
    "data-amount": String(m), "data-price": `${m} / mo`,
    "data-id-monthly": `pkg-${key}-monthly`, "data-id-yearly": `pkg-${key}-yearly`,
    "data-amount-monthly": String(m), "data-amount-yearly": String(y),
    "data-price-monthly": `${m} / mo`, "data-price-yearly": `${y} / yr`,
  });
  const btns = [mk("starter-4", "باقة المنشآت الصغيرة", 2500, 21000), mk("basic-legal", "الباقة الأساسية", 8000, 67200)];
  const mkToggle = () => {
    const t = el();
    t.kids = [el({ "data-bill": "monthly" }, ["active"]), el({ "data-bill": "yearly" })];
    return t;
  };
  const toggles = [mkToggle(), mkToggle()];
  const pm = [el(), el()], py = [el(), el()];
  py.forEach((x) => { x.hidden = true; });
  const listeners = {};
  const document = {
    addEventListener: (t, f) => { listeners[t] = f; },
    querySelectorAll(sel) {
      if (sel === ".emp-billing-toggle") return toggles;
      if (sel === ".emp-price-m") return pm;
      if (sel === ".emp-price-y") return py;
      if (sel === ".emp-plan-btn") return btns;
      return [];
    },
  };
  const ctx = vm.createContext({ document });
  vm.runInContext(SNIPPET, ctx);
  listeners.DOMContentLoaded();
  return { btns, toggles, pm, py };
}

test("① كل أزرار التبديل مربوطة — «سنوي» في التبويب الثاني يعمل", () => {
  const { btns, toggles } = boot();
  toggles[1].kids[1].click();
  assert.equal(btns[1].getAttribute("data-id"), "pkg-basic-legal-yearly");
  assert.equal(btns[1].getAttribute("data-amount"), "67200");
});

test("② الحالة تتزامن: ضغط «سنوي» في تبويب يُظهر «سنوي» نشطاً في كل التبويبات", () => {
  const { toggles, pm, py } = boot();
  toggles[0].kids[1].click();
  for (const t of toggles) {
    assert.equal(t.kids[1].classList.contains("active"), true);
    assert.equal(t.kids[0].classList.contains("active"), false);
  }
  assert.ok(pm.every((x) => x.hidden) && py.every((x) => !x.hidden));
  toggles[1].kids[0].click();
  for (const t of toggles) assert.equal(t.kids[0].classList.contains("active"), true);
  assert.ok(pm.every((x) => !x.hidden) && py.every((x) => x.hidden));
});

test("③ اسم البند في السلة يتبع الدورة (شهري ⇄ سنوي) بالعربية والإنجليزية", () => {
  const { btns, toggles } = boot();
  toggles[0].kids[1].click();
  for (const x of btns) {
    assert.match(x.getAttribute("data-name-ar"), /اشتراك سنوي$/);
    assert.match(x.getAttribute("data-name-en"), /Yearly subscription$/);
    assert.match(x.getAttribute("data-id"), /-yearly$/);
  }
  toggles[0].kids[0].click();
  for (const x of btns) {
    assert.match(x.getAttribute("data-name-ar"), /اشتراك شهري$/);
    assert.match(x.getAttribute("data-id"), /-monthly$/);
  }
});

test("④ بطاقة بلا سمات الاسم (خطط أصحاب العمل) تتبدّل دورتها ولا يُمسّ اسمها", () => {
  const { btns, toggles } = boot();
  for (const k of ["data-name-ar-yearly", "data-name-en-yearly", "data-name-ar-monthly", "data-name-en-monthly"]) delete btns[0]._a[k];
  btns[0].setAttribute("data-name-ar", "خطة صاحب العمل");
  toggles[0].kids[1].click();
  assert.equal(btns[0].getAttribute("data-name-ar"), "خطة صاحب العمل");
  assert.equal(btns[0].getAttribute("data-id"), "pkg-starter-4-yearly");
});

test("⑤ HTML المبنيّ لـ/packages يحمل أسماء الدورتين على كل زرّ شهري", () => {
  const html = fs.readFileSync(path.join(ROOT, "site/ar/packages.html"), "utf8");
  const btns = [...html.matchAll(/<button[^>]*emp-plan-btn[^>]*>/g)].map((m) => m[0]);
  assert.ok(btns.length >= 8, "توقّعت ٨ أزرار باقات شهرية على الأقل، وجدت " + btns.length);
  for (const x of btns) {
    assert.match(x, /data-name-ar-yearly="[^"]*اشتراك سنوي"/);
    assert.match(x, /data-name-en-yearly="[^"]*Yearly subscription"/);
  }
});
