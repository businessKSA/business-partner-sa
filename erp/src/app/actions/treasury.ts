'use server';

/**
 * إجراءات الإقفال السنوي وأسعار الصرف والتسوية البنكية.
 *
 * كلها تبدأ بـ`requireAuth` للسبب نفسه المشروح في `assets.ts`: كل تصدير
 * هنا نقطةُ استدعاءٍ عبر الشبكة، فالحارس في السطر الأول لا في الشاشة.
 */
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { DomainError } from '@/lib/errors.ts';
import { closeFiscalYear, reverseClosing } from '@/lib/accounting/closing.ts';
import { setRate, postRevaluation } from '@/lib/accounting/fx.ts';
import {
  importStatement, parseCsv, autoMatch, matchLine, unmatchLine,
  createAdjustment, finalizeReconciliation,
} from '@/lib/treasury/reconciliation.ts';

export type ActionResult = { ok: true; id?: string; note?: string } | { ok: false; error: string };

function fail(e: unknown): ActionResult {
  if (e instanceof DomainError) return { ok: false, error: e.message };
  if (e instanceof Error) return { ok: false, error: e.message };
  return { ok: false, error: 'حدث خطأ غير متوقّع.' };
}

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

// ── الإقفال السنوي ───────────────────────────────────────────────────────

export async function closeYear(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireAuth('accounting.closing.run');

    const result = await withTenant(
      session.tenantId,
      (tx) =>
        closeFiscalYear(tx, session.tenantId, str(formData, 'fiscalYearId'), {
          note: str(formData, 'note') || undefined,
          lockPeriods: formData.get('lockPeriods') === 'on',
          actor: session.email,
        }),
      // الإقفال يمسّ كل حساب مؤقّت في السنة؛ المهلة الافتراضية قد لا تكفي.
      { timeout: 120_000 },
    );

    revalidatePath('/accounting/closing');
    revalidatePath('/accounting/periods');
    return {
      ok: true,
      id: result.closing.id,
      note: `رُحّل قيد الإقفال ${result.entry.number}؛ صافي السنة ${result.netProfit.toFixed(2)}.`,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function undoClosing(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireAuth('accounting.closing.reverse');

    await withTenant(
      session.tenantId,
      (tx) =>
        reverseClosing(tx, session.tenantId, str(formData, 'fiscalYearId'), {
          reason: str(formData, 'reason') || undefined,
          actor: session.email,
        }),
      { timeout: 120_000 },
    );

    revalidatePath('/accounting/closing');
    revalidatePath('/accounting/periods');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ── العملات ──────────────────────────────────────────────────────────────

export async function saveExchangeRate(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireAuth('accounting.fx.write');

    await withTenant(session.tenantId, (tx) =>
      setRate(
        tx, session.tenantId,
        str(formData, 'currency').toUpperCase(),
        new Date(str(formData, 'date')),
        str(formData, 'rate'),
      ),
    );

    revalidatePath('/accounting/fx');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function revalueCurrencies(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireAuth('accounting.fx.revalue');

    const result = await withTenant(session.tenantId, (tx) =>
      postRevaluation(tx, session.tenantId, new Date(str(formData, 'valuationDate')), {
        // العكس التلقائي هو الافتراض: الفرق غير محقَّق، وإبقاؤه يجعل الرصيد
        // بعد أشهرٍ مجموعَ تقديرات. من يُلغيه يفعل ذلك عن قصد.
        //
        // والقراءة بـ`getAll` لا بـ`get` مقصودة: مربّعُ الاختيار غيرُ المؤشَّر
        // لا يُرسَل أصلاً، فلا يُفرَّق بغيابه بين «أُلغي العكس» و«لم يُذكر».
        // فيسبقه حقلٌ مخفيّ بقيمة `off`، ووجودُ `on` بعده هو الإثبات.
        autoReverse: formData.getAll('autoReverse').includes('on'),
        actor: session.email,
      }),
    );

    revalidatePath('/accounting/fx');
    return { ok: true, id: result.id };
  } catch (e) {
    return fail(e);
  }
}

// ── التسوية البنكية ──────────────────────────────────────────────────────

export async function importBankStatement(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireAuth('treasury.statement.import');

    const csv = str(formData, 'csv');
    if (!csv) return { ok: false, error: 'الصق محتوى الكشف أو ارفع ملفه.' };

    const lines = parseCsv(csv);

    const statement = await withTenant(session.tenantId, (tx) =>
      importStatement(tx, session.tenantId, {
        bankAccountId: str(formData, 'bankAccountId'),
        reference: str(formData, 'reference') || null,
        fromDate: new Date(str(formData, 'fromDate')),
        toDate: new Date(str(formData, 'toDate')),
        openingBalance: str(formData, 'openingBalance') || '0',
        closingBalance: str(formData, 'closingBalance') || '0',
        lines,
        createdBy: session.email,
      }),
    );

    revalidatePath('/treasury/reconciliation');
    return { ok: true, id: statement.id, note: `استُورد ${lines.length} سطراً.` };
  } catch (e) {
    return fail(e);
  }
}

export async function autoMatchStatement(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireAuth('treasury.statement.match');
    const statementId = str(formData, 'statementId');

    const res = await withTenant(session.tenantId, (tx) =>
      autoMatch(tx, session.tenantId, statementId, session.email),
    );

    revalidatePath(`/treasury/reconciliation/${statementId}`);
    return {
      ok: true,
      note: `طوبق ${res.matched} من ${res.total}. الباقي معلَّقٌ عمداً: إمّا لم يبلغ عتبة الثقة، وإمّا تعادل فيه مرشّحان.`,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function matchStatementLine(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireAuth('treasury.statement.match');
    const statementId = str(formData, 'statementId');

    await withTenant(session.tenantId, (tx) =>
      matchLine(
        tx, session.tenantId,
        str(formData, 'lineId'),
        str(formData, 'journalLineId'),
        session.email,
      ),
    );

    revalidatePath(`/treasury/reconciliation/${statementId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function unmatchStatementLine(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireAuth('treasury.statement.match');
    const statementId = str(formData, 'statementId');

    await withTenant(session.tenantId, (tx) =>
      unmatchLine(tx, session.tenantId, str(formData, 'lineId')),
    );

    revalidatePath(`/treasury/reconciliation/${statementId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function adjustStatementLine(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireAuth('treasury.statement.match');
    const statementId = str(formData, 'statementId');

    const entry = await withTenant(session.tenantId, (tx) =>
      createAdjustment(tx, session.tenantId, str(formData, 'lineId'), {
        counterAccountId: str(formData, 'counterAccountId'),
        descAr: str(formData, 'descAr') || undefined,
        actor: session.email,
      }),
    );

    revalidatePath(`/treasury/reconciliation/${statementId}`);
    return { ok: true, id: entry.id, note: `رُحّل القيد ${entry.number} وطوبق السطر به.` };
  } catch (e) {
    return fail(e);
  }
}

export async function finalizeStatement(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireAuth('treasury.statement.finalize');
    const statementId = str(formData, 'statementId');

    await withTenant(session.tenantId, (tx) =>
      finalizeReconciliation(tx, session.tenantId, statementId, session.email),
    );

    revalidatePath(`/treasury/reconciliation/${statementId}`);
    revalidatePath('/treasury/reconciliation');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
