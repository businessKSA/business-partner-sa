#!/usr/bin/env node
// استيراد تاريخ لوحة العروض إلى قاعدة الموقع الرئيسي — المرحلة ٢ من
// docs/quotes-cutover.md، والخطوة الثانية بعد quotes/scripts/export-for-main.ts.
//
// الجفاف هو الأصل: بلا `--write` لا يُكتب حرف واحد، ويُطبع ما كان سيُكتب.
// وهذا ليس تحفّظاً زائداً — الكتابة هنا تمسّ عقود عملاء وفواتيرهم، والخطأ
// فيها لا يُكتشف إلا حين يفتح عميل مستنده فيجد مستند غيره.
//
// التشغيل الموصى به أولاً على القاعدة المحلية:
//   LOCAL_DB=1 node ops/quotes-import.mjs --file quotes/.migrate/quotes-export.json
//   LOCAL_DB=1 node ops/quotes-import.mjs --file … --write
// ثم على الإنتاج بعد مراجعة النتيجة (يحتاج SUPABASE_URL و SUPABASE_SERVICE_KEY
// في بيئتك أنت — لا تلصقهما في محادثة):
//   node ops/quotes-import.mjs --file … --write
//
// التكرار آمن: كل صفّ يُطابَق بـ `ref` وكل رابط بـ `token`، فإعادة التشغيل
// تُحدِّث ولا تُضاعف. نقل يُعاد نصفه خير من نقل يُخاف إعادته.

import { readFileSync } from "node:fs";
import { sb, DB_ON } from "../api/_db.js";

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const val = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };

const FILE = val("--file", "quotes/.migrate/quotes-export.json");
const WRITE = flag("--write");
const LIMIT = Number(val("--limit", "0")) || 0;

const q = (s) => encodeURIComponent(String(s == null ? "" : s));

if (!DB_ON) {
  console.error("لا قاعدة: اضبط LOCAL_DB=1 للتجربة، أو SUPABASE_URL و SUPABASE_SERVICE_KEY للإنتاج.");
  process.exit(1);
}

let doc;
try { doc = JSON.parse(readFileSync(FILE, "utf8")); }
catch (e) { console.error(`تعذّرت قراءة ${FILE}: ${e.message}`); process.exit(1); }

const requests = Array.isArray(doc.requests) ? doc.requests : [];
const links = Array.isArray(doc.links) ? doc.links : [];
const slice = LIMIT ? requests.slice(0, LIMIT) : requests;

console.log(`الملف: ${FILE}  (صُدِّر ${doc.exportedAt || "?"})`);
console.log(`طلبات: ${requests.length}  روابط: ${links.length}  المعالَج الآن: ${slice.length}`);
console.log(WRITE ? "الوضع: كتابة فعلية" : "الوضع: جافّ — لا يُكتب شيء (أضف --write)");
console.log("");

// الحقول التي يقبلها جدول `requests`. أي حقل زائد من التصدير (مثل legacy_id)
// يرفضه PostgREST بخطأ يوقف النقل كلّه، فيُصفّى هنا لا هناك.
const FIELDS = [
  "ref", "type", "source", "status", "lang", "title", "summary",
  "scope", "quote", "contract", "invoice",
  "client_name", "client_email", "client_phone", "company_name",
  "created_at", "updated_at",
];

const pick = (r) => {
  const o = {};
  for (const k of FIELDS) if (r[k] !== undefined && r[k] !== null) o[k] = r[k];
  return o;
};

let created = 0, updated = 0, failed = 0;

for (const r of slice) {
  const row = pick(r);
  if (!row.ref || !row.title) { console.warn(`  ⚠ تخطّي صفّ بلا ref أو عنوان`); failed++; continue; }
  try {
    const existing = await sb(`requests?ref=eq.${q(row.ref)}&select=id&limit=1`);
    const isNew = !existing || !existing.length;
    if (!WRITE) { console.log(`  ${isNew ? "+" : "~"} ${row.ref}  ${row.title.slice(0, 48)}`); isNew ? created++ : updated++; continue; }
    if (isNew) { await sb("requests", { method: "POST", body: row, prefer: "return=minimal" }); created++; }
    else { await sb(`requests?ref=eq.${q(row.ref)}`, { method: "PATCH", body: row, prefer: "return=minimal" }); updated++; }
  } catch (e) {
    console.error(`  ✗ ${row.ref}: ${e.message}`);
    failed++;
  }
}

// الروابط آخراً: لا معنى لرابط يشير إلى طلب لم يُكتب بعد.
let linked = 0, linkFailed = 0;
const refs = new Set(slice.map((r) => r.ref));
for (const l of links) {
  if (!l || !l.token || !l.ref || !refs.has(l.ref)) continue;
  const body = { token: String(l.token), ref: String(l.ref), kind: String(l.kind || "QUOTE"), source: "bp-quotes" };
  if (!WRITE) { linked++; continue; }
  try {
    // `on_conflict=token` صريحاً لا ضمناً: PostgREST يستنتج المفتاح الأوّلي،
    // لكن القاعدة المحلية (api/_localdb.js) تحتاج العمود مكتوباً — وبدونه
    // كانت البروفة تُضاعف الرابط في كل تشغيل بينما الإنتاج يدمجه.
    await sb("legacy_doc_links?on_conflict=token", { method: "POST", body, prefer: "resolution=merge-duplicates,return=minimal" });
    linked++;
  } catch (e) {
    console.error(`  ✗ رابط ${l.token}: ${e.message}`);
    linkFailed++;
  }
}

console.log("");
console.log(`طلبات: جديد ${created} — محدَّث ${updated} — فشل ${failed}`);
console.log(`روابط: ${linked} — فشل ${linkFailed}`);
if (!WRITE) console.log("\nلم يُكتب شيء. أعد التشغيل مع --write بعد مراجعة ما سبق.");
else if (!failed && !linkFailed) console.log("\n✓ تم. افحص رابطاً واحداً على الأقل: /quotes/d/<token> على الموقع الرئيسي.");
// لا `process.exit` هنا: القاعدة المحلية تؤجّل الكتابة إلى القرص ٤٠ مللي
// (debounce في api/_localdb.js)، والخروج الفوري يقتل المؤقّت فيبدو النقل
// ناجحاً وملفُّ القاعدة كما كان. ضبط رمز الخروج وترك الحلقة تفرغ يكتب فعلاً.
process.exitCode = failed || linkFailed ? 1 : 0;
