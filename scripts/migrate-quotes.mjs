#!/usr/bin/env node
// Business Partner — هجرة bp-quotes → طلبات Simple V1 (المرحلة 1 من الدمج).
//
// يقرأ قاعدة bp-quotes (Prisma/PostgreSQL) أو ملف عيّنة، ويكتب صفوف requests +
// request_events + quote_tokens المكافئة. منطق التحويل في scripts/lib/map-quotes.mjs.
//
//   آمن بالتصميم:
//   • الافتراضي "تجربة" (dry-run): يقرأ ويحوّل ويطبع ملخّصاً بلا أي كتابة.
//   • الكتابة تذهب إلى طبقة sb() نفسها التي يستعملها الموقع: مع LOCAL_DB=1
//     تكتب في .localdb/ (لا بيانات عملاء حقيقية)، وبدونها إلى Supabase الحيّ.
//   • المصدر الحقيقي (--source=prisma) يحتاج DATABASE_URL في البيئة —
//     لا يُلصَق في المحادثة، يُوضع في .env.local ويُشغَّل السكربت محلياً.
//
//   أمثلة:
//     node scripts/migrate-quotes.mjs                         # تجربة على العيّنة
//     LOCAL_DB=1 node scripts/migrate-quotes.mjs --write      # كتابة محلية للعيّنة
//     DATABASE_URL=... node scripts/migrate-quotes.mjs --source=prisma         # تجربة على القاعدة الحقيقية (قراءة فقط)
//     LOCAL_DB=1 DATABASE_URL=... node scripts/migrate-quotes.mjs --source=prisma --write
//
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mapBundle } from "./lib/map-quotes.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

const args = process.argv.slice(2);
const flag = (name, def = null) => {
  const hit = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return def;
  const eq = hit.indexOf("=");
  return eq === -1 ? true : hit.slice(eq + 1);
};
const SOURCE = String(flag("source", "fixture"));
const WRITE = !!flag("write", false);
const FIXTURE = String(flag("fixture", path.join(ROOT, "scripts", "fixtures", "quotes-sample.json")));

// ---------------------------------------------------------------- readers --
function readFixture(file) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  return Array.isArray(data) ? data : (data.bundles || []);
}

async function readPrisma() {
  const url = (process.env.DATABASE_URL || "").trim();
  if (!url) { console.error("✗ DATABASE_URL غير مضبوط — ضعه في .env.local وشغّل محلياً."); process.exit(2); }
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: url, ssl: /sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined });
  await client.connect();
  const all = async (sql) => (await client.query(sql)).rows;
  try {
    const clients = await all(`select * from "Client"`);
    const documents = await all(`select * from "Document"`);
    const items = await all(`select * from "DocumentItem"`);
    const invoices = await all(`select * from "Invoice"`);
    const signatures = await all(`select s.*, e."documentId" as "docId" from "Signature" s join "Envelope" e on e.id = s."envelopeDbId"`);
    const events = await all(`select * from "TimelineEvent"`);

    const itemsByDoc = groupBy(items, "documentId");
    const sigByDoc = groupBy(signatures, "docId");

    return clients.map((c) => ({
      client: c,
      documents: documents.filter((d) => String(d.clientId) === String(c.id)).map((d) => ({ ...d, items: itemsByDoc[String(d.id)] || [] })),
      invoices: invoices.filter((i) => String(i.clientId) === String(c.id)),
      signaturesByDoc: sigByDoc,
      events: events.filter((e) => String(e.clientId) === String(c.id)),
    }));
  } finally { await client.end(); }
}

function groupBy(rows, key) {
  const out = {};
  for (const r of rows) { const k = String(r[key]); (out[k] = out[k] || []).push(r); }
  return out;
}

// ---------------------------------------------------------------- writer ---
async function write(mapped) {
  const { sb } = await import(path.join(ROOT, "api", "_db.js"));
  let reqN = 0, evN = 0, tkN = 0;
  for (const { request, events, tokens } of mapped) {
    const created = await sb("requests?on_conflict=ref", {
      method: "POST", prefer: "resolution=merge-duplicates,return=representation", body: [request],
    });
    const rid = created && created[0] && created[0].id;
    reqN++;
    if (rid && events.length) {
      await sb("request_events", { method: "POST", prefer: "return=minimal", body: events.map((e) => ({ ...e, request_id: rid })) });
      evN += events.length;
    }
    if (tokens.length) {
      await sb("quote_tokens?on_conflict=token", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: tokens });
      tkN += tokens.length;
    }
  }
  return { reqN, evN, tkN };
}

// ------------------------------------------------------------------ main ---
(async () => {
  console.log(`» المصدر: ${SOURCE} | الوضع: ${WRITE ? "كتابة" : "تجربة (بلا كتابة)"} | LOCAL_DB=${process.env.LOCAL_DB === "1" ? "1" : "0"}`);
  const bundles = SOURCE === "prisma" ? await readPrisma() : readFixture(FIXTURE);
  console.log(`» حزم العملاء: ${bundles.length}`);

  const mapped = bundles.flatMap((b) => mapBundle(b));
  const tokens = mapped.reduce((s, m) => s + m.tokens.length, 0);
  const events = mapped.reduce((s, m) => s + m.events.length, 0);
  console.log(`» طلبات ستُنشأ: ${mapped.length} | أحداث: ${events} | روابط (tokens): ${tokens}`);

  if (mapped.length) {
    const s = mapped[0];
    console.log("\n— عيّنة أول طلب مُحوّل —");
    console.log(JSON.stringify({
      ref: s.request.ref, status: s.request.status, title: s.request.title,
      client: s.request.client_email, quote_number: s.request.quote?.number,
      quote_total: s.request.quote?.total, has_contract: !!s.request.contract,
      has_payment: !!s.request.payment, tokens: s.tokens.map((t) => `${t.kind}:${t.token.slice(0, 8)}…`),
    }, null, 2));
  }

  if (!WRITE) {
    console.log("\n✔ تجربة فقط — لم تُكتب أي بيانات. أضف --write للكتابة.");
    return;
  }
  const r = await write(mapped);
  console.log(`\n✔ كُتب: ${r.reqN} طلب · ${r.evN} حدث · ${r.tkN} رابط.`);
})().catch((e) => { console.error("✗ فشل:", e.message || e); process.exit(1); });
