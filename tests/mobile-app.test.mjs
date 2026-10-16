// حرّاس تطبيق الجوال (mobile/): الإعداد، وربط الجسر في الموضعين، وأنه لا يعمل خارج التطبيق.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("mobile: فحص الإعداد يمرّ", () => {
  const r = spawnSync(process.execPath, ["mobile/scripts/check-config.mjs"], { cwd: new URL("../", import.meta.url), encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

test("mobile: الجسر مربوط في SV1.shell و main.js (قاعدة الموضعين)", () => {
  assert.match(read("site/scripts/simple-v1.mjs"), /app-bridge\.js/);
  assert.match(read("site/assets/js/main.js"), /app-bridge\.js/);
});

test("mobile: الجسر لا يفعل شيئاً خارج Capacitor الأصلي", () => {
  const src = read("site/assets/js/app-bridge.js");
  // الحارس يجب أن يسبق أي لمس لـDOM.
  const guard = src.indexOf("isNativePlatform()) return;");
  const firstDom = src.indexOf("document.");
  assert.ok(guard > 0, "حارس isNativePlatform مفقود");
  assert.ok(guard < firstDom, "الحارس يجب أن يسبق أول لمسة لـdocument");
  assert.doesNotMatch(src, /XMLHttpRequest|sendBeacon/, "الجسر لا يستعمل غير fetch");
  // الاتصال الوحيد المسموح: POST إلى /api/otp من الأصل نفسه (الدخول والجلسة).
  const urls = [...src.matchAll(/fetch\(\s*("[^"]*"|'[^']*'|[A-Za-z_.]+)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(urls)], ['"/api/otp"'], "الجسر يتصل بـ/api/otp وحده");
});

test("mobile: الإشعارات لا تُفعَّل بلا علامة bp-push (register بلا Firebase يُسقط Android)", () => {
  const src = read("site/assets/js/app-bridge.js");
  assert.match(src, /\\bbp-push\\b/);
  const cfg = JSON.parse(read("mobile/capacitor.config.json"));
  assert.doesNotMatch(cfg.appendUserAgent, /bp-push/, "لا تفعّل الإشعارات قبل وضع google-services.json وإعداد APNs");
});

test("mobile: أسرار التوقيع لا تُدفع", () => {
  const ig = read("mobile/.gitignore");
  for (const pat of ["*.jks", "*.keystore", "google-services.json", "local.properties"]) {
    assert.ok(ig.includes(pat), `mobile/.gitignore يجب أن يتجاهل ${pat}`);
  }
});

test("mobile: الفوتر مخفي داخل التطبيق فقط (قرار المالك 2026-10-15: تطبيق لا موقع)", () => {
  const src = read("site/assets/js/app-bridge.js");
  assert.match(src, /html\.bp-native footer\.sv1-foot/);
});

test("mobile: الدخول إجباري والتطبيق محادثة فقط (قرار المالك 2026-10-15)", () => {
  const src = read("site/assets/js/app-bridge.js");
  assert.match(src, /password-login/, "دخول كلمة المرور");
  assert.match(src, /else showLogin\(\);/, "بلا جلسة تظهر البوابة (لا مسار يتجاوزها غير الصفحات العامة)");
  assert.match(src, /html\.bp-chat main>section:not\(#advisor\)/, "وضع المحادثة يخفي ما عدا المحادثة");
  // الشريط السفلي للعميل: المحادثة · الخدمات · السلة · حسابي (طلب المالك 2026-10-15)
  assert.match(src, /\["chat", "\/"/);
  assert.match(src, /\["svc", "\/catalog"/);
  assert.match(src, /\["cart", "\/cart"/);
  assert.match(src, /\["me", "\/my"/);
  assert.match(src, /tabBar\(\);\n    pushBanner/, "الشريط يُبنى بعد الدخول فقط");
  // شاشة الدخول: جوجل ظاهر دائماً (يصرّح إن لم يُفعَّل) + إنشاء حساب، ولا رابط «ادخل برمز» (طلب المالك)
  assert.match(src, /g\.onclick = function \(\) \{ googleLogin\(err\); \}/);
  assert.match(src, /!methods\.google \|\| !SL \|\| !SL\.login/, "جوجل غير المفعّل يصرّح بدل الفشل الصامت");
  assert.match(src, /stepSignupEmail/);
  assert.doesNotMatch(src, /first\.onclick|T\.first\b/, "لا رابط «أول مرة… ادخل برمز»");
});

test("mobile: قسم «عن التطبيق» لا يخترع رابط خصوصية قبل وجود صفحته", () => {
  const src = read("site/assets/js/app-bridge.js");
  assert.match(src, /var PRIVACY_PATH = (null|"\/[a-z-]+");/);
  if (/var PRIVACY_PATH = null;/.test(src)) return;
  const m = src.match(/var PRIVACY_PATH = "(\/[a-z-]+)";/);
  assert.ok(m, "PRIVACY_PATH بصيغة غير متوقعة");
});
