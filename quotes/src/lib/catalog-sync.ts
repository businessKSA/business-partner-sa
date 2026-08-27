/**
 * مزامنة الكتالوج بين المصادر الثلاثة.
 *
 * المشكلة التي يحلّها هذا الملف: السعر كان يُكتب في ثلاثة أماكن — كتالوج نوشن
 * الرسمي، وملفات الموقع التعريفي، وقاعدة اللوحة — فتفرّقت الأرقام. الآن:
 *
 *   نوشن (سطح التحرير البشري)  ──n8n──▶  /api/catalog/sync  ──▶  قاعدة اللوحة
 *   قاعدة اللوحة  ──webhook──▶  n8n  ──▶  صف نوشن + إعادة نشر الموقع
 *   الموقع عند البناء  ──يقرأ──▶  /api/catalog
 *
 * قاعدة اللوحة هي مخزن الحقيقة وقت الإصدار: العرض والعقد والفاتورة كلها تقرأ
 * منها، فأي رقم لا يصلها ليس سعراً فعلياً مهما نُشر في مكان آخر.
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from './db';
import { VAT_RATE } from '@config/company';
import { round2 } from './money';
import { audit } from './timeline';

export type SyncInput = {
  code: string;
  nameAr?: string;
  nameEn?: string;
  category?: string;
  descAr?: string | null;
  descEn?: string | null;
  unitPrice?: number | null;
  unitAr?: string;
  unitEn?: string;
  minQty?: number;
  openPrice?: boolean;
  attachGovFees?: boolean;
  paymentTermsAr?: string;
  paymentTermsEn?: string;
  deliveryAr?: string;
  deliveryEn?: string;
  paymentMethods?: string;
  notionPageId?: string | null;
  siteSlug?: string | null;
  govPlatform?: string | null;
  validityDays?: number | null;
  active?: boolean;
};

export type SyncOutcome = {
  code: string;
  action: 'created' | 'updated' | 'unchanged' | 'rejected';
  changed: string[];
  reason?: string;
};

const TEXT_FIELDS = [
  'nameAr', 'nameEn', 'category', 'descAr', 'descEn', 'unitAr', 'unitEn',
  'paymentTermsAr', 'paymentTermsEn', 'deliveryAr', 'deliveryEn',
  'paymentMethods', 'notionPageId', 'siteSlug', 'govPlatform',
] as const;

/** السعر بعد ضريبة القيمة المضافة — يُحسب ولا يُخزَّن، فلا يتناقض مصدران. */
export function priceInclVat(unitPrice: number): number {
  return round2(unitPrice * (1 + VAT_RATE));
}

/**
 * إدخال صف واحد. الترتيب مقصود: الكود مفتاح المطابقة الوحيد بين المصادر،
 * ولا يُنشأ صف بلا اسم عربي لأن العرض والعقد لا يُطبعان بلا اسم.
 */
export async function syncService(
  input: SyncInput,
  actor: string,
  source: 'notion' | 'site' | 'panel' | 'api',
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<SyncOutcome> {
  const code = String(input.code || '').trim().toUpperCase();
  if (!code) return { code: '', action: 'rejected', changed: [], reason: 'الكود مطلوب.' };

  const existing = await db.service.findUnique({ where: { code } });
  const nameAr = String(input.nameAr || existing?.nameAr || '').trim();
  if (!nameAr) {
    return { code, action: 'rejected', changed: [], reason: 'الاسم بالعربي مطلوب لخدمة جديدة.' };
  }

  const data: Record<string, unknown> = {};
  for (const f of TEXT_FIELDS) {
    const v = input[f];
    if (v === undefined) continue;
    data[f] = v === null ? null : String(v);
  }
  if (input.nameAr !== undefined) data.nameAr = nameAr;
  if (input.unitPrice !== undefined && input.unitPrice !== null) {
    const n = Number(input.unitPrice);
    if (!Number.isFinite(n) || n < 0) {
      return { code, action: 'rejected', changed: [], reason: 'السعر غير صالح.' };
    }
    data.unitPrice = round2(n);
  }
  if (input.minQty !== undefined) data.minQty = Math.max(1, Math.trunc(Number(input.minQty) || 1));
  if (input.validityDays !== undefined) {
    data.validityDays = input.validityDays === null ? null : Math.trunc(Number(input.validityDays));
  }
  for (const f of ['openPrice', 'attachGovFees', 'active'] as const) {
    if (input[f] !== undefined) data[f] = Boolean(input[f]);
  }

  if (!existing) {
    const created = await db.service.create({
      data: {
        code,
        nameAr,
        nameEn: String(input.nameEn || nameAr),
        category: String(input.category || 'عام'),
        ...data,
        syncSource: source,
        syncedAt: new Date(),
      } as Prisma.ServiceUncheckedCreateInput,
    });
    await audit({
      action: 'SERVICE_SYNCED',
      entityType: 'Service',
      entityId: created.id,
      actor,
      payload: { code, source, action: 'created', fields: Object.keys(data) },
    });
    return { code, action: 'created', changed: Object.keys(data) };
  }

  const changed = Object.keys(data).filter((k) => {
    const before = (existing as unknown as Record<string, unknown>)[k];
    return before !== data[k];
  });
  if (!changed.length) return { code, action: 'unchanged', changed: [] };

  await db.service.update({
    where: { code },
    data: { ...data, syncSource: source, syncedAt: new Date() } as Prisma.ServiceUncheckedUpdateInput,
  });
  await audit({
    action: 'SERVICE_SYNCED',
    entityType: 'Service',
    entityId: existing.id,
    actor,
    payload: {
      code,
      source,
      changed: changed.map((k) => ({
        field: k,
        from: (existing as unknown as Record<string, unknown>)[k],
        to: data[k],
      })),
    },
  });
  return { code, action: 'updated', changed };
}

/**
 * إشعار خارجي بأن الكتالوج تغيّر — يلتقطه n8n فيحدّث صف نوشن ويعيد نشر الموقع.
 * لا يُفشِل العملية عند تعذّره: تعديل السعر نجح في مخزن الحقيقة بالفعل،
 * وإسقاط التعديل لأن سير عمل خارجي متوقف يجعل الحال أسوأ لا أفضل.
 */
export async function notifyCatalogChanged(payload: {
  codes: string[];
  source: string;
  actor: string;
}): Promise<{ sent: boolean; status?: number; error?: string }> {
  const url = process.env.CATALOG_WEBHOOK_URL;
  if (!url) return { sent: false, error: 'CATALOG_WEBHOOK_URL غير معرّف' };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.CATALOG_WEBHOOK_TOKEN
          ? { authorization: `Bearer ${process.env.CATALOG_WEBHOOK_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({ ...payload, at: new Date().toISOString() }),
      signal: AbortSignal.timeout(8000),
    });
    return { sent: res.ok, status: res.status };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** التحقق من مفتاح المزامنة الوارد. مقارنة بطول ثابت لا تُسرّب طول المفتاح. */
export function syncTokenValid(header: string | null): boolean {
  const expected = process.env.CATALOG_SYNC_TOKEN;
  if (!expected) return false;
  const given = String(header || '').replace(/^Bearer\s+/i, '').trim();
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
