/**
 * حارس المحتوى — يفرض قواعد القسم (2) على كل ما يصل العميل:
 *  1) ممنوع الإيموجي والأيقونات.
 *  2) أسماء الجهات الحكومية تُكتب كاملة ولا تُستخدم الاختصارات وحدها.
 * أسماء المنصات (قوى، مدد، مقيم، ناجز) تبقى كما هي ولا تُمسّ.
 */

/**
 * نطاقات الإيموجي والرموز التصويرية (Miscellaneous Symbols وDingbats
 * وSupplemental Symbols) بالإضافة إلى محدّد التقديم Variation Selector-16.
 * الأسهم الطباعية (← → U+2190-21FF) ليست إيموجي ولا أيقونات فلا تُحجب.
 */
const EMOJI_RE =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{E0020}-\u{E007F}]/gu;

export function hasEmoji(text: string): boolean {
  EMOJI_RE.lastIndex = 0;
  return EMOJI_RE.test(text);
}

export function stripEmoji(text: string): string {
  return text.replace(EMOJI_RE, '').replace(/[ \t]{2,}/g, ' ').trimEnd();
}

/** الاختصار -> الاسم الكامل. لا تُستخدم الاختصارات وحدها في أي مخرج. */
export const GOV_ENTITIES: { abbr: RegExp; ar: string; en: string }[] = [
  { abbr: /\bMISA\b/g, ar: 'وزارة الاستثمار', en: 'Ministry of Investment' },
  { abbr: /\bMOC\b/g, ar: 'وزارة التجارة', en: 'Ministry of Commerce' },
  {
    abbr: /\bMHRSD\b/g,
    ar: 'وزارة الموارد البشرية والتنمية الاجتماعية',
    en: 'Ministry of Human Resources and Social Development',
  },
  { abbr: /\bGOSI\b/g, ar: 'المؤسسة العامة للتأمينات الاجتماعية', en: 'General Organization for Social Insurance' },
  { abbr: /\bZATCA\b/g, ar: 'هيئة الزكاة والضريبة والجمارك', en: 'Zakat, Tax and Customs Authority' },
  { abbr: /\bMOFA\b/g, ar: 'وزارة الخارجية', en: 'Ministry of Foreign Affairs' },
  { abbr: /\bSPL\b/g, ar: 'البريد السعودي', en: 'Saudi Post' },
];

/** أسماء المنصات تبقى كما هي — لا تُوسَّع ولا تُترجم. */
export const PLATFORM_NAMES = ['قوى', 'مدد', 'مقيم', 'ناجز', 'Qiwa', 'Muqeem', 'Mudad', 'Najiz'];

export function expandGovAbbreviations(text: string, lang: 'ar' | 'en'): string {
  let out = text;
  for (const e of GOV_ENTITIES) {
    e.abbr.lastIndex = 0;
    out = out.replace(e.abbr, lang === 'ar' ? e.ar : e.en);
  }
  return out;
}

/** ينظّف نصاً موجهاً للعميل: إزالة الإيموجي وتوسيع الاختصارات الحكومية. */
export function sanitizeClientText(text: string, lang: 'ar' | 'en'): string {
  return expandGovAbbreviations(stripEmoji(text), lang);
}

export interface GuardIssue {
  field: string;
  rule: 'emoji' | 'gov-abbreviation';
  detail: string;
}

/** فحص كائن كامل قبل الحفظ أو الإرسال. يُستخدم على مخرجات الوكيل الذكي. */
export function checkContent(obj: unknown, prefix = ''): GuardIssue[] {
  const issues: GuardIssue[] = [];
  const walk = (val: unknown, p: string) => {
    if (typeof val === 'string') {
      if (hasEmoji(val)) {
        issues.push({ field: p, rule: 'emoji', detail: (val.match(EMOJI_RE) || []).join(' ') });
      }
      for (const e of GOV_ENTITIES) {
        e.abbr.lastIndex = 0;
        if (e.abbr.test(val)) {
          issues.push({ field: p, rule: 'gov-abbreviation', detail: `${e.en} — استخدم الاسم كاملاً` });
        }
      }
    } else if (Array.isArray(val)) {
      val.forEach((v, i) => walk(v, `${p}[${i}]`));
    } else if (val && typeof val === 'object') {
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) walk(v, p ? `${p}.${k}` : k);
    }
  };
  walk(obj, prefix);
  return issues;
}

/** ينظّف كائناً كاملاً بشكل تكراري. */
export function sanitizeDeep<T>(value: T, lang: 'ar' | 'en'): T {
  if (typeof value === 'string') return sanitizeClientText(value, lang) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => sanitizeDeep(v, lang)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // المفاتيح العربية تُنظَّف بالعربي والإنجليزية بالإنجليزي
      const l: 'ar' | 'en' = /Ar$|_ar$|^ar$/.test(k) ? 'ar' : /En$|_en$|^en$/.test(k) ? 'en' : lang;
      out[k] = sanitizeDeep(v, l);
    }
    return out as unknown as T;
  }
  return value;
}
