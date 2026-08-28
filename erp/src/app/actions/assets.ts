'use server';

/**
 * إجراءات الأصول الثابتة والإقفال والعملات والتسوية البنكية.
 *
 * كلها تبدأ بـ`requireAuth`: الصلاحية تُفحص هنا لا في الواجهة. إخفاءُ زرٍّ
 * في الشاشة لا يمنع أحداً من استدعاء الإجراء مباشرةً — وكل تصدير في ملفٍ
 * عليه `'use server'` يصير نقطةَ استدعاءٍ عبر الشبكة. ولهذا لا يُصدَّر من
 * هنا إلا ما يُقصد أن يُستدعى، ولا تُصدَّر منه دوالُّ مساعدة أو حرّاس.
 */
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth.ts';
import { withTenant } from '@/lib/db.ts';
import { DomainError } from '@/lib/errors.ts';
import {
  createAsset, generateDepreciationRun, postDepreciationRun,
  cancelDepreciationRun, disposeAsset, type Method,
} from '@/lib/assets/depreciation.ts';

export type ActionResult = { ok: true; id?: string; note?: string } | { ok: false; error: string };

function fail(e: unknown): ActionResult {
  if (e instanceof DomainError) return { ok: false, error: e.message };
  if (e instanceof Error) return { ok: false, error: e.message };
  return { ok: false, error: 'حدث خطأ غير متوقّع.' };
}

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

export async function addAsset(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireAuth('assets.asset.write');

    const purchaseDate = new Date(str(formData, 'purchaseDate'));
    const inServiceRaw = str(formData, 'inServiceDate');

    const asset = await withTenant(session.tenantId, (tx) =>
      createAsset(tx, session.tenantId, {
        code: str(formData, 'code') || undefined,
        nameAr: str(formData, 'nameAr'),
        categoryAr: str(formData, 'categoryAr') || null,
        serialNumber: str(formData, 'serialNumber') || null,
        location: str(formData, 'location') || null,
        purchaseDate,
        inServiceDate: inServiceRaw ? new Date(inServiceRaw) : purchaseDate,
        cost: str(formData, 'cost'),
        salvageValue: str(formData, 'salvageValue') || '0',
        usefulLifeMonths: Number(str(formData, 'usefulLifeMonths')),
        method: (str(formData, 'method') || 'STRAIGHT_LINE') as Method,
        decliningFactor: str(formData, 'decliningFactor') || undefined,
        totalUnits: str(formData, 'totalUnits') || null,
        createdBy: session.email,
      }),
    );

    revalidatePath('/assets');
    return { ok: true, id: asset.id };
  } catch (e) {
    return fail(e);
  }
}

export async function runDepreciation(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireAuth('assets.depreciation.run');
    const year = Number(str(formData, 'year'));
    const month = Number(str(formData, 'month'));

    const run = await withTenant(session.tenantId, (tx) =>
      generateDepreciationRun(tx, session.tenantId, year, month, { createdBy: session.email }),
    );

    revalidatePath('/assets/depreciation');
    return {
      ok: true,
      id: run.id,
      note: `وُلّد المسيّر ${run.number} لـ${run.assetCount} أصلاً — راجِعه قبل الترحيل.`,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function postDepreciation(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireAuth('assets.depreciation.post');
    const runId = str(formData, 'runId');

    await withTenant(session.tenantId, (tx) =>
      postDepreciationRun(tx, session.tenantId, runId, session.email),
    );

    revalidatePath('/assets/depreciation');
    revalidatePath('/assets');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelDepreciation(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireAuth('assets.depreciation.post');
    const runId = str(formData, 'runId');

    await withTenant(session.tenantId, (tx) =>
      cancelDepreciationRun(tx, session.tenantId, runId, {
        reason: str(formData, 'reason') || undefined,
        actor: session.email,
      }),
    );

    revalidatePath('/assets/depreciation');
    revalidatePath('/assets');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function disposeFixedAsset(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireAuth('assets.asset.dispose');

    await withTenant(session.tenantId, (tx) =>
      disposeAsset(tx, session.tenantId, str(formData, 'assetId'), {
        disposalDate: new Date(str(formData, 'disposalDate')),
        proceeds: str(formData, 'proceeds') || '0',
        proceedsAccountId: str(formData, 'proceedsAccountId') || null,
        note: str(formData, 'note') || undefined,
        actor: session.email,
      }),
    );

    revalidatePath('/assets');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
