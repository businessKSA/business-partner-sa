/**
 * السنوات والفترات المالية.
 *
 * الفترة المقفلة هي الوعد الوحيد الذي يستطيع النظام تقديمه للمحاسب: أن
 * رقماً أُقرَّ وقُدِّم للهيئة لن يتغيّر من خلفه. لذلك القفل يُفرض في محرّك
 * الترحيل لا في الواجهة، والتعديل بعده لا يكون إلا بقيدٍ عاكسٍ في فترة
 * مفتوحة — أثرٌ ظاهر لا محوٌ صامت.
 */
import type { Tx } from '../db.ts';
import { ClosedPeriodError, DomainError } from '../errors.ts';

/** ينشئ سنة مالية باثنتي عشرة فترة شهرية. */
export async function createFiscalYear(
  tx: Tx,
  tenantId: string,
  startYear: number,
  startMonth = 1,
): Promise<string> {
  const start = new Date(Date.UTC(startYear, startMonth - 1, 1));
  const end = new Date(Date.UTC(startYear + 1, startMonth - 1, 0));
  const name = startMonth === 1 ? String(startYear) : `${startYear}/${startYear + 1}`;

  const exists = await tx.fiscalYear.findUnique({
    where: { tenantId_name: { tenantId, name } },
  });
  if (exists) return exists.id;

  const fy = await tx.fiscalYear.create({
    data: { tenantId, name, startDate: start, endDate: end },
  });

  const MONTHS_AR = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
  ];

  for (let i = 0; i < 12; i++) {
    const pStart = new Date(Date.UTC(startYear, startMonth - 1 + i, 1));
    const pEnd = new Date(Date.UTC(startYear, startMonth + i, 0));
    await tx.fiscalPeriod.create({
      data: {
        fiscalYearId: fy.id,
        tenantId,
        number: i + 1,
        name: `${MONTHS_AR[pStart.getUTCMonth()]} ${pStart.getUTCFullYear()}`,
        startDate: pStart,
        endDate: pEnd,
      },
    });
  }

  return fy.id;
}

/**
 * يعثر على الفترة التي يقع فيها التاريخ ويتأكّد أنها مفتوحة.
 *
 * غياب الفترة ليس خطأً صامتاً يُتجاوز: تاريخٌ خارج كل سنة مالية يعني أن
 * القيد سيسقط من كل تقرير، وهو ما يجب أن يُرفض لا أن يُقبل.
 */
export async function requireOpenPeriod(tx: Tx, tenantId: string, date: Date) {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

  const period = await tx.fiscalPeriod.findFirst({
    where: { tenantId, startDate: { lte: day }, endDate: { gte: day } },
  });

  if (!period) {
    throw new DomainError(
      `لا توجد فترة محاسبية تشمل ${day.toISOString().slice(0, 10)}. أنشئ السنة المالية أولاً.`,
      'NO_PERIOD',
      { date: day },
    );
  }

  if (period.status !== 'OPEN') throw new ClosedPeriodError(day);

  return period;
}

/** يقفل فترة. القيود المسوّدة داخلها تمنع القفل — تُرحَّل أو تُلغى أولاً. */
export async function closePeriod(tx: Tx, tenantId: string, periodId: string, actor: string) {
  const period = await tx.fiscalPeriod.findFirst({ where: { id: periodId, tenantId } });
  if (!period) throw new DomainError('الفترة غير موجودة', 'NOT_FOUND');

  const drafts = await tx.journalEntry.count({
    where: { tenantId, periodId, status: 'DRAFT' },
  });
  if (drafts > 0) {
    throw new DomainError(
      `لا يمكن قفل «${period.name}»: بها ${drafts} قيداً مسوّداً. رحّلها أو ألغِها ثم أعد المحاولة.`,
      'PERIOD_HAS_DRAFTS',
      { drafts },
    );
  }

  return tx.fiscalPeriod.update({
    where: { id: periodId },
    data: { status: 'CLOSED', closedAt: new Date() },
  });
}

export async function reopenPeriod(tx: Tx, tenantId: string, periodId: string) {
  const period = await tx.fiscalPeriod.findFirst({ where: { id: periodId, tenantId } });
  if (!period) throw new DomainError('الفترة غير موجودة', 'NOT_FOUND');
  if (period.status === 'LOCKED') {
    throw new DomainError(
      `«${period.name}» مقفلة نهائياً بعد إقفال السنة ولا تُفتح.`,
      'PERIOD_LOCKED',
    );
  }
  return tx.fiscalPeriod.update({ where: { id: periodId }, data: { status: 'OPEN', closedAt: null } });
}
