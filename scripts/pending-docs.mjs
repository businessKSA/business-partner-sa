#!/usr/bin/env node
// Business Partner — عدّ المستندات المهاجَرة التي ما زالت تنتظر إجراء العميل.
//
// يُشغَّل بعد الهجرة الحقيقية وقبل المرحلة 4: يخبرك كم عرضًا ينتظر قرارًا، وكم
// عقدًا ينتظر توقيعًا، وكم فاتورةً مستحقة — بين الصفوف المهاجَرة وحدها (التي لها
// رمز في quote_tokens). متى صار الكل صفرًا صار فصل bp-quotes بلا أثر على عميل.
//
//   LOCAL_DB=1 node scripts/pending-docs.mjs                 # على القاعدة المحلية
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/pending-docs.mjs   # على الحقيقي
//
// بديل SQL مباشر في محرّر Supabase:
//   select
//     count(*) filter (where quote->>'status' = 'SENT')                         as quotes_pending,
//     count(*) filter (where contract->>'status' in ('SENT','SIGNING'))         as contracts_pending,
//     count(*) filter (where invoice is not null
//                        and coalesce(payment->>'status','') <> 'PAID')         as invoices_due
//   from requests where ref in (select ref from quote_tokens);
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const pendKind = {
  quote: (r) => r.quote && r.quote.status === "SENT",
  contract: (r) => r.contract && ["SENT", "SIGNING"].includes(r.contract.status),
  invoice: (r) => r.invoice && !(r.payment && r.payment.status === "PAID"),
};

// R2: عروض الموردين المفتوحة ليست مهاجَرة (تعيش في bp-quotes). إن توفّر
// DATABASE_URL نفحص قاعدتها مباشرة: RFP أُرسل ولم يُردّ ولم يُرفض ولم تنتهِ مدته.
async function openSupplierRfps() {
  const url = (process.env.DATABASE_URL || "").trim();
  if (!url) return null;
  let pg;
  try { ({ default: pg } = await import("pg")); } catch { return null; }
  const client = new pg.Client({ connectionString: url, ssl: /sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined });
  await client.connect();
  try {
    const { rows } = await client.query(
      `select r.token, s."nameAr" as supplier, sr.number as request
         from "SupplierRfp" r
         join "Supplier" s on s.id = r."supplierId"
         join "SupplyRequest" sr on sr.id = r."supplyRequestId"
        where r."respondedAt" is null and r."declinedAt" is null
          and (r."expiresAt" is null or r."expiresAt" > now())`);
    return rows;
  } finally { await client.end(); }
}

(async () => {
  const { sb, DB_ON } = await import(path.join(ROOT, "api", "_db.js"));
  if (!DB_ON) { console.error("✗ قاعدة البيانات غير مضبوطة (LOCAL_DB=1 أو SUPABASE_URL/SUPABASE_SERVICE_KEY)."); process.exit(2); }

  const toks = await sb("quote_tokens?select=ref&limit=10000");
  const migrated = new Set((toks || []).map((t) => t.ref));
  if (!migrated.size) { console.log("» لا صفوف مهاجَرة بعد (quote_tokens فارغ). شغّل الهجرة أولاً."); return; }

  const reqs = await sb("requests?select=ref,title,client_email,status,quote,contract,invoice,payment&limit=10000");
  const mine = (reqs || []).filter((r) => migrated.has(r.ref));

  const counts = { quotes_pending: 0, contracts_pending: 0, invoices_due: 0 };
  const rows = [];
  for (const r of mine) {
    const flags = [];
    if (pendKind.quote(r)) { counts.quotes_pending++; flags.push("عرض ينتظر قرارًا"); }
    if (pendKind.contract(r)) { counts.contracts_pending++; flags.push("عقد ينتظر توقيعًا"); }
    if (pendKind.invoice(r)) { counts.invoices_due++; flags.push("فاتورة مستحقة"); }
    if (flags.length) rows.push({ ref: r.ref, email: r.client_email || "—", title: r.title || "", flags });
  }

  console.log(`» صفوف مهاجَرة: ${mine.length} | منها معلّقة الإجراء: ${rows.length}`);
  console.log(`» عروض تنتظر قرارًا: ${counts.quotes_pending} · عقود تنتظر توقيعًا: ${counts.contracts_pending} · فواتير مستحقة: ${counts.invoices_due}`);
  if (rows.length) {
    console.log("\n— المعلّقة (عالِجها أو انتظرها قبل الفصل) —");
    for (const r of rows) console.log(`  ${r.ref}  ·  ${r.email}  ·  ${r.flags.join(" + ")}`);
    console.log("\n⚠ يوجد معلّق — تأجيل المرحلة 4 أسلم، أو تابعها مع العملاء، أو نفّذ 4أ (زر «سجّل الدخول» يبقيهم قادرين على المتابعة من الحساب).");
  } else {
    console.log("\n✔ لا مستند معلّق — الفصل (المرحلة 4) بلا أثر على أي عميل.");
  }

  // R2: عروض الموردين المفتوحة (غير مهاجَرة) — بوابة إضافية قبل الحذف.
  let rfps = null;
  try { rfps = await openSupplierRfps(); }
  catch (e) { console.log(`\n(تعذّر فحص عروض الموردين: ${String(e.message || e).slice(0, 120)})`); }
  if (rfps === null) {
    console.log("\n» عروض الموردين (RFP): لم تُفحَص — اضبط DATABASE_URL لقاعدة bp-quotes لعدّها.");
  } else if (rfps.length) {
    console.log(`\n⚠ عروض موردين مفتوحة تنتظر ردًّا: ${rfps.length} (روابط /quotes/rfp/<token> ستنكسر بالحذف)`);
    for (const r of rfps) console.log(`  ${r.request}  ·  ${r.supplier}  ·  ${String(r.token).slice(0, 8)}…`);
  } else {
    console.log("\n✔ لا عرض مورد مفتوح — روابط الموردين بلا أثر.");
  }
})().catch((e) => { console.error("✗ فشل:", e.message || e); process.exit(1); });
