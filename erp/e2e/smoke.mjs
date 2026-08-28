/**
 * اختبار الدخان: يقود متصفّحاً حقيقياً على نسخة إنتاج مبنيّة.
 *
 * ما يثبته لا تثبته اختبارات الوحدة: أن الصفحات تُعرض فعلاً، وأن الروابط
 * تصل، وأن الدورة التي يُباع بها النظام — إنشاء منشأة عميل من لوحة المنصة،
 * ثم دخول مالكها إلى دفاتره وحدها — تعمل من طرفها إلى طرفها.
 *
 * التشغيل:
 *   npm run build && npm start &
 *   node e2e/smoke.mjs
 *
 * درسٌ مدفون في هذا الملف: كل نقرة على زرّ إرسال مُقيَّدة بنموذجها
 * (`.content form button`). المحدِّد العام `button[type=submit]` يطابق زرّ
 * تسجيل الخروج في الشريط الجانبي أولاً، فيسجّل الاختبارُ الخروجَ ظانّاً
 * أنه يرسل النموذج — ويقضي من يقرأ نتيجته وقتاً في مطاردة عطلٍ لا وجود له.
 */
import { chromium } from 'playwright-core';

const BASE = process.env.E2E_BASE ?? 'http://localhost:3100';
const EMAIL = process.env.E2E_EMAIL ?? 'admin@businesspartner.sa';
const PASSWORD = process.env.E2E_PASSWORD ?? 'BP-erp-2026';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});

let failures = 0;
const problems = [];

function check(ok, label, detail = '') {
  if (ok) console.log(`✓ ${label}${detail ? ` — ${detail}` : ''}`);
  else { failures++; console.log(`✗ ${label}${detail ? ` — ${detail}` : ''}`); }
}

async function login(page, email, password) {
  await page.goto(`${BASE}/login`);
  await page.fill('#email', email);
  await page.fill('#password', password);
  await Promise.all([
    page.waitForURL('**/dashboard', { timeout: 30_000 }),
    page.click('form button[type=submit]'),
  ]);
}

const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('pageerror', (e) => problems.push(`خطأ جافاسكربت: ${e.message}`));
page.on('response', (r) => { if (r.status() >= 500) problems.push(`${r.status()} ${r.url()}`); });

// ── ١. الدخول وكل رابط في القائمة ─────────────────────────────────────
await login(page, EMAIL, PASSWORD);
check(true, 'تسجيل الدخول');

const links = await page.$$eval('.nav a', (as) => as.map((a) => a.getAttribute('href')));
for (const href of links) {
  const res = await page.goto(`${BASE}${href}`, { waitUntil: 'domcontentloaded' });
  const title = await page.$eval('.topbar h1', (h) => h.textContent).catch(() => null);
  check(res?.status() === 200 && !!title, `صفحة ${href}`, title ?? `HTTP ${res?.status()}`);
}

// ── ٢. صفحات التفصيل — تُفتح من أول صفٍّ في كل قائمة ──────────────────
for (const [label, listUrl] of [
  ['فاتورة', '/sales/invoices'],
  ['قيد يومية', '/accounting/journal'],
  ['مشروع', '/projects'],
  ['مسيّر رواتب', '/hr/payroll'],
  ['أستاذ حساب', '/accounting/accounts'],
]) {
  await page.goto(`${BASE}${listUrl}`, { waitUntil: 'domcontentloaded' });
  const href = await page.$eval('tbody a', (a) => a.getAttribute('href')).catch(() => null);
  if (!href) { check(false, `تفصيل ${label}`, 'لا صفوف في القائمة'); continue; }
  const res = await page.goto(`${BASE}${href}`, { waitUntil: 'domcontentloaded' });
  const title = await page.$eval('.topbar h1', (h) => h.textContent).catch(() => null);
  check(res?.status() === 200 && !!title, `تفصيل ${label}`, title ?? `HTTP ${res?.status()}`);
}

// ── ٣. الدورة التي يُباع بها النظام ───────────────────────────────────
await page.goto(`${BASE}/platform/tenants`, { waitUntil: 'domcontentloaded' });
check(
  (await page.$eval('.topbar h1', (h) => h.textContent).catch(() => null)) !== null,
  'لوحة المنصة تُفتح لمالك المنصة',
);

const slug = `e2e-${Date.now().toString().slice(-8)}`;
const ownerEmail = `owner-${slug}@example.test`;
const ownerPassword = 'E2E-Pass-2026';

await page.goto(`${BASE}/platform/tenants/new`, { waitUntil: 'domcontentloaded' });
await page.fill('#slug', slug);
await page.fill('#nameAr', 'منشأة اختبار آلي');
await page.fill('#city', 'الرياض');
await page.fill('#ownerName', 'مالك الاختبار');
await page.fill('#ownerEmail', ownerEmail);
await page.fill('#password', ownerPassword);
await page.click('.content form button[type=submit]');

const created = await page
  .waitForURL((u) => u.pathname === '/platform/tenants', { timeout: 120_000 })
  .then(() => true)
  .catch(async () => {
    const alert = await page.$eval('.alert.error', (e) => e.textContent).catch(() => 'بلا رسالة');
    problems.push(`فشل إنشاء المنشأة: ${alert}`);
    return false;
  });
check(created, 'إنشاء منشأة عميل من لوحة المنصة', slug);

if (created) {
  // سياق متصفّح مستقل: كوكيز منفصلة تماماً عن جلسة مالك المنصة
  const client = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await login(client, ownerEmail, ownerPassword);

  const tenantName = await client.$eval('.sidebar-brand .tenant', (e) => e.textContent);
  check(tenantName?.includes('منشأة اختبار آلي'), 'مالك المنشأة الجديدة يدخل إلى منشأته');

  await client.goto(`${BASE}/accounting/accounts`, { waitUntil: 'domcontentloaded' });
  const accounts = await client.$$eval('tbody tr', (rs) => rs.length);
  check(accounts > 50, 'المنشأة تُسلَّم بشجرة حسابات كاملة', `${accounts} حساباً`);

  await client.goto(`${BASE}/sales/invoices`, { waitUntil: 'domcontentloaded' });
  const invoiceRows = await client.$$eval('tbody tr', (rs) => rs.length).catch(() => 0);
  check(invoiceRows === 0, 'لا يرى فواتير المنشآت الأخرى', `${invoiceRows} صفاً`);

  await client.goto(`${BASE}/platform/tenants`, { waitUntil: 'domcontentloaded' });
  check(
    new URL(client.url()).pathname !== '/platform/tenants',
    'لوحة المنصة محجوبة عن مالك المنشأة',
    new URL(client.url()).pathname,
  );

  // تنظيف: حذف منشأة الاختبار من لوحة المنصة نفسها.
  // الصف يُستهدف بوسم `data-tenant-slug` لا بترتيبه: صفوف التأكيد والخطأ
  // تُدرج بينها فيصير الترقيم كاذباً.
  await page.goto(`${BASE}/platform/tenants`, { waitUntil: 'domcontentloaded' });
  const row = page.locator(`tr[data-tenant-slug="${slug}"]`);
  await row.locator('button.delete-tenant').click();
  await row.locator('input[name=confirmSlug]').fill(slug);
  await row.locator('button.danger').click();
  await page.waitForTimeout(5000);
  check(
    (await page.locator(`tr[data-tenant-slug="${slug}"]`).count()) === 0,
    'حذف منشأة الاختبار من لوحة المنصة',
  );
}

console.log('');
if (problems.length) {
  failures += problems.length;
  console.log('مشاكل مرصودة:');
  for (const p of problems.slice(0, 10)) console.log(`  · ${p}`);
}
console.log(failures === 0 ? '✓ اجتاز اختبار الدخان' : `✗ ${failures} إخفاقاً`);

await browser.close();
process.exit(failures === 0 ? 0 : 1);
