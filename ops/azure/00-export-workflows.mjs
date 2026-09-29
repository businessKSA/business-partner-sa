#!/usr/bin/env node
/**
 * تصدير كل سيرَات n8n دفعة واحدة (المرحلة ٠)
 *
 * واجهة n8n لا تحتوي زر «حمّل الكل» — التحميل فيها سير واحد في كل مرة.
 * هذا السكربت يسحبها كلها عبر الـAPI في ملف واحد + ملف لكل سير.
 *
 * التشغيل:
 *   export N8N_SRC_URL="https://businesspartnerai.app.n8n.cloud"
 *   export N8N_SRC_KEY="..."     # n8n ← Settings ← n8n API ← Create an API key
 *   node ops/azure/00-export-workflows.mjs
 *
 * المخرجات (كلها متجاهَلة في git — لا تُدفع):
 *   ops/n8n-export/all-workflows.json      كل السيرَات في ملف واحد (للاستيراد)
 *   ops/n8n-export/workflows/<id>.json     ملف لكل سير (للمراجعة والمقارنة)
 *   ops/n8n-export/inventory.csv           جدول: الاسم، الحالة، عدد العقد، الويبهوكس
 *
 * قراءة فقط — لا يعدّل ولا يحذف شيئاً في n8n.
 *
 * ⚠️  الملفات الناتجة تحتوي أسماء العقد وإعداداتها ونصوص الوكلاء. لا تحتوي
 *     أسرار الاعتمادات (n8n لا يصدّرها عبر الـAPI)، لكنها تحتوي معرّفات
 *     الاعتمادات ومسارات الويبهوك. لا ترفعها على Git ولا تشاركها.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const URL_ = (process.env.N8N_SRC_URL || '').replace(/\/+$/, '');
const KEY = process.env.N8N_SRC_KEY || '';
const OUT = process.env.N8N_EXPORT_DIR || 'ops/n8n-export';

if (!URL_ || !KEY) {
  console.error('\n✗ مطلوب: N8N_SRC_URL و N8N_SRC_KEY\n');
  console.error('  المفتاح من: n8n ← Settings ← n8n API ← Create an API key\n');
  process.exit(1);
}

async function get(path) {
  const res = await fetch(`${URL_}${path}`, {
    headers: { 'X-N8N-API-KEY': KEY, Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status} على ${path}\n${body.slice(0, 400)}`);
  }
  return res.json();
}

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

(async () => {
  console.log(`\nالمصدر: ${URL_}`);
  console.log('أسحب قائمة السيرَات...\n');

  const all = [];
  let cursor = null;
  do {
    const q = new URLSearchParams({ limit: '100' });
    if (cursor) q.set('cursor', cursor);
    const page = await get(`/api/v1/workflows?${q}`);
    all.push(...(page.data || []));
    cursor = page.nextCursor || null;
    process.stdout.write(`\r  حُمّل: ${all.length}`);
  } while (cursor);
  console.log(`\n\nالإجمالي: ${all.length} سير\n`);

  await mkdir(join(OUT, 'workflows'), { recursive: true });

  const rows = [['id', 'name', 'active', 'nodes', 'webhook_paths', 'updatedAt']];
  let active = 0;
  const webhookPaths = [];

  for (const wf of all) {
    await writeFile(join(OUT, 'workflows', `${wf.id}.json`), JSON.stringify(wf, null, 2));

    const nodes = wf.nodes || [];
    if (wf.active) active++;

    const paths = nodes
      .filter((n) => /webhook|chatTrigger|formTrigger/i.test(n.type || ''))
      .map((n) => n.parameters?.path || n.webhookId || '')
      .filter(Boolean);
    paths.forEach((p) => webhookPaths.push({ workflow: wf.name, path: p }));

    rows.push([wf.id, wf.name, wf.active ? 'نشط' : 'معطّل', nodes.length, paths.join(' | '), wf.updatedAt]);
  }

  await writeFile(join(OUT, 'all-workflows.json'), JSON.stringify(all, null, 2));
  await writeFile(join(OUT, 'inventory.csv'), '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\n'));

  console.log(`  ✓ ${OUT}/all-workflows.json      (للاستيراد في n8n الجديد)`);
  console.log(`  ✓ ${OUT}/workflows/*.json        (${all.length} ملف)`);
  console.log(`  ✓ ${OUT}/inventory.csv           (جدول المراجعة)\n`);
  console.log(`  نشط: ${active}   معطّل: ${all.length - active}   مسارات ويبهوك: ${webhookPaths.length}\n`);
  console.log('  كل مسار ويبهوك أعلاه لازم يُحدَّث في نظامه الخارجي بعد التحويل');
  console.log('  (واتساب Cloud API، vercel.json، صفحة محفول، لوحات ai-space).\n');
})().catch((e) => {
  console.error(`\n✗ ${e.message}\n`);
  process.exit(1);
});
