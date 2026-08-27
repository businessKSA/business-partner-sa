/**
 * عزل المنشآت على مستوى قاعدة البيانات (Row-Level Security).
 *
 * الترشيح في الكود وحده لا يكفي حين تبيع النظام: استعلام واحد يُنسى فيه
 * `where tenantId` يكشف دفاتر عميل لعميل آخر. هنا نُنزِل الحارس إلى
 * Postgres نفسه — كل جدول يحمل `tenantId` يُفعَّل عليه RLS بسياسة تقارن
 * العمود بمتغيّر الجلسة `app.tenant_id`، ويُفرض حتى على مالك الجدول
 * (FORCE) لأن Prisma يتصل بالمالك.
 *
 * المتغيّر غير المضبوط يعني NULL يعني «لا صفوف» — فالإغفال يُغلق الباب
 * لا يفتحه.
 *
 * منفذ واحد للتجاوز: `app.bypass_rls = 'on'`، تضبطه دوالّ محدودة موثّقة
 * في src/lib/db.ts (البذور، ترحيل المنصة، لوحة المنصة) ولا شيء غيرها.
 *
 * السكربت يقرأ الجداول من information_schema لا من قائمة يدوية، فأي جدول
 * جديد يحمل `tenantId` يُحمى في أول تشغيل بعد إضافته.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** جداول لا تخضع لعزل المنشأة رغم حملها العمود، ولكلٍّ سببه. */
const EXCLUDED = new Set<string>([
  // الجلسة تُقرأ بالتوكن قبل أن تُعرف المنشأة، و`tenantId` فيها هي المنشأة
  // النشطة لا مالكة الصف. إخضاعها للسياسة يجعل تسجيل الدخول مستحيلاً.
  'Session',
]);

/** جداول المنصة: عالمية بطبيعتها، لا تخصّ منشأة. */
const PLATFORM_TABLES = ['User', 'MagicLink', 'Plan'];

async function main() {
  await assertRoleCannotBypass();

  const rows = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'tenantId'
    ORDER BY table_name
  `;

  const tables = rows.map((r) => r.table_name).filter((t) => !EXCLUDED.has(t));

  let applied = 0;
  for (const table of tables) {
    await applyPolicy(table, `"tenantId"`);
    applied++;
  }

  // جدول المنشآت نفسه: المفتاح هو `id` لا `tenantId`.
  await applyPolicy('Tenant', `"id"`);
  applied++;

  console.log(`✓ فُعِّل عزل الصفوف على ${applied} جدولاً`);
  console.log(`  مستثنى بقصد: ${[...EXCLUDED].join(', ')}`);
  console.log(`  جداول المنصة (بلا عزل منشأة): ${PLATFORM_TABLES.join(', ')}`);

  await verify(tables.length + 1);
}

/**
 * الحارس الذي لولاه لسقط كل ما سبق صامتاً.
 *
 * Postgres يعفي السوبريوزر وحاملَ BYPASSRLS من سياسات الصفوف إعفاءً تاماً:
 * السياسات تبقى معرّفةً في الجدول، ولا تُطبَّق. فلو وصل التطبيق بدورٍ كهذا
 * لصار كل عملاء المنصة في دفتر واحد، ولا شيء في الشاشة يشي بذلك.
 *
 * لذلك نفشل هنا بصوتٍ عالٍ بدل أن ننشر عزلاً كاذباً.
 */
async function assertRoleCannotBypass() {
  const [role] = await prisma.$queryRaw<
    { rolname: string; rolsuper: boolean; rolbypassrls: boolean }[]
  >`SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;

  if (role?.rolsuper || role?.rolbypassrls) {
    throw new Error(
      `الدور «${role.rolname}» يتخطّى عزل الصفوف ` +
        `(${role.rolsuper ? 'SUPERUSER' : ''}${role.rolsuper && role.rolbypassrls ? ' و' : ''}${role.rolbypassrls ? 'BYPASSRLS' : ''})، ` +
        `فسياسات العزل لن تُطبَّق عليه ولو أُنشئت.\n` +
        `أصلِحه قبل المتابعة:\n` +
        `  ALTER ROLE "${role.rolname}" NOSUPERUSER NOBYPASSRLS;\n` +
        `ويجب أن يبقى مالكاً للجداول ليقرأها ويكتبها ضمن السياسات.`,
    );
  }
  console.log(`✓ الدور «${role?.rolname}» خاضع للعزل (لا SUPERUSER ولا BYPASSRLS)`);
}

async function applyPolicy(table: string, column: string) {
  const q = (sql: string) => prisma.$executeRawUnsafe(sql);

  await q(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
  // FORCE ضروري: بدونه يتخطّى مالكُ الجدول السياسةَ، وPrisma يتصل بالمالك.
  await q(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
  await q(`DROP POLICY IF EXISTS tenant_isolation ON "${table}"`);
  await q(`
    CREATE POLICY tenant_isolation ON "${table}"
    USING (
      ${column} = current_setting('app.tenant_id', true)
      OR current_setting('app.bypass_rls', true) = 'on'
    )
    WITH CHECK (
      ${column} = current_setting('app.tenant_id', true)
      OR current_setting('app.bypass_rls', true) = 'on'
    )
  `);
}

/** تحقّق فعلي: نعدّ الجداول التي صارت محمية ونقارنها بالمتوقّع. */
async function verify(expected: number) {
  const [{ count }] = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*) FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public' AND c.relrowsecurity AND c.relforcerowsecurity
  `;
  if (Number(count) !== expected) {
    throw new Error(`العزل ناقص: ${count} جدولاً محمياً والمتوقّع ${expected}`);
  }
  console.log(`✓ تحقُّق: ${count} جدولاً محمياً بـ FORCE ROW LEVEL SECURITY`);
}

main()
  .catch((e) => {
    console.error('✗ فشل تطبيق العزل:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
