// فحص سريع قبل أي بناء للمتجرين: يفشل (exit 1) إن كان الإعداد يخالف قرارات المالك.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(readFileSync(path.join(root, "capacitor.config.json"), "utf8"));
const errs = [];

if (cfg.appId !== "sa.businesspartner.app") errs.push(`appId غير متوقع: ${cfg.appId} — تغييره بعد أول رفع يعني تطبيقاً جديداً في المتجر`);
if (!/^https:\/\/businesspartner\.sa\/?$/.test(cfg.server?.url || "")) errs.push("server.url يجب أن يكون https://businesspartner.sa/ (لا localhost ولا معاينة)");
if (cfg.server?.cleartext) errs.push("cleartext ممنوع في الإنتاج");
if (cfg.android?.allowMixedContent) errs.push("allowMixedContent ممنوع في الإنتاج");
if (cfg.android?.webContentsDebuggingEnabled) errs.push("webContentsDebuggingEnabled يجب أن يكون false");
if (!existsSync(path.join(root, "www", cfg.server?.errorPath || "offline.html"))) errs.push("صفحة عدم الاتصال (errorPath) غير موجودة في www/");
if (!existsSync(path.join(root, "www", "index.html"))) errs.push("www/index.html مطلوب لـ cap sync");
for (const f of ["icon-only.png", "icon-foreground.png", "icon-background.png", "splash.png"]) {
  if (!existsSync(path.join(root, "resources", f))) errs.push(`resources/${f} مفقود — شغّل npm run assets`);
}
if (!/BusinessPartnerApp\//.test(cfg.appendUserAgent || "")) errs.push("appendUserAgent يجب أن يحمل BusinessPartnerApp/ ليتعرّف الخادم على التطبيق");

if (errs.length) {
  console.error("✗ mobile/ check failed:\n - " + errs.join("\n - "));
  process.exit(1);
}
console.log("✓ mobile/ config OK —", cfg.appId, "→", cfg.server.url, "| push:", /\bbp-push\b/.test(cfg.appendUserAgent) ? "ON" : "off (ينتظر Firebase/APNs)");
