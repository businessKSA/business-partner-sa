'use server';

/** عمليات النظام المالي — مصاريف وإيرادات وموظفون ورواتب وإصدار ضريبي. */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { round2 } from '@/lib/money';
import { createExpense, createRevenue, createPayrollRun } from '@/lib/finance';
import { COST_CENTER, PAY_METHOD } from '@/lib/finance-enums';
import { issueTaxDocument, retryReport, issueCreditNote } from '@/lib/zatca/issue';

type State = { error?: string; ok?: string };

const s = (fd: FormData, k: string) => (fd.get(k) as string | null)?.trim() || '';
const n = (fd: FormData, k: string) => Number(fd.get(k) || 0);

// ----------------------------------------------------------------- المصاريف

export async function actionCreateExpense(_prev: State, fd: FormData): Promise<State> {
  const actor = await requireAdmin();
  const vendorName = s(fd, 'vendorName');
  const descAr = s(fd, 'descAr');
  const amount = n(fd, 'amountExclVat');
  if (!vendorName) return { error: 'أدخل اسم المورّد أو الجهة' };
  if (!descAr) return { error: 'أدخل وصف المصروف' };
  if (!(amount > 0)) return { error: 'أدخل مبلغاً أكبر من صفر' };
  const vat = n(fd, 'vatAmount');
  if (vat < 0 || vat > amount) return { error: 'مبلغ الضريبة غير منطقي' };
  const dateRaw = s(fd, 'date');

  const expense = await createExpense({
    date: dateRaw ? new Date(dateRaw) : new Date(),
    costCenter: s(fd, 'costCenter'),
    category: s(fd, 'category'),
    vendorName,
    vendorVat: s(fd, 'vendorVat') || null,
    descAr,
    amountExclVat: round2(amount),
    vatAmount: round2(vat),
    method: PAY_METHOD[s(fd, 'method')] ? s(fd, 'method') : 'TRANSFER',
    notes: s(fd, 'notes') || null,
    actor,
  });

  revalidatePath('/admin/finance/expenses');
  redirect(`/admin/finance/expenses?created=${expense.number}`);
}

// ---------------------------------------------------------------- الإيرادات

export async function actionCreateRevenue(_prev: State, fd: FormData): Promise<State> {
  const actor = await requireAdmin();
  const source = s(fd, 'source');
  const descAr = s(fd, 'descAr');
  const amount = n(fd, 'amountExclVat');
  if (!source) return { error: 'أدخل مصدر الإيراد' };
  if (!descAr) return { error: 'أدخل وصف الإيراد' };
  if (!(amount > 0)) return { error: 'أدخل مبلغاً أكبر من صفر' };
  const dateRaw = s(fd, 'date');

  const entry = await createRevenue({
    date: dateRaw ? new Date(dateRaw) : new Date(),
    costCenter: COST_CENTER[s(fd, 'costCenter')] ? s(fd, 'costCenter') : 'SALES',
    source,
    descAr,
    amountExclVat: round2(amount),
    vatAmount: round2(n(fd, 'vatAmount')),
    method: PAY_METHOD[s(fd, 'method')] ? s(fd, 'method') : 'TRANSFER',
    notes: s(fd, 'notes') || null,
    actor,
  });

  revalidatePath('/admin/finance/revenues');
  redirect(`/admin/finance/revenues?created=${entry.number}`);
}

// ----------------------------------------------------------------- الموظفون

export async function actionSaveEmployee(_prev: State, fd: FormData): Promise<State> {
  await requireAdmin();
  const id = s(fd, 'id');
  const nameAr = s(fd, 'nameAr');
  const basicSalary = n(fd, 'basicSalary');
  if (!nameAr) return { error: 'أدخل اسم الموظف' };
  if (!(basicSalary > 0)) return { error: 'أدخل الراتب الأساسي' };

  const data = {
    nameAr,
    nameEn: s(fd, 'nameEn') || null,
    nationalId: s(fd, 'nationalId') || null,
    jobTitleAr: s(fd, 'jobTitleAr') || null,
    costCenter: COST_CENTER[s(fd, 'costCenter')] ? s(fd, 'costCenter') : 'SHARED',
    iban: s(fd, 'iban') || null,
    basicSalary: round2(basicSalary),
    allowances: round2(n(fd, 'allowances')),
    gosiEmployer: round2(n(fd, 'gosiEmployer')),
    gosiEmployee: round2(n(fd, 'gosiEmployee')),
  };
  if (id) await prisma.employee.update({ where: { id }, data });
  else await prisma.employee.create({ data });

  revalidatePath('/admin/finance/hr');
  return { ok: id ? 'حُدِّثت بيانات الموظف' : 'أُضيف الموظف' };
}

export async function actionArchiveEmployee(id: string) {
  await requireAdmin();
  const emp = await prisma.employee.findUnique({ where: { id } });
  if (emp) {
    await prisma.employee.update({
      where: { id },
      data: { status: emp.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE' },
    });
  }
  revalidatePath('/admin/finance/hr');
}

export async function actionRunPayroll(_prev: State, fd: FormData): Promise<State> {
  const actor = await requireAdmin();
  const month = s(fd, 'month');
  try {
    const run = await createPayrollRun(month, actor);
    revalidatePath('/admin/finance/hr');
    revalidatePath('/admin/finance/expenses');
    return { ok: `قُيِّد مسير ${month} — إجمالي الكلفة ${run.totalCost.toFixed(2)} ريال` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

// -------------------------------------------------------- الفاتورة الضريبية

/** إصدار الفاتورة الضريبية داخلياً لفاتورة لوحة مدفوعة. */
export async function actionIssueTaxInvoice(invoiceId: string): Promise<State> {
  const actor = await requireAdmin();
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { client: true, zatcaRecord: true },
  });
  if (!invoice) return { error: 'الفاتورة غير موجودة' };
  if (invoice.zatcaRecord) return { error: `صدرت بالفعل: ${invoice.zatcaRecord.number}` };
  if (invoice.status !== 'PAID') return { error: 'تصدر الفاتورة الضريبية بعد السداد' };
  if (invoice.isGovFeeDeposit || invoice.depositKind) {
    return { error: 'العهدة ليست إيراداً — لا فاتورة ضريبية لها' };
  }

  const res = await issueTaxDocument({
    invoiceId: invoice.id,
    buyer: {
      name: invoice.client.companyAr || invoice.client.nameAr,
      vatNumber: invoice.client.vatNumber || null,
      crNumber: invoice.client.crNumber || null,
      city: invoice.client.city || null,
    },
    lines: [{
      nameAr: invoice.titleAr,
      quantity: 1,
      unitPrice: invoice.amountExclVat,
      vatPercent: invoice.vatRate * 100,
    }],
    paymentMeansCode: invoice.method === 'transfer' ? '42' : '48',
    actor,
  });
  if (!res.ok) return { error: res.error || 'تعذّر الإصدار' };

  revalidatePath('/admin/invoices');
  revalidatePath('/admin/finance/zatca');
  return { ok: `صدرت الفاتورة الضريبية ${res.number}` };
}

/** إشعار دائن يخفّض فاتورة ضريبية صدرت — إلغاء أو استرداد أو تصحيح. */
export async function actionIssueCreditNote(_prev: State, fd: FormData): Promise<State> {
  const actor = await requireAdmin();
  const recordId = s(fd, 'recordId');
  const reason = s(fd, 'reason');
  const amountRaw = s(fd, 'amountExclVat');
  if (!recordId) return { error: 'حدد الفاتورة الأصل' };

  const res = await issueCreditNote({
    recordId,
    // فارغ = رد كامل المتبقي
    amountExclVat: amountRaw ? round2(Number(amountRaw)) : null,
    reason,
    actor,
  });
  if (!res.ok) return { error: res.error || 'تعذّر إصدار الإشعار' };

  revalidatePath('/admin/finance/zatca');
  return { ok: `صدر الإشعار الدائن ${res.number}` };
}

/** إعادة الإبلاغ عن سجل فشل إبلاغه للهيئة. */
export async function actionRetryZatca(recordId: string): Promise<State> {
  await requireAdmin();
  const res = await retryReport(recordId);
  revalidatePath('/admin/finance/zatca');
  return res.ok ? { ok: `الحالة: ${res.status}` } : { error: res.error || 'تعذّرت إعادة الإبلاغ' };
}
