/**
 * البيانات الثابتة للشركة — المصدر الوحيد للحقيقة.
 * Company constants — single source of truth for every document and page.
 */

export const COMPANY = {
  legalName: {
    ar: 'شركة بزنس بارتنر سلوشنز — ذات مسؤولية محدودة (شخص واحد)',
    en: 'Business Partner Solutions Company — LLC (Single Person)',
  },
  shortName: { ar: 'بزنس بارتنر', en: 'Business Partner' },
  crNumber: '7038825860',
  vatNumber: '312079341500003',
  address: {
    ar: 'العارض، مكتب 25، 5890 ريحانة بنت زيد، الرياض، المملكة العربية السعودية',
    en: 'Al Arid, Office 25, 5890 Rihana bint Zaid, Riyadh, Saudi Arabia',
  },
  phone: '+966530540231',
  phoneDisplay: '+966 53 054 0231',
  email: 'Business@businesspartnerksa.com',
  website: 'www.businesspartner.sa',
  representative: {
    name: { ar: 'باهر مقنص', en: 'Baher Magnas' },
    title: { ar: 'المدير العام', en: 'General Manager' },
    email: 'Business@businesspartnerksa.com',
  },
  bank: {
    name: { ar: 'مصرف الراجحي', en: 'Al Rajhi Bank' },
    // اسم المستفيد كما ورد حرفياً في خطاب الآيبان.
    beneficiary: {
      ar: 'شركة باهر بكر مقنص للمقاولات',
      en: 'Baher Bakr Magnas Contracting Company',
    },
    account: '511000010006086228498',
    iban: 'SA5380000511608016228498',
  },
  brand: {
    navy: '#0B1B5A',
    ink: '#1F2430',
    muted: '#5B6172',
    line: '#D9DDE7',
    paper: '#FFFFFF',
    wash: '#F5F7FB',
    fontAr: "'Tajawal', sans-serif",
    fontEn: "Inter, Arial, 'Helvetica Neue', sans-serif",
    logo: '/brand/logo.png',
  },
} as const;

/** ضريبة القيمة المضافة — كل الأسعار غير شاملة لها. */
export const VAT_RATE = 0.15;

/** صلاحية العروض بالأيام (قوى استثناء 15 يوماً). */
export const QUOTE_VALIDITY_DAYS = 30;
export const QUOTE_VALIDITY_DAYS_QIWA = 15;

/** بادئة الترقيم التسلسلي: BP-<كود>-<سنة>-<رقم>. */
export const NUMBER_PREFIX = 'BP';
