/**
 * بناء النشر.
 *
 * ── لماذا ليس سطراً واحداً في package.json ─────────────────────────────
 *
 * لأن «هيّئ القاعدة ثم ابنِ» ليس صحيحاً في كل نشرة:
 *
 *   ـ **المعاينات.** كل دفعةٍ على كل طلب دمج تُنتج نشرة معاينة. ولو
 *     رحّلت المعاينةُ المخطّطَ وزرعت، لصار كل طلب دمجٍ يكتب في قاعدة
 *     التشغيل — والبذرة تمسح منشأة العرض قبل أن تعيد بناءها. أي أن
 *     فتح طلب دمجٍ لتصحيح خطأٍ مطبعي كان سيمسح ما يجرّبه العميل.
 *
 *   ـ **البناء بلا قاعدة.** لا سبب يمنع بناء الواجهة حين لا يكون رابط
 *     القاعدة مضبوطاً بعد. كل مسارات هذا التطبيق ديناميكية، فلا صفحة
 *     تُبنى مسبقاً تحتاج استعلاماً. والفشل حينها ضجيجٌ لا معنى له.
 *
 * فالترحيل يقع في الإنتاج وحده، ومتى وُجد رابط القاعدة. وما عداه يُبنى
 * ويقول لماذا تخطّى.
 */
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, delimiter } from 'node:path';

// السكربت يُستدعى مباشرةً لا عبر npm، فلا يضع أحدٌ `node_modules/.bin`
// في المسار نيابةً عنّا. وضعُه هنا يجعل النتيجة واحدةً أينما شُغِّل.
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const env = {
  ...process.env,
  PATH: `${join(root, 'node_modules', '.bin')}${delimiter}${process.env.PATH ?? ''}`,
};

const run = (cmd) => {
  console.log(`\n▸ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: root, env });
};

const hasDb = Boolean(process.env.DATABASE_URL);
const isProduction = process.env.VERCEL_ENV === 'production';
const forced = process.env.RUN_DB_MIGRATIONS === '1';
const shouldMigrate = hasDb && (isProduction || forced);

run('prisma generate');

if (shouldMigrate) {
  console.log('\n◇ الإنتاج: تهيئة المخطّط وتطبيق العزل وزرع بيانات العرض مرّةً.');
  run('prisma db push --skip-generate');
  run('tsx scripts/apply-rls.ts');
  run('tsx prisma/seed-if-empty.ts');
} else {
  const why = !hasDb
    ? 'DATABASE_URL غير مضبوط'
    : `نشرة ${process.env.VERCEL_ENV ?? 'محلية'} لا إنتاج (اضبط RUN_DB_MIGRATIONS=1 لفرضه)`;
  console.log(`\n↷ يُتخطّى الترحيل: ${why}. تُبنى الواجهة وحدها.`);
}

run('next build');
