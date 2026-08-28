/**
 * مكافأة نهاية الخدمة.
 *
 * القاعدة في المادّة الرابعة والثمانين من نظام العمل: نصف شهرٍ عن كل سنة
 * من السنوات الخمس الأولى، وشهرٌ كامل عن كل سنة بعدها، محسوبةً على الأجر
 * الأخير. وكسور السنة تُحسب بنسبتها لا تُهمل ولا تُجبر.
 *
 * والمادّة الخامسة والثمانون تفرّق بين من تركَ ومن أُنهيت خدمته:
 * المستقيل يستحق ثلث المكافأة إن خدم سنتين إلى خمس، وثلثيها إن خدم خمساً
 * إلى عشر، وكاملها إن بلغ عشراً. ودون السنتين لا يستحق شيئاً.
 *
 * أما من أُنهيت خدمته من صاحب العمل، أو انتهى عقده، أو تقاعد، فيستحق
 * المكافأة كاملة أياً كانت مدّته.
 *
 * **الحساب هنا يُنفّذ القاعدة العامة، ولا يُغني عن مراجعة قانونية في
 * الحالات الخاصة**: الاستقالة لسببٍ مشروع (المادّة ٨١)، وترك العاملة عملها
 * خلال ستة أشهر من زواجها أو ثلاثة من وضعها (المادّة ٨٧) — كلها تُعامل
 * معاملة الاستحقاق الكامل، ويحدّدها المستخدم بـ`fullEntitlement`.
 */
import { d, money, Decimal, type Num } from '../money.ts';

/** RESIGNATION استقالة | TERMINATION إنهاء من صاحب العمل
 *  | CONTRACT_END انتهاء العقد | RETIREMENT تقاعد */
export type EndReason = 'RESIGNATION' | 'TERMINATION' | 'CONTRACT_END' | 'RETIREMENT';

export type EosbInput = {
  hireDate: Date;
  endDate: Date;
  /** الأجر الأخير: الأساسي وبدلاته */
  lastWage: Num;
  endReason: EndReason;
  /**
   * استحقاق كامل رغم الاستقالة — للحالات التي ينصّ النظام على استثنائها
   * (المادّة ٨١ والمادّة ٨٧). قرارٌ بشري لا يُستنتج من البيانات.
   */
  fullEntitlement?: boolean;
};

export type EosbResult = {
  /** سنوات الخدمة بكسورها */
  serviceYears: Decimal;
  serviceDays: number;
  /** المكافأة قبل تطبيق نسبة الاستقالة */
  grossAward: Decimal;
  /** النسبة المستحقّة: ٠ أو ⅓ أو ⅔ أو ١ */
  entitlementRatio: Decimal;
  award: Decimal;
  /** شرح عربي للقرار — يظهر في المخالصة */
  explanation: string;
};

/**
 * مدّة الخدمة بالسنوات الميلادية وكسورها.
 *
 * تُحسب بالتقويم لا بقسمة الأيام على ٣٦٥. الفرق ليس تدقيقاً زائداً: من
 * عُيّن في أول يناير ٢٠٢٠ وتركَ في أول يناير ٢٠٢٣ خدمَ ثلاث سنوات تماماً،
 * لكن الأيام بينهما ١٠٩٦ يوماً (٢٠٢٠ كبيسة) فقسمتُها على ٣٦٥ تعطي
 * ٣٫٠٠٢٧ سنة، وتزيد مكافأتَه ستةَ عشرَ ريالاً بلا سبب. والعكس يقع كذلك،
 * وكلاهما رقمٌ لا يستطيع محاسبٌ تفسيره في مخالصة.
 */
export function serviceDuration(hire: Date, end: Date) {
  let years = end.getUTCFullYear() - hire.getUTCFullYear();
  let months = end.getUTCMonth() - hire.getUTCMonth();
  let days = end.getUTCDate() - hire.getUTCDate();

  if (days < 0) {
    months -= 1;
    // أيام الشهر السابق لتاريخ الانتهاء — لا ثلاثين افتراضاً
    const daysInPrevMonth = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 0),
    ).getUTCDate();
    days += daysInPrevMonth;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const daysInEndMonth = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0),
  ).getUTCDate();

  const fractional = d(years)
    .plus(d(months).plus(d(days).dividedBy(daysInEndMonth)).dividedBy(12));

  return { years, months, days, fractional };
}

export function calculateEosb(input: EosbInput): EosbResult {
  const ms = input.endDate.getTime() - input.hireDate.getTime();
  if (ms < 0) {
    throw new Error('تاريخ نهاية الخدمة قبل تاريخ التعيين.');
  }

  const serviceDays = Math.floor(ms / 86_400_000);
  const years = serviceDuration(input.hireDate, input.endDate).fractional;
  const wage = money(input.lastWage);

  // نصف شهر عن كل سنة من الخمس الأولى، وشهر عن كل سنة بعدها.
  const firstFive = years.greaterThan(5) ? new Decimal(5) : years;
  const beyondFive = years.greaterThan(5) ? years.minus(5) : new Decimal(0);

  const grossAward = money(
    wage.times(new Decimal(0.5)).times(firstFive).plus(wage.times(beyondFive)),
  );

  const { ratio, explanation } = entitlement(years, input.endReason, input.fullEntitlement);

  return {
    serviceYears: years.toDecimalPlaces(4),
    serviceDays,
    grossAward,
    entitlementRatio: ratio,
    award: money(grossAward.times(ratio)),
    explanation,
  };
}

function entitlement(
  years: Decimal,
  reason: EndReason,
  fullEntitlement?: boolean,
): { ratio: Decimal; explanation: string } {
  const y = years.toDecimalPlaces(2).toNumber();

  if (reason !== 'RESIGNATION') {
    const label =
      reason === 'TERMINATION' ? 'إنهاء الخدمة من صاحب العمل'
        : reason === 'CONTRACT_END' ? 'انتهاء مدّة العقد'
          : 'التقاعد';
    return {
      ratio: new Decimal(1),
      explanation: `${label}: المكافأة كاملة عن ${y} سنة خدمة.`,
    };
  }

  if (fullEntitlement) {
    return {
      ratio: new Decimal(1),
      explanation:
        `استقالة باستحقاق كامل (حالة منصوص عليها في النظام): المكافأة كاملة عن ${y} سنة خدمة.`,
    };
  }

  if (years.lessThan(2)) {
    return {
      ratio: new Decimal(0),
      explanation: `استقالة قبل إتمام سنتين (${y} سنة): لا مكافأة وفق المادّة ٨٥.`,
    };
  }
  if (years.lessThan(5)) {
    return {
      ratio: new Decimal(1).dividedBy(3),
      explanation: `استقالة بعد ${y} سنة (سنتان إلى أقل من خمس): ثلث المكافأة وفق المادّة ٨٥.`,
    };
  }
  if (years.lessThan(10)) {
    return {
      ratio: new Decimal(2).dividedBy(3),
      explanation: `استقالة بعد ${y} سنة (خمس إلى أقل من عشر): ثلثا المكافأة وفق المادّة ٨٥.`,
    };
  }
  return {
    ratio: new Decimal(1),
    explanation: `استقالة بعد ${y} سنة (عشر فأكثر): المكافأة كاملة وفق المادّة ٨٥.`,
  };
}

/**
 * المخصَّص الشهري لمكافأة نهاية الخدمة.
 *
 * الالتزام ينشأ مع كل شهر عمل لا لحظةَ الانفصال، ومنشأةٌ لا تُجنّبه تُظهر
 * ربحاً أعلى من حقيقته سنواتٍ ثم تُفاجأ بمبلغٍ كبير في شهر واحد.
 */
export function monthlyEosbProvision(
  hireDate: Date,
  asOf: Date,
  lastWage: Num,
): Decimal {
  const current = calculateEosb({
    hireDate, endDate: asOf, lastWage, endReason: 'TERMINATION',
  });

  const prevMonth = new Date(asOf);
  prevMonth.setUTCMonth(prevMonth.getUTCMonth() - 1);
  if (prevMonth < hireDate) return current.grossAward;

  const previous = calculateEosb({
    hireDate, endDate: prevMonth, lastWage, endReason: 'TERMINATION',
  });

  return money(current.grossAward.minus(previous.grossAward));
}
