// حارس الموقع — تشغيل الفحوص على موقع حيّ أو staging. للقراءة فقط: لا يرسل نموذجاً، لا يدفع، لا يسجّل دخولاً، لا يكتب في أي قاعدة.
//   node ops/site-guardian/run.mjs --base https://www.businesspartner.sa [--mode quick|full] [--out report.json] [--env production|staging]
// quick = HTTP فقط (سريع، يصلح لسير n8n)؛ full = + متصفح حقيقي: تصميم (جوال/سطح مكتب) + رحلة العميل حتى صفحة الدفع دون إرسال.
import fs from "fs";
import { PUBLIC_PAGES, contentFindings, configFindings, catalogFindings, designFindings, journeyFindings, summarize, ownerOfFinding, contrastRatio } from "./checks.mjs";

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = (arg("base", "") || "").replace(/\/$/, ""); if (!BASE) { console.error("usage: --base <url>"); process.exit(2); }
const MODE = arg("mode", "full"), OUT = arg("out", ""), ENV = arg("env", /www\.businesspartner\.sa$/.test(BASE) ? "production" : "staging");
const CHROME = process.env.GUARDIAN_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const findings = []; const log = (...a) => console.log(...a);
const get = async (path, ms = 30000) => { try { const r = await fetch(BASE + path, { redirect: "manual", signal: AbortSignal.timeout(ms), headers: { "user-agent": "BP-SiteGuardian/1.0" } }); return { status: r.status, text: await r.text(), ms: 0 }; } catch (e) { return { status: 0, text: "", error: e.message }; } };

// ---------- 1) HTTP: الصفحات والإعدادات والكتالوج
const t0 = Date.now();
for (const p of PUBLIC_PAGES) {
  const path = p === "/" ? "/ar" : "/ar" + p; // الواجهة العربية هي الأصل
  const s = Date.now(); const r = await get(path); const ms = Date.now() - s;
  if (r.status === 0) { findings.push({ severity: "critical", code: "page-unreachable", path, msg: "الصفحة لا تُفتح: " + (r.error || "") }); continue; }
  if (r.status >= 500) { findings.push({ severity: "critical", code: "http-5xx", path, msg: "ترجع " + r.status }); continue; }
  if (r.status >= 400) { findings.push({ severity: p === "/quote" ? "minor" : "major", code: "http-4xx", path, msg: "ترجع " + r.status }); continue; }
  if (r.status >= 300) continue;
  if (ms > 6000) findings.push({ severity: "minor", code: "slow", path, msg: "بطيئة: " + (ms / 1000).toFixed(1) + " ث" });
  findings.push(...contentFindings(path, r.text, { allowNoindex: ["/my", "/checkout", "/cart", "/quote"].includes(p) }));
}
const cfgR = await get("/api/simple?action=config", 20000);
let cfg = null; try { cfg = JSON.parse(cfgR.text); } catch {}
findings.push(...configFindings(cfg, ENV));
const catR = await get("/api/live-catalog", 30000);
let live = null; try { live = JSON.parse(catR.text); } catch {}
let repo = null; try { repo = JSON.parse(fs.readFileSync(new URL("../../site/assets/data/catalog.json", import.meta.url), "utf8")); } catch {}
findings.push(...catalogFindings(live, repo));
log(`HTTP: ${PUBLIC_PAGES.length} صفحة + config + catalog (${live ? live.count : "?"} خدمة) في ${((Date.now() - t0) / 1000).toFixed(1)} ث`);

// ---------- 2) المتصفح: تصميم + رحلة
const journeyReport = [];
if (MODE === "full") {
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  const metrics = async (page, path, viewport, status) => {
    const m = await page.evaluate(() => {
      const de = document.documentElement; const out = { overflowX: Math.max(0, de.scrollWidth - de.clientWidth), brokenImages: [], lowContrast: [], tinyTargets: 0, logo: !!document.querySelector("header img, .sv1-logo img, img[alt*='Business Partner' i], img[src*='logo']") };
      for (const i of document.images) if (i.complete && i.naturalWidth === 0 && i.getBoundingClientRect().width > 0 && i.loading !== "lazy") out.brokenImages.push((i.getAttribute("src") || "").slice(0, 80));
      const rgb = (s) => { const m = String(s).match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/); return m ? [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]] : null; };
      const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage && cs.backgroundImage !== "none") return null; const c = rgb(cs.backgroundColor); if (c && c[3] > 0.9) return c; } return [255, 255, 255, 1]; };
      const lum = (c) => { const v = c.slice(0, 3).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
      for (const el of Array.from(document.querySelectorAll("button, a.sv1-btn, .sv1-btn, h1, h2, p")).slice(0, 220)) {
        const r = el.getBoundingClientRect(); if (r.width < 8 || r.height < 8 || getComputedStyle(el).visibility === "hidden" || getComputedStyle(el).display === "none") continue;
        const t = (el.textContent || "").trim(); if (!t) continue;
        const fg = rgb(getComputedStyle(el).color), bg = bgOf(el); if (!fg || !bg || (fg[3] != null && fg[3] < 1)) continue;
        const a = lum(fg), b = lum(bg); const ratio = Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100;
        const fs = parseFloat(getComputedStyle(el).fontSize); const need = fs >= 24 ? 3 : 4.3; // WCAG 4.5؛ نبلّغ تحت 4.3 لئلا يضجّ الحارس بحالات الحدّ
        if (ratio < need && out.lowContrast.length < 6) out.lowContrast.push({ text: t.slice(0, 40), ratio });
      }
      for (const el of document.querySelectorAll("button, a")) { const r = el.getBoundingClientRect(); if (r.width > 0 && r.height > 0 && (r.height < 32 || r.width < 32) && (el.textContent || "").trim().length < 40) out.tinyTargets++; }
      return out;
    });
    return { path, viewport, status, ...m };
  };
  for (const [vp, size] of [["mobile", { width: 390, height: 800 }], ["desktop", { width: 1366, height: 800 }]]) {
    const ctx = await browser.newContext({ viewport: size, locale: "ar-SA", userAgent: "BP-SiteGuardian/1.0 (+synthetic)" });
    for (const p of ["/", "/catalog", "/packages", "/cart", "/checkout", "/contact"]) {
      const page = await ctx.newPage(); const errs = [], perrs = [], failed = [];
      page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); }); page.on("pageerror", (e) => perrs.push(e.message)); page.on("requestfailed", (r) => failed.push(r.url()));
      const path = p === "/" ? "/ar" : "/ar" + p;
      try { const resp = await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 60000 }); await page.waitForTimeout(400);
        const m = await metrics(page, path, vp, resp ? resp.status() : 0); m.consoleErrors = errs; m.pageErrors = perrs; m.failedRequests = failed; findings.push(...designFindings(m));
      } catch (e) { findings.push({ severity: "critical", code: "page-timeout", path: path + " (" + vp + ")", msg: "لم تكتمل: " + e.message.slice(0, 100) }); }
      await page.close();
    }
    await ctx.close();
  }
  // ---- الرحلة: زائر جديد على الجوال (القراءة فقط — لا إرسال ولا دفع)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, locale: "ar-SA", userAgent: "BP-SiteGuardian/1.0 (+synthetic)" });
  const IDS = {"فتح الرئيسية": "home", "فتح الكتالوج وفيه خدمات للشراء": "catalog", "أضف للسلة": "add", "صفحة السلة تعرض البند ولا تسرّب سعراً للزائر": "cart", "زيادة الكمية تحدّث السلة": "qty", "صفحة الدفع: الحقول وطرق الدفع الإلكتروني فقط": "checkout", "بوابة العميل /my تُفتح للزائر (دخول)": "my", "الدعم/المستشار: الزر العائم موجود": "support"};
  const page = await ctx.newPage(); const steps = []; const step = async (name, fn, severity) => { try { const d = await fn(); steps.push({ id: IDS[name], name, ok: true, detail: d || "" }); } catch (e) { steps.push({ id: IDS[name], name, ok: false, detail: e.message, severity }); } };
  const text = async () => (await page.locator("body").innerText()).replace(/\s+/g, " ");
  await step("فتح الرئيسية", async () => { const r = await page.goto(BASE + "/ar", { waitUntil: "networkidle", timeout: 60000 }); if (!r || r.status() >= 400) throw new Error("status " + (r && r.status())); if (!(await page.title())) throw new Error("لا عنوان"); return "ok"; });
  await step("فتح الكتالوج وفيه خدمات للشراء", async () => { await page.goto(BASE + "/ar/catalog", { waitUntil: "networkidle", timeout: 60000 }); const n = await page.locator(".sv1-pick-add").count(); if (n < 30) throw new Error("أزرار الإضافة للسلة " + n + " فقط"); return n + " زر"; });
  let added = null;
  await step("أضف للسلة", async () => { await page.evaluate(() => localStorage.removeItem("bp_cart")); await page.evaluate(() => document.querySelector(".sv1-pick-add").click()); await page.waitForTimeout(700); const raw = await page.evaluate(() => localStorage.getItem("bp_cart")); const c = JSON.parse(raw || "[]"); if (!c.length) throw new Error("السلة فارغة بعد الضغط"); const it = c[0]; if (typeof it.amount !== "number" || !(it.amount > 0)) throw new Error("amount ليس رقماً موجباً: " + JSON.stringify(it.amount)); if (it.qty !== 1) throw new Error("qty=" + it.qty); added = it; return it.id + " × " + it.amount; });
  await step("صفحة السلة تعرض البند ولا تسرّب سعراً للزائر", async () => { await page.goto(BASE + "/ar/cart", { waitUntil: "networkidle", timeout: 60000 }); const t = await text(); if (added && !t.includes(added.nameAr)) throw new Error("اسم البند غائب عن السلة"); if (/\d[\d,.]*\s*(ريال|SAR|ر\.س)/.test(t)) throw new Error("سعر ظاهر للزائر (SHOW_PRICES=false)"); if (!/(الدفع|أكمل)/.test(t)) throw new Error("لا زر إكمال"); return "ok"; });
  await step("زيادة الكمية تحدّث السلة", async () => { const plus = page.locator("button", { hasText: "+" }).first(); await plus.click({ timeout: 5000 }); await page.waitForTimeout(400); const c = JSON.parse(await page.evaluate(() => localStorage.getItem("bp_cart") || "[]")); if (!c[0] || c[0].qty !== 2) throw new Error("qty بعد + = " + (c[0] && c[0].qty)); return "qty=2"; }, "major");
  await step("صفحة الدفع: الحقول وطرق الدفع الإلكتروني فقط", async () => { await page.goto(BASE + "/ar/checkout", { waitUntil: "networkidle", timeout: 60000 }); const t = await text(); for (const id of ["coName", "coPhone", "coEmail"]) if (!(await page.locator("#" + id).count())) throw new Error("حقل " + id + " مفقود"); if (!/مدى|فيزا|ماستركارد/.test(t)) throw new Error("لا طريقة بطاقة"); if (!/تمارا/.test(t)) throw new Error("لا تمارا"); if (/تحويل\s*بنكي|IBAN|آيبان/.test(t)) throw new Error("تحويل بنكي ظاهر (قرار المالك: إلكتروني فقط)"); if (!/9214/.test(t) || /2978/.test(t)) throw new Error("العنوان الوطني في الصفحة غير المعتمد (المعتمد 9214)"); return "ok"; });
  await step("بوابة العميل /my تُفتح للزائر (دخول)", async () => { const r = await page.goto(BASE + "/ar/my", { waitUntil: "networkidle", timeout: 60000 }); if (!r || r.status() >= 400) throw new Error("status " + (r && r.status())); return "ok"; }, "major");
  await step("الدعم/المستشار: الزر العائم موجود", async () => { await page.goto(BASE + "/ar", { waitUntil: "networkidle", timeout: 60000 }); const has = await page.evaluate(() => !!document.querySelector("[id*='support' i], [class*='support' i], [id*='wa-fab' i], [class*='float' i], [aria-label*='واتساب'], a[href*='wa.me']")); if (!has) throw new Error("لا زر دعم/واتساب عائم"); return "ok"; }, "major");
  await page.evaluate(() => localStorage.removeItem("bp_cart")).catch(() => {});
  journeyReport.push(...steps); findings.push(...journeyFindings(steps, "زائر جديد على الجوال"));
  await browser.close();
}

const rep = summarize(findings);
rep.findings.forEach((x) => (x.owner = ownerOfFinding(x)));
rep.base = BASE; rep.env = ENV; rep.mode = MODE; rep.at = new Date().toISOString(); rep.journey = journeyReport;
if (OUT) fs.writeFileSync(OUT, JSON.stringify(rep, null, 1));
// إرسال التقرير إلى سير «حارس الموقع» على n8n (الويبهوك بمفتاح). الرابط والمفتاح من البيئة فقط: GUARDIAN_WEBHOOK, GUARDIAN_KEY
if (process.env.GUARDIAN_WEBHOOK) {
  try { const r = await fetch(process.env.GUARDIAN_WEBHOOK, { method: "POST", headers: { "content-type": "application/json", "X-BP-Guardian-Key": process.env.GUARDIAN_KEY || "" }, body: JSON.stringify({ status: rep.status, counts: rep.counts, findings: rep.findings.map(({ severity, code, path, msg }) => ({ severity, code, path, msg })) }), signal: AbortSignal.timeout(20000) }); console.log("تقرير مُرسَل إلى n8n:", r.status); } catch (e) { console.log("تعذّر إرسال التقرير:", e.message); }
}
const icon = { critical: "🔴", major: "🟠", minor: "🟡" };
log(`\nالحالة: ${rep.status} — حرج ${rep.counts.critical} · مهم ${rep.counts.major} · بسيط ${rep.counts.minor}`);
for (const j of journeyReport) log(`  ${j.ok ? "✅" : "❌"} ${j.name}${j.ok ? "" : " — " + j.detail}`);
for (const x of rep.findings) log(`${icon[x.severity]} [${x.owner}] ${x.path}: ${x.msg}`);
process.exit(rep.counts.critical ? 1 : 0);
