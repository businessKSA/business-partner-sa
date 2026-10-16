// Business Partner — جرد متغيّرات البيئة التي يقرؤها الكود، مصنَّفةً بحسب الخدمة.
//
// يمسح api/ وlib/ وdb/ وsite/scripts/ ويستخرج **أسماء** المتغيّرات فقط (لا قيم، ولا
// يقرأ بيئة التشغيل). هذا هو مصدر جدول المتغيّرات في docs/azure-migration-2026-10-11.md
// ومرجع من ينشئ التطبيق في Azure: ما يُعدّ سراً يذهب إلى «Container Apps secrets»
// (أو Key Vault) وما سواه متغيّر بيئة عادي.
//
//   node ops/azure/env-scan.mjs              جدول نصي
//   node ops/azure/env-scan.mjs --md         جدول Markdown (للوثيقة)
//   node ops/azure/env-scan.mjs --json       للقراءة الآلية
//
// مسحٌ نصي لا تنفيذ: قد يفوته اسمٌ يُركَّب ديناميكياً (`process.env[prefix + x]`)، وقد
// يلتقط نصاً يشبه الاسم. هو جرد للمراجعة، لا بديلاً عن قراءة الكود عند الشك.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIRS = ["api", "lib", "db", "site/scripts"];

// الترتيب مهم: أول قاعدة تطابق تربح.
export const SERVICES = [
  [/^(AZURE_OPENAI|AZURE_AI_)/, "Azure OpenAI"],
  [/^(AZURE_DOCINTEL|AZURE_FORMRECOGNIZER)/, "Azure Document Intelligence"],
  [/^AZURE_STORAGE/, "Azure Blob Storage"],
  [/^(AZURE_TENANT|AZURE_CLIENT|AZURE_GRAPH)/, "Microsoft Graph / SharePoint"],
  [/^(AZURE_PG|AZURE_POSTGRES|DB_DRIVER)/, "Azure Database for PostgreSQL"],
  [/^(ACS_|AZURE_ACS|AZURE_COMMUNICATION)/, "Azure Communication Services (بريد)"],
  [/^SUPABASE/, "Supabase (قاعدة البيانات الحالية)"],
  [/^MOYASAR/, "Moyasar (الدفع)"],
  [/^TAMARA/, "Tamara (التقسيط)"],
  [/^DAFTRA/, "Daftra (الفواتير)"],
  [/^(NOTION|BusinessPartnerSiteNotion|BUSINESS_PARTNER_SITE_NOTION)$|^NOTION_/, "Notion"],
  [/^(WHATSAPP|WA_|META_WHATSAPP|OWNER_WA|OWNER_WHATSAPP|CRM_OWNER_WHATSAPP|NOTIFY_PHONE)/, "واتساب (Meta)"],
  [/^DOCUSIGN/, "DocuSign"],
  [/^(NAFATH|PANEL_REQUIRE_NAFATH|PANEL_TICKET|OWNER_NATIONAL_IDS)/, "نفاذ"],
  [/^ETIMAD/, "اعتماد (Etimad)"],
  [/^(GOOGLE_SA|GOOGLE_CALENDAR)/, "Google Calendar"],
  [/^GOOGLE_CLIENT_ID$/, "دخول Google"],
  [/^(N8N|BP_ATS_WEBHOOK|LEAD_WEBHOOK|DOC_AGENT_SYNC)/, "n8n (الأتمتة)"],
  [/^(RESEND|OTP_FROM_EMAIL)/, "Resend (البريد)"],
  [/^(CONTENT_|GITHUB|GH_TOKEN)/, "GitHub (مزامنة المحتوى)"],
  [/^(CRON_SECRET|CV_RUNNER)/, "المهام المجدولة"],
  [/^VERCEL/, "Vercel (يزول بالنقل)"],
  [/^(LOCAL_|APP_ENV|PORT$|SIMPLE_TEST|OTP_DEV|SIMPLE_V1|SIMPLE_OPS|CONTRACT_MODE|EMAIL_MODE|PAYMENTS_MODE|WHATSAPP_MODE|CALENDAR_MODE|TAMARA_MODE)/, "أوضاع التشغيل والتطوير"],
  [/^(OTP_SECRET|DASHBOARD_KEY|LEADS_KEY|PANEL_|DOC_AGENT_HOOK_KEY|PANEL_BRIDGE_TOKEN)/, "مفاتيح الدخول والتوقيع"],
  [/^(COMPANY_|BP_BANK|BP_OWNER|OWNER_|BP_OPEN|BP_NOTIFY|BOOKING_|BP_HIDDEN)/, "هوية الشركة والمالك"],
  [/^(MKT_SITE_BASE|SITE_BASE|SITE_ORIGIN|PORTAL_URL|QUOTES_PANEL_URL|CATALOG)/, "عناوين الموقع (يتغيّر النطاق = تُراجع)"],
  [/^(DOC_AGENT|EMP_|EMPLOYER|ESCROW|GRACE|HIRE|JOBS_FEED|SIMPLE_|SS_|SUPPLIER)/, "إعدادات المنتجات (حدود وأرقام)"],
];

// DATABASE_URL وDIRECT_DATABASE_URL (لوحة العروض/Prisma) تحملان كلمة سر القاعدة داخل الرابط؛ وSMTP_PASS كلمة سر بريد.
// كلاهما لم يكن يُعدّ سراً فكان load-env.mjs يضعه متغيّراً عادياً ظاهراً في بوابة Azure.
const SECRET = /(KEY|SECRET|TOKEN|PASSWORD|PRIVATE|CONNECTION_STRING|_PG_URL|POSTGRES_URL|DATABASE_URL|(^|_)PASS$|_CODES?$|WEBHOOK|^NOTION$|^BusinessPartnerSiteNotion$|^GH_|^GITHUB_PAT$)/i;
const NOT_SECRET = /^(DOC_AGENT_SERVICE_CODES|GOOGLE_CLIENT_ID|MOYASAR_PUBLISHABLE_KEY|MOYASAR_GOOGLE_MERCHANT_ID|DOCUSIGN_INTEGRATION_KEY|CATALOG_FROM_PANEL|.*_PUBLISHABLE_.*|AZURE_PG_SSL.*|AZURE_PG_POOL_MAX|AZURE_STORAGE_SUFFIX|AZURE_STORAGE_CONTAINER)$/;
// أسماء تُمسح من النص لكنها ليست متغيّرات (حروف كبيرة داخل أوامر env()).
const NOISE = /^(faq|how|popular|sFuture|sHired|sInt|sNew|sOffer|sRej|sReview|sSent|sShort|search|NOTION|NODE_ENV)$/;

export function classify(name) {
  for (const [re, label] of SERVICES) if (re.test(name)) return label;
  return "أخرى";
}
export const isSecret = (name) => !NOT_SECRET.test(name) && SECRET.test(name);

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!["node_modules", ".next", ".git"].includes(e.name)) walk(p, out); }
    else if (/\.(m?js)$/.test(e.name)) out.push(p);
  }
}

export function scanEnv(root = ROOT) {
  const files = [];
  for (const d of DIRS) walk(path.join(root, d), files);
  const map = new Map();
  const add = (v, f) => { if (!map.has(v)) map.set(v, new Set()); map.get(v).add(path.relative(root, f)); };
  for (const f of files) {
    const t = fs.readFileSync(f, "utf8");
    for (const m of t.matchAll(/envFrom\(\s*\[([^\]]*)\]/g)) for (const n of m[1].matchAll(/["'`]([A-Za-z][A-Za-z0-9_]*)["'`]/g)) add(n[1], f);
    for (const m of t.matchAll(/(?:_ENV|ENV_NAMES|_KEYS|_VARS)\s*=\s*\[([^\]]*)\]/g)) for (const n of m[1].matchAll(/["'`]([A-Za-z][A-Za-z0-9_]*)["'`]/g)) add(n[1], f);
    for (const m of t.matchAll(/process\.env\.([A-Za-z][A-Za-z0-9_]*)/g)) add(m[1], f);
    for (const m of t.matchAll(/process\.env\[\s*["'`]([A-Za-z][A-Za-z0-9_]*)["'`]\s*\]/g)) add(m[1], f);
    for (const m of t.matchAll(/\b(?:env|envStr|envNum|envBool|getenv|ENV|envFrom)\(\s*["'`]([A-Z][A-Z0-9_]*)["'`]/g)) add(m[1], f);
    for (const m of t.matchAll(/\b(?:E|env|ENV)\.([A-Z][A-Z0-9_]{3,})\b/g)) add(m[1], f);
  }
  return [...map.entries()]
    .filter(([n]) => !NOISE.test(n))
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, set]) => ({ name, service: classify(name), secret: isSecret(name), files: [...set].sort() }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rows = scanEnv();
  const a = process.argv.slice(2);
  if (a.includes("--json")) console.log(JSON.stringify(rows, null, 2));
  else if (a.includes("--md")) {
    const groups = new Map();
    for (const r of rows) { if (!groups.has(r.service)) groups.set(r.service, []); groups.get(r.service).push(r); }
    for (const [svc, list] of [...groups.entries()].sort((x, y) => x[0].localeCompare(y[0]))) {
      console.log(`\n**${svc}** (${list.length})\n`);
      console.log("| المتغيّر | النوع | أين يُقرأ |\n|---|---|---|");
      for (const r of list) {
        const where = r.files.slice(0, 3).map((f) => f.replace(/^api\//, "")).join("، ") + (r.files.length > 3 ? ` +${r.files.length - 3}` : "");
        console.log(`| \`${r.name}\` | ${r.secret ? "سرّ" : "عادي"} | ${where} |`);
      }
    }
  } else for (const r of rows) console.log(`${r.secret ? "S" : " "} ${r.name.padEnd(40)} ${r.service}`);
  if (process.stdout.isTTY) console.error(`\n${rows.length} متغيّراً`);
}
