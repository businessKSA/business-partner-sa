import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { currentAdmin } from '@/lib/auth';
import { priceInclVat, syncTokenValid } from '@/lib/catalog-sync';
import { methodsForService, PAYMENT_METHODS } from '@/lib/payment-methods';
import { COMPANY, VAT_RATE } from '@config/company';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * التصدير الكامل للكتالوج — الجرد الذي يقرأه n8n ليطابق نوشن والموقع.
 *
 * يختلف عن /api/catalog العامة: هذه تحمل الروابط والحقول الداخلية (صفحة نوشن،
 * مسار الموقع، مصدر آخر مزامنة)، فهي محمية — إما بجلسة مدير أو بمفتاح المزامنة.
 *
 * السعر شامل الضريبة يُحسب هنا ولا يُخزَّن: رقمان مخزَّنان لنفس السعر يتفرّقان
 * عاجلاً أو آجلاً، وهذا بالضبط ما نحن بصدد إصلاحه.
 */
export async function GET(req: Request) {
  const admin = await currentAdmin();
  const token = syncTokenValid(req.headers.get('authorization'));
  if (!admin && !token) {
    return NextResponse.json({ error: 'غير مصرّح.' }, { status: 401 });
  }

  const base = (process.env.APP_URL || '').replace(/\/+$/, '');
  const siteBase = (process.env.SITE_URL || 'https://businesspartner.sa').replace(/\/+$/, '');
  const notionBase = 'https://www.notion.so/';

  const services = await prisma.service.findMany({
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { code: 'asc' }],
  });

  const rows = services.map((s) => {
    const methods = methodsForService(s.paymentMethods);
    return {
      code: s.code,
      nameAr: s.nameAr,
      nameEn: s.nameEn,
      category: s.category,
      govPlatform: s.govPlatform,
      active: s.active,

      // التسعير — الرقم المخزَّن غير شامل الضريبة دائماً.
      priceExclVat: s.unitPrice,
      vatRate: VAT_RATE,
      priceInclVat: s.openPrice ? null : priceInclVat(s.unitPrice),
      openPrice: s.openPrice,
      unitAr: s.unitAr,
      unitEn: s.unitEn,
      minQty: s.minQty,
      govFeesSeparate: s.attachGovFees,

      // ما يترتّب على السعر: هل يصدر العرض وحده أم يصل المالك ليسعّره؟
      autoIssue: s.active && !s.openPrice && s.unitPrice > 0,

      paymentMethods: methods.map((m) => ({
        key: m,
        ar: PAYMENT_METHODS[m].ar,
        automatic: PAYMENT_METHODS[m].automatic,
      })),

      links: {
        panel: base ? `${base}/admin/catalog?edit=${s.id}` : null,
        portal: base ? `${base}/portal/services?code=${encodeURIComponent(s.code)}` : null,
        site: s.siteSlug ? `${siteBase}${s.siteSlug}` : null,
        notion: s.notionPageId ? `${notionBase}${String(s.notionPageId).replace(/-/g, '')}` : null,
      },

      terms: {
        paymentAr: s.paymentTermsAr,
        deliveryAr: s.deliveryAr,
        validityDays: s.validityDays ?? 30,
      },

      sync: { source: s.syncSource, at: s.syncedAt, updatedAt: s.updatedAt },
    };
  });

  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    currency: 'SAR',
    vatRate: VAT_RATE,
    vatNumber: COMPANY.vatNumber,
    counts: {
      total: rows.length,
      active: rows.filter((r) => r.active).length,
      autoIssue: rows.filter((r) => r.autoIssue).length,
      openPrice: rows.filter((r) => r.openPrice).length,
      linkedToNotion: rows.filter((r) => r.links.notion).length,
      linkedToSite: rows.filter((r) => r.links.site).length,
    },
    services: rows,
  });
}
