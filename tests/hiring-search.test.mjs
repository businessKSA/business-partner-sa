// بحث المرشّحين في تبويب صاحب العمل — /hiring (site/scripts/simple-v1-hiring.mjs)
//
// شغّله: npm test   (بعد npm run build: الاختبار يقرأ الصفحات المولَّدة)
//
// لماذا هذا الاختبار: كتب صاحب العمل «CDP» (= Chef de Partie) فاستنتجت الصفحة
// فلتر «ضيافة وسياحة» وجلبت صفحةً واحدة بالفلتر وحده ثم رتّبتها محلياً بالنص،
// فعاد «١ مرشّحاً في قاعدتنا» والقاعدة فيها آلاف الطهاة. المطلوب الآن:
//   ① النص يُرسَل إلى الخادم (q=) مع limit=30، و«اعرض المزيد» يتبع nextCursor.
//   ② العدّاد صادق: «المعروض N»، و«من أصل نحو T» فقط إن عاد T أكبر من المعروض.
//   ③ فلترٌ مستنتَج أفرغ القائمة ⇒ إعادة الطلب بدونه وقولُ ذلك صراحةً.
//   ④ البطاقة لا تعرض ما يشبه بريداً أو جوّالاً، ولا مهارةً تساوي المسمّى.
//   ⑤ سطر «نبحث أيضاً عن» للمختصرات (عرضٌ فقط) — وكل نصٍّ جديد بأربع لغات.
//
// الصفحة المولَّدة تُشغَّل فعلاً على DOM مُحاكى صغير (بلا شبكة): fetch وحده
// مُحاكى، فنقيس ما يُرسَل إلى /api/candidates وما يُرسَم من الردّ.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = { ar: "site/ar/hiring.html", en: "site/hiring.html", fr: "site/fr/hiring.html", zh: "site/zh/hiring.html" };
const read = (lang) => fs.readFileSync(path.join(ROOT, PAGES[lang]), "utf8");
const scriptOf = (html) => {
  const m = html.match(/<script>(\(function\(\)\{\nvar \$=[\s\S]*?)<\/script>/);
  assert.ok(m, "سكربت صفحة التوظيف غير موجود في الصفحة المولَّدة");
  return m[1];
};

// ------------------------------------------------------------- بنية الصفحة --
for (const lang of Object.keys(PAGES)) {
  test(`${lang}: عناصر البحث الجديد في الصفحة المولَّدة`, () => {
    const html = read(lang);
    assert.match(html, /id="hireMoreC"/, "زرّ المزيد");
    assert.match(html, /id="hireAbbr"/, "سطر المختصرات");
    const js = scriptOf(html);
    for (const k of ["shownN", "ofT", "relaxF", "relaxC", "relaxX", "alsoFor"]) {
      assert.match(js, new RegExp(`"${k}":"[^"]+"`), `نصّ ${k} غائب`);
    }
    assert.match(js, /limit='\+CAND_PAGE|'limit='\+CAND_PAGE/, "limit مُمرَّر");
    assert.match(js, /'q='\+encodeURIComponent/, "q مُمرَّر للخادم");
    assert.match(js, /nextCursor/, "المؤشّر");
    assert.doesNotMatch(js, /needNarrow/, "لا إلزام بمجالٍ أو مدينة عند وجود نص");
    // لا تخزين محلي ولا إجمالي مخترع
    assert.doesNotMatch(js, /localStorage|sessionStorage/);
  });
}

test("النصوص الجديدة مترجمة فعلاً (لا نسخة واحدة في اللغات الأربع)", () => {
  const per = {};
  for (const lang of Object.keys(PAGES)) {
    const tx = JSON.parse(scriptOf(read(lang)).match(/var TX=(\{.*\});\nvar KW/)[1]);
    per[lang] = tx;
  }
  for (const k of ["shownN", "ofT", "relaxF", "relaxC", "relaxX", "alsoFor"]) {
    const vals = new Set(Object.values(per).map((t) => t[k]));
    assert.equal(vals.size, 4, `${k}: الترجمات متطابقة بين لغتين`);
  }
  assert.match(per.ar.shownN, /المعروض/);
  assert.match(per.ar.ofT, /من أصل نحو/);
});

// ------------------------------------------------- تشغيل السكربت على DOM مُحاكى --
function stub(id) {
  const el = {
    id, value: "", textContent: "", innerHTML: "", hidden: false, disabled: false, style: {}, options: [],
    _h: {}, _cls: new Set(), attrs: {},
    classList: {
      toggle(c, on) { (on === undefined ? !el._cls.has(c) : on) ? el._cls.add(c) : el._cls.delete(c); },
      add(c) { el._cls.add(c); }, remove(c) { el._cls.delete(c); }, contains(c) { return el._cls.has(c); },
    },
    addEventListener(t, fn) { (el._h[t] = el._h[t] || []).push(fn); },
    setAttribute(k, v) { el.attrs[k] = v; }, getAttribute(k) { return el.attrs[k] == null ? null : el.attrs[k]; },
    closest() { return el; }, focus() {}, scrollIntoView() {},
    appendChild(c) { el.textContent = (el.textContent || "") + (c.textContent || ""); },
    insertAdjacentHTML(_p, h) { el.innerHTML += h; },
    get shown() { return !el._cls.has("sv1-hide"); },
  };
  return el;
}

// pages: دالة (url) => ردّ الخادم. تُسجَّل كل الطلبات في calls.
async function boot(lang, serve) {
  const els = {};
  const calls = [];
  const document = {
    getElementById(id) { return (els[id] = els[id] || stub(id)); },
    createElement() { return stub("x"); }, createTextNode(t) { return { textContent: t }; },
    addEventListener() {},
  };
  // الرقاقات عناصر select: خيارات المجال والمدينة من الصفحة نفسها.
  const html = read(lang);
  const opts = (id) => {
    const m = html.match(new RegExp(`<select id="${id}"[^>]*>([\\s\\S]*?)</select>`));
    return [...(m ? m[1] : "").matchAll(/<option value="([^"]*)">([^<]*)<\/option>/g)].map((x) => ({ value: x[1], text: x[2] }));
  };
  document.getElementById("hireField").options = opts("hireField");
  document.getElementById("hireCity").options = opts("hireCity");
  const fetchMock = (url) => {
    calls.push(String(url));
    const body = serve(String(url));
    return Promise.resolve({ json: () => Promise.resolve(body) });
  };
  const sandbox = {
    document, fetch: fetchMock, URL, console, Intl, Date, setTimeout, clearTimeout, Promise,
    location: { href: `https://x.test/${lang}/hiring` }, history: { replaceState() {} },
    navigator: {}, window: {},
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(scriptOf(html), sandbox);
  const flush = () => new Promise((r) => setTimeout(r, 15));
  await flush();
  return {
    els, calls, flush, document,
    el: (id) => document.getElementById(id),
    submit: async (text) => {
      document.getElementById("hireQ").value = text;
      document.getElementById("hireForm")._h.submit[0]({ preventDefault() {} });
      await flush(); await flush(); await flush();
    },
    type: (text) => { document.getElementById("hireQ").value = text; document.getElementById("hireQ")._h.input.forEach((f) => f()); },
    more: async () => { document.getElementById("hireMoreC")._h.click[0](); await flush(); await flush(); },
  };
}

const cand = (i, extra) => ({ id: "c" + i, role: "Chef de Partie " + i, field: "ضيافة وسياحة", city: "الرياض", experience: "5 years", ...extra });
const page = (from, n, extra) => Array.from({ length: n }, (_, i) => cand(from + i));
const candCalls = (calls) => calls.filter((u) => u.startsWith("/api/candidates?") && u.includes("limit=30"));

test("«CDP»: النص يذهب إلى الخادم بلا فلتر مستنتَج، والعدّاد صادق، والمزيد يتبع المؤشّر", async () => {
  const p = await boot("ar", (url) => {
    if (url.includes("openJobs")) return { ok: true, jobs: [] };
    if (url.includes("count=1")) return { ok: true, done: true, total: 17000 };
    if (url.includes("cursor=c1")) return { ok: true, candidates: page(31, 12), nextCursor: null, done: true };
    return { ok: true, candidates: page(1, 30), nextCursor: "c1", done: false, total: 412 };
  });
  await p.submit("CDP");
  const first = candCalls(p.calls)[0];
  assert.ok(first, "لم يُطلب البحث من الخادم");
  assert.match(first, /[?&]q=CDP(&|$)/);
  assert.match(first, /[?&]limit=30(&|$)/);
  assert.doesNotMatch(first, /field=|city=/, "النص وحده يكفي: لا مجال ولا مدينة");
  assert.equal(p.el("hireResults").innerHTML.match(/<article/g).length, 30);
  assert.equal(p.el("hireCount").textContent, "المعروض 30 · من أصل نحو 412");
  assert.ok(p.el("hireMoreC").shown, "زرّ اعرض المزيد ظاهر");

  await p.more();
  assert.match(candCalls(p.calls)[1], /cursor=c1/);
  assert.equal(p.el("hireResults").innerHTML.match(/<article/g).length, 42, "الصفحة التالية تُضاف لا تستبدل");
  assert.equal(p.el("hireCount").textContent, "المعروض 42", "انتهت القائمة: لا إجمالي");
  assert.ok(!p.el("hireMoreC").shown, "انتهت القائمة: لا زرّ");
});

test("إجماليٌّ لا يزيد على المعروض لا يُكتب (لا رقم مخمَّن)", async () => {
  const p = await boot("en", (url) => {
    if (url.includes("openJobs")) return { ok: true, jobs: [] };
    if (url.includes("count=1")) return { ok: false };
    return { ok: true, candidates: page(1, 30), nextCursor: "n", done: false, total: 30 };
  });
  await p.submit("cook");
  assert.equal(p.el("hireCount").textContent, "Showing 30");
  const p2 = await boot("en", (url) => {
    if (url.includes("openJobs")) return { ok: true, jobs: [] };
    if (url.includes("count=1")) return { ok: false };
    return { ok: true, candidates: page(1, 30), nextCursor: "n", done: false };
  });
  await p2.submit("cook");
  assert.equal(p2.el("hireCount").textContent, "Showing 30", "لا total في الردّ ⇒ لا إجمالي");
});

test("فلترٌ مستنتَج أفرغ القائمة: إعادة الطلب بدونه مع قولٍ صريح", async () => {
  const p = await boot("ar", (url) => {
    if (url.includes("openJobs")) return { ok: true, jobs: [] };
    if (url.includes("count=1")) return { ok: false };
    if (url.includes("field=")) return { ok: true, candidates: [], nextCursor: null, done: true };
    return { ok: true, candidates: page(1, 5), nextCursor: null, done: true };
  });
  await p.submit("chef");
  const cc = candCalls(p.calls);
  assert.equal(cc.length, 2);
  assert.match(cc[0], /field=/, "المحاولة الأولى بالمجال المستنتَج");
  assert.doesNotMatch(cc[1], /field=/, "الثانية بلا المجال المستنتَج");
  assert.equal(p.el("hireResults").innerHTML.match(/<article/g).length, 5);
  const note = p.el("hireNote").textContent;
  assert.match(note, /لم نجد في «ضيافة وسياحة»/);
  assert.match(note, /«chef» في كل المجالات/);
  assert.equal(p.el("hireField").value, "", "الرقاقة المستنتَجة لا تبقى شرطاً");
});

test("رقاقةٌ اختارها الزائر لا تُرفع، والمستنتَجة تُمسح قبل البحث التالي", async () => {
  const p = await boot("ar", (url) => {
    if (url.includes("openJobs")) return { ok: true, jobs: [] };
    if (url.includes("count=1")) return { ok: false };
    return { ok: true, candidates: page(1, 3), nextCursor: null, done: true };
  });
  await p.submit("chef");
  assert.ok(candCalls(p.calls)[0].includes("field="), "استُنتج المجال");
  await p.submit("welder");
  const second = decodeURIComponent(candCalls(p.calls)[1]);
  // «welder» ⇒ حرف مهنية وصيانة، لا «ضيافة وسياحة» العالقة من البحث السابق.
  assert.doesNotMatch(second, /ضيافة/);
  assert.match(second, /field=حرف مهنية وصيانة/);
});

test("البطاقة: لا بريد ولا جوّال ولا مهارة تساوي المسمّى", async () => {
  const dirty = [
    { id: "d1", role: "Chef de Partie", field: "ضيافة وسياحة", city: "جدة", experience: "4",
      education: "contact me at ali@example.com", skills: "Chef de Partie, Grilling, 0551234567, +966 55 123 4567, Pastry, grilling" },
    { id: "d2", role: "0551234567", field: "ضيافة وسياحة", city: "الرياض", education: "2015 - 2019 جامعة الملك سعود", skills: "ISO 9001:2015" },
  ];
  const p = await boot("en", (url) => {
    if (url.includes("openJobs")) return { ok: true, jobs: [] };
    if (url.includes("count=1")) return { ok: false };
    return { ok: true, candidates: dirty, nextCursor: null, done: true };
  });
  await p.submit("chef");
  const h = p.el("hireResults").innerHTML;
  assert.doesNotMatch(h, /@/);
  assert.doesNotMatch(h, /0551234567|966/);
  assert.match(h, /Grilling · Pastry/, "المهارات النظيفة تبقى بلا تكرار ولا المسمّى");
  assert.doesNotMatch(h, /<p>[^<]*Chef de Partie[^<]*<\/p>/, "المهارة المساوية للمسمّى لا تُعرض");
  assert.match(h, /2015 - 2019/, "السنوات ليست جوّالاً");
  assert.match(h, /ISO 9001:2015/);
  assert.match(h, /<h4>ضيافة وسياحة<\/h4>/, "مسمّىً يشبه جوّالاً يسقط إلى المجال");
});

test("المختصرات: سطر «نبحث أيضاً عن» للعرض فقط", async () => {
  const p = await boot("ar", (url) => {
    if (url.includes("openJobs")) return { ok: true, jobs: [] };
    return { ok: false };
  });
  p.type("مطلوب CDP خبرة");
  assert.ok(p.el("hireAbbr").shown);
  assert.equal(p.el("hireAbbr").textContent, "نبحث أيضاً عن: Chef de Partie · شيف قسم");
  p.type("I need it support");
  assert.ok(!p.el("hireAbbr").shown, "«it» كلمةٌ عادية لا مختصر");
  p.type("IT manager");
  assert.match(p.el("hireAbbr").textContent, /Information Technology/);
  const en = await boot("en", () => ({ ok: false }));
  en.type("F&B cdp");
  assert.equal(en.el("hireAbbr").textContent, "Also searching for: Food & Beverage · Chef de Partie");
  assert.equal(candCalls(p.calls).length, 0, "العرض وحده: لا طلب بحث من الكتابة");
});
