/**
 * تصنيفات الموردين — بها يُوجَّه كل طلب إلى من يقدّمه.
 *
 * الملف مستقل بلا استيراد لقاعدة البيانات عمداً: الشاشة التي تختار موردين
 * تعمل في المتصفح، ولو جاءت التصنيفات من ملف يستورد prisma لجُرَّ الخادم
 * كلّه إلى حزمة العميل. ومصدرٌ واحد للأسماء أولى من نسختين تتفارقان.
 */
export const SUPPLIER_CATEGORIES: Record<string, string> = {
  workspace: 'مساحات العمل والمكاتب',
  housing: 'سكن العمال والإسكان',
  realestate: 'العقارات',
  fitout: 'التشطيب والمقاولات',
  logistics: 'النقل والخدمات اللوجستية',
  it: 'تقنية المعلومات والتجهيزات',
  marketing: 'التسويق والإنتاج',
  other: 'أخرى',
};

export function categoryLabel(code: string): string {
  return SUPPLIER_CATEGORIES[code] || code;
}
