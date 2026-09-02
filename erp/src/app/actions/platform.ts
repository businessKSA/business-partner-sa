'use server';

/**
 * إجراءات لوحة المنصة — إنشاء منشآت العملاء وإدارة اشتراكاتهم.
 *
 * كلها محصورة بـ`requirePlatformAdmin`: مالك المنشأة يدير منشأته، ومالك
 * المنصة يدير المنشآت. الخلط بين الدورين يعني أن عميلاً يستطيع إنشاء
 * منشآت أو رؤية عملاء آخرين.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requirePlatformAdmin } from '@/lib/platform.ts';
import { withoutTenant } from '@/lib/db.ts';
import { provisionTenant, purgeTenant } from '@/lib/provisioning.ts';
import { hashPassword } from '@/lib/auth.ts';
import { DomainError } from '@/lib/errors.ts';
import type { ActionResult } from './accounting.ts';

function fail(e: unknown): ActionResult {
  if (e instanceof DomainError) return { ok: false, error: e.message };
  if (e instanceof Error) return { ok: false, error: e.message };
  return { ok: false, error: 'حدث خطأ غير متوقّع.' };
}

/**
 * إنشاء منشأة عميل جديدة.
 *
 * تُسلَّم جاهزةً للعمل: شجرة حسابات كاملة، وسنة مالية بفتراتها، ورموز
 * ضريبية، وأدوار، ومستودع، وحساب صندوق، ومستخدم مالك بكلمة مرور مؤقتة.
 * منشأةٌ تُسلَّم بلا هذا تعني عميلاً يفتح النظام فلا يجد ما يفعله.
 */
export async function createTenant(
  _prev: ActionResult | null, formData: FormData,
): Promise<ActionResult> {
  let slug: string;
  try {
    await requirePlatformAdmin();

    slug = String(formData.get('slug') ?? '').trim().toLowerCase();
    const nameAr = String(formData.get('nameAr') ?? '').trim();
    const ownerEmail = String(formData.get('ownerEmail') ?? '').trim().toLowerCase();
    const ownerName = String(formData.get('ownerName') ?? '').trim();
    const password = String(formData.get('password') ?? '');

    if (!/^[a-z0-9-]{3,40}$/.test(slug)) {
      return { ok: false, error: 'المعرّف يقبل الحروف اللاتينية الصغيرة والأرقام والشرطة فقط (٣–٤٠ محرفاً).' };
    }
    if (!nameAr) return { ok: false, error: 'اسم المنشأة مطلوب.' };
    if (!ownerEmail) return { ok: false, error: 'بريد المالك مطلوب.' };
    if (password.length < 8) return { ok: false, error: 'كلمة المرور ثمانية محارف على الأقل.' };

    const exists = await withoutTenant('التحقق من تفرّد معرّف المنشأة', (tx) =>
      tx.tenant.findUnique({ where: { slug }, select: { id: true } }),
    );
    if (exists) return { ok: false, error: `المعرّف «${slug}» مستعمل.` };

    const passwordHash = await hashPassword(password);
    const owner = await withoutTenant('إنشاء مستخدم مالك المنشأة الجديدة', (tx) =>
      tx.user.upsert({
        where: { email: ownerEmail },
        create: { email: ownerEmail, name: ownerName || ownerEmail, passwordHash },
        update: {},
      }),
    );

    await provisionTenant(
      {
        slug, nameAr,
        nameEn: String(formData.get('nameEn') ?? '').trim() || undefined,
        crNumber: String(formData.get('crNumber') ?? '').trim() || undefined,
        vatNumber: String(formData.get('vatNumber') ?? '').trim() || undefined,
        city: String(formData.get('city') ?? '').trim() || undefined,
        email: String(formData.get('email') ?? '').trim() || undefined,
        phone: String(formData.get('phone') ?? '').trim() || undefined,
      },
      owner.id,
    );
  } catch (e) {
    return fail(e);
  }

  revalidatePath('/platform/tenants');
  redirect(`/platform/tenants?created=${slug}`);
}

export async function setTenantStatus(
  _prev: ActionResult | null, formData: FormData,
): Promise<ActionResult> {
  try {
    await requirePlatformAdmin();
    const tenantId = String(formData.get('tenantId'));
    const status = String(formData.get('status'));

    if (!['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED'].includes(status)) {
      return { ok: false, error: 'حالة غير معروفة.' };
    }

    await withoutTenant(`تغيير حالة اشتراك المنشأة ${tenantId}`, (tx) =>
      tx.tenant.update({ where: { id: tenantId }, data: { status } }),
    );
  } catch (e) {
    return fail(e);
  }

  revalidatePath('/platform/tenants');
  return { ok: true };
}

/**
 * حذف منشأة وكل بياناتها.
 *
 * يشترط كتابة معرّف المنشأة حرفياً: عمليةٌ لا رجعة فيها، وزرٌّ وحده لا
 * يكفي حاجزاً أمامها.
 */
export async function deleteTenant(
  _prev: ActionResult | null, formData: FormData,
): Promise<ActionResult> {
  try {
    await requirePlatformAdmin();
    const tenantId = String(formData.get('tenantId'));
    const typed = String(formData.get('confirmSlug') ?? '').trim();

    const tenant = await withoutTenant('قراءة المنشأة قبل حذفها', (tx) =>
      tx.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } }),
    );
    if (!tenant) return { ok: false, error: 'المنشأة غير موجودة.' };
    if (typed !== tenant.slug) {
      return { ok: false, error: `اكتب «${tenant.slug}» حرفياً للتأكيد.` };
    }

    await purgeTenant(tenantId);
  } catch (e) {
    return fail(e);
  }

  revalidatePath('/platform/tenants');
  return { ok: true };
}
