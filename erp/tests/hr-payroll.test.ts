/**
 * الموارد البشرية: التأمينات، ومكافأة نهاية الخدمة، ومسيّر الرواتب.
 *
 * حالات مكافأة نهاية الخدمة محسوبةٌ يدوياً من نصّ المادّتين ٨٤ و٨٥، لا
 * مأخوذةٌ من مخرجات الكود — وإلا لاختبرنا الكودَ بنفسه.
 */
import './setup.ts';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, withTenant } from '../src/lib/db.ts';
import { provisionTenant, purgeTenantBySlug } from '../src/lib/provisioning.ts';
import { calculateGosi, contributionBase, DEFAULT_GOSI_RATES } from '../src/lib/hr/gosi.ts';
import { calculateEosb, monthlyEosbProvision } from '../src/lib/hr/eosb.ts';
import { generatePayrollRun, approvePayrollRun, postPayrollRun } from '../src/lib/hr/payroll.ts';
import { accountByRole, auditLedgerIntegrity } from '../src/lib/accounting/posting.ts';
import { generalLedger, trialBalance } from '../src/lib/accounting/reports.ts';
import { money, d } from '../src/lib/money.ts';

let tenantId: string;
const Y = new Date().getUTCFullYear();

before(async () => {
  await purgeTenantBySlug('hr-test');
  const t = await provisionTenant({ slug: 'hr-test', nameAr: 'منشأة اختبار الموارد البشرية' });
  tenantId = t.id;

  await withTenant(tenantId, async (tx) => {
    await tx.employee.create({
      data: {
        tenantId, code: 'E-001', nameAr: 'عبدالله السعودي',
        nationality: 'SA', isSaudi: true,
        hireDate: new Date(Date.UTC(Y - 3, 0, 1)),
        basicSalary: '10000', housingAllowance: '2500', transportAllowance: '500',
        gosiSubject: true,
      },
    });
    await tx.employee.create({
      data: {
        tenantId, code: 'E-002', nameAr: 'راجيش كومار',
        nationality: 'IN', isSaudi: false,
        hireDate: new Date(Date.UTC(Y - 1, 5, 1)),
        basicSalary: '6000', housingAllowance: '1500', transportAllowance: '300',
        gosiSubject: true,
      },
    });
  });
});

after(async () => {
  await purgeTenantBySlug('hr-test');
  await prisma.$disconnect();
});

// ── التأمينات الاجتماعية ─────────────────────────────────────────────────

test('وعاء الاشتراك: الأساسي والسكن، بحدَّين أدنى وأعلى', () => {
  assert.equal(contributionBase(10000, 2500).toFixed(2), '12500.00');
  assert.equal(contributionBase(800, 200).toFixed(2), '1500.00', 'الحدّ الأدنى');
  assert.equal(contributionBase(50000, 10000).toFixed(2), '45000.00', 'الحدّ الأعلى');
});

test('السعودي: معاش وساند على الطرفين، وأخطار مهنية على صاحب العمل', () => {
  const g = calculateGosi({ basicSalary: 10000, housingAllowance: 2500, isSaudi: true });

  assert.equal(g.base.toFixed(2), '12500.00');
  // ٩٪ معاش + ٠٫٧٥٪ ساند = ٩٫٧٥٪ من ١٢٥٠٠
  assert.equal(g.employee.toFixed(2), '1218.75');
  // ٩٪ + ٠٫٧٥٪ + ٢٪ أخطار = ١١٫٧٥٪
  assert.equal(g.employer.toFixed(2), '1468.75');
  assert.equal(g.breakdown.occupationalHazards.toFixed(2), '250.00');
});

test('غير السعودي: أخطار مهنية فقط، ولا خصم من أجره', () => {
  const g = calculateGosi({ basicSalary: 6000, housingAllowance: 1500, isSaudi: false });

  assert.equal(g.employee.toFixed(2), '0.00', 'خصمُ حصة معاشٍ من المقيم خصمٌ بلا وجه');
  assert.equal(g.employer.toFixed(2), '150.00', '٢٪ من ٧٥٠٠');
});

test('غير الخاضع للتأمينات: لا اشتراك من الطرفين', () => {
  const g = calculateGosi({ basicSalary: 10000, housingAllowance: 2500, isSaudi: true, subject: false });
  assert.equal(g.total.toFixed(2), '0.00');
});

test('النسب معطياتٌ تُمرَّر — لا ثوابت مدفونة', () => {
  const custom = {
    ...DEFAULT_GOSI_RATES,
    saudi: { ...DEFAULT_GOSI_RATES.saudi, pensionEmployee: 0.11, pensionEmployer: 0.11 },
  };
  const g = calculateGosi({ basicSalary: 10000, housingAllowance: 0, isSaudi: true, rates: custom });
  // ١١٪ + ٠٫٧٥٪ = ١١٫٧٥٪ من ١٠٠٠٠
  assert.equal(g.employee.toFixed(2), '1175.00');
});

// ── مكافأة نهاية الخدمة ──────────────────────────────────────────────────

test('إنهاء الخدمة بعد ثلاث سنوات: نصف شهر عن كل سنة', () => {
  const r = calculateEosb({
    hireDate: new Date(Date.UTC(2020, 0, 1)),
    endDate: new Date(Date.UTC(2023, 0, 1)),
    lastWage: 12000,
    endReason: 'TERMINATION',
  });

  // ٣ سنوات × نصف شهر = ١٫٥ شهر × ١٢٠٠٠ = ١٨٠٠٠
  assert.equal(r.grossAward.toFixed(2), '18000.00');
  assert.equal(r.entitlementRatio.toFixed(0), '1');
  assert.equal(r.award.toFixed(2), '18000.00');
});

test('إنهاء الخدمة بعد ثمان سنوات: خمس بنصف شهر وثلاث بشهر', () => {
  const r = calculateEosb({
    hireDate: new Date(Date.UTC(2016, 0, 1)),
    endDate: new Date(Date.UTC(2024, 0, 1)),
    lastWage: 10000,
    endReason: 'TERMINATION',
  });

  // (٥ × ٠٫٥ + ٣ × ١) × ١٠٠٠٠ = ٥٫٥ × ١٠٠٠٠ = ٥٥٠٠٠ بالضبط.
  // «بالضبط» ممكنةٌ لأن المدّة تُحسب بالتقويم: ثماني سنوات كاملة لا
  // ٨٫٠٠٥ سنة كما تعطي قسمةُ الأيام على ٣٦٥.
  assert.equal(r.grossAward.toFixed(2), '55000.00');
  assert.equal(r.serviceYears.toFixed(4), '8.0000');
});

test('استقالة قبل سنتين: لا مكافأة', () => {
  const r = calculateEosb({
    hireDate: new Date(Date.UTC(2023, 0, 1)),
    endDate: new Date(Date.UTC(2024, 5, 1)),
    lastWage: 10000,
    endReason: 'RESIGNATION',
  });
  assert.equal(r.award.toFixed(2), '0.00');
  assert.match(r.explanation, /لا مكافأة/);
  assert.match(r.explanation, /٨٥/);
});

test('استقالة بعد ثلاث سنوات: الثلث', () => {
  const r = calculateEosb({
    hireDate: new Date(Date.UTC(2021, 0, 1)),
    endDate: new Date(Date.UTC(2024, 0, 1)),
    lastWage: 12000,
    endReason: 'RESIGNATION',
  });
  assert.equal(r.grossAward.toFixed(2), '18000.00');
  assert.equal(r.award.toFixed(2), '6000.00', 'ثلث ١٨٠٠٠');
  assert.match(r.explanation, /ثلث/);
});

test('استقالة بعد سبع سنوات: الثلثان', () => {
  const r = calculateEosb({
    hireDate: new Date(Date.UTC(2017, 0, 1)),
    endDate: new Date(Date.UTC(2024, 0, 1)),
    lastWage: 10000,
    endReason: 'RESIGNATION',
  });
  // (٥×٠٫٥ + ٢×١) × ١٠٠٠٠ = ٤٥٠٠٠، والثلثان منها ٣٠٠٠٠
  assert.equal(r.grossAward.toFixed(2), '45000.00');
  assert.equal(r.award.toFixed(2), '30000.00');
  assert.match(r.explanation, /ثلثا/);
});

test('استقالة بعد اثنتي عشرة سنة: المكافأة كاملة', () => {
  const r = calculateEosb({
    hireDate: new Date(Date.UTC(2012, 0, 1)),
    endDate: new Date(Date.UTC(2024, 0, 1)),
    lastWage: 10000,
    endReason: 'RESIGNATION',
  });
  assert.equal(r.entitlementRatio.toFixed(0), '1');
});

test('الاستقالة باستحقاق كامل (حالة منصوص عليها) تُعطي المكافأة كاملة', () => {
  const r = calculateEosb({
    hireDate: new Date(Date.UTC(2021, 0, 1)),
    endDate: new Date(Date.UTC(2024, 0, 1)),
    lastWage: 12000,
    endReason: 'RESIGNATION',
    fullEntitlement: true,
  });
  assert.equal(r.award.toFixed(2), '18000.00');
  assert.match(r.explanation, /استحقاق كامل/);
});

test('السنة الكبيسة لا تزيد المكافأة — الحساب بالتقويم لا بقسمة الأيام', () => {
  // من أول يناير ٢٠٢٠ إلى أول يناير ٢٠٢٣: ثلاث سنوات تماماً، وبينها
  // ١٠٩٦ يوماً لأن ٢٠٢٠ كبيسة. قسمةُ الأيام على ٣٦٥ تعطي ٣٫٠٠٢٧ سنة
  // فتزيد المكافأة ستةَ عشرَ ريالاً لا يستطيع محاسبٌ تفسيرها في مخالصة.
  const leap = calculateEosb({
    hireDate: new Date(Date.UTC(2020, 0, 1)),
    endDate: new Date(Date.UTC(2023, 0, 1)),
    lastWage: 12000, endReason: 'TERMINATION',
  });
  const nonLeap = calculateEosb({
    hireDate: new Date(Date.UTC(2021, 0, 1)),
    endDate: new Date(Date.UTC(2024, 0, 1)),
    lastWage: 12000, endReason: 'TERMINATION',
  });
  assert.equal(leap.serviceYears.toFixed(4), '3.0000');
  assert.equal(leap.grossAward.toFixed(2), nonLeap.grossAward.toFixed(2),
    'ثلاث سنوات هي ثلاث سنوات، كبيسةً كانت أم لا');
});

test('كسور السنة تُحسب بنسبتها لا تُهمل', () => {
  const full = calculateEosb({
    hireDate: new Date(Date.UTC(2022, 0, 1)),
    endDate: new Date(Date.UTC(2024, 0, 1)),
    lastWage: 12000, endReason: 'TERMINATION',
  });
  const half = calculateEosb({
    hireDate: new Date(Date.UTC(2022, 0, 1)),
    endDate: new Date(Date.UTC(2024, 6, 1)),
    lastWage: 12000, endReason: 'TERMINATION',
  });
  assert.ok(half.grossAward.greaterThan(full.grossAward), 'نصف سنة إضافية يجب أن تزيد المكافأة');
});

test('نهاية الخدمة قبل التعيين مرفوضة', () => {
  assert.throws(
    () => calculateEosb({
      hireDate: new Date(Date.UTC(2024, 0, 1)),
      endDate: new Date(Date.UTC(2023, 0, 1)),
      lastWage: 1000, endReason: 'TERMINATION',
    }),
    /قبل تاريخ التعيين/,
  );
});

test('المخصَّص الشهري يوزّع الالتزام على أشهر الخدمة', () => {
  const p = monthlyEosbProvision(
    new Date(Date.UTC(2022, 0, 1)),
    new Date(Date.UTC(2024, 0, 1)),
    12000,
  );
  // نصف شهر سنوياً ÷ ١٢ = ٥٠٠ ريالاً شهرياً على أجر ١٢٠٠٠
  assert.equal(p.toFixed(2), '500.00');
});

// ── مسيّر الرواتب ────────────────────────────────────────────────────────

test('المسيّر يحسب الصافي والتأمينات لكل موظف', async () => {
  await withTenant(tenantId, async (tx) => {
    const run = await generatePayrollRun(tx, tenantId, { year: Y, month: 3 });

    assert.equal(run.status, 'DRAFT');
    assert.equal(run.payslips.length, 2);

    const saudi = run.payslips.find((p) => p.employee.code === 'E-001')!;
    assert.equal(money(saudi.gross).toFixed(2), '13000.00', '١٠٠٠٠ + ٢٥٠٠ + ٥٠٠');
    assert.equal(money(saudi.gosiEmployee).toFixed(2), '1218.75');
    assert.equal(money(saudi.gosiEmployer).toFixed(2), '1468.75');
    assert.equal(money(saudi.net).toFixed(2), '11781.25', '١٣٠٠٠ − ١٢١٨٫٧٥');

    const resident = run.payslips.find((p) => p.employee.code === 'E-002')!;
    assert.equal(money(resident.gross).toFixed(2), '7800.00');
    assert.equal(money(resident.gosiEmployee).toFixed(2), '0.00');
    assert.equal(money(resident.net).toFixed(2), '7800.00', 'لا خصم على المقيم');

    assert.equal(money(run.totalNet).toFixed(2), '19581.25');
  });
});

test('لا مسيّران للشهر نفسه', async () => {
  await withTenant(tenantId, async (tx) => {
    await assert.rejects(
      () => generatePayrollRun(tx, tenantId, { year: Y, month: 3 }),
      /موجود بالرقم/,
    );
  });
});

test('الغياب والإضافي والمكافأة تدخل الحساب', async () => {
  await withTenant(tenantId, async (tx) => {
    const emp = await tx.employee.findFirstOrThrow({ where: { tenantId, code: 'E-001' } });
    const run = await generatePayrollRun(tx, tenantId, {
      year: Y, month: 4,
      adjustments: [{ employeeId: emp.id, absentDays: 3, overtimeHours: 10, bonus: 1000 }],
    });

    const slip = run.payslips.find((p) => p.employee.code === 'E-001')!;

    // خصم الغياب: ١٣٠٠٠ ÷ ٣٠ × ٣ = ١٣٠٠
    assert.equal(money(slip.absenceDeduction).toFixed(2), '1300.00');
    // الإضافي: (١٣٠٠٠ ÷ ٢٤٠) × ١٫٥ × ١٠ = ٨١٢٫٥٠
    assert.equal(money(slip.overtimeAmount).toFixed(2), '812.50');
    assert.equal(money(slip.gross).toFixed(2), '14812.50', '١٣٠٠٠ + ٨١٢٫٥٠ + ١٠٠٠');
    // التأمينات على الأجر الثابت لا على الإضافي
    assert.equal(money(slip.gosiEmployee).toFixed(2), '1218.75');
    assert.equal(money(slip.net).toFixed(2), '12293.75', '١٤٨١٢٫٥٠ − ١٣٠٠ − ١٢١٨٫٧٥');
  });
});

test('المسيّر لا يُرحَّل قبل اعتماده', async () => {
  await withTenant(tenantId, async (tx) => {
    const run = await tx.payrollRun.findFirstOrThrow({ where: { tenantId, month: 3 } });
    await assert.rejects(() => postPayrollRun(tx, tenantId, run.id), /يُعتمد قبل ترحيله/);
  });
});

test('الترحيل: الأجر مصروف، وحصة الموظف اقتطاع لا مصروف', async () => {
  await withTenant(tenantId, async (tx) => {
    const run = await tx.payrollRun.findFirstOrThrow({ where: { tenantId, month: 3 } });
    await approvePayrollRun(tx, tenantId, run.id, 'tester');
    const posted = await postPayrollRun(tx, tenantId, run.id, 'tester');

    assert.equal(posted.status, 'POSTED');

    const from = new Date(Date.UTC(Y, 0, 1));
    const to = new Date(Date.UTC(Y, 11, 31));

    const basicAcc = await accountByRole(tx, tenantId, 'PAYROLL_BASIC');
    const basicLedger = await generalLedger(tx, tenantId, basicAcc.id, from, to);
    assert.equal(basicLedger.closing.toFixed(2), '16000.00', '١٠٠٠٠ + ٦٠٠٠');

    const gosiExp = await accountByRole(tx, tenantId, 'GOSI_EXPENSE');
    const gosiExpLedger = await generalLedger(tx, tenantId, gosiExp.id, from, to);
    assert.equal(gosiExpLedger.closing.toFixed(2), '1618.75', '١٤٦٨٫٧٥ + ١٥٠');

    const payable = await accountByRole(tx, tenantId, 'SALARY_PAYABLE');
    const payableLedger = await generalLedger(tx, tenantId, payable.id, from, to);
    assert.equal(payableLedger.closing.toFixed(2), '19581.25', 'الصافي المستحق للموظفين');

    const gosiPayable = await accountByRole(tx, tenantId, 'GOSI_PAYABLE');
    const gosiPayableLedger = await generalLedger(tx, tenantId, gosiPayable.id, from, to);
    assert.equal(
      gosiPayableLedger.closing.toFixed(2), '2837.50',
      'المستحق للتأمينات = حصة الموظفين ١٢١٨٫٧٥ + حصة صاحب العمل ١٦١٨٫٧٥',
    );
  });
});

test('صافي راتب سالب يُرفض بدل أن يُرحَّل', async () => {
  await withTenant(tenantId, async (tx) => {
    const emp = await tx.employee.findFirstOrThrow({ where: { tenantId, code: 'E-002' } });
    await assert.rejects(
      () => generatePayrollRun(tx, tenantId, {
        year: Y, month: 5,
        adjustments: [{ employeeId: emp.id, loanDeduction: 99_999 }],
      }),
      /صافي راتب.*سالب/,
    );
  });
});

test('الميزان يتزن بعد ترحيل الرواتب', async () => {
  await withTenant(tenantId, async (tx) => {
    const tb = await trialBalance(tx, tenantId, new Date(Date.UTC(Y, 0, 1)), new Date(Date.UTC(Y, 11, 31)));
    assert.equal(tb.totals.closingDebit.toFixed(2), tb.totals.closingCredit.toFixed(2));
    assert.deepEqual(await auditLedgerIntegrity(tx, tenantId), []);
  });
});
