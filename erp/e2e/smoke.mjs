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

/**
 * يشغّل الأصولَ الثابتة والعملاتِ والتسويةَ البنكية على منشأةٍ بكر.
 * يُنادى من داخل دورة البيع أدناه، فالمنشأة تُحذف بعده.
 */
async function runNewModules(p) {
  const Y = new Date().getUTCFullYear();

  // ١. أصل ثابت: يُضاف، ثم يُولَّد مسيّر استهلاكه ويُرحَّل
  await p.goto(`${BASE}/assets`, { waitUntil: 'domcontentloaded' });
  await p.click('.content button:has-text("إضافة أصل")');
  await p.fill('#nameAr', 'خادم اختبار آلي');
  await p.fill('#categoryAr', 'أجهزة');
  await p.fill('#purchaseDate', `${Y}-01-15`);
  await p.fill('#inServiceDate', `${Y}-01-15`);
  await p.fill('#cost', '48000');
  await p.fill('#salvageValue', '0');
  await p.fill('#usefulLifeMonths', '48');
  await p.click('.content form button[type=submit]');
  await p.waitForTimeout(2500);

  await p.goto(`${BASE}/assets`, { waitUntil: 'domcontentloaded' });
  check(
    (await p.locator('tbody tr', { hasText: 'خادم اختبار آلي' }).count()) === 1,
    'إضافة أصل ثابت من الواجهة',
  );

  // ٤٨٬٠٠٠ على ٤٨ شهراً = ١٬٠٠٠ شهرياً
  await p.goto(`${BASE}/assets/depreciation`, { waitUntil: 'domcontentloaded' });
  await p.selectOption('#month', '2');
  await p.fill('#year', String(Y));
  await p.click('.content form button[type=submit]');
  await p.waitForTimeout(3000);

  const amount = await p
    .locator('tbody tr', { hasText: 'خادم اختبار آلي' }).first()
    .locator('td').nth(3).textContent().catch(() => null);
  check(
    amount?.replace(/[^\d.]/g, '') === '1000.00',
    'قسط الاستهلاك يُحسب صحيحاً في المسيّر',
    amount ?? 'لا سطر',
  );

  await p.click('button:has-text("ترحيل")');
  await p.waitForTimeout(3000);
  await p.goto(`${BASE}/assets/depreciation`, { waitUntil: 'domcontentloaded' });
  check(
    (await p.locator('.badge', { hasText: 'مرحَّل' }).count()) > 0,
    'ترحيل مسيّر الاستهلاك من الواجهة',
  );

  await p.goto(`${BASE}/assets`, { waitUntil: 'domcontentloaded' });
  const accum = await p
    .locator('tbody tr', { hasText: 'خادم اختبار آلي' })
    .locator('td').nth(7).textContent().catch(() => null);
  check(
    accum?.replace(/[^\d.]/g, '') === '1000.00',
    'المجمَّع يظهر في سجل الأصول بعد الترحيل',
    accum ?? 'لا قيمة',
  );

  // ٢. سعر صرف يُدخَل من شاشة العملات
  await p.goto(`${BASE}/accounting/fx`, { waitUntil: 'domcontentloaded' });
  await p.fill('#currency', 'usd');
  await p.fill('#rate', '3.75');
  await p.click('.content form button[type=submit]');
  await p.waitForTimeout(2500);
  await p.goto(`${BASE}/accounting/fx`, { waitUntil: 'domcontentloaded' });
  check(
    (await p.locator('tbody tr', { hasText: 'USD' }).count()) > 0,
    'حفظ سعر صرف من الواجهة — والرمز يُرفع حرفه',
  );

  // ٣. التسوية البنكية كاملةً: استيراد، فقيدُ تسوية، فقفل
  await p.goto(`${BASE}/treasury/reconciliation`, { waitUntil: 'domcontentloaded' });
  await p.click('.content button:has-text("استيراد كشف حساب")');

  // كشفٌ من سطرٍ واحد لا يقابله شيء في الدفتر: رسومٌ بنكية. الافتتاحي صفر
  // والختامي −٧٥ = ٠ + (−٧٥)، فيتزن ويُقبل. والقوسان صيغةُ سالبٍ مقصودة.
  const csv = [
    'التاريخ,الوصف,المرجع,المبلغ,الرصيد',
    `${Y}-02-27,رسوم خدمات بنكية,,(75.00),-75.00`,
  ].join('\n');

  await p.selectOption('#bankAccountId', { index: 0 });
  await p.fill('#reference', `E2E-${Y}-02`);
  await p.fill('#fromDate', `${Y}-02-01`);
  await p.fill('#toDate', `${Y}-02-28`);
  await p.fill('#openingBalance', '0');
  await p.fill('#closingBalance', '-75');
  await p.fill('#csv', csv);
  await p.click('.content form button[type=submit]');
  await p.waitForTimeout(3000);

  await p.goto(`${BASE}/treasury/reconciliation`, { waitUntil: 'domcontentloaded' });
  const stmtRow = p.locator('tbody tr', { hasText: `E2E-${Y}-02` });
  check((await stmtRow.count()) === 1, 'استيراد كشف حساب من الواجهة');

  const href = await stmtRow.locator('a').getAttribute('href');
  await p.goto(`${BASE}${href}`, { waitUntil: 'domcontentloaded' });

  // القفل ممنوع ما دام السطر بلا تفسير — والزر معطَّل لا مخفيّ
  check(
    await p.locator('button:has-text("قفل التسوية")').isDisabled(),
    'القفل ممنوع ما دام في الكشف سطرٌ بلا تفسير',
  );

  await p.click('button:has-text("قيد تسوية")');
  // الحساب يُختار بنصّه لا برمزه: الرموز تُعاد ترقيمها في شجرة كل منشأة.
  const chargesValue = await p.$eval(
    'select[name=counterAccountId]',
    (sel) => [...sel.options].find((o) => o.textContent.includes('المصروفات البنكية'))?.value,
  );
  check(!!chargesValue, 'حساب المصروفات البنكية مقترَحٌ في قائمة قيد التسوية');
  await p.selectOption('select[name=counterAccountId]', chargesValue);
  await p.click('button:has-text("ترحيل القيد")');
  await p.waitForTimeout(3000);

  await p.goto(`${BASE}${href}`, { waitUntil: 'domcontentloaded' });
  check(
    (await p.locator('.badge', { hasText: 'مطابَق' }).count()) > 0,
    'قيد التسوية يُرحَّل ويطابق السطر بنفسه',
  );
  check(
    !(await p.locator('button:has-text("قفل التسوية")').isDisabled()),
    'القفل يُتاح بعد تفسير كل بند',
  );

  await p.click('button:has-text("قفل التسوية")');
  await p.waitForTimeout(3000);
  await p.goto(`${BASE}${href}`, { waitUntil: 'domcontentloaded' });
  check(
    (await p.locator('.topbar .badge', { hasText: 'مُسوّى' }).count()) > 0,
    'قفل التسوية البنكية من الواجهة',
  );

  // ٤. الدفتر ما زال سليماً بعد قيود الموديولات الجديدة
  await p.goto(`${BASE}/admin/audit`, { waitUntil: 'domcontentloaded' });
  check(
    !(await p.textContent('body')).includes('قيد غير متوازن'),
    'فحص السلامة لا يجد قيداً غير متوازن بعد قيود الموديولات الجديدة',
  );
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

  // ── الموديولات الجديدة تُشغَّل من الواجهة، داخل هذه المنشأة بالذات ──
  //
  // صفحةٌ تُعرض ليست صفحةً تعمل. ما يلي يُدخل بيانات حقيقية عبر النماذج
  // نفسها التي يستعملها المحاسب، لأن ما بين إجراء الخادم والنموذج —
  // أسماءُ الحقول، ومربّعُ اختيارٍ لا يُرسَل حين لا يُؤشَّر — لا يمسكه إلا
  // متصفّحٌ حقيقي.
  //
  // ولماذا هنا لا على منشأة العرض؟ لأن المنشأة تُحذف بعد قليل، فيبدأ كل
  // تشغيلٍ من صفر. اختبارُ دخانٍ لا ينجح إلا على قاعدةٍ بكر يفشل في ثاني
  // مرّة، ولا يُشغّله أحدٌ بعدها.
  await runNewModules(client);

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
