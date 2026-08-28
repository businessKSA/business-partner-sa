/**
 * الأصول الثابتة والاستهلاك.
 *
 * أقساط الطرق الثلاث محسوبةٌ يدوياً من صيغها، لا مأخوذةٌ من مخرجات الكود —
 * وإلا لاختبرنا الكودَ بنفسه. والحالة الحرجة في كلٍّ منها هي الشهر الأخير:
 * الصيغة المتناقصة خصوصاً تُنتج قسطاً يتجاوز المتبقّي، ومن لا يقصّه يُظهر
 * أصلاً بقيمة سالبة في الميزانية.
 */
import './setup.ts';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, withTenant } from '../src/lib/db.ts';
import { provisionTenant, purgeTenantBySlug } from '../src/lib/provisioning.ts';
import {
  monthlyDepreciation, isDue, createAsset, generateDepreciationRun,
  postDepreciationRun, cancelDepreciationRun, disposeAsset, assetRegister,
} from '../src/lib/assets/depreciation.ts';
import { accountByRole, auditLedgerIntegrity } from '../src/lib/accounting/posting.ts';
import { generalLedger, trialBalance } from '../src/lib/accounting/reports.ts';
import { money, d } from '../src/lib/money.ts';

let tenantId: string;
const Y = new Date().getUTCFullYear();
const day = (m: number, dd: number) => new Date(Date.UTC(Y, m - 1, dd));

before(async () => {
  await purgeTenantBySlug('assets-test');
  const t = await provisionTenant({ slug: 'assets-test', nameAr: 'منشأة اختبار الأصول' });
  tenantId = t.id;
});

after(async () => {
  await purgeTenantBySlug('assets-test');
  await prisma.$disconnect();
});

// ── الصيغ ────────────────────────────────────────────────────────────────

test('القسط الثابت: (التكلفة − التخريدية) ÷ الأشهر', () => {
  // ١٢٠٬٠٠٠ تكلفة، ٢٠٬٠٠٠ تخريدية، ٥ سنوات = ٦٠ شهراً
  // (١٢٠٠٠٠ − ٢٠٠٠٠) ÷ ٦٠ = ١٦٦٦٫٦٧
  const amount = monthlyDepreciation({
    cost: 120_000, salvageValue: 20_000, usefulLifeMonths: 60,
    method: 'STRAIGHT_LINE', accumulated: 0,
  });
  assert.equal(amount.toFixed(2), '1666.67');
});

test('القسط الثابت لا يتغيّر بتقدّم العمر', () => {
  const first = monthlyDepreciation({
    cost: 60_000, salvageValue: 0, usefulLifeMonths: 60,
    method: 'STRAIGHT_LINE', accumulated: 0,
  });
  const later = monthlyDepreciation({
    cost: 60_000, salvageValue: 0, usefulLifeMonths: 60,
    method: 'STRAIGHT_LINE', accumulated: 30_000,
  });
  assert.equal(first.toFixed(2), '1000.00');
  assert.equal(later.toFixed(2), '1000.00');
});

test('القسط المتناقص: نسبةٌ من القيمة الدفترية لا من الوعاء', () => {
  // ٦٠ شهراً = ٥ سنوات، معامل ٢ ⇒ النسبة السنوية ٤٠٪، والشهرية ٣٫٣٣٣٪
  // الشهر الأول: ١٠٠٬٠٠٠ × (٢ ÷ ٥ ÷ ١٢) = ٣٣٣٣٫٣٣
  const first = monthlyDepreciation({
    cost: 100_000, salvageValue: 10_000, usefulLifeMonths: 60,
    method: 'DECLINING_BALANCE', decliningFactor: 2, accumulated: 0,
  });
  assert.equal(first.toFixed(2), '3333.33');

  // بعد تراكم ٤٠٬٠٠٠: القيمة الدفترية ٦٠٬٠٠٠ ⇒ ٦٠٠٠٠ × ٠٫٠٣٣٣٣ = ٢٠٠٠٫٠٠
  const later = monthlyDepreciation({
    cost: 100_000, salvageValue: 10_000, usefulLifeMonths: 60,
    method: 'DECLINING_BALANCE', decliningFactor: 2, accumulated: 40_000,
  });
  assert.equal(later.toFixed(2), '2000.00');
  assert.ok(later.lessThan(first), 'القسط المتناقص يقلّ مع الزمن');
});

test('لا يُستهلك الأصل دون قيمته التخريدية — القصّ في الشهر الأخير', () => {
  // الوعاء ٩٠٬٠٠٠ وتراكم منه ٨٩٬٠٠٠ ⇒ المتبقّي ١٬٠٠٠ فقط
  // الصيغة المتناقصة تعطي ٣٦٦٫٦٧ وهي دون المتبقّي، فلا قصّ
  const normal = monthlyDepreciation({
    cost: 100_000, salvageValue: 10_000, usefulLifeMonths: 60,
    method: 'DECLINING_BALANCE', decliningFactor: 2, accumulated: 89_000,
  });
  assert.ok(normal.lessThanOrEqualTo(1000));

  // القسط الثابت هنا يعطي ١٥٠٠ وهي تتجاوز المتبقّي ١٠٠٠ ⇒ تُقصّ
  const clipped = monthlyDepreciation({
    cost: 100_000, salvageValue: 10_000, usefulLifeMonths: 60,
    method: 'STRAIGHT_LINE', accumulated: 89_000,
  });
  assert.equal(clipped.toFixed(2), '1000.00', 'القسط يُقصّ عند المتبقّي');
});

test('الأصل المستهلك بالكامل لا قسط له', () => {
  const amount = monthlyDepreciation({
    cost: 50_000, salvageValue: 5_000, usefulLifeMonths: 36,
    method: 'STRAIGHT_LINE', accumulated: 45_000,
  });
  assert.equal(amount.toFixed(2), '0.00');
});

test('وحدات الإنتاج: بحسب ما استُهلك من الطاقة لا بالزمن', () => {
  // وعاء ٩٠٬٠٠٠ على ١٠٠٬٠٠٠ وحدة ⇒ ٠٫٩ للوحدة. ٢٬٠٠٠ وحدة = ١٨٠٠
  const amount = monthlyDepreciation({
    cost: 100_000, salvageValue: 10_000, usefulLifeMonths: 60,
    method: 'UNITS_OF_PRODUCTION', totalUnits: 100_000, accumulated: 0,
  }, 2_000);
  assert.equal(amount.toFixed(2), '1800.00');
});

test('وحدات الإنتاج بلا إجمالي وحدات مرفوضة', () => {
  assert.throws(
    () => monthlyDepreciation({
      cost: 100_000, salvageValue: 0, usefulLifeMonths: 60,
      method: 'UNITS_OF_PRODUCTION', accumulated: 0,
    }, 100),
    /إجمالي الوحدات/,
  );
});

test('التخريدية أكبر من التكلفة مرفوضة', () => {
  assert.throws(
    () => monthlyDepreciation({
      cost: 10_000, salvageValue: 15_000, usefulLifeMonths: 60,
      method: 'STRAIGHT_LINE', accumulated: 0,
    }),
    /أكبر من تكلفة/,
  );
});

// ── الاستحقاق ────────────────────────────────────────────────────────────

test('الأصل لا يُستهلك قبل تشغيله ولا بعد استبعاده ولا مرّتين', () => {
  const base = { status: 'ACTIVE', lastDepreciatedOn: null, disposalDate: null };

  // شُغِّل في مارس: لا يستحقّ في فبراير
  assert.equal(isDue({ ...base, inServiceDate: day(3, 15) }, Y, 2), false);
  // ويستحقّ في مارس نفسه
  assert.equal(isDue({ ...base, inServiceDate: day(3, 15) }, Y, 3), true);

  // استُهلك مارس سلفاً
  assert.equal(
    isDue({ ...base, inServiceDate: day(1, 1), lastDepreciatedOn: day(3, 1) }, Y, 3),
    false,
  );

  // استُبعد في فبراير: لا يستحقّ في مارس
  assert.equal(
    isDue({ ...base, inServiceDate: day(1, 1), disposalDate: day(2, 10) }, Y, 3),
    false,
  );

  // مستهلك بالكامل
  assert.equal(
    isDue({ ...base, status: 'FULLY_DEPRECIATED', inServiceDate: day(1, 1) }, Y, 3),
    false,
  );
});

// ── الدورة الكاملة ───────────────────────────────────────────────────────

test('إنشاء أصل يأخذ حساباته من الأدوار الوظيفية', async () => {
  await withTenant(tenantId, async (tx) => {
    const a = await createAsset(tx, tenantId, {
      nameAr: 'سيارة نقل — هايلكس',
      categoryAr: 'سيارات',
      purchaseDate: day(1, 10),
      inServiceDate: day(1, 15),
      cost: 120_000, salvageValue: 20_000, usefulLifeMonths: 60,
    });

    assert.match(a.code, /^FA-0001$/);
    assert.ok(a.assetAccountId, 'حساب الأصل');
    assert.ok(a.accumulatedAccountId, 'حساب المجمَّع');
    assert.ok(a.expenseAccountId, 'حساب المصروف');
    assert.equal(a.status, 'ACTIVE');
  });
});

test('تاريخ التشغيل قبل الشراء مرفوض', async () => {
  await withTenant(tenantId, async (tx) => {
    await assert.rejects(
      () => createAsset(tx, tenantId, {
        nameAr: 'أصل بتاريخ مقلوب',
        purchaseDate: day(5, 10), inServiceDate: day(4, 1),
        cost: 10_000, usefulLifeMonths: 12,
      }),
      /قبل تاريخ الشراء/,
    );
  });
});

test('المسيّر يحسب أقساط الأصول المستحقّة فقط', async () => {
  await withTenant(tenantId, async (tx) => {
    // أصل ثانٍ يُشغَّل في مارس — لا يستحقّ في فبراير
    await createAsset(tx, tenantId, {
      nameAr: 'أجهزة حاسب', categoryAr: 'حاسبات',
      purchaseDate: day(3, 1), cost: 36_000, usefulLifeMonths: 36,
      method: 'DECLINING_BALANCE',
    });

    const run = await generateDepreciationRun(tx, tenantId, Y, 2);
    assert.equal(run.assetCount, 1, 'الأصل المشغَّل في مارس لا يدخل مسيّر فبراير');
    assert.equal(money(run.totalAmount).toFixed(2), '1666.67');
    assert.equal(run.status, 'DRAFT');
  });
});

test('لا مسيّران للشهر نفسه', async () => {
  await withTenant(tenantId, async (tx) => {
    await assert.rejects(
      () => generateDepreciationRun(tx, tenantId, Y, 2),
      /موجود بالرقم/,
    );
  });
});

test('الترحيل: المصروف مدين والمجمَّع دائن', async () => {
  await withTenant(tenantId, async (tx) => {
    const run = await tx.depreciationRun.findFirstOrThrow({ where: { tenantId, month: 2 } });
    const posted = await postDepreciationRun(tx, tenantId, run.id, 'tester');
    assert.equal(posted.status, 'POSTED');

    const from = day(1, 1), to = day(12, 31);
    const exp = await accountByRole(tx, tenantId, 'DEPRECIATION');
    const acc = await accountByRole(tx, tenantId, 'ACCUM_DEPRECIATION');

    const expLedger = await generalLedger(tx, tenantId, exp.id, from, to);
    assert.equal(expLedger.closing.toFixed(2), '1666.67');
    assert.equal(expLedger.totalDebit.toFixed(2), '1666.67', 'المصروف مدين');

    // المجمَّع حساب مقابل للأصل: طبيعته في الشجرة أصل، فرصيده الطبيعي مدين،
    // وهو هنا دائن — أي سالب بإشارة الطبيعة، وهذا هو المقصود.
    const accLedger = await generalLedger(tx, tenantId, acc.id, from, to);
    assert.equal(accLedger.totalCredit.toFixed(2), '1666.67', 'المجمَّع دائن');
    assert.equal(accLedger.closing.toFixed(2), '-1666.67');
  });
});

test('المجمَّع يتراكم على الأصل وآخر شهر يُسجَّل', async () => {
  await withTenant(tenantId, async (tx) => {
    const a = await tx.fixedAsset.findFirstOrThrow({ where: { tenantId, code: 'FA-0001' } });
    assert.equal(money(a.accumulated).toFixed(2), '1666.67');
    assert.equal(a.lastDepreciatedOn?.toISOString().slice(0, 10), day(2, 1).toISOString().slice(0, 10));
  });
});

test('مسيّر مارس يشمل الأصلين بأقساطهما الصحيحة', async () => {
  await withTenant(tenantId, async (tx) => {
    const run = await generateDepreciationRun(tx, tenantId, Y, 3);
    assert.equal(run.assetCount, 2);

    // السيارة: قسط ثابت ١٦٦٦٫٦٧
    // الحاسبات: متناقص، ٣٦ شهراً = ٣ سنوات، معامل ٢ ⇒ ٢ ÷ ٣ ÷ ١٢ = ٥٫٥٥٦٪
    //           ٣٦٠٠٠ × ٠٫٠٥٥٥٦ = ٢٠٠٠٫٠٠
    assert.equal(money(run.totalAmount).toFixed(2), '3666.67');

    await postDepreciationRun(tx, tenantId, run.id, 'tester');
  });
});

test('إلغاء المسيّر يردّ المجمَّع ويعيد آخر شهر', async () => {
  await withTenant(tenantId, async (tx) => {
    const run = await tx.depreciationRun.findFirstOrThrow({ where: { tenantId, month: 3 } });
    await cancelDepreciationRun(tx, tenantId, run.id, { date: day(3, 31), reason: 'خطأ في العمر' });

    const a = await tx.fixedAsset.findFirstOrThrow({ where: { tenantId, code: 'FA-0001' } });
    assert.equal(money(a.accumulated).toFixed(2), '1666.67', 'رجع المجمَّع إلى ما قبل مارس');
    assert.equal(
      a.lastDepreciatedOn?.toISOString().slice(0, 10),
      day(2, 1).toISOString().slice(0, 10),
      'وآخر شهر عاد إلى فبراير',
    );

    const exp = await accountByRole(tx, tenantId, 'DEPRECIATION');
    const ledger = await generalLedger(tx, tenantId, exp.id, day(1, 1), day(12, 31));
    assert.equal(ledger.closing.toFixed(2), '1666.67', 'وأثر مارس زال من الدفتر');
  });
});

test('استبعاد أصل بربح: الفرق بين المتحصَّل والقيمة الدفترية', async () => {
  await withTenant(tenantId, async (tx) => {
    const a = await tx.fixedAsset.findFirstOrThrow({ where: { tenantId, code: 'FA-0001' } });
    // التكلفة ١٢٠٬٠٠٠ والمجمَّع ١٦٦٦٫٦٧ ⇒ الدفترية ١١٨٬٣٣٣٫٣٣
    // نبيعه بـ١٢٥٬٠٠٠ ⇒ ربح ٦٬٦٦٦٫٦٧
    const res = await disposeAsset(tx, tenantId, a.id, {
      disposalDate: day(4, 10), proceeds: 125_000, note: 'بيع لمنشأة أخرى', actor: 'tester',
    });

    assert.equal(res.bookValue.toFixed(2), '118333.33');
    assert.equal(res.gain.toFixed(2), '6666.67');
    assert.equal(res.asset.status, 'SOLD');

    const other = await accountByRole(tx, tenantId, 'OTHER_INCOME');
    const ledger = await generalLedger(tx, tenantId, other.id, day(1, 1), day(12, 31));
    assert.equal(ledger.closing.toFixed(2), '6666.67', 'الربح إيرادٌ آخر لا إيراد نشاط');
  });
});

test('الأصل المستبعَد لا يُستبعد مرّتين ولا يدخل مسيّراً', async () => {
  await withTenant(tenantId, async (tx) => {
    const a = await tx.fixedAsset.findFirstOrThrow({ where: { tenantId, code: 'FA-0001' } });
    await assert.rejects(
      () => disposeAsset(tx, tenantId, a.id, { disposalDate: day(5, 1) }),
      /مستبعَد سلفاً/,
    );

    const run = await generateDepreciationRun(tx, tenantId, Y, 5);
    assert.equal(run.assetCount, 1, 'الحاسبات وحدها — السيارة بيعت');
  });
});

test('سجلّ الأصول يعطي التكلفة والمجمَّع والقيمة الدفترية', async () => {
  await withTenant(tenantId, async (tx) => {
    const reg = await assetRegister(tx, tenantId);
    assert.equal(reg.rows.length, 2);

    const sold = reg.rows.find((r) => r.code === 'FA-0001')!;
    assert.equal(sold.status, 'SOLD');

    const active = reg.rows.find((r) => r.code === 'FA-0002')!;
    assert.equal(active.cost.toFixed(2), '36000.00');
    assert.ok(active.depreciatedPercent !== null);

    // المستبعَد لا يدخل الإجماليات
    assert.equal(reg.totalCost.toFixed(2), '36000.00');
  });
});

test('الميزان يتزن والدفتر سليم بعد الأصول', async () => {
  await withTenant(tenantId, async (tx) => {
    const tb = await trialBalance(tx, tenantId, day(1, 1), day(12, 31));
    assert.equal(tb.totals.closingDebit.toFixed(2), tb.totals.closingCredit.toFixed(2));
    assert.deepEqual(await auditLedgerIntegrity(tx, tenantId), []);
  });
});
