// الإخفاء المركزي (site/data/hidden.json) — يُثبَت هنا أن كوداً أو صفحةً في الملف:
//   • لا يظهر في catalog.json المبني، ولا في /catalog و/packages، ولا في sitemap،
//   • لا تُنتَج له صفحة، ويُولَّد له تحويل 302 في vercel.json،
//   • وأن حذفه من الملف يعيد كل ذلك.
//
// الاختبار الشامل يبني نسخةً معزولة في مجلد مؤقت (scripts + data + assets) ويشغّل
// generate.mjs عليها ثلاث مرات بإعدادات مختلفة — فلا يلمس شجرة المستودع.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(p, "utf8");
const readJson = (p) => JSON.parse(read(p));
const hiddenModule = pathToFileURL(path.join(REPO, "site/scripts/hidden.mjs")).href;

async function loadHidden(config, tag) {
  const file = path.join(os.tmpdir(), `bp-hidden-${process.pid}-${tag}.json`);
  fs.writeFileSync(file, JSON.stringify(config));
  process.env.BP_HIDDEN_FILE = file;
  try { return await import(`${hiddenModule}?case=${tag}`); }
  finally { delete process.env.BP_HIDDEN_FILE; }
}

// ---------------------------------------------------------------- وحدة hidden.mjs

test("hidden.mjs: المطابقة تتجاوز اللغة والأصل والاستعلام والوسم و.html", async () => {
  const h = await loadHidden({ services: ["REV-LAUNCH"], pages: ["business-development"] }, "unit1");
  for (const href of [
    "/business-development", "/ar/business-development", "/fr/business-development/",
    "/business-development#pricing", "/ar/business-development?x=1", "/zh/business-development.html",
    "https://businesspartner.sa/ar/business-development", "/services/rev-launch", "/ar/services/rev-launch",
  ]) assert.equal(h.isHiddenHref(href), true, href);
  for (const href of [
    "/", "/catalog", "/ar/catalog", "/business-development-dashboard", "/ar/business-development-dashboard",
    "/account?redirect=revenue", "/services/bp-sbc-02", "/services", "https://example.com/business-development", "#x", "",
  ]) assert.equal(h.isHiddenHref(href), false, href);
});

test("hidden.mjs: الأكواد بلا حساسية حالة، والخدمات والباقات تُصفّى", async () => {
  const h = await loadHidden({ services: ["rev-start", "REVOS-LAUNCH"], pages: [] }, "unit2");
  assert.equal(h.isHiddenService("REV-START"), true);
  assert.equal(h.isHiddenService("revos-launch"), true);
  assert.equal(h.isHiddenService("REV-PRO"), false);
  const list = [{ code: "REV-START" }, { code: "REV-PRO" }, { code: "BP-SBC-02" }];
  assert.deepEqual(h.visibleServices(list).map((s) => s.code), ["REV-PRO", "BP-SBC-02"]);
  assert.deepEqual(h.visibleCatalogRows([{ code: "revos-launch" }, { key: "silver" }]).map((r) => r.code || r.key), ["silver"]);
});

test("hidden.mjs: pruneLinks يُسقط الرابط المخفي ومجموعاته الفارغة فقط", async () => {
  const h = await loadHidden({ services: [], pages: ["business-development"] }, "unit3");
  const nav = {
    groups: [
      { href: "/about", en: "About" },
      { href: "/business-development", en: "BD", sub: [{ href: "/business-development#pricing" }] },
      { en: "Group", items: [{ href: "/business-development", en: "BD" }] },
      { en: "Mixed", items: [{ href: "/business-development", en: "BD" }, { href: "/packages", en: "Packages" }] },
    ],
  };
  const out = h.pruneLinks(nav);
  assert.deepEqual(out.groups.map((g) => g.en), ["About", "Mixed"]);
  assert.deepEqual(out.groups[1].items.map((i) => i.href), ["/packages"]);
});

test("hidden.mjs: stripHiddenLinks يحذف الرابط المخفي وحده ويُبقي غيره", async () => {
  const h = await loadHidden({ services: [], pages: ["business-development"] }, "unit4");
  const html = '<ul><li><a href="/ar/business-development">تطوير</a></li><li><a href="/ar/catalog">كتالوج</a></li></ul>'
    + '<a class="c" href="/business-development"><b>x</b></a><a href="/business-development-dashboard">لوحتي</a>';
  const r = h.stripHiddenLinks(html);
  assert.equal(r.removed, 2);
  assert.ok(!/business-development"/.test(r.html.replace("business-development-dashboard", "")));
  assert.ok(r.html.includes('href="/ar/catalog"'));
  assert.ok(r.html.includes("business-development-dashboard"), "لوحة العميل القائمة لا تُمسّ");
  assert.ok(!/<li>\s*<\/li>/.test(r.html), "الغلاف الفارغ يُحذف");
});

test("hidden.mjs: syncVercelRedirects يكتب أسطر 302 ويحذفها ولا يلمس غيرها", async () => {
  const base = readJson(path.join(REPO, "vercel.json"));
  const manual = base.redirects.filter((r) => r.statusCode !== 302);
  const file = path.join(os.tmpdir(), `bp-vercel-${process.pid}.json`);
  const original = read(path.join(REPO, "vercel.json")).split("\n").filter((l) => !/"statusCode"\s*:\s*302/.test(l)).join("\n");
  fs.writeFileSync(file, original);

  const on = await loadHidden({ services: ["REV-LAUNCH"], pages: ["business-development"] }, "unit5");
  assert.equal(on.syncVercelRedirects(file), true);
  const withRules = readJson(file);
  const managed = withRules.redirects.filter((r) => r.statusCode === 302);
  assert.ok(managed.length >= 3 && managed.every((r) => r.destination.endsWith("/catalog")));
  assert.deepEqual(withRules.redirects.filter((r) => r.statusCode !== 302), manual, "الأسطر اليدوية كما هي");
  assert.equal(on.syncVercelRedirects(file), false, "إعادة التشغيل لا تغيّر شيئاً");

  const off = await loadHidden({ services: [], pages: [] }, "unit6");
  assert.equal(off.syncVercelRedirects(file), true);
  assert.equal(read(file), original, "حذف الإدخال يعيد الملف حرفاً بحرف");
  fs.rmSync(file, { force: true });
});

// ------------------------------------------------- بناءٌ معزول بثلاث إعدادات

const SB = fs.mkdtempSync(path.join(os.tmpdir(), "bp-hidden-sandbox-"));
const SITE = path.join(SB, "site");
const HIDDEN_PATH = path.join(SITE, "data", "hidden.json");
const ORIGINAL_VERCEL = read(path.join(REPO, "vercel.json"));
const REAL_HIDDEN = readJson(path.join(REPO, "site/data/hidden.json"));
const TOTAL = readJson(path.join(REPO, "site/data/services.json")).length;

function build(config) {
  fs.writeFileSync(HIDDEN_PATH, JSON.stringify(config));
  const r = spawnSync(process.execPath, ["site/scripts/generate.mjs"], {
    cwd: SB, encoding: "utf8", timeout: 240000, env: { ...process.env, BP_HIDDEN_FILE: "" },
  });
  assert.equal(r.status, 0, "generate.mjs failed:\n" + (r.stderr || r.stdout).slice(-1500));
  const catalog = readJson(path.join(SITE, "assets/data/catalog.json"));
  return {
    catalog,
    codes: new Set(catalog.services.map((s) => String(s.code).toLowerCase())),
    pkgs: new Set(catalog.packages.map((p) => String(p.code || p.key).toLowerCase())),
    sitemap: read(path.join(SITE, "sitemap.xml")),
    vercel: read(path.join(SB, "vercel.json")),
    page: (rel) => (fs.existsSync(path.join(SITE, rel)) ? read(path.join(SITE, rel)) : null),
    has: (rel) => fs.existsSync(path.join(SITE, rel)),
  };
}

before(() => {
  fs.mkdirSync(SITE, { recursive: true });
  for (const d of ["scripts", "data", "assets"]) fs.cpSync(path.join(REPO, "site", d), path.join(SITE, d), { recursive: true });
  fs.symlinkSync(path.join(REPO, "api"), path.join(SB, "api"));
  fs.writeFileSync(path.join(SB, "vercel.json"), ORIGINAL_VERCEL);
});
after(() => fs.rmSync(SB, { recursive: true, force: true }));

const CODE = "BP-SBC-02";      // خدمة عادية تماماً — لا علاقة لها بتطوير الأعمال
const PKG = "BP-PKG-LAUNCH";   // باقة من site.json

test("إضافة كود إلى hidden.json تُخفيه من catalog.json و/catalog و/packages وsitemap وتولّد 302", () => {
  const b = build({ services: [CODE, PKG], pages: [] });

  assert.ok(!b.codes.has(CODE.toLowerCase()), "catalog.json بلا الخدمة");
  assert.ok(!b.pkgs.has(PKG.toLowerCase()), "catalog.json بلا الباقة");
  assert.equal(b.catalog.services.length, TOTAL - 1, "الفرق خدمة واحدة فقط");
  assert.ok(b.codes.has("rev-launch"), "ما لم يُذكر يبقى");

  for (const rel of ["catalog.html", "ar/catalog.html"]) {
    const html = b.page(rel);
    assert.ok(html, rel);
    assert.ok(!html.toLowerCase().includes(`"code":"${CODE.toLowerCase()}"`), `${rel}: الخدمة غائبة عن /catalog`);
    assert.ok(!html.includes(`"code":"${PKG}"`), `${rel}: الباقة غائبة عن /catalog`);
  }
  for (const rel of ["packages.html", "ar/packages.html"]) {
    assert.ok(!b.page(rel).includes(PKG), `${rel}: الباقة غائبة عن /packages`);
  }
  assert.ok(!b.has("services/bp-sbc-02.html") && !b.has("ar/services/bp-sbc-02.html"), "لا تُنتَج صفحة الخدمة");
  assert.ok(!b.sitemap.includes("/services/bp-sbc-02<"), "sitemap بلا الخدمة");
  assert.ok(b.sitemap.includes("/services/bp-sbc-01<") || b.sitemap.includes("/services/bp-fi-02<"), "sitemap يحوي غيرها");

  const managed = b.vercel.split("\n").filter((l) => /"statusCode"\s*:\s*302/.test(l));
  assert.ok(managed.some((l) => l.includes("bp-sbc-02") && l.includes('"/catalog"')), "تحويل 302 إلى /catalog");
  assert.ok(!b.vercel.includes("business-development)"), "لا تحويل لصفحةٍ لم تُخفَ");
});

test("الإعداد الحقيقي: صفحة تطوير الأعمال وخدمات REV وباقات revos مخفية في كل مكان", () => {
  const b = build(REAL_HIDDEN);

  for (const c of REAL_HIDDEN.services) {
    assert.ok(!b.codes.has(c.toLowerCase()) && !b.pkgs.has(c.toLowerCase()), `catalog.json بلا ${c}`);
  }
  for (const lang of ["", "ar/", "fr/", "zh/"]) {
    assert.ok(!b.has(`${lang}business-development.html`), `${lang}business-development.html لم تُنتَج`);
    assert.ok(!b.has(`${lang}services/rev-launch.html`), `${lang}services/rev-launch.html لم تُنتَج`);
  }
  // ‏(صفحة /business-development لم تكن في sitemap أصلاً؛ خدماتها كانت.)
  assert.ok(!b.sitemap.includes("business-development"), "sitemap بلا الصفحة");
  assert.ok(!/\/services\/rev-/.test(b.sitemap), "sitemap بلا خدمات REV");
  for (const rel of ["catalog.html", "ar/catalog.html", "packages.html", "ar/packages.html", "index.html", "ar/index.html", "services.html", "ar/services.html"]) {
    const html = b.page(rel);
    assert.ok(html, rel);
    assert.ok(!/href="[^"]*business-development(?:["#?])/.test(html), `${rel}: لا رابط إلى الصفحة المخفية`);
    assert.ok(!/REV-(?:START|LAUNCH|GROWTH|PRO|TEAM|ENT)|revos-/i.test(html), `${rel}: لا كود مخفي`);
  }
  assert.ok(b.vercel.includes('"source":"/(business-development)"'), "تحويل الصفحة");
  assert.ok(/\/services\/\(rev-ent\|rev-growth\|rev-launch\|rev-pro\|rev-start\|rev-team\)/.test(b.vercel), "تحويل الخدمات");
  assert.ok(b.vercel.includes("/business-development-dashboard"), "لوحة Revenue OS القائمة تبقى (rewrite)");
});

test("حذف الإدخال من hidden.json يُعيد كل شيء", () => {
  const b = build({ services: [], pages: [] });

  assert.equal(b.catalog.services.length, TOTAL, "كل خدمات المصدر عادت");
  for (const c of [...REAL_HIDDEN.services, CODE, PKG]) {
    assert.ok(b.codes.has(c.toLowerCase()) || b.pkgs.has(c.toLowerCase()), `catalog.json فيه ${c}`);
  }
  assert.ok(b.has("business-development.html") && b.has("ar/business-development.html"), "الصفحة عادت");
  assert.ok(b.has("services/rev-launch.html") && b.has("services/bp-sbc-02.html"), "صفحات الخدمات عادت");
  assert.ok(b.sitemap.includes("/services/rev-launch<") && b.sitemap.includes("/services/bp-sbc-02<"), "sitemap يحويها");
  assert.ok(b.page("ar/catalog.html").toLowerCase().includes(`"code":"${CODE.toLowerCase()}"`), "/catalog يحويها");
  assert.ok(b.page("packages.html").includes(PKG), "/packages يحوي الباقة");
  assert.ok(/href="[^"]*business-development"/.test(b.page("ar/index.html")), "رابط الترويسة عاد");
  assert.ok(!/"statusCode"\s*:\s*302/.test(b.vercel), "لا أسطر 302 مُدارة");
  assert.equal(b.vercel, ORIGINAL_VERCEL.split("\n").filter((l) => !/"statusCode"\s*:\s*302/.test(l)).join("\n"), "vercel.json كما كان بلا الأسطر المُدارة");
});

// ------------------------------------------- شجرة المستودع المبنيّة (ما سيُنشر)

test("المستودع: البناء المُلتزَم متوافق مع hidden.json (كتالوج، sitemap، vercel.json، الصفحات)", async () => {
  const cfg = readJson(path.join(REPO, "site/data/hidden.json"));
  const h = await loadHidden(cfg, "repo");
  const cat = readJson(path.join(REPO, "site/assets/data/catalog.json"));
  const have = new Set([...cat.services.map((s) => s.code), ...cat.packages.map((p) => p.code || p.key)].map((c) => String(c).toLowerCase()));
  for (const c of cfg.services) assert.ok(!have.has(c.toLowerCase()), `catalog.json المُلتزَم يحوي ${c} — شغّل npm run build`);

  const sitemap = read(path.join(REPO, "site/sitemap.xml"));
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(urls.filter((u) => h.isHiddenHref(u)), [], "sitemap يحوي مسارات مخفية");

  for (const p of cfg.pages) for (const lang of ["", "ar/", "fr/", "zh/", "es/", "ru/", "ko/", "ja/", "hi/"]) {
    assert.ok(!fs.existsSync(path.join(REPO, "site", `${lang}${p}.html`)), `${lang}${p}.html ما زالت موجودة`);
  }

  // أسطر 302 المُدارة في vercel.json = ما يولّده hidden.mjs الآن.
  const vj = readJson(path.join(REPO, "vercel.json"));
  const managed = vj.redirects.filter((r) => r.statusCode === 302);
  assert.deepEqual(managed, h.redirectRules(), "vercel.json غير متزامن مع hidden.json — شغّل npm run build");
  for (const r of managed) assert.ok(r.destination === "/catalog" || r.destination === "/:lang/catalog");
});

test("المستودع: لا صفحة عامة مبنيّة تربط بصفحةٍ أو خدمةٍ مخفية", async () => {
  const cfg = readJson(path.join(REPO, "site/data/hidden.json"));
  const h = await loadHidden(cfg, "repo2");
  const SKIP = new Set(["assets", "scripts", "data", "_astro"]);
  const offenders = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(full); continue; }
      if (!e.name.endsWith(".html")) continue;
      const html = read(full).replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "");
      for (const m of html.matchAll(/<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
        if (h.isHiddenHref(m[1] != null ? m[1] : m[2])) { offenders.push(`${path.relative(REPO, full)} → ${m[1] || m[2]}`); break; }
      }
    }
  })(path.join(REPO, "site"));
  assert.deepEqual(offenders.slice(0, 10), [], `${offenders.length} صفحة تربط بمخفي`);
});
