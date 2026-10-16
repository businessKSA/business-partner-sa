// Business Partner — Simple V1: دليل المستثمر (/guide).
//
// بنية رحلة المستثمر (على نسق scbc.gov.sa/ar/guidelines) بهوية SV1 وصياغتنا.
// ما دامت site/data/sbc/meta.json فيه sample=true فالصفحة موسومة «نموذج — بحاجة
// تحقق» وغير مفهرسة (noindex)، ولا يُعرض سجلٌّ status != verified كحقيقة.
// تملكه: sbc-guide. بيانات الصفحة في site/data/sbc/ ومخططها docs/sbc-guide/schema.md.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "sbc");
const load = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8"));

const TABS = ["journey", "procedures", "regulations", "offices", "appeals", "violations", "video"];

const T = {
  title: { ar: "دليل المستثمر", en: "Investor guide" },
  metaTitle: { ar: "دليل المستثمر — الإجراءات والجهات", en: "Investor guide — procedures and entities" },
  desc: {
    ar: "رحلة بدء العمل في المملكة: ما تحتاجه، وأي جهة تخدمك، وكيف نساعدك في كل خطوة.",
    en: "Your journey to start a business in the Kingdom: what you need, which entity serves you, and how we help at each step.",
  },
  tag: { ar: "دليل المستثمر", en: "Investor guide" },
  sample: { ar: "نموذج — بحاجة تحقق: المحتوى أدناه تجريبي لشكل الصفحة فقط وليس معلومة رسمية.", en: "Sample — needs verification: the content below is a layout placeholder only, not official information." },
  tabsLabel: { ar: "أقسام الدليل", en: "Guide sections" },
  tab: {
    journey: { ar: "رحلة المستثمر", en: "Investor journey" },
    procedures: { ar: "إجراءات الخدمات", en: "Service procedures" },
    regulations: { ar: "الأنظمة والتشريعات", en: "Regulations" },
    offices: { ar: "دليل المكاتب المعتمدة", en: "Approved offices" },
    appeals: { ar: "خدمات الاعتراضات", en: "Appeals" },
    violations: { ar: "دليل المخالفات", en: "Violations guide" },
    video: { ar: "الاتصال المرئي", en: "Video call" },
  },
  search: { ar: "ابحث في الإجراءات", en: "Search procedures" },
  entity: { ar: "الجهة", en: "Entity" },
  allEntities: { ar: "كل الجهات", en: "All entities" },
  noResults: { ar: "لا نتائج مطابقة.", en: "No matching results." },
  soon: { ar: "هذا القسم بانتظار المادة الرسمية بعد تحقق المالك.", en: "This section is waiting for official material after owner verification." },
  needsVer: { ar: "بحاجة تحقق", en: "Needs verification" },
  platform: { ar: "المنصة", en: "Platform" },
  ask: { ar: "تحدّث مع المستشار الذكي", en: "Talk to the smart advisor" },
  videoH: { ar: "استشارة مجانية بالفيديو", en: "Free video consultation" },
  videoP: {
    ar: "عبر Google Meet يومياً من ٣ عصراً إلى ١٠ مساءً بتوقيت الرياض. (يُفعَّل الحجز من وكيل آخر.)",
    en: "Via Google Meet daily from 3 PM to 10 PM Riyadh time. (Booking is wired by another agent.)",
  },
  book: { ar: "احجز استشارة", en: "Book a consultation" },
  disclaimer: {
    ar: "الأنظمة والرسوم الحكومية تتغيّر؛ ارجع دائماً للرابط الرسمي لكل إجراء قبل الاعتماد على أي رقم.",
    en: "Government rules and fees change; always check each procedure's official link before relying on any figure.",
  },
};

export function buildSimpleGuide(SV1, ctx) {
  const { lang: langFn, esc } = ctx;
  const lang = langFn();
  const pick = (e) => (e && e[lang] != null ? e[lang] : e && e.en);
  const t = (k) => pick(T[k]);
  const pre = lang === "en" ? "" : "/" + lang;
  const u = (p) => pre + p;

  const meta = load("meta.json");
  const sectors = load("sectors.json");
  const entities = load("entities.json");
  const procs = load("procedures.json");
  const entName = Object.fromEntries(entities.map((e) => [e.id, pick(e.name)]));
  const sample = meta.sample === true;
  const badge = `<span class="sv1-gd-badge">${esc(t("needsVer"))}</span>`;
  // سجلٌّ غير متحقَّق منه يُعرض فقط ما دامت الصفحة نموذجية وموسومة.
  const show = (r) => sample || r.status === "verified";

  const CSS = `<style id="sv1-sbc-css">
.sv1-gd-head{max-width:820px;margin:0 0 22px}
.sv1-gd-head h1{font-size:clamp(28px,4vw,46px);line-height:1.15;margin:16px 0 12px;letter-spacing:-.03em;font-weight:200;color:var(--ink)}
.sv1-gd-banner{background:var(--acSoft);border:1px solid var(--acLine);border-radius:10px;padding:12px 14px;font-size:13px;line-height:1.8;margin:0 0 20px;color:var(--t)}
.sv1-gd-tabs{display:flex;gap:7px;overflow-x:auto;padding:0 0 12px;margin:0 0 18px;border-bottom:1px solid var(--line2)}
.sv1-gd-tabs [role=tab]{font:inherit;font-size:13px;padding:8px 14px;border:1px solid var(--l);border-radius:999px;background:#fff;color:var(--ink);white-space:nowrap;cursor:pointer}
.sv1-gd-tabs [role=tab][aria-selected=true]{background:var(--ac);border-color:var(--ac);color:#fff}
.sv1-gd-tabs [role=tab]:focus-visible{outline:2px solid var(--ac);outline-offset:2px}
.sv1-gd-bar{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 16px}
.sv1-gd-bar input,.sv1-gd-bar select{font:inherit;font-size:14px;padding:10px 12px;border:1px solid var(--l);border-radius:9px;background:#fff;color:var(--ink);min-width:0;flex:1 1 200px}
.sv1-gd-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.sv1-gd-card{background:#fff;border:1px solid var(--l);border-radius:14px;padding:18px;box-shadow:var(--sh);display:flex;flex-direction:column;gap:8px}
.sv1-gd-card h3{margin:0;font-size:16px;font-weight:500;color:var(--ink)}
.sv1-gd-card p{margin:0;font-size:13.5px;line-height:1.8;color:var(--mut)}
.sv1-gd-card small{color:var(--mut);font-size:12px}
.sv1-gd-card[hidden]{display:none}
.sv1-gd-badge{align-self:flex-start;font-size:11.5px;padding:3px 9px;border-radius:999px;background:var(--acSoft);border:1px solid var(--acLine);color:var(--ink)}
.sv1-gd-empty{background:#fff;border:1px dashed var(--l);border-radius:12px;padding:22px;color:var(--mut);font-size:14px}
.sv1-gd-note{margin:24px 0 0;font-size:13px;line-height:1.8;color:var(--mut)}
@media(max-width:860px){.sv1-gd-grid{grid-template-columns:1fr 1fr}}
@media(max-width:560px){.sv1-gd-grid{grid-template-columns:1fr}}
</style>`;

  const tabsHtml = TABS.map((k, i) =>
    `<button type="button" role="tab" id="sbc-tab-${k}" aria-controls="sbc-panel-${k}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(pick(T.tab[k]))}</button>`).join("");

  const sectorCards = sectors.filter(show).map((s) =>
    `<article class="sv1-gd-card">${s.status !== "verified" ? badge : ""}<h3>${esc(pick(s.name))}</h3><p>${esc(pick(s.summary))}</p></article>`).join("");

  const procCards = procs.filter(show).map((p) => {
    const q = `${pick(p.title)} ${pick(p.summary)} ${entName[p.entity] || ""}`.toLowerCase();
    return `<article class="sv1-gd-card" data-entity="${esc(p.entity)}" data-q="${esc(q)}">${p.status !== "verified" ? badge : ""}<h3>${esc(pick(p.title))}</h3><p>${esc(pick(p.summary))}</p><small>${esc(t("entity"))}: ${esc(entName[p.entity] || "")}</small><a class="sv1-btn" href="${esc(p.catalog_sku ? u("/catalog") : u("/#advisor"))}">${esc(t("ask"))}</a></article>`;
  }).join("");

  const entOpts = `<option value="">${esc(t("allEntities"))}</option>` +
    entities.filter(show).map((e) => `<option value="${esc(e.id)}">${esc(pick(e.name))}</option>`).join("");

  const empty = `<div class="sv1-gd-empty">${esc(t("soon"))}</div>`;
  const panelBody = {
    journey: `<div class="sv1-gd-grid">${sectorCards}</div>`,
    procedures: `<div class="sv1-gd-bar"><input id="sbcQ" type="search" placeholder="${esc(t("search"))}" aria-label="${esc(t("search"))}"><select id="sbcEnt" aria-label="${esc(t("entity"))}">${entOpts}</select></div><div class="sv1-gd-grid" id="sbcGrid">${procCards}</div><p id="sbcNone" class="sv1-gd-empty" hidden>${esc(t("noResults"))}</p>`,
    regulations: empty, offices: empty, appeals: empty, violations: empty,
    video: `<div class="sv1-gd-card" style="max-width:560px"><h3>${esc(t("videoH"))}</h3><p>${esc(t("videoP"))}</p><a class="sv1-btn primary" href="${esc(u("/consultation"))}">${esc(t("book"))}</a></div>`,
  };
  const panels = TABS.map((k, i) =>
    `<div role="tabpanel" id="sbc-panel-${k}" aria-labelledby="sbc-tab-${k}" tabindex="0"${i === 0 ? "" : " hidden"}>${panelBody[k]}</div>`).join("");

  const body = `${SV1.header("/guide")}
  <main>
  <section class="sv1-sec"><div class="wrap">
    <div class="sv1-gd-head">
      <span class="sv1-tag">${esc(t("tag"))}</span>
      <h1>${esc(t("title"))}</h1>
      <p class="sv1-lead" style="max-width:none">${esc(t("desc"))}</p>
    </div>
    ${sample ? `<div class="sv1-gd-banner" role="note">${esc(t("sample"))}</div>` : ""}
    <div class="sv1-gd-tabs" role="tablist" aria-label="${esc(t("tabsLabel"))}">${tabsHtml}</div>
    ${panels}
    <p class="sv1-gd-note">${esc(t("disclaimer"))}</p>
  </div></section>
  </main>
${SV1.footer()}`;

  const script = `<script>(function(){
var tabs=[].slice.call(document.querySelectorAll('.sv1-gd-tabs [role=tab]'));
function sel(t,f){tabs.forEach(function(x){var on=x===t;x.setAttribute('aria-selected',on);x.tabIndex=on?0:-1;
 document.getElementById(x.getAttribute('aria-controls')).hidden=!on});if(f)t.focus()}
tabs.forEach(function(t,i){t.addEventListener('click',function(){sel(t)});
 t.addEventListener('keydown',function(e){var rtl=getComputedStyle(document.documentElement).direction==='rtl';
  var k=e.key,n=-1;if(k==='ArrowRight')n=i+(rtl?-1:1);else if(k==='ArrowLeft')n=i+(rtl?1:-1);
  else if(k==='Home')n=0;else if(k==='End')n=tabs.length-1;if(n<0)return;
  e.preventDefault();sel(tabs[(n+tabs.length)%tabs.length],true)})});
var q=document.getElementById('sbcQ'),en=document.getElementById('sbcEnt'),cards=[].slice.call(document.querySelectorAll('#sbcGrid .sv1-gd-card')),none=document.getElementById('sbcNone');
function draw(){var s=q.value.trim().toLowerCase(),e=en.value,c=0;cards.forEach(function(x){
 var ok=(!e||x.dataset.entity===e)&&(!s||x.dataset.q.indexOf(s)>-1);x.hidden=!ok;if(ok)c++});none.hidden=c>0}
if(q){q.addEventListener('input',draw);en.addEventListener('change',draw)}
})();</script>`;

  return SV1.shell({
    title: `${t("metaTitle")} — Business Partner`,
    desc: t("desc"),
    path: "/guide",
    body: CSS + body,
    script,
    noindex: sample,
  });
}
