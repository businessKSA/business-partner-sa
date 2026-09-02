'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { postInvoice, cancelInvoice } from '@/lib/sales/invoices.ts';
import { submitInvoice } from '@/lib/zatca/service.ts';
import { DomainError } from '@/lib/errors.ts';
import type { ActionResult } from './accounting.ts';

function fail(e: unknown): ActionResult {
  if (e instanceof DomainError) return { ok: false, error: e.message };
  if (e instanceof Error) return { ok: false, error: e.message };
  return { ok: false, error: 'حدث خطأ غير متوقّع.' };
}

export async function postSalesInvoice(
  _prev: ActionResult | null, formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireAuth('sales.invoice.post');
    const invoiceId = String(formData.get('invoiceId'));
    await withTenant(session.tenantId, (tx) =>
      postInvoice(tx, session.tenantId, invoiceId, session.email),
    );
    revalidatePath(`/sales/invoices/${invoiceId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelSalesInvoice(
  _prev: ActionResult | null, formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireAuth('sales.invoice.cancel');
    const invoiceId = String(formData.get('invoiceId'));
    const reason = String(formData.get('reason') ?? '').trim() || undefined;
    await withTenant(session.tenantId, (tx) =>
      cancelInvoice(tx, session.tenantId, invoiceId, { reason, actor: session.email }),
    );
    revalidatePath(`/sales/invoices/${invoiceId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/**
 * الإرسال للهيئة.
 *
 * المهلة أطول من الافتراضي: البناء والتوقيع ونداء الهيئة داخل معاملةٍ
 * واحدة، وقطعُها في منتصفها يترك عدّاد السلسلة محجوزاً بلا فاتورة.
 */
export async function submitToZatca(
  _prev: ActionResult | null, formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireAuth('sales.zatca.submit');
    const invoiceId = String(formData.get('invoiceId'));

    const { result } = await withTenant(
      session.tenantId,
      (tx) => submitInvoice(tx, session.tenantId, invoiceId),
      { timeout: 60_000 },
    );

    revalidatePath(`/sales/invoices/${invoiceId}`);
    return result.ok ? { ok: true } : { ok: false, error: result.message };
  } catch (e) {
    return fail(e);
  }
}
