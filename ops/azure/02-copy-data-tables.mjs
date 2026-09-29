#!/usr/bin/env node
/**
 * نسخ جداول بيانات n8n من سحابة n8n إلى n8n المستضاف على Azure (المرحلة ٣)
 *
 * جداول البيانات تحمل بياناتك الحية: المهام، الصفقات، القيود المالية، سجل الوكلاء.
 * ما فيه زر «تصدير» لها في الواجهة — لهذا هذا السكربت.
 *
 * التشغيل:
 *   export N8N_SRC_URL="https://businesspartnerai.app.n8n.cloud"
 *   export N8N_SRC_KEY="..."      # n8n القديم → Settings → API → Create API key
 *   export N8N_DST_URL="https://n8n.businesspartner.sa"
 *   export N8N_DST_KEY="..."      # n8n الجديد → نفس المسار
 *
 *   node ops/azure/02-copy-data-tables.mjs --dry-run   # عدّ فقط، لا كتابة
 *   node ops/azure/02-copy-data-tables.mjs             # النسخ الفعلي
 *
 * ⚠️  أوقف كتابة السيرَات قبل النسخ (عطّل السيرَات في المصدر)، وإلا ضاعت صفوف
 *     كُتبت أثناء التشغيل.
 *
 * ملاحظة: مسار API جداول البيانات تغيّر بين إصدارات n8n. إذا رجع 404، شغّل
 * السكربت بـ --probe ليطبع المسارات التي جرّبها وأيها استجاب.
 */

const SRC_URL = (process.env.N8N_SRC_URL || '').replace(/\/+$/, '');
const SRC_KEY = process.env.N8N_SRC_KEY || '';
const DST_URL = (process.env.N8N_DST_URL || '').replace(/\/+$/, '');
const DST_KEY = process.env.N8N_DST_KEY || '';

const DRY_RUN = process.argv.includes('--dry-run');
const PROBE = process.argv.includes('--probe');

// الجدول العاشر بقايا اختبار قديم — لا يُنقل
const SKIP_TABLES = [/^BP_HEALTH_RESULT_/];

const PAGE = 100;

// مرشحات مسار API — تُجرَّب بالترتيب حتى تنجح واحدة
const LIST_PATHS = [
  (p) => `/api/v1/projects/${p}/data-tables`,
  (p) => `/api/v1/data-tables?projectId=${p}`,
  () => `/api/v1/data-tables`,
];
const ROWS_PATHS = [
  (p, t) => `/api/v1/projects/${p}/data-tables/${t}/rows`,
  (p, t) => `/api/v1/data-tables/${t}/rows`,
];

function die(msg) { console.error(`\n✗ ${msg}\n`); process.exit(1); }

if (!SRC_URL || !SRC_KEY) die('N8N_SRC_URL و N8N_SRC_KEY مطلوبان.');
if (!DRY_RUN && !PROBE && (!DST_URL || !DST_KEY)) die('N8N_DST_URL و N8N_DST_KEY مطلوبان للنسخ الفعلي.');

async function api(base, key, path, opts = {}) {
  const res = await fetch(`${base}${path}`, {
    ...opts,
    headers: { 'X-N8N-API-KEY': key, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const text = await res.text();
  let body; try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: res.ok, status: res.status, body };
}

/** يجرّب عدة مسارات ويرجع أول واحد ينجح */
async function resolve(base, key, builders, ...args) {
  const tried = [];
  for (const build of builders) {
    const path = build(...args);
    const r = await api(base, key, path);
    tried.push(`${r.status}  ${path}`);
    if (r.ok) return { path, build, res: r, tried };
  }
  return { path: null, tried };
}

async function projectId(base, key) {
  const r = await api(base, key, '/api/v1/projects');
  if (!r.ok) die(`تعذّر قراءة المشاريع من ${base} (HTTP ${r.status}). تحقق من مفتاح API.`);
  const list = r.body?.data || [];
  const personal = list.find((p) => p.type === 'personal') || list[0];
  if (!personal) die(`لا يوجد أي مشروع في ${base}.`);
  return personal.id;
}

async function allRows(base, key, build, pid, tableId) {
  const out = [];
  for (let offset = 0; ; offset += PAGE) {
    const sep = build(pid, tableId).includes('?') ? '&' : '?';
    const r = await api(base, key, `${build(pid, tableId)}${sep}limit=${PAGE}&skip=${offset}`);
    if (!r.ok) die(`فشل قراءة صفوف ${tableId} (HTTP ${r.status}).`);
    const rows = r.body?.data ?? r.body?.rows ?? [];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

(async () => {
  console.log(`\nالمصدر : ${SRC_URL}`);
  if (DST_URL) console.log(`الوجهة : ${DST_URL}`);
  console.log(DRY_RUN ? 'الوضع  : تجربة (عدّ فقط)\n' : PROBE ? 'الوضع  : فحص مسارات\n' : 'الوضع  : نسخ فعلي\n');

  const srcPid = await projectId(SRC_URL, SRC_KEY);
  const found = await resolve(SRC_URL, SRC_KEY, LIST_PATHS, srcPid);

  if (PROBE || !found.path) {
    console.log('المسارات المجرَّبة (الحالة  المسار):');
    found.tried.forEach((t) => console.log('  ' + t));
    if (!found.path) die('لم يستجب أي مسار. راجع إصدار n8n ووثائق API عنده.');
    console.log(`\n✓ المسار العامل: ${found.path}\n`);
    if (PROBE) return;
  }

  const tables = (found.res.body?.data || []).filter(
    (t) => !SKIP_TABLES.some((re) => re.test(t.name))
  );
  console.log(`عدد الجداول المؤهلة: ${tables.length}\n`);

  let dstPid = null, rowsBuild = null;
  if (!DRY_RUN) {
    dstPid = await projectId(DST_URL, DST_KEY);
    const dstTables = await resolve(DST_URL, DST_KEY, LIST_PATHS, dstPid);
    if (!dstTables.path) die('تعذّر الوصول لجداول البيانات في الوجهة.');
    const existing = new Map((dstTables.res.body?.data || []).map((t) => [t.name, t.id]));
    for (const t of tables) {
      if (!existing.has(t.name)) {
        die(`الجدول «${t.name}» غير موجود في الوجهة.\n` +
            `  أنشئ الجداول في n8n الجديد أولاً بنفس الأسماء والأعمدة،\n` +
            `  أو استورد السيرَات (تنشئ الجداول تلقائياً عند أول تشغيل).`);
      }
      t.dstId = existing.get(t.name);
    }
    const probeRows = await resolve(SRC_URL, SRC_KEY, ROWS_PATHS, srcPid, tables[0].id);
    if (!probeRows.path) die('تعذّر تحديد مسار الصفوف.');
    rowsBuild = probeRows.build;
  } else {
    const probeRows = await resolve(SRC_URL, SRC_KEY, ROWS_PATHS, srcPid, tables[0].id);
    if (!probeRows.path) die('تعذّر تحديد مسار الصفوف.');
    rowsBuild = probeRows.build;
  }

  let grand = 0;
  for (const t of tables) {
    const rows = await allRows(SRC_URL, SRC_KEY, rowsBuild, srcPid, t.id);
    grand += rows.length;

    if (DRY_RUN) { console.log(`  ${t.name.padEnd(34)} ${String(rows.length).padStart(6)} صف`); continue; }
    if (rows.length === 0) { console.log(`  ${t.name.padEnd(34)}      0 صف — تخطٍ`); continue; }

    // تنظيف الحقول التي يولّدها n8n نفسه
    const clean = rows.map(({ id, createdAt, updatedAt, ...rest }) => rest);

    for (let i = 0; i < clean.length; i += 50) {
      const chunk = clean.slice(i, i + 50);
      const r = await api(DST_URL, DST_KEY, rowsBuild(dstPid, t.dstId), {
        method: 'POST',
        body: JSON.stringify({ data: chunk }),
      });
      if (!r.ok) die(`فشل كتابة ${t.name} عند الصف ${i} (HTTP ${r.status}): ${JSON.stringify(r.body).slice(0, 300)}`);
    }
    console.log(`  ✓ ${t.name.padEnd(34)} ${String(rows.length).padStart(6)} صف`);
  }

  console.log(`\nالإجمالي: ${grand} صف عبر ${tables.length} جدول.`);
  if (DRY_RUN) console.log('لم يُكتب شيء. أعد التشغيل بلا --dry-run للنسخ الفعلي.');
  else console.log('تحقّق الآن من تطابق عدد الصفوف في واجهة n8n الجديد قبل التحويل.');
})().catch((e) => die(e.stack || String(e)));
