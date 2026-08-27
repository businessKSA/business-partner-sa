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
