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
})().catch((e) => { console.error("✗ فشل:", e.message || e); process.exit(1); });
