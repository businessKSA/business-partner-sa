// إخفاء 2026-11-02 (طلبات المالك 9/12/13/14): /privacy و/data-deletion و/ai-agents
// و/calculator مخفية، و/account مُنهاة وتُحوَّل إلى /my. التحقق على شجرة المستودع
// المبنيّة (ما سيُنشر) وعلى vercel.json كما سيقرؤه Vercel — لا على نيّة الكود.
// الإعداد في site/data/hidden.json؛ الشرح في docs/hidden-pages-2026-11-02.md.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadRedirects, matchRedirect, compileSource } from "../site/scripts/vercel-redirects.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = path.join(REPO, "site");
const read = (p) => fs.readFileSync(p, "utf8");
const readJson = (p) => JSON.parse(read(p));
const H = await import(pathToFileURL(path.join(SITE, "scripts/hidden.mjs")).href);
const RULES = loadRedirects(path.join(REPO, "vercel.json"));
const cfg = readJson(path.join(SITE, "data/hidden.json"));

const HIDDEN = ["privacy", "data-deletion", "ai-agents", "calculator"];
const FULL = ["ar", "fr", "zh"];
const OTHER = ["es", "hi", "ja", "ko", "ru"];
const pageFile = (urlPath) => {
  const p = urlPath.replace(/^\/+|\/+$/g, "") || "index";
  return [path.join(SITE, p + ".html"), path.join(SITE, p, "index.html")].find((f) => fs.existsSync(f)) || null;
};

test("hidden.json: الصفحات الأربع مخفية و/account منقولة إلى /my", () => {
  for (const n of HIDDEN) assert.ok(cfg.pages.includes(n), `${n} في pages`);
  assert.equal(cfg.moved.account, "/my");
  for (const n of [...HIDDEN, "account"]) assert.ok(H.isHiddenPage(n), `${n} مخفية`);
});

test("لا ملف مبنيّ لأي منها في أي لغة، ودالة بنائها باقية في generate.mjs", () => {
  for (const n of [...HIDDEN, "account"]) for (const lang of ["", ...FULL, ...OTHER, "en"]) {
    assert.ok(!fs.existsSync(path.join(SITE, lang, `${n}.html`)), `${lang}/${n}.html ما زال موجوداً`);
  }
  // «لا تحذف المصدر»: الإعادة بحذف الاسم من hidden.json ثم البناء.
  const gen = read(path.join(SITE, "scripts/generate.mjs"));
  for (const fn of ["buildPrivacy", "buildDataDeletion", "buildAiAgents", "buildCalculator", "buildAccount"]) {
    assert.ok(new RegExp(`function ${fn}\\b`).test(gen), `${fn} باقية`);
  }
});

test("تحويل دائم (308) لكل صفحة في كل اللغات إلى وجهةٍ موجودة فعلاً", () => {
  const expected = { privacy: "/", "data-deletion": "/", "ai-agents": "/services", calculator: "/catalog", account: "/my" };
  for (const [name, to] of Object.entries(expected)) {
    for (const lang of ["", ...FULL, ...OTHER]) {
      const src = `${lang ? "/" + lang : ""}/${name}`;
      const r = matchRedirect(RULES, src);
      assert.ok(r, `${src} بلا تحويل`);
      assert.equal(r.status, 308, `${src}: دائم`);
      // اللغات المبنيّة كاملةً تبقى في لغتها؛ البقية تذهب إلى الإنجليزية.
      const want = FULL.includes(lang) ? (to === "/" ? `/${lang}` : `/${lang}${to}`) : to;
      assert.equal(r.location, want, src);
      assert.ok(pageFile(r.location), `${src} → ${r.location}: الوجهة ليست صفحةً مبنيّة (رابط ميت)`);
    }
  }
});

test("/account يحفظ المعاملات (ref وview وغيرها) كما هي", () => {
  assert.deepEqual(
    matchRedirect(RULES, "/account", "?ref=BP-2611-0042&view=documents"),
    { status: 308, location: "/my?ref=BP-2611-0042&view=documents", source: matchRedirect(RULES, "/account").source },
  );
  assert.equal(matchRedirect(RULES, "/ar/account", "?view=compliance").location, "/ar/my?view=compliance");
  assert.equal(matchRedirect(RULES, "/zh/account", "?ref=X").location, "/zh/my?ref=X");
  assert.equal(matchRedirect(RULES, "/es/account", "?ref=X").location, "/my?ref=X");
  // /my يقرأ هذين المعاملين فعلاً.
  const my = read(path.join(SITE, "my.html"));
  assert.ok(/searchParams\.get\('view'\)/.test(my) && /searchParams\.get\('ref'\)/.test(my), "/my لا يقرأ view/ref");
  // /client-portal القديمة لا تمرّ على /account الميتة.
  assert.equal(matchRedirect(RULES, "/client-portal", "?ref=Z").location, "/my?ref=Z");
});

test("noindex: ترويسة X-Robots-Tag لكل مصدرٍ مخفي بكل اللغات", () => {
  const vj = readJson(path.join(REPO, "vercel.json"));
  const rules = vj.headers.filter((r) => r.headers.some((x) => x.key === "X-Robots-Tag" && /noindex/.test(x.value)));
  assert.ok(rules.length >= 2);
  for (const name of [...HIDDEN, "account"]) for (const lang of ["", ...FULL, ...OTHER]) {
    const url = `${lang ? "/" + lang : ""}/${name}`;
    assert.ok(rules.some((r) => compileSource(r.source).test(url)), `${url} بلا noindex`);
  }
});

test("sitemap.xml نظيف من الصفحات المخفية كلها", () => {
  const urls = [...read(path.join(SITE, "sitemap.xml")).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(urls.length > 500);
  const bad = urls.filter((u) => H.isHiddenHref(u));
  assert.deepEqual(bad, []);
  assert.ok(urls.some((u) => u.endsWith("/terms")), "الشروط باقية");
  assert.ok(urls.some((u) => u.endsWith("/calculators/government-cost")), "الحاسبات الأخرى (/calculators/*) باقية");
});

test("التذييل (SV1) بلا الخصوصية وحذف البيانات والمستشارين، وفيه الشروط", () => {
  for (const lang of ["", "ar/", "fr/", "zh/"]) {
    const html = read(path.join(SITE, `${lang}about.html`));
    const foot = html.slice(html.indexOf('class="sv1-foot-nav"'));
    assert.ok(foot.includes("/terms"), `${lang}about: الشروط باقية`);
    for (const hidden of ["/privacy", "/data-deletion", "/ai-agents"]) {
      assert.ok(!foot.includes(`${hidden}"`), `${lang}about: التذييل يحمل ${hidden}`);
    }
  }
  // وفي مصدره: الروابط الثلاثة مشروطة بالإخفاء، فتعود وحدها بحذف الاسم من hidden.json.
  const src = read(path.join(SITE, "scripts/simple-v1.mjs"));
  for (const n of ["privacy", "data-deletion", "ai-agents"]) assert.ok(src.includes(`pageVisible("${n}")`), `${n} مشروطة في simple-v1.mjs`);
});

test("لا رابط <a> في أي صفحةٍ مبنيّة إلى /account أو أي صفحةٍ مخفية، ولا زرّ حاسبة يقود إلى /account", () => {
  const SKIP = new Set(["assets", "scripts", "data", "_astro"]);
  const offenders = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(full); continue; }
      if (!e.name.endsWith(".html")) continue;
      const html = read(full).replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "");
      for (const m of html.matchAll(/<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
        if (H.isHiddenHref(m[1] != null ? m[1] : m[2])) { offenders.push(`${path.relative(SITE, full)} → ${m[1] || m[2]}`); break; }
      }
    }
  })(SITE);
  assert.deepEqual(offenders.slice(0, 10), [], `${offenders.length} صفحة تربط بمخفي`);
  // الزرّ الذي كان يقود الحاسبة إلى /account صار يقود إلى /my (مصدراً).
  const gen = read(path.join(SITE, "scripts/generate.mjs"));
  assert.ok(/id="calc2-quote" href="\$\{u\("\/my"\)\}/.test(gen), "calc2-quote إلى /my");
  assert.ok(!/u\("\/account"\)/.test(gen), "generate.mjs: لا روابط u(\"/account\")");
});

test("القوائم: nav وfooter بلا الصفحات المخفية، و«منصّة العملاء» تفتح /my", async () => {
  const nav = H.pruneLinks(readJson(path.join(SITE, "data/nav.json")));
  const foot = H.pruneLinks(readJson(path.join(SITE, "data/footer.json")));
  const hrefs = [];
  (function walk(n) {
    if (Array.isArray(n)) return n.forEach(walk);
    if (n && typeof n === "object") { if (typeof n.href === "string") hrefs.push(n.href); Object.values(n).forEach(walk); }
  })([nav, foot]);
  assert.deepEqual(hrefs.filter((h) => H.isHiddenHref(h)), []);
  assert.ok(hrefs.includes("/my"));
});

test("hidden.mjs: movedHref يعيد كتابة الرابط بلغته واستعلامه ووسمه", () => {
  assert.equal(H.movedHref("/account"), "/my");
  assert.equal(H.movedHref("/ar/account?view=store#x"), "/ar/my?view=store#x");
  assert.equal(H.movedHref("/es/account?ref=1"), "/my?ref=1");
  assert.equal(H.movedHref("https://www.businesspartner.sa/zh/account"), "https://www.businesspartner.sa/zh/my");
  assert.equal(H.movedHref("/accounting"), null);
  assert.equal(H.movedHref("/my"), null);
  assert.equal(H.movedHref("https://example.com/account"), null);
  const r = H.stripHiddenLinks('<p><a class="x" href="/ar/account?view=documents">لوحتي</a> <a href="/privacy">خصوصية</a></p>');
  assert.equal(r.removed, 1);
  assert.equal(r.rewritten, 1);
  assert.ok(r.html.includes('href="/ar/my?view=documents"') && !r.html.includes("/privacy"));
});

test("vercel-redirects: مطابقة صيغة vercel.json المستعملة", () => {
  assert.ok(compileSource("/(privacy|data-deletion)").test("/privacy"));
  assert.ok(!compileSource("/(privacy|data-deletion)").test("/privacy-policy"));
  assert.ok(compileSource("/:lang(ar|fr|zh)/(privacy)").test("/fr/privacy/"));
  assert.ok(!compileSource("/:lang(ar|fr|zh)/(privacy)").test("/es/privacy"));
  assert.equal(matchRedirect([{ re: compileSource("/hr/employer/:path*"), source: "x", destination: "/employer", status: 307 }], "/hr/employer/a/b").location, "/employer");
});
