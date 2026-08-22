/**
 * مفاتيح الاتصال الدولية.
 *
 * الرقم يُخزَّن دائماً بصيغة دولية بأرقام فقط، فلا بد أن يختار كاتبه مفتاح
 * دولته صراحةً. الافتراض الصامت بأن كل رقم سعودي يكسر أرقام الخليج والمقيمين
 * وأصحاب الأرقام الأجنبية دون أن يظهر الخطأ إلا حين لا تُفتح محادثة واتساب.
 */
export interface Country {
  /** رمز الدولة ISO */
  code: string;
  ar: string;
  en: string;
  /** مفتاح الاتصال بلا علامة زائد */
  dial: string;
}

export const COUNTRIES: Country[] = [
  { code: 'SA', ar: 'السعودية', en: 'Saudi Arabia', dial: '966' },
  { code: 'AE', ar: 'الإمارات', en: 'United Arab Emirates', dial: '971' },
  { code: 'KW', ar: 'الكويت', en: 'Kuwait', dial: '965' },
  { code: 'QA', ar: 'قطر', en: 'Qatar', dial: '974' },
  { code: 'BH', ar: 'البحرين', en: 'Bahrain', dial: '973' },
  { code: 'OM', ar: 'عُمان', en: 'Oman', dial: '968' },
  { code: 'YE', ar: 'اليمن', en: 'Yemen', dial: '967' },
  { code: 'EG', ar: 'مصر', en: 'Egypt', dial: '20' },
  { code: 'JO', ar: 'الأردن', en: 'Jordan', dial: '962' },
  { code: 'LB', ar: 'لبنان', en: 'Lebanon', dial: '961' },
  { code: 'SY', ar: 'سوريا', en: 'Syria', dial: '963' },
  { code: 'IQ', ar: 'العراق', en: 'Iraq', dial: '964' },
  { code: 'PS', ar: 'فلسطين', en: 'Palestine', dial: '970' },
  { code: 'SD', ar: 'السودان', en: 'Sudan', dial: '249' },
  { code: 'LY', ar: 'ليبيا', en: 'Libya', dial: '218' },
  { code: 'TN', ar: 'تونس', en: 'Tunisia', dial: '216' },
  { code: 'DZ', ar: 'الجزائر', en: 'Algeria', dial: '213' },
  { code: 'MA', ar: 'المغرب', en: 'Morocco', dial: '212' },
  { code: 'MR', ar: 'موريتانيا', en: 'Mauritania', dial: '222' },
  { code: 'SO', ar: 'الصومال', en: 'Somalia', dial: '252' },
  { code: 'DJ', ar: 'جيبوتي', en: 'Djibouti', dial: '253' },
  { code: 'KM', ar: 'جزر القمر', en: 'Comoros', dial: '269' },
  { code: 'TR', ar: 'تركيا', en: 'Türkiye', dial: '90' },
  { code: 'IR', ar: 'إيران', en: 'Iran', dial: '98' },
  { code: 'PK', ar: 'باكستان', en: 'Pakistan', dial: '92' },
  { code: 'IN', ar: 'الهند', en: 'India', dial: '91' },
  { code: 'BD', ar: 'بنغلاديش', en: 'Bangladesh', dial: '880' },
  { code: 'LK', ar: 'سريلانكا', en: 'Sri Lanka', dial: '94' },
  { code: 'NP', ar: 'نيبال', en: 'Nepal', dial: '977' },
  { code: 'PH', ar: 'الفلبين', en: 'Philippines', dial: '63' },
  { code: 'ID', ar: 'إندونيسيا', en: 'Indonesia', dial: '62' },
  { code: 'MY', ar: 'ماليزيا', en: 'Malaysia', dial: '60' },
  { code: 'SG', ar: 'سنغافورة', en: 'Singapore', dial: '65' },
  { code: 'TH', ar: 'تايلاند', en: 'Thailand', dial: '66' },
  { code: 'VN', ar: 'فيتنام', en: 'Vietnam', dial: '84' },
  { code: 'CN', ar: 'الصين', en: 'China', dial: '86' },
  { code: 'JP', ar: 'اليابان', en: 'Japan', dial: '81' },
  { code: 'KR', ar: 'كوريا الجنوبية', en: 'South Korea', dial: '82' },
  { code: 'GB', ar: 'المملكة المتحدة', en: 'United Kingdom', dial: '44' },
  { code: 'IE', ar: 'أيرلندا', en: 'Ireland', dial: '353' },
  { code: 'FR', ar: 'فرنسا', en: 'France', dial: '33' },
  { code: 'DE', ar: 'ألمانيا', en: 'Germany', dial: '49' },
  { code: 'NL', ar: 'هولندا', en: 'Netherlands', dial: '31' },
  { code: 'BE', ar: 'بلجيكا', en: 'Belgium', dial: '32' },
  { code: 'CH', ar: 'سويسرا', en: 'Switzerland', dial: '41' },
  { code: 'AT', ar: 'النمسا', en: 'Austria', dial: '43' },
  { code: 'IT', ar: 'إيطاليا', en: 'Italy', dial: '39' },
  { code: 'ES', ar: 'إسبانيا', en: 'Spain', dial: '34' },
  { code: 'PT', ar: 'البرتغال', en: 'Portugal', dial: '351' },
  { code: 'GR', ar: 'اليونان', en: 'Greece', dial: '30' },
  { code: 'SE', ar: 'السويد', en: 'Sweden', dial: '46' },
  { code: 'NO', ar: 'النرويج', en: 'Norway', dial: '47' },
  { code: 'DK', ar: 'الدنمارك', en: 'Denmark', dial: '45' },
  { code: 'FI', ar: 'فنلندا', en: 'Finland', dial: '358' },
  { code: 'PL', ar: 'بولندا', en: 'Poland', dial: '48' },
  { code: 'RU', ar: 'روسيا', en: 'Russia', dial: '7' },
  { code: 'UA', ar: 'أوكرانيا', en: 'Ukraine', dial: '380' },
  { code: 'US', ar: 'الولايات المتحدة', en: 'United States', dial: '1' },
  { code: 'CA', ar: 'كندا', en: 'Canada', dial: '1' },
  { code: 'MX', ar: 'المكسيك', en: 'Mexico', dial: '52' },
  { code: 'BR', ar: 'البرازيل', en: 'Brazil', dial: '55' },
  { code: 'AR', ar: 'الأرجنتين', en: 'Argentina', dial: '54' },
  { code: 'ZA', ar: 'جنوب أفريقيا', en: 'South Africa', dial: '27' },
  { code: 'NG', ar: 'نيجيريا', en: 'Nigeria', dial: '234' },
  { code: 'KE', ar: 'كينيا', en: 'Kenya', dial: '254' },
  { code: 'ET', ar: 'إثيوبيا', en: 'Ethiopia', dial: '251' },
  { code: 'GH', ar: 'غانا', en: 'Ghana', dial: '233' },
  { code: 'TZ', ar: 'تنزانيا', en: 'Tanzania', dial: '255' },
  { code: 'UG', ar: 'أوغندا', en: 'Uganda', dial: '256' },
  { code: 'AU', ar: 'أستراليا', en: 'Australia', dial: '61' },
  { code: 'NZ', ar: 'نيوزيلندا', en: 'New Zealand', dial: '64' },
];

/** أطول مفتاح مطابق أولاً، وإلا لالتُقط 1 قبل 20 و7 قبل 971. */
const BY_DIAL_DESC = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

/** يفصل رقماً دولياً مخزَّناً إلى مفتاح وباقٍ محلي. */
export function splitDial(intl: string): { dial: string; local: string } {
  const d = String(intl || '').replace(/\D/g, '');
  if (!d) return { dial: '966', local: '' };
  const hit = BY_DIAL_DESC.find((c) => d.startsWith(c.dial));
  return hit ? { dial: hit.dial, local: d.slice(hit.dial.length) } : { dial: '966', local: d };
}

/** يجمع المفتاح والرقم المحلي إلى صيغة دولية بأرقام فقط. */
export function joinDial(dial: string, local: string): string {
  const d = String(dial || '').replace(/\D/g, '');
  // الصفر المحلي يسقط: 05x مع مفتاح 966 يعني 9665x لا 96605x.
  const l = String(local || '').replace(/\D/g, '').replace(/^0+/, '');
  if (!l) return '';
  return d + l;
}
