/**
 * تحميل متغيّرات البيئة للاختبارات.
 *
 * عميل Prisma يقرأ `.env` بنفسه، فاختبارات القاعدة تعمل بلا هذا الملف —
 * وهذا بالضبط ما يخدع: يمرّ نصفُ الاختبارات فيُظنّ أن البيئة محمَّلة،
 * ثم يسقط أول اختبار يقرأ متغيّراً بنفسه. نحمّلها هنا صراحةً مرّة واحدة.
 */
import { existsSync } from 'node:fs';

const envFile = new URL('../.env', import.meta.url).pathname;

if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

// قيم افتراضية للاختبارات وحدها — لا تُستعمل في الإنتاج لأن غيابها هناك
// يوقف التشغيل بخطأ صريح.
process.env.ENCRYPTION_KEY ??= 'test-only-encryption-key-32-chars-min!!';
process.env.SESSION_SECRET ??= 'test-only-session-secret-32-chars-min!!';
