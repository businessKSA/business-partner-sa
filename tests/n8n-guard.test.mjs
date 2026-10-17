// حارس n8n في المتصفح (site/scripts/n8n-guard.mjs).
//
// الصفحات المولَّدة التي ترسل من المتصفح إلى ويبهوكات n8n الإنتاجية يجب ألا
// تفعل ذلك من localhost ولا من معاينة vercel.app، وأن تبقى على سلوكها في الإنتاج.
// يُثبَت هنا بثلاث طبقات:
//   ١) المنطق نفسه: السكربت المحقون يُنفَّذ في صندوق vm بمضيفات مختلفة.
//   ٢) الحقن: بعد وسم الترميز، مرةً واحدة، وفي الصفحات المعنية وحدها.
//   ٣) التغطية: كل صفحة مبنيّة تحوي ويبهوكاً تحمل الحارس.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { isTestHost, n8nGuardScript, injectN8nGuard, GUARD_ID } = await import(pathToFileURL(path.join(REPO, "site/scripts/n8n-guard.mjs")).href);

const N8N = "https://businesspartnerai.app.n8n.cloud/webhook/client-intake-web";

test("isTestHost: localhost و127.0.0.1 و::1 ونطاقات vercel.app فقط", () => {
  for (const h of ["localhost", "LOCALHOST", "127.0.0.1", "::1", "[::1]", "bp-git-feature-team.vercel.app", "business-partner-sa-abc123.vercel.app"]) {
    assert.equal(isTestHost(h), true, h);
  }
  for (const h of ["businesspartner.sa", "www.businesspartner.sa", "ar.businesspartner.sa", "vercel.app.evil.com", "evilvercel.app", "notlocalhost", "localhost.evil.com", "", null, undefined]) {
    assert.equal(isTestHost(h), false, String(h));
  }
});

// ‏صندوق يحاكي نافذة المتصفح: fetch وXHR وsendBeacon مراقَبة.
function sandbox(hostname, lang = "ar") {
  const calls = { fetch: [], xhr: [], beacon: [], log: [] };
  const origFetch = (u) => { calls.fetch.push(String(u && u.url || u)); return Promise.resolve({ ok: true }); };
  class XHR {
    open(m, u) { this.u = u; }
    send() { calls.xhr.push(String(this.u)); }
    dispatchEvent(ev) { calls.xhrEvents = (calls.xhrEvents || []).concat(ev.type); }
  }
  const beacon = (u) => { calls.beacon.push(String(u)); return true; };
  const win = {
    fetch: origFetch, XMLHttpRequest: XHR, Event: class { constructor(t) { this.type = t; } },
    location: { hostname, href: "https://" + hostname + "/ar/worker-housing" },
    document: { documentElement: { getAttribute: (k) => (k === "lang" ? lang : null) } },
    navigator: { sendBeacon: beacon },
    console: { info: (...a) => calls.log.push(a.join(" ")) },
    URL, setTimeout: (f) => f(), Promise, Error,
  };
  win.window = win;
  const ctx = vm.createContext(win);
  const js = n8nGuardScript().replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "");
  vm.runInContext(js, ctx);
  return { win, calls, origFetch, origBeacon: beacon, XHR };
}

test("المعاينة وlocalhost: fetch إلى n8n يُرفض ولا يصل إلى الشبكة", async () => {
  for (const host of ["localhost", "127.0.0.1", "bp-git-x-team.vercel.app"]) {
    const s = sandbox(host);
    assert.equal(s.win.BP_TEST_MODE, true, host);
    await assert.rejects(() => s.win.fetch(N8N, { method: "POST" }), (e) => e.bpTestMode === true);
    await assert.rejects(() => s.win.fetch({ url: N8N }), (e) => e.bpTestMode === true);
    assert.deepEqual(s.calls.fetch, [], host + ": لا شيء يصل إلى fetch الأصلي");
    // ما سواه يمرّ كما هو
    await s.win.fetch("/api/otp");
    await s.win.fetch("https://fonts.googleapis.com/css2");
    assert.deepEqual(s.calls.fetch, ["/api/otp", "https://fonts.googleapis.com/css2"]);
    assert.ok(s.calls.log.some((l) => /blocked fetch to n8n/.test(l)));
  }
});

test("المعاينة: XHR وsendBeacon إلى n8n يُحجبان، وغيرهما يمرّ", () => {
  const s = sandbox("localhost");
  const x = new s.win.XMLHttpRequest();
  x.open("POST", N8N); x.send("{}");
  assert.deepEqual(s.calls.xhr, [], "XHR إلى n8n لا يُرسَل");
  assert.deepEqual(s.calls.xhrEvents, ["error"], "ويُطلَق error ليعرف المستدعي");
  const y = new s.win.XMLHttpRequest();
  y.open("GET", "/api/otp"); y.send();
  assert.deepEqual(s.calls.xhr, ["/api/otp"]);
  assert.equal(s.win.navigator.sendBeacon(N8N, "{}"), false);
  assert.equal(s.win.navigator.sendBeacon("/api/hit", "{}"), true);
  assert.deepEqual(s.calls.beacon, ["/api/hit"]);
});

test("النص يتبع لغة الصفحة، ويكتب في الكونسول", () => {
  const T = { ar: "وضع اختبار — لم يُرسَل", en: "Test mode — not sent", fr: "Mode test — non envoyé", zh: "测试模式 — 未发送" };
  for (const [lang, txt] of Object.entries(T)) {
    const s = sandbox("localhost", lang);
    assert.equal(s.win.bpTestNote("form"), txt);
    assert.ok(s.calls.log.some((l) => /not sent to n8n \(form\)/.test(l)));
  }
  assert.equal(sandbox("localhost", "ru").win.bpTestNote(), T.en, "لغة بلا نص تعود إلى الإنجليزية");
});

test("الإنتاج: لا علَم ولا تغليف — الدوال الأصلية نفسها", async () => {
  for (const host of ["businesspartner.sa", "www.businesspartner.sa"]) {
    const s = sandbox(host);
    assert.equal(s.win.BP_TEST_MODE, false, host);
    assert.equal(s.win.fetch, s.origFetch, "fetch لم يُلفّ");
    assert.equal(s.win.navigator.sendBeacon, s.origBeacon, "sendBeacon لم يُلفّ");
    assert.equal(s.win.bpTestNote, undefined, "لا دالة اختبار في الإنتاج");
    await s.win.fetch(N8N, { method: "POST" });
    assert.deepEqual(s.calls.fetch, [N8N], "الطلب إلى n8n يخرج كما كان");
    const x = new s.win.XMLHttpRequest(); x.open("POST", N8N); x.send("{}");
    assert.deepEqual(s.calls.xhr, [N8N]);
  }
});

test("injectN8nGuard: بعد وسم الترميز، مرة واحدة، وفي الصفحات المعنية وحدها", () => {
  const page = '<!doctype html><html><head><meta charset="utf-8"><title>x</title></head><body><script>fetch("' + N8N + '")</script></body></html>';
  const out = injectN8nGuard(page);
  assert.ok(out.indexOf(`id="${GUARD_ID}"`) > out.indexOf('<meta charset="utf-8">'), "بعد الترميز");
  assert.ok(out.indexOf(`id="${GUARD_ID}"`) < out.indexOf("<title>"), "قبل أي سكربت آخر");
  assert.equal(injectN8nGuard(out), out, "لا حقن مزدوج");
  const plain = '<html><head><meta charset="utf-8"></head><body>لا ويبهوك هنا</body></html>';
  assert.equal(injectN8nGuard(plain), plain, "صفحة بلا ويبهوك لا تُمسّ");
  const linkOnly = '<a href="https://businesspartnerai.app.n8n.cloud/form/abc">رابط نموذج</a><meta charset="utf-8">';
  assert.equal(injectN8nGuard(linkOnly), linkOnly, "رابطٌ إلى n8n ليس إرسالاً");
  const noMeta = '<html><head><title>t</title></head><body>' + N8N.replace("https://", "https://") + "</body></html>";
  assert.ok(injectN8nGuard(noMeta).startsWith('<html><head><script id="' + GUARD_ID));
  // رموز $ في الاستبدال لا تُفسَّر (الحارس نفسه يحوي $/)
  assert.ok(out.includes("$/"), "نص الحارس سليم بعد الحقن");
});

// ---- التغطية على الصفحات المبنيّة
function* htmlFiles(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (!["scripts", "data", "node_modules"].includes(e.name)) yield* htmlFiles(full); }
    else if (e.name.endsWith(".html")) yield full;
  }
}

// ‏صفحاتٌ مكتوبة يدوياً تُخدَم من assets/ مباشرةً بلا مرور بـ write():
// خارج نطاق المولّد (مالكها وكيل الامتثال)، وشبكة الأمان العامة لا تصلها.
const HAND_WRITTEN = new Set(["assets/data/compliance-dashboard.html"]);

test("كل صفحة مبنيّة تحوي ويبهوك n8n تحمل الحارس قبل أي نداء", () => {
  const root = path.join(REPO, "site");
  const missing = [];
  let withHook = 0;
  for (const f of htmlFiles(root)) {
    const rel = path.relative(root, f).split(path.sep).join("/");
    const html = fs.readFileSync(f, "utf8");
    if (!/n8n\.cloud\/webhook/.test(html)) continue;
    withHook++;
    if (HAND_WRITTEN.has(rel)) continue;
    const g = html.indexOf(`id="${GUARD_ID}"`);
    const firstCall = html.search(/n8n\.cloud\/webhook/);
    if (g < 0 || g > firstCall) missing.push(rel);
  }
  assert.ok(withHook >= 8, "توقّعنا صفحات بويبهوك (وُجد " + withHook + ")");
  assert.deepEqual(missing, [], "صفحات تتصل بـ n8n بلا حارس: " + missing.join(", "));
});
