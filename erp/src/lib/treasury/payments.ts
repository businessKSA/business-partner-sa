/**
 * سندات القبض والصرف وتخصيصها على الفواتير.
 *
 * الفصل بين الدفعة وتخصيصها مقصود: الدفعة الواحدة قد تُسدَّد على عدّة
 * فواتير، والفاتورة الواحدة قد تُسدَّد على دفعات. ربطُ الدفعة بفاتورةٍ
 * واحدة في عمود يجبر المحاسب على تقسيم الحوالة الواحدة إلى سنداتٍ وهمية،
 * فيختلّ التطابق مع كشف البنك.
 *
 * وما لم يُخصَّص من الدفعة ليس خطأً: هو دفعةٌ مقدمة، وله في الدفتر حسابه
 * (`CUSTOMER_ADVANCE`) لأنه التزامٌ على المنشأة حتى تُقدَّم الخدمة — لا
 * إيراد.
 */
import type { Tx } from '../db.ts';
import { d, money, sum, type Num } from '../money.ts';
import { DomainError, ValidationError } from '../errors.ts';
import { postEntry, reverseEntry, accountByRole } from '../accounting/posting.ts';
import { nextNumber } from '../accounting/numbering.ts';

export type AllocationInput = {
  salesInvoiceId?: string | null;
  vendorBillId?: string | null;
  amount: Num;
};

export type PaymentInput = {
  /** IN قبض من عميل | OUT صرف لمورّد */
  direction: 'IN' | 'OUT';
  partnerId?: string | null;
  paymentDate: Date;
  amount: Num;
  currency?: string;
  bankAccountId: string;
  method?: string;
  ref?: string | null;
  notesAr?: string | null;
  allocations?: AllocationInput[];
  createdBy?: string;
};

export async function createPayment(tx: Tx, tenantId: string, input: PaymentInput) {
  const amount = money(input.amount);
  if (!amount.greaterThan(0)) {
    throw new ValidationError('مبلغ السند يجب أن يكون أكبر من صفر.');
  }

  const bank = await tx.bankAccount.findFirst({ where: { id: input.bankAccountId, tenantId } });
  if (!bank) throw new DomainError('الحساب البنكي غير موجود', 'NOT_FOUND');

  const allocations = input.allocations ?? [];
  const allocated = money(sum(allocations.map((a) => a.amount)));

  if (allocated.greaterThan(amount)) {
    throw new ValidationError(
      `المخصَّص ${allocated.toFixed(2)} أكبر من مبلغ السند ${amount.toFixed(2)}.`,
    );
  }

  // التحقّق من كل تخصيص: الفاتورة موجودة، مرحَّلة، والمبلغ لا يتجاوز المتبقّي
  for (const a of allocations) {
    const amt = money(a.amount);
    if (!amt.greaterThan(0)) throw new ValidationError('مبلغ التخصيص يجب أن يكون موجباً.');

    if (a.salesInvoiceId) {
      const inv = await tx.salesInvoice.findFirst({ where: { id: a.salesInvoiceId, tenantId } });
      if (!inv) throw new DomainError('الفاتورة غير موجودة', 'NOT_FOUND');
      if (inv.status === 'DRAFT') {
        throw new ValidationError(`الفاتورة ${inv.number} مسوّدة — تُرحَّل قبل السداد عليها.`);
      }
      if (inv.status === 'CANCELLED') {
        throw new ValidationError(`الفاتورة ${inv.number} ملغاة.`);
      }
      const remaining = money(d(inv.total).minus(d(inv.paidAmount)));
      if (amt.greaterThan(remaining)) {
        throw new ValidationError(
          `المخصَّص للفاتورة ${inv.number} (${amt.toFixed(2)}) أكبر من المتبقّي عليها (${remaining.toFixed(2)}).`,
        );
      }
    } else if (a.vendorBillId) {
      const bill = await tx.vendorBill.findFirst({ where: { id: a.vendorBillId, tenantId } });
      if (!bill) throw new DomainError('فاتورة المورّد غير موجودة', 'NOT_FOUND');
      if (bill.status === 'DRAFT') {
        throw new ValidationError(`فاتورة المورّد ${bill.number} مسوّدة — تُرحَّل قبل الصرف عليها.`);
      }
      const remaining = money(d(bill.total).minus(d(bill.paidAmount)));
      if (amt.greaterThan(remaining)) {
        throw new ValidationError(
          `المخصَّص لفاتورة المورّد ${bill.number} أكبر من المتبقّي عليها (${remaining.toFixed(2)}).`,
        );
      }
    } else {
      throw new ValidationError('التخصيص بلا فاتورة ولا فاتورة مورّد.');
    }
  }

  const number = await nextNumber(
    tx, tenantId,
    input.direction === 'IN' ? 'PAYMENT_IN' : 'PAYMENT_OUT',
    input.paymentDate,
  );

  return tx.payment.create({
    data: {
      tenantId, number,
      direction: input.direction,
      partnerId: input.partnerId ?? null,
      paymentDate: input.paymentDate,
      amount: amount.toFixed(6),
      currency: input.currency ?? bank.currency,
      bankAccountId: input.bankAccountId,
      method: input.method ?? 'TRANSFER',
      ref: input.ref ?? null,
      notesAr: input.notesAr ?? null,
      unallocated: money(amount.minus(allocated)).toFixed(6),
      createdBy: input.createdBy ?? null,
      allocations: {
        create: allocations.map((a) => ({
          tenantId,
          salesInvoiceId: a.salesInvoiceId ?? null,
          vendorBillId: a.vendorBillId ?? null,
          amount: money(a.amount).toFixed(6),
        })),
      },
    },
    include: { allocations: true },
  });
}

/**
 * يرحّل السند ويحدّث المسدَّد على فواتيره.
 *
 * قيد القبض:
 *   من ح/ البنك              بالمبلغ
 *     إلى ح/ الذمم المدينة    بالمخصَّص
 *     إلى ح/ دفعات مقدمة      بغير المخصَّص
 *
 * وقيد الصرف يقلبه على الذمم الدائنة.
 */
export async function postPayment(tx: Tx, tenantId: string, paymentId: string, actor?: string) {
  const payment = await tx.payment.findFirst({
    where: { id: paymentId, tenantId },
    include: { allocations: true, bankAccount: true, partner: true },
  });
  if (!payment) throw new DomainError('السند غير موجود', 'NOT_FOUND');
  if (payment.status !== 'DRAFT') {
    throw new DomainError(`السند ${payment.number} حالته «${payment.status}».`, 'NOT_DRAFT');
  }

  const isIn = payment.direction === 'IN';
  const amount = money(payment.amount);
  const allocated = money(sum(payment.allocations.map((a) => a.amount)));
  const unallocated = money(amount.minus(allocated));

  const partyAccount = isIn
    ? await accountByRole(tx, tenantId, 'RECEIVABLE')
    : await accountByRole(tx, tenantId, 'PAYABLE');

  const lines: Record<string, unknown>[] = [];

  // طرف الخزينة
  lines.push({
    accountId: payment.bankAccount.accountId,
    [isIn ? 'debit' : 'credit']: amount,
    descAr: `${isIn ? 'قبض' : 'صرف'} ${payment.number} — ${payment.bankAccount.nameAr}`,
    partnerId: payment.partnerId,
  });

  // طرف الذمم بالمخصَّص
  if (allocated.greaterThan(0)) {
    lines.push({
      accountId: partyAccount.id,
      [isIn ? 'credit' : 'debit']: allocated,
      descAr: `تسوية ذمم — ${payment.partner?.nameAr ?? payment.number}`,
      partnerId: payment.partnerId,
    });
  }

  // غير المخصَّص: دفعة مقدمة — التزام لا إيراد
  if (unallocated.greaterThan(0)) {
    const advance = await accountByRole(
      tx, tenantId,
      isIn ? 'CUSTOMER_ADVANCE' : 'PREPAID',
    );
    lines.push({
      accountId: advance.id,
      [isIn ? 'credit' : 'debit']: unallocated,
      descAr: `${isIn ? 'دفعة مقدمة من' : 'دفعة مقدمة إلى'} ${payment.partner?.nameAr ?? 'طرف غير محدَّد'}`,
      partnerId: payment.partnerId,
    });
  }

  const entry = await postEntry(tx, tenantId, {
    date: payment.paymentDate,
    memoAr: `سند ${isIn ? 'قبض' : 'صرف'} ${payment.number}`,
    ref: payment.ref ?? payment.number,
    sourceType: 'PAYMENT',
    sourceId: payment.id,
    currency: payment.currency,
    createdBy: actor,
    lines: lines as never,
  });

  // تحديث المسدَّد على كل فاتورة، وحالتها تبعاً له
  for (const a of payment.allocations) {
    if (a.salesInvoiceId) {
      const inv = await tx.salesInvoice.findFirstOrThrow({ where: { id: a.salesInvoiceId, tenantId } });
      const paid = money(d(inv.paidAmount).plus(d(a.amount)));
      await tx.salesInvoice.update({
        where: { id: inv.id },
        data: {
          paidAmount: paid.toFixed(6),
          status: paid.greaterThanOrEqualTo(money(inv.total)) ? 'PAID' : 'PARTIALLY_PAID',
        },
      });
    }
    if (a.vendorBillId) {
      const bill = await tx.vendorBill.findFirstOrThrow({ where: { id: a.vendorBillId, tenantId } });
      const paid = money(d(bill.paidAmount).plus(d(a.amount)));
      await tx.vendorBill.update({
        where: { id: bill.id },
        data: {
          paidAmount: paid.toFixed(6),
          status: paid.greaterThanOrEqualTo(money(bill.total)) ? 'PAID' : 'PARTIALLY_PAID',
        },
      });
    }
  }

  return tx.payment.update({
    where: { id: payment.id },
    data: {
      status: 'POSTED',
      journalEntryId: entry.id,
      unallocated: unallocated.toFixed(6),
      postedAt: new Date(),
    },
    include: { allocations: true },
  });
}

/** يلغي سنداً مرحَّلاً: يعكس قيده ويردّ المسدَّد على فواتيره. */
export async function cancelPayment(
  tx: Tx,
  tenantId: string,
  paymentId: string,
  opts: { date?: Date; reason?: string; actor?: string } = {},
) {
  const payment = await tx.payment.findFirst({
    where: { id: paymentId, tenantId },
    include: { allocations: true },
  });
  if (!payment) throw new DomainError('السند غير موجود', 'NOT_FOUND');
  if (payment.status === 'CANCELLED') throw new DomainError('السند ملغى سلفاً.', 'ALREADY_CANCELLED');

  if (payment.journalEntryId) {
    await reverseEntry(tx, tenantId, payment.journalEntryId, {
      date: opts.date ?? new Date(),
      memoAr: `إلغاء السند ${payment.number}${opts.reason ? ` — ${opts.reason}` : ''}`,
      actor: opts.actor,
    });
  }

  // ردّ المسدَّد — وإلا بقيت الفاتورة «مدفوعة» بسندٍ ملغى
  for (const a of payment.allocations) {
    if (a.salesInvoiceId) {
      const inv = await tx.salesInvoice.findFirstOrThrow({ where: { id: a.salesInvoiceId, tenantId } });
      const paid = money(d(inv.paidAmount).minus(d(a.amount)));
      await tx.salesInvoice.update({
        where: { id: inv.id },
        data: {
          paidAmount: paid.toFixed(6),
          status: paid.isZero() ? 'POSTED' : 'PARTIALLY_PAID',
        },
      });
    }
    if (a.vendorBillId) {
      const bill = await tx.vendorBill.findFirstOrThrow({ where: { id: a.vendorBillId, tenantId } });
      const paid = money(d(bill.paidAmount).minus(d(a.amount)));
      await tx.vendorBill.update({
        where: { id: bill.id },
        data: {
          paidAmount: paid.toFixed(6),
          status: paid.isZero() ? 'POSTED' : 'PARTIALLY_PAID',
        },
      });
    }
  }

  return tx.payment.update({ where: { id: payment.id }, data: { status: 'CANCELLED' } });
}
