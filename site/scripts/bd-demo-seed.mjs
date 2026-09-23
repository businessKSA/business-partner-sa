#!/usr/bin/env node
// بذرة عرض الألماس الأزرق — تملأ القاعدة المحلية بحالة تشبه أسبوعاً من
// عمل مكتب حقيقي، حتى يُعرض الفلو على العميل ببيانات تُشبه بياناته لا
// بجداول فارغة. تُشغَّل على الخادم المحلي وحده:
//
//   LOCAL_DB=1 npm run dev        # في نافذة
//   node site/scripts/bd-demo-seed.mjs   # في أخرى
//
// لا تلمس الإنتاج: تتحدث إلى localhost فقط، وكل ما تُدخله أرشيف صامت
// (backlog) إلا ما يُقصد منه أن يُظهر التنبيه الحيّ.

const BASE = process.env.BD_DEMO_BASE || "http://localhost:3000";
const KEY = process.env.BD_OPS_KEY || "test-ops";

if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE)) {
  console.error("\n  هذه البذرة للتشغيل المحلي فقط. BD_DEMO_BASE يجب أن يكون localhost.\n");
  process.exit(1);
}

const post = async (body) => {
  const r = await fetch(`${BASE}/api/realestate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, key: KEY }),
  });
  const data = await r.json().catch(() => ({}));
  if (r.status !== 200) throw new Error(`${body.action} → ${r.status} ${JSON.stringify(data)}`);
  return data;
};

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

// ————————————————————————————————————————————— أرشيف واتساب
// تصدير محادثة كما يخرج من الهاتف، بأسطر النظام وردود المكتب التي يجب
// أن تُستبعد — لأن الديمو يجب أن يُظهر التنظيف لا أن يخفيه.
const CHAT = [
  "[03/06/2025, 9:12:41 ص] أبو سعد الغامدي: مطلوب أرض خام شمال الرياض من 4000 إلى 6000 متر الميزانية 9 مليون صك إلكتروني",
  "[03/06/2025, 9:15:02 ص] بندر: تمام أبحث لك",
  "[03/06/2025, 9:30:00 ص] أبو سعد الغامدي: الرسائل والمكالمات مشفرة من طرف إلى طرف",
  "[11/06/2025, 8:02:10 م] محمد العتيبي: عميلي يبغى عمارة سكنية في الرياض حي الملقا من 5000 إلى 6000 متر مؤجرة والدخل السنوي 700 الف — الطلب عن طريق وسيط ثاني",
  "[11/06/2025, 8:05:00 م] بندر: كم ميزانيته؟",
  "[19/06/2025, 11:40:00 ص] فهد الدوسري: <Media omitted>",
  "[19/06/2025, 11:41:00 ص] فهد الدوسري: للبيع عمارة سكنية حي الملقا الرياض 5600 متر مؤجرة بالكامل الدخل السنوي 715 الف السعر 11 مليون صك إلكتروني",
  "[02/07/2025, 10:00:00 ص] سعد القحطاني: يبغى مستودع في جدة 2000 متر للايجار",
  "[02/07/2025, 10:01:00 ص] بندر: وش الاخبار",
  "[14/07/2025, 4:20:00 م] فهد الدوسري: للبيع أرض خام شمال الرياض 5200 متر السعر 8.4 مليون صك إلكتروني",
].join("\n");

const run = async () => {
  console.log(`\n  بذرة عرض الألماس الأزرق → ${BASE}\n  ${"—".repeat(52)}`);

  const bulk = await post({ action: "intake-bulk", format: "whatsapp", text: CHAT, onlyFrom: null });
  console.log(`  أرشيف واتساب: قُرئت ${bulk.read} · سُجّلت ${bulk.saved} · تُجوهلت ${bulk.skipped}`);
  for (const s of bulk.skippedRows || []) console.log(`      ✗ ${s.why}: ${s.text}`);

  // تحويل الوارد: الطلبات أولاً ثم العروض، ليُظهر الجدول مطابقة حقيقية.
  const refs = (bulk.rows || []).map((r) => ({ ref: r.ref, intent: r.intent, text: r.raw_text }));
  const converted = [];
  for (const r of refs) {
    const isListing = r.intent === "LISTING";
    // الطلب الذي وصل عن وسيط يُسجَّل بسلسلته — وهذا ما يُعرض على العميل.
    const chain = /عن طريق وسيط/.test(r.text || "")
      ? [
          { name: "محمد العتيبي", phone: "0555556666", role: "BROKER", share_pct: 50 },
          { name: "وسيط ثانٍ (لم يُعرف بعد)", role: "BROKER", share_pct: 50 },
        ]
      : null;
    const out = await post({ action: "intake-convert", ref: r.ref, kind: isListing ? "LISTING" : "REQUEST", chain });
    converted.push(out);
    console.log(`  ${r.ref} → ${out.ref}${out.matches ? `  (${out.matches} مطابقة)` : ""}${chain ? "  [سلسلة وسيطين]" : ""}`);
  }

  // ———————————————————————————————— وارد اليوم من قنوات أخرى
  const today = [
    { channel: "INSTAGRAM", channelDetail: "@bandar.re", name: "نورة العنزي", phone: "0501112222",
      text: "مطلوب معرض تجاري على طريق الملك عبدالعزيز بالرياض 400 متر واجهة رئيسية" },
    { channel: "CALL", name: "متصل — لم يعرّف باسمه", phone: "0544445555", actor: "ريم (الاستقبال)",
      text: "يبغى أرض سكنية شرق الرياض 750 متر كاش خلال شهر" },
    { channel: "EMAIL", name: "شركة مدى للتطوير", email: "info@example.com",
      text: "نعرض للبيع مجمع مستودعات في جدة 12000 متر مؤجر بعقود قائمة الدخل السنوي 2.1 مليون" },
    { channel: "TEAM", name: "عميل مكتب الرياض", actor: "خالد",
      text: "العميل يطلب دراسة جدوى لمشروع سكني شمال الرياض على أرض 6000 متر" },
  ];
  console.log(`  ${"—".repeat(52)}`);
  for (const t of today) {
    const out = await post({ action: "intake", ...t, receivedAt: daysAgo(0) });
    const dup = (out.duplicates || [])[0];
    console.log(`  وارد اليوم ${out.row.ref} · ${t.channel}${dup ? `  ⚠️ قد يكرّر ${dup.ref}` : ""}`);
  }

  const d = await post({ action: "dashboard" });
  console.log(`  ${"—".repeat(52)}`);
  console.log(`  الوارد المنتظر: ${d.counts.inbox} · الطلبات: ${d.counts.openRequests} · العروض: ${d.counts.activeListings} · المطابقات: ${d.counts.newMatches}`);
  console.log(`  القنوات: ${Object.entries(d.channels || {}).map(([k, v]) => `${k}=${v}`).join(" · ")}`);
  console.log(`\n  افتح: ${BASE}/bluediamond/crm\n`);
};

run().catch((e) => { console.error("\n  تعذّرت البذرة:", e.message, "\n"); process.exit(1); });
