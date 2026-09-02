/**
 * اشتراكات التأمينات الاجتماعية.
 *
 * ── لماذا النسب معطياتٌ لا ثوابت في الكود ───────────────────────────────
 * نسب المؤسسة العامة للتأمينات الاجتماعية تتغيّر بقرارٍ تنظيمي، وقد تغيّرت
 * فعلاً: إصلاح ١٤٤٦هـ رفع نسبة المعاش للمشتركين الجدد تدريجياً. ونظامٌ
 * يدفن النسبة في سطر كود يجبر كل عميل على انتظار تحديثٍ برمجي عند أي
 * تعديل — وربما يحتسب أشهراً بنسبةٍ خاطئة قبل أن ينتبه أحد.
 *
 * لذلك تُقرأ النسب من إعدادات المنشأة، وهذه الملفّة تحمل القيم الافتراضية
 * السائدة وقتَ كتابتها، ومعها ما يجعل تعديلها آمناً: تاريخ سريان لكل جدول.
 *
 * **راجِع النسب مع مستشارك قبل أول مسيّر رواتب.** النظام يحسب بما تُعطيه،
 * ولا يزعم أنه المرجع النظامي.
 *
 * ── القواعد البنيوية (وهي أثبت من النسب) ────────────────────────────────
 *  ـ وعاء الاشتراك = الأجر الأساسي + بدل السكن. بقية البدلات خارجه.
 *  ـ للوعاء حدٌّ أدنى وحدٌّ أعلى شهريان.
 *  ـ غير السعودي: لا معاش ولا ساند — الأخطار المهنية وحدها، وعلى صاحب
 *    العمل لا على الموظف. من يخصم من أجر المقيم حصةَ معاشٍ يخصم بلا وجه.
 */
import { d, money, Decimal, type Num } from '../money.ts';

export type GosiRates = {
  /** تاريخ سريان هذا الجدول */
  effectiveFrom: string;
  saudi: {
    /** المعاش — يتحمّله الطرفان مناصفةً */
    pensionEmployee: number;
    pensionEmployer: number;
    /** ساند: التأمين ضد التعطّل عن العمل */
    sanedEmployee: number;
    sanedEmployer: number;
    /** الأخطار المهنية — على صاحب العمل وحده */
    occupationalHazards: number;
  };
  nonSaudi: {
    /** غير السعودي: الأخطار المهنية فقط، وعلى صاحب العمل */
    occupationalHazards: number;
  };
  /** الحدّ الأدنى والأعلى لوعاء الاشتراك الشهري */
  minBase: number;
  maxBase: number;
};

/**
 * القيم الافتراضية للمشتركين القائمين. تُنسخ في إعدادات المنشأة عند
 * إنشائها، ثم تملكها المنشأة وتعدّلها.
 */
export const DEFAULT_GOSI_RATES: GosiRates = {
  effectiveFrom: '2024-07-01',
  saudi: {
    pensionEmployee: 0.09,
    pensionEmployer: 0.09,
    sanedEmployee: 0.0075,
    sanedEmployer: 0.0075,
    occupationalHazards: 0.02,
  },
  nonSaudi: {
    occupationalHazards: 0.02,
  },
  minBase: 1500,
  maxBase: 45000,
};

export type GosiInput = {
  basicSalary: Num;
  housingAllowance: Num;
  isSaudi: boolean;
  /** غير الخاضع للتأمينات: متدرّب، أو من تجاوز سنّ الاشتراك */
  subject?: boolean;
  rates?: GosiRates;
};

export type GosiResult = {
  /** الوعاء بعد تطبيق الحدّين */
  base: Decimal;
  employee: Decimal;
  employer: Decimal;
  total: Decimal;
  breakdown: {
    pensionEmployee: Decimal;
    pensionEmployer: Decimal;
    sanedEmployee: Decimal;
    sanedEmployer: Decimal;
    occupationalHazards: Decimal;
  };
};

/** يطبّق الحدّ الأدنى والأعلى على وعاء الاشتراك. */
export function contributionBase(basicSalary: Num, housingAllowance: Num, rates = DEFAULT_GOSI_RATES): Decimal {
  const raw = d(basicSalary).plus(d(housingAllowance));
  if (raw.lessThan(rates.minBase)) return money(rates.minBase);
  if (raw.greaterThan(rates.maxBase)) return money(rates.maxBase);
  return money(raw);
}

export function calculateGosi(input: GosiInput): GosiResult {
  const rates = input.rates ?? DEFAULT_GOSI_RATES;
  const zero = new Decimal(0);

  if (input.subject === false) {
    return {
      base: zero, employee: zero, employer: zero, total: zero,
      breakdown: {
        pensionEmployee: zero, pensionEmployer: zero,
        sanedEmployee: zero, sanedEmployer: zero, occupationalHazards: zero,
      },
    };
  }

  const base = contributionBase(input.basicSalary, input.housingAllowance, rates);

  if (!input.isSaudi) {
    // المقيم: الأخطار المهنية على صاحب العمل، ولا خصم من أجره.
    const hazards = money(base.times(rates.nonSaudi.occupationalHazards));
    return {
      base,
      employee: zero,
      employer: hazards,
      total: hazards,
      breakdown: {
        pensionEmployee: zero, pensionEmployer: zero,
        sanedEmployee: zero, sanedEmployer: zero, occupationalHazards: hazards,
      },
    };
  }

  const b = {
    pensionEmployee: money(base.times(rates.saudi.pensionEmployee)),
    pensionEmployer: money(base.times(rates.saudi.pensionEmployer)),
    sanedEmployee: money(base.times(rates.saudi.sanedEmployee)),
    sanedEmployer: money(base.times(rates.saudi.sanedEmployer)),
    occupationalHazards: money(base.times(rates.saudi.occupationalHazards)),
  };

  const employee = money(b.pensionEmployee.plus(b.sanedEmployee));
  const employer = money(b.pensionEmployer.plus(b.sanedEmployer).plus(b.occupationalHazards));

  return { base, employee, employer, total: money(employee.plus(employer)), breakdown: b };
}
