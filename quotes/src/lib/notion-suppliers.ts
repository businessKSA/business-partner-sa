/**
 * مزامنة موردي نوشن إلى قاعدة اللوحة.
 *
 * قاعدة الموردين تُدار في نوشن — هناك يُسجَّل المورد وتُوثَّق اتفاقيته وعمولته
 * وأولويته. واللوحة لا تحتاج ذلك كله، بل ثلاثة حقول تكفي لتوجيه طلب عرض:
 * اسمٌ وبريدٌ وتصنيف. فتُنسخ هذه وحدها، وتبقى نوشن مصدر الحقيقة.
 *
 * والمطابقة بمعرّف صفحة نوشن لا بالاسم: من صحّح اسم مورده في نوشن لا يريد
 * مورداً ثانياً في اللوحة، ومن سجّل شركتين بنفس الاسم يريدهما اثنتين.
 */
import { prisma } from './db';
import { SUPPLIER_CATEGORIES } from './categories';
import { logEvent } from './timeline';

interface NotionSupplierRow {
  notionPageId: string;
  nameAr: string;
  email: string;
  phone: string;
  city: string;
  priority: string;
  types: string[];
  notes: string;
}

/**
 * من تسمية نوشن العربية إلى كود التصنيف.
 *
 * المطابقة باحتواء الكلمة لا بالتساوي: «مكاتب مؤثثة» و«مكتب مؤثث» و«مكاتب
 * مؤثثة جاهزة» شيء واحد كتبه ثلاثة، ومساواة النص تجعل اثنين منهم بلا تصنيف.
 */
const TYPE_HINTS: [string, string][] = [
  ['مركز أعمال', 'workspace'],
  ['مكاتب', 'workspace'],
  ['مكتب', 'workspace'],
  ['مساحات', 'workspace'],
  ['كوروكنق', 'workspace'],
  ['سكن', 'housing'],
  ['إسكان', 'housing'],
  ['اسكان', 'housing'],
  ['مطور', 'realestate'],
  ['مالك', 'realestate'],
  ['وسيط', 'realestate'],
  ['عقار', 'realestate'],
  ['تشطيب', 'fitout'],
  ['مقاولات', 'fitout'],
  ['أثاث', 'fitout'],
  ['نقل', 'logistics'],
  ['شحن', 'logistics'],
  ['لوجست', 'logistics'],
  ['تقنية', 'it'],
  ['تجهيزات', 'it'],
  ['تسويق', 'marketing'],
  ['إنتاج', 'marketing'],
];

export function categoriesFromNotionTypes(types: string[]): string[] {
  const out = new Set<string>();
  for (const raw of types) {
    const t = String(raw || '').trim();
    if (!t) continue;
    // الكود نفسه إن كُتب كوداً — قاعدة تكتب workspace مباشرةً تمرّ كما هي.
    if (SUPPLIER_CATEGORIES[t.toLowerCase()]) {
      out.add(t.toLowerCase());
      continue;
    }
    const hit = TYPE_HINTS.find(([hint]) => t.includes(hint));
    if (hit) out.add(hit[1]);
    else out.add('other');
  }
  return [...out];
}

/**
 * يجلب موردي نوشن عبر الموقع ويحدّث صفوف اللوحة.
 *
 * لا يحذف: مورد اختفى من نوشن قد يكون نُقل أو رُشِّح بمرشِّح، وحذفه هنا يحذف
 * معه عروضه وطلباتها. فمن غاب يُعطَّل ولا يُمحى — ولا يُعطَّل إلا من قال نوشن
 * إنه موقوف.
 */
export async function syncSuppliersFromNotion(
  databaseId?: string,
  actor = 'admin',
): Promise<{ ok: true; created: number; updated: number; total: number } | { ok: false; error: string }> {
  const base = (process.env.SITE_API_URL || '').replace(/\/+$/, '');
  const token = process.env.PANEL_BRIDGE_TOKEN;
  if (!base || !token) return { ok: false, error: 'الجسر مع الموقع غير مضبوط' };

  let data: { ok?: boolean; suppliers?: NotionSupplierRow[]; error?: string };
  try {
    const res = await fetch(`${base}/api/notion-suppliers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ databaseId: databaseId || undefined }),
      signal: AbortSignal.timeout(60000),
    });
    data = (await res.json().catch(() => ({}))) as typeof data;
    if (!res.ok || data.ok !== true) return { ok: false, error: data.error || `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const rows = Array.isArray(data.suppliers) ? data.suppliers : [];
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    if (!row.notionPageId || !row.nameAr) continue;
    const fields = {
      nameAr: row.nameAr,
      email: row.email || null,
      phone: row.phone || null,
      city: row.city || null,
      categories: categoriesFromNotionTypes(row.types).join(',') || null,
      notes: row.notes || null,
      active: row.priority !== 'موقوف',
    };

    const existing = await prisma.supplier.findUnique({ where: { notionPageId: row.notionPageId } });
    if (existing) {
      await prisma.supplier.update({ where: { id: existing.id }, data: fields });
      updated += 1;
    } else {
      await prisma.supplier.create({ data: { ...fields, notionPageId: row.notionPageId } });
      created += 1;
    }
  }

  await logEvent({
    entityType: 'supplier',
    entityId: 'sync',
    code: 'SUPPLIERS_SYNCED',
    titleAr: `حُدّثت قاعدة الموردين من نوشن — ${created} جديد و${updated} محدَّث`,
    titleEn: `Suppliers synced from Notion — ${created} new, ${updated} updated`,
    actor,
    actorKind: 'admin',
    clientVisible: false,
  });

  return { ok: true, created, updated, total: rows.length };
}
