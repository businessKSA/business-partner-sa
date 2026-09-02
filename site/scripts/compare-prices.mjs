#!/usr/bin/env node
/**
 * جدول فروقات الأسعار بين لوحة التحكم والموقع التعريفي.
 *
 * لا يكتب شيئاً. يقرأ الأسعار الحيّة من نقطة الكتالوج العامة ويقارنها بأسعار
 * الموقع، فيُرى الفرق قبل أن يُختار أيّهما يسود. الأسعار في الجهتين تُعدَّل
 * يدوياً، فبلا هذا الجدول يكتب أحدهما فوق الآخر بلا أن يُعلم أحد.
 *
 *   node site/scripts/compare-prices.mjs [PORTAL_URL]
 */
import { readFileSync } from "node:fs";

const PORTAL = (process.argv[2] || process.env.PORTAL_URL || "https://bp-quotes-three.vercel.app/quotes").replace(/\/+$/, "");
const cat = JSON.parse(readFileSync("site/assets/data/catalog.json", "utf8"));

const siteRows = new Map();
for (const s of cat.services || []) {
  const code = String(s.code || "").trim().toUpperCase();
  if (code) siteRows.set(code, { name: s.nameAr || s.nameEn || code, amount: s.amount ?? null, model: s.pricingModel || "" });
}
for (const p of cat.packages || []) {
  const key = String(p.key || "").trim().toUpperCase();
  if (key) siteRows.set("PKG-" + key, { name: p.nameAr || p.nameEn || key, amount: p.amount ?? null, model: "Package" });
}

const res = await fetch(`${PORTAL}/api/catalog`, { headers: { accept: "application/json" } });
if (!res.ok) {
  console.error(`تعذّر قراءة الكتالوج الحيّ: HTTP ${res.status} من ${PORTAL}/api/catalog`);
  process.exit(1);
}
const live = await res.json();
const liveRows = new Map(live.services.map((s) => [String(s.code).toUpperCase(), s]));

const same = [];
const differ = [];
const onlyLive = [];
const onlySite = [];

for (const [code, s] of siteRows) {
  const l = liveRows.get(code);
  if (!l) { onlySite.push({ code, ...s }); continue; }
  const a = s.amount == null ? null : Math.round(Number(s.amount) * 100) / 100;
  const b = l.openPrice ? null : Math.round(Number(l.unitPrice) * 100) / 100;
  if (a === b) same.push(code);
  else differ.push({ code, name: l.nameAr || s.name, site: a, panel: b, open: l.openPrice });
}
for (const [code, l] of liveRows) if (!siteRows.has(code)) onlyLive.push({ code, name: l.nameAr, price: l.openPrice ? null : l.unitPrice });

const fmt = (v) => (v == null ? "مفتوح/بلا سعر" : new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v));

console.log(`الكتالوج الحيّ: ${live.count} خدمة · الموقع: ${siteRows.size} عنصراً`);
console.log(`متطابقة: ${same.length} · مختلفة: ${differ.length} · في اللوحة فقط: ${onlyLive.length} · في الموقع فقط: ${onlySite.length}\n`);

if (differ.length) {
  console.log("الفروقات — الرمز | الخدمة | سعر الموقع | سعر اللوحة");
  console.log("-".repeat(78));
  for (const d of differ.sort((x, y) => x.code.localeCompare(y.code))) {
    console.log(`${d.code.padEnd(26)} | ${String(d.name).slice(0, 28).padEnd(28)} | ${fmt(d.site).padStart(12)} | ${fmt(d.panel).padStart(12)}`);
  }
  console.log("");
}
if (onlySite.length) { console.log("على الموقع وليست في اللوحة:"); onlySite.forEach((r) => console.log(`  - ${r.code} — ${r.name}`)); console.log(""); }
if (onlyLive.length) { console.log("في اللوحة وليست على الموقع:"); onlyLive.forEach((r) => console.log(`  + ${r.code} — ${r.name}`)); console.log(""); }
if (!differ.length && !onlySite.length && !onlyLive.length) console.log("لا فروقات — الجهتان متطابقتان.");
