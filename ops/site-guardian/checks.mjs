// حارس الموقع — الفحوص البحتة (بلا شبكة ولا متصفح). تُستعمل من run.mjs (متصفح كامل) ومن سير n8n (HTTP فقط):
// كل دالة هنا مكتفية بذاتها (لا مراجع خارجية) لأن build-site-guardian.mjs يحقن fn.toString() في عقد Code. لا أسرار هنا.
// الشدّة: critical = رحلة الشراء أو الموقع نفسه معطّل / وضع اختبار على الإنتاج؛ major = صفحة مكسورة أو خطأ على صفحة شراء؛ minor = محتوى/تصميم.

export const PUBLIC_PAGES = ["/", "/catalog", "/packages", "/cart", "/checkout", "/my", "/contact", "/about", "/terms", "/careers", "/quote"];
export const PURCHASE_PAGES = ["/catalog", "/cart", "/checkout", "/packages"];
export const BRAND = { navy: "#0B1B5A", navy2: "#16307F", ink: "#232A3D", bg: "#F5F7FB", line: "#E5E9F0" };

// ---- 1) محتوى صفحة HTML (سياسات CLAUDE.md §4) -> findings[]
export function contentFindings(path, html, opts) {
  const o = opts || {};
  const h = String(html == null ? "" : html);
  const f = [];
  const add = (severity, code, msg) => f.push({ severity, code, path, msg });
  if (!h.trim()) { add("critical", "empty-page", "الصفحة فارغة"); return f; }
  const text = h.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  if (/شريك\s*الأعمال|شريك\s*أعمالك/.test(text)) add("minor", "brand-name", "اسم العلامة يجب «Business Partner» لا «شريك الأعمال» (قرار 2026-09-04)");
  if (/\bundefined\b|\bNaN\b|\[object Object\]|\{\{\s*[\w.]+\s*\}\}|\bnull\b(?=\s*(ريال|SAR|\d))/.test(text)) add("major", "template-leak", "نص برمجي ظاهر للزائر (undefined/NaN/[object Object]/{{ }})");
  if (/lorem ipsum|TODO|FIXME|XXX\b/i.test(text)) add("minor", "placeholder-text", "نص تجريبي أو TODO ظاهر");
  if (!/<title>[^<]{3,}<\/title>/i.test(h)) add("minor", "no-title", "لا عنوان للصفحة");
  if (!/<meta[^>]+name=["']description["'][^>]+content=["'][^"']{20,}/i.test(h)) add("minor", "no-description", "لا وصف ميتا");
  const h1 = (h.match(/<h1[\s>]/gi) || []).length;
  if (h1 === 0) add("minor", "no-h1", "لا عنوان رئيسي h1");
  if (h1 > 1) add("minor", "multi-h1", "أكثر من h1 (" + h1 + ")");
  if (/<meta[^>]+name=["']robots["'][^>]+noindex/i.test(h) && !o.allowNoindex) add("major", "noindex", "الصفحة العامة موسومة noindex");
  const lang = (h.match(/<html[^>]*\blang=["']([a-z-]+)["']/i) || [])[1] || "";
  const dir = (h.match(/<html[^>]*\bdir=["'](rtl|ltr)["']/i) || [])[1] || "";
  if (!lang) add("minor", "no-lang", "html بلا lang");
  if (lang === "ar" && dir !== "rtl") add("major", "rtl", "صفحة عربية بلا dir=rtl");
  if (lang && lang !== "ar" && dir === "rtl") add("minor", "rtl-mismatch", "صفحة غير عربية باتجاه rtl");
  // وضع الاختبار على الإنتاج: الشريط يظهر بحسب config، لكن الوسم يبقى في الصفحة؛ نفحص الإعدادات في configFindings
  // الأسعار للمسجّلين فقط (SHOW_PRICES=false): الوسم data-prices="off" يجب أن يكون على html في الصفحات العامة
  if (o.pricesOff !== false && !/<html[^>]*data-prices=["']off["']/i.test(h) && !/<html[^>]*data-prices=["']on["']/i.test(h)) add("major", "prices-flag", "وسم سياسة الأسعار data-prices غائب (قد تظهر الأسعار للزائر)");
  // أزرار واتساب داخل المحتوى ممنوعة (الزر العائم وحده) — استثناء مشخّص الخدمة في /services/*
  if (!/^\/(?:[a-z]{2}\/)?services\//.test(path)) {
    const body = h.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "");
    const links = (body.match(/<a\b[^>]*href=["'][^"']*(?:wa\.me|api\.whatsapp\.com|whatsapp:\/\/)[^"']*["'][^>]*>/gi) || []).filter((a) => !/float|wa-fab|whatsapp-float|sv1-wa|bps-wa|data-float/i.test(a));
    if (links.length) add("minor", "inline-whatsapp", links.length + " رابط واتساب داخل المحتوى (المسموح الزر العائم فقط)");
  }
  const emptyLinks = (h.match(/<a\b[^>]*href=["'](?:#|javascript:[^"']*|)["']/gi) || []).length;
  if (emptyLinks > 3) add("minor", "dead-links", emptyLinks + " رابط بلا وجهة (# أو فارغ)");
  const imgs = h.match(/<img\b[^>]*>/gi) || [];
  const noAlt = imgs.filter((i) => !/\balt=/.test(i)).length;
  if (noAlt > 2) add("minor", "img-alt", noAlt + " صورة بلا alt");
  return f;
}

// ---- 2) إعدادات الموقع الحيّة (/api/simple?action=config) على الإنتاج
export function configFindings(cfg, env) {
  const f = []; const add = (severity, code, msg) => f.push({ severity, code, path: "/api/simple?action=config", msg });
  if (!cfg || typeof cfg !== "object" || cfg.ok === false) { add("critical", "config-unreadable", "إعدادات الموقع لا تُقرأ — المحرّك لا يردّ"); return f; }
  if ((env || "production") === "production") {
    if (cfg.testMode === true) add("critical", "test-mode-on-prod", "وضع الاختبار مفعّل على الإنتاج: العملاء يرون شريط TEST MODE والدفع/الرسائل وهمية");
    const m = cfg.modes || {};
    const bad = ["payments", "moyasar", "tamara", "whatsapp", "email"].filter((k) => /^(test|mock|preview|sandbox)$/i.test(String(m[k] == null ? "" : m[k])));
    if (bad.length) add("critical", "non-live-integration", "تكامل غير حيّ على الإنتاج: " + bad.map((k) => k + "=" + m[k]).join(" ، "));
    if (m.dev === true) add("critical", "dev-mode-on-prod", "وضع التطوير مفعّل على الإنتاج");
  }
  return f;
}

// ---- 2ب) الكتالوج الحيّ (/api/live-catalog) مقابل ما في المستودع (اختياري)
export function catalogFindings(live, repo) {
  const f = []; const add = (severity, code, msg) => f.push({ severity, code, path: "/api/live-catalog", msg });
  const list = live && Array.isArray(live.services) ? live.services : null;
  if (!list || !list.length) { add("critical", "catalog-empty", "الكتالوج الحيّ فارغ أو لا يُقرأ — لا شيء يُشترى"); return f; }
  const seen = new Set(); const dup = [], noName = [], badPrice = [];
  for (const s of list) {
    if (seen.has(s.code)) dup.push(s.code); seen.add(s.code);
    if (!s.nameAr && !s.nameEn) noName.push(s.code);
    if (!s.openPrice && !(typeof s.unitPrice === "number" && s.unitPrice > 0)) badPrice.push(s.code);
    if (s.unitPrice != null && typeof s.unitPrice !== "number") badPrice.push(s.code);
  }
  if (dup.length) add("major", "catalog-duplicate", dup.length + " رمز مكرر: " + dup.slice(0, 3).join(","));
  if (noName.length) add("major", "catalog-no-name", noName.length + " خدمة بلا اسم: " + noName.slice(0, 3).join(","));
  if (badPrice.length) add("major", "catalog-bad-price", badPrice.length + " خدمة بسعر غير صالح (0/نص/ناقص): " + Array.from(new Set(badPrice)).slice(0, 4).join(","));
  const rs = repo && Array.isArray(repo.services) ? repo.services : null;
  if (rs) {
    const liveCodes = new Set(list.map((s) => s.code));
    const missing = rs.filter((s) => s.code && !liveCodes.has(s.code)).map((s) => s.code);
    const priceDrift = rs.filter((s) => { const l = list.find((x) => x.code === s.code); return l && typeof s.unitPrice === "number" && typeof l.unitPrice === "number" && l.unitPrice !== s.unitPrice; }).map((s) => s.code);
    if (missing.length) add("minor", "catalog-drift-missing", missing.length + " خدمة في المستودع غائبة عن الموقع الحيّ: " + missing.slice(0, 4).join(","));
    if (priceDrift.length) add("major", "catalog-price-drift", priceDrift.length + " خدمة سعرها في الموقع الحيّ يخالف المستودع: " + priceDrift.slice(0, 4).join(","));
  }
  return f;
}

// ---- 3) مقاييس صفحة من المتصفح (run.mjs يجمعها) -> findings[]
// m: { path, viewport:'mobile'|'desktop', overflowX, brokenImages:[], consoleErrors:[], pageErrors:[], failedRequests:[], lowContrast:[{text,ratio}], tinyTargets:n, logo:boolean, status }
export function designFindings(m) {
  const f = []; const add = (severity, code, msg) => f.push({ severity, code, path: m.path + " (" + m.viewport + ")", msg });
  const purchase = ["/catalog", "/cart", "/checkout", "/packages"].some((p) => m.path === p || m.path.endsWith(p));
  if (m.status >= 500) add("critical", "http-5xx", "الصفحة ترجع " + m.status);
  else if (m.status >= 400) add("major", "http-4xx", "الصفحة ترجع " + m.status);
  if (m.overflowX > 4) add(m.viewport === "mobile" ? "major" : "minor", "overflow-x", "تمرير أفقي بمقدار " + m.overflowX + "px (عنصر أوسع من الشاشة)");
  if ((m.brokenImages || []).length) add("major", "broken-images", (m.brokenImages || []).length + " صورة مكسورة: " + m.brokenImages.slice(0, 2).join(" , "));
  if ((m.pageErrors || []).length) add(purchase ? "critical" : "major", "js-exception", "خطأ جافاسكربت: " + String(m.pageErrors[0]).slice(0, 120));
  if ((m.consoleErrors || []).length) add(purchase ? "major" : "minor", "console-error", m.consoleErrors.length + " خطأ في الكونسول: " + String(m.consoleErrors[0]).slice(0, 120));
  const real = (m.failedRequests || []).filter((u) => !/google-analytics|googletagmanager|facebook|doubleclick|hotjar|clarity\.ms|tiktok|snap(chat)?\.com|linkedin|\/collect|analytics/i.test(u));
  if (real.length) add("major", "failed-requests", real.length + " طلب فاشل: " + real.slice(0, 2).join(" , "));
  if ((m.lowContrast || []).length) add("minor", "contrast", (m.lowContrast || []).length + " عنصر تباينه أقل من 4.5: «" + String(m.lowContrast[0].text).slice(0, 30) + "» (" + m.lowContrast[0].ratio + ")");
  if (m.viewport === "mobile" && m.tinyTargets > 30) add("minor", "tap-targets", m.tinyTargets + " عنصر ضغط أصغر من 32px على الجوال");
  if (m.logo === false) add("major", "logo-missing", "الشعار لا يظهر");
  return f;
}

// نسبة التباين بين لونين rgb(r,g,b) — تُستعمل داخل المتصفح أيضاً
export function contrastRatio(fg, bg) {
  const lum = (c) => { const v = c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const a = lum(fg), b = lum(bg); const hi = Math.max(a, b), lo = Math.min(a, b);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

// ---- 4) الرحلة: خطوات {name, ok, detail, severity?} -> findings[]
export function journeyFindings(steps, label) {
  const f = [];
  for (const s of Array.isArray(steps) ? steps : []) if (!s.ok) f.push({ severity: s.severity || "critical", code: "journey-" + String(s.id || s.name).replace(/\s+/g, "-"), path: "رحلة العميل" + (label ? " — " + label : ""), msg: "تعطّلت الخطوة «" + s.name + "»: " + String(s.detail || "").slice(0, 200) });
  return f;
}

// ---- 5) ملخص التقرير + بصمة كل عيب (لمنع تكرار التنبيه) + الحالة العامة
export function summarize(findings) {
  const list = (Array.isArray(findings) ? findings : []).map((x) => ({ ...x, fp: x.code + "|" + x.path }));
  const by = { critical: 0, major: 0, minor: 0 };
  for (const x of list) by[x.severity] = (by[x.severity] || 0) + 1;
  const status = by.critical ? "down" : by.major ? "degraded" : "ok";
  return { status, counts: by, findings: list, fingerprints: list.map((x) => x.fp) };
}

// ---- 6) قرار التنبيه: عيب يُنبَّه به إذا ظهر في فحصين متتاليين (لا ضجيج من تعثّر لحظي)، ويُبلَّغ بالتعافي مرة
// state: { seen: {fp: count} , alerted: {fp: ts} }  -> { alerts:[findings], recovered:[fp], state }
export function alertDecision(findings, state, now, opts) {
  const o = opts || {};
  const need = o.consecutive || 2, coolCrit = (o.cooldownMin || 360) * 60000, coolMajor = (o.majorCooldownMin || 1440) * 60000;
  const st = { seen: { ...((state && state.seen) || {}) }, alerted: { ...((state && state.alerted) || {}) } };
  const cur = new Set((findings || []).filter((x) => x.severity !== "minor").map((x) => x.fp || x.code + "|" + x.path));
  const alerts = [], recovered = [];
  for (const x of findings || []) {
    if (x.severity === "minor") continue;
    const fp = x.fp || x.code + "|" + x.path;
    st.seen[fp] = (st.seen[fp] || 0) + 1;
    const last = st.alerted[fp] || 0;
    if (st.seen[fp] >= need && now - last >= (x.severity === "critical" ? coolCrit : coolMajor)) { alerts.push({ ...x, fp }); st.alerted[fp] = now; }
  }
  for (const fp of Object.keys(st.seen)) if (!cur.has(fp)) { if (st.alerted[fp]) recovered.push(fp); delete st.seen[fp]; delete st.alerted[fp]; }
  return { alerts, recovered, state: st };
}

// ---- 7) صياغة رسالة المالك: مختصرة، بلا مصطلحات تقنية، سطر لكل عيب + من يصلحه
export function ownerMessage(alerts, recovered, ownerOf) {
  const who = typeof ownerOf === "function" ? ownerOf : () => "";
  const lines = [];
  if (alerts.length) {
    lines.push("🛡️ حارس الموقع — " + (alerts.some((a) => a.severity === "critical") ? "🔴 عطل يمسّ العملاء" : "🟠 خلل يحتاج إصلاحاً"));
    for (const a of alerts.slice(0, 5)) lines.push("• " + a.msg + " — " + a.path + (who(a) ? " (المسؤول: " + who(a) + ")" : ""));
    if (alerts.length > 5) lines.push("… و" + (alerts.length - 5) + " أخرى في التقرير.");
  }
  if (recovered.length) lines.push("✅ عاد سليماً: " + recovered.slice(0, 4).map((r) => r.split("|")[1] || r).join("، "));
  return lines.join("\n");
}

// ---- 8) من يصلح العيب (خريطة الملكية في docs/projects.md)
export function ownerOfFinding(x) {
  const p = String(x.path || ""), c = String(x.code || "");
  if (/test-mode|non-live|config-unreadable|dev-mode/.test(c)) return "platform-engineer";
  if (/^catalog-/.test(c)) return "catalog-content";
  if (/^journey-(add|cart|qty|checkout)/.test(c)) return "cart-checkout";
  if (/^journey-catalog/.test(c)) return "catalog-content";
  if (/^journey-my/.test(c)) return "client-portal";
  if (/^journey-home/.test(c)) return "public-site";
  if (/^journey-support/.test(c)) return "baher-support";
  if (/contrast|overflow|tap-targets|logo-missing|rtl/.test(c)) return "platform-engineer";
  if (/\/(?:[a-z]{2}\/)?(cart|checkout)\b/.test(p) || /journey-(add|cart|checkout|pay)/.test(c)) return "cart-checkout";
  if (/\/(?:[a-z]{2}\/)?(my|account)\b/.test(p)) return "client-portal";
  if (/\/(?:[a-z]{2}\/)?(catalog|services|packages)\b/.test(p)) return /packages/.test(p) ? "packages" : "catalog-content";
  if (/^\/(?:[a-z]{2}\/)?(about|contact|terms|careers|news)\b/.test(p) || /^\/(?:[a-z]{2})?(?:\s|$)/.test(p)) return "public-site";
  return "platform-engineer";
}
