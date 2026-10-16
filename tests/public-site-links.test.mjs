// حارس سلامة الروابط والنماذج لصفحات الموقع العام (نطاق public-site).
//
// تدقيق 2026-10-11 (docs/site-audit-2026-10-11/public-site-manager.md) مرّ على
// ٩٨ صفحة بمتصفح حقيقي بالعربية والإنجليزية ولم يجد رابطاً ميتاً. هذا الاختبار
// يُبقي الأمر كذلك: أي رابط داخلي في صفحات النطاق يجب أن يصل إلى ملف مبني أو
// إلى مسار يعرفه vercel.json (إعادة توجيه أو إعادة كتابة)، وأي نموذج في
// النطاق يجب ألا يُرسَل إلى مسار غير موجود.
//
// ثابت وسريع: لا خادم ولا متصفح — يقرأ ما بناه `npm run build` في site/.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = join(ROOT, "site");
const VERCEL = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8"));

const LANGS = ["", "ar", "fr", "zh"]; // "" = الإنجليزية بلا بادئة
const PAGES = [
  "index", "about", "contact", "terms", "services", "news", "newsletter",
  "saudi-arabia", "opportunities", "knowledge-center", "tools-and-calculators",
];
const folderPages = (dir) => {
  const d = join(SITE, dir);
  return existsSync(d) ? readdirSync(d).filter((f) => f.endsWith(".html")).map((f) => `${dir}/${f.replace(/\.html$/, "")}`) : [];
};
const SCOPE = [...PAGES, ...folderPages("team"), ...folderPages("guide"), ...folderPages("calculators")];

// مصادر vercel.json كتعابير نمطية (path-to-regexp مبسّطة: :name و (a|b) و *).
function sourceToRegExp(src) {
  const re = src
    .replace(/[.+?^${}[\]\\]/g, (c) => (c === "(" || c === ")" || c === "|" ? c : "\\" + c))
    .replace(/:[A-Za-z_]+\(([^)]*)\)/g, "($1)")
    .replace(/:[A-Za-z_]+\*/g, ".*")
    .replace(/:[A-Za-z_]+/g, "[^/]+")
    .replace(/\*/g, ".*");
  try { return new RegExp("^" + re + "/?$"); } catch { return null; }
}
const ROUTE_RES = [...(VERCEL.redirects || []), ...(VERCEL.rewrites || [])]
  .map((r) => sourceToRegExp(r.source)).filter(Boolean);

function resolves(href) {
  const p = href.split("#")[0].split("?")[0];
  if (!p || p === "/") return true;
  const rel = p.replace(/^\/+/, "").replace(/\/$/, "");
  if (/\.[a-z0-9]+$/i.test(rel) && existsSync(join(SITE, rel))) return true;
  if (existsSync(join(SITE, rel + ".html"))) return true;
  if (existsSync(join(SITE, rel, "index.html"))) return true;
  return ROUTE_RES.some((re) => re.test("/" + rel));
}

function internalLinks(html) {
  const out = new Set();
  for (const m of html.matchAll(/<a\s[^>]*href="([^"]+)"/g)) {
    const h = m[1];
    if (/^(https?:|mailto:|tel:|#|javascript:|data:)/i.test(h)) continue;
    out.add(h);
  }
  return [...out];
}

test("صفحات النطاق: كل رابط داخلي يصل إلى صفحة موجودة", () => {
  const dead = [];
  let pages = 0;
  for (const lang of LANGS) {
    for (const page of SCOPE) {
      const file = join(SITE, lang, page + ".html");
      if (!existsSync(file)) continue;
      pages++;
      for (const href of internalLinks(readFileSync(file, "utf8"))) {
        if (!resolves(href)) dead.push(`${lang || "en"}/${page} → ${href}`);
      }
    }
  }
  assert.ok(pages >= 60, `صفحات النطاق المفحوصة قليلة (${pages}) — هل تغيّرت بنية site/؟`);
  assert.deepEqual(dead, [], "روابط ميتة في صفحات الموقع العام:\n" + dead.join("\n"));
});

test("روابط #مرساة في صفحات النطاق لها هدف في الصفحة نفسها", () => {
  const broken = [];
  for (const lang of LANGS) {
    for (const page of SCOPE) {
      const file = join(SITE, lang, page + ".html");
      if (!existsSync(file)) continue;
      const html = readFileSync(file, "utf8");
      const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
      for (const m of html.matchAll(/href="#([^"]+)"/g)) {
        if (!ids.has(m[1])) broken.push(`${lang || "en"}/${page} → #${m[1]}`);
      }
    }
  }
  assert.deepEqual(broken, [], "مراسٍ بلا هدف:\n" + broken.join("\n"));
});

test("نموذج التواصل يُرسَل كتذكرة دعم إلى /api/requests ولا يعلن النجاح قبل رد الخادم", () => {
  const js = readFileSync(join(SITE, "assets", "js", "main.js"), "utf8");
  const i = js.indexOf('document.getElementById("contact-form")');
  assert.ok(i > 0, "لم يُعثر على معالج contact-form في main.js");
  const block = js.slice(i, i + 6000);
  assert.match(block, /type:\s*"support-ticket"/, "نوع الطلب يجب أن يكون support-ticket (غيره يسقط 400 في الخادم)");
  assert.match(block, /fetch\("\/api\/requests"/);
  assert.match(block, /res\.s === 200 && res\.d\.ok === true/, "رسالة النجاح تظهر فقط بعد ok:true");
  for (const lang of LANGS) {
    const f = join(SITE, lang, "contact.html");
    if (!existsSync(f)) continue;
    const html = readFileSync(f, "utf8");
    assert.match(html, /id="contact-form"/, `${lang || "en"}/contact بلا نموذج`);
    assert.match(html, /data-msg-ok="[^"]+"/, `${lang || "en"}/contact بلا نص النجاح`);
    assert.match(html, /id="f-email"[^>]*required/, `${lang || "en"}/contact: البريد غير إلزامي`);
  }
});

test("نموذج النشرة: يرسل إلى /api/newsletter ويعرض الخطأ لا النجاح عند فشل الخادم", () => {
  const js = readFileSync(join(SITE, "assets", "js", "sv1-knowledge.js"), "utf8");
  assert.match(js, /fetch\("\/api\/newsletter"/);
  assert.match(js, /if \(d && d\.ok\)/, "النجاح مشروط بـ d.ok");
  for (const lang of LANGS) {
    const f = join(SITE, lang, "newsletter.html");
    if (!existsSync(f)) continue;
    const html = readFileSync(f, "utf8");
    assert.match(html, /<form[^>]*data-nl/, `${lang || "en"}/newsletter بلا نموذج data-nl`);
    assert.match(html, /sv1-knowledge\.js/, `${lang || "en"}/newsletter لا يحمّل sv1-knowledge.js`);
  }
});
