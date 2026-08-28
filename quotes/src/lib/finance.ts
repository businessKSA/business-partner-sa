/**
 * الدفتر المالي الداخلي — مصاريف وإيرادات ورواتب وملخصات.
 *
 * قاعدة الإيراد: فواتير اللوحة المدفوعة (عدا عُهد الرسوم الحكومية — ليست
 * إيراداً) تُحتسب آلياً ولا تُقيَّد مرة ثانية؛ قيود RevenueEntry لما يقع
 * خارج الفواتير فقط. فلا ازدواج في أي مجموع.
 *
 * ضريبة القيمة المضافة: المخرجات من الإيرادات، والمدخلات من المصاريف التي
 * لمورّدها رقم ضريبي — شرط الخصم في الإقرار.
 */
import { prisma } from './db';
import { round2 } from './money';
import { audit } from './timeline';
import { EXPENSE_CATEGORY, COST_CENTER } from './finance-enums';

async function nextNumber(scope: string, prefix: string): Promise<string> {
  const year = new Date().getUTCFullYear();
  const row = await prisma.counter.upsert({
    where: { id: `${scope}:${year}` },
    create: { id: `${scope}:${year}`, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${prefix}-${year}-${String(row.value).padStart(4, '0')}`;
}

// ------------------------------------------------------------------ المصاريف

export interface ExpenseInput {
  date: Date;
  costCenter: string;
  category: string;
  vendorName: string;
  vendorVat?: string | null;
  descAr: string;
  amountExclVat: number;
  vatAmount?: number;
  method?: string;
  notes?: string | null;
  payrollRunId?: string | null;
  employeeId?: string | null;
  actor?: string;
}

export async function createExpense(input: ExpenseInput) {
  const amount = round2(input.amountExclVat);
  const vat = round2(input.vatAmount ?? 0);
  const category = EXPENSE_CATEGORY[input.category] ? input.category : 'OTHER';
  const costCenter = COST_CENTER[input.costCenter] ? input.costCenter : EXPENSE_CATEGORY[category].defaultCenter;
  const expense = await prisma.expense.create({
    data: {
      number: await nextNumber('EXP', 'EXP'),
      date: input.date,
      costCenter,
      category,
      vendorName: input.vendorName.trim(),
      vendorVat: input.vendorVat?.replace(/\D/g, '') || null,
      descAr: input.descAr.trim(),
      amountExclVat: amount,
      vatAmount: vat,
      total: round2(amount + vat),
      method: input.method || 'TRANSFER',
      notes: input.notes || null,
      payrollRunId: input.payrollRunId ?? null,
      employeeId: input.employeeId ?? null,
      actor: input.actor || 'admin',
    },
  });
  await audit({
    action: 'finance.expense.create',
    entityType: 'Expense',
    entityId: expense.id,
    actor: input.actor || 'admin',
    amount: expense.total,
    payload: { number: expense.number, category, costCenter },
  });
  return expense;
}

// ------------------------------------------------------------------ الإيرادات

export interface RevenueInput {
  date: Date;
  costCenter: string;
  source: string;
  descAr: string;
  amountExclVat: number;
  vatAmount?: number;
  method?: string;
  notes?: string | null;
  actor?: string;
}

export async function createRevenue(input: RevenueInput) {
  const amount = round2(input.amountExclVat);
  const vat = round2(input.vatAmount ?? 0);
  const entry = await prisma.revenueEntry.create({
    data: {
      number: await nextNumber('REV', 'REV'),
      date: input.date,
      costCenter: COST_CENTER[input.costCenter] ? input.costCenter : 'SALES',
      source: input.source.trim(),
      descAr: input.descAr.trim(),
      amountExclVat: amount,
      vatAmount: vat,
      total: round2(amount + vat),
      method: input.method || 'TRANSFER',
      notes: input.notes || null,
      actor: input.actor || 'admin',
    },
  });
  await audit({
    action: 'finance.revenue.create',
    entityType: 'RevenueEntry',
    entityId: entry.id,
    actor: input.actor || 'admin',
    amount: entry.total,
    payload: { number: entry.number },
  });
  return entry;
}

// ------------------------------------------------------------------ الرواتب

/**
 * توليد مسير رواتب شهر (YYYY-MM): سطر لكل موظف نشط، ومصروف على مركز تكلفة
 * الموظف بكلفة المنشأة الكاملة (أساسي + بدلات + حصة المنشأة في التأمينات).
 * حصة الموظف تُخصم من صافي التحويل لا من كلفة المنشأة.
 */
export async function createPayrollRun(month: string, actor = 'admin') {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('صيغة الشهر YYYY-MM');
  const existing = await prisma.payrollRun.findUnique({ where: { month } });
  if (existing) throw new Error(`مسير شهر ${month} موجود بالفعل (${existing.id})`);
  const employees = await prisma.employee.findMany({ where: { status: 'ACTIVE' } });
  if (!employees.length) throw new Error('لا موظفين نشطين — أضف الموظفين أولاً');

  let totalNet = 0;
  let totalGosi = 0;
  let totalCost = 0;
  const lines = employees.map((e) => {
    const net = round2(e.basicSalary + e.allowances - e.gosiEmployee);
    const cost = round2(e.basicSalary + e.allowances + e.gosiEmployer);
    totalNet = round2(totalNet + net);
    totalGosi = round2(totalGosi + e.gosiEmployer + e.gosiEmployee);
    totalCost = round2(totalCost + cost);
    return {
      employeeId: e.id,
      basicSalary: e.basicSalary,
      allowances: e.allowances,
      gosiEmployee: e.gosiEmployee,
      gosiEmployer: e.gosiEmployer,
      netPay: net,
    };
  });

  const run = await prisma.payrollRun.create({
    data: { month, totalNet, totalGosi, totalCost, status: 'POSTED', actor, lines: { create: lines } },
  });

  // مصروف لكل موظف على مركز تكلفته — الرواتب خارج نطاق ضريبة القيمة المضافة
  const payDate = new Date(`${month}-27T00:00:00Z`);
  for (const e of employees) {
    const cost = round2(e.basicSalary + e.allowances + e.gosiEmployer);
    const net = round2(e.basicSalary + e.allowances - e.gosiEmployee);
    await createExpense({
      date: payDate,
      costCenter: e.costCenter,
      category: 'SALARIES',
      vendorName: e.nameAr,
      descAr: `راتب ${month} — صافي التحويل ${net.toFixed(2)} ريال`,
      amountExclVat: cost,
      vatAmount: 0,
      method: 'TRANSFER',
      payrollRunId: run.id,
      employeeId: e.id,
      actor,
    });
  }

  await audit({
    action: 'finance.payroll.post',
    entityType: 'PayrollRun',
    entityId: run.id,
    actor,
    amount: totalCost,
    payload: { month, employees: employees.length, totalNet, totalGosi },
  });
  return run;
}

// ------------------------------------------------------------------ الملخصات

export interface PeriodTotals {
  revenueNet: number;
  revenueVat: number;
  expenseNet: number;
  expenseVat: number;
  profit: number;
  vatDue: number;
  invoiceCount: number;
}

export interface CenterRow {
  center: string;
  revenue: number;
  expense: number;
}

export interface FinanceSummary extends PeriodTotals {
  byCenter: CenterRow[];
}

/** ملخص فترة: من الفواتير المدفوعة + الإيرادات اليدوية − المصاريف. */
export async function financeSummary(from: Date, to: Date): Promise<FinanceSummary> {
  const [paidInvoices, revenues, expenses] = await Promise.all([
    // العهدة بنوعيها ليست إيراداً: رسوم حكومية أو قيمة توريد تمرّ عبر محفظة
    // العميل وتُصرف بإيصالاتها. الشرطان معاً لأن الإيداع اليدوي قد يحمل
    // depositKind دون isGovFeeDeposit — وهي نفس القاعدة التي يطبّقها
    // issueTaxInvoiceFor في billing.ts.
    prisma.invoice.findMany({
      where: {
        status: 'PAID',
        isGovFeeDeposit: false,
        depositKind: null,
        paidAt: { gte: from, lt: to },
      },
      select: { amountExclVat: true, vatAmount: true },
    }),
    prisma.revenueEntry.findMany({
      where: { date: { gte: from, lt: to } },
      select: { amountExclVat: true, vatAmount: true, costCenter: true },
    }),
    prisma.expense.findMany({
      where: { date: { gte: from, lt: to } },
      select: { amountExclVat: true, vatAmount: true, costCenter: true, vendorVat: true },
    }),
  ]);

  let revenueNet = 0;
  let revenueVat = 0;
  const byCenter = new Map<string, CenterRow>();
  const center = (key: string) => {
    let row = byCenter.get(key);
    if (!row) { row = { center: key, revenue: 0, expense: 0 }; byCenter.set(key, row); }
    return row;
  };

  for (const i of paidInvoices) {
    revenueNet += i.amountExclVat;
    revenueVat += i.vatAmount;
    center('SALES').revenue += i.amountExclVat;
  }
  for (const r of revenues) {
    revenueNet += r.amountExclVat;
    revenueVat += r.vatAmount;
    center(r.costCenter).revenue += r.amountExclVat;
  }
  let expenseNet = 0;
  let expenseVat = 0;
  for (const e of expenses) {
    expenseNet += e.amountExclVat;
    // ضريبة المدخلات تُخصم فقط إذا كان للمورد رقم ضريبي (فاتورة ضريبية صحيحة)
    if (e.vendorVat) expenseVat += e.vatAmount;
    center(e.costCenter).expense += e.amountExclVat;
  }

  return {
    revenueNet: round2(revenueNet),
    revenueVat: round2(revenueVat),
    expenseNet: round2(expenseNet),
    expenseVat: round2(expenseVat),
    profit: round2(revenueNet - expenseNet),
    vatDue: round2(revenueVat - expenseVat),
    invoiceCount: paidInvoices.length,
    byCenter: Array.from(byCenter.values())
      .map((r) => ({ center: r.center, revenue: round2(r.revenue), expense: round2(r.expense) }))
      .sort((a, b) => (b.revenue + b.expense) - (a.revenue + a.expense)),
  };
}

/** حدود ربع السنة الميلادي الذي يقع فيه التاريخ — للإقرار الربعي. */
export function quarterBounds(at = new Date()): { from: Date; to: Date; label: string } {
  const y = at.getUTCFullYear();
  const q = Math.floor(at.getUTCMonth() / 3);
  const from = new Date(Date.UTC(y, q * 3, 1));
  const to = new Date(Date.UTC(y, q * 3 + 3, 1));
  return { from, to, label: `الربع ${['الأول', 'الثاني', 'الثالث', 'الرابع'][q]} ${y}` };
}

export function monthBounds(at = new Date()): { from: Date; to: Date; label: string } {
  const y = at.getUTCFullYear();
  const m = at.getUTCMonth();
  const from = new Date(Date.UTC(y, m, 1));
  const to = new Date(Date.UTC(y, m + 1, 1));
  return { from, to, label: `${y}-${String(m + 1).padStart(2, '0')}` };
}

export function yearBounds(at = new Date()): { from: Date; to: Date; label: string } {
  const y = at.getUTCFullYear();
  return { from: new Date(Date.UTC(y, 0, 1)), to: new Date(Date.UTC(y + 1, 0, 1)), label: String(y) };
}
