/**
 * ثوابت النظام المالي — مراكز التكلفة وتصنيفات المصاريف وطرق الدفع.
 * نصوص لا enums، على نهج بقية المشروع: القيم المسموح بها تُفرض هنا.
 *
 * مراكز التكلفة هي الرابط بين المالية وبقية الأقسام: كل مصروف وكل إيراد
 * يُحمَّل على قسمه فتخرج قائمة دخل لكل قسم من نفس الدفتر — الموارد البشرية
 * والمبيعات والمشتريات والتسويق والخدمات المشتركة والخدمات الحكومية.
 */

export const COST_CENTER: Record<string, { ar: string; en: string }> = {
  HR: { ar: 'الموارد البشرية', en: 'Human Resources' },
  SALES: { ar: 'المبيعات', en: 'Sales' },
  PURCHASES: { ar: 'المشتريات والتوريد', en: 'Purchases & Supply' },
  MARKETING: { ar: 'التسويق', en: 'Marketing' },
  SHARED: { ar: 'الخدمات المشتركة', en: 'Shared Services' },
  GOV_SERVICES: { ar: 'الخدمات الحكومية', en: 'Government Services' },
  GENERAL: { ar: 'عام', en: 'General' },
} as const;

export const COST_CENTER_KEYS = Object.keys(COST_CENTER);

export function costCenterLabel(key: string | null | undefined): string {
  return COST_CENTER[key || '']?.ar || COST_CENTER.GENERAL.ar;
}

export const EXPENSE_CATEGORY: Record<string, { ar: string; defaultCenter: string }> = {
  SALARIES: { ar: 'رواتب وأجور', defaultCenter: 'HR' },
  GOSI: { ar: 'التأمينات الاجتماعية', defaultCenter: 'HR' },
  RECRUITMENT: { ar: 'استقدام وتوظيف', defaultCenter: 'HR' },
  RENT: { ar: 'إيجار', defaultCenter: 'SHARED' },
  UTILITIES: { ar: 'كهرباء وماء واتصالات', defaultCenter: 'SHARED' },
  SUBSCRIPTIONS: { ar: 'اشتراكات ومنصات', defaultCenter: 'SHARED' },
  MARKETING_ADS: { ar: 'إعلانات وحملات', defaultCenter: 'MARKETING' },
  MARKETING_CONTENT: { ar: 'محتوى وتصميم', defaultCenter: 'MARKETING' },
  SUPPLIES: { ar: 'مشتريات ومستلزمات', defaultCenter: 'PURCHASES' },
  SUPPLIER_PAYOUT: { ar: 'مستحقات موردين', defaultCenter: 'PURCHASES' },
  GOV_FEES: { ar: 'رسوم حكومية', defaultCenter: 'GOV_SERVICES' },
  PROFESSIONAL: { ar: 'أتعاب مهنية (محاسبة/قانونية)', defaultCenter: 'SHARED' },
  BANK_FEES: { ar: 'رسوم بنكية وعمولات دفع', defaultCenter: 'SHARED' },
  TRAVEL: { ar: 'سفر وتنقّل', defaultCenter: 'GENERAL' },
  OTHER: { ar: 'أخرى', defaultCenter: 'GENERAL' },
} as const;

export const EXPENSE_CATEGORY_KEYS = Object.keys(EXPENSE_CATEGORY);

export function expenseCategoryLabel(key: string | null | undefined): string {
  return EXPENSE_CATEGORY[key || '']?.ar || EXPENSE_CATEGORY.OTHER.ar;
}

export const PAY_METHOD: Record<string, string> = {
  TRANSFER: 'تحويل بنكي',
  CASH: 'نقداً',
  MADA: 'مدى',
  CARD: 'بطاقة ائتمانية',
} as const;

export const PAY_METHOD_KEYS = Object.keys(PAY_METHOD);

export const ZATCA_STATUS_LABEL: Record<string, string> = {
  ISSUED: 'صادرة (مرحلة أولى)',
  REPORTED: 'مُبلَّغ عنها',
  CLEARED: 'معتمدة',
  REJECTED: 'مرفوضة',
  FAILED: 'تعذّر الإبلاغ',
};
