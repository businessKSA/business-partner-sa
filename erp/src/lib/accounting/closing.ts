/**
 * الإقفال السنوي.
 *
 * حسابات الإيرادات والمصروفات مؤقّتة: تقيس أداء سنةٍ بعينها، وتبدأ السنة
 * التالية من صفر. والإقفال هو الفعل الذي يصفّرها ويحوّل صافيها إلى الأرباح
 * المبقاة — وهو حسابٌ دائم يتراكم عبر السنين.
 *
 * قبل الإقفال، تُظهر قائمة المركز المالي أرباح العام الجاري بندًا منفصلاً
 * محسوباً في وقت العرض (وإلا لم تتوازن). وبعده تصير جزءاً من الأرباح
 * المبقاة، فيختفي البند المحسوب لأن رصيده صار صفراً — والقائمة تبقى متوازنة
 * في الحالين.
 *
 * ── لماذا يُحفظ سجلّ الإقفال ولا يُكتفى بالقيد؟ ──────────────────────────
 * لأن الإقفال يُرجَع عنه أحياناً: تُكتشف فاتورة متأخّرة، أو يطلب المدقّق
 * تعديلاً. والرجوع يحتاج معرفة ما فُعل بالضبط — أي حساب أُقفل وبأي مبلغ —
 * وقيدٌ وحده لا يقول إن كان إقفالاً أم قيداً عادياً يشبهه.
 *
 * ── وقفل الفترات ────────────────────────────────────────────────────────
 * بعد الإقفال تُقفل فترات السنة قفلاً نهائياً (`LOCKED`) لا يُفتح بإعادة
 * الفتح المعتادة. الفرق مقصود: `CLOSED` قرارٌ تشغيلي يُراجَع، و`LOCKED`
 * إقرارٌ بأن السنة انتهت وقُدِّمت.
 */
import type { Tx } from '../db.ts';
import { d, money, Decimal } from '../money.ts';
import { DomainError, ValidationError } from '../errors.ts';
import { postEntry, reverseEntry, accountByRole } from './posting.ts';
import { trialBalance } from './reports.ts';

/**
 * معاينة الإقفال قبل تنفيذه.
 *
 * تعرض ما سيُقفل وبكم، فيراه المحاسب قبل أن يقع — لا بعده.
 */
export async function previewClosing(tx: Tx, tenantId: string, fiscalYearId: string) {
  const fy = await tx.fiscalYear.findFirst({
    where: { id: fiscalYearId, tenantId },
    include: { closing: true },
  });
  if (!fy) throw new DomainError('السنة المالية غير موجودة', 'NOT_FOUND');

  const { rows } = await trialBalance(tx, tenantId, fy.startDate, fy.endDate);

  const revenue = rows
    .filter((r) => r.type === 'REVENUE')
    .map((r) => ({
      accountId: r.accountId, code: r.code, nameAr: r.nameAr,
      // الإيراد طبيعته دائنة: رصيده = دائن − مدين
      balance: money(r.periodCredit.minus(r.periodDebit)),
    }))
    .filter((r) => !r.balance.isZero());

  const expense = rows
    .filter((r) => r.type === 'EXPENSE')
    .map((r) => ({
      accountId: r.accountId, code: r.code, nameAr: r.nameAr,
      // المصروف طبيعته مدينة
      balance: money(r.periodDebit.minus(r.periodCredit)),
    }))
    .filter((r) => !r.balance.isZero());

  const totalRevenue = money(revenue.reduce((s, r) => s.plus(r.balance), new Decimal(0)));
  const totalExpense = money(expense.reduce((s, r) => s.plus(r.balance), new Decimal(0)));
  const netProfit = money(totalRevenue.minus(totalExpense));

  const draftEntries = await tx.journalEntry.count({
    where: {
      tenantId, status: 'DRAFT',
      date: { gte: fy.startDate, lte: fy.endDate },
    },
  });

  return {
    fiscalYear: fy,
    alreadyClosed: fy.closing?.status === 'POSTED',
    revenue, expense,
    totalRevenue, totalExpense, netProfit,
    accountsToClose: revenue.length + expense.length,
    draftEntries,
  };
}

/**
 * ينفّذ الإقفال.
 *
 * القيد:
 *   من ح/ الإيرادات (كلٌّ برصيده)     ← تصفيرها يقتضي جعلها مدينة
 *     إلى ح/ المصروفات (كلٌّ برصيده)   ← وتصفيرها يقتضي جعلها دائنة
 *   والفرق إلى ح/ الأرباح المبقاة — دائناً إن ربحت السنة ومديناً إن خسرت.
 */
export async function closeFiscalYear(
  tx: Tx,
  tenantId: string,
  fiscalYearId: string,
  opts: { closingDate?: Date; actor?: string; note?: string; lockPeriods?: boolean } = {},
) {
  const preview = await previewClosing(tx, tenantId, fiscalYearId);
  const fy = preview.fiscalYear;

  if (preview.alreadyClosed) {
    throw new DomainError(
      `السنة المالية ${fy.name} مُقفَلة سلفاً. ارجع عن الإقفال أولاً إن أردت إعادته.`,
      'ALREADY_CLOSED',
    );
  }

  // قيدٌ مسوّد داخل السنة يعني رقماً لم يُحسم بعد — والإقفال على أرقامٍ
  // غير محسومة يُنتج أرباحاً مبقاة خاطئة يصعب تتبّعها لاحقاً.
  if (preview.draftEntries > 0) {
    throw new DomainError(
      `في السنة ${fy.name} ${preview.draftEntries} قيداً مسوّداً. رحّلها أو ألغِها قبل الإقفال.`,
      'YEAR_HAS_DRAFTS',
      { draftEntries: preview.draftEntries },
    );
  }

  if (preview.accountsToClose === 0) {
    throw new ValidationError(`لا حسابات إيرادات أو مصروفات لها رصيد في ${fy.name}.`);
  }

  const closingDate = opts.closingDate ?? fy.endDate;
  if (closingDate < fy.startDate || closingDate > fy.endDate) {
    throw new ValidationError('تاريخ الإقفال خارج السنة المالية.');
  }

  const retained = await accountByRole(tx, tenantId, 'RETAINED_EARNINGS');

  const lines: Record<string, unknown>[] = [];

  // تصفير الإيرادات: رصيدها دائن، فتُجعل مدينة بالمثل
  for (const r of preview.revenue) {
    lines.push({
      accountId: r.accountId,
      [r.balance.greaterThan(0) ? 'debit' : 'credit']: r.balance.abs(),
      descAr: `إقفال ${r.nameAr}`,
    });
  }

  // تصفير المصروفات: رصيدها مدين، فتُجعل دائنة بالمثل
  for (const e of preview.expense) {
    lines.push({
      accountId: e.accountId,
      [e.balance.greaterThan(0) ? 'credit' : 'debit']: e.balance.abs(),
      descAr: `إقفال ${e.nameAr}`,
    });
  }

  // الفرق إلى الأرباح المبقاة
  if (!preview.netProfit.isZero()) {
    lines.push({
      accountId: retained.id,
      [preview.netProfit.greaterThan(0) ? 'credit' : 'debit']: preview.netProfit.abs(),
      descAr: preview.netProfit.greaterThan(0)
        ? `صافي ربح السنة ${fy.name}`
        : `صافي خسارة السنة ${fy.name}`,
    });
  }

  const entry = await postEntry(tx, tenantId, {
    date: closingDate,
    memoAr: `قيد إقفال السنة المالية ${fy.name}`,
    ref: `CLOSE-${fy.name}`,
    sourceType: 'CLOSING',
    sourceId: fy.id,
    createdBy: opts.actor,
    lines: lines as never,
  });

  const closing = await tx.yearEndClosing.create({
    data: {
      tenantId,
      fiscalYearId: fy.id,
      closingDate,
      netProfit: preview.netProfit.toFixed(6),
      accountsClosed: preview.accountsToClose,
      closingEntryId: entry.id,
      closedBy: opts.actor ?? null,
      note: opts.note ?? null,
    },
  });

  // قفل الفترات نهائياً وقفل السنة
  if (opts.lockPeriods !== false) {
    await tx.fiscalPeriod.updateMany({
      where: { fiscalYearId: fy.id },
      data: { status: 'LOCKED', closedAt: new Date() },
    });
  }
  await tx.fiscalYear.update({
    where: { id: fy.id },
    data: { status: 'CLOSED', closedAt: new Date(), closedBy: opts.actor ?? null },
  });

  return { closing, entry, netProfit: preview.netProfit };
}

/**
 * الرجوع عن الإقفال.
 *
 * يعكس القيد ويفتح الفترات. لا يُحذف السجلّ: يبقى بحالة «مرجوع عنه» ليُقرأ
 * أن السنة أُقفلت ثم فُتحت — وهذا سؤالٌ يُسأل في كل تدقيق.
 */
export async function reverseClosing(
  tx: Tx,
  tenantId: string,
  fiscalYearId: string,
  opts: { date?: Date; actor?: string; reason?: string } = {},
) {
  const closing = await tx.yearEndClosing.findFirst({
    where: { fiscalYearId, tenantId },
    include: { fiscalYear: true },
  });
  if (!closing) throw new DomainError('لا يوجد إقفال لهذه السنة.', 'NOT_FOUND');
  if (closing.status === 'REVERSED') {
    throw new DomainError('رُجع عن هذا الإقفال سلفاً.', 'ALREADY_REVERSED');
  }

  // تُفتح الفترات أولاً وإلا رفض المحرّك ترحيل القيد العاكس فيها
  await tx.fiscalPeriod.updateMany({
    where: { fiscalYearId, status: 'LOCKED' },
    data: { status: 'OPEN', closedAt: null },
  });
  await tx.fiscalYear.update({
    where: { id: fiscalYearId },
    data: { status: 'OPEN', closedAt: null, closedBy: null },
  });

  const reversal = await reverseEntry(tx, tenantId, closing.closingEntryId!, {
    date: opts.date ?? closing.closingDate,
    memoAr: `الرجوع عن إقفال ${closing.fiscalYear.name}${opts.reason ? ` — ${opts.reason}` : ''}`,
    actor: opts.actor,
  });

  return tx.yearEndClosing.update({
    where: { id: closing.id },
    data: {
      status: 'REVERSED',
      reversalEntryId: reversal.id,
      reversedAt: new Date(),
      reversedBy: opts.actor ?? null,
    },
  });
}

/**
 * الرصيد الافتتاحي للسنة الجديدة.
 *
 * لا يحتاج قيداً: النظام يقرأ الأرصدة من الدفتر بلا انقطاع، فحسابات الميزانية
 * تحمل رصيدها عبر السنين تلقائياً. هذه الدالّة للعرض والتحقّق — تجيب عن
 * السؤال الذي يسأله المحاسب أول السنة: بماذا نبدأ؟
 *
 * والتحقّق فيها ليس تجميلاً: مجموع أرصدة الميزانية يجب أن يكون صفراً
 * (الأصول = الخصوم + حقوق الملكية). غيرُ الصفر يعني إقفالاً ناقصاً.
 */
export async function openingBalances(tx: Tx, tenantId: string, fiscalYearId: string) {
  const fy = await tx.fiscalYear.findFirstOrThrow({ where: { id: fiscalYearId, tenantId } });

  const dayBefore = new Date(fy.startDate);
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);

  const { rows } = await trialBalance(
    tx, tenantId,
    new Date(Date.UTC(1970, 0, 1)),
    dayBefore,
  );

  // حسابات الميزانية وحدها تُرحَّل أرصدتها؛ المؤقّتة تبدأ من صفر.
  const balanceSheetRows = rows
    .filter((r) => ['ASSET', 'LIABILITY', 'EQUITY'].includes(r.type))
    .map((r) => ({
      code: r.code, nameAr: r.nameAr, type: r.type,
      debit: r.closingDebit, credit: r.closingCredit,
    }))
    .filter((r) => !(r.debit.isZero() && r.credit.isZero()));

  const temporaryWithBalance = rows
    .filter((r) => ['REVENUE', 'EXPENSE'].includes(r.type))
    .filter((r) => !(r.closingDebit.isZero() && r.closingCredit.isZero()))
    .map((r) => ({ code: r.code, nameAr: r.nameAr }));

  const totalDebit = money(balanceSheetRows.reduce((s, r) => s.plus(r.debit), new Decimal(0)));
  const totalCredit = money(balanceSheetRows.reduce((s, r) => s.plus(r.credit), new Decimal(0)));
  const difference = money(totalDebit.minus(totalCredit));

  return {
    asOf: dayBefore,
    rows: balanceSheetRows,
    totalDebit, totalCredit, difference,
    balanced: difference.isZero(),
    /** حسابات مؤقّتة ما زال لها رصيد — علامة إقفالٍ ناقص */
    unclosedTemporary: temporaryWithBalance,
  };
}
