import { NextResponse } from 'next/server';
import { currentAdmin } from '@/lib/auth';
import { syncService, syncTokenValid, type SyncInput, type SyncOutcome } from '@/lib/catalog-sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** حدّ أعلى للدفعة الواحدة — كتالوج نوشن كله ٢١٦ صفاً، فهذا يستوعبه مرّة واحدة. */
const MAX_BATCH = 400;

/**
 * إدخال تعديلات الكتالوج من مصدر خارجي — نوشن عبر n8n في المقام الأول.
 *
 * محمي بمفتاح `CATALOG_SYNC_TOKEN` (أو بجلسة مدير للتجربة اليدوية). بلا مفتاح
 * معرّف في البيئة تُرفض كل النداءات: نقطة تكتب الأسعار لا تُترك مفتوحة.
 *
 * الاستجابة تُفصّل كل صف: أُنشئ أم عُدِّل أم لم يتغيّر أم رُفض ولماذا — حتى
 * يُقرأ في n8n ويُعرض لك بدل أن تُبتلع الأخطاء بصمت.
 */
export async function POST(req: Request) {
  const token = syncTokenValid(req.headers.get('authorization'));
  const admin = token ? null : await currentAdmin();
  if (!token && !admin) {
    return NextResponse.json({ error: 'غير مصرّح.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'جسم الطلب ليس JSON صالحاً.' }, { status: 400 });
  }

  const payload = body as { services?: SyncInput[]; source?: string; dryRun?: boolean };
  const list = Array.isArray(payload?.services)
    ? payload.services
    : Array.isArray(body)
      ? (body as SyncInput[])
      : null;

  if (!list || !list.length) {
    return NextResponse.json({ error: 'لا توجد خدمات في الطلب.' }, { status: 400 });
  }
  if (list.length > MAX_BATCH) {
    return NextResponse.json(
      { error: `الدفعة أكبر من الحد (${MAX_BATCH} صفاً).` },
      { status: 413 },
    );
  }

  const rawSource = String(payload?.source || 'notion').toLowerCase();
  const source = (['notion', 'site', 'panel', 'api'] as const).includes(rawSource as never)
    ? (rawSource as 'notion' | 'site' | 'panel' | 'api')
    : 'api';
  const actor = admin ? `admin:${admin}` : `sync:${source}`;

  const results: SyncOutcome[] = [];
  for (const item of list) {
    try {
      results.push(await syncService(item, actor, source));
    } catch (e) {
      results.push({
        code: String(item?.code || ''),
        action: 'rejected',
        changed: [],
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const summary = {
    created: results.filter((r) => r.action === 'created').length,
    updated: results.filter((r) => r.action === 'updated').length,
    unchanged: results.filter((r) => r.action === 'unchanged').length,
    rejected: results.filter((r) => r.action === 'rejected').length,
  };

  return NextResponse.json({ source, total: results.length, summary, results });
}
