/**
 * استيراد كتالوج الموقع التعريفي إلى كتالوج النظام.
 *
 * الموقع ينشر 95 خدمة و10 باقات، بينما كان كتالوج النظام يحمل 24 خدمة فقط —
 * فما لا وجود له في الكتالوج لا يمكن إصدار عرض سعر ولا عقد ولا فاتورة له.
 * هذا المستورد يجعل كل خدمة وكل باقة منشورة على الموقع صالحة لدورة كاملة:
 * عرض سعر ← عقد ← سداد ← فاتورة.
 *
 * قاعدة صارمة: لا يُلمَس سعر خدمة موجودة. المالك يعدّل الأسعار يدوياً من
 * لوحة التحكم، ولو أعاد كل نشر كتابة الأسعار من ملف الموقع لضاع كل تعديل.
 * تُنشأ الناقصة فقط، وتُحدَّث حقول الوصف غير السعرية للموجودة.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { PrismaClient } from '@prisma/client';

type SiteService = {
  code?: string | null;
  nameAr?: string;
  nameEn?: string;
  categoryAr?: string;
  category?: string;
  govPlatform?: string;
  pricingModel?: string;
  amount?: number | null;
  govFeesSeparate?: boolean;
};

type SitePackage = {
  key?: string;
  nameAr?: string;
  nameEn?: string;
  amount?: number | null;
  billingPeriod?: string;
  featuresAr?: string[];
  featuresEn?: string[];
};

type SiteCatalog = { services?: SiteService[]; packages?: SitePackage[] };

/**
 * السعر مفتوح فقط حين لا يوجد رقم معلن، أو حين يكون التسعير نسبة من قيمة
 * الصفقة فلا يُعرف رقمه قبل معرفتها.
 *
 * «يبدأ من» لم تعد سعراً مفتوحاً بقرار المالك (٢٥ أغسطس ٢٠٢٦): الرقم المنشور
 * على الموقع هو السعر، والزيادة — إن وُجدت — تُضاف كبند مستقل في العرض.
 * أثرها المباشر: كل خدمة وباقة عليها رقم صارت تُصدر عرضها تلقائياً.
 */
function isOpenPrice(pricingModel: string | undefined, amount: number | null | undefined): boolean {
  const m = (pricingModel || '').trim();
  if (!amount || amount <= 0) return true;
  return m === 'Requires Proposal' || m === 'Percent' || m === 'Custom Pricing';
}

function unitFor(pricingModel: string | undefined): { ar: string; en: string } {
  switch ((pricingModel || '').trim()) {
    case 'Monthly':
      return { ar: 'شهرياً', en: 'per month' };
    case 'Per Candidate':
      return { ar: 'مرشح', en: 'per candidate' };
    default:
      return { ar: 'خدمة', en: 'service' };
  }
}

function termsFor(pricingModel: string | undefined): { ar: string; en: string } {
  return (pricingModel || '').trim() === 'Monthly'
    ? { ar: 'يُسدَّد شهرياً مقدماً', en: 'Payable monthly in advance' }
    : { ar: 'كامل المبلغ مقدماً', en: 'Full amount in advance' };
}

export function readSiteCatalog(root: string): SiteCatalog {
  const file = path.resolve(root, '../site/assets/data/catalog.json');
  return JSON.parse(readFileSync(file, 'utf8')) as SiteCatalog;
}

export type CatalogRow = {
    code: string;
    category: string;
    nameAr: string;
    nameEn: string;
    descAr: string;
    descEn: string;
    unitPrice: number;
    unitAr: string;
    unitEn: string;
    openPrice: boolean;
    attachGovFees: boolean;
    paymentTermsAr: string;
    paymentTermsEn: string;
    deliveryAr: string;
    deliveryEn: string;
  siteSlug: string | null;
  govPlatform: string | null;
  sortOrder: number;
};

/** يحوّل كتالوج الموقع إلى صفوف كتالوج النظام. نقي وقابل للاختبار بلا قاعدة. */
export function buildRows(cat: SiteCatalog): CatalogRow[] {
  const rows: CatalogRow[] = [];

  for (const s of cat.services || []) {
    const code = String(s.code || '').trim().toUpperCase();
    const nameAr = String(s.nameAr || '').trim();
    if (!code || !nameAr) continue;
    const unit = unitFor(s.pricingModel);
    const terms = termsFor(s.pricingModel);
    rows.push({
      code,
      category: String(s.categoryAr || s.category || 'عام').trim(),
      nameAr,
      nameEn: String(s.nameEn || nameAr).trim(),
      descAr: s.govPlatform ? `تُنفَّذ عبر ${s.govPlatform}.` : '',
      descEn: '',
      unitPrice: Number(s.amount) > 0 ? Number(s.amount) : 0,
      unitAr: unit.ar,
      unitEn: unit.en,
      openPrice: isOpenPrice(s.pricingModel, s.amount),
      attachGovFees: Boolean(s.govFeesSeparate),
      paymentTermsAr: terms.ar,
      paymentTermsEn: terms.en,
      deliveryAr: '10 أيام عمل',
      deliveryEn: '10 working days',
      siteSlug: `/services/${code.toLowerCase()}`,
      govPlatform: s.govPlatform ? String(s.govPlatform).trim() : null,
      sortOrder: 200,
    });
  }

  for (const p of cat.packages || []) {
    const key = String(p.key || '').trim().toUpperCase();
    const nameAr = String(p.nameAr || '').trim();
    if (!key || !nameAr) continue;
    const monthly = String(p.billingPeriod || '') === 'monthly';
    rows.push({
      code: `PKG-${key}`,
      category: 'باقات الخدمات',
      nameAr,
      nameEn: String(p.nameEn || nameAr).trim(),
      descAr: (p.featuresAr || []).map((f) => `- ${f}`).join('\n'),
      descEn: (p.featuresEn || []).map((f) => `- ${f}`).join('\n'),
      unitPrice: Number(p.amount) > 0 ? Number(p.amount) : 0,
      unitAr: monthly ? 'شهرياً' : 'سنوياً',
      unitEn: monthly ? 'per month' : 'per year',
      // سعر الباقة المنشور صار سعراً ثابتاً. الباقة بلا رقم (المؤسسية) وحدها تبقى مفتوحة.
      openPrice: !(Number(p.amount) > 0),
      attachGovFees: false,
      paymentTermsAr: monthly ? 'يُسدَّد شهرياً مقدماً' : 'يُسدَّد سنوياً مقدماً',
      paymentTermsEn: monthly ? 'Payable monthly in advance' : 'Payable annually in advance',
      deliveryAr: 'يبدأ التنفيذ خلال 3 أيام عمل من الاعتماد',
      deliveryEn: 'Delivery starts within 3 working days of approval',
      siteSlug: '/packages',
      govPlatform: null,
      sortOrder: 50,
    });
  }

  return rows;
}

export async function importCatalog(
  prisma: PrismaClient,
  root = process.cwd(),
): Promise<{ created: number; updated: number; skipped: number; total: number }> {
  const rows = buildRows(readSiteCatalog(root));
  const out = { created: 0, updated: 0, skipped: 0, total: rows.length };

  for (const r of rows) {
    const existing = await prisma.service.findUnique({ where: { code: r.code } });
    if (!existing) {
      await prisma.service.create({ data: r });
      out.created++;
      continue;
    }
    // السعر وحالة السعر المفتوح ملك المالك — لا يُكتبان فوق تعديل يدوي.
    const { unitPrice: _p, openPrice: _o, sortOrder: _s, ...safe } = r;
    await prisma.service.update({ where: { code: r.code }, data: safe });
    out.updated++;
  }

  return out;
}
