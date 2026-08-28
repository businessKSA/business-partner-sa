'use server';

/**
 * إجراءات الخادم للمحاسبة.
 *
 * كلها تبدأ بـ`requireAuth`: الصلاحية تُفحص هنا لا في الواجهة. إخفاءُ زرٍّ
 * في الشاشة لا يمنع أحداً من استدعاء الإجراء مباشرةً، والحارس الحقيقي هو
 * هذا السطر.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { postEntry, reverseEntry } from '@/lib/accounting/posting.ts';
import { closePeriod, reopenPeriod, createFiscalYear } from '@/lib/accounting/periods.ts';
import { DomainError } from '@/lib/errors.ts';

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function fail(e: unknown): ActionResult {
  if (e instanceof DomainError) return { ok: false, error: e.message };
  if (e instanceof Error) return { ok: false, error: e.message };
  return { ok: false, error: 'حدث خطأ غير متوقّع.' };
}

export async function createJournalEntry(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  let entryId: string;
  try {
    const session = await requireAuth('accounting.journal.post');

    const date = new Date(String(formData.get('date')));
    const memoAr = String(formData.get('memoAr') ?? '').trim() || undefined;
    const ref = String(formData.get('ref') ?? '').trim() || undefined;

    // السطور تصل مرقّمة: accountId-0، debit-0، credit-0 ...
    const lines: { accountId: string; debit?: string; credit?: string; descAr?: string; costCenterId?: string | null }[] = [];
    for (let i = 0; i < 40; i++) {
      const accountId = String(formData.get(`accountId-${i}`) ?? '').trim();
      if (!accountId) continue;
      const debit = String(formData.get(`debit-${i}`) ?? '').trim();
      const credit = String(formData.get(`credit-${i}`) ?? '').trim();
      if (!debit && !credit) continue;
      lines.push({
        accountId,
        debit: debit || '0',
        credit: credit || '0',
        descAr: String(formData.get(`descAr-${i}`) ?? '').trim() || undefined,
        costCenterId: String(formData.get(`costCenterId-${i}`) ?? '').trim() || null,
      });
    }

    const entry = await withTenant(session.tenantId, (tx) =>
      postEntry(tx, session.tenantId, {
        date, memoAr, ref, lines, createdBy: session.email,
      }),
    );
    entryId = entry.id;
  } catch (e) {
    return fail(e);
  }

  revalidatePath('/accounting/journal');
  redirect(`/accounting/journal/${entryId}`);
}

export async function reverseJournalEntry(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireAuth('accounting.journal.reverse');
    const entryId = String(formData.get('entryId'));
    const dateRaw = String(formData.get('date') ?? '');
    const memoAr = String(formData.get('memoAr') ?? '').trim() || undefined;

    await withTenant(session.tenantId, (tx) =>
      reverseEntry(tx, session.tenantId, entryId, {
        date: dateRaw ? new Date(dateRaw) : new Date(),
        memoAr,
        actor: session.email,
      }),
    );
  } catch (e) {
    return fail(e);
  }

  revalidatePath('/accounting/journal');
  return { ok: true };
}

export async function togglePeriod(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireAuth('accounting.period.close');
    const periodId = String(formData.get('periodId'));
    const action = String(formData.get('action'));

    await withTenant(session.tenantId, (tx) =>
      action === 'close'
        ? closePeriod(tx, session.tenantId, periodId, session.email)
        : reopenPeriod(tx, session.tenantId, periodId),
    );
  } catch (e) {
    return fail(e);
  }

  revalidatePath('/accounting/periods');
  return { ok: true };
}

export async function addFiscalYear(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireAuth('accounting.period.close');
    const year = Number(formData.get('year'));
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return { ok: false, error: 'سنة غير صالحة.' };
    }
    await withTenant(session.tenantId, async (tx) => {
      const tenant = await tx.tenant.findFirstOrThrow({ where: { id: session.tenantId } });
      return createFiscalYear(tx, session.tenantId, year, tenant.fiscalYearStartMonth);
    });
  } catch (e) {
    return fail(e);
  }

  revalidatePath('/accounting/periods');
  return { ok: true };
}
