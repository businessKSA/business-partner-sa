/**
 * أخطاء المجال. رسالة كل خطأ عربية وموجّهة للمستخدم لا للمطوّر — لأنها
 * ستظهر في الشاشة، ومحاسبٌ يقرأ «الفترة مقفلة» يعرف ماذا يفعل، بينما
 * `ERR_PERIOD_CLOSED` لا تقول له شيئاً.
 */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class UnbalancedEntryError extends DomainError {
  constructor(debit: string, credit: string) {
    super(
      `القيد غير متزن: المدين ${debit} والدائن ${credit}. الفرق ${Number(debit) - Number(credit)}.`,
      'UNBALANCED_ENTRY',
      { debit, credit },
    );
  }
}

export class ClosedPeriodError extends DomainError {
  constructor(date: Date) {
    super(
      `الفترة المحاسبية التي يقع فيها ${date.toISOString().slice(0, 10)} مقفلة. افتحها أو رحّل بتاريخ داخل فترة مفتوحة.`,
      'PERIOD_CLOSED',
      { date },
    );
  }
}

export class PermissionError extends DomainError {
  constructor(permission: string) {
    super(`لا تملك صلاحية «${permission}».`, 'FORBIDDEN', { permission });
  }
}

export class NotFoundError extends DomainError {
  constructor(what: string, id?: string) {
    super(`${what} غير موجود${id ? ` (${id})` : ''}.`, 'NOT_FOUND', { id });
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION', details);
  }
}

/**
 * هل العطل «القاعدة غير متاحة» لا «البيانات خاطئة»؟
 *
 * الفرق يهمّ لأن الرسالة تختلف اختلافاً تاماً: بياناتٌ خاطئة تُقال
 * لمستخدمٍ يصحّحها، وقاعدةٌ غير مضبوطة تُقال لمن ينشر النظام. وخلطُهما
 * يجعل من ينشر أول مرّة يظنّ كلمة مروره خاطئة فيجرّبها عشراً، بينما
 * `DATABASE_URL` غير مضبوط أصلاً.
 *
 * الرموز من Prisma: P1000 مصادقة، P1001 لا وصول، P1002 مهلة،
 * P1003 قاعدة غير موجودة، P1017 أُغلق الاتصال.
 */
export function isDatabaseUnavailable(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const err = e as { name?: string; code?: string; errorCode?: string; message?: string };

  if (err.name === 'PrismaClientInitializationError') return true;
  if (['P1000', 'P1001', 'P1002', 'P1003', 'P1017'].includes(err.code ?? '')) return true;

  // متغيّر البيئة الغائب يصل أحياناً رسالةً بلا رمز
  return /Environment variable not found|Can't reach database server/i.test(err.message ?? '');
}
