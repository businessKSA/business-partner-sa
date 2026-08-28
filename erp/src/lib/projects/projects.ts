/**
 * المشاريع والمهام وساعات العمل.
 *
 * الغاية من هذا الموديول رقمٌ واحد يصعب الوصول إليه في أغلب الأنظمة:
 * **هل هذا المشروع رابح؟** والجواب يحتاج ثلاثة أشياء مجتمعة — إيراده
 * المفوتَر، وتكلفته المباشرة، وساعاتِ من عمل عليه محسوبةً بأجورهم. أوّلان
 * يأتيان من الدفتر (كل سطر يحمل `projectId`)، والثالث من سجلّ الساعات.
 *
 * ولذلك سجلّ الساعات هنا ليس أداةَ متابعةٍ إدارية: هو مصدر تكلفةٍ حقيقي،
 * وسعر الساعة يُثبَّت لحظة التسجيل لا يُقرأ لاحقاً — لأن أجر الموظف يتغيّر،
 * ومشروعٌ انتهى قبل عامين يجب أن تبقى تكلفته كما كانت.
 */
import type { Tx } from '../db.ts';
import { d, money, sum, Decimal, type Num } from '../money.ts';
import { DomainError, ValidationError } from '../errors.ts';
import { nextNumber } from '../accounting/numbering.ts';

export type ProjectInput = {
  code?: string;
  nameAr: string;
  nameEn?: string | null;
  descAr?: string | null;
  partnerId?: string | null;
  managerId?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  budget?: Num;
  contractValue?: Num;
  billableByHour?: boolean;
  hourlyRate?: Num;
};

export async function createProject(tx: Tx, tenantId: string, input: ProjectInput) {
  const code = input.code ?? (await nextNumber(tx, tenantId, 'PROJECT'));

  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    throw new ValidationError('تاريخ نهاية المشروع قبل بدايته.');
  }

  return tx.project.create({
    data: {
      tenantId, code,
      nameAr: input.nameAr,
      nameEn: input.nameEn ?? null,
      descAr: input.descAr ?? null,
      partnerId: input.partnerId ?? null,
      managerId: input.managerId ?? null,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      budget: d(input.budget ?? 0).toFixed(6),
      contractValue: d(input.contractValue ?? 0).toFixed(6),
      billableByHour: input.billableByHour ?? false,
      hourlyRate: d(input.hourlyRate ?? 0).toFixed(6),
    },
  });
}

export type TimesheetInput = {
  employeeId: string;
  projectId: string;
  taskId?: string | null;
  date: Date;
  hours: Num;
  descAr?: string | null;
  billable?: boolean;
  /** سعر الساعة — يُشتقّ من المشروع أو من أجر الموظف حين يُترك */
  rate?: Num;
};

/** ساعات اليوم الواحد لموظف — سقفٌ يمنع الخطأ المطبعي لا سياسة عمل. */
const MAX_HOURS_PER_DAY = 16;
/** ساعات العمل الشهرية المعتمدة في اشتقاق تكلفة الساعة من الأجر. */
const HOURS_PER_MONTH = 240;

/**
 * يسجّل ساعات عمل.
 *
 * السعر يُثبَّت الآن: قراءتُه لاحقاً من ملف الموظف تعني أن ترقيةً في ٢٠٢٧
 * تُعيد كتابة تكلفة مشروعٍ أُغلق في ٢٠٢٥.
 */
export async function logTime(tx: Tx, tenantId: string, input: TimesheetInput) {
  const hours = d(input.hours);
  if (!hours.greaterThan(0)) throw new ValidationError('عدد الساعات يجب أن يكون موجباً.');
  if (hours.greaterThan(MAX_HOURS_PER_DAY)) {
    throw new ValidationError(`${hours.toFixed(1)} ساعة في يوم واحد — راجِع الإدخال.`);
  }

  const project = await tx.project.findFirst({ where: { id: input.projectId, tenantId } });
  if (!project) throw new DomainError('المشروع غير موجود', 'NOT_FOUND');
  if (['COMPLETED', 'CANCELLED'].includes(project.status)) {
    throw new ValidationError(
      `المشروع «${project.nameAr}» حالته «${project.status}» ولا تُسجَّل عليه ساعات.`,
    );
  }

  const employee = await tx.employee.findFirst({ where: { id: input.employeeId, tenantId } });
  if (!employee) throw new DomainError('الموظف غير موجود', 'NOT_FOUND');

  // مجموع ساعات اليوم لا يتجاوز السقف عبر المشاريع كلها
  const sameDay = await tx.timesheet.aggregate({
    where: { tenantId, employeeId: input.employeeId, date: input.date },
    _sum: { hours: true },
  });
  const dayTotal = d(sameDay._sum.hours ?? 0).plus(hours);
  if (dayTotal.greaterThan(MAX_HOURS_PER_DAY)) {
    throw new ValidationError(
      `مجموع ساعات ${employee.nameAr} في ${input.date.toISOString().slice(0, 10)} ` +
        `سيصير ${dayTotal.toFixed(1)} ساعة — راجِع الإدخال.`,
    );
  }

  // ترتيب اشتقاق السعر: ما مُرِّر، فسعر المشروع، فتكلفة ساعة الموظف
  const rate =
    input.rate !== undefined && input.rate !== null
      ? d(input.rate)
      : project.billableByHour && d(project.hourlyRate).greaterThan(0)
        ? d(project.hourlyRate)
        : d(employee.basicSalary)
            .plus(d(employee.housingAllowance))
            .plus(d(employee.transportAllowance))
            .dividedBy(HOURS_PER_MONTH);

  return tx.timesheet.create({
    data: {
      tenantId,
      employeeId: input.employeeId,
      projectId: input.projectId,
      taskId: input.taskId ?? null,
      date: input.date,
      hours: hours.toFixed(2),
      descAr: input.descAr ?? null,
      billable: input.billable ?? true,
      rate: money(rate).toFixed(6),
    },
  });
}

export async function approveTimesheets(
  tx: Tx,
  tenantId: string,
  ids: string[],
  approver: string,
) {
  if (!ids.length) return { count: 0 };
  return tx.timesheet.updateMany({
    where: { tenantId, id: { in: ids }, status: { in: ['DRAFT', 'SUBMITTED'] } },
    data: { status: 'APPROVED', approvedBy: approver, approvedAt: new Date() },
  });
}

/**
 * ربحية المشروع.
 *
 * الإيراد والتكلفة من الدفتر — لا من الفواتير — لأن التسويات وقيود الاستهلاك
 * الموزَّعة على المشاريع لا تمرّ بالفواتير. وتكلفة الساعات تُعرض منفصلةً
 * لأنها في الغالب غير مرحَّلة كمصروف مباشر على المشروع، فجمعُها بالتكلفة
 * الدفترية يحسبها مرّتين.
 */
export async function projectProfitability(tx: Tx, tenantId: string, projectId: string) {
  const project = await tx.project.findFirstOrThrow({ where: { id: projectId, tenantId } });

  const ledger = await tx.$queryRaw<
    { type: string; debit: string; credit: string }[]
  >`
    SELECT a."type"::text AS type,
           COALESCE(SUM(l."debit"), 0)::text  AS debit,
           COALESCE(SUM(l."credit"), 0)::text AS credit
    FROM "JournalLine" l
    JOIN "JournalEntry" e ON e."id" = l."entryId"
    JOIN "Account" a ON a."id" = l."accountId"
    WHERE l."tenantId" = ${tenantId}
      AND l."projectId" = ${projectId}
      AND e."status" IN ('POSTED', 'REVERSED')
      AND a."type" IN ('REVENUE', 'EXPENSE')
    GROUP BY a."type"
  `;

  const revenueRow = ledger.find((r) => r.type === 'REVENUE');
  const expenseRow = ledger.find((r) => r.type === 'EXPENSE');

  const revenue = money(d(revenueRow?.credit).minus(d(revenueRow?.debit)));
  const directCost = money(d(expenseRow?.debit).minus(d(expenseRow?.credit)));

  const timesheets = await tx.timesheet.findMany({
    where: { tenantId, projectId },
    select: { hours: true, rate: true, billable: true, invoiced: true },
  });

  const totalHours = d(sum(timesheets.map((t) => t.hours)));
  const billableHours = d(sum(timesheets.filter((t) => t.billable).map((t) => t.hours)));
  const laborCost = money(sum(timesheets.map((t) => d(t.hours).times(d(t.rate)))));
  const unbilledValue = money(
    sum(timesheets.filter((t) => t.billable && !t.invoiced).map((t) => d(t.hours).times(d(t.rate)))),
  );

  const grossProfit = money(revenue.minus(directCost));
  const profitWithLabor = money(revenue.minus(directCost).minus(laborCost));

  const budget = money(project.budget);
  const budgetUsed = budget.isZero() ? null : directCost.dividedBy(budget).times(100).toDecimalPlaces(2);

  return {
    project,
    revenue,
    directCost,
    laborCost,
    grossProfit,
    /** الربح بعد تحميل تكلفة ساعات العمل — الرقم الذي يقول إن كان المشروع يستحق */
    profitWithLabor,
    margin: revenue.isZero() ? null : grossProfit.dividedBy(revenue).times(100).toDecimalPlaces(2),
    totalHours: totalHours.toDecimalPlaces(2),
    billableHours: billableHours.toDecimalPlaces(2),
    utilization: totalHours.isZero() ? null : billableHours.dividedBy(totalHours).times(100).toDecimalPlaces(2),
    /** قيمة ساعاتٍ قابلة للفوترة لم تُفوتر بعد — إيرادٌ منسيّ */
    unbilledValue,
    budget,
    budgetUsedPercent: budgetUsed,
    overBudget: !budget.isZero() && directCost.greaterThan(budget),
  };
}

/**
 * يبني سطور فاتورة من الساعات غير المفوترة.
 *
 * تُجمَّع بسعر الساعة لا بالموظف: العميل اتّفق على سعر ساعة، وتفصيلُ من
 * عمل كم ساعة شأنٌ داخلي لا يُعرض عليه في الفاتورة.
 */
export async function billableLinesFromTimesheets(
  tx: Tx,
  tenantId: string,
  projectId: string,
  upTo?: Date,
) {
  const sheets = await tx.timesheet.findMany({
    where: {
      tenantId, projectId, billable: true, invoiced: false,
      status: 'APPROVED',
      ...(upTo ? { date: { lte: upTo } } : {}),
    },
  });

  if (!sheets.length) return { lines: [], timesheetIds: [] };

  const byRate = new Map<string, Decimal>();
  for (const s of sheets) {
    const key = money(s.rate).toFixed(2);
    byRate.set(key, (byRate.get(key) ?? new Decimal(0)).plus(d(s.hours)));
  }

  const project = await tx.project.findFirstOrThrow({ where: { id: projectId, tenantId } });

  return {
    lines: [...byRate.entries()].map(([rate, hours]) => ({
      descAr: `ساعات عمل — ${project.nameAr}`,
      qty: hours.toDecimalPlaces(2),
      uomCode: 'HUR',
      unitPrice: new Decimal(rate),
    })),
    timesheetIds: sheets.map((s) => s.id),
  };
}

/** يعلّم الساعات مفوترةً بعد إصدار الفاتورة. */
export async function markTimesheetsInvoiced(tx: Tx, tenantId: string, ids: string[]) {
  if (!ids.length) return { count: 0 };
  return tx.timesheet.updateMany({
    where: { tenantId, id: { in: ids } },
    data: { invoiced: true },
  });
}

/** لوحة المشاريع: حالة كل مشروع وربحيته في نظرة واحدة. */
export async function projectsOverview(tx: Tx, tenantId: string) {
  const projects = await tx.project.findMany({
    where: { tenantId, status: { notIn: ['CANCELLED'] } },
    orderBy: { code: 'asc' },
    include: { partner: { select: { nameAr: true } } },
  });

  const rows = [];
  for (const p of projects) {
    const perf = await projectProfitability(tx, tenantId, p.id);
    const openTasks = await tx.projectTask.count({
      where: { tenantId, projectId: p.id, status: { notIn: ['DONE', 'CANCELLED'] } },
    });
    rows.push({
      id: p.id, code: p.code, nameAr: p.nameAr,
      partnerAr: p.partner?.nameAr ?? null,
      status: p.status,
      revenue: perf.revenue,
      directCost: perf.directCost,
      grossProfit: perf.grossProfit,
      margin: perf.margin,
      totalHours: perf.totalHours,
      unbilledValue: perf.unbilledValue,
      overBudget: perf.overBudget,
      openTasks,
    });
  }
  return rows;
}
