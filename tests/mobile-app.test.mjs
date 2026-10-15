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
  assert.doesNotMatch(src, /\bfetch\(|XMLHttpRequest|sendBeacon/, "الجسر لا يتصل بالشبكة بنفسه");
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
