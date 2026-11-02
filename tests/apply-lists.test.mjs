// قوائم نموذج التقديم (دول · مدن كل دولة · جنسيات · مهن) — site/assets/js/apply-lists.js
// والبيانات تحت site/assets/data/apply-lists/ (تُولَّد من site/scripts/gen-apply-lists.mjs).
//
// ما يُفحص:
//  ① البيانات: كل دول العالم بالعربي والإنجليزي، ولكل دولة ملف مدنها، والجنسيات أوصاف لا أسماء دول،
//     والمهن أكثر من ألف بلا تكرار، ولا حروف فارسية/كردية في الأسماء العربية.
//  ② الوحدة: تُحلَّل، لا تشير إلى شبكة خارجية، وتحمّل بياناتها من النطاق نفسه كسولاً.
//  ③ الصفحة: /job (٤ لغات) تحمّلها مؤجَّلةً بعد main.js.
//  ④ الخادم: /api/candidate يحفظ الدولة والمدينة والجنسية والمهنة كما يرسلها النموذج — بلا تعديلٍ فيه —
//     و«سعودي» المختارة من القائمة يقرؤها nationalityKind سعودياً.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const D = path.join(ROOT, "site/assets/data/apply-lists");
const J = (f) => JSON.parse(fs.readFileSync(path.join(D, f), "utf8"));
const countries = J("countries.json");
const profs = J("professions.json").p;

process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "bp-applylists-"));
process.env.NOTION_TOKEN = "test-token-never-leaves-this-process";
for (const k of ["AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_KEY", "AZURE_OPENAI_ENDPOINT_2", "RESEND_API_KEY", "LEADS_KEY", "N8N_WEBHOOK_URL"]) delete process.env[k];

test("الدول: كل دول العالم بالاسمين، وفيها الأساسية", () => {
  assert.ok(countries.c.length >= 230, "عدد الدول " + countries.c.length);
  const iso = new Map(countries.c.map((c) => [c[0], c]));
  for (const k of ["SA", "AE", "EG", "IN", "PK", "PH", "US", "GB", "FR", "DE", "CN", "JP", "BR", "ZA", "NG", "KE", "TR", "AU", "CA", "RU"]) assert.ok(iso.has(k), "ينقص " + k);
  for (const [code, en, ar] of countries.c) {
    assert.match(code, /^[A-Z]{2}$/);
    assert.ok(en && ar, code + " بلا اسمين");
    assert.match(ar, /[؀-ۿ]/, code + ": الاسم العربي بلا حروف عربية");
  }
  assert.equal(new Set(countries.c.map((c) => c[0])).size, countries.c.length, "رمز مكرّر");
  assert.equal(iso.get("SA")[2], "السعودية", "اسم السعودية كما اعتادته قاعدة المرشّحين");
  assert.deepEqual(countries.pin.slice(0, 3), ["SA", "AE", "KW"], "السعودية فالخليج أولاً");
});

test("الجنسيات: صفاتٌ إثنية لا أسماء دول، لكل دولة ذات سيادة", () => {
  const nat = countries.c.filter((c) => c[3]);
  assert.ok(nat.length >= 200, "عدد الجنسيات " + nat.length);
  const by = new Map(nat.map((c) => [c[0], c]));
  assert.deepEqual([by.get("SA")[3], by.get("SA")[4]], ["Saudi", "سعودي"]);
  assert.deepEqual([by.get("IN")[3], by.get("IN")[4]], ["Indian", "هندي"]);
  assert.deepEqual([by.get("PH")[3], by.get("PH")[4]], ["Filipino", "فلبيني"]);
  assert.deepEqual([by.get("BD")[3], by.get("BD")[4]], ["Bangladeshi", "بنغلاديشي"]);
  for (const c of nat) assert.match(c[4], /[؀-ۿ]/, c[0] + " جنسية بلا عربي");
});

test("المهن: أكثر من ألف بلا تكرار وفيها الشائعة", () => {
  assert.ok(profs.length >= 1000, "عدد المهن " + profs.length);
  const ar = new Set(profs.map((p) => p[1])), en = new Set(profs.map((p) => p[0].toLowerCase()));
  assert.equal(ar.size, profs.length, "اسم عربي مكرّر");
  assert.equal(en.size, profs.length, "اسم إنجليزي مكرّر");
  for (const need of ["محاسب", "مهندس مدني", "سائق خاص", "ممرض/ة", "عاملة منزلية", "كهربائي", "طباخ"]) {
    assert.ok(profs.some((p) => p[1].includes(need.replace("/ة", ""))), "تنقص مهنة: " + need);
  }
});

test("المدن: ملفٌّ لكل دولة، والسعودية كاملة المراكز، ولا حروف غير عربية في الأسماء العربية", () => {
  const files = new Set(fs.readdirSync(path.join(D, "cities")).map((f) => f.replace(".json", "")));
  const missing = countries.c.map((c) => c[0]).filter((c) => !files.has(c));
  assert.ok(missing.length <= 6, "دول بلا مدن: " + missing.join(","));
  for (const f of files) assert.ok(countries.c.some((c) => c[0] === f), "ملف مدنٍ ليتيم: " + f);
  const sa = J("cities/SA.json");
  assert.ok(sa.length >= 150, "مدن السعودية " + sa.length);
  const flat = new Map(sa.map((r) => (typeof r === "string" ? [r, ""] : r)));
  assert.equal(flat.get("Riyadh"), "الرياض");
  assert.equal(flat.get("Mecca"), "مكة المكرمة");
  assert.equal(sa.filter((r) => Array.isArray(r) && /مكة/.test(r[1])).length, 1, "مكة مكرّرة");
  for (const f of ["SA", "EG", "AE", "IN", "US", "PK", "PH"]) {
    const rows = J("cities/" + f + ".json");
    assert.ok(rows.length >= 20, f + " قليلة: " + rows.length);
    for (const r of rows) {
      const arName = Array.isArray(r) ? r[1] : "";
      assert.ok(!/[کگپچژیەھ]/.test(arName), f + ": حرف غير عربي في " + arName);
    }
  }
  const eg = J("cities/EG.json");
  assert.ok(eg.some((r) => Array.isArray(r) && r[1] === "القاهرة"));
});

test("حجم الدفعة: الملفات الكسولة خفيفة", () => {
  assert.ok(fs.statSync(path.join(D, "countries.json")).size < 30_000);
  assert.ok(fs.statSync(path.join(D, "professions.json")).size < 100_000);
  for (const f of fs.readdirSync(path.join(D, "cities"))) assert.ok(fs.statSync(path.join(D, "cities", f)).size < 80_000, f);
});

test("الوحدة: تُحلَّل، بلا شبكة خارجية، وتحمّل من النطاق نفسه", () => {
  const src = fs.readFileSync(path.join(ROOT, "site/assets/js/apply-lists.js"), "utf8");
  new vm.Script(src);
  assert.ok(!/https?:\/\//.test(src.replace(/\/\*[\s\S]*?\*\//g, "")), "الوحدة تشير إلى رابطٍ خارجي");
  assert.ok(src.includes('"/assets/data/apply-lists/"'));
  for (const id of ["c-country", "c-city", "c-nationality", "c-field"]) assert.ok(src.includes('"' + id + '"'), id);
});

test("الصفحة: /job بأربع لغات تحمّل الوحدة مؤجَّلةً بعد main.js", () => {
  for (const p of ["job.html", "ar/job.html", "fr/job.html", "zh/job.html"]) {
    const h = fs.readFileSync(path.join(ROOT, "site", p), "utf8");
    const m = h.indexOf("/assets/js/main.js"), a = h.indexOf("/assets/js/apply-lists.js");
    assert.ok(a > 0, p + ": الوحدة غير محمّلة");
    assert.ok(m > 0 && a > m, p + ": يجب أن تأتي بعد main.js");
    assert.match(h.slice(a, a + 120), /defer/, p + ": بلا defer");
    for (const id of ["c-country", "c-city", "c-nationality", "c-field"]) assert.ok(h.includes('id="' + id + '"'), p + " ينقصه " + id);
  }
});

test("الخادم: /api/candidate يحفظ الدولة والمدينة والجنسية والمهنة كما يرسلها النموذج", async () => {
  let created = null;
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url), body = init.body ? JSON.parse(init.body) : {};
    if (u.startsWith("https://api.notion.com/v1/databases/") && u.endsWith("/query")) return json({ results: [], has_more: false });
    if (u === "https://api.notion.com/v1/pages" && init.method === "POST") { created = body.properties; return json({ id: "page-1" }); }
    return json({ ok: true, results: [] });
  };
  const handler = (await import("../api/candidate.js")).default;
  const { nationalityKind } = await import("../api/candidate.js");
  const iso = new Map(countries.c.map((c) => [c[0], c]));
  const post = async (payload) => {
    created = null;
    let out = "", status = 0;
    const res = { setHeader() {}, set statusCode(v) { status = v; }, get statusCode() { return status; }, end(b) { out = b; } };
    await handler({ method: "POST", url: "/api/candidate", headers: {}, body: payload, on() {} }, res);
    return { status: status || 200, data: JSON.parse(out) };
  };
  const base = { name: "مرشّح اختبار", phone: "+966500000001", email: "applylists@example.com", experience: "5+ سنوات", residenceStatus: "خارج السعودية", salary: "8000", consent: true, jobId: "candidate-pool", jobTitle: "قاعدة المرشحين العامة" };

  // ما تُنتجه القائمة في صفحة عربية: دولة ومدينة وجنسية ومهنة بالعربي
  const r1 = await post({ ...base, country: iso.get("EG")[2], city: "الإسكندرية", nationality: iso.get("EG")[4], field: "مهندس مدني" });
  assert.equal(r1.status, 200, JSON.stringify(r1.data));
  assert.ok(created, "لم يُنشأ صفّ في Notion");
  const txt = (p) => (p && p.rich_text ? p.rich_text.map((x) => x.text.content).join("") : "");
  assert.equal(txt(created["Country"]), "مصر");
  assert.equal(txt(created["City"]), "الإسكندرية");
  assert.equal(txt(created["Nationality"]), "مصري");
  assert.equal(created["Target Role"].select.name, "مهندس مدني");

  // وفي صفحة إنجليزية
  const r2 = await post({ ...base, email: "applylists2@example.com", country: iso.get("PH")[1], city: "Cebu City", nationality: iso.get("PH")[3], field: "Nurse" });
  assert.equal(r2.status, 200);
  assert.equal(txt(created["Country"]), "Philippines");
  assert.equal(txt(created["City"]), "Cebu City");
  assert.equal(txt(created["Nationality"]), "Filipino");
  assert.equal(created["Target Role"].select.name, "Nurse");

  // «أخرى»: نصٌّ حرّ لا يوجد في القائمة يُحفظ كما كُتب
  const r3 = await post({ ...base, email: "applylists3@example.com", country: "جمهورية أرض الصومال", city: "هرجيسا الجديدة", nationality: "صومالي", field: "مدرّب سباحة للأطفال" });
  assert.equal(r3.status, 200);
  assert.equal(txt(created["City"]), "هرجيسا الجديدة");
  assert.equal(created["Target Role"].select.name, "مدرّب سباحة للأطفال");

  // الجنسية المختارة من القائمة تُقرأ سعودية بالاسمين
  assert.equal(nationalityKind(iso.get("SA")[4], "خارج السعودية"), "سعودي");
  assert.equal(nationalityKind(iso.get("SA")[3], "خارج السعودية"), "سعودي");
  assert.equal(nationalityKind(iso.get("IN")[4], "خارج السعودية"), "غير سعودي");
});
