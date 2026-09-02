/** تحميل متغيّرات البيئة للسكربتات المشغَّلة خارج Next. */
import { existsSync } from 'node:fs';
const envFile = new URL('../.env', import.meta.url).pathname;
if (existsSync(envFile)) process.loadEnvFile(envFile);
