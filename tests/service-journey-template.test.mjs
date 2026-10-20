// قالب صفحة الخدمة: رحلة الطلب لا تُعرض إلا موثّقة، ولا تمسّ السلة ولا السعر.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildSimpleServiceDetail, isVerified, loadJourney } from "../site/scripts/simple-v1-service-detail.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const SV1 = { href: (p) => p, header: () => "<header/>", footer: () => "<footer/>", shell: ({ body, script }) => body + script };
const view = (over = {}) => ({
  code: "BP-ABSHER-01", slug: "bp-absher-01", name: "تفعيل أبشر أعمال", nameEn: "Absher Business Setup", nameAr: "تفعيل أبشر أعمال",
  cartId: "svc-bp-absher-01", desc: "وصف", category: "Government Relations", catLabel: "العلاقات الحكومية", catHref: "/services/category/x",
  gov: "أبشر أعمال", duration: "يوم", docs: ["السجل"], docsGeneric: false, feats: [], faq: [],
  priced: true, amount: 300, priceLabel: "300 ﷼", priceNote: "", govFeesSeparate: true, requiresProposal: false, special: "",
  hrefs: { consult: "/c" }, title: "t", seoDesc: "d", liveV: "1", ...over,
});
const build = (lang, v) => buildSimpleServiceDetail(SV1, { lang: () => lang, esc }, v);

const GOOD = { actor: "authority", title_ar: "تدقق الجهة الطلب", title_en: "The authority reviews", duration_ar: "يوم", status: "verified", source_url: "https://example.gov.sa/x", verified_at: "2026-10-20" };

test("isVerified يطلب status وhttps وتاريخاً معاً", () => {
  assert.equal(isVerified(GOOD), true);
  assert.equal(isVerified({ ...GOOD, status: "needs_verification" }), false);
  assert.equal(isVerified({ ...GOOD, source_url: null }), false);
  assert.equal(isVerified({ ...GOOD, source_url: "http://x.gov.sa" }), false);
  assert.equal(isVerified({ ...GOOD, verified_at: null }), false);
  assert.equal(isVerified(null), false);
});

test("الملفات المزروعة (بحاجة تحقق) لا تُظهر قسم الخطوات ولا سطر مصدر", () => {
  const html = build("ar", view());
  assert.doesNotMatch(html, /sv1-svc-steps/);
  assert.doesNotMatch(html, /<ul class="sv1-svc-src"/);
  assert.match(html, /id="svcAdd"/);
  assert.ok(loadJourney("BP-ABSHER-01"));
});

test("خطوة موثّقة تُعرض بمنفّذها ومصدرها وتاريخها، وغير الموثّقة لا تُعرض", async () => {
  // ‏مجلد مؤقت (BP_JOURNEYS_DIR) حتى لا تُكتب بيانات المستودع أثناء تشغيل الاختبارات بالتوازي.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sj-"));
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, "site/data/service-journeys/bp-absher-01.json"), "utf8"));
  j.steps = [GOOD, { ...GOOD, title_ar: "غير موثّقة", status: "needs_verification" }];
  fs.writeFileSync(path.join(tmp, "bp-absher-01.json"), JSON.stringify(j));
  process.env.BP_JOURNEYS_DIR = tmp;
  try {
    const m = await import("../site/scripts/simple-v1-service-detail.mjs?fresh=" + Date.now());
    const ar = m.buildSimpleServiceDetail(SV1, { lang: () => "ar", esc }, view());
    assert.match(ar, /sv1-svc-steps/);
    assert.match(ar, /تدقق الجهة الطلب/);
    assert.doesNotMatch(ar, /غير موثّقة/);
    assert.match(ar, /href="https:\/\/example\.gov\.sa\/x"/);
    assert.match(ar, /2026-10-20/);
    // ‏الفرنسية بلا title_fr: لا إنجليزية في صفحة فرنسية، فيسقط القسم كله.
    const fr = m.buildSimpleServiceDetail(SV1, { lang: () => "fr", esc }, view());
    assert.doesNotMatch(fr, /sv1-svc-steps/);
    // ‏السلة والسعر لم يتغيّرا.
    assert.match(ar, /data-amount="300"/);
    assert.match(ar, /data-id="svc-bp-absher-01"/);
  } finally {
    delete process.env.BP_JOURNEYS_DIR;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("مسعّرة وrequiresProposal: شراء مباشر بلا زر عرض سعر، وبعد الدفع تظهر الخطوات", () => {
  const v = view({ requiresProposal: true, docsGeneric: false, duration: "يوم" });
  for (const lang of ["ar", "en", "fr", "zh"]) {
    const h = build(lang, v);
    assert.match(h, /id="svcAdd"/, lang);
    assert.doesNotMatch(h, /id="svcQuote"/, lang);
    assert.match(h, /sv1-svc-after/, lang);
    assert.match(h, /data-amount="300"/, lang);
  }
  assert.match(build("ar", v), /ترفع المستندات المطلوبة/);
  assert.match(build("ar", view({ requiresProposal: true, docsGeneric: true })), /إن لزمت مستندات/);
});

test("خدمة مسعّرة: سؤال يَعِد بعرض مخصّص يسقط، وغير المسعّرة تبقى كما هي", () => {
  const faq = [{ q: "كيف تُحدَّد الأتعاب؟", a: "نحدّد الأتعاب بعرض مخصّص — احجز استشارة أو اطلب عرضاً." }, { q: "هل أحتاج وكالة؟", a: "لا." }];
  const priced = build("ar", view({ faq, requiresProposal: true }));
  assert.doesNotMatch(priced, /عرض مخصّص/);
  assert.match(priced, /هل أحتاج وكالة/);
  const unpriced = build("ar", view({ faq, priced: false, amount: null }));
  assert.match(unpriced, /عرض مخصّص/);
  assert.doesNotMatch(build("ar", view({ priced: false, amount: null })), /sv1-svc-after/);
});
