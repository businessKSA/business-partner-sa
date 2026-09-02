/**
 * عميل قاعدة البيانات وسياق المنشأة.
 *
 * القاعدة الوحيدة في هذا الملف: لا يُقرأ ولا يُكتب صفٌّ يخصّ منشأة إلا من
 * داخل `withTenant`. هي التي تضبط `app.tenant_id` داخل معاملة، وسياسات RLS
 * (scripts/apply-rls.ts) تفعل الباقي. استعلامٌ نُسي فيه شرط المنشأة لا يعود
 * تسريباً — يعود صفراً من الصفوف.
 *
 * `withoutTenant` تفتح الباب على مصراعيه ولذلك استعمالها محصور في:
 * البذور، وإنشاء منشأة جديدة، ولوحة المنصة. أي استدعاء رابع يجب أن يُسأل
 * عنه في المراجعة.
 */
import { PrismaClient, Prisma } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/** العميل داخل معاملة — نفس واجهة Prisma بلا أوامر المعاملات المتداخلة. */
export type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

export type TenantOptions = {
  /** مهلة المعاملة بالمللي ثانية. الترحيلات الكبيرة (مسيّر رواتب) تحتاج أطول. */
  timeout?: number;
  maxWait?: number;
  /** مستوى العزل. الترحيل المحاسبي يستخدم Serializable لمنع تعارض العدّادات. */
  isolationLevel?: Prisma.TransactionIsolationLevel;
};

/**
 * ينفّذ العمل في سياق منشأة واحدة. كل استعلام داخل `fn` محكوم بـ RLS.
 *
 * @param tenantId معرّف المنشأة — يُؤخذ من الجلسة لا من مدخلات المستخدم.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: Tx) => Promise<T>,
  opts: TenantOptions = {},
): Promise<T> {
  if (!tenantId) throw new Error('withTenant: معرّف المنشأة مطلوب');

  return prisma.$transaction(
    async (tx) => {
      // `true` = محلي للمعاملة، فلا يتسرّب الإعداد إلى الاتصال التالي في المجمّع.
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return fn(tx as Tx);
    },
    {
      timeout: opts.timeout ?? 15_000,
      maxWait: opts.maxWait ?? 5_000,
      isolationLevel: opts.isolationLevel,
    },
  );
}

/**
 * يتخطّى عزل المنشآت. للبذور وإنشاء المنشأة ولوحة المنصة فقط.
 *
 * كل استدعاء هنا يجب أن يكون مبرّراً بسطر تعليق يقول لماذا لا يمكن أن يعرف
 * منشأته سلفاً.
 */
export async function withoutTenant<T>(
  reason: string,
  fn: (tx: Tx) => Promise<T>,
  opts: TenantOptions = {},
): Promise<T> {
  if (!reason) throw new Error('withoutTenant: السبب مطلوب — يُكتب في السجل');
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      return fn(tx as Tx);
    },
    { timeout: opts.timeout ?? 30_000, maxWait: opts.maxWait ?? 5_000 },
  );
}

/** يقرأ المنشأة النشطة داخل معاملة — للتحقق في الاختبارات. */
export async function currentTenant(tx: Tx): Promise<string | null> {
  const r = await tx.$queryRaw<{ v: string | null }[]>`
    SELECT current_setting('app.tenant_id', true) AS v
  `;
  return r[0]?.v ?? null;
}
