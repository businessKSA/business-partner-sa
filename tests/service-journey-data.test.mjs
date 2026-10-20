// بيانات رحلة الخدمات: بنية site/data/service-journeys/ وقاعدة «ما لا مصدر له لا يُكتب».
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "site/assets/data/catalog.json"), "utf8"));
const site = JSON.parse(fs.readFileSync(path.join(ROOT, "site/data/site.json"), "utf8"));
const DIR = path.join(ROOT, "site/data/service-journeys");
const STATUS = ["needs_verification", "verified", "not_applicable"];
const claimsOf = (j) => ["authority", "duration", "documents", "gov_fees"].map((k) => [k, j[k]]);

test("لكل خدمة في الكتالوج ملف رحلة، ولا ملف بلا خدمة", () => {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", ""));
  const codes = catalog.services.map((s) => s.code.toLowerCase());
  assert.deepEqual(files.sort(), codes.sort());
});

test("كل ادّعاء له source_url وverified_at وstatus، والتحقق يتطلب مصدراً وتاريخاً", () => {
  for (const s of catalog.services) {
    const j = JSON.parse(fs.readFileSync(path.join(DIR, s.code.toLowerCase() + ".json"), "utf8"));
    assert.equal(j.code, s.code);
    for (const [k, c] of claimsOf(j)) {
      assert.ok(c, `${s.code}.${k}`);
      for (const f of ["source_url", "verified_at", "status"]) assert.ok(f in c, `${s.code}.${k}.${f}`);
      assert.ok(STATUS.includes(c.status), `${s.code}.${k} status=${c.status}`);
      if (c.status === "verified") {
        assert.match(c.source_url || "", /^https:\/\//, `${s.code}.${k} verified بلا مصدر`);
        assert.match(c.verified_at || "", /^\d{4}-\d{2}-\d{2}$/, `${s.code}.${k} verified بلا تاريخ`);
      } else {
        assert.equal(c.verified_at, null, `${s.code}.${k} تاريخ تحقق بلا status=verified`);
      }
    }
    for (const st of j.steps) {
      assert.ok(["client", "bp", "authority"].includes(st.actor), `${s.code} خطوة بلا منفّذ صحيح`);
      assert.ok(STATUS.includes(st.status));
    }
  }
});

test("لا اختراع: الجهة والمدة والمستندات منقولة من الكتالوج وsite.json كما هي", () => {
  for (const s of catalog.services) {
    const j = JSON.parse(fs.readFileSync(path.join(DIR, s.code.toLowerCase() + ".json"), "utf8"));
    const ov = site.overrides[s.code.toLowerCase()] || {};
    const hasAuth = s.govPlatform && !/بدون جهة/.test(s.govPlatform);
    assert.equal(j.authority.platform_ar, hasAuth ? s.govPlatform : null, s.code);
    assert.equal(j.duration.value_ar, ov.duration || null, s.code);
    assert.deepEqual(j.documents.items_ar, ov.documents || [], s.code);
    assert.equal(j.gov_fees.separate, !!s.govFeesSeparate, s.code);
  }
});

test("لا يحمل ملف رحلة سعراً ولا مبلغاً حكومياً (الأسعار من الكتالوج وحده)", () => {
  for (const f of fs.readdirSync(DIR)) {
    const txt = fs.readFileSync(path.join(DIR, f), "utf8");
    assert.doesNotMatch(txt, /"(price|amount|fee_amount|gov_fee_amount)"/, f);
  }
});
