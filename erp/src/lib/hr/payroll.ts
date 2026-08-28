/**
 * مسيّر الرواتب.
 *
 * ثلاث مراحل مفصولة عمداً: توليد المسيّر (حساب)، واعتماده (قرار بشري)،
 * وترحيله (أثرٌ في الدفتر). الفصل ليس بيروقراطية: المسيّر المولَّد يُراجَع
 * ويُعدَّل، والاعتماد هو الإقرار بصحّته، والترحيل بعده لا رجعة فيه إلا
 * بقيدٍ عاكس. نظامٌ يجمع الثلاثة في زرٍّ واحد يجعل خطأً في بدلٍ واحد قيداً
 * في الأستاذ قبل أن يراه أحد.
 *
 * قيد المسيّر:
 *   من ح/ الرواتب والأجور              بالأساسي
 *   من ح/ البدلات والمزايا             بالبدلات والإضافي والمكافآت
 *   من ح/ حصة صاحب العمل في التأمينات   بحصّته
 *     إلى ح/ رواتب مستحقة               بالصافي
 *     إلى ح/ التأمينات المستحقة          بالحصّتين معاً
 *
 * لاحظ أن حصة الموظف لا تظهر مصروفاً: هي جزءٌ من أجره اقتُطع منه ليُورَّد،
 * فالمصروف هو الأجر كاملاً. وحصة صاحب العمل مصروفٌ إضافي فوق الأجر.
 */
import type { Tx } from '../db.ts';
import { d, money, sum, Decimal, type Num } from '../money.ts';
import { DomainError, ValidationError } from '../errors.ts';
import { postEntry, reverseEntry, accountByRole } from '../accounting/posting.ts';
import { nextNumber } from '../accounting/numbering.ts';
import { calculateGosi, DEFAULT_GOSI_RATES, type GosiRates } from './gosi.ts';

export type PayrollAdjustment = {
  employeeId: string;
  overtimeHours?: Num;
  bonus?: Num;
  absentDays?: Num;
  loanDeduction?: Num;
  otherDeduction?: Num;
  notes?: string | null;
};

export type PayrollInput = {
  year: number;
  month: number;
  payDate?: Date;
  /** تعديلات هذا الشهر لكل موظف */
  adjustments?: PayrollAdjustment[];
  /** نسب التأمينات — تُقرأ من إعدادات المنشأة حين تُترك */
  gosiRates?: GosiRates;
  createdBy?: string;
};

/** أيام الشهر المعتمدة في خصم الغياب — ثلاثون يوماً هو العُرف المحاسبي. */
const DAYS_IN_MONTH = 30;
/** ساعات العمل الشهرية المعتمدة في احتساب أجر الساعة. */
const HOURS_PER_MONTH = 240;
/** معامل أجر الساعة الإضافية وفق نظام العمل: الأجر + ٥٠٪. */
const OVERTIME_MULTIPLIER = 1.5;

export async function generatePayrollRun(tx: Tx, tenantId: string, input: PayrollInput) {
  if (input.month < 1 || input.month > 12) {
    throw new ValidationError('الشهر يجب أن يكون بين ١ و١٢.');
  }

  const existing = await tx.payrollRun.findUnique({
    where: { tenantId_year_month: { tenantId, year: input.year, month: input.month } },
  });
  if (existing && existing.status !== 'CANCELLED') {
    throw new DomainError(
      `مسيّر ${input.month}/${input.year} موجود بالرقم ${existing.number} وحالته «${existing.status}».`,
      'PAYROLL_EXISTS',
    );
  }

  const periodStart = new Date(Date.UTC(input.year, input.month - 1, 1));
  const periodEnd = new Date(Date.UTC(input.year, input.month, 0));
  const payDate = input.payDate ?? periodEnd;

  const employees = await tx.employee.findMany({
    where: { tenantId, status: { in: ['ACTIVE', 'ON_LEAVE'] } },
    orderBy: { code: 'asc' },
  });

  if (!employees.length) {
    throw new ValidationError('لا يوجد موظفون على رأس العمل في هذا الشهر.');
  }

  const rates = input.gosiRates ?? DEFAULT_GOSI_RATES;
  const adjustmentsByEmployee = new Map(
    (input.adjustments ?? []).map((a) => [a.employeeId, a]),
  );

  const number = await nextNumber(tx, tenantId, 'PAYROLL_RUN', payDate);

  const payslips = [];
  let totalGross = new Decimal(0);
  let totalDeductions = new Decimal(0);
  let totalGosiEmp = new Decimal(0);
  let totalGosiEmployer = new Decimal(0);
  let totalNet = new Decimal(0);

  for (const emp of employees) {
    // الموظف الذي عُيّن بعد نهاية الشهر لا مسيّر له.
    if (emp.hireDate > periodEnd) continue;
    if (emp.terminationDate && emp.terminationDate < periodStart) continue;

    const adj = adjustmentsByEmployee.get(emp.id);

    const basic = money(emp.basicSalary);
    const housing = money(emp.housingAllowance);
    const transport = money(emp.transportAllowance);
    const other = money(emp.otherAllowance);

    const absentDays = money(adj?.absentDays ?? 0);
    if (absentDays.greaterThan(DAYS_IN_MONTH)) {
      throw new ValidationError(
        `أيام غياب ${emp.nameAr} (${absentDays.toFixed(0)}) تتجاوز أيام الشهر.`,
      );
    }
    const workedDays = money(new Decimal(DAYS_IN_MONTH).minus(absentDays));

    // خصم الغياب من الأجر الكامل لا من الأساسي وحده — لأن البدلات جزءٌ
    // من أجر اليوم الذي لم يُعمل.
    const fullWage = money(basic.plus(housing).plus(transport).plus(other));
    const absenceDeduction = money(fullWage.dividedBy(DAYS_IN_MONTH).times(absentDays));

    const overtimeHours = money(adj?.overtimeHours ?? 0);
    // التقريب مرّة واحدة في آخر الحساب لا على أجر الساعة أوّلاً: تقريبُ
    // ٥٤٫١٦٦٦ إلى ٥٤٫١٧ ثم ضربُه في ١٥ ساعة يزيد الأجر خمسَ هللات لا
    // مبرّر لها، وهي الهللات التي يُختلف عليها في نزاع عمّالي.
    const hourlyRate = fullWage.dividedBy(HOURS_PER_MONTH);
    const overtimeAmount = money(hourlyRate.times(OVERTIME_MULTIPLIER).times(overtimeHours));

    const bonus = money(adj?.bonus ?? 0);

    const gross = money(fullWage.plus(overtimeAmount).plus(bonus));

    // وعاء التأمينات هو الأساسي والسكن الأصليان — لا يتأثّر بالإضافي
    // ولا بالمكافأة، لأن الاشتراك على الأجر الثابت.
    const gosi = calculateGosi({
      basicSalary: basic,
      housingAllowance: housing,
      isSaudi: emp.isSaudi,
      subject: emp.gosiSubject,
      rates,
    });

    const loanDeduction = money(adj?.loanDeduction ?? 0);
    const otherDeduction = money(adj?.otherDeduction ?? 0);
    const deductions = money(
      absenceDeduction.plus(gosi.employee).plus(loanDeduction).plus(otherDeduction),
    );

    const net = money(gross.minus(deductions));
    if (net.isNegative()) {
      throw new ValidationError(
        `صافي راتب ${emp.nameAr} سالب (${net.toFixed(2)}). راجِع الخصومات.`,
      );
    }

    payslips.push({
      tenantId,
      employeeId: emp.id,
      basicSalary: basic.toFixed(6),
      housingAllowance: housing.toFixed(6),
      transportAllowance: transport.toFixed(6),
      otherAllowance: other.toFixed(6),
      overtimeAmount: overtimeAmount.toFixed(6),
      bonus: bonus.toFixed(6),
      gross: gross.toFixed(6),
      gosiEmployee: gosi.employee.toFixed(6),
      gosiEmployer: gosi.employer.toFixed(6),
      absenceDeduction: absenceDeduction.toFixed(6),
      loanDeduction: loanDeduction.toFixed(6),
      otherDeduction: otherDeduction.toFixed(6),
      totalDeductions: deductions.toFixed(6),
      net: net.toFixed(6),
      workedDays: workedDays.toFixed(2),
      absentDays: absentDays.toFixed(2),
      overtimeHours: overtimeHours.toFixed(2),
      notes: adj?.notes ?? null,
    });

    totalGross = totalGross.plus(gross);
    totalDeductions = totalDeductions.plus(deductions);
    totalGosiEmp = totalGosiEmp.plus(gosi.employee);
    totalGosiEmployer = totalGosiEmployer.plus(gosi.employer);
    totalNet = totalNet.plus(net);
  }

  if (!payslips.length) {
    throw new ValidationError('لا قسائم في هذا المسيّر — راجِع تواريخ التعيين وانتهاء الخدمة.');
  }

  return tx.payrollRun.create({
    data: {
      tenantId, number,
      year: input.year, month: input.month,
      periodStart, periodEnd, payDate,
      totalGross: money(totalGross).toFixed(6),
      totalDeductions: money(totalDeductions).toFixed(6),
      totalGosiEmp: money(totalGosiEmp).toFixed(6),
      totalGosiEmployer: money(totalGosiEmployer).toFixed(6),
      totalNet: money(totalNet).toFixed(6),
      createdBy: input.createdBy ?? null,
      payslips: { create: payslips },
    },
    include: { payslips: { include: { employee: true } } },
  });
}

/** الاعتماد: قرارٌ بشري يفصل الحساب عن الأثر. */
export async function approvePayrollRun(tx: Tx, tenantId: string, runId: string, actor: string) {
  const run = await tx.payrollRun.findFirst({ where: { id: runId, tenantId } });
  if (!run) throw new DomainError('المسيّر غير موجود', 'NOT_FOUND');
  if (run.status !== 'DRAFT') {
    throw new DomainError(`المسيّر ${run.number} حالته «${run.status}».`, 'NOT_DRAFT');
  }
  return tx.payrollRun.update({
    where: { id: runId },
    data: { status: 'APPROVED', approvedAt: new Date() },
  });
}

export async function postPayrollRun(tx: Tx, tenantId: string, runId: string, actor?: string) {
  const run = await tx.payrollRun.findFirst({
    where: { id: runId, tenantId },
    include: { payslips: { include: { employee: { include: { department: true } } } } },
  });
  if (!run) throw new DomainError('المسيّر غير موجود', 'NOT_FOUND');
  if (run.status !== 'APPROVED') {
    throw new DomainError(
      `المسيّر ${run.number} حالته «${run.status}» — يُعتمد قبل ترحيله.`,
      'NOT_APPROVED',
    );
  }

  const basicAcc = await accountByRole(tx, tenantId, 'PAYROLL_BASIC');
  const allowanceAcc = await accountByRole(tx, tenantId, 'PAYROLL_ALLOWANCE');
  const gosiExpenseAcc = await accountByRole(tx, tenantId, 'GOSI_EXPENSE');
  const salaryPayableAcc = await accountByRole(tx, tenantId, 'SALARY_PAYABLE');
  const gosiPayableAcc = await accountByRole(tx, tenantId, 'GOSI_PAYABLE');

  const lines: Record<string, unknown>[] = [];

  // الأجر الأساسي وبدلاته، موظفاً موظفاً — ليُقرأ في الأستاذ بمركز تكلفته
  for (const slip of run.payslips) {
    const basic = money(slip.basicSalary);
    const allowances = money(
      d(slip.housingAllowance)
        .plus(d(slip.transportAllowance))
        .plus(d(slip.otherAllowance))
        .plus(d(slip.overtimeAmount))
        .plus(d(slip.bonus))
        .minus(d(slip.absenceDeduction)),
    );

    if (!basic.isZero()) {
      lines.push({
        accountId: basicAcc.id, debit: basic,
        descAr: `أجر أساسي — ${slip.employee.nameAr}`,
        employeeId: slip.employeeId,
        costCenterId: slip.employee.department?.costCenterId ?? null,
      });
    }
    if (!allowances.isZero()) {
      lines.push({
        accountId: allowanceAcc.id,
        [allowances.isNegative() ? 'credit' : 'debit']: allowances.abs(),
        descAr: `بدلات وإضافي — ${slip.employee.nameAr}`,
        employeeId: slip.employeeId,
        costCenterId: slip.employee.department?.costCenterId ?? null,
      });
    }
  }

  const gosiEmployer = money(run.totalGosiEmployer);
  if (!gosiEmployer.isZero()) {
    lines.push({
      accountId: gosiExpenseAcc.id, debit: gosiEmployer,
      descAr: `حصة صاحب العمل في التأمينات — ${run.month}/${run.year}`,
    });
  }

  lines.push({
    accountId: salaryPayableAcc.id, credit: money(run.totalNet),
    descAr: `صافي رواتب ${run.month}/${run.year}`,
  });

  const gosiTotal = money(d(run.totalGosiEmp).plus(d(run.totalGosiEmployer)));
  if (!gosiTotal.isZero()) {
    lines.push({
      accountId: gosiPayableAcc.id, credit: gosiTotal,
      descAr: `التأمينات المستحقة ${run.month}/${run.year} (حصة الموظفين وصاحب العمل)`,
    });
  }

  // خصومات السلف وغيرها ترجع إلى حساب العهد
  const otherDeductions = money(
    sum(run.payslips.map((s) => d(s.loanDeduction).plus(d(s.otherDeduction)))),
  );
  if (!otherDeductions.isZero()) {
    const advanceAcc = await accountByRole(tx, tenantId, 'EMPLOYEE_ADVANCE');
    lines.push({
      accountId: advanceAcc.id, credit: otherDeductions,
      descAr: `استرداد سلف وخصومات ${run.month}/${run.year}`,
    });
  }

  const entry = await postEntry(tx, tenantId, {
    date: run.payDate,
    memoAr: `مسيّر رواتب ${run.month}/${run.year} — ${run.number}`,
    ref: run.number,
    sourceType: 'PAYROLL',
    sourceId: run.id,
    createdBy: actor,
    lines: lines as never,
  });

  return tx.payrollRun.update({
    where: { id: run.id },
    data: { status: 'POSTED', journalEntryId: entry.id, postedAt: new Date() },
    include: { payslips: true },
  });
}

/** يلغي مسيّراً مرحَّلاً بعكس قيده. */
export async function cancelPayrollRun(
  tx: Tx,
  tenantId: string,
  runId: string,
  opts: { date?: Date; reason?: string; actor?: string } = {},
) {
  const run = await tx.payrollRun.findFirst({ where: { id: runId, tenantId } });
  if (!run) throw new DomainError('المسيّر غير موجود', 'NOT_FOUND');
  if (run.status === 'CANCELLED') throw new DomainError('ملغى سلفاً.', 'ALREADY_CANCELLED');

  if (run.journalEntryId) {
    await reverseEntry(tx, tenantId, run.journalEntryId, {
      date: opts.date ?? new Date(),
      memoAr: `إلغاء مسيّر ${run.number}${opts.reason ? ` — ${opts.reason}` : ''}`,
      actor: opts.actor,
    });
  }

  return tx.payrollRun.update({ where: { id: run.id }, data: { status: 'CANCELLED' } });
}
